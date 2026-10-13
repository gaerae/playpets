#!/usr/bin/env bash
# Runs inside packaging/windows/Dockerfile: cross-compile x64, then make the NSIS installer, the portable
# zip, and an MSIX package (msix-test/ by default, unsigned msix-store/ with MSIX_PUBLISHER).
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
npx tauri build --target x86_64-pc-windows-gnu --bundles nsis
mkdir -p /out
cp src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/*.exe /out/
# The MinGW build loads WebView2Loader.dll at runtime, so the portable build ships it alongside.
rm -f /out/PlayPets_*_x64-portable.zip
version="$(node -p "require('./package.json').version")"
zip -j "/out/PlayPets_${version}_x64-portable.zip" src-tauri/target/x86_64-pc-windows-gnu/release/playpets.exe src-tauri/target/x86_64-pc-windows-gnu/release/WebView2Loader.dll

# The MSIX package, for trying the app out as a package. Signed with a self-signed test certificate
# that is kept between builds, so a PC that trusted it once keeps accepting new builds.
# For the Store the package is submitted unsigned-by-us with MSIX_PUBLISHER set to the Partner
# Center publisher id; the Store signs it.
release=src-tauri/target/x86_64-pc-windows-gnu/release
publisher="${MSIX_PUBLISHER:-CN=PlayPets Test}"
msix=/out/msix-test
if [ -n "${MSIX_PUBLISHER:-}" ]; then msix=/out/msix-store; fi
stage="$(mktemp -d)"
mkdir -p "$msix" "$stage/Assets"
cp "$release/playpets.exe" "$release/WebView2Loader.dll" "$stage/"
cp src-tauri/icons/msix/*.png "$stage/Assets/"
sed -e "s/@VERSION@/${version}.0/" -e "s/@PUBLISHER@/${publisher}/" /usr/local/share/playpets-msix/AppxManifest.xml > "$stage/AppxManifest.xml"
rm -f "$msix"/PlayPets_*_x64.msix
package="$msix/PlayPets_${version}_x64.msix"
makemsix pack -d "$stage" -p "$package"
if [ -z "${MSIX_PUBLISHER:-}" ]; then
  if [ ! -f "$msix/PlayPets-test.pfx" ]; then
    openssl req -x509 -newkey rsa:2048 -nodes -days 1095 -subj "/${publisher}" \
      -addext "basicConstraints=critical,CA:FALSE" -addext "keyUsage=critical,digitalSignature" \
      -addext "extendedKeyUsage=codeSigning" -keyout "$stage/test.key" -out "$stage/test.crt" 2>/dev/null
    openssl pkcs12 -export -inkey "$stage/test.key" -in "$stage/test.crt" -passout pass: -out "$msix/PlayPets-test.pfx"
    openssl x509 -in "$stage/test.crt" -outform DER -out "$msix/PlayPets-test.cer"
  fi
  osslsigncode sign -pkcs12 "$msix/PlayPets-test.pfx" -pass "" -h sha256 -in "$package" -out "$package.signed"
  mv "$package.signed" "$package"
  osslsigncode verify -CAfile <(openssl x509 -inform DER -in "$msix/PlayPets-test.cer") "$package" | grep -E "Signature verification|Succeeded|Failed" || true
  sed -e "s/@VERSION@/${version}/" -e "s/@PUBLISHER@/${publisher}/" /usr/local/share/playpets-msix/README-test.txt > "$msix/README.txt"
fi
rm -rf "$stage"
ls -la /out "$msix"
