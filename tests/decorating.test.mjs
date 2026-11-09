// The decorating view: a press on the Christmas tree opens it; a person picks a find, lights the
// free hooks and hangs it, three a day; a card names each bauble and takes it down again; the
// nearest friend says a line (src/yard/decorating.js).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import './support/content.mjs';
import { element, keepGlobals } from './support/dom.mjs';

const calls = [];
const answer = (data = null) => ({ ok: true, data });
globalThis.playPets = {
  moveDecor: async (...args) => {
    calls.push(['moveDecor', ...args]);
    return answer();
  },
  hideDecor: async () => answer(),
  putAway: async () => answer(),
  hangOrnament: async (...args) => {
    calls.push(['hangOrnament', ...args]);
    return answer({ book: args[0], id: args[1], hook: args[2] });
  },
  takeDownOrnament: async (...args) => {
    calls.push(['takeDownOrnament', ...args]);
    return answer();
  },
};
const hangs = globalThis.playPets.hangOrnament;
const state = await import('../src/core/state.js');
const { list, setLanguageForTests, t } = await import('../src/core/i18n.js');
const { reduced } = await import('../src/core/sprites.js');
const { giftKind } = await import('../src/yard/catalog.js');
const { christmasNightCheck, percent, setupChristmasNight } = await import('../src/yard/christmas-night.js');
const { refreshShownDecor, setupDecor } = await import('../src/yard/decor.js');
const { ARC_MS, CHEER_AT, GLINT_STEP, SETTLE_MS, openDecorating, renderDecorating, setupDecorating } =
  await import('../src/yard/decorating.js');
const { fieldToYard, petHeight } = await import('../src/yard/field.js');
const { drawTreeOrnaments, hangable, ornamentLook } = await import('../src/yard/ornaments.js');
const { drawYard } = await import('./support/yard.mjs');

const ART = ['decor/xmas_tree.svg', 'decor/xmas_tree_grand.svg', 'decor/sleigh.svg'];
const TREE = { id: 'tree', kind: 'xmas_tree', x: 0.5, y: 0.6 };
const BENCH = { id: 'bench1', kind: 'bench', x: 0.15, y: 0.7 };
const DAY = { world: 'woodland', event: 'lights', season: 'winter', period: 'day', weather: 'clear' };
const SNOWY_NIGHT = { ...DAY, period: 'night', weather: 'snow' };
const NOW = new Date(2026, 11, 20, 14);
const FOUND = { count: 1, best: 0, first: 1 };
const ALBUM = {
  flowers: { camellia: FOUND, snowdrop: FOUND },
  trees: { maple: FOUND, pine: FOUND },
  treasures: { pinecone: FOUND },
};
const camellia = (hook = 0) => ({ book: 'flower', id: 'camellia', hook });

// The fake DOM answers one class per selector (support/dom.mjs), so these walk the children; a
// removed node stays in place, marked, and is left out.
const kids = node => node.children.filter(c => typeof c === 'object' && !c.removed);
const has = (node, ...classes) => classes.every(c => node.classList.contains(c));
function findAll(node, ...classes) {
  return kids(node).flatMap(c => [...(has(c, ...classes) ? [c] : []), ...findAll(c, ...classes)]);
}
const find = (node, ...classes) => findAll(node, ...classes)[0] ?? null;
const byHook = (node, n) => kids(node).filter(c => c.dataset.hook === String(n));
const flush = () => new Promise(resolve => setImmediate(resolve));

// Two friends: one at the tree's foot, one far off on the left.
function friends() {
  const foot = fieldToYard(TREE),
    py = foot.y - petHeight({ size: 96 }) + 6;
  const view = (id, px) => ({
    pet: { id, size: 96 },
    asset: { id, version: 2 },
    bubble: element('p', { hidden: true }),
    x: 0,
    y: 0,
    px,
    py,
    look: null,
    pose: 'idle',
    until: 0,
  });
  state.views.set('near', view('near', 360));
  state.views.set('far', view('far', 20));
  return { near: state.views.get('near'), far: state.views.get('far') };
}

async function decorating(
  ctx,
  { now = NOW, scene = DAY, garden = {}, album = ALBUM, withFriends = true, before } = {},
) {
  calls.length = 0;
  let pals = {},
    shut = () => {};
  // A hang still in motion stops with its test, while the fake document and the test's clock are
  // still there (after-hooks run in the order they were added).
  ctx.after(() => shut());
  const parts = await drawYard(ctx, {
    now: now.getTime(),
    scene,
    art: ART,
    garden: { decor: [TREE, BENCH], received: ['xmas_tree', 'bench'], ...garden },
    setup: () => {
      setupChristmasNight();
      setupDecor({
        drawn: () => {
          christmasNightCheck();
          drawTreeOrnaments();
          renderDecorating();
        },
        press: { xmas_tree: openDecorating },
      });
      setupDecorating();
    },
    before: hooks => {
      state.data.album = album;
      if (withFriends) pals = friends();
      before?.(hooks);
    },
  });
  // drawStill's sheet: never loads here, so the friend's canvas stays blank. Kept after the yard's
  // own hooks, which still need the fake document when the test ends.
  keepGlobals(ctx, 'Image');
  globalThis.Image = class {
    addEventListener() {}
  };
  const { nodes } = parts;
  const tree = () => parts.shown().find(b => b.dataset.kind === 'xmas_tree');
  const bench = () => parts.shown().find(b => b.dataset.kind === 'bench');
  const $ = id => nodes.get(id);
  const dialog = $('decorating-dialog');
  shut = () => {
    dialog.close();
    dialog.dispatch('close');
  };
  const chips = () => kids($('decorating-tray'));
  const kinds = () => kids($('decorating-kinds'));
  const spots = () => findAll($('decorating-tree'), 'ornament-hook');
  const baubles = () => findAll($('decorating-tree'), 'bauble');
  const dots = () => kids($('decorating-status')).filter(c => has(c, 'dot'));
  const status = () => $('decorating-status').textContent;
  const press = async (button = tree()) => {
    await button.dispatch('pointerdown', { button: 0, clientX: 400, clientY: 300, pointerId: 1 });
    await button.dispatch('pointerup', { clientX: 400, clientY: 300, pointerId: 1 });
  };
  const chipFor = id => chips().find(c => c.dataset.key.endsWith(`:${id}`));
  return { ...parts, ...pals, tree, bench, $, dialog, chips, kinds, spots, baubles, dots, status, press, chipFor };
}
const hung = (garden, ...ornaments) => ({
  ...garden,
  ornaments: [...(garden.ornaments || []), ...ornaments],
  ornamentYear: 2026,
});

