export async function searchLocation(query) {
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('La recherche géographique a échoué.');

  const data = await response.json();
  const place = data.features?.[0];
  if (!place) throw new Error('Lieu ou code postal introuvable en France.');

  return {
    lat: place.geometry.coordinates[1],
    lng: place.geometry.coordinates[0],
    name: `${place.properties.city || place.properties.name} (${place.properties.postcode || 'France'})`
  };
}

export async function fetchWeather(lat, lng) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    current: 'temperature_2m,wind_speed_10m,wind_gusts_10m,precipitation,surface_pressure',
    hourly: 'wind_gusts_10m,precipitation',
    timezone: 'Europe/Paris',
    forecast_days: '2'
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error('Les données météo sont indisponibles.');
  return response.json();
}
