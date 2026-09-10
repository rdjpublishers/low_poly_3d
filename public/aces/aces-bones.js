// ACES — public bone-name convention + GLB extras.
//
//   exportNames(spec, sk)        internal joint name → public name like
//                                "LArm1Sh" / "RFrontLeg1Kn".
//   assetExtras(spec)            asset.extras payload with harness stamp
//                                + source_spec (so the GLB can be re-edited)
//                                + parts manifest (so a graft tool can
//                                transplant parts between creatures).
//
// Author: Ariescar (anyCreature) ported to the RDJ low_poly_3d browser
// surface.

'use strict';

const HARNESS_NAME = 'ACES (anyCreature Engine Surface)';
const HARNESS_VERSION = '1.0.0';

function mirrorName(n) {
  return n.startsWith('L') ? 'R' + n.slice(1) : n;
}

// Side-limb joints ship under the convention  <L|R><ChainBase><instance><Tg>
// (LArm1Sh, RFrontLeg1Kn): side prefix, chain base, instance digit(s), then a
// two-letter joint tag. Internal spec names stay authoring-side; this map is
// applied only when writing the GLB, so animations/skins (index-based) are
// untouched. Every exported bone starting with L/R conforms to
// ^[LR][A-Z][A-Za-z]*\d+[A-Z][a-z]$ — a structural pattern, not a word list.
const JOINT_TAGS = [
  ['shoulder', 'Sh'], ['elbow', 'El'], ['wrist', 'Wr'], ['hand', 'Ha'], ['finger', 'Fg'],
  ['thumb', 'Tb'], ['hip', 'Hp'], ['knee', 'Kn'], ['ankle', 'An'], ['toe', 'To'],
  ['foot', 'Ft'], ['paw', 'Pw'], ['thigh', 'Th'], ['shin', 'Sn'], ['claw', 'Cl'],
  ['root', 'Rt'], ['mid', 'Md'], ['tip', 'Tp'], ['base', 'Bs'], ['end', 'En'],
];

function jointTag(raw, used) {
  const low = raw.toLowerCase();
  let tag = null;
  for (const [k, t] of JOINT_TAGS) {
    if (low.includes(k)) { tag = t; break; }
  }
  if (!tag || used.has(tag)) {
    const s = raw.replace(/^[LR]/, '').replace(/[^A-Za-z]/g, '') || 'Jt';
    tag = s[0].toUpperCase() + (s[1] || 'x').toLowerCase();
  }
  if (used.has(tag)) {
    for (let c = 97; c <= 122; c++) {
      const t2 = 'J' + String.fromCharCode(c);
      if (!used.has(t2)) { tag = t2; break; }
    }
  }
  used.add(tag);
  return tag;
}

function exportNames(spec, sk) {
  const map = {};
  const taken = new Set();
  const claim = (name) => {
    let n = name;
    let bump = 2;
    while (taken.has(n)) {
      n = name.replace(/(\d+)(?=[A-Z][a-z]$)/, () => String(bump++));
    }
    taken.add(n);
    return n;
  };
  const baseCount = {};
  for (const cn of spec.mirror || []) {
    const m = cn.match(/^L([A-Za-z]*?)(\d*)$/);
    const rawBase = (m && m[1]) ? m[1] : 'Limb';
    const base = rawBase[0].toUpperCase() + rawBase.slice(1);
    let inst = (m && m[2]) ? m[2] : null;
    if (inst === null) {
      baseCount[base] = (baseCount[base] || 0) + 1;
      inst = String(baseCount[base]);
    }
    const used = new Set();
    for (const n of spec.chains[cn]) {
      const tag = jointTag(n, used);
      map[n] = claim(`L${base}${inst}${tag}`);
      map[mirrorName(n)] = claim(`R${base}${inst}${tag}`);
    }
  }
  // loose L*/R* joints (ears, eyes' hosts) and any stray side-prefixed name
  for (const j of sk.joints) {
    if (map[j.name] || !/^[LR][A-Z]/.test(j.name)) continue;
    if (/^[LR][A-Z][A-Za-z]*\d+[A-Z][a-z]$/.test(j.name)) {
      map[j.name] = claim(j.name);
      continue;
    }
    const side = j.name[0];
    const rest = j.name.slice(1).replace(/[^A-Za-z]/g, '') || 'Part';
    const base = rest[0].toUpperCase() + rest.slice(1);
    map[j.name] = claim(`${side}${base}1${jointTag(rest, new Set())}`);
  }
  return map;
}

// Build the asset.extras payload that the GLB writes.
//
//   asset.extras.harness             "ACES (anyCreature Engine Surface)"
//   asset.extras.harness_version     "1.0.0"
//   asset.extras.spec                spec basename
//   asset.extras.source_spec         pristine authored spec (re-editable)
//   asset.extras.parts               parts manifest
//   asset.extras.checks              per-check pass/warn from aces-checks
//
// The caller passes `spec` (the live spec — internal relative resolution is
// applied) and `checks` (an optional perCheck map from aces-checks.runChecks).
function assetExtras(spec, opts) {
  const o = opts || {};
  const out = {
    harness: HARNESS_NAME,
    harness_version: HARNESS_VERSION,
    spec: (o.specName || 'model'),
    generated_at: new Date().toISOString(),
  };
  if (spec) {
    // a copy, not the live spec — callers mutate the live one (mirror
    // registration, joint resolution). The pristine form re-compiles cleanly.
    out.source_spec = JSON.parse(JSON.stringify(spec));
    out.parts = [
      ...(spec.volumes || []).map((v) => ({ kind: 'volume', chain: v.chain, material: v.material })),
      ...(spec.parts || []).map((p) => ({
        kind: 'part',
        type: p.type,
        name: p.name || null,
        material: p.material,
        host: p.host || (p.ribs ? 'ribs' : null),
        join: p.join || null,
      })),
    ];
  }
  if (o.checks && o.checks.perCheck) {
    out.checks = {};
    for (const [name, r] of Object.entries(o.checks.perCheck)) {
      out.checks[name] = {
        passed: r.passed,
        warned: r.warns && r.warns.length > 0,
        info_lines: (r.info || []).length,
      };
    }
    out.checks_summary = {
      blocks: o.checks.fails ? o.checks.fails.length : 0,
      warns: o.checks.warns ? o.checks.warns.length : 0,
      passed: !o.checks.fails || o.checks.fails.length === 0,
    };
  }
  return out;
}

// Apply ACES export names to a Three.js Skeleton / bones map. Used by the
// renderer so the bones that show in the outliner and the bones that ship in
// the GLB have the same public name.
function applyToThreeSkeleton(threeSkeleton, nameMap) {
  if (!threeSkeleton || !nameMap) return;
  for (const bone of threeSkeleton.bones) {
    if (nameMap[bone.name]) bone.name = nameMap[bone.name];
  }
  if (threeSkeleton.boneInverses) {
    // bones are referenced by index in the array, so renaming in place is safe
  }
}

const api = {
  HARNESS_NAME,
  HARNESS_VERSION,
  mirrorName,
  jointTag,
  exportNames,
  assetExtras,
  applyToThreeSkeleton,
};

if (typeof window !== 'undefined') window.ACES_bones = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
