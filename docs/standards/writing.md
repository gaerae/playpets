# Standard: Writing docs

## Scope
- README, CONTRIBUTING, SECURITY and every current guide in `docs/`.
- The user guide and the release pages on the site, in all four languages (`website/**/*.md`).
- `CHANGELOG.md` entries under `[Unreleased]`.
- Folder READMEs that explain tools or assets (`scripts/`, `tests/`, `packaging/`, `assets/`, `src/`).
- Not covered:
  - Dated records in `docs/decisions` and `docs/design`. They are not rewritten ([decision](../decisions/2026-10-13-design-records.md)).
  - `CHANGELOG.md` entries already released, and release pages before 1.3.0.
  - Generated pages (`website/dev/`).
  - Prompt files for artwork. They are input to a tool, not docs.

## Rules
- Match the form to the content:
  - Technical content (commands, settings, file paths, options, limits, developer docs): short bullets and tables. One fact per bullet.
  - Guidance to a person using the app (what a feature is for, what happens when they do something, the friends' stories): short paragraphs of natural sentences. No paragraph longer than three lines.
- Start with the answer or the action.
- Write each language as a person who speaks it would. No word-for-word translation of another language's sentences.
- Cut filler, repetition and hedging. Keep every fact: commands, paths, numbers, limits, warnings and links.
- Steps a person follows in order are a numbered list. Options and comparisons are a table.
- Commands and code go in code blocks; file names, keys and values in backticks.
- Bold marks a label a person sees in the app (**Settings → Friends & AI**), not emphasis.
- Use plain verbs. No RFC words such as MUST or SHOULD.
- Keep headings stable. Other pages and the site link to their anchors, and each site language keeps the same headings in the same order.
- Keep page structure the site needs: front matter, `<Shot>`, `<Since>`, `:::` boxes.
- No middle dots (·) on the site. Use commas, "and" or a list.

## Release notes
Each reader gets the text written for them ([decision](../decisions/2026-10-28-release-notes-by-audience.md)).

| Text | Reader | Holds |
|---|---|---|
| `CHANGELOG.md` | People working on PlayPets | Every change people notice; the website, the user guide and the README under `### Website and docs` |
| Release page, `website/releases/x.y.z.md` in four languages | People using the app, on every system | What they notice, written short |

The release page:

| Part | Rule | Length (English / ko, ja, zh-hans) |
|---|---|---|
| `headline:` in the front matter | The main change, a few words. The release lists show it | Short |
| Opening sentence | One or two sentences on the main change for every system. The one place for a little wit, in the yard's own words | 200 / 100 characters |
| `## What changed`, the first section | One change per line, what the person gets first. No commands or paths: link the guide instead | 100 / 60 characters a line |
| A line for some systems | Starts with `<Only os="macOS" />` (or `Windows`, `Linux`, or two names: `os="macOS, Linux"`) and does not name the system again | |
| `## Also`, the second section | Install ways, the user guide, security updates. Short; one link each | |
| Last paragraph | A link to the guide for each thing to set up | |

- The two sections are `## What changed` and `## Also` in English, in that order. Each language has its own two headings, listed in `HEADINGS` in `scripts/release-page.mjs`; the check names the heading it expects.

From the changelog to the page, at release time:

1. Read the version's `## [Unreleased]` section in `CHANGELOG.md`.
2. Added, Changed and Fixed: each change a person notices becomes one line of the first section. Leave out what only people working on PlayPets see.
3. Security: one line in the second section. Library names and advisory IDs stay in the changelog.
4. Website and docs: a line in the second section only when a person using the app gains from it (a rewritten guide, a new install way).
5. Known limitations: the guide page that covers them, linked from the last paragraph.
6. Write the English page, then the other three with the same lines.

- The four languages list the same changes, in the same order, each line for the same systems.
- A release with nothing new for one system: that system's channels show the opening sentence and the page's address.
- Each channel reads the page for its system: the Store the Windows lines, Linux software centers the Linux lines, the app's **What's new** the whole page.
- `pnpm run release` stops on a page that breaks these rules; `node --test tests/release-notes.test.mjs` checks them before that.
- To check a version's pages and see each system's text: `node scripts/release-page.mjs x.y.z`. The Store's text as it is sent: `node scripts/store-notes.mjs x.y.z`.

Before:

> - Grok Build joins Claude Code, Codex, Gemini CLI and Cursor. Copy its settings from Settings → Coding tools and save them in `~/.grok/hooks/`; a friend then shows when Grok thinks, uses a tool, waits for you and finishes.

After:

> - A friend reacts while Grok Build thinks, uses a tool, waits for you and finishes.

## Tone by language
- English: plain, short sentences or fragments.
- Korean (site only): short polite phrases, the same style as the app. Korean stays out of developer docs ([i18n](i18n.md)).
- Japanese: short です and ます phrases.
- Simplified Chinese: plain, friendly 你, full-width punctuation.
- Product terms follow the glossary in [Multilingual strings](i18n.md).

## Example

Before:

> If you would like to change which AI a friend uses, you can open the settings and then go to the Friends & AI section, where you will find the connection list.

After, as a setting:

> - Change a friend's AI in **Settings → Friends & AI**.

After, as guidance:

> A friend with no AI still plays in the yard. Give it one in **Settings → Friends & AI** and it starts answering you in its own words.