test('pressing the Christmas tree opens the decorating view; dragging it does not', async ctx => {
  const v = await decorating(ctx);
  assert.equal(v.tree().title, t('decor.title_decorate', { kind: t('decor.kind_xmas_tree') }));
  assert.equal(v.tree().getAttribute('aria-label'), v.tree().title);
  assert.equal(v.bench().title, t('decor.title', { kind: t('decor.kind_bench') }), 'a bench still says drag');

  await v.tree().dispatch('pointerdown', { button: 0, clientX: 400, clientY: 300, pointerId: 1 });
  await v.tree().dispatch('pointermove', { clientX: 430, clientY: 300, pointerId: 1 });
  await v.tree().dispatch('pointerup', { clientX: 430, clientY: 300, pointerId: 1 });
  await flush();
  assert.ok(!v.dialog.open, 'a drag moves it');
  assert.ok(calls.some(([name, id]) => name === 'moveDecor' && id === 'tree'));

  await v.press();
  assert.ok(v.dialog.open, 'a press opens it');
  assert.ok(has(v.$('decorating-tree'), 'small'));
  v.dialog.close();

  const enter = { key: 'Enter', defaultPrevented: false };
  await v.tree().dispatch('keydown', enter);
  assert.ok(v.dialog.open, 'Enter opens it');
  v.dialog.close();
  await v.tree().dispatch('keydown', { key: ' ' });
  assert.ok(v.dialog.open, 'Space opens it');
  v.dialog.close();

  await v.press(v.bench());
  assert.ok(!v.dialog.open, 'a bench is not decorated');
  assert.ok(v.near.target || v.far.target, 'a friend walks to the bench');
});

test('the dots say how many are left today, and a new day has three again', async ctx => {
  const v = await decorating(ctx, {
    garden: {
      ...hung({}, camellia(0), { book: 'tree', id: 'maple', hook: 1 }),
      ornamentDay: { day: '2026-12-20', count: 2 },
    },
  });
  openDecorating();
  assert.ok(v.status().startsWith(t('decorating.left', { count: 1 })));
  assert.equal(v.dots().length, 3);
  assert.equal(v.dots().filter(d => has(d, 'used')).length, 2);
  assert.ok(v.dots().every(d => d.getAttribute('aria-hidden') === 'true'));
  ctx.mock.timers.setTime(new Date(2026, 11, 21, 9).getTime());
  renderDecorating();
  assert.ok(v.status().startsWith(t('decorating.left', { count: 3 })));
  assert.equal(v.dots().filter(d => has(d, 'used')).length, 0);
});

test('last December’s ornaments are not on the view’s tree from December 1', async ctx => {
  const v = await decorating(ctx, {
    now: new Date(2026, 11, 1, 10),
    garden: {
      ornaments: [camellia(0), { book: 'tree', id: 'maple', hook: 4 }],
      ornamentYear: 2025,
      ornamentDay: { day: '2026-01-07', count: 3 },
    },
  });
  openDecorating();
  assert.equal(v.baubles().length, 0);
  assert.equal(v.dots().length, 3);
  assert.equal(v.dots().filter(d => has(d, 'used')).length, 0);
  assert.ok(v.chipFor('camellia'), 'last year’s camellia can hang again');
});

test('the tray offers what can hang, by book', async ctx => {
  const v = await decorating(ctx, { garden: hung({}, { book: 'tree', id: 'pine', hook: 2 }) });
  openDecorating();
  const all = hangable(state.data, new Date());
  assert.deepEqual(
    v.chips().map(c => c.dataset.key),
    all.map(o => `${o.book}:${o.id}`),
    'in hangable order, without the pine that hangs',
  );
  assert.deepEqual(
    v.kinds().map(c => c.dataset.book),
    ['all', 'flower', 'tree', 'gift', 'treasure'],
  );
  assert.equal(v.kinds()[0].textContent, t('decorating.all'));
  assert.equal(v.kinds()[2].textContent, t('album.trees'));
  assert.equal(v.kinds()[0].getAttribute('aria-pressed'), 'true');
  await v.kinds()[2].dispatch('click');
  assert.deepEqual(
    v.chips().map(c => c.dataset.key),
    ['tree:maple'],
  );
  assert.equal(v.kinds()[2].getAttribute('aria-pressed'), 'true');
  assert.equal(v.kinds()[0].getAttribute('aria-pressed'), 'false');
  const chip = v.chips()[0];
  assert.ok(has(chip, 'ornament-chip', 'tree'));
  assert.equal(find(chip, 'ornament-chip-name').textContent, t('tree.maple'));
  assert.ok(find(chip, 'ornament-chip-art').innerHTML.includes('<svg'));
  assert.equal(chip.getAttribute('aria-pressed'), 'false');
});

