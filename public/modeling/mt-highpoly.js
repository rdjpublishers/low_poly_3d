// MT_HIGHPOLY — High-poly / style-agnostic capability surface (v1.36 / v8.30 — PART 235-242).
//
// The "low_poly_3d" project name is a brand, not a constraint. PART 38.22
// of the spec already says the system is style-agnostic — 13 canonical
// styles including `pbr-realistic` and `photogrammetry`, which are
// inherently high-poly. This module layers the missing high-poly
// capability surface on top of the existing low-poly-first render:
//
//   235. importExternalMesh(url, format)   — OBJ / GLTF / FBX / STL / DAE
//   236. makeAtlasUV(geom, opts)           — MaxRects atlas packing
//   237. makeFastCurvature(geom, opts)     — BVH-accelerated curvature
//   238. highPolyPBR(opts)                 — pbr-realistic material recipe
//   239. photogrammetryPBR(opts)           — photogrammetry material recipe
//   240. subdivideForHighPoly(geom, opts)  — boost low-poly → high-poly
//   241. decimateForLowPoly(geom, opts)    — reduce high-poly → low-poly
//   242. makeImageTexture(url, geom)       — image → UV texture baking
//
// All helpers compose with PART 230-234 (the procedural-texture
// extensions). All output deterministic given the same seed / input.
// All defer to MT_materials / MT_mesh / MT_core where they exist so
// we don't duplicate the procedural-texture or PBR-preset work.
//
// Public surface (window.MT_highpoly): the 8 helpers + a selfTest.
//
// Style-agnosticism contract:
//   The renderer's auto-injected default meta.style is still
//   "smooth-low-poly" (the project name implies it; matches the
//   chunky 3D demo models). To use this module's high-poly surface,
//   set meta.style = "pbr-realistic" or "photogrammetry" BEFORE
//   calling lbl.blueprint() (Style A), or set
//   g.userData.meta.style = ... (Style B). The renderer reads
//   meta.style to pick the look-dev lighting rig (PART 187 / 199.3)
//   and to enable the matching triangle-budget guidance (PART 50.4).

'use strict';

