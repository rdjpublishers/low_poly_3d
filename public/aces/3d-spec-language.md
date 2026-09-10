# PART 97 — 3D Spec Language (anyCreature JSON Schema, verified)

> The complete anyCreature spec schema, verified against the actual engine
> source (`engine/core/compile.js`, `relative.js`, `section.js`,
> `anim.js`, `skeleton.js`, `checks.js`). The LBL spec's PART 1 already
> covers the geometry primitives that anyCreature does not need; this
> file gives the **art-direction** side — palette, sections, volumes
> with named concave profiles, parts with the 7 part types, joins, and
> the 3-canonical-animations system.

Verified against the actual engine source so an AI can read this file
and produce a spec that compiles without BLOCK. Every key documented
below is read by `engine/core/compile.js` (or a module it `require()`s).

## The whole spec, on one page

```jsonc
{
  // ── ROOT: identity, scale ────────────────────────────────────────────
  "name":   "quadruped_light",  // archetype name; used in claims, never as display
  "height": 1.45,               // real-world metres, ground to crown — engine verifies ±15%

  // ── PALETTE: one material per part (area rulers identify parts by material name) ──
  "palette": {
    "skin_torso":  { "color": "#8a8a80", "rough": 0.95, "metal": 0    },
    "fur_head":    { "color": "#b5561f", "rough": 0.95                  },
    "fur_tail":    { "color": "#b5561f", "rough": 0.95                  },
    "fur_leg":     { "color": "#5f594b", "rough": 0.95                  },
    "fur_paw":     { "color": "#6b6455", "rough": 0.95                  },
    "nose":        { "color": "#191a1d", "rough": 0.6                   },
    "ear":         { "color": "#8c3c14", "rough": 0.95                  },
    "eye":         { "color": "#f0a51e", "rough": 0.25                  }
  },

  // ── SECTIONS: named 2D outlines (CONCAVE allowed) ─────────────────
  // Referenced from volume profile rows via the `section` field. Built as
  // real geometry — a texture can darken a groove but never moves the
  // silhouette, and the silhouette is what gets read.
  "sections": {
    "flute":   [[1,0],[0.6,0.4],[0.7,0.7],[0.55,0.9],[0.4,0.7],[0.3,0.5]],
    "bark":    [[1,0],[0.95,0.1],[0.7,0.4],[0.6,0.5],[0.5,0.4],[0.45,0.15],[0.5,0]],
    "circle":  [[1,0],[0.7,0.7],[0,1],[-0.7,0.7],[-1,0],[-0.7,-0.7],[0,-1],[0.7,-0.7]]
  },

  // ── SHADING: the L1-L8 stack (PART 92) — settled values by default ──
  "smooth_angle": 50,         // default crease threshold in degrees;
                               // "faceted": true == 0 (every face its own group)
  "shading": { ... },         // L1-L8 stack — see 3d-style-doctrine.md
  "build": "rigid",           // robots/constructs ONLY — lifts the faceted_body BLOCK

  // ── JOINTS: absolute [x,y,z] OR relational {from, fwd, up, side, dir, len, ground} ──
  // y up, z forward, x right. Resolution is order-independent (iterates to fixed
  // point); cycles throw. Idempotent: already-resolved arrays pass through.
  "joints": {
    "Hips":   [0, 0.87, -0.42],                                  // absolute
    "Spine":  { "from": "Hips",  "fwd": 0.47, "up": 0.01 },       // relational
    "Nose":   { "from": "Muzzle","fwd": 0.14, "up": -0.02 },      // forward/up form
    "TailTip":{ "from": "Tail2", "dir": [0,-0.9,-0.35], "len": 0.34 },  // dir+len form
    "LToe":   { "from": "LWrist","fwd": 0.14, "ground": 0.035 }   // ground overrides Y (feet)
  },
  "joints_R": {                 // OPTIONAL: pose-only overrides for mirrored R* joints.
                                // "from" may reference any resolved joint or another R entry.
                                // A FEW CENTIMETRES ONLY (see PART 96 — large offsets shear
                                // the mirrored volume; past 35% the right thigh collapses).
    "RElbow": { "from": "Chest", "side": -0.3, "up": 0.25 }
  },

  // ── CHAINS: ordered list of joint names ─────────────────────────────
  "chains": {
    "body":   ["Rump", "Hips", "Spine", "Chest", "NeckB", "Neck2"],
    "head":   ["HeadRoot", "Skull", "Brow", "Muzzle", "Nose"],
    "tail":   ["TailRoot", "Tail1", "Tail2", "TailTip"],
    "LFront": ["LFrontRoot", "LFrontElbow", "LFrontWrist", "LFrontToe"],
    "LBack":  ["LBackRoot",  "LBackKnee",  "LBackHock",  "LBackToe"]
  },

  // ── ATTACH: every non-root chain → its host joint ─────────────────
  // A chain not in `attach` is a root chain (must have parent < 0 after resolution).
  // A LOOSE joint (not in any chain) must be in `attach` — L* loose joints get
  // an auto R* twin.
  "attach": {
    "head":   "Neck2",
    "tail":   "Hips",
    "LFront": "Chest",
    "LBack":  "Hips"
  },

  // ── MIRROR: chains to auto-duplicate across X ─────────────────────
  // "LFront" → auto-creates "RFront" joints, meshes, and animation tracks.
  // Animation tracks on L* are duplicated to R* with axis flip (ry, rz, tx negate)
  // and an optional `mirror_phase` shift.
  "mirror": ["LFront", "LBack"],

  // ── TOUCH: declared connections MUST overlap or BLOCK ─────────────
  // Symmetric: [["torso","tail"], ["head","neck"]].
  "touch": [["body", "tail"], ["head", "Neck2"]],

  // ── VOLUMES: tube meshes along a chain ─────────────────────────────
  // The compiler reports the accumulated curve bend, the realized plate
  // direction, etc. — read every `info:` line.
  "volumes": [{
    "chain":    "body",                    // required: which chain to build along
    "material": "fur_body",                // required: palette key
    "frame":    "up",                      // "auto" | "up" | "ground"
    "sides":    16,                        // number of wall faces (default 12)
    "ring_step":0.055,                     // arc-length between rings (default auto)
    "caps":     ["dome", "dome"],          // "fan" | "ngon" | "none" | "dome" — per end
    "profile":  [                          // rows: [t, w, h, opts?]
      [0.000, 0.140, 0.160],
      [0.109, 0.185, 0.235, { "bias": -0.1 }],
      [0.357, 0.205, 0.310, { "bias": -0.14 }],
      [0.620, 0.210, 0.340, { "bias": -0.2, "sharp": true }],   // sharp: hard silhouette break
      [0.775, 0.180, 0.250, { "sharp": true }],
      [0.946, 0.163, 0.190],
      [1.000, 0.175, 0.200]
    ],
    "colors": {                            // arc bands (0°=spine, 180°=belly)
      "arcs": [
        { "from": 0,   "to":  52, "color": "#3d382d" },
        { "from": 128, "to": 180, "color": "#c9c1ae" }
      ]
      // gradient + noise are NOT applied here — they are one whole-body pass
      // via the L1-L8 shading stack (PART 92). Declaring them is silently
      // ignored; the engine prints `info: ... colors.gradient/noise are ignored`.
    },
    "smooth_angle": 17,                    // per-volume override; the SHADING lever
    "soft":   false,                       // opt-OUT of soft_mass: this mass really
                                           //   is a smooth organic lump (slug, bladder,
                                           //   droplet). Deliberate, not default.
    "shade":  "flesh",                     // "flesh" | "hard" | "fx" — which L1-L8
                                           //   class this piece belongs to. Default
                                           //   is right almost always; override when
                                           //   a curve is flesh (trunk), or a volume
                                           //   is hardware (armour plate).
    "faceted": false                       // BLOCKED (`faceted_body`): an 800-tri torso
                                           //   becomes 800 shards. Use "sharp" rows or
                                           //   a lower smooth_angle instead.
  }],

  // ── PARTS: 7 supported types (curve, eye, spike, fin, hand, paw, membrane) ──
  "parts": [
    // ── CURVE: curved tapering tube (horn, tusk, trunk, tentacle, whip) ──
    {
      "type":     "curve",
      "host":     "Brow",                  // required: which joint it grows from
      "material": "tusk",                  // required: palette key
      "mirrored": true,                    // auto R-side twin
      "join":     "insert",                // "insert" | "extrude" | "snap" | "place"
      "offset":   [0.06, 0, 0.1],          // world offset from host
      "dir":      [0.3, -0.6, 0.7],        // initial heading
      "sides":    8,                       // default 8
      "faceted":  false,                   // parts may face freely
      "segments": [                        // per-segment length + steering
        { "len": 0.10, "r": 0.035, "ahead": 20 },
        { "len": 0.10, "r": 0.028, "rise":  35 },
        { "len": 0.08, "r": 0.015, "rise":  30, "taper": true }
      ]
      // Per-segment steering keys: rise/fall (pitch world ±Y), ahead/behind
      // (yaw world ±Z), left/right (roll world ±X), coil (swing in the
      // carried plane — rings, spirals), taper (pinch the far end).
      // Steering ADDS UP down the chain. The compiler reports the total:
      //   info: curve '...': steering accumulated to 123° — starts ..., finishes ...
      // Read that line; four mild segments can end up where nobody predicted.
    },

    // ── EYE: both eyes from one entry, ALWAYS on the forward hemisphere ──
    {
      "type":     "eye",
      "host":     "Brow",                  // required
      "material": "eye",
      "size":     0.028,                   // eye radius
      "forward":  [0, 0, 1],               // default +Z
      "up":       [0, 1, 0],               // default +Y
      "spread":   0.15,                    // half-distance between the pair
      "face":     0.9,                     // fwd offset multiplier (default 0.9)
      "dist":     0.3,                     // base distance from host (default 0.3)
      "height":   0,                       // vertical offset
      "anchor":   { "chain": "head", "t": 0.4, "around": 62 }
      // With `anchor`, eyes ride ON the volume surface at around degrees from
      // the host section's spine. Without `anchor`, eyes sit on the forward
      // hemisphere at (host + fwd*face*dist ± side*spread + up*height).
    },

    // ── SPIKE: simple cone, fixed heading ──────────────────────────────
    {
      "type":     "spike",
      "host":     "Spine3",
      "material": "spike",
      "offset":   [0, 0.05, 0],
      "dir":      [0, 1, 0],               // straight up
      "sides":    6,
      "segments": [
        { "len": 0.15, "r": 0.04 },
        { "len": 0.05, "r": 0.005 }
      ]
    },

    // ── FIN: flat plate with thickness, optional anchor to volume surface ──
    {
      "type":      "fin",
      "host":      "Skull",                // required
      "material":  "plate",
      "thickness": 0.02,
      "mirrored":  true,
      "udir":      [0, 0, 1],              // world U axis
      "vdir":      [0, 1, 0],              // world V axis
      "points":    [[0, 0], [0.10, 0.02], [0.05, 0.15]],  // outline in (u,v), CCW
      "anchor":    { "chain": "head", "t": 0.4, "around": 60 },
      "conform":   true,                   // default true: host surface normal wins.
                                           //   Set false to keep the spec's direction.
      "faceted":   true                    // parts may face freely (or set smooth_angle)
      // The compiler prints which side the plate ACTUALLY faces. `around` is
      // read in the host SECTION's frame, NOT world space — on a vertical
      // chain (a leg) the same numbers point elsewhere (90=FRONT, 180=OUTER).
      // info: fin '...' anchored on "head" at around=60 faces up (world normal
      //   0.00, 0.10, 0.99) — verify this is the side you meant.
    },

    // ── MEMBRANE: stretched sheet between rib joint-chains ───────────
    {
      "type":      "membrane",
      "name":      "wing",
      "material":  "wing_skin",
      "mirrored":  true,
      "cusp":      0.25,                   // how deeply the trailing edge scoops
      "along":     8,                      // samples down each rib (default 8)
      "across":    3,                      // columns between neighbouring ribs (default 3)
      "trailing":  "cusp",                 // "cusp" (default) | "flat"
      "ribs":      [                       // leading edge → trailing edge
        { "chain": "LFront"  },
        { "chain": "LFing2"  },
        { "chain": "LFing3"  },
        { "chain": "LTrail"  }
        // OR { "joints": ["Rib1", "Rib2", ...] } for ad-hoc rib lists
        // OR { "chain": "...", "shorten": 0.2 } to pull one rib in
      ]
      // The LAST rib has to come back to the body. Leave it out at the far
      // end and the silhouette never encloses — it reads as spread fingers,
      // not one sheet. The compiler measures the root gap and warns when
      // it exceeds 35% of the membrane's own reach.
    },

    // ── HAND: real palm + 4 fingers + opposable thumb ─────────────────
    {
      "type":     "hand",
      "host":     "LWrist",
      "material": "skin_hand",
      "mirrored": true,
      "size":     0.17,                    // palm length (wrist to knuckles)
      "dir":      [0.1, -0.9, 0.35],       // knuckle direction (where fingers point)
      "up":       [0, 0, 1],               // back of the hand
      "curl":     0.35,                    // 0..1, relaxed (0) to gripping (1)
      "spread":   0.5,                     // finger fan
      "fingers":  4,                       // 1..4 (default 4)
      "thumb":    true,                    // default true
      "fist":     false,                   // true = full fold with thumb wrapped
      "join":     "extrude"
    },

    // ── PAW: flattened ellipsoid pad with flat sole + optional toes ──
    {
      "type":     "paw",
      "host":     "LToe",
      "material": "skin_paw",
      "mirrored": true,
      "size":     [0.30, 0.25, 0.20],      // [length(fwd), width, height]
      "sides":    10,                      // default 10
      "toes":     4                        // 3..5; 0 = pad only
    }
  ],

  // ── ANIMATIONS: always idle + move + attack ────────────────────────
  // rx/ry/rz = rotation degrees around local X/Y/Z (XYZ order).
  // tx/ty/tz = translation offset on local X/Y/Z.
  // Keys are [fraction (0..1), value]; auto-interpolated linearly.
  "animations": {
    "idle": {
      "duration": 1.6,
      "loop":     true,
      "tracks": {
        "Chest": { "ry": [[0, 0], [0.5, 4], [1, 0]] }                 // breathing
      }
    },
    "move": {
      "duration": 0.95,
      "loop":     true,
      "mirror_phase": 0.5,                                            // offset R side by 0.5
      "tracks": {
        "LFrontRoot": { "rx": [[0, -26], [0.5, 28], [1, -26]] },       // L stride
        "LBackRoot":  { "rx": [[0.5, -26], [1, 28], [0.5, 28]] }        // diagonal pair
      }
    },
    "attack": {
      "duration": 0.7,
      "loop":     false,
      "tracks": {
        "Chest": { "rx": [[0, 0], [0.25, -14], [0.5, 22], [1, 0]] },   // wind back, strike
        "Root":  { "tz": [[0, 0], [0.25, -0.1], [0.5, 0.9], [1, 0]] }   //   and LUNGE
      }
    }
  },

  // ── TOP-LEVEL OPTIONS ─────────────────────────────────────────────
  "style":       "heavy",        // ONLY if 1:1 segment rhythm is the design (relaxes 50:50 gate)
  "ao":          true,           // per-vertex AO bake (PART 91); false for debug builds only
  "embed_spec":  true,           // GLB carries its own source spec in asset.extras
  "keep_uv":     false,          // opt-in UV atlas (TEXCOORD_0) for downstream texture bakes
  "qa_isolate":  false           // MID part-isolation builds only: skips whole-body checks
}
```

