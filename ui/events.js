import { MAP_CONFIG, SELECTORS } from './config.js';
import { activateMission, addDroneModel, addMission, droneModels, persistMissions, removeActiveMission, removeDroneModel, renameMission, state, updateDroneModel as updateDroneModelCatalog } from './state.js';
import { $ } from './dom.js';
import {
  bindMapDrawing,
  bindMapInteractions,
  centerMapOnPolygon,
  initializeMap,
  renderMissionPolygon,
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
  $('#toggle-right')?.addEventListener('click', () => {
    state.rightMenuOpen = !state.rightMenuOpen;
    render();
  });
  $('#minimize-right')?.addEventListener('click', (event) => {
    event.stopPropagation();
    state.rightMenuOpen = false;
    render();
  });
  $('#show-right-panel')?.addEventListener('click', () => {
    state.rightMenuOpen = true;
    render();
  });
  $('#mission-menu-toggle').addEventListener('click', () => {
    state.missionMenuOpen = !state.missionMenuOpen;
    render();
  });
  $('#drone-settings-toggle').addEventListener('click', () => {
    state.droneSettingsOpen = !state.droneSettingsOpen;
    render();
  });
  $('#drone-settings-close')?.addEventListener('click', () => {
    state.droneSettingsOpen = false;
    render();
  });
  document.querySelectorAll('.drone-count').forEach((input) => input.addEventListener('input', updateDroneCount));
  document.querySelectorAll('.drone-model-form').forEach((form) => form.addEventListener('submit', (event) => saveDroneModel(event, render)));
  document.querySelectorAll('[data-delete-drone]').forEach((button) => button.addEventListener('click', () => deleteDroneModel(button.dataset.deleteDrone, render)));
  $('#add-drone-model')?.addEventListener('submit', (event) => addNewDroneModel(event, render));
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
  $('#max-collision-input')?.addEventListener('input', updateMaxCollisionPercent);
  $('#add-zone')?.addEventListener('click', () => {
    state.drawingPolygon = true;
    state.polygonPoints = [];
    state.polygonAdded = false;
    render();
    $(SELECTORS.mapHint).classList.remove('hidden');
    bindMapDrawing();
  });
  $(SELECTORS.finishZone)?.addEventListener('click', () => finishPolygon(render));
  $('#path-weight').addEventListener('input', updatePlacementWeight);
  $('#area-weight').addEventListener('input', updatePlacementWeight);
  $('#optimize-placement').addEventListener('click', () => optimizePlacement(render));
  $('#weather-toggle').addEventListener('click', () => {
    state.weatherVisible = !state.weatherVisible;
    setWeatherVisibility(state.weatherVisible);
    render();
  });
  document.querySelectorAll('.export-map').forEach((button) => button.addEventListener('click', () => window.print()));
  $('#zoom-in').addEventListener('click', () => zoomBy(state.zoomSensitivity));
  $('#zoom-out').addEventListener('click', () => zoomBy(-state.zoomSensitivity));
  $('#zoom-settings')?.addEventListener('click', () => toggleZoomSettings(render));
  $('#zoom-sensitivity')?.addEventListener('input', updateZoomSensitivity);
  $('#weather-scan').addEventListener('click', scanFromControls);
  bindPanelDragging();
}

function readDroneForm(form) {
  const data = new FormData(form);
  return {
    model: String(data.get('model') || '').trim(),
    maxWindSpeed: Number(data.get('maxWindSpeed')),
    maxZoom: Number(data.get('maxZoom')),
    maxRange: Number(data.get('maxRange')),
    thermalVision: data.has('thermalVision'),
    nightVision: data.has('nightVision'),
    rainTolerance: data.has('rainTolerance')
  };
}

function validateDroneModel(model) {
  if (!model.model || !Number.isFinite(model.maxWindSpeed) || !Number.isFinite(model.maxZoom) || !Number.isFinite(model.maxRange) || model.maxRange <= 0) {
    throw new Error('Renseignez un nom et des caractéristiques numériques valides.');
  }
}

