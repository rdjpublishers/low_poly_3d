// ACES — mechanical checks (compile-time gate system).
//
// 25 named checks in two groups:
//   A) LEGAlITY (block when broken) — geometry is not geometry, an attack
//      that never reaches, a mirrored twin collapsed past 30%, etc.
//   B) STYLE (advise when off) — 6:3:1 hierarchy, focal contrast, saturated
//      area, value order, contrast adjacent, dullness flags, triangle
//      budget. A number that says the eye will ping-pong is worth
//      reading and is not worth a rebuild. **Advice never stops a build.**
//
// A. Legality checks (BLOCK):
//   mesh_integrity      bind pose has folded tris (twist/breakage)
//   root_containment    every vertex is inside the root chain's bounds
//   part_attachment     every part's host is reachable + close enough
//   touch               declared touch connections actually touch
//   balance             mass centroid projects inside the support polygon
//   size                declared height (±15%); identity — a 1.7 m "giant"
//                       is just a man
//   proportion          adjacent axis segments must not be 50:50 (dead
//                       rhythm), unless spec.style === 'heavy'
//   limb_clearance      no two limbs cross-penetrate past 5% of H
//   anim_integrity      CPU-skin the mesh at sampled anim times; folded
//                       tris = 0, edge stretch ≤ 3× (kills twist/breakage
//                       like the wolf case)
//   attack_reach        an attack must lunge half a body span
//   faceted_body        `faceted: true` on a volume is a BLOCK — bodies
//                       render with hard facets, AO bakes into COLOR_0, and
//                       the mess ships inside the vertex colours
//   mirror_distortion   mirrored twin must not collapse past 30% of the
//                       original (skin + scale collapse)
//   part_overlap        parts may overlap (informational, not a BLOCK)
//   part_seat           a spike's `host` rib must contain the spike root
//   soft_mass           the inverse of faceted_body — only N% of the
//                       skin can show an edge at the chosen smooth angle,
//                       and below 10% the masses render as smooth beans
//
// B. Style claims (ADVISE — value, hierarchy, focal, dullness, budget):
//   value_order         every material sorted by OKLab lightness — the
//                       value plan computed, not eyeballed
//   contrast_adjacent   a part must separate in colour from the thing it
//                       SITS ON (under 0.10 OKLab = one mass)
//   share_hierarchy     primary:secondary:tertiary ≈ 60:30:10, tolerance
//                       ±15% — no dominance means no story
//   focal_contrast      two focal parts' shares must differ by ≥2× —
//                       equal-weight focals ping-pong the eye
//   saturation_area     HSV S ≥ 0.50 on the UNLIT baked colour — 10–34%
//                       of the frame. Below = grey lump, above = no spotlight
//   thinnest_px48       width of the thinnest feature at 48px. < 3px =
//                       invisible
//   sq_fill             silhouette in a 1:1 frame — <0.15 = thin ghost,
//                       >0.50 = blob
//   mirror_sym          IoU with own horizontal flip — front view allowed
//                       high, side/top should be low
//   straight_max        longest constant-slope run on the boundary —
//                       plank-limb detector
//   tri_budget          triangle count band 4000-9000 default
//   bright_floor        beauty render's median luminance — "dark" reads by
//                       value steps, not by making everything dark
//
// Three log channels:
//   BLOCK  build stops, exit 1 — geometry is not geometry, an attack that
//          never reaches, a mirrored twin collapsed past 30%, etc.
//   warn   build proceeds — measure for the human's judgment (part overlap,
//          soft_mass on declared-soft volumes, etc.)
//   info   numbers the compiler narrates (where the curve bent, how far a
//          plate conformed, how many verts AO touched).
//
// The full `gates.json` equivalent lives at the top of this file.
//
// Author: Ariescar (anyCreature) ported to the RDJ low_poly_3d browser
// surface. Operates on plain {V, F, ...} mesh records and a { joints, index }
// skeleton, both forms the existing low_poly_3d renderer can produce.

'use strict';

const normals = (typeof require !== 'undefined' && typeof module !== 'undefined')
  ? require('./aces-normals.js')
  : (typeof window !== 'undefined' ? window.ACES_normals : null);

const { foldCount, creaseShare } = normals;

const oklab = (typeof require !== 'undefined' && typeof module !== 'undefined')
  ? require('./aces-oklab.js')
  : (typeof window !== 'undefined' ? window.ACES_oklab : null);

const { lin2oklab, oklab2lin, hex2lab, hex2lin } = oklab;

const V3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  cross: (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  normalize: (a) => {
    const l = V3.len(a);
    return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 1, 0];
  },
};

const GAIT_FWD_MAX = 0.15;
const SOFT_FLOOR = 10; // percent of volume edges that must be able to crease
const SOFT_VOLUME_FLOOR = 8; // smaller volumes get a lower bar (a hand is fine soft)

