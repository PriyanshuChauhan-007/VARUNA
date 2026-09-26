import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateBias,
  calculateMAE,
  calculatePearsonCorrelation,
  calculateRMSE,
  calculateSkill,
  createChronologicalSplits,
  createEvaluationMetadata,
  createWalkForwardFolds,
  createSkillEvaluationTable,
  deriveLeadTimeHours,
  buildVerificationPairs,
  fetchHistoricalForecast,
  fetchReferenceData,
  HISTORICAL_MODEL_IDS,
  evaluateHistoricalSkill,
  evaluateWalkForwardSkill,
  normalizeHistoricalForecastRecord,
  normalizeHistoricalForecastResponse,
  normalizeReferenceResponse,
  matchForecastObservations,
  sortForecastsChronologically,
  summarizeSkillByLead,
  validateForecastRecord,
  validateEvaluationFold,
  validateLeadTime,
  validateNoTemporalLeakage,
  validateObservationRecord,
} from './index.js';

const forecastTemplate = {
  forecast_id: 'forecast-1',
  model_id: 'ecmwf-ifs',
  model_version: 'test-version',
  variable: 'temperature',
  value: 12,
  unit: 'C',
  initialization_time: '2026-09-24T00:00:00Z',
  valid_time: '2026-09-25T00:00:00Z',
  lead_time_hours: 24,
  location: { location_id: 'station-1', latitude: 28.6, longitude: 77.2 },
  source: 'forecast archive',
  source_dataset: 'model archive',
  run_id: 'run-1',
  mode: 'ARCHIVE',
};

const observationTemplate = {
  observation_id: 'observation-1',
  variable: 'temperature',
  value: 10,
  unit: 'C',
  observation_time: '2026-09-25T00:00:00Z',
  available_at: '2026-09-25T00:15:00Z',
  location: { location_id: 'station-1', latitude: 28.6, longitude: 77.2 },
  source_kind: 'STATION_OBSERVATION',
  source: 'station network',
  dataset_id: 'observations-v1',
  dataset_version: '1',
  quality_status: 'ACCEPTED',
};

function forecast(overrides = {}) {
  return { ...forecastTemplate, ...overrides };
}

function observation(overrides = {}) {
  return { ...observationTemplate, ...overrides };
}

test('derives lead time from initialization and valid timestamps', () => {
  assert.equal(deriveLeadTimeHours('2026-09-24T00:00:00Z', '2026-09-25T06:00:00Z'), 30);
  assert.equal(deriveLeadTimeHours('2026-09-24T00:00:00.500Z', '2026-09-24T01:00:00Z'), 0.9998611111111111);
});

test('validates a derived lead time and rejects an inconsistent one', () => {
  assert.equal(validateLeadTime(forecast()), true);
  assert.throws(() => validateLeadTime(forecast({ lead_time_hours: 48 })), /does not agree/);
  assert.throws(() => validateForecastRecord(forecast({ lead_time_hours: 48 })), /does not agree/);
});

test('rejects invalid UTC timestamps and negative forecast leads', () => {
  assert.throws(() => deriveLeadTimeHours('not-a-time', '2026-09-25T00:00:00Z'), /ISO 8601 UTC/);
  assert.throws(() => deriveLeadTimeHours('2026-02-30T00:00:00Z', '2026-03-01T00:00:00Z'), /valid UTC/);
  assert.throws(() => deriveLeadTimeHours('2026-09-25T00:00:00Z', '2026-09-24T00:00:00Z'), /at or after/);
  assert.throws(() => validateObservationRecord(observation({ available_at: 'invalid' })), /ISO 8601 UTC/);
});

test('matches exact variable, unit, valid time, and location and exposes the error', () => {
  const result = matchForecastObservations({
    forecasts: [forecast()],
    observations: [observation()],
  });
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].forecast_id, 'forecast-1');
  assert.equal(result.matches[0].observation_id, 'observation-1');
  assert.equal(result.matches[0].forecast_minus_observation, 2);
  assert.equal(result.matches[0].match_id, 'forecast-1::observation-1');
  assert.deepEqual(result.unmatchedForecasts, []);
  assert.deepEqual(result.unmatchedObservations, []);
});

test('does not match mismatched variable, unit, time, or location', () => {
  const cases = [
    { forecast: forecast(), observation: observation({ variable: 'wind_speed' }) },
    { forecast: forecast(), observation: observation({ unit: 'F' }) },
    { forecast: forecast(), observation: observation({ observation_time: '2026-09-25T00:00:01Z' }) },
    { forecast: forecast(), observation: observation({ location: { location_id: 'station-2' } }) },
  ];
  for (const pair of cases) {
    const result = matchForecastObservations({ forecasts: [pair.forecast], observations: [pair.observation] });
    assert.equal(result.matches.length, 0);
    assert.equal(result.unmatchedForecasts.length, 1);
  }
});

test('resolves duplicate observations deterministically by lexical ID', () => {
  const duplicateZ = observation({ observation_id: 'observation-z', value: 11 });
  const duplicateA = observation({ observation_id: 'observation-a', value: 9 });
  const firstOrder = matchForecastObservations({
    forecasts: [forecast()],
    observations: [duplicateZ, duplicateA],
  });
  const reverseOrder = matchForecastObservations({
    forecasts: [forecast()],
    observations: [duplicateA, duplicateZ],
  });
  assert.equal(firstOrder.matches[0].observation_id, 'observation-a');
  assert.deepEqual(firstOrder.matches, reverseOrder.matches);
  assert.ok(firstOrder.rejected.some((item) => item.record_id === 'observation-z' && item.reason.startsWith('DUPLICATE')));

  const sameIdHigh = observation({ observation_id: 'observation-same', value: 11 });
  const sameIdLow = observation({ observation_id: 'observation-same', value: 9 });
  const tiedIdFirst = matchForecastObservations({
    forecasts: [forecast()],
    observations: [sameIdHigh, sameIdLow],
  });
  const tiedIdReverse = matchForecastObservations({
    forecasts: [forecast()],
    observations: [sameIdLow, sameIdHigh],
  });
  assert.deepEqual(tiedIdFirst.matches, tiedIdReverse.matches);
});

test('calculates MAE, RMSE, and signed bias', () => {
  const errors = [1, -2, 3];
  assert.equal(calculateMAE(errors), 2);
  assert.equal(calculateRMSE(errors), Math.sqrt(14 / 3));
  assert.equal(calculateBias(errors), 2 / 3);
});

