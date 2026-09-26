import { useState, useEffect, useMemo } from 'react';
import { REGIONS } from '../data/mockData.js';
import { useStore } from '../store/useStore';
import { getSystemFeedsCatalog } from '../providers/index.js';

export default function SystemHealth() {
  const systemMode = useStore((s) => s.systemMode);
  const effectiveMode = useStore((s) => s.effectiveMode);
  const syncStatus = useStore((s) => s.syncStatus);
  const syncErrorNote = useStore((s) => s.syncErrorNote);
  const setSystemMode = useStore((s) => s.setSystemMode);
  const selectRegion = useStore((s) => s.selectRegion);

  const [backendTelemetry, setBackendTelemetry] = useState(null);
  const [backendError, setBackendError] = useState(null);

  // In LIVE mode, query real backend provider telemetry
  useEffect(() => {
    let isMounted = true;
    if (effectiveMode === 'LIVE') {
      fetch('/api/providers/status')
        .then((res) => {
          if (!res.ok) throw new Error(`Backend returned HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (isMounted) {
            setBackendTelemetry(data);
            setBackendError(null);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setBackendTelemetry(null);
            setBackendError(err.message || 'Backend connection offline');
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [effectiveMode]);

  const systemFeeds = useMemo(() => {
    return getSystemFeedsCatalog(effectiveMode, backendTelemetry);
  }, [effectiveMode, backendTelemetry]);

  const engineInfo = backendTelemetry?.engine_status;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-scale-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            System Status &amp; Ingestion Telemetry
          </h1>
          <p className="mt-0.5 text-scale-sm text-[var(--color-text-secondary)]">
            Operational status of ECMWF, NOAA, DWD, and IMD ingestion pipelines, AI inference clusters, and verification engines
          </p>
        </div>

        {/* Live / Replay / Demo Mode Toggle & Status Indicator */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
          <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-1 text-scale-xs font-semibold shadow-xs">
            <button
              onClick={() => setSystemMode('LIVE')}
              className={`px-3 py-1 rounded-[var(--radius-sm)] transition-all cursor-pointer ${
                systemMode === 'LIVE'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              ● Operational Live
            </button>
            <button
              onClick={() => setSystemMode('REPLAY')}
              className={`px-3 py-1 rounded-[var(--radius-sm)] transition-all cursor-pointer ${
                systemMode === 'REPLAY'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Replay Archive
            </button>
            <button
              onClick={() => setSystemMode('DEMO')}
              className={`px-3 py-1 rounded-[var(--radius-sm)] transition-all cursor-pointer ${
                systemMode === 'DEMO'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Demo Sandbox
            </button>
          </div>

          <span className={`font-data text-scale-xs px-2.5 py-1 rounded-md border font-bold ${
            effectiveMode === 'LIVE'
              ? backendError
                ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
              : effectiveMode === 'REPLAY'
              ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300'
              : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
          }`}>
            {effectiveMode === 'LIVE'
              ? backendError
                ? 'LIVE MODE · BACKEND STANDBY'
                : 'LIVE SYNC · CONNECTED'
              : effectiveMode === 'REPLAY'
              ? 'REPLAY MODE · 21,042 VERIFIED RECORDS'
              : syncStatus === 'FALLBACK_DEMO'
              ? 'DEMO MODE (LIVE STANDBY)'
              : 'DEMO MODE · SIMULATION SANDBOX'}
          </span>
        </div>
      </div>

      {/* Mode Fallback / Synchronization Notice */}
      {effectiveMode === 'LIVE' && backendError && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-[var(--radius-lg)] text-scale-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Live backend server unavailable ({backendError}). Ingestion pipelines marked Unavailable; demo/fallback data isolated.</span>
          </span>
          <span className="font-mono text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">
            Fallback Standby
          </span>
        </div>
      )}

      {syncErrorNote && !backendError && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-[var(--radius-lg)] text-scale-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>{syncErrorNote}</span>
          </span>
          <span className="font-mono text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">
            System Notice
          </span>
        </div>
      )}

      {/* Top Grid: Ingestion Feeds Table + Engine Status */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Ingestion Feeds (Wide Table matching THERMOS Screenshot 7) */}
        <div className="xl:col-span-2 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-scale-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                NWP, AI &amp; Observational Ingestion Telemetry
              </h2>
              <p className="text-scale-xs text-[var(--color-text-secondary)] mt-0.5">
                Multi-model pipelines feeding the VARUNA adaptive ensemble meta-model
              </p>
            </div>
            <span className="font-data text-scale-xs text-[var(--color-text-tertiary)]">
              {effectiveMode === 'LIVE' ? (backendTelemetry ? 'Live Monitoring' : 'Live Gateway Standby') : effectiveMode === 'REPLAY' ? 'Empirical Benchmark' : 'Deterministic Sandbox'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-scale-xs">
              <thead className="bg-[var(--color-surface)] border-b border-[var(--color-border)] text-[var(--color-text-tertiary)] font-bold text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Data Pipeline / Model</th>
                  <th className="py-2.5 px-3">Operational Cycle</th>
                  <th className="py-2.5 px-3">Spatial Res.</th>
                  <th className="py-2.5 px-3 text-right">Verified Points</th>
                  <th className="py-2.5 px-3 text-right">Pipeline Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)] font-data">
                {systemFeeds.map((feed, i) => (
                  <tr key={i} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className="py-3 px-3 font-bold text-[var(--color-text-primary)]">
                      {feed.name}
                      <span className="block text-[10px] text-[var(--color-text-tertiary)] font-normal">
                        {feed.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[var(--color-text-secondary)]">
                      <div>{feed.cycle}</div>
                      {feed.lastSync && (
                        <div className="text-[10px] text-[var(--color-text-tertiary)] truncate max-w-[150px]">
                          Sync: {feed.lastSync}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[var(--color-text-secondary)]">
                      {feed.resolution}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-[var(--color-text-primary)]">
                      <div>{feed.verificationPoints.toLocaleString()}</div>
                      {feed.referenceRecords > 0 ? (
                        <div className="text-[10px] text-[var(--color-text-tertiary)]">
                          {feed.referenceRecords.toLocaleString()} Ref Obs
                        </div>
                      ) : feed.forecastRecords > 0 ? (
                        <div className="text-[10px] text-[var(--color-text-tertiary)]">
                          {feed.forecastRecords.toLocaleString()} Forecasts
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        feed.status === 'Live' || feed.status === 'ONLINE'
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border-emerald-300'
                          : feed.status === 'Integration Pending'
                          ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border-amber-300'
                          : feed.status === 'Demo Provider' || feed.status === 'Demo Reference'
                          ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 border-blue-300'
                          : feed.status === 'Replay Archive'
                          ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 border-indigo-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          feed.status === 'Live' || feed.status === 'ONLINE'
                            ? 'bg-emerald-500 animate-pulse'
                            : feed.status === 'Integration Pending'
                            ? 'bg-amber-500'
                            : feed.status === 'Replay Archive'
                            ? 'bg-indigo-500'
                            : 'bg-slate-400'
                        }`} />
                        {feed.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Engine Kernel Health & Factual State (Matching THERMOS Right Box) */}
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-5 shadow-xs transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-scale-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                Adaptive Engine State
              </h2>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                effectiveMode === 'DEMO'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              }`}>
                {effectiveMode === 'DEMO' ? 'DEMO MODE' : 'VERIFIED BASELINE'}
              </span>
            </div>
            <p className="text-scale-xs text-[var(--color-text-secondary)] mb-4">
              Contextual XGBoost meta-model status and empirical evaluation boundaries
            </p>

            <div className="space-y-3 font-data text-scale-xs">
              <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-text-secondary)]">XGBoost Meta-Model:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {engineInfo?.xgboost_model_status || 'LOADED'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-text-secondary)]">Model Version:</span>
                  <span className="font-bold text-[var(--color-text-primary)]">
                    {engineInfo?.model_version || 'v3.4 (Multi-Season & Lead-Aware)'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-text-secondary)]">Training Dataset Size:</span>
                  <span className="font-bold text-[var(--color-text-primary)]">
                    {(engineInfo?.training_dataset_size || 13170).toLocaleString()} samples (65%)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-text-secondary)]">Validation Partition:</span>
                  <span className="font-bold text-[var(--color-text-primary)]">
                    {(engineInfo?.validation_dataset_size || 3360).toLocaleString()} samples (15%)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-text-secondary)]">Held-Out Test Partition:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {(engineInfo?.test_dataset_size || 4512).toLocaleString()} samples (20%)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-text-secondary)]">Total Aligned Rows:</span>
                  <span className="font-bold text-[var(--color-text-primary)]">
                    {(engineInfo?.total_aligned_records || 21042).toLocaleString()} (84,168 evaluations)
                  </span>
                </div>
              </div>

              <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-tertiary)]">Active Variable:</span>
                  <strong className="text-[var(--color-text-primary)]">Temperature at 2m (Validated)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-tertiary)]">Active Horizons:</span>
                  <strong className="text-[var(--color-text-primary)]">24h, 48h, 72h, 120h</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-tertiary)]">Held-Out Test RMSE:</span>
                  <strong className="text-emerald-600">0.8674 °C (18.3% over IFS)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-tertiary)]">Held-Out Test MAE:</span>
                  <strong className="text-emerald-600">0.6539 °C (r = 0.9837)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-tertiary)]">Active Ensemble:</span>
                  <strong className="text-[var(--color-text-primary)]">4 Forecast Members</strong>
                </div>
                <div className="pt-1 text-[11px] text-[var(--color-text-secondary)] border-t border-[var(--color-border-subtle)]">
                  <span>ECMWF IFS · ECMWF AIFS · NOAA GFS · DWD ICON</span>
                </div>
              </div>

              <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-[var(--radius-md)] text-[11px] text-amber-800 dark:text-amber-300">
                <strong>Scientific Boundary:</strong> Temperature is fully backtested across 4 seasons/leads. Rainfall &amp; wind use operational IMD threshold consensus.
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-tertiary)] font-data flex justify-between items-center">
            <span>Kernel: <code>VARUNA-XGBoost-v3.4</code></span>
            <span>Ref: <code>ERA5 Reanalysis</code></span>
          </div>
        </div>
      </div>

      {/* Regional Observation Clusters (Matching THERMOS Industrial Cluster Cards) */}
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-5 shadow-xs transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-scale-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
              Agro-Climatic Operational Clusters
            </h2>
            <p className="text-scale-xs text-[var(--color-text-secondary)] mt-0.5">
              Regional meteorological zones actively monitored with synchronized telemetry
            </p>
          </div>
          <span className="font-data text-scale-xs text-[var(--color-text-tertiary)]">
            IMD AWS — Integration Pending (No verified station observations connected)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {REGIONS.slice(0, 5).map((reg) => (
            <div
              key={reg.id}
              onClick={() => selectRegion(reg.id)}
              className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-amber-400 rounded-[var(--radius-lg)] transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase font-data">
                  {reg.state}
                </span>
                <span className="font-data text-xs font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {reg.stationsCount} Grid Ref
                </span>
              </div>
              <h3 className="text-scale-xs font-bold text-[var(--color-text-primary)] group-hover:text-amber-600 transition-colors truncate">
                {reg.name}
              </h3>
              <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                {reg.zone}
              </p>
              <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)] text-[10px] font-data text-amber-700 dark:text-amber-400 font-semibold flex items-center justify-between">
                <span>
                  {effectiveMode === 'LIVE'
                    ? '● Live Gateway'
                    : effectiveMode === 'REPLAY'
                    ? '● Replay Archive'
                    : '● Demo Sandbox'}
                </span>
                <span>Elev {reg.elevation}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
