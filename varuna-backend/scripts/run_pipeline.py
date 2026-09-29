"""Run the full VARUNA offline pipeline.

    python scripts/run_pipeline.py

Collects aligned forecast vs ERA5 rows, trains the XGBoost meta-models,
writes all reports, provenance and the replay archive. Network required
(Open-Meteo previous-runs + archive APIs); every response is cached in
varuna-backend/cache/varuna_cache.sqlite3.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.science.run_pipeline import run_pipeline  # noqa: E402

if __name__ == "__main__":
    run_pipeline()
