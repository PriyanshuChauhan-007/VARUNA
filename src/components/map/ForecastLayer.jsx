import { useEffect, useRef } from 'react';
import { Marker, Popup } from 'maplibre-gl';
import { useMap } from './mapContext';
import { useStore } from '../../store/useStore';
import { RISK_TIERS, regimeName, MODELS } from '../../data/referenceData.js';
import { entryAtLead, leadToHours, alertTier, UI_TO_MODEL_KEY } from '../../services/api';

const MEMBER_ROWS = ['ecmwf_ifs', 'ecmwf_aifs', 'cep_gfs', 'dwd_icon'];
const MODEL_BY_KEY = Object.fromEntries(MODELS.filter((m) => m.key).map((m) => [m.key, m]));

export default function ForecastLayer() {
  const { map, mapReady, flyTo } = useMap() || {};
  const selectedRegionId = useStore((s) => s.selectedRegionId);
  const selectRegion = useStore((s) => s.selectRegion);
  const selectedLeadTime = useStore((s) => s.selectedLeadTime);
  const selectedModelLayer = useStore((s) => s.selectedModelLayer);
  const regions = useStore((s) => s.regions);
  const regionalForecasts = useStore((s) => s.regionalForecasts);
  const regionalExtremes = useStore((s) => s.regionalExtremes);

  const markersRef = useRef([]);
  const popupRef = useRef(null);

  const leadHours = leadToHours(selectedLeadTime);

  // Pan to selected region smoothly
  useEffect(() => {
    if (!map || !mapReady || !selectedRegionId || !flyTo) return;
    const reg = regions.find((r) => r.id === selectedRegionId);
    if (reg) {
      flyTo([reg.lng, reg.lat], Math.max(map.getZoom(), 6.5));
    }
  }, [map, mapReady, selectedRegionId, flyTo, regions]);

  // Render HTML markers for each forecast region
  useEffect(() => {
    if (!map || !mapReady) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    regions.forEach((region) => {
      const forecast = regionalForecasts[region.id] || null;
      const extremes = regionalExtremes[region.id] || null;
      const entry = forecast ? entryAtLead(forecast.timeline, leadHours) : null;
      const tier = extremes ? alertTier(extremes.alerts).tier : null;
      const isSelected = region.id === selectedRegionId;
      const color = tier ? RISK_TIERS[tier] : '#64748B';

      // Display value for the selected model layer
      let displayVal = entry?.blend ?? null;
      if (selectedModelLayer !== 'blend' && entry) {
        displayVal = entry.models?.[UI_TO_MODEL_KEY[selectedModelLayer]] ?? null;
      }
      const unit = forecast?.unit ?? '';

      const el = document.createElement('div');
      el.className = 'varuna-map-marker';
      el.style.cursor = 'pointer';

      const valueText = displayVal === null || displayVal === undefined ? '…' : displayVal;

      el.innerHTML = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
          ${isSelected ? `<div style="position: absolute; top: -6px; left: -6px; right: -6px; bottom: -6px; border-radius: 20px; border: 2px solid #F5C518; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite; pointer-events: none;"></div>` : ''}
          <div style="
            display: flex;
            align-items: center;
            gap: 4px;
            background: #0B0F17;
            border: 2px solid ${isSelected ? '#F5C518' : color};
            padding: 3px 8px;
            border-radius: 12px;
            box-shadow: 0 4px 14px rgba(0,0,0,0.5);
            color: #FFFFFF;
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
            transition: transform 0.15s ease;
          ">
            <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: ${color};"></span>
            <span>${valueText}${unit ? ` <span style="font-size: 9px; opacity: 0.8;">${unit}</span>` : ''}</span>
          </div>
          <div style="
            font-family: 'Inter', sans-serif;
            font-size: 10px;
            font-weight: 600;
            color: #FFFFFF;
            background: rgba(15, 23, 42, 0.85);
            padding: 1px 5px;
            border-radius: 4px;
            margin-top: 2px;
            border: 1px solid rgba(255,255,255,0.15);
            text-shadow: 0 1px 2px rgba(0,0,0,0.8);
          ">
            ${region.name.split(' (')[0]}
          </div>
        </div>
      `;

      el.addEventListener('mouseenter', () => {
        if (popupRef.current) popupRef.current.remove();

        const memberHtml = entry
          ? MEMBER_ROWS.map((key) => {
              const m = MODEL_BY_KEY[key];
              const v = entry.models?.[key];
              const w = entry.weights?.[key];
              return `
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 11px;">
                  <span style="color: #75756C;">${m?.name || key}:</span>
                  <span style="font-family: 'JetBrains Mono', monospace;">${v ?? '—'} ${unit} (${w ?? '—'}%)</span>
                </div>`;
            }).join('')
          : '<div style="font-size: 11px; color: #75756C;">Forecast loading…</div>';

        popupRef.current = new Popup({ offset: 25, closeButton: false })
          .setLngLat([region.lng, region.lat])
          .setHTML(`
            <div style="padding: 10px; font-family: 'Inter', sans-serif; font-size: 12px; min-width: 190px;">
              <div style="font-weight: 700; color: #1A1A17; margin-bottom: 2px;">${region.name}</div>
              <div style="font-size: 10px; color: #75756C; margin-bottom: 6px;">${region.zone}</div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span style="color: #484841;">VARUNA Blend (+${selectedLeadTime}):</span>
                <strong style="color: #D97706; font-family: 'JetBrains Mono', monospace;">${entry?.blend ?? '—'} ${unit}</strong>
              </div>
              ${memberHtml}
              <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #E8E5DE; font-size: 10px; color: #16A34A; font-weight: 600;">
                ${forecast ? `${forecast.data_mode} · ${regimeName(entry?.regime_index) || forecast.regime?.name || ''}` : 'Click to inspect'}
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
  }, [map, mapReady, selectedRegionId, selectedLeadTime, selectedModelLayer, selectRegion, regions, regionalForecasts, regionalExtremes, leadHours]);

  return null;
}
