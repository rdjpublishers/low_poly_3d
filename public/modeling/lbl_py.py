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

    def _push_object(self, o):
        """Mirror JS __pushObject() — apply group-stack mirrorFace, append."""
        if self._ctx["group_stack"]:
            top = self._ctx["group_stack"][-1]
            if isinstance(top, dict) and "mirrorFace" in top and "mirrorFace" not in o:
                o["mirrorFace"] = top["mirrorFace"]
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
                o[k] = self._ref(opts[k]) if k == "material" else opts[k]
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
            o["material"] = self._ref(opts["material"])
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
            o["material"] = self._ref(opts["material"])
        return self._push_object(o)

    def paint_rectangle(self, id, **opts):
        """Drop a flat textured quad on the selected face (or anywhere)."""
        o = {"id": id, "type": "quad"}
        o.update(self._resolve_on(opts))
        size = opts.get("size") or [1, 1]
        o["scale"] = [size[0], size[1], 1]
        if "material" in opts:
            o["material"] = self._ref(opts["material"])
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
        """
        return {
            "meta": dict(self._ctx["meta"]),
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


# When this file is loaded standalone (e.g. from a Python REPL for
# testing), expose a singleton instance. When loaded by the renderer
# (via Pyodide's runPython on the inlined copy in index.html), the
# renderer registers its own instance in sys.modules['lbl'].
import sys
lbl = _LBLBuilder()
sys.modules['lbl'] = lbl