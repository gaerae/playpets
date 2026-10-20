import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { element, installDom } from './support/dom.mjs';

const requests = [];
globalThis.playPets = Object.fromEntries(
  ['bloomed'].map(method => [
    method,
    () =>
      new Promise(resolve => {
        requests.push({ method, resolve });
      }),
  ]),
);
globalThis.matchMedia = () => ({ matches: true });
const { setData } = await import('../src/core/state.js');
const { renderGarden } = await import('../src/yard/garden.js');

function page(t) {
  const { nodes } = installDom(t, {
    ids: ['garden-layer', 'seed-count', 'plant-tool', 'toast', 'yard', 'catch-card'],
    props: { rect: { width: 800, height: 560 } },
  });
  nodes.get('catch-card').querySelector = () => element();
  requests.length = 0;
  return nodes;
}

const settled = async () => {
  for (let turn = 0; turn < 5; turn++) await Promise.resolve();
};

test('the garden cannot award seeds independently of digging', async () => {
  const garden = await import('../src/yard/garden.js');
  assert.equal('gardenTick' in garden, false);
});

test('a failed bloom remains eligible after a delay and only successful blooms are remembered', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const nodes = page(context);
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
