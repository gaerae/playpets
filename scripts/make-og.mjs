// Renders the pictures that travel with a link: the Open Graph cards (website/public/og.png and
// og-<language>.png, 1200×630) that X, Slack and GeekNews show, and the README banner (assets/banner.png, 1600×560).
// Both are drawn from the sample pets' real sprite sheets with the headline. Run: npm run og
// Needs Google Chrome (playwright-core drives it headless, as the e2e tools do).

import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { loadEnvironment, loadSheets, cell as sheetCell } from './art-lib.mjs';

const sheets = await loadSheets();
const environment = await loadEnvironment();
// The address printed on each card: the site's (package.json "homepage") without the scheme.
const { homepage } = JSON.parse(await readFile('package.json', 'utf8'));
const address = folder => `${homepage.replace(/^https?:\/\//, '')}${folder}`.replace(/\/$/, folder ? '/' : '');
const cell = (id, row, col, scale) => sheetCell(sheets, id, row, col, scale);

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
  .tag{position:absolute;font:600 ${12 * scale}px 'JetBrains Mono',ui-monospace,monospace;color:#244d43;background:#fbfcf5;border:1.5px solid #c3d1c1;border-radius:${10 * scale}px;padding:${4 * scale}px ${9 * scale}px;white-space:nowrap}
  .tag::before{content:'';display:inline-block;width:${7 * scale}px;height:${7 * scale}px;border-radius:50%;background:#719784;margin-right:${6 * scale}px;vertical-align:1px}
  .pet{position:relative;display:grid;justify-items:center;gap:${8 * scale}px}
</style><div class="card">
  <img class="environment" src="${environment}" alt="">
  <div class="text"><p class="eyebrow">OPEN SOURCE · macOS · WINDOWS · LINUX</p><h1>${title}</h1><p>${sub}</p></div>
  <div class="pets">
    <div class="pet"><span class="tag">Pip</span>${cell('pip', 4, 2, 0.8 * scale)}</div>
    <div class="pet"><span class="tag">Clover</span>${cell('clover', 3, 0, 1.25 * scale)}</div>
    <div class="pet"><span class="tag">Daisy</span>${cell('daisy', 0, 0, 0.85 * scale)}</div>
  </div>
  <div class="url"><i></i>${url}</div>
</div>`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
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
    sub: 'Meet ten built-in companions. Play in the woodland or city studio, bring community pets, and connect an AI when you want to talk.',
    url: address(''),
  };
  await render('website/public/og.png', { width: 1200, height: 630, ...english, scale: 1 });
  await render('website/public/og-ko.png', {
    width: 1200,
    height: 630,
    title: '책상 위에 펼쳐지는<b>친구들의 작은 세계</b>',
    sub: '기본 친구 열 명과 숲속 놀이터, 도시 작업실에서 함께해요. 커뮤니티 펫을 데려오고, 이야기하고 싶을 때 AI를 연결해요.',
    url: address('ko/'),
    scale: 1,
  });
  await render('website/public/og-ja.png', {
    width: 1200,
    height: 630,
    title: 'デスクトップに広がる<b>友だちの小さな世界</b>',
    sub: '10種類の仲間と、森の庭や街を見渡す部屋で過ごしましょう。コミュニティのペットも招待でき、話したいときはAIをつなげます。',
    url: address('ja/'),
    scale: 1,
  });
  await render('website/public/og-zh-hans.png', {
    width: 1200,
    height: 630,
    title: '桌面上的<b>伙伴小世界</b>',
    sub: '与十位内置伙伴在森林乐园和城市工作室一起生活。邀请社区宠物，想聊天时再连接 AI。',
    url: address('zh-hans/'),
    scale: 1,
  });
  // The README is English, so its banner is too.
  await render('assets/banner.png', { width: 1600, height: 560, ...english, scale: 1.15 });
} finally {
  await browser.close();
}
