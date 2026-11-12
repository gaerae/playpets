import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
    const [[tag, attrs, json]] = appStructuredData(page, site, {
      description: 'About',
      version: '1.2.0',
      alternateName: lang === 'en' ? undefined : `Name-${lang}`,
      genre: ['Desktop Companion', `Tag-${lang}`],
    });
    assert.equal(tag, 'script');
    assert.equal(attrs.type, 'application/ld+json');
    const data = JSON.parse(json);
    assert.equal(data['@type'], 'SoftwareApplication');
    assert.equal(data.inLanguage, lang);
    assert.equal(data.description, 'About');
    assert.equal(data.softwareVersion, '1.2.0');
    assert.equal(data.offers.price, '0');
    // The name as said in the page's language, and the kind of app in Steam's own tag words.
    assert.equal(data.alternateName, lang === 'en' ? undefined : `Name-${lang}`);
    assert.equal(data.applicationSubCategory, 'Desktop Companion');
    assert.deepEqual(data.genre.slice(0, 2), ['Desktop Companion', 'Idler']);
    assert.ok(data.genre.includes(`Tag-${lang}`), data.genre);
    assert.equal(data.genre.filter(tag => tag === 'Desktop Companion').length, 1, 'said once');
    assert.match(data.operatingSystem, /macOS.*Windows.*Linux/);
    assert.ok(data.url.startsWith(site));
    // A real screen of the app in the page's language, from the published captures.
    const dir = lang === 'zh-Hans' ? 'zh-hans' : lang;
    assert.ok(data.screenshot.startsWith(`${site}shots/`), data.screenshot);
    assert.ok(data.screenshot.endsWith(`/${dir}/yard-talk.webp`), data.screenshot);
    assert.ok(
      existsSync(new URL(`../website/public/${data.screenshot.slice(site.length)}`, import.meta.url)),
      data.screenshot,
    );
  }
  for (const page of ['guide/faq.md', 'ko/guide/chat.md', 'dev/index.md'])
    assert.deepEqual(appStructuredData(page, site, { description: 'x', version: '1' }), []);
  // A description is not code: a closing script tag in it cannot end the block early.
  const [[, , json]] = appStructuredData('index.md', site, { description: '</script><b>', version: '1' });
  assert.doesNotMatch(json, /<\/script/i);
  assert.equal(JSON.parse(json).description, '</script><b>');
});

test('each landing gives search engines its keywords, and only the landing does', async () => {
  const { landingKeywords } = await import('../website/.vitepress/locale-head.mjs');
  assert.deepEqual(landingKeywords('ja/index.md', ['a', 'b']), [['meta', { name: 'keywords', content: 'a, b' }]]);
  for (const page of ['guide/faq.md', 'ko/guide/chat.md']) assert.deepEqual(landingKeywords(page, ['a']), []);
});

test('a page without its own description is described by its first paragraph', async () => {
  const { leadDescription } = await import('../website/.vitepress/locale-head.mjs');
  // The FAQ's first answer, not its headings, with links and emphasis read as plain words.
  assert.equal(
    leadDescription(
      '# FAQ\n\n## What is PlayPets?\n\n- PlayPets is a **free**, [open-source](https://x.test) `app`.\n- More.\n',
    ),
    'PlayPets is a free, open-source app.',
  );
  // A release page: the frontmatter and the components before the prose are skipped.
  assert.equal(
    leadDescription(
      '---\nversion: 1.4.0\n---\n\n# 1.4.0\n\n<ReleaseMeta />\n\nGifts now come\nfrom friends.\n\n<Downloads />\n',
    ),
    'Gifts now come from friends.',
  );
  // A heading right above its text, and code (even with blank lines in it) are not the description.
  assert.equal(
    leadDescription('# Decision\n\n## Context\nVersion lived in three places.\n'),
    'Version lived in three places.',
  );
  assert.equal(
    leadDescription('# Map\n\n```mermaid\nflowchart\n\n  a --> b\n```\n\nThe app has three parts.\n'),
    'The app has three parts.',
  );
  // Items nested under the first one read as a list, not run together.
  assert.equal(
    leadDescription('# Scope\n\n- One install:\n  - the yard\n  - the backend\n- Elsewhere\n'),
    'One install: the yard, the backend',
  );
  // The landing is all component: it keeps the description its language sets.
  assert.equal(leadDescription('---\nlayout: page\n---\n\n<Landing />\n'), '');
  const long = leadDescription(`# Long\n\n${'word '.repeat(60)}`);
  // Cut at a word, never in the middle of one.
  assert.ok(long.length <= 160 && long.endsWith('word…'), long);
  const wide = leadDescription(`# 长\n\n${'伙伴们在院子里一起玩。'.repeat(30)}`);
  assert.ok(wide.length <= 160 && wide.endsWith('…'), wide);
});

test('every FAQ is also read as questions and answers, and only the FAQ', async () => {
  const { faqStructuredData } = await import('../website/.vitepress/locale-head.mjs');
  for (const dir of ['', 'ko/', 'ja/', 'zh-hans/']) {
    const page = `${dir}guide/faq.md`;
    const markdown = read(`website/${page}`);
    const [[tag, attrs, json]] = faqStructuredData(page, markdown);
    assert.equal(tag, 'script');
    assert.equal(attrs.type, 'application/ld+json');
    const data = JSON.parse(json);
    assert.equal(data['@type'], 'FAQPage');
    const questions = [...markdown.matchAll(/^## (.+)$/gm)].map(([, title]) => title);
    assert.deepEqual(
      data.mainEntity.map(entry => entry.name),
      questions,
      dir || 'en',
    );
    for (const entry of data.mainEntity) {
      assert.equal(entry['@type'], 'Question');
      assert.equal(entry.acceptedAnswer['@type'], 'Answer');
      assert.ok(entry.acceptedAnswer.text.length > 20, entry.name);
      assert.doesNotMatch(entry.acceptedAnswer.text, /\]\(|\*\*|^- /m, entry.name);
    }
  }
  for (const page of ['index.md', 'guide/chat.md', 'dev/index.md'])
    assert.deepEqual(faqStructuredData(page, '## Q\n\nA.'), []);
  const [[, , json]] = faqStructuredData('guide/faq.md', '## Why </script>?\n\n- Because <b>.\n');
  assert.doesNotMatch(json, /<\/script/i);
});

test('a release page is titled with its version and headline', async () => {
  const { releaseTitle } = await import('../website/.vitepress/locale-head.mjs');
  assert.equal(releaseTitle({ version: '1.4.0', headline: 'Gifts from friends' }), '1.4.0: Gifts from friends');
  assert.equal(releaseTitle({ version: '1.4.0' }), '1.4.0');
  assert.equal(releaseTitle({ title: 'Guide' }), undefined);
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
