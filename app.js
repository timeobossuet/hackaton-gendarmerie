// Données de présentation des deux classes de drones disponibles.
const droneClasses = {
  type1: {
    name: 'Type 1',
    description: 'Longue portée',
    color: '#101e30',
    icon: '●'
  },
  type2: {
    name: 'Type 2',
    description: 'Zone rapprochée',
    color: '#d78345',
    icon: '◆'
  }
};

const MAP_IMAGE = {
  aspectRatio: 2161 / 1850,
  source: 'cartes/carte.png'
};

const MAP_CONFIG = {
  minScale: 1,
  maxScale: 2.5,
  zoomStep: 0.15,
  missionScale: 1.55,
  polygonMinPoints: 3
};

const SELECTORS = {
  app: '#app',
  map: '#map',
  mapContent: '#map-content',
  missionPolygon: '#mission-polygon',
  mapHint: '#map-hint',
  finishZone: '#finish-zone'
};

// Etat unique de l'interface : le rendu est toujours dérivé de ces valeurs.
const state = {
  leftMenuOpen: true,
  rightMenuOpen: true,
  weatherVisible: false,
  coverage: 80,
  type1Count: 2,
  type2Count: 2,
  polygonAdded: false,
  mapZoomed: false,
  drawingPolygon: false,
  polygonPoints: [],
  mapScale: 1,
  mapX: 0,
  mapY: 0
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const getMapElement = () => $(SELECTORS.map);
const getMapRect = () => getMapElement().getBoundingClientRect();

function componentIcon(name, className = 'h-4 w-4') {
  const icons = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m7 7 10 10M17 7 7 17"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 9 6 6 6-6"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>',
    crosshair: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="6"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z"/><path d="M9 3v15m6-12v15"/></svg>'
  };
  return `<span class="${className}">${icons[name]}</span>`;
}

function button({ label, icon, id, extra = '', title = label }) {
  return `<button id="${id}" title="${title}" type="button" class="inline-flex items-center gap-2 rounded-md border border-notion-200 bg-white px-3 py-2 text-sm text-notion-700 shadow-sm transition hover:bg-notion-100 ${extra}">
    ${icon ? componentIcon(icon, 'h-4 w-4') : ''}<span>${label}</span>
  </button>`;
}

function appShell() {
  return `
    <main class="relative h-full w-full">
      ${mapComponent()}
      ${topbarComponent()}
      ${leftPanelComponent()}
      ${rightPanelComponent()}
      ${bottomBarComponent()}
    </main>
  `;
}

function topbarComponent() {
  return `
    <header class="absolute left-4 right-4 top-4 z-20 flex items-center justify-between pointer-events-none">
      <div class="pointer-events-auto flex items-center gap-2 rounded-lg border border-notion-200 bg-white/95 p-1.5 shadow-panel backdrop-blur">
        <button id="toggle-left" title="Ouvrir ou fermer le menu mission" type="button" class="rounded-md p-2 text-notion-500 transition hover:bg-notion-100 hover:text-notion-900">
          ${componentIcon(state.leftMenuOpen ? 'close' : 'menu', 'h-4 w-4')}
        </button>
        <div class="flex items-center gap-2 border-l border-notion-200 pl-3 pr-3">
          <span class="grid h-7 w-7 place-items-center rounded-md bg-notion-900 text-xs font-semibold text-white">A</span>
          <div>
            <div class="text-sm font-semibold leading-none tracking-tight">AERIS</div>
            <div class="mt-1 text-[10px] text-notion-500">Carte de mission</div>
          </div>
        </div>
      </div>
      <div class="pointer-events-auto flex items-center gap-2 rounded-lg border border-notion-200 bg-white/95 p-1.5 shadow-panel backdrop-blur">
        <span class="hidden px-2 text-xs text-notion-500 sm:inline">Mission Grand Hers</span>
        <button id="toggle-right" title="Ouvrir ou fermer le menu affichage" type="button" class="rounded-md p-2 text-notion-500 transition hover:bg-notion-100 hover:text-notion-900">
          ${componentIcon(state.rightMenuOpen ? 'close' : 'menu', 'h-4 w-4')}
        </button>
      </div>
    </header>
  `;
}

