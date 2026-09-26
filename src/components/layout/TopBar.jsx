import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';

export default function TopBar() {
  const searchQuery = useStore((s) => s.filters.searchQuery);
  const setFilter = useStore((s) => s.setFilter);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const effectiveMode = useStore((s) => s.effectiveMode);
  const syncStatus = useStore((s) => s.syncStatus);

  return (
    <header className="flex items-center justify-between h-16 px-4 md:px-6 bg-[var(--color-panel)] border-b border-[var(--color-border)] shrink-0 backdrop-blur-md z-30 transition-colors">
      {/* Left: product brand */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-accent)] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
            {/* Technical Weather Emblem */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1A17" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
              <path d="M13 13l-3 5h4l-2 5" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-scale-base font-bold tracking-tight text-[var(--color-text-primary)] leading-none">
              VARUNA
            </span>
            <span className="text-[9px] font-semibold tracking-wider text-[var(--color-text-tertiary)] uppercase mt-0.5">
              Adaptive Weather Intelligence
            </span>
          </div>
        </Link>

        {/* System operational mode indicator */}
        <div className="flex items-center gap-2 ml-3 pl-3 border-l border-[var(--color-border)]">
          <span className="relative flex h-2 w-2">
            <span
              className={`inline-flex rounded-full h-2 w-2 ${
                effectiveMode === 'LIVE'
                  ? 'bg-emerald-500 animate-ping'
                  : effectiveMode === 'REPLAY'
                  ? 'bg-blue-500'
                  : 'bg-amber-500'
              }`}
            />
          </span>
          <span className="text-scale-xs text-[var(--color-text-secondary)] font-data hidden xs:inline tabular-nums">
            {effectiveMode === 'LIVE'
              ? 'LIVE SYNC · 00Z'
              : effectiveMode === 'REPLAY'
              ? 'REPLAY MODE · 00Z ARCHIVE'
              : syncStatus === 'FALLBACK_DEMO'
              ? 'DEMO MODE · LIVE STANDBY'
              : 'DEMO MODE · 00Z REF'}
          </span>
        </div>
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-sm mx-4">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search regions, zones, regimes..."
            value={searchQuery}
            onChange={(e) => setFilter('searchQuery', e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-scale-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-colors"
          />
        </div>
      </div>

      {/* Right: Technical Meta & Theme Toggle */}
      <div className="flex items-center gap-3 text-scale-xs text-[var(--color-text-secondary)] shrink-0">
        <span className="font-data hidden sm:inline">IFS · AIFS · GFS</span>
        <div className="w-px h-4 bg-[var(--color-border)] hidden sm:block" />
        <span className="font-data font-semibold text-[var(--color-accent)] hidden sm:inline">SIH 2026</span>
        <div className="w-px h-4 bg-[var(--color-border)] hidden sm:block" />

        {/* Dark/Light mode toggle */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
        </button>

        {/* Operational Disclaimer tooltip */}
        <span
          className="inline-flex items-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors cursor-help"
          title="VARUNA Adaptive Weather Intelligence: Multi-model adaptive ensemble blending ECMWF IFS, AIFS, and NOAA GFS with contextual XGBoost error estimation and historical reference evaluation (IMD AWS integration pending)."
          aria-label="Operational Disclaimer"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </span>
      </div>
    </header>
  );
}
