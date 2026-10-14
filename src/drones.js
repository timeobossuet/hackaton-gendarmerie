/* ==========================================================================
 * drones.js — Placement optimal de pilotes de drones
 *
 * Problème : "Weighted Maximum Coverage Problem" avec 2 types de pilotes
 *   - pilote "1 km" (rayon de couverture 1000 m)
 *   - pilote "2 km" (rayon de couverture 2000 m)
 *
 * Algorithme :
 *   1. Discrétisation de la zone en points de demande pondérés
 *        - points échantillonnés le long du tracé GPX      -> poids max (priorité chemin)
 *        - grille dans le rayon autour du tracé            -> poids décroissant avec la distance
 *        - grille dans le polygone dessiné à la main       -> poids uniforme (sans priorité)
 *   2. Glouton (greedy) : on place les pilotes un par un là où le gain de
 *      couverture pondérée est maximal (garantie théorique 1 - 1/e ≈ 63 %)
 *   3. Recherche locale : on retire chaque pilote et on le replace au meilleur
 *      endroit, jusqu'à ne plus rien améliorer
 *   4. Raffinement fin : petit déplacement sur la grille fine autour de chaque pilote
 *   5. Affichage : cercles de couverture + zones de collision (intersections) en rouge
 *
 * Module de calcul pur (aucune dépendance au DOM, à Leaflet ni aux globales de testCharles.js).
 * ========================================================================== */
