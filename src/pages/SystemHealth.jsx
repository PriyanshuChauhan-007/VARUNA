import { useStore } from '../store/useStore';
import { getHealth, getProvidersStatus } from '../services/api';
import { useApi } from '../services/useApi';
import { LoadingState, ErrorState } from '../components/shared/StatusStates';
import { DataModeBadge } from '../components/shared/Badges';

const PROVIDER_LABELS = {
  open_meteo_forecast: { name: 'Open-Meteo Forecast API', type: 'Live NWP member forecasts (IFS, AIFS, GFS, ICON)', cycle: 'Hourly rolling' },
  open_meteo_previous_runs: { name: 'Open-Meteo Previous Runs API', type: 'Archived forecast vintages (lead-time verification)', cycle: 'previous_day1/2/3/5' },
  open_meteo_archive_era5: { name: 'Open-Meteo Archive API (ERA5)', type: 'Reanalysis reference for verification', cycle: 'Reanalysis' },
};

const ARTIFACT_LABELS = {
  provenance_json: 'Data provenance record',
  blend_test_results_csv: 'Held-out skill table',
  aligned_csv: 'Aligned multi-season dataset',
  meta_model_joblib: 'Trained XGBoost meta-model',
  replay_timelines_json: 'Replay archive timelines',
  feature_importance_png: 'Feature importance report',
  adaptive_weights_csv: 'Per-group adaptive weights',
};

