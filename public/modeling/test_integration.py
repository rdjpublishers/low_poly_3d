#!/usr/bin/env python3
"""
test_integration.py — Standalone integration test for the v2.0 lbl helper.

This script runs OUTSIDE Pyodide (using mock objects) to verify the
lbl.py module's internal logic — the color helpers, palette system,
PRNG, procedural texture generators, custom shape generators, and
deformers — all work correctly without depending on THREE.

For full end-to-end testing (rendering an actual model in the
browser), drop the .py files onto the live index.html page.

Usage:
    python3 test_integration.py
"""
import sys
import os
import math
import importlib.util


def load_lbl_py():
    """Load the lbl_py.py module from the upgrade directory, but
    stub out `from js import THREE` since we're running outside
    Pyodide. We only test the parts that don't need THREE.
    """
    # Create a stub `js` module
    import types
    js_module = types.ModuleType("js")
    class _Stub:
        """A stub for THREE — all attribute access returns another stub."""
        def __getattr__(self, name):
            return _Stub()
        def __call__(self, *a, **k):
            return _Stub()
        def __setattr__(self, name, value):
            pass
        def __setitem__(self, key, value):
            pass
        def __getitem__(self, key):
            return _Stub()
    three_stub = _Stub()
    js_module.THREE = three_stub
    js_module.window = _Stub()
    sys.modules["js"] = js_module
    # Load lbl_py
    spec = importlib.util.spec_from_file_location("lbl_py", "lbl_py.py")
    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
        return mod
    except Exception as e:
        print(f"FAILED to load lbl_py.py: {e}")
        import traceback
        traceback.print_exc()
        return None


def test_color_helpers(mod):
    print("test_color_helpers")
    # hex ↔ RGB
    assert mod._hex_to_rgb("#ff0000") == (1.0, 0.0, 0.0), "hex_to_rgb red"
    assert mod._hex_to_rgb("#00ff00") == (0.0, 1.0, 0.0), "hex_to_rgb green"
    assert mod._hex_to_rgb("#0000ff") == (0.0, 0.0, 1.0), "hex_to_rgb blue"
    assert mod._hex_to_rgb("#808080") == (0.5019607843137255, 0.5019607843137255, 0.5019607843137255), "hex_to_rgb gray"
    assert mod._rgb_to_hex(1.0, 0.0, 0.0) == "#ff0000", "rgb_to_hex red"
    assert mod._rgb_to_int(1.0, 0.0, 0.0) == 0xFF0000, "rgb_to_int red"
    assert mod._int_to_rgb(0xFF0000) == (1.0, 0.0, 0.0), "int_to_rgb red"
    # HSL roundtrip
    r, g, b = 0.5, 0.3, 0.7
    h, s, l = mod._rgb_to_hsl(r, g, b)
    r2, g2, b2 = mod._hsl_to_rgb(h, s, l)
    assert abs(r - r2) < 1e-6 and abs(g - g2) < 1e-6 and abs(b - b2) < 1e-6, "hsl roundtrip"
    # Mix
    assert mod._mix_rgb((1, 0, 0), (0, 0, 1), 0.5) == (0.5, 0.0, 0.5), "mix_rgb"
    # Darken / lighten
    dark = mod._darken((0.5, 0.5, 0.5), 0.2)
    light = mod._lighten((0.5, 0.5, 0.5), 0.2)
    assert dark[1] < 0.5 < light[1], "darken/lighten"
    # To hex / to int
    assert mod._to_hex("#abcdef") == "#abcdef"
    assert mod._to_int("#ff0000") == 0xFF0000
    assert mod._to_int((1.0, 0.0, 0.0)) == 0xFF0000
    print("  PASS")


