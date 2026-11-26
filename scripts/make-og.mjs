// Renders the pictures that travel with a link: the Open Graph cards (website/public/og.png and
// og-<language>.png, 1200×630) that X, Slack and GeekNews show, and the README banner (assets/banner.png, 1600×560).
// Both are drawn from the sample pets' real sprite sheets with the headline. Run: pnpm run og
// Needs Google Chrome or Playwright's Chromium (browser-lib.mjs drives it headless).

import { readFile, writeFile } from 'node:fs/promises';
import { card as en } from '../website/.vitepress/theme/landing-en.ts';
import { card as ja } from '../website/.vitepress/theme/landing-ja.ts';
import { card as ko } from '../website/.vitepress/theme/landing-ko.ts';
import { card as zh } from '../website/.vitepress/theme/landing-zh-hans.ts';
import { castMarkup, fittedCastHeight, loadEnvironment, loadSheets } from './art-lib.mjs';
import { launchBrowser } from './browser-lib.mjs';

const sheets = await loadSheets();
const environment = await loadEnvironment();
// The address printed on each card: the site's (package.json "homepage") without the scheme.
const { homepage } = JSON.parse(await readFile('package.json', 'utf8'));
const address = folder => `${homepage.replace(/^https?:\/\//, '')}${folder}`.replace(/\/$/, folder ? '/' : '');

const page = ({ width, height, title, sub, url, scale }) => `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;font-family:'Pretendard Variable',Pretendard,-apple-system,system-ui,sans-serif}
  .card{position:relative;width:100%;height:100%;background:#fdf8ec;color:#4a3523}
  .environment{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center bottom}
  .text{position:absolute;left:${40 * scale}px;top:${44 * scale}px;max-width:${470 * scale}px;padding:${24 * scale}px;border-radius:${24 * scale}px;background:#fffaf0f2;border:${4 * scale}px solid #d6a476;box-shadow:0 18px 50px #4a352322}
  .eyebrow{font:600 ${15 * scale}px/1 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.04em;color:#8a5a38;margin:0 0 ${18 * scale}px}
  h1{font-size:${50 * scale}px;line-height:1.08;letter-spacing:-.03em;font-weight:800;margin:0 0 ${18 * scale}px;word-break:keep-all}
  h1 b{color:#a8432b;font-weight:800;display:block}
  p{font-size:${19 * scale}px;line-height:1.5;margin:0;color:#5c4330;word-break:keep-all}
  .url{position:absolute;left:${64 * scale}px;bottom:${40 * scale}px;font:600 ${16 * scale}px 'JetBrains Mono',ui-monospace,monospace;color:#8a5a38;display:flex;align-items:center;gap:${10 * scale}px;background:#fffaf0f2;padding:${10 * scale}px ${14 * scale}px;border-radius:${12 * scale}px}
  .url i{display:inline-block;width:${22 * scale}px;height:${22 * scale}px;border-radius:50%;background:#c45237}
  .pets{position:absolute;right:${56 * scale}px;bottom:${54 * scale}px;display:flex;align-items:flex-end;gap:${6 * scale}px}
</style><div class="card">
  <img class="environment" src="${environment}" alt="">
  <div class="text"><p class="eyebrow">OPEN SOURCE / macOS / WINDOWS / LINUX</p><h1>${title}</h1><p>${sub}</p></div>
  <div class="pets">
    ${castMarkup(sheets, fittedCastHeight(560 * scale, 156 * scale, 6 * scale))}
  </div>
  <div class="url"><i></i>${url}</div>
</div>`;

const browser = await launchBrowser();
try {
  const render = async (file, opts) => {
    const p = await browser.newPage({ viewport: { width: opts.width, height: opts.height }, deviceScaleFactor: 1 });
    await p.setContent(page(opts));
    await p.evaluate(async sources => {
      await Promise.all(
        sources.map(src => {
          const image = new Image();
          image.src = src;
          return image.decode();
        }),
      );
      await Promise.all(Array.from(document.images, image => image.decode()));
    }, Object.values(sheets));
    await writeFile(file, await p.screenshot({ type: 'png' }));
    await p.close();
    console.log(`Wrote ${file}`);
  };
  const english = {
    ...en,
    url: address(''),
  };
  await render('website/public/og.png', { width: 1200, height: 630, ...english, scale: 1 });
  await render('website/public/og-ko.png', {
    width: 1200,
    height: 630,
    ...ko,
    url: address('ko/'),
    scale: 1,
  });
  await render('website/public/og-ja.png', {
    width: 1200,
    height: 630,
    ...ja,
    url: address('ja/'),
    scale: 1,
  });
  await render('website/public/og-zh-hans.png', {
    width: 1200,
    height: 630,
    ...zh,
    url: address('zh-hans/'),
    scale: 1,
  });
  // The README is English, so its banner is too.
  await render('assets/banner.png', { width: 1600, height: 560, ...english, scale: 1.15 });
} finally {
  await browser.close();
}
