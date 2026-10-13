#!/usr/bin/env bash
# Copies the disk image `tauri build --bundles app,dmg` made into release/macos under the name the
# release uses. The window's look (background, size, where the app and the Applications shortcut
# sit) is set in src-tauri/tauri.conf.json under bundle.macOS.dmg, so the local build and the
# release build make the same image. The background is drawn by `npm run art`.
# Run after `tauri build --bundles app,dmg` (npm run dist:mac does both).
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
version="$(node -p "require('$root/package.json').version")"
shopt -s nullglob
images=("$root"/src-tauri/target/release/bundle/dmg/PlayPets_"$version"_*.dmg)
[ "${#images[@]}" -eq 1 ] || { echo "Expected one disk image for $version. Remove conflicting bundles and run 'npx tauri build --bundles app,dmg'." >&2; exit 1; }
dmg="${images[0]}"
out="$root/release/macos/PlayPets_${version}_$(uname -m | sed 's/arm64/aarch64/').dmg"
mkdir -p "$(dirname "$out")"
cp "$dmg" "$out"
echo "created: $out"
