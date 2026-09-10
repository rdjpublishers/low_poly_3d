// ACES — vertex-colour shading stack (L1–L8).
//
// Eight layers, each a pure function of position and classification. No
// randomness, no dates — the same spec compiles to the same bytes. The
// numbers in DEFAULTS are the values a measured run settled on against six
// real creatures; every removed control was removed because it MEASURED as
// dead.
//
//   L1  seam-safe flesh colour     (position-based spatial smoothing, radius
//                                  tied to median edge length)
//   L2  pattern                    (deterministic value noise, flesh only)
//   L3  top-to-bottom ramp         (multiplies in OKLab — lightness and
//                                  chroma are independent, so this is just
//                                  two numbers, not a blend mode)
//   L4  brighten AND saturate up top  (in OKLab, the two quantities are
//                                  independent; in any RGB blend mode,
//                                  brightening moves toward white, and
//                                  white has chroma 0 — so every mode LOSES
//                                  chroma while gaining lightness. A
//                                  measured run had every blend mode's
//                                  delta-chroma negative.)
//   L5  hardware bleeds into flesh (sharp-edge design is preserved on the
//                                  hardware, just darkened around it)
//   L6  hardware shadow            (AO only, exponent = hardsh.gamma)
//   L7  flesh body shadow          (horizontal light ring × AO)
//   L8  bone-field NORMAL softening  (flesh only, the only layer that leaves
//                                  COLOR_0 and goes into the file's NORMAL
//                                  — the user's lighting reacts to it)
//
// Features (eyes, teeth, tongue, etc.) take no layer and no shadow.
//
// Author: Ariescar (anyCreature) ported to the RDJ low_poly_3d browser
// surface. Operates on plain {V, F, C, N, AO, _cls} mesh records.

'use strict';

const oklab = (typeof require !== 'undefined' && typeof module !== 'undefined')
  ? require('./aces-oklab.js')
  : (typeof window !== 'undefined' ? window.ACES_oklab : null);

const { lin2oklab, oklab2lin, inGamut, hex2lab, ss, mixOK, vnoise3, walkChromaToEdge } = oklab;

// ── settled values ─────────────────────────────────────────────────────────
const DEFAULTS = {
  seam: { radius_edges: 3, min_frac: 0.030 },
  pattern: { color: null, sharpness: 0.45, amount: 1.0, scale: 0.06 },
  ramp: {
    bottom: '#001370',
    mid: '#cfcfcf',
    top: '#fffcf0',
    p0: 0.0,
    pm: 0.31,
    wm: 0.08,
    p1: 1.0,
    sh0: 0.0,
    sh1: 0.0,
    chroma: 1.0,
    amount: 1.0,
  },
  boost: {
    y0: 0.0,
    y1: 0.4,
    gamma: 0.3,
    dL: 0.03,
    dC: 1.5,
    amount: 1.0,
    target: 'all',
  },
  bleed: { radius: 0.025, sharpness: 0.35, amount: 0.45 },
  hardsh: { amount: 0.54, gamma: 0.7 },
  bodysh: { lights: 4, rot: 4, elev: 17, amount: 0.2, gamma: 1.95 },
  normals: { flesh: 0.9 },
};

// ── classification ─────────────────────────────────────────────────────────
const HARD_TYPES = new Set(['spike', 'curve', 'membrane', 'fin']);
const FX_MATERIAL = /^(eye|pupil|iris|sclera|nose|nostril|tooth|teeth|tongue)/i;

function classOf(m, declared) {
  if (declared) return declared; // spec wins, always
  if (m.partType === 'eye' || FX_MATERIAL.test(m.material || '')) return 'fx';
  if (m.partType && HARD_TYPES.has(m.partType)) return 'hard';
  return 'flesh'; // volumes, hands, paws
}

