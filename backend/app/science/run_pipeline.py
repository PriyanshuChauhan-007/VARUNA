"""
VARUNA Master Science & Multi-Season, Multi-Lead Verification Pipeline Runner.
Evaluates 4 NWP/AI models across:
- 4 Lead Times: 24h, 48h, 72h, 120h
- 4 Indian Seasons: Winter, Pre-Monsoon, Southwest Monsoon, Post-Monsoon
- 6 Canonical Indian Meteorological Zones
- Models: ECMWF IFS, ECMWF AIFS, NOAA GFS, DWD ICON, Equal Blend, Inverse-RMSE, XGBoost VARUNA Blend
- Zero synthetic data; 100% verified against ERA5 Reanalysis Reference Dataset.
"""
import os
import json
import time
from pathlib import Path
from datetime import datetime, timezone
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from ..config import (
    BASE_DIR, DATA_DIR, REPORTS_DIR, MODELS_DIR,
    CANONICAL_REGIONS, CANONICAL_MODELS, CANONICAL_VARIABLES
)
from ..providers.open_meteo import OpenMeteoProvider
from .alignment import align_previous_runs_with_reference
from .verification import compute_verification_metrics
from .weighting import (
    compute_inverse_variance_weights,
    compute_contextual_weights_from_errors,
    blend_member_forecasts
)
from .meta_model import VarunaMetaModel, FEATURE_NAMES

SEASONS = {
    "Winter": ("2026-01-10", "2026-01-17"),
    "Pre-Monsoon": ("2026-04-10", "2026-04-17"),
    "Monsoon": ("2026-07-01", "2026-07-15"),
    "Post-Monsoon": ("2026-09-01", "2026-09-08"),
}

LEAD_MAPPING = {
    1: 24,   # 24h lead
    2: 48,   # 48h lead
    3: 72,   # 72h lead
    5: 120   # 120h lead
}

