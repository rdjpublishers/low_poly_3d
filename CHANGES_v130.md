# v1.30 / v8.22 — Perfect-Shape Modeling Pipeline (2026-09-15)

This release layers the **PERFECT-SHAPE MODELING PIPELINE** (PART
145-152) on top of the v1.29 / v8.21 renderer + spec target. No new
runtime helpers — PART 145-152 is the missing **methodology layer**
that orchestrates the 44 PART 100-143 helpers into the 8-step "build
a real shape" pipeline that the maintainer's reference build of the
pirate robot demonstrated works but never documented.

The pipeline generalizes beyond the pirate robot: it applies to any
low-poly chunky character (creature, mascot, prop, vehicle). It also
applies to other 3D styles — the only style-specific advice is "scale
rotations DOWN for chunky characters" (Pitfall 10).

────────────────────────────────────────────────────────────────────────
Why this release exists
────────────────────────────────────────────────────────────────────────
  The pirate robot shipped at ~70% reference match and ~85% LBL spec
  match (per the original guide). To push future models past 90% on
  both axes, the AI factory needs:
    1. A SHAPE-CREATION METHODOLOGY (the 8-step pipeline) so the model
       comes from rules, not coordinates.
    2. A SHAPE-TECHNIQUE CATALOG (8 named methods: profile lofting,
       lathe, extrude, CSG, SDF, subdivision, NURBS, deformers) so
       every part picks the right primitive for its job.
    3. A MATERIAL DISCIPLINE (microRoughnessMap + striate + punctate +
       curvature + cavity-dirt AO on every material).
    4. A RIGGING DISCIPLINE (pivot offsets = mesh lengths; PART 30.7
       auto-promotion; PART 34 buildSemanticWeights for organic).
    5. ANIMATION DISCIPLINE (rest pose first, phase-offset for
       symmetry, NodeName.property track names, headless playback
       test, secondary motion).
    6. VALIDATION DISCIPLINE (silhouette from 4 angles, multi-view
       IoU, triangle budget, bbox overlap, height match, cheat-sheet
       check).
    7. A PITFALLS LIST (10 named bugs with concrete fixes) so the
       AI factory doesn't repeat the cycle.
    8. A REFERENCE CHEAT-SHEET (10-step ship-list).

  PART 145-152 documents all 8. PART 145 is the pipeline. PART 146-150
  are the technique catalogs (one per discipline). PART 151 is the
  pitfalls. PART 152 is the cheat-sheet.

