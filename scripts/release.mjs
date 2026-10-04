// Makes a release commit and tag: npm run release -- 0.2.0  (take the screenshots first: npm run shots -- 0.2.0)
// Moves the changelog's [Unreleased] into a dated 0.2.0 section, writes 0.2.0 everywhere the
// version lives (package.json, package-lock.json, Cargo.toml, Cargo.lock, the Linux metainfo's
// releases; tauri.conf.json reads package.json), commits "Release 0.2.0" and tags v0.2.0. Nothing is pushed: pushing the tag is
// what starts .github/workflows/release.yml, which builds every platform into a draft release.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { notesFor, release, releasePage, setCargoVersion, setLockVersion, setMetainfoRelease } from './release-lib.mjs';

const version = process.argv[2];
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (!version) {
  console.error('Usage: npm run release -- <x.y.z>');
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

const date = new Date().toISOString().slice(0, 10);
const edit = async (file, change) => writeFile(file, change(await readFile(file, 'utf8')));
await edit('CHANGELOG.md', text => release(text, version, date));
await edit('package.json', text => text.replace(/("version": ")[^"]+(")/, `$1${version}$2`));
await edit('package-lock.json', text => {
  const lock = JSON.parse(text);
  lock.version = version;
  lock.packages[''].version = version;
  return `${JSON.stringify(lock, null, 2)}\n`;
});
await edit('src-tauri/Cargo.toml', text => setCargoVersion(text, version));
await edit('src-tauri/Cargo.lock', text => setLockVersion(text, version));
const metainfo = 'packaging/linux/app.playpets.metainfo.xml';
await edit(metainfo, text => setMetainfoRelease(text, version, date));
// The website gets a page for the version unless one was written ahead of time.
const page = `website/releases/${version}.md`;
if (!existsSync(page))
  await writeFile(page, releasePage(notesFor(await readFile('CHANGELOG.md', 'utf8'), version), version, date));

git(
  'add',
  'CHANGELOG.md',
  'package.json',
  'package-lock.json',
  'src-tauri/Cargo.toml',
  'src-tauri/Cargo.lock',
  metainfo,
  page,
);
git('commit', '-m', `Release ${version}`);
git('tag', '-a', `v${version}`, '-m', `PlayPets ${version}`);
console.log(
  `Committed and tagged v${version}. To build and publish a draft release:\n  git push origin HEAD v${version}`,
);
