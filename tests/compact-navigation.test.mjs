import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(path, 'utf8');

test('scene destinations have separate tab panels and only their bodies scroll', async () => {
  const html = await read('src/index.html');
  for (const id of ['scene-places-tab', 'scene-atmosphere-tab', 'scene-places', 'scene-atmosphere', 'scene-back'])
    assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /id="scene-atmosphere"[^>]*hidden/);
  const css = await read('src/styles/caption.css');
  assert.match(css, /\.scene-menu\s*\{[^}]*grid-template-rows:\s*auto auto minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.scene-page\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.background-gallery\s*\{[^}]*overflow:\s*visible/s);
});

test('panel navigation has an explicit return to the menu and optional larger view', async () => {
  const html = await read('src/index.html');
  assert.match(html, /id="panel-menu"[^>]*data-i18n-(?:title|aria-label)="controls.back"/);
  assert.match(html, /id="panel-expand"[^>]*data-expand-window/);
  const tabs = await read('src/panel/tabs.js');
  assert.match(tabs, /\$\('panel-menu'\).*openControls/);
});

test('small settings use a named section chooser and invite filters are optional', async () => {
  const html = await read('src/index.html');
  assert.match(html, /id="settings-section"[^>]*aria-label/);
  assert.match(html, /<details id="invite-filters"/);
  const css = await read('src/styles/compact.css');
  assert.match(css, /body\.compact \.layout.settings-open \.settings-index\s*\{[^}]*display:\s*none/s);
  assert.match(css, /body\.compact #settings-section\s*\{[^}]*display:\s*block/s);
});

test('the small menu separates four destinations from its secondary actions', async () => {
  const html = await read('src/index.html');
  const nav = html.slice(
    html.indexOf('<nav class="panel-tabs"'),
    html.indexOf('</nav>', html.indexOf('<nav class="panel-tabs"')),
  );
  assert.match(nav, /id="menu-scene"/);
  assert.match(html, /<details id="controls-more"/);
  assert.match(html, /id="controls-more"[^>]*>[\s\S]*?class="yard-controls-scroll"/);
});

test('friend actions use the sheet bounds rather than the short identity row', async () => {
  const css = await read('src/styles/compact.css');
  assert.match(css, /body\.compact \.friend-head:has\(\.pop-menu:not\(\[hidden\]\)\)[^{]*\{[^}]*position:\s*static/s);
});