(function (global) {
  "use strict";

  const CONFIG = {
    radii: { small: 1000, large: 2000 },   // rayons de couverture en mètres
    targetPoints: 4000,                    // nombre cible de points de demande
    minStep: 20,                           // pas de grille min (m)
    maxStep: 400,                          // pas de grille max (m)
    maxGridCandidates: 700,                // positions candidates (grille)
    maxPathCandidates: 150,                // positions candidates (sur le tracé)
    maxLocalSearchIter: 20,
    maxRefinePass: 6,
    // Pondération temporelle (avancée de l'opération) : continue, sans cas spécial 0 % / 100 %
    time: { behind: 0.08, ahead: 0.3, floor: 0.03, pathBoost: 2.5 },
    // Coût de déplacement d'un drone déjà posé (en fraction du poids total à couvrir) :
    // un déplacement n'est accepté que si le gain de couverture le dépasse.
    move: { fixed: 0.015, perRadius: 0.04, ignoreBelow: 5 },
    colors: { small: "#e51e64", large: "#8e24aa", collision: "#ff1744" }
  };

  /* ======================================================================
   * 1. Géométrie (projection locale en mètres)
   * ====================================================================== */

  function makeProjection(lon0, lat0) {
    const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
    const ky = 110540;
    return {
      toXY: (lon, lat) => [(lon - lon0) * kx, (lat - lat0) * ky],
      toLatLng: (x, y) => [lat0 + y / ky, lon0 + x / kx]
    };
  }

  function extractLines(geojson) {
    const lines = [];
    (function visit(g) {
      if (!g) return;
      switch (g.type) {
        case "FeatureCollection": g.features.forEach(visit); break;
        case "Feature": visit(g.geometry); break;
        case "GeometryCollection": g.geometries.forEach(visit); break;
        case "LineString": lines.push(g.coordinates); break;
        case "MultiLineString": g.coordinates.forEach(l => lines.push(l)); break;
      }
    })(geojson);
    return lines.filter(l => l.length > 1);
  }

  function extractRings(geojsons) {
    const rings = [];
    const visit = g => {
      if (!g) return;
      switch (g.type) {
        case "FeatureCollection": g.features.forEach(visit); break;
        case "Feature": visit(g.geometry); break;
        case "GeometryCollection": g.geometries.forEach(visit); break;
        case "Polygon": rings.push(g.coordinates[0]); break;
        case "MultiPolygon": g.coordinates.forEach(p => rings.push(p[0])); break;
      }
    };
    geojsons.forEach(visit);
    return rings;
  }

  function pointInRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function ringArea(ring) {
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    }
    return Math.abs(a) / 2;
  }

  function polylineLength(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return L;
  }

  // Échantillonne une polyligne tous les `spacing` mètres -> [x, y, s] (s = distance depuis le début)
  function samplePolyline(pts, spacing) {
    const out = [];
    if (!pts.length) return out;
    out.push([pts[0][0], pts[0][1], 0]);
    let carry = 0, walked = 0;
    for (let i = 1; i < pts.length; i++) {
      const x0 = pts[i - 1][0], y0 = pts[i - 1][1];
      const dx = pts[i][0] - x0, dy = pts[i][1] - y0;
      const len = Math.hypot(dx, dy);
      if (len === 0) continue;
      let d = spacing - carry;
      while (d <= len) {
        out.push([x0 + (dx * d) / len, y0 + (dy * d) / len, walked + d]);
        d += spacing;
      }
      carry = len - (d - spacing);
      walked += len;
    }
    const last = pts[pts.length - 1];
    const prev = out[out.length - 1];
    if (Math.hypot(last[0] - prev[0], last[1] - prev[1]) > spacing * 0.25) out.push([last[0], last[1], walked]);
    return out;
  }

  // Importance d'un point du tracé selon l'avancée t : maximale au front (ratio ≈ t),
  // décroît doucement vers l'avant (zone à anticiper) et plus vite vers l'arrière (déjà fait).
  function timeFactor(ratio, t) {
    const T = CONFIG.time;
    const delta = ratio - t;
    const sigma = delta >= 0 ? T.ahead : T.behind;
    return T.floor + (1 - T.floor) * Math.exp(-((delta / sigma) ** 2));
  }

  /* ======================================================================
   * 2. Construction de la zone à couvrir (points de demande pondérés)
   *    catégories : 0 = chemin, 1 = autour du chemin, 2 = polygone dessiné
   * ====================================================================== */

  function buildDemand(lines, rings, opts) {
    const R = opts.radius, wPath = Math.max(1, opts.wPath), wPoly = opts.wPoly;
    const timeProgress = Math.max(0, Math.min(1, Number(opts.timeProgress) || 0));

    if (!lines.length && !rings.length) {
      throw new Error('Aucune géométrie exploitable (chemin ou zone) trouvée.');
    }
    const first = lines.length ? lines[0][0] : rings[0][0];
    const proj = makeProjection(first[0], first[1]);
    const pLines = lines.map(l => l.map(c => proj.toXY(c[0], c[1])));
    const pRings = rings.map(r => r.map(c => proj.toXY(c[0], c[1])));

    // Pas de grille adapté à la taille de la zone
    const pathLen = pLines.reduce((s, l) => s + polylineLength(l), 0);
    const polyArea = pRings.reduce((s, r) => s + ringArea(r), 0);
    const area = (pLines.length ? 2 * R * pathLen + Math.PI * R * R : 0) + polyArea;
    let step = Math.sqrt(area / CONFIG.targetPoints);
    step = Math.min(CONFIG.maxStep, Math.max(CONFIG.minStep, Math.round(step / 5) * 5));

    const KEY = (i, j) => (i + 1e6) * 4e6 + (j + 1e6);

    // --- points sur le chemin (poids selon l'avancée de l'opération)
    const pathPts = [];
    const dense = [];
    const hasPath = pLines.length > 0;
    const totalPathLength = pLines.reduce((sum, line) => sum + polylineLength(line), 0);
    const tf = sArc => (hasPath && totalPathLength ? timeFactor(sArc / totalPathLength, timeProgress) : 1);
    let offset = 0;
    pLines.forEach(line => {
      samplePolyline(line, step).forEach(p => {
        pathPts.push({ x: p[0], y: p[1], weight: wPath * CONFIG.time.pathBoost * tf(offset + p[2]) });
      });
      samplePolyline(line, step / 2).forEach(p => dense.push([p[0], p[1], offset + p[2]]));
      offset += polylineLength(line);
    });

    // --- grille autour du chemin (distance min au tracé)
    const bufCells = new Map();
    const R2 = R * R;
    for (const [sx, sy, ss] of dense) {
      const i0 = Math.floor((sx - R) / step), i1 = Math.floor((sx + R) / step);
      const j0 = Math.floor((sy - R) / step), j1 = Math.floor((sy + R) / step);
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const cx = (i + 0.5) * step, cy = (j + 0.5) * step;
          const d2 = (cx - sx) * (cx - sx) + (cy - sy) * (cy - sy);
          if (d2 > R2) continue;
          const k = KEY(i, j);
          const c = bufCells.get(k);
          if (!c) bufCells.set(k, { i, j, d2, s: ss });
          else if (d2 < c.d2) { c.d2 = d2; c.s = ss; }
        }
      }
    }

    // --- grille dans le(s) polygone(s) dessiné(s)
    const polyCells = new Map();
    for (const ring of pRings) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      ring.forEach(([x, y]) => {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      });
      for (let i = Math.floor(minX / step); i <= Math.floor(maxX / step); i++) {
        for (let j = Math.floor(minY / step); j <= Math.floor(maxY / step); j++) {
          if (pointInRing((i + 0.5) * step, (j + 0.5) * step, ring)) polyCells.set(KEY(i, j), { i, j });
        }
      }
    }

    // --- assemblage
    const X = [], Y = [], W = [], CAT = [], GI = [], GJ = [];
    const push = (x, y, w, cat, i, j) => { X.push(x); Y.push(y); W.push(w); CAT.push(cat); GI.push(i); GJ.push(j); };

    // abscisse curviligne du point du tracé le plus proche (pour les cellules du polygone hors buffer)
    const sub = dense.filter((_, idx) => idx % Math.max(1, Math.ceil(dense.length / 500)) === 0);
    const nearestS = (x, y) => {
      let best = Infinity, sArc = 0;
      for (const p of sub) {
        const d = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y);
        if (d < best) { best = d; sArc = p[2]; }
      }
      return sArc;
    };

    pathPts.forEach(p => push(p.x, p.y, p.weight, 0, 0, 0));

    for (const [k, c] of bufCells) {
      const d = Math.sqrt(c.d2);
      let w = 1 + (wPath - 1) * (1 - d / R);          // décroît linéairement de wPath à 1
      if (polyCells.has(k)) { w = Math.max(w, wPoly); polyCells.delete(k); }
      w *= tf(c.s);                                   // la zone suit l'avancée comme le tracé
      push((c.i + 0.5) * step, (c.j + 0.5) * step, w, 1, c.i, c.j);
    }
    for (const c of polyCells.values()) {
      const cx = (c.i + 0.5) * step, cy = (c.j + 0.5) * step;
      push(cx, cy, hasPath ? wPoly * tf(nearestS(cx, cy)) : wPoly, 2, c.i, c.j);
    }

    return {
      n: X.length,
      nPath: pathPts.length,
      X: Float64Array.from(X), Y: Float64Array.from(Y), W: Float64Array.from(W),
      CAT: Uint8Array.from(CAT), GI: Int32Array.from(GI), GJ: Int32Array.from(GJ),
      step, proj
    };
  }

  /* ======================================================================
   * 3. Optimisation : glouton + recherche locale + raffinement
   * ====================================================================== */

