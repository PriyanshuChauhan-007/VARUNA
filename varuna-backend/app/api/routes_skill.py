"""GET /api/skill - held-out headline + full-dataset breakdowns, honest scopes."""
from __future__ import annotations

from fastapi import APIRouter

from ..services import blend_service as svc

router = APIRouter()


@router.get("/api/skill")
def skill():
    return svc.skill_payload()
