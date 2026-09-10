# PART 98 — 3D Pipeline Cards (anyCreature 5-stage)

> The full anyCreature 5-stage pipeline (START → LOW → MID → HIGH → SHIP),
> ported as a reference for the LBL spec. The LBL factory already has a
> prompt-to-spec and image-to-spec flow; this file gives the **stage
> gates** that the spec must clear before the next stage opens.

The pipeline is:

```
order → ONE required question → silhouette brief → LOW: design FREE + two gates
     → MID (2 rounds) → HIGH (1 round) → SHIP (scripted delivery + closing)
```

Each stage has a clear gate; the gate is MECHANICAL (machine-checkable)
where possible, HUMAN (LLM-judged) where it must be. The mechanical
checks are listed in `aces-checks.js`; the human gates are listed below
in full so an AI can act on them.

## Stage 0 — START (always-on rules)

### The doctrine in one paragraph

The model designs BOLDLY when left free, and every attempt to teach it
design upfront makes the output tamer. The harness ships a **clean
painter and a strict inspector**: the creation side gets only the
order, the engine syntax, and a short pit-map of engine-local traps;
ALL quality control lives in gates read by context-free reader agents,
never self-graded. Form beats obedience, everywhere.

### Iron laws (always on)

1. **Form beats obedience.** Every rule exists to protect form quality;
   if following a rule would make the creature tamer, the rule loses.
   Edits whose only purpose are to make a number match a declaration
   are forbidden.
2. **You never grade your own thumbnails.** Every gate is read by a
   context-free agent who has never seen the order. Its verified
   verbatim answer is the verdict.
3. **Same symptom failed twice = no third tweak.** A round tests
   THREE ideas, not one. Three builds cost four seconds more than one;
   three separate reads cost three times a read.
4. **The signature part gets real geometry at LOW.** Budget follows
   6:3:1: the 6-level element gets 6-level geometry.
5. **Materials are named per PART** (`skin_torso`, `fur_leg`, `eye`,
   `tusk`…) — area rulers identify parts by material name.
6. **Engine floors block builds.** `BLOCK:` lines say exactly what;
   `warn:` lines are measures for your judgment; `info:` lines narrate
   what the compiler actually did.
7. **The customer gets exactly ONE question.** Ask card 01's question,
   alone, as the first thing you send. Never ask about cost, scope,
   publishing, or the delivery format. Decide those yourself.
8. **Nothing is uploaded without explicit yes, in this session.** The
   share question comes after the creature exists, in card 04's
   closing dialogue.
9. **One creature, one agent.** The reader is the ONLY subagent. The
   cost of a split is how much understanding the next agent has to
   rebuild.
10. **Write state down every round; never rely on your own memory.**

## Stage 1 — LOW (silhouette, big forms, 2 gates)

LOW is the stage that carries the visual load. By the end of LOW, every
big shape is decided. The two gates are mechanical (machine-checkable
counts) AND human (blind-read nouns). A round that satisfies the
mechanical but loses the human is still a FAIL.

### ONE required question (card 01 §1)

The customer gets exactly ONE question, sent alone, as the first
message. Which of the two it is depends on what the order committed
to:

- **Thin order** ("a dragon", "a big monster") — offer three
  directions, one line each, on three different axes:
  1. A direction driven by **MASS** — what is oversized, what is starved
  2. A direction driven by a **WEAPONISED PART** — what it fights with
  3. A direction driven by **ANATOMY BROKEN ON PURPOSE** — what is where
     it should not be

  > Three ways I could take this — pick one, or say "you choose":
  > 1. <a mass-driven direction>
  > 2. <a weaponised-part direction>
  > 3. <an anatomy-broken-on-purpose direction>

  No answer, or "you choose" → take the first and start. Never ask a
  second time, never ask them to confirm the expansion afterwards.

- **Specific order** (it already names species, colour, parts, weapons)
  — the risk is not vagueness, it is that everything they listed
  competes to be the star. Ask which one wins:
  > You mentioned <A>, <B> and <C> — which should be the thing people
  > notice first?

  That answer becomes the signature part. No answer → pick the most
  unusual of the ones they named (not the most expected).

### The brief — 9 slots (card 01 §2)

