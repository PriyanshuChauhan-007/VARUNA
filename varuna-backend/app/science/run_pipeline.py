from __future__ import annotations

import json
import platform
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.config import (
    ALIGNED_CSV,
    ATTRIBUTION,
    BENCHMARK_REGION_IDS,
    BENCHMARK_WINDOWS,
    BLEND_TEST_CSV,
    LEAD_TIMES,
    META_MODEL_PATH,
    MODEL_KEYS,
    MODEL_NAMES,
    PROVENANCE_JSON,
    REPLAY_TIMELINES,
    REPORTS_DIR,
    SPLIT_TEST,
    SPLIT_TRAIN,
    SPLIT_VAL,
    VARIABLES,
)
from app.science.alignment import collect_all_rows, split_partitions
from app.science.meta_model import (
    feature_importances,
    predict_errors,
    save_bundle,
    train_meta_model,
)
from app.science.verification import metrics, round_metrics
from app.science.weighting import (
    blend_value,
    hamilton_hare,
    static_inverse_rmse_weights,
    weights_from_predicted_errors,
)

SCOPE_TEST = "held_out_test"
SCOPE_FULL = "full_dataset_all_splits"
TEST_SEASON_CAVEAT = (
    "The held-out test partition is entirely the chronologically last season "
    "(Post-Monsoon Sep 1-8, 2026). Headline numbers therefore describe one "
    "season only and must not be read as verified across all seasons."
)


def _library_versions() -> dict:
    import joblib
    import sklearn
    import xgboost

    return {
        "python": platform.python_version(),
        "pandas": pd.__version__,
        "numpy": np.__version__,
        "scikit_learn": sklearn.__version__,
        "xgboost": xgboost.__version__,
        "joblib": joblib.__version__,
    }


def _equal_weights() -> dict[str, int]:
    return hamilton_hare({m: 1.0 for m in MODEL_KEYS})


def evaluate_systems(
    df: pd.DataFrame,
    predicted: dict[str, pd.Series],
    static_weights: dict[str, int],
    equal_weights: dict[str, int],
) -> dict[str, dict]:
    ref = df["reference_val"].to_numpy(dtype=float)

    cols = {m: df[f"{m}_val"].to_numpy(dtype=float) for m in MODEL_KEYS}

    systems: dict[str, list[np.ndarray]] = {}
    for m in MODEL_KEYS:
        systems[m] = [cols[m]]

    systems["equal_blend"] = [
        np.mean(np.vstack([cols[m] for m in MODEL_KEYS]), axis=0)
    ]

    systems["static_inverse_rmse_blend"] = [
        np.sum(
            np.vstack([static_weights[m] / 100.0 * cols[m] for m in MODEL_KEYS]),
            axis=0,
        )
    ]

    adaptive = np.empty(len(df), dtype=float)
    for pos, idx in enumerate(df.index):
        errs = {m: float(predicted[m].loc[idx]) for m in MODEL_KEYS}
        w = weights_from_predicted_errors(errs)
        vals = {m: float(cols[m][pos]) for m in MODEL_KEYS}
        adaptive[pos] = blend_value(vals, w)
    systems["varuna_adaptive"] = [adaptive]

    out: dict[str, dict] = {}
    for name, series in systems.items():
        out[name] = round_metrics(metrics(series[0], ref))
    return out


def _subset(predicted: dict[str, pd.Series], idx) -> dict[str, pd.Series]:
    return {m: predicted[m].loc[idx] for m in MODEL_KEYS}


def _skill_rows(df: pd.DataFrame, predicted: dict[str, pd.Series],
                static_weights: dict[str, int], equal_weights: dict[str, int],
                group_col: str | None, scope: str) -> list[dict]:
    rows: list[dict] = []
    groups = [(None, df)] if group_col is None else list(df.groupby(group_col))
    for gname, gdf in groups:
        if len(gdf) == 0:
            continue
        res = evaluate_systems(gdf, _subset(predicted, gdf.index), static_weights, equal_weights)
        for system, m in res.items():
            rows.append({
                (group_col or "group"): gname if group_col else "all",
                "system": system,
                "scope": scope,
                **m,
            })
    return rows


