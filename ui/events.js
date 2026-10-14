import { MAP_CONFIG, SELECTORS } from './config.js';
import { state } from './state.js';
import { $ } from './dom.js';
import {
  bindMapDrawing,
  bindMapInteractions,
  centerMapOnPolygon,
  initializeMap,
  renderMissionPolygon,
  setMapStyle,
  zoomBy
} from './map.js';
import {
  cancelWeatherScan,
  initializeWeatherLayer,
  scanWeather,
  setWeatherVisibility
} from './weather/scanner.js';
import { parseGpx } from './planning/gpx.js';
import { fitMapToGpx, renderPlanningArea } from './planning/area.js';
import { calculatePlacement, clearPlacement } from './planning/placement.js';
import { getLeafletMap } from './map.js';

export function bindEvents({ render }) {
  initializeMap();
  bindMapInteractions();
  renderPlanningArea();
  initializeWeatherLayer();
  setWeatherVisibility(state.weatherVisible);

  $('#toggle-left').addEventListener('click', () => {
    state.leftMenuOpen = !state.leftMenuOpen;
    render();
  });
  $('#toggle-right').addEventListener('click', () => {
    state.rightMenuOpen = !state.rightMenuOpen;
    render();
  });
  $('#import-gpx').addEventListener('click', () => $('#gpx-file').click());
  $('#gpx-file').addEventListener('change', (event) => loadGpx(event, render));
  $('#area-buffer')?.addEventListener('click', () => {
    state.planning.areaMode = 'buffer';
    state.drawingPolygon = false;
    renderPlanningArea();
    render();
  });
  $('#area-polygon')?.addEventListener('click', () => {
    state.planning.areaMode = 'polygon';
    render();
  });
  $('#buffer-slider')?.addEventListener('input', updateBuffer);
  $('#add-zone')?.addEventListener('click', () => {
    state.drawingPolygon = true;
    state.polygonPoints = [];
    state.polygonAdded = false;
    render();
    $(SELECTORS.mapHint).classList.remove('hidden');
    bindMapDrawing();
  });
  $(SELECTORS.finishZone)?.addEventListener('click', () => finishPolygon(render));
  $('#small-drones').addEventListener('input', updateDroneOptions);
  $('#large-drones').addEventListener('input', updateDroneOptions);
  $('#path-weight').addEventListener('input', updatePlacementWeight);
  $('#area-weight').addEventListener('input', updatePlacementWeight);
  $('#optimize-placement').addEventListener('click', () => optimizePlacement(render));
  $('#restart-mission').addEventListener('click', () => restartMission(render));
  $('#weather-toggle').addEventListener('click', () => {
    state.weatherVisible = !state.weatherVisible;
    setWeatherVisibility(state.weatherVisible);
    render();
  });
  $('#export-map').addEventListener('click', () => window.print());
  $('#zoom-in').addEventListener('click', () => zoomBy(state.zoomSensitivity));
  $('#zoom-out').addEventListener('click', () => zoomBy(-state.zoomSensitivity));
  $('#zoom-settings').addEventListener('click', () => toggleZoomSettings(render));
  $('#zoom-sensitivity')?.addEventListener('input', updateZoomSensitivity);
  $('#map-style-osm')?.addEventListener('click', () => {
    setMapStyle('osm');
    render();
  });
  $('#map-style-satellite')?.addEventListener('click', () => {
    setMapStyle('satellite');
    render();
  });
  $('#weather-scan').addEventListener('click', scanFromControls);
}

function toggleZoomSettings(render) {
  state.zoomSettingsOpen = !state.zoomSettingsOpen;
  render();
}

function updateZoomSensitivity(event) {
  state.zoomSensitivity = Number(event.target.value) / 100;
  $('#zoom-sensitivity-value').textContent = `${event.target.value}%`;
}

function updateBuffer(event) {
  state.planning.bufferMeters = Number(event.target.value);
  $('#buffer-value').textContent = `${state.planning.bufferMeters} m`;
  renderPlanningArea();
}

