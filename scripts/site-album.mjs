// Small pictures of the album kinds the landing shows (site-content.mjs ALBUM_SAMPLES and YEAR), made
// from the app's own drawings: each kind's SVG wrapper, with the atlas it crops, painted in a headless
// browser at twice the size the landing shows it and saved as WebP under website/public/yard/album/.
// The atlases themselves are megabytes; a picture is a few kilobytes.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dataUrlBytes, readDataUrl } from './art-lib.mjs';
import { launchBrowser } from './browser-lib.mjs';
import { ALBUM_SAMPLES, YEAR } from './site-content.mjs';

// Twice the tallest the landing draws a kind (landing.css .book-art), for sharp high-density screens.
const HEIGHT = 136;
const QUALITY = 0.86;

// Where a kind's drawing is: a tree's grown one, an animal's tail as the footprints book shows it.
const artPath = (book, kind) =>
  book === 'trees' ? `trees/${kind.id}-mature.svg` : book === 'tracks' ? kind.tail : kind.art;

/** Every [book, id] the landing pictures, each once. */
export function landingKinds() {
  const all = [
    ...Object.entries(ALBUM_SAMPLES).flatMap(([book, ids]) => ids.map(id => [book, id])),
    ...YEAR.flatMap(season => season.items.flatMap(item => item.art)),
  ];
  return [...new Map(all.map(([book, id]) => [`${book}/${id}`, [book, id]])).values()];
}

/**
 * Paints the pictures and returns { 'book/id': { src, width, height } } for generated.json. Without
 * a browser the site still builds, with no pictures: the landing then shows the books' words alone.
 */
export async function exportAlbumArt(launch = launchBrowser) {
  const catalog = JSON.parse(await readFile('src/content/catalog.json', 'utf8'));
  const drawings = [];
  for (const [book, id] of landingKinds()) {
    const kind = catalog[book].find(k => k.id === id);
    if (!kind) throw new Error(`The landing shows ${book}/${id}, which the catalogue does not have`);
    let svg = await readFile(`src/art/${artPath(book, kind)}`, 'utf8');
    // A picture drawn from a file cannot fetch its atlas, so the atlas goes in with it.
    for (const atlas of new Set([...svg.matchAll(/href="art\/([^"]+)"/g)].map(match => match[1])))
      svg = svg.replaceAll(`href="art/${atlas}"`, `href="${await readDataUrl(`src/art/${atlas}`, 'image/webp')}"`);
    drawings.push({ key: `${book}/${id}`, file: `${book}-${id}.webp`, svg });
  }
  let browser;
  try {
    browser = await launch();
  } catch (error) {
    console.warn(`Album pictures skipped: ${String(error.message).split('\n')[0]}`);
    return {};
  }
  const pictures = {};
  try {
    const page = await browser.newPage();
    // Only the kinds shown now: a kind taken off the landing leaves no picture behind.
    await rm('website/public/yard/album', { recursive: true, force: true });
    await mkdir('website/public/yard/album', { recursive: true });
    for (const { key, file, svg } of drawings) {
      const { url, width, height } = await page.evaluate(
        async ({ svg, height, quality }) => {
          const image = new Image();
          image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
          await image.decode();
          // The wrapper's viewBox gives its shape; the image's own size may be the default 300 × 150.
          const [, , w, h] = new DOMParser()
            .parseFromString(svg, 'image/svg+xml')
            .documentElement.getAttribute('viewBox')
            .split(/\s+/)
            .map(Number);
          const canvas = document.createElement('canvas');
          canvas.height = height;
          canvas.width = Math.round((height * w) / h);
          const context = canvas.getContext('2d');
          context.imageSmoothingQuality = 'high';
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          return { url: canvas.toDataURL('image/webp', quality), width: canvas.width, height: canvas.height };
        },
        { svg, height: HEIGHT, quality: QUALITY },
      );
      await writeFile(path.join('website/public/yard/album', file), dataUrlBytes(url));
      pictures[key] = { src: `/yard/album/${file}`, width, height };
    }
  } finally {
    await browser.close();
  }
  return pictures;
}
