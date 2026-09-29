"""Hamilton-Hare apportionment + blend invariants (Phase 3)."""
import pytest

from app.science.weighting import (
    blend_value,
    ensemble_stats,
    hamilton_hare,
    static_inverse_rmse_weights,
    weights_from_predicted_errors,
)


def test_hamilton_hare_sums_to_100_ints_nonneg():
    cases = [
        {"a": 1.0, "b": 2.0, "c": 3.0, "d": 4.0},
        {"a": 0.001, "b": 0.001, "c": 0.001, "d": 99999.0},
        {"only": 7.0},
        {"a": 3.333, "b": 3.333, "c": 3.334},
        {f"m{i}": 1.0 for i in range(4)},
    ]
    for raw in cases:
        w = hamilton_hare(raw)
        assert sum(w.values()) == 100
        assert all(isinstance(v, int) for v in w.values())
        assert all(v >= 0 for v in w.values())


def test_hamilton_hare_ties_are_deterministic():
    raw = {"b": 1.0, "a": 1.0, "c": 1.0}
    first = hamilton_hare(raw)
    for _ in range(20):
        assert hamilton_hare(raw) == first
    assert sum(first.values()) == 100


def test_hamilton_hare_extreme_skew_no_negatives():
    w = hamilton_hare({"tiny": 1e-9, "huge": 1e9})
    assert sum(w.values()) == 100
    assert w["tiny"] >= 0 and w["huge"] >= 0


def test_weights_from_predicted_errors_inverse_square():
    w = weights_from_predicted_errors({"m1": 1.0, "m2": 2.0})
    assert sum(w.values()) == 100
    # 1/1^2 : 1/2^2 = 4:1 -> m1 should get ~80, m2 ~20
    assert w["m1"] > w["m2"]


def test_weights_floor_epsilon():
    w = weights_from_predicted_errors({"m1": 0.0, "m2": 1e-12})
    assert sum(w.values()) == 100  # no divide-by-zero, no negatives


def test_static_inverse_rmse_weights():
    w = static_inverse_rmse_weights({"a": 1.0, "b": 1.0, "c": 2.0, "d": 2.0})
    assert sum(w.values()) == 100
    assert w["a"] == w["b"]


def test_blend_value_skips_none_without_zero_fill():
    vals = {"a": 10.0, "b": None, "c": 20.0}
    w = hamilton_hare({"a": 1.0, "c": 1.0})
    blend = blend_value(vals, w)
    # 100% a+ c -> 50/50 of 10 and 20 (b contributed nothing, not 0.0)
    assert blend == pytest.approx(15.0)


def test_blend_value_all_none_is_none():
    assert blend_value({"a": None, "b": None}, {"a": 50, "b": 50}) is None


def test_ensemble_stats_available_members_only():
    mean, spread = ensemble_stats({"a": 2.0, "b": None, "c": 4.0})
    assert mean == pytest.approx(3.0)
    assert spread is not None
    m2, s2 = ensemble_stats({"a": None, "b": None})
    assert m2 is None and s2 is None
