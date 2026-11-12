import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const fishing = await readFile(new URL('../src/styles/play.css', import.meta.url), 'utf8');

test('the bobber has a stationary 44px target and visible keyboard focus', () => {
  const target = fishing.match(/\.bobber\s*\{([^}]+)\}/)[1];
  for (const dimension of ['width', 'height']) {
    const pixels = Number(target.match(new RegExp(`${dimension}:\\s*(\\d+)px`))[1]);
    assert.ok(pixels >= 44, `${dimension} gives the float a generous hit target`);
  }
  assert.doesNotMatch(target, /animation:/, 'motion belongs to the float rather than its hit area');
  assert.match(fishing, /\.bobber:focus-visible\s*\{[^}]*outline:/);
});

test('reduced motion overrides both resting and biting float animations', () => {
  const rules = [...fishing.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([^}]+\})/g)];
  const stop = rules.find(rule => rule[1].includes('.bobber::before'))?.[1];
  assert.ok(stop, 'the animated float is covered by reduced motion');
  assert.match(stop, /\.bobber\.bite::before/, 'the bite selector has enough specificity to stop dipping');
  assert.match(stop, /animation:\s*none/);
});

// A float sits in the water, not on it: its lower part fades under the surface and a ripple rings
// it at the waterline, which stays put on the target while the float bobs.
test('the float sits in the water with a ripple at its waterline', () => {
  const target = fishing.match(/\.bobber\s*\{([^}]+)\}/)[1];
  const float = fishing.match(/\.bobber::before\s*\{([^}]+)\}/)[1];
  assert.match(target, /background:\s*radial-gradient\(\s*ellipse/, 'the ripple is on the still target');
  assert.match(float, /mask-image:\s*linear-gradient\(/, 'the float fades below the waterline');
  assert.doesNotMatch(float, /box-shadow:/, 'no shadow cast on the water');
});
