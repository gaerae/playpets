// Takes the website's screenshots from the real app: npm run shots -- 0.2.0   (macOS only)
// For each language the release binary starts with an isolated data folder, the three sample pets and a
// fake AI server, then a scenario (PLAYPETS_E2E_EVAL, as in tests/e2e.mjs) walks it through the
// states below and reports each one with the window's frame; this script captures that frame with
// `screencapture`. The site's languages land in website/public/shots/<version>/<lang>/<name>.webp (2x on
// Retina); every app language also gets the store pictures under release/store/<lang>/.
// Normal shots isolate the app window and compose a controlled backdrop behind its alpha corners.
// Desktop friends use a prepared foreground Chrome backdrop beneath their overlay windows.
// The English run also films the yard for a few seconds and writes assets/demo.gif.
// SHOT_SCENE=seasons captures only spring, summer and winter, preserving every other picture.

import { spawn, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { LANGUAGES } from '../src/core/strings.js';
import { dataUrl, dataUrlBytes } from './art-lib.mjs';
import { launchBrowser } from './browser-lib.mjs';
import { encodeGif } from './gif-lib.mjs';
import { pngSize } from './png-lossless-lib.mjs';
import { captureWindow, clearCaptureFocus, composeWindow, mainDisplay, seasonalScenes } from './shots-lib.mjs';
import { SITE_LANGS as siteLanguages } from './site-content.mjs';

if (process.platform !== 'darwin') {
  console.error(
    'The screenshots are taken on macOS (screencapture). On other systems, drop files into website/public/shots by hand.',
  );
  process.exit(2);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const version = process.argv[2] || JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
const languages = (process.env.SHOT_LANGS || Object.keys(LANGUAGES).join(',')).split(',');
// The languages the website has (website/.vitepress/config.mts locales): the others are captured
// for the store pictures only.
const SITE_LANGS = new Set(siteLanguages);
const binary = process.env.PLAYPETS_BINARY || path.join(root, 'src-tauri/target/release/playpets');
// The window sits below the backdrop window's own title bar, which Chrome keeps at the top.
const WINDOW = { x: 80, y: 170, width: 1180, height: 780 };
// Room around the window in every picture: the backdrop shows through with the window's shadow.
const MARGIN = 28;
// The README's demo animation, filmed in the README's language.
const GIF = { lang: 'en', frames: 50, everyMs: 250, width: 720 };
const adultsOnly = process.env.SHOT_SCENE === 'adults';
const seasonsOnly = process.env.SHOT_SCENE === 'seasons';
const skipGif = adultsOnly || seasonsOnly || process.env.SKIP_GIF === '1';
// Store listings (Microsoft Store, Product Hunt, GitHub's social card) want 16:9 pictures of at
// least 1366×768: these scenes are also set on a 1920×1080 backdrop, centred with a shadow, as
// PNGs under release/store/<lang>/ (not part of the site).
const STORE = {
  names: ['yard-talk', 'friend-chat', 'play-hide-and-seek', 'settings-agents', 'desktop'],
  width: 1920,
  height: 1080,
  pad: 72,
};

// What the friends are called and say, per language. The answers come from the fake server.
const script = {
  ko: {
    names: ['Daisy', 'Clover', 'Pip'],
    persona: 'A curious, warm explorer. Keeps answers short.',
    chat: [
      ['안녕! 아까 뭐 하고 있었어?', '테스트 돌리는 거 옆에서 봤어. 다 통과해서 나도 기분 좋아!'],
      ['고마워. 이제 뭐 할까?', '잠깐 쉬었다가 커밋하자. 내가 지켜볼게.'],
    ],
    talk: { Daisy: '오늘 테스트 다 통과했어!', Clover: '리뷰는 내가 봤지.', Pip: '그럼 간식은 언제 먹어?' },
    talkTo: '오늘 어땠어?',
  },
  en: {
    names: ['Daisy', 'Clover', 'Pip'],
    persona: 'A curious, warm explorer. Keeps answers short.',
    chat: [
      ['Hey! What were you up to?', 'I watched the tests run. All green, so I am happy too!'],
      ['Thanks. What now?', 'Take a short break, then commit. I will keep an eye on things.'],
    ],
    talk: { Daisy: 'All tests passed today!', Clover: 'I did the review.', Pip: 'So when is treat time?' },
    talkTo: 'How was today?',
  },
  ja: {
    names: ['Daisy', 'Clover', 'Pip'],
    persona: 'A curious, warm explorer. Keeps answers short.',
    chat: [
      ['やあ！さっき何してたの？', 'テストが走るのを見てたよ。全部通ったから、ぼくもうれしい！'],
      ['ありがとう。次はどうする？', 'ちょっと休んでからコミットしよう。ぼくが見ててあげる。'],
    ],
    talk: { Daisy: '今日はテスト全部通ったよ！', Clover: 'レビューはぼくがしたよ。', Pip: 'じゃあおやつはいつ？' },
    talkTo: '今日はどうだった？',
  },
  'zh-hans': {
    names: ['Daisy', 'Clover', 'Pip'],
    persona: 'A curious, warm explorer. Keeps answers short.',
    chat: [
      ['嗨！刚才在做什么？', '我在旁边看测试跑完了。全都通过，我也很开心！'],
      ['谢谢。接下来做什么？', '先休息一下，再提交。我帮你盯着。'],
    ],
    talk: { Daisy: '今天的测试全部通过了！', Clover: '代码审查是我看的。', Pip: '那零食什么时候吃？' },
    talkTo: '今天过得怎么样？',
  },
};

const provider = http.createServer(async (req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ models: [{ name: 'tabby' }] }));
  }
  let body = '';
  for await (const c of req) body += c;
  const messages = JSON.parse(body).messages;
  const asked = messages.at(-1).content;
  const system = messages.find(m => m.role === 'system')?.content || '';
  // A line for the friend speaking, when the yard talk asks several friends in turn.
  const talk = Object.values(script)
    .flatMap(s => Object.entries(s.talk))
    .find(([name]) => system.includes(`named ${name}`))?.[1];
  const answer =
    Object.values(script)
      .flatMap(s => s.chat)
      .find(([q]) => asked.includes(q))?.[1] || talk;
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: { content: answer || '...' } }));
});
await new Promise(r => provider.listen(0, '127.0.0.1', r));
const endpoint = `http://127.0.0.1:${provider.address().port}`;

