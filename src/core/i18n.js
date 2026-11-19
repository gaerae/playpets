// One voice in every language the page speaks. A key names the situation, strings/<lang>.js gives
// the sentence, and `{name}`-style holes are filled here. Korean sentences may
// ask for a particle that fits the word: `{name:을/를}` becomes 프리렌을 or 흰둥이를.
//
// The language is decided as the modules load, so every constant built from t() is right from
// the start: what the person chose (localStorage), else what the backend starts the page with,
// else the system language. Changing it reloads the page, which loads the new language's table.
import { LANGUAGES, LIST_SEPARATOR, SENTENCE_SEPARATOR, STRINGS, loadStrings } from './strings.js';
import { withParticle } from './words.js';

// Chinese comes in two scripts, and systems often say only the region: zh-CN, zh-SG and bare zh
// are the simplified one; zh-TW, zh-HK and zh-MO the traditional one.
const HANT = new Set(['tw', 'hk', 'mo']);
const HANS = new Set(['cn', 'sg', 'my']);
function withScript(parts) {
  if (parts[0] !== 'zh' || ['hans', 'hant'].includes(parts[1])) return parts;
  const script = HANT.has(parts[1]) ? 'hant' : HANS.has(parts[1]) || parts.length === 1 ? 'hans' : null;
  return script ? ['zh', script, ...parts.slice(1)] : parts;
}
// A locale tag, most specific first ("zh-Hant-TW" → zh-hant-tw, zh-hant, zh), against the
// languages the page speaks.
function normalize(tag) {
  const parts = withScript(
    String(tag || '')
      .trim()
      .toLowerCase()
      .split(/[.@]/)[0]
      .split(/[-_]/)
      .filter(p => /^[a-z0-9]+$/.test(p)),
  );
  for (let n = parts.length; n > 0; n--) {
    const code = parts.slice(0, n).join('-');
    if (LANGUAGES[code]) return code;
  }
  return null;
}
// Outside a browser (the node tests) there is nobody to ask, and English keeps the tests the same
// on every machine; a test that wants another language says so with setLanguageForTests.
function detect() {
  if (typeof window === 'undefined') return 'en';
  let stored = null;
  try {
    stored = localStorage.getItem('lang');
  } catch {}
  const system = typeof navigator !== 'undefined' ? navigator.language : null;
  return normalize(stored) || normalize(window.__PP_LANG) || normalize(system) || 'en';
}
// The language, once its table and English's (which fills any sentence it lacks) have loaded: the
// modules that build labels from t() run only after this one, so they wait for both.
async function loaded(code) {
  await Promise.all([loadStrings(code), loadStrings('en')]);
  return code;
}
let current = await loaded(detect());
export const language = () => current;
// Takes effect at once; in a page, its sentences arrive when the returned promise settles (until
// then they read in English). Outside a page every table is already there.
export function setLanguageForTests(code) {
  current = normalize(code) || 'en';
  return loadStrings(current);
}

function fill(text, params) {
  return text.replace(/\{(\w+)(?::([^}]+))?\}/g, (whole, name, particle) => {
    if (!(name in params)) return whole;
    const value = String(params[name]);
    return particle ? withParticle(value, particle) : value;
  });
}
// The sentence for `key`; English when the language lacks it, the key itself when nobody has it.
export function t(key, params = {}) {
  const text = STRINGS[current]?.[key] ?? STRINGS.en[key] ?? key;
  return typeof text === 'string' ? fill(text, params) : text;
}
// Names in a row, joined the way the language lists things ("A, B" or "A、B").
export function joinList(items) {
  return items.join(LIST_SEPARATOR[current] ?? LIST_SEPARATOR.en);
}
// Sentences in a row, as the language runs them on ("A. B" or "A。B").
export function joinSentences(items) {
  return items.join(SENTENCE_SEPARATOR[current] ?? SENTENCE_SEPARATOR.en);
}
// A key whose value is a list of sentences (greetings, idle chatter).
export function list(key) {
  const value = STRINGS[current]?.[key] ?? STRINGS.en[key];
  return Array.isArray(value) ? value : [];
}
/** A list of sentences (list) with `params` filled in, as t fills one. */
export const lines = (key, params = {}) => list(key).map(text => fill(text, params));
// Static markup names its sentences: <span data-i18n="tabs.friend"></span> for the text, and
// data-i18n-title / -placeholder / -aria-label for those attributes.
export function apply(root = document) {
  document.documentElement.lang = current;
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const attr of ['title', 'placeholder', 'aria-label']) {
    const name = `data-i18n-${attr}`;
    for (const el of root.querySelectorAll(`[${name}]`)) el.setAttribute(attr, t(el.getAttribute(name)));
  }
}
// The backend remembers the language; when it and the page disagree (a first start, a choice
// made on another window) the page takes the backend's and starts over in it.
export function follow(code) {
  const lang = normalize(code);
  if (!lang || lang === current) return;
  try {
    localStorage.setItem('lang', lang);
  } catch {}
  location.reload();
}
