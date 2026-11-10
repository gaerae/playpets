// The year-end letter: from December 26 to 31 the closest friend writes one, and from January 1 to
// 7 it brings back the answer the person left. When, who writes and what the letter says come
// first, without the page; then how it comes, at the scene's minute check (setupLetters). The page
// owns the calendar; the backend keeps the record (src-tauri/src/pets/letters.rs) and decides
// whether the friend's AI writes it (chat/letter.rs). No line of the letter asks whether a plan
// was done.

import { list, t } from '../core/i18n.js';
import { pick } from '../core/math.js';
import { $, call, data, name, recall, views } from '../core/state.js';
import { artSvg } from './art.js';
import { levelOf } from './bond.js';
import { showCard } from './card.js';
import { giftKind } from './catalog.js';
import { markDecor, shownDecor } from './decor.js';
import { localDay } from './growth.js';
import { openLetter } from './letter-card.js';
import { bubble, cheer } from './views.js';

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
const BOOKS = ['fish', 'bugs', 'flowers', 'treasures', 'trees', 'tracks', 'shoots'];
const THING = {
  fish: id => t(`catch.fish_${id}`),
  bugs: id => t(`catch.bug_${id}`),
  flowers: id => t(`garden.kind_${id}`),
  treasures: id => t(`treasure.${id}`),
  trees: id => t(`tree.${id}`),
  tracks: id => t(`track.${id}`),
  shoots: id => t(`shoot.${id}`),
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

// How the letter comes. `open(year)` opens its card (letter-card.js; setupLetters can give another).
let open = openLetter;
const readable = () => readableLetter(data.letters || [], new Date());

/** Whether there is a letter to read now: this season's, with its text. */
export const letterReadable = () => readable() !== null;

/** Opens the letter there is to read now, if any (the chip, the yard menu, the mailbox). */
export function openReadable() {
  const letter = readable();
  if (letter) open(letter.year);
}

/** A press on the mailbox (decor.js): true when it opened the letter, else a friend visits it. */
export function letterPress() {
  if (!letterReadable()) return false;
  openReadable();
  return true;
}

/** Shows the ways in as they are now: the chip while there is a letter to read, and an envelope on
 * the mailbox until it is opened. Also called when the card closes. */
export function syncLetter() {
  const letter = readable(),
    chip = $('letter-chip');
  if (chip) chip.hidden = !letter;
  markDecor('mailbox', letter && recall(`letter-opened-${letter.year}`) !== '1' ? 'letter' : null);
}

// The friend the backend kept it from says so: that it is in the mailbox when the yard has one, or
// in a bubble that opens it. A letter deleted meanwhile comes back without its text: nothing is said.
function deliver(letter) {
  const v = views.get(letter.friend);
  if (!letter.text || !v) return;
  if (shownDecor('mailbox')) bubble(v, pick(list('letter.mailbox_bubble')));
  else bubble(v, pick(list('letter.bubble')), 9000, () => open(letter.year));
}

// A letter's text is kept until January 7 (the New Year card reads it); after that only the answer
// stays. The backend clears it by the same date (pets/letters.rs clear_ended).
const ended = (letter, today) => !!letter.text && today > `${letter.year + 1}-01-07`;

/** An answer just sent: written from January 1 to 7, it is not "remembered" a minute later, so it
 * counts as brought back already. A failure only means the cheer may come, which is harmless. */
export function answered(year, now = new Date()) {
  if (letterTime(now) !== 'back' || year !== letterYear(now)) return Promise.resolve();
  return call('letterBack', year)
    .then(() => {
      data.letters = (data.letters || []).map(kept => (kept.year === year ? { ...kept, back: true } : kept));
    })
    .catch(() => {});
}

/** Starts the letter, called by app.js before the sky; wires the chip. `visible()` says whether the
 * yard is seen: nothing is written, said or shown while it is not, so the friend's AI is asked only
 * then. Returns `check()`, for each repaint of the scene: the first only shows the ways in, the
 * next writes this year's letter once, from December 26, or from January 1 to 7 brings its answer
 * back once. Each asks the backend to clear a letter's text once its season is over. `card` shows
 * the New Year card (card.js). */
export function setupLetters({ open: opener = openLetter, visible = () => !document.hidden, card = showCard } = {}) {
  open = opener;
  let armed = false,
    busy = false;
  // Years whose answer was brought back this run. Kept until the app closes even when the card gave
  // way in the card queue (it comes again at the next start, as nothing was saved); let go once when
  // saving that it showed failed, so a later check tries again, but not every minute.
  const bringing = new Set(),
    retried = new Set();
  // The friend who wrote (or the closest, if it left) cheers and quotes the answer, from the string
  // tables only: no AI, so the New Year never turns into a question about whether a plan was done.
  // It counts as brought back once the card has shown in a yard that is seen.
  function bringBack(letters, now) {
    const year = letterYear(now),
      letter = letters.find(kept => kept.year === year && kept.answer && !kept.back);
    if (!letter || bringing.has(year)) return;
    const bringer = bringerOf(letter, data.pets, data.bonds || {});
    if (!bringer) return;
    bringing.add(year);
    card(
      artSvg(giftKind('mailbox').art, 'class="decor-art letter-back"'),
      t('letter.back_title', { name: name(bringer) }),
      t('letter.back_quote', { answer: letter.answer }),
      // The cheer has a line of its own, so the quote can be shortened without it (play.css).
      t('letter.back_cheer'),
      null,
      // The cheer comes with the card, which may wait its turn behind another (the New Year's own).
      () => {
        if (!visible()) return;
        call('letterBack', year)
          .then(() => {
            data.letters = (data.letters || []).map(kept => (kept.year === year ? { ...kept, back: true } : kept));
          })
          .catch(() => {
            if (retried.has(year)) return;
            retried.add(year);
            bringing.delete(year);
          });
        const v = views.get(bringer.id);
        if (v) cheer(v, 'letter.back_bubble', { say: 4000 });
      },
    );
  }
  const chip = $('letter-chip');
  if (chip) chip.onclick = openReadable;
  return function check() {
    const first = !armed;
    armed = true;
    if (busy) return;
    const now = new Date(),
      year = now.getFullYear(),
      letters = data.letters || [];
    // Asked only while there is text to clear, seen or not: nothing shows of it.
    if (letters.some(letter => ended(letter, localDay(now)))) {
      // Its season is over already: the ways in go at once.
      syncLetter();
      busy = true;
      call('clearLetters', localDay(now))
        .then(kept => {
          data.letters = kept;
          syncLetter();
        })
        // Refused or failed: a later check asks again.
        .catch(() => {})
        .finally(() => {
          busy = false;
        });
      return;
    }
    if (!visible()) return;
    syncLetter();
    if (first) return;
    const time = letterTime(now);
    if (time === 'back') {
      bringBack(letters, now);
      return;
    }
    // A year whose letter was deleted keeps its record, so it is not written again.
    if (time !== 'write' || letters.some(letter => letter.year === year)) return;
    const writer = writerOf(data.pets, data.bonds || {});
    if (!writer) return;
    const id = writer.id,
      facts = letterFacts({
        album: data.album,
        trees: data.garden?.trees || [],
        bond: data.bonds?.[id],
        level: levelOf(id),
        year,
        today: localDay(now),
      }),
      lines = factLines(facts),
      lastAnswer = letters.find(letter => letter.year === year - 1)?.answer;
    busy = true;
    call('writeLetter', year, id, lines, composeLetter(lines, lastAnswer))
      .then(letter => {
        // Kept at once, so the next check does not ask again; the backend's change event follows.
        if (!(data.letters || []).some(kept => kept.year === letter.year))
          data.letters = [...(data.letters || []), letter];
        // A window hidden while it was written: the chip, the menu row and the mailbox still lead
        // to it, but nobody says it to an empty room.
        syncLetter();
        if (visible()) deliver(letter);
      })
      // Still being written, a connection being saved, or another passing reason: a later check
      // asks again, with nothing on screen. A friend that could not say it changes nothing kept.
      .catch(() => {})
      .finally(() => {
        busy = false;
      });
  };
}
