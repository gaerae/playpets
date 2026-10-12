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