function scenario(lang) {
  const s = script[lang];
  return `(async()=>{
  const inv=(n,a)=>window.__TAURI__.core.invoke('call',{name:n,args:a});
  const L=m=>inv('e2eLog',[m]);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const $=id=>document.getElementById(id);
  const tab=name=>{document.querySelector('.panel-tab[data-panel='+name+']').click();return wait(500);};
  const must=async(label,p)=>{const r=await p;if(!r||r.ok===false)await L(label+'=err:'+(r&&r.error));return r;};
  const settledScene=async()=>{await wait(300);for(let i=0;i<50;i++){if($('yard').dataset.environment==='illustrated'&&document.querySelectorAll('.paint-land canvas').length===1)return;await wait(100);}throw new Error('Background did not finish loading and fading');};
  const clearFocus=${clearCaptureFocus.toString()};
  const shot=async(name,rect)=>{clearFocus(document);await wait(350);const r=rect||(await inv('e2eWindow',['main'])).data;await L('shot '+name+' '+JSON.stringify(r));await wait(1800);};
  try{
    if(document.documentElement.lang!=='${lang}'){localStorage.setItem('lang','${lang}');await L('RELANG');await playPets.quitApp();return;}
    if(document.body.classList.contains('mini'))$('unmini').click();
    await inv('e2eWindow',['main',${JSON.stringify(WINDOW)}]);
    // Native webview choices survive an isolated backend; each capture starts in its intended place.
    $('world').value='woodland';$('world').dispatchEvent(new Event('change'));
    $('weather').value='clear';$('weather').dispatchEvent(new Event('change'));
    $('period').value='day';$('period').dispatchEvent(new Event('change'));
    $('season').value='autumn';$('season').dispatchEvent(new Event('change'));
    const boot=await playPets.bootstrap();
    const coat=n=>{const found=boot.data.assets.find(a=>a.displayName===n);if(!found)throw new Error('Missing capture companion: '+n);return found;};
    const full=id=>{const found=boot.data.assets.find(a=>a.sourceId===id);if(!found)throw new Error('Missing capture companion: '+id);return found;};
    for(const p of boot.data.pets)await playPets.removePet(p.id);
    const adultScene=async()=>{
      const current=(await playPets.bootstrap()).data;
      for(const p of current.pets)await must('removeCast',playPets.removePet(p.id));
      const aria=(await must('addAria',playPets.addPet(full('playpets-aria-full').id))).data;
      const noah=(await must('addNoah',playPets.addPet(full('playpets-noah-full').id))).data;
      await must('placeAria',playPets.updatePet(aria.id,{size:176,x:.35,y:.55}));
      await must('placeNoah',playPets.updatePet(noah.id,{size:176,x:.68,y:.55}));
      $('world').value='studio';$('world').dispatchEvent(new Event('change'));
      $('period').value='day';$('period').dispatchEvent(new Event('change'));
      $('weather').value='clear';$('weather').dispatchEvent(new Event('change'));
      await settledScene();await playPets.openChat(aria.id);await wait(1200);
      await shot('realistic-companions');
      $('edit-pet').click();await wait(800);await shot('friend-appearance');$('cancel-pet-dialog').click();
    };
    if(${adultsOnly}){await adultScene();await L('DONE');return;}
    if(!${seasonsOnly}){await tab('invite');await wait(800);await shot('invite');}
    const p1=(await must('addPet',playPets.addPet(coat('Daisy').id))).data,p2=(await must('addPet2',playPets.addPet(coat('Clover').id))).data,p3=(await must('addPet3',playPets.addPet(coat('Pip').id))).data;
    if(${seasonsOnly}){
      const previousSeason=$('season').value;
      // Hold the composition while keeping the app's real idle animations and seasonal effects.
      const {views}=await import('./core/state.js');
      for(const view of views.values())view.nextWander=Infinity;
      $('close-panel').click();
      await must('placeDaisy',playPets.updatePet(p1.id,{size:176,x:.30,y:.58}));
      await must('placeClover',playPets.updatePet(p2.id,{size:150,x:.53,y:.65}));
      await must('placePip',playPets.updatePet(p3.id,{size:128,x:.74,y:.58}));
      for(const scene of ${JSON.stringify(seasonalScenes())}){
        $('season').value=scene.season;$('season').dispatchEvent(new Event('change'));
        $('weather').value=scene.weather;$('weather').dispatchEvent(new Event('change'));
        await settledScene();await wait(1800);await shot(scene.name);
      }
      $('season').value=previousSeason;$('season').dispatchEvent(new Event('change'));
      await L('DONE');return;
    }
    const save=(await must('saveProvider',playPets.saveProvider({type:'ollama',model:'tabby',endpoint:'${endpoint}'}))).data;
    await must('rename1',playPets.updatePet(p1.id,{name:${JSON.stringify(s.names[0])},size:176,persona:${JSON.stringify(s.persona)},relation:'partner'}));
    await must('rename2',playPets.updatePet(p2.id,{name:${JSON.stringify(s.names[1])},size:150}));
    await must('rename3',playPets.updatePet(p3.id,{name:${JSON.stringify(s.names[2])},size:128}));
    await must('attach1',playPets.updatePet(p1.id,{providerId:save.id}));
    await must('attach2',playPets.updatePet(p2.id,{providerId:save.id}));
    await must('attach3',playPets.updatePet(p3.id,{providerId:save.id}));
    await must('assign1',playPets.assignAgent('claude',p1.id));
    await must('assign2',playPets.assignAgent('codex',p2.id));
    // Claude Code reports in through the binary's own hook mode: the first friend is at work.
    await L('agent claude '+p1.id);await wait(800);
    await tab('pet');await wait(400);
    const ask=async q=>{$('message').value=q;$('message').dispatchEvent(new Event('input'));$('chat-form').requestSubmit();for(let i=0;i<40&&!$('chat-log').textContent.includes(q);i++)await wait(100);for(let i=0;i<60&&document.querySelector('.waiting');i++)await wait(100);};
    ${s.chat.map(([q]) => `await ask(${JSON.stringify(q)});`).join('\n    ')}
    await wait(600);await shot('friend-chat');
    // Friends talking to each other: the group chat shows as speech bubbles in the yard.
    $('close-panel').click();await wait(300);
    playPets.chatWith([p1.id,p2.id,p3.id],${JSON.stringify(s.talkTo)});
    await wait(2600);await shot('yard-talk');await wait(2500);
    $('close-panel').click();$('period').value='evening';$('period').dispatchEvent(new Event('change'));await settledScene();await shot('yard-evening');
    document.querySelector('[data-game=hide]').click();await wait(2600);await shot('play-hide-and-seek');
    const playing=document.querySelector('[data-game].playing');if(playing)playing.click();await wait(400);
    $('world').value='studio';$('world').dispatchEvent(new Event('change'));
    $('period').value='day';$('period').dispatchEvent(new Event('change'));await settledScene();await shot('studio-day');
    $('period').value='night';$('period').dispatchEvent(new Event('change'));await settledScene();await shot('studio-night');
    $('world').value='woodland';$('world').dispatchEvent(new Event('change'));
    $('period').value='day';$('period').dispatchEvent(new Event('change'));
    await tab('settings');document.querySelector('.settings-index [data-section=agent-link-title]').click();await wait(600);await shot('settings-agents');
    $('close-panel').click();await wait(300);$('mini').click();await wait(1500);await shot('mini');
    await playPets.openChat(p1.id);await wait(900);await shot('mini-chat');
    $('close-panel').click();$('unmini').click();await wait(1200);
    await inv('e2eWindow',['main',${JSON.stringify(WINDOW)}]);
    // A few seconds of the yard for the demo animation: a wave together, then a parade.
    if(!${skipGif}&&'${lang}'===${JSON.stringify(GIF.lang)}){
      const r=(await inv('e2eWindow',['main'])).data;
      await L('gif-start '+JSON.stringify(r));
      const {react}=await import('./yard/care.js');react({action:'wave'});await wait(1500);
      playPets.chatWith([p1.id,p2.id,p3.id],${JSON.stringify(s.talkTo)});await wait(3600);
      document.querySelector('[data-game=parade]').click();await wait(5200);
      const on=document.querySelector('[data-game].playing');if(on)on.click();
      await L('gif-end');await wait(600);
    }
    // Desktop mode: friends stand still, the window moves out of the way, the picture is taken around them.
    const state=(await playPets.bootstrap()).data;
    if(state.wander)await playPets.toggleDesktopWander();
    if(!state.desktop)await playPets.toggleDesktop();
    await wait(2500);
    const lay=(await playPets.bootstrap()).data.desktopLayout.filter(l=>[p1.id,p2.id,p3.id].includes(l.id));
    if(lay.length){
      const mon=lay[0].origin;
      const cx=lay.reduce((a,l)=>a+l.x+l.width/2,0)/lay.length,cy=lay.reduce((a,l)=>a+l.y+l.height,0)/lay.length;
      const w=820,h=480;
      const x=Math.max(mon.x,Math.min(mon.x+mon.width-w,cx-w/2)),y=Math.max(mon.y+30,Math.min(mon.y+mon.height-h,cy-h+90));
      const far=cx<mon.x+mon.width/2?mon.x+mon.width-480:mon.x+20;
      await inv('e2eWindow',['main',{x:far,y:mon.y+mon.height-360,width:460,height:320}]);
      await L('backdrop '+JSON.stringify({x,y,width:w,height:h}));await wait(2500);
      await shot('desktop',{x,y,width:w,height:h});
    }else await L('desktop=none');
    await playPets.toggleDesktop();
    await inv('e2eWindow',['main',${JSON.stringify(WINDOW)}]);
    // Named adult baselines and their ordinary friend settings use the real moving scene.
    await adultScene();
    await L('DONE');
  }catch(e){await L('FATAL:'+String(e).slice(0,200));}
})();`;
}

