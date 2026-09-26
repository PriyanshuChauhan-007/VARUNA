import { useMemo } from 'react';
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

  const systemFeeds = useMemo(() => {
    return getSystemFeedsCatalog(effectiveMode);
  }, [effectiveMode]);

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-scale-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            System Status &amp; Ingestion Telemetry
          </h1>
          <p className="mt-0.5 text-scale-sm text-[var(--color-text-secondary)]">
            Operational status of ECMWF, NOAA, and IMD ingestion pipelines, AI inference clusters, and verification engines
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
              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
              : effectiveMode === 'REPLAY'
              ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300'
              : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
          }`}>
            {effectiveMode === 'LIVE'
              ? 'LIVE SYNC · CONNECTED'
              : effectiveMode === 'REPLAY'
              ? 'REPLAY MODE · 00Z'
              : syncStatus === 'FALLBACK_DEMO'
              ? 'DEMO MODE (LIVE STANDBY)'
              : 'DEMO MODE · 00Z'}
          </span>
        </div>
      </div>

      {/* Mode Fallback / Synchronization Notice */}
      {syncErrorNote && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-[var(--radius-lg)] text-scale-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>{syncErrorNote}</span>
          </span>
          <span className="font-mono text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">
            Fallback Policy (Section 12)
          </span>
        </div>
      )}

      {/* Top Grid: Ingestion Feeds Table + Engine Confidence */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Ingestion Feeds (Wide Table matching THERMOS Screenshot 7) */}
        <div className="xl:col-span-2 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-scale-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                NWP &amp; Observational Ingestion Telemetry
              </h2>
              <p className="text-scale-xs text-[var(--color-text-secondary)] mt-0.5">
                Multi-model pipelines feeding the VARUNA adaptive ensemble meta-model
              </p>
            </div>
            <span className="font-data text-scale-xs text-[var(--color-text-tertiary)]">
              Auto-refresh: 15s
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-scale-xs">
              <thead className="bg-[var(--color-surface)] border-b border-[var(--color-border)] text-[var(--color-text-tertiary)] font-bold text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Data Pipeline / Model</th>
                  <th className="py-2.5 px-3">Operational Cycle</th>
                  <th className="py-2.5 px-3">Spatial Res.</th>
                  <th className="py-2.5 px-3 text-right">Points Verified</th>
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
                      {feed.cycle}
                    </td>
                    <td className="py-3 px-3 text-[var(--color-text-secondary)]">
                      {feed.resolution}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-[var(--color-text-primary)]">
                      {feed.verificationPoints.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        feed.status === 'Live'
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border-emerald-300'
                          : feed.status === 'Integration Pending'
                          ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border-amber-300'
                          : feed.status === 'Demo Provider'
                          ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 border-blue-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${feed.status === 'Live' ? 'bg-emerald-500 animate-pulse' : feed.status === 'Integration Pending' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                        {feed.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Engine Kernel Health & Confidence (Matching THERMOS Right Box) */}
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-5 shadow-xs transition-colors flex flex-col justify-between">
          <div>
            <h2 className="text-scale-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)] mb-1">
              Adaptive Engine Status
            </h2>
            <p className="text-scale-xs text-[var(--color-text-secondary)] mb-4">
              Contextual XGBoost meta-model reliability and feature calibration
            </p>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-scale-xs font-semibold mb-1">
                  <span className="text-[var(--color-text-secondary)]">XGBoost Meta-Model Reliability</span>
                  <span className="font-data font-bold text-emerald-600">94.2%</span>
                </div>
                <div className="w-full h-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '94.2%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-scale-xs font-semibold mb-1">
                  <span className="text-[var(--color-text-secondary)]">Sub-Grid Terrain Downscaling</span>
                  <span className="font-data font-bold text-blue-600">96.8%</span>
                </div>
                <div className="w-full h-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '96.8%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-scale-xs font-semibold mb-1">
                  <span className="text-[var(--color-text-secondary)]">IMD Surface AWS Sensor Mesh</span>
                  <span className="font-data font-bold text-amber-600">Integration Pending</span>
                </div>
                <div className="w-full h-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: '0%' }} />
                </div>
              </div>

              <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)] space-y-1.5 font-data text-scale-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-tertiary)]">Blend Latency:</span>
                  <strong className="text-emerald-600">14.2 ms</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-tertiary)]">Backoff Safety Level:</span>
                  <strong className="text-[var(--color-text-primary)]">Level 0 (Nominal)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-tertiary)]">Active Ensemble:</span>
                  <strong className="text-[var(--color-text-primary)]">3 NWP/AI Members</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-tertiary)] font-data">
            Kernel: <code>VARUNA-XGBoost-v2.6</code>
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
            IMD AWS Integration Pending
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
                  {reg.stationsCount} Ref
                </span>
              </div>
              <h3 className="text-scale-xs font-bold text-[var(--color-text-primary)] group-hover:text-amber-600 transition-colors truncate">
                {reg.name}
              </h3>
              <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                {reg.zone}
              </p>
              <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)] text-[10px] font-data text-amber-700 dark:text-amber-400 font-semibold flex items-center justify-between">
                <span>● Demo Mode</span>
                <span>Elev {reg.elevation}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
