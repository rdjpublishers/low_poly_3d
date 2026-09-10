// ACES — angle-weighted vertex normals with `smooth_angle` crease splitting.
//
// Two entry points, both ANGLE-weighted (each face contributes in proportion to
// the corner angle it subtends at the vertex, not to its area). Area weighting
// lets one big skinny triangle drag a normal off by tens of degrees, and
// because AO bakes from these normals the error would land in the shipped
// vertex colours.
//
//   vertexNormals(V, tris)        → one normal per vertex, fully smooth. Used
//                                   by the AO bake (it only needs a hemisphere
//                                   axis, never a crease).
//   smoothSplit(V, tris, deg, attrs) → normals WITH creases: faces meeting at
//                                       a vertex are grouped by dihedral
//                                       angle, and the vertex is duplicated
//                                       only when it genuinely carries more
//                                       than one smoothing group. deg <= 0 =
//                                       every face its own group (the old
//                                       `faceted`).
//
// Splitting only at real creases is the point: a 50° default leaves an organic
// mass fully smooth while keeping `sharp` profile breaks and plate rims crisp,
// and it costs a handful of extra vertices instead of tripling the mesh.
//
// Author: Ariescar (anyCreature) ported to the RDJ low_poly_3d browser
// surface. Pure math, no Three.js dependency. Output arrays are NEW — inputs
// are untouched.

'use strict';

// Build the per-face data we use twice: normalised face normals and corner
// angles (the weight in angle-weighted vertex normal accumulation).
function faceData(V, tris) {
  const fn = [];
  const ang = [];
  for (const [a, b, c] of tris) {
    const A = V[a], B = V[b], C = V[c];
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(n[0], n[1], n[2]);
    fn.push(l > 1e-12 ? [n[0] / l, n[1] / l, n[2] / l] : null); // null = degenerate
    const corner = (p, q, r) => {
      const e1 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
      const e2 = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
      const l1 = Math.hypot(e1[0], e1[1], e1[2]);
      const l2 = Math.hypot(e2[0], e2[1], e2[2]);
      if (l1 < 1e-12 || l2 < 1e-12) return 0;
      const d = (e1[0] * e2[0] + e1[1] * e2[1] + e1[2] * e2[2]) / (l1 * l2);
      return Math.acos(Math.max(-1, Math.min(1, d)));
    };
    ang.push([corner(A, B, C), corner(B, C, A), corner(C, A, B)]);
  }
  return { fn, ang };
}

// Index every (vertex, face, corner) incidence for the splitting pass.
function incidence(vcount, tris) {
  const inc = Array.from({ length: vcount }, () => []);
  tris.forEach((t, ti) => t.forEach((v, k) => inc[v].push([ti, k])));
  return inc;
}

// Smooth (one normal per vertex). Used by the AO bake — it only needs a
// hemisphere axis, never a crease.
function vertexNormals(V, tris) {
  const { fn, ang } = faceData(V, tris);
  const N = V.map(() => [0, 0, 0]);
  tris.forEach((t, ti) => {
    const n = fn[ti];
    if (!n) return;
    t.forEach((v, k) => {
      const w = ang[ti][k];
      N[v][0] += n[0] * w;
      N[v][1] += n[1] * w;
      N[v][2] += n[2] * w;
    });
  });
  return N.map((n) => {
    const l = Math.hypot(n[0], n[1], n[2]);
    return l > 1e-12 ? [n[0] / l, n[1] / l, n[2] / l] : [0, 1, 0];
  });
}

// Group a vertex's incident faces: two faces join when their normals sit
// within `deg` of each other (transitively — a fan that turns gradually stays
// one group; a `sharp` break with no face bridging it does not).
function groupFaces(list, fn, cosT) {
  const p = list.map((_, i) => i);
  const find = (i) => {
    while (p[i] !== i) {
      p[i] = p[p[i]];
      i = p[i];
    }
    return i;
  };
  for (let i = 0; i < list.length; i++) {
    const a = fn[list[i][0]];
    if (!a) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = fn[list[j][0]];
      if (!b) continue;
      if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] >= cosT) {
        const ra = find(i);
        const rb = find(j);
        if (ra !== rb) p[ra] = rb;
      }
    }
  }
  const byRoot = new Map();
  list.forEach((_, i) => {
    const r = find(i);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(i);
  });
  return [...byRoot.values()];
}

