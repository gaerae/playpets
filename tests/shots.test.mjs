// The screenshot script reads the screen's size from system_profiler, not from the Finder (whose
// AppleScript prompt would sit in every picture).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { mainDisplay } from '../scripts/shots-lib.mjs';

const report = screens => JSON.stringify({ SPDisplaysDataType: [{ spdisplays_ndrvs: screens }] });

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
