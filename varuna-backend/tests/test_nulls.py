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
    for field in live_series["models"]["ncep_gfs"]:
        live_series["models"]["ncep_gfs"][field][5] = None
    patched_live(live_series)
    out = svc.forecast_payload("delhi_ncr", "temperature", None)
    entry = out["timeline"][5]
    assert entry["models"]["ncep_gfs"] is None
    assert entry["models"]["ncep_gfs"] != 0.0
    assert set(entry["weights"].keys()) == {"ecmwf_ifs", "ecmwf_aifs", "dwd_icon"}
    assert sum(entry["weights"].values()) == 100
    assert entry["models_used"] == 3
    assert entry["degraded"] is False


def test_two_null_members(client, patched_live, live_series):
    for key in ("ncep_gfs", "dwd_icon"):
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
    for key in ("ncep_gfs", "dwd_icon", "ecmwf_aifs"):
        for field in live_series["models"][key]:
            live_series["models"][key][field][2] = None
    patched_live(live_series)
    out = svc.forecast_payload("delhi_ncr", "temperature", None)
    entry = out["timeline"][2]
    assert entry["models_used"] == 1
    assert entry["degraded"] is True
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