function panelFrame({ side, title, eyebrow, content, open }) {
  const position = side === 'left' ? 'left-4' : 'right-4';
  return `
    <aside class="absolute ${position} top-20 z-10 w-[calc(100vw-2rem)] max-w-[300px] rounded-lg border border-notion-200 bg-white/95 shadow-panel backdrop-blur transition-all duration-200 ${open ? 'translate-x-0 opacity-100' : `${side === 'left' ? '-translate-x-[calc(100%+1rem)]' : 'translate-x-[calc(100%+1rem)]'} pointer-events-none opacity-0`}">
      <div class="border-b border-notion-200 px-4 py-3">
        <div class="text-[10px] font-semibold uppercase tracking-widest text-notion-400">${eyebrow}</div>
        <h1 class="mt-1 text-sm font-semibold">${title}</h1>
      </div>
      <div class="max-h-[calc(100vh-10rem)] overflow-y-auto p-4">${content}</div>
    </aside>
  `;
}

function leftPanelComponent() {
  const content = `
    <div class="space-y-5">
      <section>
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-xs font-semibold">Zone de mission</h2>
          <span class="rounded bg-notion-100 px-1.5 py-0.5 text-[10px] text-notion-500">${state.polygonAdded ? 'Ajoutée' : 'À définir'}</span>
        </div>
        <p class="text-xs leading-5 text-notion-500">Ajoutez un polygone sur la carte pour délimiter votre zone d’intervention.</p>
        <button id="add-zone" type="button" class="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-notion-400 px-3 py-2 text-xs font-medium text-notion-700 transition hover:border-aeris hover:bg-[#f1faf8]">
          ${componentIcon(state.drawingPolygon ? 'map' : (state.polygonAdded ? 'map' : 'plus'), 'h-4 w-4')} ${state.drawingPolygon ? 'Cliquez sur la carte pour dessiner' : (state.polygonAdded ? 'Modifier le polygone' : 'Ajouter un polygone')}
        </button>
        ${state.drawingPolygon ? `<button id="finish-zone" type="button" class="mt-2 w-full rounded-md bg-aeris px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1b716a]" ${state.polygonPoints.length < 3 ? 'disabled' : ''}>Valider la zone${state.polygonPoints.length ? ` (${state.polygonPoints.length} points)` : ''}</button>` : ''}
      </section>

      <section class="border-t border-notion-200 pt-4">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-xs font-semibold">Objectif de couverture</h2>
          <span id="coverage-value" class="text-xs font-semibold text-aeris">${state.coverage}%</span>
        </div>
        <input id="coverage-slider" type="range" min="0" max="100" value="${state.coverage}" class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-notion-200 accent-[#238b82]" />
        <div class="mt-1 flex justify-between text-[10px] text-notion-400"><span>0%</span><span>100%</span></div>
      </section>

      <section class="border-t border-notion-200 pt-4">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-xs font-semibold">Flotte disponible</h2>
          <span class="text-[10px] text-notion-400">4 drones</span>
        </div>
        ${droneControlComponent('type1', state.type1Count)}
        ${droneControlComponent('type2', state.type2Count)}
      </section>
    </div>
  `;
  return panelFrame({ side: 'left', eyebrow: 'Configuration', title: 'Préparer la mission', content, open: state.leftMenuOpen });
}

function droneControlComponent(type, count) {
  const drone = droneClasses[type];
  return `
    <div class="mb-3 rounded-md border border-notion-200 p-3 last:mb-0">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="grid h-7 w-7 place-items-center rounded-md text-xs" style="color:${drone.color};background:${drone.color}18">${drone.icon}</span>
          <div><div class="text-xs font-semibold">${drone.name}</div><div class="text-[10px] text-notion-500">${drone.description}</div></div>
        </div>
        <span class="text-xs font-medium text-notion-500">${count}</span>
      </div>
      <input data-drone-type="${type}" type="range" min="0" max="8" value="${count}" class="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-notion-200" style="accent-color:${drone.color}" />
    </div>
  `;
}

