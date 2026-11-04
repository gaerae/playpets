import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createSequence, createTaps, createTurns, SPUN, stayToWatch } from '../src/yard/touches.js';

test('taps count only when enough of them fall close together', () => {
  const taps = createTaps(7, 4000);
  const run = times => times.map(now => taps.tap(now));
  assert.deepEqual(run([0, 500, 1000, 1500, 2000, 2500]), Array(6).fill(false));
  assert.equal(taps.tap(3000), true);
  assert.equal(taps.tap(3100), false, 'and start again after');
  const slow = createTaps(7, 4000);
  assert.ok([0, 900, 1800, 2700, 3600, 4500, 5400].every(now => !slow.tap(now)));
});

test('a sequence of keys counts however many stray keys come before it', () => {
  const codes = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
    'KeyB',
    'KeyA',
  ];
  const keys = createSequence(codes);
  const typed = ['KeyX', 'ArrowUp', ...codes].map(code => keys.press(code));
  assert.equal(typed.at(-1), true);
  assert.equal(typed.filter(Boolean).length, 1);
  assert.equal(keys.press('KeyA'), false);
  const wrong = createSequence(codes);
  assert.ok(
    codes
      .slice(0, -1)
      .concat('KeyB')
      .every(code => !wrong.press(code)),
  );
});

const circle = (turns, r = 60, step = 10) =>
  Array.from({ length: Math.round((turns * 360) / step) + 1 }, (_, i) => {
    const a = (i * step * Math.PI) / 180;
    return [200 + r * Math.cos(a), 200 + r * Math.sin(a)];
  });
const turned = points => {
  const turns = createTurns();
  for (const [x, y] of points) turns.add(x, y);
  return turns.total();
};

test('three circles drawn while dragging turn far enough, either way round', () => {
  assert.ok(turned(circle(3)) >= SPUN);
  assert.ok(-turned(circle(3).map(([x, y]) => [x, 400 - y])) >= SPUN);
  assert.ok(Math.abs(turned(circle(2))) < SPUN);
});

test('dragging straight, shaking or wobbling does not add up to a turn', () => {
  assert.ok(Math.abs(turned(Array.from({ length: 50 }, (_, i) => [i * 8, 100]))) < 0.01);
  const shake = Array.from({ length: 60 }, (_, i) => [100 + (i % 2) * 30, 100 + (i % 3)]);
  assert.ok(Math.abs(turned(shake)) < SPUN);
  assert.equal(
    turned([
      [0, 0],
      [1, 1],
      [2, 0],
      [1, -1],
      [0, 0],
    ]),
    0,
    'jitter below a few pixels is ignored',
  );
});

test('friends put off their next stroll until the show is over', () => {
  const friends = [{ nextWander: 100 }, { nextWander: 30_000 }, {}];
  stayToWatch(friends, 12_000);
  assert.deepEqual(
    friends.map(f => f.nextWander),
    [12_000, 30_000, 12_000],
  );
});

test('a dizzy friend spins, wobbles to a stop under circling stars, and keeps still with reduced motion', async () => {
  const css = (await readFile('src/styles/friends.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.yard-pet\.dizzy > canvas\s*\{[^}]*animation:\s*dizzy/);
  assert.match(css, /\.yard-pet\.dizzy::after\s*\{[^}]*spark\.svg/, 'stars over its head');
  const spin = css.match(/@keyframes dizzy\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(spin, /rotate\(-?360deg\)/, 'one whole turn first');
  const still = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/g)]
    .map(m => m[1])
    .join('');
  assert.match(still, /\.yard-pet\.dizzy/);
});
