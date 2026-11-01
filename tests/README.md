# Test entry points and fixtures

- `pnpm run test:js` runs every top-level `*.test.mjs` with Node's test runner.
- `pnpm run test:rust` runs Rust unit tests; `pnpm test` runs both.
- New Node test entry points use the same suffix, so that command finds them.
- Creator helper tests need Python with the Pillow version pinned in
  `assets/creator-skill/playpets-creator/requirements.txt`.
  - Activate that environment, or set `PLAYPETS_PYTHON` to its executable,
    before running the suite.
  - CI installs the same dependency.
  - Isolated installation steps: [development setup](../docs/getting-started.md).

| Area | Examples |
| --- | --- |
| Page rules and shared state | `modules`, `animation`, `i18n`, `keys`, `ui-style` |
| Yard behavior and lifecycle | `garden`, `fishing-style`, `catch-*`, `worlds`, `*-lifecycle` |
| Panels and recovery | `chat-*`, `invite*`, `settings-*`, `friend-*` |
| Artwork and creator files | `atlas`, `*-art`, `creator-*`, `companion-*` |
| Site and repository tooling | `website*`, `landing`, `site-content`, `release`, `release-notes`, `distribute`, `repository-config`, `local-commands` |

- `support/` holds reusable fixture builders and loaders:
  - `content.mjs` loads the yard's content (catalog, yard, events, worlds) the
    way the page does.
  - `dom.mjs` is the fake DOM (elements, document, localStorage, putting globals
    back) that page tests share instead of writing their own.
- `fixtures/` holds shared data, including seasonal dates also read by Rust tests.
- Keep fixtures deterministic and free of user data.
- One file: `node --test tests/animation.test.mjs`. Useful during development;
  it does not replace the combined checks before a PR.

- `e2e.mjs` is not a Node unit-test entry, on purpose.
- `pnpm run test:e2e` builds the test-feature app and runs its scenario with
  isolated data.
- Do not run it as a unit test or against the installed app's personal data.
  See the [testing standard](../docs/standards/testing.md).
- Headless Linux host: `pnpm run test:e2e:linux` starts an isolated D-Bus, Xvfb
  and Openbox session.
  - Needs `xvfb`, `xauth`, `dbus-x11`, `openbox` and `x11-utils`.
  - Xvfb alone cannot confirm native pinning or fullscreen restoration.

- Windows CI also runs `pnpm run test:msix:ci` after the native E2E, on x64 and
  ARM64.
- `packaging/windows/msix/ci.ps1` refuses to run outside a GitHub Windows runner.
  It:
  - creates a temporary signing certificate;
  - installs a separate `PlayPets.CI` package;
  - launches the production binary through its AUMID;
  - tests update ownership and preference retention with an E2E-feature package
    upgrade.
- `msix-scenario.mjs` shares its assertions with `msix-ci.test.mjs`.
- The Node tests never install packages or change certificate stores.
- Reports and logs are the `msix-verification-windows-*` CI artifacts.
- Sideloaded package upgrades versus actual Store delivery: see the
  [Store guide](../docs/how-to/store-and-apple-signing.md).
- `store-api.test.mjs` exercises the credential and HTTP boundary without real
  keys: product identity, redirect refusal and secret-safe errors.
- `store-submit.test.mjs` covers:
  - first-registration, pending-draft and same-version refusal;
  - the publish mode and kept certification notes;
  - copied pricing kept in the update, and upload destination validation;
  - the wait after the commit and what happens to a refused submission;
  - What's new from the release pages;
  - the `store.yml` job boundaries and the `store-retry.yml` checks.
- These tests do not request certification or establish that Store delivery
  works.
