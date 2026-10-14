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
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('La réponse météo est invalide.');
  }
  if (!response.ok || data.error) {
    throw new Error(data.reason || 'Les données météo sont indisponibles.');
  }
  return data;
}