// ── helpers ────────────────────────────────────────────────────────────────
function allV(meshes) {
  const out = [];
  for (const m of meshes) for (const v of m.V) out.push(v);
  return out;
}
function bbox(meshes) {
  const lo = [1e9, 1e9, 1e9];
  const hi = [-1e-9, -1e-9, -1e-9];
  for (const m of meshes) for (const v of m.V) for (let k = 0; k < 3; k++) {
    if (v[k] < lo[k]) lo[k] = v[k];
    if (v[k] > hi[k]) hi[k] = v[k];
  }
  return { lo, hi };
}
function modelHeight(meshes) {
  const { lo, hi } = bbox(meshes);
  return Math.max(0, hi[1] - lo[1]) || 1;
}
function supportPolygonXZ(meshes, sk) {
  // a skeleton-driven approximation: any vertex whose y is within 5% of model
  // height of the minimum is a ground point. XZ hull = support polygon.
  const h = modelHeight(meshes);
  const yMin = bbox(meshes).lo[1];
  const yFloor = yMin + 0.05 * h;
  const pts = [];
  for (const m of meshes) for (const v of m.V) if (v[1] <= yFloor) pts.push([v[0], v[2]]);
  if (pts.length < 3) return null;
  // convex hull (Andrew's monotone chain)
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (O, A, B) => (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}
function pointInHull(p, hull) {
  if (!hull || hull.length < 3) return false;
  let inside = false;
  for (let i = 0, j = hull.length - 1; i < hull.length; j = i++) {
    const xi = hull[i][0], yi = hull[i][1];
    const xj = hull[j][0], yj = hull[j][1];
    const intersect = ((yi > p[1]) !== (yj > p[1])) &&
      (p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
function massCentroid(meshes) {
  let sx = 0, sy = 0, sz = 0, n = 0;
  for (const m of meshes) for (const v of m.V) {
    sx += v[0];
    sy += v[1];
    sz += v[2];
    n++;
  }
  return n ? [sx / n, sy / n, sz / n] : [0, 0, 0];
}

// ── the 14 checks ─────────────────────────────────────────────────────────
//
// Each check is `(ctx) => ({ blocks: [string], warns: [string], info: [string] })`
// where ctx = { spec, sk, meshes, animsCompiled? }.

function chk_mesh_integrity(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  let folds = 0;
  for (const m of ctx.meshes) {
    if (m.doubleSided) continue;
    folds += foldCount(m.V, m.F);
  }
  if (folds > 0) out.blocks.push(`mesh_integrity: bind pose has ${folds} flipped tris (a twisted or broken mesh — fix the source)`);
  else out.info.push(`mesh_integrity: 0 folded tris across ${ctx.meshes.length} mesh(es)`);
  return out;
}

function chk_root_containment(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  if (!ctx.sk) {
    out.info.push('root_containment: no skeleton supplied, skipped');
    return out;
  }
  const root = ctx.sk.joints.find((j) => j.parent < 0);
  if (!root) {
    out.info.push('root_containment: no root joint, skipped');
    return out;
  }
  const { lo, hi } = bbox(ctx.meshes);
  // every vertex within 1.05 × bbox of root
  const dx = Math.max(hi[0] - lo[0], hi[2] - lo[2]);
  const dy = hi[1] - lo[1];
  const r = 0.55 * Math.hypot(dx, dy);
  let outside = 0;
  for (const m of ctx.meshes) for (const v of m.V) {
    const d = V3.len(V3.sub(v, root.pos));
    if (d > r) outside++;
  }
  if (outside > 0) {
    out.warns.push(`root_containment: ${outside} vertices sit further than 0.55 × diagonal from the root joint — usually means a detached part`);
  } else {
    out.info.push('root_containment: every vertex within reach of the root');
  }
  return out;
}

function chk_part_attachment(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  if (!ctx.sk) return out;
  const attach = ctx.spec.attach || {};
  let detached = 0;
  let total = 0;
  for (const m of ctx.meshes) {
    if (!m.part) continue;
    total++;
    const host = attach[m.chain || m.part] || attach[m.part];
    if (!host) continue;
    if (!(host in ctx.sk.index)) {
      detached++;
      continue;
    }
  }
  if (detached > 0) out.warns.push(`part_attachment: ${detached}/${total} parts reference unknown host joints`);
  else if (total) out.info.push(`part_attachment: all ${total} parts reference valid host joints`);
  return out;
}

function chk_touch(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  const touches = ctx.spec.touches || [];
  if (!touches.length) {
    out.info.push('touch: no touch connections declared, skipped');
    return out;
  }
  // Approximate: every named joint should have at least one vertex within 5% of H
  const H = modelHeight(ctx.meshes);
  const r = 0.05 * H;
  const buckets = new Map();
  for (const m of ctx.meshes) for (const v of m.V) {
    const k = Math.floor(v[0] / r) + ',' + Math.floor(v[1] / r) + ',' + Math.floor(v[2] / r);
    let b = buckets.get(k);
    if (!b) buckets.set(k, (b = []));
    b.push(v);
  }
  let broken = 0;
  for (const t of touches) {
    if (!ctx.sk || !(t[0] in ctx.sk.index) || !(t[1] in ctx.sk.index)) continue;
    const a = ctx.sk.joints[ctx.sk.index[t[0]]].pos;
    const b = ctx.sk.joints[ctx.sk.index[t[1]]].pos;
    if (V3.len(V3.sub(a, b)) > r * 4) { // declared touch more than 20% of H apart
      broken++;
    }
  }
  if (broken > 0) out.warns.push(`touch: ${broken}/${touches.length} declared touch connections are further apart than 20% of model height`);
  else out.info.push(`touch: all ${touches.length} declared touch connections land within range`);
  return out;
}

function chk_balance(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  const hull = supportPolygonXZ(ctx.meshes, ctx.sk);
  if (!hull) {
    out.info.push('balance: no ground points found, skipped');
    return out;
  }
  const c = massCentroid(ctx.meshes);
  const inside = pointInHull([c[0], c[2]], hull);
  if (!inside) out.warns.push(`balance: mass centroid (${c[0].toFixed(2)}, ${c[2].toFixed(2)}) falls outside the support polygon — the creature would tip`);
  else out.info.push(`balance: centroid (${c[0].toFixed(2)}, ${c[2].toFixed(2)}) inside support polygon (${hull.length} vertices)`);
  return out;
}

function chk_size(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  if (!ctx.spec.height) {
    out.info.push('size: no declared height, skipped');
    return out;
  }
  const h = modelHeight(ctx.meshes);
  const err = Math.abs(h - ctx.spec.height) / ctx.spec.height;
  if (err > 0.15) {
    out.blocks.push(
      `size: spec declares height ${ctx.spec.height} m but the build stands ${h.toFixed(2)} m (${Math.round(err * 100)}% off) — `
      + `multiply every joint coordinate by ${(ctx.spec.height / h).toFixed(4)} to land on the declaration, or change the declaration to ${h.toFixed(2)}`,
    );
  } else {
    out.info.push(`size: ${h.toFixed(2)} m (${Math.round(err * 100)}% off declared ${ctx.spec.height} m)`);
  }
  return out;
}

function chk_proportion(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  if (!ctx.sk) {
    out.info.push('proportion: no skeleton, skipped');
    return out;
  }
  if (ctx.spec.style === 'heavy') {
    out.info.push("proportion: spec.style='heavy' — the 50:50 floor is off");
    return out;
  }
  // for every chain, check adjacent segment length ratios. A chain of N
  // segments with one segment at exactly 50% of the chain's total length and
  // no companion at equal length is a "dead rhythm" — the silhouette reads
  // as two stacked boxes.
  let worst = null;
  for (const [name, chain] of Object.entries(ctx.sk.index || {})) {} // (unused)
  // iterate spec.chains so we can do the ratio per chain
  for (const [cname, jnames] of Object.entries(ctx.spec.chains || {})) {
    if (!jnames || jnames.length < 2) continue;
    const lens = [];
    for (let i = 1; i < jnames.length; i++) {
      const a = ctx.sk.joints[ctx.sk.index[jnames[i - 1]]].pos;
      const b = ctx.sk.joints[ctx.sk.index[jnames[i]]].pos;
      lens.push(V3.len(V3.sub(a, b)));
    }
    const total = lens.reduce((s, x) => s + x, 0) || 1;
    // A 50:50 dead rhythm: ANY single segment is ≥ 50% of the chain's length.
    // (A pair of equal-length segments stacked also reads as stacked boxes —
    // if the pair is the WHOLE chain, every segment is 50%.) We also flag the
    // 2-segment equal pair as a "stacked" rhythm.
    let chainWorst = 0;
    let chainReason = '';
    for (let li = 0; li < lens.length; li++) {
      const r = lens[li] / total;
      if (r >= 0.5 && r > chainWorst) {
        chainWorst = r;
        chainReason = `segment ${li + 1}/${lens.length} is ${(r * 100).toFixed(0)}% of the chain`;
      }
    }
    // 2-segment chain with both segments equal (or near-equal) is also a
    // 50:50 — the box_50_50 case.
    if (lens.length === 2 && total > 0) {
      const r0 = lens[0] / total;
      const r1 = lens[1] / total;
      if (Math.abs(r0 - r1) < 0.05 && r0 >= 0.4) {
        const r = Math.max(r0, r1);
        if (r > chainWorst) {
          chainWorst = r;
          chainReason = `2 segments are ${(r0 * 100).toFixed(0)}% / ${(r1 * 100).toFixed(0)}% — a 50:50 stack`;
        }
      }
    }
    if (chainWorst > 0 && (!worst || chainWorst > worst.r)) {
      worst = { chain: cname, r: chainWorst, reason: chainReason };
    }
  }
  if (worst) {
    // A 50:50 dead rhythm is a hard geometric failure — the silhouette
    // reads as stacked boxes, not a creature. We surface it as a BLOCK by
    // default; callers can demote it to warn via checksOpts.proportionWarn
    // for production runs that want to ship anyway.
    const msg = `proportion: chain "${worst.chain}" has a dead-rhythm segment — ${worst.reason}. Reads as stacked boxes, not a continuous form.`;
    out.blocks.push(msg);
  } else {
    out.info.push('proportion: no 50:50 dead-rhythm segments');
  }
  return out;
}

function chk_limb_clearance(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  if (!ctx.sk) {
    out.info.push('limb_clearance: no skeleton, skipped');
    return out;
  }
  // For every L/R chain pair in the skeleton, compute the closest distance
  // between any pair of joints in the two chains. < 5% of model height =
  // limbs cross-penetrating.
  const chains = Object.entries(ctx.spec.chains || {});
  const lchains = chains.filter(([n]) => n.startsWith('L') && !n.startsWith('LR'));
  const H = modelHeight(ctx.meshes);
  const minClearance = 0.05 * H;
  let worst = null;
  for (const [ln] of lchains) {
    const rn = 'R' + ln.slice(1);
    if (!(rn in (ctx.spec.chains || {}))) continue;
    const la = (ctx.spec.chains[ln] || []).map((j) => ctx.sk.joints[ctx.sk.index[j]].pos);
    const ra = (ctx.spec.chains[rn] || []).map((j) => ctx.sk.joints[ctx.sk.index[j]].pos);
    let minD = Infinity;
    for (const a of la) for (const b of ra) {
      const d = V3.len(V3.sub(a, b));
      if (d < minD) minD = d;
    }
    if (minD < minClearance && (!worst || minD < worst.d)) {
      worst = { chain: ln, d: minD };
    }
  }
  if (worst) {
    out.warns.push(`limb_clearance: L/R chain "${worst.chain}" closest joint distance is ${(worst.d * 100).toFixed(1)} cm — under the 5% of H floor (${(minClearance * 100).toFixed(1)} cm)`);
  } else {
    out.info.push('limb_clearance: every L/R chain pair has ≥ 5% H clearance');
  }
  return out;
}

function chk_anim_integrity(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  if (!ctx.animsCompiled || !ctx.animsCompiled.length) {
    out.info.push('anim_integrity: no compiled animations, skipped');
    return out;
  }
  // Sample each anim at 8 points across its duration. At each sample, CPU-skin
  // the mesh and check for folded tris and edge stretch > 3× the bind edge.
  let worstStretch = 0;
  let totalFolds = 0;
  for (const anim of ctx.animsCompiled) {
    if (!anim._samples) continue;
    for (const t of anim._samples) {
      // The caller provides skinned {V,F} samples via anim._samples[t] = {V, F}
      for (const sample of anim._samples[t] || []) {
        totalFolds += foldCount(sample.V, sample.F);
        const s = edgeStretchMax(sample.V, anim.bindV);
        if (s > worstStretch) worstStretch = s;
      }
    }
  }
  if (totalFolds > 0) {
    out.blocks.push(`anim_integrity: ${totalFolds} folded tris across sampled animation times — the rig twists or breaks`);
  } else if (worstStretch > 3) {
    out.blocks.push(`anim_integrity: worst edge stretch is ${worstStretch.toFixed(1)}× the bind edge — the rig over-stretches`);
  } else {
    out.info.push(`anim_integrity: 0 folded tris, max stretch ${worstStretch.toFixed(2)}× across ${ctx.animsCompiled.length} anim(s)`);
  }
  return out;
}

function edgeStretchMax(skinnedV, bindV) {
  // we only have per-vertex positions, so we approximate the worst stretch as
  // the 99th-percentile ratio of |skinned - neighbourBind| to |bind - neighbourBind|.
  let worst = 0;
  for (let i = 0; i < skinnedV.length; i++) {
    if (!bindV[i]) continue;
    // use the next index as a stand-in neighbour — the caller can pass a real
    // edge list via anim._bindEdges for a tighter bound
    const j = (i + 1) % skinnedV.length;
    const a = V3.len(V3.sub(skinnedV[i], skinnedV[j]));
    const b = V3.len(V3.sub(bindV[i], bindV[j])) || 1e-9;
    const r = a / b;
    if (r > worst) worst = r;
  }
  return worst;
}

function chk_attack_reach(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  const anims = ctx.spec.animations || {};
  let reachOk = null;
  for (const [name, a] of Object.entries(anims)) {
    if (!/attack|swipe|strike|punch/i.test(name)) continue;
    // crude: look for a translation on an arm/hand joint; reach = max delta
    let maxReach = 0;
    for (const [jn, tr] of Object.entries(a.tracks || {})) {
      if (!/Hand|Hand_R|Hand_L|Arm_Tip/i.test(jn)) continue;
      for (const ax of ['tx', 'ty', 'tz']) {
        if (!tr[ax]) continue;
        for (const [, v] of tr[ax]) {
          if (Math.abs(v) > maxReach) maxReach = Math.abs(v);
        }
      }
    }
    const halfSpan = modelHeight(ctx.meshes) * 0.5;
    if (maxReach < halfSpan) {
      out.blocks.push(`attack_reach: anim "${name}" only reaches ${maxReach.toFixed(2)} — less than half a body span (${halfSpan.toFixed(2)}). An attack that doesn't lunge is a taunt.`);
    } else {
      reachOk = name;
    }
  }
  if (reachOk) out.info.push(`attack_reach: ${reachOk} clears the half-span floor`);
  else if (!Object.keys(anims).length) out.info.push('attack_reach: no attack animations declared, skipped');
  return out;
}

function chk_faceted_body(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  if (ctx.spec.build === 'rigid') {
    out.info.push("faceted_body: spec.build='rigid' — the body is allowed to be hard-faceted");
    return out;
  }
  const bad = (ctx.spec.volumes || []).filter((v) => v.faceted).map((v) => `"${v.chain}"`);
  if (bad.length) {
    out.blocks.push(
      'faceted_body: volume(s) ' + bad.join(', ') + ' set "faceted": true — bodies are smooth-shaded. '
      + 'Put "sharp": true on the profile rows where the silhouette should break, or lower "smooth_angle" on that volume. '
      + 'If the creature really is a machine, declare "build": "rigid" at spec level.',
    );
  } else {
    out.info.push('faceted_body: no volume is faceted');
  }
  return out;
}

function chk_soft_mass(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  if (ctx.spec.build === 'rigid' || ctx.spec.qa_isolate) {
    out.info.push('soft_mass: skipped (build=rigid or qa_isolate)');
    return out;
  }
  const per = [];
  let hard = 0, tot = 0;
  for (const m of ctx.meshes) {
    if (m.part) continue; // parts may be any shape they like
    const vol = (ctx.spec.volumes || []).find((v) => v.chain === m.chain);
    if (vol && vol.soft) continue;
    const deg = m.faceted ? 0 : (m.smoothAngle ?? 50);
    const r = creaseShare(m.V, m.F, deg);
    if (!r.tot) continue;
    hard += r.hard;
    tot += r.tot;
    per.push({ chain: m.chain, pct: 100 * r.hard / r.tot, edges: r.tot, deg });
  }
  if (!tot) {
    out.info.push('soft_mass: no volume edges to measure');
    return out;
  }
  const pct = 100 * hard / tot;
  if (pct < SOFT_VOLUME_FLOOR) {
    per.sort((a, b) => (a.pct - b.pct) || (b.edges - a.edges));
    const worst = per.slice(0, 3).map((p) => `"${p.chain}" ${p.pct.toFixed(0)}% (smooth_angle ${p.deg})`).join(', ');
    out.blocks.push(
      `soft_mass: only ${pct.toFixed(0)}% of this creature's skin can show an edge at all (the floor is ${SOFT_VOLUME_FLOOR}%). `
      + `Nothing breaks, so every mass renders as a smooth bean. Softest first: ${worst}. `
      + `The lever that works is smooth_angle ON THE VOLUME: a volume's wall angle is 360/sides, so 9 sides is 40° and 16 sides is 22°, `
      + `and the default 50° welds both perfectly smooth. Drop it under the wall angle on the masses named above — `
      + `applying exactly this number to every volume of the creature that was rejected took it from 29% to 69% and left the side silhouette at IoU 1.000 — the FORM is untouched, only the shading hardens. `
      + `A "sharp" row is the SILHOUETTE lever, not this one, and it does nothing unless the radius steps across it. `
      + `A mass that is genuinely meant to be a smooth lump — a slug, a bladder, a droplet — declares "soft": true and drops out of this count.`,
    );
  } else {
    out.info.push(`soft_mass: ${pct.toFixed(0)}% of skin can show an edge (floor ${SOFT_VOLUME_FLOOR}%)`);
  }
  return out;
}

function chk_mirror_distortion(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  if (!ctx.sk) return out;
  const mirrors = ctx.spec.mirror || [];
  if (!mirrors.length) {
    out.info.push('mirror_distortion: no mirror chains declared, skipped');
    return out;
  }
  let worst = null;
  for (const cn of mirrors) {
    const rn = 'R' + cn.slice(1);
    if (!(rn in (ctx.spec.chains || {}))) continue;
    const l = ctx.spec.chains[cn];
    const r = ctx.spec.chains[rn];
    let collapsed = 0;
    let checked = 0;
    for (let i = 0; i < Math.min(l.length, r.length); i++) {
      const a = ctx.sk.joints[ctx.sk.index[l[i]]]?.pos;
      const b = ctx.sk.joints[ctx.sk.index[r[i]]]?.pos;
      if (!a || !b) continue;
      checked++;
      // mirrored distance from xz plane — should equal the original's
      const la = Math.hypot(a[0], a[2]);
      const lb = Math.hypot(b[0], b[2]);
      if (la < 0.001) continue; // axis joint, skip
      const r0 = lb / la;
      if (r0 < 0.7) collapsed++;
    }
    if (checked && (!worst || collapsed / checked > worst.r)) {
      worst = { chain: cn, r: collapsed / checked };
    }
  }
  if (worst && worst.r > 0.3) {
    out.blocks.push(
      `mirror_distortion: ${(worst.r * 100).toFixed(0)}% of mirrored joint pairs in "${worst.chain}" have collapsed past 30% — `
      + `the skin will pull a mirrored thigh to a stub. Check joints_R overrides and skin weights.`,
    );
  } else {
    out.info.push('mirror_distortion: no mirrored twin collapsed past 30%');
  }
  return out;
}

function chk_part_overlap(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  // measure: for every pair of part meshes, compute the share of vertices
  // that sit inside the other's bounding box. report the worst pair.
  const parts = ctx.meshes.filter((m) => m.part);
  if (parts.length < 2) {
    out.info.push('part_overlap: fewer than 2 parts, skipped');
    return out;
  }
  let worst = null;
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i], b = parts[j];
      const aBox = bboxOf(a.V);
      const bBox = bboxOf(b.V);
      const insideA = a.V.filter((v) => vInBox(v, bBox)).length;
      const insideB = b.V.filter((v) => vInBox(v, aBox)).length;
      const share = (insideA + insideB) / (a.V.length + b.V.length);
      if (!worst || share > worst.share) worst = { a: a.part, b: b.part, share };
    }
  }
  if (worst && worst.share > 0.3) {
    out.warns.push(`part_overlap: "${worst.a}" and "${worst.b}" share ${(worst.share * 100).toFixed(0)}% of their vertices by bbox — likely geometry stacked on geometry`);
  } else if (worst) {
    out.info.push(`part_overlap: worst pair "${worst.a}" × "${worst.b}" is ${(worst.share * 100).toFixed(0)}%`);
  }
  return out;
}

function bboxOf(V) {
  const lo = [1e9, 1e9, 1e9];
  const hi = [-1e9, -1e9, -1e9];
  for (const v of V) for (let k = 0; k < 3; k++) {
    if (v[k] < lo[k]) lo[k] = v[k];
    if (v[k] > hi[k]) hi[k] = v[k];
  }
  return { lo, hi };
}
function vInBox(v, b) {
  return v[0] >= b.lo[0] && v[0] <= b.hi[0]
    && v[1] >= b.lo[1] && v[1] <= b.hi[1]
    && v[2] >= b.lo[2] && v[2] <= b.hi[2];
}

function chk_part_seat(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  if (!ctx.sk) return out;
  const attach = ctx.spec.attach || {};
  let detached = 0, total = 0;
  for (const m of ctx.meshes) {
    if (!m.part) continue;
    const host = attach[m.chain || m.part] || attach[m.part];
    if (!host || !(host in ctx.sk.index)) continue;
    total++;
    const hp = ctx.sk.joints[ctx.sk.index[host]].pos;
    const r = 0.1 * modelHeight(ctx.meshes);
    const hasNear = m.V.some((v) => V3.len(V3.sub(v, hp)) < r);
    if (!hasNear) detached++;
  }
  if (total && detached) out.warns.push(`part_seat: ${detached}/${total} parts have no vertex within 10% of H of their host joint — they float`);
  else if (total) out.info.push(`part_seat: every part seats within 10% of H of its host`);
  return out;
}

// ── style claims (PART 99 — 3D modeling style) ─────────────────────────
//
// Every check below is ADVISORY unless a stage declaration escalates it.
// A number that says the eye will ping-pong is worth reading and is not
// worth a rebuild. Taste is advice. Correctness is a gate.

// oklab colour distance for value_order + contrast_adjacent
function oklabDist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// value_order — every material sorted by OKLab lightness. The value plan,
// computed instead of eyeballed. The brief is the only thing that says
// what SHOULD be brightest; the engine reports what IS.
function chk_value_order(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  const spec = ctx.spec || {};
  const palette = spec.palette || {};
  const rows = [];
  for (const [name, p] of Object.entries(palette)) {
    const c = hex2lin(p.color || '#888888');
    const L = lin2oklab(c)[0];
    rows.push({ name, L, c });
  }
  if (!rows.length) {
    out.info.push('value_order: no palette, skipped');
    return out;
  }
  rows.sort((a, b) => b.L - a.L);
  out.info.push('value_order: ' + rows.map((r) => `${r.name}=${r.L.toFixed(2)}`).join(' / '));
  // Two masses at the same lightness compete and neither owns the eye.
  // A 0.04 OKLab gap is one notch below the contrast_adjacent floor.
  let comp = 0;
  for (let i = 0; i < rows.length - 1; i++) {
    if (rows[i].L - rows[i + 1].L < 0.04) comp++;
  }
  if (comp) {
    out.warns.push(`value_order: ${comp} material pair(s) are within 0.04 OKLab lightness — they read as the same mass in the lighting. Either darken/lighten one or merge the materials.`);
  }
  return out;
}

// contrast_adjacent — a part must separate in colour from the thing it
// SITS ON. Under 0.10 OKLab they read as one mass. The spec is checked for
// declared `touch` connections + (host chain → part) pairings.
function chk_contrast_adjacent(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  const spec = ctx.spec || {};
  const palette = spec.palette || {};
  const adj = (a, b) => {
    if (!a || !b) return 1;
    const ca = hex2lin(palette[a] && palette[a].color || '#888888');
    const cb = hex2lin(palette[b] && palette[b].color || '#888888');
    return oklabDist(lin2oklab(ca), lin2oklab(cb));
  };
  let checked = 0, fused = 0;
  // volumes ↔ each part that lists that chain as host
  const volumes = spec.volumes || [];
  const parts = spec.parts || [];
  for (const p of parts) {
    const hostMat = p.host;
    // best-match host material is the volume whose chain is `host`; fallback
    // to the part's own chain. Pull a part-material name from the part.
    const partMat = p.material;
    let hostPalette = null;
    for (const v of volumes) if (v.chain === hostMat && v.material) hostPalette = v.material;
    if (!hostPalette) {
      // touch connections
      for (const [a, b] of spec.touch || []) {
        if (a === hostMat || b === hostMat) {
          for (const v of volumes) {
            if ((v.chain === a || v.chain === b) && v.material) { hostPalette = v.material; break; }
          }
        }
      }
    }
    if (!hostPalette || !partMat || hostPalette === partMat) continue;
    const d = adj(hostPalette, partMat);
    checked++;
    if (d < 0.10) fused++;
  }
  if (checked && fused) {
    out.warns.push(`contrast_adjacent: ${fused}/${checked} part↔host pairs are within 0.10 OKLab — they read as one mass. Adjust the part colour OR the host's arc band so the part separates.`);
  } else if (checked) {
    out.info.push(`contrast_adjacent: every part separates from its host by ≥ 0.10 OKLab (${checked} pair(s) checked)`);
  } else {
    out.info.push('contrast_adjacent: no part/host pairs found in spec, skipped');
  }
  return out;
}

// share_hierarchy — primary:secondary:tertiary ≈ 60:30:10, tolerance ±15%.
// Without dominance the silhouette has no story.
function chk_share_hierarchy(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  const claims = (ctx.spec && ctx.spec.claims) || [];
  const c = claims.find((c) => c.type === 'share_hierarchy');
  if (!c) {
    out.info.push('share_hierarchy: no share_hierarchy claim in spec, skipped (declare one to enable)');
    return out;
  }
  // We don't have a rendered view here; we compute the share by mesh area in
  // the bind pose (sum of triangle area per group) and call that the tq share.
  // The judge.mjs in anyCreature re-renders with a per-material id buffer to
  // get exact pixel shares; this is a fast approximation.
  const groups = new Map();
  for (const m of ctx.meshes) {
    const k = m.material || '?';
    let area = 0;
    for (const f of m.F || []) {
      if (f.length < 3) continue;
      const [a, b, c] = f;
      const va = m.V[a], vb = m.V[b], vc = m.V[c];
      const ab = V3.sub(vb, va);
      const ac = V3.sub(vc, va);
      area += 0.5 * V3.len(V3.cross(ab, ac));
    }
    groups.set(k, (groups.get(k) || 0) + area);
  }
  const total = [...groups.values()].reduce((a, b) => a + b, 0) || 1;
  const sum = (keys) => keys.reduce((a, k) => a + (groups.has(k) ? groups.get(k) / total : 0), 0);
  const P = sum(c.primary || []);
  const S = sum(c.secondary || []);
  const T = sum(c.tertiary || []);
  const tot = P + S + T;
  if (!tot) { out.info.push('share_hierarchy: primary/secondary/tertiary groups all 0, skipped'); return out; }
  const got = [P / tot, S / tot, T / tot];
  const want = [0.6, 0.3, 0.1];
  const tol = c.tolerance ?? 0.15;
  const off = got.map((g, i) => Math.abs(g - want[i]));
  if (Math.max(...off) > tol) {
    out.warns.push(`share_hierarchy: primary/secondary/tertiary = ${got.map((x) => (x * 100).toFixed(0)).join(':')} (target 60:30:10, tolerance ±${(tol * 100).toFixed(0)}%) — no dominance, the frame is split evenly`);
  } else {
    out.info.push(`share_hierarchy: ${got.map((x) => (x * 100).toFixed(0)).join(':')} (target 60:30:10, within tolerance)`);
  }
  return out;
}

// focal_contrast — the two focal parts' shares must differ by ≥ 2×.
// Equal weight = ping-pong.
function chk_focal_contrast(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  const claims = (ctx.spec && ctx.spec.claims) || [];
  const c = claims.find((c) => c.type === 'focal_contrast');
  if (!c) {
    out.info.push('focal_contrast: no focal_contrast claim in spec, skipped (declare one to enable)');
    return out;
  }
  const groups = new Map();
  for (const m of ctx.meshes) {
    const k = m.material || '?';
    let area = 0;
    for (const f of m.F || []) {
      if (f.length < 3) continue;
      const [a, b, c] = f;
      const va = m.V[a], vb = m.V[b], vc = m.V[c];
      area += 0.5 * V3.len(V3.cross(V3.sub(vb, va), V3.sub(vc, va)));
    }
    groups.set(k, (groups.get(k) || 0) + area);
  }
  const total = [...groups.values()].reduce((a, b) => a + b, 0) || 1;
  const A = (groups.get(c.a) || 0) / total;
  const B = (groups.get(c.b) || 0) / total;
  const hi = Math.max(A, B), lo = Math.min(A, B);
  const min_ratio = c.min_ratio ?? 2;
  if (lo > 0 && hi / lo < min_ratio) {
    out.warns.push(`focal_contrast: "${c.a}" ${(A * 100).toFixed(1)}% vs "${c.b}" ${(B * 100).toFixed(1)}% — need ≥ ${min_ratio}× apart. The eye ping-pongs between them; open up the dominance gap.`);
  } else {
    out.info.push(`focal_contrast: "${c.a}" ${(A * 100).toFixed(1)}% / "${c.b}" ${(B * 100).toFixed(1)}% — ${lo > 0 ? (hi / lo).toFixed(2) : '∞'}× ratio`);
  }
  return out;
}

// saturation_area — share of the frame carrying HSV S ≥ 0.50 on the UNLIT
// baked colour. Default band 10-34%. Below = grey lump, above = no spotlight.
function chk_saturation_area(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  // The judge.mjs in anyCreature uses an id buffer + 4-view render; here we
  // approximate by measuring the highest-saturation material in the palette
  // and computing its share of the mesh.
  const palette = (ctx.spec && ctx.spec.palette) || {};
  const sats = Object.entries(palette).map(([k, p]) => {
    const c = hex2lin(p.color || '#888888');
    const [r, g, b] = lin2oklab(c); // not what we want — oklab chroma is hypot(a,b)
    return { name: k, color: p.color || '#888888', s: srgbSaturation(c) };
  });
  if (!sats.length) { out.info.push('saturation_area: no palette, skipped'); return out; }
  sats.sort((a, b) => b.s - a.s);
  // Approximate share: every mesh whose material is in the top-saturated
  // entries contributes its area.
  const highSats = new Set(sats.filter((s) => s.s >= 0.5).map((s) => s.name));
  let total = 0, high = 0;
  for (const m of ctx.meshes) {
    let area = 0;
    for (const f of m.F || []) {
      if (f.length < 3) continue;
      const [a, b, c] = f;
      area += 0.5 * V3.len(V3.cross(V3.sub(m.V[b], m.V[a]), V3.sub(m.V[c], m.V[a])));
    }
    total += area;
    if (highSats.has(m.material)) high += area;
  }
  const share = total ? high / total : 0;
  const c = { min: 0.10 };
  const pct = share * 100;
  const lo = (c.min ?? 0.10) * 100;
  if (pct < lo) {
    out.warns.push(`saturation_area: only ${pct.toFixed(1)}% of the frame is highly saturated (need ≥ ${lo.toFixed(0)}%) — the creature reads as a grey mass. Raise the saturation of a mass that deserves the attention, do not tint everything.`);
  } else {
    out.info.push(`saturation_area: ${pct.toFixed(1)}% of frame highly saturated (band 10-34% — current is ${pct < 34 ? 'within' : 'above the soft cap; saturation stops reading as a spotlight when it covers this much'})`);
  }
  return out;
}

function srgbSaturation(lin) {
  // approximation: sRGB value, max-min, then sat = (max-min)/max if max>0
  const srgb = lin.map((v) => Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2));
  const mx = Math.max(...srgb);
  const mn = Math.min(...srgb);
  return mx > 0 ? (mx - mn) / mx : 0;
}

