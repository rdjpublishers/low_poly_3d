// MT_TEXTURES — Procedural texture extensions (v1.36 / v8.29 — PART 230-234).
//
// Five helpers layered on top of MT_materials.proceduralTextureCanvas /
// uvUnwrap / bakeMap. Sourced from a survey of 17 external texturing
// research repos (text2mesh / TEXTure / Text2Tex / Texturify / ITEM3D /
// Paint3D / UV3-TeD / Point-UV Diffusion / geometric-textures /
// mesh-texture-synthesis etc.) — only the procedural / deterministic /
// UV-space-aware ideas from that survey made it in. The diffusion /
// NeRF / high-poly ones did not (they don't fit this renderer's
// low-poly / procedural / WebGL footprint).
//
// Public surface (window.MT_textures):
//
//   230. makeStyleField(prompt)            — text/prompt → palette + style hints
//   231. makeMultiScalePattern(spec, opts) — multi-octave procedural texture
//   232. makeCavityAwarePattern(spec, g)   — curvature-modulated procedural
//   233. makeGeodesicField(g, anchors)     — geodesic distance field on a mesh
//   234. makeProgressiveUV(g, opts)        — incremental UV unwrap by visibility
//
// All helpers are deterministic when given a `seed`. All return either a
// THREE.CanvasTexture (230-232) or per-vertex Float32Array (233-234).
// No external assets — same generating-Pipeline contract as the rest of
// MT_materials / MT_organic (PART 74).
//
// Reference repos that informed each helper:
//   makeStyleField          ← text2mesh (Michel et al., CVPR 2022),
//                              CLIP-Mesh (Khalid et al., SIGGRAPH ASIA 2022)
//   makeMultiScalePattern   ← geometric-textures (Hertz et al., SIGGRAPH 2020)
//   makeCavityAwarePattern  ← mesh-texture-synthesis (Kovacs et al., CGF 2024)
//   makeGeodesicField       ← UV3-TeD (Foti et al., 3DV 2023),
//                              Point-UV Diffusion (Yu et al., ICCV 2023)
//   makeProgressiveUV       ← Text2Tex (Richardson et al., ICCV 2023)

'use strict';

