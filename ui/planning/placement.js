import { state } from '../state.js';
import { getLeafletMap } from '../map.js';
import { getProtectedArea } from './area.js';
import { getPilot, syncFleet } from './fleet.js';
import { bindRadiusEditor, resetRadiusEditor } from './radius-editor.js';

let placementLayer = null;

function getOptimizer() {
  if (!window.DroneOptimizer) throw new Error('Le calculateur de placement est indisponible. Rechargez la page puis réessayez.');
  return window.DroneOptimizer;
}

export function clearPlacement() {
  placementLayer?.clearLayers();
  resetRadiusEditor();
  state.planning.placement = null;
}

export function calculatePlacement() {
  const optimizer = getOptimizer();
  clearPlacement();
  const gpx = state.planning.gpxGeoJson;
  const area = getProtectedArea();
  if (!gpx && !area) throw new Error('Ajoutez un chemin GPX ou dessinez une zone protégée avant de calculer le placement.');

  const lines = gpx ? optimizer.extractLines(gpx) : [];
  const rings = area ? optimizer.extractRings([area]) : [];
  const fleet = syncFleet();
  if (!fleet.length) throw new Error('Indiquez au moins un drone de 1 km ou de 2 km.');

  const counts = {
    small: fleet.filter((pilot) => pilot.type === 'small').length,
    large: fleet.filter((pilot) => pilot.type === 'large').length
  };
  const pilotsInput = fleet.map(({ id, name, type, radius }) => ({ id, name, type, radius }));

  const demand = optimizer.buildDemand(lines, rings, {
    radius: state.planning.bufferMeters,
    wPath: state.planning.pathWeight,
    wPoly: state.planning.areaWeight
  });
  const result = optimizer.optimize(demand, counts, pilotsInput);
  const collisions = renderPlacement(result.pilots, demand.proj);
  state.planning.placement = {
    ...result,
    collisions,
    radii: Object.fromEntries(fleet.map((pilot) => [pilot.id, pilot.radius])),
    computedAt: Date.now()
  };
  return state.planning.placement;
}

function renderPlacement(pilots, projection) {
  const map = getLeafletMap();
  placementLayer?.remove();
  placementLayer = L.featureGroup().addTo(map);

  const placed = pilots.map((pilot, index) => {
    const meta = getPilot(pilot.id);
    if (!meta) throw new Error("L'optimiseur doit renvoyer l'id de chaque pilote (voir étape 2).");
    return { ...pilot, index, meta, latLng: projection.toLatLng(pilot.x, pilot.y) };
  });
  const colors = { small: '#e51e64', large: '#8e24aa' };

  const circleLayers = placed.map((pilot) => L.circle(pilot.latLng, {
    radius: pilot.radius,
    color: colors[pilot.type],
    weight: 2,
    fillColor: colors[pilot.type],
    fillOpacity: 0.08
  }).addTo(placementLayer));

  let pairs = 0;
  let collisionArea = 0;
  const turfCircles = placed.map((pilot) => turf.circle(
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
      const intersection = turf.intersect(turf.featureCollection([turfCircles[first], turfCircles[second]]));
      if (!intersection) continue;
      pairs += 1;
      collisionArea += turf.area(intersection);
      L.geoJSON(intersection, {
        style: { color: '#ff1744', weight: 2, fillColor: '#ff1744', fillOpacity: 0.025 },
        interactive: false
      }).addTo(placementLayer);
    }
  }

  placed.forEach((pilot, i) => {
    const marker = L.circleMarker(pilot.latLng, {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: colors[pilot.type],
      fillOpacity: 1
    }).bindTooltip(pilot.meta.id, {
      permanent: true,
      direction: 'top',
      offset: [0, -6],
      className: 'pilot-label'
    }).addTo(placementLayer);

    bindRadiusEditor(pilot.meta.id, circleLayers[i], marker);
  });
  return { pairs, collisionArea };
}