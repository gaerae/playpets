# Test entry points and fixtures

`npm run test:js` runs every top-level `*.test.mjs` with Node's test runner.
`npm run test:rust` runs Rust unit tests, and `npm test` runs both. New Node test
entry points use the same suffix and stay discoverable by that command.

Creator helper tests need Python with the Pillow version pinned in
`assets/creator-skill/playpets-creator/requirements.txt`. Activate that environment
or set `PLAYPETS_PYTHON` to its executable before running the suite. CI installs
the same dependency. See [development setup](../docs/getting-started.md) for the
isolated installation steps.

| Area | Examples |
| --- | --- |
| Page rules and shared state | `modules`, `animation`, `i18n`, `keys`, `ui-style` |
| Yard behavior and lifecycle | `garden`, `fishing-style`, `catch-*`, `worlds`, `*-lifecycle` |
| Panels and recovery | `chat-*`, `invite*`, `settings-*`, `friend-*` |
| Artwork and creator files | `atlas`, `*-art`, `creator-*`, `companion-*` |
| Site and repository tooling | `website*`, `landing`, `site-content`, `release`, `distribute`, `repository-config`, `local-commands` |

`support/` contains reusable fixture builders and loaders: `content.mjs` loads the
yard's content (catalog, yard, events, worlds) the way the page does, and `dom.mjs`
is the fake DOM (elements, document, localStorage, putting globals back) that page
tests share instead of writing their own. `fixtures/` contains
shared data, including seasonal dates also read by Rust tests. Keep fixtures
deterministic and free of user data.

For one file, run `node --test tests/animation.test.mjs`. A filtered check is useful
during development but does not replace the combined checks before a PR.

`e2e.mjs` is intentionally not a Node unit-test entry: `npm run test:e2e` builds
the test-feature app and runs its scenario with isolated data. Do not run it as a
unit test or against the installed app's personal data. See the
[testing standard](../docs/standards/testing.md).

On a headless Linux host, `npm run test:e2e:linux` starts an isolated D-Bus,
Xvfb and Openbox session. It needs `xvfb`, `xauth`, `dbus-x11`, `openbox` and
`x11-utils`; Xvfb alone cannot confirm native pinning or fullscreen restoration.

Windows CI also runs `npm run test:msix:ci` after the native E2E on x64 and ARM64.
`packaging/windows/msix/ci.ps1` refuses to run outside a GitHub Windows runner:
it creates a temporary signing certificate, installs a separate `PlayPets.CI`
package, launches the production binary through its AUMID, and tests update
ownership and preference retention with an E2E-feature package upgrade.
`msix-scenario.mjs` shares its assertions with `msix-ci.test.mjs`; the Node tests
never install packages or change certificate stores. Reports and logs are the
`msix-verification-windows-*` CI artifacts. See the
[Store guide](../docs/how-to/store-and-apple-signing.md) for the boundary between
sideloaded package upgrades and actual Store delivery.

`store-api.test.mjs` exercises the credential and HTTP boundary without real
keys, including product identity, redirect refusal and secret-safe errors.
`store-submit.test.mjs` covers first-registration and pending-draft refusal,
manual publication hold, Pricing V2 omission and upload destination validation.
These tests do not request certification or establish that Store delivery works.
