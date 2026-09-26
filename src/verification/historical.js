import { matchForecastObservations } from './matching.js';
import { validateForecastRecord, validateObservationRecord } from './types.js';
import { LEAD_TIME_TOLERANCE_HOURS, deriveLeadTimeHours, parseUtcTimestamp } from './time.js';

export const HISTORICAL_MODEL_IDS = Object.freeze({
  IFS: 'ecmwf_ifs025',
  AIFS: 'ecmwf_aifs025',
  GFS: 'gfs_seamless',
});

export const OPEN_METEO_PREVIOUS_RUNS_URL = 'https://previous-runs-api.open-meteo.com/v1/forecast';
export const OPEN_METEO_HISTORICAL_WEATHER_URL = 'https://archive-api.open-meteo.com/v1/archive';
export const HISTORICAL_VARIABLE = 'temperature_2m';
export const HISTORICAL_UNIT = '°C';
export const HISTORICAL_LOCATION = Object.freeze({ latitude: 28.6139, longitude: 77.2090 });
export const PREVIOUS_RUNS_PAST_DAYS = 7;

const MODEL_METADATA = Object.freeze({
  [HISTORICAL_MODEL_IDS.IFS]: { model_id: 'ecmwf_ifs', model: 'ECMWF IFS' },
  [HISTORICAL_MODEL_IDS.AIFS]: { model_id: 'ecmwf_aifs', model: 'ECMWF AIFS' },
  [HISTORICAL_MODEL_IDS.GFS]: { model_id: 'noaa_gfs', model: 'NOAA GFS' },
});

/**
 * Structured failure for remote historical data requests. mode is always ERROR;
 * historical retrieval never falls back to DEMO or mock values.
 */
export class HistoricalDataError extends Error {
  constructor({ source, requestUrl, requestParameters, failure, timestamp, retryAfter = null, status = null, cause }) {
    super(`${source} failed: ${failure}`, cause ? { cause } : undefined);
    this.name = 'HistoricalDataError';
    this.mode = 'ERROR';
    this.details = {
      source,
      request_url: requestUrl,
      request_parameters: requestParameters,
      failure,
      timestamp,
      retry_after: retryAfter,
      http_status: status,
      mode: 'ERROR',
    };
  }
}

