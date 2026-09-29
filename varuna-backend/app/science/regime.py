"""Rule-based synoptic regime classifier (Section 1.7).

Six classes in fixed index order (never learned, never clustered):

  0 Monsoonal Active Surge
  1 Monsoonal Break
  2 Western Disturbance
  3 Pre-Monsoon Convective
  4 Subtropical Heatwave
  5 Post-Monsoon Depression

Rules are deterministic functions of month + coordinates + temperature /
pressure / wind / precipitation thresholds. Exact rules are documented in
docs/REGIME_RULES.md.

Inputs are ALWAYS ensemble (multi-model forecast) values - never ERA5 - so
that the same rule set applies identically at training time and at inference
time (no reference-data leakage into features).
"""
from __future__ import annotations

from ..config import REGIME_CLASSES

REGIME_NAME_TO_INDEX = {name: i for i, name in enumerate(REGIME_CLASSES)}

WINTER_MONTHS = (12, 1, 2, 3)
MONSOON_MONTHS = (6, 7, 8, 9)
POST_MONSOON_MONTHS = (10, 11)
PRE_MONSOON_MONTHS = (3, 4, 5)


def classify_regime(
    month: int,
    lat: float,
    lon: float,
    temperature_c: float | None,
    pressure_hpa: float | None,
    wind_kmh: float | None,
    precip_mm: float | None,
) -> tuple[int, str]:
    """Return (regime_index, regime_name). Deterministic and total."""
    # Missing weather inputs fall back to neutral values so the rule cascade
    # still terminates; month + coordinates always drive the seasonal rules.
    temp = temperature_c if temperature_c is not None else 25.0
    press = pressure_hpa if pressure_hpa is not None else 1010.0
    wind = wind_kmh if wind_kmh is not None else 10.0
    prec = precip_mm if precip_mm is not None else 0.0

    # 2 - Western Disturbance: northern India (lat >= 23) in the cold season,
    # accompanied by cold air (temp <= 20 C) or precipitation.
    if month in WINTER_MONTHS and lat >= 23.0 and (temp <= 20.0 or prec >= 0.1):
        return 2, REGIME_CLASSES[2]

    # 5 - Post-Monsoon Depression: Sep-Nov, peninsular/bay belt (lat <= 26),
    # low surface pressure with rain or strong wind.
    if (
        month in POST_MONSOON_MONTHS + (9,)
        and lat <= 26.0
        and press <= 1005.0
        and (prec >= 1.0 or wind >= 25.0)
    ):
        return 5, REGIME_CLASSES[5]

    # 0 - Monsoonal Active Surge: monsoon months with heavy rainfall.
    if month in MONSOON_MONTHS and prec >= 2.0:
        return 0, REGIME_CLASSES[0]

    # 1 - Monsoonal Break: monsoon months without heavy rainfall.
    if month in MONSOON_MONTHS:
        return 1, REGIME_CLASSES[1]

    # 4 - Subtropical Heatwave: very hot and dry (any season, hot season
    # dominates because it is checked before the seasonal fallbacks).
    if temp >= 40.0 and prec <= 0.2:
        return 4, REGIME_CLASSES[4]

    # 3 - Pre-Monsoon Convective: warm season convection (Mar-May, and the
    # shoulder months when unsettled but not monsoon-heavy).
    if month in PRE_MONSOON_MONTHS and (prec >= 0.5 or temp >= 30.0 or wind >= 20.0):
        return 3, REGIME_CLASSES[3]

    # --- Deterministic fallbacks (documented in REGIME_RULES.md) -----------
    if temp >= 35.0 and prec <= 0.5:
        return 4, REGIME_CLASSES[4]
    if month in POST_MONSOON_MONTHS:
        return 5, REGIME_CLASSES[5]
    if month in WINTER_MONTHS:
        # Cold-season locations that failed the WD geographic/threshold test
        # (e.g. southern peninsula) -> dry convective season.
        return 3, REGIME_CLASSES[3]
    if prec >= 0.5:
        return 3, REGIME_CLASSES[3]
    return 1, REGIME_CLASSES[1]
