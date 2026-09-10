# ACES — anyCreature Engine Surface (PART 90)

A drop-in quality pass for the RDJ Low Poly 3D renderer. The pipeline was
ported from Ariescar's anyCreature (1.3.1, MIT) — the OKLab-based L1-L8
shading stack, the per-vertex AO bake, the angle-weighted crease split, and
the 15 mechanical checks (BLOCK / warn / info). The motivation: anyCreature
is one of the cleanest open 3D creature engines on the public web, and its
compile-time quality gates catch the failures (faceted bodies, dead-rhythm
stacks, mirrored twins collapsed past 30%) that the rest of the LBL spec
documents but does not enforce.

The pass is **opt-in**. Click 🛡 ACES in the top toolbar, choose a config,
hit Report (no changes) or Apply. Your model is not modified until you click
Apply.

## What's in here

| File | Role |
|---|---|
| `aces-oklab.js` | OKLab color conversions, value noise, smoothstep, chroma-edge walk |
| `aces-normals.js` | Angle-weighted vertex normals + `smooth_angle` crease splitting |
| `aces-ao.js` | Per-vertex ambient occlusion bake (raycast hemisphere, uniform grid) |
| `aces-shade.js` | The L1-L8 OKLab shading stack (seam-safe, ramp, boost, bleed, shadows) |
| `aces-checks.js` | 15 mechanical checks (BLOCK / warn / info) |
| `aces-bones.js` | Public bone-name convention + GLB `extras` payload |
| `aces-engine.js` | The Three.js integration: one entry point, `window.ACES.run(ctx)` |
| `calibration.html` | Self-check page (red/green ruler) — must print "calibrate OK" |
| `calibration-fixtures.js` | 3 sample meshes (1 pass, 2 block) that prove the checks work |
| `README.md` | This file |

## The 15 mechanical checks

| Check | Type | Symptom it kills |
|---|---|---|
| `mesh_integrity` | BLOCK | bind pose has folded tris (twist/breakage) |
| `root_containment` | warn | vertices drift too far from the root joint |
| `part_attachment` | warn | a part's host is unknown |
| `touch` | warn | declared touch connections are too far apart |
| `balance` | warn | mass centroid falls outside the support polygon |
| `size` | BLOCK | declared height is more than 15% off the build |
| `proportion` | BLOCK | a chain has a single ≥50% segment (50:50 dead rhythm) |
| `limb_clearance` | warn | L/R chain pair joints closer than 5% of H |
| `anim_integrity` | BLOCK | animations fold tris or over-stretch edges |
| `attack_reach` | BLOCK | an attack animation does not lunge half a body span |
| `faceted_body` | BLOCK | a volume has `faceted: true` (bodies are smooth-shaded) |
| `mirror_distortion` | BLOCK | mirrored twin collapsed past 30% |
| `part_overlap` | warn | two parts share more than 30% of their bbox |
| `part_seat` | warn | a part has no vertex within 10% of H of its host |
| `soft_mass` | BLOCK | only <8% of the skin can show an edge (a smooth bean) |

Three log channels:
- **BLOCK** — the build refuses. Fix and rebuild.
- **warn** — measure for the human's judgment. Production runs can ship.
- **info** — the compiler narrates what it did.

The full `gates.json` equivalent lives at the top of `aces-checks.js`.

## The L1-L8 shading stack

Eight layers, each a pure function of position and classification. The
defaults are the values a measured run settled on against six real creatures
— every removed control was removed because it MEASURED as dead.

| Layer | Name | What it does |
|---|---|---|
| L1 | seam-safe flesh colour | spatial smoothing across parts (no seams) |
| L2 | pattern | deterministic value noise, flesh only |
| L3 | top-to-bottom ramp | multiplied over everything (in OKLab) |
| L4 | boost | brighter AND more saturated up top — identity below y0 |
| L5 | hardware bleed | hard edges darken the flesh around them |
| L6 | hardware shadow | AO only, gamma=0.7 |
| L7 | flesh body shadow | horizontal light ring × AO |
| L8 | bone-field normal softening | flesh only — the only layer that leaves COLOR_0 |

Why OKLab? In any RGB blend mode, "brighter" and "more saturated" are
opposite moves (every mode that brightens moves toward white, and white has
chroma 0). A measured run had every blend mode's delta-chroma negative
while gaining lightness. In OKLab, L and chroma are independent, so the
boost is two numbers: `L' = L + dL * w` and `chroma' = chroma * (1 + (dC-1) * w)`.
The chroma can run out of sRGB — the L4 layer walks it back to the gamut
edge by bisection (12 iterations, 0.03% error), instead of clamping per
channel which would TURN THE HUE.

To override the defaults, set `spec.shading` in the ACES panel — the JSON
shape is the same as `anyCreature`'s `shading` config.

## Public bone-name convention

`aces-bones.js` exports the same `LArm1Sh` / `RFrontLeg1Kn` pattern
anyCreature uses. Internal joint names stay authoring-side; the export map
is applied only at GLB-write time so animations/skins (index-based) are
untouched. The structural pattern every exported bone starting with L/R
conforms to: `^[LR][A-Z][A-Za-z]*\d+[A-Z][a-z]$`.

## Embedded source_spec

Every ACES pass writes `asset.extras` to the GLB with:
- `harness` / `harness_version` — the harness stamp
- `spec` — the spec basename
- `source_spec` — the PRISTINE authored spec (re-editable, re-compilable)
- `parts` — manifest of every volume + part (so a graft tool can transplant
  parts between creatures)
- `checks` — per-check pass/warn summary

A future `aces/graft.js` could pull a part from creature A's GLB, paste it
into creature B's spec, and re-compile — without re-prompting the AI. The
harness for that is left to a follow-up.

## Calibration self-check

`./calibration.html` runs three sample meshes through the full pipeline and
prints `calibrate OK` when:
- icosahedron + 5-segment chain → passes all checks
- box with 50:50 stacked segments → blocks on `proportion`
- faceted sphere → blocks on `faceted_body` and `soft_mass`

This is the "red/green ruler" that proves the checks separate good from bad
on your machine. Open the file, hit Run, and read the verdict.

## API for the rest of the renderer

```js
window.ACES.run({
  scene,                          // THREE.Scene or Object3D root — REQUIRED
  shading,                        // spec.shading (L1-L8 config) — optional
  ao: { samples, strength, ... }, // false to skip — optional
  smoothAngle,                    // global default for crease split (default 50)
  classMap,                       // Map<chainOrPart, 'flesh' | 'hard' | 'fx'>
  spec,                           // authored spec (drives checks)
  skeleton,                       // pre-extracted { joints, index }
  onReport,                       // (report) => void
});
// → { summary, perCheck, fails, warns, info }
```

Sub-modules are exposed on `window.ACES.{oklab, normals, ao, shade, checks, bones}`
for advanced callers who want to compose their own pipeline.

## Credits

- **Ariescar (Alsomindtech)** — author of anyCreature (1.3.1, MIT). The
  OKLab L1-L8 stack, the per-vertex AO bake, the mechanical checks, the
  public bone-name convention, and the "form beats obedience" doctrine
  are original to that project. This surface is a port with the geometry
  extracted to the browser and the harness adapted to Three.js scenes.
- **Björn Ottosson** — OKLab color space.
- **Möller & Trumbore** — ray-triangle intersection.
- **RDJ Publishers** — the low_poly_3d renderer this surface plugs into.

## License

The anyCreature engine is MIT. This port is MIT, compatible with the parent
project. Three.js stays MIT. The OKLab reference paper is the public domain.
