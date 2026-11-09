// A built snowman wears its hat, scarf and carrot nose in the yard, and a small tray from its menu
// puts each on or takes it off, saving every change (src/yard/snowman-dress.js).
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { element } from './support/dom.mjs';

const calls = [];
// What dressDecor answers next: an answer, or a promise the test settles.
let answers = [];
const answer = (data = null) => ({ ok: true, data });
globalThis.playPets = {
  moveDecor: async () => answer(),
  hideDecor: async () => answer(),
  putAway: async () => answer(),
  dressDecor: (...args) => {
    calls.push(args);
    return Promise.resolve(answers.shift() ?? answer());
  },
};
const state = await import('../src/core/state.js');
const { list, t } = await import('../src/core/i18n.js');
const { decorButton, renderDecor, setupDecor } = await import('../src/yard/decor.js');
const { closeDress, openDress, renderDress, setupDress } = await import('../src/yard/snowman-dress.js');
const { drawYard } = await import('./support/yard.mjs');

const ART = ['decor/sculpted/snowman.svg', 'decor/snow_hat.svg', 'decor/snow_scarf.svg', 'decor/snow_nose.svg'];
// December 15 at noon, local time.
const NOW = new Date(2026, 11, 15, 12).getTime();
const flush = () => new Promise(resolve => setImmediate(resolve));
const kids = node => node.children.filter(c => typeof c === 'object' && !c.removed);
const parts = button =>
  [
    ...kids(button)
      .find(c => c.classList.contains('dress-layers'))
      .innerHTML.matchAll(/data-part="(\w+)"/g),
  ].map(m => m[1]);

async function yard(ctx, decor, { pets = [] } = {}) {
  calls.length = 0;
  answers = [];
  const drawn = await drawYard(ctx, {
    now: NOW,
    scene: { season: 'winter', world: 'woodland' },
    art: ART,
    garden: { decor, received: ['snowman', 'bench'] },
    setup: () => {
      setupDecor({ drawn: renderDress, press: { snowman: openDress } });
      setupDress({ redraw: renderDecor, button: decorButton });
    },
    before: () => {
      for (const v of pets) state.views.set(v.pet.id, v);
    },
  });
  // A tray still open closes with its test, while the fake document is still there.
  ctx.after(() => closeDress());
  const snowman = () => drawn.shown().find(b => b.dataset.kind === 'snowman');
  const tray = () => kids(drawn.nodes.get('yard')).find(c => c.classList.contains('dress-tray')) ?? null;
  const toggles = () => kids(tray()).filter(c => c.classList.contains('dress-toggle'));
  const toggle = part => toggles().find(b => b.dataset.part === part);
  const done = () => kids(tray()).find(c => c.classList.contains('dress-done'));
  const dress = () => state.data.garden.decor.find(d => d.id === 's')?.dress;
  return { ...drawn, snowman, tray, toggles, toggle, done, dress };
}
const SNOWMAN = (dress = [], id = 's') => ({ id, kind: 'snowman', x: 0.5, y: 0.7, dress });

test('a snowman wears what it was dressed in, in drawing order', async ctx => {
  const y = await yard(ctx, [SNOWMAN(['hat', 'nose']), { id: 'b', kind: 'bench', x: 0.2, y: 0.7 }]);
  assert.deepEqual(parts(y.snowman()), ['nose', 'hat']);
  const bench = y.shown().find(b => b.dataset.kind === 'bench');
  assert.equal(
    kids(bench).some(c => c.classList.contains('dress-layers')),
    false,
    'a bench has nothing to wear',
  );
  // A part sits by its anchor's centre: the hat's top rises above the snowman's box.
  const hat = y
    .snowman()
    .children.find(c => c.classList?.contains('dress-layers'))
    .innerHTML.match(/data-part="hat" style="left:([-\d.]+)%;top:([-\d.]+)%;width:([-\d.]+)%"/);
  assert.ok(hat, 'the hat is placed');
  const [left, top, width] = hat.slice(1).map(Number);
  assert.equal(width, 42);
  assert.ok(Math.abs(left - (49 - 21)) < 0.01, `left ${left}`);
  assert.ok(top < 0, `the hat's top (${top}%) rises above the box`);
});

test('the dress tray puts things on and takes them off, saving each change', async ctx => {
  const y = await yard(ctx, [SNOWMAN()]);
  openDress('s');
  assert.ok(y.tray());
  assert.equal(y.tray().getAttribute('role'), 'group');
  assert.equal(y.tray().getAttribute('aria-label'), t('snowman.dress_title'));
  assert.deepEqual(
    y.toggles().map(b => [b.getAttribute('aria-pressed'), b.textContent]),
    [
      ['false', t('snowman.dress_scarf')],
      ['false', t('snowman.dress_nose')],
      ['false', t('snowman.dress_hat')],
    ],
  );
  assert.equal(document.activeElement, y.toggles()[0], 'focus goes to the first toggle');
  assert.equal(y.done().textContent, t('snowman.dress_done'));
  await y.toggle('hat').dispatch('click');
  await flush();
  assert.deepEqual(calls.at(-1), ['s', ['hat']]);
  assert.deepEqual(y.dress(), ['hat']);
  assert.deepEqual(parts(y.snowman()), ['hat']);
  assert.equal(y.toggle('hat').getAttribute('aria-pressed'), 'true');
  await y.toggle('scarf').dispatch('click');
  await flush();
  assert.deepEqual(calls.at(-1), ['s', ['scarf', 'hat']]);
  await y.toggle('hat').dispatch('click');
  await flush();
  assert.deepEqual(calls.at(-1), ['s', ['scarf']]);
  assert.deepEqual(parts(y.snowman()), ['scarf']);
  assert.equal(calls.length, 3);
});

