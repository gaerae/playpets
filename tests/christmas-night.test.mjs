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
const { markFresh, renderDecor, setupDecor } = await import('../src/yard/decor.js');
const { fieldToYard, measureYard, petHeight } = await import('../src/yard/field.js');
const { scene } = await import('../src/yard/world.js');
const { christmasNight, christmasNightCheck, nightOf, setupChristmasNight, sleighReady } =
  await import('../src/yard/christmas-night.js');

// December 24 at nine in the evening, local time.
const NOW = new Date(2026, 11, 24, 21).getTime();
const TREE = { id: 'tree', kind: 'xmas_tree', x: 0.5, y: 0.5 };
const ART = ['decor/xmas_tree.svg', 'decor/xmas_tree_grand.svg', 'decor/sleigh.svg'];

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
    // The yard empties while this test's clock still runs, so no timer handle outlives it.
    setData({ garden: { decor: [], plants: [], trees: [], boxed: [] }, pets: [], assets: [] });
    renderDecor();
  });
  const { nodes, document } = installDom(ctx, { anyId: true, ids: ['yard', 'garden-layer', 'toast'] });
  // As index.html has it.
  document.getElementById('xmas-sleigh').hidden = true;
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

// Undo, from the notice (props.js removeWithUndo).
const undo = nodes => nodes.get('toast').querySelector('.toast-action').onclick();

test('putting the tree away mid-change leaves nothing behind, and Undo after it brings it back grand', async ctx => {
  const { tree, nodes } = await yard(ctx);
  ctx.mock.timers.tick(1000);
  await tree().dispatch('keydown', { key: 'Delete', preventDefault() {} });
  assert.ok(!has(tree(), 'xmas-grand'));
  assert.ok(!has(tree(), 'xmas-rise'));
  assert.doesNotThrow(() => ctx.mock.timers.tick(2000));
  undo(nodes);
  assert.equal(tree().hidden, false);
  assert.ok(has(tree(), 'xmas-grand'));
  assert.ok(!has(tree(), 'xmas-rise'));
});

test('Undo before the change would have ended brings the tree back grand, and the old end changes nothing', async ctx => {
  const { tree, nodes } = await yard(ctx);
  ctx.mock.timers.tick(1000);
  await tree().dispatch('keydown', { key: 'Delete', preventDefault() {} });
  assert.ok(!has(tree(), 'xmas-grand'));
  assert.ok(!has(tree(), 'xmas-rise'));
  ctx.mock.timers.tick(500);
  undo(nodes);
  assert.equal(tree().hidden, false);
  assert.ok(has(tree(), 'xmas-grand'));
  assert.ok(!has(tree(), 'xmas-rise'), 'not the change again');
  const classes = tree().className;
  ctx.mock.timers.tick(1100);
  assert.equal(tree().className, classes, 'the 2.6 s mark passes with nothing to end');
});

const glint = button => layers(button)[0].children.find(c => c.classList.contains('xmas-glint'));
const lit = button => glint(button).classList.contains('glinting');
const bulbs = (await import('../src/yard/catalog.js')).giftKind('xmas_tree').night.bulbs;
const at = bulb => ({ left: `${bulb[0] * 100}%`, top: `${bulb[1] * 100}%` });
const spot = button => ({ left: glint(button).style.left, top: glint(button).style.top });
const TONIGHT = ({ storage }) => storage.setItem('xmas-night', '2026-12-24');

test('a single bulb glints now and then, 10 to 16 seconds apart', async ctx => {
  ctx.mock.method(Math, 'random', () => 0);
  const { tree } = await yard(ctx, { before: TONIGHT });
  const { timers } = ctx.mock;

  timers.tick(9_999);
  assert.ok(!lit(tree()));
  timers.tick(1);
  assert.ok(lit(tree()));
  assert.deepEqual(spot(tree()), at(bulbs[0]));
  timers.tick(800);
  assert.ok(!lit(tree()));
  timers.tick(9_200);
  assert.ok(lit(tree()));
  assert.deepEqual(spot(tree()), at(bulbs[1]));
});

