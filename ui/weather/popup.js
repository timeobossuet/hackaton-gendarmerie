function statusClass(value, warning, critical) {
  return value >= critical ? 'weather-critical' : value >= warning ? 'weather-warning' : 'weather-good';
}

export function weatherPopup(cell) {
  const { weather, lat, lng } = cell;
  const gustClass = statusClass(weather.gust, 38, 43);
  const kpClass = statusClass(weather.kp, 4, 6);
  const rainClass = statusClass(weather.rain, 0.1, 2);

  return `
    <div class="weather-popup">
      <div class="weather-popup-header">Secteur météo <span>${lat.toFixed(4)}, ${lng.toFixed(4)}</span></div>
      <div class="weather-metrics">
        <div><small>Température</small><strong>${weather.temperature} °C</strong></div>
        <div><small>Vent moyen</small><strong>${weather.wind} km/h</strong></div>
        <div><small>Rafales max</small><strong class="${gustClass}">${weather.gust} km/h</strong></div>
        <div><small>Indice Kp</small><strong class="${kpClass}">${weather.kp} / 9</strong></div>
        <div><small>Précipitations</small><strong class="${rainClass}">${weather.rain} mm</strong></div>
        <div><small>Pression</small><strong>${weather.pressure} hPa</strong></div>
      </div>
      <div class="weather-stability ${weather.stability.warning ? 'weather-warning' : 'weather-good'}">${weather.stability.text}</div>
      <div class="weather-drone-title">Compatibilité de la flotte</div>
      ${weather.drones.map((drone) => `
        <div class="weather-drone ${drone.allowed ? 'weather-good' : 'weather-critical'}">
          <span>${drone.name}</span><span>${drone.allowed ? 'Autorisé' : drone.reason}</span>
        </div>
      `).join('')}
    </div>
  `;
}
