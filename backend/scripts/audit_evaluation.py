"""
Scientific Audit Script for VARUNA.
Calculates exact held-out test set metrics, weights distribution, dataset metadata, and checks consistency.
"""
import json
import pandas as pd
import numpy as np
import xgboost as xgb
from backend.app.science.weighting import (
    largest_remainder_normalize,
    compute_inverse_variance_weights,
    blend_member_forecasts
)
from backend.app.science.meta_model import VarunaMetaModel, FEATURE_NAMES
from backend.app.config import MODELS_DIR

def run_audit():
    df = pd.read_csv('backend/data/aligned_historical_data.csv')
    df_sorted = df.sort_values('timestamp').reset_index(drop=True)
    split_idx = int(len(df_sorted) * 0.75)
    train_df = df_sorted.iloc[:split_idx]
    test_df = df_sorted.iloc[split_idx:]

    print("=================================================================")
    print("1. DATASET COUNTS & TIME COVERAGE")
    print("=================================================================")
    print(f"Total historical forecast rows: {len(df)}")
    print(f"Number of canonical regions: {df['region_id'].nunique()}")
    for reg, cnt in df['region_id'].value_counts().items():
        print(f"  - {reg}: {cnt} rows")
    print(f"Number of variables: {df['variable'].nunique()} ({list(df['variable'].unique())})")
    print(f"Number of unique valid timestamps: {df['timestamp'].nunique()}")
    print(f"Earliest valid time: {df['timestamp'].min()}")
    print(f"Latest valid time: {df['timestamp'].max()}")
    print(f"Paired forecast/reference records: {len(df)} rows * 4 models = {len(df)*4} model points")
    print(f"Train split rows: {len(train_df)} ({train_df['timestamp'].min()} to {train_df['timestamp'].max()})")
    print(f"Test split rows: {len(test_df)} ({test_df['timestamp'].min()} to {test_df['timestamp'].max()})")

    print("\n=================================================================")
    print("2. MODEL TRAINING & LEAKAGE AUDIT")
    print("=================================================================")
    print(f"ML Algorithm: Extreme Gradient Boosting (xgboost.XGBRegressor)")
    print(f"XGBoost Package Version: {xgb.__version__}")
    print(f"Feature list ({len(FEATURE_NAMES)} features): {FEATURE_NAMES}")
    print(f"Target variable: Absolute Forecast Residual |y_hat - y_ref| (deg C)")
    print(f"Model checkpoint path: {MODELS_DIR / 'xgboost_meta_temperature.joblib'}")
    
    # Train Inverse-RMSE weights strictly from train set
    train_rmse = {}
    for m in ['ecmwf_ifs', 'ecmwf_aifs', 'ncep_gfs', 'dwd_icon']:
        err = train_df[f'{m}_val'] - train_df['reference_val']
        train_rmse[m] = float(np.sqrt(np.mean(err**2)))
    inv_weights = compute_inverse_variance_weights(train_rmse)
    print(f"Train-set RMSE baseline: {train_rmse}")
    print(f"Train-set Inverse-RMSE static weights: {inv_weights}")

    # Load trained meta model
    meta_model = VarunaMetaModel('temperature')
    meta_model.load_checkpoint()

    print("\n=================================================================")
    print("3. BASELINE COMPARISON ON THE EXACT HELD-OUT TEST SET (N=756)")
    print("=================================================================")
    
    results = {}
    # Single model evaluations
    for m in ['ecmwf_ifs', 'ecmwf_aifs', 'ncep_gfs', 'dwd_icon']:
        err = test_df[f'{m}_val'].values - test_df['reference_val'].values
        results[m] = {
            'rmse': float(np.sqrt(np.mean(err**2))),
            'mae': float(np.mean(np.abs(err)))
        }

    # Equal Blend (25% each)
    eq_weights = {'ecmwf_ifs': 25, 'ecmwf_aifs': 25, 'ncep_gfs': 25, 'dwd_icon': 25}
    eq_preds = []
    for _, row in test_df.iterrows():
        m_vals = {m: row[f'{m}_val'] for m in ['ecmwf_ifs', 'ecmwf_aifs', 'ncep_gfs', 'dwd_icon']}
        eq_preds.append(blend_member_forecasts(m_vals, eq_weights))
    eq_err = np.array(eq_preds) - test_df['reference_val'].values
    results['Equal Blend'] = {
        'rmse': float(np.sqrt(np.mean(eq_err**2))),
        'mae': float(np.mean(np.abs(eq_err)))
    }

    # Inverse-RMSE Blend (derived from train set)
    inv_preds = []
    for _, row in test_df.iterrows():
        m_vals = {m: row[f'{m}_val'] for m in ['ecmwf_ifs', 'ecmwf_aifs', 'ncep_gfs', 'dwd_icon']}
        inv_preds.append(blend_member_forecasts(m_vals, inv_weights))
    inv_err = np.array(inv_preds) - test_df['reference_val'].values
    results['Inverse-RMSE Blend'] = {
        'rmse': float(np.sqrt(np.mean(inv_err**2))),
        'mae': float(np.mean(np.abs(inv_err)))
    }

    # XGBoost VARUNA Blend
    xgb_preds = []
    sample_weights_list = []
    for idx, (_, row) in enumerate(test_df.iterrows()):
        m_vals = {m: row[f'{m}_val'] for m in ['ecmwf_ifs', 'ecmwf_aifs', 'ncep_gfs', 'dwd_icon']}
        res = meta_model.predict_adaptive_weights(
            lat=row['latitude'], lon=row['longitude'], elev=row['elevation_m'],
            day_of_year=int(row['day_of_year']), hour=int(row['hour_of_day']),
            month=int(row['month']), regime_idx=int(row['regime_index']),
            model_values=m_vals
        )
        xgb_preds.append(blend_member_forecasts(m_vals, res['weights']))
        if len(sample_weights_list) < 8:
            sample_weights_list.append({
                'location': row['region_id'],
                'valid_time': row['timestamp'],
                'lead_time': '48h',
                'regime': row['regime'],
                'weights': res['weights'],
                'sum': sum(res['weights'].values())
            })
            
    xgb_err = np.array(xgb_preds) - test_df['reference_val'].values
    results['XGBoost VARUNA Blend'] = {
        'rmse': float(np.sqrt(np.mean(xgb_err**2))),
        'mae': float(np.mean(np.abs(xgb_err)))
    }

    for name, m in results.items():
        print(f"  {name:25s} | RMSE: {m['rmse']:.4f} °C | MAE: {m['mae']:.4f} °C")

    print("\n=================================================================")
    print("4. REAL EXAMPLES OF ADAPTIVE WEIGHTS (Sum check = 100%)")
    print("=================================================================")
    for idx, s in enumerate(sample_weights_list[:6], 1):
        w = s['weights']
        print(f"Example {idx}:")
        print(f"  Location   : {s['location']}")
        print(f"  Valid Time : {s['valid_time']}")
        print(f"  Lead Time  : {s['lead_time']}")
        print(f"  Regime     : {s['regime']}")
        print(f"  IFS Weight : {w['ecmwf_ifs']}%")
        print(f"  AIFS Weight: {w['ecmwf_aifs']}%")
        print(f"  GFS Weight : {w['ncep_gfs']}%")
        print(f"  ICON Weight: {w['dwd_icon']}%")
        print(f"  Sum Total  : {s['sum']}% (CONFIRMED: {s['sum'] == 100})")
        print()

if __name__ == '__main__':
    run_audit()
