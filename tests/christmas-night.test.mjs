// On a snowy December evening or night the little Christmas tree grows into the grand tree, once a
// night; it goes back when the snow stops (src/yard/christmas-night.js).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import './support/content.mjs';
import { installDom, installStorage } from './support/dom.mjs';

globalThis.playPets = {
  moveDecor: async () => ({ ok: true, data: null }),
  hideDecor: async () => ({ ok: true, data: null }),
  putAway: async () => ({ ok: true, data: null }),
};
const { setData, views } = await import('../src/core/state.js');
const { t } = await import('../src/core/i18n.js');
const { reduced } = await import('../src/core/sprites.js');
const { loadArt } = await import('../src/yard/art.js');
const { renderDecor, setupDecor } = await import('../src/yard/decor.js');
const { fieldToYard, measureYard, petHeight } = await import('../src/yard/field.js');
const { scene } = await import('../src/yard/world.js');
const { christmasNight, christmasNightCheck, nightOf, setupChristmasNight } =
  await import('../src/yard/christmas-night.js');

// December 24 at nine in the evening, local time.
const NOW = new Date(2026, 11, 24, 21).getTime();
const TREE = { id: 'tree', kind: 'xmas_tree', x: 0.5, y: 0.5 };
const ART = ['decor/xmas_tree.svg', 'decor/xmas_tree_grand.svg'];

// The drawings' sizes, as the page reads them from their view boxes (art.js loadArt).
async function sizes(document) {
  const defs = { append() {} };
  document.querySelector = selector => (selector === '#art defs' ? defs : null);
  globalThis.DOMParser = class {
    parseFromString(text) {
      const box = text.match(/viewBox="([^"]+)"/)[1];
      return {
        documentElement: {
          nodeName: 'svg',
          getAttribute: () => box,
          querySelectorAll: () => [],
          attributes: [],
          childNodes: [],
        },
      };
    }
  };
  globalThis.fetch = async path => ({
    ok: true,
    text: () => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8'),
  });
  await loadArt(ART);
}

async function yard(ctx, { decor = [TREE], seen, before } = {}) {
  ctx.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: NOW });
  const was = { world: scene.world, event: scene.event, season: scene.season, period: scene.period };
  Object.assign(was, { weather: scene.weather });
  Object.assign(scene, { world: 'woodland', event: 'lights', season: 'winter', period: 'night', weather: 'snow' });
  const motion = reduced.matches;
  ctx.after(() => {
    Object.assign(scene, was);
    reduced.matches = motion;
    views.clear();
  });
  const { nodes, document } = installDom(ctx, { anyId: true, ids: ['yard', 'garden-layer', 'toast'] });
  ctx.after(() => {
    delete globalThis.DOMParser;
    delete globalThis.fetch;
  });
  await sizes(document);
  nodes.get('yard').getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 560 });
  const storage = installStorage(ctx);
  setupDecor({ drawn: christmasNightCheck });
  setupChristmasNight(seen ? { seen } : undefined);
  // What an earlier test drew goes first.
  setData({ garden: { decor: [], plants: [], trees: [], boxed: [] }, pets: [], assets: [] });
  renderDecor();
  setData({ garden: { decor, plants: [], trees: [], boxed: [] }, pets: [], assets: [] });
  measureYard();
  before?.({ document, storage });
  renderDecor();
  // remove() leaves a node in place, marked (support/dom.mjs).
  const tree = () => nodes.get('garden-layer').children.find(b => !b.removed && b.dataset.kind === 'xmas_tree');
  return { tree, document, storage, nodes };
}
const layers = button => button.children.filter(c => typeof c === 'object' && c.classList.contains('xmas-night'));
const has = (button, name) => button.classList.contains(name);

