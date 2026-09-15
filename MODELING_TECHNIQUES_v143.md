# MT_v143 — 44-Technique Modeling Bundle (PART 100-143)

This file is the **renderer-side spec annex** for the 44-Technique
Modeling Bundle. It documents the new opt-in capability bundle that
adds comprehensive 3D modeling technique coverage to the LBL v1.24/v1.25
renderer (TS path) and v8.16/v8.17 (JSON path).

Companion to:
- `index.html` — the renderer host
- `public/modeling/mt-*.js` — the implementation modules

---

## What's new — a complete 3D modeling toolkit in the browser

The renderer previously shipped primitives + lattice/parametric
building blocks (PART 18) plus some procedural texturing (PART 67/74).
This bundle fills out the *complete* modern 3D modeling technique
vocabulary so any model the AI describes can be authored server-side
through the renderer.

**All 44 techniques from the user's request, grouped:**

### CORE MODELING (PART 100-111)
1.  **Primitive Modeling** — `MT.core.makePrimitive(kind, opts)`
2.  **BMesh Modeling** — `MT.core.bmeshFromGeometry(geom)`, `bmeshOp(bm, 'extrude'|'subdivide'|…)`
3.  **Procedural Modeling** — `MT.core.proceduralGenerate(axiom, rules, iterations)`
4.  **Parametric Modeling** — `MT.core.makeParametric(uFn, vFn, opts)`
5.  **Generative Modeling** — `MT.core.generativeGrow({iterations, stepLength, bias, fitness, branchProb, seed})`
6.  **SDF Modeling** — `MT.core.sdfEvaluate`, `sdfUnion`, `sdfSphere`, `sdfMarch`
7.  **Voxel Modeling** — `MT.core.voxelCarve(geom)`, `marchingCubesFromVoxels(vg)`
8.  **CSG / Boolean** — `MT.core.csgUnion`, `csgSubtract`, `csgIntersect` (via three-bvh-csg)
9.  **L-System** — `MT.core.lSystem(axiom, rules, iters)`, `lSystemInterpret(str, opts)`
10. **Fractal Modeling** — `MT.core.fractalMandelbulb`, `fractalMenger`, `fractalRaymarch`
11. **NURBS / Curves** — `MT.core.makeNurbsCurve(ctrl, degree, knots)`, `makeCatmullRom(points, opts)`
12. **Non-Manifold** — `MT.core.detectNonManifold(geom)`, `fixNonManifold(geom)`

### MESH QUALITY (PART 112-120)
13. **Subdivision Surface** — `MT.mesh.subdivideCatmullClark`, `subdivideLoop`
14. **Remeshing** — `MT.mesh.isotropicRemesh(geom, {targetEdgeLength, iterations})`
15. **Retopology** — `MT.mesh.autoRetopologize(geom)`
16. **Decimation** — `MT.mesh.qemDecimate(geom, {ratio|targetCount})`
17. **Triangulation** — `MT.mesh.triangulate(polygon, indices)`
18. **Quad Conversion** — `MT.mesh.quadify(geom, {angleThreshold})`
19. **Smoothing** — `MT.mesh.laplacianSmooth`, `taubinSmooth`
20. **Sculpting API** — `MT.mesh.sculptBrush(geom, {centre, radius, mode, …})`
21. **Displace + Noise** — `MT.mesh.displaceSurface(geom, {amplitude, frequency, octaves, …})`

### HUMAN / ORGANIC (PART 121-133)
22. **SMPL / SMPL-X / STAR** — `MT.organic.smplSkeleton`, `smplBuild`, `smplApplyShape`
23. **Blendshapes** — `MT.organic.makeBlendshape(targetGeom, name, weight)`
24. **Shape Keys** — `MT.organic.shapeKeyStore`, `shapeKeyEvaluate`
25. **Morph Targets** — `MT.organic.morphTargetCompute`
26. **Linear Blend Skinning** — `MT.organic.computeLBS`, `lbsSkin`
27. **Dual Quaternion Skinning** — `MT.organic.computeDQS`, `dqsSkin`
28. **Implicit Skinning** — `MT.organic.implicitSkin(geom, {envelope})`
29. **Delta Mush** — `MT.organic.deltaMush(geom, {iterations, steps})`
30. **Cage Deformation** — `MT.organic.buildCage`, `cageDeform`
31. **Muscle Simulation** — `MT.organic.muscleSim(muscles, activations, {geom})`
32. **Soft Body Simulation** — `MT.organic.softBodySim(geom, {gravity, dt, …})`
33. **Hair System** — `MT.organic.hairStrands(geom, {count, segments, length})`
34. **Auto-Rigging** — `MT.organic.autoRig(geom, {resolution})`

