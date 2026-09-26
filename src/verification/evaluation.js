import { validateForecastRecord, validateObservationRecord } from './types.js';
import { parseUtcTimestamp } from './time.js';

const DEFAULT_SPLIT_RATIOS = Object.freeze({ trainRatio: 0.7, validationRatio: 0.15, testRatio: 0.15 });
const SKILL_INPUT_TIME_FIELDS = Object.freeze([
  'available_at',
  'as_of',
  'data_end',
  'evaluation_end',
  'evaluation_end_time',
  'initialization_time',
  'skill_available_at',
  'timestamp',
  'training_cutoff',
  'valid_through',
]);

function compareText(first, second) {
  if (first < second) return -1;
  if (first > second) return 1;
  return 0;
}

function forecastTieKey(record) {
  return JSON.stringify([
    record.forecast_id,
    record.model_id,
    record.model_version,
    record.variable,
    record.valid_time,
    record.lead_time_hours,
    record.location.location_id || null,
    record.location.latitude ?? null,
    record.location.longitude ?? null,
    record.value,
    record.unit,
    record.run_id,
  ]);
}

function validateForecasts(records) {
  if (!Array.isArray(records)) throw new TypeError('records must be an array');

  return records.map((record, index) => {
    try {
      validateForecastRecord(record);
      return {
        record,
        initializationMilliseconds: parseUtcTimestamp(record.initialization_time, 'initialization_time'),
        tieKey: forecastTieKey(record),
        index,
      };
    } catch (error) {
      throw new TypeError(`records[${index}] is invalid: ${error.message}`, { cause: error });
    }
  });
}

/**
 * Return a new array ordered by initialization_time, then forecast_id (and a
 * stable record-field key for duplicate IDs). The input array and records are not
 * mutated. Initialization time, never valid_time, defines the order.
 * @param {import('./types.js').ForecastRecord[]} records
 * @returns {import('./types.js').ForecastRecord[]}
 */
export function sortForecastsChronologically(records) {
  return validateForecasts(records)
    .sort((first, second) =>
      first.initializationMilliseconds - second.initializationMilliseconds ||
      compareText(first.record.forecast_id, second.record.forecast_id) ||
      compareText(first.tieKey, second.tieKey) ||
      first.index - second.index
    )
    .map(({ record }) => record);
}

function validateRatios(options) {
  const ratios = {
    trainRatio: options.trainRatio ?? DEFAULT_SPLIT_RATIOS.trainRatio,
    validationRatio: options.validationRatio ?? DEFAULT_SPLIT_RATIOS.validationRatio,
    testRatio: options.testRatio ?? DEFAULT_SPLIT_RATIOS.testRatio,
  };
  const values = Object.values(ratios);
  if (values.some((ratio) => typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio < 0 || ratio > 1)) {
    throw new RangeError('split ratios must be finite numbers between 0 and 1');
  }
  if (Math.abs(values.reduce((sum, ratio) => sum + ratio, 0) - 1) > 1e-9) {
    throw new RangeError('trainRatio, validationRatio, and testRatio must sum to 1');
  }
  return ratios;
}

/**
 * Split forecasts chronologically by initialization_time. If either explicit
 * boundary is provided, both are required and must be strict UTC ISO timestamps:
 * train is <= trainEnd, validation is > trainEnd and <= validationEnd, and test
 * is > validationEnd. Otherwise deterministic count ratios are used (defaults
 * 70/15/15); dates are never inferred from ambiguous date-only strings.
 * @param {import('./types.js').ForecastRecord[]} records
 * @param {{trainEnd?: string, validationEnd?: string, trainRatio?: number, validationRatio?: number, testRatio?: number}} [options]
 * @returns {{train: import('./types.js').ForecastRecord[], validation: import('./types.js').ForecastRecord[], test: import('./types.js').ForecastRecord[]}}
 */
