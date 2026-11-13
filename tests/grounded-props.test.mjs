// Things set on the field sit in the picture as friends do: farther back they are drawn smaller
// about their foot, as a friend standing there is; in a room they keep to the picture's own scale;
// what friends walk around is what is drawn; they take the scene's morning, evening and rain; and in
// a room a gift is not set down inside the furniture.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { worlds as shipped } from './support/content.mjs';
import { installDom } from './support/dom.mjs';
import { flatField } from './support/flat-field.mjs';

let requests = [];
globalThis.playPets = {
  moveDecor: async (...args) => {
    requests.push(args);
    return { ok: true, data: null };
  },
  bloomed: async () => ({ ok: true }),
};
globalThis.matchMedia = () => ({ matches: true });
const state = await import('../src/core/state.js');
const { renderDecor } = await import('../src/yard/decor.js');
const { renderGarden } = await import('../src/yard/garden.js');
const { renderTrees } = await import('../src/yard/planted-trees.js');
const { depthScale, field, fieldToYard, footTarget, measureYard, propZoom, yardZoom } =
  await import('../src/yard/field.js');
const { giftKind, treeSize } = await import('../src/yard/catalog.js');
const { buildGroundProfile } = await import('../src/yard/ground.js');
const { environmentLook } = await import('../src/yard/environment.js');
const { scene } = await import('../src/yard/world.js');

const DAY = 86_400_000;

function yardOf(t, { world = 'woodland', width = 1180, height = 850, garden = {} } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  flatField(t);
  const previous = state.data,
    was = scene.world;
  t.after(() => {
    state.setData({ ...previous, garden: { decor: [], plants: [], trees: [] } });
    renderDecor();
    renderGarden();
    renderTrees();
    state.setData(previous);
    scene.world = was;
  });
  const { nodes } = installDom(t, {
    anyId: true,
    ids: ['yard', 'garden-layer', 'seed-count', 'plant-tool', 'toast'],
  });
  nodes.get('yard').getBoundingClientRect = () => ({ left: 0, top: 0, width, height });
  scene.world = world;
  state.setData({ ...previous, garden: { decor: [], plants: [], trees: [], ...garden }, pets: [] });
  measureYard();
  renderDecor();
  renderGarden(Date.now());
  renderTrees();
  requests = [];
  return nodes;
}
const buttons = (nodes, cls) =>
  nodes
    .get('garden-layer')
    .children.filter(b => !b.removed && b.className.split(' ').includes(cls))
    .sort((a, b) => Number(a.style.zIndex) - Number(b.style.zIndex));
const box = button => {
  const [, x, y] = button.style.transform.match(/translate\(([-\d.e]+)px,([-\d.e]+)px\)/).map(Number);
  return { x, y, w: Number.parseFloat(button.style.width), h: Number.parseFloat(button.style.height) };
};
// How big a friend whose feet are at this point of the yard is drawn (views.js place).
const friendDepth = foot => depthScale(footTarget({ pet: { size: 96 } }, foot.x, foot.y, 0).y);
const near = (a, b, within = 1e-6) => Math.abs(a - b) <= within;

test('a gift farther back is drawn smaller about its foot, as a friend standing there is', t => {
  const decor = [
    { id: 'back', kind: 'bench', x: 0.3, y: 0 },
    { id: 'front', kind: 'bench', x: 0.7, y: 1 },
  ];
  const nodes = yardOf(t, { garden: { decor } });
  const [back, front] = buttons(nodes, 'decor').map(box);
  const [w, h] = giftKind('bench').size.map(v => v * 1.05 * propZoom()),
    foot = giftKind('bench').foot ?? 1;
  for (const [drawn, item] of [
    [back, decor[0]],
    [front, decor[1]],
  ]) {
    const at = fieldToYard(item),
      depth = friendDepth(at);
    assert.ok(near(drawn.w, w * depth), `${item.id}: ${drawn.w} is ${w} at the depth ${depth}`);
    assert.ok(near(drawn.h, h * depth));
    assert.ok(near(drawn.x + drawn.w / 2, at.x), 'about its middle');
    assert.ok(near(drawn.y + drawn.h * foot, at.y), 'still standing on its foot');
  }
  assert.ok(back.w < front.w * 0.9, `${back.w} at the back, ${front.w} at the front`);
});

