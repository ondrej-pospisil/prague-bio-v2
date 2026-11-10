#!/bin/sh
# Použití: tools/fetch.sh <cílová-složka> <url> [<url> ...]   – stáhne originály z prague.bio
dest="$1"; shift; mkdir -p "$dest"
for u in "$@"; do
  f="$dest/$(basename "${u%%\?*}")"
  [ -s "$f" ] || curl -sfL -A "Mozilla/5.0" -o "$f" "$u" || echo "FAIL $u"
done
