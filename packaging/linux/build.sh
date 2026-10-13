#!/usr/bin/env bash
# Runs inside packaging/linux/Dockerfile: copy the read-only source, build deb + AppImage, run the e2e under Xvfb.
set -euo pipefail
# Build output, local app data, keys and generated site files stay on the host (see .gitignore).
rsync -a --delete --exclude .git --exclude node_modules --exclude target --exclude /release --exclude /scratch \
  --exclude '/.dev-data*' --exclude /.credentials --exclude /.claude --exclude '.env*' \
  --exclude '*.pem' --exclude '*.p12' --exclude '*.p8' --exclude '*.pfx' --exclude '*.key' \
  --exclude /website/dev --exclude /website/.vitepress/dist --exclude /website/.vitepress/cache \
  /src/ /work/
cd /work
# Dependency install scripts never run while the whole checkout is mounted (as in release.yml).
npm ci --ignore-scripts --no-audit --no-fund
export APPIMAGE_EXTRACT_AND_RUN=1
# BUNDLES=deb skips AppImage (linuxdeploy does not run under x86_64 emulation on Apple Silicon).
npx tauri build --bundles "${BUNDLES:-deb,appimage}"
arch=$(uname -m)
mkdir -p /out
cp src-tauri/target/release/bundle/deb/*.deb /out/
cp src-tauri/target/release/bundle/appimage/*.AppImage /out/ 2>/dev/null || true
echo "== e2e ($arch, Xvfb)"
dbus-run-session -- xvfb-run -a -s "-screen 0 1920x1080x24" npm run test:e2e | tee /out/e2e.log
grep -q "^PASS: tauri e2e" /out/e2e.log
