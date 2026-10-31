# Changelog

Changes people can see in PlayPets, release by release. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

- In the PR that makes a change people can notice, add one line under `## [Unreleased]`: Added, Changed, Fixed, Removed, Security, Known limitations, then `### Website and docs` last.
- People here are those who use the app, install it or read the site. Tests, CI, release tools and developer docs need no line, unless they change what those people see; then the line says what they see.
- Changes to the website, the user guide and the README go under `### Website and docs`, apart from changes to the app.
- This is the full record. The release pages on the website say what changed for people using the app ([release notes by audience](docs/decisions/2026-10-28-release-notes-by-audience.md)).
- At release time, `pnpm run release x.y.z` moves this section into a dated `## [x.y.z]`, and pushing the tag turns that section into the GitHub release, after a link to the website's release page.

## [Unreleased]

### Added

- Move the pointer to the top of the yard to find buttons for **Reset window size**, minimize and close. **Reset window size** is also in the tray, the macOS Window menu, the scenery's right-click menu and <kbd>⌘</kbd>/<kbd>Ctrl</kbd> <kbd>0</kbd>, and puts the yard back at its usual size in the middle of the screen.
- Import a pet from a ZIP file on your computer, such as one from the creator kit or a compressed pet folder. PlayPets copies the pet in, so the ZIP can be moved or deleted afterwards.
- Remove a pet you imported or picked from the trash button beside its card in Invite a friend. An imported pet's files are deleted; a picked folder only leaves the list. While friends made from the pet are in the yard, PlayPets names them to send away first.
- A friend brings a gift each time it grows closer, from At ease on, on a day you play with it, and at Very close its own memento, marked with a heart. A friend already close when you update brings one for the level it is at.
- Connect a coding agent in one press from Settings → Coding tools: PlayPets names the file, asks, then adds its hook to the agent's own settings beside everything already there and keeps a backup. Disconnect takes out only PlayPets' entries; a file PlayPets cannot read is left alone and Copy settings still works. Qoder and Kimi Code join the agents a friend can follow.
- A gift box in the album's Gifts book keeps up to 12 gifts that came while the yard was full; press one to set it out once there is room. A memento you put away goes back into the box.

### Changed

- A panel chosen from the right-click menu opens where you clicked instead of in the corner above the dock.
- Closeness grows from what you do together: time with the yard seen counts up to an hour a day, and pats up to a quarter of a day's worth. Leaving the window open no longer makes friends close faster than playing; points already earned stay.
- A friend fishing on its own calls you when a fish bites; press the float within a few seconds to reel it in together, or it gets away. The album keeps only what you catch.
- Everyday gifts come from friends, not from the clock: at most one every other day, brought by a friend you did something with that day, 10 to 20 minutes after it may come. Leaving the yard open alone brings none. The wait is saved in `state.json` instead of the app's webview storage.
- Gifts can be set further down the yard, just above the dock, or nearly to the bottom of a small window, and stand in front of friends behind them. A bench, swing, stump or picnic blanket stops where friends can still reach it, and gifts already in the yard stay where they are. A wide gift dragged at the edge moves at once, and the arrow keys move a gift the same distance in any window size.
- Imported backgrounds and the place, season, time of day and weather picked for the yard are saved in the data folder (`backgrounds/` and `state.json`), so a copy of the folder keeps them and deleting it removes them. At the first start of 1.4.0 they move over from the app's webview storage, which keeps its copy until the move is saved. Going back to 1.3.0 afterwards shows the default place and no imported backgrounds; they come back with 1.4.0.

### Fixed