export default function SystemHealth() {
  const regions = useStore((s) => s.regions);
  const dataMode = useStore((s) => s.dataMode);
  const attribution = useStore((s) => s.attribution);
  const selectRegion = useStore((s) => s.selectRegion);
  const loadRegions = useStore((s) => s.loadRegions);

  const healthQ = useApi(() => getHealth(), []);
  const providersQ = useApi(() => getProvidersStatus(), []);

  const health = healthQ.data;
  const providers = providersQ.data;
  const probes = providers?.providers || {};
  const artifacts = providers?.artifacts || {};
  const provenance = providers?.provenance || null;

  const artifactEntries = Object.entries(ARTIFACT_LABELS);
  const artifactsReady = artifactEntries.filter(([k]) => artifacts[k]).length;
  const probeEntries = Object.entries(PROVIDER_LABELS).map(([key, label]) => ({
    key,
    ...label,
    probe: probes[key] || null,
  }));
  const reachableCount = probeEntries.filter((p) => p.probe?.reachable).length;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-scale-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
              System Status &amp; Ingestion Telemetry
            </h1>
            <DataModeBadge mode={dataMode} />
          </div>
          <p className="mt-0.5 text-scale-sm text-[var(--color-text-secondary)]">
            Live probe results for the Open-Meteo pipelines, artifact inventory and meta-model bundle status
          </p>
        </div>

        <span
          className={`font-data text-scale-xs px-2.5 py-1 rounded-md border font-bold ${
            healthQ.loading
              ? 'bg-slate-100 text-slate-600 border-slate-300'
              : health?.status === 'ok'
              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300'
          }`}
        >
          {healthQ.loading
            ? 'CHECKING…'
            : health?.status === 'ok'
            ? `API OK · v${health.version}${health.model_bundle_loaded ? ' · BUNDLE LOADED' : ''}`
            : 'API UNREACHABLE'}
        </span>
      </div>

      {/* Health / provider errors */}
      {healthQ.error && (
        <ErrorState error={healthQ.error} onRetry={healthQ.reload} label="Backend health check failed" />
      )}

      {/* Top Grid: Ingestion Feeds Table + Engine Status */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Ingestion Feeds */}
        <div className="xl:col-span-2 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-scale-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                Provider Ingestion Telemetry
              </h2>
              <p className="text-scale-xs text-[var(--color-text-secondary)] mt-0.5">
                Probed live when this page loads ({reachableCount}/{probeEntries.length} reachable)
              </p>
            </div>
            <span className="font-data text-scale-xs text-[var(--color-text-tertiary)]">
              {providers?.checked_at ? `Checked ${providers.checked_at.slice(11, 19)} UTC` : ''}
            </span>
          </div>

          {providersQ.loading ? (
            <LoadingState label="Probing provider endpoints (can take a few seconds)…" />
          ) : providersQ.error ? (
            <ErrorState error={providersQ.error} onRetry={providersQ.reload} label="Provider status unavailable" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-scale-xs">
                <thead className="bg-[var(--color-surface)] border-b border-[var(--color-border)] text-[var(--color-text-tertiary)] font-bold text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Data Pipeline</th>
                    <th className="py-2.5 px-3">Cycle</th>
                    <th className="py-2.5 px-3 text-right">HTTP</th>
                    <th className="py-2.5 px-3 text-right">Latency</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)] font-data">
                  {probeEntries.map((feed) => (
                    <tr key={feed.key} className="hover:bg-[var(--color-surface)] transition-colors">
                      <td className="py-3 px-3 font-bold text-[var(--color-text-primary)]">
                        {feed.name}
                        <span className="block text-[10px] text-[var(--color-text-tertiary)] font-normal">
                          {feed.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[var(--color-text-secondary)]">{feed.cycle}</td>
                      <td className="py-3 px-3 text-right text-[var(--color-text-secondary)]">
                        {feed.probe?.http_status ?? '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-[var(--color-text-secondary)]">
                        {feed.probe?.latency_ms != null ? `${feed.probe.latency_ms} ms` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            feed.probe?.reachable
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border-emerald-300'
                              : 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-400 border-red-300'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              feed.probe?.reachable ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                            }`}
                          />
                          {feed.probe?.reachable ? 'Reachable' : 'Unreachable'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Engine status */}
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-5 shadow-xs transition-colors flex flex-col justify-between">
          <div>
            <h2 className="text-scale-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)] mb-1">
              Adaptive Engine Status
            </h2>
            <p className="text-scale-xs text-[var(--color-text-secondary)] mb-4">
              Trained XGBoost meta-model bundle and artifact inventory
            </p>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-scale-xs font-semibold mb-1">
                  <span className="text-[var(--color-text-secondary)]">Meta-model bundle loaded</span>
                  <span
                    className={`font-data font-bold ${
                      health?.model_bundle_loaded ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {health?.model_bundle_loaded ? 'Yes' : 'Not loaded'}
                  </span>
                </div>
                <div className="w-full h-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${health?.model_bundle_loaded ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: health?.model_bundle_loaded ? '100%' : '0%' }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-scale-xs font-semibold mb-1">
                  <span className="text-[var(--color-text-secondary)]">Pipeline artifacts present</span>
                  <span className="font-data font-bold text-blue-600">
                    {artifactsReady}/{artifactEntries.length}
                  </span>
                </div>
                <div className="w-full h-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${(artifactsReady / artifactEntries.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)] space-y-1.5 font-data text-scale-xs">
                {artifactEntries.map(([key, label]) => (
                  <div className="flex justify-between" key={key}>
                    <span className="text-[var(--color-text-tertiary)] truncate pr-2">{label}:</span>
                    <strong className={artifacts[key] ? 'text-emerald-600' : 'text-amber-600'}>
                      {artifacts[key] ? 'present' : 'missing'}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)] space-y-1.5 font-data text-scale-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-tertiary)]">Split rule:</span>
                  <strong className="text-[var(--color-text-primary)] text-right max-w-[55%]">
                    {provenance?.split_fractions
                      ? `${provenance.split_fractions.train} / ${provenance.split_fractions.validation} / ${provenance.split_fractions.test}`
                      : '—'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-tertiary)]">Variables benchmarked:</span>
                  <strong className="text-[var(--color-text-primary)]">
                    {provenance?.variables?.join(', ') || '—'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-tertiary)]">Pipeline generated:</span>
                  <strong className="text-[var(--color-text-primary)]">
                    {provenance?.generated_at ? provenance.generated_at.slice(0, 16).replace('T', ' ') : '—'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-tertiary)] font-data">
            {provenance?.test_season_caveat || 'Held-out test covers the chronologically last season only.'}
          </div>
        </div>
      </div>

      {/* Regional clusters */}
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-5 shadow-xs transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-scale-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
              Agro-Climatic Operational Regions
            </h2>
            <p className="text-scale-xs text-[var(--color-text-secondary)] mt-0.5">
              12 regions · 6 benchmarked against held-out skill · IMD in-situ ingestion pending
            </p>
          </div>
          <button
            onClick={loadRegions}
            className="font-data text-scale-xs px-2.5 py-1 border border-[var(--color-border)] rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
          >
            Refresh regions
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {regions.map((reg) => (
            <div
              key={reg.id}
              onClick={() => selectRegion(reg.id)}
              className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-amber-400 rounded-[var(--radius-lg)] transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase font-data">
                  {reg.state}
                </span>
                <span
                  className={`font-data text-xs font-bold px-1.5 py-0.5 rounded ${
                    reg.validated
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {reg.validated === null ? '—' : reg.validated ? 'Bench' : 'Live'}
                </span>
              </div>
              <h3 className="text-scale-xs font-bold text-[var(--color-text-primary)] group-hover:text-amber-600 transition-colors truncate">
                {reg.name}
              </h3>
              <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 line-clamp-2">{reg.zone}</p>
              <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)] text-[10px] font-data text-amber-700 dark:text-amber-400 font-semibold flex items-center justify-between">
                <span>● {dataMode || 'API'}</span>
                <span>Elev {reg.elevation}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {attribution && <p className="text-[10px] text-[var(--color-text-tertiary)] font-data">{attribution}</p>}
    </div>
  );
}
