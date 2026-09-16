# v1.33 / v8.24 — Artist-First Geometry Flow & Form-Preservation Patch (2026-09-16)

This release layers the **ARTIST-FIRST GEOMETRY FLOW & FORM-PRESERVATION
PATCH** (PART 179) on top of the v1.32 / v8.23 hard-surface pipeline
(PART 167-178). PART 179 is the direct response to the "Before vs.
After" visual regression documented in
`SYSTEM_UPGRADE_SPECIFICATION.txt` (2026-09-16) in which models
generated under v1.32 lost their flowing organic fairings and
degraded into flat-plate geometric blocks.

v1.32 / v8.23 shipped the missing VEHICLE / PROP / HARD-SURFACE
methodology layer — pivot trees, procedural primitive helpers, micro-
roughness PBR, and a 3-point studio rig. v1.33 / v8.24 ships the
PATCH that prevents those helpers from being applied so broadly that
silhouette fidelity collapses.

Unlike v1.32 (which shipped both methodology + 9 runtime helpers),
v1.33 is METHODOLOGY + AMENDMENT FOCUSED. It reuses the v1.32
runtime bundle and adds 3 new procedural helpers
(`createLathedTireGeometry` / `createSweptTube` / `createExhaustCanister`)
plus the OVERRIDING Hierarchy of Fidelity directive that governs
the entire PART 167-179 section.

────────────────────────────────────────────────────────────────────────
Why this release exists
────────────────────────────────────────────────────────────────────────
  The Chunky Sport Motorcycle build (per SYSTEM_UPGRADE_SPECIFICATION
  .txt) post-v1.32 produced models that looked WORSE than the v1.30
  reference. The "Before" build had flowing organic fairings, a
  dynamic integrated tank/seat, contoured tire crowns, and visible
  wheel depth. The "After" build was flat-plate geometric blocks,
  segmented boxy fairings, basic cylinder wheels, and visible
  disjointed subassembly boundaries. The model degraded from an
  elegant unified industrial sculpt into an exploded parts diagram.

  Root causes diagnosed in SYSTEM_UPGRADE_SPECIFICATION.txt:
    1. Over-application of `createFilletedBoxGeometry`. A box with
       rounded corners is still fundamentally a cube. The LLM factory
       substituted FilletedBoxGeometry for EVERY component — fuel
       tanks, tail cowls, nose cones, side fairings, tires — none of
       which can be conveyed with box geometry.
    2. Disconnected subassembly slicing. Building geometry strictly
       inside isolated pivot groups without continuous contour
       alignment introduced visible gaps or flat boundary interfaces.
    3. Wheels reverting to primitives. Plain CylinderGeometry wheels
       with parallel walls and razor-sharp rim edges ruined the
       athletic stance.

  v1.33 / v8.24 fixes all 3 root causes via:
    - The Hierarchy of Fidelity (PART 167 top) — a 5-tier priority
      ladder where VISUAL SILHOUETTE & CONTINUOUS SURFACE FLOW is
      the absolute priority, sitting above COMPOUND CONTOUR
      PROCEDURAL TECHNIQUE, PBR TACTILE MATERIAL SHADING,
      MECHANICAL SKELETON & PIVOT HIERARCHY, and CODE MINIFICATION
      & PARAMETRIC HELPERS. When two rules conflict, the higher
      tier wins.
    - RULE 167.1.1 — Form Preservation Mandate (PART 167 STEP 1).
    - RULE 169.1.2 — Filleted Box Usage Constraint (PART 169.1).
    - RULE 169.3.2 — Mandatory Wheel Profile Revolution (PART 169.3).
    - PART 172.1.1 — the Body_Fairings & FuelTank continuous envelope
      group.
    - PART 179.1-179.10 — 10 new technical PARTs covering the
      procedural primitives, the form-preservation recipes, and the
      generator conflict resolutions.

