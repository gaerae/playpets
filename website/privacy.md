---
title: Privacy policy
description: What PlayPets stores locally, what reaches connected services, and how to remove your data.
---
# Privacy policy

- Last updated: October 18, 2026.
- Maintainer: gaerae, the maintainer of [PlayPets](https://github.com/gaerae/playpets).
- Covers the desktop app and this website.
- Takes effect when this version of the policy is published.

## The desktop app

**No account, no tracking**
- No required PlayPets account.
- No developer-operated chat service.
- No advertising, analytics or automatic crash-report uploads in the app.
- Ordinary movement, games and collecting do not require an AI connection.

**Saved on your device**
- Friends, names, personas, relationships, collection progress, imported assets, AI connection settings and app preferences.
- API keys saved through PlayPets: in the operating system's credential store, separate from the app's JSON settings.
- Interface preferences: in the app's local webview storage.

**Conversations**
- Conversation history stays in memory for the current app session. PlayPets does not write a conversation transcript to its data folder.
- A persona or other setting derived from a conversation can be saved when the corresponding feature is used.
- This does not mean the connected AI service or CLI keeps no records.

## AI connections and coding agents

**What is sent**
- With an AI connection enabled, prompts can include:
  - your message and recent conversation
  - friend names and personas
  - relationship settings
  - relevant agent information
- They go to the provider or local server you selected.
- Automatic chatter uses that connection while enabled.
- Remote providers may process information outside your country. Their own retention, training and deletion policies apply.
- A local endpoint stays local only if the selected model and its configuration do so.

**CLIs and coding agents**
- Claude Code and Codex connections invoke your installed, signed-in CLI.
- That tool and its provider may create their own files, sessions and logs. PlayPets does not control their retention.
- Coding-agent integrations receive the status and reports you configure the agent to send, over a token-protected loopback connection.
- Avoid putting secrets or sensitive personal information into conversations, personas or agent reports.

## Downloads, updates and external sites

- Importing community pets or opening galleries contacts the chosen external service.
- GitHub installations can contact GitHub automatically to check for updates and download a newer version.
- MSIX installations use package-managed updates instead of PlayPets downloading the GitHub EXE installer.
- Microsoft Store handles updates for Store installations.
- These services receive normal network information such as your IP address.
- Their privacy policies apply to their services.

## This website

- Hosted on GitHub Pages.
- Your browser can contact:
  - GitHub, for release information and downloads
  - Google Fonts and jsDelivr, for fonts
- Those hosts receive request information such as IP address and browser headers, under their own policies.
- Language and theme preferences may use browser storage.
- We have not added advertising or an analytics service to the site.
- Creator kits and skills are downloads to use with tools you choose.
- The website does not generate images through a PlayPets AI server.
- Files processed by an external AI tool are governed by that tool's policies.

## Retention and removal

- Local settings remain until you remove them.
- Remove an AI connection in Settings to remove its saved API key.
- Fully quit PlayPets to clear its in-memory conversations.
- To reset local data:
  1. Remove credentials first, so the app can still identify the keys to remove.
  2. Open the data folder from Settings.
  3. Quit the app.
  4. Remove the files you want to reset.
- Uninstalling alone may leave data, credentials or backups.
- External provider records and CLI logs must be removed through those tools or providers.

| Default data location | Path |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\` |
| Linux | `~/.local/share/app.playpets/` |

- MSIX can virtualize the Windows path. Use the app's data-folder action.
- An explicit custom data location overrides these defaults.

## Contact and changes

- Privacy questions or requests: [contact the maintainer through the project](https://github.com/gaerae/playpets/issues/new/choose).
- GitHub issues are public. Do not include personal data, keys, chat logs or identity documents.
- You can ask for a private contact route without including the sensitive information itself.
- The maintainer cannot erase files on your device or records held by another provider.
- Policy changes are published on this page with an updated date.
