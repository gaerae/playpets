// PlayPets Tauri E2E: launches the release binary with an isolated data dir,
// drives the real UI bridge via PLAYPETS_E2E_EVAL, reads results from the
// [e2e] stdout channel. A fake ollama server covers the HTTP chat path.
// Run: npm run test:e2e   (repo root)

import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { strings as KO } from '../src/core/strings/ko.js';
import { writeFixturePet } from './support/fixture-pet.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const binary =
  process.env.PLAYPETS_BINARY ||
  path.join(here, '../src-tauri/target/release', process.platform === 'win32' ? 'playpets.exe' : 'playpets');
const dataDir = await mkdtemp(path.join(os.tmpdir(), 'playpets-tauri-e2e-'));
// A self-contained Codex pet so the run never depends on the machine's ~/.codex/pets.
const codexHome = path.join(dataDir, 'codex');
await writeFixturePet(codexHome);

const chatRequests = [];
const provider = http.createServer(async (req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ models: [{ name: 'flow-model' }, { name: 'flow-mini' }] }));
  }
  let body = '';
  for await (const c of req) body += c;
  chatRequests.push(JSON.parse(body));
  if (body.includes('천천히')) await new Promise(r => setTimeout(r, 1500));
  res.writeHead(200, { 'Content-Type': 'application/json' });
  const asked = chatRequests.at(-1).messages.at(-1).content;
  res.end(
    JSON.stringify({
      message: {
        content: asked.includes('성격 바꿔')
          ? '좋아, 그렇게 할게!\n<persona>느긋하고 다정한 고양이</persona>'
          : '**타우리** 응답!',
      },
    }),
  );
});
await new Promise(r => provider.listen(0, '127.0.0.1', r));
const endpoint = `http://127.0.0.1:${provider.address().port}`;

