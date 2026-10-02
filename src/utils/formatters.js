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

export function getNdmaProtocol(alertLevel = 'Low') {
  switch (alertLevel) {
    case 'Critical':
      return {
        level: 'RED',
        code: 'NDMA-LVL-3 · RED WARNING',
        title: 'Immediate Action Protocol',
        action: 'Civil defense activation, low-lying drainage evacuation & emergency shelter readiness.',
        color: '#DC2626',
        bg: '#FEF2F2',
        border: '#FECACA',
      };
    case 'High':
      return {
        level: 'ORANGE',
        code: 'NDMA-LVL-2 · ORANGE ADVISORY',
        title: 'Operational Preparedness',
        action: 'Pre-position SDRF/NDRF rescue teams, notify district emergency operation centres.',
        color: '#EA580C',
        bg: '#FFF7ED',
        border: '#FED7AA',
      };
    case 'Moderate':
      return {
        level: 'YELLOW',
        code: 'NDMA-LVL-1 · YELLOW WATCH',
        title: 'Standby Alert',
        action: 'District Emergency Operation Centre (EOC) activated for active monitoring.',
        color: '#D97706',
        bg: '#FFFBEB',
        border: '#FDE68A',
      };
    case 'Low':
    default:
      return {
        level: 'GREEN',
        code: 'NDMA-LVL-0 · GREEN NOMINAL',
        title: 'Routine Agro-Met Advisory',
        action: 'Normal baseline weather conditions. Standard agricultural, municipal and transport operations.',
        color: '#16A34A',
        bg: '#F0FDF4',
        border: '#BBF7D0',
      };
  }
}

export function getVariableIcon(variableId) {
  switch (variableId) {
    case 'rainfall': return '🌧️';
    case 'temperature': return '🌡️';
    case 'wind_speed': return '💨';
    case 'pressure': return '🧭';
    default: return '🌤️';
  }
}

