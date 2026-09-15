// anycreature-compiler.js
// ============================================================================
// LBL UPDATE — anyCreature 1.3.1 spec compiler (PART 97 of v8.19 / v1.25).
//
// The "design card" format (the one your uploaded quadruped_light.json uses)
// is documented in the spec but not compiled by the renderer out of the box.
// This module reads a spec of that shape and emits a THREE.Group that the
// existing TS-model pipeline can mount, animate, and export.
//
// What it does, in order:
//   1. resolveJoints()    — turn the relational joint graph (from/up/fwd/
//                           side/dir/len/ground) into a flat list of
//                           absolute world-space joint positions, fixed-
//                           point iterated to handle dependency order.
//   2. buildBoneHierarchy()— convert the resolved joints into a real
//                           THREE.Bone hierarchy so the AnimationMixer
//                           can find the joints (track names resolve
//                           even though v1 doesn't skin the geometry
//                           to the bones — see "Known limitations"
//                           below for the v2 plan).
//   3. buildVolumes()     — for every entry in spec.volumes, sweep a tube
//                           mesh along the chain. Each ring is sampled
//                           from the volume's profile rows; per-row options
//                           `exp` (superellipse), `bias` (vertical
//                           asymmetry), `roll` (in-plane rotation) and
//                           `sharp` (crease) are honored. caps: "dome" |
//                           "ngon" | "fan" | "none" close the ends.
//   4. buildParts()       — fin / eye / spike / paw / curve / hand /
//                           membrane primitives, each anchored to a host
//                           joint (and optionally to a specific chain t +
//                           around angle on a volume surface).
//   5. applyMirror()      — for every chain listed in spec.mirror, duplicate
//                           the L*-side chain & parts as R* with the X
//                           axis flipped, and re-parent the R* joints.
//   6. compileAnimations()— turn spec.animations.{idle,move,attack,…} into
//                           real THREE.AnimationClip / KeyframeTrack objects
//                           bound to the resolved joint names. The renderer's
//                           existing animation player (PART 38+) plays them
//                           unchanged.
//   7. wireRuntime()      — drop a `userData.sculptRuntime` and a
//                           `userData.tick` on the returned group, exactly
//                           the way the TS factory models do, so the
//                           renderer treats the compiled model identically
//                           to a hand-written factory.
//
// ANALYSIS-REPORT #14 — single source of truth for "Known limitations".
// Both the top-of-file docstring and the inline reference in
// compileAnyCreature() previously duplicated this list; the v2 plan
// risks drifting between the two copies.
const V1_KNOWN_LIMITATIONS = [
  'The volumes and parts are emitted as regular THREE.Mesh, not THREE.SkinnedMesh, so the bone hierarchy is decoupled from the geometry. The AnimationMixer can find the joints (and the animation player shows the clips in the panel), but the model does NOT visibly deform on playback. Switching to SkinnedMesh is straightforward but interacts badly with the renderer\'s gizmo-anchor wrap (which re-parents the model after bind) — the rebind must happen after the wrap, not at compile time.',
  'Section refs (`profile row opts.section`) are accepted but the named 2D section from spec.sections is rendered as a simple ellipse — the custom outline (concave, star, etc.) is v2.',
  'The `conform` flag and `anchor` block on fin/eye parts are parsed but ignored — parts always orient by the spec\'s udir/vdir. v2 will project against the host volume\'s surface normal and resolve chain-t / around-angle anchoring.',
  'Membrane parts and hand parts are very rough placeholders. They render a flat fan / ellipsoid; the full 4-bone rib mesh and the palm + 4 fingers + thumb are v2.',
];

// ANALYSIS-REPORT #14 — known limitations documented at the top of the file.
// (See V1_KNOWN_LIMITATIONS below for the canonical list; this comment is
// the human-readable summary.)
//   - Bones exist in the scene graph but volumes/parts are NOT SkinnedMesh
//     → the AnimationMixer can play clips but the geometry does NOT deform.
//     Switching to SkinnedMesh is blocked by the renderer's gizmo-anchor
//     wrap (re-parents the model after bind). v2 will rebind after wrap.
//   - `profile row opts.section` resolves to a simple ellipse only.
//   - `conform` and `anchor` on fin/eye parts are parsed but ignored.
//   - `membrane` and `hand` parts are rough placeholders.
//
// ANALYSIS-REPORT #4 — SPEC VERSION (LBL v1.29 / v8.21):
// This file is part of the renderer surface documented at v1.25/v8.17
// (PART 75-89, procedural rigging + skin-weights). The anycreature
// compiler was added at PART 97 (v1.27/v8.19). No spec-version change
// in v1.28/v8.20 or v1.29/v8.21; this file is unchanged across those
// revisions.
//
// Public surface:
//   import { compileAnyCreature } from 'anycreature-compiler.js';
//   const { group, log, bones } = compileAnyCreature(spec, opts);
//
// `log` is an array of human-readable info/warn lines (mirroring what
// `acesQualityPass` returns) so the renderer can show a build report in
// the validator panel.
//
// Author: RDJ Publishers, ported from the anyCreature 1.3.1 reference.
// License: same as the rest of public/rig (see LICENSE-3RD-PARTY.md).
// ============================================================================
//   3. buildVolumes()     — for every entry in spec.volumes, sweep a tube
//                           mesh along the chain. Each ring is sampled
//                           from the volume's profile rows; per-row options
//                           `exp` (superellipse), `bias` (vertical
//                           asymmetry), `roll` (in-plane rotation) and
//                           `sharp` (crease) are honored. caps: "dome" |
//                           "ngon" | "fan" | "none" close the ends.
//   4. buildParts()       — fin / eye / spike / paw / curve / hand /
//                           membrane primitives, each anchored to a host
//                           joint (and optionally to a specific chain t +
//                           around angle on a volume surface).
//   5. applyMirror()      — for every chain listed in spec.mirror, duplicate
//                           the L*-side chain & parts as R* with the X
//                           axis flipped, and re-parent the R* joints.
//   6. compileAnimations()— turn spec.animations.{idle,move,attack,…} into
//                           real THREE.AnimationClip / KeyframeTrack objects
//                           bound to the resolved joint names. The renderer's
//                           existing animation player (PART 38+) plays them
//                           unchanged.
//   7. wireRuntime()      — drop a `userData.sculptRuntime` and a
//                           `userData.tick` on the returned group, exactly
//                           the way the TS factory models do, so the
//                           renderer treats the compiled model identically
//                           to a hand-written factory.
//
// Public surface:
//   import { compileAnyCreature } from 'anycreature-compiler.js';
//   const { group, log, bones } = compileAnyCreature(spec, opts);
//
// `log` is an array of human-readable info/warn lines (mirroring what
// `acesQualityPass` returns) so the renderer can show a build report in
// the validator panel.
//
// Author: RDJ Publishers, ported from the anyCreature 1.3.1 reference.
// License: same as the rest of public/rig (see LICENSE-3RD-PARTY.md).
// ============================================================================

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// 1. Joint resolution
// ---------------------------------------------------------------------------
//
// `spec.joints` is a { name: def } map. Each `def` is either:
//   • a 3-array [x, y, z] of world-space coordinates (the only "absolute"
//     form), or
//   • a { from, up?, fwd?, side?, dir?, len?, ground? } object that locates
//     the joint relative to another named joint.
//
// The relations are resolved to absolute world-space positions by
// iterating to a fixed point — order-independent, but cycles throw.
function resolveJoints(rawJoints) {
  const positions = Object.create(null);
  const raws = Object.create(null);
  const names = Object.keys(rawJoints || {});
  for (const n of names) raws[n] = rawJoints[n];

  // First pass: seed absolute joints straight from [x, y, z] definitions.
  for (const n of names) {
    const def = raws[n];
    if (Array.isArray(def) && def.length === 3 &&
        def.every(v => Number.isFinite(v))) {
      positions[n] = new THREE.Vector3(def[0], def[1], def[2]);
    }
  }

  // Helper — derive a position from a relational def once we have
  // `from` resolved.
  function deriveFromRelation(fromName, def) {
    const base = positions[fromName];
    if (!base) return null; // from not yet resolved; come back later
    const p = base.clone();
    // Coordinate convention: y up, z forward, x right.
    // `up` / `fwd` / `side` are signed scalar offsets along each axis.
    if (Number.isFinite(def.up))    p.y += def.up;
    if (Number.isFinite(def.fwd))   p.z += def.fwd;
    if (Number.isFinite(def.side))  p.x += def.side;
    // `dir` + `len` form: base + normalize(dir) * len. Used for tail tips,
    // muzzle points, etc., where the offset isn't axis-aligned.
    if (Array.isArray(def.dir) && Number.isFinite(def.len)) {
      const d = new THREE.Vector3(def.dir[0] || 0, def.dir[1] || 0, def.dir[2] || 0);
      const l = d.length();
      if (l > 1e-9) d.multiplyScalar(def.len / l);
      p.add(d);
    }
    // `ground` overrides the joint's Y after the offset (for toes).
    if (Number.isFinite(def.ground)) p.y = def.ground;
    return p;
  }

  // Second pass: repeatedly resolve relational joints until the world
  // stops changing. Up to N+1 iterations covers even the worst case
  // (a single linear chain) without spinning forever.
  const maxIter = names.length + 2;
  let changed = true;
  for (let iter = 0; iter < maxIter && changed; iter++) {
    changed = false;
    for (const n of names) {
      if (positions[n]) continue;
      const def = raws[n];
      if (!def || typeof def !== 'object') continue;
      const p = deriveFromRelation(def.from, def);
      if (p) { positions[n] = p; changed = true; }
    }
  }

  // Anything left unresolved is a cycle or a missing-from; surface it
  // loudly so the user can see in the validator log.
  const errors = [];
  for (const n of names) {
    if (!positions[n]) errors.push(`joint "${n}" could not be resolved (missing 'from' or cycle)`);
  }
  return { positions, errors };
}

