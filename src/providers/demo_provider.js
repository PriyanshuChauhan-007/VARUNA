/**
 * VARUNA Explicit Demo Data Provider
 * Refactored from earlier mock engine into an auditable, deterministic demo provider.
 * Explicitly marks all generated records as APPLICATION_MODES.DEMO.
 */
import { createNormalizedForecast, APPLICATION_MODES } from './types.js';

// Seeded PRNG for consistent, reproducible evaluation
function createPrng(seed) {
  let s = Math.abs(seed) % 2147483647;
  if (s === 0) s = 12345678;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Generate normalized member forecasts for a given region, variable, and lead time
 */
export function generateDemoMemberForecasts({
  region,
  variable,
  leadTimeHours = 48,
  initializationTime = '2026-09-26T00:00:00Z',
}) {
  const initDate = new Date(initializationTime);
  const validDate = new Date(initDate.getTime() + leadTimeHours * 3600 * 1000);
  const validTime = validDate.toISOString();
  const runId = `demo_cycle_${initDate.toISOString().slice(0, 10).replace(/-/g, '')}_00z`;

  const leadFactor =
    leadTimeHours <= 24 ? 1.0 : leadTimeHours <= 48 ? 1.4 : leadTimeHours <= 72 ? 1.8 : 2.3;

  const seed = hashString(`${region.id}_${variable.id}_${leadTimeHours}h`);
  const rand = createPrng(seed);

  let ifsVal;
  let aifsVal;
  let gfsVal;
  let baseRmse;
  let alertLevel;
  let alertReason;

  if (variable.id === 'rainfall') {
    if (region.id === 'western_ghats' || region.id === 'mumbai_coastal') {
      ifsVal = 82.5 + rand() * 12;
      aifsVal = 94.2 + rand() * 10;
      gfsVal = 71.0 + rand() * 15;
      baseRmse = 4.2;
      alertLevel = 'Critical';
      alertReason = 'Very Heavy Orographic Cloud Burst Warning (24h Accumulated)';
    } else if (region.id === 'odisha_coast' || region.id === 'assam_valley') {
      ifsVal = 58.0 + rand() * 10;
      aifsVal = 67.4 + rand() * 8;
      gfsVal = 52.1 + rand() * 12;
      baseRmse = 3.4;
      alertLevel = 'High';
      alertReason = 'Heavy Precipitation Alert (24h Accumulated > 64.5 mm)';
    } else if (region.id === 'delhi_ncr' || region.id === 'punjab_agri') {
      ifsVal = 28.5 + rand() * 6;
      aifsVal = 34.2 + rand() * 5;
      gfsVal = 22.4 + rand() * 7;
      baseRmse = 2.1;
      alertLevel = 'Moderate';
      alertReason = 'Convective Rain Cells Detected';
    } else {
      ifsVal = 6.2 + rand() * 5;
      aifsVal = 7.8 + rand() * 4;
      gfsVal = 5.1 + rand() * 6;
      baseRmse = 1.2;
      alertLevel = 'Low';
      alertReason = 'Light Scattered Showers (<15.5 mm)';
    }
  } else if (variable.id === 'temperature') {
    if (region.id === 'rajasthan_thar' || region.id === 'gujarat_industrial') {
      ifsVal = 43.8 + rand() * 2.2;
      aifsVal = 44.5 + rand() * 1.8;
      gfsVal = 42.9 + rand() * 2.5;
      baseRmse = 0.9;
      alertLevel = 'Critical';
      alertReason = 'Severe Heatwave (Daily Max > 44°C) Warning';
    } else if (region.id === 'delhi_ncr' || region.id === 'central_highlands') {
      ifsVal = 39.2 + rand() * 2.0;
      aifsVal = 39.8 + rand() * 1.5;
      gfsVal = 38.5 + rand() * 2.2;
      baseRmse = 0.7;
      alertLevel = 'High';
      alertReason = 'Elevated Summer Temperature Advisory (Daily Max > 39°C)';
    } else {
      ifsVal = 31.4 + rand() * 2.0;
      aifsVal = 32.0 + rand() * 1.6;
      gfsVal = 30.8 + rand() * 2.2;
      baseRmse = 0.5;
      alertLevel = 'Low';
      alertReason = 'Normal Seasonal Temperatures';
    }
  } else if (variable.id === 'wind_speed') {
    if (region.id === 'odisha_coast' || region.id === 'mumbai_coastal' || region.id === 'chennai_coastal') {
      ifsVal = 54.0 + rand() * 8.0;
      aifsVal = 62.5 + rand() * 7.0;
      gfsVal = 49.0 + rand() * 9.0;
      baseRmse = 3.8;
      alertLevel = 'High';
      alertReason = 'Coastal Squally Weather Influx (Sustained > 55 km/h)';
    } else {
      ifsVal = 18.2 + rand() * 5.0;
      aifsVal = 19.5 + rand() * 4.0;
      gfsVal = 16.8 + rand() * 6.0;
      baseRmse = 1.8;
      alertLevel = 'Low';
      alertReason = 'Breezy Surface Conditions';
    }
  } else {
    // Surface Pressure
    ifsVal = 1004.2 - rand() * 4.0;
    aifsVal = 1003.8 - rand() * 3.5;
    gfsVal = 1005.1 - rand() * 4.2;
    baseRmse = 0.8;
    alertLevel = ifsVal < 998 ? 'High' : 'Low';
    alertReason = ifsVal < 998 ? 'Trough Pressure Depression (< 998 hPa)' : 'Stable Isobaric Gradient';
  }

  const ifsRecord = createNormalizedForecast({
    model: 'ECMWF IFS',
    variable: variable.id,
    latitude: region.lat,
    longitude: region.lng,
    initializationTime,
    validTime,
    leadTimeHours,
    value: Number(ifsVal.toFixed(1)),
    unit: variable.unit,
    source: 'ECMWF IFS Reference (Demo Data)',
    runId,
    mode: APPLICATION_MODES.DEMO,
  });

  const aifsRecord = createNormalizedForecast({
    model: 'ECMWF AIFS',
    variable: variable.id,
    latitude: region.lat,
    longitude: region.lng,
    initializationTime,
    validTime,
    leadTimeHours,
    value: Number(aifsVal.toFixed(1)),
    unit: variable.unit,
    source: 'ECMWF AIFS Reference (Demo Data)',
    runId,
    mode: APPLICATION_MODES.DEMO,
  });

  const gfsRecord = createNormalizedForecast({
    model: 'NOAA GFS',
    variable: variable.id,
    latitude: region.lat,
    longitude: region.lng,
    initializationTime,
    validTime,
    leadTimeHours,
    value: Number(gfsVal.toFixed(1)),
    unit: variable.unit,
    source: 'NOAA GFS Reference (Demo Data)',
    runId,
    mode: APPLICATION_MODES.DEMO,
  });

  return {
    ifs: ifsRecord,
    aifs: aifsRecord,
    gfs: gfsRecord,
    baseRmse,
    leadFactor,
    alertLevel,
    alertReason,
    initializationTime,
    validTime,
    leadTimeHours,
    runId,
  };
}
