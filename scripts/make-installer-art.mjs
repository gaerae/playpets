// Exports installer artwork from the approved environment and four starter sprites.
// Finder draws its own app/folder icons and labels over the macOS image. Keep their entire
// area free of scenery; its sage surface supports both black and white native labels.
// Windows owns the translated instructions: its raster artwork carries only the brand.
// Linux software-center screenshots are exported from the current English app captures.
// Run pnpm run art, then rebuild the platform packages to include the exports.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  bmp,
  castMarkup,
  dataUrl,
  dataUrlBytes,
  fittedCastHeight,
  loadEnvironment,
  loadSheets,
  readDataUrl,
  withDpi,
} from './art-lib.mjs';
import { launchBrowser } from './browser-lib.mjs';
import { CAPTURE_VERSION } from './site-content.mjs';

const sheets = await loadSheets();
const environment = await loadEnvironment();
const { bundle } = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8'));
const { windowSize, appPosition, applicationFolderPosition } = bundle.macOS.dmg;
const DMG = {
  ...windowSize,
  app: [appPosition.x, appPosition.y],
  folder: [applicationFolderPosition.x, applicationFolderPosition.y],
};

// The arrow from the app to the Applications folder: one gentle arc centred between the two icons
// at their middle height, dotted up to a solid head. The head points along the arc's last stretch,
// and the dots stop where the head begins, so the two read as one stroke.
function arrow() {
  const [ax, ay] = DMG.app;
  const [fx, fy] = DMG.folder;
  const start = [ax + 86, ay];
  const tip = [fx - 86, fy];
  const control = [(start[0] + tip[0]) / 2, ay - 52];
  const at = t => [0, 1].map(k => (1 - t) ** 2 * start[k] + 2 * (1 - t) * t * control[k] + t ** 2 * tip[k]);
  // Direction at the tip (from the control point toward it), and the head's two arms around it.
  const len = Math.hypot(tip[0] - control[0], tip[1] - control[1]);
  const dir = [(tip[0] - control[0]) / len, (tip[1] - control[1]) / len];
  const arm = (angle, size) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [tip[0] - size * (dir[0] * c - dir[1] * s), tip[1] - size * (dir[0] * s + dir[1] * c)];
  };
  const a = arm(0.62, 17);
  const b = arm(-0.62, 17);
  // The dotted part is the same arc cut a little before the tip, sampled as a polyline so its
  // length is known and the dots can be spaced to land evenly on both ends.
  const points = Array.from({ length: 61 }, (_, i) => at((i / 60) * 0.9));
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  const gap = length / Math.round(length / 13);
  const f = n => n.toFixed(1);
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'} ${f(x)} ${f(y)}`).join(' ');
  const ink = 'stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"';
  return `<svg width="${DMG.width}" height="${DMG.height}" viewBox="0 0 ${DMG.width} ${DMG.height}" aria-hidden="true">
    <path d="${line}" ${ink} stroke-dasharray="0 ${f(gap)}"/>
    <path d="M ${f(a[0])} ${f(a[1])} L ${f(tip[0])} ${f(tip[1])} L ${f(b[0])} ${f(b[1])}" ${ink}/>
    <path d="M ${f(at(0.9)[0])} ${f(at(0.9)[1])} L ${f(tip[0])} ${f(tip[1])}" ${ink}/>
  </svg>`;
}

