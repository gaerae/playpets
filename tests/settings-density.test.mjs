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
    /\.layout.settings-open \.side-panel\{[^}]*top:50%;[^}]*width:min\(760px,calc\(100% - 48px\)\);[^}]*height:min\(640px,calc\(100% - 96px\)\);[^}]*transform:translate\(-50%,-50%\)/,
  );
  assert.match(css, /\.layout.settings-open #panel-settings\{[^}]*display:flex/);
  assert.match(css, /\.link-row\{[^}]*padding:8px/);
  assert.match(css, /\.settings-lead\{[^}]*font-size:13px/);
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
  assert.match(css, /body\.compact #yard-controls-panel\s*\{[^}]*width:\s*min\(320px,\s*calc\(100% - 16px\)\)/s);
});
