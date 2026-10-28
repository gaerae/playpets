// Prints the Microsoft Store "What's new" text for a version as JSON: node scripts/store-notes.mjs 1.3.0
// The source is the website's release page in each language, written by people before the release
// (npm run release stops without them), so no language is machine-translated. store.yml hands the
// JSON to store-submit.mjs.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { userNotes } from './release-page.mjs';
import { localePath, releasePageUrl, SITE_LANGS } from './site-content.mjs';

export const STORE_LOCALES = Object.freeze({ en: 'en-us', ko: 'ko-kr', ja: 'ja-jp', 'zh-hans': 'zh-cn' });
export const STORE_NOTES_LIMIT = 1500;

// The page's opening sentence and its "What changed" lines for Windows (scripts/release-page.mjs),
// then the page's address. "Also" (install ways, the guide, security updates) and lines for other
// systems stay on the page. Bullets that do not fit the Store's limit are left out from the end; the
// address leads to all of them.
export function storeNotes(page, address) {
  const { intro, changes } = userNotes(page, 'Windows');
  const bullets = changes.map(line => `• ${line}`);
  if (!intro || !bullets.length) throw new Error('The release page needs an opening sentence and a list of changes');
  const text = kept => [intro, kept.join('\n'), address].join('\n\n');
  let kept = bullets.length;
  while (kept && [...text(bullets.slice(0, kept))].length > STORE_NOTES_LIMIT) kept--;
  if (!kept) throw new Error(`The release page's first change is longer than the Store allows (${STORE_NOTES_LIMIT})`);
  return { text: text(bullets.slice(0, kept)), left: bullets.length - kept };
}

export function storeNotesFor(version, read = file => readFileSync(file, 'utf8')) {
  if (!/^[1-9]\d*\.\d+\.\d+$/.test(version)) throw new Error(`Not a release version: ${version}`);
  const notes = {};
  const left = {};
  for (const lang of SITE_LANGS) {
    const page = `website${localePath(lang, `/releases/${version}.md`)}`;
    const result = storeNotes(read(page), releasePageUrl(version, lang));
    notes[STORE_LOCALES[lang]] = result.text;
    left[STORE_LOCALES[lang]] = result.left;
  }
  return { notes, left };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { notes, left } = storeNotesFor((process.argv[2] || '').replace(/^v/, ''));
    for (const [locale, count] of Object.entries(left))
      if (count) console.error(`${locale}: ${count} change(s) left out to fit ${STORE_NOTES_LIMIT} characters`);
    console.log(JSON.stringify(notes, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