- After you unplug a monitor, a window bigger than the remaining screen comes back inside it without a restart, and a window can no longer grow past the screen it is on.
- In Places, the Import, Remove and Background studio buttons no longer run over the Places title or get cut off at the right in a narrow window or a longer language; what does not fit moves to the next line.
- Starting PlayPets with `PLAYPETS_LANG` no longer replaces the language you picked: the next start without it is in your language again.
- A Claude Code friend no longer turns to Waiting for you a minute after each finished turn, and a turn stopped with Esc no longer leaves it Working. With the Claude Code settings copied again, a turn that stops on an error says so: a usage limit, a sign-in to redo, or another error. The idle notice also leaves a chat answer's Thinking alone.
- The chat log keeps up to the last 500 messages with each friend for the session, instead of silently dropping everything before the last 24; a friend still answers with the latest 24 in mind.
- winget's package for the GitHub installer names the app's product code, so `winget list` and `winget upgrade` recognize PlayPets installed with that installer.
- On Windows, the Microsoft Store version declares `playpets://` links, so a pet gallery's import link opens PlayPets.
- A friend on an API connection (OpenAI, Grok, Ollama or a compatible server) keeps who it is in a long conversation: its persona and notes are no longer dropped once the chat passes 24 messages.
- ■ stops a friend on an API connection at once, instead of after the server answers or times out.
- Changing an AI connection to another type or server without typing a new key, when the new one needs a key, is refused without deleting the key the connection had.
- A coding agent reporting for a friend that was sent away now reaches the first friend, as a report with no name does, instead of failing. A `playpets say` message that starts with `@` is shown as written, unless it is one of the app's own status codes.
- `state.json` is written to disk before it replaces the old file, so a power cut while saving cannot leave an empty file.
- On Windows, the hooks for Claude Code, Gemini CLI and Cursor run under PowerShell. Before, PowerShell could not read them: Gemini CLI and Cursor friends never reacted, and Claude Code without Git Bash could stop its tool calls. Connect, or copy the settings again, to get the new hooks.
- An update download that takes more than 20 minutes stops with an error instead of waiting on a stalled connection forever, so Update can be tried again.
- The tray's red mark for a coding agent's error goes away after 30 minutes, as the yard's dot does.
- In the yard, a friend whose coding agent finished or failed more than 30 minutes ago stands and chats like the others again, as its dot and the desktop show.
- A tree pulled up just before moving to another place is removed, instead of coming back.
- In hide and seek, two quick wrong guesses no longer leave "not them" in place of who is still hiding.
- A friend sent to dig rests from when it digs, so a second dig shortly after is no longer refused once it has walked over. A dig called off on the way does not count.
- The tree tool says a place or the yard is full when you click, counting trees friends are on their way to plant, instead of letting a friend walk over to fail.
- The page is no longer redrawn every minute once anyone has chatted, so a picker or an open album keeps its place and focus.
- Inviting a pet again uses the first free number, so sending one copy away and inviting again never repeats a name.
- In the Microsoft Store version, Start PlayPets when you log in now starts it at sign-in, through Windows Settings → Apps → Startup, and with desktop mode on the yard window waits in the tray. If PlayPets was turned off there, the switch says to turn it on there. On every system, the switch also shows a change made in the system's settings while PlayPets was open, once you come back to its window.
- Two coding agents reporting for one friend no longer undo each other: one session's idle notice no longer turns another session's Working friend to Resting.
- A command stopped with Ctrl-C under `playpets run` leaves its friend Resting, instead of Working, and a `kill -INT` sent to `playpets run` alone now reaches the command.
- On macOS and Linux, a Claude or Codex CLI still answering when PlayPets quits is stopped with it.
- Removing a pet that a friend waiting to come back still uses names that friend, instead of a general error.
- With `PLAYPETS_DATA` set to another folder, PlayPets copies the installed app's backgrounds and scene into it instead of moving them, so the installed app keeps its own.
- A pet folder you picked by hand from inside the data folder's `pets` only leaves the list when removed; its files are no longer deleted.
- A pet ZIP brings in only the pet's JSON, pictures and text notes; a script, a web page or a shortcut packed beside them is left out.
- Fishing with a friend chosen while it is busy takes the nearest free friend, and fishing from the tool counts toward its hint like other play.
- A question that comes while another is open, such as a pet link arriving, waits for the first to be answered instead of answering it No.
- On macOS and Linux, Claude Code or Codex CLI installed with nvm, fnm, asdf, mise, Volta, Bun or pnpm is now found and marked Installed. One installed with nvm, fnm, asdf, mise or Volta runs with the Node it was installed with, instead of failing to find `node` or picking up an older one.

### Known limitations

- Codex CLI tells PlayPets only when a reply finishes, so its friend shows Done but never Working or Waiting for you. Cursor has no hook for a confirmation, so its friend never shows Waiting for you.
- On Linux with Wayland, clicking and dragging friends on the desktop has not been tested.

### Website and docs

- The settings guide explains the window buttons and **Reset window size** in all four languages.
- The guide explains how gifts, the gift box and mementos come, what each coding agent can report, and that clicking friends on Wayland has not been tested.
- The import guide explains importing a pet ZIP directly in 1.4.0 and removing a pet in the app; the creator kit page, the kit's request and the creator skill say the same and keep the folder steps for earlier versions.
- The user guide counts 20 gifts in the album, says an OpenAI-compatible server needs an API key only when it asks for one, lists what About PlayPets holds under Privacy and license in every language, and gives the Store and winget data folder in the FAQ. The README says Ollama and compatible servers need a model name, and that friends dig on their own only with the switch on.
- Release pages say what changed in the app in one short line per change, and mark a change for one system with its name; install ways, the user guide and security updates move to a section of their own. The Microsoft Store shows the Windows lines and Linux software centers the Linux lines; winget and the GitHub release link to the page.
- The README shows three screenshots, its Windows button opens PlayPets in the Microsoft Store, and its install section lists the Store and the winget command before the GitHub installer. Its updates, data and language sections are shorter and link to the user guide.
- On the website, a visitor on macOS or Linux who opens the other platforms list finds the Microsoft Store first for Windows, before the GitHub installers.
- The website's front page shows real pictures of play: a garden decorated with flowers, trees and gifts, tag, digging, fishing and the album. Its comparison with a Codex pet starts with moving: friends stroll the yard and, with Stroll on desktop, your desktop, with a picture of them there.
- Screenshots and the README animation no longer show a keyboard focus ring around a friend.
- On Windows, the website's download section says the installer from GitHub is not code-signed yet and links to the install guide's steps for the SmartScreen warning; the README links there too, and the install guide links Microsoft's page on where SmartScreen is set.
- The website's download buttons link the release files directly from the first moment: the site reads the published releases when it is built and is built again when one is published, so a busy network or GitHub's lookup limit no longer sends visitors to the release list. The README's download badges open that section.
- The guide's first page starts with four steps and what each one shows, and the FAQ's answers on problems become one table of what you see, why and what to do.
- The guide's quick start and the FAQ point to Connect instead of pasting settings, and the 1.4.0 release page names Connect, Qoder and Kimi Code. The wording of the 1.4.0 strings and guide pages is smoother in all four languages.
- The coding agents guide says a hook gives up within a few seconds, not three: a hook that waits for the app can take a little longer.
- The coding agents guide says a `playpets run` stopped with Ctrl-C leaves its friend Resting.
- The settings guide says how Start at login works in the Microsoft Store version, and its data folder table gives the Store location, as the FAQ and the install page do. The first-friend guide names the group of pets imported from an address or a ZIP, and the privacy page says the season and time of day picked are saved too.

## [1.3.0] - 2026-10-27

### Added

