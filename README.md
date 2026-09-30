# VARUNA — Hybrid AI-NWP Weather Intelligence (SIH26081)

VARUNA blends four global Numerical Weather Prediction (NWP) models with a
gradient-boosted (XGBoost) error-prediction meta-model to produce explainable,
region-level forecasts for India. This repository contains both halves of the
system:

| Directory | What it is |
|---|---|
| `varuna-backend/` | FastAPI service: live Open-Meteo ingestion, ERA5-aligned training data, XGBoost blending, skill benchmarks, replay archive (Python 3.11+) |
| `src/`, root `package.json` | React + Vite frontend: command centre, map, forecast, models, skill, extremes, explainability and system-health pages wired to the backend API |
| `varuna-backend/docs/` | The science contract: `ARCHITECTURE.md`, `REGIME_RULES.md`, `VALIDATION_PROTOCOL.md`, `DATA_PROVENANCE.md`, `LIMITATIONS.md` |
| `docs/HISTORICAL_DATA.md` | How the frontend's historical-verification harness (`src/verification/`) proves data is not synthetic |

There is **no fabricated data anywhere in this system**. Every number shown in
the UI comes from a live or cached backend response; failures surface as
explicit error/empty states, never as generated values.

## 1. Run the backend

```powershell
cd varuna-backend
python -m venv venv
venv\Scripts\activate            # Windows (use `source venv/bin/activate` elsewhere)
pip install -r requirements.txt   # pinned: fastapi 0.141.1, xgboost 3.4.1, pandas 3.0.6, ...
python -m uvicorn app.main:app --reload
```

The API listens on <http://localhost:8000>. Health check: <http://localhost:8000/api/health>.

To (re)build the training data, meta-model, skill reports and replay archive:

```powershell
cd varuna-backend
python scripts\run_pipeline.py    # aligned dataset -> trained bundle -> reports
python scripts\build_replay.py    # REPLAY archive from the Post-Monsoon window
```

Backend tests (54 tests, ~2 s):

```powershell
cd varuna-backend
python -m pytest tests -q -p no:asyncio
```

## 2. Run the frontend

```powershell
npm install
npm run dev                      # http://localhost:5173
```

The API base URL defaults to `http://localhost:8000` and can be overridden with
an env variable:

```powershell
# .env.local
VITE_API_BASE_URL=http://localhost:8000
```

CORS is already enabled for `http://localhost:5173` on the backend.

Frontend checks:

```powershell
npm run lint        # ESLint (zero errors required)
npm run build       # production build
npm test            # adapter/contract unit tests + 63 historical-verification tests
```

## 3. API contract

All responses are JSON. Endpoints used by the UI:

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Service status, version, meta-model bundle flag |
| `GET /api/regions` | The 12 regions (6 benchmarked) with `validated` / `benchmarked` flags |
| `GET /api/forecast` | `region`, `variable`, `lead_time_hours` → member forecasts, integer-percent weights, blend timeline, regime, `data_mode` |
| `GET /api/weights` | Weight derivation for one group: member values → predicted errors → weights (sum = 100) |
| `GET /api/skill` | Skill tables (`headline`, `by_lead`, `by_season`, `by_region`), each with an explicit `scope` |
| `GET /api/extremes` | Threshold evaluation (64.5 / 115.6 mm·24h, 45 °C, 55 / 62 km/h) with per-check `crossed` flags |
| `GET /api/explain` | Feature importances, model metadata, rationale for one region/variable/lead |
| `GET /api/providers/status` | Live Open-Meteo probes, pipeline artifact inventory, full provenance record |

Response field shapes are documented in `varuna-backend/docs/ARCHITECTURE.md`
and mirrored by the frontend adapters in `src/services/api.js`.

## 4. How the science works (short version)

1. **Four NWP members** from Open-Meteo: `ecmwf_ifs025`, `ecmwf_aifs025_single`,
   `gfs_seamless`, `icon_seamless`.
2. **Reference**: ERA5 reanalysis via the Open-Meteo archive API — a reference,
   *not* ground truth (stated in every attribution footer).
3. **Meta-model**: one `XGBoostRegressor` per member (80 trees, depth 4,
   learning rate 0.06) predicts `abs(forecast − ERA5)` from 11 fixed features.
4. **Weights**: ∝ 1/Ê² with an epsilon floor, apportioned as Hamilton–Hare
   integer percents that sum to **exactly 100** (never renormalised).
5. **Blend**: `Σ (w/100 × forecast)` across the four members.
6. **Regime**: a documented 6-class rule-based classifier
   (`varuna-backend/docs/REGIME_RULES.md`) runs on ensemble values only —
   ERA5 never enters a forecast-time feature.

Only **temperature** is trained and validated today. `rainfall`, `wind_speed`
and `pressure` are served live but marked `validated: false` with
`weighting_scheme: "equal_fallback_untrained"` until a held-out evaluation
proves a trained variant beats the best single model.

## 5. Honesty guarantees in the UI

- **Data-mode badge** (`LIVE` / `CACHED` / `REPLAY`) in the top bar comes from
  the backend's own `data_mode` field — never inferred client-side.
- **Unvalidated variables** are flagged wherever their values appear
  (default selection is rainfall, so the marking is visible immediately).
- **Skill panels** carry a scope badge (`held_out_test` vs
  `full_dataset_all_splits`) plus the caveat that the held-out window is the
  chronologically last season (Post-Monsoon Sep 1–8, 2026).
- **Extremes** only raise a tier when a real threshold crossing is reported;
  an evaluated-but-healthy check renders as "No threshold crossing".
- **Errors and empty states** replace missing data — the frontend contains no
  mock/synthetic forecast generators and no demo mode.
- **Attribution footer** on every page: Open-Meteo (CC BY 4.0), ECMWF, NOAA,
  DWD; ERA5 as reanalysis reference; IMD station ingestion marked as an
  integration pending item.

## 6. Repository map

```
varuna-backend/
  app/            FastAPI app (api/, services/, providers/, ml/)
  scripts/        run_pipeline.py, build_replay.py
  tests/          pytest suite
  reports/        skill CSVs served by /api/skill
  models/         trained XGBoost bundle (joblib) + provenance.json
  cache/          SQLite response cache (git-ignored)
  docs/           science contract + limitations
src/
  services/       api.js (endpoint adapters + pure helpers), useApi.js (fetch hook), api.test.js
  store/          Zustand store (selections, bulk regional data, data mode)
  data/           referenceData.js (12 regions, variables, models, regimes)
  pages/          Landing, CommandCentre, Forecast, Models, Skill, Extremes,
                  Explainability, SystemHealth
  components/      layout, map (MapLibre), shared badges/status states
  verification/   historical-data verification harness (see docs/HISTORICAL_DATA.md)
```
