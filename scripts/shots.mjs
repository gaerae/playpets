// Takes the website's screenshots from the real app: npm run shots -- 0.2.0   (macOS only)
// For each language the release binary starts with an isolated data folder, the three sample pets and a
// fake AI server, then a scenario (PLAYPETS_E2E_EVAL, as in tests/e2e.mjs) walks it through the
// states below and reports each one with the window's frame; this script captures that frame with
// `screencapture`. Files land in website/public/shots/<version>/<lang>/<name>.png (2x on Retina).
// Every shot is taken over a plain backdrop window (a Chrome app window behind the app), so the
// rounded corners, the window shadow and the desktop shot never show whatever else is on screen.
// The ko run also films the yard for a few seconds and writes assets/demo.gif.

import { spawn, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { LANGUAGES } from '../src/core/strings.js';
import { encodeGif } from './gif-lib.mjs';

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
const binary = process.env.PLAYPETS_BINARY || path.join(root, 'src-tauri/target/release/playpets');
// The window sits below the backdrop window's own title bar, which Chrome keeps at the top.
const WINDOW = { x: 80, y: 170, width: 1180, height: 780 };
// Room around the window in every picture: the backdrop shows through with the window's shadow.
const MARGIN = 28;
const GIF = { frames: 42, everyMs: 140, width: 720 };
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
    names: ['타비', '스모키', '모찌'],
    persona: '호기심 많고 다정한 고양이예요. 반말로 짧게 말해요.',
    chat: [
      ['안녕! 아까 뭐 하고 있었어?', '테스트 돌리는 거 옆에서 봤어. 다 통과해서 나도 기분 좋아!'],
      ['고마워. 이제 뭐 할까?', '잠깐 쉬었다가 커밋하자. 내가 지켜볼게.'],
    ],
    talk: { 타비: '오늘 테스트 다 통과했어!', 스모키: '리뷰는 내가 봤지.', 모찌: '그럼 간식은 언제 먹어?' },
    talkTo: '오늘 어땠어?',
  },
  en: {
    names: ['Tabby', 'Smoky', 'Mochi'],
    persona: 'A curious, warm cat. Keeps answers short.',
    chat: [
      ['Hey! What were you up to?', 'I watched the tests run. All green, so I am happy too!'],
      ['Thanks. What now?', 'Take a short break, then commit. I will keep an eye on things.'],
    ],
    talk: { Tabby: 'All tests passed today!', Smoky: 'I did the review.', Mochi: 'So when is treat time?' },
    talkTo: 'How was today?',
  },
  ja: {
    names: ['タビ', 'スモーキー', 'モチ'],
    persona: '好奇心いっぱいの優しい猫。短く話す。',
    chat: [
      ['やあ！さっき何してたの？', 'テストが走るのを見てたよ。全部通ったから、ぼくもうれしい！'],
      ['ありがとう。次はどうする？', 'ちょっと休んでからコミットしよう。ぼくが見ててあげる。'],
    ],
    talk: { タビ: '今日はテスト全部通ったよ！', スモーキー: 'レビューはぼくがしたよ。', モチ: 'じゃあおやつはいつ？' },
    talkTo: '今日はどうだった？',
  },
  'zh-hans': {
    names: ['塔比', '烟烟', '麻糬'],
    persona: '好奇又温柔的猫。回答简短随意。',
    chat: [
      ['嗨！刚才在做什么？', '我在旁边看测试跑完了。全都通过，我也很开心！'],
      ['谢谢。接下来做什么？', '先休息一下，再提交。我帮你盯着。'],
    ],
    talk: { 塔比: '今天的测试全部通过了！', 烟烟: '代码审查是我看的。', 麻糬: '那零食什么时候吃？' },
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
  const shot=async(name,rect)=>{const r=rect||(await inv('e2eWindow',['main'])).data;await L('shot '+name+' '+JSON.stringify(r));await wait(1800);};
  try{
    if(document.documentElement.lang!=='${lang}'){localStorage.setItem('lang','${lang}');await L('RELANG');await playPets.quitApp();return;}
    if(document.body.classList.contains('mini'))$('unmini').click();
    await inv('e2eWindow',['main',${JSON.stringify(WINDOW)}]);
    $('weather').value='clear';$('weather').dispatchEvent(new Event('change'));
    $('period').value='day';$('period').dispatchEvent(new Event('change'));
    const boot=await playPets.bootstrap();
    const coat=n=>boot.data.assets.find(a=>a.displayName===n)||boot.data.assets[0];
    for(const p of boot.data.pets)await playPets.removePet(p.id);
    await tab('invite');await wait(800);await shot('invite');
    const p1=(await must('addPet',playPets.addPet(coat('Tabby').id))).data,p2=(await must('addPet2',playPets.addPet(coat('Smoky').id))).data,p3=(await must('addPet3',playPets.addPet(coat('Mochi').id))).data;
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
    $('close-panel').click();$('period').value='evening';$('period').dispatchEvent(new Event('change'));await wait(1800);await shot('yard-evening');
    document.querySelector('[data-game=hide]').click();await wait(2600);await shot('play-hide-and-seek');
    const playing=document.querySelector('[data-game].playing');if(playing)playing.click();await wait(400);
    $('period').value='day';$('period').dispatchEvent(new Event('change'));
    await tab('settings');$('agent-link-title').scrollIntoView({block:'start'});await wait(600);await shot('settings-agents');
    $('close-panel').click();await wait(300);$('mini').click();await wait(1500);await shot('mini');$('unmini').click();await wait(1200);
    await inv('e2eWindow',['main',${JSON.stringify(WINDOW)}]);
    // A few seconds of the yard for the demo animation: a wave together, then a parade.
    if('${lang}'==='ko'){
      const r=(await inv('e2eWindow',['main'])).data;
      await L('gif-start '+JSON.stringify(r));
      $('greet').click();await wait(1500);
      playPets.chatWith([p1.id,p2.id,p3.id],${JSON.stringify(s.talkTo)});await wait(3600);
      document.querySelector('[data-game=parade]').click();await wait(1600);
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
    await L('DONE');
  }catch(e){await L('FATAL:'+String(e).slice(0,200));}
})();`;
}

/** The main display's size in points, from the Finder's desktop window. */
function screenSize() {
  const out = spawnSync('osascript', ['-e', 'tell application "Finder" to get bounds of window of desktop'], {
    encoding: 'utf8',
  }).stdout;
  const [, , w, h] = out
    .trim()
    .split(/\s*,\s*/)
    .map(Number);
  return { width: w || 1728, height: h || 1117 };
}

// A quiet window the desktop friends are photographed over: a wallpaper and a small terminal.
// Chrome's app mode draws no tabs or address bar; the page comes from a file because app mode
// does not open data: addresses.
let browser;
async function backdrop(rect, { terminal = true } = {}) {
  const file = path.join(os.tmpdir(), 'playpets-shots-backdrop.html');
  await writeFile(
    file,
    `<!doctype html><meta charset="utf-8"><title>backdrop</title><style>
    html,body{margin:0;height:100%;background:linear-gradient(135deg,#1d2b3a 0%,#2c4a63 55%,#3f6e86 100%);font-family:ui-monospace,Menlo,monospace;overflow:hidden}
    .term{position:absolute;left:36px;top:30px;width:380px;background:#0f141a;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,.45);color:#cfd8dc;font-size:12px;line-height:1.7;padding:14px 16px 16px}
    .dots{display:flex;gap:6px;margin-bottom:10px}.dots i{width:10px;height:10px;border-radius:50%;background:#ff5f57}.dots i+i{background:#febc2e}.dots i+i+i{background:#28c840}
    .g{color:#8fd694}.d{color:#8aa0b0}</style>
    ${
      terminal
        ? '<div class="term"><div class="dots"><i></i><i></i><i></i></div><div class="d">$ npm test</div><div>✓ 59 passed</div><div>✓ 74 passed</div><div class="g">PASS: tauri e2e</div><div class="d">$ git commit -m "Release"</div><div>[main 7e1f2a9] Release</div></div>'
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

// PNG from screencapture is large; the site serves WebP. Chrome re-encodes (no image library needed).
async function toWebp(dir) {
  const encoder = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await encoder.newPage();
  for (const name of (await readdir(dir)).filter(f => f.endsWith('.png'))) {
    const png = await readFile(path.join(dir, name));
    const data = await page.evaluate(async b64 => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/webp', 0.9);
    }, png.toString('base64'));
    await writeFile(path.join(dir, name.replace(/\.png$/, '.webp')), Buffer.from(data.split(',')[1], 'base64'));
    await rm(path.join(dir, name));
  }
  await encoder.close();
}

// Scales the filmed frames to GIF.width in Chrome, reads their pixels back and writes the GIF.
// The demo GIF's frames, filmed during the ko run and encoded after it.
let gifFrames = null;
async function writeGif(files, out) {
  if (files.length < 2) return;
  const scaler = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await scaler.newPage();
  const frames = [];
  let size = { width: 0, height: 0 };
  for (const file of files) {
    const png = await readFile(file);
    const got = await page.evaluate(
      async ([b64, width]) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const height = Math.round((img.naturalHeight * width) / img.naturalWidth);
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        const data = ctx.getImageData(0, 0, width, height).data;
        let bin = '';
        for (let i = 0; i < data.length; i += 0x8000)
          bin += String.fromCharCode.apply(null, data.subarray(i, i + 0x8000));
        return { width, height, b64: btoa(bin) };
      },
      [png.toString('base64'), GIF.width],
    );
    size = { width: got.width, height: got.height };
    frames.push(new Uint8ClampedArray(Buffer.from(got.b64, 'base64')));
  }
  await scaler.close();
  await writeFile(out, encodeGif(frames, size.width, size.height, Math.round(GIF.everyMs / 10)));
  console.log(`  ${path.relative(root, out)} (${frames.length} frames, ${size.width}×${size.height})`);
}

async function captureAll(lang) {
  const outDir = path.join(root, 'website/public/shots', version, lang);
  await mkdir(outDir, { recursive: true });
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'playpets-shots-'));
  // An empty Codex pet folder: the shelf shows only the pets that ship with the app.
  const codexHome = path.join(dataDir, 'codex');
  await mkdir(path.join(codexHome, 'pets'), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await run(lang, dataDir, codexHome, outDir);
    if (result !== 'RELANG') break;
  }
  // The frames live in the data folder, so the GIF is written before it goes.
  if (gifFrames) await writeGif(gifFrames, path.join(root, 'assets/demo.gif'));
  gifFrames = null;
  await rm(dataDir, { recursive: true, force: true });
  await toWebp(outDir);
  await toStoreSize(path.join(root, 'release/store', lang));
}

// How many of a capture's pixels on each side are the margin around the window: the capture is
// (window + 2 × MARGIN) points wide, at whatever scale the screen has. The desktop scene has none.
function storeCrop(name, png) {
  if (name.startsWith('desktop')) return 0;
  const width = png.readUInt32BE(16);
  return Math.round((MARGIN * width) / (WINDOW.width + MARGIN * 2));
}

// The store pictures: each capture set on a STORE.width × STORE.height backdrop (the gradient the
// captures were taken against), centred and fitted with a pad, with a soft shadow.
async function toStoreSize(dir) {
  const files = await readdir(dir).catch(() => []);
  if (!files.some(f => f.endsWith('.png'))) return;
  const encoder = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await encoder.newPage();
  for (const name of files.filter(f => f.endsWith('.png') && !/-\d+x\d+\.png$/.test(f))) {
    const png = await readFile(path.join(dir, name));
    const data = await page.evaluate(
      async ([b64, width, height, pad, crop]) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
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
      [png.toString('base64'), STORE.width, STORE.height, STORE.pad, storeCrop(name, png)],
    );
    const out = path.join(dir, name.replace(/\.png$/, `-${STORE.width}x${STORE.height}.png`));
    await writeFile(out, Buffer.from(data.split(',')[1], 'base64'));
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
      for (const line of d.toString().split('\n')) {
        if (!line.startsWith('[e2e] ')) continue;
        const msg = line.slice(6).trim();
        if (msg.startsWith('shot ')) {
          const [, name, json] = msg.match(/^shot (\S+) (.*)$/);
          const r = JSON.parse(json);
          const file = path.join(outDir, `${name}.png`);
          await rm(path.join(outDir, `${name}.webp`), { force: true });
          const m = name === 'desktop' ? 0 : MARGIN;
          const region = [r.x - m, r.y - m, r.width + m * 2, r.height + m * 2].map(Math.round).join(',');
          const cap = spawnSync('screencapture', ['-x', '-o', '-R', region, file]);
          console.log(`  ${lang}/${name}.png`, cap.status === 0 ? `(${region})` : `FAILED ${cap.stderr}`);
          if (STORE.names.includes(name) && cap.status === 0) {
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
          const region = [gif.rect.x, gif.rect.y, gif.rect.width, gif.rect.height].map(Math.round).join(',');
          gif.timer = setInterval(() => {
            if (gif.files.length >= GIF.frames) return clearInterval(gif.timer);
            const file = path.join(dataDir, `frame-${String(gif.files.length).padStart(3, '0')}.png`);
            if (spawnSync('screencapture', ['-x', '-o', '-R', region, file]).status === 0) gif.files.push(file);
          }, GIF.everyMs);
        } else if (msg === 'gif-end') {
          // The frames are encoded once the scene is over: encoding blocks this process for
          // a minute, and the desktop shot that follows must be taken while the scene holds.
          clearInterval(gif.timer);
          gifFrames = gif.files.slice();
        } else {
          console.log(' ', lang, msg);
          if (msg === 'DONE' || msg.startsWith('FATAL') || msg === 'RELANG') {
            outcome = msg.startsWith('FATAL') ? 'FATAL' : msg;
            clearTimeout(timer);
            setTimeout(finish, 300);
          }
        }
      }
    });
    child.on('exit', () => {
      clearTimeout(timer);
      resolve(outcome);
    });
  });
}

for (const lang of languages) {
  console.log(`== ${lang}`);
  await captureAll(lang);
}
await browser?.close();
provider.close();
console.log(`Done: website/public/shots/${version}/`);
