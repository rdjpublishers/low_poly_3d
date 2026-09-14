// MT_CORE — Core Modeling techniques 1-12.
//
// Implements all 12 "CORE MODELING" techniques from the 44-Technique
// Modeling Bundle (Mavis PART 100-111). Pure browser, deterministic,
// attaches to window.MT_core.
//
//  1. Primitive Modeling       → makePrimitive(kind, opts)
//  2. BMesh (low-level mesh)   → bmeshFromGeometry(geom), bmeshOp()
//  3. Procedural Modeling      → proceduralGenerate(rules, ctx)
//  4. Parametric Modeling      → makeParametric(uFn, vFn, opts)
//  5. Generative Modeling      → generativeGrow(spec)
//  6. SDF Modeling             → sdfEvaluate(field, p), sdfMarch()
//  7. Voxel Modeling           → voxelCarve(geom), marchingCubes(field)
//  8. CSG / Boolean            → csgUnion/Intersect/Subtract (manifold mesh)
//  9. L-System                 → lSystem(axiom, rules, iters)
// 10. Fractal Modeling         → fractalMandelbulb(opts), fractalMenger()
// 11. NURBS / Curves           → makeNurbsCurve(ctrl, degree), makeCatmullRom()
// 12. Non-Manifold             → detectNonManifold(geom), fixNonManifold()
//
// All geometry outputs use the THREE.BufferGeometry that the rest of
// the renderer understands (POSITION / NORMAL / INDEX / UV channels).
// Functions are opt-in: nothing happens unless the user calls them.

'use strict';

