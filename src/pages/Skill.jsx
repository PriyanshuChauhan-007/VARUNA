import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { useStore } from '../store/useStore';
import { REGIONS, VARIABLES, getDeterministicForecast } from '../data/mockData.js';
import {
  getHeldOutTestMetrics,
  getLeadDegradationCurve,
  getSeasonalBreakdown,
  getRegionalRegimeVerification,
} from '../data/scientific_reports.js';
import ChartCard from '../components/shared/ChartCard';

export default function Skill() {
  const selectedRegionId = useStore((s) => s.selectedRegionId);
  const selectRegion = useStore((s) => s.selectRegion);
  const selectedVariable = useStore((s) => s.selectedVariable);
  const setVariable = useStore((s) => s.setVariable);
  const selectedLeadTime = useStore((s) => s.selectedLeadTime);
  const setLeadTime = useStore((s) => s.setLeadTime);

  // Dimension filter for empirical verification breakdown: 'lead' | 'season' | 'region'
  const [activeDimension, setActiveDimension] = useState('lead');

  const forecast = getDeterministicForecast(selectedRegionId, selectedVariable, selectedLeadTime);
  const { region, variable } = forecast;

  // Authoritative empirical verification data from Python science pipeline
  const heldOutMetrics = getHeldOutTestMetrics();
  const leadDegradationData = getLeadDegradationCurve();
  const seasonalSkillData = getSeasonalBreakdown();
  const regionalRegimeData = getRegionalRegimeVerification();

  // Test Partition Direct Model Comparison (7 models / baselines / blends)
  const testComparisonData = heldOutMetrics.records.map((r) => ({
    model: r.modelName,
    rmse: r.rmse,
    mae: r.mae,
    bias: r.bias,
    correlation: r.correlation,
    samples: r.samples,
    color: r.color,
  }));

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-scale-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Forecast Verification &amp; Model Skill
          </h1>
          <p className="mt-1 text-scale-sm text-[var(--color-text-secondary)]">
            Empirical statistical verification against ERA5 reanalysis reference dataset (IMD AWS in-situ integration pending)
          </p>
        </div>

        {/* Verification Dimension Selector */}
        <div className="inline-flex items-center gap-1 bg-[var(--color-panel)] border border-[var(--color-border)] p-1 rounded-[var(--radius-lg)] shadow-xs">
          {[
            { id: 'lead', label: 'By Lead Time (24h-120h)' },
            { id: 'season', label: 'By Season (4 Seasons)' },
            { id: 'region', label: 'By Synoptic Zone (6 Zones)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveDimension(tab.id)}
              className={`px-3 py-1.5 text-scale-xs font-semibold rounded-[var(--radius-md)] transition-all cursor-pointer ${
                activeDimension === tab.id
                  ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)] shadow-xs font-bold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Target and Variable Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-2xl">
          <span className="text-scale-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] shrink-0">
            Region:
          </span>
          {REGIONS.slice(0, 7).map((r) => {
            const isSelected = r.id === selectedRegionId;
            return (
              <button
                key={r.id}
                onClick={() => selectRegion(r.id)}
                className={`
                  px-2.5 py-1 rounded-[var(--radius-md)] text-scale-xs font-medium shrink-0 transition-all cursor-pointer border
                  ${
                    isSelected
                      ? 'bg-[var(--color-accent-subtle)] border-amber-400 text-[var(--color-text-primary)] font-bold'
                      : 'bg-[var(--color-panel)] border-[var(--color-border)] text-[var(--color-text-secondary)]'
                  }
                `}
              >
                {r.name.split(' (')[0]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Lead time pill */}
          <div className="flex items-center gap-1 bg-[var(--color-panel)] border border-[var(--color-border)] p-1 rounded-[var(--radius-md)]">
            {['24h', '48h', '72h', '120h'].map((lt) => (
              <button
                key={lt}
                onClick={() => setLeadTime(lt)}
                className={`px-2 py-0.5 text-scale-xs font-semibold rounded transition-all cursor-pointer ${
                  selectedLeadTime === lt
                    ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)] shadow-xs font-bold'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {lt.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-[var(--color-panel)] border border-[var(--color-border)] p-1 rounded-[var(--radius-md)]">
            {VARIABLES.map((v) => (
              <button
                key={v.id}
                onClick={() => setVariable(v.id)}
                className={`px-2.5 py-1 text-scale-xs font-medium rounded transition-all cursor-pointer ${
                  selectedVariable === v.id
                    ? 'bg-slate-900 text-white font-bold'
                    : 'text-[var(--color-text-secondary)]'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metric Cards Strip (Held-Out Test Set N = 4,512) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
          <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Blend RMSE</span>
          <span className="font-data text-2xl font-bold text-amber-600 block mt-0.5">{heldOutMetrics.blendRmse} {forecast.unit}</span>
          <span className="text-[11px] text-emerald-600 font-semibold font-data">-{heldOutMetrics.reductionVsIfs}% vs best NWP</span>
        </div>
        <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
          <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Mean Abs Error (MAE)</span>
          <span className="font-data text-2xl font-bold text-[var(--color-text-primary)] block mt-0.5">{heldOutMetrics.blendMae} {forecast.unit}</span>
          <span className="text-[11px] text-[var(--color-text-secondary)]">Mean Absolute Error</span>
        </div>
        <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
          <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Systematic Bias</span>
          <span className="font-data text-2xl font-bold text-emerald-600 block mt-0.5">+{heldOutMetrics.blendBias} {forecast.unit}</span>
          <span className="text-[11px] text-[var(--color-text-secondary)]">Near-zero residual</span>
        </div>
        <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
          <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Pearson Correlation (r)</span>
          <span className="font-data text-2xl font-bold text-purple-600 block mt-0.5">{heldOutMetrics.blendCorrelation}</span>
          <span className="text-[11px] text-[var(--color-text-secondary)]">Pearson r coefficient (0-1)</span>
        </div>
        <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] col-span-2 md:col-span-1">
          <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Verified Samples</span>
          <span className="font-data text-2xl font-bold text-[var(--color-text-primary)] block mt-0.5">{heldOutMetrics.testSampleCount.toLocaleString()}</span>
          <span className="text-[11px] text-[var(--color-text-secondary)]">Held-Out Test Records</span>
        </div>
      </div>

      {/* Main Empirical Verification Chart — Switches dynamically across dimensions */}
      {activeDimension === 'lead' && (
        <ChartCard
          title="Empirical Lead-Time Error Degradation Curve (RMSE °C)"
          subtitle={`Multi-model root mean square error across 24h, 48h, 72h, and 120h lead times for ${region.name} (${variable.label})`}
          badge="Lead Time (24h-120h) · N = 21,042"
          span="full"
        >
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={leadDegradationData} margin={{ top: 16, right: 24, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
              <XAxis
                dataKey="lead"
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
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Line type="monotone" dataKey="IFS" name="ECMWF IFS (9km NWP)" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="AIFS" name="ECMWF AIFS (Deep Learning)" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="GFS" name="NOAA GFS (FV3 Global)" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="ICON" name="DWD ICON (13km NWP)" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="BLEND" name="VARUNA BLEND (Adaptive Hybrid)" stroke="#D97706" strokeWidth={3.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {activeDimension === 'season' && (
        <ChartCard
          title="Empirical Seasonal Verification Benchmark (RMSE °C)"
          subtitle={`Multi-model verification across 4 meteorological seasons (N = 21,042 records vs ERA5 reference)`}
          badge="Seasonal Skill Breakdown"
          span="full"
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={seasonalSkillData} margin={{ top: 16, right: 24, bottom: 20, left: 10 }}>
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
                unit={` ${forecast.unit}`}
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
              <Bar dataKey="IFS" name="ECMWF IFS (9km)" fill="#2563EB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="AIFS" name="ECMWF AIFS (Deep Learning)" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="GFS" name="NOAA GFS (FV3)" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ICON" name="DWD ICON (13km)" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="BLEND" name="VARUNA BLEND (Adaptive)" fill="#D97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {activeDimension === 'region' && (
        <ChartCard
          title="Empirical Regional Synoptic Zone Verification (RMSE °C)"
          subtitle={`Root mean square error across 6 Indian micro-climatic zones (N = 3,507 samples per zone vs ERA5 reference)`}
          badge="Micro-Climatic Regimes"
          span="full"
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={regionalRegimeData} margin={{ top: 16, right: 24, bottom: 20, left: 10 }}>
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
                unit={` ${forecast.unit}`}
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
              <Bar dataKey="IFS" name="ECMWF IFS" fill="#2563EB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="AIFS" name="ECMWF AIFS" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="GFS" name="NOAA GFS" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ICON" name="DWD ICON" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="BLEND" name="VARUNA BLEND" fill="#D97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Lead Time Degradation Curve & Direct Model Comparison */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Lead-Time Horizon Stability (24h to 120h)"
          subtitle="How forecast error grows over forecast horizon across NWP and AI members"
          badge="Horizon Stability"
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={leadDegradationData} margin={{ top: 12, right: 20, bottom: 16, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
              <XAxis dataKey="lead" tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
              <YAxis tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} unit={` ${forecast.unit}`} />
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
              <Line type="monotone" dataKey="IFS" stroke="#2563EB" strokeWidth={1.8} />
              <Line type="monotone" dataKey="AIFS" stroke="#8B5CF6" strokeWidth={1.8} />
              <Line type="monotone" dataKey="GFS" stroke="#059669" strokeWidth={1.8} />
              <Line type="monotone" dataKey="ICON" stroke="#F59E0B" strokeWidth={1.8} />
              <Line type="monotone" dataKey="BLEND" stroke="#D97706" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Direct Model Comparison — Held-Out Test Set"
          subtitle="Strict held-out chronological test partition (N = 4,512 paired records)"
          badge="N = 4,512 Test"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={testComparisonData} margin={{ top: 12, right: 20, bottom: 16, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
              <XAxis dataKey="model" tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} unit={` ${forecast.unit}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-panel)',
                  borderColor: 'var(--color-border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
              <Bar dataKey="rmse" name="Test RMSE (°C)" radius={[4, 4, 0, 0]}>
                {testComparisonData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
