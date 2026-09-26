import { create } from 'zustand';
import { REGIONS, getDeterministicForecast } from '../data/mockData.js';
import { APPLICATION_MODES } from '../providers/types.js';
import { getProviderMemberForecasts } from '../providers/index.js';

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
  selectedModelLayer: 'blend', // 'blend' | 'ifs' | 'aifs' | 'gfs'

  // Model Cycle Timestamps (Section 14)
  initializationTime: '2026-09-26T00:00:00Z',
  getValidTime: () => {
    const init = new Date(get().initializationTime);
    const hours = parseInt(get().selectedLeadTime, 10) || 48;
    return new Date(init.getTime() + hours * 3600 * 1000).toISOString();
  },

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

  // System Mode (Section 12 & 18): 'DEMO' | 'LIVE' | 'REPLAY'
  // Default is LIVE, connecting directly to authoritative Python FastAPI backend
  systemMode: APPLICATION_MODES.LIVE,
  effectiveMode: APPLICATION_MODES.LIVE,
  syncStatus: 'STANDBY', // 'STANDBY' | 'SYNCING' | 'CONNECTED' | 'FALLBACK_DEMO'
  syncErrorNote: null,
  loading: false,

  // Actions
  setSystemMode: async (requestedMode) => {
    if (requestedMode === APPLICATION_MODES.DEMO) {
      set({
        systemMode: APPLICATION_MODES.DEMO,
        effectiveMode: APPLICATION_MODES.DEMO,
        syncStatus: 'STANDBY',
        syncErrorNote: null,
      });
      return;
    }

    if (requestedMode === APPLICATION_MODES.REPLAY) {
      set({
        systemMode: APPLICATION_MODES.REPLAY,
        effectiveMode: APPLICATION_MODES.REPLAY,
        syncStatus: 'STANDBY',
        syncErrorNote: 'Replaying archived 00z reference cycle against ERA5 reanalysis',
      });
      return;
    }

    if (requestedMode === APPLICATION_MODES.LIVE) {
      set({
        systemMode: APPLICATION_MODES.LIVE,
        syncStatus: 'SYNCING',
        loading: true,
      });

      try {
        const { selectedRegionId, selectedVariable, selectedLeadTime } = get();
        const activeRegion = REGIONS.find((r) => r.id === selectedRegionId) || REGIONS[0];
        const activeVar = { id: selectedVariable, unit: 'mm' };
        const leadHours = parseInt(selectedLeadTime, 10) || 48;

        const liveResult = await getProviderMemberForecasts({
          region: activeRegion,
          variable: activeVar,
          leadTimeHours: leadHours,
          mode: APPLICATION_MODES.LIVE,
        });

        if (liveResult.mode === APPLICATION_MODES.LIVE) {
          set({
            effectiveMode: APPLICATION_MODES.LIVE,
            syncStatus: 'CONNECTED',
            syncErrorNote: null,
            loading: false,
          });
        } else {
          // Live provider unavailable, fall back safely to DEMO mode (Section 12)
          set({
            effectiveMode: APPLICATION_MODES.DEMO,
            syncStatus: 'FALLBACK_DEMO',
            syncErrorNote: 'Live external provider sync unavailable. Active mode maintained as DEMO.',
            loading: false,
          });
        }
      } catch {
        set({
          effectiveMode: APPLICATION_MODES.DEMO,
          syncStatus: 'FALLBACK_DEMO',
          syncErrorNote: 'Live provider connection failed. Reverted to DEMO mode.',
          loading: false,
        });
      }
    }
  },

  selectRegion: (regionId) => {
    set({ selectedRegionId: regionId, drawerOpen: true });
  },
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

  // Helper selector for active forecast calculation
  getCurrentForecast: () => {
    const { selectedRegionId, selectedVariable, selectedLeadTime, effectiveMode } = get();
    return getDeterministicForecast(selectedRegionId, selectedVariable, selectedLeadTime, effectiveMode);
  },

  // Helper selector for region list with forecast attached
  getRegionalForecasts: () => {
    const { selectedVariable, selectedLeadTime, filters, effectiveMode } = get();
    let list = REGIONS.map((region) => {
      const forecast = getDeterministicForecast(region.id, selectedVariable, selectedLeadTime, effectiveMode);
      return {
        ...region,
        forecast,
      };
    });

    if (filters.alertLevel !== 'ALL') {
      list = list.filter((r) => r.forecast.alertLevel.toUpperCase() === filters.alertLevel);
    }

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.state.toLowerCase().includes(q) ||
          r.zone.toLowerCase().includes(q) ||
          r.regime.toLowerCase().includes(q)
      );
    }

    if (filters.sort === 'FORECAST') {
      list.sort((a, b) => b.forecast.forecastValue - a.forecast.forecastValue);
    } else if (filters.sort === 'NAME') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Sort by alert severity: Critical > High > Moderate > Low
      const order = { Critical: 4, High: 3, Moderate: 2, Low: 1 };
      list.sort((a, b) => (order[b.forecast.alertLevel] || 0) - (order[a.forecast.alertLevel] || 0));
    }

    return list;
  },
}));
