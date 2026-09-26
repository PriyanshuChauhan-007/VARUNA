import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { EXTREMES_DATA, REGIONS } from '../data/mockData.js';
import { getRiskColor } from '../utils/formatters';

export default function Extremes() {
  const selectRegion = useStore((s) => s.selectRegion);

  const HAZARD_CATEGORIES = useMemo(() => [
    {
      id: 'rainfall',
      label: '🌧️ 24h Acc. Rain (≥64.5 mm)',
      types: ['Heavy Rainfall', 'Intense Precipitation', 'Heavy Precipitation'],
    },
    {
      id: 'heatwave',
      label: '🌡️ Daily Max Temp (≥43°C)',
      types: ['Severe Heatwave', 'Extreme Heatwave'],
    },
    {
      id: 'wind',
      label: '💨 Squall Influx (≥55 km/h)',
      types: ['Coastal Squall Winds'],
    },
  ], []);

  const [selectedTiers, setSelectedTiers] = useState(['Critical', 'High', 'Moderate']);
  const [selectedCategories, setSelectedCategories] = useState(['rainfall', 'heatwave', 'wind']);
  const [minConfidence, setMinConfidence] = useState(85);

  const toggleTier = (tier) => {
    setSelectedTiers((curr) =>
      curr.includes(tier) ? curr.filter((t) => t !== tier) : [...curr, tier]
    );
  };

  const toggleCategory = (catId) => {
    setSelectedCategories((curr) =>
      curr.includes(catId) ? curr.filter((c) => c !== catId) : [...curr, catId]
    );
  };

  const filtered = useMemo(() => {
    const activeTypes = HAZARD_CATEGORIES
      .filter((c) => selectedCategories.includes(c.id))
      .flatMap((c) => c.types);

    return EXTREMES_DATA.filter((item) => {
      if (!selectedTiers.includes(item.tier)) return false;
      if (!activeTypes.includes(item.type)) return false;
      const conf = parseInt(item.confidence) || 0;
      if (conf < minConfidence) return false;
      return true;
    });
  }, [selectedTiers, selectedCategories, minConfidence, HAZARD_CATEGORIES]);

  const stats = useMemo(() => {
    return {
      total: EXTREMES_DATA.length,
      critical: EXTREMES_DATA.filter((e) => e.tier === 'Critical').length,
      high: EXTREMES_DATA.filter((e) => e.tier === 'High').length,
      active: EXTREMES_DATA.filter((e) => e.status === 'ACTIVE WATCH').length,
    };
  }, []);

  const handleInspect = (regionName) => {
    const reg = REGIONS.find((r) => regionName.toLowerCase().includes(r.name.toLowerCase().split(' (')[0]));
    if (reg) {
      selectRegion(reg.id);
    } else {
      selectRegion(REGIONS[0].id);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-[var(--color-surface)] overflow-hidden">
      {/* Filter Sidebar (280px matching THERMOS PriorityQueue) */}
      <aside className="w-full md:w-[280px] shrink-0 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-panel)] p-5 flex flex-col gap-6 transition-colors">
        <div className="flex items-center justify-between">
          <h2 className="text-scale-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
            Triage Filters
          </h2>
          <button
            onClick={() => {
              setSelectedTiers(['Critical', 'High', 'Moderate']);
              setSelectedCategories(['rainfall', 'heatwave', 'wind']);
              setMinConfidence(85);
            }}
            className="text-scale-xs font-semibold text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>

        {/* Severity Tiers */}
        <div>
          <label className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-2">
            Severity Tiers
          </label>
          <div className="space-y-1.5">
            {['Critical', 'High', 'Moderate'].map((tier) => {
              const active = selectedTiers.includes(tier);
              return (
                <button
                  key={tier}
                  onClick={() => toggleTier(tier)}
                  className={`w-full flex items-center justify-between p-2 rounded-[var(--radius-md)] text-scale-xs font-semibold transition-all cursor-pointer border ${
                    active
                      ? 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)]'
                      : 'border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getRiskColor(tier) }} />
                    <span>{tier}</span>
                  </div>
                  {active && <span className="text-[var(--color-accent)] font-bold">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hazard Types */}
        <div>
          <label className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-2">
            Meteorological Hazard
          </label>
          <div className="space-y-1.5">
            {HAZARD_CATEGORIES.map((hz) => {
              const active = selectedCategories.includes(hz.id);
              return (
                <button
                  key={hz.id}
                  onClick={() => toggleCategory(hz.id)}
                  className={`w-full text-left p-2 rounded-[var(--radius-md)] text-scale-xs font-semibold transition-all cursor-pointer border ${
                    active
                      ? 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)]'
                      : 'border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                >
                  {hz.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Confidence Filter */}
        <div>
          <div className="flex justify-between text-scale-xs mb-1">
            <span className="font-bold text-[var(--color-text-secondary)]">Min Blend Confidence:</span>
            <span className="font-data font-bold text-[var(--color-text-primary)]">{minConfidence}%</span>
          </div>
          <input
            type="range"
            min="70"
            max="95"
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>

        {/* Operational Disclaimer Note (Section 13 Rule) */}
        <div className="mt-auto p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
          <strong className="block text-[var(--color-text-primary)] mb-0.5">⚠️ Meteorological Advisory Criteria</strong>
          Threshold alerts reflect operational meteorological criteria based on IMD standard classifications (e.g. 24h accumulated rainfall ≥ 64.5 mm, daily max temperature ≥ 43°C, sustained squall winds ≥ 55 km/h).
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-scale-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
              Extreme Weather Surveillance
            </h1>
            <p className="mt-0.5 text-scale-sm text-[var(--color-text-secondary)]">
              Real-time threshold exceedance alerts across precipitation, thermal extremes, and wind squalls
            </p>
          </div>
          <span className="self-start sm:self-auto font-data text-scale-xs px-3 py-1 rounded-full bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-400 border border-red-300 font-bold">
            ● {stats.active} ACTIVE WATCHES
          </span>
        </div>

        {/* Summary Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
            <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Total Monitored</span>
            <span className="font-data text-2xl font-bold text-[var(--color-text-primary)] block mt-0.5">{stats.total} Events</span>
          </div>
          <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
            <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Critical Alerts</span>
            <span className="font-data text-2xl font-bold text-red-600 block mt-0.5">{stats.critical}</span>
          </div>
          <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
            <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">High Warnings</span>
            <span className="font-data text-2xl font-bold text-amber-600 block mt-0.5">{stats.high}</span>
          </div>
          <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
            <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Dominant Driver</span>
            <span className="font-data text-lg font-bold text-purple-600 block mt-0.5 truncate">ECMWF AIFS (ML)</span>
          </div>
        </div>

        {/* Extremes Incident Cards Grid */}
        <div className="space-y-4">
          {filtered.map((item) => {
            const color = getRiskColor(item.tier);
            return (
              <div
                key={item.id}
                className="p-5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs transition-all hover:border-amber-400/80"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <h3 className="text-scale-base font-bold text-[var(--color-text-primary)]">
                        {item.region}
                      </h3>
                      <span
                        className="px-2 py-0.5 text-[10px] font-bold rounded text-white font-data"
                        style={{ backgroundColor: color }}
                      >
                        {item.tier.toUpperCase()}
                      </span>
                      <span className="text-scale-xs px-2 py-0.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[var(--color-text-secondary)] font-semibold">
                        {item.type}
                      </span>
                    </div>
                    <div className="text-scale-xs text-[var(--color-text-secondary)] flex items-center gap-2">
                      <span>Lead Time: <strong className="text-[var(--color-text-primary)] font-data">{item.leadTime}</strong></span>
                      <span>•</span>
                      <span>Confidence: <strong className="text-[var(--color-text-primary)] font-data">{item.confidence}</strong></span>
                      <span>•</span>
                      <span>Driver: <strong className="text-purple-600 font-data">{item.driver}</strong></span>
                    </div>
                  </div>

                  {/* Value vs Threshold Callout */}
                  <div className="flex items-center gap-3 bg-[var(--color-surface)] p-2.5 px-3.5 rounded-[var(--radius-lg)] border border-[var(--color-border)] shrink-0">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-[var(--color-text-tertiary)]">
                        Forecast Exceedance
                      </div>
                      <div className="font-data text-xl font-bold text-[var(--color-text-primary)]">
                        {item.value}
                      </div>
                    </div>
                    <div className="w-px h-8 bg-[var(--color-border)]" />
                    <div>
                      <div className="text-[10px] font-bold uppercase text-[var(--color-text-tertiary)]">
                        IMD Advisory Standard
                      </div>
                      <div className="font-data text-xs font-semibold text-[var(--color-text-secondary)]">
                        {item.threshold}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Synoptic Context Explanation */}
                <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] text-scale-xs text-[var(--color-text-secondary)] leading-relaxed mb-3">
                  <span className="font-bold text-[var(--color-text-primary)] mr-1">Meteorological Context:</span>
                  {item.synopticContext}
                </div>

                {/* Footer Action */}
                <div className="flex items-center justify-between pt-1">
                  <span className="font-data text-[11px] font-bold text-amber-600 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {item.status}
                  </span>
                  <button
                    onClick={() => handleInspect(item.region)}
                    className="px-3 py-1.5 bg-[var(--color-surface)] hover:bg-[var(--color-accent-subtle)] border border-[var(--color-border)] hover:border-amber-400 rounded-[var(--radius-md)] text-scale-xs font-bold text-[var(--color-text-primary)] transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>Inspect Model Blend</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