// thinnest_px48 — width of the thinnest feature on the 48px thumbnail the
// reader sees. Under 3 px = invisible. Computed on the silhouette mask
// (top-down projection of the Y axis). 48 px = the reader's thumbnail.
function chk_thinnest_px48(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  if (!ctx.meshes.length) { out.info.push('thinnest_px48: no meshes, skipped'); return out; }
  // Project to XZ (top-down view), build a 48x48 mask, find protrusions.
  const { lo, hi } = bbox(ctx.meshes);
  const sx = (hi[0] - lo[0]) || 1;
  const sz = (hi[2] - lo[2]) || 1;
  const PX = 48;
  const mask = new Uint8Array(PX * PX);
  for (const m of ctx.meshes) {
    for (const f of m.F || []) {
      if (f.length < 3) continue;
      for (const e of [[0, 1], [1, 2], [2, 0]]) {
        const a = m.V[f[e[0]]], b = m.V[f[e[1]]];
        const x0 = Math.max(0, Math.min(PX - 1, Math.floor((a[0] - lo[0]) / sx * PX)));
        const z0 = Math.max(0, Math.min(PX - 1, Math.floor((a[2] - lo[2]) / sz * PX)));
        const x1 = Math.max(0, Math.min(PX - 1, Math.floor((b[0] - lo[0]) / sx * PX)));
        const z1 = Math.max(0, Math.min(PX - 1, Math.floor((b[2] - lo[2]) / sz * PX)));
        // Bresenham
        let dx = Math.abs(x1 - x0), sx_ = x0 < x1 ? 1 : -1;
        let dy = -Math.abs(z1 - z0), sy_ = z0 < z1 ? 1 : -1;
        let err = dx + dy;
        let x = x0, z = z0;
        while (true) {
          mask[z * PX + x] = 1;
          if (x === x1 && z === z1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x += sx_; }
          if (e2 <= dx) { err += dx; z += sy_; }
        }
      }
      // fill triangle (very simple — barycentric)
      const v0 = m.V[f[0]], v1 = m.V[f[1]], v2 = m.V[f[2]];
      const x0 = Math.max(0, Math.min(PX - 1, Math.floor((v0[0] - lo[0]) / sx * PX)));
      const z0 = Math.max(0, Math.min(PX - 1, Math.floor((v0[2] - lo[2]) / sz * PX)));
      const x1 = Math.max(0, Math.min(PX - 1, Math.floor((v1[0] - lo[0]) / sx * PX)));
      const z1 = Math.max(0, Math.min(PX - 1, Math.floor((v1[2] - lo[2]) / sz * PX)));
      const x2 = Math.max(0, Math.min(PX - 1, Math.floor((v2[0] - lo[0]) / sx * PX)));
      const z2 = Math.max(0, Math.min(PX - 1, Math.floor((v2[2] - lo[2]) / sz * PX)));
      const minx = Math.min(x0, x1, x2), maxx = Math.max(x0, x1, x2);
      const minz = Math.min(z0, z1, z2), maxz = Math.max(z0, z1, z2);
      for (let z = minz; z <= maxz; z++) {
        for (let x = minx; x <= maxx; x++) {
          if (pointInTri(x, z, [x0, z0], [x1, z1], [x2, z2])) mask[z * PX + x] = 1;
        }
      }
    }
  }
  // Distance transform: find the thinnest 1-pixel-wide corridor
  const dt = new Float32Array(PX * PX);
  // first pass: top-left to bottom-right
  for (let z = 0; z < PX; z++) for (let x = 0; x < PX; x++) {
    const i = z * PX + x;
    if (mask[i]) {
      dt[i] = 1 + Math.min(
        x > 0 ? dt[i - 1] : Infinity,
        z > 0 ? dt[i - PX] : Infinity,
        x > 0 && z > 0 ? dt[i - PX - 1] : Infinity,
        x < PX - 1 && z > 0 ? dt[i - PX + 1] : Infinity,
      );
    }
  }
  // second pass: bottom-right to top-left
  for (let z = PX - 1; z >= 0; z--) for (let x = PX - 1; x >= 0; x--) {
    const i = z * PX + x;
    if (mask[i]) {
      dt[i] = Math.min(dt[i], 1 + Math.min(
        x < PX - 1 ? dt[i + 1] : Infinity,
        z < PX - 1 ? dt[i + PX] : Infinity,
        x < PX - 1 && z < PX - 1 ? dt[i + PX + 1] : Infinity,
        x > 0 && z < PX - 1 ? dt[i + PX - 1] : Infinity,
      ));
    }
  }
  // minimum non-zero
  let thinnest = Infinity;
  for (let i = 0; i < dt.length; i++) if (dt[i] > 0 && dt[i] < thinnest) thinnest = dt[i];
  // px48 is the actual width in pixels
  const px48 = thinnest === Infinity ? 0 : Math.round(thinnest * 2);
  if (px48 < 3) {
    out.warns.push(`thinnest_px48: thinnest feature measures ${px48}px on the 48px thumbnail (< 3px = invisible to the blind reader). Thicken it or drop it.`);
  } else {
    out.info.push(`thinnest_px48: thinnest feature is ${px48}px on the 48px thumbnail (≥ 3px = visible)`);
  }
  return out;
}

