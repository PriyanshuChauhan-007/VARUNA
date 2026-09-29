import { validateForecastRecord, validateObservationRecord } from './types.js';
import { parseUtcTimestamp } from './time.js';

function isDemoOrMock(record) {
  const provenance = [
    record.mode,
    record.source,
    record.source_dataset,
    record.dataset_id,
    record.run_id,
  ];
  return provenance.some((value) => typeof value === 'string' && /demo|mock/i.test(value));
}

function makeMatchKey(variable, unit, timestampMilliseconds, location) {
  return JSON.stringify([variable, unit, timestampMilliseconds, location]);
}

function compareIds(first, second) {
  return first.localeCompare(second);
}

function compareObservations(first, second) {
  const firstTieKey = JSON.stringify([
    first.observation_id,
    first.observation_time,
    first.available_at,
    first.value,
    first.source_kind,
    first.source,
    first.dataset_id,
    first.dataset_version,
    first.quality_status,
    first.mode || null,
  ]);
  const secondTieKey = JSON.stringify([
    second.observation_id,
    second.observation_time,
    second.available_at,
    second.value,
    second.source_kind,
    second.source,
    second.dataset_id,
    second.dataset_version,
    second.quality_status,
    second.mode || null,
  ]);
  return compareIds(first.observation_id, second.observation_id) || compareIds(firstTieKey, secondTieKey);
}

/**
 * Match records only on variable, unit, exact instant, and location. For duplicate
 * observations at one key, the lexically smallest observation_id is selected and
 * the remaining records are reported as rejected. A selected observation may be
 * reused across distinct forecasts/runs for fair model comparison.
 * @param {object} input
 * @param {import('./types.js').ForecastRecord[]} input.forecasts
 * @param {import('./types.js').ObservationRecord[]} input.observations
 * @param {boolean} [input.includeDemo=false] Explicit opt-in for demo/mock fixtures.
 * @returns {{matches: import('./types.js').MatchedForecastObservation[], unmatchedForecasts: Array<{forecast_id: string, reason: string}>, unmatchedObservations: Array<{observation_id: string, reason: string}>, rejected: Array<{record_type: string, record_id: string|null, reason: string}>}}
 */
export function matchForecastObservations({ forecasts, observations, includeDemo = false } = {}) {
  if (!Array.isArray(forecasts) || !Array.isArray(observations)) {
    throw new TypeError('forecasts and observations must both be arrays');
  }
  if (typeof includeDemo !== 'boolean') {
    throw new TypeError('includeDemo must be a boolean');
  }

  const rejected = [];
  const validForecasts = [];
  const validObservations = [];

  forecasts.forEach((record, index) => {
    try {
      validateForecastRecord(record);
      if (!includeDemo && isDemoOrMock(record)) {
        rejected.push({
          record_type: 'forecast',
          record_id: record.forecast_id,
          reason: 'DEMO_OR_MOCK_NOT_HISTORICAL_EVIDENCE',
        });
        return;
      }
      validForecasts.push({ record, index });
    } catch (error) {
      rejected.push({
        record_type: 'forecast',
        record_id: record?.forecast_id || null,
        reason: `INVALID_RECORD: ${error.message}`,
        index,
      });
    }
  });

  observations.forEach((record, index) => {
    try {
      validateObservationRecord(record);
      if (!includeDemo && isDemoOrMock(record)) {
        rejected.push({
          record_type: 'observation',
          record_id: record.observation_id,
          reason: 'DEMO_OR_MOCK_NOT_HISTORICAL_EVIDENCE',
        });
        return;
      }
      validObservations.push({ record, index });
    } catch (error) {
      rejected.push({
        record_type: 'observation',
        record_id: record?.observation_id || null,
        reason: `INVALID_RECORD: ${error.message}`,
        index,
      });
    }
  });

  const observationsByKey = new Map();
  for (const { record } of validObservations) {
    const location = record.location;
    const normalizedLocation = location.location_id
      ? `id:${location.location_id}`
      : `coordinates:${location.latitude},${location.longitude}`;
    const key = makeMatchKey(
      record.variable,
      record.unit,
      parseUtcTimestamp(record.observation_time, 'observation_time'),
      normalizedLocation
    );
    const group = observationsByKey.get(key) || [];
    group.push(record);
    observationsByKey.set(key, group);
  }

  const selectedObservations = new Map();
  for (const [key, records] of observationsByKey) {
    records.sort(compareObservations);
    selectedObservations.set(key, records[0]);
    for (const duplicate of records.slice(1)) {
      rejected.push({
        record_type: 'observation',
        record_id: duplicate.observation_id,
        reason: 'DUPLICATE_MATCH_KEY; lexically smallest observation_id selected',
      });
    }
  }

  const matches = [];
  const unmatchedForecasts = [];
  const matchedObservationIds = new Set();

  validForecasts.sort((first, second) =>
    compareIds(first.record.forecast_id, second.record.forecast_id) || first.index - second.index
  );

  for (const { record: forecast } of validForecasts) {
    const timestampMilliseconds = parseUtcTimestamp(forecast.valid_time, 'valid_time');
    const locationId = forecast.location.location_id;
    const forecastLocationKey = locationId
      ? `id:${locationId}`
      : `coordinates:${forecast.location.latitude},${forecast.location.longitude}`;
    const key = makeMatchKey(forecast.variable, forecast.unit, timestampMilliseconds, forecastLocationKey);
    const observation = selectedObservations.get(key);

    if (!observation) {
      unmatchedForecasts.push({ forecast_id: forecast.forecast_id, reason: 'NO_EXACT_COMPATIBLE_OBSERVATION' });
      continue;
    }

    const error = forecast.value - observation.value;
    matches.push({
      match_id: `${forecast.forecast_id}::${observation.observation_id}`,
      forecast_id: forecast.forecast_id,
      observation_id: observation.observation_id,
      forecast,
      observation,
      forecast_minus_observation: error,
    });
    matchedObservationIds.add(observation.observation_id);
  }

  const unmatchedObservations = [...selectedObservations.values()]
    .filter((record) => !matchedObservationIds.has(record.observation_id))
    .map((record) => ({ observation_id: record.observation_id, reason: 'NO_EXACT_COMPATIBLE_FORECAST' }))
    .sort((first, second) => compareIds(first.observation_id, second.observation_id));

  rejected.sort((first, second) =>
    compareIds(`${first.record_type}:${first.record_id || ''}`, `${second.record_type}:${second.record_id || ''}`)
  );

  return { matches, unmatchedForecasts, unmatchedObservations, rejected };
}