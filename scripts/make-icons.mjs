// Renders the accepted illustrated face in assets/icon.png into every app icon:
//   src-tauri/icons/icon.icns   macOS (Apple icon grid: a rounded plate of 824/1024 with Clover on it;
//                               macOS 26 puts free-form icons on a grey plate of its own otherwise)
//   src-tauri/icons/icon.ico    Windows (full-bleed, PNG-embedded)
//   src-tauri/icons/icon.png    Linux (512px)
//   src-tauri/icons/tray.png    all-platform tray and website favicon (colored, 32px)
//   src-tauri/icons/msix/*.png  Windows package (MSIX) tiles
//   src/logo.svg                in-app brand mark
// Run from the repo root: npm run icons   (uses the system Chrome, or Playwright's Chromium)

import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { launchBrowser } from './browser-lib.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const icons = path.join(root, 'src-tauri', 'icons');
const source = await readFile(path.join(root, 'assets', 'icon.png'));
const wrapped = bytes =>
  `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><image width="1024" height="1024" href="data:image/png;base64,${bytes.toString('base64')}"/></svg>\n`;
const svg = wrapped(source);
const work = await mkdtemp(path.join(os.tmpdir(), 'playpets-icons-'));

// One page renders every variant: artwork centered at inner×inner on a
// transparent canvas×canvas viewport, so small sizes stay crisp and a margin is just inner<canvas.
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
async function render(canvas, inner, name, plate = false, artwork = svg) {
  await page.setViewportSize({ width: canvas, height: canvas });
  await page.setContent(
    `<style>*{margin:0}html,body{background:transparent;overflow:hidden}body{width:${canvas}px;height:${canvas}px;display:grid;place-items:center}svg{width:${inner}px;height:${inner}px;display:block}</style>${plate ? `<div class="plate">${artwork}</div>` : artwork}`.replace(
      '</style>',
      plate
        ? `.plate{width:${inner}px;height:${inner}px;border-radius:${inner * 0.225}px;background:linear-gradient(#fffaf1,#edf2e4);display:grid;place-items:center;overflow:hidden}.plate svg{width:${inner * 0.8}px;height:${inner * 0.8}px;margin-top:${inner * 0.04}px}</style>`
        : '</style>',
    ),
    { waitUntil: 'networkidle' },
  );
  await page.evaluate(async () => {
    await Promise.all(
      [...document.querySelectorAll('image')].map(async element => {
        const image = new Image();
        image.src = element.getAttribute('href');
        await image.decode();
      }),
    );
  });
  await page.waitForTimeout(120);
  const file = path.join(work, name);
  await page.screenshot({ path: file, omitBackground: true });
  return file;
}
const full = {},
  mac = {};
for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) full[size] = await render(size, size, `icon-${size}.png`);
const MAC_CONTENT = 824 / 1024;
for (const size of [16, 32, 64, 128, 256, 512, 1024])
  mac[size] = await render(size, Math.round(size * MAC_CONTENT), `mac-${size}.png`, true);
// Windows package (MSIX) tiles: the artwork with a little air around it, as the Start menu shows them.
const tiles = {};
for (const [name, size] of [
  ['StoreLogo', 50],
  ['Square44x44Logo', 44],
  ['Square150x150Logo', 150],
])
  tiles[name] = await render(size, Math.round(size * 0.84), `${name}.png`);
await browser.close();

// macOS .icns via iconutil
const iconset = path.join(work, 'icon.iconset');
await mkdir(iconset);
const map = [
  [16, 'icon_16x16.png'],
  [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'],
  [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'],
  [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'],
  [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png'],
];
for (const [size, name] of map) await writeFile(path.join(iconset, name), await readFile(mac[size]));
execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(icons, 'icon.icns')]);

// Windows .ico: ICO container with PNG-format entries (supported since Vista)
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = await Promise.all(icoSizes.map(size => readFile(full[size])));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoSizes.length, 4);
const entries = [];
let offset = 6 + 16 * icoSizes.length;
for (let i = 0; i < icoSizes.length; i++) {
  const entry = Buffer.alloc(16);
  const size = icoSizes[i];
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngs[i].length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  entries.push(entry);
}
await writeFile(path.join(icons, 'icon.ico'), Buffer.concat([header, ...entries, ...pngs]));
await writeFile(path.join(icons, 'icon.png'), await readFile(full[512]));
await writeFile(path.join(icons, 'tray.png'), await readFile(full[32]));
const portable = wrapped(await readFile(full[256]));
await writeFile(path.join(root, 'assets', 'icon.svg'), portable);
await writeFile(path.join(root, 'src', 'logo.svg'), portable);
await mkdir(path.join(icons, 'msix'), { recursive: true });
for (const [name, file] of Object.entries(tiles))
  await writeFile(path.join(icons, 'msix', `${name}.png`), await readFile(file));
await rm(work, { recursive: true, force: true });
console.log('icons written: src-tauri/icons/{icon.icns,icon.ico,icon.png,tray.png}, src/logo.svg');
