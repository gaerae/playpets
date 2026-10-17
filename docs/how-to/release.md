# Release a new version

## Purpose
Tag a new version `x.y.z`, then review and publish the GitHub release draft that CI fills with the files it builds for every platform. Once it is published, installed apps can find the update when updater signing is configured, and the winget and Homebrew tap files are generated. Why the flow works this way is in the decision "[The version lives only in package.json, and a version tag creates a draft release](../decisions/2026-09-30-releases-from-version-tags.md)".

## Audience and assumptions
A maintainer does this. You need write access to the repository and a clean local working tree on main. Signing and the distribution channels turn on only when the repository secrets exist; the release still works without them. The list of secrets is in the [signing keys and secrets standard](../standards/keys-and-secrets.md).

## Prerequisites
- CI (the `build` workflow) passed on every platform for the latest commit on main.
- `CHANGELOG.md` lists this version's changes under `## [Unreleased]`. If it is empty, the release command stops.
- You chose the version number. Bump the second number when people get new features, and the third when there are only fixes.
- `git status` is empty locally.
- The release pages for this version are written in all four site languages: `website/releases/<version>.md` (English), `website/ko/releases/<version>.md`, `website/ja/releases/<version>.md` and `website/zh-hans/releases/<version>.md`. Each has the release highlights a visitor reads first, written by hand. See [Edit and check the website](website.md).
- The one-time repository setup is done ([Set up the repository, keys and store accounts](set-up-the-repository.md)): Pages from GitHub Actions, private vulnerability reporting, the updater signing secrets, and for the stores the Homebrew tap and the winget-pkgs fork.

## First public release hand-off

Complete these in order; a successful local build does not establish that a
published update can be downloaded and installed.

- Integrate reviewed local branches into `main`, then run `npm run check` and
  `npm run test:e2e` on the resulting commit.
- Scan the reachable history before its first push with `gitleaks git --redact --log-opts=main`.
  Check tracked files as well as ignore rules; private data and build output do not belong in Git.
- Run `npm audit`, `cargo audit --file src-tauri/Cargo.lock` and `actionlint` with
  current advisory data. Review informational warnings too. Record unresolved
  advisories, affected platforms and any reachability assessment in the release
  review; a passing unit test does not establish that a dependency is safe.
- Review third-party license notices for the dependencies actually bundled in
  each platform package and the built website. Include the required license and
  copyright texts with those distributions; the repository MIT license does not
  replace dependency notices. Run `npm run licenses:check`; regeneration and
  distribution scope are documented in [third-party notices](../../packaging/licenses/README.md).
  The Rust inventory does not cover system libraries copied into an AppImage;
  review the final image and their source/relinking obligations before publication.
- Confirm both Linux `SYSTEM-SOURCE-PACKAGES.txt` assets are present. Release CI
  builds an initial image from the executable's native library graph, extracts
  its actual system libraries, then rebuilds the final image with their
  distribution copyright files. It compares every copied library with those
  files and records the exact Ubuntu binary and source package versions used to
  build it.
- Rebuild distribution files after dependency changes. Older files under ignored
  `release/` are not evidence for the current commit and are not publication inputs.
- Connect the GitHub remote and push `main`; enable Pages from GitHub Actions and
  configure updater signing as described in [repository setup](set-up-the-repository.md).
- Check the platform CI results, four-language site routes, release links and
  installation instructions before publishing the release draft.
- Read the native package smoke-test result for every release job. It copies the
  app from the dmg, silently installs and uninstalls the NSIS package, and installs
  the deb; it launches those packages and the AppImage for eight seconds with
  isolated app data. This catches package hand-off failures but does not replace
  the interactive installer and Gatekeeper/SmartScreen review on real user machines.
- Refresh public captures when a visible change affects them. The full yard,
  small window, places, Friend, Invite and Settings should match the shipped app.
- Test a signed upgrade from an older installed build to a newer published build
  on each supported installer format. Check download progress, a failed attempt
  and retry, restart, the one-time version notice, and preserved friends/settings.
  A mocked updater event proves UI behavior, not the installer hand-off.
- Treat Homebrew, winget and optional platform signing as separate distribution
  steps; record which channels are actually available in the release notes.

## Steps
1. Pull the latest main.

```bash
git switch main && git pull
```

