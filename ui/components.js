import { MAP_CONFIG } from './config.js';
import { droneModels, state } from './state.js';
import { componentIcon } from './icons.js';

export function appShell() {
  return `
    <main class="relative h-full w-full">
      ${mapComponent()}
      ${topbarComponent()}
      ${state.droneSettingsOpen ? droneSettingsComponent() : ''}
      ${rightPanelToggleComponent()}
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
        <button id="new-mission-top" type="button" class="rounded-md bg-gendarmerie-beige px-2.5 py-1.5 text-[10px] font-semibold text-gendarmerie-navy transition hover:bg-white">Nouvelle mission</button>
        <button id="mission-menu-toggle" aria-expanded="${state.missionMenuOpen}" title="Gérer les missions" type="button" class="flex max-w-[190px] items-center gap-2 rounded-md border border-white/20 px-2.5 py-1.5 text-left text-xs text-white transition hover:bg-white/10">
          <span class="truncate">${escapeHtml(activeMission?.name || 'Mission')}</span><span class="text-white/60">⌄</span>
        </button>
        <button id="drone-settings-toggle" aria-expanded="${state.droneSettingsOpen}" title="Gérer les modèles de drones" type="button" class="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/20 p-0 text-white/75 transition hover:bg-white/10 hover:text-white ${state.droneSettingsOpen ? 'bg-white/15 text-white' : ''}">
          ${componentIcon('settings', 'h-4 w-4')}
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

function droneSettingsComponent() {
  return `
    <div class="fixed inset-0 z-[3000] flex min-h-screen flex-col bg-white text-gendarmerie-navy">
      <div class="flex shrink-0 items-center justify-between border-b border-gendarmerie-beige bg-gendarmerie-navy px-5 py-4 text-white shadow-panel sm:px-8">
        <div>
          <div class="text-[10px] font-bold uppercase tracking-widest text-gendarmerie-beige">Configuration</div>
          <h2 class="mt-1 text-base font-semibold">Modèles de drones</h2>
          <p class="mt-1 text-xs leading-4 text-white/65">Consultez les capacités disponibles et affectez un modèle à chaque rayon de couverture.</p>
        </div>
        <button id="drone-settings-close" title="Fermer la gestion des drones" type="button" class="rounded-md border border-white/20 p-2 text-white/75 hover:bg-white/10 hover:text-white">${componentIcon('close', 'h-5 w-5')}</button>
      </div>
      <div class="flex-1 overflow-y-auto bg-notion-50 px-5 py-6 sm:px-8">
        <div class="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        ${droneModels.map((drone) => `
          <article class="rounded-lg border border-notion-200 bg-white p-4 shadow-sm">
            <div class="flex items-start justify-between gap-2">
              <h3 class="text-xs font-semibold">${escapeHtml(drone.model)}</h3>
            </div>
            <form class="drone-model-form mt-3 space-y-2" data-drone-id="${drone.id}">
              <input name="model" required value="${escapeHtml(drone.model)}" class="w-full rounded border border-notion-200 px-2 py-1.5 text-xs" aria-label="Nom du modèle" />
              <div class="grid grid-cols-2 gap-2">
                ${droneNumberInput('maxWindSpeed', 'Vent max (km/h)', drone.maxWindSpeed)}
                ${droneNumberInput('maxZoom', 'Zoom max', drone.maxZoom)}
                ${droneNumberInput('maxRange', 'Portée (m)', drone.maxRange)}
              </div>
              <div class="grid grid-cols-3 gap-1 text-[10px] text-notion-700">
                ${droneBooleanInput('thermalVision', 'Thermique', drone.thermalVision)}
                ${droneBooleanInput('nightVision', 'Nocturne', drone.nightVision)}
                ${droneBooleanInput('rainTolerance', 'Pluie', drone.rainTolerance)}
              </div>
              <div class="flex gap-2 pt-1">
                <button type="submit" class="flex-1 rounded bg-gendarmerie-blue px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-blue-800">Enregistrer</button>
                <button type="button" data-delete-drone="${drone.id}" class="rounded border border-red-200 px-2 py-1.5 text-[10px] text-red-700 hover:bg-red-50">Supprimer</button>
              </div>
            </form>
          </article>
        `).join('')}
        </div>
        <form id="add-drone-model" class="mx-auto mt-6 max-w-5xl rounded-lg border border-dashed border-gendarmerie-beige bg-white p-4">
          <h3 class="text-xs font-semibold">Ajouter un modèle</h3>
          <div class="mt-3 grid gap-2 sm:grid-cols-4">
            <input name="model" required placeholder="Nom du modèle" class="rounded border border-notion-200 px-2 py-1.5 text-xs" />
            ${droneNumberInput('maxWindSpeed', 'Vent max (km/h)', '', true)}
            ${droneNumberInput('maxZoom', 'Zoom max', '', true)}
            ${droneNumberInput('maxRange', 'Portée (m)', '', true)}
          </div>
          <div class="mt-2 flex items-center justify-between">
            <p class="text-[10px] text-notion-500">Les capacités optionnelles sont désactivées par défaut.</p>
            <button type="submit" class="rounded bg-gendarmerie-blue px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800">Ajouter le modèle</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function droneNumberInput(name, label, value, compact = false) {
  return `<label class="${compact ? '' : 'col-span-2'} text-[10px] text-notion-700">${label}<input name="${name}" type="number" min="0" required value="${value}" class="mt-1 w-full rounded border border-notion-200 px-2 py-1.5 text-xs" /></label>`;
}

function droneBooleanInput(name, label, checked) {
  return `<label class="flex items-center gap-1"><input name="${name}" type="checkbox" ${checked ? 'checked' : ''} />${label}</label>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[character]));
}

