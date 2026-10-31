# Standard: Testing

## Applies to
- Every code change that enters the repository: the backend (Rust), the page (JS, CSS, HTML), scripts and workflows.
- Not covered: changes to docs only (`docs/`, README, CHANGELOG).
  - Tests do check the section format of CHANGELOG, so changing that format is covered.

## Rules
- Changing a behavior rule:
  1. Change the test that checks the rule.
  2. Watch the changed test fail.
  3. Change the code.
- `pnpm test` (Rust unit tests and the page's Node tests) and `pnpm run lint` (rustfmt, clippy with warnings as errors, Oxlint, Oxfmt, Biome for CSS) pass. CI runs the same commands.
- A changed flow people see (buttons, windows, saving, agent integration): `pnpm run test:e2e` passes.
- A new flow: add a check line to the scenario and the expected list in `tests/e2e.mjs`.
- Pure rules (calculation, conversion, parsing) are split into functions that run without the page or the app.
- Unit tests check them (`src/core/`, `src/yard/`, `scripts/*-lib.mjs`, `mod tests` in each Rust module).
- In the yard these include:
  - the lake's shape (`lakeShape`, `tests/lake.test.mjs`)
  - closeness (`bondProgress`, `tests/bond.test.mjs`)
  - the hint line (`hintKey`, `tests/hint.test.mjs`)
  - seasonal events (`tests/events.test.mjs`)
  - the catalogue (`tests/catalog.test.mjs`)
  - strolling (`tests/wander.test.mjs`)
  - the sound mix (`tests/soundmix.test.mjs`)
- Rust test-only code goes only inside `mod tests` at the end of the file.
- Guard tests scan a file only up to that point.

What goes where.

| What it checks | Where | How to run |
|---|---|---|
| Rust logic | `mod tests` at the end of each `.rs` file | `pnpm test` |
| Pure page logic, style contracts, module rules, strings tables | `tests/*.test.mjs` | `pnpm test` |
| The yard's content loaded the way the page loads it, for tests of rules that read it | `tests/support/content.mjs` (import it before the module under test) | `pnpm test` |
| Seasonal event dates, shared with the backend's `content.rs` test so the page and the backend agree | `tests/fixtures/event-dates.json` | `pnpm test` |
| The page's limits and the backend's values kept equal (it reads the Rust source) | `tests/limits.test.mjs` | `pnpm test` |
| Rules for generating release and distribution files | `tests/release.test.mjs`, `tests/distribute.test.mjs` | `pnpm test` |
| The real app end to end | `tests/e2e.mjs`, test pet in `tests/support/fixture-pet.mjs` | `pnpm run test:e2e` |
| Real responses from community sites | Rust `live_import` (skipped by default) | `pnpm run test:live-import` |

### How E2E runs
- E2E launches the executable built with the `e2e` feature and an isolated data folder, then runs the scenario script inside the app.
- Its windows use an ephemeral WebView profile, so localStorage and IndexedDB cannot change the normal app profile.
- This profile lasts for one process.
- Check persistence across restarts separately, with a disposable normal profile.
- Results come out as `[e2e] name=value` lines.
- The harness compares them with the expected list and prints `✓`/`✖`.

## Recommendations
Follow these when you can. When you cannot, say why in the PR.
- Windows-only code (`#[cfg(windows)]`): confirm it compiles with `pnpm run dist:windows`.
  - Compiling does not prove it runs.
  - If you cannot run the app on Windows yourself, list what still needs a run check in the PR description.
  - On a Mac, you can check the installers in a Windows virtual machine (for example UTM on Apple silicon, with Windows 11 on Arm).
- Changes that touch Linux (`cfg(unix)`, tray, overlay, file permissions): check with `pnpm run dist:linux`.
  - It builds in Docker and then runs E2E on Xvfb with Openbox, so you can see Linux runs from a macOS machine.
- Changes that affect performance: attach the measurements from the [performance standard](performance.md).

## Exceptions
| When | How |
|---|---|
| A flow that cannot have an E2E check line (OS dialogs, a real AI subscription, another OS) | Write how you checked it by hand and the result in the PR description |
| E2E while the window is covered and WebKit has paused animations | The harness skips checks that depend on walking and prints that it did. Not a failure |
| An urgent fix with tests added later | A maintainer approves it, and an issue tracks adding the tests |

## Rationale
- The page has no build step, and the app runs on three operating systems.
- Unit tests check the rules, guard tests check the strings and module structure, and E2E inside the app checks the real windows and backend.
- macOS has no WebDriver, so E2E runs inside the app.
- Based on: decision “[Real-app E2E runs a scenario script inside the app](../decisions/2026-09-29-e2e-inside-the-real-app.md)”

## Automated checks
- `.github/workflows/build.yml` runs lint, unit tests, build and E2E on every PR.
- It runs on main only when the crates or the workflow change, and every Friday:
  - A PR merges only on top of the latest main after passing, so main already holds a tested tree.
  - These runs keep the Rust cache that PRs restore; only main saves it.
- It builds without link-time optimization. A release build is the first with it, and `release.yml` launches that package.
- Runners: macOS, Windows x64 and arm64, Linux x64 and arm64.
- Linux E2E runs on Xvfb with Openbox; the window manager is needed to verify native pinning and fullscreen restoration.
- The site:
  - The `site` job runs `pnpm run site:build`, which catches dead links.
  - `tests/website.test.mjs` checks that every version in the changelog has a release page and that the screenshots a page points to exist.

## Change history
- 2026-10-01 First version — organized "The order for changing and checking" from CONTRIBUTING into rules
- 2026-10-03 Added the site checks (`tests/website.test.mjs`, dead links) to the automated checks
- 2026-10-10 Pure functions in `src/yard/` are unit-tested too; the shared content loader, the event dates shared with Rust, and the limits test
