// PlayPets Tauri E2E: launches the release binary with an isolated data dir,
// drives the real UI bridge via PLAYPETS_E2E_EVAL, reads results from the
// [e2e] stdout channel. A fake ollama server covers the HTTP chat path.
// Run: npm run test:e2e   (repo root)

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { strings as KO } from '../src/core/strings/ko.js';
import { writeFixturePet, writeFixtureZip } from './support/fixture-pet.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const binary =
  process.env.PLAYPETS_BINARY ||
  path.join(here, '../src-tauri/target/e2e', process.platform === 'win32' ? 'playpets.exe' : 'playpets');
const dataDir = await mkdtemp(path.join(os.tmpdir(), 'playpets-tauri-e2e-'));
// A self-contained Codex pet so the run never depends on the machine's ~/.codex/pets.
const codexHome = path.join(dataDir, 'codex');
await writeFixturePet(codexHome);
// A pet ZIP as Finder makes one, for the import a file dialog would start.
const petZip = path.join(dataDir, 'e2e-zip.zip');
await writeFixtureZip(petZip);
// A home folder of its own for Connect: Claude Code settings with someone else's hook in them, and
// Gemini CLI settings with a comment, which PlayPets cannot read and so never writes.
const agentHome = path.join(dataDir, 'home');
const claudeSettings = path.join(agentHome, '.claude', 'settings.json');
const claudeOriginal = { model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }] } };
const geminiSettings = path.join(agentHome, '.gemini', 'settings.json');
const geminiOriginal = '{\n  // dark, always\n  "theme": "dark"\n}\n';
await mkdir(path.dirname(claudeSettings), { recursive: true });
await mkdir(path.dirname(geminiSettings), { recursive: true });
await writeFile(claudeSettings, JSON.stringify(claudeOriginal, null, 2));
await writeFile(geminiSettings, geminiOriginal);
// Saved pockets and an uncommon find survive an upgrade without depending on a lucky random draw.
const rareLedgerAt = Date.now() - 60_000;
await writeFile(
  path.join(dataDir, 'state.json'),
  JSON.stringify({
    garden: {
      seeds: 1,
      saplings: { maple: 1 },
      digs: [
        {
          attemptId: 'saved-rare-fixture',
          outcome: 'keepsake',
          kind: 'quartz',
          petId: 'previous-friend',
          world: 'courtyard',
          tileX: 0,
          tileY: 0,
          at: rareLedgerAt,
        },
      ],
    },
    album: { treasures: { quartz: { count: 1, best: 0, first: rareLedgerAt } } },
  }),
);

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
// The tray speaks from the backend's own Korean table.
const TRAY_KO_WAITING = (await readFile(path.join(here, '../src-tauri/src/i18n/ko.rs'), 'utf8')).match(
  /"tray\.state_waiting", "([^"]+)"/,
)[1];
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
    // The run stays quiet: the yard sounds are on by default (a unit test checks that), so they go off first.
    const soundDefault=boot.data.sound;await playPets.setSound(false,null);
    await L('assets='+boot.data.assets.length);
    await L('communities='+boot.data.communities.length);
    // The shelf says where each pet file lives: the fixture sits in Codex's pet folder.
    const fx=boot.data.assets.find(x=>x.displayName==='Fixture');
    await L('builtin='+boot.data.assets.filter(x=>x.place==='builtin').length);
    const adults=boot.data.assets.filter(x=>['playpets-daisy','playpets-clover','playpets-pip','playpets-miso'].includes(x.sourceId));
    await L('defaultCompanions='+adults.length+'/'+(adults.every(x=>x.place==='builtin')?'official-cast':'err'));
    await L('place='+fx.place+'/'+(boot.data.petFolders.codex.endsWith('pets')?'folder-known':'err'));
    // An empty yard asks who to play with: the starter pets, moving, with no toolbar.
    // The ephemeral test webview starts with its panel closed.
    await until(()=>document.querySelectorAll('#starter-picks .starter').length===4);
    const $$=id=>document.getElementById(id),painted=c=>{const d=c.getContext('2d').getImageData(0,0,192,208).data;for(let i=3;i<d.length;i+=40)if(d[i])return true;return false;};
    await until(()=>[...document.querySelectorAll('#starter-picks canvas')].every(painted));
    const wardrobes=boot.data.assets.filter(x=>Object.keys(x.seasonalSpriteUrls||{}).length===2);
    const wardrobeImages=await Promise.all(wardrobes.flatMap(x=>Object.values(x.seasonalSpriteUrls)).map(async url=>{const image=new Image();image.src=url;await image.decode();return image.naturalWidth===1536&&image.naturalHeight===2288;}));
    const sprites=await import('./core/sprites.js'),wardrobe=wardrobes.find(x=>x.sourceId==='playpets-daisy'),wardrobeCanvas=sprites.canvas();
    const wardrobePaints=[];
    const fingerprint=c=>c.getContext('2d').getImageData(0,0,192,208).data.reduce((sum,value,i)=>(sum+value*((i%29)+1))%2147483647,0);
    for(const season of ['spring','summer','winter']){
      const expectedImage=new Image();expectedImage.crossOrigin='anonymous';expectedImage.src=wardrobe.seasonalSpriteUrls[season]||wardrobe.spriteUrl;await expectedImage.decode();
      const expectedCanvas=sprites.canvas();expectedCanvas.getContext('2d').drawImage(expectedImage,0,0,192,208,0,0,192,208);
      const expected=fingerprint(expectedCanvas);
      sprites.setSpriteSeason(season);
      // The old outfit deliberately stays visible while the new sheet decodes.
      await until(()=>{sprites.drawSprite(wardrobeCanvas,wardrobe);return fingerprint(wardrobeCanvas)===expected;});
      wardrobePaints.push(fingerprint(wardrobeCanvas));
    }
    const world=await import('./yard/world.js');sprites.setSpriteSeason(world.scene.season);
    await L('wardrobes='+wardrobes.length+'/'+wardrobeImages.length+'/'+(wardrobeImages.every(Boolean)&&new Set(wardrobePaints).size===3?'decoded-and-change':'err'));
    const illustratedImages=await Promise.all(adults.flatMap(x=>[x.spriteUrl,...Object.values(x.seasonalSpriteUrls||{})]).map(async url=>{const image=new Image();image.src=url;await image.decode();return image.naturalWidth===1536&&image.naturalHeight===2288;}));
    await L('illustratedAssets='+illustratedImages.length+'/'+(illustratedImages.every(Boolean)&&adults.every(x=>!x.portraitUrl)&&!boot.data.assets.some(x=>['playpets-aria-full','playpets-noah-full'].includes(x.sourceId))?'decoded':'err'));

    const trayAt=async()=>(await window.__TAURI__.core.invoke('call',{name:'e2eTray',args:[]})).data||{items:[],tooltip:''};
    const tray0=await until(async()=>(await trayAt()).items.length&&await trayAt());
    await L('trayEmpty='+(!tray0.items.some(i=>/^(mini|desktop|wander)/.test(i))&&tray0.items.includes('alwaysOnTop:off')&&tray0.items.includes('invite')&&tray0.items.some(i=>i.startsWith('sound:'))&&!tray0.items.includes('friends')&&tray0.items[0]==='open'&&tray0.items.at(-1)==='quit'?'no-switches':'err:'+tray0.items.join(',')));
    const starterButtons=[...document.querySelectorAll('#starter-picks .starter')];
    const starterBounds=starterButtons.map(button=>button.getBoundingClientRect());
    const visibleStarters=starterButtons.length===adults.length&&starterBounds.every(rect=>rect.left>=0&&rect.top>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight);
    await L('welcome='+(!$$('empty-yard').hidden&&!$$('welcome').hidden&&$$('next-steps').hidden&&visibleStarters&&[...document.querySelectorAll('#starter-picks canvas')].every(painted)?'starters':'err')+'/'+(!document.querySelector('.play-toolbar')&&$$('play-panel').hidden?'no-toolbar':'toolbar'));
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
    const group=await playPets.chatWith([p1.data.id,p2.data.id],'둘 다 안녕');
    await L('group='+(group.ok?group.data.map(r=>r.name).join('+'):'err:'+group.error));
    const h1=await playPets.getChat(p1.data.id);
    await L('groupHistory='+(h1.ok&&h1.data.some(m=>m.name==='둘째'&&m.content.startsWith('[둘째] '))?'peer-tagged':'err'));
    // The yard's chatter button: friends with an AI talk among themselves, shown as bubbles.
    const chatterButton=document.getElementById('chatter'),chatterOn=chatterButton.getAttribute('aria-disabled')!=='true';chatterButton.click();
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
    // The yard itself: scenery-first layout, games.
    const playing=()=>document.querySelector('[data-game].playing'),gameLabel=()=>playing()?.textContent||${say('game.label')};
    const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms)),press=el=>el.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true}));
    const panelTasks=await import('./panel/tabs.js');
    // The menu is one page; Settings opens on its list of sections, and a section is one more click.
    const openMenu=()=>{if($('yard-controls-panel').hidden)$('yard-controls-toggle').click();};
    const openSettings=section=>{openMenu();$('menu-settings').click();if(section)document.querySelector('.settings-index [data-section="'+section+'-title"]').click();};
    // Every tab must actually show its own content, and only its own.
    // Every platform uses a frameless yard; a narrow transparent target still moves the full window.
    const noChrome=!document.querySelector('.win-controls,.topbar')&&!!$('window-drag')&&!!$('hide-window');
    await L('chrome='+(noChrome?'frameless':'err'));
    const selectable=el=>{const css=getComputedStyle(el);return css.userSelect||css.webkitUserSelect;};
    const message=shownLog.querySelector('.message');
    await L('selection='+(selectable($('yard'))==='none'&&message&&selectable(message)!=='none'?'scenery-only':'err'));
    if(!$('side-panel').hidden)$('close-panel').click();
    // Startup explanations float above the scene and stay dismissed across ordinary renders.
    const startupNotices=await import('./core/notices.js');
    const startupMessages=(await playPets.bootstrap()).data.warnings||[];
    const startupFrame=document.querySelector('.yard-frame'),startupHeight=startupFrame.getBoundingClientRect().height;
    startupNotices.renderNotices([${say('notices.label')}]);
    const startupCollapsed=!$('warnings').hidden&&!$('warning-details').open;
    document.querySelector('#warning-details summary').click();
    const startupExpanded=$('warning-details').open&&startupFrame.getBoundingClientRect().height===startupHeight;
    $('dismiss-warnings').click();startupNotices.renderNotices([${say('notices.label')}]);
    const startupDismissed=$('warnings').hidden;
    startupNotices.renderNotices(startupMessages);
    await L('startupNotices='+(startupCollapsed&&startupExpanded&&startupDismissed?'floating-details-and-dismissal':'err'));
    const quietStart=$('yard-controls-panel').hidden&&!document.querySelector('#clock-time');
    $('yard-controls-toggle').click();
    const controlsOpen=!$('yard-controls-panel').hidden&&$('yard-controls-toggle').getAttribute('aria-expanded')==='true';
    $('scene-button').click();openSettings('general');
    const controlsClosed=$('yard-controls-panel').hidden&&!$('panel-settings').hidden;
    $('close-panel').click();
    await L('quietControls='+(quietStart&&controlsOpen&&controlsClosed&&document.activeElement===$('yard-controls-toggle')?'disclosed-and-restored':'err'));
    // Blank-yard context controls offer short actions, fit the viewport and leave the full menu untouched.
    const contextAt=()=>{$('yard').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:innerWidth-2,clientY:innerHeight-2}));};
    const contextFits=()=>{const r=$('yard-context-menu').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;};
    contextAt();await wait(30);
    const menuRect=$('yard-context-menu').getBoundingClientRect(),dockRect=document.querySelector('.yard-dock').getBoundingClientRect();
    const overlapX=(Math.max(menuRect.left,dockRect.left)+Math.min(menuRect.right,dockRect.right))/2,overlapY=(Math.max(menuRect.top,dockRect.top)+Math.min(menuRect.bottom,dockRect.bottom))/2;
    const contextOnTop=menuRect.right<=dockRect.left||menuRect.bottom<=dockRect.top||$('yard-context-menu').contains(document.elementFromPoint(overlapX,overlapY));
    const fullContext=!$('yard-context-menu').hidden&&$('yard-controls-panel').hidden&&contextFits()&&contextOnTop;
    $('yard-context-menu').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    const contextEsc=$('yard-context-menu').hidden&&document.activeElement===$('yard-controls-toggle');
    $('yard-controls-toggle').click();
    const normalAnchor=!$('yard-controls-panel').style.left&&$('yard-context-menu').hidden;
    document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    await L('contextFull='+(fullContext&&contextEsc&&normalAnchor&&$('yard-controls-panel').hidden?'clamped-escaped-and-reset':'err'));
    openMenu();$('menu-invite').click();
    const welcomeCovered=getComputedStyle($('empty-yard')).display==='none';
    $('yard-controls-toggle').click();
    await L('controlsOverlap='+($('side-panel').hidden&&!$('yard-controls-panel').hidden&&welcomeCovered?'exclusive':'err'));
    $('yard-controls-toggle').click();
    const shown=[];for(const k of ['pet','invite','settings']){document.querySelector('.panel-tab[data-panel='+k+']').click();await until(()=>!$('panel-'+k).hidden);shown.push(['pet','invite','settings'].filter(o=>$('panel-'+o).getBoundingClientRect().height>40).join(','));}
    // Settings wiring runs after Invite; its copy buttons must not replace Invite filters.
    openMenu();$('menu-invite').click();await until(()=>!$('panel-invite').hidden);
    const allChip=document.querySelector('#kind-filter [data-kind=""]'),peopleChip=document.querySelector('#kind-filter [data-kind=person]');
    allChip.click();await until(()=>allChip.getAttribute('aria-pressed')==='true');const allCount=document.querySelectorAll('#shelf .asset-card').length;
    peopleChip.click();await until(()=>peopleChip.getAttribute('aria-pressed')==='true');const peopleIds=[...document.querySelectorAll('#shelf .asset-card')].map(el=>el.dataset.assetId);
    const wantedPeople=boot.data.assets.filter(a=>['person','human','humanoid'].includes(String(a.kind||'').trim().toLowerCase())).map(a=>a.id);
    const filtered=peopleChip.getAttribute('aria-pressed')==='true'&&peopleIds.length===wantedPeople.length&&peopleIds.every(id=>wantedPeople.includes(id))&&allCount>peopleIds.length;
    allChip.click();await until(()=>allChip.getAttribute('aria-pressed')==='true');
    await L('inviteFilters='+(filtered&&allChip.getAttribute('aria-pressed')==='true'&&document.querySelectorAll('#shelf .asset-card').length===allCount?'all-person-restore':'err:'+allCount+'/'+peopleIds.join(',')));
    // Each named baseline has its own catalog asset and independent invitations.
    const realisticInviteAsset=adults[0],miniInviteAsset=boot.data.assets.find(a=>a.sourceId==='playpets-clover'),ordinaryInviteAsset=boot.data.assets.find(a=>a.kind==='animal');
    const inviteBefore=(await playPets.bootstrap()).data.pets,inviteBeforeIds=new Set(inviteBefore.map(p=>p.id));
    const appearanceCard=(mini=false)=>[...document.querySelectorAll('#shelf .asset-card')].find(c=>c.dataset.assetId===(mini?miniInviteAsset:realisticInviteAsset)?.id);
    const separateEntries=!!appearanceCard()&&!!appearanceCard(true)&&appearanceCard().dataset.assetId!==appearanceCard(true).dataset.assetId&&!document.querySelector('#shelf .asset-style');
    appearanceCard()?.click();
    const invitedReal=await until(async()=>(await playPets.bootstrap()).data.pets.find(p=>p.assetId===realisticInviteAsset?.id&&!inviteBeforeIds.has(p.id)));
    await until(()=>appearanceCard()&&!appearanceCard().disabled);
    appearanceCard()?.click();
    const invitedTwin=await until(async()=>(await playPets.bootstrap()).data.pets.find(p=>p.assetId===realisticInviteAsset?.id&&!inviteBeforeIds.has(p.id)&&p.id!==invitedReal?.id));
    const initialTwins=inviteBefore.filter(p=>p.assetId===realisticInviteAsset?.id).length;
    appearanceCard(true)?.click();
    const invitedMini=await until(async()=>(await playPets.bootstrap()).data.pets.find(p=>p.assetId===miniInviteAsset?.id&&!inviteBeforeIds.has(p.id)));
    const initialMinis=inviteBefore.filter(p=>p.assetId===miniInviteAsset?.id).length;
    const miniName=initialMinis?miniInviteAsset.displayName+' '+(initialMinis+1):'';
    await L('inviteAppearance='+(separateEntries&&invitedReal?.visualStyle==='illustrated'&&invitedTwin?.name===realisticInviteAsset?.displayName+' '+(initialTwins+2)&&invitedMini?.name===miniName&&invitedMini.assetId!==invitedReal.assetId?'separate-saved-duplicate':'err'));
    const rejectionCount=(await playPets.bootstrap()).data.pets.length;
    const invalidInvite=await playPets.addPet(realisticInviteAsset?.id,{visualStyle:'unknown'}),forbiddenInvite=await playPets.addPet(realisticInviteAsset?.id,{providerId:'unchecked'}),unsupportedInvite=await playPets.addPet(ordinaryInviteAsset?.id,{visualStyle:'realistic'});
    await L('inviteAtomic='+(invalidInvite.ok===false&&forbiddenInvite.ok===false&&unsupportedInvite.ok===false&&(await playPets.bootstrap()).data.pets.length===rejectionCount?'rejected-no-orphans':'err'));
    const legacyInvite=await playPets.addPet(ordinaryInviteAsset?.id);
    await L('inviteLegacy='+(legacyInvite.ok&&legacyInvite.data.visualStyle==='illustrated'?'default-illustrated':'err'));
    for(const added of [invitedReal,invitedTwin,invitedMini,legacyInvite.data])if(added?.id)await playPets.removePet(added.id);
    await until(async()=>(await playPets.bootstrap()).data.pets.length===inviteBefore.length&&document.querySelectorAll('.yard-pet').length===inviteBefore.length);
    await playPets.openChat(p1.data.id);openMenu();$('menu-invite').click();await until(()=>!$('panel-invite').hidden);
    $('import').click();await until(()=>$('import-dialog').open);const discovery=$('community-discovery'),discoveryClosed=!discovery.open;
    discovery.querySelector('summary').click();await until(()=>discovery.open);
    await L('inviteDiscovery='+(discoveryClosed&&discovery.open&&document.querySelectorAll('#community-links [data-community-id]').length===boot.data.communities.length?'collapsed-expandable':'err'));
    // The ZIP import past its file dialog: copied into the data folder once, then taken off the
    // shelf only when no friend uses it, its folder deleted (the harness checks the disk).
    const zipFirst=await window.__TAURI__.core.invoke('call',{name:'e2eImportZip',args:[${JSON.stringify(petZip)}]}),zipAgain=await window.__TAURI__.core.invoke('call',{name:'e2eImportZip',args:[${JSON.stringify(petZip)}]});
    const zipAsset=(await playPets.bootstrap()).data.assets.find(a=>a.id===zipFirst.data),zipFriend=await playPets.addPet(zipFirst.data),zipInUse=await playPets.removeAsset(zipFirst.data);
    if(zipFriend.data?.id)await playPets.removePet(zipFriend.data.id);
    const zipStarter=await playPets.removeAsset(boot.data.assets.find(a=>a.place==='builtin')?.id),zipGone=await playPets.removeAsset(zipFirst.data),zipLeft=(await playPets.bootstrap()).data.assets.some(a=>a.id===zipFirst.data);
    await until(async()=>(await playPets.bootstrap()).data.pets.length===inviteBefore.length);
    await L('zipImport='+(zipFirst.ok&&zipAgain.data===zipFirst.data&&zipAsset?.place==='downloaded'&&zipAsset?.displayName==='Zipped'?'copied-once':'err:'+JSON.stringify({zipFirst,zipAgain,place:zipAsset?.place})));
    await L('zipRemove='+(zipFriend.ok&&zipInUse.ok===false&&zipStarter.ok===false&&zipGone.ok&&!zipLeft?'guarded-removed':'err:'+JSON.stringify({zipInUse,zipStarter,zipGone,zipLeft})));
    await L('zipFolder='+zipAsset?.folderPath);
    $('cancel-import').click();panelTasks.openPanel('settings');await until(()=>!$('panel-settings').hidden);
    const opened=!$('side-panel').hidden,indexed=!$('settings-home').hidden?'tasks':'err';
    const settingsWindow=(await window.__TAURI__.core.invoke('call',{name:'e2eWindow',args:['main']})).data;
    await window.__TAURI__.core.invoke('call',{name:'e2eWindow',args:['main',{...settingsWindow,width:840,height:420}]});await until(()=>Math.abs(innerWidth-840)<2);await wait(100);
    const settingsNav=document.querySelector('.settings-index'),settingsHead=$('panel-title'),settingsBody=$('settings-content');
    document.querySelector('.settings-index [data-section=agent-link-title]').click();await wait(150);
    const navTop=settingsNav.getBoundingClientRect().top,headTop=settingsHead.getBoundingClientRect().top;
    settingsBody.scrollTop=settingsBody.scrollHeight;await wait(150);
    const settingsMetrics={scrollTop:settingsBody.scrollTop,scrollHeight:settingsBody.scrollHeight,clientHeight:settingsBody.clientHeight,visible:[...document.querySelectorAll('.settings-section[data-settings-section]')].filter(el=>!el.hidden).length,navShift:settingsNav.getBoundingClientRect().top-navTop,headShift:settingsHead.getBoundingClientRect().top-headTop,outerScroll:$('side-panel').scrollTop};
    const bodyOnly=$('settings-home').hidden&&settingsBody.scrollTop>0&&[...document.querySelectorAll('.settings-section[data-settings-section]')].filter(el=>!el.hidden).length===1&&Math.abs(settingsNav.getBoundingClientRect().top-navTop)<1&&Math.abs(settingsHead.getBoundingClientRect().top-headTop)<1&&$('side-panel').scrollTop===0;
    $('panel-menu').click();document.querySelector('.settings-index [data-section=general-title]').click();await wait(150);
    await L('settingsScroll='+(bodyOnly&&settingsBody.scrollTop===0&&!$('settings-general').hidden?'fixed-navigation-single-body':'err:'+JSON.stringify({...settingsMetrics,resetTop:settingsBody.scrollTop,generalHidden:$('settings-general').hidden})));
    $('close-panel').click();
    await window.__TAURI__.core.invoke('call',{name:'e2eWindow',args:['main',settingsWindow]});await until(()=>Math.abs(innerWidth-settingsWindow.width)<2);await wait(100);
    await L('panel='+(opened&&$('side-panel').hidden&&shown.join('|')==='pet|invite|settings'?'toggles':'err:'+shown.join('|'))+'/'+indexed);
    // Let them dig (Settings → Friends & AI) is kept by the backend and comes back with the state.
    panelTasks.openPanel('settings','ai-title');await until(()=>!$('settings-ai').hidden);
    const autoBefore=!!(await playPets.bootstrap()).data.autoPlay;$('auto-play').click();
    // The switch stays disabled until its save returns; a press before then is ignored, as for a person.
    const autoOn=await until(async()=>!!(await playPets.bootstrap()).data.autoPlay!==autoBefore&&!$('auto-play').disabled);
    $('auto-play').click();const autoBack=await until(async()=>!!(await playPets.bootstrap()).data.autoPlay===autoBefore);
    $('close-panel').click();
    await L('autoPlay='+(autoOn&&autoBack&&$('auto-play').checked===autoBefore?'saved-both-ways':'err:'+JSON.stringify({autoBefore,autoOn:!!autoOn,autoBack:!!autoBack})));
    // The relationship shows beside the friend's closeness, and a click on it opens the settings at the relationship cards.
    openMenu();$('menu-friends').click();await until(()=>!$('panel-pet').hidden);
    const relChip=$('relation-chip').textContent;$('relation-chip').click();await until(()=>$('pet-dialog').open);
    const relFocus=$('pet-dialog').open&&document.activeElement?.name==='relation'&&document.activeElement.value==='partner'&&$('pet-call-me').placeholder===${say('pet.call_me_partner')};
    $('cancel-pet-dialog').click();$('close-panel').click();await until(()=>!$('pet-dialog').open&&$('side-panel').hidden);
    await L('relation='+(relChip===${say('relation.partner')}&&relFocus?'chip-opens-cards':'err:'+relChip+'/'+relFocus));
    // About: the app's own pages, from the addresses the backend reports; "What's new" waits for an update.
    const project=(await playPets.bootstrap()).data.project||{};
    await L('about='+document.querySelectorAll('#panel-settings button[data-link]').length+'/'+(String(project.site).startsWith('https://')&&String(project.repository).startsWith('https://github.com/')?'addresses':'none')+'/'+($('update-notes').hidden?'notes-hidden':'notes-shown'));
    // A new version stays in the yard dock before Place, with the Settings dot as a secondary cue.
    // The button opens the dialog, and Later puts it away while the dot stays. Nothing is installed.
    const sections=[...document.querySelectorAll('#panel-settings .settings-section > h3')].map(h=>h.id).join(',');
    const inAbout=!!document.querySelector('#settings-updates #update-button');
    $('close-panel').click();
    window.__pp('event',{type:'update',update:{version:'9.9.9',notes:''}});await until(()=>!$('update-pill').hidden);
    const tabDot=$('menu-settings').classList.contains('has-update');
    const pillShown=!$('update-pill').hidden&&$('update-pill-label').textContent.includes('v9.9.9')&&$('update-pill').parentElement.classList.contains('yard-dock')&&$('update-pill').parentElement.firstElementChild===$('update-pill')&&getComputedStyle($('update-pill')).display!=='none';
    $('update-pill').click();await until(()=>!$('update-dialog').hidden);
    const updateDialogOpen=!$('update-dialog').hidden&&$('update-title').textContent.includes('v9.9.9')&&!!$('update-dialog').closest('#panel-settings');
    $('update-later').click();await until(()=>$('update-dialog').hidden);
    const putAway=$('update-dialog').hidden&&$('update-pill').hidden&&$('menu-settings').classList.contains('has-update');
    // Later keeps Settings open; close it before playing, as a card waits while a sheet covers it.
    $('close-panel').click();
    await L('updateUi='+sections+'/'+(inAbout&&tabDot&&pillShown&&updateDialogOpen&&putAway?'ok':'err:'+[inAbout,tabDot,pillShown,updateDialogOpen,putAway].join(',')));
    await L('stage='+($('yard').getBoundingClientRect().height/innerHeight>.6?'yard-first':'small:'+$('yard').getBoundingClientRect().height));
    // The webview retains its last place across isolated backend runs; outdoor checks choose it explicitly.
    $('world').value='woodland';$('world').dispatchEvent(new Event('change'));
    await until(()=>$('yard').classList.contains('world-woodland')&&$('yard').dataset.environment==='illustrated');
    $('weather').value='snow';$('weather').dispatchEvent(new Event('change'));
    await L('weather='+($('yard').classList.contains('weather-snow')&&$('weather-layer').width>0?'snow-canvas':'err'));
    // A saved season changes the actual yard and wardrobe; Auto returns to the real local calendar.
    // The choice is kept in state.json (scene), saved a moment after the change.
    const appSeason=async()=>(await playPets.bootstrap()).data.scene?.season??null,savedSeason=value=>until(async()=>(await appSeason())===value);
    const priorSeason=await appSeason(),seasonRules=await import('./core/season.js'),seasonSprites=await import('./core/sprites.js');
    const seasonalAsset=(await import('./core/state.js')).data.assets.find(a=>a.seasonalSpriteUrls?.summer&&a.seasonalSpriteUrls?.winter);
    const chooseSeason=value=>{$('scene-season').value=value;$('scene-season').dispatchEvent(new Event('change'));};
    chooseSeason('winter');
    const chosenWinter=$('yard').classList.contains('season-winter')&&(await savedSeason('winter'))&&seasonalAsset&&seasonSprites.spriteSource(seasonalAsset)===seasonalAsset.seasonalSpriteUrls.winter;
    chooseSeason('summer');
    const chosenSummer=$('yard').classList.contains('season-summer')&&(await savedSeason('summer'))&&seasonalAsset&&seasonSprites.spriteSource(seasonalAsset)===seasonalAsset.seasonalSpriteUrls.summer;
    chooseSeason('auto');
    const calendarSeason=seasonRules.selectedSeason(new Date(),seasonRules.southern(Intl.DateTimeFormat().resolvedOptions().timeZone),'auto');
    const chosenAuto=$('yard').classList.contains('season-'+calendarSeason)&&(await savedSeason('auto'));
    chooseSeason(priorSeason??seasonRules.DEFAULT_SEASON);
    await until(()=>$('yard').dataset.environment==='illustrated');
    await L('seasonChoice='+(chosenWinter&&chosenSummer&&chosenAuto?'saved-yard-wardrobe-auto':'err'));
    const pickClimate=(id,value)=>document.querySelector('input[name="'+id+'-choice"][value="'+value+'"]').click();
    const sceneNow=(await import('./yard/world.js')).scene,environmentUi=await import('./yard/environment.js');
    const currentLand=()=>document.querySelector('.paint-land canvas:last-child');
    const landPixels=()=>{const canvas=currentLand();return canvas?.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.reduce((sum,value,i)=>(sum+value*((i%29)+1))%2147483647,0);};
    pickClimate('scene-season','spring');pickClimate('weather','clear');
    await until(()=>$('yard').dataset.environment==='illustrated'&&landPixels()>0);await wait(80);
    const clearLand=landPixels(),beforeSnow=currentLand();pickClimate('weather','snow');
    await until(()=>currentLand()!==beforeSnow&&$('yard').classList.contains('weather-snow'));
    const springSnow=sceneNow.season==='spring'&&environmentUi.environmentLook(sceneNow).art==='spring'&&(await savedSeason('spring'))&&$('scene-season').value==='spring'&&landPixels()===clearLand;
    pickClimate('scene-season','winter');pickClimate('weather','clear');
    const winterClear=sceneNow.season==='winter'&&sceneNow.weather==='clear'&&environmentUi.environmentLook(sceneNow).art==='winter';
    await L('weatherSeason='+(springSnow&&winterClear?'independent-radio-and-render':'err:'+JSON.stringify({springSnow,winterClear})));
    chooseSeason(priorSeason??seasonRules.DEFAULT_SEASON);

    // The season colours the yard and the sun or moon stands where the clock puts it.
    const yardStyle=$('yard').style;
    // The garden: a friend's find goes in the pocket, the tool plants it on the field, the backend keeps it.
    await until(()=>$('seed-count').textContent==='1');
    $('plant-tool').click();const yr=$('yard').getBoundingClientRect();
    $('yard').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:yr.left+yr.width*0.5,clientY:yr.top+yr.height*0.85}));
    await until(()=>document.querySelectorAll('.plant').length===1);
    const gb=(await playPets.bootstrap()).data.garden;
    await L('garden='+(gb.seeds===0&&gb.plants.length===1&&document.querySelector('.plant').dataset.stage==='seed'&&!$('yard').classList.contains('aiming')&&$('plant-tool').getAttribute('aria-disabled')==='true'?'found-planted':'err:'+JSON.stringify(gb)));
    // A gift: a friend the person did something with that day brings it, every other day; the backend picks the first
    // kind; a drag moves it and it stays moved; it can be put away.
    await window.__TAURI__.core.invoke('call',{name:'e2eFreshGifts',args:[]});await until(()=>!document.querySelector('.decor'));
    const giver=(await playPets.bootstrap()).data.pets[0].id,alone=await playPets.receiveGift(0.3,0.2,'2025-01-01',null,giver);
    const giftOn=async(x,y,day,event=null)=>{await playPets.befriend(giver,'pat',day);return playPets.receiveGift(x,y,day,event,giver);};
    const gift=(await giftOn(0.3,0.2,'2025-01-01')).data;await until(()=>document.querySelectorAll('.decor').length===1);
    const twice=await giftOn(0.5,0.5,'2025-01-01'),nextDay=await giftOn(0.5,0.5,'2025-01-02');const deco=document.querySelector('.decor'),dr=deco.getBoundingClientRect(),dp={bubbles:true,pointerId:7,button:0,clientX:dr.left+dr.width/2,clientY:dr.bottom-4};
    deco.dispatchEvent(new PointerEvent('pointerdown',dp));deco.dispatchEvent(new PointerEvent('pointermove',{...dp,clientX:dp.clientX+120}));deco.dispatchEvent(new PointerEvent('pointerup',{...dp,clientX:dp.clientX+120}));
    const moved=await until(async()=>(await playPets.bootstrap()).data.garden.decor[0]?.x>0.35);
    await playPets.putAway(gift.id);const away=await until(()=>!document.querySelector('.decor'));
    await L('gift='+(alone.ok===false&&gift.kind==='bench'&&gift.from===giver&&twice.ok===false&&nextDay.ok===false&&moved&&away&&(await playPets.bootstrap()).data.garden.received[0]==='bench'?'bench-every-other-day-moved-away':'err:'+JSON.stringify([alone,gift,twice,nextDay])));
    // A seasonal event: its gift comes on its days (the backend checks them), and the label beside the scene shows the event on now.
    const snow=(await giftOn(0.6,0.3,'2025-12-20','lights')).data;await until(()=>document.querySelectorAll('.decor').length===1);await playPets.putAway(snow.id);
    const {scene:now}=await import('./yard/world.js'),chipOk=$('event-chip').hidden===!now.event&&(!now.event||$('event-chip').textContent.length>0);
    await L('event='+(snow.kind==='snowman'&&chipOk?'gift-and-label':'err:'+JSON.stringify([snow,now.event,$('event-chip').hidden])));
    // Real saved gifts fill the yard; the next waits in the gift box, putting one away retains its album record and
    // frees the capacity, and the boxed one is set out from the album.
    const capacityGifts=[];
    for(let day=1;day<=12;day++){
      const result=await giftOn(0.12+(day%4)*0.2,0.5+Math.floor((day-1)/4)*0.1,'2026-03-'+String(day*2).padStart(2,'0'));
      if(!result.ok)throw Error('Gift capacity fixture failed: '+result.error);
      capacityGifts.push(result.data);
    }
    await until(()=>document.querySelectorAll('.decor').length===12);
    $('album-button').click();$('album-select').value='gift';$('album-select').dispatchEvent(new Event('change'));
    const boxedGift=(await giftOn(0.5,0.5,'2026-03-26')).data,fullGiftState=(await playPets.bootstrap()).data.garden;
    const boxShown=await until(()=>!$('album-box').hidden&&document.querySelectorAll('.album-box-item').length===1&&document.querySelector('.album-box-item').disabled);
    const capacityExplained=$('album-dig-status').textContent===${say('album.gift_full')}&&!$('album-dig-status').hidden&&!$('album-odds-button')&&boxedGift?.boxed===true&&fullGiftState.decor.length===12&&fullGiftState.boxed.length===1&&!!boxShown;
    await playPets.putAway(capacityGifts[0].id);
    const capacityFreed=await until(()=>$('album-dig-status').textContent===${say('album.gift_rule')}&&!document.querySelector('.album-box-item').disabled);
    const afterGiftAway=(await playPets.bootstrap()).data.garden;
    const giftRecordKept=afterGiftAway.received.length===fullGiftState.received.length&&afterGiftAway.received.includes(capacityGifts[0].kind)&&afterGiftAway.decor.length===11;
    document.querySelector('.album-box-item').click();
    const setOut=await until(async()=>{const g=(await playPets.bootstrap()).data.garden;return g.boxed.length===0&&g.decor.some(d=>d.id===boxedGift.id)&&$('album-box').hidden;});
    $('close-album').click();for(const item of [...capacityGifts.slice(1),boxedGift])await playPets.putAway(item.id);
    await until(()=>!document.querySelector('.decor'));
    await L('giftCapacity='+(capacityExplained&&capacityFreed&&giftRecordKept&&setOut?'full-boxed-set-out-record-kept':'err:'+JSON.stringify({capacityExplained,capacityFreed:!!capacityFreed,giftRecordKept,setOut:!!setOut})));

    // The album: a catch is kept (the biggest fish, a count), nonsense is refused, and the album shows it.
    await playPets.catch('fish','carp',41.5);await playPets.catch('fish','carp',33);const tooBig=await playPets.catch('fish','carp',999);
    await until(async()=>(await playPets.bootstrap()).data.album?.fish?.carp?.count===2);
    $('album-button').click();await until(()=>document.querySelectorAll('.album-card').length>0);document.querySelector('.album-tabs [data-book=fish]').click();
    const fishKinds=(await import('./yard/catalog.js')).FISH.length;
    const albumOk=document.querySelectorAll('.album-card').length===fishKinds&&document.querySelector('[data-count=fish]').textContent.endsWith('/'+fishKinds)&&document.querySelectorAll('.album-card:not(.unknown)').length===1&&(await playPets.bootstrap()).data.album.fish.carp.best===41.5&&tooBig.ok===false;
    $('album-dialog').close();
    await L('album='+(albumOk?'kept-and-shown':'err:'+JSON.stringify((await playPets.bootstrap()).data.album)));
    // New catalogue IDs pass the native save boundary and use decoded local atlases.
    const extensionFish=['stickleback','freshwater_prawn','crayfish','pond_snail'],extensionBugs=['ladybug','field_cricket'];
    let extensionAccepted=true;
    for(const id of extensionFish)extensionAccepted&&=(await playPets.catch('fish',id,3)).ok;
    for(const id of extensionBugs)extensionAccepted&&=(await playPets.catch('bug',id,0)).ok;
    for(let day=1;day<=6;day++){
      const result=await giftOn(0.4,0.3,'2026-04-'+String(day*2).padStart(2,'0'));
      if(result.ok)await playPets.putAway(result.data.id);else extensionAccepted=false;
    }
    const extensionState=(await playPets.bootstrap()).data;
    extensionAccepted&&=extensionFish.every(id=>extensionState.album.fish[id]?.count===1)&&extensionBugs.every(id=>extensionState.album.bugs[id]?.count===1)&&['bunny_watering_can','hedgehog_planter'].every(id=>extensionState.garden.received.includes(id));
    const extensionRecords=await fetch('art/collection.json').then(r=>r.json()),extensionAtlases=[...new Set(extensionRecords.filter(r=>r.atlas.startsWith('collection-extension/')).map(r=>r.atlas))];
    const extensionDecoded=await Promise.all(extensionAtlases.map(atlas=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image.naturalWidth>0);image.onerror=()=>resolve(false);image.src='art/'+atlas;})));
    await L('collectionExtension='+(extensionAccepted&&extensionDecoded.every(Boolean)?'aquatic-ground-bugs-gifts-saved-atlases-decoded':'err'));
    // Friendship: the backend decides what a thing is worth and caps a day; hearts show on the name tag.
    const fid=(await playPets.bootstrap()).data.pets[0].id,p0=(await playPets.bootstrap()).data.bonds?.[fid]?.points||0,bribe=await playPets.befriend(fid,'bribe','2026-01-02');
    let rose=0;for(const day of ['2026-01-02','2026-01-03'])for(let k=0;k<12;k++)rose+=(await playPets.befriend(fid,'gift',day)).data.up?1:0;
    const hearts=await until(()=>document.querySelector('.tag-bond')?.textContent==='♥');
    await L('friendship='+((await playPets.bootstrap()).data.bonds[fid].points-p0)+'/'+rose+'/'+(hearts?'hearts':'none')+'/'+(bribe.ok===false?'refused':'taken'));
    // A friend that grew closer brings one gift for the level it reached, on a day the person did something with it
    // (the last befriend day above; the yard may bring it first on its own).
    const apart=await playPets.thanksGift(fid,2,0.5,0.6,'2026-01-02'),thanks=await playPets.thanksGift(fid,2,0.5,0.6,'2026-01-03'),thanksAgain=await playPets.thanksGift(fid,2,0.5,0.6,'2026-01-03'),tooHigh=await playPets.thanksGift(fid,3,0.5,0.6,'2026-01-03');
    const thankedState=(await playPets.bootstrap()).data.garden;
    for(const d of thankedState.decor.filter(d=>d.from===fid))await playPets.putAway(d.id);
    await L('thanksGift='+(thankedState.thanked?.[fid]===2&&apart.ok===false&&(!thanks.ok||thanks.data.from===fid)&&thanksAgain.ok===false&&tooHigh.ok===false?'once-a-level-reached':'err:'+JSON.stringify([apart,thanks,thanksAgain,tooHigh,thankedState.thanked])));
    // Pats bring at most a quarter of a day's worth; at Very close (level 4) the thanks gift is the friend's memento,
    // which goes back into the gift box when put away and comes out of it again. A friend invited for it and sent
    // away after, so the steps below keep their first friend as it was; its memento stays in the box.
    const closeFriend=(await playPets.addPet((await playPets.bootstrap()).data.pets[0].assetId)).data,mid=closeFriend?.id;
    const bondOf=async()=>(await playPets.bootstrap()).data.bonds[mid]||{points:0};
    const beforePats=(await bondOf()).points;for(let k=0;k<15;k++)await playPets.befriend(mid,'pat','2026-01-04');
    const patsCapped=(await bondOf()).points-beforePats===10;
    let closeDay='2026-01-04';
    for(let n=4;n<40&&(await bondOf()).points<500;n++){closeDay=new Date(Date.UTC(2026,0,n)).toISOString().slice(0,10);for(let k=0;k<8;k++)await playPets.befriend(mid,'gift',closeDay);}
    const third=await playPets.thanksGift(mid,3,0.4,0.6,closeDay),fourth=await playPets.thanksGift(mid,4,0.6,0.6,closeDay);
    const memento=fourth.data;let mementoFlow=third.ok&&fourth.ok&&memento?.memento===true&&memento.from===mid;
    if(third.ok)await playPets.putAway(third.data.id);
    if(mementoFlow){
      await playPets.putAway(memento.id);
      const boxedMemento=(await playPets.bootstrap()).data.garden.boxed.find(d=>d.id===memento.id);
      const backOut=await playPets.setOut(memento.id,0.5,0.8);
      const outAgain=(await playPets.bootstrap()).data.garden.decor.some(d=>d.id===memento.id);
      await playPets.putAway(memento.id);
      mementoFlow=boxedMemento?.memento===true&&backOut.ok&&outAgain;
    }
    if(mid)await playPets.removePet(mid);
    await L('memento='+(mid&&patsCapped&&mementoFlow?'pats-capped-memento-boxed-and-set-out':'err:'+JSON.stringify({patsCapped,third,fourth,closeDay,bond:await bondOf()})));
    // Yard sounds: on by default; the chip turns them off and on, the volume is kept and held to 0–100.
    // The settings change while the yard stays quiet: the volume goes to 0 before the chip turns it on.
    await playPets.setSound(null,300);const held=(await playPets.bootstrap()).data.sound.volume;await playPets.setSound(null,0);
    $('sound-button').click();const soundOn=await until(async()=>(await playPets.bootstrap()).data.sound.on===true&&$('sound-button').getAttribute('aria-pressed')==='true');
    $('sound-button').click();const soundOff=await until(async()=>(await playPets.bootstrap()).data.sound.on===false&&$('sound-button').getAttribute('aria-pressed')==='false');
    await L('sound='+(soundDefault.on&&soundDefault.volume===40&&held===100&&soundOn&&soundOff?'off-on-held':'err:'+JSON.stringify([soundDefault,held,soundOn,soundOff])));
    await L('season='+(/ season-(spring|summer|autumn|winter)/.test($('yard').className)&&/%$/.test(yardStyle.getPropertyValue('--orb-x'))&&yardStyle.getPropertyValue('--moon-lit').includes('svg')?'set':'err:'+$('yard').className));
    // Discovery commits after arrival, repeated ground is replay-safe, and a planted tree renders from saved state.
    const discoveryFlow=await import('./yard/discovery.js'), discoveryGround=await import('./yard/ground.js'), discoveryRules=await import('./yard/discovery-rules.js'), discoveryState=await import('./core/state.js');
    const discoveryFriend=discoveryState.views.values().next().value;
    const discoveryPoints=Array.from({length:49},(_,i)=>({x:(i%7+1)/8,y:(Math.floor(i/7)+1)/8})).filter(p=>discoveryRules.groundAllows(p,discoveryGround.groundProfile()));
    if(!discoveryPoints.length)throw Error('No open discovery ground');
    const discoveryPoint=discoveryPoints[0], discoveryWorld=(await import('./yard/world.js')).scene.world;
    const discoveryBefore=(await playPets.bootstrap()).data.garden.digs.length;
    const discoveryChoice={season:$('scene-season').value,weather:$('weather').value},digInvocations=[],nativeFetch=window.fetch;
    let changedAfterIssue=false,actionAtIssue=false;
    // Observe native command payloads without changing the backend result or random draw.
    window.fetch=function(input,options){
      if(String(input).includes('/call')&&typeof options?.body==='string'){
        let payload;try{payload=JSON.parse(options.body);}catch{}
        if(payload?.name==='dig'){
          digInvocations.push(payload.args);
          if(!changedAfterIssue){actionAtIssue=!!document.querySelector('.dig-effect');changedAfterIssue=true;$('weather').value='clear';$('weather').dispatchEvent(new Event('change'));}
        }
      }
      return nativeFetch.call(this,input,options);
    };
    chooseSeason('winter');$('weather').value='rain';$('weather').dispatchEvent(new Event('change'));
    await until(()=>$('yard').dataset.environment==='illustrated');
    discoveryFlow.sendDiscovery(discoveryFriend,discoveryPoint,'dig');
    $('weather').value='snow';$('weather').dispatchEvent(new Event('change'));
    const discoveryNoEarly=(await playPets.bootstrap()).data.garden.digs.length===discoveryBefore;
    if(document.visibilityState==='hidden'){const trip=discoveryFriend.trip;discoveryFriend.trip=null;discoveryFriend.target=null;await trip.arrive();}
    await until(async()=>(await playPets.bootstrap()).data.garden.digs.length===discoveryBefore+1,20000);
    await wait(1700);
    window.fetch=nativeFetch;
    const capturedDig=digInvocations.find(args=>args[0]===discoveryFriend.pet.id&&args[1]===discoveryWorld&&args[2]===discoveryPoint.x&&args[3]===discoveryPoint.y);
    const snapshotContext=capturedDig?.[5]?.season==='winter'&&capturedDig?.[5]?.weather==='snow'&&actionAtIssue&&changedAfterIssue&&(await import('./yard/world.js')).scene.season==='winter'&&(await import('./yard/world.js')).scene.weather==='clear';
    await L('digContext='+(snapshotContext?'arrival-snapshot-native-bridge':'err:'+JSON.stringify({captured:capturedDig?.[5],calls:digInvocations.length,actionAtIssue,changedAfterIssue})));
    chooseSeason(discoveryChoice.season);$('weather').value=discoveryChoice.weather;$('weather').dispatchEvent(new Event('change'));
    const discoveryReplay=await must('discoveryReplay',playPets.dig(discoveryFriend.pet.id,discoveryWorld,discoveryPoint.x,discoveryPoint.y,discoveryGround.groundProfile()));
    const discoveryOnce=(await playPets.bootstrap()).data.garden.digs.length===discoveryBefore+1&&discoveryReplay.data?.repeated===true;
    const discoveryTreeBefore=(await playPets.bootstrap()).data.garden.trees.length, saplingsBefore=(await playPets.bootstrap()).data.garden.saplings.maple;
    discoveryFlow.sendDiscovery(discoveryFriend,discoveryPoint,'tree','maple');
    if(document.visibilityState==='hidden'){const trip=discoveryFriend.trip;discoveryFriend.trip=null;discoveryFriend.target=null;await trip.arrive();}
    await until(async()=>(await playPets.bootstrap()).data.garden.trees.length===discoveryTreeBefore+1,20000);
    await until(()=>!!document.querySelector('.planted-tree'));
    const discoveryTree=(await playPets.bootstrap()).data.garden.trees.at(-1),discoveryTreeBox=document.querySelector('.planted-tree').getBoundingClientRect();
    const discoverySaved=discoveryTree.world===discoveryWorld&&discoveryTree.stage===0&&discoveryTreeBox.width>0&&discoveryTreeBox.height>0&&(await playPets.bootstrap()).data.garden.saplings.maple===saplingsBefore-1;
    discoveryFlow.cancelDiscoveryWork();
    await must('removeDiscoveryTree',playPets.removeTree(discoveryTree.id));
    await until(()=>!document.querySelector('.planted-tree'));
    await L('discovery='+(discoveryNoEarly&&discoveryOnce&&discoverySaved?'arrival-replay-and-tree':'err'));
    const homeBefore=(await playPets.bootstrap()).data.pets.map(p=>p.x+','+p.y).join('|');
    document.querySelector('[data-game=hide]').click();
    // Friends only walk while the window is drawn. Behind other windows (or with the screen off)
    // the webview stops animating, so the walk to the hiding spots cannot be observed.
    if(document.visibilityState==='hidden'){const started=gameLabel();playing().click();await L('hide=window-hidden/'+started+'/'+gameLabel());}
    else{
      await until(()=>document.querySelectorAll('.yard-pet.hiding').length>=2,8000);const hiding=document.querySelectorAll('.yard-pet.hiding').length;
      // The game names a friend: someone else is a miss and stays hidden, the named one is found.
      const asked=()=>$('banner-label').textContent===${say('hide.find_label')}?$('banner-title').textContent:null,byName=n=>{const l=[...document.querySelectorAll('.pet-label.hiding')].find(l=>l.querySelector('.tag-name').textContent===n);return l&&document.querySelector('.yard-pet[data-id="'+l.dataset.id+'"]');};
      const first=asked(),other=[...document.querySelectorAll('.yard-pet.hiding')].find(b=>b!==byName(first));
      press(other);await wait(200);
      const miss=document.querySelectorAll('.yard-pet.hiding').length===2&&!$('game-banner').hidden&&$('banner-sub').textContent.includes(${say('hide.miss')})&&asked()===first;
      press(byName(first));await wait(300);const second=asked();press(byName(second));await wait(2200);
      const cleared=$('game-banner').hidden;
      await L('hide='+hiding+'/'+document.querySelectorAll('.yard-pet.hiding').length+'/'+gameLabel()+'/'+(miss&&cleared&&second!==first?'by-name':'err:'+miss+':'+first+':'+second));
    }
    document.querySelector('[data-game=tag]').click();await wait(400);
    const tagger=document.querySelectorAll('.yard-pet.tagger').length;
    const gameState=await import('./core/state.js'),gamePlay=await import('./yard/play.js');
    const previousIt=gameState.game.it,catcher=gameState.views.get(previousIt),caught=[...gameState.views.values()].find(v=>v.pet.id!==previousIt);
    caught.px=catcher.px;caught.py=catcher.py;gamePlay.judge(Math.max(performance.now(),gameState.game.safeUntil,catcher.frozenUntil)+1);
    const transferred=gameState.game.it===caught.pet.id&&caught.frozen&&caught.button.classList.contains('tagger');
    gamePlay.playGame(gameState.game.until+1,40);
    const tagFinished=!gameState.game&&[...gameState.views.values()].every(v=>!v.frozen&&!v.frozenUntil)&&!document.querySelector('.yard-pet.tagger');
    document.querySelector('[data-game=parade]').click();await wait(400);const parading=gameLabel();playing().click();
    await L('games='+tagger+'/'+parading+'/'+gameLabel());
    document.querySelector('[data-game=parade]').click();
    for(const v of gameState.views.values()){v.target=null;v.trip=null;}
    gamePlay.playGame(performance.now(),26001);
    await L('gameCompletion='+(transferred&&tagFinished&&!gameState.game&&!$('yard').classList.contains('playing')?'tag-transfer-and-both-end':'err:'+JSON.stringify([transferred,tagFinished,!!gameState.game])));
    const home=(await playPets.bootstrap()).data.pets.map(p=>p.x+','+p.y).join('|');
    await L('gamesKeepHome='+(home===homeBefore));
    // A walk to the lake ends when a game takes the friend, and the lake can be fished again after.
    const {onLake}=await import('./yard/catch.js'),st=await import('./core/state.js'),lakeBox=$('yard').getBoundingClientRect(),lx=lakeBox.width*0.52;
    let ly=0;for(let y=0;y<lakeBox.height&&!ly;y+=2)if(onLake(lx,y))ly=y+6;
    const clickLake=()=>$('yard').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:lakeBox.left+lx,clientY:lakeBox.top+ly}));
    // A trip to the lake: one that can be called off, by a friend not on its way home from a game.
    const toLake=()=>[...st.views.values()].filter(v=>v.trip?.cancel&&!v.away).length;
    const fishFor=()=>until(()=>{if(!toLake())clickLake();return toLake();},8000);
    const first=await fishFor();
    document.querySelector('[data-game=tag]').click();await wait(200);const during=toLake();playing().click();
    await until(()=>[...st.views.values()].every(v=>!v.away),8000);const again=await fishFor();
    await L('lakeAgain='+first+'/'+during+'/'+again);
    const catchModule=await import('./yard/catch.js');
    const cast=await until(()=>document.querySelector('.bobber'),10000);
    const countFish=async()=>Object.values((await playPets.bootstrap()).data.album.fish||{}).reduce((sum,item)=>sum+item.count,0);
    const fishBefore=await countFish();
    if(cast)cast.click();
    const early=cast&&!cast.classList.contains('bite')&&document.querySelector('.bobber')===cast;
    const bite=await until(()=>document.querySelector('.bobber.bite'),12000);
    if(bite)bite.click();
    // Backend persistence and the page's catch card complete through separate bridge replies.
    const cardShown=await until(()=>!$('catch-card').hidden);
    const fishSaved=await until(async()=>(await countFish())===fishBefore+1);
    const fishingResult={cast:!!cast,early:!!early,bite:!!bite,saved:!!fishSaved,floatGone:!document.querySelector('.bobber'),lineGone:!document.querySelector('.fishing-line'),card:!!cardShown};
    await L('fishingFlow='+(Object.values(fishingResult).every(Boolean)?'cast-bite-reward-clean':'err:'+JSON.stringify(fishingResult)));
    catchModule.endFishing();
    // Switching rooms cancels an outdoor trip and leaves no invisible fishing target indoors.
    await until(()=>[...st.views.values()].every(v=>!v.away),8000);
    await fishFor();
    const worldSelect=$('world');
    worldSelect.value='studio';worldSelect.dispatchEvent(new Event('change'));
    await until(()=>$('yard').classList.contains('world-studio')&&$('yard').dataset.environment==='illustrated');
    const indoor=(await import('./yard/world.js')).scene;
    $('weather').value='rain';$('weather').dispatchEvent(new Event('change'));await wait(150);
    const {environmentLook,environmentFrame,weatherPanes}=await import('./yard/environment.js'),{worldFor}=await import('./yard/worlds.js');
    const cityArt=[];for(const period of ['morning','day','evening','night']){$('period').value=period;$('period').dispatchEvent(new Event('change'));cityArt.push(environmentLook(indoor).art);}
    const roomClean=indoor.world==='studio'&&indoor.weather==='rain'&&indoor.event===null&&!onLake(lx,ly)&&!toLake()&&!document.querySelector('.bobber')&&!document.querySelector('.fishing-line')&&!$('weather').disabled&&weatherPanes(lakeBox.width,lakeBox.height,environmentFrame(lakeBox.width,lakeBox.height,indoor),worldFor(indoor.world).windowPanes).length>0;
    await L('studioLight='+(cityArt.join(',')==='studio-cozy-morning,studio-cozy-day,studio-cozy-evening,studio-cozy-night'?'four-city-views':'err:'+cityArt));
    document.querySelector('[data-game=tag]').click();await wait(200);
    const indoorGame=st.game?.kind==='tag';
    worldSelect.value='woodland';worldSelect.dispatchEvent(new Event('change'));
    $('weather').value='clear';$('weather').dispatchEvent(new Event('change'));
    $('period').value='day';$('period').dispatchEvent(new Event('change'));
    await until(()=>$('yard').classList.contains('world-woodland'));
    await L('worldSwitch='+(roomClean&&indoorGame&&!st.game&&!$('weather').disabled&&onLake(lx,ly)?'indoor-clean-and-games-outdoor-restored':'err'));
    // The exported format enters through the same file input as a downloaded studio package.
    const png=await fetch('./art/environments/green.png').then(r=>r.blob());
    const pngUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(png);});
    const portable={format:'playpets-background',version:1,name:'Native studio fixture',images:{base:pngUrl,spring:pngUrl,summer:pngUrl,autumn:pngUrl,winter:pngUrl},floor:0.66,water:{from:0.48,to:0.7,center:0.595,radius:0.018},fishingSpot:{x:0.48,y:0.68},sky:true,weather:true,ambient:false,windows:[]};
    const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(portable)],'studio.json',{type:'application/json'}));
    $('background-file').files=transfer.files;$('background-file').dispatchEvent(new Event('change',{bubbles:true}));
    const imported=await until(()=>worldSelect.value.startsWith('custom-')&&worldSelect.value,10000);
    const portableWorld=worldFor(imported);
    const stored=(await playPets.listBackgrounds()).data.find(b=>b.id===imported)?.pack?.name;
    // A background an older version kept in the webview moves into the data folder at the next
    // start and leaves the webview once it is there; a time of day left in the webview is newer than
    // the app's (an older version or a failed save wrote it), so it moves over too.
    const oldId='custom-'+crypto.randomUUID(),backgroundStore=await import('./yard/background-store.js'),{worlds:allWorlds}=await import('./yard/worlds.js'),worldCount=allWorlds.length;
    await new Promise((resolve,reject)=>{const request=indexedDB.open('playpets-backgrounds',1);request.onupgradeneeded=()=>request.result.createObjectStore('packs',{keyPath:'id'});request.onerror=reject;request.onsuccess=()=>{const db=request.result,tx=db.transaction('packs','readwrite');tx.objectStore('packs').put({id:oldId,pack:{...portable,name:'Before 1.4.0'}});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=reject;};});
    const priorPeriod=(await playPets.bootstrap()).data.scene?.period;
    localStorage.setItem('period','night');
    await backgroundStore.restoreBackgrounds();await (await import('./yard/sky.js')).moveOldScene();
    const movedPack=(await playPets.listBackgrounds()).data.find(b=>b.id===oldId)?.pack?.name,leftInWebview=await new Promise(resolve=>{const request=indexedDB.open('playpets-backgrounds',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('packs'),rows=tx.objectStore('packs').getAll();rows.onsuccess=()=>resolve(rows.result.length);tx.oncomplete=()=>db.close();};});
    const shownOnce=allWorlds.filter(w=>w.id===oldId).length===1;
    allWorlds.splice(worldCount);await playPets.removeBackground(oldId);
    const movedPeriod=(await playPets.bootstrap()).data.scene?.period;
    if(priorPeriod)await playPets.setScene('period',priorPeriod);
    await L('backgroundUpgrade='+(movedPack==='Before 1.4.0'&&leftInWebview===0&&shownOnce&&localStorage.getItem('period')===null&&movedPeriod==='night'?'moved-to-data-folder':'err:'+JSON.stringify({movedPack,leftInWebview,shownOnce,period:localStorage.getItem('period'),movedPeriod})));
    await until(()=>$('yard').dataset.environment==='illustrated'&&document.querySelectorAll('.paint-land canvas').length===1);
    await L('backgroundImport='+(imported&&stored===portable.name&&portableWorld.capabilities.fishing&&portableWorld.capabilities.seasonalEffects&&onLake(lx,ly)&&document.querySelector('[data-world="'+imported+'"][aria-pressed="true"]')?'file-gallery-storage-and-fishing':'err'));
    // Resizing changes layout, never the pin or the active activity.
    const nativeWindow=async rect=>(await window.__TAURI__.core.invoke('call',{name:'e2eWindow',args:rect?['main',rect]:['main']})).data;
    const fits=()=>document.body.scrollHeight<=document.body.clientHeight&&document.body.scrollWidth<=document.body.clientWidth;
    const fitsFull=fits(),fullAt=await nativeWindow(),wide=innerWidth;
    await nativeWindow({...fullAt,width:460,height:320});
    await until(()=>document.body.classList.contains('compact')&&innerWidth===460);await wait(200);
    const compactAt=await nativeWindow(),fitsSmall=fits();
    const sameBounds=(a,b)=>['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<=1);
    contextAt();await wait(30);
    const smallContext=!$('yard-context-menu').hidden&&contextFits()&&['scene','pin'].every(action=>{const r=document.querySelector('[data-context-action="'+action+'"]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.right<=innerWidth;});
    const pinTrack=document.querySelector('[data-context-action=pin]');
    const pinOffVisual=pinTrack.getAttribute('aria-checked');
    await $('always-on-top').onclick();
    const pinOnVisual=pinTrack.getAttribute('aria-checked');
    const pinOn=await until(async()=>{const w=await nativeWindow();return w.alwaysOnTop&&$('always-on-top').getAttribute('aria-pressed')==='true'&&w;});
    const trayPin=(await trayAt()).items.includes('alwaysOnTop:on');
    await $('always-on-top').onclick();
    const pinOff=await until(async()=>{const w=await nativeWindow();return !w.alwaysOnTop&&$('always-on-top').getAttribute('aria-pressed')==='false'&&w;});
    $('yard-context-menu').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    const smallContextEsc=$('yard-context-menu').hidden&&document.activeElement===$('yard');
    await L('contextSmall='+(smallContext&&smallContextEsc?'clamped-and-escaped':'err'));
    await L('windowPin='+(pinOn&&pinOff&&trayPin&&pinOnVisual!==pinOffVisual&&sameBounds(compactAt,pinOn)&&sameBounds(compactAt,pinOff)?'independent-and-synced':'err:'+JSON.stringify({compactAt,pinOn,pinOff,trayPin,ui:$('always-on-top').getAttribute('aria-pressed')})));
    const small=document.body.classList.contains('compact')&&compactAt.resizable&&getComputedStyle($('window-drag')).display!=='none'&&document.querySelectorAll('[data-resize]').length===8&&!document.querySelector('#mini,#unmini');
    panelTasks.openPanel('settings');await wait(100);
    const settingsSmall=!$('settings-home').hidden&&$('settings-content').hidden&&$('settings-home').getBoundingClientRect().height>40&&$('side-panel').getBoundingClientRect().bottom<=innerHeight;
    $('close-panel').click();await L('settingsSmall='+(settingsSmall?'body-and-navigation':'err'));
    await nativeWindow(fullAt);await until(()=>!document.body.classList.contains('compact')&&innerWidth===wide);
    await L('pageFits='+fitsFull+'/'+fitsSmall);
    // Every destination remains navigable at the minimum size and retains its state when widened.
    const visibleNode=node=>{const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;};
    // Translate the real controls in place; production language changes reload the window.
    const localeUi=await import('./core/i18n.js');
    const noWrap=node=>{
      const range=document.createRange();range.selectNodeContents(node);
      const lines=[...range.getClientRects()].filter(rect=>rect.width>0&&rect.height>0);
      const box=node.getBoundingClientRect(),style=getComputedStyle(node);
      return lines.length===1&&lines[0].height<=(parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.5)+1&&node.scrollWidth<=Math.max(node.clientWidth,box.width)+1&&parseFloat(style.fontSize)>=12;
    };
    const rewardCatalog=await import('./yard/catalog.js'),rewardState=(await playPets.bootstrap()).data;
    const rareSeed=rewardState.garden.digs.find(dig=>dig.attemptId==='saved-rare-fixture');
    const rewardOdds=rewardState.limits.digOdds,rewardTrace=[];
    let customRewardProof=null;
    const blockedLedger=rareSeed?.kind==='quartz'&&rareSeed.petId==='previous-friend'&&rareSeed.world==='courtyard'&&Date.now()<rareSeed.at+86400000;
    const actualOdds=rewardOdds.common===22&&rewardOdds.uncommon===3&&rewardOdds.sapling===20;
    const inspectRewardAlbum=(book,checkLayout=false,selectBook=true)=>{
      if(selectBook){$('album-select').value=book;$('album-select').dispatchEvent(new Event('change'));}
      const context={season:rewardScene.season,weather:rewardScene.weather,place:rewardScene.world};
      const kinds=book==='tree'?rewardCatalog.TREES:rewardCatalog.TREASURES,cards=[...$('album-grid').querySelectorAll('.album-card')];
      let correct=cards.length===kinds.length;
      for(const [i,kind] of kinds.entries()){
        const hint=localeUi.t('album.favored',{conditions:localeUi.joinList([...(kind.affinity?.seasons||[]).map(value=>localeUi.t('catch.season_'+value)),...(kind.affinity?.weather||[]).map(value=>localeUi.t('weather.'+value)),...(kind.affinity?.places||[]).map(value=>localeUi.t('world.'+value))])});
        correct&&=!cards[i]?.querySelector('.album-chance')&&cards[i]?.textContent.includes(hint);
      }
      const status=$('album-dig-status'),expiry=new Date((rareSeed?.at??0)+86400000).toLocaleString(localeUi.language(),{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
      const rawPlace=localeUi.t('world.'+context.place),customPlace=rawPlace==='world.'+context.place,placeName=customPlace?localeUi.t('album.custom_place'):rawPlace;
      const contextText=localeUi.t('album.dig_context',{conditions:localeUi.joinList([localeUi.t('catch.season_'+context.season),localeUi.t('weather.'+context.weather),placeName])});
      const oldContextText=localeUi.t('album.dig_context',{conditions:localeUi.joinList([localeUi.t('catch.season_'+context.season),localeUi.t('weather.'+context.weather),rawPlace])});
      correct&&=!status.hidden&&status.textContent.includes(contextText)&&status.textContent.includes(localeUi.t('album.rare_wait',{time:expiry}));
      if(checkLayout){
        const grid=$('album-grid').getBoundingClientRect();
        const layout={statusVisible:visibleNode(status),closeVisible:visibleNode($('close-album')),gridHeight:grid.height,gridBottom:grid.bottom,viewport:innerHeight,statusFits:status.scrollWidth<=status.clientWidth+1,cardsFit:cards.every(card=>card.scrollWidth<=card.clientWidth+1)};
        if(!correct)rewardTrace.push(['copy-diagnostic',localeUi.language(),innerWidth,book,{context,actualStatus:status.textContent,expectedContext:contextText,expectedWait:localeUi.t('album.rare_wait',{time:expiry}),layout}]);
        if(customPlace&&(!customRewardProof||localeUi.language()==='en'))customRewardProof={actualStatus:status.textContent,oldExpected:oldContextText,correctExpected:contextText,layout,correct:status.textContent.includes(contextText)&&!status.textContent.includes(oldContextText)};
        correct&&=layout.statusVisible&&layout.closeVisible&&grid.height>=40&&grid.bottom<=innerHeight+1&&layout.statusFits&&layout.cardsFit;
      }
      return correct;
    };
    const inspectConditionsOnly=book=>{
      $('album-select').value=book;$('album-select').dispatchEvent(new Event('change'));
      return !$('album-odds-button')&&!document.querySelector('.album-chance')&&visibleNode($('album-total'))&&noWrap($('album-total'));
    };
    const inspectIndoorRewards=book=>{
      $('album-select').value=book;$('album-select').dispatchEvent(new Event('change'));
      return !document.querySelector('.album-chance')&&$('album-grid').children.length===(book==='tree'?rewardCatalog.TREES:rewardCatalog.TREASURES).length&&$('album-dig-status').textContent===localeUi.t('discovery.indoors')&&!$('album-dig-status').hidden;
    };
    const rewardScene=(await import('./yard/world.js')).scene,rewardChoices={world:$('world').value,season:$('scene-season').value,weather:$('weather').value};
    $('world').value='woodland';$('world').dispatchEvent(new Event('change'));chooseSeason('spring');$('weather').value='clear';$('weather').dispatchEvent(new Event('change'));
    $('album-button').click();const rewardLiveBefore=inspectRewardAlbum('treasure'),rewardStatusBefore=$('album-dig-status').textContent;
    $('weather').value='rain';$('weather').dispatchEvent(new Event('change'));
    const rewardLiveUpdated=await until(()=>inspectRewardAlbum('treasure',false,false)&&$('album-dig-status').textContent!==rewardStatusBefore);
    $('close-album').click();
    await L('digRewardLive='+(rewardLiveBefore&&rewardLiveUpdated?'weather-updates-open-album':'err'));
    let rewardContexts=blockedLedger&&actualOdds;
    for(const place of ['woodland','courtyard','lakeside']){
      $('world').value=place;$('world').dispatchEvent(new Event('change'));
      for(const season of ['spring','summer','autumn','winter']){
        chooseSeason(season);
        for(const weather of ['clear','rain','snow']){
          $('weather').value=weather;$('weather').dispatchEvent(new Event('change'));
          $('album-button').click();
          for(const book of ['tree','treasure']){const correct=inspectRewardAlbum(book);rewardContexts&&=correct;rewardTrace.push([place,season,weather,book,correct]);}
          $('close-album').click();
        }
      }
    }
    $('world').value=rewardChoices.world;$('world').dispatchEvent(new Event('change'));chooseSeason(rewardChoices.season);$('weather').value=rewardChoices.weather;$('weather').dispatchEvent(new Event('change'));
    await L('digRewardContexts='+(rewardContexts&&rewardTrace.length===72?'all-places-seasons-weather-ledger-blocked':'err:'+JSON.stringify({blockedLedger,actualOdds,rewardTrace})));
    const menuCopyTrace=[];let menuCopyFits=true,rewardLocaleFits=true,indoorRewardFits=true,conditionsOnlyFits=true,giftRuleFits=true;

    for(const shape of [{...fullAt,width:300,height:210},fullAt]){
      await nativeWindow(shape);await until(()=>Math.abs(innerWidth-shape.width)<=1);await wait(80);
      for(const lang of ['ko','en','ja','zh-hans']){
        localeUi.setLanguageForTests(lang);localeUi.apply();
        (await import('./core/controls.js')).openPlay();await wait(40);
        // Wide windows keep every name on one line; small windows fold tiles and allow two lines, but nothing spills.
        const folded=document.body.classList.contains('compact');
        const fits=(tile,labels)=>{tile.scrollIntoView({block:'nearest'});return visibleNode(tile)&&tile.scrollWidth<=tile.clientWidth+1&&tile.scrollHeight<=tile.clientHeight+1&&(folded||labels.every(noWrap));};
        // With seeds or without, the same: a two-digit count is the widest the seed tile shows.
        const seedsBefore=$('seed-count').textContent;$('seed-count').textContent='12';
        const tiles=[...$('play-sections').querySelectorAll('.play-action')];
        const playChecks=tiles.map(tile=>({id:tile.id||tile.dataset.game,fits:fits(tile,[...tile.querySelectorAll('span[data-i18n],.game-name')])}));
        const playOk=tiles.length===10&&playChecks.every(check=>check.fits)&&visibleNode($('play-panel'));
        $('seed-count').textContent=seedsBefore;
        if(!playOk)menuCopyTrace.push([lang,innerWidth,'play',playChecks]);
        $('close-play').click();openMenu();await wait(40);
        const actions=[...$('yard-controls-panel').querySelectorAll('.menu-destination')];
        const actionChecks=actions.map(button=>({id:button.id,fits:fits(button,[button.querySelector('.menu-destination-copy strong')])}));
        const actionsOk=actions.length===3&&actionChecks.every(check=>check.fits)&&!document.querySelector('[data-management-tab]');
        if(!actionsOk)menuCopyTrace.push([lang,innerWidth,'menu',actionChecks]);
        menuCopyFits&&=playOk&&actionsOk;
        menuCopyTrace.push([lang,innerWidth,playOk,actionsOk,menuCopyFits]);
        $('close-controls').click();
        $('scene-button').click();await wait(30);
        const atmosphere=$('scene-body'),details=[...atmosphere.querySelectorAll('.atmosphere-choice')],summaries=details.map(group=>group.querySelector('summary'));
        // Atmosphere sits below Places on the same page: bring it into view first, as a person scrolls.
        summaries.at(-1).scrollIntoView({block:'nearest'});await wait(20);
        const compactClimate=document.body.classList.contains('compact');
        let climateFits=details.length===3&&(!compactClimate||summaries.every(visibleNode));
        const climateTrace=[['initial',climateFits,summaries.map(node=>({text:node.textContent,box:node.getBoundingClientRect().toJSON()}))]];
        for(const group of details){
          const summary=group.querySelector('summary');
          if(compactClimate&&!group.open)summary.click();await wait(20);
          const segments=group.querySelector('.atmosphere-segments');
          segments.scrollIntoView({block:'nearest'});await wait(20);
          climateFits&&=segments.scrollWidth<=segments.clientWidth+1&&(!compactClimate||details.filter(item=>item.open).length===1);
          const pageBox=atmosphere.getBoundingClientRect();
          climateTrace.push(['opened',summary.textContent,group.open,details.filter(item=>item.open).length,segments.scrollWidth,segments.clientWidth,pageBox.toJSON(),atmosphere.scrollTop]);
          for(const label of segments.querySelectorAll('span')){
            const box=label.getBoundingClientRect();
            const optionFits=noWrap(label)&&visibleNode(label)&&box.top>=pageBox.top-1&&box.bottom<=pageBox.bottom+1;
            climateFits&&=optionFits;if(!optionFits)climateTrace.push(['option',label.textContent,noWrap(label),visibleNode(label),box.toJSON()]);
          }
          if(compactClimate){
            const radios=[...group.querySelectorAll('input')],selectedRadio=radios.find(radio=>radio.checked),select=$(selectedRadio.name.replace('-choice','')),original=select.value;
            radios.find(radio=>!radio.checked).click();await wait(20);
            // WebKit can scroll one pixel when it restores focus to the last summary.
            const closedFits=!group.open&&visibleNode(summary)&&document.activeElement===summary;
            climateFits&&=closedFits;if(!closedFits)climateTrace.push(['closed',summary.textContent,group.open,atmosphere.scrollTop,summaries.map(node=>({text:node.textContent,box:node.getBoundingClientRect().toJSON()}))]);
            select.value=original;select.dispatchEvent(new Event('change'));
          }
          await wait(20);
        }
        menuCopyFits&&=climateFits;menuCopyTrace.push([lang,innerWidth,'atmosphere',climateFits,...(!climateFits?[climateTrace]:[])]);
        $('scene-close').click();
        $('album-button').click();
        for(const book of ['tree','treasure']){const correct=inspectRewardAlbum(book,true);rewardLocaleFits&&=correct;if(!correct)rewardTrace.push([lang,innerWidth,book,'layout-or-copy-failed']);const toggled=inspectConditionsOnly(book);conditionsOnlyFits&&=toggled;}
        $('album-select').value='gift';$('album-select').dispatchEvent(new Event('change'));
        const giftStatus=$('album-dig-status'),giftRule=giftStatus.textContent===localeUi.t('album.gift_rule')&&!giftStatus.hidden&&visibleNode(giftStatus)&&!$('album-odds-button')&&!document.querySelector('.album-chance');
        giftRuleFits&&=giftRule;if(!giftRule)rewardTrace.push(['gift-rule',lang,innerWidth,giftStatus.textContent]);
        $('close-album').click();
        const outsideWorld=$('world').value;$('world').value='studio';$('world').dispatchEvent(new Event('change'));
        $('album-button').click();
        for(const book of ['tree','treasure']){const correct=inspectIndoorRewards(book);indoorRewardFits&&=correct;if(!correct)rewardTrace.push([lang,innerWidth,book,'indoor-odds-or-status-failed']);}
        $('close-album').click();$('world').value=outsideWorld;$('world').dispatchEvent(new Event('change'));


      }
    }
    localeUi.setLanguageForTests('ko');localeUi.apply();
    await L('menuCopy='+(menuCopyFits?'four-locales-fit-small-and-wide':'err:'+JSON.stringify(menuCopyTrace)));
    await L('digRewardLocales='+(rewardLocaleFits?'four-locales-small-wide-hints-status':'err:'+JSON.stringify(rewardTrace)));
    await L('albumConditionsOnly='+(conditionsOnlyFits?'no-numbers-or-toggle-four-locales-small-wide':'err:'+JSON.stringify(rewardTrace)));
    await L('giftAlbumRule='+(giftRuleFits?'every-other-day-four-locales-small-wide':'err:'+JSON.stringify(rewardTrace)));
    await L('digRewardCustom='+(customRewardProof?.correct?'localized-fallback-without-untranslated-key':'err'));
    await L('digRewardCustomDetail='+JSON.stringify(customRewardProof));
    await L('digRewardIndoors='+(indoorRewardFits?'four-locales-small-wide-no-soil-explained':'err:'+JSON.stringify(rewardTrace)));
    let panelFlow=true;const flowTrace=[];const markFlow=step=>flowTrace.push([step,panelFlow]);
    await nativeWindow({...fullAt,width:300,height:210});await wait(200);
    openMenu();await wait(40);
    const destinations=[...document.querySelectorAll('#yard-controls-panel .menu-destination')];
    let primaryFirstView=!document.querySelector('[data-management-tab]')&&destinations.length===3&&destinations.every(visibleNode)&&!$('controls-more');
    for(const id of ['always-on-top','desktop','hide-window','menu-quit']){$(id).scrollIntoView({block:'nearest'});await wait(20);primaryFirstView&&=visibleNode($(id));}
    await L('menuSmall='+(primaryFirstView?'one-page-destinations-and-window':'err'));
    $('close-controls').click();$('scene-button').click();await wait(100);
    panelFlow&&=!$('scene-menu').hidden&&visibleNode($('scene-close'))&&document.activeElement===$('background-gallery').querySelector('[aria-pressed="true"]');
    const weatherDisclosure=document.querySelector('input[name="weather-choice"]').closest('details'),weatherSummary=weatherDisclosure.querySelector('summary');
    const climateSummaries=[...$('scene-body').querySelectorAll('summary')];
    climateSummaries.at(-1).scrollIntoView({block:'nearest'});await wait(40);
    panelFlow&&=climateSummaries.every(visibleNode);
    weatherSummary.click();await wait(80);
    weatherSummary.scrollIntoView({block:'nearest'});
    panelFlow&&=weatherDisclosure.open&&visibleNode(weatherSummary);
    await nativeWindow(fullAt);await wait(100);
    weatherDisclosure.scrollIntoView({block:'nearest'});await wait(40);
    panelFlow&&=weatherDisclosure.open&&[...weatherDisclosure.querySelectorAll('.atmosphere-segments span')].every(visibleNode);
    $('scene-close').click();await wait(40);
    panelFlow&&=$('scene-menu').hidden&&$('yard-controls-panel').hidden;
    markFlow('scene');
    $('yard-controls-toggle').click();
    await nativeWindow({...fullAt,width:300,height:210});await wait(100);
    openMenu();$('menu-invite').click();await wait(100);
    $('invite-filters').open=false;$('panel-invite').scrollTop=0;
    const firstInvite=$('shelf').querySelector('.asset-card');
    if(firstInvite){firstInvite.scrollIntoView({block:'nearest'});await wait(40);panelFlow&&=visibleNode(firstInvite);if(!visibleNode(firstInvite))flowTrace.push(['invite-card',firstInvite.getBoundingClientRect().toJSON(),[innerWidth,innerHeight]]);}
    $('panel-menu').click();await wait(40);
    panelFlow&&=$('side-panel').hidden&&!$('yard-controls-panel').hidden;
    markFlow('invite');
    $('menu-settings').click();await wait(60);
    panelFlow&&=!$('settings-home').hidden;
    document.querySelector('.settings-index [data-section="updates-title"]').click();await wait(60);
    panelFlow&&=!$('update-dialog').hidden&&!$('settings-updates').hidden&&$('settings-home').hidden;
    markFlow('direct-update');
    if(!panelFlow) flowTrace.push(['direct-update-state',{detailsHidden:$('update-dialog').hidden,sectionHidden:$('settings-updates').hidden,homeHidden:$('settings-home').hidden,title:$('panel-title').textContent,note:$('update-note').textContent,pillHidden:$('update-pill').hidden,back:$('panel-menu').getAttribute('aria-label')}]);
    // Back goes one step up: a section to the list, the list to the menu.
    $('panel-menu').click();await wait(40);
    panelFlow&&=!$('side-panel').hidden&&!$('settings-home').hidden;
    document.querySelector('.settings-index [data-section="about-title"]').click();await wait(60);
    panelFlow&&=!$('settings-about').hidden&&$('settings-home').hidden&&visibleNode($('panel-menu'))&&$('settings-content').clientHeight>=40;
    $('panel-menu').click();await wait(40);
    panelFlow&&=!$('settings-home').hidden;
    $('panel-menu').click();await wait(40);
    panelFlow&&=$('side-panel').hidden&&!$('yard-controls-panel').hidden;
    markFlow('about-back');
    $('menu-settings').click();document.querySelector('.settings-index [data-section="about-title"]').click();await wait(60);
    await nativeWindow(fullAt);await wait(100);
    // Widened, the list of sections joins the open section beside it.
    panelFlow&&=!$('settings-about').hidden&&!$('settings-home').hidden&&!$('settings-content').hidden&&document.querySelector('.settings-index [aria-current="page"]')?.dataset.section==='about-title';
    markFlow('settings-widened');
    $('close-panel').click();await playPets.openChat(p1.data.id);
    await nativeWindow({...fullAt,width:300,height:210});await wait(100);
    $('friend-menu-button').scrollIntoView({block:'nearest'});$('friend-menu-button').click();await wait(80);const compactFriendMenu=$('friend-menu').getBoundingClientRect();panelFlow&&=compactFriendMenu.height>=140&&visibleNode($('friend-menu'));$('remove-friend').scrollIntoView({block:'nearest'});await wait(40);panelFlow&&=visibleNode($('remove-friend'));$('friend-menu').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    markFlow('friend-menu');
    $('send').scrollIntoView({block:'end'});await wait(80);panelFlow&&=visibleNode($('send'))&&visibleNode($('close-panel'));
    await nativeWindow(fullAt);await wait(100);panelFlow&&=visibleNode($('send'))&&!$('panel-pet').hidden;
    $('close-panel').click();await L('smallPanelFlow='+(panelFlow?'reachable-and-restored':'err:'+JSON.stringify(flowTrace)));

    await nativeWindow({...fullAt,width:300,height:210});await wait(120);
    document.querySelector('.yard-pet').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}));
    document.querySelector('[data-context-action="play-friend"]').click();await until(()=>!$('play-panel').hidden);
    $('album-button').click();
    await until(()=>$('album-dialog').open);
    $('album-select').value='treasure';$('album-select').dispatchEvent(new Event('change'));
    await wait(80);
    const albumCompact=visibleNode($('album-select'))&&getComputedStyle($('album-tabs')).display==='none'&&$('album-grid').getBoundingClientRect().height>=40&&document.querySelectorAll('.album-card').length===rewardCatalog.TREASURES.length;
    const albumMetrics={select:$('album-select').getBoundingClientRect().toJSON(),tabs:getComputedStyle($('album-tabs')).display,grid:$('album-grid').getBoundingClientRect().toJSON(),cards:document.querySelectorAll('.album-card').length,dialog:$('album-dialog').getBoundingClientRect().toJSON(),viewport:[innerWidth,innerHeight]};
    $('close-album').click();
    await nativeWindow(fullAt);await wait(100);
    await L('albumSmall='+(albumCompact?'chooser-and-scroll':'err:'+JSON.stringify(albumMetrics)));
    await L('windowResize='+(small?'one-responsive-window':'err'));
    // Quitting acts at once (as from the tray and the menu bar), so it is checked by place and name, not pressed.
    openMenu();await wait(30);$('menu-quit').scrollIntoView({block:'nearest'});await wait(20);
    const quitBeside=visibleNode($('menu-quit'))&&$('menu-quit').parentElement===$('hide-window').parentElement&&!$('quit-app');
    await L('windowQuit='+(quitBeside&&(await nativeWindow()).resizable?'beside-close-window':'err'));
    $('yard-controls-panel').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    // Fullscreen returns to the same frame and pin; Escape dismisses the current surface first.
    let fullscreenRestored=true;
    for(const pinned of [false,true]){
      if((await nativeWindow()).alwaysOnTop!==pinned)await $('always-on-top').onclick();
      const normal=await nativeWindow();
      await $('fullscreen').onclick();
      const expanded=await nativeWindow();
      fullscreenRestored&&=expanded.fullscreen&&document.body.classList.contains('fullscreen')&&$('fullscreen').getAttribute('aria-pressed')==='true'&&getComputedStyle(document.querySelector('[data-resize]')).display==='none';
      contextAt();await wait(30);
      $('yard-controls-panel').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
      fullscreenRestored&&=$('yard-controls-panel').hidden&&(await nativeWindow()).fullscreen;
      openSettings('general');await wait(100);
      document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
      fullscreenRestored&&=$('side-panel').hidden&&(await nativeWindow()).fullscreen;
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',cancelable:true}));
      await until(async()=>!$('fullscreen').disabled&&!(await nativeWindow()).fullscreen,15000);
      const returned=await nativeWindow();
      fullscreenRestored&&=sameBounds(normal,returned)&&returned.alwaysOnTop===pinned&&!document.body.classList.contains('fullscreen');
    }
    if((await nativeWindow()).alwaysOnTop)await $('always-on-top').onclick();
    await L('windowFullscreen='+(fullscreenRestored?'bounds-pin-and-escape-restored':'err'));
    worldSelect.value='woodland';worldSelect.dispatchEvent(new Event('change'));
    await (await import('./yard/background-store.js')).removeBackground(imported);
    // A conversation stays inside the current window; a friend nearer the bottom is drawn over one higher up.
    await nativeWindow({...fullAt,width:460,height:320});await until(()=>document.body.classList.contains('compact'));await wait(300);
    document.querySelector('.yard-pet').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}));
    document.querySelector('[data-context-action="play-friend"]').click();
    await until(()=>!$('play-panel').hidden);
    // Play is one page now (Find, Garden, Together), so it may take up to two thirds of a short window.
    const quickRect=$('play-panel').getBoundingClientRect();
    let quickPlayFits=!$('play-panel').hidden&&quickRect.top>=0&&quickRect.right<=innerWidth&&quickRect.height<=innerHeight*0.65;
    await nativeWindow(fullAt);await until(()=>!document.body.classList.contains('compact'));await wait(80);
    quickPlayFits&&=!$('play-panel').hidden&&visibleNode($('play-panel'));
    await nativeWindow({...fullAt,width:460,height:320});await until(()=>document.body.classList.contains('compact'));await wait(80);
    quickPlayFits&&=!$('play-panel').hidden;
    $('close-play').click();openMenu();$('menu-friends').click();
    await until(()=>!$('panel-pet').hidden&&getComputedStyle($('side-panel')).display!=='none');await wait(300);
    $('panel-pet').scrollTop=0;
    const composer=$('message').getBoundingClientRect(),sendBox=$('send').getBoundingClientRect();
    const chatFromSmall=quickPlayFits&&document.body.classList.contains('compact')&&innerWidth<wide&&!$('panel-pet').hidden&&composer.height>0&&composer.bottom<=innerHeight&&sendBox.right<=innerWidth&&sendBox.bottom<=innerHeight;
    // By where the feet are (the bottom), since friends of different sizes have their tops elsewhere.
    const order=[...document.querySelectorAll('.yard-pet')].map(b=>({y:b.getBoundingClientRect().bottom,z:Number(b.style.zIndex)%200}));
    const layered=order.length<2||order.every(a=>order.every(b=>a.y<=b.y-4?a.z<=b.z:true));
    // The garden's things share the friends' depth (no layer of their own), and the labels are above both.
    const z=id=>getComputedStyle($(id)).zIndex,labelsOver=z('garden-layer')==='auto'&&Number(z('label-layer'))>Number(z('pet-layer'))&&$('pet-layer').contains($('garden-layer'))&&document.querySelectorAll('.pet-label').length===document.querySelectorAll('.yard-pet').length;
    await L('reach='+(chatFromSmall?'compact-chat':'err-small:'+JSON.stringify({quickPlayFits,quick:quickRect.toJSON(),viewport:[innerWidth,innerHeight],compact:document.body.classList.contains('compact'),pet:!$('panel-pet').hidden,composer:composer.toJSON(),send:sendBox.toJSON()}))+'/'+(layered?'layered':'err-order')+'/'+(labelsOver?'labels-over':'err-labels'));
    // The name tag says "Talk to …" and opens the conversation; play is on the friend's right-click.
    $('close-panel').click();await until(()=>$('side-panel').hidden);
    await nativeWindow(fullAt);await until(()=>!document.body.classList.contains('compact')&&innerWidth===wide);await wait(200);
    const tag=document.querySelector('.pet-label .pet-tag');
    tag.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true}));tag.dispatchEvent(new PointerEvent('pointerup',{button:0,bubbles:true}));
    await until(()=>!$('panel-pet').hidden);
    const tagChat=!$('panel-pet').hidden&&$('play-panel').hidden;
    $('close-panel').click();await until(()=>$('side-panel').hidden);
    document.querySelector('.yard-pet').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:200,clientY:200}));await wait(40);
    const friendItems=[...$('yard-context-menu').querySelectorAll('[data-context-action]')].filter(item=>!item.hidden).map(item=>item.dataset.contextAction).join(',');
    $('yard-context-menu').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    await L('playTag='+(tagChat&&friendItems==='talk,play-friend,dig-friend'?'tag-talks-right-click-offers-play':'err:'+friendItems));
    // Inviting from the shelf and opening the AI dialog go through the page's own buttons.
    const before=(await playPets.bootstrap()).data.pets.length;
    openMenu();$('menu-invite').click();await until(()=>!$('panel-invite').hidden);
    // A loaded machine (a build running beside the test) can take longer than the usual five seconds here.
    document.querySelector('#shelf .asset-card').click();await until(async()=>{
      const pets=(await playPets.bootstrap()).data.pets;
      return pets.length===before+1&&document.querySelectorAll('.yard-pet').length===pets.length&&$('friend-select').value===pets.at(-1)?.id;
    },15000);
    const after=(await playPets.bootstrap()).data.pets;
    const invited=after.length===before+1&&document.querySelectorAll('.yard-pet').length===after.length&&$('friend-select').value===after.at(-1).id;
    openMenu();$('menu-friends').click();await until(()=>!$('panel-pet').hidden);
    const sharingGuest=await must('sharingGuest',playPets.addPet(a));
    await until(()=>document.querySelectorAll('.yard-pet').length===after.length+1);
    $('friend-select').value=after.at(-1).id;$('friend-select').dispatchEvent(new Event('change'));await wait(150);
    $('configure').click();await until(()=>$('connection-dialog').open);const dialogOpen=$('connection-dialog').open;
    await L('shareConnection='+(!$('share-all-field').hidden&&$('ai-share-all').checked?'on-by-default':'err'));
    $('cancel-dialog').click();
    await playPets.removePet(sharingGuest.data.id);
    await until(()=>document.querySelectorAll('.yard-pet').length===after.length);
    // On a failure, which part: the friend saved, drawn, picked in the Friend tab; the dialog.
    await L('pageButtons='+(invited&&dialogOpen?'invite-and-connect':'err:'+[after.length-before,document.querySelectorAll('.yard-pet').length-after.length,$('friend-select').value===after.at(-1)?.id,dialogOpen].join('/')));
    // A word written to a friend with no AI waits for one: sending opens the connection dialog,
    // picking a kind on its cards and connecting sends the word.
    const guestId=after.at(-1).id;
    $('message').value='처음 인사';$('message').dispatchEvent(new Event('input'));
    const typable=!$('message').disabled&&!$('send').disabled;
    $('chat-form').requestSubmit();await until(()=>$('connection-dialog').open);
    document.querySelector('.ai-type[data-type=ollama] input').click();await wait(100);
    $('ai-endpoint').value='${endpoint}';$('ai-endpoint').dispatchEvent(new Event('change'));$('ai-model').value='flow-model';$('ai-share-all').checked=false;
    $('save-provider').click();
    await until(async()=>((await playPets.getChat(guestId)).data||[]).length>=2,15000);
    const sent=(await playPets.getChat(guestId)).data||[];
    // Starting at login is one switch in Settings (a test run only pretends to the system).
    const {openPanel}=await import('./panel/tabs.js');openPanel('settings','general-title');await until(()=>!$('panel-settings').hidden&&!$('settings-general').hidden);
    $('autostart').click();await until(async()=>(await playPets.bootstrap()).data.autostart===true);
    const startsOn=$('autostart').checked;$('autostart').click();await until(async()=>(await playPets.bootstrap()).data.autostart===false);
    await L('autostart='+(startsOn&&!$('autostart').checked?'switches':'err'));
    openPanel('pet');
    await L('waitingWord='+(typable&&sent[0]?.content==='처음 인사'&&sent.length>=2&&$('message').value===''?'sent-after-connect':'err:'+typable+'/'+JSON.stringify(sent).slice(0,90)));
    // The connection made here goes again, so the checks below count only their own.
    const madeHere=(await playPets.bootstrap()).data.pets.find(q=>q.id===guestId)?.providerId;
    if(madeHere)await playPets.removeProvider(madeHere);
    // Sending a friend away from the friend tab asks first, by name: Cancel keeps everyone, confirming does not.
    const guest=after.at(-1);
    $('remove-friend').click();await until(()=>$('confirm-dialog').open);
    const confirmAsked=$('confirm-dialog').open&&$('confirm-title').textContent.includes(${JSON.stringify(KO['friend.send_away_confirm'].replace(/^\{[^}]*\}\s*/, ''))})&&document.activeElement===$('confirm-cancel');
    $('confirm-cancel').click();await until(()=>!$('confirm-dialog').open);
    const kept=!$('confirm-dialog').open&&(await playPets.bootstrap()).data.pets.some(p=>p.id===guest.id);
    $('remove-friend').click();await until(()=>$('confirm-dialog').open);$('confirm-ok').click();await until(async()=>!(await playPets.bootstrap()).data.pets.some(p=>p.id===guest.id)&&document.querySelectorAll('.yard-pet').length===before);
    const gone=!(await playPets.bootstrap()).data.pets.some(p=>p.id===guest.id)&&document.querySelectorAll('.yard-pet').length===before;
    await L('sendAway='+(confirmAsked&&kept&&gone?'asks-then-removes':'err:'+confirmAsked+'/'+kept+'/'+gone));
    // A coding agent waiting for the person shows in the tray's tooltip (and a mark on the icon).
    await L('ask=waiting');
    await until(async()=>(await playPets.bootstrap()).data.statuses[p2.data.id]?.state==='waiting',8000);
    const trayWait=await until(async()=>{const t=await trayAt();return t.tooltip.includes('둘째')&&t;},5000);
    await L('trayWaiting='+(trayWait&&trayWait.tooltip.includes(${JSON.stringify(TRAY_KO_WAITING)})?'tooltip':'err:'+JSON.stringify(await trayAt())));
    await must('removePet2',playPets.removePet(p2.data.id));
    const snippet=await playPets.copyConnection('claude');
    await L('snippet='+(snippet.ok&&snippet.data.includes('hook claude')&&!snippet.data.includes('node ')?'binary':'err'));
    // An agent can report to a chosen friend: the copied settings then name it.
    await must('assignAgent',playPets.assignAgent('claude',p1.data.id));
    const assigned=await playPets.copyConnection('claude');
    const sel=document.querySelector('select[data-agent=claude]');
    await L('assigned='+(assigned.ok&&assigned.data.includes('--pet')&&assigned.data.includes(p1.data.id)&&sel.value===p1.data.id?'named':'err:'+(assigned.ok?assigned.data.includes('--pet'):assigned.error)+'/'+sel.value));
    await must('unassignAgent',playPets.assignAgent('claude',''));
    // Connect writes the hook into the agent's own file (in a home folder of the test's own) after
    // asking which file; a file it cannot read offers only Copy settings; Disconnect is not asked.
    panelTasks.openPanel('settings','agent-link-title');
    await until(()=>!$('settings-agents').hidden&&!$('agent-connect-claude').hidden);
    const unreadableRow=$('agent-connect-gemini').hidden&&!document.querySelector('[data-link-problem=gemini]').hidden;
    $('agent-connect-claude').click();const connectAsked=!!await until(()=>$('confirm-dialog').open);
    const connectNamesFile=$('confirm-body').textContent.includes('settings.json');
    $('confirm-ok').click();
    const linkedOn=!!await until(()=>!document.querySelector('[data-link-state=claude]').hidden&&$('agent-connect-claude').textContent===${JSON.stringify(KO['settings.disconnect'])});
    const linksOn=(await playPets.agentLinks()).data;
    await L('agentConnected=claude');
    $('agent-connect-claude').click();
    const unlinked=!!await until(async()=>(await playPets.agentLinks()).data.claude==='off'&&document.querySelector('[data-link-state=claude]').hidden);
    await L('agentConnect='+(unreadableRow&&connectAsked&&connectNamesFile&&linkedOn&&linksOn.claude==='on'&&linksOn.gemini==='unreadable'&&unlinked&&!$('confirm-dialog').open?'asks-connects-disconnects':'err:'+JSON.stringify({unreadableRow,connectAsked,connectNamesFile,linkedOn,linksOn,unlinked})));
    $('close-panel').click();
    // Hidden to the tray, the page is told so and rests (WebView2 may not say it through
    // document.hidden); shown again, it moves again.
    await $('hide-window').onclick();const unseen=!!await until(()=>document.documentElement.hasAttribute('data-unseen'));
    await playPets.openChat(p1.data.id);await until(()=>!document.documentElement.hasAttribute('data-unseen'));
    await L('unseen='+unseen+'/'+document.documentElement.hasAttribute('data-unseen'));
    await must('desktopOn',playPets.toggleDesktop());
    await until(async()=>(await playPets.bootstrap()).data.desktopLayout.length>0,8000);
    const b2=await playPets.bootstrap();
    await L('overlayLayout='+b2.data.desktopLayout.length);
    await must('wanderOn',playPets.toggleDesktopWander());
    const trayDesk=await until(async()=>{const t=await trayAt();return t.items.includes('wander:on')&&t;},5000);
    await L('traySwitches='+(trayDesk&&trayDesk.items.includes('friends')&&trayDesk.items.some(i=>i.startsWith('sound:'))&&trayDesk.items.includes('desktop:on')&&trayDesk.items.includes('alwaysOnTop:off')?'checked':'err:'+JSON.stringify(await trayAt())));
    await must('removeProvider',playPets.removeProvider(save.data.id));
    const b3=await playPets.bootstrap();
    await L('detached='+(b3.data.pets[0].providerId===''&&b3.data.providers.length===0));
    await must('desktopOff',playPets.toggleDesktop());
    // Closing the overlay once aborted the whole app a moment later; stay around long enough to notice.
    await new Promise(r=>setTimeout(r,2500));
    await L('overlayClosed=alive');
    // Official entries have ordinary settings and keep their independent identity.
    const aria=adults.find(x=>x.sourceId==='playpets-daisy'),miniAria=boot.data.assets.find(x=>x.sourceId==='playpets-clover');
    const adultA=(await playPets.addPet(aria.id)).data,adultB=(await playPets.addPet(miniAria.id)).data;
    await playPets.openChat(adultA.id);await until(async()=>(await import('./core/state.js')).selected===adultA.id);
    const fullPortrait=await until(()=>$('portrait-photo').hidden);
    await playPets.openChat(adultB.id);await until(async()=>(await import('./core/state.js')).selected===adultB.id);
    const miniPortraitAbsent=!miniAria.portraitUrl&&await until(()=>$('portrait-photo').hidden);
    $('edit-pet').click();await until(()=>$('pet-dialog').open);
    const ordinarySettings=$('pet-appearance').hidden;
    $('pet-name').value='My Mini';$('pet-form').requestSubmit();
    await until(async()=>!$('pet-dialog').open&&(await playPets.bootstrap()).data.pets.find(x=>x.id===adultB.id)?.name==='My Mini');
    const chosen=(await playPets.bootstrap()).data.pets;
    const independent=chosen.find(x=>x.id===adultA.id)?.assetId===aria.id&&chosen.find(x=>x.id===adultB.id)?.assetId===miniAria.id;
    const appearanceCanvas=sprites.canvas();
    await until(()=>{sprites.drawSprite(appearanceCanvas,aria);return painted(appearanceCanvas);});
    await L('illustratedChoice='+(independent&&ordinarySettings&&fullPortrait&&miniPortraitAbsent&&painted(appearanceCanvas)?'ordinary-independent':'err'));
    // Every bundled wardrobe renders authored actions through the real yard canvas.
    $('close-panel').click();
    const companionUi=await import('./core/companion-actions.js'),companionTrips=await import('./yard/trips.js'),companionViews=await import('./yard/views.js');
    await until(()=>st.views.has(adultB.id));
    const cloverView=st.views.get(adultB.id),companionSeason=$('scene-season').value;
    $('scene-season').value='spring';$('scene-season').dispatchEvent(new Event('change'));
    await until(()=>world.scene.season==='spring');
    companionTrips.release(cloverView);companionViews.pose(cloverView,'idle',Infinity);cloverView.nextWander=Infinity;
    const extraCompanions=[];
    for(const id of ['playpets-pip','playpets-miso']){
      const asset=boot.data.assets.find(a=>a.sourceId===id&&a.place==='builtin');
      const pet=(await playPets.addPet(asset.id)).data;extraCompanions.push(pet);
      await until(()=>st.views.has(pet.id));
    }
    const authoredViews=[adultA,adultB,...extraCompanions].map(p=>st.views.get(p.id));
    const sourceIdentities=new Map(authoredViews.map(v=>[v.pet.id,JSON.stringify(v.asset)]));
    const authoredClips=['dig','plant','cast','wait','reel','discover'],authoredTrace=[];
    let authoredOk=true,cancellationOk=true;
    const pixelHash=canvas=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.reduce((sum,value,i)=>(sum+value*((i%29)+1))%2147483647,0);
    for(const shape of [{...fullAt,width:300,height:210},fullAt]){
      await nativeWindow(shape);await until(()=>Math.abs(innerWidth-shape.width)<=1);await wait(80);
      for(const season of ['spring','summer','autumn','winter']){
        $('scene-season').value=season;$('scene-season').dispatchEvent(new Event('change'));
        await until(()=>world.scene.season===season);
        for(const v of authoredViews){
          companionTrips.release(v);companionViews.pose(v,'idle',Infinity);v.nextWander=Infinity;
          const canonicalBox=v.button.getBoundingClientRect(),canonicalHeight=v.canvas.style.height;
          for(const clipName of authoredClips){
            const clip=companionUi.prepareCompanionAction(v.asset,clipName);
            let clipOk=!!clip&&clip.frames.length>=2;
            if(clip){
              const decoded=await until(()=>companionUi.companionImage({clip}),10000);
              const action=companionUi.beginCompanionAction(v,clipName),hashes=[];
              let elapsed=0;
              for(const frame of clip.frames){
                const sampled=companionUi.companionAction(v,action.since+elapsed+frame.duration/2);
                sprites.drawSprite(v.canvas,v.asset,'idle',0,null,sampled);
                hashes.push(pixelHash(v.canvas));elapsed+=frame.duration;
              }
              const after=v.button.getBoundingClientRect(),offset=clip.offset||[0,0];
              const cell=clip.canvas||[192,208],motionFrames=sprites.reduced.matches?1:Math.min(3,clip.frames.length);
              const overscanOk=cell[0]>=192&&cell[0]<=384&&cell[1]>=208&&cell[1]<=416&&clip.frames.every(frame=>frame.rect[2]===cell[0]&&frame.rect[3]===cell[1])&&(!offset.some(Boolean)||(clip.anchor[0]+offset[0]===96&&clip.anchor[1]+offset[1]===199));
              clipOk&&=!!decoded&&new Set(hashes).size>=motionFrames&&v.canvas.width===cell[0]&&v.canvas.height===cell[1]&&v.canvas.style.height===canonicalHeight&&Math.abs(after.width-canonicalBox.width)<1&&Math.abs(after.height-canonicalBox.height)<1&&overscanOk&&v.canvas._pk.includes(':action:');
              const motionDescriptor=Object.getOwnPropertyDescriptor(sprites.reduced,'matches');
              try{
                Object.defineProperty(sprites.reduced,'matches',{configurable:true,value:true});
                sprites.drawSprite(v.canvas,v.asset,'idle',0,null,companionUi.companionAction(v,action.since));
                const stillHash=pixelHash(v.canvas);
                sprites.drawSprite(v.canvas,v.asset,'idle',0,null,companionUi.companionAction(v,action.since+elapsed-1));
                clipOk&&=pixelHash(v.canvas)===stillHash;
              }finally{
                if(motionDescriptor)Object.defineProperty(sprites.reduced,'matches',motionDescriptor);
                else delete sprites.reduced.matches;
              }
              companionUi.clearCompanionAction(v);
              cancellationOk&&=companionUi.companionAction(v,performance.now())===null;
            }
            authoredOk&&=clipOk;authoredTrace.push([innerWidth,season,v.asset.sourceId,clipName,clipOk]);
          }
          const identity=JSON.stringify(v.asset)===sourceIdentities.get(v.pet.id);
          authoredOk&&=identity;
          for(const clipName of authoredClips){
            const importedView={asset:{...fx,displayName:v.asset.displayName,sourceId:v.asset.sourceId},pose:'idle',since:0};
            authoredOk&&=companionUi.beginCompanionAction(importedView,clipName)===null;
          }
        }
      }
    }
    sprites.setSpriteSeason('spring');
    const cancellation=companionUi.beginCompanionAction(cloverView,'wait');
    sprites.setSpriteSeason('winter');
    cancellationOk&&=!!cancellation&&companionUi.companionAction(cloverView,performance.now())===null;
    await until(()=>{sprites.drawSprite(cloverView.canvas,cloverView.asset);return cloverView.canvas.width===192&&cloverView.canvas.height===208&&!cloverView.canvas._pk.includes(':action:')&&pixelHash(cloverView.canvas)>0;});
    const ordinaryBounds=cloverView.canvas.style.scale===''&&cloverView.canvas.style.translate==='';
    $('scene-season').value='spring';$('scene-season').dispatchEvent(new Event('change'));
    await until(()=>world.scene.season==='spring');sprites.setSpriteSeason('spring');
    await L('authoredClips='+(authoredOk&&authoredTrace.length===192&&cancellationOk&&ordinaryBounds?'four-friends-four-seasons-six-clips-small-wide-compatible':'err:'+JSON.stringify({authoredTrace,cancellationOk,ordinaryBounds})));
    // Digging walks to real clear ground, then holds the tool throughout the saved discovery action.
    const digHistory=(await playPets.bootstrap()).data.garden.digs;
    const cloverGround=discoveryPoints.find(point=>digHistory.every(previous=>previous.world!==discoveryWorld||previous.tileX!==Math.floor(point.x*8)||previous.tileY!==Math.floor(point.y*8)));
    if(!cloverGround)throw Error('No fresh Clover discovery ground');
    companionUi.prepareCompanionAction(cloverView.asset,'dig');
    const digAtlas=companionUi.prepareCompanionAction(cloverView.asset,'dig');
    await until(()=>companionUi.companionImage({clip:digAtlas}),10000);
    discoveryFlow.sendDiscovery(cloverView,cloverGround,'dig');
    const walkFirst=!!cloverView.target&&companionUi.companionAction(cloverView,performance.now())===null;
    let cloverArrival=null;
    if(document.visibilityState==='hidden'){const trip=cloverView.trip;cloverView.trip=null;cloverView.target=null;cloverArrival=trip.arrive();}
    const digTrace=[],digTraceAt=performance.now();let lastDigTrace='';
    const authoredStarted=await until(()=>{
      const action=companionUi.companionAction(cloverView,performance.now());
      const effect=document.querySelector('.dig-effect');
      const sample={action:action?.clip.url||null,expected:digAtlas?.url,same:action?.clip===digAtlas,effect:effect?.className||null,target:!!cloverView.target,trip:!!cloverView.trip,doing:!!cloverView.doing,pose:cloverView.pose,away:cloverView.away,asset:cloverView.asset.id,place:cloverView.asset.place,season:world.scene.season};
      const signature=JSON.stringify(sample);if(signature!==lastDigTrace){digTrace.push([Math.round(performance.now()-digTraceAt),sample]);lastDigTrace=signature;}
      return action?.clip===digAtlas&&action;
    },20000);
    const effect=document.querySelector('.dig-effect.authored');
    const toolAttached=!!effect&&!effect.querySelector('svg')&&authoredStarted?.clip.heldTool===true;
    const soilNode=effect?.querySelector('.dig-soil'),soilBackground=soilNode&&getComputedStyle(soilNode).backgroundImage,soilAtlas=new Image();
    if(soilBackground?.startsWith('url('))soilAtlas.src=soilBackground.slice(4,-1).replaceAll('"','');
    const soilDecoded=await until(()=>soilAtlas.complete&&soilAtlas.naturalWidth>0,10000);
    const soilLayer=!!soilNode&&effect.dataset.soil==='base'&&soilBackground.includes('dug-soil.png')&&Number(effect.style.zIndex)<Number(cloverView.button.style.zIndex);
    let soilContact=false;

    const bodyFrames=new Set(),startAt=authoredStarted?.since||performance.now();
    while(companionUi.companionAction(cloverView,performance.now())?.clip===digAtlas&&performance.now()-startAt<digAtlas.frames.reduce((sum,frame)=>sum+frame.duration,0)){
      const sample=companionUi.companionAction(cloverView,performance.now());
      if(sample){sprites.drawSprite(cloverView.canvas,cloverView.asset,'idle',0,null,sample);bodyFrames.add(cloverView.canvas._pk);}
      soilContact||=!!soilNode&&effect.classList.contains('contact')&&Number(getComputedStyle(soilNode).opacity)>0;
      await wait(70);
    }
    const cloverSaved=await until(async()=>(await playPets.bootstrap()).data.garden.digs.length===digHistory.length+1,10000);
    if(cloverArrival)await cloverArrival;
    const cloverClean=await until(()=>!document.querySelector('.dig-effect'));
    await L('authoredDig='+(walkFirst&&authoredStarted&&toolAttached&&bodyFrames.size>=(sprites.reduced.matches?1:4)&&cloverSaved&&cloverClean?'walk-body-tool-save-clean':'err:'+JSON.stringify({walkFirst,started:!!authoredStarted,toolAttached,frames:bodyFrames.size,cloverSaved,cloverClean,digTrace})));
    await L('authoredSoil='+(soilDecoded&&soilLayer&&soilContact&&cloverClean?'decoded-contact-depth-clean':'err:'+JSON.stringify({soilDecoded:!!soilDecoded,soilLayer,soilContact,cloverClean,soilBackground})));
    discoveryFlow.cancelDiscoveryWork();companionTrips.release(cloverView);companionUi.clearCompanionAction(cloverView);
    // A real fishing trip uses the held rod through cast, wait and reel, then saves and clears it.
    await playPets.openChat(adultB.id);await until(()=>st.selected===adultB.id);$('close-panel').click();
    for(const clipName of ['cast','wait','reel','discover']){
      const clip=companionUi.prepareCompanionAction(cloverView.asset,clipName);
      await until(()=>companionUi.companionImage({clip}),10000);
    }
    const authoredFishBefore=await countFish();$('fish-tool').click();
    const fishingWalk=!!cloverView.target&&companionUi.companionAction(cloverView,performance.now())===null;
    if(document.visibilityState==='hidden'&&cloverView.trip){const trip=cloverView.trip;cloverView.trip=null;cloverView.target=null;trip.arrive(cloverView);}
    const authoredField=await import('./yard/field.js'),authoredRod=await import('./yard/fishing-rod.js');
    const heldPhase=async name=>until(()=>{
      const now=performance.now();catchModule.syncFishingArtwork(now);
      const action=companionUi.companionAction(cloverView,now),rod=document.querySelector('.fishing-rod'),line=document.querySelector('.fishing-line path');
      const decoded=companionUi.companionImage(action);
      if(action?.clip!==companionUi.prepareCompanionAction(cloverView.asset,name)||!decoded)return false;
      sprites.drawSprite(cloverView.canvas,cloverView.asset,'idle',0,null,action);
      const tip=authoredRod.authoredRodTip(action,{x:cloverView.px,y:cloverView.py,width:authoredField.sizeOf(cloverView.pet),height:authoredField.petHeight(cloverView.pet)},sprites.reduced.matches);
      return rod?.hasAttribute('hidden')&&getComputedStyle(rod).display==='none'&&tip&&line?.getAttribute('d').startsWith('M'+tip.x+' '+tip.y+'Q')&&cloverView.canvas._sheet===decoded&&cloverView.canvas._pk.includes(':action:');
    },10000);
    const heldCast=await heldPhase('cast'),heldWait=await heldPhase('wait');
    const authoredBite=await until(()=>document.querySelector('.bobber.bite'),12000);
    if(authoredBite)authoredBite.click();
    const heldReel=await heldPhase('reel');
    const authoredFishSaved=await until(async()=>(await countFish())===authoredFishBefore+1,10000);
    const authoredFishClean=await until(()=>!document.querySelector('.bobber')&&!document.querySelector('.fishing-line')&&!document.querySelector('.fishing-rod'),10000);
    await L('authoredFishing='+(fishingWalk&&heldCast&&heldWait&&heldReel&&authoredFishSaved&&authoredFishClean?'walk-held-cast-wait-reel-save-clean':'err:'+JSON.stringify({fishingWalk,heldCast:!!heldCast,heldWait:!!heldWait,heldReel:!!heldReel,authoredFishSaved,authoredFishClean})));
    catchModule.endFishing();companionTrips.release(cloverView);companionUi.clearCompanionAction(cloverView);

    $('scene-season').value=companionSeason;$('scene-season').dispatchEvent(new Event('change'));
    await nativeWindow(fullAt);
    for(const pet of [adultA,adultB,...extraCompanions])await playPets.removePet(pet.id);await playPets.openChat(p1.data.id);

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
    PLAYPETS_E2E_HOME: agentHome,
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
    if (msg === 'agentConnected=claude') connectedFile();
    if (msg === 'ask=waiting')
      spawnSync(binary, ['status', 'waiting', '--pet', '둘째', '--bridge', path.join(dataDir, 'bridge.json')], {
        encoding: 'utf8',
        timeout: 5000,
        env: { ...process.env, PLAYPETS_E2E_EVAL: '' },
      });
  }
});
// While Claude Code is connected: PlayPets' hook sits beside the other one, and the rest is kept.
function connectedFile() {
  try {
    const settings = JSON.parse(readFileSync(claudeSettings, 'utf8'));
    const stop = settings.hooks.Stop.map(group => group.hooks[0].command);
    agentChecks.connected =
      settings.model === 'opus' &&
      stop[0] === 'say done' &&
      stop[1]?.includes(' hook claude --bridge ') &&
      settings.hooks.PreToolUse?.[0]?.matcher === '*' &&
      readFileSync(geminiSettings, 'utf8') === geminiOriginal;
  } catch {
    agentChecks.connected = false;
  }
}
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
const deadline = Date.now() + 240000;
while (!done && Date.now() < deadline) await new Promise(r => setTimeout(r, 200));
child.kill();
provider.closeAllConnections?.();
provider.close();

