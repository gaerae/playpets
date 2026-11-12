// The Spring shoots book in the album (src/panel/album.js): eight cards, the ones gathered named,
// the rest silhouettes that say the season, counted with the other books.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { t as translate } from '../src/core/i18n.js';
import { SHOOTS } from '../src/yard/catalog.js';
import { albumEntries } from './support/content.mjs';
import { installDom } from './support/dom.mjs';

// The backend's gatherShoot, as the tests answer it (state.js reads the bridge when it first loads).
const gathered = [];
let answer = () => ({ ok: true, data: { entry: { count: 1 }, first: true } });
globalThis.playPets = {
  gatherShoot: async kind => {
    gathered.push(kind);
    return answer(kind);
  },
};
const state = await import('../src/core/state.js');
const { setData } = state;
const { setupAlbum } = await import('../src/panel/album.js');

test('the Spring shoots book shows each shoot, its name and the season', t => {
  const before = state.data;
  t.after(() => setData(before));
  installDom(t, { anyId: true });
  document.querySelectorAll = () => document.getElementById('album-tabs').children;
  setupAlbum();
  const tabs = document.getElementById('album-tabs').children;
  const tab = tabs.find(item => item.dataset.book === 'shoot');
  assert.ok(tab, 'the shoots have their own book');
  assert.equal(tab.children[0].textContent, translate('album.shoots'));
  document.getElementById('album-dialog').open = true;
  document.querySelector = selector => {
    const id = selector.match(/data-count="(.*?)"/)?.[1];
    return tabs.find(item => item.dataset.book === id)?.children[1];
  };
  setData({ ...before, album: { shoots: { morel: { count: 2, best: 0, first: 1 } } } });
  tab.onclick();
  const cards = document.getElementById('album-grid').children;
  assert.equal(cards.length, 8);
  assert.equal(SHOOTS.length, 8);
  const hint = translate('shoot.hint', { season: translate('catch.season_spring') });
  for (const [index, card] of cards.entries()) {
    const found = SHOOTS[index].id === 'morel';
    assert.equal(card.className.includes('unknown'), !found, SHOOTS[index].id);
    if (!found) assert.equal(card.children[1].textContent, translate('catch.unknown'), SHOOTS[index].id);
    assert.equal(card.children[2].textContent, hint);
  }
  const morel = cards[7];
  assert.equal(SHOOTS[7].id, 'morel');
  assert.equal(morel.children[1].textContent, translate('shoot.morel'));
  assert.equal(morel.children.at(-1).textContent, translate('shoot.count', { count: 2 }));
  assert.equal(tab.children[1].textContent, '1/8');
  assert.equal(
    document.getElementById('album-total').textContent,
    translate('catch.total', { caught: 1, total: albumEntries }),
  );
});

// Shoots in the spring yard (src/yard/shoots.js): one on a fair morning, a few after rain, kept in
// the webview's storage, shown only while the yard shows spring outdoors, gone where the ground is
// taken and after six hours. The clock, the random draws and the scene are the test's.
const { readFile } = await import('node:fs/promises');
const { recall } = state;
const { artHref } = await import('../src/yard/art.js');
const { depthAt, EDGE, fieldToYard, geometry, measureYard, sizeOf } = await import('../src/yard/field.js');
const { behind, groundAllows } = await import('../src/yard/discovery-rules.js');
const { groundProfile } = await import('../src/yard/ground.js');
const { clearRainbowEnd, placeRainbowEnd } = await import('../src/yard/rainbow-end.js');
const { SHOOT_APART, SHOOT_STAYS_MS } = await import('../src/yard/shoot-rules.js');
const { renderShoots, setupShoots, shootsMinute } = await import('../src/yard/shoots.js');
const { scene } = await import('../src/yard/world.js');
const { drawYard } = await import('./support/yard.mjs');