test('picking an item lights only the free hooks; Escape puts it back without closing', async ctx => {
  const v = await decorating(ctx, { garden: hung({}, camellia(0), { book: 'tree', id: 'pine', hook: 5 }) });
  openDecorating();
  const chip = v.chipFor('snowdrop');
  await chip.dispatch('click');
  assert.equal(chip.getAttribute('aria-pressed'), 'true');
  assert.ok(has(v.$('decorating-tree'), 'placing'));
  assert.equal(v.spots().length, 10);
  assert.deepEqual(
    v.spots().map(s => +s.dataset.hook),
    [1, 2, 3, 4, 6, 7, 8, 9, 10, 11],
  );
  const [x, y] = giftKind('xmas_tree').hooks[1];
  assert.equal(v.spots()[0].style.left, percent(x));
  assert.equal(v.spots()[0].style.top, percent(y));
  assert.equal(v.spots()[0].getAttribute('aria-label'), t('decorating.hook'));
  assert.equal(globalThis.document.activeElement, v.spots()[0]);
  assert.ok(v.status().startsWith(t('decorating.pick')));

  // Escape is read as a key, not from `cancel`: Chromium lets a page hold back only the first of
  // repeated cancels, so the second Escape would close the view.
  const event = { prevented: false };
  await v.dialog.dispatch('keydown', {
    key: 'Escape',
    preventDefault() {
      event.prevented = true;
    },
  });
  assert.ok(event.prevented);
  assert.equal(v.spots().length, 0);
  assert.ok(!has(v.$('decorating-tree'), 'placing'));
  assert.ok(v.dialog.open, 'still open');
  assert.equal(globalThis.document.activeElement, v.chipFor('snowdrop'));
  assert.equal(v.chipFor('snowdrop').getAttribute('aria-pressed'), 'false');
  await v.dialog.dispatch('keydown', { key: 'Escape' });
  assert.ok(!v.dialog.open, 'a second Escape closes it');
  openDecorating();
  await v.chipFor('snowdrop').dispatch('click');
  await v.dialog.dispatch('cancel');
  assert.ok(!v.dialog.open, 'a cancel that still comes closes it');
});

test('a hook sends book, id, hook and today once, and the new bauble shows', async ctx => {
  const v = await decorating(ctx, { garden: { ornamentDay: { day: '2026-12-20', count: 1 }, ornamentYear: 2026 } });
  let settle;
  globalThis.playPets.hangOrnament = (...args) => {
    calls.push(['hangOrnament', ...args]);
    return new Promise(resolve => {
      settle = () => resolve(answer({ book: args[0], id: args[1], hook: args[2] }));
    });
  };
  ctx.after(() => {
    globalThis.playPets.hangOrnament = hangs;
  });
  openDecorating();
  await v.chipFor('camellia').dispatch('click');
  const three = v.spots().find(s => s.dataset.hook === '3');
  three.dispatch('click');
  three.dispatch('click');
  await v.spots()[0]?.dispatch('click');
  assert.deepEqual(
    calls.filter(c => c[0] === 'hangOrnament'),
    [['hangOrnament', 'flower', 'camellia', 3, '2026-12-20']],
  );
  // At the press: the bauble is made on its hook, where the arc begins, and the tray lets it go.
  const [early] = byHook(v.$('decorating-tree'), 3).filter(n => has(n, 'bauble'));
  assert.ok(early && has(early, 'bauble', 'flower', 'hanging'));
  assert.equal(v.spots().length, 0, 'picking ends');
  assert.equal(v.chipFor('camellia'), undefined);
  assert.ok(v.status().startsWith(t('decorating.left', { count: 1 })), 'the hang on its way counts');
  // A render while the backend answers keeps that node.
  renderDecorating();
  assert.equal(byHook(v.$('decorating-tree'), 3).filter(n => has(n, 'bauble'))[0], early);

  settle();
  await flush();
  state.setData({
    ...state.data,
    garden: {
      ...state.data.garden,
      ornaments: [camellia(3)],
      ornamentDay: { day: '2026-12-20', count: 2 },
    },
  });
  renderDecorating();
  const shown = byHook(v.$('decorating-tree'), 3).filter(n => has(n, 'bauble', 'flower'));
  assert.equal(shown.length, 1);
  assert.equal(shown[0], early, 'the same node, confirmed');
  assert.ok(!has(shown[0], 'hanging'));
  assert.equal(shown[0].localName, 'button');
  assert.equal(
    shown[0].getAttribute('aria-label'),
    t('decorating.ornament', { name: ornamentLook('flower', 'camellia').name }),
  );
  assert.ok(find(shown[0], 'bauble-ball').innerHTML.includes('<svg'), 'holding its art');
  assert.equal(v.spots().length, 0);
  assert.ok(v.status().startsWith(t('decorating.left', { count: 1 })));
  assert.equal(v.baubles().length, 1);
});

