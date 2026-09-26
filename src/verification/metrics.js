function validateErrors(errors) {
  if (!Array.isArray(errors)) throw new TypeError('errors must be an array');
  if (errors.some((error) => typeof error !== 'number' || !Number.isFinite(error))) {
    throw new TypeError('errors must contain only finite numbers');
  }
}

function validatePairedValues(forecastValues, observationValues) {
  if (!Array.isArray(forecastValues) || !Array.isArray(observationValues)) {
    throw new TypeError('forecastValues and observationValues must both be arrays');
  }
  if (forecastValues.length !== observationValues.length) {
    throw new RangeError('forecastValues and observationValues must have the same length');
  }
  if ([...forecastValues, ...observationValues].some(
    (value) => typeof value !== 'number' || !Number.isFinite(value)
  )) {
    throw new TypeError('paired values must contain only finite numbers');
  }
}

/** @param {number[]} errors @returns {number|null} */
export function calculateMAE(errors) {
  validateErrors(errors);
  if (errors.length === 0) return null;
  return errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length;
}

/** @param {number[]} errors @returns {number|null} */
export function calculateRMSE(errors) {
  validateErrors(errors);
  if (errors.length === 0) return null;
  return Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / errors.length);
}

/** @param {number[]} errors @returns {number|null} */
export function calculateBias(errors) {
  validateErrors(errors);
  if (errors.length === 0) return null;
  return errors.reduce((sum, error) => sum + error, 0) / errors.length;
}

/**
 * Pearson's r is null for fewer than two pairs or when either series has zero variance.
 * @param {number[]} forecastValues
 * @param {number[]} observationValues
 * @returns {number|null}
 */
export function calculatePearsonCorrelation(forecastValues, observationValues) {
  validatePairedValues(forecastValues, observationValues);
  const sampleCount = forecastValues.length;
  if (sampleCount < 2) return null;

  const meanForecast = forecastValues.reduce((sum, value) => sum + value, 0) / sampleCount;
  const meanObservation = observationValues.reduce((sum, value) => sum + value, 0) / sampleCount;
  let covarianceNumerator = 0;
  let forecastVariance = 0;
  let observationVariance = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const forecastDifference = forecastValues[index] - meanForecast;
    const observationDifference = observationValues[index] - meanObservation;
    covarianceNumerator += forecastDifference * observationDifference;
    forecastVariance += forecastDifference * forecastDifference;
    observationVariance += observationDifference * observationDifference;
  }

  const denominator = Math.sqrt(forecastVariance * observationVariance);
  if (denominator === 0) return null;
  return Math.max(-1, Math.min(1, covarianceNumerator / denominator));
}

/**
 * Calculate skill from explicit matched records. Empty matches yield null metrics.
 * @param {import('./types.js').MatchedForecastObservation[]} matches
 * @returns {import('./types.js').SkillMetrics}
 */
export function calculateSkill(matches) {
  if (!Array.isArray(matches)) throw new TypeError('matches must be an array');
  if (matches.length === 0) {
    return { sample_count: 0, mae: null, rmse: null, bias: null, pearson_correlation: null };
  }

  const errors = [];
  const forecastValues = [];
  const observationValues = [];
  for (const match of matches) {
    if (match === null || typeof match !== 'object' ||
        typeof match.forecast_minus_observation !== 'number' ||
        !Number.isFinite(match.forecast_minus_observation) ||
        typeof match.forecast?.value !== 'number' || !Number.isFinite(match.forecast.value) ||
        typeof match.observation?.value !== 'number' || !Number.isFinite(match.observation.value) ||
        match.forecast_minus_observation !== match.forecast.value - match.observation.value) {
      throw new TypeError('each match must include finite error, forecast.value, and observation.value');
    }
    errors.push(match.forecast_minus_observation);
    forecastValues.push(match.forecast.value);
    observationValues.push(match.observation.value);
  }

  return {
    sample_count: matches.length,
    mae: calculateMAE(errors),
    rmse: calculateRMSE(errors),
    bias: calculateBias(errors),
    pearson_correlation: calculatePearsonCorrelation(forecastValues, observationValues),
  };
}