/** The main display's size in points, from system_profiler. (Asking the Finder over AppleScript
 * makes macOS ask whether the terminal's app may control the Finder, and that prompt then sits in
 * every picture.) */
function screenSize() {
  const out = spawnSync('system_profiler', ['SPDisplaysDataType', '-json'], { encoding: 'utf8' }).stdout;
  return mainDisplay(out) || { width: 1728, height: 1117 };
}

// A quiet window the desktop friends are photographed over: a wallpaper and a small terminal.
// Chrome's app mode draws no tabs or address bar; the page comes from a file because app mode
// does not open data: addresses.
let browser;
let backdropUrl;
async function backdrop(rect, { terminal = true } = {}) {
  const file = path.join(os.tmpdir(), 'playpets-shots-backdrop.html');
  backdropUrl = `file://${file}`;
  await writeFile(
    file,
    `<!doctype html><meta charset="utf-8"><title>backdrop</title><style>
    html,body{margin:0;height:100%;background:linear-gradient(135deg,#1d2b3a 0%,#2c4a63 55%,#3f6e86 100%);font-family:ui-monospace,Menlo,monospace;overflow:hidden}
    .term{position:absolute;left:36px;top:30px;width:380px;background:#0f141a;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,.45);color:#cfd8dc;font-size:12px;line-height:1.7;padding:14px 16px 16px}
    .dots{display:flex;gap:6px;margin-bottom:10px}.dots i{width:10px;height:10px;border-radius:50%;background:#ff5f57}.dots i+i{background:#febc2e}.dots i+i+i{background:#28c840}
    .g{color:#8fd694}.d{color:#8aa0b0}</style>
    ${
      terminal
        ? '<div class="term"><div class="dots"><i></i><i></i><i></i></div><div class="d">$ npm test</div><div class="g">✓ unit tests passed</div><div class="d">$ npm run lint</div><div class="g">✓ checks passed</div><div class="d">$ playpets status working</div><div>Companion is working</div></div>'
        : ''
    }`,
  );
  await browser?.close();
  // A fresh profile every time: no sign-in bars or restored tabs can show up in the frame.
  browser = await chromium.launchPersistentContext(await mkdtemp(path.join(os.tmpdir(), 'playpets-shots-chrome-')), {
    channel: 'chrome',
    headless: false,
    chromiumSandbox: true,
    // Playwright would otherwise size the page to 1280×720 and shrink the window with it.
    viewport: null,
    ignoreDefaultArgs: ['--enable-automation'],
    // The window starts 60px above the picture so its title bar stays out of the frame.
    args: [
      `--app=file://${file}`,
      `--window-position=${rect.x},${rect.y - 60}`,
      `--window-size=${rect.width},${rect.height + 60}`,
    ],
  });
}