2. Capture the screens for the site (macOS). The first time, macOS asks for screen recording permission; allow it. The results land in `website/public/shots/0.2.0/` in every app language. Then redraw the installer art, which also turns the English captures into the screenshots Linux software centers show, and commit both.

```bash
npm run shots -- 0.2.0
npm run art
```

3. Make the release commit and tag. The changelog section moves to a dated section, and the version changes in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`. The version is also added, dated, to the releases in `packaging/linux/app.playpets.metainfo.xml`. The command also dates the website release pages: it sets today's date in `website/releases/0.2.0.md`, `website/ko/releases/0.2.0.md`, `website/ja/releases/0.2.0.md` and `website/zh-hans/releases/0.2.0.md`. If the Korean, Japanese or Chinese page is missing, it stops before changing anything; a missing English page is started from the changelog notes, without highlights, so write all four before you run it. Everything goes into one release commit. Nothing is pushed.

```bash
npm run release -- 0.2.0
```

4. Push the commit and the tag. The tag starts the `release` workflow.

```bash
git push origin HEAD v0.2.0
```

5. Open the `release` run in the repository's Actions tab. Watch `check` (tag, version and changelog agree), `build` on five platforms, and `publish` finish in order.

6. Open the `PlayPets 0.2.0` draft in the Releases tab. Check the file list and the notes.

| File | Present when |
|---|---|
| `PlayPets_0.2.0_macos-universal.dmg` | Always |
| `PlayPets_0.2.0_windows-x64-setup.exe`, `…-arm64-setup.exe` | Always |
| `PlayPets_0.2.0_linux-x64.deb`, `….AppImage`, two arm64 files | Always |
| Two Linux `…-SYSTEM-SOURCE-PACKAGES.txt` files | Always |
| `SHA256SUMS.txt` | Always |
| `latest.json`, `PlayPets_0.2.0_macos-universal.app.tar.gz` | The updater signing secrets exist |

7. After the checks pass, press "Publish release" on the draft. Publishing starts the `distribute` workflow. The four version pages ask GitHub for that exact public tag in the visitor's browser; they expose the tag and installer links only after GitHub returns it. Publication therefore needs no follow-up documentation commit or Pages deployment. If GitHub cannot be reached, the page keeps a safe link to the release list.

8. When the `distribute` run finishes, check the results. Channels without a token are left as the `store-manifests` artifact.
   - winget: if `WINGET_TOKEN` exists, `wingetcreate` opens the PR on winget-pkgs, the first version too (winget's moderators review a new package by hand; later versions are merged by their bots once checks pass). Without the token, submit the artifact's `winget/manifests/…` folder yourself:

```powershell
wingetcreate submit <folder where you unpacked the artifact>\winget\manifests\g\gaerae\PlayPets\0.2.0 --token <GitHub token>
```

   - Homebrew: if `HOMEBREW_TAP_TOKEN` exists, `Casks/playpets.rb` in `<account>/homebrew-tap` changes. If not, copy the artifact's `homebrew/Casks/playpets.rb` into the tap repository and commit it.

## Verification
- The release page has the files from step 6, and the notes match the `## [0.2.0]` section of `CHANGELOG.md`.
- In an app with the previous version installed, an automatic or manual check shows the new version before the place selector. Complete installation and restart, confirm the running version and brief completion notice, then restart again to check that the notice does not repeat (when the updater signing secrets exist).
- The winget PR passes its checks, or `brew upgrade --cask playpets` on a computer with the tap gets the new version.
- With signing secrets, `latest.json` lists every platform the release has, including `linux-x86_64-deb` and `linux-aarch64-deb` entries for deb installs; if those are missing, deb users do not get updates in the app.

## Troubleshooting
| Symptom | Fix |
|---|---|
| `check` fails with "package.json is not x.y.z" | The tag and the version differ. Delete the tag (`git push --delete origin vx.y.z`, `git tag -d vx.y.z`) and start again from step 2 |
| `check` fails with "no section for x.y.z" | The changelog has no such section. The tag was made without the release command |
| Only one platform's `build` fails | Read that runner's log and fix it, then run `release` by hand from Actions with the same tag (workflow_dispatch, tag input) |
| The draft has no `latest.json` | The updater signing secrets are missing. Installed apps cannot find this release. Add the secrets, delete the draft, and run `release` by hand with the same tag |
| `gh release create` fails with "already exists" | A draft for the same tag already exists. Delete that draft and run it by hand |

For wider cases, see the [troubleshooting guide](../troubleshooting.md).
