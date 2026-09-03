#!/usr/bin/env bash
# build.sh — bundle the three-rig-helpers pre-bundled library.
# Run from anywhere; the script always cd's into its own dir first so
# the relative src/ paths resolve. Requires `esbuild` on PATH
# (npm install -g esbuild, or use the local copy from this repo's
#  package.json if you add one).
set -euo pipefail
cd "$(dirname "$0")"

esbuild src/index.ts \
  --bundle --format=esm --target=es2020 --minify \
  --external:three \
  --outfile=three-rig-helpers.js

echo "wrote $(pwd)/three-rig-helpers.js"
