"""Null handling: 1 null, 2 nulls, all null - never converted to 0.0,
weights recomputed over remaining members, degraded flag semantics."""
from __future__ import annotations

import pytest

import app.services.blend_service as svc
from tests.conftest import MODEL_KEYS, make_live_series


@pytest.fixture()
def patched_live(monkeypatch):
    def _patch(series):
        monkeypatch.setattr(svc, "get_live_forecast", lambda lat, lon, **kw: (series, "LIVE"))
    return _patch


def test_one_null_member(client, patched_live, live_series):
    # cep_gfs missing at hour 5 entirely
    for field in live_series["models"]["cep_gfs"]:
        live_series["models"]["cep_gfs"][field][5] = None
    patched_live(live_series)
    out = svc.forecast_payload("delhi_ncr", "temperature", None)
    entry = out["timeline"][5]
    assert entry["models"]["cep_gfs"] is None
    assert entry["models"]["cep_gfs"] != 0.0  # null never becomes 0.0
    assert set(entry["weights"].keys()) == {"ecmwf_ifs", "ecmwf_aifs", "dwd_icon"}
    assert sum(entry["weights"].values()) == 100
    assert entry["models_used"] == 3
    assert entry["degraded"] is False  # >= 2 members remain


def test_two_null_members(client, patched_live, live_series):
    for key in ("cep_gfs", "dwd_icon"):
        for field in live_series["models"][key]:
            live_series["models"][key][field][3] = None
    patched_live(live_series)
    out = svc.forecast_payload("delhi_ncr", "temperature", None)
    entry = out["timeline"][3]
    assert entry["models_used"] == 2
    assert set(entry["weights"].keys()) == {"ecmwf_ifs", "ecmwf_aifs"}
    assert sum(entry["weights"].values()) == 100
    assert entry["degraded"] is False


def test_three_null_members_degraded(client, patched_live, live_series):
    for key in ("cep_gfs", "dwd_icon", "ecmwf_aifs"):
        for field in live_series["models"][key]:
            live_series["models"][key][field][2] = None
    patched_live(live_series)
    out = svc.forecast_payload("delhi_ncr", "temperature", None)
    entry = out["timeline"][2]
    assert entry["models_used"] == 1
    assert entry["degraded"] is True  # fewer than 2 remain
    assert sum(entry["weights"].values()) == 100
    assert entry["blend"] is not None


def test_all_null_members(client, patched_live, live_series):
    for key in MODEL_KEYS:
        for field in live_series["models"][key]:
            live_series["models"][key][field][1] = None
    patched_live(live_series)
    out = svc.forecast_payload("delhi_ncr", "temperature", None)
    entry = out["timeline"][1]
    assert entry["models_used"] == 0
    assert entry["degraded"] is True
    assert entry["weights"] == {}
    assert entry["blend"] is None
