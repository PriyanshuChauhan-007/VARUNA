/**
 * Formatting utilities for VARUNA — Adaptive Weather Intelligence
 */
import { RISK_TIERS } from '../data/mockData.js';

export function getRiskColor(tier) {
  return RISK_TIERS[tier] || RISK_TIERS['Low'];
}

export function formatCoords(lat, lng) {
  if (lat == null || lng == null) return '';
  return `${Number(lat).toFixed(4)}°N, ${Number(lng).toFixed(4)}°E`;
}

export function formatTimestamp(iso) {
  if (!iso) return 'Just now';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatValueWithUnit(val, unit) {
  if (val == null) return '—';
  return `${val} ${unit}`;
}

export function getModelColor(modelId) {
  switch (modelId?.toLowerCase()) {
    case 'ifs':
    case 'ecmwf ifs':
      return '#2563EB';
    case 'aifs':
    case 'ecmwf aifs':
      return '#8B5CF6';
    case 'gfs':
    case 'noaa gfs':
      return '#059669';
    case 'blend':
    case 'varuna blend':
    default:
      return '#D97706';
  }
}
