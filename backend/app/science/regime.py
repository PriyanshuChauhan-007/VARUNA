"""
Synoptic Meteorological Regime Classification for the Indian Subcontinent.
Deterministic rule-based classification based on season, coordinates, temperature, pressure, and wind.
Provides contextual features for the XGBoost meta-model.
"""
from typing import Dict, Any
from datetime import datetime

REGIMES = [
    "Monsoonal Active Surge",
    "Monsoonal Break / Trough Shift",
    "Western Disturbance / Upper Trough",
    "Severe Pre-Monsoon Convective / Nor'wester",
    "Subtropical Heatwave / Low-Level Thermal Ridge",
    "Post-Monsoon Depression / Cyclonic Perturbation"
]

def classify_synoptic_regime(
    lat: float,
    lng: float,
    valid_time: datetime,
    temp_2m: float,
    surface_pressure: float,
    wind_speed: float,
    precipitation: float
) -> Dict[str, Any]:
    """
    Classify the current meteorological condition into one of the 6 canonical Indian regimes.
    Returns regime label, index (0-5), and one-hot encoded vector.
    """
    month = valid_time.month
    
    # 1. Southwest Monsoon Season: June to September (Months 6, 7, 8, 9)
    if month in [6, 7, 8, 9]:
        # If low pressure and significant rain -> Monsoonal Active Surge
        if precipitation >= 10.0 or surface_pressure < 995.0:
            regime = "Monsoonal Active Surge"
        else:
            # Monsoonal Break (trough shifted or suppressed phase)
            regime = "Monsoonal Break / Trough Shift"

    # 2. Pre-Monsoon / Summer Season: March to May (Months 3, 4, 5)
    elif month in [3, 4, 5]:
        if temp_2m >= 40.0:
            regime = "Subtropical Heatwave / Low-Level Thermal Ridge"
        elif precipitation > 5.0 or wind_speed > 35.0:
            regime = "Severe Pre-Monsoon Convective / Nor'wester"
        else:
            regime = "Subtropical Heatwave / Low-Level Thermal Ridge"

    # 3. Post-Monsoon / Northeast Monsoon: October to December (Months 10, 11, 12)
    elif month in [10, 11, 12]:
        # East/South coast coastal zones prone to cyclones/depressions
        if (lat < 22.0 and lng > 78.0) or surface_pressure < 1005.0 or precipitation > 15.0:
            regime = "Post-Monsoon Depression / Cyclonic Perturbation"
        elif lat > 26.0:
            regime = "Western Disturbance / Upper Trough"
        else:
            regime = "Post-Monsoon Depression / Cyclonic Perturbation"

    # 4. Winter Season: January to February (Months 1, 2)
    else:
        if lat > 24.0:
            regime = "Western Disturbance / Upper Trough"
        else:
            regime = "Monsoonal Break / Trough Shift"

    regime_idx = REGIMES.index(regime)
    one_hot = [1.0 if r == regime else 0.0 for r in REGIMES]

    return {
        "regime": regime,
        "regime_index": regime_idx,
        "one_hot": one_hot,
        "features": {
            f"regime_{i}": val for i, val in enumerate(one_hot)
        }
    }
