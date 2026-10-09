# Add a language

The app speaks Korean (`ko`), English (`en`), Japanese (`ja`) and Simplified Chinese (`zh-hans`). Codes are lowercase BCP 47; a language with two writing systems uses the full code, like `zh-hans` (when the system says only `zh-CN`, the region tells which writing system it is). Adding a language takes two strings files and one registration line in each of two places. The Korean file is the reference: copy its key order and placeholders (`{name}`) as they are, and the tests tell you what is missing. The language list has two sources: `MODULES` in `src/core/strings.js` on the page side and `ALL` in `src-tauri/src/i18n/mod.rs` on the backend side. The list in the Settings tab, the capture script and the site tests read from those.

## 1. Page strings

1. Copy `src/core/strings/ko.js` to `src/core/strings/<code>.js` and translate the sentences. The file exports three required things and one optional one.
   - `name`: what the language calls itself (shown in the list in the Settings tab).
   - `sentence`: a regular expression that recognizes a sentence in that language (`text.js` uses it to tell error sentences from codes). Use a character range if the writing system gives it away, otherwise punctuation.
   - `strings`: key → sentence. Keys whose value is a list (greetings, chatter) stay lists.
   - `listSeparator` (optional): the separator used when listing names. The default is `', '`; Japanese uses `'、'`.
2. Add one `import` line and one entry to `MODULES` in `src/core/strings.js`. The language list in the Settings tab comes from here.
3. `words.js` attaches Korean particles (`{name:을/를}`) only for Korean. Other languages use plain placeholders. When listing names, `joinList` picks that language's comma.
4. If the writing system is different, add a font stack for the language in `src/styles/base.css`, like `:root:lang(ja)` (Chinese drawn with Japanese fonts gets different glyph shapes).

## 2. Backend strings

1. Copy `src-tauri/src/i18n/ko.rs` to `src-tauri/src/i18n/<module>.rs`. The module name is the code with `-` turned into `_`, since a Rust module name cannot contain a hyphen: `zh-hans` is `zh_hans.rs`. Rows have to stay in the same order as `ko.rs` (the test checks the order too, so the files can be edited side by side). Put the code and the English name in `SPEC` at the top of the file. The English name is used when telling the AI "answer in this language".
2. In `src-tauri/src/i18n/mod.rs`, add `mod <module>;` (for example `mod zh_hans;`), add `&<module>::SPEC` to `ALL`, and increase the array length in its type (`[&Spec; 4]`) by one. That is all; `Lang` refers to a language by its position in `ALL`.

## 3. Other places

- Site: `locales` in `website/.vitepress/config.mts` and the docs in `website/<code>/guide/`. The site picks its languages separately, so it can have fewer than the app (today the landing page, user guide and release pages are in Korean, English and Simplified Chinese, and the developer docs are in English only). Add one set per language to `copy` in `Landing.vue` for the landing page text, and to `theme/words.ts` for what the components say.
- Captures: add the language's names, personalities and sample conversation to `script` in `scripts/shots.mjs`, and `npm run shots` captures screens in that language too (it reads the language list from `strings.js`). You can choose languages, like `SHOT_LANGS=ko,en`. Once the site has docs in that language, `tests/website.test.mjs` looks for the captures used by `website/<code>/` in that language's folder.
- The supported-languages line in the doc `docs/standards/i18n.md`.
- OG images: `scripts/make-og.mjs` makes one image per language the site has. Add the language once the site has it.
- The language line in `README.md` and the first line of this doc.

## 4. Check

```bash
npm test
```

`tests/i18n.test.mjs` checks that every language file has the same keys and placeholders, that no Korean is left in a module, and that every key the code asks for is in the table. `i18n::tests` in `cargo test` checks the backend side the same way. Then run the app with `PLAYPETS_LANG=<code>` and pick the language in the Settings tab.
