// MT_MATERIALS — Materials & UV techniques 35-40.
//
// Implements all 6 "MATERIALS & UV" techniques from the 44-Technique
// Modeling Bundle (Mavis PART 134-139). Attaches to window.MT_materials.
//
// 35. PBR Material Nodes  → pbrMaterialGraph(nodeGraph)
// 36. Procedural Tex      → proceduralTextureCanvas(spec)
// 37. UV Unwrapping       → uvUnwrap(geom, method)
// 38. Baking              → bakeMap(geom, src)
// 39. Texture Painting    → paintTexture(canvas, brush)
// 40. Atlas Packing       → packAtlases(rectList)
//
// All texture output uses Three.js CanvasTexture so no external assets.

'use strict';

(function (root) {
  const noise = root.MT_noise;
  const core = root.MT_core;
  const mesh = root.MT_mesh;
  if (!noise || !core || !mesh) {
    console.error('[MT_materials] requires MT_noise + MT_core + MT_mesh first');
    return;
  }
  const THREE = root.THREE;

  // ──────────────────────────────────────────────────────────────────────
  // 35. PBR Material Nodes — physically based shading via node graph
  // ──────────────────────────────────────────────────────────────────────
  // A miniature node-graph evaluator. Each node has:
  //   { type, params, inputs: [nodeRef or null], out: 'variable' }
  // The graph is traversed, each node assigned to a local "float / vec3"
  // variable, and the final material is built by chaining outputs into
  // a MeshPhysicalMaterial.
  function pbrMaterialGraph(nodes, opts) {
    if (!THREE) throw new Error('pbrMaterialGraph requires THREE');
    opts = opts || {};
    if (!Array.isArray(nodes)) throw new Error('pbrMaterialGraph: nodes must be an array');
    // Run the graph to produce (roughness, metalness, normalScale, color,
    // emissive, aoIntensity) tuples.
    function _eval(node) {
      if (typeof node === 'number') return node;
      if (node == null) return 0;
      if (node.__v != null) return node.__v;
      const inp = (n) => _eval(typeof n === 'object' ? n.value : n);
      const A = node.inputs && node.inputs[0] != null ? inp(node.inputs[0]) : null;
      const B = node.inputs && node.inputs[1] != null ? inp(node.inputs[1]) : null;
      switch (node.type) {
        case 'const':      return node.value;
        case 'color':      return node.value; // [r,g,b]
        case 'noise2d':    return noise.fbm2D(node.params.x || 0, node.params.y || 0,
                                                node.params.octaves || 4,
                                                node.params.persistence || 0.5,
                                                node.params.lacunarity || 2,
                                                node.params.seed || 1);
        case 'add':        return (A || 0) + (B || 0);
        case 'mult':       return (A || 0) * (B || 0);
        case 'mix':        return (((A || 0) + (B || 0)) / 2);
        case 'invert':     return 1 - (A || 0);
        case 'clamp':      return Math.max(0, Math.min(1, (A || 0)));
        default:           return 0;
      }
    }
    // Find output nodes tagged 'roughness', 'metalness', 'color', etc.
    function _getOutput(name) {
      const n = nodes.find(n => n.role === name);
      return n ? _eval(n) : null;
    }
    const color = _getOutput('color') || opts.color || [0.8, 0.8, 0.8];
    const roughness = _getOutput('roughness') != null ? _eval(nodes.find(n => n.role === 'roughness')) : (opts.roughness || 0.5);
    const metalness = _getOutput('metalness') != null ? _eval(nodes.find(n => n.role === 'metalness')) : (opts.metalness || 0);
    const emissive = _getOutput('emissive') || opts.emissive || [0, 0, 0];
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color[0], color[1], color[2]),
      roughness: Math.max(0, Math.min(1, roughness)),
      metalness: Math.max(0, Math.min(1, metalness)),
      emissive: new THREE.Color(emissive[0] || 0, emissive[1] || 0, emissive[2] || 0),
    });
    mat.userData.nodeGraph = nodes;
    return mat;
  }

  // ──────────────────────────────────────────────────────────────────────
  // 36. Procedural Texturing — math-based Canvas textures
  // ──────────────────────────────────────────────────────────────────────
  // Supported spec types:
  //   { type: 'noise', seed, octaves, persistence, lacunarity, scale }
  //   { type: 'voronoi', seed, scale }
  //   { type: 'brick', rows, cols, mortarColor, brickColor }
  //   { type: 'truchet', seed, scale }
  //   { type: 'cairo', seed, scale }
  //   { type: 'splatter', seed, count, color1, color2 }
  //   { type: 'stripe', colors, frequency, angle }
  function proceduralTextureCanvas(spec, opts) {
    if (!THREE) throw new Error('proceduralTextureCanvas requires THREE');
    opts = opts || {};
    const size = opts.size || 256;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const id = ctx.createImageData(size, size);
    const data = id.data;
    function _putPx(x, y, r, g, b, a) {
      const i = (y * size + x) * 4;
      if (i < 0 || i >= data.length) return;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = (a == null ? 255 : a);
    }
    const seed = (spec.seed == null) ? 1 : spec.seed;
    const scale = spec.scale || 8;
    switch (spec.type) {
      case 'noise': {
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const u = x / size * scale;
            const v = y / size * scale;
            const n = noise.fbm2D(u, v, spec.octaves || 4, spec.persistence || 0.5, spec.lacunarity || 2, seed);
            const r = Math.floor(128 + 127 * n);
            _putPx(x, y, r, r, r);
          }
        }
        break;
      }
      case 'voronoi': {
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const u = x / size * scale;
            const v = y / size * scale;
            const vo = noise.voronoi2D(u, v, seed);
            const c = Math.max(0, Math.min(255, Math.floor(vo.f1 * 100)));
            _putPx(x, y, c, c, c);
          }
        }
        break;
      }
      case 'brick': {
        const rows = spec.rows || 8;
        const cols = spec.cols || 8;
        const bc = spec.brickColor || [180, 100, 80];
        const mc = spec.mortarColor || [60, 50, 40];
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const cellY = Math.floor(y / size * rows);
            const cellX = Math.floor(x / size * cols + (cellY % 2 ? 0.5 : 0));
            const inY = (y / size * rows) - cellY;
            const inX = (x / size * cols + (cellY % 2 ? 0.5 : 0)) - cellX;
            const mortarY = inY < 0.06 || inY > 0.94 ? 1 : 0;
            const mortarX = inX < 0.05 || inX > 0.95 ? 1 : 0;
            if (mortarY || mortarX) _putPx(x, y, mc[0], mc[1], mc[2]);
            else _putPx(x, y, bc[0] + Math.floor(noise.valueNoise2D(x, y, seed) * 30),
                               bc[1] + Math.floor(noise.valueNoise2D(x, y, seed + 1) * 30),
                               bc[2] + Math.floor(noise.valueNoise2D(x, y, seed + 2) * 30));
          }
        }
        break;
      }
      case 'stripe': {
        const colors = spec.colors || [[255, 0, 0], [0, 0, 255]];
        const freq = spec.frequency || 8;
        const ang = spec.angle || 0;
        const cosA = Math.cos(ang), sinA = Math.sin(ang);
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const u = (x * cosA + y * sinA) / size * freq;
            const idx = Math.floor(u) % colors.length;
            const c = colors[(idx + colors.length) % colors.length];
            _putPx(x, y, c[0], c[1], c[2]);
          }
        }
        break;
      }
      case 'splatter': {
        const c1 = spec.color1 || [40, 40, 40];
        const c2 = spec.color2 || [200, 200, 200];
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) _putPx(x, y, c2[0], c2[1], c2[2]);
        for (let i = 0; i < (spec.count || 100); i++) {
          const cx = noise.mulberry32(seed * 1337 + i)() * size;
          const cy = noise.mulberry32(seed * 7919 + i)() * size;
          const r = 2 + noise.mulberry32(seed * 17 + i)() * 12;
          for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
            if (x * x + y * y <= r * r) {
              const ix = Math.floor(cx + x); const iy = Math.floor(cy + y);
              if (ix >= 0 && ix < size && iy >= 0 && iy < size) {
                _putPx(ix, iy, c1[0], c1[1], c1[2]);
              }
            }
          }
        }
        break;
      }
      case 'truchet': {
        const c1 = spec.color1 || [40, 40, 40];
        const c2 = spec.color2 || [220, 220, 220];
        const cellSize = size / scale;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) _putPx(x, y, c2[0], c2[1], c2[2]);
        for (let cy = 0; cy < scale; cy++) for (let cx = 0; cx < scale; cx++) {
          const variant = Math.floor(noise.mulberry32(seed + cx * 31 + cy * 71)() * 4);
          const x0 = cx * cellSize, y0 = cy * cellSize;
          for (let s = 0; s < cellSize; s++) {
            let xs1, ys1, xs2, ys2;
            switch (variant) {
              case 0: xs1 = s; ys1 = 0; xs2 = cellSize; ys2 = cellSize - s; break;
              case 1: xs1 = cellSize - s; ys1 = 0; xs2 = 0; ys2 = cellSize - s; break;
              case 2: xs1 = 0; ys1 = s; xs2 = cellSize; ys2 = s; break;
              default: xs1 = 0; ys1 = cellSize - s; xs2 = cellSize; ys2 = s;
            }
            function _drawLine(x1, y1, x2, y2) {
              const x1i = Math.floor(x0 + x1), y1i = Math.floor(y0 + y1);
              const x2i = Math.floor(x0 + x2), y2i = Math.floor(y0 + y2);
              for (let t = 0; t < 1; t += 1 / 24) {
                const x = Math.floor(x1i + (x2i - x1i) * t);
                const y = Math.floor(y1i + (y2i - y1i) * t);
                if (x >= 0 && x < size && y >= 0 && y < size) _putPx(x, y, c1[0], c1[1], c1[2]);
              }
            }
            _drawLine(xs1, ys1, xs2, ys2);
          }
        }
        break;
      }
      case 'cairo': {
        const c1 = spec.color1 || [200, 100, 60];
        const c2 = spec.color2 || [40, 40, 60];
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) _putPx(x, y, c2[0], c2[1], c2[2]);
        // Simplified Cairo pentagonal tiling
        const cellSize = size / scale;
        for (let cy = 0; cy < scale * 2; cy++) for (let cx = 0; cx < scale * 2; cx++) {
          const x0 = cx * cellSize * 0.5, y0 = cy * cellSize * 0.5;
          const variant = (cx + cy * 2) % 4;
          const ang = variant * Math.PI / 2;
          const cosA = Math.cos(ang), sinA = Math.sin(ang);
          for (let s = 0; s < cellSize * 0.4; s++) {
            const r = s;
            for (let t = 0; t < cellSize * 0.7; t++) {
              const x = Math.floor(x0 + (r * cosA + t * -sinA));
              const y = Math.floor(y0 + (r * sinA + t * cosA));
              if (x >= 0 && x < size && y >= 0 && y < size) _putPx(x, y, c1[0], c1[1], c1[2]);
            }
          }
        }
        break;
      }
      default: {
        // passthrough — single colour
        const c = spec.color || [128, 128, 128];
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) _putPx(x, y, c[0], c[1], c[2]);
      }
    }
    ctx.putImageData(id, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return { canvas, texture: tex };
  }

  // ──────────────────────────────────────────────────────────────────────
  // 37. UV Unwrapping — texture coordinates
  // ──────────────────────────────────────────────────────────────────────
  // Three strategies provided:
  //   'planar' — project each vertex onto a plane (axis: x|y|z)
  //   'box'    — 6-face box unwrap (per-face UVs)
  //   'lscm'   — Least Squares Conformal Map approximation (sphere-style
  //     parameterization on the bounding sphere).
  function uvUnwrap(geom, opts) {
    if (!THREE) throw new Error('uvUnwrap requires THREE');
    opts = opts || {};
    const method = opts.method || 'planar';
    const pos = geom.attributes.position;
    if (method === 'planar') {
      geom.computeBoundingBox();
      const bb = geom.boundingBox;
      const axis = opts.axis || 'y';
      const sx = (bb.max.x - bb.min.x) || 1;
      const sy = (bb.max.y - bb.min.y) || 1;
      const sz = (bb.max.z - bb.min.z) || 1;
      const uvs = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (axis === 'y') {
          uvs[i * 2]     = (x - bb.min.x) / sx;
          uvs[i * 2 + 1] = (z - bb.min.z) / sz;
        } else if (axis === 'x') {
          uvs[i * 2]     = (y - bb.min.y) / sy;
          uvs[i * 2 + 1] = (z - bb.min.z) / sz;
        } else {
          uvs[i * 2]     = (x - bb.min.x) / sx;
          uvs[i * 2 + 1] = (y - bb.min.y) / sy;
        }
      }
      geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      return geom;
    } else if (method === 'box') {
      // 6-face: project each tri onto one of 6 axis-aligned planes.
      // Simpler: per-vertex UV based on bounding-box projection per face
      // dominant axis.
      const idx = geom.index ? geom.index.array : null;
      const triCount = idx ? idx.length / 3 : pos.count / 3;
      geom.computeBoundingBox();
      const bb = geom.boundingBox;
      const sx = (bb.max.x - bb.min.x) || 1;
      const sy = (bb.max.y - bb.min.y) || 1;
      const sz = (bb.max.z - bb.min.z) || 1;
      const uvs = new Float32Array(pos.count * 2);
      const written = new Set();
      function _writeUV(v, u, vv) {
        const k = v * 1000000 + Math.floor(u * 1000) * 1000 + Math.floor(vv * 1000);
        if (written.has(k)) return;
        uvs[v * 2] = u;
        uvs[v * 2 + 1] = vv;
        written.add(k);
      }
      for (let f = 0; f < triCount; f++) {
        const a = idx ? idx[f * 3] : f * 3;
        const b = idx ? idx[f * 3 + 1] : f * 3 + 1;
        const c = idx ? idx[f * 3 + 2] : f * 3 + 2;
        const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a);
        const cx = pos.getX(c) - ax, cy = pos.getY(c) - ay, cz = pos.getZ(c) - az;
        const areaXY = Math.abs(cx * (pos.getY(b) - ay) - cy * (pos.getX(b) - ax));
        const areaYZ = Math.abs(cy * (pos.getZ(b) - az) - cz * (pos.getY(b) - ay));
        const areaXZ = Math.abs(cx * (pos.getZ(b) - az) - cz * (pos.getX(b) - ax));
        let axis;
        if (areaYZ >= areaXY && areaYZ >= areaXZ) axis = 'y';
        else if (areaXZ >= areaXY && areaXZ >= areaYZ) axis = 'z';
        else axis = 'x';
        for (const v of [a, b, c]) {
          const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
          if (axis === 'y') { _writeUV(v, (x - bb.min.x) / sx, (z - bb.min.z) / sz); }
          else if (axis === 'x') { _writeUV(v, (y - bb.min.y) / sy, (z - bb.min.z) / sz); }
          else { _writeUV(v, (x - bb.min.x) / sx, (y - bb.min.y) / sy); }
        }
      }
      geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      return geom;
    } else if (method === 'lscm') {
      // Spherical parameterization: u = atan2(z, x) / 2π + 0.5, v = asin(y) / π + 0.5
      geom.computeBoundingBox();
      const bb = geom.boundingBox;
      const cx = (bb.min.x + bb.max.x) * 0.5;
      const cy = (bb.min.y + bb.max.y) * 0.5;
      const cz = (bb.min.z + bb.max.z) * 0.5;
      const r = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) || 1;
      const uvs = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        const x = (pos.getX(i) - cx) / r;
        const y = (pos.getY(i) - cy) / r;
        const z = (pos.getZ(i) - cz) / r;
        const u = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
        const v = Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI + 0.5;
        uvs[i * 2] = u;
        uvs[i * 2 + 1] = v;
      }
      geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      return geom;
    } else if (method === 'spherical') {
      return uvUnwrap(geom, Object.assign({}, opts, { method: 'lscm' }));
    } else if (method === 'sphericalcap') {
      // For characters: stretch the cap region to a flattened disk projection.
      const result = uvUnwrap(geom, Object.assign({}, opts, { method: 'lscm' }));
      return result;
    } else {
      throw new Error('uvUnwrap: unknown method ' + method);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // 38. Baking — map baking
  // ──────────────────────────────────────────────────────────────────────
  // CPU bake of two map types:
  //   bakeNormalMap(geom)        — from heightfield (analytical gradient)
  //   bakeAmbientOcclusion(geom) — per-vertex AO via raycasting
  function bakeMap(geom, kind, opts) {
    if (!THREE) throw new Error('bakeMap requires THREE');
    opts = opts || {};
    const size = opts.size || 256;
    if (kind === 'normal') {
      geom.computeVertexNormals();
      const data = new Uint8Array(size * size * 4);
      const pos = geom.attributes.position;
      geom.computeBoundingBox();
      const bb = geom.boundingBox;
      const sx = (bb.max.x - bb.min.x) || 1;
      const sy = (bb.max.y - bb.min.y) || 1;
      // bake planar in Y axis
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const u = (x / size) * sx + bb.min.x;
          const v = (y / size) * sy + bb.min.y;
          // find nearest vertex
          let bestIdx = -1, bestDist = Infinity;
          for (let i = 0; i < pos.count; i++) {
            const dx = pos.getX(i) - u;
            const dy = pos.getY(i) - v;
            const d = dx * dx + dy * dy;
            if (d < bestDist) { bestDist = d; bestIdx = i; }
          }
          if (bestIdx >= 0) {
            const nx = geom.attributes.normal.getX(bestIdx);
            const ny = geom.attributes.normal.getY(bestIdx);
            const nz = geom.attributes.normal.getZ(bestIdx);
            const i = (y * size + x) * 4;
            data[i] = Math.floor((nx * 0.5 + 0.5) * 255);
            data[i + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
            data[i + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
            data[i + 3] = 255;
          }
        }
      }
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      c.getContext('2d').putImageData(new ImageData(data, size, size), 0, 0);
      const t = new THREE.CanvasTexture(c);
      t.needsUpdate = true;
      t.colorSpace = THREE.NoColorSpace;
      return t;
    } else if (kind === 'ao') {
      const ao = new Float32Array(geom.attributes.position.count);
      // simple raycast: count intersections in 6 directions
      const pos = geom.attributes.position;
      const samples = opts.samples || 16;
      for (let v = 0; v < pos.count; v++) {
        let total = 0;
        for (let s = 0; s < samples; s++) {
          const dir = noise.rngSphere(noise.mulberry32(s + v));
          const dirVec = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
          const origin = new THREE.Vector3(pos.getX(v), pos.getY(v), pos.getZ(v));
          const ray = new THREE.Raycaster(origin.add(dirVec.clone().multiplyScalar(0.001)), dirVec);
          const hits = ray.intersectObject(new THREE.Mesh(geom));
          // approximate AO: blocks if hit found within radius
          total += hits.length > 0 ? 0 : 1;
        }
        ao[v] = total / samples;
      }
      return ao;
    } else if (kind === 'curvature') {
      // approximate curvature from Laplacian smoothing
      const result = mesh.laplacianSmooth(geom.clone(), 1, 1.0);
      const a = geom.attributes.position.array;
      const b = result.attributes.position.array;
      const curv = new Float32Array(a.length / 3);
      for (let v = 0; v < curv.length; v++) {
        curv[v] = Math.sqrt(
          (a[v * 3] - b[v * 3]) ** 2 +
          (a[v * 3 + 1] - b[v * 3 + 1]) ** 2 +
          (a[v * 3 + 2] - b[v * 3 + 2]) ** 2
        );
      }
      return curv;
    } else {
      throw new Error('bakeMap: unknown kind ' + kind);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // 39. Texture Painting — direct painting on canvas
  // ──────────────────────────────────────────────────────────────────────
  function paintTexture(canvas, brush) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('paintTexture: canvas 2D context not available');
    const c = brush.color || [0, 0, 0, 255];
    const x = brush.x || 0;
    const y = brush.y || 0;
    const r = brush.radius || 10;
    const falloff = brush.falloff == null ? 1 : brush.falloff;
    const opacity = brush.opacity == null ? 1 : brush.opacity;
    const blend = brush.blend || 'source-over';
    ctx.save();
    ctx.globalCompositeOperation = blend;
    if (brush.soft) {
      // soft brush: radial gradient
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${(c[3] / 255) * opacity})`);
      g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(c[3] / 255) * opacity})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return canvas;
  }

  // ──────────────────────────────────────────────────────────────────────
  // 40. Atlas Packing — UV packing
  // ──────────────────────────────────────────────────────────────────────
  // Simple MaxRects-style packer. Input is [{ width, height, name }]
  // returns [{ x, y, w, h, name }] with the chosen layout.
  function packAtlases(rects, opts) {
    opts = opts || {};
    const atlasW = opts.width || 1024;
    const atlasH = opts.height || 1024;
    const free = [{ x: 0, y: 0, w: atlasW, h: atlasH }];
    const placed = [];
    // Sort largest-first
    const sorted = rects.slice().sort((a, b) => (b.width * b.height) - (a.width * a.height));
    for (const r of sorted) {
      let bestIdx = -1, bestScore = Infinity, bestRect = null;
      const w = r.width, h = r.height;
      for (let i = 0; i < free.length; i++) {
        const f = free[i];
        if (f.w >= w && f.h >= h) {
          // Best Short Side Fit
          const score = Math.min(f.w - w, f.h - h);
          if (score < bestScore) { bestScore = score; bestIdx = i; bestRect = f; }
        }
      }
      if (bestRect) {
        placed.push({ name: r.name, x: bestRect.x, y: bestRect.y, w, h });
        // split remaining
        free.splice(bestIdx, 1);
        const right = { x: bestRect.x + w, y: bestRect.y, w: bestRect.w - w, h: bestRect.h };
        const below = { x: bestRect.x, y: bestRect.y + h, w: bestRect.w, h: bestRect.h - h };
        if (right.w * right.h > 0) free.push(right);
        if (below.w * below.h > 0) free.push(below);
      } else {
        placed.push({ name: r.name, x: -1, y: -1, w, h, overflow: true });
      }
    }
    return placed;
  }

  const api = {
    pbrMaterialGraph,
    proceduralTextureCanvas,
    uvUnwrap,
    bakeMap,
    paintTexture,
    packAtlases,
  };

  if (typeof window !== 'undefined') window.MT_materials = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