const MORNING = new Date(2027, 3, 5, 8, 30).getTime();
// Math.random as the test says: these values first, then a fixed walk through the unit range.
function draws(ctx, ...first) {
  let s = 7;
  ctx.mock.method(Math, 'random', () => (first.length ? first.shift() : (s = (s * 16807) % 2147483647) / 2147483647));
}
async function springYard(ctx, { now = MORNING, scene: values = {}, garden = {}, stored = null, rng = [] } = {}) {
  draws(ctx, ...rng);
  const yard = await drawYard(ctx, {
    now,
    scene: { season: 'spring', world: 'woodland', weather: 'clear', period: 'morning', ...values },
    garden,
    before: ({ storage }) => {
      if (stored) storage.setItem('shoots', stored);
    },
  });
  setupShoots();
  const live = () => yard.shown().filter(b => b.classList.contains('shoot'));
  const saved = () => JSON.parse(recall('shoots'));
  return { ...yard, live, saved };
}
const record = (out, extra = {}) => JSON.stringify({ morning: '2027-04-05', rainAt: 0, out, ...extra });
const standing = (id, kind, x, y, extra = {}) => ({ id, kind, world: 'woodland', x, y, at: MORNING - 1000, ...extra });

test('one shoot comes up on a fair morning', async ctx => {
  const y = await springYard(ctx);
  shootsMinute();
  const [button, ...more] = y.live();
  assert.equal(more.length, 0);
  const [shoot] = y.saved().out;
  assert.equal(y.saved().morning, '2027-04-05');
  assert.equal(shoot.world, 'woodland');
  assert.equal(shoot.at, MORNING);
  assert.equal(shoot.id, `${MORNING}-0`);
  assert.equal(button.dataset.kind, shoot.kind);
  assert.equal(button.title, translate('shoot.title'));
  assert.equal(button.getAttribute('aria-label'), translate('shoot.title'));
  const [svg] = button.children;
  assert.equal(svg.getAttribute('aria-hidden'), 'true');
  assert.equal(svg.children[0].getAttribute('href'), artHref(SHOOTS.find(s => s.id === shoot.kind).art));
  // Ordered by where it comes up, on the scale friends, plants and gifts share.
  assert.equal(button.style.zIndex, String(depthAt(fieldToYard(shoot).y)));
  assert.ok(button.classList.contains('sprouted'), 'it rises as it comes');
  shootsMinute();
  assert.equal(y.live().length, 1);
  assert.equal(y.saved().out.length, 1);
});

test('a restart the same morning brings no second shoot', async ctx => {
  const y = await springYard(ctx);
  shootsMinute();
  const [first] = y.live();
  const kept = y.saved();
  setupShoots();
  shootsMinute();
  const [again, ...more] = y.live();
  assert.equal(more.length, 0);
  assert.notEqual(again, first, 'drawn anew after the restart');
  assert.deepEqual(y.saved(), kept);
  assert.equal(again.dataset.kind, first.dataset.kind);
  assert.equal(again.style.transform, first.style.transform, 'at the same place');
  assert.ok(!again.classList.contains('sprouted'), 'a shoot brought back does not rise again');
});

test('after rain a few come up, never more than three', async ctx => {
  const y = await springYard(ctx, { scene: { weather: 'rain', period: 'day' }, rng: [0.8] });
  shootsMinute();
  assert.equal(y.live().length, 0);
  scene.weather = 'clear';
  shootsMinute();
  assert.equal(y.live().length, 3);
  assert.ok(y.live().every(b => b.classList.contains('sprouted')));
  const { rainAt, out } = y.saved();
  assert.equal(rainAt, MORNING);
  assert.equal(new Set(out.map(s => s.kind)).size, 3);
  for (const [i, a] of out.entries())
    for (const b of out.slice(i + 1)) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= SHOOT_APART);
  ctx.mock.timers.tick(3600_000);
  scene.weather = 'rain';
  shootsMinute();
  scene.weather = 'clear';
  shootsMinute();
  assert.equal(y.live().length, 3);
  assert.equal(y.saved().rainAt, MORNING, 'a second rain within three hours brings none');
});

test('shoots show only while the yard shows spring outdoors', async ctx => {
  const y = await springYard(ctx, {
    scene: { period: 'day' },
    stored: record([standing('a', 'morel', 0.2, 0.5), standing('b', 'mugwort', 0.25, 0.8)]),
  });
  shootsMinute();
  assert.equal(y.live().length, 2);
  scene.season = 'summer';
  shootsMinute();
  assert.equal(y.live().length, 0);
  assert.equal(y.saved().out.length, 2, 'kept while out of sight');
  scene.season = 'spring';
  shootsMinute();
  assert.equal(y.live().length, 2);
  assert.ok(
    y.live().every(b => !b.classList.contains('sprouted')),
    'back in spring they are simply there',
  );
  scene.world = 'workshop';
  shootsMinute();
  assert.equal(y.live().length, 0);
  assert.equal(y.saved().out.length, 2);
});

