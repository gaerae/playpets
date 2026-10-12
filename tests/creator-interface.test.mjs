import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('creator workbench keeps prompts next to the selected pet and gates detailed references', async () => {
  const source = await readFile('website/.vitepress/theme/CreatorKit.vue', 'utf8');
  assert.match(source, /class="kit-workbench"/);
  assert.match(source, /v-model="promptIndex"/);
  assert.match(source, /entry\.hasDetailSheets/);
  assert.match(source, /VisibleSprite/);
  assert.doesNotMatch(source, /state="still"/);
  assert.match(source, /:deep\(\.sprite i\) \{ animation: none; \}/);
  assert.match(source, /--display-scale:\s*[\d.]+/);
  assert.match(source, /aria-live="polite"/);
});

test('creator studio is a primary destination in every locale', async () => {
  const config = await readFile('website/.vitepress/config.mts', 'utf8');
  for (const prefix of ['', 'ko/', 'ja/', 'zh-hans/']) {
    assert.ok(config.includes(`activeMatch: '^/${prefix}guide/creator-kit'`));
    const guide = await readFile(`website/${prefix}guide/creator-kit.md`, 'utf8');
    assert.match(guide, /sidebar: false/);
    assert.match(guide, /outline: false/);
    assert.match(guide, /aside: false/);
  }
});

test('compiled studio dark colors target the workbench rather than the document root', async () => {
  const { parse, compileStyle } = await import('@vue/compiler-sfc');
  const source = await readFile('website/.vitepress/theme/CreatorKit.vue', 'utf8');
  const { descriptor } = parse(source);
  const css = compileStyle({ source: descriptor.styles[0].content, id: 'studio-test', scoped: true }).code;
  assert.match(css, /\.dark \.creator-kit\s*\{\s*--kit-button-bg:/);
  assert.doesNotMatch(css, /\.dark\s*\{\s*--kit-button-bg:/);
});

test('every studio task explains its own required source images in every locale', async () => {
  const { runInNewContext } = await import('node:vm');
  const source = await readFile('website/.vitepress/theme/CreatorKit.vue', 'utf8');
  const words = runInNewContext(`(${source.match(/const words = ([\s\S]+?);\nconst t =/)[1]})`);
  for (const lang of ['en', 'ko', 'ja', 'zh-hans']) {
    assert.equal(words[lang].taskHints.length, words[lang].titles.length);
    assert.equal(new Set(words[lang].taskHints).size, 5);
    assert.match(words[lang].taskHints[3], /\[STATE\]/);
    assert.match(words[lang].taskHints[3], /\[EIGHT POSES\]/);
  }
  assert.match(words.en.taskHints[2], /not included in the ZIP/);
  assert.match(words.en.taskHints[4], /source rows/);
  assert.match(source, /t.taskHints\[promptIndex\]/);
});
