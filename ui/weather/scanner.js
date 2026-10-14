import { fetchWeather, searchLocation } from './api.js';
import { weatherPopup } from './popup.js';
import { state } from '../state.js';
import { getLeafletMap } from '../map.js';

const drones = [
  { name: 'DJI Mini 5', maxWind: 38, maxRain: 0 },
  { name: 'DJI Mavic 3 Ent.', maxWind: 43, maxRain: 0 },
  { name: 'DJI Matrice 4T', maxWind: 54, maxRain: 2 }
];

let weatherLayer = null;
let scanVersion = 0;

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

export async function scanWeather(query, radiusKm, gridSize, onProgress) {
  const location = await searchLocation(query);
  const map = getLeafletMap();
  const currentScan = ++scanVersion;
  state.weather = {
    ...state.weather,
    radiusKm,
    gridSize,
    location,
    scanning: true,
    progress: 0,
    error: null,
    cells: []
  };
  weatherLayer?.clearLayers();
  map.flyTo([location.lat, location.lng], radiusKm >= 30 ? 9 : radiusKm >= 15 ? 10 : radiusKm >= 8 ? 11 : 13, { duration: 1.2 });

  const offset = radiusKm / 111;
  const latMin = location.lat - offset * 0.7;
  const latMax = location.lat + offset * 0.7;
  const lngMin = location.lng - offset;
  const lngMax = location.lng + offset;
  const cells = [];

  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      if (currentScan !== scanVersion) return;
      const south = latMin + (row * (latMax - latMin)) / gridSize;
      const north = latMin + ((row + 1) * (latMax - latMin)) / gridSize;
      const west = lngMin + (column * (lngMax - lngMin)) / gridSize;
      const east = lngMin + ((column + 1) * (lngMax - lngMin)) / gridSize;
      const lat = (south + north) / 2;
      const lng = (west + east) / 2;
      const raw = await fetchWeather(lat, lng);
      const weather = normalizeWeather(raw);
      cells.push({ id: `${row}-${column}`, bounds: [[south, west], [north, east]], lat, lng, weather });
      state.weather.cells = cells;
      state.weather.progress = Math.round((cells.length / (gridSize * gridSize)) * 100);
      onProgress?.(state.weather.progress, location.name);
      renderWeatherCells();
    }
  }

  state.weather.scanning = false;
  state.weather.location = location;
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
  const current = data.current;
  const gust = Math.round(current.wind_gusts_10m || current.wind_speed_10m);
  const rain = Number((current.precipitation || 0).toFixed(1));
  const kp = Math.min(9, Math.max(0, Math.floor(Math.random() * 4) + 1));
  const stability = calculateStability(data.hourly, gust, rain);

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
  const currentHour = new Date().getHours();
  const rainy = currentRain > 0.1;
  const windy = currentGust > 38;

  for (let hour = 1; hour <= 12; hour += 1) {
    const index = currentHour + hour;
    if (index >= hourly.time.length) break;
    const futureGust = hourly.wind_gusts_10m[index];
    const futureRain = hourly.precipitation[index];
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
