// The screenshot script reads the screen's size from system_profiler, not from the Finder (whose
// AppleScript prompt would sit in every picture).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as shots from '../scripts/shots-lib.mjs';
import { mainDisplay } from '../scripts/shots-lib.mjs';

const report = screens => JSON.stringify({ SPDisplaysDataType: [{ spdisplays_ndrvs: screens }] });

test('capture conversations use the active language even when every locale shares the same pet names', () => {
  for (const [lang, answer] of Object.entries({
    ko: 'KO reply',
    en: 'EN reply',
    ja: 'JA reply',
    'zh-hans': 'ZH reply',
  })) {
    const localized = { chat: [['question', `${lang} direct`]], talk: { Daisy: answer } };
    assert.equal(
      shots.captureReply(localized, [
        { role: 'system', content: 'You are named Daisy' },
        { role: 'user', content: 'group talk' },
      ]),
      answer,
    );
    assert.equal(shots.captureReply(localized, [{ role: 'user', content: 'question' }]), `${lang} direct`);
  }
  assert.equal(shots.captureReply({ chat: [], talk: {} }, []), '...');
  const source = readFileSync('scripts/shots.mjs', 'utf8');
  assert.match(source, /captureReply\(script\[captureLanguage\], messages\)/);
  assert.doesNotMatch(source, /Object\.values\(script\)/);
});

test('the main display is read in points, whichever display is listed first', () => {
  const laptop = { _spdisplays_resolution: '1728 x 1117 @ 120.00Hz', _spdisplays_pixels: '3456 x 2234' };
  const external = { _spdisplays_resolution: '2560 x 1440 @ 60.00Hz' };
  assert.deepEqual(mainDisplay(report([laptop])), { width: 1728, height: 1117 });
  assert.deepEqual(mainDisplay(report([external, { ...laptop, spdisplays_main: 'spdisplays_yes' }])), {
    width: 1728,
    height: 1117,
  });
  assert.equal(mainDisplay('not json'), null);
  assert.equal(mainDisplay(report([])), null);
});

test('the screenshot script never asks the Finder over AppleScript', () => {
  assert.ok(!/osascript|tell application "Finder"/.test(readFileSync('scripts/shots.mjs', 'utf8')));
});

test('window capture selects only the child PID and exact requested outer bounds', () => {
  const rect = { x: 80, y: 170, width: 1180, height: 780 };
  const windows = [
    { id: 1, pid: 99, layer: 0, bounds: rect },
    { id: 2, pid: 42, layer: 0, bounds: { ...rect, width: 460 } },
    { id: 3, pid: 42, layer: 0, bounds: { ...rect, x: 80.5 } },
    { id: 4, pid: 42, layer: 3, bounds: { ...rect, width: 320 } },
  ];
  assert.equal(shots.captureWindow(windows, 42, rect).id, 3);
});

test('an always-on-top mini window remains capturable by its PID and bounds', () => {
  const bounds = { x: 1100, y: 650, width: 460, height: 320 };
  assert.equal(shots.captureWindow([{ id: 7, pid: 42, layer: 3, bounds }], 42, bounds).id, 7);
  assert.throws(() => shots.captureWindow([{ id: 7, pid: 42, layer: -1, bounds }], 42, bounds), /capture window/i);
});

test('missing, ambiguous or malformed native windows fail closed', () => {
  const rect = { x: 0, y: 0, width: 460, height: 320 };
  const valid = { id: 9, pid: 42, layer: 0, bounds: rect };
  for (const windows of [
    [],
    [valid, { ...valid, id: 10 }],
    [{ ...valid, id: 0 }],
    [{ ...valid, bounds: { ...rect, width: NaN } }],
  ])
    assert.throws(() => shots.captureWindow(windows, 42, rect), /capture window/i);
  assert.throws(() => shots.captureWindow([valid], 99, rect), /capture window/i);
});

