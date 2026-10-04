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
import { bmp, cell, loadSheets, withDpi } from './art-lib.mjs';

const sheets = await loadSheets();
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
  .bg{position:relative;width:100%;height:100%;background:linear-gradient(180deg,#bfdcf2 0%,#e3eff8 52%,#eef4ea 100%)}
  .sun{position:absolute;right:46px;top:30px;width:44px;height:44px;border-radius:50%;background:#ffe08a;box-shadow:0 0 0 12px rgba(255,224,138,.3)}
  .far{position:absolute;left:-12%;right:38%;top:150px;height:120px;border-radius:50% 50% 0 0/100% 100% 0 0;background:#c3dfb0}
  .ground{position:absolute;left:-18%;right:-18%;top:176px;bottom:-40px;border-radius:50% 50% 0 0/60px 60px 0 0;
    background:linear-gradient(180deg,#8fc77a 0,#5f9d53 46px,#478643 92px)}
  h1{position:absolute;left:0;right:0;top:38px;margin:0;text-align:center;font-size:17px;font-weight:650;letter-spacing:-.01em;color:#3a2a1e}
  h1 small{display:block;margin-top:6px;font-size:12.5px;font-weight:500;color:#5b4a3b}
  svg{position:absolute;left:0;top:0}
  .pet{position:absolute}
</style><div class="bg">
  <i class="sun"></i><div class="far"></div><div class="ground"></div>
  <h1>Drag PlayPets to Applications<small>Then open it from Launchpad or the Applications folder.</small></h1>
  ${arrow()}
  <div class="pet" style="left:30px;top:262px">${cell(sheets, 'mochi', 4, 2, 0.36)}</div>
  <div class="pet" style="right:28px;top:256px">${cell(sheets, 'smoky', 0, 0, 0.4)}</div>
</div>`;

// The Windows installer draws its pictures at their pixel size beside white page text: a tall
// sidebar with the yard and Tabby saying hello, and a small header that sits on the white strip.
// Tauri's installer puts the header picture at the left end of the strip, so the hill runs off
// the left edge and comes down before the page title on the right.
const SIDEBAR = { width: 164, height: 314 };
// The captures software centers show, in the order of the metainfo file.
const LISTING = ['yard-talk', 'friend-chat', 'desktop', 'settings-agents'];
const sidebar = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;width:${SIDEBAR.width}px;height:${SIDEBAR.height}px;overflow:hidden;font-family:'Segoe UI',-apple-system,system-ui,sans-serif}
  .bg{position:relative;width:100%;height:100%;background:linear-gradient(180deg,#bfdcf2 0%,#e3eff8 60%,#eef4ea 100%)}
  .sun{position:absolute;right:18px;top:22px;width:26px;height:26px;border-radius:50%;background:#ffe08a;box-shadow:0 0 0 7px rgba(255,224,138,.3)}
  .far{position:absolute;left:-40%;right:10%;top:196px;height:80px;border-radius:50% 50% 0 0/100% 100% 0 0;background:#c3dfb0}
  .ground{position:absolute;left:-30%;right:-30%;top:224px;bottom:-20px;border-radius:50% 50% 0 0/40px 40px 0 0;background:linear-gradient(180deg,#8fc77a,#6fae5a)}
  h1{position:absolute;left:18px;top:62px;margin:0;font-size:24px;font-weight:700;letter-spacing:-.02em;color:#3a2a1e}
  p{position:absolute;left:18px;right:16px;top:96px;margin:0;font-size:12px;line-height:1.45;color:#5b4a3b;text-wrap:balance}
  .pet{position:absolute;left:50%;bottom:28px;transform:translateX(-50%)}
</style><div class="bg"><i class="sun"></i><div class="far"></div><div class="ground"></div>
  <h1>PlayPets</h1><p>A yard where your pets talk to each other.</p>
  <div class="pet">${cell(sheets, 'tabby', 3, 0, 0.5)}</div></div>`;
const HEADER = { width: 150, height: 57 };
const header = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;width:${HEADER.width}px;height:${HEADER.height}px;overflow:hidden;background:#fff}
  .hill{position:absolute;left:-40px;right:18px;bottom:-30px;height:48px;border-radius:50% 50% 0 0/100% 100% 0 0;background:#c3dfb0}
  .pets{position:absolute;left:12px;bottom:1px;display:flex;align-items:flex-end;gap:4px}
</style><div class="hill"></div><div class="pets">${cell(sheets, 'tabby', 3, 0, 0.28)}${cell(sheets, 'smoky', 0, 0, 0.26)}</div>`;

/** Renders a page at 1× and returns its RGBA pixels. */
async function pixels(browser, html, { width, height }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.waitForTimeout(300);
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
  await page.waitForTimeout(300);
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
