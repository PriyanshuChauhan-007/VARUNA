import { useStore } from '../store/useStore';
import { VARIABLES, MODELS, regimeName } from '../data/referenceData.js';
import { leadToHours, getExplain } from '../services/api';
import { useApi } from '../services/useApi';
import { LoadingState, ErrorState, EmptyState } from '../components/shared/StatusStates';
import { DataModeBadge, ValidatedBadge } from '../components/shared/Badges';

const MEMBERS = MODELS.filter((m) => m.id !== 'blend');

export default function Explainability() {
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

  const explainQ = useApi(
    () => getExplain({ region: selectedRegionId, variable: selectedVariable, leadTimeHours: leadHours }),
    [selectedRegionId, selectedVariable, leadHours]
  );
  const data = explainQ.data;

  const importances = data?.feature_importances || [];
  const topImportances = [...importances].sort((a, b) => b.share - a.share).slice(0, 8);
  const meta = data?.model_metadata;

  const rationale =
    data?.reason ||
    (data?.weighting_scheme === 'adaptive_xgboost'
      ? 'Weights are proportional to 1/Ê² where Ê is the XGBoost meta-model predicted error for each member, apportioned as integer percents (Hamilton-Hare) that sum to exactly 100.'
      : null);

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-scale-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
              Explainability &amp; Adaptive Weighting Meta-Model
            </h1>
            <DataModeBadge mode={data?.data_mode} />
            {data && <ValidatedBadge validated={!!data.validated} />}
          </div>
          <p className="mt-1 text-scale-sm text-[var(--color-text-secondary)]">
            Auditable inputs and outputs of the weighting decision for this region, variable and lead
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
          Target Region:
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

      {explainQ.loading && <LoadingState label="Loading weighting explanation…" />}
      {explainQ.error && <ErrorState error={explainQ.error} onRetry={explainQ.reload} label="Explanation unavailable" />}
      {!explainQ.loading && !explainQ.error && !data && (
        <EmptyState title="No explanation returned" message="The backend returned an empty payload." />
      )}

      {data && (
        <>
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
                {data.weighting_scheme}
              </span>
            </div>

            <p className="text-scale-base text-slate-200 leading-relaxed font-normal mb-4">
              {rationale || 'Weighting rationale unavailable for this selection.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-800 text-scale-xs font-data">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Classified Regime:</span>
                <strong className="text-slate-100">
                  {regimeName(data.regime?.index) || data.regime?.name || '—'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Weights Sum:</span>
                <strong className={data.weights_sum === 100 ? 'text-slate-100' : 'text-amber-400'}>
                  {data.weights_sum}%
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Validation Status:</span>
                <strong className={data.validated ? 'text-emerald-400' : 'text-amber-400'}>
                  {data.validated ? 'Validated (held-out)' : 'Unvalidated (Phase 4 pending)'}
                </strong>
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
                For <strong className="text-[var(--color-text-primary)]">{region?.zone}</strong> the fixed 6-class
                rule-based classifier returns{' '}
                <em className="text-[var(--color-text-primary)]">
                  {regimeName(data.regime?.index) || data.regime?.name || '—'}
                </em>{' '}
                (index {data.regime?.index ?? '—'}), computed from month, coordinates and ensemble values only.
              </p>
              <div className="p-2.5 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)] text-[11px] font-data text-[var(--color-text-tertiary)]">
                Classifier: documented rules (docs/REGIME_RULES.md) · no ERA5 inputs
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
                {data.predicted_errors ? (
                  <>
                    XGBoost predicts each member&apos;s absolute error Ê for these conditions:{' '}
                    {MEMBERS.map((m) => (
                      <span key={m.id} className="font-data">
                        {m.name.replace('ECMWF ', '').replace('NOAA ', '')}{' '}
                        <strong className="text-purple-600">{data.predicted_errors[m.key] ?? '—'}</strong>{' '}
                      </span>
                    ))}
                  </>
                ) : (
                  <>
                    No meta-model is trained for <strong>{variableMeta.label}</strong> yet, so predicted errors are not
                    available for this variable (equal fallback is used instead).
                  </>
                )}
              </p>
              <div className="p-2.5 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)] text-[11px] font-data text-[var(--color-text-tertiary)]">
                Meta-model: XGBoost regressor on |forecast − ERA5| · 80 trees, depth 4, lr 0.06
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
                Weights ∝ 1/Ê² (epsilon-floored) apportioned as integer percents that sum to{' '}
                <strong>{data.weights_sum}%</strong>:{' '}
                {MEMBERS.map((m) => (
                  <span key={m.id}>
                    <strong>
                      {m.name.replace('ECMWF ', '').replace('NOAA ', '')}: {data.weights?.[m.key] ?? '—'}%
                    </strong>{' '}
                  </span>
                ))}
              </p>
              <div className="p-2.5 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)] text-[11px] font-data text-emerald-600 font-semibold">
                Blend = Σ (w/100 × member forecast) · no renormalisation
              </div>
            </div>
          </div>

          {/* Model-by-model evidence */}
          <div className="space-y-3.5">
            <h3 className="text-scale-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
              Auditable Model Evidence
            </h3>

            {MEMBERS.map((m, idx) => (
              <div
                key={m.id}
                className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <span className="font-data text-scale-md font-bold text-amber-600 shrink-0">
                    0{idx + 1}
                  </span>
                  <div>
                    <h4 className="text-scale-xs font-bold text-[var(--color-text-primary)]">
                      {m.name} <span className="text-[var(--color-text-tertiary)] font-normal">({m.openMeteoId})</span>
                    </h4>
                    <p className="text-scale-xs text-[var(--color-text-secondary)] mt-0.5">
                      Own forecast {data.member_values?.[m.key] ?? '—'} {data.unit} · predicted error Ê{' '}
                      {data.predicted_errors?.[m.key] ?? 'not available'}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-data font-bold text-scale-sm text-[var(--color-text-primary)]">
                    {data.weights?.[m.key] ?? '—'}% weight
                  </span>
                  <span className="block text-[10px] text-[var(--color-text-tertiary)] font-data">
                    {data.weighting_scheme}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Feature importance */}
          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="text-scale-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                  Meta-Model Feature Importance
                </h3>
                <p className="text-scale-xs text-[var(--color-text-tertiary)] mt-0.5">
                  {data.model_available === false
                    ? 'Meta-model not trained yet.'
                    : 'Gain-based importance share reported by the trained XGBoost bundle'}
                </p>
              </div>
              {meta?.trained_at && (
                <span className="font-data text-[11px] text-[var(--color-text-secondary)]">
                  trained {meta.trained_at} · {meta.n_train_rows?.toLocaleString()} train rows
                </span>
              )}
            </div>

            {topImportances.length === 0 ? (
              <EmptyState title="Feature importances unavailable" message="Train the meta-model to populate this table." />
            ) : (
              <div className="space-y-2.5">
                {topImportances.map((f) => (
                  <div key={f.feature}>
                    <div className="flex justify-between text-scale-xs mb-1 font-semibold">
                      <span className="font-data text-[var(--color-text-primary)]">{f.feature}</span>
                      <span className="font-data text-[var(--color-text-secondary)]">
                        {(f.share * 100).toFixed(1)}% share · importance {f.importance}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-[var(--color-surface-muted)] rounded-full overflow-hidden border border-[var(--color-border)]">
                      <div
                        className="h-full rounded-full transition-all bg-amber-500"
                        style={{ width: `${Math.min(100, f.share * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {meta && (
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] grid grid-cols-2 sm:grid-cols-4 gap-3 font-data text-[11px]">
                <div>
                  <span className="text-[var(--color-text-tertiary)] block uppercase text-[10px]">Variable</span>
                  <strong className="text-[var(--color-text-primary)]">{meta.variable}</strong>
                </div>
                <div>
                  <span className="text-[var(--color-text-tertiary)] block uppercase text-[10px]">Features</span>
                  <strong className="text-[var(--color-text-primary)]">{meta.feature_names?.length ?? '—'} fixed</strong>
                </div>
                <div>
                  <span className="text-[var(--color-text-tertiary)] block uppercase text-[10px]">Trees / Depth</span>
                  <strong className="text-[var(--color-text-primary)]">
                    {meta.xgb_params?.n_estimators ?? '—'} / {meta.xgb_params?.max_depth ?? '—'}
                  </strong>
                </div>
                <div>
                  <span className="text-[var(--color-text-tertiary)] block uppercase text-[10px]">Learning Rate</span>
                  <strong className="text-[var(--color-text-primary)]">{meta.xgb_params?.learning_rate ?? '—'}</strong>
                </div>
              </div>
            )}
          </div>

          {data.attribution && (
            <p className="text-[10px] text-[var(--color-text-tertiary)] font-data">{data.attribution}</p>
          )}
        </>
      )}
    </div>
  );
}