let captureTools;
let captureEncoder;
let capturePage;
async function prepareCapture() {
  captureTools = await mkdtemp(path.join(os.tmpdir(), 'playpets-shot-tools-'));
  const compiled = spawnSync(
    'swiftc',
    [path.join(here, 'shot-windows.swift'), '-o', path.join(captureTools, 'windows')],
    { encoding: 'utf8' },
  );
  if (compiled.status !== 0) throw new Error(`Cannot prepare window capture: ${compiled.stderr}`);
  captureEncoder = await launchBrowser();
  capturePage = await captureEncoder.newPage();
  await capturePage.addScriptTag({ content: `window.composeWindow=${composeWindow.toString()};` });
}

function parkPointer() {
  const parked = spawnSync(path.join(captureTools, 'windows'), ['--park-pointer'], { encoding: 'utf8' });
  if (parked.status !== 0) throw new Error(`Cannot park capture pointer: ${parked.stderr}`);
  return JSON.parse(parked.stdout);
}

function restorePointer(point) {
  if (point) spawnSync(path.join(captureTools, 'windows'), ['--restore-pointer', String(point.x), String(point.y)]);
}

function nativeWindow(pid, rect) {
  const listed = spawnSync(path.join(captureTools, 'windows'), [String(pid)], { encoding: 'utf8' });
  if (listed.status !== 0) throw new Error(`Cannot read capture window: ${listed.stderr}`);
  return captureWindow(JSON.parse(listed.stdout), pid, rect);
}

