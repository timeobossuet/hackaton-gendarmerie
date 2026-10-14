import { droneModels, state } from '../state.js';

export const PILOT_TYPES = {
  small: { label: '1 km', countKey: 'smallDrones' },
  large: { label: '2 km', countKey: 'largeDrones' }
};
export const MIN_RADIUS = 200;
export const RADIUS_STEP = 50;
export const MAX_PILOTS = 30;
export const MAX_NAME_LENGTH = 30;
export const MAX_ID_LENGTH = 12;

const CALLSIGNS = [
  'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India',
  'Juliett', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo',
  'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'X-ray', 'Yankee', 'Zulu'
];

function getModel(id) {
  return droneModels.find((drone) => drone.id === id) || null;
}

function modelForType(type) {
  const preferredId = type === 'small'
    ? state.planning.smallDroneModelId
    : state.planning.largeDroneModelId;
  return getModel(preferredId)
    || droneModels.filter((drone) => type === 'small' ? drone.maxRange <= 1000 : drone.maxRange > 1000)
      .sort((a, b) => a.maxRange - b.maxRange)[0]
    || droneModels[0]
    || null;
}

export function getPilotModel(pilot) {
  return getModel(pilot?.droneModelId) || null;
}

export function assignedDroneCount(modelId) {
  return (state.planning.fleet || []).filter((pilot) => pilot.droneModelId === modelId).length;
}

export function availableDroneCount(modelId) {
  return Math.max(0, Number(state.planning.droneStock?.[modelId] || 0) - assignedDroneCount(modelId));
}

function createPilot(type, model = modelForType(type)) {
  if (!model) throw new Error('Ajoutez un modèle de drone avant de créer un téléopérateur.');
  const planning = state.planning;
  const used = new Set((planning.fleet ?? []).map((pilot) => pilot.id));
  let n;
  let id;
  do {
    planning.pilotCounter = (planning.pilotCounter ?? 0) + 1;
    n = planning.pilotCounter;
    id = `TP-${String(n).padStart(2, '0')}`;
  } while (used.has(id));

  const round = Math.floor((n - 1) / CALLSIGNS.length);
  return {
    id,
    name: `TP ${CALLSIGNS[(n - 1) % CALLSIGNS.length]}${round ? ` ${round + 1}` : ''}`,
    type,
    droneModelId: model.id,
    defaultRadius: model.maxRange,
    radius: model.maxRange
  };
}

function syncCounters() {
  Object.entries(PILOT_TYPES).forEach(([type, { countKey }]) => {
    state.planning[countKey] = state.planning.fleet.filter((pilot) => pilot.type === type).length;
  });
}

function normalizePilot(pilot) {
  let model = getModel(pilot.droneModelId);
  if (!model) {
    const legacyType = pilot.type === 'large' ? 'large' : 'small';
    model = modelForType(legacyType);
  }
  if (!model) return null;
  pilot.droneModelId = model.id;
  pilot.type = model.maxRange <= 1000 ? 'small' : 'large';
  pilot.defaultRadius = model.maxRange;
  if (!Number.isFinite(Number(pilot.radius)) || Number(pilot.radius) <= 0) {
    pilot.radius = model.maxRange;
  }
  return pilot;
}

export function syncFleet() {
  const planning = state.planning;
  if (!Array.isArray(planning.fleet)) planning.fleet = [];
  planning.droneStock ||= Object.fromEntries(droneModels.map((drone) => [drone.id, 0]));
  droneModels.forEach((drone) => {
    planning.droneStock[drone.id] = Math.max(0, Number(planning.droneStock[drone.id]) || 0);
  });

  if (!planning.fleetInitialized) {
    Object.entries(PILOT_TYPES).forEach(([type, { countKey }]) => {
      const model = modelForType(type);
      const wanted = Math.max(0, Math.floor(Number(planning[countKey]) || 0));
      for (let i = 0; i < wanted; i += 1) {
        planning.fleet.push(createPilot(type, model));
      }
    });
    planning.fleetInitialized = true;
  }

  planning.fleet = planning.fleet.map(normalizePilot).filter(Boolean);
  syncCounters();
  return planning.fleet;
}

export function addPilot(modelId) {
  const model = getModel(modelId);
  if (!model || state.planning.fleet.length >= MAX_PILOTS || availableDroneCount(model.id) < 1) return null;

  const pilot = createPilot(model.maxRange <= 1000 ? 'small' : 'large', model);
  state.planning.fleet.push(pilot);
  state.planning.fleetInitialized = true;
  if (state.planning.placement) state.planning.placement.stale = true;
  syncCounters();
  return pilot;
}

