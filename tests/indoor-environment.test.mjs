import assert from 'node:assert/strict';
import test from 'node:test';
import { setLanguageForTests, t } from '../src/core/i18n.js';
import { environmentLook, paintEnvironment } from '../src/yard/environment.js';
import * as sky from '../src/yard/sky.js';
import { useWorlds } from '../src/yard/worlds.js';
import { worlds as definitions } from './support/content.mjs';
import { withDen } from './support/den.mjs';

test('all four authored room lights retain their artwork without a full-room filter', t => {
  withDen(t);
  for (const period of ['morning', 'day', 'evening', 'night'])
    for (const weather of ['clear', 'rain', 'snow']) {
      const look = environmentLook({ world: 'den', period, weather });
      assert.equal(look.art, `studio-cozy-${period}`);
      assert.equal(look.filter, 'none');
      assert.equal(look.tint, null);
    }
});

test('static rainy and snowy overcast paint is clipped to glass while indoor pixels stay authored', t => {
  withDen(t);
  for (const weather of ['rain', 'snow']) {
    let clipped = false,
      clips = 0,
      fills = 0;
    const ctx = {
      save() {},
      restore() {
        clipped = false;
      },
      beginPath() {},
      rect() {},
      clip() {
        clipped = true;
        clips++;
      },
      drawImage() {
        assert.equal(clipped, false);
        assert.equal(this.filter, 'none');
      },
      fillRect() {
        assert.equal(clipped, true, 'overcast cannot touch furniture or floor');
        fills++;
      },
    };
    paintEnvironment(ctx, { width: 1536, height: 1024 }, 840, 660, { world: 'den', period: 'day', weather });
    assert.equal(clips, 1);
    assert.equal(fills, 1);
  }
});

// An indoor caption is one sentence per language with the place, the time of day and (where the
// window shows it) the weather as placeholders, so each language puts them in its own order.
test('a room with windows keeps its place name in its caption in every language and weather', context => {
  withDen(context);
  for (const lang of ['en', 'ko', 'ja', 'zh-hans']) {
    setLanguageForTests(lang);
    for (const weather of ['clear', 'rain', 'snow']) {
      const caption = sky.worldCaption('den', 'day', weather);
      assert.equal(
        caption,
        t('caption.indoor_weather', {
          place: t('world.workshop'),
          period: t('period.day'),
          weather: t(`weather.${weather}`),
        }),
      );
      for (const part of [t('world.workshop'), t('period.day'), t(`weather.${weather}`)])
        assert.ok(caption.includes(part));
      assert.ok(!caption.includes('{'), caption);
    }
  }
  setLanguageForTests('en');
});

test('a room without weather names only the place and the time of day', context => {
  useWorlds([...definitions, { id: 'nook', label: 'world.workshop', capabilities: { sky: false, weather: false } }]);
  context.after(() => useWorlds(definitions));
  for (const lang of ['en', 'ko', 'ja', 'zh-hans']) {
    setLanguageForTests(lang);
    const caption = sky.worldCaption('nook', 'night', 'rain');
    assert.equal(caption, t('caption.indoor', { place: t('world.workshop'), period: t('period.night') }));
    assert.ok(caption.includes(t('world.workshop')) && caption.includes(t('period.night')));
    assert.ok(!caption.includes(t('weather.rain')) && !caption.includes('{'), caption);
  }
  setLanguageForTests('en');
});

// Outdoors the caption keeps its weather and time of day ("A sunny day") and names the place too, so
// the hill garden, the courtyard, the lakeside and a background of the person's own each read as
// themselves.
test('every outdoor place names itself in its caption, a background of your own by its name', context => {
  useWorlds([...definitions, { id: 'custom-1', custom: true, name: 'Rooftop', label: 'background.custom' }]);
  context.after(() => useWorlds(definitions));
  for (const lang of ['en', 'ko', 'ja', 'zh-hans']) {
    setLanguageForTests(lang);
    const outdoor = definitions.filter(world => world.capabilities?.sky !== false);
    assert.ok(outdoor.length >= 3);
    const captions = new Set();
    for (const world of [...outdoor, { id: 'custom-1' }]) {
      const place = world.id === 'custom-1' ? 'Rooftop' : t(world.label);
      for (const weather of ['clear', 'rain', 'snow'])
        for (const period of ['morning', 'day', 'evening', 'night']) {
          const caption = sky.worldCaption(world.id, period, weather);
          assert.equal(caption, t('caption.outdoor', { scene: t(`caption.${weather}.${period}`), place }));
          assert.ok(caption.includes(place), `${lang} ${world.id}: ${caption}`);
          assert.ok(!caption.includes('{'), caption);
          captions.add(caption);
        }
    }
    assert.equal(captions.size, (outdoor.length + 1) * 12, `${lang}: no two places share a caption`);
  }
  setLanguageForTests('en');
});

test('each place has a description of its own', () => {
  const abouts = definitions.map(world => world.about);
  assert.equal(new Set(abouts).size, abouts.length, JSON.stringify(abouts));
  for (const lang of ['en', 'ko', 'ja', 'zh-hans']) {
    setLanguageForTests(lang);
    for (const about of abouts) assert.notEqual(t(about), about, `${lang}: ${about}`);
  }
  setLanguageForTests('en');
});

test("a room's seasons change only the window view independently of snow", async t => {
  withDen(t);
  const { environmentWindowLook } = await import('../src/yard/environment.js');
  for (const period of ['morning', 'day', 'evening', 'night']) {
    for (const season of ['spring', 'autumn', 'winter']) {
      const scene = { world: 'den', period, season, weather: 'clear' };
      const look = environmentWindowLook(scene);
      assert.equal(look.art, `studio-view-${season}`);
      assert.equal(environmentLook(scene).filter, 'none');
      assert.equal(look.filter === 'none', period === 'day');
    }
    assert.equal(environmentWindowLook({ world: 'den', period, season: 'summer', weather: 'clear' }), null);
    assert.equal(environmentWindowLook({ world: 'den', period, season: 'summer', weather: 'snow' }), null);
  }
});

test('seasonal view and its night tint cannot paint the room outside glass', t => {
  withDen(t);
  let clipped = false;
  const base = { width: 1536, height: 1024 },
    overlay = { width: 1536, height: 1024 };
  const draws = [];
  const ctx = {
    save() {},
    restore() {
      clipped = false;
    },
    beginPath() {},
    rect() {},
    clip() {
      clipped = true;
    },
    drawImage(image) {
      draws.push(image);
      assert.equal(clipped, image === overlay);
    },
    fillRect() {
      assert.equal(clipped, true);
    },
  };
  paintEnvironment(ctx, base, 500, 350, { world: 'den', season: 'winter', period: 'night', weather: 'clear' }, overlay);
  assert.deepEqual(draws, [base, overlay]);
});
