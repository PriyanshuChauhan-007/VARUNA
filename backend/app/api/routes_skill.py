"""
Model Skill & Historical Verification API Router for VARUNA.
Serves real verified metrics (RMSE, MAE, Bias, Pearson r) computed against ERA5 reference.
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional, Dict, Any, List
import pandas as pd
from ..config import REPORTS_DIR, CANONICAL_REGIONS, CANONICAL_MODELS

router = APIRouter(prefix="/api/skill", tags=["Skill Verification"])

@router.get("")
async def get_skill_metrics(
    variable: str = Query("temperature", description="Variable name"),
    region: Optional[str] = Query(None, description="Optional region filter")
) -> Dict[str, Any]:
    csv_path = REPORTS_DIR / "model_skill.csv"
    summary_path = REPORTS_DIR / "skill_overall_summary.csv"

    if not csv_path.exists():
        # Return fallback status if pipeline hasn't completed yet
        return {
            "status": "PROCESSING",
            "message": "Historical verification pipeline currently executing.",
            "metrics": []
        }

    df = pd.read_csv(csv_path)
    if region and region in CANONICAL_REGIONS:
        df = df[df["region"] == region]

    records = df.to_dict(orient="records")

    summary_records = []
    if summary_path.exists():
        s_df = pd.read_csv(summary_path)
        summary_records = s_df.to_dict(orient="records")

    return {
        "variable": variable,
        "region": region or "all_canonical_regions",
        "reference_dataset": "ERA5 Reanalysis Reference Dataset",
        "sample_metrics": records,
        "overall_summary": summary_records
    }