- The coding agents guide explains several agents at once, each friend showing only its own agent, and how two sessions of the same agent report to different friends with `PLAYPETS_PET`.
- Grok support: Grok Build reports to its own friend through hooks in `~/.grok/hooks/playpets.json`, without also showing on the Claude Code or Cursor friend, and a friend can talk through Grok with an xAI API key kept in the system keychain.
- Install from the Microsoft Store, signed by Microsoft, or with `winget install --id 9NSKXQ6R187M --source msstore`. The website's download button offers the Store on Windows and shows the Homebrew or winget command for your system, and the install guide covers every way in four languages.
- The website's front page moves: friends stroll and look toward the pointer, a button plays a chat between two friends, and a coding session replays beside a friend for Claude Code, Codex, Gemini CLI or Cursor, with an Allow step to press.
- The website's front page shows friends talking among themselves and keeping you company on the desktop while a coding agent works, with the Homebrew install command.
- The website's first screen says PlayPets is a desktop pet app and names the coding agents a friend reacts to, and the front page copy is rewritten in all four languages.
- Install on macOS with Homebrew: `brew install gaerae/tap/playpets`.
- The website leads with Codex pets: the first screen says PlayPets plays your Codex pet files, up to 12 together, and a new block lists what it adds. Every page has a Home link, the FAQ opens with what PlayPets is and how it works with Codex pets, and search and answer engines get structured data, `robots.txt` and `llms.txt`.

### Changed

- The macOS app is signed with Apple's Developer ID and notarized by Apple, so it opens without the Open Anyway steps; the install guide and FAQ say so in four languages.
- The coding-company section on the website's front page moves up, right after what PlayPets adds to Codex pets.
- The user guide in English, Korean, Japanese and Simplified Chinese is rewritten with steps, tables and bullets for settings and options, and natural sentences where it explains, with button names matching the app; the privacy policy reads more plainly in all four languages.
- The website's first screen gathers its place, season and pose choices into one dock under the scene, in the same control as the friend gallery's poses.
- The website's first screen shows a computer screen with a wallpaper, a taskbar and the yard as an app window, and a switch lets the friends out onto the desktop, so it is clear PlayPets is a desktop app.

### Fixed

- The user guide's "On this page" outline lists headings only; a "since" badge appears only on features added after the first release.
- Friends on the website's front page no longer blink out or flicker when they walk, look around or change season.
- Keep the seed count inside the Plant a seed tile when the tile is narrow, as in Chinese with ten or more seeds.
- Retake the desktop-mode screenshot on the website and in the Linux software-center listing without the macOS screen-sharing indicator that sat in its corner.
- On the website's front page, Japanese no longer breaks words in the middle on a phone, the dark theme keeps the friends' card in the page's green, and the chat picture stays readable on a phone.

### Security

- Update ctutils to 0.4.5, used by the Linux keyring, so its mask generation and u128 comparisons run in constant time (RUSTSEC-2026-0385).
- Update webpki-roots and webpki-root-certs to 1.0.11, so the app's update and AI connections no longer trust the eMudhra roots Mozilla removed (emSign ECC Root CA - G3, emSign Root CA - C1 and emSign ECC Root CA - C3).
- Update tokio to 1.54.1, clearing its unsoundness advisory (RUSTSEC-2026-0386), along with Tauri 2.12.5 and the other Rust dependencies.

## [1.2.0] - 2026-10-22

### Added

- Manage every AI connection in one place, in Settings → Friends & AI, with automatic chat beside them; Edit and Connect an AI open the form right there, without a second window over Settings.
- Open the short right-click menu (Place & atmosphere, Play, Friends & settings, Always on top) from a corner button in small windows, where the dock is hidden; the button, like the update button in the other corner, shows only while the pointer is over the window or it has the keyboard focus, so a small window kept on the desktop shows just the yard.
- Dig at a right-clicked spot of bare ground with Dig here, without opening Play.
- Ask a friend to dig from its right-click menu.
- Open the album at the right book from a find's card, and see a dot on Album and Play while something new waits there.
- Let idle friends dig on their own now and then with a new switch in Settings → Friends & AI.
- Switch between Dig, Plant a tree and Plant a seed with 1, 2 and 3 while a tool is in hand.
- Open the data folder from About PlayPets, which now groups its pages into Help, Project, and Privacy and license, and open the notes of the version in use from App updates, which says that updates are checked quietly and installed only when you choose.

### Changed

