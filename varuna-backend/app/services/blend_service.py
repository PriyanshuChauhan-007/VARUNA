from __future__ import annotations

import json
import math
from datetime import datetime, timezone

import pandas as pd

from ..config import (
    ALIGNED_CSV,
    APP_VERSION,
    ATTRIBUTION,
    BLEND_TEST_CSV,
    FORECAST_HORIZON_CAP_H,
    HORIZON_NOTE,
    LEAD_TIMES,
    META_MODEL_PATH,
    MODEL_KEYS,
    PROVENANCE_JSON,
    REGIONS,
    REPLAY_TIMELINES,
    REPORTS_DIR,
    VARIABLES,
)
from ..providers.open_meteo import ProviderError, get_live_forecast, probe_provider, FORECAST_API, PREVIOUS_RUNS_API, ARCHIVE_API
from ..science.meta_model import (
    feature_importances,
    load_bundle,
    predict_errors_rows,
    predict_errors_single_row,
)
from ..science.regime import classify_regime
from ..science.weighting import blend_value, ensemble_stats, weights_from_predicted_errors

MODE_LIVE = "LIVE"
MODE_CACHED = "CACHED"
MODE_REPLAY = "REPLAY"


class ServiceUnavailable(RuntimeError):

    def __init__(self, message: str, mode_tried: list[str] | None = None):
        super().__init__(message)
        self.mode_tried = mode_tried or []


_bundle_cache: dict | None = None


def _bundle() -> dict | None:
    global _bundle_cache
    if _bundle_cache is None:
        _bundle_cache = load_bundle(META_MODEL_PATH)
    return _bundle_cache


def reset_bundle_cache() -> None:
    global _bundle_cache
    _bundle_cache = None


def _now_hour() -> datetime:
    return datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)


def _features(
    region: dict,
    ts: datetime,
    lead: int,
    regime_index: int,
    ens_mean: float | None,
    ens_spread: float | None,
    own: float | None,
    elevation: float | None,
) -> dict[str, float]:
    return {
        "latitude": float(region["lat"]),
        "longitude": float(region["lon"]),
        "elevation_m": float(elevation or 0.0),
        "lead_time_hours": float(lead),
        "day_of_year": float(ts.timetuple().tm_yday),
        "hour_of_day": float(ts.hour),
        "month": float(ts.month),
        "regime_index": float(regime_index),
        "ensemble_mean": float(ens_mean if ens_mean is not None else 0.0),
        "ensemble_spread": float(ens_spread if ens_spread is not None else 0.0),
        "model_own_forecast": float(own if own is not None else 0.0),
    }


def _weights_for(
    feats: dict[str, float],
    variable: str,
    member_values: dict[str, float | None],
    bundle: dict | None,
) -> tuple[dict[str, int], str, dict[str, float] | None, str | None]:
    available = {k: v for k, v in member_values.items() if v is not None}
    if not available:
        return {}, "none", None, "no_model_values_available"
    if bundle is not None and variable == "temperature" and bundle.get("variable") == "temperature":
        own = member_values
        preds: dict[str, float] = {}
        for key in available:
            f = dict(feats)
            f["model_own_forecast"] = float(available[key])
            preds[key] = predict_errors_single_row(bundle, f)[key]
        weights = weights_from_predicted_errors(preds)
        return weights, "adaptive_xgboost", preds, None
    weights = weights_from_predicted_errors({k: 1.0 for k in available})
    return weights, "equal_fallback_untrained", None, (
        "No meta-model trained for this variable yet; equal weights are used "
        "and skill is unvalidated."
    )


def _load_replay() -> dict:
    if not REPLAY_TIMELINES.exists():
        return {"timelines": {}}
    try:
        return json.loads(REPLAY_TIMELINES.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"timelines": {}}


