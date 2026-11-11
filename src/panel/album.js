// The album: everything that grows, comes and is caught in the yard. Flowers grown
// from seeds (counted by the backend when they bloom), fish and bugs caught, gifts friends brought,
// keepsakes dug up and spring shoots gathered.
// The ones found show how many (and the biggest fish); the others are silhouettes with when and
// where to look, so there is always a next one. What there is to find is the catalogue's.
import { closeOnBackdrop } from '../core/confirm.js';
import { joinList, language, t } from '../core/i18n.js';
import { limit } from '../core/limits.js';
import { systemSouth } from '../core/season.js';
import { $, call, data, toast } from '../core/state.js';
import { spoken } from '../core/text.js';
import { artSvg } from '../yard/art.js';
import { albumSeen } from '../yard/card.js';
import { BUGS, FISH, FLOWERS, GIFTS, giftKind, SHOOTS, TRACKS, TREASURES, TREES } from '../yard/catalog.js';
import { bugSvg, fishSvg, flowerSvg, giftSvg } from '../yard/creatures.js';
import { decorShown, yardSeason } from '../yard/decor-shown.js';
import { rareReadyAt } from '../yard/discovery-rewards.js';
import { eventDates } from '../yard/events.js';
import { SECRETS } from '../yard/secrets.js';
import { printSpecimen, tailPeek } from '../yard/trail-art.js';
import { scene } from '../yard/world.js';
import { worldFor } from '../yard/worlds.js';

// When and where a fish or a bug is found: "Summer, Evening, Night, at the lake".
function when(kind, where) {
  const seasons =
      kind.seasons.length === 4 ? t('catch.all_year') : joinList(kind.seasons.map(s => t(`catch.season_${s}`))),
    periods = kind.periods.length === 4 ? t('catch.any_time') : joinList(kind.periods.map(p => t(`period.${p}`)));
  return joinList([seasons, periods, t(where)]);
}
// A kind that comes only during a seasonal event says when, by the dates of the system's hemisphere.
const eventHint = k =>
  t('catch.event_hint', {
    event: t(`event.${k.event}.name`),
    dates: eventDates(k.event, systemSouth()),
  });
// What comes only on certain dates is rare, whatever its weight.
const rare = k => k.rarity === 'rare' || !!k.event;
const favored = kind =>
  t('album.favored', {
    conditions: joinList([
      ...(kind.affinity?.seasons || []).map(value => t(`catch.season_${value}`)),
      ...(kind.affinity?.weather || []).map(value => t(`weather.${value}`)),
      ...(kind.affinity?.places || []).map(value => t(`world.${value}`)),
    ]),
  });
const caughtLine = (entry, size) =>
  size && entry.best
    ? joinList([t('catch.count', { count: entry.count }), t('catch.best', { size: entry.best.toFixed(1) })])
    : t('catch.count', { count: entry.count });

