// What hangs on the Christmas tree this December, and the small tinted baubles the yard draws on
// the small and the grand tree's own hooks (src/yard/ornaments.js).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import './support/content.mjs';

globalThis.playPets = {
  moveDecor: async () => ({ ok: true, data: null }),
  hideDecor: async () => ({ ok: true, data: null }),
  putAway: async () => ({ ok: true, data: null }),
};
const state = await import('../src/core/state.js');
const { t } = await import('../src/core/i18n.js');
const { artHref } = await import('../src/yard/art.js');
const { giftKind, treeKind } = await import('../src/yard/catalog.js');
const { renderDecor } = await import('../src/yard/decor.js');
const { christmasNightCheck, percent, setupChristmasNight } = await import('../src/yard/christmas-night.js');
const { drawTreeOrnaments, freeHooks, hangable, leftToday, ornamentLook, ornamentSeason, treeOrnaments } =
  await import('../src/yard/ornaments.js');
const { drawYard } = await import('./support/yard.mjs');

const ART = ['decor/xmas_tree.svg', 'decor/xmas_tree_grand.svg', 'decor/sleigh.svg'];
const TREE = { id: 'tree', kind: 'xmas_tree', x: 0.5, y: 0.6 };
const DAY = { world: 'woodland', event: 'lights', season: 'winter', period: 'day', weather: 'clear' };
const SNOWY_NIGHT = { ...DAY, period: 'night', weather: 'snow' };
const camellia = (hook = 0) => ({ book: 'flower', id: 'camellia', hook });
const pinecone = (hook = 11) => ({ book: 'treasure', id: 'pinecone', hook });

// The fake DOM answers one class per selector (support/dom.mjs), so these walk the children; a
// removed node stays in place, marked, and is left out.
const kids = node => node.children.filter(c => typeof c === 'object' && !c.removed);
const named = (node, name) => kids(node).filter(c => c.classList.contains(name));
function find(node, name) {
  for (const c of kids(node)) {
    if (c.classList.contains(name)) return c;
    const deeper = find(c, name);
    if (deeper) return deeper;
  }
  return null;
}

async function decorated(ctx, { now, scene = DAY, garden = {}, before } = {}) {
  const parts = await drawYard(ctx, {
    now: now.getTime(),
    scene,
    art: ART,
    garden: { decor: [TREE], received: ['xmas_tree'], ...garden },
    drawn: () => {
      christmasNightCheck();
      drawTreeOrnaments();
    },
    setup: () => setupChristmasNight(),
    before,
  });
  const tree = () => parts.shown().find(b => b.dataset.kind === 'xmas_tree');
  return { ...parts, tree };
}

test("a December's ornaments belong to that December until the next one", () => {
  assert.equal(ornamentSeason(new Date(2026, 11, 1)), 2026);
  assert.equal(ornamentSeason(new Date(2027, 0, 7)), 2026);
  assert.equal(ornamentSeason(new Date(2027, 10, 30)), 2026);
  assert.equal(ornamentSeason(new Date(2027, 11, 1)), 2027);
  const o = camellia();
  assert.deepEqual(treeOrnaments({ ornamentYear: 2026, ornaments: [o] }, new Date(2027, 0, 5)), [o]);
  assert.deepEqual(treeOrnaments({ ornamentYear: 2026, ornaments: [o] }, new Date(2027, 11, 1)), []);
  assert.deepEqual(treeOrnaments({}, new Date(2026, 11, 20)), [], 'an older save has none');
});

test('three a day, counted from today only', () => {
  const g = { ornamentYear: 2026, ornamentDay: { day: '2026-12-20', count: 2 }, ornaments: [] };
  assert.equal(leftToday(g, new Date(2026, 11, 20, 23), 3), 1);
  assert.equal(leftToday(g, new Date(2026, 11, 21, 0), 3), 3);
  assert.equal(leftToday({ ...g, ornamentYear: 2025 }, new Date(2026, 11, 20, 12), 3), 3);
  assert.equal(leftToday({ ...g, ornamentDay: { day: '2026-12-20', count: 5 } }, new Date(2026, 11, 20), 3), 0);
  assert.equal(leftToday({}, new Date(2026, 11, 20), 3), 3, 'an older save has hung none');
  const taken = { ...g, ornaments: [camellia(0), pinecone(5)] };
  assert.deepEqual(freeHooks(taken, new Date(2026, 11, 20), 12), [1, 2, 3, 4, 6, 7, 8, 9, 10, 11]);
});

