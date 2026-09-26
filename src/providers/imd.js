/**
 * Provider Adapter: IMD Automatic Weather Station (AWS) Network
 * India Meteorological Department / Ministry of Earth Sciences (MoES)
 *
 * CRITICAL AUDIT STATUS:
 * - Direct official IMD AWS endpoints (aws.imd.gov.in) require MoES institutional credentials
 * - Ingestion is currently: INTEGRATION PENDING
 * - In demo/replay mode, observational reference values are sourced from validated historical reference points
 *   and must NOT be claimed as "Live IMD AWS Stream" or "Ground Truth".
 */
import { APPLICATION_MODES, PROVIDER_STATUS } from './types.js';

export const IMD_PROVIDER = {
  id: 'imd_aws',
  name: 'IMD AWS Network',
  fullName: 'India Meteorological Department Surface AWS / ARG Mesh',
  type: 'In-Situ Surface Observational Network',
  nativeResolution: 'Point Sensor Mesh (~850 Stations Across India)',
  cycle: '15-min / Hourly Telemetry (When Connected)',
  sourceUrl: 'https://aws.imd.gov.in (MoES Gateway)',
  status: PROVIDER_STATUS.INTEGRATION_PENDING,
  requiresApiKey: true,
  apiKeyEnvVar: 'VITE_IMD_AWS_API_KEY',
  directBrowserAccess: false, // IMD endpoints require backend proxy due to CORS & SSL certificate policies
  backendAccess: true,
  currentStatusNote: 'Official IMD AWS API credentials not configured. Live station feed integration pending.',
};

/**
 * Fetch observation from IMD AWS network
 * If API is not configured, returns reference data marked as INTEGRATION_PENDING / DEMO
 */
export async function fetchImdObservation({
  stationId = null,
  latitude,
  longitude,
  variable,
  observationTime = '2026-09-26T00:00:00Z',
  mode = APPLICATION_MODES.DEMO,
  referenceValue = null,
}) {
  const units = {
    rainfall: 'mm',
    temperature: '°C',
    wind_speed: 'km/h',
    pressure: 'hPa',
  };

  // In live mode, verify if backend proxy/API key is configured
  const apiKey =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_IMD_AWS_API_KEY
      ? import.meta.env.VITE_IMD_AWS_API_KEY
      : null;

  if (mode === APPLICATION_MODES.LIVE && apiKey) {
    try {
      // Backend proxy route for IMD AWS
      const res = await fetch(`/api/imd/station?stationId=${stationId || ''}&lat=${latitude}&lon=${longitude}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          station_id: data.stationId,
          station_name: data.stationName,
          observation_time: data.observationTime,
          latitude: data.latitude,
          longitude: data.longitude,
          variable,
          value: Number(data.value),
          unit: units[variable] || 'mm',
          source: 'IMD AWS In-Situ Sensor Telemetry',
          status: 'VERIFIED_OBSERVATION',
          mode: APPLICATION_MODES.LIVE,
        };
      }
    } catch {
      // Fall through to reference
    }
  }

  // Integration pending / Demo reference dataset
  return {
    station_id: stationId || 'PENDING_INTEGRATION',
    station_name: 'IMD Station (Integration Pending)',
    observation_time: observationTime,
    latitude: Number(latitude),
    longitude: Number(longitude),
    variable,
    value: referenceValue != null ? referenceValue : null,
    unit: units[variable] || 'mm',
    source: 'Reference Dataset (IMD AWS Ingestion Pending)',
    status: 'INTEGRATION_PENDING',
    mode: APPLICATION_MODES.DEMO,
  };
}