test('calculates Pearson correlation and returns null when undefined', () => {
  assert.equal(calculatePearsonCorrelation([1, 2, 3], [2, 4, 6]), 1);
  assert.equal(calculatePearsonCorrelation([1, 2, 3], [6, 4, 2]), -1);
  assert.equal(calculatePearsonCorrelation([1, 2], [3, 3]), null);
  assert.equal(calculatePearsonCorrelation([1], [3]), null);
  assert.throws(() => calculatePearsonCorrelation([1, 2], [3]), /same length/);
});

test('returns null metrics for empty inputs', () => {
  assert.equal(calculateMAE([]), null);
  assert.equal(calculateRMSE([]), null);
  assert.equal(calculateBias([]), null);
  assert.equal(calculatePearsonCorrelation([], []), null);
  assert.deepEqual(calculateSkill([]), {
    sample_count: 0,
    mae: null,
    rmse: null,
    bias: null,
    pearson_correlation: null,
  });
});

test('rejects malformed records and reports them during matching', () => {
  assert.throws(() => validateForecastRecord(forecast({ value: '12' })), /finite number/);
  assert.throws(() => validateObservationRecord(observation({ source_kind: 'GROUND_TRUTH' })), /source_kind/);
  const result = matchForecastObservations({
    forecasts: [forecast({ forecast_id: '' })],
    observations: [observation({ value: Number.NaN })],
  });
  assert.equal(result.matches.length, 0);
  assert.equal(result.rejected.length, 2);
  assert.ok(result.rejected.every((item) => item.reason.startsWith('INVALID_RECORD')));
});

test('rejects demo and mock provenance unless explicitly opted in', () => {
  const demoForecast = forecast({ mode: 'DEMO', source: 'generated demo forecast' });
  const demoObservation = observation({ source: 'mock reference values' });
  const defaultResult = matchForecastObservations({
    forecasts: [demoForecast],
    observations: [demoObservation],
  });
  assert.equal(defaultResult.matches.length, 0);
  assert.equal(defaultResult.rejected.length, 2);
  assert.ok(defaultResult.rejected.every((item) => item.reason === 'DEMO_OR_MOCK_NOT_HISTORICAL_EVIDENCE'));

  const optedInResult = matchForecastObservations({
    forecasts: [demoForecast],
    observations: [demoObservation],
    includeDemo: true,
  });
  assert.equal(optedInResult.matches.length, 1);
});

test('calculates skill from matched records with sample count', () => {
  const forecasts = [
    forecast({ forecast_id: 'f1', value: 11 }),
    forecast({
      forecast_id: 'f2',
      value: 13,
      initialization_time: '2026-09-23T00:00:00Z',
      lead_time_hours: 48,
      run_id: 'run-2',
    }),
  ];
  const observations = [observation({ observation_id: 'o1', value: 10 })];
  const matches = matchForecastObservations({ forecasts, observations }).matches;
  const metrics = calculateSkill(matches);
  assert.equal(metrics.sample_count, 2);
  assert.equal(metrics.mae, 2);
  assert.equal(metrics.rmse, Math.sqrt(5));
  assert.equal(metrics.bias, 2);
  assert.equal(metrics.pearson_correlation, null);
});

function chronologicalRecords(count = 6) {
  return Array.from({ length: count }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return forecast({
      forecast_id: `forecast-${day}`,
      initialization_time: `2026-06-${day}T00:00:00Z`,
      valid_time: `2026-06-${day}T12:00:00Z`,
      lead_time_hours: 12,
      run_id: `run-${day}`,
    });
  });
}

test('chronological ordering sorts shuffled records by initialization time', () => {
  const shuffled = [chronologicalRecords(3)[2], chronologicalRecords(3)[0], chronologicalRecords(3)[1]];
  assert.deepEqual(
    sortForecastsChronologically(shuffled).map((record) => record.forecast_id),
    ['forecast-01', 'forecast-02', 'forecast-03']
  );
});

test('chronological date-boundary split keeps disjoint ordered partitions', () => {
  const records = chronologicalRecords();
  const split = createChronologicalSplits([...records].reverse(), {
    trainEnd: '2026-06-02T23:59:59Z',
    validationEnd: '2026-06-04T23:59:59Z',
  });
  assert.deepEqual(split.train.map((record) => record.forecast_id), ['forecast-01', 'forecast-02']);
  assert.deepEqual(split.validation.map((record) => record.forecast_id), ['forecast-03', 'forecast-04']);
  assert.deepEqual(split.test.map((record) => record.forecast_id), ['forecast-05', 'forecast-06']);
  const partitionIds = [...split.train, ...split.validation, ...split.test].map((record) => record.forecast_id);
  assert.equal(new Set(partitionIds).size, records.length);
});

test('rejects invalid initialization timestamps during chronological processing', () => {
  assert.throws(
    () => sortForecastsChronologically([forecast({ initialization_time: '2026-06-31T00:00:00Z' })]),
    /records\[0\] is invalid/
  );
});

test('uses forecast_id as a deterministic tie-break for equal initialization times', () => {
  const sameTime = [
    forecast({ forecast_id: 'forecast-b' }),
    forecast({ forecast_id: 'forecast-a' }),
  ];
  const expected = ['forecast-a', 'forecast-b'];
  assert.deepEqual(sortForecastsChronologically(sameTime).map((record) => record.forecast_id), expected);
  assert.deepEqual(sortForecastsChronologically(sameTime).map((record) => record.forecast_id), expected);
});

test('walk-forward folds expand training to include earlier evaluation records', () => {
  const folds = createWalkForwardFolds(chronologicalRecords(), { initialTrainSize: 2, evaluationSize: 1 });
  assert.equal(folds.length, 4);
  assert.deepEqual(folds[0].train_records.map((record) => record.forecast_id), ['forecast-01', 'forecast-02']);
  assert.deepEqual(folds[0].evaluation_records.map((record) => record.forecast_id), ['forecast-03']);
  assert.deepEqual(folds[1].train_records.map((record) => record.forecast_id), [
    'forecast-01', 'forecast-02', 'forecast-03',
  ]);
  assert.deepEqual(folds[1].evaluation_records.map((record) => record.forecast_id), ['forecast-04']);
});

test('walk-forward folds satisfy initialization-time temporal integrity', () => {
  const folds = createWalkForwardFolds(chronologicalRecords(), { initialTrainSize: 2, evaluationSize: 2 });
  for (const fold of folds) {
    assert.ok(fold.train_records.every((record) => record.initialization_time <= fold.training_cutoff));
    assert.ok(fold.evaluation_records.every((record) => record.initialization_time > fold.training_cutoff));
    assert.deepEqual(validateEvaluationFold(fold), { valid: true, violations: [] });
  }
});

