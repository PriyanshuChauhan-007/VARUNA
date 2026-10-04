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
            "data_mode": None,
            "available": False,
            "mode_tried": getattr(exc, "mode_tried", []),
            "provider_http_status": p_status,
            "provider_reason": p_reason,
        }
        if diagnostic:
            content["diagnostic"] = diagnostic

        return JSONResponse(status_code=503, content=content)


from typing import Any
from pydantic import BaseModel, Field


class ProcessForecastItem(BaseModel):
    region: str = Field(..., description="Region ID, e.g. delhi_ncr")
    variable: str = Field("temperature", description="Variable key: temperature, rainfall, wind_speed, pressure")
    lead_time_hours: int | None = Field(None, description="Requested lead time in hours")
    series: dict[str, Any] = Field(..., description="Normalized Open-Meteo NWP member series")


class ProcessForecastRequest(BaseModel):
    # Single-item processing fields:
    region: str | None = None
    variable: str = "temperature"
    lead_time_hours: int | None = None
    series: dict[str, Any] | None = None
    # Batch processing field:
    batch: list[ProcessForecastItem] | None = None


@router.post("/api/forecast/process")
def forecast_process(req: ProcessForecastRequest):
    """Process browser-acquired Open-Meteo forecast series through the VARUNA scientific pipeline."""
    try:
        if req.batch is not None and len(req.batch) > 0:
            results = []
            for item in req.batch:
                res = svc.process_client_forecast(
                    region_id=item.region,
                    variable=item.variable,
                    series=item.series,
                    lead_time_hours=item.lead_time_hours,
                )
                results.append(res)
            return {"results": results}

        if not req.region or not req.series:
            return JSONResponse(
                status_code=422,
                content={"detail": "Must provide either 'batch' list or both 'region' and 'series'"}
            )

        return svc.process_client_forecast(
            region_id=req.region,
            variable=req.variable,
            series=req.series,
            lead_time_hours=req.lead_time_hours,
        )
    except svc.ClientSeriesValidationError as exc:
        return JSONResponse(status_code=422, content={"detail": str(exc), "status": "validation_error"})
    except svc.ServiceUnavailable as exc:
        return JSONResponse(status_code=503, content={"detail": str(exc), "status": "service_unavailable"})