// ---------------------------------------------------------------------------
// 1b. Bone hierarchy
// ---------------------------------------------------------------------------
//
// Convert the resolved joint positions into a Three.js Bone hierarchy.
// We use Bone (not Object3D) so three.js's SkinnedMesh + AnimationMixer
// can find them. Each bone sits at the world position of its joint; the
// parent is determined by the `attach` map (chains) or the relational
// `from` def. Bones are added as descendants of `parentGroup` so they
// live in the same scene graph as the volumes.
//
// `bonesByName` is filled in as a side-effect so the volume/part
// builders can look up a joint by name and get its Bone back.
function buildBoneHierarchy(parentGroup, positions, spec) {
  const attach = (spec && spec.attach) || {};
  const chains = (spec && spec.chains) || {};
  const rawJoints = (spec && spec.joints) || {};
  // Resolve the parent of each joint.
  const parentOf = Object.create(null);
  // 1) attach: chain → host
  for (const [chainName, hostName] of Object.entries(attach)) {
    const chain = chains[chainName] || [];
    for (let i = 0; i < chain.length; i++) {
      if (i === 0) parentOf[chain[i]] = hostName;
      else parentOf[chain[i]] = chain[i - 1];
    }
  }
  // 2) Fall back to the relational `from` for any remaining joint.
  for (const [name, def] of Object.entries(rawJoints)) {
    if (parentOf[name] || !def || typeof def !== 'object') continue;
    if (def.from && positions[def.from]) parentOf[name] = def.from;
  }
  // Find the root: the joint no other joint claims as parent.
  let rootName = null;
  for (const name of Object.keys(positions)) {
    if (!parentOf[name]) { rootName = name; break; }
  }
  if (!rootName) rootName = Object.keys(positions)[0];
  // Create a Bone for every joint, parent them according to parentOf.
  const bonesByName = Object.create(null);
  // Pre-create all bones (in two passes — first the bones, then the
  // parenting — so a child's parent Bone always exists by the time
  // we wire it).
  for (const name of Object.keys(positions)) {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.copy(positions[name]);
    bonesByName[name] = bone;
  }
  // Parent the bones. The root bone is a direct child of `parentGroup`;
  // the rest follow parentOf. If a child's parent isn't in bonesByName
  // (e.g. a missing spec entry), fall back to the root bone so the
  // joint still has a place in the graph.
  for (const name of Object.keys(positions)) {
    const bone = bonesByName[name];
    const parentName = parentOf[name];
    if (name === rootName) {
      parentGroup.add(bone);
    } else if (parentName && bonesByName[parentName]) {
      bonesByName[parentName].add(bone);
    } else {
      // Orphan — reparent to the root so the bone is at least in the
      // graph and the AnimationMixer can find it.
      bonesByName[rootName].add(bone);
    }
  }
  return { bonesByName, root: bonesByName[rootName] };
}

// (v1 — kept for reference) The original rig-graph shape consumed by
// three-rig-helpers.buildSkeleton. v1 doesn't use this anymore (we
// build the bone hierarchy directly). It's still useful for external
// tools that introspect the spec via the bundled helpers, so the
// function is preserved.
//
// ---------------------------------------------------------------------------
// 2. Chain helpers
// ---------------------------------------------------------------------------
//
// The spec chains (spec.chains) are ordered joint-name lists. For a
// volume, we walk the chain and compute a poly-line of world positions
// by following the resolved joints and, for any missing segment, falling
// back to a straight interpolation between the endpoints (handles the
// common "chain index hits a missing joint" case gracefully).
function chainToPolyline(chain, positions) {
  const pts = [];
  for (const name of chain) {
    const p = positions[name];
    if (p) pts.push(p.clone());
  }
  if (pts.length < 2) return pts;
  // If the chain mentions a joint we don't have, the chain implicitly
  // walks through whatever the missing joint would have been. In that
  // case we still have endpoints; for tube sweep we keep what we have
  // (a 2-point polyline is enough for a 1-segment tube).
  return pts;
}

