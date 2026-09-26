"""
Unit tests for VARUNA Statistical Verification Engine.
"""
import pytest
import numpy as np
from backend.app.science.verification import (
    calculate_rmse,
    calculate_mae,
    calculate_bias,
    calculate_pearson_r,
    compute_verification_metrics
)

def test_rmse_basic():
    forecast = [20.0, 22.0, 24.0]
    reference = [20.0, 20.0, 20.0]
    # errors: 0, 2, 4 -> squared: 0, 4, 16 -> mean: 20/3 -> sqrt: 2.581988897
    expected = np.sqrt(20.0 / 3.0)
    assert abs(calculate_rmse(forecast, reference) - expected) < 1e-4

def test_mae_basic():
    forecast = [20.0, 22.0, 18.0]
    reference = [20.0, 20.0, 20.0]
    # abs errors: 0, 2, 2 -> mean: 4/3
    expected = 4.0 / 3.0
    assert abs(calculate_mae(forecast, reference) - expected) < 1e-4

def test_bias_positive_and_negative():
    forecast = [25.0, 30.0]
    reference = [20.0, 20.0]
    # bias = ((25-20) + (30-20))/2 = 7.5
    assert calculate_bias(forecast, reference) == 7.5

    forecast_neg = [15.0, 10.0]
    # bias = ((15-20) + (10-20))/2 = -7.5
    assert calculate_bias(forecast_neg, reference) == -7.5

def test_pearson_r_perfect_correlation():
    forecast = [1.0, 2.0, 3.0, 4.0, 5.0]
    reference = [10.0, 20.0, 30.0, 40.0, 50.0]
    assert abs(calculate_pearson_r(forecast, reference) - 1.0) < 1e-5

def test_pearson_r_anticorrelation():
    forecast = [5.0, 4.0, 3.0, 2.0, 1.0]
    reference = [10.0, 20.0, 30.0, 40.0, 50.0]
    assert abs(calculate_pearson_r(forecast, reference) - (-1.0)) < 1e-5

def test_boundary_zero_length():
    assert calculate_rmse([], []) == 0.0
    assert calculate_mae([], []) == 0.0
    assert calculate_bias([], []) == 0.0
    assert calculate_pearson_r([], []) == 0.0

def test_compute_verification_bundle():
    bundle = compute_verification_metrics(
        forecast=[20.0, 21.0, 22.0],
        reference=[20.0, 20.0, 20.0],
        model_name="ecmwf_ifs",
        variable="temperature",
        region="delhi_ncr",
        lead_time="48h"
    )
    assert bundle["model"] == "ecmwf_ifs"
    assert bundle["sample_count"] == 3
    assert bundle["rmse"] > 0
    assert bundle["reference_source"] == "ERA5 Reanalysis Reference Dataset"
