# v1.13 / v8.5 — Multi-file drop + Model + Rig pairing (PART 36)

The dropper now accepts a `FileList` (multi-select file picker or
multi-file drag-and-drop) and processes every file instead of just
`files[0]`. A new "rig" file type lets a `model.ts` + `rig.ts` pair
render together — when a `.ts` file has no `create*Model` factory,
the dropper retries it as a `RigGraph`, validates + builds the
skeleton via the bundled `three-rig-helpers` (PART 34), and attaches
it to the most recently loaded TS model. Single-file drops are
unchanged; no new contract, no new validator, no new mandatory
field on `.ts` factories — purely additive on the dropper.

## Files modified (7)

| File | Change |
|------|--------|
| `Prompt_To_Ts.txt`   | header v1.12 → v1.13; new v1.13 CHANGELOG entry; appended PART 36 |
| `Image_To_Ts.txt`    | header v1.12 → v1.13; new v1.13 CHANGELOG entry; appended PART 36 |
| `Prompt_To_Js.txt`   | header v8.4 → v8.5; new v8.5 intro-note entry; appended PART 36 |
| `Image_To_Js.txt`    | header v8.4 → v8.5; new v8.5 intro-note entry; appended PART 36 |
| `Prompt_To_Json.txt` | header v8.4 → v8.5; new v8.5 intro-note entry; appended PART 36 |
| `Image_To_Json.txt`  | header v8.4 → v8.5; new v8.5 intro-note entry; appended PART 36 |
| `index.html`         | `multiple` attr on 4 file inputs; new `lblRouteFiles` dispatcher; `__lblLoaded3DModels[]` array; `__lblExtractRigGraph` + `__lblApplyRigToModel` helpers; `__lblPendingRigs` queue + drain; updated `lblHighlightWholeModel` / `updateTree` / 3 raycast handlers / `lblResolveHitId`; replaced 8 single-`loaded3dGroup` guards with `__lblGetActiveExternalRoot()`; `lblSpec.VERSION` bumped to `{ts:'v1.13', json:'v8.5'}`; `LBL:` chip in topbar |

## Files UNTOUCHED (per the new PART 36.5 single-file back-compat rule)

- `public/models/Model_1.ts` through `Model_5.ts`
- `public/models/manifest.json`
- `.github/workflows/manifest.yml`
- `public/rig/three-rig-helpers.js` (the pre-bundled rig helpers) — still
  the single source of truth for `buildSkeleton` / `validateRigGraph` /
  `buildSemanticWeights` / etc.
- `public/rig/src/*.ts` (the unbundled source for `three-rig-helpers`) —
  PART 36 just calls into the bundle, never re-implements the API
- All existing PART 1-35 content in the 6 `.txt` spec files
- All existing `index.html` content that handles single-file drops,
  the editor paste path, the Demo / Model Store, the GLB/OBJ/STL/FBX/DAE
  loaders, the export pipeline, the E1-E10 + E11 + E12 validators, the
  F4-F7 feature checks, the Sockets / USDZ / Rig / Tris buttons

## What the new PART 36 covers (6 subsections)

- **36.1** Executive overview — what changes for AI-authored factories
  (nothing; the contract is unchanged) and what the new dropper does
  when the user drops more than one file
- **36.2** The "rig" file type — 4 supported `RigGraph` export shapes
  (default object, default function, named `rigGraph`, named getter
  `getRigGraph` / `createRigGraph` / etc.) + the attach pipeline
  (compile → extract → validate → buildSkeleton → attach root → set
  userData → toast) + the queue-then-drain pattern for rigs dropped
  before a model
- **36.3** What a rig file must NOT do — the PART 4 single-file /
  no-relative-imports rules apply to rig files the same as models
- **36.4** Minimal worked example — a `model.ts` + `rig.ts` pair
  with the exact 3-joint rig + 3 toasts the user sees when they drop
  both, in either order, with or without an extra GLB in the batch
- **36.5** Backwards compatibility — the single-file path is the same
  dispatch as before; `lblRouteFiles` short-circuits to the original
  `lblRouteDroppedFile` branch when `files.length === 1`
- **36.6** Pre-emission checklist — 2 voluntary mental-checklist
  items (NOT enforced by any validator) for AI authors who write a
  rig file: SHAPE check (36.2) + topological-order check (every
  non-root joint's `parentId` must point at an id that appears
  earlier in the array)

## Resolved contradiction (LBL spec "rig" vocabulary overlap)

PART 34 introduced the term "rig" for the `three-rig-helpers` library
(the library that builds skeletons from `RigGraph` data). PART 36
introduces the same word for a new file type. After discussion these
turn out to be the SAME concept, not two different ones — a "rig file"
in PART 36's sense is exactly "a `.ts` file that exposes a
`RigGraph` to feed into the `three-rig-helpers` library that PART 34
already bundles". PART 36.2 explicitly cross-references PART 34 and
reuses the same `RigGraph` type, so there's no real conflict — the
"rig file" is just a new DELIVERY mechanism for the `RigGraph` data
structure that PART 34 already requires the model factory to attach to
`userData.rigGraph` in-process.

The only genuine naming concern was that an end-user reading the
spec might wonder "is a 'rig file' something the model has, or
something I drop alongside the model?" — PART 36.1 leads with the
answer ("a rig file is something you drop alongside the model, that
the renderer attaches to the model automatically").

## Verification

- `node --check` on the extracted `index.html` module script → OK
  (after both the multi-file drop and the model+rig commits)
- 10/10 unit tests on `__lblExtractRigGraph` — covers all 4
  supported `RigGraph` export shapes + 5 negative cases (no factory,
  empty default, wrong joint shape, dangling parents, completely
  empty module). Run via `node rigtest3.mjs`.
- End-to-end test with the real `public/rig/three-rig-helpers.js`
  bundle + Three.js r160 — a 11-joint humanoid rig
  (hips → spine → chest → neck → head, with arms branching from
  the chest and legs from the hips) compiles, validates, builds a
  proper Bone hierarchy, and attaches to a model Group with all the
  right `userData` markers (`rigGraph` + `skeletonSource`).
- All 6 `.txt` spec files preserve their line counts modulo the
  +15 KB PART 36 append + the new ~1 KB CHANGELOG entry at the top
  — every existing PART 1-35 reference is unchanged (cross-references
  like "see PART 32.3 for the 16-item list" still resolve).
- The `LBL: v1.13 / v8.5` chip in the topbar matches the
  `window.lblSpec.VERSION` constant in `index.html`.

## Files in the final PR

```
modified:   CHANGES_SUMMARY.md
modified:   index.html                            (+~720 lines, -~10)
modified:   Prompt_To_Ts.txt                      (+~15 KB, PART 36)
modified:   Image_To_Ts.txt                       (+~15 KB, PART 36)
modified:   Prompt_To_Js.txt                      (+~15 KB, PART 36)
modified:   Image_To_Js.txt                       (+~15 KB, PART 36)
modified:   Prompt_To_Json.txt                    (+~15 KB, PART 36)
modified:   Image_To_Json.txt                     (+~15 KB, PART 36)
```

## Related prior rounds (for context)

- v1.11 / v8.3 — Pre-bundled rig helpers (PART 34) — see the previous
  CHANGES_SUMMARY.md round for the `three-rig-helpers` bundle.
- v1.12 / v8.4 — Triangle-first geometry (PART 35) — see the spec
  files' own CHANGELOG entries; the 5 triangle methods + 6-item
  pre-emission checklist + 🔺 Tris button are the foundation that
  PART 36 layers on top of (multi-model scenes still report their
  combined triangle budget via the same button).
