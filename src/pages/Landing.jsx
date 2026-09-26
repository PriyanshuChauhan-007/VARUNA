import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Landing() {
  const [activeRegime, setActiveRegime] = useState('orographic');

  const REGIME_EVIDENCE = {
    orographic: {
      title: 'High-Elevation Orographic Precipitation',
      model: 'VARUNA XGBoost Meta-Model v2.6 · Inference 14.2ms',
      confidence: '95%',
      tier: 'Critical (94.2 mm)',
      tierColor: '#DC2626',
      factors: [
        { name: 'ECMWF AIFS Moisture Advection', weight: 47, note: 'Captures low-level Arabian Sea jet inflow without spatial phase lag' },
        { name: 'NOAA GFS Orographic Convection', weight: 34, note: 'High sensitivity to cloud microphysics over windward escarpments' },
        { name: 'ECMWF IFS NWP Anchor', weight: 19, note: 'Thermodynamic mass conservation boundary constraint' },
        { name: 'Empirical Bias Correction Kernel', weight: 92, note: 'Cancels +0.32mm systematic positive bias observed in raw IFS' },
      ],
    },
    convective: {
      title: 'Severe Convective Thunderstorm & Rain Cells',
      model: 'VARUNA XGBoost Meta-Model v2.6 · Inference 12.8ms',
      confidence: '91%',
      tier: 'High (68.4 mm)',
      tierColor: '#EA580C',
      factors: [
        { name: 'Deep Learning Instability Trigger', weight: 48, note: 'Transformer attention isolates localized shear and CAPE spikes' },
        { name: 'NWP Radar Echo Correlation', weight: 32, note: 'Aligned with Doppler Weather Radar reflectivity gradients' },
        { name: 'Boundary Layer Thermodynamic Anchor', weight: 20, note: 'Prevents unphysical artificial droplet accumulation' },
      ],
    },
    heatwave: {
      title: 'Subtropical Desert Severe Heatwave',
      model: 'VARUNA XGBoost Meta-Model v2.6 · Inference 11.4ms',
      confidence: '96%',
      tier: 'Critical (44.8 °C)',
      tierColor: '#DC2626',
      factors: [
        { name: 'Anti-Cyclonic Subsidence Tracking', weight: 45, note: 'Accurately tracks dry adiabatic heating over western Gujarat' },
        { name: 'Surface Radiation Budget NWP', weight: 35, note: 'Physical solar insolation balance from ECMWF IFS' },
        { name: 'Continental Advection Vector', weight: 20, note: 'Westerly desert wind temperature pooling verified by reference reanalysis (ground AWS integration pending)' },
      ],
    },
  };

  const currentEvidence = REGIME_EVIDENCE[activeRegime] || REGIME_EVIDENCE.orographic;

  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-text-primary)] flex flex-col font-sans transition-colors">
      {/* Top Navbar matching THERMOS Screenshot 1 */}
      <header className="h-16 px-6 md:px-12 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-panel)]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-accent)] flex items-center justify-center shadow-xs shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1A17" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
          <div className="hidden sm:flex items-center gap-2 text-scale-xs font-data text-[var(--color-text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>DEMO MODE · 00Z REFERENCE RUN</span>
          </div>

          <Link
            to="/command-centre"
            className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-slate-950 font-bold text-scale-xs rounded-[var(--radius-md)] transition-all shadow-xs flex items-center gap-1.5"
          >
            <span>Open Dashboard</span>
            <span>→</span>
          </Link>
        </div>
      </header>

      {/* Hero Section matching THERMOS Screenshot 1 */}
      <section className="relative px-6 md:px-16 pt-16 pb-24 border-b border-[var(--color-border)] technical-cross-grid overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
          {/* Left Text */}
          <div className="lg:col-span-7 space-y-6">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-400/80 bg-amber-50 dark:bg-amber-950/40 text-[11px] font-bold text-amber-800 dark:text-amber-300 font-data uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>ECMWF IFS · AIFS · NOAA GFS · ADAPTIVE HYBRID METEOROLOGICAL INTELLIGENCE</span>
            </div>

            {/* Massive Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--color-text-primary)] leading-[1.08]">
              From raw ensembles <br />
              <span className="text-[var(--color-text-secondary)]">to decisive action.</span>
            </h1>

            {/* Subtitle */}
            <p className="text-scale-lg text-[var(--color-text-secondary)] max-w-2xl font-normal leading-relaxed">
              Variable-Adaptive Regional Unified NWP-AI Assimilation (VARUNA). Blending physical weather models with spherical deep-learning transformers using contextual XGBoost meta-model regime calibration.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
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

            {/* Operational Metric Strip */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-[var(--color-border)] max-w-xl">
              <div>
                <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block font-data">
                  Ingestion Feed
                </span>
                <span className="font-data text-scale-sm font-bold text-[var(--color-text-primary)] block mt-0.5">
                  ECMWF IFS · GFS 0.25°
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block font-data">
                  AI Deep Learning
                </span>
                <span className="font-data text-scale-sm font-bold text-[var(--color-text-primary)] block mt-0.5">
                  ECMWF AIFS (ML)
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block font-data">
                  Adaptive Weighting
                </span>
                <span className="font-data text-scale-sm font-bold text-emerald-600 block mt-0.5">
                  ● XGBoost Meta-Model
                </span>
              </div>
            </div>
          </div>

          {/* Right Floating Tactical Card matching THERMOS Screenshot 1 */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-md bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-6 shadow-2xl relative">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 font-data text-xs font-bold text-red-600 uppercase">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                  CRITICAL METEOROLOGICAL ALERT
                </span>
                <span className="font-data text-xs font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                  Confidence 95%
                </span>
              </div>

              <h3 className="font-data text-scale-lg font-bold text-[var(--color-text-primary)] mb-1">
                Western Ghats (Mahabaleshwar)
              </h3>
              <p className="text-scale-xs text-[var(--color-text-secondary)] mb-4">
                Orographic Cloud Burst Advisory • High Ghats Escarpment
              </p>

              <div className="p-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)]">
                    VARUNA Blend Forecast (48h)
                  </div>
                  <div className="font-data text-3xl font-bold text-amber-600">
                    94.2 <span className="text-scale-xs text-[var(--color-text-secondary)]">mm Rainfall</span>
                  </div>
                </div>
                <div className="text-right font-data text-scale-xs text-[var(--color-text-secondary)]">
                  <div>17.9237°N</div>
                  <div>73.6586°E</div>
                </div>
              </div>

              {/* Weight consensus */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-scale-xs font-semibold">
                  <span className="text-purple-600">ECMWF AIFS (Transformer ML)</span>
                  <span className="font-data">47% Weight</span>
                </div>
                <div className="w-full h-2 bg-[var(--color-surface)] rounded-full overflow-hidden border border-[var(--color-border)]">
                  <div className="h-full bg-purple-600 rounded-full" style={{ width: '47%' }} />
                </div>
              </div>

              <Link
                to="/command-centre"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-[var(--radius-md)] font-bold text-scale-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Inspect in Command Centre</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Multi-Model Ingestion matching THERMOS Screenshot 2 */}
      <section className="px-6 md:px-16 py-20 border-b border-[var(--color-border)] bg-[var(--color-panel)]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div>
            <span className="font-data text-scale-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1">
              01 / MULTI-MODEL INGESTION &amp; ASSIMILATION
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--color-text-primary)]">
              Continuous NWP-AI assimilation. <br />Zero forecast gaps.
            </h2>
            <p className="mt-3 text-scale-base text-[var(--color-text-secondary)] max-w-3xl leading-relaxed">
              Global centers sweep India on regular synoptic cycles. VARUNA streams directly from ECMWF Open Data and NOAA NOMADS — converting raw multidimensional GRIB2 grids into unified, bias-corrected regional predictions in under 60 seconds.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs">
              <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block font-data">
                Spatial Downscaling Precision
              </span>
              <div className="font-data text-4xl font-bold text-[var(--color-text-primary)] my-3">
                0.1° <span className="text-scale-base font-normal text-[var(--color-text-secondary)]">(~9 km)</span>
              </div>
              <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                Downscaled spatial resolution captures orographic ridges down to district agro-climatic boundaries.
              </p>
            </div>

            <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs">
              <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block font-data">
                Multi-Center Ensemble
              </span>
              <div className="font-data text-4xl font-bold text-[var(--color-text-primary)] my-3">
                3 <span className="text-scale-base font-normal text-[var(--color-text-secondary)]">Member Framework</span>
              </div>
              <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                Combined streams from ECMWF IFS (9km NWP), ECMWF AIFS (Deep Learning), and NOAA GFS (13km FV3).
              </p>
            </div>

            <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs">
              <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block font-data">
                XGBoost Meta-Model Latency
              </span>
              <div className="font-data text-4xl font-bold text-emerald-600 my-3">
                &lt;15 <span className="text-scale-base font-normal text-[var(--color-text-secondary)]">ms</span>
              </div>
              <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                Near-instantaneous regime-conditioned inverse variance weighting delivers fresh blends before next cycle ingestion.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Explainability and Evidence matching THERMOS Screenshot 3 */}
      <section className="px-6 md:px-16 py-20 bg-[var(--color-surface)]">
        <div className="max-w-7xl mx-auto space-y-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--color-text-primary)]">
              A single model is not an answer.
            </h2>
            <p className="mt-3 text-scale-base text-[var(--color-text-secondary)] max-w-3xl leading-relaxed">
              A pure physics model can suffer from parameterization bias; a pure deep learning model can produce unphysical artifacts. VARUNA fuses physics-based conservation laws with neural transformers and historical reference verification to weight each source with auditable evidence.
            </p>
          </div>

          {/* Regime Pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'orographic', label: 'Orographic Precipitation' },
              { id: 'convective', label: 'Convective Rain Cells' },
              { id: 'heatwave', label: 'Severe Heatwave' },
            ].map((reg) => (
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

          {/* Auditable Feature Evidence Box matching THERMOS Screenshot 3 */}
          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-6 md:p-8 shadow-xs max-w-4xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentEvidence.tierColor }} />
                  <h3 className="text-scale-base font-bold text-[var(--color-text-primary)]">
                    {currentEvidence.title}
                  </h3>
                </div>
                <span className="text-[11px] font-data text-[var(--color-text-tertiary)]">
                  {currentEvidence.model}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] block">Confidence</span>
                  <span className="font-data text-scale-base font-bold text-[var(--color-text-primary)]">{currentEvidence.confidence}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] block">Alert Threshold</span>
                  <span className="font-data text-xs font-bold px-2 py-0.5 rounded text-white" style={{ backgroundColor: currentEvidence.tierColor }}>
                    {currentEvidence.tier}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <span className="font-data text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-4">
                AUDITABLE FEATURE EVIDENCE
              </span>
              <div className="space-y-4">
                {currentEvidence.factors.map((factor, i) => (
                  <div key={i} className="p-3.5 bg-[var(--color-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-md)]">
                    <div className="flex justify-between text-scale-xs font-semibold mb-1">
                      <span className="text-[var(--color-text-primary)] font-bold">{factor.name}</span>
                      <span className="text-[var(--color-text-secondary)] text-[11px]">{factor.note}</span>
                    </div>
                    <div className="w-full h-2 bg-[var(--color-surface-muted)] rounded-full overflow-hidden border border-[var(--color-border)]">
                      <div className="h-full bg-red-600 rounded-full" style={{ width: `${factor.weight}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer matching THERMOS */}
      <footer className="mt-auto border-t border-[var(--color-border)] py-8 px-6 md:px-16 bg-[var(--color-panel)] text-scale-xs text-[var(--color-text-secondary)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--color-text-primary)]">VARUNA</span>
          <span>— Adaptive Weather Intelligence | SIH 2026 Project</span>
        </div>
        <div className="font-data text-[11px] text-[var(--color-text-tertiary)]">
          ECMWF IFS (9km) · ECMWF AIFS (0.25°) · NOAA GFS (13km) · Reanalysis Benchmark (IMD Integration Pending)
        </div>
      </footer>
    </div>
  );
}
