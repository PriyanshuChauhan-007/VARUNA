import { useState } from 'react';
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

  const [searchValue, setSearchValue] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
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

  const BASEMAP_OPTIONS = [
    { id: 'satellite', label: 'Satellite' },
    { id: 'dark', label: 'Dark Matter' },
    { id: 'nasa_gibs', label: 'NASA GIBS' },
    { id: 'nasa_night', label: 'Night Marble' },
  ];

  return (
    <div className="absolute top-3.5 left-3.5 z-10 flex flex-col gap-2 max-w-[calc(100%-40px)]">
      {/* VARUNA Operational Status Header Pill */}
      <div className="flex items-center gap-2 bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-amber-500/40 shadow-xl max-w-fit">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>
          <span className="text-[11px] font-bold tracking-wider text-amber-400 uppercase">
            VARUNA NWP-AI
          </span>
        </div>
        <span className="text-slate-600 text-xs">•</span>
        <span className="text-[11px] font-medium text-slate-200">Adaptive Blend Grid</span>
        <span className="text-slate-600 text-xs">•</span>
        <div className="font-mono text-[10px] text-amber-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700/60">
          @{viewCoords?.lat ?? '22.59'}, {viewCoords?.lng ?? '78.96'}, {viewCoords?.zoom ?? '4.5'}z
        </div>
        <span className="bg-amber-950/90 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-500/40">
          12 Zones ({effectiveMode === 'LIVE' ? 'Live' : effectiveMode === 'REPLAY' ? 'Replay' : 'Demo'} Mode)
        </span>
      </div>

      {/* Search & Location Bar */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <form onSubmit={handleSearch} className="flex gap-1">
          <div className="relative">
            <input
              type="text"
              placeholder="Search region or lat, lng..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="h-8 w-56 sm:w-64 pl-8 pr-2.5 text-xs bg-slate-950/90 text-white placeholder-slate-400 backdrop-blur-md border border-slate-700 rounded-lg focus:outline-none focus:border-amber-400 shadow-lg"
            />
            <svg
              className="absolute left-2.5 top-2 text-slate-400"
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
          <button
            type="submit"
            className="h-8 px-2.5 flex items-center justify-center bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow-lg transition-colors cursor-pointer"
          >
            Locate
          </button>
        </form>

        {/* View Presets */}
        <div className="inline-flex rounded-lg border border-slate-700 overflow-hidden bg-slate-950/90 backdrop-blur-md shadow-md">
          <button
            onClick={() => flyTo && flyTo([78.9629, 22.5937], 4.5)}
            className="px-2.5 h-8 text-[11px] font-semibold text-slate-200 hover:text-white hover:bg-slate-800 transition-colors border-r border-slate-700 cursor-pointer"
          >
            India View
          </button>
          <button
            onClick={() => flyTo && flyTo([77.2090, 28.6139], 7.5)}
            className="px-2.5 h-8 text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border-r border-slate-700 cursor-pointer"
          >
            North Plains
          </button>
          <button
            onClick={() => flyTo && flyTo([73.6586, 17.9237], 7.5)}
            className="px-2.5 h-8 text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Western Ghats
          </button>
        </div>
      </div>

      {/* Layer Row: Basemaps + Variables + Models */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Basemap Options */}
        <div className="inline-flex rounded-lg border border-slate-700 overflow-hidden bg-slate-950/90 backdrop-blur-md shadow-md">
          {BASEMAP_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => changeBasemap && changeBasemap(opt.id)}
              className={`px-2 h-7 text-[11px] font-medium transition-colors cursor-pointer ${
                basemap === opt.id
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Variable Switcher */}
        <div className="inline-flex rounded-lg border border-slate-700 overflow-hidden bg-slate-950/90 backdrop-blur-md shadow-md">
          {VARIABLES.map((v) => (
            <button
              key={v.id}
              onClick={() => setVariable(v.id)}
              className={`px-2.5 h-7 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                selectedVariable === v.id
                  ? 'bg-slate-800 text-amber-300 border-b-2 border-amber-400 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>{v.icon}</span>
              <span>{v.label}</span>
            </button>
          ))}
        </div>

        {/* Model Switcher */}
        <div className="inline-flex rounded-lg border border-slate-700 overflow-hidden bg-slate-950/90 backdrop-blur-md shadow-md">
          {MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => setModelLayer(m.id)}
              className={`px-2.5 h-7 text-[11px] font-medium transition-colors cursor-pointer ${
                selectedModelLayer === m.id
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: m.color }} />
              {m.name.replace('ECMWF ', '').replace('NOAA ', '')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
