/**
 * VARUNA Provider Abstraction — Data Types & Normalization Contracts
 * Follows the VARUNA real data provider specification:
 * Normalized Forecast Records must have:
 * - model: string
 * - variable: string
 * - latitude: number
 * - longitude: number
 * - initialization_time: ISO UTC string
 * - valid_time: ISO UTC string
 * - lead_time_hours: number
 * - value: number
 * - unit: string
 * - source: string
 * - run_id: string
 * - mode: 'LIVE' | 'REPLAY' | 'DEMO'
 */

export const APPLICATION_MODES = {
  LIVE: 'LIVE',
  REPLAY: 'REPLAY',
  DEMO: 'DEMO',
};

export const PROVIDER_STATUS = {
  CONNECTED: 'CONNECTED',
  NOT_CONNECTED: 'NOT CONNECTED',
  NOT_CONFIGURED: 'NOT CONFIGURED',
  DEMO_MODE: 'DEMO MODE',
  INTEGRATION_PENDING: 'INTEGRATION PENDING',
};

/**
 * Creates a normalized forecast record conforming to Section 5 requirements
 */
export function createNormalizedForecast({
  model,
  variable,
  latitude,
  longitude,
  initializationTime,
  validTime,
  leadTimeHours,
  value,
  unit,
  source,
  runId,
  mode = APPLICATION_MODES.DEMO,
}) {
  return {
    model,
    variable,
    latitude: Number(latitude),
    longitude: Number(longitude),
    initialization_time: initializationTime,
    valid_time: validTime,
    lead_time_hours: Number(leadTimeHours),
    value: Number(value),
    unit,
    source,
    run_id: runId,
    mode,
  };
}
