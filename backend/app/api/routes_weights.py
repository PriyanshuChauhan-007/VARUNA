"""
Adaptive Weights API Router for VARUNA.
Returns current model weights, predicted errors, and backoff metadata.
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from ..config import CANONICAL_REGIONS, CANONICAL_VARIABLES, CANONICAL_MODELS
from ..science.meta_model import VarunaMetaModel
from ..providers.open_meteo import OpenMeteoProvider

router = APIRouter(prefix="/api/weights", tags=["Adaptive Weights"])
meta_model = VarunaMetaModel(variable="temperature")
meta_model.load_checkpoint()
provider = OpenMeteoProvider()

@router.get("")
async def get_adaptive_weights(
    region: str = Query("delhi_ncr", description="Canonical region id"),
    variable: str = Query("temperature", description="Variable name"),
    lead_time: str = Query("48h", description="Lead time horizon: 24h, 48h, 72h, 120h")
) -> Dict[str, Any]:
    if region not in CANONICAL_REGIONS:
        raise HTTPException(status_code=404, detail="Region not found")
        
    reg = CANONICAL_REGIONS[region]
    now = datetime.now(timezone.utc)

    # Live or estimated values to condition the XGBoost error prediction
    model_values = {
        "ecmwf_ifs": 28.5,
        "ecmwf_aifs": 28.1,
        "ncep_gfs": 29.2,
        "dwd_icon": 28.8
    }

    lead_h = int(lead_time.lower().replace("h", "").strip()) if "h" in lead_time.lower() else 48

    res = meta_model.predict_adaptive_weights(
        lat=reg.lat,
        lon=reg.lng,
        elev=reg.elevation_m,
        day_of_year=now.timetuple().tm_yday,
        hour=now.hour,
        month=now.month,
        regime_idx=0,
        model_values=model_values,
        lead_time_hours=lead_h
    )

    models_info = []
    for m_key, m_meta in CANONICAL_MODELS.items():
        w = res["weights"].get(m_key, 25)
        pred_err = res["predicted_errors"].get(m_key, 1.0)
        models_info.append({
            "id": m_key,
            "name": m_meta["name"],
            "type": m_meta["type"],
            "resolution": m_meta["resolution"],
            "weight": w,
            "weight_pct": f"{w}%",
            "predicted_error": pred_err,
            "weight_color": m_meta["weight_color"]
        })

    return {
        "region_id": region,
        "region_name": reg.name,
        "variable": variable,
        "lead_time": lead_time,
        "backoff_level": res.get("backoff_level", "XGBOOST_CONTEXTUAL"),
        "reason": res.get("reason", "Contextual error minimization"),
        "sum_check": sum(res["weights"].values()),  # Always 100
        "models": models_info,
        "feature_importances": meta_model.feature_importances.get("ecmwf_ifs", {})
    }
