// Cross-engine UI contracts: the same stylesheet renders in WebKit (macOS, Linux)
// and WebView2/Chromium (Windows), so nothing may rely on engine-default widget chrome.

import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

// The stylesheet is split by area; the contracts below hold for all of it together. It is read
// without comments and without the spaces a formatter puts around punctuation, so the checks
// below see `a{b:c}` however the files are laid out.
const compact = css =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{};:,>()])\s*/g, '$1')
    .replace(/\s+/g, ' ');
const styles = async () =>
  compact(
    (await Promise.all((await readdir('src/styles')).sort().map(f => readFile(`src/styles/${f}`, 'utf8')))).join('\n'),
  );

test('in-row icon buttons share the rect-input shape language (circles stay for floating controls)', async () => {
  const css = await styles();
  const rule = css.match(/\.provider-row \.icon-button\{([^}]*)\}/);
  assert.ok(rule, 'provider-row scopes its icon button');
  assert.match(rule[1], /border-radius:\s*9px/, 'icon button beside the select matches the 9px input radius');
});

test('select boxes are fully custom-styled so every engine renders them identically', async () => {
  const css = await styles();
  const match = css.match(/(?:^|[{}; ])select\{([^}]*)\}/);
  assert.ok(match, 'the stylesheet declares a bare `select` rule');
  const body = match[1];
  assert.match(body, /appearance:\s*none/, 'select opts out of engine-native appearance');
  assert.match(body, /background-image:/, 'select draws its own dropdown arrow');
  assert.match(body, /padding-right:/, 'select reserves space for the custom arrow');
});

test('the window never rubber-bands sideways (macOS trackpad overscroll)', async () => {
  const css = await styles();
  assert.match(css, /html,body\{[^}]*overscroll-behavior-x:\s*none/, 'horizontal overscroll is disabled on the page');
});

test('the three panel tabs are siblings, so opening one never hides inside another', async () => {
  const html = await readFile('src/index.html', 'utf8');
  const tags = [...html.matchAll(/<(\/?)(div|aside|section|details|form|nav)\b[^>]*>/g)];
  const stack = [],
    parents = {};
  for (const t of tags) {
    if (t[1]) {
      stack.pop();
      continue;
    }
    const id = t[0].match(/ id="([^"]+)"/)?.[1];
    if (id?.startsWith('panel-')) parents[id] = stack.at(-1);
    stack.push(id || t[2]);
  }
  assert.deepEqual(parents, {
    'panel-pet': 'side-panel',
    'panel-invite': 'side-panel',
    'panel-settings': 'side-panel',
  });
  assert.equal(stack.length, 0, 'every container is closed');
});

test('the logo is drawn and text uses the system font, so no system lacks the brand typeface', async () => {
  const html = await readFile('src/index.html', 'utf8'),
    css = await styles();
  assert.match(
    html,
    /<a class="brand"[^>]*>\s*<img[^>]*>\s*<svg class="wordmark"[^>]*aria-label="PlayPets"/,
    'the wordmark is an inline drawing',
  );
  assert.match(css, /:root\{[^}]*font-family:system-ui/, 'body text starts from the system font');
  assert.doesNotMatch(css, /Avenir/, 'no typeface that only one system ships');
});

test('the mini yard always fills its window, whatever the narrow-window layout says', async () => {
  const css = await styles();
  const narrow = css.match(/@media\(max-width:760px\)\{[^@]*?\.yard\{[^}]*height:340px/);
  assert.ok(narrow, 'narrow windows give the yard a fixed height');
  const mini = css.match(/body\.mini \.yard\{([^}]*)\}/g).join('');
  assert.match(mini, /height:auto/, 'mini undoes the fixed height, or a small window shows only sky');
  assert.match(mini, /flex:1/);
  assert.match(css, /body\.mini \.app-shell\{[^}]*height:100%/, 'the mini shell is exactly one window tall');
});

// Windows serves custom protocols as http://<scheme>.localhost, macOS and Linux as <scheme>://.
// A page whose CSP allows only one of them shows no pets on the other systems.
test('both pages let in every sprite address the app builds', async () => {
  const app = await readFile('src-tauri/src/app.rs', 'utf8');
  const body = app.slice(app.indexOf('fn sprite_url'), app.indexOf('\n}', app.indexOf('fn sprite_url')));
  const forms = [...body.matchAll(/format!\("([a-z-]+):\/\/([^/"]+)/g)].map(([, scheme, host]) => ({ scheme, host }));
  assert.equal(forms.length, 2, 'sprite_url has a Windows form and a macOS/Linux form');
  for (const page of ['src/index.html', 'src/overlay.html']) {
    const imgSrc = (await readFile(page, 'utf8')).match(/img-src ([^;]*);/)[1].split(/\s+/);
    for (const { scheme, host } of forms) {
      const allowed = scheme === 'http' ? imgSrc.includes(`http://${host}`) : imgSrc.includes(`${scheme}:`);
      assert.ok(allowed, `${page} blocks ${scheme}://${host} sprites (img-src ${imgSrc.join(' ')})`);
    }
  }
});

test('the shell is sized to the body, not the viewport, so the window border never adds a scrollbar', async () => {
  const css = await styles();
  assert.doesNotMatch(css, /100vh/, 'use 100% of the body: outside macOS the body has a 1px border');
});

test('a long credit line on the shelf never widens the invite panel', async () => {
  const css = await styles();
  // The shelf group is a grid and the card a flex box: both size to their content unless told
  // not to, and one nowrap credit line would then push the whole panel sideways.
  assert.match(
    css,
    /\.shelf-group\{[^}]*grid-template-columns:minmax\(0,1fr\)/,
    'the group column may shrink below its content',
  );
  assert.match(css, /\.asset-card\{[^}]*min-width:0/, 'the card may shrink below its content');
  assert.match(
    css,
    /\.asset-info \.asset-from\{[^}]*text-overflow:ellipsis/,
    'the credit line is cut with an ellipsis',
  );
});
