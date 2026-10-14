import { droneModels, state } from '../state.js';
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
  clearPlacement();
  const gpx = state.planning.gpxGeoJson;
  const area = getProtectedArea();
  if (!gpx && !area) throw new Error('Ajoutez un chemin GPX ou dessinez une zone protégée avant de calculer le placement.');

  const lines = gpx ? optimizer.extractLines(gpx) : [];
  const rings = area ? optimizer.extractRings([area]) : [];
  const counts = Object.fromEntries(droneModels.map((drone) => [drone.id, Number(state.planning.fleet?.[drone.id] || 0)]));
  const radii = Object.fromEntries(droneModels.map((drone) => [drone.id, drone.maxRange]));
  if (Object.values(counts).every((count) => count === 0)) throw new Error('Indiquez au moins un drone dans la flotte.');

  const demand = optimizer.buildDemand(lines, rings, {
    radius: state.planning.bufferMeters,
    wPath: state.planning.pathWeight,
    wPoly: state.planning.areaWeight
  });
  const result = optimizer.optimize(demand, counts, radii);
  const collisions = renderPlacement(result.pilots, demand.proj);
  state.planning.placement = { ...result, collisions, computedAt: Date.now() };
  return state.planning.placement;
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
  const palette = ['#e51e64', '#8e24aa', '#034a90', '#15803d', '#b45309', '#7c3aed'];
  const colors = Object.fromEntries(droneModels.map((drone, index) => [drone.id, palette[index % palette.length]]));
  const labels = Object.fromEntries(droneModels.map((drone) => [drone.id, drone.model]));
  placed.forEach((pilot) => {
    const color = colors[pilot.type] || '#034a90';
    L.circle(pilot.latLng, {
      radius: pilot.radius,
      color,
      weight: 2,
      fillColor: color,
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
      let intersection = null;
      try {
        intersection = turf.intersect(turf.featureCollection([circles[first], circles[second]]));
      } catch {
        try {
          intersection = turf.intersect(circles[first], circles[second]);
        } catch {
          intersection = null;
        }
      }
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
    const color = colors[pilot.type] || '#034a90';
    L.circleMarker(pilot.latLng, {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: color,
      fillOpacity: 1
    }).bindTooltip(`Drone ${pilot.index + 1} · ${labels[pilot.type] || 'Modèle'} · ${pilot.radius / 1000} km`).addTo(placementLayer);
  });
  return { pairs, collisionArea };
}
