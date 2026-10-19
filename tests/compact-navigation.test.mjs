import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(path, 'utf8');

test('scene destinations have separate tab panels and only their bodies scroll', async () => {
  const html = await read('src/index.html');
  for (const id of ['scene-places-tab', 'scene-atmosphere-tab', 'scene-places', 'scene-atmosphere', 'scene-close'])
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
  assert.match(tabs, /\$\('panel-menu'\)[\s\S]*?openControls/);
});

test('small settings show explicit tasks rather than a hidden section chooser', async () => {
  const html = await read('src/index.html');
  assert.match(html, /id="settings-home"/);
  assert.doesNotMatch(html, /id="settings-section"/);
  assert.match(html, /<details id="invite-filters"/);
  const home = html.slice(html.indexOf('id="settings-home"'), html.indexOf('id="settings-content"'));
  assert.deepEqual(
    [...home.matchAll(/data-section="([^"]+)"/g)].map(match => match[1]),
    ['general-title', 'agent-link-title', 'updates-title', 'about-title'],
  );
});

test('management separates friends, settings tasks and window actions into peer tabs', async () => {
  const html = await read('src/index.html');
  const menu = html.slice(html.indexOf('<div id="yard-controls-panel"'), html.indexOf('<div id="play-panel"'));
  assert.deepEqual(
    [...menu.matchAll(/data-panel="([^"]+)"/g)].map(match => match[1]),
    ['pet', 'invite', 'settings', 'settings', 'settings', 'settings'],
  );
  assert.doesNotMatch(menu, /id="menu-(scene|play)"/);
  assert.doesNotMatch(menu, /controls-more|<details/);
  for (const name of ['friends', 'settings', 'window']) {
    assert.match(menu, new RegExp(`id="management-tab-${name}"[^>]*role="tab"`));
    assert.match(menu, new RegExp(`id="management-${name}"[^>]*role="tabpanel"`));
  }
  const context = html.slice(html.indexOf('<div id="yard-context-menu"'), html.indexOf('<span id="yard-hint"'));
  assert.deepEqual(
    [...context.matchAll(/data-context-action="([^"]+)"/g)].map(match => match[1]),
    ['scene', 'play', 'menu', 'pin'],
  );
});

test('atmosphere owns season and sound; settings do not duplicate those controls', async () => {
  const html = await read('src/index.html');
  const atmosphere = html.slice(html.indexOf('id="scene-atmosphere"'), html.indexOf('id="yard-controls-panel"'));
  for (const id of ['scene-season', 'sound-button', 'sound-volume']) assert.ok(atmosphere.includes(`id="${id}"`));
  assert.doesNotMatch(html, /id="(?:season|sound-on|settings-yard|scene-back|play-back)"/);
  const general = html.slice(html.indexOf('id="settings-general"'), html.indexOf('id="settings-agents"'));
  assert.match(general, /id="auto-chatter"/);
});

test('friend actions use the sheet bounds rather than the short identity row', async () => {
  const css = await read('src/styles/compact.css');
  assert.match(css, /body\.compact \.friend-head:has\(\.pop-menu:not\(\[hidden\]\)\)[^{]*\{[^}]*position:\s*static/s);
});

test('window actions live in their own bounded panel, not a disclosure', async () => {
  const html = await read('src/index.html');
  const windowPage = html.slice(html.indexOf('id="management-window"'), html.indexOf('<div id="discovery-target"'));
  for (const id of ['always-on-top', 'fullscreen', 'desktop', 'desktop-wander', 'hide-window', 'menu-quit'])
    assert.ok(windowPage.includes(`id="${id}"`));
  const css = await read('src/styles/shell.css');
  assert.match(css, /\.management-page\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.management-tabs button\s*\{[^}]*white-space:\s*nowrap/s);
});

test('importing a pet stays a visible Invite action rather than a hidden search filter', async () => {
  const html = await read('src/index.html');
  const filters = html.slice(
    html.indexOf('<details id="invite-filters"'),
    html.indexOf('</details>', html.indexOf('<details id="invite-filters"')),
  );
  assert.doesNotMatch(filters, /id="import"/);
  const heading = html.slice(html.indexOf('<div class="panel-head">'), html.indexOf('<div id="panel-pet"'));
  assert.match(heading, /id="import"/);
});
