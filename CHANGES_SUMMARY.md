# v1.11 / v8.3 — Pre-bundled rig helpers (PART 34)

## Files modified (7)

| File | Change |
|------|--------|
| `Prompt_To_Ts.txt`  | header v1.10 → v1.11; new v1.11 CHANGELOG entry; appended PART 34 |
| `Image_To_Ts.txt`   | header v1.10 → v1.11; new v1.11 CHANGELOG entry; appended PART 34 |
| `Prompt_To_Js.txt`  | header v8.2 → v8.3; new v8.3 intro-note entry; renamed old PART 34 → PART 33.5; updated cross-references; appended new PART 34 |
| `Image_To_Js.txt`   | header v8.2 → v8.3; new v8.3 intro-note entry; renamed old PART 34 → PART 33.5; updated cross-references; appended new PART 34 |
| `Prompt_To_Json.txt`| header v8.2 → v8.3; new v8.3 intro-note entry; renamed old PART 34 → PART 33.5; updated cross-references; appended new PART 34 |
| `Image_To_Json.txt` | header v8.2 → v8.3; new v8.3 intro-note entry; renamed old PART 34 → PART 33.5; updated cross-references; appended new PART 34 |
| `index.html`        | import map fifth entry; E11 validator; Rig button + panel; version constant; topbar button |

## Files added (6, all under public/rig/)

| File | Purpose |
|------|---------|
| `public/rig/three-rig-helpers.js` | pre-bundled minified ESM, 3.9 KB, single external dep on `'three'` |
| `public/rig/build.sh` | esbuild regeneration script |
| `public/rig/src/index.ts` | bundle entry point (re-exports the 5 public functions) |
| `public/rig/src/skeleton.ts` | rig compiler (translated 1:1 from the attached source) |
| `public/rig/src/weights.ts`  | vertex-skin-weight builder (translated 1:1 from the attached source) |
| `public/rig/src/ir/character-ir.ts` | re-declared types (Vec3, Quat4, RigJoint, RigGraph) — no external type imports |

## Files UNTOUCHED (per hard constraints)

- `public/models/Model_1.ts` through `Model_5.ts`
- `public/models/manifest.json`
- `.github/workflows/manifest.yml`
- All existing PART 1-33 content in the 6 .txt spec files
- The pre-existing PART 34-R in Prompt_To_Js.txt and Image_To_Js.txt (its own maintainer-authored comment explains the "-R" suffix was the chosen disambiguation)
- All existing index.html content (E1-E10 anti-pattern checks, F4-F7 feature checks, the Sockets button, the USDZ button, the export pipeline, the auto Bone-promotion / per-part skin pass at `buildSkinnedHierarchyForExport`)

## Resolved contradiction (LBL spec PART 34 collision)

The 4 JSON/JS spec files already had a "PART 34" (v7.2 in JS, v7.3 in JSON) and Prompt_To_Js.txt / Image_To_Js.txt also had a "PART 34-R" (v7.3). The maintainer's own comment in PART 34-R acknowledged the collision and chose the "-R" suffix as a disambiguation. Adding a second/third "PART 34" would have created ambiguous cross-references.

Resolution: the existing PART 34 was renamed to **PART 33.5** in the 4 JSON/JS spec files. This matches the existing content's self-description ("FOLLOW-UP pass to PART 33's v7.1 work" / "continuation of PART 33"). PART 34-R is kept as-is (the maintainer explicitly chose that name to disambiguate). All cross-references to the old "PART 34.X" sub-sections were re-pointed to "PART 33.5.X" (9 in each JS file, 25 in each JSON file). PART 34 is now uniquely the new v1.11 / v8.3 content across all 6 spec files.

## Verification

- `node --check` on the extracted index.html module script → OK
- `node --check` on `public/rig/three-rig-helpers.js` → OK
- The bundle's only external imports are `'three'` (resolved by the import map); the 5 public functions are exported
- PART 34 in every .txt file starts with the "v1.11 ADDITIONS" / "v8.3 ADDITIONS" header and ends with "END OF PART 34"
- The import map has all 4 original entries + the new `three-rig-helpers` entry

## Other contradictions surfaced (see REPORT.md for the full list)

1. PART 4.1/4.2 says "zero relative imports" — PART 34 deliberately carves out one
   explicit exception (`'three-rig-helpers'`). Documented in PART 34.1 + 34.8.
2. PART 30.2 says "no THREE.Skeleton/THREE.Bone requirement in YOUR code" —
   PART 34 lets the AI author real `THREE.Skeleton` / `THREE.Bone` for the 1%
   of cases that need true SkinnedMesh. Documented in PART 34.4 decision table.
3. PART 30.7 says the renderer "auto-promotes" named pivot Groups to Bones at
   export time — PART 34 is the strict superset for cases that need it
   authored up-front. Documented in PART 34.4 + 34.7(c).
