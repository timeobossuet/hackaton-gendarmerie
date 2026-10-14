import { MAP_CONFIG, MAP_IMAGE, SELECTORS } from './config.js';
import { state } from './state.js';
import { $, clamp, getMapElement, getMapRect } from './dom.js';

export function bindMapInteractions() {
  bindMapPan();
  getMapElement().addEventListener('wheel', zoomAtPoint, { passive: false });
}

export function bindMapDrawing() {
  getMapElement().addEventListener('click', (event) => {
    if (!state.drawingPolygon || isInteractiveTarget(event.target)) return;
    state.polygonPoints.push(screenPointToMapPoint(event, getMapRect()));
    updatePolygonSvg();
  });
}

export function zoomBy(delta) {
  const currentScale = state.mapScale;
  const nextScale = clamp(currentScale + delta, MAP_CONFIG.minScale, MAP_CONFIG.maxScale);

  if (nextScale === currentScale) return;

  // Les boutons zooment autour du centre de la vue sans réinitialiser le pan.
  const ratio = nextScale / currentScale;
  setMapTransform(nextScale, state.mapX * ratio, state.mapY * ratio);
}

export function centerMapOnPolygon() {
  const xs = state.polygonPoints.map(({ x }) => x);
  const ys = state.polygonPoints.map(({ y }) => y);
  const rect = getMapRect();

  state.mapScale = MAP_CONFIG.missionScale;
  state.mapX = percentageToMapOffset(getCenterOfBounds(xs), rect.width, state.mapScale);
  state.mapY = percentageToMapOffset(getCenterOfBounds(ys), rect.height, state.mapScale);
}

export function recenterMap() {
  if (!state.polygonAdded) {
    setMapTransform(MAP_CONFIG.minScale, 0, 0);
    return;
  }

  const xs = state.polygonPoints.map(({ x }) => x);
  const ys = state.polygonPoints.map(({ y }) => y);
  setMapTransform(
    MAP_CONFIG.missionScale,
    percentageToMapOffset(getCenterOfBounds(xs), getMapRect().width, MAP_CONFIG.missionScale),
    percentageToMapOffset(getCenterOfBounds(ys), getMapRect().height, MAP_CONFIG.missionScale)
  );
}

export function setMapTransform(scale, x, y) {
  const rect = getMapRect();
  const maxX = ((scale - 1) * rect.width) / (2 * scale);
  const maxY = ((scale - 1) * rect.height) / (2 * scale);

  state.mapScale = scale;
  state.mapX = clamp(x, -maxX, maxX);
  state.mapY = clamp(y, -maxY, maxY);
  $(SELECTORS.mapContent).style.transform = `translate3d(${state.mapX}px, ${state.mapY}px, 0) scale(${state.mapScale})`;
  return { x: state.mapX, y: state.mapY, scale: state.mapScale };
}

export function getMapSvgWidth() {
  return MAP_IMAGE.aspectRatio * 100;
}

export function getPolygonMarkup() {
  if (!state.polygonPoints.length) return '';

  const points = getPolygonSvgPoints();
  const circles = state.polygonPoints
    .map(({ x, y }) => `<circle cx="${x * MAP_IMAGE.aspectRatio}" cy="${y}" r="0.9" fill="#fff" stroke="#238b82" stroke-width=".3"></circle>`)
    .join('');

  if (!state.polygonAdded) {
    return `<polyline points="${points}" fill="none" stroke="#238b82" stroke-width=".45" stroke-dasharray="1 0.7"></polyline>${circles}`;
  }

  return `<path d="M0,0 H${getMapSvgWidth()} V100 H0 Z M${points.replaceAll(' ', ' L')} Z" fill="rgba(7,19,28,.34)" fill-rule="evenodd"></path><polygon points="${points}" fill="rgba(35,139,130,.18)" stroke="#238b82" stroke-width=".35" stroke-dasharray="1 0.7"></polygon>${circles}`;
}

export function updatePolygonSvg() {
  const svg = $(SELECTORS.missionPolygon);
  if (!svg || !state.polygonPoints.length) return;

  svg.innerHTML = getPolygonMarkup();
  svg.classList.remove('opacity-0');
  svg.classList.add('opacity-100');
  const finishButton = $(SELECTORS.finishZone);
  if (finishButton) {
    finishButton.disabled = state.polygonPoints.length < MAP_CONFIG.polygonMinPoints;
    finishButton.textContent = `Valider la zone (${state.polygonPoints.length} points)`;
  }
}

function screenPointToMapPoint(event, rect) {
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;
  const contentPoint = transformScreenPointToContent(pointerX, pointerY, rect);
  const image = getRenderedImage(rect);

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

function bindMapPan(onMapChanged) {
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
    if (state.drawingPolygon || isInteractiveTarget(event.target)) return;
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
    const nextTransform = setMapTransform(
      state.mapScale,
      state.mapX + event.clientX - lastX,
      state.mapY + event.clientY - lastY
    );
    lastX = event.clientX;
    lastY = event.clientY;
    onMapChanged?.(nextTransform);
  });

  document.addEventListener('mouseup', stopDragging);
}

function isInteractiveTarget(target) {
  return Boolean(target.closest('button, input, label, select, textarea, a'));
}

function zoomAtPoint(event) {
  event.preventDefault();
  const rect = getMapRect();
  const currentScale = state.mapScale;
  const nextScale = clamp(
    currentScale + (event.deltaY < 0 ? state.zoomSensitivity : -state.zoomSensitivity),
    MAP_CONFIG.minScale,
    MAP_CONFIG.maxScale
  );

  if (nextScale === currentScale) return;

  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const ratio = nextScale / currentScale;

  setMapTransform(
    nextScale,
    pointerX - centerX - ((pointerX - centerX - state.mapX) * ratio),
    pointerY - centerY - ((pointerY - centerY - state.mapY) * ratio)
  );
}

function getPolygonSvgPoints() {
  return state.polygonPoints
    .map(({ x, y }) => `${x * MAP_IMAGE.aspectRatio},${y}`)
    .join(' ');
}

function getCenterOfBounds(values) {
  return (Math.min(...values) + Math.max(...values)) / 2;
}

function percentageToMapOffset(value, size, scale) {
  return ((50 - value) / 100) * size * scale;
}

function roundPercentage(value) {
  return Number(value.toFixed(2));
}
