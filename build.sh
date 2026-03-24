#!/bin/bash
# build.sh — Package Soratchi and create fullscreen HTML
set -e
cd "$(dirname "$0")"

rm -f soratchi.pyxapp soratchi.html index.html

# Package the game
pyxel package . main.py

# Convert to HTML (raw Pyxel output)
pyxel app2html soratchi.pyxapp

# Extract the base64 data from the generated HTML
BASE64=$(grep -o 'base64: "[^"]*"' soratchi.html | sed 's/base64: "//;s/"//')

# Build a clean HTML file that lets Pyxel handle everything
cat > index.html << 'HTMLEOF'
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Soratchi</title>
<style>
  html, body { margin: 0; padding: 0; background: #1a1a2e; width: 100%; height: 100%; overflow: hidden; }
</style>
</head>
<body>
<script src="https://cdn.jsdelivr.net/gh/kitao/pyxel@2.8.7/wasm/pyxel.js"></script>
<script>
HTMLEOF

# Inject the launchPyxel call with the base64 data
echo "launchPyxel({ command: \"play\", name: \"soratchi.pyxapp\", gamepad: \"enabled\", base64: \"${BASE64}\" });" >> index.html

cat >> index.html << 'HTMLEOF'
</script>
</body>
</html>
HTMLEOF

cp index.html soratchi.html
echo "Built: index.html ($(wc -c < index.html | tr -d ' ') bytes)"
