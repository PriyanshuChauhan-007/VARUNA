import { useState, useEffect } from 'react';
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
import { fetchSkill } from '../services/api';
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

  // Authoritative API data state
  const [skillApiData, setSkillApiData] = useState(null);
  const [skillSource, setSkillSource] = useState('loading'); // 'live_api' | 'offline_snapshot'
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    fetchSkill({ variable: selectedVariable })
      .then((data) => {
        if (!isMounted) return;
        if (data && data.available) {
          setSkillApiData(data);
          setSkillSource('live_api');
          setApiError(null);
        } else {
          setSkillSource('offline_snapshot');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setSkillSource('offline_snapshot');
        setApiError(err.message || 'API connection failed');
      });

    return () => {
      isMounted = false;
    };
  }, [selectedVariable]);

  const forecast = getDeterministicForecast(selectedRegionId, selectedVariable, selectedLeadTime);
  const { region, variable } = forecast;

  // Authoritative empirical verification data: live API data if available, with offline report snapshot fallback
  const heldOutMetrics = getHeldOutTestMetrics(skillApiData?.headline?.rows);
  const leadDegradationData = getLeadDegradationCurve(skillApiData?.by_lead?.rows);
  const seasonalSkillData = getSeasonalBreakdown(skillApiData?.by_season?.rows);
  const regionalRegimeData = getRegionalRegimeVerification(skillApiData?.by_region?.rows);

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
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-[var(--varuna-bg)]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-scale-2xl font-bold tracking-tight text-[var(--varuna-text)]">
              Forecast Verification &amp; Model Skill
            </h1>
            {skillSource === 'live_api' && (
              <span className="text-[11px] font-data font-semibold px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 shrink-0">
                Live API: /api/skill
              </span>
            )}
            {skillSource === 'offline_snapshot' && (
              <span className="text-[11px] font-data font-semibold px-2 py-0.5 rounded border border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 shrink-0" title={apiError || 'Using verified local report snapshot'}>
                Offline Report Snapshot
              </span>
            )}
          </div>
          <p className="mt-1 text-scale-sm text-[var(--varuna-text-secondary)]">
            Empirical statistical verification against ERA5 reanalysis reference dataset (IMD AWS in-situ station mesh not connected)
          </p>
        </div>

        {/* Verification Dimension Selector */}
        <div className="inline-flex items-center gap-1 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] p-1 rounded-[var(--radius-lg)] shadow-xs">
          {[
            { id: 'lead', label: 'By Lead Time (24h-120h)' },
            { id: 'season', label: 'By Season (4 Seasons)' },
            { id: 'region', label: 'By Synoptic Zone (6 Zones)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveDimension(tab.id)}
              className={`px-3 py-1.5 text-scale-xs font-semibold rounded-[var(--radius-md)] transition-all cursor-pointer font-data ${
                activeDimension === tab.id
                  ? 'bg-[var(--varuna-blue)] text-white shadow-xs font-bold'
                  : 'text-[var(--varuna-text-secondary)] hover:text-[var(--varuna-text)] hover:bg-[var(--varuna-surface-soft)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Target and Variable Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[var(--varuna-border)]">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-2xl">
          <span className="text-scale-xs font-bold uppercase tracking-wider text-[var(--varuna-text-muted)] shrink-0 font-data">
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
                      ? 'bg-[var(--varuna-blue-light)] border-[var(--varuna-blue)] text-[var(--varuna-blue-dark)] font-bold shadow-xs'
                      : 'bg-[var(--varuna-surface)] border-[var(--varuna-border)] text-[var(--varuna-text-secondary)] hover:text-[var(--varuna-text)] hover:bg-[var(--varuna-surface-soft)]'
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
          <div className="flex items-center gap-1 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] p-1 rounded-[var(--radius-md)]">
            {['24h', '48h', '72h', '120h'].map((lt) => (
              <button
                key={lt}
                onClick={() => setLeadTime(lt)}
                className={`px-2 py-0.5 text-scale-xs font-semibold rounded transition-all cursor-pointer font-data ${
                  selectedLeadTime === lt
                    ? 'bg-[var(--varuna-blue)] text-white shadow-xs font-bold'
                    : 'text-[var(--varuna-text-secondary)] hover:text-[var(--varuna-text)]'
                }`}
              >
                {lt.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] p-1 rounded-[var(--radius-md)]">
            {VARIABLES.map((v) => (
              <button
                key={v.id}
                onClick={() => setVariable(v.id)}
                className={`px-2.5 py-1 text-scale-xs font-medium rounded transition-all cursor-pointer ${
                  selectedVariable === v.id
                    ? 'bg-[var(--varuna-blue)] text-white font-bold shadow-xs'
                    : 'text-[var(--varuna-text-secondary)] hover:text-[var(--varuna-text)] hover:bg-[var(--varuna-surface-soft)]'
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
        <div className="p-3.5 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-lg)] shadow-xs">
          <span className="text-[10px] font-bold text-[var(--varuna-text-muted)] uppercase block font-data">Blend RMSE</span>
          <span className="font-data text-2xl font-bold text-[var(--varuna-blue-dark)] block mt-0.5">{heldOutMetrics.blendRmse} {forecast.unit}</span>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold font-data">-{heldOutMetrics.reductionVsIfs}% vs best NWP</span>
        </div>
        <div className="p-3.5 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-lg)] shadow-xs">
          <span className="text-[10px] font-bold text-[var(--varuna-text-muted)] uppercase block font-data">Mean Abs Error (MAE)</span>
          <span className="font-data text-2xl font-bold text-[var(--varuna-text)] block mt-0.5">{heldOutMetrics.blendMae} {forecast.unit}</span>
          <span className="text-[11px] text-[var(--varuna-text-secondary)] font-data">Mean Absolute Error</span>
        </div>
        <div className="p-3.5 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-lg)] shadow-xs">
          <span className="text-[10px] font-bold text-[var(--varuna-text-muted)] uppercase block font-data">Systematic Bias</span>
          <span className="font-data text-2xl font-bold text-emerald-700 dark:text-emerald-400 block mt-0.5">+{heldOutMetrics.blendBias} {forecast.unit}</span>
          <span className="text-[11px] text-[var(--varuna-text-secondary)] font-data">Near-zero residual</span>
        </div>
        <div className="p-3.5 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-lg)] shadow-xs">
          <span className="text-[10px] font-bold text-[var(--varuna-text-muted)] uppercase block font-data">Pearson Correlation (r)</span>
          <span className="font-data text-2xl font-bold text-[var(--varuna-blue)] block mt-0.5">{heldOutMetrics.blendCorrelation}</span>
          <span className="text-[11px] text-[var(--varuna-text-secondary)] font-data">Pearson r coefficient (0-1)</span>
        </div>
        <div className="p-3.5 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-lg)] shadow-xs col-span-2 md:col-span-1">
          <span className="text-[10px] font-bold text-[var(--varuna-text-muted)] uppercase block font-data">Verified Samples</span>
          <span className="font-data text-2xl font-bold text-[var(--varuna-text)] block mt-0.5">{heldOutMetrics.testSampleCount.toLocaleString()}</span>
          <span className="text-[11px] text-[var(--varuna-text-secondary)] font-data">Held-Out Test Records</span>
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
              <CartesianGrid strokeDasharray="3 3" stroke="var(--varuna-border)" vertical={false} />
              <XAxis
                dataKey="lead"
                tick={{ fontSize: 11, fill: 'var(--varuna-text-secondary)', fontFamily: 'var(--font-data)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--varuna-border)' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--varuna-text-secondary)', fontFamily: 'var(--font-data)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--varuna-border)' }}
                unit={` ${forecast.unit}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--varuna-surface)',
                  borderColor: 'var(--varuna-border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-data)',
                  color: 'var(--varuna-text)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', fontFamily: 'var(--font-ui)' }} />
              <Line type="monotone" dataKey="IFS" name="ECMWF IFS (9km NWP)" stroke="#1E40AF" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="AIFS" name="ECMWF AIFS (Deep Learning)" stroke="#0284C7" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="GFS" name="NOAA GFS (FV3 Global)" stroke="#0D9488" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="ICON" name="DWD ICON (13km NWP)" stroke="#64748B" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="BLEND" name="VARUNA BLEND (Adaptive Hybrid)" stroke="#245F89" strokeWidth={3.5} dot={{ r: 4 }} />
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
              <CartesianGrid strokeDasharray="3 3" stroke="var(--varuna-border)" vertical={false} />
              <XAxis
                dataKey="season"
                tick={{ fontSize: 11, fill: 'var(--varuna-text-secondary)', fontFamily: 'var(--font-ui)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--varuna-border)' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--varuna-text-secondary)', fontFamily: 'var(--font-data)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--varuna-border)' }}
                unit={` ${forecast.unit}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--varuna-surface)',
                  borderColor: 'var(--varuna-border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-data)',
                  color: 'var(--varuna-text)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', fontFamily: 'var(--font-ui)' }} />
              <Bar dataKey="IFS" name="ECMWF IFS (9km)" fill="#1E40AF" radius={[4, 4, 0, 0]} />
              <Bar dataKey="AIFS" name="ECMWF AIFS (Deep Learning)" fill="#0284C7" radius={[4, 4, 0, 0]} />
              <Bar dataKey="GFS" name="NOAA GFS (FV3)" fill="#0D9488" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ICON" name="DWD ICON (13km)" fill="#64748B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="BLEND" name="VARUNA BLEND (Adaptive)" fill="#245F89" radius={[4, 4, 0, 0]} />
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
              <CartesianGrid strokeDasharray="3 3" stroke="var(--varuna-border)" vertical={false} />
              <XAxis
                dataKey="regime"
                tick={{ fontSize: 10, fill: 'var(--varuna-text-secondary)', fontFamily: 'var(--font-ui)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--varuna-border)' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--varuna-text-secondary)', fontFamily: 'var(--font-data)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--varuna-border)' }}
                unit={` ${forecast.unit}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--varuna-surface)',
                  borderColor: 'var(--varuna-border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-data)',
                  color: 'var(--varuna-text)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', fontFamily: 'var(--font-ui)' }} />
              <Bar dataKey="IFS" name="ECMWF IFS" fill="#1E40AF" radius={[4, 4, 0, 0]} />
              <Bar dataKey="AIFS" name="ECMWF AIFS" fill="#0284C7" radius={[4, 4, 0, 0]} />
              <Bar dataKey="GFS" name="NOAA GFS" fill="#0D9488" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ICON" name="DWD ICON" fill="#64748B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="BLEND" name="VARUNA BLEND" fill="#245F89" radius={[4, 4, 0, 0]} />
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
              <CartesianGrid strokeDasharray="3 3" stroke="var(--varuna-border)" vertical={false} />
              <XAxis dataKey="lead" tickLine={false} axisLine={{ stroke: 'var(--varuna-border)' }} tick={{ fill: 'var(--varuna-text-secondary)', fontFamily: 'var(--font-data)', fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={{ stroke: 'var(--varuna-border)' }} unit={` ${forecast.unit}`} tick={{ fill: 'var(--varuna-text-secondary)', fontFamily: 'var(--font-data)', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--varuna-surface)',
                  borderColor: 'var(--varuna-border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-data)',
                  color: 'var(--varuna-text)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px', fontFamily: 'var(--font-ui)' }} />
              <Line type="monotone" dataKey="IFS" stroke="#1E40AF" strokeWidth={1.8} />
              <Line type="monotone" dataKey="AIFS" stroke="#0284C7" strokeWidth={1.8} />
              <Line type="monotone" dataKey="GFS" stroke="#0D9488" strokeWidth={1.8} />
              <Line type="monotone" dataKey="ICON" stroke="#64748B" strokeWidth={1.8} />
              <Line type="monotone" dataKey="BLEND" stroke="#245F89" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Direct Model Comparison — Held-Out Test Set"
          subtitle="Strict held-out chronological test partition (N = 4,512 paired records, Post-Monsoon, ERA5 Reference)"
          badge="Held-Out Test (N = 4,512)"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={testComparisonData} margin={{ top: 12, right: 20, bottom: 16, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--varuna-border)" vertical={false} />
              <XAxis dataKey="model" tickLine={false} axisLine={{ stroke: 'var(--varuna-border)' }} tick={{ fontSize: 10, fill: 'var(--varuna-text-secondary)', fontFamily: 'var(--font-ui)' }} />
              <YAxis tickLine={false} axisLine={{ stroke: 'var(--varuna-border)' }} unit={` ${forecast.unit}`} tick={{ fill: 'var(--varuna-text-secondary)', fontFamily: 'var(--font-data)', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--varuna-surface)',
                  borderColor: 'var(--varuna-border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-data)',
                  color: 'var(--varuna-text)',
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
