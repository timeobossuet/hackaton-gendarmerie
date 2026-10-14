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
  mapZoomed: false,
  drawingPolygon: false,
  polygonPoints: [],
  mapScale: 1,
  mapX: 0,
  mapY: 0,
  zoomSensitivity: MAP_CONFIG.defaultZoomSensitivity,
  zoomSettingsOpen: false
};
