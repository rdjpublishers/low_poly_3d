# EXAMPLES_v8_17 — Worked Examples for PART 75-89

This file is the **worked-example annex** to the v8.17 spec (PART 75-89
in `Prompt_To_*.txt`). It's intentionally a separate, smaller file so
the AI can read it without scanning the full 24,000+ line spec.

Each example is a **complete, self-contained JSON snippet** that the
AI can pattern-match against. The numbers (joint counts, amplitudes,
frequencies) are illustrative — the AI should adjust them to the
subject.

**Cross-references:**
- Full spec: see PART 75-89 in `Prompt_To_Json.txt` / `_Js.txt` / `_Ts.txt`
- Renderer code: see `public/rig/three-rig-helpers.js` + the PART 75-88
  stubs in `index.html`
- Reference model: see `public/models/Model_6.ts` (a low-poly fox that
  uses 6 of these patterns together)
- License: see `LICENSE-3RD-PARTY.md` (PART 84)

---

## Example 1 — Minimal humanoid with geodesic weights (PART 75.2)

A 13-bone humanoid in a 1.0m A-pose with the v8.17 default skin mode.
This is the most common opt-in pattern; ship it whenever the model has
visible humanoid anatomy.

```json
{
  "userData": {
    "rigGraph": {
      "class": "humanoid",
      "joints": [
        { "id": "Bone_Root",     "restPosition": [0, 0.00, 0], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_Pelvis",   "parentId": "Bone_Root", "restPosition": [0, 1.00, 0], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_Spine",    "parentId": "Bone_Pelvis", "restPosition": [0, 1.20, 0], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_Chest",    "parentId": "Bone_Spine",  "restPosition": [0, 1.45, 0], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_Head",     "parentId": "Bone_Chest",  "restPosition": [0, 1.75, 0], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_Thigh_L",  "parentId": "Bone_Pelvis", "restPosition": [ 0.10, 0.55, 0], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_Calf_L",   "parentId": "Bone_Thigh_L", "restPosition": [ 0.10, 0.25, 0], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_Foot_L",   "parentId": "Bone_Calf_L",  "restPosition": [ 0.10, 0.05, 0.10], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_Toe_L",    "parentId": "Bone_Foot_L",  "restPosition": [ 0.10, 0.02, 0.20], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_Thigh_R",  "parentId": "Bone_Pelvis", "restPosition": [-0.10, 0.55, 0], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_Calf_R",   "parentId": "Bone_Thigh_R", "restPosition": [-0.10, 0.25, 0], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_Foot_R",   "parentId": "Bone_Calf_R",  "restPosition": [-0.10, 0.05, 0.10], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_Toe_R",    "parentId": "Bone_Foot_R",  "restPosition": [-0.10, 0.02, 0.20], "restRotation": [0, 0, 0, 1] }
      ]
    },
    "skeletonSource": "three-rig-helpers",
    "rigOptions": {
      "skin": "geodesic",
      "maxInfluences": 4
    }
  }
}
```

What this activates:
- `class: "humanoid"` → PART 76 picks the 13-bone canonical catalog.
- `skin: "geodesic"` → PART 75.2 BFS-over-mesh-edges weights
  (the v8.17 default for humanoids; the v8.16 default was
  `semantic`).

---

## Example 2 — Quadruped with the auto-loaded template (PART 76.3)

If you don't want to hand-author every joint, drop a 19-bone
quadruped template. The renderer fetches `public/rig/skeletons/
quadruped.json` and scales it to the model's bounding box.

```json
{
  "userData": {
    "useTemplateSkeleton": true,
    "skeletonClass": "quadruped"
  }
}
```

What this activates:
- PART 76.3 — the renderer auto-loads the quadruped template
  (19 joints: 4 leg chains + spine + chest + head + tail).
- No `rigGraph` declared → falls through to the template path.
- The `rigOptions.skin` defaults to `heat-diffusion` for
  non-humanoid characters (PART 75.1 default rule).

**This is the path to use for any "upload a quadruped model,
get a quadruped rig" request.** The AI doesn't need to
hand-author the 19 joints.

---

## Example 3 — Tail / tentacle / whip with chain-curvature (PART 81)

Any chain-like appendage gets smooth procedural motion via the
`chain-curvature` animation mode. The renderer walks the parent
chain from `chainRoot` to the leaf and applies a sinusoidal +
perlin-perturbed rotation each frame.

