// Copies docs/ into the website (website/dev, generated) with links rewritten, and brings the icon, the scenes and sample pet sheets into website/public. Runs before vitepress.
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { copyCreatorKit, writePetDownloads } from './creator-kit.mjs';
import { copyCreatorSkill } from './creator-skill.mjs';
import { exportAlbumArt } from './site-album.mjs';
import { CAPTURE_VERSION, LANDING_PETS } from './site-content.mjs';
import { exportSiteImages } from './site-images.mjs';
import { destinationFor, docDisplayProse, rewriteDocLinks } from './site-lib.mjs';
import { exportMotionStrips } from './site-motion.mjs';
import { collectPreviewExports } from './site-preview-export.mjs';
import { publishedReleases } from './site-releases.mjs';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const slug = pkg.repository.replace(/^github:/, '');
const repo = `https://github.com/${slug}/blob/main`;
// Package and capture versions stay separate so preparing a release never relabels older media.
const { petPreviews, petSeasonalPreviews, copies: previewCopies } = await collectPreviewExports(LANDING_PETS);
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
  await writeFile(target, docDisplayProse(rewriteDocLinks(await readFile(source, 'utf8'), { file: source, repo })));
}
await mkdir('website/public', { recursive: true });
await cp('assets/icon.svg', 'website/public/icon.svg');
await cp('src-tauri/icons/tray.png', 'website/public/favicon.png');
await cp('src-tauri/icons/icon.ico', 'website/public/favicon.ico');
// The site's live scene uses the same environment layer as the app.
await mkdir('website/public/yard', { recursive: true });
await cp('assets/art/environments/green.png', 'website/public/yard/green.png');
for (const name of ['sun', 'moon', 'small', 'wisps'])
  await cp(`assets/art/sky/${name}.png`, `website/public/yard/${name}.png`);
// The landing's album and year show kinds as the app draws them.
const albumArt = await exportAlbumArt();
// The landing page animates the sample pets' real sprite sheets.
await rm('website/public/pets', { recursive: true, force: true });
await mkdir('website/public/pets', { recursive: true });
for (const pet of LANDING_PETS) await cp(pet.source, `website/public/pets/${pet.id}.png`);
// Each friend can also be taken home by itself, for PlayPets or a Codex pets folder.
await writePetDownloads();
const petMotions = await exportMotionStrips(LANDING_PETS);
const sceneImages = await exportSiteImages();

for (const { source, destination } of previewCopies) {
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
}

await copyCreatorKit();

const creatorSkillRevision = await copyCreatorSkill();
// Only a build with a token (the Pages workflow) looks the releases up: checks and local builds stay
// off the network, and their pages look the release up in the browser.
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const releases = token ? await publishedReleases(slug, { token }) : null;
await writeFile(
  'website/.vitepress/generated.json',
  `${JSON.stringify({ version: pkg.version, captureVersion: CAPTURE_VERSION, slug, petPreviews, petSeasonalPreviews, petMotions, sceneImages, albumArt, creatorSkillRevision, releases }, null, 2)}\n`,
);