test('Christmas night needs the lights, a winter yard, evening or night, snow and the tree', () => {
  const at = (y, m, d, h) => new Date(y, m - 1, d, h);
  const night = { event: 'lights', season: 'winter', period: 'night', weather: 'snow' };
  const tree = [{ kind: 'xmas_tree' }];
  assert.equal(christmasNight(night, tree, at(2026, 12, 24, 21)), true);
  assert.equal(christmasNight({ ...night, period: 'evening' }, tree, at(2026, 12, 24, 18)), true);
  assert.equal(christmasNight({ ...night, period: 'day' }, tree, at(2026, 12, 24, 13)), false);
  assert.equal(christmasNight({ ...night, weather: 'clear' }, tree, at(2026, 12, 24, 21)), false);
  assert.equal(
    christmasNight({ ...night, season: 'autumn' }, tree, at(2026, 12, 24, 21)),
    false,
    'no snow play in a kept season',
  );
  assert.equal(
    christmasNight({ ...night, event: null }, tree, at(2026, 12, 24, 21)),
    false,
    'the studio has no seasonal effects',
  );
  assert.equal(
    christmasNight({ ...night, event: 'newyear' }, tree, at(2027, 1, 3, 21)),
    false,
    'the tree still shows, the lights are over',
  );
  assert.equal(christmasNight(night, [{ kind: 'santa' }], at(2026, 12, 24, 21)), false);
  assert.equal(nightOf(at(2026, 12, 24, 21)), '2026-12-24');
  assert.equal(nightOf(new Date(2026, 11, 25, 4, 59)), '2026-12-24');
  assert.equal(nightOf(at(2026, 12, 25, 5)), '2026-12-25');
  assert.equal(nightOf(new Date(2027, 0, 1, 0, 30)), '2026-12-31');
});

test('a snowy December night turns the little tree grand once', async ctx => {
  const { tree, storage } = await yard(ctx);
  assert.ok(has(tree(), 'xmas-grand'));
  assert.ok(has(tree(), 'xmas-rise'));
  assert.equal(storage.getItem('xmas-night'), '2026-12-24');
  assert.equal(tree().title, t('decor.title', { kind: t('decor.kind_xmas_tree_grand') }));
  assert.equal(layers(tree()).length, 1);
  ctx.mock.timers.tick(2600);
  assert.ok(!has(tree(), 'xmas-rise'));
  assert.ok(has(tree(), 'xmas-grand'));
  christmasNightCheck();
  assert.equal(layers(tree()).length, 1);
  assert.ok(!has(tree(), 'xmas-rise'));
});

test('a restart the same night shows the grand tree without the change', async ctx => {
  const { tree } = await yard(ctx, { before: ({ storage }) => storage.setItem('xmas-night', '2026-12-24') });
  assert.ok(has(tree(), 'xmas-grand'));
  assert.ok(!has(tree(), 'xmas-rise'));
});

test('when the snow stops the tree goes back, and comes back the same night without the full change', async ctx => {
  const { tree } = await yard(ctx);
  ctx.mock.timers.tick(2600);
  scene.weather = 'clear';
  christmasNightCheck();
  assert.ok(!has(tree(), 'xmas-grand'));
  assert.equal(tree().title, t('decor.title', { kind: t('decor.kind_xmas_tree') }));
  scene.weather = 'snow';
  christmasNightCheck();
  assert.ok(has(tree(), 'xmas-grand'));
  assert.ok(!has(tree(), 'xmas-rise'));
});

test('the next evening plays it again', async ctx => {
  const { tree, storage } = await yard(ctx);
  ctx.mock.timers.tick(2600);
  scene.period = 'day';
  christmasNightCheck();
  assert.ok(!has(tree(), 'xmas-grand'));
  ctx.mock.timers.setTime(new Date(2026, 11, 25, 18).getTime());
  scene.period = 'evening';
  christmasNightCheck();
  assert.ok(has(tree(), 'xmas-rise'));
  assert.equal(storage.getItem('xmas-night'), '2026-12-25');
});

