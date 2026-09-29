import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getExplain, getForecast, leadToHours } from '../services/api';
import { useApi } from '../services/useApi';
import { regimeName } from '../data/referenceData.js';
import { DataModeBadge, ValidatedBadge } from '../components/shared/Badges';

const LEAD_HOURS = leadToHours('48h');

const REGIME_REGIONS = [
  { id: 'orographic', label: 'Orographic Precipitation', regionId: 'western_ghats' },
  { id: 'convective', label: 'Valley Convection', regionId: 'assam_valley' },
  { id: 'heatwave', label: 'Arid Heat Zone', regionId: 'rajasthan_thar' },
];

const MEMBER_ORDER = ['ecmwf_ifs', 'ecmwf_aifs', 'cep_gfs', 'dwd_icon'];
const MEMBER_META = {
  ecmwf_ifs: { name: 'ECMWF IFS', color: '#2563EB' },
  ecmwf_aifs: { name: 'ECMWF AIFS', color: '#8B5CF6' },
  cep_gfs: { name: 'NOAA GFS', color: '#059669' },
  dwd_icon: { name: 'DWD ICON', color: '#0891B2' },
};

export default function Landing() {
  const [activeRegime, setActiveRegime] = useState('orographic');
  const active = REGIME_REGIONS.find((r) => r.id === activeRegime) || REGIME_REGIONS[0];

  // Live backend data for the showcase card (temperature is the validated variable)
  const explainQ = useApi(
    () => getExplain({ region: active.regionId, variable: 'temperature', leadTimeHours: LEAD_HOURS }),
    [active.regionId]
  );
  const forecastQ = useApi(
    () => getForecast({ region: active.regionId, variable: 'temperature', leadTimeHours: LEAD_HOURS }),
    [active.regionId]
  );

  const explain = explainQ.data;
  const forecast = forecastQ.data;
  const entry = forecast
    ? forecast.timeline.find((e) => e.lead_time_hours === LEAD_HOURS) ||
      forecast.timeline[forecast.timeline.length - 1]
    : null;
  const regionName = forecast ? forecast.region_id : active.regionId;

  const loading = explainQ.loading || forecastQ.loading;
  const error = explainQ.error || forecastQ.error;

  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-text-primary)] flex flex-col font-sans transition-colors">
      {/* Top Navbar */}
      <header className="h-16 px-6 md:px-12 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-panel)]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-accent)] flex items-center justify-center shadow-xs">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1A1A17" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
              <path d="M13 13l-3 5h4l-2 5" />
            </svg>
          </div>
          <span className="text-scale-base font-bold tracking-tight text-[var(--color-text-primary)]">
            VARUNA
          </span>
        </div>

        <nav className="hidden lg:flex items-center gap-8 text-scale-xs font-semibold text-[var(--color-text-secondary)]">
          <Link to="/command-centre" className="hover:text-[var(--color-text-primary)] transition-colors">Forecasting</Link>
          <Link to="/models" className="hover:text-[var(--color-text-primary)] transition-colors">Model Blend</Link>
          <Link to="/skill" className="hover:text-[var(--color-text-primary)] transition-colors">Verification Skill</Link>
          <Link to="/extremes" className="hover:text-[var(--color-text-primary)] transition-colors">Extremes Watch</Link>
          <Link to="/explainability" className="hover:text-[var(--color-text-primary)] transition-colors">Explainability</Link>
        </nav>

        <div className="flex items-center gap-4">
          <DataModeBadge mode={forecast?.data_mode} />
          <Link
            to="/command-centre"
            className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-slate-950 font-bold text-scale-xs rounded-[var(--radius-md)] transition-all shadow-xs flex items-center gap-1.5"
          >
            <span>Open Dashboard</span>
            <span>→</span>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 md:px-16 pt-16 pb-24 border-b border-[var(--color-border)] technical-cross-grid overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
          {/* Left Text */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-400/80 bg-amber-50 dark:bg-amber-950/40 text-[11px] font-bold text-amber-800 dark:text-amber-300 font-data uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>ECMWF IFS · AIFS · NOAA GFS · DWD ICON · ADAPTIVE BLEND</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--color-text-primary)] leading-[1.08]">
              From raw ensembles <br />
              <span className="text-[var(--color-text-secondary)]">to decisive action.</span>
            </h1>

            <p className="text-scale-lg text-[var(--color-text-secondary)] max-w-2xl font-normal leading-relaxed">
              Variable-Adaptive Regional Unified NWP-AI Assimilation (VARUNA). Four operational models blended by a
              trained XGBoost meta-model whose weights are derived from predicted error in each regime.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to="/command-centre"
                className="px-6 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-slate-950 font-bold text-scale-sm rounded-[var(--radius-md)] transition-all shadow-md flex items-center gap-2"
              >
                <span>Launch Command Centre</span>
                <span>→</span>
              </Link>
              <Link
                to="/skill"
                className="px-6 py-3 bg-[var(--color-panel)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-primary)] font-semibold text-scale-sm rounded-[var(--radius-md)] transition-all shadow-xs"
              >
                Explore Verification Skill
              </Link>
            </div>

            {/* Operational facts strip */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-[var(--color-border)] max-w-xl">
              <div>
                <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block font-data">
                  Member Models
                </span>
                <span className="font-data text-scale-sm font-bold text-[var(--color-text-primary)] block mt-0.5">
                  4 NWP / AI Members
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block font-data">
                  Operational Regions
                </span>
                <span className="font-data text-scale-sm font-bold text-[var(--color-text-primary)] block mt-0.5">
                  12 · 6 benchmarked
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block font-data">
                  Verification
                </span>
                <span className="font-data text-scale-sm font-bold text-emerald-600 block mt-0.5">
                  ● ERA5 reanalysis
                </span>
              </div>
            </div>
          </div>

          {/* Right live card */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-md bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-6 shadow-2xl relative">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 font-data text-xs font-bold text-[var(--color-text-secondary)] uppercase">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Live blend snapshot
                </span>
                <DataModeBadge mode={forecast?.data_mode} />
              </div>

              <h3 className="font-data text-scale-lg font-bold text-[var(--color-text-primary)] mb-1">
                {regionName.replace(/_/g, ' ')}
              </h3>
              <p className="text-scale-xs text-[var(--color-text-secondary)] mb-4">
                {regimeName(entry?.regime_index) || forecast?.regime?.name || 'Regime classification pending'} ·
                Temperature +{LEAD_HOURS}h
              </p>

              {loading && (
                <div className="flex items-center justify-center h-40 text-scale-xs text-[var(--color-text-secondary)]">
                  <span className="w-5 h-5 rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)] animate-spin mr-2" />
                  Loading from backend…
                </div>
              )}

              {!loading && error && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-300 rounded-[var(--radius-lg)] text-scale-xs text-red-700 dark:text-red-300">
                  Backend unreachable — start it with{' '}
                  <code className="font-data">uvicorn app.main:app</code> inside <code>varuna-backend</code>.
                </div>
              )}

              {!loading && !error && forecast && (
                <>
                  <div className="p-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] mb-4 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)]">
                        VARUNA Blend Forecast (+{LEAD_HOURS}h)
                      </div>
                      <div className="font-data text-3xl font-bold text-amber-600">
                        {entry?.blend ?? '—'} <span className="text-scale-xs text-[var(--color-text-secondary)]">°C</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <ValidatedBadge validated={!!forecast.validated} />
                      <div className="font-data text-[11px] text-[var(--color-text-secondary)] mt-1.5">
                        {forecast.weighting_scheme}
                      </div>
                    </div>
                  </div>

                  {/* Weight consensus (real) */}
                  <div className="space-y-2 mb-4">
                    {MEMBER_ORDER.map((key) => {
                      const w = entry?.weights?.[key];
                      const meta = MEMBER_META[key];
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-scale-xs font-semibold">
                            <span style={{ color: meta.color }}>{meta.name}</span>
                            <span className="font-data">
                              {w ?? '—'}% · {entry?.models?.[key] ?? '—'} °C
                            </span>
                          </div>
                          <div className="w-full h-2 bg-[var(--color-surface)] rounded-full overflow-hidden border border-[var(--color-border)]">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${w || 0}%`, backgroundColor: meta.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Link
                    to="/command-centre"
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-[var(--radius-md)] font-bold text-scale-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Inspect in Command Centre</span>
                    <span>→</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Section: ingestion */}
      <section className="px-6 md:px-16 py-20 border-b border-[var(--color-border)] bg-[var(--color-panel)]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div>
            <span className="font-data text-scale-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1">
              01 / MULTI-MODEL INGESTION &amp; BLENDING
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--color-text-primary)]">
              Four global models. One adaptive blend.
            </h2>
            <p className="mt-3 text-scale-base text-[var(--color-text-secondary)] max-w-3xl leading-relaxed">
              VARUNA pulls each member from the Open-Meteo API ({' '}
              <code className="font-data text-[var(--color-text-primary)]">ecmwf_ifs025</code>,{' '}
              <code className="font-data text-[var(--color-text-primary)]">ecmwf_aifs025_single</code>,{' '}
              <code className="font-data text-[var(--color-text-primary)]">gfs_seamless</code>,{' '}
              <code className="font-data text-[var(--color-text-primary)]">icon_seamless</code> ), aligns them on a
              common timeline, and blends them with weights ∝ 1/Ê² that sum to exactly 100%. The backend falls back
              LIVE → CACHED → REPLAY and reports which mode served every payload.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs">
              <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block font-data">
                Operational Regions
              </span>
              <div className="font-data text-4xl font-bold text-[var(--color-text-primary)] my-3">
                12 <span className="text-scale-base font-normal text-[var(--color-text-secondary)]">regions</span>
              </div>
              <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                6 of them are benchmarked against held-out verification windows; the other 6 run live only and are
                labelled as such throughout the UI.
              </p>
            </div>

            <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs">
              <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block font-data">
                Member Framework
              </span>
              <div className="font-data text-4xl font-bold text-[var(--color-text-primary)] my-3">
                4 <span className="text-scale-base font-normal text-[var(--color-text-secondary)]">members</span>
              </div>
              <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                ECMWF IFS (0.25° NWP), ECMWF AIFS (AI weather model), NOAA GFS (seamless) and DWD ICON (seamless) —
                null members are dropped and weights re-apportioned, never zero-filled.
              </p>
            </div>

            <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs">
              <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block font-data">
                Meta-Model
              </span>
              <div className="font-data text-4xl font-bold text-emerald-600 my-3">
                80 <span className="text-scale-base font-normal text-[var(--color-text-secondary)]">trees · depth 4</span>
              </div>
              <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                One XGBoost regressor per member predicts |forecast − ERA5| from 11 fixed features (lr 0.06), trained
                on a chronological 65/15/20 split with no shuffling.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section: explainability */}
      <section className="px-6 md:px-16 py-20 bg-[var(--color-surface)]">
        <div className="max-w-7xl mx-auto space-y-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--color-text-primary)]">
              A single model is not an answer.
            </h2>
            <p className="mt-3 text-scale-base text-[var(--color-text-secondary)] max-w-3xl leading-relaxed">
              A pure physics model can suffer from parameterization bias; a pure learning model can produce unphysical
              artifacts. VARUNA keeps every member and shows exactly how much weight each one received, why, and with
              what predicted error — per region, variable and lead time.
            </p>
          </div>

          {/* Regime Pills -> live region presets */}
          <div className="flex flex-wrap gap-2">
            {REGIME_REGIONS.map((reg) => (
              <button
                key={reg.id}
                onClick={() => setActiveRegime(reg.id)}
                className={`px-4 py-2 rounded-full text-scale-xs font-bold transition-all cursor-pointer border ${
                  activeRegime === reg.id
                    ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-xs'
                    : 'bg-[var(--color-panel)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                {reg.label}
              </button>
            ))}
          </div>

          {/* Auditable evidence box (live from /api/explain) */}
          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-6 md:p-8 shadow-xs max-w-4xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <h3 className="text-scale-base font-bold text-[var(--color-text-primary)]">
                    {regimeName(explain?.regime?.index) || explain?.regime?.name || 'Classifying regime…'}
                  </h3>
                </div>
                <span className="text-[11px] font-data text-[var(--color-text-tertiary)]">
                  {explain?.weighting_scheme || 'weighting pending'} · {active.regionId} · temperature · +{LEAD_HOURS}h
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] block">Weights sum</span>
                  <span className="font-data text-scale-base font-bold text-[var(--color-text-primary)]">
                    {explain?.weights_sum ?? '—'}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] block">Validation</span>
                  <ValidatedBadge validated={!!explain?.validated} />
                </div>
              </div>
            </div>

            <div>
              <span className="font-data text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-4">
                Auditable member evidence
              </span>
              {explainQ.loading && (
                <div className="text-scale-xs text-[var(--color-text-secondary)]">Loading live weights…</div>
              )}
              {explainQ.error && (
                <div className="text-scale-xs text-red-600">
                  Backend unreachable — no weights are shown rather than inventing any.
                </div>
              )}
              <div className="space-y-4">
                {MEMBER_ORDER.map((key) => {
                  const meta = MEMBER_META[key];
                  const weight = explain?.weights?.[key];
                  const predErr = explain?.predicted_errors?.[key];
                  const own = explain?.member_values?.[key];
                  return (
                    <div key={key} className="p-3.5 bg-[var(--color-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-md)]">
                      <div className="flex justify-between text-scale-xs font-semibold mb-1">
                        <span className="text-[var(--color-text-primary)] font-bold">
                          {meta.name}
                          <span className="ml-2 font-normal text-[var(--color-text-tertiary)]">
                            predicted error Ê {predErr ?? '—'} °C · own forecast {own ?? '—'} °C
                          </span>
                        </span>
                        <span className="font-data" style={{ color: meta.color }}>
                          {weight ?? '—'}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[var(--color-surface-muted)] rounded-full overflow-hidden border border-[var(--color-border)]">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${weight || 0}%`, backgroundColor: meta.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {explain?.model_metadata?.trained_at && (
              <p className="text-[11px] font-data text-[var(--color-text-tertiary)] border-t border-[var(--color-border)] pt-4">
                Meta-model trained {explain.model_metadata.trained_at} on{' '}
                {explain.model_metadata.n_train_rows?.toLocaleString()} rows · features:{' '}
                {explain.model_metadata.feature_names?.join(', ')}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[var(--color-border)] py-8 px-6 md:px-16 bg-[var(--color-panel)] text-scale-xs text-[var(--color-text-secondary)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--color-text-primary)]">VARUNA</span>
          <span>— Adaptive Weather Intelligence | SIH 2026 Project</span>
        </div>
        <div className="font-data text-[11px] text-[var(--color-text-tertiary)] text-center">
          Data: Open-Meteo (CC BY 4.0), ECMWF, NOAA, DWD · Verification reference: ERA5 reanalysis, not station
          observations · IMD AWS integration pending
        </div>
      </footer>
    </div>
  );
}
