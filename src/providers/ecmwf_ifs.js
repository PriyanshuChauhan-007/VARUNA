/**
 * Provider Adapter: ECMWF IFS (Integrated Forecasting System)
 * High-Resolution Physical NWP Model
 */
import { createNormalizedForecast, APPLICATION_MODES, PROVIDER_STATUS } from './types.js';

export const ECMWF_IFS_PROVIDER = {
  id: 'ecmwf_ifs',
  name: 'ECMWF IFS',
  fullName: 'ECMWF Integrated Forecasting System (HRES)',
  type: 'Physics-Based Global NWP',
  nativeResolution: '0.1° (~9 km) / 0.25° Open Data',
  cycle: '00z / 12z Operational',
  sourceUrl: 'https://open-data.ecmwf.int / Open-Meteo',
  status: PROVIDER_STATUS.NOT_CONNECTED,
  requiresApiKey: false,
  apiKeyEnvVar: null,
  directBrowserAccess: true,
  backendAccess: true,
  currentStatusNote: 'Adapter configured. Live external connection pending runtime API switch.',
};

/**
 * Fetch forecast from ECMWF IFS
 * If network call fails or mode is DEMO, returns normalized structure marked as DEMO.
 */
export async function fetchEcmwfIfsForecast({
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
  const runId = `ecmwf_ifs_${initDate.toISOString().slice(0, 10).replace(/-/g, '')}_00z`;

  // Map variable to standard units
  const units = {
    rainfall: 'mm',
    temperature: '°C',
    wind_speed: 'km/h',
    pressure: 'hPa',
  };

  // If live mode requested, attempt external API call
  if (mode === APPLICATION_MODES.LIVE) {
    try {
      const varMap = {
        rainfall: 'precipitation',
        temperature: 'temperature_2m',
        wind_speed: 'wind_speed_10m',
        pressure: 'surface_pressure',
      };
      const apiVar = varMap[variable] || 'precipitation';
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&models=ecmwf_ifs025&hourly=${apiVar}&forecast_days=6`;
      
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const hourlyTimes = data.hourly?.time || [];
        const hourlyVals =
          data.hourly?.[apiVar] ||
          data.hourly?.[`${apiVar}_ecmwf_ifs025`] ||
          data.hourly?.[Object.keys(data.hourly || {}).find((k) => k.startsWith(apiVar))] ||
          [];
        
        // Find closest hour to validDate
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
            model: 'ECMWF IFS',
            variable,
            latitude,
            longitude,
            initializationTime,
            validTime,
            leadTimeHours,
            value: Number(val.toFixed(1)),
            unit: units[variable] || 'mm',
            source: 'ECMWF Open Data 0.25° via Open-Meteo',
            runId,
            mode: APPLICATION_MODES.LIVE,
          });
        }
      }
    } catch {
      // Live call failed, fall through to deterministic fallback
    }
  }

  // Demo / Replay / Fallback mode
  return createNormalizedForecast({
    model: 'ECMWF IFS',
    variable,
    latitude,
    longitude,
    initializationTime,
    validTime,
    leadTimeHours,
    value: fallbackValue != null ? fallbackValue : 28.5,
    unit: units[variable] || 'mm',
    source: 'ECMWF IFS Operational Reference (Demo Mode)',
    runId,
    mode: APPLICATION_MODES.DEMO,
  });
}
