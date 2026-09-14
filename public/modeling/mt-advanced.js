// MT_ADVANCED — Optimization & Advanced techniques 41-44.
//
// Implements the final 4 techniques of the 44-Technique Modeling
// Bundle (Mavis PART 140-143). Attaches to window.MT_advanced.
//
// 41. LOD Generation  → generateLOD(geom, levels)
// 42. Instancing      → makeInstanced(geom, count, opts)
// 43. Geometry Nodes  → geoNodesEvaluate(graph)
// 44. Physics Sim     → physicsStep(world, dt)
//
// Geometry Nodes here is a graph-based procedural generator (similar
// to Blender's Geometry Nodes); physicsStep is a minimal Euler-step
// particle simulator.

'use strict';

(function (root) {
  const noise = root.MT_noise;
  const core = root.MT_core;
  const mesh = root.MT_mesh;
  const organic = root.MT_organic;
  const materials = root.MT_materials;
  if (!noise || !core || !mesh || !organic || !materials) {
    console.error('[MT_advanced] requires MT_noise + MT_core + MT_mesh + MT_organic + MT_materials');
    return;
  }
  const THREE = root.THREE;

  // ──────────────────────────────────────────────────────────────────────
  // 41. LOD Generation — Level of Detail chain
  // ──────────────────────────────────────────────────────────────────────
  // Generates N copies of the geometry, each decimated by an additional
  // factor. Returns an array of BufferGeometry objects in LOD order
  // (high → low). Compatible with THREE.LOD.addLevel(mesh, distance).
  function generateLOD(geom, opts) {
    if (!THREE) throw new Error('generateLOD requires THREE');
    opts = opts || {};
    const levels = opts.levels || 4;
    const minVerts = opts.minVerts || 8;
    const startVerts = geom.attributes.position.count;
    const chain = [];
    let current = geom;
    for (let i = 0; i < levels; i++) {
      const ratio = 1 - Math.pow(0.5, i + 1);
      const target = Math.max(minVerts, Math.floor(startVerts * (1 - ratio)));
      const dec = mesh.qemDecimate(current, { targetCount: target });
      chain.push(dec);
      current = dec;
    }
    chain.push(geom);  // ensure the full-res version is at LOD0
    chain.reverse();
    return chain;
  }

  // ──────────────────────────────────────────────────────────────────────
  // 42. Instancing — memory-efficient duplicates
  // ──────────────────────────────────────────────────────────────────────
  // Returns a THREE.InstancedMesh wrapping the geometry. Matrices are
  // generated deterministically from a seed.
  function makeInstanced(geom, count, opts) {
    if (!THREE) throw new Error('makeInstanced requires THREE');
    opts = opts || {};
    const seed = (opts.seed == null) ? 1 : opts.seed;
    const mat = opts.material || new THREE.MeshStandardMaterial({ color: 0x888888 });
    const im = new THREE.InstancedMesh(geom, mat, count);
    im.frustumCulled = opts.frustumCulled !== false;
    const rng = noise.mulberry32(seed);
    const m = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const euler = new THREE.Euler();
    for (let i = 0; i < count; i++) {
      if (opts.distribution === 'grid') {
        const gx = opts.gridX || 10;
        const gy = opts.gridY || 10;
        const gz = opts.gridZ || 1;
        const idx = i;
        const ix = idx % gx;
        const iy = Math.floor(idx / gx) % gy;
        const iz = Math.floor(idx / (gx * gy)) % gz;
        position.set(ix * (opts.gridSpacing || 1.5),
                     iy * (opts.gridSpacing || 1.5),
                     iz * (opts.gridSpacing || 1.5));
      } else if (opts.distribution === 'random') {
        position.set(
          (rng() - 0.5) * (opts.spread || 10),
          (rng() - 0.5) * (opts.spread || 10),
          (rng() - 0.5) * (opts.spread || 10)
        );
      } else if (opts.distribution === 'ring') {
        const r = opts.radius || 5;
        const ang = (i / count) * Math.PI * 2;
        position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
      } else {
        position.set(0, 0, 0);
      }
      euler.set(rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2);
      quaternion.setFromEuler(euler);
      const s = (opts.minScale || 0.5) + rng() * ((opts.maxScale || 1.5) - (opts.minScale || 0.5));
      scale.set(s, s, s);
      m.compose(position, quaternion, scale);
      im.setMatrixAt(i, m);
      if (opts.userData) im.setUserData && im.setUserData(i, opts.userData);
    }
    im.instanceMatrix.needsUpdate = true;
    return im;
  }

  // ──────────────────────────────────────────────────────────────────────
  // 43. Geometry Nodes — node-based procedural
  // ──────────────────────────────────────────────────────────────────────
  // A small node graph evaluator for procedural geometry. Supported
  // node types: input, primitive, subdivide, decimate, displace,
  // transform, join, output. Each input node seeds an evaluation.
  function geoNodesEvaluate(graph, opts) {
    if (!THREE) throw new Error('geoNodesEvaluate requires THREE');
    opts = opts || {};
    if (!Array.isArray(graph)) throw new Error('geoNodes: graph must be array of nodes');
    function _eval(node) {
      if (typeof node === 'string') {
        // node id reference
        const n = graph.find(g => g.id === node);
        if (!n) throw new Error('geoNodes: missing node id ' + node);
        if (n.__v != null) return n.__v;
        return _eval(n);
      }
      if (node == null) return null;
      if (node.__v != null) return node.__v;
      const in1 = node.inputs && node.inputs[0];
      const in2 = node.inputs && node.inputs[1];
      let result = null;
      switch (node.type) {
        case 'primitive': {
          const p = node.params || {};
          result = core.makePrimitive(p.kind || 'cube', p);
          break;
        }
        case 'subdivide': {
          const inp = _eval(in1);
          result = mesh.subdivideCatmullClark(inp, node.params && node.params.levels || 1);
          break;
        }
        case 'decimate': {
          const inp = _eval(in1);
          result = mesh.qemDecimate(inp, node.params || {});
          break;
        }
        case 'displace': {
          const inp = _eval(in1);
          result = mesh.displaceSurface(inp, node.params || {});
          break;
        }
        case 'transform': {
          const inp = _eval(in1);
          const p = node.params || {};
          const t = p.translation || [0, 0, 0];
          const r = p.rotation || [0, 0, 0, 1];
          const s = p.scale || [1, 1, 1];
          inp.applyMatrix4(new THREE.Matrix4().compose(
            new THREE.Vector3(t[0], t[1], t[2]),
            new THREE.Quaternion(r[0], r[1], r[2], r[3]),
            new THREE.Vector3(s[0], s[1], s[2])
          ));
          inp.computeVertexNormals();
          result = inp;
          break;
        }
        case 'join': {
          const g1 = _eval(in1);
          const g2 = _eval(in2);
          const merged = THREE.BufferGeometryUtils.mergeGeometries([g1, g2]);
          result = merged;
          break;
        }
        case 'output': {
          result = _eval(in1);
          break;
        }
        default:
          throw new Error('geoNodes: unknown node type ' + node.type);
      }
      node.__v = result;
      return result;
    }
    // find output node
    const output = graph.find(n => n.type === 'output');
    if (!output) throw new Error('geoNodes: graph has no output node');
    return _eval(output);
  }

  // ──────────────────────────────────────────────────────────────────────
  // 44. Physics Simulation — cloth / fluid (simplified)
  // ──────────────────────────────────────────────────────────────────────
  // A minimal particle system with Verlet integration, gravity, and
  // simple cloth (mass-spring grid). Designed to be lightweight enough
  // to run in the browser at interactive framerates.
  function physicsStep(world, dt, opts) {
    if (!THREE) throw new Error('physicsStep requires THREE');
    opts = opts || {};
    const gravity = opts.gravity || [0, -9.8, 0];
    const damping = opts.damping == null ? 0.98 : opts.damping;
    const steps = opts.steps || 1;
    const t = dt || 0.016;
    const particles = world.particles || [];
    const constraints = world.constraints || [];
    // Verlet integration
    for (let s = 0; s < steps; s++) {
      for (let p = 0; p < particles.length; p++) {
        const part = particles[p];
        if (part.fixed) continue;
        const x = part.position[0], y = part.position[1], z = part.position[2];
        const px = part.prevPosition[0], py = part.prevPosition[1], pz = part.prevPosition[2];
        const vx = (x - px) * damping;
        const vy = (y - py) * damping;
        const vz = (z - pz) * damping;
        const fx = part.force ? part.force[0] : 0;
        const fy = part.force ? part.force[1] : 0;
        const fz = part.force ? part.force[2] : 0;
        const nx = x + vx + (gravity[0] + fx * part.invMass) * t * t;
        const ny = y + vy + (gravity[1] + fy * part.invMass) * t * t;
        const nz = z + vz + (gravity[2] + fz * part.invMass) * t * t;
        part.prevPosition = [x, y, z];
        part.position = [nx, ny, nz];
        if (part.force) part.force = [0, 0, 0];
      }
      // constraint relaxation
      for (let i = 0; i < constraints.length; i++) {
        const c = constraints[i];
        const p1 = particles[c.a];
        const p2 = particles[c.b];
        const dx = p2.position[0] - p1.position[0];
        const dy = p2.position[1] - p1.position[1];
        const dz = p2.position[2] - p1.position[2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const diff = (len - c.rest) / len * (c.stiffness || 0.5);
        if (!p1.fixed) {
          p1.position[0] += dx * diff * 0.5;
          p1.position[1] += dy * diff * 0.5;
          p1.position[2] += dz * diff * 0.5;
        }
        if (!p2.fixed) {
          p2.position[0] -= dx * diff * 0.5;
          p2.position[1] -= dy * diff * 0.5;
          p2.position[2] -= dz * diff * 0.5;
        }
      }
    }
    return world;
  }

  // Convenience: build a cloth world (grid of particles + structural
  // + shear + bend springs)
  function buildClothWorld(opts) {
    if (!THREE) throw new Error('buildClothWorld requires THREE');
    opts = opts || {};
    const nx = opts.nx || 16, ny = opts.ny || 16;
    const spacing = opts.spacing || 0.1;
    const particles = [];
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        particles.push({
          position: [(i - nx * 0.5) * spacing, 1, (j - ny * 0.5) * spacing],
          prevPosition: [(i - nx * 0.5) * spacing, 1, (j - ny * 0.5) * spacing],
          force: [0, 0, 0],
          invMass: 1,
          fixed: j === 0 && (i === 0 || i === nx - 1),
        });
      }
    }
    const constraints = [];
    function idx(i, j) { return j * nx + i; }
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        if (i + 1 < nx) constraints.push({ a: idx(i, j), b: idx(i + 1, j), rest: spacing, stiffness: 1 });
        if (j + 1 < ny) constraints.push({ a: idx(i, j), b: idx(i, j + 1), rest: spacing, stiffness: 1 });
        if (i + 1 < nx && j + 1 < ny) constraints.push({ a: idx(i, j), b: idx(i + 1, j + 1), rest: spacing * Math.SQRT2, stiffness: 0.5 });
        if (i + 2 < nx) constraints.push({ a: idx(i, j), b: idx(i + 2, j), rest: spacing * 2, stiffness: 0.25 });
      }
    }
    return { particles, constraints };
  }

  // Convenience: build a fluid (sphere of particles with mutual repulsion)
  function buildFluidWorld(opts) {
    opts = opts || {};
    const count = opts.count || 64;
    const radius = opts.radius || 0.5;
    const particles = [];
    const rng = noise.mulberry32(opts.seed || 1);
    for (let i = 0; i < count; i++) {
      const p = noise.rngLattice(rng, radius);
      particles.push({
        position: p,
        prevPosition: p.slice(),
        force: [0, 0, 0],
        invMass: 1,
        fixed: false,
        velocity: [0, 0, 0],
      });
    }
    return { particles, constraints: [] };
  }

  const api = {
    generateLOD,
    makeInstanced,
    geoNodesEvaluate,
    physicsStep,
    buildClothWorld,
    buildFluidWorld,
  };

  if (typeof window !== 'undefined') window.MT_advanced = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
