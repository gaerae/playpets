// Paints the installer art from the sample pets' real sprite sheets: the background of the macOS
// disk image window (packaging/macos/dmg-background.png) and the Windows installer's pictures
// (packaging/windows/nsis-sidebar.bmp on the welcome and finish pages, nsis-header.bmp at the top
// of the other pages). All are set in src-tauri/tauri.conf.json. It also turns the English captures
// of the current version into JPEGs at 1× under website/public/listing/en/, the pictures Linux
// software centers show from packaging/linux/app.playpets.metainfo.xml (run npm run shots first). The window is 660×420 points with the
// app at (165, 215) and the Applications folder at (495, 215), as src-tauri/tauri.conf.json says.
// Finder writes the icon labels in dark text in light mode and white text in dark mode, so the
// ground under the labels is a green that keeps about 4.5:1 contrast with both. The title bar and
// Finder's path bar (if the person shows it) cover about 60 points at the bottom, so nothing that
// matters sits below y = 350.
// Run: npm run art   (needs Google Chrome; playwright-core drives it headless).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { bmp, cell, loadEnvironment, loadSheets, withDpi } from './art-lib.mjs';

const sheets = await loadSheets();
const environment = await loadEnvironment();
const DMG = { width: 660, height: 420, app: [165, 215], folder: [495, 215] };

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
  const ink = 'stroke="#fff6e0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"';
  return `<svg width="${DMG.width}" height="${DMG.height}" viewBox="0 0 ${DMG.width} ${DMG.height}" aria-hidden="true">
    <path d="${line}" ${ink} stroke-dasharray="0 ${f(gap)}"/>
    <path d="M ${f(a[0])} ${f(a[1])} L ${f(tip[0])} ${f(tip[1])} L ${f(b[0])} ${f(b[1])}" ${ink}/>
    <path d="M ${f(at(0.9)[0])} ${f(at(0.9)[1])} L ${f(tip[0])} ${f(tip[1])}" ${ink}/>
  </svg>`;
}

const dmg = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;width:${DMG.width}px;height:${DMG.height}px;overflow:hidden;font-family:-apple-system,system-ui,sans-serif}
  .bg{position:relative;width:100%;height:100%;background:#d9eaf3}
  .environment{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 45%}
  .bg::after{content:'';position:absolute;inset:0;background:linear-gradient(#fbfcf5eb 0%,#fbfcf566 26%,transparent 44%);pointer-events:none}
  .label-field{position:absolute;left:85px;top:268px;width:160px;height:48px;border-radius:14px;background:#637a70}.label-field.second{left:415px}
  h1{position:absolute;left:0;right:0;top:38px;margin:0;text-align:center;font-size:18px;font-weight:700;letter-spacing:-.01em;color:#244d43;z-index:1}
  h1 small{display:block;margin-top:6px;font-size:12.5px;font-weight:500;color:#42675b}
  svg{position:absolute;left:0;top:0;z-index:1}
  .pet{position:absolute;z-index:1}
</style><div class="bg">
  <img class="environment" src="${environment}" alt=""><div class="label-field"></div><div class="label-field second"></div>
  <h1>Drag PlayPets to Applications<small>Then open it from Launchpad or the Applications folder.</small></h1>
  ${arrow()}
  <div class="pet" style="left:30px;top:262px">${cell(sheets, 'pip', 4, 2, 0.36)}</div>
  <div class="pet" style="right:28px;top:256px">${cell(sheets, 'daisy', 0, 0, 0.4)}</div>
</div>`;

// The Windows installer draws its pictures at their pixel size beside white page text: a tall
// sidebar with the yard and Clover saying hello, and a small header that sits on the white strip.
// Tauri's installer puts the header picture at the left end of the strip, so the hill runs off
// the left edge and comes down before the page title on the right.
const SIDEBAR = { width: 164, height: 314 };
// The captures software centers show, in the order of the metainfo file.
const LISTING = ['yard-talk', 'friend-chat', 'desktop', 'settings-agents'];
const sidebar = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;width:${SIDEBAR.width}px;height:${SIDEBAR.height}px;overflow:hidden;font-family:'Segoe UI',-apple-system,system-ui,sans-serif}
  .bg{position:relative;width:100%;height:100%;background:#d9eaf3}
  .environment{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:47% bottom}
  .bg::after{content:'';position:absolute;inset:0;background:linear-gradient(#fbfcf5f5 0%,#fbfcf5ed 45%,#fbfcf500 70%)}
  h1{position:absolute;left:18px;top:62px;margin:0;font-size:24px;font-weight:750;letter-spacing:-.02em;color:#244d43;z-index:1}
  p{position:absolute;left:18px;right:16px;top:96px;margin:0;font-size:12px;line-height:1.5;color:#42675b;text-wrap:balance;z-index:1}
  .pet{position:absolute;left:50%;bottom:28px;transform:translateX(-50%);z-index:1}
</style><div class="bg"><img class="environment" src="${environment}" alt="">
  <h1>PlayPets</h1><p>A yard where your pets talk to each other.</p>
  <div class="pet">${cell(sheets, 'clover', 3, 0, 0.5)}</div></div>`;
const HEADER = { width: 150, height: 57 };
const header = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;width:${HEADER.width}px;height:${HEADER.height}px;overflow:hidden;background:#fff}
  .environment{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 60%;opacity:.35}
  .pets{position:absolute;left:12px;bottom:1px;display:flex;align-items:flex-end;gap:4px}
</style><img class="environment" src="${environment}" alt=""><div class="pets">${cell(sheets, 'clover', 3, 0, 0.28)}${cell(sheets, 'daisy', 0, 0, 0.26)}</div>`;

async function readyArt(page) {
  await page.evaluate(async sources => {
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
  const png = (await page.screenshot({ type: 'png' })).toString('base64');
  const data = await page.evaluate(async b64 => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return Array.from(g.getImageData(0, 0, img.width, img.height).data);
  }, png);
  await page.close();
  return Uint8Array.from(data);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: DMG.width, height: DMG.height }, deviceScaleFactor: 2 });
  await page.setContent(dmg);
  await readyArt(page);
  const file = 'packaging/macos/dmg-background.png';
  await writeFile(file, withDpi(await page.screenshot({ type: 'png' }), 144));
  console.log(`Wrote ${file} (${DMG.width * 2}×${DMG.height * 2} at 144 dpi)`);
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  await mkdir('website/public/listing/en', { recursive: true });
  const encoder = await browser.newPage();
  for (const name of LISTING) {
    const webp = (await readFile(`website/public/shots/${version}/en/${name}.webp`)).toString('base64');
    const jpeg = await encoder.evaluate(async b64 => {
      const img = new Image();
      img.src = `data:image/webp;base64,${b64}`;
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
    await writeFile(out, Buffer.from(jpeg.split(',')[1], 'base64'));
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