test('rejects observations unavailable at issuance even when observation_time is earlier', () => {
  const issuedForecast = forecast({
    initialization_time: '2026-06-11T00:00:00Z',
    valid_time: '2026-06-12T00:00:00Z',
    lead_time_hours: 24,
  });
  const lateObservation = observation({
    observation_time: '2026-06-10T00:00:00Z',
    available_at: '2026-06-11T12:00:00Z',
  });
  const result = validateNoTemporalLeakage({ observationUses: [{ forecast: issuedForecast, observation: lateObservation }] });
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((violation) =>
    violation.type === 'OBSERVATION_NOT_AVAILABLE_AT_INITIALIZATION' &&
    violation.forecast_id === issuedForecast.forecast_id &&
    violation.observation_id === lateObservation.observation_id
  ));
});

test('accepts historical observations available by forecast initialization', () => {
  const issuedForecast = forecast({
    initialization_time: '2026-06-11T00:00:00Z',
    valid_time: '2026-06-12T00:00:00Z',
    lead_time_hours: 24,
  });
  const availableObservation = observation({
    observation_time: '2026-06-10T00:00:00Z',
    available_at: '2026-06-10T23:59:59Z',
  });
  assert.deepEqual(
    validateNoTemporalLeakage({ observationUses: [{ forecast: issuedForecast, observation: availableObservation }] }),
    { valid: true, violations: [] }
  );
});

test('rejects skill inputs with timestamps beyond forecast initialization', () => {
  const issuedForecast = forecast({
    initialization_time: '2026-06-11T00:00:00Z',
    valid_time: '2026-06-12T00:00:00Z',
    lead_time_hours: 24,
  });
  const result = validateNoTemporalLeakage({
    forecast: issuedForecast,
    skillInputs: [{ evaluation_end: '2026-06-11T00:00:01Z' }],
  });
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((violation) =>
    violation.type === 'SKILL_INPUT_AFTER_FORECAST_INITIALIZATION' && violation.field === 'evaluation_end'
  ));
});

test('detects evaluation records accidentally included in training', () => {
  const records = chronologicalRecords(3);
  const result = validateNoTemporalLeakage({
    trainingRecords: [records[0], records[2]],
    evaluationRecords: [records[2]],
    trainingCutoff: records[0].initialization_time,
  });
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((violation) => violation.type === 'TRAINING_RECORD_AFTER_CUTOFF'));
  assert.ok(result.violations.some((violation) => violation.type === 'EVALUATION_RECORD_IN_TRAINING'));
});

test('overlapping valid times do not override per-forecast availability cutoffs', () => {
  const forecastA = forecast({
    forecast_id: 'forecast-june-1',
    initialization_time: '2026-06-01T00:00:00Z',
    valid_time: '2026-06-03T00:00:00Z',
    lead_time_hours: 48,
  });
  const forecastB = forecast({
    forecast_id: 'forecast-june-2',
    initialization_time: '2026-06-02T00:00:00Z',
    valid_time: '2026-06-03T00:00:00Z',
    lead_time_hours: 24,
  });
  const sharedTargetObservation = observation({
    observation_time: '2026-06-03T00:00:00Z',
    available_at: '2026-06-03T00:15:00Z',
  });
  const folds = createWalkForwardFolds([forecastB, forecastA], { initialTrainSize: 1, evaluationSize: 1 });
  assert.equal(folds[0].train_records[0].forecast_id, forecastA.forecast_id);
  assert.equal(folds[0].evaluation_records[0].forecast_id, forecastB.forecast_id);
  assert.deepEqual(
    validateNoTemporalLeakage({ observationUses: [{ forecast: forecastB, observation: sharedTargetObservation }] })
      .violations.map((violation) => violation.type),
    ['OBSERVATION_NOT_AVAILABLE_AT_INITIALIZATION']
  );
});

test('split and walk-forward outputs are deterministic for identical inputs', () => {
  const records = chronologicalRecords();
  const options = { initialTrainSize: 2, evaluationSize: 1 };
  assert.deepEqual(
    createChronologicalSplits(records, { trainRatio: 0.5, validationRatio: 0.25, testRatio: 0.25 }),
    createChronologicalSplits(records, { trainRatio: 0.5, validationRatio: 0.25, testRatio: 0.25 })
  );
  assert.deepEqual(createWalkForwardFolds(records, options), createWalkForwardFolds(records, options));
});

test('chronological processing does not mutate the caller records array', () => {
  const records = Object.freeze([...chronologicalRecords()].reverse());
  const originalIds = records.map((record) => record.forecast_id);
  sortForecastsChronologically(records);
  createChronologicalSplits(records, { trainRatio: 0.5, validationRatio: 0.25, testRatio: 0.25 });
  createWalkForwardFolds(records, { initialTrainSize: 2, evaluationSize: 1 });
  assert.deepEqual(records.map((record) => record.forecast_id), originalIds);
});

test('validates that supplied evaluation metadata is explicit and internally ordered', () => {
  const metadata = createEvaluationMetadata({
    evaluation_id: 'evaluation-run-1',
    fold_id: 'walk-forward-001',
    model_id: 'ecmwf-ifs',
    model_version: null,
    variable: 'temperature',
    lead_time_hours: 24,
    training_cutoff: '2026-06-02T00:00:00Z',
    evaluation_start: '2026-06-03T00:00:00Z',
    evaluation_end: '2026-06-03T00:00:00Z',
    reference_dataset: 'reference-v1',
    methodology_version: '1',
  });
  assert.equal(metadata.evaluation_id, 'evaluation-run-1');
  assert.throws(() => createEvaluationMetadata({}), /evaluation_id is required/);
});

const HISTORICAL_SAMPLE_DATE = '2026-09-19';
const HISTORICAL_RETRIEVED_AT = '2026-09-26T12:00:00Z';
const PREVIOUS_RUNS_FIXTURE_URL = 'https://previous-runs-api.open-meteo.com/v1/forecast?fixture=1';
const ERA5_FIXTURE_URL = 'https://archive-api.open-meteo.com/v1/archive?fixture=1';