────────────────────────────────────────────────────────────────────────
What's new in PART 145-152
────────────────────────────────────────────────────────────────────────

  PART 145 — THE 8-STEP PIPELINE
    Step 1. ANALYZE the reference (proportions / palette / parts).
    Step 2. SKELETON-FIRST (place joints as named pivots before any
            geometry).
    Step 3. CROSS-SECTION PROFILES at each joint (round at shoulder,
            oval mid-shaft, taper at wrist).
    Step 4. LOFT between profiles (one mesh per limb, not 5
            primitives).
    Step 5. POSITION ACCESSORIES procedurally (relative to a named
            pivot Group, not in world coordinates).
    Step 6. UNIFORM BEVEL pass (0.02 m chamfer on every solid mesh).
    Step 7. RIG + VALIDATE (set userData.partName + isPickable on
            every mesh; render from 4 angles; run validateModel).
    Step 8. ANIMATE (4 named clips minimum; phase-offset for symmetric
            limbs; headless playback verification).

  PART 146 — SHAPE-CREATION TECHNIQUES (8 named methods)
    146.1 PROFILE LOFTING (limbs, body segments, organic tubes).
          MT.core.loft(sections, opts) — sections = array of
          {t, radius}, opts = {radialSegments, lengthSegments, caps,
          twist}.
    146.2 LATHE GEOMETRY (hats, bowls, vases, hook curves).
          THREE.LatheGeometry(points, segments).
    146.3 EXTRUDE GEOMETRY (belts, harnesses, panels, capes, straps).
          THREE.ExtrudeGeometry(shape, {depth, bevelEnabled, ...}).
    146.4 CSG (recessed panels, holes, slots, cutouts).
          MT.core.csgSubtract (PART 108, three-bvh-csg backed).
    146.5 SDF + MARCHING CUBES (organic blob characters).
          MT.core.sdfSphere / sdfCapsule / sdfUnion (smooth-min) +
          MT.core.sdfMarch. THE canonical fix for Pitfall 1.
    146.6 SUBDIVISION SURFACES (smooth a coarse control mesh).
          MT.mesh.subdivideCatmullClark (PART 113).
    146.7 NURBS / SPLINES (curved paths — cables, hat brim trim,
          swept horns / tails / tentacles). MT.core.makeNurbsCurve +
          CatmullRomCurve3 (PART 111).
    146.8 PROCEDURAL DEFORMERS (taper / twist / bend / spherize /
          inflate / applyNoise). PART 67 modifier stack.

  PART 147 — MATERIAL & SURFACE TECHNIQUES (5 named methods)
    147.1 microRoughnessMap — the universal "kill plastic feel"
          overlay. Apply to EVERY material. PART 74.2 helper.
    147.2 Striate Maps — longitudinal grooves with micro-bulge
          between. Use for body panels, cylinder limbs, belt straps.
          Replaces hand-placed dark seam boxes (Pitfall 8).
    147.3 Punctate Maps — beetle-elytra style puncture dots. Rivets,
          screw heads, bolt holes. Highlight rim included.
    147.4 Curvature-Driven Material Variation — per-vertex Laplacian →
          "polished rim, dull field". PART 74.3 heightToCurvature.
    147.5 Cavity-Dirt AO — per-vertex AO baked from hemisphere raycast.
          MT.materials.bakeMap(geom, 'ao', {size:256}).

  PART 148 — RIGGING TECHNIQUES (6 named methods)
    148.1 PIVOT OFFSETS = MESH LENGTHS. If upper-arm is 0.22 m, the
          elbow pivot is at (0, -0.22, 0) from the shoulder.
          Pitfall 2 fix.
    148.2 HIERARCHY = ANATOMY. rotate hipRoot → whole body. rotate
          spine → upper body. Never skip levels.
    148.3 NAMING CONVENTION. Every pivot Group gets a unique
          non-empty .name. Use _mesh or _visual suffix on visual
          meshes to avoid getObjectByName collisions (Pitfall 3).
    148.4 RIGID BINDING FOR CHUNKY MESHES. Don't use SkinnedMesh
          with vertex weights for low-poly chunky characters — parent
          the mesh under the pivot Group. PART 30.7 auto-promotion
          wraps each named pivot in a real THREE.Bone at GLB export.
    148.5 SMOOTH BINDING FOR ORGANIC SURFACES. Use SkinnedMesh +
          buildSemanticWeights (PART 34) when a single mesh needs to
          deform across multiple bones. 4-influence default.
    148.6 AUTO-RIGGING VALIDATION. MT.organic.autoRig(geom,
          {resolution:64}) (PART 134) verifies the skeleton topology
          matches the geometry's medial line.

  PART 149 — ANIMATION TECHNIQUES (6 named methods)
    149.1 REST POSE FIRST. Get silhouette right in rest pose BEFORE
          authoring any clip. A wrong rest pose = wrong every clip.
    149.2 PHASE-OFFSET FOR SYMMETRY. Author one clip, play on right
          side with phase = duration * 0.5. Mathematically guaranteed
          to stay symmetric. For quadrupeds: use the v1.29 anycreature
          mirror_phase (PART 15 fix).
    149.3 Track names MUST be '<NodeName>.<property>'. Rotation →
          '<bone>.quaternion' (QuaternionKeyframeTrack). NEVER use
          glTF form (silent failure).
    149.4 Loop clips need frame 0 === frame N (otherwise visible
          "jump" at the seam).
    149.5 Test playback HEADLESS. Compile, drive mixer for 30-90
          frames, verify positions/quaternions actually CHANGED.
          PART 5.6(b) — MANDATORY.
    149.6 Use SECONDARY MOTION for life. After primary clip, add
          Math.sin(elapsed * 4 + parentAngularVel) on hat brim, scarf,
          belt buckle. 5 lines of math.

  PART 150 — VALIDATION & QA TECHNIQUES (6 named methods)
    150.1 SILHOUETTE TEST FROM 4 ANGLES. Front, side, back, 3/4.
          Sticker test: a silhouette that works only from the front
          is a sticker, not a model.
    150.2 MULTI-VIEW IoU. Render reference + your model at same angle,
          compute silhouette IoU. Target 0.85+ for chunky characters.
          PART 39.4 E17 bbox-overlap validator runs at boot.
    150.3 TRIANGLE BUDGET. < 5,000 for chunky character. Reference
          pirate robot was 4,700 — within budget. MT.mesh.qemDecimate
          (PART 116) to hit the budget.
    150.4 BBOX OVERLAP CHECK. No two solid parts should have
          overlapping bounding boxes unless meant to be in contact.
    150.5 HEIGHT MATCH. Resolved Y range should match declared height.
          PART 72.13 #2 — re-measure after building, fix if off.
    150.6 CHECK AGAINST CHEAT-SHEET (PART 152 below).

  PART 151 — PITFALLS & HOW TO AVOID THEM (10 named pitfalls)
    1. Visible intersections → use SDF union (PART 146.5) or shrink
       each primitive 0.01 m at every contact point.
    2. Pivot offset doesn't match mesh length → walk through skeleton,
       every pivot = bottom of mesh above. SEE PART 148.1.
    3. getObjectByName returns wrong object → use _mesh / _visual
       suffix. SEE PART 148.3.
    4. Track name uses glTF form → lookup table {translation:
       'position', rotation: 'quaternion', scale: 'scale'}. SEE
       PART 149.3.
    5. Mix tick and mixer.update without coordinating → pick ONE.
    6. Single BIG mesh instead of multiple small ones → PART 30.7
       contract: every body part its own Mesh with userData.partName
       + userData.isPickable.
    7. Smooth-shaded normals on a low-poly mesh → flatShading: true.
    8. Hand-placed dark boxes for seams → striateMap (PART 74.2).
    9. Glossy plastic look → microRoughnessMap on every material.
    10. Animation amplitudes tuned for human scale → chunky mascot
        walk = ±10° hip swing, ±8° arm sway. Default rule: chunkier
        the model, smaller the rotations.

  PART 152 — REFERENCE CHEAT-SHEET (10-step canonical recipe)
    1. ANATOMY TABLE (in code, as comment at top of .ts file).
    2. SKELETON FIRST (26 named pivots in right hierarchy).
    3. ONE MESH PER LIMB (profile loft — PART 146.1).
    4. CSG FOR RECESSES (mouth grille, eye patch socket, rivet holes).
    5. UNIFORM BEVEL (0.02 m chamfer on every solid mesh).
    6. MATERIALS (microRoughnessMap + striate + aoMap; PBR roughness
       0.55 metalness 0.35 for dark body; 0.25 / 0.85 for gold trim).
    7. RIG (PART 30 pivot hierarchy + PART 30.7 auto-promotion +
       userData.partName + isPickable).
    8. ANIMATIONS (4 clips minimum: idle 1.6s loop / walk 1.0s loop /
       attack 0.9s once / express 1.2s once).
    9. VALIDATE (4-angle silhouette + triangle budget + headless
       playback + no getObjectByName collisions).
    10. SHIP (single .ts file, single export function, no relative
        imports, LOOK-DEV LIGHTS as optional second export, PIVOT
        TABLE in module header, 6:3:1 value hierarchy, style
        decisions documented).

