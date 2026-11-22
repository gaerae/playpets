// The album: everything that grows, comes and is caught in the yard. Flowers grown
// from seeds (counted by the backend when they bloom), fish and bugs caught, gifts friends brought,
// keepsakes dug up and spring shoots gathered.
// The ones found show how many (and the biggest fish); the others are silhouettes with when and
// where to look, so there is always a next one. What there is to find is the catalogue's.
import { closeOnBackdrop } from '../core/confirm.js';
import { joinList, joinSentences, language, t } from '../core/i18n.js';
import { limit } from '../core/limits.js';
import { systemSouth } from '../core/season.js';
import { $, call, data, name } from '../core/state.js';
import { previewSvg } from '../yard/art.js';
import { albumSeen } from '../yard/card.js';
import {
  BUGS,
  FISH,
  FLOWERS,
  GIFTS,
  giftKind,
  grownArt,
  nameKey,
  SHOOTS,
  TRACKS,
  TREASURES,
  TREES,
} from '../yard/catalog.js';
import { bugSvg, fishSvg } from '../yard/creatures.js';
import { decorShown, yardSeason } from '../yard/decor-shown.js';
import { rareReadyAt } from '../yard/discovery-rewards.js';
import { eventDates, eventScene, giftSeason } from '../yard/events.js';
import { giftsOut } from '../yard/find-out.js';
import { treeSpot } from '../yard/planted-trees.js';
import { SECRETS } from '../yard/secrets.js';
import { printSpecimen, SEEN_WHOLE, tailPeek, wholeAnimal } from '../yard/trail-art.js';
import { scene } from '../yard/world.js';
import { worldFor, worldHasSoil } from '../yard/worlds.js';
import { findButtons, landing, restoreRowFocus, rowFocus, setOutRow } from './album-actions.js';

// When and where a fish or a bug is found: "Summer, Evening, Night, at the lake".
function when(kind, where) {
  const seasons =
      kind.seasons.length === 4 ? t('catch.all_year') : joinList(kind.seasons.map(s => t(`catch.season_${s}`))),
    periods = kind.periods.length === 4 ? t('catch.any_time') : joinList(kind.periods.map(p => t(`period.${p}`)));
  return joinList([seasons, periods, t(where)]);
}
// A kind that comes only during a seasonal event says when, by the dates of the system's hemisphere;
// a fish or a bug also by the scene that calls the event up by hand. A gift keeps to the dates, and
// one of an event not fixed to the calendar also to the yard showing that event's season.
const eventHint = k => {
  const season = giftSeason(k.event),
    event = t(`event.${k.event}.name`),
    dates = eventDates(k.event, systemSouth());
  return season
    ? t('catch.event_season_hint', { event, dates, season: t(`catch.season_${season}`) })
    : t('catch.event_hint', { event, dates });
};
const eventSceneHint = k =>
  t('catch.event_scene_hint', {
    event: t(`event.${k.event}.name`),
    dates: eventDates(k.event, systemSouth()),
    scene: eventScene(k.event),
  });
// What comes only on certain dates is rare, whatever its weight.
const rare = k => k.rarity === 'rare' || !!k.event;
// A tree or a keepsake: how it is found (`how`), then what makes it likelier, each on its own.
const favored = how => kind => {
  const conditions = [
    ...(kind.affinity?.seasons || []).map(value => t(`catch.season_${value}`)),
    ...(kind.affinity?.weather || []).map(value => t(`weather.${value}`)),
    ...(kind.affinity?.places || []).map(value => t(`world.${value}`)),
  ];
  return joinSentences([
    t(how),
    ...(conditions.length ? [t('album.favored', { conditions: joinList(conditions) })] : []),
  ]);
};
// A card draws its kind from a small preview (src/art/album/), not from the painted sheet the yard
// uses: decoding a book's 1536 x 1024 sheets for 112-pixel cards held up its first open.
const specimen = (art, unknown) => previewSvg(art, unknown ? 'class="unknown-art"' : '');
const caughtLine = (entry, size) =>
  size && entry.best
    ? joinList([t('catch.count', { count: entry.count }), t('catch.best', { size: entry.best.toFixed(1) })])
    : t('catch.count', { count: entry.count });