function rightPanelComponent() {
  const content = `
    <div class="space-y-5">
      <section>
        <h2 class="mb-2 text-xs font-semibold">Affichage</h2>
        <button id="weather-toggle" type="button" class="flex w-full items-center justify-between rounded-md border border-notion-200 px-3 py-2.5 text-left transition hover:bg-notion-100">
          <span class="flex items-center gap-2 text-xs">${componentIcon('layers', 'h-4 w-4 text-notion-500')} Couche météo</span>
          <span class="relative h-4 w-7 rounded-full ${state.weatherVisible ? 'bg-aeris' : 'bg-notion-200'}"><span class="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${state.weatherVisible ? 'left-3.5' : 'left-0.5'}"></span></span>
        </button>
        <p class="mt-2 text-[10px] leading-4 text-notion-500">Affiche une couche météo par-dessus la carte.</p>
      </section>
      <section class="border-t border-notion-200 pt-4">
        <h2 class="mb-2 text-xs font-semibold">Carte</h2>
        <div class="space-y-1 text-xs">
          <button id="recenter-map" type="button" class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-notion-700 transition hover:bg-notion-100">${componentIcon('crosshair', 'h-4 w-4 text-notion-500')} Recentrer la carte</button>
          <button id="export-map" type="button" class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-notion-700 transition hover:bg-notion-100">${componentIcon('download', 'h-4 w-4 text-notion-500')} Exporter la carte</button>
        </div>
      </section>
      <section class="border-t border-notion-200 pt-4">
        <div class="flex items-start gap-2 rounded-md bg-notion-100 p-3">
          ${componentIcon('map', 'mt-0.5 h-4 w-4 shrink-0 text-notion-500')}
          <div><div class="text-xs font-medium">Fond cartographique</div><div class="mt-1 text-[10px] leading-4 text-notion-500">OpenStreetMap · Mirepoix, France</div></div>
        </div>
      </section>
    </div>
  `;
  return panelFrame({ side: 'right', eyebrow: 'Affichage', title: 'Options de la carte', content, open: state.rightMenuOpen });
}

function mapComponent() {
  const polygonPoints = getPolygonSvgPoints();
  return `
    <div id="map" class="relative h-full w-full cursor-grab select-none overflow-hidden bg-[#dfe9d8] touch-none active:cursor-grabbing">
      <div id="map-content" class="absolute inset-0 will-change-transform" style="transform:translate3d(${state.mapX}px, ${state.mapY}px, 0) scale(${state.mapScale}); transform-origin:center center;">
        <img id="map-image" src="${MAP_IMAGE.source}" alt="Carte du secteur de Mirepoix" class="absolute inset-0 h-full w-full object-cover" />
        <div class="pointer-events-none absolute inset-0 bg-white/10"></div>
        <div id="weather-layer" class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300" style="background:radial-gradient(circle at 18% 24%, rgba(71,145,196,.32), transparent 22%),radial-gradient(circle at 70% 65%, rgba(240,177,78,.24), transparent 25%),linear-gradient(120deg, transparent, rgba(74,137,187,.18));"></div>
        <svg id="mission-polygon" class="pointer-events-none absolute inset-0 h-full w-full ${state.polygonPoints.length ? 'opacity-100' : 'opacity-0'}" viewBox="0 0 ${getMapSvgWidth()} 100" preserveAspectRatio="xMidYMid slice">
          ${polygonPoints ? getPolygonMarkup(polygonPoints) : ''}
        </svg>
      </div>
      <div id="map-hint" class="pointer-events-none absolute left-1/2 top-1/2 z-[1] hidden -translate-x-1/2 -translate-y-1/2 rounded-lg border border-aeris/30 bg-white/95 px-4 py-3 text-center shadow-panel">
        <div class="text-xs font-semibold text-notion-900">${state.drawingPolygon ? 'Dessinez votre zone' : 'Zone de mission ajoutée'}</div>
        <div class="mt-1 text-[10px] text-notion-500">${state.drawingPolygon ? 'Cliquez sur la carte pour ajouter des points' : 'La carte est centrée sur le polygone'}</div>
      </div>
      <div class="absolute bottom-5 left-1/2 z-[2] -translate-x-1/2 rounded-full border border-white/80 bg-white/90 px-3 py-1.5 text-[10px] text-notion-500 shadow-sm backdrop-blur">Mirepoix · Grand Hers</div>
      <div class="absolute bottom-5 right-5 z-[2] flex flex-col overflow-hidden rounded-md border border-notion-200 bg-white/90 shadow-panel backdrop-blur">
        <button id="zoom-in" type="button" class="grid h-8 w-8 place-items-center border-b border-notion-200 text-lg text-notion-500 hover:bg-notion-100">+</button>
        <button id="zoom-out" type="button" class="grid h-8 w-8 place-items-center text-lg text-notion-500 hover:bg-notion-100">−</button>
      </div>
      <div class="absolute bottom-2 left-2 text-[9px] text-notion-500/70">© OpenStreetMap contributors</div>
    </div>
  `;
}