## Part types — every field, every default

There are exactly 7 part types. Every part reads at minimum `type`,
`material`, and a host (either `host: JointName` or `ribs: [...]` for
membranes). Below is what each one takes, with defaults from the actual
engine source.

### `curve` — horn, tusk, trunk, tentacle, whip

| Field | Required | Default | Notes |
|---|---|---|---|
| `type` | yes | — | `"curve"` |
| `host` | yes | — | joint to grow from |
| `material` | yes | — | palette key |
| `mirrored` | no | `false` | auto R-side twin |
| `join` | no | `null` | `"insert"` / `"extrude"` / `"snap"` / `"place"` |
| `offset` | no | `[0,0,0]` | world offset from host |
| `dir` | no | `[0,0,1]` | initial heading |
| `sides` | no | `8` | wall face count |
| `faceted` | no | `false` | parts may face freely |
| `segments` | yes | — | per-segment `[{len, r, rise/fall/ahead/behind/coil, taper?}]` |

**Steering keys per segment** (degrees, applied on the current heading —
ADDS UP down the chain):

| Key | Effect |
|---|---|
| `rise` / `fall` | pitch heading by N° toward ±Y |
| `ahead` / `behind` | yaw heading by N° toward ±Z |
| `left` / `right` | roll heading by N° toward ±X |
| `coil` | swing heading in the carried plane (rings, spirals) |
| `taper` | pinch the far end (radius → r × 0.3) |

