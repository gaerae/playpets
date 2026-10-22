# Changelog

Changes people can see in PlayPets, release by release. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

- In the PR that makes a change, add one line under `## [Unreleased]` (Added, Changed, Fixed, Removed, Security, Known limitations).
- At release time, `npm run release -- x.y.z` moves this section into a dated `## [x.y.z]`, and pushing the tag turns that section into the release notes.

## [Unreleased]

### Added

- Manage every AI connection in one place, in Settings → Friends & AI, with automatic chat beside them; Edit and Connect an AI open the form right there, without a second window over Settings.
- Open the short right-click menu (Place & atmosphere, Play, Friends & settings, Always on top) from a corner button in small windows, where the dock is hidden; the button, like the update button in the other corner, shows only while the pointer is over the window or it has the keyboard focus, so a small window kept on the desktop shows just the yard.
- Dig at a right-clicked spot of bare ground with Dig here, without opening Play.
- Ask a friend to dig from its right-click menu.
- Open the album at the right book from a find's card, and see a dot on Album and Play while something new waits there.
- Let idle friends dig on their own now and then with a new switch in Settings → Friends & AI.
- Switch between Dig, Plant a tree and Plant a seed with 1, 2 and 3 while a tool is in hand.

### Changed

- Show Place & atmosphere, Play and Friends & settings each as one page of sections, without tabs, sub-views or Back buttons: Play groups Find, Garden and Group games, and a running game ends from its own tile.
- Keep one Settings entry in Friends & settings. In a large window Settings is a centred sheet sized to the window (up to 760 × 640) that keeps its list of sections on the left beside the open section and reopens where it was left; a small window opens on the list, one section at a time, and Back returns one step at a time.
- Offer Talk and Play in a friend's right-click menu, matching the name tag and the dock.
- Keep the dig and tree tools in hand after each spot, sending the next free friend each time, and switch between digging, trees and seeds from the strip at the bottom until Esc or Close puts the tool away.
- Fish or catch a creature with one press even while a play tool is in hand; the press puts the tool away first.
- Show the tool strip where the dock was, right where Play was opened and just above the ground, and show a find's card above the friend who found it.
- Give every message on the yard one look and one reading time: notices stack two lines along the bottom (one in small windows) with failures in dark ink, cards wait while a panel covers the yard, overlapping speech bubbles rise clear of each other, and a friend's words are read aloud to screen readers.
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

## [1.1.0] - 2026-10-20

### Added

- Expand the album to 100 entries with seasonal flowers, distinct freshwater creatures, crawling and hopping insects, and everyday keepsakes.
- Give Daisy, Clover, Pip and Miso authored digging, planting, casting, waiting, reeling and discovery animations in every seasonal outfit, while imported pets keep their original sheets.
- Find six species of tree saplings by digging, keep them in a saved pocket and spend one when planting.
- Discover bottle caps, tiny robots, miniature crowns and star fragments alongside eight existing keepsakes.
- Grow oak, birch and willow trees with seasonal artwork; keep up to six trees per place and 24 in total.

### Changed

- Give the field cricket a leaf-green illustrated sprite and matching fallback colors while keeping its short ground hops.
- Remove exact collection percentages and their display control, clarify habitat clues and the shared yard-wide daily gift allowance, and explain full decoration capacity.
- Favor tree saplings and keepsakes by season, weather and place, show useful habitat clues in the album and four-language guide without exposing exact odds, and pace uncommon finds with a shared rolling 24-hour interval that redirects their chance into common finds.
- Show season, time and weather as compact radio segments with visible choices and keyboard navigation.
- Give digging a painted recessed soil opening with a broken rim, seasonal edge and contact-synchronized reveal.
- Use actual per-creature bug probabilities in the guide, make the golden firefly rare during its event, and clarify automatic fishing and calendar gifts while keeping every album entry reachable.
- Keep basic action labels on one line at every window size and replace middle-dot notation with plain words or punctuation.
- Show one scenery caption in the dock and use restrained, shared corners for panels, controls and cards.
- Use one Play board at every window size and open Settings tasks directly from management, retaining a task list for tray and shortcut entry.
- Use a small download icon with an unread dot instead of a version banner in small windows, retaining the accessible label and update controls.
- Synchronize digging effects and wait for both the complete action and its saved result before revealing a discovery.
- Finish brief jump, wave and celebration gestures once instead of cutting them during a second loop.
- Give scenery, play and friends/settings separate homes; remove repeated menu destinations and keep season and sound together in atmosphere controls.
- Keep atmosphere choices on one line with the native fonts used by macOS, Windows and Linux.
- Separate Friends, Settings and Window into short tabs, with direct settings tasks and a fixed tab row above the scrolling content.
- Use compact desktop controls, smaller panels and clearer primary navigation, with importing beside the Invite title.
- Stack yard events in one feedback lane and keep brief messages clear of panels and actions.
- Check for updates quietly 20 seconds after launch and every six hours, with delayed retries after network failures.
- Keep update progress, retry and the explicit install-and-restart action together in Settings → App updates.
- Obtain new flower seeds only by digging while preserving existing pockets and planted gardens.
- Offer digging in the shared Play board and show seed and sapling stock before planting.

### Fixed

- Keep onboarding tasks out of localized website captures by completing the controlled AI connection before photographing the yard.
- Keep the portable creator skill frontmatter compatible with current Codex skill validation.
- Preserve gift waiting progress across short sessions and full yards instead of restarting the delay after every launch.
- Refresh open collection odds when the weather changes and recheck planting ground at contact so newly occupied targets do not spend a sapling.
- Keep the selected seasonal landscape when choosing snow, including imported backgrounds and indoor window views.
- Preserve ground reward history while recovering normally after the computer clock moves backward.
- Preserve the 24-hour ground-reward limit beyond 32 distinct digs and discard expired records when loading existing saves without a file migration.
- Keep editing-dialog headings and actions visible in small windows, reveal inline errors and protect unfinished imports.
- Let automatically discovered Ollama models close normally without marking untouched forms as edited.
- Keep messages visible over open dialogs and let discovery cards remain while being read, with an explicit close action.
- Keep dragged furniture anchored to the grab point, follow movement without button transitions and restore failed moves.
- Use a standing pose with soil and shovel effects when digging instead of the coding animation.
- Count seeds promised to a friend on the way to plant, so a quick second click no longer plants an extra flower or ends in a missing-seed error.
- Keep keyboard focus on a tree choice when the yard updates while choosing a sapling.

### Removed

- Remove obsolete roaming-seed pickup styles, interaction guards, sound and translated instructions while preserving stored seeds and planted growth stages.

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