test('nothing plays while the yard cannot be seen; it plays when it is seen', async ctx => {
  const { tree, storage, document } = await yard(ctx, {
    before: ({ document }) => {
      document.hidden = true;
    },
  });
  assert.ok(!has(tree(), 'xmas-grand'));
  assert.equal(storage.getItem('xmas-night'), null);
  document.hidden = false;
  document.dispatch('visibilitychange');
  assert.ok(has(tree(), 'xmas-rise'));
});

test('nothing plays while the window is hidden by the app', async ctx => {
  const { tree, storage } = await yard(ctx, { seen: () => false });
  assert.ok(!has(tree(), 'xmas-grand'));
  assert.equal(storage.getItem('xmas-night'), null);
});

// Two friends beside the tree's foot and one far off, on an 800 px yard with the tree at x 0.5.
function friends(version = 2) {
  const foot = fieldToYard(TREE),
    py = foot.y - petHeight({ size: 96 }) + 6;
  const view = (id, px) => ({
    pet: { id, size: 96 },
    asset: { version },
    x: 0,
    y: 0,
    px,
    py,
    look: null,
    pose: 'idle',
    until: 0,
  });
  views.set('near', view('near', 360));
  views.set('far', view('far', 20));
  return { near: views.get('near'), far: views.get('far') };
}

test('with reduced motion the change is a crossfade and no friend moves', async ctx => {
  let near;
  const { tree } = await yard(ctx, {
    before: () => {
      reduced.matches = true;
      ({ near } = friends());
    },
  });
  assert.ok(has(tree(), 'xmas-grand'));
  assert.ok(!has(tree(), 'xmas-rise'));
  assert.equal(near.look, null);
  assert.equal(near.pose, 'idle');
});

test('nearby friends look up at the star, a far one does not', async ctx => {
  let near, far;
  await yard(ctx, {
    before: () => {
      ({ near, far } = friends());
    },
  });
  assert.ok(near.look && near.look.y < 0, 'the near one looks up');
  assert.equal(far.look, null);
  ctx.mock.timers.tick(2400);
  assert.equal(near.look, null);
});

test('a nearby friend with no look rows waves instead', async ctx => {
  let near;
  await yard(ctx, {
    before: () => {
      ({ near } = friends(1));
    },
  });
  assert.equal(near.pose, 'wave');
  assert.equal(near.look, null);
});

test('putting the tree away mid-change leaves nothing behind, and Undo brings it back grand', async ctx => {
  const { tree, nodes } = await yard(ctx);
  ctx.mock.timers.tick(1000);
  await tree().dispatch('keydown', { key: 'Delete', preventDefault() {} });
  christmasNightCheck();
  assert.ok(!has(tree(), 'xmas-grand'));
  assert.ok(!has(tree(), 'xmas-rise'));
  assert.doesNotThrow(() => ctx.mock.timers.tick(2000));
  // Undo, from the notice (props.js removeWithUndo).
  nodes.get('toast').querySelector('.toast-action').onclick();
  assert.equal(tree().hidden, false);
  christmasNightCheck();
  assert.ok(has(tree(), 'xmas-grand'));
  assert.ok(!has(tree(), 'xmas-rise'));
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

test("the change's keyframes move only transform and opacity, never loop, and read no variables", async () => {
  const garden = uncommented(await readFile('src/styles/garden.css', 'utf8'));
  const scenery = uncommented(await readFile('src/styles/scenery.css', 'utf8'));
  assert.ok(blocks(garden, /@keyframes\s+xmas-[\w-]+/g).length > 0, 'garden.css draws the change');
  for (const css of [garden, scenery]) {
    for (const { head, body } of blocks(css, /@keyframes\s+xmas-[\w-]+/g)) {
      assert.ok(!body.includes('var('), `${head} reads no variable`);
      for (const [, property] of body.matchAll(/([\w-]+)\s*:/g))
        assert.ok(['transform', 'opacity'].includes(property), `${head} moves ${property}`);
    }
    for (const { head, body } of blocks(css, /(?<=^|[{}])[^{}@]*xmas[^{}]*(?=\{)/g))
      assert.ok(!/\binfinite\b/.test(body), `${head.trim()} never loops`);
  }
});