The compiler reports the accumulated total: `info: curve '...': steering
accumulated to 123°`. Read it.

### `eye` — both eyes from one entry

| Field | Required | Default | Notes |
|---|---|---|---|
| `type` | yes | — | `"eye"` |
| `host` | yes | — | joint to anchor on |
| `material` | yes | — | palette key |
| `size` | no | `0.05` | eye radius |
| `forward` | no | `[0,0,1]` | look direction |
| `up` | no | `[0,1,0]` | up direction |
| `spread` | no | `0.15` | half-distance between the pair |
| `face` | no | `0.9` | fwd offset multiplier |
| `dist` | no | `0.3` | base distance from host |
| `height` | no | `0` | vertical offset |
| `anchor` | no | `null` | ride on volume surface (overrides position) |

With `anchor`, eyes ride ON the volume surface at `around` degrees from
the host section's spine. Without it, eyes sit on the forward hemisphere
of the host joint.

### `spike` — simple cone, fixed heading

| Field | Required | Default |
|---|---|---|
| `type` | yes | — | `"spike"` |
| `host` | yes | — | joint |
| `material` | yes | — | palette key |
| `offset` | no | `[0,0,0]` |
| `dir` | yes | — | heading (no steering) |
| `sides` | no | `6` |
| `segments` | yes | — | per-segment `[{len, r}]` — only length and radius |

