import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useStore } from '../store/useStore';
import { VARIABLES, MODELS, regimeName } from '../data/referenceData.js';
import {
  entryAtLead,
  leadToHours,
  getForecast,
  getWeights,
  getSkill,
} from '../services/api';
import { useApi } from '../services/useApi';
import ChartCard from '../components/shared/ChartCard';
import { LoadingState, ErrorState, EmptyState } from '../components/shared/StatusStates';
import { DataModeBadge, ValidatedBadge, ScopeBadge } from '../components/shared/Badges';

const SEASON_ORDER = ['winter', 'pre_monsoon', 'monsoon', 'post_monsoon'];
const ADAPTIVE_SYSTEM = 'varuna_adaptive';
const SINGLE_SYSTEMS = ['ecmwf_ifs', 'ecmwf_aifs', 'cep_gfs', 'dwd_icon'];

const SYSTEM_STYLE = {
  ecmwf_ifs: { name: 'ECMWF IFS', color: '#2563EB' },
  ecmwf_aifs: { name: 'ECMWF AIFS', color: '#8B5CF6' },
  cep_gfs: { name: 'NOAA GFS', color: '#059669' },
  dwd_icon: { name: 'DWD ICON', color: '#0891B2' },
  equal_blend: { name: 'Equal Blend', color: '#94A3B8' },
  static_inverse_rmse_blend: { name: 'Static Inverse-RMSE', color: '#64748B' },
  varuna_adaptive: { name: 'VARUNA Adaptive', color: '#D97706' },
};

