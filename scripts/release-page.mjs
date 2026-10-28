// A website release page, read for each reader (docs/decisions/2026-10-28-release-notes-by-audience.md).
// The page is the user notes for every system: an opening sentence, "What changed" (what a person using
// the app notices; a line for some systems starts with <Only os="…" />), then "Also" (install ways, the
// guide, security updates). The Store reads the Windows lines, the Linux metainfo the Linux ones.
// Plain functions (tests/release-notes.test.mjs); the release command stops on a page that breaks a rule.
// To check a version's pages and see each system's text: node scripts/release-page.mjs 1.4.0

import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { releasePagesFor, SITE_LANGS } from './site-content.mjs';

export const SYSTEMS = Object.freeze(['macOS', 'Windows', 'Linux']);
// Pages from this version on keep the rules below; earlier pages stay as they were published.
export const RULES_SINCE = '1.3.0';
// The two sections, in this order, in each language.
export const HEADINGS = Object.freeze({
  en: ['What changed', 'Also'],
  ko: ['달라진 점', '그 밖에'],
  ja: ['変更点', 'そのほか'],
  'zh-hans': ['更新内容', '其他'],
});
// Characters after links and marks are dropped: a "What changed" line, and the opening sentence.
export const LINE_LIMIT = Object.freeze({ en: 100, ko: 60, ja: 60, 'zh-hans': 60 });
export const INTRO_LIMIT = Object.freeze({ en: 200, ko: 100, ja: 100, 'zh-hans': 100 });

const ONLY = /^<Only os="([^"]*)" \/>\s*/;

// Plain text: links keep their words, bold and code marks go.
export const plain = line =>
  line
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();