test('outside shoot time the shoots build no ground to draw on', async ctx => {
  const y = await springYard(ctx, { scene: { period: 'day' }, stored: record([standing('a', 'morel', 0.2, 0.5)]) });
  shootsMinute();
  assert.equal(y.live().length, 1);
  // The ground is built from the garden's trees: a read of them is a ground built.
  let built = 0;
  const trees = state.data.garden.trees;
  Object.defineProperty(state.data.garden, 'trees', {
    configurable: true,
    get() {
      built++;
      return trees;
    },
  });
  scene.season = 'summer';
  renderShoots();
  assert.equal(y.live().length, 0);
  assert.equal(built, 0, 'a summer yard draws no shoots and measures no ground for them');
  scene.season = 'spring';
  renderShoots();
  assert.equal(y.live().length, 1);
  assert.ok(built > 0);
});

test('a shoot whose ground is taken is gone at once, and from storage at the next minute', async ctx => {
  const y = await springYard(ctx, { scene: { period: 'day' }, stored: record([standing('a', 'morel', 0.2, 0.6)]) });
  shootsMinute();
  assert.equal(y.live().length, 1);
  state.data.garden.decor.push({ id: 'bench', kind: 'bench', x: 0.2, y: 0.6 });
  renderShoots();
  assert.equal(y.live().length, 0, 'not drawn on the bench');
  assert.equal(y.saved().out.length, 1);
  shootsMinute();
  assert.equal(y.live().length, 0);
  assert.equal(y.saved().out.length, 0);
});

// The window sets how big the ground's things are on the field: a shoot their feet take in the mini
// window is hidden there, not lost; only a change in the garden takes its ground for good.
test('a smaller window hides a shoot beside a gift but keeps it', async ctx => {
  const beside = { x: 0.42, y: 0.74 },
    open = { x: 0.2, y: 0.5 };
  const y = await springYard(ctx, {
    scene: { period: 'day' },
    garden: { decor: [{ id: 'bench', kind: 'bench', x: 0.5, y: 0.6 }] },
    stored: record([standing('a', 'morel', beside.x, beside.y), standing('b', 'mugwort', open.x, open.y)]),
  });
  const size = (width, height) => {
    y.nodes.get('yard').getBoundingClientRect = () => ({ left: 0, top: 0, width, height });
    measureYard();
  };
  const taken = p => !groundAllows(p, groundProfile()) || behind(p, groundProfile());
  assert.ok(!taken(beside), 'free beside the bench in the wide window');
  size(460, 320);
  assert.ok(taken(beside), "the bench's feet reach it in the mini window");
  // The app may start in the mini window: its first look drops nothing.
  shootsMinute();
  shootsMinute();
  assert.deepEqual(
    y.live().map(b => b.dataset.kind),
    ['mugwort'],
  );
  assert.equal(y.saved().out.length, 2, 'hidden, not lost');
  size(800, 560);
  shootsMinute();
  assert.equal(y.live().length, 2, 'back when the window is wide again');
  size(460, 320);
  shootsMinute();
  shootsMinute();
  assert.equal(y.saved().out.length, 2);
  // A seed planted on the other shoot is a change in the garden: that one goes, the hidden one stays.
  state.data.garden.plants.push({ id: 'p1', kind: 'tulip', x: open.x, y: open.y, planted: MORNING });
  shootsMinute();
  assert.deepEqual(
    y.saved().out.map(s => s.id),
    ['a'],
  );
  size(800, 560);
  shootsMinute();
  assert.deepEqual(
    y.live().map(b => b.dataset.kind),
    ['morel'],
  );
});

test("a shoot inside a grown tree's drawing is not drawn there, where the tree would take its click", async ctx => {
  const inside = { x: 0.45, y: 0.5 };
  const y = await springYard(ctx, {
    scene: { period: 'day' },
    garden: { trees: [{ id: 'c', world: 'woodland', kind: 'cherry', x: 0.5, y: 0.9, planted: MORNING - 86_400_000 }] },
    stored: record([standing('a', 'morel', inside.x, inside.y), standing('b', 'mugwort', 0.2, 0.5)]),
  });
  const ground = groundProfile();
  assert.ok(groundAllows(inside, ground) && !behind(inside, ground), 'clear of its feet');
  shootsMinute();
  assert.deepEqual(
    y.live().map(b => b.dataset.kind),
    ['mugwort'],
  );
});

