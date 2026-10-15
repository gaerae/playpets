# Third-party notices

`THIRD-PARTY-NOTICES.txt` is generated, reviewed source. Tauri includes it in
installed resources; Windows portable archives and MSIX packages include it
beside the executable. Release assets include a copy for each platform.

To update it after changing dependencies:

```sh
cargo install cargo-about --version 0.9.2 --locked --features cli
npm run licenses:generate
npm run licenses:check
```

The generator resolves the locked Rust graph for the desktop targets in
`about.toml`, including build dependencies. It retains the selected license
terms and original packaged license, copyright and notice files. Some crates
omit their license files; `rust-supplements.json` records version-specific,
SHA-256-checked copies from upstream commits in `upstream/`. The original files
are included because cargo-about alone can fall back to generic SPDX text
without the original copyright. A missing original text stops generation.
For old crates without Cargo VCS metadata, cesu8 uses its 1.1.0 version commit,
and the WinAPI import libraries use the upstream 0.3.9 release's license terms.

`generated.json` checks the report and all generation inputs before packaging.
Only the local PlayPets version is normalized, so a version-only release bump
works while dependency or licensing changes invalidate the report. Review the
report and supplements together; do not edit the generated report by hand.

The website emits its own `THIRD-PARTY-NOTICES.txt` during the Vite build from
packages present in client chunks, including lazy chunks. It retains nested
license/notice files and fails if a bundled package has no license text.
`website-supplements.json` supplies version-specific upstream texts omitted by
Algolia's npm packages and the Inter font's OFL. Every locale's footer links to
the output. Server-only tooling is excluded. Remotely served fonts are not
redistributed by this build.

## Distribution scope

These inventories cover Rust packages and website packages, plus the bundled
Inter font. They do not establish licensing compliance for every native file a
packager adds. In particular, inspect the final AppImage for copied GTK, WebKit,
OpenSSL and other system libraries: retain the distribution's copyright/license
files and satisfy any source/relinking obligations before publishing it.
AppImage packaging copies the Linux build host’s `/usr/share/common-licenses`
directory into the same location in the image, so Debian copyright references
to full license texts remain readable. Before packaging,
`scripts/prepare-appimage-licenses.mjs` first follows the built executable's
loaded library graph so an initial AppImage can be assembled. Release and build
CI then extract that image, collect the distribution copyright file for every
library it actually contains, and rebuild the final AppImage with that exact
set. This second pass covers runtime-loaded desktop modules that do not appear
in the executable's library graph.
`scripts/appimage-license.mjs` extracts the
finished image, compares every copied library with those files, and writes the
exact Ubuntu binary and source package versions to the
`SYSTEM-SOURCE-PACKAGES.txt` release asset beside each AppImage. These Linux-only
inputs live under the ignored Cargo target directory and are not read by macOS
or Windows builds. The source manifest is retrieval information, not a
substitute for reviewing the licenses and relinking terms. A deb
normally references system dependencies rather than copying them. Check the
actual artifact instead of assuming both formats contain the same files.
The WebView2Loader files match Microsoft.Web.WebView2 1.0.3800.47; its NuGet
LICENSE and NOTICE texts are included alongside the Rust binding license.
Review separately installed WebView2 runtime and operating system framework
terms separately. This inventory is not a claim that merely
including notices satisfies every license condition.
