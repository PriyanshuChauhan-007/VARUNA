from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from ..services import blend_service as svc

router = APIRouter()


@router.get("/api/explain")
def explain(
    region: str = Query(...),
    variable: str = Query("temperature"),
    lead_time_hours: int = Query(48),
):
    try:
        return svc.explain_payload(region, variable, lead_time_hours)
    except svc.ServiceUnavailable as exc:
        return JSONResponse(
            status_code=503,
            content={"detail": str(exc), "available": False},
        )