// Read `shade` off the spec for each mesh: per-part, then per-volume. The map
// value is a string ('flesh' | 'hard' | 'fx') OR an object with one of those
// keys. Volume label is the chain name; part label is name or 'type@host'.
function declaredClasses(spec) {
  const byName = new Map();
  for (const v of spec.volumes || []) if (v.shade) byName.set(v.chain, v.shade);
  for (const p of spec.parts || []) {
    if (!p.shade) continue;
    const label = p.name || `${p.type}@${p.host || 'ribs'}`;
    byName.set(label, p.shade);
    byName.set(label + '.R', p.shade);
  }
  return byName;
}

function resolveClassName(shade) {
  if (typeof shade === 'string') return shade;
  if (shade && typeof shade === 'object') {
    if (shade.class) return shade.class;
    // take the first key that matches a known class
    for (const k of ['flesh', 'hard', 'fx']) if (shade[k]) return k;
  }
  return null;
}

// ── spatial grid (L1 flesh smoothing + L5 hardware bleed use the same query) ──
function grid(points, cell) {
  const g = new Map();
  const key = (a, b, c) => a + ',' + b + ',' + c;
  const idx = (p) => [Math.floor(p[0] / cell), Math.floor(p[1] / cell), Math.floor(p[2] / cell)];
  points.forEach((p, i) => {
    const [a, b, c] = idx(p.v);
    const k = key(a, b, c);
    let bin = g.get(k);
    if (!bin) g.set(k, (bin = []));
    bin.push(i);
  });
  return {
    near(v, r) {
      const out = [];
      const [a, b, c] = idx(v);
      const s = Math.ceil(r / cell);
      for (let x = a - s; x <= a + s; x++) {
        for (let y = b - s; y <= b + s; y++) {
          for (let z = c - s; z <= c + s; z++) {
            const bin = g.get(key(x, y, z));
            if (bin) out.push(...bin);
          }
        }
      }
      return out;
    },
  };
}

