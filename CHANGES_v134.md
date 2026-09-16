# v1.34 / v8.25 — Chunky 3D Sport Motorcycle Reference Specification (2026-09-16)

This release ships the **CHUNKY 3D SPORT MOTORCYCLE (SUPERBIKE)
TECHNIQUES & TECHNOLOGIES SPECIFICATION** as a canonical top-level
reference document, layered on top of the v1.33 / v8.24 artist-first
form-preservation patch (PART 179). PART 180-189 is the 10-section
**authoritative specification** for how a chunky-mascot / smooth-3D-
vinyl-clay vehicle model should be authored; it generalises beyond the
sport motorcycle to any vehicle whose source reference is
single-image-grounded (`bd5da92411032501f007edb073f06372.jpg`-style).

Unlike v1.32 (which shipped methodology + 9 runtime helpers) and
v1.33 (which shipped methodology + 3 lathed-tube helpers), **v1.34
ships reference specification + 8 builder functions + 1 sculptRuntime
contract + 3 lighting modes** as a single bundled reference. The
reference lives canonically in
`SportMotorcycle_3D_Techniques_Specification.txt` at the repo root
and is mirrored / extended inside the 6 sibling spec docs as PART
180-189 (in `Prompt_To_Ts.txt`).

────────────────────────────────────────────────────────────────────────
Why this release exists
────────────────────────────────────────────────────────────────────────
  PART 177 (v1.32 / v8.23) named the Chunky Sport Motorcycle as the
  canonical worked example but only sketched its bounding box, pivot
  tree, materials, lighting, and validation. PART 179 (v1.33 / v8.24)
  patched the form-preservation regression but left the *architecture*
  at a summary level. There was no single document the AI factory
  could be pointed at that fully specified:

    1.  The 8 modular builder functions (front fork / fairing +
        cockpit / fuel tank / seat + tail / chassis + engine /
        exhaust / swingarm / chunky sport wheel) and their contract.
    2.  The seeded mulberry32 procedural micro-roughness texture and
        its 256×256 CanvasTexture parameters (PART 171 pattern).
    3.  The sculptRuntime contract (nodes / meshes / sockets /
        colliders / destructionGroups / materials / actions /
        animation / vfx) — a structured runtime contract every
        single-image-grounded vehicle should publish.
    4.  The 3 lighting modes (`reference` / `grazing` / `neutral`)
        and the warm-key + cool-fill + rim lighting design.
    5.  The reference-sampled colour palette with hex codes for
        every major body / accent / emissive colour band.
    6.  The deterministic posture contract (axles at Y ≈ 0.30,
        tires touch ground at Y = 0, ~22° rake angle on steering
        pivot, lean-into-turn via steering + drive speed).
    7.  The ~8 500 triangle / 22 draw call / 2048 shadow map
        performance & target metrics.
    8.  The 10-section spec metadata (style label, subject, source
        reference, reference view, LBL version pair).

  The user-supplied
  `SportMotorcycle_3D_Techniques_Specification.txt` provides exactly
  that 10-section specification. PART 180-189 codifies each section
  as its own PART inside the LBL spec system so the AI factory and
  any future chunky 3D sport-motorcycle model can be authored against
  a single source of truth.

