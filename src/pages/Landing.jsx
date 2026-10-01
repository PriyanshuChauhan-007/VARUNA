import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import Footer from '../components/layout/Footer';

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


// Real operational reference model weights (Delhi NCR · Temperature · +48h)
const MODEL_CONTRIBUTION_DATA = [
  { name: 'ECMWF AIFS', value: 41, color: '#0284C7' },  // cyan/blue
  { name: 'ECMWF IFS', value: 34, color: '#1E40AF' },   // deep blue
  { name: 'DWD ICON', value: 18, color: '#64748B' },    // slate
  { name: 'NOAA GFS', value: 7, color: '#0D9488' },     // teal
];

// Methodology coverage across the 4 monitored atmospheric variables
const METHODOLOGY_COVERAGE_DATA = [
  { name: 'Adaptive ML Validated (Temp)', value: 1, color: '#2F7FB5' },
  { name: 'Equal-Weight Fallback (Rain, Wind, Press)', value: 3, color: '#94A3B8' },
];

// Verified Temperature Benchmark RMSE comparison (°C)
const BENCHMARK_CHART_DATA = [
  { model: 'ECMWF IFS', rmse: 1.195, fill: '#1E40AF' },
  { model: 'ECMWF AIFS', rmse: 1.105, fill: '#0284C7' },
  { model: 'NOAA GFS', rmse: 2.320, fill: '#0D9488' },
  { model: 'DWD ICON', rmse: 1.131, fill: '#64748B' },
  { model: 'VARUNA (Blend)', rmse: 0.780, fill: '#245F89' },
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
 * Exact Hamilton-Hare largest remainder algorithm
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

// 5 Stages for "How VARUNA Works"
const HOW_VARUNA_WORKS_STAGES = [
  {
    step: '01',
    title: 'Acquire',
    subtitle: 'ECMWF IFS · ECMWF AIFS · NOAA GFS · DWD ICON',
    description: 'Ingests synchronized 00Z/12Z numerical weather prediction and transformer-based neural model streams across India via the high-availability Open-Meteo multi-model gateway.',
    badge: '4 Forecast Streams',
  },
  {
    step: '02',
    title: 'Compare',
    subtitle: 'Model disagreement and contextual signals',
    description: 'Spatially interpolates disparate resolutions onto regional centroids, computing inter-model variance, multi-center ensemble spread, diurnal cycle phase, and synoptic regime indicators.',
    badge: 'Spatial Alignment',
  },
  {
    step: '03',
    title: 'Predict Error',
    subtitle: 'XGBoost estimates contextual member error',
    description: 'The trained Python XGBoost meta-model evaluates the 12-dimensional contextual feature vector, estimating the expected absolute error |ŷₘ - y| for each member under current atmospheric conditions.',
    badge: 'Meta-Error Inference',
  },
  {
    step: '04',
    title: 'Adapt Weights',
    subtitle: 'Inverse-squared-error weighting',
    description: 'Raw weights are calculated inversely proportional to expected error variance (w ∝ 1/σ²). The Hamilton-Hare apportionment algorithm rounds them to exact integer percentages summing to 100%.',
    badge: 'Hamilton-Hare (100%)',
  },
  {
    step: '05',
    title: 'Blend',
    subtitle: 'VARUNA consensus forecast',
    description: 'Synthesizes the optimal calibrated consensus forecast ŷ_VARUNA = Σ(wₘ · ŷₘ) with transparent member attribution, physical boundary clamping, and auditable confidence intervals.',
    badge: '0.780 °C Held-Out RMSE',
  },
];

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
    <div className="min-h-screen bg-[var(--varuna-bg)] text-[var(--varuna-text)] flex flex-col font-sans transition-colors">
      {/* ── TOP NAVIGATION BAR ── */}
      <header className="h-16 px-6 md:px-12 flex items-center justify-between border-b border-[var(--varuna-border)] bg-[var(--varuna-surface)]/95 backdrop-blur-md sticky top-0 z-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--varuna-blue)] text-white flex items-center justify-center shadow-xs shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
              <path d="M13 13l-3 5h4l-2 5" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-scale-base font-bold tracking-tight text-[var(--varuna-text)] leading-none">
              VARUNA
            </span>
            <span className="text-[10px] font-data font-semibold text-[var(--varuna-text-secondary)] tracking-wider mt-0.5">
              HYBRID AI–NWP BLENDING
            </span>
          </div>
        </div>

        <nav className="hidden xl:flex items-center gap-6 text-scale-xs font-semibold text-[var(--varuna-text-secondary)]">
          <a href="#overview" className="hover:text-[var(--varuna-blue)] transition-colors">Overview</a>
          <a href="#how-it-works" className="hover:text-[var(--varuna-blue)] transition-colors">How It Works</a>
          <a href="#data-visualizations" className="hover:text-[var(--varuna-blue)] transition-colors">Visualizations</a>
          <a href="#adaptive-weighting" className="hover:text-[var(--varuna-blue)] transition-colors">Adaptive Weights</a>
          <a href="#evidence" className="hover:text-[var(--varuna-blue)] transition-colors">Verification</a>
          <a href="#coverage" className="hover:text-[var(--varuna-blue)] transition-colors">12 Regions</a>
          <a href="#boundaries" className="hover:text-[var(--varuna-blue)] transition-colors">Boundaries</a>
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--varuna-border)] bg-[var(--varuna-surface-soft)] text-[11px] font-data text-[var(--varuna-text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>4 ENSEMBLE MEMBERS · FASTAPI SCIENTIFIC CORE</span>
          </div>

          <Link
            to="/command-centre"
            className="px-4 py-2 bg-[var(--varuna-blue)] hover:bg-[var(--varuna-blue-dark)] text-white font-bold text-scale-xs rounded-[var(--radius-md)] transition-all shadow-xs flex items-center gap-1.5"
          >
            <span>Launch Command Centre</span>
            <span>→</span>
          </Link>
        </div>
      </header>

      {/* ── SECTION 1: HERO — DISTINCT ATMOSPHERIC VISUAL NARRATIVE ── */}
      <section id="overview" className="relative px-6 md:px-16 pt-16 pb-20 border-b border-[var(--varuna-border)] atmospheric-contour-bg overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-12 relative z-10">
          {/* Eyebrow & Headline (Exact Section 8 Text) */}
          <div className="max-w-4xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--varuna-border-strong)] bg-[var(--varuna-blue-light)] text-[11px] font-bold text-[var(--varuna-blue-dark)] font-data uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[var(--varuna-blue)] animate-pulse" />
              <span>ECMWF IFS · ECMWF AIFS · NOAA GFS · DWD ICON · OPEN-METEO GATEWAY</span>
            </div>

            <div className="space-y-2">
              <div className="font-data text-[12px] font-bold tracking-widest text-[var(--varuna-blue)] uppercase">
                VARUNA
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--varuna-text)] leading-[1.1]">
                Hybrid AI–NWP <br />
                <span className="text-[var(--varuna-blue)]">Forecast Intelligence</span>
              </h1>
            </div>

            <p className="text-scale-base sm:text-scale-lg text-[var(--varuna-text-secondary)] font-normal leading-relaxed max-w-3xl">
              IFS · AIFS · GFS · ICON <br className="hidden sm:inline" />
              Adaptive ensemble forecasting with uncertainty and model attribution. Reconciles divergent numerical physics and transformer models dynamically for India.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/command-centre"
                className="px-6 py-3 bg-[var(--varuna-blue)] hover:bg-[var(--varuna-blue-dark)] text-white font-bold text-scale-sm rounded-[var(--radius-md)] transition-all shadow-md flex items-center gap-2"
              >
                <span>Launch Command Centre</span>
                <span>→</span>
              </Link>
              <a
                href="#how-it-works"
                className="px-6 py-3 bg-[var(--varuna-surface)] hover:bg-[var(--varuna-surface-soft)] border border-[var(--varuna-border)] text-[var(--varuna-text)] font-semibold text-scale-sm rounded-[var(--radius-md)] transition-all shadow-xs flex items-center gap-2"
              >
                <span>See How VARUNA Works</span>
                <span>↓</span>
              </a>
              <Link
                to="/skill"
                className="px-5 py-3 text-scale-sm font-semibold text-[var(--varuna-text-secondary)] hover:text-[var(--varuna-blue)] transition-colors"
              >
                View Verification Evidence →
              </Link>
            </div>
          </div>

          {/* 4 Ensemble Member Cards (Scientific Palette) */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* ECMWF IFS (Deep Blue) */}
            <div className="p-5 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-xl)] shadow-xs flex flex-col justify-between hover:border-blue-500/50 hover:shadow-sm transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-data text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    9 km Grid · NWP
                  </span>
                  <span className="text-[11px] font-data text-[var(--varuna-text-muted)]">00Z / 12Z</span>
                </div>
                <h3 className="font-data text-scale-base font-bold text-[var(--varuna-text)] mb-1">
                  ECMWF IFS
                </h3>
                <p className="text-scale-xs text-[var(--varuna-text-secondary)] leading-relaxed">
                  Integrated Forecasting System. Global hydrostatic primitive-equation physics anchor with high-resolution thermodynamic mass conservation.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--varuna-border)] flex items-center justify-between text-[11px] font-data text-[var(--varuna-text-muted)]">
                <span>Held-Out RMSE</span>
                <span className="font-bold text-[var(--varuna-text)]">1.195 °C</span>
              </div>
            </div>

            {/* ECMWF AIFS (Cyan / Sky Blue) */}
            <div className="p-5 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-xl)] shadow-xs flex flex-col justify-between hover:border-sky-500/50 hover:shadow-sm transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-data text-[11px] font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                    0.25° (~28km) · Deep Learning
                  </span>
                  <span className="text-[11px] font-data text-[var(--varuna-text-muted)]">00Z / 12Z</span>
                </div>
                <h3 className="font-data text-scale-base font-bold text-[var(--varuna-text)] mb-1">
                  ECMWF AIFS
                </h3>
                <p className="text-scale-xs text-[var(--varuna-text-secondary)] leading-relaxed">
                  Artificial Intelligence Forecasting System. Spherical neural transformer trained on 40+ years of ERA5 reanalysis for rapid jet advection.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--varuna-border)] flex items-center justify-between text-[11px] font-data text-[var(--varuna-text-muted)]">
                <span>Held-Out RMSE</span>
                <span className="font-bold text-[var(--varuna-text)]">1.105 °C</span>
              </div>
            </div>

            {/* NOAA GFS (Teal) */}
            <div className="p-5 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-xl)] shadow-xs flex flex-col justify-between hover:border-teal-500/50 hover:shadow-sm transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-data text-[11px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                    13 km Grid · FV3 Core
                  </span>
                  <span className="text-[11px] font-data text-[var(--varuna-text-muted)]">00Z / 06Z / 12Z / 18Z</span>
                </div>
                <h3 className="font-data text-scale-base font-bold text-[var(--varuna-text)] mb-1">
                  NOAA GFS
                </h3>
                <p className="text-scale-xs text-[var(--varuna-text-secondary)] leading-relaxed">
                  Global Forecast System. Finite-volume dynamical core with rapid synoptic update frequency, capturing convective feedback over plains.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--varuna-border)] flex items-center justify-between text-[11px] font-data text-[var(--varuna-text-muted)]">
                <span>Held-Out RMSE</span>
                <span className="font-bold text-[var(--varuna-text)]">2.320 °C</span>
              </div>
            </div>

            {/* DWD ICON (Slate) */}
            <div className="p-5 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-xl)] shadow-xs flex flex-col justify-between hover:border-slate-500/50 hover:shadow-sm transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-data text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    13 km Grid · Non-Hydrostatic
                  </span>
                  <span className="text-[11px] font-data text-[var(--varuna-text-muted)]">00Z / 06Z / 12Z / 18Z</span>
                </div>
                <h3 className="font-data text-scale-base font-bold text-[var(--varuna-text)] mb-1">
                  DWD ICON
                </h3>
                <p className="text-scale-xs text-[var(--varuna-text-secondary)] leading-relaxed">
                  Icosahedral Nonhydrostatic model. Triangular grid structure providing superior boundary stabilization over orography and coastlines.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--varuna-border)] flex items-center justify-between text-[11px] font-data text-[var(--varuna-text-muted)]">
                <span>Held-Out RMSE</span>
                <span className="font-bold text-[var(--varuna-text)]">1.131 °C</span>
              </div>
            </div>
          </div>

          {/* Truthful Key Facts Telemetry Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-[var(--varuna-border)]">
            <div>
              <span className="text-[10px] font-bold text-[var(--varuna-text-muted)] uppercase tracking-wider block font-data">
                Multi-Model Input
              </span>
              <span className="font-data text-scale-base font-bold text-[var(--varuna-text)] block mt-0.5">
                4 Member Streams
              </span>
              <span className="text-[11px] text-[var(--varuna-text-secondary)]">Aligned via Open-Meteo Gateway</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[var(--varuna-text-muted)] uppercase tracking-wider block font-data">
                Scientific Meta-Layer
              </span>
              <span className="font-data text-scale-base font-bold text-[var(--varuna-blue)] block mt-0.5">
                Python XGBoost
              </span>
              <span className="text-[11px] text-[var(--varuna-text-secondary)]">Predicts Model Error (Not Weather)</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[var(--varuna-text-muted)] uppercase tracking-wider block font-data">
                Held-Out Benchmark
              </span>
              <span className="font-data text-scale-base font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                0.7803 °C RMSE
              </span>
              <span className="text-[11px] text-[var(--varuna-text-secondary)]">N = 4,512 vs ERA5 Reanalysis</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[var(--varuna-text-muted)] uppercase tracking-wider block font-data">
                Forecast Horizon
              </span>
              <span className="font-data text-scale-base font-bold text-[var(--varuna-text)] block mt-0.5">
                168 Hours (7 Days)
              </span>
              <span className="text-[11px] text-[var(--varuna-text-secondary)]">Capped for Physical Integrity</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: SCROLL-BASED STAGE TRANSITIONS — HOW VARUNA WORKS (Section 9) ── */}
      <section id="how-it-works" className="px-6 md:px-16 py-20 border-b border-[var(--varuna-border)] bg-[var(--varuna-surface)]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div>
            <span className="font-data text-scale-xs font-bold text-[var(--varuna-text-muted)] uppercase tracking-wider block mb-1">
              02 / FORECAST PIPELINE ARCHITECTURE
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--varuna-text)]">
              How VARUNA Works
            </h2>
            <p className="mt-3 text-scale-base text-[var(--varuna-text-secondary)] max-w-3xl leading-relaxed">
              Step through the 5 distinct operational stages of adaptive blending. VARUNA executes this pipeline across initialization cycles to transform raw competing model outputs into one verified consensus.
            </p>
          </div>

          {/* Vertical scroll-revealed stages with smooth Framer Motion transitions */}
          <div className="space-y-4">
            {HOW_VARUNA_WORKS_STAGES.map((stage, idx) => (
              <motion.div
                key={stage.step}
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.28, delay: idx * 0.05 }}
                className="p-6 md:p-7 bg-[var(--varuna-surface-soft)] border border-[var(--varuna-border)] rounded-[var(--radius-xl)] shadow-2xs hover:border-[var(--varuna-blue)] hover:bg-[var(--varuna-surface)] transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="flex items-start gap-4 md:gap-6">
                  {/* Step Number Circle */}
                  <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--varuna-blue-light)] text-[var(--varuna-blue-dark)] font-data font-extrabold text-scale-md flex items-center justify-center shrink-0 border border-[var(--varuna-border-strong)]">
                    {stage.step}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="font-data text-scale-lg font-bold text-[var(--varuna-text)]">
                        {stage.title}
                      </h3>
                      <span className="text-[11px] font-data font-semibold text-[var(--varuna-blue-dark)] px-2 py-0.5 rounded bg-[var(--varuna-blue-light)] border border-[var(--varuna-border)]">
                        {stage.badge}
                      </span>
                    </div>

                    <div className="text-scale-xs font-semibold text-[var(--varuna-text-secondary)]">
                      {stage.subtitle}
                    </div>

                    <p className="text-scale-xs sm:text-scale-sm text-[var(--varuna-text-secondary)] leading-relaxed pt-1 max-w-3xl">
                      {stage.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 self-start md:self-center font-data text-[11px] text-[var(--varuna-text-muted)] border-t md:border-t-0 md:border-l border-[var(--varuna-border)] pt-2 md:pt-0 md:pl-6">
                  STAGE {idx + 1} OF 5
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 3: HOMEPAGE DATA VISUALIZATIONS (Sections 10, 11, 12, 13) ── */}
      <section id="data-visualizations" className="px-6 md:px-16 py-20 border-b border-[var(--varuna-border)] bg-[var(--varuna-bg)]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div>
            <span className="font-data text-scale-xs font-bold text-[var(--varuna-text-muted)] uppercase tracking-wider block mb-1">
              03 / AUDITABLE DATA VISUALIZATION
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--varuna-text)]">
              Empirical evidence &amp; model allocation.
            </h2>
            <p className="mt-3 text-scale-base text-[var(--varuna-text-secondary)] max-w-3xl leading-relaxed">
              Transparent visualization of operational model contribution, methodology validation status across monitored variables, and verified held-out benchmark accuracy.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CHART 1: Model Contribution (Section 10) */}
            <div className="p-6 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-xl)] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-data text-scale-sm font-bold text-[var(--varuna-text)] uppercase tracking-wider">
                    Model Contribution
                  </h3>
                  <span className="text-[10px] font-data font-semibold px-2 py-0.5 rounded bg-[var(--varuna-blue-light)] text-[var(--varuna-blue-dark)]">
                    100% Total
                  </span>
                </div>
                <p className="text-[11px] text-[var(--varuna-text-muted)] font-data mb-4">
                  Reference: Delhi NCR · Temperature · +48h
                </p>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={MODEL_CONTRIBUTION_DATA}
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {MODEL_CONTRIBUTION_DATA.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--varuna-surface)',
                          borderColor: 'var(--varuna-border)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontFamily: 'var(--font-data)',
                        }}
                        formatter={(val) => [`${val}% Weight`, 'Allocation']}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-data)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--varuna-border)] text-[11px] font-data text-[var(--varuna-text-secondary)]">
                AIFS 41% · IFS 34% · ICON 18% · GFS 7%
              </div>
            </div>

            {/* CHART 2: Forecast Methodology Coverage (Section 11) */}
            <div className="p-6 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-xl)] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-data text-scale-sm font-bold text-[var(--varuna-text)] uppercase tracking-wider">
                    Forecast Methodology Coverage
                  </h3>
                  <span className="text-[10px] font-data font-semibold px-2 py-0.5 rounded bg-[var(--varuna-surface-soft)] text-[var(--varuna-text-secondary)] border border-[var(--varuna-border)]">
                    4 Variables
                  </span>
                </div>
                <p className="text-[11px] text-[var(--varuna-text-muted)] font-data mb-4">
                  Validation Scope: Temperature vs Others
                </p>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={METHODOLOGY_COVERAGE_DATA}
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {METHODOLOGY_COVERAGE_DATA.map((entry, index) => (
                          <Cell key={`cell-cov-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--varuna-surface)',
                          borderColor: 'var(--varuna-border)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontFamily: 'var(--font-data)',
                        }}
                        formatter={(val, name) => [`${val} variable(s)`, name]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-data)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--varuna-border)] text-[11px] font-data text-[var(--varuna-text-secondary)]">
                1 Adaptive ML Validated · 3 Equal-Weight Fallback
              </div>
            </div>

            {/* CHART 3: Temperature Benchmark RMSE (Section 12) */}
            <div className="p-6 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-xl)] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-data text-scale-sm font-bold text-[var(--varuna-text)] uppercase tracking-wider">
                    Temperature Benchmark RMSE
                  </h3>
                  <span className="text-[10px] font-data font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    -34.7% Error
                  </span>
                </div>
                <p className="text-[11px] text-[var(--varuna-text-muted)] font-data mb-4">
                  Held-out benchmark (N = 4,512) · ERA5 reanalysis reference
                </p>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={BENCHMARK_CHART_DATA}
                      margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--varuna-border)" vertical={false} />
                      <XAxis
                        dataKey="model"
                        tick={{ fontSize: 10, fill: 'var(--varuna-text-secondary)', fontFamily: 'var(--font-data)' }}
                        angle={-15}
                        textAnchor="end"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'var(--varuna-text-secondary)', fontFamily: 'var(--font-data)' }}
                        domain={[0, 2.5]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--varuna-surface)',
                          borderColor: 'var(--varuna-border)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontFamily: 'var(--font-data)',
                        }}
                        formatter={(val) => [`${val} °C`, 'RMSE']}
                      />
                      <Bar dataKey="rmse" radius={[4, 4, 0, 0]}>
                        {BENCHMARK_CHART_DATA.map((entry, index) => (
                          <Cell key={`bar-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--varuna-border)] text-[11px] font-data text-[var(--varuna-text-secondary)]">
                VARUNA Blend achieves 0.780 °C vs IFS 1.195 °C
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: INTERACTIVE WEIGHT SIMULATOR ── */}
      <section id="adaptive-weighting" className="px-6 md:px-16 py-20 border-b border-[var(--varuna-border)] bg-[var(--varuna-surface)]">
        <div className="max-w-7xl mx-auto space-y-10">
          <div>
            <span className="font-data text-scale-xs font-bold text-[var(--varuna-text-muted)] uppercase tracking-wider block mb-1">
              04 / INTERACTIVE ADAPTIVE WEIGHTING
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--varuna-text)]">
              Lower predicted error yields higher ensemble weight.
            </h2>
            <p className="mt-3 text-scale-base text-[var(--varuna-text-secondary)] max-w-3xl leading-relaxed">
              Explore how the XGBoost meta-model rebalances member weights across meteorological regimes. Test pre-configured regimes or adjust individual model error predictions below to watch Hamilton-Hare normalization eliminate rounding drift in real-time.
            </p>
          </div>

          {/* Interactive Weight Simulator Card */}
          <div className="bg-[var(--varuna-surface-soft)] border border-[var(--varuna-border)] rounded-[var(--radius-xl)] p-6 md:p-8 shadow-xs space-y-8">
            {/* Preset Selector */}
            <div className="space-y-3">
              <span className="text-[11px] font-data font-bold text-[var(--varuna-text-muted)] uppercase tracking-wider block">
                Select Meteorological Context Preset:
              </span>
              <div className="grid sm:grid-cols-3 gap-3">
                {Object.values(SIMULATOR_PRESETS).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePresetSelect(p.id)}
                    className={`p-4 rounded-[var(--radius-lg)] border text-left transition-all cursor-pointer ${
                      activePreset === p.id
                        ? 'bg-[var(--varuna-surface)] border-[var(--varuna-blue)] shadow-xs'
                        : 'bg-[var(--varuna-surface)]/60 border-[var(--varuna-border)] hover:bg-[var(--varuna-surface)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-data text-scale-xs font-bold text-[var(--varuna-text)]">
                        {p.title}
                      </span>
                      {activePreset === p.id && (
                        <span className="w-2 h-2 rounded-full bg-[var(--varuna-blue)]" />
                      )}
                    </div>
                    <span className="text-[11px] font-data text-[var(--varuna-text-secondary)] block">
                      {p.location}
                    </span>
                  </button>
                ))}
              </div>

              {activePreset !== 'custom' && (
                <div className="p-3.5 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-md)] text-scale-xs text-[var(--varuna-text-secondary)] leading-relaxed">
                  <span className="font-bold text-[var(--varuna-text)]">Synoptic Context: </span>
                  {SIMULATOR_PRESETS[activePreset].description}
                </div>
              )}
            </div>

            {/* Sliders and Visual Output Grid */}
            <div className="grid lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Model Predicted Error Controls */}
              <div className="lg:col-span-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--varuna-border)] pb-2">
                  <span className="font-data text-scale-xs font-bold text-[var(--varuna-text-muted)] uppercase">
                    Model Predicted Error (|ŷ - y|)
                  </span>
                  <span className="text-[11px] font-data text-[var(--varuna-text-muted)]">
                    Range: 0.50 °C – 3.50 °C
                  </span>
                </div>

                {/* ECMWF IFS Slider */}
                <div className="p-3 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-md)] space-y-1.5">
                  <div className="flex justify-between items-center text-scale-xs font-data">
                    <span className="font-bold text-blue-700 dark:text-blue-400">ECMWF IFS (9km NWP)</span>
                    <span className="font-bold text-[var(--varuna-text)]">{simErrors.ecmwf_ifs.toFixed(2)} °C</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.5"
                    step="0.05"
                    value={simErrors.ecmwf_ifs}
                    onChange={(e) => handleSliderChange('ecmwf_ifs', e.target.value)}
                    className="w-full accent-blue-700 cursor-pointer"
                  />
                </div>

                {/* ECMWF AIFS Slider */}
                <div className="p-3 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-md)] space-y-1.5">
                  <div className="flex justify-between items-center text-scale-xs font-data">
                    <span className="font-bold text-sky-700 dark:text-sky-400">ECMWF AIFS (Deep Learning)</span>
                    <span className="font-bold text-[var(--varuna-text)]">{simErrors.ecmwf_aifs.toFixed(2)} °C</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.5"
                    step="0.05"
                    value={simErrors.ecmwf_aifs}
                    onChange={(e) => handleSliderChange('ecmwf_aifs', e.target.value)}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                {/* NOAA GFS Slider */}
                <div className="p-3 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-md)] space-y-1.5">
                  <div className="flex justify-between items-center text-scale-xs font-data">
                    <span className="font-bold text-teal-700 dark:text-teal-400">NOAA GFS (13km FV3)</span>
                    <span className="font-bold text-[var(--varuna-text)]">{simErrors.ncep_gfs.toFixed(2)} °C</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.5"
                    step="0.05"
                    value={simErrors.ncep_gfs}
                    onChange={(e) => handleSliderChange('ncep_gfs', e.target.value)}
                    className="w-full accent-teal-600 cursor-pointer"
                  />
                </div>

                {/* DWD ICON Slider */}
                <div className="p-3 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-md)] space-y-1.5">
                  <div className="flex justify-between items-center text-scale-xs font-data">
                    <span className="font-bold text-slate-700 dark:text-slate-400">DWD ICON (13km NWP)</span>
                    <span className="font-bold text-[var(--varuna-text)]">{simErrors.dwd_icon.toFixed(2)} °C</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.5"
                    step="0.05"
                    value={simErrors.dwd_icon}
                    onChange={(e) => handleSliderChange('dwd_icon', e.target.value)}
                    className="w-full accent-slate-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Right Column: Computed Hamilton-Hare Weights */}
              <div className="lg:col-span-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--varuna-border)] pb-2">
                  <span className="font-data text-scale-xs font-bold text-[var(--varuna-text-muted)] uppercase">
                    Computed Adaptive Weights (Hamilton-Hare)
                  </span>
                  <div className="flex items-center gap-1.5 font-data text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    <span>Sum: {totalWeight}%</span>
                    <span>✓</span>
                  </div>
                </div>

                {/* Weight Bars */}
                <div className="space-y-3">
                  {/* IFS Bar */}
                  <div className="p-3 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-md)] space-y-1">
                    <div className="flex justify-between text-scale-xs font-data">
                      <span className="font-bold text-blue-700 dark:text-blue-400">ECMWF IFS</span>
                      <span className="font-bold text-[var(--varuna-text)]">{weights.ecmwf_ifs}%</span>
                    </div>
                    <div className="w-full h-2 bg-[var(--varuna-surface-soft)] rounded-full overflow-hidden border border-[var(--varuna-border)]">
                      <div className="h-full bg-blue-700 transition-all duration-300" style={{ width: `${weights.ecmwf_ifs}%` }} />
                    </div>
                  </div>

                  {/* AIFS Bar */}
                  <div className="p-3 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-md)] space-y-1">
                    <div className="flex justify-between text-scale-xs font-data">
                      <span className="font-bold text-sky-700 dark:text-sky-400">ECMWF AIFS</span>
                      <span className="font-bold text-[var(--varuna-text)]">{weights.ecmwf_aifs}%</span>
                    </div>
                    <div className="w-full h-2 bg-[var(--varuna-surface-soft)] rounded-full overflow-hidden border border-[var(--varuna-border)]">
                      <div className="h-full bg-sky-600 transition-all duration-300" style={{ width: `${weights.ecmwf_aifs}%` }} />
                    </div>
                  </div>

                  {/* GFS Bar */}
                  <div className="p-3 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-md)] space-y-1">
                    <div className="flex justify-between text-scale-xs font-data">
                      <span className="font-bold text-teal-700 dark:text-teal-400">NOAA GFS</span>
                      <span className="font-bold text-[var(--varuna-text)]">{weights.ncep_gfs}%</span>
                    </div>
                    <div className="w-full h-2 bg-[var(--varuna-surface-soft)] rounded-full overflow-hidden border border-[var(--varuna-border)]">
                      <div className="h-full bg-teal-600 transition-all duration-300" style={{ width: `${weights.ncep_gfs}%` }} />
                    </div>
                  </div>

                  {/* ICON Bar */}
                  <div className="p-3 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-md)] space-y-1">
                    <div className="flex justify-between text-scale-xs font-data">
                      <span className="font-bold text-slate-700 dark:text-slate-400">DWD ICON</span>
                      <span className="font-bold text-[var(--varuna-text)]">{weights.dwd_icon}%</span>
                    </div>
                    <div className="w-full h-2 bg-[var(--varuna-surface-soft)] rounded-full overflow-hidden border border-[var(--varuna-border)]">
                      <div className="h-full bg-slate-600 transition-all duration-300" style={{ width: `${weights.dwd_icon}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: GEOGRAPHIC SCOPE — 12 REGIONAL GRIDS ── */}
      <section id="coverage" className="px-6 md:px-16 py-20 border-b border-[var(--varuna-border)] bg-[var(--varuna-bg)]">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <span className="font-data text-scale-xs font-bold text-[var(--varuna-text-muted)] uppercase tracking-wider block mb-1">
                05 / GEOGRAPHIC SCOPE
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--varuna-text)]">
                12 Operational regional monitoring zones.
              </h2>
              <p className="mt-3 text-scale-base text-[var(--varuna-text-secondary)] max-w-3xl leading-relaxed">
                VARUNA provides operational monitoring across 12 distinct agro-climatic zones in India. Historical temperature benchmark available for 6 configured regions, distinguished from active operational regional grids.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 p-1 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-lg)] self-start shrink-0 font-data text-scale-xs">
              <button
                onClick={() => setRegionFilter('all')}
                className={`px-3 py-1.5 rounded-[var(--radius-md)] font-bold transition-all cursor-pointer ${
                  regionFilter === 'all'
                    ? 'bg-[var(--varuna-blue)] text-white shadow-xs'
                    : 'text-[var(--varuna-text-secondary)] hover:text-[var(--varuna-text)]'
                }`}
              >
                All 12 Regions
              </button>
              <button
                onClick={() => setRegionFilter('benchmarked')}
                className={`px-3 py-1.5 rounded-[var(--radius-md)] font-bold transition-all cursor-pointer ${
                  regionFilter === 'benchmarked'
                    ? 'bg-[var(--varuna-blue)] text-white shadow-xs'
                    : 'text-[var(--varuna-text-secondary)] hover:text-[var(--varuna-text)]'
                }`}
              >
                6 Regions (Temp Benchmark)
              </button>
              <button
                onClick={() => setRegionFilter('active')}
                className={`px-3 py-1.5 rounded-[var(--radius-md)] font-bold transition-all cursor-pointer ${
                  regionFilter === 'active'
                    ? 'bg-[var(--varuna-blue)] text-white shadow-xs'
                    : 'text-[var(--varuna-text-secondary)] hover:text-[var(--varuna-text)]'
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
                className="p-5 bg-[var(--varuna-surface)] border border-[var(--varuna-border)] rounded-[var(--radius-xl)] shadow-xs hover:border-[var(--varuna-border-strong)] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-data font-bold px-2 py-0.5 rounded ${
                        region.benchmarked
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      }`}
                    >
                      {region.benchmarked ? 'ERA5 TEMP BENCHMARK' : 'ACTIVE REGIONAL GRID'}
                    </span>
                    <span className="font-data text-[11px] text-[var(--varuna-text-muted)]">
                      {region.elevation}
                    </span>
                  </div>

                  <h4 className="font-data text-scale-base font-bold text-[var(--varuna-text)] mb-0.5">
                    {region.name}
                  </h4>
                  <div className="text-scale-xs text-[var(--varuna-text-muted)] mb-2 font-medium">
                    {region.state}
                  </div>
                  <div className="text-scale-xs text-[var(--varuna-text-secondary)] font-normal leading-snug">
                    {region.zone}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--varuna-border)] flex items-center justify-between font-data text-[11px] text-[var(--varuna-text-muted)]">
                  <span>{region.lat.toFixed(2)}°N, {region.lon.toFixed(2)}°E</span>
                  <Link
                    to="/command-centre"
                    className="text-[var(--varuna-blue)] hover:underline font-bold"
                  >
                    Inspect →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 6: SCIENTIFIC BOUNDARIES & METHODOLOGY DISCLOSURES ── */}
      <section id="boundaries" className="px-6 md:px-16 py-16 bg-[var(--varuna-surface)] border-b border-[var(--varuna-border)]">
        <div className="max-w-7xl mx-auto space-y-8">
          <div>
            <span className="font-data text-scale-xs font-bold text-[var(--varuna-text-muted)] uppercase tracking-wider block mb-1">
              06 / TRANSPARENT METHODOLOGY
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--varuna-text)]">
              Scientific scope and operational boundaries.
            </h2>
            <p className="mt-2 text-scale-xs sm:text-scale-sm text-[var(--varuna-text-secondary)] max-w-3xl leading-relaxed">
              Complete transparency regarding validation scope and current operational integrations.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-[var(--varuna-surface-soft)] border border-[var(--varuna-border)] rounded-[var(--radius-lg)] space-y-1.5">
              <span className="font-data text-[11px] font-bold text-[var(--varuna-blue-dark)] block">
                1. Temperature-Only Adaptive ML
              </span>
              <p className="text-scale-xs text-[var(--varuna-text-secondary)] leading-relaxed">
                Adaptive XGBoost error modeling is currently validated for 2m temperature. Rainfall, wind speed, and pressure use equal-weight fallback (25% each) and are unvalidated.
              </p>
            </div>

            <div className="p-4 bg-[var(--varuna-surface-soft)] border border-[var(--varuna-border)] rounded-[var(--radius-lg)] space-y-1.5">
              <span className="font-data text-[11px] font-bold text-[var(--varuna-blue-dark)] block">
                2. 168-Hour Horizon Cap
              </span>
              <p className="text-scale-xs text-[var(--varuna-text-secondary)] leading-relaxed">
                Operational forecasts are capped at 168 hours (7 days). Horizons beyond 7 days are non-deterministic and excluded to prevent synthetic drift.
              </p>
            </div>

            <div className="p-4 bg-[var(--varuna-surface-soft)] border border-[var(--varuna-border)] rounded-[var(--radius-lg)] space-y-1.5">
              <span className="font-data text-[11px] font-bold text-[var(--varuna-blue-dark)] block">
                3. ERA5 Reanalysis as Reference
              </span>
              <p className="text-scale-xs text-[var(--varuna-text-secondary)] leading-relaxed">
                Historical verification is conducted against ECMWF ERA5 atmospheric reanalysis (0.25° grid). ERA5 is a reanalysis reference, not station ground truth.
              </p>
            </div>

            <div className="p-4 bg-[var(--varuna-surface-soft)] border border-[var(--varuna-border)] rounded-[var(--radius-lg)] space-y-1.5">
              <span className="font-data text-[11px] font-bold text-[var(--varuna-blue-dark)] block">
                4. IMD AWS Telemetry Pending
              </span>
              <p className="text-scale-xs text-[var(--varuna-text-secondary)] leading-relaxed">
                Direct integration with India Meteorological Department (IMD) Automatic Weather Station networks is currently in pending integration status.
              </p>
            </div>

            <div className="p-4 bg-[var(--varuna-surface-soft)] border border-[var(--varuna-border)] rounded-[var(--radius-lg)] space-y-1.5">
              <span className="font-data text-[11px] font-bold text-[var(--varuna-blue-dark)] block">
                5. 6-Region Benchmark Scope
              </span>
              <p className="text-scale-xs text-[var(--varuna-text-secondary)] leading-relaxed">
                The held-out benchmark report validates 6 representative agro-climatic zones; the remaining 6 regions operate as active operational regional grids.
              </p>
            </div>

            <div className="p-4 bg-[var(--varuna-surface-soft)] border border-[var(--varuna-border)] rounded-[var(--radius-lg)] space-y-1.5">
              <span className="font-data text-[11px] font-bold text-[var(--varuna-blue-dark)] block">
                6. Multi-Model Gateway Ingestion
              </span>
              <p className="text-scale-xs text-[var(--varuna-text-secondary)] leading-relaxed">
                Ensemble member forecasts are retrieved through the Open-Meteo multi-model API gateway rather than direct proprietary computing lines.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── GLOBAL SCIENTIFIC FOOTER ── */}
      <Footer />
    </div>
  );
}
