import { create } from 'zustand';
import { REGIONS } from '../data/referenceData.js';
import { getExtremes, getForecast, getRegions, onResponse } from '../services/api.js';

/**
 * Application store.
 *
 * UI state only (theme, selections, map, filters) plus server-backed state
 * that several views share (regions list, per-region forecast/extremes for
 * the Command Centre + map, and the global data_mode/attribution badges).
 * There is no local forecast generator anywhere: every value originates from
 * the FastAPI backend.
 */
export const useStore = create((set, get) => ({
  // Theme: light | dark
  theme: 'light',
  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next);
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    set({ theme: next });
  },

  // Operational forecast selections
  selectedRegionId: 'delhi_ncr',
  selectedVariable: 'rainfall',
  selectedLeadTime: '48h',
  selectedModelLayer: 'blend', // 'blend' | 'ifs' | 'aifs' | 'gfs' | 'icon'

  // Drawer status
  drawerOpen: false,

  // Map state
  basemap: 'satellite', // 'satellite' | 'dark' | 'nasa_gibs' | 'nasa_night'
  mapMode: 'forecast', // 'forecast' | 'weights' | 'anomaly'
  showRadarOverlay: true,

  // Filters
  filters: {
    searchQuery: '',
    alertLevel: 'ALL', // 'ALL' | 'CRITICAL' | 'HIGH' | 'MODERATE'
    sort: 'ALERT', // 'ALERT' | 'FORECAST' | 'NAME'
  },

  // -------------------------------------------------------------------------
  // Global API status badges (LIVE | CACHED | REPLAY reported by the backend)
  // -------------------------------------------------------------------------
  dataMode: null,
  attribution: null,
  apiStatus: 'unknown', // 'unknown' | 'ok'
  noteApiResponse: ({ dataMode, attribution }) =>
    set((s) => ({
      dataMode: dataMode || s.dataMode,
      attribution: attribution || s.attribution,
      apiStatus: 'ok',
    })),

  // -------------------------------------------------------------------------
  // Regions (static metadata + validated/benchmarked from GET /api/regions)
  // -------------------------------------------------------------------------
  regions: REGIONS.map((r) => ({ ...r, validated: null, benchmarked: null })),
  regionsStatus: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
  regionsError: null,
  loadRegions: async () => {
    if (get().regionsStatus === 'loading') return;
    set({ regionsStatus: 'loading', regionsError: null });
    try {
      const payload = await getRegions();
      const list = Array.isArray(payload) ? payload : payload.regions || [];
      const regions = REGIONS.map((r) => {
        const apiRegion = list.find((x) => x.id === r.id);
        return apiRegion
          ? { ...r, validated: !!apiRegion.validated, benchmarked: !!apiRegion.benchmarked }
          : { ...r, validated: null, benchmarked: null };
      });
      set({ regions, regionsStatus: 'ready', regionsError: null });
    } catch (err) {
      set({
        regionsStatus: 'error',
        regionsError: err?.message || String(err),
      });
    }
  },

  // -------------------------------------------------------------------------
  // Bulk regional data for the Command Centre watchlist + map markers.
  // Phase 1: GET /api/forecast per region (parallel).
  // Phase 2: GET /api/extremes per region — only after phase 1 so each
  //          region's provider series is already cached backend-side.
  // -------------------------------------------------------------------------
  regionalKey: null, // `${variable}|${leadHours}`
  regionalStatus: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
  regionalError: null,
  regionalForecasts: {}, // regionId -> forecast payload
  regionalExtremes: {}, // regionId -> extremes payload
  regionalErrors: {}, // regionId -> error message (e.g. clean backend 503)

  loadRegionalData: async () => {
    const { selectedVariable, selectedLeadTime, regionalKey, regionalStatus } = get();
    const lead = parseInt(selectedLeadTime, 10) || 48;
    const key = `${selectedVariable}|${lead}`;
    if (key === regionalKey && (regionalStatus === 'ready' || regionalStatus === 'loading')) {
      return;
    }

    set({
      regionalKey: key,
      regionalStatus: 'loading',
      regionalError: null,
      regionalForecasts: {},
      regionalExtremes: {},
      regionalErrors: {},
    });

    const settled = await Promise.allSettled(
      REGIONS.map((r) => getForecast({ region: r.id, variable: selectedVariable, leadTimeHours: lead }))
    );
    if (get().regionalKey !== key) return; // superseded by a newer selection

    const forecasts = {};
    const errors = {};
    const okIds = [];
    settled.forEach((res, i) => {
      const id = REGIONS[i].id;
      if (res.status === 'fulfilled') {
        forecasts[id] = res.value;
        okIds.push(id);
      } else {
        errors[id] = res.reason?.message || 'Forecast unavailable.';
      }
    });

    if (okIds.length === 0) {
      set({
        regionalStatus: 'error',
        regionalError: Object.values(errors)[0] || 'No regional forecast available.',
        regionalForecasts: {},
        regionalErrors: errors,
      });
      return;
    }

    set({ regionalForecasts: forecasts, regionalErrors: errors });

    const extSettled = await Promise.allSettled(
      okIds.map((id) => getExtremes({ region: id, leadTimeHours: lead }))
    );
    if (get().regionalKey !== key) return;

    const extremes = {};
    extSettled.forEach((res, i) => {
      if (res.status === 'fulfilled') extremes[okIds[i]] = res.value;
    });
    set({ regionalExtremes: extremes, regionalStatus: 'ready' });
  },

  // -------------------------------------------------------------------------
  // Selections & UI actions
  // -------------------------------------------------------------------------
  selectRegion: (regionId) => {
    set({ selectedRegionId: regionId, drawerOpen: true });
  },
  /** Select without opening the detail drawer (list/selector contexts). */
  focusRegion: (regionId) => set({ selectedRegionId: regionId }),
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),

  setVariable: (selectedVariable) => set({ selectedVariable }),
  setLeadTime: (selectedLeadTime) => set({ selectedLeadTime }),
  setModelLayer: (selectedModelLayer) => set({ selectedModelLayer }),
  setBasemap: (basemap) => set({ basemap }),
  setMapMode: (mapMode) => set({ mapMode }),
  toggleRadarOverlay: () => set((s) => ({ showRadarOverlay: !s.showRadarOverlay })),

  setFilter: (key, value) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    }));
  },
}));

// Feed every backend response's data_mode / attribution into the store so the
// TopBar badge and footer always reflect the most recent real payload.
onResponse((info) => useStore.getState().noteApiResponse(info));
