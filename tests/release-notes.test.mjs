// Release notes: one website page per version and language is the user notes for every system;
// each channel reads the lines for its own system, and the pages keep the writing rules
// (docs/decisions/2026-10-28-release-notes-by-audience.md).

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { setMetainfoRelease } from '../scripts/release-lib.mjs';
import { HEADINGS, pageProblems, pagesProblems, RULES_SINCE, userNotes } from '../scripts/release-page.mjs';
import { releasePagesFor, SITE_LANGS } from '../scripts/site-content.mjs';

const page = (intro, changes, also = [], lang = 'en') => {
  const [what, more] = HEADINGS[lang];
  const list = lines => lines.map(line => `- ${line}`).join('\n');
  return `---\nversion: 1.4.0\n---\n\n# 1.4.0\n\n<ReleaseMeta />\n\n${intro}\n\n<Downloads version="1.4.0" />\n\n## ${what}\n\n${list(changes)}\n${also.length ? `\n## ${more}\n\n${list(also)}\n` : ''}\nRead [the guide](../guide/play.md).\n`;
};

const RAIN = page(
  'Rain reaches the yard.',
  [
    'Rain falls on **the yard**.',
    '<Only os="macOS" /> The app opens faster.',
    '<Only os="Linux" /> The AppImage starts.',
  ],
  ['Install with [winget](../guide/install.md).', 'Security updates.'],
);

test('each system reads the opening sentence and its own "What changed" lines, as plain text', () => {
  assert.deepEqual(userNotes(RAIN, 'Windows'), {
    intro: 'Rain reaches the yard.',
    changes: ['Rain falls on the yard.'],
  });
  assert.deepEqual(userNotes(RAIN, 'macOS').changes, ['Rain falls on the yard.', 'The app opens faster.']);
  assert.deepEqual(userNotes(RAIN, 'Linux').changes, ['Rain falls on the yard.', 'The AppImage starts.']);
  assert.equal(userNotes(RAIN).changes.length, 3, 'without a system: every line, for the page itself');
  assert.throws(() => userNotes(RAIN.replace('os="Linux"', 'os="Amiga"'), 'Linux'), /Only os="Amiga"/);
});

test('a page keeps the rules: an opening sentence, short "What changed" lines, no commands, badges first', () => {
  assert.deepEqual(pageProblems(RAIN, 'en'), []);
  const problems = (text, lang = 'en') => pageProblems(text, lang).join('\n');
  assert.match(problems(page('', ['Rain falls.'])), /opening sentence/);
  assert.match(problems(page('Rain.', [])), /What changed/);
  assert.match(problems(page('Rain.', ['Copy `~/.grok/hooks/`.'])), /command or path/);
  assert.match(problems(page('Rain.', ['x'.repeat(101)])), /longer than 100/);
  assert.deepEqual(pageProblems(page('비가 와요.', ['가'.repeat(60)], [], 'ko'), 'ko'), []);
  assert.match(problems(page('비가 와요.', ['가'.repeat(61)], [], 'ko'), 'ko'), /longer than 60/);
  assert.match(problems(page('x'.repeat(201), ['Rain.'])), /opening sentence is longer than 200/);
  assert.match(problems(page('Rain.', ['Faster <Only os="macOS" /> on a Mac.'])), /start of its line/);
  assert.match(problems(page('Rain.', ['<Only os="macOS" /> <Only os="Linux" /> Faster.'])), /once/);
  // "Also" holds what needs a command or a link: install ways, the guide, security updates.
  assert.deepEqual(pageProblems(page('Rain.', ['Rain falls.'], ['Run `winget install`.']), 'en'), []);
});

test('a line can be for two systems, and names only known ones', () => {
  const two = page('Rain.', ['<Only os="macOS, Linux" /> The tray icon is sharper.']);
  assert.deepEqual(pageProblems(two, 'en'), []);
  assert.deepEqual(userNotes(two, 'Linux').changes, ['The tray icon is sharper.']);
  assert.deepEqual(userNotes(two, 'Windows').changes, []);
  assert.match(pageProblems(two.replace('Linux', 'Amiga'), 'en').join('\n'), /Amiga/);
  assert.match(pageProblems(two.replace('macOS, Linux', 'macOS, Windows, Linux'), 'en').join('\n'), /every system/);
});