function captureNativeWindow(pid, rect, file) {
  const window = nativeWindow(pid, rect);
  const captured = spawnSync('screencapture', ['-x', '-o', '-l', String(window.id), file]);
  if (captured.status !== 0) throw new Error(`Window capture failed: ${captured.stderr}`);
}

async function cleanWindowCapture(pid, rect, file) {
  const raw = `${file}.window.png`;
  const pointer = parkPointer();
  try {
    await new Promise(resolve => setTimeout(resolve, 350));
    captureNativeWindow(pid, rect, raw);
    const png = await readFile(raw);
    const result = await capturePage.evaluate(
      async ({ url, width, margin }) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        window.composeWindow(canvas, image, width, margin);
        return canvas.toDataURL('image/png');
      },
      { url: dataUrl(png), width: rect.width, margin: MARGIN },
    );
    await writeFile(file, dataUrlBytes(result));
  } finally {
    restorePointer(pointer);
    await rm(raw, { force: true });
  }
}

async function desktopCapture(rect, file) {
  const page = browser?.pages().find(page => page.url() === backdropUrl);
  if (!page) throw new Error('Cannot identify desktop capture backdrop');
  await page.bringToFront();
  const pointer = parkPointer();
  try {
    await page.waitForTimeout(350);
    const region = [rect.x, rect.y, rect.width, rect.height].map(Math.round).join(',');
    const captured = spawnSync('screencapture', ['-x', '-o', '-R', region, file]);
    if (captured.status !== 0) throw new Error(`Desktop capture failed: ${captured.stderr}`);
  } finally {
    restorePointer(pointer);
  }
}

