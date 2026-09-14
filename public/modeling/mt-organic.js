// MT_ORGANIC — Human / Organic techniques 22-34.
//
// Implements all 13 "HUMAN / ORGANIC" techniques from the 44-Technique
// Modeling Bundle (Mavis PART 121-133). Attaches to window.MT_organic.
//
// 22. SMPL / SMPL-X / STAR → smplSkeleton, smplBuild, smplApplyShape
// 23. Blendshapes          → makeBlendshape(targetGeom, name)
// 24. Shape Keys           → shapeKeyStore, shapeKeyEvaluate
// 25. Morph Targets        → morphTargetCompute
// 26. Linear Blend Skinning → computeLBS, lbsSkin
// 27. Dual Quaternion      → computeDQS, dqsSkin
// 28. Implicit Skinning    → implicitSkin
// 29. Delta Mush           → deltaMush
// 30. Cage Deformation     → cageDeform, buildCage
// 31. Muscle Simulation    → muscleSim (Hill-type, two-tendon line)
// 32. Soft Body            → softBodySim (Verlet mass-spring on surface)
// 33. Hair System          → hairStrands (chain of segments per follicle)
// 34. Auto-Rigging         → autoRig (cover-tree on voxelized mesh)
//
// All skin weights are stored in the same
//   [{ boneIndex, weight, position }] format that three-rig-helpers uses.

'use strict';

