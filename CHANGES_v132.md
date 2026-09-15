# v1.32 / v8.23 — Hard-Surface / Vehicle Modeling Pipeline (2026-09-15)

This release layers the **HARD-SURFACE / VEHICLE MODELING PIPELINE**
(PART 167-178) on top of the v1.31 / v8.22 spec. PART 167-178 is the
direct response to the procedural-3D-modeling problems documented in
`MODELING_SYSTEM_IMPROVEMENT_REPORT.txt` (2026-09-15) for the Chunky
Sport Motorcycle build. PART 145-152 (perfect-shape pipeline) and
PART 153-166 (image-driven factory defaults) are character-focused;
PART 167-178 is the missing methodology layer for motorcycles / cars
/ planes / props with wheels + suspension + fairings + articulated
mechanical sub-systems.

Unlike v1.30 / v1.31 which were methodology-only, v1.32 ships both
the methodology AND 9 concrete renderer-side helpers exposed on
`window.MT_hardsurface`. PART 167-178 is the first release to add a
new sub-module since PART 100-143 (the 44-Technique Modeling Bundle
in v1.29).

────────────────────────────────────────────────────────────────────────
Why this release exists
────────────────────────────────────────────────────────────────────────
  The Chunky Sport Motorcycle build (per MODELING_SYSTEM_IMPROVEMENT
  _REPORT.txt) encountered 5 root-problem categories that PART
  145-152 did not address:
    1. Primitive interpenetration (z-fighting, internal faces).
    2. Deceptive primitive silhouettes (the "egg visor" phenomenon).
    3. Parenting / transformation hierarchy misalignment (wheels
       wobble when rotated).
    4. Uniform PBR "plastic" shine without micro-roughness textures.
    5. Token-limit / syntax hazards in single-pass 1500+ line TS
       files.
  Plus 4 system-update categories that needed spec-side codification:
    1. Standardized dimension & clearance specification.
    2. Procedural primitive library expansion (4 new helpers).
    3. Enhanced look-dev lighting defaults (3-point studio rig).
    4. Automated self-verification runtime hooks (4 audits).
  PART 167-178 codifies all 9 categories as a single methodology +
  helper bundle.

