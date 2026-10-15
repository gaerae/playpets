#!/usr/bin/env bash
# Runs inside packaging/windows/Dockerfile: cross-compile x64, then make the NSIS installer, the portable
# zip, and an MSIX package (msix-test/ by default, unsigned msix-store/ with MSIX_PUBLISHER).
set -euo pipefail
# Build output, local app data, keys and generated site files stay on the host: the root .dockerignore
# lists them, in patterns rsync reads the same way Docker does.
rsync -a --delete --exclude-from=/src/.dockerignore /src/ /work/
cd /work
# Dependency install scripts never run while the whole checkout is mounted (as in release.yml).
npm ci --ignore-scripts --no-audit --no-fund
npx tauri build --target x86_64-pc-windows-gnu --bundles nsis
mkdir -p /out
cp src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/*.exe /out/
cp packaging/licenses/THIRD-PARTY-NOTICES.txt /out/
# The MinGW build loads WebView2Loader.dll at runtime, so the portable build ships it alongside.
rm -f /out/PlayPets_*_x64-portable.zip
version="$(node -p "require('./package.json').version")"
zip -j "/out/PlayPets_${version}_x64-portable.zip" src-tauri/target/x86_64-pc-windows-gnu/release/playpets.exe src-tauri/target/x86_64-pc-windows-gnu/release/WebView2Loader.dll packaging/licenses/THIRD-PARTY-NOTICES.txt

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
cp packaging/licenses/THIRD-PARTY-NOTICES.txt "$stage/"
cp src-tauri/icons/msix/*.png "$stage/Assets/"
sed -e "s/@VERSION@/${version}.0/" -e "s/@PUBLISHER@/${publisher}/" /usr/local/share/playpets-msix/AppxManifest.xml > "$stage/AppxManifest.xml"
rm -f "$msix"/PlayPets_*_x64.msix
package="$msix/PlayPets_${version}_x64.msix"
makemsix pack -d "$stage" -p "$package"
if [ -z "${MSIX_PUBLISHER:-}" ]; then
  # The private key stays in the playpets-msix-key volume (/keys), never in the folder handed to
  # testers; only the public certificate goes beside the package. A key an older build left in
  # msix-test/ moves there, so a PC that trusted it keeps accepting new builds.
  key=/keys/PlayPets-test.pfx
  cert=/keys/PlayPets-test.cer
  mkdir -p /keys
  if [ ! -f "$key" ] && [ -f "$msix/PlayPets-test.pfx" ]; then
    mv "$msix/PlayPets-test.pfx" "$key"
    # A certificate left in the volume belongs to another key; the one beside the old key, or one
    # made from it below, replaces it.
    rm -f "$cert"
    if [ -f "$msix/PlayPets-test.cer" ]; then cp "$msix/PlayPets-test.cer" "$cert"; fi
  fi
  if [ ! -f "$key" ]; then
    openssl req -x509 -newkey rsa:2048 -nodes -days 1095 -subj "/${publisher}" \
      -addext "basicConstraints=critical,CA:FALSE" -addext "keyUsage=critical,digitalSignature" \
      -addext "extendedKeyUsage=codeSigning" -keyout "$stage/test.key" -out "$stage/test.crt" 2>/dev/null
    openssl pkcs12 -export -inkey "$stage/test.key" -in "$stage/test.crt" -passout pass: -out "$key"
    openssl x509 -in "$stage/test.crt" -outform DER -out "$cert"
  fi
  if [ ! -f "$cert" ]; then
    openssl pkcs12 -in "$key" -passin pass: -nokeys -clcerts | openssl x509 -outform DER -out "$cert"
  fi
  rm -f "$msix/PlayPets-test.pfx"
  cp "$cert" "$msix/PlayPets-test.cer"
  osslsigncode sign -pkcs12 "$key" -pass "" -h sha256 -in "$package" -out "$package.signed"
  mv "$package.signed" "$package"
  # A package whose signature does not verify against the certificate handed out stops the build.
  verified="$(osslsigncode verify -CAfile <(openssl x509 -inform DER -in "$cert") "$package" 2>&1)" || true
  grep -E "Signature verification|Succeeded|Failed" <<<"$verified" || true
  grep -qx "Succeeded" <<<"$verified" || { echo "The test MSIX does not verify against PlayPets-test.cer." >&2; exit 1; }
  sed -e "s/@VERSION@/${version}/" -e "s/@PUBLISHER@/${publisher}/" /usr/local/share/playpets-msix/README-test.txt > "$msix/README.txt"
fi
rm -rf "$stage"
ls -la /out "$msix"
