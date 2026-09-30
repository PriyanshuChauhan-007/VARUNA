# Data Provenance

## Sources

| what | provider | endpoint | licence |
|------|----------|----------|---------|
| Multi-model forecasts (4 models, hourly, 7 days) | Open-Meteo Forecast API | `https://api.open-meteo.com/v1/forecast` | CC BY 4.0 |
| Archived forecast runs at fixed leads (24/48/72/120 h) | Open-Meteo Previous-Runs API | `https://previous-runs-api.open-meteo.com/v1/forecast` | CC BY 4.0 |
| Verification reference | Open-Meteo Archive API (ERA5) | `https://archive-api.open-meteo.com/v1/archive` | Copernicus / ECMWF |

Attribution string returned by every payload:

> Data: Open-Meteo (CC BY 4.0), ECMWF, NOAA, DWD. Verification reference:
> ERA5 reanalysis, not station observations.

### ERA5 is a reference, never "ground truth"

ERA5 is a reanalysis: a physically-consistent replay of the atmosphere, not a
point observation. Every skill number in this system is
*model vs ERA5-at-gridpoint*. Station-scale truth (urban heat island, orographic
rainfall, gust fronts) is **not** captured, and headline numbers must be read
with that in mind.

## Model ids (verified against Open-Meteo docs)

| internal key | Open-Meteo id |
|--------------|---------------|
| `ecmwf_ifs` | `ecmwf_ifs025` |
| `ecmwf_aifs` | `ecmwf_aifs025_single` |
| `ncep_gfs` | `gfs_seamless` |
| `dwd_icon` | `icon_seamless` |

`ecmwf_aifs025_single` is required — the bare `ecmwf_aifs025` answers HTTP 200
with **all-null values** and would silently poison the ensemble. This is
asserted during provider development and documented in
`app/providers/open_meteo.py`.

## Lead times

`previous_dayN` in the Previous-Runs API means "the run issued N days before
valid time":

| requested lead | API field |
|----------------|-----------|
| 24 h | `previous_day1` |
| 48 h | `previous_day2` |
| 72 h | `previous_day3` |
| 120 h | `previous_day5` |

Live forecasts are served up to a **168 h (7 day) cap**; longer requests are
capped with an explanatory `horizon_note`, never silently truncated and never
extrapolated.

## Regions: frontend coordinates win

The 12 canonical regions are defined in `app/config.py`. Coordinates are taken
from the frontend (`src/data/mockData.js`) wherever the frontend defines them,
because the shipped UI is the reference for what a user sees. For three
regions the frontend values differ from the fallback coordinates given in the
master prompt: `gujarat_industrial`, `odisha_coast`, `rajasthan_thar`.

The prompt fallback numbers are **not** reproduced here — the master prompt is
not a file in this repository and this document does not restate values it
cannot cite. What is recorded is the decision rule and its consequence:

* **Rule:** frontend coordinates win.
* **Consequence:** the values below are the ones actually requested from
  Open-Meteo, the ones ERA5 was extracted at, and the ones the UI displays.
  Re-running the pipeline reproduces exactly these numbers.

| region | canonical lat, lon | zone |
|--------|--------------------|------|
| `gujarat_industrial` | 22.4707, 70.0577 | Kathiawar Coastal Strip |
| `odisha_coast` | 20.3164, 86.6085 | Mahanadi Deltaic Littoral |
| `rajasthan_thar` | 26.2389, 73.0243 | Thar Arid Zone |

Coordinate differences shift the ERA5 grid point and therefore every
verification number for those regions; that is why the choice is documented
rather than silently applied.

## Benchmark windows (2026)

| season | window |
|--------|--------|
| winter | 2026-01-10 → 2026-01-17 |
| pre-monsoon | 2026-04-10 → 2026-04-17 |
| monsoon | 2026-07-01 → 2026-07-15 |
| post-monsoon | 2026-09-01 → 2026-09-08 |

6 benchmarked regions × 4 seasons × 4 leads:
`delhi_ncr, mumbai_coastal, western_ghats, odisha_coast, bengaluru_deccan,
rajasthan_thar`.

## Produced artifacts (from `scripts/run_pipeline.py`)

| file | contents |
|------|----------|
| `data/aligned_multi_season_lead_data.csv` | 21,042 aligned rows (936 unique timestamps) |
| `data/provenance.json` | run metadata: split ranges, weights, headline table |
| `data/replay/timelines.json` | post-monsoon replay archive (REPLAY mode) |
| `models/xgboost_meta_temperature.joblib` | 4 trained XGBRegressor bundle |
| `reports/*.csv`, `reports/feature_importance.png` | skill + weights tables |

Alignment rule: a row exists only when the forecast timestamp **and** the ERA5
reference timestamp both exist; otherwise the row is dropped (never filled).

## Caching

* `live` kind: 30-minute TTL. A fresh hit is reported as `CACHED`.
* `archive` kind (previous-runs + ERA5): permanent — these forecasts are
  immutable by construction.
* Stale `live` entries are served only when the network fails, still labelled
  `CACHED` (never `LIVE`).

## Regional coverage caveat

The 6 non-benchmarked regions (`gujarat_industrial`, `punjab_agri`,
`assam_valley`, `chennai_coastal`, `kerala_coast`, `central_highlands`) are
served **live only**: they have no held-out skill table, and `/api/regions`
reports `validated: false` for them. Their weights are computed by the same
model, but no claim of skill is made.
