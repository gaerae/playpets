import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';

const requests = [];
globalThis.playPets = Object.fromEntries(
  ['findSeed', 'bloomed'].map(method => [
    method,
    () =>
      new Promise(resolve => {
        requests.push({ method, resolve });
      }),
  ]),
);
globalThis.matchMedia = () => ({ matches: true });
const { setData, views } = await import('../src/core/state.js');
const { gardenTick, renderGarden } = await import('../src/yard/garden.js');

function page() {
  const nodes = new Map();
  const element = () => ({
    style: {},
    dataset: {},
    children: [],
    listeners: new Map(),
    setAttribute() {},
    querySelector() {
      return element();
    },
    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    },
    append(...children) {
      this.children.push(...children);
    },
    remove() {
      this.removed = true;
    },
    matches: () => false,
  });
  for (const id of ['garden-layer', 'seed-count', 'plant-tool', 'toast', 'yard']) nodes.set(id, element());
  nodes.get('yard').getBoundingClientRect = () => ({ width: 800, height: 560 });
  globalThis.document = {
    body: { classList: { contains: () => false } },
    getElementById: id => nodes.get(id),
    createElement: element,
  };
  requests.length = 0;
  return nodes;
}

const settled = async () => {
  for (let turn = 0; turn < 5; turn++) await Promise.resolve();
};

test('a seed stays visible through a failed pickup and retries without duplicate requests', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  context.mock.method(Math, 'random', () => 0);
  const nodes = page();
  setData({ garden: { seeds: 0, plants: [] }, bonds: {} });
  views.clear();
  views.set('friend', { pet: { id: 'friend', size: 112 }, px: 100, py: 200, bubble: {} });
  gardenTick(1000);
  gardenTick(61_000);
  const seed = nodes.get('garden-layer').children[0];
  assert.ok(seed);
  const click = () => seed.listeners.get('click')({ stopPropagation() {} });
  click();
  try {
    assert.notEqual(seed.removed, true, 'the seed remains until the backend accepts it');
    assert.equal(seed.disabled, true);
    click();
    assert.equal(requests.length, 1, 'pending clicks share one pickup');
    requests[0].resolve({ ok: false, error: 'The seed could not be saved.' });
    await settled();
    assert.equal(nodes.get('toast').textContent, 'The seed could not be saved.');
    assert.equal(seed.disabled, false);
    assert.notEqual(seed.removed, true);
    context.mock.timers.tick(14_999);
    assert.equal(requests.length, 1);
    context.mock.timers.tick(1);
    assert.equal(requests.length, 2, 'a delayed retry can recover while the yard is idle');
    nodes.get('toast').textContent = '';
    requests[1].resolve({ ok: false, error: 'The seed could not be saved.' });
    await settled();
    assert.equal(nodes.get('toast').textContent, '', 'a background retry says nothing the second time');
    context.mock.timers.tick(15_000);
    requests[2].resolve({ ok: true, data: true });
    await settled();
    assert.equal(seed.removed, true);
  } finally {
    for (const request of requests) request.resolve({ ok: true, data: true });
    await settled();
    views.clear();
  }
});

test('a failed bloom remains eligible after a delay and only successful blooms are remembered', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const nodes = page();
  const now = 20_000_000;
  let clock = now;
  context.mock.method(Date, 'now', () => clock);
  setData({ garden: { seeds: 0, plants: [{ id: 'flower-retry', kind: 'daisy', planted: 1000, x: 0.5, y: 0.5 }] } });
  renderGarden(now);
  renderGarden(now + 1);
  assert.equal(requests.length, 1, 'drawing again does not duplicate a pending bloom');
  clock = now + 20_000;
  requests[0].resolve({ ok: false, error: 'The flower could not be saved.' });
  await settled();
  assert.equal(nodes.get('toast').textContent, 'The flower could not be saved.');
  renderGarden(clock + 14_999);
  assert.equal(requests.length, 1);
  renderGarden(clock + 15_000);
  assert.equal(requests.length, 2, 'a failed bloom is retried after the delay');
  nodes.get('toast').textContent = '';
  clock += 20_000;
  requests[1].resolve({ ok: false, error: 'The flower could not be saved.' });
  await settled();
  assert.equal(nodes.get('toast').textContent, '', 'a repeated failure is retried quietly');
  renderGarden(clock + 15_000);
  requests[2].resolve({ ok: true, data: { entry: { count: 2 } } });
  await settled();
  renderGarden(clock + 60_000);
  assert.equal(requests.length, 3, 'a successful bloom stays counted once');
});
