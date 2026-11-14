import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { installDom, keepGlobals } from './support/dom.mjs';

globalThis.playPets = {};
const { setupSettings } = await import('../src/panel/settings.js');
const { setLanguageForTests } = await import('../src/core/i18n.js');
const { LANGUAGES } = await import('../src/core/strings.js');

// Each language's name is written in that language: a script the page's own fonts lack (简体中文
// under Korean, 한국어 under Japanese) would go through the system's font fallback, on Windows about
// 250 ms the first time, most of Settings' first opening.
test("each language's name in the picker says which language it is in", t => {
  keepGlobals(t, 'Option');
  globalThis.Option = class {
    constructor(text, value) {
      Object.assign(this, { text, value, lang: '' });
    }
  };
  const { nodes } = installDom(t, { anyId: true });
  for (const shown of Object.keys(LANGUAGES)) {
    setLanguageForTests(shown);
    setupSettings();
    const options = nodes.get('language').children;
    assert.deepEqual(
      options.map(o => [o.value, o.text, o.lang]),
      Object.entries(LANGUAGES).map(([code, name]) => [code, name, code]),
    );
  }
});

test("the language picker names every language's fonts, so no name waits for the system's fallback", async () => {
  const base = await readFile('src/styles/base.css', 'utf8'),
    settings = await readFile('src/styles/settings.css', 'utf8');
  const stack = name => base.match(new RegExp(`--font-${name}:([^;]+);`))?.[1] ?? '';
  for (const [code, font] of [
    ['ko', 'Malgun Gothic'],
    ['ja', 'Yu Gothic UI'],
    ['zh-hans', 'Microsoft YaHei UI'],
  ])
    assert.ok(stack(code).includes(font), `--font-${code} names ${font}, the Windows font for it`);
  // A closed picker is as wide as its longest name, measured in the picker's own fonts, not each
  // option's: the picker lists all three stacks, the page's own language first.
  const rule = selector =>
    settings.match(new RegExp(`(?:^|\\n)${selector.replace(/[()]/g, '\\$&')} \\{\\s*font-family: ([^;]+);`))?.[1];
  assert.equal(rule('#language'), 'var(--font-ko), var(--font-ja), var(--font-zh-hans)');
  assert.equal(rule(':root:lang(ja) #language'), 'var(--font-ja), var(--font-ko), var(--font-zh-hans)');
  assert.equal(rule(':root:lang(zh-hans) #language'), 'var(--font-zh-hans), var(--font-ko), var(--font-ja)');
});
