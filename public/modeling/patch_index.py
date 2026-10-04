#!/usr/bin/env python3
"""
patch_index.py — Replace the inlined LBL_PY_HELPER_SRC in index.html
with the new v2.0 source from lbl_py.py.

Usage:
    python3 patch_index.py <path-to-index.html>

Backs up the original to <path>.bak before writing.
"""
import sys
import os


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
    with open(backup, "w") as f:
        f.write(html)
    print("Backed up to " + backup)

    # Find the start of the inlined source
    start_marker = "const LBL_PY_HELPER_SRC = `"
    end_marker = "`;"
    start_idx = html.find(start_marker)
    if start_idx < 0:
        print("could not find LBL_PY_HELPER_SRC start marker")
        sys.exit(1)
    # Find the closing backtick + semicolon — search forward
    end_search_from = start_idx + len(start_marker)
    end_idx = html.find(end_marker, end_search_from)
    if end_idx < 0:
        print("could not find LBL_PY_HELPER_SRC end marker")
        sys.exit(1)
    # The closing backtick is the char before the `;`
    actual_end = end_idx + 1  # position of `;`
    # Find the trailing newline if any
    if actual_end < len(html) and html[actual_end] == "\n":
        actual_end += 1

    # Read the new inlined source
    with open("lbl_py_inlined.txt", "r") as f:
        new_src = f.read().rstrip("\n")

    # Compose the replacement. Use proper template literal syntax.
    replacement = "const LBL_PY_HELPER_SRC = `\n" + new_src + "\n`;"

    new_html = html[:start_idx] + replacement + "\n" + html[actual_end:]
    with open(path, "w") as f:
        f.write(new_html)
    print("Patched {} ({} -> {} chars)".format(
        path, len(html), len(new_html)))


if __name__ == "__main__":
    main()