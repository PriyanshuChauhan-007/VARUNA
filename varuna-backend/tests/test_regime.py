"""Regime classifier: deterministic, total, and matching the documented rules."""
from app.config import REGIME_CLASSES
from app.science.regime import classify_regime


def test_class_order_fixed():
    assert REGIME_CLASSES == [
        "Monsoonal Active Surge",
        "Monsoonal Break",
        "Western Disturbance",
        "Pre-Monsoon Convective",
        "Subtropical Heatwave",
        "Post-Monsoon Depression",
    ]


def test_western_disturbance_northern_india_winter():
    idx, name = classify_regime(1, 28.61, 77.21, temperature_c=8.0,
                                pressure_hpa=1016, wind_kmh=12, precip_mm=0.5)
    assert idx == 2 and name == REGIME_CLASSES[2]


def test_monsoon_active_vs_break():
    active, _ = classify_regime(7, 19.08, 72.88, 28.0, 1002, 30, 4.0)
    break_, _ = classify_regime(7, 19.08, 72.88, 33.0, 1006, 12, 0.0)
    assert active == 0
    assert break_ == 1


def test_heatwave_rule():
    idx, _ = classify_regime(5, 26.92, 70.92, 45.5, 1004, 15, 0.0)
    assert idx == 4


def test_post_monsoon_depression():
    idx, _ = classify_regime(10, 20.31, 86.60, 27.0, 1000, 35, 8.0)
    assert idx == 5


def test_pre_monsoon_convective():
    idx, _ = classify_regime(4, 23.26, 77.41, 36.0, 1008, 22, 1.0)
    assert idx == 3


def test_deterministic_and_total():
    for month in range(1, 13):
        for lat in (9.0, 17.0, 23.0, 30.0):
            for temp in (5.0, 25.0, 42.0):
                for prec in (0.0, 3.0):
                    a = classify_regime(month, lat, 77.0, temp, 1010, 10, prec)
                    b = classify_regime(month, lat, 77.0, temp, 1010, 10, prec)
                    assert a == b
                    assert a[0] in range(6)
                    assert a[1] == REGIME_CLASSES[a[0]]


def test_missing_weather_inputs_still_classify():
    idx, name = classify_regime(7, 28.6, 77.2, None, None, None, None)
    assert idx in range(6)