// PNG from screencapture is large; the site serves WebP. Chrome re-encodes (no image library needed).
async function toWebp(dir) {
  const encoder = await launchBrowser();
  const page = await encoder.newPage();
  for (const name of (await readdir(dir)).filter(f => f.endsWith('.png'))) {
    const png = await readFile(path.join(dir, name));
    const data = await page.evaluate(async url => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/webp', 0.9);
    }, dataUrl(png));
    const target = path.join(dir, name.replace(/\.png$/, '.webp'));
    const pending = `${target}.tmp`;
    try {
      await writeFile(pending, dataUrlBytes(data));
      await rename(pending, target);
    } finally {
      await rm(pending, { force: true });
    }
    await rm(path.join(dir, name));
  }
  await encoder.close();
}

// Scales the filmed frames to GIF.width in Chrome, reads their pixels back and writes the GIF.
// The demo GIF's frames, filmed during the English run and encoded after it.
let gifFrames = null;
async function writeGif(files, out) {
  if (files.length < 2) return;
  const scaler = await launchBrowser();
  const page = await scaler.newPage();
  await page.addScriptTag({ content: `window.composeWindow=${composeWindow.toString()};` });
  const frames = [];
  let size = { width: 0, height: 0 };
  for (const capture of files) {
    const png = await readFile(capture.file);
    const got = await page.evaluate(
      async ([url, width]) => {
        const img = new Image();
        img.src = url;
        await img.decode();
        const height = Math.round((img.naturalHeight * width) / img.naturalWidth);
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        const clean = document.createElement('canvas');
        window.composeWindow(clean, img, img.naturalWidth);
        ctx.drawImage(clean, 0, 0, width, height);
        const data = ctx.getImageData(0, 0, width, height).data;
        let bin = '';
        for (let i = 0; i < data.length; i += 0x8000)
          bin += String.fromCharCode.apply(null, data.subarray(i, i + 0x8000));
        return { width, height, b64: btoa(bin) };
      },
      [dataUrl(png), GIF.width],
    );
    size = { width: got.width, height: got.height };
    frames.push(new Uint8ClampedArray(Buffer.from(got.b64, 'base64')));
  }
  await scaler.close();
  const delays = files.map((capture, index) =>
    Math.max(2, Math.round(((files[index + 1]?.at ?? capture.end) - capture.at) / 10)),
  );
  await writeFile(out, encodeGif(frames, size.width, size.height, delays));
  console.log(`  ${path.relative(root, out)} (${frames.length} frames, ${size.width}×${size.height})`);
}

