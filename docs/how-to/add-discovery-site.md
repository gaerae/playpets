# Add or change a discovery site

The Invite view gets its discovery links from `src/content/communities.json`.
The backend embeds this file at build time and sends the visible entries in
`data.communities`. The page does not fetch another file. These are community
links; listing a site does not imply a partnership.

## Change the list

Each entry has four fields:

```json
{
  "id": "example-gallery",
  "name": "Example Gallery",
  "url": "https://example.com/pets/",
  "visible": true
}
```

Use a unique, stable ID containing lowercase ASCII letters, digits and hyphens.
The name is the site's proper name. The URL uses public HTTPS, no credentials,
and the default HTTPS port. The example is illustrative; do not add it to the
shipped list.

Array order determines display order. Set `visible` to `false` to hide an entry,
or remove its record. A hidden or removed entry also stops granting permission
to open its URL through `openExternal`. If another visible entry permits the
same host or repository, that permission remains.

For an ordinary host, opening a link permits HTTPS paths on that exact origin.
For `github.com` and `*.github.io`, the target also stays at or below the listed
path. A listed `https://github.com/team/pets` does not permit
`https://github.com/team/pets-other` or another repository. Redirect handling by
the external browser is outside this URL check.

The parser rejects duplicate IDs, invalid URLs and unknown fields. Tests check
the bundled file. A malformed bundled registry fails closed at runtime and
shows no discovery links.

## Keep discovery separate from importing

The IDs `openpets`, `petdex`, `github`, `codexpet` and `codex-pets` identify the
existing import adapters in `src-tauri/src/pets/importer/sites.rs`. Keep these IDs
when changing the corresponding site's presentation. The backend supplies their
localized hints and `importable: true` only when both the ID and URL match the
trusted adapter origin (and repository path on GitHub). Reusing a known ID with
an unrelated URL produces a browse-only entry.

A new ID is browse-only: it receives `importable: false` and an empty hint, which
the Invite view explains using its localized browse-only text. No page or Rust
change is needed to add that discovery link. This flag describes the listed
integration; it does not disable the generic URL importer.

Hiding, removing or reordering a discovery record does not remove its import
adapter. People can still paste supported pet addresses, and existing imported
pets remain usable. A discovery record cannot select an import route or add a
trusted sprite host. Adding a specialized adapter is a separate code change with
network fixtures and security tests. The importer continues to enforce its own
HTTPS, same-site, redirect and private-address rules.

Bootstrap entries contain `id`, `name`, `url`, `hint` and `importable`. Hidden
entries are omitted. The JSON file contains presentation data only; it is not a
runtime URL editor or remote registry.

## Check the change

Run `cargo test --manifest-path src-tauri/Cargo.toml pets::importer::tests` for the
parser, browser-opening boundaries and import fixtures, then the repository's
normal tests and lint checks. Rebuild the app to pick up the embedded JSON. Check
the Invite list's order and browse-only explanation in the app. If this guide
changes, also run `npm run site:build` to check the developer documentation.
