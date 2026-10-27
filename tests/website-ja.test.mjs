import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('Japanese landing uses Japanese fonts and keeps phrases whole when it breaks lines', () => {
  const css = read('website/.vitepress/theme/style.css') + read('website/.vitepress/theme/landing.css');
  assert.match(css, /html\[lang\^="ja"\]\s*\{[^}]*--vp-font-family-base:[^}]*"Hiragino Sans"/s);
  // Browsers without phrase breaking fall back to normal CJK breaks, never keep-all.
  assert.match(css, /html\[lang\^="ja"\] \.landing\s*\{\s*word-break: normal;/);
  assert.match(
    css,
    /@supports \(word-break: auto-phrase\) \{\s*html\[lang\^="ja"\] \.landing\s*\{\s*word-break: auto-phrase;/,
  );
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
  for (const component of ['words.ts', 'creation-copy.js'])
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

test('each landing describes the app to search and answer engines, and only the landing does', async () => {
  const { appStructuredData } = await import('../website/.vitepress/locale-head.mjs');
  const site = 'https://example.test/playpets/';
  for (const [page, lang] of [
    ['index.md', 'en'],
    ['ko/index.md', 'ko'],
    ['ja/index.md', 'ja'],
    ['zh-hans/index.md', 'zh-Hans'],
  ]) {
    const [[tag, attrs, json]] = appStructuredData(page, site, { description: 'About', version: '1.2.0' });
    assert.equal(tag, 'script');
    assert.equal(attrs.type, 'application/ld+json');
    const data = JSON.parse(json);
    assert.equal(data['@type'], 'SoftwareApplication');
    assert.equal(data.inLanguage, lang);
    assert.equal(data.description, 'About');
    assert.equal(data.softwareVersion, '1.2.0');
    assert.equal(data.offers.price, '0');
    assert.match(data.operatingSystem, /macOS.*Windows.*Linux/);
    assert.ok(data.url.startsWith(site));
  }
  for (const page of ['guide/faq.md', 'ko/guide/chat.md', 'dev/index.md'])
    assert.deepEqual(appStructuredData(page, site, { description: 'x', version: '1' }), []);
  // A description is not code: a closing script tag in it cannot end the block early.
  const [[, , json]] = appStructuredData('index.md', site, { description: '</script><b>', version: '1' });
  assert.doesNotMatch(json, /<\/script/i);
  assert.equal(JSON.parse(json).description, '</script><b>');
});

test('crawlers find the sitemap, and answer engines get a short summary of the app', () => {
  const site = JSON.parse(read('package.json')).homepage;
  assert.match(read('website/public/robots.txt'), new RegExp(`^Sitemap: ${site}sitemap\\.xml$`, 'm'));
  const llms = read('website/public/llms.txt');
  assert.match(llms, /^# PlayPets$/m);
  for (const fact of ['Codex pet', 'Claude Code', 'Gemini CLI', 'Cursor', 'MIT', 'not affiliated with OpenAI'])
    assert.ok(llms.includes(fact), fact);
  for (const page of ['guide/faq', 'guide/import', 'guide/agents']) assert.ok(llms.includes(`${site}${page}`), page);
});

test('every FAQ opens with what PlayPets is and how it relates to Codex pets', () => {
  for (const [dir, what, codex] of [
    ['', 'What is PlayPets?', 'Does it work with Codex pets?'],
    ['ko/', 'PlayPets는 어떤 앱인가요?', 'Codex 펫도 쓸 수 있나요?'],
    ['ja/', 'PlayPetsはどんなアプリですか？', 'Codexのペットも使えますか？'],
    ['zh-hans/', 'PlayPets 是什么？', '能用 Codex 宠物吗？'],
  ]) {
    const headings = [...read(`website/${dir}guide/faq.md`).matchAll(/^## (.+)$/gm)].map(([, title]) => title);
    assert.deepEqual(headings.slice(0, 2), [what, codex], dir || 'en');
  }
});
