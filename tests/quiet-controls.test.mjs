import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { element, installDom } from './support/dom.mjs';

test('yard controls start closed and the brand lives in About', async () => {
  const html = await readFile('src/index.html', 'utf8');
  assert.match(html, /id="yard-controls-panel"[^>]*hidden/);
  assert.match(html, /id="yard-controls-toggle"[^>]*aria-expanded="false"/);
  assert.doesNotMatch(html, /id="clock-(time|date)"/);
  assert.ok(html.indexOf('class="brand"') > html.indexOf('id="settings-about"'));
});

test('a new version stays visible before the place selector while the menu is closed', async () => {
  const html = await readFile('src/index.html', 'utf8');
  const dock = html.slice(html.indexOf('<div class="yard-dock">'), html.indexOf('<div id="scene-menu"'));
  assert.ok(dock.indexOf('id="update-pill"') > 0, 'the update button belongs to the dock');
  assert.ok(dock.indexOf('id="update-pill"') < dock.indexOf('id="scene-button"'));
  assert.ok(dock.indexOf('id="scene-button"') < dock.indexOf('id="yard-controls-toggle"'));
  assert.equal(html.match(/id="update-pill"/g)?.length, 1);
});

test('controls open by click, dismiss by Escape, and return keyboard focus', async t => {
  const toggle = element('button', { id: 'yard-controls-toggle' });
  const panel = element('div', { id: 'yard-controls-panel', hidden: true });
  const first = element('button');
  panel.querySelector = () => first;
  const { nodes } = installDom(t);
  for (const node of [toggle, panel]) nodes.set(node.id, node);
  const { setupControls } = await import('../src/core/controls.js');
  setupControls();
  await toggle.dispatch('click');
  assert.equal(panel.hidden, false);
  assert.equal(document.activeElement, first);
  let consumed = false;
  await panel.dispatch('keydown', {
    key: 'Escape',
    preventDefault() {
      consumed = true;
    },
  });
  assert.equal(consumed, true, 'Escape does not also trigger the native fullscreen action');
  assert.equal(panel.hidden, true);
  assert.equal(document.activeElement, toggle);
});

test('keyboard placement keeps its focused tool until placement finishes; mouse placement closes controls', async t => {
  const toggle = element('button', { id: 'yard-controls-toggle' });
  const panel = element('div', { id: 'yard-controls-panel', hidden: true });
  const feed = element('button', { id: 'feed' });
  const plant = element('button', { id: 'plant-tool' });
  const { nodes } = installDom(t);
  for (const node of [toggle, panel, feed, plant]) nodes.set(node.id, node);
  panel.querySelector = () => feed;
  for (const tool of [feed, plant]) tool.closest = () => tool;
  const { setupControls } = await import('../src/core/controls.js');
  const { setAiming } = await import('../src/core/state.js');
  t.after(() => setAiming(false));
  setupControls();
  for (const [tool, mode] of [
    [feed, 'treat'],
    [plant, 'seed'],
  ]) {
    await toggle.dispatch('click');
    tool.focus();
    setAiming(mode);
    await panel.dispatch('click', { target: tool, detail: 0 });
    assert.equal(panel.hidden, false, `${mode} can receive another keyboard activation`);
    assert.equal(document.activeElement, tool);
    setAiming(false);
    await panel.dispatch('click', { target: tool, detail: 0 });
    assert.equal(panel.hidden, true, `${mode} closes when placement finishes`);
    assert.equal(document.activeElement, toggle);
    await toggle.dispatch('click');
    setAiming(mode);
    await panel.dispatch('click', { target: tool, detail: 1 });
    assert.equal(panel.hidden, true, `${mode} leaves the yard clear for pointer placement`);
  }
});

