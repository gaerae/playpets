# Add a language

- The app speaks Korean (`ko`), English (`en`), Japanese (`ja`) and Simplified Chinese (`zh-hans`).
- Codes are lowercase BCP 47.
- A language with two writing systems uses the full code, such as `zh-hans`. When the system reports only `zh-CN`, the region tells which writing system it is.
- Add two string files and register them, then update the site and installer language lists below.
- The Korean file is the reference: copy its key order and placeholders (`{name}`) as they are.
- The tests tell you what is missing.
- The language list has two sources: `MODULES` in `src/core/strings.js` (page) and `ALL` in `src-tauri/src/i18n/mod.rs` (backend).
- The list in the Settings tab, the capture script and the site tests read from those two.

## 1. Page strings

1. Copy `src/core/strings/ko.js` to `src/core/strings/<code>.js` and translate the sentences. The file exports three required things and one optional one:

   | Export | What it holds |
   |---|---|
   | `name` | What the language calls itself (shown in the list in the Settings tab) |
   | `sentence` | A regular expression that recognizes a sentence in that language (`text.js` uses it to tell error sentences from codes). Use a character range when the writing system gives the language away, otherwise punctuation |
   | `strings` | Key → sentence. Keys whose value is a list (greetings, chatter) stay lists |
   | `listSeparator` (optional) | The separator when listing names. Default `', '`; Japanese uses `'、'` |

2. Add one `import` line and one entry to `MODULES` in `src/core/strings.js`. The language list in the Settings tab comes from here.
3. Use plain placeholders. `words.js` adds Korean particles (a placeholder with the two particle forms after a colon) for Korean only. When listing names, `joinList` picks that language's comma.
4. For a different writing system, add a font stack for the language in `src/styles/base.css`, like `:root:lang(ja)` (Chinese drawn with Japanese fonts gets different glyph shapes).

## 2. Backend strings

1. Copy `src-tauri/src/i18n/ko.rs` to `src-tauri/src/i18n/<module>.rs`.
   - The module name is the code with `-` turned into `_` (a Rust module name cannot contain a hyphen): `zh-hans` is `zh_hans.rs`.
   - Keep rows in the same order as `ko.rs`. The test checks the order too, so the files can be edited side by side.
2. Put the code and the English name in `SPEC` at the top of the file. The AI gets the English name when told "answer in this language".
3. In `src-tauri/src/i18n/mod.rs`:
   1. Add `mod <module>;` (for example `mod zh_hans;`).
   2. Add `&<module>::SPEC` to `ALL`.
   3. Increase the array length in its type (`[&Spec; 4]`) by one.
   - Nothing else changes: `Lang` refers to a language by its position in `ALL`.

## 3. Other places

| Place | What to change |
|---|---|
| Site | `locales` in `website/.vitepress/config.mts` and the docs in `website/<code>/guide/`. Register the locale in `scripts/site-content.mjs`, add `theme/landing-<code>.ts` and its active copy contract, and update `theme/words.ts` and the creator components. Add an Open Graph card, guide pages and release notes, then test canonical and alternate links |
| Captures | Add the language's names, personalities and sample conversation to `script` in `scripts/shots.mjs`; `npm run shots` then captures screens in that language too (it reads the language list from `strings.js`). Choose languages with `SHOT_LANGS=ko,en` |
| `docs/standards/i18n.md` | The supported-languages line |
| OG images | `scripts/make-og.mjs` makes one image per language the site has. Add the language once the site has it |
| `README.md` and this doc | The language line in `README.md` and the first line of this doc |
| Windows installer | The NSIS language name in `bundle.windows.nsis.languages` in `src-tauri/tauri.conf.json` and the locale in `packaging/windows/msix/AppxManifest.xml`. Update the expected mappings in `tests/repository-config.test.mjs` |

- The site picks its languages separately, so it can have fewer than the app.
- Today the landing page, user guide and release pages are in Korean, English, Japanese and Simplified Chinese.
- The developer docs are in English only.
- `Landing.vue` composes the landing modules.
- Publishing, captures and release validation share the locale registry.
- Once the site has docs in that language, `tests/website.test.mjs` looks for the captures used by `website/<code>/` in that language's folder.
- Windows installer:
  - Keep the language selector enabled.
  - NSIS uses names such as `English`, `Korean`, `Japanese` and `SimpChinese`; MSIX uses locale tags.
  - Inspect the installer and uninstaller on Windows.

## 4. Check

```bash
npm test
```

- `tests/i18n.test.mjs` checks that every language file has the same keys and placeholders, that no Korean is left in a module, and that every key the code asks for is in the table.
- `i18n::tests` in `cargo test` checks the backend side the same way.
- Then run the app with `PLAYPETS_LANG=<code>` and pick the language in the Settings tab.
