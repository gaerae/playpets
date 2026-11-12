import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const { wrapTab } = await import('../src/panel/tabs.js');
const read = path => readFile(path, 'utf8');

const panelBlock = (html, id) => {
  const start = html.indexOf(`<div id="${id}"`);
  const next = [
    '<div id="scene-menu"',
    '<div id="yard-controls-panel"',
    '<div id="play-panel"',
    '<div id="yard-context-menu"',
  ]
    .map(marker => html.indexOf(marker, start + 1))
    .filter(at => at > start);
  return html.slice(start, Math.min(...next));
};

test('the three dock panels share one shape: a head, then sections on one page, with no tabs or sub-views', async () => {
  const html = await read('src/index.html');
  for (const id of ['scene-menu', 'yard-controls-panel', 'play-panel']) {
    const panel = panelBlock(html, id);
    assert.match(panel, /class="dock-panel-head"/, `${id} has the shared head`);
    assert.match(panel, /class="[^"]*dock-panel-body/, `${id} scrolls one body`);
    assert.match(panel, /<section class="dock-section/, `${id} groups its contents in sections`);
    assert.doesNotMatch(
      panel,
      /role="tab(?:list|panel)?"|data-play-back|data-scene-page|data-management-tab/,
      `${id} has no tabs or sub-views`,
    );
  }
  assert.doesNotMatch(
    panelBlock(html, 'scene-menu'),
    /data-expand-window/,
    'full screen has one home, in the window section',
  );
  const css = await read('src/styles/caption.css');
  assert.match(css, /\.scene-menu\s*\{[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.scene-page\s*\{[^}]*overflow-y:\s*auto/s);
  const shell = await read('src/styles/shell.css');
  assert.match(shell, /\.dock-panel-body\s*\{[^}]*overflow-y:\s*auto/s);
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
    ['general-title', 'ai-title', 'agent-link-title', 'updates-title', 'about-title'],
  );
});

test('the menu has one Settings entry, and right-click offers the same places as the dock', async () => {
  const html = await read('src/index.html');
  const menu = panelBlock(html, 'yard-controls-panel');
  assert.deepEqual(
    [...menu.matchAll(/data-panel="([^"]+)"/g)].map(match => match[1]),
    ['pet', 'invite', 'settings'],
    'the settings list lives in Settings only, not repeated in the menu',
  );
  assert.doesNotMatch(menu, /data-settings-section/);
  assert.doesNotMatch(menu, /id="menu-(scene|play)"/);
  assert.doesNotMatch(menu, /controls-more|<details/);
  const context = html.slice(html.indexOf('<div id="yard-context-menu"'), html.indexOf('<span id="yard-hint"'));
  assert.deepEqual(
    [...context.matchAll(/data-context-for="yard" data-context-action="([^"]+)"/g)].map(match => match[1]),
    ['letter', 'dig-here', 'scene', 'play', 'menu', 'fit', 'pin'],
  );
  assert.deepEqual(
    [...context.matchAll(/data-context-for="friend" data-context-action="([^"]+)"/g)].map(match => match[1]),
    ['talk', 'play-friend', 'dig-friend', 'desktop-friend'],
  );
  // A gift has its own: out to the desktop (a snowman is dressed up instead), or put away.
  assert.deepEqual(
    [...context.matchAll(/data-context-for="decor" data-context-action="([^"]+)"/g)].map(match => match[1]),
    ['desktop-decor', 'dress-decor', 'put-away'],
  );
  // A flower and a planted tree too: out to the desktop, or pulled up.
  for (const [what, remove] of [
    ['plant', 'pull-plant'],
    ['tree', 'remove-tree'],
  ])
    assert.deepEqual(
      [...context.matchAll(new RegExp(`data-context-for="${what}" data-context-action="([^"]+)"`, 'g'))].map(
        match => match[1],
      ),
      [`desktop-${what}`, remove],
    );
  assert.match(html, /id="compact-launcher"[^>]*aria-controls="yard-context-menu"/);
});

test('atmosphere owns season and sound; Friends & AI owns automatic chat', async () => {
  const html = await read('src/index.html');
  const atmosphere = html.slice(
    html.indexOf('aria-labelledby="scene-atmosphere-label"'),
    html.indexOf('id="yard-controls-panel"'),
  );
  for (const id of ['scene-season', 'sound-button', 'sound-volume']) assert.ok(atmosphere.includes(`id="${id}"`));
  assert.doesNotMatch(html, /id="(?:season|sound-on|settings-yard|scene-back|play-back)"/);
  const ai = html.slice(html.indexOf('id="settings-ai"'), html.indexOf('id="settings-agents"'));
  for (const id of ['ai-connections', 'ai-add', 'auto-chatter']) assert.ok(ai.includes(`id="${id}"`));
  // Adding a connection stays in reach however many there are already.
  assert.ok(ai.indexOf('id="ai-add"') < ai.indexOf('id="ai-connections"'));
  // Coding tools open with one sentence; how the hook gets in waits behind a disclosure.
  const agents = html.slice(
    html.indexOf('id="settings-agents"'),
    html.indexOf('class="link-list"', html.indexOf('id="settings-agents"')),
  );
  assert.match(agents, /data-i18n="settings\.agents_lead"/);
  assert.match(
    agents,
    /<details class="settings-more"><summary data-i18n="settings\.agents_how"><\/summary><p class="settings-lead" data-i18n="settings\.agents_detail"><\/p><\/details>/,
  );
  const general = html.slice(html.indexOf('id="settings-general"'), html.indexOf('id="settings-ai"'));
  assert.doesNotMatch(general, /id="auto-chatter"/);
  const about = html.slice(html.indexOf('id="settings-about"'), html.indexOf('</aside>'));
  assert.doesNotMatch(about, /id="quit-app"/, 'quitting lives with Close window, not in About');
});

test('friend actions use the sheet bounds rather than the short identity row', async () => {
  const css = await read('src/styles/panel.css');
  assert.match(css, /body\.compact \.friend-head:has\(\.pop-menu:not\(\[hidden\]\)\)[^{]*\{[^}]*position:\s*static/s);
});

test('window actions live in the window section of the menu, not a disclosure', async () => {
  const html = await read('src/index.html');
  const windowPage = html.slice(html.indexOf('id="management-window"'), html.indexOf('<div id="play-panel"'));
  for (const id of ['always-on-top', 'fullscreen', 'desktop', 'desktop-wander', 'hide-window', 'menu-quit'])
    assert.ok(windowPage.includes(`id="${id}"`));
  assert.doesNotMatch(windowPage, /<details/);
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

test('the tool strip takes the place of the dock, where Play was opened and just above the ground', async () => {
  const html = await read('src/index.html');
  const lane = html.slice(html.indexOf('<div class="yard-feedback">'), html.indexOf('id="catch-card"'));
  assert.ok(!lane.includes('id="discovery-target"'), 'the strip is not in the lane of messages');
  assert.ok(html.indexOf('id="discovery-target"') < html.indexOf('id="scene-menu"'), 'it sits with the dock');
  const shell = await read('src/styles/shell.css');
  assert.match(shell, /\.yard-frame:has\(#discovery-target:not\(\[hidden\]\)\) \.yard-dock\s*\{[^}]*display:\s*none/s);
  const garden = await read('src/styles/garden.css');
  assert.match(garden, /\.discovery-target\s*\{[^}]*position:\s*absolute;[^}]*right:\s*12px;[^}]*bottom:\s*12px/s);
});

test('the tree picker is one button with a menu of saplings, however many kinds there are', async () => {
  const html = await read('src/index.html');
  const strip = html.slice(html.indexOf('id="discovery-target"'), html.indexOf('id="scene-menu"'));
  assert.match(strip, /id="discovery-tree-button"[^>]*aria-haspopup="menu"[^>]*aria-controls="discovery-tree-choices"/);
  assert.match(strip, /id="discovery-tree-choices"[^>]*role="menu"[^>]*hidden/);
  const garden = await read('src/styles/garden.css');
  // A menu above the strip in a large window, where the strip stands on the ground's edge…
  assert.match(
    garden,
    /\.tree-menu\s*\{[^}]*position:\s*absolute;[^}]*bottom:\s*calc\(100% \+ 6px\);[^}]*overflow-y:\s*auto/s,
  );
  const compact = await read('src/styles/compact.css');
  // …and below it in a small window, where the strip is up in the sky.
  assert.match(compact, /body\.compact \.tree-menu\s*\{[^}]*top:\s*calc\(100% \+ 6px\);[^}]*bottom:\s*auto/s);
  const menu = await read('src/core/menu.js');
  assert.match(menu, /menuitemradio/, 'the shared menu moves through and closes on a radio choice too');
});

test('a small window keeps the ground clear: the tool strip goes up into the sky, in one row', async () => {
  const compact = await read('src/styles/compact.css');
  const rule = selector => {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return compact.match(new RegExp(`(?:^|\\}|\\*/)\\s*${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] || '';
  };
  assert.match(rule('body.compact .discovery-target'), /top:\s*8px;[^}]*bottom:\s*auto/s);
  assert.match(rule('body.compact .discovery-target'), /display:\s*grid;/);
  // The instruction stays for screen readers; the tools, Close and the marker on the ground show the rest.
  assert.match(rule('body.compact .discovery-target-heading'), /display:\s*contents/);
  assert.match(rule('body.compact #discovery-target-label'), /clip-path:\s*inset\(50%\)/);
  // The window's own buttons would land on the strip at the top; the strip's Close and Esc come first.
  assert.match(
    compact,
    /body\.compact:has\(#discovery-target:not\(\[hidden\]\)\)\s*\.window-buttons\s*\{[^}]*display:\s*none/s,
  );
  const shell = await read('src/styles/shell.css');
  // The lane of messages stays at the foot, below the ground, instead of rising over it.
  assert.match(
    shell,
    /body\.compact \.yard-frame:has\(#discovery-target:not\(\[hidden\]\)\) \.yard-feedback\s*\{[^}]*bottom:\s*8px/s,
  );
});

test("Tab goes round a small window's panel instead of on to friends hidden behind it", () => {
  const [first, middle, last] = ['first', 'middle', 'last'];
  const stops = [first, middle, last];
  assert.equal(wrapTab(stops, last, false), first, 'past the last stop');
  assert.equal(wrapTab(stops, first, true), last, 'back past the first stop');
  assert.equal(wrapTab(stops, 'panel title', true), last, 'back from the title a panel opens on');
  assert.equal(wrapTab(stops, middle, false), null, 'the browser moves between stops itself');
  assert.equal(wrapTab(stops, middle, true), null);
  assert.equal(wrapTab(stops, 'panel title', false), null, 'forward from the title is the first stop already');
  assert.equal(wrapTab([], 'panel title', true), null);
});
