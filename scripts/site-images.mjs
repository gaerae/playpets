// Smaller copies of the pictures the site shows before anything else: its scenes as WebP (the app
// keeps the lossless 1536×1024 PNGs, about 3 MB each) and a 96 px icon for the tab, the top bar and
// search results (assets/icon.svg wraps the whole 1024 px PNG).
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dataUrlBytes } from './art-lib.mjs';
import { launchBrowser } from './browser-lib.mjs';

const SCENE_QUALITY = 0.82;

export function siteImagePlan(sources) {
  return {
    scenes: sources.map(source => {
      const name = path.basename(source, '.png');
      return { name, source, destination: `website/public/yard/scenes/${name}.webp` };
    }),
    icon: { source: 'assets/icon.svg', destination: 'website/public/icon.png', size: 96 },
  };
}

// Returns the scenes written, for generated.json. Without a browser the site still builds: the
// scenes then show the PNGs and the icon is the app's own 1024 px one.
export async function exportSiteImages(launch = launchBrowser) {
  const folder = 'src/art/environments';
  const sources = (await readdir(folder)).filter(name => name.endsWith('.png')).map(name => `${folder}/${name}`);
  const plan = siteImagePlan(sources.sort());
  await mkdir(path.dirname(plan.icon.destination), { recursive: true });
  let browser;
  try {
    browser = await launch();
  } catch (error) {
    console.warn(`Site images skipped: ${String(error.message).split('\n')[0]}`);
    await writeFile(plan.icon.destination, await readFile('src-tauri/icons/icon.png'));
    return [];
  }
  try {
    const page = await browser.newPage();
    const encode = (source, { width, height, type, quality }) =>
      page.evaluate(
        async ({ source, width, height, type, quality }) => {
          const image = new Image();
          image.src = source;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = width ?? image.naturalWidth;
          canvas.height = height ?? image.naturalHeight;
          const context = canvas.getContext('2d');
          context.imageSmoothingQuality = 'high';
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL(type, quality);
        },
        { source, width, height, type, quality },
      );
    await mkdir(path.dirname(plan.scenes[0].destination), { recursive: true });
    for (const scene of plan.scenes) {
      const source = `data:image/png;base64,${(await readFile(scene.source)).toString('base64')}`;
      await writeFile(
        scene.destination,
        dataUrlBytes(await encode(source, { type: 'image/webp', quality: SCENE_QUALITY })),
      );
    }
    const icon = `data:image/svg+xml;base64,${(await readFile(plan.icon.source)).toString('base64')}`;
    const { size } = plan.icon;
    await writeFile(
      plan.icon.destination,
      dataUrlBytes(await encode(icon, { width: size, height: size, type: 'image/png' })),
    );
  } finally {
    await browser.close();
  }
  return plan.scenes.map(scene => scene.name);
}
