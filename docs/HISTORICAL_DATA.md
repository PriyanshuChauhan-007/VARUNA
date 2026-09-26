# Historical Data Pipeline

This module retrieves a small, reproducible historical sample and creates exact forecast/reference pairs. It does not calculate skill metrics, produce model rankings, or feed the frontend.

## Sources and Scope

- Historical forecast source: official Open-Meteo [Previous Runs API](https://open-meteo.com/en/docs/previous-runs-api), queried through `previous-runs-api.open-meteo.com/v1/forecast`.
- Reference source: official Open-Meteo [Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api), explicitly requesting `models=era5`. This is reanalysis/reference data, not station observation data or ground truth.
- Configured model selectors: ECMWF IFS (`ecmwf_ifs025`), ECMWF AIFS (`ecmwf_aifs025`), and NOAA GFS (`gfs_seamless`). A selector does not guarantee archived values exist for every model/date/location.
- Initial variable: `temperature_2m`, normalized to degrees Celsius. Known Fahrenheit values are converted explicitly; unknown units are rejected.
- Initial lead offsets: 24 and 48 hours, represented by the documented Previous Runs fields `temperature_2m_previous_day1` and `temperature_2m_previous_day2`.
- Initial requested location: Delhi, 28.6139 latitude, 77.2090 longitude. Requested coordinates are the configured point; resolved coordinates are the actual grid/location returned by each API. Both are retained separately on result metadata and records.
- `PREVIOUS_RUNS_PAST_DAYS` limits the initial Previous Runs request to a recent, small window. The executable smoke test selects one UTC date seven days before it runs, then filters the API response to that date.

## Time and Alignment

Open-Meteo documents each `previous_dayN` value as a forecast made `N * 24` hours before its valid time. That explicit fixed-offset definition is the basis for deriving `initialization_time`; it is not inferred from an arbitrary time series. The derived lead is checked against the Stage 1 one-second tolerance and retained separately from `valid_time`.

The APIs are requested with `timezone=GMT`. Their timezone-naive hourly strings are treated as UTC only when the response confirms GMT/UTC and a zero offset. For each model, ERA5 is requested at that model API's resolved coordinates, not at the original configured point. ERA5's own resolved coordinates are retained and must exactly match the forecast resolved coordinates. Forecast `valid_time` must exactly equal reference `observation_time`; variable and normalized unit must also match. Different models may resolve the same requested point to different cells, and ERA5 may resolve the model cell request to another cell. There is no interpolation, nearest-neighbor matching, coordinate rounding, or nearby-cell substitution. Mismatches are returned as diagnostics.

## Provenance and Availability

Normalized records preserve API URL and parameters, source/dataset label, retrieval timestamp, requested and resolved coordinates, model identity, valid/init times, and lead. ERA5 reference requests use the forecast model's resolved coordinates; the reference record separately retains those request coordinates and ERA5's returned/resolved coordinates. Open-Meteo Previous Runs does not return an upstream run identifier in these responses; the canonical `run_id` is therefore derived from model ID and documented initialization time and marked as derived. No model/dataset version or coordinate is invented.

ERA5 reference `available_at` is set to the time this client retrieved the record because the endpoint response does not expose its original publication timestamp. This is provenance about this retrieval, not the source's publication schedule. A reference is a post-hoc verification label and may have become available after forecast issuance; it is not automatically passed through historical-skill-input leakage checks. The same observation must not be used as a forecast-time feature unless its `available_at` is no later than that forecast's initialization.

## Failure and Diagnostics

Network, HTTP, invalid JSON, and malformed response failures throw `HistoricalDataError` with `mode: ERROR`, source, request URL/parameters, failure time, HTTP status where available, and `Retry-After` where supplied. There is no DEMO/mock fallback. Individual missing values or invalid timestamps are listed in `rejected_records`; unequal time/value array lengths fail the response. Unmatched records remain visible in pair diagnostics.

Run the real-data smoke check with:

```sh
node src/verification/historical_smoke_test.js
```

It performs live calls and exits non-zero on request/malformed-response failure or when no exact pairs can be built. It does not save an archive or calculate skill.

## Known Limitations

- Only hourly 2 m temperature, a single Delhi request point, and fixed 24/48-hour offsets are in scope. The Previous Runs API's recent window is not a general historical forecast archive.
- The API may return different resolved grid coordinates for different forecast models, and the ERA5 grid may not share each model cell. Such records remain unmatched under exact location comparison; no spatial transformation is implemented.
- A model with no populated fixed-lead values produces rejection diagnostics and still has its ERA5 request evaluated at the model API's returned resolved coordinates when available. Smoke-test output is a limited sample check, not a claim of model coverage or skill.
- No raw historical response is committed. API responses may be revised, and the retrieval timestamp plus request parameters are retained in normalized in-memory records for audit.