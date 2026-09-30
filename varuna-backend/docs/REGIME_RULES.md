# Synoptic Regime Rules (6 classes, fixed order)

Implementation: `app/science/regime.py` → `classify_regime()`.
Class order is fixed in `app/config.py::REGIME_CLASSES` and is asserted by
`tests/test_regime.py::test_class_order_fixed`.

| idx | class |
|-----|-------|
| 0 | Monsoonal Active Surge |
| 1 | Monsoonal Break |
| 2 | Western Disturbance |
| 3 | Pre-Monsoon Convective |
| 4 | Subtropical Heatwave |
| 5 | Post-Monsoon Depression |

## Input policy (leakage guard)

Inputs are **always ensemble (multi-model forecast) values**, never ERA5:

* `month`, `lat`, `lon` — deterministic from the request
* `temperature_c`, `pressure_hpa`, `wind_kmh`, `precip_mm` — mean over the
  model members that returned a value for that hour/variable

The same rule set therefore applies identically at training time and at
inference time; no reanalysis data can leak into the regime feature.

Missing inputs fall back to neutral values (`25 °C`, `1010 hPa`, `10 km/h`,
`0 mm`) so the cascade always terminates and classification stays total and
deterministic (asserted by `test_deterministic_and_total`).

## Cascade (evaluated strictly in this order)

### Rule 2 — Western Disturbance
```
month in {12, 1, 2, 3}  AND  lat >= 23.0  AND  (temp <= 20.0 OR precip >= 0.1)
```
Cold-season northern India with cold air or precipitation.

### Rule 5 — Post-Monsoon Depression
```
month in {10, 11, 9}  AND  lat <= 26.0  AND  pressure <= 1005.0
                        AND  (precip >= 1.0 OR wind >= 25.0)
```
Bay/peninsular belt: late-season low pressure with rain or strong wind.

### Rule 0 — Monsoonal Active Surge
```
month in {6, 7, 8, 9}  AND  precip >= 2.0
```
Monsoon months with heavy rainfall.

### Rule 1 — Monsoonal Break
```
month in {6, 7, 8, 9}   (i.e. monsoon month that failed Rule 0)
```

### Rule 4 — Subtropical Heatwave
```
temp >= 40.0  AND  precip <= 0.2
```
Any season; the hot-season rule sits before the seasonal fallbacks.

### Rule 3 — Pre-Monsoon Convective
```
month in {3, 4, 5}  AND  (precip >= 0.5 OR temp >= 30.0 OR wind >= 20.0)
```

### Deterministic fallbacks (exhaustive)
```
1. temp >= 35.0 AND precip <= 0.5                  -> 4 Subtropical Heatwave
2. month in {10, 11}                               -> 5 Post-Monsoon Depression
3. month in {12, 1, 2, 3}                          -> 3 Pre-Monsoon Convective
                                                      (cold-season locations
                                                       failing Rule 2, e.g.
                                                       southern peninsula)
4. precip >= 0.5                                   -> 3 Pre-Monsoon Convective
5. otherwise                                       -> 1 Monsoonal Break
```

## Why a cascade and not a score

Every hour gets exactly one class, classes never overlap, and the result is a
pure function of its inputs — reproducible from the aligned CSV alone. The
regime enters the meta-model as the integer feature `regime_index`.
