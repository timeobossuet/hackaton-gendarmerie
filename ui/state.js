import { MAP_CONFIG } from './config.js';

// Etat local de l'interface. Les composants sont rendus à partir de cet objet.
export const state = {
  leftMenuOpen: true,
  rightMenuOpen: true,
  weatherVisible: false,
  mapStyle: 'osm',
  polygonAdded: false,
  drawingPolygon: false,
  polygonPoints: [],
  planning: {
    areaMode: 'buffer',
    bufferMeters: 200,
    gpxFileName: null,
    gpxGeoJson: null,
    smallDrones: 3,
    largeDrones: 2,
    pathWeight: 10,
    areaWeight: 1,
    operationProgress: 0,
    moveTeamWithDrone: false,
    calculating: false,
    placement: null,
    placementError: null
  },
  zoomSensitivity: MAP_CONFIG.defaultZoomSensitivity,
  zoomSettingsOpen: false,
  weather: {
    gridSize: 5,
    scanning: false,
    progress: 0,
    location: null,
    error: null,
    cells: []
  }
};
