// MT — Modeling Techniques noise + PRNG helpers.
//
// Deterministic shared helpers used by EVERY mt-*.js module below.
// Same hash-bashed determinism contract as PART 74 — see that file for
// the rationale. Exposed as window.MT_noise.
//
//   mulberry32(seed)        — PRNG: 0..1, period 2^32, seed-deterministic
//   splitmix32(seed)        — 32-bit hash → 32-bit state
//   deriveSubSeed(seed,...) — hash-derived child seed (FNV-1a)
//   fnv1a(str|int)          — 32-bit FNV-1a hash for stable identity
//   valueNoise2D(x,y,seed)  — 2D smooth value noise
//   fbm2D(x,y,octaves,...)  — Fractional Brownian Motion
//   voronoi2D(x,y,seed)     — F1 distance
//   perlin3D(x,y,z,seed)    — Perlin gradient noise
//   simplex2D(x,y,seed)     — 2D simplex noise
//   rngSphere(seed)         — uniform unit-sphere sampling
//   rngBox(rng,w,h,d)       — uniform box sampling
//   rngLattice(rng,R)       — uniform lattice point inside radius R
//
// Author: Mavis / RDJ Publishers low_poly_3d renderer surface.
// Part of: 44-Technique Modeling Bundle (Mavis PART 100-143).

'use strict';

(function (root) {
  // ---------- Hash & PRNG --------------------------------------------------
  function mulberry32(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function splitmix32(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x9E3779B9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85EBCA6B) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xC2B2AE35) >>> 0;
      return (z ^ (z >>> 16)) >>> 0;
    };
  }

  function fnv1a(input) {
    let h = 0x811C9DC5 >>> 0;
    const s = (typeof input === 'string') ? input : String(input);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    // also fold the numeric seed for numeric inputs so two ints with the same
    // string representation never collide on different seeds
    if (typeof input === 'number') {
      h ^= ((input >>> 0) ^ 0x9E3779B9) >>> 0;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function deriveSubSeed(parent, ...keys) {
    let h = (typeof parent === 'number') ? (parent >>> 0) : fnv1a(parent);
    for (let i = 0; i < keys.length; i++) {
      h ^= fnv1a(keys[i]);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  // ---------- 2D / 3D noise ------------------------------------------------
  const PERM = (() => {
    const p = new Uint8Array(512);
    const rng = mulberry32(1337);
    const a = new Uint8Array(256);
    for (let i = 0; i < 256; i++) a[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    for (let i = 0; i < 512; i++) p[i] = a[i & 255];
    return p;
  })();

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function grad3(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  function perlin3D(x, y, z, seed) {
    const s = (seed >>> 0) || 0;
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    const px = PERM[(X + s) & 255] + Y, py = PERM[X & 255] + Z;
    const p0 = PERM[px & 255] + Z;
    const p1 = PERM[(px + 1) & 255] + Z;
    const p2 = PERM[py & 255] + Z;
    const p3 = PERM[(py + 1) & 255] + Z;
    const u = fade(x - Math.floor(x));
    const v = fade(y - Math.floor(y));
    const w = fade(z - Math.floor(z));
    return lerp(
      lerp(
        lerp(grad3(PERM[p0 & 255], x, y, z), grad3(PERM[p1 & 255], x - 1, y, z), u),
        lerp(grad3(PERM[(p0 + 1) & 255], x, y - 1, z), grad3(PERM[(p1 + 1) & 255], x - 1, y - 1, z), u),
        v),
      lerp(
        lerp(grad3(PERM[p2 & 255], x, y, z - 1), grad3(PERM[p3 & 255], x - 1, y, z - 1), u),
        lerp(grad3(PERM[(p2 + 1) & 255], x, y - 1, z - 1), grad3(PERM[(p3 + 1) & 255], x - 1, y - 1, z - 1), u),
        v),
      w);
  }

  function valueNoise2D(x, y, seed) {
    const s = (seed >>> 0) || 0;
    const X = Math.floor(x), Y = Math.floor(y);
    const fx = x - X, fy = y - Y;
    const ix = X & 255, iy = Y & 255;
    const p = PERM;
    const n00 = (p[(ix + s) & 255 + ((iy + s) & 255)] / 255) * 2 - 1;
    const n10 = (p[((ix + 1) + s) & 255 + ((iy + s) & 255)] / 255) * 2 - 1;
    const n01 = (p[(ix + s) & 255 + (((iy + 1) + s) & 255)] / 255) * 2 - 1;
    const n11 = (p[((ix + 1) + s) & 255 + (((iy + 1) + s) & 255)] / 255) * 2 - 1;
    const u = fade(fx), v = fade(fy);
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
  }

  function fbm2D(x, y, octaves, persistence, lacunarity, seed) {
    const o = octaves || 4;
    const p = persistence || 0.5;
    const l = lacunarity || 2.0;
    const s = (seed >>> 0) || 0;
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < o; i++) {
      sum += amp * valueNoise2D(x * freq, y * freq, deriveSubSeed(s, i));
      norm += amp;
      amp *= p;
      freq *= l;
    }
    return sum / norm;
  }

  function voronoi2D(x, y, seed) {
    const s = (seed >>> 0) || 0;
    const cx = Math.floor(x), cy = Math.floor(y);
    let f1 = Infinity, f2 = Infinity;
    const rng = mulberry32(deriveSubSeed(s, cx, cy));
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ox = rng(), oy = rng();
        const px = cx + dx + ox, py = cy + dy + oy;
        const ddx = x - px, ddy = y - py;
        const d = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d < f1) { f2 = f1; f1 = d; }
        else if (d < f2) { f2 = d; }
      }
    }
    return { f1, f2, edge: f2 - f1 };
  }

  function simplex2D(x, y, seed) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const s = (seed >>> 0) || 0;
    const sk = F2 * (x + y);
    const i = Math.floor(x + sk), j = Math.floor(y + sk);
    const t = G2 * (i + j);
    const X0 = i - t, Y0 = j - t;
    const x0 = x - X0, y0 = y - Y0;
    let i1 = 0, j1 = 0;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    function corner(gx, gy, gi) {
      const t = 0.5 - gx * gx - gy * gy;
      if (t < 0) return 0;
      const gi_ = (PERM[(ii + gi) & 255] + jj) & 255;
      const gii = (PERM[(gi_ + s) & 255] % 12);
      const gr = grad3(gii, gx, gy, 0);
      return Math.pow(t, 4) * gr;
    }
    const n0 = corner(x0, y0, 0);
    const n1 = corner(x1, y1, 1);
    const n2 = corner(x2, y2, 2);
    return 70 * (n0 + n1 + n2);
  }

  // ---------- uniform samplers --------------------------------------------
  function rngSphere(rng) {
    const u = rng() * 2 - 1;
    const phi = rng() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    return [r * Math.cos(phi), r * Math.sin(phi), u];
  }

  function rngBox(rng, w, h, d) {
    return [(rng() - 0.5) * w, (rng() - 0.5) * h, (rng() - 0.5) * d];
  }

  function rngLattice(rng, R) {
    while (true) {
      const x = (rng() * 2 - 1) * R;
      const y = (rng() * 2 - 1) * R;
      const z = (rng() * 2 - 1) * R;
      if (x * x + y * y + z * z <= R * R) return [x, y, z];
    }
  }

  const api = {
    mulberry32,
    splitmix32,
    fnv1a,
    deriveSubSeed,
    perlin3D,
    valueNoise2D,
    fbm2D,
    voronoi2D,
    simplex2D,
    rngSphere,
    rngBox,
    rngLattice,
  };

  if (typeof window !== 'undefined') window.MT_noise = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
