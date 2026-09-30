from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from ..services import blend_service as svc

router = APIRouter()


@router.get("/api/extremes")
def extremes(
    region: str = Query(...),
    lead_time_hours: int = Query(48),
    simulate: bool = Query(False, description="illustrative only; response is flagged"),
):
    try:
        return svc.extremes_payload(region, lead_time_hours, simulate=simulate)
    except svc.ServiceUnavailable as exc:
        return JSONResponse(
            status_code=503,
            content={"detail": str(exc), "available": False},
        )
