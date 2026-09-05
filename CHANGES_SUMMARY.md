# v1.23 / v8.15 — OPT-IN capability bundle (PART 67)

The spec now teaches the AI an OPT-IN capability bundle
from the maintainer's "Reference-Repo Analysis for
low_poly_3d" working notebook (compiled 2026-09-04), which
catalogues the architecture-level patterns from four
external reference repos (PudinKiller/VFXMeshLab,
keijiro/VfxGraphModeling, fabYkun/AnimatedMeshes,
rev087/forge) and translates them into the existing
`lblSpec` / Three.js contract: 7 new cross-primitive
shape generators (Disc / Ring / Arc / Hemisphere /
Ribbon / CrossPlanes / Helix), 6 new deform modifiers
(Taper / Twist / Bend / Spherize / Inflate / Noise)
dispatched by the new `applyModifierStack(geo, mods)`
helper, 1 new vertex-channel helper (`fillVertexChannel`)
that wires `uv1` / `uv2` / `uv3` for dissolve / flow
masks without extra textures, 1 new UV projection
helper (`projectUV`) that adds 5 more projections
(radial / cylindrical / spherical / box / alongLength)
on top of the existing planar / shapeDefault, 1 new
`convergeFaces` helper (forge-style — pull every face
toward a target vertex for tent tops, spike tips,
bullet tails), 1 new `recolorByPalette` runtime
recolor (re-skin a CS2 knife from "Damascus" to "Fade"
without rebuilding the mesh, paired with PART 45's
`cs2PbrProfile`), 1 new `placeChain` chain placement
(chain links, ammunition belts, cable segments), 1
new `applyMaterialAnimation` time-driven material
modifier (pulsing emissiveIntensity, finish color
shifts — composes with the existing `tick(dt, elapsed)`
contract), 1 new `preflightCheck` safety-budget helper
(the factory validates the budget BEFORE building, not
after — mirrors VFXMeshLab's `VFXMeshBuildLimits
.TryValidate`), and 1 new `shadowProfile` opt-in
('soft-3-light' | 'sharp-1-light' | 'cs2-hdri' |
'none'). The renderer adds 6 new non-blocking validators
E31 (modifier stack order), E32 (UV projection vs
geometry sanity), E33 (modifier stack safety — caps:
10 entries, 12 octaves, 256 turns), E34 (converge
direction sanity), E35 (recolor roles complete), E36
(preflight check used) to the existing 30 (E1-E12 from
PART 32/65, E13-E16 from PART 38, E17-E18 from PART
39, E19-E21 from PART 40, E22-E23 from PART 41, E24-E25
from PART 42, E26-E27 from PART 43, E28-E29 from PART
44, E30 from PART 45), and 23 new canonical helpers
re-exported on `window.lblSpec.helpers` alongside the
PART 35 + PART 39 + PART 40 + PART 41 + PART 42 +
PART 43 + PART 44 + PART 45 bundles: `makeDisc` /
`makeRing` / `makeArc` / `makeHemisphere` / `makeRibbon`
/ `makeCrossPlanes` / `makeHelix` (7 cross-primitive
shape generators — `CircleGeometry` for shields / plates,
`RingGeometry` for rims / barrel bands, partial
`RingGeometry` for blade arcs, half-sphere for domes /
helmets, tapered plane for trails / scabbard strips,
N-Plane cross for smoke quads, `TubeGeometry` along a
helix `Curve` subclass for coils / rifling), `taper` /
`twist` / `bend` / `spherize` / `inflate` / `applyNoise`
(6 deform modifiers — per-vertex math; `applyNoise` uses
Mulberry32 for determinism and defaults `seed` to
`meta.seed`), `applyModifierStack(geo, mods)` (the
canonical modifier-stack dispatcher), `fillVertexChannel
(geometry, channelName, source, settings)` (writes
`uv1` / `uv2` / `uv3` from an axis gradient, radial
distance, or deterministic random), `projectUV(geometry,
projection, settings)` (the 7 UV projections), `convergeFaces
(geometry, toVertex, strength)` (forge-style), `recolorByPalette
(root, newPalette)` (the runtime recolor — matched by
`material.userData.role`), `placeChain(parent, protoFactory,
count, axis, jitter)` (chain placement), `applyMaterialAnimation
(material, animationArray, elapsed)` (time-driven
material keyframes), and `preflightCheck(opts)` (the
safety-budget validator). PART 67 is an EXTRA CAPABILITY
for weapons, blades, and metal-finish subjects (see 46.0.4
for the explicit use-case lists) — not a rule every model
must follow. Style-agnostic in scope (46.0.3) but
content-specific in subject (46.0.4). All 9 new opt-in
meta.* fields are backward-compatible: a model that
doesn't set any of them loads identically to v1.22. The
6 new validators E31-E36 mirror E30's "opt-in by
construction" pattern — they return `null` (clean) when
their corresponding opt-in flag is not set. The existing
E1-E30 validators are UNCHANGED. PART 67 keeps only the
patterns that are directly useful for the existing system
(the rest are documented in the notebook for future
reference). **PART 67 is the second opt-in capability
layer in the spec** (PART 45 was the first).

## Files modified (8)

| File | Change |
|------|--------|
| `index.html` | VERSION constant bumped v1.22 → v1.23 (TS) / v8.14 → v8.15 (JSON/JS); 23 new helpers added to `__threeTriHelpers` (makeDisc / makeRing / makeArc / makeHemisphere / makeRibbon / makeCrossPlanes / makeHelix / taper / twist / bend / spherize / inflate / applyNoise / applyModifierStack / fillVertexChannel / projectUV / convergeFaces / recolorByPalette / placeChain / applyMaterialAnimation / preflightCheck); 6 new validators E31-E36 added to `ANTI_PATTERN_CHECKS`; meta description + keywords updated; spec chip title + text updated; the comment block that describes `window.lblSpec` updated to mention PART 67; the comment block that lists the 30 anti-patterns updated to say 36 |
| `Prompt_To_Ts.txt` | New PART 67 added (sections 46.0 - 46.11): cross-primitive vocabulary (46.1), deform modifier stack (46.2), packed vertex channels (46.3), UV projection helper (46.4), converge faces (46.5), recolor by palette (46.6), chain placement (46.7), time-driven material animation (46.8), preflight check (46.9), shadow profile (46.10), updated cross-references (46.11) |
| `Prompt_To_Json.txt` | New PART 67 added with the same 46.0 - 46.11 spec + a JSON-specific worked example (46.1 — a CS2 Karambit knife that exercises 7 PART 67 features alongside PART 45) |
| `Image_To_Ts.txt` | Brief PART 67 cross-reference added at end (the full spec lives in Prompt_To_Ts.txt) |
| `Image_To_Json.txt` | Brief PART 67 cross-reference added at end |
| `Prompt_To_Js.txt` | Brief PART 67 cross-reference added at end |
| `Image_To_Js.txt` | Brief PART 67 cross-reference added at end |
| `CHANGES_SUMMARY.md` | This entry |

## Files UNTOUCHED

- `public/models/Model_1.ts` through `Model_5.ts` — the
  5 built-in models do not use any PART 67 features; they
  load identically to v1.22. The new helpers are AVAILABLE
  to them but OPT-IN.
- `public/models/manifest.json` — no new models added in
  this round (the maintainer can add `Model_6.ts` through
  `Model_10.ts` in a future round per the notebook's
  recommendation).
- `public/rig/` — the rig assets are unchanged.
- `.github/workflows/manifest.yml` — the manifest auto-
  refresh workflow is unchanged (no new models).
- The existing PART 1-45 spec in all 6 spec files is
  UNCHANGED (no PART has been weakened, removed, or
  re-numbered).
- The existing 30 anti-pattern validators E1-E30 are
  UNCHANGED (E31-E36 are purely additive).
- The existing 5 PART 45 helpers (cs2PbrProfile, applyWear,
  cs2WearMaskTexture, wearSlider, cs2-finish materialVariants
  family) are UNCHANGED.
- The existing 4 PART 41.6 materialVariants families are
  UNCHANGED (recolorByPalette is a separate helper, not
  a new family).
- The existing 2 PART 44.3 families (bone + magic) are
  UNCHANGED.

## What PART 67 covers (9 opt-in sub-sections)

| Section | Sub-section | Helper(s) | meta.* field |
|---------|-------------|-----------|--------------|
| 46.1 | Cross-primitive vocabulary | `makeDisc` / `makeRing` / `makeArc` / `makeHemisphere` / `makeRibbon` / `makeCrossPlanes` / `makeHelix` | (per-part primitive string or `meta.geometryPipeline`) |
| 46.2 | Deform modifier stack | `taper` / `twist` / `bend` / `spherize` / `inflate` / `applyNoise` + `applyModifierStack` | `meta.geometryPipeline.modifiers` |
| 46.3 | Packed vertex channels | `fillVertexChannel` | `meta.vertexData` |
| 46.4 | UV projection helper | `projectUV` | `meta.uv.projection` (now accepts 7 values) |
| 46.5 | Converge faces | `convergeFaces` | `meta.geometryPipeline.converge` |
| 46.6 | Recolor by palette | `recolorByPalette` | `meta.colorPalette` + `material.userData.role` |
| 46.7 | Chain placement | `placeChain` | (per-part declaration) |
| 46.8 | Time-driven material animation | `applyMaterialAnimation` | `meta.materialAnimation` |
| 46.9 | Preflight check | `preflightCheck` | `meta.usedPreflight` |
| 46.10 | Shadow profile | (uses `lookDevLights` from PART 44) | `meta.shadowProfile` |

## What PART 67 does NOT introduce

- **No new dependency.** All helpers use existing
  Three.js primitives (`CircleGeometry`, `RingGeometry`,
  `SphereGeometry`, `PlaneGeometry`, `TubeGeometry`,
  `BufferAttribute` math, `THREE.Color`, `THREE.Vector3`)
  and the existing `mergeGeometries` import (already at
  the top of the module for PART 35).
- **No new export path.** The existing GLB / OBJ / STL
  / .ts export buttons are unchanged.
- **No new mandatory field.** All 9 new meta.* fields
  are opt-in; a model that doesn't set any of them
  loads identically to v1.22.
- **No removed / weakened rule.** Every PART 1-45 rule
  is preserved exactly. No PART has been re-numbered.
- **No removed / weakened existing extension.** The
  existing `materialVariants` (PART 41.6), `cs2PbrProfile`
  (PART 45), `lookDevLights` (PART 44), and every other
  prior helper is unchanged.
- **No removed / weakened existing PART 45 helper.**
  `cs2PbrProfile`, `applyWear`, `cs2WearMaskTexture`,
  `wearSlider`, and the `cs2-finish` materialVariants
  family are all unchanged.
- **No removed / weakened existing PART 41.6 family.**
  The 4 default families (plate / cloth / leather /
  stone) plus the 2 PART 44.3 extensions (bone / magic)
  are unchanged.
- **No change to PART 38.22's style agnosticism.** PART
  46 is also style-agnostic in scope (46.0.3).
- **No change to PART 38.14's GLB-first architecture.**
  PART 67 layers on top of the existing TS-factory
  contract.
- **No change to PART 39.5's factory + options pattern.**
  PART 67 helpers are called the same way: `lblSpec
  .helpers.<name>(...)`.
- **No change to PART 44.3's existing bone + magic
  families.**
- **No change to PART 45.0.3's style agnosticism.** PART
  46 is also style-agnostic in scope.
- **Strict upgrade, zero downgrades.** Every change in
  PART 67 is purely additive. A model that doesn't use
  any PART 67 features loads identically to v1.22.

## Quick reference for the renderer build

```javascript
// LBL spec version this renderer targets:
const VERSION = { ts: 'v1.23', json: 'v8.15' };

// Number of anti-pattern validators:
const ANTI_PATTERN_CHECKS = [ /* E1 - E36 */ ]; // 36 total

// 23 new PART 67 helpers (re-exported on window.lblSpec.helpers):
// - 7 cross-primitive shape generators
// - 6 deform modifiers + applyModifierStack dispatcher
// - 1 vertex-channel helper
// - 1 UV projection helper
// - 1 converge helper
// - 1 recolor helper
// - 1 chain placement
// - 1 material animation
// - 1 preflight check
// (1 shadow profile uses the existing lookDevLights)
```

## Related prior rounds (for context)

- v1.22 / v8.14 (PART 45) — CS2 PBR material profile
  (the first opt-in capability layer; PART 67 is the
  second)
- v1.21 / v8.13 (PART 44) — Professional pipeline (GLB-
  first, BVH, look-dev lights, coding rules)
- v1.20 / v8.12 (PART 43) — Refinement + style locking
  + variant ranking
- v1.19 / v8.11 (PART 42) — Character production
  discipline
- v1.18 / v8.10 (PART 41) — High-detail generation
- v1.17 / v8.9 (PART 40) — Better models through better
  generation
- v1.16 / v8.8 (PART 39) — 3D modeling techniques
- v1.15 / v8.7 (PART 38) — Character pipeline
- v1.14 / v8.6 (PART 37) — Zip bundle
- v1.13 / v8.5 (PART 36) — Multi-file
- v1.12 / v8.4 (PART 35) — Triangle-first geometry
- v1.11 / v8.3 (PART 34) — Pre-bundled rig helpers
- v1.10 / v8.2 (PART 33) — Architectural features

# v1.22 / v8.14 — CS2 PBR material profile (PART 45)

The spec now teaches the AI an OPT-IN CS2 PBR material profile
from the maintainer's "3D Technical Reference — CS2 to Three.js
Mapping" research notebook (id
`30ec3dba-5a20-4980-8886-ce89b506b634`, July 2026): 9 finish
styles (Anodized, Anodized Multicolored, Custom Paint Job,
Gunsmith, Hydrographic, Patina, Solid Color, Sprayed, Damascus
Steel — the last is the bonus finish the notebook treats
separately from Case Hardened patina), a 5-tier wear system
(FN/MW/FT/WW/BS) that maps CS2's per-item float value onto
PBR property shifts, 8 new MAT_DB presets (`brushedsteel`,
`gunmetal`, `damascussteel`, `anodizedblue`, `anodizedred`,
`anodizedgold`, `casehardened`, plus the existing v6.4
`polishedmetal` / `chrome` as the 8th alias), and 4 new
MeshPhysicalMaterial properties the renderer now wires
through `buildMaterial`: `iridescence` / `iridescenceIOR` /
`iridescenceThicknessRange` (thin-film interference — Doppler
/ Fade / Case Hardened / Damascus) and `specularIntensity` /
`specularColor` (F0 knob for dielectrics), plus
`attenuationColor` / `attenuationDistance` (tinted-glass
absorption). The first 3 also extend the existing `wantsPhysical`
switch (PART 3 / PART 7 #7 PBR Extensions) so a model that
sets any of them gets built on `MeshPhysicalMaterial`. The
renderer adds 1 new non-blocking validator E30 (CS2 profile
compliance) to the existing 29 (E1-E12 from PART 32/65, E13-E16
from PART 38, E17-E18 from PART 39, E19-E21 from PART 40, E22-E23
from PART 41, E24-E25 from PART 42, E26-E27 from PART 43,
E28-E29 from PART 44), and 5 new canonical helpers re-exported
on `window.lblSpec.helpers` alongside the PART 35 + PART 39 +
PART 40 + PART 41 + PART 42 + PART 43 + PART 44 bundles:
`cs2PbrProfile(finish, opts)` (returns the MeshPhysicalMaterial
property bundle for a given CS2 finish string — the SINGLE
SOURCE OF TRUTH for the 9 finishes; the .ts factory / JSON
blueprint never writes the PBR numbers inline), `applyWear(mat,
wearAmount, baseMetal, baseColor)` (mutates a material's
roughness / metalness / color in place to match a CS2 wear
tier; skips the color pass for patina / casehardened /
damascussteel whose worn look is DARKER, not desat'd),
`cs2WearMaskTexture(size, opts)` (procedural wear-mask
generator — 4-octave fBm + edge-detection blend; returns a
CanvasTexture with repeat-wrapping; deterministic for the same
(size, seed) pair via Mulberry32), and `wearSlider(root, opts)`
(publishes a user-tunable wear slider on
`root.userData.sculptRuntime.wearSlider` when
`meta.cs2WearUserTunable: true`; the slider's `set(newValue)`
method re-invokes `applyWear` on every Mesh's material in the
tree). The `materialVariants` helper from PART 41.6 is
DOCUMENTED as extensible with 1 new family (`cs2-finish`); the
existing 4+2 = 6 families stay exactly as they were. **PART 45
is an EXTRA CAPABILITY for weapons, blades, and metal-finish
subjects — NOT a rule every model must follow.** See PART 45.8
in the spec for the "when to opt in" rule (knives, guns, metal
props, CS2 displays, or any explicit user request that names a
CS2 finish). For every other subject (fabric, leather, skin,
wood, plants, vehicles-as-a-whole, fantasy, organic shapes) the
.ts factory leaves `meta.cs2Finish` unset and the model loads
on the default PART 3 + PART 41 + PART 44 pipeline. No new
dependency (iridescence and specularIntensity are core
MeshPhysicalMaterial / MeshStandardMaterial properties that
have existed in Three.js for years; the renderer just hadn't
been wiring them through). No new export path, no new
mandatory field, no removed / weakened rule, no change to
PART 38.22's style agnosticism, no change to PART 38.14's
GLB-first architecture, no change to PART 39.5's factory +
options pattern, no change to PART 41.6's 4 default material
families, no change to PART 44.3's bone + magic families, no
change to the project's "Low Poly 3D" name. The 30+ existing
MAT_DB presets stay exactly as they were (the new entries are
PURE additions; the 1 duplicate `polishedmetal` from v6.4 is
left in place for backward compatibility and is shadowed by
the existing entry — JavaScript object literal semantics
resolve the last-defined property at access time). Strict
upgrade, zero downgrades.

A supplementary addendum to PART 45 was added after the
initial cut: (45.13) the Component Recipe Database for
weapons (knife blade types + handle construction, pistol
components, rifle components, boolean operations, edge
treatment) preserved verbatim from the source notebook as
a content guide that curates PART 2 / PART 10 / PART 39 /
PART 42 / PART 45 into a per-component cheat sheet — purely
a reference, not a runtime contract; (45.14) the bilingual
EN/VI Vocabulary Glossary (5 core industry terms + 5
spatial modifiers + the 4-way damage-type × PBR-map rubric)
preserved verbatim from the source notebook as a reference
resource for the AI to identify subject matter in the
user's prompt or reference image; (45.15) the updated
cross-references listing the PART 2 / PART 10 / PART 39 /
PART 41 / PART 42 entries 45.13 / 45.14 depend on. These
additions are PURE reference content — no new rules, no
new helpers, no new fields, no removed / weakened rule.

## Files modified (8)

| File | Change |
|------|--------|
| `Prompt_To_Ts.txt`   | header v1.21 → v1.22; new v1.22 CHANGELOG entry (above); appended PART 45 (15 sub-sections: 45.0 central principle + 4 path notes, 45.1 PBR property map, 45.2 the 9 CS2 finish-style recipes incl. bonus Damascus Steel, 45.3 wear system bridge with 5 tiers + per-skin clipping + PBR shift + spatial wear + wearMap, 45.4 8 new MAT_DB presets, 45.5 renderer-side extensions to buildMaterial, 45.6 .ts factory contract with worked Karambit example, 45.7 JSON/JS analog, 45.8 when to opt in, 45.9 E30 validator, 45.10 5 canonical helpers, 45.11 what PART 45 does NOT introduce, 45.12 cross-references, 45.13 Component Recipe Database for weapons — knife blade types + handle construction + pistol components + rifle components + boolean operations + edge treatment, 45.14 bilingual EN/VI Vocabulary Glossary — 5 core terms + 5 spatial modifiers + 4-way damage-type × PBR-map rubric, 45.15 updated cross-references) |
| `Image_To_Ts.txt`    | header v1.21 → v1.22; new v1.22 CHANGELOG entry; appended PART 45 (same content incl. 45.13 + 45.14 + 45.15; image-to-TS analysis protocol from PART 17 feeds 45.6 + 45.13.6 directly) |
| `Prompt_To_Json.txt` | header v8.13 → v8.14; new v8.14 CHANGELOG entry; appended PART 45 (same content incl. 45.13 + 45.14 + 45.15; references the JSON/JS `meta.cs2Finish` / `meta.cs2Wear` / `meta.cs2WearRemap` / `meta.cs2WearMask` / `meta.cs2WearUserTunable` fields as the JSON/JS analog of the TS path) |
| `Image_To_Json.txt`  | header v8.13 → v8.14; new v8.14 CHANGELOG entry; appended PART 45 (same content incl. 45.13 + 45.14 + 45.15) |
| `Prompt_To_Js.txt`   | header v8.13 → v8.14; new v8.14 CHANGELOG entry; appended PART 45 (same content incl. 45.13 + 45.14 + 45.15) |
| `Image_To_Js.txt`    | header v8.13 → v8.14; new v8.14 CHANGELOG entry; appended PART 45 (same content incl. 45.13 + 45.14 + 45.15) |
| `index.html`         | `lblSpec.VERSION` bumped to `{ts:'v1.22', json:'v8.14'}`; LBL spec chip text + title updated; meta description + keywords updated; top-of-block comment updated to "RJS UPDATE 3 / 4 / 5 / 6 / 7 / 8 / 9 / 10 / 11 / 12 / 13 / 14"; 1 new CS2-profile validator (E30 CS2 profile compliance) added to `ANTI_PATTERN_CHECKS`; 7 new MAT_DB entries (`brushedsteel`, `gunmetal`, `damascussteel`, `anodizedblue`, `anodizedred`, `anodizedgold`, `casehardened` — `polishedmetal` already existed from v6.4) added to the existing MAT_DB; `buildMaterial`'s `wantsPhysical` switch extended with `iridescence` / `iridescenceIOR` / `iridescenceThicknessRange` (strict additive change); 4 new MeshPhysicalMaterial properties wired through `buildMaterial` (`iridescence` / `iridescenceIOR` / `iridescenceThicknessRange` + `specularIntensity` / `specularColor` + `attenuationColor` / `attenuationDistance`); 5 new canonical helpers (`cs2PbrProfile`, `applyWear`, `cs2WearMaskTexture`, `wearSlider`, plus the documented extension point for `materialVariants` with a 7th `cs2-finish` family) added to the existing `__threeTriHelpers` bundle re-exported on `window.lblSpec.helpers` |
| `CHANGES_SUMMARY.md` | this round added at the top (this section); prior v1.21 / v8.13 round preserved below |

## Files UNTOUCHED

- `public/models/Model_1.ts` through `Model_5.ts` (still work
  standalone; the new meta fields from 45.6.1 `cs2Finish`,
  45.6.2 `cs2Wear`, 45.6.3 `cs2WearRemap`, 45.6.4 `cs2WearMask`,
  45.6.5 `cs2WearUserTunable` are ALL OPTIONAL, so existing
  models don't need any change to load)
- `public/models/manifest.json` (still works as-is)
- `.github/workflows/manifest.yml`
- `public/rig/three-rig-helpers.js`
- `public/rig/src/*.ts`
- `public/rig/build.sh`

## What PART 45 covers (12 sub-sections)

- **45.0**  Central principle — CS2 PBR is an EXTRA
            CAPABILITY, not a rule. The .ts factory uses
            it WHEN the subject calls for it (knives,
            guns, metal props, CS2 displays, or an
            explicit user "CS2-style" / "anodized" /
            "case hardened" / "Doppler" / "Fade" /
            "Damascus" / "patina" request) and SKIPS it
            otherwise. No existing rule is changed; no
            existing material default is changed; no
            model that doesn't opt in loads any
            differently. Style-agnostic in scope; content-
            specific in subject.
  - **45.0.1** EXTENDS, not replaces. The .ts factory's
              material contract from PART 3 is the
              BASE; the new `cs2PbrProfile` helper
              returns a property bundle the factory
              spreads ON TOP.
  - **45.0.2** WHEN TO OPT IN. The .ts factory requests
              `cs2Finish` ONLY in the 5 use cases in
              45.8; otherwise leaves it unset and the
              model loads on the default PART 3 + PART
              41 + PART 44 pipeline.
  - **45.0.3** STYLE-AGNOSTIC IN SCOPE. PART 45 applies
              regardless of `meta.style`.
  - **45.0.4** LAYERING ON THE EXISTING STACK. PART 45
              layers on top of, never replaces.
- **45.1**  PBR property map — the 13 properties the
            profile can drive (the 6 already covered by
            PART 3 + PART 7 #7 PBR Extensions: color /
            metalness / roughness / envMapIntensity /
            clearcoat / sheen / anisotropy / transmission
            / thickness / ior) PLUS the 7 new properties
            the renderer now honours: iridescence /
            iridescenceIOR / iridescenceThicknessRange /
            specularIntensity / specularColor /
            attenuationColor / attenuationDistance.
- **45.2**  CS2 finish-style → PBR profile (9 styles)
  - **45.2.1**  Anodized (metalness 1.0, roughness
                0.05-0.15, clearcoat 0.3-0.5,
                iridescence 0.0-0.2)
  - **45.2.2**  Anodized Multicolored (metalness 1.0,
                roughness 0.05-0.10, iridescence
                0.3-0.5, iridescenceIOR 1.5-2.0,
                iridescenceThicknessRange [100,500])
  - **45.2.3**  Custom Paint Job (metalness 0.0,
                roughness 0.3-0.5, clearcoat 0.2-0.4)
  - **45.2.4**  Gunsmith (metalness 0.7-0.9, roughness
                0.2-0.4, no clearcoat)
  - **45.2.5**  Hydrographic (metalness 0.0, roughness
                0.5-0.7, clearcoat 0.1-0.2)
  - **45.2.6**  Patina (metalness 0.9-1.0, roughness
                0.2-0.4, iridescence 0.3-0.6)
  - **45.2.7**  Solid Color (metalness 0.0, roughness
                0.3-0.5, clearcoat 0.2-0.3)
  - **45.2.8**  Sprayed (metalness 0.0, roughness
                0.6-0.8, no clearcoat)
  - **45.2.9**  Damascus Steel (BONUS — separate from
                Patina; metalness 1.0, roughness
                0.25-0.40, iridescence 0.2-0.4 +
                anisotropy 0.4-0.7; the "Damascus
                wear inversion" — a unique case where
                wear ENHANCES the visual signature).
- **45.3**  Wear system bridge
  - **45.3.1** Wear tiers (FN 0.00-0.07, MW 0.07-0.15,
              FT 0.15-0.38, WW 0.38-0.45, BS 0.45-1.00)
  - **45.3.2** Per-skin float clipping
              (`wear_remap_min` / `wear_remap_max` in
              CS2's items_game.txt; surfaced as
              `meta.cs2WearRemap` in PART 45)
  - **45.3.3** PBR parameter shift per wear unit
              (roughness ramp 0.3 → 0.7, metalness
              ramp toward `baseMetal`, color
              desaturated 30% — SKIPS the color pass
              for patina / casehardened / damascussteel)
  - **45.3.4** Spatial wear (where on the part) —
              content guide, not a runtime change; the
              .ts factory picks the wear location
              from the model's geometry
  - **45.3.5** wearMap / wear mask (optional) — the
              .ts factory authors a CanvasTexture
              and the renderer multiplies it against
              the wearAmount. The new
              `cs2WearMaskTexture` helper
              generates one procedurally.
- **45.4**  Material preset recipes — 8 new MAT_DB
            entries (7 new + 1 alias to the existing
            v6.4 polishedmetal). The .ts factory uses
            these via the existing PART 5
            `material: '<name>'` field — no syntax
            change.
- **45.5**  Renderer-side extensions to buildMaterial
  - **45.5.1** iridescence / iridescenceIOR /
              iridescenceThicknessRange (NEW wire-
              through; extends the wantsPhysical
              switch)
  - **45.5.2** specularIntensity / specularColor (NEW
              wire-through; works on BOTH
              MeshStandardMaterial and
              MeshPhysicalMaterial since they're
              dielectric F0 knobs)
  - **45.5.3** attenuationColor / attenuationDistance
              (NEW wire-through; only matters when
              transmission > 0)
  - **45.5.4** The wantsPhysical switch (UPDATED,
              NOT CHANGED) — adds the 3 new
              iridescence properties to the same
              condition; the behavior is unchanged
              for objects that don't set any of
              these. Strict additive change: a new
              condition makes MORE objects use
              MeshPhysicalMaterial, never fewer.
- **45.6**  .ts factory contract — the 4-step pattern
            (set `meta.cs2Finish`, optionally
            `meta.cs2Wear` / `meta.cs2WearRemap` /
            `meta.cs2WearMask` / `meta.cs2WearUserTunable`).
            Worked example: a CS2 Karambit with Case
            Hardened finish at Field-Tested wear.
- **45.7**  JSON / JS path (mirror) — same 5 meta keys
            (`cs2Finish` / `cs2Wear` / `cs2WearRemap` /
            `cs2WearMask` / `cs2WearUserTunable`).
            Example JSON fragment for an
            anodizedmulticolored butterfly knife at FT.
- **45.8**  When to opt in (the 5 use cases) — knives
            and blades (45.8.1), guns and weapon
            hardware (45.8.2), polished / brushed /
            gunmetal metal props (45.8.3), CS2 displays
            / showcases (45.8.4), explicit user
            requests (45.8.5). Plus an explicit list
            of subjects where `cs2Finish` is almost
            NEVER appropriate (fabric, skin, wood,
            plants, glass, magic, vehicles-as-a-whole,
            architecture, anything where a metal finish
            would look wrong).
- **45.9**  Renderer-side runtime contract — adds 1
            new non-blocking validator E30 (CS2
            profile compliance) to the existing 29.
            E30 fires ONLY when `meta.cs2Finish` is
            set; a model with NO `cs2Finish` and NO
            `cs2Wear` field never triggers E30.
            E30 checks (a) substrate match (a
            "casehardened" finish on a metalness 0.0
            material is a mismatch), (b) defining
            feature (e.g. "anodizedblue" should set
            clearcoat; "casehardened" should set
            iridescence; "brushedsteel" should set
            anisotropy; "damascussteel" should set
            BOTH iridescence AND anisotropy), and
            (c) wear-range check (when
            `cs2WearRemap` is set). Non-blocking;
            surfaces a single warning toast + a red
            spec chip, exactly like E1-E29.
- **45.10** Canonical helpers (re-exported on
            `window.lblSpec.helpers`)
  - `cs2PbrProfile(finish, opts)` (Appendix A) —
    returns the property bundle for a given
    finish string; the SINGLE SOURCE OF TRUTH
    for the 9 finish profiles.
  - `applyWear(mat, wearAmount, baseMetal,
    baseColor)` (Appendix B) — mutates a
    MeshPhysicalMaterial in place; detects
    "skip desaturation" finishes (Patina,
    Damascus) from `mat.userData.cs2Finish` and
    skips the color pass for those.
  - `cs2WearMaskTexture(size, opts)` (Appendix
    C) — procedural wear mask generator;
    4-octave fBm + edge-detection blend; returns
    a CanvasTexture with repeat-wrapping;
    deterministic for the same (size, seed) pair
    via Mulberry32.
  - `wearSlider(root, opts)` (Appendix D) —
    publishes a user-tunable wear slider on
    `root.userData.sculptRuntime.wearSlider`
    when `meta.cs2WearUserTunable: true`; the
    slider's `set(newValue)` method re-invokes
    `applyWear` on every Mesh's material in the
    tree.
  - The `materialVariants` helper from PART 41.6
    is documented as EXTENSIBLE with a 7th
    `cs2-finish` family; the existing 4+2 = 6
    families stay exactly as they were.
- **45.11** What PART 45 does NOT introduce —
            explicit list of "no new X" rules.
            17 items, all "no change to existing",
            including no change to PART 38.22's style
            agnosticism, no change to PART 38.14's
            GLB-first architecture, no change to
            PART 39.5's factory + options pattern,
            no change to PART 41.6's 4 default
            material families, no change to PART
            44.3's bone + magic families, no REMOVAL
            of any existing finish or material
            preset, no REMOVAL or WEAKENING of any
            existing iridescence / clearcoat / sheen
            / anisotropy / transmission path.
- **45.12** Cross-references — explicit list of the
            PARTs PART 45 layers on top of, never
            replaces.

## What PART 45 does NOT introduce

- No new mandatory field on any existing userData
  namespace (the new fields in 45.5.1 `iridescence` /
  `iridescenceIOR` / `iridescenceThicknessRange`, 45.5.2
  `specularIntensity` / `specularColor`, 45.5.3
  `attenuationColor` / `attenuationDistance`, 45.6.1
  `cs2Finish`, 45.6.2 `cs2Wear`, 45.6.3 `cs2WearRemap`,
  45.6.4 `cs2WearMask`, 45.6.5 `cs2WearUserTunable` are
  ALL OPTIONAL; the current renderer ignores unknown
  keys safely)
- No new export path (the existing GLB / OBJ / STL /
  FBX / DAE / USDZ / .ts paths are unchanged)
- No new dependency (iridescence and specularIntensity
  are core MeshPhysicalMaterial / MeshStandardMaterial
  properties that have existed in Three.js for years;
  the renderer just hadn't been wiring them through)
- No new validator that blocks the model from loading
  (E30 is non-blocking, like E1-E29 before it)
- No change to the existing PART 1-44 rules (PART 45
  layers on top, never replaces — see 45.0.1)
- No change to the existing E1-E29 validators (they
  stay exactly as they were in v1.21 / v8.13)
- No change to PART 38.22's style agnosticism (PART
  45 is also style-agnostic in scope; see 45.0.3)
- No change to PART 38.14's GLB-first architecture
  (PART 45 extends it with the same viewer-adapter
  pattern; the .ts factory still SHIPS THE GLB and
  PART 45's opt-in is just an additional meta field)
- No change to PART 39.5's factory + options pattern
  (PART 45 reinforces it — the .ts factory uses the
  same options + helper pattern from 45.6)
- No change to PART 41.6's 4 default material
  families (PART 45.10.3 documents the 7th family
  extension point; the existing 4+2 = 6 stay
  exactly as they were)
- No change to PART 44.3's bone + magic families
  (the 6 family hierarchy from PART 44.3 stays
  exactly as it was)
- No change to the project's "Low Poly 3D" name
- No REMOVAL of any existing finish or material
  preset (the existing 30+ MAT_DB entries stay
  exactly as they were; the 7 new CS2 entries are
  PURE ADDITIONS; `polishedmetal` already exists
  from v6.4 and stays in place for backward
  compatibility)
- No REMOVAL or WEAKENING of any existing
  iridescence / clearcoat / sheen / anisotropy /
  transmission path (the existing 4 extensions
  stay exactly as they were; the 7 new
  MeshPhysicalMaterial / MeshStandardMaterial
  properties are PURE ADDITIONS to the same
  `wantsPhysical` switch)
- No downgrade of the existing system — strict
  upgrade, zero downgrades.

---

# v1.21 / v8.13 — Professional pipeline (PART 44)

The spec now teaches the AI the 4 new pieces from the maintainer's
"Three.js / procedural 3D character and asset systems engineer" brief
(2026-08): BVH-accelerated raycasting (via three-mesh-bvh, already
in the import map from v0.6), per-model look-dev lights, the
6-family material hierarchy with bone + magic, and the maintainer's
house style for .ts factory code (6 practical coding rules). The
other 4 pieces in the brief (formal Character Specification system,
continuous base meshes, real skeletal skinning, GLB as primary
interchange format) are already covered by PART 38 (character
pipeline upgrade, GLB-first architecture, E13-E16 validators) and
PART 42 (character production discipline, 11-step pipeline, 85-bone
skeleton, 30+ blend shapes). PART 44 EXTENDS the prior PARTs with
the implementation patterns the brief calls out: the 5-task
viewer adapter (load GLB + expose sockets + wire animation mixer +
wire look-dev lights + wire validation), the fit-over-body pattern
for fitted clothing, the 4 canonical animation clips (idle + walk
+ attack + hit), the 18-render multi-view validation grid (6 angles
× 3 poses), and the 6 practical coding rules. The renderer adds 2
new non-blocking validators (E28 BVH index presence and E29 look-dev
lights present) to the existing 27 (E1-E12 from PART 32, E13-E16
from PART 38, E17-E18 from PART 39, E19-E21 from PART 40, E22-E23
from PART 41, E24-E25 from PART 42, E26-E27 from PART 43), and 2
new canonical helpers re-exported on `window.lblSpec.helpers`
alongside the PART 35 + PART 39 + PART 40 + PART 41 + PART 42 +
PART 43 bundles: `createBVHIndex(root, opts)` (returns a Promise
that resolves to a BVH-accelerated raycast structure for a loaded
model; walks the mesh tree, attaches a `MeshBVH` from
`three-mesh-bvh` to every Mesh's geometry `boundsTree` field,
returns a summary `{ totalMeshes, indexedMeshes, skippedMeshes,
memoryEstimateBytes, csgReady: true }`; the renderer's E28
validator uses the same function) and `lookDevLights(opts)`
(returns the canonical 3-light setup — key + fill + rim — with an
optional `opts.environmentMap` for HDRI replacement; returns
`{ lights: [...], environment: envMap | null }`; the renderer's
E29 validator uses the same function shape). The
`materialVariants` helper from PART 41 is EXTENDED with the 2 new
families (bone + magic); the existing 4 families stay exactly as
they were. No new dependency (the three-mesh-bvh import-map entry
was already in place from v0.6; the new helpers use it; the
lookDevLights helper uses only Three.js core APIs that are already
imported; no import-map change), no new export path, no new
mandatory userData field, no removed / weakened rule, no change to
PART 38.22's style agnosticism, no change to PART 38.14's GLB-first
architecture (PART 44 extends it with the 5-task viewer adapter
pattern), no change to PART 39.5's factory + options pattern (PART
44 reinforces it as 44.8.4 + 44.8.5), no change to PART 41.6's 4
default material families (PART 44.3 extends them with bone +
magic; the existing 4 families stay exactly as they were).

## Files modified (8)

| File | Change |
|------|--------|
| `Prompt_To_Ts.txt`   | header v1.20 → v1.21; new v1.21 CHANGELOG entry; appended PART 44 (11 sub-sections: 44.0 central principle, 44.1 three-mesh-bvh performance, 44.2 look-dev lights per model, 44.3 material hierarchy, 44.4 fitted clothing/armor layers, 44.5 animation clip baking, 44.6 multi-view validation renders, 44.7 the TypeScript viewer adapter, 44.8 practical coding rules, 44.9 renderer-side runtime, 44.10 canonical helpers) |
| `Image_To_Ts.txt`    | header v1.20 → v1.21; new v1.21 CHANGELOG entry; appended PART 44 (same content; image-to-TS analysis protocol from PART 17 feeds 44.6 directly) |
| `Prompt_To_Js.txt`   | header v8.12 → v8.13; new v8.13 CHANGELOG entry; appended PART 44 (same content; references the JSON/JS `meta.bvhIndex` + `meta.useBVH` + `meta.lookDevLights` + `meta.materialOverrides` + `meta.animations` + `meta.animationSource` + `meta.validationClips` + `meta.validationGrid` fields as the JSON/JS analog of the TS path) |
| `Image_To_Js.txt`    | header v8.12 → v8.13; new v8.13 CHANGELOG entry; appended PART 44 |
| `Prompt_To_Json.txt` | header v8.12 → v8.13; new v8.13 CHANGELOG entry; appended PART 44 |
| `Image_To_Json.txt`  | header v8.12 → v8.13; new v8.13 CHANGELOG entry; appended PART 44 |
| `index.html`         | `lblSpec.VERSION` bumped to `{ts:'v1.21', json:'v8.13'}`; LBL spec chip text + title updated; meta description + keywords updated; 2 new professional-pipeline validators (E28 BVH index presence, E29 look-dev lights present) added to `ANTI_PATTERN_CHECKS`; 2 new canonical helpers (`createBVHIndex`, `lookDevLights`) added to the existing `__threeTriHelpers` bundle re-exported on `window.lblSpec.helpers`; lazy import `bvhLibPromise` for `three-mesh-bvh` (the MeshBVH accelerator) added near the existing `csgLibPromise` for `three-bvh-csg`; top-of-block comment updated to "RJS UPDATE 3 / 4 / 5 / 6 / 7 / 8 / 9 / 10 / 11 / 12 / 13" |
| `CHANGES_SUMMARY.md` | this round added at the top (this section); prior v1.20 / v8.12 round preserved below |

## Files UNTOUCHED

- `public/models/Model_1.ts` through `Model_5.ts` (still work
  standalone; the new meta fields from 44.1.1 `bvhIndex` /
  `useBVH`, 44.2.3 `lookDevLights`, 44.3.3 `materialOverrides`,
  44.5.1 `animations`, 44.5.2 `animationSource`, 44.5.3
  `validationClips`, 44.6.3 `validationGrid` are ALL optional,
  so existing models don't need any change to load)
- `public/models/manifest.json` (still works as-is)
- `.github/workflows/manifest.yml`
- `public/rig/three-rig-helpers.js`
- `public/rig/src/*.ts`
- `public/rig/build.sh`

## What PART 44 covers (11 sub-sections)

- **44.0**  Central principle — SHIP THE GLB; the .ts factory
            is the VIEWER ADAPTER; the .ts does 4 things:
            LOADS, ATTACHES, EXTRACTS, VALIDATES; style-
            agnostic.
- **44.1**  Three.js performance: three-mesh-bvh (3 sub-sections)
  - **44.1.1** BVH-accelerated raycasting (50x faster than
              triangle-walk; ~5MB memory for a 35k character)
  - **44.1.2** BVH-accelerated culling (frustum-cull pass
              drops from ~3ms to ~0.3ms for 1000 meshes)
  - **44.1.3** BVH-accelerated CSG (uses the already-
              imported three-bvh-csg from PART 10)
- **44.2**  Look-dev lights per model (3 sub-sections)
  - **44.2.1** The 3-light canonical setup (key warm +
              casts shadow from upper-right + fill cool no-
              shadow from lower-left + rim neutral no-
              shadow from behind; intensity ratio 1.0:0.4:0.6)
  - **44.2.2** HDRI environment map (RoomEnvironment is
              the canonical studio-HDRI fallback)
  - **44.2.3** Per-model look-dev override
              (`userData.sculptRuntime.lookDevLights`)
- **44.3**  Material hierarchy (extends PART 41.6 with bone +
            magic) (3 sub-sections)
  - **44.3.1** The 6 default material families (skin +
              cloth + leather + metal + bone + magic, each
              with 4 variants = 24 base materials)
  - **44.3.2** Material assignment order (skin → cloth →
              leather → metal → bone → magic; magic renders
              on top with the highest renderOrder)
  - **44.3.3** Per-region material override
              (`userData.sculptRuntime.materialOverrides`)
- **44.4**  Fitted clothing/armor layers (3 sub-sections)
  - **44.4.1** The fit-over-body pattern (clothing is a
              LAYER on top of the body part it covers, with
              a slight outward offset of 0.005-0.02 units
              + a slight scale-up of 1.01-1.05x + skin
              weights that mirror the body part's skeleton)
  - **44.4.2** Edge loops for clothing (edge loop count
              matches the body part's joint-edge-loop count
              from PART 38.7)
  - **44.4.3** Clothing-specific deformation (clothing's
              vertices are weighted to the closest
              underlying bone; corrective blend shape from
              PART 38.13 prevents poke-through for extreme
              poses)
- **44.5**  Animation clip baking for hero characters (3 sub-
            sections)
  - **44.5.1** The 4 canonical clips (idle 60-120 frame
              loop + walk 30-60 frame loop + attack 20-40
              frame one-shot + hit 10-20 frame one-shot)
  - **44.5.2** Bake from mocap or hand-key
              (`meta.animationSource: 'mocap' | 'hand-key' |
              'procedural'`)
  - **44.5.3** Multi-view validation per clip
              (`meta.validationClips: ['idle', 'walk',
              'attack', 'hit']`)
- **44.6**  Multi-view validation renders (3 sub-sections)
  - **44.6.1** 6 canonical angles (front + 3/4-front +
              side + 3/4-back + back + top)
  - **44.6.2** 3 canonical poses (idle rest + walk-cycle
              contact + attack wind-up-to-strike)
  - **44.6.3** The 18-render grid (6 angles × 3 poses =
              18 silhouette renders per model; per-render
              silhouette IoU vs reference image; <0.7 IoU
              on any render surfaces a warning)
- **44.7**  The TypeScript viewer adapter (5 tasks)
  - **44.7.1** Load GLB via GLTFLoader from
              `three/addons/loaders/GLTFLoader.js`
  - **44.7.2** Expose sockets (the 4 canonical Socket_*
              attachment points on
              `root.userData.sockets`)
  - **44.7.3** Wire animation mixer (AnimationMixer with
              the 4 canonical clips + an `animationFsm`
              object with a `trigger(state)` method)
  - **44.7.4** Wire look-dev lights (via the new
              `lookDevLights(opts)` helper from 44.10)
  - **44.7.5** Wire validation (via
              `lblSpec.helpers.validateModel(root, {
              maxGap: 0.02 })`)
- **44.8**  Practical coding rules (the maintainer's house
            style) (6 rules)
  - **44.8.1** No code on the same line after a `//`
              comment separator
  - **44.8.2** Always leave a blank line after section
              header comments
  - **44.8.3** Prefer the correct geometry primitive
  - **44.8.4** Drive everything from a single `*_CONFIG`
              object at the top of the file
  - **44.8.5** Add runtime tweakable parameters (Tweakpane
              / Leva / dat.gui) + a boot-time `validateModel`
              call
  - **44.8.6** Include automatic multi-view validation
              renders (the 18-render grid from 44.6.3)
- **44.9**  Renderer-side runtime contract — adds 2 new
            non-blocking validators to the existing 27:
  - **44.9.1** E28 — BVH index presence (PART 44.1.1) —
              `userData.sculptRuntime.bvhIndex` is set
              AND every Mesh's geometry has a `boundsTree`
  - **44.9.2** E29 — Look-dev lights present (PART
              44.2.3) — well-formed key + fill + rim
              structure with `intensity` and `position`
  - **44.9.3** E28 / E29 do NOT change load behavior
              (both non-blocking; the model still loads)
- **44.10** Canonical helpers (re-exported on
            window.lblSpec):
  - `createBVHIndex(root, opts)` — Appendix A
  - `lookDevLights(opts)` — Appendix B

## What PART 44 does NOT introduce

- No new mandatory field on any existing userData namespace
  (the new fields in 44.1.1 `bvhIndex` / `useBVH`, 44.2.3
  `lookDevLights`, 44.3.3 `materialOverrides`, 44.5.1
  `animations`, 44.5.2 `animationSource`, 44.5.3
  `validationClips`, 44.6.3 `validationGrid` are ALL
  optional; the current renderer ignores unknown keys
  safely)
- No new export path (the existing GLB / OBJ / STL / FBX /
  DAE / USDZ / .ts paths are unchanged)
- No new dependency (the three-mesh-bvh import-map entry
  was already in place from v0.6; the new helper just
  uses it; the lookDevLights helper uses only Three.js
  core APIs that are already imported; no import-map
  change)
- No new validator that blocks the model from loading
  (E28, E29 are non-blocking, like E1-E27 before them)
- No change to the existing PART 1-43 rules (PART 44
  reinforces them — see the 44.0 + 44.7 + 44.8 cross-
  references)
- No change to the existing E1-E27 validators (they stay
  exactly as they were in v1.20 / v8.12)
- No change to PART 38.22's style agnosticism (PART 44
  is also style-agnostic)
- No change to PART 38.14's GLB-first architecture
  (PART 44 extends it with the 5-task viewer adapter
  pattern)
- No change to PART 39.5's factory + options pattern
  (PART 44 reinforces it as 44.8.4 + 44.8.5)
- No change to PART 41.6's 4 default material families
  (PART 44.3 extends them with bone + magic; the
  existing 4 families stay exactly as they were)
- No change to the project's "Low Poly 3D" name

## Quick reference for the renderer build

```js
// In a loaded .ts factory, build a BVH index for the
// model (returns a Promise that resolves to a summary):
const summary = await lblSpec.helpers.createBVHIndex(root);
console.log('Indexed', summary.indexedMeshes, 'of',
            summary.totalMeshes, 'meshes;',
            '~', (summary.memoryEstimateBytes / 1024 / 1024).toFixed(1),
            'MB BVH memory');
// The renderer's E28 validator uses the same function.

// In a loaded .ts factory, get the canonical 3-light
// look-dev setup:
const ldl = lblSpec.helpers.lookDevLights({
  keyIntensity: 1.0,
  fillIntensity: 0.4,
  rimIntensity: 0.6,
  castShadow: true,
  environmentMap: 'studio'  // or 'outdoor' / 'night' / null
});
root.userData.sculptRuntime = root.userData.sculptRuntime || {};
root.userData.sculptRuntime.lookDevLights = {
  key:      { color: 0xfff2e0, intensity: 1.0, position: { x: 5, y: 8, z: 5 }, castShadow: true },
  fill:     { color: 0xd0e0ff, intensity: 0.4, position: { x: -5, y: 2, z: -3 }, castShadow: false },
  rim:      { color: 0xffffff, intensity: 0.6, position: { x: 0, y: 4, z: -8 }, castShadow: false },
  environmentMap: 'studio',
  enabled: true
};
ldl.lights.forEach(l => root.add(l));
if(ldl.environment){
  // Attach the HDRI as the scene's environment.
  // (In the GLB-first architecture, the scene's
  // environment is set on the parent scene, not on
  // the model root.)
}
// The renderer's E29 validator uses the same function shape.
```

## Related prior rounds (for context)

- **v1.11 / v8.3** — Pre-bundled rig helpers (PART 34)
- **v1.12 / v8.4** — Triangle-first geometry (PART 35)
- **v1.13 / v8.5** — Multi-file drop + Model + Rig pairing (PART 36)
- **v1.14 / v8.6** — Zip bundle support (PART 37)
- **v1.15 / v8.7** — Character pipeline upgrade (PART 38)
- **v1.16 / v8.8** — 3D modeling techniques (PART 39)
- **v1.17 / v8.9** — Better models through better generation (PART 40)
- **v1.18 / v8.10** — High-detail generation (PART 41)
- **v1.19 / v8.11** — Character production discipline (PART 42)
- **v1.20 / v8.12** — Refinement + style locking + variant
  ranking (PART 43)
- **v1.21 / v8.13** — Professional pipeline (PART 44, this
  round)

---

# v1.20 / v8.12 — Refinement + style locking + variant ranking (PART 43)

The spec now teaches the AI the 3 NEW categories from the maintainer's
"Techniques to Update Your System for Better 3D Models" (2026-08):
geometry refinement (Section 5), style & consistency controls (Section
6), and variant generation + automatic ranking (Section 7). The other
4 categories (input quality & prompt engineering, multi-stage
generation, topology & mesh quality, texture & material generation)
were already covered by PART 40 / 41 / 42; PART 43 reinforces them
with cross-references in 43.4. The new categories are: (43.1) 4
geometry refinement techniques — normal-guided refinement (predict
normals from a high-frequency normal map, shift vertex positions
along the predicted normal, re-bake, repeat until convergence;
preserves silhouette while adding high-frequency detail; runs in
Stage 4 of PART 41.2 and Step 7 of PART 42.3), view-by-view iterative
refinement (alternate between N camera views, identify failure modes
per view, refine per view, combine at the end; consumes the PART
40.1.3 multi-view image support; factory publishes
`meta.viewRefinementPasses` and `meta.viewRefinementLog`), detail
enhancement networks (specialized models that take a low-poly mesh +
a reference image and add high-frequency detail WITHOUT changing the
silhouette; runs in Stage 3 of PART 41.2 and Step 4 of PART 42.3;
factory publishes `meta.detailEnhancer`), and segmentation +
part-aware generation (auto-split the model into logical parts so
each part gets the right technique; EXTENDS the PART 41.1 detail
inventory with `meta.segmentation`); (43.2) 4 style & consistency
controls — strong style locking (`meta.styleLock` declaration that
constrains the material kind + density + texture density to a
single style; EXTENDS PART 38.22 with an explicit lock field;
without the lock, the model is still style-agnostic per PART 38.22),
consistent polygon density and edge flow across model families
(`meta.familyDensity` + `meta.familyEdgeFlow` for N-model scenes like
"a medieval village" with 12 buildings + 30 villagers + 15 props;
the renderer does NOT enforce cross-model consistency but the AI's
authoring-time audit from PART 39.6 gets a new line "is this model
consistent with the family-wide density and edge flow?"),
silhouette-first optimization (`meta.silhouettePriority` declaration
of the priority order of camera angles — default
['front', '3/4-front', 'side', '3/4-back', 'back', 'top']; the AI
optimizes the silhouette from the most important angles first then
fills in the rest from the remaining budget), and hard-surface vs
organic topology (`meta.topologyPreference` declaration of
'hard-surface' | 'organic' | 'mixed' | 'auto-detect'; hard-surface
has edge loops at every sharp edge + planar surfaces; organic has
edge loops following the muscle / bone structure + smooth shading);
(43.3) 3 variant generation + automatic ranking techniques — generate
N variants (default N=3, override via `meta.variantCount`; N
variants from the same detail inventory from PART 41.1 but with
different `meta.seed` values via the seededRandom helper from PART
40.6.2; deterministic — the user can regenerate the exact N
variants on reload), rank by quality metrics (the new `rankVariants`
helper from 43.6 scores each variant on the E1-E27 warnings +
silhouette accuracy + poly count + mesh count + poly distribution +
style lock + production completeness; the user sees the top-ranked
variant by default), and user feedback loop (EXTENDS PART 40.7.4
with a `meta.favoriteSeed` field that records the user's favorite
variant's seed and a `meta.averageRating` field that records the
average 1-5 rating; both feed back into the next session's prompt
defaults). The renderer adds 2 new non-blocking validators (E26
style-lock compliance and E27 multi-view consistency) to the
existing 25 (E1-E12 from PART 32, E13-E16 from PART 38, E17-E18 from
PART 39, E19-E21 from PART 40, E22-E23 from PART 41, E24-E25 from
PART 42), and 2 new canonical helpers re-exported on
`window.lblSpec.helpers` alongside the PART 35 + PART 39 + PART 40
+ PART 41 + PART 42 bundles: `viewRefinePass(views, opts)` (returns
a structured refinement plan with per-view pass count and 0-1
completeness score; a STUB for the AI's authoring-time loop; the
renderer's E27 validator reads the same fields) and
`rankVariants(variants, opts)` (scores and ranks N variants by the
E1-E27 quality metrics; returns the sorted list with 0-1 confidence
per variant; does NOT actually render — that's the renderer's job).
No new dependency, no new export path, no new mandatory userData
field, no removed / weakened rule, no change to PART 38.22's style
agnosticism (PART 43.2.1 style-lock is OPTIONAL; without it, the
model is still style-agnostic), no change to PART 41's 5-stage
pipeline (PART 43's geometry refinement techniques run INSIDE the
existing stages, not as new stages), no change to PART 42's 11-step
pipeline (PART 43's style & consistency controls are meta-
declarations, not pipeline steps).

## Files modified (8)

| File | Change |
|------|--------|
| `Prompt_To_Ts.txt`   | header v1.19 → v1.20; new v1.20 CHANGELOG entry; appended PART 43 (7 sub-sections: 43.0 central principle, 43.1 geometry refinement techniques, 43.2 style & consistency controls, 43.3 variant generation + automatic ranking, 43.4 what PART 43 reinforces from PART 40-42, 43.5 renderer-side runtime, 43.6 canonical helpers) |
| `Image_To_Ts.txt`    | header v1.19 → v1.20; new v1.20 CHANGELOG entry; appended PART 43 (same content; image-to-TS analysis protocol from PART 17 feeds 43.1.2 directly) |
| `Prompt_To_Js.txt`   | header v8.11 → v8.12; new v8.12 CHANGELOG entry; appended PART 43 (same content; references the JSON/JS `meta.styleLock` + `meta.referenceViews` + `meta.silhouettePriority` + `meta.viewRefinementPasses` + `meta.familyDensity` + `meta.familyEdgeFlow` + `meta.topologyPreference` + `meta.variants` fields) |
| `Image_To_Js.txt`    | header v8.11 → v8.12; new v8.12 CHANGELOG entry; appended PART 43 |
| `Prompt_To_Json.txt` | header v8.11 → v8.12; new v8.12 CHANGELOG entry; appended PART 43 |
| `Image_To_Json.txt`  | header v8.11 → v8.12; new v8.12 CHANGELOG entry; appended PART 43 |
| `index.html`         | `lblSpec.VERSION` bumped to `{ts:'v1.20', json:'v8.12'}`; LBL spec chip text + title updated; meta description + keywords updated; 2 new refinement/style-locking/variant-ranking validators (E26 style-lock compliance, E27 multi-view consistency) added to `ANTI_PATTERN_CHECKS`; 2 new canonical helpers (`viewRefinePass`, `rankVariants`) added to the existing `__threeTriHelpers` bundle re-exported on `window.lblSpec.helpers`; top-of-block comment updated to "RJS UPDATE 3 / 4 / 5 / 6 / 7 / 8 / 9 / 10 / 11 / 12" |
| `CHANGES_SUMMARY.md` | this round added at the top (this section); prior v1.19 / v8.11 round preserved below |

## Files UNTOUCHED

- `public/models/Model_1.ts` through `Model_5.ts` (still work
  standalone; the new meta fields from 43.1.1
  `normalRefinementPasses`, 43.1.2 `viewRefinementPasses` /
  `viewRefinementLog`, 43.1.3 `detailEnhancer`, 43.1.4
  `segmentation`, 43.2.1 `styleLock`, 43.2.2 `familyDensity` /
  `familyEdgeFlow`, 43.2.3 `silhouettePriority`, 43.2.4
  `topologyPreference`, 43.3.1 `variantCount` / `variants`,
  43.3.3 `favoriteSeed` / `averageRating` are ALL optional,
  so existing models don't need any change to load)
- `public/models/manifest.json` (still works as-is)
- `.github/workflows/manifest.yml`
- `public/rig/three-rig-helpers.js`
- `public/rig/src/*.ts`
- `public/rig/build.sh`

## What PART 43 covers (7 sub-sections)

- **43.0**  Central principle — 4 categories already covered by
            PART 40, 3 NEW categories added by PART 43; the
            bridge from "good enough" to "Meshy 6 / Tripo
            level"; style-agnostic.
- **43.1**  Geometry refinement techniques (4 patterns)
  - **43.1.1** Normal-guided refinement (predict normals +
              shift vertices + re-bake, repeat)
  - **43.1.2** View-by-view iterative refinement (alternate
              between N camera views, refine per view, combine)
  - **43.1.3** Detail enhancement networks (preserve
              silhouette + add high-frequency detail)
  - **43.1.4** Segmentation + part-aware generation (auto-
              split into logical parts)
- **43.2**  Style & consistency controls (4 controls)
  - **43.2.1** Strong style locking (material kind + density
              + texture density match the locked style)
  - **43.2.2** Consistent polygon density and edge flow
              across model families
  - **43.2.3** Silhouette-first optimization (priority order
              of camera angles)
  - **43.2.4** Hard-surface vs organic topology
- **43.3**  Variant generation + automatic ranking (3 techniques)
  - **43.3.1** Generate N variants from the same detail
              inventory with different `meta.seed` values
  - **43.3.2** Rank by quality metrics (E1-E27)
  - **43.3.3** User feedback loop (favorite + 1-5 rating;
              EXTENDS PART 40.7.4)
- **43.4**  What PART 43 reinforces from PART 40-42 (4 cross-
            reference tables for the already-covered categories)
- **43.5**  Renderer-side runtime contract — adds 2 new
            non-blocking validators to the existing 25:
  - **43.5.1** E26 — Style lock compliance (PART 43.2.1) —
              material kind + density + texture density match
              the declared `meta.styleLock`
  - **43.5.2** E27 — Multi-view consistency (PART 40.1.3 /
              43.1.2 / 43.2.3) — named parts >= reference
              views, silhouettePriority consistent, view
              RefinementPasses >= 1
  - **43.5.3** E26 / E27 do NOT change load behavior (both
              non-blocking; the model still loads)
- **43.6**  Canonical helpers (re-exported on window.lblSpec):
  - `viewRefinePass(views, opts)` — Appendix A
  - `rankVariants(variants, opts)` — Appendix C

## What PART 43 does NOT introduce

- No new mandatory field on any existing userData namespace
  (the new fields in 43.1.1 `normalRefinementPasses`, 43.1.2
  `viewRefinementPasses` / `viewRefinementLog`, 43.1.3
  `detailEnhancer`, 43.1.4 `segmentation`, 43.2.1
  `styleLock`, 43.2.2 `familyDensity` / `familyEdgeFlow`,
  43.2.3 `silhouettePriority`, 43.2.4
  `topologyPreference`, 43.3.1 `variantCount` / `variants`,
  43.3.3 `favoriteSeed` / `averageRating` are ALL optional;
  the current renderer ignores unknown keys safely)
- No new export path (the existing GLB / OBJ / STL / FBX /
  DAE / USDZ / .ts paths are unchanged)
- No new dependency (the new helpers use only Three.js APIs
  that are already imported; no import-map change)
- No new validator that blocks the model from loading
  (E26, E27 are non-blocking, like E1-E25 before them)
- No change to the existing PART 1-42 rules (PART 43
  reinforces them — see the 43.0 + 43.4 + 43.6 cross-
  references)
- No change to the existing E1-E25 validators (they stay
  exactly as they were in v1.19 / v8.11)
- No change to PART 38.22's style agnosticism (PART 43.2.1
  style-lock is OPTIONAL; without it, the model is still
  style-agnostic)
- No change to PART 41's 5-stage pipeline (PART 43's
  geometry refinement techniques run INSIDE the existing
  stages, not as new stages)
- No change to PART 42's 11-step pipeline (PART 43's
  style & consistency controls are meta-declarations, not
  pipeline steps)
- No change to the project's "Low Poly 3D" name

## Quick reference for the renderer build

```js
// In a loaded .ts factory, build a view-by-view refinement
// plan (PART 43.1.2):
const plan = lblSpec.helpers.viewRefinePass(
  ['front', 'side', 'back'],
  { passesPerView: 2 }
);
console.log(plan.validViewCount, 'valid views,',
            'completeness', plan.completeness);

// In a loaded .ts factory (or via the inspector), rank N
// variants by quality metrics (PART 43.3.2):
const variants = [
  { root: root1, meta: meta1, warnings: warnings1 },
  { root: root2, meta: meta2, warnings: warnings2 },
  { root: root3, meta: meta3, warnings: warnings3 }
];
const ranked = lblSpec.helpers.rankVariants(variants);
// ranked[0] is the top variant; ranked[0].confidence is
// 0-1 (1.0 = no warnings).
```

## Related prior rounds (for context)

- **v1.11 / v8.3** — Pre-bundled rig helpers (PART 34)
- **v1.12 / v8.4** — Triangle-first geometry (PART 35)
- **v1.13 / v8.5** — Multi-file drop + Model + Rig pairing (PART 36)
- **v1.14 / v8.6** — Zip bundle support (PART 37)
- **v1.15 / v8.7** — Character pipeline upgrade (PART 38)
- **v1.16 / v8.8** — 3D modeling techniques (PART 39)
- **v1.17 / v8.9** — Better models through better generation (PART 40)
- **v1.18 / v8.10** — High-detail generation (PART 41)
- **v1.19 / v8.11** — Character production discipline (PART 42)
- **v1.20 / v8.12** — Refinement + style locking + variant
  ranking (PART 43, this round)

---

# v1.19 / v8.11 — Character production discipline (PART 42)

The spec now teaches the AI the character-specific production
discipline from the maintainer's "3D Character Production Plan — Lead
3D Technical Director" (2026-08), a worked example for a stylized
action hero with armor, cape, and hair. The plan distills the 7
production techniques (UV + image textures, PBR texturing, procedural
textures, vertex colors, triplanar mapping, baking, texture
atlasing), the 60/25/15 polygon distribution rule (silhouette 60% /
deformation 25% / detail 15% for stylized-realism, with style-
specific variants for low-poly 80/15/5, high-poly 50/30/20, photoreal
45/30/25, voxel 95/5/0, hand-painted 70/20/10), the 11-step production
pipeline (blockout → sculpt primary → sculpt secondary → retopo → UV
→ bake → texture → hair/cloth → LODs → rig → export, each with a QC
gate), the 85-bone skeleton reference for hero characters, the 5-LOD
chain (LOD0 35k / LOD1 18k / LOD2 7.5k / LOD3 2.5k / LOD4 100 + 1k
billboard), the 7 deformation risk areas (shoulder collapse, hip
pinch, knee pole deform, elbow crease pinch, cape intersection with
legs, head rotation, belt folds), the 30+ blend shapes for facial
expression (3 brows + 5 eyes + 10 mouth + 2 cheeks + 2 nose + 10
phonemes), the half-budget cut list (12 cuts in priority order if the
budget is cut from 35k to 17.5k), the never-cut list (mouth+eye
topology, hip+knee loops, cape attachment ring), the film-quality
upgrade list (10 additions for going from 35k to ~2M tris: hair
groom, full 3-layer SSS, real cornea with refraction, full cloth
sim, micro-scratch armor, full mechanical weapon detail, 50k tris
face subdivision, 4k px/m texel density, 30+ AOV render passes, full
mocap cleanup), and the ~1.4 ms / character performance budget at
60 fps / 1080p. The renderer adds 2 new non-blocking validators
(E24 production-completeness and E25 polygon-distribution
compliance) to the existing 23 (E1-E12 from PART 32, E13-E16 from
PART 38, E17-E18 from PART 39, E19-E21 from PART 40, E22-E23 from
PART 41), and 2 new canonical helpers re-exported on
`window.lblSpec.helpers` alongside the PART 35 + PART 39 + PART 40
+ PART 41 bundles: `polyDistribution(root)` (returns the actual
{ silhouette, deformation, detail, total, ok } split based on the
castShadow / isSkinnedMesh / neither flags, with the 60/25/15
stylized-realism default encoded) and `productionChecklist(meta)`
(returns the structured
{ steps, deformationFixes, lodChain, halfBudgetCutList,
filmQualityItems, targetQuality, productionStep, completeness }
shape with the 0-1 completeness score, and is the same function
the renderer's E24 validator uses). No new dependency, no new export
path, no new mandatory userData field, no removed / weakened rule,
no change to PART 38.22's style agnosticism, no change to PART 41's
5-stage pipeline (PART 42's 11-step pipeline is the CHARACTER-
SPECIFIC superset; non-character subjects still use PART 41's
5-stage).

## Files modified (8)

| File | Change |
|------|--------|
| `Prompt_To_Ts.txt`   | header v1.18 → v1.19; new v1.19 CHANGELOG entry; appended PART 42 (11 sub-sections: 42.0 central principle, 42.1 the 7 production techniques, 42.2 the 60/25/15 polygon distribution, 42.3 the 11-step production pipeline, 42.4 rig and animation prep, 42.5 the 5-LOD chain, 42.6 performance budget, 42.7 half-budget cut list, 42.8 film-quality upgrade list, 42.9 renderer-side runtime, 42.10 canonical helpers) |
| `Image_To_Ts.txt`    | header v1.18 → v1.19; new v1.19 CHANGELOG entry; appended PART 42 (same content; image-to-TS analysis protocol from PART 17 feeds 42.1 directly) |
| `Prompt_To_Js.txt`   | header v8.10 → v8.11; new v8.11 CHANGELOG entry; appended PART 42 (same content; references the JSON/JS `meta.productionStep` + `meta.deformationFixes` + `meta.lodChain` + `meta.halfBudgetCutList` + `meta.filmQualityItems` + `meta.targetQuality` + `meta.polyDistribution` fields) |
| `Image_To_Js.txt`    | header v8.10 → v8.11; new v8.11 CHANGELOG entry; appended PART 42 |
| `Prompt_To_Json.txt` | header v8.10 → v8.11; new v8.11 CHANGELOG entry; appended PART 42 |
| `Image_To_Json.txt`  | header v8.10 → v8.11; new v8.11 CHANGELOG entry; appended PART 42 |
| `index.html`         | `lblSpec.VERSION` bumped to `{ts:'v1.19', json:'v8.11'}`; LBL spec chip text + title updated; meta description + keywords updated; 2 new character-production validators (E24 production-completeness, E25 polygon-distribution compliance) added to `ANTI_PATTERN_CHECKS`; 2 new canonical helpers (`polyDistribution`, `productionChecklist`) added to the existing `__threeTriHelpers` bundle re-exported on `window.lblSpec.helpers`; top-of-block comment updated to "RJS UPDATE 3 / 4 / 5 / 6 / 7 / 8 / 9 / 10 / 11" |
| `CHANGES_SUMMARY.md` | this round added at the top (this section); prior v1.18 / v8.10 round preserved below |

## Files UNTOUCHED

- `public/models/Model_1.ts` through `Model_5.ts` (still work
  standalone; the new meta fields from 42.3 `productionStep`,
  42.4.1 `deformationFixes`, 42.4.2 `blendShapes` /
  `rigControls`, 42.5 `lodChain`, 42.7 `halfBudgetCutList`,
  42.8 `filmQualityItems`, 42.2 `polyDistribution`, 42.6
  `targetQuality` are ALL optional, so existing models don't
  need any change to load)
- `public/models/manifest.json` (still works as-is)
- `.github/workflows/manifest.yml`
- `public/rig/three-rig-helpers.js`
- `public/rig/src/*.ts`
- `public/rig/build.sh`

## What PART 42 covers (11 sub-sections)

- **42.0**  Central principle — a character is NOT a single-shot
            prompt-to-geometry call; it's the output of 7
            production techniques + an 11-step pipeline + a
            5-LOD chain + an 85-bone skeleton + a 7-deformation-
            risk register + a performance budget; style-agnostic.
- **42.1**  The 7 production techniques
  - **42.1.1** UV + image textures (focal areas, hand-painted
              control — face, skin, hair cards, logo decals,
              fabric base colors)
  - **42.1.2** PBR texturing (default for ALL surfaces, 5
              maps: albedo + normal + metallic + roughness + AO;
              height optional)
  - **42.1.3** Procedural textures (infinite tiling, free of
              seams, scales to LOD0..LOD3 — skin pores, fabric
              weave, metal micro-scratch, leather grain, dirt
              /wear masks)
  - **42.1.4** Vertex colors (zero texture cost — damage tint,
              dirt in crevices, per-region masks, cape tip
              darkening, low-poly AO back-up)
  - **42.1.5** Triplanar mapping (no UV seams, no axial
              stretching — cape back, large planar armor panels,
              terrain-crawling rock, hair cap underside)
  - **42.1.6** Baking (high-poly → low-poly normal/AO/curvature
              /ID/position via xNormal / Marmoset Toolbag)
  - **42.1.7** Texture atlasing (small props, shared materials,
              modular armor kit — one draw call, one material
              slot per atlas)
- **42.2**  The 60/25/15 polygon distribution rule
  - Stylized-realism default: silhouette 60% / deformation 25%
    / detail 15%
  - Style-specific variants: low-poly 80/15/5, high-poly
    50/30/20, photoreal 45/30/25, voxel 95/5/0,
    hand-painted 70/20/10
  - At 35k budget: silhouette 21k, deformation 8.75k, detail
    5.25k
- **42.3**  The 11-step production pipeline (the CHARACTER-
            SPECIFIC superset of PART 41's 5-stage)
  - Step 1 — Blockout (T-pose, 4k tris)
  - Step 2 — Sculpt, primary forms (ZBrush, ~150k tris)
  - Step 3 — Sculpt, secondary detail (ZBrush, 1-2M tris)
  - Step 4 — Retopology (Blender, target 35k tris)
  - Step 5 — UV layout (Blender/RizomUV)
  - Step 6 — Bake (Marmoset Toolbag or xNormal)
  - Step 7 — Texture (Substance Painter)
  - Step 8 — Hair + cloth setup
  - Step 9 — LODs (Simplygon or manual)
  - Step 10 — Rig + skin
  - Step 11 — Final export + engine import
  - Each step has a QC gate
- **42.4**  Rig and animation prep
  - **42.4.1** The 7 deformation risk areas (shoulder, hip,
              knee, elbow, cape, head, belt) and their fixes
  - **42.4.2** Facial expressions and special controls (30+
              blend shapes + 6+ custom rig controls)
  - The 85-bone skeleton reference (Root + Pelvis + 3-spine
    + Neck + Head + 2-Eyes + Jaw + 3-Tongue + 2-Clavicle +
    2-UpperArm + 2-Elbow + 2-Forearm + 2-Wrist + 2-Hand +
    30-fingers + 2-UpperLeg + 2-Knee + 2-LowerLeg + 2-Ankle
    + 2-Ball + 2-Toe + Cape_Root + 3-Cape + 2-Cape_Hem)
- **42.5**  The 5-LOD chain
  - LOD0 — 35,000 tris (close-up, 2k face, 1k body)
  - LOD1 — 18,000 tris (mid-range, 1k face)
  - LOD2 — 7,500 tris (far, 512 face)
  - LOD3 — 2,500 tris (background, 256 atlas, no normal map,
    mitts, single quad cape)
  - LOD4 (impostor) — 100 tris + 1k billboard (crowd, quat-
    camera-facing plane baked from 8 viewing angles)
- **42.6**  Performance budget — ~1.4 ms / character at 60 fps /
            1080p (vertex 0.6ms + fragment 0.8ms + 3 draw calls
            + 8MB texture bandwidth); WebGL fallback caps at
            LOD2 7.5k; mobile is 12k LOD0 / 5k LOD1 / 2k LOD2
- **42.7**  Half-budget cut list — if budget is cut from 35k
            to 17.5k, cut in this priority order: cape, hair
            cards, hand fingers, vambrace, greave, boot detail,
            belt + pouches, weapon, torso, pauldrons, head,
            body silhouette; the never-cut list: mouth+eye
            topology, hip+knee loops, cape attachment ring
- **42.8**  Film-quality upgrade list — 10 additions for going
            from 35k to ~2M: hair groom, full 3-layer SSS skin,
            real cornea with refraction, full cloth sim, micro-
            scratch + fingerprint oil armor, full mechanical
            weapon, 50k tris face subdivision, 4k px/m texel
            density, 30+ AOV render passes, full mocap cleanup
- **42.9**  Renderer-side runtime contract — adds 2 new
            non-blocking validators to the existing 23:
  - **42.9.1** E24 — Production completeness (PART 42.3 /
              42.4.1 / 42.8) — checks 11 steps + 7 deformation
              fixes + 10 film items; character subjects only
  - **42.9.2** E25 — Polygon distribution compliance
              (PART 42.2 / 42.5) — checks 60/25/15 split
              within ±10% per axis
  - **42.9.3** E24 / E25 do NOT change load behavior (both
              non-blocking; the model still loads)
- **42.10** Canonical helpers (re-exported on window.lblSpec):
  - `polyDistribution(root)` — Appendix A
  - `productionChecklist(meta)` — Appendix C

## What PART 42 does NOT introduce

- No new mandatory field on any existing userData namespace
  (the new fields in 42.3 `productionStep`, 42.4.1
  `deformationFixes`, 42.4.2 `blendShapes` / `rigControls`,
  42.5 `lodChain`, 42.7 `halfBudgetCutList`, 42.8
  `filmQualityItems`, 42.2 `polyDistribution`, 42.6
  `targetQuality` are ALL optional; the current renderer
  ignores unknown keys safely)
- No new export path (the existing GLB / OBJ / STL / FBX /
  DAE / USDZ / .ts paths are unchanged)
- No new dependency (the new helpers use only Three.js APIs
  that are already imported; no import-map change)
- No new validator that blocks the model from loading
  (E24, E25 are non-blocking, like E1-E23 before them)
- No change to the existing PART 1-41 rules (PART 42
  reinforces them — see the 42.0 + 42.10 cross-references)
- No change to the existing E1-E23 validators (they stay
  exactly as they were in v1.18 / v8.10)
- No change to PART 38.22's style agnosticism (PART 42 is
  also style-agnostic — applies to every subject, every
  style, every path; the 7-technique + 11-step + 5-LOD
  framing is style-agnostic; only the numeric budgets
  change with style)
- No change to PART 41's 5-stage pipeline (PART 42's
  11-step pipeline is the CHARACTER-SPECIFIC superset;
  non-character subjects still use PART 41's 5-stage)
- No change to the project's "Low Poly 3D" name

## Quick reference for the renderer build

```js
// In a loaded .ts factory, compute the actual
// silhouette/deformation/detail split:
const split = lblSpec.helpers.polyDistribution(root);
console.log('S/D/D:', split.silhouette.toFixed(0) + '% / ' +
                    split.deformation.toFixed(0) + '% / ' +
                    split.detail.toFixed(0) + '%');
// The 60/25/15 stylized-realism default; the renderer's
// E25 validator uses the same function.

// In a loaded .ts factory (or via the inspector), get the
// structured production checklist with the 0-1 completeness
// score:
const c = lblSpec.helpers.productionChecklist({
  productionStep: 11,
  deformationFixes: ['shoulder', 'hip', 'knee', 'elbow', 'cape', 'head', 'belt'],
  lodChain: [
    { level: 0, triangles: 35000 },
    { level: 1, triangles: 18000 },
    { level: 2, triangles:  7500 },
    { level: 3, triangles:  2500 },
    { level: 4, triangles:   100 }
  ],
  halfBudgetCutList: ['cape 920→280', 'hair 240→120'],
  filmQualityItems: [],
  targetQuality: 'game'
});
console.log('Completeness:', c.completeness.toFixed(2),
            '(', Object.values(c.steps).filter(Boolean).length, '/ 11 steps )');
// The renderer's E24 production-completeness validator uses
// the same function.
```

## Related prior rounds (for context)

- **v1.11 / v8.3** — Pre-bundled rig helpers (PART 34)
- **v1.12 / v8.4** — Triangle-first geometry (PART 35)
- **v1.13 / v8.5** — Multi-file drop + Model + Rig pairing (PART 36)
- **v1.14 / v8.6** — Zip bundle support (PART 37)
- **v1.15 / v8.7** — Character pipeline upgrade (PART 38)
- **v1.16 / v8.8** — 3D modeling techniques (PART 39)
- **v1.17 / v8.9** — Better models through better generation (PART 40)
- **v1.18 / v8.10** — High-detail generation (PART 41)
- **v1.19 / v8.11** — Character production discipline (PART 42,
  this round)

---

# v1.18 / v8.10 — High-detail generation (PART 41)

The spec now teaches the AI the production-density discipline from
the maintainer's "System High-Detail Update Plan" (2026-08): prefer
geometric density over code brevity; a 5-stage pipeline (Blockout →
Structure → Density → Surface → Polish) that promotes PART 40's
4-stage to a finer 5-stage; a detail inventory (identity / secondary
/ tertiary / material zones) the AI must publish BEFORE writing any
geometry; minimum mesh count targets per subject class (200 for
character, 150 for vehicle, 80 for weapon, 40 for prop, 100 for
architecture, 300 for scene); 6 stronger geometry vocabulary
patterns (overlapping boxes for layered armor, multiple thin
cylinders for rings, small spheres for rivets, thin boxes for
seams, slightly rotated pieces for organic feel, multi-layer cloth
for capes); a first-class silhouette & proportion pass with
multi-angle readability + limb thickness + weight distribution +
prop scale; 4 default material families × 4 variants each = 16
base materials (plate / cloth / leather / stone with plateDark /
plateLight / plateCold / clothDark / clothLight / clothFaded /
leatherDark / leatherLight / leatherWorn / stoneDark / stoneLight /
stoneWeathered) plus 3 dedicated scratch / damage / engrave
materials; a 4-child hierarchy with named nodes + canonical
sockets + complete `userData.sculptRuntime`; the 7 prompt rules
("prefer geometric density over code brevity" + "every major
surface must have at least one layer of secondary detail" +
"battle damage, rivets, seams and folds must be real geometry,
not just color" + "target minimum 200-400 meshes for a full
character" + "build in clear passes: Blockout → Structure →
Density → Surface → Polish" + "never leave large flat surfaces
unbroken" + "use overlapping plates and thickness to create
readable form"). The renderer adds 2 new non-blocking validators
(E22 detail-inventory compliance, E23 minimum-mesh-count target)
to the existing 21 (E1-E12 from PART 32, E13-E16 from PART 38,
E17-E18 from PART 39, E19-E21 from PART 40), and 2 new canonical
helpers re-exported on `window.lblSpec.helpers` alongside the
PART 35 + PART 39 + PART 40 bundles: `materialVariants(family,
opts)` (returns either a single configured MeshStandardMaterial
for a family variant or an object map of every variant in the
family, with optional deterministic color jitter via the
seededRandom helper from PART 40.6.2) and `detailInventory(meta)`
(returns the normalized { identity, secondary, tertiary,
materialZones } shape and is the same function the renderer's
E22 validator uses). No new dependency, no new export path, no
new mandatory userData field, no removed / weakened rule, no change
to PART 38.22's style agnosticism, no change to PART 40's
production-grade pipeline framing.

## Files modified (8)

| File | Change |
|------|--------|
| `Prompt_To_Ts.txt`   | header v1.17 → v1.18; new v1.18 CHANGELOG entry; appended PART 41 (11 sub-sections: 41.0 central principle, 41.1 detail inventory, 41.2 the 5-stage pipeline, 41.3 force higher component count, 41.4 stronger geometry vocabulary, 41.5 silhouette & proportion pass, 41.6 material system upgrade, 41.7 hierarchy & runtime quality, 41.8 the 7 prompt rules, 41.9 renderer-side runtime, 41.10 canonical helpers) |
| `Image_To_Ts.txt`    | header v1.17 → v1.18; new v1.18 CHANGELOG entry; appended PART 41 (same content; image-to-TS analysis protocol from PART 17 feeds 41.1 directly) |
| `Prompt_To_Js.txt`   | header v8.9 → v8.10; new v8.10 CHANGELOG entry; appended PART 41 (same content; references the JSON/JS `meta.minMeshes` + `meta.subjectClass` + `meta.detailInventory` fields as the JSON/JS analog of the TS path) |
| `Image_To_Js.txt`    | header v8.9 → v8.10; new v8.10 CHANGELOG entry; appended PART 41 |
| `Prompt_To_Json.txt` | header v8.9 → v8.10; new v8.10 CHANGELOG entry; appended PART 41 |
| `Image_To_Json.txt`  | header v8.9 → v8.10; new v8.10 CHANGELOG entry; appended PART 41 |
| `index.html`         | `lblSpec.VERSION` bumped to `{ts:'v1.18', json:'v8.10'}`; LBL spec chip text + title updated; meta description + keywords updated; 2 new density-first validators (E22 detail-inventory compliance, E23 minimum-mesh-count target) added to `ANTI_PATTERN_CHECKS`; 2 new canonical helpers (`materialVariants`, `detailInventory`) added to the existing `__threeTriHelpers` bundle re-exported on `window.lblSpec.helpers`; top-of-block comment updated to "RJS UPDATE 3 / 4 / 5 / 6 / 7 / 8 / 9 / 10" |
| `CHANGES_SUMMARY.md` | this round added at the top (this section); prior v1.17 / v8.9 round preserved below |

## Files UNTOUCHED

- `public/models/Model_1.ts` through `Model_5.ts` (still work
  standalone; the new meta fields from 41.1 (`detailInventory`)
  and 41.3.1 (`minMeshes` / `subjectClass`) are ALL optional, so
  existing models don't need any change to load)
- `public/models/manifest.json` (still works as-is)
- `.github/workflows/manifest.yml`
- `public/rig/three-rig-helpers.js`
- `public/rig/src/*.ts`
- `public/rig/build.sh`

## What PART 41 covers (11 sub-sections)

- **41.0**  Central principle — one rule drives the rest:
            PREFER GEOMETRIC DENSITY OVER CODE BREVITY; the 3
            anti-patterns (single-pass generation, overly DRY
            code, no detail inventory before code) are
            diagnosed and replaced with 5-stage + detail-
            inventory + density-first discipline; style-agnostic.
- **41.1**  Detail inventory (before any geometry)
  - 4 categories: identity / secondary / tertiary / material zones
  - Published on `meta.detailInventory`; the factory's
    authoring-time checklist
- **41.2**  The 5-stage pipeline
  - **41.2.1** Stage 1 — Blockout (< 200 tris, < 10 meshes)
  - **41.2.2** Stage 2 — Structure (30-50% of final mesh count)
  - **41.2.3** Stage 3 — Form Density (50-70%)
  - **41.2.4** Stage 4 — Surface Detail (80-100%)
  - **41.2.5** Stage 5 — Materials & Polish (100%)
  - Each stage is INDEPENDENT and ADDS to the previous stage's
    output; a mistake in Stage 4 does NOT require redoing Stage 2
- **41.3**  Force higher component count
  - **41.3.1** Minimum mesh count targets per subject class
              (character 200, vehicle 150, weapon 80, prop 40,
              architecture 100, scene 300)
  - **41.3.2** Required repeated micro-elements (at least 3 of:
              rivet rows, plate layers, damage chips, seam lines,
              strap loops, bolt heads, panel gap shadow boxes)
  - **41.3.3** Prefer many small forms over few large ones
  - **41.3.4** Explicitly ask for "secondary" and "tertiary"
              detail layers
- **41.4**  Stronger geometry vocabulary (6 patterns)
  - **41.4.1** Overlapping boxes for layered armor
  - **41.4.2** Multiple thin cylinders for rings / straps
  - **41.4.3** Small spheres for rivets / bolts (InstancedMesh)
  - **41.4.4** Thin boxes for seams / engravings / scratches
  - **41.4.5** Slightly rotated / offset pieces for organic feel
  - **41.4.6** Multi-layer cloth (cape, cloak, banner)
- **41.5**  Silhouette & proportion pass
  - **41.5.1** Multi-angle readability (6 canonical angles)
  - **41.5.2** Limb thickness and joint hierarchy (enforced at
              the blockout stage, not just at the final stage)
  - **41.5.3** Weight distribution and grounded stance
  - **41.5.4** Prop scale relative to body
- **41.6**  Material system upgrade
  - **41.6.1** 4 default families × 4 variants each = 16 base
              materials (plate, plateDark, plateLight, plateCold;
              cloth, clothDark, clothLight, clothFaded; leather,
              leatherDark, leatherLight, leatherWorn; stone,
              stoneDark, stoneLight, stoneWeathered)
  - **41.6.2** Dedicated secondary materials (M.scratch,
              M.damage, M.engrave) for tertiary detail
  - **41.6.3** Clear metal vs cloth vs leather vs stone
              separation
  - **41.6.4** Optional simple procedural variation via the
              seededRandom helper from PART 40.6.2
- **41.7**  Hierarchy & runtime quality
  - **41.7.1** Named nodes for every major part
  - **41.7.2** Sockets for weapons / attachments (at least 2 of
              the 4 canonical Socket_* attachment points)
  - **41.7.3** Clean parent-child structure (enforced BEFORE
              Stage 5)
  - **41.7.4** Complete `userData.sculptRuntime` (nodes /
              sockets / detailInventory / minMeshes /
              pipelineStage / exportReady)
- **41.8**  The 7 prompt rules (the "I will" half of the
            contract)
  1. "Prefer geometric density over code brevity."
  2. "Every major surface must have at least one layer of
     secondary detail."
  3. "Battle damage, rivets, seams and folds must be real
     geometry, not just color."
  4. "Target minimum 200-400 meshes for a full character."
  5. "Build in clear passes: Blockout → Structure → Density
     → Surface → Polish."
  6. "Never leave large flat surfaces unbroken."
  7. "Use overlapping plates and thickness to create
     readable form."
- **41.9**  Renderer-side runtime contract — adds 2 new
            non-blocking validators to the existing 21:
  - **41.9.1** E22 — Detail inventory compliance (PART 41.1)
  - **41.9.2** E23 — Minimum mesh count target (PART 41.3.1)
  - **41.9.3** E22 / E23 do NOT change load behavior (both
              non-blocking; the model still loads)
- **41.10** Canonical helpers (re-exported on window.lblSpec):
  - `materialVariants(family, opts)` — Appendix A
  - `detailInventory(meta)` — Appendix C

## What PART 41 does NOT introduce

- No new mandatory field on any existing userData namespace
  (the new fields in 41.1 `detailInventory` and 41.3.1
  `minMeshes` / `subjectClass` are ALL optional; the current
  renderer ignores unknown keys safely)
- No new export path (the existing GLB / OBJ / STL / FBX /
  DAE / USDZ / .ts paths are unchanged)
- No new dependency (the new helpers use only Three.js APIs
  that are already imported; no import-map change)
- No new validator that blocks the model from loading
  (E22, E23 are non-blocking, like E1-E21 before them)
- No change to the existing PART 1-40 rules (PART 41
  reinforces them — see the 41.0 + 41.10 cross-references)
- No change to the existing E1-E21 validators (they stay
  exactly as they were in v1.17 / v8.9)
- No change to PART 38.22's style agnosticism (PART 41 is
  also style-agnostic — applies to every subject, every
  style, every path)
- No change to PART 40.2's 4-stage pipeline (PART 41
  promotes it to 5 stages by adding "Surface Detail" as a
  new stage between Form Density and Materials)
- No change to PART 40.6.2's seeded random pattern (PART
  41.6.4 uses the same helper)
- No change to the project's "Low Poly 3D" name

## Quick reference for the renderer build

```js
// In a loaded .ts factory, look up the plate family with all
// 4 variants at once (returns an object map):
const M = lblSpec.helpers.materialVariants('plate');
// M.plate, M.plateDark, M.plateLight, M.plateCold.

// Or look up a single variant directly:
const scratch = lblSpec.helpers.materialVariants('secondary',
  { variant: 'scratch' });
// (M.scratch / M.damage / M.engrave are exposed under the
// 'secondary' family.)

// Or build a single plate material with deterministic color
// jitter so every instance is slightly different:
const rng = lblSpec.helpers.seededRandom(0x1234);
const plateWithNoise = lblSpec.helpers.materialVariants('plate',
  { variant: 'plateDark', noise: 0.4, seed: 0x1234 });

// In a loaded .ts factory, publish the detail inventory
// (the AI generates this BEFORE writing any geometry):
const inventory = lblSpec.helpers.detailInventory({
  detailInventory: {
    identity: ['plasma canister with glowing rune', 'two-pronged claw grip'],
    secondary: ['left pauldron with 3 angled plates', 'chest plate with power core inset'],
    tertiary: ['rivet rows on every pauldron plate (8 per row)', 'seam lines between chest and abdomen'],
    materialZones: ['plate (dark steel) for all armor plates', 'emissive (cyan) for the rune']
  }
});
console.log(inventory.identity.length + inventory.secondary.length +
            inventory.tertiary.length, 'detail items declared');
```

## Related prior rounds (for context)

- **v1.11 / v8.3** — Pre-bundled rig helpers (PART 34)
- **v1.12 / v8.4** — Triangle-first geometry (PART 35)
- **v1.13 / v8.5** — Multi-file drop + Model + Rig pairing (PART 36)
- **v1.14 / v8.6** — Zip bundle support (PART 37)
- **v1.15 / v8.7** — Character pipeline upgrade (PART 38)
- **v1.16 / v8.8** — 3D modeling techniques (PART 39)
- **v1.17 / v8.9** — Better models through better generation (PART 40)
- **v1.18 / v8.10** — High-detail generation (PART 41, this round)

---

# v1.17 / v8.9 — Better models through better generation (PART 40)

The spec now teaches the AI the production-engineering framing of the 8
categories from the maintainer's "System Update Details for Better
TypeScript Low-Poly 3D Models" (2026-08): (1) better prompt & input
handling — a structured brief (Subject + Material + Style + Technical
Constraints), image preprocessing (background removal, contrast,
centering, 256x256 silhouette render), multi-view support (2-4 angles),
and negative prompts as hard constraints ("no thin spikes", "watertight",
"clean topology", "≤ 20k tris"); (2) a multi-stage generation pipeline
— 4 stages (coarse base mesh → geometry refinement → texture / material
→ final cleanup + export) with a clear Stage 2 / Stage 3 boundary so a
mistake in one stage can be fixed without redoing the others; (3) mesh
quality & topology — automatic cleanup (weld duplicate vertices, remove
zero-area triangles, remove unused vertices, remove degenerate edges),
smart low-poly mode with a target triangle budget, feature-preserving
QEM simplification (silhouette / hard-edge / curve / flat weighting),
and a forced watertight / manifold guarantee; (4) structured TypeScript
output — modular factory pattern (every part is a named factory that
takes a shared options object), options-based geometry construction
(a single config object drives all dimensions, colors, curve points,
recoil numbers), a 4-child hierarchy (parts / bones / sockets / meta),
and a `meta` object that carries poly count, style tags, targetTris,
seed, referenceViews, negativePrompts, generationPipeline, and
exportReady; (5) a full PBR texture & material system — baseColor +
normal + roughness + metallic + AO with style-specific texturing (low /
mid / high density), a separate texture-refinement stage, and automatic
UV handling (built-in primitive UVs > planar projection > hand-rolled
box / cylinder unwrap); (6) parametric & procedural techniques — the
factory + options object pattern (same as PART 39.5, restated), seed-
based controlled variation via the new `seededRandom` Mulberry32 helper,
LOD support (3 levels: 10-20k / 5-8k / 1.5-3k vertices via THREE.LOD),
and the "prefer algorithmic geometry over pure black-box AI meshes"
rule; (7) post-processing, validation & feedback — 4 authoring-time
quality metrics (manifold, poly count, symmetry, visual fidelity) + 3
new non-blocking validators (E19 PBR + UV completeness, E20 hard-
constraint compliance / thin spike detector, E21 target triangle
budget) + a mandatory mesh repair pipeline before export (weld →
remove-zero-area → remove-unused → recompute normals → re-validate) +
an optional user-rating feedback loop that records the last rating in
`meta.lastRating`; (8) scene / composition level ideas — consistent
style and density across N objects, hierarchical scene building, and
procedural placement and variation via the seededRandom helper. The
renderer adds 3 new non-blocking validators (E19 PBR + UV completeness,
E20 thin-spike / hard-constraint compliance, E21 target triangle
budget) to the existing 18 (E1-E12 from PART 32, E13-E16 from PART 38,
E17-E18 from PART 39), and 3 new canonical helpers re-exported on
`window.lblSpec.helpers` alongside the PART 35 tris bundle and the
PART 39 curvedPart / validateModel / snapshotToPng bundle:
`pbrMaterial(opts)` (returns a configured MeshStandardMaterial with the
full 5-map PBR texture set), `seededRandom(seed)` (Mulberry32-based
seeded RNG with `next()` / `range()` / `int()` / `pick()` / `bool()`
for deterministic variation), and `triCountSummary(root)` (returns
{ totalTriangles, meshCount, top5, budget } and is the same function
the renderer's E21 validator uses). No new dependency, no new export
path, no new mandatory userData field, no removed / weakened rule, no
change to PART 38.22's style agnosticism, no change to PART 39's
factory + options pattern.

## Files modified (8)

| File | Change |
|------|--------|
| `Prompt_To_Ts.txt`   | header v1.16 → v1.17; new v1.17 CHANGELOG entry; appended PART 40 (11 sub-sections: 40.0 central principle, 40.1 better prompt & input handling, 40.2 multi-stage generation pipeline, 40.3 mesh quality & topology improvements, 40.4 structured TypeScript output improvements, 40.5 texture & material system, 40.6 parametric & procedural techniques, 40.7 post-processing, validation & feedback, 40.8 scene / composition level ideas, 40.9 renderer-side runtime, 40.10 canonical helpers) |
| `Image_To_Ts.txt`    | header v1.16 → v1.17; new v1.17 CHANGELOG entry; appended PART 40 (same content; image-to-TS analysis protocol from PART 17 feeds 40.1 directly) |
| `Prompt_To_Js.txt`   | header v8.8 → v8.9; new v8.9 CHANGELOG entry; appended PART 40 (same content; references the JSON/JS `params` config object as the analog of the TS config object from 40.4.2) |
| `Image_To_Js.txt`    | header v8.8 → v8.9; new v8.9 CHANGELOG entry; appended PART 40 |
| `Prompt_To_Json.txt` | header v8.8 → v8.9; new v8.9 CHANGELOG entry; appended PART 40 |
| `Image_To_Json.txt`  | header v8.8 → v8.9; new v8.9 CHANGELOG entry; appended PART 40 |
| `index.html`         | `lblSpec.VERSION` bumped to `{ts:'v1.17', json:'v8.9'}`; LBL spec chip text + title updated; meta description + keywords updated; 3 new production-grade validators (E19 PBR + UV completeness, E20 thin-spike / hard-constraint compliance, E21 target triangle budget) added to `ANTI_PATTERN_CHECKS`; 3 new canonical helpers (`pbrMaterial`, `seededRandom`, `triCountSummary`) added to the existing `__threeTriHelpers` bundle re-exported on `window.lblSpec.helpers`; top-of-block comment updated to "RJS UPDATE 3 / 4 / 5 / 6 / 7 / 8 / 9" |
| `CHANGES_SUMMARY.md` | this round added at the top (this section); prior v1.16 round preserved below |

## Files UNTOUCHED

- `public/models/Model_1.ts` through `Model_5.ts` (still work
  standalone; the new meta fields from 40.4.4 are ALL optional,
  so existing models don't need any change to load)
- `public/models/manifest.json` (still works as-is)
- `.github/workflows/manifest.yml`
- `public/rig/three-rig-helpers.js`
- `public/rig/src/*.ts`
- `public/rig/build.sh`

## What PART 40 covers (11 sub-sections)

- **40.0**  Central principle — the 8 categories from the source
            doc are 8 facets of a single principle: build a
            production-grade generation pipeline, not a one-shot
            prompt-to-geometry call. PART 40 reinforces PART 39
            (authoring-time framing) as a production-time framing.
            Style-agnostic.
- **40.1**  Better prompt & input handling
  - **40.1.1** Structured prompt format (Subject + Material +
              Style + Technical Constraints)
  - **40.1.2** Image preprocessing (background removal, contrast,
              centering, 256x256 silhouette render for the
              PART 39.4.1 test)
  - **40.1.3** Multi-view image support (2-4 angles: front,
              side, top, 3/4)
  - **40.1.4** Negative prompts and hard constraints ("no thin
              spikes", "watertight", "clean topology", "≤ 20k
              tris")
- **40.2**  Multi-stage generation pipeline
  - **40.2.1** Stage 1 — Coarse base mesh (silhouette +
              proportions, < 200 tris)
  - **40.2.2** Stage 2 — Geometry refinement (edge bevels,
              curved parts, InstancedMesh, merged one-offs)
  - **40.2.3** Stage 3 — Texture / material generation (full
              PBR set, style-specific texturing)
  - **40.2.4** Stage 4 — Final cleanup + export (mesh repair
              pipeline runs BEFORE export, not after)
- **40.3**  Mesh quality & topology improvements
  - **40.3.1** Automatic mesh cleanup (weld duplicate vertices,
              remove zero-area triangles, remove unused vertices,
              remove degenerate edges)
  - **40.3.2** Smart low-poly mode with target triangle budgets
              (`meta.targetTris` enforced by E21 at runtime)
  - **40.3.3** Feature-preserving simplification (QEM with
              silhouette / hard-edge / curve / flat weighting)
  - **40.3.4** Force watertight / manifold meshes
- **40.4**  Structured TypeScript output improvements
  - **40.4.1** Modular factory pattern (every part is a named
              factory that takes a shared options object)
  - **40.4.2** Parametric / options-based geometry (a single
              config object drives all dimensions, colors, curve
              points, recoil numbers)
  - **40.4.3** Better hierarchy (4 named children: parts /
              bones / sockets / meta)
  - **40.4.4** Metadata (poly count, style tags, targetTris,
              seed, referenceViews, negativePrompts,
              generationPipeline, exportReady — all OPTIONAL)
- **40.5**  Texture & material system
  - **40.5.1** Full PBR texture sets (baseColor + normal +
              roughness + metallic + AO)
  - **40.5.2** Style-specific texturing (low / mid / high
              density, exempt rules for low-density)
  - **40.5.3** Separate texture refinement / re-texturing stage
              (a change to textures does NOT require redoing
              geometry)
  - **40.5.4** Automatic UV handling (built-in primitive UVs >
              planar projection > hand-rolled unwrap)
- **40.6**  Parametric & procedural techniques
  - **40.6.1** Factory + options object (same as PART 39.5)
  - **40.6.2** Seed-based controlled variation (via the new
              `seededRandom` Mulberry32 helper)
  - **40.6.3** LOD support (3 levels: 10-20k / 5-8k / 1.5-3k
              vertices via THREE.LOD)
  - **40.6.4** Prefer algorithmic geometry (1 factory +
              1 InstancedMesh of N instances, not N individual
              meshes)
- **40.7**  Post-processing, validation & feedback
  - **40.7.1** Quality metrics (manifold, poly count, symmetry,
              visual fidelity)
  - **40.7.2** Renderer-side runtime validators (E19 PBR + UV
              completeness, E20 thin-spike / hard-constraint
              compliance, E21 target triangle budget — all
              non-blocking)
  - **40.7.3** Mesh repair pipeline before export (weld →
              remove-zero-area → remove-unused → recompute
              normals → re-validate; mandatory)
  - **40.7.4** Optional user rating feedback loop into prompt
              defaults (`meta.lastRating` is the hook)
- **40.8**  Scene / composition level ideas (optional expansion)
  - **40.8.1** Consistent style and density across N objects
  - **40.8.2** Hierarchical scene building (Scene > Terrain >
              Buildings > Props > Lighting)
  - **40.8.3** Procedural placement and variation (via the
              seededRandom helper, scene-level seed)
- **40.9**  Renderer-side runtime contract — adds 3 new
            non-blocking validators to the existing 18:
  - **40.9.1** E19 — PBR + UV completeness (PART 40.5.1 /
              40.5.4)
  - **40.9.2** E20 — Thin-spike / hard-constraint compliance
              (PART 40.1.4 / 40.3.4)
  - **40.9.3** E21 — Target triangle budget (PART 40.3.2)
  - **40.9.4** E19 / E20 / E21 do NOT change load behavior
              (all non-blocking; the model still loads)
- **40.10** Canonical helpers (re-exported on window.lblSpec):
  - `pbrMaterial(opts)` — Appendix A
  - `seededRandom(seed)` — Appendix B
  - `triCountSummary(root)` — Appendix C

## What PART 40 does NOT introduce

- No new mandatory field on any existing userData namespace
  (the new fields in 40.4.4 — `targetTris`, `seed`,
  `referenceViews`, `negativePrompts`, `generationPipeline`,
  `exportReady`, `textureDensity`, `sceneStyle`, `lastRating`
  — are ALL optional; the current renderer ignores unknown
  keys safely)
- No new export path (the existing GLB / OBJ / STL / FBX /
  DAE / USDZ / .ts paths are unchanged)
- No new dependency (the new helpers use only Three.js APIs
  that are already imported; no import-map change)
- No new validator that blocks the model from loading
  (E19, E20, E21 are non-blocking, like E1-E18 before them)
- No change to the existing PART 1-39 rules (PART 40
  reinforces them — see the 40.0 + 40.10 cross-references)
- No change to the existing E1-E18 validators (they stay
  exactly as they were in v1.16 / v8.8)
- No change to PART 38.22's style agnosticism (PART 40 is
  also style-agnostic — applies to every subject, every
  style, every path)
- No change to PART 39.5's factory + options pattern
  (PART 40 reinforces it as 40.4.1 + 40.4.2 + 40.6.1)
- No change to the project's "Low Poly 3D" name

## Quick reference for the renderer build

```js
// In a loaded .ts factory, build a PBR material with the full
// 5-map texture set:
const m = window.lblSpec.helpers.pbrMaterial({
  baseColor: 0x886644,
  normalMap: normalTexInstance,
  roughnessMap: roughTexInstance,
  metalnessMap: metalTexInstance,
  aoMap: aoTexInstance,
  roughness: 0.7,
  metalness: 0.0
});

// In a loaded .ts factory, get a seeded RNG for procedural
// variation that reproduces on reload:
const rng = window.lblSpec.helpers.seededRandom(0xA1B2C3D4);
const magCurve = 0.15 + rng.range(0.0, 0.20);
const variantPick = rng.pick(['short', 'medium', 'long']);

// In a loaded .ts factory (or via the inspector), get a quick
// triangle count summary and the E21 budget check:
const s = window.lblSpec.helpers.triCountSummary(root);
console.log(s.totalTriangles, 'tris,', s.meshCount, 'meshes');
if(s.budget && !s.budget.ok) {
  console.warn('Over targetTris budget:', s.budget);
}
```

## Related prior rounds (for context)

- **v1.11 / v8.3** — Pre-bundled rig helpers (PART 34)
- **v1.12 / v8.4** — Triangle-first geometry (PART 35)
- **v1.13 / v8.5** — Multi-file drop + Model + Rig pairing (PART 36)
- **v1.14 / v8.6** — Zip bundle support (PART 37)
- **v1.15 / v8.7** — Character pipeline upgrade (PART 38)
- **v1.16 / v8.8** — 3D modeling techniques (PART 39, prev round)
- **v1.17 / v8.9** — Better models through better generation
  (PART 40, this round)

---

# v1.16 / v8.8 — 3D modeling techniques (PART 39)

The spec now teaches the AI the six practical disciplines from the
maintainer's "3D MODELING TECHNIQUES — practical guide for reducing
bugs and making better models": (1) catch dumb stuff early — ban
the `// ----...---const X` silent-comment pattern, and bake a
`validate*Model()` boot-time bbox-overlap / mesh-count / size-sanity
walker into every factory; (2) build a visual dev loop — runtime
knobs (Tweakpane), `renderer.info` logs, on-demand PNG snapshots;
(3) use the right geometry primitive — ExtrudeGeometry-along-
CatmullRomCurve3 for curved surfaces, LatheGeometry for round
profiles, computed BufferGeometry for smooth blends, InstancedMesh
for repeated detail, never stacked rotated boxes to fake a curve;
(4) proportions and recognition — the silhouette test (256×256
black-on-white), reference-first, the "is it cheating" check;
(5) procedural / parametric modeling — a part library
(barrel / taperedBox / curvedMag / woodBlock) and a single config
object driving all dimensions, colors, curve points, recoil
numbers; (6) the three things that help right now. The renderer
adds 2 new non-blocking validators (E17 boot-time bbox-overlap gap
detector, E18 draw-call / mesh-count sanity) to the existing 16
(E1-E12 from PART 32, E13-E16 from PART 38), and 3 new canonical
helpers re-exported on `window.lblSpec.helpers` alongside the PART
35 tris bundle: `curvedPart(curve, crossW, crossD, mat, opts)`,
`validateModel(root, opts)`, and `snapshotToPng(renderer, scene,
camera, fileName)`. No new dependency, no new export path, no new
mandatory userData field, no removed / weakened rule, no change to
PART 38.22's style agnosticism.

## Files modified (8)

| File | Change |
|------|--------|
| `Prompt_To_Ts.txt`   | header v1.15 → v1.16; new v1.16 CHANGELOG entry; appended PART 39 (8 sub-sections: 39.0 central principle, 39.1 catch dumb stuff early, 39.2 visual dev loop, 39.3 right geometry primitive, 39.4 proportions & recognition, 39.5 procedural / parametric modeling, 39.6 the three things that help right now, 39.7 renderer-side runtime, 39.8 canonical helpers) |
| `Image_To_Ts.txt`    | header v1.15 → v1.16; new v1.16 CHANGELOG entry; appended PART 39 (same content; image-to-TS analysis protocol feeds 39.4) |
| `Prompt_To_Js.txt`   | header v8.7 → v8.8; new v8.8 CHANGELOG entry; appended PART 39 (same content; references the `params` config object on the blueprint root as the JSON/JS analog of the TS config object from 39.5) |
| `Image_To_Js.txt`    | header v8.7 → v8.8; new v8.8 CHANGELOG entry; appended PART 39 |
| `Prompt_To_Json.txt` | header v8.7 → v8.8; new v8.8 CHANGELOG entry; appended PART 39 |
| `Image_To_Json.txt`  | header v8.7 → v8.8; new v8.8 CHANGELOG entry; appended PART 39 |
| `index.html`         | `lblSpec.VERSION` bumped to `{ts:'v1.16', json:'v8.8'}`; LBL spec chip text + title updated; meta description + keywords updated; 2 new modeling-techniques validators (E17 bbox-overlap gap, E18 mesh-count / InstancedMesh) added to `ANTI_PATTERN_CHECKS`; 3 new canonical helpers (`curvedPart`, `validateModel`, `snapshotToPng`) added to the existing `__threeTriHelpers` bundle re-exported on `window.lblSpec.helpers`; top-of-block comment updated to "RJS UPDATE 3 / 4 / 5 / 6 / 7 / 8" |
| `CHANGES_SUMMARY.md` | this round added at the top (this section); prior v1.15 round preserved below |

## Files UNTOUCHED

- `public/models/Model_1.ts` through `Model_5.ts` (still work
  standalone, including Model_1.ts which is a character subject
  and is the prime candidate for the optional PART 38 upgrade
  plus the new PART 39 boot-time validator hook)
- `public/models/manifest.json` (still works as-is)
- `.github/workflows/manifest.yml`
- `public/rig/three-rig-helpers.js`
- `public/rig/src/*.ts`
- `public/rig/build.sh`

## What PART 39 covers (8 sub-sections + 3 appendices)

- **39.0**  Central principle — three disciplines drive the rest
            of PART 39: catch dumb stuff early, build a visual
            dev loop, use the right geometry primitive
- **39.1**  Catch dumb stuff early
  - **39.1.1** Ban the "comment eats code" pattern (BAD/GOOD
              examples reproduced verbatim from the maintainer's
              guide)
  - **39.1.2** Bake a `validate*Model()` function into every
              .ts factory (gaps > 0.02, mesh count > 500, X
              size 0.5-20)
- **39.2**  Build a visual dev loop
  - **39.2.1** Runtime knobs (Tweakpane / Leva / dat.gui)
  - **39.2.2** Log `WebGLRenderer.info` for sanity
  - **39.2.3** Snapshot a frame to PNG on demand
- **39.3**  Use the right geometry primitive — 4-row
            intent-to-primitive table (ExtrudeGeometry along
            CatmullRomCurve3 / LatheGeometry / computed
            BufferGeometry / InstancedMesh) + the
            "if you find yourself writing a for loop to make
            N copies, STOP" rule of thumb
- **39.4**  Proportions & recognition
  - **39.4.1** The silhouette test (256×256 black-on-white)
  - **39.4.2** Reference first (real-world ratios)
  - **39.4.3** The "is it cheating" check
- **39.5**  Procedural / parametric modeling
  - **39.5.1** Part library (barrel / taperedBox / curvedMag /
              woodBlock)
  - **39.5.2** Drive everything from a config object
              (AKM_CONFIG, RPK_CONFIG, SVD_CONFIG from one
              interface)
- **39.6**  The three things that help right now — snapshot to
            PNG on every save, run a bbox-overlap validator at
            boot, stop stacking boxes to fake curves
- **39.7**  Renderer-side runtime contract — adds 2 new
            non-blocking validators to the existing 16:
  - **39.7.1** E17 — boot-time bbox-overlap gap detector
  - **39.7.2** E18 — draw-call / mesh-count sanity
  - **39.7.3** E17 / E18 do NOT change load behavior (both
              non-blocking; the model still loads)
- **39.8**  Canonical helpers (re-exported on window.lblSpec):
  - `curvedPart(curve, crossW, crossD, mat, opts)` — Appendix A
  - `validateModel(root, opts)` — Appendix C
  - `snapshotToPng(renderer, scene, camera, fileName)` —
    Appendix A

## What PART 39 does NOT introduce

- No new mandatory field on any existing userData namespace
- No new export path (existing GLB / OBJ / STL / FBX / DAE /
  USDZ / .ts paths unchanged)
- No new dependency (Tweakpane is the AI's authoring-time
  choice and is not required at runtime; the new helpers use
  only Three.js APIs that are already imported)
- No new validator that blocks the model from loading (E17
  and E18 are non-blocking, like E1-E16 before them)
- No change to the existing PART 1-38 rules (PART 39
  reinforces them — see the 39.0 cross-references)
- No change to the existing E1-E16 validators (they stay
  exactly as they were in v1.15 / v8.7)
- No change to PART 38.22's style agnosticism (PART 39 is
  also style-agnostic — applies to every subject, every
  style, every path)
- No change to the project's "Low Poly 3D" name

## Quick reference for the renderer build

```js
// In the loaded .ts factory, after the create*Model() body:
import { validateModel } from 'three';      // or your own path
const v = window.lblSpec.helpers.validateModel(root, { maxGap: 0.02 });
if(!v.ok) console.warn('[create*Model]', v.errors);

// Or, in a click handler / debug button:
window.lblSpec.helpers.snapshotToPng(renderer, scene, camera, 'frame.png');

// Or, for a curved part:
const curve = new THREE.CatmullRomCurve3([/* ... */]);
const mag = window.lblSpec.helpers.curvedPart(
  curve, 0.082, 0.055, M.bakelite, { steps: 80, bevel: true }
);
```

## Related prior rounds (for context)

- **v1.11 / v8.3** — Pre-bundled rig helpers (PART 34)
- **v1.12 / v8.4** — Triangle-first geometry (PART 35)
- **v1.13 / v8.5** — Multi-file drop + Model + Rig pairing (PART 36)
- **v1.14 / v8.6** — Zip bundle support (PART 37)
- **v1.15 / v8.7** — Character pipeline upgrade (PART 38, prev round)
- **v1.16 / v8.8** — 3D modeling techniques (PART 39, this round)

---

# v1.15 / v8.7 — Character pipeline upgrade (PART 38) + style agnosticism (PART 38.22)

The character output path is upgraded from primitive-assembly to a
continuous-topology + deformation-aware + GLB-first pipeline. The
spec now teaches the AI the principles from the maintainer's
"3D CHARACTER GENERATION SYSTEM UPGRADE GUIDE": more polygons do
not automatically create a better model; professional quality comes
from continuous topology, deliberate edge loops, fitted clothing,
real skeletal skinning, baked animation, GLB export, and multi-view
validation. The renderer adds 4 new non-blocking validators (E13
vertex budget, E14 NaN / infinite positions, E15 topology cleanup,
E16 bounding-box proportions) to the existing 12 (E1-E12) from
PART 32 / PART 65. No new dependency, no new export path, no new
mandatory userData field, no change to PART 30's pivot hierarchy
(which remains valid for non-character subjects and for jointed-only
character poses).

## Files modified (8)

| File | Change |
|------|--------|
| `Prompt_To_Ts.txt`   | header v1.14 → v1.15; new v1.15 CHANGELOG entry; appended PART 38 (21 sub-sections) |
| `Image_To_Ts.txt`    | header v1.14 → v1.15; new v1.15 CHANGELOG entry; appended PART 38 |
| `Prompt_To_Js.txt`   | header v8.6 → v8.7; new v8.7 CHANGELOG entry; appended PART 38 |
| `Image_To_Js.txt`    | header v8.6 → v8.7; new v8.7 CHANGELOG entry; appended PART 38 |
| `Prompt_To_Json.txt` | header v8.6 → v8.7; new v8.7 CHANGELOG entry; appended PART 38 |
| `Image_To_Json.txt`  | header v8.6 → v8.7; new v8.7 CHANGELOG entry; appended PART 38 |
| `index.html`         | `lblSpec.VERSION` bumped to `{ts:'v1.15', json:'v8.7'}`; LBL spec chip text + title updated; meta description + keywords updated; 4 new character-pipeline validators (E13-E16) added to `ANTI_PATTERN_CHECKS`; top-of-block comment updated to "RJS UPDATE 3 / 4 / 5 / 6 / 7" |
| `CHANGES_SUMMARY.md` | this round added at the top (this section); prior v1.14 round preserved below |

## Files UNTOUCHED

- `public/models/Model_1.ts` through `Model_5.ts` (still work
  standalone, including Model_1.ts which is a character subject and
  is the prime candidate for the optional PART 38 upgrade)
- `public/models/manifest.json` (still works as-is)
- `.github/workflows/manifest.yml`
- `public/rig/three-rig-helpers.js`
- `public/rig/src/*.ts`
- `public/rig/build.sh`

## What the new PART 38 covers (21 sub-sections)

- **38.0**  Central principle — "more polygons do not automatically
            create a better model"
- **38.1**  Diagnosis of the primitive-assembly approach (10 symptoms)
- **38.2**  When PART 38 applies (character / mascot / creature /
            humanoid subjects only) and when it does not
- **38.3**  Two-layer architecture (asset-authoring + viewer-integration)
- **38.4**  14-stage production pipeline + 7 quality gates
- **38.5**  Character specification schema (9 fields: identity /
            proportions / silhouette / face / costume / palette / rig /
            animation / budget)
- **38.6**  4 continuous-mesh-generation approaches (parametric /
            lofted / implicit / hybrid — hybrid is the default for
            this renderer)
- **38.7**  Topology techniques + edge-loop locations (face, shoulders,
            elbows, hips, knees, wrists, ankles) + 10 cleanup operations
- **38.8**  Polygon + vertex budgeting (6-category allocation table +
            ~12-18k vertex target + PART 35 50k soft cap reminder)
- **38.9**  Facial modeling system (10 steps + goblin identity features)
- **38.10** Clothing, armor, and props (7 garment techniques + 7
            material category profiles + 4 canonical socket names)
- **38.11** UVs and textures (minimum set: albedo, roughness, normal,
            optional metallic, optional emissive)
- **38.12** Real skeletal rigging (REQUIRED + optional bone hierarchy,
            skinIndex / skinWeight, normalized weights, corrective
            shape keys; PART 34's three-rig-helpers is re-confirmed as
            the ONE sanctioned skeleton source)
- **38.13** Animation techniques (idle / walk / attack / hit minimum
            set + extras; 8 animation quality checks)
- **38.14** GLB-first architecture (TypeScript file becomes the
            viewer adapter; 9-step adapter contract)
- **38.15** Tooling options (3 paths: Blender-assisted / Procedural
            / Hybrid — Hybrid is the recommended default)
- **38.16** Validation system (4 new character-specific validators
            E13-E16; existing E1-E12 are unchanged)
- **38.17** Multi-view and silhouette review (13 required angles + 9
            landmark comparisons against the spec)
- **38.18** LOD and performance (3 LOD levels: 10-20k / 5-8k /
            1.5-3k vertices; rig preserved across LODs)
- **38.19** Implementation roadmap (9 phases)
- **38.20** Priority order (top 10 — start with continuous head/torso
            topology, not more decorative primitives)
- **38.21** Final design principle (the 9-item quality bar)
- **38.22** **Style agnosticism** — the system is NOT limited to low-poly.
            The project is named "Low Poly 3D" and the v1.0 → v8.6 history
            favored low-poly, but the renderer and the spec support ANY
            3D model style: low-poly, mid-poly, high-poly, smooth-shaded,
            stylized, photoreal, voxel, hand-painted, toon / cel,
            retro-PSX, or any combination. Low-poly is the DEFAULT for
            short prompts because the project is named for it, NOT
            because the system rejects other styles. PART 38.22 makes
            this explicit so the AI does not self-limit when the user
            asks for something that is not low-poly. See the dedicated
            "Style agnosticism" section below.

## What PART 38 does NOT introduce

- No new mandatory field on any existing userData namespace
- No new export path (PART 1.2 still governs; PART 1.3's optional
  look-dev lights factory still governs)
- No change to the existing PART 30 pivot hierarchy (remains valid
  for non-character subjects per PART 38.2 and for jointed-only
  character poses when the AI elects not to use a real SkinnedMesh)
- No change to PART 34 (three-rig-helpers) — E11 marker remains
  in force
- No change to the renderer's existing E1-E12 validators (E13-E16
  are additive, not replacements)
- No change to GLB / OBJ / STL / FBX / DAE loaders
- No change to the editor paste path
- No change to the file-picker UI
- No change to the scene tree or the Rig / Tris / Sockets buttons
- No new dependency (no new import-map entry)
- No change to the bundle format from PART 37
- No change to the multi-file drop from PART 36

PART 38 layers on top of — never replaces — PARTs 1-37 (TS) and
PARTs 1-66 (JSON/JS). The v1.14 / v8.6 round's content (zip bundle
support, PART 37) is preserved below for cross-reference.

## Renderer-side changes (index.html)

- `lblSpec.VERSION = { ts: 'v1.15', json: 'v8.7' }` (was v1.14 / v8.6)
- `lbl-spec-chip` text: `LBL: v1.15 / v8.7` (was `LBL: v1.14 / v8.6`)
- `lbl-spec-chip` title attribute: now mentions the 4 new E13-E16
  character-pipeline validators alongside the existing E1-E12
- `meta name="description"`: now mentions "16 hard anti-pattern
  guards (incl. 4 new character-pipeline validators E13-E16)"
  (was "10 hard anti-pattern guards")
- `meta name="keywords"`: now includes "character pipeline,
  skeletal skinning" (was "LBL v1.14, LBL v8.6")
- Top-of-block comment: now says "RJS UPDATE 3 / 4 / 5 / 6 / 7"
  (was "RJS UPDATE 3 / 4 / 5 / 6")
- 4 new validators added to `ANTI_PATTERN_CHECKS`:
  - **E13** Vertex budget (PART 38.13): if the model declares
        `meta.vertexBudget` (and optionally `vertexBudgetTolerance`
        and `meta.subjectClass === 'character'`), the actual
        vertex count should not exceed budget × (1 + tolerance).
        Default tolerance is 20% for non-character subjects,
        10% for character subjects (stricter).
  - **E14** NaN / infinite positions (PART 38.16): walks every
        position attribute and flags non-finite coordinates.
        A character model with NaN positions will not deform
        cleanly and will produce black holes in the render.
  - **E15** Topology cleanup (PART 38.7): counts zero-area
        triangles (cross product of two edge vectors < 1e-6)
        and surfaces a warning if any are present. True
        non-manifold detection requires topology rebuild; this
        is a best-effort heuristic.
  - **E16** Bounding-box proportions (PART 38.16): if the model
        declares `meta.expectedProportions = { height, width,
        depth }`, the actual H:W and D:W ratios should match
        the declared ratios within ±15%. Useful for catching
        models where a leg is twice the height of the body.

All 4 new validators are non-blocking warnings (the model still
loads, the user just sees a toast + a red spec chip). They mirror
the E1-E12 pattern from PART 32 / PART 65 and integrate into the
existing `validate()` / `applyToUI()` / `revalidate()` pipeline
without any caller-side changes.

## Verification

- `node --check` on the extracted `index.html` module script → OK
- All 6 spec files have a v1.15 / v8.7 (TS) or v8.7 (JSON/JS)
  CHANGELOG entry at the top AND a complete PART 38 appended
  at the end with the closing `END OF PART 38` marker
- `lblSpec.VERSION` reads from a single source-of-truth constant;
  every check below the VERSION line uses the same value
- All PART 38 references preserve the existing PART 1-37
  (TS) and PART 1-66 (JSON/JS) content unchanged — verified
  by line-count diff of each file before vs after the change
  (the only added lines are the new CHANGELOG entry, the new
  header version, and the appended PART 38)

## Style agnosticism — the system is NOT limited to low-poly

The maintainer confirmed: the project is named "Low Poly 3D" but
the system does NOT limit output to low-poly. PART 38.22 makes
this explicit in every spec file, and the AI system prompt in
each spec file was rewritten to:

  - Reframe the task from "You generate ... for a low-poly 3D
    model viewer" to "You generate ... for the Low Poly 3D 3D
    model viewer (the project is named 'Low Poly 3D' but the
    renderer and this spec support ANY 3D model style)".
  - Reframe the AI's mindset from "Think like a low-poly
    artist" to "Think like a 3D artist first, a [TS / JS / JSON
    author] second". The same principles (silhouette, secondary
    forms, action-readiness, surface detail) apply to every
    style, not just low-poly.
  - Add a 3-step style detection rule: (1) explicit style
    keyword in the prompt, (2) reference image style, (3)
    default to low-poly. The AI does not over-correct toward
    the project name when the user asks for something else.
  - List 13 supported styles explicitly: low-poly, mid-poly,
    high-poly, smooth-shaded, stylized, photoreal, voxel,
    hand-painted, toon / cel, retro-PSX, hologram, wireframe,
    and any combination.

The renderer (index.html) was also updated:

  - Page `<title>`: "Low Poly 3D — AI Low-Poly Scene Builder"
    → "Low Poly 3D — AI 3D Scene Builder (any style)". The
    project name "Low Poly 3D" stays as a brand, but the
    description now reflects the actual system scope.
  - Meta description: now lists all 12 supported styles
    (low-poly, mid-poly, high-poly, smooth-shaded, stylized,
    photoreal, voxel, hand-painted, toon / cel, retro-PSX,
    or any combination) instead of just "low-poly".
  - Open Graph and Twitter Card descriptions: same update.
  - JSON-LD structured data `description`: same update.
  - Meta keywords: added "mid poly, high poly, smooth shaded,
    stylized, photoreal, voxel, hand painted, toon shading,
    cel shading, retro PSX" alongside the existing
    "low poly 3D".
  - LBL spec chip `title` attribute: now mentions that the
    renderer supports any 3D model style and points to
    PART 38.22 in the spec.

The project name "Low Poly 3D" is preserved throughout (it's
the brand / product name). What changed is the IMPLICATION that
the system is limited to low-poly — that implication is removed
from the spec, the AI system prompt, the meta description, and
the chip title.

## Related prior rounds (for context)

- **v1.11 / v8.3** — Pre-bundled rig helpers (PART 34)
- **v1.12 / v8.4** — Triangle-first geometry (PART 35)
- **v1.13 / v8.5** — Multi-file drop + Model + Rig pairing (PART 36)
- **v1.14 / v8.6** — Zip bundle support (PART 37)

# v1.14 / v8.6 — Zip bundle support (PART 37) (PRESERVED BELOW)

The renderer now accepts a `.zip` file (drop, file-picker, drag, or
demo/model-store URL) as a "bundle" of model + rig + any other files.
The bundle is extracted in-memory (no disk write, no native bridge),
filtered for junk files (`__MACOSX/.*`, dotfiles, directory markers),
and every entry is routed through the same `lblRouteFiles` dispatcher
from PART 36 — model.ts loads, rig.ts attaches, extra GLBs append in
a row, images texture, READMEs surface as non-blocking toast. The
raw zip bytes are preserved so the "Download Model Code" button
re-serves the exact same archive the user originally loaded.

This is the third round on the `fix/multi-file-drop` branch, after
v1.13 / v8.5 (PART 36 multi-file drop + model + rig pairing).

## Files modified (8)

| File | Change |
|------|--------|
| `Prompt_To_Ts.txt`   | header v1.13 → v1.14; new v1.14 CHANGELOG entry; appended PART 37 |
| `Image_To_Ts.txt`    | header v1.13 → v1.14; new v1.14 CHANGELOG entry; appended PART 37 |
| `Prompt_To_Js.txt`   | header v8.5 → v8.6; new v8.6 intro-note entry; appended PART 37 |
| `Image_To_Js.txt`    | header v8.5 → v8.6; new v8.6 intro-note entry; appended PART 37 |
| `Prompt_To_Json.txt` | header v8.5 → v8.6; new v8.6 intro-note entry; appended PART 37 |
| `Image_To_Json.txt`  | header v8.5 → v8.6; new v8.6 intro-note entry; appended PART 37 |
| `index.html`         | added `fflate@0.8.2` to the import map (~10KB minified, MIT, ESM, no deps); `.zip` added to the `accept` attribute of all 4 file inputs; new `'zip'` bucket in `__lblClassifyFile`; new `__lblExtractZip(file)` + `__lblLooksLikeZip(bytes)` + `__lblFetchBytes(url)` helpers; `lblRouteFiles` + `lblRouteDroppedFile` extract zips and recurse on the resulting FileList; `lblModelStorePopulateFromManifest` accepts `.zip` entries; `lblModelStoreLoadByNumber` detects zip responses (PK\x03\x04 magic + extension) and extracts them; `lblSetDemoSource` + `lblDownloadDemoSource` re-serve the original zip bytes verbatim via a new `lblLastDemoSource.bytes` field; dropzone sub-text advertises the new feature; `lblSpec.VERSION` bumped to `{ts:'v1.14', json:'v8.6'}`; `LBL:` chip in topbar; meta description / keywords |
| `CHANGES_SUMMARY.md` | this file — documents all 3 rounds on the branch (v1.11/v8.3, v1.12/v8.4, v1.13/v8.5, v1.14/v8.6) for cross-reference |

## Files UNTOUCHED

- `public/models/Model_1.ts` through `Model_5.ts` (still work
  standalone)
- `public/models/manifest.json` (still works as-is; can be extended
  with `"file": "Model_1.zip"` entries to opt into the new bundle
  format — but the legacy probe also discovers `Model_1.zip` files
  automatically when the manifest isn't using them)
- `.github/workflows/manifest.yml`
- `public/rig/three-rig-helpers.js`
- `public/rig/src/*.ts`

## What the new PART 37 covers (6 subsections)

- **37.1** Executive overview — the conventional bundle shape
  (`model.ts` + optional `rig.ts` + any extras)
- **37.2** Drop, file-picker, and drag-and-drop behavior — the
  full extraction → routing pipeline diagram; multi-zip sequencing
- **37.3** Demo / model-store behavior — manifest accepts `.zip`,
  legacy probe tries `.zip`, "Download Model Code" re-serves bytes
- **37.4** What bundle files must NOT do — no relative imports
  between files in the same zip (import map doesn't know about
  zip-internal paths)
- **37.5** Backwards compatibility — every existing workflow
  preserved, the new behavior is purely additive
- **37.6** Pre-emission checklist — 2 voluntary mental-checklist
  items for AI authors shipping a bundle

## Resolved contradictions

1. **What does "bundle" mean vs "demo"?** The demo system already
   served individual files via URLs (`public/models/Model_N.ts`).
   PART 37 extends that with `public/models/Model_N.zip` as an
   alternative. The two coexist — if both `Model_1.ts` and
   `Model_1.zip` exist, the legacy probe prefers `.ts` (so the
   source editor flow still works); to FORCE zip mode, list the
   `.zip` in the manifest.

2. **What about relative imports inside a zip?** The TS pipeline
   rewrites imports through the import map, which only knows about
   the 5 (now 6) pinned bare specifiers (`three`, `three/addons/`,
   `three-mesh-bvh`, `three-bvh-csg`, `three-rig-helpers`, `fflate`).
   A relative import like `import { foo } from './helpers'` inside
   a bundle would fail because the file `helpers.ts` is also inside
   the zip and not in the import map. PART 37.4 documents this
   and suggests the two workarounds (inline the helpers, or build
   a single concatenated `.ts` at deploy time).

3. **What's the new dep?** fflate@0.8.2, ~10KB minified, MIT,
   loaded as an ESM module from the import map. No native bridge,
   no Worker, no extra round-trip. fflate is one of the most-used
   in-browser zip libraries; it has a 5+ year track record and
   handles STORED + DEFLATE (the two common methods) plus a few
   edge cases (bzip2, lzma) that we don't need.

## Verification

- `node --check` on the extracted `index.html` module script → OK
- End-to-end zip pipeline test (`ziptest.mjs`):
  - Build a 1585-byte zip with model.ts + rig.ts + README.md +
    2 junk files (`__MACOSX/._model.ts` and `.DS_Store`)
  - `__lblLooksLikeZip` correctly returns true for the zip and
    false for the text + empty-buffer edge cases
  - `__lblExtractZip` correctly extracts 3 files and skips the
    2 junk files
  - The extracted `model.ts` is recognized as a real
    `createCubeCharacter` factory
  - The extracted `rig.ts` would be TS-compiled + detected as a
    3-joint RigGraph (the rig shape is verified separately via
    the v1.13 test, which runs against the actual
    `three-rig-helpers` bundle)
- The page's import map has 6 entries (was 5); the `fflate` entry
  resolves to `https://unpkg.com/fflate@0.8.2/esm/browser.js`
  (HTTP 200, content-type `text/javascript`)
- The `LBL: v1.14 / v8.6` chip in the topbar matches the
  `window.lblSpec.VERSION` constant in `index.html`
- All 6 `.txt` spec files preserve their line counts modulo the
  +14 KB PART 37 append + the new ~1.5 KB CHANGELOG entry

## Branch state — 3 commits ahead of `main`

```
0b3f4a2 docs: bump spec to v1.14 / v8.6 — PART 37 zip bundle support
20dcc6a docs: bump spec to v1.13 / v8.5 — PART 36 multi-file drop + model + rig
d0f2912 feat: support model + rig two-file drop (RJS LBL update)
e7a30ce feat: support dropping / picking many files at once (RJS LBL update)
9d9278a (origin/main) Add files via upload
```

## How to use the new feature

### Drop a zip in the page

1. Build a zip with your favorite tool. Conventional layout:
   ```
   Model_1.zip
   ├── model.ts        (the factory)
   ├── rig.ts          (optional — any of the 4 PART 36 shapes)
   └── extras...       (optional — GLB, image, README, anything)
   ```
2. Drop it on the dropzone (or pick it via the file picker).
3. The renderer extracts, lists the files in a toast, then
   processes them as if you'd dropped them individually.

### Add a zip to the demo system

1. Place `public/models/Model_6.zip` (or any free Model_N).
2. Either:
   - Add it to `public/models/manifest.json`:
     `{ "id": "Model_6", "file": "Model_6.zip" }`
   - Or just let the legacy probe discover it automatically
     (tries `.ts`, `.js`, `.json`, `.zip` for each Model_N).
3. Reload the page; the demo store now lists 6 models. Click
   Model_6 → it fetches the zip, extracts, loads. "Download
   Model Code" re-serves the original zip.

## Related prior rounds (for context)

- **v1.11 / v8.3** — Pre-bundled rig helpers (PART 34)
- **v1.12 / v8.4** — Triangle-first geometry (PART 35)
- **v1.13 / v8.5** — Multi-file drop + Model + Rig pairing (PART 36)
- **v1.14 / v8.6** — Zip bundle support (PART 37, this round)
- **v1.15 / v8.7** — Character pipeline upgrade (PART 38) — see the round above
- **v1.16 / v8.8** — 3D modeling techniques (PART 39) — see the round at the very top of this file



# v1.23 / v8.15 — geometry + VFX + lookdev OPT-IN capability bundle (PART 68-71)

The spec now teaches the AI an OPT-IN capability bundle from
the maintainer's "two-repo analysis" working notebook (compiled
2026-09-05), which catalogues the architecture-level patterns
from two external reference repos
(jasonsturges/three-low-poly and
achrefelouafi/LinearAbilityExtThreeJS) and translates them into
the existing `lblSpec` / Three.js contract:

- **12 curated BufferGeometry classes** (PART 68.2) —
  StarGeometry, PolygonGeometry, AnnulusGeometry, HeartGeometry,
  SpadeGeometry, DiamondGeometry, BurstGeometry, ArchedSlabGeometry,
  ArchGeometry, EdgedBoxGeometry, MoldingGeometry, PumpkinGeometry,
  LeafGeometry — 60-200 triangles each, well-tested, MIT-licensed
  from the three-low-poly package. Especially useful for weapons
  (Polygon = gem facet, Annulus = mana ring, Molding = crossguard
  trim, Arch = weapon rack, Pumpkin = gourd lantern).

- **3 procedural texture helpers** (PART 68.3) —
  makeCheckerboard, makeRadialGradient, makeLinearGradient.
  Each returns a CanvasTexture with the standard wrap / colorSpace
  defaults. Pairs with 5 new procedural MAT_DB patterns
  (pat_checker_wood, pat_checker_stone, pat_radial_halo,
  pat_radial_aoe, pat_linear_heathaze) and 6 new color-ramp
  MAT_DB presets (mat_ramp_fire, mat_ramp_ice, mat_ramp_poison,
  mat_ramp_holy, mat_ramp_shadow, mat_ramp_solar).

- **4 random utilities** (PART 68.1) — mulberry32 (already
  existed in PART 40, now wrapped), splitmix32, deriveSubSeed,
  createRandom (ergonomic layer with .next() / .float() / .int()
  / .pick() / .weighted() / .bool() / .skewMax() / .skewMin()).

- **4 alignment helpers** (PART 68.4) — alignToEdge, alignToRow,
  alignToSurface, center. The canonical pattern for placing parts
  in their own local frame, then snapping them to a surface / row
  / edge / center.

- **5 atmospheric effects** (PART 68.7) — atmosphereRain,
  atmosphereGroundFog, atmosphereDustMotes (plus atmospheric
  effects skeleton for petalDrift / wisp). Each is a `THREE.Group`
  with its own `.update(dt)` method, drop-in to a scene.

- **2 sky helpers** (PART 68.6) — skyFullMoon (disc + halo +
  procedural craters), skyStarField (N procedurally-placed stars
  on the celestial sphere + 4 brighter "lead stars" with burst
  shape).

- **3 lookdev helpers** (PART 68.8) — cyclorama (curved studio
  backdrop), groundGrid (studio ground grid), contactShadows
  (cheap ground contact shadow).

- **4 closed-form curve helpers** (PART 68.9) — constantCurvatureArc,
  circularArc, helixPath, spiralPath. Derive every metre from a
  radius.

- **Lifetime color ramps** (PART 68.5) — buildMatRamp(rampKeyOrObject)
  returns a CanvasTexture for a 4-color lifetime gradient.
  Pairs with `meta.matRamp` declaration.

- **Easing / Falloff constants** (PART 68.10) — 24 easing
  functions (linear, inQuad, outQuad, ..., inOutBounce) and 8
  falloff functions (linear, smooth, smoothstep, gauss, exp,
  invExp, root, inv).

- **Bone segments table** (PART 68.11) — the default 20-bone
  table (Spine, Spine1, Spine2, Neck, Head, LeftShoulder,
  RightShoulder, LeftArm, RightArm, LeftForeArm, RightForeArm,
  LeftHand, RightHand, Hips, LeftUpLeg, RightUpLeg, LeftLeg,
  RightLeg, LeftFoot, RightFoot) with weight + radius per bone.

- **System helpers (P0)** (PART 68.1) — `frame` (the shared
  uniform object: uTime, uDelta, uResolution, uLightDir, uEnvMap),
  `lblFrameTick()` (clamped-delta FrameTimer, prevents tab-switch
  from producing a 5-second jump), `makeObjectPool(factory, opts)`
  (pools expensive-to-construct objects — Groups, BVH indices,
  preview meshes), `makeAssetLoader()` (shared LoadingManager
  with URL-rewrite so absolute local paths don't cause 50 404s).

- **4 new opt-in validators E37-E40** (added to the existing 36)
  — E37 sub-seed usage, E38 lifetime color ramp validity, E39
  gizmo shape range, E40 bone segment coverage. ALL fire ONLY
  when the corresponding opt-in meta flag is set, so a model
  that doesn't use the new PART 68-71 features is unchanged.

- **4 new opt-in `meta.*` fields** — `meta.matRamp`
  ({ birth, early, late, death } or shorthand), `meta.gizmo`
  ({ shape, range, ... }), `meta.vfx` ({ embers, sparks, ...,
  boneAnchored, boneSegments }), `meta.usesMathRandom` (boolean
  flag the E37 validator inspects).

The renderer adds 50+ new canonical helpers re-exported on
`window.lblSpec.helpers` alongside the PART 35 + PART 39 + PART
40 + PART 41 + PART 42 + PART 43 + PART 44 + PART 45 + PART 67
bundles. The existing 40 anti-pattern validators (E1-E40) are
preserved unchanged. PART 45 (CS2 PBR) and PART 67 (cross-
primitive + modifier stack + recolor + chain + animation) and
PART 68-71 (geometry + VFX + brushes + presets) are EXTRA
CAPABILITIES for weapons, blades, and metal-finish subjects
(especially the mat_ramp_fire / mat_ramp_ice / mat_ramp_holy
ramp presets pair with the PART 45 CS2 finishes for emissive
lifetimes). PART 68-71 is style-agnostic in scope but
content-specific in subject. No new dependency (the helpers use
only existing Three.js primitives). No new export path, no new
mandatory field, no removed / weakened rule, no removed /
weakened existing extension, no removed / weakened existing
PART 45 helper, no removed / weakened existing PART 41.6
family. Strict upgrade, zero downgrades.

## Files modified (8)

| File | Change |
|------|--------|
| `index.html` | 50+ new helpers added to `__threeTriHelpers` (frame, lblFrameTick, mulberry32, splitmix32, deriveSubSeed, createRandom, makeObjectPool, makeAssetLoader, StarGeometry, PolygonGeometry, AnnulusGeometry, HeartGeometry, SpadeGeometry, DiamondGeometry, BurstGeometry, ArchedSlabGeometry, ArchGeometry, EdgedBoxGeometry, MoldingGeometry, PumpkinGeometry, LeafGeometry, makeCheckerboard, makeRadialGradient, makeLinearGradient, alignToEdge, alignToRow, alignToSurface, center, buildMatRamp, skyFullMoon, skyStarField, atmosphereRain, atmosphereGroundFog, atmosphereDustMotes, cyclorama, groundGrid, contactShadows, constantCurvatureArc, circularArc, helixPath, spiralPath, easing, falloff, boneSegments); 4 new validators E37-E40 added to `ANTI_PATTERN_CHECKS`; meta description + keywords updated; the comment block that describes `window.lblSpec` and `ANTI_PATTERN_CHECKS` updated; mobile responsive fix for the spec chip (hide on narrow screens) |
| `CHANGES_SUMMARY.md` | This entry |

## Files UNTOUCHED

- `public/models/Model_1.ts` through `Model_5.ts` — the 5
  built-in models do not use any PART 68-71 features; they load
  identically to v1.22. The new helpers are AVAILABLE to them
  but OPT-IN.
- `public/models/manifest.json` — no new models added in this
  round.
- `public/rig/` — the rig assets are unchanged.
- `.github/workflows/manifest.yml` — the manifest auto-refresh
  workflow is unchanged.
- The existing PART 1-67 spec in all 6 spec files is UNCHANGED
  (no PART has been weakened, removed, or re-numbered).
- The existing 36 anti-pattern validators E1-E36 are UNCHANGED
  (E37-E40 are purely additive).
- The existing 5 PART 45 helpers (cs2PbrProfile, applyWear,
  cs2WearMaskTexture, wearSlider, cs2-finish materialVariants
  family) are UNCHANGED.
- The existing 4 PART 41.6 materialVariants families are
  UNCHANGED.
- The existing 2 PART 44.3 families (bone + magic) are UNCHANGED.

## What PART 68-71 covers

| Section | Sub-section | Helpers | meta.* field |
|---------|-------------|---------|--------------|
| 68.1 | System helpers (P0) | `frame`, `lblFrameTick`, `mulberry32`, `splitmix32`, `deriveSubSeed`, `createRandom`, `makeObjectPool`, `makeAssetLoader` | `meta.usesMathRandom` |
| 68.2 | 12 BufferGeometry classes (P1) | `StarGeometry`, `PolygonGeometry`, `AnnulusGeometry`, `HeartGeometry`, `SpadeGeometry`, `DiamondGeometry`, `BurstGeometry`, `ArchedSlabGeometry`, `ArchGeometry`, `EdgedBoxGeometry`, `MoldingGeometry`, `PumpkinGeometry`, `LeafGeometry` | (per-part primitive string) |
| 68.3 | Procedural textures (P1) | `makeCheckerboard`, `makeRadialGradient`, `makeLinearGradient` | `meta.pattern` |
| 68.4 | Alignment helpers (P2) | `alignToEdge`, `alignToRow`, `alignToSurface`, `center` | (placement only) |
| 68.5 | Lifetime color ramps (P1) | `buildMatRamp` | `meta.matRamp` |
| 68.6 | Sky helpers (P2) | `skyFullMoon`, `skyStarField` | `meta.atmospheric.fullMoon` / `.starField` |
| 68.7 | Atmospheric effects (P1) | `atmosphereRain`, `atmosphereGroundFog`, `atmosphereDustMotes` | `meta.atmospheric.rain` / `.groundFog` / `.dustMotes` |
| 68.8 | Lookdev helpers (P2) | `cyclorama`, `groundGrid`, `contactShadows` | (lookdev only) |
| 68.9 | Closed-form math (P2) | `constantCurvatureArc`, `circularArc`, `helixPath`, `spiralPath` | (math only) |
| 68.10 | Easing / Falloff (P2) | `easing` (24 functions), `falloff` (8 functions) | (per-frame only) |
| 68.11 | Bone segments (P2) | `boneSegments` (20-bone table) | `meta.vfx.boneAnchored` + `meta.vfx.boneSegments` |

## What PART 68-71 does NOT introduce

- **No new dependency.** All helpers use existing Three.js
  primitives (BufferGeometry, RingGeometry, SphereGeometry,
  PlaneGeometry, TubeGeometry, Shape, ExtrudeGeometry,
  BufferAttribute math, CanvasTexture, THREE.Color,
  THREE.Vector3, THREE.LoadingManager).
- **No new export path.** The existing GLB / OBJ / STL / .ts
  export buttons are unchanged.
- **No new mandatory field.** All new meta.* fields are
  opt-in; a model that doesn't set any of them loads
  identically to v1.22.
- **No removed / weakened rule.** Every PART 1-67 rule is
  preserved exactly. No PART has been re-numbered.
- **No removed / weakened existing extension.** The existing
  `materialVariants` (PART 41.6), `cs2PbrProfile` (PART 45),
  `lookDevLights` (PART 44), `applyModifierStack` (PART 67.2),
  and every other prior helper is unchanged.
- **No removed / weakened existing PART 45 helper.** All 5
  PART 45 helpers are unchanged.
- **No removed / weakened existing PART 41.6 family.** The 4
  default families (plate / cloth / leather / stone) plus the
  2 PART 44.3 extensions (bone / magic) are unchanged.
- **No change to PART 38.22's style agnosticism.** PART 68-71
  is also style-agnostic in scope.
- **No change to PART 38.14's GLB-first architecture.** PART
  68-71 layers on top of the existing TS-factory contract.
- **No change to PART 39.5's factory + options pattern.** PART
  68-71 helpers are called the same way: `lblSpec.helpers
  .<name>(...)`.
- **No change to PART 44.3's existing bone + magic families.**
- **No change to PART 45.0.3's style agnosticism.** PART 68-71
  is also style-agnostic in scope.
- **No change to PART 67's existing 21 helpers.** All 21
  PART 67 helpers (makeDisc, makeRing, ..., preflightCheck) are
  unchanged.
- **Strict upgrade, zero downgrades.** Every change in PART
  68-71 is purely additive. A model that doesn't use any
  PART 68-71 features loads identically to v1.22.

## Quick reference for the renderer build

```javascript
// LBL spec version this renderer targets:
const VERSION = { ts: 'v1.23', json: 'v8.15' };

// Number of anti-pattern validators:
const ANTI_PATTERN_CHECKS = [ /* E1 - E40 */ ]; // 40 total

