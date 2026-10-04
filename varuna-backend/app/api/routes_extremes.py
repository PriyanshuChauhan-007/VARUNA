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
        p_status = getattr(exc, "provider_http_status", None)
        p_reason = getattr(exc, "provider_reason", None)
        diagnostic = None
        if p_status == 429 or p_reason == "rate_limited":
            diagnostic = "Upstream weather provider rate limit exceeded (HTTP 429). Please retry after cooldown."
        elif p_reason == "timeout":
            diagnostic = "Upstream weather provider timed out."
        elif p_reason == "connection_error":
            diagnostic = "Connection to upstream weather provider failed."
        elif p_status is not None:
            diagnostic = f"Upstream weather provider returned HTTP {p_status}."

        content = {
            "detail": str(exc),
            "available": False,
            "provider_http_status": p_status,
            "provider_reason": p_reason,
        }
        if diagnostic:
            content["diagnostic"] = diagnostic
        return JSONResponse(status_code=503, content=content)
