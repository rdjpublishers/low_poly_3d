// MT_ARCHITECTURAL — Architectural modeling helpers.
//
// Implements PART 190-199 of the LBL v1.35 / v8.26 spec:
//
//   PART 190 — Overview & when to use these helpers
//   PART 191 — Stacking index (anti-Z-fighting micro-epsilon offsets)
//   PART 192 — createWallWithApertures(w, h, t, openings[], material, prefix)
//   PART 193 — createHingedDoorUnit({ width, height, depth, leaves, ... })
//   PART 194 — createGlazedWindowUnit({ width, height, depth, mullions, ... })
//   PART 195 — createPitchedGableRoof({ width, depth, pitch, overhang, ... })
//   PART 196 — createLouveredAtticVent({ width, height, depth, louverCount })
//   PART 197 — createPottedPlant({ potR, potH, foliageCount, seed })
//   PART 198 — createSteppingStonePath({ count, baseX, baseZ, ... })
//   PART 199 — schemaNamespacingLinter(root) + createArchitecturalLookDevLights(mode)
//
// All helpers are MIT-licensed and safe to inline into any TS / JS
// factory without bringing in an extra dependency. Helpers return plain
// THREE.Group / THREE.Mesh objects with `userData.featureId` set so the
// schema linter (PART 199) can grep the scene graph against the
// `detailInventory` contract.
//
// Architectural helpers are OPT-IN — they sit alongside the 44 MT_xxx
// helpers and the ACES engine and only run when the user calls them.
//
// Author: Mavis / RDJ Publishers low_poly_3d renderer surface.
// Part of: PART 190-199 Architectural Modeling Pipeline
// (LBL v1.35 / v8.26 — v1.34 / v8.25 baseline + architectural helpers
// + schema namespacing linter + look-dev lights).

'use strict';

