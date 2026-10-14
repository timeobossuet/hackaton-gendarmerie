/* ==========================================================================
 * drones.js — Placement optimal de pilotes de drones (Algorithme autonome)
 * ========================================================================== */
(function (global) {
  "use strict";

  const CONFIG = {
    radii: { small: 1000, large: 2000 },
    targetPoints: 3000,
    minStep: 30,
    maxStep: 250,
    maxGridCandidates: 400,
    maxPathCandidates: 100,
    maxLocalSearchIter: 10,
    colors: { small: "#e51e64", large: "#8e24aa", collision: "#ff1744" }
  };

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
    return out;
  }

  function buildDemand(lines, rings, opts) {
    opts = opts || {};
    const R = opts.radius || 200, wPath = Math.max(1, opts.wPath || 10), wPoly = opts.wPoly || 1;

    const first = lines.length ? lines[0][0] : (rings.length ? rings[0][0] : [1.87, 43.09]);
    const proj = makeProjection(first[0], first[1]);
    const pLines = lines.map(l => l.map(c => proj.toXY(c[0], c[1])));
    const pRings = rings.map(r => r.map(c => proj.toXY(c[0], c[1])));

    const pathLen = pLines.reduce((s, l) => s + polylineLength(l), 0);
    const polyArea = pRings.reduce((s, r) => s + ringArea(r), 0);
    const area = (pLines.length ? 2 * R * pathLen + Math.PI * R * R : 0) + (polyArea || 1e6);
    let step = Math.sqrt(area / CONFIG.targetPoints);
    step = Math.min(CONFIG.maxStep, Math.max(CONFIG.minStep, Math.round(step / 10) * 10));

    const X = [], Y = [], W = [], CAT = [];

    // Points sur le tracé
    pLines.forEach(l => {
      samplePolyline(l, step).forEach(p => {
        X.push(p[0]); Y.push(p[1]); W.push(wPath); CAT.push(0);
      });
    });

    // Points dans les polygones
    for (const ring of pRings) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      ring.forEach(([x, y]) => {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      });
      for (let x = minX; x <= maxX; x += step) {
        for (let y = minY; y <= maxY; y += step) {
          if (pointInRing(x, y, ring)) {
            X.push(x); Y.push(y); W.push(wPoly); CAT.push(1);
          }
        }
      }
    }

    return {
      n: X.length,
      X: Float64Array.from(X),
      Y: Float64Array.from(Y),
      W: Float64Array.from(W),
      step,
      proj
    };
  }

  function optimize(demand, counts, radii) {
    const { n, X, Y, W } = demand;
    radii = radii || CONFIG.radii;
    const r2 = { small: radii.small * radii.small, large: radii.large * radii.large };

    // Positions candidates (échantillonnage de la demande)
    const kGrid = Math.max(1, Math.ceil(Math.sqrt(n / CONFIG.maxGridCandidates)));
    const cand = [];
    for (let i = 0; i < n; i += kGrid) cand.push(i);
    if (cand.length === 0 && n > 0) cand.push(0);

    const covered = new Uint8Array(n);
    const gainOf = (cx, cy, radiusSq) => {
      let g = 0;
      for (let i = 0; i < n; i++) {
        if (covered[i] === 0) {
          const dx = X[i] - cx, dy = Y[i] - cy;
          if (dx * dx + dy * dy <= radiusSq) g += W[i];
        }
      }
      return g;
    };

    const apply = (cx, cy, radiusSq, delta) => {
      for (let i = 0; i < n; i++) {
        const dx = X[i] - cx, dy = Y[i] - cy;
        if (dx * dx + dy * dy <= radiusSq) covered[i] += delta;
      }
    };

    // Ordre de placement : gros drones d'abord, puis petits
    const types = [];
    for (let i = 0; i < (counts.large || 0); i++) types.push("large");
    for (let i = 0; i < (counts.small || 0); i++) types.push("small");

    const pilots = [];
    for (const t of types) {
      let bestGain = -1, bestCandidate = cand[0] || 0;
      for (const ci of cand) {
        const g = gainOf(X[ci], Y[ci], r2[t]);
        if (g > bestGain) {
          bestGain = g;
          bestCandidate = ci;
        }
      }
      const px = X[bestCandidate], py = Y[bestCandidate];
      pilots.push({ type: t, x: px, y: py, radius: radii[t] });
      apply(px, py, r2[t], 1);
    }

    // Statistiques
    let wTot = 0, wCov = 0;
    for (let i = 0; i < n; i++) {
      wTot += W[i];
      if (covered[i] > 0) wCov += W[i];
    }

    return {
      pilots,
      stats: {
        weighted: wTot > 0 ? wCov / wTot : 0,
        poly: wTot > 0 ? wCov / wTot : 0
      }
    };
  }

  global.DroneOptimizer = {
    buildDemand,
    optimize,
    extractLines,
    extractRings,
    CONFIG
  };
})(typeof window !== "undefined" ? window : globalThis);