export function createChronologicalSplits(records, options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object');
  }
  const ordered = sortForecastsChronologically(records);
  const hasTrainEnd = options.trainEnd !== undefined;
  const hasValidationEnd = options.validationEnd !== undefined;

  if (hasTrainEnd || hasValidationEnd) {
    if (!hasTrainEnd || !hasValidationEnd) {
      throw new TypeError('trainEnd and validationEnd must be provided together');
    }
    const trainEnd = parseUtcTimestamp(options.trainEnd, 'trainEnd');
    const validationEnd = parseUtcTimestamp(options.validationEnd, 'validationEnd');
    if (validationEnd <= trainEnd) {
      throw new RangeError('validationEnd must be later than trainEnd');
    }

    const train = [];
    const validation = [];
    const test = [];
    for (const record of ordered) {
      const initialization = parseUtcTimestamp(record.initialization_time, 'initialization_time');
      if (initialization <= trainEnd) train.push(record);
      else if (initialization <= validationEnd) validation.push(record);
      else test.push(record);
    }
    return { train, validation, test };
  }

  const { trainRatio, validationRatio } = validateRatios(options);
  const trainEndIndex = Math.floor(ordered.length * trainRatio);
  const validationEndIndex = Math.floor(ordered.length * (trainRatio + validationRatio));
  return {
    train: ordered.slice(0, trainEndIndex),
    validation: ordered.slice(trainEndIndex, validationEndIndex),
    test: ordered.slice(validationEndIndex),
  };
}

function requirePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${field} must be a positive integer`);
  }
}

/**
 * Create expanding-window folds over records sorted by initialization_time.
 * The first fold trains on initialTrainSize records; later folds add all records
 * preceding that fold's evaluation block to training. evaluationSize and stepSize
 * are record counts, not assumed calendar durations. Evaluation blocks cannot
 * overlap; stepSize may be larger than evaluationSize to skip blocks explicitly.
 * @param {import('./types.js').ForecastRecord[]} records
 * @param {{initialTrainSize?: number, evaluationSize?: number, stepSize?: number, maxFolds?: number}} [options]
 * @returns {Array<object>}
 */
export function createWalkForwardFolds(records, options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object');
  }
  const ordered = sortForecastsChronologically(records);
  const initialTrainSize = options.initialTrainSize ?? 1;
  const evaluationSize = options.evaluationSize ?? 1;
  const stepSize = options.stepSize ?? evaluationSize;
  requirePositiveInteger(initialTrainSize, 'initialTrainSize');
  requirePositiveInteger(evaluationSize, 'evaluationSize');
  requirePositiveInteger(stepSize, 'stepSize');
  if (stepSize < evaluationSize) {
    throw new RangeError('stepSize must be greater than or equal to evaluationSize to prevent overlapping evaluation blocks');
  }
  if (options.maxFolds !== undefined) requirePositiveInteger(options.maxFolds, 'maxFolds');

  const folds = [];
  for (
    let evaluationStartIndex = initialTrainSize;
    evaluationStartIndex + evaluationSize <= ordered.length;
    evaluationStartIndex += stepSize
  ) {
    const trainRecords = ordered.slice(0, evaluationStartIndex);
    const evaluationRecords = ordered.slice(evaluationStartIndex, evaluationStartIndex + evaluationSize);
    const foldNumber = folds.length + 1;
    folds.push({
      fold_id: `walk-forward-${String(foldNumber).padStart(3, '0')}`,
      train_start: trainRecords[0].initialization_time,
      train_end: trainRecords[trainRecords.length - 1].initialization_time,
      evaluation_start: evaluationRecords[0].initialization_time,
      evaluation_end: evaluationRecords[evaluationRecords.length - 1].initialization_time,
      training_cutoff: trainRecords[trainRecords.length - 1].initialization_time,
      train_records: trainRecords,
      evaluation_records: evaluationRecords,
      require_non_empty_partitions: true,
    });
    if (options.maxFolds !== undefined && folds.length >= options.maxFolds) break;
  }
  return folds;
}

function addViolation(violations, type, details = {}) {
  violations.push({ type, ...details });
}

function readInitialization(record, partition, index, violations) {
  try {
    validateForecastRecord(record);
    return parseUtcTimestamp(record.initialization_time, 'initialization_time');
  } catch (error) {
    addViolation(violations, 'INVALID_FORECAST_RECORD', {
      partition,
      index,
      forecast_id: record?.forecast_id || null,
      message: error.message,
    });
    return null;
  }
}

/**
 * Audit temporal information use. observationUses are observations used as
 * historical features/skill inputs, not target observations used after issuance
 * to score a forecast. Skill-input temporal fields are treated as data-availability
 * or historical-window endpoints; valid_time is deliberately not treated as an
 * availability timestamp. For overlapping forecast horizons, each information
 * use is checked against that consuming forecast's initialization_time; no purge
 * is inferred from valid_time alone.
 * @param {object} options
 * @param {import('./types.js').ForecastRecord[]} [options.trainingRecords]
 * @param {import('./types.js').ForecastRecord[]} [options.evaluationRecords]
 * @param {string} [options.trainingCutoff]
 * @param {Array<{forecast: import('./types.js').ForecastRecord, observation: import('./types.js').ObservationRecord}>} [options.observationUses]
 * @param {import('./types.js').ForecastRecord} [options.forecast] Fallback cutoff for skillInputs.
 * @param {Array<object>} [options.skillInputs]
 * @returns {{valid: boolean, violations: Array<object>}}
 */
export function validateNoTemporalLeakage(options = {}) {
  const violations = [];
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    return { valid: false, violations: [{ type: 'INVALID_OPTIONS', message: 'options must be an object' }] };
  }

  const {
    trainingRecords = [],
    evaluationRecords = [],
    trainingCutoff,
    observationUses = [],
    forecast,
    skillInputs = [],
  } = options;
  for (const [name, value] of [
    ['trainingRecords', trainingRecords],
    ['evaluationRecords', evaluationRecords],
    ['observationUses', observationUses],
    ['skillInputs', skillInputs],
  ]) {
    if (!Array.isArray(value)) addViolation(violations, 'INVALID_INPUT_ARRAY', { field: name });
  }

  let cutoffMilliseconds = null;
  if (trainingCutoff !== undefined && trainingCutoff !== null) {
    try {
      cutoffMilliseconds = parseUtcTimestamp(trainingCutoff, 'trainingCutoff');
    } catch (error) {
      addViolation(violations, 'INVALID_TRAINING_CUTOFF', { value: trainingCutoff, message: error.message });
    }
  } else if (Array.isArray(trainingRecords) && trainingRecords.length > 0) {
    addViolation(violations, 'MISSING_TRAINING_CUTOFF');
  }

  const trainingIds = new Set();
  if (Array.isArray(trainingRecords)) {
    trainingRecords.forEach((record, index) => {
      const initialization = readInitialization(record, 'train', index, violations);
      if (record?.forecast_id) trainingIds.add(record.forecast_id);
      if (initialization !== null && cutoffMilliseconds !== null && initialization > cutoffMilliseconds) {
        addViolation(violations, 'TRAINING_RECORD_AFTER_CUTOFF', {
          forecast_id: record.forecast_id,
          initialization_time: record.initialization_time,
          training_cutoff: trainingCutoff,
        });
      }
    });
  }

  if (Array.isArray(evaluationRecords)) {
    evaluationRecords.forEach((record, index) => {
      const initialization = readInitialization(record, 'evaluation', index, violations);
      if (record?.forecast_id && trainingIds.has(record.forecast_id)) {
        addViolation(violations, 'EVALUATION_RECORD_IN_TRAINING', { forecast_id: record.forecast_id });
      }
      if (initialization !== null && cutoffMilliseconds !== null && initialization <= cutoffMilliseconds) {
        addViolation(violations, 'EVALUATION_RECORD_NOT_AFTER_CUTOFF', {
          forecast_id: record.forecast_id,
          initialization_time: record.initialization_time,
          training_cutoff: trainingCutoff,
        });
      }
    });
  }

  if (Array.isArray(observationUses)) {
    observationUses.forEach((use, index) => {
      try {
        validateForecastRecord(use?.forecast);
        validateObservationRecord(use?.observation);
        const initialization = parseUtcTimestamp(use.forecast.initialization_time, 'initialization_time');
        const availableAt = parseUtcTimestamp(use.observation.available_at, 'available_at');
        if (availableAt > initialization) {
          addViolation(violations, 'OBSERVATION_NOT_AVAILABLE_AT_INITIALIZATION', {
            forecast_id: use.forecast.forecast_id,
            observation_id: use.observation.observation_id,
            forecast_initialization_time: use.forecast.initialization_time,
            observation_available_at: use.observation.available_at,
            index,
          });
        }
      } catch (error) {
        addViolation(violations, 'INVALID_OBSERVATION_USE', { index, message: error.message });
      }
    });
  }

  const fallbackForecastTime = (() => {
    if (forecast === undefined) return null;
    try {
      validateForecastRecord(forecast);
      return parseUtcTimestamp(forecast.initialization_time, 'initialization_time');
    } catch (error) {
      addViolation(violations, 'INVALID_FORECAST_CUTOFF', { message: error.message });
      return null;
    }
  })();

  if (Array.isArray(skillInputs)) {
    skillInputs.forEach((input, index) => {
      if (input === null || typeof input !== 'object' || Array.isArray(input)) {
        addViolation(violations, 'INVALID_SKILL_INPUT', { index });
        return;
      }
      let inputCutoff = fallbackForecastTime;
      if (input.forecast_initialization_time !== undefined) {
        try {
          inputCutoff = parseUtcTimestamp(input.forecast_initialization_time, 'forecast_initialization_time');
        } catch (error) {
          addViolation(violations, 'INVALID_SKILL_INPUT_CUTOFF', { index, message: error.message });
          return;
        }
      }
      for (const field of SKILL_INPUT_TIME_FIELDS) {
        if (input[field] === undefined || input[field] === null) continue;
        if (inputCutoff === null) {
          addViolation(violations, 'MISSING_FORECAST_INITIALIZATION_CUTOFF', { index, field });
          break;
        }
        try {
          const timestamp = parseUtcTimestamp(input[field], `skillInputs[${index}].${field}`);
          if (timestamp > inputCutoff) {
            addViolation(violations, 'SKILL_INPUT_AFTER_FORECAST_INITIALIZATION', {
              forecast_id: input.forecast_id || forecast?.forecast_id || null,
              field,
              value: input[field],
              forecast_initialization_time: new Date(inputCutoff).toISOString(),
              index,
            });
          }
        } catch (error) {
          addViolation(violations, 'INVALID_SKILL_INPUT_TIMESTAMP', { index, field, message: error.message });
        }
      }
    });
  }

  return { valid: violations.length === 0, violations };
}

function getInitializationBounds(records) {
  if (records.length === 0) return null;
  const times = records.map((record) => parseUtcTimestamp(record.initialization_time, 'initialization_time'));
  return {
    start: records[times.indexOf(Math.min(...times))].initialization_time,
    end: records[times.indexOf(Math.max(...times))].initialization_time,
  };
}

/**
 * Validate fold ordering, boundaries, partition disjointness, timestamps, and
 * optional skill/observation inputs. Empty partitions are rejected by default;
 * set fold.require_non_empty_partitions=false to explicitly permit them.
 * @param {object} fold
 * @returns {{valid: boolean, violations: Array<object>}}
 */
export function validateEvaluationFold(fold) {
  const violations = [];
  if (fold === null || typeof fold !== 'object' || Array.isArray(fold)) {
    return { valid: false, violations: [{ type: 'INVALID_FOLD', message: 'fold must be an object' }] };
  }
  if (!Array.isArray(fold.train_records) || !Array.isArray(fold.evaluation_records)) {
    return {
      valid: false,
      violations: [{ type: 'INVALID_FOLD_PARTITIONS', message: 'train_records and evaluation_records must be arrays' }],
    };
  }

  const requiresNonEmpty = fold.require_non_empty_partitions !== false;
  if (requiresNonEmpty && fold.train_records.length === 0) addViolation(violations, 'EMPTY_TRAIN_PARTITION');
  if (requiresNonEmpty && fold.evaluation_records.length === 0) addViolation(violations, 'EMPTY_EVALUATION_PARTITION');

  for (const [partition, records] of [
    ['train', fold.train_records],
    ['evaluation', fold.evaluation_records],
  ]) {
    let previousInitialization = -Infinity;
    records.forEach((record, index) => {
      const initialization = readInitialization(record, partition, index, violations);
      if (initialization !== null && initialization < previousInitialization) {
        addViolation(violations, 'PARTITION_NOT_CHRONOLOGICAL', { partition, forecast_id: record.forecast_id });
      }
      if (initialization !== null) previousInitialization = initialization;
    });
  }

  let cutoffMilliseconds = null;
  try {
    cutoffMilliseconds = parseUtcTimestamp(fold.training_cutoff, 'training_cutoff');
  } catch (error) {
    addViolation(violations, 'INVALID_TRAINING_CUTOFF', { message: error.message });
  }

  const trainBounds = getInitializationBounds(fold.train_records.filter((record) => {
    try {
      validateForecastRecord(record);
      return true;
    } catch {
      return false;
    }
  }));
  const evaluationBounds = getInitializationBounds(fold.evaluation_records.filter((record) => {
    try {
      validateForecastRecord(record);
      return true;
    } catch {
      return false;
    }
  }));

  for (const [field, bounds, boundName] of [
    ['train_start', trainBounds, 'start'],
    ['train_end', trainBounds, 'end'],
    ['evaluation_start', evaluationBounds, 'start'],
    ['evaluation_end', evaluationBounds, 'end'],
  ]) {
    if (!bounds) continue;
    try {
      const declaredTime = parseUtcTimestamp(fold[field], field);
      const actualTime = parseUtcTimestamp(bounds[boundName], field);
      if (declaredTime !== actualTime) {
        addViolation(violations, 'FOLD_BOUNDARY_METADATA_MISMATCH', {
          field,
          declared: fold[field],
          actual: bounds[boundName],
        });
      }
    } catch (error) {
      addViolation(violations, 'INVALID_FOLD_BOUNDARY', { field, message: error.message });
    }
  }

  if (trainBounds && cutoffMilliseconds !== null &&
      parseUtcTimestamp(trainBounds.end) !== cutoffMilliseconds) {
    addViolation(violations, 'TRAINING_CUTOFF_MISMATCH', {
      training_cutoff: fold.training_cutoff,
      actual_train_end: trainBounds.end,
    });
  }
  if (evaluationBounds && cutoffMilliseconds !== null &&
      parseUtcTimestamp(evaluationBounds.start) <= cutoffMilliseconds) {
    addViolation(violations, 'EVALUATION_BEFORE_OR_AT_TRAINING_CUTOFF', {
      evaluation_start: evaluationBounds.start,
      training_cutoff: fold.training_cutoff,
    });
  }

  const leakage = validateNoTemporalLeakage({
    trainingRecords: fold.train_records,
    evaluationRecords: fold.evaluation_records,
    trainingCutoff: fold.training_cutoff,
    observationUses: fold.skill_observation_uses || [],
    forecast: fold.forecast,
    skillInputs: fold.skill_inputs || [],
  });
  violations.push(...leakage.violations);
  return { valid: violations.length === 0, violations };
}

/**
 * Validate and copy caller-supplied evaluation provenance without inventing any
 * values. Required metadata fields must be provided explicitly by the caller.
 * @param {object} metadata
 * @returns {object}
 */
export function createEvaluationMetadata(metadata) {
  const requiredFields = [
    'evaluation_id',
    'fold_id',
    'model_id',
    'model_version',
    'variable',
    'lead_time_hours',
    'training_cutoff',
    'evaluation_start',
    'evaluation_end',
    'reference_dataset',
    'methodology_version',
  ];
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new TypeError('metadata must be an object');
  }
  for (const field of requiredFields) {
    if (!Object.hasOwn(metadata, field)) throw new TypeError(`metadata.${field} is required`);
  }
  for (const field of ['evaluation_id', 'fold_id', 'model_id', 'variable', 'reference_dataset', 'methodology_version']) {
    if (typeof metadata[field] !== 'string' || metadata[field].trim() === '') {
      throw new TypeError(`metadata.${field} must be a non-empty string`);
    }
  }
  if (metadata.model_version !== null && typeof metadata.model_version !== 'string') {
    throw new TypeError('metadata.model_version must be a string or null');
  }
  if (typeof metadata.lead_time_hours !== 'number' || !Number.isFinite(metadata.lead_time_hours) || metadata.lead_time_hours < 0) {
    throw new TypeError('metadata.lead_time_hours must be a non-negative finite number');
  }
  for (const field of ['training_cutoff', 'evaluation_start', 'evaluation_end']) {
    parseUtcTimestamp(metadata[field], `metadata.${field}`);
  }
  if (parseUtcTimestamp(metadata.evaluation_end) < parseUtcTimestamp(metadata.evaluation_start)) {
    throw new RangeError('metadata.evaluation_end must be at or after evaluation_start');
  }
  if (parseUtcTimestamp(metadata.evaluation_start) <= parseUtcTimestamp(metadata.training_cutoff)) {
    throw new RangeError('metadata.evaluation_start must be later than training_cutoff');
  }
  return { ...metadata };
}