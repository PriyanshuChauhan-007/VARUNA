# VARUNA — Data Access Status & Verification Audit Decision

**Date of Audit**: 26 September 2026  
**Environment**: Production Python 3.14.2 / Windows Host  
**Test Suite**: `backend/scripts/test_data_access.py`  
**Raw Audit Log**: `backend/data/data_access_audit.json`  

---

## 1. Executive Decision Summary

- **LIVE FORECAST DATA**: **ACCESSIBLE (100% OPERATIONAL, NO AUTH REQUIRED)**
- **HISTORICAL FORECAST ARCHIVE**: **ACCESSIBLE (100% OPERATIONAL, NO AUTH REQUIRED)**
- **ERA5 REFERENCE REANALYSIS**: **ACCESSIBLE (100% OPERATIONAL, NO AUTH REQUIRED)**
- **IMD AWS STATION OBSERVATIONS**: **INTEGRATION PENDING (NO VERIFIED OBSERVATIONS CONNECTED)**

**DECISION**: **PROCEED WITH SCIENTIFIC PIPELINE**.  
No fallback to synthetic values is needed because all four numerical/AI weather prediction models (ECMWF IFS, ECMWF AIFS, NOAA GFS, DWD ICON) and the ERA5 reference reanalysis dataset successfully return live and historical numerical time series on the free, unauthenticated tiers.

---

## 2. Empirical Data Access Audit Matrix

### A. LIVE FORECASTS

| Model | Open-Meteo Model Identifier | Endpoint | HTTP Status | Auth Required | Valid Points (Lead 0–168h) | Variables Supported |
|---|---|---|---|---|---|---|
| **ECMWF IFS** | `ecmwf_ifs025` | `https://api.open-meteo.com/v1/forecast` | **200 OK** | **NO** | 168 / 168 | Temp, Precip, Wind, Pressure |
| **ECMWF AIFS** | `ecmwf_aifs025_single` * | `https://api.open-meteo.com/v1/forecast` | **200 OK** | **NO** | 168 / 168 | Temp, Precip, Wind, Pressure |
| **NOAA GFS** | `gfs_seamless` | `https://api.open-meteo.com/v1/forecast` | **200 OK** | **NO** | 168 / 168 | Temp, Precip, Wind, Pressure |
| **DWD ICON** | `icon_seamless` | `https://api.open-meteo.com/v1/forecast` | **200 OK** | **NO** | 168 / 168 | Temp, Precip, Wind, Pressure |

*\* Critical Technical Finding: The identifier `ecmwf_aifs025` returns HTTP 200 but contains all-null values because ECMWF distributes AIFS single deterministic runs under the parameter `ecmwf_aifs025_single`. Using `ecmwf_aifs025_single` returns 100% valid numerical hourly forecast points across all variables.*

---

### B. HISTORICAL FORECASTS (Archived Forecast Runs)

| Model | Source Provider | Endpoint | HTTP Status | Accessible | Auth Required | Verified Date Coverage |
|---|---|---|---|---|---|---|
| **ECMWF IFS** | Open-Meteo Historical Forecast | `https://historical-forecast-api.open-meteo.com/v1/forecast` | **200 OK** | **YES** | **NO** | Full 2024–2026 Archive |
| **ECMWF AIFS** | Open-Meteo Historical Forecast | `https://historical-forecast-api.open-meteo.com/v1/forecast` | **200 OK** | **YES** | **NO** | 2026 Archive (since operational launch) |
| **NOAA GFS** | Open-Meteo Historical Forecast | `https://historical-forecast-api.open-meteo.com/v1/forecast` | **200 OK** | **YES** | **NO** | Full 2024–2026 Archive |
| **DWD ICON** | Open-Meteo Historical Forecast | `https://historical-forecast-api.open-meteo.com/v1/forecast` | **200 OK** | **YES** | **NO** | Full 2024–2026 Archive |

---

### C. REFERENCE DATASET (ERA5 Reanalysis)

| Dataset | Source Provider | Endpoint | HTTP Status | Accessible | Auth Required | Verified Date Coverage |
|---|---|---|---|---|---|---|
| **ERA5 Reanalysis** | ECMWF / Copernicus via Open-Meteo Archive | `https://archive-api.open-meteo.com/v1/archive` | **200 OK** | **YES** | **NO** | 1940 to present (tested June–Sept 2026) |

---

### D. OBSERVATIONAL DATA (IMD AWS)

| Network | Status | Operational Label | Auth Required |
|---|---|---|---|
| **IMD Automatic Weather Stations (AWS)** | Integration Pending | `IMD AWS — Integration Pending (No verified station observations connected)` | **YES** (MoES Institutional Credentials) |

---

## 3. Verification Protocol

The historical verification window for VARUNA is established as **June 1, 2026 to August 31, 2026** (Southwest Monsoon period), during which all four models (including AIFS) have continuous, un-interrupted coverage.
- Reference baseline: ERA5 Reanalysis Reference Dataset.
- Temporal alignment: Forecast initialized at $(t - \text{lead\_time})$ evaluated against reference at valid time $t$.
- Sample size: $N > 2,000$ paired hourly points per region.
- Zero synthetic data: all metrics are derived strictly from these retrieved historical matrices.
