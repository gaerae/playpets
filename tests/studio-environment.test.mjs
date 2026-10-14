import assert from 'node:assert/strict';
import test from 'node:test';
import { setLanguageForTests, t } from '../src/core/i18n.js';
import { environmentLook, paintEnvironment } from '../src/yard/environment.js';
import * as sky from '../src/yard/sky.js';
import { useWorlds } from '../src/yard/worlds.js';
import { worlds as definitions } from './support/content.mjs';

test('all four authored studio lights retain their artwork without a full-room filter', () => {
  for (const period of ['morning', 'day', 'evening', 'night'])
    for (const weather of ['clear', 'rain', 'snow']) {
      const look = environmentLook({ world: 'studio', period, weather });
      assert.equal(look.art, `studio-cozy-${period}`);
      assert.equal(look.filter, 'none');
      assert.equal(look.tint, null);
    }
});

test('static rainy and snowy overcast paint is clipped to glass while indoor pixels stay authored', () => {
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
    paintEnvironment(ctx, { width: 1536, height: 1024 }, 840, 660, { world: 'studio', period: 'day', weather });
    assert.equal(clips, 1);
    assert.equal(fills, 1);
  }
});

// An indoor caption is one sentence per language with the place, the time of day and (where the
// window shows it) the weather as placeholders, so each language puts them in its own order.
test('studio caption keeps its place name in every language and weather', () => {
  for (const lang of ['en', 'ko', 'ja', 'zh-hans']) {
    setLanguageForTests(lang);
    for (const weather of ['clear', 'rain', 'snow']) {
      const caption = sky.worldCaption('studio', 'day', weather);
      assert.equal(
        caption,
        t('caption.indoor_weather', {
          place: t('world.studio'),
          period: t('period.day'),
          weather: t(`weather.${weather}`),
        }),
      );
      for (const part of [t('world.studio'), t('period.day'), t(`weather.${weather}`)])
        assert.ok(caption.includes(part));
      assert.ok(!caption.includes('{'), caption);
    }
  }
  setLanguageForTests('en');
});

test('a room without weather names only the place and the time of day', context => {
  useWorlds([...definitions, { id: 'den', label: 'world.studio', capabilities: { sky: false, weather: false } }]);
  context.after(() => useWorlds(definitions));
  for (const lang of ['en', 'ko', 'ja', 'zh-hans']) {
    setLanguageForTests(lang);
    const caption = sky.worldCaption('den', 'night', 'rain');
    assert.equal(caption, t('caption.indoor', { place: t('world.studio'), period: t('period.night') }));
    assert.ok(caption.includes(t('world.studio')) && caption.includes(t('period.night')));
    assert.ok(!caption.includes(t('weather.rain')) && !caption.includes('{'), caption);
  }
  setLanguageForTests('en');
});

test('studio seasons change only the window view and snow overrides summer', async () => {
  const { environmentWindowLook } = await import('../src/yard/environment.js');
  for (const period of ['morning', 'day', 'evening', 'night']) {
    for (const season of ['spring', 'autumn', 'winter']) {
      const scene = { world: 'studio', period, season, weather: 'clear' };
      const look = environmentWindowLook(scene);
      assert.equal(look.art, `studio-view-${season}`);
      assert.equal(environmentLook(scene).filter, 'none');
      assert.equal(look.filter === 'none', period === 'day');
    }
    assert.equal(environmentWindowLook({ world: 'studio', period, season: 'summer', weather: 'clear' }), null);
    assert.equal(
      environmentWindowLook({ world: 'studio', period, season: 'summer', weather: 'snow' }).art,
      'studio-view-winter',
    );
  }
});

test('seasonal view and its night tint cannot paint the room outside glass', () => {
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
  paintEnvironment(
    ctx,
    base,
    500,
    350,
    { world: 'studio', season: 'winter', period: 'night', weather: 'clear' },
    overlay,
  );
  assert.deepEqual(draws, [base, overlay]);
});
