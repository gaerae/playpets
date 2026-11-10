// The app's own names and pictures for the album kinds the landing shows. Names come from the app's
// string tables, so the landing says what the album says; pictures are painted from the app's
// drawings by scripts/site-album.mjs.
import { withBase } from 'vitepress';
import { strings as en } from '../../../src/core/strings/en.js';
import { strings as ja } from '../../../src/core/strings/ja.js';
import { strings as ko } from '../../../src/core/strings/ko.js';
import { strings as zh } from '../../../src/core/strings/zh-hans.js';
import generated from '../generated.json';

const TABLES: Record<string, Record<string, unknown>> = { en, ko, ja, 'zh-hans': zh };
const BOOK_TAB: Record<string, string> = {
  flowers: 'catch.tab_flowers',
  fish: 'catch.tab_fish',
  bugs: 'catch.tab_bugs',
  gifts: 'catch.tab_gifts',
  trees: 'album.trees',
  treasures: 'album.treasures',
  tracks: 'album.tracks',
  shoots: 'album.shoots',
};
const KIND_PREFIX: Record<string, string> = {
  flowers: 'garden.kind_',
  fish: 'catch.fish_',
  bugs: 'catch.bug_',
  gifts: 'decor.kind_',
  trees: 'tree.',
  treasures: 'treasure.',
  tracks: 'track.',
  shoots: 'shoot.',
};

/** The app's string for `key` in `lang`, with {placeholders} filled. */
export function appWord(lang: string, key: string, values: Record<string, string> = {}) {
  const text = String(TABLES[lang]?.[key] ?? en[key] ?? key);
  return text.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
}
export const bookName = (lang: string, book: string) => appWord(lang, BOOK_TAB[book]);
export const kindName = (lang: string, book: string, id: string) => appWord(lang, `${KIND_PREFIX[book]}${id}`);

type Picture = { src: string; width: number; height: number };
/** A kind's picture on the site, or null when site:prepare had no browser to paint it with. */
export function kindArt(book: string, id: string): Picture | null {
  const picture = (generated as { albumArt?: Record<string, Picture> }).albumArt?.[`${book}/${id}`];
  return picture ? { ...picture, src: withBase(picture.src) } : null;
}

/** "Apr 1 – 20"-style dates from two "MM-DD" days, in the page's language and the app's wording. */
export function dayRange(lang: string, from: string, to: string) {
  const format = new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric' });
  const date = (md: string) => format.format(new Date(2004, Number(md.slice(0, 2)) - 1, Number(md.slice(3))));
  return appWord(lang, 'catch.dates', { from: date(from), to: date(to) });
}
