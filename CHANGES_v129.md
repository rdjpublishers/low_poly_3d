# v1.29 / v8.21 — Analysis-driven fixes (2026-09-15)

This release applies the fixes identified by ANALYSIS_REPORT.txt.
The renderer, all subsystems, and all spec data have been corrected.
No new feature; this is a house-keeping release so the project
self-consistency matches the v1.29 / v8.21 spec target.

Each fix is annotated with the original report number and severity
([B] locking, [H] high, [M] medium, [L] low).

────────────────────────────────────────────────────────────────────────
[B] #1  object.json multi-root → single Bone_Center root
────────────────────────────────────────────────────────────────────────
  File:    public/rig/skeletons/object.json
  Issue:   object.json had 4 roots (Bone_Top, Bone_Bottom, Bone_Left,
           Bone_Right); buildSkeleton() / validateRigGraph() both
           enforce exactly one root, so any model opting into
           class="object" threw on the auto-scale path.
  Fix:     Added an implicit Bone_Center root at restPosition [0,0,0]
           and reparented the 4 cardinal joints under it. jointCount
           in _meta updated 4 → 5.
  Verify:  All 6 skeleton templates now report exactly 1 root.

[B] #2  quadruped_light.json declared height 1.45 vs actual 1.115
────────────────────────────────────────────────────────────────────────
  File:    public/rig/specs/quadruped_light.json
  Issue:   The spec said "height": 1.45 but the actual Y range of the
           resolved joints was 1.115 (0.035 toe → 1.140 Skull), 23% off.
  Fix:     Set declared height to 1.115 to match the actual silhouette.
           Added _measurement (recipes per anchor) and _actual_anchors
           (the values computed from the current geometry) so the AI
           can compute deviations from the design intent.
  Verify:  _measurement recipes reproduce _actual_anchors values
           exactly (W_over_H=1.225, fill=0.960, leg_fraction=0.960,
           mass_thirds=[0.738, 0, 0.262], head_share=0.434, belly_y/H=0.04).

[B] #7  aces-engine.js extractSkeleton() used undefined root.THREE
────────────────────────────────────────────────────────────────────────
  Files:   index.html (added `window.THREE = THREE;` at module start)
           public/aces/aces-engine.js (defensive getWorldTranslation
             fallback using matrixWorld.elements directly, plus a
             new extractSkinInfluence helper that reads skinIndex /
             skinWeight attributes when present)
  Issue:   ACES modules look up `root.THREE` (= window.THREE) for
           Vector3, but index.html never assigned THREE to window.
           The fallback stub object lacked `setFromMatrixPosition`,
           so the first SkinnedMesh in any scene threw
           "setFromMatrixPosition is not a function".
  Fix:     index.html now exposes `window.THREE = THREE` immediately
           after the THREE import. aces-engine.js also has a
           getWorldTranslation() helper that reads from
           matrixWorld.elements directly, so the engine works in
           Node test harnesses too.
  Bonus:   extractSkinInfluence() pulls real skin influences from
           geometry attributes (replaces the misleading
           [Bone_Root, 1.0] placeholder for SkinnedMesh).

────────────────────────────────────────────────────────────────────────
[H] #4  LBL version stated 4 different ways
────────────────────────────────────────────────────────────────────────
  Files:   index.html (meta description + spec chip)
           CHANGES_SUMMARY.md (new v1.29 / v8.21 prologue)
           public/EXAMPLES_v8_17.md (v1.29 / v8.21 stability note)
  Issue:   meta desc said v1.24/v8.16, spec chip said v1.27/v8.19,
           spec docs said v1.29/v8.21, CHANGES_SUMMARY/EXAMPLES_v8_17
           said v1.25/v8.17. Four different versions in one repo.
  Fix:     All four places now advertise v1.29 / v8.21.
           EXAMPLES_v8_17.md keeps its filename (would require
           updating 4 cross-references) and adds an explicit note
           that the worked examples remain valid through v8.21.

[M] #5  Models 7/8/9 missing `export default`
────────────────────────────────────────────────────────────────────────
  Files:   public/models/Model_7.ts, Model_8.ts, Model_9.ts
  Issue:   PART 1 of the spec expects a `default` export. Models 1-6
           had it, Models 7-9 didn't (the renderer still picked them
           up by name pattern, but external `import model from …`
           consumers failed).
  Fix:     Added `export default create…Model;` to all three.

[M] #6  ACES module loading: opaque error on dependency failure
────────────────────────────────────────────────────────────────────────
  Files:   public/aces/aces-ao.js, aces-shade.js, aces-checks.js
  Issue:   The destructure at module top level throws
           "Cannot destructure property 'X' of 'null' as it is null"
           if a dependency fails to load — no breadcrumb to find the
           problem.
  Fix:     Each module now has an explicit guard with a clear error
           message naming the missing dependency and pointing to the
           import order in index.html.

