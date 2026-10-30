// Makes a release commit and tag: pnpm run release -- 0.2.0  (take the screenshots first: pnpm run shots -- 0.2.0)
// Moves the changelog's [Unreleased] into a dated 0.2.0 section, writes 0.2.0 everywhere the
// version lives (package.json, Cargo.toml, Cargo.lock, the Linux metainfo's releases; tauri.conf.json
// reads package.json, and pnpm-lock.yaml does not record it), commits "Release 0.2.0" and tags v0.2.0. Nothing is pushed: pushing the tag is
// what starts .github/workflows/release.yml, which builds every platform into a draft release.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { release, setCargoVersion, setLockVersion, setMetainfoRelease, setPageDate } from './release-lib.mjs';
import { pagesProblems, userNotes } from './release-page.mjs';
import { releasePagesFor, releasePageUrl, SITE_LANGS } from './site-content.mjs';

const version = process.argv[2];
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (!version) {
  console.error('Usage: pnpm run release -- <x.y.z>');
  process.exit(2);
}
if (git('status', '--porcelain')) {
  console.error('Commit or stash your changes first: a release commit holds only the release.');
  process.exit(1);
}
if (git('tag', '--list', `v${version}`)) {
  console.error(`The tag v${version} already exists.`);
  process.exit(1);
}

// The website's release pages are the user notes, written ahead of time in every language and kept to
// the rules in docs/standards/writing.md; a release without them, or with a page that breaks a rule,
// stops here, before anything changes.
const pages = releasePagesFor(version);
const missing = pages.filter(page => !existsSync(page));
if (missing.length) {
  console.error(`Write the release page first: ${missing.join(', ')}`);
  process.exit(1);
}
const texts = Object.fromEntries(
  await Promise.all(pages.map(async (page, i) => [SITE_LANGS[i], await readFile(page, 'utf8')])),
);
const problems = pagesProblems(texts);
if (problems.length) {
  console.error(`Fix the release pages first (docs/standards/writing.md#release-notes):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
// Every file's new text is made first, so a release that cannot be made leaves the tree as it was.
const changes = [];
const edit = async (file, change) => changes.push([file, change(await readFile(file, 'utf8'))]);
await edit('CHANGELOG.md', text => release(text, version, date));
await edit('package.json', text => text.replace(/("version": ")[^"]+(")/, `$1${version}$2`));
await edit('src-tauri/Cargo.toml', text => setCargoVersion(text, version));
await edit('src-tauri/Cargo.lock', text => setLockVersion(text, version));
const metainfo = 'packaging/linux/app.playpets.metainfo.xml';
await edit(metainfo, text =>
  setMetainfoRelease(text, version, date, { ...userNotes(texts.en, 'Linux'), url: releasePageUrl(version) }),
);
// The pages written ahead of time get today's date.
for (const page of pages) await edit(page, text => setPageDate(text, date));
for (const [file, text] of changes) await writeFile(file, text);

git('add', 'CHANGELOG.md', 'package.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock', metainfo, ...pages);
git('commit', '-m', `Release ${version}`);
git('tag', '-a', `v${version}`, '-m', `PlayPets ${version}`);
console.log(
  `Committed and tagged v${version}. To build and publish a draft release:\n  git push --atomic origin HEAD v${version}`,
);
