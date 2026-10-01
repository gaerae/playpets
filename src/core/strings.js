// The languages the page speaks, one file each under strings/. Adding a language is a new file
// there and one entry in MODULES (docs/how-to/add-a-language.md has the whole checklist).
// ko is the reference the others are checked against.
import * as en from './strings/en.js';
import * as ja from './strings/ja.js';
import * as ko from './strings/ko.js';
import * as zhHans from './strings/zh-hans.js';

/** Language code → its file, in the order the settings tab lists them. */
const MODULES = { ko, en, ja, 'zh-hans': zhHans };
const each = pick => Object.fromEntries(Object.entries(MODULES).map(([code, m]) => [code, pick(m)]));
/** Language code → its own name, as the settings tab lists them. */
export const LANGUAGES = each(m => m.name);
/** Language code → key → sentence (or a list of sentences). */
export const STRINGS = each(m => m.strings);
/** Language code → how a sentence in it is recognised (text.js tells an error sentence from a code). */
export const SENTENCES = each(m => m.sentence);
/** Language code → whether its words are long enough that tight rows drop labels for icons. */
export const COMPACT = each(m => Boolean(m.compact));
/** Language code → what goes between names in a row ("A, B" or "A、B"). */
export const LIST_SEPARATOR = each(m => m.listSeparator ?? ', ');
