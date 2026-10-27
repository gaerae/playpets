# Add or change a discovery site

- The Invite view gets its discovery links from `src/content/communities.json`.
- The backend embeds this file at build time and sends the visible entries in `data.communities`.
- The page does not fetch another file.
- These are community links. Listing a site does not imply a partnership.

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

| Field | Rule |
|---|---|
| `id` | Unique and stable; lowercase ASCII letters, digits and hyphens |
| `name` | The site's proper name |
| `url` | Public HTTPS, no credentials, the default HTTPS port |
| `visible` | `false` hides the entry |

- The example only shows the shape. Do not add it to the shipped list.
- Entries show in array order.
- To hide an entry, set `visible` to `false` or remove its record.
  - A hidden or removed entry no longer lets `openExternal` open its URL.
  - If another visible entry allows the same host or repository, that permission stays.

What a link permits:
- An ordinary host: HTTPS paths on that exact origin.
- `github.com` and `*.github.io`: the target also has to stay at or below the listed path.
  - A listed `https://github.com/team/pets` does not permit `https://github.com/team/pets-other` or another repository.
- This URL check does not cover how the external browser handles redirects.

Checks:
- The parser rejects duplicate IDs, invalid URLs and unknown fields.
- Tests check the bundled file.
- A malformed bundled registry fails closed at runtime: the app shows no discovery links.

## Keep discovery separate from importing

Known IDs:
- `openpets`, `petdex`, `github`, `codexpet` and `codex-pets` name the existing import adapters in `src-tauri/src/pets/importer/sites.rs`.
- Keep these IDs when you change how the matching site is presented.
- The backend adds their localized hints and `importable: true` only when both the ID and the URL match the trusted adapter origin (and, on GitHub, the repository path).
- A known ID with an unrelated URL becomes a browse-only entry.

New IDs:
- A new ID is browse-only: it gets `importable: false` and an empty hint.
- The Invite view explains it with its localized browse-only text.
- Adding that discovery link needs no page or Rust change.
- The flag describes the listed integration. It does not turn off the generic URL importer.

What a discovery record does not change:
- Hiding, removing or reordering a record does not remove its import adapter.
- People can still paste supported pet addresses.
- Pets already imported keep working.
- A record cannot pick an import route or add a trusted sprite host.
- A specialized adapter is a separate code change, with network fixtures and security tests.
- The importer still enforces its own HTTPS, same-site, redirect and private-address rules.

Bootstrap entries:
- They contain `id`, `name`, `url`, `hint` and `importable`.
- Hidden entries are left out.
- The JSON file holds presentation data only. It is not a runtime URL editor or a remote registry.

## Check the change

1. Run the importer tests (parser, browser-opening boundaries and import fixtures): `cargo test --manifest-path src-tauri/Cargo.toml pets::importer::tests`.
2. Run the repository's normal tests and lint checks.
3. Rebuild the app so it picks up the embedded JSON.
4. In the app, check the order of the Invite list and the browse-only explanation.
5. If you changed this guide, also run `npm run site:build` to check the developer documentation.