test('a refused hang says why and leaves the tree as it was', async ctx => {
  const v = await decorating(ctx);
  globalThis.playPets.hangOrnament = async (...args) => {
    calls.push(['hangOrnament', ...args]);
    return { ok: false, error: t('error.ornaments_today') };
  };
  ctx.after(() => {
    globalThis.playPets.hangOrnament = hangs;
  });
  openDecorating();
  await v.chipFor('camellia').dispatch('click');
  await v.spots()[0].dispatch('click');
  await flush();
  const notice = v.$('toast');
  assert.ok(kids(notice).some(line => line.textContent === t('error.ornaments_today') && has(line, 'error')));
  assert.equal(v.baubles().length, 0);
  assert.ok(v.chipFor('camellia'), 'the chip is still there');
  assert.ok(v.status().startsWith(t('decorating.left', { count: 3 })));
});

test('with the day’s three hung the tray waits for tomorrow; with every hook taken it says the tree is full', async ctx => {
  const v = await decorating(ctx, {
    garden: { ...hung({}, camellia(0)), ornamentDay: { day: '2026-12-20', count: 3 } },
  });
  openDecorating();
  assert.ok(v.status().startsWith(t('decorating.done_today')));
  assert.ok(v.chips().length > 0);
  assert.ok(v.chips().every(c => c.disabled));
  await v.chips()[0].dispatch('click');
  assert.equal(v.spots().length, 0, 'nothing can be picked');

  const twelve = Array.from({ length: 12 }, (_, hook) => ({ book: 'gift', id: `g${hook}`, hook }));
  state.setData({
    ...state.data,
    garden: { ...state.data.garden, ornaments: twelve, ornamentDay: { day: '2026-12-19', count: 3 } },
  });
  renderDecorating();
  assert.equal(v.status(), t('decorating.full'));
  assert.equal(v.dots().length, 0);
  assert.ok(v.chips().every(c => c.disabled));
});

test('with nothing found the view says what can hang', async ctx => {
  const v = await decorating(ctx, { album: {}, garden: { received: ['xmas_tree'] } });
  openDecorating();
  assert.equal(v.status(), t('decorating.empty'));
  assert.equal(v.chips().length, 0);
  assert.equal(v.kinds().length, 0);
  assert.equal(v.dots().length, 0);
});

test('the card shows a bauble’s art, name and book on hover after a moment, on focus at once, and on tap', async ctx => {
  const v = await decorating(ctx, { garden: hung({}, camellia(4)) });
  openDecorating();
  const card = v.$('ornament-card'),
    [node] = v.baubles();
  assert.equal(node.getAttribute('aria-controls'), 'ornament-card');
  await node.dispatch('pointerenter', { pointerType: 'mouse' });
  ctx.mock.timers.tick(299);
  assert.ok(card.hidden !== false, 'not yet');
  ctx.mock.timers.tick(1);
  assert.equal(card.hidden, false);
  assert.equal(node.getAttribute('aria-expanded'), 'true');
  const look = ornamentLook('flower', 'camellia');
  assert.ok(card.textContent.includes(look.name));
  assert.ok(card.textContent.includes(t('decorating.book', { book: t('catch.tab_flowers') })));
  assert.ok(find(card, 'ornament-card-art').innerHTML.includes('<svg'));
  assert.ok(find(card, 'ornament-take-down'), 'a button to take it down');
  await node.dispatch('pointerleave');
  ctx.mock.timers.tick(150);
  assert.equal(card.hidden, true);
  assert.equal(node.getAttribute('aria-expanded'), 'false');

  // Leaving the bauble for the card keeps it.
  await node.dispatch('pointerenter', { pointerType: 'mouse' });
  ctx.mock.timers.tick(300);
  await node.dispatch('pointerleave');
  await card.dispatch('pointerenter');
  ctx.mock.timers.tick(500);
  assert.equal(card.hidden, false, 'the pointer is on the card');
  await card.dispatch('pointerleave');
  ctx.mock.timers.tick(150);
  assert.equal(card.hidden, true);

  await node.dispatch('focus');
  assert.equal(card.hidden, false, 'focus shows it at once');
  await node.dispatch('blur', { relatedTarget: find(card, 'ornament-take-down') });
  ctx.mock.timers.tick(0);
  assert.equal(card.hidden, false, 'focus moved into the card');
  await node.dispatch('blur', { relatedTarget: null });
  ctx.mock.timers.tick(0);
  assert.equal(card.hidden, true, 'blur hides it');

  // A tap: the press's focus does not show it, the click does; a second click hides it.
  await node.dispatch('pointerdown', { pointerType: 'touch' });
  await node.dispatch('focus');
  assert.equal(card.hidden, true);
  await node.dispatch('click');
  assert.equal(card.hidden, false);
  await node.dispatch('click');
  assert.equal(card.hidden, true);
  await node.dispatch('click');
  assert.equal(card.hidden, false);
  // Escape hides the card first and keeps the view open.
  await v.dialog.dispatch('keydown', { key: 'Escape' });
  assert.equal(card.hidden, true);
  assert.ok(v.dialog.open);
});