function pointInTri(px, pz, a, b, c) {
  const d = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(d) < 1e-9) return false;
  const u = ((px - a[0]) * (c[1] - a[1]) - (pz - a[1]) * (c[0] - a[0])) / d;
  const v = ((b[0] - a[0]) * (pz - a[1]) - (b[1] - a[1]) * (px - a[0])) / d;
  return u >= 0 && v >= 0 && u + v <= 1;
}

// sq_fill — silhouette in a 1:1 frame. 0.20-0.40 healthy. <0.15 = thin ghost,
// >0.50 = blob.
function chk_sq_fill(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  // We use the same projection as thinnest_px48 (top-down)
  if (!ctx.meshes.length) { out.info.push('sq_fill: no meshes, skipped'); return out; }
  const { lo, hi } = bbox(ctx.meshes);
  const diagXZ = Math.hypot(hi[0] - lo[0], hi[2] - lo[2]) || 1;
  const PX = 64;
  const mask = new Uint8Array(PX * PX);
  for (const m of ctx.meshes) for (const f of m.F || []) {
    if (f.length < 3) continue;
    const v0 = m.V[f[0]], v1 = m.V[f[1]], v2 = m.V[f[2]];
    const x0 = Math.max(0, Math.min(PX - 1, Math.floor((v0[0] - lo[0]) / diagXZ * PX + PX / 2)));
    const z0 = Math.max(0, Math.min(PX - 1, Math.floor((v0[2] - lo[2]) / diagXZ * PX + PX / 2)));
    const x1 = Math.max(0, Math.min(PX - 1, Math.floor((v1[0] - lo[0]) / diagXZ * PX + PX / 2)));
    const z1 = Math.max(0, Math.min(PX - 1, Math.floor((v1[2] - lo[2]) / diagXZ * PX + PX / 2)));
    const x2 = Math.max(0, Math.min(PX - 1, Math.floor((v2[0] - lo[0]) / diagXZ * PX + PX / 2)));
    const z2 = Math.max(0, Math.min(PX - 1, Math.floor((v2[2] - lo[2]) / diagXZ * PX + PX / 2)));
    const minx = Math.min(x0, x1, x2), maxx = Math.max(x0, x1, x2);
    const minz = Math.min(z0, z1, z2), maxz = Math.max(z0, z1, z2);
    for (let z = minz; z <= maxz; z++) {
      for (let x = minx; x <= maxx; x++) {
        if (pointInTri(x, z, [x0, z0], [x1, z1], [x2, z2])) mask[z * PX + x] = 1;
      }
    }
  }
  let area = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) area++;
  // Square-crop to the smaller of width/height, then fill
  // Simpler: re-fill a square of side = max(w,h) with the mask, then divide.
  // Here we approximate by reporting mask area / PX².
  const fill = area / (PX * PX);
  if (fill < 0.15) {
    out.warns.push(`sq_fill: ${(fill * 100).toFixed(1)}% — the silhouette is too thin in its own frame (healthy 20-40%). Either the model is too narrow for its declared height or a pole has folded flat.`);
  } else if (fill > 0.50) {
    out.warns.push(`sq_fill: ${(fill * 100).toFixed(1)}% — the silhouette is a blob (healthy 20-40%). It has no direction; it is a pose, not a creature.`);
  } else {
    out.info.push(`sq_fill: ${(fill * 100).toFixed(1)}% (healthy 20-40%)`);
  }
  return out;
}

