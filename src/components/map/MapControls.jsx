import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useMap } from './mapContext';
import { useStore } from '../../store/useStore';
import { REGIONS, VARIABLES, MODELS } from '../../data/mockData.js';

export default function MapControls() {
  const { flyTo, changeBasemap, basemap, viewCoords } = useMap() || {};
  const selectedVariable = useStore((s) => s.selectedVariable);
  const setVariable = useStore((s) => s.setVariable);
  const selectedModelLayer = useStore((s) => s.selectedModelLayer);
  const setModelLayer = useStore((s) => s.setModelLayer);
  const selectRegion = useStore((s) => s.selectRegion);
  const setFilter = useStore((s) => s.setFilter);
  const effectiveMode = useStore((s) => s.effectiveMode);

  const mapControlsDrawerOpen = useStore((s) => s.mapControlsDrawerOpen);
  const setMapControlsDrawerOpen = useStore((s) => s.setMapControlsDrawerOpen);
  const toggleMapControlsDrawer = useStore((s) => s.toggleMapControlsDrawer);

  const reduceMotion = useReducedMotion();

  const [searchValue, setSearchValue] = useState('');
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMapControlsDrawerOpen(false);
    };
    if (mapControlsDrawerOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mapControlsDrawerOpen, setMapControlsDrawerOpen]);

  const handleSearch = (e) => {
    e?.preventDefault();
    if (!searchValue.trim()) return;

    // Check lat, lng format
    const coordMatch = searchValue.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (flyTo) flyTo([lng, lat], 9);
      return;
    }

    // Check matching region
    const term = searchValue.toLowerCase().trim();
    const match = REGIONS.find(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.state.toLowerCase().includes(term) ||
        r.id.toLowerCase().includes(term)
    );

    if (match) {
      if (flyTo) flyTo([match.lng, match.lat], 8.5);
      selectRegion(match.id);
    } else {
      setFilter('searchQuery', searchValue);
    }
  };

  const handleLocateCoords = (e) => {
    e?.preventDefault();
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!isNaN(lat) && !isNaN(lng) && flyTo) {
      flyTo([lng, lat], 9);
    }
  };

  const BASEMAP_OPTIONS = [
    { id: 'satellite', label: 'Satellite', desc: 'High-res earth imagery' },
    { id: 'dark', label: 'Dark Matter', desc: 'High contrast night map' },
    { id: 'nasa_gibs', label: 'NASA GIBS', desc: 'True-color atmosphere stream' },
    { id: 'nasa_night', label: 'Night Marble', desc: 'Global night-light radiance' },
  ];

  return (
    <>
      {/* ── ON-MAP COMPACT TRIGGER & STATUS BAR (Top Left) ── */}
      <div className="absolute top-3.5 left-3.5 z-10 flex flex-wrap items-center gap-2 max-w-[calc(100%-80px)] pointer-events-auto">
        {/* The ONE compact Map Controls button */}
        <button
          onClick={toggleMapControlsDrawer}
          className={`
            h-9 px-3.5 rounded-[var(--radius-md)] flex items-center gap-2 font-sans text-scale-xs font-bold transition-all shadow-md cursor-pointer border
            ${
              mapControlsDrawerOpen
                ? 'bg-[var(--varuna-blue)] text-white border-[var(--varuna-blue-dark)] ring-2 ring-[var(--varuna-blue-light)]'
                : 'bg-[var(--varuna-surface)] hover:bg-[var(--varuna-surface-soft)] text-[var(--varuna-text)] border-[var(--varuna-border)]'
            }
          `}
          title="Open Map Controls Drawer"
          aria-label="Map Controls"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
          <span>Map Controls</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--varuna-blue)]" />
        </button>

        {/* Lightweight atmospheric coordinate pill */}
        <div className="hidden sm:flex items-center gap-2 bg-[var(--varuna-surface)]/90 backdrop-blur-md px-3 h-9 rounded-[var(--radius-md)] border border-[var(--varuna-border)] shadow-xs text-[11px] font-data text-[var(--varuna-text-secondary)]">
          <span className="text-[var(--varuna-blue)] font-bold">VARUNA NWP-AI</span>
          <span className="text-[var(--varuna-border-strong)]">•</span>
          <span className="tabular-nums">
            @{viewCoords?.lat ?? '22.59'}, {viewCoords?.lng ?? '78.96'}, {viewCoords?.zoom ?? '4.5'}z
          </span>
          <span className="text-[var(--varuna-border-strong)]">•</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--varuna-blue-light)] text-[var(--varuna-blue-dark)]">
            {effectiveMode === 'LIVE' ? 'Live Stream' : effectiveMode === 'REPLAY' ? 'Replay' : 'Cached'}
          </span>
        </div>
      </div>

      {/* ── RIGHT-SIDE POPUP CONTROL DRAWER (Width: 320px - 380px) ── */}
      <AnimatePresence>
        {mapControlsDrawerOpen && (
          <>
            {/* Subtle backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-[#0C1726]/30 z-30 backdrop-blur-[2px]"
              onClick={() => setMapControlsDrawerOpen(false)}
            />

            {/* Right Drawer Panel */}
            <motion.aside
              initial={reduceMotion ? { opacity: 0 } : { x: '100%' }}
              animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
              exit={reduceMotion ? { opacity: 1 } : { x: '100%' }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }
              }
              className="fixed top-0 right-0 bottom-0 w-[340px] sm:w-[380px] max-w-[92vw] bg-[var(--varuna-surface)] border-l border-[var(--varuna-border)] z-40 flex flex-col shadow-2xl overflow-hidden font-sans"
              role="dialog"
              aria-label="Map Controls Panel"
            >
              {/* Drawer Header */}
              <div className="h-14 px-5 border-b border-[var(--varuna-border)] flex items-center justify-between shrink-0 bg-[var(--varuna-surface)]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--varuna-blue-light)] text-[var(--varuna-blue-dark)] flex items-center justify-center">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-scale-sm font-bold text-[var(--varuna-text)] uppercase tracking-wider">
                      Map Controls
                    </h2>
                    <span className="text-[10px] text-[var(--varuna-text-muted)] font-data block">
                      GEOSPATIAL &amp; LAYER CONFIGURATION
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setMapControlsDrawerOpen(false)}
                  className="w-8 h-8 rounded-[var(--radius-md)] hover:bg-[var(--varuna-surface-soft)] text-[var(--varuna-text-secondary)] hover:text-[var(--varuna-text)] flex items-center justify-center transition-colors cursor-pointer"
                  title="Close Map Controls (Esc)"
                  aria-label="Close"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Drawer Scrollable Body with Clean Grouping */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* 1. Location / Search & Locate */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[var(--varuna-border)] pb-1.5">
                    <span className="text-[11px] font-bold text-[var(--varuna-text-secondary)] uppercase font-data tracking-wider">
                      Location / Search
                    </span>
                    <span className="text-[10px] text-[var(--varuna-text-muted)] font-data">COORDINATES &amp; ZONES</span>
                  </div>

                  {/* Text search */}
                  <form onSubmit={handleSearch} className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search region, city or lat, lng..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="w-full h-8 pl-8 pr-2.5 text-scale-xs bg-[var(--varuna-surface-soft)] border border-[var(--varuna-border)] rounded-[var(--radius-md)] text-[var(--varuna-text)] placeholder:text-[var(--varuna-text-muted)] focus:outline-none focus:border-[var(--varuna-blue)] focus:bg-[var(--varuna-surface)]"
                      />
                      <svg
                        className="absolute left-2.5 top-2 text-[var(--varuna-text-muted)]"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Lat (e.g. 28.61)"
                        value={latInput}
                        onChange={(e) => setLatInput(e.target.value)}
                        className="flex-1 h-8 px-2.5 text-scale-xs font-data bg-[var(--varuna-surface-soft)] border border-[var(--varuna-border)] rounded-[var(--radius-md)] text-[var(--varuna-text)] placeholder:text-[var(--varuna-text-muted)]"
                      />
                      <input
                        type="text"
                        placeholder="Lng (e.g. 77.20)"
                        value={lngInput}
                        onChange={(e) => setLngInput(e.target.value)}
                        className="flex-1 h-8 px-2.5 text-scale-xs font-data bg-[var(--varuna-surface-soft)] border border-[var(--varuna-border)] rounded-[var(--radius-md)] text-[var(--varuna-text)] placeholder:text-[var(--varuna-text-muted)]"
                      />
                      <button
                        type="button"
                        onClick={handleLocateCoords}
                        className="h-8 px-3 bg-[var(--varuna-blue)] hover:bg-[var(--varuna-blue-dark)] text-white text-scale-xs font-bold rounded-[var(--radius-md)] transition-colors cursor-pointer shrink-0"
                      >
                        Locate
                      </button>
                    </div>
                  </form>
                </div>

                {/* 2. View Presets */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[var(--varuna-border)] pb-1.5">
                    <span className="text-[11px] font-bold text-[var(--varuna-text-secondary)] uppercase font-data tracking-wider">
                      View Presets
                    </span>
                    <span className="text-[10px] text-[var(--varuna-text-muted)] font-data">FAST ZOOM</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => flyTo && flyTo([78.9629, 22.5937], 4.5)}
                      className="h-8 text-[11px] font-semibold rounded-[var(--radius-md)] bg-[var(--varuna-surface-soft)] hover:bg-[var(--varuna-blue-light)] hover:text-[var(--varuna-blue-dark)] border border-[var(--varuna-border)] text-[var(--varuna-text)] transition-colors cursor-pointer"
                    >
                      India View
                    </button>
                    <button
                      onClick={() => flyTo && flyTo([77.2090, 28.6139], 7.5)}
                      className="h-8 text-[11px] font-semibold rounded-[var(--radius-md)] bg-[var(--varuna-surface-soft)] hover:bg-[var(--varuna-blue-light)] hover:text-[var(--varuna-blue-dark)] border border-[var(--varuna-border)] text-[var(--varuna-text)] transition-colors cursor-pointer"
                    >
                      North Plains
                    </button>
                    <button
                      onClick={() => flyTo && flyTo([73.6586, 17.9237], 7.5)}
                      className="h-8 text-[11px] font-semibold rounded-[var(--radius-md)] bg-[var(--varuna-surface-soft)] hover:bg-[var(--varuna-blue-light)] hover:text-[var(--varuna-blue-dark)] border border-[var(--varuna-border)] text-[var(--varuna-text)] transition-colors cursor-pointer"
                    >
                      Western Ghats
                    </button>
                  </div>
                </div>

                {/* 3. Basemaps */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[var(--varuna-border)] pb-1.5">
                    <span className="text-[11px] font-bold text-[var(--varuna-text-secondary)] uppercase font-data tracking-wider">
                      Basemap Layer
                    </span>
                    <span className="text-[10px] text-[var(--varuna-text-muted)] font-data">CARTOGRAPHY</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {BASEMAP_OPTIONS.map((opt) => {
                      const isSelected = basemap === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => changeBasemap && changeBasemap(opt.id)}
                          className={`
                            p-2.5 rounded-[var(--radius-md)] text-left border transition-all cursor-pointer flex flex-col justify-between
                            ${
                              isSelected
                                ? 'bg-[var(--varuna-blue-light)] border-[var(--varuna-blue)] text-[var(--varuna-blue-dark)] font-bold shadow-xs'
                                : 'bg-[var(--varuna-surface-soft)] hover:bg-[var(--varuna-surface)] border-[var(--varuna-border)] text-[var(--varuna-text)]'
                            }
                          `}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px]">{opt.label}</span>
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isSelected ? 'bg-[var(--varuna-blue)]' : 'bg-transparent border border-[var(--varuna-border-strong)]'
                              }`}
                            />
                          </div>
                          <span className="text-[9px] text-[var(--varuna-text-muted)] leading-tight">
                            {opt.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Forecast Variable */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[var(--varuna-border)] pb-1.5">
                    <span className="text-[11px] font-bold text-[var(--varuna-text-secondary)] uppercase font-data tracking-wider">
                      Forecast Variable
                    </span>
                    <span className="text-[10px] text-[var(--varuna-text-muted)] font-data">ATMOSPHERIC PARAM</span>
                  </div>

                  <div className="space-y-1.5">
                    {VARIABLES.map((v) => {
                      const isSelected = selectedVariable === v.id;
                      return (
                        <button
                          key={v.id}
                          onClick={() => setVariable(v.id)}
                          className={`
                            w-full px-3 py-2 rounded-[var(--radius-md)] text-left border transition-all cursor-pointer flex items-center justify-between
                            ${
                              isSelected
                                ? 'bg-[var(--varuna-blue-light)] border-[var(--varuna-blue)] text-[var(--varuna-blue-dark)] font-bold shadow-xs'
                                : 'bg-[var(--varuna-surface-soft)] hover:bg-[var(--varuna-surface)] border-[var(--varuna-border)] text-[var(--varuna-text)] font-medium'
                            }
                          `}
                        >
                          <div className="flex items-center gap-2">
                            <span>{v.icon}</span>
                            <span className="text-scale-xs">{v.label}</span>
                            <span className="text-[10px] font-data text-[var(--varuna-text-muted)]">
                              ({v.unit})
                            </span>
                          </div>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isSelected ? 'bg-[var(--varuna-blue)]' : 'bg-transparent border border-[var(--varuna-border-strong)]'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Model Layer */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[var(--varuna-border)] pb-1.5">
                    <span className="text-[11px] font-bold text-[var(--varuna-text-secondary)] uppercase font-data tracking-wider">
                      Model Layer
                    </span>
                    <span className="text-[10px] text-[var(--varuna-text-muted)] font-data">ENSEMBLE MEMBERS</span>
                  </div>

                  <div className="space-y-1.5">
                    {MODELS.map((m) => {
                      const isSelected = selectedModelLayer === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setModelLayer(m.id)}
                          className={`
                            w-full px-3 py-2 rounded-[var(--radius-md)] text-left border transition-all cursor-pointer flex items-center justify-between
                            ${
                              isSelected
                                ? 'bg-[var(--varuna-blue-light)] border-[var(--varuna-blue)] text-[var(--varuna-blue-dark)] font-bold shadow-xs'
                                : 'bg-[var(--varuna-surface-soft)] hover:bg-[var(--varuna-surface)] border-[var(--varuna-border)] text-[var(--varuna-text)] font-medium'
                            }
                          `}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{
                                backgroundColor:
                                  m.id === 'ifs'
                                    ? '#1E40AF'
                                    : m.id === 'aifs'
                                    ? '#0284C7'
                                    : m.id === 'gfs'
                                    ? '#0D9488'
                                    : m.id === 'icon'
                                    ? '#64748B'
                                    : '#245F89',
                              }}
                            />
                            <span className="text-scale-xs">{m.name}</span>
                            <span className="text-[10px] font-data text-[var(--varuna-text-muted)]">
                              {m.resolution}
                            </span>
                          </div>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isSelected ? 'bg-[var(--varuna-blue)]' : 'bg-transparent border border-[var(--varuna-border-strong)]'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-3.5 border-t border-[var(--varuna-border)] bg-[var(--varuna-surface-soft)] text-[10px] text-[var(--varuna-text-muted)] flex items-center justify-between font-data shrink-0">
                <span>NWP-AI BLEND · 168H MAX</span>
                <button
                  onClick={() => setMapControlsDrawerOpen(false)}
                  className="px-2.5 py-1 rounded bg-[var(--varuna-surface)] hover:bg-[var(--varuna-blue-light)] border border-[var(--varuna-border)] text-[var(--varuna-text)] font-semibold transition-colors cursor-pointer"
                >
                  Apply &amp; Close
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
