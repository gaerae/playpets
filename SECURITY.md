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

The detailed architecture is in the [developer docs](https://gaerae.github.io/playpets/dev/).

## Dependency advisories

The Linux GTK dependency family retains two tracked upstream advisories. See the
[GTK dependency decision](docs/decisions/2026-10-15-linux-gtk-advisories.md) for
affected versions, limitations and the release review policy. These advisories
remain visible in Cargo audit; they are not treated as resolved.
