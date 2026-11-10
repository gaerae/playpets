// The Spring shoots book in the album (src/panel/album.js): eight cards, the ones gathered named,
// the rest silhouettes that say the season, counted with the other books.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { t as translate } from '../src/core/i18n.js';
import { data, setData } from '../src/core/state.js';
import { setupAlbum } from '../src/panel/album.js';
import { SHOOTS } from '../src/yard/catalog.js';
import { albumEntries } from './support/content.mjs';
import { installDom } from './support/dom.mjs';

test('the Spring shoots book shows each shoot, its name and the season', t => {
  const before = data;
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
const { recall } = await import('../src/core/state.js');
const { artHref } = await import('../src/yard/art.js');
const { measureYard } = await import('../src/yard/field.js');
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
  assert.equal(button.style.zIndex, String(1 + Math.round(shoot.y * 100)));
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
  scene.world = 'studio';
  shootsMinute();
  assert.equal(y.live().length, 0);
  assert.equal(y.saved().out.length, 2);
});

test('a shoot whose ground is taken is gone at once, and from storage at the next minute', async ctx => {
  const y = await springYard(ctx, { scene: { period: 'day' }, stored: record([standing('a', 'morel', 0.2, 0.6)]) });
  shootsMinute();
  assert.equal(y.live().length, 1);
  data.garden.decor.push({ id: 'bench', kind: 'bench', x: 0.2, y: 0.6 });
  renderShoots();
  assert.equal(y.live().length, 0, 'not drawn on the bench');
  assert.equal(y.saved().out.length, 1);
  shootsMinute();
  assert.equal(y.live().length, 0);
  assert.equal(y.saved().out.length, 0);
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
  }
  assert.ok(render.indexOf('renderShoots();') > render.indexOf('renderTrees();'), 'a state change redraws them');
});

test('a shoot rises once, stays still for reduced motion, and lets a tool or a game through', async () => {
  const css = (await readFile('src/styles/garden.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  assert.match(css, /\.shoot\.sprouted svg \{[^}]*animation: shoot-up 500ms/);
  const frames = css.match(/@keyframes shoot-up \{(.*?\}) \}/)?.[1] || '';
  assert.match(frames, /scale\(0\.6, 0\.2\)/);
  assert.doesNotMatch(frames, /var\(/);
  for (const [, property] of frames.matchAll(/([a-z-]+):/g))
    assert.ok(['transform', 'opacity'].includes(property), property);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.shoot\.sprouted svg \{ animation: none; \}/);
  assert.match(css, /\.yard\.aiming \.shoot, \.yard\.playing \.shoot \{ pointer-events: none; \}/);
});