────────────────────────────────────────────────────────────────────────
What's new in PART 167-178
────────────────────────────────────────────────────────────────────────

  PART 167 — THE 8-STEP VEHICLE PIPELINE (the orchestration)
    Step 1. ANALYZE the reference (proportions / palette / parts).
    Step 2. SKELETON-FIRST (place chassis / steering / swingarm /
            wheel pivot Groups before any geometry).
    Step 3. FAIRINGS & COWLS (PART 170 profile lofting / lathe /
            extrude).
    Step 4. WHEELS & ROTATING ASSEMBLIES (PART 169.3 + 169.4 +
            spin-axis pivot).
    Step 5. SUSPENSION & ARTICULATED LINKS (swingarm + fork +
            brake caliper placement rules).
    Step 6. POSITION ACCESSORIES procedurally.
    Step 7. UNIFORM BEVEL pass (PART 169.1 FilletedBoxGeometry +
            beveled extrude).
    Step 8. LIGHTING + VALIDATE (PART 173 3-point rig + PART 174
            audits).

  PART 168 — DIMENSION & CLEARANCE SPECIFICATION
    168.1 — STRICT BOUNDING BOX SCALE (motorcycle 1.20 × 0.90 ×
            0.50, sport 2.10 × 1.15 × 0.75, car 4.20 × 1.50 ×
            1.80, etc.).
    168.2 — MANDATORY CLEARANCE GAPS (tire↔mudguard 0.015 m,
            rotor↔caliper 0.010 m, fork↔triple clamp 0.008 m,
            exhaust↔swingarm 0.020 m, fairing↔frame 0.012 m,
            wheel↔fender 0.018 m, chain↔sprocket 0.005 m).
    168.3 — GROUND CLEARANCE CONTRACT (Y >= 0.0 after assembly).
    168.4 — WHEELBASE & TRACK declared in pivot-table comment.

  PART 169 — PROCEDURAL PRIMITIVE LIBRARY EXPANSION (4 helpers)
    169.1 — createFilletedBoxGeometry(w, h, d, r, smoothness)
            Replaces hand-built RoundedBoxGeometry + manual scale.
            Use for chassis blocks, fuel tanks, side panels, cube-
            on-wheels toy bodies.
    169.2 — createTaperedTube(points, startR, endR, segments)
            Replaces uniform CylinderGeometry for forks, exhaust
            pipes, shock absorbers, swingarms, drive shafts.
    169.3 — createRimStarPattern(numSpokes, innerR, outerR, thick)
            Replaces N hand-built spoke BoxGeometries. 1 draw call.
            Use for motorcycle wheels, car wheels, gear patterns,
            fan blades.
    169.4 — createBeveledWasher(innerR, outerR, thickness, bevel)
            Replaces hand-built TorusGeometry segments for brake
            discs, gaskets, ring spacers, mounting flanges.

  PART 170 — LATHE & PROFILE EXTRUSION FOR FAIRINGS (5 techniques)
    170.1 — QUADRATIC CURVE PROFILE (simple convex cowls).
    170.2 — BEZIER CURVE PROFILE (complex aerodynamic shapes).
    170.3 — LATHE GEOMETRY (rotationally symmetric parts).
    170.4 — SWEPT EXTRUSION ALONG A CURVE (swept horns / tails).
    170.5 — PARAMETRIC MODIFIER STACK (PART 67 / 100-109
            deformers).
    170.6 — THE "EGG VISOR" PITFALL (fixed by 170.2 + anisotropic
            scaling + perimeter gasket).

  PART 171 — SEEDED MICRO-ROUGHNESS PROCEDURAL TEXTURE
    171.1 — THE mulberry32 PRNG (seed-driven determinism).
    171.2 — createMicroRoughnessMap(size, seed, base, jitter)
            Generates CanvasTexture of value-noise sampled as
            roughness modulation. Apply to EVERY material.
    171.3 — APPLICATION PATTERN (one texture, shared, modulates
            base via standard PBR roughness equation).
    171.4 — WHY DETERMINISTIC PRNG (not Math.random()).
    171.5 — VARIANTS per surface type (painted / chrome / brushed
            / tire / cast iron).

  PART 172 — HIERARCHICAL ARTICULATION TREE
    172.1 — CANONICAL MOTORCYCLE TREE (chassis + steering +
            swingarm pivot trees, with rear / front wheel subtrees
            containing tire + rim + brake disc + brake caliper).
    172.2 — PIVOT OFFSETS = MESH LENGTHS (PART 148.1 applied).
    172.3 — RAKE ANGLE applied ONCE on steering_pivot.
    172.4 — WHY "WORLD ATTACHMENT" IS WRONG (wheels wobble).
    172.5 — CAR / 4-WHEEL TREE (variant).
    172.6 — PLANE / 3D TREE (variant).

  PART 173 — 3-POINT STUDIO LIGHTING RIG
    173.1 — CANONICAL 3-POINT RIG (key + fill + rim + hemisphere
            ambient + contact shadow plane).
    173.2 — WHY 3-POINT (not 1 or 2).
    173.3 — LIGHTING RIG AS A SECOND EXPORT.
    173.4 — SHADOW CAMERA TUNING (tight orthographic frustum).
    173.5 — HDRI / PMREM AUTO-ENABLE FOR METALLIC MATERIALS
            (PART 163 cross-reference).

  PART 174 — AUTOMATED SELF-VERIFICATION RUNTIME HOOKS (4 audits)
    174.1 — validateTriangleBudget(root, { budget: 45000 })
            Walks the tree, sums indexed triangles, logs WARNING.
    174.2 — validateDrawCallCount(root, { budget: 30 })
            Counts every Mesh descendant.
    174.3 — validateBoundingBox(root, { minY: 0.0, maxAbsCoord: 10 })
            Checks ground clearance + part flying-off.
    174.4 — validateGroundClearance(root)
            Convenience wrapper for 174.3 with minY=0.
    174.5 — STANDARD SHIPPING WRAPPER.

  PART 175 — OPTIMAL CODE STRUCTURE & ARCHITECTURAL BLUEPRINT
    175.1 — SECTION 1 — MODULE HEADER & COORDINATE CONTRACT.
    175.2 — SECTION 2 — TYPE DEFINITIONS & CONFIG OPTIONS.
    175.3 — SECTION 3 — PALETTE & PHYSICAL CONSTANTS.
    175.4 — SECTION 4 — REUSABLE GEOMETRY HELPERS.
    175.5 — SECTION 5 — CENTRALIZED MATERIAL REGISTRY.
    175.6 — SECTION 6 — ISOLATED SUBASSEMBLY BUILDERS.
    175.7 — SECTION 7 — PRIMARY FACTORY FUNCTION.
    175.8 — SECTION 8 — DEDICATED LOOK-DEV LIGHTS FACTORY.
    175.9 — WHY THIS STRUCTURE WINS.

  PART 176 — HARD-SURFACE PITFALLS & HOW TO AVOID THEM (10 named)
    1. Primitive interpenetration / clipping (use FilletedBox or
       CSG / SDF union).
    2. The "egg visor" phenomenon (use bezier profile +
       anisotropic scaling).
    3. Parenting / transformation hierarchy misalignment (use
       dedicated pivot Group).
    4. Uniform PBR "plastic" shine without textures (apply PART
       171 microRoughnessMap).
    5. Code token limits / large-file syntax hazards (split into
       8-section architecture).
    6. Lack of native real-time bevel / fillet engine (use PART
       169.1 FilletedBox).
    7. CSG browser overhead (use optical tricks: dark cavities,
       bevel frames, extruded insets).
    8. Normal artifacts on scaled non-uniform geometries (call
       computeVertexNormals after .scale()).
    9. Draw call constraints (merge static parts, use
       InstancedMesh for repeated details).
    10. Lighting rig omitted (ship 3-point rig as second
        factory export).

  PART 177 — CANONICAL WORKED EXAMPLE (Chunky Sport Motorcycle)
    Demonstrates the 8-section architecture (PART 175) with a
    canonical bounding box (2.10 × 1.15 × 0.75 m), full pivot
    tree (PART 172.1), 8 PBR materials with PART 171 micro-
    roughness, and 3-point lighting rig (PART 173).

  PART 178 — 12-STEP SHIP CHECKLIST FOR HARD-SURFACE MODELS
    1. ANATOMY CARD in pivot-table comment.
    2. DIMENSION & CLEARANCE CONTRACT (PART 168).
    3. PIVOT TREE (PART 172).
    4. RAKE ANGLE applied ONCE on steering_pivot.
    5. PRIMITIVE HELPERS (PART 169).
    6. FAIRINGS via PART 170.
    7. MATERIALS with PART 171 micro-roughness.
    8. UNIFORM BEVEL pass.
    9. LOOK-DEV LIGHTS as second export (PART 173).
    10. RUNTIME CONTRACTS wired (tick + sculptRuntime + sockets +
        bound actions).
    11. SELF-VERIFICATION AUDITS (PART 174).
    12. SHIP (single .ts file, deterministic, 8-section arch).

