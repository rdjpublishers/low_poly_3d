# EXAMPLES_MT_ARCHITECTURAL — Worked Examples for PART 190-199

This file is the **worked-example annex** for the Architectural Modeling
Bundle (PART 190-199, MT_architectural). Companion to
`mt-architectural.js`. Each example is a **complete, copy-pasteable
snippet** that demonstrates a real architectural technique from the
bundle.

**Cross-references:**
- Module source: `public/modeling/mt-architectural.js` (1095 lines,
  8 helpers + schema linter + look-dev lights)
- Spec source: `Prompt_To_Ts.txt` PART 190-199
- Reference model: `public/models/Model_5.ts` (a procedural building
  that exercises the helpers end-to-end)

---

## Example 1 — Piecewise sub-wall with 1 door + 2 windows (PART 192)

Build a 4 m × 3 m × 0.30 m stucco wall with one front door and two
flanking windows, then verify the apertures are actually hollow.

```js
const palette = MT_architectural.materialPalette();
const wall = MT_architectural.createWallWithApertures(
  4,        // wallW
  3,        // wallH
  0.3,      // wallT
  [
    { x:  0.0, y: 0.45, w: 1.20, h: 2.10 },   // front door
    { x: -1.5, y: 0.90, w: 1.00, h: 1.20 },   // left window
    { x:  1.5, y: 0.90, w: 1.00, h: 1.20 },   // right window
  ],
  palette.stuccoWhite,
  'facade/frontStucco'
);
scene.add(wall);
```

What this activates:
- PART 192.1 slab-grid decomposition — the wall is built as a grid of
  `O(widthBreaks × heightBreaks)` slabs with cavities removed where
  apertures overlap, so no CSG runtime cost and no face overlaps.
- PART 192.2 userData.featureId is set on every child slab.
- PART 191 stacking — wall sits at `STACK_INDEX.WALL_FACE.z = 0`, glass
  will sit at `+0.020 m`.

---

## Example 2 — Double teak door with kinematic hinges (PART 193)

A 1.4 m × 2.1 m double door with glass inserts and metal pulls. Toggle
open/close via the returned `open()` / `close()` helpers.

```js
const palette = MT_architectural.materialPalette();
const door = MT_architectural.createHingedDoorUnit({
  width: 1.4,
  height: 2.1,
  depth: 0.05,
  leaves: 2,                       // double door
  hingeSide: 'split',              // left leaf hinges on left jamb
  doorMaterial: palette.teakWood,
  handleMaterial: palette.darkMetalTrim,
  withGlassInsert: true,
  glassMaterial: palette.windowGlass,
  namePrefix: 'door/doubleTeak',
});
door.rootGroup.position.set(0, 0.45, 0);   // sits on the door sill
scene.add(door.rootGroup);

// Later, animate:
button.onclick = () => door.toggle(true);  // swing both leaves inward
```

What this activates:
- PART 193.1 dual-pivot kinematic hierarchy (RootGroup → HingeGroup →
  LeafMesh → Glass/Handle).
- PART 193.2 hinge offsets each leaf by `±leafWidth/2` so the HingeGroup
  local origin sits exactly on the jamb axis.
- PART 193.3 `toggle(open)` swings both leaves inward by ~70°.
- PART 186.5 userData.featureId = `door/doubleTeak` — the PART 199
  schema linter can grep this.

---

## Example 3 — Multi-pane casement window (PART 194)

A 1.2 m × 1.0 m charcoal-framed window with a 2×2 mullion grid and
inset glass.

```js
const palette = MT_architectural.materialPalette();
const win = MT_architectural.createGlazedWindowUnit({
  width: 1.2,
  height: 1.0,
  depth: 0.08,
  frameThickness: 0.06,
  frameMaterial: palette.darkCharcoal,
  glassMaterial: palette.windowGlass,
  mullionsX: 2,
  mullionsY: 2,
  sillMaterial: palette.stonePavers,    // distinct sill material
  namePrefix: 'window/casement',
});
win.position.set(0, 0.9, 0);
scene.add(win);
```

What this activates:
- PART 194.1 frame + glass + mullions assembled as 7+ children.
- PART 194.2 glass offset by `STACK_INDEX.GLASS.z = +0.020 m` so the
  pane doesn't z-fight with the back face of the frame.
- PART 194.3 mullion grid: `mullionsX - 1` vertical + `mullionsY - 1`
  horizontal bars.

---

## Example 4 — Pitched gable roof with tile rows (PART 195)

A 4 m × 6 m terracotta-tile gable roof with 6 tile rows per slope.

```js
const palette = MT_architectural.materialPalette();
const roof = MT_architectural.createPitchedGableRoof({
  width: 4,
  depth: 6,
  pitch: 0.5,            // rise / run
  overhang: 0.5,
  tileRows: 6,
  tileMaterial: palette.roofTile,
  ridgeMaterial: palette.darkMetalTrim,
  namePrefix: 'roof/terracottaGable',
});
roof.position.set(0, 3, 0);    // sits on top of the wall
scene.add(roof);
```

What this activates:
- PART 195.1 two slanted slabs (custom BufferGeometry, no addon dep).
- PART 195.2 N tile rows per slope with PART 191 micro-epsilon Y
  staggering (`+0.012 * (i % 2)`) so adjacent rows never z-fight.
- PART 195.3 ridge cap as a thin slab along the apex.

---

## Example 5 — Landscape: potted plant + stepping-stone path (PART 197 + 198)

A planter and a 6-stone path, both deterministic via mulberry32 seed.

