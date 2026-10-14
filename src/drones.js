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

  function optimize(demand, counts, radii) {
    const { n, nPath, X, Y, W, CAT, GI, GJ, step } = demand;
    radii = radii || CONFIG.radii;
    const r2 = { small: radii.small * radii.small, large: radii.large * radii.large };
    const mod = (a, k) => ((a % k) + k) % k;

    // --- positions candidates (sous-échantillon des points de demande)
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
    const total = counts.small + counts.large;
    const pilots = [];
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
        apply(p.list, -1);
        let bestG = gainOf(p.list), best = null;
        for (let i = 0; i < n; i++) {
          const dx = X[i] - p.x, dy = Y[i] - p.y;
          if (dx * dx + dy * dy > refineR2) continue;
          const l = coverList(X[i], Y[i], r2[p.type]);
          const g = gainOf(l);
          if (g > bestG + 1e-9) { bestG = g; best = { i, l }; }
        }
        if (best) { p.x = X[best.i]; p.y = Y[best.i]; p.list = best.l; improved = true; }
        apply(p.list, +1);
      }
      if (!improved) break;
    }

    // --- statistiques
    let wTot = 0, wCov = 0;
    const cnt = [0, 0, 0], cov = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      wTot += W[i]; cnt[CAT[i]]++;
      if (covered[i] > 0) { wCov += W[i]; cov[CAT[i]]++; }
    }
    const pct = c => (cnt[c] ? cov[c] / cnt[c] : null);
    return {
      pilots: pilots.map(p => ({ type: p.type, x: p.x, y: p.y, radius: radii[p.type] })),
      stats: { weighted: wCov / wTot, path: pct(0), buffer: pct(1), poly: pct(2) }
    };
  }

  /* ======================================================================
   * 4. Affichage Leaflet + Turf (cercles et zones de collision)
   * ====================================================================== */

  let droneLayer = null;

  function intersectFeatures(a, b) {
    try { return turf.intersect(turf.featureCollection([a, b])); }   // Turf >= 7
    catch (e) {
      try { return turf.intersect(a, b); } catch (e2) { return null; } // Turf <= 6
    }
  }

  function render(pilots, proj) {
    if (!droneLayer) droneLayer = L.featureGroup().addTo(map);
    droneLayer.clearLayers();

    const placed = pilots.map((p, idx) => ({ ...p, idx, latlng: proj.toLatLng(p.x, p.y) }));

    // 1. cercles de couverture
    placed.forEach(p => {
      const color = CONFIG.colors[p.type];
      L.circle(p.latlng, {
        radius: p.radius, color, weight: 2, fillColor: color, fillOpacity: 0.12, interactive: false
      }).addTo(droneLayer);
    });

    // 2. zones de collision = intersections deux à deux (en rouge, au-dessus des cercles)
    let pairs = 0, collisionArea = 0;
    const circles = placed.map(p =>
      turf.circle([p.latlng[1], p.latlng[0]], p.radius / 1000, { steps: 72, units: "kilometers" })
    );
    for (let a = 0; a < placed.length; a++) {
      for (let b = a + 1; b < placed.length; b++) {
        const d = Math.hypot(placed[a].x - placed[b].x, placed[a].y - placed[b].y);
        if (d >= placed[a].radius + placed[b].radius) continue;
        const inter = intersectFeatures(circles[a], circles[b]);
        if (!inter) continue;
        pairs++;
        collisionArea += turf.area(inter);
        L.geoJSON(inter, {
          style: { color: CONFIG.colors.collision, weight: 1, fillColor: CONFIG.colors.collision, fillOpacity: 0.45 },
          interactive: false
        }).addTo(droneLayer);
      }
    }

    // 3. position des pilotes
    placed.forEach(p => {
      L.circleMarker(p.latlng, {
        radius: 7, color: "#ffffff", weight: 2, fillColor: CONFIG.colors[p.type], fillOpacity: 1
      }).bindTooltip(`Pilote ${p.radius / 1000} km (#${p.idx + 1})`).addTo(droneLayer);
    });

    return { pairs, collisionArea };
  }

  /* ======================================================================
   * 5. Interface + orchestration
   * ====================================================================== */

  function lancerOptimisation() {
    const $ = id => document.getElementById(id);
    const status = $("droneStatus");

    const gpx = typeof currentGpxGeoJson !== "undefined" ? currentGpxGeoJson : null;
    const R = typeof currentRadius !== "undefined" ? currentRadius : 200;
    const drawn = typeof zonesLayer !== "undefined" ? zonesLayer.getLayers().map(l => l.toGeoJSON()) : [];

    const lines = gpx ? extractLines(gpx) : [];
    const rings = extractRings(drawn);
    if (!lines.length && !rings.length) {
      status.textContent = "Importe un GPX et/ou dessine un polygone avant d'optimiser.";
      return;
    }

    const counts = {
      small: Math.max(0, parseInt($("nbSmall").value, 10) || 0),
      large: Math.max(0, parseInt($("nbLarge").value, 10) || 0)
    };
    if (counts.small + counts.large === 0) { status.textContent = "Mets au moins un pilote."; return; }
    if (counts.small + counts.large > 60) { status.textContent = "60 pilotes maximum."; return; }

    status.textContent = "Calcul en cours…";
    setTimeout(() => {
      const t0 = performance.now();
      const demand = buildDemand(lines, rings, {
        radius: R,
        wPath: parseFloat($("wPath").value) || 10,
        wPoly: parseFloat($("wPoly").value) || 1
      });
      const res = optimize(demand, counts);
      const col = render(res.pilots, demand.proj);
      const dt = ((performance.now() - t0) / 1000).toFixed(1);

      const pc = v => (v === null ? "—" : Math.round(v * 100) + " %");
      status.innerHTML =
        `<b>Couverture pondérée : ${pc(res.stats.weighted)}</b><br>` +
        `Chemin : ${pc(res.stats.path)} · Autour du chemin : ${pc(res.stats.buffer)} · Polygone : ${pc(res.stats.poly)}<br>` +
        `Collisions : ${col.pairs} chevauchement(s) ≈ ${(col.collisionArea / 1e6).toFixed(2)} km² ` +
        `(cumulé par paires) · pas de grille ${demand.step} m · ${demand.n} points · ${dt} s`;
    }, 30);
  }

  function effacer() {
    if (droneLayer) droneLayer.clearLayers();
    const s = document.getElementById("droneStatus");
    if (s) s.textContent = "";
  }

  function buildPanel() {
    const mapDiv = document.getElementById("map");
    if (!mapDiv) return;
    const panel = document.createElement("div");
    panel.style.cssText = "margin:10px;padding:10px;border:1px solid #ccc;border-radius:6px;font-family:sans-serif;";
    panel.innerHTML = `
      <b>Pilotes de drones</b><br>
      <label>Pilotes 1 km : <input type="number" id="nbSmall" value="3" min="0" max="30" style="width:50px"></label>
      <label style="margin-left:12px">Pilotes 2 km : <input type="number" id="nbLarge" value="2" min="0" max="30" style="width:50px"></label>
      <label style="margin-left:12px" title="Poids du chemin (le poids décroît jusqu'à 1 au bord du rayon)">Priorité chemin : <input type="number" id="wPath" value="10" min="1" max="100" style="width:50px"></label>
      <label style="margin-left:12px" title="Poids uniforme dans le polygone dessiné">Poids polygone : <input type="number" id="wPoly" value="1" min="0.1" max="100" step="0.1" style="width:50px"></label>
      <button id="btnOptimize" style="margin-left:12px">Optimiser le placement</button>
      <button id="btnClearDrones">Effacer</button>
      <div id="droneStatus" style="margin-top:8px;font-size:14px;"></div>`;
    mapDiv.parentNode.insertBefore(panel, mapDiv);
    document.getElementById("btnOptimize").addEventListener("click", lancerOptimisation);
    document.getElementById("btnClearDrones").addEventListener("click", effacer);
  }

  if (typeof document !== "undefined") buildPanel();

  // Exposé pour les tests / usage externe
  global.DroneOptimizer = { buildDemand, optimize, extractLines, extractRings, CONFIG };
})(typeof window !== "undefined" ? window : globalThis);
