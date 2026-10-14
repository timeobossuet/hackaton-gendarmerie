// Configuration visuelle et cartographique de l'interface AERIS.
export const droneClasses = {
  type1: {
    name: 'Type 1',
    description: 'Longue portée',
    color: '#101e30',
    icon: '●'
  },
  type2: {
    name: 'Type 2',
    description: 'Zone rapprochée',
    color: '#d78345',
    icon: '◆'
  }
};

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
  finishZone: '#finish-zone'
};
