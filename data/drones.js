export const DRONE_MODELS = [
  {
    id: 'eagle-m1',
    model: 'Eagle M1',
    maxWindSpeed: 45,
    maxZoom: 30,
    thermalVision: true,
    nightVision: true,
    rainTolerance: true,
    maxRange: 1000
  },
  {
    id: 'falcon-x2',
    model: 'Falcon X2',
    maxWindSpeed: 55,
    maxZoom: 40,
    thermalVision: true,
    nightVision: false,
    rainTolerance: true,
    maxRange: 2000
  },
  {
    id: 'scout-s1',
    model: 'Scout S1',
    maxWindSpeed: 35,
    maxZoom: 25,
    thermalVision: false,
    nightVision: false,
    rainTolerance: false,
    maxRange: 1000
  }
];

export const DEFAULT_DRONE_MODEL_IDS = {
  small: DRONE_MODELS.find((drone) => drone.maxRange === 1000)?.id || DRONE_MODELS[0].id,
  large: DRONE_MODELS.find((drone) => drone.maxRange === 2000)?.id || DRONE_MODELS[0].id
};