function previousRunsResponse({
  times = [`${HISTORICAL_SAMPLE_DATE}T00:00`, `${HISTORICAL_SAMPLE_DATE}T01:00`],
  day1 = [31.2, 30.8],
  day2 = [30.4, 30.1],
  latitude = 28.5,
  longitude = 77.25,
  unit = '°C',
} = {}) {
  return {
    latitude,
    longitude,
    timezone: 'GMT',
    utc_offset_seconds: 0,
    hourly_units: {
      time: 'iso8601',
      temperature_2m_previous_day1: unit,
      temperature_2m_previous_day2: unit,
    },
    hourly: {
      time: times,
      temperature_2m_previous_day1: day1,
      temperature_2m_previous_day2: day2,
    },
  };
}

function normalizeForecastFixture({ response = previousRunsResponse(), modelId = 'ecmwf_ifs025' } = {}) {
  return normalizeHistoricalForecastResponse(response, {
    modelId,
    latitude: 28.6139,
    longitude: 77.2090,
    startDate: HISTORICAL_SAMPLE_DATE,
    endDate: HISTORICAL_SAMPLE_DATE,
    leadTimes: [24, 48],
    retrievedAt: HISTORICAL_RETRIEVED_AT,
    sourceUrl: PREVIOUS_RUNS_FIXTURE_URL,
    requestParameters: { models: modelId, timezone: 'GMT' },
  });
}

function referenceResponse({
  times = [`${HISTORICAL_SAMPLE_DATE}T00:00`, `${HISTORICAL_SAMPLE_DATE}T01:00`],
  values = [30.0, 29.9],
  latitude = 28.5,
  longitude = 77.25,
  unit = '°C',
} = {}) {
  return {
    latitude,
    longitude,
    timezone: 'GMT',
    utc_offset_seconds: 0,
    hourly_units: { time: 'iso8601', temperature_2m: unit },
    hourly: { time: times, temperature_2m: values },
  };
}

function normalizeReferenceFixture(response = referenceResponse()) {
  return normalizeReferenceResponse(response, {
    latitude: 28.6139,
    longitude: 77.2090,
    startDate: HISTORICAL_SAMPLE_DATE,
    endDate: HISTORICAL_SAMPLE_DATE,
    retrievedAt: HISTORICAL_RETRIEVED_AT,
    sourceUrl: ERA5_FIXTURE_URL,
    requestParameters: { models: 'era5', timezone: 'GMT' },
  });
}

test('TEST 27: normalizes a historical Previous Runs forecast record', () => {
  const result = normalizeForecastFixture();
  const record = result.records.find((item) => item.lead_time_hours === 24);
  assert.ok(record);
  assert.equal(record.model, 'ECMWF IFS');
  assert.equal(record.variable, 'temperature_2m');
  assert.equal(record.value, 31.2);
  assert.equal(record.unit, '°C');
  assert.equal(record.mode, 'ARCHIVE');
});

test('TEST 28: derives lead time from initialization_time and valid_time', () => {
  const result = normalizeForecastFixture();
  const record = result.records.find((item) => item.valid_time === `${HISTORICAL_SAMPLE_DATE}T00:00:00Z` && item.lead_time_hours === 48);
  assert.ok(record);
  assert.equal(record.initialization_time, '2026-09-17T00:00:00.000Z');
  assert.equal(deriveLeadTimeHours(record.initialization_time, record.valid_time), 48);
});

test('TEST 29: rejects a provider lead that disagrees with timestamp-derived lead', () => {
  assert.throws(() => normalizeHistoricalForecastRecord({
    modelId: 'ecmwf_ifs025',
    value: 25,
    unit: '°C',
    latitude: 28.5,
    longitude: 77.25,
    initializationTime: '2026-09-18T00:00:00Z',
    validTime: '2026-09-19T00:00:00Z',
    leadTimeHours: 48,
    sourceUrl: PREVIOUS_RUNS_FIXTURE_URL,
    retrievedAt: HISTORICAL_RETRIEVED_AT,
  }), /disagrees/);
});

test('TEST 30: reports malformed provider timestamps as rejected rows', () => {
  const result = normalizeForecastFixture({
    response: previousRunsResponse({ times: ['not-a-timestamp'], day1: [25], day2: [24] }),
  });
  assert.equal(result.records.length, 0);
  assert.equal(result.rejected_records.length, 2);
  assert.ok(result.rejected_records.every((record) => record.reason.startsWith('INVALID_TIMESTAMP')));
});

test('TEST 31: aligns forecast and ERA5 reference at an exact timestamp', () => {
  const forecastRecord = normalizeForecastFixture().records.find((record) => record.lead_time_hours === 24);
  const referenceRecord = normalizeReferenceFixture().records[0];
  const result = buildVerificationPairs({ forecasts: [forecastRecord], references: [referenceRecord] });
  assert.equal(result.pairs.length, 1);
  assert.deepEqual(result.pairs[0].alignment, {
    method: 'exact_timestamp',
    timestamp_difference_seconds: 0,
    location_match: true,
    variable_match: true,
    unit_match: true,
    lead_time_match: true,
  });
});

test('TEST 32: rejects a one-hour timestamp mismatch without nearest-time matching', () => {
  const forecastRecord = normalizeForecastFixture().records.find((record) => record.lead_time_hours === 24);
  const referenceRecord = normalizeReferenceFixture().records[0];
  referenceRecord.observation_time = `${HISTORICAL_SAMPLE_DATE}T01:00:00Z`;
  const result = buildVerificationPairs({ forecasts: [forecastRecord], references: [referenceRecord] });
  assert.equal(result.pairs.length, 0);
  assert.equal(result.diagnostics.unmatched_forecasts.length, 1);
});

test('TEST 33: rejects a variable mismatch', () => {
  const forecastRecord = normalizeForecastFixture().records[0];
  const referenceRecord = normalizeReferenceFixture().records[0];
  referenceRecord.variable = 'dew_point_2m';
  const result = buildVerificationPairs({ forecasts: [forecastRecord], references: [referenceRecord] });
  assert.equal(result.pairs.length, 0);
  assert.equal(result.diagnostics.unmatched_forecasts.length, 1);
});

test('TEST 34: rejects a resolved-coordinate mismatch', () => {
  const forecastRecord = normalizeForecastFixture().records[0];
  const referenceRecord = normalizeReferenceFixture().records[0];
  referenceRecord.latitude += 0.01;
  referenceRecord.location.latitude += 0.01;
  const result = buildVerificationPairs({ forecasts: [forecastRecord], references: [referenceRecord] });
  assert.equal(result.pairs.length, 0);
  assert.equal(result.diagnostics.unmatched_forecasts.length, 1);
});

