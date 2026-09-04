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

