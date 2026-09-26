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
