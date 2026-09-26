"""
VARUNA Data Access Verification Probe.
Systematically tests all potential live, historical, and reference data endpoints.
Outputs exact status codes, headers, and payload samples to determine accessibility.
"""
import os
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path

def test_endpoint(name: str, url: str) -> dict:
    print(f"\n--- Testing [{name}] ---")
    print(f"URL: {url}")
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "VARUNA-Data-Probe/1.0 (Research/Academic)"}
    )
    result = {
        "name": name,
        "url": url,
        "accessible": False,
        "status_code": None,
        "error": None,
        "requires_auth": False,
        "content_length": 0,
        "keys_returned": [],
        "sample": None
    }
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            result["status_code"] = response.status
            result["accessible"] = (response.status == 200)
            data = json.loads(response.read().decode('utf-8'))
            result["keys_returned"] = list(data.keys())
            if "hourly" in data:
                result["hourly_keys"] = list(data["hourly"].keys())
                result["sample_timestamps_count"] = len(data["hourly"].get("time", []))
                sample_preview = {k: data["hourly"][k][:3] for k in list(data["hourly"].keys())[:4]}
                result["sample"] = sample_preview
            result["content_length"] = len(json.dumps(data))
            print(f"Status: {response.status} OK | Hourly fields: {result.get('hourly_keys', [])[:5]} (Count: {result.get('sample_timestamps_count')})")
    except urllib.error.HTTPError as e:
        result["status_code"] = e.code
        result["accessible"] = False
        err_body = e.read().decode('utf-8', errors='replace')
        result["error"] = err_body
        print(f"HTTP Error: {e.code} - {e.reason}")
        print(f"Response: {err_body[:300]}")
        if e.code in [401, 403] or "subscription" in err_body.lower() or "apikey" in err_body.lower():
            result["requires_auth"] = True
    except Exception as e:
        result["accessible"] = False
        result["error"] = str(e)
        print(f"Network / Exception: {str(e)}")
        
    return result

def run_probe():
    lat = 28.6139
    lon = 77.2090
    results = []

    # 1. LIVE FORECASTS: ECMWF IFS
    results.append(test_endpoint(
        "LIVE: ECMWF IFS (ecmwf_ifs025)",
        f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=temperature_2m,precipitation,wind_speed_10m,surface_pressure&models=ecmwf_ifs025"
    ))

    # 2. LIVE FORECASTS: ECMWF AIFS
    results.append(test_endpoint(
        "LIVE: ECMWF AIFS (ecmwf_aifs025)",
        f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=temperature_2m,precipitation,wind_speed_10m,surface_pressure&models=ecmwf_aifs025"
    ))

    # 3. LIVE FORECASTS: NOAA GFS
    results.append(test_endpoint(
        "LIVE: NOAA GFS (gfs_seamless)",
        f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=temperature_2m,precipitation,wind_speed_10m,surface_pressure&models=gfs_seamless"
    ))

    # 4. LIVE FORECASTS: DWD ICON
    results.append(test_endpoint(
        "LIVE: DWD ICON (icon_seamless)",
        f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=temperature_2m,precipitation,wind_speed_10m,surface_pressure&models=icon_seamless"
    ))

    # 5. LIVE FORECASTS: All 4 combined
    results.append(test_endpoint(
        "LIVE: ALL 4 MODELS COMBINED",
        f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=temperature_2m,precipitation,wind_speed_10m,surface_pressure&models=ecmwf_ifs025,ecmwf_aifs025,gfs_seamless,icon_seamless"
    ))

    # Historical dates (past 14 days)
    today = datetime.now(timezone.utc)
    end_date = (today - timedelta(days=3)).strftime("%Y-%m-%d")
    start_date = (today - timedelta(days=13)).strftime("%Y-%m-%d")

    # 6. HISTORICAL FORECAST API: GFS
    results.append(test_endpoint(
        "HISTORICAL FORECAST: GFS (historical-forecast-api)",
        f"https://historical-forecast-api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&start_date={start_date}&end_date={end_date}&hourly=temperature_2m,precipitation,wind_speed_10m,surface_pressure&models=gfs_seamless"
    ))

    # 7. HISTORICAL FORECAST API: ECMWF IFS
    results.append(test_endpoint(
        "HISTORICAL FORECAST: ECMWF IFS (historical-forecast-api)",
        f"https://historical-forecast-api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&start_date={start_date}&end_date={end_date}&hourly=temperature_2m,precipitation,wind_speed_10m,surface_pressure&models=ecmwf_ifs025"
    ))

    # 8. HISTORICAL FORECAST API: ECMWF AIFS
    results.append(test_endpoint(
        "HISTORICAL FORECAST: ECMWF AIFS (historical-forecast-api)",
        f"https://historical-forecast-api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&start_date={start_date}&end_date={end_date}&hourly=temperature_2m,precipitation,wind_speed_10m,surface_pressure&models=ecmwf_aifs025"
    ))

    # 9. HISTORICAL FORECAST API: DWD ICON
    results.append(test_endpoint(
        "HISTORICAL FORECAST: DWD ICON (historical-forecast-api)",
        f"https://historical-forecast-api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&start_date={start_date}&end_date={end_date}&hourly=temperature_2m,precipitation,wind_speed_10m,surface_pressure&models=icon_seamless"
    ))

    # 10. HISTORICAL FORECAST API: ALL 4 MODELS COMBINED
    results.append(test_endpoint(
        "HISTORICAL FORECAST: ALL 4 MODELS COMBINED (historical-forecast-api)",
        f"https://historical-forecast-api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&start_date={start_date}&end_date={end_date}&hourly=temperature_2m,precipitation,wind_speed_10m,surface_pressure&models=ecmwf_ifs025,ecmwf_aifs025,gfs_seamless,icon_seamless"
    ))

    # 11. HISTORICAL WEATHER / ERA5 ARCHIVE API
    results.append(test_endpoint(
        "REFERENCE ERA5: Archive API (archive-api.open-meteo.com)",
        f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}&start_date={start_date}&end_date={end_date}&hourly=temperature_2m,precipitation,wind_speed_10m,surface_pressure"
    ))

    # Save summary
    out_dir = Path("backend/data")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "data_access_audit.json"
    with open(out_file, "w") as f:
        json.dump(results, f, indent=2)

    print("\n=======================================================")
    print(f"DATA ACCESS PROBE COMPLETED. SUMMARY SAVED TO {out_file}")
    print("=======================================================")

if __name__ == "__main__":
    run_probe()