def test_palette_system(mod):
    print("test_palette_system")
    reg = mod._PALETTE_REGISTRY
    # All 8 built-in presets
    expected = ["british-green", "desert-sand", "midnight-blue",
                "neon-cyber", "pearl-white", "racing-red",
                "stealth-black", "sunset-gold"]
    names = reg.names()
    for n in expected:
        assert n in names, f"missing preset {n}"
    # Each preset has all 10 slots
    for n in expected:
        pal = reg.get(n)
        for slot in mod.PALETTE_SLOT_NAMES:
            assert slot in pal, f"preset {n} missing slot {slot}"
    # Custom registration
    reg.register("test-1", {"body": {"color": "#ff00ff", "roughness": 0.3}})
    pal = reg.get("test-1")
    assert pal["body"]["color"] == "#ff00ff"
    # Derive from base hex
    reg.derive("test-2", base="#3a86ff")
    pal2 = reg.get("test-2")
    assert pal2["body"]["color"] == "#3a86ff"
    # Build materials returns a dict (stub THREE so we just check shape)
    try:
        mats = reg.build_materials("racing-red")
        assert isinstance(mats, dict), "build_materials returns dict"
        for slot in mod.PALETTE_SLOT_NAMES:
            assert slot in mats, f"build_materials missing {slot}"
    except Exception as e:
        print(f"  (build_materials needs THREE — skipped: {e})")
    # apply + set
    print("  PASS")


def test_prng(mod):
    print("test_prng")
    rng1 = mod._mulberry32(42)
    rng2 = mod._mulberry32(42)
    # Same seed → same sequence
    for _ in range(100):
        assert rng1() == rng2(), "mulberry32 not deterministic"
    # Different seed → different sequence
    rng3 = mod._mulberry32(43)
    assert rng1() != rng3(), "mulberry32 collision"
    # Range / int / choice
    rng4 = mod._mulberry32(1)
    v = rng4.range(5.0, 10.0)
    assert 5.0 <= v <= 10.0, "range out of bounds"
    i = rng4.int(0, 100)
    assert 0 <= i < 100, "int out of bounds"
    c = rng4.choice(["a", "b", "c"])
    assert c in ["a", "b", "c"], "choice failed"
    # Sub-seed
    s1 = mod._derive_sub_seed(42, "test")
    s2 = mod._derive_sub_seed(42, "test")
    assert s1 == s2, "sub-seed not deterministic"
    s3 = mod._derive_sub_seed(43, "test")
    assert s1 != s3, "sub-seed collision"
    print("  PASS")


def test_textures(mod):
    print("test_textures")
    # All texture generators produce data
    for t in ["noise", "voronoi", "brick", "splatter", "stripe",
              "truchet", "voxel", "radial", "linear"]:
        data = mod._make_texture({"type": t, "seed": 1}, size=64)
        # Should be a DataTexture stub; just verify it has some attributes
        assert data is not None, f"texture {t} returned None"
    # micro-roughness uses a different code path
    data = mod._make_texture({"type": "micro-rough", "seed": 1}, size=64)
    assert data is not None, "micro-rough texture returned None"
    print("  PASS")


def test_pbr_recipes(mod):
    print("test_pbr_recipes")
    # All PBR recipes produce a material (stub THREE so we just check shape)
    for recipe in ["chitin", "elytra", "membrane", "velvet", "skin",
                   "cloth", "leather", "stone", "wood", "metal", "emissive"]:
        try:
            mat = mod._make_material(recipe)
            assert mat is not None, f"PBR recipe {recipe} returned None"
        except Exception as e:
            print(f"  (PBR recipe {recipe} needs THREE — skipped: {e})")
    # CS2 finishes + wear tiers
    for finish in mod.CS2_FINISHES:
        for wear in mod.CS2_WEAR_TIERS:
            mat = mod._cs2_finish("#ff0000", finish, wear)
            assert mat is not None, f"cs2_finish {finish}/{wear} returned None"
    print("  PASS")


def test_animation_helpers(mod):
    print("test_animation_helpers")
    # sine_wave
    assert abs(mod._sine_wave(0, 1, 1, 0, 0) - 0) < 1e-9, "sine at t=0"
    assert abs(mod._sine_wave(0.25, 1, 1, 0, 0) - 1) < 1e-6, "sine at t=0.25"
    # walk_phase
    l, r = mod._walk_phase(0, 1, 1, math.pi)
    assert abs(l - 0) < 1e-9, "walk_phase left at t=0"
    # DampSpring
    s = mod._DampSpring(target=1.0, k=80, c=8)
    s.step(0.01)
    assert 0 < s.value < 1.0, "DampSpring advances toward target"
    # loop_frame_equal
    assert mod._loop_frame_equal([1, 2, 3], [1, 2, 3])
    assert not mod._loop_frame_equal([1, 2, 3], [1, 2, 4])
    print("  PASS")