def _acquire_live(region_id: str) -> tuple[dict, str]:
    region = REGIONS[region_id]
    tried: list[str] = []
    try:
        series, mode = get_live_forecast(region["lat"], region["lon"])
        return series, mode
    except ProviderError as exc:
        tried.append(f"live:{exc}")
    replay = _load_replay()
    if region_id in replay.get("timelines", {}):
        return {"__replay__": replay}, MODE_REPLAY
    raise ServiceUnavailable(
        "Forecast data unavailable: live provider unreachable, no cached copy, "
        "no replay archive for this region.",
        tried,
    )


def _replay_timeline(region_id: str, lead: int) -> tuple[dict, str]:
    replay = _load_replay()
    tl = replay.get("timelines", {}).get(region_id, {}).get(str(lead))
    if tl is None:
        raise ServiceUnavailable(
            "Forecast data unavailable: live provider unreachable and the "
            "replay archive has no timeline for this region/lead. Run the "
            "pipeline to build data/replay/timelines.json.",
            [MODE_REPLAY],
        )
    return {"__replay_timeline__": tl, "__replay_meta__": replay}, MODE_REPLAY


def _live_timeline(region_id: str, variable: str) -> dict:
    region = REGIONS[region_id]
    series, data_mode = _acquire_live(region_id)
    if data_mode == MODE_REPLAY:
        payload, mode = _replay_timeline(region_id, 48)
        return _replay_timeline_entries(region_id, variable, 48, payload, mode)

    now = _now_hour()
    times = series["time"]
    elevation = series.get("elevation_m")
    bundle = _bundle()

    rows: list[dict] = []
    last_regime = {"index": None, "name": None}

    start = 0
    for i, t in enumerate(times):
        dt = datetime.fromisoformat(t.replace("Z", "+00:00")).replace(tzinfo=timezone.utc)
        if dt >= now:
            start = i
            break

    for t in times[start:]:
        dt = datetime.fromisoformat(t.replace("Z", "+00:00")).replace(tzinfo=timezone.utc)
        lead = int((dt - now).total_seconds() // 3600)
        if lead > FORECAST_HORIZON_CAP_H:
            break
        idx = times.index(t)

        member_values: dict[str, float | None] = {}
        ctx_vals: dict[str, list[float]] = {"temperature": [], "rainfall": [], "wind_speed": [], "pressure": []}
        for key in MODEL_KEYS:
            model_vars = series["models"].get(key, {})
            member_values[key] = _num(model_vars.get(variable, [None] * len(times))[idx])
            for v in ctx_vals:
                val = _num(model_vars.get(v, [None] * len(times))[idx])
                if val is not None:
                    ctx_vals[v].append(val)

        ens_mean, ens_spread = ensemble_stats(member_values)

        def _ctx(v: str) -> float | None:
            return (sum(ctx_vals[v]) / len(ctx_vals[v])) if ctx_vals[v] else None

        regime_index, regime_name = classify_regime(
            month=dt.month, lat=region["lat"], lon=region["lon"],
            temperature_c=_ctx("temperature"), pressure_hpa=_ctx("pressure"),
            wind_kmh=_ctx("wind_speed"), precip_mm=_ctx("rainfall"),
        )
        last_regime = {"index": regime_index, "name": regime_name}
        rows.append({
            "time": t, "dt": dt, "lead": lead, "member_values": member_values,
            "ens_mean": ens_mean, "ens_spread": ens_spread,
            "regime_index": regime_index, "regime_name": regime_name,
        })

    if not rows:
        raise ServiceUnavailable("Live forecast returned no usable future hours.", ["live"])

    shared_rows: list[dict[str, float]] = []
    own: dict[str, list[float]] = {k: [] for k in MODEL_KEYS}
    for r in rows:
        dt = r["dt"]
        shared = _features(
            region, dt, r["lead"], r["regime_index"], r["ens_mean"],
            r["ens_spread"], 0.0, elevation,
        )
        shared.pop("model_own_forecast", None)
        shared_rows.append(shared)
        for key in MODEL_KEYS:
            v = r["member_values"][key]
            own[key].append(float(v if v is not None else (r["ens_mean"] or 0.0)))

    preds_rows: list[dict[str, float]] | None = None
    use_adaptive = (
        bundle is not None and variable == "temperature"
        and bundle.get("variable") == "temperature"
    )
    if use_adaptive:
        preds_rows = predict_errors_rows(bundle, shared_rows, own)

    entries = []
    worst_models_used = 4
    any_degraded = False
    schemes: set[str] = set()
    reasons: set[str] = set()

    for i, r in enumerate(rows):
        member_values = r["member_values"]
        ens_mean, ens_spread = r["ens_mean"], r["ens_spread"]
        models_used = sum(1 for v in member_values.values() if v is not None)
        degraded = models_used < 2
        worst_models_used = min(worst_models_used, models_used)
        any_degraded = any_degraded or degraded

        available = {k: v for k, v in member_values.items() if v is not None}
        if not available:
            weights, scheme, preds, reason = {}, "none", None, "no_model_values_available"
        elif preds_rows is not None:
            preds = {k: v for k, v in preds_rows[i].items() if k in available}
            weights = weights_from_predicted_errors(preds)
            scheme, reason = "adaptive_xgboost", None
        else:
            weights = weights_from_predicted_errors({k: 1.0 for k in available})
            scheme = "equal_fallback_untrained"
            preds = None
            reason = (
                "No meta-model trained for this variable yet; equal weights are "
                "used and skill is unvalidated."
            )
        schemes.add(scheme)
        if reason:
            reasons.add(reason)
        blend = blend_value(member_values, weights) if weights else None

        entries.append({
            "time": r["time"],
            "lead_time_hours": r["lead"],
            "models": {k: member_values[k] for k in MODEL_KEYS},
            "weights": weights,
            "blend": round(blend, 3) if blend is not None else None,
            "models_used": models_used,
            "degraded": degraded,
            "regime_index": r["regime_index"],
        })

    if not entries:
        raise ServiceUnavailable("Live forecast returned no usable future hours.", ["live"])

    return {
        "region_id": region_id,
        "variable": variable,
        "unit": VARIABLES[variable]["unit"],
        "data_mode": data_mode,
        "validated": (
            VARIABLES[variable]["validated"]
            and "adaptive_xgboost" in schemes
            and region.get("validated", False)
        ),
        "weighting_scheme": sorted(schemes)[0] if len(schemes) == 1 else "mixed",
        "weighting_reason": sorted(reasons)[0] if reasons else None,
        "regime": last_regime,
        "models_used": worst_models_used,
        "degraded": any_degraded,
        "timeline": entries,
        "horizon_note": HORIZON_NOTE,
        "attribution": ATTRIBUTION,
        "issued_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def _replay_timeline_entries(region_id: str, variable: str, lead: int,
                             payload: dict, data_mode: str) -> dict:
    region = REGIONS[region_id]
    tl = payload["__replay_timeline__"]
    meta = payload.get("__replay_meta__", {})
    if tl.get("variable") != variable:
        raise ServiceUnavailable(
            f"Replay archive only contains variable='temperature'; "
            f"'{variable}' is not available while the provider is offline.",
            [MODE_REPLAY],
        )
    bundle = _bundle()
    entries = []
    worst = 4
    any_degraded = False
    for i, t in enumerate(tl["times"]):
        member_values = {k: tl["members"][k][i] for k in MODEL_KEYS}
        models_used = sum(1 for v in member_values.values() if v is not None)
        degraded = models_used < 2
        worst = min(worst, models_used)
        any_degraded = any_degraded or degraded
        w = tl["weights"][i]
        entries.append({
            "time": t,
            "lead_time_hours": lead,
            "models": member_values,
            "weights": {k: int(w[k]) for k in MODEL_KEYS if k in w},
            "blend": tl["blend"][i],
            "models_used": models_used,
            "degraded": degraded,
            "regime_index": tl["regime_index"][i],
        })
    regime_name = tl["regime"][-1] if tl["regime"] else None
    regime_index = tl["regime_index"][-1] if tl["regime_index"] else None
    return {
        "region_id": region_id,
        "variable": variable,
        "unit": VARIABLES[variable]["unit"],
        "data_mode": data_mode,
        "validated": (
            VARIABLES[variable]["validated"]
            and region.get("validated", False)
        ),
        "weighting_scheme": "adaptive_xgboost" if bundle else "unknown",
        "regime": {"index": regime_index, "name": regime_name},
        "models_used": worst,
        "degraded": any_degraded,
        "timeline": entries,
        "horizon_note": (
            f"REPLAY: archived forecast cycle from window "
            f"{meta.get('window')} (season {meta.get('season')}), fixed "
            f"{lead} h lead. Not a current forecast."
        ),
        "attribution": ATTRIBUTION,
        "issued_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def _num(v):
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if math.isnan(f):
        return None
    return f


def forecast_payload(region_id: str, variable: str, lead_time_hours: int | None) -> dict:
    if region_id not in REGIONS:
        raise ServiceUnavailable(f"Unknown region '{region_id}'.")
    if variable not in VARIABLES:
        raise ServiceUnavailable(f"Unknown variable '{variable}'.")
    if lead_time_hours is not None and lead_time_hours > FORECAST_HORIZON_CAP_H:
        payload = _live_timeline(region_id, variable)
        payload["horizon_note"] = (
            f"Requested lead {lead_time_hours} h exceeds the {FORECAST_HORIZON_CAP_H} h "
            f"cap. {HORIZON_NOTE}"
        )
        payload["requested_lead_time_hours"] = lead_time_hours
        return payload

    if lead_time_hours in LEAD_TIMES:
        region = REGIONS[region_id]
        try:
            get_live_forecast(region["lat"], region["lon"])
        except ProviderError:
            payload, mode = _replay_timeline(region_id, lead_time_hours)
            return _replay_timeline_entries(region_id, variable, lead_time_hours, payload, mode)
    return _live_timeline(region_id, variable)


def weights_payload(region_id: str, variable: str, lead_time_hours: int) -> dict:
    if region_id not in REGIONS:
        raise ServiceUnavailable(f"Unknown region '{region_id}'.")
    if variable not in VARIABLES:
        raise ServiceUnavailable(f"Unknown variable '{variable}'.")
    region = REGIONS[region_id]
    bundle = _bundle()

    target = _now_hour()
    member_values: dict[str, float | None] = {}
    ctx_vals: dict[str, list[float]] = {"temperature": [], "rainfall": [], "wind_speed": [], "pressure": []}
    ts = target
    data_mode = MODE_LIVE
    try:
        series, data_mode = get_live_forecast(region["lat"], region["lon"])
        times = series["time"]
        target = _now_hour()
        idx = None
        for i, t in enumerate(times):
            dt = datetime.fromisoformat(t.replace("Z", "+00:00")).replace(tzinfo=timezone.utc)
            if dt >= target:
                idx = i + lead_time_hours if i + lead_time_hours < len(times) else None
                ts = target
                break
        if idx is None:
            raise ProviderError("lead beyond available forecast hours")
        for key in MODEL_KEYS:
            model_vars = series["models"].get(key, {})
            member_values[key] = _num(model_vars.get(variable, [None] * len(times))[idx])
            for v in ctx_vals:
                val = _num(model_vars.get(v, [None] * len(times))[idx])
                if val is not None:
                    ctx_vals[v].append(val)
        elevation = series.get("elevation_m")
        ts = datetime.fromisoformat(times[idx].replace("Z", "+00:00")).replace(tzinfo=timezone.utc)
    except ProviderError:
        if variable != "temperature":
            raise ServiceUnavailable(
                f"Replay archive only contains variable='temperature'; "
                f"'{variable}' is not available while the provider is offline.",
                [MODE_REPLAY],
            )
        payload, data_mode = _replay_timeline(region_id, lead_time_hours)
        tl = payload["__replay_timeline__"]
        i = len(tl["times"]) // 2
        member_values = {k: tl["members"][k][i] for k in MODEL_KEYS}
        ts = datetime.fromisoformat(tl["times"][i].replace("Z", "+00:00")).replace(tzinfo=timezone.utc)
        elevation = tl.get("elevation_m")
        regime_index = tl["regime_index"][i]
        regime_name = tl["regime"][i]
        def _ctx(v: str) -> float | None:
            return None
        ens_mean, ens_spread = ensemble_stats(member_values)
        feats = _features(region, ts, lead_time_hours, regime_index, ens_mean, ens_spread,
                          member_values.get(variable) or ens_mean, elevation)
        weights, scheme, preds, reason = _weights_for(feats, variable, member_values, bundle)
        return {
            "region_id": region_id,
            "variable": variable,
            "unit": VARIABLES[variable]["unit"],
            "lead_time_hours": lead_time_hours,
            "data_mode": data_mode,
            "validated": (
                VARIABLES[variable]["validated"]
                and region.get("validated", False)
            ),
            "regime": {"index": regime_index, "name": regime_name},
            "member_values": member_values,
            "predicted_errors": {k: round(v, 4) for k, v in preds.items()} if preds else None,
            "weights": weights,
            "weights_sum": sum(weights.values()),
            "weighting_scheme": scheme,
            "reason": reason,
            "attribution": ATTRIBUTION,
        }

    def _ctx(v: str) -> float | None:
        return (sum(ctx_vals[v]) / len(ctx_vals[v])) if ctx_vals[v] else None

    regime_index, regime_name = classify_regime(
        month=ts.month, lat=region["lat"], lon=region["lon"],
        temperature_c=_ctx("temperature"), pressure_hpa=_ctx("pressure"),
        wind_kmh=_ctx("wind_speed"), precip_mm=_ctx("rainfall"),
    )
    ens_mean, ens_spread = ensemble_stats(member_values)
    feats = _features(region, ts, lead_time_hours, regime_index, ens_mean, ens_spread,
                      member_values.get(variable) or ens_mean, elevation)
    weights, scheme, preds, reason = _weights_for(feats, variable, member_values, bundle)
    del target
    return {
        "region_id": region_id,
        "variable": variable,
        "unit": VARIABLES[variable]["unit"],
        "lead_time_hours": lead_time_hours,
        "data_mode": data_mode,
        "validated": (
            VARIABLES[variable]["validated"]
            and scheme == "adaptive_xgboost"
            and region.get("validated", False)
        ),
        "regime": {"index": regime_index, "name": regime_name},
        "member_values": member_values,
        "predicted_errors": {k: round(v, 4) for k, v in preds.items()} if preds else None,
        "weights": weights,
        "weights_sum": sum(weights.values()),
        "weighting_scheme": scheme,
        "reason": reason,
        "attribution": ATTRIBUTION,
    }


def extremes_payload(region_id: str, lead_time_hours: int, simulate: bool = False) -> dict:
    from ..config import EXTREME_THRESHOLDS as TH

    if region_id not in REGIONS:
        raise ServiceUnavailable(f"Unknown region '{region_id}'.")

    temps = _live_timeline(region_id, "temperature")
    winds = _live_timeline(region_id, "wind_speed")
    rains = _live_timeline(region_id, "rainfall")

    def _window(payloads: list[dict], lead: int) -> tuple[int, dict[str, list]]:
        idx = None
        for i, e in enumerate(temps["timeline"]):
            if e["lead_time_hours"] >= lead:
                idx = i
                break
        if idx is None:
            idx = len(temps["timeline"]) - 1
        lo = max(0, idx - 23)
        return idx, {"temperature": [temps["timeline"][j]["blend"] for j in range(lo, idx + 1)],
                     "wind_speed": [winds["timeline"][j]["blend"] for j in range(lo, idx + 1)],
                     "rainfall": [rains["timeline"][j]["blend"] for j in range(lo, idx + 1)]}

    idx, win = _window([temps, winds, rains], lead_time_hours)
    valid = lambda vals: [v for v in vals if v is not None]

    rain24 = sum(valid(win["rainfall"]))
    temp_max = max(valid(win["temperature"])) if valid(win["temperature"]) else None
    wind_max = max(valid(win["wind_speed"])) if valid(win["wind_speed"]) else None

    checks: list[dict] = []
    alerts: list[dict] = []

    def _add(hazard: str, label: str, value, unit: str, threshold: float,
             threshold_label: str, severity: str, validated: bool, crossed: bool):
        check = {
            "hazard": hazard, "label": label, "value": value, "unit": unit,
            "threshold": threshold, "threshold_label": threshold_label,
            "crossed": crossed, "severity": severity, "validated": validated,
        }
        checks.append(check)
        if crossed:
            alerts.append(dict(check))

    very_heavy = rain24 >= TH["very_heavy_rain_mm_24h"]
    gale = wind_max is not None and wind_max >= TH["wind_gale_kmh"]

    _add("heavy_rain", "Heavy Rainfall", round(rain24, 1), "mm/24h",
         TH["very_heavy_rain_mm_24h"] if very_heavy else TH["heavy_rain_mm_24h"],
         ("IMD Very Heavy Rain >= 115.6 mm/24h" if very_heavy
          else "IMD Heavy Rain >= 64.5 mm/24h"),
         "very_heavy" if very_heavy else "heavy", False,
         rain24 >= TH["heavy_rain_mm_24h"])
    _add("heatwave", "Heatwave", round(temp_max, 1) if temp_max is not None else None,
         "\u00b0C", TH["heatwave_c"], "IMD Heatwave daily max >= 45.0 \u00b0C",
         "heatwave", True,
         temp_max is not None and temp_max >= TH["heatwave_c"])
    _add("wind_squall", "Squally Winds", round(wind_max, 1) if wind_max is not None else None,
         "km/h", TH["wind_gale_kmh"] if gale else TH["wind_squall_kmh"],
         ("IMD Gale >= 62 km/h" if gale else "IMD Squally weather >= 55 km/h"),
         "gale" if gale else "squall", False,
         wind_max is not None and wind_max >= TH["wind_squall_kmh"])

    data_mode = temps["data_mode"]
    return {
        "region_id": region_id,
        "lead_time_hours": lead_time_hours,
        "data_mode": data_mode,
        "status": "alerts" if alerts else "no_alerts",
        "alerts": alerts,
        "checks": checks,
        "window_hours": min(24, idx + 1),
        "evaluated_blend_time": temps["timeline"][idx]["time"],
        "validated": {"temperature": True, "rainfall": False, "wind_speed": False},
        "simulated": bool(simulate),
        "simulate_note": (
            "simulate=true: values are illustrative recombinations, not a "
            "live alert decision." if simulate else None
        ),
        "note": (
            "Thresholds: rainfall 64.5 mm heavy / 115.6 mm very heavy (24 h "
            "accumulation), heatwave 45.0 C, wind squall 55 km/h / gale 62 "
            "km/h. Alerts fire only when the blended forecast crosses a "
            "threshold. Rainfall and wind skill are unvalidated (temperature "
            "only is benchmarked)."
        ),
        "attribution": ATTRIBUTION,
    }


def explain_payload(region_id: str, variable: str, lead_time_hours: int) -> dict:
    w = weights_payload(region_id, variable, lead_time_hours)
    bundle = _bundle()
    if bundle is None:
        return {
            **w,
            "feature_importances": [],
            "model_available": False,
            "model_note": "Meta-model not trained yet. Run scripts/run_pipeline.py.",
        }
    imps = feature_importances(bundle)
    return {
        **w,
        "model_available": True,
        "feature_importances": [
            {"feature": d["feature"], "importance": round(d["importance"], 5),
             "share": round(d["share"], 5)}
            for d in imps
        ],
        "model_metadata": {
            "variable": bundle.get("variable"),
            "trained_at": bundle.get("metadata", {}).get("trained_at"),
            "n_train_rows": bundle.get("metadata", {}).get("n_train_rows"),
            "xgb_params": bundle.get("metadata", {}).get("xgb_params"),
            "feature_names": bundle.get("feature_names"),
        },
    }


def skill_payload() -> dict:
    if not BLEND_TEST_CSV.exists():
        return {
            "available": False,
            "reason": "pipeline_not_run",
            "message": (
                "No held-out results found. Run: python scripts/run_pipeline.py"
            ),
        }
    headline = pd.read_csv(BLEND_TEST_CSV)
    def _read(name: str) -> list[dict]:
        p = REPORTS_DIR / name
        if not p.exists():
            return []
        df = pd.read_csv(p)
        return json.loads(df.to_json(orient="records"))

    return {
        "available": True,
        "headline": {
            "scope": "held_out_test",
            "rows": json.loads(headline.to_json(orient="records")),
        },
        "by_lead": {"scope": "full_dataset_all_splits", "rows": _read("skill_by_lead.csv")},
        "by_season": {"scope": "full_dataset_all_splits", "rows": _read("skill_by_season.csv")},
        "by_region": {"scope": "full_dataset_all_splits", "rows": _read("skill_by_region.csv")},
        "reference": "ERA5 reanalysis (not station observations, not ground truth)",
        "caveat": (
            "Held-out test covers only the chronologically last season "
            "(Post-Monsoon). Full-dataset tables are clearly scoped and are "
            "not headline skill."
        ),
        "attribution": ATTRIBUTION,
    }


def providers_status_payload() -> dict:
    probes = {
        "open_meteo_forecast": probe_provider(FORECAST_API),
        "open_meteo_previous_runs": probe_provider(PREVIOUS_RUNS_API),
        "open_meteo_archive_era5": probe_provider(ARCHIVE_API),
    }
    provenance = None
    if PROVENANCE_JSON.exists():
        try:
            provenance = json.loads(PROVENANCE_JSON.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            provenance = {"error": "provenance.json unreadable"}
    artifacts = {
        "provenance_json": PROVENANCE_JSON.exists(),
        "blend_test_results_csv": BLEND_TEST_CSV.exists(),
        "aligned_csv": ALIGNED_CSV.exists(),
        "meta_model_joblib": META_MODEL_PATH.exists(),
        "replay_timelines_json": REPLAY_TIMELINES.exists(),
        "feature_importance_png": (REPORTS_DIR / "feature_importance.png").exists(),
        "adaptive_weights_csv": (REPORTS_DIR / "adaptive_weights.csv").exists(),
    }
    return {
        "providers": probes,
        "artifacts": artifacts,
        "provenance": provenance,
        "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "attribution": ATTRIBUTION,
    }


def regions_payload() -> list[dict]:
    return [
        {
            "id": rid,
            "name": r["name"],
            "state": r["state"],
            "zone": r["zone"],
            "lat": r["lat"],
            "lon": r["lon"],
            "validated": r["validated"],
            "benchmarked": r["benchmarked"],
        }
        for rid, r in REGIONS.items()
    ]


def health_payload() -> dict:
    return {
        "status": "ok",
        "version": APP_VERSION,
        "time": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "model_bundle_loaded": _bundle() is not None,
    }