// Last December's tree, seen on December 1: bare, every hook free, three to hang.
test('a new December starts with every hook free and three to hang', () => {
  const last = {
    ornamentYear: 2025,
    ornamentDay: { day: '2026-01-07', count: 3 },
    ornaments: [camellia(0), pinecone(5), { book: 'gift', id: 'bench', hook: 7 }],
  };
  const december = new Date(2026, 11, 1, 9);
  assert.deepEqual(freeHooks(last, december, 12), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(leftToday(last, december, 3), 3);
  assert.deepEqual(treeOrnaments(last, december), []);
});

test('what can hang is what was found, never fish, bugs, the tree itself or what already hangs', () => {
  const found = { count: 1 };
  const d = {
    album: {
      flowers: { camellia: found, gone: found },
      trees: { pine: found, maple: found },
      treasures: { pinecone: found },
      fish: { carp: found },
      bugs: { cabbage_white: found },
    },
    garden: {
      received: ['bench', 'xmas_tree'],
      ornaments: [{ book: 'tree', id: 'maple', hook: 0 }],
      ornamentYear: 2026,
    },
  };
  assert.deepEqual(hangable(d, new Date(2026, 11, 20)), [
    { book: 'flower', id: 'camellia' },
    { book: 'tree', id: 'pine' },
    { book: 'gift', id: 'bench' },
    { book: 'treasure', id: 'pinecone' },
  ]);
  assert.deepEqual(
    hangable(d, new Date(2027, 11, 2)).filter(o => o.book === 'tree'),
    [
      { book: 'tree', id: 'maple' },
      { book: 'tree', id: 'pine' },
    ],
    'next December the maple can hang again',
  );
  assert.deepEqual(hangable({}, new Date(2026, 11, 20)), [], 'nothing found yet');
});

test('a tree ornament wears its autumn drawing when it has one', () => {
  const maple = ornamentLook('tree', 'maple');
  assert.ok(maple.art.includes(artHref(treeKind('maple').seasonArt.autumn)));
  assert.equal(maple.name, t('tree.maple'));
  assert.equal(maple.book, t('album.trees'));
  const pine = treeKind('pine').stages.find(stage => stage.name === 'mature').art;
  assert.ok(ornamentLook('tree', 'pine').art.includes(artHref(pine)));
  assert.equal(ornamentLook('fish', 'carp'), null);
  assert.equal(ornamentLook('flower', 'gone'), null);
  const keepsake = ornamentLook('treasure', 'pinecone');
  assert.equal(keepsake.book, t('album.treasures'));
  assert.equal(keepsake.name, t('treasure.pinecone'));
  assert.equal(ornamentLook('gift', 'bench').name, t('decor.kind_bench'));
  assert.equal(ornamentLook('flower', 'camellia').book, t('catch.tab_flowers'));
});

test('the small tree wears its ornaments where its hooks are', async ctx => {
  const { tree } = await decorated(ctx, {
    now: new Date(2026, 11, 20, 12),
    garden: { ornaments: [camellia(0), pinecone(11)], ornamentYear: 2026 },
  });
  const button = tree(),
    [layer] = named(button, 'ornaments'),
    { hooks } = giftKind('xmas_tree');
  assert.ok(layer, 'a layer of its own in the tree button');
  assert.equal(named(button, 'ornaments').length, 1);
  // Over the drawing: the drawing is the button's first markup (innerHTML), and the layer is
  // added after it, so nothing drawn later covers the baubles.
  assert.ok(button.innerHTML.includes('<svg'));
  assert.ok(
    !kids(button)
      .slice(kids(button).indexOf(layer))
      .some(c => c.localName === 'svg'),
  );
  assert.equal(layer.getAttribute('aria-hidden'), 'true');
  const baubles = named(layer, 'bauble');
  assert.equal(baubles.length, 2);
  assert.ok(baubles[0].classList.contains('flower'));
  assert.ok(baubles[1].classList.contains('treasure'));
  assert.equal(baubles[0].style.left, percent(hooks[0][0]));
  assert.equal(baubles[0].style.top, percent(hooks[0][1]));
  assert.equal(baubles[1].style.left, percent(hooks[11][0]));
  assert.equal(baubles[1].style.top, percent(hooks[11][1]));
  for (const b of baubles) {
    const [ball] = named(b, 'bauble-ball');
    assert.equal(kids(ball).length, 0, 'tint, rim and shine only: no art at this size');
    assert.ok(!ball.innerHTML);
  }
  assert.equal(find(button, 'xmas-night'), null, 'no grand tree by day');
});

test('the grand tree wears the same ornaments on its own hooks', async ctx => {
  const { tree } = await decorated(ctx, {
    now: new Date(2026, 11, 20, 21),
    scene: SNOWY_NIGHT,
    garden: { ornaments: [camellia(0), pinecone(11)], ornamentYear: 2026 },
    before: ({ storage }) => storage.setItem('xmas-night', '2026-12-20'),
  });
  const button = tree(),
    art = find(button, 'xmas-art'),
    { hooks } = giftKind('xmas_tree').night;
  assert.ok(button.classList.contains('xmas-grand'));
  const [layer] = named(art, 'ornaments');
  assert.ok(layer, 'inside the grand drawing, after it');
  assert.ok(art.innerHTML.includes('<svg'));
  const baubles = named(layer, 'bauble');
  assert.equal(baubles.length, 2);
  assert.equal(baubles[0].style.left, percent(hooks[0][0]));
  assert.equal(baubles[0].style.top, percent(hooks[0][1]));
  assert.equal(baubles[1].style.left, percent(hooks[11][0]));
  assert.equal(baubles[1].style.top, percent(hooks[11][1]));
  assert.equal(named(named(button, 'ornaments')[0], 'bauble').length, 2, 'the small tree keeps its own');
  christmasNightCheck();
  renderDecor();
  assert.equal(named(find(button, 'xmas-night'), 'xmas-hit').length, 1);
  assert.equal(named(art, 'ornaments').length, 1);
});

test("last December's ornaments are not drawn from December 1", async ctx => {
  const { tree } = await decorated(ctx, {
    now: new Date(2026, 11, 1, 12),
    garden: { ornaments: [camellia(0), pinecone(11)], ornamentYear: 2025 },
  });
  const [layer] = named(tree(), 'ornaments');
  assert.equal(kids(layer).length, 0);
});

test('the ornaments are drawn again only when they change', async ctx => {
  const { tree } = await decorated(ctx, {
    now: new Date(2026, 11, 20, 12),
    garden: { ornaments: [camellia(0), pinecone(11)], ornamentYear: 2026 },
  });
  const button = tree(),
    [layer] = named(button, 'ornaments'),
    [first] = named(layer, 'bauble');
  renderDecor();
  renderDecor();
  assert.equal(named(button, 'ornaments')[0], layer);
  assert.equal(named(layer, 'bauble')[0], first);
  const garden = state.data.garden;
  state.setData({
    ...state.data,
    garden: { ...garden, ornaments: [...garden.ornaments, { book: 'gift', id: 'bench', hook: 4 }] },
  });
  renderDecor();
  assert.equal(named(button, 'ornaments')[0], layer);
  assert.equal(named(layer, 'bauble').length, 3);
});

test('an ornament the catalogue does not know is left undrawn', async ctx => {
  const { tree } = await decorated(ctx, {
    now: new Date(2026, 11, 20, 12),
    garden: {
      ornaments: [{ book: 'flower', id: 'gone', hook: 2 }, camellia(0), { book: 'fish', id: 'carp', hook: 3 }],
      ornamentYear: 2026,
    },
  });
  const [layer] = named(tree(), 'ornaments');
  assert.equal(named(layer, 'bauble').length, 1);
  assert.ok(named(layer, 'bauble')[0].classList.contains('flower'));
});

test('a hook past the tree is left undrawn', async ctx => {
  const { tree } = await decorated(ctx, {
    now: new Date(2026, 11, 20, 12),
    garden: { ornaments: [{ ...camellia(12) }, pinecone(-1), pinecone(1.5)], ornamentYear: 2026 },
  });
  const [layer] = named(tree(), 'ornaments');
  assert.equal(named(layer, 'bauble').length, 0);
});

// garden.css rules as selector lists and declarations; nested blocks (@media, keyframes) give
// entries no test asks for.
async function styles() {
  const css = (await readFile('src/styles/garden.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, head, body]) => ({
    selectors: head.split(',').map(s => s.trim()),
    props: Object.fromEntries(
      body
        .split(';')
        .map(d => d.split(/:(.*)/s).map(s => s.trim()))
        .filter(([name, value]) => name && value),
    ),
  }));
}
const declared = (rules, selector, prop) =>
  rules.filter(r => r.selectors.includes(selector) && prop in r.props).at(-1)?.props[prop];