────────────────────────────────────────────────────────────────────────
What's new in PART 180-189 (the v1.34 / v8.25 reference spec)
────────────────────────────────────────────────────────────────────────

  PART 180 — THE 10-SECTION SPEC LAYOUT
    PART 180 is the table-of-contents + scope + LBL-version
    contract for the new reference specification. Defines the
    10 numbered sections (Technologies / Modeling Techniques /
    Materials & Shading / Component Architecture / Coordinate
    System / Runtime / Animation / Lighting / Architectural
    Patterns / Performance / Style Metadata) and assigns each
    a dedicated PART 181-189.

  PART 181 — CORE TECHNOLOGIES STACK
    Documents the 6 declared technologies (Three.js / TypeScript
    / ES modules / WebGL / Canvas 2D / deterministic Mulberry32
    PRNG) and the "zero external asset dependency" rule that
    every chunky-mascot reference model must declare. Locks the
    single-import constraint: `import { ... } from 'three'` is
    the only allowed runtime import.

  PART 182 — AUTHORITATIVE GEOMETRY CATALOG
    Maps every chunky-mascot primitive onto a single canonical
    Three.js geometry + the associated PART 145-179 helper:
      - Body panels / fairings / tank / seat / tail / fender
        → THREE.ExtrudeGeometry (bevelEnabled)
      - Forks / rims / hubs / handlebars / exhaust / etc.
        → THREE.CylinderGeometry (rotated per part)
      - Tires / rim lips / springs / gaskets / clamps
        → THREE.TorusGeometry
      - Headlight / mirrors / knee recesses
        → THREE.CapsuleGeometry
      - Bar-end weights
        → THREE.SphereGeometry
      - Exhaust intake transition
        → THREE.ConeGeometry
      - Mirror glass faces
        → THREE.CircleGeometry
      - Radiator grille
        → THREE.PlaneGeometry
      - Exhaust header
        → THREE.TubeGeometry (CatmullRomCurve3)
      - Frame spars / engine / calipers / levers
        → THREE.BoxGeometry
      - 5-spoke alloy rim
        → Parametric spoke pattern (PART 169.3)
      - Deep-dish rim
        → Stepped cylinders + torus lips
      - Brake disc
        → Extruded shape with central hole + mounting bolts
      - Complex 2D profiles + cutouts
        → THREE.Shape + THREE.Path.holes
      - Oval exhaust canister
        → Non-uniform scaling on CylinderGeometry
    Establishes the rule: prefer ExtrudeGeometry / TorusGeometry /
    CapsuleGeometry / TubeGeometry over BoxGeometry on every
    curved or organic body surface; BoxGeometry is reserved for
    straight-edge structural members only (frame, engine, levers,
    calipers).

  PART 183 — REFERENCE MATERIALS & COLOR PALETTE
    Codifies the 3-tier material system:
      - MeshStandardMaterial for the majority of surfaces
        (PART 171 micro-roughness map attached).
      - MeshPhysicalMaterial for windscreen (clearcoat +
        transparency), and any other clear-coated surface.
      - MeshBasicMaterial for the exhaust nozzle interior
        (where no shading is wanted).
    Documents the reference-sampled colour palette (the 6
    colour bands with their hex codes):
      - Fairing Orange (3 hex shades for highlight / mid / shadow)
      - Charcoal (6 hex shades for tires / frame)
      - Accent Silver / Grey (5 hex shades)
      - Headlight White / Warm
      - Taillight Red
      - Shock Spring Yellow
    Locks the procedural micro-roughness texture rules: 256×256
    CanvasTexture, seeded Mulberry32 noise (no real `Math.random`),
    RepeatWrapping with `texture.repeat.set(4, 4)`, NoColorSpace
    on the roughness channel, and the canonical purpose (break up
    artificial plastic highlights per LBL PART 74.2 / 147.1).

  PART 184 — MODULAR COMPONENT ARCHITECTURE
    The 8 builder functions every chunky 3D sport-motorcycle
    must declare:
      - createChunkySportWheel()
      - buildFrontForkAssembly()
      - buildFairingAndCockpit()
      - buildFuelTank()
      - buildSeatAndTailSection()
      - buildChassisAndEngine()
      - buildExhaustSystem()
      - buildRearSwingarm()
    Each function is documented with its inputs (local-frame
    geometry, materials map, options), its outputs (Object3D
    + child mesh registry), and which PART 180-189 + PART 167-179
    techniques it composes. Establishes the factory-pattern
    return shape (root Group + nodes / meshes / sockets /
    colliders / destructionGroups / materials registries).

  PART 185 — AUTHORITATIVE COORDINATE SYSTEM & PROPORTIONS
    Locks the chunky 3D coordinate frame:
      +X = Front (headlight, nose, front wheel)
      -X = Rear  (tail, rear wheel, exhaust tip)
      +Y = Up    (ground plane at Y = 0)
      +Z = Right (exhaust, clutch cover, brake disc)
      -Z = Left
    Locks the origin (0,0,0) = ground plane midpoint between
    front and rear axles, and the deterministic axle-height
    rule (axles at Y ≈ 0.30 so tires touch ground at Y = 0).
    Codifies the explicit rake angle (~22°) on the steering
    pivot and the lean-into-turn dynamics built on steering
    angle + drive speed.

  PART 186 — sculptRuntime RUNTIME CONTRACT
    The 9-key runtime contract every chunky 3D sport-motorcycle
    model publishes on `root.userData`:
      - nodes            : named Object3D hierarchy
      - meshes           : named Mesh registry
      - sockets          : attachment points (headlight,
                           exhaustTip, riderSeat)
      - colliders        : Box3 bounding volumes
      - destructionGroups : fairing / wheel / exhaust groupings
      - materials        : material map
      - actions          : public API methods
      - animation        : animation state
      - vfx              : VFX sockets
    Documents the 5 public Actions API methods:
      - revEngine()
      - steer(angle: number)
      - setDriveSpeed(speed: number)
      - toggleHeadlight(force?: boolean)
      - resetPose()
    Documents the per-frame Tick System (`root.userData.tick`)
    with its 5 responsibilities (steering interpolation / body
    lean / wheel rotation / engine idle vibration / headlight
    breathing pulsation).
    Documents the 6 configurable options (scale / shadows /
    wireframe / fairingColor / frameColor / accentColor /
    driveSpeed / steeringAngle / idleVibration).

  PART 187 — LOOK-DEV LIGHTING SYSTEM (3 MODES)
    Codifies `createSportMotorcycleModelLookDevLights(mode)` and
    its 3 named modes:
      - 'reference' : warm-key + cool-fill + rim, the default
                      look-dev reference illumination.
      - 'grazing'   : low-angle grazing light for inspecting
                      edge contour, fillet quality, micro-
                      roughness behaviour.
      - 'neutral'   : balanced reference illumination for
                      unbiased colour / material evaluation.
    Locks the shadow-map contract: 2048×2048 directional
    shadow map with tuned bias & camera frustum, plus a
    HemisphereLight + AmbientLight base layer.

  PART 188 — ARCHITECTURAL & PERFORMANCE TARGETS
    Locks the 3-rule performance contract:
      - Target triangle count: ~8 500 tris.
      - Shadow casting + receiving on all major meshes.
      - Wireframe diagnostic mode available.
    Codifies the 8 architectural patterns:
      - Factory Pattern
      - Options Object Pattern
      - Runtime Contract / UserData Extension
      - Modular Builder Functions
      - Named Registry Pattern
      - Action / Command Pattern
      - Deterministic Procedural Generation
      - Zero-Dependency Standalone Module

  PART 189 — STYLE METADATA + LBL VERSION STAMP
    Locks the 5-field style / spec metadata pair every chunky 3D
    vehicle should publish on creation:
      - style-label       : 'chunky-mascot'
      - subject           : 'sport-motorcycle'
      - source-reference  : reference image filename
      - reference-views   : 'isometric-front-right'
      - lbl-version       : 'v1.34 / v8.25'
    Codifies the dual-version stamp rule: TS path uses v1.x, JSON-
    JS path uses v8.x; they are always released as a pair.

