# EXAMPLES_MT — Worked Examples for PART 100-143

This file is the **worked-example annex** to the 44-Technique
Modeling Bundle (PART 100-143, MT). Companion to
`MODELING_TECHNIQUES_v143.md`. Each example is a **complete,
copy-pasteable snippet** that demonstrates a real technique from
the bundle.

**Cross-references:**
- Module map: see `MODELING_TECHNIQUES_v143.md`
- Renderer code: see `public/modeling/mt-*.js` (6 modules + facade)
- Reference model: `public/models/Model_3.ts` (a complex scene
  that exercises PART 41-44 LOD + instancing + physics).

---

## Example 1 — Procedural humanoid with SMPL topology (PART 22)

Build a canonical 24-joint humanoid skeleton + a procedural body
geometry, then dress it with muscle simulation.

```js
const skel = MT.organic.smplSkeleton({ seed: 1 });
const body = MT.organic.smplBuild({ seed: 1 });
// Adjust body shape via 10 SMPL betas
MT.organic.smplApplyShape(body, [0.2, 0.1, 0.3, 0.0, -0.1, 0, 0, 0, 0, 0]);
scene.add(new THREE.Mesh(body, new THREE.MeshStandardMaterial({ color: 0xc4a78a })));
```

What this activates:
- 24-joint canonical humanoid topology (PART 22.1)
- 10-dim shape space deformation (PART 22.4)
- The body's userData.rigGraph is set so the existing three-rig-helpers
  panel can list joints / bind skin weights / play clips.

---

## Example 2 — Subdivide + decimate (PART 13 + 16)

Take a low-poly sphere, refine it via Catmull-Clark, then decimate
the high-poly result back to the original vert count.

```js
const low = MT.core.makePrimitive('sphere', { size: 1, detail: 1 });
const hi = MT.mesh.subdivideCatmullClark(low, 2);
const restored = MT.mesh.qemDecimate(hi, { ratio: 0.6 });
```

What this activates:
- PART 13.1 Catmull-Clark subdivision (4× verts per level)
- PART 16.1 QEM decimation (60% reduction target)

---

## Example 3 — Instanced grass field (PART 42)

2000 grass blades scattered across a plane, deterministically seeded.

```js
const blade = MT.core.makePrimitive('plane', { size: 0.3 });
const grass = MT.advanced.makeInstanced(blade, 2000, {
  distribution: 'random',
  spread: 30,
  minScale: 0.8,
  maxScale: 1.4,
  seed: 7,
});
scene.add(grass);
```

What this activates:
- PART 42.2 InstancedMesh with random distribution
- Same seed = same grass field on every reload

---

## Example 4 — Cloth simulation (PART 44)

A 16×16 mass-spring cloth pinned at two corners, gravity-pulled,
integrated at 60Hz.

```js
const world = MT.advanced.buildClothWorld({ nx: 16, ny: 16, spacing: 0.05 });
// animate
function tick() {
  MT.advanced.physicsStep(world, 1/60, { gravity: [0, -9.8, 0] });
  // update geometry from world.particles positions
  requestAnimationFrame(tick);
}
tick();
```

What this activates:
- PART 44.1 Verlet mass-spring cloth (3 constraint types:
  structural, shear, bend)
- PART 44.2 Fixed-timestep gravity integration

---

## Example 5 — Procedural texture atlas (PART 36 + 40)

Generate 6 procedural textures, pack them into a 1024² atlas, then
assign to a MeshStandardMaterial.

```js
const variants = ['noise', 'voronoi', 'brick', 'stripe', 'truchet', 'cairo']
  .map((t, i) => ({ name: t, canvas: MT.materials.proceduralTextureCanvas({ type: t, scale: 8, seed: i+1 }, { size: 256 }).canvas }));
const rects = variants.map(v => ({ name: v.name, width: v.canvas.width, height: v.canvas.height }));
const packed = MT.materials.packAtlases(rects, { width: 1024, height: 1024 });
// paste each canvas into the atlas at packed[i].x/y
```

---

## Example 6 — Fractal surface (PART 10)

Raymarch a Mandelbulb fractal and surface it via Marching Cubes.

```js
const mandelbulb = MT.core.fractalMandelbulb({ power: 8, iterations: 8 });
const fractalMesh = MT.core.fractalRaymarch(mandelbulb, { resolution: 64, size: 4 });
scene.add(fractalMesh);
```

---

## Example 7 — L-system tree (PART 9)

A classic 60° branching L-system tree rendered as line segments
with thickness.

```js
const tree = MT.core.lSystem('F', [
  { match: 'F', replace: 'F[+F]F[-F][F]' }
], 4);
const treeGeom = MT.core.lSystemInterpret(tree, {
  stepLength: 0.2,
  angle: Math.PI / 6,
  thickness: 0.05,
  seed: 1,
});
scene.add(new THREE.Mesh(treeGeom, new THREE.MeshStandardMaterial({ color: 0x4a3020 })));
```

---

## Example 8 — LOD chain (PART 41)

Generate a 5-level LOD chain for a complex model and wire it into a
THREE.LOD node.

```js
const base = MT.organic.smplBuild({ seed: 1 });
const chain = MT.advanced.generateLOD(base, { levels: 4, minVerts: 64 });
const lod = new THREE.LOD();
chain.forEach((g, i) => {
  lod.addLevel(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xc4a78a })), i * 5);
});
scene.add(lod);
```

---

## Example 9 — Apply a technique to every mesh in a scene (PART 90-style)

```js
MT.applyToScene('laplacianSmooth', scene, { iterations: 2, factor: 0.3 });
MT.applyToScene('displaceSurface', scene, { amplitude: 0.02, frequency: 4, seed: 7 });
```

What this activates:
- PART 19.1 Laplacian smoothing across the whole scene
- PART 21.1 Surface displacement noise
- Both opt-in, neither mutates anything until you call

---

## Example 10 — Self-test (PART 143.4)

```js
const result = window.MT.selfTest();
console.log(`${result.passed}/${result.log.length} passed`);
result.log.forEach(l => {
  console.log(`  ${l.status === 'OK' ? '✓' : '✗'} ${l.name}${l.error ? ': ' + l.error : ''}`);
});
```

What this activates:
- PART 143.4 — bundle-level sanity check
- 16 representative checks: PRNG, primitives, BMesh, parametric,
  L-system, subdivision, decimation, smoothing, displacement,
  UV unwrap, procedural texture, atlas packing, LOD chain,
  instancing, cloth physics.

---

## Notes on PART 74 contract compliance

All examples above are **deterministic**:
- Same `seed` → same output
- No external assets fetched
- No network round-trips
- Sub-seed derivation via FNV-1a (PART 74 helper)
- Same noise functions as PART 74 procedural-texturing bundle

The MT bundle is purely additive — it never invalidates an existing
model. The renderer keeps every existing capability (PARTs 1-89 +
PART 90 ACES + PART 45 CS2 + PART 67 + PART 74).

---

**License:** Same as parent project. Author: Mavis / RDJ Publishers
low_poly_3d renderer surface. See LICENSE-3RD-PARTY.md.