function optimize(demand, counts, fleet, options = {}) {
  const { n, nPath, X, Y, W, CAT, GI, GJ, step } = demand;

  // Flotte : une entrée par pilote { id, name, type, radius }
  if (!Array.isArray(fleet) || !fleet.length) {
    fleet = [];
    ["small", "large"].forEach(t => {
      for (let k = 0; k < (counts?.[t] || 0); k++) {
        fleet.push({ id: `${t}-${k + 1}`, name: `${t} ${k + 1}`, type: t, radius: CONFIG.radii[t] });
      }
    });
  }
  fleet = fleet.map(p => ({
    id: p.id,
    name: p.name,
    type: p.type,
    radius: Number(p.radius) > 0 ? Number(p.radius) : CONFIG.radii[p.type],
    previous: (options.previous || []).find(position => position.id === p.id)
  }));
  if (!fleet.length) throw new Error("Aucun pilote à placer.");

  const mod = (a, k) => ((a % k) + k) % k;

  // Positions candidates (sous-échantillon des points de demande)
  const nGrid = n - nPath;
  const kGrid = Math.max(1, Math.ceil(Math.sqrt(nGrid / CONFIG.maxGridCandidates)));
  const kPath = Math.max(1, Math.ceil(nPath / CONFIG.maxPathCandidates));
  let cand = [];
  for (let idx = 0; idx < n; idx++) {
    if (CAT[idx] === 0) { if (idx % kPath === 0) cand.push(idx); }
    else if (mod(GI[idx], kGrid) === 0 && mod(GJ[idx], kGrid) === 0) cand.push(idx);
  }
  if (cand.length < 5) {
    const k = Math.max(1, Math.ceil(n / CONFIG.maxGridCandidates));
    cand = [];
    for (let idx = 0; idx < n; idx += k) cand.push(idx);
  }
  cand = cand.map(idx => ({ x: X[idx], y: Y[idx] }));
  fleet.forEach(pilot => {
    if (!pilot.previous || !Number.isFinite(pilot.previous.lat) || !Number.isFinite(pilot.previous.lng)) return;
    const [x, y] = demand.proj.toXY(pilot.previous.lng, pilot.previous.lat);
    pilot.previousX = x;
    pilot.previousY = y;
    if (!cand.some(candidate => Math.hypot(candidate.x - x, candidate.y - y) <= CONFIG.move.ignoreBelow)) {
      cand.push({ x, y });
    }
  });

  // Listes de couverture, mises en cache PAR RAYON
  const tmp = new Int32Array(n);
  const coverList = (x, y, rr2) => {
    let m = 0;
    for (let i = 0; i < n; i++) {
      const dx = X[i] - x, dy = Y[i] - y;
      if (dx * dx + dy * dy <= rr2) tmp[m++] = i;
    }
    return tmp.slice(0, m);
  };
  const listsByRadius = new Map();
  const getLists = radius => {
    let lists = listsByRadius.get(radius);
    if (!lists) {
      const rr2 = radius * radius;
      lists = cand.map(point => coverList(point.x, point.y, rr2));
      listsByRadius.set(radius, lists);
    }
    return lists;
  };

  let wTot = 0;
  for (let i = 0; i < n; i++) wTot += W[i];

  const covered = new Uint8Array(n);
  const gainOf = list => {
    let g = 0;
    for (let k = 0; k < list.length; k++) { const i = list[k]; if (covered[i] === 0) g += W[i]; }
    return g;
  };
  const apply = (list, d) => { for (let k = 0; k < list.length; k++) covered[list[k]] += d; };
  const movementCost = (pilot, x, y) => {
    if (!Number.isFinite(pilot.previousX) || !options.preservePositions) return 0;
    const distance = Math.hypot(x - pilot.previousX, y - pilot.previousY);
    if (distance <= CONFIG.move.ignoreBelow) return 0;
    return wTot * (CONFIG.move.fixed + CONFIG.move.perRadius * distance / pilot.radius);
  };
  const movementDistance = (pilot, x, y) => Number.isFinite(pilot.previousX)
    ? Math.hypot(x - pilot.previousX, y - pilot.previousY)
    : 0;

  // Glouton : le gain de couverture est pondéré par le coût de déplacement.
  const pending = fleet.slice();
  const pilots = [];
  while (pending.length) {
    let best = { score: -Infinity, gain: -Infinity, distance: Infinity, pilot: null, c: -1 };
    for (const pilot of pending) {
      const L = getLists(pilot.radius);
      for (let c = 0; c < cand.length; c++) {
        const point = cand[c];
        const gain = gainOf(L[c]);
        const score = gain - movementCost(pilot, point.x, point.y);
        const distance = movementDistance(pilot, point.x, point.y);
        if (score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && distance < best.distance)) {
          best = { score, gain, distance, pilot, c };
        }
      }
    }
    let chosenPilot = best.pilot;
    let chosenCandidate = best.c;
    if (best.gain <= 1e-9) {
      chosenPilot = pending.find(pilot => Number.isFinite(pilot.previousX)) || pending[0];
      if (Number.isFinite(chosenPilot.previousX)) {
        chosenCandidate = cand.reduce((closest, point, index) =>
          movementDistance(chosenPilot, point.x, point.y) < movementDistance(chosenPilot, cand[closest].x, cand[closest].y)
            ? index
            : closest, 0);
      } else if (pilots.length) {
        chosenCandidate = cand.reduce((farthest, point, index) => {
          const currentDistance = Math.min(...pilots.map(placed => Math.hypot(placed.x - point.x, placed.y - point.y)));
          const farthestDistance = Math.min(...pilots.map(placed => Math.hypot(placed.x - cand[farthest].x, placed.y - cand[farthest].y)));
          return currentDistance > farthestDistance ? index : farthest;
        }, 0);
      }
    }
    const meta = pending.splice(pending.indexOf(chosenPilot), 1)[0];
    const point = cand[chosenCandidate];
    const list = getLists(meta.radius)[chosenCandidate];
    pilots.push({ ...meta, x: point.x, y: point.y, list });
    apply(list, +1);
  }

  // Recherche locale
  for (let iter = 0; iter < CONFIG.maxLocalSearchIter; iter++) {
    let improved = false;
    for (const p of pilots) {
      apply(p.list, -1);
      let bestG = gainOf(p.list) - movementCost(p, p.x, p.y), bestC = -1;
      const L = getLists(p.radius);
      for (let c = 0; c < cand.length; c++) {
        const point = cand[c];
        const score = gainOf(L[c]) - movementCost(p, point.x, point.y);
        if (score > bestG + 1e-9) { bestG = score; bestC = c; }
      }
      if (bestC >= 0) {
        p.x = cand[bestC].x; p.y = cand[bestC].y; p.list = L[bestC];
        improved = true;
      }
      apply(p.list, +1);
    }
    if (!improved) break;
  }

  // Raffinement fin
  const refineR2 = Math.pow(1.5 * step * kGrid, 2);
  for (let pass = 0; pass < CONFIG.maxRefinePass; pass++) {
    let improved = false;
    for (const p of pilots) {
      const rr2 = p.radius * p.radius;
      apply(p.list, -1);
      let bestG = gainOf(p.list) - movementCost(p, p.x, p.y), best = null;
      for (let i = 0; i < n; i++) {
        const dx = X[i] - p.x, dy = Y[i] - p.y;
        if (dx * dx + dy * dy > refineR2) continue;
        const l = coverList(X[i], Y[i], rr2);
        const score = gainOf(l) - movementCost(p, X[i], Y[i]);
        if (score > bestG + 1e-9) { bestG = score; best = { i, l }; }
      }
      if (best) { p.x = X[best.i]; p.y = Y[best.i]; p.list = best.l; improved = true; }
      apply(p.list, +1);
    }
    if (!improved) break;
  }

  let wCov = 0;
  const cnt = [0, 0, 0], cov = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    cnt[CAT[i]]++;
    if (covered[i] > 0) { wCov += W[i]; cov[CAT[i]]++; }
  }
  const pct = c => (cnt[c] ? cov[c] / cnt[c] : null);
  return {
    pilots: pilots.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      radius: p.radius,
      x: p.x,
      y: p.y,
      moved: Number.isFinite(p.previousX) ? Math.hypot(p.x - p.previousX, p.y - p.previousY) : 0
    })),
    stats: { weighted: wCov / wTot, path: pct(0), buffer: pct(1), poly: pct(2) }
  };
}

  // Exposé pour les tests / usage externe
  global.DroneOptimizer = { buildDemand, optimize, extractLines, extractRings, CONFIG };
})(typeof window !== "undefined" ? window : globalThis);