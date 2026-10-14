import { MAP_CONFIG, SELECTORS } from './config.js';
import { activateMission, addMission, persistMissions, removeActiveMission, renameMission, state } from './state.js';
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
import { resetPilotRadii, syncFleet } from './planning/fleet.js';
import { configureRadiusEditor, syncCircleRadii } from './planning/radius-editor.js';
import { bindFleetPanel } from './planning/fleet-panel.js';

export function bindEvents({ render }) {
  initializeMap();
  bindMapInteractions();
  renderPlanningArea();
  syncFleet();
  configureRadiusEditor({
    onRadiusCommit: () => render(),
    onRecalculate: () => optimizePlacement(render)
  });
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
  $('#mission-menu-toggle').addEventListener('click', () => {
    state.missionMenuOpen = !state.missionMenuOpen;
    render();
  });
  $('#new-mission-top').addEventListener('click', () => createNewMission(render));
  document.querySelectorAll('.mission-select').forEach((button) => {
    button.addEventListener('click', () => switchMission(button.dataset.missionId, render));
  });
  document.querySelectorAll('.mission-delete').forEach((button) => {
    button.addEventListener('click', () => deleteMission(button.dataset.deleteMission, render));
  });
  $('#create-mission')?.addEventListener('click', () => createNewMission(render));
  $('#new-mission-name')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') createNewMission(render);
  });
  $('#rename-mission')?.addEventListener('click', () => {
    const active = state.missions.find(({ id }) => id === state.activeMissionId);
    const name = window.prompt('Nom de la mission', active?.name || '');
    if (name?.trim()) {
      renameMission(name);
      render();
    }
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

  bindFleetPanel({ render });

  $('#reset-radii')?.addEventListener('click', () => {
    resetPilotRadii();
    syncCircleRadii();
    render();
  });
  $('#operation-progress').addEventListener('input', (event) => {
    state.planning.operationProgress = Math.max(0, Math.min(100, Number(event.target.value) || 0));
    $('#operation-progress-value').textContent = `${state.planning.operationProgress}%`;
  });
  $('#path-weight').addEventListener('input', updatePlacementWeight);
  $('#area-weight').addEventListener('input', updatePlacementWeight);
  $('#optimize-placement').addEventListener('click', () => optimizePlacement(render));
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

function refreshMissionView() {
  state.selectedPilotId = null;
  cancelWeatherScan();
  state.drawingPolygon = false;
  const map = getLeafletMap();
  map?.setView(MAP_CONFIG.defaultCenter, MAP_CONFIG.defaultZoom);
  renderMissionPolygon();
  renderPlanningArea();
  if (state.planning.gpxGeoJson) fitMapToGpx();
  if (state.planning.placement) {
    try {
      calculatePlacement();
    } catch {
      state.planning.placement = null;
    }
  }
}

function switchMission(id, render) {
  clearPlacement({ preserveState: true });
  if (!activateMission(id)) return;
  refreshMissionView();
  state.missionMenuOpen = false;
  render();
}

function createNewMission(render) {
  const input = $('#new-mission-name');
  const name = input?.value.trim() || `Mission ${state.missions.length + 1}`;
  clearPlacement({ preserveState: true });
  addMission(name);
  refreshMissionView();
  state.missionMenuOpen = false;
  render();
}

function deleteMission(id, render) {
  const mission = state.missions.find((item) => item.id === id);
  if (!mission || !window.confirm(`Supprimer la mission « ${mission.name} » ?`)) return;
  if (id === state.activeMissionId) {
    clearPlacement({ preserveState: true });
    if (!removeActiveMission()) return;
    refreshMissionView();
  } else {
    state.missions.splice(state.missions.indexOf(mission), 1);
    persistMissions();
  }
  state.missionMenuOpen = false;
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