import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { VARIABLES, MODELS, regimeName } from '../../data/referenceData.js';
import { entryAtLead, leadToHours, getForecast, getExplain } from '../../services/api';
import { useApi } from '../../services/useApi';
import { formatCoords, getModelColor } from '../../utils/formatters';
import { LoadingState, ErrorState } from './StatusStates';
import { DataModeBadge, ValidatedBadge } from './Badges';

const MEMBERS = MODELS.filter((m) => m.id !== 'blend');

export default function ForecastDetailDrawer() {
  const reduceMotion = useReducedMotion();
  const drawerOpen = useStore((s) => s.drawerOpen);
  const closeDrawer = useStore((s) => s.closeDrawer);
  const regions = useStore((s) => s.regions);
  const selectedRegionId = useStore((s) => s.selectedRegionId);
  const selectedVariable = useStore((s) => s.selectedVariable);
  const selectedLeadTime = useStore((s) => s.selectedLeadTime);
  const setLeadTime = useStore((s) => s.setLeadTime);

  const leadHours = leadToHours(selectedLeadTime);
  const region = regions.find((r) => r.id === selectedRegionId) || regions[0];
  const variableMeta = VARIABLES.find((v) => v.id === selectedVariable) || VARIABLES[0];

  const forecastQ = useApi(
    () => getForecast({ region: selectedRegionId, variable: selectedVariable, leadTimeHours: leadHours }),
    [selectedRegionId, selectedVariable, leadHours],
    { enabled: drawerOpen }
  );
  const explainQ = useApi(
    () => getExplain({ region: selectedRegionId, variable: selectedVariable, leadTimeHours: leadHours }),
    [selectedRegionId, selectedVariable, leadHours],
    { enabled: drawerOpen }
  );

  const forecast = forecastQ.data;
  const explain = explainQ.data;
  const entry = forecast ? entryAtLead(forecast.timeline, leadHours) : null;
  const unit = forecast?.unit || variableMeta.unit;
  const importances = (explain?.feature_importances || []).slice(0, 4);

  const rationale =
    explain?.reason ||
    (explain?.weighting_scheme === 'adaptive_xgboost'
      ? 'Weights ∝ 1/Ê² from the XGBoost meta-model, apportioned as integer percents summing to exactly 100.'
      : null);

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/25 z-40 backdrop-blur-[2px]"
            onClick={closeDrawer}
          />

          {/* Drawer container (440px width) */}
          <motion.aside
            initial={reduceMotion ? { opacity: 0 } : { x: '100%' }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 1 } : { x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 bottom-0 w-[450px] max-w-[95vw] bg-[var(--color-panel)] border-l border-[var(--color-border)] z-50 flex flex-col overflow-hidden shadow-2xl transition-colors"
          >
            {/* Header */}
            <div className="p-6 border-b border-[var(--color-border)] shrink-0 bg-[var(--color-panel)]">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-data text-scale-md font-bold text-[var(--color-text-primary)]">
                    {region?.name}
                  </span>
                  <DataModeBadge mode={forecast?.data_mode} />
                  {forecast && <ValidatedBadge validated={!!forecast.validated} />}
                </div>
                <button
                  onClick={closeDrawer}
                  className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-hover)] transition-colors text-[var(--color-text-secondary)]"
                  aria-label="Close details"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Location metadata */}
              <div className="text-scale-xs text-[var(--color-text-secondary)] flex items-center gap-2 mb-3">
                <span>{region?.zone}</span>
                <span>•</span>
                <span className="font-data">{formatCoords(region?.lat, region?.lng)}</span>
                <span>•</span>
                <span className="font-data">Elev: {region?.elevation}</span>
              </div>

              {/* Blend value + lead selector */}
              <div className="flex items-center justify-between p-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
                <div>
                  <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    VARUNA Blend ({selectedLeadTime}) · {variableMeta.label}
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="font-data text-3xl font-bold text-[var(--color-text-primary)]">
                      {entry?.blend ?? (forecastQ.loading ? '…' : '—')}
                    </span>
                    <span className="text-scale-sm font-semibold text-[var(--color-text-secondary)]">{unit}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-[var(--color-panel)] p-1 rounded-[var(--radius-md)] border border-[var(--color-border)]">
                  {['24h', '48h', '72h', '120h'].map((lt) => (
                    <button
                      key={lt}
                      onClick={() => setLeadTime(lt)}
                      className={`px-2 py-0.5 text-xs font-semibold rounded-[var(--radius-sm)] transition-colors ${
                        selectedLeadTime === lt
                          ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)] shadow-xs'
                          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      {lt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scheme line */}
              <div className="mt-2.5 flex items-center gap-1.5 text-scale-xs text-[var(--color-text-secondary)]">
                <span className="font-medium">
                  {forecast?.weighting_scheme || '—'}
                  {entry ? ` · ${entry.models_used}/4 members` : ''}
                  {entry?.degraded ? ' · degraded' : ''}
                </span>
                <span className="text-[var(--color-text-tertiary)] ml-auto font-data">
                  {forecast?.issued_at ? `issued ${forecast.issued_at.slice(11, 16)} UTC` : ''}
                </span>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {forecastQ.loading && <LoadingState label="Loading forecast…" />}
              {forecastQ.error && (
                <ErrorState error={forecastQ.error} onRetry={forecastQ.reload} label="Forecast unavailable" />
              )}

              {!forecastQ.loading && !forecastQ.error && forecast && (
                <>
                  {/* Adaptive Weighting Briefing */}
                  <div className="p-4 bg-slate-950 text-slate-100 rounded-[var(--radius-lg)] border border-amber-500/30 shadow-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                          Adaptive Weighting Briefing
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {explainQ.loading ? '…' : explain?.weighting_scheme || forecast.weighting_scheme}
                      </span>
                    </div>
                    <p className="text-scale-xs text-slate-300 leading-relaxed font-normal">
                      {explainQ.loading ? 'Loading weighting rationale…' : rationale || forecast.weighting_reason || 'Rationale unavailable.'}
                    </p>
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        Regime:{' '}
                        <strong className="text-slate-200">
                          {regimeName(entry?.regime_index) || forecast.regime?.name || '—'}
                        </strong>
                      </span>
                      <span className="font-mono text-amber-300 font-semibold">
                        weights sum {explain?.weights_sum ?? '—'}%
                      </span>
                    </div>
                  </div>

                  {/* Multi-Model Comparison Table */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h3 className="text-scale-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Model Consensus
                      </h3>
                      <span className="text-[11px] font-data text-[var(--color-text-tertiary)]">
                        {forecast.data_mode} · horizon ≤ 168 h
                      </span>
                    </div>

                    <div className="border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden bg-[var(--color-panel)]">
                      <table className="w-full text-left text-scale-xs">
                        <thead className="bg-[var(--color-surface)] border-b border-[var(--color-border)] text-[var(--color-text-tertiary)] font-bold text-[10px] uppercase tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3">Model</th>
                            <th className="py-2.5 px-2 text-right">Value</th>
                            <th className="py-2.5 px-2 text-right">Ê Error</th>
                            <th className="py-2.5 px-3 text-right">Weight</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border-subtle)] font-data">
                          {MEMBERS.map((m) => (
                            <tr key={m.id} className="hover:bg-[var(--color-surface)] transition-colors">
                              <td className="py-2.5 px-3 font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getModelColor(m.id) }} />
                                {m.name}
                              </td>
                              <td className="py-2.5 px-2 text-right font-medium">
                                {entry?.models?.[m.key] ?? '—'} {unit}
                              </td>
                              <td className="py-2.5 px-2 text-right text-slate-500">
                                {explain?.predicted_errors?.[m.key] ?? '—'}
                              </td>
                              <td
                                className="py-2.5 px-3 text-right font-bold"
                                style={{ color: getModelColor(m.id) }}
                              >
                                {entry?.weights?.[m.key] ?? '—'}%
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-[var(--color-accent-subtle)] font-bold text-[var(--color-text-primary)]">
                            <td className="py-2.5 px-3 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                              VARUNA BLEND
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              {entry?.blend ?? '—'} {unit}
                            </td>
                            <td className="py-2.5 px-2 text-right text-amber-700">—</td>
                            <td className="py-2.5 px-3 text-right text-amber-700">100%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Dynamic Adaptive Weight Bars */}
                  <div>
                    <h3 className="text-scale-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
                      Adaptive Weight Distribution
                    </h3>
                    <div className="space-y-3">
                      {MEMBERS.map((m) => (
                        <div key={m.id}>
                          <div className="flex justify-between text-scale-xs mb-1 font-medium">
                            <span className="flex items-center gap-1.5 text-[var(--color-text-primary)]">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getModelColor(m.id) }} />
                              {m.name} ({m.type})
                            </span>
                            <span className="font-data font-bold" style={{ color: getModelColor(m.id) }}>
                              {entry?.weights?.[m.key] ?? '—'}%
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-[var(--color-surface-muted)] rounded-full overflow-hidden border border-[var(--color-border)]">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${entry?.weights?.[m.key] || 0}%`,
                                backgroundColor: getModelColor(m.id),
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Feature importance (top 4) */}
                  <div>
                    <h3 className="text-scale-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
                      Top Meta-Model Inputs
                    </h3>
                    {explainQ.loading && <span className="text-[11px] text-[var(--color-text-tertiary)]">Loading…</span>}
                    {explainQ.error && (
                      <span className="text-[11px] text-[var(--color-text-tertiary)]">
                        Explanation unavailable: {explainQ.error.message}
                      </span>
                    )}
                    <div className="space-y-2.5">
                      {importances.map((f) => (
                        <div key={f.feature} className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-scale-xs font-bold text-[var(--color-text-primary)] font-data">
                              {f.feature}
                            </span>
                            <span className="text-[11px] font-semibold text-[var(--color-accent-hover)] font-data">
                              {(f.share * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-[var(--color-surface-muted)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${Math.min(100, f.share * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] shrink-0 flex items-center justify-between text-scale-xs text-[var(--color-text-secondary)]">
              <span className="font-data">{forecast?.attribution || 'Open-Meteo · ERA5 reference'}</span>
              <span className="font-semibold text-amber-700 dark:text-amber-400 font-data">
                {forecast?.data_mode || '—'}
              </span>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
