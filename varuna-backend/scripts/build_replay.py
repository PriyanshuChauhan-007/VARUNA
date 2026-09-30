import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd

from app.config import ALIGNED_CSV, REPLAY_TIMELINES
from app.science.meta_model import load_bundle
from app.science.run_pipeline import build_replay

if __name__ == "__main__":
    if not ALIGNED_CSV.exists():
        raise SystemExit(f"missing {ALIGNED_CSV} - run scripts/run_pipeline.py first")
    df = pd.read_csv(ALIGNED_CSV)
    bundle = load_bundle()
    if bundle is None:
        raise SystemExit("missing trained model - run scripts/run_pipeline.py first")
    info = build_replay(bundle, df)
    print(json.dumps(info, indent=2))
    print(f"wrote {REPLAY_TIMELINES}")