Expand the order yourself, in one pass, before you build. Do not show
the expansion to the person and do not ask them to approve it. They
asked for a creature, not for homework; the gates catch a wrong guess,
not a confirmation step.

| Slot | What it must say | Who reads it later |
|---|---|---|
| `identity` | "reads as: X" — the noun a stranger should say | Gate 1 (3 of 4 views, identity view mandatory) |
| `feel` | one phrase: heavy / fast / sharp / floating | the 24px read |
| `height` | real-world metres | `size` gate (±15%, engine BLOCKs) |
| `signature` | ONE named part, and which view carries it | `part_exists`, `part_signature`, MID whitelist, HIGH main colour |
| `mass hierarchy` | which masses are primary / secondary / detail | `share_hierarchy` (6:3:1) |
| `two focals` | the dominant one and the runner-up | `focal_contrast` (≥2× apart) |
| `stance` | how the weight is planted; what is asymmetric | `balance`, bind pose IS the pose |
| `attack` | what strikes, and what lunges forward | `attack_reach` (½ body span or BLOCK) |
| `value plan` | dominant COLOUR, secondary, accent <5%, dark or light | `saturation_area`, brightness floor |

**Two rules that decide whether the expansion is worth anything:**

1. **Discard your first three ideas.** The first things that arrive for
   any creature word are the tropes everyone has seen. Name them to
   yourself, throw them out, and take the fourth. A brief that could
   have been written without the order in front of you has failed.
2. **Commit to ONE exaggeration and pay for it everywhere.** Pick a
   single extreme — a proportion, a weaponised part, a broken symmetry
   — and let it distort the hierarchy, the stance, the attack and the
   colour plan. Nine moderate slots make a shapeless creature; eight
   ordinary slots serving one violent decision make a creature people
   remember.

**Two slots must also name the CHAINS they mean:**

```
| signature  | the pair of giant pincers — carried by the SIDE view  chains: LClaw, RClaw |
| two focals | dominant = the right pincer · runner-up = the boulder in its net  chains: RClaw, net |
```

You invent the names; nothing checks whether they are good ones. What
is checked is that the spec you build at r1 actually contains them.

### Engine-local traps (pit-map, NOT design rules)

- **Anatomically independent masses get their OWN volumes**, overlapping
  their neighbours (mane, shoulder, chest slab, head). Radius wiggle
  inside one tube reads as soft sausage, not as blocks.
- **NO ROUNDED SAUSAGES — and the default IS a sausage.** A volume's
  wall angle is `360/sides`, and `smooth_angle` (default 50) welds
  every edge under it: 9 sides is 40°, 16 sides is 22°. Leave the
  default on and nothing on that mass can break. The engine BLOCKs it
  (`soft_mass`). The lever is `smooth_angle` ON THE VOLUME, set under
  its wall angle.
- **Wings spread flat in one plane vanish from the side** — give them
  sweep-back. Every view needs a designed silhouette; a straight-line
  view is a dead view.
- **The bind pose IS the pose.** Plant the weight.
- **Curved things (tusks, trunks, horns) are `curve`; membranes (wings,
  frills, sails) are `membrane`** — don't fake either with straight
  spikes or flat plates.
- **Parts meet the body by a JOIN, not by luck.** `insert` (base
  buried), `extrude` (grows out of skin), `snap` (rides an anchor),
  `place` (deliberately detached).
- **Bends belong to JOINTS.** An arm that must flex needs its elbow
  joint placed where the bend lives.

### Gate 1 — RECOGNISED (3 of 4 views, identity view mandatory)

Spawn a context-free reader agent with exactly this task:

> Look at these images one at a time, answering only from what you SEE.
> 1) [thumb24 of the identity view] What FEELING does this shape give —
>    heavy/stable, fast/agile, sharp/menacing, floating? One phrase.
> 2-5) [thumb48 of front / side / top / hero] **Name your FIVE best
>    guesses for what this is, most likely first.** Then: what parts
>    can you make out, and does this view read as a build or as an
>    abstract shape/nothing?

**The verdict is SCORED, not argued:**

| Rank reached | Views needed to pass |
|---|---|
| 1st guess | 1 view |
| 2nd | 2 views |
| 3rd | 3 views |
| 4th | 4 views |

