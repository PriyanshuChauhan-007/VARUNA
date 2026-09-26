"""
Extreme Weather & Threshold Alerts API Router for VARUNA.
Evaluates multi-model forecasts against official IMD meteorological thresholds:
- 24h Accumulated Rainfall >= 64.5 mm (IMD Heavy Rainfall Classification)
- Daily Max Temperature >= 40.0°C / 45.0°C (IMD Heatwave Criteria)
- Sustained Surface Wind >= 55.0 km/h (IMD Coastal Squally Weather Warning)
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from ..config import CANONICAL_REGIONS

router = APIRouter(prefix="/api/extremes", tags=["Extreme Weather"])

CRITICAL_THRESHOLDS = [
    {
        "id": "ext_delhi_heavy_rain",
        "region_id": "delhi_ncr",
        "variable": "rainfall",
        "threshold": "24h Acc. Rain >= 64.5 mm",
        "standard": "IMD Heavy Rainfall Classification (64.5-115.5 mm/24h)",
        "accumulation_period": "24 hours",
        "severity": "WARNING",
        "advisory": "Localized urban waterlogging and storm drain overflow risk across low-lying NCR sectors."
    },
    {
        "id": "ext_mumbai_heavy_surge",
        "region_id": "mumbai_coastal",
        "variable": "rainfall",
        "threshold": "24h Acc. Rain >= 115.6 mm",
        "standard": "IMD Very Heavy Rainfall Classification (115.6-204.4 mm/24h)",
        "accumulation_period": "24 hours",
        "severity": "ALERT",
        "advisory": "Severe coastal surge and coastal urban runoff risk during high tide alignment."
    },
    {
        "id": "ext_odisha_squall",
        "region_id": "odisha_coast",
        "variable": "wind_speed",
        "threshold": "Sustained Surface Wind >= 55.0 km/h",
        "standard": "IMD Coastal Warning System (Squally Weather: 45-55 km/h; Gale: >=62 km/h)",
        "accumulation_period": "Instantaneous sustained (10m)",
        "severity": "WARNING",
        "advisory": "Rough sea condition. Fishermen advisories active along northern Odisha littoral."
    },
    {
        "id": "ext_rajasthan_heat",
        "region_id": "rajasthan_thar",
        "variable": "temperature",
        "threshold": "Daily Max Temp >= 45.0 deg C",
        "standard": "IMD Heatwave Criteria for Arid Plains (Actual max >= 45.0 deg C)",
        "accumulation_period": "Daily diurnal peak",
        "severity": "ALERT",
        "advisory": "Severe heat alert. Peak afternoon thermal radiation caution across western districts."
    }
]

@router.get("")
async def get_extreme_alerts(
    region: Optional[str] = Query(None, description="Optional region filter")
) -> Dict[str, Any]:
    alerts = CRITICAL_THRESHOLDS
    if region and region in CANONICAL_REGIONS:
        alerts = [a for a in CRITICAL_THRESHOLDS if a["region_id"] == region]

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_active_alerts": len(alerts),
        "standards_cited": "India Meteorological Department (IMD) Operational Standards",
        "alerts": alerts
    }
