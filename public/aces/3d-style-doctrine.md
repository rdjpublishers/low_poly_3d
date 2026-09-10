# PART 96 — 3D Modeling Style Doctrine (from anyCreature)

> Ariescar's design doctrine, ported to the LBL spec. The rules exist to
> protect form quality; if following a rule would make the creature tamer,
> the rule loses. **Form beats obedience, everywhere.**

This is not a list of "do this". It is a list of "do this WHEN the alternative
makes the form tamer." Every rule below can be broken — and the breaks are
documented, because the breaks are where the personality lives.

## The five iron laws

### 1. Form beats obedience
Every rule below exists to protect form quality. If following a rule would
make the creature tamer, the rule loses. Edits whose only purpose is to make
a number match a declaration are forbidden.

### 2. You never grade your own thumbnails
The session that designed the creature is the worst possible judge of whether
it reads, because it already knows what it drew. So the silhouettes go to a
**context-free reader agent** that has never seen the order, and the only
question is *"what is this?"*. Never trust a reader either — every read
carries three verification traps (a binding question, a canary, shuffled
labels).

### 3. Same symptom failed twice = no third tweak
Restart that view/element from a DIFFERENT concept. If the restart also
fails, ship your best version and write one honest DEVLOG line about what
didn't land. A round that nudges the same head and ears through eight rounds
is a round that costs three times what round one did, because the context
they ride on keeps growing.

**A round tests THREE ideas, not one.** Three builds cost four seconds more
than one, while three separate reads cost three times a read. Three sizes
of the same head is not three ideas; it is one idea with a wobble.

### 4. The signature part gets real geometry at LOW
A giant whose identity is its fists gets fingers, knuckles and a planted
pose in the silhouette round — not a placeholder sphere. **Budget follows
6:3:1**: the 6-level element gets 6-level geometry. The signature part is
the part the user will recognise first; under-budgeting it is the most
expensive mistake in the whole pipeline.

### 5. Engine floors block builds
Mechanical checks refuse broken geometry and fake attacks (`BLOCK:` lines
say exactly what; `warn:` lines are measures for YOUR judgment; `info:`
lines narrate what the compiler actually did). Fix and rebuild; a refused
build costs no round.

## The 6:3:1 hierarchy

A silhouette needs ONE mass that clearly leads, ONE that supports, and
detail that stays detail. The 6:3:1 rule:

- **Primary mass: 60%** of the frame. The body. The thing a stranger sees
  first.
- **Secondary mass: 30%** of the frame. The signature part, weaponised
  anatomy, the part the customer said the creature was for.
- **Tertiary detail: 10%** of the frame. Spikes, claws, frills — the
  texture that makes the silhouette stick in the memory.

An even spread reads as no hierarchy at all. **Two focal points of equal
weight make the eye ping-pong between them and neither one wins** — the
focal_contrast check refuses a pair whose shares differ by less than 2×.
Open up the dominance gap, or pick one focal and drop the other.

## The brief — 9 slots, presence-checked, never content-checked

The order arrives thin ("a dragon"). A thin order is not a small job, it is
an UNDECLARED job: every slot the brief leaves empty is a slot no gate can
test, and an untested slot drifts to whatever the word usually looks like —
the same black spiky dragon every time. So expand it yourself, in one pass,
before you build. **Do not show the expansion to the person and do not ask
them to approve it.** They asked for a creature, not for homework; the gates
are what catch a wrong guess, not a confirmation step.

| Slot | What it must say | Who reads it later |
|---|---|---|
| `identity` | "reads as: X" — the noun a stranger should say | Gate 1 (3 of 4 views, identity view mandatory) |
| `feel` | one phrase: heavy / fast / sharp / floating | the 24px read |
| `height` | real-world metres | `size` gate (±15%, engine BLOCKs) |
| `signature` | ONE named part, and which view carries it | `part_exists`, `part_signature`, MID whitelist, HIGH main colour |
| `mass hierarchy` | which masses are primary / secondary / detail | `share_hierarchy` (6:3:1) |
| `two focals` | the dominant one and the runner-up | `focal_contrast` (≥2× apart) |
| `stance` | how the weight is planted; what is asymmetric | `balance`, and the bind pose IS the pose |
| `attack` | what strikes, and what lunges forward | `attack_reach` (½ body span or BLOCK) |
| `value plan` | dominant COLOUR, secondary, accent <5%, dark or light | `saturation_area`, brightness floor |

