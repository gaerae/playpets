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
| `PlayPets_0.2.0_windows-x64-setup.exe`, `…-arm64-setup.exe`, `…-portable.zip` | Always |
| `PlayPets_0.2.0_linux-x64.deb`, `….AppImage`, two arm64 files | Always |
| `SHA256SUMS.txt` | Always |
| `latest.json`, `PlayPets_0.2.0_macos-universal.app.tar.gz` | The updater signing secrets exist |

7. Press "Publish release" on the draft. Publishing starts the `distribute` workflow.

8. When the `distribute` run finishes, check the results. Channels without a token are left as the `store-manifests` artifact.
   - winget: if `WINGET_TOKEN` exists, `wingetcreate` opens the PR on winget-pkgs, the first version too (winget's moderators review a new package by hand; later versions are merged by their bots once checks pass). Without the token, submit the artifact's `winget/manifests/…` folder yourself:

```powershell
wingetcreate submit <folder where you unpacked the artifact>\winget\manifests\g\gaerae\PlayPets\0.2.0 --token <GitHub token>
```

   - Homebrew: if `HOMEBREW_TAP_TOKEN` exists, `Casks/playpets.rb` in `<account>/homebrew-tap` changes. If not, copy the artifact's `homebrew/Casks/playpets.rb` into the tap repository and commit it.

## Verification
- The release page has the files from step 6, and the notes match the `## [0.2.0]` section of `CHANGELOG.md`.
- In an app with the previous version installed, pressing "Check for updates" in the Settings tab shows "Version v0.2.0 is available" (when the updater signing secrets exist).
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
