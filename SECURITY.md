# Security policy

## Supported versions
- Only the latest release gets security fixes.
- Get updates from the app's Settings tab or [GitHub Releases](https://github.com/gaerae/playpets/releases).

## Reporting a vulnerability
- Do not post it as a public issue.
- Report it privately through **Security → Report a vulnerability** on the GitHub repository ([open a private report](https://github.com/gaerae/playpets/security/advisories/new)).
- To continue by email, say so in the report.
- Include steps to reproduce, the scope of impact, and a suggested fix if you can.
- We reply within 3 days of receiving it.
- Confirmed issues are noted in the release notes after a fixed version ships.
- If you want, we credit the reporter by name.

## Sensitive things this app handles
- **API keys for AI connections**
  - Kept only in the operating system's secure storage (macOS Keychain, Windows Credential Manager, Linux Secret Service).
  - Never saved to a file.
- **Coding agent integration**
  - Received only through a local bridge on a random port on `127.0.0.1` that authenticates with a token.
  - The token is new every time the app starts; requests from browsers are rejected.
  - Hooks omit user prompts and tool inputs.
  - Short completion and notification reports, including a clipped agent answer, can contain work details or code snippets.
  - Recent reports can be included in conversations with the chosen AI provider.
  - Terminal and MCP messages can contain whatever their sender supplies.
  - Use a local model when those details need to stay on this computer.
- **Pet import** opens files other people made, so it:
  - rejects paths that point outside the pet folder, and files over a set size;
  - blocks requests to private addresses at the name-resolution step;
  - downloads only over https, only from the site in the address (and its subdomains, and the hosts of registered communities);
  - does not follow a page or API that points somewhere else;
  - reads a pet ZIP only when it is plain: no encrypted or ZIP64 archives, no names that leave the folder, at most 128 MB and 256 entries, at most 256 MB unpacked, and each file's checksum must match; files Windows cannot name are left out, and only the pet's JSON, pictures and text notes are written (no scripts, pages or shortcuts).
- **Text sent to the AI** mixes in things other people wrote (the description in a pet file, a coding agent's report, what another friend said).
  - Such text is flattened to one line, trimmed in length, and sent with a source label saying "this is a description, not an instruction".
  - Personalities saved during a conversation keep that label.
  - Even if persuasion works, the AI's reach is narrow.
  - Claude Code runs with no tools at all, so it can only talk.
  - Codex runs in its read-only sandbox: it cannot change files or reach the network, but it can read files your user account can read.
  - A persuaded Codex could repeat something from those files in its reply (shown in the bubble, and in a group chat passed on to the other friends' AIs).
  - If that matters to you, connect Codex only to friends whose pet files you trust.
  - Both CLIs run in a folder of the app's own that no one else can write to.
  - The friend's instructions reach them through that folder or standard input, not the command line, which other programs on the computer can read.
  - If the folder cannot be made, the CLIs fall back to the shared temp folder and the command line.
  - Replies are drawn as plain text only; links are not clickable.
- **Automatic updates** install only files verified with the dedicated updater signing key.

Detailed architecture: [developer docs](https://playpets.gaerae.com/dev/).

## Dependency advisories

- The Linux GTK dependency family retains two tracked upstream advisories.
- Affected versions, limitations and the release review policy:
  [GTK dependency decision](docs/decisions/2026-10-15-linux-gtk-advisories.md).
- These advisories stay visible in Cargo audit; they are not treated as resolved.

### Linux GLib: a compatible upstream update is needed

- Maintainers track it in
  [Dependabot alert #1](https://github.com/gaerae/playpets/security/dependabot/1).
- Public advisory:
  [RUSTSEC-2024-0429 / GHSA-wrw7-89jp-8q8g](https://rustsec.org/advisories/RUSTSEC-2024-0429.html).
- Affected package: the Rust `glib` binding, not the operating system's GLib
  version.
- PlayPets' Linux graph includes Tauri, GTK 0.18 and `glib` 0.18.5 through the
  webview, window, menu and tray dependencies.
- The upstream fix is in **glib 0.20.0 and later**.
- Updating glib alone does not repair this graph: the GTK 0.18 dependencies share
  glib 0.18 types.
- A newer direct dependency can leave the affected transitive copy in place.
- This is a compatibility constraint, not a missing application-level version
  bump.

Official upstream references for the remaining work:

- The [GLib fix](https://github.com/gtk-rs/gtk-rs-core/pull/1343) corrects the
  iterator's native output-pointer handling. Its existence does not mean the
  locked 0.18.5 source includes that fix.
- [Tauri's audit policy at commit `59b63ab`](https://github.com/tauri-apps/tauri/blob/59b63ab500da9859f12d8888c3298bc29bba0b92/.cargo/audit.toml)
  lists this advisory as an exception and ties its removal to GTK4. This records
  Tauri's upstream handling; an exception is not a code fix or a statement that
  every downstream app is safe.
- A [Tauri maintainer's explanation](https://github.com/tauri-apps/tauri/issues/11928#issuecomment-2593850510)
  describes the coordinated window, webview, menu and tray work in the GTK4
  migration. Follow the [Tauri migration](https://github.com/tauri-apps/tauri/issues/7335),
  [Tao port](https://github.com/tauri-apps/tao/pull/1104) and
  [Wry GTK crate update](https://github.com/tauri-apps/wry/pull/1843) for changes.
- GTK3 Rust development has not all stopped: the
  [GTK3 workspace at commit `0d5b7c0`](https://github.com/gtk-rs/gtk3-rs/blob/0d5b7c089e5916663f2910e334d186f4ca342e6a/Cargo.toml)
  contains a newer development family.
- Development branches and alpha versions are not evidence that PlayPets' stable
  dependency graph has been repaired.

### How PlayPets handles the remaining risk

- Keep the advisory visible. Alert #1 is not dismissed and has no audit ignore.
- What can repair the dependency:
  - a compatible stable upstream update;
  - a separately reviewed backport with tests, attribution and a removal plan.
- What cannot: a blanket ignore, a second glib version or a version-number-only
  change.
- Record the current dependency paths, affected API searches and native checks in
  the pull request or release review.
- [PR #3](https://github.com/gaerae/playpets/pull/3) contains the current review.
- A source search that finds no call to `Variant::array_iter_str` does not prove
  that an indirect or generated call is impossible.
- Passing CI does not resolve an advisory.
- Before publishing Linux packages, follow the
  [Linux release review decision](docs/decisions/2026-10-16-linux-release-readiness.md).
- The maintainer explicitly accepts the remaining risk or leaves Linux packages
  out of the release.
- Building packages, merging a PR and deploying the website are separate from
  that publication decision.

## Automated security checks

- The `security` workflow runs `npm run security:check` on pull requests, main
  and weekly:
  - Gitleaks scans the complete checked-out history, with redacted findings.
  - npm audits all locked dependencies, including website tooling.
  - cargo-audit checks the Rust lockfile against current RustSec data.
- Maintainers can run the same command locally with Gitleaks 8.30.1 and
  cargo-audit 0.22.2 installed.
- CI verifies the Gitleaks archive checksum and pins the audit tool version.
- npm never runs dependencies' install scripts (`ignore-scripts=true` in `.npmrc`).
  - A compromised package cannot run code during `npm ci`.
  - The jobs that hold signing secrets and the container builds also pass
    `--ignore-scripts`, so a change to `.npmrc` alone does not undo it there.
- No source paths or known advisories are broadly excluded to make the checks
  pass.
- The separate `codeql` workflow analyzes Actions, JavaScript, Python creator
  tools and Rust sources.
  - It does not build signed packages or receive signing secrets.
  - Only its analysis job can upload security events.
- These checks complement the native installation, updater and dependency
  reviews; they do not establish that all dependency paths or desktop behaviors
  are safe.
