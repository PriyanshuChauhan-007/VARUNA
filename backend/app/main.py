"""
VARUNA Scientific FastAPI Backend Application.
Serves multi-model adaptive forecasts, XGBoost contextual weights, verified skill metrics,
and operational telemetry to the VARUNA frontend workstation.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone

from .api.routes_forecast import router as forecast_router
from .api.routes_weights import router as weights_router
from .api.routes_skill import router as skill_router
from .api.routes_extremes import router as extremes_router
from .api.routes_providers import router as providers_router

app = FastAPI(
    title="VARUNA Adaptive Weather Intelligence API",
    description="Operational FastAPI scientific backend for multi-model AI-NWP forecast blending.",
    version="1.0.0"
)

# Enable CORS for Vite frontend dev server (port 5173 / localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(forecast_router)
app.include_router(weights_router)
app.include_router(skill_router)
app.include_router(extremes_router)
app.include_router(providers_router)

@app.get("/api/health", tags=["System Health"])
async def health_check():
    return {
        "status": "HEALTHY",
        "service": "VARUNA Scientific Backend",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "models_integrated": ["ecmwf_ifs", "ecmwf_aifs", "ncep_gfs", "dwd_icon"],
        "reference_source": "ERA5 Reanalysis Reference Dataset",
        "observational_status": "IMD AWS — Integration Pending (No verified station observations connected)"
    }
