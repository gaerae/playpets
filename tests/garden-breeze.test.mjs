// The breeze's beat for each flower and planted tree comes from the thing itself, so it holds while
// other things come and go in the garden layer (garden.css runs the sway from `--sway`).
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { element, installDom } from './support/dom.mjs';

globalThis.playPets = { bloomed: async () => ({ ok: true }) };
globalThis.matchMedia = () => ({ matches: true });
const state = await import('../src/core/state.js');
const { renderGarden } = await import('../src/yard/garden.js');
const { renderTrees } = await import('../src/yard/planted-trees.js');
const { measureYard } = await import('../src/yard/field.js');
const { scene } = await import('../src/yard/world.js');
const { swayDelay } = await import('../src/yard/props.js');

function page(t) {
  const previous = state.data,
    world = scene.world;
  t.after(() => {
    state.setData(previous);
    scene.world = world;
  });
  const { nodes } = installDom(t, {
    anyId: true,
    ids: ['garden-layer', 'seed-count', 'plant-tool', 'toast', 'yard', 'catch-card'],
    props: { rect: { width: 800, height: 560 } },
  });
  // A button's drawing is set through innerHTML, which the fake does not parse: hand back a node.
  const make = document.createElement.bind(document);
  document.createElement = tag => {
    const node = make(tag);
    if (tag === 'button') node.querySelector = () => element('svg');
    return node;
  };
  scene.world = 'woodland';
  measureYard();
  return nodes;
}
const layer = nodes => nodes.get('garden-layer').children;
const beatOf = (nodes, cls, kind) =>
  layer(nodes).find(b => b.className.split(' ').includes(cls) && b.dataset.kind === kind)?.style['--sway'];

test('a beat is a steady delay within one sway, the same for the same thing and spread over many', () => {
  const ids = Array.from({ length: 40 }, (_, i) => `plant-${i}`);
  const delays = ids.map(id => swayDelay(id));
  for (const [i, d] of delays.entries()) {
    assert.match(d, /^-\d+(\.\d+)?s$/, `${ids[i]} gets a negative delay in seconds`);
    assert.ok(Number.parseFloat(d) > -7 && Number.parseFloat(d) <= 0, `${d} is within a tree's sway`);
    assert.equal(swayDelay(ids[i]), d, 'the same thing keeps its beat');
  }
  assert.ok(new Set(delays).size >= 10, 'many things do not sway together');
});

test('a flower and a tree keep their beat when a thing ahead of them in the layer goes', t => {
  const nodes = page(t);
  const now = 20_000_000;
  const plants = [
    { id: 'first', kind: 'daisy', planted: 1000, x: 0.2, y: 0.6 },
    { id: 'second', kind: 'tulip', planted: 1000, x: 0.5, y: 0.6 },
  ];
  const tree = { id: 'oak-1', kind: 'oak', world: 'woodland', stage: 3, planted: 1000, x: 0.8, y: 0.4 };
  state.setData({ ...state.data, garden: { seeds: 0, plants, trees: [tree], decor: [] } });
  renderGarden(now);
  renderTrees();
  const tulip = beatOf(nodes, 'plant', 'tulip'),
    oak = beatOf(nodes, 'planted-tree', 'oak');
  assert.equal(tulip, swayDelay('second'));
  assert.equal(oak, swayDelay('oak-1'));
  state.setData({ ...state.data, garden: { seeds: 0, plants: [plants[1]], trees: [tree], decor: [] } });
  renderGarden(now);
  renderTrees();
  assert.equal(beatOf(nodes, 'plant', 'tulip'), tulip, 'the tulip keeps its beat');
  assert.equal(beatOf(nodes, 'planted-tree', 'oak'), oak, 'the tree keeps its beat');
});