test('the next glint waits up to 16 seconds', async ctx => {
  ctx.mock.method(Math, 'random', () => 0.999);
  const { tree } = await yard(ctx, { before: TONIGHT });
  ctx.mock.timers.tick(15_900);
  assert.ok(!lit(tree()));
  ctx.mock.timers.tick(100);
  assert.ok(lit(tree()));
});

test('the change ends, then the glints begin', async ctx => {
  ctx.mock.method(Math, 'random', () => 0);
  const { tree } = await yard(ctx);
  ctx.mock.timers.tick(2_600);
  ctx.mock.timers.tick(9_999);
  assert.ok(!lit(tree()));
  ctx.mock.timers.tick(1);
  assert.ok(lit(tree()));
});

// Forty seconds pass and no bulb has glinted.
const quiet = (ctx, button) => {
  ctx.mock.timers.tick(40_000);
  assert.ok(!lit(button));
};
const still = (name, play) => {
  test(`no glints ${name}`, async ctx => {
    ctx.mock.method(Math, 'random', () => 0);
    await play(ctx);
  });
};

still('with reduced motion', async ctx => {
  const { tree } = await yard(ctx, {
    before: opts => {
      TONIGHT(opts);
      reduced.matches = true;
    },
  });
  quiet(ctx, tree());
});
still('while the yard cannot be seen, and a glint 10 s after it can', async ctx => {
  const { tree, document } = await yard(ctx, { before: TONIGHT });
  document.hidden = true;
  ctx.mock.timers.tick(5_000);
  christmasNightCheck();
  quiet(ctx, tree());
  document.hidden = false;
  document.dispatch('visibilitychange');
  ctx.mock.timers.tick(10_000);
  assert.ok(lit(tree()));
});
still('once the app hides the yard after setup', async ctx => {
  let shown = true;
  const { tree } = await yard(ctx, { before: TONIGHT, seen: () => shown });
  shown = false;
  quiet(ctx, tree());
});
still('once the snow stops', async ctx => {
  const { tree } = await yard(ctx, { before: TONIGHT });
  scene.weather = 'clear';
  christmasNightCheck();
  quiet(ctx, tree());
});
still('once the tree is put away', async ctx => {
  const { tree } = await yard(ctx, { before: TONIGHT });
  await tree().dispatch('keydown', { key: 'Delete', preventDefault() {} });
  quiet(ctx, tree());
});

// The sleigh: the grand tree with the baby reindeer and Santa out, on a night (not an evening).
const GUESTS = [
  TREE,
  { id: 'reindeer', kind: 'baby_reindeer', x: 0.35, y: 0.5 },
  { id: 'santa', kind: 'santa', x: 0.65, y: 0.5 },
];
const NO_SANTA = GUESTS.slice(0, 2);
const decorButton = (nodes, kind) =>
  nodes.get('garden-layer').children.find(b => !b.removed && b.dataset.kind === kind);
async function sleighYard(ctx, { decor = GUESTS, before, seen } = {}) {
  ctx.mock.method(Math, 'random', () => 0);
  const parts = await yard(ctx, {
    decor,
    seen,
    before: opts => {
      TONIGHT(opts);
      before?.(opts);
    },
  });
  const { nodes, document } = parts;
  return {
    ...parts,
    sleigh: document.getElementById('xmas-sleigh'),
    reindeer: () => decorButton(nodes, 'baby_reindeer'),
    santa: () => decorButton(nodes, 'santa'),
    moon: () => nodes.get('yard').classList.contains('xmas-moon'),
    motes: () =>
      layers(parts.tree())[0].children.filter(
        c => typeof c === 'object' && !c.removed && c.classList.contains('xmas-mote'),
      ),
  };
}
const looking = button => !!button && has(button, 'look-up');