test('a flower and a planted tree farther back are drawn smaller about their foot too', t => {
  const plants = [
      { id: 'p-back', kind: 'daisy', planted: Date.now() - DAY, bloomed: true, x: 0.2, y: 0 },
      { id: 'p-front', kind: 'daisy', planted: Date.now() - DAY, bloomed: true, x: 0.6, y: 1 },
    ],
    trees = [
      { id: 't-back', kind: 'cherry', world: 'woodland', planted: Date.now() - 400 * DAY, x: 0.4, y: 0.02 },
      { id: 't-front', kind: 'cherry', world: 'woodland', planted: Date.now() - 400 * DAY, x: 0.85, y: 0.98 },
    ];
  const nodes = yardOf(t, { garden: { plants, trees } });
  for (const [cls, items] of [
    ['plant', plants],
    ['planted-tree', trees],
  ]) {
    const [back, front] = buttons(nodes, cls).map(box);
    const ratio = friendDepth(fieldToYard(items[0])) / friendDepth(fieldToYard(items[1]));
    assert.ok(near(back.w / front.w, ratio, 1e-3), `${cls}: ${back.w / front.w} ≈ ${ratio}`);
    assert.ok(ratio < 0.9);
  }
  const tree = buttons(nodes, 'planted-tree').map(box)[1],
    at = fieldToYard(trees[1]);
  assert.ok(near(tree.w, treeSize('cherry', 2)[0] * propZoom() * friendDepth(at)));
  assert.ok(near(tree.y + tree.h, at.y), 'a tree stands on its foot');
});

test('what friends walk around is the size drawn: a gift and a tree at the back take less ground', () => {
  const bounds = { width: 1000, height: 700, top: 350, bottom: 650 };
  const profile = buildGroundProfile({
    world: { id: 'meadow', capabilities: { sky: true } },
    worldId: 'meadow',
    bounds,
    scale: 1,
    // Half size at the field's top, whole at its foot: 0.55 a tenth of the way down.
    depthScaleAt: (px, py) => 0.5 + (0.5 * (py - bounds.top)) / (bounds.bottom - bounds.top),
    garden: {
      decor: [
        { kind: 'lantern', x: 0.3, y: 0.1 },
        { kind: 'lantern', x: 0.7, y: 1 },
      ],
      trees: [
        { kind: 'cherry', world: 'meadow', planted: 0, x: 0.2, y: 0.1 },
        { kind: 'cherry', world: 'meadow', planted: 0, x: 0.8, y: 1 },
      ],
      plants: [
        { x: 0.4, y: 0.1 },
        { x: 0.6, y: 1 },
      ],
    },
    now: 400 * DAY,
  });
  const [treeBack, treeFront, giftBack, giftFront, plantBack, plantFront] = profile.obstacles;
  for (const [back, front] of [
    [treeBack, treeFront],
    [giftBack, giftFront],
    [plantBack, plantFront],
  ]) {
    assert.ok(near(back.rx / front.rx, 0.55, 1e-6), `${back.rx} at the back, ${front.rx} at the front`);
  }
  const wide = b => b.right - b.left,
    [treeBodyBack, treeBodyFront, giftBodyBack, giftBodyFront] = profile.bodies.map(wide);
  assert.ok(
    near(treeBodyBack / treeBodyFront, 0.55, 1e-6) && near(giftBodyBack / giftBodyFront, 0.55, 1e-6),
    'and draw over less',
  );
});

// A room's furniture is drawn at the picture's scale; a gift set in it is furniture too, so it
// keeps that scale even where friends are drawn larger than the picture so they still read.
test("in a room, a gift is drawn at the picture's own scale while friends keep theirs", t => {
  const nodes = yardOf(t, {
    world: 'workshop',
    width: 700,
    height: 460,
    garden: { decor: [{ id: 'room-bench', kind: 'bench', x: 0.5, y: 1 }] },
  });
  const picture = Math.max(700 / 1536, 460 / 1024) / (850 / 1024);
  assert.ok(near(propZoom(), picture), `${propZoom()} is the picture's ${picture}`);
  assert.ok(yardZoom() > propZoom(), 'friends stay large enough to read');
  const [bench] = buttons(nodes, 'decor').map(box);
  const at = fieldToYard({ x: 0.5, y: 1 });
  assert.ok(near(bench.w, giftKind('bench').size[0] * 1.05 * picture * friendDepth(at)));
  // Outdoors the two are the same.
  scene.world = 'woodland';
  measureYard();
  assert.equal(propZoom(), yardZoom());
});

