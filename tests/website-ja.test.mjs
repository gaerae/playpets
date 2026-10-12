import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('Japanese landing uses Japanese fonts and normal CJK line breaking', () => {
  const css = read('website/.vitepress/theme/style.css') + read('website/.vitepress/theme/landing.css');
  assert.match(css, /html\[lang\^="ja"\]\s*\{[^}]*--vp-font-family-base:[^}]*"Hiragino Sans"/s);
  assert.match(css, /html\[lang\^="ja"\] \.landing\s*\{\s*word-break: normal;/);
});
test('Japanese guides cover every English guide with localized prose and components', () => {
  for (const page of readdirSync(new URL('../website/guide/', import.meta.url))) {
    const text = read(`website/ja/guide/${page}`);
    assert.match(text, /[ぁ-んァ-ヶ]/u, page);
    assert.doesNotMatch(text, /lang="en"|\/ko\/|\/zh-hans\//u, page);
    for (const shot of read(`website/guide/${page}`).matchAll(/<Shot name="([^"]+)"/g)) {
      assert.ok(text.includes(`name="${shot[1]}"`), `${page}: ${shot[1]}`);
    }
  }
});
test('Japanese site includes release history and every shared interactive copy table', () => {
  for (const page of ['index.md', 'releases/index.md', 'releases/0.1.0.md'])
    assert.match(read(`website/ja/${page}`), /[ぁ-んァ-ヶ]/u);
  for (const component of ['words.ts', 'CreatorKit.vue', 'ExtensionPrompts.vue'])
    assert.match(read(`website/.vitepress/theme/${component}`), /\bja: \{/);
  assert.match(read('website/.vitepress/config.mts'), /lang: 'ja-JP'/);
  assert.match(read('website/.vitepress/theme/index.ts'), /ko\|ja\|zh-hans/);
});

test('locale SEO lists reciprocal existing pages and leaves developer docs in English', async () => {
  const { alternateLinks } = await import('../website/.vitepress/locale-head.mjs');
  const site = 'https://example.test/playpets/';
  const pages = new Set(['guide/chat.md', 'ko/guide/chat.md', 'ja/guide/chat.md', 'zh-hans/guide/chat.md']);
  const expected = ['en', 'ko', 'ja', 'zh-Hans', 'x-default'];
  for (const page of pages) {
    const links = alternateLinks(page, site, path => pages.has(path));
    assert.deepEqual(
      links.map(([, attrs]) => attrs.hreflang),
      expected,
    );
    assert.ok(links.some(([, attrs]) => attrs.href === `${site}ja/guide/chat`));
    assert.deepEqual(
      links,
      alternateLinks('guide/chat.md', site, path => pages.has(path)),
    );
  }
  assert.deepEqual(
    alternateLinks('dev/architecture.md', site, () => true),
    [],
  );
  assert.deepEqual(
    alternateLinks('guide/chat.md', site, path => path === 'guide/chat.md').map(([, attrs]) => attrs.hreflang),
    ['en', 'x-default'],
  );
  assert.ok(alternateLinks('ja/index.md', site, () => true).some(([, attrs]) => attrs.href === `${site}ja/`));
});
