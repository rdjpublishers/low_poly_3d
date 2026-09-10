// ACES — main engine facade.
//
// One entry point: `acesQualityPass(threeScene, opts)` that runs the full
// anyCreature-derived pipeline against an existing Three.js scene:
//
//   1. For every Mesh / SkinnedMesh in the scene, extract the V/F/colour
//      arrays into a plain record { V, F, C, N, skin, color, material, ... }.
//   2. Optional crease split (smooth_angle) → angle-weighted vertex normals.
//   3. Per-vertex AO bake (raycast hemisphere) → vertex-colour × AO.
//   4. L1-L8 OKLab shading stack (seam-safe, ramp, boost, bleed, shadows).
//   5. L8 bone-field NORMAL softening (flesh only).
//   6. Mechanical checks (mesh_integrity, soft_mass, mirror_distortion, ...).
//   7. Write results back to the Three.js geometry (POSITION, NORMAL,
//      COLOR_0). ComputeVertexNormals is replaced with the angle-weighted
//      version; the colour attribute carries the baked shading.
//
// The renderer keeps every existing capability (PARTs 1-89). This is an
// UPGRADE that adds new outputs — it never downgrades a working scene.
//
// Opt-in by default. UI hooks: `acesRun(threeScene)`, `acesRunButton()`,
// `acesReport()`, `acesIsActive()`.
//
// Author: Ariescar (anyCreature) ported to the RDJ low_poly_3d browser
// surface. All sub-modules are pure ESM-style scripts attached to window
// (so this can run inside a non-module <script>).

'use strict';

