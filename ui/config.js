// Configuration visuelle et cartographique de l'interface AERIS.
export const MAP_CONFIG = {
  defaultZoomSensitivity: 0.15,
  minZoomSensitivity: 0.05,
  maxZoomSensitivity: 0.4,
  polygonMinPoints: 3,
  defaultCenter: [43.09, 1.87],
  defaultZoom: 12,
  missionPadding: [48, 48]
};

export const SELECTORS = {
  app: '#app',
  map: '#map',
  mapHint: '#map-hint',
  finishZone: '#finish-zone',
  defaultZoneBtn: '#default-zone-btn'
};

export const DEFAULT_DEMO_POLYGON = [
  [43.115, 1.845],
  [43.120, 1.905],
  [43.085, 1.925],
  [43.060, 1.880],
  [43.070, 1.830]
];

