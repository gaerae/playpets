// Makes the distribution files of a release (see distribute-lib.mjs):
//   node scripts/distribute.mjs updater <version> <dir>     latest.json from <dir>/*.sig (stdout)
//   node scripts/distribute.mjs winget <version> <sums> <out>   winget-pkgs manifests under <out>
//   node scripts/distribute.mjs cask <version> <sums> <out>     <out>/Casks/playpets.rb
// <sums> is the release's SHA256SUMS.txt.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { homebrewCask, parseSums, repoSlug, updaterManifest, wingetManifests } from './distribute-lib.mjs';
import { notesFor } from './release-lib.mjs';

const [what, version, from, out] = process.argv.slice(2);
const slug = repoSlug(JSON.parse(await readFile('package.json', 'utf8')));
const today = new Date().toISOString().slice(0, 10);
const write = async (file, text) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
  console.error(`wrote ${file}`);
};

if (what === 'updater') {
  const signatures = {};
  for (const name of await readdir(from))
    if (name.endsWith('.sig')) signatures[name.slice(0, -4)] = await readFile(path.join(from, name), 'utf8');
  const notes = notesFor(await readFile('CHANGELOG.md', 'utf8'), version);
  const manifest = updaterManifest({ version, notes, date: `${today}T00:00:00Z`, slug, signatures });
  console.log(JSON.stringify(manifest, null, 2));
} else if (what === 'winget' || what === 'cask') {
  const sums = parseSums(await readFile(from, 'utf8'));
  if (what === 'winget')
    for (const [file, text] of Object.entries(wingetManifests({ version, date: today, slug, sums })))
      await write(path.join(out, file), text);
  else await write(path.join(out, 'Casks/playpets.rb'), homebrewCask({ version, slug, sums }));
} else {
  console.error('Usage: node scripts/distribute.mjs updater|winget|cask <version> ...');
  process.exit(2);
}