────────────────────────────────────────────────────────────────────────
How the AI factory uses PART 145-152
────────────────────────────────────────────────────────────────────────

  PART 145-152 is STYLE-AGNOSTIC — it applies to every image-to-code
  path the AI factory supports (low-poly, mid-poly, high-poly,
  smooth-shaded, voxel, toon, photoreal, hand-painted, retro-PSX).
  The AI factory does NOT need to call any new helper to satisfy
  PART 145-152. PART 145-152 is PURELY ADDITIVE GUIDANCE for the
  authoring process.

  The COMPLETE 8-step pipeline the AI follows:
    STEP 1 (Analyze)        ← PART 145.1 (no helper)
    STEP 2 (Skeleton)       ← PART 30 / PART 30.7 / PART 34
    STEP 3 (Profiles)       ← PART 146.1 (loft input format)
    STEP 4 (Loft)           ← MT.core.loft (PART 146.1)
                             or MT.core.makeParametric (PART 104)
    STEP 5 (Accessories)    ← parent.position + offset_in_parent_frame
    STEP 6 (Bevel)          ← RoundedBoxGeometry or
                             MT.mesh.subdivideCatmullClark (PART 113)
    STEP 7 (Rig+Validate)   ← userData.partName + isPickable,
                             validateModel(root, {maxGap: 0.02})
    STEP 8 (Animate)        ← AnimationClip + AnimationMixer +
                             headless playback verification

  The AI does NOT have to USE every technique. It picks from the
  146-150 catalogs per part. A simple prop might use only PART 146.3
  (Extrude) + PART 146.2 (Lathe); a creature uses PART 146.5 (SDF)
  for the body and PART 146.1 (Loft) for the limbs.

  The PITFALLS list (PART 151) is the canonical pre-emission
  checklist. Each pitfall has a concrete fix — the AI factory
  SHOULD verify Pitfalls 1, 2, 3, 4, 5, 6, 8, 9, 10 before shipping
  any chunky character.

