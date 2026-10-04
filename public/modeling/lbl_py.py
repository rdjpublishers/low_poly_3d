"""
lbl_py.py — LBL Python builder helper (mirrors the JS blueprint API).

This module is the Python counterpart to the builder API exposed to
JavaScript blueprint scripts in index.html. It is auto-injected by the
renderer when a .py file is loaded — every .py file can call `lbl.attach_box(...)`
etc. without an explicit import (the renderer adds `lbl` to builtins on
the Python side before running the user code).

The renderer ships the source of this file inlined into index.html
(see `LBL_PY_HELPER_SRC` in the Python section) so the first .py load
needs no extra network round-trip. The version in this file is the
canonical readable source; the inlined copy is byte-identical and is
the one that actually runs. If you change one, change the other.

The builder API is intentionally small — it matches the JS API in
index.html's `runJsBlueprint()` so authors can move between the two
formats without rewriting their model code.

Public surface
==============

  Metadata
    lbl.name(s)                       — set the blueprint's meta.name
    lbl.define_palette(d)             — merge a dict of material defs

  Primitive attachment (each appends one object to the blueprint)
    lbl.create_anchor(id, **opts)     — drop a free point in space
    lbl.attach_box(id, **opts)        — box primitive (frustum)
    lbl.attach_cylinder(id, **opts)   — cylinder primitive
    lbl.attach_chain(id, **opts)      — chain of cylinders along keypoints
    lbl.paint_rectangle(id, **opts)   — flat textured quad

  Modifiers
    lbl.hollow(id, **opts)            — append a "hollow" operation to an
                                         already-attached object
    lbl.group(name, opts=None, fn)    — run fn() inside a mirrored group

  Snapshots
    lbl.blueprint()                   — snapshot the current builder
                                         context into a {meta, materials,
                                         objects} dict ready for the
                                         renderer to consume
    lbl.reset()                       — clear the context (called
                                         automatically between runs)

The JS path passes the same operations through to the renderer; the
Python path is a thin wrapper that produces the same dict shape, so
both formats feed the same downstream pipeline.
"""