5th and beyond does not count. **The requirement drops by one view per
repair round** (never below one), because another round costs more
than the last while buying no more information.

Synonyms count (buffalo for bison, wyrm for dragon). "A fox" plus four
other canines when the order said dragon is still a failed gate. Feel
mismatch → repair. Budget: 2 repair rounds, then iron law 3 (concept
restart).

### Gate 2 — PUNCHIER (after Gate 1)

LOW is not done when it's recognisable — it's done when it's
EXAGGERATED. A push may ONLY make the silhouette bolder: push the
extreme proportion further, harden breaks, deepen negative space,
exaggerate the signature. **Build THREE different pushes and judge
them together against the incumbent in ONE round.** Incumbent wins =
LOW locks where it is, done. A push wins and three views still read
(the identity view among them) = promote it, skeleton and main
volumes lock.

**ONE round. If the incumbent wins, this gate is FINISHED — do not run
a second.** A second round asks the same question with three more
guesses and gets the same answer.

## Stage 2 — MID (parts, flat colour, ZERO new bones)

Output: every part — ears, horns, claws, eyes, fins, shell spikes, paws
— riding bones LOW already placed, or anchored to volume surfaces. No
material detail, no animation. MID's question is: **do the key parts
READ as what they are?**

### Author the WHOLE part set in one pass

Do not add parts one at a time and rebuild after each. Write every
part, run one build, read the whole BLOCK list — the engine reports
ALL failures at once, fix them all in one edit, and build again.

**Mirrored structure is not authored twice.** `"mirror": ["LArm"]`
generates the right side; hand-writing `RArm` alongside `LArm` doubles
the work and the chance of the two drifting apart. Use `mirror` for
anything symmetric, and `joints_R` when the pose (not the shape)
differs.

### MID spends no reader at all

The isolated part read is deleted (a crown reads as "a blob", a face
as "a stone", an armoured basket as "a fist" — a part cut away from
the body has lost the only context that told the reader what it was).
The colour read is deleted too (the palette + OKLab value_order +
contrast_adjacent compute all three things in microseconds). Both
checks are ADVICE with numbers, not blocks.

**`part_exists` still BLOCKS.** If the brief named a chain and the spec
has no such chain, the order was not filled.

### Edit vocabulary

- **Swap the local shape.** Replace primitive-ish mass with structured
  geometry — brow + muzzle + jaw instead of head-sphere; knuckles +
  fingers instead of fist-ball. No naked sphere / cube / cone may
  remain visible on a whitelisted part.
- **Fold and carve.** Concave sections, `sharp` profile breaks, lower
  `smooth_angle` on that volume, plates and spikes that cut the outline.
