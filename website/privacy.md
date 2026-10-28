---
title: Privacy policy
description: What PlayPets keeps on your device, what reaches the services you connect, and how to remove your data.
---
# Privacy policy

- Last updated: October 29, 2026.
- Maintainer: gaerae, the maintainer of [PlayPets](https://github.com/gaerae/playpets).
- Covers the desktop app and this website.
- Takes effect when this version of the policy is published.

## The desktop app

**No account, no tracking**
- PlayPets doesn't require an account.
- The developer doesn't operate a chat service.
- The app has no advertising, no analytics and no automatic crash-report uploads.
- Ordinary movement, games and collecting don't need an AI connection.

**Saved on your device**
- Friends, names, personas, relationships, collection progress, imported assets, AI connection settings and app preferences.
- API keys you save through PlayPets go to the operating system's credential store, separate from the app's JSON settings.
- Imported backgrounds and the place and weather you pick are saved in the data folder with the rest. A few interface notes, such as which tips you have seen, stay in the app's local webview storage.

**Conversations**

Conversation history stays in memory for the current app session, and PlayPets doesn't write a transcript to its data folder. A persona or other setting derived from a conversation can be saved when you use the feature that makes it. None of this means the connected AI service or CLI keeps no records.

## AI connections and coding agents

**What is sent**

With an AI connection on, prompts can include:
- your message and recent conversation
- friend names and personas
- relationship settings
- relevant agent information

They go to the provider or local server you selected. Automatic chatter uses the same connection while it's on.
- Remote providers may process information outside your country. Their own retention, training and deletion policies apply.
- A local endpoint stays local only if the selected model and its configuration keep it that way.

**CLIs and coding agents**
- Claude Code and Codex connections run the CLI you installed and signed in to.
- That tool and its provider may create their own files, sessions and logs. PlayPets doesn't control how long they keep them.
- Coding-agent integrations receive the status and reports you set the agent to send, over a token-protected loopback connection.
- Keep secrets and sensitive personal information out of conversations, personas and agent reports.

## Downloads, updates and external sites

- Importing community pets or opening galleries contacts the external service you chose.
- GitHub installations can contact GitHub automatically to check for updates and download a newer version.
- MSIX installations use package-managed updates; PlayPets doesn't download the GitHub EXE installer for them.
- Microsoft Store handles updates for Store installations.
- These services receive normal network information such as your IP address, and their own privacy policies apply.

## This website

The site is hosted on GitHub Pages. Your browser can contact:
- GitHub, for release information and downloads
- Google Fonts and jsDelivr, for fonts

Those hosts receive request information such as your IP address and browser headers, under their own policies.
- Language and theme preferences may use browser storage.
- We have not added advertising or an analytics service to the site.
- Creator kits and skills are downloads for the tools you choose. The website doesn't generate images through a PlayPets AI server.
- Files an external AI tool processes are governed by that tool's policies.

## Retention and removal

- Local settings stay until you remove them.
- Removing an AI connection in Settings also removes its saved API key.
- Fully quitting PlayPets clears its in-memory conversations.

To reset local data:
1. Remove credentials first, so the app can still identify the keys to remove.
2. Open the data folder from Settings.
3. Quit the app.
4. Remove the files you want to reset.

Uninstalling alone may leave data, credentials or backups behind. Records held by external providers and CLI logs have to be removed through those tools or providers.

| Default data location | Path |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\` |
| Linux | `~/.local/share/app.playpets/` |

- MSIX can virtualize the Windows path, so use the app's data-folder action.
- A custom data location you set explicitly overrides these defaults.

## Contact and changes

- Privacy questions or requests: [contact the maintainer through the project](https://github.com/gaerae/playpets/issues/new/choose).
- GitHub issues are public. Don't include personal data, keys, chat logs or identity documents.
- You can ask for a private contact route without including the sensitive information itself.
- The maintainer can't erase files on your device or records held by another provider.
- Policy changes are published on this page with an updated date.
