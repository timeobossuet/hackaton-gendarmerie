import { MAP_CONFIG } from './config.js';
import { DEFAULT_DRONE_MODEL_IDS, DRONE_MODELS } from '../data/drones.js';

const STORAGE_KEY = 'aeris-missions';
const DRONE_STORAGE_KEY = 'aeris-drone-models';

function loadDroneModels() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRONE_STORAGE_KEY));
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch {
    // Ignore corrupted local data and use the bundled catalogue.
  }
  return DRONE_MODELS.map((drone) => ({ ...drone }));
}

export const droneModels = loadDroneModels();
function hasDroneModel(id) {
  return droneModels.some((drone) => drone.id === id);
}

function fallbackDroneModelId(range, preferredId) {
  if (hasDroneModel(preferredId)) return preferredId;
  return droneModels.find((drone) => drone.maxRange === range)?.id || droneModels[0]?.id || '';
}

function defaultDroneStock() {
  return Object.fromEntries(droneModels.map((drone) => [drone.id, 0]));
}

function initialDroneStock() {
  const stock = defaultDroneStock();
  const smallModelId = fallbackDroneModelId(1000, DEFAULT_DRONE_MODEL_IDS.small);
  const largeModelId = fallbackDroneModelId(2000, DEFAULT_DRONE_MODEL_IDS.large);
  stock[smallModelId] = (stock[smallModelId] || 0) + 3;
  stock[largeModelId] = (stock[largeModelId] || 0) + 2;
  return stock;
}

