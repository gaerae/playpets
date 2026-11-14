import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { drawnBox, measureYard } from '../src/yard/field.js';
import { reconcile, setDown } from '../src/yard/props.js';
import { friendAt, friendGone, thingsNear } from '../src/yard/veil.js';
import { place } from '../src/yard/views.js';
import { scene } from '../src/yard/world.js';
import { element, installDom } from './support/dom.mjs';

function yardIn(t) {
  const { nodes } = installDom(t, { ids: ['yard'] });
  nodes.get('yard').getBoundingClientRect = () => ({ width: 1000, height: 700 });
  const before = scene.world;
  scene.world = 'woodland';
  t.after(() => {
    scene.world = before;
  });
  measureYard();
}
// Neither a friend nor a thing on the field is measured: what they cover is worked out from the
// boxes kept when they were placed.
const unmeasured = node => {
  node.getBoundingClientRect = () => assert.fail('a layout read');
  for (const name of ['offsetWidth', 'offsetHeight', 'clientWidth', 'clientHeight'])
    Object.defineProperty(node, name, { get: () => assert.fail(`a layout read (${name})`) });
  return node;
};
let ids = 0;
// A friend in this test's yard, which leaves it when the test ends, as a friend sent away does.
function friend(t, x, y) {
  const v = {
    pet: { id: `veil-${++ids}`, size: 96 },
    x,
    y,
    button: unmeasured(element()),
    label: unmeasured(element()),
  };
  t.after(() => friendGone(v.pet.id));
  return v;
}
// A thing on the field `share` as wide as the friend's drawing and a little taller, centred on it,
// its foot 8px below the friend's feet, drawn at depth `z` (in front of the friend by default), and
// moved `aside` of the friend's width to the right; a gift unless it is `kind`.
function thingOver(v, share, z = v.z + 1, aside = 0, kind = 'decor') {
  const box = drawnBox(v),
    button = unmeasured(element('button', { className: kind }));
  setDown(button, box.x + box.width * (0.5 + aside), box.y + box.height + 8, box.width * share, box.height * 1.2, z);
  return button;
}

test('a friend mostly behind a tree, a flower or a gift drawn in front fades it', t => {
  yardIn(t);
  const v = friend(t, 0.5, 0.4);
  place(v);
  const tree = thingOver(v, 1.2);
  assert.equal(tree.classList.contains('veiled'), true, 'set down in front of the friend');
  v.x = 0.1;
  place(v);
  assert.equal(tree.classList.contains('veiled'), false, 'the friend walked out from behind it');
  v.x = 0.5;
  place(v);
  assert.equal(tree.classList.contains('veiled'), true, 'and back behind it');
});

test('a thing behind the friend, or covering only a little of it, stays as it is', t => {
  yardIn(t);
  const v = friend(t, 0.5, 0.4);
  place(v);
  assert.equal(thingOver(v, 1.2, v.z - 1).classList.contains('veiled'), false, 'drawn behind the friend');
  assert.equal(thingOver(v, 0.3).classList.contains('veiled'), false, 'a flower at its feet');
  // Its box covers 70% of the friend's, but only with empty corners over the friend's empty side:
  // the tent beside Clover at 560 by 400.
  assert.equal(thingOver(v, 1.2, v.z + 1, 0.4).classList.contains('veiled'), false, 'a tent beside it');
});

test('a friend hiding in the game is not given away', t => {
  yardIn(t);
  const v = friend(t, 0.5, 0.4);
  place(v);
  const bush = thingOver(v, 1.2);
  assert.equal(bush.classList.contains('veiled'), true);
  v.button.classList.add('hiding');
  friendAt(v);
  assert.equal(bush.classList.contains('veiled'), false);
});

test('a step that does not move the friend works nothing out again', t => {
  yardIn(t);
  const v = friend(t, 0.5, 0.4);
  place(v);
  const tree = thingOver(v, 1.2);
  let writes = 0;
  const toggle = tree.classList.toggle;
  tree.classList.toggle = (...args) => {
    writes++;
    return toggle(...args);
  };
  place(v);
  place(v);
  assert.equal(writes, 0);
});

// The fade is to about half, eased a quarter of a second. With reduced motion it is not eased:
// base.css stops every transition then, so garden.css keeps no rule of its own that never applies.
test('a thing in front of a friend fades to about half, eased unless motion is reduced', async () => {
  const read = async name =>
    (await readFile(`src/styles/${name}`, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  const garden = await read('garden.css');
  assert.match(garden, /:is\(\.plant, \.shoot, \.decor, \.planted-tree\)\.veiled \{ opacity: 0\.45; \}/);
  for (const kind of ['plant', 'shoot', 'decor', 'planted-tree'])
    assert.match(garden, new RegExp(`(^| )\\.${kind} \\{[^}]*transition: opacity 0\\.25s ease;`), kind);
  assert.doesNotMatch(garden, /\{ :is\(\.plant, \.shoot, \.decor, \.planted-tree\) \{ transition: none; \} \}/);
  assert.match(
    await read('base.css'),
    /@media \(prefers-reduced-motion: reduce\) \{ \* \{ animation: none !important; transition: none !important;/,
  );
});

// The snowman game's balls and its preview are set down too, but nothing about them fades.
test('only a tree, a shoot, a flower or a gift fades', t => {
  yardIn(t);
  const v = friend(t, 0.5, 0.4);
  place(v);
  for (const kind of ['plant', 'shoot', 'decor', 'planted-tree'])
    assert.equal(thingOver(v, 1.2, v.z + 1, 0, kind).classList.contains('veiled'), true, kind);
  for (const kind of ['snowball', 'snowman-preview'])
    assert.equal(thingOver(v, 1.2, v.z + 1, 0, kind).classList.contains('veiled'), false, kind);
});

// A thing taken away was kept until a friend next moved, and only if the page said it was gone.
test('a thing taken off the field is forgotten as it goes', t => {
  yardIn(t);
  const v = friend(t, 0.5, 0.4);
  place(v);
  const shown = new Map([['gift', { button: thingOver(v, 1.2) }]]);
  const { button } = shown.get('gift');
  assert.equal(button.classList.contains('veiled'), true);
  reconcile(
    shown,
    [],
    () => assert.fail('nothing new'),
    () => {},
  );
  assert.equal(button.classList.contains('veiled'), false, 'it no longer covers anyone');
  v.x = 0.1;
  place(v);
  v.x = 0.5;
  place(v);
  assert.equal(button.classList.contains('veiled'), false, 'and is not worked out again');
});

// A step of a walk is compared only with what stands near it, not with every thing on the field.
test("a friend's step looks only at the things near it", t => {
  yardIn(t);
  const v = friend(t, 0.5, 0.4);
  place(v);
  const near = thingOver(v, 1.2);
  v.x = 0.05;
  place(v);
  const far = thingOver(v, 1.2);
  v.x = 0.5;
  place(v);
  const found = thingsNear(drawnBox(v));
  assert.equal(found.has(near), true);
  assert.equal(found.has(far), false);
  assert.equal(far.classList.contains('veiled'), false, 'the friend walked out from behind it');
});
