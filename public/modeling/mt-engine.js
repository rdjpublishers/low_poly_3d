// MT_ENGINE — Modeling Techniques engine facade.
//
// Single entry point: `MT.run(threeScene, op, opts)` runs any of the
// 44 modeling techniques against an existing Three.js scene. Same
// pattern as `acesQualityPass()` (PART 90).
//
// Like ACES, MT is opt-in. Nothing happens unless the user calls one
// of the 44 helpers OR MT.run() OR a UI button wired to it.
//
//   1.  MT.makePrimitive('sphere', { size: 1, detail: 2 })
//   2.  MT.bmeshFromGeometry(mesh.geometry) → MT.bmeshOp(bm, 'subdivide')
//   3.  MT.proceduralGenerate('A', [{match:'A', replace:'AB'}], 4)
//   …   (one entry per technique, all 44 listed below)
//
// Author: Mavis / RDJ Publishers low_poly_3d renderer surface.
// Part of: 44-Technique Modeling Bundle (Mavis PART 100-143).

'use strict';

(function (root) {
  const noise = root.MT_noise;
  const core = root.MT_core;
  const mesh = root.MT_mesh;
  const organic = root.MT_organic;
  const materials = root.MT_materials;
  const advanced = root.MT_advanced;

  if (!noise || !core || !mesh || !organic || !materials || !advanced) {
    console.error('[MT_engine] one or more sub-modules failed to load — make sure mt-noise.js, mt-core-modeling.js, mt-mesh-quality.js, mt-organic.js, mt-materials-uv.js, mt-advanced.js are loaded BEFORE mt-engine.js');
    return;
  }

  // ── Technique catalog (44 entries) ──────────────────────────────────
  const TECHNIQUE_CATALOG = [
    { n: 1, group: 'CORE', name: 'Primitive Modeling', fn: 'makePrimitive', description: 'Base mesh creation (box, sphere, cylinder, etc.)' },
    { n: 2, group: 'CORE', name: 'BMesh Modeling', fn: 'bmeshFromGeometry', description: 'Low-level mutable mesh (verts/edges/faces bag)' },
    { n: 3, group: 'CORE', name: 'Procedural Modeling', fn: 'proceduralGenerate', description: 'Rule-based string rewriting generation' },
    { n: 4, group: 'CORE', name: 'Parametric Modeling', fn: 'makeParametric', description: 'Parameter-driven (u,v) surface sampling' },
    { n: 5, group: 'CORE', name: 'Generative Modeling', fn: 'generativeGrow', description: 'Algorithmic growth (rule + fitness)' },
    { n: 6, group: 'CORE', name: 'SDF Modeling', fn: 'sdfEvaluate', description: 'Math-based signed distance fields' },
    { n: 7, group: 'CORE', name: 'Voxel Modeling', fn: 'voxelCarve', description: 'Volumetric modeling + marching cubes' },
    { n: 8, group: 'CORE', name: 'CSG / Boolean', fn: 'csgUnion', description: 'Solid operations via three-bvh-csg' },
    { n: 9, group: 'CORE', name: 'L-System', fn: 'lSystem', description: 'Recursive growth (Lindenmayer)' },
    { n: 10, group: 'CORE', name: 'Fractal Modeling', fn: 'fractalMandelbulb', description: 'Infinite-detail fractals (Mandelbulb/Menger)' },
    { n: 11, group: 'CORE', name: 'NURBS / Curves', fn: 'makeNurbsCurve', description: 'Spline surface modeling' },
    { n: 12, group: 'CORE', name: 'Non-Manifold', fn: 'detectNonManifold', description: 'Complex topology detection + repair' },
    { n: 13, group: 'MESH', name: 'Subdivision Surface', fn: 'subdivideCatmullClark', description: 'Smooth high-poly (Catmull-Clark / Loop)' },
    { n: 14, group: 'MESH', name: 'Remeshing', fn: 'isotropicRemesh', description: 'Topology reflow to uniform edge length' },
    { n: 15, group: 'MESH', name: 'Retopology', fn: 'autoRetopologize', description: 'Clean quad topology' },
    { n: 16, group: 'MESH', name: 'Decimation', fn: 'qemDecimate', description: 'Quadric Error Metrics poly reduction' },
    { n: 17, group: 'MESH', name: 'Triangulation', fn: 'triangulate', description: 'n-gon → triangles (ear-clipping)' },
    { n: 18, group: 'MESH', name: 'Quad Conversion', fn: 'quadify', description: 'All-quad mesh (tri → quad merge)' },
    { n: 19, group: 'MESH', name: 'Smoothing', fn: 'laplacianSmooth', description: 'Laplacian / Taubin smoothing' },
    { n: 20, group: 'MESH', name: 'Sculpting API', fn: 'sculptBrush', description: 'Digital sculpting brush (pull/push/grab/pinch)' },
    { n: 21, group: 'MESH', name: 'Displace + Noise', fn: 'displaceSurface', description: 'Vertex-shader-style noise displacement' },
    { n: 22, group: 'ORGANIC', name: 'SMPL / SMPL-X / STAR', fn: 'smplSkeleton', description: 'Statistical human body model (canonical 24 joints)' },
    { n: 23, group: 'ORGANIC', name: 'Blendshapes', fn: 'makeBlendshape', description: 'Expression target deltas' },
    { n: 24, group: 'ORGANIC', name: 'Shape Keys', fn: 'shapeKeyStore', description: 'Deformation storage with base + keys' },
    { n: 25, group: 'ORGANIC', name: 'Morph Targets', fn: 'morphTargetCompute', description: 'Mesh morphing via delta arrays' },
    { n: 26, group: 'ORGANIC', name: 'Linear Blend Skinning', fn: 'computeLBS', description: 'Bone deformation (per-vertex weighted)' },
    { n: 27, group: 'ORGANIC', name: 'Dual Quaternion Skinning', fn: 'computeDQS', description: 'Volume-preserving skinning' },
    { n: 28, group: 'ORGANIC', name: 'Implicit Skinning', fn: 'implicitSkin', description: 'Project onto smooth rest envelope' },
    { n: 29, group: 'ORGANIC', name: 'Delta Mush', fn: 'deltaMush', description: 'Smooth deformation pre/post processor' },
    { n: 30, group: 'ORGANIC', name: 'Cage Deformation', fn: 'cageDeform', description: 'Lattice control' },
    { n: 31, group: 'ORGANIC', name: 'Muscle Simulation', fn: 'muscleSim', description: 'Anatomical deform (Hill-type two-tendon)' },
    { n: 32, group: 'ORGANIC', name: 'Soft Body Simulation', fn: 'softBodySim', description: 'Verlet mass-spring on surface' },
    { n: 33, group: 'ORGANIC', name: 'Hair System', fn: 'hairStrands', description: 'Particle hair strands' },
    { n: 34, group: 'ORGANIC', name: 'Auto-Rigging', fn: 'autoRig', description: 'Skeleton generation (voxelize + 3D thinning)' },
    { n: 35, group: 'MATERIALS', name: 'PBR Material Nodes', fn: 'pbrMaterialGraph', description: 'Physically based shading via node graph' },
    { n: 36, group: 'MATERIALS', name: 'Procedural Texturing', fn: 'proceduralTextureCanvas', description: 'Math textures (noise/voronoi/brick/truchet)' },
    { n: 37, group: 'MATERIALS', name: 'UV Unwrapping', fn: 'uvUnwrap', description: 'Texture coordinates (planar/box/LSCM)' },
    { n: 38, group: 'MATERIALS', name: 'Baking', fn: 'bakeMap', description: 'Normal/AO/curvature map baking' },
    { n: 39, group: 'MATERIALS', name: 'Texture Painting', fn: 'paintTexture', description: 'Direct painting on canvas' },
    { n: 40, group: 'MATERIALS', name: 'Atlas Packing', fn: 'packAtlases', description: 'UV packing (MaxRects BSSF)' },
    { n: 41, group: 'ADVANCED', name: 'LOD Generation', fn: 'generateLOD', description: 'Level-of-detail chain' },
    { n: 42, group: 'ADVANCED', name: 'Instancing', fn: 'makeInstanced', description: 'Memory-efficient duplicates' },
    { n: 43, group: 'ADVANCED', name: 'Geometry Nodes', fn: 'geoNodesEvaluate', description: 'Node-based procedural generation' },
    { n: 44, group: 'ADVANCED', name: 'Physics Simulation', fn: 'physicsStep', description: 'Cloth/fluid particle simulator' },
  ];

  // ── Engine facade ───────────────────────────────────────────────────
  // Dispatch a named technique against a target.
  function run(technique, target, opts) {
    opts = opts || {};
    const entry = TECHNIQUE_CATALOG.find(t => t.n === technique || t.name === technique || t.fn === technique);
    if (!entry) {
      console.error('[MT_engine] unknown technique:', technique);
      return null;
    }
    const mod = {
      CORE: core, MESH: mesh, ORGANIC: organic, MATERIALS: materials, ADVANCED: advanced,
    }[entry.group];
    const fn = mod[entry.fn];
    if (typeof fn !== 'function') {
      console.error('[MT_engine] technique', technique, 'has no implementation');
      return null;
    }
    try {
      return fn(target, opts);
    } catch (e) {
      console.error('[MT_engine] technique', technique, 'failed:', e && e.message);
      return null;
    }
  }

  // Run a series of techniques in sequence (a "stack").
  function runStack(stack) {
    let target = stack.target || null;
    for (const step of stack.steps || []) {
      target = run(step.technique, target, step.opts || {});
      if (!target) break;
    }
    return target;
  }

  // Apply a technique to every mesh in a scene (mutates POSITION).
  function applyToScene(technique, scene, opts) {
    const results = [];
    scene.traverse((obj) => {
      if (!obj.isMesh && !obj.isSkinnedMesh) return;
      const before = obj.geometry.clone();
      try {
        const r = run(technique, obj.geometry, opts);
        if (r && r.isBufferGeometry) {
          obj.geometry = r;
          results.push({ mesh: obj, geometry: r, status: 'ok' });
        } else {
          results.push({ mesh: obj, before, status: 'noop' });
        }
      } catch (e) {
        results.push({ mesh: obj, before, error: e.message, status: 'error' });
      }
    });
    return results;
  }

  // Test the bundle (used at startup for sanity-check).
  function selfTest() {
    const results = { passed: 0, failed: 0, log: [] };
    function _test(name, fn) {
      try {
        const r = fn();
        results.passed++;
        results.log.push({ name, status: 'OK', info: r });
      } catch (e) {
        results.failed++;
        results.log.push({ name, status: 'FAIL', error: e && e.message });
      }
    }
    _test('mulberry32', () => {
      const rng = noise.mulberry32(42);
      if (typeof rng() !== 'number') throw new Error('mulberry32 not a function');
      return true;
    });
    _test('makePrimitive: sphere', () => {
      const g = core.makePrimitive('sphere', { size: 1 });
      if (g.attributes.position.count < 8) throw new Error('sphere empty');
      return true;
    });
    _test('makePrimitive: icosahedron', () => {
      const g = core.makePrimitive('icosahedron', { size: 1, detail: 2 });
      if (g.attributes.position.count < 12) throw new Error('icos empty');
      return true;
    });
    _test('bmeshFromGeometry + bmeshOp', () => {
      const g = core.makePrimitive('sphere', { size: 1 });
      const bm = core.bmeshFromGeometry(g);
      const before = bm.V.length;
      core.bmeshOp(bm, 'subdivide', { levels: 1 });
      if (bm.V.length <= before) throw new Error('subdivide did not add verts');
      return true;
    });
    _test('makeParametric', () => {
      const g = core.makeParametric(
        (u, v) => [Math.cos(u * Math.PI * 2) * (0.5 + 0.5 * v), v, Math.sin(u * Math.PI * 2) * (0.5 + 0.5 * v)],
        null,
        { uSegments: 12, vSegments: 6 }
      );
      if (g.attributes.position.count < 50) throw new Error('param too small');
      return true;
    });
    _test('lSystem', () => {
      const s = core.lSystem('A', [{ match: 'A', replace: 'AB' }, { match: 'B', replace: 'A' }], 4);
      if (s.length < 2) throw new Error('L-system returned short string');
      return true;
    });
    _test('subdivideCatmullClark', () => {
      const g = core.makePrimitive('sphere', { size: 1, detail: 1 });
      const before = g.attributes.position.count;
      const out = mesh.subdivideCatmullClark(g, 1);
      if (out.attributes.position.count <= before) throw new Error('CC subdivide did not refine');
      return true;
    });
    _test('qemDecimate', () => {
      const g = core.makePrimitive('sphere', { size: 1, detail: 3 });
      const before = g.attributes.position.count;
      const out = mesh.qemDecimate(g, { ratio: 0.7 });
      // 70% reduction should give roughly 30% of original verts; accept <= 90%
      if (out.attributes.position.count >= before) throw new Error(`decimate did not reduce (${out.attributes.position.count} >= ${before})`);
      if (out.attributes.position.count > before * 0.9) throw new Error(`decimate barely reduced (${out.attributes.position.count} of ${before})`);
      return true;
    });
    _test('laplacianSmooth', () => {
      const g = core.makePrimitive('sphere', { size: 1, detail: 1 });
      const out = mesh.laplacianSmooth(g, 1, 0.3);
      if (out.attributes.position.count !== g.attributes.position.count) throw new Error('smooth changed vert count');
      return true;
    });
    _test('displaceSurface', () => {
      // use a sphere (which has normals in all directions) so displacement
      // affects multiple axes (planes only displace along normal = Z)
      const g = core.makePrimitive('sphere', { size: 1, detail: 3 });
      const before = Array.from(g.attributes.position.array);
      mesh.displaceSurface(g, { amplitude: 0.1, frequency: 4, seed: 1 });
      let changed = false;
      for (let i = 0; i < before.length; i++) {
        if (Math.abs(g.attributes.position.array[i] - before[i]) > 1e-6) { changed = true; break; }
      }
      if (!changed) throw new Error('displace did not modify verts');
      return true;
    });
    _test('uvUnwrap planar', () => {
      const g = core.makePrimitive('plane', { size: 1 });
      materials.uvUnwrap(g, { method: 'planar', axis: 'y' });
      if (!g.attributes.uv) throw new Error('planar uv not generated');
      return true;
    });
    _test('proceduralTextureCanvas', () => {
      const r = materials.proceduralTextureCanvas({ type: 'noise', scale: 4, seed: 1 }, { size: 64 });
      if (!r.texture) throw new Error('no texture returned');
      return true;
    });
    _test('packAtlases', () => {
      const r = materials.packAtlases([
        { name: 'a', width: 100, height: 100 },
        { name: 'b', width: 200, height: 200 },
        { name: 'c', width: 50, height: 50 },
      ], { width: 512, height: 512 });
      if (r.length !== 3) throw new Error('packAtlases wrong count');
      return true;
    });
    _test('generateLOD', () => {
      const g = core.makePrimitive('sphere', { size: 1, detail: 2 });
      const chain = advanced.generateLOD(g, { levels: 3 });
      if (chain.length !== 4) throw new Error('LOD wrong chain length');
      return true;
    });
    _test('makeInstanced', () => {
      const g = core.makePrimitive('box', { size: 1 });
      const im = advanced.makeInstanced(g, 5, { distribution: 'random', seed: 1 });
      if (im.count !== 5) throw new Error('instancing wrong count');
      return true;
    });
    _test('physicsStep + buildClothWorld', () => {
      const w = advanced.buildClothWorld({ nx: 4, ny: 4, spacing: 0.1 });
      advanced.physicsStep(w, 0.016, { gravity: [0, -9.8, 0] });
      return true;
    });
    return results;
  }

  const api = {
    catalog: TECHNIQUE_CATALOG,
    run,
    runStack,
    applyToScene,
    selfTest,
    // re-export all submodules under a single namespace
    noise,
    core,
    mesh,
    organic,
    materials,
    advanced,
  };

  if (typeof window !== 'undefined') window.MT = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // Quick console banner so users see the bundle loaded.
  console.log(
    '%c[MT]%c 44-Technique Modeling Bundle loaded — PART 100-143.\n' +
    '    window.MT = { run, runStack, applyToScene, selfTest, catalog, core, mesh, organic, materials, advanced, noise }\n' +
    '    44 helpers across CORE / MESH / ORGANIC / MATERIALS / ADVANCED.\n' +
    '    Run window.MT.selfTest() to verify the bundle.',
    'background:#4fc3f7;color:#000;padding:2px 6px;border-radius:3px;font-weight:bold',
    'color:#4fc3f7'
  );
})(typeof window !== 'undefined' ? window : globalThis);
