"""XGBoost meta-model: one XGBRegressor per forecast model.

For every model m the regressor predicts EXPECTED ABSOLUTE ERROR
    target_m = | forecast_m - ERA5 |
from the fixed 11-feature schema (Section 1.4). It predicts error, not
weather. ERA5 is used only as the training target and never as a
forecast-time feature.
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from xgboost import XGBRegressor

from ..config import (
    FEATURE_NAMES,
    META_MODEL_PATH,
    MODEL_KEYS,
    WEIGHT_EPSILON,
    XGB_PARAMS,
)

TRAIN_VERSION = "1.0"


def build_feature_frame(df: pd.DataFrame, model_key: str | None = None) -> pd.DataFrame:
    """Return the 11-column feature matrix in canonical order.

    10 of the features are shared across models. ``model_own_forecast`` is
    MODEL-DEPENDENT: for model m it is m's own forecast value. When the frame
    already carries ``model_own_forecast`` (single-row inference, where the
    caller sets it per model) it is used as-is; otherwise it is taken from the
    ``<model_key>_val`` column of the aligned table.
    """
    frame = df
    if "model_own_forecast" not in frame.columns:
        if model_key is None:
            raise ValueError(
                "model_own_forecast missing and no model_key given to derive it"
            )
        own_col = f"{model_key}_val"
        if own_col not in frame.columns:
            raise ValueError(f"feature frame missing own-forecast column: {own_col}")
        frame = frame.copy()
        frame["model_own_forecast"] = frame[own_col]
    missing = [c for c in FEATURE_NAMES if c not in frame.columns]
    if missing:
        raise ValueError(f"feature frame missing columns: {missing}")
    return frame[FEATURE_NAMES].astype(float)


def train_meta_model(
    df: pd.DataFrame,
    variable: str = "temperature",
    validation_df: pd.DataFrame | None = None,
) -> dict[str, Any]:
    """Train one XGBRegressor per model on the TRAIN partition.

    Returns the bundle: {models, feature_names, variable, metadata}.
    """
    bundle: dict[str, Any] = {
        "feature_names": list(FEATURE_NAMES),
        "variable": variable,
        "models": {},
        "metadata": {
            "train_version": TRAIN_VERSION,
            "xgb_params": {k: v for k, v in XGB_PARAMS.items() if k != "n_jobs"},
            "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "n_train_rows": int(len(df)),
            "per_model": {},
        },
    }
    for key in MODEL_KEYS:
        target_col = f"{key}_abs_err"
        if target_col not in df.columns:
            raise ValueError(f"missing target column {target_col}")
        X = build_feature_frame(df, model_key=key)
        y = df[target_col].astype(float)
        model = XGBRegressor(**XGB_PARAMS)
        model.fit(X, y)
        bundle["models"][key] = model

        info: dict[str, Any] = {
            "n_train": int(len(df)),
            "target_mean_abs_err": float(y.mean()),
        }
        if validation_df is not None and len(validation_df) > 0:
            Xv = build_feature_frame(validation_df, model_key=key)
            yv = validation_df[target_col].astype(float).to_numpy()
            pred = model.predict(Xv)
            resid = pred - yv
            info["val_mae_of_error_prediction"] = float(np.mean(np.abs(resid)))
            info["val_rmse_of_error_prediction"] = float(np.sqrt(np.mean(resid**2)))
        bundle["metadata"]["per_model"][key] = info
    return bundle


def predict_errors(bundle: dict[str, Any], X: pd.DataFrame) -> dict[str, pd.Series]:
    """Predicted expected error per model for each row of X.

    ``model_own_forecast`` is set per model (each regressor saw its own
    forecast as its 11th feature during training).
    """
    out: dict[str, pd.Series] = {}
    for key, model in bundle["models"].items():
        frame = build_feature_frame(X, model_key=key)
        pred = np.asarray(model.predict(frame), dtype=float)
        out[key] = pd.Series(np.maximum(pred, WEIGHT_EPSILON), index=X.index)
    return out


def predict_errors_single_row(
    bundle: dict[str, Any], features: dict[str, float]
) -> dict[str, float]:
    row = pd.DataFrame([{c: float(features[c]) for c in FEATURE_NAMES}])
    preds = predict_errors(bundle, row)
    return {k: float(v.iloc[0]) for k, v in preds.items()}


def predict_errors_rows(
    bundle: dict[str, Any],
    shared_rows: list[dict[str, float]],
    own: dict[str, list[float]],
) -> list[dict[str, float]]:
    """Batch prediction for many rows at once (one predict() call per model).

    ``shared_rows`` holds the 10 shared features per row (no
    ``model_own_forecast``); ``own[key]`` holds model ``key``'s own forecast
    for each row. Returns one {model: predicted_error} dict per row.
    """
    n = len(shared_rows)
    if n == 0:
        return []
    base = pd.DataFrame(shared_rows)
    shared_cols = [c for c in FEATURE_NAMES if c != "model_own_forecast"]
    missing = [c for c in shared_cols if c not in base.columns]
    if missing:
        raise ValueError(f"feature frame missing columns: {missing}")
    preds_by_model: dict[str, np.ndarray] = {}
    for key, model in bundle["models"].items():
        if key not in own or len(own[key]) != n:
            raise ValueError(f"own-forecast values missing/short for model {key}")
        frame = base[shared_cols].astype(float).copy()
        frame["model_own_forecast"] = np.asarray(own[key], dtype=float)
        frame = frame[FEATURE_NAMES]
        preds_by_model[key] = np.maximum(
            np.asarray(model.predict(frame), dtype=float), WEIGHT_EPSILON
        )
    out: list[dict[str, float]] = []
    for i in range(n):
        out.append({k: float(v[i]) for k, v in preds_by_model.items()})
    return out


def save_bundle(bundle: dict[str, Any], path: Path = META_MODEL_PATH) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, path)
    return path


def load_bundle(path: Path = META_MODEL_PATH) -> dict[str, Any] | None:
    if not Path(path).exists():
        return None
    return joblib.load(path)


def feature_importances(bundle: dict[str, Any]) -> list[dict]:
    """Mean gain-based importance across the 4 regressors (real
    XGBRegressor.feature_importances_, averaged over models)."""
    rows: dict[str, float] = {name: 0.0 for name in bundle["feature_names"]}
    n = 0
    for model in bundle["models"].values():
        imps = getattr(model, "feature_importances_", None)
        if imps is None:
            continue
        for name, imp in zip(bundle["feature_names"], imps):
            rows[name] += float(imp)
        n += 1
    if n == 0:
        return []
    means = {name: value / n for name, value in rows.items()}
    total = sum(means.values()) or 1.0
    out = [
        {"feature": name, "importance": value, "share": value / total}
        for name, value in means.items()
    ]
    out.sort(key=lambda d: d["importance"], reverse=True)
    return out