test('a shoot goes six hours after it came up', async ctx => {
  const y = await springYard(ctx);
  shootsMinute();
  assert.equal(y.live().length, 1);
  ctx.mock.timers.tick(SHOOT_STAYS_MS);
  shootsMinute();
  assert.equal(y.live().length, 0);
  assert.equal(y.saved().out.length, 0);
});

test('a look at the yard before the shoots are read neither sprouts nor writes', async ctx => {
  const stored = record([standing('a', 'morel', 0.2, 0.5)], { morning: '2027-04-04' });
  const y = await springYard(ctx, { stored });
  // A second copy of the module, as the app has it before setupShoots runs.
  const early = await import('../src/yard/shoots.js?before-setup');
  early.shootsMinute();
  assert.equal(recall('shoots'), stored);
  assert.equal(y.live().length, 0);
});

test('an unmeasured yard keeps the shoots it cannot see', async ctx => {
  const y = await springYard(ctx, { scene: { period: 'day' }, stored: record([standing('a', 'morel', 0.2, 0.5)]) });
  y.nodes.get('yard').getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
  measureYard();
  shootsMinute();
  assert.equal(y.live().length, 0);
  assert.equal(y.saved().out.length, 1, 'no ground to see is not ground taken');
  y.nodes.get('yard').getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 560 });
  measureYard();
  shootsMinute();
  assert.equal(y.live().length, 1);
});

test('rain counts only when it was the last weather seen', async ctx => {
  const y = await springYard(ctx, { scene: { season: 'summer', weather: 'rain', period: 'day' }, rng: [0.8] });
  shootsMinute();
  scene.weather = 'clear';
  shootsMinute();
  scene.season = 'spring';
  shootsMinute();
  assert.equal(y.live().length, 0, 'the clear summer sky was seen after the rain');
  scene.season = 'summer';
  scene.weather = 'rain';
  shootsMinute();
  scene.season = 'spring';
  scene.weather = 'clear';
  shootsMinute();
  assert.equal(y.live().length, 3, 'rain seen last, then a clear spring yard');
});

test("a shoot keeps clear of the rainbow's end", async ctx => {
  ctx.after(clearRainbowEnd);
  // Each time: the kind, then the first spot drawn (0.196, 0.75), then the second (0.196, 0.54).
  const y = await springYard(ctx, { rng: [0, 0.1, 0.75, 0, 0.1, 0.75, 0.1, 0.4] });
  shootsMinute();
  assert.ok(Math.abs(y.saved().out[0].y - 0.75) < 1e-9, 'without a rainbow the first spot is taken');
  y.storage.removeItem('shoots');
  setupShoots();
  const open = { soil: true, bounds: { left: 0, top: 0, right: 1, bottom: 1 }, water: [], obstacles: [] },
    end = [(0.196 - 0.15) / 0.7, (0.75 - 0.2) / 0.6];
  placeRainbowEnd(MORNING + 60_000, { ground: open, rng: () => end.shift() });
  shootsMinute();
  const [shoot] = y.saved().out;
  assert.ok(Math.abs(shoot.y - 0.54) < 1e-9, 'the spot at the rainbow end is passed over');
});

