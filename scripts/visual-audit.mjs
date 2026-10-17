// Isolated visual fixtures using the real yard modules. Native interaction checks live in e2e.mjs.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'playpets-visual-audit-current'));
await mkdir(out, { recursive: true });
const mime = {
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.html': 'text/html',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const server = http.createServer(async (req, res) => {
  const file = path.resolve(root, `.${decodeURIComponent(new URL(req.url, 'http://localhost').pathname)}`);
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1180, height: 780 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const shots = [];
const spriteSources = [];
try {
  await page.route('**/src/app.js', route => route.fulfill({ body: '', contentType: 'text/javascript' }));
  await page.goto(`http://127.0.0.1:${server.address().port}/src/index.html`);
  await page.evaluate(async () => {
    globalThis.playPets = new Proxy({}, { get: () => async () => ({ ok: true, data: {} }) });
    const state = await import('./core/state.js');
    const { apply } = await import('./core/i18n.js');
    apply();
    const { icons } = await import('./core/icons.js');
    icons();
    for (const id of ['welcome', 'empty-yard', 'next-steps']) document.getElementById(id).hidden = true;
    const { loadContent } = await import('./yard/content.js');
    await loadContent();
    const names = ['daisy', 'clover', 'pip', 'miso'];
    const assets = await Promise.all(
      names.map(async id => {
        const pet = await fetch(`/assets/pets/${id}/pet.json`).then(r => r.json());
        return {
          ...pet,
          id,
          version: 2,
          displayName: id,
          spriteUrl: `/assets/pets/${id}/spritesheet.png`,
          seasonalSpriteUrls: Object.fromEntries(
            Object.entries(pet.seasonalSpritesheets || {}).map(([season, file]) => [
              season,
              `/assets/pets/${id}/${file}`,
            ]),
          ),
        };
      }),
    );
    const { FLOWERS, FISH, BUGS, GIFTS } = await import('./yard/catalog.js');
    const found = kinds => Object.fromEntries(kinds.map(k => [k.id, { count: 2, best: 32.4 }]));
    state.setData({
      pets: names.map((id, i) => ({
        id,
        assetId: id,
        name: id[0].toUpperCase() + id.slice(1),
        size: 150,
        x: (i + 1) / (names.length + 1),
        y: 0.42,
      })),
      assets,
      providers: [],
      agents: [],
      statuses: {},
      busy: [],
      album: { flowers: found(FLOWERS), fish: found(FISH), bugs: found(BUGS) },
      garden: { seeds: 0, plants: [], received: GIFTS.map(k => k.id), decor: [] },
    });
    const { syncViews, setupViews } = await import('./yard/views.js');
    const { setupPlay, gameTap, playGame, judge, endGame } = await import('./yard/play.js');
    const { moveFriends } = await import('./yard/motion.js');
    const { setSpriteSeason, spriteSource } = await import('./core/sprites.js');
    setupViews({ gameTap, select() {}, openChat() {}, patted() {}, resized() {} });
    syncViews();
    setupPlay();
    const { createEasel } = await import('./yard/easel.js');
    const { createScenery } = await import('./yard/scenery.js');
    const { seasonVars, sunAt, PERIOD_MINUTES } = await import('./yard/scene.js');
    const { scene } = await import('./yard/world.js');
    const { worldCaption } = await import('./yard/sky.js');
    const { worldAllows } = await import('./yard/worlds.js');
    const yard = document.getElementById('yard');
    const easel = createEasel(yard, { matches: true });
    const weather = createScenery(document.getElementById('weather-layer'), { matches: false });
    window.auditScene = (season, period, choice, event = null, looks = [], world = 'woodland') => {
      if (!worldAllows(world, 'weather')) choice = 'clear';
      if (!worldAllows(world, 'seasonalEffects')) event = null;
      yard.className = `yard world-${world} season-${season} period-${period} weather-${choice} ${looks.map(l => `look-${l}`).join(' ')}`;
      yard.removeAttribute('style');
      for (const [key, value] of Object.entries(seasonVars(season, period, choice))) yard.style.setProperty(key, value);
      const orb = sunAt(PERIOD_MINUTES[period]);
      yard.style.setProperty('--orb-x', `${orb.x}%`);
      yard.style.setProperty('--orb-y', `${orb.y}%`);
      yard.style.setProperty('--moon-shade', looks.includes('fullmoon') ? '100' : '50');
      Object.assign(scene, { world, season, period, weather: choice, event });
      setSpriteSeason(season);
      moveFriends(window.auditNow ?? performance.now(), 0);
      document.getElementById('scene-caption').textContent = worldCaption(world, period, choice);
      for (const view of state.views.values()) place(view);
      easel.set(scene);
      weather.resize();
      weather.set(period, choice, season, event, world);
      weather.frame(performance.now(), 100);
    };
    window.auditSpriteSources = () =>
      [...state.views.values()].map(view => ({ id: view.asset.id, source: spriteSource(view.asset) }));
    window.auditTick = (steps = 1, dt = 40) => {
      for (let i = 0; i < steps; i++) {
        window.auditNow = (window.auditNow ?? performance.now()) + dt;
        judge(window.auditNow);
        moveFriends(window.auditNow, dt);
        if (state.game) playGame(window.auditNow, dt);
      }
    };
    const { place } = await import('./yard/views.js');
    const { release } = await import('./yard/trips.js');
    window.auditStartGame = kind => {
      endGame();
      state.setSelected('daisy');
      for (const v of state.views.values()) {
        release(v);
        v.x = v.pet.x;
        v.y = v.pet.y;
        v.away = false;
        v.nextWander = Infinity;
        place(v);
      }
      window.auditNow = performance.now();
      document.querySelector(`[data-game="${kind}"]`).onclick();
    };
    // Games advance in fixed steps; wall-clock waits keep their transient feedback visible.
    window.auditGameTick = (steps = 1, dt = 40) => {
      for (let i = 0; i < steps; i++) {
        for (const v of state.views.values()) v.nextWander = Infinity;
        window.auditTick(1, dt);
      }
    };
    // Sprite poses start on the browser clock, even when game travel is stepped ahead.
    window.auditPaintGame = () => moveFriends(performance.now(), 0);
    window.auditGameState = () => ({
      kind: state.game?.kind ?? null,
      target: state.game?.target,
      hidden: [...(state.game?.hidden ?? [])],
      walking: state.game?.walking,
      frozen: [...state.views.values()].filter(v => v.frozen).map(v => v.pet.id),
    });
    window.auditTagCollision = () => {
      const it = state.views.get(state.game.it);
      const runner = [...state.views.values()].find(v => v !== it && v.pet.id !== state.game.safe);
      runner.x = it.x;
      runner.y = it.y;
      place(runner);
      judge(window.auditNow);
    };
    window.auditEndTag = () => {
      window.auditNow = state.game.until;
      window.auditGameTick();
    };
    window.auditScene('summer', 'day', 'clear');
    const { setupAlbum } = await import('./panel/album.js');
    setupAlbum();
    await Promise.all(
      assets.map(async asset => {
        const image = new Image();
        image.src = asset.spriteUrl;
        await image.decode().catch(error => {
          throw new Error(`Cannot decode fixture sprite ${asset.spriteUrl}: ${error.message}`);
        });
      }),
    );
    window.auditTick();
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.auditTick());
  const shot = async name => {
    if (name.startsWith('game-') || name === 'discovery-pat') await page.evaluate(() => window.auditPaintGame());
    await page.evaluate(() => window.auditTick(1, 0));
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    shots.push(name);
    spriteSources.push({ name, sources: await page.evaluate(() => window.auditSpriteSources()) });
  };
  for (const season of ['spring', 'summer', 'autumn', 'winter'])
    for (const period of ['morning', 'day', 'evening', 'night'])
      for (const weather of ['clear', 'rain', 'snow']) {
        await page.evaluate(args => window.auditScene(...args), [season, period, weather]);
        await page.waitForTimeout(120);
        await shot(`${season}-${period}-${weather}`);
      }
  for (const [season, event, looks] of [
    ['spring', 'blossom', []],
    ['summer', 'fireflies', []],
    ['autumn', 'harvest', ['fullmoon']],
    ['winter', 'lights', []],
    ['winter', 'newyear', []],
  ]) {
    await page.evaluate(args => window.auditScene(...args), [season, 'night', 'clear', event, looks]);
    await page.waitForTimeout(120);
    await shot(`event-${event}`);
  }
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const period of ['morning', 'day', 'evening', 'night']) {
      for (const choice of ['clear', 'rain', 'snow']) {
        await page.evaluate(
          args => window.auditScene('winter', args[0], args[1], 'lights', [], 'studio'),
          [period, choice],
        );
        await page.waitForTimeout(400);
        await shot(`studio-${period}-${choice}-${scheme}`);
      }
    }
  }
  for (const [width, height, mini] of [
    [500, 350, true],
    [320, 240, true],
    [1200, 260, true],
    [520, 650, false],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(on => document.body.classList.toggle('mini', on), mini);
    await page.waitForTimeout(300);
    await page.evaluate(() => window.auditTick());
    await shot(`studio-${mini ? 'mini' : 'size'}-${width}-${height}`);
  }
  await page.setViewportSize({ width: 1180, height: 780 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate(() => {
    document.body.classList.remove('mini');
    window.auditScene('summer', 'day', 'clear');
  });
  await page.waitForTimeout(300);
  await page.locator('#album-button').click();
  const selectBook = async book => {
    await page.locator(`[data-book=${book}]`).click();
    await page.locator('.album-tabs').evaluate(async (tabs, expected) => {
      await Promise.all(tabs.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})));
      const selected = tabs.querySelector('[aria-selected="true"]');
      if (
        !selected ||
        selected.dataset.book !== expected ||
        document.getElementById('album-grid').getAttribute('aria-labelledby') !== selected.id
      )
        throw new Error('Album selection and collection label disagree');
    }, book);
  };
  for (const book of ['flower', 'fish', 'bug', 'gift']) {
    await selectBook(book);
    await shot(`album-${book}`);
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  for (const book of ['flower', 'fish', 'bug', 'gift']) {
    await selectBook(book);
    await shot(`album-${book}-dark`);
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.locator('#close-album').click();
  await page.evaluate(() => window.auditScene('spring', 'day', 'clear'));
  for (const [width, height, mini] of [
    [520, 650, false],
    [500, 350, true],
    [320, 240, true],
    [1200, 260, true],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(on => document.body.classList.toggle('mini', on), mini);
    await page.waitForTimeout(300);
    await page.evaluate(() => window.auditTick());
    await shot(`size-${width}-${height}`);
  }
  await page.setViewportSize({ width: 1180, height: 780 });
  await page.evaluate(() => {
    document.body.classList.remove('mini');
    window.auditScene('summer', 'day', 'clear');
  });
  await page.waitForTimeout(300);
  const gameState = () => page.evaluate(() => window.auditGameState());
  const requirePhase = async (matches, description) => {
    const current = await gameState();
    if (!matches(current)) throw new Error(`Game fixture did not reach ${description}: ${JSON.stringify(current)}`);
  };
  const startGame = kind => page.evaluate(kind => window.auditStartGame(kind), kind);
  const tickGame = steps => page.evaluate(steps => window.auditGameTick(steps), steps);
  const findFriend = async id => {
    await page.locator(`.yard-pet[data-id="${id}"]`).click();
    await page.waitForTimeout(100);
  };
  await startGame('hide');
  await tickGame(375);
  await requirePhase(s => s.hidden.length === 3, 'hide spots');
  await shot('game-hide-hidden');
  let hideState = await gameState();
  await findFriend(hideState.hidden.find(id => id !== hideState.target));
  await shot('game-hide-wrong');
  await requirePhase(s => s.target === hideState.target && s.hidden.length === 3, 'unchanged wrong guess');
  await findFriend(hideState.target);
  await requirePhase(s => s.hidden.length === 2, 'first discovery');
  await shot('game-hide-found');
  hideState = await gameState();
  while (hideState.target) {
    await findFriend(hideState.target);
    hideState = await gameState();
  }
  await shot('game-hide-success');
  await page.waitForTimeout(1700);
  await tickGame(100);
  await requirePhase(s => s.kind === null, 'hide completion');
  await shot('game-hide-ended');

  await page.waitForTimeout(5000);
  await startGame('tag');
  await tickGame(2);
  await shot('game-tag-chase');
  await page.evaluate(() => window.auditTagCollision());
  await tickGame(3);
  await requirePhase(s => s.kind === 'tag' && s.frozen.length === 1, 'tag transfer feedback');
  await page.waitForTimeout(100);
  await shot('game-tag-transfer');
  await page.evaluate(() => window.auditEndTag());
  await tickGame(100);
  await requirePhase(s => s.kind === null && !s.frozen.length, 'tag completion');
  await shot('game-tag-ended');

  await page.waitForTimeout(5000);
  await startGame('parade');
  await shot('game-parade-formation');
  await tickGame(150);
  await requirePhase(s => s.kind === 'parade' && s.walking, 'parade lap');
  await shot('game-parade-active');
  await tickGame(700);
  await requirePhase(s => s.kind === null, 'parade completion');
  await shot('game-parade-ended');

  await page.waitForTimeout(5000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startGame('hide');
  await tickGame(1);
  hideState = await gameState();
  await findFriend(hideState.hidden.find(id => id !== hideState.target));
  await shot('game-hide-reduced-wrong');
  const missAnimation = await page.locator('#game-banner').evaluate(el => getComputedStyle(el).animationName);
  if (missAnimation !== 'none') throw new Error('Reduced-motion hide fixture still shakes');
  await findFriend(hideState.target);
  await shot('game-hide-reduced-found');
  await page.waitForTimeout(3000);
  await startGame('parade');
  await tickGame(150);
  await requirePhase(s => s.kind === 'parade' && s.walking, 'reduced-motion parade lap');
  await shot('game-parade-reduced-active');
  await tickGame(700);
  await requirePhase(s => s.kind === null, 'reduced-motion parade completion');
  await shot('game-parade-reduced-ended');

  await page.waitForTimeout(5000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.yard-pet[data-id="daisy"]').click();
  await page.evaluate(async () => {
    // The fixture bridge returns data only; forward the same reaction the native pat emits.
    const { react } = await import('./yard/care.js');
    react({ action: 'pet', petId: 'daisy' });
  });
  await tickGame(1);
  await page.waitForTimeout(100);
  await shot('discovery-pat');
  await page.evaluate(() => window.auditScene('summer', 'evening', 'rain'));
  await page.waitForTimeout(300);
  await shot('ambience-evening-rain');
  const sound = await page.evaluate(async () => {
    const { createSoundscape } = await import('./yard/soundscape.js');
    const { mixFor, CUES } = await import('./yard/soundmix.js');
    const { seeded } = await import('./yard/brush.js');
    const random = Math.random;
    const results = [];
    Math.random = seeded(20261011);
    try {
      for (const season of ['spring', 'summer', 'autumn', 'winter'])
        for (const period of ['morning', 'day', 'evening', 'night'])
          for (const weather of ['clear', 'rain', 'snow']) {
            const ctx = new OfflineAudioContext(2, 3 * 24000, 24000);
            const scape = createSoundscape(ctx, ctx.destination);
            scape.setMix(mixFor({ season, period, weather }));
            scape.setVolume(100, 0, 0.05);
            for (const cue of Object.keys(CUES)) scape.cue(cue, 0.5);
            for (const kind of ['tit', 'trill', 'warble', 'dove']) scape.bird(kind, 0.5, 0, 1);
            scape.splash(0.5);
            scape.plip(0.5);
            scape.lap(0.2);
            scape.gust(0.3);
            scape.chirp(0.5, 4300, -0.5, 0.022);
            scape.chirp(0.5, 4750, 0.55, 0.022);
            scape.drop(0.5, 0.06);
            const buffer = await ctx.startRendering();
            let peak = 0,
              sum = 0,
              finite = true;
            for (let channel = 0; channel < 2; channel++)
              for (const sample of buffer.getChannelData(channel)) {
                finite &&= Number.isFinite(sample);
                peak = Math.max(peak, Math.abs(sample));
                sum += sample * sample;
              }
            results.push({ season, period, weather, peak, rms: Math.sqrt(sum / (buffer.length * 2)), finite });
          }
    } finally {
      Math.random = random;
    }
    return results;
  });
  await writeFile(path.join(out, 'sprite-sources.json'), JSON.stringify(spriteSources, null, 2));
  await writeFile(path.join(out, 'sound-report.json'), JSON.stringify(sound, null, 2));
  if (sound.some(row => !row.finite || row.peak >= 1))
    throw new Error('Audio stress render clipped or contained invalid samples');
  await writeFile(
    path.join(out, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>PlayPets visual fixtures</title><style>body{font:14px system-ui;background:#eef1ee;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:18px}figure{margin:0}img{width:100%;border-radius:12px}figcaption{padding:8px}</style><h1>Rendering fixtures: ${shots.length} scenes</h1><p>Real yard modules with isolated data. Native interaction verification is separate.</p><main>${shots.map(name => `<figure><a href="${name}.png"><img src="${name}.png" loading="lazy"></a><figcaption>${name}</figcaption></figure>`).join('')}</main>`,
  );
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`${shots.length} visual fixtures and ${sound.length} audio stress renders: ${out}/index.html`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
