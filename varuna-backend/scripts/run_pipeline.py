import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.science.run_pipeline import run_pipeline

if __name__ == "__main__":
    run_pipeline()
