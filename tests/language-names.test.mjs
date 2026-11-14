import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { installDom, keepGlobals } from './support/dom.mjs';

globalThis.playPets = {};
const { setupSettings } = await import('../src/panel/settings.js');
const { setLanguageForTests } = await import('../src/core/i18n.js');
const { LANGUAGES } = await import('../src/core/strings.js');

// Each language's name is written in that language, so a script the page's own fonts lack (简体中文
// under Korean, 한국어 under Japanese) would go through the system's font fallback: on Windows the
// first time costs about 250 ms, the whole first opening of Settings.
test("each language's name in the picker carries its own language", t => {
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

test("a word in another language is drawn in that language's fonts, named before any fallback", async () => {
  const css = await readFile('src/styles/base.css', 'utf8');
  const stack = name => css.match(new RegExp(`--font-${name}:([^;]+);`))?.[1] ?? '';
  for (const [code, font] of [
    ['ko', 'Malgun Gothic'],
    ['ja', 'Yu Gothic UI'],
    ['zh-hans', 'Microsoft YaHei UI'],
  ]) {
    assert.ok(stack(code).includes(font), `--font-${code} names ${font}, the Windows font for it`);
    // Only an element that names its own language, not every element under a root in that language.
    assert.match(
      css,
      new RegExp(`\\[lang\\]:not\\(:root\\):lang\\(${code}\\)[^{]*\\{\\s*font-family: var\\(--font-${code}\\);`),
    );
  }
});