────────────────────────────────────────────────────────────────────────
What changes on disk (this release)
────────────────────────────────────────────────────────────────────────

  NEW FILES
    CHANGES_v134.md                                       (this file)
    SportMotorcycle_3D_Techniques_Specification.txt        (the user-supplied
                                                           authoritative 10-section
                                                           reference, kept byte-identical
                                                           to the upload and now lives
                                                           at repo root for repo-root
                                                           discoverability)

  UPDATED FILES (PART 180-189 landed at end of PART 179 section,
  before the FINAL END markers; header banner updated with the
  v1.34 / v8.25 marker line)
    Prompt_To_Ts.txt       ← canonical home of PART 180-189
    Prompt_To_Js.txt       ← de-dup cross-ref note to Prompt_To_Ts.txt
    Prompt_To_Json.txt     ← de-dup cross-ref note to Prompt_To_Ts.txt
    Image_To_Ts.txt        ← de-dup cross-ref note to Prompt_To_Ts.txt
    Image_To_Js.txt        ← de-dup cross-ref note to Prompt_To_Ts.txt
    Image_To_Json.txt      ← de-dup cross-ref note to Prompt_To_Ts.txt
    CHANGES_SUMMARY.md     ← new v1.34 / v8.25 entry at top

  RENDERER
    No changes. PART 180-189 is methodology + reference + 8
    modular builder contracts + runtime contract + lighting
    modes — it does NOT add renderer-side helpers. The 9
    helpers shipped in v1.32 (PART 169.1-169.4) and the 3
    helpers shipped in v1.33 (PART 179.x) are reused as-is.

────────────────────────────────────────────────────────────────────────
Compatibility / migration
────────────────────────────────────────────────────────────────────────

  PART 180-189 is purely additive — every model that worked
  under v1.33 / v8.24 still works. No deprecation. No breaking
  changes to PART 1-179. No new helpers in `public/modeling/`.
  The release is reference-specification focused.

  If an author is upgrading a model and wants to adopt the new
  reference spec, the only behavioural requirement is to publish
  the 9-key `sculptRuntime` contract on `root.userData` (PART
  186), name each builder per PART 184, and stamp the 5-field
  style metadata per PART 189.

────────────────────────────────────────────────────────────────────────
Backward compatibility note for sibling spec docs
────────────────────────────────────────────────────────────────────────

  All 6 spec files share a v1.34 / v8.25 banner line. Each of
  Prompt_To_Js.txt / Prompt_To_Json.txt / Image_To_Ts.txt /
  Image_To_Js.txt / Image_To_Json.txt references PART 180-189
  in a de-dup note pointing to Prompt_To_Ts.txt (the canonical
  home of the reference specification, the same relationship
  that PART 167-178 has had since v1.32 and that PART 179 has
  had since v1.33).