```json
{
  "userData": {
    "rigGraph": {
      "joints": [
        { "id": "Bone_Pelvis",   "restPosition": [0, 1.0, 0], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_TailRoot", "parentId": "Bone_Pelvis", "restPosition": [0, 1.0, -0.25], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_Tail1",    "parentId": "Bone_TailRoot", "restPosition": [0, 1.05, -0.40], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_Tail2",    "parentId": "Bone_Tail1", "restPosition": [0, 1.10, -0.55], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_Tail3",    "parentId": "Bone_Tail2", "restPosition": [0, 1.15, -0.70], "restRotation": [0, 0, 0, 1] }
      ]
    },
    "animationFsm": {
      "states": [
        {
          "name": "TailSway",
          "type": "chain-curvature",
          "chainRoot": "Bone_TailRoot",
          "amplitude": 0.18,
          "frequency": 1.2,
          "phase": 0.4,
          "axis": "y",
          "noiseScale": 0.15,
          "noiseSpeed": 0.6
        }
      ]
    }
  }
}
```

What this activates:
- PART 81.1 — the chain-curvature tick. The tail waves
  side-to-side (`axis: "y"`) with a perlin-perturbed
  amplitude. The wave's phase advances by `phase` (0.4) per
  bone depth, so the wave appears to travel down the chain.

**Pattern: chain-curvature is the right tool for ANY of
`Bone_TailRoot` / `Bone_TentacleRoot` / `Bone_AntennaRoot_*` /
`Bone_HairRoot` / `Bone_WhipRoot` / `Bone_CableRoot` /
`Bone_ChainRoot` / `Bone_VineRoot` (the 9 canonical
chain-roots from PART 81.2).**

---

## Example 4 — Mixamo FBX import with bone remap (PART 77)

If the user has a Mixamo FBX animation they want to apply, declare
a `boneRemap`. The renderer rewrites the clip's track names at
import time, mapping `mixamorigHips` → `Bone_Pelvis`, etc.

```json
{
  "userData": {
    "rigGraph": {
      "joints": [
        { "id": "Bone_Pelvis", "restPosition": [0, 1.0, 0], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_Spine",  "parentId": "Bone_Pelvis", "restPosition": [0, 1.2, 0], "restRotation": [0, 0, 0, 1] }
        // ... full 13-bone humanoid rig
      ]
    },
    "boneRemap": {
      "mixamorigHips":         "Bone_Pelvis",
      "mixamorigSpine":        "Bone_Spine",
      "mixamorigSpine1":       "Bone_Chest",
      "mixamorigSpine2":       "Bone_Chest",
      "mixamorigHead":         "Bone_Head",
      "mixamorigLeftUpLeg":    "Bone_Thigh_L",
      "mixamorigLeftLeg":      "Bone_Calf_L",
      "mixamorigLeftFoot":     "Bone_Foot_L",
      "mixamorigRightUpLeg":   "Bone_Thigh_R",
      "mixamorigRightLeg":     "Bone_Calf_R",
      "mixamorigRightFoot":    "Bone_Foot_R"
    }
  }
}
```

What this activates:
- PART 77.1 — at animation-import time, the renderer
  rewrites any track whose name starts with one of the
  `mixamorig*` keys to use the corresponding canonical
  Bone_* name. The geometry skinning uses the original
  bone names (the remap is a clip-rewriting pass, not a
  skeleton rewrite — see PART 65.4 item 25).
- The shipped `MIXAMO_TO_BONE_PRESET` constant (in
  `index.html`) has the full 21-entry table; the AI
  can either re-declare a subset (as above) or just
  trigger the preset by leaving `boneRemap` unset and
  clicking the "Import Mixamo FBX" button (which
  auto-applies the preset).

---

## Example 5 — Constraint catalog: head look-at + hand grip (PART 82)

For complex animation, declare `rigGraphPost.constraints[]`.
The renderer runs the constraint chain in the animation
loop, AFTER the base skeletal animation.

```json
{
  "userData": {
    "rigGraph": {
      "joints": [
        { "id": "Bone_Head",     "restPosition": [0, 1.75, 0], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_HeadAim",  "restPosition": [0, 1.75, 1.0], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_Hand_L",   "restPosition": [0.5, 1.5, 0], "restRotation": [0, 0, 0, 1] },
        { "id": "Bone_HandTarget_L", "restPosition": [0.5, 1.0, 0.5], "restRotation": [0, 0, 0, 1] }
      ]
    },
    "rigGraphPost": {
      "constraints": [
        { "type": "look-at", "bone": "Bone_Head", "target": "Bone_HeadAim" },
        { "type": "two-bone-ik", "bone": "Bone_Hand_L", "target": "Bone_HandTarget_L", "hint": "Bone_ElbowPole_L" }
      ]
    }
  }
}
```

