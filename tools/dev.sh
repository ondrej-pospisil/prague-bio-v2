#!/bin/sh
# Sestaví web a spustí náhled na http://localhost:8791
cd "$(dirname "$0")/.." || exit 1
{ [ -d .venv ] && [ -x tools/bin/tailwindcss ]; } || sh tools/setup.sh || exit 1
.venv/bin/python tools/build.py || exit 1
cd dist && echo "Náhled: http://localhost:8791" && exec python3 -m http.server 8791