### `fin` — flat plate with thickness

| Field | Required | Default | Notes |
|---|---|---|---|
| `type` | yes | — | `"fin"` |
| `host` | yes | — | joint |
| `material` | yes | — | palette key |
| `thickness` | no | `0.03` | full plate thickness |
| `mirrored` | no | `false` |
| `udir` | no | `[0,0,1]` | world U axis |
| `vdir` | no | `[0,1,0]` | world V axis |
| `points` | yes | — | outline in (u,v) coords, ≥ 3 points |
| `anchor` | no | `null` | ride on volume surface |
| `conform` | no | `true` | host surface normal wins by default |
| `faceted` | no | `false` |

**The `around` map depends on the chain's frame.** On a body chain
(horizontal) `around` is documented as 0=spine, 90=side, 180=belly. On a
chain running vertically (a leg) the same numbers point elsewhere: 90
comes out FRONT, 180 comes out OUTER. The compiler prints the world
normal the plate ACTUALLY faces. Read that line.

### `membrane` — stretched sheet between rib chains

| Field | Required | Default | Notes |
|---|---|---|---|
| `type` | yes | — | `"membrane"` |
| `name` | no | `"membrane"` | for reports |
| `material` | yes | — | palette key |
| `mirrored` | no | `false` |
| `cusp` | no | `0.25` | trailing-edge scoop depth |
| `along` | no | `8` | samples down each rib |
| `across` | no | `3` | columns between neighbouring ribs |
| `trailing` | no | `"cusp"` | `"cusp"` or `"flat"` |
| `ribs` | yes | — | list of `{chain}` or `{joints}` or `{chain, shorten}` |
| `faceted` | no | `false` |

