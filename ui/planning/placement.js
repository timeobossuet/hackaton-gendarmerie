import { state } from '../state.js';
import { getLeafletMap } from '../map.js';
import { getProtectedArea } from './area.js';
import * as nativeOptimizer from './optimizer.js';

let placementLayer = null;

function getOptimizer() {
  if (window.DroneOptimizer && typeof window.DroneOptimizer.optimize === 'function') {
    return window.DroneOptimizer;
  }
  return nativeOptimizer;
}

export function clearPlacement() {
  placementLayer?.clearLayers();
  state.planning.placement = null;
}

function intersectFeatures(a, b) {
  if (typeof turf === 'undefined') return null;
  try {
    return turf.intersect(turf.featureCollection([a, b]));
  } catch (e1) {
    try {
      return turf.intersect(a, b);
    } catch (e2) {
      return null;
    }
  }
}

export function calculatePlacement() {
  const optimizer = getOptimizer();
  clearPlacement();
  const gpx = state.planning.gpxGeoJson;
  const area = getProtectedArea();
  if (!gpx && !area) throw new Error('Ajoutez un chemin GPX ou activez une zone d’opération avant de lancer le placement.');

  const lines = gpx ? optimizer.extractLines(gpx) : [];
  const rings = area ? optimizer.extractRings([area]) : [];
  const counts = {
    small: Math.max(0, Number(state.planning.smallDrones) || 0),
    large: Math.max(0, Number(state.planning.largeDrones) || 0)
  };
  if (counts.small + counts.large === 0) throw new Error('Indiquez au moins 1 drone (1 km ou 2 km).');

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
  if (!map) return { pairs: 0, collisionArea: 0 };

  placementLayer?.remove();
  placementLayer = L.featureGroup().addTo(map);

  const placed = pilots.map((pilot, index) => ({
    ...pilot,
    index,
    latLng: projection.toLatLng(pilot.x, pilot.y)
  }));

  const colors = { small: '#e51e64', large: '#8e24aa' };

  // 1. Cercles de couverture
  placed.forEach((pilot) => {
    L.circle(pilot.latLng, {
      radius: pilot.radius,
      color: colors[pilot.type] || '#101e30',
      weight: 2,
      fillColor: colors[pilot.type] || '#101e30',
      fillOpacity: 0.12,
      interactive: false
    }).addTo(placementLayer);
  });

  // 2. Détection des chevauchements / collisions
  let pairs = 0;
  let collisionArea = 0;

  if (typeof turf !== 'undefined') {
    const circles = placed.map((pilot) =>
      turf.circle([pilot.latLng[1], pilot.latLng[0]], pilot.radius / 1000, {
        steps: 64,
        units: 'kilometers'
      })
    );

    for (let first = 0; first < placed.length; first += 1) {
      for (let second = first + 1; second < placed.length; second += 1) {
        const distance = Math.hypot(
          placed[first].x - placed[second].x,
          placed[first].y - placed[second].y
        );
        if (distance >= placed[first].radius + placed[second].radius) continue;

        const intersection = intersectFeatures(circles[first], circles[second]);
        if (!intersection) continue;
        pairs += 1;
        collisionArea += turf.area(intersection);
        L.geoJSON(intersection, {
          style: { color: '#ff1744', weight: 1.5, fillColor: '#ff1744', fillOpacity: 0.35 },
          interactive: false
        }).addTo(placementLayer);
      }
    }
  }

  // 3. Marqueurs et tooltips des pilotes
  placed.forEach((pilot) => {
    L.circleMarker(pilot.latLng, {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: colors[pilot.type] || '#101e30',
      fillOpacity: 1
    }).bindTooltip(`Drone #${pilot.index + 1} · Portée ${pilot.radius / 1000} km`).addTo(placementLayer);
  });

  return { pairs, collisionArea };
}