- **Bend the pose.** Place the bend at its JOINT (`joints` positions
  form the bind pose). Mirrored pairs may stagger via `joints_R` — but
  only by a few centimetres (a few % of the limb's length).

### Hands and feet

- Hands: `type: "hand"`, palm + 4 fingers + opposable thumb, scaled from
  one `size` number. `curl` for relaxed/gripping, `fist: true` for
  folded. **No improvising from spheres.**
- Feet: `type: "paw"` with `"toes": 3..5` so they stop reading as
  bread loaves.
- Both take `mirrored: true`, and the blind-read applies — a hand that
  reads as "a blob" fails like any whitelisted part.

### Joins — decide HOW every part meets the body

See `3d-spec-language.md` for the 4 verbs in full. Re-decide on every
new part. A trunk is `insert` because the base sinks into the face
muscle; a fin is `snap` because it lies on the surface; a plate is
`snap`; a free-floating rune is `place`.

### Stage-end gate

- Machine: build green + MID-stage claims (`part_exists` /
  `part_visible` / `part_signature` / `share_hierarchy` /
  `focal_contrast`).
- Whitelist blind-reads all passed.
- Human look #2: focal distribution right? part-to-body seams clean?
- Pass = part layout locks.

## Stage 3 — HIGH (colour + 3 animations, 1 round)

### Colour — you choose freely; five norms bound the choice

1. **One high-saturation MAIN colour**, spent on the signature part.
2. **One secondary colour** for the big masses — quieter than the main.
3. **The ACCENT stays under 5%** of the surface (eye glow, claw tips,
   markings) — the memory spark. One accent temperature, not two.
4. **Saturated area: 10%–34%**, computed, not judged by eye. Below the
   floor the creature reads as a grey mass; above the ceiling
   saturation stops working as a spotlight. The band rules HOW MUCH,
   never WHERE.
5. **Brightness floor — do not crush to black.** A "dark" creature
   reads by VALUE STEPS between its masses, not by making everything
   dark. If the render medians below the floor, lift the mid masses,
   keep the darks only where a step needs them.

**The only field you normally write is `shading.pattern.color`**, and
you decided it at MID. Everything else in the L1-L8 stack is settled.
The build prints one `info: shade class ...` line naming which pieces
are flesh, which are hardware and which are features. **Read it.** A
trunk is a `curve`, so it defaults to hardware until the spec says
`"shade": "flesh"`.

### Materials — what the format can and cannot carry

- **No textures at all.** Colour is per-vertex; the whole palette
  ships in the file. Do not plan for a texture, emissive map or
  normal map — there are none, and the contract refuses images.
- **Every material carries its own hue** in `baseColorFactor`. Never
  hand-write a pure-white base colour with the colour in vertices
  only: a viewer that ignores vertex colours then shows a white
  creature.
- **Keep `metal` low — 0.2 at most, and only where it earns it.** Metal
  without an environment map renders near-black, and most viewers
  default to no environment.
- Roughness is free: use it to separate surfaces (wet, chalky,
  polished).
- **No anisotropy, no brushed metal, no hair sheen.** The contract
  refuses anisotropy outright (`anisotropy_without_direction`). Get
  the directional look from GEOMETRY — grooves, plates, aligned
  spikes, a darker vertex band along the axis.

### Animation — three, always: `idle`, `move`, `attack`

**Write all three, then build ONCE.** Not one clip, build, look, next
clip. The three share a skeleton, a stance and a weight story — the
same hips that bob in `move` are the hips that wind back in `attack`.

- The bar for idle/move: skinned, actually moving, no clipping, no
  explosions.
- **`attack` must COMMIT FORWARD — but it does not have to lunge.**
  Two ways to satisfy `attack_reach`:
  - **REACH** — something ends up ≥15% of the body span past the
    bind-pose front
  - **SWING** — some part travels forward ≥45% of its own length
- **Gait** — see `3d-spec-language.md` for the templates. Two legs:
  opposite phase. Four: diagonal pairs. Six / eight: alternating
  tripods / tetrapods.

### Stage-end gate

- Machine: full claims re-run (styles, `rig_skinned`, `anim_named`
  incl. attack, motion amplitude, tri budget) — save the claims
  output, 04 ships it as the gate stamp.
- Human look #3 (final): value readability + play all three
  animations once.

## Stage 4 — SHIP (scripted delivery + closing dialogue)

### Red lines (absolute)

- **Never upload anything without the user's explicit YES, this
  session.** Not to test, not in the background, not because a card
  says the flow exists.
- **Ask about sharing for every creature**, even if the user shared
  the last one.
- **Once they say yes, RUN the upload.** Always try it first. Never
  decide in advance that the environment cannot reach the network.

### Gate stamp (real results only)

**The engine already wrote most of it. Do not retype it from memory.**
Every build drops `<out>.checks.json` beside the GLB — every engine
check by name, whether it passed, whether it merely warned, and the
verbatim BLOCK and measure lines. Copy the engine's half. Add ONLY the
checks the engine cannot know about — the blind-read verdicts.

### Ask ONCE, then run ONE command

> Give your monster a name? (Enter = <working name>)
> Your signature? Asked once — remembered from now on. (Enter = anonymous)
> Share it to the community? Uploading releases it under CC0,
> permanently — anyone can download, use and remix it. [yes / no]

### Closing ledger — ONE line

```
gates: ID pass@r? PUNCH pass@r? | restarts: none-or-what | unresolved: none-or-what
```

Plus the delivery checklist: glb, viewer, heroes, spec JSON,
gate.json, DEVLOG.

## Credits

- **Ariescar (anyCreature 1.3.1, MIT)** — the 5-stage pipeline, the 9-slot
  brief, the iron laws, the gate scoring rules, the editing vocabulary.
  All original to that project.
- **RDJ Publishers** — ported to the LBL spec as PART 98.