### MATERIALS & UV (PART 134-139)
35. **PBR Material Nodes** — `MT.materials.pbrMaterialGraph(nodes, opts)`
36. **Procedural Texturing** — `MT.materials.proceduralTextureCanvas(spec, {size})`
37. **UV Unwrapping** — `MT.materials.uvUnwrap(geom, {method:'planar'|'box'|'lscm'})`
38. **Baking** — `MT.materials.bakeMap(geom, 'normal'|'ao'|'curvature', {size})`
39. **Texture Painting** — `MT.materials.paintTexture(canvas, brush)`
40. **Atlas Packing** — `MT.materials.packAtlases(rects, {width, height})`

### OPTIMIZATION & ADVANCED (PART 140-143)
41. **LOD Generation** — `MT.advanced.generateLOD(geom, {levels, minVerts})`
42. **Instancing** — `MT.advanced.makeInstanced(geom, count, {distribution, seed, …})`
43. **Geometry Nodes** — `MT.advanced.geoNodesEvaluate([...nodes])`
44. **Physics Simulation** — `MT.advanced.physicsStep(world, dt)`, `buildClothWorld`, `buildFluidWorld`

---

## Engine entry point

```js
window.MT.run(technique, target, opts)         // dispatch by name/number
window.MT.runStack({ target, steps })          // ordered stack
window.MT.applyToScene(technique, scene, opts) // every mesh in scene
window.MT.selfTest()                           // 16-bundle sanity check
window.MT.catalog                              // the 44-entry catalog
```

## Module map

| File | Exposes | Module |
|---|---|---|
| `mt-noise.js` | PRNG + 2D/3D noise (mulberry32, perlin, value, fbm, voronoi, simplex) | `window.MT_noise` |
| `mt-core-modeling.js` | 1-12 (core) | `window.MT_core` |
| `mt-mesh-quality.js` | 13-21 (mesh quality) | `window.MT_mesh` |
| `mt-organic.js` | 22-34 (human/organic) | `window.MT_organic` |
| `mt-materials-uv.js` | 35-40 (materials/UV) | `window.MT_materials` |
| `mt-advanced.js` | 41-44 (optimization/advanced) | `window.MT_advanced` |
| `mt-engine.js` | dispatcher + catalog | `window.MT` |

## Loading

Add to `index.html` import map:

```html
"mt-noise": "./public/modeling/mt-noise.js",
"mt-core-modeling": "./public/modeling/mt-core-modeling.js",
"mt-mesh-quality": "./public/modeling/mt-mesh-quality.js",
"mt-organic": "./public/modeling/mt-organic.js",
"mt-materials-uv": "./public/modeling/mt-materials-uv.js",
"mt-advanced": "./public/modeling/mt-advanced.js",
"mt-engine": "./public/modeling/mt-engine.js"
```

Then eagerly import:

```js
await import('mt-noise');
await import('mt-core-modeling');
// …
await import('mt-engine');
// → window.MT now has all 44 helpers
```

## Determinism contract (PART 74-aligned)

- All helpers are **deterministic** given the same seed.
- Default seed: `1`. Pass `opts.seed = <number>` to vary.
- PRNG: `mulberry32` (PART 74 shared).
- Hash: `fnv1a` for sub-seed derivation.
- Same input → same output, every reload.

## Examples

```js
// (1) primitive
const sphere = MT.core.makePrimitive('sphere', { size: 2, detail: 3 });

// (13) subdivide × 2
const fine = MT.mesh.subdivideCatmullClark(sphere, 2);

// (16) decimate 50%
const low = MT.mesh.qemDecimate(fine, { ratio: 0.5 });

// (21) displace
MT.mesh.displaceSurface(fine, { amplitude: 0.05, frequency: 4, seed: 7 });

// (22) SMPL humanoid
const skel = MT.organic.smplSkeleton();
const body = MT.organic.smplBuild();

// (28) implicit skin
const skinned = MT.organic.implicitSkin(body.geometry);

// (41) LOD chain
const chain = MT.advanced.generateLOD(fine, { levels: 4 });

// (42) instances
const grass = MT.advanced.makeInstanced(bladeGeo, 1000, { distribution: 'random', spread: 50, seed: 1 });

// (44) cloth
const world = MT.advanced.buildClothWorld({ nx: 16, ny: 16, spacing: 0.05 });
MT.advanced.physicsStep(world, 1 / 60, { gravity: [0, -9.8, 0] });
```

## What this bundle intentionally does NOT do

- **No external asset loading.** Everything is procedural / CPU. No
  .pkl / .npz / .fbx files. SMPL, hair, muscles — all procedural
  approximations suitable for LBL v1.25 default models.
- **No GPU compute.** Marching cubes uses the THREE addon (CPU-ready
  GPU); physics is a CPU Verlet integrator for browser compatibility.
