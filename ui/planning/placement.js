import { state } from '../state.js';
import { getLeafletMap } from '../map.js';
import { getProtectedArea } from './area.js';

let placementLayer = null;

function getOptimizer() {
  if (!window.DroneOptimizer) throw new Error('Le calculateur de placement est indisponible. Rechargez la page puis réessayez.');
  return window.DroneOptimizer;
}

export function clearPlacement({ preserveState = false } = {}) {
  placementLayer?.clearLayers();
  if (!preserveState) state.planning.placement = null;
}

export function calculatePlacement() {
  const optimizer = getOptimizer();
  const previousPilots = state.planning.placement?.pilots || [];
  const gpx = state.planning.gpxGeoJson;
  const area = getProtectedArea();
  if (!gpx && !area) throw new Error('Ajoutez un chemin GPX ou dessinez une zone protégée avant de calculer le placement.');

  const lines = gpx ? optimizer.extractLines(gpx) : [];
  const rings = area ? optimizer.extractRings([area]) : [];
  const counts = {
    small: Number(state.planning.smallDrones),
    large: Number(state.planning.largeDrones)
  };
  if (counts.small + counts.large === 0) throw new Error('Indiquez au moins un drone de 1 km ou de 2 km.');

  const demand = optimizer.buildDemand(lines, rings, {
    radius: state.planning.bufferMeters,
    wPath: state.planning.pathWeight,
    wPoly: state.planning.areaWeight
  });
  const existingPilots = previousPilots
    .filter((pilot) => Array.isArray(pilot.latLng) && pilot.latLng.length === 2)
    .map((pilot, index) => ({
      id: pilot.id || `drone-${index + 1}`,
      order: index,
      type: pilot.type,
      locked: pilot.locked === true,
      x: demand.proj.toXY(pilot.latLng[1], pilot.latLng[0])[0],
      y: demand.proj.toXY(pilot.latLng[1], pilot.latLng[0])[1]
    }));
  const isPositionAllowed = createPositionEligibility(demand.proj);
  const result = optimizer.optimize(demand, counts, undefined, existingPilots, isPositionAllowed);
  const previousOrder = new Map(existingPilots.map((pilot) => [pilot.id, pilot.order]));
  const pilots = result.pilots
    .map((pilot, index) => ({
      ...pilot,
      id: pilot.id || `drone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${index + 1}`,
      latLng: demand.proj.toLatLng(pilot.x, pilot.y)
    }))
    .sort((first, second) =>
      (previousOrder.get(first.id) ?? Infinity) - (previousOrder.get(second.id) ?? Infinity)
    );
  const collisions = renderPlacement(pilots, demand.proj);
  state.planning.placement = { ...result, pilots, collisions, computedAt: Date.now() };
  return state.planning.placement;
}

function createPositionEligibility(projection) {
  const cells = state.restrictions.cells;
  if (!cells.length) return () => true;

  const firstBounds = cells[0].bounds;
  const size = Math.round(Math.sqrt(cells.length));
  const south = firstBounds[0][0];
  const west = firstBounds[0][1];
  const latStep = (firstBounds[1][0] - south);
  const lngStep = (firstBounds[1][1] - west);
  const authorized = state.planning.authorizedCategories || {};

  return (x, y) => {
    const [lat, lng] = projection.toLatLng(x, y);
    const row = Math.floor((lat - south) / latStep);
    const column = Math.floor((lng - west) / lngStep);
    if (row < 0 || row >= size || column < 0 || column >= size) return false;

    const cell = cells[row * size + column];
    if (!cell || lat < cell.bounds[0][0] || lat > cell.bounds[1][0] ||
      lng < cell.bounds[0][1] || lng > cell.bounds[1][1]) return false;

    if (cell.category === 'ZIT' || cell.category === 'AUTORISATION') {
      return authorized[cell.category] === true;
    }
    return cell.category === 'LIBRE';
  };
}

function renderPlacement(pilots, projection) {
  const map = getLeafletMap();
  placementLayer?.remove();
  placementLayer = L.featureGroup().addTo(map);
  const placed = pilots.map((pilot, index) => ({
    ...pilot,
    index,
    latLng: projection.toLatLng(pilot.x, pilot.y)
  }));
  const colors = { small: '#e51e64', large: '#8e24aa' };
  placed.forEach((pilot) => {
    L.circle(pilot.latLng, {
      radius: pilot.radius,
      color: colors.small,
      weight: 2,
      fillColor: colors.small,
      fillOpacity: 0.08,
      interactive: false
    }).addTo(placementLayer);
  });

  let pairs = 0;
  let collisionArea = 0;
  const circles = placed.map((pilot) => turf.circle(
    [pilot.latLng[1], pilot.latLng[0]],
    pilot.radius / 1000,
    { steps: 72, units: 'kilometers' }
  ));
  for (let first = 0; first < placed.length; first += 1) {
    for (let second = first + 1; second < placed.length; second += 1) {
      const distance = Math.hypot(
        placed[first].x - placed[second].x,
        placed[first].y - placed[second].y
      );
      if (distance >= placed[first].radius + placed[second].radius) continue;
      const intersection = turf.intersect(turf.featureCollection([circles[first], circles[second]]));
      if (!intersection) continue;
      pairs += 1;
      collisionArea += turf.area(intersection);
      L.geoJSON(intersection, {
        style: { color: '#ff1744', weight: 2, fillColor: '#ff1744', fillOpacity: 0.025 },
        interactive: false
      }).addTo(placementLayer);
    }
  }
  placed.forEach((pilot) => {
    const status = pilot.status === 'maintained'
      ? 'position maintenue'
      : pilot.status === 'redeployed' ? 'redéployé' : 'nouveau placement';
    L.circleMarker(pilot.latLng, {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: pilot.status === 'maintained' ? '#15803d' : pilot.status === 'redeployed' ? '#d97706' : colors[pilot.type],
      fillOpacity: 1
    }).bindTooltip(`Drone ${pilot.index + 1} · ${pilot.radius / 1000} km · ${pilot.locked ? 'bloqué' : 'déplaçable'} · ${status}`).addTo(placementLayer);
  });
  return { pairs, collisionArea };
}
