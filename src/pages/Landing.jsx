import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

// 12 Canonical Indian Operational Monitoring Regions
const OPERATIONAL_REGIONS = [
  { id: 'delhi_ncr', name: 'Delhi NCR', state: 'Delhi / Haryana', lat: 28.6139, lon: 77.2090, zone: 'North-West Plains', elevation: '216m', benchmarked: true },
  { id: 'mumbai_coastal', name: 'Mumbai Coastal', state: 'Maharashtra', lat: 19.0760, lon: 72.8777, zone: 'Konkan Maritime Zone', elevation: '14m', benchmarked: true },
  { id: 'western_ghats', name: 'Western Ghats (Mahabaleshwar)', state: 'Maharashtra / Karnataka', lat: 17.9237, lon: 73.6586, zone: 'High Ghats Escarpment', elevation: '1,353m', benchmarked: true },
  { id: 'gujarat_industrial', name: 'Jamnagar Petrochemical Belt', state: 'Gujarat', lat: 22.4707, lon: 70.0577, zone: 'Kathiawar Coastal Strip', elevation: '20m', benchmarked: false },
  { id: 'odisha_coast', name: 'Paradip Port / Bay Coast', state: 'Odisha', lat: 20.3164, lon: 86.6085, zone: 'Mahanadi Deltaic Littoral', elevation: '8m', benchmarked: true },
  { id: 'bengaluru_deccan', name: 'Bengaluru Deccan', state: 'Karnataka', lat: 12.9716, lon: 77.5946, zone: 'South Interior Plateau', elevation: '920m', benchmarked: true },
  { id: 'punjab_agri', name: 'Punjab Central Agro-Belt', state: 'Punjab', lat: 30.9010, lon: 75.8573, zone: 'Indo-Gangetic Basin', elevation: '244m', benchmarked: false },
  { id: 'assam_valley', name: 'Guwahati / Brahmaputra Valley', state: 'Assam', lat: 26.1445, lon: 91.7362, zone: 'Sub-Himalayan Trough', elevation: '55m', benchmarked: false },
  { id: 'chennai_coastal', name: 'Chennai Coromandel', state: 'Tamil Nadu', lat: 13.0827, lon: 80.2707, zone: 'Coromandel Coastal Plain', elevation: '6m', benchmarked: false },
  { id: 'rajasthan_thar', name: 'Jodhpur / Western Thar', state: 'Rajasthan', lat: 26.2389, lon: 73.0243, zone: 'Thar Arid Zone', elevation: '231m', benchmarked: true },
  { id: 'kerala_coast', name: 'Kochi Malabar Coast', state: 'Kerala', lat: 9.9312, lon: 76.2673, zone: 'Malabar Maritime Zone', elevation: '4m', benchmarked: false },
  { id: 'central_highlands', name: 'Bhopal / Central Highlands', state: 'Madhya Pradesh', lat: 23.2599, lon: 77.4126, zone: 'Vindhya Basin Plateau', elevation: '527m', benchmarked: false },
];

// Benchmark metrics from varuna-backend/reports/blend_test_results.csv (Held-out N=4,512, ERA5 reference)
const BENCHMARK_SYSTEMS = [
  { name: 'VARUNA Adaptive Blend', type: 'XGBoost Meta-Model', rmse: '0.780', mae: '0.612', bias: '+0.066', r: '0.984', highlight: true },
  { name: 'Static Inverse-RMSE Blend', type: 'Empirical Weighted', rmse: '0.787', mae: '0.622', bias: '+0.082', r: '0.984' },
  { name: 'Equal-Weight Blend', type: 'Unweighted Mean (1/N)', rmse: '0.960', mae: '0.759', bias: '+0.170', r: '0.978' },
  { name: 'ECMWF AIFS', type: 'Deep Learning (0.25°)', rmse: '1.105', mae: '0.866', bias: '+0.510', r: '0.981' },
  { name: 'DWD ICON', type: 'Non-Hydrostatic NWP (13km)', rmse: '1.131', mae: '0.876', bias: '+0.056', r: '0.969' },
  { name: 'ECMWF IFS', type: 'Operational NWP (9km)', rmse: '1.195', mae: '0.924', bias: '-0.561', r: '0.973' },
  { name: 'NOAA GFS', type: 'FV3 Dynamical Core (13km)', rmse: '2.320', mae: '1.874', bias: '+0.674', r: '0.930' },
];

// Pre-configured meteorological regimes for the interactive weighting simulator
const SIMULATOR_PRESETS = {
  orographic: {
    id: 'orographic',
    title: 'Western Ghats Orographic Surge',
    location: 'Mahabaleshwar Escarpment (1,353m)',
    description: 'Deep moisture-laden Arabian Sea influx ascending steep coastal terrain. AIFS and ICON capture windward escarpment dynamics with low predicted error, while GFS struggles with convective overestimation.',
    errors: { ecmwf_ifs: 1.25, ecmwf_aifs: 0.95, ncep_gfs: 2.30, dwd_icon: 1.10 },
  },
  heatwave: {
    id: 'heatwave',
    title: 'Subtropical Desert Severe Heatwave',
    location: 'Jodhpur / Western Thar (231m)',
    description: 'Anti-cyclonic subsidence and intense dry adiabatic surface heating. ECMWF IFS surface radiation budget and ICON non-hydrostatic boundary physics yield minimal forecast error.',
    errors: { ecmwf_ifs: 0.90, ecmwf_aifs: 1.30, ncep_gfs: 2.10, dwd_icon: 1.05 },
  },
  medium_range: {
    id: 'medium_range',
    title: 'Extended Medium-Range (+120h Horizon)',
    location: 'Indo-Gangetic Regional Plains',
    description: 'Atmospheric chaos and phase uncertainty increase at Day 5. Deep learning AIFS exhibits superior spatial coherence and reduced error growth compared to traditional raw NWP.',
    errors: { ecmwf_ifs: 1.65, ecmwf_aifs: 1.40, ncep_gfs: 2.65, dwd_icon: 1.80 },
  },
};

/**
 * Exact JavaScript translation of Python weighting.py:
 * weights_from_predicted_errors() + hamilton_hare()
 * Guarantees integer weights summing to exactly 100% with zero remainder drift.
 */
function calculateHamiltonHare(errors) {
  const keys = ['ecmwf_ifs', 'ecmwf_aifs', 'ncep_gfs', 'dwd_icon'];
  const epsilon = 0.05;
  const raw = {};
  let totalRaw = 0;

  for (const k of keys) {
    const err = Math.max(Number(errors[k]) || 1.0, epsilon);
    const val = 1.0 / (err * err);
    raw[k] = val;
    totalRaw += val;
  }

  const quotas = keys.map((k) => (raw[k] / totalRaw) * 100.0);
  const floors = quotas.map((q) => Math.floor(q));
  const remainders = quotas.map((q, i) => q - floors[i]);
  let leftover = 100 - floors.reduce((a, b) => a + b, 0);

  const order = keys
    .map((k, i) => ({ i, key: k, rem: remainders[i], val: raw[k] }))
    .sort((a, b) => {
      if (b.rem !== a.rem) return b.rem - a.rem;
      if (b.val !== a.val) return b.val - a.val;
      return a.key.localeCompare(b.key);
    });

  let idx = 0;
  while (leftover > 0 && order.length > 0) {
    floors[order[idx % order.length].i] += 1;
    leftover -= 1;
    idx += 1;
  }

  const weights = {};
  keys.forEach((k, i) => {
    weights[k] = floors[i];
  });
  return { weights, totalRaw, quotas };
}

