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

test('aiming a seed or playing a game, the keys and the right click leave a plant alone', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const nodes = page(context);
  const { setAiming, setGame } = await import('../src/core/state.js');
  context.after(() => {
    setAiming(false);
    setGame(null);
  });
  const now = 20_000_000;
  setData({ garden: { seeds: 0, plants: [{ id: 'flower-keys', kind: 'daisy', planted: 1000, x: 0.5, y: 0.5 }] } });
  renderGarden(now);
  const button = nodes.get('garden-layer').children.at(-1);
  setGame({});
  await button.dispatch('keydown', { key: 'Backspace' });
  await button.dispatch('contextmenu');
  setGame(null);
  setAiming(true);
  await button.dispatch('keydown', { key: 'Delete' });
  assert.equal(button.hidden, false, 'the plant stays in the garden');
  setAiming(false);
  await button.dispatch('keydown', { key: 'Delete' });
  assert.equal(button.hidden, true, 'outside a game the key pulls it up');
});

test('a flower keeps its name to itself until its bud shows, as a gift of the season it was planted in', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const nodes = page(context);
  // A young plant draws its stage, so each button needs the drawing's parts.
  const make = document.createElement.bind(document);
  document.createElement = tag => Object.assign(make(tag), { querySelector: () => element() });
  const { stageOf } = await import('../src/yard/growth.js');
  const now = 20_000_000;
  context.mock.method(Date, 'now', () => now);
  let bud = now - 1;
  while (stageOf(bud, now).name !== 'bud' && now - bud < 20_000_000) bud -= 60_000;
  assert.equal(stageOf(bud, now).name, 'bud');
  setData({
    garden: {
      seeds: 0,
      plants: [
        { id: 'flower-young', kind: 'tulip', planted: now - 1, x: 0.3, y: 0.5 },
        { id: 'flower-bud', kind: 'tulip', planted: bud, x: 0.6, y: 0.5 },
      ],
    },
  });
  renderGarden(now);
  const buttons = nodes.get('garden-layer').children.slice(-2);
  const budButton = buttons.find(b => b.title.includes('bud'));
  const youngButton = buttons.find(b => b !== budButton);
  assert.doesNotMatch(youngButton.title, /Tulip/, 'a seed does not tell which flower it will be');
  assert.match(youngButton.title, /A flower yet to show/);
  assert.match(budButton.title, /Tulip/, 'the bud shows its flower');
  await youngButton.dispatch('keydown', { key: 'Delete' });
  assert.doesNotMatch(nodes.get('toast').textContent, /Tulip/, 'pulling it up does not tell either');
  assert.match(nodes.get('toast').textContent, /Young plant pulled up/);
});

test('finding a seed and the seed tool both say the season it is planted in picks the flower', async () => {
  const { strings } = await import('../src/core/strings/en.js');
  assert.match(strings['discovery.seed'], /when we plant/);
  assert.match(strings['garden.plant_title'], /season/);
});
