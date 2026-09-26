import { calculateSkill } from './metrics.js';
import { createWalkForwardFolds } from './evaluation.js';
import { parseUtcTimestamp } from './time.js';
import { validateForecastRecord, validateObservationRecord } from './types.js';

export const DEFAULT_SKILL_METHODOLOGY_VERSION = 'member2-historical-skill-v1';

function compareText(first, second) {
  if (first < second) return -1;
  if (first > second) return 1;
  return 0;
}

function compareModelVersions(first, second) {
  if (first === second) return 0;
  if (first === null) return -1;
  if (second === null) return 1;
  return compareText(first, second);
}

function compareEvaluationRows(first, second) {
  return compareText(first.model_id, second.model_id) ||
    compareModelVersions(first.model_version, second.model_version) ||
    compareText(first.variable, second.variable) ||
    first.lead_time_hours - second.lead_time_hours;
}

function validateEvaluationWindow(evaluationWindow) {
  if (evaluationWindow === undefined) return null;
  if (evaluationWindow === null || typeof evaluationWindow !== 'object' || Array.isArray(evaluationWindow)) {
    throw new TypeError('evaluationWindow must be an object with start and end timestamps');
  }
  const start = parseUtcTimestamp(evaluationWindow.start, 'evaluationWindow.start');
  const end = parseUtcTimestamp(evaluationWindow.end, 'evaluationWindow.end');
  if (end < start) throw new RangeError('evaluationWindow.end must be at or after evaluationWindow.start');
  return { start, end };
}

function validateOptions(options) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object');
  }
  const methodologyVersion = options.methodology_version ?? DEFAULT_SKILL_METHODOLOGY_VERSION;
  if (typeof methodologyVersion !== 'string' || methodologyVersion.trim() === '') {
    throw new TypeError('methodology_version must be a non-empty string');
  }
  if (options.lead_time_hours !== undefined &&
      (typeof options.lead_time_hours !== 'number' || !Number.isFinite(options.lead_time_hours) ||
       options.lead_time_hours < 0)) {
    throw new RangeError('lead_time_hours filter must be a non-negative finite number');
  }
  if (options.model_ids !== undefined &&
      (!Array.isArray(options.model_ids) || options.model_ids.some(
        (modelId) => typeof modelId !== 'string' || modelId.trim() === ''
      ))) {
    throw new TypeError('model_ids filter must be an array of non-empty strings');
  }
  if (options.variable !== undefined &&
      (typeof options.variable !== 'string' || options.variable.trim() === '')) {
    throw new TypeError('variable filter must be a non-empty string');
  }
  const evaluationWindow = validateEvaluationWindow(options.evaluationWindow);
  return { methodologyVersion, evaluationWindow };
}

function validateMatchedRecords(matches) {
  if (!Array.isArray(matches)) throw new TypeError('matches must be an array');

  return matches.map((match, index) => {
    try {
      if (match === null || typeof match !== 'object' || Array.isArray(match)) {
        throw new TypeError('match must be an object');
      }
      validateForecastRecord(match.forecast);
      validateObservationRecord(match.observation);

      const forecast = match.forecast;
      const observation = match.observation;
      if (typeof forecast.model_id !== 'string' || forecast.model_id.trim() === '') {
        throw new TypeError('forecast.model_id is required');
      }
      if (forecast.model_version !== null &&
          (typeof forecast.model_version !== 'string' || forecast.model_version.trim() === '')) {
        throw new TypeError('forecast.model_version must be a non-empty string or null');
      }
      if (forecast.variable !== observation.variable) throw new RangeError('matched variable values differ');
      if (forecast.unit !== observation.unit) throw new RangeError('matched unit values differ');
      if (parseUtcTimestamp(forecast.valid_time, 'valid_time') !==
          parseUtcTimestamp(observation.observation_time, 'observation_time')) {
        throw new RangeError('matched forecast and observation times differ');
      }

      const forecastLocationId = forecast.location.location_id;
      const observationLocationId = observation.location.location_id;
      if (forecastLocationId || observationLocationId) {
        if (!forecastLocationId || forecastLocationId !== observationLocationId) {
          throw new RangeError('matched location IDs differ');
        }
      } else if (forecast.location.latitude !== observation.location.latitude ||
          forecast.location.longitude !== observation.location.longitude) {
        throw new RangeError('matched coordinates differ');
      }

      const expectedError = forecast.value - observation.value;
      if (typeof match.forecast_minus_observation !== 'number' ||
          !Number.isFinite(match.forecast_minus_observation) ||
          match.forecast_minus_observation !== expectedError) {
        throw new TypeError('forecast_minus_observation must be finite and equal forecast.value - observation.value');
      }

      return {
        match,
        initializationMilliseconds: parseUtcTimestamp(forecast.initialization_time, 'initialization_time'),
      };
    } catch (error) {
      throw new TypeError(`matches[${index}] is invalid: ${error.message}`, { cause: error });
    }
  });
}

