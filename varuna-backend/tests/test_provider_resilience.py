from __future__ import annotations

import threading
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import LEAD_TIMES, MODEL_KEYS, REGIONS, VARIABLE_KEYS, VARIABLES
from app.main import app
from app.providers.cache import CACHE
from app.providers.open_meteo import (
    ARCHIVE_API,
    FORECAST_API,
    PREVIOUS_RUNS_API,
    ProviderError,
    _http_get_json,
    get_live_forecast,
    is_rate_limited,
    probe_provider,
    reset_probe_cache,
    reset_rate_limit,
    set_rate_limited,
)
from app.services.blend_service import ServiceUnavailable, forecast_payload


@pytest.fixture(autouse=True)
def clean_state():
    """Reset rate-limit circuit breaker, probe cache, and database cache before each test."""
    reset_rate_limit()
    reset_probe_cache()
    CACHE.clear()
    yield
    reset_rate_limit()
    reset_probe_cache()
    CACHE.clear()


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app, raise_server_exceptions=False)


def make_provider_mock(handler):
    """Wraps an httpx.Client.get handler so Starlette TestClient calls are untouched."""
    orig_get = httpx.Client.get

    def _mock_get(self, url, *args, **kwargs):
        url_str = str(url)
        if url_str.startswith("http://testserver") or url_str.startswith("/"):
            return orig_get(self, url, *args, **kwargs)
        return handler(url_str, *args, **kwargs)

    return _mock_get


