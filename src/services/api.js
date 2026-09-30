/**
 * VARUNA API client — the single source of truth for backend access.
 *
 * Every page fetches real backend data through this module; there are no local
 * generators or synthetic fallbacks. Honest failure handling:
 *   - network/timeout problems throw ApiError with a human-readable message;
 *   - backend 503s (LIVE -> CACHED -> REPLAY all exhausted) surface the backend
 *     `detail` string plus `mode_tried`, never a raw proxy error;
 *   - each successful payload's `data_mode` (LIVE | CACHED | REPLAY) and
 *     `attribution` are reported to the store via onResponse() so the UI can
 *     badge them globally.
 *
 * Base URL: VITE_API_BASE_URL (default http://localhost:8000).
 */

export const DEFAULT_BASE_URL = 'http://localhost:8000';

export function apiBaseUrl() {
  const fromEnv = import.meta.env?.VITE_API_BASE_URL;
  return String(fromEnv || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

/** Normalised client-side error for any failed request. */
export class ApiError extends Error {
  constructor(message, { status = 0, kind = 'http', dataMode = null, modeTried = [], available = undefined } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind; // 'http' | 'network' | 'timeout' | 'parse'
    this.dataMode = dataMode;
    this.modeTried = modeTried;
    this.available = available;
  }
}

/** Coerce anything thrown inside the app into an ApiError for display. */
export function toApiError(err) {
  if (err instanceof ApiError) return err;
  return new ApiError(err?.message || String(err), { kind: 'unknown' });
}

// ---------------------------------------------------------------------------
// response observer (data_mode / attribution badges)
// ---------------------------------------------------------------------------
let responseObserver = null;

/** Register a callback invoked as { dataMode, attribution } after each payload. */
export function onResponse(fn) {
  responseObserver = fn;
}

function observe(body) {
  if (!responseObserver || !body || typeof body !== 'object') return;
  if (!('data_mode' in body) && !('attribution' in body)) return;
  responseObserver({
    dataMode: body.data_mode ?? null,
    attribution: body.attribution ?? null,
  });
}

// ---------------------------------------------------------------------------
// transport
// ---------------------------------------------------------------------------
async function request(path, { params = {}, timeoutMs = 30000 } = {}) {
  const url = new URL(apiBaseUrl() + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    throw new ApiError(
      aborted
        ? `Request timed out after ${Math.round(timeoutMs / 1000)} s (${path}).`
        : `Cannot reach the VARUNA API at ${apiBaseUrl()}. Start the backend with: uvicorn app.main:app --reload`,
      { kind: aborted ? 'timeout' : 'network' }
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const detail =
      body && typeof body === 'object'
        ? body.detail ?? body.message ?? text
        : text || `Request failed with status ${res.status}`;
    throw new ApiError(typeof detail === 'string' ? detail : JSON.stringify(detail), {
      status: res.status,
      kind: 'http',
      dataMode: body?.data_mode ?? null,
      modeTried: Array.isArray(body?.mode_tried) ? body.mode_tried : [],
      available: body?.available,
    });
  }

  if (body === null && text) {
    throw new ApiError('Backend returned a non-JSON response.', { status: res.status, kind: 'parse' });
  }

  observe(body);
  return body;
}

// ---------------------------------------------------------------------------
// endpoints
// ---------------------------------------------------------------------------
export function getHealth() {
  return request('/api/health', { timeoutMs: 10000 });
}

export function getRegions() {
  return request('/api/regions', { timeoutMs: 10000 });
}

/** GET /api/forecast -> timeline payload (see varuna-backend docs/ARCHITECTURE.md). */
export function getForecast({ region, variable, leadTimeHours }) {
  return request('/api/forecast', {
    params: { region, variable, lead_time_hours: leadTimeHours },
  });
}

export function getWeights({ region, variable, leadTimeHours }) {
  return request('/api/weights', {
    params: { region, variable, lead_time_hours: leadTimeHours },
  });
}

export function getSkill() {
  return request('/api/skill', { timeoutMs: 30000 });
}

export function getExtremes({ region, leadTimeHours }) {
  // cold call builds temperature/wind/rainfall timelines (~1.5 s); allow headroom
  return request('/api/extremes', {
    params: { region, lead_time_hours: leadTimeHours },
    timeoutMs: 60000,
  });
}

export function getExplain({ region, variable, leadTimeHours }) {
  return request('/api/explain', {
    params: { region, variable, lead_time_hours: leadTimeHours },
  });
}

export function getProvidersStatus() {
  // three sequential provider probes on the backend can be slow when offline
  return request('/api/providers/status', { timeoutMs: 90000 });
}

// ---------------------------------------------------------------------------
// pure payload helpers (unit-tested in src/services/api.test.js)
// ---------------------------------------------------------------------------

/** UI lead strings ('48h') <-> backend integers (48). */
export function leadToHours(lead) {
  const h = parseInt(String(lead), 10);
  return Number.isFinite(h) ? h : 48;
}

export function hoursToLead(hours) {
  return `${hours}h`;
}

/** Frontend model layer ids <-> backend model keys. */
export const UI_TO_MODEL_KEY = {
  ifs: 'ecmwf_ifs',
  aifs: 'ecmwf_aifs',
  gfs: 'cep_gfs',
  icon: 'dwd_icon',
};

export const MODEL_KEY_TO_UI = Object.fromEntries(
  Object.entries(UI_TO_MODEL_KEY).map(([ui, key]) => [key, ui])
);

/**
 * Pick the timeline entry for a lead: exact match, otherwise the first entry
 * at or beyond it (horizon cap), otherwise the last available entry.
 */
export function entryAtLead(timeline, leadHours) {
  if (!Array.isArray(timeline) || timeline.length === 0) return null;
  const exact = timeline.find((e) => e.lead_time_hours === leadHours);
  if (exact) return exact;
  // Accept the next-longer lead only (irregular spacing); never substitute a
  // shorter lead for a longer request — the UI would mislabel the value.
  return timeline.find((e) => e.lead_time_hours > leadHours) || null;
}

/** Map backend alert severities to the UI's three-level watch tiers. */
const CRITICAL_SEVERITIES = new Set(['very_heavy', 'gale', 'heatwave']);
const HIGH_SEVERITIES = new Set(['heavy', 'squall']);

export function alertTier(alerts) {
  if (!Array.isArray(alerts) || alerts.length === 0) {
    return { tier: 'Low', crossed: false, label: 'No threshold crossing' };
  }
  // Only explicit crossings can raise a tier; an evaluated-but-not-crossed
  // check must never be displayed as an alert.
  const active = alerts.filter((a) => a.crossed !== false);
  if (active.length === 0) {
    return { tier: 'Low', crossed: false, label: 'No threshold crossing' };
  }
  const critical = active.filter((a) => CRITICAL_SEVERITIES.has(a.severity));
  if (critical.length > 0) {
    return { tier: 'Critical', crossed: true, label: critical.map((a) => a.threshold_label).join(' · ') };
  }
  const high = active.filter((a) => HIGH_SEVERITIES.has(a.severity));
  if (high.length > 0) {
    return { tier: 'High', crossed: true, label: high.map((a) => a.threshold_label).join(' · ') };
  }
  return { tier: 'Low', crossed: false, label: 'No threshold crossing' };
}