// The front matter, the opening sentence (the first paragraph of text before the first section) and
// each "## " section's list, a wrapped line joined to its item. A list item after the list has ended,
// or one marked other than "- ", becomes a problem to name instead of a change silently dropped.
function parse(page) {
  const text = page.replaceAll('\r\n', '\n');
  const front = text.match(/^---\n([\s\S]*?)\n---\n/);
  const lines = text.slice(front ? front[0].length : 0).split('\n');
  const first = lines.findIndex(line => line.startsWith('## '));
  // Boxes and components, one line or several, are not the opening sentence.
  const head = (first < 0 ? lines : lines.slice(0, first))
    .join('\n')
    .replace(/^:::[\s\S]*?^:::$/gm, '')
    .replace(/^<[\s\S]*?>$/gm, '')
    .split('\n');
  const intro = head.find(line => line.trim() && !/^(#|<|- |!\[|:::)/.test(line.trim())) || '';
  const sections = [];
  for (const line of first < 0 ? [] : lines.slice(first)) {
    const section = sections.at(-1);
    if (line.startsWith('## ')) sections.push({ heading: line.slice(3).trim(), lines: [], open: true, stray: [] });
    else if (/^(\* |\+ |\d+\. )/.test(line)) section.stray.push(`Start a list line with "- ": ${line}`);
    else if (line.startsWith('- ') && !section.open)
      section.stray.push(`Keep the list together; this line is after its end: ${line}`);
    else if (line.startsWith('- ')) section.lines.push(line.slice(2));
    else if (!section.open || !line.trim()) continue;
    else if (line.startsWith('  ') && section.lines.length) section.lines.push(`${section.lines.pop()} ${line.trim()}`);
    else if (section.lines.length) section.open = false;
  }
  return { front: front?.[1] ?? null, intro, sections };
}

// The systems a line is for, or every system when it has no badge.
const systemsOf = line => {
  const os = line.match(ONLY)?.[1];
  if (os === undefined) return SYSTEMS;
  const names = os.split(',').map(name => name.trim());
  const unknown = names.filter(name => !SYSTEMS.includes(name));
  if (unknown.length) throw new Error(`Unknown system in <Only os="${os}" />`);
  return names;
};

// The opening sentence and the "What changed" lines for `os` as plain text; without `os`, every line.
export function userNotes(page, os) {
  const { intro, sections } = parse(page);
  const changes = (sections[0]?.lines || [])
    .filter(line => !os || systemsOf(line).includes(os))
    .map(line => plain(line.replace(ONLY, '')));
  return { intro: plain(intro), changes };
}

// What one page breaks of the writing rules, as sentences for the person writing it.
export function pageProblems(page, lang) {
  if (!HEADINGS[lang]) return [`Not a site language: ${lang}`];
  const problems = [];
  const { front, intro, sections } = parse(page);
  if (!front || !/^version: /m.test(front)) problems.push('Start the page with front matter that has its version.');
  if (!intro) problems.push(`Start with an opening sentence before "${HEADINGS[lang][0]}".`);
  else if ([...plain(intro)].length > INTRO_LIMIT[lang])
    problems.push(`The opening sentence is longer than ${INTRO_LIMIT[lang]} characters.`);
  for (const [i, heading] of HEADINGS[lang].entries())
    if (sections[i] && sections[i].heading !== heading)
      problems.push(`Section ${i + 1} is "## ${heading}", not "## ${sections[i].heading}".`);
  if (sections.length > HEADINGS[lang].length)
    problems.push(`Keep to two sections, "## ${HEADINGS[lang].join('" and "## ')}".`);
  const changes = sections[0]?.lines || [];
  if (!changes.length) problems.push(`List the changes under a first section, "## ${HEADINGS[lang][0]}".`);
  for (const line of changes) {
    if (line.includes('`')) problems.push(`Put a command or path in the guide or "${HEADINGS[lang][1]}": ${line}`);
    if ([...plain(line.replace(ONLY, ''))].length > LINE_LIMIT[lang])
      problems.push(`A "${HEADINGS[lang][0]}" line is longer than ${LINE_LIMIT[lang]} characters: ${line}`);
  }
  for (const section of sections) {
    problems.push(...section.stray);
    for (const line of section.lines) {
      if (line.replace(ONLY, '').includes('<Only'))
        problems.push(`<Only os="…" /> goes once, at the start of its line: ${line}`);
      try {
        if (ONLY.test(line) && systemsOf(line).length === SYSTEMS.length)
          problems.push(`A line for every system needs no <Only os="…" />: ${line}`);
      } catch (error) {
        problems.push(error.message);
      }
    }
  }
  return problems;
}

// The four pages of a version, {lang: page}: each keeps the rules, and all list the same changes, each
// line for the same systems, and the same number of "Also" lines.
export function pagesProblems(pages) {
  const problems = Object.entries(pages).flatMap(([lang, page]) =>
    pageProblems(page, lang).map(problem => `${lang}: ${problem}`),
  );
  if (problems.length) return problems;
  const shape = page => {
    const [changes, also] = parse(page).sections;
    return { changes: changes.lines.map(line => systemsOf(line).join(', ')), also: also?.lines.length || 0 };
  };
  const [[baseLang, basePage], ...others] = Object.entries(pages);
  const want = shape(basePage);
  for (const [lang, page] of others) {
    const got = shape(page);
    if (got.changes.length !== want.changes.length)
      problems.push(`${lang}: ${got.changes.length} changes, where ${baseLang} has ${want.changes.length}`);
    else
      for (const [i, systems] of got.changes.entries())
        if (systems !== want.changes[i])
          problems.push(`${lang}: line ${i + 1} is for ${systems}, where ${baseLang}'s is for ${want.changes[i]}`);
    if (got.also !== want.also) problems.push(`${lang}: ${got.also} "Also" lines, where ${baseLang} has ${want.also}`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = (process.argv[2] || '').replace(/^v/, '');
  const files = releasePagesFor(version);
  const missing = files.filter(file => !existsSync(file));
  const pages = Object.fromEntries(
    files.filter(file => existsSync(file)).map(file => [SITE_LANGS[files.indexOf(file)], readFileSync(file, 'utf8')]),
  );
  const problems = [...missing.map(file => `Missing: ${file}`), ...(missing.length ? [] : pagesProblems(pages))];
  for (const [lang, page] of Object.entries(pages))
    for (const os of SYSTEMS) {
      const { intro, changes } = userNotes(page, os);
      console.log(`${lang}, ${os}:\n${intro}\n${changes.map(line => `- ${line}`).join('\n')}\n`);
    }
  if (problems.length) {
    console.error(`- ${problems.join('\n- ')}`);
    process.exitCode = 1;
  }
}