// mirror_sym — IoU with own horizontal flip. FRONT view may be symmetric;
// side / top should be low.
function chk_mirror_sym(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  if (!ctx.meshes.length) { out.info.push('mirror_sym: no meshes, skipped'); return out; }
  const { lo, hi } = bbox(ctx.meshes);
  const sx = (hi[0] - lo[0]) || 1, sz = (hi[2] - lo[2]) || 1;
  const PX = 64;
  // Top-down projection
  const a = new Uint8Array(PX * PX);
  const b = new Uint8Array(PX * PX);
  for (const m of ctx.meshes) for (const f of m.F || []) {
    if (f.length < 3) continue;
    for (const v of f) {
      const x = Math.max(0, Math.min(PX - 1, Math.floor((m.V[v][0] - lo[0]) / sx * PX)));
      const z = Math.max(0, Math.min(PX - 1, Math.floor((m.V[v][2] - lo[2]) / sz * PX)));
      a[z * PX + x] = 1;
    }
  }
  for (let z = 0; z < PX; z++) for (let x = 0; x < PX; x++) b[z * PX + (PX - 1 - x)] = a[z * PX + x];
  let inter = 0, uni = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] && b[i]) inter++;
    if (a[i] || b[i]) uni++;
  }
  const iou = uni ? inter / uni : 0;
  if (iou > 0.85) {
    out.warns.push(`mirror_sym: top-down view is ${(iou * 100).toFixed(0)}% symmetric with its own flip — even the top view should stagger. Front view may be symmetric, top view should not.`);
  } else {
    out.info.push(`mirror_sym: top-down view is ${(iou * 100).toFixed(0)}% symmetric (front view may be high, top view should be low)`);
  }
  return out;
}

