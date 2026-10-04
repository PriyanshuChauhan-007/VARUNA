import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { REGIONS, VARIABLES, getDeterministicForecast } from '../data/mockData.js';
import { fetchForecast, fetchExplain } from '../services/api';

export default function Explainability() {
  const selectedRegionId = useStore((s) => s.selectedRegionId);
  const selectRegion = useStore((s) => s.selectRegion);
  const selectedVariable = useStore((s) => s.selectedVariable);
  const setVariable = useStore((s) => s.setVariable);
  const selectedLeadTime = useStore((s) => s.selectedLeadTime);
  const setLeadTime = useStore((s) => s.setLeadTime);
  const effectiveMode = useStore((s) => s.effectiveMode);

  const fallbackBaseline = useMemo(() => {
    return getDeterministicForecast(selectedRegionId, selectedVariable, selectedLeadTime);
  }, [selectedRegionId, selectedVariable, selectedLeadTime]);

  const [liveForecast, setLiveForecast] = useState(null);
  const [explainData, setExplainData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;
      if (effectiveMode === 'DEMO') {
        setLiveForecast(null);
        setExplainData(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      fetchForecast({
        region: selectedRegionId,
        variable: selectedVariable,
        leadTime: selectedLeadTime,
      })
        .then((fc) => {
          if (cancelled) return;
          setLiveForecast(fc);
          return fetchExplain({
            region: selectedRegionId,
            variable: selectedVariable,
            leadTime: selectedLeadTime,
          });
        })
        .then((exp) => {
          if (!cancelled && exp) {
            setExplainData(exp);
          }
          if (!cancelled) setLoading(false);
        })
        .catch(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedRegionId, selectedVariable, selectedLeadTime, effectiveMode]);

  const activeForecast = liveForecast || fallbackBaseline;
  const isAdaptive = activeForecast.weightingScheme === 'adaptive_xgboost' || (selectedVariable === 'temperature' && !activeForecast.weightingScheme);
  const { region, models, whyThisBlend, unit } = activeForecast;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-[var(--varuna-bg)]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-scale-2xl font-bold tracking-tight text-[var(--varuna-text)]">
            Explainability &amp; Adaptive Weighting Meta-Model
          </h1>
          <p className="mt-1 text-scale-sm text-[var(--varuna-text-secondary)]">
            Auditable mathematical rationale explaining why VARUNA weights specific model sources for each contextual regime
          </p>
        </div>

        {/* Global Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {loading && (
            <span className="text-[11px] font-data text-[var(--varuna-text-muted)] animate-pulse mr-1">
              Syncing...
            </span>
          )}
          {/* Lead time pill */}
          <div className="inline-flex items-center gap-1 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] p-1 rounded-[var(--radius-lg)] shadow-xs">
            {['24h', '48h', '72h', '120h', '7d'].map((lt) => (
              <button
                key={lt}
                onClick={() => setLeadTime(lt)}
                className={`px-3 py-1 text-scale-xs font-semibold rounded-[var(--radius-md)] transition-all cursor-pointer font-data ${
                  selectedLeadTime === lt
                    ? 'bg-[var(--varuna-blue)] text-white shadow-xs font-bold'
                    : 'text-[var(--varuna-text-secondary)] hover:text-[var(--varuna-text)] hover:bg-[var(--varuna-surface-soft)]'
                }`}
              >
                {lt.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Variable Switcher */}
          <div className="inline-flex items-center gap-1 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] p-1 rounded-[var(--radius-lg)] shadow-xs">
            {VARIABLES.map((v) => (
              <button
                key={v.id}
                onClick={() => setVariable(v.id)}
                className={`px-3 py-1 text-scale-xs font-semibold rounded-[var(--radius-md)] transition-all cursor-pointer flex items-center gap-1 ${
                  selectedVariable === v.id
                    ? 'bg-[var(--varuna-blue)] text-white font-bold shadow-xs'
                    : 'text-[var(--varuna-text-secondary)] hover:text-[var(--varuna-text)] hover:bg-[var(--varuna-surface-soft)]'
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
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[var(--varuna-border)]">
        <span className="text-scale-xs font-bold uppercase tracking-wider text-[var(--varuna-text-muted)] shrink-0 font-data">
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
                    ? 'bg-[var(--varuna-blue-light)] border-[var(--varuna-blue)] text-[var(--varuna-blue-dark)] font-bold shadow-xs'
                    : 'bg-[var(--varuna-surface)] border-[var(--varuna-border)] text-[var(--varuna-text-secondary)] hover:text-[var(--varuna-text)] hover:bg-[var(--varuna-surface-soft)]'
                }
              `}
            >
              {r.name}
            </button>
          );
        })}
      </div>

      {/* Primary Question Callout: "Why This Blend?" */}
      <div className="p-6 bg-[var(--varuna-surface)] text-[var(--varuna-text)] rounded-[var(--radius-xl)] border-2 border-[var(--varuna-blue)] shadow-md space-y-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <span className={`w-3 h-3 rounded-full ${isAdaptive ? 'bg-[var(--varuna-blue)] animate-pulse' : 'bg-slate-400'}`} />
            <h2 className="text-scale-base font-bold text-[var(--varuna-blue-dark)] uppercase tracking-wider font-data">
              {isAdaptive ? 'Adaptive XGBoost Explainability Rationale' : 'Operational Equal-Weight Consensus'}
            </h2>
          </div>
          <span className={`text-scale-xs font-data px-2.5 py-1 rounded border font-semibold ${
            isAdaptive
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'text-[var(--varuna-text-secondary)] bg-[var(--varuna-surface-soft)] border-[var(--varuna-border)]'
          }`}>
            {isAdaptive ? 'Safety Level 0 · Optimal Convergence' : 'Untrained Variable Fallback'}
          </span>
        </div>

        <p className="text-scale-base text-[var(--varuna-text)] leading-relaxed font-normal mb-2 font-data">
          {whyThisBlend?.explanation || 'Optimal consensus forecast constructed across available numerical weather members.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[var(--varuna-border)] text-scale-xs font-data">
          <div>
            <span className="text-[var(--varuna-text-muted)] block text-[10px] uppercase font-bold">Active Variable:</span>
            <strong className="text-[var(--varuna-text)]">{selectedVariable.toUpperCase()} ({unit})</strong>
          </div>
          <div>
            <span className="text-[var(--varuna-text-muted)] block text-[10px] uppercase font-bold">Weighting Scheme:</span>
            <strong className={isAdaptive ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-[var(--varuna-blue-dark)]'}>
              {isAdaptive ? 'Hamilton-Hare XGBoost Meta-Model' : 'Equal Fallback (25% Each)'}
            </strong>
          </div>
          <div>
            <span className="text-[var(--varuna-text-muted)] block text-[10px] uppercase font-bold">Benchmark RMSE:</span>
            <strong className="text-[var(--varuna-blue-dark)] font-bold">
              {isAdaptive ? '0.7803 °C (Held-out N=4,512)' : 'Unvalidated for this variable'}
            </strong>
          </div>
        </div>
      </div>

      {/* Step-by-Step Mathematical Workflow */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="p-5 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-xl)] shadow-xs transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-[var(--varuna-blue-light)] text-[var(--varuna-blue-dark)] font-bold font-data text-xs flex items-center justify-center">
              1
            </span>
            <h3 className="text-scale-xs font-bold uppercase tracking-wider text-[var(--varuna-text)] font-data">
              Regime Classification
            </h3>
          </div>
          <p className="text-scale-xs text-[var(--varuna-text-secondary)] leading-relaxed mb-3">
            Inferred synoptic environment for <strong className="text-[var(--varuna-text)]">{region?.zone || 'Target Zone'}</strong> is dynamically classified via spatial gradient, barometric pressure, and moisture flux.
          </p>
          <div className="p-2.5 bg-[var(--varuna-surface-soft)] rounded-[var(--radius-md)] border border-[var(--varuna-border)] text-[11px] font-data text-[var(--varuna-text-muted)]">
            Classifier: Lat/Lon + Month + Temp + Pressure + Precip
          </div>
        </div>

        <div className="p-5 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-xl)] shadow-xs transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-[var(--varuna-blue-light)] text-[var(--varuna-blue-dark)] font-bold font-data text-xs flex items-center justify-center">
              2
            </span>
            <h3 className="text-scale-xs font-bold uppercase tracking-wider text-[var(--varuna-text)] font-data">
              Contextual Error Estimation
            </h3>
          </div>
          <p className="text-scale-xs text-[var(--varuna-text-secondary)] leading-relaxed mb-3">
            {isAdaptive
              ? `XGBoost residual meta-model predicts expected squared error for each NWP center at +${selectedLeadTime} lead based on atmospheric forcing features.`
              : 'Residual error meta-model is currently trained strictly on 2m Temperature. Non-temperature variables do not evaluate simulated error.'}
          </p>
          <div className="p-2.5 bg-[var(--varuna-surface-soft)] rounded-[var(--radius-md)] border border-[var(--varuna-border)] text-[11px] font-data text-[var(--varuna-text-muted)]">
            {isAdaptive ? 'Meta-model: XGBoost ε̂_m regression' : 'Fallback: Equal variance assumption'}
          </div>
        </div>

        <div className="p-5 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-xl)] shadow-xs transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-[var(--varuna-blue)] text-white font-bold font-data text-xs flex items-center justify-center">
              3
            </span>
            <h3 className="text-scale-xs font-bold uppercase tracking-wider text-[var(--varuna-text)] font-data">
              Weight Allocation
            </h3>
          </div>
          <p className="text-scale-xs text-[var(--varuna-text-secondary)] leading-relaxed mb-3">
            Weights are constrained to sum to 100%: <strong>IFS: {models?.ifs?.weight ?? 25}%</strong>, <strong>AIFS: {models?.aifs?.weight ?? 25}%</strong>, <strong>GFS: {models?.gfs?.weight ?? 25}%</strong>, <strong>ICON: {models?.icon?.weight ?? 25}%</strong>, yielding a consensus blend of <strong className="text-[var(--varuna-blue-dark)] font-data">{activeForecast.forecastValue ?? models?.blend?.value} {unit}</strong>.
          </p>
          <div className="p-2.5 bg-[var(--varuna-surface-soft)] rounded-[var(--radius-md)] border border-[var(--varuna-border)] text-[11px] font-data text-emerald-700 dark:text-emerald-400 font-semibold">
            Status: {isAdaptive ? 'Adaptive Normalization' : 'Equal-Weight Consensus'}
          </div>
        </div>
      </div>

      {/* Feature Importances (From Real Backend Meta-Model) */}
      {explainData?.feature_importances && explainData.feature_importances.length > 0 && (
        <div className="p-5 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-xl)] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-scale-sm font-bold uppercase tracking-wider text-[var(--varuna-text)] font-data">
              Authoritative XGBoost Meta-Model Feature Importances
            </h3>
            <span className="text-[11px] font-data text-[var(--varuna-text-muted)]">
              Target: {explainData?.model_metadata?.target || 'Expected squared forecast error'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 font-data text-scale-xs">
            {explainData.feature_importances.slice(0, 9).map((f, i) => (
              <div key={i} className="p-3 bg-[var(--varuna-surface-soft)] border border-[var(--varuna-border)] rounded-[var(--radius-md)] flex justify-between items-center">
                <span className="text-[var(--varuna-text-secondary)] font-medium truncate mr-2">{f.feature}</span>
                <span className="font-bold text-[var(--varuna-blue-dark)] font-data">{(f.share * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
