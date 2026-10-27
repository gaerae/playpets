import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = file => readFileSync(file, 'utf8');
test('landing introduces every built-in companion before optional AI and coding', () => {
  const landing = read('website/.vitepress/theme/Landing.vue');
  assert.ok(landing.indexOf('<PetGallery') < landing.indexOf('class="connections"'));
  assert.ok(landing.indexOf('class="connections"') < landing.indexOf('class="developer-note"'));
  assert.match(landing, /<details class="developer-note"/);
  assert.doesNotMatch(landing, /class="terminal"/);
  assert.doesNotMatch(landing, /const copy =|const worldCopy =/);
  const gallery = read('website/.vitepress/theme/PetGallery.vue');
  assert.match(gallery, /LANDING_PETS/);
  assert.match(gallery, /:aria-pressed="selected.id === pet.id"/);
  assert.match(gallery, /VisibleSprite/);
  assert.match(gallery, /idle.*wave.*jump/s);
  assert.match(gallery, /observer\?\.disconnect/);
  assert.match(gallery, /preview-paused.*portraitVisible/);
  assert.match(gallery, /:state="selected.id === pet.id \? pose : 'idle'"/);
  assert.match(gallery, /class="pet-portrait pet-shelf"/);
  assert.doesNotMatch(gallery, /:pet="selected.id"/);
  assert.match(read('website/.vitepress/theme/landing.css'), /\.preview-paused \.sprite i[\s\S]*animation: none/);
});

test('the landing lets visitors play a chat and a coding session instead of looking at captures', async () => {
  const landing = read('website/.vitepress/theme/Landing.vue');
  assert.ok(landing.indexOf('<PetGallery') < landing.indexOf('class="together-story'));
  assert.ok(landing.indexOf('class="connections"') < landing.indexOf('class="work-story'));
  assert.ok(landing.indexOf('class="together-story') < landing.indexOf('<ChatDemo'));
  assert.ok(landing.indexOf('class="work-story') < landing.indexOf('<AgentDemo'));
  assert.doesNotMatch(landing, /shotUrl\('(yard-talk|desktop)'\)/);
  assert.match(landing, /path\('\/guide\/desktop'\)/);
  // The install command follows the visitor's system, inside the download block.
  assert.match(landing, /<Downloads>/);
  assert.doesNotMatch(landing, /brew-line/);
  for (const lang of ['en', 'ko', 'ja', 'zh-hans']) {
    const { sections } = await import(`../website/.vitepress/theme/landing-${lang}.ts`);
    assert.equal(sections.heroFacts.length, 3, lang);
    for (const key of ['togetherTitle', 'togetherBody', 'workTitle', 'workBody', 'workNote', 'heroAgents'])
      assert.ok(sections[key]?.length, `${lang}: ${key}`);
  }
});

test('the first screen names the coding agents and every question on the landing has an answer', async () => {
  const landing = read('website/.vitepress/theme/Landing.vue');
  assert.match(landing, /class="hero-agents" :href="path\('\/guide\/agents'\)"/);
  assert.ok(landing.indexOf('class="hero-agents"') < landing.indexOf('<WorldPreview'));
  assert.match(landing, /t\.discovery \}\} <a :href="path\('\/guide\/import'\)">\{\{ t\.discoveryLink \}\}/);
  // A phone gets the small chat window, whose words stay readable at that width.
  assert.match(landing, /<source media="\(max-width: 640px\)" :srcset="shotUrl\('mini-chat'\)"/);
  for (const lang of ['en', 'ko', 'ja', 'zh-hans']) {
    const { worldCopy } = await import(`../website/.vitepress/theme/landing-${lang}.ts`);
    assert.ok(worldCopy.discoveryLink?.length, lang);
  }
});

test('every landing makes download a primary destination in the nav and hero', async () => {
  const config = read('website/.vitepress/config.mts');
  for (const [label, link] of [
    ['Download', '/#download'],
    ['다운로드', '/ko/#download'],
    ['ダウンロード', '/ja/#download'],
    ['下载', '/zh-hans/#download'],
  ])
    assert.ok(config.includes(`{ text: '${label}', link: '${link}'`), `${label}: ${link}`);
  const landing = read('website/.vitepress/theme/Landing.vue');
  assert.match(landing, /href="#download">\{\{ t\.download \}\}/);
  for (const lang of ['en', 'ko', 'ja', 'zh-hans']) {
    const { copy } = await import(`../website/.vitepress/theme/landing-${lang}.ts`);
    assert.equal(typeof copy.download, 'string', lang);
    assert.ok(copy.download.length > 2, lang);
  }
  const words = read('website/.vitepress/theme/words.ts');
  assert.match(words, /download: 'Download PlayPets'/);
  assert.match(read('website/.vitepress/theme/Downloads.vue'), /\{\{ words\.download \}\}/);
  assert.match(read('website/.vitepress/theme/index.ts'), /setupSiteLocale\(\{ base \}\)/);
});