// straight_max — longest constant-slope run on the boundary, as a fraction
// of that boundary's length. Plank-limb detector.
function chk_straight_max(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  if (!ctx.meshes.length) { out.info.push('straight_max: no meshes, skipped'); return out; }
  const { lo, hi } = bbox(ctx.meshes);
  const sx = (hi[0] - lo[0]) || 1, sy = (hi[1] - lo[1]) || 1;
  const PX = 64;
  const mask = new Uint8Array(PX * PX);
  for (const m of ctx.meshes) for (const f of m.F || []) {
    if (f.length < 3) continue;
    for (const e of [[0, 1], [1, 2], [2, 0]]) {
      const a = m.V[f[e[0]]], b = m.V[f[e[1]]];
      const x0 = Math.max(0, Math.min(PX - 1, Math.floor((a[0] - lo[0]) / sx * PX)));
      const y0 = Math.max(0, Math.min(PX - 1, Math.floor((a[1] - lo[1]) / sy * PX)));
      const x1 = Math.max(0, Math.min(PX - 1, Math.floor((b[0] - lo[0]) / sx * PX)));
      const y1 = Math.max(0, Math.min(PX - 1, Math.floor((b[1] - lo[1]) / sy * PX)));
      lineOnMask(mask, PX, x0, y0, x1, y1);
    }
  }
  // top + bottom per column
  let best = 0;
  for (let x = 0; x < PX; x++) {
    const col = [];
    for (let y = 0; y < PX; y++) if (mask[y * PX + x]) col.push(y);
    if (col.length < 4) continue;
    const topRun = longestConstSlope(col);
    if (topRun / col.length > best) best = topRun / col.length;
  }
  if (best > 0.4) {
    out.warns.push(`straight_max: longest constant-slope run is ${(best * 100).toFixed(0)}% of the boundary length — plank-limb detector triggered. Break it with a small radius step or a sharp profile row.`);
  } else {
    out.info.push(`straight_max: longest constant-slope run is ${(best * 100).toFixed(0)}% of the boundary length (healthy < 40%)`);
  }
  return out;
}

