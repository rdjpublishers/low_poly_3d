#!/usr/bin/env python3
"""Smoke-test the inlined helper source.

Extracts the Python source embedded in lbl_py_inlined.js, parses it with
ast.parse, and reports whether the singleton install block survived the
build (this is the regression we are fixing).
"""
import re
import ast


def main():
    with open("lbl_py_inlined.js", "r") as f:
        js = f.read()
    m = re.search(r"const LBL_PY_HELPER_SRC = `(.*?)`;", js, re.DOTALL)
    if not m:
        print("FAIL: could not find LBL_PY_HELPER_SRC in lbl_py_inlined.js")
        return 1
    raw = m.group(1)
    # Undo the backslash / backtick / ${ escapes the build script applied
    src = raw.replace("\\`", "`").replace("\\${", "${").replace("\\\\", "\\")

    try:
        ast.parse(src)
        print("OK  inlined Python source parses cleanly")
    except SyntaxError as e:
        print(f"FAIL  syntax error at line {e.lineno}: {e.msg}")
        return 1

    has_singleton = bool(re.search(r"^lbl = _LBLFacade\(\)\s*$", src, re.MULTILINE))
    has_sysmod = "sys.modules['lbl'] = lbl" in src
    print(f"{'OK ' if has_singleton else 'FAIL'}  `lbl = _LBLFacade()` at module level: {has_singleton}")
    print(f"{'OK ' if has_sysmod else 'FAIL'}  `sys.modules['lbl'] = lbl` at module level: {has_sysmod}")
    return 0 if has_singleton and has_sysmod else 2


if __name__ == "__main__":
    raise SystemExit(main())