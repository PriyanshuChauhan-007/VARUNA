import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { RISK_TIERS, regimeName } from '../data/referenceData.js';
import { entryAtLead, leadToHours, alertTier } from '../services/api';
import { getRiskColor } from '../utils/formatters';
import MapView from '../components/map/MapView';
import { LoadingState, ErrorState, EmptyState } from '../components/shared/StatusStates';
import { DataModeBadge, ValidatedBadge } from '../components/shared/Badges';

const MEMBER_LABELS = {
  ecmwf_ifs: 'IFS',
  ecmwf_aifs: 'AIFS',
  cep_gfs: 'GFS',
  dwd_icon: 'ICON',
};

const TIER_ORDER = { Critical: 4, High: 3, Moderate: 2, Low: 1, null: 0 };

export default function CommandCentre() {
  const selectedLeadTime = useStore((s) => s.selectedLeadTime);
  const setLeadTime = useStore((s) => s.setLeadTime);
  const selectedVariable = useStore((s) => s.selectedVariable);
  const selectRegion = useStore((s) => s.selectRegion);
  const selectedRegionId = useStore((s) => s.selectedRegionId);
  const regions = useStore((s) => s.regions);
  const regionalStatus = useStore((s) => s.regionalStatus);
  const regionalError = useStore((s) => s.regionalError);
  const regionalForecasts = useStore((s) => s.regionalForecasts);
  const regionalExtremes = useStore((s) => s.regionalExtremes);
  const regionalErrors = useStore((s) => s.regionalErrors);
  const loadRegionalData = useStore((s) => s.loadRegionalData);
  const loadRegions = useStore((s) => s.loadRegions);
  const dataMode = useStore((s) => s.dataMode);
  const attribution = useStore((s) => s.attribution);

  const [mobileView, setMobileView] = useState('map'); // 'map' | 'priority'
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'SEVERE' | 'MONSOON' | 'HEAT' | 'COASTAL'
  const [sortBy, setSortBy] = useState('ALERT'); // 'ALERT' | 'FORECAST' | 'NAME'

  const leadHours = leadToHours(selectedLeadTime);

  useEffect(() => {
    loadRegions();
    loadRegionalData();
  }, [loadRegions, loadRegionalData, selectedVariable, selectedLeadTime]);

  // One row per region built exclusively from backend payloads.
  const rows = useMemo(() => {
    return regions.map((region) => {
      const forecast = regionalForecasts[region.id] || null;
      const extremes = regionalExtremes[region.id] || null;
      const entry = forecast ? entryAtLead(forecast.timeline, leadHours) : null;
      const tierInfo = extremes ? alertTier(extremes.alerts) : null;
      return {
        region,
        forecast,
        extremes,
        entry,
        value: entry?.blend ?? null,
        unit: forecast?.unit ?? '',
        weights: entry?.weights || {},
        modelsUsed: entry?.models_used ?? null,
        degraded: !!entry?.degraded,
        tier: tierInfo?.tier ?? null,
        tierLabel: tierInfo?.label ?? null,
        regime: regimeName(entry?.regime_index) || forecast?.regime?.name || null,
        validated: forecast ? !!forecast.validated : null,
        dataMode: forecast?.data_mode || null,
        error: regionalErrors[region.id] || null,
      };
    });
  }, [regions, regionalForecasts, regionalExtremes, regionalErrors, leadHours]);

  const filteredRegions = useMemo(() => {
    let list = [...rows];
    if (filterTab === 'SEVERE') {
      list = list.filter((r) => r.tier === 'Critical' || r.tier === 'High');
    } else if (filterTab === 'MONSOON') {
      list = list.filter(
        (r) =>
          (r.regime || '').toLowerCase().includes('monsoonal') ||
          (r.regime || '').toLowerCase().includes('depression') ||
          (r.region.zone || '').toLowerCase().includes('trough')
      );
    } else if (filterTab === 'HEAT') {
      list = list.filter(
        (r) =>
          (r.regime || '').toLowerCase().includes('heatwave') ||
          (r.region.zone || '').toLowerCase().includes('arid') ||
          (r.region.zone || '').toLowerCase().includes('plateau')
      );
    } else if (filterTab === 'COASTAL') {
      list = list.filter(
        (r) =>
          (r.region.zone || '').toLowerCase().includes('maritime') ||
          (r.region.zone || '').toLowerCase().includes('littoral') ||
          (r.region.zone || '').toLowerCase().includes('coastal') ||
          (r.region.name || '').toLowerCase().includes('coast')
      );
    }

    if (sortBy === 'FORECAST') {
      list.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
    } else if (sortBy === 'NAME') {
      list.sort((a, b) => a.region.name.localeCompare(b.region.name));
    } else {
      list.sort((a, b) => (TIER_ORDER[b.tier] || 0) - (TIER_ORDER[a.tier] || 0));
    }
    return list;
  }, [rows, filterTab, sortBy]);

  const stats = useMemo(() => {
    const loaded = rows.filter((r) => r.entry);
    const critical = loaded.filter((r) => r.tier === 'Critical').length;
    const high = loaded.filter((r) => r.tier === 'High').length;

    // Average member weight across loaded regions
    const avgWeights = {};
    loaded.forEach((r) => {
      Object.entries(r.weights).forEach(([k, v]) => {
        avgWeights[k] = (avgWeights[k] || 0) + (Number(v) || 0);
      });
    });
    let topModel = '—';
    let topPct = -1;
    Object.entries(avgWeights).forEach(([k, sum]) => {
      const pct = loaded.length ? Math.round(sum / loaded.length) : 0;
      if (pct > topPct) {
        topPct = pct;
        topModel = `${MEMBER_LABELS[k] || k} (${pct}%)`;
      }
    });

    const issued = loaded.map((r) => r.forecast?.issued_at).filter(Boolean).sort().pop();
    const cycle = issued ? `${issued.slice(11, 16)} UTC` : '—';
    const anyValidatedKnown = rows.some((r) => r.validated !== null);
    const allValidated = anyValidatedKnown && rows.every((r) => r.validated !== false);

    return {
      total: rows.length,
      loaded: loaded.length,
      critical,
      high,
      topModel,
      cycle,
      validatedKnown: anyValidatedKnown,
      allValidated,
    };
  }, [rows]);

  const isLoading = regionalStatus === 'loading' && stats.loaded === 0;
  const loadFailed = regionalStatus === 'error';

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--color-surface)]">
      {/* Mobile view toggle */}
      <div className="md:hidden flex items-center justify-between px-4 py-2 bg-[var(--color-panel)] border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-1 bg-[var(--color-surface)] p-1 rounded-[var(--radius-md)] border border-[var(--color-border)]">
          <button
            onClick={() => setMobileView('map')}
            className={`px-3 py-1 text-scale-xs font-semibold rounded-[var(--radius-sm)] transition-colors ${
              mobileView === 'map'
                ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)] shadow-xs'
                : 'text-[var(--color-text-secondary)]'
            }`}
          >
            Forecast Map
          </button>
          <button
            onClick={() => setMobileView('priority')}
            className={`px-3 py-1 text-scale-xs font-semibold rounded-[var(--radius-sm)] transition-colors ${
              mobileView === 'priority'
                ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)] shadow-xs'
                : 'text-[var(--color-text-secondary)]'
            }`}
          >
            Watchlist ({filteredRegions.length})
          </button>
        </div>
        <span className="font-data text-scale-xs text-[var(--color-text-secondary)] tabular-nums">
          {stats.loaded}/{stats.total} Zones
        </span>
      </div>

      {/* Main content: Map + Priority Sidebar */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Map Area */}
        <div className={`flex-1 min-w-0 h-full relative ${mobileView === 'priority' ? 'hidden md:block' : 'block'}`}>
          <MapView />
        </div>

        {/* Right Panel: Operational Forecast Watchlist */}
        <div
          className={`
            w-full md:w-[340px] border-l border-[var(--color-border)] bg-[var(--color-panel)] flex flex-col shrink-0 h-full transition-colors
            ${mobileView === 'map' ? 'hidden md:flex' : 'flex'}
          `}
        >
          {/* Header */}
          <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-scale-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                  Operational Watchlist
                </h2>
                <DataModeBadge mode={dataMode} />
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  VARUNA Blend · {selectedVariable.replace('_', ' ')} · +{selectedLeadTime}
                </span>
                {stats.validatedKnown && <ValidatedBadge validated={stats.allValidated} />}
              </div>
            </div>
            <span className="font-data text-scale-xs text-[var(--color-text-tertiary)] tabular-nums">
              {filteredRegions.length} of {stats.total}
            </span>
          </div>

          {/* Category Filter Pills */}
          <div className="px-3 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)] flex items-center gap-1 overflow-x-auto text-[11px] font-semibold">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'SEVERE', label: 'Threshold Alerts' },
              { id: 'MONSOON', label: 'Monsoon' },
              { id: 'HEAT', label: 'Heat' },
              { id: 'COASTAL', label: 'Coastal' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={`px-2.5 py-1 rounded-[var(--radius-sm)] shrink-0 transition-colors cursor-pointer ${
                  filterTab === tab.id
                    ? 'bg-slate-900 text-white font-bold'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sort bar */}
          <div className="px-3 py-1.5 border-b border-[var(--color-border-subtle)] bg-[var(--color-panel)] flex items-center justify-between text-[11px] text-[var(--color-text-secondary)]">
            <span className="font-medium">Showing {filteredRegions.length} regions</span>
            <div className="flex items-center gap-1.5">
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent font-semibold text-[var(--color-text-primary)] border-none outline-none cursor-pointer"
              >
                <option value="ALERT">Alert Severity</option>
                <option value="FORECAST">Forecast Value</option>
                <option value="NAME">Region Name</option>
              </select>
            </div>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-border-subtle)]">
            {isLoading && <LoadingState label="Loading regional forecasts…" />}
            {loadFailed && <ErrorState error={{ message: regionalError }} label="Regional forecasts unavailable" onRetry={loadRegionalData} />}
            {!isLoading && !loadFailed && filteredRegions.length === 0 && (
              <EmptyState
                title="No regions match this filter"
                message="Threshold filters only list regions where the blended forecast actually crossed an IMD threshold."
              />
            )}
            {filteredRegions.map((row) => {
              const { region, value, unit, tier, validated, error } = row;
              const isSelected = selectedRegionId === region.id;
              const color = tier ? getRiskColor(tier) : '#64748B';
              const weightList = Object.entries(row.weights)
                .sort((a, b) => (b[1] || 0) - (a[1] || 0))
                .map(([k, v]) => `${MEMBER_LABELS[k] || k} ${v}%`)
                .join(' · ');

              return (
                <button
                  key={region.id}
                  onClick={() => selectRegion(region.id)}
                  className={`
                    w-full text-left p-3.5 transition-colors hover:bg-[var(--color-surface)] cursor-pointer
                    ${isSelected ? 'bg-[var(--color-accent-subtle)]' : ''}
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-data text-scale-sm font-bold text-[var(--color-text-primary)]">
                      {region.name}
                    </span>
                    <span
                      className="px-2 py-0.5 text-[11px] font-bold rounded text-white font-data tabular-nums"
                      style={{ backgroundColor: color }}
                    >
                      {value !== null && value !== undefined ? `${value} ${unit}` : '—'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-scale-xs font-semibold text-[var(--color-text-primary)] truncate max-w-[150px]">
                      {tier ? `${tier} Alert` : 'Awaiting data'}
                    </span>
                    <span className="text-[var(--color-text-tertiary)]">·</span>
                    <span className="text-[11px] text-[var(--color-text-secondary)] truncate flex-1">
                      {row.regime || region.zone}
                    </span>
                  </div>

                  {error ? (
                    <div className="text-[11px] text-red-600 dark:text-red-400 font-medium truncate">
                      {error}
                    </div>
                  ) : (
                    <div className="text-scale-xs text-[var(--color-text-secondary)] flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] font-medium text-amber-700 dark:text-amber-400 font-data">
                        ⚡ {weightList || 'weights pending'}
                      </span>
                      <span className="font-data font-semibold text-[10px] text-slate-500 shrink-0">
                        {validated === false ? 'unvalidated' : row.degraded ? 'degraded' : `${row.modelsUsed ?? '—'} models`}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Attribution footer */}
          <div className="px-3 py-2 border-t border-[var(--color-border)] text-[9px] leading-snug text-[var(--color-text-tertiary)] font-data">
            {attribution || 'Data: Open-Meteo (CC BY 4.0), ECMWF, NOAA, DWD.'}
          </div>
        </div>
      </div>

      {/* Bottom strip: stats + lead time selector */}
      <div className="min-h-[48px] py-2 border-t border-[var(--color-border)] bg-[var(--color-panel)] flex flex-wrap items-center justify-between px-4 gap-3 shrink-0 overflow-x-auto transition-colors">
        <div className="flex items-center gap-4 sm:gap-6 flex-nowrap overflow-x-auto">
          <StatChip label="Regions Loaded" value={`${stats.loaded}/${stats.total}`} />
          <StatChip label="Issue Cycle" value={stats.cycle} />
          <StatChip label="Critical Alerts" value={stats.critical} color={RISK_TIERS.Critical} />
          <StatChip label="High Alerts" value={stats.high} color={RISK_TIERS.High} />
          <StatChip label="Top Weight Model" value={stats.topModel} color="#8B5CF6" />
          <StatChip label="Data Mode" value={dataMode || '—'} color="#16A34A" />
        </div>

        {/* Lead Time Scrubber Buttons */}
        <div className="flex items-center gap-1 bg-[var(--color-surface)] p-1 rounded-[var(--radius-md)] border border-[var(--color-border)] shrink-0 ml-auto">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mr-1 px-1 hidden sm:inline">
            Lead Time:
          </span>
          {['24h', '48h', '72h', '120h'].map((range) => (
            <button
              key={range}
              onClick={() => setLeadTime(range)}
              className={`
                px-2.5 py-1 text-scale-xs font-semibold rounded-[var(--radius-sm)] transition-colors cursor-pointer
                ${
                  selectedLeadTime === range
                    ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)] shadow-xs font-bold'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }
              `}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-scale-xs text-[var(--color-text-tertiary)]">{label}:</span>
      <span
        className="font-data text-scale-sm font-bold tabular-nums"
        style={{ color: color || 'var(--color-text-primary)' }}
      >
        {value}
      </span>
    </div>
  );
}
