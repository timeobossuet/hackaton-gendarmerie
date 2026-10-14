const GPX_NAMESPACE = 'http://www.topografix.com/GPX/1/1';

export function parseGpx(text) {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('Le fichier GPX est invalide.');

  const points = [...xml.getElementsByTagNameNS(GPX_NAMESPACE, 'trkpt')]
    .map((point) => [Number(point.getAttribute('lon')), Number(point.getAttribute('lat'))])
    .filter(([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng));

  if (points.length < 2) throw new Error('Le fichier GPX doit contenir au moins deux points.');
  return {
    type: 'Feature',
    properties: { name: xml.querySelector('name')?.textContent?.trim() || 'Tracé GPX' },
    geometry: { type: 'LineString', coordinates: points }
  };
}

export function getGpxBounds(gpx) {
  return L.geoJSON(gpx).getBounds();
}