The LAST rib has to come back to the body. Leave it out at the far end
and the silhouette never encloses — the compiler warns when the root gap
exceeds 35% of the membrane's own reach.

### `hand` — palm + 4 fingers + opposable thumb

| Field | Required | Default | Notes |
|---|---|---|---|
| `type` | yes | — | `"hand"` |
| `host` | yes | — | wrist joint |
| `material` | yes | — | palette key |
| `mirrored` | no | `false` |
| `size` | no | `0.16` | palm length (whole hand scales from it) |
| `dir` | no | `[0,-0.35,1]` (normalised) | knuckle direction |
| `up` | no | `[0,1,0]` | back of the hand |
| `curl` | no | `0.35` | 0..1, relaxed to gripping |
| `spread` | no | `0.5` | finger fan |
| `fingers` | no | `4` | 1..4 |
| `thumb` | no | `true` | set `false` to skip the thumb |
| `fist` | no | `false` | true = full fold, thumb wraps across |
| `join` | no | `null` | verb |

### `paw` — flattened ellipsoid pad with flat sole

| Field | Required | Default | Notes |
|---|---|---|---|
| `type` | yes | — | `"paw"` |
| `host` | yes | — | toe joint |
| `material` | yes | — | palette key |
| `mirrored` | no | `false` |
| `size` | no | `[0.14, 0.10, 0.07]` | `[length(fwd), width, height]` |
| `sides` | no | `10` | longitude count |
| `toes` | no | `0` | 3..5 = visible toes; 0 = pad only |

