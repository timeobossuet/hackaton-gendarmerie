import { droneClasses, MAP_CONFIG } from './config.js';
import { state } from './state.js';
import { componentIcon } from './icons.js';

export function appShell() {
  return `
    <main class="relative h-full w-full">
      ${mapComponent()}
      ${topbarComponent()}
      ${leftPanelComponent()}
      ${rightPanelComponent()}
    </main>
  `;
}

function topbarComponent() {
  return `
    <header class="absolute left-4 right-4 top-4 z-[2000] flex items-center justify-between pointer-events-none">
      <div class="pointer-events-auto flex items-center gap-2 rounded-lg border border-notion-200 bg-white/95 p-1.5 shadow-panel backdrop-blur">
        <button id="toggle-left" title="Ouvrir ou fermer le menu mission" type="button" class="rounded-md p-2 text-notion-500 transition hover:bg-notion-100 hover:text-notion-900">
          ${componentIcon(state.leftMenuOpen ? 'close' : 'menu', 'h-4 w-4')}
        </button>
        <div class="flex items-center gap-2 border-l border-notion-200 pl-3 pr-3">
          <span class="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-md bg-notion-900">
            <img src="ui/images/logo-gendarmerie.svg" alt="Logo de la Gendarmerie nationale" class="h-full w-full object-contain p-1" />
          </span>
          <div>
            <div class="text-sm font-semibold leading-none tracking-tight">AERIS</div>
            <div class="mt-1 text-[10px] text-notion-500">Carte de mission</div>
          </div>
        </div>
      </div>
    </header>
  `;
}

function panelFrame({ side, title, eyebrow, content, open }) {
  const position = side === 'left' ? 'left-4' : 'right-4';
  const hiddenPosition = side === 'left' ? '-translate-x-[calc(100%+1rem)]' : 'translate-x-[calc(100%+1rem)]';

  return `
    <aside class="absolute ${position} top-20 z-[2000] w-[calc(100vw-2rem)] max-w-[300px] rounded-lg border border-notion-200 bg-white/95 shadow-panel backdrop-blur transition-all duration-200 ${open ? 'translate-x-0 opacity-100' : `${hiddenPosition} pointer-events-none opacity-0`}">
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
          ${componentIcon(state.drawingPolygon || state.polygonAdded ? 'map' : 'plus', 'h-4 w-4')} ${state.drawingPolygon ? 'Cliquez sur la carte pour dessiner' : (state.polygonAdded ? 'Modifier le polygone' : 'Ajouter un polygone')}
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
        <h2 class="mb-3 text-xs font-semibold">Analyse météo</h2>
        <p class="text-[10px] leading-4 text-notion-500">Recherchez une ville depuis la barre située en haut de la carte.</p>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <label class="text-[10px] text-notion-500">Rayon (km)<input id="weather-radius" type="number" value="${state.weather.radiusKm}" min="2" max="50" step="1" class="mt-1 w-full rounded-md border border-notion-200 px-2 py-1.5 text-xs outline-none focus:border-aeris" /></label>
          <label class="text-[10px] text-notion-500">Grille<input id="weather-grid-size" type="number" value="${state.weather.gridSize}" min="2" max="15" step="1" class="mt-1 w-full rounded-md border border-notion-200 px-2 py-1.5 text-xs outline-none focus:border-aeris" /></label>
        </div>
        <div id="weather-status" class="mt-3 ${state.weather.error || state.weather.scanning ? '' : 'hidden'} rounded-md bg-notion-100 px-2.5 py-2 text-[10px] leading-4 ${state.weather.error ? 'text-red-600' : 'text-notion-500'}">
          ${state.weather.error || (state.weather.scanning ? `Scan météo en cours... ${state.weather.progress}%` : '')}
        </div>
      </section>
      <section class="border-t border-notion-200 pt-4">
        <h2 class="mb-2 text-xs font-semibold">Carte</h2>
        <div class="space-y-1 text-xs">
          <button id="export-map" type="button" class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-notion-700 transition hover:bg-notion-100">${componentIcon('download', 'h-4 w-4 text-notion-500')} Exporter la carte</button>
        </div>
      </section>
    </div>
  `;

  return panelFrame({ side: 'right', eyebrow: 'Affichage', title: 'Options de la carte', content, open: state.rightMenuOpen });
}

