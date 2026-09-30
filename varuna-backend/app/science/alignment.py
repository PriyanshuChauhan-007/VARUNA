from __future__ import annotations

import math
from typing import Iterable

import pandas as pd

from ..config import (
    LEAD_TO_PREVIOUS_DAY,
    MODEL_KEYS,
    REGIONS,
    SPLIT_TRAIN,
    SPLIT_VAL,
    VARIABLES,
)
from ..providers.open_meteo import get_era5, get_previous_runs
from .regime import classify_regime

ALIGNED_COLUMNS = [
    "timestamp", "season", "region_id", "latitude", "longitude", "elevation_m",
    "variable", "lead_time_hours", "reference_val", "ensemble_mean",
    "ensemble_spread", "day_of_year", "hour_of_day", "month", "regime",
    "regime_index",
] + [
    c
    for m in MODEL_KEYS
    for c in (f"{m}_val", f"{m}_err", f"{m}_abs_err", f"{m}_sq_err")
]


def _ts_features(ts: str) -> dict:
    dt = pd.Timestamp(ts)
    return {
        "day_of_year": int(dt.dayofyear),
        "hour_of_day": int(dt.hour),
        "month": int(dt.month),
    }


def _num(v) -> float | None:
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if math.isnan(f):
        return None
    return f


def collect_window_rows(
    region_id: str,
    window: str,
    start_date: str,
    end_date: str,
    variables: Iterable[str],
    leads: Iterable[int],
) -> list[dict]:
    region = REGIONS[region_id]
    lat, lon = region["lat"], region["lon"]
    leads = list(leads)
    variables = list(variables)

    prev = get_previous_runs(lat, lon, start_date, end_date, leads=leads,
                             variables=list(dict.fromkeys(variables + ["temperature", "rainfall", "wind_speed", "pressure"])))
    era5 = get_era5(lat, lon, start_date, end_date, variables=variables)

    era5_index = {t: i for i, t in enumerate(era5["time"])}
    elevation = _num(prev.get("elevation_m")) if prev.get("elevation_m") is not None else _num(era5.get("elevation_m"))

    rows: list[dict] = []
    for i, ts in enumerate(prev["time"]):
        j = era5_index.get(ts)
        if j is None:
            continue
        feats = _ts_features(ts)

        for lead in leads:
            suffix = LEAD_TO_PREVIOUS_DAY[lead]
            ctx: dict[str, float | None] = {}
            for var in ("temperature", "rainfall", "wind_speed", "pressure"):
                field = f"{VARIABLES[var]['openmeteo']}_{suffix}"
                vals = [
                    _num(prev["models"].get(m, {}).get(field, [None] * len(prev["time"]))[i])
                    for m in MODEL_KEYS
                ]
                avail = [v for v in vals if v is not None]
                ctx[var] = (sum(avail) / len(avail)) if avail else None

            regime_index, regime_name = classify_regime(
                month=feats["month"], lat=lat, lon=lon,
                temperature_c=ctx["temperature"],
                pressure_hpa=ctx["pressure"],
                wind_kmh=ctx["wind_speed"],
                precip_mm=ctx["rainfall"],
            )

            for var in variables:
                field = f"{VARIABLES[var]['openmeteo']}_{suffix}"
                member_values: dict[str, float | None] = {}
                for m in MODEL_KEYS:
                    series = prev["models"].get(m, {}).get(field)
                    member_values[m] = _num(series[i]) if series else None

                if any(v is None for v in member_values.values()):
                    continue

                ref = _num(era5["values"].get(var, [None] * len(era5["time"]))[j])
                if ref is None:
                    continue

                vals = [member_values[m] for m in MODEL_KEYS]
                mean = sum(vals) / len(vals)
                spread = math.sqrt(sum((v - mean) ** 2 for v in vals) / len(vals))

                row = {
                    "timestamp": ts,
                    "season": window,
                    "region_id": region_id,
                    "latitude": lat,
                    "longitude": lon,
                    "elevation_m": elevation,
                    "variable": var,
                    "lead_time_hours": int(lead),
                    "reference_val": ref,
                    "ensemble_mean": mean,
                    "ensemble_spread": spread,
                    "regime": regime_name,
                    "regime_index": regime_index,
                    **feats,
                }
                for m in MODEL_KEYS:
                    err = member_values[m] - ref
                    row[f"{m}_val"] = member_values[m]
                    row[f"{m}_err"] = err
                    row[f"{m}_abs_err"] = abs(err)
                    row[f"{m}_sq_err"] = err * err
                rows.append(row)

    return rows


def collect_all_rows(
    region_ids: Iterable[str],
    windows: dict[str, tuple[str, str]],
    variables: Iterable[str] = ("temperature",),
    leads: Iterable[int] = (24, 48, 72, 120),
    progress: bool = False,
) -> pd.DataFrame:
    all_rows: list[dict] = []
    for region_id in region_ids:
        for window, (start, end) in windows.items():
            if progress:
                print(f"  fetching {region_id} / {window} ...", flush=True)
            try:
                all_rows.extend(
                    collect_window_rows(region_id, window, start, end, variables, leads)
                )
            except Exception as exc:
                print(f"  !! {region_id}/{window} failed: {exc}", flush=True)
    df = pd.DataFrame(all_rows, columns=ALIGNED_COLUMNS)
    if len(df):
        df = df.sort_values(["timestamp", "region_id", "lead_time_hours"]).reset_index(drop=True)
    return df


def split_partitions(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    if len(df) == 0:
        return df.copy(), df.copy(), df.copy()
    timestamps = sorted(df["timestamp"].unique())
    n = len(timestamps)
    train_end = int(n * SPLIT_TRAIN)
    val_end = train_end + int(n * SPLIT_VAL)
    train_ts = set(timestamps[:train_end])
    val_ts = set(timestamps[train_end:val_end])
    test_ts = set(timestamps[val_end:])
    return (
        df[df["timestamp"].isin(train_ts)].copy(),
        df[df["timestamp"].isin(val_ts)].copy(),
        df[df["timestamp"].isin(test_ts)].copy(),
    )
