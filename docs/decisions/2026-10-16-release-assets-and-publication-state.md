# Keep releases compact and let GitHub define publication state

## Decision

Publish the native installer a person needs for each supported platform and
architecture. Keep the macOS updater archive, `latest.json`, checksums and the
Linux system-source manifests that satisfy update and license obligations. Do
not publish Windows portable archives or separate copies of
`THIRD-PARTY-NOTICES.txt`; the notices remain inside every native package.

Version pages ask GitHub for their exact tag at runtime. They show installer and
tag links only when the unauthenticated API returns a public release. A draft or
missing tag stays on the release-list fallback, so publishing a release does not
require a second documentation commit or Pages deployment.

## Linux follow-up

The maintainer explicitly accepted the documented Linux dependency risk for
v0.1.0 and published both deb and AppImage packages. Keep
RUSTSEC-2024-0429 and RUSTSEC-2024-0370 visible in audits and follow the removal
condition in [Keep Linux publication gated on the stable Tauri GTK migration](./2026-10-16-linux-release-readiness.md).
Future release reviews repeat that decision until the stable Tauri dependency
graph reaches a fixed GLib family. Do not carry an unstable GTK fork only to
silence the audit.

## Why

Portable Windows archives duplicate the installer payload, bypass the normal
install and update lifecycle, and make the release harder to understand.
Standalone notice files repeat content already shipped with each package. The
smaller file list keeps the user choice clear while preserving updater and
license requirements.

The GitHub release is the source of truth for whether files are public. Reading
that state in the browser removes a timing gap between publishing the release
and rebuilding the site. The static page never emits an unpublished download
URL, and an API failure does not invent one.
