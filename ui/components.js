import { MAP_CONFIG } from './config.js';
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
  const activeMission = state.missions.find(({ id }) => id === state.activeMissionId);
  return `
    <header class="absolute left-0 right-0 top-0 z-[2100] flex h-14 items-center justify-between border-b border-white/20 bg-gendarmerie-navy px-4 text-white shadow-panel">
      <div class="flex items-center gap-3">
        <button id="toggle-left" title="Ouvrir ou fermer le menu mission" type="button" class="rounded-md p-2 text-white/75 transition hover:bg-white/10 hover:text-white">
          ${componentIcon(state.leftMenuOpen ? 'close' : 'menu', 'h-4 w-4')}
        </button>
        <div class="flex items-center gap-2 border-l border-white/20 pl-3">
          <span class="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-md bg-white">
            <img src="ui/images/logo-gendarmerie.svg" alt="Logo de la Gendarmerie nationale" class="h-full w-full object-contain p-1" />
          </span>
          <div>
            <div class="text-sm font-semibold leading-none tracking-tight">AERIS</div>
            <div class="mt-1 text-[10px] text-white/60">Carte de mission</div>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="hidden text-[10px] text-white/60 sm:inline">${state.planning.gpxFileName ? 'Mission en cours' : 'Nouvelle mission'}</span>
        <button id="export-map" title="Exporter la carte" type="button" class="rounded-md border border-white/20 p-2 text-white/75 transition hover:bg-white/10 hover:text-white">
          ${componentIcon('download', 'h-4 w-4')}
        </button>
        <button id="new-mission-top" type="button" class="rounded-md bg-gendarmerie-beige px-2.5 py-1.5 text-[10px] font-semibold text-gendarmerie-navy transition hover:bg-white">Nouvelle mission</button>
        <button id="mission-menu-toggle" aria-expanded="${state.missionMenuOpen}" title="Gérer les missions" type="button" class="flex max-w-[190px] items-center gap-2 rounded-md border border-white/20 px-2.5 py-1.5 text-left text-xs text-white transition hover:bg-white/10">
          <span class="truncate">${escapeHtml(activeMission?.name || 'Mission')}</span><span class="text-white/60">⌄</span>
        </button>
        <button id="toggle-right" title="Ouvrir ou fermer les options de la carte" type="button" class="rounded-md border border-white/20 p-2 text-white/75 transition hover:bg-white/10 hover:text-white">
          ${componentIcon(state.rightMenuOpen ? 'close' : 'layers', 'h-4 w-4')}
        </button>
      </div>
      ${state.missionMenuOpen ? missionMenuComponent() : ''}
    </header>
  `;
}

