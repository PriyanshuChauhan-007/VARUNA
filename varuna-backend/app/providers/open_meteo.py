from __future__ import annotations

import logging
import threading
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

from urllib.parse import urlparse

logger = logging.getLogger("varuna.provider")

SLUG_TO_KEY = {slug: key for key, slug in MODEL_IDS.items()}

# Circuit breaker / rate-limit cooldown tracking per endpoint host
_cooldown_lock = threading.Lock()
_rate_limits: dict[str, float] = {}  # host/target_key -> timestamp
_last_retry_after: dict[str, float] = {}

# Single-flight / deduplication locks per cache key
_inflight_locks: dict[str, threading.Lock] = {}
_inflight_global_lock = threading.Lock()


def _get_target_key(url: str | None) -> str:
    if not url:
        return "api.open-meteo.com"
    try:
        parsed = urlparse(url)
        return parsed.netloc or url
    except Exception:
        return url


def is_rate_limited(url: str | None = None) -> tuple[bool, float]:
    """Check if upstream provider is currently in rate-limit cooldown.

    Returns:
        (is_limited, seconds_remaining)
    """
    key = _get_target_key(url)
    with _cooldown_lock:
        remaining = _rate_limits.get(key, 0.0) - time.time()
        return (remaining > 0, max(0.0, remaining))


def set_rate_limited(cooldown_seconds: float, url: str | None = None) -> None:
    """Set the provider cooldown duration for an endpoint host."""
    key = _get_target_key(url)
    with _cooldown_lock:
        _rate_limits[key] = max(_rate_limits.get(key, 0.0), time.time() + cooldown_seconds)
        _last_retry_after[key] = cooldown_seconds


def reset_rate_limit(url: str | None = None) -> None:
    """Reset the provider cooldown state (primarily for tests)."""
    with _cooldown_lock:
        if url:
            key = _get_target_key(url)
            _rate_limits.pop(key, None)
            _last_retry_after.pop(key, None)
        else:
            _rate_limits.clear()
            _last_retry_after.clear()


def _get_key_lock(key: str) -> threading.Lock:
    """Get or create a mutex for an in-flight cache key to coalesce concurrent requests."""
    with _inflight_global_lock:
        if key not in _inflight_locks:
            if len(_inflight_locks) > 256:
                _inflight_locks.clear()
            _inflight_locks[key] = threading.Lock()
        return _inflight_locks[key]


class ProviderError(RuntimeError):
    """Raised when the upstream provider request fails.

    Attributes:
        http_status: The HTTP status code if available (e.g. 429), else None.
        provider_reason: Short machine-readable reason string.
    """

    def __init__(self, message: str, *, http_status: int | None = None,
                 provider_reason: str | None = None):
        super().__init__(message)
        self.http_status = http_status
        self.provider_reason = provider_reason


def _safe_params_summary(params: dict[str, Any]) -> dict[str, str]:
    """Return a redacted summary of request params safe for logging."""
    safe = {}
    for k, v in params.items():
        if k in ("latitude", "longitude", "forecast_days", "timezone",
                 "wind_speed_unit", "hourly", "models"):
            safe[k] = str(v)[:200]
    return safe