test('clean composition scales its controlled margin to native pixels and fills alpha corners', () => {
  const calls = [];
  const ctx = {
    createLinearGradient: () => ({ addColorStop: (...args) => calls.push(['color', ...args]) }),
    fillRect: (...args) => calls.push(['fill', ...args]),
    drawImage: (...args) => calls.push(['draw', ...args]),
  };
  const canvas = { getContext: () => ctx };
  const image = { naturalWidth: 2360, naturalHeight: 1560 };
  shots.composeWindow(canvas, image, 1180, 28);
  assert.deepEqual([canvas.width, canvas.height], [2472, 1672]);
  assert.deepEqual(
    calls.filter(c => c[0] === 'color').map(c => c[2]),
    ['#eaf3ef', '#e5edf0', '#f4efe4'],
  );
  assert.deepEqual(
    calls.find(c => c[0] === 'fill'),
    ['fill', 0, 0, 2472, 1672],
  );
  assert.deepEqual(
    calls.find(c => c[0] === 'draw'),
    ['draw', image, 56, 56],
  );
  assert.ok(calls.findIndex(c => c[0] === 'fill') < calls.findIndex(c => c[0] === 'draw'));
});

test('seasonal captures select explicit seasons without replacing the original autumn scene', () => {
  assert.deepEqual(shots.seasonalScenes(), [
    { name: 'yard-spring', season: 'spring', weather: 'clear' },
    { name: 'yard-summer', season: 'summer', weather: 'clear' },
    { name: 'yard-winter', season: 'winter', weather: 'snow' },
  ]);
  const changed = shots.seasonalScenes();
  changed[0].season = 'winter';
  assert.equal(shots.seasonalScenes()[0].season, 'spring');
});

test('capture preparation clears transient focus without changing selected controls', () => {
  let blurred = 0;
  const selected = { checked: true, value: 'summer', blur: () => blurred++ };
  shots.clearCaptureFocus({ activeElement: selected });
  assert.equal(blurred, 1);
  assert.equal(selected.checked, true);
  assert.equal(selected.value, 'summer');
  assert.doesNotThrow(() => shots.clearCaptureFocus({ activeElement: null }));
  const source = readFileSync('scripts/shots.mjs', 'utf8');
  assert.match(source, /clearCaptureFocus\.toString\(\)/);
  assert.match(source, /parkPointer\(\)/);
  // Focus is cleared and the page given a moment to repaint before each picture is measured.
  assert.match(source, /clearFocus\(document\);\s*await wait\(\d+\)/);
});

test('refreshing captures keeps the accepted WebP until its replacement is encoded', () => {
  const source = readFileSync('scripts/shots.mjs', 'utf8');
  // No accepted capture is deleted ahead of time; the new one is renamed over it once encoded.
  assert.doesNotMatch(source, /\b(?:rm|unlink)\([^)]*\.webp/);
  assert.match(source, /await rename\(pending, target\)/);
});

test('brand captures give the three companions equal visible height and one ground line', () => {
  const cast = shots.companionCast();
  assert.deepEqual(
    cast.map(p => p.name),
    ['Daisy', 'Clover', 'Pip'],
  );
  assert.deepEqual(
    cast.map(p => p.x),
    [0.28, 0.5, 0.72],
  );
  assert.deepEqual(
    cast.map(p => p.y),
    [0.58, 0.58, 0.58],
  );
  const heights = [163, 168, 164];
  cast.forEach((pet, i) => {
    assert.ok(Math.abs((pet.size * heights[i]) / 192 - 150) < 0.01);
  });
  const margins = cast.map(p => (9 * p.size) / 192);
  assert.ok(Math.max(...margins) - Math.min(...margins) < 1);
  const source = readFileSync('scripts/shots.mjs', 'utf8');
  assert.doesNotMatch(source, /size:(?:128|150|176)[,}]/);
  assert.match(source, /full\('playpets-pip'\)/);
});