function saveDroneModel(event, render) {
  event.preventDefault();
  try {
    const form = event.currentTarget;
    const model = readDroneForm(form);
    validateDroneModel(model);
    updateDroneModelCatalog(form.dataset.droneId, model);
    render();
  } catch (error) {
    showMapHint(error.message);
  }
}

function addNewDroneModel(event, render) {
  event.preventDefault();
  try {
    const model = readDroneForm(event.currentTarget);
    validateDroneModel(model);
    const idBase = model.model.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'drone';
    let id = idBase;
    let suffix = 2;
    while (droneModels.some((drone) => drone.id === id)) id = `${idBase}-${suffix++}`;
    addDroneModel({ id, ...model });
    render();
  } catch (error) {
    showMapHint(error.message);
  }
}

function deleteDroneModel(id, render) {
  if (!removeDroneModel(id)) {
    showMapHint('Conservez au moins un modèle de drone.');
    return;
  }
  render();
}

function bindPanelDragging() {
  document.querySelectorAll('[data-panel-drag-handle]').forEach((handle) => {
    handle.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button')) return;
      const panel = handle.closest('[data-panel-side]');
      const side = panel?.dataset.panelSide;
      if (!panel || !side) return;

      const rect = panel.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      handle.setPointerCapture(event.pointerId);
      panel.classList.add('!transition-none');

      const move = (moveEvent) => {
        const maxX = Math.max(0, window.innerWidth - panel.offsetWidth);
        const maxY = Math.max(56, window.innerHeight - panel.offsetHeight);
        const x = Math.min(maxX, Math.max(0, moveEvent.clientX - offsetX));
        const y = Math.min(maxY, Math.max(56, moveEvent.clientY - offsetY));
        panel.style.left = `${x}px`;
        panel.style.top = `${y}px`;
        panel.style.right = 'auto';
        state.panelPositions[side] = { x, y };
      };
      const stop = () => {
        panel.classList.remove('!transition-none');
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', stop);
        handle.removeEventListener('pointercancel', stop);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', stop);
      handle.addEventListener('pointercancel', stop);
    });
  });
}

function updateBuffer(event) {
  state.planning.bufferMeters = Number(event.target.value);
  $('#buffer-value').textContent = `${state.planning.bufferMeters} m`;
  renderPlanningArea();
}

function updateMaxCollisionPercent(event) {
  const value = event.target.value.trim();
  state.planning.maxCollisionPercent = value === '' ? '' : Number(value);
  persistMissions();
}

function toggleZoomSettings(render) {
  state.zoomSettingsOpen = !state.zoomSettingsOpen;
  render();
}

function updateZoomSensitivity(event) {
  state.zoomSensitivity = Number(event.target.value) / 100;
  $('#zoom-sensitivity-value').textContent = `${event.target.value}%`;
}

function updateDroneOptions(event) {
  state.planning[event.target.id === 'small-drones' ? 'smallDrones' : 'largeDrones'] = Math.max(0, Math.min(30, Number(event.target.value) || 0));
}

function updateDroneCount(event) {
  state.planning.fleet[event.target.dataset.droneId] = Math.max(0, Math.min(30, Number(event.target.value) || 0));
  persistMissions();
}


function updateDroneModel(event) {
  const key = event.target.id === 'small-drone-model' ? 'smallDroneModelId' : 'largeDroneModelId';
  state.planning[key] = event.target.value;
  persistMissions();
  render();
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
  render();
}

function createNewMission(render) {
  const input = $('#new-mission-name');
  const name = input?.value.trim() || `Mission ${state.missions.length + 1}`;
  clearPlacement({ preserveState: true });
  addMission(name);
  refreshMissionView();
  render();
}

function deleteMission(id, render) {
  const mission = state.missions.find((item) => item.id === id);
  if (!mission) return;
  if (id === state.activeMissionId) {
    clearPlacement({ preserveState: true });
    if (!removeActiveMission()) return;
    refreshMissionView();
  } else {
    state.missions.splice(state.missions.indexOf(mission), 1);
    persistMissions();
  }
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
