// How a kind in the album is found, as painted pictures rather than a sentence, in up to three rows
// that never share a line, each under its word on a tag: how (steps joined by arrows: dig, plant, the
// hours it takes), when (what has to be so: a flower's season, a fish's seasons and times of day, a
// bug's clear weather), and more often (what makes a tree, a keepsake or a fish likelier). Every
// clue is a picture with one word under it, since a picture alone is a guess (summer's sunflower
// could be the flower itself); a tool's word is its button's name, and a place is its thumbnail from
// the place picker. The rows are one picture to a screen reader, which reads the whole sentence
// (album.js).
import { clue } from '../core/dom.js';
import { language, t } from '../core/i18n.js';
import { LIMITS } from '../core/limits.js';
import { isSeason, systemSouth } from '../core/season.js';
import { artSvg } from '../yard/art.js';
import { backgroundPreview } from '../yard/background-ui.js';
import { eventGifts, giftKind, STAGES } from '../yard/catalog.js';
import { eventArt, eventDates, giftSeason } from '../yard/events.js';
import { worldFor } from '../yard/worlds.js';

/** `ms` as the language writes a short span of time ("4 hr" in English, "4 時間" in Japanese). */
export function duration(ms) {
  const hours = ms / 3_600_000,
    [value, unit] =
      hours >= 24 && Number.isInteger(hours / 24)
        ? [hours / 24, 'day']
        : Number.isInteger(hours)
          ? [hours, 'hour']
          : [Math.round(ms / 60_000), 'minute'];
  return new Intl.NumberFormat(language(), { style: 'unit', unit, unitDisplay: 'short' }).format(value);
}
// A tool by the name of its button on the strip (discovery.js, garden.js).
const TOOL_WORDS = {
  dig: 'discovery.dig',
  seeds: 'garden.plant',
  tree: 'discovery.tree',
  fish: 'catch.action',
  play: 'controls.play',
};
const tool = icon => ({ icon, text: t(TOOL_WORDS[icon]) });
const hours = ms => ({ icon: 'hourglass', text: duration(ms) });
const season = s => ({ icon: s, text: t(`catch.season_${s}`), group: 'season' });
const weather = w => ({ icon: w, text: t(`weather.${w}`), group: 'weather' });
const place = p => ({ image: backgroundPreview(worldFor(p)), text: t(`world.${p}`), group: 'place' });
const seasonsOf = kind => (kind.seasons.length === 4 ? [] : kind.seasons.map(season));
const periodsOf = kind =>
  kind.periods.length === 4 ? [] : kind.periods.map(p => ({ icon: p, text: t(`period.${p}`), group: 'period' }));
// An event by its own drawing (or its first gift's, as its notice shows it) and name, then its dates.
const event = id => {
  const art = eventArt(id) || giftKind(eventGifts(id)[0])?.art;
  return { ...(art ? { svg: artSvg(art) } : { icon: 'calendar' }), text: t(`event.${id}.name`) };
};
const dates = id => ({ icon: 'calendar', text: eventDates(id, systemSouth()) });
// What makes a tree or a keepsake likelier: its seasons, weather and places.
const likesOf = kind => [
  ...(kind.affinity?.seasons || []).filter(isSeason).map(season),
  ...(kind.affinity?.weather || []).map(weather),
  ...(kind.affinity?.places || []).map(place),
];

/** The pictures that say how `kind` of album `book` is found: `how`, `when` and `likely` rows of
 * clues ({ icon or image, text, group }); null where words say it better (a snowman's
 * making). */
export function clues(book, kind) {
  const rows = (how, when = [], likely = []) => ({ how, when, likely });
  // One built (the snowman) is made, not found: its sentence says how.
  if (kind.built) return null;
  // Only at an event: the event and its dates, then a fish's or a bug's own times as any other's; a
  // gift of an event not fixed to the calendar, while the yard shows that event's season. The scene
  // that calls an event up by hand stays in the sentence: a row of it repeats the same seasons and
  // times with another meaning.
  if (kind.event) {
    const at = [event(kind.event), dates(kind.event)],
      shown = giftSeason(kind.event);
    if (book === 'fish') return rows([tool('fish')], [...at, ...seasonsOf(kind), ...periodsOf(kind)]);
    if (book === 'bug') return rows([], [...at, ...seasonsOf(kind), ...periodsOf(kind), weather('clear')]);
    return book === 'gift' ? rows([], [...at, ...(shown ? [season(shown)] : [])]) : null;
  }
  if (book === 'flower') return rows([tool('dig'), tool('seeds'), hours(STAGES.at(-1)?.at)], [season(kind.season)]);
  if (book === 'tree') return rows([tool('dig'), tool('tree'), hours(LIMITS.treeMatureMs)], [], likesOf(kind));
  if (book === 'treasure') return rows([tool('dig')], [], likesOf(kind));
  if (book === 'fish')
    return rows([tool('fish')], [...seasonsOf(kind), ...periodsOf(kind)], kind.rain > 1 ? [weather('rain')] : []);
  if (book === 'bug') return rows([], [...seasonsOf(kind), ...periodsOf(kind), weather('clear')]);
  // A friend played with brings one every few days (garden.rs); one built is made, not brought.
  if (book === 'gift')
    return rows([tool('play'), hours(LIMITS.giftEveryDays * 86_400_000), { icon: 'gift', text: t('album.clue_gift') }]);
  return null;
}

// Steps one after another, an arrow of its own between each two.
function steps(items) {
  return items.flatMap((item, i) => {
    if (!i) return [clue(item)];
    const arrow = document.createElement('i');
    arrow.className = 'clue-arrow';
    return [arrow, clue(item)];
  });
}
// Clues of one kind side by side (a fish's seasons, its times of day) in one unbreakable group, so a
// long row wraps between kinds and never inside one; a kind with one clue is that clue.
function grouped(items) {
  const out = [];
  for (const item of items) {
    const last = out.at(-1);
    if (item.group && last?.group === item.group) last.items.push(item);
    else out.push({ group: item.group, items: [item] });
  }
  return out.map(({ group, items }) => {
    if (items.length === 1) return clue(items[0]);
    const el = document.createElement('span');
    el.className = 'clue-group';
    el.dataset.group = group;
    el.append(...items.map(clue));
    return el;
  });
}
const ROW_WORDS = { how: 'album.clue_how', when: 'album.clue_when', likely: 'album.clue_likely' };
/** The rows for `row` (clues), one picture to a screen reader that says `sentence`. */
export function clueRow(row, sentence) {
  const el = document.createElement('div');
  el.className = 'album-clues';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', sentence);
  el.title = sentence;
  for (const name of ['how', 'when', 'likely']) {
    if (!row[name].length) continue;
    const line = document.createElement('div');
    line.className = 'clue-row';
    line.dataset.row = name;
    // Every row the same shape at every size: its word on a tag above, then its clues.
    const label = document.createElement('span'),
      items = document.createElement('div');
    label.className = 'clue-label';
    label.textContent = t(ROW_WORDS[name]);
    items.className = 'clue-items';
    items.append(...(name === 'how' ? steps(row.how) : grouped(row[name])));
    line.append(label, items);
    el.append(line);
  }
  return el;
}
