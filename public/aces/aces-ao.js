// ACES — per-vertex ambient occlusion bake.
//
// Casts short hemisphere rays from every vertex against the whole creature
// (uniform-grid accelerated Möller–Trumbore) and multiplies the occlusion into
// the supplied vertex-colour arrays. Meshes without vertex colours get their
// flat material colour expanded into COLOR_0 first, so AO always lands in the
// same attribute.
//
// Runs at compile time in the bind pose; skinned deformation inherits it.
//
// Author: Ariescar (anyCreature) ported to the RDJ low_poly_3d browser
// surface. Zero dependencies. Browser + Node compatible.

'use strict';

const { vertexNormals } = (typeof require !== 'undefined' && typeof module !== 'undefined')
  ? require('./aces-normals.js')
  : (typeof window !== 'undefined' ? window.ACES_normals : null);

const { hex2lin } = (typeof require !== 'undefined' && typeof module !== 'undefined')
  ? require('./aces-oklab.js')
  : (typeof window !== 'undefined' ? window.ACES_oklab : null);

function triangulate(F) {
  const out = [];
  for (const f of F) {
    if (f.length === 3) out.push(f);
    else if (f.length === 4) {
      out.push([f[0], f[1], f[2]]);
      out.push([f[0], f[2], f[3]]);
    }
  }
  return out;
}

