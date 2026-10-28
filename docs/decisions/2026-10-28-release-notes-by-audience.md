# Decision: Write release notes for each reader, with one user page per version for every system

## Context
- One version reached people through texts made from two sources.

| Channel | Source | Reader |
|---|---|---|
| GitHub release, `latest.json`, winget's release notes link | `CHANGELOG.md` | People working on PlayPets, and anyone who reads GitHub |
| Website release page, the app's **What's new** | `website/releases/x.y.z.md` in four languages | People using the app on any system |
| Microsoft Store "What's new" | The release page's first section | People installing from the Store, on Windows |
| Linux software centers | The metainfo's `<release>` | People on Linux; it had a version and a date only |

- The 1.3.0 Store text listed the macOS signature, the Homebrew command, the user guide rewrite and Rust library security updates as improvements.
- Its lines were instructions: settings paths and commands, more than 200 characters each.
- The 1.3.0 changelog listed website changes under Added next to app features, and winget linked to it.

## Decision
- Two texts, one per reader:

| Text | Reader | Holds |
|---|---|---|
| `CHANGELOG.md`, the GitHub release body | People working on PlayPets | Every change people notice; website, user guide and README changes under `### Website and docs` |
| The release page in four languages | People using the app, on every system | An opening sentence, `## What changed` (what they notice, one short line each), `## Also` (install ways, the guide, security updates) |

- A line for some systems starts with `<Only os="macOS" />` (one name or two, such as `os="macOS, Linux"`); the site shows a badge in the page's language.
- Each channel reads the page for its own system (`scripts/release-page.mjs`):

| Channel | Reads |
|---|---|
| The app's **What's new**, every system | The whole page |
| Microsoft Store | The opening sentence and the Windows lines of `What changed` |
| Linux metainfo (`npm run release`) | The English opening sentence and Linux lines, with a link to the page |
| GitHub release | A link to the page, then the changelog |
| winget | A link to the page |

- No channel is the main one. The Store and Linux texts are filters of the same page; macOS has no store, and its users read the page in the app.
- A release with nothing new for one system gives that system's channels the opening sentence and the address.
- The writing rules live in the [writing standard](../standards/writing.md#release-notes). From 1.3.0 on, `npm run release` stops on a page that breaks them, and a test checks every page.

## Consequences
- Positive: each reader gets what changed for them, and the changelog stays complete.
- Positive: the four languages list the same changes, each line for the same systems; the check compares them.
- Negative: the writer judges what a person notices; a script cannot tell an app change from an install note.
- Neutral: the 1.3.0 pages were rewritten to the rules; the 1.3.0 Store submission was already published and keeps its text. Pages before 1.3.0 are unchanged.

## Alternatives considered
| Alternative | Why rejected |
|---|---|
| Write each channel's text by hand, in four languages | A text per channel and language for each release, and they drift apart |
| Make the user notes from the changelog | The changelog is English only and written for people working on PlayPets |
| Filter lines by keywords (Homebrew, security) | Keywords differ per language and miss new install ways; the writer knows the reader |