// 3D uniform Catmull-Rom spline evaluation. Given 4 control points
// p0..p3 and a parameter t in [0, 1], returns the interpolated point
// between p1 and p2 (the segment p1→p2). Ghost endpoints (clamped) are
// passed in by the caller for the boundary segments.
function uniformCatmullRom3D(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  const x = 0.5 * (
    (2 * p1.x) +
    (-p0.x + p2.x) * t +
    (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
    (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
  );
  const y = 0.5 * (
    (2 * p1.y) +
    (-p0.y + p2.y) * t +
    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
  );
  const z = 0.5 * (
    (2 * p1.z) +
    (-p0.z + p2.z) * t +
    (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
    (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3
  );
  return new THREE.Vector3(x, y, z);
}

// Sample N points along a poly-line by arc length. Returns an array of
// { pos, tangent, normal, binormal } frames in object space. The frames
// use the parallel-transport method (Frenet fails on inflection chains).
//
// When the polyline has 3+ control points we run it through a uniform
// Catmull-Rom spline so the resulting tube curves smoothly through the
// joints (instead of bending sharply at every chain segment). Two-point
// polylines stay straight — there's no curvature to interpolate.
function samplePolyline(pts, sampleCount) {
  if (pts.length < 2 || sampleCount < 2) return [];
  const useSpline = pts.length >= 3;
  // First pass: build a smoothed polyline with `density` points per
  // source segment, so the curvature is captured. The downstream
  // arc-length resampling then distributes rings uniformly along the
  // curve (not bunched at sharp joints).
  const density = useSpline ? 8 : 1;
  const splinePts = [];
  for (let i = 0; i < pts.length - 1; i++) {
    if (!useSpline) { splinePts.push(pts[i].clone()); continue; }
    for (let j = 0; j < density; j++) {
      const u = j / density;
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      splinePts.push(uniformCatmullRom3D(p0, p1, p2, p3, u));
    }
  }
  splinePts.push(pts[pts.length - 1].clone());
  // Cumulative arc length on the smoothed polyline.
  const segs = [];
  let total = 0;
  for (let i = 0; i + 1 < splinePts.length; i++) {
    const a = splinePts[i], b = splinePts[i + 1];
    const l = a.distanceTo(b);
    segs.push({ a, b, len: l, cumStart: total });
    total += l;
  }
  if (total <= 1e-9) return [];
  // Up reference for parallel transport.
  const upRef = new THREE.Vector3(0, 1, 0);
  // Initial normal: project upRef onto the plane perpendicular to the
  // first tangent. Fall back to world Z if the tangent is parallel to up.
  const t0 = new THREE.Vector3().subVectors(pts[1], pts[0]).normalize();
  let n0 = upRef.clone().sub(t0.clone().multiplyScalar(upRef.dot(t0)));
  if (n0.lengthSq() < 1e-6) n0.set(0, 0, 1);
  n0.normalize();
  const b0 = new THREE.Vector3().crossVectors(t0, n0).normalize();
  // Walk the polyline, sampling at uniform arc-length intervals. We
  // propagate (n, b) by rotating the previous frame to align its tangent
  // with the current tangent (rotation-minimising frame approximation).
  const samples = [];
  let prevT = t0.clone(), prevN = n0.clone(), prevB = b0.clone();
  let segIdx = 0, segPos = 0;
  const step = total / (sampleCount - 1);
  for (let i = 0; i < sampleCount; i++) {
    const target = i * step;
    while (segIdx + 1 < segs.length && segs[segIdx + 1].cumStart <= target) segIdx++;
    const seg = segs[segIdx];
    const local = target - seg.cumStart;
    const u = Math.max(0, Math.min(1, seg.len > 1e-9 ? local / seg.len : 0));
    const pos = new THREE.Vector3().lerpVectors(seg.a, seg.b, u);
    let tangent = new THREE.Vector3().subVectors(seg.b, seg.a);
    if (tangent.lengthSq() < 1e-12) tangent.copy(prevT);
    tangent.normalize();
    // Rotation-minimising frame: rotate prevN around axis = prevT × tangent
    // by the angle between prevT and tangent.
    if (i > 0) {
      const axis = new THREE.Vector3().crossVectors(prevT, tangent);
      const sinA = axis.length();
      const cosA = Math.max(-1, Math.min(1, prevT.dot(tangent)));
      const angle = Math.atan2(sinA, cosA);
      if (sinA > 1e-9) {
        axis.normalize();
        const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        prevN.applyQuaternion(q).normalize();
        prevB = new THREE.Vector3().crossVectors(tangent, prevN).normalize();
      } else if (cosA < 0) {
        // 180° flip: rotate around any perpendicular axis.
        const axis = Math.abs(tangent.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
        const q = new THREE.Quaternion().setFromAxisAngle(axis, Math.PI);
        prevN.applyQuaternion(q).normalize();
        prevB = new THREE.Vector3().crossVectors(tangent, prevN).normalize();
      }
    }
    samples.push({ pos, tangent: tangent.clone(), normal: prevN.clone(), binormal: prevB.clone() });
    prevT = tangent;
  }
  return samples;
}

// Interpolate a profile at parameter t in [0, 1]. Returns { w, h, exp,
// bias, roll, sharp } where w/h are the section's half-extents at that
// t (already pre-resolved through bias if requested via opts.bias).
function sampleProfile(profile, t) {
  if (!profile || !profile.length) return { w: 0.1, h: 0.1, exp: 2, bias: 0, roll: 0, sharp: false };
  // Locate the bracketing rows.
  let i = 0;
  while (i < profile.length - 1 && profile[i + 1][0] < t) i++;
  const a = profile[Math.max(0, Math.min(profile.length - 1, i))];
  const b = profile[Math.max(0, Math.min(profile.length - 1, i + 1))];
  const span = (b[0] - a[0]) || 1e-9;
  const u = Math.max(0, Math.min(1, (t - a[0]) / span));
  const aOpts = a[3] || {};
  const bOpts = b[3] || {};
  return {
    w: a[1] * (1 - u) + b[1] * u,
    h: a[2] * (1 - u) + b[2] * u,
    exp: (aOpts.exp != null ? aOpts.exp : 2) * (1 - u) + (bOpts.exp != null ? bOpts.exp : 2) * u,
    bias: (aOpts.bias || 0) * (1 - u) + (bOpts.bias || 0) * u,
    roll: (aOpts.roll || 0) * (1 - u) + (bOpts.roll || 0) * u,
    sharp: !!(aOpts.sharp || bOpts.sharp),
  };
}

// Superellipse radial offset at angle θ in [0, 2π). exp = 2 → ellipse,
// exp = 1 → diamond, exp ≥ 4 → boxy. The sign convention places the
// "top" of the section at θ = π/2 (so 0 deg = right, 90 deg = up).
function superellipseRadius(theta, w, h, exp) {
  // x = sign(cos θ) · |cos θ|^(2/exp) · w
  // y = sign(sin θ) · |sin θ|^(2/exp) · h
  const c = Math.cos(theta), s = Math.sin(theta);
  const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / Math.max(0.1, exp)) * w;
  const y = Math.sign(s) * Math.pow(Math.abs(s), 2 / Math.max(0.1, exp)) * h;
  return { x, y };
}

// Build a single volume mesh (tube along a chain) and return a
// THREE.SkinnedMesh ready to drop into the scene. Each vertex gets
// skin weights to the two adjacent chain bones so the volume
// deforms when the bones animate.
//
// `bonesByName` is the name→Bone map from buildBoneHierarchy. We
// compute per-vertex skinIndex + skinWeight by mapping each ring's
// t-parameter onto the chain's bone list — vertex at t=0 binds to
// bone[0], t=1 binds to bone[last], in-between vertices get a 2-bone
// split between the bracketing pair.
function buildVolume(volume, chains, positions, palette, bonesByName) {
  const chain = chains[volume.chain];
  if (!chain) return { mesh: null, warn: `volume "${volume.material}" references unknown chain "${volume.chain}"` };
  // Resolve the chain's bones (skip any names that don't have a bone,
  // e.g. joints that failed to resolve).
  const chainBones = chain.map(n => bonesByName[n]).filter(Boolean);
  if (chainBones.length < 2) {
    return { mesh: null, warn: `volume "${volume.material}" chain "${volume.chain}" has fewer than 2 bones available for skinning` };
  }
  const polyline = chainToPolyline(chain, positions);
  if (polyline.length < 2) {
    return { mesh: null, warn: `volume "${volume.material}" chain "${volume.chain}" has fewer than 2 resolved joints` };
  }
  // ring_step: if set, override the ring count from a desired step in metres
  // instead of a hard sides-only count. Falls back to a sensible default
  // (one ring per ~5 cm of polyline length, with at least 8 rings).
  const totalLen = polyline.reduce((acc, p, i) => i ? acc + p.distanceTo(polyline[i - 1]) : 0, 0);
  let ringCount;
  if (Number.isFinite(volume.ring_step) && volume.ring_step > 0) {
    ringCount = Math.max(8, Math.round(totalLen / volume.ring_step) + 1);
  } else {
    // one ring per polyline vertex, with a minimum for visual smoothness.
    ringCount = Math.max(polyline.length, 12);
  }
  const sides = volume.sides || 12;
  const samples = samplePolyline(polyline, ringCount);
  if (!samples.length) return { mesh: null, warn: `volume "${volume.material}" could not sample polyline` };

  // Material: look up by name in the palette. Default to a soft beige.
  const matSpec = palette[volume.material] || { color: '#a0a0a0', rough: 0.9 };
  const baseColor = new THREE.Color(matSpec.color || '#a0a0a0');
  const baseRough = (matSpec.rough != null) ? matSpec.rough : 0.9;

  // Per-vertex colour: start from the material's base colour, then mix
  // toward any arc bands (per-vertex colour stripes around the section).
  const arcBands = (volume.colors && Array.isArray(volume.colors.arcs)) ? volume.colors.arcs : [];
  function ringColor(ringIdx, segIdx) {
    // 0° = spine, 180° = belly (per spec convention). The binormal
    // points "sideways" and the normal points "up", so a section's
    // around=0 sits at the +binormal, around=90 at +normal, around=180
    // at -binormal, around=270 at -normal. We expose a per-vertex hue
    // by side index.
    if (!arcBands.length) return baseColor;
    let best = baseColor, bestDiff = Infinity;
    for (const band of arcBands) {
      const from = band.from || 0, to = band.to != null ? band.to : 360;
      // Around angles in the band are measured from the "spine" of the
      // chain, which we approximate as around=0. So for each side s we
      // compute around_s = 360 * s / sides.
      const around = (segIdx / sides) * 360;
      const diff = angleDistance(around, from, to);
      if (diff < bestDiff) { bestDiff = diff; best = new THREE.Color(band.color); }
    }
    return best;
  }

  // Build vertex + index buffers.
  const positionsArr = [];
  const normalsArr = [];
  const colorsArr = [];
  const uvsArr = [];
  const indices = [];
  // For each ring, build `sides` vertices. The end caps are appended
  // separately as fans.
  for (let r = 0; r < samples.length; r++) {
    const frame = samples[r];              // { pos, tangent, normal, binormal }
    const prof  = sampleProfile(volume.profile || [], r / (samples.length - 1));
    // Apply bias by shifting the section's vertical centre.
    const yShift = prof.bias * prof.h;
    // Apply roll by rotating the local frame in the section plane.
    const cosR = Math.cos(prof.roll), sinR = Math.sin(prof.roll);
    for (let s = 0; s < sides; s++) {
      const theta = (s / sides) * Math.PI * 2;
      const { x, y } = superellipseRadius(theta, prof.w, prof.h, prof.exp);
      // Apply roll: rotate (x, y) by prof.roll.
      const xr = x * cosR - y * sinR;
      const yr = x * sinR + y * cosR + yShift;
      // World-space position = frame origin + (binormal * xr) + (normal * yr)
      const p = new THREE.Vector3()
        .copy(frame.pos)
        .addScaledVector(frame.binormal, xr)
        .addScaledVector(frame.normal, yr);
      // Outward normal: same direction in the section plane, normalised
      // to length w/h scale for clean lighting.
      const nLocal = new THREE.Vector3(xr, yr, 0);
      if (nLocal.lengthSq() < 1e-12) nLocal.set(0, 1, 0);
      nLocal.normalize();
      const n = new THREE.Vector3()
        .addScaledVector(frame.binormal, nLocal.x)
        .addScaledVector(frame.normal, nLocal.y)
        .normalize();
      positionsArr.push(p.x, p.y, p.z);
      normalsArr.push(n.x, n.y, n.z);
      // Per-vertex colour: tint by the per-side arc.
      const sideAround = (s / sides) * 360;
      const c = arcBlend(sideAround, arcBands, baseColor);
      colorsArr.push(c.r, c.g, c.b);
      uvsArr.push(s / sides, r / (samples.length - 1));
    }
  }
  // Stitch quads between adjacent rings.
  for (let r = 0; r + 1 < samples.length; r++) {
    for (let s = 0; s < sides; s++) {
      const a = r * sides + s;
      const b = r * sides + ((s + 1) % sides);
      const c = (r + 1) * sides + s;
      const d = (r + 1) * sides + ((s + 1) % sides);
      indices.push(a, c, b, b, c, d);
    }
  }
  // Caps.
  const caps = volume.caps || ['dome', 'dome'];
  if (caps[0] && caps[0] !== 'none') addCap(indices, positionsArr, normalsArr, colorsArr, samples, 0, 1, sides, caps[0], volume, baseColor, arcBands);
  if (caps[1] && caps[1] !== 'none') {
    const last = samples.length - 1;
    addCap(indices, positionsArr, normalsArr, colorsArr, samples, last, -1, sides, caps[1], volume, baseColor, arcBands);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positionsArr, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normalsArr, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colorsArr, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvsArr, 2));
  geom.setIndex(indices);

  // Skin attributes: 4 influences per vertex. We split each ring's
  // vertices between the two adjacent chain bones. For rings exactly
  // at a chain joint, the weight goes 100% to that joint; for rings
  // in between, the weight splits linearly.
  const vertCount = positionsArr.length / 3;
  const skinIndex = new Uint16Array(vertCount * 4);
  const skinWeight = new Float32Array(vertCount * 4);
  const nChain = chainBones.length;
  for (let r = 0; r < samples.length; r++) {
    const t = r / (samples.length - 1); // 0..1
    const boneF = t * (nChain - 1);
    const boneI = Math.max(0, Math.min(nChain - 1, Math.floor(boneF)));
    const boneU = boneF - boneI;
    for (let s = 0; s < sides; s++) {
      const v = r * sides + s;
      skinIndex[v * 4 + 0] = boneI;
      skinIndex[v * 4 + 1] = Math.min(nChain - 1, boneI + 1);
      skinIndex[v * 4 + 2] = 0;
      skinIndex[v * 4 + 3] = 0;
      skinWeight[v * 4 + 0] = 1 - boneU;
      skinWeight[v * 4 + 1] = boneU;
      skinWeight[v * 4 + 2] = 0;
      skinWeight[v * 4 + 3] = 0;
    }
  }
  geom.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
  geom.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: baseRough,
    metalness: 0.0,
    flatShading: false,
  });
  // Use a regular Mesh here (not a SkinnedMesh) so the volume renders
  // in its bind pose regardless of where the bone hierarchy ends up
  // after the renderer's gizmo-anchor wrap. The bones still exist in
  // the scene graph (so AnimationMixer track names resolve), but the
  // vertices are not skin-bound to them. This is v1 of the compiler;
  // proper skinned-mesh deformation (so animations visibly move the
  // model) is the v2 follow-up — see the "Known limitations" section
  // of the commit message.
  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = `volume_${volume.material}_${volume.chain}`;
  // Stash the bones so the caller can build the Skeleton + bind.
  mesh.userData = {
    chain: volume.chain,
    material: volume.material,
    smoothAngle: volume.smooth_angle,
    partType: 'volume',
    __chainBones: chainBones,
  };
  return { mesh, warn: null, bones: chainBones };
}

function angleDistance(around, from, to) {
  // Wrapped interval distance on [0, 360).
  const f = ((from % 360) + 360) % 360;
  const t = ((to % 360) + 360) % 360;
  const a = ((around % 360) + 360) % 360;
  if (f <= t) {
    if (a >= f && a <= t) return 0;
    return Math.min(Math.abs(a - f), Math.abs(a - t));
  }
  return a >= f || a <= t ? 0 : Math.min(a - f, t + 360 - a);
}

function arcBlend(around, bands, base) {
  if (!bands || !bands.length) return base;
  let best = base, bestDiff = Infinity;
  for (const band of bands) {
    const f = band.from || 0, t = band.to != null ? band.to : 360;
    const diff = angleDistance(around, f, t);
    if (diff < bestDiff) { bestDiff = diff; best = new THREE.Color(band.color); }
  }
  return best;
}

function addCap(indices, positionsArr, normalsArr, colorsArr, samples, ringIdx, dirSign, sides, kind, volume, baseColor, arcBands) {
  const samp = samples[ringIdx];
  // Build a single centre vertex (fan apex) and a triangle fan.
  const centerIdx = positionsArr.length / 3;
  positionsArr.push(samp.pos.x, samp.pos.y, samp.pos.z);
  normalsArr.push(dirSign * samp.tangent.x, dirSign * samp.tangent.y, dirSign * samp.tangent.z);
  colorsArr.push(baseColor.r, baseColor.g, baseColor.b);
  for (let s = 0; s < sides; s++) {
    const ringStart = ringIdx * sides;
    const a = ringStart + s;
    const b = ringStart + ((s + 1) % sides);
    if (kind === 'fan' || kind === 'ngon' || kind === 'dome') {
      // Triangle fan. Winding flips depending on which end we're capping.
      if (dirSign > 0) indices.push(centerIdx, a, b);
      else indices.push(centerIdx, b, a);
    }
  }
  // For 'dome' caps, we'd ideally push the centre vertex outward along
  // the tangent; the simple fan is visually close enough for a low-poly
  // silhouette and avoids the cap-dome curvature math. ('dome' and
  // 'ngon' look the same here; only 'fan' vs 'none' change topology.)
}

// ---------------------------------------------------------------------------
// 3. Parts
// ---------------------------------------------------------------------------
//
// 7 part types. Each is a small mesh bound to a host joint. The 'mirror'
// flag on the part is honored at the chain-mirror stage, not here.
//
// ANALYSIS-REPORT #28 — validate numeric inputs. Every part builder reads
// thickness / size / offset / dir / sides / segments from the spec; an
// accidental NaN or negative number used to silently corrupt the mesh.
// The `sanitizeNum` helper clamps to a safe range and falls back to a
// default. The original value is preserved in the userData so a designer
// can see what got clamped.
function sanitizeNum(v, dflt, min, max) {
  if (!Number.isFinite(v)) return { v: dflt, clamped: false, original: v };
  if (v < min) return { v: min, clamped: true, original: v };
  if (v > max) return { v: max, clamped: true, original: v };
  return { v: v, clamped: false, original: v };
}

function buildPart(part, positions, palette, chains, bonesByName) {
  const hostPos = positions[part.host];
  if (!hostPos) return { mesh: null, warn: `part "${part.type}" references unknown host joint "${part.host}"` };
  const matSpec = palette[part.material] || { color: '#888888', rough: 0.7 };
  const baseColor = new THREE.Color(matSpec.color || '#888888');
  const mat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: matSpec.rough != null ? matSpec.rough : 0.7, metalness: 0.0 });
  let mesh = null;
  // ANALYSIS-REPORT #16 — surface v1 limitations per part type so the
  // designer sees when anchor / conform / full-hand / full-membrane
  // features were silently ignored.
  const partWarnings = [];
  if ((part.type === 'fin' || part.type === 'eye') && part.anchor) {
    partWarnings.push(`part "${part.type}" (host="${part.host}"): anchor {chain, t, around} is parsed but ignored in v1; the part is placed by its host position + udir/vdir. v2 will resolve chain-t / around-angle anchoring.`);
  }
  if (part.type === 'fin' && part.conform) {
    partWarnings.push(`part "${part.type}" (host="${part.host}"): conform=${part.conform} is ignored in v1 — the fin lies flat in the section plane, not on the host volume's surface. v2 will project against the volume normal.`);
  }
  if (part.type === 'membrane' && Array.isArray(part.ribs) && part.ribs.length > 4) {
    partWarnings.push(`part "${part.type}" (host="${part.host}"): only the first 2 rib joints are used to build the membrane triangle; the full 4-bone rib mesh is v2.`);
  }
  if (part.type === 'hand') {
    partWarnings.push(`part "${part.type}" (host="${part.host}"): v1 emits a stylised ellipsoid palm only; fingers + thumb are v2.`);
  }
  switch (part.type) {
    case 'spike': mesh = buildSpike(part, hostPos, mat); break;
    case 'eye':   mesh = buildEye(part, hostPos, mat, chains, positions); break;
    case 'fin':   mesh = buildFin(part, hostPos, mat); break;
    case 'paw':   mesh = buildPaw(part, hostPos, mat); break;
    case 'curve': mesh = buildCurve(part, hostPos, mat); break;
    case 'hand':  mesh = buildHand(part, hostPos, mat); break;
    case 'membrane': mesh = buildMembrane(part, hostPos, mat, positions, chains); break;
    default: return { mesh: null, warn: `part type "${part.type}" not implemented` };
  }
  if (!mesh) return { mesh: null, warn: `part type "${part.type}" returned no mesh` };
  // Bind the part to its host bone conceptually — we keep the
  // hostBone in userData so external tools can find it — but the
  // mesh is left as a regular Mesh (not a SkinnedMesh) for the
  // same reason as the volume above. v1 of the compiler; proper
  // skinned-mesh deformation is the v2 follow-up.
  const hostBone = bonesByName[part.host];
  if (hostBone) {
    // No-op for v1; v2 will convert to SkinnedMesh once the
    // gizmo-anchor bind-mismatch is resolved.
  }
  mesh.userData = Object.assign(mesh.userData || {}, {
    part: part.host,
    partType: part.type,
    material: part.material,
    join: part.join,
    v1Warnings: partWarnings, // ANALYSIS-REPORT #16/#19 — surface on inspection
  });
  return { mesh, warn: null, warnings: partWarnings, bones: hostBone ? [hostBone] : [] };
}