export function createMission(name = 'Mission sans nom') {
  return {
    id: `mission-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    polygonAdded: false,
    polygonPoints: [],
    planning: {
      areaMode: 'buffer',
      bufferMeters: 200,
      maxCollisionPercent: 50,
      gpxFileName: null,
      gpxGeoJson: null,
      smallDrones: 0,
      largeDrones: 0,
      smallDroneModelId: fallbackDroneModelId(1000, DEFAULT_DRONE_MODEL_IDS.small),
      largeDroneModelId: fallbackDroneModelId(2000, DEFAULT_DRONE_MODEL_IDS.large),
      droneStock: initialDroneStock(),
      fleet: [],
      pilotCounter: 0,
      fleetInitialized: true,
      pathWeight: 10,
      areaWeight: 1,
      targetCoverage: 80,
      operationProgress: 0,
      moveTeamWithDrone: false,
      calculating: false,
      placement: null,
      placementError: null
    },
    weather: {
      gridSize: 5,
      scanning: false,
      progress: 0,
      location: null,
      error: null,
      cells: []
    }
  };
}

// Complète les missions sauvegardées avant l'ajout de nouveaux champs (ex. operationProgress).
function normalizeMission(mission) {
  const defaults = createMission(mission?.name);
  const savedPlanning = mission?.planning || {};
  const legacyStock = Array.isArray(savedPlanning.fleet) ? null : savedPlanning.fleet;
  const teleoperators = Array.isArray(savedPlanning.fleet)
    ? savedPlanning.fleet
    : (Array.isArray(savedPlanning.teleoperators) ? savedPlanning.teleoperators : []);
  const droneStock = {
    ...defaults.planning.droneStock,
    ...(savedPlanning.droneStock || legacyStock || {})
  };
  if (!savedPlanning.droneStock && !legacyStock) {
    const assignedCounts = {};
    teleoperators.forEach((pilot) => {
      const modelId = hasDroneModel(pilot.droneModelId)
        ? pilot.droneModelId
        : fallbackDroneModelId(pilot.type === 'large' ? 2000 : 1000,
          pilot.type === 'large' ? savedPlanning.largeDroneModelId : savedPlanning.smallDroneModelId);
      if (modelId) assignedCounts[modelId] = (assignedCounts[modelId] || 0) + 1;
    });
    Object.entries(assignedCounts).forEach(([modelId, count]) => {
      droneStock[modelId] = Math.max(Number(droneStock[modelId]) || 0, count);
    });
  }
  return {
    ...defaults,
    ...mission,
    planning: {
      ...defaults.planning,
      ...savedPlanning,
      fleet: teleoperators,
      droneStock,
      fleetInitialized: Boolean(savedPlanning.fleetInitialized || teleoperators.length || legacyStock)
    },
    weather: { ...defaults.weather, ...mission?.weather }
  };
}

function loadMissions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved) && saved.length > 0) return saved.map(normalizeMission);
  } catch {
    // Ignore corrupted local data and start with a clean workspace.
  }
  return [createMission('Mission 1')];
}

const missions = loadMissions();

// Etat local de l'interface. Les composants sont rendus à partir de cet objet.
export const state = {
  leftMenuOpen: true,
  rightMenuOpen: true,
  weatherVisible: false,
  mapStyle: 'osm',
  preparationTab: 'route',
  missionMenuOpen: false,
  activeMissionId: missions[0].id,
  missions,
  droneModels,
  polygonAdded: missions[0].polygonAdded,
  drawingPolygon: false,
  polygonPoints: missions[0].polygonPoints,
  planning: missions[0].planning,
  zoomSensitivity: MAP_CONFIG.defaultZoomSensitivity,
  zoomSettingsOpen: false,
  selectedPilotId: null,
  droneSettingsOpen: false,
  weather: missions[0].weather,
  panelPositions: {
    left: null,
    right: null
  }
};

export function persistMissions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.missions));
  } catch {
    // The workspace remains usable when browser storage is unavailable.
  }
}

export function persistDroneModels() {
    try {
      localStorage.setItem(DRONE_STORAGE_KEY, JSON.stringify(droneModels));
    } catch {
      // The catalogue remains available for the current session.
    }
}

export function addDroneModel(model) {
    droneModels.push(model);
    state.missions.forEach((mission) => { mission.planning.droneStock[model.id] = 0; });
    persistDroneModels();
    persistMissions();
}

export function updateDroneModel(id, changes) {
    const index = droneModels.findIndex((drone) => drone.id === id);
    if (index === -1) return false;
    const current = droneModels[index];
    const updated = { ...current, ...changes };
    const assigned = state.missions.flatMap((mission) => mission.planning.fleet || [])
      .filter((pilot) => pilot.droneModelId === id);
    if (assigned.some((pilot) => Number(pilot.radius) > updated.maxRange && pilot.radius !== pilot.defaultRadius)) {
      throw new Error('La portée du modèle ne peut pas être réduite sous le rayon d’un téléopérateur affecté.');
    }
    droneModels[index] = updated;
    state.missions.forEach((mission) => {
      if (!(id in mission.planning.droneStock)) mission.planning.droneStock[id] = 0;
      const assignedPilots = (mission.planning.fleet || []).filter((pilot) => pilot.droneModelId === id);
      assignedPilots.forEach((pilot) => {
        if (pilot.radius === pilot.defaultRadius) pilot.radius = updated.maxRange;
        pilot.defaultRadius = updated.maxRange;
      });
      if (current.maxRange !== updated.maxRange && assignedPilots.length && mission.planning.placement) {
        mission.planning.placement.stale = true;
      }
    });
    persistDroneModels();
    persistMissions();
    return true;
}
export function removeDroneModel(id) {
    if (droneModels.length <= 1) return false;
    const index = droneModels.findIndex((drone) => drone.id === id);
    if (index === -1) return false;
    const inUse = state.missions.some((mission) =>
      Number(mission.planning.droneStock?.[id] || 0) > 0
      || (mission.planning.fleet || []).some((pilot) => pilot.droneModelId === id)
    );
    if (inUse) return false;
    droneModels.splice(index, 1);
    state.missions.forEach((mission) => {
      delete mission.planning.droneStock[id];
      if (mission.planning.smallDroneModelId === id) mission.planning.smallDroneModelId = fallbackDroneModelId(1000, DEFAULT_DRONE_MODEL_IDS.small);
      if (mission.planning.largeDroneModelId === id) mission.planning.largeDroneModelId = fallbackDroneModelId(2000, DEFAULT_DRONE_MODEL_IDS.large);
    });
    persistDroneModels();
    persistMissions();
    return true;
}
export function saveActiveMission() {
  const mission = state.missions.find(({ id }) => id === state.activeMissionId);
  if (!mission) return;
  mission.polygonAdded = state.polygonAdded;
  mission.polygonPoints = state.polygonPoints;
  mission.planning = state.planning;
  mission.weather = state.weather;
  persistMissions();
}

export function activateMission(id) {
  saveActiveMission();
  const mission = state.missions.find((item) => item.id === id);
  if (!mission) return false;
  state.activeMissionId = mission.id;
  state.polygonAdded = mission.polygonAdded;
  state.polygonPoints = mission.polygonPoints;
  state.planning = mission.planning;
  state.weather = mission.weather;
  return true;
}

export function addMission(name) {
  saveActiveMission();
  const mission = createMission(name);
  state.missions.push(mission);
  activateMission(mission.id);
  persistMissions();
}

export function renameMission(name) {
  const mission = state.missions.find(({ id }) => id === state.activeMissionId);
  if (mission && name.trim()) {
    mission.name = name.trim();
    persistMissions();
  }
}

export function removeActiveMission() {
  if (state.missions.length <= 1) return false;
  const index = state.missions.findIndex(({ id }) => id === state.activeMissionId);
  state.missions.splice(index, 1);
  const nextMission = state.missions[Math.max(0, index - 1)];
  state.activeMissionId = nextMission.id;
  state.polygonAdded = nextMission.polygonAdded;
  state.polygonPoints = nextMission.polygonPoints;
  state.planning = nextMission.planning;
  state.weather = nextMission.weather;
  persistMissions();
  return true;
}