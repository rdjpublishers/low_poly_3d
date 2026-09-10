// ACES — calibration fixtures (sample meshes for the self-check page).
//
// Three cases that prove the checks separate good from bad on this machine:
//   1. sphere_green   — a UV-sphere with a 7-segment chain down the middle.
//                       Must PASS: smooth mass, body has real creases, all
//                       the geometric checks are quiet.
//   2. box_50_50      — two boxes stacked 50:50, no offset. Must BLOCK on
//                       the proportion check (dead rhythm).
//   3. faceted_body   — a faceted sphere with a 6-segment chain. Must BLOCK
//                       on faceted_body + soft_mass.
//
// The fixtures operate on plain {V, F, color, material, userData} records
// (no Three.js dependency) so the calibration page can run them directly.

'use strict';

(function () {
  // ── helper: make a UV sphere ───────────────────────────────────────────
  function uvSphere(radius, w, h) {
    const V = [];
    const F = [];
    for (let y = 0; y <= h; y++) {
      const v = y / h;
      const phi = v * Math.PI;
      for (let x = 0; x <= w; x++) {
        const u = x / w;
        const theta = u * Math.PI * 2;
        V.push([
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.sin(theta),
        ]);
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = y * (w + 1) + x;
        const b = a + 1;
        const c = a + (w + 1);
        const d = c + 1;
        F.push([a, c, b]);
        F.push([b, c, d]);
      }
    }
    return { V, F };
  }

  // ── helper: make a box of size [sx, sy, sz] centred at origin ──────────
  function makeBox(sx, sy, sz) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const V = [
      [-hx, -hy, -hz], [+hx, -hy, -hz], [+hx, +hy, -hz], [-hx, +hy, -hz],
      [-hx, -hy, +hz], [+hx, -hy, +hz], [+hx, +hy, +hz], [-hx, +hy, +hz],
    ];
    const F = [
      [0, 1, 2, 3], [4, 5, 6, 7], // top / bottom
      [0, 1, 5, 4], [1, 2, 6, 5], // front / right
      [2, 3, 7, 6], [3, 0, 4, 7], // back / left
    ];
    const out = [];
    for (const f of F) {
      out.push([f[0], f[1], f[2]]);
      out.push([f[0], f[2], f[3]]);
    }
    return { V, F: out };
  }

  // ── helper: build a chain along a polyline (for proportion check) ──────
  function chainFromPolyline(pts) {
    const joints = [];
    for (let i = 0; i < pts.length; i++) {
      joints.push({ name: `j${i}`, pos: pts[i], parent: i === 0 ? -1 : i - 1 });
    }
    return { joints, index: Object.fromEntries(joints.map((j, i) => [j.name, i])) };
  }

  // ── fixture 1: sphere_green — must PASS ────────────────────────────────
  // A low-poly icosahedron-style mass with a 5-segment chain. The
  // dihedral angle between adjacent faces is ~138° (well above any
  // smooth_angle ≤ 50°), so EVERY edge creases — soft_mass gets a
  // healthy share, the proportion check sees a 5-segment chain with
  // no segment at 50%, and the size check finds the declared height.
  function icosahedronLike(r) {
    const phi = (1 + Math.sqrt(5)) / 2;
    const raw = [
      [-1,  phi, 0], [1,  phi, 0], [-1, -phi, 0], [1, -phi, 0],
      [0, -1,  phi], [0, 1,  phi], [0, -1, -phi], [0, 1, -phi],
      [ phi, 0, -1], [phi, 0,  1], [-phi, 0, -1], [-phi, 0,  1],
    ];
    const V = raw.map((p) => {
      const l = Math.hypot(p[0], p[1], p[2]);
      return [p[0] / l * r, p[1] / l * r, p[2] / l * r];
    });
    const F = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ];
    return { V, F };
  }
  const ico = icosahedronLike(0.5);
  const sk1Pts = [];
  for (let i = 0; i < 5; i++) sk1Pts.push([0, -0.5 + (i / 4) * 1.0, 0]);
  const sk1 = chainFromPolyline(sk1Pts);
  const fixtureSphere = {
    name: 'sphere_green — must PASS (icosahedron + 5-segment chain)',
    expect: 'pass',
    smoothAngle: 50,
    meshes: () => [{
      V: ico.V.map((v) => v.slice()),
      F: ico.F.map((f) => f.slice()),
      color: '#888888',
      material: 'sphere_flesh',
      userData: { chain: 'Spine' },
    }],
    skeleton: () => sk1,
    shading: {
      seam: { radius_edges: 3, min_frac: 0.030 },
      pattern: { color: null, sharpness: 0.45, amount: 1.0, scale: 0.06 },
      ramp: { bottom: '#001370', mid: '#cfcfcf', top: '#fffcf0', p0: 0.0, pm: 0.31, wm: 0.08, p1: 1.0, chroma: 1.0, amount: 1.0 },
      boost: { y0: 0.0, y1: 0.4, gamma: 0.3, dL: 0.03, dC: 1.5, amount: 1.0, target: 'all' },
      bleed: { radius: 0.025, sharpness: 0.35, amount: 0.45 },
      hardsh: { amount: 0.54, gamma: 0.7 },
      bodysh: { lights: 4, rot: 4, elev: 17, amount: 0.2, gamma: 1.95 },
      normals: { flesh: 0.9 },
    },
    spec: {
      volumes: [{ chain: 'Spine', sides: 20, smooth_angle: 50, material: 'sphere_flesh' }],
      parts: [],
      chains: { Spine: sk1.joints.map((j) => j.name) },
      attach: {},
      mirror: [],
      height: 1.0,
    },
    classMap: new Map([['Spine', 'flesh']]),
  };

  // ── fixture 2: box_50_50 — must BLOCK on proportion ────────────────────
  // A 50:50 chain. Two segments of equal length, no companion segment. The
  // proportion check is the one that catches this.
  const box2 = makeBox(1, 1, 1);
  const sk2pts = [
    [0, 0, 0],
    [0, 0.5, 0], // 0.5 m
    [0, 1.0, 0], // another 0.5 m — 50:50 dead rhythm
  ];
  const sk2 = chainFromPolyline(sk2pts);
  const fixtureBox = {
    name: 'box_50_50 — must BLOCK on proportion',
    expect: 'block',
    smoothAngle: 50,
    meshes: () => [{
      V: box2.V.map((v) => v.slice()),
      F: box2.F.map((f) => f.slice()),
      color: '#888888',
      material: 'box_flesh',
      userData: { chain: 'Spine' },
    }],
    skeleton: () => sk2,
    spec: {
      volumes: [{ chain: 'Spine', sides: 4, smooth_angle: 50, material: 'box_flesh' }],
      parts: [],
      chains: { Spine: sk2.joints.map((j) => j.name) },
      attach: {},
      mirror: [],
      height: 1.0,
    },
    classMap: new Map([['Spine', 'flesh']]),
  };

  // ── fixture 3: faceted_body — must BLOCK on faceted_body ───────────────
  // A faceted sphere (smooth_angle=0). No silhouette can soften it.
  const sphere3 = uvSphere(0.5, 12, 8);
  const sk3 = chainFromPolyline([[0, -0.5, 0], [0, 0, 0], [0, 0.5, 0]]);
  const fixtureFaceted = {
    name: 'faceted_body — must BLOCK on faceted_body',
    expect: 'block',
    smoothAngle: 0, // every face its own group
    meshes: () => [{
      V: sphere3.V.map((v) => v.slice()),
      F: sphere3.F.map((f) => f.slice()),
      color: '#888888',
      material: 'faceted_flesh',
      userData: { chain: 'Spine', faceted: true },
    }],
    skeleton: () => sk3,
    spec: {
      volumes: [{ chain: 'Spine', sides: 12, faceted: true, material: 'faceted_flesh' }],
      parts: [],
      chains: { Spine: sk3.joints.map((j) => j.name) },
      attach: {},
      mirror: [],
      height: 1.0,
    },
    classMap: new Map([['Spine', 'flesh']]),
  };

  window.ACES_FIXTURES = [fixtureSphere, fixtureBox, fixtureFaceted];
})();