**Two rules that decide whether the expansion is worth anything:**

1. **Discard your first three ideas.** The first things that arrive for any
   creature word are the tropes everyone has seen. Name them to yourself,
   throw them out, and take the fourth. A brief that could have been
   written without the order in front of you has failed.
2. **Commit to ONE exaggeration and pay for it everywhere.** Pick a single
   extreme — a proportion, a weaponised part, a broken symmetry — and let
   it distort the hierarchy, the stance, the attack and the colour plan.
   Nine moderate slots make a shapeless creature; eight ordinary slots
   serving one violent decision make a creature people remember.

## Mass thirds — WHERE the mass sits

`thirds_cols` and `thirds_rows` from the silhouette measure: how much of the
silhouette lives in each third of the frame. A creature's thirds should
*not* be a flat 33/33/33 — a centred silhouette has no direction, no
story. A runner has mass in the rear third. A pouncer has mass in the
front third. A coiled snake has mass in the middle third with a head
sticking out of one side. The thirds ARE the silhouette.

## Focal contrast — the eye lands on ONE thing

The eye lands on the part with the **highest OKLab chroma AND the highest
share of the frame**. If two parts compete at the same lightness AND the
same share, the eye ping-pongs and neither one wins. The `focal_contrast`
check refuses a pair whose shares differ by less than 2×. Pick one focal,
open the gap, drop the other.

## Value plan — five norms bound the choice

1. **One high-saturation MAIN colour**, spent on the signature part.
   Saturation is a spotlight; if everything is saturated, nothing is.
2. **One secondary colour** for the big masses — quieter than the main.
3. **The ACCENT stays under 5%** of the surface (eye glow, claw tips,
   markings) — the memory spark. One accent temperature, not two.
4. **Saturated area: 10%–34%** — computed, not judged by eye. Below the
   floor the creature reads as a grey mass; above the ceiling saturation
   stops working as a spotlight. The band rules HOW MUCH, never WHERE.
5. **Brightness floor — do not crush to black.** The judge measures the
   beauty render's median luminance; a "dark" creature reads by VALUE
   STEPS between its masses, not by making everything dark.

## Scale discipline

- **24px reads FEEL** (heavy/fast/sharp/floating). A 24px thumbnail is what
  the first impression lands on.
- **48px reads IDENTITY** (what creature). A 48px thumbnail is what the
  blind reader sees.
- **A 200px+ render reads SURFACE** (fur, scale, shine). Anything below
  that is just silhouette.
- Judge each at its own scale. The thinnest feature on the 48px thumbnail
  under 3 px is not a thin feature, it is an invisible one.

## Dullness flags — these are not "bad", they are MEASURES

The LLM (or the human) judges; the script MEASURES. A high `sq_fill` is a
blob, not a pose. A perfect `mirror_sym` on the side or top view is a
plank. A long `straight_max` run is a stiff limb. Read the numbers, then
decide.

| Metric | What it measures | Healthy range |
|---|---|---|
| `sq_fill` | silhouette in a square frame | 0.20–0.40 |
| `mirror_sym` | IoU with own horizontal flip | front: high; side/top: low |
| `straight_max` | longest constant-slope run on the boundary | under 0.4 of side |
| `compactness` | perimeter²/4πA — 1=disc, higher=spikier | 1.5–4 |
| `thinnest_px48` | width of the thinnest feature at 48px | ≥ 3 px |

## What this is NOT

- Not a "do this" list. Every rule has a documented break.
- Not a style choice. A `share_hierarchy` block on an `ev: <0.40, 0.30,
  0.30>` reads as no dominance at all, regardless of what the brief says.
- Not a content check. The brief is checked for PRESENCE, never for
  CONTENT. Declare any height, any identity, any palette — all of them
  pass. What is refused is a BLANK, and only in the slots a later stage
  actually reads.

## Credits

- **Ariescar (anyCreature 1.3.1, MIT)** — the doctrine, the brief, the
  6:3:1 hierarchy, the value plan, the scale discipline, the dullness
  flags. All original to that project.
- **RDJ Publishers** — ported to the LBL spec as PART 96.
