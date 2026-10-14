import { MAP_CONFIG, SELECTORS } from './config.js';
import { state } from './state.js';
import { $, getMapElement } from './dom.js';

let mapInstance = null;
let missionLayer = null;
let draftLayer = null;
let lastView = null;
let resizeHandlerBound = false;
let baseLayers = {};

export function initializeMap() {
  const currentContainer = getMapElement();
  if (mapInstance && mapInstance.getContainer() === currentContainer) {
    mapInstance.invalidateSize(false);
    return mapInstance;
  }

  if (mapInstance) {
    const center = mapInstance.getCenter();
    lastView = { center: [center.lat, center.lng], zoom: mapInstance.getZoom() };
    mapInstance.remove();
  }

  const initialView = lastView || {
    center: MAP_CONFIG.defaultCenter,
    zoom: MAP_CONFIG.defaultZoom
  };
  mapInstance = L.map(getMapElement(), { zoomControl: false }).setView(initialView.center, initialView.zoom);

  if (!resizeHandlerBound) {
    window.addEventListener('resize', () => {
      mapInstance?.invalidateSize(false);
    });
    resizeHandlerBound = true;
  }

  baseLayers = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles © Esri • © OpenStreetMap contributors'
    })
  };

  setMapStyle(state.mapStyle || 'osm', { skipState: true });
  renderMissionPolygon();
  return mapInstance;
}

export function setMapStyle(styleName, options = {}) {
  const activeStyle = styleName === 'satellite' ? 'satellite' : 'osm';
  const layer = baseLayers[activeStyle];

  if (!mapInstance || !layer) return null;

  Object.entries(baseLayers).forEach(([name, baseLayer]) => {
    if (mapInstance.hasLayer(baseLayer)) {
      mapInstance.removeLayer(baseLayer);
    }
    if (name === activeStyle) {
      baseLayer.addTo(mapInstance);
    }
  });

  if (!options.skipState) {
    state.mapStyle = activeStyle;
  }

  return layer;
}

export function getLeafletMap() {
  return mapInstance;
}

export function bindMapInteractions() {
  if (!mapInstance) initializeMap();
}

export function bindMapDrawing() {
  if (!mapInstance) return;

  mapInstance.off('click');
  mapInstance.on('click', (event) => {
    if (!state.drawingPolygon) return;
    state.polygonPoints.push([event.latlng.lat, event.latlng.lng]);
    renderMissionPolygon();
    updateFinishButton();
  });
}

export function zoomBy(delta) {
  if (!mapInstance) return;
  const targetZoom = mapInstance.getZoom() + (delta > 0 ? 1 : -1);
  mapInstance.setZoom(Math.max(1, Math.min(19, targetZoom)));
}

export function centerMapOnPolygon() {
  if (!mapInstance || state.polygonPoints.length < MAP_CONFIG.polygonMinPoints) return;
  mapInstance.fitBounds(L.latLngBounds(state.polygonPoints), {
    padding: MAP_CONFIG.missionPadding,
    maxZoom: 16
  });
}

export function recenterMap() {
  if (state.polygonAdded) {
    centerMapOnPolygon();
  } else {
    mapInstance?.setView(MAP_CONFIG.defaultCenter, MAP_CONFIG.defaultZoom);
  }
}

export function renderMissionPolygon() {
  if (!mapInstance) return;
  missionLayer?.remove();
  draftLayer?.remove();

  if (!state.polygonPoints.length) return;

  if (state.polygonAdded) {
    missionLayer = L.polygon(state.polygonPoints, {
      color: '#034a90',
      weight: 2,
      dashArray: '6 5',
      fillColor: '#034a90',
      fillOpacity: 0.18
    }).addTo(mapInstance);
  } else {
    draftLayer = L.layerGroup().addTo(mapInstance);
    L.polyline(state.polygonPoints, {
      color: '#034a90',
      weight: 2,
      dashArray: '5 5'
    }).addTo(draftLayer);
    state.polygonPoints.forEach((point) => L.circleMarker(point, {
      radius: 5,
      color: '#034a90',
      weight: 2,
      fillColor: '#ffffff',
      fillOpacity: 1
    }).addTo(draftLayer));
  }
}

function updateFinishButton() {
  const button = $(SELECTORS.finishZone);
  if (!button) return;
  button.disabled = state.polygonPoints.length < MAP_CONFIG.polygonMinPoints;
  button.textContent = `Valider la zone (${state.polygonPoints.length} points)`;
}
