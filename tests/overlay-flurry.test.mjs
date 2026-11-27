// A short flurry over the desktop grass (overlay/flurry.js): a few petals, leaves or flakes of the
// season drift down around a friend someone was just with, then nothing moves. It comes rarely, never
// in summer, with reduced motion or while the grass is hidden, and leaves nothing behind.

import assert from 'node:assert/strict';
import test from 'node:test';
import { element, installDom } from './support/dom.mjs';

async function flurry(t, options = {}) {
  installDom(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let clock = 0;
  const host = element('div');
  const reduced = { matches: false };
  const { setupFlurry, FLURRY_GAP_MS } = await import('../src/overlay/flurry.js');
  const fall = setupFlurry({ host, reduced, now: () => clock, random: () => 0.5, ...options });
  const layers = () => host.children.filter(c => !c.removed);
  return { fall, host, reduced, layers, gap: FLURRY_GAP_MS, later: ms => (clock += ms) };
}

test('each season but summer has its own flurry, and it comes no more than once in a while', async t => {
  const { fall, layers, later, gap } = await flurry(t);
  fall.season('summer');
  assert.equal(fall.fall(300, 1000), false, 'nothing falls in summer');
  for (const [season, kind] of [
    ['spring', 'petal'],
    ['autumn', 'leaf'],
    ['winter', 'snow'],
  ]) {
    fall.season(season);
    assert.equal(fall.fall(300, 1000), true, season);
    assert.ok(layers().at(-1).classList.contains(`flurry-${kind}`));
    assert.equal(fall.fall(300, 1000), false, 'not again so soon');
    later(gap);
  }
  assert.ok(gap >= 3 * 60_000, 'a flurry is a moment, not weather');
});

test('it falls around the friend, on the grass, and goes once its last bit lands', async t => {
  const { fall, layers } = await flurry(t);
  fall.season('spring');
  fall.fall(20, 600);
  const [layer] = layers();
  assert.ok(layer.children.length >= 5 && layer.children.length <= 9, 'a handful, not a storm');
  for (const bit of layer.children) {
    const x = parseFloat(bit.style['--x']);
    assert.ok(x >= 0 && x <= 600, `kept over the grass (${x})`);
  }
  t.mock.timers.tick(10_000);
  assert.equal(layers().length, 0, 'nothing is left moving');
});

test('no flurry with reduced motion or while the grass is hidden, and summer sweeps one away', async t => {
  const { fall, host, reduced, layers } = await flurry(t);
  fall.season('winter');
  reduced.matches = true;
  assert.equal(fall.fall(300, 1000), false);
  reduced.matches = false;
  host.hidden = true;
  assert.equal(fall.fall(300, 1000), false);
  host.hidden = false;
  assert.equal(fall.fall(300, 1000), true);
  fall.season('summer');
  assert.equal(layers().length, 0);
});

test('only the person being with a friend starts one, not an agent at work', async () => {
  const { readFile } = await import('node:fs/promises');
  const page = await readFile(new URL('../src/overlay/overlay.js', import.meta.url), 'utf8');
  const calls = page.split('\n').filter(line => line.includes('lawn.fall('));
  assert.equal(calls.length, 1);
  assert.match(calls[0], /event\.type === 'play'/);
  assert.doesNotMatch(calls[0], /status|say/);
});

test('each bit takes one of the fixed paths, and the paths read no variables so the compositor runs them', async t => {
  const { readFile } = await import('node:fs/promises');
  const css = (await readFile(new URL('../src/overlay/overlay.css', import.meta.url), 'utf8')).replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  const paths = [...css.matchAll(/@keyframes (flurry-fall-\d+) \{([\s\S]*?\n)\}/g)];
  assert.ok(paths.length >= 4, 'enough paths that a handful does not fall in step');
  for (const [, name, body] of paths) {
    assert.ok(!body.includes('var('), `${name} reads no variable`);
    for (const [, property] of body.matchAll(/([\w-]+)\s*:/g))
      assert.ok(['transform', 'opacity'].includes(property), `${name} moves ${property}`);
    assert.match(
      css,
      new RegExp(`\\.flurry-bit\\[data-path="${name.split('-').at(-1)}"\\]\\s*\\{\\s*animation-name: ${name};`),
    );
  }
  const { fall, layers } = await flurry(t, {
    random: (() => {
      let i = 0;
      return () => (i++ % 10) / 10;
    })(),
  });
  fall.season('autumn');
  fall.fall(300, 1000);
  const used = new Set(layers()[0].children.map(bit => bit.dataset.path));
  assert.ok(used.size > 1, 'not every bit on the same path');
  for (const path of used) assert.ok(Number(path) < paths.length, `path ${path} is drawn`);
});
