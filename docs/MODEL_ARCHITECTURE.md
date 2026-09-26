# VARUNA: Model Architecture & Adaptive Weighting Specification

**Document**: XGBoost Contextual Meta-Model & Ensembling Architecture  
**Status**: Authoritative  

---

## 1. System Role: What the ML Meta-Model Does (and Does Not) Do

```
  ┌────────────────────────────────────────────────────────┐
  │                 NUMERICAL WEATHER MODELS               │
  │     ECMWF IFS    ECMWF AIFS    NOAA GFS    DWD ICON    │
  └───────────────────────────┬────────────────────────────┘
                              │ Member Forecasts (y_1, y_2, y_3, y_4)
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │              CONTEXTUAL FEATURE EXTRACTION             │
  │  - Coordinates (Lat, Lon, Elevation)                   │
  │  - Temporal State (Day of Year, Hour of Day, Month)    │
  │  - Synoptic Regime (Active/Break Monsoon, WD, Heat)    │
  │  - Ensemble Dynamics (Ensemble Mean, Spread)           │
  │  - Member Forecast Values                              │
  └───────────────────────────┬────────────────────────────┘
                              │ Context Vector X
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │             XGBOOST META-MODEL REGRESSORS              │
  │           Predicts: E_hat_m = Expected |Error|         │
  └───────────────────────────┬────────────────────────────┘
                              │ Expected Errors (E_1, E_2, E_3, E_4)
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │       HAMILTON-HARE LARGEST REMAINDER NORMALIZER       │
  │         w_m proportional to 1 / (E_hat_m^2 + eps)      │
  │                   Sum(w_m) == 100%                     │
  └───────────────────────────┬────────────────────────────┘
                              │ Normalized Integer Weights
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │                  VARUNA HYBRID BLEND                   │
  │             y_blend = Sum(w_m * y_m) / 100             │
  └────────────────────────────────────────────────────────┘
```

1. **Does NOT Replace Weather Physics**: XGBoost does not integrate the Navier-Stokes equations or simulate thermodynamic fluid columns.
2. **Contextual Reliability Estimator**: It acts as an intelligent supervisor, learning the condition-specific failure modes of each weather model over Indian meteorological regimes.

---

## 2. Feature Schema

For each model $m \in \{\text{ifs}, \text{aifs}, \text{gfs}, \text{icon}\}$:

| Feature Name | Type | Physical Meaning |
|---|---|---|
| `latitude` | Float | Geographic latitude (degrees north) |
| `longitude` | Float | Geographic longitude (degrees east) |
| `elevation_m` | Float | Surface elevation above mean sea level (meters) |
| `day_of_year` | Integer [1, 366] | Annual seasonal cycle |
| `hour_of_day` | Integer [0, 23] | Diurnal solar heating cycle |
| `month` | Integer [1, 12] | Broad climatological regime |
| `regime_index` | Categorical [0, 5] | Synoptic classification (Active, Break, WD, etc.) |
| `ensemble_mean` | Float | Cross-model central consensus estimate |
| `ensemble_spread` | Float | Cross-model standard deviation (uncertainty proxy) |
| `model_val` | Float | Forecast value produced by member $m$ |

---

## 3. Hamilton-Hare Largest Remainder Normalization

To prevent rounding distortion (e.g. four models rounding to 33% + 33% + 33% = 99% or 101%):
1. Compute exact continuous quotas: $Q_m = \frac{1 / \hat{E}_m^2}{\sum_k 1 / \hat{E}_k^2} \times 100$.
2. Allocate the integer portion: $I_m = \lfloor Q_m \rfloor$.
3. Compute fractional remainders: $R_m = Q_m - I_m$.
4. Sort members by remainder descending and distribute leftover integer units until $\sum w_m = 100\%$.

---

## 4. Multi-Tiered Backoff Hierarchy

If external data degradation or unexpected inputs occur:
- **Tier 1 (Optimal)**: Full XGBoost Contextual Prediction using live meteorological features (`XGBOOST_CONTEXTUAL`).
- **Tier 2 (Degraded)**: Inverse-RMSE Static Historical Skill Weighting derived from long-term verification matrix (`INVERSE_RMSE_BACKOFF`).
- **Tier 3 (Emergency Fallback)**: Equal Weighting (25% each member) (`EQUAL_WEIGHT_BACKOFF`).

The active backoff tier is declared transparently in every API response header and JSON payload.