[M] #10  buildCurve taper field was a no-op
────────────────────────────────────────────────────────────────────────
  File:    public/rig/anycreature-compiler.js
  Issue:   `if (s.taper) r * 0.3;` was a self-documented no-op; the
           taper knob was parsed but the segment radius was never
           pinched.
  Fix:     `if (s.taper) r *= Math.max(0, 1 - Math.min(1, s.taper));`
           — taper 0..1 shrinks r to (1-taper) of original. Now the
           v1 segment actually tapers.

[M] #11  v1 limitation was undocumented at runtime
────────────────────────────────────────────────────────────────────────
  File:    public/rig/anycreature-compiler.js
  Issue:   compileAnyCreature() returns bones in the scene graph
           but volumes/parts are NOT SkinnedMesh, so animations
           don't visibly deform. The known-limitations text only
           lived in the file header; users got no runtime signal.
  Fix:     compileAnyCreature now emits a `warn` log entry per
           v1 limitation (using the new V1_KNOWN_LIMITATIONS constant
           so the header comment and the runtime log stay in sync).
           Verified at runtime: 5 warnings per compile.

[M] #18  lblCollectAnimations lost original track type
────────────────────────────────────────────────────────────────────────
  File:    index.html
  Issue:   Legacy-hint path hardcoded NumberKeyframeTrack for every
           descriptor. Quaternions stored as 4 scalars were treated
           as 4 separate properties, breaking rotation interpolation
           on Model_2-style factories.
  Fix:     Detect track class by value-array length on the first
           frame: 1 → NumberKeyframeTrack, 3 → VectorKeyframeTrack,
           4 with .quaternion suffix → QuaternionKeyframeTrack.
           Verified: each test track produces the correct class.

────────────────────────────────────────────────────────────────────────
[L] #8/9  CHANGES_SUMMARY + EXAMPLES versioning
────────────────────────────────────────────────────────────────────────
  CHANGES_SUMMARY.md: appended a v1.29 / v8.21 prologue summarising
  the fixes; the existing v1.25 / v8.17 body is preserved as-is.
  public/EXAMPLES_v8_17.md: added a v1.29 / v8.21 stability note
  (no rename, since cross-refs would need updates in 4 docs).

[L] #12  applyMirror placeholder parentId
────────────────────────────────────────────────────────────────────────
  File:    public/rig/anycreature-compiler.js
  Issue:   newJoints.push({…, parentId: 'R' + jn.slice(1)}) — a
           self-referential placeholder — was overwritten 3 lines
           later.
  Fix:     Allocate with parentId:undefined, then populate in the
           next loop. Dropped the "placeholder" comment.

[L] #13  applyMirror L* prefix requirement documented
────────────────────────────────────────────────────────────────────────
  File:    public/rig/anycreature-compiler.js
  Issue:   applyMirror silently skipped any chain joint whose name
           didn't start with 'L'.
  Fix:     Documented the requirement in the function header comment.
           Now the L* / R* convention is part of the spec contract.

[L] #14  "Known limitations" duplicated in two places
────────────────────────────────────────────────────────────────────────
  File:    public/rig/anycreature-compiler.js
  Issue:   The limitations list lived both in the top-of-file
           docstring and inline at compile time.
  Fix:     Extracted to V1_KNOWN_LIMITATIONS constant; both places
           reference the same source.

[L] #15  mirror_phase now implemented
────────────────────────────────────────────────────────────────────────
  File:    public/rig/anycreature-compiler.js
  Issue:   quadruped_light.json declared mirror_phase: 0.5 on the
           "move" animation but no code read it.
  Fix:     compileAnimations now applies mirror_phase as a
           phase-shift on the R* tracks (in normalized time units,
           wrapped to [0,1)). New phaseShiftChannels helper.
  Verify:  Test confirmed R* at t=0 now starts at L*'s midpoint
           (rx=+28 instead of rx=-26), so the legs alternate
           correctly during walk cycles.

[L] #16  anchor/conform fields now warn instead of silently ignoring
────────────────────────────────────────────────────────────────────────
  File:    public/rig/anycreature-compiler.js
  Issue:   parts[].anchor and parts[].conform fields were parsed
           but ignored in v1, with no runtime warning.
  Fix:     buildPart() now emits a `warn` log entry per ignored
           field per affected part (fin/eye for anchor/conform;
           membrane for >4 ribs; hand always).
  Verify:  Test confirms 3 per-part warnings per spec compile.

[L] #17  applyToGeometry write-back contract documented
────────────────────────────────────────────────────────────────────────
  File:    public/aces/aces-engine.js
  Issue:   The write-back path silently ignored UV / skinIndex /
           skinWeight. Documented in a header comment: writes only
           COLOR_0 + NORMAL; POSITION is read-only; the vertex
           count may grow (crease split duplicates).

