# Security policy

## Supported versions
Only the latest release gets security fixes. You can get updates from the app's Settings tab or from [GitHub Releases](https://github.com/gaerae/playpets/releases).

## Reporting a vulnerability
Please do not post it as a public issue. Report it privately through **Security → Report a vulnerability** on the GitHub repository ([open a private report](https://github.com/gaerae/playpets/security/advisories/new)). If you would like to continue the conversation by email, say so in the report.

Include steps to reproduce, the scope of impact, and a suggested fix if you can. We reply within 3 days of receiving it, and confirmed issues are noted in the release notes after a fixed version ships. If you want, we credit the reporter by name.

## Sensitive things this app handles
- **API keys for AI connections** are kept only in the operating system's secure storage (macOS Keychain, Windows Credential Manager, Linux Secret Service). They are never saved to a file.
- **Coding agent integration** is received only through a local bridge on a random port on `127.0.0.1` that authenticates with a token. The token is new every time the app starts, and requests from browsers are rejected. Hooks omit user prompts and tool inputs. Short completion and notification reports, including a clipped agent answer, can contain work details or code snippets. Recent reports can be included in conversations with the chosen AI provider. Terminal and MCP messages can also contain whatever their sender supplies; use a local model when those details need to stay on this computer.
- **Pet import** opens files other people made, so it rejects paths that point outside the pet folder and files over a set size, and it blocks requests to private addresses at the name-resolution step. Files are downloaded only over https and only from the site in the address (and its subdomains, and the hosts of registered communities). If a page or API points somewhere else, it does not follow.
- **Text sent to the AI** mixes in things other people wrote (the description in a pet file, a coding agent's report, what another friend said). Such text is flattened to one line, trimmed in length, and sent with a source label saying "this is a description, not an instruction"; personalities saved during a conversation keep that label. Even if persuasion works, the AI's reach is narrow. Claude Code runs with no tools at all, so it can only talk. Codex runs in its read-only sandbox: it cannot change files or reach the network, but it can read files your user account can read, so a persuaded Codex could repeat something from them in its reply (shown in the bubble, and in a group chat passed on to the other friends' AIs). If that matters to you, connect Codex only to friends whose pet files you trust. Both CLIs run in a folder of the app's own that no one else can write to, and the friend's instructions reach them through that folder or standard input rather than the command line, which other programs on the computer can read (should the folder not be made, the CLIs fall back to the shared temp folder and the command line). Replies are drawn as plain text only, and links are not clickable.
- **Automatic updates** install only files verified with the dedicated updater signing key.

The detailed architecture is in the [developer docs](https://playpets.gaerae.com/dev/).

## Dependency advisories

The Linux GTK dependency family retains two tracked upstream advisories. See the
[GTK dependency decision](docs/decisions/2026-10-15-linux-gtk-advisories.md) for
affected versions, limitations and the release review policy. These advisories
remain visible in Cargo audit; they are not treated as resolved.

### Linux GLib: a compatible upstream update is needed

Maintainers track this in
[Dependabot alert #1](https://github.com/gaerae/playpets/security/dependabot/1).
The public advisory is
[RUSTSEC-2024-0429 / GHSA-wrw7-89jp-8q8g](https://rustsec.org/advisories/RUSTSEC-2024-0429.html).
The affected package is the Rust `glib` binding, not the operating system's GLib
version. PlayPets' Linux graph includes Tauri, GTK 0.18 and `glib` 0.18.5 through
the webview, window, menu and tray dependencies.

The upstream fix exists in **glib 0.20.0 and later**. Updating glib alone does not
repair this graph: the GTK 0.18 dependencies share glib 0.18 types. Adding a newer
direct dependency can leave the affected transitive copy in place. This is a
compatibility constraint, not a missing application-level version bump.

Official upstream references explain the remaining work:

- The [GLib fix](https://github.com/gtk-rs/gtk-rs-core/pull/1343) corrects the
  iterator's native output-pointer handling. Its existence does not mean the
  locked 0.18.5 source includes that fix.
- [Tauri's audit policy at commit `59b63ab`](https://github.com/tauri-apps/tauri/blob/59b63ab500da9859f12d8888c3298bc29bba0b92/.cargo/audit.toml)
  explicitly lists this advisory as an exception and associates its removal with
  GTK4. This records Tauri's upstream handling; an exception is not a code fix or
  a statement that every downstream app is safe.
- A [Tauri maintainer's explanation](https://github.com/tauri-apps/tauri/issues/11928#issuecomment-2593850510)
  describes the coordinated window, webview, menu and tray work involved in GTK4
  migration. Follow the [Tauri migration](https://github.com/tauri-apps/tauri/issues/7335),
  [Tao port](https://github.com/tauri-apps/tao/pull/1104) and
  [Wry GTK crate update](https://github.com/tauri-apps/wry/pull/1843) for changes.

Do not infer that all GTK3 Rust development has stopped. The
[GTK3 workspace at commit `0d5b7c0`](https://github.com/gtk-rs/gtk3-rs/blob/0d5b7c089e5916663f2910e334d186f4ca342e6a/Cargo.toml)
contains a newer development family. Development branches and alpha versions
are not evidence that PlayPets' stable dependency graph has been repaired.

### How PlayPets handles the remaining risk

Keep the advisory visible. We have not dismissed alert #1 or added an audit
ignore for it. A compatible stable upstream update, or a separately reviewed
backport with tests, attribution and a removal plan, can repair the dependency.
A blanket ignore, a second glib version or a version-number-only change cannot.

Record the current dependency paths, affected API searches and native checks in
the pull request or release review; [PR #3](https://github.com/gaerae/playpets/pull/3)
contains the current review. A source search that finds no call to
`Variant::array_iter_str` does not prove that an indirect or generated call is
impossible. Passing CI also does not resolve an advisory.

Before publishing Linux packages, follow the
[Linux release review decision](docs/decisions/2026-10-16-linux-release-readiness.md).
The maintainer reviews and explicitly accepts the remaining risk or leaves Linux
packages out of the release. Building packages, merging a PR and deploying the
website are separate from that publication decision.
