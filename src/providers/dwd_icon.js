/**
 * Provider Adapter: DWD ICON (Icosahedral Non-Hydrostatic Model)
 * Deutscher Wetterdienst Global NWP Model
 */
import { createNormalizedForecast, APPLICATION_MODES, PROVIDER_STATUS } from './types.js';

export const DWD_ICON_PROVIDER = {
  id: 'dwd_icon',
  name: 'DWD ICON',
  fullName: 'Deutscher Wetterdienst ICON Global (Icosahedral Non-Hydrostatic)',
  type: 'Icosahedral Non-Hydrostatic NWP',
  nativeResolution: '0.12° (~13 km)',
  cycle: '00z / 06z / 12z / 18z Operational',
  sourceUrl: 'https://opendata.dwd.de / Open-Meteo ICON',
  status: PROVIDER_STATUS.NOT_CONNECTED,
  requiresApiKey: false,
  apiKeyEnvVar: null,
  directBrowserAccess: true,
  backendAccess: true,
  currentStatusNote: 'Adapter configured. Live external connection via Open-Meteo icon_seamless.',
};

/**
 * Fetch forecast from DWD ICON
 */
export async function fetchDwdIconForecast({
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
  const runId = `dwd_icon_${initDate.toISOString().slice(0, 10).replace(/-/g, '')}_00z`;

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
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&models=icon_seamless&hourly=${apiVar}&forecast_days=6`;

      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const hourlyTimes = data?.hourly?.time || [];
        const hourlyVals = data?.hourly?.[apiVar] || [];

        // Find the index closest to validTime
        const validTimePrefix = validTime.slice(0, 13);
        const matchIdx = hourlyTimes.findIndex((t) => t.startsWith(validTimePrefix));

        let liveValue = fallbackValue;
        if (matchIdx >= 0 && hourlyVals[matchIdx] !== null && !isNaN(hourlyVals[matchIdx])) {
          liveValue = hourlyVals[matchIdx];
        }

        return createNormalizedForecast({
          model: 'DWD ICON',
          variable,
          latitude,
          longitude,
          initializationTime,
          validTime,
          leadTimeHours,
          value: liveValue !== null ? liveValue : (fallbackValue ?? 0),
          unit: units[variable] || '',
          source: 'Open-Meteo DWD ICON Seamless Gateway',
          runId,
          mode: APPLICATION_MODES.LIVE,
          status: PROVIDER_STATUS.CONNECTED,
        });
      }
    } catch {
      // Fallback on error
    }
  }

  // Return fallback in DEMO mode
  return createNormalizedForecast({
    model: 'DWD ICON',
    variable,
    latitude,
    longitude,
    initializationTime,
    validTime,
    leadTimeHours,
    value: fallbackValue ?? 0,
    unit: units[variable] || '',
    source: 'DWD ICON Demo Provider',
    runId,
    mode: APPLICATION_MODES.DEMO,
    status: PROVIDER_STATUS.FALLBACK_DEMO,
  });
}