export default function Models() {
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
  const weightsQ = useApi(
    () => getWeights({ region: selectedRegionId, variable: selectedVariable, leadTimeHours: leadHours }),
    [selectedRegionId, selectedVariable, leadHours]
  );
  const skillQ = useApi(() => getSkill(), []);

  const forecast = forecastQ.data;
  const weights = weightsQ.data;
  const skill = skillQ.data;
  const entry = forecast ? entryAtLead(forecast.timeline, leadHours) : null;
  const unit = forecast?.unit || weights?.unit || variableMeta.unit;

  const skillRows = skill?.available && skill.headline?.rows ? skill.headline.rows : [];
  const skillBySystem = Object.fromEntries(skillRows.map((r) => [r.system, r]));

  const members = MODELS.filter((m) => m.id !== 'blend');
  const tableData = members.map((m) => {
    const skillRow = skillBySystem[m.key];
    return {
      ...m,
      forecastVal: entry?.models?.[m.key] ?? null,
      weight: entry?.weights?.[m.key] ?? null,
      predictedError: weights?.predicted_errors?.[m.key] ?? null,
      rmse: skillRow?.rmse ?? null,
      mae: skillRow?.mae ?? null,
      bias: skillRow?.bias ?? null,
      correlation: skillRow?.pearson_r ?? null,
      isBlend: false,
    };
  });
  const blendSkill = skillBySystem[ADAPTIVE_SYSTEM];
  tableData.push({
    id: 'blend',
    name: 'VARUNA BLEND',
    type: 'Adaptive Hybrid AI-NWP Engine',
    openMeteoId: null,
    color: '#D97706',
    forecastVal: entry?.blend ?? null,
    weight: 100,
    predictedError: null,
    rmse: blendSkill?.rmse ?? null,
    mae: blendSkill?.mae ?? null,
    bias: blendSkill?.bias ?? null,
    correlation: blendSkill?.pearson_r ?? null,
    isBlend: true,
  });

  // Real per-season skill table -> grouped bar chart
  const seasonData = (skill?.available && skill.by_season?.rows ? skill.by_season.rows : [])
    .filter((r) => SEASON_ORDER.includes(r.season))
    .reduce((acc, r) => {
      let row = acc.find((x) => x.season === r.season);
      if (!row) {
        row = { season: r.season };
        acc.push(row);
      }
      row[r.system] = r.rmse;
      return acc;
    }, [])
    .sort((a, b) => SEASON_ORDER.indexOf(a.season) - SEASON_ORDER.indexOf(b.season));

  const anyLoading = forecastQ.loading || weightsQ.loading || skillQ.loading;
  const forecastError = forecastQ.error;
  const heldOutN = blendSkill?.n ?? skillRows[0]?.n ?? null;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-scale-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
              Multi-Model Evaluation &amp; Ensembles
            </h1>
            <DataModeBadge mode={forecast?.data_mode || weights?.data_mode} />
          </div>
          <p className="mt-1 text-scale-sm text-[var(--color-text-secondary)]">
            Live member forecasts and weights for the selected zone; skill metrics from the held-out benchmark
            (temperature, ERA5 reference)
          </p>
        </div>

        {/* Global Selectors */}
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

      {/* Target Zone Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[var(--color-border)]">
        <span className="text-scale-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] shrink-0">
          Evaluated Zone:
        </span>
        {regions.map((r) => {
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

      {anyLoading && <LoadingState label="Loading model table, weights and skill…" />}
      {forecastError && <ErrorState error={forecastError} onRetry={forecastQ.reload} label="Model data unavailable" />}
      {!anyLoading && !forecastError && !forecast && (
        <EmptyState title="No model data" message="The backend returned no forecast for this selection." />
      )}

      {!anyLoading && !forecastError && forecast && (
        <>
          {/* Dense Model Comparison Table */}
          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs overflow-hidden transition-colors">
            <div className="p-4 md:p-5 border-b border-[var(--color-border)] flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-scale-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                  Operational Model Benchmark Matrix
                </h2>
                <p className="text-scale-xs text-[var(--color-text-secondary)] mt-0.5">
                  Target: <strong className="text-[var(--color-text-primary)]">{region?.name}</strong> • Variable:{' '}
                  <strong className="text-[var(--color-text-primary)]">{variableMeta.label}</strong> ({unit}) • Lead:{' '}
                  <strong className="text-[var(--color-text-primary)]">{selectedLeadTime}</strong> • Regime:{' '}
                  <strong className="text-[var(--color-text-primary)]">
                    {regimeName(entry?.regime_index) || weights?.regime?.name || '—'}
                  </strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ScopeBadge scope={skill?.headline?.scope} />
                <ValidatedBadge validated={!!weights?.validated} />
                <span className="font-data text-scale-xs bg-[var(--color-surface)] border border-[var(--color-border)] px-2.5 py-1 rounded-md text-[var(--color-text-secondary)] font-semibold">
                  N = {heldOutN != null ? heldOutN.toLocaleString() : '—'} held-out pairs
                </span>
              </div>
            </div>

            {weightsQ.error && (
              <div className="px-4 py-2 text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200">
                Weights unavailable: {weightsQ.error.message}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-scale-xs">
                <thead className="bg-[var(--color-surface)] border-b border-[var(--color-border)] text-[var(--color-text-tertiary)] font-bold text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Model &amp; Architecture</th>
                    <th className="py-3 px-3">Open-Meteo Model</th>
                    <th className="py-3 px-3 text-right">Forecast ({unit})</th>
                    <th className="py-3 px-3 text-right">Ê Predicted Error</th>
                    <th className="py-3 px-3 text-right">RMSE ({unit})</th>
                    <th className="py-3 px-3 text-right">MAE ({unit})</th>
                    <th className="py-3 px-3 text-right">Bias ({unit})</th>
                    <th className="py-3 px-3 text-right">Correlation (r)</th>
                    <th className="py-3 px-4 text-right">Dynamic Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)] font-data">
                  {tableData.map((row) => (
                    <tr
                      key={row.id}
                      className={`transition-colors hover:bg-[var(--color-surface)] ${
                        row.isBlend ? 'bg-[var(--color-accent-subtle)] font-semibold' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-[var(--color-text-primary)]">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                          <span>{row.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] font-normal">
                            {row.type}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[var(--color-text-secondary)] font-medium">
                        {row.openMeteoId || 'blend (backend)'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-[var(--color-text-primary)] text-scale-sm">
                        {row.forecastVal ?? '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500">
                        {row.predictedError ?? '—'}
                      </td>
                      <td className={`py-3 px-3 text-right font-bold ${row.isBlend ? 'text-emerald-700' : 'text-slate-600'}`}>
                        {row.rmse ?? '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500">{row.mae ?? '—'}</td>
                      <td className="py-3 px-3 text-right text-slate-500">
                        {row.bias == null ? '—' : row.bias > 0 ? `+${row.bias}` : row.bias}
                      </td>
                      <td className={`py-3 px-3 text-right font-bold ${row.isBlend ? 'text-emerald-700' : 'text-slate-600'}`}>
                        {row.correlation ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className="px-2 py-0.5 rounded font-bold text-[11px]"
                          style={{
                            backgroundColor: row.isBlend ? '#F5C518' : 'rgba(0,0,0,0.06)',
                            color: row.isBlend ? '#1A1A17' : row.color,
                          }}
                        >
                          {row.weight == null ? '—' : `${row.weight}%`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-2.5 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-tertiary)]">
              Forecast, Ê and Weight columns are live for {region?.name} ({forecast.data_mode}). RMSE / MAE / Bias / r
              are held-out test skill for temperature only — skill tables are scoped{' '}
              <span className="font-data">{skill?.headline?.scope || 'held_out_test'}</span>, covering the last
              chronological season (Post-Monsoon).
            </div>
          </div>

          {/* Skill by season chart */}
          <ChartCard
            title="Model Skill by Season (RMSE vs ERA5 reanalysis)"
            subtitle="Lower is better · full-dataset splits (train + validation + test), temperature only"
            badge="Full dataset"
            span="full"
          >
            {seasonData.length === 0 ? (
              <EmptyState title="Skill tables unavailable" message="Run scripts/run_pipeline.py in varuna-backend to build the verification reports." />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={seasonData} margin={{ top: 16, right: 24, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                  <XAxis
                    dataKey="season"
                    tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)', fontFamily: "'Inter', sans-serif" }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border)' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    unit=" °C"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-panel)',
                      borderColor: 'var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  {Object.entries(SYSTEM_STYLE)
                    .filter(([key]) => SINGLE_SYSTEMS.includes(key) || key === ADAPTIVE_SYSTEM)
                    .map(([key, s]) => (
                      <Bar key={key} dataKey={key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} />
                    ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </>
      )}
    </div>
  );
}