function missionMenuComponent() {
  return `
    <div class="absolute right-4 top-12 z-[2200] w-72 rounded-lg border border-gendarmerie-beige bg-white p-3 text-gendarmerie-navy shadow-panel">
      <div class="mb-2 text-[10px] font-bold uppercase tracking-widest text-gendarmerie-blue">Missions</div>
      <div class="space-y-1">
        ${state.missions.map((mission) => `
          <div class="flex items-center gap-1 rounded-md ${mission.id === state.activeMissionId ? 'bg-gendarmerie-beige/40' : ''} p-1">
            <button data-mission-id="${mission.id}" class="mission-select min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-xs hover:bg-gendarmerie-beige/50">${escapeHtml(mission.name)}</button>
            ${mission.id === state.activeMissionId ? `<button id="rename-mission" title="Renommer la mission" class="rounded p-1.5 text-notion-500 hover:bg-notion-200 hover:text-notion-900">✎</button>` : ''}
            ${state.missions.length > 1 ? `<button data-delete-mission="${mission.id}" title="Supprimer la mission" class="mission-delete rounded p-1.5 text-notion-500 hover:bg-red-50 hover:text-red-600">×</button>` : ''}
          </div>
        `).join('')}
      </div>
      <div class="mt-3 border-t border-notion-200 pt-3">
        <label class="block text-[10px] font-semibold text-notion-700" for="new-mission-name">Nouvelle mission</label>
        <div class="mt-1 flex gap-1">
          <input id="new-mission-name" type="text" maxlength="60" placeholder="Nom de la mission" class="min-w-0 flex-1 rounded border border-gendarmerie-beige px-2 py-1.5 text-xs outline-none focus:border-gendarmerie-blue" />
          <button id="create-mission" type="button" class="rounded bg-gendarmerie-blue px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-gendarmerie-navy">Créer</button>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[character]));
}

function panelFrame({ side, title, eyebrow, content, open }) {
  const position = side === 'left' ? 'left-4' : 'right-4';
  const hiddenPosition = side === 'left' ? '-translate-x-[calc(100%+1rem)]' : 'translate-x-[calc(100%+1rem)]';

  return `
    <aside class="absolute ${position} top-16 z-[2000] w-[calc(100vw-2rem)] max-w-[300px] rounded-lg border border-notion-200 bg-white/95 shadow-panel backdrop-blur transition-all duration-200 ${open ? 'translate-x-0 opacity-100' : `${hiddenPosition} pointer-events-none opacity-0`}">
      <div class="border-b border-notion-200 px-4 py-3">
        <div class="text-[10px] font-bold uppercase tracking-widest text-gendarmerie-blue">${eyebrow}</div>
        <h1 class="mt-1 text-sm font-semibold">${title}</h1>
        ${side === 'left' ? `<p class="mt-1 text-[10px] leading-4 text-notion-500">1. Définissez la zone · 2. Placez les drones</p>` : ''}
      </div>
      <div class="max-h-[calc(100vh-10rem)] overflow-y-auto p-4">${content}</div>
    </aside>
  `;
}

function leftPanelComponent() {
  const hasProtectedArea = Boolean(state.planning.gpxGeoJson || state.polygonAdded);
  const content = `
    <div class="space-y-3">
      <details open class="group">
        <summary class="flex cursor-pointer list-none items-center justify-between py-1 text-xs font-semibold [&::-webkit-details-marker]:hidden"><span>1. Définir le chemin</span><span class="text-notion-400 transition group-open:rotate-180">⌄</span></summary>
        <section class="pt-2">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-xs font-semibold">Chemin à protéger</h2>
          <span class="rounded bg-notion-100 px-1.5 py-0.5 text-[10px] text-notion-500">${state.planning.gpxFileName ? 'Chemin chargé' : 'À faire'}</span>
        </div>
        <p class="text-xs leading-5 text-gray-500">Ajoutez un fichier GPX pour définir le chemin à protéger. La carte se centrera automatiquement dessus.</p>
        <input id="gpx-file" type="file" accept=".gpx,application/gpx+xml" class="hidden" />
        <button id="import-gpx" type="button" class="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-gendarmerie-beige px-3 py-2 text-xs font-medium text-notion-700 transition hover:border-gendarmerie-blue hover:bg-gendarmerie-beige/30">
          ${componentIcon('download', 'h-4 w-4')} ${state.planning.gpxFileName ? 'Remplacer le fichier GPX' : 'Ajouter un fichier GPX'}
        </button>
        ${state.planning.gpxFileName ? `<div class="mt-2 rounded-md bg-green-50 px-2.5 py-2 text-[10px] text-green-700">Chemin chargé. Vous pouvez maintenant définir la zone protégée.</div>` : ''}
        </section>
      </details>
      <details open class="group border-t border-notion-200 pt-3">
        <summary class="flex cursor-pointer list-none items-center justify-between py-1 text-xs font-semibold [&::-webkit-details-marker]:hidden"><span>2. Définir la zone protégée</span><span class="text-notion-400 transition group-open:rotate-180">⌄</span></summary>
        <section class="pt-2">
        <div class="grid grid-cols-2 gap-1 rounded-md bg-gendarmerie-beige/45 p-1 text-[10px]">
          <button id="area-buffer" type="button" aria-pressed="${state.planning.areaMode === 'buffer'}" class="rounded px-2 py-1.5 transition ${state.planning.areaMode === 'buffer' ? 'bg-white font-semibold text-notion-900 shadow-sm' : 'text-notion-500 hover:text-notion-900'}">Autour du chemin</button>
          <button id="area-polygon" type="button" aria-pressed="${state.planning.areaMode === 'polygon'}" class="rounded px-2 py-1.5 transition ${state.planning.areaMode === 'polygon' ? 'bg-white font-semibold text-notion-900 shadow-sm' : 'text-notion-500 hover:text-notion-900'}">Dessiner une zone</button>
        </div>
        ${state.planning.areaMode === 'buffer' ? `
          <label class="mt-3 block text-[10px] text-gray-500"><span class="flex justify-between"><span>Distance autour du chemin</span><strong id="buffer-value" class="font-semibold text-notion-800">${state.planning.bufferMeters} m</strong></span>
              <input id="buffer-slider" type="range" min="50" max="1000" step="50" value="${state.planning.bufferMeters}" class="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gendarmerie-beige accent-gendarmerie-blue" />
          </label>
        ` : `
          <button id="add-zone" type="button" class="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-gendarmerie-beige px-3 py-2 text-xs font-medium text-notion-700 transition hover:border-gendarmerie-blue hover:bg-gendarmerie-beige/30">
            ${componentIcon('map', 'h-4 w-4')} ${state.drawingPolygon ? 'Cliquez sur la carte pour placer les points' : (state.polygonAdded ? 'Modifier la zone' : 'Dessiner la zone')}
          </button>
          ${state.drawingPolygon ? `          <button id="finish-zone" type="button" class="mt-2 w-full rounded-md bg-gendarmerie-blue px-3 py-2 text-xs font-semibold text-white transition hover:bg-gendarmerie-navy disabled:cursor-not-allowed disabled:opacity-50" ${state.polygonPoints.length < 3 ? 'disabled' : ''}>Valider la zone (${state.polygonPoints.length} points)</button>` : ''}
        `}
        </section>
      </details>
      <details open class="group border-t border-notion-200 pt-3">
        <summary class="flex cursor-pointer list-none items-center justify-between py-1 text-xs font-semibold [&::-webkit-details-marker]:hidden"><span>3. Placer les drones</span><span class="text-notion-400 transition group-open:rotate-180">⌄</span></summary>
        <section class="pt-2">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-[10px] text-notion-400">${Number(state.planning.smallDrones) + Number(state.planning.largeDrones)} drones</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <label class="rounded-md border border-notion-200 p-2 text-[10px] text-notion-500">Drones 1 km
            <input id="small-drones" type="number" min="0" max="30" value="${state.planning.smallDrones}" class="mt-1 w-full rounded border border-gendarmerie-beige px-2 py-1.5 text-xs outline-none focus:border-gendarmerie-blue" />
          </label>
          <label class="rounded-md border border-notion-200 p-2 text-[10px] text-notion-500">Drones 2 km
            <input id="large-drones" type="number" min="0" max="30" value="${state.planning.largeDrones}" class="mt-1 w-full rounded border border-gendarmerie-beige px-2 py-1.5 text-xs outline-none focus:border-gendarmerie-blue" />
          </label>
        </div>
        <label class="mt-3 block text-[10px] text-gray-500"><span class="flex justify-between"><span>Importance du chemin</span><strong id="path-weight-value" class="font-semibold text-notion-800">${state.planning.pathWeight}</strong></span>
          <input id="path-weight" type="range" min="1" max="100" value="${state.planning.pathWeight}" class="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gendarmerie-beige accent-gendarmerie-blue" />
        </label>
        <p class="mt-1 text-[10px] leading-4 text-gray-500">Une valeur élevée concentre davantage la couverture sur le chemin.</p>
        <label class="mt-3 block text-[10px] text-gray-500"><span class="flex justify-between"><span>Importance de la zone</span><strong id="area-weight-value" class="font-semibold text-notion-800">${state.planning.areaWeight}</strong></span>
          <input id="area-weight" type="range" min="1" max="100" step="1" value="${state.planning.areaWeight}" class="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gendarmerie-beige accent-gendarmerie-blue" />
        </label>
        <p class="mt-1 text-[10px] leading-4 text-gray-500">Une valeur élevée répartit davantage les drones dans toute la zone.</p>
        <div class="mt-3 rounded-md border border-notion-200 p-2">
          <p class="mb-1 text-[10px] font-semibold text-notion-700">Autorisations obtenues</p>
          ${authorizationOption('ZIT', 'Zone militaire / ZIT')}
          ${authorizationOption('AUTORISATION', 'Zone jaune / autorisation requise')}
          <p class="mt-1 text-[9px] leading-4 text-notion-500">Cochez uniquement si l’autorisation officielle a été obtenue. Les zones d’eau et de forêt restent évitées.</p>
        </div>
        <p class="mt-2 text-[9px] leading-4 text-amber-700">${state.restrictions.cells.length ? 'Le placement évite les secteurs inadaptés du scan OSM.' : 'Scannez les restrictions avant le placement pour filtrer les secteurs inadaptés.'}</p>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button id="optimize-placement" type="button" class="rounded-md bg-gendarmerie-blue px-2 py-2 text-[10px] font-semibold text-white transition hover:bg-gendarmerie-navy disabled:cursor-not-allowed disabled:bg-notion-100 disabled:text-notion-400" ${state.planning.calculating || (!state.planning.gpxGeoJson && !state.polygonAdded) ? 'disabled' : ''}>${state.planning.calculating ? 'Placement en cours…' : state.planning.placement ? 'Replanifier la flotte' : 'Calculer le placement'}</button>
        </div>
        ${placementResultComponent(hasProtectedArea)}
        </section>
      </details>
    </div>
  `;

  return panelFrame({ side: 'left', eyebrow: 'Configuration', title: 'Préparer la mission', content, open: state.leftMenuOpen });
}

function placementResultComponent(hasProtectedArea) {
  const result = state.planning.placement;
  if (state.planning.placementError && !result) {
    return `<div class="mt-3 rounded-md bg-red-50 px-2.5 py-2 text-[10px] leading-4 text-red-600">${state.planning.placementError}</div>`;
  }
  if (!result) return `<p class="mt-3 text-[10px] leading-4 text-notion-400">${hasProtectedArea ? 'Réglez la flotte puis calculez le placement pour afficher les zones de couverture.' : 'Ajoutez un chemin GPX ou dessinez une zone protégée pour activer le calcul.'}</p>`;
  const percent = (value) => value == null ? '—' : `${Math.round(value * 100)}%`;
  const maintained = result.pilots.filter(({ status }) => status === 'maintained').length;
  const redeployed = result.pilots.filter(({ status }) => status === 'redeployed').length;
  const newPlacements = result.pilots.filter(({ status }) => status === 'new').length;
  return `
    <div class="mt-3 rounded-md border border-green-200 bg-green-50 p-2.5 text-[10px] leading-4 text-green-800">
      ${state.planning.placementError ? `<div class="mb-2 rounded-md bg-red-50 px-2 py-1.5 text-red-600">${state.planning.placementError}</div>` : ''}
      <div class="mb-2 font-semibold text-green-900">Placement calculé</div>
      <div class="grid grid-cols-2 gap-1">
        <span>Couverture totale</span><strong class="text-right text-green-900">${percent(result.stats.weighted)}</strong>
        <span>Chemin couvert</span><strong class="text-right">${percent(result.stats.path)}</strong>
        <span>Zone couverte</span><strong class="text-right">${percent(result.stats.buffer ?? result.stats.poly)}</strong>
        <span>Zones de chevauchement</span><strong class="text-right">${result.collisions.pairs}</strong>
      </div>
      <div class="mt-2 border-t border-green-200 pt-2">
        <div class="flex justify-between"><span>Positions maintenues</span><strong>${maintained}</strong></div>
        <div class="flex justify-between"><span>TP redéployés</span><strong>${redeployed}</strong></div>
        ${newPlacements ? `<div class="flex justify-between"><span>Nouveaux placements</span><strong>${newPlacements}</strong></div>` : ''}
      </div>
      <div class="mt-2 border-t border-green-200 pt-2">
        <p class="mb-1 text-green-900">TP à bloquer</p>
        ${result.pilots.map((pilot, index) => `
          <div class="flex items-center justify-between gap-2 py-1">
            <span>TP ${index + 1} · ${pilot.radius / 1000} km</span>
            <button type="button" data-pilot-lock="${escapeHtml(pilot.id)}" aria-pressed="${Boolean(pilot.locked)}" class="rounded border border-green-300 px-2 py-0.5 font-medium text-green-900 hover:bg-green-100">
              ${pilot.locked ? 'Autoriser le déplacement' : 'Bloquer'}
            </button>
          </div>
        `).join('')}
        <p class="mt-1 text-[9px] text-green-700">Les TP bloqués gardent leur position lors d’une replanification.</p>
      </div>
    </div>
  `;
}

function authorizationOption(category, label) {
  const authorized = state.planning.authorizedCategories?.[category] === true;
  return `
    <label class="mt-1 flex cursor-pointer items-center gap-2 text-[10px] text-notion-700">
      <input type="checkbox" data-placement-authorization="${category}" ${authorized ? 'checked' : ''} class="accent-gendarmerie-blue" />
      ${label}
    </label>
  `;
}

function rightPanelComponent() {
  const hasProtectedArea = Boolean(state.planning.gpxGeoJson || state.polygonAdded);
  const content = `
    <div class="space-y-5">
      <section>
        <h2 class="mb-2 text-xs font-semibold">Couches de la carte</h2>
        <button id="restrictions-toggle" type="button" aria-pressed="${state.restrictions.visible}" class="mb-2 flex w-full items-center justify-between rounded-md border border-notion-200 px-3 py-2.5 text-left transition hover:bg-notion-100">
          <span class="flex items-center gap-2 text-xs">${componentIcon('layers', 'h-4 w-4 text-notion-500')} Restrictions & terrain</span>
          <span class="relative h-4 w-7 rounded-full ${state.restrictions.visible ? 'bg-gendarmerie-blue' : 'bg-notion-200'}"><span class="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${state.restrictions.visible ? 'left-3.5' : 'left-0.5'}"></span></span>
        </button>
        <p class="mb-3 text-[10px] leading-4 text-notion-500">Affiche les restrictions potentielles et les éléments de terrain détectés.</p>
        <button id="weather-toggle" type="button" class="flex w-full items-center justify-between rounded-md border border-notion-200 px-3 py-2.5 text-left transition hover:bg-notion-100">
          <span class="flex items-center gap-2 text-xs">${componentIcon('layers', 'h-4 w-4 text-notion-500')} Couche météo</span>
          <span class="relative h-4 w-7 rounded-full ${state.weatherVisible ? 'bg-gendarmerie-blue' : 'bg-notion-200'}"><span class="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${state.weatherVisible ? 'left-3.5' : 'left-0.5'}"></span></span>
        </button>
        <p class="mt-2 text-[10px] leading-4 text-notion-500">Superpose les conditions météo aux zones de couverture.</p>
      </section>
      <section class="border-t border-notion-200 pt-4">
        <h2 class="mb-3 text-xs font-semibold">Analyser la météo</h2>
        <p class="text-[10px] leading-4 text-notion-500">Obtenez les conditions actuelles pour chaque secteur de la zone protégée.</p>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <label class="text-[10px] text-gray-500">Précision de la grille<input id="weather-grid-size" type="number" aria-describedby="weather-grid-help" value="${state.weather.gridSize}" min="2" max="15" step="1" class="mt-1 w-full rounded-md border border-gendarmerie-beige px-2 py-1.5 text-xs outline-none focus:border-gendarmerie-blue" /></label>
        </div>
        <button id="weather-scan" type="button" class="mt-2 w-full rounded-md bg-gendarmerie-blue px-2 py-2 text-[10px] font-semibold text-white transition hover:bg-gendarmerie-navy disabled:cursor-not-allowed disabled:bg-notion-100 disabled:text-notion-400" ${state.weather.scanning || !hasProtectedArea ? 'disabled' : ''}>${state.weather.scanning ? 'Analyse en cours…' : 'Analyser la météo'}</button>
        <p id="weather-grid-help" class="mt-1 text-[10px] leading-4 text-gray-500">${hasProtectedArea ? 'De 2 à 15 : une grille plus fine prend plus de temps.' : 'Ajoutez d’abord un chemin ou une zone protégée.'}</p>
        <div id="weather-status" class="mt-3 ${state.weather.error || state.weather.scanning ? '' : 'hidden'} rounded-md bg-notion-100 px-2.5 py-2 text-[10px] leading-4 ${state.weather.error ? 'text-red-600' : 'text-notion-500'}">
          ${state.weather.error || (state.weather.scanning ? `Scan météo en cours... ${state.weather.progress}%` : '')}
        </div>
      </section>
      <section class="border-t border-notion-200 pt-4">
        <h2 class="mb-2 text-xs font-semibold">Analyser les restrictions</h2>
        <p class="text-[10px] leading-4 text-notion-500">Recherche les données cartographiques autour d’une ville ou du centre actuel de la carte.</p>
        <label class="mt-3 block text-[10px] text-gray-500" for="restrictions-query">Ville ou code postal
          <input id="restrictions-query" type="search" value="${escapeHtml(state.restrictions.query || '')}" placeholder="Ex. 31000, Toulouse" autocomplete="off" class="mt-1 w-full rounded-md border border-gendarmerie-beige px-2 py-1.5 text-xs outline-none focus:border-gendarmerie-blue" />
        </label>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <label class="text-[10px] text-gray-500" for="restrictions-radius">Rayon (km)
            <input id="restrictions-radius" type="number" value="${state.restrictions.radiusKm}" min="2" max="20" step="1" class="mt-1 w-full rounded-md border border-gendarmerie-beige px-2 py-1.5 text-xs outline-none focus:border-gendarmerie-blue" />
          </label>
          <label class="text-[10px] text-gray-500" for="restrictions-grid-size">Grille par côté
            <input id="restrictions-grid-size" type="number" value="${state.restrictions.gridSize}" min="3" max="20" step="1" class="mt-1 w-full rounded-md border border-gendarmerie-beige px-2 py-1.5 text-xs outline-none focus:border-gendarmerie-blue" />
          </label>
        </div>
        <button id="restrictions-scan" type="button" class="mt-2 w-full rounded-md bg-gendarmerie-blue px-2 py-2 text-[10px] font-semibold text-white transition hover:bg-gendarmerie-navy disabled:cursor-not-allowed disabled:bg-notion-100 disabled:text-notion-400" ${state.restrictions.scanning ? 'disabled' : ''}>${state.restrictions.scanning ? 'Scan en cours…' : 'Scanner les restrictions'}</button>
        <div id="restrictions-status" role="status" aria-live="polite" class="mt-2 ${state.restrictions.status || state.restrictions.error ? '' : 'hidden'} rounded-md bg-notion-100 px-2.5 py-2 text-[10px] leading-4 ${state.restrictions.error ? 'text-red-600' : 'text-notion-500'}">${escapeHtml(state.restrictions.error || state.restrictions.status)}</div>
        <div class="mt-3 space-y-1">
          ${restrictionFilterComponent('ZIT', 'ZIT / Interdit', '#ef4444')}
          ${restrictionFilterComponent('AUTORISATION', 'Autorisation', '#f59e0b')}
          ${restrictionFilterComponent('LAC', 'Lacs & eau', '#3b82f6')}
          ${restrictionFilterComponent('FORET', 'Forêts', '#059669')}
          ${restrictionFilterComponent('LIBRE', 'Zone libre', '#22c55e')}
        </div>
        <p class="mt-2 text-[9px] leading-4 text-notion-500">Les données OpenStreetMap ne sont pas officielles et ne déterminent pas la légalité d’un vol. Vérifiez Géoportail avant toute mission.</p>
      </section>
    </div>
  `;

  return panelFrame({ side: 'right', eyebrow: 'Affichage', title: 'Options de la carte', content, open: state.rightMenuOpen });
}

function restrictionFilterComponent(category, label, color) {
  return `
    <label class="flex cursor-pointer items-center justify-between rounded-md border border-notion-200 px-2 py-1.5 text-[10px] text-notion-700">
      <span class="flex items-center gap-2"><input type="checkbox" data-restriction-filter="${category}" ${state.restrictions.filters[category] ? 'checked' : ''} class="accent-gendarmerie-blue" /><span class="h-2.5 w-2.5 rounded-sm" style="background:${color}"></span>${label}</span>
      <span id="restriction-count-${category}" class="min-w-6 rounded bg-notion-100 px-1.5 py-0.5 text-center text-[9px]">${state.restrictions.counts[category]}</span>
    </label>
  `;
}

function mapComponent() {
  return `
    <div id="map" class="relative h-full w-full select-none overflow-hidden bg-[#dfe9d8]">
      <div id="map-hint" class="pointer-events-none absolute left-1/2 top-1/2 z-[1] hidden -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gendarmerie-blue/30 bg-white/95 px-4 py-3 text-center shadow-panel">
        <div class="text-xs font-semibold text-notion-900">${state.drawingPolygon ? 'Dessinez votre zone' : (state.planning.gpxGeoJson ? 'Chemin chargé' : 'Zone à définir')}</div>
        <div class="mt-1 text-[10px] text-notion-500">${state.drawingPolygon ? 'Cliquez sur la carte pour ajouter des points' : (state.planning.gpxGeoJson ? 'La carte est centrée sur le chemin' : 'Importez un chemin GPX')}</div>
      </div>
      ${!state.planning.gpxGeoJson && !state.polygonAdded ? `<div class="pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 text-center"><div class="rounded-xl border border-notion-200 bg-white/90 px-6 py-5 shadow-panel backdrop-blur"><div class="text-sm font-semibold text-notion-900">Votre mission commence ici</div><div class="mt-1 text-xs text-gray-500">Ajoutez un fichier GPX ou dessinez une zone protégée.</div></div></div>` : ''}
      <div class="pointer-events-auto absolute bottom-8 right-8 z-[1001] flex items-end gap-2">
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


function zoomSettingsComponent() {
  return `
    <div class="relative">
      ${state.zoomSettingsOpen ? `
        <div class="pointer-events-auto absolute bottom-10 right-0 w-48 rounded-md border border-notion-200 bg-white/95 p-3 text-left shadow-panel backdrop-blur">
          <div class="flex items-center justify-between">
            <label for="zoom-sensitivity" class="text-[10px] font-semibold text-notion-700">Sensibilité du zoom</label>
            <span id="zoom-sensitivity-value" class="text-[10px] font-semibold text-gendarmerie-blue">${Math.round(state.zoomSensitivity * 100)}%</span>
          </div>
          <input id="zoom-sensitivity" type="range" min="${MAP_CONFIG.minZoomSensitivity * 100}" max="${MAP_CONFIG.maxZoomSensitivity * 100}" step="1" value="${Math.round(state.zoomSensitivity * 100)}" aria-label="Sensibilité du zoom" class="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gendarmerie-beige accent-gendarmerie-blue" />
          <div class="mt-1 flex justify-between text-[9px] text-notion-400"><span>Précis</span><span>Rapide</span></div>
        </div>
      ` : ''}
      <button id="zoom-settings" type="button" aria-label="Régler la sensibilité du zoom" aria-expanded="${state.zoomSettingsOpen}" class="grid h-8 w-8 place-items-center rounded-md border border-gendarmerie-beige bg-white/90 text-notion-500 shadow-panel backdrop-blur transition hover:bg-gendarmerie-beige/40 ${state.zoomSettingsOpen ? 'text-gendarmerie-blue' : ''}">
        ${componentIcon('settings', 'h-4 w-4')}
      </button>
    </div>
  `;
}
