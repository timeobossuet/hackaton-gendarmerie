import { state } from '../state.js';

export const PILOT_TYPES = {
  small: { label: '1 km', radius: 1000, countKey: 'smallDrones' },
  large: { label: '2 km', radius: 2000, countKey: 'largeDrones' }
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

function createPilot(type) {
  const planning = state.planning;
  const used = new Set((planning.fleet ?? []).map((pilot) => pilot.id));
  let n;
  let id;
  // Saute les ID déjà pris (un TP peut avoir été renommé "TP-05" à la main).
  do {
    planning.pilotCounter = (planning.pilotCounter ?? 0) + 1;
    n = planning.pilotCounter;
    id = `TP-${String(n).padStart(2, '0')}`;
  } while (used.has(id));

  const round = Math.floor((n - 1) / CALLSIGNS.length);
  const radius = PILOT_TYPES[type].radius;
  return {
    id,
    name: `TP ${CALLSIGNS[(n - 1) % CALLSIGNS.length]}${round ? ` ${round + 1}` : ''}`,
    type,
    defaultRadius: radius,
    radius
  };
}

// Les anciens compteurs restent à jour (ils sont dérivés de la flotte).
function syncCounters() {
  Object.values(PILOT_TYPES).forEach(({ countKey }, index) => {
    const type = Object.keys(PILOT_TYPES)[index];
    state.planning[countKey] = state.planning.fleet.filter((pilot) => pilot.type === type).length;
  });
}

// La flotte est la source de vérité. On ne la crée à partir des compteurs
// qu'une seule fois (nouvelle mission ou mission sauvegardée avant cette feature).
export function syncFleet() {
  const planning = state.planning;
  planning.fleet ??= [];

  if (planning.fleet.length) {
    planning.fleetInitialized = true;
  } else if (!planning.fleetInitialized) {
    Object.entries(PILOT_TYPES).forEach(([type, { countKey }]) => {
      const wanted = Math.max(0, Number(planning[countKey]) || 0);
      for (let i = 0; i < wanted; i += 1) planning.fleet.push(createPilot(type));
    });
    planning.fleetInitialized = true;
  }
  syncCounters();
  return planning.fleet;
}

export function addPilot(type) {
  if (!PILOT_TYPES[type]) return null;
  const planning = state.planning;
  planning.fleet ??= [];
  if (planning.fleet.length >= MAX_PILOTS) return null;

  const pilot = createPilot(type);
  planning.fleet.push(pilot);
  planning.fleetInitialized = true;
  if (planning.placement) planning.placement.stale = true;
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

// Modifie le nom et/ou l'ID. Renvoie { ok, pilot } ou { ok: false, error }.
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
    // Garde le placement affiché cohérent (sinon il serait vu comme "périmé").
    const placement = state.planning.placement;
    if (placement) {
      if (placement.radii && oldId in placement.radii) {
        placement.radii[newId] = placement.radii[oldId];
        delete placement.radii[oldId];
      }
      placement.pilots?.forEach((item) => { if (item.id === oldId) item.id = newId; });
    }
  }
  return { ok: true, pilot };
}

export function getPilot(id) {
  return state.planning.fleet?.find((pilot) => pilot.id === id) ?? null;
}

export function setPilotRadius(id, radius) {
  const pilot = getPilot(id);
  if (!pilot) return null;
  const snapped = Math.round(Number(radius) / RADIUS_STEP) * RADIUS_STEP;
  pilot.radius = Math.min(pilot.defaultRadius, Math.max(MIN_RADIUS, snapped));
  return pilot;
}

export function resetPilotRadii() {
  (state.planning.fleet ?? []).forEach((pilot) => { pilot.radius = pilot.defaultRadius; });
}

export const hasCustomRadius = (pilot) => pilot.radius !== pilot.defaultRadius;

export function formatRadius(meters) {
  return meters >= 1000 ? `${(meters / 1000).toLocaleString('fr-FR')} km` : `${meters} m`;
}

// Vrai si la flotte a changé (rayon, ajout, suppression) depuis le dernier calcul.
export function isPlacementStale() {
  const placement = state.planning.placement;
  if (!placement) return false;
  if (placement.stale) return true;
  if (!placement.radii) return false;
  return (state.planning.fleet ?? []).some((pilot) => placement.radii[pilot.id] !== pilot.radius);
}