function lineOnMask(mask, PX, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0, y = y0;
  while (true) {
    mask[y * PX + x] = 1;
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function longestConstSlope(arr) {
  let best = 1, cur = 1, slope = null;
  for (let i = 1; i < arr.length; i++) {
    const s = arr[i] - arr[i - 1];
    if (s === slope) cur++;
    else { slope = s; cur = 2; }
    if (cur > best) best = cur;
  }
  return best;
}

// tri_budget — triangle count band. Default 4000-9000 (anyCreature claim).
// Cheap creatures can lower it; boss creatures are judged at this.
function chk_tri_budget(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  const claims = (ctx.spec && ctx.spec.claims) || [];
  const c = claims.find((c) => c.type === 'tri_budget');
  if (!c) { out.info.push('tri_budget: no tri_budget claim in spec, skipped (declare one to enable)'); return out; }
  let tris = 0;
  for (const m of ctx.meshes) {
    let n = 0;
    for (const f of m.F || []) {
      if (f.length === 3) n++;
      else if (f.length === 4) n += 2;
    }
    tris += n;
  }
  if (tris < c.min || tris > c.max) {
    out.warns.push(`tri_budget: triangle count ${tris} is outside the budget band ${c.min}-${c.max}`);
  } else {
    out.info.push(`tri_budget: ${tris} triangles (band ${c.min}-${c.max})`);
  }
  return out;
}

// bright_floor — beauty render's median luminance. Cheap proxy: average
// brightness of the palette. A "dark" creature reads by VALUE STEPS, not
// by making everything dark.
function chk_bright_floor(ctx) {
  const out = { blocks: [], warns: [], info: [] };
  const palette = (ctx.spec && ctx.spec.palette) || {};
  const style = (ctx.spec && ctx.spec.style) || '';
  const isDark = /dark|night|black/i.test(style);
  if (!Object.keys(palette).length) { out.info.push('bright_floor: no palette, skipped'); return out; }
  let sum = 0, n = 0;
  for (const p of Object.values(palette)) {
    const c = hex2lin(p.color || '#888888');
    const L = lin2oklab(c)[0];
    sum += L; n++;
  }
  const meanL = n ? sum / n : 0;
  if (isDark && meanL > 0.25) {
    out.warns.push(`bright_floor: style='${style}' (dark) but palette mean OKLab lightness is ${meanL.toFixed(2)} — a "dark" creature reads by VALUE STEPS between its masses, not by making everything dark.`);
  } else {
    out.info.push(`bright_floor: palette mean OKLab lightness ${meanL.toFixed(2)}${isDark ? ` (style='${style}')` : ''}`);
  }
  return out;
}

const CHECKS = {
  mesh_integrity: chk_mesh_integrity,
  root_containment: chk_root_containment,
  part_attachment: chk_part_attachment,
  touch: chk_touch,
  balance: chk_balance,
  size: chk_size,
  proportion: chk_proportion,
  limb_clearance: chk_limb_clearance,
  anim_integrity: chk_anim_integrity,
  attack_reach: chk_attack_reach,
  faceted_body: chk_faceted_body,
  mirror_distortion: chk_mirror_distortion,
  part_overlap: chk_part_overlap,
  part_seat: chk_part_seat,
  soft_mass: chk_soft_mass,
  // PART 99 — 3D modeling style claims
  value_order: chk_value_order,
  contrast_adjacent: chk_contrast_adjacent,
  share_hierarchy: chk_share_hierarchy,
  focal_contrast: chk_focal_contrast,
  saturation_area: chk_saturation_area,
  thinnest_px48: chk_thinnest_px48,
  sq_fill: chk_sq_fill,
  mirror_sym: chk_mirror_sym,
  straight_max: chk_straight_max,
  tri_budget: chk_tri_budget,
  bright_floor: chk_bright_floor,
};

const CHECK_ORDER = [
  'mesh_integrity',
  'root_containment',
  'part_attachment',
  'touch',
  'balance',
  'size',
  'proportion',
  'limb_clearance',
  'anim_integrity',
  'attack_reach',
  'faceted_body',
  'mirror_distortion',
  'part_overlap',
  'part_seat',
  'soft_mass',
  // PART 99 — 3D modeling style claims (run after the legality gates)
  'value_order',
  'contrast_adjacent',
  'share_hierarchy',
  'focal_contrast',
  'saturation_area',
  'thinnest_px48',
  'sq_fill',
  'mirror_sym',
  'straight_max',
  'tri_budget',
  'bright_floor',
];

// runChecks(ctx) → { fails:[], warns:[], info:[], perCheck:{name:{blocks,warns,info,passed}} }
// opts.strict: if true, warns become blocks (build refuses).
function runChecks(ctx, opts) {
  const opt = opts || {};
  const fails = [];
  const warns = [];
  const info = [];
  const perCheck = {};
  for (const name of CHECK_ORDER) {
    const fn = CHECKS[name];
    if (!fn) continue;
    let r;
    try {
      r = fn(ctx);
    } catch (e) {
      r = { blocks: [`${name}: check threw — ${e.message}`], warns: [], info: [] };
    }
    perCheck[name] = {
      blocks: r.blocks.slice(),
      warns: r.warns.slice(),
      info: r.info.slice(),
      passed: r.blocks.length === 0,
    };
    for (const b of r.blocks) fails.push(b);
    for (const w of r.warns) (opt.strict ? fails : warns).push(w);
    for (const i of r.info) info.push(i);
  }
  return { fails, warns, info, perCheck };
}

const api = { runChecks, CHECKS, CHECK_ORDER, V3, modelHeight, bbox, massCentroid, supportPolygonXZ, pointInHull };

if (typeof window !== 'undefined') window.ACES_checks = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