test('the yard wires the shoots in before the sky first paints, and draws them with the rest', async () => {
  const app = await readFile('src/app.js', 'utf8'),
    render = await readFile('src/render.js', 'utf8');
  const setup = app.search(/^setupShoots\(\);/m),
    sky = app.search(/^setupSky\(/m);
  assert.ok(setup >= 0 && setup < sky, 'setupShoots runs before setupSky paints');
  const minute = app.indexOf('shootsMinute();'),
    shown = app.indexOf('refreshShownDecor();');
  assert.ok(minute > shown && minute < app.indexOf('seasonPicked'), 'each repaint looks at the shoots');
  for (const hook of ['worldChanged', 'landChanged', 'resized']) {
    const from = app.indexOf(`${hook}:`),
      body = app.slice(from, app.indexOf('},', app.indexOf('renderDecor();', from)) + 2);
    assert.ok(body.indexOf('renderShoots();') > body.indexOf('renderDecor();'), hook);
    // A new size or land ends a dig under way, as it ends a dig for treasure.
    if (hook !== 'worldChanged')
      assert.ok(body.indexOf('cancelShootDigs();') > body.indexOf('cancelDiscoveryWork();'), hook);
  }
  assert.ok(render.indexOf('renderShoots();') > render.indexOf('renderTrees();'), 'a state change redraws them');
});

test('a shoot rises once, stays still for reduced motion, and lets a tool or a game through', async () => {
  const css = (await readFile('src/styles/garden.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  assert.match(css, /\.shoot\.sprouted svg \{[^}]*animation: shoot-up /);
  const frames = css.match(/@keyframes shoot-up \{(.*?\}) \}/)?.[1] || '';
  assert.match(frames, /scale\(0\.6, 0\.2\)/);
  assert.doesNotMatch(frames, /var\(/);
  for (const [, property] of frames.matchAll(/([a-z-]+):/g))
    assert.ok(['transform', 'opacity'].includes(property), property);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.shoot\.sprouted svg \{ animation: none; \}/);
  assert.match(css, /\.yard\.aiming \.shoot, \.yard\.playing \.shoot \{ pointer-events: none; \}/);
});

// Clicking a shoot (src/yard/shoots.js gatherShoot): a friend walks over, digs it up as for a
// treasure, and the album keeps it. The friend is drawn as views.js has it; its trip's end is run
// by the test, as the frame loop runs it when the friend gets there.
const { element } = await import('./support/dom.mjs');
const { list } = await import('../src/core/i18n.js');
const { artSvg } = await import('../src/yard/art.js');
const { setupCard } = await import('../src/yard/card.js');
const { release } = await import('../src/yard/trips.js');
const { cancelShootDigs, gatherShoot, shootDigging } = await import('../src/yard/shoots.js');

const flush = () => new Promise(resolve => setImmediate(resolve));
async function digYard(ctx, { friend = true } = {}) {
  gathered.length = 0;
  answer = () => ({ ok: true, data: { entry: { count: 1 }, first: true } });
  const y = await springYard(ctx, { scene: { period: 'day' }, stored: record([standing('m', 'morel', 0.3, 0.6)]) });
  // The card's parts, kept so the test can read what it says.
  const card = y.document.getElementById('catch-card'),
    parts = new Map();
  card.hidden = true;
  card.querySelector = selector => parts.get(selector) ?? parts.set(selector, element()).get(selector);
  const opened = [];
  setupCard({ openAlbum: book => opened.push(book) });
  shootsMinute();
  const pet = { id: 'clover', size: 112, name: 'Clover' },
    v = { pet, px: 120, py: 300, x: 0.1, y: 0.5, pose: 'idle', bubble: element('span') };
  if (friend) {
    state.views.set(pet.id, v);
    state.setSelected(pet.id);
  }
  ctx.after(() => {
    release(v);
    state.views.clear();
    state.setSelected(null);
    state.setGame(null);
    state.setAiming(false);
  });
  const [button] = y.live();
  return {
    ...y,
    v,
    button,
    card,
    parts,
    opened,
    click: (init = {}) => button.dispatch('click', init),
    // The friend gets where it was sent: its trip is let go of, then its end runs.
    async arrive() {
      const { trip } = v;
      v.target = null;
      v.trip = null;
      await trip.arrive(v, 0);
    },
    effect: () => y.nodes.get('garden-layer').children.find(n => !n.removed && n.classList.contains('dig-effect')),
    said: () => y.document.getElementById('toast').children.map(line => line.textContent),
  };
}

test('clicking a shoot sends a friend to dig it up and keeps it in the album', async ctx => {
  const y = await digYard(ctx);
  await y.click();
  assert.ok(y.v.target, 'the friend sets off');
  assert.ok(y.button.classList.contains('picking'));
  assert.equal(shootDigging(), true);
  // With no clip of its own the friend stands beside the shoot, so the shovel and the soil show.
  const { w } = geometry(y.v.pet),
    foot = EDGE + y.v.target.x * w + sizeOf(y.v.pet) / 2,
    at = fieldToYard({ x: 0.3, y: 0.6 }).x;
  assert.ok(Math.abs(foot - at) >= 0.25 * sizeOf(y.v.pet), `feet at ${foot}, shoot at ${at}`);
  await y.arrive();
  const effect = y.effect();
  assert.ok(effect, 'it digs where the shoot is');
  assert.match(effect.innerHTML, /dig-soil/);
  assert.ok(
    effect.innerHTML.includes(artHref('discovery/shovel.svg')),
    'a friend with no tool of its own has a shovel',
  );
  ctx.mock.timers.tick(1949);
  await flush();
  assert.deepEqual(gathered, []);
  ctx.mock.timers.tick(1);
  await flush();
  assert.deepEqual(gathered, ['morel']);
  assert.equal(y.live().length, 0);
  assert.deepEqual(y.saved().out, []);
  assert.equal(y.parts.get('strong').textContent, translate('shoot.morel'));
  assert.equal(y.parts.get('small').textContent, '', 'a first find says so on its own line');
  assert.ok(y.card.innerHTML.includes(artSvg(SHOOTS.find(s => s.id === 'morel').art)), "the album's drawing");
  await y.card.children.find(child => child.className === 'catch-album').onclick({ stopPropagation() {} });
  assert.deepEqual(y.opened, ['shoot']);
  assert.ok(list('shoot.found').includes(y.v.bubble.textContent), y.v.bubble.textContent);
  assert.equal(effect.removed, true);
  assert.equal(y.v.doing, null);
  assert.equal(shootDigging(), false);
});

test('a second click while a friend is on the way sends no one', async ctx => {
  const y = await digYard(ctx);
  await y.click();
  const trip = y.v.trip;
  await y.click();
  assert.equal(y.v.trip, trip, 'the same trip');
  assert.equal(gatherShoot('m'), false);
  await y.arrive();
  ctx.mock.timers.tick(1950);
  await flush();
  assert.deepEqual(gathered, ['morel']);
});

test('a friend taken away leaves the shoot for another time', async ctx => {
  const y = await digYard(ctx);
  await y.click();
  const trip = y.v.trip;
  release(y.v);
  assert.ok(!y.button.classList.contains('picking'));
  assert.equal(shootDigging(), false);
  await trip.arrive(y.v, 0);
  ctx.mock.timers.tick(1950);
  await flush();
  assert.deepEqual(gathered, []);
  assert.equal(y.effect(), undefined);
  assert.equal(y.saved().out.length, 1);
  await y.click();
  assert.ok(y.v.target, 'a click again sends the friend again');
  assert.ok(y.button.classList.contains('picking'));
});

test('a friend taken away while digging records nothing', async ctx => {
  const y = await digYard(ctx);
  await y.click();
  await y.arrive();
  const effect = y.effect();
  ctx.mock.timers.tick(1000);
  release(y.v);
  ctx.mock.timers.tick(950);
  await flush();
  assert.deepEqual(gathered, []);
  assert.equal(effect.removed, true);
  assert.equal(y.v.doing, null);
  assert.ok(!y.button.classList.contains('picking'));
  assert.equal(y.live().length, 1);
  assert.equal(y.saved().out.length, 1);
});

test('a dig that ends in another place records nothing', async ctx => {
  const y = await digYard(ctx);
  await y.click();
  await y.arrive();
  scene.world = 'workshop';
  ctx.mock.timers.tick(1950);
  await flush();
  assert.deepEqual(gathered, []);
  assert.equal(y.v.doing, null, 'the friend is let go');
  assert.equal(shootDigging(), false);
  assert.equal(y.saved().out.length, 1);
});

test('a new window size or land ends a dig and leaves the shoot', async ctx => {
  const y = await digYard(ctx);
  await y.click();
  await y.arrive();
  const effect = y.effect();
  cancelShootDigs();
  assert.equal(effect.removed, true);
  assert.equal(y.v.doing, null, 'the friend is let go');
  assert.ok(!y.button.classList.contains('picking'));
  assert.equal(shootDigging(), false);
  ctx.mock.timers.tick(1950);
  await flush();
  assert.deepEqual(gathered, []);
  assert.equal(y.live().length, 1);
  assert.equal(y.saved().out.length, 1);
  await y.click();
  assert.ok(y.v.target);
  cancelShootDigs();
  assert.equal(y.v.target, null, 'a friend on the way stops too');
  assert.equal(shootDigging(), false);
});

test('a shoot whose album call is still out is not gathered twice', async ctx => {
  const y = await digYard(ctx);
  let settle;
  answer = () => new Promise(resolve => (settle = resolve));
  await y.click();
  await y.arrive();
  ctx.mock.timers.tick(1950);
  await flush();
  assert.deepEqual(gathered, ['morel']);
  // Taken away while the album keeps it: the friend is free, the shoot is still being gathered.
  release(y.v);
  assert.equal(y.v.doing, null);
  assert.equal(shootDigging(), true);
  assert.ok(y.button.classList.contains('picking'));
  await y.click();
  assert.equal(y.v.target, null, 'no friend sets off for it again');
  assert.equal(gatherShoot('m'), false);
  settle({ ok: true, data: { entry: { count: 1 }, first: true } });
  await flush();
  assert.deepEqual(gathered, ['morel']);
  assert.deepEqual(y.saved().out, []);
  assert.equal(shootDigging(), false);
});

test("a friend's old trip to a shoot leaves its new work alone", async ctx => {
  const y = await digYard(ctx);
  await y.click();
  const trip = y.v.trip;
  release(y.v);
  // Another task holds the friend still where it works (work.js holdAtWork), then the old trip's
  // end comes late.
  Object.assign(y.v, { pose: 'idle', until: Infinity });
  await trip.arrive(y.v, 0);
  assert.equal(y.v.until, Infinity, 'its work pose is kept');
});

test('no friend or every friend busy says so', async ctx => {
  const y = await digYard(ctx, { friend: false });
  await y.click();
  assert.deepEqual(y.said(), [translate('shoot.no_friend')]);
  state.views.set(y.v.pet.id, y.v);
  y.v.doing = { end() {} };
  await y.click();
  assert.equal(y.v.target, undefined);
  assert.ok(y.said().includes(translate('catch.busy')));
  assert.ok(!y.button.classList.contains('picking'));
});

test('a friend viewing the blossom goes when no one else is free, and leaves the gathering', async ctx => {
  const y = await digYard(ctx);
  let left = false;
  Object.assign(y.v, { away: true, gathered: true, doing: { end: () => (left = true) } });
  await y.click();
  assert.ok(y.v.target);
  assert.equal(left, true);
});

test("with a tool in hand or in a game the click is the yard's", async ctx => {
  const y = await digYard(ctx);
  let stopped = false;
  const stopPropagation = () => (stopped = true);
  state.setAiming('seed');
  await y.click({ stopPropagation });
  state.setAiming(false);
  state.setGame({ kind: 'hide', ids: [], hint: '', timers: new Set() });
  await y.click({ stopPropagation });
  assert.equal(y.v.target, undefined);
  assert.equal(stopped, false);
  assert.deepEqual(y.said(), []);
});

test('the shoot stays when the album cannot keep it', async ctx => {
  const y = await digYard(ctx);
  answer = () => Promise.reject(new Error('refused'));
  await y.click();
  await y.arrive();
  ctx.mock.timers.tick(1950);
  await flush();
  assert.deepEqual(gathered, ['morel']);
  assert.equal(y.live().length, 1);
  assert.equal(y.saved().out.length, 1);
  assert.ok(!y.button.classList.contains('picking'));
  assert.equal(y.v.doing, null);
  assert.equal(y.said().length, 1, 'the error is said');
  await y.click();
  assert.ok(y.v.target, 'and it can be clicked again');
});

test('a shoot being dug looks taken, stands out from the grass, and dims at night as the flowers do', async () => {
  const css = (await readFile('src/styles/garden.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  assert.match(css, /\.shoot\.picking \{ cursor: default; \}/);
  assert.match(css, /\.shoot\.picking svg \{ opacity: 0\.7; transition: opacity 0\.3s; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.shoot\.picking svg \{ transition: none; \}/);
  assert.match(css, /\.period-night \.plant svg \{ filter: url\(#night-tint\); \}/);
  // Green shoots on green grass: a soft shade of soil under the foot and a shadow to the lower right
  // (the light comes from the upper left), both still, and the night's dimming on top.
  const soil = css.match(/\.shoot::before \{([^}]*)\}/)?.[1] || '';
  assert.match(soil, /radial-gradient/);
  assert.doesNotMatch(soil, /animation|transition/);
  assert.match(css, /\.shoot \{[^}]*--shoot-lift: drop-shadow\(/);
  assert.match(css, /\.shoot svg \{[^}]*filter: var\(--shoot-lift\);/);
  assert.match(css, /\.period-night \.shoot svg \{ filter: var\(--shoot-lift\) url\(#night-tint\); \}/);
});
