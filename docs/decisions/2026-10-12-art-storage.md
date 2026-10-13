# Keep source art and optimize accepted exports

## Decision

Keep accepted generation originals in regular Git for now. Optimize PNG exports
with `npm run assets:optimize` before committing new artwork. Keep the Aria and
Noah appearance migration. Do not rewrite repository history or reset local data.

These are separate decisions. Git LFS changes where Git stores binary objects;
it does not compress the files bundled in the app. No current individual artwork
file requires large-file storage. Keeping the current checkout process avoids
adding LFS setup to contributors and release jobs. Revisit LFS for generation
sources if their growth makes a normal checkout impractical, with CI and source
archive downloads tested before switching.

## Preserve quality and provenance

The optional maintainer tool uses oxipng 10.2.1 with `-o 2 --nx`. Install oxipng
separately; normal builds do not need it. The script checks decoded RGB/RGBA
samples, including colors hidden by transparency, the PNG header and every
ancillary metadata chunk before replacing a file. It never uses `--alpha` or
metadata stripping. A smaller file is accepted only if every check agrees.
Unsupported formats or metadata changes are reported as skipped, leaving the
original untouched.

Source rows, generation originals and pet identity originals are excluded.
Backups and a per-file report go under ignored `release/asset-size/`. The three
legacy cats' canonical export hashes are updated with a record of the lossless
optimization; hashes of their generation sources remain unchanged. Regenerated
exports can be optimized again. Run `node scripts/creator-kit.mjs --metadata`
after optimization to refresh downloadable kit hashes, then build the site.

Working-file savings do not remove old Git blobs. Existing history, refs and
reflogs are retained. This change makes no claim that a future clone loses the
same number of bytes. A separate history cleanup would need an explicit scope
and a recovery plan.

## Keep the compatibility migration

Older development data can identify the full-size Aria or Noah using the old
asset name plus `visualStyle: "realistic"`. The migration maps those records to
the current full-size pet while preserving friend identity and settings. Without
it, the old asset name can resolve to the Mini appearance instead. It also keeps
an existing appearance usable if unpacking a replacement was interrupted.

The compatibility manifests total 1,716 bytes and do not add a second set of
sprite sheets to the executable. Removing this small path is not a useful size
optimization. Keep its idempotence, missing-target and imported-pet exclusion
tests. Reconsider removal only with an explicit decision to stop supporting
those saved records; never infer that local development data is disposable.

## References

- [oxipng options and lossless behavior](https://github.com/oxipng/oxipng)
- [How Git LFS stores files](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage)

## Measured result

On 2026-10-12, the reviewed export scope contained 104 PNG files. Seventy-nine
were replaced after exact sample and metadata verification. Twenty-five were
left unchanged because oxipng changed ancillary metadata. Their originals were
retained rather than trading provenance for space.

The same 239 source-controlled or pending media paths measured 320,383,394 bytes
before and 302,185,838 bytes after: 18,197,556 bytes saved (5.68%). Of that,
10,706,324 bytes came from pet exports and 6,685,270 from creator reference
sheets. Generated website copies, build output and Git's object database are
excluded from these totals. The local per-file evidence and original backups are
in `release/asset-size/lossless-2026-10-12/`.

The macOS executable, built before and after with the same
`cargo build --release --manifest-path src-tauri/Cargo.toml` command, changed
from 122,430,688 to 111,136,480 bytes (11,294,208 bytes saved). This measures the
executable, not a DMG, other platforms or the earlier reported 140 MB build.
Rust tests passed (119, with one live test ignored), Node tests passed (376),
linters passed, and the asset audit found no invalid dimensions or unresolved
raster references among 419 image files. All 79 replacements were compared
again with their backups; all 25 skipped originals retained their exact bytes.

## Follow-up (2026-10-13)

Local backups and reports moved from `release/asset-size/` to `scratch/asset-size/`, so
`release/` holds only packages to hand off ([repository layout](../repository-layout.md)).