function panelFrame({ side, title, eyebrow, content, open }) {
  const position = state.panelPositions[side];
  const defaultPosition = side === 'left' ? 'left: 1rem;' : 'right: 1rem;';
  const positionStyle = position
    ? `left: ${position.x}px; top: ${position.y}px; right: auto;`
    : `${defaultPosition} top: 4rem;`;
  const hiddenPosition = side === 'left' ? '-translate-x-[calc(100%+1rem)]' : 'translate-x-[calc(100%+1rem)]';

  return `
    <aside id="${side}-panel" data-panel-side="${side}" style="${positionStyle}" class="absolute z-[2000] w-[calc(100vw-2rem)] max-w-[300px] rounded-lg border border-notion-200 bg-white/95 shadow-panel backdrop-blur transition-opacity duration-200 ${open ? 'translate-x-0 opacity-100' : `${hiddenPosition} pointer-events-none opacity-0`}">
      <div data-panel-drag-handle class="flex cursor-move items-start justify-between gap-3 border-b border-notion-200 px-4 py-3">
        <div>
        <div class="text-[10px] font-bold uppercase tracking-widest text-gendarmerie-blue">${eyebrow}</div>
        <h1 class="mt-1 text-sm font-semibold">${title}</h1>
        ${side === 'left' ? `<p class="mt-1 text-[10px] leading-4 text-notion-500">1. Définissez la zone · 2. Placez les drones</p>` : ''}
        </div>
        ${side === 'right' ? `<button id="minimize-right" title="Réduire les options de la carte" type="button" class="shrink-0 rounded-md p-1 text-notion-500 transition hover:bg-gendarmerie-beige/40 hover:text-gendarmerie-blue">${componentIcon('minimize', 'h-4 w-4')}</button>` : ''}
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
          <span class="text-[10px] text-notion-400">${Object.values(state.planning.fleet || {}).reduce((total, count) => total + Number(count || 0), 0)} drones</span>
        </div>
        <div class="grid gap-2 sm:grid-cols-2">
          ${droneModels.map((drone) => `
            <label class="rounded-md border border-notion-200 p-2 text-[10px] text-notion-500">
              <span class="flex items-center justify-between gap-2"><span class="truncate">${escapeHtml(drone.model)}</span><span class="text-[9px] text-notion-400">${drone.maxRange} m</span></span>
              <input class="drone-count mt-1 w-full rounded border border-gendarmerie-beige px-2 py-1.5 text-xs outline-none focus:border-gendarmerie-blue" data-drone-id="${drone.id}" type="number" min="0" max="30" value="${state.planning.fleet?.[drone.id] || 0}" aria-label="Nombre de ${escapeHtml(drone.model)}" />
            </label>
          `).join('')}
        </div>
        <label class="mt-3 block text-[10px] text-gray-500"><span class="flex justify-between"><span>Importance du chemin</span><strong id="path-weight-value" class="font-semibold text-notion-800">${state.planning.pathWeight}</strong></span>
          <input id="path-weight" type="range" min="1" max="100" value="${state.planning.pathWeight}" class="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gendarmerie-beige accent-gendarmerie-blue" />
        </label>
        <p class="mt-1 text-[10px] leading-4 text-gray-500">Une valeur élevée concentre davantage la couverture sur le chemin.</p>
        <label class="mt-3 block text-[10px] text-gray-500"><span class="flex justify-between"><span>Importance de la zone</span><strong id="area-weight-value" class="font-semibold text-notion-800">${state.planning.areaWeight}</strong></span>
          <input id="area-weight" type="range" min="1" max="100" step="1" value="${state.planning.areaWeight}" class="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gendarmerie-beige accent-gendarmerie-blue" />
        </label>
        <p class="mt-1 text-[10px] leading-4 text-gray-500">Une valeur élevée répartit davantage les drones dans toute la zone.</p>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button id="optimize-placement" type="button" class="rounded-md bg-gendarmerie-blue px-2 py-2 text-[10px] font-semibold text-white transition hover:bg-gendarmerie-navy disabled:cursor-not-allowed disabled:bg-notion-100 disabled:text-notion-400" ${state.planning.calculating || (!state.planning.gpxGeoJson && !state.polygonAdded) ? 'disabled' : ''}>${state.planning.calculating ? 'Placement en cours…' : 'Calculer le placement'}</button>
        </div>
        ${placementResultComponent(hasProtectedArea)}
        </section>
      </details>
    </div>
  `;

  return panelFrame({ side: 'left', eyebrow: 'Configuration', title: 'Préparer la mission', content, open: state.leftMenuOpen });
}