## Volume profile options — every field, every default

Profile rows are `[t, w, h, opts?]`. The 4th element is an object with
any of these keys:

| Key | Effect |
|---|---|
| `exp` | superellipse exponent: 2 = ellipse, 3-6 = boxy slab, 1.2-1.6 = diamond-ish |
| `bias` | vertical asymmetry: +0.3 = egg (fuller on top), -0.3 = keel (fuller below) |
| `roll` | rotate the section in its plane (radians) |
| `section` | name from `spec.sections` — concave relief (bark flutes, crescents) |
| `sharp` | hard silhouette break; only bites when the radius STEPS across it (≥15%) |

`colors.gradient` and `colors.noise` are NOT applied per-volume — they
are one whole-body pass via the L1-L8 stack (PART 92). Declaring them
silently logs `info: volume "...": colors.gradient/noise are ignored`.

## Joins — the 4 verbs

For every hosted part, pick the join first:

| Verb | Where it goes | Engine rule |
|---|---|---|
| `insert` | part SINKS into the mass (tusks into jaw, horns into skull) | BLOCKs unless base ring is ≥60% buried. Aim `offset` back INTO the host, not at its surface. |
| `extrude` | part GROWS out of the skin (trunk from face, tail spike from tail) | Base centre must sit inside a body. Match base radius to local host radius so the skin flows into the part. |
| `snap` | part LIES ON the surface (plates, scutes, brows) | `anchor` + conform already do this; declare `"join":"snap"` and the engine insists the anchor exists. |
| `place` | deliberately detached (floating rune, orbiting shard) | Rare; say why in `_notes`. |

Undeclared parts still get measured — a `part_seat` warn means a root
may show. The join is also a COLOUR decision: a part that is FLESH of
its host (trunk, tail, brow) continues the host's material colour at its
base; a hard colour break at the junction reads as equipment, not
anatomy.