async function captureAll(lang) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'playpets-shots-'));
  const onSite = SITE_LANGS.has(lang);
  const outDir = onSite ? path.join(root, 'website/public/shots', version, lang) : path.join(dataDir, 'shots');
  await mkdir(outDir, { recursive: true });
  // An empty Codex pet folder: the shelf shows only the pets that ship with the app.
  const codexHome = path.join(dataDir, 'codex');
  await mkdir(path.join(codexHome, 'pets'), { recursive: true });
  let result;
  for (let attempt = 0; attempt < 2; attempt++) {
    result = await run(lang, dataDir, codexHome, outDir);
    if (result !== 'RELANG') break;
  }
  if (result !== 'DONE') throw new Error(`${lang} capture did not complete: ${result}`);
  // The frames live in the data folder, so the GIF is written before it goes.
  if (gifFrames) await writeGif(gifFrames, path.join(root, 'assets/demo.gif'));
  gifFrames = null;
  if (onSite) await toWebp(outDir);
  await rm(dataDir, { recursive: true, force: true });
  await toStoreSize(path.join(root, 'release/store', lang));
}

// How many of a capture's pixels on each side are the margin around the window: the capture is
// (window + 2 × MARGIN) points wide, at whatever scale the screen has. The desktop scene has none.
function storeCrop(name, png) {
  if (name.startsWith('desktop')) return 0;
  const { width } = pngSize(png);
  return Math.round((MARGIN * width) / (WINDOW.width + MARGIN * 2));
}

// The store pictures: each capture set on a STORE.width × STORE.height backdrop (the gradient the
// captures were taken against), centred and fitted with a pad, with a soft shadow.
async function toStoreSize(dir) {
  const files = await readdir(dir).catch(() => []);
  if (!files.some(f => f.endsWith('.png'))) return;
  const encoder = await launchBrowser();
  const page = await encoder.newPage();
  for (const name of files.filter(f => f.endsWith('.png') && !/-\d+x\d+\.png$/.test(f))) {
    const png = await readFile(path.join(dir, name));
    const data = await page.evaluate(
      async ([url, width, height, pad, crop]) => {
        const img = new Image();
        img.src = url;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const ctx = c.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, width, height);
        g.addColorStop(0, '#1d2b3a');
        g.addColorStop(0.55, '#2c4a63');
        g.addColorStop(1, '#3f6e86');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
        // The site captures keep a margin of backdrop around the window; here the window alone is
        // set on the gradient, so the margin is cut (crop is in the capture's own pixels).
        const sw = img.naturalWidth - crop * 2;
        const sh = img.naturalHeight - crop * 2;
        const scale = Math.min((width - pad * 2) / sw, (height - pad * 2) / sh);
        const w = Math.round(sw * scale);
        const h = Math.round(sh * scale);
        const x = Math.round((width - w) / 2);
        const y = Math.round((height - h) / 2);
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 60;
        ctx.shadowOffsetY = 24;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, crop, crop, sw, sh, x, y, w, h);
        return c.toDataURL('image/png');
      },
      [dataUrl(png), STORE.width, STORE.height, STORE.pad, storeCrop(name, png)],
    );
    const out = path.join(dir, name.replace(/\.png$/, `-${STORE.width}x${STORE.height}.png`));
    await writeFile(out, dataUrlBytes(data));
    await rm(path.join(dir, name));
    console.log(`  ${path.relative(root, out)}`);
  }
  await encoder.close();
}