// Each book: its tab's name, its kinds (the catalogue's `list`, whose kinds are named by
// catalog.js NAME_KEYS unless it has its own `name`), what has been found, and how a card draws and
// describes a kind (`unknown`: what a card not found yet says, when not "not met yet"). A kind
// added to the catalogue shows up in its book; a new book is one more entry here (its tab is made
// from it) and one in NAME_KEYS. A `hidden` book shows only what has been found, is not there at all before that, and
// stays out of the album's count; `note` is what its status line says.
const BOOKS = {
  flower: {
    tab: 'catch.tab_flowers',
    kinds: FLOWERS,
    list: 'flowers',
    found: () => data.album?.flowers || {},
    draw: (k, unknown) => specimen(k.art, unknown),
    unknown: 'catch.unknown_flower',
    hint: k => t('catch.flower_hint', { season: t(`catch.season_${k.season}`) }),
    record: entry => t('catch.grown', { count: entry.count }),
    action: (k, entry) => growingButtons('flower', k.id, entry),
  },
  fish: {
    tab: 'catch.tab_fish',
    kinds: FISH,
    list: 'fish',
    found: () => data.album?.fish || {},
    draw: (k, unknown) => (k.art ? specimen(k.art, unknown) : fishSvg(k, unknown)),
    hint: k =>
      joinList([
        ...(k.event ? [eventSceneHint(k)] : []),
        when(k, 'catch.where_lake'),
        ...(k.rain > 1 ? [t('catch.rain_hint')] : []),
      ]),
    record: entry => caughtLine(entry, true),
    rare,
    action: (k, entry) => findButtons('fish', k.id, entry),
  },
  bug: {
    tab: 'catch.tab_bugs',
    kinds: BUGS,
    list: 'bugs',
    found: () => data.album?.bugs || {},
    draw: (k, unknown) => (k.art ? specimen(k.art, unknown) : bugSvg(k, unknown)),
    hint: k =>
      joinList([
        ...(k.event ? [eventSceneHint(k)] : []),
        when(k, ['beetle', 'cricket'].includes(k.kind) ? 'catch.where_ground' : 'catch.where_air'),
        t('catch.bug_clear'),
      ]),
    record: entry => caughtLine(entry, false),
    rare,
    action: (k, entry) => findButtons('bug', k.id, entry),
  },
  gift: {
    tab: 'catch.tab_gifts',
    kinds: GIFTS,
    list: 'gifts',
    // The garden keeps which gifts have come; each counts once.
    found: () => Object.fromEntries((data.garden?.received || []).map(id => [id, { count: 1 }])),
    draw: (k, unknown) => specimen(k.art, unknown),
    unknown: 'catch.unknown_gift',
    hint: k => (k.event ? eventHint(k) : t(k.built ? 'catch.built_hint' : 'catch.gift_hint')),
    record: () => t('catch.received'),
    rare,
    mark: k => mementoHeart(k.id),
    action: k => takeOutButton(k.id),
  },
  tree: {
    tab: 'album.trees',
    kinds: TREES,
    list: 'trees',
    found: () => data.album?.trees || {},
    draw: (k, unknown) => specimen(grownArt(k), unknown),
    hint: favored('album.tree_how'),
    record: entry => t('catch.trees_grown', { count: entry.count }),
    action: (k, entry) => growingButtons('tree', k.id, entry),
  },
  treasure: {
    tab: 'album.treasures',
    kinds: TREASURES,
    list: 'treasures',
    found: () => data.album?.treasures || {},
    draw: (k, unknown) => specimen(k.art, unknown),
    hint: favored('album.treasure_how'),
    record: entry => caughtLine(entry, false),
    rare: k => k.rarity === 'uncommon',
    action: (k, entry) => findButtons('treasure', k.id, entry),
  },
  // Winter animals whose prints a friend followed: the print is the clue, the tail what was seen,
  // and, followed often enough, the animal itself, which turned to look.
  track: {
    tab: 'album.tracks',
    kinds: TRACKS,
    list: 'tracks',
    found: () => data.album?.tracks || {},
    draw: (k, unknown, entry) =>
      unknown ? printSpecimen(k) : entry.count >= SEEN_WHOLE ? wholeAnimal(k) : tailPeek(k),
    unknown: 'album.whose_prints',
    hint: () => t('album.tracks_hint'),
    record: ({ count }) =>
      count >= SEEN_WHOLE
        ? t('album.followed_met', { count })
        : t('album.followed_closer', { count, left: SEEN_WHOLE - count }),
    // Seen whole, it comes out of its card once, to the yard and the desktop (find-out.js copiesOf).
    action: (k, entry) => findButtons('track', k.id, entry),
  },
  // Spring shoots a friend gathered: shown always, as silhouettes first; the hint says the season.
  shoot: {
    tab: 'album.shoots',
    kinds: SHOOTS,
    list: 'shoots',
    found: () => data.album?.shoots || {},
    draw: (k, unknown) => specimen(k.art, unknown),
    hint: k => t('shoot.hint', { season: t(`catch.season_${k.season}`) }),
    record: entry => t('shoot.count', { count: entry.count }),
  },
  secret: {
    tab: 'album.secrets',
    kinds: SECRETS,
    found: () => data.album?.secrets || {},
    draw: k => k.svg,
    name: k => t(`secret.${k.id}`),
    hint: k => t(`secret.${k.id}_note`),
    record: entry =>
      t('album.secret_found', {
        date: new Date(entry.first).toLocaleDateString(language(), { year: 'numeric', month: 'long', day: 'numeric' }),
      }),
    hidden: true,
    note: () => t('album.secret_more'),
  },
};
let book = 'flower';
let rareTimer;
/** The line under a found entry in a book: what was done with it (caught, grown, received). */
export const recordLine = (id, entry) => BOOKS[id].record(entry);