function placementResultComponent(hasProtectedArea) {
  if (state.planning.placementError) {
    return `<div class="mt-3 rounded-md bg-red-50 px-2.5 py-2 text-[10px] leading-4 text-red-600">${state.planning.placementError}</div>`;
  }
  const result = state.planning.placement;
  if (!result) return `<p class="mt-3 text-[10px] leading-4 text-notion-400">${hasProtectedArea ? 'Réglez la flotte puis calculez le placement pour afficher les zones de couverture.' : 'Ajoutez un chemin GPX ou dessinez une zone protégée pour activer le calcul.'}</p>`;
  const percent = (value) => value == null ? '—' : `${Math.round(value * 100)}%`;
  return `
    <div class="mt-3 rounded-md border border-green-200 bg-green-50 p-2.5 text-[10px] leading-4 text-green-800">
      <div class="mb-2 font-semibold text-green-900">Placement calculé</div>
      <div class="grid grid-cols-2 gap-1">
        <span>Couverture totale</span><strong class="text-right text-green-900">${percent(result.stats.weighted)}</strong>
        <span>Chemin couvert</span><strong class="text-right">${percent(result.stats.path)}</strong>
        <span>Zone couverte</span><strong class="text-right">${percent(result.stats.buffer ?? result.stats.poly)}</strong>
        <span>Zones de chevauchement</span><strong class="text-right">${result.collisions.pairs}</strong>
      </div>
    </div>
  `;
}

function rightPanelComponent() {
  const hasProtectedArea = Boolean(state.planning.gpxGeoJson || state.polygonAdded);
  const content = `
    <div class="space-y-5">
      <section>
        <h2 class="mb-2 text-xs font-semibold">Couches de la carte</h2>
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
      <button id="export-map" title="Imprimer la carte" type="button" class="flex w-full items-center justify-center gap-2 rounded-md border border-gendarmerie-beige px-3 py-2 text-xs font-medium text-gendarmerie-blue transition hover:bg-gendarmerie-beige/40">
        ${componentIcon('printer', 'h-4 w-4')} Imprimer la carte
      </button>
    </div>
  `;

  return panelFrame({ side: 'right', eyebrow: 'Affichage', title: 'Options de la carte', content, open: state.rightMenuOpen });
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
        <div class="flex flex-col overflow-hidden rounded-md border border-notion-200 bg-white/90 shadow-panel backdrop-blur">
          <button id="zoom-in" type="button" aria-label="Zoomer" class="grid h-8 w-8 place-items-center border-b border-notion-200 text-lg text-notion-500 hover:bg-notion-100">+</button>
          <button id="zoom-out" type="button" aria-label="Dézoomer" class="grid h-8 w-8 place-items-center text-lg text-notion-500 hover:bg-notion-100">−</button>
        </div>
      </div>
      <div class="pointer-events-none absolute bottom-2 left-2 z-[1000] text-[9px] text-notion-500/70">© OpenStreetMap contributors</div>
    </div>
  `;
}

function rightPanelToggleComponent() {
  if (state.rightMenuOpen) return '';
  return `<button id="show-right-panel" title="Afficher les options de la carte" type="button" class="absolute right-5 top-20 z-[2100] grid h-9 w-9 place-items-center rounded-md border border-gendarmerie-beige bg-white/95 text-gendarmerie-blue shadow-panel backdrop-blur transition hover:bg-gendarmerie-beige/50">${componentIcon('layers', 'h-4 w-4')}</button>`;
}