test('a gift dropped inside a room’s furniture goes back, and shows it may not stand there while dragged', async t => {
  const workshop = shipped.find(w => w.id === 'workshop'),
    [desk] = workshop.geometry.blocks;
  // A yard the picture's size, so its fractions are the yard's.
  const nodes = yardOf(t, {
    world: 'workshop',
    width: 1536,
    height: 1024,
    garden: { decor: [{ id: 'room-lantern', kind: 'lantern', x: 0.5, y: 0.9 }] },
  });
  const [button] = buttons(nodes, 'decor'),
    original = button.style.transform,
    from = fieldToYard({ x: 0.5, y: 0.9 });
  await button.dispatch('pointerdown', { button: 0, clientX: from.x, clientY: from.y, pointerId: 3 });
  await button.dispatch('pointermove', { clientX: desk.x * 1536, clientY: desk.y * 1024, pointerId: 3 });
  assert.ok(button.classList.contains('invalid'), 'over the desk it shows it may not stand there');
  await button.dispatch('pointerup', { pointerId: 3 });
  assert.equal(requests.length, 0, 'nothing is saved');
  assert.equal(button.style.transform, original, 'it goes back where it was');
  assert.ok(!button.classList.contains('invalid'));
  // On the open floor in front of the desks it is set down.
  await button.dispatch('pointerdown', { button: 0, clientX: from.x, clientY: from.y, pointerId: 4 });
  await button.dispatch('pointermove', { clientX: from.x + 40, clientY: from.y - 10, pointerId: 4 });
  assert.ok(!button.classList.contains('invalid'));
  await button.dispatch('pointerup', { pointerId: 4 });
  assert.equal(requests.length, 1);
  // An arrow key that would take it into the furniture leaves it where it is: a step below the desk.
  requests = [];
  const f = field(),
    below = ((desk.y + desk.ry * 1.08) * 1024 - f.top) / (f.bottom - f.top);
  state.data.garden.decor[0] = { id: 'room-lantern', kind: 'lantern', x: (desk.x * 1536 - 14) / (1536 - 28), y: below };
  renderDecor();
  await button.dispatch('keydown', { key: 'ArrowUp', preventDefault() {} });
  assert.equal(requests.length, 0, 'not onto the desk');
  await button.dispatch('keydown', { key: 'ArrowDown', preventDefault() {} });
  assert.equal(requests.length, 1, 'away from it, it moves');
});

// The picture takes the morning, the evening and the rain as a filter and a tint (environment.js);
// the drawings on it take the same, as one SVG colour matrix each (index.html), switched by the
// yard's period and weather classes (garden.css).
const LIGHTS = [
  ['morning-light', 'morning', 'clear', '.yard.period-morning'],
  ['evening-light', 'evening', 'clear', '.yard.period-evening'],
  ['rain-light', 'day', 'rain', '.yard.weather-rain'],
  ['morning-rain-light', 'morning', 'rain', '.yard.period-morning.weather-rain'],
  ['evening-rain-light', 'evening', 'rain', '.yard.period-evening.weather-rain'],
];
// A CSS filter list of brightness() and saturate() and a #rrggbbaa tint laid over it, as the 4 x 5
// matrix of feColorMatrix (unpremultiplied sRGB).
function lightMatrix(filter, tint) {
  let m = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (const [, name, value] of filter.matchAll(/(brightness|saturate)\(([\d.]+)\)/g)) {
    const s = Number(value);
    const f =
      name === 'brightness'
        ? [
            [s, 0, 0],
            [0, s, 0],
            [0, 0, s],
          ]
        : [
            [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
            [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
            [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
          ];
    m = f.map(row => [0, 1, 2].map(j => row.reduce((sum, v, k) => sum + v * m[k][j], 0)));
  }
  const [r, g, b, a] = (tint ?? '#00000000')
    .slice(1)
    .match(/../g)
    .map(h => Number.parseInt(h, 16) / 255);
  return [r, g, b].map((c, i) => [...m[i].map(v => v * (1 - a)), 0, c * a]);
}

test('gifts, flowers and trees take the morning, the evening and the rain as the picture does', async () => {
  const html = await readFile('src/index.html', 'utf8'),
    css = await readFile('src/styles/garden.css', 'utf8');
  for (const [id, period, weather, selector] of LIGHTS) {
    const { filter, tint } = environmentLook({ world: 'woodland', season: 'summer', period, weather });
    const values = html
      .match(new RegExp(`<filter id="${id}"[^>]*><feColorMatrix type="matrix" values="([^"]+)"`))?.[1]
      ?.trim()
      .split(/\s+/)
      .map(Number);
    assert.ok(values?.length === 20, `index.html has #${id}`);
    const expected = [...lightMatrix(filter, tint).flat(), 0, 0, 0, 1, 0];
    for (const [i, v] of expected.entries())
      assert.ok(Math.abs(values[i] - v) < 0.002, `#${id}[${i}]: ${values[i]} is ${v.toFixed(4)}`);
    assert.match(css, new RegExp(`${selector.replaceAll('.', '\\.')} \\{\\s*--prop-light: url\\(#${id}\\);`));
  }
  assert.match(css, /\.yard\.period-night \{\s*--prop-light: url\(#night-tint\);/);
  for (const thing of ['.decor svg', '.plant svg > use', '.planted-tree svg > use'])
    assert.match(css, new RegExp(`${thing.replace('.', '\\.')} \\{[^}]*filter: var\\(--prop-light, none\\)`), thing);
});