- **No new PART 32/65 anti-pattern flags.** This bundle is purely
  additive; it never invalidates an existing model.

## Validation (PART 38/39-style)

After loading the bundle, run `window.MT.selfTest()` to confirm all 44
techniques produce a sane result for a small input. The test prints a
console summary with `passed`/`failed` counts.

---

## Companion methodology: PART 145-152 Perfect-Shape Modeling Pipeline

The 44 techniques above are the **vocabulary**. PART 145-152 is the
**methodology** that orchestrates them into the 8-step "build a real
shape" pipeline. See `CHANGES_v130.md` for the full release notes.

The pipeline generalizes beyond the pirate robot — it applies to any
chunky low-poly character (creature, mascot, prop, vehicle), and to
most other 3D styles (chunkier the model, smaller the rotations).

  - **PART 145** — THE 8-STEP PIPELINE (analyze / skeleton-first /
    cross-section profiles / loft / position accessories / uniform
    bevel / rig+validate / animate).
  - **PART 146** — SHAPE-CREATION TECHNIQUES (8 named methods: profile
    lofting / lathe / extrude / CSG / SDF+MarchingCubes / subdivision
    / NURBS / procedural deformers).
  - **PART 147** — MATERIAL & SURFACE TECHNIQUES (5 named methods:
    microRoughnessMap / striate / punctate / curvature / cavity-dirt
    AO).
  - **PART 148** — RIGGING TECHNIQUES (6 named methods: pivot offsets
    = mesh lengths / hierarchy = anatomy / naming convention / rigid
    binding / smooth binding / auto-rig validation).
  - **PART 149** — ANIMATION TECHNIQUES (6 named methods: rest pose
    first / phase-offset / NodeName.property track names / loop
    frame equality / headless playback test / secondary motion).
  - **PART 150** — VALIDATION & QA TECHNIQUES (6 named methods:
    silhouette from 4 angles / multi-view IoU / triangle budget /
    bbox overlap / height match / cheat-sheet check).
  - **PART 151** — PITFALLS (10 named pitfalls with concrete fixes).
  - **PART 152** — REFERENCE CHEAT-SHEET (10-step canonical recipe
    for any chunky low-poly character).

The 44 PART 100-143 helpers above are the LOW-LEVEL primitives. PART
145-152 tells the AI factory **when** to use each one. The highest-
leverage technique picks per use case are:

  - **Limbs** → PART 146.1 (profile loft) + PART 146.6 (subdivision)
  - **Hats / bowls / hook curves** → PART 146.2 (lathe)
  - **Belts / harnesses / panels / capes** → PART 146.3 (extrude) +
    PART 146.4 (CSG for buckle slot)
  - **Hard-surface recesses (panels, screws, eye patch socket)** →
    PART 146.4 (CSG subtract)
  - **Organic blob creatures** → PART 146.5 (SDF + Marching Cubes)
    [THE canonical fix for visible intersections, Pitfall 1]
  - **Curved paths (cables, hat brim, swept horns / tails /
    tentacles)** → PART 146.7 (NURBS / splines)
  - **Tweaking existing primitives into the right shape** →
    PART 146.8 (procedural deformers / PART 67 modifier stack)
  - **Every material** → PART 147.1 (microRoughnessMap) +
    PART 147.5 (cavity-dirt AO)
  - **Body panels + cylinder limbs** → PART 147.2 (striate maps)
  - **Rivets / screws / bolt holes** → PART 147.3 (punctate maps)
  - **Polished rim, dull field** → PART 147.4 (curvature-driven
    material variation)
  - **Every joint** → PART 148.1 (pivot offsets = mesh lengths)
  - **Chunky mesh binding** → PART 148.4 (rigid binding via PART 30.7
    auto-promotion)
  - **Organic surface binding** → PART 148.5 (smooth binding via
    PART 34 buildSemanticWeights or PART 75.2 geodesic weights)
  - **Every animation** → PART 149.1-149.6 (rest pose first,
    phase-offset, NodeName.property tracks, loop frame equality,
    headless playback test, secondary motion)
  - **Every model before shipping** → PART 150.1-150.6 (silhouette
    from 4 angles, multi-view IoU, triangle budget, bbox overlap,
    height match, cheat-sheet check)
  - **Pre-emission checklist** → PART 151 (10 named pitfalls; verify
    fixes for #1, 2, 3, 4, 5, 6, 8, 9, 10 before shipping any chunky
    character)
  - **Ship list** → PART 152 (10-step canonical recipe)

PART 145-152 is STYLE-AGNOSTIC and is published as the meta-layer
above the 44 techniques in this annex. Read both documents together
for the complete picture.

---

**License:** Same as the parent project. Author: Mavis / RDJ Publishers
low_poly_3d renderer surface. See LICENSE-3RD-PARTY.md.