// Bake AO into a list of mesh objects of the shape:
//   { V: [[x,y,z]...], F: [[i0,i1,i2]...], C?: [[r,g,b]...], color?: "#rrggbb" }
// The supplied C arrays ARE MUTATED in place. AO factor is also written to
// m.AO[vi] for downstream consumers (L6/L7 shading, calibration, debug).
//
// cfg keys:
//   samples   — hemisphere ray count (default 16)
//   strength  — max darkening (default 0.59)
//   radius    — ray length; auto = 60% of model diagonal
//   multiply  — true: AO * colour written to m.C[vi]
//               false: AO written to m.AO[vi] only (downstream applies it)
//   skip      — optional (vi) => boolean, vertex excluded from bake
function bakeAO(meshes, cfg) {
  if (cfg === false) return { baked: false };
  const opt = typeof cfg === 'object' && cfg ? cfg : {};
  const SAMPLES = opt.samples ?? 16;
  const STRENGTH = opt.strength ?? 0.59;
  const MULT = opt.multiply !== false;
  const skip = opt.skip || (() => false);

  // ── triangle soup + bounds ──
  const tris = [];
  const lo = [1e9, 1e9, 1e9];
  const hi = [-1e9, -1e9, -1e9];
  for (const m of meshes) {
    for (const v of m.V) for (let k = 0; k < 3; k++) {
      if (v[k] < lo[k]) lo[k] = v[k];
      if (v[k] > hi[k]) hi[k] = v[k];
    }
    for (const [a, b, c] of triangulate(m.F)) {
      tris.push([m.V[a], m.V[b], m.V[c]]);
    }
  }
  if (!tris.length) return { baked: false };
  const diag = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  const RADIUS = opt.radius ?? diag * 0.6;
  const EPS = diag * 1e-4;

  // ── uniform grid over the soup ──
  const RES = 24;
  const cs = [0, 1, 2].map((k) => (hi[k] - lo[k]) / RES || 1e-6);
  const cellOf = (p, k) => Math.max(0, Math.min(RES - 1, Math.floor((p[k] - lo[k]) / cs[k])));
  const grid = new Map();
  tris.forEach((t, ti) => {
    const tl = [0, 1, 2].map((k) => Math.min(t[0][k], t[1][k], t[2][k]));
    const th = [0, 1, 2].map((k) => Math.max(t[0][k], t[1][k], t[2][k]));
    for (let x = cellOf(tl, 0); x <= cellOf(th, 0); x++) {
      for (let y = cellOf(tl, 1); y <= cellOf(th, 1); y++) {
        for (let z = cellOf(tl, 2); z <= cellOf(th, 2); z++) {
          const key = (x * RES + y) * RES + z;
          let b = grid.get(key);
          if (!b) grid.set(key, (b = []));
          b.push(ti);
        }
      }
    }
  });

  // Möller–Trumbore. Returns hit distance or 0.
  const rayTri = (o, d, t, tmax) => {
    const [p0, p1, p2] = t;
    const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const pv = [
      d[1] * e2[2] - d[2] * e2[1],
      d[2] * e2[0] - d[0] * e2[2],
      d[0] * e2[1] - d[1] * e2[0],
    ];
    const det = e1[0] * pv[0] + e1[1] * pv[1] + e1[2] * pv[2];
    if (Math.abs(det) < 1e-12) return 0;
    const inv = 1 / det;
    const tv = [o[0] - p0[0], o[1] - p0[1], o[2] - p0[2]];
    const u = (tv[0] * pv[0] + tv[1] * pv[1] + tv[2] * pv[2]) * inv;
    if (u < 0 || u > 1) return 0;
    const qv = [
      tv[1] * e1[2] - tv[2] * e1[1],
      tv[2] * e1[0] - tv[0] * e1[2],
      tv[0] * e1[1] - tv[1] * e1[0],
    ];
    const v = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) * inv;
    if (v < 0 || u + v > 1) return 0;
    const dist = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) * inv;
    return dist > EPS && dist < tmax ? dist : 0;
  };

  const occluded = (o, d) => {
    const steps = Math.ceil(RADIUS / Math.min(cs[0], cs[1], cs[2]));
    const seen = new Set();
    let last = -1;
    for (let s = 0; s <= steps; s++) {
      const t = (s / steps) * RADIUS;
      const p = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
      const key = (cellOf(p, 0) * RES + cellOf(p, 1)) * RES + cellOf(p, 2);
      if (key === last) continue;
      last = key;
      const bucket = grid.get(key);
      if (!bucket) continue;
      for (const ti of bucket) {
        if (seen.has(ti)) continue;
        seen.add(ti);
        if (rayTri(o, d, tris[ti], RADIUS)) return true;
      }
    }
    return false;
  };

  // ── fixed cosine-weighted hemisphere kernel (deterministic, no RNG) ──
  const kernel = [];
  const GA = Math.PI * (3 - Math.sqrt(5)); // golden angle
  for (let i = 0; i < SAMPLES; i++) {
    const z = Math.sqrt((i + 0.5) / SAMPLES); // bias toward the normal
    const r = Math.sqrt(1 - z * z);
    const a = GA * i;
    kernel.push([Math.cos(a) * r, Math.sin(a) * r, z]);
  }

  // ── bake per mesh ──
  let vcount = 0;
  let occSum = 0;
  for (const m of meshes) {
    const N = vertexNormals(m.V, triangulate(m.F));
    if (!m.C) m.C = m.V.map(() => hex2lin(m.color || '#888888'));
    if (!m.AO) m.AO = [];
    m.V.forEach((v, vi) => {
      if (skip(vi)) {
        m.AO[vi] = 1;
        return;
      }
      const n = N[vi];
      // tangent frame
      const ax = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
      let tx = [
        n[1] * ax[2] - n[2] * ax[1],
        n[2] * ax[0] - n[0] * ax[2],
        n[0] * ax[1] - n[1] * ax[0],
      ];
      const tl = Math.hypot(tx[0], tx[1], tx[2]);
      tx = [tx[0] / tl, tx[1] / tl, tx[2] / tl];
      const ty = [
        n[1] * tx[2] - n[2] * tx[1],
        n[2] * tx[0] - n[0] * tx[2],
        n[0] * tx[1] - n[1] * tx[0],
      ];
      const o = [v[0] + n[0] * EPS * 4, v[1] + n[1] * EPS * 4, v[2] + n[2] * EPS * 4];
      let hits = 0;
      for (const [kx, ky, kz] of kernel) {
        const d = [
          tx[0] * kx + ty[0] * ky + n[0] * kz,
          tx[1] * kx + ty[1] * ky + n[1] * kz,
          tx[2] * kx + ty[2] * ky + n[2] * kz,
        ];
        if (occluded(o, d)) hits++;
      }
      const occ = hits / SAMPLES;
      const ao = 1 - STRENGTH * occ;
      m.AO[vi] = ao;
      if (MULT) {
        const c = m.C[vi];
        m.C[vi] = [c[0] * ao, c[1] * ao, c[2] * ao];
      }
      vcount++;
      occSum += occ;
    });
  }
  return { baked: true, verts: vcount, meanOcc: vcount ? occSum / vcount : 0 };
}

const api = { bakeAO, triangulate };

if (typeof window !== 'undefined') window.ACES_ao = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