test('TEST 35: rejects a reference unit that was not normalized to Celsius', () => {
  const forecastRecord = normalizeForecastFixture().records[0];
  const referenceRecord = normalizeReferenceFixture().records[0];
  referenceRecord.unit = '°F';
  const result = buildVerificationPairs({ forecasts: [forecastRecord], references: [referenceRecord] });
  assert.equal(result.pairs.length, 0);
  assert.ok(result.diagnostics.rejected_records.some((record) => record.record_type === 'reference'));
});

test('TEST 36: rejects forecast time/value arrays with different lengths', () => {
  assert.throws(() => normalizeForecastFixture({
    response: previousRunsResponse({ day1: [25], day2: [24] }),
  }), /array length mismatch/);
  assert.throws(() => normalizeReferenceFixture({
    ...referenceResponse(),
    hourly: { ...referenceResponse().hourly, temperature_2m: [30] },
  }), /array length mismatch/);
});

test('TEST 37: reports forecasts that have no exact reference match', () => {
  const forecastRecord = normalizeForecastFixture().records[0];
  const result = buildVerificationPairs({ forecasts: [forecastRecord], references: [] });
  assert.equal(result.diagnostics.unmatched_forecasts.length, 1);
  assert.equal(result.diagnostics.unmatched_forecasts[0].forecast_id, forecastRecord.forecast_id);
});

test('TEST 38: reports reference records that have no exact forecast match', () => {
  const referenceRecord = normalizeReferenceFixture().records[0];
  const result = buildVerificationPairs({ forecasts: [], references: [referenceRecord] });
  assert.equal(result.diagnostics.unmatched_references.length, 1);
  assert.equal(result.diagnostics.unmatched_references[0].observation_id, referenceRecord.observation_id);
});

test('TEST 39: preserves source, request, run, and retrieval provenance', () => {
  const record = normalizeForecastFixture().records[0];
  assert.equal(record.source, PREVIOUS_RUNS_FIXTURE_URL);
  assert.equal(record.source_url, PREVIOUS_RUNS_FIXTURE_URL);
  assert.equal(record.request_parameters.models, 'ecmwf_ifs025');
  assert.equal(record.run_id, `ecmwf_ifs:${record.initialization_time}`);
  assert.equal(record.provider_run_id, null);
  assert.equal(record.run_id_provenance, 'derived_from_documented_fixed_lead_offset');
  assert.equal(record.retrieved_at, HISTORICAL_RETRIEVED_AT);
});

test('TEST 40: does not reject a post-hoc reference label available after forecast issuance', () => {
  const forecastRecord = normalizeForecastFixture().records[0];
  const referenceRecord = normalizeReferenceFixture().records[0];
  assert.ok(referenceRecord.available_at > forecastRecord.initialization_time);
  const result = buildVerificationPairs({ forecasts: [forecastRecord], references: [referenceRecord] });
  assert.equal(result.pairs.length, 1);
});

test('TEST 41: rejects that same late reference when used as forecast-time information', () => {
  const forecastRecord = normalizeForecastFixture().records[0];
  const referenceRecord = normalizeReferenceFixture().records[0];
  const result = validateNoTemporalLeakage({
    observationUses: [{ forecast: forecastRecord, observation: referenceRecord }],
  });
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((violation) =>
    violation.type === 'OBSERVATION_NOT_AVAILABLE_AT_INITIALIZATION'
  ));
});

test('TEST 42: returns structured ERROR on API failure without DEMO/mock fallback', async () => {
  await assert.rejects(
    fetchHistoricalForecast({
      modelId: 'ecmwf_ifs025',
      startDate: HISTORICAL_SAMPLE_DATE,
      endDate: HISTORICAL_SAMPLE_DATE,
      fetchImpl: async () => { throw new Error('network unavailable'); },
      now: () => new Date(HISTORICAL_RETRIEVED_AT),
    }),
    (error) => {
      assert.equal(error.name, 'HistoricalDataError');
      assert.equal(error.mode, 'ERROR');
      assert.equal(error.details.mode, 'ERROR');
      assert.equal(error.details.source, 'Open-Meteo Previous Runs API');
      assert.match(error.details.failure, /network unavailable/);
      assert.equal(error.details.request_parameters.models, 'ecmwf_ifs025');
      return true;
    }
  );
});

test('TEST 43: converts only explicitly known Fahrenheit values to Celsius', () => {
  const result = normalizeForecastFixture({
    response: previousRunsResponse({
      times: [`${HISTORICAL_SAMPLE_DATE}T00:00`],
      day1: [32],
      day2: [50],
      unit: '°F',
    }),
  });
  assert.equal(result.records[0].value, 0);
  assert.equal(result.records[0].unit, '°C');
  assert.equal(result.records[0].unit_normalization, 'fahrenheit_to_celsius');

  const unknownUnit = normalizeForecastFixture({
    response: previousRunsResponse({
      times: [`${HISTORICAL_SAMPLE_DATE}T00:00`],
      day1: [273],
      day2: [274],
      unit: 'K',
    }),
  });
  assert.equal(unknownUnit.records.length, 0);
  assert.equal(unknownUnit.rejected_records.length, 2);
});

test('TEST 44: reports missing fixed-lead values instead of silently skipping them', () => {
  const result = normalizeForecastFixture({
    response: previousRunsResponse({
      times: [`${HISTORICAL_SAMPLE_DATE}T00:00`],
      day1: [null],
      day2: [24],
    }),
  });
  assert.equal(result.records.length, 1);
  assert.equal(result.rejected_records.length, 1);
  assert.equal(result.rejected_records[0].reason, 'MISSING_FORECAST_VALUE');
});

function jsonResponse(body) {
  return { ok: true, json: async () => body, headers: { get: () => null } };
}

test('TEST 45: preserves requested and forecast-resolved coordinates separately', () => {
  const resolved = { latitude: 28.64302, longitude: 77.22656 };
  const result = normalizeForecastFixture({
    response: previousRunsResponse({ ...resolved, times: [`${HISTORICAL_SAMPLE_DATE}T00:00`], day1: [25], day2: [24] }),
  });
  assert.deepEqual(result.requested_location, { latitude: 28.6139, longitude: 77.209 });
  assert.deepEqual(result.resolved_location, resolved);
  assert.deepEqual(result.records[0].requested_location, result.requested_location);
  assert.deepEqual(result.records[0].resolved_location, resolved);
});

