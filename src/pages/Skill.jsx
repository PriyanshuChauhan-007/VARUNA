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
} from 'recharts';
import { useStore } from '../store/useStore';
import { REGIONS, VARIABLES, getDeterministicForecast } from '../data/mockData.js';
import { generateVerificationHistory } from '../ml/verification_engine.js';
import ChartCard from '../components/shared/ChartCard';

export default function Skill() {
  const selectedRegionId = useStore((s) => s.selectedRegionId);
  const selectRegion = useStore((s) => s.selectRegion);
  const selectedVariable = useStore((s) => s.selectedVariable);
  const setVariable = useStore((s) => s.setVariable);
  const selectedLeadTime = useStore((s) => s.selectedLeadTime);
  const setLeadTime = useStore((s) => s.setLeadTime);

  const [timeHorizon, setTimeHorizon] = useState('14D'); // '7D' | '14D' | '30D'

  const forecast = getDeterministicForecast(selectedRegionId, selectedVariable, selectedLeadTime);
  const { region, variable, models, leadTimeCurve } = forecast;

  // ML Verification Engine computes historical verification series
  const daysCount = timeHorizon === '7D' ? 7 : timeHorizon === '14D' ? 14 : 30;
  const historyData = generateVerificationHistory({ daysCount, models });

  // Error reduction comparison
  const reductionData = [
    { model: 'ECMWF IFS', rmse: models.ifs.rmse, color: '#2563EB' },
    { model: 'NOAA GFS', rmse: models.gfs.rmse, color: '#059669' },
    { model: 'ECMWF AIFS', rmse: models.aifs.rmse, color: '#8B5CF6' },
    { model: 'VARUNA BLEND', rmse: models.blend.rmse, color: '#F5C518' },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-scale-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Forecast Verification &amp; Model Skill
          </h1>
          <p className="mt-1 text-scale-sm text-[var(--color-text-secondary)]">
            Statistical verification against ERA5 reanalysis reference dataset (IMD AWS in-situ integration pending)
          </p>
        </div>

        {/* Rolling Window Horizon Pills (matching THERMOS Analytics) */}
        <div className="inline-flex items-center gap-1 bg-[var(--color-panel)] border border-[var(--color-border)] p-1 rounded-[var(--radius-lg)] shadow-xs">
          {[
            { id: '7D', label: '7-Day Rolling' },
            { id: '14D', label: '14-Day Baseline' },
            { id: '30D', label: '30-Day Seasonal' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTimeHorizon(tab.id)}
              className={`px-3 py-1.5 text-scale-xs font-semibold rounded-[var(--radius-md)] transition-all cursor-pointer ${
                timeHorizon === tab.id
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

      {/* Metric Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
          <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Blend RMSE</span>
          <span className="font-data text-2xl font-bold text-amber-600 block mt-0.5">{models.blend.rmse} {forecast.unit}</span>
          <span className="text-[11px] text-emerald-600 font-semibold font-data">-{models.blend.rmseReductionPct}% error</span>
        </div>
        <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
          <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Mean Abs Error (MAE)</span>
          <span className="font-data text-2xl font-bold text-[var(--color-text-primary)] block mt-0.5">{models.blend.mae} {forecast.unit}</span>
          <span className="text-[11px] text-[var(--color-text-secondary)]">Unbiased median</span>
        </div>
        <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
          <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Systematic Bias</span>
          <span className="font-data text-2xl font-bold text-emerald-600 block mt-0.5">+{models.blend.bias} {forecast.unit}</span>
          <span className="text-[11px] text-[var(--color-text-secondary)]">Near-zero residual</span>
        </div>
        <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
          <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Spatial Correlation</span>
          <span className="font-data text-2xl font-bold text-purple-600 block mt-0.5">{models.blend.correlation}</span>
          <span className="text-[11px] text-[var(--color-text-secondary)]">r coefficient (0-1)</span>
        </div>
        <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] col-span-2 md:col-span-1">
          <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Verified Points</span>
          <span className="font-data text-2xl font-bold text-[var(--color-text-primary)] block mt-0.5">{models.blend.sampleCount}</span>
          <span className="text-[11px] text-[var(--color-text-secondary)]">Reference Grid Points</span>
        </div>
      </div>

      {/* Verification Timeline Chart */}
      <ChartCard
        title={`Verification Error Trend (RMSE) — Past ${daysCount} Days`}
        subtitle={`Tracking daily root mean square error against reference dataset for ${region.name} (${variable.label})`}
        badge={`${timeHorizon} Rolling`}
        span="full"
      >
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={historyData} margin={{ top: 16, right: 24, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
            <XAxis
              dataKey="date"
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
            <Line type="monotone" dataKey="IFS" name="ECMWF IFS" stroke="#2563EB" strokeWidth={2} dot={{ r: 2.5 }} />
            <Line type="monotone" dataKey="GFS" name="NOAA GFS" stroke="#059669" strokeWidth={2} dot={{ r: 2.5 }} />
            <Line type="monotone" dataKey="AIFS" name="ECMWF AIFS (Deep Learning)" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 2.5 }} />
            <Line type="monotone" dataKey="BLEND" name="VARUNA BLEND (Adaptive)" stroke="#D97706" strokeWidth={3.5} dot={{ r: 3.5 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Lead Time Degradation Curve & Model Error Comparison */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Lead-Time Error Degradation Curve (24h to 120h)"
          subtitle="How forecast error grows over forecast horizon"
          badge="Horizon Stability"
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={leadTimeCurve} margin={{ top: 12, right: 20, bottom: 16, left: 10 }}>
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
              <Line type="monotone" dataKey="GFS" stroke="#059669" strokeWidth={1.8} />
              <Line type="monotone" dataKey="AIFS" stroke="#8B5CF6" strokeWidth={1.8} />
              <Line type="monotone" dataKey="BLEND" stroke="#D97706" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Direct Model RMSE Comparison"
          subtitle="Observed verification error at current lead time"
          badge={selectedLeadTime}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={reductionData} margin={{ top: 12, right: 20, bottom: 16, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
              <XAxis dataKey="model" tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
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
              <Bar dataKey="rmse" name="RMSE" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