async function run(lang, dataDir, codexHome, outDir) {
  const storeDir = path.join(root, 'release/store', lang);
  // The backdrop fills the screen, so every margin and the window's rounded corners show it and
  // nothing else. Chrome wants the real size: a larger request falls back to a default window.
  await backdrop({ x: 0, y: 0, ...screenSize() }, { terminal: false });
  return new Promise(resolve => {
    const gif = { timer: undefined, files: [], rect: undefined };
    const child = spawn(binary, [], {
      env: {
        ...process.env,
        PLAYPETS_DATA: dataDir,
        CODEX_HOME: codexHome,
        PLAYPETS_LANG: lang,
        PLAYPETS_E2E_EVAL: scenario(lang),
      },
    });
    let outcome = 'TIMEOUT';
    const finish = () => child.kill();
    const timer = setTimeout(finish, 120000);
    child.stderr.on('data', d => console.log('  [stderr]', d.toString().trim().slice(0, 200)));
    child.stdout.on('data', async d => {
      try {
        for (const line of d.toString().split('\n')) {
          if (!line.startsWith('[e2e] ')) continue;
          const msg = line.slice(6).trim();
          if (msg.startsWith('shot ')) {
            const [, name, json] = msg.match(/^shot (\S+) (.*)$/);
            const r = JSON.parse(json);
            const file = path.join(outDir, `${name}.png`);
            if (name === 'desktop') await desktopCapture(r, file);
            else await cleanWindowCapture(child.pid, r, file);
            console.log(`  ${lang}/${name}.png (isolated capture)`);
            if (STORE.names.includes(name)) {
              await mkdir(storeDir, { recursive: true });
              await cp(file, path.join(storeDir, `${name}.png`));
            }
          } else if (msg.startsWith('agent ')) {
            const [, kind, petId] = msg.split(' ');
            spawnSync(binary, ['hook', kind, '--pet', petId, '--bridge', path.join(dataDir, 'bridge.json')], {
              input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash' }),
              encoding: 'utf8',
              timeout: 5000,
              env: { ...process.env, PLAYPETS_E2E_EVAL: '' },
            });
          } else if (msg.startsWith('backdrop ')) {
            await backdrop(JSON.parse(msg.slice(9)));
          } else if (msg.startsWith('gif-start ')) {
            gif.rect = JSON.parse(msg.slice(10));
            gif.timer = setInterval(() => {
              if (gif.files.length >= GIF.frames) return clearInterval(gif.timer);
              const file = path.join(dataDir, `frame-${String(gif.files.length).padStart(3, '0')}.png`);
              const at = performance.now();
              try {
                captureNativeWindow(child.pid, gif.rect, file);
                gif.files.push({ file, at });
              } catch (error) {
                console.error('GIF capture stopped:', error.message);
                outcome = 'FATAL';
                clearInterval(gif.timer);
                clearTimeout(timer);
                finish();
              }
            }, GIF.everyMs);
          } else if (msg === 'gif-end') {
            // The frames are encoded once the scene is over: encoding blocks this process for
            // a minute, and the desktop shot that follows must be taken while the scene holds.
            clearInterval(gif.timer);
            const end = performance.now();
            gifFrames = gif.files.map(capture => ({ ...capture, end }));
          } else {
            console.log(' ', lang, msg);
            if (msg === 'DONE' || msg.startsWith('FATAL') || msg === 'RELANG') {
              outcome = msg.startsWith('FATAL') ? 'FATAL' : msg;
              clearTimeout(timer);
              setTimeout(finish, 300);
            }
          }
        }
      } catch (error) {
        console.error('Capture stopped:', error.message);
        outcome = 'FATAL';
        clearInterval(gif.timer);
        clearTimeout(timer);
        finish();
      }
    });
    child.on('exit', () => {
      clearTimeout(timer);
      clearInterval(gif.timer);
      resolve(outcome);
    });
  });
}

await prepareCapture();
try {
  for (const lang of languages) {
    console.log(`== ${lang}`);
    await captureAll(lang);
  }
  console.log(`Done: website/public/shots/${version}/`);
} finally {
  await browser?.close();
  await captureEncoder?.close();
  await rm(captureTools, { recursive: true, force: true });
  provider.close();
}