test('TEST 46: requests ERA5 at the forecast response resolved coordinates', async () => {
  const requestedLocation = { latitude: 28.6139, longitude: 77.2090 };
  const resolvedLocation = { latitude: 28.64302, longitude: 77.22656 };
  const urls = [];
  const fetchImpl = async (requestUrl) => {
    const url = new URL(requestUrl);
    urls.push(url);
    if (url.hostname === 'previous-runs-api.open-meteo.com') {
      return jsonResponse(previousRunsResponse({
        ...resolvedLocation,
        times: [`${HISTORICAL_SAMPLE_DATE}T00:00`],
        day1: [25],
        day2: [24],
      }));
    }
    return jsonResponse(referenceResponse({
      ...resolvedLocation,
      times: [`${HISTORICAL_SAMPLE_DATE}T00:00`],
      values: [24],
    }));
  };
  const forecastResult = await fetchHistoricalForecast({
    modelId: HISTORICAL_MODEL_IDS.GFS,
    ...requestedLocation,
    startDate: HISTORICAL_SAMPLE_DATE,
    endDate: HISTORICAL_SAMPLE_DATE,
    leadTimes: [24],
    fetchImpl,
    now: () => new Date(HISTORICAL_RETRIEVED_AT),
  });
  const referenceResult = await fetchReferenceData({
    ...forecastResult.resolved_location,
    startDate: HISTORICAL_SAMPLE_DATE,
    endDate: HISTORICAL_SAMPLE_DATE,
    fetchImpl,
    now: () => new Date(HISTORICAL_RETRIEVED_AT),
  });

  const referenceUrl = urls.find((url) => url.hostname === 'archive-api.open-meteo.com');
  assert.equal(Number(referenceUrl.searchParams.get('latitude')), resolvedLocation.latitude);
  assert.equal(Number(referenceUrl.searchParams.get('longitude')), resolvedLocation.longitude);
  assert.notDeepEqual(referenceResult.requested_location, requestedLocation);
  assert.deepEqual(referenceResult.requested_location, resolvedLocation);
});

test('TEST 47: sends independent ERA5 requests for distinct model-resolved coordinates', async () => {
  const resolvedByModel = {
    [HISTORICAL_MODEL_IDS.IFS]: { latitude: 28.5, longitude: 77.25 },
    [HISTORICAL_MODEL_IDS.GFS]: { latitude: 28.64302, longitude: 77.22656 },
  };
  const referenceRequests = [];
  const fetchImpl = async (requestUrl) => {
    const url = new URL(requestUrl);
    if (url.hostname === 'previous-runs-api.open-meteo.com') {
      const modelId = url.searchParams.get('models');
      return jsonResponse(previousRunsResponse({
        ...resolvedByModel[modelId],
        times: [`${HISTORICAL_SAMPLE_DATE}T00:00`],
        day1: [25],
        day2: [24],
      }));
    }
    referenceRequests.push({
      latitude: Number(url.searchParams.get('latitude')),
      longitude: Number(url.searchParams.get('longitude')),
    });
    return jsonResponse(referenceResponse({
      latitude: Number(url.searchParams.get('latitude')),
      longitude: Number(url.searchParams.get('longitude')),
      times: [`${HISTORICAL_SAMPLE_DATE}T00:00`],
      values: [24],
    }));
  };

  for (const modelId of [HISTORICAL_MODEL_IDS.IFS, HISTORICAL_MODEL_IDS.GFS]) {
    const forecastResult = await fetchHistoricalForecast({
      modelId,
      latitude: 28.6139,
      longitude: 77.2090,
      startDate: HISTORICAL_SAMPLE_DATE,
      endDate: HISTORICAL_SAMPLE_DATE,
      leadTimes: [24],
      fetchImpl,
      now: () => new Date(HISTORICAL_RETRIEVED_AT),
    });
    await fetchReferenceData({
      ...forecastResult.resolved_location,
      startDate: HISTORICAL_SAMPLE_DATE,
      endDate: HISTORICAL_SAMPLE_DATE,
      fetchImpl,
      now: () => new Date(HISTORICAL_RETRIEVED_AT),
    });
  }

  assert.deepEqual(referenceRequests, [
    resolvedByModel[HISTORICAL_MODEL_IDS.IFS],
    resolvedByModel[HISTORICAL_MODEL_IDS.GFS],
  ]);
});

test('TEST 48: keeps forecast and ERA5 resolved-coordinate mismatch unmatched', () => {
  const forecastResult = normalizeForecastFixture({
    response: previousRunsResponse({
      latitude: 28.64302,
      longitude: 77.22656,
      times: [`${HISTORICAL_SAMPLE_DATE}T00:00`],
      day1: [25],
      day2: [24],
    }),
  });
  const referenceResult = normalizeReferenceResponse(referenceResponse({
    latitude: 28.5,
    longitude: 77.25,
    times: [`${HISTORICAL_SAMPLE_DATE}T00:00`],
    values: [24],
  }), {
    latitude: forecastResult.resolved_location.latitude,
    longitude: forecastResult.resolved_location.longitude,
    startDate: HISTORICAL_SAMPLE_DATE,
    endDate: HISTORICAL_SAMPLE_DATE,
    retrievedAt: HISTORICAL_RETRIEVED_AT,
    sourceUrl: ERA5_FIXTURE_URL,
  });
  const result = buildVerificationPairs({
    forecasts: [forecastResult.records[0]],
    references: [referenceResult.records[0]],
  });
  assert.equal(result.pairs.length, 0);
  assert.equal(result.diagnostics.unmatched_forecasts.length, 1);
});

test('TEST 49: does not interpolate or use nearest-neighbor location matching', () => {
  const forecastRecord = normalizeForecastFixture().records[0];
  const referenceRecord = normalizeReferenceFixture().records[0];
  const nearButDifferentLocation = {
    latitude: forecastRecord.resolved_location.latitude + 0.00001,
    longitude: forecastRecord.resolved_location.longitude,
  };
  referenceRecord.latitude = nearButDifferentLocation.latitude;
  referenceRecord.location = { ...nearButDifferentLocation };
  referenceRecord.resolved_location = { ...nearButDifferentLocation };
  const result = buildVerificationPairs({ forecasts: [forecastRecord], references: [referenceRecord] });
  assert.equal(result.pairs.length, 0);
  assert.equal(result.diagnostics.unmatched_forecasts.length, 1);
  assert.deepEqual(result.diagnostics.rejected_records, []);
});

