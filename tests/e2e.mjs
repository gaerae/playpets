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

const scenario = `(async()=>{
  const L=m=>window.__TAURI__.core.invoke('call',{name:'e2eLog',args:[m]});
  const must=async(label,p)=>{const r=await p;await L(label+'='+(r&&r.ok!==undefined?(r.ok?'ok':'err:'+r.error):JSON.stringify(r).slice(0,60)));return r;};
  // Polls until f() is truthy (or ms pass) and returns that value, so no check sleeps for a fixed time.
  const until=async(f,ms=5000)=>{const end=Date.now()+ms;let v=await f();while(!v&&Date.now()<end){await new Promise(r=>setTimeout(r,50));v=await f();}return v;};
  let pageError='';window.addEventListener('error',e=>{if(!pageError)pageError=e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno;});
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
    const playing=()=>document.querySelector('[data-game].playing'),gameLabel=()=>playing()?.textContent||'놀이';
    const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms)),press=el=>el.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true}));
    // Every tab must actually show its own content, and only its own.
    // macOS keeps its own window buttons over the page; elsewhere the page draws them and the system bar is gone.
    const drawn=getComputedStyle(document.querySelector('.win-controls')).display!=='none';
    await L('chrome='+(document.documentElement.classList.contains('mac')?(drawn?'err':'mac-native'):(drawn?'custom:'+(outerHeight-innerHeight):'err')));
    if(!$('side-panel').hidden)$('close-panel').click();
    const shown=[];for(const k of ['pet','invite','settings']){document.querySelector('.panel-tab[data-panel='+k+']').click();await wait(150);shown.push(['pet','invite','settings'].filter(o=>$('panel-'+o).getBoundingClientRect().height>40).join(','));}
    const opened=!$('side-panel').hidden;$('close-panel').click();await wait(300);
    await L('panel='+(opened&&$('side-panel').hidden&&shown.join('|')==='pet|invite|settings'?'toggles':'err:'+shown.join('|')));
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
      const asked=()=>$('banner-label').textContent==='찾을 친구'?$('banner-title').textContent:null,byName=n=>[...document.querySelectorAll('.yard-pet.hiding')].find(b=>b.querySelector('.pet-tag').textContent===n);
      const first=asked(),other=[...document.querySelectorAll('.yard-pet.hiding')].find(b=>b!==byName(first));
      press(other);await wait(200);
      const miss=document.querySelectorAll('.yard-pet.hiding').length===2&&!$('game-banner').hidden&&$('banner-sub').textContent.includes('아니에요')&&asked()===first;
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
    // Sending a friend away from the friend tab asks first, by name: 취소 keeps everyone, 내보내기 does not.
    const guest=after.at(-1);
    $('remove-friend').click();await wait(300);
    const confirmAsked=$('confirm-dialog').open&&$('confirm-title').textContent.includes('놀이터에서 내보낼까요')&&document.activeElement===$('confirm-cancel');
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
  [/^assets=[1-9]/, '카탈로그 스캔'],
  [/^addPet=ok/, '펫 추가'],
  [/^intro=A test kitten\. \(animal\)$/, '새 친구의 성격이 펫 파일 소개로 시작'],
  [/^rename=ok/, '이름·크기 변경'],
  [/^saveProvider=ok/, '프로바이더 저장'],
  [/^attach=ok/, '펫에 연결'],
  [/^assigned=named$/, '에이전트의 담당 친구 지정'],
  [/^communities=[1-9]/, '커뮤니티 목록 제공'],
  [/^place=codex\/folder-known$/, '펫이 있는 곳(Codex 펫 폴더) 표시'],
  [/^agentStatus=working$/, '에이전트 상태 수신(브리지)'],
  [/^snippet=binary$/, '연동 설정이 앱 바이너리를 가리킴(Node 불필요)'],
  [/^unseen=true\/false$/, '창을 숨기면 화면이 쉬고, 다시 열면 움직임'],
  [/^models=2/, '모델 목록 실시간 조회'],
  [/^chat=\*\*타우리\*\* 응답!/, 'HTTP 대화 왕복'],
  [/^personaByChat=좋아, 그렇게 할게!\|느긋하고 다정한 고양이$/, '대화로 성격 저장(표식은 답변에서 제거)'],
  [/^history=2/, '대화 기록 저장'],
  [/^group=타우리\+둘째$/, '친구들과 함께 대화(차례로 답변)'],
  [/^groupHistory=peer-tagged$/, '친구의 말이 이름표와 함께 기록됨'],
  [/^chatter=[2-9]$/, '놀이터의 수다 떨기(친구들끼리 말풍선)'],
  [/^pageErrors=none$/, '페이지 오류 없음(프레임 루프 포함)'],
  [/^markdown=styled$/, '답변의 마크다운 강조를 스타일로 표시'],
  [/^waiting=shown-then-gone$/, '답변을 기다리는 동안 대기 표시'],
  [/^chrome=(mac-native|custom:0)$/, '타이틀바가 화면과 한 몸(운영체제별)'],
  [/^panel=toggles$/, '패널 탭 열고 닫기'],
  [/^stage=yard-first$/, '놀이터가 창의 중심(높이 60% 이상)'],
  [/^weather=snow-canvas$/, '날씨 캔버스(눈)'],
  [/^greetBubbles=2$/, '다 같이 인사 말풍선'],
  [/^hide=(2\/0\/놀이\/by-name|window-hidden\/숨바꼭질 끝내기\/놀이)$/, '숨바꼭질(이름으로 찾기, 틀리면 다시)'],
  [/^games=1\/산책 행렬 끝내기\/놀이$/, '꼬리잡기·산책 행렬 시작과 종료'],
  [/^mini=shrinks-and-restores$/, '작게 보기(놀이터만, 원래 크기로 복귀)'],
  [/^pageFits=true\/true$/, '페이지가 창에 딱 맞음(스크롤바 없음, 보통·작게 보기)'],
  [/^spriteLoads=1536$/, '펫 스프라이트가 페이지 보안 정책을 통과해 로드됨'],
  [/^gamesKeepHome=true$/, '놀이 중 위치는 저장하지 않음'],
  [/^pageButtons=invite-and-connect$/, '화면 버튼으로 초대하고 AI 연결 창 열기'],
  [/^sendAway=asks-then-removes$/, '친구 탭에서 내보내기(확인 창: 취소는 유지, 내보내기는 삭제)'],
  [/^desktopOn=ok/, '바탕화면 모드 켜기'],
  [/^overlayLayout=[1-9]/, '오버레이 레이아웃 생성'],
  [/^wanderOn=ok/, '배회 토글'],
  [/^removeProvider=ok/, '연결 삭제'],
  [/^detached=true/, '삭제 파급(펫 연결 해제)'],
  [/^overlayClosed=alive$/, '바탕화면 모드를 꺼도 앱이 살아 있음'],
  [/^DONE$/, '시나리오 완료'],
];
let failed = 0;
if (lines.some(l => l.startsWith('hide=window-hidden')))
  console.log('  ! 앱 창이 가려져 있어 숨바꼭질은 시작·종료만 확인했어요(걸어가서 숨는 장면은 건너뜀).');
for (const [re, label] of expect) {
  const hit = lines.some(l => re.test(l));
  console.log(hit ? '  ✓' : '  ✖', label);
  if (!hit) failed++;
}
for (const [key, label] of [
  ['cli', 'CLI 모드 say/react (Node 없이)'],
  ['hookSilent', 'Claude 훅: 종료코드 0 · 출력 없음'],
  ['pets', 'CLI pets: 놀이터의 친구 목록(JSON)'],
  ['badPet', 'CLI status: 없는 펫은 종료코드 1과 안내'],
  ['run', 'CLI run: 명령의 종료코드를 그대로 돌려줌'],
  ['geminiJson', 'Gemini 훅: 보고하지 않는 이벤트에도 {} 출력'],
  ['mcp', 'MCP stdio 서버 (Node 없이)'],
]) {
  console.log(agentChecks[key] ? '  ✓' : '  ✖', label);
  if (!agentChecks[key]) failed++;
}
const system = chatRequests[0]?.messages?.[0]?.content || '';
for (const [ok, label] of [
  [system.includes('반말로 짧게 대답해요.'), '성격이 시스템 프롬프트에 전달'],
  [
    system.includes('loving partner') && system.includes('Call your owner "자기".'),
    '관계와 호칭이 시스템 프롬프트에 전달',
  ],
  [
    chatRequests.some(r => r.messages?.[0]?.content.includes("these pets: 타우리 (your owner's partner)")),
    '친구들이 서로의 관계를 앎',
  ],
  [
    chatRequests.some(
      r =>
        r.messages?.[0]?.content.includes('named 둘째') &&
        r.messages[0].content.includes('Character description from the pet file') &&
        r.messages[0].content.includes('A test kitten. (animal)'),
    ),
    '성격이 비어 있으면 펫 파일 소개를 성격으로 사용',
  ],
  [
    system.includes('said · 안녕 에이전트') && system.includes('working · Bash 사용 중'),
    '에이전트 활동이 시스템 프롬프트에 전달',
  ],
  [
    chatRequests.some(r => r.messages?.[0]?.content.includes('chatting together with your friends')),
    '함께 대화 안내가 시스템 프롬프트에 전달',
  ],
  [
    chatRequests.some(
      r => r.messages?.[0]?.content.includes('named 둘째') && r.messages[0].content.includes('these pets: 타우리'),
    ) && system.includes('only pet in the yard'),
    '놀이터의 친구 목록이 시스템 프롬프트에 전달',
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
  console.log(okPersist ? '  ✓' : '  ✖', '상태 영속(state.json)');
  if (!okPersist) failed++;
} catch {
  console.log('  ✖', '상태 영속(state.json)');
  failed++;
}
await rm(dataDir, { recursive: true, force: true });
console.log(failed === 0 ? '\nPASS: tauri e2e' : `\nFAIL: ${failed} checks`);
process.exit(failed === 0 ? 0 : 1);