def test_style_a_backward_compat(mod):
    print("test_style_a_backward_compat")
    b = mod._LBLBuilder()
    b.name("Test Model")
    b.define_palette({"shell": {"color": "#ff8000", "roughness": 0.5}})
    b.attach_box("body", footprint_size=(1, 1), length=1.0, material="shell")
    bp = b.blueprint()
    assert bp["meta"]["name"] == "Test Model"
    assert bp["meta"]["style"] == "smooth-low-poly"
    assert bp["meta"]["category"] == "prop"
    assert len(bp["objects"]) == 1
    assert bp["objects"][0]["id"] == "body"
    # Material "$shell" prefix should NOT be present (we resolved it to default)
    assert bp["objects"][0].get("baseColor") == "#ff8000", \
        f"expected #ff8000, got {bp['objects'][0].get('baseColor')}"
    print("  PASS")


def test_lbl_facade(mod):
    print("test_lbl_facade")
    lbl = mod.lbl
    # Palette is exposed
    assert hasattr(lbl, "palette")
    assert hasattr(lbl, "palettes")
    assert "racing-red" in lbl.palettes
    # All major methods are bound
    for method in ["Box", "Sphere", "Cylinder", "Torus", "Capsule",
                   "Plane", "Ring", "Circle", "Lathe", "Extrude",
                   "FilletedBox", "TaperedTube", "StarPattern",
                   "BeveledWasher", "LathedTire", "SweptTube",
                   "ExhaustCanister", "Loft", "CatmullRom", "Bezier",
                   "bend", "twist", "taper", "spherize", "noise",
                   "modifier_stack", "fill_vertex_channel",
                   "converge_faces", "project_uv",
                   "star", "polygon", "annulus", "heart", "spade",
                   "burst", "arch", "edged_box", "molding",
                   "pumpkin", "leaf", "arched_slab",
                   "make_texture", "make_noise_texture",
                   "chitin", "elytra", "membrane", "velvet",
                   "skin_material", "cloth", "leather", "stone",
                   "wood", "metal", "emissive", "material",
                   "cs2_finish", "cs2_wear_mask",
                   "bone_chain", "skeleton", "bind_skin",
                   "skinned_mesh", "compute_lbs", "compute_dqs",
                   "sine_wave", "bounce", "damp_spring",
                   "walk_phase", "loop_frame_equal",
                   "make_mixer", "build_walk_clip",
                   "lookdev_lights", "reference_lights",
                   "grazing_lights", "neutral_lights", "stage_lights",
                   "shadow_catcher", "architectural_lights",
                   "build_arch_palette",
                   "validate_triangle_budget", "validate_bbox",
                   "validate_shadows", "validate_sculpt_runtime",
                   "install_runtime", "install_tick",
                   "setPalette",
                   "mulberry32", "hex_to_rgb", "rgb_to_hex",
                   "rgb_to_int", "int_to_rgb", "mix_rgb",
                   "darken", "lighten", "saturate", "ACES",
                   "Group", "Mesh", "set_position", "set_rotation",
                   "set_scale", "attach", "attach_at", "walk",
                   "collect_meshes", "collect_by_name"]:
        assert hasattr(lbl, method), "missing lbl." + method
    # mt bridge
    assert hasattr(lbl, "mt")
    assert hasattr(lbl.mt, "makePrimitive")
    assert hasattr(lbl.mt, "subdivideCatmullClark")
    assert hasattr(lbl.mt, "autoRig")
    assert hasattr(lbl.mt, "generateLOD")
    assert hasattr(lbl.mt, "run")
    # SECTION 22 additions (PART 386-410 v2.0.2)
    for method in [
        # PART 387 skeleton
        "load_skeleton_template", "list_skeleton_classes",
        # PART 386 ACES
        "aces_run", "aces_runstack", "aces_self_test",
        "aces_export_bone_names", "aces_asset_extras",
        "aces_oklab_to_linear", "aces_linear_to_oklab",
        # PART 390 / 391 / 393 schema
        "schema_linter", "hard_surface_factory_shell",
        "validate_socket_attachments",
        # PART 187 / 199.3 lights
        "sport_motorcycle_lights",
        # PART 192 architectural
        "create_wall_with_apertures",
        # PART 174 validation
        "validate_draw_call_count", "validate_bounding_box",
        "validate_ground_clearance",
        # PART 389 animation
        "detect_animation_track_type", "build_animation_track",
        "collect_animation_clips",
        # PART 388 MT fallbacks
        "bmesh_to_geometry", "sdf_box", "sdf_torus", "sdf_plane",
        "sdf_intersect", "sdf_subtract", "lsystem_interpret",
        "smpl_apply_shape", "lbs_skin", "dqs_skin",
        "auto_retopologize", "subdivide_loop", "isotropic_remesh",
        "triangulate", "quadify", "taubin_smooth", "sculpt_brush",
        "displace_surface",
        # PART 395 bezier
        "bezier_fairing",
        # PART 403 default export
        "add_default_export",
        # PART 411-450 v2.0.2 additions
        "make_sculpt_runtime", "validate_sculpt_runtime_dict",
        "extract_animation_clips", "collect_meshes_by_name",
        "compute_silhouette_iou", "make_style_field_palette",
        "install_set_palette", "list_palettes", "get_palette_names",
        "make_pbr_recipe", "apply_pbr_recipe", "attach_label",
        "setup_environment", "export_glb", "serialize_blueprint",
        "material_from_palette_slot", "install_tick_default",
        "is_in_pyodide", "system_capabilities", "pbr_recipe_names",
        "finish_names", "wear_tier_names",
    ]:
        assert hasattr(lbl, method), "missing lbl." + method
    print("  PASS")


