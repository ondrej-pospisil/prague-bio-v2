#!/bin/sh
# Jednorázová příprava prostředí: Python venv + závislosti + Tailwind CLI (standalone binárka, v gitu není).
set -e
cd "$(dirname "$0")/.."
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q -r tools/requirements.txt
V=4.1.13
mkdir -p tools/bin
if [ ! -x tools/bin/tailwindcss ]; then
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) F=tailwindcss-macos-arm64 ;;
    Darwin-x86_64) F=tailwindcss-macos-x64 ;;
    Linux-x86_64) F=tailwindcss-linux-x64 ;;
    Linux-aarch64) F=tailwindcss-linux-arm64 ;;
    *) echo "Neznámá platforma – stáhněte Tailwind CLI v$V ručně do tools/bin/tailwindcss"; exit 1 ;;
  esac
  echo "Stahuji Tailwind CLI v$V ($F)…"
  curl -sSL -o tools/bin/tailwindcss "https://github.com/tailwindlabs/tailwindcss/releases/download/v$V/$F"
  chmod +x tools/bin/tailwindcss
  if [ "$F" = "tailwindcss-macos-arm64" ]; then
    echo "c47681e9948db20026a913a4aca4ee0269b4c0d4ef3f71343cb891dfdc1e97c9  tools/bin/tailwindcss" | shasum -a 256 -c -
  fi
fi
echo "Hotovo. Další kroky: make dev   (náhled)   nebo   make build   (produkční build)"
