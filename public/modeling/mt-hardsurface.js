// MT_HARDSURFACE — Hard-surface / vehicle modeling techniques.
//
// Implements PART 167-179 of the LBL v1.33 / v8.24 spec:
//
//   PART 169 — 4 procedural primitive helpers
//     169.1  createFilletedBoxGeometry(w, h, d, r, smooth)
//     169.2  createTaperedTube(points, startR, endR, segments)
//     169.3  createRimStarPattern(numSpokes, innerR, outerR, thickness)
//     169.4  createBeveledWasher(innerR, outerR, thickness, bevel)
//
//   PART 171 — seeded micro-roughness procedural texture (already in
//   PART 74 via MT_materials.microRoughnessMap; the formula is
//   re-exposed here as MT_hardsurface.createMicroRoughnessMap for
//   clarity and as a single import surface).
//
//   PART 174 — 4 self-verification runtime hooks
//     174.1  validateTriangleBudget(root, { budget })
//     174.2  validateDrawCallCount(root, { budget })
//     174.3  validateBoundingBox(root, { minY, maxAbsCoord })
//     174.4  validateGroundClearance(root)
//
//   PART 173 — 3-point studio lighting rig (createHardSurfaceLookDevLights)
//
//   PART 175 — 8-section code architecture helper
//     createHardSurfaceFactoryShell({ meta, builders, materials, palette })
//
//   PART 179 — v1.33 / v8.24 artist-first geometry flow &
//   form-preservation patch — 3 new procedural helpers:
//     179.2  createLathedTireGeometry(outerR, width, crown, taper,
//                                       bead, segments)
//     179.4  createSweptTube(waypoints, radius, segments,
//                              radialSegments, type)
//     179.4  createExhaustCanister({ inletR, bodyR, bodyLength,
//                                     nozzleR, tipBevel, segments })
//
// All helpers are MIT-licensed and safe to inline into any TS / JS
// factory without bringing in an extra dependency.
//
// Author: Mavis / RDJ Publishers low_poly_3d renderer surface.
// Part of: PART 167-179 Hard-Surface / Vehicle Modeling Pipeline
// (LBL v1.33 / v8.24 — v1.32 / v8.23 baseline + PART 179
// artist-first geometry flow patch).

'use strict';

