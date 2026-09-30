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
    temp = temperature_c if temperature_c is not None else 25.0
    press = pressure_hpa if pressure_hpa is not None else 1010.0
    wind = wind_kmh if wind_kmh is not None else 10.0
    prec = precip_mm if precip_mm is not None else 0.0

    if month in WINTER_MONTHS and lat >= 23.0 and (temp <= 20.0 or prec >= 0.1):
        return 2, REGIME_CLASSES[2]

    if (
        month in POST_MONSOON_MONTHS + (9,)
        and lat <= 26.0
        and press <= 1005.0
        and (prec >= 1.0 or wind >= 25.0)
    ):
        return 5, REGIME_CLASSES[5]

    if month in MONSOON_MONTHS and prec >= 2.0:
        return 0, REGIME_CLASSES[0]

    if month in MONSOON_MONTHS:
        return 1, REGIME_CLASSES[1]

    if temp >= 40.0 and prec <= 0.2:
        return 4, REGIME_CLASSES[4]

    if month in PRE_MONSOON_MONTHS and (prec >= 0.5 or temp >= 30.0 or wind >= 20.0):
        return 3, REGIME_CLASSES[3]

    if temp >= 35.0 and prec <= 0.5:
        return 4, REGIME_CLASSES[4]
    if month in POST_MONSOON_MONTHS:
        return 5, REGIME_CLASSES[5]
    if month in WINTER_MONTHS:
        return 3, REGIME_CLASSES[3]
    if prec >= 0.5:
        return 3, REGIME_CLASSES[3]
    return 1, REGIME_CLASSES[1]
