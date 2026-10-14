import { MAP_CONFIG } from './config.js';

// Etat local de l'interface. Les composants sont rendus à partir de cet objet.
export const state = {
  leftMenuOpen: true,
  rightMenuOpen: true,
  weatherVisible: false,
  coverage: 80,
  type1Count: 2,
  type2Count: 2,
  polygonAdded: false,
  drawingPolygon: false,
  polygonPoints: [],
  zoomSensitivity: MAP_CONFIG.defaultZoomSensitivity,
  zoomSettingsOpen: false,
  weather: {
    radiusKm: 8,
    gridSize: 5,
    scanning: false,
    progress: 0,
    location: null,
    error: null,
    cells: []
  }
};