// Each book: its tab's name, its kinds (the catalogue's), what has been found, and how a card draws
// and describes a kind (`unknown`: what a card not found yet says, when not "not met yet"). A kind
// added to the catalogue shows up in its book; a new book is one more entry here (its tab is made
// from it). A `hidden` book shows only what has been found, is not there at all before that, and
// stays out of the album's count; `note` is what its status line says.
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
    hint: k =>
      joinList([
        ...(k.event ? [eventHint(k)] : []),
        when(k, 'catch.where_lake'),
        ...(k.rain > 1 ? [t('catch.rain_hint')] : []),
      ]),
    record: entry => caughtLine(entry, true),
    rare,
  },
  bug: {
    tab: 'catch.tab_bugs',
    kinds: BUGS,
    found: () => data.album?.bugs || {},
    draw: (k, unknown) => bugSvg(k, unknown),
    name: k => t(`catch.bug_${k.id}`),
    hint: k =>
      joinList([
        ...(k.event ? [eventHint(k)] : []),
        when(k, ['beetle', 'cricket'].includes(k.kind) ? 'catch.where_ground' : 'catch.where_air'),
        t('catch.bug_clear'),
      ]),
    record: entry => caughtLine(entry, false),
    rare,
  },
  gift: {
    tab: 'catch.tab_gifts',
    kinds: GIFTS,
    // The garden keeps which gifts have come; each counts once.
    found: () => Object.fromEntries((data.garden?.received || []).map(id => [id, { count: 1 }])),
    draw: (k, unknown) => giftSvg(k, unknown),
    name: k => t(`decor.kind_${k.id}`),
    unknown: 'catch.unknown_gift',
    hint: k => (k.event ? eventHint(k) : t(k.built ? 'catch.built_hint' : 'catch.gift_hint')),
    record: () => t('catch.received'),
    rare,
    action: k => takeOutButton(k.id),
  },
  tree: {
    tab: 'album.trees',
    kinds: TREES,
    found: () => data.album?.trees || {},
    draw: (k, unknown) =>
      artSvg(k.stages.find(stage => stage.name === 'mature').art, unknown ? 'class="unknown-art"' : ''),
    name: k => t(`tree.${k.id}`),
    hint: favored,
    record: entry => t('catch.trees_grown', { count: entry.count }),
  },
  treasure: {
    tab: 'album.treasures',
    kinds: TREASURES,
    found: () => data.album?.treasures || {},
    draw: (k, unknown) => artSvg(k.art, unknown ? 'class="unknown-art"' : ''),
    name: k => t(`treasure.${k.id}`),
    hint: favored,
    record: entry => caughtLine(entry, false),
    rare: k => k.rarity === 'uncommon',
  },
  // Winter animals whose prints a friend followed: the print is the clue, the tail what was seen.
  track: {
    tab: 'album.tracks',
    kinds: TRACKS,
    found: () => data.album?.tracks || {},
    draw: (k, unknown) => (unknown ? printSpecimen(k) : tailPeek(k)),
    name: k => t(`track.${k.id}`),
    unknown: 'album.whose_prints',
    hint: () => t('album.tracks_hint'),
    record: entry => t('album.followed', { count: entry.count }),
  },
  // Spring shoots a friend gathered: shown always, as silhouettes first; the hint says the season.
  shoot: {
    tab: 'album.shoots',
    kinds: SHOOTS,
    found: () => data.album?.shoots || {},
    draw: (k, unknown) => artSvg(k.art, unknown ? 'class="unknown-art"' : ''),
    name: k => t(`shoot.${k.id}`),
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
  stage.innerHTML = b.draw(kind, !entry);
  // Its place in the book, as on a collector's page: the gaps between numbers are what is left.
  const number = document.createElement('span');
  number.className = 'album-no';
  number.setAttribute('aria-hidden', 'true');
  number.textContent = String(index + 1).padStart(2, '0');
  stage.append(number);
  el.append(stage);
  const name = document.createElement('strong'),
    hint = document.createElement('small');
  name.textContent = entry ? b.name(kind) : t(b.unknown || 'catch.unknown');
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
    const record = document.createElement('small');
    record.className = 'album-record';
    record.textContent = b.record(entry);
    el.append(record);
    const action = b.action?.(kind);
    if (action) el.append(action);
  }
  return el;
}
// Set out while out of sight (decor-shown.js), a gift would vanish into the yard: it waits, and says
// when it shows: a Christmas gift its dates, a snowman winter.
const showsNow = kind => decorShown(kind, new Date(), yardSeason(scene));
const whenShown = kind => t(giftKind(kind)?.shown ? 'album.shown_december' : 'album.shown_winter');
// A gift that came before can always come back out of its card (garden.rs take_out): one in the
// yard says so, and one waiting in the box is set out from the box below the book. A snowman is
// built in the snow, never set out: its card only says when one stands in the yard.
function takeOutButton(kind) {
  const garden = data.garden || {};
  if ((garden.boxed || []).some(d => d.kind === kind)) return null;
  const out = (garden.decor || []).some(d => d.kind === kind);
  if (giftKind(kind)?.built && !out) return null;
  const room = (garden.decor?.length ?? 0) < limit(data, 'decor'),
    shows = showsNow(kind),
    button = document.createElement('button');
  button.type = 'button';
  button.className = 'album-take-out';
  button.textContent = t(out ? 'album.in_yard' : 'album.take_out');
  button.disabled = out || !room || !shows;
  button.title = !shows
    ? whenShown(kind)
    : out
      ? t('album.in_yard')
      : room
        ? t('album.set_out', { kind: t(`decor.kind_${kind}`) })
        : t('album.set_out_full');
  button.setAttribute('aria-label', button.title);
  button.onclick = () => {
    // Taken out once: a second click before the album redraws would find it out already.
    button.disabled = true;
    call('takeOut', kind, 0.3 + Math.random() * 0.4, 0.8).catch(error => {
      button.disabled = false;
      toast(spoken(error, t('error.generic')), { error: true });
    });
  };
  return button;
}
// The gift box, in the gift book: gifts that came while the yard was full, and mementos put away.
// Each is set out near the front of the yard, from where the person drags it on.
function renderBox(open) {
  const boxed = data.garden?.boxed || [],
    box = $('album-box');
  box.hidden = !open || !boxed.length;
  if (box.hidden) return;
  const room = (data.garden?.decor?.length ?? 0) < limit(data, 'decor');
  $('album-box-title').textContent = t('album.box_title', { count: boxed.length, limit: limit(data, 'giftBox') });
  $('album-box-items').replaceChildren(
    ...boxed.map(d => {
      const button = document.createElement('button'),
        label = document.createElement('small'),
        kind = giftKind(d.kind),
        named = t(`decor.kind_${d.kind}`),
        shows = showsNow(d.kind);
      button.type = 'button';
      button.className = 'album-box-item';
      button.classList.toggle('memento', !!d.memento);
      button.disabled = !room || !shows;
      button.title = !shows ? whenShown(d.kind) : room ? t('album.set_out', { kind: named }) : t('album.set_out_full');
      button.setAttribute('aria-label', button.title);
      button.innerHTML = kind ? giftSvg(kind) : '';
      label.textContent = named;
      button.append(label);
      button.onclick = () => {
        // Set out once: a second click before the album redraws would find it gone.
        button.disabled = true;
        call('setOut', d.id, 0.3 + Math.random() * 0.4, 0.8).catch(error => {
          button.disabled = false;
          toast(spoken(error, t('error.generic')), { error: true });
        });
      };
      return button;
    }),
  );
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
    const yardFull = (data.garden?.decor?.length ?? 0) >= limit(data, 'decor'),
      boxFull = (data.garden?.boxed?.length ?? 0) >= limit(data, 'giftBox');
    status.textContent = t(yardFull ? (boxFull ? 'album.gifts_full' : 'album.gift_full') : 'album.gift_rule');
  }
  renderBox(giftBook);
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
  $('album-grid').replaceChildren(
    ...b.kinds.filter(k => !b.hidden || have[k.id]).map((k, index) => card(b, k, have[k.id], index)),
  );
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
