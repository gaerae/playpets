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

const px = value => Number(String(value).replace(/px$/, ''));
// The window a thing in front opens, in its own pixels from its top left corner.
const windowOf = button => ({
  x: px(button.style['--veil-x']),
  y: px(button.style['--veil-y']),
  rx: px(button.style['--veil-rx']),
  ry: px(button.style['--veil-ry']),
});
// Where the friend's body is drawn (veil.js body), from `thing`'s top left corner as setDown placed it.
function bodyFrom(v, thing) {
  const box = drawnBox(v),
    [, left, top] = thing.style.transform.match(/translate\(([-\d.]+)px,([-\d.]+)px\)/).map(Number);
  return {
    x: box.x + box.width / 2 - left,
    y: box.y + box.height * 0.425 - top,
    rx: box.width / 4,
    ry: box.height * 0.425,
  };
}

// A tree faded whole in front of a friend read as gone: friends gather left of the middle of a small
// window, and a tree planted there was faded more often than not. It stays as it is and opens a soft
// window only where the friend stands, so both are seen.
test('a thing in front of a friend opens a window where the friend stands, and it follows the friend', t => {
  yardIn(t);
  const v = friend(t, 0.5, 0.4);
  place(v);
  const tree = thingOver(v, 1.6, v.z + 1, 0, 'planted-tree');
  assert.equal(tree.classList.contains('veiled'), true);
  const check = what => {
    const at = windowOf(tree),
      body = bodyFrom(v, tree);
    assert.ok(Math.abs(at.x - body.x) <= 1 && Math.abs(at.y - body.y) <= 1, `${what}: centred on the friend`);
    assert.ok(at.rx >= body.rx && at.ry >= body.ry, `${what}: as big as the friend's body`);
  };
  check('set down in front of it');
  v.x += 0.01;
  place(v);
  assert.equal(tree.classList.contains('veiled'), true, 'a step still behind it');
  check('after a step');
});

test('two friends behind one thing are both seen through it', t => {
  yardIn(t);
  const a = friend(t, 0.5, 0.4);
  place(a);
  const tree = thingOver(a, 3, a.z + 1, 0, 'planted-tree');
  const b = friend(t, 0.5, 0.4);
  b.x = 0.52;
  place(b);
  const at = windowOf(tree),
    one = bodyFrom(a, tree),
    two = bodyFrom(b, tree);
  for (const body of [one, two]) {
    assert.ok(at.x - at.rx <= body.x - body.rx && body.x + body.rx <= at.x + at.rx, 'across');
    assert.ok(at.y - at.ry <= body.y - body.ry && body.y + body.ry <= at.y + at.ry, 'up and down');
  }
});

// The thing itself never fades: only the window shows the friend, eased in a quarter of a second
// (a registered --veil-see, so the mask's alpha can ease). With reduced motion it is not eased:
// base.css stops every transition then, so garden.css keeps no rule of its own that never applies.
test('a thing in front of a friend stays whole but for a soft window, eased unless motion is reduced', async () => {
  const read = async name =>
    (await readFile(`src/styles/${name}`, 'utf8'))
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .replace(/\( /g, '(')
      .replace(/ \)/g, ')');
  const garden = await read('garden.css');
  const veiled = garden.match(/:is\(\.plant, \.shoot, \.fallen-fruit, \.decor, \.planted-tree\)\.veiled \{([^}]*)\}/);
  assert.ok(veiled, 'one rule for every kind');
  assert.doesNotMatch(veiled[1], /opacity/, 'nothing fades whole');
  assert.match(veiled[1], /--veil-see: 0\.3;/);
  for (const property of ['-webkit-mask-image', 'mask-image'])
    assert.match(
      veiled[1],
      new RegExp(
        `(^| |;)${property}: radial-gradient\\(ellipse var\\(--veil-rx\\) var\\(--veil-ry\\) at var\\(--veil-x\\) var\\(--veil-y\\), rgb\\(0 0 0 / var\\(--veil-see\\)\\) 60%, #000 100%\\);`,
      ),
      property,
    );
  assert.match(garden, /@property --veil-see \{ syntax: "<number>"; inherits: false; initial-value: 1; \}/);
  assert.match(
    garden,
    /(^| ):is\(\.plant, \.shoot, \.fallen-fruit, \.decor, \.planted-tree\) \{ transition: --veil-see 0\.25s ease; \}/,
  );
  assert.doesNotMatch(garden, /transition: opacity 0\.25s ease;/, 'no fade of the whole thing is left');
  assert.match(
    await read('base.css'),
    /@media \(prefers-reduced-motion: reduce\) \{ \* \{ animation: none !important; transition: none !important;/,
  );
});

// The snowman game's balls and its preview are set down too, but nothing about them fades.
test('only a tree, a shoot, fallen fruit, a flower or a gift fades', t => {
  yardIn(t);
  const v = friend(t, 0.5, 0.4);
  place(v);
  for (const kind of ['plant', 'shoot', 'fallen-fruit', 'decor', 'planted-tree'])
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