def run_pipeline(variables: list[str] | None = None, progress: bool = True) -> dict:
    variables = variables or ["temperature"]
    started = time.time()
    provenance: dict = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "attribution": ATTRIBUTION,
        "reference_dataset": "ERA5 reanalysis (Open-Meteo archive API) - reference, not ground truth",
        "providers": {
            "previous_runs": "https://previous-runs-api.open-meteo.com/v1/forecast",
            "archive": "https://archive-api.open-meteo.com/v1/archive",
            "forecast": "https://api.open-meteo.com/v1/forecast",
        },
        "split_rule": (
            "chronological by unique timestamp: earliest 65% train, next 15% "
            "validation, final 20% test; no shuffling; all rows of a timestamp "
            "share one partition"
        ),
        "split_fractions": {"train": SPLIT_TRAIN, "validation": SPLIT_VAL, "test": SPLIT_TEST},
        "benchmark_windows": BENCHMARK_WINDOWS,
        "benchmark_regions": BENCHMARK_REGION_IDS,
        "variables": variables,
        "leads_hours": LEAD_TIMES,
        "library_versions": _library_versions(),
        "failed_fetches": [],
        "test_season_caveat": TEST_SEASON_CAVEAT,
    }

    if progress:
        print("[1/6] Collecting aligned forecast vs ERA5 rows ...", flush=True)
    df = collect_all_rows(
        region_ids=BENCHMARK_REGION_IDS,
        windows=BENCHMARK_WINDOWS,
        variables=variables,
        leads=LEAD_TIMES,
        progress=progress,
    )
    if len(df) == 0:
        raise SystemExit(
            "Pipeline aborted: no aligned rows collected (network failure or all "
            "windows empty). Nothing was written - no data is fabricated."
        )
    ALIGNED_CSV.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(ALIGNED_CSV, index=False)
    provenance["rows_total"] = int(len(df))
    provenance["timestamps_total"] = int(df["timestamp"].nunique())
    provenance["timestamp_range"] = [df["timestamp"].min(), df["timestamp"].max()]
    provenance["rows_per_season"] = {k: int(v) for k, v in df["season"].value_counts().items()}
    provenance["rows_per_region"] = {k: int(v) for k, v in df["region_id"].value_counts().items()}
    provenance["rows_per_lead"] = {k: int(v) for k, v in df.groupby("lead_time_hours").size().items()}

    if progress:
        print(f"      {len(df)} rows, {df['timestamp'].nunique()} unique timestamps", flush=True)
        print("[2/6] Chronological split ...", flush=True)
    train_df, val_df, test_df = split_partitions(df)
    provenance["split_rows"] = {
        "train": int(len(train_df)), "validation": int(len(val_df)), "test": int(len(test_df)),
    }
    provenance["split_timestamps"] = {
        "train": int(train_df["timestamp"].nunique()),
        "validation": int(val_df["timestamp"].nunique()),
        "test": int(test_df["timestamp"].nunique()),
    }
    provenance["split_timestamp_range"] = {
        "train": [train_df["timestamp"].min(), train_df["timestamp"].max()],
        "validation": [val_df["timestamp"].min(), val_df["timestamp"].max()],
        "test": [test_df["timestamp"].min(), test_df["timestamp"].max()],
    }
    ts_train = set(train_df["timestamp"])
    ts_val = set(val_df["timestamp"])
    ts_test = set(test_df["timestamp"])
    assert not (ts_train & ts_val) and not (ts_train & ts_test) and not (ts_val & ts_test), \
        "timestamp leakage between partitions"

    main_var = variables[0]
    provenance["trained_variable"] = main_var

    if progress:
        print("[3/6] Training XGBoost meta-models (one per model) ...", flush=True)
    bundle = train_meta_model(train_df, variable=main_var, validation_df=val_df)
    save_bundle(bundle, META_MODEL_PATH)

    if progress:
        print("[4/6] Scoring partitions and evaluating blend systems ...", flush=True)
    predicted = predict_errors(bundle, df)

    train_rmses = {}
    for m in MODEL_KEYS:
        train_rmses[m] = float(np.sqrt(train_df[f"{m}_sq_err"].mean()))
    static_weights = static_inverse_rmse_weights(train_rmses)
    equal_weights = _equal_weights()
    provenance["static_inverse_rmse_weights_train_only"] = static_weights
    provenance["train_rmse_per_model"] = {k: round(v, 4) for k, v in train_rmses.items()}

    test_pred = _subset(predicted, test_df.index)
    test_systems = evaluate_systems(test_df, test_pred, static_weights, equal_weights)
    test_rows = [
        {"system": system, "scope": SCOPE_TEST, "partition": "final 20% chronological",
         "seasons": ",".join(sorted(test_df["season"].unique())),
         **m}
        for system, m in test_systems.items()
    ]
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(test_rows).to_csv(BLEND_TEST_CSV, index=False)

    full_rows = []
    full_rows += _skill_rows(df, predicted, static_weights, equal_weights, None, SCOPE_FULL)
    full_rows += _skill_rows(df, predicted, static_weights, equal_weights, "lead_time_hours", SCOPE_FULL)
    full_rows += _skill_rows(df, predicted, static_weights, equal_weights, "season", SCOPE_FULL)
    full_rows += _skill_rows(df, predicted, static_weights, equal_weights, "region_id", SCOPE_FULL)

    overall = [
        {"model": m, "system": m, "scope": SCOPE_FULL, **round_metrics(metrics(df[f"{m}_val"], df["reference_val"]))}
        for m in MODEL_KEYS
    ]
    pd.DataFrame(overall).to_csv(REPORTS_DIR / "model_skill.csv", index=False)

    def _dump(dim: str, filename: str) -> None:
        rows = [r for r in full_rows if r.get(dim, "all") != "all"]
        pd.DataFrame(rows).to_csv(REPORTS_DIR / filename, index=False)

    _dump("lead_time_hours", "skill_by_lead.csv")
    _dump("season", "skill_by_season.csv")
    _dump("region_id", "skill_by_region.csv")

    if progress:
        print("[5/6] Adaptive weights table + feature importance ...", flush=True)
    group_cols = ["region_id", "season", "lead_time_hours", "regime", "regime_index"]
    aw_rows = []
    for keys, gdf in df.groupby(group_cols):
        errs = {m: float(predicted[m].loc[gdf.index].mean()) for m in MODEL_KEYS}
        w = weights_from_predicted_errors(errs)
        row = dict(zip(group_cols, keys))
        row.update({f"{m}_weight": w[m] for m in MODEL_KEYS})
        row.update({f"{m}_predicted_error": round(errs[m], 4) for m in MODEL_KEYS})
        row["weights_sum"] = sum(w.values())
        row["n_rows"] = int(len(gdf))
        row["scope"] = SCOPE_FULL
        aw_rows.append(row)
    pd.DataFrame(aw_rows).to_csv(REPORTS_DIR / "adaptive_weights.csv", index=False)

    _plot_feature_importance(bundle)

    if progress:
        print("[6/6] Building replay timelines ...", flush=True)
    replay_info = build_replay(bundle, df)

    provenance["replay"] = replay_info
    provenance["artifacts"] = {
        "aligned_csv": str(ALIGNED_CSV.name),
        "meta_model": str(META_MODEL_PATH.name),
        "blend_test_results": str(BLEND_TEST_CSV.name),
        "replay_timelines": str(REPLAY_TIMELINES.name),
    }
    provenance["held_out_test_systems"] = list(test_systems.keys())
    provenance["held_out_test_headline"] = {
        k: v for k, v in test_systems.items()
    }
    provenance["duration_s"] = round(time.time() - started, 1)
    PROVENANCE_JSON.write_text(json.dumps(provenance, indent=2, default=str), encoding="utf-8")

    if progress:
        print("\nPipeline complete.", flush=True)
        print(f"  rows: {len(df)}  (train {len(train_df)} / val {len(val_df)} / test {len(test_df)})")
        print(f"  held-out test ({SCOPE_TEST}):")
        for system, m in test_systems.items():
            print(f"    {system:28s} rmse={m['rmse']} mae={m['mae']} bias={m['bias']} r={m['pearson_r']} n={m['n']}")
        print(f"  caveat: {TEST_SEASON_CAVEAT}")
    return provenance


