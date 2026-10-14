import { MAP_CONFIG } from './config.js';

const STORAGE_KEY = 'aeris-missions';

export function createMission(name = 'Mission sans nom') {
  return {
    id: `mission-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    polygonAdded: false,
    polygonPoints: [],
    planning: {
      areaMode: 'buffer',
      bufferMeters: 200,
      gpxFileName: null,
      gpxGeoJson: null,
      smallDrones: 3,
      largeDrones: 2,
      authorizedCategories: { ZIT: false, AUTORISATION: false },
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
    if (Array.isArray(saved) && saved.length > 0) return saved;
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
  polygonAdded: missions[0].polygonAdded,
  drawingPolygon: false,
  polygonPoints: missions[0].polygonPoints,
  planning: missions[0].planning,
  zoomSensitivity: MAP_CONFIG.defaultZoomSensitivity,
  zoomSettingsOpen: false,
  weather: missions[0].weather,
  restrictions: {
    visible: false,
    scanning: false,
    query: '',
    gridSize: 8,
    radiusKm: 6,
    location: null,
    error: null,
    status: '',
    counts: { ZIT: 0, AUTORISATION: 0, LAC: 0, FORET: 0, LIBRE: 0 },
    cells: [],
    filters: { ZIT: true, AUTORISATION: true, LAC: true, FORET: true, LIBRE: true }
  }
};

export function persistMissions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.missions));
  } catch {
    // The workspace remains usable when browser storage is unavailable.
  }
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
