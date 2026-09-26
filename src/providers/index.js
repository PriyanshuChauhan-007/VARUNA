/**
 * VARUNA Providers Registry & Dispatcher
 */
import { APPLICATION_MODES, PROVIDER_STATUS } from './types.js';
import { ECMWF_IFS_PROVIDER, fetchEcmwfIfsForecast } from './ecmwf_ifs.js';
import { ECMWF_AIFS_PROVIDER, fetchEcmwfAifsForecast } from './ecmwf_aifs.js';
import { NCEP_GFS_PROVIDER, fetchNcepGfsForecast } from './ncep_gfs.js';
import { IMD_PROVIDER } from './imd.js';
import { generateDemoMemberForecasts } from './demo_provider.js';

export {
  APPLICATION_MODES,
  PROVIDER_STATUS,
  ECMWF_IFS_PROVIDER,
  ECMWF_AIFS_PROVIDER,
  NCEP_GFS_PROVIDER,
  IMD_PROVIDER,
};

export const ALL_PROVIDERS = [
  ECMWF_IFS_PROVIDER,
  ECMWF_AIFS_PROVIDER,
  NCEP_GFS_PROVIDER,
  IMD_PROVIDER,
];

/**
 * Return system-level provider ingestion statuses
 * Accurately reflects actual system state without deceptive "100% Ingested" claims
 */
export function getSystemFeedsCatalog(activeMode = APPLICATION_MODES.DEMO) {
  const isDemo = activeMode === APPLICATION_MODES.DEMO;
  const isReplay = activeMode === APPLICATION_MODES.REPLAY;

  const nwpStatus = isDemo ? 'Demo Provider' : isReplay ? 'Replay Archive' : 'External API Standby';
  const nwpHealth = isDemo ? 'Demo Standby' : isReplay ? 'Verified Reference' : 'Open-Meteo Gateway';
  const nwpLatency = isDemo ? 'Simulated 00z Run' : isReplay ? 'Archived 00z Cycle' : 'Pending Live Sync';
  const nwpPoints = isDemo || isReplay ? 1420 : 0;

  return [
    {
      name: 'ECMWF IFS HRES 9km',
      type: 'Physics-Based NWP (ECMWF Open Data)',
      cycle: '00z / 12z Operational',
      latency: nwpLatency,
      resolution: '0.1° (~9 km) / 0.25° Open Data',
      status: nwpStatus,
      health: nwpHealth,
      verificationPoints: nwpPoints,
      mode: activeMode,
      authRequired: false,
    },
    {
      name: 'ECMWF AIFS Transformer',
      type: 'Deep Learning Spherical ML (ECMWF Open Data)',
      cycle: '00z / 12z Operational',
      latency: nwpLatency,
      resolution: '0.25° (~28 km)',
      status: nwpStatus,
      health: nwpHealth,
      verificationPoints: nwpPoints,
      mode: activeMode,
      authRequired: false,
    },
    {
      name: 'NOAA GFS Global 13km',
      type: 'Operational NWP (FV3 Core)',
      cycle: '00z / 06z / 12z / 18z',
      latency: nwpLatency,
      resolution: '0.25° (~28 km) / 13 km Native',
      status: nwpStatus,
      health: nwpHealth,
      verificationPoints: nwpPoints,
      mode: activeMode,
      authRequired: false,
    },
    {
      name: 'IMD Surface AWS Mesh',
      type: 'Observational Ground Stations (In-Situ Telemetry)',
      cycle: '15-min Telemetry Stream',
      latency: 'Not Configured',
      resolution: 'Point Sensor Mesh (~850 Stations)',
      status: 'Integration Pending',
      health: 'MoES Auth Required',
      verificationPoints: 0,
      mode: activeMode,
      authRequired: true,
    },
    {
      name: 'INSAT-3D/3DR Multispectral',
      type: 'Geostationary Satellite Imagery (MOSDAC)',
      cycle: 'Half-Hourly Rapid Scan',
      latency: 'Not Configured',
      resolution: '1 km / 4 km',
      status: 'Not Configured',
      health: 'MOSDAC Auth Required',
      verificationPoints: 0,
      mode: activeMode,
      authRequired: true,
    },
  ];
}

/**
 * Fetch synchronized multi-model forecast member records
 */
export async function getProviderMemberForecasts({
  region,
  variable,
  leadTimeHours = 48,
  initializationTime = '2026-09-26T00:00:00Z',
  mode = APPLICATION_MODES.DEMO,
}) {
  // Use explicit deterministic demo generator for member inputs
  const demoOutput = generateDemoMemberForecasts({
    region,
    variable,
    leadTimeHours,
    initializationTime,
  });

  if (mode === APPLICATION_MODES.LIVE) {
    // Attempt concurrent live fetches with fallback to demoOutput values
    try {
      const [ifsLive, aifsLive, gfsLive] = await Promise.all([
        fetchEcmwfIfsForecast({
          latitude: region.lat,
          longitude: region.lng,
          variable: variable.id,
          leadTimeHours,
          initializationTime,
          mode: APPLICATION_MODES.LIVE,
          fallbackValue: demoOutput.ifs.value,
        }),
        fetchEcmwfAifsForecast({
          latitude: region.lat,
          longitude: region.lng,
          variable: variable.id,
          leadTimeHours,
          initializationTime,
          mode: APPLICATION_MODES.LIVE,
          fallbackValue: demoOutput.aifs.value,
        }),
        fetchNcepGfsForecast({
          latitude: region.lat,
          longitude: region.lng,
          variable: variable.id,
          leadTimeHours,
          initializationTime,
          mode: APPLICATION_MODES.LIVE,
          fallbackValue: demoOutput.gfs.value,
        }),
      ]);

      const allLive =
        ifsLive.mode === APPLICATION_MODES.LIVE &&
        aifsLive.mode === APPLICATION_MODES.LIVE &&
        gfsLive.mode === APPLICATION_MODES.LIVE;

      return {
        ifs: ifsLive,
        aifs: aifsLive,
        gfs: gfsLive,
        baseRmse: demoOutput.baseRmse,
        leadFactor: demoOutput.leadFactor,
        alertLevel: demoOutput.alertLevel,
        alertReason: demoOutput.alertReason,
        initializationTime,
        validTime: demoOutput.validTime,
        leadTimeHours,
        runId: demoOutput.runId,
        mode: allLive ? APPLICATION_MODES.LIVE : APPLICATION_MODES.DEMO,
      };
    } catch {
      // Fall through to demo output
    }
  }

  return {
    ...demoOutput,
    mode: APPLICATION_MODES.DEMO,
  };
}