test('the keyboard reaches each card’s Take down and goes on to the next bauble', async ctx => {
  const v = await decorating(ctx, { garden: hung({}, camellia(1), { book: 'tree', id: 'maple', hook: 4 }) });
  openDecorating();
  const card = v.$('ornament-card'),
    [first, second] = v.baubles(),
    down = () => find(card, 'ornament-take-down');
  // Enter opens the card on its button; the key's own click must not shut it.
  const enter = { prevented: false };
  await first.dispatch('keydown', {
    key: 'Enter',
    preventDefault() {
      enter.prevented = true;
    },
  });
  assert.ok(enter.prevented);
  assert.equal(card.hidden, false);
  assert.equal(globalThis.document.activeElement, down());
  // Tab from the card goes on to the next bauble, Shift+Tab back to its own.
  const tab = { prevented: false };
  await card.dispatch('keydown', {
    key: 'Tab',
    preventDefault() {
      tab.prevented = true;
    },
  });
  assert.ok(tab.prevented);
  assert.equal(globalThis.document.activeElement, second);
  await second.dispatch('focus');
  assert.equal(card.dataset.hook, '4', 'its own card shows');
  // Tab from a bauble whose card shows goes into the card first.
  await second.dispatch('keydown', { key: 'Tab' });
  assert.equal(globalThis.document.activeElement, down());
  assert.ok(card.textContent.includes(t('tree.maple')));
  await card.dispatch('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(globalThis.document.activeElement, second);
  assert.equal(card.hidden, false);
  // Escape from inside the card hides it and gives focus back to its bauble, without showing it again.
  await second.dispatch('keydown', { key: 'Tab' });
  await v.dialog.dispatch('keydown', { key: 'Escape' });
  assert.equal(card.hidden, true);
  assert.equal(globalThis.document.activeElement, second);
  assert.ok(v.dialog.open);
  // Space opens it too.
  await second.dispatch('keydown', { key: ' ' });
  assert.equal(globalThis.document.activeElement, down());
});

test('Escape on a card the pointer opened leaves focus where it was', async ctx => {
  const v = await decorating(ctx, { garden: hung({}, camellia(1)) });
  openDecorating();
  const chip = v.chipFor('snowdrop');
  chip.focus();
  const [node] = v.baubles();
  await node.dispatch('pointerenter', { pointerType: 'mouse' });
  ctx.mock.timers.tick(300);
  assert.equal(v.$('ornament-card').hidden, false);
  await v.dialog.dispatch('keydown', { key: 'Escape' });
  assert.equal(v.$('ornament-card').hidden, true);
  assert.equal(globalThis.document.activeElement, chip, 'the tray keeps focus');
  assert.ok(v.dialog.open);
});

test('a card takes its ornament down: the hook frees, the item returns to the tray, the count stays', async ctx => {
  const v = await decorating(ctx, {
    garden: { ...hung({}, camellia(4)), ornamentDay: { day: '2026-12-20', count: 1 } },
  });
  openDecorating();
  assert.equal(v.chipFor('camellia'), undefined);
  const [node] = v.baubles();
  await node.dispatch('click');
  await find(v.$('ornament-card'), 'ornament-take-down').dispatch('click');
  await flush();
  assert.deepEqual(
    calls.filter(c => c[0] === 'takeDownOrnament'),
    [['takeDownOrnament', 'flower', 'camellia', '2026-12-20']],
  );
  assert.equal(v.$('ornament-card').hidden, true);
  assert.equal(v.baubles().length, 0, 'off the tree at once');
  assert.ok(v.chipFor('camellia'), 'back in the tray');
  assert.equal(globalThis.document.activeElement, v.chipFor('camellia'));
  assert.ok(v.status().startsWith(t('decorating.taken_down', { name: ornamentLook('flower', 'camellia').name })));
  // The garden catches up; the day's count is as it was.
  state.setData({ ...state.data, garden: { ...state.data.garden, ornaments: [] } });
  renderDecorating();
  assert.equal(v.baubles().length, 0);
  assert.equal(v.dots().filter(d => has(d, 'used')).length, 1, 'a hang taken down is not given back');
  await v.chipFor('camellia').dispatch('click');
  assert.ok(
    v.spots().some(s => s.dataset.hook === '4'),
    'its hook is free',
  );
  assert.equal(v.spots().length, 12);
});

test('after a take-down on a day with its three hung, the status still says why the tray rests', async ctx => {
  const v = await decorating(ctx, {
    garden: { ...hung({}, camellia(4)), ornamentDay: { day: '2026-12-20', count: 3 } },
  });
  openDecorating();
  await v.baubles()[0].dispatch('click');
  await find(v.$('ornament-card'), 'ornament-take-down').dispatch('click');
  await flush();
  const name = ornamentLook('flower', 'camellia').name;
  assert.ok(v.status().includes(t('decorating.taken_down', { name })));
  assert.ok(v.status().includes(t('decorating.done_today')));
  assert.ok(v.chips().every(c => c.disabled));
});

test('in Japanese and Chinese the take-down note and the reason run on without a space', async ctx => {
  const garden = { ...hung({}, camellia(4)), ornamentDay: { day: '2026-12-20', count: 3 } };
  const v = await decorating(ctx, { garden });
  ctx.after(() => setLanguageForTests('en'));
  for (const lang of ['ja', 'zh-hans', 'en']) {
    setLanguageForTests(lang);
    openDecorating();
    await v.baubles()[0].dispatch('click');
    await find(v.$('ornament-card'), 'ornament-take-down').dispatch('click');
    await flush();
    const note = t('decorating.taken_down', { name: ornamentLook('flower', 'camellia').name }),
      gap = lang === 'en' ? ' ' : '';
    assert.equal(v.status(), `${note}${gap}${t('decorating.done_today')}`, lang);
    v.dialog.close();
    await v.dialog.dispatch('close');
  }
});

test('holding Enter on a bauble opens its card and never goes on to take it down', async ctx => {
  const v = await decorating(ctx, { garden: hung({}, camellia(1)) });
  openDecorating();
  const card = v.$('ornament-card'),
    [node] = v.baubles();
  await node.dispatch('keydown', { key: 'Enter' });
  const down = find(card, 'ornament-take-down');
  assert.equal(globalThis.document.activeElement, down);
  // The key's repeats land on Take down, which now has focus; Enter would click it on keydown.
  for (const key of ['Enter', ' ']) {
    const held = { prevented: false };
    await down.dispatch('keydown', {
      key,
      repeat: true,
      preventDefault() {
        held.prevented = true;
      },
    });
    assert.ok(held.prevented, `a held ${key === ' ' ? 'Space' : key} is not a press`);
  }
  const fresh = { prevented: false };
  await down.dispatch('keydown', {
    key: 'Enter',
    preventDefault() {
      fresh.prevented = true;
    },
  });
  assert.ok(!fresh.prevented, 'a new press still takes it down');
  // A repeat that reaches the bauble itself does nothing.
  await v.dialog.dispatch('keydown', { key: 'Escape' });
  assert.equal(card.hidden, true);
  const repeat = { prevented: false };
  await node.dispatch('keydown', {
    key: 'Enter',
    repeat: true,
    preventDefault() {
      repeat.prevented = true;
    },
  });
  assert.ok(repeat.prevented);
  assert.equal(card.hidden, true);
  assert.equal(globalThis.document.activeElement, node);
  assert.deepEqual(
    calls.filter(c => c[0] === 'takeDownOrnament'),
    [],
  );
});

test('a refused take-down says why and leaves the bauble where it was', async ctx => {
  const v = await decorating(ctx, { garden: hung({}, camellia(4)) });
  const takes = globalThis.playPets.takeDownOrnament;
  globalThis.playPets.takeDownOrnament = async (...args) => {
    calls.push(['takeDownOrnament', ...args]);
    return { ok: false, error: t('error.bad_request') };
  };
  ctx.after(() => {
    globalThis.playPets.takeDownOrnament = takes;
  });
  openDecorating();
  await v.baubles()[0].dispatch('click');
  const down = find(v.$('ornament-card'), 'ornament-take-down');
  await down.dispatch('click');
  await flush();
  assert.ok(kids(v.$('toast')).some(line => line.textContent === t('error.bad_request') && has(line, 'error')));
  assert.equal(v.baubles().length, 1);
  assert.equal(v.chipFor('camellia'), undefined);
  assert.equal(down.disabled, false, 'it can be tried again');
});

test('Take down rests while a hang is on its way', async ctx => {
  const v = await decorating(ctx, { garden: hung({}, camellia(4)) });
  let settle;
  globalThis.playPets.hangOrnament = (...args) => {
    calls.push(['hangOrnament', ...args]);
    return new Promise(resolve => {
      settle = () => resolve(answer({ book: args[0], id: args[1], hook: args[2] }));
    });
  };
  ctx.after(() => {
    globalThis.playPets.hangOrnament = hangs;
  });
  openDecorating();
  await v.chipFor('snowdrop').dispatch('click');
  v.spots()[0].dispatch('click');
  await v.baubles()[0].dispatch('click');
  const down = find(v.$('ornament-card'), 'ornament-take-down');
  assert.equal(down.disabled, true);
  settle();
  await flush();
  assert.equal(down.disabled, false);
});

test('a friend near the tree says a line after a hang; with no friends nobody does', async ctx => {
  const v = await decorating(ctx);
  openDecorating();
  const friend = v.$('decorating-friend'),
    said = v.$('decorating-bubble');
  assert.equal(friend.hidden, false);
  assert.equal(kids(friend).filter(c => c.localName === 'canvas').length, 1, 'its resting cell, drawn once');
  await v.chipFor('camellia').dispatch('click');
  await v.spots()[0].dispatch('click');
  await flush();
  assert.equal(said.hidden, true, 'not while the bauble is on its way');
  ctx.mock.timers.tick(710);
  const lines = list('decorating.cheer');
  assert.ok(lines.includes(v.near.bubble.textContent), 'the near friend says it in the yard');
  assert.equal(v.far.bubble.hidden, true, 'not the far one');
  assert.equal(said.textContent, v.near.bubble.textContent);
  assert.equal(said.hidden, false);
  ctx.mock.timers.tick(2600);
  assert.equal(said.hidden, true);
});

test('with no friends out nobody reacts', async ctx => {
  const v = await decorating(ctx, { withFriends: false });
  openDecorating();
  assert.equal(v.$('decorating-friend').hidden, true);
  await v.chipFor('camellia').dispatch('click');
  await v.spots()[0].dispatch('click');
  await flush();
  assert.equal(v.$('decorating-bubble').hidden, true);
  assert.equal(v.baubles().length, 1, 'the hang still happens');
});

test('the view closes when the tree leaves the yard', async ctx => {
  const v = await decorating(ctx);
  openDecorating();
  assert.ok(v.dialog.open);
  await v.tree().dispatch('keydown', { key: 'Delete' });
  assert.equal(v.tree().hidden, true, 'hidden while its Undo waits');
  renderDecorating();
  assert.ok(!v.dialog.open, 'closed with the tree');
  const undo = find(v.$('toast'), 'toast-action');
  undo.onclick();
  assert.equal(v.tree().hidden, false);
  openDecorating();
  assert.ok(v.dialog.open);
  ctx.mock.timers.setTime(new Date(2027, 0, 8, 9).getTime());
  refreshShownDecor();
  renderDecorating();
  assert.ok(!v.dialog.open, 'closed when the season ends');
});

test('closing gives focus back to the tree', async ctx => {
  const v = await decorating(ctx);
  await v.press();
  assert.ok(v.dialog.open);
  await v.$('close-decorating').dispatch('click');
  assert.ok(!v.dialog.open);
  await v.dialog.dispatch('close');
  assert.equal(globalThis.document.activeElement, v.tree());
  renderDecorating();
  assert.ok(!v.dialog.open, 'a render does not open it again');
});

test('the grand tree opens the view with its own drawing and hooks', async ctx => {
  const v = await decorating(ctx, {
    now: new Date(2026, 11, 20, 21),
    scene: SNOWY_NIGHT,
    garden: hung({}, camellia(0), { book: 'treasure', id: 'pinecone', hook: 11 }),
    before: ({ storage }) => storage.setItem('xmas-night', '2026-12-20'),
  });
  assert.ok(has(v.tree(), 'xmas-grand'));
  await v.press();
  assert.ok(v.dialog.open);
  const drawing = v.$('decorating-tree');
  assert.ok(has(drawing, 'grand'));
  assert.ok(!has(drawing, 'small'));
  const { hooks } = giftKind('xmas_tree').night;
  const [first, last] = v.baubles();
  assert.equal(first.style.left, percent(hooks[0][0]));
  assert.equal(first.style.top, percent(hooks[0][1]));
  assert.equal(last.style.left, percent(hooks[11][0]));
  assert.equal(last.style.top, percent(hooks[11][1]));
});

test('in the Cozy living room the tree is decorated in December too', async ctx => {
  const v = await decorating(ctx, { scene: { ...DAY, world: 'studio' } });
  assert.ok(v.tree(), 'the tree shows');
  await v.press();
  assert.ok(v.dialog.open);
  await v.chipFor('camellia').dispatch('click');
  await v.spots()[0].dispatch('click');
  await flush();
  assert.deepEqual(
    calls.filter(c => c[0] === 'hangOrnament'),
    [['hangOrnament', 'flower', 'camellia', 0, '2026-12-20']],
  );
  assert.equal(v.baubles().length, 1);
});

// A hang whose call waits for `settle()`, so a test can look at the bauble before it flies.
function waitingHang(ctx) {
  const held = {};
  globalThis.playPets.hangOrnament = (...args) => {
    calls.push(['hangOrnament', ...args]);
    return new Promise(resolve => {
      held.settle = () => resolve(answer({ book: args[0], id: args[1], hook: args[2] }));
    });
  };
  ctx.after(() => {
    globalThis.playPets.hangOrnament = hangs;
  });
  return held;
}
const MOVING = ['flying', 'swing', 'appear', 'hanging'];

test('a hung bauble arcs from the tray, the branch dips, it swings to rest and three glints follow', async ctx => {
  const v = await decorating(ctx);
  const held = waitingHang(ctx);
  openDecorating();
  const chip = v.chipFor('camellia');
  chip.getBoundingClientRect = () => ({ left: 100, top: 400, width: 70, height: 60, right: 170, bottom: 460 });
  await chip.dispatch('click');
  await v.spots()[0].dispatch('click');
  // The tray has changed by the time the backend answers; the arc starts where the chip was.
  chip.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 });
  const [node] = v.baubles(),
    tree = v.$('decorating-tree'),
    friend = v.$('decorating-friend'),
    said = v.$('decorating-bubble');
  assert.ok(has(node, 'hanging'), 'unseen until the backend answers');
  assert.ok(!has(node, 'flying'));
  // The start of the arc, as it is when the transitions go on.
  const start = {},
    add = node.classList.add;
  node.classList.add = (...names) => {
    if (names.includes('flying'))
      Object.assign(start, {
        x: find(node, 'bauble-fly-x').style.transform,
        y: find(node, 'bauble-fly-y').style.transform,
        ball: find(node, 'bauble-ball').style.transform,
        hanging: has(node, 'hanging'),
      });
    add(...names);
  };
  held.settle();
  await flush();
  assert.deepEqual(start, { x: 'translateX(135px)', y: 'translateY(430px)', ball: 'scale(1.3)', hanging: false });
  assert.ok(has(node, 'flying'));
  const fx = find(node, 'bauble-fly-x'),
    fy = find(fx, 'bauble-fly-y'),
    ball = find(fy, 'bauble-ball');
  assert.ok(ball, 'the ball rides in its two wrappers');
  assert.equal(fx.style.transform, '');
  assert.equal(fy.style.transform, '');
  assert.equal(ball.style.transform, '');
  assert.equal(said.hidden, true);

  ctx.mock.timers.tick(460);
  assert.ok(has(tree, 'dip'));
  assert.ok(has(node, 'swing'));
  const glints = findAll(node, 'ornament-glint');
  assert.equal(glints.length, 3);
  assert.deepEqual(
    glints.map(g => [g.style.left, g.style.top, g.style.animationDelay]),
    [
      ['calc(50% - 14px)', 'calc(50% - 8px)', '0ms'],
      ['calc(50% + 14px)', 'calc(50% - 4px)', '70ms'],
      ['calc(50% + 2px)', 'calc(50% + 16px)', '140ms'],
    ],
  );
  assert.ok(!has(friend, 'hop'));

  ctx.mock.timers.tick(250);
  assert.ok(has(friend, 'hop'));
  assert.equal(said.hidden, false);
  assert.ok(list('decorating.cheer').includes(said.textContent));

  ctx.mock.timers.tick(610);
  for (const name of MOVING) assert.ok(!has(node, name), `no ${name}`);
  assert.ok(!has(tree, 'dip'));
  assert.ok(!has(friend, 'hop'));
  assert.equal(findAll(node, 'ornament-glint').length, 0);
  assert.equal(findAll(node, 'bauble-fly-x').length, 0, 'the wrappers are gone');
  assert.ok(
    kids(node).some(c => has(c, 'bauble-ball')),
    'the ball is the bauble’s own again',
  );
});