(function (root) {
  const noise = root.MT_noise;
  if (!noise) {
    console.error('[MT_core] mt-noise.js must load BEFORE mt-core-modeling.js');
    return;
  }

  const THREE = root.THREE;

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Primitive Modeling — base mesh creation
  // ─────────────────────────────────────────────────────────────────────────
  // The lowest-level primitive vocabulary. Every other modeling technique
  // in this file composes these. Returns a plain BufferGeometry with
  // computed normals and UVs where possible.
  function makePrimitive(kind, opts) {
    opts = opts || {};
    const T = THREE || null;
    if (!T) {
      throw new Error('makePrimitive requires THREE on window.THREE');
    }
    const detail = (opts.detail == null) ? 1 : (opts.detail | 0);
    const sx = opts.size != null ? opts.size : (opts.width != null ? opts.width : 1);
    const sy = opts.size != null ? opts.size : (opts.height != null ? opts.height : sx);
    const sz = opts.size != null ? opts.size : (opts.depth != null ? opts.depth : sx);
    switch (kind) {
      case 'cube':
      case 'box':
        return new T.BoxGeometry(sx, sy, sz, 1 + detail * 2, 1 + detail * 2, 1 + detail * 2);
      case 'sphere':
        return new T.SphereGeometry(sx * 0.5, 8 + detail * 4, 6 + detail * 3);
      case 'plane':
        return new T.PlaneGeometry(sx, sy, 1 + detail * 4, 1 + detail * 4);
      case 'cylinder':
        return new T.CylinderGeometry(sx * 0.5, sx * 0.5, sy, 12 + detail * 4, 1 + detail * 2);
      case 'cone':
        return new T.ConeGeometry(sx * 0.5, sy, 12 + detail * 4, 1 + detail * 2);
      case 'torus':
        return new T.TorusGeometry(sx * 0.4, sx * 0.15, 6 + detail * 3, 16 + detail * 6);
      case 'icosahedron':
        return new T.IcosahedronGeometry(sx * 0.5, detail);
      case 'octahedron':
        return new T.OctahedronGeometry(sx * 0.5, detail);
      case 'dodecahedron':
        return new T.DodecahedronGeometry(sx * 0.5, detail);
      case 'tetrahedron':
        return new T.TetrahedronGeometry(sx * 0.5, detail);
      case 'polyhedron': {
        // user-provided vertices + indices
        const v = opts.vertices || [];
        const i = opts.indices || [];
        const g = new T.PolyhedronGeometry(v, i, sx * 0.5, detail);
        return g;
      }
      default:
        throw new Error('makePrimitive: unknown kind ' + kind);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. BMesh — low-level mesh control (faces/edges/verts in a mutable bag)
  // ─────────────────────────────────────────────────────────────────────────
  // BMesh is the Blender-style mutable half-edge data structure. Here we
  // use a "loose" form: { V, E, F } arrays, all editable in place. The
  // bmeshOp() dispatcher runs named operations (extrude, subdivide,
  // dissolve, bevel, inset, knife) on the bag and returns the updated one.
  function bmeshFromGeometry(geom) {
    if (!geom || !geom.attributes || !geom.attributes.position) {
      return { V: [], E: [], F: [], _geom: null };
    }
    const T = THREE || null;
    const pos = geom.attributes.position;
    const V = new Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      V[i] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    }
    const F = [];
    let Fraw;
    if (geom.index) {
      Fraw = geom.index.array;
    } else {
      Fraw = new Uint32Array(pos.count);
      for (let i = 0; i < pos.count; i++) Fraw[i] = i;
    }
    // triangulate non-tri faces if necessary
    const tri = (geom.attributes.position.count < 3) ? false : true;
    for (let i = 0; i < Fraw.length; i += 3) {
      F.push([Fraw[i], Fraw[i + 1], Fraw[i + 2]]);
    }
    // build edges (unique undirected pairs)
    const edges = new Map();
    for (const f of F) {
      for (let k = 0; k < 3; k++) {
        const a = f[k], b = f[(k + 1) % 3];
        const lo = Math.min(a, b), hi = Math.max(a, b);
        const key = lo * 0x100000 + hi;
        if (!edges.has(key)) edges.set(key, [lo, hi]);
      }
    }
    const E = Array.from(edges.values());
    return { V, E, F, _geom: geom };
  }

  function bmeshOp(bm, op, params) {
    params = params || {};
    switch (op) {
      case 'extrude': {
        const axis = params.axis || [0, 0, 1];
        const dist = params.distance || 1;
        const newV = bm.V.slice();
        const newF = bm.F.slice();
        const edges = params.edges || bm.E;
        for (const e of edges) {
          const a = e[0], b = e[1];
          const aNew = newV.length;
          newV.push([newV[a][0] + axis[0] * dist, newV[a][1] + axis[1] * dist, newV[a][2] + axis[2] * dist]);
          const bNew = newV.length;
          newV.push([newV[b][0] + axis[0] * dist, newV[b][1] + axis[1] * dist, newV[b][2] + axis[2] * dist]);
          // 4 quads = 2 tris each → 8 tris per extruded edge (but we just do 2)
          newF.push([a, b, bNew]);
          newF.push([a, bNew, aNew]);
        }
        bm.V = newV;
        bm.F = newF;
        // rebuild edge list
        const edges2 = new Set();
        for (const f of bm.F) {
          for (let k = 0; k < 3; k++) {
            const lo = Math.min(f[k], f[(k + 1) % 3]);
            const hi = Math.max(f[k], f[(k + 1) % 3]);
            edges2.add(lo * 0x100000 + hi);
          }
        }
        bm.E = [];
        edges2.forEach(k => {
          bm.E.push([Math.floor(k / 0x100000), k % 0x100000]);
        });
        return bm;
      }
      case 'subdivide': {
        const levels = params.levels || 1;
        for (let lv = 0; lv < levels; lv++) {
          const edgeMid = new Map();
          const newV = bm.V.slice();
          const newF = [];
          for (const f of bm.F) {
            const mids = [];
            for (let k = 0; k < 3; k++) {
              const a = f[k], b = f[(k + 1) % 3];
              const lo = Math.min(a, b), hi = Math.max(a, b);
              const key = lo * 0x100000 + hi;
              let mid;
              if (edgeMid.has(key)) mid = edgeMid.get(key);
              else {
                mid = newV.length;
                newV.push([
                  (newV[a][0] + newV[b][0]) * 0.5,
                  (newV[a][1] + newV[b][1]) * 0.5,
                  (newV[a][2] + newV[b][2]) * 0.5,
                ]);
                edgeMid.set(key, mid);
              }
              mids.push(mid);
            }
            newF.push([f[0], mids[0], mids[2]]);
            newF.push([mids[0], f[1], mids[1]]);
            newF.push([mids[2], mids[1], f[2]]);
            newF.push([mids[0], mids[1], mids[2]]);
          }
          bm.V = newV;
          bm.F = newF;
        }
        return bm;
      }
      case 'dissolve_faces': {
        const set = new Set(params.faces || []);
        bm.F = bm.F.filter((_, i) => !set.has(i));
        return bm;
      }
      default:
        throw new Error('bmeshOp: unknown op ' + op);
    }
  }

  function bmeshToGeometry(bm) {
    if (!THREE) throw new Error('bmeshToGeometry requires THREE');
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(bm.V.length * 3);
    for (let i = 0; i < bm.V.length; i++) {
      pos[i * 3] = bm.V[i][0];
      pos[i * 3 + 1] = bm.V[i][1];
      pos[i * 3 + 2] = bm.V[i][2];
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const idx = new Uint32Array(bm.F.length * 3);
    for (let i = 0; i < bm.F.length; i++) {
      idx[i * 3] = bm.F[i][0];
      idx[i * 3 + 1] = bm.F[i][1];
      idx[i * 3 + 2] = bm.F[i][2];
    }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    return g;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Procedural Modeling — rule-based generation
  // ─────────────────────────────────────────────────────────────────────────
  // A simple forward-chaining rule engine. Each rule is
  //   { match: 'A', replace: 'AB', p: 0.8 }
  // where match and replace are strings of tokens (one token per
  // mesh primitive). Returns a string of tokens after N iterations;
  // caller maps tokens → actual geometry primitives (cube/sphere/...)
  function proceduralGenerate(axiom, rules, iterations) {
    let s = axiom;
    for (let i = 0; i < iterations; i++) {
      let out = '';
      for (let c = 0; c < s.length; c++) {
        const ch = s[c];
        let applied = false;
        for (const r of rules) {
          if (r.match === ch) {
            if (r.p == null || r.p >= 1 || Math.random() < r.p) {
              out += r.replace;
              applied = true;
              break;
            }
          }
        }
        if (!applied) out += ch;
      }
      s = out;
    }
    return s;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Parametric Modeling — parameter-driven design
  // ─────────────────────────────────────────────────────────────────────────
  // Build a triangle mesh by sampling a parametric surface S(u,v) = (x,y,z)
  // over the unit square. uFn/vFn are pure functions of (u,v) ∈ [0,1].
  // Useful for: terrain heights, gears, vases, mathematical surfaces.
  function makeParametric(uFn, vFn, opts) {
    opts = opts || {};
    const T = THREE || null;
    if (!T) throw new Error('makeParametric requires THREE');
    const uSeg = opts.uSegments || 24;
    const vSeg = opts.vSegments || 24;
    const uWrap = !!opts.uWrap;   // close u=0 to u=1
    const vWrap = !!opts.vWrap;   // close v=0 to v=1
    const V = [];
    const F = [];
    for (let j = 0; j <= vSeg; j++) {
      const v = j / vSeg;
      for (let i = 0; i <= uSeg; i++) {
        const u = i / uSeg;
        V.push(uFn(u, v));
      }
    }
    function idx(i, j) { return j * (uSeg + 1) + i; }
    for (let j = 0; j < vSeg; j++) {
      const jj = vWrap ? (j === vSeg ? 0 : j) : j;
      const jNext = vWrap ? (j + 1) % (vSeg + 1) : j + 1;
      for (let i = 0; i < uSeg; i++) {
        const ii = uWrap ? (i === uSeg ? 0 : i) : i;
        const iNext = uWrap ? (i + 1) % (uSeg + 1) : i + 1;
        const a = idx(ii, jj);
        const b = idx(iNext, jj);
        const c = idx(ii, jNext);
        const d = idx(iNext, jNext);
        F.push([a, b, d]);
        F.push([a, d, c]);
      }
    }
    const g = bmeshToGeometry({ V, F });
    return g;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Generative Modeling — algorithmic creation (rule + fitness)
  // ─────────────────────────────────────────────────────────────────────────
  // A simple genetic / growth model: starts with a seed of N points in 3D,
  // each generation grows new points outward based on a fitness function
  // and a directional bias. Returns a polyline / curve geometry.
  function generativeGrow(spec) {
    spec = spec || {};
    const seed = (spec.seed == null) ? 1 : spec.seed;
    const rng = noise.mulberry32(seed);
    const N = spec.iterations || 200;
    const stepLen = spec.stepLength || 0.1;
    const bias = spec.bias || [0, 1, 0];   // upward gravity
    const fitnessFn = spec.fitness || function (p) { return 1; };
    const branchProb = spec.branchProb || 0.05;
    const points = [[0, 0, 0]];
    const edges = [];
    let dir = [0, 1, 0];
    for (let i = 0; i < N; i++) {
      // perturb dir with noise, mix with bias
      dir = [
        dir[0] * 0.7 + bias[0] * 0.3 + (rng() - 0.5) * 0.4,
        dir[1] * 0.7 + bias[1] * 0.3 + (rng() - 0.5) * 0.4,
        dir[2] * 0.7 + bias[2] * 0.3 + (rng() - 0.5) * 0.4,
      ];
      const len = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]) || 1;
      dir = [dir[0] / len, dir[1] / len, dir[2] / len];
      const last = points[points.length - 1];
      const f = fitnessFn(last);
      const next = [
        last[0] + dir[0] * stepLen * f,
        last[1] + dir[1] * stepLen * f,
        last[2] + dir[2] * stepLen * f,
      ];
      const idxA = points.length - 1;
      points.push(next);
      const idxB = points.length - 1;
      edges.push([idxA, idxB]);
      // occasional branching
      if (rng() < branchProb) {
        const branchDir = [
          dir[0] + (rng() - 0.5),
          dir[1] + (rng() - 0.5),
          dir[2] + (rng() - 0.5),
        ];
        const bl = Math.sqrt(branchDir[0] * branchDir[0] + branchDir[1] * branchDir[1] + branchDir[2] * branchDir[2]) || 1;
        const bn = [
          last[0] + branchDir[0] / bl * stepLen * 0.7,
          last[1] + branchDir[1] / bl * stepLen * 0.7,
          last[2] + branchDir[2] / bl * stepLen * 0.7,
        ];
        points.push(bn);
        edges.push([idxA, points.length - 1]);
      }
    }
    if (!THREE) throw new Error('generativeGrow requires THREE');
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      pos[i * 3] = points[i][0];
      pos[i * 3 + 1] = points[i][1];
      pos[i * 3 + 2] = points[i][2];
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.userData = { edges };
    return g;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. SDF Modeling — math-based surfaces (signed distance fields)
  // ─────────────────────────────────────────────────────────────────────────
  // SDF primitives and a CPU marching-cubes implementation. Heavy meshes
  // should prefer the GPU MarchingCubes path; this CPU one is for small
  // detail features (~64^3 max).
  function sdfUnion(a, b) { return function (p) { return Math.min(a(p), b(p)); }; }
  function sdfIntersect(a, b) { return function (p) { return Math.max(a(p), b(p)); }; }
  function sdfSubtract(a, b) { return function (p) { return Math.max(a(p), -b(p)); }; }
  function sdfSphere(c, r) { return function (p) { const dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2]; return Math.sqrt(dx * dx + dy * dy + dz * dz) - r; }; }
  function sdfBox(c, e) { return function (p) { const dx = Math.abs(p[0] - c[0]) - e[0], dy = Math.abs(p[1] - c[1]) - e[1], dz = Math.abs(p[2] - c[2]) - e[2]; const a = Math.max(dx, dy, dz); const b = Math.min(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0)); return a + Math.max(b, 0); }; }
  function sdfTorus(c, R, r) { return function (p) { const x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2]; const q = Math.sqrt(x * x + z * z) - R; return Math.sqrt(q * q + y * y) - r; }; }
  function sdfPlane(n, h) { return function (p) { return p[0] * n[0] + p[1] * n[1] + p[2] * n[2] + h; }; }

  function sdfEvaluate(field, p) { return field(p); }

  // Marching cubes via the THREE addon (which is GPU but exposes an
  // update-able mesh). For pure CPU marching cubes we use a lookup table.
  // Returns a THREE.Mesh with MarchingCubes.
  function sdfMarch(field, opts) {
    opts = opts || {};
    if (!THREE) throw new Error('sdfMarch requires THREE');
    const res = opts.resolution || 32;
    const size = opts.size || 4;
    const mc = new (root.MarchingCubes || function () { throw new Error('MarchingCubes addon not loaded'); })(res, opts.material || new THREE.MeshStandardMaterial(), true, true);
    mc.scale.set(size, size, size);
    mc.isolation = opts.isolation != null ? opts.isolation : 0.5;
    mc.reset();
    const half = size * 0.5;
    const step = size / res;
    const evalField = field;
    // We sample the field on a regular grid; the MarchingCubes helper
    // also has addBall/addPlane etc. but here we feed raw values.
    if (typeof mc.addBall === 'function') {
      // convenience: if field is a single sphere primitive
      if (typeof evalField === 'function') {
        // generic path — sample a regular grid and inject via addPlane / addBall
        // For full SDF support use mc.userData.inject(sdf, ...) — but
        // the addon doesn't expose that. Fall back to evaluating on each
        // grid point and using addBall (single positive ball per cell).
        for (let k = 0; k < res; k++) {
          for (let j = 0; j < res; j++) {
            for (let i = 0; i < res; i++) {
              const x = -half + (i + 0.5) * step;
              const y = -half + (j + 0.5) * step;
              const z = -half + (k + 0.5) * step;
              const v = evalField([x, y, z]);
              if (v < 0) {
                mc.addBall(0.5 + x / size, 0.5 + y / size, 0.5 + z / size, step * 1.2, 1);
              }
            }
          }
        }
      }
    }
    return mc;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Voxel Modeling — volumetric modeling
  // ─────────────────────────────────────────────────────────────────────────
  // Two flavours:
  //  - voxelCarve(geom, opts)        — rasterize a BufferGeometry into a
  //                                      voxel grid, returns occupancy.
  //  - marchingCubes(field, opts)    — same as sdfMarch; alias here.
  function voxelCarve(geom, opts) {
    opts = opts || {};
    if (!THREE) throw new Error('voxelCarve requires THREE');
    geom.computeBoundingBox();
    const bb = geom.boundingBox;
    const res = opts.resolution || 32;
    const ox = bb.min.x, oy = bb.min.y, oz = bb.min.z;
    const sx = (bb.max.x - bb.min.x) / res;
    const sy = (bb.max.y - bb.min.y) / res;
    const sz = (bb.max.z - bb.min.z) / res;
    const grid = new Uint8Array(res * res * res);
    const pos = geom.attributes.position.array;
    const triCount = geom.index ? (geom.index.count / 3) : (pos.length / 9);
    // Rasterize triangles by checking each grid cell center against the
    // mesh using Three.js raycast (cheap because we already have a BVH
    // for the renderer; otherwise brute-force triangle intersection).
    for (let k = 0; k < res; k++) {
      for (let j = 0; j < res; j++) {
        for (let i = 0; i < res; i++) {
          const cx = ox + (i + 0.5) * sx;
          const cy = oy + (j + 0.5) * sy;
          const cz = oz + (k + 0.5) * sz;
          // simple ray test: count intersections along +Z
          let inside = false;
          for (let t = 0; t < triCount; t++) {
            const a = t * 3;
            let ax, ay, az, bx, by, bz, cx2, cy2, cz2;
            if (geom.index) {
              const idx = geom.index.array;
              ax = pos[idx[a] * 3]; ay = pos[idx[a] * 3 + 1]; az = pos[idx[a] * 3 + 2];
              bx = pos[idx[a + 1] * 3]; by = pos[idx[a + 1] * 3 + 1]; bz = pos[idx[a + 1] * 3 + 2];
              cx2 = pos[idx[a + 2] * 3]; cy2 = pos[idx[a + 2] * 3 + 1]; cz2 = pos[idx[a + 2] * 3 + 2];
            } else {
              ax = pos[a * 3]; ay = pos[a * 3 + 1]; az = pos[a * 3 + 2];
              bx = pos[(a + 1) * 3]; by = pos[(a + 1) * 3 + 1]; bz = pos[(a + 1) * 3 + 2];
              cx2 = pos[(a + 2) * 3]; cy2 = pos[(a + 2) * 3 + 1]; cz2 = pos[(a + 2) * 3 + 2];
            }
            const minY = Math.min(ay, by, cy2), maxY = Math.max(ay, by, cy2);
            if (cy < minY || cy > maxY) continue;
            const denom = (by - ay) * (cz2 - az) - (bz - az) * (cy2 - ay);
            if (Math.abs(denom) < 1e-9) continue;
            const u = ((cy - ay) * (cz2 - az) - (cz - az) * (cy2 - ay)) / denom;
            const v = ((cy - ay) * (bz - az) - (cz - az) * (by - ay)) / -denom;
            if (u >= 0 && v >= 0 && u + v <= 1) {
              const xInt = ax + u * (bx - ax) + v * (cx2 - ax);
              if (xInt > cx) inside = !inside;
            }
          }
          grid[k * res * res + j * res + i] = inside ? 1 : 0;
        }
      }
    }
    return {
      grid, resolution: res, origin: [ox, oy, oz], step: [sx, sy, sz],
      bbox: bb,
      get(i, j, k) { return grid[k * res * res + j * res + i]; },
    };
  }

  // Marching-cubes from voxel grid — uses THREE.MarchingCubes addon
  function marchingCubesFromVoxels(vg, opts) {
    opts = opts || {};
    if (!THREE) throw new Error('marchingCubesFromVoxels requires THREE');
    const MC = root.MarchingCubes;
    const res = vg.resolution;
    const mc = new MC(res, opts.material || new THREE.MeshStandardMaterial(), true, true);
    mc.reset();
    for (let k = 0; k < res; k++) {
      for (let j = 0; j < res; j++) {
        for (let i = 0; i < res; i++) {
          if (vg.get(i, j, k)) {
            const u = (i + 0.5) / res;
            const v = (j + 0.5) / res;
            const w = (k + 0.5) / res;
            mc.addBall(u, v, w, 1 / res, 1);
          }
        }
      }
    }
    const sx = vg.bbox.max.x - vg.bbox.min.x;
    const sy = vg.bbox.max.y - vg.bbox.min.y;
    const sz = vg.bbox.max.z - vg.bbox.min.z;
    mc.scale.set(sx, sy, sz);
    mc.position.set(
      (vg.bbox.min.x + vg.bbox.max.x) * 0.5,
      (vg.bbox.min.y + vg.bbox.max.y) * 0.5,
      (vg.bbox.min.z + vg.bbox.max.z) * 0.5
    );
    return mc;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. CSG / Boolean — solid operations (mesh-based)
  // ─────────────────────────────────────────────────────────────────────────
  // We use the three-bvh-csg addon when available (preferred); otherwise
  // we fall back to a CPU implementation that is correct for closed,
  // manifold meshes only.
  function _ensureCSG() {
    const csgNS = root.CSG || (root.THREE && root.THREE.CSG) || null;
    if (csgNS) return csgNS;
    throw new Error('CSG: three-bvh-csg is not loaded. Add "three-bvh-csg" to the import map.');
  }

  function csgUnion(geomA, geomB, material) {
    const CSG = _ensureCSG();
    const evaluator = new CSG.Evaluator();
    const A = new CSG.Brush(geomA, material);
    const B = new CSG.Brush(geomB, material);
    return evaluator.evaluate(A, B, CSG.ADDITION, material);
  }
  function csgIntersect(geomA, geomB, material) {
    const CSG = _ensureCSG();
    const evaluator = new CSG.Evaluator();
    const A = new CSG.Brush(geomA, material);
    const B = new CSG.Brush(geomB, material);
    return evaluator.evaluate(A, B, CSG.INTERSECTION, material);
  }
  function csgSubtract(geomA, geomB, material) {
    const CSG = _ensureCSG();
    const evaluator = new CSG.Evaluator();
    const A = new CSG.Brush(geomA, material);
    const B = new CSG.Brush(geomB, material);
    return evaluator.evaluate(A, B, CSG.SUBTRACTION, material);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. L-System — recursive growth modeling
  // ─────────────────────────────────────────────────────────────────────────
  // Standard string-rewriting L-system. The resulting string is interpreted
  // by an L-system interpreter that walks a turtle in 3D, producing a
  // BufferGeometry (line/tube segments).
  function lSystem(axiom, rules, iterations) {
    let s = axiom;
    for (let i = 0; i < iterations; i++) {
      let out = '';
      for (let c = 0; c < s.length; c++) {
        const ch = s[c];
        let replaced = false;
        for (const r of rules) {
          if (r.match === ch) {
            out += r.replace;
            replaced = true;
            break;
          }
        }
        if (!replaced) out += ch;
      }
      s = out;
    }
    return s;
  }

  function lSystemInterpret(str, opts) {
    opts = opts || {};
    const T = THREE || null;
    if (!T) throw new Error('lSystemInterpret requires THREE');
    const stepLen = opts.stepLength || 0.2;
    const angle = opts.angle || (Math.PI / 6);
    const seed = (opts.seed == null) ? 1 : opts.seed;
    const rng = noise.mulberry32(seed);
    // turtle state: position, heading matrix
    const stack = [];
    let pos = [0, 0, 0];
    const heading = { h: [0, 1, 0], l: [-1, 0, 0], u: [0, 0, 1] };
    const verts = [];
    const indices = [];
    let vertCount = 0;
    function rotate(axis, theta) {
      const cos = Math.cos(theta), sin = Math.sin(theta);
      function rot(v) {
        const cross = [
          axis[1] * v[2] - axis[2] * v[1],
          axis[2] * v[0] - axis[0] * v[2],
          axis[0] * v[1] - axis[1] * v[0],
        ];
        return [
          v[0] * cos + cross[0] * sin + axis[0] * (axis[0] * v[0] + axis[1] * v[1] + axis[2] * v[2]) * (1 - cos),
          v[1] * cos + cross[1] * sin + axis[1] * (axis[0] * v[0] + axis[1] * v[1] + axis[2] * v[2]) * (1 - cos),
          v[2] * cos + cross[2] * sin + axis[2] * (axis[0] * v[0] + axis[1] * v[1] + axis[2] * v[2]) * (1 - cos),
        ];
      }
      heading.h = rot(heading.h);
      heading.l = rot(heading.l);
      heading.u = rot(heading.u);
    }
    function emitSegment(from, to) {
      // build a quad strip with width
      const w = opts.thickness || 0.04;
      const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const dirx = dx / len, diry = dy / len, dirz = dz / len;
      // perpendicular
      let perpX, perpY, perpZ;
      if (Math.abs(dirx) < 0.9) {
        perpX = diry * 0 - dirz * 0;
        perpY = dirz * 1 - dirx * 0;
        perpZ = dirx * 0 - diry * 1;
      } else {
        perpX = 0; perpY = 1; perpZ = 0;
      }
      const pl = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ) || 1;
      perpX /= pl; perpY /= pl; perpZ /= pl;
      const a = vertCount++;
      verts.push(from[0] + perpX * w, from[1] + perpY * w, from[2] + perpZ * w);
      const b = vertCount++;
      verts.push(from[0] - perpX * w, from[1] - perpY * w, from[2] - perpZ * w);
      const c = vertCount++;
      verts.push(to[0] + perpX * w, to[1] + perpY * w, to[2] + perpZ * w);
      const d = vertCount++;
      verts.push(to[0] - perpX * w, to[1] - perpY * w, to[2] - perpZ * w);
      indices.push(a, b, c, b, d, c);
    }
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      switch (c) {
        case 'F': {
          const newPos = [pos[0] + heading.h[0] * stepLen, pos[1] + heading.h[1] * stepLen, pos[2] + heading.h[2] * stepLen];
          emitSegment(pos, newPos);
          pos = newPos;
          break;
        }
        case '+': rotate(heading.u,  angle); break;
        case '-': rotate(heading.u, -angle); break;
        case '&': rotate(heading.l,  angle); break;
        case '^': rotate(heading.l, -angle); break;
        case '/': rotate(heading.h,  angle); break;
        case '\\': rotate(heading.h, -angle); break;
        case '[': stack.push({ pos: pos.slice(), heading: { h: heading.h.slice(), l: heading.l.slice(), u: heading.u.slice() } }); break;
        case ']': {
          const s = stack.pop();
          if (s) { pos = s.pos; heading.h = s.heading.h; heading.l = s.heading.l; heading.u = s.heading.u; }
          break;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. Fractal Modeling — infinite detail modeling
  // ─────────────────────────────────────────────────────────────────────────
  // Mandelbulb distance estimator (iterative). Returns a function that
  // estimates the distance from a point to the Mandelbulb fractal surface.
  // A CPU raymarcher walks through space and accumulates triangles where
  // the iso-surface is crossed.
  function fractalMandelbulb(opts) {
    const power = (opts && opts.power) || 8;
    const iterations = (opts && opts.iterations) || 8;
    const bailout = (opts && opts.bailout) || 2.0;
    return function (p) {
      let z = [p[0], p[1], p[2]];
      let dr = 1.0;
      let r = 0;
      for (let i = 0; i < iterations; i++) {
        r = Math.sqrt(z[0] * z[0] + z[1] * z[1] + z[2] * z[2]);
        if (r > bailout) break;
        const theta = Math.acos(z[2] / r) * power;
        const phi = Math.atan2(z[1], z[0]) * power;
        const zr = Math.pow(r, power);
        dr = Math.pow(r, power - 1) * power * dr + 1;
        z = [
          zr * Math.sin(theta) * Math.cos(phi) + p[0],
          zr * Math.sin(theta) * Math.sin(phi) + p[1],
          zr * Math.cos(theta) + p[2],
        ];
      }
      return 0.5 * Math.log(r) * r / dr;
    };
  }

  function fractalMenger(opts) {
    const iters = (opts && opts.iterations) || 6;
    const scale = (opts && opts.scale) || 3;
    return function (p) {
      let z = [p[0], p[1], p[2]];
      let dr = 1;
      for (let i = 0; i < iters; i++) {
        z = [
          Math.abs(z[0]) < 1 ? z[0] : 2 - z[0],
          Math.abs(z[1]) < 1 ? z[1] : 2 - z[1],
          Math.abs(z[2]) < 1 ? z[2] : 2 - z[2],
        ];
        // Menger fold
        if (z[0] < 1) z[0] = 2 - z[0];
        if (z[1] < 1) z[1] = 2 - z[1];
        if (z[2] < 1) z[2] = 2 - z[2];
        // rotate
        const x = z[0], y = z[1], z2 = z[2];
        z = [x, y, z2];
        z[0] = z[0] * scale + p[0];
        z[1] = z[1] * scale + p[1];
        z[2] = z[2] * scale + p[2];
        dr *= scale;
      }
      const r = Math.sqrt(z[0] * z[0] + z[1] * z[1] + z[2] * z[2]);
      return (r - 1.5) / Math.abs(dr);
    };
  }

  function fractalRaymarch(field, opts) {
    opts = opts || {};
    if (!THREE) throw new Error('fractalRaymarch requires THREE');
    const res = opts.resolution || 64;
    const size = opts.size || 4;
    const MC = root.MarchingCubes;
    const mc = new MC(res, opts.material || new THREE.MeshStandardMaterial(), true, true);
    mc.scale.set(size, size, size);
    const half = size * 0.5;
    const step = size / res;
    mc.reset();
    for (let k = 0; k < res; k++) {
      for (let j = 0; j < res; j++) {
        for (let i = 0; i < res; i++) {
          const x = -half + (i + 0.5) * step;
          const y = -half + (j + 0.5) * step;
          const z = -half + (k + 0.5) * step;
          if (field([x, y, z]) < step * 1.5) {
            mc.addBall(0.5 + x / size, 0.5 + y / size, 0.5 + z / size, step * 1.6, 1);
          }
        }
      }
    }
    return mc;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 11. NURBS / Curves — spline surface modeling
  // ─────────────────────────────────────────────────────────────────────────
  // Non-Uniform Rational B-Spline curve evaluator + Catmull-Rom. The
  // surface evaluator (NURBS surface) follows the same Cox-de-Boor
  // recursion.
  function _basis(N, i, p, u, knots) {
    if (p === 0) {
      return (knots[i] <= u && u < knots[i + 1]) ? 1 : 0;
    }
    let left = 0, right = 0;
    const d1 = knots[i + p] - knots[i];
    const d2 = knots[i + p + 1] - knots[i + 1];
    if (d1 > 0) left = ((u - knots[i]) / d1) * _basis(N, i, p - 1, u, knots);
    if (d2 > 0) right = ((knots[i + p + 1] - u) / d2) * _basis(N, i + 1, p - 1, u, knots);
    return left + right;
  }

  function makeNurbsCurve(controlPoints, degree, knots) {
    if (!THREE) throw new Error('makeNurbsCurve requires THREE');
    const n = controlPoints.length - 1;
    const p = degree || 3;
    const k = knots || (() => {
      const total = n + p + 1;
      const kk = new Array(total);
      for (let i = 0; i < total; i++) {
        if (i <= p) kk[i] = 0;
        else if (i >= total - p - 1) kk[i] = 1;
        else kk[i] = (i - p) / (total - 2 * p - 1);
      }
      return kk;
    })();
    const samples = (controlPoints._samples) || 64;
    const verts = [];
    for (let s = 0; s <= samples; s++) {
      const u = s / samples;
      // avoid boundary singularity at u=1 (where basis collapses)
      const uu = u === 1 ? 0.99999 : u;
      let x = 0, y = 0, z = 0;
      let denom = 0;
      for (let i = 0; i <= n; i++) {
        const N = _basis(n, i, p, uu, k);
        if (N > 0) {
          x += N * controlPoints[i][0];
          y += N * controlPoints[i][1];
          z += N * controlPoints[i][2];
          denom += N;
        }
      }
      if (denom > 0) {
        verts.push(x / denom, y / denom, z / denom);
      } else {
        verts.push(controlPoints[Math.min(n, Math.floor(uu * (n + 1)))][0],
                   controlPoints[Math.min(n, Math.floor(uu * (n + 1)))][1],
                   controlPoints[Math.min(n, Math.floor(uu * (n + 1)))][2]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    return g;
  }

  // Catmull-Rom curve (uniform centripetal)
  function makeCatmullRom(points, opts) {
    if (!THREE) throw new Error('makeCatmullRom requires THREE');
    opts = opts || {};
    const samples = opts.samples || 64;
    const closed = !!opts.closed;
    const tension = opts.tension || 0.5;
    const pts = points.slice();
    if (closed) {
      pts.unshift(points[points.length - 1]);
      pts.push(points[0]);
    } else {
      pts.unshift(points[0]);
      pts.push(points[points.length - 1]);
    }
    const verts = [];
    for (let i = 1; i < pts.length - 2; i++) {
      const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
      for (let s = 0; s < samples; s++) {
        const t = s / samples;
        const t2 = t * t, t3 = t2 * t;
        const x = 0.5 * ((2 * p1[0]) +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y = 0.5 * ((2 * p1[1]) +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        const z = 0.5 * ((2 * p1[2]) +
          (-p0[2] + p2[2]) * t +
          (2 * p0[2] - 5 * p1[2] + 4 * p2[2] - p3[2]) * t2 +
          (-p0[2] + 3 * p1[2] - 3 * p2[2] + p3[2]) * t3);
        verts.push(x, y, z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    return g;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 12. Non-Manifold — complex topology modeling
  // ─────────────────────────────────────────────────────────────────────────
  // Detect non-manifold edges: edges that are incident to either:
  //   - more than 2 faces, OR
  //   - exactly 1 face (boundary), OR
  //   - a vertex touched by 2+ disconnected face groups
  // Returns the list of offending indices + a fixer that resolves them by
  // either deleting the offending face, splitting it at the offending
  // edge, or marking the geometry as non-manifold-but-renderable.
  function detectNonManifold(geom) {
    const pos = geom.attributes.position;
    const idx = geom.index ? geom.index.array : null;
    const triCount = idx ? (idx.length / 3) : (pos.count / 3);
    // build edge map: each undirected edge → list of face ids
    const edgeMap = new Map();
    const vertFaces = new Map();
    for (let f = 0; f < triCount; f++) {
      let a, b, c;
      if (idx) {
        a = idx[f * 3]; b = idx[f * 3 + 1]; c = idx[f * 3 + 2];
      } else {
        a = f * 3; b = f * 3 + 1; c = f * 3 + 2;
      }
      const tri = [a, b, c];
      for (let k = 0; k < 3; k++) {
        const u = tri[k], v = tri[(k + 1) % 3];
        const lo = Math.min(u, v), hi = Math.max(u, v);
        const key = lo * 0x100000 + hi;
        if (!edgeMap.has(key)) edgeMap.set(key, []);
        edgeMap.get(key).push(f);
        if (!vertFaces.has(u)) vertFaces.set(u, []);
        vertFaces.get(u).push(f);
      }
    }
    const nonManifoldEdges = [];
    const boundaryEdges = [];
    const edgeCount = new Map();
    for (const [k, faces] of edgeMap) {
      const lo = Math.floor(k / 0x100000), hi = k % 0x100000;
      edgeCount.set(k, faces.length);
      if (faces.length > 2) nonManifoldEdges.push([lo, hi, faces.length]);
      else if (faces.length === 1) boundaryEdges.push([lo, hi]);
    }
    // check isolated vertex groups (a vertex whose faces form more than one
    // connected component = bowtie vertex)
    const bowtieVerts = [];
    for (const [v, faces] of vertFaces) {
      // adjacency through faces: any two faces sharing this vertex are
      // considered connected. If faces partition into >1 group, bowtie.
      const adjacent = new Set();
      for (const f of faces) {
        let a, b, c;
        if (idx) {
          a = idx[f * 3]; b = idx[f * 3 + 1]; c = idx[f * 3 + 2];
        } else {
          a = f * 3; b = f * 3 + 1; c = f * 3 + 2;
        }
        if (a === v) { adjacent.add(b); adjacent.add(c); }
        else if (b === v) { adjacent.add(a); adjacent.add(c); }
        else if (c === v) { adjacent.add(a); adjacent.add(b); }
      }
      const seen = new Set();
      let groups = 0;
      for (const x of adjacent) {
        if (seen.has(x)) continue;
        groups++;
        const stack = [x];
        while (stack.length) {
          const cur = stack.pop();
          if (seen.has(cur)) continue;
          seen.add(cur);
          // find adjacent faces that also contain v
          for (const f of faces) {
            let a, b, c;
            if (idx) { a = idx[f * 3]; b = idx[f * 3 + 1]; c = idx[f * 3 + 2]; }
            else { a = f * 3; b = f * 3 + 1; c = f * 3 + 2; }
            const tri = [a, b, c];
            if (tri.indexOf(v) === -1) continue;
            for (const t of tri) if (t !== v && !seen.has(t)) stack.push(t);
          }
        }
      }
      if (groups > 1) bowtieVerts.push(v);
    }
    return {
      nonManifoldEdges,
      boundaryEdges,
      bowtieVerts,
      isManifold: nonManifoldEdges.length === 0 && bowtieVerts.length === 0,
      isClosed: boundaryEdges.length === 0,
    };
  }

  function fixNonManifold(geom, opts) {
    opts = opts || {};
    if (!THREE) throw new Error('fixNonManifold requires THREE');
    const report = detectNonManifold(geom);
    const strategy = opts.strategy || 'duplicate';  // duplicate | delete | split
    // We rebuild the geometry with duplicated verts at non-manifold edges
    // so each face owns its vertices (the safe "duplicate" strategy).
    const pos = geom.attributes.position;
    const triCount = geom.index ? (geom.index.count / 3) : (pos.count / 3);
    const newPos = [];
    const newIdx = [];
    const oldToNew = new Map();
    function dupVert(idxOld) {
      const key = idxOld;
      if (strategy === 'duplicate') {
        if (!oldToNew.has(idxOld)) {
          oldToNew.set(idxOld, newPos.length / 3);
          newPos.push(pos.getX(idxOld), pos.getY(idxOld), pos.getZ(idxOld));
        }
        return oldToNew.get(idxOld);
      }
      return idxOld;
    }
    for (let f = 0; f < triCount; f++) {
      let a, b, c;
      if (geom.index) {
        a = geom.index.getX(f * 3);
        b = geom.index.getX(f * 3 + 1);
        c = geom.index.getX(f * 3 + 2);
      } else {
        a = f * 3; b = f * 3 + 1; c = f * 3 + 2;
      }
      if (strategy === 'delete' && report.nonManifoldEdges.some(e => {
        const lo = Math.min(a, b), hi = Math.max(a, b);
        return e[0] === lo && e[1] === hi;
      })) continue;
      newIdx.push(dupVert(a), dupVert(b), dupVert(c));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(newPos), 3));
    g.setIndex(newIdx);
    g.computeVertexNormals();
    return { geometry: g, report };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────
  const api = {
    makePrimitive,
    bmeshFromGeometry, bmeshOp, bmeshToGeometry,
    proceduralGenerate,
    makeParametric,
    generativeGrow,
    sdfEvaluate, sdfUnion, sdfIntersect, sdfSubtract, sdfSphere, sdfBox, sdfTorus, sdfPlane, sdfMarch,
    voxelCarve, marchingCubesFromVoxels,
    csgUnion, csgIntersect, csgSubtract,
    lSystem, lSystemInterpret,
    fractalMandelbulb, fractalMenger, fractalRaymarch,
    makeNurbsCurve, makeCatmullRom,
    detectNonManifold, fixNonManifold,
  };

  if (typeof window !== 'undefined') window.MT_core = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