────────────────────────────────────────────────────────────────────────
What's new on the renderer side
────────────────────────────────────────────────────────────────────────

  New sub-module: public/modeling/mt-hardsurface.js (9 helpers)
    PART 169 — 4 procedural primitive helpers
      MT_hardsurface.createFilletedBoxGeometry(w, h, d, r, smooth)
      MT_hardsurface.createTaperedTube(points, startR, endR, segments)
      MT_hardsurface.createRimStarPattern(numSpokes, innerR, outerR, thick)
      MT_hardsurface.createBeveledWasher(innerR, outerR, thickness, bevel)

    PART 171 — seeded micro-roughness procedural texture
      MT_hardsurface.mulberry32(seed)
      MT_hardsurface.createMicroRoughnessMap(size, seed, base, jitter)

    PART 173 — 3-point studio lighting rig
      MT_hardsurface.createHardSurfaceLookDevLights(mode)
        mode = 'studio' (3-point key+fill+rim + hemisphere + contact
        shadow plane) | 'outdoor' (sun + sky)

    PART 174 — 4 self-verification runtime hooks
      MT_hardsurface.validateTriangleBudget(root, opts)
      MT_hardsurface.validateDrawCallCount(root, opts)
      MT_hardsurface.validateBoundingBox(root, opts)
      MT_hardsurface.validateGroundClearance(root)

    PART 175 — 8-section code architecture helper
      MT_hardsurface.createHardSurfaceFactoryShell(spec)

  The new module is loaded via dynamic import after the rest of MT
  (see index.html async loader). It reads from window.MT_noise /
  window.MT_core / window.MT_mesh / window.MT_organic /
  window.MT_materials / window.MT_advanced so it must be loaded
  AFTER those.

  Renderer meta description + meta keywords + #lbl-spec-chip title
  bumped from v1.30 / v8.22 → v1.32 / v8.23 with explicit
  PART 167-178 mention.

  Renderer constant window.lblSpec.VERSION bumped:
    VERSION.ts   : 'v1.30' → 'v1.32'
    VERSION.json : 'v8.22' → 'v8.23'

