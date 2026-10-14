// ui/planning/calculator.js — Calculateur de dimensionnement de flotte de drones

export const DRONE_N1 = {
  id: 'n1',
  name: 'Niveau 1 (N1)',
  shortName: 'N1',
  radiusKm: 1,
  // Surface couverte par un drone N1 : pi * r^2 avec r = 1 km
  areaKm2: Math.PI * 1 * 1 // ~3.14159 km²
};

export const DRONE_N2 = {
  id: 'n2',
  name: 'Niveau 2 (N2)',
  shortName: 'N2',
  radiusKm: 2,
  // Surface couverte par un drone N2 : pi * r^2 avec r = 2 km
  areaKm2: Math.PI * 2 * 2 // ~12.56637 km²
};

/**
 * Construit un objet GeoJSON Polygon valide à partir de points [lat, lng]
 */
export function buildPolygonFeature(latLngPoints) {
  if (!latLngPoints || latLngPoints.length < 3) return null;
  const coordinates = [
    ...latLngPoints.map(([lat, lng]) => [lng, lat]),
    [latLngPoints[0][1], latLngPoints[0][0]] // Fermeture du polygone
  ];
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates]
    }
  };
}

/**
 * Calcule la surface en km² d'un polygone de points [lat, lng]
 */
export function calculatePolygonAreaKm2(latLngPoints) {
  const feature = buildPolygonFeature(latLngPoints);
  if (!feature || typeof turf === 'undefined') return 0;
  try {
    const areaM2 = turf.area(feature);
    return Math.max(0, areaM2 / 1_000_000);
  } catch (error) {
    console.error('Erreur lors du calcul de surface Turf :', error);
    return 0;
  }
}

/**
 * Calcule les besoins minimaux en drones pour couvrir une surface cible.
 *
 * @param {number} areaKm2 - Surface totale de la zone d'opération en km²
 * @param {number} coveragePercent - Pourcentage de couverture souhaité (ex: 80, 90, 100)
 * @param {number} [ratioN1=0.8] - Ratio cible de N1 dans la flotte mixte (80% N1 / 20% N2, soit 4:1)
 */
export function calculateFleetRequirements(areaKm2, coveragePercent, ratioN1 = 0.8) {
  const safeArea = Math.max(0, Number(areaKm2) || 0);
  const safeCoverage = Math.max(1, Math.min(100, Number(coveragePercent) || 80));
  const targetAreaKm2 = safeArea * (safeCoverage / 100);

  const a1 = DRONE_N1.areaKm2;
  const a2 = DRONE_N2.areaKm2;

  if (targetAreaKm2 <= 0) {
    return {
      areaKm2: safeArea,
      coveragePercent: safeCoverage,
      targetAreaKm2: 0,
      areaN1: a1,
      areaN2: a2,
      n1Only: { count: 0, coveredArea: 0 },
      n2Only: { count: 0, coveredArea: 0 },
      mixed: { n1: 0, n2: 0, total: 0, coveredArea: 0, pctN1: 80, pctN2: 20 }
    };
  }

  // 1. Nombre minimal de drones N1 nécessaires seuls
  const n1OnlyCount = Math.max(1, Math.ceil(targetAreaKm2 / a1));
  const n1OnlyCovered = n1OnlyCount * a1;

  // 2. Nombre minimal de drones N2 nécessaires seuls
  const n2OnlyCount = Math.max(1, Math.ceil(targetAreaKm2 / a2));
  const n2OnlyCovered = n2OnlyCount * a2;

  // 3. Flotte mixte selon une répartition fixée (80% N1 et 20% N2, soit un ratio 4/5 et 1/5)
  // On recherche la composition (n1, n2) minimale assurant la couverture cible
  // tout en respectant au mieux la proportion opérationnelle 4:1.
  let mixed = null;

  for (let n = 2; n <= 120; n++) {
    const n2 = Math.max(1, Math.round((1 - ratioN1) * n));
    const n1 = Math.max(1, n - n2);
    const covered = n1 * a1 + n2 * a2;
    if (covered >= targetAreaKm2) {
      mixed = {
        n1,
        n2,
        total: n1 + n2,
        coveredArea: covered,
        pctN1: Math.round((n1 / (n1 + n2)) * 100),
        pctN2: Math.round((n2 / (n1 + n2)) * 100)
      };
      break;
    }
  }

  // Fallback si la zone est immense : multiple de paquets de 5 (4 N1 + 1 N2)
  if (!mixed) {
    const packArea = 4 * a1 + 1 * a2;
    const packs = Math.max(1, Math.ceil(targetAreaKm2 / packArea));
    mixed = {
      n1: packs * 4,
      n2: packs * 1,
      total: packs * 5,
      coveredArea: packs * packArea,
      pctN1: 80,
      pctN2: 20
    };
  }

  return {
    areaKm2: safeArea,
    coveragePercent: safeCoverage,
    targetAreaKm2,
    areaN1: a1,
    areaN2: a2,
    n1Only: {
      count: n1OnlyCount,
      coveredArea: n1OnlyCovered
    },
    n2Only: {
      count: n2OnlyCount,
      coveredArea: n2OnlyCovered
    },
    mixed
  };
}

