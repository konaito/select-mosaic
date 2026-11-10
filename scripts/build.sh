#!/bin/bash
# ストアに出す zip を dist/ に作る。拡張の動作に要るファイルだけを入れる。
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(python3 -c 'import json;print(json.load(open("manifest.json"))["version"])')
out="dist/select-mosaic-$version.zip"
mkdir -p dist
rm -f "$out"
zip -r -X "$out" manifest.json background.js content.js popup.html popup.js words.js icons _locales LICENSE -x '*.DS_Store'
echo "$out"