// 50+ new PART 68-71 helpers (re-exported on window.lblSpec.helpers):
// - 4 random utilities (mulberry32, splitmix32, deriveSubSeed, createRandom)
// - 4 system helpers (frame, lblFrameTick, makeObjectPool, makeAssetLoader)
// - 13 BufferGeometry classes (Star/Polygon/Annulus/Heart/Spade/Diamond/
//   Burst/ArchedSlab/Arch/EdgedBox/Molding/Pumpkin/Leaf)
// - 3 procedural textures (Checkerboard/Radial/Linear gradient)
// - 4 alignment helpers (alignToEdge/Row/Surface, center)
// - 1 lifetime color ramp (buildMatRamp)
// - 2 sky helpers (FullMoon/StarField)
// - 3 atmospheric effects (Rain/GroundFog/DustMotes)
// - 3 lookdev helpers (Cyclorama/GroundGrid/ContactShadows)
// - 4 closed-form curves (ConstantCurvature/Arc/Helix/Spiral)
// - 1 easing namespace (24 functions) + 1 falloff namespace (8 functions)
// - 1 bone segments table (20-bone default)
// Total: 50+ new entries on window.lblSpec.helpers.

// 4 new PART 68-71 validators:
// E37 (sub-seed usage), E38 (lifetime color ramp validity),
// E39 (gizmo shape range), E40 (bone segment coverage).
```


# v1.23 / v8.15 — PART 67 + PART 68-71 + PART 72 + PART 73 (full round)

The spec now teaches the AI four layered additions, all
STRICTLY ADDITIVE on top of PARTs 1-45, all OPT-IN by
construction. Sources: the maintainer's "Reference-Repo
Analysis for low_poly_3d" working notebook (2026-09-04,
PART 67), the maintainer's "two-repo analysis" working
notebook (2026-09-05, PART 68-71), and the maintainer's
"GHOSTPOLY / LOW_POLY_3D — WHAT TO PULL FROM
img2threejs" working notebook (2026-09-05, PART 72 +
PART 73).

## What this round adds

- **PART 67 — OPT-IN capability bundle (cross-primitive
  vocabulary + deform modifier stack + recolor + chain +
  converge + material animation + vertex channels + UV
  projections + preflight + shadow profile)**. 7 new
  cross-primitive shape generators (`makeDisc` /
  `makeRing` / `makeArc` / `makeHemisphere` / `makeRibbon`
  / `makeCrossPlanes` / `makeHelix`), 6 deform modifiers
  (`taper` / `twist` / `bend` / `spherize` / `inflate` /
  `applyNoise`) dispatched by `applyModifierStack(geo,
  mods)`, 1 vertex-channel helper `fillVertexChannel` (uv1
  / uv2 / uv3), 1 UV projection helper `projectUV` with 5
  new projections (radial / cylindrical / spherical / box
  / alongLength) on top of the existing planar /
  shapeDefault, 1 `convergeFaces` helper (forge-style), 1
  `recolorByPalette` runtime swap, 1 `placeChain` chain
  placement, 1 `applyMaterialAnimation` time-driven
  material modifier, 1 `preflightCheck` safety-budget
  helper, and 1 `shadowProfile` opt-in ('soft-3-light' |
  'sharp-1-light' | 'cs2-hdri' | 'none'). Adds 6 new
  non-blocking validators E31-E36.

- **PART 68-71 — geometry + VFX + lookdev + random +
  alignment OPT-IN capability bundle (from
  jasonsturges/three-low-poly + achrefelouafi/
  LinearAbilityExtThreeJS)**. 4 random utilities
  (`mulberry32` / `splitmix32` / `deriveSubSeed` /
  `createRandom`), 4 system helpers (`frame` /
  `lblFrameTick` / `makeObjectPool` / `makeAssetLoader`),
  12 BufferGeometry classes (`StarGeometry` /
  `PolygonGeometry` / `AnnulusGeometry` / `HeartGeometry`
  / `SpadeGeometry` / `DiamondGeometry` / `BurstGeometry` /
  `ArchedSlabGeometry` / `ArchGeometry` / `EdgedBox
  Geometry` / `MoldingGeometry` / `PumpkinGeometry` /
  `LeafGeometry`), 3 procedural textures
  (`makeCheckerboard` / `makeRadialGradient` /
  `makeLinearGradient`), 4 alignment helpers
  (`alignToEdge` / `alignToRow` / `alignToSurface` /
  `center`), 1 lifetime color ramp (`buildMatRamp`), 2 sky
  helpers (`skyFullMoon` / `skyStarField`), 3 atmospheric
  effects (`atmosphereRain` / `atmosphereGroundFog` /
  `atmosphereDustMotes`), 3 lookdev helpers (`cyclorama`
  / `groundGrid` / `contactShadows`), 4 closed-form
  curves (`constantCurvatureArc` / `circularArc` /
  `helixPath` / `spiralPath`), 1 easing namespace (24
  functions) + 1 falloff namespace (8 functions), 1 bone
  segments table (20-bone default). Adds 4 new
  non-blocking validators E37-E40.

- **PART 72 — img2threejs structural-fidelity alignment**.
  14 sub-sections translating img2threejs's structural-
  fidelity patterns into the existing lblSpec / Three.js
  contract:

  - **(72.1) the distinct-Z test** that catches 2.5D
    "cardboard" extrusions the silhouette IoU cannot see
    (a planar extrusion lands on 6-10 distinct Z planes
    no matter how many triangles it has; a genuinely
    revolved/lofted/swept part lands on 11+).
  - **(72.2) the variable-thickness loft** (the actual
    fix for 72.1) with 4 trap-warnings (E42) on cap
    interior vertices, cap normal computation, roll
    sizing, and slope-vs-depth sanity. Helper:
    `lblSpec.helpers.buildLoft(opts)`.
  - **(72.3) the cavity axis rule** (hole vs missing-
    wall) + the trace-step interaction warning (when a
    photo-trace/mask absorbs an adjacent opaque part,
    part A's traced hole will carry part B's shape as a
    solid tongue at full thickness).
  - **(72.4) the chirality gate** (mirror vs rotation) —
    a HARD spec-time validator E44 that catches the
    "both hands modelled thumb-out" bug (negating X and
    Z together is a 180-degree rotation about Y, and
    rotation preserves handedness — so a pair built that
    way comes out as the SAME hand twice). Helper:
    `lblSpec.helpers.checkPair(leftGeo, rightGeo)`.
  - **(72.5) the assembly / explode contract** (4
    naming rules: name every mesh, flag surface detail
    with `userData.explodeWithParent`, distinguish
    "group of named parts" from "group of anonymous
    meshes", publish `sculptRuntime.destructionGroups`)
    + explode scaling that grows gaps instead of
    sliding the whole layout + `explodeAssembly` helper
    + `checkPartCoverage` cross-check + E45
    missing-component rules.
  - **(72.6) the 14-item closed detail-inventory
    taxonomy** with explicit `mapsTo` Three.js calls
    per kind (gloss, bevel, fastener, linework, contour,
    seam, stitch, stain, scratch, chip, decal,
    emissive, hole, groove/ridge) + sizing rule
    (simple 3 / moderate 6 / complex 10 / ultra 16
    details) + E46 unlinked-detail gate.
  - **(72.7) the 8-axis quality-contract / complexity-
    scoring system** (silhouette complexity, component
    count, hierarchy depth, repetition density, material
    layer count, local detail density, occlusion risk,
    action-readiness need; 0-3 each, total 0-24 maps to
    tier simple / moderate / complex / ultra) + tier
    gates + strong-vs-weak quality bar rewrite + E47
    tier compliance.
  - **(72.8) the diagnostic discipline** (4 cheap tests:
    flat-material render, axis raycast, git-stash
    re-render, parameter bracketing) as the first move
    instead of free-form guessing. Helper:
    `lblSpec.helpers.runDiagnostic(root, testName, opts)`.
  - **(72.9) the tube-network vs single-sweep rule** for
    frames, grips, handles (a bike frame, a knife-handle
    grip, a fork, a handlebar are NETWORKS OF STRAIGHT
    MEMBERS, not one continuous curve — a single closed
    curve-sweep through the same points CatmullRom-
    smooths into a teardrop blob). Helper:
    `lblSpec.helpers.buildTubeNetwork(members)`. E49
    warns when a spec declares one of these subjects
    with a single-sweep tube primitive.
  - **(72.10) the implicit-SDF descriptor schema** (5
    primitive kinds: sphere/capsule/box/cone/ellipsoid
    ≤64 entries, 3 operation kinds: smooth-union/
    subtract/intersect ≤128 entries, resolution 4-64,
    optional bounds) + E50 validation rules (sdf and
    visualHull can't live on the same component; sdf
    and subdivide can't combine on the implicit path;
    primitive/operation ids must be unique within the
    block).
  - **(72.11) the material-identity resolution pipeline**
    (5-step resolve order: explicit canonical
    materialId → exact family+subtype+finish match →
    alias match keeping ALL matching candidates →
    family fallback at reduced confidence → "unknown"/
    request-input) + the sRGB/NoColorSpace hard rule
    (colour maps stay in sRGB, but roughness/metalness/
    normal/AO/thickness/anisotropy maps stay in linear).
  - **(72.12) the interior-difference metric** that
    splits PART 39.4's silhouette IoU into an outline
    score and an interior score (the original IoU is
    computed from ~11% of the figure and is structurally
    blind to a deleted face — a finished face and the
    SAME model with its face fully deleted scored
    identically to four decimal places on IoU, and
    adding an entire mouth moved the outline metric in
    the WRONG direction). Helper:
    `lblSpec.helpers.compareRender(renderedCanvas,
    referenceCanvas, opts)`.
  - **(72.13) geodesic skinning** for rigged characters
    (replaces straight-line bone-to-vertex distance
    with through-solid geodesic via the existing
    three-mesh-bvh index from PART 44.2 — straight-line
    distance lets a vertex on one side of a thin gap
    get influenced by a bone on the OTHER side of that
    gap, because it's physically close even though no
    solid path connects them; this is the classic
    "candy-wrapper" skinning artifact at elbows/
    armpits/fingers).
  - **(72.14) updated cross-references.**

  Adds 10 new non-blocking validators E41-E50 and 7 new
  canonical helpers (`buildLoft`, `checkPair`,
  `explodeAssembly`, `checkPartCoverage`,
  `buildTubeNetwork`, `runDiagnostic`, `compareRender`).

- **PART 73 — measured placement (no new validator)**. The
  user-flagged bug-fix layer: "models come out with parts
  in the wrong position / not in the perfect place." The
  existing PART 11 floating-parts rule, PART 39.4 E17
  bbox-overlap validator, and `attachment` field set are
  all solid; the bug is that the NUMBERS that fill the
  contract are usually eyeballed. PART 73 layers 5 new
  spec-authoring disciplines:

  - **(73.1) STOP EYEBALLING COORDINATES** — use a FIXED
    image-to-world mapping function
    `imageToWorld(nx, ny) = { x: (nx - 0.5) * SX,
    y: (CY - ny) * SY }` for every part's position,
    joint, and socket, plus spline tracing for curved
    outlines, plus a mandatory `meta.placementSource`
    declaration. **This is the SINGLE HIGHEST-LEVERAGE
    FIX for the user-flagged "parts not in the right
    place" problem** — if only one sub-section of PART
    73 is implemented, implement THIS one.
  - **(73.2) character / creature proportions measured
    in head-units (HU)**, with style-axis picked FROM
    the image (not defaulted: ~7.5 HU realistic, 5-6 HU
    stylized/anime-adjacent, 2-3 HU chibi/figurine) and
    explicit `meta.anatomy` declaration.
  - **(73.3) facial / feature landmarks normalized to
    the HEAD box** (not the full image) via
    `meta.faceLandmarks`, with default ranges (hairline
    ~0.0-0.15, eyeLine ~0.45-0.55, eyeSpacing ~0.2-0.35
    of head width, noseBase ~0.6-0.7, mouthLine
    ~0.75-0.85) — match what's actually observed in
    the image, not the typical numbers (a stylized face
    with huge eyes will LEGITIMATELY violate the
    "realistic" ratios above on purpose, so match
    what's actually observed in the image, not the
    typical numbers).
  - **(73.4) joints / skeleton measured off the
    silhouette** with priority order (stance → limb
    angles at shoulders/hips → hand/foot orientation),
    with low-confidence marking for occluded / inferred
    joints.
  - **(73.5) the "rigid-looking parts placed near a
    joint" fix** (the right rule is "does this part
    cross a joint boundary?", not "is it hard or
    soft?") + `rigidityClass` declaration ('rigid-
    single-bone' | 'rigid-at-joint' | 'deformable').

  PART 73 introduces NO new validator, NO new mandatory
  field, NO new renderer behaviour, NO new export
  path — it is a spec-authoring discipline that the
  existing PART 21 checklist picks up automatically.

## Files modified (8)

| File | Change |
|------|--------|
| `index.html` | VERSION constant unchanged (v1.23 / v8.15); 7 new PART 72 helpers added to `__threeTriHelpers` (buildLoft, checkPair, explodeAssembly, checkPartCoverage, buildTubeNetwork, runDiagnostic, compareRender); 10 new validators E41-E50 added to `ANTI_PATTERN_CHECKS`; the comment block that describes `window.lblSpec` and `ANTI_PATTERN_CHECKS` updated to mention PART 67 + PART 68-71 + PART 72 + PART 73 |
| `Prompt_To_Ts.txt` | Header bumped v1.22 → v1.23; v1.23 changelog entry added near the top; new PART 72 + PART 73 added at end (mirrors the maintainer's img2threejs working notebook) |
| `Image_To_Ts.txt` | Header bumped v1.22 → v1.23; v1.23 changelog entry added near the top; new PART 72 + PART 73 added at end |
| `Prompt_To_Js.txt` | Header bumped v8.14 → v8.15; v8.15 changelog entry added; new PART 72 + PART 73 added at end |
| `Image_To_Js.txt` | Header bumped v8.14 → v8.15; v8.15 changelog entry added; new PART 72 + PART 73 added at end |
| `Prompt_To_Json.txt` | Header bumped v8.14 → v8.15; v8.15 changelog entry added; new PART 72 + PART 73 added at end |
| `Image_To_Json.txt` | Header bumped v8.14 → v8.15; v8.15 changelog entry added; new PART 72 + PART 73 added at end |
| `CHANGES_SUMMARY.md` | This entry |

## Files UNTOUCHED

- `public/models/Model_1.ts` through `Model_5.ts` — the 5
  built-in models do not use any PART 67-73 features; they
  load identically to v1.22. The new helpers are AVAILABLE
  to them but OPT-IN.
- `public/models/manifest.json` — no new models added in
  this round.
- `public/rig/` — the rig assets are unchanged.
- `.github/workflows/manifest.yml` — the manifest auto-
  refresh workflow is unchanged.
- The existing PART 1-71 spec in all 6 spec files is
  UNCHANGED (no PART has been weakened, removed, or
  re-numbered).
- The existing 40 anti-pattern validators E1-E40 are
  UNCHANGED (E41-E50 are purely additive).
- The existing PART 45 helpers (cs2PbrProfile, applyWear,
  cs2WearMaskTexture, wearSlider, cs2-finish
  materialVariants family) are UNCHANGED.
- The existing 23 PART 67 helpers (makeDisc, makeRing, ...,
  preflightCheck) are UNCHANGED.
- The existing 50+ PART 68-71 helpers (mulberry32,
  StarGeometry, ..., boneSegments) are UNCHANGED.
- The existing 4 PART 41.6 materialVariants families are
  UNCHANGED.
- The existing 2 PART 44.3 families (bone + magic) are
  UNCHANGED.

## What PART 72 covers (14 sub-sections)

| Section | Sub-section | Helper | Validator |
|---------|-------------|--------|-----------|
| 72.1 | Distinct-Z test (catches 2.5D) | (none — runs on raw geometry) | E41 |
| 72.2 | Variable-thickness loft | `buildLoft` | E42 |
| 72.3 | Cavity axis rule | (declarative) | E43 |
| 72.4 | Chirality gate | `checkPair` | E44 |
| 72.5 | Assembly / explode contract | `explodeAssembly`, `checkPartCoverage` | E45 |
| 72.6 | 14-item closed detail inventory | (declarative) | E46 |
| 72.7 | 8-axis quality contract / tier | (declarative) | E47 |
| 72.8 | Diagnostic discipline (4 cheap tests) | `runDiagnostic` | E48 |
| 72.9 | Tube-network vs single-sweep | `buildTubeNetwork` | E49 |
| 72.10 | Implicit-SDF descriptor schema | (declarative) | E50 |
| 72.11 | Material identity resolution pipeline | (declarative) | (no new validator) |
| 72.12 | Interior-difference metric | `compareRender` | (extends E41/E47) |
| 72.13 | Geodesic skinning | (PART 44.2 BVH reuse) | (none — direct fix) |
| 72.14 | Updated cross-references | (doc only) | (no validator) |

## What PART 73 covers (5 sub-sections)

| Section | Sub-section | Validator |
|---------|-------------|-----------|
| 73.1 | Fixed image-to-world mapping function | (picked up by PART 21) |
| 73.2 | Character proportions in head-units | (picked up by PART 21 + E47) |
| 73.3 | Facial landmarks normalized to HEAD box | (picked up by PART 21) |
| 73.4 | Joints / skeleton measured off silhouette | (picked up by PART 21) |
| 73.5 | Rigid parts at joint boundary | (picked up by E48) |
| 73.6 | Updated cross-references | (doc only) |

## What this round does NOT introduce

- **No new dependency.** All PART 72 helpers use existing
  Three.js primitives (BufferGeometry, BufferAttribute
  math, marching-cubes via PART 12's existing pipeline,
  BVH via PART 44.2's existing three-mesh-bvh). All PART
  67 helpers use only existing Three.js primitives. All
  PART 68-71 helpers use existing Three.js primitives.
  PART 73 is a spec-authoring discipline — no renderer
  change at all.
- **No new export path.** The existing GLB / OBJ / STL /
  .ts export buttons are unchanged.
- **No new mandatory field.** All new `meta.*` fields
  (PART 67 + PART 68-71 + PART 72) are opt-in. A model
  that doesn't set any of them loads identically to
  v1.22.
- **No removed / weakened rule.** Every PART 1-71 rule
  is preserved exactly. No PART has been re-numbered.
- **No removed / weakened existing extension.** The
  existing `materialVariants` (PART 41.6), `cs2PbrProfile`
  (PART 45), `lookDevLights` (PART 44), `applyModifier
  Stack` (PART 67.2), and every other prior helper is
  unchanged.
- **No removed / weakened existing PART 45 helper.** All
  5 PART 45 helpers are unchanged.
- **No removed / weakened existing PART 41.6 family.** The
  4 default families (plate / cloth / leather / stone)
  plus the 2 PART 44.3 extensions (bone / magic) are
  unchanged.
- **No change to PART 38.22's style agnosticism.** PART
  72 is also style-agnostic in scope.
- **No change to PART 38.14's GLB-first architecture.**
  PART 72 layers on top of the existing TS-factory
  contract.
- **No change to PART 39.5's factory + options pattern.**
  PART 72 helpers are called the same way:
  `lblSpec.helpers.<name>(...)`.
- **No change to PART 44.3's existing bone + magic
  families.**
- **No change to PART 45.0.3's style agnosticism.**
  PART 72 is also style-agnostic in scope.
- **No change to PART 67's existing 23 helpers.** All 23
  PART 67 helpers are unchanged.
- **No change to PART 68-71's existing 50+ helpers.**
  All 50+ PART 68-71 helpers are unchanged.
- **Strict upgrade, zero downgrades.** Every change in
  this round is purely additive. A model that doesn't
  use any of the new PART 67-73 features loads
  identically to v1.22.

## Highest-value items

If only a few items from this round can be implemented
right now, the maintainer ranks them in this order
(per the source notebook):

1. **PART 73.1 / `imageToWorld`** — directly fixes
   "parts not in the right place" (the user-flagged
   bug), costs nothing to add since it's a spec-
   authoring discipline, not a renderer change.
2. **PART 72.4 / E44 (chirality gate)** — cheap
   validator that catches the "both hands modelled
   thumb-out" bug. The current fidelity score
   literally cannot see this.
3. **PART 72.1 / E41 (distinct-Z test)** — cheap
   validator that catches 2.5D cardboard extrusions
   the current silhouette IoU cannot see.
4. **PART 72.6 / E46 (closed detail-inventory)** —
   the closed taxonomy + `mapsTo` rule is what
   prevents small identifying marks (a bevel
   highlight, a rivet row) getting skipped on a
   single eyeball pass.
5. **PART 72.12 (interior-difference)** — splits the
   existing PART 39.4 IoU into outline + interior
   scores. A finished face and the SAME model with
   its face fully deleted scored identically on
   the current IoU.

## Quick reference for the renderer build

```javascript
// LBL spec version this renderer targets:
const VERSION = { ts: 'v1.23', json: 'v8.15' };

// Number of anti-pattern validators:
const ANTI_PATTERN_CHECKS = [ /* E1 - E50 */ ]; // 50 total

// 7 new PART 72 helpers (re-exported on window.lblSpec.helpers):
// - buildLoft(opts)              (PART 72.2 — variable-thickness loft)
// - checkPair(leftGeo, rightGeo) (PART 72.4 — chirality test)
// - explodeAssembly(root, opts)  (PART 72.5 — explode scaling)
// - checkPartCoverage(root, spec) (PART 72.5 — declared-vs-built)
// - buildTubeNetwork(members)    (PART 72.9 — frame / grip / handlebar)
// - runDiagnostic(root, test, opts) (PART 72.8 — 4 cheap tests)
// - compareRender(r, ref, opts)  (PART 72.12 — outline + interior IoU)

// 10 new PART 72 validators:
// E41 (distinct-Z), E42 (loft trap-warnings), E43 (cavity axis),
// E44 (chirality), E45 (assembly coverage), E46 (detail mapsTo),
// E47 (quality tier), E48 (diagnostic first-move),
// E49 (tube-network), E50 (implicit-SDF schema).
```
