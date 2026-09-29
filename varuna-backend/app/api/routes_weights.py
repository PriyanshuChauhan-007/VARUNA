"""GET /api/weights - real provider values -> real regime -> predicted errors
-> integer weights summing to 100. Never hardcoded."""
from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from ..services import blend_service as svc

router = APIRouter()


@router.get("/api/weights")
def weights(
    region: str = Query(...),
    variable: str = Query("temperature"),
    lead_time_hours: int = Query(48),
):
    try:
        return svc.weights_payload(region, variable, lead_time_hours)
    except svc.ServiceUnavailable as exc:
        return JSONResponse(
            status_code=503,
            content={"detail": str(exc), "available": False},
        )
