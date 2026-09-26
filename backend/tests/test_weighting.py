"""
Unit tests for VARUNA Adaptive Weighting and Hamilton-Hare Normalization.
"""
import pytest
from backend.app.science.weighting import (
    largest_remainder_normalize,
    compute_inverse_variance_weights,
    compute_contextual_weights_from_errors,
    blend_member_forecasts
)

def test_largest_remainder_exact_sum():
    # Fractional quotas that would round improperly with naive round()
    raw = {"a": 33.333, "b": 33.333, "c": 33.334}
    res = largest_remainder_normalize(raw, target_sum=100)
    assert sum(res.values()) == 100
    assert all(v >= 0 for v in res.values())

def test_largest_remainder_skewed_distribution():
    raw = {"ifs": 90.0, "aifs": 5.0, "gfs": 3.0, "icon": 2.0}
    res = largest_remainder_normalize(raw, target_sum=100)
    assert sum(res.values()) == 100
    assert res["ifs"] >= 89

def test_inverse_variance_monotonicity():
    # Lower RMSE must yield strictly higher weight
    rmse = {"ifs": 0.5, "aifs": 1.0, "gfs": 2.0, "icon": 1.5}
    weights = compute_inverse_variance_weights(rmse)
    assert sum(weights.values()) == 100
    assert weights["ifs"] > weights["aifs"] > weights["icon"] > weights["gfs"]

def test_blend_forecast():
    members = {"ifs": 20.0, "aifs": 20.0, "gfs": 20.0, "icon": 20.0}
    weights = {"ifs": 40, "aifs": 30, "gfs": 20, "icon": 10}
    blended = blend_member_forecasts(members, weights)
    assert blended == 20.0