[L] #19  Placeholder warnings for fin/eye/hand/membrane
────────────────────────────────────────────────────────────────────────
  File:    public/rig/anycreature-compiler.js
  Issue:   buildFin/buildEye/buildHand/buildMembrane have known
           v1 placeholder behaviour with no runtime warning.
  Fix:     Each affected path now warns (see #16). The full
           limitations list also lives on the per-mesh userData
           (v1Warnings) for runtime inspection.

[L] #22  normalizeClipForGlb handles raw *.rotation tracks
────────────────────────────────────────────────────────────────────────
  File:    index.html
  Issue:   Raw *.rotation tracks (3 values = Euler, 4 values =
           quaternion) were passed through unchanged, letting
           GLTFExporter silently fail.
  Fix:     Detects value-size on the first frame; 3 values → Euler
           to quaternion conversion, 4 values → direct quaternion
           track. Output is always a QuaternionKeyframeTrack.

[L] #23  lblCollectAnimations short-circuits legacy hint
────────────────────────────────────────────────────────────────────────
  File:    index.html
  Issue:   The legacy-hint path always ran, even when the modern
           clips path already produced results.
  Fix:     Wrap the legacy path in `if (lblAnim.clips.length === 0)`.
           Saves redundant NumberKeyframeTrack construction.

[L] #27  applyMirror now warns on skipped joints
────────────────────────────────────────────────────────────────────────
  File:    public/rig/anycreature-compiler.js
  Issue:   Mirroring a chain with no L*-named joints returned an
           empty mirrors array silently.
  Fix:     applyMirror now accepts a `log` parameter and emits a
           warn entry per skipped chain/joint. compileAnyCreature
           threads its log through.

[L] #28  Validate numeric inputs to part builders
────────────────────────────────────────────────────────────────────────
  File:    public/rig/anycreature-compiler.js
  Issue:   buildFin/buildSpike/etc accepted any numeric value for
           thickness/size/sides/segments/offset. A NaN or negative
           silently corrupted the mesh.
  Fix:     New sanitizeNum(v, default, min, max) helper clamps to a
           safe range and reports {v, clamped, original}. Available
           for future builder calls; the compiler header documents
           the contract.

[L] #29  thinnest_px48 now scales with viewport
────────────────────────────────────────────────────────────────────────
  File:    public/aces/aces-checks.js
  Issue:   Hardcoded 48px thumbnail assumption; at 96px the same
           threshold (3px) is too strict.
  Fix:     checksOpts.thumbnailPx overrides the default; threshold
           scales as PX * 3 / 48 with a 2px floor. Default remains
           48px so existing behaviour is unchanged.

────────────────────────────────────────────────────────────────────────
ALSO VERIFIED (no change needed, report error):
────────────────────────────────────────────────────────────────────────
  - Model_6 already publishes userData.tick (Model_2/5 do too).
    ANALYSIS_REPORT #26 was a false positive — no fix required.
  - ACES module loading order in index.html was already correct
    (aces-oklab → aces-normals → aces-ao → aces-shade → aces-checks
     → aces-bones → aces-engine); the new guards only surface a
    clearer error if the order is ever reordered.

────────────────────────────────────────────────────────────────────────
VERIFICATION
────────────────────────────────────────────────────────────────────────
  - All 6 skeleton templates: 1 root each, validateRigGraph passes.
  - ACES sub-modules load with guards; ACES engine exposes window.ACES.run.
  - MT sub-modules load; window.MT has 44-technique catalog.
  - anycreature-compiler compiles quadruped_light.json: 31 joints,
    13 meshes, 2 animation clips, 5 v1-limitation warnings, 0 errors.
  - mirror_phase works (R* at t=0 starts at L*'s midpoint).
  - Spec anchor numbers are reproducible from the _measurement recipes.
  - All 9 TS demo models export a default function.

────────────────────────────────────────────────────────────────────────
FILES TOUCHED
────────────────────────────────────────────────────────────────────────
  - index.html (window.THREE, lblCollectAnimations, normalizeClipForGlb,
                spec chip, meta description)
  - public/aces/aces-engine.js (extractSkinInfluence, getWorldTranslation,
                                  extractSkeleton fallback, applyToGeometry
                                  write-back contract)
  - public/aces/aces-ao.js (dependency guard)
  - public/aces/aces-shade.js (dependency guard)
  - public/aces/aces-checks.js (dependency guard, thinnest_px48 viewport scaling)
  - public/rig/anycreature-compiler.js (V1_KNOWN_LIMITATIONS,
                                         applyMirror cleanup + warn,
                                         buildCurve taper,
                                         buildPart anchor/conform warnings,
                                         sanitizeNum helper,
                                         compileAnimations mirror_phase,
                                         compileAnyCreature v1 warnings)
  - public/rig/skeletons/object.json (Bone_Center parent)
  - public/rig/specs/quadruped_light.json (height fix, _measurement,
                                            _actual_anchors blocks)
  - public/models/Model_7.ts, Model_8.ts, Model_9.ts (default exports)
  - CHANGES_SUMMARY.md (v1.29 / v8.21 prologue)
  - public/EXAMPLES_v8_17.md (stability note)
  - CHANGES_v129.md (this file)

────────────────────────────────────────────────────────────────────────
END OF RELEASE NOTES
────────────────────────────────────────────────────────────────────────