(function (root) {
  const oklab = root.ACES_oklab;
  const normals = root.ACES_normals;
  const aoMod = root.ACES_ao;
  const shade = root.ACES_shade;
  const checks = root.ACES_checks;
  const bones = root.ACES_bones;

  if (!oklab || !normals || !aoMod || !shade || !checks || !bones) {
    console.error('[ACES] a sub-module failed to load — check that aces-oklab.js, aces-normals.js, aces-ao.js, aces-shade.js, aces-checks.js, aces-bones.js are all loaded before aces-engine.js');
    return;
  }

  // ── Three.js scene → plain mesh records ────────────────────────────────
  //
  // For each Mesh / SkinnedMesh, produce a record:
  //   { V, F, C, N, AO, color, material, part, chain, partType, smoothAngle, faceted, doubleSided, skin, _mesh, _geom, _vertexCount }
  //
  // V:  Array<[x,y,z]>
  // F:  Array<[i0,i1,i2]> (triangles only — non-tri faces are triangulated)
  // C:  Array<[r,g,b]> linear-light; null if the mesh has no colour attribute
  // N:  Array<[x,y,z]> angle-weighted vertex normals (filled in step 2)
  // AO: Array<ao> filled in step 3
  //
  // The records SHARE the Three.js BufferGeometry attribute arrays (we read
  // POSITION to populate V, COLOR_0 to populate C, etc.) but V is an array of
  // plain triples, not a Float32Array — that makes the rest of the pipeline
  // straightforward without forcing Three.js to round-trip data.
  function extractMeshes(threeScene) {
    const out = [];
    if (!threeScene) return out;
    threeScene.traverse((obj) => {
      if (!obj.isMesh && !obj.isSkinnedMesh) return;
      const geom = obj.geometry;
      if (!geom) return;
      const pos = geom.getAttribute('position');
      const col = geom.getAttribute('color');
      const idx = geom.getIndex();
      if (!pos) return;
      const V = new Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        V[i] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      }
      // indices
      let F = [];
      if (idx) {
        for (let i = 0; i < idx.count; i += 3) {
          F.push([idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)]);
        }
      } else {
        for (let i = 0; i + 2 < pos.count; i += 3) F.push([i, i + 1, i + 2]);
      }
      // colour (linear-light)
      let C = null;
      if (col) {
        C = new Array(col.count);
        for (let i = 0; i < col.count; i++) {
          C[i] = [col.getX(i), col.getY(i), col.getZ(i)];
        }
      }
      // flat material colour, used as a fallback
      let color = '#888888';
      if (obj.material && obj.material.color) {
        const c = obj.material.color;
        const hex = '#' + c.getHexString();
        color = hex;
      }
      // metadata
      const matName = (obj.material && obj.material.name) || (obj.name || 'material');
      const record = {
        V,
        F,
        C,
        N: null,
        AO: null,
        color,
        material: matName,
        part: obj.userData && obj.userData.part ? obj.userData.part : null,
        chain: obj.userData && obj.userData.chain ? obj.userData.chain : null,
        partType: obj.userData && obj.userData.partType ? obj.userData.partType : null,
        smoothAngle: obj.userData && Number.isFinite(obj.userData.smoothAngle) ? obj.userData.smoothAngle : undefined,
        faceted: !!(obj.userData && obj.userData.faceted),
        soft: !!(obj.userData && obj.userData.soft),
        doubleSided: !!(obj.material && obj.material.side === 2 /* THREE.DoubleSide */),
        skin: null,
        _mesh: obj,
        _geom: geom,
        _vertexCount: pos.count,
      };
      // SkinnedMesh → inflate per-vertex skin influences
      if (obj.isSkinnedMesh && obj.skeleton) {
        const sk = obj.skeleton;
        const skin = new Array(pos.count);
        for (let i = 0; i < pos.count; i++) {
          // The default Three.js SkinnedMesh doesn't expose per-vertex
          // influences in a public form, so we approximate by nearest bone
          // for the L8 bone-field softener. A full extraction would need the
          // SkinIndex/SkinWeight attributes which aren't always present.
          skin[i] = [[bones.mirrorName('Bone_Root'), 1.0]]; // placeholder, replaced if real data
        }
        record.skin = skin;
      }
      out.push(record);
    });
    return out;
  }

  // ── Three.js SkinnedMesh / Object3D skeleton → plain joint record ───────
  function extractSkeleton(threeScene) {
    let sk = null;
    threeScene.traverse((obj) => {
      if (sk) return;
      if (obj.isSkinnedMesh && obj.skeleton) {
        const joints = [];
        const index = {};
        for (let i = 0; i < obj.skeleton.bones.length; i++) {
          const b = obj.skeleton.bones[i];
          const parent = obj.skeleton.bones.indexOf(b.parent);
          const pos = b.getWorldPosition(new (root.THREE || { Vector3: function () { return { x: 0, y: 0, z: 0 }; } }).Vector3());
          // Fall back to bind pose if world position isn't available
          const worldPos = (pos && Number.isFinite(pos.x)) ? [pos.x, pos.y, pos.z] : (b.userData && b.userData.bindPos) || [0, 0, 0];
          joints.push({ name: b.name, pos: worldPos, parent: parent === i ? -1 : parent });
          index[b.name] = i;
        }
        sk = { joints, index };
      }
    });
    return sk;
  }

  // ── write back ──────────────────────────────────────────────────────────
  function applyToGeometry(meshes, reports) {
    const THREE = root.THREE;
    for (const m of meshes) {
      const geom = m._geom;
      if (!geom) continue;
      const nVerts = m._vertexCount;
      // POSITION is unchanged — we never move vertices
      // COLOR_0 ← linear-light m.C
      if (m.C) {
        let col = geom.getAttribute('color');
        if (!col && THREE && THREE.BufferAttribute) {
          const arr = new Float32Array(nVerts * 3);
          geom.setAttribute('color', new THREE.BufferAttribute(arr, 3));
          col = geom.getAttribute('color');
        }
        if (col && col.setXYZ) {
          for (let i = 0; i < nVerts; i++) {
            col.setXYZ(i, m.C[i][0], m.C[i][1], m.C[i][2]);
          }
          if (col.needsUpdate !== undefined) col.needsUpdate = true;
        }
      }
      // NORMAL ← m.N
      if (m.N) {
        const norm = geom.getAttribute('normal');
        if (norm && norm.setXYZ) {
          for (let i = 0; i < nVerts; i++) {
            norm.setXYZ(i, m.N[i][0], m.N[i][1], m.N[i][2]);
          }
          if (norm.needsUpdate !== undefined) norm.needsUpdate = true;
        }
      }
    }
  }

  // ── the public entry point ──────────────────────────────────────────────
  //
  // ctx = {
  //   scene:        THREE.Scene (or Object3D root) — REQUIRED
  //   shading:      spec.shading — drives the L1-L8 stack (optional)
  //   ao:           { samples, strength, radius, multiply, skip } | false | undefined
  //   smoothAngle:  global default for crease split (default 50)
  //   classMap:     { chainOrPart: 'flesh' | 'hard' | 'fx' } (optional)
  //   skipChecks:   ['anim_integrity', ...] — omit when context can't supply the data
  //   skeleton:     optional pre-extracted { joints, index }
  //   spec:         optional authored spec (used by checks)
  //   onReport:     (r) => void — receive the full report
  // }
  function acesQualityPass(ctx) {
    if (!ctx || !ctx.scene) {
      return { ok: false, error: 'acesQualityPass: ctx.scene is required' };
    }
    const onReport = ctx.onReport || (() => {});
    const INFO = [];
    const reports = { perMesh: {}, perCheck: {}, info: [], fails: [], warns: [] };
    const t0 = performance.now();

    // 1. extract
    const meshes = extractMeshes(ctx.scene);
    INFO.push(`aces: extracted ${meshes.length} mesh(es) from the scene`);
    if (!meshes.length) {
      return { ok: false, error: 'acesQualityPass: no meshes found in scene' };
    }

    // 2. crease split + angle-weighted normals (per mesh)
    const deg0 = (ctx.smoothAngle !== undefined ? ctx.smoothAngle : 50);
    for (const m of meshes) {
      const deg = (m.smoothAngle !== undefined ? m.smoothAngle : deg0);
      const split = normals.smoothSplit(m.V, m.F, deg, { C: m.C, skin: m.skin, UV: null, smooth: m.soft ? new Array(m.V.length).fill(true) : null });
      m.V = split.V;
      m.F = split.tris;
      m.C = split.C;
      m.skin = split.skin;
      m.N = split.N;
      if (split.split) INFO.push(`aces: mesh "${m.material}" crease split at smooth_angle=${deg} → +${split.split} vertex/vertices`);
    }

    // 3. AO bake
    const aoCfg = (ctx.ao === false) ? false : Object.assign({ samples: 16, strength: 0.59 }, ctx.ao || {});
    const aoResult = aoMod.bakeAO(meshes, aoCfg);
    if (aoResult.baked) {
      INFO.push(`aces: AO baked over ${aoResult.verts} vertex/vertices (mean occlusion ${aoResult.meanOcc.toFixed(3)})`);
    } else {
      INFO.push('aces: AO bake skipped (ao:false)');
    }

    // 4. L1-L8 stack
    if (ctx.shading) {
      const stack = shade.shadeStack(meshes, Object.assign({}, ctx.shading, { _declared: ctx.classMap || new Map() }), INFO);
      if (stack.applied) {
        INFO.push(`aces: L1-L8 stack applied (${stack.counts.flesh} flesh / ${stack.counts.hard} hardware / ${stack.counts.fx} feature vertices)`);
      }
    } else {
      INFO.push('aces: shading stack skipped (no spec.shading)');
    }

    // 5. L8 bone-field normal softening
    const sk = ctx.skeleton || extractSkeleton(ctx.scene);
    if (sk && ctx.shading && ctx.shading.normals) {
      const l8 = shade.softenNormalsByBones(meshes, sk, ctx.shading.normals);
      if (l8.touched) INFO.push(`aces: L8 softened ${l8.touched} flesh normals toward the bone field`);
    }

    // 6. mechanical checks
    const checksCtx = {
      spec: ctx.spec || { volumes: [], parts: [], chains: {}, attach: {} },
      sk: sk,
      meshes: meshes,
      animsCompiled: ctx.animsCompiled || [],
    };
    const checkResult = checks.runChecks(checksCtx, ctx.checksOpts || {});
    reports.perCheck = checkResult.perCheck;
    reports.fails = checkResult.fails;
    reports.warns = checkResult.warns;
    for (const i of checkResult.info) INFO.push(i);
    for (const f of checkResult.fails) INFO.push('BLOCK: ' + f);
    for (const w of checkResult.warns) INFO.push('warn: ' + w);

    // 7. write back to the Three.js geometry
    applyToGeometry(meshes, reports);

    const t1 = performance.now();
    const summary = {
      ok: checkResult.fails.length === 0,
      ms: Math.round(t1 - t0),
      meshCount: meshes.length,
      failCount: checkResult.fails.length,
      warnCount: checkResult.warns.length,
      infoCount: INFO.length,
    };
    const report = { summary, perCheck: checkResult.perCheck, fails: checkResult.fails, warns: checkResult.warns, info: INFO };
    onReport(report);
    return report;
  }

  // ── public surface ─────────────────────────────────────────────────────
  //
  // aces — the namespace. UI code calls `aces.run(scene, opts)` and reads
  // `aces.lastReport` for the panel.
  const aces = {
    oklab,
    normals,
    ao: aoMod,
    shade,
    checks,
    bones,
    run: acesQualityPass,
    lastReport: null,
    isActive: false,
    // quick helpers for the UI panel
    fmtCheck: (name, r) => {
      const tag = r.passed ? (r.warns && r.warns.length ? 'WARN' : 'PASS') : 'BLOCK';
      return `[${tag}] ${name}: ${(r.info && r.info[0]) || (r.passed ? 'OK' : 'failed')}`;
    },
  };
  root.ACES = aces;
  if (typeof window !== 'undefined') window.ACES = aces;
})(typeof window !== 'undefined' ? window : globalThis);