const expect = [
  [
    /^collectionExtension=aquatic-ground-bugs-gifts-saved-atlases-decoded$/,
    'new aquatic creatures, ground bugs and cute gifts pass native persistence and all extension atlases decode',
  ],
  [/^assets=[1-9]/, 'catalog scan'],
  [
    /^giftCapacity=full-boxed-set-out-record-kept$/,
    'a full 12-gift yard explains capacity, keeps the next gift in the box, frees space without losing its album record and sets the boxed gift out',
  ],
  [
    /^albumConditionsOnly=no-numbers-or-toggle-four-locales-small-wide$/,
    'discovery books show conditions without exact percentages or their control in all locales and sizes',
  ],
  [
    /^giftAlbumRule=every-other-day-four-locales-small-wide$/,
    'the gift album explains how gifts come without a discovery-odds control in every locale and size',
  ],
  [
    /^digRewardCustom=localized-fallback-without-untranslated-key$/,
    'imported scenes show the localized custom-place label rather than an untranslated world key',
  ],
  [
    /^digRewardIndoors=four-locales-small-wide-no-soil-explained$/,
    'indoor tree and treasure albums explain missing soil without misleading zero percentages in every locale and size',
  ],
  [
    /^digRewardLive=weather-updates-open-album$/,
    'changing weather refreshes open album context without switching tabs',
  ],
  [
    /^digRewardContexts=all-places-seasons-weather-ledger-blocked$/,
    'all36 live place, season and weather combinations show habitat conditions and persisted rare waiting status',
  ],
  [
    /^digRewardLocales=four-locales-small-wide-hints-status$/,
    'tree and treasure habitat conditions and rolling rare status fit both sizes in every language',
  ],
  [
    /^digContext=arrival-snapshot-native-bridge$/,
    'a real dig uses arrival conditions and keeps its issued native payload unchanged when weather changes during the action',
  ],
  [
    /^wardrobes=4\/8\/decoded-and-change$/,
    'all four seasonal wardrobes load and repaint with distinct artwork under native security policy',
  ],
  [/^defaultCompanions=4\/official-cast$/, 'the four official companions are available'],
  [/^illustratedAssets=12\/decoded$/, 'illustrated companion wardrobes decode through the native protocol'],
  [
    /^authoredClips=four-friends-four-seasons-six-clips-small-wide-compatible$/,
    'all 192 companion action cases decode and change frames at two native sizes while preserving identity, click bounds and imported fallback',
  ],
  [
    /^authoredDig=walk-body-tool-save-clean$/,
    'Clover walks, animates its body with one held tool and completes a persisted discovery without leftover effects',
  ],
  [
    /^authoredFishing=walk-held-cast-wait-reel-save-clean$/,
    'authored fishing walks, uses one held rod across cast, wait and reel, persists its reward and clears all tackle',
  ],
  [
    /^authoredSoil=decoded-contact-depth-clean$/,
    'the real transparent soil PNG appears on contact behind the paws and clears after the saved discovery',
  ],
  [
    /^weatherSeason=independent-radio-and-render$/,
    'snow preserves the selected spring background and clear weather preserves winter through native radios',
  ],
  [/^illustratedChoice=ordinary-independent$/, 'the friend editor preserves its independent baseline identity'],
  [/^addPet=ok/, 'add a pet'],
  [/^intro=A test kitten\. \(animal\)$/, 'a new friend starts with the pet file description as its personality'],
  [/^rename=ok/, 'rename and resize'],
  [/^saveProvider=ok/, 'save a provider'],
  [/^attach=ok/, 'attach a provider to a pet'],
  [/^assigned=named$/, 'assign a friend to an agent'],
  [/^communities=[1-9]/, 'list of communities'],
  [/^inviteFilters=all-person-restore$/, 'Invite filters survive Settings wiring'],
  [
    /^inviteAppearance=separate-saved-duplicate$/,
    'illustrated companion shelf entries persist independently with numbered duplicates',
  ],
  [/^inviteAtomic=rejected-no-orphans$/, 'invalid or unsupported invitation options add no friend'],
  [/^inviteLegacy=default-illustrated$/, 'legacy invitations keep the illustrated default'],
  [/^inviteDiscovery=collapsed-expandable$/, 'discovery sites start collapsed and can expand'],
  [/^backgroundUpgrade=moved-to-data-folder$/, "an older version's background moves into the data folder"],
  [/^zipImport=copied-once$/, 'a pet ZIP is copied into the data folder once'],
  [/^zipRemove=guarded-removed$/, 'an imported pet leaves the shelf only when no friend uses it'],
  [/^place=codex\/folder-known$/, 'where a pet lives (Codex pet folder)'],
  [/^agentStatus=working$/, 'agent status arrives through the bridge'],
  [/^snippet=binary$/, 'agent setup points at the app binary (no Node)'],
  [
    /^agentConnect=asks-connects-disconnects$/,
    'Connect asks first and writes the hook, an unreadable file offers only Copy settings, Disconnect takes it out',
  ],
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
  [/^chrome=frameless$/, 'the yard has no title-bar controls on any OS'],
  [/^selection=scenery-only$/, 'scenery cannot select text while conversation messages remain selectable'],
  [/^contextFull=clamped-escaped-and-reset$/, 'blank-yard context menu fits, closes and restores the normal anchor'],
  [/^contextSmall=clamped-and-escaped$/, 'small-window context menu fits and restores visible focus'],
  [
    /^windowFullscreen=bounds-pin-and-escape-restored$/,
    'fullscreen restores bounds and pin after Escape dismisses menus and panels',
  ],
  [/^startupNotices=floating-details-and-dismissal$/, 'startup notices retain the yard size and respect dismissal'],
  [/^windowPin=independent-and-synced$/, 'native pin, page and tray agree without changing bounds'],
  [/^panel=toggles\/tasks$/, 'panel tabs open and close, and the Settings index marks the first group when it opens'],
  [/^autoPlay=saved-both-ways$/, 'Let them dig is saved and comes back with the state'],
  [/^settingsScroll=fixed-navigation-single-body$/, 'Settings scrolls one body while its menu and title stay fixed'],
  [/^relation=chip-opens-cards$/, 'the relationship shows in the Friend tab and its chip opens the relationship cards'],
  [/^about=7\/addresses\/notes-hidden$/, "the About section links the app's own pages"],
  [
    /^updateUi=general-title,ai-title,agent-link-title,updates-title,about-title\/ok$/,
    'an update stays at the left of the yard dock before Place, opens Settings update details, and Later puts it away',
  ],
  [/^stage=yard-first$/, 'the yard leads the window (60% of the height or more)'],
  [/^weather=snow-canvas$/, 'weather canvas (snow)'],
  [
    /^seasonChoice=saved-yard-wardrobe-auto$/,
    'season setting updates yard and wardrobe, saves the choice and restores Auto',
  ],
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
  [
    /^discovery=arrival-replay-and-tree$/,
    'friend-led digging commits at arrival, replays safely and saves a visible scene-owned tree',
  ],
  [
    /^albumSmall=chooser-and-scroll$/,
    'small-window collection remains reachable with a single category chooser and visible content scroller',
  ],
  [/^windowResize=one-responsive-window$/, 'one resizable window keeps its controls and native drag boundaries'],
  [
    /^menuCopy=four-locales-fit-small-and-wide$/,
    'four locales keep Play and menu names on one line in wide windows and inside their tiles in small ones',
  ],
  [
    /^smallPanelFlow=reachable-and-restored$/,
    'minimum-size destinations scroll without overlap and retain state when widened',
  ],
  [
    /^menuSmall=one-page-destinations-and-window$/,
    'the small menu is one page: the three destinations show at once and the window actions scroll into view',
  ],
  [/^settingsSmall=body-and-navigation$/, 'small settings retain a usable body and navigation'],
  [
    /^windowQuit=beside-close-window$/,
    'Quit PlayPets sits beside Close window and acts at once, as in the tray and menu bar',
  ],
  [/^lakeAgain=1\/0\/1$/, 'a walk to the lake ends when a game takes the friend, and the lake can be fished again'],
  [
    /^gameCompletion=tag-transfer-and-both-end$/,
    'tag transfers on contact, tag and parade complete, and game effects clear',
  ],
  [
    /^fishingFlow=cast-bite-reward-clean$/,
    'fishing rejects an early reel, saves a bitten fish and removes its float and line',
  ],
  [
    /^worldSwitch=indoor-clean-and-games-outdoor-restored$/,
    'room switching clears fishing and games, disables indoor outdoor activities and restores the woodland',
  ],
  [/^studioLight=four-city-views$/, 'the city studio uses distinct authored art for all four times of day'],
  [
    /^backgroundImport=file-gallery-storage-and-fishing$/,
    'a studio JSON enters the real file input, persists in IndexedDB and supports a small yard and fishing',
  ],
  [
    /^playTag=tag-talks-right-click-offers-play$/,
    "a click on a friend's name tag opens the conversation and its right-click offers talking or play",
  ],
  [/^season=set$/, 'the season and the clock paint the yard'],
  [/^garden=found-planted$/, 'an available seed is planted on the field with the tool and kept'],
  [
    /^album=kept-and-shown$/,
    'a catch is kept in the album (count, biggest fish), nonsense is refused, and the album shows it',
  ],
  [
    /^friendship=80\/1\/hearts\/refused$/,
    'friendship: a day brings so much and no more, a level up shows hearts, nonsense is refused',
  ],
  [
    /^sound=off-on-held$/,
    'yard sounds are on by default, the chip turns them off and on, and the volume is held to 0–100',
  ],
  [/^event=gift-and-label$/, "a seasonal event's gift comes on its days, and the scene label shows the event on now"],
  [
    /^gift=bench-every-other-day-moved-away$/,
    "a friend's gift comes every other day after something done together, is dragged to a new place that is kept, and is put away",
  ],
  [
    /^thanksGift=once-a-level-reached$/,
    'a friend that grew closer brings one gift for a level it reached, and none for one it has not',
  ],
  [
    /^memento=pats-capped-memento-boxed-and-set-out$/,
    "pats bring at most a quarter of a day's worth, and at Very close a friend brings its memento, which goes back into the gift box when put away",
  ],
  [
    /^reach=compact-chat\/layered\/labels-over$/,
    'chat stays in the small window; nearer friends are drawn on top, among the garden things, with labels over all',
  ],
  [/^controlsOverlap=exclusive$/, 'menu and task panel never overlap; onboarding steps aside'],
  [/^quietControls=disclosed-and-restored$/, 'quiet controls open explicitly and return focus after a panel closes'],
  [/^pageFits=true\/true$/, 'the page fits the window (no scroll bars, large and small)'],
  [/^spriteLoads=1536$/, 'pet sprites load under the page security policy'],
  [/^gamesKeepHome=true$/, 'positions during games are not saved'],
  [/^pageButtons=invite-and-connect$/, 'invite and open the AI connection dialog with page buttons'],
  [/^shareConnection=on-by-default$/, 'a new connection includes other unconnected friends by default'],
  [
    /^waitingWord=sent-after-connect$/,
    'a word for a friend with no AI is sent once one is connected from the dialog cards',
  ],
  [/^welcome=starters\/no-toolbar$/, 'an empty yard shows the starter pets to pick'],
  [/^trayEmpty=no-switches$/, 'with no friend the tray menu has no switches for showing friends'],
  [/^trayWaiting=tooltip$/, 'a coding agent waiting for the person shows in the tray tooltip'],
  [/^traySwitches=checked$/, 'the tray shows desktop mode and strolling with check marks'],
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
  ['connected', "Connect adds PlayPets' hook beside the others and keeps the rest of the file"],
]) {
  console.log(agentChecks[key] ? '  ✓' : '  ✖', label);
  if (!agentChecks[key]) failed++;
}
const system = chatRequests[0]?.messages?.[0]?.content || '';
const zipFolder = lines.find(l => l.startsWith('zipFolder='))?.slice('zipFolder='.length) || '';
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
  [
    JSON.stringify(JSON.parse(readFileSync(claudeSettings, 'utf8'))) === JSON.stringify(claudeOriginal) &&
      existsSync(`${claudeSettings}.playpets-backup`) &&
      readFileSync(geminiSettings, 'utf8') === geminiOriginal,
    "Disconnect leaves the agent's settings as they were, with a backup beside them",
  ],
  [
    path.basename(zipFolder).startsWith('zip-e2e-zip-') && !existsSync(zipFolder),
    "a removed ZIP pet's folder is deleted with it",
  ],
]) {
  console.log(ok ? '  ✓' : '  ✖', label);
  if (!ok) failed++;
}
// What was set through the app must be in state.json of the isolated data folder.
try {
  const saved = JSON.parse(await readFile(path.join(dataDir, 'state.json'), 'utf8'));
  const okPersist =
    saved.pets.length === 1 &&
    saved.pets[0].name === '타우리' &&
    saved.pets[0].persona === '반말로 짧게 대답해요.' &&
    typeof saved.scene?.world === 'string' &&
    typeof saved.scene?.season === 'string';
  console.log(okPersist ? '  ✓' : '  ✖', 'state persists (state.json)');
  if (!okPersist) failed++;
} catch {
  console.log('  ✖', 'state persists (state.json)');
  failed++;
}
await rm(dataDir, { recursive: true, force: true });
console.log(failed === 0 ? '\nPASS: tauri e2e' : `\nFAIL: ${failed} checks`);
process.exit(failed === 0 ? 0 : 1);