// Median edge length across every mesh — the L1 sampling ruler.
function medianEdge(meshes, diag) {
  const L = [];
  for (const m of meshes) {
    for (const f of m.F || []) {
      for (let k = 0; k < f.length; k++) {
        const a = m.V[f[k]];
        const b = m.V[f[(k + 1) % f.length]];
        L.push(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
      }
    }
  }
  if (!L.length) return diag * 0.02;
  L.sort((x, y) => x - y);
  return L[Math.floor(L.length * 0.5)] || diag * 0.02;
}

// ── the stack ──────────────────────────────────────────────────────────────
//
// cfg = spec.shading. The 7 sub-configs (seam/pattern/ramp/boost/bleed/hardsh/
// bodysh) are optional; defaults come from the values a measured run settled
// on. `cfg.stack === false` opts the whole stack OUT (legacy mode, callers
// fall back to gradient + noise — see the implementation in low_poly_3d's
// existing renderer).
//
// INFO is an array of strings the caller can print or surface in the UI.
// N_OUT is the optional out-array for L8-softened NORMAL arrays. Each entry
// is { mesh, idx, normal } for downstream consumers.
function shadeStack(meshes, cfg, INFO) {
  if (cfg && cfg.stack === false) return { applied: false };
  if (!INFO) INFO = [];
  const on = (k) => cfg && cfg[k] !== false && cfg[k] !== 0;
  const P = (k) => Object.assign({}, DEFAULTS[k], (cfg && cfg[k] && typeof cfg[k] === 'object') ? cfg[k] : {});

  const live = meshes.filter((m) => m.V && m.V.length);
  if (!live.length) return { applied: false };

  // class first; we use it every layer
  const declared = (cfg && cfg._declared) || new Map();
  for (const m of live) {
    const dc = declared.get(m.part || m.chain);
    m._cls = classOf(m, resolveClassName(dc));
  }
  const counts = { flesh: 0, hard: 0, fx: 0 };
  const byClass = { flesh: new Set(), hard: new Set(), fx: new Set() };
  for (const m of live) {
    counts[m._cls] += m.V.length;
    byClass[m._cls].add(m.part || m.chain || m.material || '?');
  }
  for (const k of ['flesh', 'hard', 'fx']) {
    if (byClass[k].size) {
      INFO.push(`shade class ${k}: ${[...byClass[k]].sort().join(', ')}`);
    }
  }

  // every vertex, flattened, with a back-pointer
  const pts = [];
  for (const m of live) m.V.forEach((v, i) => pts.push({ v, m, i, cls: m._cls }));

  // colour in OKLab, per vertex, starting from the mesh's own colour
  for (const m of live) {
    if (!m.C) m.C = m.V.map(() => null);
    for (let i = 0; i < m.V.length; i++) {
      const c = m.C[i];
      m.C[i] = c ? lin2oklab(c) : hex2lab(m.color || '#888888');
    }
  }

  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const m of live) for (const v of m.V) for (let k = 0; k < 3; k++) {
    if (v[k] < lo[k]) lo[k] = v[k];
    if (v[k] > hi[k]) hi[k] = v[k];
  }
  const diag = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[1] === hi[1] ? 1 : hi[2] - lo[2]) || 1;
  const y0 = lo[1];
  const yr = (hi[1] - lo[1]) || 1e-6;

  // ── L1: seam-safe flesh colour ──────────────────────────────────────
  if (on('seam') !== false) {
    const sp = P('seam');
    const edge = medianEdge(live, diag);
    const R = Math.max(sp.min_frac * diag, edge * sp.radius_edges);
    const fleshPts = pts.filter((p) => p.cls === 'flesh');
    if (fleshPts.length) {
      const gg = grid(fleshPts, R);
      const out = new Array(fleshPts.length);
      const r2 = R * R;
      const sig2 = (R / 2) * (R / 2);
      fleshPts.forEach((p, n) => {
        let wsum = 0;
        const acc = [0, 0, 0];
        for (const j of gg.near(p.v, R)) {
          const q = fleshPts[j];
          const dx = q.v[0] - p.v[0];
          const dy = q.v[1] - p.v[1];
          const dz = q.v[2] - p.v[2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > r2) continue;
          const w = Math.exp(-d2 / (2 * sig2));
          const c = q.m.C[q.i];
          acc[0] += c[0] * w;
          acc[1] += c[1] * w;
          acc[2] += c[2] * w;
          wsum += w;
        }
        out[n] = wsum > 0 ? [acc[0] / wsum, acc[1] / wsum, acc[2] / wsum] : p.m.C[p.i];
      });
      fleshPts.forEach((p, n) => {
        p.m.C[p.i] = out[n];
      });
      INFO.push(
        `shade L1: flesh colour smoothed across parts, r=${((R / diag) * 100).toFixed(1)}% of diagonal (${(R / edge).toFixed(1)}x median edge) — seams cannot survive a position function`,
      );
    }
  }

  // ── L2: pattern ─────────────────────────────────────────────────────
  const pat = P('pattern');
  if (pat.color) {
    const PC = hex2lab(pat.color);
    const w = Math.max(0.02, 0.55 * (1 - pat.sharpness));
    const cell = Math.max(1e-6, pat.scale * diag);
    for (const p of pts) {
      if (p.cls !== 'flesh') continue;
      const n = vnoise3(p.v, cell);
      const t = pat.amount * ss(0.5 - w, 0.5 + w, n);
      if (t > 0) p.m.C[p.i] = mixOK(p.m.C[p.i], PC, t);
    }
    INFO.push(`shade L2: pattern ${pat.color} at ${(pat.amount * 100) | 0}% on flesh`);
  }

  // ── L3: top-to-bottom ramp, multiplied over everything ─────────────
  const rp = P('ramp');
  const A = hex2lab(rp.bottom);
  const MM = hex2lab(rp.mid);
  const B = hex2lab(rp.top);
  const half = Math.max(0, rp.wm) / 2;
  const e0 = Math.min(rp.p1, Math.max(rp.p0, rp.pm - half));
  const e1 = Math.min(rp.p1, Math.max(e0, rp.pm + half));
  const lo0 = rp.p0 + (e0 - rp.p0) * rp.sh0;
  const hi0 = e0;
  const lo1 = e1;
  const hi1 = rp.p1 - (rp.p1 - e1) * rp.sh1;
  const bandAt = (y) => {
    const b0 = hi0 - lo0 < 1e-6 ? (y >= e0 ? 1 : 0) : ss(lo0, hi0, y);
    const b1 = hi1 - lo1 < 1e-6 ? (y >= e1 ? 1 : 0) : ss(lo1, hi1, y);
    let c = mixOK(A, MM, b0);
    c = mixOK(c, B, b1);
    return [c[0], c[1] * rp.chroma, c[2] * rp.chroma];
  };
  if (rp.amount > 0) {
    for (const p of pts) {
      if (p.cls === 'fx') continue;
      const y = (p.v[1] - y0) / yr;
      const band = bandAt(y);
      const c = p.m.C[p.i];
      const t = rp.amount;
      p.m.C[p.i] = [
        c[0] * (1 - t) + c[0] * band[0] * t,
        c[1] * (1 - t) + (c[1] * band[0] + band[1] * c[0]) * t,
        c[2] * (1 - t) + (c[2] * band[0] + band[2] * c[0]) * t,
      ];
    }
    INFO.push(`shade L3: ramp ${rp.bottom} -> ${rp.mid} @${rp.pm} -> ${rp.top}, multiply ${(rp.amount * 100) | 0}%`);
  }

  // ── L4: brighten AND saturate the upper region ─────────────────────
  const bo = P('boost');
  if (bo.amount > 0 && (bo.dL !== 0 || bo.dC !== 1)) {
    let clipped = 0;
    let touched = 0;
    for (const p of pts) {
      if (p.cls === 'fx') continue;
      if (bo.target === 'flesh' && p.cls !== 'flesh') continue;
      const y = (p.v[1] - y0) / yr;
      let t = ss(bo.y0, bo.y1, y);
      if (bo.gamma !== 1) t = Math.pow(t, bo.gamma);
      if (t <= 0) continue; // identity, by construction
      touched++;
      const c = p.m.C[p.i];
      const w = bo.amount * t;
      const L = Math.min(1, c[0] + bo.dL * w);
      let k = 1 + (bo.dC - 1) * w;
      if (!inGamut([L, c[1] * k, c[2] * k])) {
        clipped++;
        k = walkChromaToEdge(c[1], c[1], c[2], L);
      }
      p.m.C[p.i] = [L, c[1] * k, c[2] * k];
    }
    INFO.push(
      `shade L4: boost dL+${bo.dL} chroma x${bo.dC} above y=${bo.y0}..${bo.y1}; ${touched} vertices touched, ${clipped} walked back to the gamut edge (0 clamped)`,
    );
  }

  // ── L5: hardware bleeds into the flesh around it ───────────────────
  const bl = P('bleed');
  const hardPts = pts.filter((p) => p.cls === 'hard');
  if (bl.amount > 0 && hardPts.length) {
    const R = bl.radius * diag;
    const gg = grid(hardPts, R);
    let hit = 0;
    for (const p of pts) {
      if (p.cls !== 'flesh') continue;
      let best = -1;
      let bestD = Infinity;
      for (const j of gg.near(p.v, R)) {
        const q = hardPts[j];
        const d = Math.hypot(q.v[0] - p.v[0], q.v[1] - p.v[1], q.v[2] - p.v[2]);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      if (best < 0 || bestD >= R) continue;
      const k = Math.pow(Math.max(0, 1 - bestD / R), 1 + 8 * bl.sharpness);
      const q = hardPts[best];
      p.m.C[p.i] = mixOK(p.m.C[p.i], q.m.C[q.i], bl.amount * k);
      hit++;
    }
    INFO.push(`shade L5: hardware bled into ${hit} flesh vertices within ${(bl.radius * 100).toFixed(1)}% of diagonal`);
  }

  // ── L6 / L7: shading, mutually exclusive by class ──────────────────
  const hs = P('hardsh');
  const bs = P('bodysh');
  const ring = [];
  for (let i = 0; i < Math.max(1, bs.lights | 0); i++) {
    const az = ((bs.rot + (i * 360) / Math.max(1, bs.lights | 0)) * Math.PI) / 180;
    const el = (bs.elev * Math.PI) / 180;
    ring.push([Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)]);
  }
  let shaded = 0;
  for (const m of live) {
    if (m._cls === 'fx') continue;
    for (let i = 0; i < m.V.length; i++) {
      const ao = m.AO ? m.AO[i] : 1;
      let sh;
      if (m._cls === 'hard') {
        const a = hs.gamma === 1 ? ao : Math.pow(ao, hs.gamma);
        sh = 1 - hs.amount * (1 - a);
      } else {
        const n = m.N ? m.N[i] : [0, 1, 0];
        let sum = 0;
        for (const L of ring) sum += Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
        let v = Math.max(0, Math.min(1, (sum / ring.length) * ao));
        if (bs.gamma !== 1) v = Math.pow(v, bs.gamma);
        sh = 1 - bs.amount * (1 - v);
      }
      m.C[i] = [m.C[i][0] * sh, m.C[i][1], m.C[i][2]];
      shaded++;
    }
  }
  INFO.push(
    `shade L6/L7: ${ring.length}-light ring x AO — hardware ${(hs.amount * 100) | 0}%, flesh ${(bs.amount * 100) | 0}% over ${shaded} vertices`,
  );

  INFO.push(
    `shade: ${counts.flesh} flesh / ${counts.hard} hardware / ${counts.fx} feature vertices (features take no layer and no shadow)`,
  );

  // back to linear RGB for COLOR_0
  for (const m of live) {
    for (let i = 0; i < m.C.length; i++) m.C[i] = oklab2lin(m.C[i]);
  }

  return { applied: true, counts, byClass: { flesh: [...byClass.flesh], hard: [...byClass.hard], fx: [...byClass.fx] } };
}

