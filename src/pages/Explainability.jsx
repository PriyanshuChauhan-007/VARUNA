import { useStore } from '../store/useStore';
import { REGIONS, VARIABLES, getDeterministicForecast } from '../data/mockData.js';

export default function Explainability() {
  const selectedRegionId = useStore((s) => s.selectedRegionId);
  const selectRegion = useStore((s) => s.selectRegion);
  const selectedVariable = useStore((s) => s.selectedVariable);
  const setVariable = useStore((s) => s.setVariable);
  const selectedLeadTime = useStore((s) => s.selectedLeadTime);
  const setLeadTime = useStore((s) => s.setLeadTime);

  const forecast = getDeterministicForecast(selectedRegionId, selectedVariable, selectedLeadTime);
  const { region, models, whyThisBlend } = forecast;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-scale-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Explainability &amp; Adaptive Weighting Meta-Model
          </h1>
          <p className="mt-1 text-scale-sm text-[var(--color-text-secondary)]">
            Auditable mathematical rationale explaining why VARUNA weights specific model sources for each contextual regime
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
          Target Region:
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

      {/* Primary Question Callout: "Why This Blend?" */}
      <div className="p-6 bg-slate-950 text-slate-100 rounded-[var(--radius-xl)] border border-amber-500/40 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="text-scale-base font-bold text-amber-400 uppercase tracking-wider font-data">
              Operational Explainability Rationale
            </h2>
          </div>
          <span className="text-scale-xs font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-500/40">
            {whyThisBlend.backoffLevel}
          </span>
        </div>

        <p className="text-scale-base text-slate-200 leading-relaxed font-normal mb-4">
          {whyThisBlend.rationale}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-800 text-scale-xs font-data">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Weather Regime:</span>
            <strong className="text-slate-100">{region.regime}</strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Verification Window:</span>
            <strong className="text-slate-100">{whyThisBlend.verificationWindow}</strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">RMSE Improvement:</span>
            <strong className="text-amber-400">-{models.blend.rmseReductionPct}% vs single best member</strong>
          </div>
        </div>
      </div>

      {/* Step-by-Step Mathematical Workflow */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="p-5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold font-data text-xs flex items-center justify-center">
              1
            </span>
            <h3 className="text-scale-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
              Regime Classification
            </h3>
          </div>
          <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed mb-3">
            Inferred synoptic environment for <strong className="text-[var(--color-text-primary)]">{region.zone}</strong> is classified as <em>{region.regime}</em>. Machine learning models show significantly higher skill in resolving moist shear lines in this regime.
          </p>
          <div className="p-2.5 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)] text-[11px] font-data text-[var(--color-text-tertiary)]">
            Classifier: Spatial Gradient + RH850 + Jet Core Index
          </div>
        </div>

        <div className="p-5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-bold font-data text-xs flex items-center justify-center">
              2
            </span>
            <h3 className="text-scale-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
              Contextual Error Estimation
            </h3>
          </div>
          <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed mb-3">
            Across 14 rolling cycles, ECMWF AIFS registered an expected error of <strong className="text-purple-600 font-data">{models.aifs.rmse} {forecast.unit}</strong>, compared to <strong className="text-slate-600 font-data">{models.gfs.rmse}</strong> for GFS and <strong className="text-slate-600 font-data">{models.ifs.rmse}</strong> for IFS.
          </p>
          <div className="p-2.5 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)] text-[11px] font-data text-[var(--color-text-tertiary)]">
            Meta-model: XGBoost residual error regression &epsilon;&#770;_m
          </div>
        </div>

        <div className="p-5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-bold font-data text-xs flex items-center justify-center">
              3
            </span>
            <h3 className="text-scale-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
              Adaptive Weight Allocation
            </h3>
          </div>
          <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed mb-3">
            Weights are constrained to sum to 100%: <strong>AIFS: {models.aifs.weight}%</strong>, <strong>GFS: {models.gfs.weight}%</strong>, <strong>IFS: {models.ifs.weight}%</strong>{models.icon ? <>, <strong>ICON: {models.icon.weight}%</strong></> : null}, resulting in an optimal consensus forecast of <strong className="text-amber-700 dark:text-amber-400 font-data">{models.blend.value} {forecast.unit}</strong>.
          </p>
          <div className="p-2.5 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)] text-[11px] font-data text-emerald-600 font-semibold">
            Status: Nominal Convergence (Safety Level 0)
          </div>
        </div>
      </div>

      {/* Model-by-Model Rationale Cards */}
      <div className="space-y-3.5">
        <h3 className="text-scale-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
          Auditable Model Evidence Breakdown
        </h3>

        {whyThisBlend.factors.map((factor, idx) => (
          <div
            key={idx}
            className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-3">
              <span className="font-data text-scale-md font-bold text-amber-600 shrink-0">
                0{idx + 1}
              </span>
              <div>
                <h4 className="text-scale-xs font-bold text-[var(--color-text-primary)]">
                  {factor.name}
                </h4>
                <p className="text-scale-xs text-[var(--color-text-secondary)] mt-0.5">
                  {factor.note}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="font-data font-bold text-scale-sm text-[var(--color-text-primary)]">
                {factor.model}
              </span>
              <span className="block text-[10px] text-[var(--color-text-tertiary)] font-data">
                Weight Impact: {factor.weight}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
