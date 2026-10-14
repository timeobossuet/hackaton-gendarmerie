import { MAP_CONFIG, SELECTORS } from './config.js';
import { state } from './state.js';
import { $, $$ } from './dom.js';
import {
  bindMapDrawing,
  bindMapInteractions,
  centerMapOnPolygon,
  initializeMap,
  renderMissionPolygon,
  zoomBy
} from './map.js';
import {
  initializeWeatherLayer,
  scanWeather,
  setWeatherVisibility
} from './weather/scanner.js';

export function bindEvents({ render }) {
  initializeMap();
  bindMapInteractions();
  initializeWeatherLayer();
  setWeatherVisibility(state.weatherVisible);

  $('#toggle-left').addEventListener('click', () => {
    state.leftMenuOpen = !state.leftMenuOpen;
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
    setWeatherVisibility(state.weatherVisible);
    render();
  });
  $('#export-map').addEventListener('click', () => window.print());
  $('#zoom-in').addEventListener('click', () => zoomBy(state.zoomSensitivity));
  $('#zoom-out').addEventListener('click', () => zoomBy(-state.zoomSensitivity));
  $('#zoom-settings').addEventListener('click', () => toggleZoomSettings(render));
  $('#zoom-sensitivity')?.addEventListener('input', updateZoomSensitivity);
  $('#weather-scan').addEventListener('click', scanFromControls);
  $('#weather-location').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') scanFromControls();
  });
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

async function scanFromControls() {
  const query = $('#weather-location').value.trim();
  if (!query) {
    showWeatherStatus('Saisissez une ville ou un code postal.', true);
    return;
  }

  const radius = Number($('#weather-radius').value) || 8;
  const gridSize = Number($('#weather-grid-size').value) || 5;
  state.weather.scanning = true;
  showWeatherStatus('Localisation en cours...');

  try {
    await scanWeather(query, radius, gridSize, (progress, locationName) => {
      showWeatherStatus(`Scan météo en cours sur ${locationName}... ${progress}%`);
    });
    state.weather.scanning = false;
    showWeatherStatus(`Scan terminé sur ${state.weather.location.name}. Cliquez sur une cellule pour les détails.`);
  } catch (error) {
    state.weather.scanning = false;
    state.weather.error = error.message;
    showWeatherStatus(error.message, true);
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
    showMapHint('Ajoutez au moins 3 points');
    return;
  }

  state.drawingPolygon = false;
  state.polygonAdded = true;
  render();
  renderMissionPolygon();
  centerMapOnPolygon();
  showMapHint('Zone de mission ajoutée');
}

function showMapHint(message) {
  const hint = $(SELECTORS.mapHint);
  if (!hint) return;
  hint.classList.remove('hidden');
  hint.querySelector('div').textContent = message;
  window.setTimeout(() => hint.classList.add('hidden'), 2200);
}
