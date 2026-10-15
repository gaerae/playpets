# Retain the GTK 3 dependency family while tracking its advisories

## Decision

Keep Tauri's compatible GTK 3 dependency family for the initial release candidate.
Do not force GLib 0.20 into the GLib 0.18 graph, suppress the advisory IDs globally,
or describe an informational audit result as proof that the graph is safe.
Review these two advisories whenever the Linux dependency graph changes and before
publishing a Linux installer. The release reviewer decides whether the remaining
risk is acceptable; a release draft is not that decision.

## Why

Tauri, Wry, GTK, WebKitGTK and the tray/menu crates share GLib 0.18 types. A direct
GLib 0.20 dependency adds another version instead of repairing the one GTK uses.
Replacing the family or maintaining a private fork is a separate compatibility
and maintenance commitment, not a lockfile-only update.

- [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html)
  affects `glib::VariantStrIter`, returned by `Variant::array_iter_str`, in
  GLib 0.15 through 0.19. Its native out-pointer mutability can cause undefined
  behavior. GLib 0.20 contains the upstream fix. The locked GLib 0.18.5 still
  contains the affected implementation. Source searches for this API are useful
  evidence, but do not prove absence of an indirect or generated call.
- [RUSTSEC-2024-0370](https://rustsec.org/advisories/RUSTSEC-2024-0370.html)
  identifies `proc-macro-error` 1.0.4 as unmaintained. GTK and GLib build-time
  macros pull it in. The advisory gives no patched version; its presence is a
  maintenance risk rather than evidence of a known runtime exploit.

## Maintenance

Run `cargo audit --file src-tauri/Cargo.lock` without ignores. Inspect the reverse
paths with `cargo tree --manifest-path src-tauri/Cargo.toml --target all -i glib`
and the same command for `proc-macro-error`. Review upstream GTK/Tauri changes
before updating. Do not delete the warnings merely to make a report green.

If an affected iterator is introduced, stop the Linux release and either take a
compatible upstream fix or review a narrowly scoped backport with its own tests,
source attribution and removal plan. Document current reachability evidence and
native Linux results in the release review, not in this lasting decision.
