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
import { REGIONS, VARIABLES, MODELS, getDeterministicForecast } from '../data/mockData.js';
import { getRegionalRegimeVerification } from '../data/scientific_reports.js';
import ChartCard from '../components/shared/ChartCard';

export default function Models() {
  const selectedRegionId = useStore((s) => s.selectedRegionId);
  const selectRegion = useStore((s) => s.selectRegion);
  const selectedVariable = useStore((s) => s.selectedVariable);
  const setVariable = useStore((s) => s.setVariable);
  const selectedLeadTime = useStore((s) => s.selectedLeadTime);
  const setLeadTime = useStore((s) => s.setLeadTime);

  const forecast = getDeterministicForecast(selectedRegionId, selectedVariable, selectedLeadTime);
  const { models, region, variable } = forecast;

  // Complete 5-member operational ensemble table: IFS, AIFS, GFS, ICON, VARUNA BLEND
  const tableData = [
    {
      ...MODELS[0], // IFS
      forecastVal: models.ifs.value,
      rmse: models.ifs.rmse,
      mae: models.ifs.mae,
      bias: models.ifs.bias,
      correlation: models.ifs.correlation,
      weight: `${models.ifs.weight}%`,
      samples: models.ifs.sampleCount,
      latency: models.ifs.latency,
      isBlend: false,
    },
    {
      ...MODELS[1], // AIFS
      forecastVal: models.aifs.value,
      rmse: models.aifs.rmse,
      mae: models.aifs.mae,
      bias: models.aifs.bias,
      correlation: models.aifs.correlation,
      weight: `${models.aifs.weight}%`,
      samples: models.aifs.sampleCount,
      latency: models.aifs.latency,
      isBlend: false,
    },
    {
      ...MODELS[2], // GFS
      forecastVal: models.gfs.value,
      rmse: models.gfs.rmse,
      mae: models.gfs.mae,
      bias: models.gfs.bias,
      correlation: models.gfs.correlation,
      weight: `${models.gfs.weight}%`,
      samples: models.gfs.sampleCount,
      latency: models.gfs.latency,
      isBlend: false,
    },
    {
      ...MODELS[3], // ICON
      forecastVal: models.icon.value,
      rmse: models.icon.rmse,
      mae: models.icon.mae,
      bias: models.icon.bias,
      correlation: models.icon.correlation,
      weight: `${models.icon.weight}%`,
      samples: models.icon.sampleCount,
      latency: models.icon.latency,
      isBlend: false,
    },
    {
      ...MODELS[4], // BLEND
      forecastVal: models.blend.value,
      rmse: models.blend.rmse,
      mae: models.blend.mae,
      bias: models.blend.bias,
      correlation: models.blend.correlation,
      weight: '100% (Consensus)',
      samples: models.blend.sampleCount,
      latency: models.blend.latency,
      isBlend: true,
    },
  ];

  // Empirical regime verification data from verified Python pipeline (N = 3,507 per zone)
  const regimeVerificationData = getRegionalRegimeVerification();

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-scale-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Multi-Model Evaluation &amp; Ensembles
          </h1>
          <p className="mt-1 text-scale-sm text-[var(--color-text-secondary)]">
            Comprehensive skill benchmark comparing physical NWP, deep-learning transformers, and adaptive XGBoost meta-model blending
          </p>
        </div>

        {/* Global Selectors */}
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

      {/* Target Zone Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[var(--color-border)]">
        <span className="text-scale-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] shrink-0">
          Evaluated Zone:
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

      {/* Dense Model Comparison Table (Section 13) */}
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs overflow-hidden transition-colors">
        <div className="p-4 md:p-5 border-b border-[var(--color-border)] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-scale-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
              Operational Model Benchmark Matrix
            </h2>
            <p className="text-scale-xs text-[var(--color-text-secondary)] mt-0.5">
              Target: <strong className="text-[var(--color-text-primary)]">{region.name}</strong> • Variable: <strong className="text-[var(--color-text-primary)]">{variable.label}</strong> ({forecast.unit}) • Lead Time: <strong className="text-[var(--color-text-primary)]">{selectedLeadTime}</strong>
            </p>
          </div>
          <span className="font-data text-scale-xs bg-[var(--color-surface)] border border-[var(--color-border)] px-2.5 py-1 rounded-md text-[var(--color-text-secondary)] font-semibold">
            N = 4,512 Held-Out Test Records (21,042 Total Verified Samples)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-scale-xs">
            <thead className="bg-[var(--color-surface)] border-b border-[var(--color-border)] text-[var(--color-text-tertiary)] font-bold text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Model &amp; Architecture</th>
                <th className="py-3 px-3">Resolution / Grid</th>
                <th className="py-3 px-3 text-right">Forecast ({forecast.unit})</th>
                <th className="py-3 px-3 text-right">RMSE ({forecast.unit})</th>
                <th className="py-3 px-3 text-right">MAE ({forecast.unit})</th>
                <th className="py-3 px-3 text-right">Bias ({forecast.unit})</th>
                <th className="py-3 px-3 text-right">Pearson Correlation (r)</th>
                <th className="py-3 px-4 text-right">Dynamic Weight</th>
                <th className="py-3 px-3 text-right">Inference Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)] font-data">
              {tableData.map((row) => (
                <tr
                  key={row.id}
                  className={`
                    transition-colors hover:bg-[var(--color-surface)]
                    ${row.isBlend ? 'bg-[var(--color-accent-subtle)] font-semibold' : ''}
                  `}
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
                    {row.resolution}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-[var(--color-text-primary)] text-scale-sm">
                    {row.forecastVal}
                  </td>
                  <td className={`py-3 px-3 text-right font-bold ${row.isBlend ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
                    {row.rmse}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-500 dark:text-slate-400">
                    {row.mae}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-500 dark:text-slate-400">
                    {row.bias > 0 ? `+${row.bias}` : row.bias}
                  </td>
                  <td className={`py-3 px-3 text-right font-bold ${row.isBlend ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
                    {row.correlation}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className="px-2 py-0.5 rounded font-bold text-[11px]"
                      style={{
                        backgroundColor: row.isBlend ? '#F5C518' : 'rgba(0,0,0,0.06)',
                        color: row.isBlend ? '#1A1A17' : row.color,
                      }}
                    >
                      {row.weight}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-[var(--color-text-tertiary)]">
                    {row.latency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Meteorological Regime Skill Comparison */}
      <ChartCard
        title="Empirical Weather Regime Verification Error (RMSE °C)"
        subtitle="Verification against ERA5 reanalysis across Indian synoptic regimes (N = 3,507 samples per zone; lower is better)"
        badge="Regime Benchmark"
        span="full"
      >
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={regimeVerificationData} margin={{ top: 16, right: 24, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
            <XAxis
              dataKey="regime"
              tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)', fontFamily: "'Inter', sans-serif" }}
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
            <Bar dataKey="IFS" name="ECMWF IFS (9km NWP)" fill="#2563EB" radius={[4, 4, 0, 0]} />
            <Bar dataKey="AIFS" name="ECMWF AIFS (Deep Learning)" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="GFS" name="NOAA GFS (FV3 NWP)" fill="#059669" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ICON" name="DWD ICON (13km NWP)" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            <Bar dataKey="BLEND" name="VARUNA BLEND (Adaptive Hybrid)" fill="#D97706" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