// The run uses Korean (PLAYPETS_LANG ko, which exercises the particle rules), so what the scenario
// reads off the screen comes from the Korean table rather than being typed out here.
const say = key => JSON.stringify(KO[key]);
const stopGame = game => KO['game.stop'].replace('{name}', KO[game]);
const literal = text => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const scenario = `(async()=>{
  const L=m=>window.__TAURI__.core.invoke('call',{name:'e2eLog',args:[m]});
  const must=async(label,p)=>{const r=await p;await L(label+'='+(r&&r.ok!==undefined?(r.ok?'ok':'err:'+r.error):JSON.stringify(r).slice(0,60)));return r;};
  // Polls until f() is truthy (or ms pass) and returns that value, so no check sleeps for a fixed time.
  const until=async(f,ms=5000)=>{const end=Date.now()+ms;let v=await f();while(!v&&Date.now()<end){await new Promise(r=>setTimeout(r,50));v=await f();}return v;};
  // "ResizeObserver loop completed with undelivered notifications" is the browser deferring a
  // resize to the next frame, not a fault in the page, so it is not counted.
  let pageError='';window.addEventListener('error',e=>{if(!pageError&&!String(e.message).startsWith('ResizeObserver loop'))pageError=e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno;});
  try{
    const boot=await playPets.bootstrap();
    await L('assets='+boot.data.assets.length);
    await L('communities='+boot.data.communities.length);
    // The shelf says where each pet file lives: the fixture sits in Codex's pet folder.
    const fx=boot.data.assets.find(x=>x.displayName==='Fixture');
    await L('builtin='+boot.data.assets.filter(x=>x.place==='builtin').length);
    await L('place='+fx.place+'/'+(boot.data.petFolders.codex.endsWith('pets')?'folder-known':'err'));
    // Pets are drawn from the app's own sprite address, which the page's CSP must let in on every system.
    const img=new Image();img.src=fx.spriteUrl;
    await L('spriteLoads='+await img.decode().then(()=>img.naturalWidth,e=>'err:'+e.message));
    const a=fx.id;
    const p1=await must('addPet',playPets.addPet(a));
    await L('intro='+p1.data.persona);
    await must('rename',playPets.updatePet(p1.data.id,{name:'타우리',size:160,persona:'반말로 짧게 대답해요.'}));
    const save=await must('saveProvider',playPets.saveProvider({type:'ollama',model:'flow-model',endpoint:'${endpoint}'}));
    await must('attach',playPets.updatePet(p1.data.id,{providerId:save.data.id}));
    await must('bond',playPets.updatePet(p1.data.id,{relation:'partner',callMe:'자기'}));
    const agentState=await until(async()=>(await playPets.bootstrap()).data.statuses[p1.data.id]?.state==='working'&&'working',10000)||'none';
    await L('agentStatus='+agentState);
    const models=await playPets.listModels({type:'ollama',endpoint:'${endpoint}',model:''});
    await L('models='+(models.ok?models.data.length:'err'));
    const chat=await playPets.chat(p1.data.id,'안녕!');
    await L('chat='+(chat.ok?chat.data:'err:'+chat.error));
    const asked=await playPets.chat(p1.data.id,'성격 바꿔 줘: 느긋하게');
    const learned=(await playPets.bootstrap()).data.pets.find(p=>p.id===p1.data.id).persona;
    await L('personaByChat='+(asked.ok?asked.data:'err')+'|'+learned);
    await playPets.updatePet(p1.data.id,{persona:'반말로 짧게 대답해요.'});await playPets.clearChat(p1.data.id);await playPets.chat(p1.data.id,'안녕!');
    const hist=await playPets.getChat(p1.data.id);
    await L('history='+(hist.ok?hist.data.length:'err'));
    const p2=await must('addPet2',playPets.addPet(a));
    await must('attach2',playPets.updatePet(p2.data.id,{name:'둘째',providerId:save.data.id,persona:''}));
    const homeBefore=(await playPets.bootstrap()).data.pets.map(p=>p.x+','+p.y).join('|');
    const group=await playPets.chatWith([p1.data.id,p2.data.id],'둘 다 안녕');
    await L('group='+(group.ok?group.data.map(r=>r.name).join('+'):'err:'+group.error));
    const h1=await playPets.getChat(p1.data.id);
    await L('groupHistory='+(h1.ok&&h1.data.some(m=>m.name==='둘째'&&m.content.startsWith('[둘째] '))?'peer-tagged':'err'));
    // The yard's chatter button: friends with an AI talk among themselves, shown as bubbles.
    const chatterButton=document.getElementById('chatter'),chatterOn=!chatterButton.disabled;chatterButton.click();
    const bubbles=()=>document.querySelectorAll('.yard-bubble:not([hidden])').length;await until(()=>bubbles()>=2,6000);const said=bubbles();
    await L('chatter='+(chatterOn?said:'disabled'));await new Promise(r=>setTimeout(r,1500));
    // Answers are Markdown: the chat shows the emphasis, and no mark is left to read.
    for(const id of [p2.data.id,p1.data.id]){document.getElementById('friend-select').value=id;document.getElementById('friend-select').dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,400));}
    const shownLog=document.getElementById('chat-log');
    await L('markdown='+(shownLog.querySelector('.message.assistant strong')?.textContent==='타우리'&&!shownLog.textContent.includes('**')?'styled':'err:'+shownLog.textContent.slice(0,60)));
    // While an answer is on its way the conversation says so, and stops saying so when it arrives.
    const slow=playPets.chat(p1.data.id,'천천히 대답해 줘');await new Promise(r=>setTimeout(r,700));
    const waitingShown=!!shownLog.querySelector('.waiting')&&document.querySelector('.yard-pet.thinking')!==null;
    await slow;await new Promise(r=>setTimeout(r,500));
    await L('waiting='+(waitingShown&&!shownLog.querySelector('.waiting')&&!document.querySelector('.yard-pet.thinking')?'shown-then-gone':'err:'+waitingShown));
    // The yard itself: scenery-first layout, greeting bubbles, games.
    const playing=()=>document.querySelector('[data-game].playing'),gameLabel=()=>playing()?.textContent||${say('game.label')};
    const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms)),press=el=>el.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true}));
    // Every tab must actually show its own content, and only its own.
    // macOS keeps its own window buttons over the page; elsewhere the page draws them and the system bar is gone.
    const drawn=getComputedStyle(document.querySelector('.win-controls')).display!=='none';
    await L('chrome='+(document.documentElement.classList.contains('mac')?(drawn?'err':'mac-native'):(drawn?'custom:'+(outerHeight-innerHeight):'err')));
    if(!$('side-panel').hidden)$('close-panel').click();
    const shown=[];for(const k of ['pet','invite','settings']){document.querySelector('.panel-tab[data-panel='+k+']').click();await wait(150);shown.push(['pet','invite','settings'].filter(o=>$('panel-'+o).getBoundingClientRect().height>40).join(','));}
    const opened=!$('side-panel').hidden;$('close-panel').click();await wait(300);
    await L('panel='+(opened&&$('side-panel').hidden&&shown.join('|')==='pet|invite|settings'?'toggles':'err:'+shown.join('|')));
    // About: the app's own pages, from the addresses the backend reports; "What's new" waits for an update.
    const project=(await playPets.bootstrap()).data.project||{};
    await L('about='+document.querySelectorAll('#panel-settings button[data-link]').length+'/'+(String(project.site).startsWith('https://')&&String(project.repository).startsWith('https://github.com/')?'addresses':'none')+'/'+($('update-notes').hidden?'notes-hidden':'notes-shown'));
    // An update found in the background: the top-bar button and the Settings dot show it, the button
    // opens the dialog, and Later puts the button away while the dot stays. Nothing is installed.
    const sections=[...document.querySelectorAll('#panel-settings .settings-section h3')].map(h=>h.id).join(',');
    const inAbout=!!document.querySelector('.settings-section.about #update-button');
    window.__pp('event',{type:'update',update:{version:'9.9.9',notes:''}});await wait(200);
    const tabDot=document.querySelector('.panel-tab[data-panel=settings]').classList.contains('has-update');
    const pillShown=!$('update-pill').hidden&&$('update-pill-label').textContent==='v9.9.9';
    $('update-pill').click();await wait(200);
    const updateDialogOpen=$('update-dialog').open&&$('update-title').textContent.includes('v9.9.9');
    $('update-later').click();await wait(200);
    const putAway=!$('update-dialog').open&&$('update-pill').hidden&&document.querySelector('.panel-tab[data-panel=settings]').classList.contains('has-update');
    await L('updateUi='+sections+'/'+(inAbout&&tabDot&&pillShown&&updateDialogOpen&&putAway?'ok':'err:'+[inAbout,tabDot,pillShown,updateDialogOpen,putAway].join(',')));
    await L('stage='+($('yard').getBoundingClientRect().height/innerHeight>.6?'yard-first':'small:'+$('yard').getBoundingClientRect().height));
    $('weather').value='snow';$('weather').dispatchEvent(new Event('change'));
    await L('weather='+($('yard').classList.contains('weather-snow')&&$('weather-layer').width>0?'snow-canvas':'err'));
    $('greet').click();await until(()=>[...document.querySelectorAll('.yard-bubble')].filter(b=>!b.hidden&&b.textContent).length>=2);
    await L('greetBubbles='+[...document.querySelectorAll('.yard-bubble')].filter(b=>!b.hidden&&b.textContent).length);
    document.querySelector('[data-game=hide]').click();
    // Friends only walk while the window is drawn. Behind other windows (or with the screen off)
    // the webview stops animating, so the walk to the hiding spots cannot be observed.
    if(document.visibilityState==='hidden'){const started=gameLabel();playing().click();await L('hide=window-hidden/'+started+'/'+gameLabel());}
    else{
      await until(()=>document.querySelectorAll('.yard-pet.hiding').length>=2,8000);const hiding=document.querySelectorAll('.yard-pet.hiding').length;
      // The game names a friend: someone else is a miss and stays hidden, the named one is found.
      const asked=()=>$('banner-label').textContent===${say('hide.find_label')}?$('banner-title').textContent:null,byName=n=>[...document.querySelectorAll('.yard-pet.hiding')].find(b=>b.querySelector('.pet-tag').textContent===n);
      const first=asked(),other=[...document.querySelectorAll('.yard-pet.hiding')].find(b=>b!==byName(first));
      press(other);await wait(200);
      const miss=document.querySelectorAll('.yard-pet.hiding').length===2&&!$('game-banner').hidden&&$('banner-sub').textContent.includes(${say('hide.miss')})&&asked()===first;
      press(byName(first));await wait(300);const second=asked();press(byName(second));await wait(2200);
      const cleared=$('game-banner').hidden;
      await L('hide='+hiding+'/'+document.querySelectorAll('.yard-pet.hiding').length+'/'+gameLabel()+'/'+(miss&&cleared&&second!==first?'by-name':'err:'+miss+':'+first+':'+second));
    }
    document.querySelector('[data-game=tag]').click();await wait(400);
    const tagger=document.querySelectorAll('.yard-pet.tagger').length;playing().click();
    document.querySelector('[data-game=parade]').click();await wait(400);const parading=gameLabel();playing().click();
    await L('games='+tagger+'/'+parading+'/'+gameLabel());
    // The page fits its window exactly: no scrollbar, full size or mini.
    const fits=()=>document.body.scrollHeight<=document.body.clientHeight&&document.body.scrollWidth<=document.body.clientWidth;
    const fitsFull=fits();
    const wide=innerWidth;$('mini').click();await until(()=>document.body.classList.contains('mini')&&innerWidth<wide);await wait(300);
    const small=document.body.classList.contains('mini')&&innerWidth<wide&&innerWidth<=520&&getComputedStyle(document.querySelector('.topbar')).display==='none'&&Math.abs($('yard').getBoundingClientRect().height-innerHeight)<=2&&[...document.querySelectorAll('.yard-pet')].every(b=>b.getBoundingClientRect().bottom<=innerHeight+1);
    const fitsMini=fits();$('unmini').click();await until(()=>!document.body.classList.contains('mini')&&innerWidth===wide);await wait(300);
    await L('pageFits='+fitsFull+'/'+fitsMini);
    await L('mini='+(small&&!document.body.classList.contains('mini')&&innerWidth===wide?'shrinks-and-restores':'err:'+small+'/'+innerWidth+'/'+wide));
    const home=(await playPets.bootstrap()).data.pets.map(p=>p.x+','+p.y).join('|');
    await L('gamesKeepHome='+(home===homeBefore));
    // Inviting from the shelf and opening the AI dialog go through the page's own buttons.
    const before=(await playPets.bootstrap()).data.pets.length;
    document.querySelector('.panel-tab[data-panel=invite]').click();await wait(200);
    // A loaded machine (a build running beside the test) can take longer than the usual five seconds here.
    document.querySelector('#shelf .asset-card').click();await until(async()=>(await playPets.bootstrap()).data.pets.length===before+1&&document.querySelectorAll('.yard-pet').length===before+1,15000);
    const after=(await playPets.bootstrap()).data.pets;
    const invited=after.length===before+1&&document.querySelectorAll('.yard-pet').length===after.length&&$('friend-select').value===after.at(-1).id;
    document.querySelector('.panel-tab[data-panel=pet]').click();await wait(200);
    $('configure').click();await wait(300);const dialogOpen=$('connection-dialog').open;$('cancel-dialog').click();
    await L('pageButtons='+(invited&&dialogOpen?'invite-and-connect':'err:'+invited+'/'+dialogOpen));
    // Sending a friend away from the friend tab asks first, by name: Cancel keeps everyone, confirming does not.
    const guest=after.at(-1);
    $('remove-friend').click();await wait(300);
    const confirmAsked=$('confirm-dialog').open&&$('confirm-title').textContent.includes(${JSON.stringify(KO['friend.send_away_confirm'].replace(/^\{[^}]*\}\s*/, ''))})&&document.activeElement===$('confirm-cancel');
    $('confirm-cancel').click();await wait(400);
    const kept=!$('confirm-dialog').open&&(await playPets.bootstrap()).data.pets.some(p=>p.id===guest.id);
    $('remove-friend').click();await wait(300);$('confirm-ok').click();await until(async()=>!(await playPets.bootstrap()).data.pets.some(p=>p.id===guest.id)&&document.querySelectorAll('.yard-pet').length===before);
    const gone=!(await playPets.bootstrap()).data.pets.some(p=>p.id===guest.id)&&document.querySelectorAll('.yard-pet').length===before;
    await L('sendAway='+(confirmAsked&&kept&&gone?'asks-then-removes':'err:'+confirmAsked+'/'+kept+'/'+gone));
    await must('removePet2',playPets.removePet(p2.data.id));
    const snippet=await playPets.copyConnection('claude');
    await L('snippet='+(snippet.ok&&snippet.data.includes('hook claude')&&!snippet.data.includes('node ')?'binary':'err'));
    // An agent can report to a chosen friend: the copied settings then name it.
    await must('assignAgent',playPets.assignAgent('claude',p1.data.id));
    const assigned=await playPets.copyConnection('claude');
    const sel=document.querySelector('select[data-agent=claude]');
    await L('assigned='+(assigned.ok&&assigned.data.includes('--pet')&&assigned.data.includes(p1.data.id)&&sel.value===p1.data.id?'named':'err:'+(assigned.ok?assigned.data.includes('--pet'):assigned.error)+'/'+sel.value));
    await must('unassignAgent',playPets.assignAgent('claude',''));
    // Hidden to the tray, the page is told so and rests (WebView2 may not say it through
    // document.hidden); shown again, it moves again.
    await playPets.windowHide();const unseen=!!await until(()=>document.documentElement.hasAttribute('data-unseen'));
    await playPets.openChat(p1.data.id);await until(()=>!document.documentElement.hasAttribute('data-unseen'));
    await L('unseen='+unseen+'/'+document.documentElement.hasAttribute('data-unseen'));
    await must('desktopOn',playPets.toggleDesktop());
    await until(async()=>(await playPets.bootstrap()).data.desktopLayout.length>0,8000);
    const b2=await playPets.bootstrap();
    await L('overlayLayout='+b2.data.desktopLayout.length);
    await must('wanderOn',playPets.toggleDesktopWander());
    await must('removeProvider',playPets.removeProvider(save.data.id));
    const b3=await playPets.bootstrap();
    await L('detached='+(b3.data.pets[0].providerId===''&&b3.data.providers.length===0));
    await must('desktopOff',playPets.toggleDesktop());
    // Closing the overlay once aborted the whole app a moment later; stay around long enough to notice.
    await new Promise(r=>setTimeout(r,2500));
    await L('overlayClosed=alive');
    await L('pageErrors='+(pageError||'none'));
    await L('DONE');
  }catch(e){await L('FATAL:'+String(e).slice(0,140));}
})();`;