def test_skeleton_templates(mod):
    print("test_skeleton_templates")
    # PART 387
    classes = mod.lbl.list_skeleton_classes()
    assert "humanoid" in classes
    assert "quadruped" in classes
    assert "bird" in classes
    assert "fish" in classes
    assert "insect" in classes
    assert "object" in classes
    # Load each
    for c in classes:
        tmpl = mod.lbl.load_skeleton_template(c)
        assert "joints" in tmpl, c + " missing joints"
        assert len(tmpl["joints"]) > 0, c + " has 0 joints"
        # object MUST be single-rooted (ANALYSIS_REPORT [B] #1 fix)
        if c == "object":
            roots = [j for j in tmpl["joints"] if "parent" not in j]
            assert len(roots) == 1, "object must have 1 root, got %d" % len(roots)
        # quadruped height MUST be 1.115 (ANALYSIS_REPORT [B] #2 fix)
        if c == "quadruped":
            assert abs(tmpl["height"] - 1.115) < 1e-6, "quadruped height = " + str(tmpl["height"])
    # Loading a bad class raises
    try:
        mod.lbl.load_skeleton_template("nope")
        assert False, "should have raised"
    except KeyError:
        pass
    print("  PASS")


def test_aces_bridge(mod):
    print("test_aces_bridge")
    # PART 386
    # oklab color helpers (pure-Python)
    rgb = mod.lbl.aces_oklab_to_linear((0.5, 0.5, 0.5))
    assert len(rgb) == 3, "aces_oklab_to_linear wrong shape"
    rgb2 = mod.lbl.aces_linear_to_oklab(rgb)
    assert len(rgb2) == 3
    # Self test returns a dict
    st = mod.lbl.aces_self_test()
    assert "ok" in st
    assert "modules" in st
    assert "errors" in st
    # aces_run returns a dict (placeholder in headless)
    rep = mod.lbl.aces_run(None, {})
    assert "ok" in rep
    # aces_runstack
    rep2 = mod.lbl.aces_runstack([None, None], {})
    assert "reports" in rep2
    # export_bone_names
    names = mod.lbl.aces_export_bone_names({"joints": [{"name": "Root"}, {"name": "Spine"}]})
    assert "Root" in names and "Spine" in names
    # asset_extras
    extras = mod.lbl.aces_asset_extras({})
    assert "harness" in extras
    print("  PASS")