function selectMatches(validatedMatches, options, window) {
  const modelIds = options.model_ids === undefined ? null : new Set(options.model_ids);
  return validatedMatches
    .filter(({ match, initializationMilliseconds }) => {
      const forecast = match.forecast;
      if (options.lead_time_hours !== undefined && forecast.lead_time_hours !== options.lead_time_hours) return false;
      if (modelIds && !modelIds.has(forecast.model_id)) return false;
      if (options.variable !== undefined && forecast.variable !== options.variable) return false;
      if (window && (initializationMilliseconds < window.start || initializationMilliseconds > window.end)) return false;
      return true;
    })
    .sort((first, second) =>
      first.initializationMilliseconds - second.initializationMilliseconds ||
      compareText(first.match.forecast.forecast_id, second.match.forecast.forecast_id) ||
      compareText(first.match.observation.observation_id, second.match.observation.observation_id)
    );
}

function createRows(validatedMatches, methodologyVersion) {
  const groups = new Map();
  for (const { match, initializationMilliseconds } of validatedMatches) {
    const forecast = match.forecast;
    const key = JSON.stringify([
      forecast.model_id,
      forecast.model_version,
      forecast.variable,
      forecast.lead_time_hours,
    ]);
    const group = groups.get(key) || {
      model_id: forecast.model_id,
      model_version: forecast.model_version,
      variable: forecast.variable,
      lead_time_hours: forecast.lead_time_hours,
      matches: [],
      initialization_times: [],
    };
    group.matches.push(match);
    group.initialization_times.push({ timestamp: forecast.initialization_time, milliseconds: initializationMilliseconds });
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => {
    const metrics = calculateSkill(group.matches);
    const first = group.initialization_times.reduce((earliest, current) =>
      current.milliseconds < earliest.milliseconds ? current : earliest
    );
    const last = group.initialization_times.reduce((latest, current) =>
      current.milliseconds > latest.milliseconds ? current : latest
    );
    return {
      model_id: group.model_id,
      model_version: group.model_version,
      variable: group.variable,
      lead_time_hours: group.lead_time_hours,
      sample_count: metrics.sample_count,
      mae: metrics.mae,
      rmse: metrics.rmse,
      bias: metrics.bias,
      pearson_correlation: metrics.pearson_correlation,
      evaluation_start: first.timestamp,
      evaluation_end: last.timestamp,
      methodology_version: methodologyVersion,
    };
  }).sort(compareEvaluationRows);
}

/**
 * Evaluate already-matched forecast/observation pairs. All matches are validated
 * before optional filters are applied; initialization_time defines the inclusive
 * evaluation window and the reported evaluation date range.
 * @param {import('./types.js').MatchedForecastObservation[]} matches
 * @param {{methodology_version?: string, lead_time_hours?: number, model_ids?: string[], variable?: string, evaluationWindow?: {start: string, end: string}}} [options]
 * @returns {Array<object>}
 */
export function evaluateHistoricalSkill(matches, options = {}) {
  const validatedMatches = validateMatchedRecords(matches);
  const { methodologyVersion, evaluationWindow } = validateOptions(options);
  const selected = selectMatches(validatedMatches, options, evaluationWindow);
  if (selected.length === 0) return [];
  return createRows(selected, methodologyVersion);
}

function representativeForecastsByInitialization(validatedMatches) {
  const buckets = new Map();
  for (const entry of validatedMatches) {
    const key = String(entry.initializationMilliseconds);
    const existing = buckets.get(key);
    if (!existing || compareText(entry.match.forecast.forecast_id, existing.forecast.forecast_id) < 0) {
      buckets.set(key, {
        forecast: entry.match.forecast,
        initializationMilliseconds: entry.initializationMilliseconds,
      });
    }
  }
  return [...buckets.values()]
    .sort((first, second) =>
      first.initializationMilliseconds - second.initializationMilliseconds ||
      compareText(first.forecast.forecast_id, second.forecast.forecast_id)
    )
    .map((entry) => entry.forecast);
}

/**
 * Evaluate held-out partitions from expanding-window folds. Folds are formed
 * from unique forecast initialization instants so forecasts initialized at the
 * same time stay in one block. Skill is calculated exclusively from matches
 * whose forecast belongs to that fold's evaluation_records.
 * @param {import('./types.js').MatchedForecastObservation[]} matches
 * @param {{methodology_version?: string, lead_time_hours?: number, model_ids?: string[], variable?: string, evaluationWindow?: {start: string, end: string}, initialTrainSize?: number, evaluationSize?: number, stepSize?: number, maxFolds?: number}} [options]
 * @returns {Array<object>}
 */
