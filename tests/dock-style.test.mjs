// The dock on the yard's corner: the place's name, Play and Friends & settings in one frame.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = (await readFile('src/styles/shell.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
const rule = selector => {
  const at = css.search(new RegExp(`(^|\\n)${selector.replace(/[.[\]()"=:>-]/g, m => `\\${m}`)}\\s*\\{`));
  assert.ok(at >= 0, selector);
  return css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
};

// Play's honey pill sets it apart on both sides; a line on one side only read as a seam.
test('Play stands between its neighbours with no line on either side', () => {
  assert.doesNotMatch(rule('.yard-controls-toggle'), /border-left/);
  assert.doesNotMatch(rule('.yard-play-toggle'), /border-(left|right)\s*:/);
});

// A new version waits in a tinted chip of its own at the dock's start, rounded as the dock's other
// parts are; a line and a square side made it read as a cut-off piece of the place's button.
test("the update's chip has no line beside it and is rounded all round", () => {
  const pill = rule('.yard-dock > .update-pill');
  assert.doesNotMatch(pill, /border-(left|right)\s*:/);
  assert.match(pill, /border-radius:\s*var\(--radius-control\);/);
});

// Lifted on hover, the pill left the dock's line and seemed to float; it brightens and glows in
// place instead, and still gives under a press.
test('Play answers the pointer in place, and gives under a press', () => {
  assert.doesNotMatch(css, /\.yard-play-toggle:hover\s*\{[^}]*translate/);
  assert.match(rule('.yard-play-toggle:active'), /scale\(0\.96\)/);
});