```js
const palette = MT_architectural.materialPalette();

// Potted plant near the entrance
const plant = MT_architectural.createPottedPlant({
  potRadius: 0.18,
  potHeight: 0.32,
  foliageCount: 5,
  foliageMaterial: palette.foliageGreen,
  potMaterial: palette.darkCharcoal,
  seed: 7,
  namePrefix: 'landscape/pottedPlant',
});
plant.position.set(2.0, 0.42, 1.5);
scene.add(plant);

// Stepping-stone path along the lawn
const path = MT_architectural.createSteppingStonePath({
  count: 6,
  baseX: -2, baseZ: 3,
  endX:  2, endZ: 3,
  stepSize: 0.35,
  radius: 0.18,
  material: palette.stonePavers,
  seed: 42,
  yLevel: 0.37,                       // PART 191 PAVERS offset
  namePrefix: 'landscape/steppingStones',
});
scene.add(path);
```

What this activates:
- PART 197.1 truncated-cone pot via `CylinderGeometry(..., true)`.
- PART 197.2 deterministic seeded foliage scatter (same seed → same
  shape on every reload).
- PART 198.1 quadratic Bezier path with perpendicular bow + per-stone
  jitter.
- PART 198.2 PART 191 PAVERS Y offset — stones never z-fight with the
  lawn plane below.

---

## Example 6 — Schema linter + look-dev lighting (PART 199)

After assembling the scene, run the schema linter against the
`detailInventory` contract, then mount the warmglow look-dev lights.

```js
const inventory = [
  { id: 'facade/frontStucco',  required: true, regex: /^facade\//i },
  { id: 'door/doubleTeak',     required: true, regex: /^door\//i },
  { id: 'window/casement',     required: true, regex: /^window\//i },
  { id: 'roof/terracottaGable',required: true, regex: /^roof\//i },
  { id: 'attic/louverVent',    required: true, regex: /^attic\//i },
  { id: 'landscape/pottedPlant',       required: false, regex: /pottedPlant/i },
  { id: 'landscape/steppingStones',    required: false, regex: /steppingStones/i },
];

const report = MT_architectural.schemaNamespacingLinter(scene, inventory);
console.log('Lint passed:', report.passed);
console.log('Missing:', report.missing);
console.log('Coplanar collisions:', report.coplanar);

// Mount the lighting rig
const lights = MT_architectural.createArchitecturalLookDevLights('warmglow');
scene.add(lights);
```

What this activates:
- PART 199.1 regex-based featureId/matching against the scene graph —
  catches missing required features.
- PART 199.2 coplanar collision detection (5 mm world-space grid key)
  — catches Z-fighting regressions.
- PART 199.3 4 lighting modes: `day` / `dusk` / `night` / `warmglow`.
  Each returns a Group with the right ambient + hemi + directional +
  point mix.

---

## What this activates (one-paragraph summary)

The renderer now ships an architectural modeling pipeline as an
additive bundle on top of PART 100-143 (44 helpers on window.MT) and
PART 167-178 (hard-surface / vehicle modeling). PART 190 documents
when to reach for these helpers vs. raw `THREE.BoxGeometry`. PART 191
formalises the stacking index (the anti-Z-fighting micro-epsilon
ladder) so every concentric surface has a deterministic Y/Z offset.
PART 192-198 ship 7 parametric constructors (walls with apertures,
hinged doors, glazed windows, pitched gable roofs, louvered attic
vents, potted plants, stepping-stone paths). PART 199 ships the
schema namespacing linter + a 4-mode look-dev lighting rig +
a canonical 9-key material palette. Together they let the AI factory
author a fully hollow, fully z-fight-free, fully schema-compliant
building in ~150 lines of TS where the previous monolithic approach
needed ~1800.

The renderer keeps every existing capability (PARTs 1-189 + PART 90
ACES + PART 45 CS2 + PART 67 + PART 74 + PART 100-143 MT bundle +
PART 167-179 hardsurface helpers); PART 190-199 is purely additive.

---

## Pitfalls (the 5 architectural gotchas)

PITFALL 1: Skipping the aperture decomposition and CSG-subtracting
  openings out of a solid box. Symptom: hollow cavities are not
  actually hollow, door and windows embed inside opaque concrete.
  Fix: always use `createWallWithApertures()` instead of CSG.

PITFALL 2: Forgetting the leaf X-offset on the HingeGroup. Symptom:
  the door swings around its centre like a revolving turnstile.
  Fix: `leaf.position.set(sign * leafW / 2, ...)` so the HingeGroup
  local origin sits on the jamb axis (PART 193.2).

PITFALL 3: Glass and frame on the same Z plane. Symptom: visible
  z-fighting flicker from any oblique camera angle.
  Fix: `STACK_INDEX.GLASS.z = +0.020 m` (PART 191, PART 194.2).

PITFALL 4: Mesh name with a slash that some downstream exporter
  rejects (`/`, `\` are illegal in some FBX/OBJ exporters). Symptom:
  GLB export fails or strips the name.
  Fix: keep `mesh.name` clean (e.g. `DoorHinge_Left`) and store the
  schema qualification in `userData.featureId` (`'door/doubleTeak'`).
  The PART 199 linter reads BOTH paths so this is safe.

PITFALL 5: Mutating a shared material instance during an interactive
  highlight event. Symptom: clicking one window turns all windows in
  the building red at once.
  Fix: `mesh.material = (mesh.material as THREE.MeshStandardMaterial).clone();`
  BEFORE the per-instance mutation.

---

## File size budget

`mt-architectural.js` is 47 KB / 1095 lines, fits comfortably under
the 200 KB-per-module cap that PART 100-143 established for the rest
of the MT bundle.