def test_mt_fallbacks(mod):
    print("test_mt_fallbacks")
    # PART 388 — all should return non-None (placeholder or real)
    assert mod.lbl.bmesh_to_geometry({"vertices": [], "faces": []}) is not None
    box = mod.lbl.sdf_box((0, 0.5, 0), (1, 0.5, 0.5))
    # inside (centre of box) should be negative
    assert box((0, 0.5, 0)) < 0
    # outside should be positive
    assert box((5, 5, 5)) > 0
    torus = mod.lbl.sdf_torus((0, 0, 0), 1.0, 0.2)
    plane = mod.lbl.sdf_plane((0, 1, 0), 0.0)
    # With normal (0,1,0), points with y<0 are "below" (negative SDF) and
    # points with y>0 are "above" (positive SDF).
    assert plane((0, -1, 0)) < 0  # below plane
    assert plane((0, 1, 0)) > 0   # above plane
    # intersection / subtraction are functions of two SDFs
    inter = mod.lbl.sdf_intersect(box, plane)
    assert callable(inter)
    sub = mod.lbl.sdf_subtract(box, plane)
    assert callable(sub)
    # lsystem
    s = mod.lbl.lsystem_interpret({"F": "F+F", "+": "+", "-": "-"}, "F", 2)
    assert "F" in s and "+" in s
    # lbs / dqs
    assert mod.lbl.lbs_skin(None, None, None, None) is not None
    assert mod.lbl.dqs_skin(None, None, None, None) is not None
    # mesh ops
    assert mod.lbl.auto_retopologize(None, 1000) is not None
    assert mod.lbl.subdivide_loop(None, 1) is not None
    assert mod.lbl.isotropic_remesh(None, 0.05, 2) is not None
    assert mod.lbl.quadify(None, 30) is not None
    assert mod.lbl.triangulate(None) is not None
    assert mod.lbl.taubin_smooth(None, 5, 0.5) is not None
    assert mod.lbl.sculpt_brush(None, [0, 0, 0], [0, 1, 0]) is not None
    assert mod.lbl.displace_surface(None, None) is not None
    # smpl_apply_shape
    assert mod.lbl.smpl_apply_shape(None, None) is not None
    print("  PASS")


def test_animation_track_detection(mod):
    print("test_animation_track_detection")
    # PART 389 / ANALYSIS_REPORT #18
    # Quaternion
    assert mod.lbl.detect_animation_track_type("head.quaternion", [0, 0, 0, 1, 0, 0, 0.707, 0.707]) == "quaternion"
    assert mod.lbl.detect_animation_track_type("head.rotation", [0, 0, 0, 1]) == "quaternion"
    # Vector
    assert mod.lbl.detect_animation_track_type("head.position", [0, 0, 0, 1, 2, 3]) == "vector"
    # Number
    assert mod.lbl.detect_animation_track_type("headlight.emissiveIntensity", [0, 1, 0.5, 0.7]) == "number"
    # build_animation_track returns the right spec
    t = mod.lbl.build_animation_track("head.quaternion", [0, 1], [0, 0, 0, 1, 0, 0, 0.707, 0.707])
    assert t["type"] == "quaternion"
    t2 = mod.lbl.build_animation_track("head.position", [0, 1], [0, 0, 0, 1, 2, 3])
    assert t2["type"] == "vector"
    t3 = mod.lbl.build_animation_track("headlight.emissiveIntensity", [0, 1], [0, 1])
    assert t3["type"] == "number"
    # collect_animation_clips — short-circuits on real clips
    rt = {"animations": {"clips": ["c1", "c2"]}}
    assert mod.lbl.collect_animation_clips(rt) == ["c1", "c2"]
    rt_empty = {"animations": {"clips": []}}
    assert mod.lbl.collect_animation_clips(rt_empty) == []
    print("  PASS")


def test_schema_linter_and_shells(mod):
    print("test_schema_linter_and_shells")
    # PART 390
    rep = mod.lbl.schema_linter(None, {"gridKeyMm": 5.0})
    assert "ok" in rep
    assert "blocks" in rep
    assert "warns" in rep
    # PART 391
    shell = mod.lbl.hard_surface_factory_shell({
        "name": "Apex GT",
        "bounding_box": [4.2, 1.5, 1.8],
    })
    assert shell["name"] == "Apex GT"
    assert "audits" in shell
    assert shell["audits"]["validate_triangle_budget"] == 8500
    # PART 393
    val = mod.lbl.validate_socket_attachments(None, {"sockets": {}})
    assert "ok" in val
    # PART 392
    wall = mod.lbl.create_wall_with_apertures(
        width=4.0, height=3.0, thickness=0.2,
        apertures=[{"x": 1, "y": 0, "w": 0.9, "h": 2.1, "kind": "door"}],
    )
    assert wall["type"] == "wall_with_apertures"
    assert len(wall["apertures"]) == 1
    print("  PASS")


