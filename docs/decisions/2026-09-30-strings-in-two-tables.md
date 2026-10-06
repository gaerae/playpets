# Decision: Strings live in two per-language tables, one for the page and one for the backend, and agent status is sent as codes

## Context
Every string in the app was hard-coded in Korean all over the code (page JS and HTML, Rust error messages, the tray menu). Supporting Korean, English and Japanese means gathering the strings in one place. The page has no build tool, so it cannot rely on importing JSON as a module (import attributes). Support for that is uncertain on older engines such as WebKitGTK on Linux. Agent hooks run in a different process from the app (the CLI mode of the same executable), so they do not know which language the app is using.

## Decision
We keep strings in two tables.
- Page: `src/core/strings.js`, with a Korean, English and Japanese sentence for each key. Used through `t(key, values)`, `list(key)` and the `data-i18n` attribute in HTML.
- Backend: `src-tauri/src/i18n/table.rs`, with `(key, Korean, English, Japanese)` rows. Used through `i18n::t` and `i18n::tr`.

Agent hooks send codes (`@tool Bash`, `@done`) instead of status sentences, and the app turns them into its own language. CLI and MCP text that goes to the terminal and to agents is fixed in English. The language follows the system language at first, and once a person picks one it is saved in `language` in `state.json`. Changing it reloads the page.

## Consequences
- Positive: All strings are in two files. Tests check that the three languages have the same keys and placeholders, that no Korean is left in the modules, and that every key used is in the table. Agent status shows up in the app's language.
- Negative: The page and the backend can each hold the same sentence (there are two tables, so they share nothing). Changing the language reloads the page once. Translations have to be put into the tables by hand.
- Neutral: What an agent says in its own words (the `say` command, Codex's last answer) is not translated and shows as it is.

## Follow-up (2026-10-05)
The two-table decision stands. But instead of one file with three languages side by side, each language now has its own file (`src/core/strings/<language>.js`, `src-tauri/src/i18n/<language>.rs`), and the language list is read from a registry (`src/core/strings.js`, and `Spec` in `i18n/mod.rs`). This is so that adding a language does not mean editing every row. The steps are in [Add a language](../how-to/add-a-language.md). Simplified Chinese (`zh-hans`) was then added this way as the fourth language, after Korean, English and Japanese.

## Alternatives considered
- **One JSON file read by both sides:** It would be shared, but the page would need a build step or fetch to load JSON, and the page's CSP blocks outside requests.
- **A translation library such as i18next:** Lots of features, but more dependencies, and at three languages all we need is key lookup and placeholders.
