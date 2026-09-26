import { validateLeadTime } from './time.js';
import { parseUtcTimestamp } from './time.js';

export const FORECAST_MODES = Object.freeze(['LIVE', 'REPLAY', 'ARCHIVE', 'DEMO', 'MOCK']);
export const OBSERVATION_SOURCE_KINDS = Object.freeze([
  'STATION_OBSERVATION',
  'REANALYSIS_REFERENCE',
]);

/**
 * @typedef {object} VerificationLocation
 * @property {string=} location_id
 * @property {number=} latitude
 * @property {number=} longitude
 */

/**
 * @typedef {object} ForecastRecord
 * @property {string} forecast_id
 * @property {string} model_id
 * @property {string|null} model_version
 * @property {string} variable
 * @property {number} value
 * @property {string} unit
 * @property {string} initialization_time ISO 8601 UTC timestamp ending in Z.
 * @property {string} valid_time ISO 8601 UTC timestamp ending in Z.
 * @property {number} lead_time_hours Derived from valid_time - initialization_time.
 * @property {VerificationLocation} location
 * @property {string} source
 * @property {string} source_dataset
 * @property {string} run_id
 * @property {'LIVE'|'REPLAY'|'ARCHIVE'|'DEMO'|'MOCK'} mode
 */

/**
 * @typedef {object} ObservationRecord
 * @property {string} observation_id
 * @property {string} variable
 * @property {number} value
 * @property {string} unit
 * @property {string} observation_time ISO 8601 UTC timestamp ending in Z.
 * @property {string} available_at ISO 8601 UTC timestamp ending in Z.
 * @property {VerificationLocation} location
 * @property {'STATION_OBSERVATION'|'REANALYSIS_REFERENCE'} source_kind
 * @property {string} source
 * @property {string} dataset_id
 * @property {string|null} dataset_version
 * @property {string} quality_status
 * @property {'LIVE'|'REPLAY'|'ARCHIVE'|'DEMO'|'MOCK'=} mode
 */

/**
 * @typedef {object} MatchedForecastObservation
 * @property {string} match_id
 * @property {string} forecast_id
 * @property {string} observation_id
 * @property {ForecastRecord} forecast
 * @property {ObservationRecord} observation
 * @property {number} forecast_minus_observation
 */

/**
 * @typedef {object} SkillMetrics
 * @property {number} sample_count
 * @property {number|null} mae
 * @property {number|null} rmse
 * @property {number|null} bias
 * @property {number|null} pearson_correlation
 */

function requireRecord(record, label) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function requireNonEmptyString(record, field, label) {
  if (typeof record[field] !== 'string' || record[field].trim() === '') {
    throw new TypeError(`${label}.${field} must be a non-empty string`);
  }
}

function requireNullableString(record, field, label) {
  if (record[field] !== null && typeof record[field] !== 'string') {
    throw new TypeError(`${label}.${field} must be a string or null`);
  }
}

function requireFiniteNumber(record, field, label) {
  if (typeof record[field] !== 'number' || !Number.isFinite(record[field])) {
    throw new TypeError(`${label}.${field} must be a finite number`);
  }
}

function validateLocation(location, label) {
  requireRecord(location, `${label}.location`);

  if (location.location_id !== undefined && location.location_id !== null &&
      (typeof location.location_id !== 'string' || location.location_id.trim() === '')) {
    throw new TypeError(`${label}.location.location_id must be a non-empty string when provided`);
  }

  const hasLatitude = location.latitude !== undefined;
  const hasLongitude = location.longitude !== undefined;
  if (hasLatitude !== hasLongitude) {
    throw new TypeError(`${label}.location must provide both latitude and longitude`);
  }
  if (hasLatitude) {
    requireFiniteNumber(location, 'latitude', `${label}.location`);
    requireFiniteNumber(location, 'longitude', `${label}.location`);
    if (location.latitude < -90 || location.latitude > 90) {
      throw new RangeError(`${label}.location.latitude must be between -90 and 90`);
    }
    if (location.longitude < -180 || location.longitude > 180) {
      throw new RangeError(`${label}.location.longitude must be between -180 and 180`);
    }
  }
  if (!location.location_id && !hasLatitude) {
    throw new TypeError(`${label}.location requires location_id or latitude/longitude`);
  }
}

/**
 * Validate and return a normalized forecast record without coercing its values.
 * @param {ForecastRecord} record
 * @returns {ForecastRecord}
 */
export function validateForecastRecord(record) {
  requireRecord(record, 'ForecastRecord');
  for (const field of ['forecast_id', 'model_id', 'variable', 'unit', 'source', 'source_dataset', 'run_id']) {
    requireNonEmptyString(record, field, 'ForecastRecord');
  }
  requireNullableString(record, 'model_version', 'ForecastRecord');
  requireFiniteNumber(record, 'value', 'ForecastRecord');
  requireFiniteNumber(record, 'lead_time_hours', 'ForecastRecord');
  if (!FORECAST_MODES.includes(record.mode)) {
    throw new TypeError(`ForecastRecord.mode must be one of: ${FORECAST_MODES.join(', ')}`);
  }
  validateLocation(record.location, 'ForecastRecord');
  validateLeadTime(record);
  return record;
}

/**
 * Validate and return an observation record without coercing its values.
 * @param {ObservationRecord} record
 * @returns {ObservationRecord}
 */
export function validateObservationRecord(record) {
  requireRecord(record, 'ObservationRecord');
  for (const field of [
    'observation_id',
    'variable',
    'unit',
    'source',
    'dataset_id',
    'quality_status',
  ]) {
    requireNonEmptyString(record, field, 'ObservationRecord');
  }
  requireNullableString(record, 'dataset_version', 'ObservationRecord');
  requireFiniteNumber(record, 'value', 'ObservationRecord');
  if (!OBSERVATION_SOURCE_KINDS.includes(record.source_kind)) {
    throw new TypeError(
      `ObservationRecord.source_kind must be one of: ${OBSERVATION_SOURCE_KINDS.join(', ')}`
    );
  }
  if (record.mode !== undefined && !FORECAST_MODES.includes(record.mode)) {
    throw new TypeError(`ObservationRecord.mode must be one of: ${FORECAST_MODES.join(', ')}`);
  }
  parseUtcTimestamp(record.observation_time, 'observation_time');
  parseUtcTimestamp(record.available_at, 'available_at');
  validateLocation(record.location, 'ObservationRecord');
  return record;
}