from __future__ import annotations

import time
from typing import Any

import httpx

from ..config import (
    ARCHIVE_API,
    FORECAST_API,
    FORECAST_HORIZON_CAP_H,
    HTTP_RETRIES,
    HTTP_TIMEOUT_S,
    MODEL_IDS,
    PREVIOUS_RUNS_API,
    VARIABLE_KEYS,
    VARIABLES,
)
from .cache import CACHE

SLUG_TO_KEY = {slug: key for key, slug in MODEL_IDS.items()}


class ProviderError(RuntimeError):
    pass


def _http_get_json(url: str, params: dict[str, Any]) -> dict:
    last_exc: Exception | None = None
    delay = 1.0
    for attempt in range(HTTP_RETRIES):
        try:
            with httpx.Client(timeout=HTTP_TIMEOUT_S, follow_redirects=True) as client:
                resp = client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()
                if data.get("error"):
                    raise ProviderError(f"Open-Meteo error: {data.get('reason')}")
                return data
        except Exception as exc:
            last_exc = exc
            if attempt < HTTP_RETRIES - 1:
                time.sleep(delay)
                delay *= 2
    raise ProviderError(f"request failed after {HTTP_RETRIES} attempts: {last_exc}")


def _hourly_keys(payload: dict) -> dict[str, str]:
    return {k: k for k in (payload.get("hourly") or {}).keys() if k != "time"}


def _split_key(key: str) -> tuple[str, str | None]:
    for slug in SLUG_TO_KEY:
        if key.endswith("_" + slug):
            return key[: -(len(slug) + 1)], slug
    return key, None


def get_live_forecast(
    lat: float,
    lon: float,
    variables: list[str] | None = None,
    forecast_days: int = 7,
) -> tuple[dict, str]:
    forecast_days = max(1, min(forecast_days, FORECAST_HORIZON_CAP_H // 24))
    variables = variables or VARIABLE_KEYS
    hourly = ",".join(VARIABLES[v]["openmeteo"] for v in variables)
    cache_key = f"live|{lat:.4f}|{lon:.4f}|{hourly}|{forecast_days}"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": hourly,
        "models": ",".join(MODEL_IDS.values()),
        "forecast_days": forecast_days,
        "timezone": "GMT",
        "wind_speed_unit": "kmh",
    }

    fresh = CACHE.get(cache_key, kind="live")
    if fresh is not None:
        return fresh, "CACHED"

    try:
        raw = _http_get_json(FORECAST_API, params)
    except ProviderError:
        stale = CACHE.get_stale(cache_key)
        if stale is not None:
            return stale, "CACHED"
        raise

    hourly_obj = raw.get("hourly") or {}
    times = hourly_obj.get("time") or []
    out_models: dict[str, dict[str, list]] = {k: {} for k in MODEL_IDS}
    for key, series in hourly_obj.items():
        if key == "time":
            continue
        field, slug = _split_key(key)
        if slug is None:
            continue
        model_key = SLUG_TO_KEY.get(slug)
        var = _reverse_var(field)
        if model_key and var:
            out_models[model_key][var] = series

    result = {
        "time": times,
        "elevation_m": raw.get("elevation"),
        "models": out_models,
        "requested_coordinates": {"lat": lat, "lon": lon},
        "resolved_coordinates": {"lat": raw.get("latitude"), "lon": raw.get("longitude")},
    }
    CACHE.put(cache_key, result, kind="live")
    return result, "LIVE"


def _reverse_var(openmeteo_name: str) -> str | None:
    for vkey, meta in VARIABLES.items():
        if meta["openmeteo"] == openmeteo_name:
            return vkey
    return None


def get_previous_runs(
    lat: float,
    lon: float,
    start_date: str,
    end_date: str,
    leads: list[int],
    variables: list[str] | None = None,
) -> dict:
    from ..config import LEAD_TO_PREVIOUS_DAY

    variables = variables or VARIABLE_KEYS
    hourly_fields: list[str] = []
    for v in variables:
        base = VARIABLES[v]["openmeteo"]
        for lead in leads:
            suffix = LEAD_TO_PREVIOUS_DAY[lead]
            hourly_fields.append(f"{base}_{suffix}")
    cache_key = f"prevruns|{lat:.4f}|{lon:.4f}|{start_date}|{end_date}|{','.join(sorted(hourly_fields))}"
    cached = CACHE.get(cache_key, kind="archive")
    if cached is not None:
        return cached

    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": ",".join(hourly_fields),
        "models": ",".join(MODEL_IDS.values()),
        "timezone": "GMT",
        "wind_speed_unit": "kmh",
    }
    raw = _http_get_json(PREVIOUS_RUNS_API, params)
    hourly_obj = raw.get("hourly") or {}
    times = hourly_obj.get("time") or []
    out_models: dict[str, dict[str, list]] = {k: {} for k in MODEL_IDS}
    for key, series in hourly_obj.items():
        if key == "time":
            continue
        field, slug = _split_key(key)
        if slug is None:
            continue
        model_key = SLUG_TO_KEY.get(slug)
        if model_key:
            out_models[model_key][field] = series

    result = {
        "time": times,
        "elevation_m": raw.get("elevation"),
        "models": out_models,
        "requested_coordinates": {"lat": lat, "lon": lon},
        "resolved_coordinates": {"lat": raw.get("latitude"), "lon": raw.get("longitude")},
    }
    CACHE.put(cache_key, result, kind="archive")
    return result


def get_era5(
    lat: float,
    lon: float,
    start_date: str,
    end_date: str,
    variables: list[str] | None = None,
) -> dict:
    variables = variables or VARIABLE_KEYS
    hourly = ",".join(VARIABLES[v]["openmeteo"] for v in variables)
    cache_key = f"era5|{lat:.4f}|{lon:.4f}|{start_date}|{end_date}|{hourly}"
    cached = CACHE.get(cache_key, kind="archive")
    if cached is not None:
        return cached

    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": hourly,
        "models": "era5",
        "timezone": "GMT",
        "wind_speed_unit": "kmh",
    }
    raw = _http_get_json(ARCHIVE_API, params)
    hourly_obj = raw.get("hourly") or {}
    series_out: dict[str, list] = {}
    for key, series in hourly_obj.items():
        if key == "time":
            continue
        var = _reverse_var(key)
        if var:
            series_out[var] = series
    result = {
        "time": hourly_obj.get("time") or [],
        "elevation_m": raw.get("elevation"),
        "values": series_out,
        "requested_coordinates": {"lat": lat, "lon": lon},
        "resolved_coordinates": {"lat": raw.get("latitude"), "lon": raw.get("longitude")},
    }
    CACHE.put(cache_key, result, kind="archive")
    return result


def probe_provider(url: str, params: dict | None = None) -> dict:
    started = time.perf_counter()
    try:
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            resp = client.get(url, params=params or {"latitude": 28.61, "longitude": 77.21,
                                                     "hourly": "temperature_2m", "forecast_days": "1"})
            latency_ms = round((time.perf_counter() - started) * 1000, 1)
            return {"reachable": resp.status_code == 200, "http_status": resp.status_code,
                    "latency_ms": latency_ms, "checked_at": time.time()}
    except Exception as exc:
        latency_ms = round((time.perf_counter() - started) * 1000, 1)
        return {"reachable": False, "http_status": None, "latency_ms": latency_ms,
                "error": str(exc)[:200], "checked_at": time.time()}
