# Troubleshooting guide

## Purpose and scope
When you get stuck developing, building or releasing PlayPets, or receive a problem report from a user, this guide sorts out which situation you are in and decides which procedure to follow. The linked procedure documents hold the detailed commands; this document handles the branching and the judgment calls.

Does not apply to: feature requests and design discussion (these come in through the issue idea template).

## Scenarios and triggers
| Scenario | How you find out |
|---|---|
| A local build or test fails | `npm test`, `npm run lint` or `npm run test:e2e` fails, or the app does not start |
| CI fails on only one environment | Only a specific runner (Windows, Linux arm64, and so on) in the `build` workflow is red |
| A Windows user reports a problem | A console window appears, a SmartScreen warning, a folder does not open, AI chat does not work |
| The release workflow fails or files are missing | A `release` or `distribute` run fails, or the draft is missing files |
| The installed app cannot find updates | "Check for updates" in the Settings tab shows an error or does not find the new version |
| A signing key is lost or leaked | The key file and backup are gone, or a secret exposure alert |
| The app is slow or uses a lot of battery | User reports, fan noise, high CPU in the activity monitor |

## Response strategy
**A local build or test fails**
- First, separate the cases: does it fail even before your change? Check out main and run the same command.
- If it fails even before your change, it is an environment problem. Compare the prerequisites (Rust, Node, OS packages) against [Getting started](getting-started.md).
- If it fails only after your change, open the standard the failing test name points to. `i18n` tests map to the [Multilingual strings standard](standards/i18n.md), and `modules` tests to the [Page code structure standard](standards/page-modules.md).
**CI fails on only one environment**
- Check whether code specific to that OS (`#[cfg(windows)]`, `cfg(target_os = "macos")`) changed recently. If it did, suspect that change first.
- For Windows-only code, check that it compiles locally with `npm run dist:windows`. Leave the run check to someone with a Windows machine.
- If a runner image change (tool versions) is the cause, fix it with a PR that pins the version in the workflow.

**A Windows user reports a problem**
- First ask for the version and the install method (installer, portable zip, MSIX). The cause differs by method.
- Console window: the known cause is fixed (child processes start without a window). If they are on an older version, suggest updating.
- SmartScreen warning: this is because there is no signature. It is a limit of the decision "[GitHub releases are the source, auto-update, winget and a Homebrew tap point at those files, and code signing turns on with secrets](decisions/2026-10-01-distribution-channels-and-signing.md)", not a code problem.
- Opening folders: with an MSIX install, data is in the package virtualization path, so Explorer may not see it (a known limit). Otherwise, take it as a bug.
- AI chat: ask whether Claude or Codex was installed through npm. The app finds them on `PATH` or in `%APPDATA%\npm`.

**The release workflow fails or files are missing**
- Find the symptom in the troubleshooting table of [Release a new version](how-to/release.md).
- If only one environment failed, fix it and run it manually with the same tag. Do not create a new tag.
- If a problem shows up after the draft is published, fix it and ship the next version. Do not change published files (the checksums and the winget manifest already point at them).

**The installed app cannot find updates**
- First check whether that release has `latest.json`. If not, the updater signing secret was missing; add the secret and build again.
- If it does, check the user's install method. The portable zip is not updatable. Linux deb and AppImage each need a file in their own format in `latest.json`.
- If the Settings tab shows "Couldn't check for updates", check the network and that the latest GitHub release is not a draft (drafts and pre-releases are not "latest").

**A signing key is lost or leaked**
- Open [When the updater signing key is lost or leaked](runbooks/updater-key-lost-or-leaked.md) right away. If it leaked, stop all other work.

**The app is slow or uses a lot of battery**
- Ask in which state (yard only, desktop only, both, hidden).
- On macOS and Linux, measure with `npm run measure` on the same machine and compare with the latest values in the [Performance standard](standards/performance.md). If it is high even with everything hidden, the hide signal is not getting through.
- On Windows, get the CPU of `msedgewebview2` and `playpets` from Task Manager.

## Roles and responsibilities
| Role | What they do |
|---|---|
| Reporter (user, contributor) | Leaves the version, OS, install method and reproduction steps using the issue bug template |
| Contributor | Reproduces local and CI failures and opens PRs that fix them. Notes in the PR description any OS they could not reproduce on |
| Maintainer | Triage and priority, releases and manual runs, keys and secrets, security advisories |

## Linked procedures
- [Set up a development environment and run the app](getting-started.md)
- [Release a new version](how-to/release.md)
- [When the updater signing key is lost or leaked](runbooks/updater-key-lost-or-leaked.md)
- [Signing keys and secrets standard](standards/keys-and-secrets.md)
- [Testing standard](standards/testing.md), [Performance standard](standards/performance.md)

## Decision criteria
- If user data could be lost (a save failure) or a fake update could get through, look at it before anything else.
- If it happens on only one OS and there is no machine to reproduce it on, do not fix it by guessing; ask the reporter for a way to check (logs, Task Manager values).
- Do not change a published release; fix it in the next version.