test('the sleigh waits for the moon and for both guests', async ctx => {
  const date = new Date(2026, 11, 24, 21),
    night = { event: 'lights', season: 'winter', period: 'night', weather: 'snow' },
    guests = ['baby_reindeer', 'santa'];
  assert.equal(sleighReady(night, GUESTS, date, guests), true);
  assert.equal(
    sleighReady({ ...night, period: 'evening' }, GUESTS, date, guests),
    false,
    'the sun is up, not the moon',
  );
  assert.equal(sleighReady(night, NO_SANTA, date, guests), false);
  assert.equal(sleighReady({ ...night, weather: 'clear' }, GUESTS, date, guests), false);

  const { sleigh, tree, storage, moon } = await sleighYard(ctx, {
    before: () => {
      scene.period = 'evening';
    },
  });
  assert.ok(has(tree(), 'xmas-grand'), 'the grand tree shows from evening');
  ctx.mock.timers.tick(60_000);
  assert.equal(sleigh.hidden, true);
  assert.equal(storage.getItem('xmas-sleigh'), null, 'no flight was used up');
  assert.ok(!moon());
});

test('the sleigh waits for Santa too', async ctx => {
  const { sleigh, storage, moon } = await sleighYard(ctx, { decor: NO_SANTA });
  ctx.mock.timers.tick(60_000);
  assert.equal(sleigh.hidden, true);
  assert.equal(storage.getItem('xmas-sleigh'), null);
  assert.ok(!moon());
});

test('with the baby reindeer and Santa out, the sleigh crosses the moon once that night', async ctx => {
  const parts = await sleighYard(ctx),
    { sleigh, storage, reindeer, santa, moon, motes } = parts,
    { timers } = ctx.mock;
  timers.tick(19_999);
  assert.ok(!moon());
  assert.equal(storage.getItem('xmas-sleigh'), null);
  timers.tick(1);
  assert.ok(looking(reindeer()), 'the reindeer looks up first');
  assert.ok(!looking(santa()));
  assert.ok(moon(), 'the moon brightens');
  assert.equal(storage.getItem('xmas-sleigh'), '2026-12-24');
  assert.equal(sleigh.hidden, true);
  timers.tick(400);
  assert.ok(looking(santa()), 'then Santa');
  timers.tick(800);
  assert.ok(!looking(reindeer()));
  assert.equal(sleigh.hidden, false);
  assert.ok(has(sleigh, 'flying'));
  assert.ok(sleigh.innerHTML.includes('#'), 'the sleigh is drawn the first time it flies');
  timers.tick(4200);
  assert.equal(sleigh.hidden, true);
  assert.ok(!has(sleigh, 'flying'));
  assert.equal(motes().length, 24, 'gold falls from the star');
  timers.tick(4799);
  assert.equal(motes().length, 24, 'the latest, slowest mote is still falling');
  assert.ok(moon());
  timers.tick(1);
  assert.equal(motes().length, 0);
  assert.ok(!moon());
  for (let n = 0; n < 12; n++) {
    timers.tick(10_000);
    christmasNightCheck();
    assert.equal(sleigh.hidden, true);
    assert.ok(!moon(), 'no second flight');
  }
});

test('a restart the same night after the sleigh brings no second one', async ctx => {
  const { sleigh, moon } = await sleighYard(ctx, {
    before: ({ storage }) => storage.setItem('xmas-sleigh', '2026-12-24'),
  });
  for (let n = 0; n < 12; n++) {
    ctx.mock.timers.tick(10_000);
    christmasNightCheck();
    assert.equal(sleigh.hidden, true);
    assert.ok(!moon());
  }
});

test('with reduced motion the sleigh is a still vignette and no gold falls', async ctx => {
  const { sleigh, reindeer, santa, moon, motes } = await sleighYard(ctx, {
    before: () => {
      reduced.matches = true;
    },
  });
  ctx.mock.timers.tick(20_000);
  assert.equal(sleigh.hidden, false);
  assert.ok(has(sleigh, 'still'));
  assert.ok(!has(sleigh, 'flying'));
  assert.ok(moon());
  assert.ok(!looking(reindeer()) && !looking(santa()));
  for (let n = 0; n < 30; n++) {
    ctx.mock.timers.tick(100);
    assert.equal(motes().length, 0);
    assert.ok(!looking(reindeer()) && !looking(santa()));
  }
  assert.equal(sleigh.hidden, true);
  assert.ok(!has(sleigh, 'still'));
  assert.ok(!moon());
  ctx.mock.timers.tick(20_000);
  assert.equal(motes().length, 0);
});

