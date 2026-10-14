import { state } from '../state.js';
import { getLeafletMap } from '../map.js';
import { getProtectedArea } from './area.js';

let placementLayer = null;

function getOptimizer() {
  if (!window.DroneOptimizer) throw new Error('Le moteur de placement des drones est indisponible.');
  return window.DroneOptimizer;
}

export function clearPlacement() {
  placementLayer?.clearLayers();
  state.planning.placement = null;
}

export function calculatePlacement() {
  const optimizer = getOptimizer();
  clearPlacement();
  const gpx = state.planning.gpxGeoJson;
  const area = getProtectedArea();
  if (!gpx && !area) throw new Error('Importez un chemin GPX ou définissez une zone protégée.');

  const lines = gpx ? optimizer.extractLines(gpx) : [];
  const rings = area ? optimizer.extractRings([area]) : [];
  const counts = {
    small: Number(state.planning.smallDrones),
    large: Number(state.planning.largeDrones)
  };
  if (counts.small + counts.large === 0) throw new Error('Ajoutez au moins un drone.');

  const demand = optimizer.buildDemand(lines, rings, {
    radius: state.planning.bufferMeters,
    wPath: state.planning.pathWeight,
    wPoly: state.planning.areaWeight
  });
  const result = optimizer.optimize(demand, counts);
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
  const colors = { small: '#e51e64', large: '#8e24aa' };
  placed.forEach((pilot) => {
    L.circle(pilot.latLng, {
      radius: pilot.radius,
      color: colors[pilot.type],
      weight: 2,
      fillColor: colors[pilot.type],
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
    L.circleMarker(pilot.latLng, {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: colors[pilot.type],
      fillOpacity: 1
    }).bindTooltip(`Drone ${pilot.index + 1} · ${pilot.radius / 1000} km`).addTo(placementLayer);
  });
  return { pairs, collisionArea };
}