test('opening controls closes an existing panel before focusing navigation', async t => {
  const { nodes } = installDom(t);
  const toggle = element('button', { id: 'yard-controls-toggle' });
  const panel = element('div', { id: 'yard-controls-panel', hidden: true });
  const side = element('aside', { id: 'side-panel' });
  const close = element('button', { id: 'close-panel' });
  const first = element('button');
  panel.querySelector = () => first;
  close.click = () => {
    side.hidden = true;
    toggle.focus();
  };
  for (const node of [toggle, panel, side, close]) nodes.set(node.id, node);
  const { setupControls } = await import('../src/core/controls.js');
  setupControls();
  await toggle.dispatch('click');
  assert.equal(side.hidden, true);
  assert.equal(panel.hidden, false);
  assert.equal(document.activeElement, first);
});

test('view actions have visible names inside controls', async () => {
  const html = await readFile('src/index.html', 'utf8');
  assert.match(html, /id="always-on-top"[^>]*>[\s\S]*?data-i18n="win.always_on_top"[\s\S]*?<\/button>/);
  assert.match(html, /id="sound-button"[^>]*>[\s\S]*?data-i18n="sound.label"[\s\S]*?<\/button>/);
});

test('desktop toggling keeps the menu available for its strolling control', async t => {
  const { nodes } = installDom(t);
  const toggle = element('button', { id: 'yard-controls-toggle' });
  const panel = element('div', { id: 'yard-controls-panel', hidden: true });
  const desktop = element('button', { id: 'desktop' });
  panel.querySelector = () => desktop;
  desktop.closest = () => desktop;
  for (const node of [toggle, panel, desktop]) nodes.set(node.id, node);
  const { setupControls } = await import('../src/core/controls.js');
  setupControls();
  await toggle.dispatch('click');
  await panel.dispatch('click', { target: desktop, detail: 1 });
  assert.equal(panel.hidden, false);
});

test('desktop and strolling share visible switches and retain an unavailable strolling row', async t => {
  const { nodes } = installDom(t);
  for (const id of [
    'desktop',
    'desktop-label',
    'always-on-top',
    'wander-wrap',
    'desktop-wander',
    'auto-chatter',
    'autostart',
  ])
    nodes.set(id, element('input', { id }));
  const { data } = await import('../src/core/state.js');
  const prior = { pets: data.pets, desktop: data.desktop, desktopWander: data.desktopWander };
  t.after(() => Object.assign(data, prior));
  const { renderDesktopSwitches } = await import('../src/panel/settings.js');
  Object.assign(data, { pets: [{}], desktop: false, desktopWander: true });
  renderDesktopSwitches();
  assert.equal(nodes.get('wander-wrap').hidden, false);
  assert.equal(nodes.get('desktop-wander').disabled, true);
  data.desktop = true;
  renderDesktopSwitches();
  assert.equal(nodes.get('desktop-wander').disabled, false);
  assert.equal(nodes.get('desktop-wander').checked, true);
  const html = await readFile('src/index.html', 'utf8');
  assert.match(html, /id="desktop"[^>]*>[\s\S]*?class="wander-switch"[\s\S]*?<\/button>/);
});