// Nothing of the sleigh is left, and the timers still to come change nothing.
function allGone(ctx, { sleigh, reindeer, santa, moon, tree }) {
  const gone = () => {
    assert.equal(sleigh.hidden, true);
    assert.ok(!has(sleigh, 'flying'));
    assert.ok(!moon());
    assert.ok(!looking(reindeer()) && !looking(santa()));
    const layer = layers(tree())[0];
    assert.equal(
      layer.children.filter(c => typeof c === 'object' && !c.removed && c.classList.contains('xmas-mote')).length,
      0,
    );
  };
  gone();
  for (let n = 0; n < 10; n++) {
    ctx.mock.timers.tick(1_000);
    gone();
  }
}

test('if the night ends during the sleigh, everything goes', async ctx => {
  const parts = await sleighYard(ctx);
  // A tick starts the timers set during it from its end, so the crossing's own steps wait for the next.
  ctx.mock.timers.tick(20_000);
  ctx.mock.timers.tick(1_500);
  assert.ok(has(parts.sleigh, 'flying'));
  scene.weather = 'clear';
  christmasNightCheck();
  allGone(ctx, parts);
});

test('if Santa is put away while the reindeer looks up, everything goes', async ctx => {
  const parts = await sleighYard(ctx);
  ctx.mock.timers.tick(20_000);
  ctx.mock.timers.tick(100);
  assert.ok(looking(parts.reindeer()));
  await parts.santa().dispatch('keydown', { key: 'Delete', preventDefault() {} });
  allGone(ctx, parts);
});

test('the app hiding the window during the sleigh ends it (app.js checks on every window event)', async ctx => {
  let shown = true;
  const parts = await sleighYard(ctx, { seen: () => shown });
  ctx.mock.timers.tick(20_000);
  ctx.mock.timers.tick(1_500);
  assert.ok(has(parts.sleigh, 'flying'));
  shown = false;
  christmasNightCheck();
  allGone(ctx, parts);
});

test('the yard going out of sight ends a sleigh still to come, and it comes when the yard is seen', async ctx => {
  const { sleigh, document, moon } = await sleighYard(ctx);
  ctx.mock.timers.tick(10_000);
  document.hidden = true;
  christmasNightCheck();
  ctx.mock.timers.tick(30_000);
  assert.ok(!moon());
  document.hidden = false;
  document.dispatch('visibilitychange');
  ctx.mock.timers.tick(20_000);
  ctx.mock.timers.tick(1_200);
  assert.ok(has(sleigh, 'flying'));
});

test('hiding the window during the look-up gives the night back; hiding it mid-flight does not', async ctx => {
  const early = await sleighYard(ctx);
  ctx.mock.timers.tick(20_500);
  assert.ok(early.moon());
  early.document.hidden = true;
  christmasNightCheck();
  assert.equal(early.storage.getItem('xmas-sleigh'), null, 'the sleigh had not appeared');
  early.document.hidden = false;
  early.document.dispatch('visibilitychange');
  ctx.mock.timers.tick(20_000);
  ctx.mock.timers.tick(1_200);
  assert.ok(has(early.sleigh, 'flying'), 'it flies later that night');
  ctx.mock.timers.tick(5_000);
  early.document.hidden = true;
  christmasNightCheck();
  assert.equal(early.storage.getItem('xmas-sleigh'), '2026-12-24', 'a seen sleigh uses the night up');
  early.document.hidden = false;
  early.document.dispatch('visibilitychange');
  ctx.mock.timers.tick(120_000);
  assert.ok(!early.moon(), 'no second flight');
});

test('the pop of a tree that arrived this session is over before the change ends', async ctx => {
  const { tree } = await yard(ctx, { before: () => markFresh('tree') });
  assert.ok(has(tree(), 'xmas-rise'));
  ctx.mock.timers.tick(2_600);
  assert.ok(!has(tree(), 'xmas-rise'));
  assert.ok(!has(tree(), 'arrive'), 'the small tree must not pop again over the grand one');
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
