import { useStore } from '../store/useStore';
import { leadToHours, getExtremes, alertTier } from '../services/api';
import { useApi } from '../services/useApi';
import { getRiskColor } from '../utils/formatters';
import { LoadingState, ErrorState, EmptyState } from '../components/shared/StatusStates';
import { DataModeBadge, ValidatedBadge } from '../components/shared/Badges';

const HAZARD_ICONS = {
  heavy_rain: '🌧️',
  heatwave: '🌡️',
  wind_squall: '💨',
};

export default function Extremes() {
  const selectRegion = useStore((s) => s.focusRegion);
  const selectedRegionId = useStore((s) => s.selectedRegionId);
  const regions = useStore((s) => s.regions);
  const selectedLeadTime = useStore((s) => s.selectedLeadTime);
  const setLeadTime = useStore((s) => s.setLeadTime);

  const leadHours = leadToHours(selectedLeadTime);
  const region = regions.find((r) => r.id === selectedRegionId) || regions[0];

  const extremesQ = useApi(
    () => getExtremes({ region: selectedRegionId, leadTimeHours: leadHours }),
    [selectedRegionId, leadHours]
  );
  const payload = extremesQ.data;
  const checks = payload?.checks || [];
  const alerts = payload?.alerts || [];
  const tierInfo = payload ? alertTier(payload.alerts) : null;

  return (
    <div className="flex flex-col md:flex-row h-full bg-[var(--color-surface)] overflow-hidden">
      {/* Sidebar: region selector + threshold criteria */}
      <aside className="w-full md:w-[280px] shrink-0 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-panel)] p-5 flex flex-col gap-6 transition-colors">
        <div className="flex items-center justify-between">
          <h2 className="text-scale-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
            Evaluation Zone
          </h2>
          <DataModeBadge mode={payload?.data_mode} />
        </div>

        <div className="flex flex-col gap-1.5">
          {regions.map((r) => (
            <button
              key={r.id}
              onClick={() => selectRegion(r.id)}
              className={`w-full text-left p-2 rounded-[var(--radius-md)] text-scale-xs font-semibold transition-all cursor-pointer border ${
                r.id === selectedRegionId
                  ? 'bg-[var(--color-surface)] border-amber-400 text-[var(--color-text-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              <span className="block truncate">{r.name}</span>
              <span className="text-[10px] font-normal text-[var(--color-text-tertiary)]">
                {r.validated ? 'Benchmarked · ' : ''}{r.zone}
              </span>
            </button>
          ))}
        </div>

        {/* Lead time */}
        <div>
          <label className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-2">
            Evaluation Lead
          </label>
          <div className="flex items-center gap-1 bg-[var(--color-surface)] p-1 rounded-[var(--radius-md)] border border-[var(--color-border)]">
            {['24h', '48h', '72h', '120h'].map((lt) => (
              <button
                key={lt}
                onClick={() => setLeadTime(lt)}
                className={`flex-1 px-2 py-1 text-scale-xs font-semibold rounded transition-all cursor-pointer ${
                  selectedLeadTime === lt
                    ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)] shadow-xs font-bold'
                    : 'text-[var(--color-text-secondary)]'
                }`}
              >
                {lt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Static threshold reference (IMD) */}
        <div className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
          <strong className="block text-[var(--color-text-primary)] mb-1">IMD Threshold Criteria</strong>
          <ul className="space-y-0.5 font-data">
            <li>· Heavy rain ≥ 64.5 mm/24h</li>
            <li>· Very heavy rain ≥ 115.6 mm/24h</li>
            <li>· Heatwave daily max ≥ 45.0 °C</li>
            <li>· Squally winds ≥ 55 km/h</li>
            <li>· Gale ≥ 62 km/h</li>
          </ul>
          <p className="mt-2">
            Alerts fire only when the blended forecast actually crosses a threshold.
          </p>
        </div>

        {payload?.note && (
          <div className="mt-auto p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
            <strong className="block text-[var(--color-text-primary)] mb-0.5">Backend note</strong>
            {payload.note}
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-scale-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
                Extreme Weather Surveillance
              </h1>
              <DataModeBadge mode={payload?.data_mode} />
            </div>
            <p className="mt-0.5 text-scale-sm text-[var(--color-text-secondary)]">
              Threshold evaluation of the blended forecast for{' '}
              <strong className="text-[var(--color-text-primary)]">{region?.name}</strong> at +{selectedLeadTime}
            </p>
          </div>
          <span
            className={`self-start sm:self-auto font-data text-scale-xs px-3 py-1 rounded-full border font-bold ${
              alerts.length > 0
                ? 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-400 border-red-300'
                : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border-emerald-300'
            }`}
          >
            ● {alerts.length > 0 ? `${alerts.length} THRESHOLD ALERT${alerts.length > 1 ? 'S' : ''}` : 'NO THRESHOLD CROSSING'}
          </span>
        </div>

        {extremesQ.loading && <LoadingState label="Evaluating thresholds for temperature, rainfall and wind…" />}
        {extremesQ.error && (
          <ErrorState error={extremesQ.error} onRetry={extremesQ.reload} label="Threshold evaluation unavailable" />
        )}
        {!extremesQ.loading && !extremesQ.error && !payload && (
          <EmptyState title="No threshold data" message="The backend returned an empty payload." />
        )}

        {payload && (
          <>
            {/* Summary Metric Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
                <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Overall Status</span>
                <span className="font-data text-lg font-bold text-[var(--color-text-primary)] block mt-0.5">
                  {payload.status === 'alerts' ? 'Threshold crossed' : 'No crossing'}
                </span>
              </div>
              <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
                <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Highest Tier</span>
                <span
                  className="font-data text-2xl font-bold block mt-0.5"
                  style={{ color: getRiskColor(tierInfo?.tier || 'Low') }}
                >
                  {tierInfo?.tier || '—'}
                </span>
              </div>
              <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
                <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Window</span>
                <span className="font-data text-2xl font-bold text-[var(--color-text-primary)] block mt-0.5">
                  {payload.window_hours}h
                </span>
                <span className="text-[11px] text-[var(--color-text-secondary)]">
                  to {payload.evaluated_blend_time?.slice(0, 16).replace('T', ' ')} UTC
                </span>
              </div>
              <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
                <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block">Validated</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {Object.entries(payload.validated || {}).map(([k, v]) => (
                    <ValidatedBadge key={k} validated={v} scopeNote={`${k}: unvalidated until Phase 4`} />
                  ))}
                </div>
              </div>
            </div>

            {/* Alerts banner */}
            {alerts.length > 0 && (
              <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-[var(--radius-lg)] space-y-2">
                <span className="text-scale-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-300">
                  Active threshold alerts
                </span>
                {alerts.map((a) => (
                  <div key={a.hazard} className="flex items-center justify-between text-scale-xs text-red-800 dark:text-red-200">
                    <span className="font-semibold">
                      {HAZARD_ICONS[a.hazard]} {a.label}: {a.value} {a.unit}
                    </span>
                    <span className="font-data">{a.threshold_label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Hazard check cards */}
            <div className="grid gap-4 md:grid-cols-3">
              {checks.map((c) => (
                <div
                  key={c.hazard}
                  className={`p-5 bg-[var(--color-panel)] border rounded-[var(--radius-xl)] shadow-xs transition-all ${
                    c.crossed
                      ? 'border-red-400 hover:border-red-500'
                      : 'border-[var(--color-border)] hover:border-amber-400/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{HAZARD_ICONS[c.hazard] || '⚠️'}</span>
                      <h3 className="text-scale-base font-bold text-[var(--color-text-primary)]">{c.label}</h3>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded text-white font-data uppercase ${
                        c.crossed ? 'bg-red-600' : 'bg-slate-500'
                      }`}
                    >
                      {c.crossed ? c.severity : 'normal'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 bg-[var(--color-surface)] p-2.5 px-3.5 rounded-[var(--radius-lg)] border border-[var(--color-border)] mb-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-[var(--color-text-tertiary)]">Blend value</div>
                      <div className="font-data text-xl font-bold text-[var(--color-text-primary)]">
                        {c.value ?? '—'} <span className="text-[11px]">{c.unit}</span>
                      </div>
                    </div>
                    <div className="w-px h-8 bg-[var(--color-border)]" />
                    <div>
                      <div className="text-[10px] font-bold uppercase text-[var(--color-text-tertiary)]">Threshold</div>
                      <div className="font-data text-xs font-semibold text-[var(--color-text-secondary)]">
                        {c.threshold_label}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--color-text-secondary)]">
                      Threshold value: <strong className="font-data">{c.threshold}</strong>
                    </span>
                    <ValidatedBadge validated={c.validated} />
                  </div>
                </div>
              ))}
            </div>

            {/* Honest provenance footer */}
            <div className="p-3 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
              <strong className="text-[var(--color-text-primary)]">Provenance:</strong> values are blended forecast
              outputs ({payload.data_mode}), not observations. Rainfall and wind checks are marked unvalidated — only
              temperature skill has been benchmarked against ERA5. Issued at {payload.evaluated_blend_time} (UTC).
            </div>
          </>
        )}
      </main>
    </div>
  );
}