def _http_get_json(url: str, params: dict[str, Any]) -> dict:
    # Fail fast if provider is in active rate-limit cooldown
    limited, remaining = is_rate_limited(url)
    if limited:
        msg = f"Open-Meteo rate limit active for {url} (cooldown remaining: {remaining:.1f}s)"
        logger.warning(msg)
        raise ProviderError(msg, http_status=429, provider_reason="rate_limited")

    last_exc: Exception | None = None
    last_status: int | None = None
    last_reason: str | None = None
    delay = 1.0
    for attempt in range(HTTP_RETRIES):
        # Re-check cooldown before each attempt
        limited, remaining = is_rate_limited(url)
        if limited:
            msg = f"Open-Meteo rate limit active for {url} (cooldown remaining: {remaining:.1f}s)"
            raise ProviderError(msg, http_status=429, provider_reason="rate_limited")

        try:
            with httpx.Client(timeout=HTTP_TIMEOUT_S, follow_redirects=True) as client:
                resp = client.get(url, params=params)
                if resp.status_code == 429:
                    last_status = 429
                    last_reason = "rate_limited"
                    retry_after_str = resp.headers.get("retry-after")
                    cooldown = 60.0
                    if retry_after_str:
                        try:
                            cooldown = max(float(retry_after_str), 1.0)
                        except (ValueError, TypeError):
                            cooldown = 60.0
                    set_rate_limited(cooldown, url)
                    logger.warning(
                        "Open-Meteo 429 rate-limited (attempt %d/%d, "
                        "retry-after=%s, cooldown=%.1fs, params=%s)",
                        attempt + 1, HTTP_RETRIES, retry_after_str, cooldown,
                        _safe_params_summary(params),
                    )
                    last_exc = httpx.HTTPStatusError(
                        "429 Too Many Requests",
                        request=resp.request, response=resp,
                    )
                    # If cooldown is substantial, do not hammer upstream with retries
                    if cooldown > 2.0 or attempt >= HTTP_RETRIES - 1:
                        raise ProviderError(
                            f"Open-Meteo rate-limited (HTTP 429, retry-after={retry_after_str})",
                            http_status=429,
                            provider_reason="rate_limited",
                        )
                    time.sleep(cooldown)
                    continue

                resp.raise_for_status()
                data = resp.json()
                if data.get("error"):
                    raise ProviderError(
                        f"Open-Meteo error: {data.get('reason')}",
                        provider_reason=data.get("reason"),
                    )
                return data
        except ProviderError:
            raise
        except (httpx.ConnectError, httpx.NetworkError) as exc:
            last_exc = exc
            last_status = None
            last_reason = "connection_error"
            logger.warning(
                "Open-Meteo connection failure (attempt %d/%d, type=%s, params=%s)",
                attempt + 1, HTTP_RETRIES, type(exc).__name__,
                _safe_params_summary(params),
            )
        except httpx.TimeoutException as exc:
            last_exc = exc
            last_status = None
            last_reason = "timeout"
            logger.warning(
                "Open-Meteo timeout (attempt %d/%d, type=%s, params=%s)",
                attempt + 1, HTTP_RETRIES, type(exc).__name__,
                _safe_params_summary(params),
            )
        except httpx.HTTPStatusError as exc:
            last_exc = exc
            last_status = exc.response.status_code if exc.response else None
            last_reason = f"http_{last_status}"
            logger.warning(
                "Open-Meteo HTTP %s (attempt %d/%d, params=%s)",
                last_status, attempt + 1, HTTP_RETRIES,
                _safe_params_summary(params),
            )
        except Exception as exc:
            last_exc = exc
            last_reason = type(exc).__name__
            logger.warning(
                "Open-Meteo %s (attempt %d/%d): %s",
                type(exc).__name__, attempt + 1, HTTP_RETRIES, str(exc)[:300],
            )
        if attempt < HTTP_RETRIES - 1:
            time.sleep(delay)
            delay *= 2

    detail = (
        f"request failed after {HTTP_RETRIES} attempts: "
        f"last_status={last_status}, reason={last_reason}, "
        f"exception={type(last_exc).__name__}: {str(last_exc)[:300]}"
    )
    logger.error("Open-Meteo provider unavailable: %s", detail)
    raise ProviderError(detail, http_status=last_status, provider_reason=last_reason)


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
    forecast_days: int = 8,
) -> tuple[dict, str]:
    # 8 forecast days are required to guarantee a full 168h lead horizon from any hour of the day
    forecast_days = max(1, min(forecast_days, 8))
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

    key_lock = _get_key_lock(cache_key)
    with key_lock:
        # Double-check cache in case a concurrent thread just fetched and cached it
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

    key_lock = _get_key_lock(cache_key)
    with key_lock:
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

    key_lock = _get_key_lock(cache_key)
    with key_lock:
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


