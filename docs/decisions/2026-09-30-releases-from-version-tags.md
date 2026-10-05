# Decision: The version lives only in package.json, and a version tag creates a draft release

## Context
Version `0.1.0` was written separately in three places, `package.json`, `Cargo.toml` and `tauri.conf.json`, and nothing noticed when they drifted apart. There was no changelog either, so users had to read the commit list to learn what changed. CI built on every push to main, but the output was temporary files attached to the run, and the macOS output (an `.app` folder) lost its execute permission in the artifact upload, so it might not open after download.

## Decision
We write the version in one place, `package.json`, and `tauri.conf.json` reads it from there (`"version": "../package.json"`). `Cargo.toml` and the lock file hold the same value, and a test checks that they match. Every PR adds user-visible changes under `[Unreleased]` in `CHANGELOG.md`. For a release, `npm run release -- x.y.z` moves that changelog section into a dated section, applies the version, and creates a commit and a `vx.y.z` tag. Pushing the tag makes `.github/workflows/release.yml` build every platform and create a GitHub release **draft**, which a person checks and then publishes.

## Consequences
- Positive: The version cannot drift. Release notes come straight from the changelog. A person sees the files and notes before publishing.
- Negative: The release command creates a commit and a tag locally, so main has to be clean. Every PR has to add a changelog line.
- Neutral: Pushing a tag starts a release, so pushing a wrong tag creates a draft (it is a draft, so nothing is made public).

## Alternatives considered
- **Generate the changelog from commit messages (Conventional Commits):** Commit format would have to change, and commit sentences written for developers would go out as user notes as they are.
- **Build and release in one go with tauri-action:** Convenient, but keeping file names, checksums and draft notes to our rules meant writing the steps ourselves anyway, so we wrote them as shell steps.
