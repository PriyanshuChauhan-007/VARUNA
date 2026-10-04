from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..config import REGIONS, VARIABLES
from ..services import blend_service as svc

router = APIRouter()


class AnalyzeRequest(BaseModel):
    region: str = Field(default="delhi_ncr", description="Region identifier")
    variable: str = Field(default="temperature", description="Forecast variable")
    lead_time_hours: int = Field(default=48, ge=1, le=168, description="Lead time in hours (1-168)")


def _do_analyze(region: str, variable: str, lead_time_hours: int):
    alias_map = {
        "jamnagar": "gujarat_industrial",
        "jamnagar_refinery": "gujarat_industrial",
        "mumbai": "mumbai_coastal",
        "delhi": "delhi_ncr",
        "paradip_port": "odisha_coast",
        "punjab_central": "punjab_agri",
        "guwahati_brahmaputra": "assam_valley",
        "chennai_coromandel": "chennai_coastal",
        "jodhpur_thar": "rajasthan_thar",
        "kochi_malabar": "kerala_coast",
        "bhopal_central": "central_highlands",
    }
    region = alias_map.get(region, region)

    if region not in REGIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown region '{region}'. Supported: {sorted(REGIONS.keys())}",
        )
    if variable not in VARIABLES:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown variable '{variable}'. Supported: {sorted(VARIABLES.keys())}",
        )

    try:
        return svc.analyze_payload(region, variable, lead_time_hours)
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


@router.post("/api/analyze")
def run_analysis_post(body: AnalyzeRequest):
    return _do_analyze(body.region, body.variable, body.lead_time_hours)


@router.get("/api/analyze")
def run_analysis_get(
    region: str = Query("delhi_ncr", description="Region identifier"),
    variable: str = Query("temperature", description="Forecast variable"),
    lead_time_hours: int = Query(48, ge=1, le=168, description="Lead time in hours (1-168)"),
):
    return _do_analyze(region, variable, lead_time_hours)