// L8: bone-field NORMAL softening (flesh only).
// Returns an array of { mesh, idx, normal } describing which vertices were
// touched. Caller can apply the softened normal to the rendered geometry.
function softenNormalsByBones(meshes, skeleton, cfg) {
  const c = cfg || {};
  const alpha = c.flesh ?? 0.9;
  if (alpha <= 0) return { touched: 0 };
  let touched = 0;
  for (const m of meshes) {
    if (m._cls !== 'flesh') continue;
    if (!m.skin || !skeleton) continue;
    for (let i = 0; i < m.V.length; i++) {
      const infl = m.skin[i];
      if (!infl || !infl.length) continue;
      let px = 0, py = 0, pz = 0, w = 0;
      for (const [j, wt] of infl) {
        const k = skeleton.index ? skeleton.index[j] : undefined;
        if (k == null) continue;
        const q = skeleton.joints[k].pos;
        px += q[0] * wt;
        py += q[1] * wt;
        pz += q[2] * wt;
        w += wt;
      }
      if (!w) continue;
      const dx = m.V[i][0] - px / w;
      const dy = m.V[i][1] - py / w;
      const dz = m.V[i][2] - pz / w;
      const L = Math.hypot(dx, dy, dz);
      if (L < 1e-9) continue;
      const f = [dx / L, dy / L, dz / L];
      const n = m.N ? m.N[i] : [0, 1, 0];
      // never let the blend cross to the back of the surface
      if (n[0] * f[0] + n[1] * f[1] + n[2] * f[2] <= 0) continue;
      const b = [
        n[0] * (1 - alpha) + f[0] * alpha,
        n[1] * (1 - alpha) + f[1] * alpha,
        n[2] * (1 - alpha) + f[2] * alpha,
      ];
      const Lb = Math.hypot(b[0], b[1], b[2]);
      if (Lb < 1e-9) continue;
      if (m.N) {
        m.N[i] = [b[0] / Lb, b[1] / Lb, b[2] / Lb];
        touched++;
      }
    }
  }
  return { touched };
}

const api = {
  DEFAULTS,
  classOf,
  declaredClasses,
  resolveClassName,
  shadeStack,
  softenNormalsByBones,
  medianEdge,
  grid,
};

if (typeof window !== 'undefined') window.ACES_shade = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