test('TEST 50: retains requested/resolved coordinate provenance in paired records', () => {
  const forecastResult = normalizeForecastFixture({
    response: previousRunsResponse({
      latitude: 28.64302,
      longitude: 77.22656,
      times: [`${HISTORICAL_SAMPLE_DATE}T00:00`],
      day1: [25],
      day2: [24],
    }),
  });
  const referenceResult = normalizeReferenceResponse(referenceResponse({
    latitude: 28.64302,
    longitude: 77.22656,
    times: [`${HISTORICAL_SAMPLE_DATE}T00:00`],
    values: [24],
  }), {
    latitude: forecastResult.resolved_location.latitude,
    longitude: forecastResult.resolved_location.longitude,
    startDate: HISTORICAL_SAMPLE_DATE,
    endDate: HISTORICAL_SAMPLE_DATE,
    retrievedAt: HISTORICAL_RETRIEVED_AT,
    sourceUrl: ERA5_FIXTURE_URL,
  });
  const pair = buildVerificationPairs({
    forecasts: [forecastResult.records[0]],
    references: [referenceResult.records[0]],
  }).pairs[0];
  assert.ok(pair);
  assert.deepEqual(pair.forecast.requested_location, { latitude: 28.6139, longitude: 77.209 });
  assert.deepEqual(pair.forecast.resolved_location, { latitude: 28.64302, longitude: 77.22656 });
  assert.deepEqual(pair.reference.requested_location, pair.forecast.resolved_location);
  assert.deepEqual(pair.reference.resolved_location, pair.forecast.resolved_location);
});

function skillMatch({
  id,
  modelId = 'model-a',
  modelVersion = 'v1',
  variable = 'temperature',
  leadTimeHours = 24,
  initializationTime = '2026-09-20T00:00:00Z',
  forecastValue = 12,
  observationValue = 10,
} = {}) {
  const matchId = id || `${modelId}-${modelVersion}-${variable}-${leadTimeHours}-${initializationTime}`;
  const validTime = new Date(Date.parse(initializationTime) + leadTimeHours * 3_600_000).toISOString();
  return {
    match_id: matchId,
    forecast_id: `forecast-${matchId}`,
    observation_id: `observation-${matchId}`,
    forecast: {
      forecast_id: `forecast-${matchId}`,
      model_id: modelId,
      model_version: modelVersion,
      variable,
      value: forecastValue,
      unit: 'C',
      initialization_time: initializationTime,
      valid_time: validTime,
      lead_time_hours: leadTimeHours,
      location: { location_id: 'location-1', latitude: 28.6, longitude: 77.2 },
      source: 'forecast fixture',
      source_dataset: 'evaluation fixture',
      run_id: `run-${matchId}`,
      mode: 'ARCHIVE',
    },
    observation: {
      observation_id: `observation-${matchId}`,
      variable,
      value: observationValue,
      unit: 'C',
      observation_time: validTime,
      available_at: new Date(Date.parse(validTime) + 86_400_000).toISOString(),
      location: { location_id: 'location-1', latitude: 28.6, longitude: 77.2 },
      source_kind: 'STATION_OBSERVATION',
      source: 'station fixture',
      dataset_id: 'station-fixture',
      dataset_version: null,
      quality_status: 'ACCEPTED',
    },
    forecast_minus_observation: forecastValue - observationValue,
  };
}

test('TEST 51: evaluates metrics through calculateSkill for three matches', () => {
  const matches = [
    skillMatch({ id: 'skill-1', forecastValue: 11, observationValue: 10 }),
    skillMatch({ id: 'skill-2', initializationTime: '2026-09-21T00:00:00Z', forecastValue: 13, observationValue: 11 }),
    skillMatch({ id: 'skill-3', initializationTime: '2026-09-22T00:00:00Z', forecastValue: 15, observationValue: 13 }),
  ];
  const evaluation = evaluateHistoricalSkill(matches)[0];
  const metrics = calculateSkill(matches);
  assert.equal(evaluation.sample_count, 3);
  assert.equal(evaluation.mae, 5 / 3);
  assert.equal(evaluation.rmse, Math.sqrt(3));
  assert.equal(evaluation.bias, 5 / 3);
  assert.equal(evaluation.pearson_correlation, metrics.pearson_correlation);
});

test('TEST 52: creates independent rows for separate models', () => {
  const rows = evaluateHistoricalSkill([
    skillMatch({ id: 'model-b', modelId: 'model-b' }),
    skillMatch({ id: 'model-a', modelId: 'model-a' }),
  ]);
  assert.deepEqual(rows.map((row) => row.model_id), ['model-a', 'model-b']);
  assert.equal(rows.length, 2);
});

test('TEST 53: creates separate rows for different lead times', () => {
  const rows = evaluateHistoricalSkill([
    skillMatch({ id: 'lead-48', leadTimeHours: 48 }),
    skillMatch({ id: 'lead-24', leadTimeHours: 24 }),
  ]);
  assert.deepEqual(rows.map((row) => row.lead_time_hours), [24, 48]);
});

test('TEST 54: derives evaluation bounds from initialization_time', () => {
  const rows = evaluateHistoricalSkill([
    skillMatch({ id: 'bounds-late', initializationTime: '2026-09-22T00:00:00Z' }),
    skillMatch({ id: 'bounds-early', initializationTime: '2026-09-20T00:00:00Z' }),
  ]);
  assert.equal(rows[0].evaluation_start, '2026-09-20T00:00:00Z');
  assert.equal(rows[0].evaluation_end, '2026-09-22T00:00:00Z');
});

test('TEST 55: preserves model versions including null', () => {
  const rows = evaluateHistoricalSkill([
    skillMatch({ id: 'version-null', modelVersion: null }),
    skillMatch({ id: 'version-real', modelVersion: 'release-7' }),
  ]);
  assert.deepEqual(rows.map((row) => row.model_version), [null, 'release-7']);
});

test('TEST 56: applies inclusive evaluationWindow using initialization_time', () => {
  const rows = evaluateHistoricalSkill([
    skillMatch({ id: 'window-before', initializationTime: '2026-09-19T23:59:59Z' }),
    skillMatch({ id: 'window-start', initializationTime: '2026-09-20T00:00:00Z' }),
    skillMatch({ id: 'window-end', initializationTime: '2026-09-21T00:00:00Z' }),
    skillMatch({ id: 'window-after', initializationTime: '2026-09-21T00:00:01Z' }),
  ], {
    evaluationWindow: {
      start: '2026-09-20T00:00:00Z',
      end: '2026-09-21T00:00:00Z',
    },
  });
  assert.equal(rows[0].sample_count, 2);
  assert.equal(rows[0].evaluation_start, '2026-09-20T00:00:00Z');
  assert.equal(rows[0].evaluation_end, '2026-09-21T00:00:00Z');
});

