// The year-end letter: from December 26 to 31 the closest friend writes one, and from January 1 to
// 7 it brings back the answer the person left. This file is the pure part: when, who writes and
// what the letter says. The page owns the calendar; the backend keeps the record
// (src-tauri/src/pets/letters.rs). No line of the letter asks whether a plan was done.

import { list, t } from '../core/i18n.js';
import { pick } from '../core/math.js';

/** 'write' from December 26 to 31, 'back' from January 1 to 7, otherwise null (local date). */
export function letterTime(date) {
  const month = date.getMonth() + 1,
    day = date.getDate();
  if (month === 12 && day >= 26) return 'write';
  if (month === 1 && day <= 7) return 'back';
  return null;
}

/** The year whose letter `date` belongs to: this year in December, the year before in January. */
export const letterYear = date => (date.getMonth() === 0 ? date.getFullYear() - 1 : date.getFullYear());

/** The letter of `letterYear(date)` that still has its text, while the letter season lasts. */
export function readableLetter(letters, date) {
  if (!letterTime(date)) return null;
  const year = letterYear(date);
  return letters.find(letter => letter.year === year && letter.text) || null;
}

/** The friend with the most closeness; on a tie the one earlier in the list. */
export function writerOf(pets, bonds) {
  let best = null,
    most = -1;
  for (const pet of pets) {
    const points = bonds[pet.id]?.points || 0;
    if (points > most) {
      best = pet;
      most = points;
    }
  }
  return best;
}

/** The friend who wrote `letter`, or the closest one when it has left. */
export const bringerOf = (letter, pets, bonds) => pets.find(pet => pet.id === letter.friend) || writerOf(pets, bonds);

// The books the letter counts, with the string family that names what is in each. The secrets are
// left out so the letter never gives one away.
const BOOKS = ['fish', 'bugs', 'flowers', 'treasures', 'trees', 'tracks'];
const THING = {
  fish: id => t(`catch.fish_${id}`),
  bugs: id => t(`catch.bug_${id}`),
  flowers: id => t(`garden.kind_${id}`),
  treasures: id => t(`treasure.${id}`),
  trees: id => t(`tree.${id}`),
  tracks: id => t(`track.${id}`),
};

const dayNumber = ymd => {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

/** What is true of `year`: finds, the newest one, a tree grown, closeness, and days since meeting. */
export function letterFacts({ album, trees, bond, level, year, today }) {
  let finds = 0,
    newest = null,
    latest = -Infinity;
  for (const book of BOOKS)
    for (const [id, entry] of Object.entries(album?.[book] || {})) {
      if (!entry?.first || new Date(entry.first).getFullYear() !== year) continue;
      finds++;
      if (entry.first > latest) {
        latest = entry.first;
        newest = { book, id };
      }
    }
  let tree = null,
    planted = -Infinity;
  for (const grown of trees || [])
    if (grown.matured && new Date(grown.planted).getFullYear() === year && grown.planted > planted) {
      planted = grown.planted;
      tree = grown.kind;
    }
  const count = bond?.met ? dayNumber(today) - dayNumber(bond.met) : NaN;
  return { finds, newest, tree, level, days: count >= 1 ? count : null };
}

// Named one by one so the string-table test sees every key used.
const CLOSE = [
  'letter.fact_close_1',
  'letter.fact_close_2',
  'letter.fact_close_3',
  'letter.fact_close_4',
  'letter.fact_close_5',
];

/** The true things to say, in order, each only when there is something to say. */
export function factLines({ finds, newest, tree, level, days }) {
  const lines = [];
  if (finds > 0 && newest) {
    const thing = THING[newest.book](newest.id);
    lines.push(finds === 1 ? t('letter.fact_finds_one', { thing }) : t('letter.fact_finds', { count: finds, thing }));
  }
  if (tree) lines.push(t('letter.fact_tree', { tree: t(`tree.${tree}`) }));
  if (CLOSE[level - 1]) lines.push(t(CLOSE[level - 1]));
  if (days) lines.push(days === 1 ? t('letter.fact_days_one', { days }) : t('letter.fact_days', { days }));
  return lines;
}

/** The letter: a greeting, the lines, last year's answer when there is one, then the question.
 * One sentence to a line, so no language needs spaces between them. */
export function composeLetter(lines, lastAnswer) {
  const out = [pick(list('letter.hello')), ...lines];
  if (lastAnswer) out.push(t('letter.recall', { answer: lastAnswer }));
  out.push(t('letter.ask'));
  return out.join('\n');
}
