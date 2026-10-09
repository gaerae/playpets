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
const caughtLine = (entry, size) =>
  size && entry.best
    ? `${t('catch.count', { count: entry.count })} · ${t('catch.best', { size: entry.best.toFixed(1) })}`
    : t('catch.count', { count: entry.count });

// Each book: its kinds, what has been found, and how a card draws and describes a kind.
const BOOKS = {
  flower: {
    kinds: FLOWERS,
    found: () => data.album?.flowers || {},
    draw: (k, unknown) => flowerSvg(k.id, unknown),
    name: k => t(`garden.kind_${k.id}`),
    hint: k => t('catch.flower_hint', { season: t(`catch.season_${k.season}`) }),
    record: entry => t('catch.grown', { count: entry.count }),
  },
  fish: {
    kinds: FISH,
    found: () => data.album?.fish || {},
    draw: (k, unknown) => fishSvg(k.look, unknown),
    name: k => t(`catch.fish_${k.id}`),
    hint: k => when(k, 'catch.where_lake'),
    record: entry => caughtLine(entry, true),
  },
  bug: {
    kinds: BUGS,
    found: () => data.album?.bugs || {},
    draw: (k, unknown) => bugSvg(k, unknown),
    name: k => t(`catch.bug_${k.id}`),
    hint: k => when(k, 'catch.where_air'),
    record: entry => caughtLine(entry, false),
  },
  gift: {
    kinds: GIFTS,
    // The garden keeps which gifts have come; each counts once.
    found: () => Object.fromEntries((data.garden?.received || []).map(id => [id, { count: 1 }])),
    draw: (k, unknown) => giftSvg(k, unknown),
    name: k => t(`decor.kind_${k.id}`),
    hint: () => t('catch.gift_hint'),
    record: () => t('catch.received'),
  },
};
let book = 'flower';

function card(b, kind, entry) {
  const el = document.createElement('div');
  el.className = `album-card${entry ? '' : ' unknown'}`;
  el.innerHTML = b.draw(kind, !entry);
  const name = document.createElement('strong'),
    hint = document.createElement('small');
  name.textContent = entry ? b.name(kind) : t('catch.unknown');
  hint.textContent = b.hint(kind);
  el.append(name, hint);
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
export function openAlbum() {
  $('album-dialog').showModal();
  renderAlbum();
}
/** Wires the album's button, tabs and dialog. Called once, by app.js. */
export function setupAlbum() {
  $('album-button').onclick = openAlbum;
  $('close-album').onclick = () => $('album-dialog').close();
  closeOnBackdrop($('album-dialog'));
  for (const tab of document.querySelectorAll('.album-tabs [data-book]'))
    tab.onclick = () => {
      book = tab.dataset.book;
      renderAlbum();
    };
}