class _LBLBuilder:
    """Module-style helper — registered in sys.modules as 'lbl' by the renderer."""

    def __init__(self):
        # Each instance gets a fresh context so multiple factories don't
        # share state across runs. Same shape as the JS __builderCtx.
        # We use "palette" (matching the JSON pipeline's wire format) so
        # the dict returned by blueprint() can be fed straight into
        # buildScene() without any transformation.
        self._ctx = {"meta": {}, "palette": {}, "objects": [], "group_stack": []}

    def _resolve_on(self, opts, keys=("on", "in", "place")):
        """Mirror JS __resolveOn() — pluck attach-point fields from opts.

        The JS builder accepts `on=...` / `in=...` / `place=...` to position
        a child relative to an anchor. Python accepts the same kwargs.
        """
        if not isinstance(opts, dict):
            return {}
        out = {}
        for k in keys:
            v = opts.get(k)
            if v is None:
                continue
            if isinstance(v, (list, tuple)) and len(v) == 3:
                out.setdefault("position", list(v))
            elif isinstance(v, dict):
                for vk, vv in v.items():
                    out.setdefault(vk, vv)
            elif isinstance(v, str):
                out.setdefault("on", v)
        return out

    def _rotation_from_aim(self, aim):
        """Mirror JS __rotationFromAim() — accept ['+x','-y','+z'] or similar.

        Returns a 3-tuple of rotation Euler angles in radians, or None if
        the aim string is unrecognised.
        """
        if not isinstance(aim, str):
            return None
        axis_to_idx = {"x": 0, "y": 1, "z": 2}
        sign = -1 if aim.startswith("-") else 1
        axis = aim[-1].lower()
        if axis not in axis_to_idx:
            return None
        rot = [0.0, 0.0, 0.0]
        rot[axis_to_idx[axis]] = sign * 1.5707963267948966  # pi/2
        return rot

    def _ref(self, name):
        """Wrap a palette name in the JSON-spec '$name' reference syntax.

        The JSON blueprint pipeline uses "material": "$shell" to reference
        the palette entry "shell". Bare strings like "material": "shell"
        are treated as material-defining dicts and warned-about by the
        validator. This helper adds the "$" prefix when needed so the
        Python-side API stays clean (lbl.attach_box(material="shell"))
        while the wire format matches what the JSON pipeline expects.

        Idempotent: if the name already starts with "$", it's returned
        unchanged. Non-string values (dict material defs, etc.) are
        returned unchanged.
        """
        if isinstance(name, str) and not name.startswith("$"):
            return "$" + name
        return name

    def _apply_palette_material(self, o):
        """Resolve palette material dict into the object's fields.

        Mirror of the JS path's __applyPaletteMaterial() (search
        __applyPaletteMaterial in index.html for the full rationale).

        When you do:
            lbl.define_palette({"shell": {"color": "#f5821b", "roughness": 0.55}})
            lbl.attach_box("body", material="shell")

        the JS path copies {"color": ..., "roughness": ...} onto the
        object as baseColor / roughness / metalness / etc., and resets
        `o["material"]` to the recognised built-in "default" preset.

        Why? Because applyPalette() (the JSON pipeline's $-ref resolver)
        is a string-only substitution — if the palette value is a dict,
        applyPalette() inlines the dict directly, breaking the schema
        validator's `typeof === 'string'` assertion. Doing the resolution
        at attach-time (this function) keeps the wire format validator-
        clean.

        Idempotent: if "material" is already a non-palette-key string,
        or if the palette key doesn't exist, the object is left as-is.
        """
        m = o.get("material")
        if isinstance(m, str) and not m.startswith("$"):
            pal = self._ctx.get("palette", {})
            defn = pal.get(m)
            if isinstance(defn, dict):
                # Copy each palette field onto the object (if not already set).
                if defn.get("color") is not None and o.get("baseColor") is None and o.get("color") is None:
                    o["baseColor"] = defn["color"]
                if defn.get("roughness") is not None and o.get("roughness") is None:
                    o["roughness"] = defn["roughness"]
                if defn.get("metalness") is not None and o.get("metalness") is None:
                    o["metalness"] = defn["metalness"]
                if defn.get("opacity") is not None and o.get("opacity") is None:
                    o["opacity"] = defn["opacity"]
                if defn.get("emissive") is not None and o.get("emissive") is None:
                    o["emissive"] = defn["emissive"]
                if defn.get("emissiveIntensity") is not None and o.get("emissiveIntensity") is None:
                    o["emissiveIntensity"] = defn["emissiveIntensity"]
                # The schema validator requires "material" to be a string from
                # the known-materials set. The dict resolution is now baked
                # into the object's own fields, so we set "default" so the
                # validator doesn't warn about an unrecognised material name.
                o["material"] = "default"

    def _push_object(self, o):
        """Mirror JS __pushObject() — apply group-stack mirrorFace, append."""
        if self._ctx["group_stack"]:
            top = self._ctx["group_stack"][-1]
            if isinstance(top, dict) and "mirrorFace" in top and "mirrorFace" not in o:
                o["mirrorFace"] = top["mirrorFace"]
        # Resolve palette dict into object fields (mirror JS __applyPaletteMaterial).
        # Done only if the user passed a bare name (no '$' prefix); $-refs are
        # left for applyPalette() in the JSON pipeline.
        m = o.get("material")
        if isinstance(m, str) and not m.startswith("$"):
            self._apply_palette_material(o)
        self._ctx["objects"].append(o)
        return o

    def name(self, s):
        """Set the blueprint's meta.name."""
        self._ctx["meta"]["name"] = s

    def define_palette(self, defs):
        """Merge a dict of material definitions into the palette.

        Each material is the same shape the JSON blueprint uses:
            {"color": "#ff6b35", "roughness": 0.55, "metalness": 0.05, ...}
        See Prompt_To_Py.txt PART 7 for the full material vocabulary.
        """
        if defs:
            self._ctx["palette"].update(defs)

    def create_anchor(self, id, **opts):
        """Drop a free anchor at a point in space.

        Useful for naming positions other parts can attach to:
            lbl.create_anchor("hand_left", position=(-0.6, 1.0, 0.2))
            lbl.attach_box("sword_hilt", on="hand_left", length=0.3)
        """
        o = {"id": id, "type": "point"}
        o.update(self._resolve_on(opts))
        if "aim" in opts:
            o["aim"] = opts["aim"]
        return self._push_object(o)

    def attach_box(self, id, **opts):
        """Add a box primitive.

        Required: footprint_size=(width, depth), length=height.
        Optional: position=(x, y, z), rotation=(rx, ry, rz), aim='+x'/'-y'/...,
                  material='palette_id', mirrorFace='u'/'v', smoothing=0..1,
                  colorVariation=0..1, toneVariant=0..1, emissive=...,
                  emissiveIntensity=...
        """
        fp = opts.get("footprint_size") or opts.get("footprintSize") or [1, 1]
        if not isinstance(fp, (list, tuple)):
            fp = [fp, fp]
        o = {"id": id, "type": "frustum_box", "footprintSize": list(fp), "length": opts.get("length", 1)}
        o.update(self._resolve_on(opts))
        tip = opts.get("tip_size") or opts.get("tipSize")
        tip_ratio = opts.get("tip_ratio") or opts.get("tipRatio")
        if tip is not None:
            o["tipSize"] = list(tip) if isinstance(tip, (list, tuple)) else [tip, tip]
        elif tip_ratio is not None:
            if isinstance(tip_ratio, (list, tuple)):
                o["tipSize"] = [fp[0] * tip_ratio[0], fp[1] * tip_ratio[1]]
            else:
                o["tipSize"] = [fp[0] * tip_ratio, fp[1] * tip_ratio]
        if "aim" in opts:
            rot = self._rotation_from_aim(opts["aim"])
            if rot:
                o["rotation"] = rot
        elif "rotation" in opts:
            o["rotation"] = opts["rotation"]
        for k in ("material", "mirrorFace", "smoothing", "colorVariation",
                  "toneVariant", "emissive", "emissiveIntensity"):
            if k in opts:
                o[k] = opts[k]
        return self._push_object(o)

    def attach_cylinder(self, id, **opts):
        """Add a cylinder primitive.

        Required: radius=r, length=h (or height=h).
        Optional: segs=N (radial segments, default 16), position, rotation,
                  aim, material.
        """
        o = {
            "id": id,
            "type": "generated",
            "generator": "cylinder",
            "params": {
                "radius": opts.get("radius", 1),
                "height": opts.get("length", opts.get("height", 1)),
                "segs": opts.get("segs"),
            },
        }
        o.update(self._resolve_on(opts))
        if "aim" in opts:
            rot = self._rotation_from_aim(opts["aim"])
            if rot:
                o["rotation"] = rot
        elif "rotation" in opts:
            o["rotation"] = opts["rotation"]
        if "material" in opts:
            o["material"] = opts["material"]
        return self._push_object(o)

    def attach_chain(self, id, **opts):
        """Add a chain (sequence of cylinders between keypoints).

        Required: segments=[(x1,y1,z1), (x2,y2,z2), ...] OR base_radius=r.
        Optional: segs=N (radial segments per cylinder), material.
        """
        o = {
            "id": id,
            "type": "generated",
            "generator": "chain",
            "params": {
                "segments": opts.get("segments", []),
                "baseRadius": opts.get("base_radius", opts.get("baseRadius")),
                "segs": opts.get("segs"),
            },
        }
        o.update(self._resolve_on(opts))
        if "material" in opts:
            o["material"] = opts["material"]
        return self._push_object(o)

    def paint_rectangle(self, id, **opts):
        """Drop a flat textured quad on the selected face (or anywhere)."""
        o = {"id": id, "type": "quad"}
        o.update(self._resolve_on(opts))
        size = opts.get("size") or [1, 1]
        o["scale"] = [size[0], size[1], 1]
        if "material" in opts:
            o["material"] = opts["material"]
        return self._push_object(o)

    def hollow(self, id, **opts):
        """Append a "hollow" operation to a previously-attached object.

        Modifies the object in place — call it AFTER the matching
        attach_box/attach_cylinder call:
            lbl.attach_cylinder("tube", radius=0.5, length=2.0)
            lbl.hollow("tube", wall_thickness=0.05)
        """
        for o in self._ctx["objects"]:
            if o.get("id") == id:
                o.setdefault("operations", []).append({"type": "hollow", "params": opts or {}})
                return
        print("[hollow] no object with id", id, "— call attach_* for it first")

    def group(self, name_=None, opts=None, fn=None):
        """Run fn() inside a mirrored / grouped region.

        Every attach_* / create_anchor call made inside fn gets
        opts.mirrorFace added automatically, so the existing mirrorFace
        renderer feature produces the mirrored copy at render time. No
        manual object duplication happens here.
        """
        if callable(opts):
            fn = opts
            opts = None
        if callable(name_):
            fn = name_
            name_ = None
        self._ctx["group_stack"].append(opts or {})
        try:
            if fn is not None:
                fn()
        finally:
            self._ctx["group_stack"].pop()

    def blueprint(self):
        """Snapshot the current builder context into a blueprint dict.

        Returns:
            {"meta": {...}, "palette": {...}, "objects": [...]}

        The output shape matches the JSON blueprint pipeline's wire
        format (Prompt_To_Json.txt PART X) so the dict can be fed
        straight into buildScene() without any transformation.
        Material references in the objects (e.g. "material": "$shell")
        resolve against this "palette" key via the standard JSON
        pipeline's palette-substitution step.

        This is the value your factory should `return`. The renderer
        routes the dict through the existing buildScene() pipeline
        unchanged.

        Auto-injected meta defaults (silence common validator warnings):

          • meta.style       — "smooth-low-poly" (canonical PART 48.1;
                               the project default; overridable)
          • meta.category    — "prop" (canonical PART 49.1; safe
                               catch-all for unclassified objects;
                               overridable)
          • meta.proportions — the PART 49.1 proportion declaration
                               with sensible placeholders (W_over_H
                               and fill — the two fields the fidelity
                               gate grades even when nothing else is
                               declared)

        Why these specific defaults?

          v1.36 / v8.27 introduced the canonical 13-style vocabulary
          (Prompt_To_Ts.txt PART 48.1) and the canonical 11-category
          vocabulary (PART 49.1). The previous auto-injected values
          ("low-poly" and "general") were from an earlier draft and
          are NOT in either canonical list, so the validator
          immediately warned:

            ⚠ meta.style:"low-poly" is not one of the PART 48.1
              canonical styles …
            ⚠ meta.category:"general" is not one of PART 49.1's
              SUBJECT_CATEGORY values …

          Replacing them with canonical values silences the warnings
          while still letting the user override via lbl.name()'s meta
          kwargs, by editing blueprint()["meta"] before returning, or
          (for Style B THREE.Group returns) by setting
          g.userData.meta = { ... } — see Prompt_To_Py.txt PART 203.1.

        Style B note:

          If you return a THREE.Group instead of calling
          lbl.blueprint() (the Style B path — see PART 203), the same
          defaults are mirrored onto the group's userData.meta by the
          renderer, so the validator's PART 51.2 fidelity gate and
          PART 49.1 declaration checks still see them.
        """
        meta = dict(self._ctx["meta"])
        # Only fill in fields the user didn't already set.
        if "style" not in meta:
            # PART 48.1 canonical default — was "low-poly" pre-v1.36
            meta["style"] = "smooth-low-poly"
        if "category" not in meta:
            # PART 49.1 canonical default — was "general" pre-v1.36
            meta["category"] = "prop"
        if "proportions" not in meta:
            meta["proportions"] = {
                "W_over_H": 1.0,
                "fill":     0.85,
                # Other fields are opt-in — see Prompt_To_Py.txt PART 225
            }
        # The PART 49.1 / PART 51.2 fidelity gate requires both
        # meta.style and meta.category to be SET (not just canonical)
        # for grading to run. The two guards above already cover
        # that, but if a caller removed them and left meta empty,
        # we'd want the snapshot to fail loud rather than silently
        # produce a no-grade result. Re-check here at the very end
        # of the function as a belt-and-braces:
        assert "style" in meta and meta["style"], \
            "lbl.blueprint(): meta.style is empty after auto-injection — this is a bug"
        assert "category" in meta and meta["category"], \
            "lbl.blueprint(): meta.category is empty after auto-injection — this is a bug"
        return {
            "meta": meta,
            "palette": dict(self._ctx["palette"]),
            "objects": list(self._ctx["objects"]),
        }

    def reset(self):
        """Reset the builder context.

        Called automatically by the renderer between runs so leftover
        state from a previous script doesn't bleed into the next one.
        You don't normally need to call this yourself.
        """
        self._ctx["meta"].clear()
        self._ctx["palette"].clear()
        self._ctx["objects"].clear()
        self._ctx["group_stack"].clear()

    # ─────────────────────────────────────────────────────────────────────
    # PART 230-234 — Procedural Texture Extensions (Python side)
    # ─────────────────────────────────────────────────────────────────────
    # The JS side lives at public/modeling/mt-texture-extensions.js and
    # is loaded via the import map (`mt-texture-extensions`). These
    # Python methods are thin pass-throughs to the JS helpers — the
    # mood table and the deterministic procedural kernels stay in JS
    # so Style B (Three.js Direct) factories can also call them via
    # `from js import MT_textures; MT_textures.makeStyleField(...)`.
    #
    # Why the dual-surface: the Style A (lbl.*) users want a clean
    # Python API, but Style B users already use `from js import X` for
    # everything else, so they expect MT_textures to be reachable the
    # same way. We support both. The methods here just delegate.

    def style_field(self, prompt, **opts):
        """PART 230 — text prompt → palette + style hints.

        Thin wrapper around MT_textures.makeStyleField. Returns the
        same shape — `{ palette: [{name,color,roughness,metalness,...}],
        style: {mtlMood, glossLevel, emissiveLevel, matchedKeywords} }`.

        Example:
            sf = lbl.style_field("rusty iron with brass fittings")
            for entry in sf["palette"]:
                print(entry["name"], entry["color"], entry["roughness"])
            # → shell  #3a3d42 0.55
            # → metal  #b5965a 0.4
            # → accent #8b3a1a 0.85
            ...
        """
        from js import MT_textures  # auto-mirrored addon import
        return MT_textures.makeStyleField(prompt, opts)

    def multi_scale_pattern(self, spec, **opts):
        """PART 231 — multi-octave procedural texture.

        Same shape as proceduralTextureCanvas (PART 74.2) but stacks
        the same pattern at 1× / 4× / 16× / 64× scales with weighted
        blending. Inspired by geometric-textures (Hertz et al.,
        SIGGRAPH 2020).

        Returns { canvas, texture }. Use texture as a material's map.
        """
        from js import MT_textures
        return MT_textures.makeMultiScalePattern(spec, opts)

    def cavity_aware_pattern(self, spec, geom, **opts):
        """PART 232 — curvature-modulated procedural texture.

        Wraps proceduralTextureCanvas with curvature-driven intensity
        modulation. Cavities boost pattern contrast (dirt-in-crevices),
        ridges pull toward base color (polished rim). Inspired by
        mesh-texture-synthesis (Kovacs et al., CGF 2024).
        """
        from js import MT_textures
        return MT_textures.makeCavityAwarePattern(spec, geom, opts)

    def geodesic_field(self, geom, anchors, **opts):
        """PART 233 — geodesic distance field on a mesh.

        For each vertex, returns the approximate geodesic distance to
        the nearest anchor. Inspired by UV3-TeD (Foti et al., 3DV 2023)
        and Point-UV Diffusion (Yu et al., ICCV 2023).

        Returns a Float32Array (length = vertex count).
        """
        from js import MT_textures
        return MT_textures.makeGeodesicField(geom, anchors, opts)

    def progressive_uv(self, geom, **opts):
        """PART 234 — incremental UV unwrap by visibility.

        Like uvUnwrap, but processes the mesh in a visibility-priority
        order so the most-seen faces get assigned UV space first with
        the highest texel density. Inspired by Text2Tex (Richardson
        et al., ICCV 2023) which tracks each texel's generation status
        incrementally.

        Writes UVs into geom.attributes.uv in place. Returns
        { uv, faceOrder, atlasSize, tilesPerRow }.
        """
        from js import MT_textures
        return MT_textures.makeProgressiveUV(geom, opts)

    # ─────────────────────────────────────────────────────────────────────
    # PART 235-242 — High-poly / style-agnostic surface (Python side)
    # ─────────────────────────────────────────────────────────────────────
    # The JS side lives at public/modeling/mt-highpoly.js and is loaded
    # via the import map (`mt-highpoly`). These are thin pass-throughs to
    # the JS helpers — same pattern as PART 230-234. Together, the two
    # bundles let the renderer genuinely support BOTH low-poly (PART 100-
    # 143 / 145-152 / 167-189 / 230-234) AND high-poly (PART 235-242).
    #
    # Style-agnosticism: the renderer's auto-injected meta.style default
    # is still "smooth-low-poly" (matches the project name), but Python
    # factories that want high-poly override it on the returned blueprint
    # dict (Style A) or on g.userData.meta (Style B):

    def import_external_mesh(self, url, format=None, **opts):
        """PART 235 — load an OBJ/GLTF/FBX/STL/DAE mesh from URL.

        Returns a JS Promise; in Pyodide this can be awaited. Resolves
        to a THREE.Group with vertex normals / default materials
        applied if missing.

        Example:
            import asyncio
            g = await asyncio.ensure_future(
                lbl.import_external_mesh('https://example.com/model.glb')
            )
        """
        from js import MT_highpoly
        return MT_highpoly.importExternalMesh(url, format, opts)

    def make_atlas_uv(self, geom, **opts):
        """PART 236 — MaxRects BSSF atlas packing for high-poly meshes.

        Writes UVs into geom.attributes.uv in place. For high-poly
        meshes (1K+ faces), this is the right way to assign UVs —
        makeProgressiveUV (PART 234) is the visibility-priority
        shortcut for low-poly.
        """
        from js import MT_highpoly
        return MT_highpoly.makeAtlasUV(geom, opts)

    def fast_curvature(self, geom, **opts):
        """PART 237 — BVH-accelerated curvature for high-poly meshes.

        For meshes with 100K+ verts (photogrammetry scans), use this
        instead of MT_textures' O(N×27) spatial-hash version. Falls
        back to the spatial-hash version if MeshBVH isn't loaded.
        """
        from js import MT_highpoly
        return MT_highpoly.makeFastCurvature(geom, opts)

    def highpoly_pbr(self, **opts):
        """PART 238 — pbr-realistic material recipe.

        Convenience factory for MeshPhysicalMaterial with the
        canonical "realistic surface" defaults (roughness 0.45,
        metalness 0.05, clearcoat 0.3, envMapIntensity 1.0).
        """
        from js import MT_highpoly
        return MT_highpoly.highPolyPBR(opts)

    def photogrammetry_pbr(self, **opts):
        """PART 239 — photogrammetry material recipe.

        Matte (roughness 0.85) + strong normal-map response + low
        envMapIntensity — tuned for scanned real-world meshes with
        baked-in detail.
        """
        from js import MT_highpoly
        return MT_highpoly.photogrammetryPBR(opts)

    def subdivide_for_highpoly(self, geom, **opts):
        """PART 240 — boost low-poly toward high-poly via subdivision.

        Wraps Catmull-Clark. The result has ~4× verts per level.
        """
        from js import MT_highpoly
        return MT_highpoly.subdivideForHighPoly(geom, opts)

    def decimate_for_lowpoly(self, geom, **opts):
        """PART 241 — reduce high-poly to low-poly via QEM decimation.

        QEM preserves silhouette + topology better than uniform
        random downsample, so the chunky 3D look survives.
        """
        from js import MT_highpoly
        return MT_highpoly.decimateForLowPoly(geom, opts)

    def make_image_texture(self, url, **opts):
        """PART 242 — image URL → UV texture.

        Returns a THREE.CanvasTexture (Promise resolves once the image
        loads). For high-poly meshes with a real-world photograph
        or hand-painted texture.
        """
        from js import MT_highpoly
        return MT_highpoly.makeImageTexture(url, opts)


# When this file is loaded standalone (e.g. from a Python REPL for
# testing), expose a singleton instance. When loaded by the renderer
# (via Pyodide's runPython on the inlined copy in index.html), the
# renderer registers its own instance in sys.modules['lbl'].
import sys
lbl = _LBLBuilder()
sys.modules['lbl'] = lbl