test('scene selection lives beside Menu, outside the closed controls', async () => {
  const html = await readFile('src/index.html', 'utf8');
  assert.ok(html.indexOf('id="scene-button"') < html.indexOf('id="yard-controls-panel"'));
  assert.ok(html.indexOf('id="scene-menu"') < html.indexOf('id="yard-controls-panel"'));
  const css = await readFile('src/styles/compact.css', 'utf8');
  assert.match(css, /body\.compact \.yard-dock\s*\{\s*display: none/);
  assert.doesNotMatch(css, /\.scene-menu\s*\{\s*display: none/);
});

test('desktop strolling is centered and its label names the desktop in every language', async () => {
  const css = await readFile('src/styles/caption.css', 'utf8');
  assert.match(css, /\.view-wander\s*\{[^}]*display: flex;[^}]*align-items: center;/);
  for (const [lang, scope] of [
    ['en', 'desktop'],
    ['ko', '바탕화면'],
    ['ja', 'デスクトップ'],
    ['zh-hans', '桌面'],
  ]) {
    const { strings } = await import(`../src/core/strings/${lang}.js`);
    assert.ok(strings['desktop.wander'].toLowerCase().includes(scope), lang);
  }
});

test('game choices expand across the toolbar with comfortable full-width targets', async () => {
  const css = await readFile('src/styles/tools.css', 'utf8');
  assert.match(css, /\.games\s*\{[^}]*grid-column: 1 \/ -1;/);
  assert.match(css, /\.games-menu \.button\.tool\s*\{[^}]*min-height: 44px;/);
  assert.match(css, /\.games-menu\s*\{[^}]*position: relative;/);
});

test('blank-yard context controls clamp inside a small window and restore a visible focus target', async t => {
  const { keepGlobals } = await import('./support/dom.mjs');
  keepGlobals(t, 'innerWidth', 'innerHeight');
  globalThis.innerWidth = 300;
  globalThis.innerHeight = 210;
  const { document, nodes } = installDom(t);
  document.body.classList.add('compact');
  const toggle = element('button', { id: 'yard-controls-toggle' });
  const panel = element('div', { id: 'yard-controls-panel', hidden: true });
  const context = element('div', { id: 'yard-context-menu', hidden: true, rect: { width: 284, height: 194 } });
  const yard = element('div', { id: 'yard' });
  const first = element('button');
  context.querySelectorAll = () => [first];
  for (const node of [toggle, panel, context, yard]) nodes.set(node.id, node);
  const { setupControls } = await import('../src/core/controls.js');
  setupControls();
  await yard.dispatch('contextmenu', { clientX: 298, clientY: 208 });
  assert.equal(context.hidden, false);
  assert.equal(panel.hidden, true, 'the full menu stays closed');
  assert.equal(context.style.left, '8px');
  assert.equal(context.style.top, '8px');
  assert.equal(document.activeElement, first);
  await context.dispatch('keydown', { key: 'Escape' });
  assert.equal(context.hidden, true);
  assert.equal(document.activeElement, yard);
  document.body.classList.remove('compact');
  await toggle.dispatch('click');
  assert.equal(panel.style.left, undefined);
});

test('yard context controls leave handled pet, plant and editing gestures alone', async t => {
  const { nodes } = installDom(t);
  const toggle = element('button', { id: 'yard-controls-toggle' });
  const panel = element('div', { id: 'yard-controls-panel', hidden: true });
  const yard = element('div', { id: 'yard' });
  for (const node of [toggle, panel, yard]) nodes.set(node.id, node);
  const { setupControls } = await import('../src/core/controls.js');
  setupControls();
  for (const target of [element('button'), element('input'), element('div', { className: 'yard-pet' })]) {
    await yard.dispatch('contextmenu', { target });
    assert.equal(panel.hidden, true);
  }
  await yard.dispatch('contextmenu', { defaultPrevented: true });
  assert.equal(panel.hidden, true);
});

test('the menu shortcut opens controls without relying on the hidden compact dock', async t => {
  const { document, nodes } = installDom(t);
  document.body.classList.add('compact');
  for (const id of ['yard-controls-toggle', 'yard-controls-panel', 'yard', 'close-controls'])
    nodes.set(id, element('button', { id, hidden: id === 'yard-controls-panel' }));
  const { setupControls, openControls } = await import('../src/core/controls.js');
  setupControls();
  nodes.get('yard-controls-panel').scrollTop = 250;
  openControls();
  assert.equal(nodes.get('yard-controls-panel').scrollTop, 0);
  assert.equal(nodes.get('yard-controls-panel').hidden, false);
  await nodes.get('close-controls').dispatch('click');
  assert.equal(nodes.get('yard-controls-panel').hidden, true);
  assert.equal(document.activeElement, nodes.get('yard'));
});