function bottomBarComponent() {
  return `
    <div class="pointer-events-none absolute bottom-4 left-4 z-10 flex items-center gap-2 text-[10px] text-notion-500">
      <span class="pointer-events-auto rounded-md border border-notion-200 bg-white/90 px-2.5 py-1.5 shadow-sm backdrop-blur">Mode préparation</span>
      ${state.polygonAdded ? '<span class="pointer-events-auto rounded-md border border-[#b8ddd7] bg-[#f1faf8] px-2.5 py-1.5 text-aeris shadow-sm">Zone sélectionnée</span>' : ''}
    </div>
  `;
}

function render() {
  $(SELECTORS.app).innerHTML = appShell();
  bindEvents();
}

// Les contrôles sont rebondés après chaque rendu, car les panneaux sont recréés.
function bindEvents() {
  $('#toggle-left').addEventListener('click', toggleLeftMenu);
  $('#toggle-right').addEventListener('click', toggleRightMenu);
  $('#add-zone').addEventListener('click', startPolygonDrawing);
  $(SELECTORS.finishZone)?.addEventListener('click', finishPolygon);
  $('#coverage-slider').addEventListener('input', updateCoverage);
  $$('[data-drone-type]').forEach((slider) => slider.addEventListener('input', updateDroneCount));
  $('#weather-toggle').addEventListener('click', toggleWeatherLayer);
  $('#export-map').addEventListener('click', exportMap);
  $('#recenter-map').addEventListener('click', recenterMap);
  $('#zoom-in').addEventListener('click', () => zoomBy(MAP_CONFIG.zoomStep));
  $('#zoom-out').addEventListener('click', () => zoomBy(-MAP_CONFIG.zoomStep));
  bindMapPan();
  setWeatherLayerVisibility();
}

function toggleLeftMenu() {
  state.leftMenuOpen = !state.leftMenuOpen;
  render();
}

function toggleRightMenu() {
  state.rightMenuOpen = !state.rightMenuOpen;
  render();
}

function startPolygonDrawing() {
  state.drawingPolygon = true;
  state.polygonPoints = [];
  state.polygonAdded = false;
  render();
  $(SELECTORS.mapHint).classList.remove('hidden');
  bindMapDrawing();
}

function updateCoverage(event) {
  state.coverage = event.target.value;
  $('#coverage-value').textContent = `${state.coverage}%`;
}

function updateDroneCount(event) {
  const type = event.target.dataset.droneType;
  state[`${type}Count`] = event.target.value;
  event.target.closest('.rounded-md').querySelector('.text-notion-500').textContent = event.target.value;
}

function toggleWeatherLayer() {
  state.weatherVisible = !state.weatherVisible;
  render();
}