test('a refused change takes the thing off again and says why', async ctx => {
  const y = await yard(ctx, [SNOWMAN()]);
  openDress('s');
  answers.push({ ok: false, error: 'No.' });
  await y.toggle('nose').dispatch('click');
  await flush();
  assert.deepEqual(calls, [['s', ['nose']]]);
  assert.deepEqual(y.dress(), []);
  assert.deepEqual(parts(y.snowman()), []);
  assert.equal(y.toggle('nose').getAttribute('aria-pressed'), 'false');
  assert.equal(y.nodes.get('toast').children.at(-1).dataset.words, 'No.');
});

// Pressed twice before the first save answers: the second list goes once the first is done, and a
// refusal of the first does not put back what was there before over the second.
test('two quick changes save in turn, and a refusal of the first leaves the second', async ctx => {
  const y = await yard(ctx, [SNOWMAN()]);
  openDress('s');
  let refuseFirst;
  answers.push(new Promise(resolve => (refuseFirst = resolve)));
  y.toggle('hat').dispatch('click');
  y.toggle('scarf').dispatch('click');
  await flush();
  assert.deepEqual(calls, [['s', ['hat']]], 'one save at a time');
  assert.deepEqual(y.dress(), ['scarf', 'hat']);
  refuseFirst({ ok: false, error: 'No.' });
  await flush();
  await flush();
  assert.deepEqual(calls, [
    ['s', ['hat']],
    ['s', ['scarf', 'hat']],
  ]);
  assert.deepEqual(y.dress(), ['scarf', 'hat'], 'the last wish stands');
  assert.deepEqual(parts(y.snowman()), ['scarf', 'hat']);
  assert.equal(
    y.nodes.get('toast').children.filter(c => c.dataset.words === 'No.').length,
    0,
    'the refused list was already replaced',
  );
});

test('a friend says something when a part goes on, at most once every 4 seconds', async ctx => {
  const friend = {
    pet: { id: 'miso', name: 'Miso', size: 96 },
    bubble: element('p', { hidden: true }),
    px: 300,
    py: 300,
  };
  const y = await yard(ctx, [SNOWMAN()], { pets: [friend] });
  openDress('s');
  await y.toggle('hat').dispatch('click');
  await flush();
  assert.equal(friend.bubble.hidden, false);
  assert.ok(list('snowman.dressed').includes(friend.bubble.textContent));
  friend.bubble.hidden = true;
  await y.toggle('scarf').dispatch('click');
  await flush();
  assert.equal(friend.bubble.hidden, true, 'not again so soon');
  ctx.mock.timers.tick(4000);
  await y.toggle('scarf').dispatch('click');
  await flush();
  assert.equal(friend.bubble.hidden, true, 'nothing said when a part comes off');
  await y.toggle('nose').dispatch('click');
  await flush();
  assert.equal(friend.bubble.hidden, false);
});

test('the tray closes when the snowman goes, with Escape, or with Done', async ctx => {
  const y = await yard(ctx, [SNOWMAN()]);
  openDress('s');
  assert.ok(y.tray());
  state.setData({ ...state.data, garden: { ...state.data.garden, decor: [] } });
  renderDecor();
  assert.equal(y.tray(), null, 'gone with the snowman');

  state.setData({ ...state.data, garden: { ...state.data.garden, decor: [SNOWMAN()] } });
  renderDecor();
  openDress('s');
  await y.tray().dispatch('keydown', { key: 'Escape' });
  assert.equal(y.tray(), null, 'Escape');
  assert.equal(document.activeElement, y.snowman(), "focus goes back to the snowman's button");

  openDress('s');
  await y.done().dispatch('click');
  assert.equal(y.tray(), null, 'Done');

  openDress('s');
  await document.dispatch('pointerdown', { target: y.nodes.get('yard') });
  assert.equal(y.tray(), null, 'a press outside');
});

test('putting a snowman away says it melted', async ctx => {
  // Its own id: one put away waits out its Undo (props.js) past the end of the test.
  const y = await yard(ctx, [SNOWMAN(['hat'], 'melts')]);
  openDress('melts');
  await y.snowman().dispatch('keydown', { key: 'Delete', preventDefault() {} });
  assert.equal(y.nodes.get('toast').children.at(-1).dataset.words, t('decor.snowman_put_away'));
  assert.equal(y.tray(), null, 'the tray goes with it');
});

test('a press on the snowman opens its tray', async ctx => {
  const y = await yard(ctx, [SNOWMAN()]);
  const button = y.snowman();
  button.setPointerCapture = () => {};
  await button.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
  await button.dispatch('pointerup', { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
  assert.ok(y.tray());
  assert.equal(button.title, t('decor.title_decorate', { kind: t('decor.kind_snowman') }));
});