(function (root) {
  const noise = root.MT_noise;
  const core = root.MT_core;
  const mesh = root.MT_mesh;
  const organic = root.MT_organic;
  const materials = root.MT_materials;
  const advanced = root.MT_advanced;
  if (!noise || !core || !mesh || !organic || !materials || !advanced) {
    console.error('[MT_hardsurface] requires MT_noise + MT_core + MT_mesh + MT_organic + MT_materials + MT_advanced');
    return;
  }
  const THREE = root.THREE;

  // ──────────────────────────────────────────────────────────────────────
  // PART 171 — seeded mulberry32 PRNG (re-exposed for clarity)
  // ──────────────────────────────────────────────────────────────────────
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 171 — createMicroRoughnessMap(size, seed, base, jitter)
  // ──────────────────────────────────────────────────────────────────────
  // A CanvasTexture of value-noise sampled as roughness modulation.
  // Apply to EVERY material as `roughnessMap` to break up uniform
  // specular reflections without external image assets.
  function createMicroRoughnessMap(size, seed, base, jitter) {
    if (typeof document === 'undefined') {
      console.warn('[MT_hardsurface] createMicroRoughnessMap requires a browser environment (CanvasTexture).');
      return null;
    }
    size = size || 256;
    seed = seed == null ? 1 : seed;
    base = base == null ? 0.85 : base;
    jitter = jitter == null ? 0.15 : jitter;
    const rand = mulberry32(seed);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size * 4; i += 4) {
      const val = Math.floor((base + rand() * jitter) * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = val;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    tex.userData = { part171: 'createMicroRoughnessMap', seed, size, base, jitter };
    return tex;
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 169.1 — createFilletedBoxGeometry(w, h, d, radius, smoothness)
  // ──────────────────────────────────────────────────────────────────────
  // A box with rounded edges (fillet) on every corner. Replaces hand-
  // built RoundedBoxGeometry + manual scale. Uses a vertex-displacement
  // approach on a BoxGeometry for full control over the corner radius.
  function createFilletedBoxGeometry(width, height, depth, radius, smoothness) {
    if (!THREE) throw new Error('createFilletedBoxGeometry requires THREE');
    width = width || 1;
    height = height || 1;
    depth = depth || 1;
    radius = radius == null ? 0.02 : radius;
    smoothness = smoothness == null ? 4 : smoothness;
    // Clamp radius to half the smallest dimension
    const minDim = Math.min(width, height, depth) / 2;
    radius = Math.min(radius, minDim * 0.999);
    if (radius <= 0) return new THREE.BoxGeometry(width, height, depth);

    // Build a filleted box by extruding a rounded rectangle.
    const w = width / 2, h = height / 2, d = depth / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-w + radius, -h);
    shape.lineTo(w - radius, -h);
    shape.absarc(w - radius, -h + radius, radius, -Math.PI / 2, 0, false);
    shape.lineTo(w, h - radius);
    shape.absarc(w - radius, h - radius, radius, 0, Math.PI / 2, false);
    shape.lineTo(-w + radius, h);
    shape.absarc(-w + radius, h - radius, radius, Math.PI / 2, Math.PI, false);
    shape.lineTo(-w, -h + radius);
    shape.absarc(-w + radius, -h + radius, radius, Math.PI, Math.PI * 1.5, false);
    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: depth - radius * 2,
      bevelEnabled: true,
      bevelSegments: smoothness,
      bevelSize: radius,
      bevelThickness: radius,
      steps: 1,
      curveSegments: smoothness * 2,
    });
    geom.translate(0, 0, -(depth / 2 - radius));
    geom.computeVertexNormals();
    geom.userData = { part169: 'createFilletedBoxGeometry', w: width, h: height, d: depth, r: radius, smooth: smoothness };
    return geom;
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 169.2 — createTaperedTube(points, startR, endR, segments)
  // ──────────────────────────────────────────────────────────────────────
  // A tube along a 3D path (array of THREE.Vector3) with linearly
  // interpolated radius from startRadius to endRadius. Replaces uniform
  // CylinderGeometry for forks, exhaust pipes, shock absorbers, etc.
  function createTaperedTube(points, startRadius, endRadius, segments) {
    if (!THREE) throw new Error('createTaperedTube requires THREE');
    if (!points || points.length < 2) {
      throw new Error('createTaperedTube: needs at least 2 points');
    }
    startRadius = startRadius == null ? 0.02 : startRadius;
    endRadius = endRadius == null ? startRadius : endRadius;
    segments = segments == null ? 8 : segments;
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    const geom = new THREE.TubeGeometry(curve, segments * points.length, startRadius, segments, false);
    // Apply linear radius taper by scaling vertices radially
    const pos = geom.attributes.position;
    const tmpVec = new THREE.Vector3();
    const frenet = curve.computeFrenetFrames(segments * points.length, false);
    for (let i = 0; i < pos.count; i++) {
      tmpVec.fromBufferAttribute(pos, i);
      const t = i / (pos.count - 1);
      const r = startRadius + (endRadius - startRadius) * t;
      // Project onto the tube center line and recompute radial offset
      const center = curve.getPointAt(t);
      const radial = tmpVec.clone().sub(center);
      // Approximate radial scaling: stretch by ratio r/startRadius
      const scale = r / startRadius;
      const newPos = center.clone().add(radial.multiplyScalar(scale));
      pos.setXYZ(i, newPos.x, newPos.y, newPos.z);
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
    geom.userData = { part169: 'createTaperedTube', points: points.length, startR: startRadius, endR: endRadius, segments };
    return geom;
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 169.3 — createRimStarPattern(numSpokes, innerR, outerR, thickness)
  // ──────────────────────────────────────────────────────────────────────
  // A spoked wheel rim (ring + N spokes + central hub) merged into a
  // single BufferGeometry. Replaces N hand-built spoke BoxGeometries.
  function createRimStarPattern(numSpokes, innerRadius, outerRadius, thickness) {
    if (!THREE) throw new Error('createRimStarPattern requires THREE');
    numSpokes = numSpokes == null ? 5 : numSpokes;
    innerRadius = innerRadius == null ? 0.12 : innerRadius;
    outerRadius = outerRadius == null ? 0.20 : outerRadius;
    thickness = thickness == null ? 0.04 : thickness;
    const geometries = [];

    // 1) Outer ring (torus section as a thin cylinder)
    const ringGeom = new THREE.CylinderGeometry(outerRadius, outerRadius, thickness, 32, 1, true);
    ringGeom.rotateX(Math.PI / 2);
    geometries.push(ringGeom);

    // 2) N spokes
    const spokeWidth = (outerRadius - innerRadius) * 0.7;
    const spokeLength = outerRadius - innerRadius;
    for (let i = 0; i < numSpokes; i++) {
      const angle = (i / numSpokes) * Math.PI * 2;
      const spokeGeom = new THREE.BoxGeometry(spokeWidth, spokeLength, thickness * 0.9);
      spokeGeom.translate(0, spokeLength / 2 + innerRadius, 0);
      spokeGeom.rotateZ(angle);
      geometries.push(spokeGeom);
    }

    // 3) Central hub
    const hubGeom = new THREE.CylinderGeometry(innerRadius * 0.85, innerRadius * 0.85, thickness * 1.1, 16);
    hubGeom.rotateX(Math.PI / 2);
    geometries.push(hubGeom);

    // 4) Central cap
    const capGeom = new THREE.CylinderGeometry(innerRadius * 0.5, innerRadius * 0.5, thickness * 1.3, 16);
    capGeom.rotateX(Math.PI / 2);
    geometries.push(capGeom);

    // Merge into single BufferGeometry using BufferGeometryUtils if available
    let merged;
    if (root.THREE && root.THREE.BufferGeometryUtils) {
      merged = root.THREE.BufferGeometryUtils.mergeGeometries(geometries, false);
    } else {
      // Fallback: keep as a Group; consumer can decide
      merged = new THREE.BufferGeometry();
      console.warn('[MT_hardsurface] BufferGeometryUtils not found; rim star returned as Group.');
    }
    if (merged) {
      merged.computeVertexNormals();
      merged.userData = { part169: 'createRimStarPattern', numSpokes, innerR: innerRadius, outerR: outerRadius, thickness };
    }
    return merged;
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 169.4 — createBeveledWasher(innerR, outerR, thickness, bevel)
  // ──────────────────────────────────────────────────────────────────────
  // A flat washer (annulus) with beveled inner + outer edges.
  function createBeveledWasher(innerRadius, outerRadius, thickness, bevel) {
    if (!THREE) throw new Error('createBeveledWasher requires THREE');
    innerRadius = innerRadius == null ? 0.06 : innerRadius;
    outerRadius = outerRadius == null ? 0.12 : outerRadius;
    thickness = thickness == null ? 0.008 : thickness;
    bevel = bevel == null ? 0.002 : bevel;
    // Lathe a 2D profile that traces the cross-section of a beveled washer
    const pts = [];
    pts.push(new THREE.Vector2(innerRadius + bevel, -thickness / 2));
    pts.push(new THREE.Vector2(outerRadius - bevel, -thickness / 2));
    pts.push(new THREE.Vector2(outerRadius, -thickness / 2 + bevel));
    pts.push(new THREE.Vector2(outerRadius, thickness / 2 - bevel));
    pts.push(new THREE.Vector2(outerRadius - bevel, thickness / 2));
    pts.push(new THREE.Vector2(innerRadius + bevel, thickness / 2));
    pts.push(new THREE.Vector2(innerRadius, thickness / 2 - bevel));
    pts.push(new THREE.Vector2(innerRadius, -thickness / 2 + bevel));
    pts.push(new THREE.Vector2(innerRadius + bevel, -thickness / 2));
    const geom = new THREE.LatheGeometry(pts, 24);
    geom.computeVertexNormals();
    geom.userData = { part169: 'createBeveledWasher', innerR: innerRadius, outerR: outerRadius, thickness, bevel };
    return geom;
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 179.2 — createLathedTireGeometry(outerR, width, crown,
  //                                     taper, bead, segments)
  // ──────────────────────────────────────────────────────────────────────
  // Implements PART 179.2 — Lathed Tire Profile. A tire is NEVER a plain
  // CylinderGeometry (RULE 169.3.2). This helper builds the tire around
  // a Vector2(r, z) HALF-profile rotated around the wheel Z axis with
  // THREE.LatheGeometry. The profile is constructed with:
  //   1. Toroidal Crown — a parabolic curve across the tread width.
  //   2. Inward Tapered Sidewalls — sidewalls pinch inward toward the rim.
  //   3. Stepped Bead — a defined inner lip where the tire meets the
  //      wheel rim.
  //
  // Signature:
  //   createLathedTireGeometry(
  //     outerR=0.22,           // tire outer radius (m)
  //     width=0.12,            // tire axial width (m)
  //     crown=0.018,           // tread crown height above the outer
  //                              equator (m) — parabolic lift
  //     taper=0.012,           // how much each sidewall pinches inward
  //                              from outerR toward the rim shoulder (m)
  //     bead=0.006,            // height of the bead step above the
  //                              inner rim shoulder (m)
  //     segments=24,           // LatheGeometry radial segments
  //     crownSamples=10        // samples across the tread crown curve
  //   ) → BufferGeometry
  function createLathedTireGeometry(
    outerR, width, crown, taper, bead, segments, crownSamples
  ) {
    if (!THREE) throw new Error('createLathedTireGeometry requires THREE');
    outerR       = outerR       == null ? 0.22  : outerR;
    width        = width        == null ? 0.12  : width;
    crown        = crown        == null ? 0.018 : crown;
    taper        = taper        == null ? 0.012 : taper;
    bead         = bead         == null ? 0.006 : bead;
    segments     = segments     == null ? 24    : segments;
    crownSamples = crownSamples == null ? 10    : crownSamples;
    // Inner shoulder radius (where the bead sits, where the rim
    // begins). Pulled inward by `taper` from outerR so the sidewalls
    // are concave (inward-tapered) rather than parallel.
    const shoulderR = Math.max(0.04, outerR - taper);
    const beadR     = Math.max(0.03, shoulderR - bead);
    // The HALF-profile is sampled in (r, z) space where r is the
    // radial distance from the wheel axis and z is the axial
    // position across the tire width. We sample one side (z >= 0) and
    // mirror to z <= 0 to get the full profile.
    const profile = [];
    // 1) Inner bead inner corner (the inside edge of the bead where
    //    it touches the rim).
    profile.push(new THREE.Vector2(beadR - bead * 0.5, 0));
    // 2) Up over the bead shoulder to the sidewall start.
    profile.push(new THREE.Vector2(beadR, 0));
    profile.push(new THREE.Vector2(shoulderR, 0));
    // 3) Outward and upward along the sidewall to the tread crown.
    const sidewallSamples = 6;
    for (let i = 1; i <= sidewallSamples; i++) {
      const t = i / sidewallSamples;
      const r = shoulderR + (outerR - shoulderR) * t;
      const z = width * 0.5 * t;
      profile.push(new THREE.Vector2(r, z));
    }
    // 4) Across the crown (top of the tire) using a parabolic arch
    //    so the crown is rounded, not flat.
    for (let i = 1; i <= crownSamples; i++) {
      const t = i / crownSamples;          // 0 → 1 across the crown
      const angle = Math.PI * (0.5 + t);   // π/2 → 3π/2 across the top
      const r = outerR + crown * Math.sin(angle);
      // The crown peak is at the axial center (z = width/2).
      const z = width * 0.5;
      profile.push(new THREE.Vector2(r, z));
    }
    // 5) Mirror back down the other side.
    for (let i = sidewallSamples; i >= 1; i--) {
      const t = i / sidewallSamples;
      const r = shoulderR + (outerR - shoulderR) * t;
      const z = width * 0.5 * t;
      profile.push(new THREE.Vector2(r, z));
    }
    profile.push(new THREE.Vector2(shoulderR, 0));
    profile.push(new THREE.Vector2(beadR, 0));
    profile.push(new THREE.Vector2(beadR - bead * 0.5, 0));
    const geom = new THREE.LatheGeometry(profile, segments);
    geom.computeVertexNormals();
    geom.userData = {
      part179: 'createLathedTireGeometry',
      outerR, width, crown, taper, bead, segments, crownSamples,
    };
    return geom;
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 179.4 — createSweptTube(waypoints, radius, segments,
  //                              radialSegments, type)
  // ──────────────────────────────────────────────────────────────────────
  // Implements PART 179.4 — Catmull-Rom Spline Sweeps for exhausts,
  // tubes, and forks. Sample N 3D waypoints, pass them through a
  // CatmullRomCurve3, and generate continuous geometry with
  // TubeGeometry. This replaces disjointed CylinderGeometry
  // assemblies for any tube that bends through 3+ waypoints.
  //
  // Signature:
  //   createSweptTube(
  //     waypoints,                  // Array<{x, y, z}> or Vector3[]
  //     radius=0.025,               // tube radius (m)
  //     segments=24,                // path subdivisions
  //     radialSegments=12,          // tube radial subdivisions
  //     type='centripetal'          // 'centripetal' | 'chordal' |
  //                                   'catmullrom'
  //   ) → BufferGeometry
  function createSweptTube(
    waypoints, radius, segments, radialSegments, type
  ) {
    if (!THREE) throw new Error('createSweptTube requires THREE');
    if (!waypoints || waypoints.length < 2) {
      throw new Error('createSweptTube needs at least 2 waypoints');
    }
    radius         = radius         == null ? 0.025 : radius;
    segments       = segments       == null ? 24    : segments;
    radialSegments = radialSegments == null ? 12    : radialSegments;
    type           = type           == null ? 'centripetal' : type;
    const v3 = waypoints.map((w) => (
      w && w.isVector3
        ? w
        : new THREE.Vector3(w.x, w.y, w.z)
    ));
    const curve = new THREE.CatmullRomCurve3(v3, false, type);
    const geom = new THREE.TubeGeometry(
      curve, segments, radius, radialSegments, false
    );
    geom.computeVertexNormals();
    geom.userData = {
      part179: 'createSweptTube',
      radius, segments, radialSegments, type,
      waypointCount: v3.length,
    };
    return geom;
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 179.4 — createExhaustCanister(opts)
  // ──────────────────────────────────────────────────────────────────────
  // Implements PART 179.4 — the muffler canister itself (the swept
  // CatmullRom tube is for the header). Builds the conical inlet
  // taper + cylindrical body + beveled twin-nozzle exhaust end-cap
  // using a LatheGeometry profile.
  //
  // Signature:
  //   createExhaustCanister({
  //     inletR=0.045,            // inlet radius (m)
  //     bodyR=0.075,             // body radius (m)
  //     bodyLength=0.32,         // axial length of the body (m)
  //     nozzleR=0.038,           // exit nozzle radius (m)
  //     tipBevel=0.012,          // exit tip bevel size (m)
  //     segments=32,             // LatheGeometry radial segments
  //     inletTaperLength=0.06,   // axial length of the inlet cone (m)
  //     nozzleLength=0.045       // axial length of the exit nozzle (m)
  //   }) → BufferGeometry
  function createExhaustCanister(opts) {
    if (!THREE) throw new Error('createExhaustCanister requires THREE');
    const o = opts || {};
    const inletR          = o.inletR          == null ? 0.045 : o.inletR;
    const bodyR           = o.bodyR           == null ? 0.075 : o.bodyR;
    const bodyLength      = o.bodyLength      == null ? 0.32  : o.bodyLength;
    const nozzleR         = o.nozzleR         == null ? 0.038 : o.nozzleR;
    const tipBevel        = o.tipBevel        == null ? 0.012 : o.tipBevel;
    const segments        = o.segments        == null ? 32    : o.segments;
    const inletTaperLen   = o.inletTaperLength == null ? 0.06  : o.inletTaperLength;
    const nozzleLen       = o.nozzleLength    == null ? 0.045 : o.nozzleLength;
    // The profile is built left-to-right along the canister axis:
    //   z=0          → inlet face center
    //   z=inletTap   → inlet cone meets body
    //   z=inTap+body → body meets exit cone
    //   z=...+noz    → exit nozzle start
    //   z=...+noz+tipBevel → exit tip (outermost point)
    const profile = [];
    let z = 0;
    // Inlet face inner edge (closed end of the canister at the inlet).
    profile.push(new THREE.Vector2(0.001, z));
    z += inletTaperLen * 0.15;
    profile.push(new THREE.Vector2(inletR * 0.5, z));
    z += inletTaperLen * 0.85;
    profile.push(new THREE.Vector2(inletR, z));
    // Inlet → body smooth transition (small fillet).
    profile.push(new THREE.Vector2(bodyR * 0.95, z + 0.005));
    z += 0.005;
    profile.push(new THREE.Vector2(bodyR, z));
    z += bodyLength;
    // Body → exit cone transition (small fillet).
    profile.push(new THREE.Vector2(bodyR, z));
    profile.push(new THREE.Vector2(nozzleR + tipBevel, z + nozzleLen * 0.5));
    profile.push(new THREE.Vector2(nozzleR, z + nozzleLen));
    // Beveled exit tip.
    z += nozzleLen;
    profile.push(new THREE.Vector2(nozzleR, z));
    profile.push(new THREE.Vector2(nozzleR - tipBevel, z + tipBevel));
    profile.push(new THREE.Vector2(0.001, z + tipBevel));
    const geom = new THREE.LatheGeometry(profile, segments);
    geom.computeVertexNormals();
    geom.userData = {
      part179: 'createExhaustCanister',
      inletR, bodyR, bodyLength, nozzleR, tipBevel, segments,
      inletTaperLength: inletTaperLen, nozzleLength: nozzleLen,
    };
    return geom;
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 174 — SELF-VERIFICATION RUNTIME HOOKS
  // ──────────────────────────────────────────────────────────────────────
  // These NEVER throw — they log to console and return a result object.

  function _walkMeshes(root) {
    const out = [];
    root.traverse((o) => {
      if (o.isMesh) out.push(o);
    });
    return out;
  }

  function validateTriangleBudget(root, opts) {
    opts = opts || {};
    const budget = opts.budget || 45000;
    const meshes = _walkMeshes(root);
    let total = 0;
    let worst = null;
    let worstCount = 0;
    for (const m of meshes) {
      const g = m.geometry;
      if (!g) continue;
      const idx = g.index;
      const tris = idx ? idx.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
      total += tris;
      if (tris > worstCount) { worst = m.name || m.uuid; worstCount = tris; }
    }
    const result = { total, budget, ok: total <= budget, worst, worstCount, meshCount: meshes.length };
    if (!result.ok) {
      console.warn(`[MT_hardsurface][PART 174.1] Triangle budget exceeded: ${total.toFixed(0)} / ${budget} (worst mesh: ${worst} = ${worstCount.toFixed(0)} tris).`);
    } else if (opts.logPass) {
      console.log(`[MT_hardsurface][PART 174.1] Triangle budget OK: ${total.toFixed(0)} / ${budget}`);
    }
    return result;
  }

  function validateDrawCallCount(root, opts) {
    opts = opts || {};
    const budget = opts.budget || 30;
    const meshes = _walkMeshes(root);
    const result = { count: meshes.length, budget, ok: meshes.length <= budget };
    if (!result.ok) {
      console.warn(`[MT_hardsurface][PART 174.2] Draw-call count exceeded: ${meshes.length} / ${budget}. Use BufferGeometryUtils.mergeGeometries or InstancedMesh to reduce.`);
    } else if (opts.logPass) {
      console.log(`[MT_hardsurface][PART 174.2] Draw-call count OK: ${meshes.length} / ${budget}`);
    }
    return result;
  }

  function validateBoundingBox(root, opts) {
    opts = opts || {};
    const minY = opts.minY == null ? 0.0 : opts.minY;
    const maxAbsCoord = opts.maxAbsCoord == null ? 10.0 : opts.maxAbsCoord;
    const meshes = _walkMeshes(root);
    let globalMinY = Infinity;
    let globalMaxAbs = 0;
    const offenders = [];
    for (const m of meshes) {
      m.geometry.computeBoundingBox?.();
      const box = m.geometry.boundingBox;
      if (!box) continue;
      // Transform box by mesh world matrix
      const m4 = new THREE.Matrix4();
      m.updateWorldMatrix(true, false);
      m4.copy(m.matrixWorld);
      const corners = [
        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
        new THREE.Vector3(box.max.x, box.max.y, box.max.z),
      ].map((v) => v.applyMatrix4(m4));
      for (const c of corners) {
        if (c.y < globalMinY) globalMinY = c.y;
        const abs = Math.max(Math.abs(c.x), Math.abs(c.y), Math.abs(c.z));
        if (abs > globalMaxAbs) globalMaxAbs = abs;
      }
      // Check this mesh's local bbox against minY
      if (box.min.y + m.position.y < minY) {
        offenders.push({ name: m.name || m.uuid, worldMinY: box.min.y + m.position.y });
      }
    }
    const result = {
      globalMinY,
      globalMaxAbsCoord: globalMaxAbs,
      minY,
      maxAbsCoord,
      offenders,
      ok: globalMinY >= minY && globalMaxAbs <= maxAbsCoord && offenders.length === 0,
    };
    if (!result.ok) {
      if (globalMinY < minY) console.warn(`[MT_hardsurface][PART 174.3] Bounding box violation: globalMinY=${globalMinY.toFixed(3)} < minY=${minY} (model clips ground)`);
      if (globalMaxAbs > maxAbsCoord) console.warn(`[MT_hardsurface][PART 174.3] Bounding box violation: maxAbsCoord=${globalMaxAbs.toFixed(3)} > ${maxAbsCoord} (part flying off)`);
      if (offenders.length) console.warn(`[MT_hardsurface][PART 174.3] ${offenders.length} mesh(es) below minY`, offenders);
    } else if (opts.logPass) {
      console.log(`[MT_hardsurface][PART 174.3] Bounding box OK: minY=${globalMinY.toFixed(3)}, maxAbs=${globalMaxAbs.toFixed(3)}`);
    }
    return result;
  }

  function validateGroundClearance(root) {
    const result = validateBoundingBox(root, { minY: 0.0 });
    return {
      minY: result.globalMinY,
      ok: result.ok,
      offendingMesh: result.offenders[0] ? result.offenders[0].name : null,
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 173 — 3-POINT STUDIO LIGHTING RIG (hard-surface default)
  // ──────────────────────────────────────────────────────────────────────
  function createHardSurfaceLookDevLights(mode) {
    if (!THREE) throw new Error('createHardSurfaceLookDevLights requires THREE');
    mode = mode || 'studio';
    const group = new THREE.Group();
    group.name = 'hardSurfaceLookDevLights_' + mode;

    if (mode === 'studio') {
      const key = new THREE.DirectionalLight(0xfff3e0, 1.4);
      key.position.set(5, 6, 4);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -2.5;
      key.shadow.camera.right = 2.5;
      key.shadow.camera.top = 1.5;
      key.shadow.camera.bottom = -1.5;
      key.shadow.camera.near = 0.5;
      key.shadow.camera.far = 12;
      key.name = 'keyLight';
      group.add(key);

      const fill = new THREE.DirectionalLight(0xc7d8ff, 0.45);
      fill.position.set(-4, 3, 2);
      fill.castShadow = false;
      fill.name = 'fillLight';
      group.add(fill);

      const rim = new THREE.DirectionalLight(0xffffff, 1.8);
      rim.position.set(-3, 4, -6);
      rim.castShadow = false;
      rim.name = 'rimLight';
      group.add(rim);

      const hemi = new THREE.HemisphereLight(0xb1c5ff, 0x4a3a2a, 0.35);
      hemi.name = 'hemisphereLight';
      group.add(hemi);

      // Contact shadow plane (radial gradient using canvas)
      const shadowCanvas = document.createElement('canvas');
      shadowCanvas.width = shadowCanvas.height = 256;
      const ctx = shadowCanvas.getContext('2d');
      const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(0,0,0,0.55)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0.18)');
      grad.addColorStop(1, 'rgba(0,0,0,0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      const shadowTex = new THREE.CanvasTexture(shadowCanvas);
      const contactShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(3, 3),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
      );
      contactShadow.rotation.x = -Math.PI / 2;
      contactShadow.position.y = 0.001;
      contactShadow.name = 'contactShadow';
      group.add(contactShadow);
    } else if (mode === 'outdoor') {
      const sun = new THREE.DirectionalLight(0xfff0d0, 1.6);
      sun.position.set(8, 12, 5);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -5;
      sun.shadow.camera.right = 5;
      sun.shadow.camera.top = 5;
      sun.shadow.camera.bottom = -5;
      sun.shadow.camera.near = 0.5;
      sun.shadow.camera.far = 30;
      sun.name = 'sunLight';
      group.add(sun);

      const sky = new THREE.HemisphereLight(0x9fc4ff, 0xc7a06e, 0.5);
      sky.name = 'skyLight';
      group.add(sky);
    }

    group.userData = { part173: 'createHardSurfaceLookDevLights', mode };
    return group;
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 175 — 8-SECTION CODE ARCHITECTURE HELPER
  // ──────────────────────────────────────────────────────────────────────
  // A factory shell that helps authors wire the canonical 8-section
  // code architecture (PART 175) consistently.
  function createHardSurfaceFactoryShell(spec) {
    spec = spec || {};
    const meta = spec.meta || {};
    const palette = spec.palette || {};
    const builders = spec.builders || [];
    const materialsSpec = spec.materials || [];
    const sharedRoughMap = spec.sharedRoughMap || createMicroRoughnessMap(256, meta.proceduralSeed || 1);

    // Section 5 — Centralized material registry
    const MATERIALS = {};
    for (const m of materialsSpec) {
      const mat = new THREE.MeshStandardMaterial({
        color: m.color != null ? m.color : 0xcccccc,
        roughness: m.roughness != null ? m.roughness : 0.5,
        metalness: m.metalness != null ? m.metalness : 0.0,
        roughnessMap: m.useRoughMap !== false ? sharedRoughMap : null,
        flatShading: m.flatShading === true,
      });
      mat.name = m.name || 'material';
      MATERIALS[m.name || 'default'] = mat;
    }

    // Section 7 — Primary factory function
    const factory = spec.factory || function (opts) {
      const root = new THREE.Group();
      root.name = meta.name || 'hardSurfaceModel';
      const meshMap = {};
      for (const b of builders) {
        try {
          b(MATERIALS, meshMap, opts || {});
        } catch (err) {
          console.error('[MT_hardsurface] builder', b.name, 'threw:', err);
        }
      }
      // Attach meshes into the pivot tree if the builder returned a tree
      if (meshMap.root) {
        for (const child of meshMap.root.children) {
          root.add(child);
        }
      }
      root.userData = {
        meta,
        palette,
        materials: MATERIALS,
        meshes: meshMap,
        tick: spec.tick || (() => {}),
        sculptRuntime: spec.sculptRuntime || null,
      };
      // PART 174 self-verification audits
      if (meta.validateOnBuild !== false) {
        validateTriangleBudget(root, { budget: meta.triangleBudget || 45000 });
        validateDrawCallCount(root, { budget: meta.drawCallBudget || 30 });
        validateBoundingBox(root, { minY: 0.0, maxAbsCoord: meta.maxAbsCoord || 10.0 });
      }
      return root;
    };

    return {
      meta,
      palette,
      MATERIALS,
      sharedRoughMap,
      factory,
      lookDevLights: spec.lookDevLights || function () {
        return createHardSurfaceLookDevLights(meta.lightingMode || 'studio');
      },
      audits: {
        validateTriangleBudget,
        validateDrawCallCount,
        validateBoundingBox,
        validateGroundClearance,
      },
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────
  const api = {
    // PART 169
    createFilletedBoxGeometry,
    createTaperedTube,
    createRimStarPattern,
    createBeveledWasher,
    // PART 171
    mulberry32,
    createMicroRoughnessMap,
    // PART 173
    createHardSurfaceLookDevLights,
    // PART 174
    validateTriangleBudget,
    validateDrawCallCount,
    validateBoundingBox,
    validateGroundClearance,
    // PART 175
    createHardSurfaceFactoryShell,
    // PART 179 (v1.33 / v8.24 artist-first geometry flow patch)
    createLathedTireGeometry,
    createSweptTube,
    createExhaustCanister,
  };

  if (typeof window !== 'undefined') window.MT_hardsurface = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  console.log(
    '%c[MT_hardsurface]%c PART 167-179 Hard-Surface / Vehicle Modeling Pipeline loaded — 4 primitive helpers (PART 169) + microRoughness (PART 171) + 3-point rig (PART 173) + 4 audits (PART 174) + factory shell (PART 175) + 3 PART 179 helpers (createLathedTireGeometry / createSweptTube / createExhaustCanister — v1.33 / v8.24 artist-first geometry flow patch).',
    'background:#ff9966;color:#000;padding:2px 6px;border-radius:3px;font-weight:bold',
    'color:#ff9966'
  );
})(typeof window !== 'undefined' ? window : globalThis);