## Animation tracks — what every key means

| Axis | Effect |
|---|---|
| `rx` / `ry` / `rz` | rotation, degrees, around the joint's local X/Y/Z (XYZ order) |
| `tx` / `ty` / `tz` | translation, metres, on the joint's local X/Y/Z |

Keys are `[fraction, value]` with fraction in `[0, 1]`. Auto-interpolated
linearly. The compiled animation has 25 samples (default) across the
duration. `mirror_phase: 0.5` offsets the R-side auto-twin by half a
cycle. `ry`, `rz`, and `tx` are negated on the mirror (because of the
X-axis reflection).

The engine checks every clip in one pass (`anim_integrity`,
`attack_reach`, `limb_clearance`) and reports all failures at once, so
build-per-clip buys nothing but round-trips.

## Gait templates — a starter pack

- **Biped (2 legs)**: opposite phase — `mirror_phase: 0.5` does it.
- **Quadruped (4 legs)**: DIAGONAL pairs. Front-left moves with back-right;
  offset the back pair's keys by half a cycle relative to the front pair,
  then `mirror_phase: 0.5` staggers left/right.
- **Hexapod / Octoped (6 / 8 legs)**: alternating tripods / tetrapods —
  two leg groups, one group's keys offset half a cycle. Adjacent legs
  must never move in sync, or the creature skates instead of walks.

## The output contract — what `node engine/cli.js` writes

Every GLB this engine produces satisfies the rules below. The same
checks run inside a server or Worker (`harness/glbcheck.mjs` is the
dependency-free import).

- **Two chunks, no trailing bytes.** JSON (`0x4E4F534A`) + BIN
  (`0x004E4942`). No padding after BIN, no third chunk.
- **No external URIs.** No `uri: "external.png"`. Every bufferView points
  into the in-file BIN.
- **No textures.** Colour is per-vertex (`COLOR_0`). No `images`,
  no `textures`, no `samplers` arrays.
- **Semantic material names** — one material per distinct part signature
  (color + rough + metal + doubleSided + hasColor + hasUV). Mirrored
  twins and repeated parts share a palette entry; without merging every
  mesh would ship its own primitive+material copy (the 67-material class).
- **Convention bone names** — exported bones starting with L/R conform to
  `^[LR][A-Z][A-Za-z]*\d+[A-Z][a-z]$` (the `LArm1Sh` pattern). Internal
  spec names stay authoring-side; this map is applied only at GLB-write
  time, so animations and skins (index-based) are untouched.
- **Embedded source_spec** — `asset.extras.source_spec` is the PRISTINE
  authored spec (re-editable, re-compilable). Plus `parts` (manifest of
  every volume + part) and `checks` (per-check pass/warn summary).
  `embed_spec: false` opts out.
- **Mesh name `creature` / skin name `creature_rig`** — convention for
  downstream tools that scan for it.

## What the LBL factory should output

For creature subjects (quadruped, humanoid, bird, fish, insect, snake)
the LBL factory should output anyCreature-compatible `volumes` and
`parts`. For non-creature subjects (furniture, buildings, vehicles,
weapons) fall back to the primitive-based approach (PART 67-71 +
modifier stack). The LBL factory's existing PART 1 already covers the
geometry primitives anyCreature does not need.

The 3D Modelling `__buildCreatureMesh(spec)` adapter (PART 90.6) compiles
an anyCreature spec into a Three.js scene in the browser. Reference
example: `example/wolf.json` is 2,211 vertices, 31 joints.

## Credits

- **Ariescar (anyCreature 1.3.1, MIT)** — the spec language, the 7 part
  types, the 4 join verbs, the 3 canonical animations, the profile
  semantics, the section vocabulary, the gait templates, the output
  contract. All original to that project.
- **Björn Ottosson** — OKLab.
- **RDJ Publishers** — ported to the LBL spec as PART 97. Verified
  against the engine source on 2026-09-10.
