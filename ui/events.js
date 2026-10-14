import { MAP_CONFIG, SELECTORS } from './config.js';
import { state } from './state.js';
import { $, $$ } from './dom.js';
import { bindMapDrawing, bindMapInteractions, centerMapOnPolygon, recenterMap, zoomBy } from './map.js';

export function bindEvents({ render }) {
  $('#toggle-left').addEventListener('click', () => {
    state.leftMenuOpen = !state.leftMenuOpen;
    render();
  });

  $('#toggle-right').addEventListener('click', () => {
    state.rightMenuOpen = !state.rightMenuOpen;
    render();
  });

  $('#add-zone').addEventListener('click', () => {
    state.drawingPolygon = true;
    state.polygonPoints = [];
    state.polygonAdded = false;
    render();
    $(SELECTORS.mapHint).classList.remove('hidden');
    bindMapDrawing();
  });

  $(SELECTORS.finishZone)?.addEventListener('click', () => finishPolygon(render));
  $('#coverage-slider').addEventListener('input', updateCoverage);
  $$('[data-drone-type]').forEach((slider) => slider.addEventListener('input', updateDroneCount));
  $('#weather-toggle').addEventListener('click', () => {
    state.weatherVisible = !state.weatherVisible;
    render();
  });
  $('#export-map').addEventListener('click', () => window.print());
  $('#recenter-map').addEventListener('click', recenterMap);
  $('#zoom-in').addEventListener('click', () => zoomBy(state.zoomSensitivity));
  $('#zoom-out').addEventListener('click', () => zoomBy(-state.zoomSensitivity));
  $('#zoom-settings').addEventListener('click', () => toggleZoomSettings(render));
  $('#zoom-sensitivity')?.addEventListener('input', updateZoomSensitivity);

  bindMapInteractions();
  setWeatherLayerVisibility();
}

function toggleZoomSettings(render) {
  state.zoomSettingsOpen = !state.zoomSettingsOpen;
  render();
}

function updateZoomSensitivity(event) {
  state.zoomSensitivity = Number(event.target.value) / 100;
  $('#zoom-sensitivity-value').textContent = `${event.target.value}%`;
}

function updateCoverage(event) {
  state.coverage = event.target.value;
  $('#coverage-value').textContent = `${state.coverage}%`;
}

function updateDroneCount(event) {
  const type = event.target.dataset.droneType;
  state[`${type}Count`] = event.target.value;
  event.target.closest('.rounded-md').querySelector('.text-notion-500').textContent = event.target.value;
}

function setWeatherLayerVisibility() {
  const layer = $('#weather-layer');
  layer.classList.toggle('opacity-0', !state.weatherVisible);
  layer.classList.toggle('opacity-100', state.weatherVisible);
}

function finishPolygon(render) {
  if (state.polygonPoints.length < MAP_CONFIG.polygonMinPoints) {
    $(SELECTORS.mapHint).querySelector('div').textContent = 'Ajoutez au moins 3 points';
    return;
  }

  state.drawingPolygon = false;
  state.polygonAdded = true;
  state.mapZoomed = true;
  state.mapScale = MAP_CONFIG.missionScale;

  centerMapOnPolygon();

  render();
  const hint = $(SELECTORS.mapHint);
  hint.classList.remove('hidden');
  window.setTimeout(() => hint?.classList.add('hidden'), 2200);
}
