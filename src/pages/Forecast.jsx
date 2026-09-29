import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { useStore } from '../store/useStore';
import { VARIABLES, MODELS, regimeName } from '../data/referenceData.js';
import { entryAtLead, leadToHours, getForecast, getExtremes, getSkill, alertTier } from '../services/api';
import { useApi } from '../services/useApi';
import { formatCoords, getRiskColor } from '../utils/formatters';
import ChartCard from '../components/shared/ChartCard';
import { LoadingState, ErrorState, EmptyState } from '../components/shared/StatusStates';
import { DataModeBadge, ValidatedBadge, ScopeBadge } from '../components/shared/Badges';

const MEMBERS = MODELS.filter((m) => m.id !== 'blend');

export default function Forecast() {
  const selectedRegionId = useStore((s) => s.selectedRegionId);
  const selectRegion = useStore((s) => s.selectRegion);
  const regions = useStore((s) => s.regions);
  const selectedVariable = useStore((s) => s.selectedVariable);
  const setVariable = useStore((s) => s.setVariable);
  const selectedLeadTime = useStore((s) => s.selectedLeadTime);
  const setLeadTime = useStore((s) => s.setLeadTime);

  const leadHours = leadToHours(selectedLeadTime);
  const variableMeta = VARIABLES.find((v) => v.id === selectedVariable) || VARIABLES[0];
  const region = regions.find((r) => r.id === selectedRegionId) || regions[0];

  const forecastQ = useApi(
    () => getForecast({ region: selectedRegionId, variable: selectedVariable, leadTimeHours: leadHours }),
    [selectedRegionId, selectedVariable, leadHours]
  );
  const extremesQ = useApi(
    () => getExtremes({ region: selectedRegionId, leadTimeHours: leadHours }),
    [selectedRegionId, leadHours]
  );
  const skillQ = useApi(() => getSkill(), []);

  const forecast = forecastQ.data;
  const entry = forecast ? entryAtLead(forecast.timeline, leadHours) : null;
  const extremes = extremesQ.data;
  const skill = skillQ.data;

  const unit = forecast?.unit || variableMeta.unit;
  const memberRows = entry
    ? MEMBERS.map((m) => ({
        ...m,
        value: entry.models?.[m.key] ?? null,
        weight: entry.weights?.[m.key] ?? null,
      }))
    : [];
  const topMember = memberRows
    .filter((m) => m.weight !== null)
    .sort((a, b) => b.weight - a.weight)[0] || null;

  // Chart series from the real hourly timeline
  const series = forecast
    ? forecast.timeline.map((e) => ({
        label: `${e.time.slice(5, 10)} ${e.time.slice(11, 16)}`,
        lead: e.lead_time_hours,
        blend: e.blend,
        ifs: e.models?.ecmwf_ifs ?? null,
        aifs: e.models?.ecmwf_aifs ?? null,
        gfs: e.models?.cep_gfs ?? null,
        icon: e.models?.dwd_icon ?? null,
      }))
    : [];
  const leadLabel = entry ? `${entry.time.slice(5, 10)} ${entry.time.slice(11, 16)}` : null;

  const tierInfo = extremes ? alertTier(extremes.alerts) : null;

  // Held-out skill (temperature only): adaptive blend vs best single model
  const skillRows = skill?.available && skill.headline?.rows ? skill.headline.rows : [];
  const singles = ['ecmwf_ifs', 'ecmwf_aifs', 'cep_gfs', 'dwd_icon'];
  const bestSingle = skillRows
    .filter((r) => singles.includes(r.system))
    .sort((a, b) => a.rmse - b.rmse)[0] || null;
  const adaptiveRow = skillRows.find((r) => r.system === 'varuna_adaptive') || null;
  const skillImprovement =
    bestSingle && adaptiveRow ? (1 - adaptiveRow.rmse / bestSingle.rmse) * 100 : null;

  const isLoading = forecastQ.loading;
  const isError = !!forecastQ.error;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-scale-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
              Forecast Analysis &amp; Ensembles
            </h1>
            <DataModeBadge mode={forecast?.data_mode} />
          </div>
          <p className="mt-1 text-scale-sm text-[var(--color-text-secondary)]">
            Hourly multi-model timeline from the VARUNA blend · {forecast?.weighting_scheme || 'weighting pending'} ·
            verification reference: ERA5 reanalysis
          </p>
        </div>

        {/* Lead time + variable controls */}
        <div className="flex flex-wrap items-center gap-2">
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

          <div className="inline-flex items-center gap-1 bg-[var(--color-panel)] border border-[var(--color-border)] p-1 rounded-[var(--radius-lg)] shadow-xs">
            {VARIABLES.map((v) => (
              <button
                key={v.id}
                onClick={() => setVariable(v.id)}
                title={v.validated ? 'Validated variable' : 'Unvalidated variable (equal fallback weights)'}
                className={`px-3 py-1 text-scale-xs font-semibold rounded-[var(--radius-md)] transition-all cursor-pointer flex items-center gap-1 ${
                  selectedVariable === v.id
                    ? 'bg-slate-900 text-white font-bold'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                <span>{v.icon}</span>
                <span>{v.label}</span>
                {!v.validated && <span className="text-[9px] opacity-80">⚠</span>}
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
        {regions.map((r) => {
          const isSelected = r.id === selectedRegionId;
          return (
            <button
              key={r.id}
              onClick={() => selectRegion(r.id)}
              title={r.validated ? 'Benchmarked region (held-out skill exists)' : 'Live-only region (not benchmarked)'}
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
              {r.validated === true && <span className="ml-1 text-emerald-600">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Loading / error states */}
      {isLoading && <LoadingState label="Loading blended forecast from the VARUNA API…" />}
      {isError && <ErrorState error={forecastQ.error} onRetry={forecastQ.reload} label="Forecast unavailable" />}

      {!isLoading && !isError && !forecast && (
        <EmptyState title="No forecast returned" message="The backend returned an empty payload for this selection." />
      )}

      {!isLoading && !isError && forecast && (
        <>
          {/* Primary KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                  VARUNA Blend Forecast
                </span>
                <ValidatedBadge validated={!!forecast.validated} />
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="font-data text-3xl font-bold text-amber-600">
                  {entry?.blend ?? '—'}
                </span>
                <span className="text-scale-sm font-semibold text-[var(--color-text-secondary)]">{unit}</span>
              </div>
              <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                {forecast.weighting_scheme === 'adaptive_xgboost'
                  ? 'XGBoost meta-model weighting (1/Ê², Hamilton-Hare)'
                  : forecast.weighting_reason || forecast.weighting_scheme}
              </div>
            </div>

            <div className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-xs">
              <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Threshold Status (+{selectedLeadTime})
              </div>
              {extremesQ.loading ? (
                <div className="mt-2 text-[11px] text-[var(--color-text-secondary)]">Evaluating thresholds…</div>
              ) : extremesQ.error ? (
                <div className="mt-2 text-[11px] text-red-600">Threshold check unavailable</div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getRiskColor(tierInfo?.tier || 'Low') }}
                    />
                    <span className="font-data text-2xl font-bold text-[var(--color-text-primary)]">
                      {tierInfo?.tier || '—'}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                    {tierInfo?.label || 'No threshold crossing'}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-xs">
              <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Top Weighted Model
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-data text-2xl font-bold text-purple-600">
                  {topMember ? topMember.name : '—'}
                </span>
                {topMember && (
                  <span className="text-scale-sm font-bold text-[var(--color-text-secondary)] font-data">
                    ({topMember.weight}%)
                  </span>
                )}
              </div>
              <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                {entry ? `${entry.models_used} of 4 members available${entry.degraded ? ' · degraded' : ''}` : ''}
              </div>
            </div>

            <div className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                  Held-Out Skill
                </span>
                {skill?.headline?.scope && <ScopeBadge scope={skill.headline.scope} />}
              </div>
              {selectedVariable !== 'temperature' ? (
                <>
                  <div className="font-data text-2xl font-bold text-amber-600 mt-1">Unvalidated</div>
                  <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                    Skill is benchmarked for temperature only (Phase 4 pending)
                  </div>
                </>
              ) : skillImprovement !== null ? (
                <>
                  <div className="font-data text-2xl font-bold text-emerald-600 mt-1">
                    −{skillImprovement.toFixed(1)}%
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                    RMSE vs best single ({bestSingle.system}, {bestSingle.rmse} °C)
                  </div>
                </>
              ) : (
                <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                  {skill?.available === false ? 'Skill tables not built yet' : 'Loading skill tables…'}
                </div>
              )}
            </div>
          </div>

          {/* Horizon note */}
          {forecast.horizon_note && (
            <p className="text-[11px] text-[var(--color-text-tertiary)] font-data -mt-2">
              {forecast.horizon_note}
            </p>
          )}

          {/* Main timeline chart */}
          <ChartCard
            title={`Blended Forecast Timeline — ${region?.name || ''} (${selectedLeadTime} marker)`}
            subtitle={`Hourly ${variableMeta.label} (${unit}) for all four members and the VARUNA blend, +0 h to +168 h`}
            badge={`Issued ${forecast.issued_at?.slice(0, 16).replace('T', ' ')} UTC · ${forecast.data_mode}`}
            span="full"
          >
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={series} margin={{ top: 16, right: 24, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                <XAxis
                  dataKey="label"
                  interval="preserveStartEnd"
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
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                {leadLabel && (
                  <ReferenceLine
                    x={leadLabel}
                    stroke="#F5C518"
                    strokeDasharray="4 4"
                    label={{ value: `+${selectedLeadTime}`, position: 'insideTopRight', fontSize: 10 }}
                  />
                )}
                <Line type="monotone" dataKey="ifs" name="ECMWF IFS" stroke="#2563EB" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="aifs" name="ECMWF AIFS" stroke="#8B5CF6" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="gfs" name="NOAA GFS" stroke="#059669" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="icon" name="DWD ICON" stroke="#0891B2" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="blend" name="VARUNA BLEND" stroke="#D97706" strokeWidth={3.5} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Atmospheric Context & Weight Breakdown */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard
              title="Regional Context & Regime"
              subtitle="Coordinates, topography and the rule-based regime classification at the selected lead"
              badge={region?.zone}
            >
              <div className="space-y-3.5 text-scale-xs">
                <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                  <span className="font-bold text-[var(--color-text-primary)] block mb-0.5">
                    Active Weather Regime (classified from ensemble values)
                  </span>
                  <p className="text-[var(--color-text-secondary)]">
                    {regimeName(entry?.regime_index) || forecast.regime?.name || '—'}
                    {entry?.regime_index !== null && entry?.regime_index !== undefined && (
                      <span className="font-data ml-2 text-[var(--color-text-tertiary)]">index {entry.regime_index}</span>
                    )}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 font-data">
                  <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                    <span className="text-[var(--color-text-tertiary)] block text-[10px] uppercase font-bold">Coordinates</span>
                    <span className="text-[var(--color-text-primary)] font-bold">{formatCoords(region?.lat, region?.lng)}</span>
                  </div>
                  <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                    <span className="text-[var(--color-text-tertiary)] block text-[10px] uppercase font-bold">Terrain Elevation</span>
                    <span className="text-[var(--color-text-primary)] font-bold">{region?.elevation} MSL</span>
                  </div>
                </div>
                <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[var(--color-text-primary)] block">Benchmark Status</span>
                    <span className="text-[var(--color-text-secondary)] text-[11px]">
                      {region?.validated
                        ? 'Held-out skill measured for this region (temperature)'
                        : 'Live-only region · not one of the 6 benchmarked regions'}
                    </span>
                  </div>
                  <span
                    className={`font-bold px-2 py-1 rounded border text-[10px] font-data ${
                      region?.validated
                        ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300'
                        : 'text-amber-700 bg-amber-50 dark:bg-amber-950/60 border-amber-300'
                    }`}
                  >
                    {region?.validated ? 'Benchmarked' : 'Not Benchmarked'}
                  </span>
                </div>
              </div>
            </ChartCard>

            <ChartCard
              title="Multi-Model Consensus & Weight Contribution"
              subtitle="Weights ∝ 1/Ê² from the trained meta-model, apportioned as integer percents summing to 100"
              badge={forecast.weighting_scheme}
            >
              <div className="space-y-4 pt-1">
                {memberRows.map((m) => (
                  <div key={m.id}>
                    <div className="flex justify-between text-scale-xs mb-1 font-semibold">
                      <span className="font-data" style={{ color: m.color }}>
                        {m.name} — {m.type}
                      </span>
                      <span className="font-data">
                        {m.value ?? '—'} {unit} ({m.weight ?? '—'}%)
                      </span>
                    </div>
                    <div className="w-full h-3 bg-[var(--color-surface-muted)] rounded-full overflow-hidden border border-[var(--color-border)]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${m.weight || 0}%`, backgroundColor: m.color }}
                      />
                    </div>
                  </div>
                ))}

                <div className="p-3 bg-[var(--color-accent-subtle)] border border-amber-300 rounded-[var(--radius-md)] flex items-center justify-between text-scale-xs">
                  <span className="font-bold text-[var(--color-text-primary)]">VARUNA Weighted Consensus</span>
                  <span className="font-data font-bold text-amber-700 text-scale-sm">
                    {entry?.blend ?? '—'} {unit}
                  </span>
                </div>

                {forecast.degraded && (
                  <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-300 rounded-[var(--radius-md)] text-[11px] text-red-700 dark:text-red-300">
                    Degraded entry: fewer than 2 members returned data for some hours — nulls are dropped, never
                    replaced with 0.0.
                  </div>
                )}
              </div>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
