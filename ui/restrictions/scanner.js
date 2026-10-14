import { state } from '../state.js';
import { getLeafletMap } from '../map.js';

const CATEGORIES = ['ZIT', 'AUTORISATION', 'LAC', 'FORET', 'LIBRE'];
const CATEGORY_STYLES = {
  ZIT: { color: '#ef4444', fillOpacity: 0.48 },
  AUTORISATION: { color: '#f59e0b', fillOpacity: 0.42 },
  LAC: { color: '#3b82f6', fillOpacity: 0.45 },
  FORET: { color: '#059669', fillOpacity: 0.45 },
  LIBRE: { color: '#22c55e', fillOpacity: 0.25 }
};
const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
];
const DRONE_PROFILES = [
  { name: 'DJI Mini 5 Pro', speed: '18 m/s (65 km/h)', url: 'https://www.dji.com/mini-5-pro/specs' },
  { name: 'DJI Mavic 3 Enterprise', speed: '19 m/s (68 km/h, version UE C1)', url: 'https://enterprise.dji.com/mavic-3-enterprise/specs' },
  { name: 'DJI Matrice 4T', speed: '21 m/s (76 km/h)', url: 'https://enterprise.dji.com/matrice-4-series/specs' }
];

const categoryLayers = new Map();
let cachedConstraints = null;
let cachedBoundsKey = '';

export function initializeRestrictionsLayer() {
  const map = getLeafletMap();
  if (!map) return;

  CATEGORIES.forEach((category) => {
    if (!categoryLayers.has(category)) categoryLayers.set(category, L.layerGroup());
  });
  syncLayerVisibility();
}

export function setRestrictionsVisibility(visible) {
  state.restrictions.visible = visible;
  syncLayerVisibility();
}

export function setRestrictionCategoryVisibility(category, visible) {
  if (!CATEGORIES.includes(category)) return;
  state.restrictions.filters[category] = visible;
  syncLayerVisibility();
}

export async function scanRestrictions({ query, radiusKm, gridSize, onStatus }) {
  const radius = Number(radiusKm);
  const size = Number(gridSize);
  if (!Number.isFinite(radius) || radius < 2 || radius > 20) {
    throw new Error('Le rayon doit être compris entre 2 et 20 km.');
  }
  if (!Number.isInteger(size) || size < 3 || size > 20) {
    throw new Error('La grille doit contenir entre 3 et 20 cellules par côté.');
  }

  const map = getLeafletMap();
  if (!map) throw new Error('La carte n’est pas encore initialisée.');
  state.restrictions.scanning = true;
  state.restrictions.gridSize = size;
  state.restrictions.radiusKm = radius;
  state.restrictions.error = null;

  try {
    onStatus?.(query ? `Localisation de « ${query} »…` : 'Préparation du scan autour de la carte…');
    const location = query ? await findLocation(query) : currentMapLocation(map);
    const latitudeOffset = (radius / 111) * 0.7;
    const longitudeOffset = radius / (111 * Math.max(0.01, Math.cos((location.lat * Math.PI) / 180)));
    const bounds = {
      south: location.lat - latitudeOffset,
      north: location.lat + latitudeOffset,
      west: location.lng - longitudeOffset,
      east: location.lng + longitudeOffset
    };

    onStatus?.(`Récupération des données autour de ${location.name}…`);
    const constraints = await fetchConstraints(bounds);
    state.restrictions.location = location;
    state.restrictions.cells = makeGrid(constraints, bounds, size, location.name);
    state.restrictions.counts = countCategories(state.restrictions.cells);
    map.flyTo([location.lat, location.lng], radius >= 15 ? 11 : radius >= 8 ? 12 : 13, {
      animate: true,
      duration: 1
    });
    syncLayerVisibility();
    return { location, cellCount: size * size, constraintCount: constraints.length };
  } catch (error) {
    state.restrictions.error = error instanceof Error ? error.message : 'Le scan des restrictions a échoué.';
    throw error;
  } finally {
    state.restrictions.scanning = false;
  }
}

function currentMapLocation(map) {
  const center = map.getCenter();
  return { lat: center.lat, lng: center.lng, name: 'la carte' };
}