function setWeatherLayerVisibility() {
  const layer = $('#weather-layer');
  layer.classList.toggle('opacity-0', !state.weatherVisible);
  layer.classList.toggle('opacity-100', state.weatherVisible);
}

function exportMap() {
  window.print();
}

function bindMapDrawing() {
  const map = getMapElement();
  map.addEventListener('click', (event) => {
    if (!state.drawingPolygon || event.target.closest('button')) return;
    state.polygonPoints.push(screenPointToMapPoint(event, getMapRect()));
    updatePolygonSvg();
  });
}

// Convertit les coordonnées écran en coordonnées persistées de l'image cartographique.
function screenPointToMapPoint(event, rect) {
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;
  const contentPoint = transformScreenPointToContent(pointerX, pointerY, rect);
  const image = getRenderedImage(rect);

  // object-cover centre l'image : il faut réintégrer la partie recadrée.
  return {
    x: roundPercentage(clamp(((contentPoint.x + image.cropX) / image.width) * 100, 0, 100)),
    y: roundPercentage(clamp(((contentPoint.y + image.cropY) / image.height) * 100, 0, 100))
  };
}

function transformScreenPointToContent(pointerX, pointerY, rect) {
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const scale = state.mapScale || MAP_CONFIG.minScale;
  return {
    x: (pointerX - centerX - state.mapX) / scale + centerX,
    y: (pointerY - centerY - state.mapY) / scale + centerY
  };
}

function getRenderedImage(rect) {
  const width = Math.max(rect.width, rect.height * MAP_IMAGE.aspectRatio);
  const height = Math.max(rect.height, rect.width / MAP_IMAGE.aspectRatio);
  return {
    width,
    height,
    cropX: (width - rect.width) / 2,
    cropY: (height - rect.height) / 2
  };
}

function roundPercentage(value) {
  return Number(value.toFixed(2));
}

function getMapSvgWidth() {
  return MAP_IMAGE.aspectRatio * 100;
}

function getPolygonSvgPoints() {
  return state.polygonPoints
    .map(({ x, y }) => `${x * MAP_IMAGE.aspectRatio},${y}`)
    .join(' ');
}

function getPolygonMarkup(points) {
  const circles = state.polygonPoints
    .map(({ x, y }) => `<circle cx="${x * MAP_IMAGE.aspectRatio}" cy="${y}" r="0.9" fill="#fff" stroke="#238b82" stroke-width=".3"></circle>`)
    .join('');

  if (!state.polygonAdded) {
    return `<polyline points="${points}" fill="none" stroke="#238b82" stroke-width=".45" stroke-dasharray="1 0.7"></polyline>${circles}`;
  }

  const mapWidth = getMapSvgWidth();
  return `<path d="M0,0 H${mapWidth} V100 H0 Z M${points.replaceAll(' ', ' L')} Z" fill="rgba(7,19,28,.34)" fill-rule="evenodd"></path><polygon points="${points}" fill="rgba(35,139,130,.18)" stroke="#238b82" stroke-width=".35" stroke-dasharray="1 0.7"></polygon>${circles}`;
}

function updatePolygonSvg() {
  const svg = $(SELECTORS.missionPolygon);
  if (!svg || state.polygonPoints.length === 0) return;
  const points = getPolygonSvgPoints();
  svg.innerHTML = getPolygonMarkup(points);
  svg.classList.remove('opacity-0');
  svg.classList.add('opacity-100');
  const finishButton = $(SELECTORS.finishZone);
  if (finishButton) {
    finishButton.disabled = state.polygonPoints.length < MAP_CONFIG.polygonMinPoints;
    finishButton.textContent = `Valider la zone (${state.polygonPoints.length} points)`;
  }
}

