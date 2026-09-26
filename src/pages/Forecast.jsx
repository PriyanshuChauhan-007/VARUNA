import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useStore } from '../store/useStore';
import { REGIONS, VARIABLES, getDeterministicForecast } from '../data/mockData.js';
import { formatCoords, getRiskColor } from '../utils/formatters';
import ChartCard from '../components/shared/ChartCard';

export default function Forecast() {
  const selectedRegionId = useStore((s) => s.selectedRegionId);
  const selectRegion = useStore((s) => s.selectRegion);
  const selectedVariable = useStore((s) => s.selectedVariable);
  const setVariable = useStore((s) => s.setVariable);
  const selectedLeadTime = useStore((s) => s.selectedLeadTime);
  const setLeadTime = useStore((s) => s.setLeadTime);

  const forecast = getDeterministicForecast(selectedRegionId, selectedVariable, selectedLeadTime);
  const { region, variable, models, timeseries, alertLevel } = forecast;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-scale-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Forecast Analysis &amp; Ensembles
          </h1>
          <p className="mt-1 text-scale-sm text-[var(--color-text-secondary)]">
            Multi-model diurnal cycle synthesis, atmospheric regime tracking, and dynamic ensemble spread
          </p>
        </div>

        {/* Lead time + variable controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Lead time pill */}
          <div className="inline-flex items-center gap-1 bg-[var(--color-panel)] border border-[var(--color-border)] p-1 rounded-[var(--radius-lg)] shadow-xs">
            {['24h', '48h', '72h', '120h'].map((lt) => (
              <button
                key={lt}
                onClick={() => setLeadTime(lt)}
                className={`px-3 py-1 text-scale-xs font-semibold rounded-[var(--radius-md)] transition-all cursor-pointer ${
                  selectedLeadTime === lt
                    ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)] shadow-xs font-bold'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {lt.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Variable Switcher */}
          <div className="inline-flex items-center gap-1 bg-[var(--color-panel)] border border-[var(--color-border)] p-1 rounded-[var(--radius-lg)] shadow-xs">
            {VARIABLES.map((v) => (
              <button
                key={v.id}
                onClick={() => setVariable(v.id)}
                className={`px-3 py-1 text-scale-xs font-semibold rounded-[var(--radius-md)] transition-all cursor-pointer flex items-center gap-1 ${
                  selectedVariable === v.id
                    ? 'bg-slate-900 text-white font-bold'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                <span>{v.icon}</span>
                <span>{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Regional Selector Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[var(--color-border)]">
        <span className="text-scale-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] shrink-0">
          Target Zone:
        </span>
        {REGIONS.map((r) => {
          const isSelected = r.id === selectedRegionId;
          return (
            <button
              key={r.id}
              onClick={() => selectRegion(r.id)}
              className={`
                px-3 py-1 rounded-[var(--radius-md)] text-scale-xs font-medium shrink-0 transition-all cursor-pointer border
                ${
                  isSelected
                    ? 'bg-[var(--color-accent-subtle)] border-amber-400 text-[var(--color-text-primary)] font-bold shadow-xs'
                    : 'bg-[var(--color-panel)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                }
              `}
            >
              {r.name}
            </button>
          );
        })}
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-xs">
          <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
            VARUNA Blend Forecast
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="font-data text-3xl font-bold text-amber-600">
              {models.blend.value}
            </span>
            <span className="text-scale-sm font-semibold text-[var(--color-text-secondary)]">
              {forecast.unit}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
            Adaptive Hybrid Blend (XGBoost Meta-Model)
          </div>
        </div>

        <div className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-xs">
          <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
            Alert Status
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getRiskColor(alertLevel) }} />
            <span className="font-data text-2xl font-bold text-[var(--color-text-primary)]">
              {alertLevel}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)] truncate">
            {forecast.alertReason}
          </div>
        </div>

        <div className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-xs">
          <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
            Top Driving Model
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`font-data text-2xl font-bold ${
              forecast.whyThisBlend?.topModel?.key === 'ifs'
                ? 'text-blue-600'
                : forecast.whyThisBlend?.topModel?.key === 'gfs'
                ? 'text-emerald-600'
                : 'text-purple-600'
            }`}>
              {forecast.whyThisBlend?.topModel?.name || 'ECMWF AIFS'}
            </span>
            <span className="text-scale-sm font-bold text-[var(--color-text-secondary)] font-data">
              ({forecast.whyThisBlend?.topModel?.pct || models.aifs.weight}%)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
            Lowest RMSE: {forecast.whyThisBlend?.topModel?.rmse?.toFixed(2) || models.aifs.rmse} {forecast.unit}
          </div>
        </div>

        <div className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-xs">
          <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
            Verification Improvement
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-data text-2xl font-bold text-emerald-600">
              -{models.blend.rmseReductionPct}%
            </span>
            <span className="text-scale-xs text-emerald-700 font-medium font-data">
              vs Best Member
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
            N={models.blend.sampleCount.toLocaleString()} Reference Forecast Records
          </div>
        </div>
      </div>

      {/* Main Multi-Model Diurnal Cycle Chart (matching THERMOS Analytics) */}
      <ChartCard
        title={`24-Hour Diurnal Evolution — ${region.name} (${selectedLeadTime})`}
        subtitle={`Synchronous comparison of ECMWF IFS, AIFS, NOAA GFS, DWD ICON, and VARUNA Blend for ${variable.label} (${variable.unit})`}
        badge={`Init: ${forecast.initializationTime ? forecast.initializationTime.slice(0, 10) : '2026-09-26'} 00z · Valid: ${forecast.validTime.slice(0, 10)} ${forecast.validTime.slice(11, 16)} UTC (+${selectedLeadTime})`}
        span="full"
      >
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={timeseries} margin={{ top: 16, right: 24, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              unit={` ${forecast.unit}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-panel)',
                borderColor: 'var(--color-border)',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
            />
            <Line
              type="monotone"
              dataKey="IFS"
              name="ECMWF IFS (Physical NWP)"
              stroke="#2563EB"
              strokeWidth={2}
              dot={{ r: 3, fill: '#2563EB' }}
            />
            <Line
              type="monotone"
              dataKey="AIFS"
              name="ECMWF AIFS (Deep Learning)"
              stroke="#8B5CF6"
              strokeWidth={2}
              dot={{ r: 3, fill: '#8B5CF6' }}
            />
            <Line
              type="monotone"
              dataKey="GFS"
              name="NOAA GFS (FV3 Global)"
              stroke="#059669"
              strokeWidth={2}
              dot={{ r: 3, fill: '#059669' }}
            />
            <Line
              type="monotone"
              dataKey="ICON"
              name="DWD ICON (13km NWP)"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={{ r: 3, fill: '#F59E0B' }}
            />
            <Line
              type="monotone"
              dataKey="VARUNA"
              name="VARUNA BLEND (Adaptive Hybrid)"
              stroke="#D97706"
              strokeWidth={3.5}
              dot={{ r: 4, fill: '#D97706' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Atmospheric Context & Ensemble Spread Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Regional Atmospheric Regime Profile"
          subtitle="Climatological forcing parameters and local topography"
          badge={region.zone}
        >
          <div className="space-y-3.5 text-scale-xs">
            <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
              <span className="font-bold text-[var(--color-text-primary)] block mb-0.5">
                Active Weather Regime
              </span>
              <p className="text-[var(--color-text-secondary)]">{region.regime}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 font-data">
              <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                <span className="text-[var(--color-text-tertiary)] block text-[10px] uppercase font-bold">Coordinates</span>
                <span className="text-[var(--color-text-primary)] font-bold">{formatCoords(region.lat, region.lng)}</span>
              </div>
              <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                <span className="text-[var(--color-text-tertiary)] block text-[10px] uppercase font-bold">Terrain Elevation</span>
                <span className="text-[var(--color-text-primary)] font-bold">{region.elevation} MSL</span>
              </div>
            </div>
            <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)] flex items-center justify-between">
              <div>
                <span className="font-bold text-[var(--color-text-primary)] block">IMD AWS — Integration Pending</span>
                <span className="text-[var(--color-text-secondary)] text-[11px]">No verified station observations connected ({region.stationsCount} planned stations)</span>
              </div>
              <span className="font-data font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-2 py-1 rounded border border-amber-300 text-[10px]">
                Integration Pending
              </span>
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Multi-Model Consensus & Weight Contribution"
          subtitle="Relative adaptive weights allocated via XGBoost reliability meta-model"
          badge="XGBoost Kernel"
        >
          <div className="space-y-4 pt-1">
            {/* AIFS */}
            <div>
              <div className="flex justify-between text-scale-xs mb-1 font-semibold">
                <span className="text-purple-600 font-data">ECMWF AIFS — Deep Learning Transformer</span>
                <span className="font-data">{models.aifs.value} {forecast.unit} ({models.aifs.weight}%)</span>
              </div>
              <div className="w-full h-3 bg-[var(--color-surface-muted)] rounded-full overflow-hidden border border-[var(--color-border)]">
                <div className="h-full bg-purple-600 rounded-full transition-all" style={{ width: `${models.aifs.weight}%` }} />
              </div>
            </div>

            {/* GFS */}
            <div>
              <div className="flex justify-between text-scale-xs mb-1 font-semibold">
                <span className="text-emerald-600 font-data">NOAA GFS — Global NWP (FV3)</span>
                <span className="font-data">{models.gfs.value} {forecast.unit} ({models.gfs.weight}%)</span>
              </div>
              <div className="w-full h-3 bg-[var(--color-surface-muted)] rounded-full overflow-hidden border border-[var(--color-border)]">
                <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${models.gfs.weight}%` }} />
              </div>
            </div>

            {/* IFS */}
            <div>
              <div className="flex justify-between text-scale-xs mb-1 font-semibold">
                <span className="text-blue-600 font-data">ECMWF IFS — High-Resolution Physical NWP</span>
                <span className="font-data">{models.ifs.value} {forecast.unit} ({models.ifs.weight}%)</span>
              </div>
              <div className="w-full h-3 bg-[var(--color-surface-muted)] rounded-full overflow-hidden border border-[var(--color-border)]">
                <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${models.ifs.weight}%` }} />
              </div>
            </div>

            {/* ICON */}
            {models.icon && (
              <div>
                <div className="flex justify-between text-scale-xs mb-1 font-semibold">
                  <span className="text-amber-500 font-data">DWD ICON — Global NWP (13km)</span>
                  <span className="font-data">{models.icon.value} {forecast.unit} ({models.icon.weight}%)</span>
                </div>
                <div className="w-full h-3 bg-[var(--color-surface-muted)] rounded-full overflow-hidden border border-[var(--color-border)]">
                  <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${models.icon.weight}%` }} />
                </div>
              </div>
            )}

            {/* Bottom summary */}
            <div className="p-3 bg-[var(--color-accent-subtle)] border border-amber-300 rounded-[var(--radius-md)] flex items-center justify-between text-scale-xs">
              <span className="font-bold text-[var(--color-text-primary)]">VARUNA Weighted Consensus</span>
              <span className="font-data font-bold text-amber-700 text-scale-sm">{models.blend.value} {forecast.unit}</span>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
