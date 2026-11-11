import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readCss = async name =>
  (await readFile(new URL(`../src/styles/${name}.css`, import.meta.url), 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{};:,>()])\s*/g, '$1')
    .replace(/\s+/g, ' ');

test('Settings stays a compact desktop sheet with readable rows and its existing body scroller', async () => {
  const css = await readCss('settings');
  // One size from section to section, wide enough for the list beside the open section, tall in
  // proportion to the window and centred in it.
  assert.match(
    css,
    /\.layout.settings-open \.side-panel\{[^}]*top:50%;[^}]*width:min\(var\(--settings-width\),calc\(100% - 48px\)\);[^}]*height:min\(var\(--settings-height\),calc\(100% - 96px\)\);[^}]*transform:translate\(-50%,-50%\)/,
  );
  assert.match(css, /\.layout.settings-open #panel-settings\{[^}]*display:flex/);
  assert.match(css, /\.link-row\{[^}]*padding:8px/);
  assert.match(css, /\.settings-lead\{[^}]*font-size:var\(--font-md\)/);
  assert.match(css, /\.settings-content\{[^}]*min-height:0;[^}]*overflow-y:auto/);
  assert.match(css, /\.settings-index\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('a wide window lays the list of sections beside the open one, the open one marked', async () => {
  const css = await readCss('settings');
  assert.match(
    css,
    /body:not\(\.compact\)\.layout\.settings-open #panel-settings\{[^}]*display:grid;[^}]*grid-template-columns:200px minmax\(0,1fr\)/,
  );
  assert.match(css, /body:not\(\.compact\)\.settings-index\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(
    css,
    /body:not\(\.compact\)\.settings-index button\[aria-current="page"\]\{[^}]*background:var\(--control-selected\)/,
  );
});

test('panel and Settings actions use compact mouse targets and larger touch targets', async () => {
  const panel = await readCss('panel');
  const settings = await readCss('settings');
  assert.match(panel, /\.panel-head \.icon-button\{width:36px;height:36px/);
  assert.match(settings, /\.settings-index button\{min-height:54px/);
  assert.match(panel, /@media\(pointer:coarse\)[\s\S]*?\.panel-head \.icon-button\{width:44px;height:44px/);
  assert.match(settings, /@media\(pointer:coarse\)[\s\S]*?min-height:44px/);
});

test('compact menus cap their width instead of stretching across a medium companion window', async () => {
  const css = await readFile('src/styles/compact.css', 'utf8');
  assert.match(
    css,
    /body\.compact #yard-controls-panel\s*\{[^}]*width:\s*min\(var\(--dock-panel-width\),\s*calc\(100% - 16px\)\)/s,
  );
});

// Three kinds of surface, each one size wherever it was opened from: a dock panel above the dock
// (Place & atmosphere, Play, Friends & settings), a sheet beside the yard (a friend, Invite), and
// Settings over the yard. Before, a 1180 by 850 window showed six widths between 227 and 760px.
test('every panel takes the width of its kind from one token', async () => {
  const base = await readCss('base');
  assert.match(base, /--dock-panel-width:360px/);
  assert.match(base, /--sheet-width:440px/);
  assert.match(base, /--settings-width:720px/);
  assert.match(base, /--settings-height:560px/);
  const dock = 'width:min\\(var\\(--dock-panel-width\\),calc\\(100% - 24px\\)\\)';
  assert.match(await readCss('caption'), new RegExp(`(?:^|\\})\\.scene-menu\\{[^}]*${dock}`));
  assert.match(await readCss('shell'), new RegExp(`(?:^|\\})\\.yard-controls-panel\\{[^}]*${dock}`));
  assert.match(await readCss('play'), new RegExp(`body:not\\(\\.compact\\)\\.play-board\\{[^}]*${dock}`));
  const panel = await readCss('panel');
  assert.match(panel, /\.layout\.panel-open \.side-panel\{[^}]*width:min\(var\(--sheet-width\),calc\(100% - 24px\)\)/);
  assert.doesNotMatch(panel, /panel-invite[^{]*\{[^}]*width:min\(480px/, "Invite is a sheet like a friend's");
});

// Each kind of surface stands the same height off the yard: Place & atmosphere had a deeper shadow
// than Play and Friends & settings beside it.
test('every surface of a kind casts the same shadow', async () => {
  const base = await readCss('base');
  for (const kind of ['dock', 'menu', 'sheet', 'settings']) assert.match(base, new RegExp(`--shadow-${kind}:`));
  const dock = 'box-shadow:var\\(--shadow-dock\\)';
  assert.match(await readCss('caption'), new RegExp(`(?:^|\\})\\.scene-menu\\{[^}]*${dock}`));
  assert.match(await readCss('shell'), new RegExp(`(?:^|\\})\\.yard-controls-panel\\{[^}]*${dock}`));
  assert.match(await readCss('play'), new RegExp(`(?:^|\\})\\.play-board\\{[^}]*${dock}`));
  assert.match(await readCss('panel'), /\.layout\.panel-open \.side-panel\{[^}]*box-shadow:var\(--shadow-sheet\)/);
  assert.match(
    await readCss('settings'),
    /\.layout\.settings-open \.side-panel\{[^}]*box-shadow:var\(--shadow-settings\)/,
  );
});

// Moving between sections of Settings in a small window kept resizing the sheet to each section's
// length; only the list of sections, a page of its own, is as tall as its rows.
test('Settings in a small window keeps one height from section to section', async () => {
  const css = await readCss('settings');
  const wide = css.slice(css.indexOf('@media(min-width:480px)'));
  assert.ok(wide.length < css.length, 'the wide small-window rules are there');
  assert.doesNotMatch(wide, /height:auto/);
  assert.doesNotMatch(wide, /\.settings-content\{[^}]*max-height/);
  assert.match(
    css,
    /body\.compact \.layout\.settings-open \.side-panel:has\(#settings-home:not\(\[hidden\]\)\)\{[^}]*height:auto/,
  );
});

// A small window's rows are shorter so they fit at 300 by 210, but a finger still needs 44px.
test('a touch screen keeps 44px targets in small windows too', async () => {
  const coarse = css =>
    [...css.matchAll(/@media\(pointer:coarse\)\{((?:[^{}]*\{[^}]*\})*)\}/g)].map(m => m[1]).join('');
  assert.match(coarse(await readCss('compact')), /body\.compact \.yard-context-menu>button\{min-height:44px/);
  assert.match(coarse(await readCss('settings')), /body\.compact \.settings-index button\{min-height:44px/);
  assert.match(coarse(await readCss('friend')), /body\.compact \.friend-select\{min-height:44px/);
});

// The friend's line under its name says what its coding agent is doing; a small window keeps it
// unless the window is too short for the line.
test("a small window keeps the friend's status line while there is height for it", async () => {
  const css = await readCss('friend');
  assert.doesNotMatch(css, /body\.compact \.friend-sub \.status-pill[,{]/);
  assert.match(css, /@media\(max-height:280px\)\{body\.compact \.friend-sub\{display:none/);
});