// Split vertices at REAL creases. attrs = { C?, skin?, UV? } — parallel arrays
// that follow any split. Returns { V, tris, N, C, skin, UV, split } where the
// arrays are NEW and inputs are untouched.
//
// When `attrs.smooth` is provided and true for a vertex, that vertex's faces
// are forced into a single smoothing group (no crease split, no extra
// vertex). This is the escape hatch for organic soft masses that the rest of
// the mesh is creasing around.
function smoothSplit(V, tris, deg, attrs = {}) {
  const { fn, ang } = faceData(V, tris);
  const inc = incidence(V.length, tris);
  const cosT = Math.cos((Math.max(0, Math.min(180, deg)) * Math.PI) / 180);
  const hard = !(deg > 0);

  const outV = V.map((v) => v);
  const outC = attrs.C ? attrs.C.map((c) => c) : null;
  const outS = attrs.skin ? attrs.skin.map((s) => s) : null;
  const outU = attrs.UV ? attrs.UV.map((u) => u) : null;
  const outT = tris.map((t) => t.slice());
  const N = V.map(() => null);
  let split = 0;

  for (let v = 0; v < V.length; v++) {
    const list = inc[v];
    if (!list.length) {
      N[v] = [0, 1, 0];
      continue;
    }
    const forceSmooth = attrs.smooth && attrs.smooth[v];
    const groups = hard || forceSmooth
      ? [list.map((_, i) => i)]
      : groupFaces(list, fn, cosT);
    groups.forEach((gi, gidx) => {
      let acc = [0, 0, 0];
      for (const i of gi) {
        const [ti, k] = list[i];
        const n = fn[ti];
        if (!n) continue;
        const w = ang[ti][k];
        acc = [acc[0] + n[0] * w, acc[1] + n[1] * w, acc[2] + n[2] * w];
      }
      const l = Math.hypot(acc[0], acc[1], acc[2]);
      const nn = l > 1e-12
        ? [acc[0] / l, acc[1] / l, acc[2] / l]
        : (fn[list[gi[0]][0]] || [0, 1, 0]);
      if (gidx === 0) {
        N[v] = nn;
        return;
      }
      // Second and later smoothing groups get their own copy of the vertex.
      const nv = outV.length;
      outV.push(V[v]);
      N.push(nn);
      split++;
      if (outC) outC.push(attrs.C[v]);
      if (outS) outS.push(attrs.skin[v]);
      if (outU) outU.push(attrs.UV[v]);
      for (const i of gi) {
        const [ti, k] = list[i];
        outT[ti][k] = nv;
      }
    });
  }
  return { V: outV, tris: outT, N, C: outC, skin: outS, UV: outU, split };
}

// Count how much of one mesh's skin can show an edge at a given crease angle.
// The share of interior edges whose dihedral angle reaches `deg` is exactly
// the share that `smoothSplit()` will crease — used by the ACES soft_mass
// check to make sure low-poly bodies are not TOO smooth.
function creaseShare(V, F, deg) {
  const tri = [];
  for (const f of F) {
    if (f.length === 3) tri.push(f);
    else if (f.length === 4) {
      tri.push([f[0], f[1], f[2]]);
      tri.push([f[0], f[2], f[3]]);
    }
  }
  const fn = [];
  for (const [a, b, c] of tri) {
    const A = V[a], B = V[b], C = V[c];
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(n[0], n[1], n[2]);
    fn.push(l > 1e-12 ? [n[0] / l, n[1] / l, n[2] / l] : null);
  }
  const key = new Map();
  const at = (i) => V[i].map((x) => Math.round(x * 1e4)).join(',');
  tri.forEach((f, i) => {
    for (const [u, v] of [[f[0], f[1]], [f[1], f[2]], [f[2], f[0]]]) {
      const a = at(u), b = at(v);
      const k = a < b ? a + '|' + b : b + '|' + a;
      if (!key.has(k)) key.set(k, []);
      key.get(k).push(i);
    }
  });
  const cos = Math.cos((deg * Math.PI) / 180);
  // The dihedral angle of a surface is the supplement of the angle between
  // outward face normals: dihedral = 180° - acos(dot). A real crease is one
  // whose dihedral is GREATER than the smooth angle. Equivalently: crease if
  //   dot > cos(180° - deg) = -cos(deg)
  // (a 138° icosahedron dihedral has dot=0.74, crease at smooth_angle≤138°).
  // Degenerate interior edges with a non-manifold 3+ face count are skipped.
  const cosNeg = -cos;
  let hard = 0, tot = 0;
  for (const fs of key.values()) {
    if (fs.length !== 2) continue;
    const p = fn[fs[0]], q = fn[fs[1]];
    if (!p || !q) continue;
    const d = p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
    tot++;
    if (d > cosNeg) hard++;
  }
  return { hard, tot };
}

// Folded-tris count: faces whose vertex-normal sum disagrees with their face
// normal. Used by ACES mesh_integrity to catch twist/breakage.
function foldCount(V, F, minArea2 = 0) {
  const tris = [];
  for (const f of F) {
    if (f.length === 3) tris.push(f);
    else {
      tris.push([f[0], f[1], f[2]]);
      tris.push([f[0], f[2], f[3]]);
    }
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

  const VN = V.map(() => [0, 0, 0]);
  const FN = tris.map(([a, b, c]) => {
    const n = cross(sub(V[b], V[a]), sub(V[c], V[a]));
    for (const i of [a, b, c]) {
      VN[i][0] += n[0];
      VN[i][1] += n[1];
      VN[i][2] += n[2];
    }
    return n;
  });
  let folds = 0;
  tris.forEach(([a, b, c], i) => {
    if (dot(FN[i], FN[i]) < minArea2) return; // degenerate slivers don't vote
    const s = add(add(VN[a], VN[b]), VN[c]);
    if (dot(FN[i], s) < 0) folds++;
  });
  return folds;
}

const api = { faceData, incidence, vertexNormals, smoothSplit, creaseShare, foldCount };

if (typeof window !== 'undefined') window.ACES_normals = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
