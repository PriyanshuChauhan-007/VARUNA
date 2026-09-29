"""GET /api/providers/status - live health probes + provenance + artifacts."""
from __future__ import annotations

from fastapi import APIRouter

from ..services import blend_service as svc

router = APIRouter()


@router.get("/api/providers/status")
def providers_status():
    return svc.providers_status_payload()