test('with reduced motion the bauble fades in where it hangs', async ctx => {
  const v = await decorating(ctx);
  reduced.matches = true;
  openDecorating();
  await v.chipFor('camellia').dispatch('click');
  await v.spots()[0].dispatch('click');
  await flush();
  const [node] = v.baubles(),
    tree = v.$('decorating-tree'),
    friend = v.$('decorating-friend'),
    said = v.$('decorating-bubble');
  const still = () => {
    for (const name of ['flying', 'swing', 'hanging']) assert.ok(!has(node, name), `no ${name}`);
    assert.ok(!has(tree, 'dip'));
    assert.ok(!has(friend, 'hop'));
    assert.equal(findAll(node, 'ornament-glint').length, 0);
    assert.equal(findAll(node, 'bauble-fly-x').length, 0);
  };
  assert.ok(has(node, 'appear'));
  still();
  ctx.mock.timers.tick(199);
  assert.equal(said.hidden, true);
  ctx.mock.timers.tick(1);
  assert.equal(said.hidden, false, 'the line at 200 ms');
  still();
  ctx.mock.timers.tick(1500);
  assert.ok(!has(node, 'appear'));
  still();
});

test('closing the view mid-hang leaves nothing moving', async ctx => {
  const v = await decorating(ctx);
  openDecorating();
  await v.chipFor('camellia').dispatch('click');
  await v.spots()[0].dispatch('click');
  await flush();
  state.setData({ ...state.data, garden: hung(state.data.garden, camellia(0)) });
  ctx.mock.timers.tick(300);
  assert.ok(has(v.baubles()[0], 'flying'));
  v.dialog.close();
  await v.dialog.dispatch('close');
  const tree = v.$('decorating-tree'),
    friend = v.$('decorating-friend');
  assert.ok(!has(tree, 'dip'));
  assert.ok(!has(friend, 'hop'));
  openDecorating();
  const [node] = v.baubles();
  assert.ok(node);
  for (const name of MOVING) assert.ok(!has(node, name), `no ${name}`);
  assert.equal(findAll(tree, 'ornament-glint').length, 0);
  ctx.mock.timers.tick(2000);
  assert.ok(!has(tree, 'dip'));
  assert.ok(!has(friend, 'hop'));
  assert.equal(v.$('decorating-bubble').hidden, true, 'no line for a hang the view no longer shows');
  for (const name of MOVING) assert.ok(!has(node, name), `no ${name} later`);
});

