// Renders the pictures that travel with a link: the Open Graph cards (website/public/og.png and
// og-<language>.png, 1200×630) that X, Slack and GeekNews show, and the README banner (assets/banner.png, 1600×560).
// Both are drawn from the sample pets' real sprite sheets with the headline. Run: npm run og
// Needs Google Chrome or Playwright's Chromium (browser-lib.mjs drives it headless).

import { readFile, writeFile } from 'node:fs/promises';
import { castMarkup, loadEnvironment, loadSheets } from './art-lib.mjs';
import { launchBrowser } from './browser-lib.mjs';

const sheets = await loadSheets();
const environment = await loadEnvironment();
// The address printed on each card: the site's (package.json "homepage") without the scheme.
const { homepage } = JSON.parse(await readFile('package.json', 'utf8'));
const address = folder => `${homepage.replace(/^https?:\/\//, '')}${folder}`.replace(/\/$/, folder ? '/' : '');

const page = ({ width, height, title, sub, url, scale }) => `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;font-family:'Pretendard Variable',Pretendard,-apple-system,system-ui,sans-serif}
  .card{position:relative;width:100%;height:100%;background:#d9eaf3;color:#244d43}
  .environment{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center bottom}
  .text{position:absolute;left:${40 * scale}px;top:${44 * scale}px;max-width:${470 * scale}px;padding:${24 * scale}px;border-radius:${24 * scale}px;background:#fbfcf5f5;box-shadow:0 18px 50px #244d4312}
  .eyebrow{font:600 ${15 * scale}px/1 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.04em;color:#42675b;margin:0 0 ${18 * scale}px}
  h1{font-size:${50 * scale}px;line-height:1.08;letter-spacing:-.03em;font-weight:800;margin:0 0 ${18 * scale}px;word-break:keep-all}
  h1 b{color:#244d43;font-weight:800;display:block}
  p{font-size:${19 * scale}px;line-height:1.5;margin:0;color:#42675b;word-break:keep-all}
  .url{position:absolute;left:${64 * scale}px;bottom:${40 * scale}px;font:600 ${16 * scale}px 'JetBrains Mono',ui-monospace,monospace;color:#42675b;display:flex;align-items:center;gap:${10 * scale}px;background:#fbfcf5f5;padding:${10 * scale}px ${14 * scale}px;border-radius:${12 * scale}px}
  .url i{display:inline-block;width:${22 * scale}px;height:${22 * scale}px;border-radius:50%;background:#879d78}
  .pets{position:absolute;right:${56 * scale}px;bottom:${54 * scale}px;display:flex;align-items:flex-end;gap:${6 * scale}px}
</style><div class="card">
  <img class="environment" src="${environment}" alt="">
  <div class="text"><p class="eyebrow">OPEN SOURCE · macOS · WINDOWS · LINUX</p><h1>${title}</h1><p>${sub}</p></div>
  <div class="pets">
    ${castMarkup(sheets, 156 * scale)}
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
    title: 'A little world<b>beside your work</b>',
    sub: 'Meet Daisy, Clover and Pip. Find your favorite place, enjoy the seasons, and bring your own pets. Connect an AI when you want to talk.',
    url: address(''),
  };
  await render('website/public/og.png', { width: 1200, height: 630, ...english, scale: 1 });
  await render('website/public/og-ko.png', {
    width: 1200,
    height: 630,
    title: '책상 위에 펼쳐지는<b>친구들의 작은 세계</b>',
    sub: '데이지, 클로버, 핍과 좋아하는 풍경에서 계절을 즐겨요. 내 펫도 데려오고, 이야기하고 싶을 때 AI를 연결해요.',
    url: address('ko/'),
    scale: 1,
  });
  await render('website/public/og-ja.png', {
    width: 1200,
    height: 630,
    title: 'デスクトップに広がる<b>友だちの小さな世界</b>',
    sub: 'デイジー、クローバー、ピップと好きな場所で季節を楽しみましょう。自分のペットも招待でき、話したいときはAIをつなげます。',
    url: address('ja/'),
    scale: 1,
  });
  await render('website/public/og-zh-hans.png', {
    width: 1200,
    height: 630,
    title: '桌面上的<b>伙伴小世界</b>',
    sub: '和黛西、三叶草、皮普在喜欢的风景里享受四季。也能带来自己的宠物，想聊天时再连接 AI。',
    url: address('zh-hans/'),
    scale: 1,
  });
  // The README is English, so its banner is too.
  await render('assets/banner.png', { width: 1600, height: 560, ...english, scale: 1.15 });
} finally {
  await browser.close();
}
