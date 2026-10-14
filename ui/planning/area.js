import { state } from '../state.js';
import { getLeafletMap } from '../map.js';

let gpxLayer = null;
let protectedLayer = null;

export function renderPlanningArea() {
  const map = getLeafletMap();
  if (!map) return;

  gpxLayer?.remove();
  protectedLayer?.remove();

  if (state.planning.gpxGeoJson) {
    gpxLayer = L.geoJSON(state.planning.gpxGeoJson, {
      style: { color: '#f59e0b', weight: 4, opacity: 0.9 }
    }).addTo(map);
  }

  const area = getProtectedArea();
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
  if (state.planning.areaMode === 'polygon' && state.polygonAdded && state.polygonPoints.length >= 3) {
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [[
        ...state.polygonPoints.map(([lat, lng]) => [lng, lat]),
        [state.polygonPoints[0][1], state.polygonPoints[0][0]]
      ]] }
    };
  }

  if (state.planning.gpxGeoJson && state.planning.bufferMeters > 0) {
    return turf.buffer(state.planning.gpxGeoJson, state.planning.bufferMeters, { units: 'meters' });
  }
  return null;
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
