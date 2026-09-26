/**
 * Provider Adapter: ECMWF AIFS (Artificial Intelligence Forecasting System)
 * Deep Learning Spherical Graph / Transformer Weather Prediction
 */
import { createNormalizedForecast, APPLICATION_MODES, PROVIDER_STATUS } from './types.js';

export const ECMWF_AIFS_PROVIDER = {
  id: 'ecmwf_aifs',
  name: 'ECMWF AIFS',
  fullName: 'ECMWF AI Forecasting System (AIFS Single)',
  type: 'Deep Learning Spherical Transformer',
  nativeResolution: '0.25° (~28 km)',
  cycle: '00z / 12z Operational',
  sourceUrl: 'https://open-data.ecmwf.int / Open-Meteo AIFS',
  status: PROVIDER_STATUS.NOT_CONNECTED,
  requiresApiKey: false,
  apiKeyEnvVar: null,
  directBrowserAccess: true,
  backendAccess: true,
  currentStatusNote: 'Adapter configured. Live external connection pending runtime API switch.',
};

/**
 * Fetch forecast from ECMWF AIFS
 */
export async function fetchEcmwfAifsForecast({
  latitude,
  longitude,
  variable,
  leadTimeHours = 48,
  initializationTime = '2026-09-26T00:00:00Z',
  mode = APPLICATION_MODES.DEMO,
  fallbackValue = null,
}) {
  const initDate = new Date(initializationTime);
  const validDate = new Date(initDate.getTime() + leadTimeHours * 3600 * 1000);
  const validTime = validDate.toISOString();
  const runId = `ecmwf_aifs_${initDate.toISOString().slice(0, 10).replace(/-/g, '')}_00z`;

  const units = {
    rainfall: 'mm',
    temperature: '°C',
    wind_speed: 'km/h',
    pressure: 'hPa',
  };

  if (mode === APPLICATION_MODES.LIVE) {
    try {
      const varMap = {
        rainfall: 'precipitation',
        temperature: 'temperature_2m',
        wind_speed: 'wind_speed_10m',
        pressure: 'surface_pressure',
      };
      const apiVar = varMap[variable] || 'precipitation';
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&models=ecmwf_aifs025_single&hourly=${apiVar}&forecast_days=6`;
      
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const hourlyTimes = data.hourly?.time || [];
        const hourlyVals =
          data.hourly?.[apiVar] ||
          data.hourly?.[`${apiVar}_ecmwf_aifs025`] ||
          data.hourly?.[Object.keys(data.hourly || {}).find((k) => k.startsWith(apiVar))] ||
          [];

        const targetHourStr = validTime.slice(0, 13) + ':00';
        let foundIdx = hourlyTimes.findIndex((t) => t.startsWith(targetHourStr));
        if (foundIdx === -1 && leadTimeHours < hourlyVals.length) {
          foundIdx = leadTimeHours;
        }

        if (foundIdx !== -1 && hourlyVals[foundIdx] != null) {
          let val = Number(hourlyVals[foundIdx]);
          if (variable === 'rainfall' || variable === 'wind_speed') {
            val = Math.max(0, val);
          }
          return createNormalizedForecast({
            model: 'ECMWF AIFS',
            variable,
            latitude,
            longitude,
            initializationTime,
            validTime,
            leadTimeHours,
            value: Number(val.toFixed(1)),
            unit: units[variable] || 'mm',
            source: 'ECMWF AIFS 0.25° via Open-Meteo',
            runId,
            mode: APPLICATION_MODES.LIVE,
          });
        }
      }
    } catch {
      // Live call failed, fall back
    }
  }

  return createNormalizedForecast({
    model: 'ECMWF AIFS',
    variable,
    latitude,
    longitude,
    initializationTime,
    validTime,
    leadTimeHours,
    value: fallbackValue != null ? fallbackValue : 34.2,
    unit: units[variable] || 'mm',
    source: 'ECMWF AIFS ML Benchmark (Demo Mode)',
    runId,
    mode: APPLICATION_MODES.DEMO,
  });
}
