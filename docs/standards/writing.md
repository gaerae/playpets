# Standard: Writing docs

## Scope
- README, CONTRIBUTING, SECURITY and every current guide in `docs/`.
- The user guide on the site, in all four languages (`website/**/*.md`).
- Folder READMEs that explain tools or assets (`scripts/`, `tests/`, `packaging/`, `assets/`, `src/`).
- Not covered:
  - Dated records in `docs/decisions` and `docs/design`. They are not rewritten ([decision](../decisions/2026-10-13-design-records.md)).
  - `CHANGELOG.md` entries already released.
  - Generated pages (`website/dev/`, `website/releases/`).
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
