import { useEffect, useRef, useState, useMemo } from 'react';
import { Marker, Popup } from 'maplibre-gl';
import { useMap } from './mapContext';
import { useStore } from '../../store/useStore';
import { REGIONS, RISK_TIERS, getDeterministicForecast } from '../../data/mockData.js';
import { getNdmaProtocol, getVariableIcon } from '../../utils/formatters.js';

export default function ForecastLayer() {
  const { map, mapReady, flyTo } = useMap() || {};
  const selectedRegionId = useStore((s) => s.selectedRegionId);
  const selectRegion = useStore((s) => s.selectRegion);
  const selectedModelLayer = useStore((s) => s.selectedModelLayer);
  const selectedVariable = useStore((s) => s.selectedVariable);
  const selectedLeadTime = useStore((s) => s.selectedLeadTime);
  const regionalForecasts = useStore((s) => s.regionalForecasts);

  // Severity filter: 'ALL' | 'NORMAL' | 'ADVISORY' | 'WARNING'
  const [severityFilter, setSeverityFilter] = useState('ALL');

  const markersRef = useRef([]);
  const popupRef = useRef(null);

  // Inject radar pulse keyframe animations once
  useEffect(() => {
    const styleId = 'varuna-radar-styles';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        @keyframes varuna-radar-ping {
          0% { transform: scale(0.85); opacity: 0.85; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes varuna-radar-alert {
          0% { transform: scale(0.85); opacity: 0.95; }
          50% { transform: scale(1.85); opacity: 0; }
          100% { transform: scale(1.85); opacity: 0; }
        }
      `;
      document.head.appendChild(styleEl);
    }
  }, []);

  // Pan to selected region smoothly
  useEffect(() => {
    if (!map || !mapReady || !selectedRegionId || !flyTo) return;
    const reg = REGIONS.find((r) => r.id === selectedRegionId);
    if (reg) {
      flyTo([reg.lng, reg.lat], Math.max(map.getZoom(), 6.5));
    }
  }, [map, mapReady, selectedRegionId, flyTo]);

  // Build active forecast list across all 45 stations
  const resolvedList = useMemo(() => {
    const isVariableMatch =
      regionalForecasts &&
      regionalForecasts.length > 0 &&
      regionalForecasts[0]?.forecast?.variable?.id === selectedVariable;

    return REGIONS.map((region) => {
      let forecast = null;
      if (isVariableMatch) {
        const liveMatch = regionalForecasts.find((rf) => rf.id === region.id);
        if (liveMatch && liveMatch.forecast) {
          forecast = liveMatch.forecast;
        }
      }

      // If no live forecast arrived yet, compute deterministic baseline
      if (!forecast) {
        forecast = getDeterministicForecast(region.id, selectedVariable, selectedLeadTime);
      }

      const alertLevel = forecast?.alertLevel || 'Low';
      let category = 'NORMAL';
      if (alertLevel === 'Critical' || alertLevel === 'High') {
        category = 'WARNING';
      } else if (alertLevel === 'Moderate') {
        category = 'ADVISORY';
      }

      return {
        ...region,
        forecast,
        alertLevel,
        category,
      };
    });
  }, [regionalForecasts, selectedVariable, selectedLeadTime]);

  // Counts for the severity toolbar
  const counts = useMemo(() => {
    let normal = 0;
    let advisory = 0;
    let warning = 0;
    resolvedList.forEach((r) => {
      if (r.category === 'WARNING') warning++;
      else if (r.category === 'ADVISORY') advisory++;
      else normal++;
    });
    return { total: resolvedList.length, normal, advisory, warning };
  }, [resolvedList]);

  // Render HTML markers for each forecast station
  useEffect(() => {
    if (!map || !mapReady) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    resolvedList.forEach((item) => {
      // Check if station matches active severity filter
      if (severityFilter !== 'ALL' && item.category !== severityFilter) {
        return;
      }

      const region = item;
      const forecast = item.forecast;
      const isSelected = region.id === selectedRegionId;
      const alertLevel = item.alertLevel;
      const color = RISK_TIERS[alertLevel] || '#16A34A';
      const isSevere = alertLevel === 'Critical' || alertLevel === 'High';
      const isAdvisory = alertLevel === 'Moderate';

      // Pick display value according to selected model layer
      let displayVal = forecast ? forecast.forecastValue : '—';
      const unit = forecast ? forecast.unit : '';
      if (forecast) {
        if (selectedModelLayer === 'ifs') displayVal = forecast.models?.ifs?.value ?? displayVal;
        if (selectedModelLayer === 'aifs') displayVal = forecast.models?.aifs?.value ?? displayVal;
        if (selectedModelLayer === 'gfs') displayVal = forecast.models?.gfs?.value ?? displayVal;
        if (selectedModelLayer === 'icon' || selectedModelLayer === 'dwd_icon') {
          displayVal = (forecast.models?.icon?.value ?? forecast.models?.dwd_icon?.value) ?? displayVal;
        }
      }

      const hazardIcon = getVariableIcon(selectedVariable);
      const ndma = getNdmaProtocol(alertLevel);
      const shortName = region.name.split(' (')[0].split(' / ')[0];

      const el = document.createElement('div');
      el.className = 'varuna-map-radar-marker';
      el.style.cursor = 'pointer';

      // Radar pulse styling: fast ping for warnings, subtle ripple for nominal
      const pingAnim = isSevere
        ? 'varuna-radar-alert 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
        : isAdvisory
        ? 'varuna-radar-ping 2.2s cubic-bezier(0, 0, 0.2, 1) infinite'
        : 'varuna-radar-ping 3.2s cubic-bezier(0, 0, 0.2, 1) infinite';

      el.innerHTML = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
          <!-- Animated Radar Pulsing Beacon -->
          <div style="
            position: absolute;
            top: -6px;
            left: -6px;
            right: -6px;
            bottom: -6px;
            border-radius: 9999px;
            border: 2px solid ${color};
            pointer-events: none;
            animation: ${pingAnim};
          "></div>

          ${isSelected ? `
            <div style="
              position: absolute;
              top: -9px;
              left: -9px;
              right: -9px;
              bottom: -9px;
              border-radius: 9999px;
              border: 2px solid #F5C518;
              box-shadow: 0 0 12px #F5C518;
              pointer-events: none;
            "></div>
          ` : ''}

          <!-- Core Pill Badge -->
          <div style="
            display: flex;
            align-items: center;
            gap: 4px;
            background: rgba(11, 15, 23, 0.94);
            border: 2px solid ${isSelected ? '#F5C518' : color};
            padding: 3px 7px;
            border-radius: 12px;
            box-shadow: 0 4px 14px rgba(0,0,0,0.6);
            color: #FFFFFF;
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
            backdrop-filter: blur(4px);
            transition: transform 0.15s ease;
          ">
            <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: ${color}; box-shadow: 0 0 6px ${color};"></span>
            <span style="font-size: 10px;">${hazardIcon}</span>
            <span>${displayVal} <span style="font-size: 9px; opacity: 0.8;">${unit}</span></span>
          </div>

          <!-- Station Short Name -->
          <div style="
            font-family: 'Inter', sans-serif;
            font-size: 9.5px;
            font-weight: 600;
            color: #F8FAFC;
            background: rgba(15, 23, 42, 0.88);
            padding: 1px 5px;
            border-radius: 4px;
            margin-top: 2px;
            border: 1px solid rgba(255,255,255,0.18);
            text-shadow: 0 1px 2px rgba(0,0,0,0.9);
            white-space: nowrap;
          ">
            ${shortName}
          </div>
        </div>
      `;

      // Interactive hover popup with NDMA Civil Defense Protocol
      el.addEventListener('mouseenter', () => {
        if (popupRef.current) popupRef.current.remove();

        const aifsVal = forecast?.models?.aifs?.value ?? '—';
        const aifsWt = forecast?.models?.aifs?.weight ?? 25;
        const ifsVal = forecast?.models?.ifs?.value ?? '—';
        const ifsWt = forecast?.models?.ifs?.weight ?? 25;
        const gfsVal = forecast?.models?.gfs?.value ?? '—';
        const gfsWt = forecast?.models?.gfs?.weight ?? 25;
        const iconVal = (forecast?.models?.icon?.value ?? forecast?.models?.dwd_icon?.value) ?? '—';
        const iconWt = (forecast?.models?.icon?.weight ?? forecast?.models?.dwd_icon?.weight) ?? 25;

        popupRef.current = new Popup({ offset: 25, closeButton: false })
          .setLngLat([region.lng, region.lat])
          .setHTML(`
            <div style="padding: 12px; font-family: 'Inter', sans-serif; font-size: 12px; min-width: 240px; color: #1E293B;">
              <!-- Header with Station Name & Alert Badge -->
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 2px;">
                <div style="font-weight: 700; font-size: 13px; color: #0F172A;">${region.name}</div>
                <span style="background: ${ndma.bg}; color: ${ndma.color}; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 9999px; border: 1px solid ${ndma.border}; font-family: 'JetBrains Mono', monospace;">
                  ${alertLevel.toUpperCase()}
                </span>
              </div>
              <div style="font-size: 10.5px; color: #64748B; margin-bottom: 8px;">
                ${region.zone} · Elev ${region.elevation}
              </div>

              <!-- NDMA Civil Defense Protocol Action -->
              <div style="background: #F8FAFC; border-left: 3px solid ${color}; padding: 6px 8px; border-radius: 4px; margin-bottom: 8px;">
                <div style="font-weight: 800; color: #1E293B; font-size: 10px; font-family: 'JetBrains Mono', monospace;">
                  ${ndma.code}
                </div>
                <div style="color: #475569; font-size: 10.5px; margin-top: 2px; line-height: 1.35;">
                  ${ndma.action}
                </div>
              </div>

              <!-- VARUNA Blend Telemetry -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #E2E8F0;">
                <span style="font-weight: 600; color: #334155;">VARUNA Blend:</span>
                <span style="font-family: 'JetBrains Mono', monospace; font-weight: 800; color: #D97706; font-size: 13px;">
                  ${forecast ? forecast.forecastValue : '—'} ${unit}
                </span>
              </div>

              <!-- 4-Model Member Spread Breakdown -->
              <div style="font-size: 11px; margin-bottom: 6px;">
                <div style="display: flex; justify-content: space-between; color: #64748B; margin-bottom: 2px;">
                  <span>ECMWF AIFS (ML):</span>
                  <span style="font-family: 'JetBrains Mono', monospace; color: #0F172A; font-weight: 600;">${aifsVal} ${unit} (${aifsWt}%)</span>
                </div>
                <div style="display: flex; justify-content: space-between; color: #64748B; margin-bottom: 2px;">
                  <span>ECMWF IFS (9km):</span>
                  <span style="font-family: 'JetBrains Mono', monospace; color: #0F172A; font-weight: 600;">${ifsVal} ${unit} (${ifsWt}%)</span>
                </div>
                <div style="display: flex; justify-content: space-between; color: #64748B; margin-bottom: 2px;">
                  <span>NOAA GFS (13km):</span>
                  <span style="font-family: 'JetBrains Mono', monospace; color: #0F172A; font-weight: 600;">${gfsVal} ${unit} (${gfsWt}%)</span>
                </div>
                <div style="display: flex; justify-content: space-between; color: #64748B;">
                  <span>DWD ICON (13km):</span>
                  <span style="font-family: 'JetBrains Mono', monospace; color: #0F172A; font-weight: 600;">${iconVal} ${unit} (${iconWt}%)</span>
                </div>
              </div>

              <!-- Scientific Provenance Badge -->
              <div style="padding-top: 6px; border-top: 1px solid #E2E8F0; font-size: 10px; color: ${region.benchmarked ? '#059669' : '#64748B'}; font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
                <span>${region.benchmarked ? '✓ ERA5 Held-Out Benchmark' : 'Operational Consensus Stream'}</span>
                <span style="color: #2563EB;">Click to focus →</span>
              </div>
            </div>
          `)
          .addTo(map);
      });

      el.addEventListener('mouseleave', () => {
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
      });

      el.addEventListener('click', () => {
        selectRegion(region.id);
      });

      const marker = new Marker({ element: el })
        .setLngLat([region.lng, region.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    };
  }, [map, mapReady, selectedRegionId, selectedModelLayer, resolvedList, severityFilter, selectedVariable, selectRegion]);

  return (
    <>
      {/* ── TOP-RIGHT GLASSMORPHIC SEVERITY FILTER TOOLBAR ── */}
      <div className="absolute top-3.5 right-14 z-10 flex items-center gap-1.5 p-1 rounded-xl bg-[var(--varuna-surface)]/90 backdrop-blur-md border border-[var(--varuna-border)] shadow-lg pointer-events-auto">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--varuna-text-muted)] font-data px-2 py-1 border-r border-[var(--varuna-border)]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>SEVERITY</span>
        </div>

        <button
          onClick={() => setSeverityFilter('ALL')}
          className={`px-2.5 py-1 rounded-lg font-data text-scale-xs font-bold transition-all cursor-pointer ${
            severityFilter === 'ALL'
              ? 'bg-[var(--varuna-blue)] text-white shadow-xs'
              : 'text-[var(--varuna-text-secondary)] hover:text-[var(--varuna-text)] hover:bg-[var(--varuna-surface-soft)]'
          }`}
          title="Display all 45 monitoring stations"
        >
          All ({counts.total})
        </button>

        <button
          onClick={() => setSeverityFilter('NORMAL')}
          className={`px-2.5 py-1 rounded-lg font-data text-scale-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
            severityFilter === 'NORMAL'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
          }`}
          title="Filter to nominal / all-clear stations"
        >
          <span>🟢 Normal</span>
          <span className="opacity-80">({counts.normal})</span>
        </button>

        <button
          onClick={() => setSeverityFilter('ADVISORY')}
          className={`px-2.5 py-1 rounded-lg font-data text-scale-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
            severityFilter === 'ADVISORY'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
          }`}
          title="Filter to moderate advisory stations"
        >
          <span>🟠 Advisory</span>
          <span className="opacity-80">({counts.advisory})</span>
        </button>

        <button
          onClick={() => setSeverityFilter('WARNING')}
          className={`px-2.5 py-1 rounded-lg font-data text-scale-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
            severityFilter === 'WARNING'
              ? 'bg-red-600 text-white shadow-xs'
              : 'text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
          }`}
          title="Filter to critical / high warning stations"
        >
          <span>🔴 Warning</span>
          <span className="opacity-80">({counts.warning})</span>
        </button>
      </div>
    </>
  );
}