def run_expanded_pipeline():
    print("=" * 80)
    print("VARUNA MULTI-SEASON & MULTI-LEAD SCIENTIFIC VERIFICATION PIPELINE")
    print("=" * 80)

    provider = OpenMeteoProvider()
    
    sample_region_keys = [
        "delhi_ncr", "mumbai_coastal", "western_ghats",
        "odisha_coast", "bengaluru_deccan", "rajasthan_thar"
    ]

    om_models = [
        CANONICAL_MODELS["ecmwf_ifs"]["open_meteo_model"],
        CANONICAL_MODELS["ecmwf_aifs"]["open_meteo_model"],
        CANONICAL_MODELS["ncep_gfs"]["open_meteo_model"],
        CANONICAL_MODELS["dwd_icon"]["open_meteo_model"],
    ]

    print("\n[1/6] Ingesting & Aligning Multi-Season, Multi-Lead Data...")
    print(f"  Models: {list(CANONICAL_MODELS.keys())}")
    print(f"  Lead Times: {[24, 48, 72, 120]} hours")
    print(f"  Seasons: {list(SEASONS.keys())}")

    aligned_dfs = []

    for season_name, (s_date, e_date) in SEASONS.items():
        print(f"\n  -- Season: {season_name} ({s_date} to {e_date}) --")
        for r_key in sample_region_keys:
            reg = CANONICAL_REGIONS[r_key]
            try:
                raw_prev = provider.fetch_previous_runs_raw(
                    lat=reg.lat, lon=reg.lng,
                    start_date=s_date, end_date=e_date,
                    models=om_models,
                    lead_days=list(LEAD_MAPPING.keys())
                )
                raw_ref = provider.fetch_era5_reference_raw(
                    lat=reg.lat, lon=reg.lng,
                    start_date=s_date, end_date=e_date,
                    variables=["temperature_2m"]
                )
                df_season = align_previous_runs_with_reference(
                    raw_prev_data=raw_prev,
                    raw_reference_data=raw_ref,
                    region_id=r_key,
                    region_meta=reg,
                    season_name=season_name,
                    lead_mapping=LEAD_MAPPING
                )
                if not df_season.empty:
                    aligned_dfs.append(df_season)
                    print(f"     [OK] {reg.name:32s}: {len(df_season):4d} aligned (time x lead) rows")
                else:
                    print(f"     [WARN] {reg.name}: 0 rows returned")
            except Exception as e:
                print(f"     [ERROR] {r_key} in {season_name}: {e}")

    if not aligned_dfs:
        raise RuntimeError("No multi-lead multi-season data could be retrieved.")

    full_df = pd.concat(aligned_dfs, ignore_index=True)
    full_df = full_df.sort_values(["timestamp", "lead_time_hours"]).reset_index(drop=True)
    
    # Save combined multi-season dataset
    dataset_path = DATA_DIR / "aligned_multi_season_lead_data.csv"
    full_df.to_csv(dataset_path, index=False)
    print(f"\n  [OK] Total Aligned Rows: {len(full_df):,d} saved to {dataset_path}")
    print(f"  [OK] Total Paired Member Forecasts Evaluated: {len(full_df)*4:,d} points")

    # [2/6] Chronological 3-Way Train / Validation / Test Split
    print("\n[2/6] Performing Chronological Train / Val / Test Split...")
    n_total = len(full_df)
    train_ratio = 0.65
    val_ratio = 0.15
    test_ratio = 0.20

    train_end = int(n_total * train_ratio)
    val_end = int(n_total * (train_ratio + val_ratio))

    train_df = full_df.iloc[:train_end]
    val_df = full_df.iloc[train_end:val_end]
    test_df = full_df.iloc[val_end:]

    print(f"  TRAIN SET      : {len(train_df):5d} rows ({train_df['timestamp'].min()} to {train_df['timestamp'].max()})")
    print(f"  VALIDATION SET : {len(val_df):5d} rows ({val_df['timestamp'].min()} to {val_df['timestamp'].max()})")
    print(f"  HELD-OUT TEST  : {len(test_df):5d} rows ({test_df['timestamp'].min()} to {test_df['timestamp'].max()})")

    # Compute static Inverse-RMSE baseline weights strictly from TRAIN partition
    train_rmse = {}
    for m in CANONICAL_MODELS.keys():
        err = train_df[f"{m}_val"] - train_df["reference_val"]
        train_rmse[m] = float(np.sqrt(np.mean(err**2)))
    train_inv_weights = compute_inverse_variance_weights(train_rmse)
    print(f"  Train Baseline RMSEs: {train_rmse}")
    print(f"  Train Static Inverse-RMSE Weights: {train_inv_weights}")

    # [3/6] Train XGBoost Contextual Meta-Model
    print("\n[3/6] Training XGBoost Contextual Meta-Model...")
    print(f"  Features ({len(FEATURE_NAMES)}): {FEATURE_NAMES}")
    meta_model = VarunaMetaModel(variable="temperature")
    train_summary = meta_model.train_on_aligned_data(full_df, train_ratio=0.65, val_ratio=0.15)
    meta_model.save_checkpoint()
    print("  [OK] Trained meta-model checkpoint saved to models/xgboost_meta_temperature.joblib")
    for m, stat in train_summary.items():
        print(f"     {m:12s} | Train N: {stat['train_samples']} | Val N: {stat['val_samples']} | Val MAE: {stat['val_mae']} deg C | Val RMSE: {stat['val_rmse']} deg C")

    # [4/6] Compute Predictions Across Entire Dataset (Strictly for Grouped Summaries)
    print("\n[4/6] Evaluating All Ensembles (Equal, Inverse-RMSE, XGBoost VARUNA Blend)...")
    
    eq_weights = {k: 25 for k in CANONICAL_MODELS.keys()}
    eq_blend = []
    inv_blend = []
    xgb_blend = []
    sample_weights_list = []

    for idx, row in full_df.iterrows():
        m_vals = {m: row[f"{m}_val"] for m in CANONICAL_MODELS.keys()}
        
        # 1. Equal Blend
        eq_blend.append(blend_member_forecasts(m_vals, eq_weights))
        
        # 2. Inverse-RMSE Blend (from Train)
        inv_blend.append(blend_member_forecasts(m_vals, train_inv_weights))
        
        # 3. XGBoost Contextual Blend
        pred_res = meta_model.predict_adaptive_weights(
            lat=row["latitude"],
            lon=row["longitude"],
            elev=row["elevation_m"],
            day_of_year=int(row["day_of_year"]),
            hour=int(row["hour_of_day"]),
            month=int(row["month"]),
            regime_idx=int(row["regime_index"]),
            model_values=m_vals,
            lead_time_hours=int(row["lead_time_hours"])
        )
        xgb_blend.append(blend_member_forecasts(m_vals, pred_res["weights"]))
        
        if idx % 150 == 0 and len(sample_weights_list) < 25:
            sample_weights_list.append({
                "region_id": row["region_id"],
                "season": row["season"],
                "valid_time": row["timestamp"],
                "lead_time_hours": row["lead_time_hours"],
                "regime": row["regime"],
                "ifs_weight": pred_res["weights"]["ecmwf_ifs"],
                "aifs_weight": pred_res["weights"]["ecmwf_aifs"],
                "gfs_weight": pred_res["weights"]["ncep_gfs"],
                "icon_weight": pred_res["weights"]["dwd_icon"],
                "sum_check": sum(pred_res["weights"].values())
            })

    full_df["equal_blend_val"] = eq_blend
    full_df["inv_rmse_blend_val"] = inv_blend
    full_df["varuna_blend_val"] = xgb_blend

    # [5/6] Generate Required Scientific Tables
    print("\n[5/6] Generating Output Scientific CSV Reports...")
    all_eval_models = list(CANONICAL_MODELS.keys()) + ["equal_blend", "inv_rmse_blend", "varuna_blend"]

    def evaluate_subgroup(df_sub, group_name, group_val):
        records = []
        ref = df_sub["reference_val"].values
        for m in all_eval_models:
            f = df_sub[f"{m}_val"].values
            err = f - ref
            n = len(f)
            rmse = round(float(np.sqrt(np.mean(err**2))), 4) if n > 0 else 0.0
            mae = round(float(np.mean(np.abs(err))), 4) if n > 0 else 0.0
            bias = round(float(np.mean(err)), 4) if n > 0 else 0.0
            
            # Pearson r
            if n > 1 and np.std(f) > 1e-6 and np.std(ref) > 1e-6:
                r = round(float(np.corrcoef(f, ref)[0, 1]), 4)
            else:
                r = 0.0
                
            records.append({
                group_name: group_val,
                "model": m,
                "rmse": rmse,
                "mae": mae,
                "bias": bias,
                "correlation": r,
                "sample_count": n
            })
        return records

    # 1. reports/skill_by_lead.csv
    lead_records = []
    for lt in sorted(full_df["lead_time_hours"].unique()):
        sub = full_df[full_df["lead_time_hours"] == lt]
        lead_records.extend(evaluate_subgroup(sub, "lead_time_hours", lt))
    df_lead = pd.DataFrame(lead_records)
    df_lead.to_csv(REPORTS_DIR / "skill_by_lead.csv", index=False)
    print("  [OK] Saved reports/skill_by_lead.csv")

    # 2. reports/skill_by_season.csv
    season_records = []
    for s in SEASONS.keys():
        sub = full_df[full_df["season"] == s]
        season_records.extend(evaluate_subgroup(sub, "season", s))
    df_season = pd.DataFrame(season_records)
    df_season.to_csv(REPORTS_DIR / "skill_by_season.csv", index=False)
    print("  [OK] Saved reports/skill_by_season.csv")

    # 3. reports/skill_by_region.csv
    region_records = []
    for r in sample_region_keys:
        sub = full_df[full_df["region_id"] == r]
        region_records.extend(evaluate_subgroup(sub, "region_id", r))
    df_region = pd.DataFrame(region_records)
    df_region.to_csv(REPORTS_DIR / "skill_by_region.csv", index=False)
    print("  [OK] Saved reports/skill_by_region.csv")

    # 4. reports/blend_test_results.csv (HELD-OUT TEST SET ONLY)
    test_sub = full_df.iloc[val_end:].copy()
    test_records = evaluate_subgroup(test_sub, "dataset_split", "held_out_test")
    df_test_out = pd.DataFrame(test_records)
    df_test_out.to_csv(REPORTS_DIR / "blend_test_results.csv", index=False)
    print("  [OK] Saved reports/blend_test_results.csv (Strict Held-Out Test Evaluation)")

    # 5. reports/adaptive_weights.csv
    df_weights_out = pd.DataFrame(sample_weights_list)
    df_weights_out.to_csv(REPORTS_DIR / "adaptive_weights.csv", index=False)
    print("  [OK] Saved reports/adaptive_weights.csv (Sample Weights)")

    # 6. Overall model_skill.csv
    overall_records = evaluate_subgroup(full_df, "dataset", "full_benchmark")
    df_skill_out = pd.DataFrame(overall_records)
    df_skill_out.to_csv(REPORTS_DIR / "model_skill.csv", index=False)
    print("  [OK] Saved reports/model_skill.csv")

    # Print Key Comparison on Held-Out Test Set
    print("\n--- HELD-OUT TEST SET PERFORMANCE (N = %d) ---" % len(test_sub))
    print(df_test_out[["model", "rmse", "mae", "bias", "correlation", "sample_count"]].to_string(index=False))

    # [6/6] Diagnostic Visualizations
    print("\n[6/6] Generating Multi-Lead & Multi-Season Visualizations...")
    
    # 1. Skill curves by Lead Time
    plt.figure(figsize=(9, 5))
    palette = {
        "ecmwf_ifs": "#3B82F6",
        "ecmwf_aifs": "#8B5CF6",
        "ncep_gfs": "#10B981",
        "dwd_icon": "#F59E0B",
        "equal_blend": "#6B7280",
        "inv_rmse_blend": "#F97316",
        "varuna_blend": "#06B6D4"
    }
    
    lead_hours_list = sorted(full_df["lead_time_hours"].unique())
    for m in all_eval_models:
        sub_m = df_lead[df_lead["model"] == m].sort_values("lead_time_hours")
        lw = 2.8 if m == "varuna_blend" else (2.0 if "blend" in m else 1.5)
        ls = "-" if m == "varuna_blend" else ("-." if "blend" in m else "--")
        label = "VARUNA Blend" if m == "varuna_blend" else m
        plt.plot(sub_m["lead_time_hours"], sub_m["rmse"], marker="o", color=palette.get(m, "#999"), linewidth=lw, linestyle=ls, label=label)

    plt.title("Forecast RMSE vs Lead Time (24h, 48h, 72h, 120h) Across Seasons", fontsize=11, fontweight="bold")
    plt.xlabel("Lead Time (Hours)", fontsize=10)
    plt.ylabel("RMSE (deg C)", fontsize=10)
    plt.grid(True, linestyle=":", alpha=0.6)
    plt.legend(frameon=True, fontsize=9)
    plt.tight_layout()
    plt.savefig(REPORTS_DIR / "skill_curves.png", dpi=200)
    plt.close()
    print("  [OK] Saved reports/skill_curves.png")

    # 2. Blend Comparison (72h Segment from Monsoon Delhi NCR)
    plt.figure(figsize=(11, 5))
    sample_plot = full_df[(full_df["region_id"] == "delhi_ncr") & (full_df["lead_time_hours"] == 48) & (full_df["season"] == "Monsoon")].iloc[:72]
    plt.plot(range(len(sample_plot)), sample_plot["reference_val"], label="ERA5 Reference", color="#111827", linewidth=2.5)
    plt.plot(range(len(sample_plot)), sample_plot["ecmwf_ifs_val"], label="ECMWF IFS (48h)", color="#3B82F6", linestyle=":", alpha=0.8)
    plt.plot(range(len(sample_plot)), sample_plot["ecmwf_aifs_val"], label="ECMWF AIFS (48h)", color="#8B5CF6", linestyle=":", alpha=0.8)
    plt.plot(range(len(sample_plot)), sample_plot["ncep_gfs_val"], label="NOAA GFS (48h)", color="#10B981", linestyle=":", alpha=0.8)
    plt.plot(range(len(sample_plot)), sample_plot["dwd_icon_val"], label="DWD ICON (48h)", color="#F59E0B", linestyle=":", alpha=0.8)
    plt.plot(range(len(sample_plot)), sample_plot["varuna_blend_val"], label="VARUNA Adaptive Blend", color="#06B6D4", linewidth=2.2)
    plt.title("Delhi NCR Temperature 48h Lead Forecast vs ERA5 Reference", fontsize=11, fontweight="bold")
    plt.xlabel("Hours", fontsize=10)
    plt.ylabel("Temperature at 2m (deg C)", fontsize=10)
    plt.grid(True, linestyle=":", alpha=0.6)
    plt.legend(frameon=True, loc="upper right")
    plt.tight_layout()
    plt.savefig(REPORTS_DIR / "blend_comparison.png", dpi=200)
    plt.close()
    print("  [OK] Saved reports/blend_comparison.png")

    # 3. Feature Importance
    plt.figure(figsize=(8, 4.5))
    ifs_importances = meta_model.feature_importances.get("ecmwf_ifs", {})
    sorted_feats = sorted(ifs_importances.items(), key=lambda x: x[1])
    feat_names = [x[0] for x in sorted_feats]
    feat_vals = [x[1] for x in sorted_feats]
    plt.barh(feat_names, feat_vals, color="#3B82F6")
    plt.title("XGBoost Meta-Model Feature Importance (Gain)", fontsize=11, fontweight="bold")
    plt.xlabel("Importance Score", fontsize=10)
    plt.grid(axis="x", linestyle=":", alpha=0.6)
    plt.tight_layout()
    plt.savefig(REPORTS_DIR / "feature_importance.png", dpi=200)
    plt.close()
    print("  [OK] Saved reports/feature_importance.png")

    # Update provenance.json
    provenance = {
        "system_name": "VARUNA Adaptive Hybrid AI-NWP Forecaster",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "evaluation_scope": {
            "seasons": list(SEASONS.keys()),
            "date_ranges": SEASONS,
            "lead_times_hours": [24, 48, 72, 120],
            "regions": sample_region_keys
        },
        "dataset_counts": {
            "total_aligned_rows": len(full_df),
            "train_rows": len(train_df),
            "validation_rows": len(val_df),
            "test_rows": len(test_df),
            "model_evaluations_total": len(full_df) * 4
        },
        "models_evaluated": {
            "ecmwf_ifs": {"identifier": "ecmwf_ifs025", "type": "Physical NWP (9km)"},
            "ecmwf_aifs": {"identifier": "ecmwf_aifs025_single", "type": "Deep Learning Transformer (0.25 deg)"},
            "ncep_gfs": {"identifier": "gfs_seamless", "type": "Physical NWP (13km)"},
            "dwd_icon": {"identifier": "icon_seamless", "type": "Icosahedral Non-Hydrostatic (13km)"}
        },
        "reference_dataset": "ERA5 Reanalysis Reference Dataset (ECMWF/Copernicus)",
        "in_situ_observations": "IMD AWS — Integration Pending (No verified station observations connected)",
        "meta_model": {
            "algorithm": "XGBoost Contextual Regressor",
            "features": FEATURE_NAMES,
            "split_methodology": "Strict Chronological 3-Way Split (65% Train, 15% Val, 20% Test)",
            "normalization": "Hamilton-Hare Largest Remainder Method (Sum = 100%)"
        }
    }

    with open(DATA_DIR / "provenance.json", "w") as f:
        json.dump(provenance, f, indent=2)
    print("  [OK] Exported provenance manifest to data/provenance.json")

    print("\n" + "=" * 80)
    print("EXPANDED PIPELINE COMPLETED SUCCESSFULLY.")
    print("=" * 80)

if __name__ == "__main__":
    run_expanded_pipeline()