- Show Place & atmosphere, Play and Friends & settings each as one page of sections, without tabs, sub-views or Back buttons: Play groups Find, Garden and Group games, and a running game ends from its own tile.
- Keep one Settings entry in Friends & settings. In a large window Settings is a centred sheet sized to the window (up to 760 × 640) that keeps its list of sections on the left beside the open section and reopens where it was left; a small window opens on the list, one section at a time, and Back returns one step at a time.
- Offer Talk and Play in a friend's right-click menu, matching the name tag and the dock.
- Keep the dig and tree tools in hand after each spot, sending the next free friend each time, and switch between digging, trees and seeds from the strip at the bottom until Esc or Close puts the tool away.
- Fish or catch a creature with one press even while a play tool is in hand; the press puts the tool away first.
- Show the tool strip where the dock was, right where Play was opened and just above the ground.
- Put everything the yard tells you (a startup warning, what a game asks, a find's card, a notice) in one lane just above the dock, where play starts, instead of the top of the yard, above the finder and the bottom; the game's line is one row, and the lane rises above the tool strip while a tool is in hand.
- Give every message on the yard one look and one reading time: notices stack two lines along the bottom (one in small windows, beside a pending Undo) with failures in dark ink, cards wait while a panel covers the yard, overlapping speech bubbles rise clear of each other, and a friend's words are read aloud to screen readers.
- Pull up flowers and trees and put gifts away at once, with a few seconds to undo it in the notice below, instead of a red confirmation each time.
- Keep confirmations calm unless something that cannot come back is lost (a saved key, a friend's closeness, a background, a conversation), give every dialog a Close button and its destructive action at the far left, and say what stays before what goes when a friend is sent away.
- Fold the dock's panels into tiles in small windows, keeping a chosen atmosphere row in view.
- Open the conversation from a friend's name tag, as its tooltip says; play stays on the friend's right-click.
- Move Quit PlayPets out of About to sit beside Close window, and quit at once from the page, as from the tray and the macOS menu bar.
- Use one name for each action across the page, the tray and the macOS menu bar.
- Show Import background and Background studio beside Places as two plain actions with icons, so the pair no longer looks like tabs with one chosen.

### Fixed

- Keep Settings open after choosing Later in App updates, and dim the whole window behind Settings.
- Keep a friend's name readable when a coding agent's name shares its tag.
- Stop editing a connection from Settings from moving the selected friend to it.
- In dark mode, keep a friend's speech bubbles and name tags in one light look that belongs to the painted yard, deepen dialog shadows and the dimmed backdrop, and make faint captions on selected cards readable.
- Keep a small dialog's actions on one row so its fields stay in view, with the destructive action down to its icon, and stop Korean, Japanese and Chinese text from breaking mid-word or leaving one character alone on a line.
- Let a card that arrives while another is on show wait its turn instead of replacing it, so a closeness card no longer wipes the catch that earned it.
- Keep notices in small windows clear of the corner button, skip a notice that repeats an error already shown in the open form, end a cut speech bubble with an ellipsis, and stop a first keepsake's card from saying it was kept twice.
- Plant a seed from the keyboard with a second press of the seed tool, as with the picnic treat.
- Give each coding tool's controls in Settings a distinct name for screen readers, and remove a stale note about unpublished pages from About.
- Keep night stars and shooting stars in the sky behind hills and trees, and hide the twinkling stars on rainy or snowy nights.
- Draw the moon's phase as it looks, a tapering crescent or a bulging gibbous moon with a soft edge and its dark side faintly visible, instead of a disc of night sky sliding over it, and let it glow only from its lit part, with no bright ring around the dark side.
- Raise the harvest moon big and golden only on the nights around the event's first real full moon, two days either side, as at Chuseok and the Mid-Autumn Festival, instead of a full moon every night of the event; the other nights keep the real phase. The harvest event now starts on September 8 (March 8 south of the equator), so that full moon falls inside it every year.

### Security

- Update rustls-webpki to 0.103.16 and the bundled web PKI roots to 1.0.10, so certificate checks no longer trust the distrusted emSign intermediates (RUSTSEC-2026-0381, RUSTSEC-2026-0382, RUSTSEC-2026-0383).

### Known limitations

- The moon's phase and the harvest moon follow the average lunar month, so on some nights they can be up to about a day off the real sky.

## [1.1.0] - 2026-10-20

### Added

- Expand the album from 72 to 100 entries: 16 flowers, 23 aquatic creatures, 18 bugs, 20 gifts, 6 trees and 17 keepsakes. New arrivals include the stickleback, freshwater prawn, crayfish, pond snail, ladybug and field cricket.
- Give Daisy, Clover, Pip and Miso their own digging, planting, fishing and discovery animations in every season. Imported pets and the other bundled pets keep their original animation sheets.
- Find tree saplings by digging, keep them in a saved pocket and spend one when planting. Oak, birch and willow, each with seasonal artwork, join cherry, maple and pine, and the yard now holds up to six trees per place and 24 in total (up from three and 12).
- Discover nine new keepsakes, including bottle caps, toy robots, tiny crowns and star fragments.

### Changed

- Get new flower seeds only by digging; friends no longer drop seeds to pick up while they stroll. Seeds you already have and planted gardens are kept.
- Saplings and keepsakes are more likely in the season, weather and place that suit them, and uncommon keepsakes are paced over a 24-hour window shared by all friends and places. The album names the conditions that favor each find, and the guide uses these clues instead of exact percentages.
- Digging now opens a painted hole in the soil with dirt and shovel effects, and the find appears once the action and its save have both finished.
- Snow no longer turns the yard into winter: the selected season's landscape stays, including imported backgrounds and indoor window views.
- Use one Play board at every window size, short Friends, Settings and Window tabs in the menu, and put sound and volume beside season, time and weather in the atmosphere controls. The duplicate yard settings are gone.
- Use compact desktop controls and smaller panels, and show yard events in one feedback lane.
- After the first check 20 seconds after launch, keep checking for updates every six hours and retry after network failures. Download progress, retry and the install-and-restart action are together in Settings → App updates, and small windows show a download icon instead of a text banner. Microsoft Store packages keep their own updates.
- Finish brief jump, wave and celebration gestures once instead of cutting them off.

### Fixed

- Keep gift waiting progress across launches and while the yard is full, instead of restarting the wait every time the app opens.
- Remember every patch dug in the last 24 hours instead of only the latest 32, and let friends dig again right away after the computer clock moves backward.
- Keep dialog headings and buttons visible in small windows, scroll errors into view, and keep a typed import address when Esc or a click outside would close the dialog.
- Let the AI connection dialog close normally after it fills in a discovered Ollama model, instead of treating the untouched form as edited.
- Show messages above open dialogs, and keep discovery cards open while you read them, with a close button.
- Keep dragged furniture under the point where you grabbed it, and put it back if the move cannot be saved.
- Keep the downloadable creator skill compatible with current Codex skill validation.

### Known limitations

- macOS packages are signed ad hoc until Developer ID signing and notarization are configured, and Windows installers are not Authenticode-signed. The updater signature is separate from operating-system trust.
- Linux builds still include two known upstream advisories in the GTK/GLib Rust bindings (RUSTSEC-2024-0429, RUSTSEC-2024-0370); see SECURITY.md before deploying.
- Microsoft Store certification and publication are separate from this GitHub release; no Store package was built for 1.1.0.

## [1.0.0] - 2026-10-19

### Added

- Ask a friend to dig at a chosen spot, record eight keepsakes, and plant scene-owned cherry, maple and pine trees with saved growth.
- Preserve optional soil capabilities through background creation kits and app import.
- Add an approval-gated Store API credential check and separate Store package and certification workflows, disabled during initial registration and held for manual publication.
- Check Windows x64/ARM64 MSIX installation, production activation, package upgrades, retained settings and Store updater guards in CI.
- Provide privacy information in all four website languages and link it from About.

### Changed

- Keep small windows quiet at rest, with brief friend-led play actions instead of a full activity panel.
- Separate Place, Play and Menu, group window controls, and add a short keyboard-accessible yard context menu.
- Tighten control-surface spacing and separate headings and functional groups with consistent boundaries.
- Keep update downloads over the yard with collapsible details and a progress entry in small windows.
- Enlarge the bench, swing, tent, picnic blanket and stump to fit friends across window sizes and display densities.
- Align the app and MSIX version series at 1.0.0 and 1.0.0.0, without a major-version offset.

### Fixed

- Keep small-window collection content visible in WebKit, preserve the yard after a tree-growth save error, and leave delayed update-check results quiet after Settings closes.
- Keep MSIX installations on package-managed updates instead of downloading GitHub EXE installers, validate Store identity fields together and scope test-package removal to its test publisher.
- Restrict Store package execution to the current trusted main workflow commit and its matching version tag.
- Reject partially configured Apple signing builds and verify Developer ID trust and notarization when signing is enabled.

### Known limitations

- macOS packages are signed ad hoc until Developer ID signing and notarization are configured; Windows installers are not Authenticode-signed. The updater signature is separate from operating-system trust.
- Linux retains the documented upstream GTK/GLib advisory exceptions; review SECURITY.md before deployment.
- Microsoft Store certification and publication are separate from this GitHub release. Store drafts and installed end-user update paths need their own verification.

## [0.2.0] - 2026-10-18

### Security

- Add independent source, secret and dependency security checks, require reviewed CI before normal merges, and protect published release files and version tags.

- Document the Linux GLib advisory, official upstream fixes and migration work, and the separate risk review required before publishing Linux packages. The dependency remains affected; this documentation does not resolve the advisory.
- Disable unused legacy ZIP updater compatibility, removing the vulnerable ZIP extraction dependency reported as RUSTSEC-2026-0367, RUSTSEC-2026-0368 and RUSTSEC-2026-0369. Native installer updates and macOS tar updates remain supported.

### Added

- Add fullscreen with restoration of the previous window size, position and Always on top setting; Esc closes an open menu or dialog before leaving fullscreen.
- Add distinct Close window and Quit actions: closing leaves the app in the tray, while quitting asks for confirmation.
- Welcome Miso as a fourth starter companion, with baseline, summer and winter outfits, character stories and a condition-aware collection guide.
- Provide complete character and background creation kits with reference sheets, a personalized request and a portable skill that assembles, validates and packages files for direct app import.
- Offer project-scoped skill installation for Codex and Claude Code, compatible plugin archives and explicit frame selection for spacious animation source sheets.

### Changed

- Update Tauri CLI to 2.12.2, Tauri to 2.12.3, tauri-build to 2.7.3 and serde_json to 1.0.154, with regenerated native license notices.

- Replace Mini mode with one frameless, freely resizable yard down to 300 × 210. Save its bounds and independent Always on top setting, and keep the same activities available at every size.
- Separate scene Places and Atmosphere, provide explicit Back to menu and Close actions, and reveal invite filters and secondary play/display tools on demand.
- Hide the bottom dock in small windows; open the shared menu by right-click or Cmd/Ctrl+Shift+P, and toggle Always on top with Cmd/Ctrl+Shift+M.
- Start new yards in sunny spring daylight while preserving saved scene choices, and refresh localized captures and guides.
- Replace web inspection and conversion forms with reusable creation kits; completed work goes directly from the chosen image tool to the app.
- Dress Pip in coordinated denim outfits, share the white-and-gold flower motif and show four companions in landing interactions, installer art and share images.
- Keep one installer per Windows architecture, embed third-party notices in native packages instead of duplicating them beside every release file, and activate version-page downloads from GitHub publication without a follow-up site deployment.
- Make download a primary landing destination, select the first visit from the browser language and remember a language chosen from the site menu.
- Move the website and documentation to `https://playpets.gaerae.com/`.

### Fixed
- Push the release commit and tag atomically so a rejected main update cannot publish an orphaned version tag.
- Install the creator image-validation dependency in native release CI, and keep the four-language version-page introduction accurate after publication.
- Confirm Linux pin state from the native window and wait for frame restoration before reporting fullscreen completion. Headless desktop checks now include a window manager.

- Distinguish download lookup from an unpublished version on the website, and keep release-page guidance accurate after the first release in all four languages.

- Collect and verify bundled system-library notices in local Linux AppImages, and keep older cached packages and source manifests out of local Linux exports.

- Keep startup notices in a collapsible, dismissible card above the yard. Distinguish missing pet files from the 12-friend limit without deleting saved friends.
- Show the selected Always on top state, retain settings and conversations when resizing, and keep friend actions and scene controls reachable in short windows.
- Prevent scenery text selection, overlapping panels and lost keyboard focus when opening or dismissing controls.
- Offer all four companions on the first-run welcome screen, with a two-column choice in narrow windows.
- Match the three supplied wardrobes and flower-placement prompts to the accepted artwork, and use seasonal high-resolution motion previews for all four companions.
- Keep close fishing casts ahead of the friend without leaving the background's water bounds.

### Known limitations

- Linux packages retain the documented GLib RUSTSEC-2024-0429 and proc-macro-error RUSTSEC-2024-0370 advisories in Tauri's compatible GTK dependency family. See the [security policy](https://github.com/gaerae/playpets/blob/main/SECURITY.md#dependency-advisories) for upstream references and the release review boundary; these advisories have not been fixed or suppressed.
- macOS notarization and Windows publisher signing are not configured. Operating-system trust prompts can still appear; updater signatures use a separate key.
- Release CI installs and launches the native packages. Interactive installer review and the complete signed upgrade from 0.1.0 on every supported desktop remain unverified.

## [0.1.0] - 2026-10-15

### Security

- Update rustls to 0.23.46 to address RUSTSEC-2026-0346, RUSTSEC-2026-0347, RUSTSEC-2026-0348 and RUSTSEC-2026-0349.
- Verify installed release packages by launching them on their native CI runners, collect and verify the distribution copyright files for every system library copied into an AppImage, and publish an exact Ubuntu source-package manifest beside each image.

### Known limitations

- Linux remains on Tauri's stable GTK 3 dependency family. GLib RUSTSEC-2024-0429 and the build-time proc-macro-error RUSTSEC-2024-0370 remain upstream-blocked; Linux publication needs an explicit review until stable Tauri moves to a fixed family.

### Changed

- Add Oxlint correctness checks alongside Biome formatting and retain explicit draft status on version pages until the release is public.

- Refresh the unpublished 0.1.0 notes in all four languages to describe the current companions, places, controls and update flow.

- Align the README and four-language guide with the three starter companions, current update controls and offline requirements; correct pet and installer documentation.

- Offer English, Korean, Japanese and Simplified Chinese in the Windows installer and uninstaller.
- Use a continuous sage background for readable macOS installation instructions and file labels, soften Windows installer artwork, and clarify the Linux software-center description.
- Retire the historical flat pet generator and unused window/menu styles; align installation guides with the current update controls.

- Keep the new-version button before the place selector in the yard, and briefly confirm the installed version after restart.
- Show an in-app update dialog before installation, report download, signature verification and installation separately, and keep a retry path after failure.
- Group Settings and album tabs into matching compact selectors, and draw the fishing line and float ahead of the rod and casting friend.
- Match the four landing page descriptions to the current friends and places, and give the Japanese home page a complete browser title.
- Give the yard menu, Friend, Invite and Settings one quieter surface language: text-led navigation, unboxed settings rows, shared corner sizes and matching close and overflow buttons.
- Make menu hover and selected settings states distinct, simplify nested menu surfaces, and size Settings to its content while its navigation stays visible during scrolling.

### Added

- Include third-party copyright and license notices with native packages and the website.
- Replace the single-cookie treat with a shared picnic spread, space friends around the food, clarify the desktop strolling switch and expand game choices across the menu width.
- Give scenery controls a subtle frosted surface with solid accessibility fallbacks, and keep matching desktop and strolling switches together while the menu stays open.
- Replace the fishing rod with painted cork, reel and guide details while keeping each place's fishing positions.
- Keep new conversations in the selected app language, cancel pending replies when it changes, and correct localized conversation captures; existing chat history stays unchanged.

- Show Daisy, Clover and Pip together at matching visible heights across the landing page, installer art and captures; use the same Clover face for the app mark and tray icon on every platform.

- Redraw the three companions and seasonal outfits with clear painted outlines, keep Pip in shorts or trousers, and use high-resolution animated artwork on the landing page.
- Keep three official companions (Daisy, Clover and Pip), bring place, season, time and weather together in a background gallery, and introduce a bright interactive four-language landing page.
- Hide navigation completely in mini mode and group full-yard menu actions by purpose. Keep browser context commands and pointer focus rings out of the scenery.

- Keep Place & atmosphere beside Menu in the full yard; keep navigation hidden in mini mode.

- Keep the yard menu and task panels from overlapping, hide onboarding behind open panels, name mini and sound controls, and enlarge conversation text and supporting labels. Let Escape close every task panel and keep only the expand control in mini mode.

- A quiet default yard with one Menu entry in the full view. Secondary controls stay tucked away, the clock is removed, and branding lives in About. More compact Friend and Invite panels preserve reading space; the tray adds Friends, Invite and Sound.

- Edge-to-edge yard scenery with floating navigation and panels, matching the quiet mini view. Softer sunlight, corrected rainbow colors and visibility, and grounded growing plants with evening-lit indoor pots.
- Add three seasonal garden settings and a compact village study with seasonal window views, plus a four-language background studio with placement sheets, prompts and local background package import.
- Start fishing from the full-yard menu when friends cover the water.
- Show planted flowers in ceramic pots indoors.
- Keep neighboring atlas artwork out of the picnic blanket drawing.
- The yard: invite friends from Codex pet files, pet them, put down a treat, and watch them stroll through scenery whose time of day, weather and season change: the sun and moon cross the sky by the clock and the moon shows its phase, cherry blossoms in spring give way to deep green, autumn leaves and muted winter green, petals and leaves drift down, birds pass now and then, and a rainbow follows the rain. Auto weather follows the season (snow only in winter). Games are hide and seek (find the friend whose name is called), a parade and tag. A friend's name tag opens the conversation (it shows a speech mark under the pointer). Petting scatters hearts, treats and an agent's finished work scatter sparkles, a pressed friend squashes and bounces back, speech bubbles pop in, and stars twinkle at night. All of it stops when the system asks for reduced motion.
- A painted yard: the hills, trees, clouds and sky are painted after the backgrounds of hand-painted animated films and the trees of Animal Crossing (flat masses of leaves in deep shade, shade and warm light, heaped clouds white on top and blue below, groves on the far hill, mountains in haze, a small lake in the valley mirroring the sky, a big tree framing the edge), and painted again only when the time of day, the weather or the season changes, so it costs nothing while it stands still.
- Fishing and bugs: click the lake and the nearest friend goes to the shore and casts; click the float when it dips to land the fish, which differs by season, time and weather (eighteen kinds through the year, each a different size every time, and the moonlight carp only during the harvest moon). Click a butterfly, dragonfly or firefly and a friend leaps for it (fifteen kinds, and the golden firefly only on firefly nights). Rare kinds say so in the album. An Album in the tools gathers everything in four books (Flowers counted when they bloom, Fish, Bugs, Gifts), the ones not yet found as silhouettes with when and where to look.
- Seasonal events: a cherry blossom festival (more petals and butterflies), firefly nights (many more fireflies and a golden one), the harvest moon (a big full moon and the moonlight carp), winter lights (little lights on the big tree) and the New Year. Each announces itself once a year, gets friends talking, and brings a gift that comes only then (cherry sapling, watermelon, pumpkin, snowman). South of the equator they come six months later.
- Yard sounds: a breeze, waves on the lake, gusts through the leaves, birds by day, crickets on warm nights and rain when it rains, all following the time of day, the weather and the season, with small notes when you pat a friend, a fish bites or is landed, a gift comes or a closeness level is reached. Made in the app, nothing downloaded. On by default at a low volume and only while the yard can be seen; turn them off with Menu → Sound, Settings → The yard (with a volume slider), View → Yard Sounds or Cmd/Ctrl+Shift+S.
- Closeness: each friend grows closer through time in the yard and what you do together (patting, treats, chatting, watering, catching, gifts), up to a day's worth, so it comes over days. Hearts on the name tag and a row in the Friend tab show how close it is and what the next level brings: a welcome back, fishing on its own, more seeds, and at the last level a flower on its tag and words just for you. Nothing is lost by being away.
- The garden: friends out for a stroll find seeds now and then; plant them on the field and they grow by the clock (also while the app is closed) from sprout to bud to a flower of the season they were planted in, one of two each season: tulip or daffodil, sunflower or hydrangea, cosmos or chrysanthemum, camellia or snowdrop. Friends water a plant you click and visit the flowers on their own. Once a day a friend brings a gift for the yard (fourteen kinds: a bench, a lantern, a birdhouse, a little pond, a mailbox, a picnic blanket, a pinwheel, a campfire, a swing, a flowerpot, a stump stool, a tent, a signpost and a wind chime) and sets it down; drag it wherever you like, and friends sit on the bench, the swing and the stump, gather on the blanket and look into the pond. A friend behind a gift or a flower is hidden by it, and names and speech bubbles stay on top. The lantern and the campfire glow from evening on, and the wind chime rings when a friend visits it. The yard holds twelve. The yard becomes your own over the days.
- Friends are never lost to a missing pet file: one whose file is not found at start (a folder unplugged or moved) is kept with its closeness and comes back once the file does, and a notice says how many are waiting; a coding agent that reports to it goes to the first friend meanwhile.
- Starter pets: three come with the app: Daisy the explorer, Clover the kitten gardener and Pip the cheerful puppy. They are under "PlayPets starter pets" on the Invite tab. All three change into summer and winter outfits, and Clover is the face of the app icon, the website and the installers.
- Places: choose Hill garden, Stone courtyard, Lakeside cottage or Cozy living room from the scene menu. Outdoor places have seasonal scenery and their own fishing positions; the study has time-of-day lighting, seasonal window views and weather outside the glass. Friends, plants and collections stay with you when you change places.
- Pick a season in Place & atmosphere or Settings for the scenery and the friends' outfits, or let it follow the calendar; festivals keep their real dates either way.
- Painted artwork for the yard's layers, flowers and garden growth, gifts, and every fish and bug, each shown in the album on a softly lit stage; leaves, petals, rain and snow have their own textures, and a net sweeps when a bug is caught.
- A Type filter on the Invite tab (All, People, Animals, Other), from the pet file's `kind`, together with a search by name and creator; the import dialog lists community sites to browse for pets.
- The Friend tab reads like a messenger: the friend's name, state, relationship and closeness at the top with a menu for what is done to the friend (settings, AI connection, clearing the chat, sending it away), the conversation filling the panel, and the AI and "Bring friends in" at the bottom of the message box. A conversation not yet started offers a few first lines to pick with one click. A friend's turn in the conversation opens with its picture, as in a messenger.
- Chat: give each friend its own AI (a Claude Code or Codex subscription, Ollama, or an OpenAI-compatible server). Set a personality or change it by talking, and talk with several friends at once.
- Relationships: in friend settings, pick Friend, Partner, Dependable mentor or Playful younger sibling from cards that say the voice each brings, and fill in "What it calls you" (its example follows the relationship). The Friend tab shows the relationship beside the friend's closeness, and a click on it changes it; the closeness levels (Just met to Dearest) say how close, not what you are to each other. A partner, a mentor and a younger sibling each welcome you back, grow closer and say what you mean to them in a voice of their own, with no AI. The tone and form of address change, and friends know each other's relationships and keep that tone when they talk or chat among themselves.
- Let them chat: from the yard toolbar, friends with an AI talk among themselves about the time and the weather. In Settings they can also chat on their own every 20 minutes.
- The first time the app opens, the empty yard asks who to play with and shows the starter pets, moving: one click brings one in. Then a small card lists what is left (give a friend an AI, pick a friend for your coding agent) and ticks off what is done. When Claude Code or Codex CLI is installed, one press of "Connect now" connects every friend with no key, and with two or more friends they start talking right away. The AI connection dialog shows each kind of AI as a card that says what it needs, marks what this computer has, and has a switch to give the same AI to the other friends that have none yet. A message written to a friend with no AI is sent once one is connected.
- Coding agent integration: through Claude Code, Gemini CLI and Cursor hooks, Codex notifications and MCP, a friend reacts while the agent works and tells you about recent work. The app executable receives it directly, without Node.js.
- Assigned friends: in Settings, pick which friend each coding agent reports to. The copied settings name that friend, so Claude Code can go to Tabby and Codex to Smoky.
- The assigned agent shows on the friend's name tag and as a chip in the Friend tab, and when several are busy, the yard caption counts them.
- A dot by a friend's head shows the coding agent's state (working: blinking orange, waiting: blue, done: green, trouble: red). Done and trouble fade after 30 minutes, and the state stays while you chat with that friend during the agent's work.
- Pet import: from a community pet page address, a GitHub folder, or a folder on your computer. The Invite tab groups pets by where they live and opens that folder.
- Import links: opening `playpets://import?url=<pet page address>` imports that pet and opens the Invite tab, so a pet gallery can add an "Open in PlayPets" button.
- Desktop mode: friends come out on every monitor, stroll around, can be dragged, and look toward the mouse. Pointing at a friend shows its name as a button that opens the conversation, and petting scatters hearts. On macOS they also show over other apps in full screen.
- Start at login: a switch in Settings → General. With desktop mode on, the friends come out at login and the yard window waits in the tray.
- The yard fills its frame: the scene label (which opens the time of day and weather), the tools and a Games menu float over the painting, and the tools keep one row in any width. How the yard is shown sits on the yard itself, beside the clock, as a video player keeps its controls: Show on desktop (a switch that stays pressed while on, with Stroll beside it), the mini view and the sounds; the top bar only has the tabs, and Settings is a gear at the end of them; it opens as a wide sheet over the yard with an index of its groups (General, The yard, Coding agent hooks, About PlayPets), since nothing in it needs a view of the yard. On macOS a View menu opens the Friend and Invite tabs and switches mini view and desktop mode; the same keys (Cmd or Ctrl+1, +2, +Shift+M, +Shift+D) work on every system.
- Mini mode: a small window with just the yard that stays on top. It first opens in the screen's bottom-right corner, then where it was last left; treat and let-them-chat buttons rise over the yard under the pointer.
- Quick conversations open inside the mini yard, without leaving mini mode.
- Dark appearance: the shell, menus, album, dialogs and mini conversations follow the system's dark mode.
- Languages: Korean, English, Japanese and Simplified Chinese. The app follows the system language at first and can be changed in Settings; the desktop window switches along with it.
- Updates and menus: a newer version shows as a button in the top bar and a dot on the Settings gear; it opens an update window with "What's new" (the version's page on the site), "Later" and "Install and restart" with download progress. Settings is grouped into General, The yard, Coding agent hooks and About PlayPets (the version, updates, and links to the site, the user guide, release notes, GitHub, a problem report and the license). The tray menu has check-marked switches for the mini view, desktop mode and strolling (shown only when they apply), then Settings, Check for updates ("Update to v…" once one is known) and About; on Windows a left click on the icon opens the yard; when a coding agent waits for the person or ran into trouble, the icon gets a small blue or red mark and its tooltip names the friend; on macOS the menu bar has About, Check for Updates, Settings (⌘,) and an Edit menu; Ctrl+, opens Settings on Windows and Linux.
- Installer screens: the macOS disk image opens on a picture of the yard that shows dragging the app to Applications, and the Windows installer has pets on its first and last pages and in the step headers. Linux software centers (Ubuntu App Center, GNOME Software, KDE Discover) show a description and screenshots and list the app under Games.
- Downloads: macOS dmg, Windows installer and portable zip, Linux deb and AppImage (x64 and arm64) on GitHub releases; a trial MSIX from a local build.
- The website in English, Korean, Japanese and Simplified Chinese, with a creator kit for each companion: character, wardrobe, expression and motion references, the prompts used, and pet files ready to import.

### Security
- Coding-agent hooks never send your prompts or tool inputs, but the short completion and notification reports they carry can contain work details, and those reports can reach the AI provider of the friend that hears them.
- Pet import downloads files only from the site of the pasted address (its subdomains and the hosts of registered communities), and does not follow a page that points anywhere else. Private addresses are blocked when the name is resolved.
- A pet file's description reaches the AI labeled as a description, not an instruction, and a personality saved during a chat keeps that label.
- Claude Code and Codex run in a folder of the app's own that no one else can write to, and get the friend's instructions from a file there or from standard input rather than the command line, where other programs could read them (unless that folder cannot be made).

### Known limitations
- The downloads are not code-signed, so macOS Gatekeeper and Windows SmartScreen block the first launch.
- On Linux the window is drawn with WebKitGTK's shared-memory renderer, because its DMA-BUF renderer leaves the window blank or frozen where there is no usable GPU (a virtual machine, a remote desktop, some drivers).
- The Windows build was checked in a virtual machine (the x64 installer on Windows 11 ARM), installing and running, but has not been tested enough on real machines yet.
