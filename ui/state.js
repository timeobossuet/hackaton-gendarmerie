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

function defaultFleet() {
  return Object.fromEntries(droneModels.map((drone) => [drone.id, 0]));
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
      smallDrones: 3,
      largeDrones: 2,
      smallDroneModelId: fallbackDroneModelId(1000, DEFAULT_DRONE_MODEL_IDS.small),
      largeDroneModelId: fallbackDroneModelId(2000, DEFAULT_DRONE_MODEL_IDS.large),
      fleet: {
        ...defaultFleet(),
        [fallbackDroneModelId(1000, DEFAULT_DRONE_MODEL_IDS.small)]: 3,
        [fallbackDroneModelId(2000, DEFAULT_DRONE_MODEL_IDS.large)]: 2
      },
      pathWeight: 10,
      areaWeight: 1,
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

function loadMissions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved) && saved.length > 0) {
      return saved.map((mission) => ({
        ...createMission(mission.name || 'Mission sans nom'),
        ...mission,
        planning: {
          ...createMission().planning,
          ...(mission.planning || {}),
          smallDroneModelId: fallbackDroneModelId(1000, mission.planning?.smallDroneModelId || DEFAULT_DRONE_MODEL_IDS.small),
          largeDroneModelId: fallbackDroneModelId(2000, mission.planning?.largeDroneModelId || DEFAULT_DRONE_MODEL_IDS.large)
          ,
          fleet: {
            ...defaultFleet(),
            ...(mission.planning?.fleet || {}),
            ...(mission.planning?.fleet ? {} : {
              [fallbackDroneModelId(1000, mission.planning?.smallDroneModelId || DEFAULT_DRONE_MODEL_IDS.small)]: Number(mission.planning?.smallDrones || 0),
              [fallbackDroneModelId(2000, mission.planning?.largeDroneModelId || DEFAULT_DRONE_MODEL_IDS.large)]: Number(mission.planning?.largeDrones || 0)
            })
          }
        }
      }));
    }
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
    state.missions.forEach((mission) => { mission.planning.fleet[model.id] = 0; });
    persistDroneModels();
}

export function updateDroneModel(id, changes) {
    const index = droneModels.findIndex((drone) => drone.id === id);
    if (index === -1) return false;
    droneModels[index] = { ...droneModels[index], ...changes };
    state.missions.forEach((mission) => {
      if (!(id in mission.planning.fleet)) mission.planning.fleet[id] = 0;
    });
    persistDroneModels();
    return true;
}

export function removeDroneModel(id) {
    if (droneModels.length <= 1) return false;
    const index = droneModels.findIndex((drone) => drone.id === id);
    if (index === -1) return false;
    droneModels.splice(index, 1);
    const replacement = droneModels[0];
    state.missions.forEach((mission) => {
      delete mission.planning.fleet[id];
      if (mission.planning.smallDroneModelId === id) mission.planning.smallDroneModelId = replacement.id;
      if (mission.planning.largeDroneModelId === id) mission.planning.largeDroneModelId = replacement.id;
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
