"""
XGBoost Contextual Meta-Model for Model Error Estimation.
Predicts expected absolute error for each NWP/AI model based on meteorological context.
Enforces strict chronological train/test splitting with zero temporal leakage.
"""
import os
import json
import joblib
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional
import numpy as np
import pandas as pd
import xgboost as xgb
from ..config import MODELS_DIR, CANONICAL_MODELS
from .weighting import compute_contextual_weights_from_errors, largest_remainder_normalize

FEATURE_NAMES = [
    "latitude",
    "longitude",
    "elevation_m",
    "lead_time_hours",
    "day_of_year",
    "hour_of_day",
    "month",
    "regime_index",
    "ensemble_mean",
    "ensemble_spread",
    "model_val"
]

class VarunaMetaModel:
    """XGBoost Meta-Model Manager holding trained regressors for each weather model."""

    def __init__(self, variable: str = "temperature"):
        self.variable = variable
        self.models: Dict[str, xgb.XGBRegressor] = {}
        self.feature_importances: Dict[str, Dict[str, float]] = {}
        self.is_trained = False

    def build_feature_vector(
        self,
        lat: float,
        lon: float,
        elev: float,
        lead_time_hours: int,
        day_of_year: int,
        hour: int,
        month: int,
        regime_idx: int,
        ens_mean: float,
        ens_spread: float,
        model_val: float
    ) -> np.ndarray:
        """Construct normalized feature row."""
        return np.array([[
            lat, lon, elev, float(lead_time_hours), float(day_of_year),
            float(hour), float(month), float(regime_idx),
            float(ens_mean), float(ens_spread), float(model_val)
        ]], dtype=float)

    def train_on_aligned_data(
        self,
        df: pd.DataFrame,
        train_ratio: float = 0.65,
        val_ratio: float = 0.15
    ) -> Dict[str, Any]:
        """
        Train XGBoost meta-model on aligned historical dataset using strict chronological split:
        TRAIN (earliest 65%), VALIDATION (middle 15%), HELD-OUT TEST (latest 20%).
        Zero temporal leakage: earlier dates train, validation evaluates, test untouched.
        """
        if df.empty or len(df) < 50:
            raise ValueError(f"Insufficient data rows for training ({len(df)} rows)")

        # Ensure lead_time_hours column exists
        if "lead_time_hours" not in df.columns:
            df = df.copy()
            df["lead_time_hours"] = 48

        # 1. Obtain sorted unique valid timestamps
        unique_times = sorted(df["timestamp"].unique())
        n_times = len(unique_times)
        train_t_end = int(n_times * train_ratio)
        val_t_end = int(n_times * (train_ratio + val_ratio))
        
        train_times = set(unique_times[:train_t_end])
        val_times = set(unique_times[train_t_end:val_t_end])
        test_times = set(unique_times[val_t_end:])
        
        # 2. Assign ALL rows belonging to each timestamp to the same partition (zero timestamp overlap)
        train_df = df[df["timestamp"].isin(train_times)].sort_values(["timestamp", "lead_time_hours"]).reset_index(drop=True)
        val_df = df[df["timestamp"].isin(val_times)].sort_values(["timestamp", "lead_time_hours"]).reset_index(drop=True)
        test_df = df[df["timestamp"].isin(test_times)].sort_values(["timestamp", "lead_time_hours"]).reset_index(drop=True)

        eval_summary = {}
        feature_cols = [
            "latitude", "longitude", "elevation_m", "lead_time_hours",
            "day_of_year", "hour_of_day", "month", "regime_index",
            "ensemble_mean", "ensemble_spread"
        ]

        for model_key in CANONICAL_MODELS.keys():
            val_col = f"{model_key}_val"
            err_col = f"{model_key}_abs_err"

            if val_col not in train_df.columns or err_col not in train_df.columns:
                continue

            # Assemble features
            X_train = train_df[feature_cols + [val_col]].values
            y_train = train_df[err_col].values

            X_val = val_df[feature_cols + [val_col]].values
            y_val = val_df[err_col].values

            # Fit regressor
            regressor = xgb.XGBRegressor(
                n_estimators=80,
                max_depth=4,
                learning_rate=0.06,
                subsample=0.85,
                colsample_bytree=0.85,
                random_state=42,
                verbosity=0
            )
            regressor.fit(X_train, y_train)

            # Evaluate on validation set
            y_pred_val = regressor.predict(X_val)
            val_mae = float(np.mean(np.abs(y_pred_val - y_val)))
            val_rmse = float(np.sqrt(np.mean((y_pred_val - y_val) ** 2)))

            self.models[model_key] = regressor

            # Feature importances
            importances = regressor.feature_importances_
            self.feature_importances[model_key] = {
                FEATURE_NAMES[i]: round(float(importances[i]), 4)
                for i in range(len(FEATURE_NAMES))
            }

            eval_summary[model_key] = {
                "train_samples": len(X_train),
                "val_samples": len(X_val),
                "test_samples": len(test_df),
                "val_mae": round(val_mae, 3),
                "val_rmse": round(val_rmse, 3),
            }

        self.is_trained = True
        return eval_summary

    def predict_adaptive_weights(
        self,
        lat: float,
        lon: float,
        elev: float,
        day_of_year: int,
        hour: int,
        month: int,
        regime_idx: int,
        model_values: Dict[str, float],
        lead_time_hours: int = 48
    ) -> Dict[str, Any]:
        """
        Predict contextual errors and derive Largest Remainder normalized weights.
        """
        if not self.is_trained or not self.models:
            # Fallback to equal weighting
            equal_weights = {k: 25 for k in CANONICAL_MODELS.keys()}
            return {
                "weights": equal_weights,
                "predicted_errors": {k: 1.0 for k in CANONICAL_MODELS.keys()},
                "backoff_level": "EQUAL_WEIGHT_BACKOFF",
                "reason": "Meta-model uninitialized or offline"
            }

        vals_arr = np.array(list(model_values.values()))
        ens_mean = float(np.mean(vals_arr))
        ens_spread = float(np.std(vals_arr))

        predicted_errors = {}
        for model_key in CANONICAL_MODELS.keys():
            val = model_values.get(model_key, ens_mean)
            X = self.build_feature_vector(
                lat=lat, lon=lon, elev=elev, lead_time_hours=lead_time_hours,
                day_of_year=day_of_year, hour=hour, month=month,
                regime_idx=regime_idx, ens_mean=ens_mean,
                ens_spread=ens_spread, model_val=val
            )
            regressor = self.models.get(model_key)
            if regressor:
                pred_err = float(regressor.predict(X)[0])
                predicted_errors[model_key] = max(0.05, pred_err)
            else:
                predicted_errors[model_key] = 1.0

        weights = compute_contextual_weights_from_errors(predicted_errors)
        return {
            "weights": weights,
            "predicted_errors": {k: round(v, 3) for k, v in predicted_errors.items()},
            "backoff_level": "XGBOOST_CONTEXTUAL",
            "reason": "Contextual error minimization"
        }

    def save_checkpoint(self, path: Optional[Path] = None):
        """Save models to disk."""
        target = path or (MODELS_DIR / f"xgboost_meta_{self.variable}.joblib")
        payload = {
            "variable": self.variable,
            "models": self.models,
            "feature_importances": self.feature_importances,
            "is_trained": self.is_trained
        }
        joblib.dump(payload, target)

    def load_checkpoint(self, path: Optional[Path] = None) -> bool:
        """Load models from disk if existing."""
        target = path or (MODELS_DIR / f"xgboost_meta_{self.variable}.joblib")
        if not target.exists():
            return False
        try:
            payload = joblib.load(target)
            self.variable = payload.get("variable", self.variable)
            self.models = payload.get("models", {})
            self.feature_importances = payload.get("feature_importances", {})
            self.is_trained = payload.get("is_trained", False)
            return True
        except Exception:
            return False