export function removePilot(id) {
  const fleet = state.planning.fleet ?? [];
  const index = fleet.findIndex((pilot) => pilot.id === id);
  if (index < 0) return false;
  fleet.splice(index, 1);
  if (state.planning.placement) state.planning.placement.stale = true;
  syncCounters();
  return true;
}

export function updatePilotIdentity(oldId, { id, name }) {
  const fleet = state.planning.fleet ?? [];
  const pilot = getPilot(oldId);
  if (!pilot) return { ok: false, error: 'TP introuvable.' };

  const newId = String(id ?? '').trim().slice(0, MAX_ID_LENGTH);
  const newName = String(name ?? '').trim().slice(0, MAX_NAME_LENGTH);
  if (!newId || !newName) return { ok: false, error: 'Le nom et l’identifiant ne peuvent pas être vides.' };
  if (fleet.some((other) => other !== pilot && other.id.toLowerCase() === newId.toLowerCase())) {
    return { ok: false, error: `L’identifiant « ${newId} » est déjà utilisé.` };
  }

  pilot.name = newName;
  if (newId !== oldId) {
    pilot.id = newId;
    const placement = state.planning.placement;
    if (placement) {
      if (placement.radii && oldId in placement.radii) {
        placement.radii[newId] = placement.radii[oldId];
        delete placement.radii[oldId];
      }
      placement.pilots?.forEach((item) => { if (item.id === oldId) item.id = newId; });
      placement.pilotsLatLng?.forEach((item) => { if (item.id === oldId) item.id = newId; });
    }
  }
  return { ok: true, pilot };
}

export function changePilotDrone(id, modelId) {
  const pilot = getPilot(id);
  const model = getModel(modelId);
  if (!pilot || !model) return { ok: false, error: 'Le téléopérateur ou le modèle de drone est introuvable.' };
  const wasDefault = pilot.radius === pilot.defaultRadius;
  if (!wasDefault && pilot.radius > model.maxRange) {
    return { ok: false, error: `Le rayon du téléopérateur (${formatRadius(pilot.radius)}) dépasse la portée du drone (${formatRadius(model.maxRange)}). Réduisez son rayon avant de changer de modèle.` };
  }
  if (model.id !== pilot.droneModelId && availableDroneCount(model.id) < 1) {
    return { ok: false, error: `Aucun drone ${model.model} n’est disponible dans le stock.` };
  }

  pilot.droneModelId = model.id;
  pilot.type = model.maxRange <= 1000 ? 'small' : 'large';
  pilot.defaultRadius = model.maxRange;
  if (wasDefault) pilot.radius = model.maxRange;
  if (state.planning.placement) state.planning.placement.stale = true;
  syncCounters();
  return { ok: true, pilot };
}

export function getPilot(id) {
  return state.planning.fleet?.find((pilot) => pilot.id === id) ?? null;
}

export function setPilotRadius(id, radius) {
  const pilot = getPilot(id);
  if (!pilot) return null;
  const model = getPilotModel(pilot);
  const value = Number(radius);
  if (!Number.isFinite(value) || value < MIN_RADIUS) {
    throw new Error(`Le rayon du téléopérateur doit être d’au moins ${MIN_RADIUS} m.`);
  }
  if (!model || value > model.maxRange) {
    throw new Error('Le rayon du téléopérateur ne peut pas dépasser la portée de son drone.');
  }
  pilot.radius = Math.round(value / RADIUS_STEP) * RADIUS_STEP;
  if (pilot.radius > model.maxRange) pilot.radius = Math.floor(model.maxRange / RADIUS_STEP) * RADIUS_STEP;
  if (state.planning.placement) state.planning.placement.stale = true;
  return pilot;
}

export function resetPilotRadii() {
  (state.planning.fleet ?? []).forEach((pilot) => { pilot.radius = pilot.defaultRadius; });
  if (state.planning.placement) state.planning.placement.stale = true;
}

export const hasCustomRadius = (pilot) => pilot.radius !== pilot.defaultRadius;

export function formatRadius(meters) {
  return meters >= 1000 ? `${(meters / 1000).toLocaleString('fr-FR')} km` : `${meters} m`;
}

export function isPlacementStale() {
  const placement = state.planning.placement;
  if (!placement) return false;
  if (placement.stale) return true;
  if (!placement.radii) return false;
  return (state.planning.fleet ?? []).some((pilot) => placement.radii[pilot.id] !== pilot.radius);
}
