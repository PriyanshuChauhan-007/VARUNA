"""GET /api/regions - the 12 canonical regions with validated flags."""
from __future__ import annotations

from fastapi import APIRouter

from ..services import blend_service as svc

router = APIRouter()


@router.get("/api/regions")
def regions():
    return {"regions": svc.regions_payload()}
