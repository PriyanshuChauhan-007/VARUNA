# VARUNA: Data Provenance & API Ingestion Catalog

**Document**: System Data Provenance and Open Access Ingestion Specification  
**Status**: Authoritative  

---

## 1. Primary Data Sources

| Stream Name | Provider | Native Resolution | Update Frequency | API Endpoint | Credentials Required |
|---|---|---|---|---|---|
| **ECMWF IFS** | European Centre for Medium-Range Weather Forecasts | 0.1° (~9 km) | 00z, 12z (0.25° Open Data) | `https://api.open-meteo.com/v1/forecast?models=ecmwf_ifs025` | **None** (Open Access) |
| **ECMWF AIFS** | ECMWF Deep Learning Research Group | 0.25° (~28 km) | 00z, 12z Operational | `https://api.open-meteo.com/v1/forecast?models=ecmwf_aifs025_single` | **None** (Open Access) |
| **NOAA GFS** | National Oceanic & Atmospheric Administration (NCEP) | 0.13° (~13 km) | 00z, 06z, 12z, 18z | `https://api.open-meteo.com/v1/forecast?models=gfs_seamless` | **None** (Public Domain) |
| **DWD ICON** | Deutscher Wetterdienst (German Weather Service) | 0.12° (~13 km) | 00z, 06z, 12z, 18z | `https://api.open-meteo.com/v1/forecast?models=icon_seamless` | **None** (Open Data) |
| **ERA5 Reanalysis** | ECMWF / Copernicus Climate Change Service (C3S) | 0.25° (~28 km) | Historical Reanalysis | `https://archive-api.open-meteo.com/v1/archive` | **None** (Open Access) |
| **Historical Forecast Archive** | Open-Meteo Historical Forecast Engine | Multi-model archive | Daily 00z initialization | `https://historical-forecast-api.open-meteo.com/v1/forecast` | **None** (Open Access) |

---

## 2. In-Situ Observational Mesh: Truth-in-Data Declaration

### IMD Surface AWS Mesh
- **Official Title**: India Meteorological Department Automatic Weather Station / Automatic Rain Gauge Mesh.
- **System Declaration**: `IMD AWS — Integration Pending (No verified station observations connected)`.
- **Status Rationale**: Direct machine-to-machine telemetry ingestion from `aws.imd.gov.in` requires Ministry of Earth Sciences (MoES) institutional credentials and dedicated firewall clearance.
- **Scientific Guarantee**: No simulated or pseudo-random station readings are masqueraded as live in-situ observations. The system explicitly distinguishes between the **ERA5 Reanalysis Reference Dataset** and genuine in-situ weather station observations.

---

## 3. Caching and Rate-Limiting Policy

To guarantee 100% offline reproducibility and prevent exceeding public tier quotas (10,000 requests/day):
- **SQLite Database Cache**: Stored in `backend/cache/weather_cache.sqlite3`.
- **Live Forecast TTL**: 1,800 seconds (30 minutes).
- **Historical Runs & ERA5 Reference TTL**: Infinite (-1.0). Once downloaded, archived runs are preserved permanently on disk.