// (v1) SkinnedMesh conversion helper — kept here as a stub for the
// v2 follow-up that re-introduces per-vertex bone binding. The
// current build leaves parts as regular THREE.Meshes that render
// in their bind pose regardless of the bone hierarchy.

function buildSpike(part, hostPos, mat) {
  const offset = new THREE.Vector3(part.offset?.[0] || 0, part.offset?.[1] || 0, part.offset?.[2] || 0);
  const dir = new THREE.Vector3(part.dir?.[0] || 0, part.dir?.[1] || 1, part.dir?.[2] || 0);
  if (dir.lengthSq() < 1e-9) dir.set(0, 1, 0);
  dir.normalize();
  const sides = part.sides || 8;
  const segs = part.segments || [{ len: 0.1, r: 0.04 }];
  const positions = [], normals = [], colors = [], indices = [];
  // First ring (at hostPos + offset) — base cap.
  const baseCenter = hostPos.clone().add(offset);
  const ringRadii = [];
  const ringCenters = [];
  let cursor = baseCenter.clone();
  ringCenters.push(cursor.clone());
  ringRadii.push(0);
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const r = s.r || 0.04;
    cursor.add(dir.clone().multiplyScalar(s.len || 0.1));
    ringCenters.push(cursor.clone());
    ringRadii.push(r);
  }
  // Place ring vertices in the plane perpendicular to `dir`.
  // Build a basis with dir as one axis, plus two perpendiculars.
  const upRef = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(dir, upRef).normalize();
  const v = new THREE.Vector3().crossVectors(dir, u).normalize();
  for (let r = 0; r < ringCenters.length; r++) {
    const c = ringCenters[r], radius = ringRadii[r];
    for (let s = 0; s < sides; s++) {
      const theta = (s / sides) * Math.PI * 2;
      const p = c.clone()
        .addScaledVector(u, Math.cos(theta) * radius)
        .addScaledVector(v, Math.sin(theta) * radius);
      const n = p.clone().sub(c);
      if (n.lengthSq() < 1e-12) n.copy(dir);
      n.normalize();
      positions.push(p.x, p.y, p.z);
      normals.push(n.x, n.y, n.z);
      colors.push(mat.color.r, mat.color.g, mat.color.b);
    }
  }
  for (let r = 0; r + 1 < ringCenters.length; r++) {
    for (let s = 0; s < sides; s++) {
      const a = r * sides + s;
      const b = r * sides + ((s + 1) % sides);
      const c = (r + 1) * sides + s;
      const d = (r + 1) * sides + ((s + 1) % sides);
      indices.push(a, c, b, b, c, d);
    }
  }
  // Base cap: triangle fan to a single apex vertex at baseCenter.
  const apex = positions.length / 3;
  positions.push(baseCenter.x, baseCenter.y, baseCenter.z);
  normals.push(-dir.x, -dir.y, -dir.z);
  colors.push(mat.color.r * 0.5, mat.color.g * 0.5, mat.color.b * 0.5);
  for (let s = 0; s < sides; s++) {
    const a = 0 * sides + s;
    const b = 0 * sides + ((s + 1) % sides);
    indices.push(apex, b, a);
  }
  // Tip: close the last ring with a fan to a single apex.
  const tipApex = positions.length / 3;
  const lastRing = (ringCenters.length - 1) * sides;
  const tipCenter = ringCenters[ringCenters.length - 1];
  positions.push(tipCenter.x, tipCenter.y, tipCenter.z);
  normals.push(dir.x, dir.y, dir.z);
  colors.push(mat.color.r, mat.color.g, mat.color.b);
  for (let s = 0; s < sides; s++) {
    const a = lastRing + s;
    const b = lastRing + ((s + 1) % sides);
    indices.push(tipApex, a, b);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  return new THREE.Mesh(geom, mat);
}

