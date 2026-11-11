import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// The tokens of one block in base.css (the light :root, or the dark one), with var() resolved
// against the light values a dark block leaves alone.
const tokens = (block, fallback = {}) => {
  const own = Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]));
  const all = { ...fallback, ...own };
  const resolve = value => value.replace(/var\((--[\w-]+)\)/g, (_, name) => resolve(all[name] ?? ''));
  return Object.fromEntries(Object.keys(all).map(name => [name, resolve(all[name])]));
};

const schemes = async () => {
  const css = (await readFile('src/styles/base.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  const light = tokens(css.match(/(?:^|\n):root\s*\{([^}]*)\}/)[1]);
  const dark = tokens(css.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/)[1], light);
  return { light, dark };
};

const rgb = hex => {
  const h = hex.replace('#', '');
  const full = h.length <= 4 ? [...h].map(c => c + c).join('') : h;
  assert.equal(full.length, 6, `${hex} is an opaque colour`);
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255);
};
const luminance = hex => {
  const [r, g, b] = rgb(hex).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Words on the surfaces they are drawn on, in both schemes, at the 4.5:1 that WCAG asks of text.
const pairs = [
  ...['--ink', '--muted'].flatMap(text =>
    ['--panel-surface', '--paper', '--white', '--field-surface', '--soft'].map(surface => [text, surface]),
  ),
  ['--danger', '--danger-soft'],
  ['--danger', '--panel-surface'],
  ['--green-ink', '--green-soft'],
  ['--pink-ink', '--pink-soft'],
  ['--amber-ink', '--amber-soft'],
  ['--on-ink', '--bubble-user'],
  ['--ink', '--bubble-friend'],
  ['--ink', '--bubble-peer'],
  ['--peer-ink', '--bubble-peer'],
  ['--scene-on-accent', '--scene-accent'],
  ['--ink', '--control-selected'],
  ['--ink', '--control-hover'],
];

for (const scheme of ['light', 'dark'])
  test(`words read on their surfaces in ${scheme} mode`, async () => {
    const values = (await schemes())[scheme];
    const low = pairs
      .map(([text, surface]) => [text, surface, ratio(values[text], values[surface])])
      .filter(([, , r]) => r < 4.5)
      .map(([text, surface, r]) => `${text} on ${surface}: ${r.toFixed(2)}`);
    assert.deepEqual(low, []);
  });
