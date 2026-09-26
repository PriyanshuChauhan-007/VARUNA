"""
FastAPI Integration Tests for VARUNA Backend API Endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "HEALTHY"
    assert "models_integrated" in data
    assert "IMD AWS — Integration Pending" in data["observational_status"]

def test_providers_status_endpoint():
    res = client.get("/api/providers/status")
    assert res.status_code == 200
    data = res.json()
    assert data["total_feeds"] >= 5
    imd_feed = next(f for f in data["feeds"] if f["id"] == "imd_aws")
    assert imd_feed["status"] == "INTEGRATION PENDING"
    assert imd_feed["verification_points"] == 0

def test_extremes_endpoint():
    res = client.get("/api/extremes")
    assert res.status_code == 200
    data = res.json()
    assert "alerts" in data
    assert len(data["alerts"]) > 0

def test_weights_endpoint():
    res = client.get("/api/weights?region=delhi_ncr&variable=temperature")
    assert res.status_code == 200
    data = res.json()
    assert data["region_id"] == "delhi_ncr"
    assert data["sum_check"] == 100
    assert len(data["models"]) == 4

def test_skill_endpoint():
    res = client.get("/api/skill?variable=temperature")
    assert res.status_code == 200
    data = res.json()
    assert "sample_metrics" in data

def test_forecast_endpoint():
    res = client.get("/api/forecast?region=delhi_ncr&variable=temperature")
    assert res.status_code == 200
    data = res.json()
    assert data["region"]["id"] == "delhi_ncr"
    assert data["variable"]["id"] == "temperature"
    assert data["data_mode"] == "LIVE"
    assert len(data["timeline"]) > 0
    
    first_pt = data["timeline"][0]
    assert "blend" in first_pt
    assert "members" in first_pt
    assert "weights" in first_pt
    # All 4 member models present
    for m in ["ecmwf_ifs", "ecmwf_aifs", "ncep_gfs", "dwd_icon"]:
        assert m in first_pt["members"]
        assert m in first_pt["weights"]
    # Weights sum to 100%
    assert sum(first_pt["weights"].values()) == 100

def test_forecast_lead_times():
    # Test 24h, 48h, 72h, 120h
    for lt in ["24h", "48h", "72h", "120h"]:
        res = client.get(f"/api/forecast?region=mumbai_coastal&variable=temperature&lead_time={lt}")
        assert res.status_code == 200
        data = res.json()
        assert data["requested_lead_time"] == lt
        target = data.get("target_point")
        assert target is not None
        assert sum(target["weights"].values()) == 100

def test_forecast_30d_horizon_handling():
    res = client.get("/api/forecast?region=delhi_ncr&variable=temperature&lead_time=30d")
    assert res.status_code == 200
    data = res.json()
    assert data["horizon_note"] is not None
    assert "30-day forecast is unavailable" in data["horizon_note"]
    # Capped at available operational ceiling (at most 168 hours), never fabricated to 720 hours
    assert len(data["timeline"]) <= 168

def test_forecast_error_cases():
    res_404 = client.get("/api/forecast?region=invalid_region&variable=temperature")
    assert res_404.status_code == 404
    res_400 = client.get("/api/forecast?region=delhi_ncr&variable=invalid_variable")
    assert res_400.status_code == 400