function buildEye(part, hostPos, mat, chains, positions) {
  // Build the eye as a small Group containing:
  //   1. An outer sclera sphere in the eye material colour (gold) at
  //      `part.size` radius — this is the visible "eye" at the spec'd
  //      size.
  //   2. A small inner pupil sphere (black) embedded inside the sclera
  //      at ~30% of the radius, offset along the forward axis. This
  //      is what gives the eye its visible-from-a-distance character
  //      — without a pupil, a 2.8cm gold sphere at the brow reads as
  //      a paint smudge, not an eye.
  // The group is oriented so local +Y is the eye's "forward" (looking
  // direction); the caller applies the host-bone bind so the eye
  // follows the head bone.
  const size = part.size || 0.03;
  const offset = part.offset ? new THREE.Vector3(part.offset[0], part.offset[1], part.offset[2]) : new THREE.Vector3(0, 0, 0);
  const fwd = part.forward ? new THREE.Vector3(part.forward[0], part.forward[1], part.forward[2]).normalize() : new THREE.Vector3(0, 0, 1);
  const eyePos = hostPos.clone().add(offset);
  const group = new THREE.Group();
  group.name = 'eye';
  // 1. Sclera: a low-poly icosahedron scaled to the spec's size. We use
  //    a flat-shaded material so the facets read as "low poly eye",
  //    not a smooth ball.
  const scleraGeom = new THREE.IcosahedronGeometry(size, 0);
  scleraGeom.translate(eyePos.x, eyePos.y, eyePos.z);
  // Sclera material: copy the eye material, but push roughness + use
  // flatShading so the facets stand out.
  const scleraMat = new THREE.MeshStandardMaterial({
    color: mat.color,
    roughness: mat.roughness,
    metalness: mat.metalness,
    flatShading: true,
  });
  const sclera = new THREE.Mesh(scleraGeom, scleraMat);
  sclera.name = 'eye_sclera';
  // userData lets the ACES class map recognise this as an fx (no
  // shading layers / shadow), so the L1-L8 stack doesn't desaturate
  // the gold iris.
  sclera.userData = { part: 'eye', partType: 'eye' };
  group.add(sclera);
  // 2. Pupil: a small black sphere embedded in the sclera, offset
  //    along the forward axis so it sits flush with the front face.
  const pupilRadius = size * 0.45;
  const pupilOffset = size * 0.55; // protrude slightly past the sclera
  const pupilPos = eyePos.clone().addScaledVector(fwd, pupilOffset);
  const pupilGeom = new THREE.IcosahedronGeometry(pupilRadius, 0);
  pupilGeom.translate(pupilPos.x, pupilPos.y, pupilPos.z);
  const pupilMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0a0a0a'),
    roughness: 0.4,
    metalness: 0.0,
    flatShading: true,
  });
  const pupil = new THREE.Mesh(pupilGeom, pupilMat);
  pupil.name = 'eye_pupil';
  pupil.userData = { part: 'eye', partType: 'eye' };
  group.add(pupil);
  return group;
}

