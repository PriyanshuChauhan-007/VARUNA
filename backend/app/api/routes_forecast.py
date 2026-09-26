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
    lead_time: Optional[str] = Query(None, description="Lead time horizon: 24h, 48h, 72h, 120h, 7d, 30d"),
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
            if variable in ("rainfall", "wind_speed"):
                blend_val = max(0.0, blend_val)

            timeline.append({
                "valid_time": t_iso,
                "lead_time_hours": lead_h,
                "blend": blend_val,
                "members": members,
                "weights": weights_res["weights"],
                "predicted_errors": weights_res.get("predicted_errors", {})
            })

        # Process requested lead time / forecast horizon
        target_lead_hours = None
        horizon_note = None
        if lead_time:
            lt_lower = lead_time.lower().strip()
            if lt_lower.endswith("d"):
                try:
                    days = int(lt_lower[:-1])
                    target_lead_hours = days * 24
                    if days > 7:
                        horizon_note = (
                            f"Requested horizon '{lead_time}' exceeds operational NWP ceiling (7 days / 168 hours). "
                            "Operational high-resolution NWP models (IFS, AIFS, GFS, ICON) provide forecasts up to 7 days. "
                            "Maximum available 7-day operational timeline returned; 30-day forecast is unavailable."
                        )
                except ValueError:
                    target_lead_hours = 48
            elif lt_lower.endswith("h"):
                try:
                    target_lead_hours = int(lt_lower[:-1])
                except ValueError:
                    target_lead_hours = 48
            else:
                try:
                    target_lead_hours = int(lt_lower)
                except ValueError:
                    target_lead_hours = 48

        # Slice timeline according to horizon
        if target_lead_hours is not None:
            max_idx = min(len(timeline), target_lead_hours + 1)
            timeline_slice = timeline[:max_idx]
        else:
            timeline_slice = timeline[:72]  # Default to first 72 hours if unspecified

        # Find target forecast point for the specific lead time
        target_point = None
        if target_lead_hours is not None:
            for pt in timeline:
                if pt["lead_time_hours"] == target_lead_hours:
                    target_point = pt
                    break
        if not target_point and timeline_slice:
            target_point = timeline_slice[-1]

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
            "requested_lead_time": lead_time,
            "supported_horizons": ["24h", "48h", "72h", "120h", "7d"],
            "available_horizon_hours": len(timeline),
            "horizon_note": horizon_note,
            "target_point": target_point,
            "timeline": timeline_slice,
            "provenance": {
                "source": "Open-Meteo Multi-Model Gateway",
                "models": list(CANONICAL_MODELS.keys()),
                "meta_model": "XGBoost Contextual Blending"
            }
        }

    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Provider fetch error: {str(e)}")