test('the baubles follow their tree: scaled from its foot, faded as it turns grand and dimmed at night', async () => {
  const rules = await styles();
  for (const state of [':hover', ':focus-visible', '.dragging']) {
    const grows = declared(rules, `.decor${state} svg`, 'transform');
    assert.ok(grows, `the drawing grows on ${state}`);
    assert.equal(declared(rules, `.decor${state} > .ornaments`, 'transform'), grows, `small, ${state}`);
    assert.equal(declared(rules, `.decor${state} .xmas-art .ornaments`, 'transform'), grows, `grand, ${state}`);
  }
  assert.equal(
    declared(rules, '.decor svg', 'transform-origin'),
    declared(rules, '.decor .ornaments', 'transform-origin'),
  );
  assert.equal(
    declared(rules, '.decor.xmas-rise > .ornaments', 'animation'),
    declared(rules, '.decor.xmas-rise > svg', 'animation'),
  );
  assert.equal(
    declared(rules, '.decor.xmas-grand > .ornaments', 'opacity'),
    declared(rules, '.decor.xmas-grand > svg', 'opacity'),
  );
  assert.equal(
    declared(rules, '.period-night .decor > .ornaments', 'filter'),
    declared(rules, '.period-night .decor svg', 'filter'),
  );
  assert.equal(
    declared(rules, '.period-night .decor .xmas-art .ornaments', 'filter'),
    declared(rules, '.period-night .decor .xmas-art svg', 'filter'),
  );
});