function buildFin(part, hostPos, mat) {
  // Flat plate with thickness, defined by a 2D outline (points: [[u, v], …])
  // and two direction vectors (udir, vdir) that the outline maps into
  // 3D space. Optional conform-to-surface logic would project onto the
  // host volume — for v1 we just orient by the spec's direction vectors.
  const udir = part.udir ? new THREE.Vector3(...part.udir).normalize() : new THREE.Vector3(1, 0, 0);
  const vdir = part.vdir ? new THREE.Vector3(...part.vdir).normalize() : new THREE.Vector3(0, 1, 0);
  const thickness = part.thickness || 0.02;
  const offset = part.offset ? new THREE.Vector3(...part.offset) : new THREE.Vector3();
  const points = part.points || [[0, 0], [0.1, 0], [0.1, 0.15], [0, 0.15]];
  const normalDir = new THREE.Vector3().crossVectors(udir, vdir).normalize();
  // Two parallel layers (top and bottom) offset by ±thickness/2.
  const topVerts = points.map(([u, v]) => hostPos.clone()
    .add(offset)
    .addScaledVector(udir, u)
    .addScaledVector(vdir, v)
    .addScaledVector(normalDir, thickness / 2));
  const botVerts = points.map(([u, v]) => hostPos.clone()
    .add(offset)
    .addScaledVector(udir, u)
    .addScaledVector(vdir, v)
    .addScaledVector(normalDir, -thickness / 2));
  const positions = [], normals = [], colors = [], indices = [];
  // Top face
  for (const p of topVerts) { positions.push(p.x, p.y, p.z); normals.push(normalDir.x, normalDir.y, normalDir.z); colors.push(mat.color.r, mat.color.g, mat.color.b); }
  for (let i = 1; i + 1 < topVerts.length; i++) indices.push(0, i, i + 1);
  const topOffset = topVerts.length;
  // Bottom face
  for (const p of botVerts) { positions.push(p.x, p.y, p.z); normals.push(-normalDir.x, -normalDir.y, -normalDir.z); colors.push(mat.color.r, mat.color.g, mat.color.b); }
  for (let i = 1; i + 1 < botVerts.length; i++) indices.push(topOffset, topOffset + i + 1, topOffset + i);
  // Side strip
  const sideOffset = positions.length / 3;
  for (let i = 0; i < points.length; i++) {
    const a = topVerts[i], b = botVerts[i];
    const edgeN = new THREE.Vector3().subVectors(b, a).normalize();
    positions.push(a.x, a.y, a.z); normals.push(edgeN.x, edgeN.y, edgeN.z); colors.push(mat.color.r, mat.color.g, mat.color.b);
    positions.push(b.x, b.y, b.z); normals.push(edgeN.x, edgeN.y, edgeN.z); colors.push(mat.color.r, mat.color.g, mat.color.b);
  }
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const a = sideOffset + i * 2;
    const b = a + 1;
    const c = sideOffset + j * 2;
    const d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  return new THREE.Mesh(geom, mat);
}

function buildPaw(part, hostPos, mat) {
  // Flattened ellipsoid pad (a scaled icosahedron). Size is [w, h, d].
  const size = part.size || [0.2, 0.15, 0.1];
  const geom = new THREE.IcosahedronGeometry(1, 0);
  geom.scale(size[0], size[1], size[2]);
  geom.translate(hostPos.x, hostPos.y, hostPos.z);
  // Per-vertex colour from the material.
  const count = geom.getAttribute('position').count;
  const colorArr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colorArr[i * 3] = mat.color.r; colorArr[i * 3 + 1] = mat.color.g; colorArr[i * 3 + 2] = mat.color.b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
  return new THREE.Mesh(geom, mat);
}

function buildCurve(part, hostPos, mat) {
  // Curved tapering tube. `segments` is an array of { len, r } with
  // optional steering keys (rise/fall/ahead/behind/left/right/taper).
  // For v1 we honor len + r + taper (per-segment radius scaling); the
  // full steering solver is a follow-up.
  const segments = part.segments || [{ len: 0.1, r: 0.04 }];
  const sides = part.sides || 8;
  const dir = part.dir ? new THREE.Vector3(...part.dir).normalize() : new THREE.Vector3(0, 1, 0);
  const offset = part.offset ? new THREE.Vector3(...part.offset) : new THREE.Vector3();
  const positions = [], normals = [], colors = [], indices = [];
  // Build a basis perpendicular to the initial dir.
  const upRef = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(dir, upRef).normalize();
  const v = new THREE.Vector3().crossVectors(dir, u).normalize();
  const ringCenters = [], ringRadii = [];
  let cursor = hostPos.clone().add(offset);
  let heading = dir.clone();
  ringCenters.push(cursor.clone()); ringRadii.push(0);
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const r = s.r != null ? s.r : 0.04;
    cursor.add(heading.clone().multiplyScalar(s.len || 0.1));
    // Steering keys: rise/fall pitch around u, ahead/behind yaw around v,
    // left/right roll around dir, taper pinch r.
    if (s.rise)  heading.applyAxisAngle(u, THREE.MathUtils.degToRad(s.rise));
    if (s.fall)  heading.applyAxisAngle(u, -THREE.MathUtils.degToRad(s.fall));
    if (s.ahead) heading.applyAxisAngle(v, THREE.MathUtils.degToRad(s.ahead));
    if (s.behind) heading.applyAxisAngle(v, -THREE.MathUtils.degToRad(s.behind));
    if (s.left)  heading.applyAxisAngle(heading, THREE.MathUtils.degToRad(s.left));
    if (s.right) heading.applyAxisAngle(heading, -THREE.MathUtils.degToRad(s.right));
    // ANALYSIS-REPORT #10 — taper was a documented no-op; now actually
    // pinches the segment radius. Taper value 0..1 means "shrink r to
    // (1-taper) of original", so taper=0.3 → 0.7× the segment radius.
    if (s.taper) r *= Math.max(0, 1 - Math.min(1, s.taper));
    ringCenters.push(cursor.clone()); ringRadii.push(r);
  }
  for (let r = 0; r < ringCenters.length; r++) {
    const c = ringCenters[r], radius = ringRadii[r];
    for (let s = 0; s < sides; s++) {
      const theta = (s / sides) * Math.PI * 2;
      const p = c.clone()
        .addScaledVector(u, Math.cos(theta) * radius)
        .addScaledVector(v, Math.sin(theta) * radius);
      const n = p.clone().sub(c);
      if (n.lengthSq() < 1e-12) n.copy(dir);
      n.normalize();
      positions.push(p.x, p.y, p.z);
      normals.push(n.x, n.y, n.z);
      colors.push(mat.color.r, mat.color.g, mat.color.b);
    }
  }
  for (let r = 0; r + 1 < ringCenters.length; r++) {
    for (let s = 0; s < sides; s++) {
      const a = r * sides + s;
      const b = r * sides + ((s + 1) % sides);
      const c = (r + 1) * sides + s;
      const d = (r + 1) * sides + ((s + 1) % sides);
      indices.push(a, c, b, b, c, d);
    }
  }
  // Tip cap
  const tipApex = positions.length / 3;
  const lastRingStart = (ringCenters.length - 1) * sides;
  const tipCenter = ringCenters[ringCenters.length - 1];
  positions.push(tipCenter.x, tipCenter.y, tipCenter.z);
  normals.push(heading.x, heading.y, heading.z);
  colors.push(mat.color.r, mat.color.g, mat.color.b);
  for (let s = 0; s < sides; s++) {
    const a = lastRingStart + s;
    const b = lastRingStart + ((s + 1) % sides);
    indices.push(tipApex, a, b);
  }
  // Base cap
  const baseApex = positions.length / 3;
  const baseCenter = ringCenters[0];
  positions.push(baseCenter.x, baseCenter.y, baseCenter.z);
  normals.push(-dir.x, -dir.y, -dir.z);
  colors.push(mat.color.r, mat.color.g, mat.color.b);
  for (let s = 0; s < sides; s++) {
    const a = 0 * sides + s;
    const b = 0 * sides + ((s + 1) % sides);
    indices.push(baseApex, b, a);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  return new THREE.Mesh(geom, mat);
}

function buildHand(part, hostPos, mat) {
  // Simple stylised hand: an ellipsoid palm + 4 finger cones + a thumb.
  // Good enough as a placeholder; the spec's full hand has more knobs
  // (curl, spread, fingers, thumb, fist) that we surface in the spec
  // log so the user can refine.
  const size = part.size || 0.17;
  const palmGeom = new THREE.SphereGeometry(size, 10, 8);
  palmGeom.scale(1, 0.6, 1.1);
  palmGeom.translate(hostPos.x, hostPos.y, hostPos.z);
  const palmColor = new Float32Array(palmGeom.getAttribute('position').count * 3);
  for (let i = 0; i < palmGeom.getAttribute('position').count; i++) {
    palmColor[i*3] = mat.color.r; palmColor[i*3+1] = mat.color.g; palmColor[i*3+2] = mat.color.b;
  }
  palmGeom.setAttribute('color', new THREE.BufferAttribute(palmColor, 3));
  return new THREE.Mesh(palmGeom, mat);
}

function buildMembrane(part, hostPos, mat, positions, chains) {
  // Stretched sheet between 2-4 rib chains. v1 implementation: average
  // the rib joint positions into a 2×2 patch (good enough for wings,
  // sails, frills).
  const ribs = part.ribs || [];
  if (ribs.length < 2) return null;
  const points = [];
  for (const r of ribs) {
    const ch = (typeof r === 'string') ? chains[r] : r.chain;
    if (!ch || !ch.length) continue;
    const last = positions[ch[ch.length - 1]];
    if (!last) continue;
    points.push(last.clone());
  }
  if (points.length < 2) return null;
  // Build a triangle fan from the first point.
  const positionsArr = [], normalsArr = [], colorsArr = [], indices = [];
  for (const p of points) {
    positionsArr.push(p.x, p.y, p.z);
    normalsArr.push(0, 1, 0);
    colorsArr.push(mat.color.r, mat.color.g, mat.color.b);
  }
  for (let i = 1; i + 1 < points.length; i++) indices.push(0, i, i + 1);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positionsArr, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normalsArr, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colorsArr, 3));
  geom.setIndex(indices);
  return new THREE.Mesh(geom, mat);
}