export default function Landing() {
  const [activePreset, setActivePreset] = useState('orographic');
  const [simErrors, setSimErrors] = useState(SIMULATOR_PRESETS.orographic.errors);
  const [regionFilter, setRegionFilter] = useState('all');

  const { weights } = useMemo(() => calculateHamiltonHare(simErrors), [simErrors]);
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const handlePresetSelect = (presetKey) => {
    setActivePreset(presetKey);
    setSimErrors(SIMULATOR_PRESETS[presetKey].errors);
  };

  const handleSliderChange = (modelKey, val) => {
    setActivePreset('custom');
    setSimErrors((prev) => ({
      ...prev,
      [modelKey]: parseFloat(val),
    }));
  };

  const filteredRegions = useMemo(() => {
    if (regionFilter === 'benchmarked') {
      return OPERATIONAL_REGIONS.filter((r) => r.benchmarked);
    }
    if (regionFilter === 'active') {
      return OPERATIONAL_REGIONS.filter((r) => !r.benchmarked);
    }
    return OPERATIONAL_REGIONS;
  }, [regionFilter]);

  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-text-primary)] flex flex-col font-sans transition-colors">
      {/* ── TOP NAVIGATION BAR ── */}
      <header className="h-16 px-6 md:px-12 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-panel)]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-accent)] flex items-center justify-center shadow-xs shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1A17" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
              <path d="M13 13l-3 5h4l-2 5" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-scale-base font-bold tracking-tight text-[var(--color-text-primary)] leading-none">
              VARUNA
            </span>
            <span className="text-[10px] font-data font-semibold text-[var(--color-text-tertiary)] tracking-wider mt-0.5">
              ADAPTIVE WEATHER INTELLIGENCE
            </span>
          </div>
        </div>

        <nav className="hidden xl:flex items-center gap-6 text-scale-xs font-semibold text-[var(--color-text-secondary)]">
          <a href="#overview" className="hover:text-[var(--color-text-primary)] transition-colors">Overview</a>
          <a href="#problem" className="hover:text-[var(--color-text-primary)] transition-colors">The Problem</a>
          <a href="#how-it-works" className="hover:text-[var(--color-text-primary)] transition-colors">Pipeline</a>
          <a href="#adaptive-weighting" className="hover:text-[var(--color-text-primary)] transition-colors">Adaptive Weights</a>
          <a href="#evidence" className="hover:text-[var(--color-text-primary)] transition-colors">Verification</a>
          <a href="#coverage" className="hover:text-[var(--color-text-primary)] transition-colors">Regions</a>
          <a href="#platform" className="hover:text-[var(--color-text-primary)] transition-colors">Platform</a>
          <a href="#boundaries" className="hover:text-[var(--color-text-primary)] transition-colors">Boundaries</a>
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[11px] font-data text-[var(--color-text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>4 ENSEMBLE MEMBERS · FASTAPI SCIENTIFIC CORE</span>
          </div>

          <Link
            to="/command-centre"
            className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-slate-950 font-bold text-scale-xs rounded-[var(--radius-md)] transition-all shadow-xs flex items-center gap-1.5"
          >
            <span>Launch Command Centre</span>
            <span>→</span>
          </Link>
        </div>
      </header>

      {/* ── SECTION 1: HERO — WHAT IS VARUNA? ── */}
      <section id="overview" className="relative px-6 md:px-16 pt-16 pb-20 border-b border-[var(--color-border)] technical-cross-grid">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Eyebrow & Headline */}
          <div className="max-w-4xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-[11px] font-bold text-amber-700 dark:text-amber-300 font-data uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>ECMWF IFS · ECMWF AIFS · NOAA GFS · DWD ICON · OPEN METEOROLOGICAL GATEWAY</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--color-text-primary)] leading-[1.08]">
              From competing forecasts <br />
              <span className="text-[var(--color-accent-hover)]">to one adaptive forecast.</span>
            </h1>

            <p className="text-scale-base sm:text-scale-lg text-[var(--color-text-secondary)] font-normal leading-relaxed">
              Global meteorological centers run independent numerical and artificial intelligence models with divergent physics, assumptions, and systematic biases. VARUNA dynamically reconciles ECMWF IFS, ECMWF AIFS, NOAA GFS, and DWD ICON using machine learning error prediction—delivering unified, calibrated atmospheric forecasts for India.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/command-centre"
                className="px-6 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-slate-950 font-bold text-scale-sm rounded-[var(--radius-md)] transition-all shadow-md flex items-center gap-2"
              >
                <span>Launch Command Centre</span>
                <span>→</span>
              </Link>
              <a
                href="#how-it-works"
                className="px-6 py-3 bg-[var(--color-panel)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-primary)] font-semibold text-scale-sm rounded-[var(--radius-md)] transition-all shadow-xs flex items-center gap-2"
              >
                <span>See How VARUNA Works</span>
                <span>↓</span>
              </a>
              <Link
                to="/skill"
                className="px-5 py-3 text-scale-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                View Verification Evidence →
              </Link>
            </div>
          </div>

          {/* 4 Ensemble Member Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* ECMWF IFS */}
            <div className="p-5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs flex flex-col justify-between hover:border-blue-500/50 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-data text-[11px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    9 km Grid · NWP
                  </span>
                  <span className="text-[11px] font-data text-[var(--color-text-tertiary)]">00Z / 12Z</span>
                </div>
                <h3 className="font-data text-scale-base font-bold text-[var(--color-text-primary)] mb-1">
                  ECMWF IFS
                </h3>
                <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Integrated Forecasting System. Global hydrostatic primitive-equation physics anchor with high-resolution thermodynamic mass conservation.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] font-data text-[var(--color-text-tertiary)]">
                <span>Held-Out RMSE</span>
                <span className="font-bold text-[var(--color-text-primary)]">1.195 °C</span>
              </div>
            </div>

            {/* ECMWF AIFS */}
            <div className="p-5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs flex flex-col justify-between hover:border-purple-500/50 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-data text-[11px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    0.25° (~28km) · Deep Learning
                  </span>
                  <span className="text-[11px] font-data text-[var(--color-text-tertiary)]">00Z / 12Z</span>
                </div>
                <h3 className="font-data text-scale-base font-bold text-[var(--color-text-primary)] mb-1">
                  ECMWF AIFS
                </h3>
                <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Artificial Intelligence Forecasting System. Spherical neural transformer trained on 40+ years of ERA5 reanalysis for rapid non-linear jet advection.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] font-data text-[var(--color-text-tertiary)]">
                <span>Held-Out RMSE</span>
                <span className="font-bold text-[var(--color-text-primary)]">1.105 °C</span>
              </div>
            </div>

            {/* NOAA GFS */}
            <div className="p-5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs flex flex-col justify-between hover:border-emerald-500/50 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-data text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    13 km Grid · FV3 Core
                  </span>
                  <span className="text-[11px] font-data text-[var(--color-text-tertiary)]">00Z / 06Z / 12Z / 18Z</span>
                </div>
                <h3 className="font-data text-scale-base font-bold text-[var(--color-text-primary)] mb-1">
                  NOAA GFS
                </h3>
                <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Global Forecast System. Finite-volume dynamical core with rapid synoptic update frequency, providing sensitive convective feedback over plains.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] font-data text-[var(--color-text-tertiary)]">
                <span>Held-Out RMSE</span>
                <span className="font-bold text-[var(--color-text-primary)]">2.320 °C</span>
              </div>
            </div>

            {/* DWD ICON */}
            <div className="p-5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs flex flex-col justify-between hover:border-amber-500/50 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-data text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    13 km Grid · Non-Hydrostatic
                  </span>
                  <span className="text-[11px] font-data text-[var(--color-text-tertiary)]">00Z / 06Z / 12Z / 18Z</span>
                </div>
                <h3 className="font-data text-scale-base font-bold text-[var(--color-text-primary)] mb-1">
                  DWD ICON
                </h3>
                <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Icosahedral Nonhydrostatic model. Triangular grid structure providing superior boundary stabilization over complex orography and coastal interfaces.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] font-data text-[var(--color-text-tertiary)]">
                <span>Held-Out RMSE</span>
                <span className="font-bold text-[var(--color-text-primary)]">1.131 °C</span>
              </div>
            </div>
          </div>

          {/* Truthful Key Facts Telemetry Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-[var(--color-border)]">
            <div>
              <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block font-data">
                Multi-Model Input
              </span>
              <span className="font-data text-scale-base font-bold text-[var(--color-text-primary)] block mt-0.5">
                4 Member Streams
              </span>
              <span className="text-[11px] text-[var(--color-text-tertiary)]">Aligned via Open-Meteo Gateway</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block font-data">
                Scientific Meta-Layer
              </span>
              <span className="font-data text-scale-base font-bold text-amber-600 dark:text-amber-400 block mt-0.5">
                Python XGBoost
              </span>
              <span className="text-[11px] text-[var(--color-text-tertiary)]">Predicts Model Error (Not Weather)</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block font-data">
                Held-Out Benchmark
              </span>
              <span className="font-data text-scale-base font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                0.7803 °C RMSE
              </span>
              <span className="text-[11px] text-[var(--color-text-tertiary)]">N = 4,512 vs ERA5 Reanalysis</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block font-data">
                Forecast Horizon
              </span>
              <span className="font-data text-scale-base font-bold text-[var(--color-text-primary)] block mt-0.5">
                168 Hours (7 Days)
              </span>
              <span className="text-[11px] text-[var(--color-text-tertiary)]">Capped for Physical Integrity</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: THE PROBLEM — WHY MULTI-MODEL BLENDING? ── */}
      <section id="problem" className="px-6 md:px-16 py-20 border-b border-[var(--color-border)] bg-[var(--color-panel)]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div>
            <span className="font-data text-scale-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1">
              01 / THE METEOROLOGICAL CHALLENGE
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--color-text-primary)]">
              Why single models fail in complex tropical regimes.
            </h2>
            <p className="mt-3 text-scale-base text-[var(--color-text-secondary)] max-w-3xl leading-relaxed">
              Operational meteorology does not lack raw predictions—it suffers from conflicting guidance. On any given forecast cycle, ECMWF IFS, ECMWF AIFS, NOAA GFS, and DWD ICON produce divergent trajectories across the Indian subcontinent.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {/* The Limitation of Simple Averaging */}
            <div className="p-6 md:p-8 bg-[var(--color-surface)] border border-red-500/20 rounded-[var(--radius-xl)] space-y-5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <h3 className="font-data text-scale-base font-bold text-[var(--color-text-primary)]">
                  The Flaw of Unweighted Averaging (Simple Mean)
                </h3>
              </div>
              <p className="text-scale-xs sm:text-scale-sm text-[var(--color-text-secondary)] leading-relaxed">
                Traditional multi-model consensus defaults to a fixed 25% equal split. But when NOAA GFS exhibits a systematic +2.3 °C positive bias in pre-monsoon heat conditions, blindly averaging it dilutes the high accuracy of IFS and ICON.
              </p>
              <div className="space-y-3 font-data text-scale-xs">
                <div className="flex justify-between items-center p-3 rounded-[var(--radius-md)] bg-[var(--color-panel)] border border-[var(--color-border)]">
                  <span className="text-[var(--color-text-secondary)]">Model Bias Treatment</span>
                  <span className="font-bold text-red-600 dark:text-red-400">Ignores systematic errors</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-[var(--radius-md)] bg-[var(--color-panel)] border border-[var(--color-border)]">
                  <span className="text-[var(--color-text-secondary)]">Lead Time Adaptation</span>
                  <span className="font-bold text-red-600 dark:text-red-400">Static weights at Day 1 and Day 7</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-[var(--radius-md)] bg-[var(--color-panel)] border border-[var(--color-border)]">
                  <span className="text-[var(--color-text-secondary)]">Empirical Benchmark (Held-Out)</span>
                  <span className="font-bold text-[var(--color-text-primary)]">0.960 °C RMSE · +0.170 °C Bias</span>
                </div>
              </div>
            </div>

            {/* The VARUNA Adaptive Blending Solution */}
            <div className="p-6 md:p-8 bg-[var(--color-surface)] border border-emerald-500/30 rounded-[var(--radius-xl)] space-y-5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="font-data text-scale-base font-bold text-[var(--color-text-primary)]">
                  The VARUNA Adaptive Blending Solution
                </h3>
              </div>
              <p className="text-scale-xs sm:text-scale-sm text-[var(--color-text-secondary)] leading-relaxed">
                VARUNA employs a trained XGBoost meta-model that predicts each model's expected absolute error conditioned on geographical zone, season, lead time, and recent synoptic context. It promotes the most reliable member while suppressing biased models.
              </p>
              <div className="space-y-3 font-data text-scale-xs">
                <div className="flex justify-between items-center p-3 rounded-[var(--radius-md)] bg-[var(--color-panel)] border border-[var(--color-border)]">
                  <span className="text-[var(--color-text-secondary)]">Dynamic Weight Allocation</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">0% to 100% based on predicted error</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-[var(--radius-md)] bg-[var(--color-panel)] border border-[var(--color-border)]">
                  <span className="text-[var(--color-text-secondary)]">Hamilton-Hare Normalization</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Exact integer % summing to 100%</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-[var(--radius-md)] bg-[var(--color-panel)] border border-[var(--color-border)]">
                  <span className="text-[var(--color-text-secondary)]">Empirical Benchmark (Held-Out)</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">0.7803 °C RMSE (18.7% error reduction)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: HOW VARUNA WORKS — PIPELINE ARCHITECTURE ── */}
      <section id="how-it-works" className="px-6 md:px-16 py-20 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div>
            <span className="font-data text-scale-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1">
              02 / SCIENTIFIC ARCHITECTURE
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--color-text-primary)]">
              From multi-center ingestion to verified consensus.
            </h2>
            <p className="mt-3 text-scale-base text-[var(--color-text-secondary)] max-w-3xl leading-relaxed">
              VARUNA does not generate weather forecasts from scratch—it acts as an intelligent meta-layer that learns the contextual error characteristics of the world's leading numerical and neural weather models.
            </p>
          </div>

          {/* Responsive Visual Pipeline Diagram */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="p-6 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] relative flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-data font-bold text-xs flex items-center justify-center">
                    01
                  </span>
                  <span className="text-[10px] font-data text-[var(--color-text-tertiary)] uppercase font-bold">Ingestion</span>
                </div>
                <h4 className="font-data text-scale-base font-bold text-[var(--color-text-primary)]">
                  Multi-Model Gateway
                </h4>
                <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Queries the Open-Meteo multi-model API gateway to pull operational forecasts for ECMWF IFS (9km), ECMWF AIFS (0.25°), NOAA GFS (13km), and DWD ICON (13km) for synchronized run cycles.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] text-[11px] font-data text-[var(--color-text-tertiary)]">
                Inputs: GRIB2 / NetCDF normalized streams
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-6 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] relative flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-data font-bold text-xs flex items-center justify-center">
                    02
                  </span>
                  <span className="text-[10px] font-data text-[var(--color-text-tertiary)] uppercase font-bold">Alignment</span>
                </div>
                <h4 className="font-data text-scale-base font-bold text-[var(--color-text-primary)]">
                  Spatiotemporal Alignment
                </h4>
                <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Interpolates disparate model resolutions (9km to 28km) onto identical geographic coordinates across regional centroids and synchronizes initialization and valid forecast timestamps.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] text-[11px] font-data text-[var(--color-text-tertiary)]">
                Standard: ISO-8601 UTC timesteps + lead hours
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-6 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] relative flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-data font-bold text-xs flex items-center justify-center">
                    03
                  </span>
                  <span className="text-[10px] font-data text-[var(--color-text-tertiary)] uppercase font-bold">Context</span>
                </div>
                <h4 className="font-data text-scale-base font-bold text-[var(--color-text-primary)]">
                  Contextual Feature Extraction
                </h4>
                <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Constructs the feature vector: lead time horizon (24h to 168h), seasonal cyclical factors (monsoon, post-monsoon, winter, pre-monsoon), geographical regime, elevation, and multi-model spread.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] text-[11px] font-data text-[var(--color-text-tertiary)]">
                Features: 10 structured context dimensions
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-6 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] relative flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-data font-bold text-xs flex items-center justify-center">
                    04
                  </span>
                  <span className="text-[10px] font-data text-[var(--color-text-tertiary)] uppercase font-bold">Inference</span>
                </div>
                <h4 className="font-data text-scale-base font-bold text-[var(--color-text-primary)]">
                  XGBoost Error Meta-Model
                </h4>
                <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Crucial principle: XGBoost does <em>not</em> predict temperature directly. It acts as an error meta-model, predicting expected absolute error |ŷₘ - y| for each member in the current atmospheric context.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] text-[11px] font-data text-[var(--color-text-tertiary)]">
                Engine: Trained Python XGBoost bundle
              </div>
            </div>

            {/* Step 5 */}
            <div className="p-6 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] relative flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-data font-bold text-xs flex items-center justify-center">
                    05
                  </span>
                  <span className="text-[10px] font-data text-[var(--color-text-tertiary)] uppercase font-bold">Normalization</span>
                </div>
                <h4 className="font-data text-scale-base font-bold text-[var(--color-text-primary)]">
                  Hamilton-Hare Weighting
                </h4>
                <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Raw weights are calculated via inverse squared predicted error (w ∝ 1/σ²). The Hamilton-Hare largest-remainder algorithm rounds them to exact integer percentages summing to 100%.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] text-[11px] font-data text-[var(--color-text-tertiary)]">
                Guarantee: Σ weights = 100% with 0 remainder drift
              </div>
            </div>

            {/* Step 6 */}
            <div className="p-6 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] relative flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-data font-bold text-xs flex items-center justify-center">
                    06
                  </span>
                  <span className="text-[10px] font-data text-[var(--color-text-tertiary)] uppercase font-bold">Synthesis</span>
                </div>
                <h4 className="font-data text-scale-base font-bold text-[var(--color-text-primary)]">
                  Consensus &amp; Verification
                </h4>
                <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Calculates the final weighted consensus ŷ_VARUNA = Σ(wₘ · ŷₘ). Persists the forecast into the SQLite cache and continuously validates past cycles against ERA5 reanalysis reference.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] text-[11px] font-data text-[var(--color-text-tertiary)]">
                Held-out verification: 0.7803 °C RMSE (N=4,512)
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: WHY THE WEIGHTS CHANGE — INTERACTIVE SIMULATOR ── */}
      <section id="adaptive-weighting" className="px-6 md:px-16 py-20 border-b border-[var(--color-border)] bg-[var(--color-panel)]">
        <div className="max-w-7xl mx-auto space-y-10">
          <div>
            <span className="font-data text-scale-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1">
              03 / ADAPTIVE WEIGHTING MECHANISM
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--color-text-primary)]">
              Lower predicted error yields higher ensemble weight.
            </h2>
            <p className="mt-3 text-scale-base text-[var(--color-text-secondary)] max-w-3xl leading-relaxed">
              Explore how the XGBoost meta-model rebalances member weights across meteorological regimes. Test pre-configured regimes or adjust individual model error predictions below to watch Hamilton-Hare normalization eliminate rounding drift in real-time.
            </p>
          </div>

          {/* Interactive Weight Simulator Card */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-6 md:p-8 shadow-xs space-y-8">
            {/* Preset Selector */}
            <div className="space-y-3">
              <span className="text-[11px] font-data font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block">
                Select Meteorological Context Preset:
              </span>
              <div className="grid sm:grid-cols-3 gap-3">
                {Object.values(SIMULATOR_PRESETS).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePresetSelect(p.id)}
                    className={`p-4 rounded-[var(--radius-lg)] border text-left transition-all cursor-pointer ${
                      activePreset === p.id
                        ? 'bg-[var(--color-panel)] border-amber-500 shadow-xs'
                        : 'bg-[var(--color-panel)]/50 border-[var(--color-border)] hover:bg-[var(--color-panel)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-data text-scale-xs font-bold text-[var(--color-text-primary)]">
                        {p.title}
                      </span>
                      {activePreset === p.id && (
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                      )}
                    </div>
                    <span className="text-[11px] font-data text-[var(--color-text-tertiary)] block">
                      {p.location}
                    </span>
                  </button>
                ))}
              </div>

              {activePreset !== 'custom' && (
                <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                  <span className="font-bold text-[var(--color-text-primary)]">Synoptic Context: </span>
                  {SIMULATOR_PRESETS[activePreset].description}
                </div>
              )}
            </div>

            {/* Sliders and Visual Output Grid */}
            <div className="grid lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Model Predicted Error Controls */}
              <div className="lg:col-span-6 space-y-5">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                  <span className="font-data text-scale-xs font-bold text-[var(--color-text-tertiary)] uppercase">
                    Model Predicted Error (|ŷ - y|)
                  </span>
                  <span className="text-[11px] font-data text-[var(--color-text-tertiary)]">
                    Range: 0.50 °C – 3.50 °C
                  </span>
                </div>

                {/* ECMWF IFS Slider */}
                <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-md)] space-y-2">
                  <div className="flex justify-between items-center text-scale-xs font-data">
                    <span className="font-bold text-blue-600 dark:text-blue-400">ECMWF IFS (9km NWP)</span>
                    <span className="font-bold text-[var(--color-text-primary)]">{simErrors.ecmwf_ifs.toFixed(2)} °C</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.5"
                    step="0.05"
                    value={simErrors.ecmwf_ifs}
                    onChange={(e) => handleSliderChange('ecmwf_ifs', e.target.value)}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>

                {/* ECMWF AIFS Slider */}
                <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-md)] space-y-2">
                  <div className="flex justify-between items-center text-scale-xs font-data">
                    <span className="font-bold text-purple-600 dark:text-purple-400">ECMWF AIFS (Deep Learning)</span>
                    <span className="font-bold text-[var(--color-text-primary)]">{simErrors.ecmwf_aifs.toFixed(2)} °C</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.5"
                    step="0.05"
                    value={simErrors.ecmwf_aifs}
                    onChange={(e) => handleSliderChange('ecmwf_aifs', e.target.value)}
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                </div>

                {/* NOAA GFS Slider */}
                <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-md)] space-y-2">
                  <div className="flex justify-between items-center text-scale-xs font-data">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">NOAA GFS (13km FV3)</span>
                    <span className="font-bold text-[var(--color-text-primary)]">{simErrors.ncep_gfs.toFixed(2)} °C</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.5"
                    step="0.05"
                    value={simErrors.ncep_gfs}
                    onChange={(e) => handleSliderChange('ncep_gfs', e.target.value)}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>

                {/* DWD ICON Slider */}
                <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-md)] space-y-2">
                  <div className="flex justify-between items-center text-scale-xs font-data">
                    <span className="font-bold text-amber-600 dark:text-amber-400">DWD ICON (13km NWP)</span>
                    <span className="font-bold text-[var(--color-text-primary)]">{simErrors.dwd_icon.toFixed(2)} °C</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.5"
                    step="0.05"
                    value={simErrors.dwd_icon}
                    onChange={(e) => handleSliderChange('dwd_icon', e.target.value)}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Right Column: Computed Hamilton-Hare Weights */}
              <div className="lg:col-span-6 space-y-5">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                  <span className="font-data text-scale-xs font-bold text-[var(--color-text-tertiary)] uppercase">
                    Computed Adaptive Weights (Hamilton-Hare)
                  </span>
                  <div className="flex items-center gap-1.5 font-data text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Sum: {totalWeight}% (Exact)</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* IFS Weight Bar */}
                  <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-md)] space-y-1.5">
                    <div className="flex justify-between text-scale-xs font-data">
                      <span className="text-[var(--color-text-primary)] font-semibold">ECMWF IFS</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">{weights.ecmwf_ifs}%</span>
                    </div>
                    <div className="w-full h-3 bg-[var(--color-surface)] rounded-full overflow-hidden border border-[var(--color-border)]">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${weights.ecmwf_ifs}%` }}
                      />
                    </div>
                  </div>

                  {/* AIFS Weight Bar */}
                  <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-md)] space-y-1.5">
                    <div className="flex justify-between text-scale-xs font-data">
                      <span className="text-[var(--color-text-primary)] font-semibold">ECMWF AIFS</span>
                      <span className="font-bold text-purple-600 dark:text-purple-400">{weights.ecmwf_aifs}%</span>
                    </div>
                    <div className="w-full h-3 bg-[var(--color-surface)] rounded-full overflow-hidden border border-[var(--color-border)]">
                      <div
                        className="h-full bg-purple-600 transition-all duration-300"
                        style={{ width: `${weights.ecmwf_aifs}%` }}
                      />
                    </div>
                  </div>

                  {/* GFS Weight Bar */}
                  <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-md)] space-y-1.5">
                    <div className="flex justify-between text-scale-xs font-data">
                      <span className="text-[var(--color-text-primary)] font-semibold">NOAA GFS</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{weights.ncep_gfs}%</span>
                    </div>
                    <div className="w-full h-3 bg-[var(--color-surface)] rounded-full overflow-hidden border border-[var(--color-border)]">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-300"
                        style={{ width: `${weights.ncep_gfs}%` }}
                      />
                    </div>
                  </div>

                  {/* ICON Weight Bar */}
                  <div className="p-3.5 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-md)] space-y-1.5">
                    <div className="flex justify-between text-scale-xs font-data">
                      <span className="text-[var(--color-text-primary)] font-semibold">DWD ICON</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">{weights.dwd_icon}%</span>
                    </div>
                    <div className="w-full h-3 bg-[var(--color-surface)] rounded-full overflow-hidden border border-[var(--color-border)]">
                      <div
                        className="h-full bg-amber-600 transition-all duration-300"
                        style={{ width: `${weights.dwd_icon}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Mathematical Formula Callout */}
                <div className="p-3.5 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-[var(--radius-md)] font-data text-[11px] text-[var(--color-text-secondary)] space-y-1">
                  <div className="font-bold text-[var(--color-text-primary)]">Mathematical Formulation:</div>
                  <div>1. Inverse variance: w_raw(m) = 1 / [max(error(m), 0.05)]²</div>
                  <div>2. Quotas: q(m) = w_raw(m) / Σ w_raw · 100</div>
                  <div>3. Hamilton-Hare Largest Remainder: Allocates remaining integer points to largest remainders.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: VERIFICATION & EVIDENCE ── */}
      <section id="evidence" className="px-6 md:px-16 py-20 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div>
            <span className="font-data text-scale-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1">
              04 / SCIENTIFIC BENCHMARK &amp; EVIDENCE
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--color-text-primary)]">
              Empirically proven reduction in forecast error.
            </h2>
            <p className="mt-3 text-scale-base text-[var(--color-text-secondary)] max-w-3xl leading-relaxed">
              Scientific integrity requires auditable benchmark statistics. All numbers below reflect the strict held-out test partition (<span className="font-data font-bold">N = 4,512 rows</span>) evaluated against ECMWF ERA5 atmospheric reanalysis reference data.
            </p>
          </div>

          {/* Headline Stat Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-[var(--color-panel)] border-2 border-emerald-500/50 rounded-[var(--radius-xl)] shadow-sm">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block font-data">
                VARUNA Adaptive RMSE
              </span>
              <div className="font-data text-4xl font-extrabold text-[var(--color-text-primary)] my-2">
                0.7803 <span className="text-scale-base font-normal text-[var(--color-text-secondary)]">°C</span>
              </div>
              <p className="text-scale-xs text-emerald-700 dark:text-emerald-300 font-semibold leading-relaxed">
                Lowest error across all tested NWP and AI forecasting configurations.
              </p>
            </div>

            <div className="p-6 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs">
              <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block font-data">
                Improvement vs Raw IFS
              </span>
              <div className="font-data text-4xl font-extrabold text-blue-600 dark:text-blue-400 my-2">
                34.7% <span className="text-scale-base font-normal text-[var(--color-text-secondary)]">Lower</span>
              </div>
              <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                ECMWF IFS baseline held-out RMSE: 1.195 °C.
              </p>
            </div>

            <div className="p-6 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs">
              <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block font-data">
                Improvement vs Equal Blend
              </span>
              <div className="font-data text-4xl font-extrabold text-amber-600 dark:text-amber-400 my-2">
                18.7% <span className="text-scale-base font-normal text-[var(--color-text-secondary)]">Lower</span>
              </div>
              <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                Unweighted equal-blend baseline held-out RMSE: 0.960 °C.
              </p>
            </div>

            <div className="p-6 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs">
              <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block font-data">
                Held-Out Evaluation
              </span>
              <div className="font-data text-4xl font-extrabold text-[var(--color-text-primary)] my-2">
                4,512 <span className="text-scale-base font-normal text-[var(--color-text-secondary)]">Rows</span>
              </div>
              <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                Post-Monsoon evaluation window across 6 benchmarked regions.
              </p>
            </div>
          </div>

          {/* Authoritative Benchmark Table */}
          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-data text-scale-base font-bold text-[var(--color-text-primary)]">
                  Held-Out Verification Benchmark Table
                </h3>
                <span className="text-scale-xs text-[var(--color-text-secondary)]">
                  Ground Truth Reference: ECMWF ERA5 Reanalysis · Variable: 2m Temperature (°C) · N = 4,512 test rows
                </span>
              </div>
              <Link
                to="/skill"
                className="px-3.5 py-1.5 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-scale-xs font-data font-bold text-[var(--color-text-primary)] transition-colors flex items-center gap-1.5"
              >
                <span>Full Lead Time Breakdown</span>
                <span>→</span>
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-data text-scale-xs">
                <thead className="bg-[var(--color-surface)] border-b border-[var(--color-border)] text-[var(--color-text-tertiary)] uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-6">System / Forecast Member</th>
                    <th className="py-3 px-6">Architecture / Grid</th>
                    <th className="py-3 px-6 text-right">RMSE (°C)</th>
                    <th className="py-3 px-6 text-right">MAE (°C)</th>
                    <th className="py-3 px-6 text-right">Mean Bias (°C)</th>
                    <th className="py-3 px-6 text-right">Pearson Correlation (r)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {BENCHMARK_SYSTEMS.map((sys, idx) => (
                    <tr
                      key={idx}
                      className={
                        sys.highlight
                          ? 'bg-amber-500/10 font-bold'
                          : 'hover:bg-[var(--color-surface)]/60 transition-colors'
                      }
                    >
                      <td className="py-3.5 px-6 flex items-center gap-2">
                        {sys.highlight && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        )}
                        <span className={sys.highlight ? 'text-amber-700 dark:text-amber-300' : 'text-[var(--color-text-primary)]'}>
                          {sys.name}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-[var(--color-text-secondary)]">{sys.type}</td>
                      <td className="py-3.5 px-6 text-right font-bold text-[var(--color-text-primary)]">{sys.rmse}</td>
                      <td className="py-3.5 px-6 text-right text-[var(--color-text-secondary)]">{sys.mae}</td>
                      <td className="py-3.5 px-6 text-right text-[var(--color-text-secondary)]">{sys.bias}</td>
                      <td className="py-3.5 px-6 text-right text-[var(--color-text-primary)] font-semibold">{sys.r}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-[var(--color-surface)] border-t border-[var(--color-border)] text-[11px] font-data text-[var(--color-text-tertiary)] flex flex-wrap items-center justify-between gap-2">
              <span>* Data source: varuna-backend/reports/blend_test_results.csv</span>
              <span>Scope: 6 representative Indian agro-climatic zones (Post-Monsoon evaluation window)</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: OPERATIONAL COVERAGE — 12 REGIONAL GRIDS ── */}
      <section id="coverage" className="px-6 md:px-16 py-20 border-b border-[var(--color-border)] bg-[var(--color-panel)]">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <span className="font-data text-scale-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1">
                05 / GEOGRAPHIC SCOPE
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--color-text-primary)]">
                12 Operational regional monitoring zones.
              </h2>
              <p className="mt-3 text-scale-base text-[var(--color-text-secondary)] max-w-3xl leading-relaxed">
                VARUNA provides operational monitoring across 12 distinct agro-climatic zones in India. To preserve scientific honesty, the 6 regions with complete historical reanalysis benchmark evidence are clearly distinguished from active operational regional grids.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 p-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] self-start shrink-0 font-data text-scale-xs">
              <button
                onClick={() => setRegionFilter('all')}
                className={`px-3 py-1.5 rounded-[var(--radius-md)] font-bold transition-all cursor-pointer ${
                  regionFilter === 'all'
                    ? 'bg-[var(--color-panel)] text-[var(--color-text-primary)] shadow-xs'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                All 12 Regions
              </button>
              <button
                onClick={() => setRegionFilter('benchmarked')}
                className={`px-3 py-1.5 rounded-[var(--radius-md)] font-bold transition-all cursor-pointer ${
                  regionFilter === 'benchmarked'
                    ? 'bg-[var(--color-panel)] text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                6 Benchmarked (ERA5)
              </button>
              <button
                onClick={() => setRegionFilter('active')}
                className={`px-3 py-1.5 rounded-[var(--radius-md)] font-bold transition-all cursor-pointer ${
                  regionFilter === 'active'
                    ? 'bg-[var(--color-panel)] text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                6 Active Regional Grids
              </button>
            </div>
          </div>

          {/* Regional Cards Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRegions.map((region) => (
              <div
                key={region.id}
                className="p-5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs hover:border-[var(--color-border-strong)] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-data font-bold px-2 py-0.5 rounded ${
                        region.benchmarked
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {region.benchmarked ? 'ERA5 BENCHMARKED' : 'ACTIVE REGIONAL GRID'}
                    </span>
                    <span className="font-data text-[11px] text-[var(--color-text-tertiary)]">
                      {region.elevation}
                    </span>
                  </div>

                  <h4 className="font-data text-scale-base font-bold text-[var(--color-text-primary)] mb-0.5">
                    {region.name}
                  </h4>
                  <div className="text-scale-xs text-[var(--color-text-tertiary)] mb-2 font-medium">
                    {region.state}
                  </div>
                  <div className="text-scale-xs text-[var(--color-text-secondary)] font-normal leading-snug">
                    {region.zone}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between font-data text-[11px] text-[var(--color-text-tertiary)]">
                  <span>{region.lat.toFixed(2)}°N, {region.lon.toFixed(2)}°E</span>
                  <Link
                    to="/command-centre"
                    className="text-[var(--color-text-primary)] hover:underline font-bold"
                  >
                    Inspect →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center pt-4">
            <Link
              to="/command-centre"
              className="px-6 py-3 bg-[var(--color-panel)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-scale-sm font-bold text-[var(--color-text-primary)] transition-all shadow-xs flex items-center gap-2"
            >
              <span>Explore All 12 Regional Dashboards in Command Centre</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── SECTION 7: OPERATIONAL DATA MODES ── */}
      <section id="modes" className="px-6 md:px-16 py-20 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div>
            <span className="font-data text-scale-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1">
              06 / DATA INTEGRITY &amp; AUDITABILITY
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--color-text-primary)]">
              Three distinct operational modes. Zero fabricated telemetry.
            </h2>
            <p className="mt-3 text-scale-base text-[var(--color-text-secondary)] max-w-3xl leading-relaxed">
              A foundational principle of VARUNA is transparent data provenance. The platform makes an unmistakable architectural distinction between live multi-model queries, caching layers, and archival replays.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* LIVE Mode */}
            <div className="p-6 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-data text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  LIVE MODE
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h3 className="font-data text-scale-base font-bold text-[var(--color-text-primary)]">
                Real-Time Gateway Ingestion
              </h3>
              <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                Direct queries to the Open-Meteo multi-model gateway. Retrieves the latest 00Z/06Z/12Z/18Z forecast cycles from ECMWF, NOAA, and DWD, passing them directly to the Python XGBoost inference pipeline.
              </p>
              <div className="pt-3 border-t border-[var(--color-border)] font-data text-[11px] text-[var(--color-text-tertiary)]">
                Status: Operational multi-model live path
              </div>
            </div>

            {/* CACHED Mode */}
            <div className="p-6 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-data text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  CACHED MODE
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              </div>
              <h3 className="font-data text-scale-base font-bold text-[var(--color-text-primary)]">
                Local SQLite Cycle Cache
              </h3>
              <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                Fast response caching managed by local SQLite database. Operates within the defined cycle TTL (Time-To-Live) window to eliminate redundant external bandwidth while preserving bit-for-bit numerical fidelity.
              </p>
              <div className="pt-3 border-t border-[var(--color-border)] font-data text-[11px] text-[var(--color-text-tertiary)]">
                Latency: &lt; 10 ms local retrieval
              </div>
            </div>

            {/* REPLAY Mode */}
            <div className="p-6 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-data text-[11px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  REPLAY MODE
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              </div>
              <h3 className="font-data text-scale-base font-bold text-[var(--color-text-primary)]">
                Historical Verified Archive
              </h3>
              <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                Committed multi-season historical archive. Enables deterministic reproduction of past forecast cycles, regression testing, and scientific audit without reliance on external live internet connectivity.
              </p>
              <div className="pt-3 border-t border-[var(--color-border)] font-data text-[11px] text-[var(--color-text-tertiary)]">
                Dataset: 4 multi-season forecast cycles
              </div>
            </div>
          </div>

          <div className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] text-scale-xs text-[var(--color-text-secondary)] flex items-center gap-3">
            <span className="font-data font-bold text-amber-600 dark:text-amber-400">AUDIT GUARANTEE:</span>
            <span>
              When external APIs are unreachable or offline, the system falls back to REPLAY or CACHED mode—it never fabricates fake telemetry and labels it as live.
            </span>
          </div>
        </div>
      </section>

      {/* ── SECTION 8: WHAT THE PLATFORM PROVIDES ── */}
      <section id="platform" className="px-6 md:px-16 py-20 border-b border-[var(--color-border)] bg-[var(--color-panel)]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div>
            <span className="font-data text-scale-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1">
              07 / PLATFORM WORKSPACE
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--color-text-primary)]">
              Operational modules for meteorologists and evaluators.
            </h2>
            <p className="mt-3 text-scale-base text-[var(--color-text-secondary)] max-w-3xl leading-relaxed">
              Every screen in the VARUNA interface serves a specific operational and analytical purpose. Click any module below to inspect the live interface.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Command Centre */}
            <Link
              to="/command-centre"
              className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-amber-500 rounded-[var(--radius-xl)] shadow-xs transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <span className="text-[10px] font-data font-bold text-[var(--color-text-tertiary)] uppercase">
                  Workspace 01
                </span>
                <h3 className="font-data text-scale-base font-bold text-[var(--color-text-primary)] group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  Command Centre
                </h3>
                <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Geospatial situational awareness overview with regional map markers, multi-lead time selector (24h to 168h), and active meteorological threshold alerts.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between font-data text-scale-xs font-bold text-[var(--color-text-primary)]">
                <span>Open Dashboard</span>
                <span>→</span>
              </div>
            </Link>

            {/* Forecast Workspace */}
            <Link
              to="/forecast"
              className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-amber-500 rounded-[var(--radius-xl)] shadow-xs transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <span className="text-[10px] font-data font-bold text-[var(--color-text-tertiary)] uppercase">
                  Workspace 02
                </span>
                <h3 className="font-data text-scale-base font-bold text-[var(--color-text-primary)] group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  Forecast Workspace
                </h3>
                <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Deep-dive multi-model member comparison. Inspect individual trajectories (IFS, AIFS, GFS, ICON), view adaptive vs equal weights, and explore the 7-day timeline.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between font-data text-scale-xs font-bold text-[var(--color-text-primary)]">
                <span>Compare Models</span>
                <span>→</span>
              </div>
            </Link>

            {/* Models Benchmarks */}
            <Link
              to="/models"
              className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-amber-500 rounded-[var(--radius-xl)] shadow-xs transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <span className="text-[10px] font-data font-bold text-[var(--color-text-tertiary)] uppercase">
                  Workspace 03
                </span>
                <h3 className="font-data text-scale-base font-bold text-[var(--color-text-primary)] group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  Model Architectures
                </h3>
                <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                  In-depth technical profiles of the 4 ensemble members: physical dynamical cores, neural architectures, spatial grid resolutions, and update cycles.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between font-data text-scale-xs font-bold text-[var(--color-text-primary)]">
                <span>View Architectures</span>
                <span>→</span>
              </div>
            </Link>

            {/* Verification Skill */}
            <Link
              to="/skill"
              className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-amber-500 rounded-[var(--radius-xl)] shadow-xs transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <span className="text-[10px] font-data font-bold text-[var(--color-text-tertiary)] uppercase">
                  Workspace 04
                </span>
                <h3 className="font-data text-scale-base font-bold text-[var(--color-text-primary)] group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  Verification Skill
                </h3>
                <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Authoritative held-out scientific metrics. Lead time degradation curves (24h to 120h), seasonal performance matrices, and region skill comparisons vs ERA5.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between font-data text-scale-xs font-bold text-[var(--color-text-primary)]">
                <span>Explore Metrics</span>
                <span>→</span>
              </div>
            </Link>

            {/* Extremes Watch */}
            <Link
              to="/extremes"
              className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-amber-500 rounded-[var(--radius-xl)] shadow-xs transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <span className="text-[10px] font-data font-bold text-[var(--color-text-tertiary)] uppercase">
                  Workspace 05
                </span>
                <h3 className="font-data text-scale-base font-bold text-[var(--color-text-primary)] group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  Extremes Watch
                </h3>
                <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Operational threshold monitoring calibrated to IMD meteorological guidelines. Tracks heatwaves (Tmax &gt; 40°C), heavy rainfall (&gt;64.5mm/24h), and high-wind events.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between font-data text-scale-xs font-bold text-[var(--color-text-primary)]">
                <span>Monitor Extremes</span>
                <span>→</span>
              </div>
            </Link>

            {/* Explainability */}
            <Link
              to="/explainability"
              className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-amber-500 rounded-[var(--radius-xl)] shadow-xs transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <span className="text-[10px] font-data font-bold text-[var(--color-text-tertiary)] uppercase">
                  Workspace 06
                </span>
                <h3 className="font-data text-scale-base font-bold text-[var(--color-text-primary)] group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  Explainability &amp; SHAP
                </h3>
                <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Feature importance and decision attribution for the XGBoost meta-model. Inspect how diurnal cycle, lead time, and regional context influence model trust.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between font-data text-scale-xs font-bold text-[var(--color-text-primary)]">
                <span>Inspect Attribution</span>
                <span>→</span>
              </div>
            </Link>

            {/* System Health */}
            <Link
              to="/system"
              className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-amber-500 rounded-[var(--radius-xl)] shadow-xs transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <span className="text-[10px] font-data font-bold text-[var(--color-text-tertiary)] uppercase">
                  Workspace 07
                </span>
                <h3 className="font-data text-scale-base font-bold text-[var(--color-text-primary)] group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  System &amp; Pipeline Health
                </h3>
                <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Operational diagnostics for the Python FastAPI backend, multi-model gateway status, SQLite cache integrity, and active ensemble member availability.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between font-data text-scale-xs font-bold text-[var(--color-text-primary)]">
                <span>Check System Status</span>
                <span>→</span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ── SECTION 9: SCIENTIFIC BOUNDARIES & DISCLOSURES ── */}
      <section id="boundaries" className="px-6 md:px-16 py-16 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto space-y-8">
          <div>
            <span className="font-data text-scale-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1">
              08 / TRANSPARENT METHODOLOGY
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--color-text-primary)]">
              Scientific scope and current technical boundaries.
            </h2>
            <p className="mt-2 text-scale-xs sm:text-scale-sm text-[var(--color-text-secondary)] max-w-3xl leading-relaxed">
              To ensure genuine scientific credibility for evaluators and judges, the VARUNA project maintains complete transparency regarding its current validation scope and roadmap.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] space-y-1.5">
              <span className="font-data text-[11px] font-bold text-amber-600 dark:text-amber-400 block">
                1. Temperature-Only Adaptive ML
              </span>
              <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                Adaptive XGBoost error modeling is currently validated for 2-metre temperature. Rainfall, wind speed, and surface pressure currently use an equal-weight ensemble fallback and are explicitly unvalidated.
              </p>
            </div>

            <div className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] space-y-1.5">
              <span className="font-data text-[11px] font-bold text-amber-600 dark:text-amber-400 block">
                2. 168-Hour Horizon Cap
              </span>
              <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                Operational forecasts are capped at 168 hours (7 days). Medium-range predictions beyond 7 days are not deterministic and are excluded to prevent unscientific drift.
              </p>
            </div>

            <div className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] space-y-1.5">
              <span className="font-data text-[11px] font-bold text-amber-600 dark:text-amber-400 block">
                3. ERA5 Reanalysis as Reference
              </span>
              <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                Historical verification is conducted against ECMWF ERA5 atmospheric reanalysis (0.25° grid). ERA5 is a high-resolution reanalysis reference, not direct surface station observations.
              </p>
            </div>

            <div className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] space-y-1.5">
              <span className="font-data text-[11px] font-bold text-amber-600 dark:text-amber-400 block">
                4. IMD AWS Telemetry Pending
              </span>
              <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                Live integration with India Meteorological Department (IMD) Automatic Weather Station (AWS) networks is currently in pending status awaiting official API access.
              </p>
            </div>

            <div className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] space-y-1.5">
              <span className="font-data text-[11px] font-bold text-amber-600 dark:text-amber-400 block">
                5. 6-Region Benchmark Scope
              </span>
              <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                The empirical benchmark report validates 6 representative Indian agro-climatic zones; the remaining 6 regions operate as active operational regional grids.
              </p>
            </div>

            <div className="p-4 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-lg)] space-y-1.5">
              <span className="font-data text-[11px] font-bold text-amber-600 dark:text-amber-400 block">
                6. Multi-Model Gateway Ingestion
              </span>
              <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed">
                Ensemble member forecasts are retrieved through the Open-Meteo multi-model API gateway rather than direct proprietary ECMWF/NOAA high-performance computing ingestion lines.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 10: FINAL CTA & SUMMARY ── */}
      <section className="px-6 md:px-16 py-20 bg-[var(--color-panel)] border-b border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-[11px] font-bold text-amber-700 dark:text-amber-300 font-data uppercase tracking-wider">
            <span>VARUNA · ADAPTIVE WEATHER INTELLIGENCE</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[var(--color-text-primary)] tracking-tight">
            Four forecast systems. <br />
            <span className="text-[var(--color-accent-hover)]">One adaptive synthesis.</span>
          </h2>

          <p className="text-scale-base sm:text-scale-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto leading-relaxed">
            Evidence-backed verification, transparent machine learning error attribution, and operational regional forecasts across the Indian subcontinent.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              to="/command-centre"
              className="px-8 py-3.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-slate-950 font-bold text-scale-sm rounded-[var(--radius-md)] transition-all shadow-md flex items-center gap-2"
            >
              <span>Launch Command Centre</span>
              <span>→</span>
            </Link>
            <Link
              to="/skill"
              className="px-8 py-3.5 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-primary)] font-bold text-scale-sm rounded-[var(--radius-md)] transition-all shadow-xs"
            >
              Explore Verification
            </Link>
            <Link
              to="/system"
              className="px-6 py-3.5 text-scale-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              System Telemetry →
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="mt-auto py-8 px-6 md:px-16 bg-[var(--color-panel)] text-scale-xs text-[var(--color-text-secondary)] flex flex-col md:flex-row items-center justify-between gap-4 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-2 font-data">
          <span className="font-bold text-[var(--color-text-primary)]">VARUNA</span>
          <span>— Adaptive Weather Intelligence | SIH 2026 Project</span>
        </div>
        <div className="font-data text-[11px] text-[var(--color-text-tertiary)] text-center md:text-right">
          ECMWF IFS (9km) · ECMWF AIFS (0.25°) · NOAA GFS (13km) · DWD ICON (13km) · ERA5 Reanalysis Benchmark
        </div>
      </footer>
    </div>
  );
}