test('TEST 57: rejects malformed and inconsistent matched records', () => {
  const invalidInitialization = skillMatch({ id: 'invalid-init' });
  invalidInitialization.forecast.initialization_time = 'not-a-timestamp';
  const invalidCases = [
    skillMatch({ id: 'invalid-nan', forecastValue: Number.NaN }),
    skillMatch({ id: 'invalid-infinity', observationValue: Number.POSITIVE_INFINITY }),
    skillMatch({ id: 'invalid-error', forecast_minus_observation: 99 }),
    invalidInitialization,
    skillMatch({ id: 'invalid-lead', leadTimeHours: -24 }),
  ];
  invalidCases[2].forecast_minus_observation = 99;
  for (const match of invalidCases) assert.throws(() => evaluateHistoricalSkill([match]), /matches\[0\] is invalid/);
});

test('TEST 58: creates deterministic table rows with the requested columns', () => {
  const rows = evaluateHistoricalSkill([
    skillMatch({ id: 'table-b', modelId: 'model-b' }),
    skillMatch({ id: 'table-a', modelId: 'model-a' }),
  ]);
  const table = createSkillEvaluationTable([...rows].reverse());
  assert.deepEqual(Object.keys(table[0]), [
    'model_id',
    'model_version',
    'variable',
    'lead_time_hours',
    'mae',
    'rmse',
    'bias',
    'pearson_correlation',
    'sample_count',
    'evaluation_start',
    'evaluation_end',
    'methodology_version',
  ]);
  assert.deepEqual(table.map((row) => row.model_id), ['model-a', 'model-b']);
  assert.deepEqual(summarizeSkillByLead([...rows].reverse()).map((row) => row.model_id), ['model-a', 'model-b']);
});

test('TEST 59: walk-forward metrics use only each fold evaluation partition', () => {
  const matches = [
    skillMatch({ id: 'wf-train', initializationTime: '2026-09-20T00:00:00Z', forecastValue: 100, observationValue: 0 }),
    skillMatch({ id: 'wf-eval-1', initializationTime: '2026-09-21T00:00:00Z', forecastValue: 12, observationValue: 10 }),
    skillMatch({ id: 'wf-eval-2', initializationTime: '2026-09-22T00:00:00Z', forecastValue: 15, observationValue: 10 }),
  ];
  const rows = evaluateWalkForwardSkill(matches, { initialTrainSize: 1, evaluationSize: 1 });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.sample_count), [1, 1]);
  assert.deepEqual(rows.map((row) => row.rmse), [2, 5]);
  assert.ok(rows.every((row) => row.rmse !== 100));
});

test('TEST 60: walk-forward evaluations include fold id and training cutoff', () => {
  const rows = evaluateWalkForwardSkill([
    skillMatch({ id: 'wf-meta-1', initializationTime: '2026-09-20T00:00:00Z' }),
    skillMatch({ id: 'wf-meta-2', initializationTime: '2026-09-21T00:00:00Z' }),
  ], { initialTrainSize: 1, evaluationSize: 1 });
  assert.equal(rows[0].fold_id, 'walk-forward-001');
  assert.equal(rows[0].training_cutoff, '2026-09-20T00:00:00Z');
  assert.equal(rows[0].evaluation_start, '2026-09-21T00:00:00Z');
  assert.equal(rows[0].evaluation_end, '2026-09-21T00:00:00Z');
  assert.deepEqual(rows[0].fold_metadata, {
    fold_id: 'walk-forward-001',
    training_cutoff: '2026-09-20T00:00:00Z',
    evaluation_start: '2026-09-21T00:00:00Z',
    evaluation_end: '2026-09-21T00:00:00Z',
  });
});

test('TEST 61: walk-forward output is chronological and deterministic', () => {
  const matches = [
    skillMatch({ id: 'wf-z', modelId: 'model-z', initializationTime: '2026-09-22T00:00:00Z' }),
    skillMatch({ id: 'wf-b', modelId: 'model-b', initializationTime: '2026-09-21T00:00:00Z' }),
    skillMatch({ id: 'wf-a', modelId: 'model-a', initializationTime: '2026-09-20T00:00:00Z' }),
  ];
  const options = { initialTrainSize: 1, evaluationSize: 1 };
  const first = evaluateWalkForwardSkill(matches, options);
  const second = evaluateWalkForwardSkill(matches, options);
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((row) => row.fold_id), ['walk-forward-001', 'walk-forward-002']);
  assert.deepEqual(first.map((row) => row.model_id), ['model-b', 'model-z']);
});

test('TEST 62: historical and walk-forward evaluation do not mutate inputs', () => {
  const matches = [
    skillMatch({ id: 'immutable-2', initializationTime: '2026-09-21T00:00:00Z' }),
    skillMatch({ id: 'immutable-1', initializationTime: '2026-09-20T00:00:00Z' }),
  ];
  const snapshot = structuredClone(matches);
  Object.freeze(matches);
  for (const match of matches) {
    Object.freeze(match.forecast.location);
    Object.freeze(match.forecast);
    Object.freeze(match.observation.location);
    Object.freeze(match.observation);
    Object.freeze(match);
  }
  evaluateHistoricalSkill(matches);
  evaluateWalkForwardSkill(matches, { initialTrainSize: 1, evaluationSize: 1 });
  assert.deepEqual(matches, snapshot);
});

test('TEST 63: applies model, variable, lead, and methodology options', () => {
  const matches = [
    skillMatch({ id: 'filter-a', modelId: 'model-a', leadTimeHours: 24 }),
    skillMatch({ id: 'filter-b', modelId: 'model-b', leadTimeHours: 48 }),
    skillMatch({ id: 'filter-c', modelId: 'model-a', variable: 'wind_speed', leadTimeHours: 24 }),
  ];
  const filtered = evaluateHistoricalSkill(matches, {
    model_ids: ['model-a'],
    variable: 'temperature',
    lead_time_hours: 24,
    methodology_version: 'test-method-v2',
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].model_id, 'model-a');
  assert.equal(filtered[0].methodology_version, 'test-method-v2');
  assert.deepEqual(evaluateHistoricalSkill(matches, { model_ids: ['absent-model'] }), []);
});