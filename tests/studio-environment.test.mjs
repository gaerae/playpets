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
      assert.equal(look.art, `studio-modern-city-${period}`);
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