_probe_cache: dict[str, tuple[float, dict]] = {}
_probe_lock = threading.Lock()
PROBE_CACHE_TTL_S = 60.0


def reset_probe_cache() -> None:
    """Reset the cached probe responses (primarily for testing)."""
    with _probe_lock:
        _probe_cache.clear()


def probe_provider(url: str, params: dict | None = None, force: bool = False) -> dict:
    """Probe a provider URL. Returns reachability info.

    Caches results for PROBE_CACHE_TTL_S to keep probe lightweight and avoid rate limits.
    For the forecast API specifically, uses the real multi-model request shape
    (with forecast_days=1 to minimise data) so that a successful probe proves
    the actual forecast request will also work.
    """
    now = time.time()
    if not force:
        with _probe_lock:
            cached_entry = _probe_cache.get(url)
            if cached_entry:
                fetched_at, cached_res = cached_entry
                if now - fetched_at < PROBE_CACHE_TTL_S:
                    return dict(cached_res)

    # If this endpoint is in active rate-limit cooldown,
    # report rate-limiting truthfully without hammering upstream.
    limited, remaining = is_rate_limited(url)
    if limited and not force:
        result = {
            "reachable": False,
            "http_status": 429,
            "latency_ms": 0.0,
            "reason": "rate_limited",
            "retry_after": str(round(remaining, 1)),
            "checked_at": now,
        }
        return result

    started = time.perf_counter()
    if params is None:
        if "forecast" in url and "archive" not in url and "previous" not in url:
            # Use real multi-model params so a 429 here surfaces truthfully
            hourly = ",".join(VARIABLES[v]["openmeteo"] for v in VARIABLE_KEYS)
            params = {
                "latitude": 28.61,
                "longitude": 77.21,
                "hourly": hourly,
                "models": ",".join(MODEL_IDS.values()),
                "forecast_days": "1",
                "timezone": "GMT",
                "wind_speed_unit": "kmh",
            }
        elif "previous" in url:
            params = {
                "latitude": 28.61,
                "longitude": 77.21,
                "start_date": "2024-01-01",
                "end_date": "2024-01-02",
                "hourly": "temperature_2m_previous_day1",
                "models": "ecmwf_ifs025",
            }
        elif "archive" in url:
            params = {
                "latitude": 28.61,
                "longitude": 77.21,
                "start_date": "2024-01-01",
                "end_date": "2024-01-02",
                "hourly": "temperature_2m",
                "models": "era5",
            }
        else:
            params = {
                "latitude": 28.61, "longitude": 77.21,
                "hourly": "temperature_2m", "forecast_days": "1",
            }
    try:
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            resp = client.get(url, params=params)
            latency_ms = round((time.perf_counter() - started) * 1000, 1)
            result = {
                "reachable": resp.status_code == 200,
                "http_status": resp.status_code,
                "latency_ms": latency_ms,
                "checked_at": time.time(),
            }
            if resp.status_code == 429:
                result["reason"] = "rate_limited"
                retry_hdr = resp.headers.get("retry-after")
                result["retry_after"] = retry_hdr
                cd = 60.0
                if retry_hdr:
                    try:
                        cd = max(float(retry_hdr), 1.0)
                    except (ValueError, TypeError):
                        cd = 60.0
                set_rate_limited(cd, url)
            with _probe_lock:
                _probe_cache[url] = (time.time(), result)
            return result
    except Exception as exc:
        latency_ms = round((time.perf_counter() - started) * 1000, 1)
        err_type = type(exc).__name__
        reason = (
            "timeout"
            if isinstance(exc, httpx.TimeoutException)
            else ("connection_error" if isinstance(exc, (httpx.ConnectError, httpx.NetworkError)) else err_type)
        )
        result = {
            "reachable": False,
            "http_status": None,
            "latency_ms": latency_ms,
            "error": str(exc)[:200],
            "error_type": err_type,
            "reason": reason,
            "checked_at": time.time(),
        }
        with _probe_lock:
            _probe_cache[url] = (time.time(), result)
        return result