async function findLocation(query) {
  const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`);
  if (!response.ok) throw new Error(`Le service de géolocalisation est indisponible (${response.status}).`);
  const data = await response.json();
  const feature = data.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1])) {
    throw new Error('Lieu ou code postal introuvable en France.');
  }
  const name = feature.properties?.city || feature.properties?.name || query;
  const postcode = feature.properties?.postcode;
  return {
    lat: coordinates[1],
    lng: coordinates[0],
    name: postcode ? `${name} (${postcode})` : name
  };
}

async function fetchConstraints(bounds) {
  const key = [bounds.south, bounds.west, bounds.north, bounds.east].map((value) => value.toFixed(3)).join('_');
  if (key === cachedBoundsKey && cachedConstraints) return cachedConstraints;

  const bbox = [
    (bounds.south - 0.012).toFixed(4),
    (bounds.west - 0.012).toFixed(4),
    (bounds.north + 0.012).toFixed(4),
    (bounds.east + 0.012).toFixed(4)
  ].join(',');
  const query = `[out:json][timeout:15][bbox:${bbox}];(way["military"];way["landuse"="military"];way["amenity"="prison"];way["power"="plant"];way["power"="nuclear"];way["aeroway"="runway"];node["aeroway"="aerodrome"];way["aeroway"="aerodrome"];node["aeroway"="heliport"];way["aeroway"="heliport"];way["amenity"="hospital"];way["leisure"="nature_reserve"];way["natural"="water"];way["waterway"="riverbank"];way["landuse"="reservoir"];way["landuse"="forest"];way["natural"="wood"];);out bb tags qt;`;
  const controllers = OVERPASS_SERVERS.map(() => new AbortController());
  const timers = controllers.map((controller) => window.setTimeout(() => controller.abort(), 20000));

  try {
    const data = await Promise.any(OVERPASS_SERVERS.map(async (url, index) => {
      const response = await fetch(url, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        signal: controllers[index].signal
      });
      if (!response.ok) throw new Error(`Overpass a répondu avec le statut ${response.status}.`);
      const result = await response.json();
      if (!Array.isArray(result.elements)) throw new Error('Réponse Overpass invalide.');
      return result;
    }));
    cachedConstraints = data.elements.map(toConstraint).filter(Boolean);
    cachedBoundsKey = key;
    return cachedConstraints;
  } catch {
    throw new Error('Les serveurs de restrictions sont indisponibles. Vérifiez la connexion puis réessayez.');
  } finally {
    controllers.forEach((controller) => controller.abort());
    timers.forEach((timer) => window.clearTimeout(timer));
  }
}

function toConstraint(element) {
  const info = classifyElement(element.tags);
  if (!info) return null;
  let bounds;
  if (element.bounds) {
    bounds = {
      south: element.bounds.minlat,
      north: element.bounds.maxlat,
      west: element.bounds.minlon,
      east: element.bounds.maxlon
    };
  } else if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
    bounds = {
      south: element.lat - 0.002,
      north: element.lat + 0.002,
      west: element.lon - 0.002,
      east: element.lon + 0.002
    };
  }
  if (!bounds) return null;

  if (element.tags?.aeroway === 'aerodrome') {
    bounds.south -= 0.015;
    bounds.north += 0.015;
    bounds.west -= 0.02;
    bounds.east += 0.02;
  } else if (element.tags?.aeroway === 'heliport' || element.tags?.amenity === 'hospital') {
    bounds.south -= 0.005;
    bounds.north += 0.005;
    bounds.west -= 0.007;
    bounds.east += 0.007;
  }
  return { ...info, bounds };
}

function classifyElement(tags = {}) {
  const name = tags.name ? `(${tags.name})` : '';
  if (tags.military || tags.landuse === 'military') {
    return { category: 'ZIT', label: `Zone militaire ${name}`, authority: 'Données OSM — vérification officielle nécessaire' };
  }
  if (tags.amenity === 'prison') {
    return { category: 'ZIT', label: `Prison ${name}`, authority: 'Données OSM — vérification officielle nécessaire' };
  }
  if (tags.power === 'plant' || tags.power === 'nuclear') {
    return { category: 'ZIT', label: `Centrale énergétique ${name}`, authority: 'Données OSM — vérification officielle nécessaire' };
  }
  if (tags.aeroway === 'runway') {
    return { category: 'ZIT', label: 'Piste d’aéroport', authority: 'Données OSM — vérifier auprès de la DGAC' };
  }
  if (tags.aeroway === 'aerodrome') {
    return { category: 'AUTORISATION', label: `Aérodrome / CTR ${name}`, authority: 'Vérifier le protocole DGAC / AlphaTango' };
  }
  if (tags.aeroway === 'heliport' || tags.amenity === 'hospital') {
    return { category: 'AUTORISATION', label: `Héliport / hôpital ${name}`, authority: 'Vérifier les autorisations locales' };
  }
  if (tags.leisure === 'nature_reserve') {
    return { category: 'AUTORISATION', label: `Réserve naturelle ${name}`, authority: 'Vérifier les autorisations OFB / DREAL' };
  }
  if (tags.natural === 'water' || tags.waterway === 'riverbank' || tags.landuse === 'reservoir') {
    return { category: 'LAC', label: `Plan d’eau / lac ${name}` };
  }
  if (tags.landuse === 'forest' || tags.natural === 'wood') {
    return { category: 'FORET', label: `Forêt / bois ${name}` };
  }
  return null;
}

function overlaps(first, second) {
  return !(second.west > first.east || second.east < first.west || second.south > first.north || second.north < first.south);
}

function makeGrid(constraints, bounds, size, locationName) {
  CATEGORIES.forEach((category) => categoryLayers.get(category)?.clearLayers());
  const cells = [];
  const latStep = (bounds.north - bounds.south) / size;
  const lngStep = (bounds.east - bounds.west) / size;

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const cellBounds = {
        south: bounds.south + row * latStep,
        north: bounds.south + (row + 1) * latStep,
        west: bounds.west + column * lngStep,
        east: bounds.west + (column + 1) * lngStep
      };
      const related = constraints.filter((constraint) => overlaps(cellBounds, constraint.bounds));
      const category = resolveCategory(related);
      const cell = {
        category,
        bounds: [[cellBounds.south, cellBounds.west], [cellBounds.north, cellBounds.east]],
        center: [(cellBounds.south + cellBounds.north) / 2, (cellBounds.west + cellBounds.east) / 2],
        locationName,
        labels: related.map(({ label }) => label),
        authorities: [...new Set(related.map(({ authority }) => authority).filter(Boolean))]
      };
      cells.push(cell);
      drawCell(cell);
    }
  }
  return cells;
}

function resolveCategory(constraints) {
  const categories = new Set(constraints.map(({ category }) => category));
  if (categories.has('ZIT')) return 'ZIT';
  if (categories.has('AUTORISATION')) return 'AUTORISATION';
  if (categories.has('LAC')) return 'LAC';
  if (categories.has('FORET')) return 'FORET';
  return 'LIBRE';
}

function countCategories(cells) {
  const counts = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  cells.forEach(({ category }) => { counts[category] += 1; });
  return counts;
}

function drawCell(cell) {
  const layer = categoryLayers.get(cell.category);
  if (!layer) return;
  const style = CATEGORY_STYLES[cell.category];
  const rectangle = L.rectangle(cell.bounds, {
    color: '#ffffff',
    weight: 1.5,
    fillColor: style.color,
    fillOpacity: style.fillOpacity
  });
  rectangle.on('mouseover', () => rectangle.setStyle({ fillOpacity: Math.min(0.8, style.fillOpacity + 0.2) }));
  rectangle.on('mouseout', () => rectangle.setStyle({ fillOpacity: style.fillOpacity }));
  rectangle.bindPopup(createPopup(cell));
  rectangle.addTo(layer);
}

function createPopup(cell) {
  const categoryLabels = {
    ZIT: 'Restriction potentielle détectée',
    AUTORISATION: 'Autorisation à vérifier',
    LAC: 'Plan d’eau détecté — décollage au sol à éviter',
    FORET: 'Zone boisée détectée — décollage au sol à vérifier',
    LIBRE: 'Aucune restriction OSM détectée dans cette cellule'
  };
  const labels = cell.labels.length
    ? cell.labels.map((label) => `<li>${escapeHtml(label)}</li>`).join('')
    : '<li>Aucun obstacle OSM identifié</li>';
  const authorities = cell.authorities.length
    ? `<p class="restriction-popup-muted">${cell.authorities.map(escapeHtml).join(' · ')}</p>`
    : '';
  const profiles = DRONE_PROFILES.map((drone) => `
    <div class="restriction-drone-card">
      <strong>${escapeHtml(drone.name)}</strong>
      <span>Vitesse max. constructeur : ${escapeHtml(drone.speed)}</span>
      <a href="${drone.url}" target="_blank" rel="noopener noreferrer">Fiche constructeur</a>
    </div>
  `).join('');

  return `
    <div class="restriction-popup">
      <div class="restriction-popup-header">Secteur ${escapeHtml(cell.locationName)}
        <span>Centre : ${cell.center[0].toFixed(4)}, ${cell.center[1].toFixed(4)}</span>
      </div>
      <div class="restriction-popup-body">
        <strong>${categoryLabels[cell.category]}</strong>
        ${authorities}
        <ul>${labels}</ul>
        <h3>Profils de drones</h3>
        ${profiles}
        <p class="restriction-popup-warning">Données collaboratives OpenStreetMap, non officielles. Cette analyse ne confirme pas la légalité d’un vol. Vérifiez les restrictions UAS officielles sur <a href="https://www.geoportail.gouv.fr/donnees/restrictions-uas-categorie-ouverte-et-aeromodelisme" target="_blank" rel="noopener noreferrer">Géoportail</a> avant toute mission.</p>
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function syncLayerVisibility() {
  const map = getLeafletMap();
  if (!map) return;
  CATEGORIES.forEach((category) => {
    const layer = categoryLayers.get(category);
    if (!layer) return;
    const shouldShow = state.restrictions.visible && state.restrictions.filters[category];
    if (shouldShow && !map.hasLayer(layer)) layer.addTo(map);
    if (!shouldShow && map.hasLayer(layer)) layer.remove();
  });
}