export function evaluateWalkForwardSkill(matches, options = {}) {
  const validatedMatches = validateMatchedRecords(matches);
  const { methodologyVersion, evaluationWindow } = validateOptions(options);
  const selected = selectMatches(validatedMatches, options, evaluationWindow);
  if (selected.length === 0) return [];

  const forecastsByInitialization = new Map();
  for (const entry of selected) {
    const key = String(entry.initializationMilliseconds);
    const group = forecastsByInitialization.get(key) || [];
    group.push(entry.match);
    forecastsByInitialization.set(key, group);
  }

  const representativeForecasts = representativeForecastsByInitialization(selected);
  const foldOptions = {};
  for (const field of ['initialTrainSize', 'evaluationSize', 'stepSize', 'maxFolds']) {
    if (options[field] !== undefined) foldOptions[field] = options[field];
  }
  const folds = createWalkForwardFolds(representativeForecasts, foldOptions);
  const walkForwardRows = [];

  for (const fold of folds) {
    const evaluationInstants = new Set(
      fold.evaluation_records.map((record) => String(parseUtcTimestamp(record.initialization_time)))
    );
    const evaluationMatches = [...evaluationInstants].flatMap((instant) => forecastsByInitialization.get(instant) || []);
    const validatedEvaluationMatches = evaluationMatches.map((match) => ({
      match,
      initializationMilliseconds: parseUtcTimestamp(match.forecast.initialization_time),
    }));
    const rows = createRows(validatedEvaluationMatches, methodologyVersion);
    for (const row of rows) {
      walkForwardRows.push({
        ...row,
        fold_id: fold.fold_id,
        training_cutoff: fold.training_cutoff,
        evaluation_start: fold.evaluation_start,
        evaluation_end: fold.evaluation_end,
        fold_metadata: {
          fold_id: fold.fold_id,
          training_cutoff: fold.training_cutoff,
          evaluation_start: fold.evaluation_start,
          evaluation_end: fold.evaluation_end,
        },
      });
    }
  }

  return walkForwardRows.sort((first, second) =>
    compareText(first.fold_id, second.fold_id) || compareEvaluationRows(first, second)
  );
}

const SKILL_TABLE_FIELDS = Object.freeze([
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

/**
 * Return stable table rows in the documented CSV/report column order. Rows are
 * projected, not ranked or aggregated across distinct variables or versions.
 * @param {Array<object>} evaluations
 * @returns {Array<object>}
 */
export function createSkillEvaluationTable(evaluations) {
  if (!Array.isArray(evaluations)) throw new TypeError('evaluations must be an array');
  return evaluations
    .map((evaluation) => {
      if (evaluation === null || typeof evaluation !== 'object' || Array.isArray(evaluation)) {
        throw new TypeError('each evaluation must be an object');
      }
      return Object.fromEntries(SKILL_TABLE_FIELDS.map((field) => [field, evaluation[field]]));
    })
    .sort(compareEvaluationRows);
}

/**
 * Reporting projection ordered by lead and model. Distinct variable/version rows
 * are retained rather than combining metrics that cannot be recomputed here.
 * @param {Array<object>} evaluations
 * @returns {Array<object>}
 */
export function summarizeSkillByLead(evaluations) {
  if (!Array.isArray(evaluations)) throw new TypeError('evaluations must be an array');
  return evaluations
    .map((evaluation) => {
      if (evaluation === null || typeof evaluation !== 'object' || Array.isArray(evaluation)) {
        throw new TypeError('each evaluation must be an object');
      }
      return {
        model_id: evaluation.model_id,
        lead_time_hours: evaluation.lead_time_hours,
        sample_count: evaluation.sample_count,
        mae: evaluation.mae,
        rmse: evaluation.rmse,
        bias: evaluation.bias,
        pearson_correlation: evaluation.pearson_correlation,
        variable: evaluation.variable,
        model_version: evaluation.model_version,
      };
    })
    .sort((first, second) =>
      first.lead_time_hours - second.lead_time_hours ||
      compareText(first.model_id, second.model_id) ||
      compareText(first.variable, second.variable) ||
      compareModelVersions(first.model_version, second.model_version)
    )
    .map((summary) => ({
      model_id: summary.model_id,
      lead_time_hours: summary.lead_time_hours,
      sample_count: summary.sample_count,
      mae: summary.mae,
      rmse: summary.rmse,
      bias: summary.bias,
      pearson_correlation: summary.pearson_correlation,
    }));
}