What this activates:
- `look-at` — the head tracks a world-space aim point
  (Bone_HeadAim). If you move the aim bone at runtime,
  the head follows.
- `two-bone-ik` — analytical 2-bone IK on the forearm,
  with an optional pole-vector hint (Bone_ElbowPole_L)
  to control the elbow direction. Same math as
  PART 66.2[2] (already shipped); PART 82 just
  re-homes it in the constraint catalog.

The 12 constraint types in the catalog:
`two-bone-ik`, `multi-aim`, `multi-position`, `multi-rotation`,
`multi-parent`, `multi-referential`, `override`,
`damped-transform`, `twist-correction`, `twist-chain`,
`ik` (multi-bone FABRIK), `look-at`. The AI picks from
this list; unknown types are silently ignored (with a
console warning — PART 65.4 item 34).

---

## Example 6 — Auto-rigger opt-in (PART 78 + PART 79)

For uploaded models with no explicit rig, opt into the
auto-rig chain. The AI doesn't need to author any joints.

```json
{
  "userData": {
    "autoRig": "pose",
    "skeletonClass": "humanoid"
  }
}
```

What this activates:
- PART 79 — the renderer renders the model to a 2D
  canvas, runs BodyPix (~2 MB, lazy-loaded on first
  use, cached in IndexedDB), extracts 17 keypoints +
  a 24-class body-part map, ray-casts the 2D keypoints
  back to 3D, and produces a 13-bone humanoid rig.
- PART 75.5 — segmentation-based weights (the natural
  default for humanoids with BodyPix).
- ~300 ms total latency. The user is asked to confirm
  the T-pose / A-pose canonicalization before the
  rig is applied (PART 79.2).

**Fallback chain (in order):**
1. `blueprint.skeleton` (PART 30) — explicit pivot hierarchy
2. `userData.rigGraph` (PART 34) — explicit rig data
3. `userData.useTemplateSkeleton: true` + `userData.skeletonClass` (PART 76) — auto-loaded template
4. `userData.autoRig: "pose"` + `userData.skeletonClass: "humanoid"` (PART 79) — BodyPix
5. `userData.autoRig: "voxel"` (PART 78) — voxel-fallback
6. PART 32.x A2 heuristic — last-resort crude fallback

**v8.17 caveat:** PART 78 and PART 79 ship as WORKING
STUBS in v8.17. The voxel stub does a bounding-box
heuristic + synthesizes a 5-bone baseline. The pose
stub returns a canonical humanoid scaled to the
bounding box. The full glb-rigger / BodyPix pipelines
are v8.18+. The model will load and animate correctly
with the stubs, but the rig quality is mediocre.
Document this in the inspector when these flags are set.

---

## Example 7 — Skin mode override for a non-humanoid (PART 75.1)

For creatures, props, or anything that's not a humanoid,
override the default skin mode.

```json
{
  "userData": {
    "rigGraph": { "class": "object", "joints": [...] },
    "rigOptions": {
      "skin": "heat-diffusion",
      "maxInfluences": 4
    }
  }
}
```

What this activates:
- PART 75.3 — Pinocchio-style heat-diffusion weights.
  Produces smoother "shoulder-to-elbow" transitions than
  squared-Euclidean for non-humanoid characters.
- The renderer runs a quick manifold check on the
  geometry; if the mesh has open boundaries (e.g. open
  back of head), it falls back to `semantic` (PART 65.4
  item 20).

**When to use which skin mode (the v8.17 default rules):**
- `geodesic` (default for humanoids) — most subjects.
- `heat-diffusion` (default for non-humanoid characters)
  — creatures, organic shapes with closed topology.
- `inverse-distance` (default for mechanical parts) —
  axe heads, gem sockets, prop-on-prop assemblies.
- `segmentation` (default for humanoids with PART 79)
  — uploaded human scans.
- `semantic` (the v8.16 default, baseline) — fallback
  when in doubt.
- `rigid` — 1-influence uint8; only for very-low-vertex
  models where memory matters.

---

## Example 8 — Post-processing for cavity-heavy meshes (PART 87)

For insects, hollow robots, or organic shapes with
internal voids, the surface-only `heat-diffusion` smoothing
can't propagate across the cavity. Use voxel-domain
smoothing instead.

