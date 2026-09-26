"""
Forecast API Router for VARUNA.
Provides live multi-model member forecasts and VARUNA adaptive blend.
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from ..config import CANONICAL_REGIONS, CANONICAL_VARIABLES, CANONICAL_MODELS
from ..providers.open_meteo import OpenMeteoProvider
from ..science.meta_model import VarunaMetaModel
from ..science.weighting import blend_member_forecasts

router = APIRouter(prefix="/api/forecast", tags=["Forecast"])
provider = OpenMeteoProvider()
meta_model = VarunaMetaModel(variable="temperature")
meta_model.load_checkpoint()

@router.get("")
async def get_forecast(
    region: str = Query(..., description="Canonical region id, e.g. delhi_ncr"),
    variable: str = Query("temperature", description="Variable: temperature, rainfall, wind_speed, pressure"),
    mode: str = Query("LIVE", description="Mode: LIVE | REPLAY | DEMO")
) -> Dict[str, Any]:
    if region not in CANONICAL_REGIONS:
        raise HTTPException(status_code=404, detail=f"Region '{region}' not found in canonical domain.")
    if variable not in CANONICAL_VARIABLES:
        raise HTTPException(status_code=400, detail=f"Variable '{variable}' not supported.")

    reg = CANONICAL_REGIONS[region]
    var_meta = CANONICAL_VARIABLES[variable]

    try:
        # Fetch multi-model series
        series = await provider.get_forecast(region, variable, mode=mode)
        
        # Organize by valid timestamp to calculate blend at each lead step
        points_by_time: Dict[str, Dict[str, Any]] = {}
        for pt in series.points:
            t_iso = pt.valid_time.isoformat()
            if t_iso not in points_by_time:
                points_by_time[t_iso] = {
                    "valid_time": t_iso,
                    "lead_time_hours": pt.lead_time_hours,
                    "members": {}
                }
            points_by_time[t_iso]["members"][pt.model] = pt.value

        # Calculate blend for each timestep
        now_dt = datetime.now(timezone.utc)
        timeline = []
        for t_iso in sorted(points_by_time.keys()):
            item = points_by_time[t_iso]
            members = item["members"]
            lead_h = item["lead_time_hours"]
            
            # Contextual prediction
            weights_res = meta_model.predict_adaptive_weights(
                lat=reg.lat,
                lon=reg.lng,
                elev=reg.elevation_m,
                day_of_year=now_dt.timetuple().tm_yday,
                hour=item["lead_time_hours"] % 24,
                month=now_dt.month,
                regime_idx=0,
                model_values=members,
                lead_time_hours=lead_h
            )
            
            blend_val = blend_member_forecasts(members, weights_res["weights"])
            timeline.append({
                "valid_time": t_iso,
                "lead_time_hours": lead_h,
                "blend": blend_val,
                "members": members,
                "weights": weights_res["weights"]
            })

        return {
            "region": {
                "id": reg.id,
                "name": reg.name,
                "latitude": reg.lat,
                "longitude": reg.lng,
                "elevation": f"{reg.elevation_m}m",
                "zone": reg.zone,
                "regime": reg.regime
            },
            "variable": {
                "id": var_meta["id"],
                "label": var_meta["label"],
                "unit": var_meta["unit"]
            },
            "data_mode": "LIVE",
            "initialization_time": series.init_time.isoformat(),
            "timeline": timeline[:72],  # Return first 72 hours for clean charts
            "provenance": {
                "source": "Open-Meteo Multi-Model Gateway",
                "models": list(CANONICAL_MODELS.keys()),
                "meta_model": "XGBoost Contextual Blending"
            }
        }

    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Provider fetch error: {str(e)}")
