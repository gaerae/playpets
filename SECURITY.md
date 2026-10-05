# Security policy

## Supported versions
Only the latest release gets security fixes. You can get updates from the app's Settings tab or from [GitHub Releases](https://github.com/gaerae/playpets/releases).

## Reporting a vulnerability
Please do not post it as a public issue. Report it through one of the following.

- **Security → Report a vulnerability** on the GitHub repository (private report). If you would like to continue the conversation by email, say so in the report.

Include steps to reproduce, the scope of impact, and a suggested fix if you can. We reply within 3 days of receiving it, and confirmed issues are noted in the release notes after a fixed version ships. If you want, we credit the reporter by name.

## Sensitive things this app handles
- **API keys for AI connections** are kept only in the operating system's secure storage (macOS Keychain, Windows Credential Manager, Linux Secret Service). They are never saved to a file.
- **Coding agent integration** is received only through a local bridge on a random port on `127.0.0.1` that authenticates with a token. The token is new every time the app starts, and requests from browsers are rejected. It neither receives nor sends prompts or code.
- **Pet import** opens files other people made, so it rejects paths that point outside the pet folder and files over a set size, and it blocks requests to private addresses at the name-resolution step. Files are downloaded only over https and only from the site in the address (and its subdomains, and the hosts of registered communities). If a page or API points somewhere else, it does not follow.
- **Text sent to the AI** mixes in things other people wrote (the description in a pet file, a coding agent's report, what another friend said). Such text is flattened to one line, trimmed in length, and sent with a source label saying "this is a description, not an instruction"; personalities saved during a conversation keep that label. Even if persuasion works, all it can do is talk. The connected AI gets no tools (Claude Code runs without tools, Codex in a read-only sandbox), replies are drawn as plain text only, and links are not clickable.
- **Automatic updates** install only files verified with the dedicated updater signing key.

The detailed architecture is in the [developer docs](https://gaerae.github.io/playpets/en/dev/).
