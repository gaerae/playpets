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
  path.join(here, '../src-tauri/target/e2e', process.platform === 'win32' ? 'playpets.exe' : 'playpets');
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
    await L('welcome='+(!$$('empty-yard').hidden&&!$$('welcome').hidden&&$$('next-steps').hidden&&visibleStarters&&[...document.querySelectorAll('#starter-picks canvas')].every(painted)?'starters':'err')+'/'+(getComputedStyle(document.querySelector('.play-toolbar')).display==='none'?'no-toolbar':'toolbar'));
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
    $('scene-button').click();document.querySelector('.panel-tab[data-panel=settings]').click();
    const controlsClosed=$('yard-controls-panel').hidden&&!$('panel-settings').hidden;
    $('close-panel').click();
    await L('quietControls='+(quietStart&&controlsOpen&&controlsClosed&&document.activeElement===$('yard-controls-toggle')?'disclosed-and-restored':'err'));
    // Blank-yard context controls reuse the normal menu, fit the viewport and reset their anchor.
    const contextAt=()=>{$('yard').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:innerWidth-2,clientY:innerHeight-2}));};
    const contextFits=()=>{const r=$('yard-controls-panel').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;};
    contextAt();await wait(30);
    const menuRect=$('yard-controls-panel').getBoundingClientRect(),dockRect=document.querySelector('.yard-dock').getBoundingClientRect();
    const overlapX=(Math.max(menuRect.left,dockRect.left)+Math.min(menuRect.right,dockRect.right))/2,overlapY=(Math.max(menuRect.top,dockRect.top)+Math.min(menuRect.bottom,dockRect.bottom))/2;
    const contextOnTop=menuRect.right<=dockRect.left||menuRect.bottom<=dockRect.top||$('yard-controls-panel').contains(document.elementFromPoint(overlapX,overlapY));
    const fullContext=!$('yard-controls-panel').hidden&&$('yard-controls-panel').classList.contains('context-open')&&contextFits()&&contextOnTop;
    $('yard-controls-panel').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    const contextEsc=$('yard-controls-panel').hidden&&document.activeElement===$('yard-controls-toggle');
    $('yard-controls-toggle').click();
    const normalAnchor=!$('yard-controls-panel').classList.contains('context-open')&&!$('yard-controls-panel').style.left;
    document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    await L('contextFull='+(fullContext&&contextEsc&&normalAnchor&&$('yard-controls-panel').hidden?'clamped-escaped-and-reset':'err'));
    document.querySelector('.panel-tab[data-panel=invite]').click();
    const welcomeCovered=getComputedStyle($('empty-yard')).display==='none';
    $('yard-controls-toggle').click();
    await L('controlsOverlap='+($('side-panel').hidden&&!$('yard-controls-panel').hidden&&welcomeCovered?'exclusive':'err'));
    $('yard-controls-toggle').click();
    const shown=[];for(const k of ['pet','invite','settings']){document.querySelector('.panel-tab[data-panel='+k+']').click();await until(()=>!$('panel-'+k).hidden);shown.push(['pet','invite','settings'].filter(o=>$('panel-'+o).getBoundingClientRect().height>40).join(','));}
    // Settings wiring runs after Invite; its copy buttons must not replace Invite filters.
    document.querySelector('.panel-tab[data-panel=invite]').click();await until(()=>!$('panel-invite').hidden);
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
    await playPets.openChat(p1.data.id);document.querySelector('.panel-tab[data-panel=invite]').click();await until(()=>!$('panel-invite').hidden);
    $('import').click();await until(()=>$('import-dialog').open);const discovery=$('community-discovery'),discoveryClosed=!discovery.open;
    discovery.querySelector('summary').click();await until(()=>discovery.open);
    await L('inviteDiscovery='+(discoveryClosed&&discovery.open&&document.querySelectorAll('#community-links [data-community-id]').length===boot.data.communities.length?'collapsed-expandable':'err'));
    $('cancel-import').click();document.querySelector('.panel-tab[data-panel=settings]').click();await until(()=>!$('panel-settings').hidden);
    const opened=!$('side-panel').hidden,indexed=document.querySelector('.settings-index [aria-selected=true]')?.dataset.section;
    const settingsWindow=(await window.__TAURI__.core.invoke('call',{name:'e2eWindow',args:['main']})).data;
    await window.__TAURI__.core.invoke('call',{name:'e2eWindow',args:['main',{...settingsWindow,width:840,height:660}]});await until(()=>Math.abs(innerWidth-840)<2);await wait(100);
    const settingsNav=document.querySelector('.settings-index'),settingsHead=$('panel-title'),settingsBody=$('settings-content');
    document.querySelector('.settings-index [data-section=agent-link-title]').click();await wait(150);
    const navTop=settingsNav.getBoundingClientRect().top,headTop=settingsHead.getBoundingClientRect().top;
    settingsBody.scrollTop=settingsBody.scrollHeight;await wait(150);
    const settingsMetrics={scrollTop:settingsBody.scrollTop,scrollHeight:settingsBody.scrollHeight,clientHeight:settingsBody.clientHeight,visible:[...document.querySelectorAll('.settings-section[data-settings-section]')].filter(el=>!el.hidden).length,navShift:settingsNav.getBoundingClientRect().top-navTop,headShift:settingsHead.getBoundingClientRect().top-headTop,outerScroll:$('side-panel').scrollTop};
    const bodyOnly=settingsBody.scrollTop>0&&[...document.querySelectorAll('.settings-section[data-settings-section]')].filter(el=>!el.hidden).length===1&&Math.abs(settingsNav.getBoundingClientRect().top-navTop)<1&&Math.abs(settingsHead.getBoundingClientRect().top-headTop)<1&&$('side-panel').scrollTop===0;
    document.querySelector('.settings-index [data-section=general-title]').click();await wait(150);
    await L('settingsScroll='+(bodyOnly&&settingsBody.scrollTop===0&&!$('settings-general').hidden?'fixed-navigation-single-body':'err:'+JSON.stringify({...settingsMetrics,resetTop:settingsBody.scrollTop,generalHidden:$('settings-general').hidden})));
    $('close-panel').click();
    await window.__TAURI__.core.invoke('call',{name:'e2eWindow',args:['main',settingsWindow]});await until(()=>Math.abs(innerWidth-settingsWindow.width)<2);await wait(100);
    await L('panel='+(opened&&$('side-panel').hidden&&shown.join('|')==='pet|invite|settings'?'toggles':'err:'+shown.join('|'))+'/'+indexed);
    // The relationship shows beside the friend's closeness, and a click on it opens the settings at the relationship cards.
    document.querySelector('.panel-tab[data-panel=pet]').click();await until(()=>!$('panel-pet').hidden);
    const relChip=$('relation-chip').textContent;$('relation-chip').click();await until(()=>$('pet-dialog').open);
    const relFocus=$('pet-dialog').open&&document.activeElement?.name==='relation'&&document.activeElement.value==='partner'&&$('pet-call-me').placeholder===${say('pet.call_me_partner')};
    $('cancel-pet-dialog').click();$('close-panel').click();await until(()=>!$('pet-dialog').open&&$('side-panel').hidden);
    await L('relation='+(relChip===${say('relation.partner')}&&relFocus?'chip-opens-cards':'err:'+relChip+'/'+relFocus));
    // About: the app's own pages, from the addresses the backend reports; "What's new" waits for an update.
    const project=(await playPets.bootstrap()).data.project||{};
    await L('about='+document.querySelectorAll('#panel-settings button[data-link]').length+'/'+(String(project.site).startsWith('https://')&&String(project.repository).startsWith('https://github.com/')?'addresses':'none')+'/'+($('update-notes').hidden?'notes-hidden':'notes-shown'));
    // A new version stays in the yard dock before Place, with the Settings dot as a secondary cue.
    // The button opens the dialog, and Later puts it away while the dot stays. Nothing is installed.
    const sections=[...document.querySelectorAll('#panel-settings .settings-section h3')].map(h=>h.id).join(',');
    const inAbout=!!document.querySelector('.settings-section.about #update-button');
    $('close-panel').click();
    window.__pp('event',{type:'update',update:{version:'9.9.9',notes:''}});await until(()=>!$('update-pill').hidden);
    const tabDot=document.querySelector('.panel-tab[data-panel=settings]').classList.contains('has-update');
    const pillShown=!$('update-pill').hidden&&$('update-pill-label').textContent.includes('v9.9.9')&&$('update-pill').parentElement.classList.contains('yard-dock')&&$('update-pill').parentElement.firstElementChild===$('update-pill')&&getComputedStyle($('update-pill')).display!=='none';
    $('update-pill').click();await until(()=>$('update-dialog').open);
    const updateDialogOpen=$('update-dialog').open&&$('update-title').textContent.includes('v9.9.9');
    $('update-later').click();await until(()=>!$('update-dialog').open);
    const putAway=!$('update-dialog').open&&$('update-pill').hidden&&document.querySelector('.panel-tab[data-panel=settings]').classList.contains('has-update');
    await L('updateUi='+sections+'/'+(inAbout&&tabDot&&pillShown&&updateDialogOpen&&putAway?'ok':'err:'+[inAbout,tabDot,pillShown,updateDialogOpen,putAway].join(',')));
    await L('stage='+($('yard').getBoundingClientRect().height/innerHeight>.6?'yard-first':'small:'+$('yard').getBoundingClientRect().height));
    // The webview retains its last place across isolated backend runs; outdoor checks choose it explicitly.
    $('world').value='woodland';$('world').dispatchEvent(new Event('change'));
    await until(()=>$('yard').classList.contains('world-woodland')&&$('yard').dataset.environment==='illustrated');
    $('weather').value='snow';$('weather').dispatchEvent(new Event('change'));
    await L('weather='+($('yard').classList.contains('weather-snow')&&$('weather-layer').width>0?'snow-canvas':'err'));
    // A saved season changes the actual yard and wardrobe; Auto returns to the real local calendar.
    const priorSeason=localStorage.getItem('season'),seasonRules=await import('./core/season.js'),seasonSprites=await import('./core/sprites.js');
    const seasonalAsset=(await import('./core/state.js')).data.assets.find(a=>a.seasonalSpriteUrls?.summer&&a.seasonalSpriteUrls?.winter);
    const chooseSeason=value=>{$('season').value=value;$('season').dispatchEvent(new Event('change'));};
    chooseSeason('winter');
    const chosenWinter=$('yard').classList.contains('season-winter')&&localStorage.getItem('season')==='winter'&&seasonalAsset&&seasonSprites.spriteSource(seasonalAsset)===seasonalAsset.seasonalSpriteUrls.winter;
    chooseSeason('summer');
    const chosenSummer=$('yard').classList.contains('season-summer')&&localStorage.getItem('season')==='summer'&&seasonalAsset&&seasonSprites.spriteSource(seasonalAsset)===seasonalAsset.seasonalSpriteUrls.summer;
    chooseSeason('auto');
    const calendarSeason=seasonRules.selectedSeason(new Date(),seasonRules.southern(Intl.DateTimeFormat().resolvedOptions().timeZone),'auto');
    const chosenAuto=$('yard').classList.contains('season-'+calendarSeason)&&localStorage.getItem('season')==='auto';
    chooseSeason(['spring','summer','autumn','winter'].includes(priorSeason)?priorSeason:'auto');
    if(priorSeason===null)localStorage.removeItem('season');
    await until(()=>$('yard').dataset.environment==='illustrated');
    await L('seasonChoice='+(chosenWinter&&chosenSummer&&chosenAuto?'saved-yard-wardrobe-auto':'err'));
    // The season colours the yard and the sun or moon stands where the clock puts it.
    const yardStyle=$('yard').style;
    // The garden: a friend's find goes in the pocket, the tool plants it on the field, the backend keeps it.
    await playPets.findSeed();await until(()=>$('seed-count').textContent==='1');
    $('plant-tool').click();const yr=$('yard').getBoundingClientRect();
    $('yard').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:yr.left+yr.width*0.5,clientY:yr.top+yr.height*0.85}));
    await until(()=>document.querySelectorAll('.plant').length===1);
    const gb=(await playPets.bootstrap()).data.garden;
    await L('garden='+(gb.seeds===0&&gb.plants.length===1&&document.querySelector('.plant').dataset.stage==='seed'&&!$('yard').classList.contains('aiming')&&$('plant-tool').getAttribute('aria-disabled')==='true'?'found-planted':'err:'+JSON.stringify(gb)));
    // A gift: the backend picks the first kind and allows one a day; a drag moves it and it stays moved; it can be put away.
    await window.__TAURI__.core.invoke('call',{name:'e2eFreshGifts',args:[]});await until(()=>!document.querySelector('.decor'));
    const gift=(await playPets.receiveGift(0.3,0.2,'2025-01-01')).data;await until(()=>document.querySelectorAll('.decor').length===1);
    const twice=await playPets.receiveGift(0.5,0.5,'2025-01-01');const deco=document.querySelector('.decor'),dr=deco.getBoundingClientRect(),dp={bubbles:true,pointerId:7,button:0,clientX:dr.left+dr.width/2,clientY:dr.bottom-4};
    deco.dispatchEvent(new PointerEvent('pointerdown',dp));deco.dispatchEvent(new PointerEvent('pointermove',{...dp,clientX:dp.clientX+120}));deco.dispatchEvent(new PointerEvent('pointerup',{...dp,clientX:dp.clientX+120}));
    const moved=await until(async()=>(await playPets.bootstrap()).data.garden.decor[0]?.x>0.35);
    await playPets.putAway(gift.id);const away=await until(()=>!document.querySelector('.decor'));
    await L('gift='+(gift.kind==='bench'&&twice.ok===false&&moved&&away&&(await playPets.bootstrap()).data.garden.received[0]==='bench'?'bench-once-moved-away':'err:'+JSON.stringify([gift,twice])));
    // A seasonal event: its gift comes on its days (the backend checks them), and the label beside the scene shows the event on now.
    const snow=(await playPets.receiveGift(0.6,0.3,'2025-12-20','lights')).data;await until(()=>document.querySelectorAll('.decor').length===1);await playPets.putAway(snow.id);
    const {scene:now}=await import('./yard/world.js'),chipOk=$('event-chip').hidden===!now.event&&(!now.event||$('event-chip').textContent.length>0);
    await L('event='+(snow.kind==='snowman'&&chipOk?'gift-and-label':'err:'+JSON.stringify([snow,now.event,$('event-chip').hidden])));
    // The album: a catch is kept (the biggest fish, a count), nonsense is refused, and the album shows it.
    await playPets.catch('fish','carp',41.5);await playPets.catch('fish','carp',33);const tooBig=await playPets.catch('fish','carp',999);
    await until(async()=>(await playPets.bootstrap()).data.album?.fish?.carp?.count===2);
    $('album-button').click();await until(()=>document.querySelectorAll('.album-card').length>0);document.querySelector('.album-tabs [data-book=fish]').click();
    const fishKinds=(await import('./yard/catalog.js')).FISH.length;
    const albumOk=document.querySelectorAll('.album-card').length===fishKinds&&document.querySelector('[data-count=fish]').textContent.endsWith('/'+fishKinds)&&document.querySelectorAll('.album-card:not(.unknown)').length===1&&(await playPets.bootstrap()).data.album.fish.carp.best===41.5&&tooBig.ok===false;
    $('album-dialog').close();
    await L('album='+(albumOk?'kept-and-shown':'err:'+JSON.stringify((await playPets.bootstrap()).data.album)));
    // Friendship: the backend decides what a thing is worth and caps a day; hearts show on the name tag.
    const fid=(await playPets.bootstrap()).data.pets[0].id,p0=(await playPets.bootstrap()).data.bonds?.[fid]?.points||0,bribe=await playPets.befriend(fid,'bribe','2026-01-02');
    let rose=0;for(const day of ['2026-01-02','2026-01-03'])for(let k=0;k<12;k++)rose+=(await playPets.befriend(fid,'gift',day)).data.up?1:0;
    const hearts=await until(()=>document.querySelector('.tag-bond')?.textContent==='♥');
    await L('friendship='+((await playPets.bootstrap()).data.bonds[fid].points-p0)+'/'+rose+'/'+(hearts?'hearts':'none')+'/'+(bribe.ok===false?'refused':'taken'));
    // Yard sounds: on by default; the chip turns them off and on, the volume is kept and held to 0–100.
    // The settings change while the yard stays quiet: the volume goes to 0 before the chip turns it on.
    await playPets.setSound(null,300);const held=(await playPets.bootstrap()).data.sound.volume;await playPets.setSound(null,0);
    $('sound-button').click();const soundOn=await until(async()=>(await playPets.bootstrap()).data.sound.on===true&&$('sound-button').getAttribute('aria-pressed')==='true'&&$('sound-on').checked);
    $('sound-button').click();const soundOff=await until(async()=>(await playPets.bootstrap()).data.sound.on===false&&$('sound-button').getAttribute('aria-pressed')==='false');
    await L('sound='+(soundDefault.on&&soundDefault.volume===40&&held===100&&soundOn&&soundOff?'off-on-held':'err:'+JSON.stringify([soundDefault,held,soundOn,soundOff])));
    await L('season='+(/ season-(spring|summer|autumn|winter)/.test($('yard').className)&&/%$/.test(yardStyle.getPropertyValue('--orb-x'))&&yardStyle.getPropertyValue('--moon-shade')!==''?'set':'err:'+$('yard').className));
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
    const fishSaved=await until(async()=>(await countFish())===fishBefore+1);
    const fishingResult={cast:!!cast,early:!!early,bite:!!bite,saved:!!fishSaved,floatGone:!document.querySelector('.bobber'),lineGone:!document.querySelector('.fishing-line'),card:!$('catch-card').hidden};
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
    const stored=await new Promise((resolve,reject)=>{const request=indexedDB.open('playpets-backgrounds',1);request.onerror=reject;request.onsuccess=()=>{const db=request.result,tx=db.transaction('packs'),row=tx.objectStore('packs').get(imported);row.onsuccess=()=>resolve(row.result?.pack?.name);tx.oncomplete=()=>db.close();};});
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
    const smallContext=!$('yard-controls-panel').hidden&&contextFits()&&['menu-scene','always-on-top'].every(id=>{const r=$(id).getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.right<=innerWidth;});
    const pinTrack=$('always-on-top').querySelector('.wander-switch');
    const pinOffVisual=getComputedStyle(pinTrack,'::after').transform;
    await $('always-on-top').onclick();
    const pinOnVisual=getComputedStyle(pinTrack,'::after').transform;
    const pinOn=await until(async()=>{const w=await nativeWindow();return w.alwaysOnTop&&$('always-on-top').getAttribute('aria-pressed')==='true'&&w;});
    const trayPin=(await trayAt()).items.includes('alwaysOnTop:on');
    await $('always-on-top').onclick();
    const pinOff=await until(async()=>{const w=await nativeWindow();return !w.alwaysOnTop&&$('always-on-top').getAttribute('aria-pressed')==='false'&&w;});
    $('yard-controls-panel').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    const smallContextEsc=$('yard-controls-panel').hidden&&document.activeElement===$('yard');
    await L('contextSmall='+(smallContext&&smallContextEsc?'clamped-and-escaped':'err'));
    await L('windowPin='+(pinOn&&pinOff&&trayPin&&pinOnVisual!==pinOffVisual&&sameBounds(compactAt,pinOn)&&sameBounds(compactAt,pinOff)?'independent-and-synced':'err:'+JSON.stringify({compactAt,pinOn,pinOff,trayPin,ui:$('always-on-top').getAttribute('aria-pressed')})));
    const small=document.body.classList.contains('compact')&&compactAt.resizable&&getComputedStyle($('window-drag')).display!=='none'&&document.querySelectorAll('[data-resize]').length===8&&!document.querySelector('#mini,#unmini');
    document.querySelector('.panel-tab[data-panel=settings]').click();await wait(100);
    const settingsSmall=$('settings-content').getBoundingClientRect().height>30&&$('settings-section').getBoundingClientRect().height>0&&$('side-panel').getBoundingClientRect().bottom<=innerHeight;
    $('close-panel').click();await L('settingsSmall='+(settingsSmall?'body-and-navigation':'err'));
    await nativeWindow(fullAt);await until(()=>!document.body.classList.contains('compact')&&innerWidth===wide);
    await L('pageFits='+fitsFull+'/'+fitsSmall);
    // Every destination remains navigable at the minimum size and retains its state when widened.
    const visibleNode=node=>{const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;};
    let panelFlow=true;
    await nativeWindow({...fullAt,width:300,height:210});await wait(200);
    $('yard-controls-toggle').click();$('menu-scene').click();await wait(100);
    panelFlow&&=!$('scene-menu').hidden&&!$('scene-places').hidden&&$('scene-atmosphere').hidden&&visibleNode($('scene-back'))&&document.activeElement===$('background-gallery').querySelector('[aria-pressed="true"]');
    $('scene-atmosphere-tab').click();
    panelFlow&&=$('scene-places').hidden&&!$('scene-atmosphere').hidden;
    $('weather').scrollIntoView({block:'end'});await wait(80);
    panelFlow&&=visibleNode($('weather'));
    await nativeWindow(fullAt);await wait(100);
    panelFlow&&=!$('scene-atmosphere').hidden&&visibleNode($('weather'));
    $('scene-back').click();await wait(40);
    panelFlow&&=$('scene-menu').hidden&&!$('yard-controls-panel').hidden;
    await nativeWindow({...fullAt,width:300,height:210});await wait(100);
    document.querySelector('.panel-tab[data-panel=invite]').click();await wait(100);
    $('invite-filters').open=false;$('panel-invite').scrollTop=0;
    const firstInvite=$('shelf').querySelector('.asset-card');
    if(firstInvite){firstInvite.scrollIntoView({block:'nearest'});await wait(40);panelFlow&&=visibleNode(firstInvite);}
    $('panel-menu').click();await wait(40);
    panelFlow&&=$('side-panel').hidden&&!$('yard-controls-panel').hidden;
    document.querySelector('.panel-tab[data-panel=settings]').click();await wait(60);
    $('settings-section').value='about-title';$('settings-section').dispatchEvent(new Event('change'));await wait(60);
    panelFlow&&=!$('settings-about').hidden&&visibleNode($('settings-section'))&&$('settings-content').clientHeight>=40;
    await nativeWindow(fullAt);await wait(100);
    panelFlow&&=!$('settings-about').hidden&&getComputedStyle(document.querySelector('.settings-index')).display!=='none'&&getComputedStyle($('settings-section')).display==='none';
    $('close-panel').click();await playPets.openChat(p1.data.id);
    await nativeWindow({...fullAt,width:300,height:210});await wait(100);
    $('friend-menu-button').scrollIntoView({block:'nearest'});$('friend-menu-button').click();await wait(80);const compactFriendMenu=$('friend-menu').getBoundingClientRect();panelFlow&&=compactFriendMenu.height>=140&&visibleNode($('friend-menu'));$('remove-friend').scrollIntoView({block:'nearest'});await wait(40);panelFlow&&=visibleNode($('remove-friend'));$('friend-menu').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    $('send').scrollIntoView({block:'end'});await wait(80);panelFlow&&=visibleNode($('send'))&&visibleNode($('close-panel'));
    await nativeWindow(fullAt);await wait(100);panelFlow&&=visibleNode($('send'))&&!$('panel-pet').hidden;
    $('close-panel').click();await L('smallPanelFlow='+(panelFlow?'reachable-and-restored':'err'));

    await L('windowResize='+(small?'one-responsive-window':'err'));
    contextAt();await wait(30);$('menu-quit').click();
    const quitAsked=await until(()=>$('confirm-dialog').open&&document.activeElement===$('confirm-cancel'));
    $('confirm-cancel').click();await until(()=>!$('confirm-dialog').open);
    await L('windowQuit='+(quitAsked&&(await nativeWindow()).resizable?'confirmed-and-cancellable':'err'));
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
      document.querySelector('.panel-tab[data-panel=settings]').click();await wait(100);
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
    await until(()=>!$('panel-pet').hidden&&getComputedStyle($('side-panel')).display!=='none');await wait(300);
    $('panel-pet').scrollTop=0;
    const composer=$('message').getBoundingClientRect(),sendBox=$('send').getBoundingClientRect();
    const chatFromSmall=document.body.classList.contains('compact')&&innerWidth<wide&&!$('panel-pet').hidden&&composer.height>0&&composer.bottom<=innerHeight&&sendBox.right<=innerWidth&&sendBox.bottom<=innerHeight;
    // By where the feet are (the bottom), since friends of different sizes have their tops elsewhere.
    const order=[...document.querySelectorAll('.yard-pet')].map(b=>({y:b.getBoundingClientRect().bottom,z:Number(b.style.zIndex)%200}));
    const layered=order.length<2||order.every(a=>order.every(b=>a.y<=b.y-4?a.z<=b.z:true));
    // The garden's things share the friends' depth (no layer of their own), and the labels are above both.
    const z=id=>getComputedStyle($(id)).zIndex,labelsOver=z('garden-layer')==='auto'&&Number(z('label-layer'))>Number(z('pet-layer'))&&$('pet-layer').contains($('garden-layer'))&&document.querySelectorAll('.pet-label').length===document.querySelectorAll('.yard-pet').length;
    await L('reach='+(chatFromSmall?'compact-chat':'err-small')+'/'+(layered?'layered':'err-order')+'/'+(labelsOver?'labels-over':'err-labels'));
    // A friend's name tag is the way to talk: a click on it (not a drag) opens the conversation.
    $('close-panel').click();await until(()=>$('side-panel').hidden);
    await nativeWindow(fullAt);await until(()=>!document.body.classList.contains('compact')&&innerWidth===wide);await wait(200);
    const tag=document.querySelector('.pet-label .pet-tag');
    tag.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true}));tag.dispatchEvent(new PointerEvent('pointerup',{button:0,bubbles:true}));
    await until(()=>!$('side-panel').hidden&&!$('panel-pet').hidden);
    await L('talkTag='+(!$('side-panel').hidden&&!$('panel-pet').hidden?'opens-chat':'err'));
    // Inviting from the shelf and opening the AI dialog go through the page's own buttons.
    const before=(await playPets.bootstrap()).data.pets.length;
    document.querySelector('.panel-tab[data-panel=invite]').click();await until(()=>!$('panel-invite').hidden);
    // A loaded machine (a build running beside the test) can take longer than the usual five seconds here.
    document.querySelector('#shelf .asset-card').click();await until(async()=>{
      const pets=(await playPets.bootstrap()).data.pets;
      return pets.length===before+1&&document.querySelectorAll('.yard-pet').length===pets.length&&$('friend-select').value===pets.at(-1)?.id;
    },15000);
    const after=(await playPets.bootstrap()).data.pets;
    const invited=after.length===before+1&&document.querySelectorAll('.yard-pet').length===after.length&&$('friend-select').value===after.at(-1).id;
    document.querySelector('.panel-tab[data-panel=pet]').click();await until(()=>!$('panel-pet').hidden);
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
    await playPets.removePet(adultA.id);await playPets.removePet(adultB.id);await playPets.openChat(p1.data.id);

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
    if (msg === 'ask=waiting')
      spawnSync(binary, ['status', 'waiting', '--pet', '둘째', '--bridge', path.join(dataDir, 'bridge.json')], {
        encoding: 'utf8',
        timeout: 5000,
        env: { ...process.env, PLAYPETS_E2E_EVAL: '' },
      });
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
  [
    /^wardrobes=4\/8\/decoded-and-change$/,
    'all four seasonal wardrobes load and repaint with distinct artwork under native security policy',
  ],
  [/^defaultCompanions=4\/official-cast$/, 'the four official companions are available'],
  [/^illustratedAssets=12\/decoded$/, 'illustrated companion wardrobes decode through the native protocol'],
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
  [
    /^panel=toggles\/general-title$/,
    'panel tabs open and close, and the Settings index marks the first group when it opens',
  ],
  [/^settingsScroll=fixed-navigation-single-body$/, 'Settings scrolls one body while its menu and title stay fixed'],
  [/^relation=chip-opens-cards$/, 'the relationship shows in the Friend tab and its chip opens the relationship cards'],
  [/^about=6\/addresses\/notes-hidden$/, "the About section links the app's own pages"],
  [
    /^updateUi=general-title,yard-settings-title,agent-link-title,about-title\/ok$/,
    'an update stays at the left of the yard dock before Place, opens its dialog, and Later puts it away',
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
  [/^windowResize=one-responsive-window$/, 'one resizable window keeps its controls and native drag boundaries'],
  [
    /^smallPanelFlow=reachable-and-restored$/,
    'minimum-size destinations scroll without overlap and retain state when widened',
  ],
  [/^settingsSmall=body-and-navigation$/, 'small settings retain a usable body and navigation'],
  [/^windowQuit=confirmed-and-cancellable$/, 'the shared quit action confirms and Cancel keeps the app alive'],
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
  [/^talkTag=opens-chat$/, "a click on a friend's name tag opens the conversation"],
  [/^season=set$/, 'the season and the clock paint the yard'],
  [/^garden=found-planted$/, 'a found seed is planted on the field with the tool and kept'],
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
  [/^gift=bench-once-moved-away$/, 'a gift comes once a day, is dragged to a new place that is kept, and is put away'],
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
