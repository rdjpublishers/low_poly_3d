#!/usr/bin/env python3
"""
patch_index.py — Replace the inlined LBL_PY_HELPER_SRC in index.html
with the new v2.0.4 source from lbl_py_inlined.txt.

Usage:
    python3 patch_index.py <path-to-index.html>

Backs up the original to <path>.bak before writing.

── v2.0.4 (BUG FIX) ──────────────────────────────────────────────────
In addition to swapping the inlined source, this script also (a) sets
the helper bootstrap filename in index.html so SyntaxError tracebacks
no longer report `File "", line 1`, and (b) installs the v2.0.4
defensive `lbl` install guard so even a stale cache of the helper
source cannot raise `NameError: name 'lbl' is not defined`. Both
patches are idempotent — re-running this script over a v2.0.4-patched
index.html is a no-op.
"""
import sys
import os
import re


def patch_bootstrap(html: str) -> str:
    """Apply the v2.0.4 bootstrap patches to index.html.

    Two patches:
      1. `py.runPython(LBL_PY_HELPER_SRC)` gets an explicit filename so
         tracebacks no longer point at `File "", line 1`.
      2. A defensive `lbl = _LBLFacade(); sys.modules['lbl'] = lbl` guard
         runs after the helper source in case the stripped install block
         ever ships again. Idempotent: skips if the guard is already in.

    Returns the patched html (possibly unchanged if patches already applied).
    """
    if "__lbl_helper_version" in html:
        print("[bootstrap] already patched (v2.0.4 marker present) — skipping")
        return html

    # Patch 1: filename on the LBL_PY_HELPER_SRC run.
    old_pat_1 = "        py.runPython(LBL_PY_HELPER_SRC);"
    new_pat_1 = (
        "        py.runPython(LBL_PY_HELPER_SRC, "
        "{ filename: '<lbl-py-helper-bootstrap>' });"
    )
    if old_pat_1 in html:
        html = html.replace(old_pat_1, new_pat_1, 1)
        print("[bootstrap] patch 1 applied: explicit filename on LBL_PY_HELPER_SRC run")
    else:
        print("[bootstrap] patch 1 already applied or source moved — skipping")

    # Patch 2: defensive `lbl` install guard.
    old_pat_2 = (
        "        try{\n"
        "          py.runPython(`\n"
        "import builtins\n"
        "builtins.lbl = sys.modules['lbl']\n"
        "`);\n"
        "        }catch(builtinsErr){"
    )
    new_pat_2 = (
        "        try{\n"
        "          // v2.0.4 defensive install — see patch_index.py header.\n"
        "          py.runPython(`\n"
        "import sys as _lbl_sys\n"
        "import builtins as _lbl_builtins\n"
        "_lbl_mod = _lbl_sys.modules.get('lbl')\n"
        "if _lbl_mod is None:\n"
        "    _lbl_mod = _LBLFacade()\n"
        "    _lbl_mod = _bind_section_23_facade(_lbl_mod)\n"
        "    _lbl_sys.modules['lbl'] = _lbl_mod\n"
        "_lbl_builtins.lbl = _lbl_mod\n"
        "`, { filename: '<lbl-py-helper-bootstrap-guard>' });\n"
        "          window.__lbl_helper_version = 'v2.0.4';\n"
        "        }catch(builtinsErr){"
    )
    if old_pat_2 in html:
        html = html.replace(old_pat_2, new_pat_2, 1)
        print("[bootstrap] patch 2 applied: defensive install guard")
    else:
        print("[bootstrap] patch 2 already applied or source moved — skipping")

    return html


def patch_helper_src(html: str, new_src: str) -> str:
    """Swap the body of LBL_PY_HELPER_SRC for the v2.0.4 inlined source."""
    start_marker = "const LBL_PY_HELPER_SRC = `"
    start_idx = html.find(start_marker)
    if start_idx < 0:
        raise RuntimeError("could not find LBL_PY_HELPER_SRC start marker")
    search_from = start_idx + len(start_marker)
    # Find the first occurrence of `\n`;\n that closes the template literal.
    # Be precise: a single backtick followed by `;`.
    end_marker = "`;"
    end_idx = html.find(end_marker, search_from)
    if end_idx < 0:
        raise RuntimeError("could not find LBL_PY_HELPER_SRC end marker")
    actual_end = end_idx + len(end_marker)
    if actual_end < len(html) and html[actual_end] == "\n":
        actual_end += 1

    new_src = new_src.rstrip("\n")
    replacement = start_marker + "\n" + new_src + "\n" + end_marker
    new_html = html[:start_idx] + replacement + html[actual_end:]
    print(
        "[helper ] old: {} bytes, new: {} bytes (delta {:+})".format(
            len(html), len(new_html), len(new_html) - len(html)
        )
    )
    return new_html


def main():
    if len(sys.argv) < 2:
        print("usage: python3 patch_index.py <path-to-index.html>")
        sys.exit(1)
    path = sys.argv[1]
    if not os.path.exists(path):
        print("file not found: " + path)
        sys.exit(1)

    with open(path, "r") as f:
        html = f.read()
    backup = path + ".bak"
    if not os.path.exists(backup):
        with open(backup, "w") as f:
            f.write(html)
        print("Backed up to " + backup)
    else:
        print("Backup already exists at " + backup + " — leaving alone")

    # Read the new inlined source
    with open("lbl_py_inlined.txt", "r") as f:
        new_src = f.read()

    # Apply bootstrap patches first (idempotent), then swap the helper source.
    html = patch_bootstrap(html)
    html = patch_helper_src(html, new_src)

    with open(path, "w") as f:
        f.write(html)
    print("Patched {} ({} chars)".format(path, len(html)))


if __name__ == "__main__":
    main()