────────────────────────────────────────────────────────────────────────
What's new in PART 179 (the v1.33 / v8.24 patch)
────────────────────────────────────────────────────────────────────────

  THE HIERARCHY OF FIDELITY (top of PART 167)
    1. VISUAL SILHOUETTE & CONTINUOUS SURFACE FLOW (Absolute Priority)
    2. COMPOUND CONTOUR PROCEDURAL TECHNIQUE (Lathe / Bezier)
    3. PBR TACTILE MATERIAL SHADING (Micro-Roughness)
    4. MECHANICAL SKELETON & PIVOT HIERARCHY
    5. CODE MINIFICATION & PARAMETRIC HELPERS
    Rule 167.0.1 — Structural pivots MUST be invisible structural
      parents. They MUST NEVER dictate or chop up the continuous
      aesthetic lines of exterior bodywork.
    Rule 167.0.2 — FORBIDDEN FAIRING GEOMETRY. BoxGeometry,
      CylinderGeometry, and FilletedBoxGeometry are STRICTLY
      FORBIDDEN for primary aerodynamic cowls, fuel tanks,
      fairings, visors, and tires.

  RULE 167.1.1 — THE FORM PRESERVATION MANDATE (PART 167 STEP 1)
    Under no circumstances may the skeletal pivot tree disrupt the
    continuous, sculpted lines of vehicle bodywork. When modeling
    vehicles from images, prioritize compound curvature (lathed
    profiles, bezier-curved extruded shapes, swept tubes) over
    multi-box approximations. A model that has correct pivot names
    but looks like assembled boxes is REJECTED. Form flow and
    silhouette fidelity come first.

  RULE 169.1.2 — FILLETED BOX USAGE CONSTRAINT (PART 169.1)
    `createFilletedBoxGeometry` is strictly classified as an
    INTERNAL STRUCTURAL primitive. It is PROHIBITED for fuel tanks,
    aerodynamic fairings, streamlined cowls, aerodynamic visors,
    and tires. The v1.32 listing "Use for: chassis blocks, fuel
    tanks, side panels, electronics housings, cube-on-wheels toy
    bodies" has been AMENDED in v1.33 — fuel tanks and side panels
    are EXTERIOR and MUST use PART 170 / PART 179 techniques.

  RULE 169.3.2 — MANDATORY WHEEL PROFILE REVOLUTION (PART 169.3)
    A tire is NEVER a plain CylinderGeometry. The rim star pattern
    is only HALF of a wheel. Every wheel MUST feature a LATHED tire
    with (1) toroidal crown, (2) inward tapered sidewalls, and
    (3) stepped bead. Flat cylindrical wheels FAIL automated audit
    E41 (PART 174.3 "loft trap-warnings" / "distinct-Z test").

  PART 172.1.1 — BODY_FAIRINGS & FUELTANK ENVELOPE GROUP
    The visible exterior bodywork is gathered in ONE named Group
    (Body_Fairings & FuelTank) so that the tank flows visually into
    the seat and side panels without seams, body color / material
    variants apply to one node, and LoD swaps hide the whole
    envelope as one mesh.

  PART 179.1 — THE BOUNDARY LINE
    Canonical USE / DO NOT USE table for createFilletedBoxGeometry.
    USE ONLY FOR: engine crankcases, cylinder heads, transmission
    blocks, brake calipers, triple-clamp brackets, license brackets,
    battery boxes, radiators, structural frame cross-members,
    internal mechanical machinery and brackets.
    DO NOT USE FOR: visible exterior body panels, cowls, fairings,
    fuel tanks, visors, windshields, tail cowls, nose cones,
    fenders — these MUST use PART 170 (Shape + bezierCurveTo +
    ExtrudeGeometry / LatheGeometry / swept extrusion).

  PART 179.2 — LATHED TIRE PROFILE
    Canonical helper:
      `MT_hardsurface.createLathedTireGeometry(outerR, width,
      crown, taper, bead, segments)` → BufferGeometry
    Built around `THREE.LatheGeometry` from a `Vector2(r, z)`
    profile with: toroidal crown (parabolic or sinusoidal curve),
    inward tapered sidewalls (sidewalls pinch inward toward the
    rim), stepped bead (inner lip where tire meets the wheel rim).

  PART 179.3 — BEZIER-EXTRUDE AERODYNAMIC COWLS
    Perfect Shape Technique for fuel tanks, side cowls, nose cones,
    tail cowls, and aerodynamic fairings. Trace the front profile
    using cubic Bezier curves (`shape.bezierCurveTo(cx2, cy2, cx3,
    cy3, x2, y2)`), extrude with subtle thickness (0.04 - 0.10 m)
    and beveled edge.

  PART 179.4 — CATMULL-ROM SPLINE SWEEPS FOR EXHAUSTS / TUBES / FORKS
    Sample 4 to 8 3D waypoints → `new THREE.CatmullRomCurve3(
    waypoints, false, 'centripetal')` → `new THREE.TubeGeometry(
    curve, 24, radius, 12, false)`. For the muffler canister
    itself: LatheGeometry (conical inlet taper, cylindrical body,
    beveled twin-nozzle end-cap).
    Canonical helpers:
      `MT_hardsurface.createSweptTube(waypoints, radius, segments,
        radialSegments, type)` → BufferGeometry
      `MT_hardsurface.createExhaustCanister({ inletR, bodyR,
        bodyLength, nozzleR, tipBevel, segments })` → BufferGeometry

  PART 179.5 — SHAPE HOLES & MULTI-AXIS EXTRUSIONS FOR DUCTS / VENTS
    Do NOT use runtime CSG. Draw the 2D outer fairing polygon using
    `THREE.Shape()`. Draw the inner intake vents as counter-clockwise
    `THREE.Path()` loops. Push into `shape.holes.push(ventPath)`.
    Extrude with `bevelEnabled: true, bevelSegments: 3,
    bevelSize: 0.02` — single watertight mesh with built-in beveled
    duct lips that catch specular highlights cleanly.

  PART 179.6 — FIXING THE "EGG VISOR" (extends PART 170.6 / 176.2)
    Bezier profile front arch + extrude thickness 0.03 - 0.05 m +
    rake backward 40° - 55° (v1.33 raises minimum from v1.32's 37°)
    + `MeshPhysicalMaterial` with transmission 0.45, roughness 0.20,
    thickness 0.08 + thin dark rubber perimeter gasket (TorusGeometry
    scaled non-uniformly to (1.0, 0.85, 1.0)).

  PART 179.7 — SINGLE-FILE SELF-CONTAINMENT VS MT_hardsurface
    LBL v1.32 PART 1.1 demands zero relative imports for shippable
    factory files, yet the renderer exposes PART 169 helpers via
    `window.MT_hardsurface`. Resolution:
      - For STANDALONE factory files (e.g. `createSportbikeModel.ts`)
        INLINE the 4 PART 169 helpers + `mulberry32` + the 3 PART
        179 helpers (createLathedTireGeometry / createSweptTube /
        createExhaustCanister) directly.
      - When running INSIDE the full studio viewer environment,
        BIND to `window.MT_hardsurface` as a performant fallback
        via the canonical `if (typeof window.MT_hardsurface !==
        'undefined')` short-circuit.

  PART 179.8 — TS1117 DUPLICATE-KEY FIX FOR ExtrudeGeometryOptions
    When generators merge bevel options with extrude parameters,
    accidental duplicate keys (e.g. `steps: 1` appearing twice)
    cause fatal compiler breaks under TypeScript strict mode
    (`TS1117`). Standard Fix: `Object.freeze(...)` the canonical
    `ExtrudeGeometryOptions` constant OR use a typed helper
    interface, OR funnel every PART 179.3 / PART 179.5 extrusion
    through ONE factory function `makeFairingGeometry(shape, depth,
    bevel)` that internally owns the single canonical options
    object.

  PART 179.9 — SOCKET ATTACHMENT HIERARCHY (extends PART 172 for
                runtime sockets)
    Sockets declared in `userData.sculptRuntime.sockets` MUST NOT
    be loose groups parented to root. They MUST be parented to
    their operational anchor:
      `Socket_Headlight`        → `NoseCowl` or `SteeringHeadPivot`
      `Socket_ExhaustTip`       → `ExhaustMufflerCanister`
      `Socket_RiderHips`        → `RiderSeatGroup`
      `Socket_FuelCap`          → `FuelTank` (which is in the
                                   `Body_Fairings & FuelTank`
                                   envelope group per PART 172.1.1)
      `Socket_MirrorLeft` /
      `Socket_MirrorRight`      → `ClipOnHandlebars` (under
                                   `SteeringHeadPivot`)

  PART 179.10 — PART 178 SHIP-LIST ADDENDUM
    Replace PART 178 STEP 6 ("FAIRINGS via PART 170") with the
    extended form that mentions PART 179.2 / 179.4 / 179.5.
    Add STEP 12.5 "FORM-PRESERVATION AUDIT" — walk the .ts factory
    top-down and verify every visible exterior surface was
    authored via PART 170 / PART 179 (bezier / lathe / swept
    extrusion), NOT a box or cylinder.

────────────────────────────────────────────────────────────────────────
What's new on the renderer side
────────────────────────────────────────────────────────────────────────

  New sub-module surface: public/modeling/mt-hardsurface.js
    + 3 procedural primitive helpers (PART 179):
      MT_hardsurface.createLathedTireGeometry(outerR, width, crown,
        taper, bead, segments=24) → BufferGeometry
      MT_hardsurface.createSweptTube(waypoints, radius, segments=24,
        radialSegments=12, type='centripetal') → BufferGeometry
      MT_hardsurface.createExhaustCanister({
        inletR=0.045, bodyR=0.075, bodyLength=0.32, nozzleR=0.038,
        tipBevel=0.012, segments=32 }) → BufferGeometry

  Renderer constants bumped:
    VERSION.ts   : 'v1.32' → 'v1.33'
    VERSION.json : 'v8.23' → 'v8.24'

  Renderer meta description + meta keywords + #lbl-spec-chip title
  bumped from v1.32 / v8.23 → v1.33 / v8.24 with explicit PART 179
  mention (Hierarchy of Fidelity + RULE 167.1.1 / 169.1.2 / 169.3.2
  + 10 new PARTs 179.1-179.10 + 3 new helpers + Body_Fairings
  envelope group).

────────────────────────────────────────────────────────────────────────
FILES TOUCHED
────────────────────────────────────────────────────────────────────────

  - Prompt_To_Ts.txt         (header bumped v1.32 → v1.33; PART 167
                             patched with Hierarchy of Fidelity +
                             RULE 167.0.1 / 167.0.2 + RULE 167.1.1 in
                             STEP 1; PART 169.1 patched with RULE
                             169.1.2; PART 169.3 patched with RULE
                             169.3.2; PART 172.1 restated around
                             Body_Fairings & FuelTank envelope group
                             + new PART 172.1.1; NEW PART 179 added
                             at the end covering PART 179.1-179.10 +
                             PART 167-179 SUMMARY + END OF PART
                             167-179 marker; v1.32 / v8.23 cross-
                             reference paragraph updated to mention
                             v1.33 / v8.24 PART 179)
  - Image_To_Ts.txt          (header bumped v1.32 → v1.33; PART 179
                             cross-reference line added to the header
                             preamble; v1.32 / v8.23 DE-DUP NOTE
                             updated to mention PART 179; v1.32 /
                             v8.23 cross-reference paragraph updated
                             to mention v1.33 / v8.24 PART 179)
  - Prompt_To_Js.txt         (v1.33 / v8.24 de-dup header added;
                             references PART 179 in Prompt_To_Ts.txt)
  - Prompt_To_Json.txt       (same as Prompt_To_Js.txt)
  - Image_To_Js.txt          (v1.33 / v8.24 de-dup header added;
                             references PART 179 in Prompt_To_Ts.txt)
  - Image_To_Json.txt        (same as Image_To_Js.txt)
  - public/modeling/mt-hardsurface.js
                            (NEW — 3 PART 179 helpers:
                             createLathedTireGeometry /
                             createSweptTube /
                             createExhaustCanister; existing v1.32
                             PART 169 + PART 171 + PART 173 + PART
                             174 + PART 175 surface preserved
                             exactly)
  - index.html              (VERSION constants bumped to v1.33 /
                             v8.24; topbar comment updated to
                             mention PART 179; HTML comment
                             preamble updated to mention PART 179;
                             meta description + keywords + spec
                             chip title updated to mention PART
                             179 + Hierarchy of Fidelity + RULE
                             167.1.1 / 169.1.2 / 169.3.2 + Body_
                             Fairings envelope group + 10 PARTs
                             179.1-179.10 + 3 new helpers)
  - CHANGES_SUMMARY.md       (new v1.33 / v8.24 prologue prepended)
  - CHANGES_v133.md          (this file)
  - public/modeling/MODELING_TECHNIQUES_v143.md
                            (PART 179 cross-reference appended)

────────────────────────────────────────────────────────────────────────
EXPECTED QUALITY IMPROVEMENT ON THE NEXT HARD-SURFACE BUILD
────────────────────────────────────────────────────────────────────────

  - First-pass silhouette match: 0.55 (v1.32 baseline) → 0.85+
    (v1.33 target).
  - Manual iteration count: 6-8 (v1.32 baseline) → 1-2 (v1.33
    target).
  - "Plastic shine" complaints: every material → 0 (PART 171 micro-
    roughness retained).
  - "Egg visor" silhouette: ~50% chance → 0% (PART 179.6 fix).
  - "Blocky fairing" regression: ~50% chance → 0% (Hierarchy of
    Fidelity + RULE 167.1.1 + RULE 169.1.2).
  - "Flat cylinder wheel" regression: ~30% chance → 0% (RULE
    169.3.2 + PART 179.2 createLathedTireGeometry helper).
  - "Disjointed subassembly boundaries" regression: ~40% chance →
    0% (PART 172.1.1 Body_Fairings & FuelTank envelope group).
  - Z-fighting / clipping on first render: rare (retained from
    v1.32).
  - ACES warnings on vehicle models: 0-2 (retained from v1.32).
  - Spec file size for the AI: ~2 MB (v1.32 de-dup baseline) →
    ~2.2 MB (PART 179 amendment).

────────────────────────────────────────────────────────────────────────
WHAT THIS RELEASE INTENTIONALLY DOES NOT DO
────────────────────────────────────────────────────────────────────────

  - NO breaking changes. PART 1-178 and the 44 PART 100-143
    helpers all still work exactly as before. v1.32 / v8.23 and
    earlier spec examples still load identically.
  - NO new ACES validators. The existing 50 hard anti-pattern
    guards (E1-E50) plus the PART 174 runtime audits cover the
    PART 179 contract — flat cylindrical wheels now FAIL E41
    (distinct-Z test / loft trap-warnings) per RULE 169.3.2, and
    Socket_Headlight parented to root now FAILS E45 (assembly
    contract) per PART 179.9.
  - NO removal of any prior methodology. PART 167-178 is fully
    preserved; PART 145-152 is fully preserved; PART 153-166 is
    fully preserved; PART 100-143 is fully preserved; PART 74
    procedural texturing is fully preserved.
  - NO removal of FilletedBoxGeometry. It is RE-CLASSIFIED in
    PART 169.1.2 as an internal structural primitive only —
    chassis blocks, brackets, engine cases, transmission blocks,
    brake calipers, etc. still legitimately use it.

────────────────────────────────────────────────────────────────────────
END OF RELEASE NOTES (v1.33 / v8.24)
────────────────────────────────────────────────────────────────────────
