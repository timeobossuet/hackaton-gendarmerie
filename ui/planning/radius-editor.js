import { getLeafletMap } from '../map.js';
import {
  MIN_RADIUS, RADIUS_STEP, PILOT_TYPES,
  getPilot, setPilotRadius, resetPilotRadii, formatRadius, hasCustomRadius, isPlacementStale
} from './fleet.js';

const HIDE_DELAY = 350;
const registry = new Map(); // id du TP -> { circle, marker, ref }
let card = null;
let hideTimer = null;
let dragging = false;
let current = null; // { pilotId, circle }
let handlers = { onRadiusCommit: () => {}, onRecalculate: () => {} };
let globalListenerBound = false;

export function configureRadiusEditor(next) {
  handlers = { ...handlers, ...next };
}

export function resetRadiusEditor() {
  window.clearTimeout(hideTimer);
  hideCard();
  registry.clear();
}

// Remet les cercles affichés à la taille des rayons du state (après un reset).
export function syncCircleRadii() {
  registry.forEach(({ circle }, id) => {
    const pilot = getPilot(id);
    if (pilot) circle.setRadius(pilot.radius);
  });
}

export function renameRadiusEditorEntry(oldId, newId) {
  const entry = registry.get(oldId);
  if (!entry) return;
  registry.delete(oldId);
  entry.ref.id = newId;
  registry.set(newId, entry);
  entry.marker.setTooltipContent(newId);
  if (current?.pilotId === oldId) current.pilotId = newId;
}

export function removeRadiusEditorEntry(id) {
  const entry = registry.get(id);
  if (!entry) return;
  if (current?.pilotId === id) {
    window.clearTimeout(hideTimer);
    hideCard();
  }
  entry.circle.remove();
  entry.marker.remove();
  registry.delete(id);
}

export function bindRadiusEditor(pilotId, circle, marker) {
  const ref = { id: pilotId }; // mutable : l'ID peut être renommé après coup
  registry.set(pilotId, { circle, marker, ref });

  const open = (event) => {
    window.clearTimeout(hideTimer);
    circle.setStyle({ weight: 3, fillOpacity: 0.16 });
    showCard(ref.id, circle, event);
  };
  const close = () => {
    circle.setStyle({ weight: 2, fillOpacity: 0.08 });
    hideSoon();
  };

  [circle, marker].forEach((layer) => {
    layer.on('mouseover', open);
    layer.on('mouseout', close);
    layer.on('click', open); // tactile : pas de survol
  });
}

function hideSoon() {
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => { if (!dragging) hideCard(); }, HIDE_DELAY);
}

function hideCard() {
  card?.classList.add('hidden');
  current = null;
}

function ensureCard() {
  const map = getLeafletMap();
  if (!map) return null;
  const container = map.getContainer();
  if (card && card.parentElement === container) return card;

  card = document.createElement('div');
  card.className = 'absolute z-[1100] hidden w-60 rounded-lg border border-notion-200 bg-white/95 p-3 shadow-panel backdrop-blur';
  card.innerHTML = `
    <div class="flex items-start justify-between gap-2">
      <div>
        <div data-role="name" class="text-xs font-semibold text-notion-900"></div>
        <div data-role="id" class="mt-0.5 text-[10px] text-notion-400"></div>
      </div>
      <button data-role="close" type="button" aria-label="Fermer" class="rounded p-1 text-[10px] text-notion-400 hover:bg-notion-100">✕</button>
    </div>
    <label class="mt-3 block text-[10px] text-notion-500">Rayon de couverture
      <span data-role="value" class="font-semibold text-aeris"></span>
      <input data-role="slider" type="range" class="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-notion-200 accent-[#238b82]" />
    </label>
    <div data-role="default" class="mt-1 text-[9px] text-notion-400"></div>
    <div data-role="stale" class="mt-2 hidden rounded bg-amber-50 px-2 py-1.5 text-[10px] leading-4 text-amber-700">Rayon modifié : recalculez pour réoptimiser le placement.</div>
    <div class="mt-3 grid grid-cols-2 gap-2">
      <button data-role="reset" type="button" class="rounded-md border border-notion-200 px-2 py-1.5 text-[10px] font-semibold text-notion-600 hover:bg-notion-100">Rayon par défaut</button>
      <button data-role="recalc" type="button" class="rounded-md bg-aeris px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-[#1b716a]">Recalculer</button>
    </div>
  `;
  container.appendChild(card);

  // La carte ne doit ni déplacer ni zoomer la map quand on l'utilise.
  L.DomEvent.disableClickPropagation(card);
  L.DomEvent.disableScrollPropagation(card);

  const part = (role) => card.querySelector(`[data-role="${role}"]`);
  card.addEventListener('mouseenter', () => window.clearTimeout(hideTimer));
  card.addEventListener('mouseleave', hideSoon);
  part('close').addEventListener('click', hideCard);

  const slider = part('slider');
  slider.addEventListener('pointerdown', () => { dragging = true; });
  slider.addEventListener('input', () => {
    if (!current) return;
    const pilot = setPilotRadius(current.pilotId, slider.value);
    current.circle.setRadius(pilot.radius); // aperçu en direct
    refreshCard(pilot);
  });
  slider.addEventListener('change', () => handlers.onRadiusCommit());

  part('reset').addEventListener('click', () => {
    if (!current) return;
    const pilot = getPilot(current.pilotId);
    setPilotRadius(pilot.id, pilot.defaultRadius);
    current.circle.setRadius(pilot.radius);
    slider.value = pilot.radius;
    refreshCard(pilot);
    handlers.onRadiusCommit();
  });
  part('recalc').addEventListener('click', () => {
    hideCard();
    handlers.onRecalculate();
  });

  if (!globalListenerBound) {
    // Si on relâche le curseur en dehors de la carte, on la ferme proprement.
    document.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      if (card && !card.matches(':hover')) hideSoon();
    });
    globalListenerBound = true;
  }
  return card;
}

function refreshCard(pilot) {
  const part = (role) => card.querySelector(`[data-role="${role}"]`);
  part('value').textContent = formatRadius(pilot.radius);
  part('default').textContent = hasCustomRadius(pilot)
    ? `Défaut : ${formatRadius(pilot.defaultRadius)}`
    : 'Rayon par défaut';
  part('stale').classList.toggle('hidden', !isPlacementStale());
  part('reset').disabled = !hasCustomRadius(pilot);
  part('reset').classList.toggle('opacity-50', !hasCustomRadius(pilot));
}

function showCard(pilotId, circle, event) {
  const pilot = getPilot(pilotId);
  const map = getLeafletMap();
  const element = ensureCard();
  if (!pilot || !map || !element) return;

  current = { pilotId, circle };
  const part = (role) => element.querySelector(`[data-role="${role}"]`);
  part('name').textContent = pilot.name;
  part('id').textContent = `${pilot.id} · drone ${PILOT_TYPES[pilot.type].label}`;
  const slider = part('slider');
  slider.min = MIN_RADIUS;
  slider.max = pilot.defaultRadius; // on peut seulement réduire
  slider.step = RADIUS_STEP;
  slider.value = pilot.radius;
  refreshCard(pilot);

  element.classList.remove('hidden'); // avant de mesurer la taille
  const point = event?.containerPoint ?? map.latLngToContainerPoint(circle.getLatLng());
  const size = map.getSize();
  element.style.left = `${Math.min(Math.max(8, point.x + 12), size.x - element.offsetWidth - 8)}px`;
  element.style.top = `${Math.min(Math.max(8, point.y + 12), size.y - element.offsetHeight - 8)}px`;
}