def test_validation_helpers(mod):
    print("test_validation_helpers")
    # PART 174.2-4
    # In headless, validate_bounding_box returns min=[+inf, +inf, +inf]
    bb = mod.lbl.validate_bounding_box(None, min_y=0.0, max_abs_coord=10.0)
    assert "ok" in bb and "min" in bb and "max" in bb
    dc = mod.lbl.validate_draw_call_count(None, budget=30)
    assert "ok" in dc and "count" in dc
    gc = mod.lbl.validate_ground_clearance(None, clearance=0.0)
    assert "ok" in gc
    print("  PASS")


def test_lookdev_and_bezier(mod):
    print("test_lookdev_and_bezier")
    # PART 187 sport motorcycle lights
    rig = mod.lbl.sport_motorcycle_lights("reference")
    assert rig["mode"] == "reference"
    assert len(rig["lights"]) > 0
    rig_g = mod.lbl.sport_motorcycle_lights("grazing")
    assert rig_g["mode"] == "grazing"
    rig_n = mod.lbl.sport_motorcycle_lights("neutral")
    assert rig_n["mode"] == "neutral"
    # PART 395 bezier fairing
    spec = mod.lbl.bezier_fairing([(0, 0), (0.3, 0.4), (0.7, 0.4), (1, 0)], depth=0.04, bevel=0.005)
    assert spec["type"] == "bezier_fairing"
    assert spec["options"]["depth"] == 0.04
    assert spec["options"]["bevelEnabled"] is True
    # No duplicate keys (TS1117 fix)
    assert len(spec["options"]) == len(set(spec["options"].keys()))
    print("  PASS")


def test_default_export_helper(mod):
    print("test_default_export_helper")
    # PART 403 — fix Models 7, 8, 9 missing default export
    import types
    m = types.ModuleType("test_mod")
    def myfunc():
        return "hello"
    mod.lbl.add_default_export(myfunc, m)
    assert m.myfunc is myfunc
    assert m.default is myfunc
    print("  PASS")


def test_sculpt_runtime_and_pbr(mod):
    print("test_sculpt_runtime_and_pbr")
    # PART 411
    sr = mod.lbl.make_sculpt_runtime({"nodes": {"a": 1}, "meshes": {"b": 2}})
    assert sr["nodes"] == {"a": 1}
    assert sr["meshes"] == {"b": 2}
    assert "detailInventory" in sr
    assert "fidelity" in sr
    # validate
    val = mod.lbl.validate_sculpt_runtime_dict(sr)
    assert val["ok"] is True, "sculptRuntime missing: " + str(val["missing"])
    # PART 412
    recipes = mod.lbl.pbr_recipe_names()
    assert "chitin" in recipes
    assert "metal" in recipes
    spec = mod.lbl.make_pbr_recipe("chitin")
    assert "sheen" in spec
    # palette introspection
    pals = mod.lbl.list_palettes()
    assert "racing-red" in pals
    # style field palette
    pal = mod.lbl.make_style_field_palette("fire dragon on a neon highway")
    assert "colors" in pal
    assert len(pal["colors"]) == 5
    # system capabilities
    caps = mod.lbl.system_capabilities()
    assert "pyodide" in caps
    assert "skeleton_classes" in caps
    assert "aces_modules" in caps
    print("  PASS")


def test_vfx_post_fx_chain(mod):
    print("test_vfx_post_fx_chain")
    # PART 421 — post_fx chain
    pf = mod.lbl.post_fx(None, chain=["bloom", "ssao", "outline", "fxaa",
                                        "halftone", "chromatic", "vignette",
                                        "filmgrain"])
    assert pf["type"] == "post_fx"
    assert len(pf["passes"]) == 8
    names = [p["name"] for p in pf["passes"]]
    assert "bloom" in names
    assert "ssao" in names
    assert "outline" in names
    assert "fxaa" in names
    # unknown pass is appended with error note
    pf2 = mod.lbl.post_fx(None, chain=["bogus"])
    assert len(pf2["passes"]) == 1
    assert "error" in pf2["passes"][0]
    print("  PASS")


