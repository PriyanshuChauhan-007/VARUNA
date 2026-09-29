import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useStore } from '../store/useStore';
import { getSkill } from '../services/api';
import { useApi } from '../services/useApi';
import ChartCard from '../components/shared/ChartCard';
import { LoadingState, ErrorState, EmptyState } from '../components/shared/StatusStates';
import { ScopeBadge } from '../components/shared/Badges';

const SINGLE_SYSTEMS = ['ecmwf_ifs', 'ecmwf_aifs', 'cep_gfs', 'dwd_icon'];
const ADAPTIVE = 'varuna_adaptive';

const SYSTEM_STYLE = {
  ecmwf_ifs: { name: 'ECMWF IFS', color: '#2563EB' },
  ecmwf_aifs: { name: 'ECMWF AIFS', color: '#8B5CF6' },
  cep_gfs: { name: 'NOAA GFS', color: '#059669' },
  dwd_icon: { name: 'DWD ICON', color: '#0891B2' },
  equal_blend: { name: 'Equal Blend', color: '#94A3B8' },
  static_inverse_rmse_blend: { name: 'Static Inverse-RMSE', color: '#64748B' },
  varuna_adaptive: { name: 'VARUNA Adaptive', color: '#D97706' },
};

/** Pivot [{key, system, rmse}] rows into [{key, <system>: rmse}] for recharts. */
function pivot(rows, keyField) {
  const map = new Map();
  rows.forEach((r) => {
    if (!map.has(r[keyField])) map.set(r[keyField], { [keyField]: r[keyField] });
    map.get(r[keyField])[r.system] = r.rmse;
  });
  return [...map.values()];
}

