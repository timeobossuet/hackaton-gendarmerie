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
 * Dépendances (déjà chargées dans ton HTML) : Leaflet, Turf.js
 * Dépend aussi des variables globales de testCharles.js :
 *   map, zonesLayer, currentGpxGeoJson, currentRadius
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

  // Échantillonne une polyligne tous les `spacing` mètres
  function samplePolyline(pts, spacing) {
    const out = [];
    if (!pts.length) return out;
    out.push(pts[0]);
    let carry = 0;
    for (let i = 1; i < pts.length; i++) {
      const x0 = pts[i - 1][0], y0 = pts[i - 1][1];
      const dx = pts[i][0] - x0, dy = pts[i][1] - y0;
      const len = Math.hypot(dx, dy);
      if (len === 0) continue;
      let d = spacing - carry;
      while (d <= len) {
        out.push([x0 + (dx * d) / len, y0 + (dy * d) / len]);
        d += spacing;
      }
      carry = len - (d - spacing);
    }
    const last = pts[pts.length - 1];
    const prev = out[out.length - 1];
    if (Math.hypot(last[0] - prev[0], last[1] - prev[1]) > spacing * 0.25) out.push(last);
    return out;
  }

  /* ======================================================================
   * 2. Construction de la zone à couvrir (points de demande pondérés)
   *    catégories : 0 = chemin, 1 = autour du chemin, 2 = polygone dessiné
   * ====================================================================== */

  function buildDemand(lines, rings, opts) {
    const R = opts.radius, wPath = Math.max(1, opts.wPath), wPoly = opts.wPoly;

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

    // --- points sur le chemin
    const pathPts = [];
    const dense = [];
    pLines.forEach(l => {
      samplePolyline(l, step).forEach(p => pathPts.push(p));
      samplePolyline(l, step / 2).forEach(p => dense.push(p));
    });

    // --- grille autour du chemin (distance min au tracé)
    const bufCells = new Map();
    const R2 = R * R;
    for (const [sx, sy] of dense) {
      const i0 = Math.floor((sx - R) / step), i1 = Math.floor((sx + R) / step);
      const j0 = Math.floor((sy - R) / step), j1 = Math.floor((sy + R) / step);
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const cx = (i + 0.5) * step, cy = (j + 0.5) * step;
          const d2 = (cx - sx) * (cx - sx) + (cy - sy) * (cy - sy);
          if (d2 > R2) continue;
          const k = KEY(i, j);
          const c = bufCells.get(k);
          if (!c) bufCells.set(k, { i, j, d2 });
          else if (d2 < c.d2) c.d2 = d2;
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

    pathPts.forEach(p => push(p[0], p[1], wPath, 0, 0, 0));

    for (const [k, c] of bufCells) {
      const d = Math.sqrt(c.d2);
      let w = 1 + (wPath - 1) * (1 - d / R);          // décroît linéairement de wPath à 1
      if (polyCells.has(k)) { w = Math.max(w, wPoly); polyCells.delete(k); }
      push((c.i + 0.5) * step, (c.j + 0.5) * step, w, 1, c.i, c.j);
    }
    for (const c of polyCells.values()) {
      push((c.i + 0.5) * step, (c.j + 0.5) * step, wPoly, 2, c.i, c.j);
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

  function optimize(demand, counts, radii, existingPilots = [], isPositionAllowed = () => true) {
    const { n, nPath, X, Y, W, CAT, GI, GJ, step } = demand;
    radii = radii || CONFIG.radii;
    const r2 = { small: radii.small * radii.small, large: radii.large * radii.large };
    const mod = (a, k) => ((a % k) + k) % k;
    const invalidLockedPilot = existingPilots.find(pilot =>
      pilot.locked &&
      (pilot.type === "small" || pilot.type === "large") &&
      Number.isFinite(pilot.x) && Number.isFinite(pilot.y) &&
      !isPositionAllowed(pilot.x, pilot.y)
    );
    if (invalidLockedPilot) {
      throw new Error("Un TP bloqué se trouve dans un secteur inadapté. Autorisez ce secteur ou autorisez le déplacement du TP avant de recalculer.");
    }

    // --- positions candidates (sous-échantillon des points de demande)
    const nGrid = n - nPath;
    const kGrid = Math.max(1, Math.ceil(Math.sqrt(nGrid / CONFIG.maxGridCandidates)));
    const kPath = Math.max(1, Math.ceil(nPath / CONFIG.maxPathCandidates));
    let cand = [];
    const eligibleCandidates = [];
    for (let idx = 0; idx < n; idx++) {
      if (!isPositionAllowed(X[idx], Y[idx])) continue;
      eligibleCandidates.push(idx);
      if (CAT[idx] === 0) { if (idx % kPath === 0) cand.push(idx); }
      else if (mod(GI[idx], kGrid) === 0 && mod(GJ[idx], kGrid) === 0) cand.push(idx);
    }
    if (cand.length < 5) {
      const k = Math.max(1, Math.ceil(eligibleCandidates.length / CONFIG.maxGridCandidates));
      cand = [];
      for (let i = 0; i < eligibleCandidates.length; i += k) cand.push(eligibleCandidates[i]);
    }
    if (cand.length === 0) {
      throw new Error("Aucun emplacement adapté n’a été trouvé dans les secteurs analysés. Étendez le scan des restrictions ou vérifiez le lieu de mission.");
    }

    // --- listes de couverture précalculées
    const tmp = new Int32Array(n);
    const coverList = (x, y, rr2) => {
      let m = 0;
      for (let i = 0; i < n; i++) {
        const dx = X[i] - x, dy = Y[i] - y;
        if (dx * dx + dy * dy <= rr2) tmp[m++] = i;
      }
      return tmp.slice(0, m);
    };
    const types = [];
    if (counts.small > 0) types.push("small");
    if (counts.large > 0) types.push("large");
    const lists = {};
    types.forEach(t => { lists[t] = cand.map(ci => coverList(X[ci], Y[ci], r2[t])); });

    const covered = new Uint8Array(n);
    const gainOf = list => {
      let g = 0;
      for (let k = 0; k < list.length; k++) { const i = list[k]; if (covered[i] === 0) g += W[i]; }
      return g;
    };
    const apply = (list, d) => { for (let k = 0; k < list.length; k++) covered[list[k]] += d; };

    // --- 1) glouton
    const remaining = { small: counts.small, large: counts.large };
    const pilots = [];
    const available = existingPilots.filter(pilot =>
      (pilot.type === "small" || pilot.type === "large") &&
      Number.isFinite(pilot.x) && Number.isFinite(pilot.y)
    );
    const lockedCounts = {
      small: available.filter(pilot => pilot.locked && pilot.type === "small").length,
      large: available.filter(pilot => pilot.locked && pilot.type === "large").length
    };
    for (const type of ["small", "large"]) {
      if (lockedCounts[type] > counts[type]) {
        throw new Error(`La flotte ne contient pas assez de drones ${type === "small" ? "1 km" : "2 km"} pour conserver tous les drones bloqués.`);
      }
    }

    const redeploy = [];
    available.forEach(pilot => {
      if (!pilot.locked) return;
      const list = coverList(pilot.x, pilot.y, r2[pilot.type]);
      pilots.push({ ...pilot, previousX: pilot.x, previousY: pilot.y, list, fixed: true });
      apply(list, +1);
      remaining[pilot.type]--;
    });

    available.forEach(pilot => {
      if (pilot.locked || remaining[pilot.type] <= 0) return;
      if (!isPositionAllowed(pilot.x, pilot.y)) {
        redeploy.push(pilot);
        return;
      }
      const list = coverList(pilot.x, pilot.y, r2[pilot.type]);
      pilots.push({ ...pilot, previousX: pilot.x, previousY: pilot.y, list, fixed: false });
      apply(list, +1);
      remaining[pilot.type]--;
    });

    const total = remaining.small + remaining.large;
    for (let p = 0; p < total; p++) {
      let best = { g: -1, t: null, c: -1 };
      for (const t of types) {
        if (remaining[t] <= 0) continue;
        const L = lists[t];
        for (let c = 0; c < cand.length; c++) {
          const g = gainOf(L[c]);
          if (g > best.g) best = { g, t, c };
        }
      }
      const list = lists[best.t][best.c];
      pilots.push({ type: best.t, x: X[cand[best.c]], y: Y[cand[best.c]], list });
      apply(list, +1);
      remaining[best.t]--;
    }

    // --- 2) recherche locale : on retire un pilote et on le replace au mieux
    for (let iter = 0; iter < CONFIG.maxLocalSearchIter; iter++) {
      let improved = false;
      for (const p of pilots) {
        if (p.fixed) continue;
        apply(p.list, -1);
        let bestG = gainOf(p.list), bestC = -1;
        const L = lists[p.type];
        for (let c = 0; c < cand.length; c++) {
          const g = gainOf(L[c]);
          if (g > bestG + 1e-9) { bestG = g; bestC = c; }
        }
        if (bestC >= 0) {
          p.x = X[cand[bestC]]; p.y = Y[cand[bestC]]; p.list = L[bestC];
          improved = true;
        }
        apply(p.list, +1);
      }
      if (!improved) break;
    }

    // --- 3) raffinement fin autour de chaque pilote (toute la grille fine)
    const refineR2 = Math.pow(1.5 * step * kGrid, 2);
    for (let pass = 0; pass < CONFIG.maxRefinePass; pass++) {
      let improved = false;
      for (const p of pilots) {
        if (p.fixed) continue;
        apply(p.list, -1);
        let bestG = gainOf(p.list), best = null;
        for (let i = 0; i < n; i++) {
          const dx = X[i] - p.x, dy = Y[i] - p.y;
          if (dx * dx + dy * dy > refineR2) continue;
          if (!isPositionAllowed(X[i], Y[i])) continue;
          const l = coverList(X[i], Y[i], r2[p.type]);
          const g = gainOf(l);
          if (g > bestG + 1e-9) { bestG = g; best = { i, l }; }
        }
        if (best) { p.x = X[best.i]; p.y = Y[best.i]; p.list = best.l; improved = true; }
        apply(p.list, +1);
      }
      if (!improved) break;
    }

    redeploy.forEach(previous => {
      const replacement = pilots.find(pilot =>
        pilot.type === previous.type && !Number.isFinite(pilot.previousX)
      );
      if (replacement) {
        replacement.id = previous.id;
        replacement.previousX = previous.x;
        replacement.previousY = previous.y;
      }
    });

    // --- statistiques
    let wTot = 0, wCov = 0;
    const cnt = [0, 0, 0], cov = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      wTot += W[i]; cnt[CAT[i]]++;
      if (covered[i] > 0) { wCov += W[i]; cov[CAT[i]]++; }
    }
    const pct = c => (cnt[c] ? cov[c] / cnt[c] : null);
    return {
      pilots: pilots.map(p => {
        const wasExisting = Number.isFinite(p.previousX) && Number.isFinite(p.previousY);
        const moved = wasExisting && (p.x !== p.previousX || p.y !== p.previousY);
        const status = p.fixed || (wasExisting && !moved)
          ? "maintained"
          : wasExisting ? "redeployed" : "new";
        return {
          id: p.id,
          type: p.type,
          x: p.x,
          y: p.y,
          radius: radii[p.type],
          locked: Boolean(p.fixed),
          status
        };
      }),
      stats: { weighted: wCov / wTot, path: pct(0), buffer: pct(1), poly: pct(2) }
    };
  }

  // Exposé pour les tests / usage externe
  global.DroneOptimizer = { buildDemand, optimize, extractLines, extractRings, CONFIG };
})(typeof window !== "undefined" ? window : globalThis);