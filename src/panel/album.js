// The album: everything that grows, comes and is caught in the yard, in four books. Flowers grown
// from seeds (counted by the backend when they bloom), fish and bugs caught, gifts friends brought.
// The ones found show how many (and the biggest fish); the others are silhouettes with when and
// where to look, so there is always a next one. What there is to find is the catalogue's.
import { closeOnBackdrop } from '../core/confirm.js';
import { t } from '../core/i18n.js';
import { $, data } from '../core/state.js';
import { BUGS, FISH, FLOWERS, GIFTS } from '../yard/catalog.js';
import { bugSvg, fishSvg, flowerSvg, giftSvg } from '../yard/creatures.js';

// When and where a fish or a bug is found: "Summer · Evening·Night · at the lake".
function when(kind, where) {
  const seasons =
      kind.seasons.length === 4 ? t('catch.all_year') : kind.seasons.map(s => t(`catch.season_${s}`)).join('·'),
    periods = kind.periods.length === 4 ? t('catch.any_time') : kind.periods.map(p => t(`period.${p}`)).join('·');
  return `${seasons} · ${periods} · ${t(where)}`;
}
// A kind that comes only during a seasonal event says when.
const eventHint = k => t('catch.event_hint', { event: t(`event.${k.event}.name`) });
const caughtLine = (entry, size) =>
  size && entry.best
    ? `${t('catch.count', { count: entry.count })} · ${t('catch.best', { size: entry.best.toFixed(1) })}`
    : t('catch.count', { count: entry.count });

// Each book: its tab's name, its kinds (the catalogue's), what has been found, and how a card draws
// and describes a kind (`unknown`: what a card not found yet says, when not "not met yet"). A kind
// added to the catalogue shows up in its book; a new book is one more entry here (its tab is made
// from it).
const BOOKS = {
  flower: {
    tab: 'catch.tab_flowers',
    kinds: FLOWERS,
    found: () => data.album?.flowers || {},
    draw: (k, unknown) => flowerSvg(k.id, unknown),
    name: k => t(`garden.kind_${k.id}`),
    unknown: 'catch.unknown_flower',
    hint: k => t('catch.flower_hint', { season: t(`catch.season_${k.season}`) }),
    record: entry => t('catch.grown', { count: entry.count }),
  },
  fish: {
    tab: 'catch.tab_fish',
    kinds: FISH,
    found: () => data.album?.fish || {},
    draw: (k, unknown) => fishSvg(k, unknown),
    name: k => t(`catch.fish_${k.id}`),
    hint: k => (k.event ? `${eventHint(k)} · ${when(k, 'catch.where_lake')}` : when(k, 'catch.where_lake')),
    record: entry => caughtLine(entry, true),
  },
  bug: {
    tab: 'catch.tab_bugs',
    kinds: BUGS,
    found: () => data.album?.bugs || {},
    draw: (k, unknown) => bugSvg(k, unknown),
    name: k => t(`catch.bug_${k.id}`),
    hint: k => (k.event ? `${eventHint(k)} · ${when(k, 'catch.where_air')}` : when(k, 'catch.where_air')),
    record: entry => caughtLine(entry, false),
  },
  gift: {
    tab: 'catch.tab_gifts',
    kinds: GIFTS,
    // The garden keeps which gifts have come; each counts once.
    found: () => Object.fromEntries((data.garden?.received || []).map(id => [id, { count: 1 }])),
    draw: (k, unknown) => giftSvg(k, unknown),
    name: k => t(`decor.kind_${k.id}`),
    unknown: 'catch.unknown_gift',
    hint: k => (k.event ? eventHint(k) : t('catch.gift_hint')),
    record: () => t('catch.received'),
  },
};
let book = 'flower';
// A kind this seldom (its weight among those that come at the same time, catalog.json) is rare.
const RARE = 4;

function card(b, kind, entry) {
  const el = document.createElement('div');
  el.className = `album-card${entry ? '' : ' unknown'}`;
  el.innerHTML = b.draw(kind, !entry);
  const name = document.createElement('strong'),
    hint = document.createElement('small');
  name.textContent = entry ? b.name(kind) : t(b.unknown || 'catch.unknown');
  hint.textContent = b.hint(kind);
  el.append(name, hint);
  // A fish or a bug that comes seldom says so, found or not, so it is worth waiting for.
  if (kind.weight <= RARE) {
    const rare = document.createElement('span');
    rare.className = 'album-rare';
    rare.textContent = t('catch.rare');
    el.append(rare);
  }
  if (entry) {
    const record = document.createElement('small');
    record.textContent = b.record(entry);
    el.append(record);
  }
  return el;
}
/** Brings the album in line with what has been found (only while it is open). */
export function renderAlbum() {
  if (!$('album-dialog').open) return;
  let found = 0,
    total = 0;
  for (const [id, b] of Object.entries(BOOKS)) {
    const have = b.found(),
      count = b.kinds.filter(k => have[k.id]).length;
    found += count;
    total += b.kinds.length;
    document.querySelector(`[data-count="${id}"]`).textContent = `${count}/${b.kinds.length}`;
  }
  $('album-total').textContent = t('catch.total', { caught: found, total });
  for (const tab of document.querySelectorAll('.album-tabs [data-book]'))
    tab.setAttribute('aria-selected', String(tab.dataset.book === book));
  const b = BOOKS[book],
    have = b.found();
  $('album-grid').replaceChildren(...b.kinds.map(k => card(b, k, have[k.id])));
}
/** Opens the album (the tools' button). */
function openAlbum() {
  $('album-dialog').showModal();
  renderAlbum();
}
/** Wires the album's button, tabs and dialog. Called once, by app.js. */
export function setupAlbum() {
  $('album-tabs').replaceChildren(
    ...Object.entries(BOOKS).map(([id, b]) => {
      const tab = document.createElement('button'),
        name = document.createElement('span'),
        count = document.createElement('small');
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', 'album-grid');
      tab.dataset.book = id;
      name.textContent = t(b.tab);
      count.dataset.count = id;
      tab.append(name, count);
      return tab;
    }),
  );
  $('album-button').onclick = openAlbum;
  $('close-album').onclick = () => $('album-dialog').close();
  closeOnBackdrop($('album-dialog'));
  for (const tab of document.querySelectorAll('.album-tabs [data-book]'))
    tab.onclick = () => {
      book = tab.dataset.book;
      renderAlbum();
    };
}
