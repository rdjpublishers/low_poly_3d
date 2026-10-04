#!/usr/bin/env python3
"""
build_inlined.py — Generate the inlined LBL_PY_HELPER_SRC for embedding
in index.html.

Reads lbl_py.py, escapes any backticks (so the source can be embedded in
a JS template literal), strips the trailing `import sys; lbl = ...`
boilerplate (the inlined version doesn't need to install itself as a
module — the renderer does that), and writes the result to:
  - lbl_py_inlined.txt   (the raw text for inspection)
  - lbl_py_inlined.js    (a JS file with `const LBL_PY_HELPER_SRC = ...;`
                          ready to drop into index.html)
"""
import re
import sys


def main():
    with open("lbl_py.py", "r") as f:
        src = f.read()
    # Strip the trailing singleton / sys.modules['lbl'] install lines
    # (the renderer installs the module itself).
    src = re.sub(
        r"\n# Singleton.*?sys\.modules\['lbl'\] = lbl\s*\Z",
        "\n",
        src,
        flags=re.DOTALL,
    )
    # Strip the "# When this file is loaded standalone..." comment
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
    js += "// Build with: python3 build_inlined.py\n\n"
    js += "const LBL_PY_HELPER_SRC = `\n"
    js += src
    js += "\n`;\n"
    with open("lbl_py_inlined.js", "w") as f:
        f.write(js)
    print("Generated lbl_py_inlined.txt ({} chars)".format(len(src)))
    print("Generated lbl_py_inlined.js ({} chars)".format(len(js)))


if __name__ == "__main__":
    main()