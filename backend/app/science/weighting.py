"""
Adaptive Weighting Engine for VARUNA.
Implements inverse-variance weighting and Hamilton-Hare Largest Remainder Normalization.
Ensures exact integer percentages summing to 100% with hierarchical backoff.
"""
import math
from typing import Dict, List, Any, Tuple

def largest_remainder_normalize(raw_weights: Dict[str, float], target_sum: int = 100) -> Dict[str, int]:
    """
    Hamilton-Hare Largest Remainder Method.
    Allocates integer weights such that sum(weights) == target_sum (default 100%).
    Eliminates rounding drift (e.g. 99% or 101%) while preserving proportionality.
    """
    # Guard against non-positive or all-zero weights
    cleaned = {k: max(0.0, float(v)) for k, v in raw_weights.items()}
    total = sum(cleaned.values())
    
    keys = list(cleaned.keys())
    n = len(keys)
    if total <= 1e-12 or n == 0:
        # Fallback to equal allocation
        base = target_sum // n
        remainder = target_sum % n
        return {k: base + (1 if i < remainder else 0) for i, k in enumerate(keys)}

    # Proportional quotas
    quotas = {k: (cleaned[k] / total) * target_sum for k in keys}
    integers = {k: math.floor(quotas[k]) for k in keys}
    fractions = {k: quotas[k] - integers[k] for k in keys}

    allocated = sum(integers.values())
    remaining = target_sum - allocated

    # Sort keys by largest fractional remainder descending
    sorted_by_fraction = sorted(keys, key=lambda k: fractions[k], reverse=True)

    for i in range(remaining):
        integers[sorted_by_fraction[i % n]] += 1

    return integers

def compute_inverse_variance_weights(rmse_dict: Dict[str, float]) -> Dict[str, int]:
    """
    Compute baseline weights inversely proportional to squared RMSE:
    w_m proportional to 1 / (RMSE_m^2 + epsilon)
    """
    raw = {}
    for model, rmse in rmse_dict.items():
        if rmse > 0:
            raw[model] = 1.0 / (rmse ** 2 + 1e-6)
        else:
            raw[model] = 1.0
            
    return largest_remainder_normalize(raw, target_sum=100)

def compute_contextual_weights_from_errors(predicted_errors: Dict[str, float]) -> Dict[str, int]:
    """
    Compute adaptive weights from XGBoost predicted absolute errors:
    w_m proportional to 1 / (E_hat_m^2 + epsilon)
    """
    raw = {}
    for model, err in predicted_errors.items():
        val = max(1e-4, float(err))
        raw[model] = 1.0 / (val ** 2)
        
    return largest_remainder_normalize(raw, target_sum=100)

def blend_member_forecasts(
    member_values: Dict[str, float],
    weights: Dict[str, int]
) -> float:
    """
    Compute blended forecast value: sum(w_m * y_m) / 100.0.
    """
    blended = 0.0
    for model, val in member_values.items():
        w = weights.get(model, 0)
        blended += (w / 100.0) * val
    return round(blended, 2)