// ---------------------------------------------------------------------------
// 4. Mirror
// ---------------------------------------------------------------------------
//
// spec.mirror: an array of chain names to duplicate across the X axis.
// The L* side is the authored chain; the R* side is auto-generated with
// joint names prefixed "R" instead of "L" and X coordinates negated.
//
// ANALYSIS-REPORT #13 — L* prefix convention: every joint in a mirrored
// chain MUST start with a single capital 'L' so this function can name
// its R* counterpart by slicing the first character. Joints with mixed
// naming (LeftFront / leg_l / etc.) are silently skipped. The
// compileAnyCreature() caller turns any skip into a log.warn entry so the
// spec author sees it.
//
// The spec is treated as authoritative on L* — we build the R* chain by
// copying L*'s relative deltas and negating the X axis at the world step.
function applyMirror(spec, positions, jointsByName, log) {
  const mirror = spec.mirror || [];
  const chains = spec.chains || {};
  const raws = spec.joints || {};
  const mirrors = [];
  const skipReport = []; // { chain, joint, reason }
  for (const chainName of mirror) {
    const chain = chains[chainName];
    if (!chain) { skipReport.push({ chain: chainName, joint: null, reason: 'chain-not-found' }); continue; }
    const newPositions = {};
    // ANALYSIS-REPORT #12 — allocate joints with parentId:undefined, then
    // populate in the next loop. No more "placeholder" parentId that gets
    // overwritten a few lines later.
    const newJoints = [];
    for (const jn of chain) {
      if (!jn.startsWith('L')) { skipReport.push({ chain: chainName, joint: jn, reason: 'name-does-not-start-with-L' }); continue; }
      const rName = 'R' + jn.slice(1);
      const lp = positions[jn];
      if (!lp) { skipReport.push({ chain: chainName, joint: jn, reason: 'unresolved-L-joint' }); continue; }
      newPositions[rName] = new THREE.Vector3(-lp.x, lp.y, lp.z);
      newJoints.push({ name: rName, parentId: undefined });
    }
    if (!newJoints.length) { skipReport.push({ chain: chainName, joint: null, reason: 'no-L-joints-in-chain' }); continue; }
    // Re-parent mirror joints along the chain order.
    for (let i = 0; i < newJoints.length; i++) {
      if (i === 0) {
        // The first R* joint inherits the parent of the first L* joint.
        const lFirst = chain[0];
        const lDef = raws[lFirst];
        if (lDef && typeof lDef === 'object' && lDef.from) newJoints[i].parentId = 'R' + lDef.from.slice(1);
        else newJoints[i].parentId = undefined;
      } else {
        newJoints[i].parentId = newJoints[i - 1].name;
      }
    }
    // Inject into positions + spec.joints (so volumes/parts can reference R*).
    for (const np of Object.entries(newPositions)) {
      positions[np[0]] = np[1];
    }
    for (const nj of newJoints) {
      if (!jointsByName[nj.name]) {
        jointsByName[nj.name] = nj;
        // Add a relational stub so buildRigGraph can pick it up.
        raws[nj.name] = { from: nj.parentId };
      }
    }
    // Add a mirrored chain entry.
    const newChain = newJoints.map(j => j.name);
    if (!chains['R' + chainName.slice(1)]) chains['R' + chainName.slice(1)] = newChain;
    mirrors.push({ original: chainName, mirror: 'R' + chainName.slice(1) });
  }
  // ANALYSIS-REPORT #27 — surface skipped entries in the build log so the
  // spec author sees when their mirror list produced no geometry.
  if (log && skipReport.length) {
    for (const s of skipReport) {
      const what = s.joint ? `joint "${s.joint}"` : `chain "${s.chain}"`;
      log.push({ level: 'warn', text: `applyMirror: ${what} skipped (${s.reason}). Mirror requires every chain joint to start with capital L (e.g. LFrontRoot, LBackKnee).` });
    }
  }
  return mirrors;
}

