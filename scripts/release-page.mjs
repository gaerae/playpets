// A website release page, read for each reader (docs/decisions/2026-10-28-release-notes-by-audience.md).
// The page is the user notes for every system: an opening sentence, "What changed" (what a person using
// the app notices; a line for one system starts with <Only os="…" />), then "Also" (install ways, the
// guide, security updates). The Store reads the Windows lines, the Linux metainfo the Linux ones.
// Plain functions (tests/release-notes.test.mjs); the release command stops on a page that breaks a rule.

export const SYSTEMS = Object.freeze(['macOS', 'Windows', 'Linux']);
// Pages from this version on keep the rules below; earlier pages stay as they were published.
export const RULES_SINCE = '1.3.0';
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

// The opening sentence (before the first section) and each "## " section's bullets, as written.
function parse(page) {
  const lines = page.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n');
  const first = lines.findIndex(line => line.startsWith('## '));
  const head = first < 0 ? lines : lines.slice(0, first);
  const intro = head.find(line => line.trim() && !/^(#|<|- |:::)/.test(line.trim())) || '';
  const sections = [];
  for (const line of first < 0 ? [] : lines.slice(first)) {
    const section = sections.at(-1);
    if (line.startsWith('## ')) sections.push({ heading: line.slice(3).trim(), lines: [], open: true });
    else if (!section.open) continue;
    else if (line.startsWith('- ')) section.lines.push(line.slice(2));
    else if (line.trim() && section.lines.length && !line.startsWith('  ')) section.open = false;
  }
  return { intro, sections };
}

const systemOf = line => {
  const os = line.match(ONLY)?.[1];
  if (os !== undefined && !SYSTEMS.includes(os)) throw new Error(`Unknown system in <Only os="${os}" />`);
  return os;
};

// The opening sentence and the "What changed" lines for `os` as plain text; without `os`, every line.
export function userNotes(page, os) {
  const { intro, sections } = parse(page);
  const changes = (sections[0]?.lines || [])
    .filter(line => {
      const only = systemOf(line);
      return !os || !only || only === os;
    })
    .map(line => plain(line.replace(ONLY, '')));
  return { intro: plain(intro), changes };
}

// What one page breaks of the writing rules, as sentences for the person writing it.
export function pageProblems(page, lang) {
  const problems = [];
  const { intro, sections } = parse(page);
  if (!intro) problems.push('Start with an opening sentence before "What changed".');
  else if ([...plain(intro)].length > INTRO_LIMIT[lang])
    problems.push(`The opening sentence is longer than ${INTRO_LIMIT[lang]} characters.`);
  const changes = sections[0]?.lines || [];
  if (!changes.length) problems.push('List the changes under a first section, "What changed".');
  for (const line of changes) {
    if (line.includes('`')) problems.push(`Put a command or path in the guide or "Also", not "What changed": ${line}`);
    if ([...plain(line.replace(ONLY, ''))].length > LINE_LIMIT[lang])
      problems.push(`A "What changed" line is longer than ${LINE_LIMIT[lang]} characters: ${line}`);
  }
  for (const section of sections)
    for (const line of section.lines) {
      if (line.includes('<Only') && !ONLY.test(line))
        problems.push(`<Only os="…" /> goes at the start of its line: ${line}`);
      try {
        systemOf(line);
      } catch (error) {
        problems.push(error.message);
      }
    }
  return problems;
}

// The four pages of a version, {lang: page}: each keeps the rules, and all list the same changes
// for every system and the same number of "Also" lines.
export function pagesProblems(pages) {
  const problems = Object.entries(pages).flatMap(([lang, page]) =>
    pageProblems(page, lang).map(problem => `${lang}: ${problem}`),
  );
  if (problems.length) return problems;
  const shape = page => [
    ...SYSTEMS.map(os => `${os} ${userNotes(page, os).changes.length}`),
    `Also ${parse(page).sections[1]?.lines.length || 0}`,
  ];
  const [base, ...others] = Object.entries(pages);
  const want = shape(base[1]);
  for (const [lang, page] of others) {
    const got = shape(page);
    for (const [i, part] of got.entries())
      if (part !== want[i]) problems.push(`${lang}: ${part} lines, where ${base[0]} has ${want[i]}`);
  }
  return problems;
}
