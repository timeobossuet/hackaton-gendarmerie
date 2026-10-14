import { droneModels, persistMissions, state } from '../state.js';
import { getLeafletMap } from '../map.js';
import { getProtectedArea } from './area.js';
import { getPilot, getPilotModel, syncFleet } from './fleet.js';
import { bindRadiusEditor, resetRadiusEditor } from './radius-editor.js';

let placementLayer = null;

function getOptimizer() {
  if (!window.DroneOptimizer) throw new Error('Le calculateur de placement est indisponible. Rechargez la page puis réessayez.');
  return window.DroneOptimizer;
}

export function clearPlacement(options = {}) {
  placementLayer?.clearLayers();
  resetRadiusEditor();
  if (!options.preserveState) state.planning.placement = null;
}

export function calculatePlacement(options = {}) {
  const optimizer = getOptimizer();
  state.planning.placementError = null;
  const collisionInput = document.getElementById('max-collision-input');
  const maxAllowed = collisionInput ? Number(collisionInput.value) : Number(state.planning.maxCollisionPercent ?? 50);
  if (!Number.isFinite(maxAllowed) || maxAllowed < 0 || maxAllowed > 100 || (collisionInput && !collisionInput.value.trim())) {
    throw new Error('Indiquez un seuil de collision compris entre 0 et 100%.');
  }

  const previous = !options.fresh && state.planning.moveTeamWithDrone
    ? state.planning.placement?.pilotsLatLng ?? null
    : null;
  clearPlacement();

  const gpx = state.planning.gpxGeoJson;
  const area = getProtectedArea();
  if (!gpx && !area) throw new Error('Ajoutez un chemin GPX ou dessinez une zone protégée avant de calculer le placement.');

  const fleet = syncFleet();
  if (!fleet.length) throw new Error('Affectez au moins un télépilote à un drone disponible.');
  const overbooked = droneModels.find((model) =>
    fleet.filter((pilot) => pilot.droneModelId === model.id).length > Number(state.planning.droneStock?.[model.id] ?? 0)
  );
  if (overbooked) throw new Error(`Le stock de ${overbooked.model} est inférieur au nombre de télépilotes affectés.`);
  const invalidPilot = fleet.find((pilot) => {
    const model = getPilotModel(pilot);
    return !model || !Number.isFinite(pilot.radius) || pilot.radius > model.maxRange;
  });
  if (invalidPilot) throw new Error(`Le rayon du télépilote ${invalidPilot.name} dépasse la portée de son drone.`);

  const lines = gpx ? optimizer.extractLines(gpx) : [];
  const rings = area ? optimizer.extractRings([area]) : [];
  const activeCounts = {
    small: fleet.filter((pilot) => pilot.type === 'small').length,
    large: fleet.filter((pilot) => pilot.type === 'large').length
  };
  const pilotsInput = fleet.map(({ id, name, type, radius }) => ({ id, name, type, radius }));
  const demand = optimizer.buildDemand(lines, rings, {
    radius: state.planning.bufferMeters,
    wPath: state.planning.pathWeight,
    wPoly: state.planning.areaWeight,
    timeProgress: Math.max(0, Math.min(100, Number(state.planning.operationProgress) || 0)) / 100
  });
  const result = optimizer.optimize(demand, activeCounts, pilotsInput, {
    previous,
    preservePositions: Boolean(state.planning.moveTeamWithDrone)
  });
  const collisions = renderPlacement(result.pilots, demand.proj);
  if (collisions.percent > maxAllowed) {
    clearPlacement();
    persistMissions();
    throw new Error(`Calcul annulé : le chevauchement est de ${collisions.percent}% (maximum autorisé : ${maxAllowed}%).`);
  }

  state.planning.placement = {
    ...result,
    collisions,
    radii: Object.fromEntries(fleet.map((pilot) => [pilot.id, pilot.radius])),
    computedAt: Date.now(),
    activeCounts,
    pilotsLatLng: result.pilots.map((pilot) => {
      const [lat, lng] = demand.proj.toLatLng(pilot.x, pilot.y);
      return { id: pilot.id, type: pilot.type, lat, lng };
    }),
    movedPilots: result.pilots.filter((pilot) => pilot.moved > 5).length
  };
  persistMissions();
  return state.planning.placement;
}

function renderPlacement(pilots, projection) {
  const map = getLeafletMap();
  placementLayer?.remove();
  placementLayer = L.featureGroup().addTo(map);
  const palette = ['#e51e64', '#8e24aa', '#034a90', '#15803d', '#b45309', '#7c3aed'];
  const colors = Object.fromEntries(droneModels.map((drone, index) => [drone.id, palette[index % palette.length]]));
  const placed = pilots.map((pilot, index) => {
    const meta = getPilot(pilot.id);
    const model = meta && getPilotModel(meta);
    if (!meta || !model) throw new Error("L'optimiseur doit renvoyer l'identifiant de chaque télépilote.");
    return { ...pilot, index, meta, model, latLng: projection.toLatLng(pilot.x, pilot.y) };
  });

  const circleLayers = placed.map((pilot) => {
    const color = colors[pilot.model.id] || '#034a90';
    return L.circle(pilot.latLng, {
      radius: pilot.radius,
      color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.08
    }).addTo(placementLayer);
  });

  let pairs = 0;
  let collisionArea = 0;
  let maxOverlapPercent = 0;
  const circles = placed.map((pilot) => turf.circle(
    [pilot.latLng[1], pilot.latLng[0]],
    pilot.radius / 1000,
    { steps: 72, units: 'kilometers' }
  ));
  for (let first = 0; first < placed.length; first += 1) {
    for (let second = first + 1; second < placed.length; second += 1) {
      const distance = Math.hypot(placed[first].x - placed[second].x, placed[first].y - placed[second].y);
      if (distance >= placed[first].radius + placed[second].radius) continue;
      let intersection = null;
      try {
        intersection = turf.intersect(turf.featureCollection([circles[first], circles[second]]));
      } catch {
        intersection = turf.intersect(circles[first], circles[second]);
      }
      if (!intersection) continue;
      pairs += 1;
      const currentCollisionArea = turf.area(intersection);
      collisionArea += currentCollisionArea;
      const smallestArea = Math.PI * Math.min(placed[first].radius ** 2, placed[second].radius ** 2);
      maxOverlapPercent = Math.max(maxOverlapPercent, (currentCollisionArea / smallestArea) * 100);
      L.geoJSON(intersection, {
        style: { color: '#ff1744', weight: 2, fillColor: '#ff1744', fillOpacity: 0.025 },
        interactive: false
      }).addTo(placementLayer);
    }
  }

  placed.forEach((pilot, index) => {
    const color = colors[pilot.model.id] || '#034a90';
    const marker = L.circleMarker(pilot.latLng, {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: color,
      fillOpacity: 1
    }).bindTooltip(`${pilot.meta.name} · ${pilot.model.model} · ${pilot.radius / 1000} km`, {
      permanent: true,
      direction: 'top',
      offset: [0, -6],
      className: 'pilot-label'
    }).addTo(placementLayer);
    bindRadiusEditor(pilot.meta.id, circleLayers[index], marker);
  });
  return { pairs, collisionArea, percent: Math.round(maxOverlapPercent) };
}