────────────────────────────────────────────────────────────────────────
FILES TOUCHED
────────────────────────────────────────────────────────────────────────

  - Image_To_Ts.txt         (PART 145-152 appended after PART 100-143)
  - Image_To_Js.txt         (same)
  - Image_To_Json.txt       (same)
  - Prompt_To_Ts.txt        (PART 145-152 inserted before PART 75-89)
  - Prompt_To_Js.txt        (same)
  - Prompt_To_Json.txt      (same)
  - index.html              (meta description + meta keywords + spec
                            chip title text + topbar comment + window
                            .lblSpec.VERSION constants bumped from
                            v1.24/v8.16 → v1.30/v8.22; PART 74 inline
                            comment version bumped too)
  - CHANGES_SUMMARY.md      (new v1.30 / v8.22 prologue prepended)
  - CHANGES_v130.md         (this file)
  - public/modeling/MODELING_TECHNIQUES_v143.md
                            (PART 145-152 cross-reference appended)
  - public/EXAMPLES_v8_17.md
                            (PART 145-152 cross-reference note added)

────────────────────────────────────────────────────────────────────────
VERIFICATION
────────────────────────────────────────────────────────────────────────

  - All 6 spec files now contain "PART 145-152" and "END OF PART 145-152".
  - The window.lblSpec.VERSION.ts is 'v1.30' and VERSION.json is 'v8.22'.
  - The renderer's #lbl-spec-chip title mentions "v1.30 / v8.22" and
    "PART 145-152 Perfect-Shape Modeling Pipeline".
  - The renderer's <meta name="description"> mentions the
    11 opt-in architectural features and PART 145-152.
  - The renderer's <meta name="keywords"> says "LBL v1.30, LBL v8.22"
    and "v1.30 v8.22".
  - No spec file lost its prior content (PART 1-144 all preserved).
  - The renderer still loads the v1.29 / v8.21 spec examples
    (≤v1.28 / ≤v8.20 backward-compat preserved).

────────────────────────────────────────────────────────────────────────
WHAT THIS RELEASE INTENTIONALLY DOES NOT DO
────────────────────────────────────────────────────────────────────────

  - NO new MT helper functions. PART 145-152 is methodology, not
    code. The 44 PART 100-143 helpers + PART 74 micro-roughness /
    striate / punctate / heightToCurvature / cavityDirt helpers +
    PART 74.5 loft / spindle / segmentedAbdomen helpers are
    sufficient.
  - NO new validator flags. PART 145-152 is style-agnostic guidance;
    the 36 anti-pattern guards from PART 32/65/38/39/40/41/42/43/44/
    45/67 still cover validation.
  - NO breaking changes. The v1.29 / v8.21 spec examples still
    load identically. The chip text is the only visible diff
    (plus the title-tag HTML comment for v1.30 / v8.22 reference).

────────────────────────────────────────────────────────────────────────
END OF RELEASE NOTES
────────────────────────────────────────────────────────────────────────