// The scenario runs inside the app, where a syntax error would only show as every check failing.
try {
  new Function(`return async()=>{${scenario}}`);
} catch (error) {
  console.error(`The e2e scenario does not parse: ${error.message}`);
  process.exit(1);
}
const child = spawn(binary, [], {
  env: {
    ...process.env,
    PLAYPETS_DATA: dataDir,
    CODEX_HOME: codexHome,
    PLAYPETS_LANG: 'ko',
    PLAYPETS_E2E_EVAL: scenario,
  },
});
const lines = [];
let done = false;
child.stderr.on('data', d => console.log('  [stderr]', d.toString().trim().slice(0, 300)));
child.on('exit', (code, signal) => {
  if (!done) console.log('  [exit]', code, signal);
});
child.stdout.on('data', d => {
  for (const line of d.toString().split('\n')) {
    if (!line.startsWith('[e2e] ')) continue;
    const msg = line.slice(6).trim();
    lines.push(msg);
    console.log(' ', msg);
    if (msg === 'DONE' || msg.startsWith('FATAL')) done = true;
    if (msg === 'attach=ok') agentReports();
  }
});
// Plays a coding agent through the app binary's own CLI mode — no Node.js involved.
const agentChecks = {};
function agentReports() {
  const bridge = path.join(dataDir, 'bridge.json');
  // Options go before a `--`: what follows it is the command `run` starts.
  const cli = (args, input) =>
    spawnSync(
      binary,
      args
        .flatMap(a => (a === '--' ? ['--bridge', bridge, '--'] : [a]))
        .concat(args.includes('--') ? [] : ['--bridge', bridge]),
      {
        input,
        encoding: 'utf8',
        timeout: 5000,
        env: { ...process.env, PLAYPETS_E2E_EVAL: '' },
      },
    );
  // The hook first: the scenario is waiting for the status it sets.
  const hook = cli(['hook', 'claude'], JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash' }));
  const say = cli(['say', '안녕', '에이전트', '--pet', '타우리']);
  const react = cli(['react', 'jump']);
  agentChecks.cli = say.status === 0 && react.status === 0;
  agentChecks.hookSilent = hook.status === 0 && hook.stdout === '';
  // `pets` prints the yard; a status for a pet that does not exist is refused with a hint. Both
  // leave the hook's "working" state, which the scenario and the prompt checks look at, alone.
  const pets = cli(['pets']);
  agentChecks.pets = pets.status === 0 && JSON.parse(pets.stdout || '[]').some(p => p.name === '타우리');
  const nobody = cli(['status', 'done', '--pet', 'nobody']);
  agentChecks.badPet = nobody.status === 1 && nobody.stderr.includes('Pet not found');
  // `run` hands back the command's own exit code (the state goes to a pet that is not there).
  const run = cli(['run', '--pet', 'nobody', '--', process.execPath, '-e', 'process.exit(3)']);
  agentChecks.run = run.status === 3;
  // Gemini CLI reads the hook's stdout as JSON: an event it does not report still gets `{}`.
  const gemini = cli(['hook', 'gemini'], JSON.stringify({ hook_event_name: 'BeforeModel' }));
  agentChecks.geminiJson = gemini.status === 0 && gemini.stdout.trim() === '{}';
  const mcp = cli(
    ['mcp'],
    `${[
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_pets' } }),
    ].join('\n')}\n`,
  );
  const replies = mcp.stdout
    .trim()
    .split('\n')
    .map(l => JSON.parse(l));
  agentChecks.mcp =
    replies[0]?.result?.serverInfo?.name === 'playpets' &&
    JSON.parse(replies[1]?.result?.content?.[0]?.text || '[]')[0]?.name === '타우리';
}
const deadline = Date.now() + 90000;
while (!done && Date.now() < deadline) await new Promise(r => setTimeout(r, 200));
child.kill();
provider.closeAllConnections?.();
provider.close();

const expect = [
  [/^assets=[1-9]/, 'catalog scan'],
  [/^addPet=ok/, 'add a pet'],
  [/^intro=A test kitten\. \(animal\)$/, 'a new friend starts with the pet file description as its personality'],
  [/^rename=ok/, 'rename and resize'],
  [/^saveProvider=ok/, 'save a provider'],
  [/^attach=ok/, 'attach a provider to a pet'],
  [/^assigned=named$/, 'assign a friend to an agent'],
  [/^communities=[1-9]/, 'list of communities'],
  [/^place=codex\/folder-known$/, 'where a pet lives (Codex pet folder)'],
  [/^agentStatus=working$/, 'agent status arrives through the bridge'],
  [/^snippet=binary$/, 'agent setup points at the app binary (no Node)'],
  [/^unseen=true\/false$/, 'a hidden window rests and moves again when shown'],
  [/^models=2/, 'live model list'],
  [/^chat=\*\*타우리\*\* 응답!/, 'HTTP chat round trip'],
  [
    /^personaByChat=좋아, 그렇게 할게!\|느긋하고 다정한 고양이$/,
    'personality saved through chat (marker removed from the reply)',
  ],
  [/^history=2/, 'chat history saved'],
  [/^group=타우리\+둘째$/, 'group chat (friends answer in turn)'],
  [/^groupHistory=peer-tagged$/, "a friend's line is recorded with its name"],
  [/^chatter=[2-9]$/, 'yard chatter (friends talk in bubbles)'],
  [/^pageErrors=none$/, 'no page errors (frame loops included)'],
  [/^markdown=styled$/, 'markdown emphasis in replies is styled'],
  [/^waiting=shown-then-gone$/, 'waiting indicator while a reply is on its way'],
  [/^chrome=(mac-native|custom:0)$/, 'title bar blends with the page (per OS)'],
  [/^panel=toggles$/, 'panel tabs open and close'],
  [/^about=6\/addresses\/notes-hidden$/, "the About section links the app's own pages"],
  [
    /^updateUi=general-title,agent-link-title,about-title\/ok$/,
    'an update shows in the top bar and on the Settings tab, opens its dialog, and Later puts it away',
  ],
  [/^stage=yard-first$/, 'the yard leads the window (60% of the height or more)'],
  [/^weather=snow-canvas$/, 'weather canvas (snow)'],
  [/^greetBubbles=2$/, 'say hi together bubbles'],
  [
    new RegExp(
      `^hide=(2/0/${literal(KO['game.label'])}/by-name|window-hidden/${literal(stopGame('game.hide'))}/${literal(KO['game.label'])})$`,
    ),
    'hide and seek (find by name, try again when wrong)',
  ],
  [
    new RegExp(`^games=1/${literal(stopGame('game.parade'))}/${literal(KO['game.label'])}$`),
    'tag and parade start and stop',
  ],
  [/^mini=shrinks-and-restores$/, 'mini view (yard only, back to full size)'],
  [/^pageFits=true\/true$/, 'the page fits the window (no scroll bars, full and mini)'],
  [/^spriteLoads=1536$/, 'pet sprites load under the page security policy'],
  [/^gamesKeepHome=true$/, 'positions during games are not saved'],
  [/^pageButtons=invite-and-connect$/, 'invite and open the AI connection dialog with page buttons'],
  [/^sendAway=asks-then-removes$/, 'send a friend away from the friend tab (Cancel keeps, confirm removes)'],
  [/^desktopOn=ok/, 'turn on desktop mode'],
  [/^overlayLayout=[1-9]/, 'overlay layout created'],
  [/^wanderOn=ok/, 'roaming toggle'],
  [/^removeProvider=ok/, 'delete a provider'],
  [/^detached=true/, 'deleting a provider detaches it from pets'],
  [/^overlayClosed=alive$/, 'the app stays alive when desktop mode turns off'],
  [/^DONE$/, 'scenario finished'],
];
let failed = 0;
if (lines.some(l => l.startsWith('hide=window-hidden')))
  console.log(
    '  ! The app window was covered, so hide and seek only checked start and stop (walking to hide was skipped).',
  );
for (const [re, label] of expect) {
  const hit = lines.some(l => re.test(l));
  console.log(hit ? '  ✓' : '  ✖', label);
  if (!hit) failed++;
}
for (const [key, label] of [
  ['cli', 'CLI mode say/react (no Node)'],
  ['hookSilent', 'Claude hook: exit code 0, no output'],
  ['pets', 'CLI pets: friends in the yard (JSON)'],
  ['badPet', 'CLI status: an unknown pet gives exit code 1 and a message'],
  ['run', 'CLI run: passes the command exit code through'],
  ['geminiJson', 'Gemini hook: prints {} for events it does not report'],
  ['mcp', 'MCP stdio server (no Node)'],
]) {
  console.log(agentChecks[key] ? '  ✓' : '  ✖', label);
  if (!agentChecks[key]) failed++;
}
const system = chatRequests[0]?.messages?.[0]?.content || '';
for (const [ok, label] of [
  [system.includes('반말로 짧게 대답해요.'), 'personality reaches the system prompt'],
  [
    system.includes('loving partner') && system.includes('Call your owner "자기".'),
    'relationship and form of address reach the system prompt',
  ],
  [
    chatRequests.some(r => r.messages?.[0]?.content.includes("these pets: 타우리 (your owner's partner)")),
    "friends know each other's relationships",
  ],
  [
    chatRequests.some(
      r =>
        r.messages?.[0]?.content.includes('named 둘째') &&
        r.messages[0].content.includes('Character description from the pet file') &&
        r.messages[0].content.includes('A test kitten. (animal)'),
    ),
    'an empty personality falls back to the pet file description',
  ],
  [
    system.includes('said · 안녕 에이전트') && system.includes('working · Bash 사용 중'),
    'agent activity reaches the system prompt',
  ],
  [
    chatRequests.some(r => r.messages?.[0]?.content.includes('chatting together with your friends')),
    'group chat note reaches the system prompt',
  ],
  [
    chatRequests.some(
      r => r.messages?.[0]?.content.includes('named 둘째') && r.messages[0].content.includes('these pets: 타우리'),
    ) && system.includes('only pet in the yard'),
    'the list of friends in the yard reaches the system prompt',
  ],
]) {
  console.log(ok ? '  ✓' : '  ✖', label);
  if (!ok) failed++;
}
// What was set through the app must be in state.json of the isolated data folder.
try {
  const saved = JSON.parse(await readFile(path.join(dataDir, 'state.json'), 'utf8'));
  const okPersist =
    saved.pets.length === 1 && saved.pets[0].name === '타우리' && saved.pets[0].persona === '반말로 짧게 대답해요.';
  console.log(okPersist ? '  ✓' : '  ✖', 'state persists (state.json)');
  if (!okPersist) failed++;
} catch {
  console.log('  ✖', 'state persists (state.json)');
  failed++;
}
await rm(dataDir, { recursive: true, force: true });
console.log(failed === 0 ? '\nPASS: tauri e2e' : `\nFAIL: ${failed} checks`);
process.exit(failed === 0 ? 0 : 1);
