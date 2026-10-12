# Product direction

Consolidated on 2026-10-13 from the design work of 2026-10-11 and 2026-10-12.

PlayPets is a little yard for companions who talk to you and to each other. You choose
their personalities and relationships, share quiet activities with them, and keep them
nearby while you work or unwind. Coding tools are an optional way in, not a requirement
for companionship. This record holds that promise, what follows from it for the app, the
claims the product keeps precise, and the bar for the first release. It builds on the
decision to [lead with a yard where your pets talk to each
other](../decisions/2026-10-05-positioning-talking-friends.md).

## What the app is for

- **Conversation:** each friend can connect to its own AI: a signed-in Claude Code or
  Codex CLI, Ollama, or an OpenAI-compatible server. Friends also talk to each other now
  and then when Settings allows it. The first connection offers to serve every friend
  that has none, so a group conversation can start right away.
- **Relationships:** a friend starts as a friend; partner, senior and junior are
  explicit choices that change its voice and what it calls you (`RELATIONS` in
  `src-tauri/src/pets/model.rs`, voices in `src-tauri/src/chat/prompt.rs`). Closeness
  grows and persists.
- **Quiet shared activities:** the garden, gifts, fishing, bugs, games and the album ([A
  yard that grows with you](2026-10-09-a-yard-that-grows.md)), in two places
  ([places](2026-10-11-places.md)).
- **Nearby, not in the way:** the full window, the mini window and friends on the
  desktop. In the mini window friends wait 1.8 times as long between wanders
  (`src/yard/motion.js`), and a person can chat without enlarging it.
- **Coding hooks, optional:** `playpets hook` and `playpets mcp` let friends react while
  a coding agent works ([agent integration](../agent-integration.md)). First-run
  guidance finishes once a friend can talk; hooks are not a step.

A friend needs no AI account to move, play, garden or collect. A starter can be chosen
and invited before any connection exists.

## Who it is not for

People who want only an agent status indicator will find lighter apps that support more
agents. PlayPets does not compete on that list; its friends are lasting companions and
do not send prompts to agents.

## Claims kept precise

These hold for the app, the README, the site and any announcement:

- **Cost:** local Ollama models need no hosted inference fee. Subscription CLIs use the
  plan's allowance; API-key sign-in and paid extra usage can be charged. A remote Ollama
  server or a cloud model is not described as local or offline.
- **Privacy:** hooks omit prompts and tool inputs, but short completion and notification
  reports can reach the chosen friend's AI. Local hook transport does not mean every
  later conversation stays on the device.
- **Memory:** chat history lasts only for the current app session and is not saved to a
  file; the connected provider may keep its own records. Relationships and closeness
  persist.
- **Pets:** compatible pet folders and supported galleries import. Personal ChatGPT
  cloud pets do not synchronize. Do not advertise an unverified total number of
  available pets.
- **Comparisons:** other desktop pets also offer chat, local models and community
  imports. Describe the shared yard, per-friend relationships and friends talking among
  themselves, without blanket claims about other apps.
- **Offline play:** moving, playing, gardening and collecting work without AI; offline
  play is never described as free cloud AI.

## Interface commitments

Rules the whole app keeps, which later changes leave in place:

- Show the app before configuration. Setup details sit behind a disclosure or a guide
  link.
- Settings keeps its title, close button and section navigation fixed and scrolls only
  the selected section's body.
- A failed action recovers: a failed chat restores the sent draft unless a new one was
  typed and releases the send control; a failed provider, assignment or preference
  change shows the saved choice again; a dialog stays stable while a save is pending and
  keeps its error for a retry.
- A catch that finishes after its friend left keeps the collection entry but rewards
  only the same friend still in the yard.
- Invite combines a type filter with name and creator search; "Show all" resets both.
  The import dialog keeps the address field and actions visible, with community links in
  a collapsed list from `src/content/communities.json` ([Add or change a discovery
  site](../how-to/add-discovery-site.md)). Those are community links, not partnerships.
- Fishing's bite target stays still, 44 pixels wide, labelled in every language and
  usable from the keyboard.
- Reduced motion keeps intentional travel and games and removes decorative animation.

## The bar for the first release

Show the real app: distinct companions, a short exchange between friends, a small game
and a quick chat in the mini window, using `assets/demo.gif` and the site captures. Link
to a working download and the guide. Publish only after release files and the site's
download links work; a repository push is not a release ([Release a new
version](../how-to/release.md)).

How the first weeks are judged, as targets rather than forecasts:

- In observed first-use sessions, most people invite a friend without guidance.
- Most people who already have a usable local model or signed-in CLI send a first
  message without help with the fields.
- Collect concrete reasons people keep the mini window open and reasons they close it.
- Count download visits, installation problems and failed first conversations alongside
  stars. The app adds no undisclosed analytics.

Automated checks establish local behaviour and reviewed composition. They do not
establish long-term comfort, retention, growth, or native visual quality on Windows and
Linux; those need people and real devices.

## Channels

Lead with the yard. For a pet-gallery maintainer, lead with compatible import and the
`playpets://import?url=…` link (`src-tauri/src/links.rs`). For a coding community, show
agent reactions after the yard. For desktop-customization communities, show the mini
window and the cast. Follow each community's rules and ask for specific feedback; never
buy stars or spam.

## Later decisions, not features

- An in-app gallery with previews before importing would remove the browser round trip,
  but needs its own fetching and trust design.
- Optional conversation memory across restarts.
- Pictures of pets in chat are on hold
  ([decision](../decisions/2026-10-05-pet-pictures-on-hold.md)).

None of these is advertised until it ships.