function updateDroneOptions(event) {
  state.planning[event.target.id === 'small-drones' ? 'smallDrones' : 'largeDrones'] = Math.max(0, Math.min(30, Number(event.target.value) || 0));
}

function updatePlacementWeight(event) {
  const key = event.target.id === 'path-weight' ? 'pathWeight' : 'areaWeight';
  state.planning[key] = Number(event.target.value);
  $(`#${key.replace('Weight', '-weight-value')}`).textContent = event.target.value;
}

async function optimizePlacement(render) {
  state.planning.calculating = true;
  state.planning.placementError = null;
  render();
  await new Promise((resolve) => window.setTimeout(resolve, 30));
  try {
    calculatePlacement();
  } catch (error) {
    state.planning.placementError = error.message;
  } finally {
    state.planning.calculating = false;
    render();
  }
}

function restartMission(render) {
  cancelWeatherScan();
  clearPlacement();
  state.polygonAdded = false;
  state.drawingPolygon = false;
  state.polygonPoints = [];
  state.planning = {
    areaMode: 'buffer',
    bufferMeters: 200,
    gpxFileName: null,
    gpxGeoJson: null,
    smallDrones: 3,
    largeDrones: 2,
    pathWeight: 10,
    areaWeight: 1,
    calculating: false,
    placement: null,
    placementError: null
  };
  state.weather = {
    gridSize: 5,
    scanning: false,
    progress: 0,
    location: null,
    error: null,
    cells: []
  };
  const map = getLeafletMap();
  map?.setView(MAP_CONFIG.defaultCenter, MAP_CONFIG.defaultZoom);
  renderMissionPolygon();
  renderPlanningArea();
  render();
}

async function scanFromControls() {
  const gridSize = Number($('#weather-grid-size').value) || 5;
  state.weather.scanning = true;
  showWeatherStatus('Analyse de la zone protégée en cours...');

  try {
    await scanWeather(gridSize, (progress, locationName) => {
      showWeatherStatus(`Scan météo en cours sur ${locationName}... ${progress}%`);
    });
    state.weather.scanning = false;
    showWeatherStatus(
      state.weather.error
        ? `${state.weather.error} Les autres cellules restent disponibles.`
        : `Scan terminé sur ${state.weather.location.name}. Cliquez sur une cellule pour les détails.`,
      Boolean(state.weather.error)
    );
  } catch (error) {
    state.weather.scanning = false;
    state.weather.error = error.message;
    showWeatherStatus(error.message, true);
  }

}

async function loadGpx(event, render) {
  const [file] = event.target.files;
  if (!file) return;
  try {
    state.planning.gpxGeoJson = parseGpx(await file.text());
    state.planning.gpxFileName = file.name;
    state.planning.areaMode = 'buffer';
    state.polygonPoints = [];
    state.polygonAdded = false;
    state.drawingPolygon = false;
    renderPlanningArea();
    fitMapToGpx();
    render();
    showMapHint('Chemin GPX chargé');
  } catch (error) {
    state.planning.gpxGeoJson = null;
    showMapHint(error.message);
  } finally {
    event.target.value = '';
  }
}

function showWeatherStatus(message, isError = false) {
  const status = $('#weather-status');
  if (!status) return;
  status.textContent = message;
  status.classList.remove('hidden', 'text-red-600', 'text-notion-500');
  status.classList.add(isError ? 'text-red-600' : 'text-notion-500');
}

function finishPolygon(render) {
  if (state.polygonPoints.length < MAP_CONFIG.polygonMinPoints) {
    showMapHint('Ajoutez encore des points pour fermer la zone');
    return;
  }

  state.drawingPolygon = false;
  state.polygonAdded = true;
  render();
  renderPlanningArea();
  renderMissionPolygon();
  centerMapOnPolygon();
  showMapHint('Zone protégée enregistrée');
}

function showMapHint(message) {
  const hint = $(SELECTORS.mapHint);
  if (!hint) return;
  hint.classList.remove('hidden');
  hint.querySelector('div').textContent = message;
  window.setTimeout(() => hint.classList.add('hidden'), 2200);
}