def _plot_feature_importance(bundle: dict) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    imps = feature_importances(bundle)
    if not imps:
        return
    names = [d["feature"] for d in imps][::-1]
    vals = [d["importance"] for d in imps][::-1]
    fig, ax = plt.subplots(figsize=(9, 5.5))
    ax.barh(names, vals, color="#D97706")
    ax.set_xlabel("Mean feature importance (XGBoost feature_importances_)")
    ax.set_title("VARUNA meta-model feature importance (4 models averaged)")
    fig.tight_layout()
    out = REPORTS_DIR / "feature_importance.png"
    fig.savefig(out, dpi=140)
    plt.close(fig)


def build_replay(bundle: dict, df: pd.DataFrame) -> dict:
    season = "post_monsoon"
    sub = df[df["season"] == season].copy()
    if len(sub) == 0:
        REPLAY_TIMELINES.write_text(
            json.dumps({"timelines": {}, "note": "no post-monsoon rows available"}),
            encoding="utf-8",
        )
        return {"available": False, "rows": 0}

    predicted = predict_errors(bundle, sub)
    payload: dict = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "archived previous-runs forecasts (Open-Meteo) aligned with ERA5",
        "season": season,
        "window": list(BENCHMARK_WINDOWS[season]),
        "timelines": {},
    }
    rows = 0
    for region_id, rdf in sub.groupby("region_id"):
        payload["timelines"][region_id] = {}
        for lead, ldf in rdf.groupby("lead_time_hours"):
            ldf = ldf.sort_values("timestamp")
            times, members, weights, blend, reg_idx, reg_name = [], {}, [], [], [], []
            members = {m: [] for m in MODEL_KEYS}
            for idx in ldf.index:
                r = ldf.loc[idx]
                times.append(str(r["timestamp"]))
                errs = {m: float(predicted[m].loc[idx]) for m in MODEL_KEYS}
                w = weights_from_predicted_errors(errs)
                vals = {m: float(r[f"{m}_val"]) for m in MODEL_KEYS}
                for m in MODEL_KEYS:
                    members[m].append(vals[m])
                weights.append({m: w[m] for m in MODEL_KEYS})
                blend.append(round(blend_value(vals, w), 3))
                reg_idx.append(int(r["regime_index"]))
                reg_name.append(str(r["regime"]))
                rows += 1
            payload["timelines"][region_id][str(int(lead))] = {
                "times": times,
                "members": members,
                "weights": weights,
                "blend": blend,
                "regime_index": reg_idx,
                "regime": reg_name,
                "unit": VARIABLES["temperature"]["unit"],
                "variable": "temperature",
                "elevation_m": float(ldf["elevation_m"].iloc[0])
                if pd.notna(ldf["elevation_m"].iloc[0]) else None,
            }
    REPLAY_TIMELINES.parent.mkdir(parents=True, exist_ok=True)
    REPLAY_TIMELINES.write_text(json.dumps(payload), encoding="utf-8")
    return {"available": True, "rows": rows, "regions": list(payload["timelines"].keys())}


if __name__ == "__main__":
    run_pipeline()
