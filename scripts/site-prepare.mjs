// Copies docs/ into the website (website/en/dev, generated) with links rewritten, and brings the icon, mascot and sample pet sheets into website/public. Runs before vitepress.
import { access, cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { destinationFor, rewriteDocLinks } from './site-lib.mjs';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const slug = pkg.repository.replace(/^github:/, '');
const repo = `https://github.com/${slug}/blob/main`;
// What the site's components need to know about this checkout: the version, the repository, and
// whether the landing video (website/public/media/intro-<lang>.mp4, see docs/design/2026-10-06-launch-video.md) exists per language.
const video = {};
for (const lang of ['ko', 'en', 'zh-hans'])
  video[lang] = await access(`website/public/media/intro-${lang}.mp4`).then(
    () => true,
    () => false,
  );
await writeFile(
  'website/.vitepress/generated.json',
  `${JSON.stringify({ version: pkg.version, slug, video }, null, 2)}\n`,
);

await rm('website/en/dev', { recursive: true, force: true });
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
for (const name of ['icon.svg', 'mascot.svg']) await cp(`assets/${name}`, `website/public/${name}`);
// The landing page animates the sample pets' real sprite sheets.
await mkdir('website/public/pets', { recursive: true });
for (const id of ['tabby', 'smoky', 'mochi'])
  await cp(`assets/pets/${id}/spritesheet.png`, `website/public/pets/${id}.png`);