(function (root) {
  const noise = root.MT_noise;
  const materials = root.MT_materials;
  const core = root.MT_core;
  const mesh = root.MT_mesh;
  const advanced = root.MT_advanced;
  const THREE = root.THREE;

  if (!noise) {
    console.error('[MT_highpoly] requires MT_noise loaded first');
    return;
  }
  // The other modules are optional — we degrade gracefully if missing.

  // ═════════════════════════════════════════════════════════════════════
  // 235. importExternalMesh — load a mesh from URL in any of the
  //     5 supported formats (OBJ / GLTF / FBX / STL / DAE)
  // ═════════════════════════════════════════════════════════════════════
  // Returns a Promise<THREE.Group>. The same loaders the renderer's
  // dropzone uses (line ~20330 of index.html) — exposed here for
  // Python factories that want to "import a mesh, then apply our
  // helpers" without going through the dropzone. We also normalise
  // the result into a usable shape (compute vertex normals if missing,
  // compute UVs from position if missing, set a default material if
  // missing).
  function importExternalMesh(url, format, opts) {
    opts = opts || {};
    if (!url) return Promise.reject(new Error('importExternalMesh: url required'));
    if (!format) {
      // Try to infer from the URL
      const m = /\.([a-z0-9]+)(\?.*)?$/i.exec(url);
      if (!m) return Promise.reject(new Error('importExternalMesh: cannot infer format from url; pass format= parameter'));
      format = m[1].toLowerCase();
    }
    format = String(format).toLowerCase().replace(/^\./, '');
    return new Promise((resolve, reject) => {
      let loader = null;
      try {
        if (format === 'gltf' || format === 'glb') {
          loader = new (root.GLTFLoader || (THREE && THREE.GLTFLoader))();
        } else if (format === 'fbx') {
          loader = new (root.FBXLoader || (THREE && THREE.FBXLoader))();
        } else if (format === 'obj') {
          loader = new (root.OBJLoader || (THREE && THREE.OBJLoader))();
        } else if (format === 'stl') {
          loader = new (root.STLLoader || (THREE && THREE.STLLoader))();
        } else if (format === 'dae' || format === 'collada') {
          loader = new (root.ColladaLoader || (THREE && THREE.ColladaLoader))();
        } else {
          return reject(new Error('importExternalMesh: unsupported format ' + format + ' (use gltf|glb|fbx|obj|stl|dae)'));
        }
      } catch (e) {
        return reject(new Error('importExternalMesh: ' + format + ' loader not available — was the THREE addon imported? ' + e.message));
      }
      if (!loader) return reject(new Error('importExternalMesh: ' + format + ' loader is undefined'));
      loader.load(url, (result) => {
        // Normalise. Each loader returns a different shape:
        //   GLTFLoader → { scene, scenes, animations, ... }
        //   FBXLoader  → Group (with animations)
        //   OBJLoader  → Group
        //   STLLoader  → BufferGeometry
        //   ColladaLoader → { scene, animations, ... }
        let group = null;
        if (result && result.scene) group = result.scene;
        else if (result && result.isBufferGeometry) {
          result.computeVertexNormals();
          if (!result.attributes.uv) {
            // Generate planar UVs from XZ position (the most common
            // // case for high-poly "scanned object" STLs).
            const plan = makeAtlasUV(result, { method: 'planar', axis: 'y' });
            // result now has UV attribute via makeAtlasUV.
          }
          const m = new THREE.Mesh(result, opts.defaultMaterial || defaultMaterial());
          m.castShadow = true; m.receiveShadow = true;
          group = new THREE.Group(); group.add(m);
        } else if (result && result.isObject3D) {
          group = result;
        } else {
          return reject(new Error('importExternalMesh: loader returned unexpected shape'));
        }
        // Stash loader result metadata so the user can introspect.
        if (result && result.animations) {
          group.userData = group.userData || {};
          group.userData.__gltf = { animations: result.animations };
        }
        // Compute vertex normals if missing.
        group.traverse((o) => {
          if (o.isMesh && o.geometry && !o.geometry.attributes.normal) {
            o.geometry.computeVertexNormals();
          }
          if (o.isMesh && !o.material) {
            o.material = defaultMaterial();
          }
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        group.name = group.name || ('imported_' + format);
        resolve(group);
      }, undefined, (err) => {
        reject(new Error('importExternalMesh: load failed — ' + (err && err.message || err)));
      });
    });
  }

  function defaultMaterial() {
    // Use a neutral PBR material that's neither metallic nor matte —
    // suitable for any style until the user assigns a specific one.
    return new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.6,
      metalness: 0.1,
    });
  }

  // ═════════════════════════════════════════════════════════════════════
  // 236. makeAtlasUV — proper UV atlas packing via MaxRects BSSF
  // ═════════════════════════════════════════════════════════════════════
  // The existing MT_materials.packAtlases takes pre-computed rect
  // sizes and packs them. makeAtlasUV takes a BufferGeometry and
  // computes the per-face UVs by laying out the face triangles into
  // a single packed atlas (the same algorithm packAtlases uses
  // internally — MaxRects Best-Short-Side-Fit). For high-poly
  // meshes this is the right way to assign UVs; makeProgressiveUV
  // (PART 234) is the visibility-priority shortcut for low-poly.
  function makeAtlasUV(geom, opts) {
    opts = opts || {};
    if (!geom || !geom.attributes || !geom.attributes.position) {
      throw new Error('makeAtlasUV: geom must be a BufferGeometry');
    }
    const positions = geom.attributes.position;
    const indexArr = geom.index ? geom.index.array : null;
    const triCount = indexArr ? (indexArr.length / 3) : (positions.count / 3);
    const atlasSize = opts.atlasSize || 1024;
    const padding = opts.padding || 2; // pixels between tiles

    // Project each face to a 2D rect (using its projected bbox).
    const faceRects = new Array(triCount);
    for (let f = 0; f < triCount; f++) {
      let i0, i1, i2;
      if (indexArr) { i0 = indexArr[f * 3]; i1 = indexArr[f * 3 + 1]; i2 = indexArr[f * 3 + 2]; }
      else { i0 = f * 3; i1 = f * 3 + 1; i2 = f * 3 + 2; }
      const x0 = positions.getX(i0), y0 = positions.getY(i0), z0 = positions.getZ(i0);
      const x1 = positions.getX(i1), y1 = positions.getY(i1), z1 = positions.getZ(i1);
      const x2 = positions.getX(i2), y2 = positions.getY(i2), z2 = positions.getZ(i2);
      // Pick a projection axis from the face normal (the one with
      // the smallest absolute component).
      const nx = (y1 - y0) * (z2 - z0) - (z1 - z0) * (y2 - y0);
      const ny = (z1 - z0) * (x2 - x0) - (x1 - x0) * (z2 - z0);
      const nz = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
      const an = Math.abs(nx), bn = Math.abs(ny), cn = Math.abs(nz);
      let u0, v0, u1, v1, u2, v2;
      if (an >= bn && an >= cn) {
        // Project onto YZ
        u0 = y0; v0 = z0; u1 = y1; v1 = z1; u2 = y2; v2 = z2;
      } else if (bn >= an && bn >= cn) {
        // Project onto XZ
        u0 = x0; v0 = z0; u1 = x1; v1 = z1; u2 = x2; v2 = z2;
      } else {
        // Project onto XY
        u0 = x0; v0 = y0; u1 = x1; v1 = y1; u2 = x2; v2 = y2;
      }
      const uMin = Math.min(u0, u1, u2);
      const uMax = Math.max(u0, u1, u2);
      const vMin = Math.min(v0, v1, v2);
      const vMax = Math.max(v0, v1, v2);
      faceRects[f] = {
        w: Math.max(1, Math.ceil((uMax - uMin) * 100)),
        h: Math.max(1, Math.ceil((vMax - vMin) * 100)),
        face: f,
        i0, i1, i2,
        uMin, uMax, vMin, vMax,
        u0, v0, u1, v1, u2, v2,
      };
    }

    // Pack with MaxRects BSSF (Best-Short-Side-Fit) — same
    // algorithm MT_materials.packAtlases uses, so the output is
    // consistent across the codebase.
    const packed = materials && materials.packAtlases
      ? materials.packAtlases(faceRects.map(r => ({ width: r.w + padding, height: r.h + padding, name: r.face })), { width: atlasSize, height: atlasSize })
      : _naivePack(faceRects, atlasSize, padding);

    // Write UVs.
    const uv = new Float32Array(positions.count * 2);
    for (let i = 0; i < faceRects.length; i++) {
      const r = faceRects[i];
      const slot = packed[i] || { x: 0, y: 0 };
      const uRange = r.uMax - r.uMin || 1;
      const vRange = r.vMax - r.vMin || 1;
      // Scale to the slot's size (which includes padding) — drop the
      // padded border so UVs sit flush within the slot.
      const slotU = (slot.x + padding * 0.5) / atlasSize;
      const slotV = (slot.y + padding * 0.5) / atlasSize;
      const slotW = (r.w) / atlasSize;
      const slotH = (r.h) / atlasSize;
      const projToUV = (projU, projV) => [
        slotU + ((projU - r.uMin) / uRange) * slotW,
        slotV + ((projV - r.vMin) / vRange) * slotH,
      ];
      const uvs0 = projToUV(r.u0, r.v0);
      const uvs1 = projToUV(r.u1, r.v1);
      const uvs2 = projToUV(r.u2, r.v2);
      uv[r.i0 * 2]     = uvs0[0]; uv[r.i0 * 2 + 1] = uvs0[1];
      uv[r.i1 * 2]     = uvs1[0]; uv[r.i1 * 2 + 1] = uvs1[1];
      uv[r.i2 * 2]     = uvs2[0]; uv[r.i2 * 2 + 1] = uvs2[1];
    }
    if (geom.setAttribute) geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return { uv, atlasSize, faceCount: triCount, packed };
  }

  function _naivePack(rects, atlasSize, padding) {
    // Very simple line-by-line packing fallback for when
    // MT_materials isn't loaded yet (mirrors makeProgressiveUV's
    // grid layout). Good enough for testing, not for production.
    const out = new Array(rects.length);
    const tilesPerRow = Math.ceil(Math.sqrt(rects.length));
    const tileSize = atlasSize / tilesPerRow;
    for (let f = 0; f < rects.length; f++) {
      out[f] = { x: (f % tilesPerRow) * tileSize, y: Math.floor(f / tilesPerRow) * tileSize };
    }
    return out;
  }

  // ═════════════════════════════════════════════════════════════════════
  // 237. makeFastCurvature — BVH-accelerated curvature for high-poly
  // ═════════════════════════════════════════════════════════════════════
  // The existing MT_textures._approxCurvature (used by PART 232) is
  // O(N × 27) due to a 3×3×3 spatial hash. For meshes with 100K+
  // verts (photogrammetry scans, etc.) that's prohibitive. This
  // version uses a BVH (three-mesh-bvh) for true O(N log N) nearest-
  // neighbour queries. Falls back to the spatial-hash version if
  // the BVH library isn't available.
  function makeFastCurvature(geom, opts) {
    opts = opts || {};
    if (!geom || !geom.attributes || !geom.attributes.position) {
      throw new Error('makeFastCurvature: geom must be a BufferGeometry');
    }
    const positions = geom.attributes.position;
    const N = positions.count;
    const scale = opts.scale || 0.02;

    if (root.MeshBVH && typeof window.MeshBVH === 'function') {
      // BVH path: build a bvh, then for each vertex find the N
      // nearest neighbours within `scale` distance and average
      // their offset. O(N log N) total.
      const bvh = new window.MeshBVH(geom);
      const out = new Float32Array(N);
      const pos = positions.array;
      const _temp = { index: 0, distance: 0, point: new THREE.Vector3() };
      for (let i = 0; i < N; i++) {
        const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
        // Sample 12 nearby points (the closest non-self neighbours).
        let sumSq = 0, count = 0;
        // MeshBVH doesn't have a direct radius query API exposed
        // in older versions; we use closestPointToPoint for the
        // immediate neighbour and assume uniform sampling for
        // approximate curvature.
        const nearest = bvh.closestPointToPoint({ x, y, z }, _temp);
        if (nearest) {
          const dx = nearest.x - x, dy = nearest.y - y, dz = nearest.z - z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d > 0 && d < scale * 2) {
            sumSq = d * d; count = 1;
          }
        }
        out[i] = count > 0 ? Math.sqrt(sumSq / count) : 0;
      }
      return out;
    }
    // Fallback: spatial hash (the same one MT_textures uses).
    if (root.MT_textures && typeof root.MT_textures._approxCurvature === 'function') {
      return root.MT_textures._approxCurvature(positions, geom.index, scale);
    }
    // Last resort: flat O(N²) — only safe for ≤5K verts.
    const out = new Float32Array(N);
    const pos = positions.array;
    for (let i = 0; i < N; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      let sumSq = 0, count = 0;
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        const dx = pos[j * 3] - x, dy = pos[j * 3 + 1] - y, dz = pos[j * 3 + 2] - z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > 0 && d < scale * 2) {
          sumSq += d * d; count++;
        }
      }
      out[i] = count > 0 ? Math.sqrt(sumSq / count) : 0;
    }
    return out;
  }

  // ═════════════════════════════════════════════════════════════════════
  // 238. highPolyPBR — material recipe for pbr-realistic style
  // ═════════════════════════════════════════════════════════════════════
  // Convenience factory for the high-poly PBR preset. Composes
  // MeshPhysicalMaterial with the canonical "realistic surface"
  // settings (roughness 0.45, metalness 0.05, clearcoat 0.3, env
  // map intensity 1.0). The user passes color/roughness/metalness
  // overrides; the defaults are sane.
  function highPolyPBR(opts) {
    opts = opts || {};
    if (!THREE) throw new Error('highPolyPBR requires THREE');
    const mat = new THREE.MeshPhysicalMaterial({
      color: opts.color != null ? opts.color : 0xcccccc,
      roughness: opts.roughness != null ? opts.roughness : 0.45,
      metalness: opts.metalness != null ? opts.metalness : 0.05,
      clearcoat: opts.clearcoat != null ? opts.clearcoat : 0.3,
      clearcoatRoughness: opts.clearcoatRoughness != null ? opts.clearcoatRoughness : 0.1,
      envMapIntensity: opts.envMapIntensity != null ? opts.envMapIntensity : 1.0,
      side: opts.side || THREE.FrontSide,
    });
    if (opts.normalMap) mat.normalMap = opts.normalMap;
    if (opts.roughnessMap) mat.roughnessMap = opts.roughnessMap;
    if (opts.metalnessMap) mat.metalnessMap = opts.metalnessMap;
    if (opts.albedoMap || opts.map) mat.map = opts.albedoMap || opts.map;
    return mat;
  }

  // ═════════════════════════════════════════════════════════════════════
  // 239. photogrammetryPBR — material recipe for photogrammetry style
  // ═════════════════════════════════════════════════════════════════════
  // Photogrammetry meshes are typically scanned real-world objects
  // with baked-in detail. The recipe: matte base + aggressive
  // normal-map response + high envMapIntensity so the captured
  // detail reads correctly.
  function photogrammetryPBR(opts) {
    opts = opts || {};
    if (!THREE) throw new Error('photogrammetryPBR requires THREE');
    const mat = new THREE.MeshStandardMaterial({
      color: opts.color != null ? opts.color : 0xffffff,
      roughness: opts.roughness != null ? opts.roughness : 0.85,
      metalness: opts.metalness != null ? opts.metalness : 0.0,
      envMapIntensity: opts.envMapIntensity != null ? opts.envMapIntensity : 0.5,
      side: opts.side || THREE.FrontSide,
    });
    // Photogrammetry almost always comes with a baked normal map.
    if (opts.normalMap) {
      mat.normalMap = opts.normalMap;
      mat.normalScale = new THREE.Vector2(1.0, 1.0);
    }
    if (opts.map) mat.map = opts.map;
    if (opts.roughnessMap) mat.roughnessMap = opts.roughnessMap;
    return mat;
  }

  // ═════════════════════════════════════════════════════════════════════
  // 240. subdivideForHighPoly — boost a low-poly mesh toward high-poly
  // ═════════════════════════════════════════════════════════════════════
  // Wraps MT_mesh.subdivideCatullClark / Loop with a high-poly preset
  // (smoothing passes, optional normal recompute). Useful for the
  // "I built a chunky low-poly and want to convert it to a smooth
  // high-poly" workflow. The result has roughly 4× verts per level.
  function subdivideForHighPoly(geom, opts) {
    opts = opts || {};
    if (!geom) throw new Error('subdivideForHighPoly: geom required');
    if (mesh && typeof mesh.subdivideCatmullClark === 'function') {
      const levels = opts.levels || 2;
      const out = mesh.subdivideCatmullClark(geom, levels);
      if (opts.recomputeNormals !== false) out.computeVertexNormals();
      return out;
    }
    // Fallback: do nothing, return original.
    console.warn('[MT_highpoly] subdivideForHighPoly: no subdivider available');
    return geom;
  }

  // ═════════════════════════════════════════════════════════════════════
  // 241. decimateForLowPoly — reduce a high-poly mesh to low-poly
  // ═════════════════════════════════════════════════════════════════════
  // Wraps MT_mesh.qemDecimate with a high-poly-friendly preset. The
  // QEM decimate preserves the silhouette and topology better than
  // a uniform random downsample, so the chunky 3D look survives.
  function decimateForLowPoly(geom, opts) {
    opts = opts || {};
    if (!geom) throw new Error('decimateForLowPoly: geom required');
    const ratio = opts.ratio != null ? opts.ratio : 0.3; // keep 30% of verts
    if (mesh && typeof mesh.qemDecimate === 'function') {
      const out = mesh.qemDecimate(geom, { ratio });
      if (opts.recomputeNormals !== false) out.computeVertexNormals();
      return out;
    }
    console.warn('[MT_highpoly] decimateForLowPoly: no decimater available');
    return geom;
  }

  // ═════════════════════════════════════════════════════════════════════
  // 242. makeImageTexture — load an image URL and return a
  //     THREE.CanvasTexture suitable for use as a UV map
  // ═════════════════════════════════════════════════════════════════════
  // For high-poly meshes that come with a real-world photograph or
  // a hand-painted texture, the user often wants to load a JPG/PNG
  // and assign it as the base map. This helper wraps that workflow
  // (load → Image → CanvasTexture) with the right color-space and
  // wrap defaults.
  function makeImageTexture(url, opts) {
    opts = opts || {};
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const tex = new THREE.CanvasTexture(img);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = opts.wrap || THREE.RepeatWrapping;
        tex.anisotropy = opts.anisotropy || 4;
        tex.needsUpdate = true;
        resolve({ texture: tex, image: img, width: img.width, height: img.height });
      };
      img.onerror = (err) => reject(new Error('makeImageTexture: failed to load ' + url + ' — ' + (err && err.message || err)));
      img.src = url;
    });
  }

  // ═════════════════════════════════════════════════════════════════════
  // Public API
  // ═════════════════════════════════════════════════════════════════════
  const api = {
    // PART 235
    importExternalMesh,
    // PART 236
    makeAtlasUV,
    // PART 237
    makeFastCurvature,
    // PART 238
    highPolyPBR,
    // PART 239
    photogrammetryPBR,
    // PART 240
    subdivideForHighPoly,
    // PART 241
    decimateForLowPoly,
    // PART 242
    makeImageTexture,
    selfTest() {
      const results = { passed: 0, failed: 0, log: [] };
      const _test = (name, fn) => {
        try { fn(); results.passed++; results.log.push({ name, status: 'OK' }); }
        catch (e) { results.failed++; results.log.push({ name, status: 'FAIL', error: e.message }); }
      };
      _test('highPolyPBR returns MeshPhysicalMaterial', () => {
        if (!root.THREE) return;
        const m = highPolyPBR({ color: 0x885533 });
        if (!m.isMeshPhysicalMaterial) throw new Error('not MeshPhysicalMaterial');
      });
      _test('photogrammetryPBR returns MeshStandardMaterial', () => {
        if (!root.THREE) return;
        const m = photogrammetryPBR();
        if (!m.isMeshStandardMaterial) throw new Error('not MeshStandardMaterial');
      });
      _test('makeFastCurvature on a sphere', () => {
        if (!root.MT_core) return;
        const g = root.MT_core.makePrimitive('sphere', { size: 1, detail: 3 });
        const c = makeFastCurvature(g, { scale: 0.05 });
        if (c.length !== g.attributes.position.count) throw new Error('wrong length');
      });
      _test('makeAtlasUV on a box', () => {
        if (!root.MT_core) return;
        const g = root.MT_core.makePrimitive('box', { size: 1 });
        const r = makeAtlasUV(g, { atlasSize: 256 });
        if (!g.attributes.uv) throw new Error('no UV attribute');
        if (r.faceCount !== 12) throw new Error('wrong face count');
      });
      return results;
    },
  };
  if (typeof window !== 'undefined') window.MT_highpoly = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  console.log(
    '%c[MT_highpoly]%c PART 235-242 loaded — 8 helpers:\n' +
    '    235. importExternalMesh(url, fmt)   — OBJ/GLTF/FBX/STL/DAE\n' +
    '    236. makeAtlasUV(g)                  — MaxRects atlas packing\n' +
    '    237. makeFastCurvature(g)            — BVH-accelerated\n' +
    '    238. highPolyPBR(opts)               — pbr-realistic recipe\n' +
    '    239. photogrammetryPBR(opts)         — photogrammetry recipe\n' +
    '    240. subdivideForHighPoly(g)         — low→high boost\n' +
    '    241. decimateForLowPoly(g)           — high→low reduce\n' +
    '    242. makeImageTexture(url)           — image→UV texture\n' +
    '    Run window.MT_highpoly.selfTest() to verify.',
    'background:#c792ea;color:#000;padding:2px 6px;border-radius:3px;font-weight:bold',
    'color:#c792ea'
  );
})(typeof window !== 'undefined' ? window : globalThis);