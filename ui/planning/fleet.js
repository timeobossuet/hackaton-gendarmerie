import { state } from '../state.js';

export const PILOT_TYPES = {
  small: { label: '1 km', radius: 1000, countKey: 'smallDrones' },
  large: { label: '2 km', radius: 2000, countKey: 'largeDrones' }
};
export const MIN_RADIUS = 200;
export const RADIUS_STEP = 50;

const CALLSIGNS = [
  'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India',
  'Juliett', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo',
  'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'X-ray', 'Yankee', 'Zulu'
];

function createPilot(type) {
  state.planning.pilotCounter = (state.planning.pilotCounter ?? 0) + 1;
  const n = state.planning.pilotCounter;
  const round = Math.floor((n - 1) / CALLSIGNS.length);
  const radius = PILOT_TYPES[type].radius;
  return {
    id: `TP-${String(n).padStart(2, '0')}`,
    name: `TP ${CALLSIGNS[(n - 1) % CALLSIGNS.length]}${round ? ` ${round + 1}` : ''}`,
    type,
    defaultRadius: radius,
    radius
  };
}

// Aligne la flotte sur les compteurs "Drones 1 km / 2 km" sans toucher
// aux TP existants (leurs ID et leurs rayons modifiés sont conservés).
export function syncFleet() {
  const planning = state.planning;
  planning.fleet ??= [];

  Object.entries(PILOT_TYPES).forEach(([type, { countKey }]) => {
    const wanted = Math.max(0, Number(planning[countKey]) || 0);
    const current = planning.fleet.filter((pilot) => pilot.type === type);

    if (current.length > wanted) {
      const removed = new Set(current.slice(wanted).map((pilot) => pilot.id));
      planning.fleet = planning.fleet.filter((pilot) => !removed.has(pilot.id));
    } else {
      for (let i = current.length; i < wanted; i += 1) planning.fleet.push(createPilot(type));
    }
  });
  return planning.fleet;
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

// Vrai si un rayon a changé depuis le dernier calcul du placement.
export function isPlacementStale() {
  const radii = state.planning.placement?.radii;
  if (!radii) return false;
  return (state.planning.fleet ?? []).some((pilot) => radii[pilot.id] !== pilot.radius);
}