"""
Authoritative Statistical Verification Engine for Weather Forecasts.
Implements RMSE, MAE, Bias, and Pearson r against ERA5 reference data or observations.
No synthetic shortcuts or simulated improvements permitted.
"""
import math
from typing import List, Dict, Any, Union, Optional
import numpy as np

def calculate_rmse(forecast: Union[List[float], np.ndarray], reference: Union[List[float], np.ndarray]) -> float:
    """
    Calculate Root Mean Squared Error:
    RMSE = sqrt( (1 / N) * sum( (f_i - r_i)^2 ) )
    """
    f = np.asarray(forecast, dtype=float)
    r = np.asarray(reference, dtype=float)
    if len(f) == 0 or len(r) == 0 or len(f) != len(r):
        return 0.0
    return float(np.sqrt(np.mean((f - r) ** 2)))

def calculate_mae(forecast: Union[List[float], np.ndarray], reference: Union[List[float], np.ndarray]) -> float:
    """
    Calculate Mean Absolute Error:
    MAE = (1 / N) * sum( |f_i - r_i| )
    """
    f = np.asarray(forecast, dtype=float)
    r = np.asarray(reference, dtype=float)
    if len(f) == 0 or len(r) == 0 or len(f) != len(r):
        return 0.0
    return float(np.mean(np.abs(f - r)))

def calculate_bias(forecast: Union[List[float], np.ndarray], reference: Union[List[float], np.ndarray]) -> float:
    """
    Calculate Mean Forecast Bias (Mean Error):
    Bias = (1 / N) * sum( f_i - r_i )
    Positive = overforecasting; Negative = underforecasting.
    """
    f = np.asarray(forecast, dtype=float)
    r = np.asarray(reference, dtype=float)
    if len(f) == 0 or len(r) == 0 or len(f) != len(r):
        return 0.0
    return float(np.mean(f - r))

def calculate_pearson_r(forecast: Union[List[float], np.ndarray], reference: Union[List[float], np.ndarray]) -> float:
    """
    Calculate Pearson correlation coefficient r between forecast and reference:
    r = sum((f - f_mean) * (r - r_mean)) / sqrt( sum((f - f_mean)^2) * sum((r - r_mean)^2) )
    """
    f = np.asarray(forecast, dtype=float)
    r = np.asarray(reference, dtype=float)
    if len(f) < 2 or len(f) != len(r):
        return 0.0
    
    f_diff = f - np.mean(f)
    r_diff = r - np.mean(r)
    
    numerator = np.sum(f_diff * r_diff)
    denominator = np.sqrt(np.sum(f_diff ** 2) * np.sum(r_diff ** 2))
    
    if denominator < 1e-12:
        return 0.0
    
    val = float(numerator / denominator)
    return max(-1.0, min(1.0, val))

def compute_verification_metrics(
    forecast: Union[List[float], np.ndarray],
    reference: Union[List[float], np.ndarray],
    model_name: str,
    variable: str,
    region: str,
    lead_time: str,
    reference_source: str = "ERA5 Reanalysis Reference Dataset"
) -> Dict[str, Any]:
    """
    Compute full verified metric bundle for a specific model evaluation.
    Every metric bundle includes real sample count N and verification metadata.
    """
    f = np.asarray(forecast, dtype=float)
    r = np.asarray(reference, dtype=float)
    
    # Filter out any NaN or Inf pairs
    valid_mask = np.isfinite(f) & np.isfinite(r)
    f_clean = f[valid_mask]
    r_clean = r[valid_mask]
    
    n_samples = int(len(f_clean))
    if n_samples == 0:
        return {
            "model": model_name,
            "variable": variable,
            "region": region,
            "lead_time": lead_time,
            "sample_count": 0,
            "rmse": 0.0,
            "mae": 0.0,
            "bias": 0.0,
            "correlation": 0.0,
            "reference_source": reference_source
        }
        
    rmse = round(calculate_rmse(f_clean, r_clean), 3)
    mae = round(calculate_mae(f_clean, r_clean), 3)
    bias = round(calculate_bias(f_clean, r_clean), 3)
    r_val = round(calculate_pearson_r(f_clean, r_clean), 3)
    
    return {
        "model": model_name,
        "variable": variable,
        "region": region,
        "lead_time": lead_time,
        "sample_count": n_samples,
        "rmse": rmse,
        "mae": mae,
        "bias": bias,
        "correlation": r_val,
        "reference_source": reference_source
    }
