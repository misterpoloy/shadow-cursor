#!/usr/bin/env bash
# Generate PNG icons from shadow-cursor.svg
# Requires: rsvg-convert (brew install librsvg) or Inkscape

set -e

SVG="src/assets/shadow-cursor.svg"
OUT="src/assets"

if command -v rsvg-convert &>/dev/null; then
  for size in 16 48 128; do
    rsvg-convert -w $size -h $size "$SVG" -o "$OUT/icon-${size}.png"
    echo "Generated icon-${size}.png"
  done
elif command -v inkscape &>/dev/null; then
  for size in 16 48 128; do
    inkscape --export-type=png --export-width=$size --export-height=$size \
      --export-filename="$OUT/icon-${size}.png" "$SVG"
    echo "Generated icon-${size}.png"
  done
else
  echo "Error: install librsvg (brew install librsvg) or Inkscape to generate icons."
  exit 1
fi

echo "Done."