def make_raw_open_meteo_payload(n_hours: int = 96) -> dict:
    """Construct a mock raw Open-Meteo JSON payload with all models and variables."""
    start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    times = [(start + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M") for i in range(n_hours)]
    hourly: dict[str, list] = {"time": times}

    var_mapping = {
        "temperature": "temperature_2m",
        "rainfall": "precipitation",
        "wind_speed": "wind_speed_10m",
        "pressure": "surface_pressure",
    }
    slugs = {
        "ecmwf_ifs": "ecmwf_ifs025",
        "ecmwf_aifs": "ecmwf_aifs025_single",
        "ncep_gfs": "gfs_seamless",
        "dwd_icon": "icon_seamless",
    }

    for mi, (mkey, slug) in enumerate(slugs.items()):
        for vi, (vkey, om_name) in enumerate(var_mapping.items()):
            field = f"{om_name}_{slug}"
            vals = []
            for i in range(n_hours):
                val = 22.0 + mi + vi + (i % 5) * 0.5
                if vkey == "rainfall":
                    val = (i % 7) * 2.0 + mi
                elif vkey == "wind_speed":
                    val = 15.0 + mi * 3.0 + (i % 4)
                elif vkey == "pressure":
                    val = 1012.0 - mi * 2.0
                vals.append(val)
            hourly[field] = vals

    return {
        "latitude": 28.6139,
        "longitude": 77.2090,
        "elevation": 216.0,
        "hourly": hourly,
    }


# =========================================================================
# 1. HTTP 200 Mock Tests: All 4 variables, truthful LIVE and CACHED modes
# =========================================================================

def test_200_all_four_variables_and_single_upstream_call():
    """Verify that all four variables succeed, return LIVE, and make only 1 upstream call."""
    mock_payload = make_raw_open_meteo_payload()
    call_count = 0

    def mock_get(url, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = mock_payload
        resp.raise_for_status.return_value = None
        return resp

    with patch.object(httpx.Client, "get", new=make_provider_mock(mock_get)):
        # 1st call for temperature: hits provider
        p_temp = forecast_payload("delhi_ncr", "temperature", 48)
        assert p_temp["data_mode"] == "LIVE"
        assert p_temp["variable"] == "temperature"
        assert len(p_temp["timeline"]) > 0
        assert call_count == 1

        # 2nd call for rainfall: must reuse cache, no 2nd provider call!
        p_rain = forecast_payload("delhi_ncr", "rainfall", 48)
        assert p_rain["data_mode"] == "CACHED"
        assert p_rain["variable"] == "rainfall"
        assert len(p_rain["timeline"]) > 0
        assert call_count == 1

        # 3rd call for wind_speed: must reuse cache
        p_wind = forecast_payload("delhi_ncr", "wind_speed", 48)
        assert p_wind["data_mode"] == "CACHED"
        assert p_wind["variable"] == "wind_speed"
        assert len(p_wind["timeline"]) > 0
        assert call_count == 1

        # 4th call for pressure: must reuse cache
        p_pres = forecast_payload("delhi_ncr", "pressure", 48)
        assert p_pres["data_mode"] == "CACHED"
        assert p_pres["variable"] == "pressure"
        assert len(p_pres["timeline"]) > 0
        assert call_count == 1


def test_concurrent_duplicate_requests_coalesced():
    """Verify that concurrent requests for the same cache key make only 1 upstream request."""
    mock_payload = make_raw_open_meteo_payload()
    call_count = 0
    call_lock = threading.Lock()

    def slow_get(url, *args, **kwargs):
        nonlocal call_count
        with call_lock:
            call_count += 1
        time.sleep(0.08)  # simulate network latency
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = mock_payload
        resp.raise_for_status.return_value = None
        return resp

    results = []
    threads = []

    def worker():
        res, mode = get_live_forecast(28.6139, 77.2090)
        results.append((res, mode))

    with patch.object(httpx.Client, "get", new=make_provider_mock(slow_get)):
        for _ in range(5):
            t = threading.Thread(target=worker)
            threads.append(t)
            t.start()
        for t in threads:
            t.join()

    assert len(results) == 5
    assert call_count == 1
    modes = [m for _, m in results]
    assert "LIVE" in modes
    assert modes.count("CACHED") >= 1


# =========================================================================
# 2. HTTP 429 Mock Tests: Circuit breaker, backoff, no hammering
# =========================================================================

def test_429_circuit_breaker_sets_cooldown_and_prevents_hammering():
    """Verify 429 honors Retry-After, activates circuit breaker cooldown, and avoids hammering."""
    call_count = 0

    def mock_429(url, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        resp = MagicMock()
        resp.status_code = 429
        resp.headers = {"retry-after": "45"}
        resp.request = MagicMock()
        return resp

    with patch.object(httpx.Client, "get", new=make_provider_mock(mock_429)):
        # Initial call fails with ProviderError(429, rate_limited)
        with pytest.raises(ProviderError) as exc_info:
            _http_get_json(FORECAST_API, {"test": "1"})

        assert exc_info.value.http_status == 429
        assert exc_info.value.provider_reason == "rate_limited"
        assert call_count == 1  # Did NOT retry 3 times in a tight loop!

        # Provider cooldown is now active
        limited, remaining = is_rate_limited()
        assert limited is True
        assert 40.0 <= remaining <= 45.0

        # Subsequent call immediately fails without touching network
        with pytest.raises(ProviderError) as exc_info2:
            _http_get_json(FORECAST_API, {"test": "2"})

        assert exc_info2.value.http_status == 429
        assert exc_info2.value.provider_reason == "rate_limited"
        assert call_count == 1  # Upstream was NOT called again


def test_429_fallback_semantics_temperature_vs_other_variables(client):
    """Verify temperature falls back to REPLAY, while rainfall/wind/pressure return 503 (never REPLAY)."""
    def mock_429(url, *args, **kwargs):
        resp = MagicMock()
        resp.status_code = 429
        resp.headers = {"retry-after": "60"}
        resp.request = MagicMock()
        return resp

    with patch.object(httpx.Client, "get", new=make_provider_mock(mock_429)):
        # 1. Temperature: falls back to REPLAY archive
        r_temp = client.get("/api/forecast?region=delhi_ncr&variable=temperature&lead_time_hours=48")
        assert r_temp.status_code == 200
        data_temp = r_temp.json()
        assert data_temp["data_mode"] == "REPLAY"
        assert data_temp["variable"] == "temperature"

        # 2. Rainfall: REPLAY does NOT contain rainfall, must return 503 with rate-limited diagnostic
        r_rain = client.get("/api/forecast?region=delhi_ncr&variable=rainfall&lead_time_hours=48")
        assert r_rain.status_code == 503
        data_rain = r_rain.json()
        assert data_rain["available"] is False
        assert data_rain["data_mode"] is None
        assert data_rain["provider_http_status"] == 429
        assert data_rain["provider_reason"] == "rate_limited"
        assert "429" in data_rain.get("diagnostic", "") or "rate limit" in data_rain.get("diagnostic", "").lower()

        # 3. Wind speed: must return 503, never REPLAY
        r_wind = client.get("/api/forecast?region=delhi_ncr&variable=wind_speed&lead_time_hours=48")
        assert r_wind.status_code == 503
        data_wind = r_wind.json()
        assert data_wind["provider_http_status"] == 429
        assert data_wind["data_mode"] is None

        # 4. Pressure: must return 503, never REPLAY
        r_pres = client.get("/api/forecast?region=delhi_ncr&variable=pressure&lead_time_hours=48")
        assert r_pres.status_code == 503
        data_pres = r_pres.json()
        assert data_pres["provider_http_status"] == 429
        assert data_pres["data_mode"] is None


# =========================================================================
# 3. Stale Cache Fallback Tests
# =========================================================================

def test_stale_cache_fallback_when_provider_returns_429():
    """Verify that when stale cache exists (>30 min old) and provider 429s, all variables succeed with CACHED."""
    # First, populate cache with valid data
    mock_payload = make_raw_open_meteo_payload()

    def mock_success(url, *args, **kwargs):
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = mock_payload
        resp.raise_for_status.return_value = None
        return resp

    with patch.object(httpx.Client, "get", new=make_provider_mock(mock_success)):
        series, mode = get_live_forecast(28.6139, 77.2090)
        assert mode == "LIVE"

    # Age the cache row in SQLite to make it stale (> 30 minutes)
    CACHE.conn.execute("UPDATE cache SET fetched_at = ?", (time.time() - 3600,))
    CACHE.conn.commit()

    # Now provider returns 429
    def mock_429(url, *args, **kwargs):
        resp = MagicMock()
        resp.status_code = 429
        resp.headers = {"retry-after": "60"}
        resp.request = MagicMock()
        return resp

    with patch.object(httpx.Client, "get", new=make_provider_mock(mock_429)):
        # Stale cache fallback: must return CACHED for all variables
        for var in VARIABLE_KEYS:
            res = forecast_payload("delhi_ncr", var, 48)
            assert res["data_mode"] == "CACHED"
            assert res["variable"] == var
            assert len(res["timeline"]) > 0


# =========================================================================
# 4. Timeout and Connection Failure Tests
# =========================================================================

def test_timeout_distinguishable_from_429_and_produces_diagnostic(client):
    """Verify httpx.TimeoutException produces provider_reason='timeout' and proper diagnostic."""
    def mock_timeout(url, *args, **kwargs):
        raise httpx.TimeoutException("Read timed out after 30s")

    with patch.object(httpx.Client, "get", new=make_provider_mock(mock_timeout)):
        # Rainfall fails with 503 carrying 'timeout' reason
        r = client.get("/api/forecast?region=delhi_ncr&variable=rainfall&lead_time_hours=48")
        assert r.status_code == 503
        data = r.json()
        assert data["provider_reason"] == "timeout"
        assert data["provider_http_status"] is None
        assert "timed out" in data.get("diagnostic", "").lower()


def test_connection_error_distinguishable_and_produces_diagnostic(client):
    """Verify httpx.ConnectError produces provider_reason='connection_error' and proper diagnostic."""
    def mock_conn_err(url, *args, **kwargs):
        raise httpx.ConnectError("Connection refused by peer")

    with patch.object(httpx.Client, "get", new=make_provider_mock(mock_conn_err)):
        r = client.get("/api/forecast?region=delhi_ncr&variable=rainfall&lead_time_hours=48")
        assert r.status_code == 503
        data = r.json()
        assert data["provider_reason"] == "connection_error"
        assert "connection" in data.get("diagnostic", "").lower()


# =========================================================================
# 5. Region without Replay Archive (e.g. punjab_agri)
# =========================================================================

def test_unbenchmarked_region_fails_cleanly_when_provider_down(client):
    """Region without replay archive returns truthful 503 for all variables when provider is 429."""
    def mock_429(url, *args, **kwargs):
        resp = MagicMock()
        resp.status_code = 429
        resp.headers = {"retry-after": "60"}
        resp.request = MagicMock()
        return resp

    with patch.object(httpx.Client, "get", new=make_provider_mock(mock_429)):
        # Even temperature returns 503 because punjab_agri has no replay timeline
        r = client.get("/api/forecast?region=punjab_agri&variable=temperature&lead_time_hours=48")
        assert r.status_code == 503
        data = r.json()
        assert data["available"] is False
        assert data["provider_http_status"] == 429
        assert data["provider_reason"] == "rate_limited"


# =========================================================================
# 6. Diagnostic Lightweight Probe Endpoint
# =========================================================================

def test_probe_provider_caching_and_cooldown_behavior():
    """Verify probe_provider caches results and avoids hammering upstream during cooldown."""
    call_count = 0

    def mock_get(url, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        resp = MagicMock()
        resp.status_code = 200
        return resp

    with patch.object(httpx.Client, "get", new=make_provider_mock(mock_get)):
        # Initial probe hits upstream
        res1 = probe_provider(FORECAST_API)
        assert res1["reachable"] is True
        assert call_count == 1

        # Second probe within 60s uses cache
        res2 = probe_provider(FORECAST_API)
        assert res2["reachable"] is True
        assert call_count == 1  # No additional HTTP request!

    # When provider cooldown is active, probe reports rate_limited without calling network
    reset_probe_cache()
    set_rate_limited(30.0)

    uncalled_mock = MagicMock()
    with patch.object(httpx.Client, "get", new=make_provider_mock(uncalled_mock)):
        res_cd = probe_provider(FORECAST_API)
        assert res_cd["reachable"] is False
        assert res_cd["http_status"] == 429
        assert res_cd["reason"] == "rate_limited"
        assert uncalled_mock.call_count == 0


# =========================================================================
# 7. Comprehensive Matrix Across All 4 Variables: Timeout, Connection, Cold Start
# =========================================================================

def test_timeout_all_four_variables(client):
    """Verify timeout fallback behavior across all 4 variables (temperature -> REPLAY, others -> 503)."""
    def mock_timeout(url, *args, **kwargs):
        raise httpx.TimeoutException("Read timed out after 30s")

    with patch.object(httpx.Client, "get", new=make_provider_mock(mock_timeout)):
        # Temperature falls back to REPLAY
        r_temp = client.get("/api/forecast?region=delhi_ncr&variable=temperature&lead_time_hours=48")
        assert r_temp.status_code == 200
        data_temp = r_temp.json()
        assert data_temp["data_mode"] == "REPLAY"
        assert data_temp["variable"] == "temperature"

        # Rainfall, wind_speed, pressure return 503 with timeout diagnostic
        for var in ["rainfall", "wind_speed", "pressure"]:
            r = client.get(f"/api/forecast?region=delhi_ncr&variable={var}&lead_time_hours=48")
            assert r.status_code == 503
            data = r.json()
            assert data["available"] is False
            assert data["data_mode"] is None
            assert data["provider_reason"] == "timeout"
            assert data["provider_http_status"] is None
            assert "timed out" in data.get("diagnostic", "").lower()


def test_connection_error_all_four_variables(client):
    """Verify connection error fallback behavior across all 4 variables."""
    def mock_conn_err(url, *args, **kwargs):
        raise httpx.ConnectError("Connection refused by peer")

    with patch.object(httpx.Client, "get", new=make_provider_mock(mock_conn_err)):
        # Temperature falls back to REPLAY
        r_temp = client.get("/api/forecast?region=delhi_ncr&variable=temperature&lead_time_hours=48")
        assert r_temp.status_code == 200
        assert r_temp.json()["data_mode"] == "REPLAY"

        # Other 3 variables return 503 with connection failure diagnostic
        for var in ["rainfall", "wind_speed", "pressure"]:
            r = client.get(f"/api/forecast?region=delhi_ncr&variable={var}&lead_time_hours=48")
            assert r.status_code == 503
            data = r.json()
            assert data["provider_reason"] == "connection_error"
            assert "connection" in data.get("diagnostic", "").lower()


def test_no_cache_cold_start_all_variables(client):
    """Verify clean cold-cache behavior for benchmarked and unbenchmarked regions under 429."""
    def mock_429(url, *args, **kwargs):
        resp = MagicMock()
        resp.status_code = 429
        resp.headers = {"retry-after": "60"}
        resp.request = MagicMock()
        return resp

    with patch.object(httpx.Client, "get", new=make_provider_mock(mock_429)):
        # Benchmarked region (delhi_ncr): temperature -> REPLAY; others -> 503
        r_temp = client.get("/api/forecast?region=delhi_ncr&variable=temperature&lead_time_hours=48")
        assert r_temp.status_code == 200
        assert r_temp.json()["data_mode"] == "REPLAY"

        for var in ["rainfall", "wind_speed", "pressure"]:
            r = client.get(f"/api/forecast?region=delhi_ncr&variable={var}&lead_time_hours=48")
            assert r.status_code == 503
            assert r.json()["provider_reason"] == "rate_limited"

        # Unbenchmarked region (punjab_agri): all 4 variables return 503
        for var in VARIABLE_KEYS:
            r = client.get(f"/api/forecast?region=punjab_agri&variable={var}&lead_time_hours=48")
            assert r.status_code == 503
            data = r.json()
            assert data["available"] is False
            assert data["provider_reason"] == "rate_limited"


def test_replay_preserves_requested_lead_times(client):
    """Verify that in REPLAY mode, requested valid lead times (24, 48, 72, 120) are preserved."""
    def mock_429(url, *args, **kwargs):
        resp = MagicMock()
        resp.status_code = 429
        resp.headers = {"retry-after": "60"}
        resp.request = MagicMock()
        return resp

    with patch.object(httpx.Client, "get", new=make_provider_mock(mock_429)):
        for lead in LEAD_TIMES:
            r = client.get(f"/api/forecast?region=delhi_ncr&variable=temperature&lead_time_hours={lead}")
            assert r.status_code == 200
            data = r.json()
            assert data["data_mode"] == "REPLAY"
            assert data["timeline"][0]["lead_time_hours"] == lead
            assert data.get("requested_lead_time_hours") == lead


def test_isolated_rate_limiting_across_endpoints():
    """Verify rate limit on FORECAST_API does NOT block PREVIOUS_RUNS_API or ARCHIVE_API."""
    # Set rate limit cooldown specifically on FORECAST_API
    set_rate_limited(60.0, FORECAST_API)

    # Forecast API is rate-limited
    limited, _ = is_rate_limited(FORECAST_API)
    assert limited is True

    # Previous-runs and Archive APIs are NOT rate-limited
    limited_prev, _ = is_rate_limited(PREVIOUS_RUNS_API)
    assert limited_prev is False

    limited_arch, _ = is_rate_limited(ARCHIVE_API)
    assert limited_arch is False

    # A call to previous-runs endpoint succeeds without raising rate limit ProviderError
    def mock_prev(url, *args, **kwargs):
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = {"hourly": {"time": ["2024-01-01T00:00"]}}
        resp.raise_for_status.return_value = None
        return resp

    with patch.object(httpx.Client, "get", new=make_provider_mock(mock_prev)):
        data = _http_get_json(PREVIOUS_RUNS_API, {"test": "prev"})
        assert "hourly" in data


def test_weights_and_extremes_503_diagnostics_on_provider_down(client):
    """Verify weights and extremes endpoints surface diagnostic on provider 429 or timeout."""
    def mock_429(url, *args, **kwargs):
        resp = MagicMock()
        resp.status_code = 429
        resp.headers = {"retry-after": "60"}
        resp.request = MagicMock()
        return resp

    with patch.object(httpx.Client, "get", new=make_provider_mock(mock_429)):
        # Weights for non-temperature variable returns 503 with rate-limited diagnostic
        rw = client.get("/api/weights?region=delhi_ncr&variable=rainfall&lead_time_hours=48")
        assert rw.status_code == 503
        dw = rw.json()
        assert dw["available"] is False
        assert dw["provider_http_status"] == 429
        assert dw["provider_reason"] == "rate_limited"
        assert "rate limit" in dw.get("diagnostic", "").lower()

        # Extremes returns 503 because it requires rainfall and wind speed
        re = client.get("/api/extremes?region=delhi_ncr&lead_time_hours=48")
        assert re.status_code == 503
        de = re.json()
        assert de["available"] is False
        assert de["provider_http_status"] == 429
        assert de["provider_reason"] == "rate_limited"
        assert "rate limit" in de.get("diagnostic", "").lower()

