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

export const MAP_IMAGE = {
  aspectRatio: 2161 / 1850,
  source: 'cartes/carte.png'
};

export const MAP_CONFIG = {
  minScale: 1,
  maxScale: 2.5,
  defaultZoomSensitivity: 0.15,
  minZoomSensitivity: 0.05,
  maxZoomSensitivity: 0.4,
  missionScale: 1.55,
  polygonMinPoints: 3
};

export const SELECTORS = {
  app: '#app',
  map: '#map',
  mapContent: '#map-content',
  missionPolygon: '#mission-polygon',
  mapHint: '#map-hint',
  finishZone: '#finish-zone'
};