// Finalise la zone uniquement après validation explicite de l'utilisateur.
function finishPolygon() {
  if (state.polygonPoints.length < MAP_CONFIG.polygonMinPoints) {
    $(SELECTORS.mapHint).querySelector('div').textContent = 'Ajoutez au moins 3 points';
    return;
  }
  state.drawingPolygon = false;
  state.polygonAdded = true;
  state.mapZoomed = true;
  state.mapScale = MAP_CONFIG.missionScale;
  const xs = state.polygonPoints.map((point) => point.x);
  const ys = state.polygonPoints.map((point) => point.y);
  const rect = getMapRect();
  state.mapX = percentageToMapOffset(getCenterOfBounds(xs), rect.width, state.mapScale);
  state.mapY = percentageToMapOffset(getCenterOfBounds(ys), rect.height, state.mapScale);
  render();
  showMapHint();
}

function getCenterOfBounds(values) {
  return (Math.min(...values) + Math.max(...values)) / 2;
}

function percentageToMapOffset(value, size, scale) {
  return ((50 - value) / 100) * size * scale;
}

function showMapHint() {
  const hint = $(SELECTORS.mapHint);
  hint.classList.remove('hidden');
  window.setTimeout(() => hint?.classList.add('hidden'), 2200);
}

function setMapTransform(scale, x, y) {
  const map = getMapElement();
  if (map) {
    const rect = map.getBoundingClientRect();
    const maxX = ((scale - 1) * rect.width) / (2 * scale);
    const maxY = ((scale - 1) * rect.height) / (2 * scale);
    x = clamp(x, -maxX, maxX);
    y = clamp(y, -maxY, maxY);
  }
  state.mapScale = scale;
  state.mapX = x;
  state.mapY = y;
  $(SELECTORS.mapContent).style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
}

// Le zoom par bouton conserve le centre de la carte.
function zoomBy(delta) {
  const nextScale = clamp(state.mapScale + delta, MAP_CONFIG.minScale, MAP_CONFIG.maxScale);
  setMapTransform(nextScale, state.mapX, state.mapY);
}

function zoomAtPoint(event) {
  event.preventDefault();
  const rect = getMapRect();
  const currentScale = state.mapScale;
  const direction = event.deltaY < 0 ? 1 : -1;
  const nextScale = clamp(currentScale + direction * MAP_CONFIG.zoomStep, MAP_CONFIG.minScale, MAP_CONFIG.maxScale);

  if (nextScale === currentScale) return;

  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const ratio = nextScale / currentScale;
  const nextX = pointerX - centerX - ((pointerX - centerX - state.mapX) * ratio);
  const nextY = pointerY - centerY - ((pointerY - centerY - state.mapY) * ratio);

  setMapTransform(nextScale, nextX, nextY);
}

function recenterMap() {
  if (!state.polygonAdded) {
    setMapTransform(MAP_CONFIG.minScale, 0, 0);
    return;
  }
  const xs = state.polygonPoints.map((point) => point.x);
  const ys = state.polygonPoints.map((point) => point.y);
  const rect = getMapRect();
  setMapTransform(
    MAP_CONFIG.missionScale,
    percentageToMapOffset(getCenterOfBounds(xs), rect.width, MAP_CONFIG.missionScale),
    percentageToMapOffset(getCenterOfBounds(ys), rect.height, MAP_CONFIG.missionScale)
  );
}

function bindMapPan() {
  const map = getMapElement();
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const stopDragging = () => {
    if (!dragging) return;
    dragging = false;
    map.classList.remove('cursor-grabbing');
    map.classList.add('cursor-grab');
    document.body.classList.remove('select-none');
  };

  map.addEventListener('mousedown', (event) => {
    if (state.drawingPolygon || event.target.closest('button')) return;
    event.preventDefault();
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    map.classList.remove('cursor-grab');
    map.classList.add('cursor-grabbing');
    document.body.classList.add('select-none');
  });

  document.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    event.preventDefault();
    const deltaX = event.clientX - lastX;
    const deltaY = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    setMapTransform(state.mapScale, state.mapX + deltaX, state.mapY + deltaY);
  });
  document.addEventListener('mouseup', stopDragging);
  map.addEventListener('wheel', zoomAtPoint, { passive: false });
}

render();