```json
{
  "userData": {
    "rigGraph": { "joints": [...] },
    "rigOptions": {
      "skin": "geodesic",
      "postProcess": "voxel-smooth",
      "postProcessIterations": 3
    }
  }
}
```

What this activates:
- PART 87.1 — the weights are baked into a 3D voxel
  grid (default 32 voxels on the longest axis), a 3D
  Gaussian blur is applied (kernel radius derived from
  `postProcessIterations`, default 3 voxels), and the
  result is sampled back to the mesh.
- This is the right refinement for cavity-heavy meshes
  where surface-only smoothing can't propagate across
  the cavity.

**v8.17 caveat:** `voxel-smooth` ships as a documented
stub in v8.17 (logs an info message and returns the
raw weights). The full voxel-domain smoothing is
v8.18+. The other 3 post-process options
(`laplacian-smooth`, `gaussian-smooth`, `none`) are
all functional in v8.17.

---

## Example 9 — GPU-computed weights for large meshes (PART 80)

For meshes with > 5,000 vertices, the GPU path is
significantly faster than the CPU path. The renderer
auto-picks GPU if `EXT_color_buffer_float` is supported
(WebGL2, ~95% of desktops as of 2026).

```json
{
  "userData": {
    "rigGraph": { "joints": [...] },
    "rigOptions": {
      "skin": "inverse-distance",
      "compute": "auto"
    }
  }
}
```

What this activates:
- PART 80.1 — 3D distance field baked into a
  DataTexture; vertex shader samples the texture
  at the vertex's world position and writes the
  4-influence bind to skinIndex + skinWeight
  BufferAttributes.
- < 5 ms for 100k-vertex meshes on modern desktop GPUs.
- Browser-capability fallback: if WebGL2 +
  `EXT_color_buffer_float` is not available, the
  renderer falls back to PART 75.4's CPU path
  (inverse-distance, ~50 ms for 100k vertices).

---

## Example 10 — Forward-compatibility: opt in to a future ML rig (PART 86)

If a future PART ships a TF.js port of SkinTokens (or
any other ML-based rig), the inspector will read
`userData.rigGraph.class: "ml-based"` and expose the
5 sampling-knob sliders automatically.

```json
{
  "userData": {
    "rigGraph": {
      "class": "ml-based",
      "joints": [...]
    }
  }
}
```

**v8.17 caveat:** no ML-based rig ships yet. This is
forward-compatibility only. The renderer sees
`class: "ml-based"` and falls back to the
`auto` heuristic (which then tries PART 76 templates,
then PART 79 pose, then PART 78 voxel, in that order).
The sampling-knobs schema is reserved for v8.18+.

---

## Quick reference — which PART to use when

| You want... | Use this PART | Field |
|---|---|---|
| Rig an explicit humanoid | PART 34 + PART 75.2 | `userData.rigGraph` + `rigOptions.skin: "geodesic"` |
| Rig any model with no manual work | PART 76 | `userData.useTemplateSkeleton: true` + `userData.skeletonClass` |
| Use Mixamo FBX clips | PART 77 | `userData.boneRemap` (or click the "Import Mixamo FBX" button) |
| Animate a tail / tentacle / whip | PART 81 | `userData.animationFsm.states[].type: "chain-curvature"` |
| Make a character grab / look-at things | PART 82 | `userData.rigGraphPost.constraints[]` |
| Auto-rig an uploaded human scan | PART 79 | `userData.autoRig: "pose"` + `userData.skeletonClass: "humanoid"` |
| Auto-rig a model that doesn't fit any template | PART 78 | `userData.autoRig: "voxel"` |
| Smoother weights on a closed-topology mesh | PART 75.3 | `userData.rigOptions.skin: "heat-diffusion"` |
| 2-influence compact weights on mechanical parts | PART 75.4 | `userData.rigOptions.skin: "inverse-distance"` |
| GPU-accelerated weights for a large mesh | PART 80 | `userData.rigOptions.compute: "auto"` (or `"gpu"`) |
| Cavity refiner for a hollow / insect mesh | PART 87 | `userData.rigOptions.postProcess: "voxel-smooth"` |
| Send to cloud for rigging (future) | PART 85 | `userData.cloudRigEndpoint: "<URL>"` |
| Future ML-based rig (forward-compat) | PART 86 | `userData.rigGraph.class: "ml-based"` |

**No field set = no v8.17 behavior.** Every example
above is opt-in. A model that declares none of these
loads exactly like v8.16.

---

Last updated: 2026-09-06 (v1.25 / v8.17 release).