function mapComponent() {
  return `
    <div id="map" class="relative h-full w-full select-none overflow-hidden bg-[#dfe9d8]">
      ${weatherSearchComponent()}
      <div id="map-hint" class="pointer-events-none absolute left-1/2 top-1/2 z-[1] hidden -translate-x-1/2 -translate-y-1/2 rounded-lg border border-aeris/30 bg-white/95 px-4 py-3 text-center shadow-panel">
        <div class="text-xs font-semibold text-notion-900">${state.drawingPolygon ? 'Dessinez votre zone' : 'Zone de mission ajoutée'}</div>
        <div class="mt-1 text-[10px] text-notion-500">${state.drawingPolygon ? 'Cliquez sur la carte pour ajouter des points' : 'La carte est centrée sur le polygone'}</div>
      </div>
      <div class="pointer-events-auto absolute bottom-5 right-5 z-[1001] flex items-end gap-2">
        ${zoomSettingsComponent()}
        <div class="flex flex-col overflow-hidden rounded-md border border-notion-200 bg-white/90 shadow-panel backdrop-blur">
          <button id="zoom-in" type="button" aria-label="Zoomer" class="grid h-8 w-8 place-items-center border-b border-notion-200 text-lg text-notion-500 hover:bg-notion-100">+</button>
          <button id="zoom-out" type="button" aria-label="Dézoomer" class="grid h-8 w-8 place-items-center text-lg text-notion-500 hover:bg-notion-100">−</button>
        </div>
      </div>
      <div class="pointer-events-none absolute bottom-2 left-2 z-[1000] text-[9px] text-notion-500/70">© OpenStreetMap contributors</div>
    </div>
  `;
}

function weatherSearchComponent() {
  return `
    <div class="pointer-events-auto absolute left-1/2 top-4 z-[2100] w-[calc(100vw-2rem)] max-w-[320px] -translate-x-1/2">
      <div class="flex items-center gap-2 rounded-lg border border-notion-200 bg-white/95 p-1.5 shadow-panel backdrop-blur">
        <label for="weather-location" class="sr-only">Ville ou code postal</label>
        <input id="weather-location" type="search" placeholder="Rechercher une ville ou un code postal..." autocomplete="off" class="min-w-0 flex-1 rounded-md border-0 bg-transparent px-3 py-2 text-xs text-notion-900 outline-none placeholder:text-notion-400 focus:ring-0" />
        <button id="weather-scan" type="button" class="shrink-0 rounded-md bg-aeris px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#1b716a]">Scanner</button>
      </div>
      <div id="weather-status" class="mx-auto mt-2 hidden w-fit max-w-full rounded-md border border-notion-200 bg-white/95 px-3 py-2 text-center text-[10px] leading-4 text-notion-500 shadow-panel backdrop-blur"></div>
    </div>
  `;
}

function zoomSettingsComponent() {
  return `
    <div class="relative">
      ${state.zoomSettingsOpen ? `
        <div class="pointer-events-auto absolute bottom-10 right-0 w-48 rounded-md border border-notion-200 bg-white/95 p-3 text-left shadow-panel backdrop-blur">
          <div class="flex items-center justify-between">
            <label for="zoom-sensitivity" class="text-[10px] font-semibold text-notion-700">Sensibilité du zoom</label>
            <span id="zoom-sensitivity-value" class="text-[10px] font-semibold text-aeris">${Math.round(state.zoomSensitivity * 100)}%</span>
          </div>
          <input id="zoom-sensitivity" type="range" min="${MAP_CONFIG.minZoomSensitivity * 100}" max="${MAP_CONFIG.maxZoomSensitivity * 100}" step="1" value="${Math.round(state.zoomSensitivity * 100)}" aria-label="Sensibilité du zoom" class="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-notion-200 accent-[#238b82]" />
          <div class="mt-1 flex justify-between text-[9px] text-notion-400"><span>Précis</span><span>Rapide</span></div>
        </div>
      ` : ''}
      <button id="zoom-settings" type="button" aria-label="Régler la sensibilité du zoom" aria-expanded="${state.zoomSettingsOpen}" class="grid h-8 w-8 place-items-center rounded-md border border-notion-200 bg-white/90 text-notion-500 shadow-panel backdrop-blur transition hover:bg-notion-100 ${state.zoomSettingsOpen ? 'text-aeris' : ''}">
        ${componentIcon('settings', 'h-4 w-4')}
      </button>
    </div>
  `;
}