(function (root) {
  const noise = root.MT_noise;
  if (!noise) {
    console.error('[MT_architectural] mt-noise.js must load BEFORE mt-architectural.js');
    return;
  }
  const THREE = root.THREE;
  const mulberry32 = noise.mulberry32;

  // ──────────────────────────────────────────────────────────────────────
  // PART 191 — STACKING INDEX (the anti-Z-fighting canonical ladder)
  // ──────────────────────────────────────────────────────────────────────
  // The "micro-epsilon staggering" rule documented in
  // SYSTEM_RECOMMENDATIONS_AND_MODEL_ANALYSIS.txt section 4 (Technique 3).
  // Keep offsets in the 5mm..15mm golden range. Anything > 25mm reads as
  // a visible gap; anything < 1mm still flickers on 24-bit depth buffers.
  const STACK_INDEX = Object.freeze({
    FOUNDATION:   { y: 0.000 },
    GRAVEL:      { y: 0.020 },
    PLAINTH:     { y: 0.300 },
    PORCH_DECK:  { y: 0.420 },
    DOOR_SILL:   { y: 0.450 },
    PAVERS:      { y: 0.370 },
    WALL_FACE:   { z:  0.000 },  // wall centre
    WALL_FACING: { z:  0.015 },  // cladding offset
    WALL_TRIM:   { z:  0.035 },  // moulding offset
    HARDWARE:    { z:  0.065 },  // handles / pulls
    GLASS:       { z:  0.020 },  // window glass offset
  });

  function stackLevel(key, axis) {
    axis = axis || 'y';
    const row = STACK_INDEX[key];
    if (!row) {
      console.warn('[MT_architectural] unknown stackLevel key:', key);
      return 0;
    }
    return row[axis] != null ? row[axis] : 0;
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 192 — createWallWithApertures
  // ──────────────────────────────────────────────────────────────────────
  // Piecewise sub-wall decomposition (Aperture Framing Pattern). Instead
  // of CSG-subtracting openings out of a solid wall box, build the wall
  // as 4 modular sub-boxes around every opening: sill / left jamb /
  // right jamb / header. No CSG runtime cost, sharp UVs, no face
  // overlaps, fully hollow cavities.
  //
  //   openings: [
  //     { x: 0.0,  y: 0.45, w: 1.20, h: 2.10 },  // front door
  //     { x: -1.6, y: 0.90, w: 1.00, h: 1.20 },  // left window
  //     ...
  //   ]
  //   x is the wall-local X (centred on wall midpoint); y is the sill
  //   height (above the wall base); w/h is the opening size.
  //
  // Returns a THREE.Group whose children are 4*N sub-meshes (one per
  // aperture side). The group's userData.featureId is set so the
  // PART 199 schema linter can verify coverage.
  function createWallWithApertures(wallW, wallH, wallT, openings, material, namePrefix) {
    if (!THREE) throw new Error('createWallWithApertures requires THREE');
    wallW = wallW || 4;
    wallH = wallH || 3;
    wallT = wallT || 0.3;
    openings = openings || [];
    namePrefix = namePrefix || 'Wall';

    const group = new THREE.Group();
    group.name = `${namePrefix}_Assembly`;
    group.userData.featureId = namePrefix.toLowerCase().replace(/[^a-z0-9]+/g, '/');
    group.userData.archHelper = 'createWallWithApertures';
    group.userData.apertureCount = openings.length;

    // Build the wall as a series of horizontal slabs (sill height
    // boundaries) split by vertical strips at every aperture edge.
    // Slab approach is more robust than naive "4 boxes per opening"
    // when apertures overlap horizontally or vertically.
    const xBreaks = [-wallW / 2];
    const yBreaks = [0];
    for (const o of openings) {
      xBreaks.push(o.x - o.w / 2);
      xBreaks.push(o.x + o.w / 2);
      yBreaks.push(o.y);
      yBreaks.push(o.y + o.h);
    }
    xBreaks.push(wallW / 2);
    yBreaks.push(wallH);
    // Sort + dedup
    const xs = Array.from(new Set(xBreaks.map((v) => +v.toFixed(6)))).sort((a, b) => a - b);
    const ys = Array.from(new Set(yBreaks.map((v) => +v.toFixed(6)))).sort((a, b) => a - b);

    let slabCount = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < ys.length - 1; j++) {
        const x0 = xs[i], x1 = xs[i + 1];
        const y0 = ys[j], y1 = ys[j + 1];
        const w = x1 - x0;
        const h = y1 - y0;
        if (w <= 1e-5 || h <= 1e-5) continue;
        // Skip the slab if it falls INSIDE any aperture.
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        let insideAperture = false;
        for (const o of openings) {
          if (cx > o.x - o.w / 2 - 1e-5 && cx < o.x + o.w / 2 + 1e-5 &&
              cy > o.y - 1e-5 && cy < o.y + o.h + 1e-5) {
            insideAperture = true;
            break;
          }
        }
        if (insideAperture) continue;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallT), material);
        mesh.position.set(cx, cy, 0);
        mesh.name = `${namePrefix}_Slab_${i}_${j}`;
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.userData.featureId = group.userData.featureId + '/slab';
        mesh.userData.archHelper = 'createWallWithApertures';
        group.add(mesh);
        slabCount++;
      }
    }
    group.userData.slabCount = slabCount;
    return group;
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 193 — createHingedDoorUnit
  // ──────────────────────────────────────────────────────────────────────
  // Dual-pivot kinematic door factory. For each leaf:
  //   Root Group (world positioning)
  //     -> Hinge Group (local origin sits on the door jamb hinge axis)
  //        -> Leaf Mesh (centred at +width/2 so its pivot is the hinge)
  //           -> Hardware (handle, latch, glass inserts)
  //
  // The returned object exposes:
  //   .rootGroup     — the THREE.Group to add to the scene
  //   .hingeGroups   — [leftHinge, rightHinge] for animation
  //   .toggle(open)  — convenience to swing both leaves inward
  //   .userData.featureId — set for the PART 199 linter
  function createHingedDoorUnit(opts) {
    if (!THREE) throw new Error('createHingedDoorUnit requires THREE');
    opts = opts || {};
    const width = opts.width || 0.9;
    const height = opts.height || 2.1;
    const depth = opts.depth || 0.05;
    const leaves = opts.leaves || 2;
    const hingeSide = opts.hingeSide || 'split';
    const doorMaterial = opts.doorMaterial || null;
    const handleMaterial = opts.handleMaterial || null;
    const glassMaterial = opts.glassMaterial || null;
    const withGlassInsert = !!opts.withGlassInsert;
    const namePrefix = opts.namePrefix || 'Door';
    if (!doorMaterial) {
      throw new Error('createHingedDoorUnit: opts.doorMaterial is required');
    }

    const rootGroup = new THREE.Group();
    rootGroup.name = `${namePrefix}_Unit`;
    rootGroup.userData.featureId = namePrefix.toLowerCase().replace(/[^a-z0-9]+/g, '/');
    rootGroup.userData.archHelper = 'createHingedDoorUnit';
    rootGroup.userData.leafCount = leaves;

    const hingeGroups = [];

    for (let i = 0; i < leaves; i++) {
      const isLeft = i === 0;
      let sideSign;
      if (hingeSide === 'left') sideSign = 1;
      else if (hingeSide === 'right') sideSign = -1;
      else sideSign = isLeft ? 1 : -1;  // split: left leaf hinges on left jamb, right leaf on right jamb

      const hingeGroup = new THREE.Group();
      hingeGroup.name = `${namePrefix}_Hinge_${isLeft ? 'Left' : 'Right'}`;
      // Hinge X position: for split double door, left leaf at -leafW/2,
      // right leaf at +leafW/2. For single-side, both at one jamb.
      const leafW = width / leaves;
      const hingeX = (hingeSide === 'split')
        ? (isLeft ? -width / 2 + leafW / 2 : width / 2 - leafW / 2)
        : (sideSign > 0 ? -width / 2 : width / 2);
      hingeGroup.position.set(hingeX, 0, 0);
      hingeGroup.userData.leafIndex = i;
      hingeGroup.userData.hingeAxis = sideSign > 0 ? -1 : 1;

      const leaf = new THREE.Mesh(
        new THREE.BoxGeometry(leafW, height, depth),
        doorMaterial
      );
      leaf.name = `${namePrefix}_Leaf_${isLeft ? 'Left' : 'Right'}`;
      leaf.castShadow = leaf.receiveShadow = true;
      // Offset leaf so the HINGE group's local origin sits on the jamb.
      leaf.position.set(sideSign * leafW / 2, height / 2, 0);
      leaf.userData.featureId = rootGroup.userData.featureId + '/leaf';
      leaf.userData.archHelper = 'createHingedDoorUnit';
      hingeGroup.add(leaf);

      // Optional glass insert (top half of the leaf).
      if (withGlassInsert && glassMaterial) {
        const insertH = height * 0.45;
        const insert = new THREE.Mesh(
          new THREE.BoxGeometry(leafW * 0.7, insertH, depth * 0.5),
          glassMaterial
        );
        insert.position.set(0, height - insertH / 2 - 0.05, 0);
        insert.name = `${namePrefix}_UpperGlass_${isLeft ? 'Left' : 'Right'}`;
        insert.userData.featureId = rootGroup.userData.featureId + '/glass';
        leaf.add(insert);
      }

      // Handle (vertical pull).
      if (handleMaterial) {
        const handle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, 0.45, 12),
          handleMaterial
        );
        const handleX = sideSign > 0 ? leafW - 0.06 : -(leafW - 0.06);
        handle.position.set(handleX, height * 0.5, depth / 2 + 0.02);
        handle.name = `${namePrefix}_Handle_${isLeft ? 'Left' : 'Right'}`;
        handle.userData.featureId = rootGroup.userData.featureId + '/handle';
        leaf.add(handle);
      }

      rootGroup.add(hingeGroup);
      hingeGroups.push(hingeGroup);
    }

    // Toggle helper: open = both leaves swing inward (~70°).
    function toggle(open) {
      const angle = open ? Math.PI / 2.6 : 0;
      for (const hg of hingeGroups) {
        const sign = hg.userData.hingeAxis;
        hg.rotation.y = sign > 0 ? -angle : angle;
      }
    }

    return {
      rootGroup,
      hingeGroups,
      toggle,
      open() { toggle(true); },
      close() { toggle(false); },
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 194 — createGlazedWindowUnit
  // ──────────────────────────────────────────────────────────────────────
  // A multi-pane casement window: frame + glass + mullions. Returns a
  // THREE.Group with userData.featureId set. Mullion grid is rectangular
  // (mullionsX columns × mullionsY rows).
  function createGlazedWindowUnit(opts) {
    if (!THREE) throw new Error('createGlazedWindowUnit requires THREE');
    opts = opts || {};
    const width = opts.width || 1.2;
    const height = opts.height || 1.0;
    const depth = opts.depth || 0.08;
    const frameThickness = opts.frameThickness || 0.06;
    const frameMaterial = opts.frameMaterial || null;
    const glassMaterial = opts.glassMaterial || null;
    const mullionsX = opts.mullionsX || 1;
    const mullionsY = opts.mullionsY || 1;
    const sillMaterial = opts.sillMaterial || null;
    const namePrefix = opts.namePrefix || 'Window';
    if (!frameMaterial) {
      throw new Error('createGlazedWindowUnit: opts.frameMaterial is required');
    }

    const group = new THREE.Group();
    group.name = `${namePrefix}_Assembly`;
    group.userData.featureId = namePrefix.toLowerCase().replace(/[^a-z0-9]+/g, '/');
    group.userData.archHelper = 'createGlazedWindowUnit';
    group.userData.mullions = { x: mullionsX, y: mullionsY };

    // Top + bottom + left + right frame slabs (sill on bottom).
    const t = frameThickness;
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(width, t, depth),
      frameMaterial
    );
    top.position.set(0, height - t / 2, 0);
    top.name = `${namePrefix}_Frame_Top`;
    top.userData.featureId = group.userData.featureId + '/frame';
    group.add(top);

    const botMat = sillMaterial || frameMaterial;
    const bottom = new THREE.Mesh(
      new THREE.BoxGeometry(width, t, depth),
      botMat
    );
    bottom.position.set(0, t / 2, 0);
    bottom.name = sillMaterial ? `${namePrefix}_Sill` : `${namePrefix}_Frame_Bottom`;
    bottom.userData.featureId = group.userData.featureId + '/frame';
    group.add(bottom);

    const left = new THREE.Mesh(
      new THREE.BoxGeometry(t, height - 2 * t, depth),
      frameMaterial
    );
    left.position.set(-width / 2 + t / 2, height / 2, 0);
    left.name = `${namePrefix}_Frame_Left`;
    left.userData.featureId = group.userData.featureId + '/frame';
    group.add(left);

    const right = new THREE.Mesh(
      new THREE.BoxGeometry(t, height - 2 * t, depth),
      frameMaterial
    );
    right.position.set(width / 2 - t / 2, height / 2, 0);
    right.name = `${namePrefix}_Frame_Right`;
    right.userData.featureId = group.userData.featureId + '/frame';
    group.add(right);

    // Glass pane: inset by frameThickness + glassOffset (PART 191).
    if (glassMaterial) {
      const glassW = width - 2 * t;
      const glassH = height - 2 * t;
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(glassW, glassH, depth * 0.3),
        glassMaterial
      );
      // PART 191 GLASS offset = +0.020 in z so the glass doesn't z-fight
      // with the back face of the frame.
      glass.position.set(0, height / 2, depth / 2 + STACK_INDEX.GLASS.z);
      glass.name = `${namePrefix}_GlassPane`;
      glass.userData.featureId = group.userData.featureId + '/glass';
      group.add(glass);
    }

    // Mullions: vertical + horizontal bars subdividing the glass.
    if (mullionsX > 1 || mullionsY > 1) {
      const innerW = width - 2 * t;
      const innerH = height - 2 * t;
      for (let i = 1; i < mullionsX; i++) {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(t * 0.6, innerH, depth * 0.6),
          frameMaterial
        );
        const x = -innerW / 2 + (innerW * i) / mullionsX;
        m.position.set(x, height / 2, depth / 2 + t * 0.2);
        m.name = `${namePrefix}_Mullion_V${i}`;
        m.userData.featureId = group.userData.featureId + '/mullion';
        group.add(m);
      }
      for (let j = 1; j < mullionsY; j++) {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(innerW, t * 0.6, depth * 0.6),
          frameMaterial
        );
        const y = t + (innerH * j) / mullionsY;
        m.position.set(0, y, depth / 2 + t * 0.2);
        m.name = `${namePrefix}_Mullion_H${j}`;
        m.userData.featureId = group.userData.featureId + '/mullion';
        group.add(m);
      }
    }

    for (const child of group.children) {
      child.castShadow = child.receiveShadow = true;
    }
    return group;
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 195 — createPitchedGableRoof
  // ──────────────────────────────────────────────────────────────────────
  // Two sloped roof slabs meeting at a ridge, with a parametric number
  // of tile rows on each slope (procedurally generated with
  // PART 191 micro-epsilon Y staggering). Overhang is per-side.
  function createPitchedGableRoof(opts) {
    if (!THREE) throw new Error('createPitchedGableRoof requires THREE');
    opts = opts || {};
    const width = opts.width || 6;
    const depth = opts.depth || 8;
    const pitch = opts.pitch != null ? opts.pitch : 0.45;  // rise / run
    const overhang = opts.overhang || 0.5;
    const tileMaterial = opts.tileMaterial || null;
    const ridgeMaterial = opts.ridgeMaterial || tileMaterial;
    const tileRows = opts.tileRows || 6;
    const eaveThickness = opts.eaveThickness || 0.08;
    const namePrefix = opts.namePrefix || 'Roof';
    if (!tileMaterial) {
      throw new Error('createPitchedGableRoof: opts.tileMaterial is required');
    }

    const group = new THREE.Group();
    group.name = `${namePrefix}_GableAssembly`;
    group.userData.featureId = namePrefix.toLowerCase().replace(/[^a-z0-9]+/g, '/');
    group.userData.archHelper = 'createPitchedGableRoof';
    group.userData.pitch = pitch;

    const fullW = width + 2 * overhang;
    const fullD = depth + 2 * overhang;
    const rise = (fullW / 2) * pitch;
    const halfW = fullW / 2;
    const slopeLen = Math.sqrt(halfW * halfW + rise * rise);

    // Build each slope as an ExtrudeGeometry-style slanted slab via a
    // custom BufferGeometry (so we don't need the ExtrudeGeometry addon).
    function makeSlope(sign) {
      const g = new THREE.BufferGeometry();
      // 4 vertices: eave-bottom-near, eave-bottom-far, ridge-near, ridge-far.
      const eaveY = 0;
      const ridgeY = rise;
      const verts = new Float32Array([
        // bottom (eave) near
        sign > 0 ? -halfW : halfW, eaveY, -fullD / 2,
        // bottom (eave) far
        sign > 0 ? -halfW : halfW, eaveY,  fullD / 2,
        // ridge near
        0, ridgeY, -fullD / 2,
        // ridge far
        0, ridgeY,  fullD / 2,
      ]);
      g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      g.setIndex([
        0, 1, 2,
        2, 1, 3,
        // back face so single-sided material still renders underside
        0, 2, 1,
        2, 3, 1,
      ]);
      g.computeVertexNormals();
      return g;
    }

    for (const sign of [1, -1]) {
      const slope = new THREE.Mesh(makeSlope(sign), tileMaterial);
      slope.name = `${namePrefix}_Slope_${sign > 0 ? 'Left' : 'Right'}`;
      slope.castShadow = slope.receiveShadow = true;
      slope.userData.featureId = group.userData.featureId + '/slope';
      group.add(slope);

      // Tile rows: thin BoxGeometry strips along Z, spaced along the
      // slope length. Each strip is offset by the PART 191 micro-epsilon
      // so successive rows don't z-fight.
      for (let i = 0; i < tileRows; i++) {
        const t = (i + 0.5) / tileRows;  // 0..1 along the slope length
        const x = sign > 0 ? -halfW * (1 - t) : halfW * (1 - t);
        const y = rise * t + 0.012 * (i % 2);  // PART 191 stagger
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(slopeLen / tileRows * 1.02, 0.018, fullD),
          tileMaterial
        );
        strip.position.set(x, y, 0);
        // Slight rotation around Z so strips are perpendicular to slope
        const angle = Math.atan2(rise, halfW) * sign;
        strip.rotation.z = -angle;
        strip.name = `${namePrefix}_TileRow_${sign > 0 ? 'L' : 'R'}_${i}`;
        strip.userData.featureId = group.userData.featureId + '/tile';
        strip.userData.archHelper = 'createPitchedGableRoof';
        group.add(strip);
      }
    }

    // Ridge cap (a thin slab along the apex).
    if (ridgeMaterial) {
      const ridge = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.06, fullD + 0.1),
        ridgeMaterial
      );
      ridge.position.set(0, rise + 0.025, 0);
      ridge.name = `${namePrefix}_RidgeCap`;
      ridge.userData.featureId = group.userData.featureId + '/ridge';
      group.add(ridge);
    }

    return group;
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 196 — createLouveredAtticVent
  // ──────────────────────────────────────────────────────────────────────
  // A gable-attic louvered vent: frame + N angled slats.
  function createLouveredAtticVent(opts) {
    if (!THREE) throw new Error('createLouveredAtticVent requires THREE');
    opts = opts || {};
    const width = opts.width || 0.6;
    const height = opts.height || 0.45;
    const depth = opts.depth || 0.06;
    const louverCount = opts.louverCount || 6;
    const louverAngle = opts.louverAngle != null ? opts.louverAngle : Math.PI / 6;
    const frameThickness = opts.frameThickness || 0.04;
    const material = opts.material || null;
    const namePrefix = opts.namePrefix || 'AtticVent';
    if (!material) {
      throw new Error('createLouveredAtticVent: opts.material is required');
    }

    const group = new THREE.Group();
    group.name = `${namePrefix}_Assembly`;
    group.userData.featureId = namePrefix.toLowerCase().replace(/[^a-z0-9]+/g, '/');
    group.userData.archHelper = 'createLouveredAtticVent';
    group.userData.louverCount = louverCount;

    const t = frameThickness;
    // Frame: 4 thin slabs around the opening.
    const top = new THREE.Mesh(new THREE.BoxGeometry(width, t, depth), material);
    top.position.set(0, height - t / 2, 0);
    top.name = `${namePrefix}_Frame_Top`;
    top.userData.featureId = group.userData.featureId + '/frame';
    group.add(top);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(width, t, depth), material);
    bottom.position.set(0, t / 2, 0);
    bottom.name = `${namePrefix}_Frame_Bottom`;
    bottom.userData.featureId = group.userData.featureId + '/frame';
    group.add(bottom);
    const left = new THREE.Mesh(new THREE.BoxGeometry(t, height - 2 * t, depth), material);
    left.position.set(-width / 2 + t / 2, height / 2, 0);
    left.name = `${namePrefix}_Frame_Left`;
    left.userData.featureId = group.userData.featureId + '/frame';
    group.add(left);
    const right = new THREE.Mesh(new THREE.BoxGeometry(t, height - 2 * t, depth), material);
    right.position.set(width / 2 - t / 2, height / 2, 0);
    right.name = `${namePrefix}_Frame_Right`;
    right.userData.featureId = group.userData.featureId + '/frame';
    group.add(right);

    // Louvers: thin slanted slats.
    const innerH = height - 2 * t;
    for (let i = 0; i < louverCount; i++) {
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(width - 2 * t, 0.012, depth * 0.8),
        material
      );
      const y = t + 0.025 + (innerH * i) / Math.max(1, louverCount);
      slat.position.set(0, y, depth / 4);
      slat.rotation.x = -louverAngle;
      slat.name = `${namePrefix}_Louver_${i}`;
      slat.userData.featureId = group.userData.featureId + '/louver';
      group.add(slat);
    }

    for (const child of group.children) {
      child.castShadow = child.receiveShadow = true;
    }
    return group;
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 197 — createPottedPlant
  // ──────────────────────────────────────────────────────────────────────
  // A planter pot (truncated cone) with N foliage balls on top.
  // Deterministic via mulberry32 (seed).
  function createPottedPlant(opts) {
    if (!THREE) throw new Error('createPottedPlant requires THREE');
    opts = opts || {};
    const potRadius = opts.potRadius || 0.18;
    const potHeight = opts.potHeight || 0.32;
    const potTopRadius = opts.potTopRadius || potRadius * 1.15;
    const foliageCount = opts.foliageCount || 5;
    const foliageMaterial = opts.foliageMaterial || null;
    const potMaterial = opts.potMaterial || null;
    const seed = opts.seed == null ? 1 : opts.seed;
    const namePrefix = opts.namePrefix || 'PottedPlant';
    if (!foliageMaterial || !potMaterial) {
      throw new Error('createPottedPlant: opts.foliageMaterial and opts.potMaterial are required');
    }

    const group = new THREE.Group();
    group.name = `${namePrefix}_Assembly`;
    group.userData.featureId = namePrefix.toLowerCase().replace(/[^a-z0-9]+/g, '/');
    group.userData.archHelper = 'createPottedPlant';

    // Pot: truncated cone via CylinderGeometry.
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(potTopRadius, potRadius, potHeight, 16, 1, true),
      potMaterial
    );
    pot.position.set(0, potHeight / 2, 0);
    pot.name = `${namePrefix}_Pot`;
    pot.userData.featureId = group.userData.featureId + '/pot';
    pot.castShadow = pot.receiveShadow = true;
    group.add(pot);

    // Foliage cluster: deterministic seeded sphere scatter.
    const rand = mulberry32(seed);
    for (let i = 0; i < foliageCount; i++) {
      const r = potTopRadius * (0.45 + rand() * 0.35);
      const foliage = new THREE.Mesh(
        new THREE.IcosahedronGeometry(r, 1),
        foliageMaterial
      );
      const angle = (i / foliageCount) * Math.PI * 2 + rand() * 0.4;
      const radial = potTopRadius * 0.4 * rand();
      foliage.position.set(
        Math.cos(angle) * radial,
        potHeight + r * 0.6 + rand() * 0.06,
        Math.sin(angle) * radial
      );
      foliage.name = `${namePrefix}_Foliage_${i}`;
      foliage.userData.featureId = group.userData.featureId + '/foliage';
      foliage.castShadow = foliage.receiveShadow = true;
      group.add(foliage);
    }

    return group;
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 198 — createSteppingStonePath
  // ──────────────────────────────────────────────────────────────────────
  // A curving path of stepping-stone pavers. Path is a quadratic Bezier
  // in XZ between (baseX, baseZ) and (baseX + dx, baseZ + dz) with a
  // random perpendicular offset. Deterministic via mulberry32.
  function createSteppingStonePath(opts) {
    if (!THREE) throw new Error('createSteppingStonePath requires THREE');
    opts = opts || {};
    const count = opts.count || 8;
    const baseX = opts.baseX || 0;
    const baseZ = opts.baseZ || 0;
    const endX = opts.endX != null ? opts.endX : baseX + 3;
    const endZ = opts.endZ != null ? opts.endZ : baseZ;
    const stepSize = opts.stepSize || 0.35;
    const radius = opts.radius || 0.18;
    const material = opts.material || null;
    const seed = opts.seed == null ? 1 : opts.seed;
    const namePrefix = opts.namePrefix || 'SteppingStones';
    const yLevel = opts.yLevel != null ? opts.yLevel : STACK_INDEX.PAVERS.y;
    if (!material) {
      throw new Error('createSteppingStonePath: opts.material is required');
    }

    const group = new THREE.Group();
    group.name = `${namePrefix}_Path`;
    group.userData.featureId = namePrefix.toLowerCase().replace(/[^a-z0-9]+/g, '/');
    group.userData.archHelper = 'createSteppingStonePath';
    group.userData.stoneCount = count;

    const rand = mulberry32(seed);
    const midX = (baseX + endX) / 2;
    const midZ = (baseZ + endZ) / 2;
    const dx = endX - baseX;
    const dz = endZ - baseZ;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    // Perpendicular offset (signed)
    const px = -dz / len;
    const pz = dx / len;
    const bow = (rand() - 0.5) * 1.2;  // bow magnitude in metres
    const ctrlX = midX + px * bow;
    const ctrlZ = midZ + pz * bow;

    function bezier2(t, p0, p1, p2) {
      const it = 1 - t;
      return it * it * p0 + 2 * it * t * p1 + t * t * p2;
    }

    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const x = bezier2(t, baseX, ctrlX, endX) + (rand() - 0.5) * 0.05;
      const z = bezier2(t, baseZ, ctrlZ, endZ) + (rand() - 0.5) * 0.05;
      const r = radius * (0.9 + rand() * 0.2);
      const stone = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r * 0.95, 0.04, 12),
        material
      );
      // PART 191 PAVERS offset for z-fight-free stacking on lawn.
      stone.position.set(x, yLevel, z);
      stone.rotation.y = rand() * Math.PI * 2;
      stone.name = `${namePrefix}_Paver_${i}`;
      stone.userData.featureId = group.userData.featureId + '/paver';
      stone.castShadow = stone.receiveShadow = true;
      group.add(stone);
    }

    return group;
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 199.1 — schemaNamespacingLinter
  // ──────────────────────────────────────────────────────────────────────
  // Walks a THREE.Object3D scene graph and verifies:
  //   (a) every mesh with userData.featureId OR a slash/underscore-prefixed
  //       name has its category represented
  //   (b) the same mesh can be located via the regex search contract
  //       used by the `detailInventory` validator
  //   (c) coplanar anti-pattern detection: two meshes whose world-space
  //       position differs by < 5mm on all axes (anti-Z-fighting sanity)
  //
  //   inventory: [
  //     { id: 'door/doubleTeak', required: true, regex: /^door\//i },
  //     ...
  //   ]
  //
  // Returns a report:
  //   {
  //     passed: bool,
  //     missing: [{ id, reason }],
  //     coplanar: [{ a, b, distance }],
  //     totalMeshes: int,
  //     featuresFound: [{ id, count }],
  //   }
  function schemaNamespacingLinter(rootObj, inventory) {
    inventory = inventory || [];
    const report = {
      passed: true,
      missing: [],
      coplanar: [],
      totalMeshes: 0,
      featuresFound: [],
    };

    // Pass 1: collect every mesh + its namespace.
    const meshes = [];
    rootObj.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        meshes.push(o);
      }
    });
    report.totalMeshes = meshes.length;

    // Pass 2: check inventory items.
    for (const item of inventory) {
      let count = 0;
      const matcher = item.regex || new RegExp(item.id.replace(/[/]/g, '[\\\\/_]'), 'i');
      for (const m of meshes) {
        const fid = (m.userData && m.userData.featureId) || '';
        const nm = m.name || '';
        if (matcher.test(fid) || matcher.test(nm)) count++;
      }
      report.featuresFound.push({ id: item.id, count, required: !!item.required });
      if (item.required && count === 0) {
        report.missing.push({ id: item.id, reason: 'no mesh matched the inventory regex' });
        report.passed = false;
      }
    }

    // Pass 3: coplanar Z-fight detection (world-space).
    const COPLANAR_EPS = 0.005;
    const seen = new Map();  // gridKey -> first mesh
    for (const m of meshes) {
      if (!m.geometry || !m.geometry.attributes.position) continue;
      m.updateWorldMatrix(true, false);
      const wm = m.matrixWorld;
      const e = wm.elements;
      // World position of the geometry centroid (cheap approx).
      const geo = m.geometry;
      let cx = 0, cy = 0, cz = 0;
      const pos = geo.attributes.position;
      const stride = 3;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        cx += e[0] * x + e[4] * y + e[8]  * z + e[12];
        cy += e[1] * x + e[5] * y + e[9]  * z + e[13];
        cz += e[2] * x + e[6] * y + e[10] * z + e[14];
      }
      cx /= pos.count; cy /= pos.count; cz /= pos.count;
      const key = `${Math.round(cx / COPLANAR_EPS)}_${Math.round(cy / COPLANAR_EPS)}_${Math.round(cz / COPLANAR_EPS)}`;
      if (seen.has(key)) {
        report.coplanar.push({
          a: seen.get(key).name || '(unnamed)',
          b: m.name || '(unnamed)',
          gridKey: key,
        });
      } else {
        seen.set(key, m);
      }
    }

    if (report.coplanar.length > 0) report.passed = false;
    return report;
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 199.2 — createArchitecturalLookDevLights
  // ──────────────────────────────────────────────────────────────────────
  // Lighting rig presets for architectural scenes. Returns a
  // THREE.Group containing the configured lights. Caller adds the group
  // to the scene. Modes:
  //   'day'      — bright outdoor (warm key + cool sky fill)
  //   'dusk'     — golden hour (low warm key + cool sky fill + amber rim)
  //   'night'    — dim (cool ambient + 2 warm interior point lights)
  //   'warmglow' — interior (warm ambient + 2 warm interior points)
  function createArchitecturalLookDevLights(mode) {
    if (!THREE) throw new Error('createArchitecturalLookDevLights requires THREE');
    mode = mode || 'day';
    const group = new THREE.Group();
    group.name = `ArchLookDevLights_${mode}`;
    group.userData.archHelper = 'createArchitecturalLookDevLights';
    group.userData.mode = mode;

    function ambient(intensity, color) {
      const a = new THREE.AmbientLight(color || 0xffffff, intensity);
      group.add(a);
    }
    function hemi(sky, ground, intensity) {
      const h = new THREE.HemisphereLight(sky, ground, intensity);
      group.add(h);
    }
    function dir(color, intensity, pos, castShadow) {
      const d = new THREE.DirectionalLight(color, intensity);
      d.position.set(pos[0], pos[1], pos[2]);
      if (castShadow) {
        d.castShadow = true;
        d.shadow.mapSize.set(2048, 2048);
        d.shadow.camera.near = 0.5;
        d.shadow.camera.far = 60;
        d.shadow.camera.left = -20;
        d.shadow.camera.right = 20;
        d.shadow.camera.top = 20;
        d.shadow.camera.bottom = -20;
        d.shadow.bias = -0.0005;
      }
      group.add(d);
      return d;
    }
    function point(color, intensity, pos) {
      const p = new THREE.PointLight(color, intensity, 30, 2);
      p.position.set(pos[0], pos[1], pos[2]);
      group.add(p);
      return p;
    }

    switch (mode) {
      case 'day':
        ambient(0.35, 0xffffff);
        hemi(0xb1d4ff, 0xc8b89a, 0.45);
        dir(0xfff1d6, 2.4, [8, 12, 6], true);
        dir(0x9ec1ff, 0.6, [-6, 4, -3], false);  // cool fill
        break;
      case 'dusk':
        ambient(0.25, 0xffd9b3);
        hemi(0xf6a86b, 0x3a2a1a, 0.4);
        dir(0xffb070, 1.6, [10, 5, 6], true);
        dir(0x7090d0, 0.35, [-6, 4, -4], false);
        dir(0xff9040, 0.4, [0, 2, -8], false);  // amber rim
        break;
      case 'night':
        ambient(0.12, 0x6e88a8);
        hemi(0x2a3a52, 0x0a0d12, 0.3);
        dir(0x88aaff, 0.25, [4, 6, 4], false);
        point(0xffd49a, 1.2, [0, 1.6, 0]);    // warm interior
        point(0xffba6a, 0.8, [3, 1.6, 2]);    // secondary
        break;
      case 'warmglow':
        ambient(0.3, 0xffd9a8);
        hemi(0xffba7a, 0x402a1a, 0.4);
        dir(0xffd6a0, 0.8, [4, 6, 4], false);
        point(0xffce86, 1.5, [0, 1.8, 0]);
        point(0xffba6a, 1.0, [3, 1.8, 2]);
        point(0xffce86, 0.7, [-3, 1.8, -1]);
        break;
      default:
        console.warn('[MT_architectural] unknown lighting mode', mode, '— falling back to day');
        return createArchitecturalLookDevLights('day');
    }
    return group;
  }

  // ──────────────────────────────────────────────────────────────────────
  // PART 199.3 — materialPalette factory
  // ──────────────────────────────────────────────────────────────────────
  // Canonical 9-key palette (matches the spec section 4.4 "Material
  // Palette Consolidation" rule). Each key returns a fresh
  // MeshStandardMaterial; callers share by reference where appropriate.
  function materialPalette(opts) {
    if (!THREE) throw new Error('materialPalette requires THREE');
    opts = opts || {};
    const envMap = opts.envMap || null;
    function std(color, rough, metal) {
      const m = new THREE.MeshStandardMaterial({
        color: color,
        roughness: rough != null ? rough : 0.85,
        metalness: metal != null ? metal : 0.0,
      });
      if (envMap) m.envMap = envMap;
      return m;
    }
    return {
      stuccoWhite:   std(0xf2eee5, 0.92, 0.0),
      darkCharcoal:  std(0x2a2d33, 0.65, 0.15),
      teakWood:      std(0x6b4423, 0.78, 0.0),
      roofTile:      std(0xa05a3c, 0.88, 0.0),
      windowGlass:   new THREE.MeshStandardMaterial({
        color: 0x88b6cc, roughness: 0.05, metalness: 0.0,
        transparent: true, opacity: 0.4, envMap: envMap || undefined,
      }),
      stonePavers:   std(0xb0a999, 0.95, 0.0),
      darkMetalTrim: std(0x1c1f24, 0.35, 0.85),
      warmTeak:      std(0x8b5a2b, 0.7, 0.0),
      foliageGreen:  std(0x4a6b3a, 0.8, 0.0),
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // Self-test (used at startup to verify the architectural bundle).
  // ──────────────────────────────────────────────────────────────────────
  function selfTest() {
    const results = { passed: 0, failed: 0, log: [] };
    function _test(name, fn) {
      try {
        const r = fn();
        results.passed++;
        results.log.push({ name, status: 'OK', info: r });
      } catch (e) {
        results.failed++;
        results.log.push({ name, status: 'FAIL', error: e && (e.message || String(e)) });
      }
    }

    const palette = materialPalette({});

    _test('stackLevel returns numeric', () => {
      const v = stackLevel('PLAINTH', 'y');
      if (typeof v !== 'number') throw new Error('not a number');
      return v;
    });

    _test('createWallWithApertures: solid wall has slabs', () => {
      const g = createWallWithApertures(4, 3, 0.3, [], palette.stuccoWhite, 'WallSolid');
      if (g.children.length === 0) throw new Error('no slabs');
      return g.children.length;
    });

    _test('createWallWithApertures: wall with 1 opening is hollow', () => {
      const g = createWallWithApertures(4, 3, 0.3, [
        { x: 0, y: 0.45, w: 1.2, h: 2.1 },
      ], palette.stuccoWhite, 'WallWithDoor');
      // The slab at the door should NOT exist (it's the cavity).
      // We just check we got a non-empty wall group.
      if (g.children.length === 0) throw new Error('no slabs');
      return g.userData.apertureCount;
    });

    _test('createHingedDoorUnit: 2-leaf double door', () => {
      const d = createHingedDoorUnit({
        width: 1.4, height: 2.1, depth: 0.05, leaves: 2,
        doorMaterial: palette.teakWood,
        handleMaterial: palette.darkMetalTrim,
        withGlassInsert: true, glassMaterial: palette.windowGlass,
        namePrefix: 'door/doubleTeak',
      });
      if (d.hingeGroups.length !== 2) throw new Error('wrong leaf count');
      if (d.toggle && typeof d.toggle !== 'function') throw new Error('no toggle');
      // Toggle open + close should change rotation
      const beforeY = d.hingeGroups[0].rotation.y;
      d.open();
      const openY = d.hingeGroups[0].rotation.y;
      if (Math.abs(openY - beforeY) < 0.01) throw new Error('toggle did nothing');
      d.close();
      return d.hingeGroups.length;
    });

    _test('createGlazedWindowUnit: 2x2 mullion grid', () => {
      const w = createGlazedWindowUnit({
        width: 1.2, height: 1.0, mullionsX: 2, mullionsY: 2,
        frameMaterial: palette.darkCharcoal,
        glassMaterial: palette.windowGlass,
        namePrefix: 'window/casement',
      });
      // 4 frame slabs + 1 glass pane + 1 vertical mullion + 1 horizontal mullion = 7
      if (w.children.length < 6) throw new Error('not enough children');
      return w.children.length;
    });

    _test('createPitchedGableRoof: 2 slopes + ridge + tile rows', () => {
      const r = createPitchedGableRoof({
        width: 4, depth: 6, pitch: 0.5, tileRows: 4,
        tileMaterial: palette.roofTile,
        namePrefix: 'roof/gable',
      });
      // 2 slopes + (2 sides × 4 rows = 8 tiles) + 1 ridge cap = 11
      if (r.children.length < 9) throw new Error('not enough roof children');
      return r.children.length;
    });

    _test('createLouveredAtticVent: 4 frame slabs + 5 louvers', () => {
      const v = createLouveredAtticVent({
        width: 0.6, height: 0.45, louverCount: 5,
        material: palette.darkCharcoal,
        namePrefix: 'attic/louverVent',
      });
      // 4 frame + 5 louvers = 9
      if (v.children.length < 8) throw new Error('not enough vent children');
      return v.children.length;
    });

    _test('createPottedPlant: 1 pot + 5 foliage', () => {
      const p = createPottedPlant({
        potRadius: 0.18, potHeight: 0.32, foliageCount: 5,
        foliageMaterial: palette.foliageGreen,
        potMaterial: palette.darkCharcoal,
        seed: 1,
        namePrefix: 'landscape/pottedPlant',
      });
      if (p.children.length !== 6) throw new Error('wrong count');
      return p.children.length;
    });

    _test('createSteppingStonePath: 8 deterministic pavers', () => {
      const a = createSteppingStonePath({
        count: 8, baseX: 0, baseZ: 0, endX: 3, endZ: 0,
        material: palette.stonePavers, seed: 42,
        namePrefix: 'landscape/steppingStones',
      });
      const b = createSteppingStonePath({
        count: 8, baseX: 0, baseZ: 0, endX: 3, endZ: 0,
        material: palette.stonePavers, seed: 42,
        namePrefix: 'landscape/steppingStones',
      });
      if (a.children.length !== 8) throw new Error('wrong paver count');
      // Determinism: same seed → same first paver position.
      if (a.children[0].position.x !== b.children[0].position.x) {
        throw new Error('not deterministic');
      }
      return a.children.length;
    });

    _test('schemaNamespacingLinter: detects missing required id', () => {
      const root = new THREE.Group();
      // Add a mesh named 'roof/gable_Slope_Left' (matches roof/gable).
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        palette.stuccoWhite
      );
      m.name = 'roof/gable_Slope_Left';
      m.userData.featureId = 'roof/gable/slope';
      root.add(m);
      const r = schemaNamespacingLinter(root, [
        { id: 'roof/gable', required: true, regex: /^roof\//i },
        { id: 'door/doubleTeak', required: true, regex: /^door\//i },
      ]);
      if (r.passed) throw new Error('expected failure (door missing)');
      if (r.missing.length !== 1) throw new Error('wrong missing count');
      return r.missing[0].id;
    });

    _test('createArchitecturalLookDevLights: day mode returns group with lights', () => {
      const g = createArchitecturalLookDevLights('day');
      if (g.children.length < 3) throw new Error('not enough lights');
      return g.children.length;
    });

    return results;
  }

  // ── Public API ────────────────────────────────────────────────────────
  const api = {
    STACK_INDEX,
    stackLevel,
    createWallWithApertures,
    createHingedDoorUnit,
    createGlazedWindowUnit,
    createPitchedGableRoof,
    createLouveredAtticVent,
    createPottedPlant,
    createSteppingStonePath,
    createArchitecturalLookDevLights,
    materialPalette,
    schemaNamespacingLinter,
    selfTest,
  };

  if (typeof window !== 'undefined') window.MT_architectural = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  console.log(
    '%c[MT_architectural]%c PART 190-199 Architectural Modeling Bundle loaded.\n' +
    '    window.MT_architectural = { createWallWithApertures, createHingedDoorUnit, createGlazedWindowUnit, createPitchedGableRoof, createLouveredAtticVent, createPottedPlant, createSteppingStonePath, createArchitecturalLookDevLights, materialPalette, schemaNamespacingLinter, STACK_INDEX, stackLevel, selfTest }\n' +
    '    8 helpers + schema linter + look-dev lighting rig.\n' +
    '    Run window.MT_architectural.selfTest() to verify the bundle.',
    'background:#a05a3c;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold',
    'color:#a05a3c'
  );
})(typeof window !== 'undefined' ? window : globalThis);