export default function Skill() {
  const selectedRegionId = useStore((s) => s.selectedRegionId);
  const skillQ = useApi(() => getSkill(), []);
  const skill = skillQ.data;

  const headline = skill?.available && skill.headline?.rows ? skill.headline.rows : [];
  const byLead = skill?.available && skill.by_lead?.rows ? skill.by_lead.rows : [];
  const bySeason = skill?.available && skill.by_season?.rows ? skill.by_season.rows : [];
  const byRegion = skill?.available && skill.by_region?.rows ? skill.by_region.rows : [];

  const adaptiveHeadline = headline.find((r) => r.system === ADAPTIVE) || null;
  const bestSingleHeadline =
    headline
      .filter((r) => SINGLE_SYSTEMS.includes(r.system))
      .sort((a, b) => a.rmse - b.rmse)[0] || null;
  const improvement =
    adaptiveHeadline && bestSingleHeadline
      ? (1 - adaptiveHeadline.rmse / bestSingleHeadline.rmse) * 100
      : null;

  const leadData = pivot(byLead, 'lead_time_hours').sort((a, b) => a.lead_time_hours - b.lead_time_hours);
  const seasonData = pivot(bySeason, 'season');
  const headlineBar = [...headline].sort((a, b) => a.rmse - b.rmse);

  // Per-region comparison: VARUNA adaptive vs the best single model there
  const regionRows = [...new Set(byRegion.map((r) => r.region_id))].map((regionId) => {
    const rows = byRegion.filter((r) => r.region_id === regionId);
    const adaptive = rows.find((r) => r.system === ADAPTIVE) || null;
    const best = rows.filter((r) => SINGLE_SYSTEMS.includes(r.system)).sort((a, b) => a.rmse - b.rmse)[0] || null;
    const gain = adaptive && best ? (1 - adaptive.rmse / best.rmse) * 100 : null;
    return { regionId, adaptive, best, gain, n: adaptive?.n ?? best?.n ?? null };
  });

  if (skillQ.loading) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-6 bg-[var(--color-surface)]">
        <LoadingState label="Loading verification reports…" />
      </div>
    );
  }
  if (skillQ.error) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-6 bg-[var(--color-surface)]">
        <ErrorState error={skillQ.error} onRetry={skillQ.reload} label="Skill reports unavailable" />
      </div>
    );
  }
  if (!skill || skill.available === false) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-6 bg-[var(--color-surface)]">
        <EmptyState
          title="Verification reports not built yet"
          message={skill?.message || 'Run: python scripts/run_pipeline.py inside varuna-backend to generate reports/.'}
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-scale-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
              Forecast Verification &amp; Model Skill
            </h1>
            <ScopeBadge scope={skill.headline?.scope} />
          </div>
          <p className="mt-1 text-scale-sm text-[var(--color-text-secondary)]">
            Verified against {skill.reference}
          </p>
          <p className="mt-0.5 text-scale-xs text-[var(--color-text-tertiary)]">{skill.caveat}</p>
        </div>

        <div className="inline-flex items-center gap-2 self-start lg:self-auto px-3 py-1.5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] text-scale-xs text-[var(--color-text-secondary)]">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Reports generated from {adaptiveHeadline?.n?.toLocaleString() || '—'} held-out pairs · temperature only
        </div>
      </div>

      {/* Metric Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
          <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Blend RMSE</span>
          <span className="font-data text-2xl font-bold text-amber-600 block mt-0.5">
            {adaptiveHeadline?.rmse ?? '—'} °C
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold font-data">
            {improvement != null ? `-${improvement.toFixed(1)}% vs best member` : '—'}
          </span>
        </div>
        <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
          <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Mean Abs Error (MAE)</span>
          <span className="font-data text-2xl font-bold text-[var(--color-text-primary)] block mt-0.5">
            {adaptiveHeadline?.mae ?? '—'} °C
          </span>
          <span className="text-[11px] text-[var(--color-text-secondary)]">Held-out test</span>
        </div>
        <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
          <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Systematic Bias</span>
          <span className="font-data text-2xl font-bold text-emerald-600 block mt-0.5">
            {adaptiveHeadline?.bias == null ? '—' : `${adaptiveHeadline.bias > 0 ? '+' : ''}${adaptiveHeadline.bias}`}
          </span>
          <span className="text-[11px] text-[var(--color-text-secondary)]">°C residual</span>
        </div>
        <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
          <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Pearson r</span>
          <span className="font-data text-2xl font-bold text-purple-600 block mt-0.5">
            {adaptiveHeadline?.pearson_r ?? '—'}
          </span>
          <span className="text-[11px] text-[var(--color-text-secondary)]">vs ERA5 reference</span>
        </div>
        <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] col-span-2 md:col-span-1">
          <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Held-Out Pairs</span>
          <span className="font-data text-2xl font-bold text-[var(--color-text-primary)] block mt-0.5">
            {adaptiveHeadline?.n?.toLocaleString() ?? '—'}
          </span>
          <span className="text-[11px] text-[var(--color-text-secondary)]">
            {adaptiveHeadline?.seasons || ''} · {adaptiveHeadline?.partition || ''}
          </span>
        </div>
      </div>

      {/* Lead-time degradation + season chart */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Lead-Time Error Degradation (24h to 120h)"
          subtitle="RMSE grows with forecast horizon · all splits, temperature"
          badge="By lead"
        >
          {leadData.length === 0 ? (
            <EmptyState title="No by-lead report" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={leadData} margin={{ top: 12, right: 20, bottom: 16, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                <XAxis dataKey="lead_time_hours" tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
                <YAxis tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} unit=" °C" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-panel)',
                    borderColor: 'var(--color-border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                {Object.entries(SYSTEM_STYLE)
                  .filter(([key]) => SINGLE_SYSTEMS.includes(key) || key === ADAPTIVE)
                  .map(([key, s]) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={s.name}
                      stroke={s.color}
                      strokeWidth={key === ADAPTIVE ? 3 : 1.8}
                      dot={false}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Seasonal RMSE by System"
          subtitle="Four 2026 benchmark windows · full dataset"
          badge="By season"
        >
          {seasonData.length === 0 ? (
            <EmptyState title="No by-season report" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={seasonData} margin={{ top: 12, right: 20, bottom: 16, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                <XAxis dataKey="season" tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
                <YAxis tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} unit=" °C" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-panel)',
                    borderColor: 'var(--color-border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                {Object.entries(SYSTEM_STYLE).map(([key, s]) => (
                  <Bar key={key} dataKey={key} name={s.name} fill={s.color} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Headline system comparison */}
      <ChartCard
        title="Held-Out RMSE by System"
        subtitle={`Scope: ${skill.headline?.scope} · ${skill.headline?.rows?.[0]?.partition || ''} · ${skill.headline?.rows?.[0]?.seasons || ''}`}
        badge="Headline skill"
        span="full"
      >
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={headlineBar} layout="vertical" margin={{ top: 8, right: 24, bottom: 12, left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" horizontal={false} />
            <XAxis type="number" unit=" °C" tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
            <YAxis
              type="category"
              dataKey="system"
              width={140}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickFormatter={(v) => SYSTEM_STYLE[v]?.name || v}
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
            <Bar dataKey="rmse" name="RMSE" radius={[0, 4, 4, 0]}>
              {headlineBar.map((r) => (
                <Cell
                  key={r.system}
                  fill={r.system === ADAPTIVE ? '#D97706' : SYSTEM_STYLE[r.system]?.color || '#94A3B8'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Per-region table */}
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-scale-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
              Skill by Region
            </h2>
            <p className="text-scale-xs text-[var(--color-text-secondary)] mt-0.5">
              The 6 benchmarked regions · full-dataset scope · temperature
            </p>
          </div>
          <ScopeBadge scope={skill.by_region?.scope} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-scale-xs">
            <thead className="bg-[var(--color-surface)] border-b border-[var(--color-border)] text-[var(--color-text-tertiary)] font-bold text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Region</th>
                <th className="py-2.5 px-3 text-right">Pairs (n)</th>
                <th className="py-2.5 px-3 text-right">VARUNA RMSE (°C)</th>
                <th className="py-2.5 px-3 text-right">Best Single Model</th>
                <th className="py-2.5 px-3 text-right">Best Single RMSE (°C)</th>
                <th className="py-2.5 px-4 text-right">Improvement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)] font-data">
              {regionRows.map((row) => (
                <tr
                  key={row.regionId}
                  className={`transition-colors hover:bg-[var(--color-surface)] ${
                    row.regionId === selectedRegionId ? 'bg-[var(--color-accent-subtle)]' : ''
                  }`}
                >
                  <td className="py-2.5 px-4 font-bold text-[var(--color-text-primary)]">{row.regionId}</td>
                  <td className="py-2.5 px-3 text-right text-[var(--color-text-secondary)]">
                    {row.n?.toLocaleString() ?? '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-amber-700">{row.adaptive?.rmse ?? '—'}</td>
                  <td className="py-2.5 px-3 text-right text-[var(--color-text-secondary)]">
                    {row.best ? SYSTEM_STYLE[row.best.system]?.name || row.best.system : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[var(--color-text-secondary)]">{row.best?.rmse ?? '—'}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-emerald-600">
                    {row.gain != null ? `-${row.gain.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-tertiary)]">
          Reference: {skill.reference}
        </div>
      </div>

      {skill.attribution && (
        <p className="text-[10px] text-[var(--color-text-tertiary)] font-data">{skill.attribution}</p>
      )}
    </div>
  );
}
