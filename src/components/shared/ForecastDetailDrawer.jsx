import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { formatCoords, getRiskColor } from '../../utils/formatters';

export default function ForecastDetailDrawer() {
  const reduceMotion = useReducedMotion();
  const drawerOpen = useStore((s) => s.drawerOpen);
  const closeDrawer = useStore((s) => s.closeDrawer);
  const getCurrentForecast = useStore((s) => s.getCurrentForecast);
  const selectedLeadTime = useStore((s) => s.selectedLeadTime);
  const setLeadTime = useStore((s) => s.setLeadTime);

  const forecast = getCurrentForecast();
  if (!forecast) return null;

  const { region, variable, models, whyThisBlend, alertLevel, alertReason, blendConfidence } = forecast;

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

          {/* Drawer container (440px width matching VARUNA) */}
          <motion.aside
            initial={reduceMotion ? { opacity: 0 } : { x: '100%' }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 1 } : { x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 bottom-0 w-[450px] max-w-[95vw] bg-[var(--varuna-surface)] border-l border-[var(--varuna-border)] z-50 flex flex-col overflow-hidden shadow-2xl transition-colors text-[var(--varuna-text)]"
          >
            {/* Header */}
            <div className="p-6 border-b border-[var(--varuna-border)] shrink-0 bg-[var(--varuna-surface)]">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-data text-scale-md font-bold text-[var(--varuna-text)]">
                    {region.name}
                  </span>
                  <span
                    className="px-2.5 py-0.5 text-scale-xs font-bold rounded-full text-white font-data"
                    style={{ backgroundColor: getRiskColor(alertLevel) }}
                  >
                    {alertLevel.toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={closeDrawer}
                  className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--varuna-surface-soft)] transition-colors text-[var(--varuna-text-secondary)] hover:text-[var(--varuna-text)] cursor-pointer"
                  aria-label="Close details"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Location metadata */}
              <div className="text-scale-xs text-[var(--varuna-text-secondary)] flex items-center gap-2 mb-3">
                <span>{region.zone}</span>
                <span>•</span>
                <span className="font-data">{formatCoords(region.lat, region.lng)}</span>
                <span>•</span>
                <span className="font-data">Elev: {region.elevation}</span>
              </div>

              {/* Operational Blend Value & Lead Time Badges */}
              <div className="flex items-center justify-between p-3.5 bg-[var(--varuna-surface-soft)] border border-[var(--varuna-border)] rounded-[var(--radius-lg)]">
                <div>
                  <div className="text-[11px] font-bold text-[var(--varuna-text-muted)] uppercase tracking-wider font-data">
                    VARUNA Blend ({selectedLeadTime}) • Init: {forecast.initializationTime ? forecast.initializationTime.slice(0, 10) : '2026-09-26'} 00z • Valid: {forecast.validTime.slice(0, 10)} {forecast.validTime.slice(11, 16)} UTC
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="font-data text-3xl font-bold text-[var(--varuna-blue-dark)]">
                      {models.blend.value}
                    </span>
                    <span className="text-scale-sm font-semibold text-[var(--varuna-text-secondary)]">
                      {forecast.unit} {variable.label}
                    </span>
                  </div>
                </div>

                {/* Lead time pill selector */}
                <div className="flex items-center gap-1 bg-[var(--varuna-surface)] p-1 rounded-[var(--radius-md)] border border-[var(--varuna-border)] font-data">
                  {['24h', '48h', '72h', '120h'].map((lt) => (
                    <button
                      key={lt}
                      onClick={() => setLeadTime(lt)}
                      className={`px-2 py-0.5 text-xs font-semibold rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
                        selectedLeadTime === lt
                          ? 'bg-[var(--varuna-blue)] text-white shadow-xs font-bold'
                          : 'text-[var(--varuna-text-secondary)] hover:text-[var(--varuna-text)] hover:bg-[var(--varuna-surface-soft)]'
                      }`}
                    >
                      {lt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Operational Alert Reason */}
              <div className="mt-2.5 flex items-center gap-1.5 text-scale-xs text-[var(--varuna-text-secondary)]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getRiskColor(alertLevel) }} />
                <span className="font-medium">{alertReason}</span>
                <span className="text-[var(--varuna-text-muted)] ml-auto font-data">
                  Confidence: {blendConfidence}%
                </span>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Tactical AI Situational Briefing Box */}
              <div className="p-4 bg-[var(--varuna-blue-light)] text-[var(--varuna-text)] rounded-[var(--radius-lg)] border border-[var(--varuna-border)] shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--varuna-blue)] animate-pulse" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--varuna-blue-dark)] font-data">
                      Adaptive Weighting Briefing
                    </h3>
                  </div>
                  <span className="text-[10px] font-data text-[var(--varuna-text-secondary)] bg-[var(--varuna-surface)] px-2 py-0.5 rounded border border-[var(--varuna-border)]">
                    {whyThisBlend.backoffLevel.split('—')[0]}
                  </span>
                </div>
                <p className="text-scale-xs text-[var(--varuna-text)] leading-relaxed font-normal">
                  {whyThisBlend.rationale}
                </p>
                <div className="mt-3 pt-2.5 border-t border-[var(--varuna-border)] flex items-center justify-between text-[11px] text-[var(--varuna-text-secondary)]">
                  <span>Regime: <strong className="text-[var(--varuna-text)]">{region.regime}</strong></span>
                  <span className="font-data text-[var(--varuna-blue-dark)] font-bold">
                    -{models.blend.rmseReductionPct}% Error Reduction
                  </span>
                </div>
              </div>

              {/* Multi-Model Comparison Table */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-scale-xs font-bold uppercase tracking-wider text-[var(--varuna-text-secondary)] font-data">
                    Model Consensus &amp; Verification
                  </h3>
                  <span className="text-[11px] font-data text-[var(--varuna-text-muted)]">
                    N={models.blend.sampleCount} Reference Grid Points
                  </span>
                </div>

                <div className="border border-[var(--varuna-border)] rounded-[var(--radius-lg)] overflow-hidden bg-[var(--varuna-surface)]">
                  <table className="w-full text-left text-scale-xs">
                    <thead className="bg-[var(--varuna-surface-soft)] border-b border-[var(--varuna-border)] text-[var(--varuna-text-muted)] font-bold text-[10px] uppercase tracking-wider font-data">
                      <tr>
                        <th className="py-2.5 px-3">Model</th>
                        <th className="py-2.5 px-2 text-right">Value</th>
                        <th className="py-2.5 px-2 text-right">RMSE</th>
                        <th className="py-2.5 px-2 text-right">Bias</th>
                        <th className="py-2.5 px-3 text-right">Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--varuna-border)] font-data">
                      {/* IFS */}
                      <tr className="hover:bg-[var(--varuna-surface-soft)] transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-[var(--varuna-text)] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#1E40AF' }} />
                          ECMWF IFS
                        </td>
                        <td className="py-2.5 px-2 text-right font-medium">{models.ifs.value} {forecast.unit}</td>
                        <td className="py-2.5 px-2 text-right text-[var(--varuna-text-secondary)]">{models.ifs.rmse}</td>
                        <td className="py-2.5 px-2 text-right text-[var(--varuna-text-secondary)]">{models.ifs.bias > 0 ? `+${models.ifs.bias}` : models.ifs.bias}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-700 dark:text-blue-400">{models.ifs.weight}%</td>
                      </tr>
                      {/* AIFS */}
                      <tr className="hover:bg-[var(--varuna-surface-soft)] transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-[var(--varuna-text)] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0284C7' }} />
                          ECMWF AIFS
                        </td>
                        <td className="py-2.5 px-2 text-right font-medium">{models.aifs.value} {forecast.unit}</td>
                        <td className="py-2.5 px-2 text-right font-semibold text-sky-700 dark:text-sky-400">{models.aifs.rmse}</td>
                        <td className="py-2.5 px-2 text-right text-[var(--varuna-text-secondary)]">{models.aifs.bias > 0 ? `+${models.aifs.bias}` : models.aifs.bias}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-sky-700 dark:text-sky-400">{models.aifs.weight}%</td>
                      </tr>
                      {/* GFS */}
                      <tr className="hover:bg-[var(--varuna-surface-soft)] transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-[var(--varuna-text)] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0D9488' }} />
                          NOAA GFS
                        </td>
                        <td className="py-2.5 px-2 text-right font-medium">{models.gfs.value} {forecast.unit}</td>
                        <td className="py-2.5 px-2 text-right text-[var(--varuna-text-secondary)]">{models.gfs.rmse}</td>
                        <td className="py-2.5 px-2 text-right text-[var(--varuna-text-secondary)]">{models.gfs.bias > 0 ? `+${models.gfs.bias}` : models.gfs.bias}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-teal-700 dark:text-teal-400">{models.gfs.weight}%</td>
                      </tr>
                      {/* VARUNA BLEND */}
                      <tr className="bg-[var(--varuna-blue-light)] font-bold text-[var(--varuna-text)]">
                        <td className="py-2.5 px-3 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[var(--varuna-blue)]" />
                          VARUNA BLEND
                        </td>
                        <td className="py-2.5 px-2 text-right text-[var(--varuna-blue-dark)]">{models.blend.value} {forecast.unit}</td>
                        <td className="py-2.5 px-2 text-right text-emerald-700 dark:text-emerald-400">{models.blend.rmse}</td>
                        <td className="py-2.5 px-2 text-right text-emerald-700 dark:text-emerald-400">{models.blend.bias > 0 ? `+${models.blend.bias}` : models.blend.bias}</td>
                        <td className="py-2.5 px-3 text-right text-[var(--varuna-blue-dark)]">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dynamic Adaptive Weight Bars */}
              <div>
                <h3 className="text-scale-xs font-bold uppercase tracking-wider text-[var(--varuna-text-secondary)] mb-3 font-data">
                  Dynamic Adaptive Weight Distribution (XGBoost Meta-Model)
                </h3>
                <div className="space-y-3 font-data">
                  {/* AIFS Bar */}
                  <div>
                    <div className="flex justify-between text-scale-xs mb-1 font-medium">
                      <span className="flex items-center gap-1.5 text-[var(--varuna-text)]">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0284C7' }} />
                        ECMWF AIFS (Deep Learning)
                      </span>
                      <span className="font-bold text-sky-700 dark:text-sky-400">{models.aifs.weight}%</span>
                    </div>
                    <div className="w-full h-2 bg-[var(--varuna-border)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${models.aifs.weight}%`, backgroundColor: '#0284C7' }}
                      />
                    </div>
                  </div>

                  {/* GFS Bar */}
                  <div>
                    <div className="flex justify-between text-scale-xs mb-1 font-medium">
                      <span className="flex items-center gap-1.5 text-[var(--varuna-text)]">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0D9488' }} />
                        NOAA GFS (Operational NWP)
                      </span>
                      <span className="font-bold text-teal-700 dark:text-teal-400">{models.gfs.weight}%</span>
                    </div>
                    <div className="w-full h-2 bg-[var(--varuna-border)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${models.gfs.weight}%`, backgroundColor: '#0D9488' }}
                      />
                    </div>
                  </div>

                  {/* IFS Bar */}
                  <div>
                    <div className="flex justify-between text-scale-xs mb-1 font-medium">
                      <span className="flex items-center gap-1.5 text-[var(--varuna-text)]">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#1E40AF' }} />
                        ECMWF IFS (Physical NWP Anchor)
                      </span>
                      <span className="font-bold text-blue-700 dark:text-blue-400">{models.ifs.weight}%</span>
                    </div>
                    <div className="w-full h-2 bg-[var(--varuna-border)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${models.ifs.weight}%`, backgroundColor: '#1E40AF' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Auditable Decision Evidence Factors */}
              <div>
                <h3 className="text-scale-xs font-bold uppercase tracking-wider text-[var(--varuna-text-secondary)] mb-3 font-data">
                  Auditable Decision Factors
                </h3>
                <div className="space-y-2.5">
                  {whyThisBlend.factors.map((f, i) => (
                    <div
                      key={i}
                      className="p-3 bg-[var(--varuna-surface-soft)] border border-[var(--varuna-border)] rounded-[var(--radius-md)]"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-scale-xs font-bold text-[var(--varuna-text)]">
                          {f.name}
                        </span>
                        <span className="text-[11px] font-semibold text-[var(--varuna-blue)] font-data">
                          {f.model}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--varuna-text-secondary)] leading-snug">
                        {f.note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--varuna-border)] bg-[var(--varuna-surface-soft)] shrink-0 flex items-center justify-between text-scale-xs text-[var(--varuna-text-secondary)]">
              <span className="font-data">{whyThisBlend.verificationWindow}</span>
              <span className="font-semibold text-[var(--varuna-blue-dark)] font-data">REFERENCE · 00Z RUN</span>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
