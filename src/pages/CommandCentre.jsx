import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { RISK_TIERS } from '../data/mockData.js';
import { getRiskColor } from '../utils/formatters';
import MapView from '../components/map/MapView';

export default function CommandCentre() {
  const selectedLeadTime = useStore((s) => s.selectedLeadTime);
  const setLeadTime = useStore((s) => s.setLeadTime);
  const selectRegion = useStore((s) => s.selectRegion);
  const selectedRegionId = useStore((s) => s.selectedRegionId);
  const getRegionalForecasts = useStore((s) => s.getRegionalForecasts);
  const effectiveMode = useStore((s) => s.effectiveMode);

  const [mobileView, setMobileView] = useState('map'); // 'map' | 'priority'
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'SEVERE' | 'RAINFALL' | 'HEAT' | 'COASTAL'
  const [sortBy, setSortBy] = useState('ALERT'); // 'ALERT' | 'FORECAST' | 'NAME'

  const regionalList = getRegionalForecasts();

  const filteredRegions = useMemo(() => {
    let list = [...regionalList];
    if (filterTab === 'SEVERE') {
      list = list.filter((r) => r.forecast.alertLevel === 'Critical' || r.forecast.alertLevel === 'High');
    } else if (filterTab === 'RAINFALL') {
      list = list.filter((r) => r.regime.toLowerCase().includes('monsoon') || r.regime.toLowerCase().includes('convective') || r.regime.toLowerCase().includes('precipitation'));
    } else if (filterTab === 'HEAT') {
      list = list.filter((r) => r.zone.toLowerCase().includes('arid') || r.zone.toLowerCase().includes('plateau') || r.regime.toLowerCase().includes('thermal'));
    } else if (filterTab === 'COASTAL') {
      list = list.filter((r) => r.name.toLowerCase().includes('coast') || r.zone.toLowerCase().includes('maritime') || r.zone.toLowerCase().includes('littoral'));
    }

    if (sortBy === 'FORECAST') {
      list.sort((a, b) => b.forecast.forecastValue - a.forecast.forecastValue);
    } else if (sortBy === 'NAME') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      const order = { Critical: 4, High: 3, Moderate: 2, Low: 1 };
      list.sort((a, b) => (order[b.forecast.alertLevel] || 0) - (order[a.forecast.alertLevel] || 0));
    }

    return list;
  }, [regionalList, filterTab, sortBy]);

  const stats = useMemo(() => {
    const total = regionalList.length;
    const critical = regionalList.filter((r) => r.forecast.alertLevel === 'Critical').length;
    const high = regionalList.filter((r) => r.forecast.alertLevel === 'High').length;
    const moderate = regionalList.filter((r) => r.forecast.alertLevel === 'Moderate').length;
    const avgAifs = total > 0 ? Math.round(regionalList.reduce((acc, r) => acc + r.forecast.models.aifs.weight, 0) / total) : 45;
    const avgIfs = total > 0 ? Math.round(regionalList.reduce((acc, r) => acc + r.forecast.models.ifs.weight, 0) / total) : 30;
    const avgGfs = total > 0 ? Math.round(regionalList.reduce((acc, r) => acc + r.forecast.models.gfs.weight, 0) / total) : 25;
    const top = avgAifs >= avgIfs && avgAifs >= avgGfs
      ? `AIFS (${avgAifs}%)`
      : avgGfs >= avgIfs
      ? `GFS (${avgGfs}%)`
      : `IFS (${avgIfs}%)`;
    const avgReduction = total > 0
      ? (regionalList.reduce((acc, r) => acc + (r.forecast.models.blend.rmseReductionPct || 0), 0) / total).toFixed(1)
      : '24.8';
    return {
      total,
      critical,
      high,
      moderate,
      topModel: top,
      avgReduction: `-${avgReduction}%`,
    };
  }, [regionalList]);

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
          {stats.total} Zones
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
              <h2 className="text-scale-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                Operational Watchlist
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  effectiveMode === 'LIVE'
                    ? 'bg-emerald-500 animate-pulse'
                    : effectiveMode === 'REPLAY'
                    ? 'bg-blue-500'
                    : 'bg-amber-500'
                }`} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  {effectiveMode === 'LIVE'
                    ? 'VARUNA Live Blend'
                    : effectiveMode === 'REPLAY'
                    ? 'VARUNA Replay Blend'
                    : 'VARUNA Blend (Demo Mode)'}
                </span>
              </div>
            </div>
            <span className="font-data text-scale-xs text-[var(--color-text-tertiary)] tabular-nums">
              {filteredRegions.length} of {stats.total}
            </span>
          </div>

          {/* Category Filter Pills (matching THERMOS) */}
          <div className="px-3 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)] flex items-center gap-1 overflow-x-auto text-[11px] font-semibold">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'SEVERE', label: 'Severe' },
              { id: 'RAINFALL', label: 'Monsoon' },
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
            {filteredRegions.length === 0 && (
              <div className="p-6 text-center text-scale-xs text-[var(--color-text-tertiary)]">
                No regions match the selected filter.
              </div>
            )}
            {filteredRegions.map((region) => {
              const f = region.forecast;
              const isSelected = selectedRegionId === region.id;
              const color = getRiskColor(f.alertLevel);

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
                      {f.forecastValue} {f.unit}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-scale-xs font-semibold text-[var(--color-text-primary)] truncate max-w-[130px]">
                      {f.alertLevel} Alert
                    </span>
                    <span className="text-[var(--color-text-tertiary)]">·</span>
                    <span className="text-[11px] text-[var(--color-text-secondary)] truncate flex-1">
                      {region.zone}
                    </span>
                  </div>

                  <div className="text-scale-xs text-[var(--color-text-secondary)] flex items-center justify-between">
                    <span className="truncate max-w-[210px] text-[11px] font-medium text-amber-700 dark:text-amber-400">
                      ⚡ AIFS ({f.models.aifs.weight}%) · GFS ({f.models.gfs.weight}%) · IFS ({f.models.ifs.weight}%)
                    </span>
                    <span className="font-data font-semibold text-[10px] text-slate-500 shrink-0">
                      RMSE {f.models.blend.rmse}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom strip: stats + lead time selector (matching THERMOS exactly) */}
      <div className="min-h-[48px] py-2 border-t border-[var(--color-border)] bg-[var(--color-panel)] flex flex-wrap items-center justify-between px-4 gap-3 shrink-0 overflow-x-auto transition-colors">
        <div className="flex items-center gap-4 sm:gap-6 flex-nowrap overflow-x-auto">
          <StatChip label="Active Regions" value={stats.total} />
          <StatChip label="Cycle Run" value="00z UTC" />
          <StatChip label="Critical Alert" value={stats.critical} color={RISK_TIERS.Critical} />
          <StatChip label="High Alert" value={stats.high} color={RISK_TIERS.High} />
          <StatChip label="Top Weight Model" value={stats.topModel} color="#8B5CF6" />
          <StatChip label="Mean Error Reduction" value={stats.avgReduction} color="#16A34A" />
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
