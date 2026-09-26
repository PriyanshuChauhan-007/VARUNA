import { createContext, useContext } from 'react';

export const BASEMAP_STYLES = {
  satellite: {
    version: 8,
    name: 'Esri World Imagery',
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    sources: {
      esri_sat: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: '&copy; Esri &mdash; Earthstar Geographics',
      },
      carto_labels: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: '&copy; Esri &mdash; Boundaries',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#030712' } },
      { id: 'sat-tiles', type: 'raster', source: 'esri_sat', paint: { 'raster-opacity': 1.0 } },
      { id: 'sat-labels', type: 'raster', source: 'carto_labels', paint: { 'raster-opacity': 0.85 } },
    ],
  },
  dark: {
    version: 8,
    name: 'Dark Gray Canvas',
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    sources: {
      esri_dark: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: '&copy; Esri Dark Canvas',
      },
      esri_dark_labels: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: '&copy; Esri Dark Reference',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0a0e17' } },
      { id: 'dark-tiles', type: 'raster', source: 'esri_dark', paint: { 'raster-opacity': 1.0 } },
      { id: 'dark-labels', type: 'raster', source: 'esri_dark_labels', paint: { 'raster-opacity': 0.85 } },
    ],
  },
  nasa_gibs: {
    version: 8,
    name: 'NASA Blue Marble',
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    sources: {
      nasa_blue_marble: {
        type: 'raster',
        tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'],
        tileSize: 256,
        maxzoom: 8,
        attribution: '&copy; NASA GIBS',
      },
      carto_labels: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#030b18' } },
      { id: 'gibs-tiles', type: 'raster', source: 'nasa_blue_marble', paint: { 'raster-opacity': 1.0 } },
      { id: 'gibs-labels', type: 'raster', source: 'carto_labels', paint: { 'raster-opacity': 0.85 } },
    ],
  },
  nasa_night: {
    version: 8,
    name: 'NASA Night Marble',
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    sources: {
      nasa_black_marble: {
        type: 'raster',
        tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png'],
        tileSize: 256,
        attribution: '&copy; NASA Black Marble',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#000000' } },
      { id: 'night-tiles', type: 'raster', source: 'nasa_black_marble', paint: { 'raster-opacity': 1.0 } },
    ],
  },
};

export const MapContext = createContext(null);
export const useMap = () => useContext(MapContext);
