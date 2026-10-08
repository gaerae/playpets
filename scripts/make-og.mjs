// Renders the pictures that travel with a link: the Open Graph cards (website/public/og.png and
// og-<language>.png, 1200×630) that X, Slack and GeekNews show, and the README banner (assets/banner.png, 1600×560).
// Both are drawn from the sample pets' real sprite sheets with the headline. Run: npm run og
// Needs Google Chrome (playwright-core drives it headless, as the e2e tools do).

import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { loadSheets, cell as sheetCell } from './art-lib.mjs';

const sheets = await loadSheets();
// The address printed on each card: the site's (package.json "homepage") without the scheme.
const { homepage } = JSON.parse(await readFile('package.json', 'utf8'));
const address = folder => `${homepage.replace(/^https?:\/\//, '')}${folder}`.replace(/\/$/, folder ? '/' : '');
const cell = (id, row, col, scale) => sheetCell(sheets, id, row, col, scale);

const page = ({ width, height, title, sub, url, scale }) => `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;font-family:'Pretendard Variable',Pretendard,-apple-system,system-ui,sans-serif}
  .card{position:relative;width:100%;height:100%;background:linear-gradient(180deg,#bfdcf2 0%,#e9f2f7 46%,#eef4ea 100%);color:#3a2a1e}
  .hill{position:absolute;border-radius:50% 50% 0 0 / 100% 100% 0 0}
  .h1{left:-20%;right:30%;bottom:26%;height:34%;background:#c3dfb0}
  .h2{left:-15%;right:-20%;bottom:10%;height:40%;background:#a9d48e}
  .h3{left:-10%;right:-30%;bottom:-12%;height:38%;background:#8fc77a}
  .sun{position:absolute;right:9%;top:12%;width:${64 * scale}px;height:${64 * scale}px;border-radius:50%;background:#ffe08a;box-shadow:0 0 0 ${18 * scale}px rgba(255,224,138,.3)}
  .text{position:absolute;left:${64 * scale}px;top:${72 * scale}px;max-width:${600 * scale}px}
  .eyebrow{font:600 ${15 * scale}px/1 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.04em;color:#5b4a3b;margin:0 0 ${18 * scale}px}
  h1{font-size:${58 * scale}px;line-height:1.08;letter-spacing:-.03em;font-weight:800;margin:0 0 ${18 * scale}px;word-break:keep-all}
  h1 b{color:#c9641d;font-weight:800;display:block}
  p{font-size:${21 * scale}px;line-height:1.5;margin:0;color:#4e3f33;word-break:keep-all}
  .url{position:absolute;left:${64 * scale}px;bottom:${40 * scale}px;font:600 ${16 * scale}px 'JetBrains Mono',ui-monospace,monospace;color:#5b4a3b;display:flex;align-items:center;gap:${10 * scale}px}
  .url i{display:inline-block;width:${22 * scale}px;height:${22 * scale}px;border-radius:50%;background:#f9ae55}
  .pets{position:absolute;right:${56 * scale}px;bottom:${54 * scale}px;display:flex;align-items:flex-end;gap:${6 * scale}px}
  .tag{position:absolute;font:600 ${12 * scale}px 'JetBrains Mono',ui-monospace,monospace;color:#1f3a4d;background:#fff;border:1.5px solid #9fc6e2;border-radius:${10 * scale}px;padding:${4 * scale}px ${9 * scale}px;white-space:nowrap}
  .tag::before{content:'';display:inline-block;width:${7 * scale}px;height:${7 * scale}px;border-radius:50%;background:#4a9bd6;margin-right:${6 * scale}px;vertical-align:1px}
  .pet{position:relative;display:grid;justify-items:center;gap:${8 * scale}px}
</style><div class="card">
  <i class="sun"></i><div class="hill h1"></div><div class="hill h2"></div><div class="hill h3"></div>
  <div class="text"><p class="eyebrow">OPEN SOURCE · macOS · WINDOWS · LINUX</p><h1>${title}</h1><p>${sub}</p></div>
  <div class="pets">
    <div class="pet"><span class="tag">Ollama</span>${cell('mochi', 4, 2, 0.95 * scale)}</div>
    <div class="pet"><span class="tag">Claude Code</span>${cell('tabby', 3, 0, 1.25 * scale)}</div>
    <div class="pet"><span class="tag">Codex</span>${cell('smoky', 0, 0, 1.05 * scale)}</div>
  </div>
  <div class="url"><i></i>${url}</div>
</div>`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const render = async (file, opts) => {
    const p = await browser.newPage({ viewport: { width: opts.width, height: opts.height }, deviceScaleFactor: 1 });
    await p.setContent(page(opts));
    await p.waitForTimeout(300);
    await writeFile(file, await p.screenshot({ type: 'png' }));
    await p.close();
    console.log(`Wrote ${file}`);
  };
  const english = {
    title: 'A yard where<b>pets talk to each other</b>',
    sub: 'Ten thousand Codex pets as they are. Each friend its own AI, friends talking among themselves, any coding agent in company.',
    url: address(''),
  };
  await render('website/public/og.png', { width: 1200, height: 630, ...english, scale: 1 });
  await render('website/public/og-ko.png', {
    width: 1200,
    height: 630,
    title: '서로 이야기하는<b>펫들의 놀이터</b>',
    sub: 'Codex 펫 1만 마리 그대로. 친구마다 다른 AI로 말하고, 서로 이야기하고, 어느 코딩 에이전트와도 함께 일해요.',
    url: address('ko/'),
    scale: 1,
  });
  await render('website/public/og-zh-hans.png', {
    width: 1200,
    height: 630,
    title: '宠物们互相聊天的<b>乐园</b>',
    sub: '一万只 Codex 宠物原样带来。每位伙伴各用一个 AI，互相聊天，陪任何编码代理一起工作。',
    url: address('zh-hans/'),
    scale: 1,
  });
  // The README is English, so its banner is too.
  await render('assets/banner.png', { width: 1600, height: 560, ...english, scale: 1.15 });
} finally {
  await browser.close();
}