test("a page keeps each language's two headings, in order, and its front matter", () => {
  const problems = (text, lang) => pageProblems(text, lang).join('\n');
  assert.match(problems(page('비가 와요.', ['비가 와요.']), 'ko'), /## 달라진 점/);
  const swapped = page('Rain.', ['Rain falls.'], ['Security updates.'])
    .replace('## What changed', '## X')
    .replace('## Also', '## What changed')
    .replace('## X', '## Also');
  assert.match(problems(swapped, 'en'), /## What changed/);
  assert.match(problems(page('Rain.', ['Rain falls.']).replace(/^---\n[\s\S]*?\n---\n/, ''), 'en'), /front matter/);
  assert.match(problems(page('Rain.', ['Rain falls.']), 'fr'), /language/);
});

test('a list line can wrap, and nothing outside the list hides a change', () => {
  const wrapped = page('Rain.', ['Rain falls\n  on the yard.']);
  assert.deepEqual(userNotes(wrapped).changes, ['Rain falls on the yard.']);
  assert.match(
    pageProblems(page('Rain.', ['x'.repeat(60) + '\n  ' + 'x'.repeat(60)]), 'en').join('\n'),
    /longer than 100/,
  );
  const split = page('Rain.', ['Rain falls.']).replace(
    '- Rain falls.\n',
    '- Rain falls.\n\n<Shot name="rain" />\n\n- Snow falls.\n',
  );
  assert.match(pageProblems(split, 'en').join('\n'), /Keep the list together/);
  assert.match(
    pageProblems(page('Rain.', ['Rain falls.']).replace('- Rain falls.', '* Rain falls.'), 'en').join('\n'),
    /"- "/,
  );
});

test('the opening sentence is the first paragraph of text, not a box, a picture or a tag', () => {
  const at = text =>
    page('Rain reaches the yard.', ['Rain falls.']).replace('<ReleaseMeta />', `<ReleaseMeta />\n\n${text}`);
  for (const text of ['::: tip\nBox text\n:::', '<Shot\n  name="x"\n/>', '![pic](x.png)'])
    assert.equal(userNotes(at(text)).intro, 'Rain reaches the yard.', text);
  assert.equal(userNotes(at('').replaceAll('\n', '\r\n')).intro, 'Rain reaches the yard.');
});

test('the four pages of a version list the same changes for every system', () => {
  const pages = Object.fromEntries(
    Object.keys(HEADINGS).map(lang => [
      lang,
      RAIN.replace('## What changed', `## ${HEADINGS[lang][0]}`).replace('## Also', `## ${HEADINGS[lang][1]}`),
    ]),
  );
  assert.deepEqual(pagesProblems(pages), []);
  const short = pages.ja.replace(/- <Only os="Linux" \/>.*\n/, '');
  assert.match(pagesProblems({ ...pages, ja: short }).join('\n'), /ja/);
  // The same number of lines, but the badge on another line: each system would read another change.
  const moved = pages.ja
    .replace('- Rain falls on **the yard**.', '- <Only os="macOS" /> Rain falls on **the yard**.')
    .replace('<Only os="macOS" /> The app', 'The app');
  assert.match(pagesProblems({ ...pages, ja: moved }).join('\n'), /ja: line 1/);
});

test('every release page from the rules on keeps them, in every language', () => {
  const versions = readdirSync('website/releases')
    .map(file => file.replace(/\.md$/, ''))
    .filter(version => /^\d+\.\d+\.\d+$/.test(version))
    .filter(version => version.localeCompare(RULES_SINCE, 'en', { numeric: true }) >= 0);
  assert.ok(versions.includes(RULES_SINCE));
  for (const version of versions) {
    const files = releasePagesFor(version);
    assert.deepEqual(
      files.filter(file => !existsSync(file)),
      [],
      `${version} needs a page in every language`,
    );
    const pages = Object.fromEntries(files.map((file, i) => [SITE_LANGS[i], readFileSync(file, 'utf8')]));
    assert.deepEqual(pagesProblems(pages), [], version);
  }
});

test('the Linux metainfo describes a release with the Linux lines of its English page', () => {
  const xml =
    '<component>\n  <releases>\n    <release version="0.1.0" date="2026-10-06"/>\n  </releases>\n</component>\n';
  const out = setMetainfoRelease(xml, '0.2.0', '2026-11-02', {
    intro: 'Rain & snow reach the yard.',
    changes: ['Rain falls.', 'The <Only> badge is gone.'],
    url: 'https://playpets.gaerae.com/releases/0.2.0',
  });
  assert.equal(
    out,
    `<component>
  <releases>
    <release version="0.2.0" date="2026-11-02">
      <description>
        <p>Rain &amp; snow reach the yard.</p>
        <ul>
          <li>Rain falls.</li>
          <li>The &lt;Only&gt; badge is gone.</li>
        </ul>
      </description>
      <url type="details">https://playpets.gaerae.com/releases/0.2.0</url>
    </release>
    <release version="0.1.0" date="2026-10-06"/>
  </releases>
</component>
`,
  );
  // Released again, the entry is replaced, not repeated.
  assert.equal(
    setMetainfoRelease(out, '0.2.0', '2026-11-02', { intro: 'Rain.', changes: [], url: 'u' }).match(
      /version="0\.2\.0"/g,
    ).length,
    1,
  );
});

test('the shipped metainfo describes the newest release from its page', () => {
  const xml = readFileSync('packaging/linux/app.playpets.metainfo.xml', 'utf8');
  const newest = xml.match(/<release version="([\d.]+)"/)[1];
  const { changes } = userNotes(readFileSync(`website/releases/${newest}.md`, 'utf8'), 'Linux');
  const xmlText = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  for (const line of changes) assert.ok(xml.includes(`<li>${xmlText(line)}</li>`), line);
});
