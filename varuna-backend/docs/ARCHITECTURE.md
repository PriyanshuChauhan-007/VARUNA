# VARUNA Backend — Architecture

FastAPI service implementing the VARUNA hybrid AI-NWP blending specification
(SIH26081). Python 3.11+, SQLite cache, no Postgres/Parquet/deep nets.

## Layout

```
varuna-backend/
  app/
    config.py              all canonical constants (regions, models, windows,
                           split, XGB params, thresholds, regime classes)
    main.py                FastAPI app + CORS (http://localhost:5173)
    api/                   one route file per endpoint
      routes_regions.py     -> /api/regions
      routes_forecast.py    -> /api/forecast
      routes_weights.py     -> /api/weights
      routes_skill.py       -> /api/skill
      routes_extremes.py    -> /api/extremes
      routes_explain.py     -> /api/explain
      routes_providers.py   -> /api/providers/status
      (health)              -> /api/health is defined in main.py
    providers/
      cache.py             SQLite cache: 30-min TTL "live", permanent "archive"
      open_meteo.py        httpx + 3 retries/backoff; forecast, previous-runs,
                           ERA5 archive, health probes
    science/
      alignment.py         previous-runs + ERA5 -> aligned rows, chrono split
      regime.py            6-class deterministic rule cascade
      weighting.py         Hamilton-Hare integers, 1/E^2 weights, blend, stats
      meta_model.py        one XGBRegressor per model, 11-feature schema
      verification.py      rmse / mae / bias / pearson_r
      run_pipeline.py      end-to-end: collect -> split -> train -> report -> replay
    services/
      blend_service.py     all payload builders + LIVE/CACHED/REPLAY/503 chain
  scripts/
    run_pipeline.py        train + reports + provenance + replay archive
    build_replay.py        rebuild data/replay/timelines.json only
  tests/                   54 tests, network-free (provider always monkeypatched)
  docs/                    ARCHITECTURE, REGIME_RULES, DATA_PROVENANCE,
                           LIMITATIONS, VALIDATION_PROTOCOL
  cache/  data/  models/  reports/
```

## Request flow

```
HTTP route  ->  blend_service.<x>_payload()
                  |-- _bundle()                 trained meta-model (joblib)
                  |-- get_live_forecast()       provider + SQLite cache
                  |      LIVE  fresh fetch
                  |      CACHED  SQLite hit (fresh or stale)
                  |-- _replay_timeline()        data/replay/timelines.json
                  `-- ServiceUnavailable -> HTTP 503 JSON (never 502)
```

### Resilience chain

| step | condition | `data_mode` |
|------|-----------|-------------|
| 1 | fresh network fetch | `LIVE` |
| 2 | network failed, SQLite entry exists | `CACHED` |
| 3 | network failed, no cache, replay archive has the region/lead | `REPLAY` |
| 4 | all of the above failed | HTTP **503** with `{detail, available:false, mode_tried}` |

A raw 502 is never surfaced. `data_mode` is computed, never hardcoded.

## Per-request weighting (temperature, trained)

1. Read the 4 model values for the requested hour (nulls stay `null`).
2. `ensemble_mean`, `ensemble_spread` from the *available* members only.
3. Classify regime from month + coordinates + **ensemble** values (never ERA5).
4. Build the 11-feature row; `model_own_forecast` is set to each model's own
   value, so each of the 4 regressors sees its own forecast as feature 11.
5. `E_i = max(XGB_i(features), 1e-6)`; `w_i ∝ 1/E_i²`; Hamilton-Hare → integer
   percents summing exactly 100 (never renormalised, never negative).
6. `blend = Σ (w_i/100) × value_i`, skipping null members.
7. `< 2` usable members → `degraded: true`.

The 4 regressors for one request are evaluated in **one batched `predict()`
call per model** (all 168 horizon hours at once) — this keeps `/api/forecast`
in the ~0.1 s range instead of ~8 s.

## Non-temperature variables (until Phase 4)

`rainfall`, `wind_speed`, `pressure` are served live with equal weights,
`weighting_scheme: "equal_fallback_untrained"`, `validated: false` and a
`reason` string. They are never presented as adaptive skill.

## Fallback when the meta-model file is missing

`weighting_scheme` becomes `equal_fallback_untrained` and `/api/explain`
returns `model_available:false` with a "run scripts/run_pipeline.py" note.
No error, no fabricated skill.

## Testing

`python -m pytest tests -q` — 54 tests. No test touches the network:
`svc.get_live_forecast` is always monkeypatched with a deterministic fixture.
Run with `-p no:asyncio` if a stale pytest-asyncio plugin conflicts.
