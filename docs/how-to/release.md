# Release a new version

## Purpose
- Tag a new version `x.y.z`, then review and publish the GitHub release draft that CI fills with the files it builds for every platform.
- Once the release is published, installed apps can find the update (when updater signing is configured).
- Publishing also generates the winget and Homebrew tap files.
- The decision "[The version lives only in package.json, and a version tag creates a draft release](../decisions/2026-09-30-releases-from-version-tags.md)" explains why the flow works this way.

## Audience and assumptions
- A maintainer does this.
- You need repository administrator access for the generated release commit.
- You need a clean local working tree on main.
- Ordinary code changes still use reviewed squash pull requests.
- Signing and the distribution channels turn on only when the repository secrets exist.
- The release still works without them.
- The [signing keys and secrets standard](../standards/keys-and-secrets.md) lists the secrets.

## Prerequisites
- `security` and `codeql` passed for the latest commit on main.
- `build` passed on every desktop platform for the pull request behind that commit.
  - main builds only when the crates or the workflow change ([automated checks](../standards/testing.md#automated-checks)).
  - For a run on main itself, use `gh workflow run build.yml --ref main`.
- `CHANGELOG.md` lists this version's changes under `## [Unreleased]`. If it is empty, the release command stops.
- You chose the version number: bump the second number for new features, the third when there are only fixes.
- `git status` is empty locally.
- The release pages for this version are written in all four site languages:
  - `website/releases/<version>.md` (English), `website/ko/releases/<version>.md`, `website/ja/releases/<version>.md` and `website/zh-hans/releases/<version>.md`.
  - Each has the opening sentence and the changes a visitor reads first, written by hand. See [Edit and check the website](website.md).
  - They follow the [release notes rules](../standards/writing.md#release-notes); the command stops on a page that breaks them.
- The one-time repository setup is done ([Set up the repository, keys and store accounts](set-up-the-repository.md)): Pages from GitHub Actions, private vulnerability reporting, the updater signing secrets, and for the stores the Homebrew tap and the winget-pkgs fork.

## Development versions and publication

Versions:
- Starting with `1.0.0`, the app and the Store share the same three version components.
- MSIX adds a final `.0` (for example `1.0.0.0`).
- Publishing the GitHub release also starts the `store` workflow.
- That workflow builds both Store packages and, once submission is switched on, submits them to Partner Center (step 9). See [Store setup and submission](store-and-apple-signing.md).
- Versions change for a release, not automatically for each commit.
- `package.json` is the source of truth.
- The Rust package version matches it; `pnpm-lock.yaml` does not record the app's version.
- New features bump the minor version; fixes bump the patch version.
- Pet and background format versions are separate compatibility contracts and do not advance with the app version.

Preparing the next version on a development branch:
- Keep its notes under `Unreleased`.
- Leave its four release pages undated.
- Keep the published Linux metainfo entries.
- A prepared entry uses `type="development"` until the release command dates and promotes it.
- Keep the published version's captures.
- Put current captures under the next version's directory.
- A prepared version is not a public release: the site's default download still resolves the latest published GitHub release.
- Once the branch is reviewed and merged into main, `pnpm run release x.y.z` finalizes the notes and dates, commits, and creates the local tag.
- The command does not push.
- Push the tag only once cross-platform checks and publication are approved.

Update checks:

| When | What happens |
|---|---|
| Unpackaged installations | Silent check 20 seconds after startup, then every 6 hours |
| A check fails | Silent retry after 5 minutes, 15 minutes, 1 hour, then every 6 hours; success resets the schedule |
| Store-managed packages | Their package manager updates them instead |

- A background check shows a quiet version entry without opening Settings or starting an installation.
- **Settings → App updates** holds the result, release notes, download progress, errors and Retry.
- Only **Install and restart** starts the signed download and installation.
- Closing Settings leaves that operation running.
- Reopening Settings does not start a second download.

Updater archives:
- The updater disables legacy ZIP compatibility on purpose.
- Keep this setting when you update the plugin.
- The release feed points to native Windows EXE, Linux deb and AppImage files.
- macOS tar support does not depend on the ZIP feature.
- A new archive format needs a dependency security review and installation checks before it is added.

## First public release hand-off

Do these in order. A local build that succeeds does not prove that a published update downloads and installs.

1. Merge reviewed local branches into `main`, then run `pnpm run check` and `pnpm run test:e2e` on the resulting commit.
2. Before the first push of `main`, scan the reachable history with `gitleaks git --redact --log-opts=main`.
   - Check tracked files as well as ignore rules.
   - Private data and build output do not belong in Git.
3. Run `pnpm audit`, `cargo audit --file src-tauri/Cargo.lock` and `actionlint` with current advisory data.
   - Review informational warnings too.
   - Record unresolved advisories, affected platforms and any reachability assessment in the release review.
   - A passing unit test does not prove that a dependency is safe.
   - For the Linux GLib warning, use the upstream references and handling policy in [Dependency advisories](https://github.com/gaerae/playpets/blob/main/SECURITY.md#dependency-advisories).
   - Check the active dependency graph even when an upstream project has added an audit exception or started a newer GTK development branch.
4. Review third-party license notices for the dependencies bundled in each platform package and in the built website.
   - Ship the required license and copyright texts with those distributions.
   - The repository's MIT license does not replace dependency notices.
   - Run `pnpm run licenses:check`. [Third-party notices](../../packaging/licenses/README.md) covers regeneration and distribution scope.
   - The Rust inventory does not cover system libraries copied into an AppImage.
   - Before publication, review the final image and the libraries' source and relinking obligations.
5. Confirm that both Linux `SYSTEM-SOURCE-PACKAGES.txt` assets are present.
   - Release CI builds an initial image from the executable's native library graph, extracts the system libraries it actually uses, then rebuilds the final image with their distribution copyright files.
   - It compares every copied library with those files and records the exact Ubuntu binary and source package versions used to build it.
6. Rebuild distribution files after dependency changes.
   - Older files in the ignored `release/` folder are not evidence for the current commit, and they are not publication inputs.
7. Connect the GitHub remote and push `main`.
   - Enable Pages from GitHub Actions and configure updater signing as described in [repository setup](set-up-the-repository.md).
8. Before publishing the release draft, check the platform CI results, the four-language site routes, the release links and the installation instructions.
9. Read the native package smoke-test result for every release job.
   - It copies the app from the dmg, silently installs and uninstalls the NSIS package, and installs the deb.
   - It launches those packages and the AppImage for eight seconds with isolated app data.
   - This catches package hand-off failures.
   - It does not replace the interactive installer and Gatekeeper/SmartScreen review on real user machines.
10. Refresh public captures when a visible change affects them.
    - The full yard, small window, places, Friend, Invite and Settings have to match the shipped app.
11. Test a signed upgrade from an older installed build to a newer published build on each supported installer format.
    - Check download progress, a failed attempt and retry, restart, the one-time version notice, and that friends and settings are kept.
    - A mocked updater event proves UI behavior, not the installer hand-off.
12. Treat Homebrew, winget and optional platform signing as separate distribution steps.
    - Record in the release notes which channels are actually available.

## Published releases stay fixed

- Complete and verify every asset while the release is a draft.
- Release immutability protects assets published from now on and their tags.
- The repository's tag rules also block moving or deleting pushed `v*.*.*` tags.
- Before a push, you can delete a mistaken local tag and make it again.
- After a push, keep the tag and use a new version.
- A fix to a published installer ships as a patch release, never as a replaced file at an existing download address.
- Release notes can clarify known limits.

## Steps
1. Pull the latest main.

```bash
git switch main && git pull
```

2. Capture the screens for the site (macOS), then redraw the installer art.
   - The first time, macOS asks for screen recording permission; allow it.
   - The command writes the results to `website/public/shots/0.2.0/`, in every app language.
   - Look them over, then set `CAPTURE_VERSION` in `scripts/site-content.mjs` to the new version, so the site and the installer art use them.
   - `pnpm run art` redraws the installer art. It also turns those English captures into the screenshots Linux software centers show.
   - Commit all of it.

```bash
pnpm run shots 0.2.0
pnpm run art
```

3. Make the release commit and tag.

```bash
pnpm run release 0.2.0
```

   | What the command changes | Where |
   |---|---|
   | The changelog section moves to a dated section | `CHANGELOG.md` |
   | The version | `package.json`, `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock` |
   | The version is added, dated, with the English page's Linux lines | `packaging/linux/app.playpets.metainfo.xml` |
   | Today's date on the website release pages | `website/releases/0.2.0.md`, `website/ko/releases/0.2.0.md`, `website/ja/releases/0.2.0.md` and `website/zh-hans/releases/0.2.0.md` |

   - If a page is missing or breaks a release notes rule, it stops before changing anything and lists what to fix.
   - Everything goes into one release commit.
   - Nothing is pushed.

4. Push the commit and the tag. The tag starts the `release` workflow.

```bash
git push --atomic origin HEAD v0.2.0
```

   - The atomic push either updates both main and the version tag or updates neither.
   - Do not push the tag separately after a rejected main update: that could start a release from a commit absent from main.

5. Open the `release` run in the repository's Actions tab.
   - Watch `check` (tag, version and changelog agree), `build` on five platforms, and `publish` finish in order.

6. Open the `PlayPets 0.2.0` draft in the Releases tab. Check the file list and the notes.

| File | Present when |
|---|---|
| `PlayPets_0.2.0_macos-universal.dmg` | Always |
| `PlayPets_0.2.0_windows-x64-setup.exe`, `…-arm64-setup.exe` | Always |
| `PlayPets_0.2.0_linux-x64.deb`, `….AppImage`, two arm64 files | Always |
| Two Linux `…-SYSTEM-SOURCE-PACKAGES.txt` files | Always |
| `SHA256SUMS.txt` | Always |
| `latest.json`, `PlayPets_0.2.0_macos-universal.app.tar.gz` | The updater signing secrets exist |

7. After the checks pass, press "Publish release" on the draft. Publishing starts the `distribute` and `store` workflows.
   - `distribute` starts the Pages build on `main`. The site reads the published releases while it is built, so the download buttons and the four version pages then link that version's files.
   - Publication therefore needs no follow-up documentation commit.
   - Until that deployment finishes, the site still offers the previous release. Check that the `pages` run `distribute` started succeeded: the pages don't look again, so a failed run leaves the previous release's links until the next deployment. If the build could not reach GitHub, the pages look the release up in the visitor's browser and keep a safe link to the release list.

8. When the `distribute` run finishes, check the results. A channel without a token is left in the `store-manifests` artifact.

| Channel | With its token | Without it |
|---|---|---|
| winget | If `WINGET_TOKEN` exists, `wingetcreate` opens the PR on winget-pkgs, for the first version too. winget's moderators review a new package by hand; their bots merge later versions once checks pass | Submit the artifact's `winget/manifests/…` folder yourself (below) |
| Homebrew | If `HOMEBREW_TAP_TOKEN` exists, the run updates `Casks/playpets.rb` in `<account>/homebrew-tap` | Copy the artifact's `homebrew/Casks/playpets.rb` into the tap repository and commit it |

   Submitting to winget by hand:

```powershell
wingetcreate token --store
```

```powershell
wingetcreate submit <folder where you unpacked the artifact>\winget\manifests\g\gaerae\PlayPets\0.2.0
```

   - `token --store` signs in to GitHub in the browser once and keeps the token in Windows Credential Manager, so it never appears on the command line.

9. Check the `store` run (Microsoft Store). It skips prereleases.
   - `source` checks the tag and makes "What's new" from the four website release pages.
   - `package` builds the x64 and ARM64 MSIX from the tag.
   - `bundle` checks their identity and keeps them as the `store-bundle` artifact.
   - `submit` runs only when the repository variable `STORE_SUBMISSION_ENABLED` is `true`.
   - `submit` waits for approval of the `microsoft-store` environment, then creates the submission and requests certification.
   - With `STORE_PUBLISH_MODE=Immediate`, the Store publishes once certification passes.
   - Otherwise press **Publish now** in Partner Center after certification passes.
   - Without submission, upload the two `.msix` files from `store-bundle` in Partner Center and paste each language's text from its `notes.json`.
   - Partner Center marks the older package for removal after the upload; press **Save** on the Packages page, or the submission stays incomplete.

## Verification
- The release page has the files from step 6.
- The notes match the `## [0.2.0]` section of `CHANGELOG.md`.
- In an app with the previous version installed (when the updater signing secrets exist):
  1. Confirm that an automatic check shows a quiet version entry without opening Settings or starting the installation.
  2. Run a manual check: it opens **Settings → App updates**. Verify its result, release notes, progress, errors and Retry in that section.
  3. Close Settings during the download and reopen it. Check that no second download starts.
  4. Complete the installation and restart. Confirm the running version and the brief completion notice.
  5. Restart again and check that the notice does not repeat.
- Partner Center shows the new submission with both packages and What's new in four languages.
- Certification starts on its own.
- The winget PR passes its checks, or `brew upgrade --cask playpets` on a computer with the tap gets the new version.
- With signing secrets, `latest.json` lists every platform in the release, including `linux-x86_64-deb` and `linux-aarch64-deb` entries for deb installs.
- If those entries are missing, deb users do not get updates in the app.

## Troubleshooting
| Symptom | Fix |
|---|---|
| `check` fails with "package.json is not x.y.z" | The tag and the version differ. If the tag is only local, delete it with `git tag -d vx.y.z` and make it again. Keep a tag that is already pushed, and prepare a corrected new version |
| `check` fails with "no section for x.y.z" | The tag was made without finalized notes. Keep a pushed tag, and finalize the next version with the release command |
| Only one platform's `build` fails | Read that runner's log and fix it, then run `release` by hand from Actions with the same tag (workflow_dispatch, tag input). It replaces the draft's files; a published release stops it |
| The draft has no `latest.json` | The updater signing secrets are missing. Installed apps cannot find this release. Add the secrets, delete the draft, and run `release` by hand with the same tag |
| `gh release create` fails with "already exists" | A draft for the same tag already exists. Delete that draft and run `release` by hand |
| `store` stops with "already has this version" | The Store has this version or a later one. Nothing changed |
| `store` stops with "pending submission" | A submission is still in certification or a draft is open in Partner Center. **Store API verification** shows its state and error codes. Finish or delete it, then run `store` by hand from the tag (**Use workflow from → Tags → vx.y.z**) |
| `store` stops after creating a submission | Open the draft in Partner Center, fix it there and submit by hand. Do not run `store` again while that draft exists |
| `distribute` fails for a published version (a manifest or the cask is refused) | Fix the generator on main, then run `distribute` by hand from main with that tag. The run uses main's generator and the tag's release files |

For wider cases, see the [troubleshooting guide](../troubleshooting.md).
