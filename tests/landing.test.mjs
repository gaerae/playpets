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
  assert.match(preview, /v-if="place !== 3"/);
  assert.match(preview, /IntersectionObserver/);
  assert.match(preview, /observer\?\.disconnect/);
  assert.match(preview, /clearTimeout\(greetingTimer\)/);
  assert.doesNotMatch(preview, /setInterval/);
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