function card(b, kind, entry, index) {
  const el = document.createElement('div');
  el.className = `album-card${entry ? '' : ' unknown'}`;
  const stage = document.createElement('div');
  stage.className = 'album-specimen';
  stage.innerHTML = b.draw(kind, !entry, entry);
  // Its place in the book, as on a collector's page: the gaps between numbers are what is left.
  const number = document.createElement('span');
  number.className = 'album-no';
  number.setAttribute('aria-hidden', 'true');
  number.textContent = String(index + 1).padStart(2, '0');
  stage.append(number);
  el.append(stage);
  const name = document.createElement('strong'),
    hint = document.createElement('small');
  name.textContent = entry ? (b.name ? b.name(kind) : t(nameKey(b.list, kind.id))) : t(b.unknown || 'catch.unknown');
  hint.className = 'album-hint';
  hint.textContent = b.hint(kind);
  el.append(name, hint);
  // A kind that comes seldom, or only on certain dates, says so, found or not, so it is worth waiting for.
  if (b.rare?.(kind)) {
    const rare = document.createElement('span');
    rare.className = 'album-rare';
    rare.textContent = t('catch.rare');
    el.append(rare);
    el.classList.add('rare');
  }
  if (entry) {
    const mark = b.mark?.(kind);
    if (mark) stage.append(mark);
    const record = document.createElement('small');
    record.className = 'album-record';
    record.textContent = b.record(entry);
    el.append(record);
    const action = b.action?.(kind, entry);
    if (action) el.append(action);
  }
  return el;
}
// Set out while out of sight (decor-shown.js), a gift would vanish into the yard: it waits, and says
// when it shows: a Christmas gift its dates, a snowman winter.
const showsNow = kind => decorShown(kind, new Date(), yardSeason(scene));
const whenShown = kind => t(giftKind(kind)?.shown ? 'album.shown_christmas' : 'album.shown_winter');
// A friend's memento wears its giver's heart on its card, in the yard or waiting in the box, as it
// does in the yard (garden.css .decor.memento).
function mementoHeart(kind) {
  const garden = data.garden || {},
    memento = [...(garden.decor || []), ...(garden.boxed || [])].find(d => d.kind === kind && d.memento);
  if (!memento) return null;
  const from = data.pets.find(p => p.id === memento.from),
    heart = document.createElement('span');
  heart.className = 'album-heart';
  heart.setAttribute('role', 'img');
  heart.title = from ? t('album.memento', { name: name(from) }) : t('album.memento_plain');
  heart.setAttribute('aria-label', heart.title);
  heart.textContent = '♥';
  return heart;
}
// A gift that came before can always come back out of its card (garden.rs take_out), and back in.
// One waiting in the box (it came while the yard was full, or a memento put away) is that same gift:
// its card sets it out. Set out while out of sight, it waits and says when it shows. A snowman is
// built in the snow, never set out: its card only says when one stands in the yard.
function takeOutButton(kind) {
  const garden = data.garden || {};
  const out = (garden.decor || []).some(d => d.kind === kind);
  if (giftKind(kind)?.built) {
    if (!out) return null;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'album-take-out';
    button.textContent = button.title = t('album.in_yard');
    button.disabled = true;
    button.setAttribute('aria-label', button.title);
    return button;
  }
  const room = limit(data, 'decor'),
    unseen = showsNow(kind) ? '' : whenShown(kind),
    why = unseen || (giftsOut(garden.decor).length >= room ? t('album.set_out_full') : '');
  return setOutRow({
    book: 'gift',
    item: kind,
    name: t(`decor.kind_${kind}`),
    most: 1,
    room,
    why,
    unseen,
    setOut: desktop => call('takeOut', kind, ...landing(), desktop),
  });
}
// A flower or a tree the album has comes out again, grown and free, as often as there is room
// (garden.rs take_out_flower, discovery.rs take_out_tree): into the yard, or into the yard and out
// on the desktop. A flower goes near the front of the field, as a gift does; a tree onto free soil
// of the place shown. Design: docs/design/2026-11-19-album-take-out.md.
function growingButtons(book, kind, entry) {
  const garden = data.garden || {},
    tree = book === 'tree',
    room = limit(data, tree ? 'trees' : 'plants'),
    full = ((tree ? garden.trees : garden.plants)?.length ?? 0) >= room,
    why =
      tree && !worldHasSoil(scene.world)
        ? t('album.tree_soil')
        : full
          ? t(tree ? 'album.trees_full' : 'album.flowers_full', { limit: room })
          : '';
  return setOutRow({
    book,
    item: kind,
    name: t(nameKey(tree ? 'trees' : 'flowers', kind)),
    most: entry?.count ?? 1,
    room,
    why,
    setOut: desktop => takeOutGrowing(tree, kind, desktop),
  });
}
function takeOutGrowing(tree, kind, desktop) {
  if (!tree) return call('takeOutFlower', kind, ...landing(), desktop);
  const spot = treeSpot();
  if (!spot) return Promise.reject(Object.assign(new Error(t('album.tree_no_room')), { spoken: true }));
  return call('takeOutTree', scene.world, kind, spot.point.x, spot.point.y, spot.ground, desktop);
}
/** Brings the album in line with what has been found (only while it is open). */
export function renderAlbum() {
  clearTimeout(rareTimer);
  if (!$('album-dialog').open) return;
  if (!shown(book)) book = 'flower';
  const now = Date.now(),
    readyAt = rareReadyAt(data.garden?.digs, TREASURES, now),
    capabilities = worldFor(scene.world).capabilities,
    soil = capabilities?.soil ?? capabilities?.sky !== false,
    digging = book === 'tree' || book === 'treasure';
  const status = $('album-dig-status');
  const giftBook = book === 'gift';
  status.hidden = !digging && !giftBook && !BOOKS[book].note;
  if (BOOKS[book].note) status.textContent = BOOKS[book].note();
  status.title = '';
  if (digging) {
    const conditions = joinList([
      t(`catch.season_${scene.season}`),
      t(`weather.${scene.weather}`),
      t(`world.${scene.world}`) === `world.${scene.world}` ? t('album.custom_place') : t(`world.${scene.world}`),
    ]);
    status.textContent = t('album.dig_context', { conditions });
    if (readyAt)
      status.textContent += ` ${t('album.rare_wait', { time: new Date(readyAt).toLocaleString(language(), { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) })}`;
    else status.textContent += ` ${t('album.rare_rule')}`;
    if (!soil) status.textContent = t('discovery.indoors');
    if (soil && readyAt) rareTimer = setTimeout(renderAlbum, readyAt - now + 1);
  }
  if (giftBook) {
    status.title = '';
    const yardFull = giftsOut(data.garden?.decor).length >= limit(data, 'decor');
    status.textContent = t(yardFull ? 'album.gift_full' : 'album.gift_rule');
  }
  let found = 0,
    total = 0;
  const share = {};
  for (const [id, b] of Object.entries(BOOKS)) {
    const have = b.found(),
      count = b.kinds.filter(k => have[k.id]).length,
      tally = document.querySelector(`[data-count="${id}"]`);
    if (b.hidden) {
      tally.textContent = String(count);
      continue;
    }
    found += count;
    total += b.kinds.length;
    share[id] = count / b.kinds.length;
    tally.textContent = `${count}/${b.kinds.length}`;
  }
  if ($('album-select')) listBooks($('album-select'));
  $('album-total').textContent = t('catch.total', { caught: found, total });
  $('album-total').style.setProperty('--album-found', found / total);
  for (const tab of document.querySelectorAll('.album-tabs [data-book]')) {
    const active = tab.dataset.book === book;
    tab.hidden = !shown(tab.dataset.book);
    // How full each book is, as a thin line under its name; a book with every kind found is marked.
    tab.style.setProperty('--album-found', share[tab.dataset.book] ?? 0);
    tab.classList.toggle('complete', share[tab.dataset.book] === 1);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active) $('album-grid').setAttribute('aria-labelledby', tab.id);
  }
  const b = BOOKS[book],
    have = b.found();
  // Each book has its own ground under the drawings: water for fish, wood for gifts (dialog.css).
  $('album-grid').dataset.book = book;
  // A press on a card redraws the book: the focus goes back to the control it was on.
  const was = rowFocus();
  keepUnchanged(
    $('album-grid'),
    b.kinds.filter(k => !b.hidden || have[k.id]).map((k, index) => card(b, k, have[k.id], index)),
  );
  restoreRowFocus($('album-grid'), was);
}
// Only the cards that changed take their new drawing: the rest of the book, and the pictures in it,
// stay as they are. Another book (another count of cards) is drawn whole. A kept card's buttons act
// on what is out when pressed (album-actions.js setOutRow), so keeping it changes nothing they do.
function keepUnchanged(grid, cards) {
  const old = [...grid.children];
  if (old.length !== cards.length) return grid.replaceChildren(...cards);
  cards.forEach((fresh, i) => {
    if (!old[i].isEqualNode(fresh)) old[i].replaceWith(fresh);
  });
}
// Whether a book is there to open: a hidden one once something in it is found.
const shown = id => {
  const b = BOOKS[id];
  return !!b && (!b.hidden || b.kinds.some(k => b.found()[k.id]));
};
// The compact chooser holds only the books there are to open: a select's popup may offer a hidden
// option all the same.
function listBooks(picker) {
  const ids = Object.keys(BOOKS).filter(shown);
  if (picker.dataset.books !== ids.join()) {
    picker.dataset.books = ids.join();
    picker.replaceChildren(
      ...ids.map(id => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = t(BOOKS[id].tab);
        return option;
      }),
    );
  }
  // Each option carries its book's count, once the tabs that keep it are there.
  for (const option of picker.options || []) {
    const tally = document.querySelector(`[data-count="${option.value}"]`)?.textContent;
    option.textContent = tally ? `${t(BOOKS[option.value].tab)} ${tally}` : t(BOOKS[option.value].tab);
  }
  picker.value = book;
}
/** Opens the album (the tools' button), at a given book when a card asks for it. */
export function openAlbum(open = null) {
  if (open && shown(open)) {
    book = open;
    if ($('album-select')) $('album-select').value = open;
  }
  $('album-dialog').showModal();
  renderAlbum();
  albumSeen();
}
/** Wires the album's button, tabs and dialog. Called once, by app.js. */
export function setupAlbum() {
  $('album-dialog').addEventListener('close', () => {
    clearTimeout(rareTimer);
    // The button it opened from went with the Play panel.
    if (document.activeElement === document.body)
      $(document.body.classList.contains('compact') ? 'yard' : 'play-button').focus();
  });
  const picker = $('album-select');
  if (picker) {
    listBooks(picker);
    picker.onchange = () => {
      if (!shown(picker.value)) return;
      book = picker.value;
      renderAlbum();
      $('album-grid').scrollTop = 0;
    };
  }
  $('album-tabs').replaceChildren(
    ...Object.entries(BOOKS).map(([id, b]) => {
      const tab = document.createElement('button'),
        name = document.createElement('span'),
        count = document.createElement('small');
      tab.type = 'button';
      tab.id = `album-tab-${id}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', 'album-grid');
      tab.dataset.book = id;
      const meter = document.createElement('i');
      name.textContent = t(b.tab);
      count.dataset.count = id;
      meter.className = 'album-meter';
      meter.setAttribute('aria-hidden', 'true');
      // A hidden book counts only what is found, so it has no line to fill.
      tab.append(name, count, ...(b.hidden ? [] : [meter]));
      return tab;
    }),
  );
  $('album-button').onclick = () => openAlbum();
  $('close-album').onclick = () => $('album-dialog').close();
  closeOnBackdrop($('album-dialog'));
  const tabs = [...document.querySelectorAll('.album-tabs [data-book]')];
  for (const tab of tabs) {
    tab.onclick = () => {
      book = tab.dataset.book;
      renderAlbum();
      $('album-grid').scrollTop = 0;
    };
    tab.onkeydown = e => {
      // Among the tabs there are: a hidden book's appears only once something in it is found.
      const open = tabs.filter(other => !other.hidden),
        index = open.indexOf(tab),
        next = {
          ArrowRight: (index + 1) % open.length,
          ArrowLeft: (index + open.length - 1) % open.length,
          Home: 0,
          End: open.length - 1,
        }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      open[next].onclick();
      open[next].focus();
    };
  }
}
