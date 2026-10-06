# Changelog

Changes people can see in PlayPets, release by release. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

- In the PR that makes a change, add one line under `## [Unreleased]` (Added, Changed, Fixed, Removed, Security, Known limitations).
- At release time, `npm run release -- x.y.z` moves this section into a dated `## [x.y.z]`, and pushing the tag turns that section into the release notes.

## [Unreleased]

### Added
- The yard: invite friends from Codex pet files, pet them, put down a treat and say hi together, and watch them stroll through scenery whose time of day and weather change. Games are hide and seek (find the friend whose name is called), a parade and tag. Petting scatters hearts, treats and an agent's finished work scatter sparkles, a pressed friend squashes and bounces back, speech bubbles pop in, and stars twinkle at night. All of it stops when the system asks for reduced motion.
- Starter pets: Tabby, Smoky and Mochi come with the app, so there is someone to invite the first time it opens. They are under "PlayPets starter pets" on the Invite tab.
- A Shape filter on the Invite tab (All, People, Animals, Other), from the pet file's `kind`.
- Chat: give each friend its own AI (a Claude Code or Codex subscription, Ollama, or an OpenAI-compatible server). Set a personality or change it by talking, and talk with several friends at once.
- Relationships: in friend settings, pick Friend, Partner, Reliable senior or Playful younger sibling and fill in "What it calls you". The tone and form of address change, and friends know each other's relationships and keep that tone when they talk or chat among themselves.
- Let them chat: from the yard toolbar, friends with an AI talk among themselves about the time and the weather. In Settings they can also chat on their own every 20 minutes.
- The first time the app opens, a card in the yard walks through three steps (invite, give a friend an AI, give an agent a friend) and checks off the ones that are done. When Claude Code or Codex CLI is installed, one press of "Connect now" connects every friend with no key, and with two or more friends they start talking right away. The AI connection dialog has a switch to give the same AI to the other friends that have none yet.
- Coding agent integration: through Claude Code, Gemini CLI and Cursor hooks, Codex notifications and MCP, a friend reacts while the agent works and tells you about recent work. The app executable receives it directly, without Node.js.
- Assigned friends: in the Settings tab, pick which friend each coding agent reports to. The copied settings name that friend, so Claude Code can go to Tabby and Codex to Smoky.
- The assigned agent shows on the friend's name tag and as a chip in the Friend tab, and when several are busy, the yard caption counts them.
- A dot by a friend's head shows the coding agent's state (working: blinking orange, waiting: blue, done: green, trouble: red). Done and trouble fade after 30 minutes, and the state stays while you chat with that friend during the agent's work.
- Pet import: from a community pet page address, a GitHub folder, or a folder on your computer. The Invite tab groups pets by where they live and opens that folder.
- Import links: opening `playpets://import?url=<pet page address>` imports that pet and opens the Invite tab, so a pet gallery can add an "Open in PlayPets" button.
- Desktop mode: friends come out on every monitor, stroll around, can be dragged, and look toward the mouse. On macOS they also show over other apps in full screen.
- Mini mode: a small window with just the yard.
- Languages: Korean, English, Japanese and Simplified Chinese. The app follows the system language at first and can be changed in Settings; the desktop window switches along with it.
- Installer screens: the macOS disk image opens on a picture of the yard that shows dragging the app to Applications, and the Windows installer has pets on its first and last pages and in the step headers. Linux software centers (Ubuntu App Center, GNOME Software, KDE Discover) show a description and screenshots and list the app under Games.
- Downloads: macOS dmg, Windows installer and portable zip, Linux deb and AppImage (x64 and arm64) on GitHub releases; a trial MSIX from a local build.

### Security
- Pet import downloads files only from the site of the pasted address (its subdomains and the hosts of registered communities), and does not follow a page that points anywhere else. Private addresses are blocked when the name is resolved.
- A pet file's description reaches the AI labeled as a description, not an instruction, and a personality saved during a chat keeps that label.

### Known limitations
- The downloads are not code-signed, so macOS Gatekeeper and Windows SmartScreen block the first launch.
- The Windows build was checked in a virtual machine (the x64 installer on Windows 11 ARM), installing and running, but has not been tested enough on real machines yet.
