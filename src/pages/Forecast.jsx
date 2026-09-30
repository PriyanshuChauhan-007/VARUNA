import { useState, useEffect, useMemo } from 'react';
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
import { fetchForecast } from '../services/api';

const AVAILABLE_HORIZONS = ['24h', '48h', '72h', '120h', '7d', '30d'];

export default function Forecast() {
  const selectedRegionId = useStore((s) => s.selectedRegionId);
  const selectRegion = useStore((s) => s.selectRegion);
  const selectedVariable = useStore((s) => s.selectedVariable);
  const setVariable = useStore((s) => s.setVariable);
  const selectedLeadTime = useStore((s) => s.selectedLeadTime);
  const setLeadTime = useStore((s) => s.setLeadTime);
  const effectiveMode = useStore((s) => s.effectiveMode);

  // Initialize with deterministic fallback so UI has zero blank flash
  const fallbackBaseline = useMemo(() => {
    return getDeterministicForecast(selectedRegionId, selectedVariable, selectedLeadTime);
  }, [selectedRegionId, selectedVariable, selectedLeadTime]);

  const [forecast, setForecast] = useState(effectiveMode === 'DEMO' ? fallbackBaseline : null);
  const [loading, setLoading] = useState(effectiveMode !== 'DEMO');
  const [isLive, setIsLive] = useState(false);
  const [isFallback, setIsFallback] = useState(effectiveMode === 'DEMO');
  const [fallbackReason, setFallbackReason] = useState(effectiveMode === 'DEMO' ? 'User-selected DEMO mode active' : null);

  // Authoritative live data fetch from Python FastAPI backend (/api/forecast)
  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;

      // If explicit DEMO mode requested by user
      if (effectiveMode === 'DEMO') {
        const demoData = getDeterministicForecast(selectedRegionId, selectedVariable, selectedLeadTime, 'DEMO');
        setForecast(demoData);
        setIsLive(false);
        setIsFallback(true);
        setFallbackReason('User-selected DEMO mode active');
        setLoading(false);
        return;
      }

      setLoading(true);
      fetchForecast({
        region: selectedRegionId,
        variable: selectedVariable,
        leadTime: selectedLeadTime,
        mode: effectiveMode === 'REPLAY' ? 'REPLAY' : 'LIVE',
      })
        .then((data) => {
          if (!cancelled) {
            setForecast(data);
            setIsLive(true);
            setIsFallback(false);
            setFallbackReason(null);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            // Explicit fallback on network or backend API failure (Phase 9)
            const fallbackData = getDeterministicForecast(selectedRegionId, selectedVariable, selectedLeadTime, 'DEMO');
            setForecast(fallbackData);
            setIsLive(false);
            setIsFallback(true);
            setFallbackReason(`Backend offline: ${err.message || 'API unreachable'}. Displaying baseline fallback.`);
            setLoading(false);
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedRegionId, selectedVariable, selectedLeadTime, effectiveMode]);

  const displayForecast = forecast || fallbackBaseline;
  const {
    region = {},
    variable = {},
    models = {},
    timeseries = [],
    alertLevel = 'NOMINAL',
    alertReason = '',
    unit = '',
    whyThisBlend = {},
    horizonNote = null,
    weightingScheme = 'equal_fallback_untrained',
    weightingReason = null,
  } = displayForecast || {};

  const formattedLead = selectedLeadTime.startsWith('+') ? selectedLeadTime : `+${selectedLeadTime}`;

  // Compute ensemble spread across available member forecasts
  const memberValues = [
    models.ifs?.value,
    models.aifs?.value,
    models.gfs?.value,
    models.icon?.value,
  ].filter((v) => typeof v === 'number' && !isNaN(v));

  const ensembleSpread = memberValues.length > 1
    ? (Math.max(...memberValues) - Math.min(...memberValues)).toFixed(1)
    : '0.0';

  // Compute sum of weights and verify adaptive vs equal weighting
  const modelWeights = [
    models.ifs?.weight,
    models.aifs?.weight,
    models.gfs?.weight,
    models.icon?.weight,
  ].filter((w) => typeof w === 'number');

  const allWeightsEqual = modelWeights.length > 0 && modelWeights.every((w) => w === modelWeights[0]);
  const currentVariableId = variable.id || selectedVariable;
  const isAdaptive = currentVariableId === 'temperature' && weightingScheme === 'adaptive_xgboost' && !allWeightsEqual;

  const weightsSum = (
    (models.ifs?.weight || 0) +
    (models.aifs?.weight || 0) +
    (models.gfs?.weight || 0) +
    (models.icon?.weight || 0)
  );

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-scale-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Forecast Analysis &amp; Ensembles
          </h1>
          <p className="mt-1 text-scale-sm text-[var(--color-text-secondary)]">
            Multi-model NWP-AI blending (ECMWF IFS, ECMWF AIFS, NOAA GFS, DWD ICON) with{' '}
            {isAdaptive ? 'contextual error minimization' : 'operational equal-weight ensemble'}
          </p>
        </div>

        {/* Lead time / Horizon + Variable controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Horizon pills */}
          <div className="inline-flex items-center gap-1 bg-[var(--color-panel)] border border-[var(--color-border)] p-1 rounded-[var(--radius-lg)] shadow-xs">
            {AVAILABLE_HORIZONS.map((lt) => (
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

      {/* Explicit Data Mode & Status Banner (Phase 9) */}
      <div className={`p-3 rounded-[var(--radius-md)] border flex items-center justify-between text-scale-xs transition-colors ${
        isFallback
          ? 'bg-amber-500/10 border-amber-400 text-amber-800 dark:text-amber-200'
          : isLive
            ? 'bg-emerald-500/10 border-emerald-400 text-emerald-800 dark:text-emerald-200'
            : 'bg-blue-500/10 border-blue-400 text-blue-800 dark:text-blue-200'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${
            isFallback
              ? 'bg-amber-500'
              : isLive
                ? 'bg-emerald-500 animate-pulse'
                : 'bg-blue-500 animate-pulse'
          }`} />
          <span className="font-bold tracking-wide">
            {isFallback
              ? 'REPLAY / DEMO FALLBACK'
              : isLive
                ? 'LIVE OPERATIONAL STREAM'
                : 'CONNECTING TO LIVE BACKEND'}
          </span>
          <span className="hidden sm:inline text-[var(--color-text-secondary)]">
            {isFallback
              ? `— ${fallbackReason || 'Baseline fallback active; not live scientific output'}`
              : isLive
                ? '— Connected to Python FastAPI /api/forecast (ECMWF IFS, AIFS, NOAA GFS, DWD ICON via Open-Meteo Gateway)'
                : '— Handshaking with FastAPI /api/forecast gateway...'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="text-[11px] font-mono text-[var(--color-text-tertiary)] animate-pulse">
              Syncing...
            </span>
          )}
          <span className="font-data text-[11px] font-bold px-2 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)]">
            {isFallback ? 'FALLBACK' : isLive ? 'LIVE 200 OK' : 'CONNECTING'}
          </span>
        </div>
      </div>

      {/* Horizon Limitation Alert (Phase 7: e.g. 30-Day limit) */}
      {horizonNote && (
        <div className="p-3 bg-blue-500/10 border border-blue-400 text-blue-900 dark:text-blue-200 rounded-[var(--radius-md)] text-scale-xs flex items-start gap-2">
          <span className="font-bold text-blue-600 dark:text-blue-400 mt-0.5">ℹ</span>
          <div>
            <span className="font-bold block mb-0.5">Forecast Horizon Notice:</span>
            <p className="text-[11px] leading-relaxed">{horizonNote}</p>
          </div>
        </div>
      )}

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
        {/* Card 1: VARUNA Blend Forecast */}
        <div className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-xs">
          <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
            VARUNA Blend Forecast
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="font-data text-3xl font-bold text-amber-600">
              {models.blend?.value !== undefined ? Number(models.blend.value).toFixed(1) : '--'}
            </span>
            <span className="text-scale-sm font-semibold text-[var(--color-text-secondary)]">
              {unit}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
            {isAdaptive
              ? `Contextual Hybrid Blend (${formattedLead})`
              : `Operational Equal-Weight Blend (${formattedLead})`}
          </div>
        </div>

        {/* Card 2: Alert Status */}
        <div className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-xs">
          <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
            Alert Status
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getRiskColor(alertLevel) }} />
            <span className="font-data text-2xl font-bold text-[var(--color-text-primary)]">
              {alertLevel}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)] truncate">
            {alertReason || 'IMD Operational Threshold Monitoring'}
          </div>
        </div>

        {/* Card 3: Top Driving Model */}
        <div className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-xs">
          <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
            Top Driving Model
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            {isAdaptive ? (
              <>
                <span className="font-data text-2xl font-bold text-purple-600">
                  {whyThisBlend.topModel?.name || 'ECMWF IFS'}
                </span>
                <span className="text-scale-sm font-bold text-[var(--color-text-secondary)] font-data">
                  ({whyThisBlend.topModel?.pct || 25}%)
                </span>
              </>
            ) : (
              <>
                <span className="font-data text-xl md:text-2xl font-bold text-slate-700 dark:text-slate-200">
                  No dominant model
                </span>
                <span className="text-scale-xs font-semibold text-[var(--color-text-secondary)] font-data">
                  ({modelWeights[0] || 25}% each)
                </span>
              </>
            )}
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)] truncate">
            {isAdaptive
              ? (whyThisBlend.topModel?.error !== undefined
                  ? `Est. Contextual Error: ${whyThisBlend.topModel.error} ${unit}`
                  : `Contextual Error Minimization (${formattedLead})`)
              : 'Equal-weight fallback across available forecast members.'}
          </div>
        </div>

        {/* Card 4: Ensemble Spread / Agreement */}
        <div className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-xs">
          <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
            Ensemble Spread
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-data text-2xl font-bold text-emerald-600">
              {ensembleSpread}
            </span>
            <span className="text-scale-xs text-emerald-700 font-medium font-data ml-1">
              {unit} spread
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
            {memberValues.length} Canonical Members (IFS, AIFS, GFS, ICON)
          </div>
        </div>
      </div>

      {/* Main Multi-Model Diurnal Cycle & Horizon Chart */}
      <ChartCard
        title={`Forecast Evolution & Member Trajectories — ${region.name || 'Selected Region'} (${formattedLead})`}
        subtitle={`Synchronous progression of ECMWF IFS, ECMWF AIFS, NOAA GFS, DWD ICON, and VARUNA Blend for ${variable.label || 'Variable'} (${unit})`}
        badge={`Init: ${displayForecast.initializationTime ? displayForecast.initializationTime.slice(0, 10) : '2026-09-26'} 00z · Horizon: ${formattedLead}`}
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
              unit={` ${unit}`}
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
              labelFormatter={(label, items) => {
                const pt = items?.[0]?.payload;
                if (pt?.valid_time) {
                  return `Valid: ${pt.valid_time.replace('T', ' ').slice(0, 16)} UTC (+${pt.lead_time_hours}h lead)`;
                }
                return label;
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
            />
            <Line
              type="monotone"
              dataKey="IFS"
              name="ECMWF IFS (Physical NWP 9km)"
              stroke="#2563EB"
              strokeWidth={2}
              dot={{ r: 2.5, fill: '#2563EB' }}
            />
            <Line
              type="monotone"
              dataKey="AIFS"
              name="ECMWF AIFS (Deep Learning Transformer 28km)"
              stroke="#8B5CF6"
              strokeWidth={2}
              dot={{ r: 2.5, fill: '#8B5CF6' }}
            />
            <Line
              type="monotone"
              dataKey="GFS"
              name="NOAA GFS (Global FV3 13km)"
              stroke="#059669"
              strokeWidth={2}
              dot={{ r: 2.5, fill: '#059669' }}
            />
            <Line
              type="monotone"
              dataKey="ICON"
              name="DWD ICON (Non-Hydrostatic 13km)"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={{ r: 2.5, fill: '#F59E0B' }}
            />
            <Line
              type="monotone"
              dataKey="VARUNA"
              name="VARUNA BLEND (Contextual Hybrid)"
              stroke="#D97706"
              strokeWidth={3.5}
              dot={{ r: 3.5, fill: '#D97706' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Atmospheric Context & Consensus breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Regional Atmospheric Regime Profile */}
        <ChartCard
          title="Regional Atmospheric Regime Profile"
          subtitle="Climatological forcing parameters, synoptic classification, and local topography"
          badge={region.zone || 'Synoptic Zone'}
        >
          <div className="space-y-3.5 text-scale-xs">
            <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
              <span className="font-bold text-[var(--color-text-primary)] block mb-0.5">
                Active Weather Regime
              </span>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                {region.regime || 'Standard synoptic regime'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 font-data">
              <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                <span className="text-[var(--color-text-tertiary)] block text-[10px] uppercase font-bold">Coordinates</span>
                <span className="text-[var(--color-text-primary)] font-bold">
                  {region.lat !== undefined && region.lng !== undefined ? formatCoords(region.lat, region.lng) : '--'}
                </span>
              </div>
              <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                <span className="text-[var(--color-text-tertiary)] block text-[10px] uppercase font-bold">Terrain Elevation</span>
                <span className="text-[var(--color-text-primary)] font-bold">
                  {region.elevation ? (typeof region.elevation === 'string' && region.elevation.includes('m') ? region.elevation : `${region.elevation}m`) : '--'} MSL
                </span>
              </div>
            </div>
            <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)] flex items-center justify-between">
              <div>
                <span className="font-bold text-[var(--color-text-primary)] block">IMD AWS — Integration Pending</span>
                <span className="text-[var(--color-text-secondary)] text-[11px]">
                  No verified station observations connected ({region.stationsCount || 28} planned stations in zone mesh)
                </span>
              </div>
              <span className="font-data font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-2 py-1 rounded border border-amber-300 text-[10px]">
                Integration Pending
              </span>
            </div>
          </div>
        </ChartCard>

        {/* Multi-Model Consensus & Weight Contribution (Phase 6 & 10) */}
        <ChartCard
          title={
            isAdaptive
              ? 'Multi-Model Consensus & Adaptive Weight Contribution'
              : 'Multi-Model Consensus & Operational Equal-Weight Ensemble'
          }
          subtitle={
            isAdaptive
              ? 'Real-time contextual weights allocated by Python XGBoost meta-model based on synoptic conditions'
              : `Operational Equal-Weight Ensemble. ML weighting is not yet trained or validated for ${variable.label || selectedVariable}.`
          }
          badge={
            isFallback
              ? 'DEMO / FALLBACK'
              : isAdaptive
              ? `Total Weight: ${weightsSum}% (Hamilton-Hare Normalized)`
              : `Total Weight: ${weightsSum}% (Equal Allocation)`
          }
        >
          <div className="space-y-4 pt-1">
            {/* Model list: IFS, AIFS, GFS, ICON */}
            {[
              {
                id: 'ifs',
                shortName: 'IFS',
                name: 'ECMWF IFS',
                desc: 'High-Resolution Physical NWP (9km)',
                barBg: 'bg-blue-600',
                model: models.ifs,
              },
              {
                id: 'aifs',
                shortName: 'AIFS',
                name: 'ECMWF AIFS',
                desc: 'Deep Learning Spherical Transformer (28km)',
                barBg: 'bg-purple-600',
                model: models.aifs,
              },
              {
                id: 'gfs',
                shortName: 'GFS',
                name: 'NOAA GFS',
                desc: 'Operational Global NWP (FV3 Core, 13km)',
                barBg: 'bg-emerald-600',
                model: models.gfs,
              },
              {
                id: 'icon',
                shortName: 'ICON',
                name: 'DWD ICON',
                desc: 'Icosahedral Non-Hydrostatic NWP (13km)',
                barBg: 'bg-amber-500',
                model: models.icon,
              },
            ].map(({ id, name, desc, barBg, model }) => {
              if (!model) return null;
              const weightVal = model.weight ?? 0;
              const valueVal = model.value !== undefined ? Number(model.value).toFixed(1) : '--';
              return (
                <div key={id} className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                    <div>
                      <span className="font-bold text-[var(--color-text-primary)] text-scale-xs">
                        {name}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-tertiary)] block sm:inline sm:ml-2">
                        {desc}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-data text-scale-xs">
                      <span className="text-[var(--color-text-primary)] font-bold">
                        Forecast: {valueVal} {unit} <span className="text-[var(--color-text-tertiary)] font-normal">({formattedLead})</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[var(--color-surface-muted)] border border-[var(--color-border)] font-bold">
                        Weight: {weightVal}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-[var(--color-surface-muted)] rounded-full overflow-hidden border border-[var(--color-border)]">
                    <div
                      className={`h-full ${barBg} rounded-full transition-all`}
                      style={{ width: `${Math.min(100, Math.max(0, weightVal))}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Bottom summary */}
            <div className="p-3 bg-[var(--color-accent-subtle)] border border-amber-300 rounded-[var(--radius-md)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-scale-xs">
              <div>
                <span className="font-bold text-[var(--color-text-primary)] block">
                  VARUNA Final Blended Forecast
                </span>
                <span className="text-[11px] text-[var(--color-text-secondary)]">
                  {isAdaptive
                    ? 'Contextual synthesis: Σ (Weight × Forecast) / 100'
                    : 'Arithmetic ensemble mean: Σ (Forecast) / 4 (Equal weights)'}
                </span>
              </div>
              <div className="font-data font-bold text-amber-700 text-scale-base sm:text-scale-lg">
                {models.blend?.value !== undefined ? Number(models.blend.value).toFixed(1) : '--'} {unit} <span className="text-scale-xs text-[var(--color-text-tertiary)] font-normal">({formattedLead})</span>
              </div>
            </div>

            {/* Explanation box (Phase 10) */}
            <div className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-scale-xs">
              <span className="font-bold text-[var(--color-text-primary)] block mb-1">
                {isAdaptive ? 'Why this blend?' : 'Weighting Methodology'}
              </span>
              <p className="text-[var(--color-text-secondary)] text-[11px] leading-relaxed">
                {isAdaptive
                  ? (whyThisBlend.explanation ||
                    `${whyThisBlend.topModel?.name || 'Top model'} is allocated the highest weight because the XGBoost meta-model predicted the lowest contextual error for this region at ${formattedLead} lead.`)
                  : (weightingReason ||
                    whyThisBlend.explanation ||
                    'Equal-weight fallback across available forecast members. No meta-model trained for this variable yet; equal weights are used and skill is unvalidated.')}
              </p>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
