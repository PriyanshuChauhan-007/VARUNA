import { useEffect, useRef } from 'react';
import { Marker, Popup } from 'maplibre-gl';
import { useMap } from './mapContext';
import { useStore } from '../../store/useStore';
import { REGIONS, getDeterministicForecast, RISK_TIERS } from '../../data/mockData.js';

export default function ForecastLayer() {
  const { map, mapReady, flyTo } = useMap() || {};
  const selectedRegionId = useStore((s) => s.selectedRegionId);
  const selectRegion = useStore((s) => s.selectRegion);
  const selectedVariable = useStore((s) => s.selectedVariable);
  const selectedLeadTime = useStore((s) => s.selectedLeadTime);
  const selectedModelLayer = useStore((s) => s.selectedModelLayer);

  const markersRef = useRef([]);
  const popupRef = useRef(null);

  // Pan to selected region smoothly
  useEffect(() => {
    if (!map || !mapReady || !selectedRegionId || !flyTo) return;
    const reg = REGIONS.find((r) => r.id === selectedRegionId);
    if (reg) {
      flyTo([reg.lng, reg.lat], Math.max(map.getZoom(), 6.5));
    }
  }, [map, mapReady, selectedRegionId, flyTo]);

  // Render HTML markers for each forecast region
  useEffect(() => {
    if (!map || !mapReady) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    REGIONS.forEach((region) => {
      const forecast = getDeterministicForecast(region.id, selectedVariable, selectedLeadTime);
      const isSelected = region.id === selectedRegionId;
      const color = RISK_TIERS[forecast.alertLevel] || '#D97706';

      // Pick display value according to selected model layer
      let displayVal = forecast.forecastValue;
      if (selectedModelLayer === 'ifs') displayVal = forecast.models.ifs.value;
      if (selectedModelLayer === 'aifs') displayVal = forecast.models.aifs.value;
      if (selectedModelLayer === 'gfs') displayVal = forecast.models.gfs.value;

      const el = document.createElement('div');
      el.className = 'varuna-map-marker';
      el.style.cursor = 'pointer';

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
            <span>${displayVal} <span style="font-size: 9px; opacity: 0.8;">${forecast.unit}</span></span>
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
        popupRef.current = new Popup({ offset: 25, closeButton: false })
          .setLngLat([region.lng, region.lat])
          .setHTML(`
            <div style="padding: 10px; font-family: 'Inter', sans-serif; font-size: 12px; min-width: 180px;">
              <div style="font-weight: 700; color: #1A1A17; margin-bottom: 2px;">${region.name}</div>
              <div style="font-size: 10px; color: #75756C; margin-bottom: 6px;">${region.zone}</div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span style="color: #484841;">VARUNA Blend:</span>
                <strong style="color: #D97706; font-family: 'JetBrains Mono', monospace;">${forecast.forecastValue} ${forecast.unit}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 11px;">
                <span style="color: #75756C;">ECMWF AIFS:</span>
                <span style="font-family: 'JetBrains Mono', monospace;">${forecast.models.aifs.value} ${forecast.unit} (${forecast.models.aifs.weight}%)</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 11px;">
                <span style="color: #75756C;">NOAA GFS:</span>
                <span style="font-family: 'JetBrains Mono', monospace;">${forecast.models.gfs.value} ${forecast.unit} (${forecast.models.gfs.weight}%)</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 11px;">
                <span style="color: #75756C;">ECMWF IFS:</span>
                <span style="font-family: 'JetBrains Mono', monospace;">${forecast.models.ifs.value} ${forecast.unit} (${forecast.models.ifs.weight}%)</span>
              </div>
              <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #E8E5DE; font-size: 10px; color: #16A34A; font-weight: 600;">
                Click to inspect adaptive weighting
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
  }, [map, mapReady, selectedRegionId, selectedVariable, selectedLeadTime, selectedModelLayer, selectRegion]);

  return null;
}
