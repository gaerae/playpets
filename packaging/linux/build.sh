#!/usr/bin/env bash
# Runs inside packaging/linux/Dockerfile: copy the read-only source, build deb + AppImage, run the e2e under Xvfb.
set -euo pipefail
# Build output, local app data, keys and generated site files stay on the host: the root .dockerignore
# lists them, in patterns rsync reads the same way Docker does.
rsync -a --delete --exclude-from=/src/.dockerignore /src/ /work/
cd /work
# Dependency install scripts never run while the whole checkout is mounted (as in release.yml).
npm ci --ignore-scripts --no-audit --no-fund
export APPIMAGE_EXTRACT_AND_RUN=1
# BUNDLES=deb skips AppImage (linuxdeploy does not run under x86_64 emulation on Apple Silicon).
bundles="${BUNDLES:-deb,appimage}"
bundle=src-tauri/target/release/bundle
if [[ ",$bundles," == *,appimage,* ]]; then
  cargo build --release --manifest-path src-tauri/Cargo.toml
  node scripts/prepare-appimage-licenses.mjs \
    src-tauri/target/release/playpets src-tauri/target/appimage-license-docs
  rm -f "$bundle"/appimage/*.AppImage
fi
npx tauri build --bundles "$bundles"
if [[ ",$bundles," == *,appimage,* ]]; then
  images=("$bundle"/appimage/*.AppImage)
  node scripts/prepare-appimage-licenses.mjs --appimage \
    "${images[0]}" src-tauri/target/appimage-license-docs
  npx tauri build --bundles "$bundles"
  for image in "$bundle"/appimage/*.AppImage; do
    node scripts/appimage-license.mjs "$image" "${image%.AppImage}-SYSTEM-SOURCE-PACKAGES.txt"
  done
fi
arch=$(uname -m)
mkdir -p /out
cp packaging/licenses/THIRD-PARTY-NOTICES.txt /out/
# A deb-only build never exports an AppImage or notice manifest left in the cache.
rm -f /out/PlayPets_*.deb /out/PlayPets_*.AppImage /out/PlayPets_*-SYSTEM-SOURCE-PACKAGES.txt
cp "$bundle"/deb/*.deb /out/
if [[ ",$bundles," == *,appimage,* ]]; then
  cp "$bundle"/appimage/*.AppImage "$bundle"/appimage/*-SYSTEM-SOURCE-PACKAGES.txt /out/
fi
echo "== e2e ($arch, Xvfb)"
dbus-run-session -- xvfb-run -a -s "-screen 0 1920x1080x24" npm run test:e2e | tee /out/e2e.log
grep -q "^PASS: tauri e2e" /out/e2e.log