const dmg = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;width:${DMG.width}px;height:${DMG.height}px;overflow:hidden;font-family:-apple-system,system-ui,sans-serif}
  .bg{position:relative;width:100%;height:100%;background:#70786f;color:#fff}
  .vignette{position:absolute;right:0;top:0;width:286px;height:118px;overflow:hidden}
  .environment{width:100%;height:100%;object-fit:cover;object-position:center 42%;opacity:.28}
  .vignette::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,#70786f,transparent 45%),linear-gradient(0deg,#70786f,transparent 70%)}
  h1{position:absolute;left:34px;top:25px;margin:0;font-size:30px;line-height:1.2;font-weight:750;letter-spacing:-.035em}
  .intro{position:absolute;left:35px;top:68px;margin:0;font-size:14px;line-height:1.4}
  .instruction{position:absolute;left:0;right:0;top:128px;margin:0;text-align:center;font-size:17px;line-height:24px;font-weight:600;color:#fff}
  .after{position:absolute;left:0;right:0;top:338px;margin:0;text-align:center;font-size:14px;line-height:20px}
  svg{position:absolute;left:0;top:0}
  .cast{position:absolute;right:26px;top:32px;display:flex;gap:2px}
</style><div class="bg">
  <div class="vignette"><img class="environment" src="${environment}" alt=""></div>
  <h1>PlayPets</h1><p class="intro">A little company for your day.</p>
  <div class="cast">${castMarkup(sheets, fittedCastHeight(324, 68, 2))}</div>
  <p class="instruction">Drag PlayPets into Applications</p>
  ${arrow()}
  <p class="after">Then open PlayPets from Applications.</p>
</div>`;

// Keep these at NSIS's native dimensions. Copy and controls remain native and translated.
const SIDEBAR = { width: 164, height: 314 };
const LISTING = ['yard-talk', 'friend-chat', 'desktop', 'settings-agents'];
const sidebar = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;width:${SIDEBAR.width}px;height:${SIDEBAR.height}px;overflow:hidden;font-family:'Segoe UI',-apple-system,system-ui,sans-serif}
  .bg{position:relative;width:100%;height:100%;background:#f7f9f5}
  .environment{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:48% bottom;opacity:.32}
  .wash{position:absolute;inset:0;background:linear-gradient(#f7f9f5 0%,#f7f9f5d9 30%,#f7f9f580 65%,#f7f9f500 100%)}
  h1{position:absolute;left:0;right:0;top:30px;margin:0;text-align:center;font-size:25px;line-height:32px;font-weight:750;letter-spacing:-.03em;color:#244d43}
  .cast{position:absolute;left:50%;top:148px;transform:translateX(-50%);display:grid;grid-template-columns:repeat(2,max-content);gap:12px 4px}
</style><div class="bg"><img class="environment" src="${environment}" alt=""><div class="wash"></div>
  <h1>PlayPets</h1><div class="cast">${castMarkup(sheets, 54)}</div></div>`;
const HEADER = { width: 150, height: 57 };
const header = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;width:${HEADER.width}px;height:${HEADER.height}px;overflow:hidden;background:#fff}
  .pets{position:absolute;left:50%;bottom:7px;transform:translateX(-50%);display:flex;align-items:flex-end;gap:1px}
</style><div class="pets">${castMarkup(sheets, fittedCastHeight(142, 40, 1))}</div>`;

async function readyArt(page) {
  await page.evaluate(async sources => {
    await document.fonts.ready;
    await Promise.all(
      sources.map(src => {
        const image = new Image();
        image.src = src;
        return image.decode();
      }),
    );
    await Promise.all(Array.from(document.images, image => image.decode()));
  }, Object.values(sheets));
}

/** Renders a page at 1× and returns its RGBA pixels. */
async function pixels(browser, html, { width, height }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await readyArt(page);
  const shot = dataUrl(await page.screenshot({ type: 'png' }));
  const data = await page.evaluate(async url => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return Array.from(g.getImageData(0, 0, img.width, img.height).data);
  }, shot);
  await page.close();
  return Uint8Array.from(data);
}

const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: DMG.width, height: DMG.height }, deviceScaleFactor: 2 });
  await page.setContent(dmg);
  await readyArt(page);
  const file = 'packaging/macos/dmg-background.png';
  await writeFile(file, withDpi(await page.screenshot({ type: 'png' }), 144));
  console.log(`Wrote ${file} (${DMG.width * 2}×${DMG.height * 2} at 144 dpi)`);
  // The listing pictures come from the captures the site shows, which are taken before the release
  // command raises the package version.
  const version = CAPTURE_VERSION;
  await mkdir('website/public/listing/en', { recursive: true });
  const encoder = await browser.newPage();
  for (const name of LISTING) {
    const webp = await readDataUrl(`website/public/shots/${version}/en/${name}.webp`, 'image/webp');
    const jpeg = await encoder.evaluate(async url => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth / 2);
      c.height = Math.round(img.naturalHeight / 2);
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.88);
    }, webp);
    const out = `website/public/listing/en/${name}.jpg`;
    await writeFile(out, dataUrlBytes(jpeg));
    console.log(`Wrote ${out}`);
  }
  await encoder.close();
  for (const [name, html, size] of [
    ['nsis-sidebar', sidebar, SIDEBAR],
    ['nsis-header', header, HEADER],
  ]) {
    const out = `packaging/windows/${name}.bmp`;
    await writeFile(out, bmp(await pixels(browser, html, size), size.width, size.height));
    console.log(`Wrote ${out} (${size.width}×${size.height})`);
  }
} finally {
  await browser.close();
}