function requireFiniteCoordinate(value, field, minimum, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${field} must be a finite number between ${minimum} and ${maximum}`);
  }
}

function validateDate(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError(`${field} must be a YYYY-MM-DD date`);
  }
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new TypeError(`${field} is not a valid calendar date`);
  }
  return value;
}

function validateDateRange(startDate, endDate) {
  validateDate(startDate, 'startDate');
  validateDate(endDate, 'endDate');
  if (startDate > endDate) throw new RangeError('startDate must be on or before endDate');
}

function validateLeadTimes(leadTimes) {
  if (!Array.isArray(leadTimes) || leadTimes.length === 0) {
    throw new TypeError('leadTimes must be a non-empty array');
  }
  const unique = new Set();
  for (const leadTime of leadTimes) {
    if (!Number.isInteger(leadTime) || leadTime < 24 || leadTime > 168 || leadTime % 24 !== 0) {
      throw new RangeError('leadTimes must contain whole-day offsets from 24 through 168 hours');
    }
    if (unique.has(leadTime)) throw new RangeError(`leadTimes contains duplicate value ${leadTime}`);
    unique.add(leadTime);
  }
  return [...leadTimes].sort((first, second) => first - second);
}

function resolveModel(modelId) {
  const metadata = MODEL_METADATA[modelId];
  if (!metadata) throw new RangeError(`Unsupported Open-Meteo Previous Runs model: ${modelId}`);
  return metadata;
}

function normalizeRetrievedAt(retrievedAt) {
  parseUtcTimestamp(retrievedAt, 'retrieved_at');
  return retrievedAt;
}

function normalizeOpenMeteoTimestamp(timestamp, timezone, fieldName) {
  if (typeof timestamp !== 'string') throw new TypeError(`${fieldName} must be a string`);
  if (timestamp.endsWith('Z')) {
    parseUtcTimestamp(timestamp, fieldName);
    return timestamp;
  }
  if (timezone !== 'GMT' && timezone !== 'UTC') {
    throw new TypeError(`${fieldName} has no timezone suffix and response timezone is not GMT/UTC`);
  }
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(timestamp)
    ? `${timestamp}:00Z`
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(timestamp)
    ? `${timestamp}Z`
    : null;
  if (!withSeconds) throw new TypeError(`${fieldName} is not a supported ISO timestamp`);
  parseUtcTimestamp(withSeconds, fieldName);
  return withSeconds;
}

function normalizeTemperature(value, unit) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('temperature value must be a finite number');
  }
  const normalizedUnit = typeof unit === 'string' ? unit.trim().toLowerCase() : '';
  if (['°c', 'c', 'celsius'].includes(normalizedUnit)) {
    return { value, unit: HISTORICAL_UNIT, unit_normalization: 'identity_celsius' };
  }
  if (['°f', 'f', 'fahrenheit'].includes(normalizedUnit)) {
    return {
      value: (value - 32) * (5 / 9),
      unit: HISTORICAL_UNIT,
      unit_normalization: 'fahrenheit_to_celsius',
    };
  }
  throw new RangeError(`Unsupported temperature unit: ${unit}`);
}

function requireHourlyResponse(response, expectedVariables, sourceName) {
  if (response === null || typeof response !== 'object' || Array.isArray(response)) {
    throw new TypeError(`${sourceName} response must be a JSON object`);
  }
  if (!Number.isFinite(response.latitude) || !Number.isFinite(response.longitude)) {
    throw new TypeError(`${sourceName} response must include finite resolved latitude and longitude`);
  }
  if ((response.timezone !== 'GMT' && response.timezone !== 'UTC') || response.utc_offset_seconds !== 0) {
    throw new TypeError(`${sourceName} response must confirm timezone GMT/UTC with zero UTC offset`);
  }
  if (response.hourly === null || typeof response.hourly !== 'object' || !Array.isArray(response.hourly.time)) {
    throw new TypeError(`${sourceName} response must include hourly.time`);
  }
  if (response.hourly_units === null || typeof response.hourly_units !== 'object') {
    throw new TypeError(`${sourceName} response must include hourly_units`);
  }
  for (const variable of expectedVariables) {
    if (!Array.isArray(response.hourly[variable])) {
      throw new TypeError(`${sourceName} response is missing hourly.${variable}`);
    }
    if (response.hourly[variable].length !== response.hourly.time.length) {
      throw new RangeError(
        `${sourceName} array length mismatch: hourly.time has ${response.hourly.time.length}, hourly.${variable} has ${response.hourly[variable].length}`
      );
    }
    if (typeof response.hourly_units[variable] !== 'string') {
      throw new TypeError(`${sourceName} response is missing hourly_units.${variable}`);
    }
  }
}

function isInRequestedDateRange(timestamp, startDate, endDate) {
  const date = timestamp.slice(0, 10);
  return date >= startDate && date <= endDate;
}

/**
 * Normalize one fixed-lead historical forecast record. Open-Meteo's Previous
 * Runs documentation defines previous_dayN as the forecast made N*24 hours
 * before valid time; that documented source relationship is the only basis for
 * deriving initialization_time here. Any conflicting supplied lead is rejected.
 * @param {object} input
 * @returns {object} Stage 1 ForecastRecord fields plus historical provenance.
 */
export function normalizeHistoricalForecastRecord({
  modelId,
  variable = HISTORICAL_VARIABLE,
  value,
  unit,
  latitude,
  longitude,
  requestedLatitude = latitude,
  requestedLongitude = longitude,
  initializationTime,
  validTime,
  leadTimeHours,
  sourceUrl,
  requestParameters = {},
  retrievedAt,
}) {
  const model = resolveModel(modelId);
  if (variable !== HISTORICAL_VARIABLE) throw new RangeError(`Unsupported historical variable: ${variable}`);
  requireFiniteCoordinate(latitude, 'latitude', -90, 90);
  requireFiniteCoordinate(longitude, 'longitude', -180, 180);
  requireFiniteCoordinate(requestedLatitude, 'requestedLatitude', -90, 90);
  requireFiniteCoordinate(requestedLongitude, 'requestedLongitude', -180, 180);
  if (typeof sourceUrl !== 'string' || sourceUrl.trim() === '') throw new TypeError('sourceUrl is required');
  if (requestParameters === null || typeof requestParameters !== 'object' || Array.isArray(requestParameters)) {
    throw new TypeError('requestParameters must be an object');
  }

  const derivedLeadTimeHours = deriveLeadTimeHours(initializationTime, validTime);
  if (typeof leadTimeHours !== 'number' || !Number.isFinite(leadTimeHours) ||
      Math.abs(leadTimeHours - derivedLeadTimeHours) > LEAD_TIME_TOLERANCE_HOURS) {
    throw new RangeError(
      `provider lead time ${leadTimeHours} disagrees with timestamp-derived lead ${derivedLeadTimeHours}`
    );
  }
  const normalized = normalizeTemperature(value, unit);
  const retrieved = normalizeRetrievedAt(retrievedAt);
  const runId = `${model.model_id}:${initializationTime}`;
  const forecastId = `${model.model_id}:${variable}:${derivedLeadTimeHours}:${validTime}`;
  const record = {
    forecast_id: forecastId,
    model: model.model,
    model_id: model.model_id,
    model_version: null,
    variable,
    value: normalized.value,
    unit: normalized.unit,
    initialization_time: initializationTime,
    valid_time: validTime,
    lead_time_hours: derivedLeadTimeHours,
    location: { latitude, longitude },
    latitude,
    longitude,
    requested_location: { latitude: requestedLatitude, longitude: requestedLongitude },
    resolved_location: { latitude, longitude },
    source: sourceUrl,
    source_dataset: 'Open-Meteo Previous Runs API',
    source_url: sourceUrl,
    request_parameters: { ...requestParameters },
    run_id: runId,
    provider_run_id: null,
    run_id_provenance: 'derived_from_documented_fixed_lead_offset',
    mode: 'ARCHIVE',
    retrieved_at: retrieved,
    unit_normalization: normalized.unit_normalization,
  };
  validateForecastRecord(record);
  return record;
}

/**
 * Normalize a Previous Runs hourly response. Missing values and malformed row
 * timestamps are surfaced in rejected_records; malformed/misaligned arrays fail
 * the response instead of silently truncating it.
 * @param {object} response
 * @param {object} options
 * @returns {{records: object[], rejected_records: object[], request: object, retrieved_at: string}}
 */
export function normalizeHistoricalForecastResponse(response, {
  modelId,
  latitude,
  longitude,
  startDate,
  endDate,
  leadTimes = [24, 48],
  retrievedAt,
  sourceUrl,
  requestParameters = {},
}) {
  const model = resolveModel(modelId);
  validateDateRange(startDate, endDate);
  const requestedLeadTimes = validateLeadTimes(leadTimes);
  const variableNames = requestedLeadTimes.map(
    (lead) => `${HISTORICAL_VARIABLE}_previous_day${lead / 24}`
  );
  requireHourlyResponse(response, variableNames, 'Previous Runs API');
  if (response.hourly.time.some((time) => typeof time !== 'string')) {
    throw new TypeError('Previous Runs API hourly.time must contain strings');
  }
  if (typeof response.hourly_units.time !== 'string') {
    throw new TypeError('Previous Runs API response is missing hourly_units.time');
  }

  const records = [];
  const rejectedRecords = [];
  const resolvedRetrievedAt = normalizeRetrievedAt(retrievedAt);
  response.hourly.time.forEach((rawTimestamp, index) => {
    let validTime;
    try {
      validTime = normalizeOpenMeteoTimestamp(rawTimestamp, response.timezone, `hourly.time[${index}]`);
    } catch (error) {
      for (const leadTimeHours of requestedLeadTimes) {
        rejectedRecords.push({
          record_type: 'forecast',
          model_id: modelId,
          valid_time: rawTimestamp,
          lead_time_hours: leadTimeHours,
          reason: `INVALID_TIMESTAMP: ${error.message}`,
        });
      }
      return;
    }
    if (!isInRequestedDateRange(validTime, startDate, endDate)) return;

    for (let leadIndex = 0; leadIndex < requestedLeadTimes.length; leadIndex += 1) {
      const leadTimeHours = requestedLeadTimes[leadIndex];
      const field = variableNames[leadIndex];
      const rawValue = response.hourly[field][index];
      if (rawValue === null || rawValue === undefined) {
        rejectedRecords.push({
          record_type: 'forecast',
          model_id: modelId,
          valid_time: validTime,
          lead_time_hours: leadTimeHours,
          reason: 'MISSING_FORECAST_VALUE',
        });
        continue;
      }
      const initializationTime = new Date(
        parseUtcTimestamp(validTime) - leadTimeHours * 3_600_000
      ).toISOString();
      try {
        records.push(normalizeHistoricalForecastRecord({
          modelId,
          value: rawValue,
          unit: response.hourly_units[field],
          latitude: response.latitude,
          longitude: response.longitude,
          requestedLatitude: latitude,
          requestedLongitude: longitude,
          initializationTime,
          validTime,
          leadTimeHours,
          sourceUrl,
          requestParameters,
          retrievedAt: resolvedRetrievedAt,
        }));
      } catch (error) {
        rejectedRecords.push({
          record_type: 'forecast',
          model_id: modelId,
          valid_time: validTime,
          lead_time_hours: leadTimeHours,
          reason: `INVALID_RECORD: ${error.message}`,
        });
      }
    }
  });

  return {
    records,
    rejected_records: rejectedRecords,
    retrieved_at: resolvedRetrievedAt,
    model_id: model.model_id,
    model: model.model,
    requested_location: { latitude, longitude },
    resolved_location: { latitude: response.latitude, longitude: response.longitude },
    request: { source: 'Open-Meteo Previous Runs API', url: sourceUrl, parameters: { ...requestParameters } },
  };
}

/**
 * Normalize hourly ERA5 values into explicit reanalysis reference labels. The
 * API does not report its original publication instant, so available_at records
 * when this client retrieved the reference, not a claim about upstream release.
 * @param {object} response
 * @param {object} options
 * @returns {{records: object[], rejected_records: object[], request: object, retrieved_at: string}}
 */
export function normalizeReferenceResponse(response, {
  latitude,
  longitude,
  startDate,
  endDate,
  retrievedAt,
  sourceUrl,
  requestParameters = {},
}) {
  validateDateRange(startDate, endDate);
  requireHourlyResponse(response, [HISTORICAL_VARIABLE], 'Historical Weather API');
  if (typeof response.hourly_units.time !== 'string') {
    throw new TypeError('Historical Weather API response is missing hourly_units.time');
  }

  const records = [];
  const rejectedRecords = [];
  const resolvedRetrievedAt = normalizeRetrievedAt(retrievedAt);
  response.hourly.time.forEach((rawTimestamp, index) => {
    let observationTime;
    try {
      observationTime = normalizeOpenMeteoTimestamp(rawTimestamp, response.timezone, `hourly.time[${index}]`);
    } catch (error) {
      rejectedRecords.push({
        record_type: 'reference',
        observation_time: rawTimestamp,
        reason: `INVALID_TIMESTAMP: ${error.message}`,
      });
      return;
    }
    if (!isInRequestedDateRange(observationTime, startDate, endDate)) return;

    const rawValue = response.hourly[HISTORICAL_VARIABLE][index];
    if (rawValue === null || rawValue === undefined) {
      rejectedRecords.push({
        record_type: 'reference',
        observation_time: observationTime,
        reason: 'MISSING_REFERENCE_VALUE',
      });
      return;
    }
    try {
      const normalized = normalizeTemperature(rawValue, response.hourly_units[HISTORICAL_VARIABLE]);
      const record = {
        observation_id: `ERA5:${observationTime}:${response.latitude},${response.longitude}`,
        variable: HISTORICAL_VARIABLE,
        value: normalized.value,
        unit: normalized.unit,
        observation_time: observationTime,
        available_at: resolvedRetrievedAt,
        location: { latitude: response.latitude, longitude: response.longitude },
        latitude: response.latitude,
        longitude: response.longitude,
        requested_location: { latitude, longitude },
        resolved_location: { latitude: response.latitude, longitude: response.longitude },
        source_kind: 'REANALYSIS_REFERENCE',
        reference_type: 'REANALYSIS_REFERENCE',
        source: sourceUrl,
        source_dataset: 'ERA5 reanalysis via Open-Meteo Historical Weather API',
        dataset_id: 'ERA5',
        dataset_version: null,
        quality_status: 'REANALYSIS_REFERENCE_NOT_STATION_OBSERVATION',
        mode: 'ARCHIVE',
        retrieved_at: resolvedRetrievedAt,
        source_url: sourceUrl,
        request_parameters: { ...requestParameters },
        unit_normalization: normalized.unit_normalization,
      };
      validateObservationRecord(record);
      records.push(record);
    } catch (error) {
      rejectedRecords.push({
        record_type: 'reference',
        observation_time: observationTime,
        reason: `INVALID_RECORD: ${error.message}`,
      });
    }
  });

  return {
    records,
    rejected_records: rejectedRecords,
    retrieved_at: resolvedRetrievedAt,
    requested_location: { latitude, longitude },
    resolved_location: { latitude: response.latitude, longitude: response.longitude },
    request: { source: 'Open-Meteo Historical Weather API (ERA5)', url: sourceUrl, parameters: { ...requestParameters } },
  };
}

function createUrl(endpoint, parameters) {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, String(value));
  return url;
}

function makeFetchError({ source, url, parameters, failure, timestamp, retryAfter = null, status = null, cause }) {
  return new HistoricalDataError({
    source,
    requestUrl: url,
    requestParameters: { ...parameters },
    failure,
    timestamp,
    retryAfter,
    status,
    cause,
  });
}

function timestampNow(now) {
  const value = typeof now === 'function' ? now() : now ?? new Date();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('now must provide a valid timestamp');
  return date.toISOString();
}

async function requestJson({ url, source, parameters, fetchImpl, now }) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A Fetch-compatible HTTP function is required');
  let response;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    throw makeFetchError({
      source,
      url,
      parameters,
      failure: `network error: ${error.message}`,
      timestamp: timestampNow(now),
      cause: error,
    });
  }
  if (!response || response.ok !== true) {
    const status = response?.status ?? null;
    const retryAfter = response?.headers?.get?.('retry-after') ?? null;
    throw makeFetchError({
      source,
      url,
      parameters,
      failure: `HTTP ${status ?? 'unknown'} ${response?.statusText || 'request failed'}`,
      timestamp: timestampNow(now),
      retryAfter,
      status,
    });
  }
  try {
    return await response.json();
  } catch (error) {
    throw makeFetchError({
      source,
      url,
      parameters,
      failure: `invalid JSON response: ${error.message}`,
      timestamp: timestampNow(now),
      cause: error,
    });
  }
}

function validateRequestLocation(latitude, longitude) {
  requireFiniteCoordinate(latitude, 'latitude', -90, 90);
  requireFiniteCoordinate(longitude, 'longitude', -180, 180);
}

/**
 * Fetch a small date-filtered sample from the documented Previous Runs API.
 * The API returns its recent fixed-lead window; startDate/endDate select rows
 * after parsing. Errors throw HistoricalDataError with mode ERROR.
 * @param {object} options
 * @returns {Promise<object>}
 */
export async function fetchHistoricalForecast({
  modelId,
  latitude = HISTORICAL_LOCATION.latitude,
  longitude = HISTORICAL_LOCATION.longitude,
  startDate,
  endDate,
  leadTimes = [24, 48],
  fetchImpl = globalThis.fetch,
  now,
}) {
  const model = resolveModel(modelId);
  validateRequestLocation(latitude, longitude);
  validateDateRange(startDate, endDate);
  const requestedLeadTimes = validateLeadTimes(leadTimes);
  const fields = requestedLeadTimes.map((lead) => `${HISTORICAL_VARIABLE}_previous_day${lead / 24}`);
  const parameters = {
    latitude,
    longitude,
    hourly: fields.join(','),
    models: modelId,
    past_days: PREVIOUS_RUNS_PAST_DAYS,
    forecast_days: 1,
    timezone: 'GMT',
    temperature_unit: 'celsius',
  };
  const url = createUrl(OPEN_METEO_PREVIOUS_RUNS_URL, parameters).toString();
  const source = 'Open-Meteo Previous Runs API';
  const response = await requestJson({ url, source, parameters, fetchImpl, now });
  const retrievedAt = timestampNow(now);
  try {
    return normalizeHistoricalForecastResponse(response, {
      modelId,
      latitude,
      longitude,
      startDate,
      endDate,
      leadTimes: requestedLeadTimes,
      retrievedAt,
      sourceUrl: url,
      requestParameters: parameters,
      model,
    });
  } catch (error) {
    throw makeFetchError({
      source,
      url,
      parameters,
      failure: `malformed response: ${error.message}`,
      timestamp: retrievedAt,
      cause: error,
    });
  }
}

/**
 * Fetch ERA5 hourly reanalysis reference labels from the official Historical
 * Weather API. These are post-hoc labels and are not forecast-time features.
 * @param {object} options
 * @returns {Promise<object>}
 */
export async function fetchReferenceData({
  latitude = HISTORICAL_LOCATION.latitude,
  longitude = HISTORICAL_LOCATION.longitude,
  startDate,
  endDate,
  fetchImpl = globalThis.fetch,
  now,
}) {
  validateRequestLocation(latitude, longitude);
  validateDateRange(startDate, endDate);
  const parameters = {
    latitude,
    longitude,
    start_date: startDate,
    end_date: endDate,
    hourly: HISTORICAL_VARIABLE,
    models: 'era5',
    timezone: 'GMT',
    temperature_unit: 'celsius',
  };
  const url = createUrl(OPEN_METEO_HISTORICAL_WEATHER_URL, parameters).toString();
  const source = 'Open-Meteo Historical Weather API (ERA5)';
  const response = await requestJson({ url, source, parameters, fetchImpl, now });
  const retrievedAt = timestampNow(now);
  try {
    return normalizeReferenceResponse(response, {
      latitude,
      longitude,
      startDate,
      endDate,
      retrievedAt,
      sourceUrl: url,
      requestParameters: parameters,
    });
  } catch (error) {
    throw makeFetchError({
      source,
      url,
      parameters,
      failure: `malformed response: ${error.message}`,
      timestamp: retrievedAt,
      cause: error,
    });
  }
}

function validateHistoricalForecast(record) {
  validateForecastRecord(record);
  if (record.mode !== 'ARCHIVE') throw new TypeError('historical forecast mode must be ARCHIVE');
  if (typeof record.model !== 'string' || record.model.trim() === '') throw new TypeError('model is required');
  if (record.variable !== HISTORICAL_VARIABLE || record.unit !== HISTORICAL_UNIT) {
    throw new TypeError('historical forecasts must use temperature_2m normalized to °C');
  }
  if (record.latitude !== record.location.latitude || record.longitude !== record.location.longitude) {
    throw new RangeError('top-level forecast coordinates must match location coordinates');
  }
  validateCoordinateProvenance(record, 'forecast');
  parseUtcTimestamp(record.retrieved_at, 'retrieved_at');
  if (record.source_url !== record.source || record.run_id_provenance !== 'derived_from_documented_fixed_lead_offset') {
    throw new TypeError('historical forecast source URL and derived run ID provenance are required');
  }
  return record;
}

function validateHistoricalReference(record) {
  validateObservationRecord(record);
  if (record.source_kind !== 'REANALYSIS_REFERENCE' || record.reference_type !== 'REANALYSIS_REFERENCE') {
    throw new TypeError('reference must be explicitly labeled REANALYSIS_REFERENCE');
  }
  if (record.variable !== HISTORICAL_VARIABLE || record.unit !== HISTORICAL_UNIT) {
    throw new TypeError('historical references must use temperature_2m normalized to °C');
  }
  if (record.latitude !== record.location.latitude || record.longitude !== record.location.longitude) {
    throw new RangeError('top-level reference coordinates must match location coordinates');
  }
  validateCoordinateProvenance(record, 'reference');
  parseUtcTimestamp(record.retrieved_at, 'retrieved_at');
  if (record.source_url !== record.source) throw new TypeError('historical reference source URL provenance is required');
  return record;
}

function validateCoordinateProvenance(record, label) {
  for (const key of ['requested_location', 'resolved_location']) {
    const location = record[key];
    if (location === null || typeof location !== 'object') {
      throw new TypeError(`${label}.${key} is required`);
    }
    requireFiniteCoordinate(location.latitude, `${label}.${key}.latitude`, -90, 90);
    requireFiniteCoordinate(location.longitude, `${label}.${key}.longitude`, -180, 180);
  }
  if (record.latitude !== record.resolved_location.latitude ||
      record.longitude !== record.resolved_location.longitude) {
    throw new RangeError(`${label} coordinates must equal the API-resolved coordinates`);
  }
}

/**
 * Build exact-timestamp forecast/reference pairs using Stage 1 variable, unit,
 * timestamp, and location rules. No interpolation, nearest-time, or nearby-cell
 * fallback is used. Reference available_at is intentionally not compared to
 * forecast initialization: references are post-hoc verification labels.
 * @param {{forecasts: object[], references: object[]}} input
 * @returns {{pairs: object[], diagnostics: object}}
 */
export function buildVerificationPairs({ forecasts, references } = {}) {
  if (!Array.isArray(forecasts) || !Array.isArray(references)) {
    throw new TypeError('forecasts and references must both be arrays');
  }

  const acceptedForecasts = [];
  const acceptedReferences = [];
  const rejectedRecords = [];
  forecasts.forEach((record, index) => {
    try {
      acceptedForecasts.push(validateHistoricalForecast(record));
    } catch (error) {
      rejectedRecords.push({
        record_type: 'forecast',
        record_id: record?.forecast_id || null,
        index,
        reason: `INVALID_HISTORICAL_FORECAST: ${error.message}`,
      });
    }
  });
  references.forEach((record, index) => {
    try {
      acceptedReferences.push(validateHistoricalReference(record));
    } catch (error) {
      rejectedRecords.push({
        record_type: 'reference',
        record_id: record?.observation_id || null,
        index,
        reason: `INVALID_REFERENCE: ${error.message}`,
      });
    }
  });

  const matchResult = matchForecastObservations({
    forecasts: acceptedForecasts,
    observations: acceptedReferences,
  });
  rejectedRecords.push(...matchResult.rejected);

  const pairs = matchResult.matches.map((match) => {
    const timestampDifferenceSeconds = (
      parseUtcTimestamp(match.forecast.valid_time) -
      parseUtcTimestamp(match.observation.observation_time)
    ) / 1000;
    return {
      forecast: match.forecast,
      reference: match.observation,
      forecast_minus_reference: match.forecast_minus_observation,
      alignment: {
        method: 'exact_timestamp',
        timestamp_difference_seconds: timestampDifferenceSeconds,
        location_match: true,
        variable_match: true,
        unit_match: true,
        lead_time_match: true,
      },
    };
  });

  return {
    pairs,
    diagnostics: {
      forecast_count: forecasts.length,
      reference_count: references.length,
      matched_count: pairs.length,
      unmatched_forecasts: matchResult.unmatchedForecasts,
      unmatched_references: matchResult.unmatchedObservations,
      rejected_records: rejectedRecords,
    },
  };
}