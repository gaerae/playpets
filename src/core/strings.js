// The languages the page speaks, one file each under strings/. Adding a language is a new file
// there and one entry in LANGUAGES (docs/how-to/add-a-language.md has the whole checklist).
// ko is the reference the others are checked against.
//
// A table is about 60 KB and a window speaks one language, so a page loads only the table it
// speaks and English, the fallback (i18n.js), not all four. Each language's own name is kept here
// rather than in its table, so the settings tab lists every language without loading them.

/** Language code → its own name, in the order the settings tab lists them. */
export const LANGUAGES = { ko: '한국어', en: 'English', ja: '日本語', 'zh-hans': '简体中文' };
/** Language code → key → sentence (or a list of sentences), for each table loaded so far. */
export const STRINGS = {};
/** Language code → how a sentence in it is recognised (text.js tells an error sentence from a code). */
export const SENTENCES = {};
/** Language code → what goes between names in a row ("A, B" or "A、B"). */
export const LIST_SEPARATOR = {};
/** Language code → what goes between two sentences in a row (a space, or nothing). */
export const SENTENCE_SEPARATOR = {};

function use(code, table) {
  STRINGS[code] = table.strings;
  SENTENCES[code] = table.sentence;
  LIST_SEPARATOR[code] = table.listSeparator ?? ', ';
  SENTENCE_SEPARATOR[code] = table.sentenceSeparator ?? ' ';
}
/** Loads a language's table into the maps above, once; a code the page does not speak loads nothing. */
export function loadStrings(code) {
  if (!Object.hasOwn(LANGUAGES, code)) return Promise.resolve();
  if (!loading.has(code))
    loading.set(
      code,
      import(`./strings/${code}.js`).then(table => use(code, table)),
    );
  return loading.get(code);
}
// Every table, put in the maps in LANGUAGES' order; for each, the settled load loadStrings returns.
async function everyTable() {
  const codes = Object.keys(LANGUAGES);
  const tables = await Promise.all(codes.map(code => import(`./strings/${code}.js`)));
  return codes.map((code, i) => [code, Promise.resolve(use(code, tables[i]))]);
}
// Outside a page (the node tests, scripts/shots.mjs) nobody waits for a first frame and the tests
// read every table, so all of them load with this module.
const loading = new Map(typeof window === 'undefined' ? await everyTable() : []);