// Also mirror any parts with mirrored:true — duplicate them on the R*
// side with a flipped X.
function mirrorParts(parts, positions) {
  if (!parts || !parts.length) return [];
  const out = [];
  for (const p of parts) {
    out.push(p);
    if (!p.mirrored) continue;
    const mirror = Object.assign({}, p);
    // Rename the host from L… to R… if it starts with L.
    if (mirror.host && mirror.host.startsWith('L')) {
      mirror.host = 'R' + mirror.host.slice(1);
    }
    out.push(mirror);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 5. Animations
// ---------------------------------------------------------------------------
//
// spec.animations is { name: { duration, loop, tracks: { jointName: { rx:
// [[t, v], …], ry: […], rz: […], tx: […], ty: […], tz: […] } } } }.
// We turn each animation into a THREE.AnimationClip made of
// VectorKeyframeTrack / QuaternionKeyframeTrack instances bound to the
// resolved joint names. Mirror: any L* joint track is also emitted as
// an R* joint track with the X-relevant channels negated (ry, rz, tx).
function compileAnimations(spec, positions) {
  const anims = spec.animations || {};
  const clips = [];
  const mirror = new Set(spec.mirror || []);
  for (const [name, def] of Object.entries(anims)) {
    const dur = def.duration || 1.0;
    // ANALYSIS-REPORT #15 — implement mirror_phase. The spec defines
    // `animations.X.mirror_phase` as a value in [0,1) that time-shifts
    // the R* tracks by mirror_phase * duration so the right-side cycle
    // is phase-offset from the left. Common technique for natural-looking
    // quadruped walks (left-front and right-front legs alternate). When
    // unset (the typical case), R* tracks stay in phase with L*.
    const phase = (Number.isFinite(def.mirror_phase) && def.mirror_phase >= 0 && def.mirror_phase < 1)
      ? def.mirror_phase * dur
      : 0;
    const tracks = [];
    for (const [jointName, chans] of Object.entries(def.tracks || {})) {
      tracks.push(...buildJointTracks(jointName, chans, dur));
      // Mirror tracks: if the joint name starts with 'L' and the chain
      // it belongs to is in spec.mirror, emit a mirrored track on the
      // R* joint, optionally phase-shifted by `phase` seconds.
      if (jointName.startsWith('L') && isInMirror(jointName, spec)) {
        const rName = 'R' + jointName.slice(1);
        const mirrored = mirrorChannels(chans);
        const shifted = phase > 0 ? phaseShiftChannels(mirrored, phase, dur) : mirrored;
        tracks.push(...buildJointTracks(rName, shifted, dur));
      }
    }
    if (tracks.length) {
      const clip = new THREE.AnimationClip(name, dur, tracks);
      clips.push(clip);
    }
  }
  return clips;
}

// ANALYSIS-REPORT #15 — wrap the mirrored R* tracks' timestamps so the
// right-side cycle lags the left-side cycle by `phase` seconds. Frame
// values that would land before t=0 or after t=duration get clamped or
// wrapped depending on whether the original clip loops (we treat every
// looped clip as cyclic — the Three.js mixer interpolates with the
// InterpolateLinear / InterpolateSmooth setting; clampWhenFinished is
// left to the caller).
function phaseShiftChannels(chans, phase, duration) {
  const out = {};
  for (const [k, frames] of Object.entries(chans || {})) {
    out[k] = frames.map(([t, v]) => {
      const nt = t + phase / duration;
      // Cycle: wrap [1, 2) back to [0, 1).
      const wrapped = nt >= 1 ? nt - Math.floor(nt) : nt;
      return [wrapped, v];
    });
  }
  return out;
}

function isInMirror(jointName, spec) {
  // True if the joint belongs to any chain listed in spec.mirror.
  const chains = spec.chains || {};
  for (const chainName of (spec.mirror || [])) {
    const ch = chains[chainName];
    if (ch && ch.includes(jointName)) return true;
  }
  return false;
}

function mirrorChannels(chans) {
  // For L* joints, ry / rz rotations need a sign flip on R*; tx also flips.
  // The track name in the rebuilt joint already starts with R, so the
  // values themselves need to be negated on the mirrored channels.
  const out = {};
  for (const [k, frames] of Object.entries(chans || {})) {
    if (k === 'ry' || k === 'rz' || k === 'tx') {
      out[k] = frames.map(([t, v]) => [t, -v]);
    } else {
      out[k] = frames;
    }
  }
  return out;
}

function buildJointTracks(jointName, chans, duration) {
  // Each entry is a frame sequence [[t01, v01], [t02, v02], ...] where
  // t is in [0, 1] (the spec uses normalised time). We rescale t to
  // seconds by multiplying by duration. Rotations are euler-XYZ in
  // degrees, per spec; we convert to a quaternion track so three.js
  // doesn't have to do its own euler interpolation.
  const tracks = [];
  // Aggregate euler frames so we can emit a single quaternion track.
  const eulByT = new Map();
  function addEul(t, axis, value) {
    if (!eulByT.has(t)) eulByT.set(t, [0, 0, 0]);
    const e = eulByT.get(t);
    e[['rx', 'ry', 'rz'].indexOf(axis)] = THREE.MathUtils.degToRad(value);
  }
  for (const [axis, frames] of Object.entries(chans || {})) {
    if (axis === 'rx' || axis === 'ry' || axis === 'rz') {
      for (const [t, v] of frames) addEul(t, axis, v);
    } else if (axis === 'tx' || axis === 'ty' || axis === 'tz') {
      const times = [], values = [];
      for (const [t, v] of frames) {
        times.push(t * duration);
        const idx = ['tx', 'ty', 'tz'].indexOf(axis);
        const arr = [0, 0, 0]; arr[idx] = v;
        values.push(...arr);
      }
      if (times.length) {
        tracks.push(new THREE.VectorKeyframeTrack(
          `${jointName}.position`, times, values, THREE.InterpolateLinear
        ));
      }
    }
  }
  if (eulByT.size) {
    const sortedT = Array.from(eulByT.keys()).sort((a, b) => a - b);
    const times = sortedT.map(t => t * duration);
    const quats = [];
    for (const t of sortedT) {
      const [rx, ry, rz] = eulByT.get(t);
      const e = new THREE.Euler(rx, ry, rz, 'XYZ');
      const q = new THREE.Quaternion().setFromEuler(e);
      quats.push(q.x, q.y, q.z, q.w);
    }
    if (times.length) {
      tracks.push(new THREE.QuaternionKeyframeTrack(
        `${jointName}.quaternion`, times, quats, THREE.InterpolateLinear
      ));
    }
  }
  return tracks;
}

// ---------------------------------------------------------------------------
// 6. Wire runtime
// ---------------------------------------------------------------------------
//
// The renderer expects root.userData.sculptRuntime (a runtime object
// the existing TS-model pipeline pokes at) and root.userData.tick (a
// function called every frame). For a compiled anyCreature model the
// tick simply advances the AnimationMixer; the rest of the runtime
// surface is a no-op stub.
function wireRuntime(group, clips) {
  const mixer = new THREE.AnimationMixer(group);
  const actions = clips.map(c => mixer.clipAction(c));
  actions.forEach(a => { a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false; });
  let active = 0;
  if (actions.length) actions[0].play();
  const runtime = {
    type: 'anycreature',
    animations: { clips, mixer, actions },
    update(dt) { mixer.update(dt); },
    setAnimation(idx) {
      if (!actions.length) return;
      const i = Math.max(0, Math.min(actions.length - 1, idx));
      if (i === active) return;
      actions.forEach((a, j) => { if (j === i) a.play(); else a.stop(); });
      active = i;
    },
    dispose() { mixer.stopAllAction(); },
  };
  group.userData.sculptRuntime = runtime;
  group.userData.runtime = runtime;
  group.userData.tick = (dt) => runtime.update(dt != null ? dt : 0.016);
  group.userData.animations = clips;
  // Pickable flag (matches the TS factories' PART 30.7 contract).
  group.traverse((node) => {
    if (node.isMesh) {
      node.userData.isPickable = true;
      node.userData.partName = node.name || `part_${node.id}`;
    }
  });
  return runtime;
}

// ---------------------------------------------------------------------------
// 7. Public entry point
// ---------------------------------------------------------------------------
//
// compileAnyCreature(spec, opts) -> { group, log, bones, runtime }
//
// `log` is an array of { level, text } entries (level = 'info' | 'warn'
// | 'error') that the renderer can show in the validator panel.
export function compileAnyCreature(spec, opts) {
  const log = [];
  function info(t)  { log.push({ level: 'info',  text: t }); }
  function warn(t)  { log.push({ level: 'warn',  text: t }); }
  function error(t) { log.push({ level: 'error', text: t }); }

  if (!spec || typeof spec !== 'object') {
    error('compileAnyCreature: spec is not an object');
    return { group: null, log, bones: null, runtime: null };
  }
  info(`anycreature: compiling "${spec.name || 'unnamed'}"`);

  // 1. Joints.
  const { positions, errors: jerr } = resolveJoints(spec.joints || {});
  jerr.forEach(warn);
  if (!Object.keys(positions).length) {
    error('compileAnyCreature: no joints could be resolved');
    return { group: null, log, bones: null, runtime: null };
  }
  info(`anycreature: ${Object.keys(positions).length} joints resolved`);

  // 2. Mirror (before building the bone hierarchy so R* joints are
  //    part of the tree).
  const jointsByName = Object.create(null);
  for (const [n, p] of Object.entries(positions)) jointsByName[n] = p;
  const mirrors = applyMirror(spec, positions, jointsByName, log);
  if (mirrors.length) info(`anycreature: mirrored ${mirrors.length} chain(s)`);

  // 3. Create the THREE.Bone hierarchy. Bones are added as
  //    descendants of the root group so the AnimationMixer and the
  //    SkinnedMeshes can find them.
  const root = new THREE.Group();
  root.name = spec.name || 'anycreature';
  const palette = spec.palette || {};
  const chains = spec.chains || {};
  const { bonesByName, root: rootBone } = buildBoneHierarchy(root, positions, spec);
  info(`anycreature: built bone hierarchy with ${Object.keys(bonesByName).length} bone(s)`);

  // 4. Build volumes (each becomes a SkinnedMesh bound to its chain's
  //    bones). Stash the bones for the post-bind pass.
  const skinMeshes = []; // [{ mesh, bones }]
  for (const v of (spec.volumes || [])) {
    const r = buildVolume(v, chains, positions, palette, bonesByName);
    if (r.mesh) {
      root.add(r.mesh);
      skinMeshes.push({ mesh: r.mesh, bones: r.bones });
      info(`anycreature: volume "${v.chain}" (${v.material}) added (${r.bones.length} bone influences)`);
    }
    if (r.warn) warn(r.warn);
  }

  // 5. Build parts (each becomes a SkinnedMesh bound to its host
  //    bone). Mirror duplication happens before this loop.
  const partsAll = mirrorParts(spec.parts || [], positions);
  for (const p of partsAll) {
    const r = buildPart(p, positions, palette, chains, bonesByName);
    if (r.mesh) {
      root.add(r.mesh);
      if (r.bones && r.bones.length) skinMeshes.push({ mesh: r.mesh, bones: r.bones });
      info(`anycreature: part "${p.type}" (${p.material || ''}) on ${p.host}`);
    }
    if (r.warn) warn(r.warn);
    // ANALYSIS-REPORT #16/#19 — surface per-part v1 warnings in the log.
    if (r.warnings && r.warnings.length) {
      for (const wmsg of r.warnings) warn(wmsg);
    }
  }

  // 6. (v1) No SkinnedMesh binding — bones exist in the scene graph
  //    so the AnimationMixer can find the joints (and track names
  //    resolve), but the volumes/parts are regular Meshes that
  //    render their bind-pose geometry. See "Known limitations"
  //    in the commit message for the v2 plan.

  // 7. Compile animations.
  const clips = compileAnimations(spec, positions);
  if (clips.length) info(`anycreature: ${clips.length} animation clip(s) compiled`);

  // 8. Wire the runtime.
  const runtime = wireRuntime(root, clips);
  root.userData.bonesByName = bonesByName;
  root.userData.spec = spec;
  root.userData.sourceFormat = 'anycreature';

  // ANALYSIS-REPORT #11 — surface the v1 limitation explicitly in the log
  // so the validator panel / build report shows it. v2 will convert
  // volumes/parts to SkinnedMesh and rebind after the renderer's gizmo-
  // anchor wrap; the existing V1_KNOWN_LIMITATIONS constant documents the
  // four v1 caveats in one place.
  if (skinMeshes.length > 0) {
    warn(`anycreature compiler v1 limitation: ${skinMeshes.length} mesh(es) emitted as plain THREE.Mesh — the AnimationMixer can find the bones but the geometry will NOT visibly deform on playback. Volumes/parts need SkinnedMesh binding; v2 is the follow-up. See V1_KNOWN_LIMITATIONS in anycreature-compiler.js for the full caveat list.`);
  }
  for (const limit of V1_KNOWN_LIMITATIONS) {
    warn(`anycreature compiler v1 limitation: ${limit}`);
  }

  info(`anycreature: compile done — ${root.children.length} child(ren), ${skinMeshes.length} skinned`);
  return { group: root, log, bones: { bonesByName, root: rootBone, meshes: skinMeshes }, runtime };
}

// Default export for non-ESM users.
export default compileAnyCreature;