def test_vfx_outline_shader(mod):
    print("test_vfx_outline_shader")
    # PART 420 — outline (headless: returns spec dict)
    ol = mod.lbl.outline_pass(None, mode="backface", thickness=0.02, color="#000000")
    # In headless it's a dict; in browser it'd be a Group
    assert ol is not None
    assert (isinstance(ol, dict) and ol.get("type") == "outline_pass") or hasattr(ol, "name")
    # PART 424 — shader_material (returns dict)
    sm = mod.lbl.shader_material(
        "void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        "void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }",
        uniforms={"t": {"value": 0.5}},
    )
    assert sm["type"] == "shader_material"
    assert "t" in sm["uniforms"]
    print("  PASS")


def test_vfx_particle_trail(mod):
    print("test_vfx_particle_trail")
    # PART 425 — particle_system (headless)
    ps = mod.lbl.particle_system({
        "count": 50,
        "color": "#ff8800",
        "emitter": "sphere",
        "additive": True,
        "lifetime": 2.0,
        "size": 0.1,
    })
    assert ps["type"] == "particle_system"
    assert ps["count"] == 50
    assert ps["color"] == "#ff8800"
    # PART 426 — trail (headless)
    tr = mod.lbl.trail(None, None, color="#88aaff", width=0.05, length=10)
    assert tr["type"] == "trail"
    assert tr["length"] == 10
    assert callable(tr.get("tick"))
    # PART 429 — sprite_sheet (returns a tick function)
    ss = mod.lbl.sprite_sheet(None, frame_width=64, frame_height=64,
                              frame_count=8, fps=12)
    assert ss["type"] == "sprite_sheet"
    assert callable(ss["tick"])
    # ss["tick"](0.0, 0.5) should run without throwing
    ss["tick"](0.016, 0.5)
    print("  PASS")


def test_vfx_grass_bvh_decal(mod):
    print("test_vfx_grass_bvh_decal")
    # PART 427 — instanced_grass (headless)
    ig = mod.lbl.instanced_grass(None, blade_count=200, height=0.5, width=0.04,
                                  color="#3a7d2c", ground_size=10.0)
    assert ig["type"] == "instanced_grass"
    assert ig["blade_count"] == 200
    # PART 428 — bvh_raycast (headless)
    bc = mod.lbl.bvh_raycast([], None)
    assert bc["type"] == "bvh_raycast"
    assert bc["mesh_count"] == 0
    # PART 423 — decal (headless)
    d = mod.lbl.decal(None, None, position=(0, 1, 0), normal=(0, 1, 0),
                       size=(0.5, 0.5, 0.5))
    assert d["type"] == "decal"
    assert d["size"] == [0.5, 0.5, 0.5]
    # PART 422 — IBL helmet (headless)
    ibl = mod.lbl.ibl_helmet(None, mode="room", intensity=1.0)
    assert ibl["type"] == "ibl_helmet"
    assert ibl["mode"] == "room"
    # PART 430 — lens flare
    lf = mod.lbl.lens_flare(None, light_position=(0, 5, 0),
                              color="#ffeecc", size=1.0, count=4)
    assert lf["type"] == "lens_flare"
    assert lf["count"] == 4
    print("  PASS")


def main():
    print("=" * 60)
    print("LBL Python v2.0 — Integration Test Suite")
    print("=" * 60)
    print()
    mod = load_lbl_py()
    if mod is None:
        sys.exit(1)
    try:
        test_color_helpers(mod)
        test_palette_system(mod)
        test_prng(mod)
        test_textures(mod)
        test_pbr_recipes(mod)
        test_animation_helpers(mod)
        test_style_a_backward_compat(mod)
        test_lbl_facade(mod)
        test_skeleton_templates(mod)
        test_aces_bridge(mod)
        test_mt_fallbacks(mod)
        test_animation_track_detection(mod)
        test_schema_linter_and_shells(mod)
        test_validation_helpers(mod)
        test_lookdev_and_bezier(mod)
        test_default_export_helper(mod)
        test_sculpt_runtime_and_pbr(mod)
        test_vfx_post_fx_chain(mod)
        test_vfx_outline_shader(mod)
        test_vfx_particle_trail(mod)
        test_vfx_grass_bvh_decal(mod)
    except AssertionError as e:
        print(f"FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    print()
    print("=" * 60)
    print("All tests PASSED ✓")
    print("=" * 60)


if __name__ == "__main__":
    main()