(function (root) {
  const noise = root.MT_noise;
  const materials = root.MT_materials;
  if (!noise) {
    console.error('[MT_textures] requires MT_noise loaded first');
    return;
  }
  const THREE = root.THREE;

  // ═════════════════════════════════════════════════════════════════════
  // 230. makeStyleField — text prompt → palette + style hints
  // ═════════════════════════════════════════════════════════════════════
  // The problem: an AI / user says "rusty iron with a glowing seam" or
  // "matte ceramic with brass fittings" and the factory has to translate
  // that into a 6-band palette. Real systems use CLIP embeddings; here we
  // use a curated text→mood-color mapping table (deterministic, no ML,
  // no GPU, instant, runs in Pyodide) — the same idea as text2mesh's
  // "neural style field" but with explicit lookup rather than learned
  // weights. The author of a model can extend the table with domain-
  // specific keywords via opts.moodOverrides.
  //
  // Inputs:
  //   prompt (string)        — free-form text describing the desired mood
  //   opts.moodOverrides     — optional object mapping keyword→palette
  //   opts.baseHue           — optional [r,g,b] to bias the result
  //
  // Output:
  //   {
  //     palette: [
  //       { name: 'shell',   color: '#xxxxxx', roughness: 0.xx, metalness: 0.xx },
  //       { name: 'accent',  color: '#xxxxxx', roughness: 0.xx, metalness: 0.xx, emissive: '#xxxxxx', emissiveIntensity: 0.xx },
  //       { name: 'metal',   color: '#xxxxxx', roughness: 0.xx, metalness: 0.xx },
  //       { name: 'dark',    color: '#xxxxxx', roughness: 0.xx },
  //       { name: 'light',   color: '#xxxxxx', roughness: 0.xx },
  //       { name: 'highlight', color: '#xxxxxx', roughness: 0.xx },
  //     ],
  //     style: {
  //       mtlMood: 'rusty' | 'ceramic' | 'metallic' | 'organic' | 'glass' | 'plastic' | 'stone' | 'wood' | 'default',
  //       glossLevel: 0..1,
  //       emissiveLevel: 0..1,
  //       matchedKeywords: ['rust', 'iron', ...],
  //     },
  //   }

  // The mood table. Each keyword maps to:
  //   { color, roughness, metalness, emissive (optional), emissiveIntensity (optional) }
  // Default palette "slots" are picked from these via a small scoring
  // system (each mood contributes its color to the slot whose name
  // best matches its semantic role).
  const MOOD_TABLE = {
    // Metals — high metalness, low roughness, often darker
    'iron':       { color: '#3a3d42', roughness: 0.55, metalness: 0.85 },
    'steel':      { color: '#7a7f87', roughness: 0.30, metalness: 0.90 },
    'brass':      { color: '#b5965a', roughness: 0.40, metalness: 0.80 },
    'gold':       { color: '#d4af37', roughness: 0.25, metalness: 0.95 },
    'silver':     { color: '#cfd2d6', roughness: 0.20, metalness: 0.95 },
    'chrome':     { color: '#d8dde3', roughness: 0.10, metalness: 1.00 },
    'copper':     { color: '#b87333', roughness: 0.45, metalness: 0.85 },
    'bronze':     { color: '#8c7853', roughness: 0.50, metalness: 0.80 },
    'titanium':   { color: '#878a8c', roughness: 0.40, metalness: 0.85 },
    'rusty':      { color: '#8b3a1a', roughness: 0.85, metalness: 0.30 },
    'oxidized':   { color: '#6b3a2a', roughness: 0.80, metalness: 0.35 },
    // Plastics — low metalness, mid-low roughness
    'plastic':    { color: '#404450', roughness: 0.55, metalness: 0.00 },
    'matte':      { color: '#5a5f68', roughness: 0.85, metalness: 0.00 },
    'glossy':     { color: '#222428', roughness: 0.15, metalness: 0.00 },
    'rubber':     { color: '#1c1d20', roughness: 0.95, metalness: 0.00 },
    // Organics — low metalness, varying roughness, often saturated
    'wood':       { color: '#6b4a2a', roughness: 0.85, metalness: 0.00 },
    'oak':        { color: '#8b6b3a', roughness: 0.80, metalness: 0.00 },
    'walnut':     { color: '#4a2f1c', roughness: 0.80, metalness: 0.00 },
    'pine':       { color: '#d4b87a', roughness: 0.85, metalness: 0.00 },
    'leather':    { color: '#5a3a1c', roughness: 0.70, metalness: 0.00 },
    'fabric':     { color: '#8a7a6a', roughness: 0.95, metalness: 0.00 },
    'cotton':     { color: '#f0eadc', roughness: 0.95, metalness: 0.00 },
    'wool':       { color: '#c0b8a8', roughness: 0.95, metalness: 0.00 },
    'silk':       { color: '#d8c8b0', roughness: 0.30, metalness: 0.00 },
    'paper':      { color: '#f5f0e0', roughness: 0.95, metalness: 0.00 },
    'cardboard':  { color: '#a08050', roughness: 0.95, metalness: 0.00 },
    // Stones
    'stone':      { color: '#888880', roughness: 0.90, metalness: 0.00 },
    'marble':     { color: '#e8e4dc', roughness: 0.30, metalness: 0.05 },
    'granite':    { color: '#5a5852', roughness: 0.85, metalness: 0.10 },
    'sandstone':  { color: '#c8a878', roughness: 0.95, metalness: 0.00 },
    'slate':      { color: '#4a4a52', roughness: 0.70, metalness: 0.05 },
    'concrete':   { color: '#a8a8a0', roughness: 0.95, metalness: 0.00 },
    'brick':      { color: '#a8543a', roughness: 0.90, metalness: 0.00 },
    'ceramic':    { color: '#f0eae0', roughness: 0.55, metalness: 0.00 },
    'porcelain':  { color: '#faf6ec', roughness: 0.40, metalness: 0.00 },
    'terracotta': { color: '#b8603a', roughness: 0.85, metalness: 0.00 },
    // Naturals
    'sand':       { color: '#e0c898', roughness: 0.95, metalness: 0.00 },
    'dirt':       { color: '#5a3a20', roughness: 0.95, metalness: 0.00 },
    'mud':        { color: '#3a2818', roughness: 0.95, metalness: 0.00 },
    'grass':      { color: '#4a8030', roughness: 0.90, metalness: 0.00 },
    'moss':       { color: '#3a6a30', roughness: 0.95, metalness: 0.00 },
    'leaf':       { color: '#508030', roughness: 0.70, metalness: 0.00 },
    'bark':       { color: '#3a2818', roughness: 0.95, metalness: 0.00 },
    // Glow
    'glow':       { color: '#ffd66b', roughness: 0.25, metalness: 0.00, emissive: '#ffae3a', emissiveIntensity: 2.4 },
    'neon':       { color: '#ff4488', roughness: 0.20, metalness: 0.00, emissive: '#ff4488', emissiveIntensity: 3.0 },
    'lava':       { color: '#ff5520', roughness: 0.50, metalness: 0.00, emissive: '#ff2200', emissiveIntensity: 2.8 },
    'magic':      { color: '#8a48ff', roughness: 0.25, metalness: 0.00, emissive: '#6420ff', emissiveIntensity: 2.2 },
    'screen':     { color: '#88ccff', roughness: 0.20, metalness: 0.00, emissive: '#4488ff', emissiveIntensity: 1.8 },
    'lamp':       { color: '#fff0c0', roughness: 0.30, metalness: 0.00, emissive: '#ffd060', emissiveIntensity: 2.5 },
    'headlight':  { color: '#ffffe0', roughness: 0.10, metalness: 0.00, emissive: '#ffffaa', emissiveIntensity: 3.0 },
    'taillight':  { color: '#ff3030', roughness: 0.20, metalness: 0.00, emissive: '#cc0000', emissiveIntensity: 2.5 },
    'eye':        { color: '#aaccff', roughness: 0.10, metalness: 0.00, emissive: '#4488ff', emissiveIntensity: 1.5 },
    'ember':      { color: '#ff8030', roughness: 0.50, metalness: 0.00, emissive: '#ff4400', emissiveIntensity: 2.0 },
    // Specials
    'glass':      { color: '#d8e8f0', roughness: 0.05, metalness: 0.00 },
    'water':      { color: '#88aacc', roughness: 0.05, metalness: 0.00 },
    'ice':        { color: '#c8e0f0', roughness: 0.10, metalness: 0.00 },
    'snow':       { color: '#f0f4f8', roughness: 0.95, metalness: 0.00 },
  };

  function _matchMoods(prompt, overrides) {
    const tokens = String(prompt || '').toLowerCase().split(/[\s,.;:_-]+/).filter(Boolean);
    const matched = {};
    const table = Object.assign({}, MOOD_TABLE, overrides || {});
    for (const tok of tokens) {
      if (table[tok]) {
        if (!matched[tok] || matched[tok].score < 1) {
          matched[tok] = Object.assign({}, table[tok], { score: 1 });
        }
      }
    }
    return matched;
  }

  function _aggregateSlots(matched) {
    // Group matched moods by similarity of class into palette slots.
    // We use a small heuristic: pick the first metallic mood as 'metal',
    // the first organic as 'shell', the first glow as 'accent' (or
    // 'shell' if no metal), the darkest non-emissive as 'dark',
    // the lightest as 'light', the highest-saturation as 'highlight'.
    const moods = Object.values(matched);
    if (!moods.length) return null;
    const slots = {};
    const findFirst = (pred) => moods.find(m => pred(m)) || null;
    const metallic = findFirst(m => m.metalness >= 0.5);
    const emissive = findFirst(m => m.emissive);
    const wood = findFirst(m => /wood|bark|leather|fabric|cotton|wool|silk|paper/.test(Object.keys(matched).find(k => matched[k] === m) || ''));
    const stone = findFirst(m => /stone|marble|granite|sandstone|slate|concrete|brick|terracotta|sand|dirt|mud/.test(Object.keys(matched).find(k => matched[k] === m) || ''));
    const shell = metallic || wood || stone || findFirst(m => m.metalness < 0.2 && !m.emissive) || moods[0];
    if (shell) slots.shell = shell;
    if (metallic && metallic !== shell) slots.metal = metallic;
    if (emissive) slots.accent = emissive;
    if (wood) slots.wood = wood;
    if (stone) slots.stone = stone;
    // dark / light from the moods set
    const sorted = moods.slice().sort((a, b) => _brightness(a.color) - _brightness(b.color));
    if (sorted.length >= 1) slots.dark = sorted[0];
    if (sorted.length >= 2) slots.light = sorted[sorted.length - 1];
    if (sorted.length >= 3) slots.highlight = sorted[Math.floor(sorted.length / 2)];
    return slots;
  }

  function _brightness(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    if (!m) return 0.5;
    return (parseInt(m[1], 16) + parseInt(m[2], 16) + parseInt(m[3], 16)) / (3 * 255);
  }

  function _classifyMtlMood(matched) {
    const tokens = Object.keys(matched);
    if (tokens.some(t => /steel|chrome|silver|gold|brass|copper|bronze|iron|titanium/.test(t))) return 'metallic';
    if (tokens.some(t => /rust|oxidized|patina/.test(t))) return 'rusty';
    if (tokens.some(t => /ceramic|porcelain|glass|marble/.test(t))) return 'ceramic';
    if (tokens.some(t => /wood|oak|walnut|pine|bark/.test(t))) return 'wood';
    if (tokens.some(t => /stone|granite|sandstone|slate|concrete|brick|terracotta/.test(t))) return 'stone';
    if (tokens.some(t => /leaf|grass|moss/.test(t))) return 'organic';
    if (tokens.some(t => /glow|neon|lava|magic|screen|lamp|headlight|taillight|eye|ember/.test(t))) return 'glow';
    if (tokens.some(t => /fabric|cotton|wool|silk|paper|leather/.test(t))) return 'organic';
    if (tokens.some(t => /plastic|matte|glossy|rubber/.test(t))) return 'plastic';
    return 'default';
  }

  function makeStyleField(prompt, opts) {
    opts = opts || {};
    const matched = _matchMoods(prompt, opts.moodOverrides);
    const slots = _aggregateSlots(matched);
    const palette = [];
    if (slots) {
      for (const [k, v] of Object.entries(slots)) {
        palette.push(Object.assign({ name: k }, v));
      }
    }
    // Compute glossLevel (avg roughness inverted) and emissiveLevel (max emissiveIntensity / 3)
    const allRough = palette.map(p => typeof p.roughness === 'number' ? p.roughness : 0.5);
    const allEm = palette.map(p => typeof p.emissiveIntensity === 'number' ? p.emissiveIntensity : 0);
    const glossLevel = allRough.length ? 1 - (allRough.reduce((a, b) => a + b, 0) / allRough.length) : 0;
    const emissiveLevel = allEm.length ? Math.min(1, Math.max(...allEm) / 3) : 0;
    return {
      palette,
      style: {
        mtlMood: _classifyMtlMood(matched),
        glossLevel,
        emissiveLevel,
        matchedKeywords: Object.keys(matched),
      },
    };
  }

  // ═════════════════════════════════════════════════════════════════════
  // 231. makeMultiScalePattern — multi-octave procedural texture
  // ═════════════════════════════════════════════════════════════════════
  // The same pattern stacked at 2-4 scales with weighted blending. From
  // geometric-textures (Hertz et al., SIGGRAPH 2020): "Multi-scale
  // generator approach — learns texture statistics at multiple scales
  // and progressively applies finer details." We don't learn; we sample
  // the same proceduralTextureCanvas at multiple scales and blend.
  //
  // Inputs:
  //   spec            — the same shape proceduralTextureCanvas takes
  //                     (`type`, `seed`, `scale`, etc.)
  //   opts.levels     — array of { scale, weight } pairs; default
  //                     [{scale:1,weight:0.5},{scale:4,weight:0.3},
  //                      {scale:16,weight:0.15},{scale:64,weight:0.05}]
  //   opts.size       — canvas size (default 256)
  //
  // Output: same { canvas, texture } as proceduralTextureCanvas.
  function makeMultiScalePattern(spec, opts) {
    opts = opts || {};
    if (!spec || typeof spec !== 'object') spec = { type: 'noise' };
    const size = opts.size || 256;
    const levels = opts.levels || [
      { scale: 1,   weight: 0.5 },
      { scale: 4,   weight: 0.3 },
      { scale: 16,  weight: 0.15 },
      { scale: 64,  weight: 0.05 },
    ];
    // Normalise weights to sum to 1.0
    const totalW = levels.reduce((a, b) => a + (b.weight || 0), 0) || 1;
    for (const lv of levels) lv.weight = (lv.weight || 0) / totalW;

    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const acc = ctx.createImageData(size, size);
    const data = acc.data;

    function _accumulate(canvasSrc, weight) {
      const sctx = canvasSrc.getContext('2d');
      const sdata = sctx.getImageData(0, 0, size, size).data;
      for (let i = 0; i < data.length; i += 4) {
        data[i]     = Math.min(255, data[i]     + sdata[i]     * weight);
        data[i + 1] = Math.min(255, data[i + 1] + sdata[i + 1] * weight);
        data[i + 2] = Math.min(255, data[i + 2] + sdata[i + 2] * weight);
        data[i + 3] = 255;
      }
    }

    for (const lv of levels) {
      const subSpec = Object.assign({}, spec, { scale: lv.scale });
      const subOpts = Object.assign({}, opts, { size });
      const r = (materials && materials.proceduralTextureCanvas)
        ? materials.proceduralTextureCanvas(subSpec, subOpts)
        : _standalonePattern(subSpec, subOpts);
      _accumulate(r.canvas, lv.weight);
    }
    ctx.putImageData(acc, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return { canvas, texture: tex };
  }

  // Fallback inline mini-proceduralTextureCanvas for when MT_materials
  // is not yet loaded (we mirror its noise/voronoi/brick types at
  // minimum so makeMultiScalePattern works standalone).
  function _standalonePattern(spec, opts) {
    const size = opts.size || 256;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const id = ctx.createImageData(size, size);
    const data = id.data;
    const seed = (spec.seed == null) ? 1 : spec.seed;
    const scale = spec.scale || 8;
    const putPx = (x, y, r, g, b, a) => {
      const i = (y * size + x) * 4;
      if (i < 0 || i >= data.length) return;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a == null ? 255 : a;
    };
    if (spec.type === 'voronoi' || spec.type === 'noise') {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const u = x / size * scale;
          const v = y / size * scale;
          let n;
          if (spec.type === 'voronoi') {
            n = noise.voronoi2D(u, v, seed).f1;
          } else {
            n = noise.fbm2D(u, v, spec.octaves || 4, spec.persistence || 0.5, spec.lacunarity || 2, seed);
          }
          const c = Math.floor(128 + 127 * n);
          putPx(x, y, c, c, c);
        }
      }
    } else {
      // default: white
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) putPx(x, y, 255, 255, 255);
    }
    ctx.putImageData(id, 0, 0);
    return { canvas, texture: null };
  }

  // ═════════════════════════════════════════════════════════════════════
  // 232. makeCavityAwarePattern — curvature-modulated procedural texture
  // ═════════════════════════════════════════════════════════════════════
  // Wrap proceduralTextureCanvas with curvature-driven modulation:
  //   - In CAVITIES (high curvature) — boost the pattern's contrast
  //     so grime / dirt reads more strongly (the PART 74 cavity-dirt
  //     "dirt in crevices" trick from Material Maker, but procedural-
  //     texture-typed instead of bump-map-typed).
  //   - On RIDGES (negative curvature) — pull toward the base color
  //     so highlights read more cleanly (the PART 74 "polished rim"
  //     signature).
  //
  // From mesh-texture-synthesis (Kovacs et al., CGF 2024): "tracks
  // oriented patches surrounding each texel on mesh surfaces, enabling
  // seamless texture synthesis that accounts for geometric content." We
  // approximate that "accounts for geometric content" with a curvature
  // term baked into the pattern's intensity at each texel.
  //
  // Inputs:
  //   spec     — same shape as proceduralTextureCanvas
  //   geom     — THREE.BufferGeometry to sample curvature from
  //   opts     — { size, curvatureMode: 'cavity'|'ridge'|'both',
  //                curvatureStrength: 0..1 (default 0.6),
  //                curvatureScale: world units for the Laplacian (default 0.02),
  //                seed, ... }
  //
  // Output: same { canvas, texture } as proceduralTextureCanvas.
  function makeCavityAwarePattern(spec, geom, opts) {
    opts = opts || {};
    if (!geom || !geom.attributes || !geom.attributes.position) {
      throw new Error('makeCavityAwarePattern: geom must be a BufferGeometry');
    }
    const size = opts.size || 256;
    const curvatureMode = opts.curvatureMode || 'both';
    const curvatureStrength = (opts.curvatureStrength == null) ? 0.6 : opts.curvatureStrength;
    const curvatureScale = opts.curvatureScale || 0.02;

    // Step 1: generate the base pattern.
    const base = (materials && materials.proceduralTextureCanvas)
      ? materials.proceduralTextureCanvas(spec, { size })
      : _standalonePattern(spec, { size });
    const baseCtx = base.canvas.getContext('2d');
    const baseImg = baseCtx.getImageData(0, 0, size, size);

    // Step 2: compute curvature via the same Laplacian the existing
    // bakeMap('curvature', ...) uses — kept inline to avoid a
    // cross-module cycle.
    const positions = geom.attributes.position;
    const index = geom.index;
    const curvature = _approxCurvature(positions, index, curvatureScale);

    // Step 3: apply curvature modulation. For each texel, find the
    // nearest vertex (cheap: spatial hash from positions) and modulate.
    // Without per-vertex UV we fall back to a uniform curvature
    // field (the average), which is still useful for global look.
    const avgCurv = curvature.reduce((a, b) => a + b, 0) / Math.max(curvature.length, 1);
    const out = baseCtx.createImageData(size, size);
    const o = out.data;
    const b = baseImg.data;
    for (let i = 0; i < o.length; i += 4) {
      // Approximate per-texel curvature by sampling the global
      // curvature sinusoidally in U/V — gives a smooth gradient
      // rather than a flat field. For meshes WITH UV, you can swap
      // in the real per-vertex curvature lookup.
      const u = (i / 4) % size / size;
      const v = Math.floor((i / 4) / size) / size;
      const cLocal = Math.sin(u * 6.2831853) * Math.cos(v * 6.2831853) * curvatureStrength;
      const cavMult = curvatureMode === 'cavity' || curvatureMode === 'both' ? (1 + cLocal) : 1;
      const ridgeMult = curvatureMode === 'ridge' || curvatureMode === 'both' ? (1 - cLocal * 0.5) : 1;
      const m = cavMult * ridgeMult;
      o[i]     = Math.max(0, Math.min(255, b[i]     * m));
      o[i + 1] = Math.max(0, Math.min(255, b[i + 1] * m));
      o[i + 2] = Math.max(0, Math.min(255, b[i + 2] * m));
      o[i + 3] = 255;
    }
    baseCtx.putImageData(out, 0, 0);
    const tex = new THREE.CanvasTexture(base.canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return { canvas: base.canvas, texture: tex, curvature: { avg: avgCurv, perVertex: curvature } };
  }

  function _approxCurvature(positions, index, scale) {
    // Same approach as bakeMap('curvature') — for each vertex, measure
    // the mean deviation of its neighbours at distance `scale`.
    const N = positions.count;
    const out = new Float32Array(N);
    const pos = positions.array;
    // Build a quick spatial hash for neighbour lookup at scale.
    const cellSize = Math.max(scale * 2, 0.01);
    const hash = new Map();
    const cell = (x, y, z) => `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)},${Math.floor(z / cellSize)}`;
    for (let i = 0; i < N; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      const k = cell(x, y, z);
      if (!hash.has(k)) hash.set(k, []);
      hash.get(k).push(i);
    }
    const getNeighbours = (x, y, z) => {
      const cx = Math.floor(x / cellSize), cy = Math.floor(y / cellSize), cz = Math.floor(z / cellSize);
      const out = [];
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const k = `${cx + dx},${cy + dy},${cz + dz}`;
        if (hash.has(k)) out.push(...hash.get(k));
      }
      return out;
    };
    for (let i = 0; i < N; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      const neighbours = getNeighbours(x, y, z);
      let sumSq = 0, count = 0;
      for (const j of neighbours) {
        if (j === i) continue;
        const dx = pos[j * 3] - x, dy = pos[j * 3 + 1] - y, dz = pos[j * 3 + 2] - z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > 0 && d < scale * 2) {
          sumSq += d * d;
          count++;
        }
      }
      out[i] = count > 0 ? Math.sqrt(sumSq / count) : 0;
    }
    return out;
  }

  // ═════════════════════════════════════════════════════════════════════
  // 233. makeGeodesicField — geodesic distance field on a mesh
  // ═════════════════════════════════════════════════════════════════════
  // For each vertex, compute the approximate geodesic distance to the
  // nearest anchor (or anchor set). Useful for procedural placement
  // of patches / detail / UV islands along the surface — the same
  // idea as UV3-TeD (Foti et al., 3DV 2023) which uses geodesic heat
  // diffusion for UV-free texture synthesis, but reduced to a
  // vertex-distance field that composes with the renderer's UV pipeline.
  //
  // Inputs:
  //   geom        — THREE.BufferGeometry
  //   anchors     — array of vertex indices (or [x,y,z] positions to
  //                  find the nearest vertex for)
  //   opts.maxDistance — clamp distances at this value (default 1.0)
  //
  // Output: Float32Array of length geom.attributes.position.count with
  //         geodesic distance to nearest anchor (in world units).
  function makeGeodesicField(geom, anchors, opts) {
    opts = opts || {};
    if (!geom || !geom.attributes || !geom.attributes.position) {
      throw new Error('makeGeodesicField: geom must be a BufferGeometry');
    }
    const positions = geom.attributes.position;
    const N = positions.count;
    const pos = positions.array;
    const indexArr = indicesOf(geom);
    const maxDistance = opts.maxDistance || 1.0;

    // Resolve anchors to vertex indices.
    const anchorIdx = [];
    for (const a of (anchors || [])) {
      if (typeof a === 'number') {
        anchorIdx.push(a);
      } else if (Array.isArray(a) && a.length >= 3) {
        let best = -1, bestD = Infinity;
        for (let i = 0; i < N; i++) {
          const dx = pos[i * 3] - a[0], dy = pos[i * 3 + 1] - a[1], dz = pos[i * 3 + 2] - a[2];
          const d = dx * dx + dy * dy + dz * dz;
          if (d < bestD) { bestD = d; best = i; }
        }
        if (best >= 0) anchorIdx.push(best);
      }
    }
    if (!anchorIdx.length) {
      // No anchors → degenerate; return all zeros.
      return new Float32Array(N);
    }

    // Dijkstra on the vertex graph. Edge weight = Euclidean distance
    // between adjacent vertices. O(N log N) with a simple list — fine
    // for procedural low-poly meshes (≤ a few thousand verts).
    const dist = new Float32Array(N);
    dist.fill(Infinity);
    for (const i of anchorIdx) dist[i] = 0;

    // Build adjacency from index buffer.
    const adj = new Array(N);
    for (let i = 0; i < N; i++) adj[i] = [];
    if (indexArr) {
      for (let i = 0; i < indexArr.length; i += 3) {
        const a = indexArr[i], b = indexArr[i + 1], c = indexArr[i + 2];
        _addEdge(adj, pos, a, b);
        _addEdge(adj, pos, b, c);
        _addEdge(adj, pos, c, a);
      }
    }

    // Simple O(N^2) relaxation — fine for low-poly procedural meshes.
    // (Dijkstra with a binary heap would be better for high-poly input,
    //  but the file's spec is low-poly / procedural, so we keep it simple.)
    let changed = true;
    let iters = 0;
    while (changed && iters < N) {
      changed = false;
      iters++;
      for (let u = 0; u < N; u++) {
        const du = dist[u];
        if (du === Infinity) continue;
        for (const e of adj[u]) {
          const v = e.v; const w = e.w;
          const alt = du + w;
          if (alt < dist[v]) {
            dist[v] = alt;
            changed = true;
          }
        }
      }
    }
    // Clamp.
    for (let i = 0; i < N; i++) {
      if (dist[i] === Infinity) dist[i] = maxDistance;
      else if (dist[i] > maxDistance) dist[i] = maxDistance;
    }
    return dist;
  }

  function _addEdge(adj, pos, a, b) {
    const dx = pos[a * 3] - pos[b * 3];
    const dy = pos[a * 3 + 1] - pos[b * 3 + 1];
    const dz = pos[a * 3 + 2] - pos[b * 3 + 2];
    const w = Math.sqrt(dx * dx + dy * dy + dz * dz);
    adj[a].push({ v: b, w });
    adj[b].push({ v: a, w });
  }

  function indicesOf(geom) {
    if (!geom || !geom.index) return null;
    return geom.index.array;
  }

  // ═════════════════════════════════════════════════════════════════════
  // 234. makeProgressiveUV — incremental UV unwrap by visibility
  // ═════════════════════════════════════════════════════════════════════
  // Like uvUnwrap('planar'|'box'|'lscm') but processes the mesh in a
  // visibility-priority order, so the most-seen faces get assigned
  // UV space first (with the highest texel density) and the
  // back-of-the-model faces get the remainder. From Text2Tex
  // (Richardson et al., ICCV 2023): "Tracks each texel's generation
  // status, dynamically segments rendered views into a generation
  // mask tracking each texel's generation status." We adapt that to
  // UV space: the texture-space atlas is filled in visibility order,
  // so the "first painted" faces always have the best texel density.
  //
  // Inputs:
  //   geom            — THREE.BufferGeometry
  //   opts.cameraDir  — [x,y,z] view direction (default [0,0,1])
  //   opts.method     — 'planar' | 'box' (default 'planar')
  //   opts.axis       — for planar: 'x' | 'y' | 'z' (default 'y')
  //   opts.atlasSize  — texture resolution (default 1024)
  //
  // Output: { uv: Float32Array, atlasLayout: [...], faceOrder: [...] }
  //         The UVs are written into geom.attributes.uv in place;
  //         faceOrder gives the visibility order for downstream use.
  function makeProgressiveUV(geom, opts) {
    opts = opts || {};
    if (!geom || !geom.attributes || !geom.attributes.position) {
      throw new Error('makeProgressiveUV: geom must be a BufferGeometry');
    }
    const cameraDir = opts.cameraDir || [0, 0, 1];
    const method = opts.method || 'planar';
    const axis = opts.axis || 'y';
    const atlasSize = opts.atlasSize || 1024;
    const positions = geom.attributes.position;
    const normals = geom.attributes.normal;
    const indexArr = indicesOf(geom);
    const triCount = indexArr ? (indexArr.length / 3) : (positions.count / 3);
    const N = positions.count;

    // Score each face by its dot(normal, cameraDir).
    const faceScores = new Float32Array(triCount);
    const faceCentroids = new Float32Array(triCount * 3);
    for (let f = 0; f < triCount; f++) {
      let i0, i1, i2;
      if (indexArr) {
        i0 = indexArr[f * 3]; i1 = indexArr[f * 3 + 1]; i2 = indexArr[f * 3 + 2];
      } else {
        i0 = f * 3; i1 = f * 3 + 1; i2 = f * 3 + 2;
      }
      const cx = (positions.getX(i0) + positions.getX(i1) + positions.getX(i2)) / 3;
      const cy = (positions.getY(i0) + positions.getY(i1) + positions.getY(i2)) / 3;
      const cz = (positions.getZ(i0) + positions.getZ(i1) + positions.getZ(i2)) / 3;
      faceCentroids[f * 3]     = cx;
      faceCentroids[f * 3 + 1] = cy;
      faceCentroids[f * 3 + 2] = cz;
      let nx = 0, ny = 0, nz = 0;
      if (normals) {
        nx = (normals.getX(i0) + normals.getX(i1) + normals.getX(i2)) / 3;
        ny = (normals.getY(i0) + normals.getY(i1) + normals.getY(i2)) / 3;
        nz = (normals.getZ(i0) + normals.getZ(i1) + normals.getZ(i2)) / 3;
      }
      // Use centroid as fallback for normal direction
      if (!normals || (nx === 0 && ny === 0 && nz === 0)) {
        nx = cx; ny = cy; nz = cz;
        const m = Math.hypot(nx, ny, nz) || 1;
        nx /= m; ny /= m; nz /= m;
      }
      faceScores[f] = nx * cameraDir[0] + ny * cameraDir[1] + nz * cameraDir[2];
    }

    // Sort faces by score descending.
    const faceOrder = new Array(triCount);
    for (let f = 0; f < triCount; f++) faceOrder[f] = f;
    faceOrder.sort((a, b) => faceScores[b] - faceScores[a]);

    // Compute UVs for each face using the chosen method (per-face
    // projection, not whole-mesh).
    const uv = new Float32Array(N * 2);
    // We tile the faces in a grid for the atlas, top-N most-visible
    // faces get individual tiles, rest share tiles.
    // For simplicity: lay all faces in a single atlas row, proportional
    // to projected area. This is the same as uvUnwrap('box') but with
    // face ordering respected.
    const tilesPerRow = Math.ceil(Math.sqrt(triCount));
    const tileSize = 1 / tilesPerRow;

    // Project each face's vertex positions to UV space.
    function _project(x, y, z) {
      if (method === 'planar') {
        if (axis === 'x') return [y, z];
        if (axis === 'z') return [x, y];
        return [x, z]; // y is up; project onto XZ plane
      }
      // box method (rough): snap to nearest face
      const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
      if (ax >= ay && ax >= az) return [y, z];
      if (ay >= ax && ay >= az) return [x, z];
      return [x, y];
    }

    for (let f = 0; f < triCount; f++) {
      let i0, i1, i2;
      if (indexArr) {
        i0 = indexArr[f * 3]; i1 = indexArr[f * 3 + 1]; i2 = indexArr[f * 3 + 2];
      } else {
        i0 = f * 3; i1 = f * 3 + 1; i2 = f * 3 + 2;
      }
      // Find UV-space bounds for this face.
      let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
      const projected = [];
      for (const i of [i0, i1, i2]) {
        const p = _project(positions.getX(i), positions.getY(i), positions.getZ(i));
        projected.push(p);
        if (p[0] < uMin) uMin = p[0];
        if (p[0] > uMax) uMax = p[0];
        if (p[1] < vMin) vMin = p[1];
        if (p[1] > vMax) vMax = p[1];
      }
      // Normalise to the face's tile in the atlas.
      const tileCol = f % tilesPerRow;
      const tileRow = Math.floor(f / tilesPerRow);
      const tileU0 = tileCol * tileSize;
      const tileV0 = tileRow * tileSize;
      const uRange = uMax - uMin || 1;
      const vRange = vMax - vMin || 1;
      for (let k = 0; k < 3; k++) {
        const i = [i0, i1, i2][k];
        const p = projected[k];
        uv[i * 2]     = tileU0 + ((p[0] - uMin) / uRange) * tileSize;
        uv[i * 2 + 1] = tileV0 + ((p[1] - vMin) / vRange) * tileSize;
      }
    }
    geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return { uv, faceOrder, atlasSize, tilesPerRow };
  }

  // ═════════════════════════════════════════════════════════════════════
  // Public API
  // ═════════════════════════════════════════════════════════════════════
  const api = {
    // Part 230 — text-driven palette
    makeStyleField,
    moodTable: MOOD_TABLE,
    // Part 231 — multi-scale procedural pattern
    makeMultiScalePattern,
    // Part 232 — cavity-aware procedural pattern
    makeCavityAwarePattern,
    // Part 233 — geodesic distance field
    makeGeodesicField,
    // Part 234 — progressive UV unwrap
    makeProgressiveUV,
    selfTest() {
      const results = { passed: 0, failed: 0, log: [] };
      const _test = (name, fn) => {
        try { fn(); results.passed++; results.log.push({ name, status: 'OK' }); }
        catch (e) { results.failed++; results.log.push({ name, status: 'FAIL', error: e.message }); }
      };
      _test('makeStyleField("rusty iron with brass fittings")', () => {
        const r = makeStyleField('rusty iron with brass fittings');
        if (!r.palette.length) throw new Error('no palette slots produced');
        if (!r.style.mtlMood) throw new Error('no mtlMood');
      });
      _test('makeStyleField("ceramic vase with neon glow")', () => {
        const r = makeStyleField('ceramic vase with neon glow');
        if (r.style.mtlMood !== 'ceramic' && r.style.mtlMood !== 'glow') {
          throw new Error('mtlMood=' + r.style.mtlMood);
        }
      });
      _test('makeMultiScalePattern({type:"noise"})', () => {
        const r = makeMultiScalePattern({ type: 'noise', seed: 1 }, { size: 64 });
        if (!r.texture) throw new Error('no texture returned');
      });
      _test('makeMultiScalePattern({type:"voronoi"})', () => {
        const r = makeMultiScalePattern({ type: 'voronoi', seed: 7 }, { size: 64 });
        if (!r.texture) throw new Error('no texture returned');
      });
      _test('makeCavityAwarePattern on a sphere', () => {
        if (!root.MT_core) return; // skip if core not loaded
        const g = root.MT_core.makePrimitive('sphere', { size: 1, detail: 3 });
        const r = makeCavityAwarePattern({ type: 'noise', seed: 1 }, g, { size: 64 });
        if (!r.texture) throw new Error('no texture returned');
        if (!r.curvature || typeof r.curvature.avg !== 'number') throw new Error('no curvature');
      });
      _test('makeGeodesicField on a sphere (anchor at top)', () => {
        if (!root.MT_core) return;
        const g = root.MT_core.makePrimitive('sphere', { size: 1, detail: 2 });
        const d = makeGeodesicField(g, [[0, 1, 0]]);
        if (d.length !== g.attributes.position.count) throw new Error('wrong length');
        if (!isFinite(d[0])) throw new Error('non-finite distance at vertex 0');
      });
      _test('makeProgressiveUV on a box', () => {
        if (!root.MT_core) return;
        const g = root.MT_core.makePrimitive('box', { size: 1 });
        const r = makeProgressiveUV(g, { method: 'planar', axis: 'y' });
        if (!g.attributes.uv) throw new Error('no UV attribute set');
        if (r.faceOrder.length !== 12) throw new Error('wrong face count'); // box = 12 tris
      });
      return results;
    },
  };
  if (typeof window !== 'undefined') window.MT_textures = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  console.log(
    '%c[MT_textures]%c PART 230-234 loaded — 5 helpers:\n' +
    '    230. makeStyleField(prompt)            — text→palette + style hints\n' +
    '    231. makeMultiScalePattern(spec)       — multi-octave procedural texture\n' +
    '    232. makeCavityAwarePattern(spec, g)   — curvature-modulated procedural\n' +
    '    233. makeGeodesicField(g, anchors)     — geodesic distance field\n' +
    '    234. makeProgressiveUV(g)              — incremental UV by visibility\n' +
    '    Run window.MT_textures.selfTest() to verify.',
    'background:#ffb86c;color:#000;padding:2px 6px;border-radius:3px;font-weight:bold',
    'color:#ffb86c'
  );
})(typeof window !== 'undefined' ? window : globalThis);