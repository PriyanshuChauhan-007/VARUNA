import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[#CBDCE6] dark:border-[#1E334D] bg-[#E7EFF5] dark:bg-[#0B1524] text-[var(--varuna-text)] font-sans transition-colors">
      <div className="max-w-7xl mx-auto px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Col 1 & 2: Project Brand & Mission */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--varuna-blue)] text-white flex items-center justify-center shadow-xs shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                  <path d="M13 13l-3 5h4l-2 5" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="font-bold tracking-tight text-scale-base text-[var(--varuna-text)] leading-none">
                  VARUNA
                </span>
                <span className="text-[10px] font-semibold text-[var(--varuna-text-secondary)] tracking-wider uppercase mt-0.5">
                  Hybrid AI–NWP Forecast Intelligence
                </span>
              </div>
            </div>

            <p className="text-scale-xs text-[var(--varuna-text-secondary)] leading-relaxed max-w-sm">
              Adaptive multi-model meteorological consensus blending ECMWF IFS, ECMWF AIFS, NOAA GFS, and DWD ICON using machine learning error estimation and historical ERA5 reanalysis reference.
            </p>

            <div className="p-3 bg-white/70 dark:bg-[#121F33]/80 rounded-[var(--radius-md)] border border-[#CBDCE6] dark:border-[#1E334D] text-[11px] font-data text-[var(--varuna-text-secondary)] space-y-0.5 shadow-2xs">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--varuna-text)]">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Authoritative Scientific Core</span>
              </div>
              <p className="text-[10px] text-[var(--varuna-text-muted)]">
                FastAPI Python Backend · XGBoost Meta-Model · Hamilton-Hare Weighting
              </p>
            </div>
          </div>

          {/* Col 3: Workspaces & Project */}
          <div className="space-y-3">
            <h4 className="font-data text-[11px] font-bold uppercase tracking-wider text-[var(--varuna-text)]">
              Workspaces
            </h4>
            <ul className="space-y-2 text-scale-xs text-[var(--varuna-text-secondary)]">
              <li>
                <Link to="/command-centre" className="hover:text-[var(--varuna-blue)] transition-colors">
                  Command Centre
                </Link>
              </li>
              <li>
                <Link to="/forecast" className="hover:text-[var(--varuna-blue)] transition-colors">
                  Forecast Workspace
                </Link>
              </li>
              <li>
                <Link to="/models" className="hover:text-[var(--varuna-blue)] transition-colors">
                  Model Architectures
                </Link>
              </li>
              <li>
                <Link to="/skill" className="hover:text-[var(--varuna-blue)] transition-colors">
                  Verification Skill
                </Link>
              </li>
              <li>
                <Link to="/extremes" className="hover:text-[var(--varuna-blue)] transition-colors">
                  Extremes Watch
                </Link>
              </li>
              <li>
                <Link to="/explainability" className="hover:text-[var(--varuna-blue)] transition-colors">
                  Explainability &amp; SHAP
                </Link>
              </li>
              <li>
                <Link to="/system" className="hover:text-[var(--varuna-blue)] transition-colors">
                  System Health
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Data & Scientific References */}
          <div className="space-y-3">
            <h4 className="font-data text-[11px] font-bold uppercase tracking-wider text-[var(--varuna-text)]">
              Scientific References
            </h4>
            <ul className="space-y-2 text-scale-xs text-[var(--varuna-text-secondary)]">
              <li>
                <a
                  href="https://open-meteo.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--varuna-blue)] transition-colors flex items-center gap-1"
                >
                  <span>Open-Meteo Gateway</span>
                  <span className="text-[10px] opacity-60">↗</span>
                </a>
              </li>
              <li>
                <a
                  href="https://www.ecmwf.int/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--varuna-blue)] transition-colors flex items-center gap-1"
                >
                  <span>ECMWF (IFS &amp; AIFS)</span>
                  <span className="text-[10px] opacity-60">↗</span>
                </a>
              </li>
              <li>
                <a
                  href="https://www.noaa.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--varuna-blue)] transition-colors flex items-center gap-1"
                >
                  <span>NOAA (GFS / NCEP)</span>
                  <span className="text-[10px] opacity-60">↗</span>
                </a>
              </li>
              <li>
                <a
                  href="https://www.dwd.de/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--varuna-blue)] transition-colors flex items-center gap-1"
                >
                  <span>DWD (ICON Model)</span>
                  <span className="text-[10px] opacity-60">↗</span>
                </a>
              </li>
              <li>
                <a
                  href="https://cds.climate.copernicus.eu/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--varuna-blue)] transition-colors flex items-center gap-1"
                >
                  <span>ERA5 Reanalysis (Copernicus)</span>
                  <span className="text-[10px] opacity-60">↗</span>
                </a>
              </li>
              <li>
                <a
                  href="https://mausam.imd.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--varuna-blue)] transition-colors flex items-center gap-1"
                >
                  <span>IMD Guidelines (Mausam)</span>
                  <span className="text-[10px] opacity-60">↗</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Col 5: Resources & Documentation */}
          <div className="space-y-3">
            <h4 className="font-data text-[11px] font-bold uppercase tracking-wider text-[var(--varuna-text)]">
              Resources
            </h4>
            <ul className="space-y-2 text-scale-xs text-[var(--varuna-text-secondary)]">
              <li>
                <Link to="/models" className="hover:text-[var(--varuna-blue)] transition-colors">
                  Methodology &amp; Optimization
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/prakhar9642/VARUNA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--varuna-blue)] transition-colors flex items-center gap-1"
                >
                  <span>GitHub Repository</span>
                  <span className="text-[10px] opacity-60">↗</span>
                </a>
              </li>
              <li>
                <Link to="/forecast" className="hover:text-[var(--varuna-blue)] transition-colors">
                  Live Forecasting Demo
                </Link>
              </li>
              <li>
                <span className="text-[var(--varuna-text-muted)] block text-[11px]">
                  SIH Problem SIH26081
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Attribution Notice */}
        <div className="mt-12 pt-6 border-t border-[#CBDCE6] dark:border-[#1E334D] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-data text-[#5C7484] dark:text-[#7A93A6]">
          <div className="flex items-center gap-2">
            <span>Built for Smart India Hackathon 2026</span>
            <span>•</span>
            <span>© VARUNA Weather Intelligence</span>
          </div>
          <div className="text-center sm:text-right">
            Verification reference: ERA5 reanalysis (0.25°), not station observations. Reference links do not imply direct operational telemetry.
          </div>
        </div>
      </div>
    </footer>
  );
}