const uncommented = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
// The body of each block that opens at `{` after a matching head, braces balanced.
function blocks(css, head) {
  const found = [];
  for (const match of css.matchAll(head)) {
    let depth = 0,
      at = css.indexOf('{', match.index);
    const start = at;
    do {
      if (css[at] === '{') depth++;
      else if (css[at] === '}') depth--;
      at++;
    } while (depth && at < css.length);
    found.push({ head: match[0], body: css.slice(start + 1, at - 1) });
  }
  return found;
}

test('the hanging keyframes move only transform and opacity, never loop, and read no variables', async () => {
  const css = uncommented(await readFile('src/styles/dialog.css', 'utf8'));
  const frames = blocks(css, /@keyframes\s+ornament-[\w-]+/g);
  assert.ok(frames.length >= 4, 'the dip, the swing, the glint and the hop');
  for (const { head, body } of frames) {
    assert.ok(!body.includes('var('), `${head} reads no variable`);
    for (const [, property] of body.matchAll(/([\w-]+)\s*:/g))
      assert.ok(['transform', 'opacity'].includes(property), `${head} moves ${property}`);
  }
  for (const { head, body } of blocks(css, /(?<=^|[{}])[^{}@]*(?:ornament|decorating)[^{}]*(?=\{)/g))
    assert.ok(!/\binfinite\b/.test(body), `${head.trim()} never loops`);
});

test('every part of a hang is over before its classes come off', async () => {
  const css = uncommented(await readFile('src/styles/dialog.css', 'utf8'));
  const length = name => {
    const found = css.match(new RegExp(`animation:\\s*${name}\\s+(\\d+)ms`));
    assert.ok(found, `${name} has a length in ms`);
    return Number(found[1]);
  };
  // Begins at: the dip, the swing and the glints when the bauble lands, the last glint two steps
  // later, the hop with the friend's line.
  const ends = {
    'ornament-dip': ARC_MS + length('ornament-dip'),
    'ornament-swing': ARC_MS + length('ornament-swing'),
    'ornament-glint': ARC_MS + 2 * GLINT_STEP + length('ornament-glint'),
    'ornament-hop': CHEER_AT + length('ornament-hop'),
  };
  for (const [name, end] of Object.entries(ends)) assert.ok(end <= SETTLE_MS, `${name} ends at ${end}`);
  for (const wrapper of ['x', 'y'])
    assert.match(
      css,
      new RegExp(`\\.bauble-fly-${wrapper}\\s*\\{\\s*transition:\\s*transform ${ARC_MS}ms`),
      `the arc's ${wrapper} takes ARC_MS`,
    );
});
