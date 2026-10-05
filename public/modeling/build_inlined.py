#!/usr/bin/env python3
"""
build_inlined.py — Generate the inlined LBL_PY_HELPER_SRC for embedding
in index.html.

Reads lbl_py.py, escapes any backticks (so the source can be embedded in
a JS template literal), and writes the result to:
  - lbl_py_inlined.txt   (the raw text for inspection)
  - lbl_py_inlined.js    (a JS file with `const LBL_PY_HELPER_SRC = ...;`
                          ready to drop into index.html)

── v2.0.4 (BUG FIX) ──────────────────────────────────────────────────
The previous version stripped the trailing `# Singleton ...` block
because the comment claimed "the inlined version doesn't need to
install itself as a module — the renderer does that". **The renderer
does NOT install it.** The bootstrap only does:

    py.runPython(LBL_PY_HELPER_SRC)
    py.runPython('builtins.lbl = sys.modules["lbl"]')

So if the inlined source never sets `sys.modules['lbl']`, both the
`import lbl` path and the `lbl.foo` direct-call path raise
`NameError: name 'lbl' is not defined`. The strip is removed in
this version so the inlined source stays self-installing — the
same source is now safe to run from a standalone .py file AND from
the embedded JS template literal.
"""
import re
import sys


def main():
    with open("lbl_py.py", "r") as f:
        src = f.read()
    # ── v2.0.4 fix: keep the trailing singleton / sys.modules['lbl'] install
    # The previous strip was a long-standing bug — the inlined source
    # defined `_LBLFacade` but never instantiated it, so `lbl` was never
    # created. The renderer's bootstrap then silently caught the
    # missing-sys.modules key in a try/catch, leaving the user script
    # with a NameError. We now leave the trailing install block intact.
    #
    # (If you ever need to revert this, the old regex was:)
    #     src = re.sub(
    #         r"\n# Singleton.*?sys\.modules\['lbl'\] = lbl\s*\Z",
    #         "\n",
    #         src,
    #         flags=re.DOTALL,
    #     )
    #
    # Strip the "# When this file is loaded standalone..." comment.
    # (There isn't one in the current lbl_py.py, but the regex is harmless
    # if the comment isn't present.)
    src = re.sub(
        r"\n# When this file is loaded standalone.*?(?=# ═)",
        "\n",
        src,
        flags=re.DOTALL,
    )
    # Escape backticks so the source can be embedded in a template literal
    src = src.replace("\\", "\\\\")
    src = src.replace("`", "\\`")
    src = src.replace("${", "\\${")
    with open("lbl_py_inlined.txt", "w") as f:
        f.write(src)
    # Wrap in a JS const
    js = "/* eslint-disable */\n"
    js += "// Auto-generated from public/modeling/lbl_py.py — DO NOT EDIT\n"
    js += "// Build with: python3 build_inlined.py\n"
    js += "//\n"
    js += "// v2.0.4 — trailing singleton install is now KEPT (was stripped in\n"
    js += "// v2.0.0..v2.0.3, which broke `import lbl` and direct `lbl.foo`\n"
    js += "// calls). See build_inlined.py header for the full post-mortem.\n\n"
    js += "const LBL_PY_HELPER_SRC = `\n"
    js += src
    js += "\n`;\n"
    with open("lbl_py_inlined.js", "w") as f:
        f.write(js)
    print("Generated lbl_py_inlined.txt ({} chars)".format(len(src)))
    print("Generated lbl_py_inlined.js ({} chars)".format(len(js)))


if __name__ == "__main__":
    main()
