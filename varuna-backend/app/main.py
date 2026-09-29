"""VARUNA FastAPI application.

Run:  uvicorn app.main:app --reload --port 8000   (from varuna-backend/)
CORS allows the Vite dev server at http://localhost:5173.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import (  # noqa: F401
    routes_explain,
    routes_extremes,
    routes_forecast,
    routes_providers,
    routes_regions,
    routes_skill,
    routes_weights,
)
from .config import APP_VERSION, ATTRIBUTION, CORS_ORIGINS
from .services import blend_service as svc

app = FastAPI(
    title="VARUNA - Hybrid AI-NWP Multi-Model Forecast Blending",
    version=APP_VERSION,
    description=(
        "Adaptive multi-model forecast blending (SIH26081). "
        "Forecast sources: ECMWF IFS, ECMWF AIFS, NOAA GFS, DWD ICON via "
        "Open-Meteo (CC BY 4.0). Verification reference: ERA5 reanalysis."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

for _mod in (
    routes_forecast,
    routes_weights,
    routes_skill,
    routes_extremes,
    routes_providers,
    routes_explain,
    routes_regions,
):
    app.include_router(_mod.router)


@app.get("/api/health")
def health():
    return svc.health_payload()


@app.get("/api")
def root():
    return {
        "name": "varuna-backend",
        "version": APP_VERSION,
        "endpoints": [
            "GET /api/health",
            "GET /api/regions",
            "GET /api/forecast?region=&variable=&lead_time_hours=",
            "GET /api/weights?region=&variable=&lead_time_hours=",
            "GET /api/skill",
            "GET /api/extremes?region=&lead_time_hours=",
            "GET /api/explain?region=&variable=&lead_time_hours=",
            "GET /api/providers/status",
        ],
        "attribution": ATTRIBUTION,
    }
