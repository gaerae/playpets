import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { drawnBox, measureYard } from '../src/yard/field.js';
import { setDown } from '../src/yard/props.js';
import { friendAt, friendGone } from '../src/yard/veil.js';
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
// moved `aside` of the friend's width to the right.
function thingOver(v, share, z = v.z + 1, aside = 0) {
  const box = drawnBox(v),
    button = unmeasured(element());
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

// The fade is to about half, eased a quarter of a second, and with reduced motion it is not eased.
test('a thing in front of a friend fades to about half, eased unless motion is reduced', async () => {
  const css = (await readFile('src/styles/garden.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  assert.match(css, /:is\(\.plant, \.shoot, \.decor, \.planted-tree\)\.veiled \{ opacity: 0\.45; \}/);
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\) \{ :is\(\.plant, \.shoot, \.decor, \.planted-tree\) \{ transition: none; \} \}/,
  );
});
