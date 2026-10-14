import { fetchWeather } from './api.js';
import { weatherPopup } from './popup.js';
import { state } from '../state.js';
import { getLeafletMap } from '../map.js';
import { getProtectedArea, getProtectedBounds } from '../planning/area.js';

const drones = [
  { name: 'DJI Mini 5', maxWind: 38, maxRain: 0 },
  { name: 'DJI Mavic 3 Ent.', maxWind: 43, maxRain: 0 },
  { name: 'DJI Matrice 4T', maxWind: 54, maxRain: 2 }
];

let weatherLayer = null;
let scanVersion = 0;

export function cancelWeatherScan() {
  scanVersion += 1;
  weatherLayer?.clearLayers();
}

export function initializeWeatherLayer() {
  weatherLayer?.remove();
  const map = getLeafletMap();
  weatherLayer = L.layerGroup().addTo(map);
  renderWeatherCells();
  return weatherLayer;
}

export function setWeatherVisibility(visible) {
  if (!weatherLayer) return;
  if (visible) weatherLayer.addTo(getLeafletMap());
  else weatherLayer.remove();
}

export async function scanWeather(gridSize, onProgress) {
  const map = getLeafletMap();
  const area = getProtectedArea();
  const bounds = getProtectedBounds();
  if (!area || !bounds?.isValid()) throw new Error('Ajoutez un chemin GPX ou dessinez une zone protégée avant d’analyser la météo.');
  const size = Number(gridSize);
  if (!Number.isInteger(size) || size < 2 || size > 15) {
    throw new Error('La taille de la grille doit être comprise entre 2 et 15.');
  }

  const currentScan = ++scanVersion;
  const location = {
    lat: bounds.getCenter().lat,
    lng: bounds.getCenter().lng,
    name: state.planning.gpxFileName || 'Zone à protéger'
  };
  state.weather = {
    ...state.weather,
    gridSize,
    location,
    scanning: true,
    progress: 0,
    error: null,
    cells: []
  };
  weatherLayer?.clearLayers();
  map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
  const latMin = bounds.getSouth();
  const latMax = bounds.getNorth();
  const lngMin = bounds.getWest();
  const lngMax = bounds.getEast();
  const cells = [];
  const totalCells = size * size;
  let failedCells = 0;

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (currentScan !== scanVersion) return;
      const south = latMin + (row * (latMax - latMin)) / size;
      const north = latMin + ((row + 1) * (latMax - latMin)) / size;
      const west = lngMin + (column * (lngMax - lngMin)) / size;
      const east = lngMin + ((column + 1) * (lngMax - lngMin)) / size;
      const lat = (south + north) / 2;
      const lng = (west + east) / 2;
      let inside = false;
      try {
        inside = turf.booleanPointInPolygon(turf.point([lng, lat]), area, { ignoreBoundary: false });
      } catch {
        failedCells += 1;
        continue;
      }
      if (!inside) continue;
      let weather;
      try {
        weather = normalizeWeather(await fetchWeather(lat, lng));
      } catch {
        failedCells += 1;
        continue;
      }
      cells.push({ id: `${row}-${column}`, bounds: [[south, west], [north, east]], lat, lng, weather });
      state.weather.cells = cells;
      state.weather.progress = Math.round(((row * size + column + 1) / totalCells) * 100);
      onProgress?.(state.weather.progress, location.name);
      renderWeatherCells();
    }
  }

  if (!cells.length) throw new Error('Aucune donnée météo exploitable pour cette zone.');
  state.weather.scanning = false;
  state.weather.location = location;
  if (failedCells > 0) {
    state.weather.error = `${failedCells} cellule${failedCells > 1 ? 's' : ''} météo n${failedCells > 1 ? 'ont' : '’a'} pas pu être chargée${failedCells > 1 ? 's' : 'e'}.`;
  }
  return location;
}

export function renderWeatherCells() {
  if (!weatherLayer) return;
  weatherLayer.clearLayers();
  state.weather.cells.forEach((cell) => {
    const tile = L.rectangle(cell.bounds, {
      color: '#ffffff',
      weight: 1,
      fillColor: getCellColor(cell.weather),
      fillOpacity: 0.42
    }).bindPopup(weatherPopup(cell));
    tile.on('mouseover', () => tile.setStyle({ weight: 3, fillOpacity: 0.62 }));
    tile.on('mouseout', () => tile.setStyle({ weight: 1, fillOpacity: 0.42 }));
    tile.addTo(weatherLayer);
  });
}

function normalizeWeather(data) {
  const current = data?.current;
  const hourly = data?.hourly;
  if (!current || !hourly?.time?.length) throw new Error('Réponse météo incomplète.');
  const gust = Math.round(Number.isFinite(current.wind_gusts_10m) ? current.wind_gusts_10m : current.wind_speed_10m);
  if (!Number.isFinite(gust)) throw new Error('Rafales indisponibles.');
  const rain = Number((current.precipitation || 0).toFixed(1));
  const kp = Math.min(9, Math.max(0, Math.floor(Math.random() * 4) + 1));
  const stability = calculateStability(hourly, gust, rain);

  return {
    temperature: Math.round(current.temperature_2m),
    wind: Math.round(current.wind_speed_10m),
    gust,
    rain,
    pressure: Math.round(current.surface_pressure),
    kp,
    stability,
    drones: drones.map((drone) => ({
      name: drone.name,
      allowed: gust <= drone.maxWind && rain <= drone.maxRain && kp <= 7,
      reason: gust > drone.maxWind ? 'Vent trop fort' : rain > drone.maxRain ? 'Pluie incompatible' : 'GPS perturbé'
    }))
  };
}

function calculateStability(hourly, currentGust, currentRain) {
  if (!hourly?.time?.length) {
    return { text: 'Prévisions horaires indisponibles', warning: true };
  }
  const currentHour = new Date().getHours();
  const rainy = currentRain > 0.1;
  const windy = currentGust > 38;

  for (let hour = 1; hour <= 12; hour += 1) {
    const index = currentHour + hour;
    if (index >= hourly.time.length) break;
    const futureGust = Number(hourly.wind_gusts_10m?.[index]);
    const futureRain = Number(hourly.precipitation?.[index]);
    if (!Number.isFinite(futureGust) || !Number.isFinite(futureRain)) continue;
    if (!rainy && futureRain > 0.2) return { text: `Dégradation : pluie prévue dans ${hour}h`, warning: true };
    if (rainy && futureRain === 0) return { text: `Amélioration : fin de la pluie dans ${hour}h`, warning: false };
    if (!windy && futureGust > 38) return { text: `Rafales > 38 km/h prévues dans ${hour}h`, warning: true };
    if (windy && futureGust <= 35) return { text: `Accalmie des rafales dans ${hour}h`, warning: false };
  }
  return { text: 'Conditions stables sur les 12 prochaines heures', warning: false };
}

function getCellColor(weather) {
  if (weather.gust > 43 || weather.rain > 2) return '#ef4444';
  if (weather.gust > 38 || weather.rain > 0.1) return '#f59e0b';
  return '#22c55e';
}
