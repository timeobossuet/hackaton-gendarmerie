import { state } from '../state.js';
import { getLeafletMap } from '../map.js';

let gpxLayer = null;
let protectedLayer = null;

export function renderPlanningArea() {
  const map = getLeafletMap();
  if (!map) return;

  gpxLayer?.remove();
  protectedLayer?.remove();

  if (state.preparationTab !== 'zone' && state.planning.gpxGeoJson) {
    gpxLayer = L.geoJSON(state.planning.gpxGeoJson, {
      style: { color: '#f59e0b', weight: 4, opacity: 0.9 }
    }).addTo(map);
  }

  const area = state.preparationTab === 'zone' ? null : getProtectedArea();
  if (area) {
    protectedLayer = L.geoJSON(area, {
      style: {
        color: state.planning.areaMode === 'buffer' ? '#dc2626' : '#034a90',
        weight: 2,
        dashArray: state.planning.areaMode === 'buffer' ? '6 4' : '4 4',
        fillOpacity: 0.18
      }
    }).addTo(map);
  }
}

export function getProtectedArea() {
  if (state.planning.areaMode === 'polygon') return getDrawnPolygon();

  if (state.planning.gpxGeoJson && state.planning.bufferMeters > 0) {
    return turf.buffer(state.planning.gpxGeoJson, state.planning.bufferMeters, { units: 'meters' });
  }
  return null;
}

export function getPolygonAreaKm2() {
  const polygon = getDrawnPolygon();
  if (!polygon) return 0;
  if (!window.turf) throw new Error('Le calcul de surface est indisponible. Vérifiez la connexion puis rechargez la page.');
  if (window.turf.booleanValid && !window.turf.booleanValid(polygon)) {
    throw new Error('Le contour dessiné est invalide. Modifiez la zone avant de calculer la flotte.');
  }
  const areaKm2 = window.turf.area(polygon) / 1_000_000;
  if (!Number.isFinite(areaKm2) || areaKm2 <= 0) {
    throw new Error('La zone dessinée est invalide ou sa surface est nulle.');
  }
  return areaKm2;
}

function getDrawnPolygon() {
  if (!state.polygonAdded || state.polygonPoints.length < 3) return null;
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [[
      ...state.polygonPoints.map(([lat, lng]) => [lng, lat]),
      [state.polygonPoints[0][1], state.polygonPoints[0][0]]
    ]] }
  };
}

export function getProtectedBounds() {
  const area = getProtectedArea();
  return area ? L.geoJSON(area).getBounds() : null;
}

export function fitMapToGpx() {
  const map = getLeafletMap();
  if (!map || !state.planning.gpxGeoJson) return;
  const bounds = L.geoJSON(state.planning.gpxGeoJson).getBounds();
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
}
