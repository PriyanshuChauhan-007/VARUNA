"""GET /api/forecast - blended forecast timeline (LIVE / CACHED / REPLAY)."""
from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from ..services import blend_service as svc

router = APIRouter()


@router.get("/api/forecast")
def forecast(
    region: str = Query(..., description="region id, e.g. delhi_ncr"),
    variable: str = Query("temperature"),
    lead_time_hours: int | None = Query(None),
):
    try:
        return svc.forecast_payload(region, variable, lead_time_hours)
    except svc.ServiceUnavailable as exc:
        return JSONResponse(
            status_code=503,
            content={
                "detail": str(exc),
                "data_mode": None,
                "available": False,
                "mode_tried": getattr(exc, "mode_tried", []),
            },
        )
