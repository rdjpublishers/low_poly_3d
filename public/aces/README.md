# ACES — anyCreature Engine Surface (PART 90-100)

A drop-in quality pass + 3D modeling style reference for the RDJ Low Poly 3D
renderer. The pipeline and the spec language were ported from Ariescar's
anyCreature (1.3.1, MIT) — the OKLab-based L1-L8 shading stack, the
per-vertex AO bake, the angle-weighted crease split, the 25 mechanical
checks, the 5-stage pipeline, the 9-slot brief, the 6:3:1 hierarchy, the
7 part types, the 4 join verbs, the 3 canonical animations, the 5 colour
norms, and the value plan.

The pass is **opt-in**. Click 🛡 ACES in the top toolbar, choose a
config, hit Report (no changes) or Apply. Your model is not modified
until you click Apply.

The reference files (PART 96-98) are **reference**, not rules. An AI
reading `3d-spec-language.md` + `3d-pipeline-cards.md` can write a spec
in the anyCreature format, and the engine compiles it.

## What's in here

### PART 90-95 — the engine surface
| File | Role |
|---|---|
| `aces-oklab.js` | OKLab color conversions, value noise, smoothstep, chroma-edge walk |
| `aces-normals.js` | Angle-weighted vertex normals + `smooth_angle` crease splitting |
| `aces-ao.js` | Per-vertex ambient occlusion bake (raycast hemisphere, uniform grid) |
| `aces-shade.js` | The L1-L8 OKLab shading stack (seam-safe, ramp, boost, bleed, shadows) |
| `aces-checks.js` | 25 mechanical + style checks (BLOCK / warn / info) |
| `aces-bones.js` | Public bone-name convention + GLB `extras` payload |
| `aces-engine.js` | The Three.js integration: one entry point, `window.ACES.run(ctx)` |
| `calibration.html` | Self-check page (red/green ruler) — must print "calibrate OK" |
| `calibration-fixtures.js` | 3 sample meshes (1 pass, 2 block) that prove the checks work |

### PART 96-100 — the 3D modeling style
| File | Role |
|---|---|
| `3d-style-doctrine.md` | Form beats obedience. 10 iron laws, 6:3:1, 9-slot brief, value plan, scale discipline, dullness flags |
| `3d-spec-language.md` | The full anyCreature JSON schema, verified against the engine source. 7 part types, 4 join verbs, profile options, animation tracks, gait templates, output contract |
| `3d-pipeline-cards.md` | The 5-stage pipeline (START → LOW → MID → HIGH → SHIP). One required question, the 9-slot brief, the two gates, the edit vocabulary, the colour norms, the SHIP red lines |
| `README.md` | This file |

## The 25 mechanical + style checks

### Legality (BLOCK when broken) — PART 93
| Check | Symptom it kills |
|---|---|
| `mesh_integrity` | bind pose has folded tris (twist/breakage) |
| `root_containment` | vertices drift too far from the root joint |
| `part_attachment` | a part's host is unknown |
| `touch` | declared touch connections are too far apart |
| `balance` | mass centroid falls outside the support polygon |
| `size` | declared height is more than 15% off the build |
| `proportion` | a chain has a single ≥50% segment (50:50 dead rhythm) |
| `limb_clearance` | L/R chain pair joints closer than 5% of H |
| `anim_integrity` | animations fold tris or over-stretch edges |
| `attack_reach` | an attack animation does not lunge half a body span |
| `faceted_body` | a volume has `faceted: true` (bodies are smooth-shaded) |
| `mirror_distortion` | mirrored twin collapsed past 30% |
| `part_overlap` | two parts share more than 30% of their bbox |
| `part_seat` | a part has no vertex within 10% of H of its host |
| `soft_mass` | only <8% of the skin can show an edge (a smooth bean) |

### Style (ADVISE when off — never stops a build) — PART 99
| Check | Symptom it catches |
|---|---|
| `value_order` | every material sorted by OKLab lightness — value plan computed, not eyeballed |
| `contrast_adjacent` | a part must separate in colour from what it sits on (under 0.10 OKLab = one mass) |
| `share_hierarchy` | primary:secondary:tertiary ≈ 60:30:10 — no dominance = no story |
| `focal_contrast` | two focal parts' shares must differ by ≥2× — equal-weight ping-pongs the eye |
| `saturation_area` | 10-34% of frame highly saturated — below = grey lump, above = no spotlight |
| `thinnest_px48` | thinnest feature < 3 px = invisible to the blind reader |
| `sq_fill` | silhouette in a 1:1 frame. < 0.15 = thin ghost, > 0.50 = blob |
| `mirror_sym` | top-down view is symmetric. FRONT may be high; TOP should be low |
| `straight_max` | longest constant-slope run on the boundary — plank-limb detector |
| `tri_budget` | triangle count band (default 4000-9000) |
| `bright_floor` | "dark" reads by VALUE STEPS, not by making everything dark |

Three log channels:
- **BLOCK** — the build refuses. Fix and rebuild.
- **warn** — measure for the human's judgment. Production runs can ship.
- **info** — the compiler narrates what it did.

The full `gates.json` equivalent lives at the top of `aces-checks.js`.

## The 3D modeling style — the doctrine

> Ariescar's design doctrine, ported to the LBL spec. The rules exist to
> protect form quality; if following a rule would make the creature tamer,
> the rule loses. **Form beats obedience, everywhere.**

See `3d-style-doctrine.md` for the full text. The 5 iron laws in one
paragraph:

1. **Form beats obedience.** Every rule exists to protect form quality.
2. **You never grade your own thumbnails.** The session that designed
   the creature is the worst judge. Gates are read by context-free agents.
3. **Same symptom failed twice = no third tweak.** A round tests THREE
   ideas, not one. Three builds cost seconds; three reads cost 3× a read.
4. **The signature part gets real geometry at LOW.** Budget follows
   6:3:1: the 6-level element gets 6-level geometry.
5. **Engine floors block builds.** `BLOCK:` says exactly what; `warn:`
   is for human judgment; `info:` narrates what the compiler did.

## How an AI uses the 3D modeling style

The most natural use:

1. Read `3d-pipeline-cards.md` to know WHAT to produce (5 stages).
2. Read `3d-spec-language.md` to know the JSON shape (full schema).
3. Run stage 1 LOW: ask the ONE question, expand the brief into the
   9 slots, design the silhouette.
4. Compile the spec against `3d-spec-language.md`. The engine
   produces a GLB.
5. Run the 25 checks via the ACES button. The advisory numbers tell
   you what to push next.
6. Continue to stage 2 MID (parts), stage 3 HIGH (colour + 3 anims),
   stage 4 SHIP (delivery).

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