test('the landing offers four places, outdoor seasons and an explicitly labelled interactive sample', async () => {
  const locales = await Promise.all(
    ['en', 'ko', 'ja', 'zh-hans'].map(lang => import(`../website/.vitepress/theme/landing-${lang}.ts`)),
  );
  for (const { worldCopy } of locales) {
    assert.equal(worldCopy.places.length, 4);
    assert.equal(worldCopy.seasons.length, 4);
    assert.ok(worldCopy.previewNote && worldCopy.greet && worldCopy.seasonLabel);
    assert.deepEqual(Object.keys(worldCopy.greetings).sort(), ['clover', 'daisy', 'miso', 'pip']);
  }
  const preview = read('website/.vitepress/theme/WorldPreview.vue');
  assert.match(preview, /:aria-pressed=/);
  // Indoors has no season, so the season choices stay in place but cannot be pressed.
  assert.match(preview, /:disabled="place === 3"/);
  assert.doesNotMatch(preview, /v-if="place !== 3"/);
  assert.match(preview, /IntersectionObserver/);
  assert.match(preview, /observer\?\.disconnect/);
  assert.match(preview, /clearTimeout\(greetingTimer\)/);
  assert.doesNotMatch(preview, /setInterval/);
});
test('a friend keeps its pose until the next one is decoded, and the scene warms its moving rows', () => {
  const sprite = read('website/.vitepress/theme/Sprite.vue');
  assert.match(sprite, /whenDecoded\(/);
  assert.match(sprite, /:style="shown\.style"/);
  const preview = read('website/.vitepress/theme/WorldPreview.vue');
  assert.match(preview, /whenDecoded\(sheetFor\(/);
  for (const state of ['right', 'left', 'look-0', 'look-1']) assert.match(preview, new RegExp(`'${state}'`));
});

test('every choice on the landing uses one control, and the scene keeps its choices in one dock', () => {
  const preview = read('website/.vitepress/theme/WorldPreview.vue');
  assert.match(preview, /class="world-dock"/);
  assert.equal(preview.match(/class="choice-group/g)?.length, 3);
  assert.ok(preview.indexOf('class="living-world"') < preview.indexOf('class="world-dock"'));
  assert.match(read('website/.vitepress/theme/PetGallery.vue'), /class="choice-group/);
  const css = read('website/.vitepress/theme/landing.css');
  assert.match(css, /\.choice-group button\[aria-pressed="true"\]/);
  for (const old of ['.scene-choices', '.season-choices', '.world-console', '.world-greeting'])
    assert.ok(!css.includes(old), old);
  // A chosen pose stays chosen, as in the gallery; only a tap on a friend is a short greeting.
  assert.match(preview, /:aria-pressed="held === state" @click="hold\(state\)"/);
  // Phone-sized touch targets for every chip and the pause button.
  assert.match(css, /\.choice-group button,\s*\.world-motion \{\s*min-height: 44px;/);
});

test('sprite previews preserve their space and load only when visible', () => {
  const preview = read('website/.vitepress/theme/VisibleSprite.vue');
  assert.match(preview, /whenVisible/);
  assert.match(preview, /v-if="loaded"/);
  assert.match(preview, /onBeforeUnmount/);
});

test('landing connection and gallery copy has the same contract in every language', async () => {
  const { SITE_LANGS, LANDING_PETS } = await import('../scripts/site-content.mjs');
  const sections = Object.fromEntries(
    await Promise.all(
      SITE_LANGS.map(async lang => [lang, (await import(`../website/.vitepress/theme/landing-${lang}.ts`)).sections]),
    ),
  );
  assert.equal(LANDING_PETS.length, 4);
  assert.deepEqual(
    LANDING_PETS.map(pet => pet.displayName),
    ['Daisy', 'Clover', 'Pip', 'Miso'],
  );
  for (const lang of SITE_LANGS) {
    assert.deepEqual(Object.keys(sections[lang]).sort(), Object.keys(sections.en).sort(), lang);
    assert.deepEqual(Object.keys(sections[lang].petNotes).sort(), LANDING_PETS.map(pet => pet.id).sort(), lang);
    assert.equal(sections[lang].poses.length, 3, lang);
    assert.equal(sections[lang].connections.length, 2, lang);
    assert.deepEqual(
      sections[lang].connections.map(option => option[2]),
      ['/guide/play', '/guide/chat'],
    );
  }
});

test('localized landing data has one active contract without removed feature tables', async () => {
  const locales = await Promise.all(
    ['en', 'ko', 'ja', 'zh-hans'].map(lang => import(`../website/.vitepress/theme/landing-${lang}.ts`)),
  );
  for (const locale of locales) {
    // Every language file has the same exports, so Landing.vue reads them all the same way.
    assert.deepEqual(Object.keys(locale).sort(), ['copy', 'sections', 'worldCopy']);
    const { copy, worldCopy } = locale;
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(locales[0].copy).sort());
    assert.deepEqual(Object.keys(worldCopy).sort(), Object.keys(locales[0].worldCopy).sort());
    for (const key of ['why', 'diff', 'how', 'states', 'agents', 'features', 'title', 'lead', 'scene'])
      assert.equal(key in copy, false, key);
    assert.equal(typeof copy.chatAlt, 'string');
    assert.ok(copy.chatAlt.length);
    assert.equal(typeof copy.releaseTitle('0.1.0'), 'string');
    assert.equal(typeof worldCopy.sceneCaption('0.1.0'), 'string');
  }
});

test('every landing companion leads to its own creator kit', async () => {
  const { LANDING_PETS } = await import('../scripts/site-content.mjs');
  const { kitEntries } = await import('../scripts/creator-specs.mjs');
  for (const pet of LANDING_PETS) {
    assert.ok(pet.kit, `${pet.id} has a creator destination`);
    assert.ok(
      kitEntries.some(kit => kit.id === pet.kit),
      pet.kit,
    );
  }
  const gallery = read('website/.vitepress/theme/PetGallery.vue');
  assert.match(gallery, /selected\.kit/);
  assert.match(gallery, /words\.galleryCreate/);
});

test('landing groups preserve the four-friend order and normalize the approved idle silhouettes', async () => {
  const { castHeightFactor } = await import('../website/.vitepress/theme/site-runtime.mjs');
  for (const [pet, height] of [
    ['daisy', 326],
    ['clover', 337],
    ['pip', 329],
    ['miso', 325],
  ])
    assert.ok(Math.abs(height * castHeightFactor(pet) - 326) < 0.001);
  for (const file of ['Landing.vue', 'PetGallery.vue', 'WorldPreview.vue'])
    assert.match(read(`website/.vitepress/theme/${file}`), /equal-height/);
});

test('the sunny landing uses the shared four-friend cast and direct motion controls', () => {
  const preview = read('website/.vitepress/theme/WorldPreview.vue');
  assert.match(preview, /LANDING_PETS/);
  assert.match(preview, /const season = ref\(0\)/);
  assert.match(preview, /words\.poses/);
  assert.match(preview, /aria-live="polite"/);
  assert.match(preview, /document\.hidden/);
  const landing = read('website/.vitepress/theme/Landing.vue');
  assert.match(landing, /LANDING_PETS/);
  assert.doesNotMatch(landing, /\['daisy', 'clover', 'pip'\]/);
});

test('every first-friend guide introduces all four characters without promising fixed AI behavior', () => {
  for (const lang of ['', '/ko', '/ja', '/zh-hans']) {
    const guide = read(`website${lang}/guide/first-friend.md`);
    assert.match(guide, /id="companion-stories"/);
    for (const pet of ['Daisy', 'Clover', 'Pip', 'Miso']) assert.match(guide, new RegExp(`### ${pet}`));
  }
});

const backendAgentStrings = lang => {
  const file = read(`src-tauri/src/i18n/${lang.replace('-', '_')}.rs`);
  return Object.fromEntries([...file.matchAll(/\("agent\.(\w+)", "([^"]*)"\)/g)].map(([, key, text]) => [key, text]));
};

test('the chat and coding demos say the same things in every language, in the app’s own words', async () => {
  const { SITE_LANGS, LANDING_PETS } = await import('../scripts/site-content.mjs');
  const ids = LANDING_PETS.map(pet => pet.id);
  const en = (await import('../website/.vitepress/theme/landing-en.ts')).sections;
  for (const lang of SITE_LANGS) {
    const { sections } = await import(`../website/.vitepress/theme/landing-${lang}.ts`);
    for (const key of [
      'chatPlay',
      'chatAgain',
      'chatNote',
      'agentLabel',
      'agentPlay',
      'agentReplay',
      'agentAllow',
      'agentPrompt',
      'agentReply',
      'agentNote',
    ])
      assert.ok(sections[key]?.length, `${lang}: ${key}`);
    assert.match(sections.agentAsk, /\{name\}/, lang);
    // Every language plays the same scenes, with the same friend speaking on each line.
    assert.equal(sections.chats.length, 3, lang);
    assert.deepEqual(
      sections.chats.map(scene => scene.map(([speaker]) => speaker)),
      en.chats.map(scene => scene.map(([speaker]) => speaker)),
      lang,
    );
    for (const scene of sections.chats) {
      assert.equal(new Set(scene.map(([speaker]) => speaker)).size, 2, lang);
      for (const [speaker, line] of scene)
        assert.ok(ids.includes(speaker) && line.length && line.length < 40, `${lang}: ${line}`);
    }
    // A friend's status bubble is exactly what the app shows for that hook event.
    const app = backendAgentStrings(lang);
    for (const [key, text] of Object.entries(sections.agentStatus)) assert.equal(text, app[key], `${lang}: ${key}`);
  }
});

test('each coding demo replays the events that agent really reports', async () => {
  const { AGENT_DEMOS } = await import('../website/.vitepress/theme/agent-demo.mjs');
  const { LANDING_PETS } = await import('../scripts/site-content.mjs');
  const { sections } = await import('../website/.vitepress/theme/landing-en.ts');
  const bridge = read('src-tauri/src/agent/bridge.rs');
  const hooks = read('src-tauri/src/agent/cli.rs');
  assert.deepEqual(
    AGENT_DEMOS.map(demo => demo.name),
    ['Claude Code', 'Codex', 'Gemini CLI', 'Cursor'],
  );
  assert.deepEqual(
    AGENT_DEMOS.map(demo => demo.pet),
    LANDING_PETS.map(pet => pet.id),
  );
  for (const demo of AGENT_DEMOS) {
    assert.equal(demo.steps[0].kind, 'prompt', demo.id);
    assert.equal(demo.steps.at(-1).kind, 'reply', demo.id);
    assert.equal(demo.steps.at(-1).state, 'done', demo.id);
    for (const step of demo.steps) {
      if (step.state) assert.match(bridge, new RegExp(`"${step.state}"`), `${demo.id}: ${step.state}`);
      if (step.say) assert.ok(step.say in sections.agentStatus, `${demo.id}: ${step.say}`);
      assert.equal(step.say === 'tool', Boolean(step.tool), `${demo.id}: tool name`);
    }
  }
  // Codex only reports at the end of a reply; Cursor never asks through a hook.
  assert.deepEqual(
    AGENT_DEMOS[1].steps.filter(step => step.state).map(step => step.state),
    ['done'],
  );
  assert.ok(!AGENT_DEMOS[3].steps.some(step => step.kind === 'ask'));
  for (const [agent, event] of [
    ['claude', 'Notification'],
    ['gemini', 'Notification'],
  ])
    assert.match(hooks, new RegExp(`\\("${agent}", "${event}"\\)`));
});

test('the moving scenes wait until they are seen and stop for paused or reduced motion', () => {
  for (const file of ['WorldPreview.vue', 'ChatDemo.vue', 'AgentDemo.vue']) {
    const source = read(`website/.vitepress/theme/${file}`);
    assert.match(source, /IntersectionObserver/, file);
    assert.match(source, /observer\?\.disconnect/, file);
    assert.match(source, /prefers-reduced-motion/, file);
    assert.match(source, /onBeforeUnmount/, file);
    assert.doesNotMatch(source, /setInterval/, file);
  }
  const preview = read('website/.vitepress/theme/WorldPreview.vue');
  // Friends look toward the pointer with the app's own gaze rows.
  assert.match(preview, /lookFrame/);
  assert.match(preview, /strollTimer/);
});