────────────────────────────────────────────────────────────────────────
FILES TOUCHED
────────────────────────────────────────────────────────────────────────

  - Prompt_To_Ts.txt         (PART 167-178 appended after
                             PART 145-152; PART 167-178 SUMMARY +
                             END markers added; header bumped to
                             v1.32)
  - Prompt_To_Js.txt        (v1.32 / v8.23 de-dup header added;
                             references PART 167-178 in
                             Prompt_To_Ts.txt)
  - Prompt_To_Json.txt      (same as Prompt_To_Js.txt)
  - Image_To_Ts.txt         (v1.32 / v8.23 de-dup header added;
                             END OF PART 153-166 section updated
                             to reference PART 167-178 in
                             Prompt_To_Ts.txt)
  - Image_To_Js.txt         (v1.32 / v8.23 de-dup header added;
                             references PART 167-178 in
                             Prompt_To_Ts.txt)
  - Image_To_Json.txt       (same as Image_To_Js.txt)
  - public/modeling/mt-hardsurface.js
                            (NEW — PART 167-178 helper bundle:
                             4 procedural primitive helpers +
                             micro-roughness procedural texture +
                             3-point studio rig + 4 self-
                             verification audits + 8-section
                             factory shell)
  - index.html              (VERSION constants bumped to v1.32 /
                             v8.23; meta description + keywords +
                             #lbl-spec-chip title bumped; new
                             mt-hardsurface module added to
                             import map + dynamic import loader;
                             topbar comment updated to mention
                             PART 167-178)
  - CHANGES_SUMMARY.md      (new v1.32 / v8.23 prologue prepended)
  - CHANGES_v132.md         (this file)
  - public/modeling/MODELING_TECHNIQUES_v143.md
                            (PART 167-178 cross-reference appended)

────────────────────────────────────────────────────────────────────────
EXPECTED QUALITY IMPROVEMENT ON THE NEXT HARD-SURFACE BUILD
────────────────────────────────────────────────────────────────────────

  - First-pass silhouette match: 0.55 (current) → 0.85+ (target).
  - Manual iteration count: 6-8 (current) → 1-2 (target).
  - "Plastic shine" complaints: every material → 0.
  - "Egg visor" silhouette: ~50% chance → 0%.
  - Z-fighting / clipping on first render: common → rare.
  - ACES warnings on vehicle models: 8-12 → 0-2.
  - Spec file size for the AI: ~6.6 MB → ~2 MB (de-duplicated).

────────────────────────────────────────────────────────────────────────
WHAT THIS RELEASE INTENTIONALLY DOES NOT DO
────────────────────────────────────────────────────────────────────────

  - NO breaking changes. PART 1-166 and the 44 PART 100-143 helpers
    all still work exactly as before. v1.30 / v8.22 and v1.31 /
    v8.22 spec examples still load identically.
  - NO new ACES validators. PART 174 ships runtime hooks that
    complement the 36 existing ACES checks (PART 32/65/38-45/67).
  - NO removal of any prior methodology. PART 145-152 (character
    pipeline) is fully preserved; PART 153-166 (image-driven
    defaults) is fully preserved; PART 167-178 is purely additive
    for hard-surface / vehicle / prop models.

────────────────────────────────────────────────────────────────────────
END OF RELEASE NOTES (v1.32 / v8.23)
────────────────────────────────────────────────────────────────────────
