# Validation Protocol

## 1. What is being verified

| item | value |
|------|-------|
| target variable | `temperature_2m` (°C) only |
| reference | ERA5 reanalysis (Open-Meteo archive, `models=era5`) |
| models | `ecmwf_ifs025`, `ecmwf_aifs025_single`, `gfs_seamless`, `icon_seamless` |
| leads | 24, 48, 72, 120 h (`previous_day1/2/3/5`) |
| regions | 6 benchmarked |
| windows | winter Jan 10–17, pre-monsoon Apr 10–17, monsoon Jul 1–15, post-monsoon Sep 1–8 (2026) |
| metrics | RMSE, MAE, bias (mean error), Pearson r |

"Reference" is used deliberately: ERA5 is a reanalysis, not station
observation and not ground truth (`docs/DATA_PROVENANCE.md`).

## 2. Alignment

1. Fetch archived forecast runs for a (region, window, lead, variable) from
   the Previous-Runs API — one `previous_dayN` field per lead.
2. Fetch ERA5 for the same coordinates and window.
3. Keep a row only where forecast timestamp **and** reference timestamp both
   exist and match exactly. No interpolation, no nearest-time substitution,
   no filling. Dropped rows are counted in `data/provenance.json`
   (`failed_fetches`).
4. Compute per-model `err`, `abs_err`, `sq_err` against ERA5, plus shared
   features: `ensemble_mean`, `ensemble_spread` (available members only),
   `day_of_year`, `hour_of_day`, `month`, `regime_index` (from ensemble values,
   never ERA5).

Result: **21,042 rows / 936 unique timestamps**, 6 regions × 4 seasons × 4
leads.

## 3. Split (leakage guards)

* Chronological by **unique timestamp**: earliest 65% train, next 15%
  validation, final 20% test. No shuffling.
* All rows of one timestamp share one partition (asserted in
  `tests/test_split.py`).
* The pipeline asserts pairwise-disjoint timestamp sets before training and
  aborts otherwise.
* ERA5 never appears as a forecast-time feature; it is only the training
  target `|forecast − ERA5|` and the evaluation reference.
* Static inverse-RMSE weights are computed from **TRAIN rows only**.

## 4. Models trained

Four `XGBRegressor` (one per forecast model), spec-exact:

```
n_estimators = 80, max_depth = 4, learning_rate = 0.06,
subsample = 1.0, colsample_bytree = 1.0,
objective = reg:squarederror, random_state = 42
```

Target per model: `y = |forecast_model − ERA5|`.
Features (fixed 11, fixed order): `latitude, longitude, elevation_m,
lead_time_hours, day_of_year, hour_of_day, month, regime_index,
ensemble_mean, ensemble_spread, model_own_forecast` — where
`model_own_forecast` is that model's own forecast value.

## 5. Systems compared (identical rows)

| system | definition |
|--------|-----------|
| 4 single models | raw member forecasts |
| `equal_blend` | unweighted mean |
| `static_inverse_rmse_blend` | train-only inverse-RMSE integer weights |
| `varuna_adaptive` | per-row XGB predicted errors → `w ∝ 1/E²` → Hamilton-Hare integers |

Blend rule everywhere: `blend = Σ (w_i/100) × value_i`, integer weights summing
to exactly 100, never renormalised, null members skipped.

## 6. Headline result (held-out, `scope: held_out_test`, n = 4,512)

| system | RMSE | MAE | bias | r |
|--------|------|-----|------|---|
| ecmwf_ifs | 1.195 | 0.924 | −0.561 | 0.973 |
| ecmwf_aifs | 1.105 | 0.866 | +0.510 | 0.981 |
| cep_gfs | 2.320 | 1.874 | +0.674 | 0.930 |
| dwd_icon | 1.131 | 0.876 | +0.056 | 0.969 |
| equal_blend | 0.960 | 0.759 | +0.170 | 0.978 |
| static_inverse_rmse | 0.787 | 0.622 | +0.082 | 0.984 |
| **varuna_adaptive** | **0.780** | **0.612** | **+0.066** | 0.984 |

Adaptive blending beats every single model and both baselines on this
partition. **Mandatory caveat:** the test partition is entirely Post-Monsoon
Sep 1–8, 2026 (`docs/LIMITATIONS.md` §1). Full-dataset tables
(`scope: full_dataset_all_splits`) also show the adaptive system ahead at
every lead (24/48/72/120 h) and in every season, but those rows include
training data and are not held-out evidence.

## 7. Reproduce

```sh
cd varuna-backend
pip install -r requirements.txt
python scripts/run_pipeline.py     # collect -> split -> train -> reports -> replay
python -m pytest tests -q          # 54 tests, no network
python -m uvicorn app.main:app --port 8000
```

The pipeline writes `data/aligned_multi_season_lead_data.csv`,
`data/provenance.json`, `data/replay/timelines.json`,
`models/xgboost_meta_temperature.joblib`, `reports/*.csv`,
`reports/feature_importance.png`.

## 8. Regression gate

`pytest` must pass before any commit:

* Hamilton-Hare: sums to exactly 100, integers, non-negative, deterministic
  ties (`test_weighting.py`)
* nulls: never converted to 0.0, weights re-apportioned, `degraded` semantics
  (`test_nulls.py`)
* split: chronological, disjoint, correct fractions (`test_split.py`)
* regime: fixed class order, deterministic, total (`test_regime.py`)
* extremes: alerts only on a real threshold crossing (`test_extremes.py`)
* API contract + LIVE→CACHED→REPLAY→503 resilience (`test_api.py`)

## 9. What is deliberately NOT claimed

* No skill claim for rainfall / wind / pressure (untrained → `validated:false`).
* No skill claim for the 6 non-benchmarked regions.
* No station-observation accuracy claim.
* No forecast claim in `REPLAY` mode.
