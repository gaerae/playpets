// Copies docs/ into the website (website/dev, generated) with links rewritten, and brings the icon and sample pet sheets into website/public. Runs before vitepress.
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { copyCreatorKit } from './creator-kit.mjs';
import { LANDING_PETS } from './site-content.mjs';
import { destinationFor, rewriteDocLinks } from './site-lib.mjs';
import { PREVIEW_STATES, validatePreview } from './site-preview-lib.mjs';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const slug = pkg.repository.replace(/^github:/, '');
const repo = `https://github.com/${slug}/blob/main`;
// What the site's components need to know about this checkout: the version and the repository.
const petPreviews = {};
const previewCopies = [];
for (const pet of LANDING_PETS) {
  for (const state of PREVIEW_STATES) {
    const source = `assets/pets/${pet.id}/preview/${state}.png`;
    let bytes;
    try {
      bytes = await readFile(source);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    validatePreview(bytes);
    petPreviews[pet.id] ??= [];
    petPreviews[pet.id].push(state);
    previewCopies.push({ source, id: pet.id, state });
  }
}
await writeFile(
  'website/.vitepress/generated.json',
  `${JSON.stringify({ version: pkg.version, slug, petPreviews }, null, 2)}\n`,
);

await rm('website/dev', { recursive: true, force: true });
for (const entry of await readdir('docs', { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const source = path.join(entry.parentPath, entry.name).split(path.sep).join('/');
  const target = destinationFor(source);
  await mkdir(path.dirname(target), { recursive: true });
  if (!source.endsWith('.md')) {
    await cp(source, target);
    continue;
  }
  await writeFile(target, rewriteDocLinks(await readFile(source, 'utf8'), { file: source, repo }));
}
await mkdir('website/public', { recursive: true });
await cp('assets/icon.svg', 'website/public/icon.svg');
await cp('src-tauri/icons/tray.png', 'website/public/favicon.png');
await cp('src-tauri/icons/icon.ico', 'website/public/favicon.ico');
// The site's live scene uses the same environment layer as the app.
await mkdir('website/public/yard', { recursive: true });
await cp('src/art/environments/green.png', 'website/public/yard/green.png');
for (const name of ['sun', 'moon', 'small', 'wisps'])
  await cp(`src/art/sky/${name}.png`, `website/public/yard/${name}.png`);
// The landing page animates the sample pets' real sprite sheets.
await rm('website/public/pets', { recursive: true, force: true });
await mkdir('website/public/pets', { recursive: true });
for (const pet of LANDING_PETS) await cp(pet.source, `website/public/pets/${pet.id}.png`);

for (const { source, id, state } of previewCopies) {
  await mkdir(`website/public/pets/previews/${id}`, { recursive: true });
  await cp(source, `website/public/pets/previews/${id}/${state}.png`);
}

await copyCreatorKit();