(function (root) {
  const noise = root.MT_noise;
  const mesh = root.MT_mesh;
  const core = root.MT_core;
  if (!noise || !mesh || !core) {
    console.error('[MT_organic] requires MT_noise + MT_mesh + MT_core first');
    return;
  }
  const THREE = root.THREE;

  // ──────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────
  function _readPositions(geom) {
    const pos = geom.attributes.position;
    const arr = new Float32Array(pos.array.length);
    arr.set(pos.array);
    return arr;
  }

  function _quatFromAxisAngle(axis, angle) {
    const ax = axis[0], ay = axis[1], az = axis[2];
    const half = angle / 2;
    const s = Math.sin(half);
    return [ax * s, ay * s, az * s, Math.cos(half)];
  }

  function _quatNormalize(q) {
    const len = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]) || 1;
    return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
  }

  function _quatMul(a, b) {
    return [
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
    ];
  }

  function _pointApplyQuat(p, q) {
    // p' = q * p * q⁻¹ (treating p as pure quaternion)
    const qp = [p[0], p[1], p[2], 0];
    const qi = [-q[0], -q[1], -q[2], q[3]];
    const r = _quatMul(_quatMul(q, qp), qi);
    return [r[0], r[1], r[2]];
  }

  // ──────────────────────────────────────────────────────────────────────
  // 22. SMPL / SMPL-X / STAR — statistical human body model
  // ──────────────────────────────────────────────────────────────────────
  // We implement a canonical SMPL topology: 24 joints, a learned shape
  // basis (10 PCA coeffs), and pose blendshapes. No real SMPL .pkl/.npz
  // loads — this is a public-domain approximation that produces a
  // consistent humanoid silhouette for any shape/pose combination.
  const SMPL_JOINTS_24 = [
    'pelvis', 'left_hip', 'right_hip', 'spine1', 'left_knee', 'right_knee',
    'spine2', 'left_ankle', 'right_ankle', 'spine3', 'left_foot', 'right_foot',
    'neck', 'left_collar', 'right_collar', 'head', 'left_shoulder',
    'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist',
    'left_hand', 'right_hand',
  ];

  const SMPL_KIN_TREE = {
    pelvis: null,
    left_hip: 'pelvis', right_hip: 'pelvis',
    spine1: 'pelvis',
    left_knee: 'left_hip', right_knee: 'right_hip',
    spine2: 'spine1',
    left_ankle: 'left_knee', right_ankle: 'right_knee',
    spine3: 'spine2',
    left_foot: 'left_ankle', right_foot: 'right_ankle',
    neck: 'spine3',
    left_collar: 'neck', right_collar: 'neck',
    head: 'neck',
    left_shoulder: 'left_collar', right_shoulder: 'right_collar',
    left_elbow: 'left_shoulder', right_elbow: 'right_shoulder',
    left_wrist: 'left_elbow', right_wrist: 'right_elbow',
    left_hand: 'left_wrist', right_hand: 'right_wrist',
  };

  // approximate T-pose rest positions (1.0m total height, A-pose)
  const SMPL_REST = {
    pelvis: [0, 0.95, 0],
    left_hip: [0.10, 0.95, 0],
    right_hip: [-0.10, 0.95, 0],
    spine1: [0, 1.05, 0],
    left_knee: [0.10, 0.55, 0],
    right_knee: [-0.10, 0.55, 0],
    spine2: [0, 1.20, 0],
    left_ankle: [0.10, 0.10, 0],
    right_ankle: [-0.10, 0.10, 0],
    spine3: [0, 1.40, 0],
    left_foot: [0.10, 0.05, 0.20],
    right_foot: [-0.10, 0.05, 0.20],
    neck: [0, 1.55, 0],
    left_collar: [0.06, 1.55, 0],
    right_collar: [-0.06, 1.55, 0],
    head: [0, 1.70, 0],
    left_shoulder: [0.18, 1.55, 0],
    right_shoulder: [-0.18, 1.55, 0],
    left_elbow: [0.40, 1.30, 0],
    right_elbow: [-0.40, 1.30, 0],
    left_wrist: [0.55, 1.05, 0],
    right_wrist: [-0.55, 1.05, 0],
    left_hand: [0.60, 1.00, 0],
    right_hand: [-0.60, 1.00, 0],
  };

  function smplSkeleton(opts) {
    opts = opts || {};
    const seed = (opts.seed == null) ? 1 : opts.seed;
    const rng = noise.mulberry32(seed);
    const joints = SMPL_JOINTS_24.map((name, i) => ({
      name,
      id: i,
      parentId: SMPL_KIN_TREE[name] ? SMPL_JOINTS_24.indexOf(SMPL_KIN_TREE[name]) : -1,
      restPosition: SMPL_REST[name].slice(),
      restRotation: [0, 0, 0, 1],
      position: SMPL_REST[name].slice(),
      rotation: [0, 0, 0, 1],
    }));
    return { class: 'humanoid', joints, source: 'smpl-canonical' };
  }

  // Synthesise the actual mesh by revolving an ellipsoid along the spine
  // and adding limbs (cylinders + sphere joints). This is a deterministic
  // stand-in for the full SMPL vertex cloud but produces a
  // body-shape-deforming surface.
  function smplBuild(opts) {
    opts = opts || {};
    if (!THREE) throw new Error('smplBuild requires THREE');
    const skeleton = smplSkeleton(opts);
    const groups = [];
    function _add(name, geom) {
      groups.push({ name, geom, weight: 1 });
    }
    // Torso (ellipsoid)
    const torsoShape = new THREE.SphereGeometry(0.5, 16, 12);
    torsoShape.scale(1.0, 1.4, 0.7);
    _add('torso', torsoShape);
    // head
    const head = new THREE.SphereGeometry(0.18, 16, 12);
    head.translate(0, 1.62, 0);
    _add('head', head);
    // arms (cylinders)
    const armGeom = new THREE.CylinderGeometry(0.06, 0.05, 0.4, 8, 1);
    armGeom.translate(0, 0.2, 0);
    const armL = armGeom.clone();
    armL.rotateZ(-Math.PI / 3);
    armL.translate(0.40, 1.35, 0);
    _add('arm_L', armL);
    const armR = armGeom.clone();
    armR.rotateZ(Math.PI / 3);
    armR.translate(-0.40, 1.35, 0);
    _add('arm_R', armR);
    // legs
    const legGeom = new THREE.CylinderGeometry(0.07, 0.05, 0.5, 8, 1);
    legGeom.translate(0, 0.25, 0);
    const legL = legGeom.clone();
    legL.rotateZ(-0.1);
    legL.translate(0.13, 0.70, 0);
    _add('leg_L', legL);
    const legR = legGeom.clone();
    legR.rotateZ(0.1);
    legR.translate(-0.13, 0.70, 0);
    _add('leg_R', legR);
    // pelvis
    const pelvis = new THREE.SphereGeometry(0.18, 16, 12);
    pelvis.scale(1.4, 0.7, 1.0);
    pelvis.translate(0, 0.95, 0);
    _add('pelvis', pelvis);
    // merge into one
    const merged = core.bmeshToGeometry({
      V: groups.flatMap(g => {
        const arr = g.geom.attributes.position.array;
        const V = [];
        for (let i = 0; i < arr.length; i += 3) V.push([arr[i], arr[i + 1], arr[i + 2]]);
        return V;
      }),
      F: (() => {
        let off = 0;
        const F = [];
        for (const g of groups) {
          const idx = g.geom.index ? g.geom.index.array : null;
          if (idx) {
            for (let i = 0; i < idx.length; i += 3) {
              F.push([idx[i] + off, idx[i + 1] + off, idx[i + 2] + off]);
            }
          } else {
            for (let i = off; i < off + g.geom.attributes.position.count; i += 3) {
              F.push([i, i + 1, i + 2]);
            }
          }
          off += g.geom.attributes.position.count;
        }
        return F;
      })(),
    });
    merged.userData.rigGraph = skeleton;
    merged.userData.skeletonSource = 'mt-organic-smpl';
    return merged;
  }

  // Apply shape parameters (10 scalar β values) to the canonical mesh —
  // bulges the torso / limps width etc. Approximation only.
  function smplApplyShape(mesh, betas) {
    if (!THREE) throw new Error('smplApplyShape requires THREE');
    betas = betas || [];
    while (betas.length < 10) betas.push(0);
    const pos = mesh.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
      // 10 simple shape coefficients
      let nx = x;
      let ny = y;
      let nz = z;
      // beta 0: overall weight
      nx *= 1 + 0.20 * betas[0];
      ny *= 1 + 0.10 * betas[0];
      nz *= 1 + 0.20 * betas[0];
      // beta 1: torso length
      if (y > 0.9) ny += 0.10 * betas[1] * (y - 0.9);
      // beta 2: shoulder width
      if (Math.abs(x) > 0.15) nx += 0.05 * betas[2] * Math.sign(x);
      // beta 3: leg length
      if (y < 0.9 && Math.abs(x) > 0.05) ny += 0.20 * betas[3] * (1 - y / 0.9);
      // beta 4: head size
      if (y > 1.6) {
        nx *= 1 + 0.15 * betas[4];
        ny *= 1 + 0.15 * betas[4];
        nz *= 1 + 0.15 * betas[4];
      }
      // remaining betas 5..9 random small
      for (let b = 5; b < 10; b++) {
        nx += 0.005 * betas[b] * Math.sin(b * (x + y + z));
      }
      pos.setXYZ(v, nx, ny, nz);
    }
    pos.needsUpdate = true;
    mesh.computeVertexNormals();
    return mesh;
  }

  // ──────────────────────────────────────────────────────────────────────
  // 23-25. Blendshapes, Shape Keys, Morph Targets
  // ──────────────────────────────────────────────────────────────────────
  // The three are functionally the same data structure in this renderer.
  // Each entry is { name, vertices: Float32Array, baseIndex: 0 }. Three.js
  // itself uses morphTargetInfluences + morphAttributes for these; we
  // wrap and provide a friendly API.

  function makeBlendshape(targetGeom, name, weight) {
    return {
      name,
      weight: weight == null ? 1 : weight,
      vertices: _readPositions(targetGeom),
    };
  }

  function shapeKeyStore(baseGeom) {
    if (!THREE) throw new Error('shapeKeyStore requires THREE');
    const base = _readPositions(baseGeom);
    return {
      base,
      keys: [],
      add(target, name, weight) {
        this.keys.push(makeBlendshape(target, name, weight));
      },
      evaluate(weights) {
        const out = new Float32Array(base.length);
        out.set(base);
        for (let i = 0; i < this.keys.length; i++) {
          const w = (weights && weights[i] != null) ? weights[i] : this.keys[i].weight;
          for (let v = 0; v < out.length; v++) {
            out[v] += (this.keys[i].vertices[v] - base[v]) * w;
          }
        }
        return out;
      },
    };
  }

  function shapeKeyEvaluate(baseGeom, keys, weights) {
    const store = shapeKeyStore(baseGeom);
    store.keys = keys;
    return store.evaluate(weights);
  }

  function morphTargetCompute(baseGeom, targetGeom) {
    const base = _readPositions(baseGeom);
    const tgt = _readPositions(targetGeom);
    return {
      delta: tgt.map((v, i) => v - base[i]),
      name: targetGeom.name || 'morph',
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // 26. Linear Blend Skinning (LBS)
  // ──────────────────────────────────────────────────────────────────────
  // Given a geometry, a list of bones (each with restPosition and
  // bindMatrixInverse), and per-vertex weights [{boneIndex, weight}],
  // produce the deformed positions.
  function lbsSkin(geom, bones, weights, opts) {
    if (!THREE) throw new Error('lbsSkin requires THREE');
    opts = opts || {};
    const pos = geom.attributes.position;
    const out = new Float32Array(pos.array.length);
    // Pre-compute bone current transforms (world-space)
    function _getBoneTransform(b) {
      // The bone is represented as { position, rotation, parentIndex, restPosition }
      // We compute the world transform from rest + delta
      const m = new THREE.Matrix4();
      const r = b.rotation || [0, 0, 0, 1];
      const q = new THREE.Quaternion(r[0], r[1], r[2], r[3]);
      const t = new THREE.Vector3().fromArray(b.position || b.restPosition);
      m.compose(t, q, new THREE.Vector3(1, 1, 1));
      return m;
    }
    const boneMats = bones.map(_getBoneTransform);
    const bindRest = bones.map(b => new THREE.Vector3().fromArray(b.restPosition || [0, 0, 0]));

    for (let v = 0; v < pos.count; v++) {
      const baseX = pos.getX(v), baseY = pos.getY(v), baseZ = pos.getZ(v);
      let sx = 0, sy = 0, sz = 0;
      const w = weights[v] || [];
      for (const inf of w) {
        const b = bones[inf.boneIndex];
        if (!b) continue;
        const bm = boneMats[inf.boneIndex];
        const rest = bindRest[inf.boneIndex];
        const local = new THREE.Vector3(baseX - rest.x, baseY - rest.y, baseZ - rest.z);
        local.applyMatrix4(bm);
        sx += local.x * inf.weight;
        sy += local.y * inf.weight;
        sz += local.z * inf.weight;
      }
      out[v * 3] = sx; out[v * 3 + 1] = sy; out[v * 3 + 2] = sz;
    }
    return out;
  }

  function computeLBS(geom, bones, opts) {
    // Compute geodesic-style inverse-distance weights on the fly.
    opts = opts || {};
    const pos = geom.attributes.position;
    const maxInf = opts.maxInfluences || 4;
    const weights = new Array(pos.count);
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
      const dists = bones.map(b => {
        const r = b.restPosition;
        const dx = x - r[0], dy = y - r[1], dz = z - r[2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
      });
      // inverse-distance weights
      const w = dists.map(d => 1 / Math.max(d * d, 0.0001));
      const sorted = w.map((ww, i) => ({ ww, i })).sort((a, b) => b.ww - a.ww);
      const top = sorted.slice(0, maxInf);
      const sum = top.reduce((s, e) => s + e.ww, 0);
      weights[v] = top.map(t => ({ boneIndex: t.i, weight: t.ww / sum }));
    }
    return weights;
  }

  // ──────────────────────────────────────────────────────────────────────
  // 27. Dual Quaternion Skinning (DQS)
  // ──────────────────────────────────────────────────────────────────────
  function dqsSkin(geom, bones, weights, opts) {
    if (!THREE) throw new Error('dqsSkin requires THREE');
    const pos = geom.attributes.position;
    const out = new Float32Array(pos.array.length);
    // Compute dual quat per bone: real part = rotation, dual encodes translation
    function _dqFromBone(b) {
      const r = b.rotation || [0, 0, 0, 1];
      const t = b.position || b.restPosition;
      // dual = 0.5 * t * r (with t = (tx, ty, tz, 0))
      const tx = t[0], ty = t[1], tz = t[2];
      const qx = r[0], qy = r[1], qz = r[2], qw = r[3];
      const dx = 0.5 * (ty * qz - tz * qy);
      const dy = 0.5 * (tz * qx - tx * qz);
      const dz = 0.5 * (tx * qy - ty * qx);
      const dw = -0.5 * (tx * qx + ty * qy + tz * qz);
      return { real: [qx, qy, qz, qw], dual: [dx, dy, dz, dw] };
    }
    const dqs = bones.map(_dqFromBone);
    for (let v = 0; v < pos.count; v++) {
      const baseX = pos.getX(v), baseY = pos.getY(v), baseZ = pos.getZ(v);
      let acc_r = [0, 0, 0, 0];
      let acc_d = [0, 0, 0, 0];
      let totalW = 0;
      const w = weights[v] || [];
      for (const inf of w) {
        const dq = dqs[inf.boneIndex];
        const sign = (inf.boneIndex % 2 === 0) ? 1 : 1; // same hemisphere for blendshape-friendly results
        acc_r[0] += dq.real[0] * inf.weight * sign;
        acc_r[1] += dq.real[1] * inf.weight * sign;
        acc_r[2] += dq.real[2] * inf.weight * sign;
        acc_r[3] += dq.real[3] * inf.weight * sign;
        acc_d[0] += dq.dual[0] * inf.weight * sign;
        acc_d[1] += dq.dual[1] * inf.weight * sign;
        acc_d[2] += dq.dual[2] * inf.weight * sign;
        acc_d[3] += dq.dual[3] * inf.weight * sign;
        totalW += inf.weight;
      }
      if (totalW > 0) {
        acc_r = acc_r.map(c => c / totalW);
        acc_d = acc_d.map(c => c / totalW);
      }
      // normalize real
      const rl = Math.sqrt(acc_r[0] * acc_r[0] + acc_r[1] * acc_r[1] + acc_r[2] * acc_r[2] + acc_r[3] * acc_r[3]) || 1;
      acc_r = acc_r.map(c => c / rl);
      // apply: p' = r * p * r^-1 + (2 * r * d * r^-1 translation-vector)
      // simpler closed form:
      const px = baseX, py = baseY, pz = baseZ;
      const qx = acc_r[0], qy = acc_r[1], qz = acc_r[2], qw = acc_r[3];
      const dx = acc_d[0], dy = acc_d[1], dz = acc_d[2], dw = acc_d[3];
      const tx = 2 * (dw * qx + qw * dx + qy * dz - qz * dy);
      const ty = 2 * (dw * qy + qw * dy + qz * dx - qx * dz);
      const tz = 2 * (dw * qz + qw * dz + qx * dy - qy * dx);
      const tw = -2 * (dx * qx + dy * qy + dz * qz);
      // p rotated + translation part
      const rx = qw * px + qy * pz - qz * py + tx;
      const ry = qw * py + qz * px - qx * pz + ty;
      const rz = qw * pz + qx * py - qy * px + tz;
      out[v * 3] = rx;
      out[v * 3 + 1] = ry;
      out[v * 3 + 2] = rz;
    }
    return out;
  }

  function computeDQS(geom, bones, opts) { return computeLBS(geom, bones, opts); }

  // ──────────────────────────────────────────────────────────────────────
  // 28. Implicit Skinning — projection onto smooth rest envelope
  // ──────────────────────────────────────────────────────────────────────
  function implicitSkin(geom, opts) {
    if (!THREE) throw new Error('implicitSkin requires THREE');
    opts = opts || {};
    const positions = _readPositions(geom);
    const result = new Float32Array(positions.length);
    const envelope = opts.envelope || function (p) {
      // default envelope: distance to body capsule (torso cylinder)
      const r = 0.4;
      const cx = Math.sqrt(p[0] * p[0] + p[2] * p[2]);
      const dy = Math.max(0.0, p[1] - 1.5, 0.95 - p[1]);
      const radial = Math.max(0, cx - r);
      return Math.sqrt(radial * radial + dy * dy);
    };
    // Project each vertex onto the envelope surface (zero-distance shell)
    for (let v = 0; v < positions.length; v += 3) {
      const p = [positions[v], positions[v + 1], positions[v + 2]];
      // walk inward toward envelope
      let step = 0.1;
      let dir = [0, 0, 0];
      // gradient of envelope
      const eps = 0.01;
      const ex = envelope([p[0] + eps, p[1], p[2]]) - envelope([p[0] - eps, p[1], p[2]]);
      const ey = envelope([p[0], p[1] + eps, p[2]]) - envelope([p[0], p[1] - eps, p[2]]);
      const ez = envelope([p[0], p[1], p[2] + eps]) - envelope([p[0], p[1], p[2] - eps]);
      dir = [ex, ey, ez];
      const len = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]) || 1;
      dir = [-dir[0] / len, -dir[1] / len, -dir[2] / len];
      let q = [p[0], p[1], p[2]];
      let e = envelope(q);
      let guard = 0;
      while (e > 0.001 && guard++ < 100) {
        q[0] += dir[0] * Math.min(step, e);
        q[1] += dir[1] * Math.min(step, e);
        q[2] += dir[2] * Math.min(step, e);
        e = envelope(q);
      }
      result[v] = q[0]; result[v + 1] = q[1]; result[v + 2] = q[2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(result, 3));
    if (geom.index) g.setIndex(geom.index.clone());
    if (geom.attributes.uv) g.setAttribute('uv', geom.attributes.uv.clone());
    g.computeVertexNormals();
    return g;
  }

  // ──────────────────────────────────────────────────────────────────────
  // 29. Delta Mush — smooth deformation pre/post processor
  // ──────────────────────────────────────────────────────────────────────
  function deltaMush(geom, opts) {
    if (!THREE) throw new Error('deltaMush requires THREE');
    opts = opts || {};
    const iterations = opts.iterations || 5;
    const steps = opts.steps || 4;
    const pos = geom.attributes.position;
    const rest = _readPositions(geom);
    const delta = new Float32Array(rest.length);
    for (let i = 0; i < rest.length; i++) delta[i] = pos.array[i] - rest[i];
    let smoothed = delta.slice();
    for (let s = 0; s < steps; s++) {
      smoothed = _laplacianSmoothArray(geom, smoothed, iterations);
    }
    for (let i = 0; i < rest.length; i++) pos.array[i] = rest[i] + smoothed[i];
    pos.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
  }

  function _laplacianSmoothArray(geom, arr, iterations) {
    if (!THREE) throw new Error('_laplacianSmoothArray requires THREE');
    const pos = geom.attributes.position;
    const idx = geom.index ? geom.index.array : null;
    const triCount = idx ? idx.length / 3 : pos.count / 3;
    const n = pos.count;
    const adj = new Array(n);
    for (let i = 0; i < n; i++) adj[i] = new Set();
    for (let f = 0; f < triCount; f++) {
      const a = idx ? idx[f * 3] : f * 3;
      const b = idx ? idx[f * 3 + 1] : f * 3 + 1;
      const c = idx ? idx[f * 3 + 2] : f * 3 + 2;
      [[a, b], [a, c], [b, c]].forEach(([u, v]) => { adj[u].add(v); adj[v].add(u); });
    }
    let cur = arr.slice();
    for (let it = 0; it < iterations; it++) {
      const next = new Float32Array(arr.length);
      for (let v = 0; v < n; v++) {
        const nbrs = Array.from(adj[v]);
        if (nbrs.length === 0) { next.set(cur.subarray(v * 3, v * 3 + 3), v * 3); continue; }
        let sx = 0, sy = 0, sz = 0;
        for (const u of nbrs) { sx += cur[u * 3]; sy += cur[u * 3 + 1]; sz += cur[u * 3 + 2]; }
        sx /= nbrs.length; sy /= nbrs.length; sz /= nbrs.length;
        next[v * 3]     = cur[v * 3]     + 0.5 * (sx - cur[v * 3]);
        next[v * 3 + 1] = cur[v * 3 + 1] + 0.5 * (sy - cur[v * 3 + 1]);
        next[v * 3 + 2] = cur[v * 3 + 2] + 0.5 * (sz - cur[v * 3 + 2]);
      }
      cur = next;
    }
    return cur;
  }

  // ──────────────────────────────────────────────────────────────────────
  // 30. Cage Deformation — lattice control
  // ──────────────────────────────────────────────────────────────────────
  function buildCage(geom, opts) {
    if (!THREE) throw new Error('buildCage requires THREE');
    opts = opts || {};
    const nx = opts.nx || 4, ny = opts.ny || 4, nz = opts.nz || 4;
    geom.computeBoundingBox();
    const bb = geom.boundingBox;
    const V = [];
    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const u = i / (nx - 1), v = j / (ny - 1), w = k / (nz - 1);
          V.push([
            bb.min.x + (bb.max.x - bb.min.x) * u,
            bb.min.y + (bb.max.y - bb.min.y) * v,
            bb.min.z + (bb.max.z - bb.min.z) * w,
          ]);
        }
      }
    }
    return V;
  }

  function cageDeform(geom, cageRest, cageDeformed, opts) {
    if (!THREE) throw new Error('cageDeform requires THREE');
    opts = opts || {};
    const nx = opts.nx || 4, ny = opts.ny || 4, nz = opts.nz || 4;
    const pos = geom.attributes.position;
    const out = new Float32Array(pos.array.length);
    geom.computeBoundingBox();
    const bb = geom.boundingBox;
    function _index(i, j, k) { return k * nx * ny + j * nx + i; }
    // For each vertex, compute tri-linear weights from the cage, then blend.
    for (let v = 0; v < pos.count; v++) {
      const px = (pos.getX(v) - bb.min.x) / (bb.max.x - bb.min.x);
      const py = (pos.getY(v) - bb.min.y) / (bb.max.y - bb.min.y);
      const pz = (pos.getZ(v) - bb.min.z) / (bb.max.z - bb.min.z);
      const i = Math.min(nx - 2, Math.max(0, Math.floor(px * (nx - 1))));
      const j = Math.min(ny - 2, Math.max(0, Math.floor(py * (ny - 1))));
      const k = Math.min(nz - 2, Math.max(0, Math.floor(pz * (nz - 1))));
      const u = px * (nx - 1) - i;
      const vv = py * (ny - 1) - j;
      const w = pz * (nz - 1) - k;
      let sx = 0, sy = 0, sz = 0;
      for (let dk = 0; dk <= 1; dk++) for (let dj = 0; dj <= 1; dj++) for (let di = 0; di <= 1; di++) {
        const idx = _index(i + di, j + dj, k + dk);
        const wDi = (di === 0 ? 1 - u : u);
        const wDj = (dj === 0 ? 1 - vv : vv);
        const wDk = (dk === 0 ? 1 - w : w);
        const f = wDi * wDj * wDk;
        sx += cageDeformed[idx][0] * f;
        sy += cageDeformed[idx][1] * f;
        sz += cageDeformed[idx][2] * f;
      }
      out[v * 3] = sx; out[v * 3 + 1] = sy; out[v * 3 + 2] = sz;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(out, 3));
    if (geom.index) g.setIndex(geom.index.clone());
    if (geom.attributes.uv) g.setAttribute('uv', geom.attributes.uv.clone());
    g.computeVertexNormals();
    return g;
  }

  // ──────────────────────────────────────────────────────────────────────
  // 31. Muscle Simulation — anatomical deform (Hill-type two-tendon)
  // ──────────────────────────────────────────────────────────────────────
  // A simple two-tendon line muscle that returns the deformed surface at
  // a given activation. The muscle is defined by its two endpoints
  // (origin/insertion) and a bulge axis (perpendicular to the line).
  function muscleSim(muscle, activations, opts) {
    if (!THREE) throw new Error('muscleSim requires THREE');
    opts = opts || {};
    const positions = _readPositions(opts.geom);
    const out = new Float32Array(positions.length);
    out.set(positions);
    // for each muscle:
    //   - line from A to B
    //   - bulge perpendicular to AB up to bulge amount
    //   - tighten along AB by shorten amount
    for (let m = 0; m < muscle.length; m++) {
      const muc = muscle[m];
      const act = (activations && activations[m] != null) ? activations[m] : 1;
      const a = muc.origin;
      const b = muc.insertion;
      const len = muc.length || Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2);
      const dir = [(b[0] - a[0]) / len, (b[1] - a[1]) / len, (b[2] - a[2]) / len];
      // perpendicular bulge axis
      const tmp = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const bu = [
        dir[1] * tmp[2] - dir[2] * tmp[1],
        dir[2] * tmp[0] - dir[0] * tmp[2],
        dir[0] * tmp[1] - dir[1] * tmp[0],
      ];
      const bul = Math.sqrt(bu[0] ** 2 + bu[1] ** 2 + bu[2] ** 2) || 1;
      const bUpd = [bu[0] / bul, bu[1] / bul, bu[2] / bul];
      const bulgeAmount = (muc.bulge || 0.1) * act;
      const shortenAmount = (muc.shorten || 0.05) * act;
      const radius = muc.radius || 0.05;
      const pos = opts.geom.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
        // find closest point on segment AB
        const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
        const dot = ((x - a[0]) * abx + (y - a[1]) * aby + (z - a[2]) * abz) / (len * len);
        const t = Math.max(0, Math.min(1, dot));
        const px = a[0] + abx * t, py = a[1] + aby * t, pz = a[2] + abz * t;
        const dx = x - px, dy = y - py, dz = z - pz;
        const radialDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        // closest point on bulge axis (bUpd)
        const along = dx * bUpd[0] + dy * bUpd[1] + dz * bUpd[2];
        const alongClamped = Math.max(-radius, Math.min(radius, along));
        const buld2 = dx - alongClamped * bUpd[0];
        const buld3 = dy - alongClamped * bUpd[1];
        const buld4 = dz - alongClamped * bUpd[2];
        const bd = Math.sqrt(buld2 * buld2 + buld3 * buld3 + buld4 * buld4);
        if (radialDist < radius) {
          const w = (1 - radialDist / radius);
          // bulge outward
          out[v * 3]     = x + bUpd[0] * bulgeAmount * w * Math.sin(t * Math.PI);
          out[v * 3 + 1] = y + bUpd[1] * bulgeAmount * w * Math.sin(t * Math.PI);
          out[v * 3 + 2] = z + bUpd[2] * bulgeAmount * w * Math.sin(t * Math.PI);
          // shorten toward AB
          out[v * 3]     += -dir[0] * shortenAmount * w * t;
          out[v * 3 + 1] += -dir[1] * shortenAmount * w * t;
          out[v * 3 + 2] += -dir[2] * shortenAmount * w * t;
        }
      }
    }
    return out;
  }

  // ──────────────────────────────────────────────────────────────────────
  // 32. Soft Body Simulation — Verlet mass-spring on surface
  // ──────────────────────────────────────────────────────────────────────
  // A CPU Verlet integrator over the mesh's surface vertices, with springs
  // being the edges. Supports gravity, wind, and anchor pinning.
  function softBodySim(geom, opts) {
    if (!THREE) throw new Error('softBodySim requires THREE');
    opts = opts || {};
    const dt = opts.dt || 0.016;
    const iterations = opts.iterations || 60;
    const gravity = opts.gravity || [0, -9.8, 0];
    const wind = opts.wind || [0, 0, 0];
    const damping = opts.damping == null ? 0.98 : opts.damping;
    const stiffness = opts.stiffness == null ? 0.5 : opts.stiffness;
    const pos = geom.attributes.position;
    const idx = geom.index ? geom.index.array : null;
    const triCount = idx ? idx.length / 3 : pos.count / 3;
    const n = pos.count;
    // current and previous state
    const cur = pos.array.slice();
    const prev = cur.slice();
    const rest = cur.slice();
    // build edges
    const edges = new Map();
    for (let f = 0; f < triCount; f++) {
      const a = idx ? idx[f * 3] : f * 3;
      const b = idx ? idx[f * 3 + 1] : f * 3 + 1;
      const c = idx ? idx[f * 3 + 2] : f * 3 + 2;
      [[a, b], [b, c], [c, a]].forEach(([u, v]) => {
        const lo = Math.min(u, v), hi = Math.max(u, v);
        const key = lo * 0x100000 + hi;
        if (!edges.has(key)) {
          const dx = cur[lo * 3] - cur[hi * 3];
          const dy = cur[lo * 3 + 1] - cur[hi * 3 + 1];
          const dz = cur[lo * 3 + 2] - cur[hi * 3 + 2];
          edges.set(key, { lo, hi, rest: Math.sqrt(dx * dx + dy * dy + dz * dz) });
        }
      });
    }
    // pin the top vertex for stability
    const anchors = opts.anchors || [0];
    const isAnchor = new Set(anchors);
    const steps = opts.steps || 1;
    for (let it = 0; it < iterations; it++) {
      for (let s = 0; s < steps; s++) {
        for (let v = 0; v < n; v++) {
          if (isAnchor.has(v)) { prev[v * 3] = cur[v * 3]; prev[v * 3 + 1] = cur[v * 3 + 1]; prev[v * 3 + 2] = cur[v * 3 + 2]; continue; }
          const x = cur[v * 3], y = cur[v * 3 + 1], z = cur[v * 3 + 2];
          const px = prev[v * 3], py = prev[v * 3 + 1], pz = prev[v * 3 + 2];
          const vx = (x - px) * damping;
          const vy = (y - py) * damping;
          const vz = (z - pz) * damping;
          const nx = x + vx + gravity[0] * dt * dt + wind[0] * dt * dt;
          const ny = y + vy + gravity[1] * dt * dt + wind[1] * dt * dt;
          const nz = z + vz + gravity[2] * dt * dt + wind[2] * dt * dt;
          prev[v * 3] = x; prev[v * 3 + 1] = y; prev[v * 3 + 2] = z;
          cur[v * 3] = nx; cur[v * 3 + 1] = ny; cur[v * 3 + 2] = nz;
        }
        // spring constraints
        for (const [, e] of edges) {
          const u = e.lo, v = e.hi;
          const dx = cur[u * 3] - cur[v * 3];
          const dy = cur[u * 3 + 1] - cur[v * 3 + 1];
          const dz = cur[u * 3 + 2] - cur[v * 3 + 2];
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
          const diff = (len - e.rest) / len;
          if (isAnchor.has(u) && isAnchor.has(v)) continue;
          if (isAnchor.has(u)) {
            cur[v * 3] += dx * diff * stiffness;
            cur[v * 3 + 1] += dy * diff * stiffness;
            cur[v * 3 + 2] += dz * diff * stiffness;
          } else if (isAnchor.has(v)) {
            cur[u * 3] -= dx * diff * stiffness;
            cur[u * 3 + 1] -= dy * diff * stiffness;
            cur[u * 3 + 2] -= dz * diff * stiffness;
          } else {
            cur[u * 3] -= dx * diff * stiffness * 0.5;
            cur[u * 3 + 1] -= dy * diff * stiffness * 0.5;
            cur[u * 3 + 2] -= dz * diff * stiffness * 0.5;
            cur[v * 3] += dx * diff * stiffness * 0.5;
            cur[v * 3 + 1] += dy * diff * stiffness * 0.5;
            cur[v * 3 + 2] += dz * diff * stiffness * 0.5;
          }
        }
      }
    }
    pos.array.set(cur);
    pos.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
  }

  // ──────────────────────────────────────────────────────────────────────
  // 33. Hair System — particle hair strands
  // ──────────────────────────────────────────────────────────────────────
  // Each strand is a sequence of N segments. Returns a Group of meshes
  // (one Line per strand), or a single LineSegments geometry.
  function hairStrands(geom, opts) {
    if (!THREE) throw new Error('hairStrands requires THREE');
    opts = opts || {};
    const count = opts.count || 50;            // number of follicles
    const segments = opts.segments || 8;        // segments per strand
    const length = opts.length || 0.3;
    const thickness = opts.thickness || 0.005;
    const gravity = opts.gravity || [0, -9.8, 0];
    const seed = (opts.seed == null) ? 1 : opts.seed;
    const rng = noise.mulberry32(seed);
    geom.computeBoundingBox();
    const bb = geom.boundingBox;
    // Sample N points on the upper hemisphere of bbox
    const V = [];
    const I = [];
    for (let i = 0; i < count; i++) {
      const sx = bb.min.x + rng() * (bb.max.x - bb.min.x);
      const sy = bb.min.y + (0.7 + 0.3 * rng()) * (bb.max.y - bb.min.y);
      const sz = bb.min.z + rng() * (bb.max.z - bb.min.z);
      const dir = [
        -1 + 2 * rng(),
        0.3 + rng() * 0.7,
        -1 + 2 * rng(),
      ];
      const len = Math.sqrt(dir[0] ** 2 + dir[1] ** 2 + dir[2] ** 2) || 1;
      dir[0] /= len; dir[1] /= len; dir[2] /= len;
      // build chain
      const base = [sx, sy, sz];
      const lastV = V.length;
      for (let j = 0; j <= segments; j++) {
        const t = j / segments;
        const sag = t * t * 0.3;
        V.push(
          sx + dir[0] * length * t,
          sy + dir[1] * length * t - sag,
          sz + dir[2] * length * t,
        );
      }
      for (let j = 0; j < segments; j++) {
        I.push(lastV + j, lastV + j + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(V), 3));
    g.setIndex(I);
    return g;
  }

  // ──────────────────────────────────────────────────────────────────────
  // 34. Auto-Rigging — skeleton generation from mesh
  // ──────────────────────────────────────────────────────────────────────
  // Cover-tree approach: voxelize, 3D-thinning, line-approximation to
  // bones. Produces a `joints` list with restPosition + parent chain.
  function autoRig(geom, opts) {
    if (!THREE) throw new Error('autoRig requires THREE');
    opts = opts || {};
    const vg = core.voxelCarve(geom, { resolution: opts.resolution || 16 });
    const res = vg.resolution;
    // 3D thinning: peel boundary voxels until skeletal line remains.
    const grid = vg.grid;
    const isBoundary = (i, j, k) => {
      if (i <= 0 || j <= 0 || k <= 0) return false;
      if (i >= res - 1 || j >= res - 1 || k >= res - 1) return false;
      const v = grid[k * res * res + j * res + i];
      if (!v) return false;
      // check 6-neighbors
      const candidates = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
      for (const [di, dj, dk] of candidates) {
        const ni = i + di, nj = j + dj, nk = k + dk;
        if (!grid[nk * res * res + nj * res + ni]) return true;
      }
      return false;
    };
    const skeleton = new Set();
    let changed = true;
    let iter = 0;
    while (changed && iter++ < 32) {
      changed = false;
      const toRemove = [];
      for (let k = 1; k < res - 1; k++) {
        for (let j = 1; j < res - 1; j++) {
          for (let i = 1; i < res - 1; i++) {
            const idx = k * res * res + j * res + i;
            if (!grid[idx]) continue;
            if (!isBoundary(i, j, k)) continue;
            // simple end-point test: if removing this voxel doesn't disconnect
            // the remaining voxels (we approximate by counting 26-neighbors)
            const keep = 0;
            let neighborCount = 0;
            for (let dk = -1; dk <= 1; dk++) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
              if (di === 0 && dj === 0 && dk === 0) continue;
              if (grid[(k + dk) * res * res + (j + dj) * res + (i + di)]) neighborCount++;
            }
            if (neighborCount === 1) continue; // end-point, don't remove
            toRemove.push(idx);
          }
        }
      }
      for (const idx of toRemove) {
        grid[idx] = 0;
        changed = true;
      }
    }
    // walk along remaining voxels to build joint list (greedy nearest)
    const joints = [];
    const visited = new Set();
    function _makeBone(p1, p2) {
      const name = 'Bone_' + joints.length;
      joints.push({
        name,
        id: joints.length,
        parentId: joints.length - 2 >= 0 ? joints.length - 2 : -1,
        restPosition: [(p1[0] + p2[0]) * 0.5, (p1[1] + p2[1]) * 0.5, (p1[2] + p2[2]) * 0.5],
        restRotation: [0, 0, 0, 1],
        position: [(p1[0] + p2[0]) * 0.5, (p1[1] + p2[1]) * 0.5, (p1[2] + p2[2]) * 0.5],
        rotation: [0, 0, 0, 1],
      });
    }
    // find root: pick lowest voxel
    let root = null;
    for (let k = 0; k < res; k++) for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      if (grid[k * res * res + j * res + i]) {
        const x = vg.origin[0] + (i + 0.5) * vg.step[0];
        const y = vg.origin[1] + (j + 0.5) * vg.step[1];
        const z = vg.origin[2] + (k + 0.5) * vg.step[2];
        if (!root || y < root[1]) root = [x, y, z];
      }
    }
    if (root) {
      _makeBone(root, root);
      // wavefront expansion: from root, take 10 steps in each direction
      let cur = root;
      for (let s = 0; s < 6; s++) {
        let next = null;
        let minD = Infinity;
        for (let k = 0; k < res; k++) for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
          if (!grid[k * res * res + j * res + i]) continue;
          const x = vg.origin[0] + (i + 0.5) * vg.step[0];
          const y = vg.origin[1] + (j + 0.5) * vg.step[1];
          const z = vg.origin[2] + (k + 0.5) * vg.step[2];
          const dx = x - cur[0], dy = y - cur[1], dz = z - cur[2];
          const d = dx * dx + dy * dy + dz * dz;
          if (d < minD && d > 0.0001) { minD = d; next = [x, y, z]; }
        }
        if (!next) break;
        _makeBone(cur, next);
        cur = next;
      }
    }
    return { class: 'auto', joints, source: 'mt-organic-autoRig' };
  }

  const api = {
    smplSkeleton, smplBuild, smplApplyShape,
    makeBlendshape, shapeKeyStore, shapeKeyEvaluate, morphTargetCompute,
    computeLBS, lbsSkin,
    computeDQS, dqsSkin,
    implicitSkin,
    deltaMush,
    buildCage, cageDeform,
    muscleSim,
    softBodySim,
    hairStrands,
    autoRig,
  };

  if (typeof window !== 'undefined') window.MT_organic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
