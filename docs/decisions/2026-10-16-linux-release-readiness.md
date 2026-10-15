# Keep Linux publication gated on the stable Tauri GTK migration

## Decision

Build and test Linux deb and AppImage packages in release drafts, but treat public
Linux publication as a separate approval while the stable Tauri graph contains
RUSTSEC-2024-0429 and RUSTSEC-2024-0370. Do not force a second GLib family, claim
that an audit allowlist fixes the dependency, or move to an unreleased GTK 4 fork
for the first release.

The release draft carries Linux packages so native CI can install and launch them.
Before publication, a maintainer reads the current audit and upstream status and
either accepts the documented Linux risk or removes the Linux files from that
release. This approval does not change the audit result.

## Evidence and boundary

The locked application graph uses GLib 0.18.5 through Tauri, Wry, Tao and GTK 3.
RUSTSEC-2024-0429 is fixed in GLib 0.20, outside that compatible family. A source
search on 2026-10-16 found `VariantStrIter` and `array_iter_str` only inside the
GLib crate itself and its tests, not in PlayPets or the other downloaded Rust
sources. That lowers observed reachability but cannot prove a native or generated
call is impossible.

RUSTSEC-2024-0370 covers the unmaintained `proc-macro-error` 1.0.4 used by GTK and
GLib build-time macros. The advisory has no patched release. Replacing it requires
maintaining forks of upstream macro crates and does not repair the GLib warning.

As of 2026-10-16, the Wry GTK 4/WebKitGTK 6 port, the Tao GTK 4 port and Tauri's
GTK 4 migration are still open upstream. Wry's GTK crate update is also open and
targets GTK 0.19; GLib versions below 0.20 remain in the affected range. A private
fork would therefore be a platform migration, not a dependency refresh.

## Removal condition

Remove this publication gate after a stable Tauri/Wry release moves the active
Linux graph to GLib 0.20 or later and `cargo audit --file src-tauri/Cargo.lock`
no longer reports these records. Run the full Linux install, AppImage license and
real-app checks again after that migration.
