# v1.14 / v8.6 — Zip bundle support (PART 37)

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

