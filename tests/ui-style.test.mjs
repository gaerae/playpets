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

test('everything the yard says shares one lane just above the dock, clear of the strip and the corner button', async () => {
  const css = await styles();
  assert.match(
    css,
    /\.yard-feedback\{[^}]*inset:auto 12px 64px;[^}]*display:flex;[^}]*flex-direction:column;[^}]*gap:6px/,
  );
  // At the bottom by a spacer, so a lane taller than the window can still scroll to its top.
  assert.match(css, /\.yard-feedback::before\{content:"";flex:1 0 0;\}/);
  assert.doesNotMatch(css.match(/\.yard-feedback\{([^}]*)\}/)?.[1] || '', /justify-content:flex-end/);
  assert.match(css, /\.yard-frame:has\(#discovery-target:not\(\[hidden\]\)\)\.yard-feedback\{bottom:106px;/);
  assert.match(css, /body\.compact \.yard-feedback\{inset:auto 52px 8px 8px;/);
  assert.match(css.match(/(?:^|})\.toast\{([^}]*)\}/)?.[1] || '', /pointer-events:none/);
  assert.doesNotMatch(css.match(/(?:^|})\.toast\{([^}]*)\}/)?.[1] || '', /position:absolute/);
  assert.doesNotMatch(css, /\.catch-card\.near/, 'a card no longer stands apart above its finder');
});

test('panels, controls and cards share restrained corner tokens while switches stay round', async () => {
  const css = await styles();
  for (const token of ['panel', 'control', 'card']) assert.match(css, new RegExp(`--radius-${token}:\\d+px`));
  for (const selector of ['\\.asset-card', '\\.appearance-picker \\.appearance-card', '\\.album-card'])
    assert.match(css, new RegExp(`${selector}\\{[^}]*border-radius:var\\(--radius-card\\)`));
  // Round: a corner at least half the switch's height.
  const [, height, radius] = css.match(/\.wander-switch\{[^}]*height:(\d+)px;[^}]*border-radius:(\d+)px/) || [];
  assert.ok(+radius * 2 >= +height, `${radius}px corners on a ${height}px switch`);
});

test('the AI kind, relation and appearance cards are one choice card, chosen and focused alike', async () => {
  const css = await styles(),
    html = await readFile('src/index.html', 'utf8');
  for (const kind of ['ai-type', 'relation-card', 'appearance-card']) {
    const labels = [...html.matchAll(new RegExp(`<label class="([^"]*\\b${kind}\\b[^"]*)"`, 'g'))];
    assert.ok(labels.length > 1, kind);
    for (const [, classes] of labels) assert.match(classes, /\bchoice-card\b/, kind);
    // The chosen state, the focus ring and the hidden radio are the shared rule's alone.
    assert.doesNotMatch(css, new RegExp(`\\.${kind}(\\.on|:has\\()`), kind);
  }
  assert.match(css, /\.choice-card:has\(input:checked\)\{[^}]*background:var\(--control-selected\)/);
  assert.match(css, /\.choice-card:has\(input:focus-visible\)\{outline:var\(--focus-ring\)/);
  assert.match(css, /\.choice-card input\{position:absolute;opacity:0;pointer-events:none/);
});

test('icon actions share the desktop control shape and a compact target', async () => {
  const css = await styles();
  const rule = css.match(/\.menu-anchor>\.icon-button[^{]*\{([^}]*)\}/);
  assert.ok(rule, "the friend panel's menu button has its own rule");
  assert.match(rule[1], /border-radius:var\(--radius-control\)/);
  assert.match(rule[1], /width:36px;height:36px/);
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

test('atmosphere choices keep equal one-line columns across platform fonts', async () => {
  const css = await styles();
  assert.match(
    css,
    /\.atmosphere-segments\{[^}]*grid-template-columns:repeat\(var\(--climate-columns\),minmax\(0,1fr\)\)/,
  );
  assert.match(css, /\.atmosphere-segments span\{[^}]*padding:4px 2px;[^}]*font-weight:500/);
  assert.match(css, /body\.compact \.atmosphere-choice\{[^}]*padding:0 4px/);
  assert.match(css, /body\.compact \.atmosphere-auto\{[^}]*grid-column:1 \/ -1/);
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

test('one yard fills the freely resized window without mode-specific scene rules', async () => {
  const css = await styles();
  assert.doesNotMatch(css, /height:340px/);
  assert.doesNotMatch(css, /body\.mini|mini-chat-open|\.unmini/);
  assert.match(css, /\.window-drag\{[^}]*position:absolute/);
  assert.match(css, /\.app-shell\{[^}]*padding:0;/);
  assert.match(css, /\.yard\{[^}]*flex:1;[^}]*height:auto;[^}]*min-height:0/);
});

test('a small window shows a find in one line: its name, a short New and its book, without Close', async () => {
  const css = await styles();
  assert.match(css, /(?:^|})\.catch-card \.catch-new-short\{display:none;/);
  assert.match(css, /body\.compact \.catch-copy:has\(\.catch-new-short\)\{display:flex;[^}]*align-items:baseline/);
  assert.match(css, /body\.compact \.catch-copy:has\(\.catch-new-short\)\.catch-new\{display:none;/);
  assert.match(css, /body\.compact \.catch-card \.catch-new-short\{display:block;/);
  assert.match(css, /body\.compact \.catch-dismiss\{display:none;/);
});

test('a tool name in a small window takes a second line instead of running into the next tool', async () => {
  const css = await styles();
  assert.match(css, /body\.compact \.discovery-tool\{flex-basis:auto;[^}]*white-space:normal;/);
  assert.match(css, /@media\(max-width:360px\)\{body\.compact \.discovery-tool svg\{display:none;\}\}/);
});

test('a button in a scrolling dock panel draws its focus ring inside, where the scroller cannot cut it', async () => {
  const css = await styles();
  assert.match(css, /\.dock-panel-body button:focus-visible\{outline-offset:-3px;/);
});

test('compact windows keep every panel and shared menu within the viewport', async () => {
  const css = await styles();
  assert.match(css, /body\.compact \.layout.panel-open \.side-panel\{[^}]*inset:8px;[^}]*overflow:hidden/);
  assert.match(css, /body\.compact \.panel-body\{[^}]*overflow-y:auto/);
  assert.match(css, /\.layout.settings-open #panel-settings\{[^}]*display:flex;[^}]*overflow:hidden/);
  for (const selector of ['.yard-controls-panel', '.scene-menu']) {
    const rules = css.split('}').filter(part => part.includes(`${selector}{`));
    assert.ok(
      rules.some(rule => rule.includes('max-height:calc(100% - 76px)')),
      `${selector} in a large window`,
    );
    assert.ok(
      rules.some(rule => rule.includes('max-height:calc(100% - 16px)')),
      `${selector} in a compact window`,
    );
  }
  assert.doesNotMatch(css, /body\.compact[^{}]*(?:#provider-select|\.companions)[^{}]*\{[^}]*display:none/);
});

// At 560 by 400 the Invite sheet shrank to an 18px sliver: a compact rule picking the sheet by
// :has(#panel-invite) set width:auto, and its id outranked the 480-wide rule that sizes every sheet,
// while that rule's left:auto stayed.
test('a small window wide enough for a side sheet gives every destination the same sheet width', async () => {
  const css = await styles();
  assert.doesNotMatch(css, /body\.compact \.layout\.panel-open \.side-panel:has\([^{]*\{[^}]*width:/);
});

test('compact settings reserve height for their scroller and panels clear the dock', async () => {
  const css = await styles();
  const sheet = css.match(/body\.compact \.layout.settings-open \.side-panel\{([^}]*)\}/)?.[1] || '';
  assert.match(sheet, /height:calc\(100% - 16px\)/, 'an absolute sheet has a definite height for its flex body');
  assert.match(sheet, /align-self:stretch/);
});

test('compact chat keeps its composer visible while the log owns scrolling', async () => {
  const css = await styles();
  assert.match(css, /body\.compact #panel-pet\{[^}]*overflow:hidden/);
  assert.match(css, /body\.compact #pet-panel\{[^}]*flex:1;[^}]*min-height:0/);
  assert.match(css, /body\.compact \.chat-log\{[^}]*flex:1;[^}]*min-height:0;[^}]*max-height:none/);
  assert.match(css, /body\.compact \.composer\{[^}]*flex:none/);
  assert.doesNotMatch(
    css,
    /body\.compact #pet-panel\{[^}]*min-height:260px/,
    'small chat does not force a taller sheet than the window',
  );
  assert.doesNotMatch(css, /body\.compact[^{}]*\.relation-chip[^{}]*\{[^}]*display:none/);
});

// At 300 by 210 the panel's title row, the friend's row and the message box left the conversation
// 15px. The friend's row already names who is talking, so the title gives up its row there and the
// panel's buttons sit at the end of the friend's row.
test('the shortest window gives the conversation the row the panel title took', async () => {
  const css = await styles();
  const short = [...css.matchAll(/@media\(max-height:280px\)\{((?:[^{}]*\{[^}]*\})*)\}/g)].map(m => m[1]).join('');
  const head = short.match(
    /body\.compact \.side-panel:has\(#pet-panel:not\(\[hidden\]\)\)>\.panel-head\{([^}]*)\}/,
  )?.[1];
  assert.ok(head, 'a short window lifts the panel head out of the flow while a conversation shows');
  assert.match(head, /position:absolute/);
  assert.match(
    short,
    /body\.compact \.side-panel:has\(#pet-panel:not\(\[hidden\]\)\)#panel-title\{[^}]*clip-path:inset\(50%\)/,
    'the title stays for screen readers',
  );
  // A select's smallest width is its longest option, so in an auto grid column a long name ran
  // under the friend's menu button instead of ending in an ellipsis.
  assert.match(css, /\.friend-id\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
});

// At 560 by 400 the welcome card's second row of starters was cut off at the card's bottom, and at
// 300 by 210 only the tops of two heads showed. A small window draws the starters smaller and puts
// all four in one row where it is wide enough or too short for two.
test('a small window shows the four starters in one row of small pictures', async () => {
  const css = await styles();
  assert.match(css, /body\.compact \.starter canvas\{width:64px;height:69px;?\}/);
  const wide = [...css.matchAll(/@media\(min-width:480px\)\{((?:[^{}]*\{[^}]*\})*)\}/g)].map(m => m[1]).join('');
  assert.match(wide, /body\.compact \.starter-picks\{grid-template-columns:repeat\(4,/);
  const short = [...css.matchAll(/@media\(max-height:280px\)\{((?:[^{}]*\{[^}]*\})*)\}/g)].map(m => m[1]).join('');
  assert.match(short, /body\.compact \.starter-picks\{grid-template-columns:repeat\(4,/);
  assert.match(short, /body\.compact \.starter canvas\{width:44px;height:48px;?\}/);
});

// A small window's Play tiles shared one row per group, so six games at 300 by 210 were 46px each and
// their names broke inside the word (種を植え/る, かくれ/んぼ, Par/ade). Every group is three tiles a
// row, and a name stays whole on one line; only if a font draws it wider than its tile is it cut
// with an ellipsis. The shortest windows put the icon over the name at the smallest step, the seed
// count in the corner, and close the gaps, so the four rows fit without scrolling.
test('a Play name stays whole on one line in a small window', async () => {
  const css = await styles();
  assert.match(css, /body\.compact \.play-actions\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  const tile = css.match(/(?:^|\})body\.compact \.play-action\{([^}]*)\}/)?.[1] || '';
  assert.doesNotMatch(tile, /white-space:normal|overflow-wrap:anywhere|word-break/);
  assert.match(
    css,
    /body\.compact \.play-action>:is\(span\[data-i18n\],\.game-name\)\{[^}]*overflow:hidden;text-overflow:ellipsis/,
  );
  const short = [...css.matchAll(/@media\(max-height:280px\)\{((?:[^{}]*\{[^}]*\})*)\}/g)].map(m => m[1]).join('');
  assert.doesNotMatch(short, /body\.compact \.play-action\{[^}]*flex-direction:row/);
  assert.match(short, /body\.compact \.play-action\{[^}]*font-size:var\(--font-xs\)/);
  assert.doesNotMatch(short, /body\.compact \.play-action>\.tool-count\{[^}]*position:static/);
});

// At 300 by 210 the next-steps card began 112px down, ran past the bottom and went under the corner
// button, and "Hide this" was a 14px-tall target. In a small window it starts at the top and ends
// above the corner button, scrolling if it must.
test('the next steps stay clear of the corner button in a small window, and Hide this is a real target', async () => {
  const css = await styles();
  const aside = css.match(/body\.compact \.empty-yard\.aside\{([^}]*)\}/)?.[1] || '';
  assert.match(aside, /top:8px/);
  assert.match(aside, /max-height:calc\(100% - 60px\)/);
  assert.match(aside, /overflow-y:auto/);
  assert.match(css, /\.empty-yard \.tiny-dismiss\{[^}]*min-height:24px/);
});

// On the desktop a long line showed half of its fourth line under the ellipsis: a clamped box clips
// at its padding's outer edge, so the bubble's vertical padding showed the line that comes next. Its
// room is a transparent border instead, where nothing inside is drawn.
test("a desktop bubble's clamped line ends at the ellipsis", async () => {
  const css = compact(await readFile('src/overlay/overlay.css', 'utf8'));
  const rule = css.match(/(?:^|})\.bubble\{([^}]*)\}/)?.[1] || '';
  assert.match(rule, /-webkit-line-clamp:3/);
  assert.match(rule, /padding:0;/);
  assert.match(rule, /border:8px solid transparent/);
});

// "Garden workshop, a sunny…" was cut at 228px even in a full-screen window, where the dock had
// room to spare: the place's name is the only label saying where the yard is.
test('the place caption grows with the window before it is cut', async () => {
  const css = await styles();
  assert.match(css, /\.yard-dock>\.caption-main\{min-width:0;max-width:clamp\(228px,40vw,360px\);?\}/);
});

// A cricket sat on Miso's name tag on an autumn evening: the weather layer, where the yard's rain,
// snow and creatures are drawn, shared the labels' layer and came after them. It stays over the
// friends and under what they say.
test('rain, snow and creatures pass over the friends but under their names and lines', async () => {
  const css = await styles();
  const z = selector => Number(css.match(new RegExp(`(?:^|})${selector}\\{[^}]*z-index:(\\d+)`))?.[1]);
  assert.ok(z('#pet-layer') <= z('\\.weather-layer'), 'over the friends (it comes after them)');
  assert.ok(z('\\.weather-layer') < z('\\.label-layer'), 'under their names and lines');
});

// Squeezed onto one line in a short window, the message lost its words ("今日はどんな一日だ…") and
// the AI its name ("Oll…"). The message keeps its own row and the AI stays readable under it.
test('a short window keeps the message on its own row and the AI readable', async () => {
  const css = await styles();
  assert.doesNotMatch(css, /body\.compact \.composer\{[^}]*display:flex/);
  assert.doesNotMatch(css, /\.composer-select\{[^}]*max-width:64px/);
});

test('all eight resize boundaries are invisible and stay above the window surfaces', async () => {
  const css = await styles();
  assert.match(css, /\.window-resize\{[^}]*position:fixed;[^}]*z-index:1000;[^}]*touch-action:none/);
  for (const direction of ['North', 'South', 'East', 'West', 'NorthEast', 'NorthWest', 'SouthEast', 'SouthWest'])
    assert.ok(css.includes(`.window-resize[data-resize="${direction}"]{`), direction);
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

test('an agent friend picker shrinks within its row beside the localized label', async () => {
  const css = await styles();
  assert.match(
    css,
    /\.link-row \.agent-pet \.language-select\{[^}]*flex:1/,
    'the friend picker shares the remaining row width instead of keeping its intrinsic width',
  );
});

test('the scene gallery keeps its selected background and climate controls reachable', async () => {
  const [html, sky, backgrounds] = await Promise.all(
    ['src/index.html', 'src/yard/sky.js', 'src/yard/background-ui.js'].map(path => readFile(path, 'utf8')),
  );
  assert.match(html, /id="background-gallery"/);
  assert.match(html, /id="scene-season"/);
  assert.match(sky, /scene-season/);
  assert.match(sky, /scene-page:not\(\[hidden\]\)/);
  assert.match(sky, /page\?\.querySelector\('\[aria-pressed="true"\]'\)/);
  assert.match(sky, /select:not\(\[hidden\]\):not\(:disabled\)/);
  assert.match(backgrounds, /aria-pressed/);
  assert.match(backgrounds, /dispatchEvent\(new Event\('change'\)\)/);
});

test('Settings owns a body scroller while its header and navigation stay outside it', async () => {
  const [html, css] = await Promise.all([readFile('src/index.html', 'utf8'), styles()]);
  const start = html.indexOf('id="settings-content"');
  assert.ok(start > html.indexOf('class="settings-index"'));
  assert.ok(start < html.indexOf('id="settings-general"'));
  assert.match(css, /\.layout.settings-open \.side-panel\{[^}]*overflow:hidden/);
  assert.match(css, /\.layout.settings-open \.side-panel\{[^}]*bottom:auto;/);
  assert.match(css, /\.layout.settings-open \.side-panel\{[^}]*max-height:calc\(100% - 96px\);/);
  assert.match(css, /\.settings-content\{[^}]*overflow-y:auto/);
});

test('Menu hover and selected settings states remain distinct', async () => {
  const css = await styles();
  assert.match(css, /\.yard-controls-panel \.panel-tab:hover\{[^}]*var\(--control-hover\)/);
  assert.match(css, /\.settings-index button:hover\{[^}]*var\(--control-hover\)/);
  assert.match(css, /\.album-tabs button\[aria-selected="true"\]\{[^}]*var\(--segment-active\)/);
});

// Every declaration can apply: none is always replaced by a later rule for the same selector across
// the yard page's stylesheets, in the order index.html loads them. A later rule replaces an earlier
// one when it applies whenever the earlier does: outside any media, in the same media, or in a
// wider width query (max-width: 1100px covers max-width: 760px); and when it sets the property or a
// shorthand that includes it (padding includes padding-left).
const SHORTHANDS = {
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'padding-block', 'padding-inline'],
  'padding-block': ['padding-block-start', 'padding-block-end'],
  'padding-inline': ['padding-inline-start', 'padding-inline-end'],
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'margin-block', 'margin-inline'],
  'margin-block': ['margin-block-start', 'margin-block-end'],
  'margin-inline': ['margin-inline-start', 'margin-inline-end'],
  inset: ['top', 'right', 'bottom', 'left', 'inset-block', 'inset-inline'],
  gap: ['row-gap', 'column-gap'],
  overflow: ['overflow-x', 'overflow-y'],
  flex: ['flex-grow', 'flex-shrink', 'flex-basis'],
  'place-items': ['align-items', 'justify-items'],
  'place-content': ['align-content', 'justify-content'],
  'place-self': ['align-self', 'justify-self'],
  border: [
    'border-width',
    'border-style',
    'border-color',
    'border-top',
    'border-right',
    'border-bottom',
    'border-left',
  ],
  'border-top': ['border-top-width', 'border-top-style', 'border-top-color'],
  'border-right': ['border-right-width', 'border-right-style', 'border-right-color'],
  'border-bottom': ['border-bottom-width', 'border-bottom-style', 'border-bottom-color'],
  'border-left': ['border-left-width', 'border-left-style', 'border-left-color'],
  'border-width': ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
  'border-style': ['border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style'],
  'border-color': ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  'border-radius': [
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius',
  ],
  background: [
    'background-color',
    'background-image',
    'background-position',
    'background-size',
    'background-repeat',
    'background-clip',
    'background-origin',
    'background-attachment',
  ],
  font: ['font-size', 'font-weight', 'font-family', 'font-style', 'font-variant', 'font-stretch', 'line-height'],
  'grid-template': ['grid-template-columns', 'grid-template-rows', 'grid-template-areas'],
  'text-decoration': [
    'text-decoration-line',
    'text-decoration-color',
    'text-decoration-style',
    'text-decoration-thickness',
  ],
  'list-style': ['list-style-type', 'list-style-position', 'list-style-image'],
  transition: [
    'transition-property',
    'transition-duration',
    'transition-timing-function',
    'transition-delay',
    'transition-behavior',
  ],
  animation: [
    'animation-name',
    'animation-duration',
    'animation-timing-function',
    'animation-delay',
    'animation-iteration-count',
    'animation-direction',
    'animation-fill-mode',
    'animation-play-state',
  ],
  outline: ['outline-width', 'outline-style', 'outline-color'],
};
/** Whether setting `later` sets `earlier` too (itself, or a shorthand over it, at any depth). */
const covers = (later, earlier) => later === earlier || (SHORTHANDS[later] || []).some(part => covers(part, earlier));
/** One spelling for one selector: spaces around combinators and inside parentheses, quotes. */
const normalSelector = sel =>
  sel
    .replace(/\s+/g, ' ')
    .replace(/ ?([>+~,]) ?/g, '$1')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')')
    .replace(/'/g, '"')
    .trim();
const important = value => /!\s*important$/i.test(value);
/** Splits on `sep` outside parentheses and brackets. */
const splitTop = (text, sep) => {
  const parts = [];
  let depth = 0,
    from = 0;
  for (let k = 0; k < text.length; k++) {
    const c = text[k];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === sep && depth === 0) {
      parts.push(text.slice(from, k));
      from = k + 1;
    }
  }
  return [...parts, text.slice(from)].map(p => p.trim()).filter(Boolean);
};
/** Whether a rule in `later` media applies whenever one in `earlier` media does. */
const appliesWhenever = (later, earlier) => {
  if (later === '' || later === earlier) return true;
  // One width condition, in a media or a container query (of the same name).
  const width = at => /^(@media|@container(?: [\w-]+)?) \((max|min)-width: *(\d+)px\)$/.exec(at);
  const [a, b] = [width(earlier), width(later)];
  return !!a && !!b && a[1] === b[1] && a[2] === b[2] && (a[2] === 'max' ? +b[3] >= +a[3] : +b[3] <= +a[3]);
};
export function parseRules(css, file = '') {
  // Comments go, and inside strings and url(…) braces, commas and semicolons stand for nothing.
  const text = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Statement at-rules (@import, @charset, @layer a, b;) hold no declarations.
    .replace(/@[a-z-]+[^{};]*;/g, '')
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|url\([^)]*\)/g, m => m.replace(/[{};,]/g, '\u2400'));
  const rules = [];
  const walk = (body, media) => {
    let i = 0;
    for (;;) {
      const open = body.indexOf('{', i);
      if (open < 0) return;
      const head = body.slice(i, open).trim();
      let depth = 1,
        k = open + 1;
      for (; depth; k++) depth += body[k] === '{' ? 1 : body[k] === '}' ? -1 : 0;
      const inner = body.slice(open + 1, k - 1);
      if (head.startsWith('@keyframes')) {
        // its steps are not rules
      } else if (head.startsWith('@')) {
        const at = head.replace(/\s+/g, ' ');
        walk(inner, media ? `${media} ${at}` : at);
      } else {
        const props = Object.fromEntries(
          splitTop(inner, ';')
            // A nested rule (&:hover { … }) is not a declaration.
            .filter(p => p.includes(':') && !/[{}&]/.test(p))
            .map(p => [p.slice(0, p.indexOf(':')).trim(), p.slice(p.indexOf(':') + 1).trim()]),
        );
        for (const sel of splitTop(head, ',')) rules.push({ file, media, sel: normalSelector(sel), props });
      }
      i = k;
    }
  };
  walk(text, '');
  return rules;
}
export function replacedDeclarations(rules, refined = new Set()) {
  const replaced = [];
  rules.forEach((a, n) => {
    for (const [prop, value] of Object.entries(a.props)) {
      if (refined.has(`${a.sel} ${prop}`)) continue;
      // An !important declaration gives way only to a later !important one.
      const later = rules
        .slice(n + 1)
        .find(
          b =>
            b.sel === a.sel &&
            appliesWhenever(b.media, a.media) &&
            Object.entries(b.props).some(([p, v]) => covers(p, prop) && (!important(value) || important(v))),
        );
      if (later)
        replaced.push(`${a.file} ${a.media} ${a.sel} { ${prop} } ← ${later.file} ${later.media}`.replace(/ +/g, ' '));
    }
  });
  return replaced;
}

test('no declaration is always replaced by a later rule for the same selector', async () => {
  const page = await readFile('src/index.html', 'utf8');
  const files = [...page.matchAll(/href="styles\/([\w-]+\.css)"/g)].map(m => m[1]);
  const rules = (
    await Promise.all(files.map(async f => parseRules(await readFile(`src/styles/${f}`, 'utf8'), f)))
  ).flat();
  // A group rule refined on purpose right after it.
  assert.deepEqual(replacedDeclarations(rules, new Set(['.paint-land z-index'])), []);
});

test('the replaced-declaration check sees through strings, pseudo-class lists, shorthands and widths', () => {
  const found = css => replacedDeclarations(parseRules(css)).length;
  assert.equal(found('.a{color:red}.a{color:blue}'), 1, 'same selector, same property');
  assert.equal(found('.a{padding-left:3px}.a{padding:0}'), 1, 'a later shorthand');
  assert.equal(found('.a{padding:0}.a{padding-left:3px}'), 0, 'a later longhand refines');
  assert.equal(found('@media (max-width: 760px){.a{order:5}}@media (max-width: 1100px){.a{order:6}}'), 1);
  assert.equal(found('@media (max-width: 1100px){.a{order:6}}@media (max-width: 760px){.a{order:5}}'), 0);
  assert.equal(found('@media (max-width: 760px){.a{order:5}}.a{order:1}'), 1, 'a later base rule');
  assert.equal(found('.a{order:1}@media (max-width: 760px){.a{order:5}}'), 0, 'a later media rule refines');
  assert.equal(found('.a::after{content:"}"}.b{color:red}.b{color:blue}'), 1, 'a brace in a string');
  assert.equal(found(':is(.a, .b) .c{color:red}:is(.x, .b) .c{color:blue}'), 0, 'commas inside :is()');
  assert.equal(found('.a{background:url(data:image/svg+xml;charset=utf-8,x)}.a{color:red}'), 0, 'a ; in url()');
  assert.equal(found('.a>.b{color:red}.a > .b{color:blue}'), 1, 'one selector, two spellings');
  assert.equal(found(':not(.a,.b){color:red}:not(.a, .b){color:blue}'), 1);
  assert.equal(found('[data-x="1"]{color:red}[data-x=\'1\']{color:blue}'), 1, 'either quote');
  assert.equal(found('[title="a,b"]{color:red}[title="a_b"]{color:blue}'), 0, 'masked strings stay apart');
  assert.equal(found('@layer base, theme;.a{color:red}.a{color:blue}'), 1, 'a statement at-rule');
  assert.equal(found('@container (max-width: 600px){.a{order:1}}@container (max-width: 800px){.a{order:2}}'), 1);
  assert.equal(found('.a{border-top-color:red}.a{border:0}'), 1, 'a shorthand two levels up');
  assert.equal(found('.a{color:red !important}.a{color:blue}'), 0, '!important outlasts a later plain rule');
  assert.equal(found('.a{color:red ! IMPORTANT}.a{color:blue !important}'), 1, 'and gives way to a later !important');
  assert.equal(found('.a{color:red;&:hover{color:blue}}'), 0, 'nesting is not a declaration');
});

// A custom property defined as itself is invalid, and the cycle silently empties every use of it.
test('no custom property is defined from itself', async () => {
  for (const file of await readdir('src/styles')) {
    const css = await readFile(`src/styles/${file}`, 'utf8');
    for (const [, name, value] of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))
      assert.ok(!value.includes(`var(${name})`) && !value.includes(`var(${name},`), `${file}: ${name}: ${value}`);
  }
});

// A custom property the page sets from code rather than in a stylesheet, and the file that sets it.
const SET_FROM_CODE = {
  '--dig-scale': 'src/yard/work.js',
  '--dig-duration': 'src/yard/work.js',
  '--dig-contact': 'src/yard/work.js',
  '--dig-toss': 'src/yard/work.js',
  '--head': 'src/core/sprites.js',
  '--orb-x': 'src/yard/sky.js',
  '--orb-y': 'src/yard/sky.js',
  '--moon-lit': 'src/yard/sky.js',
  '--bubble-lift': 'src/yard/views.js',
  '--bubble-shift': 'src/yard/views.js',
  '--depth': 'src/yard/views.js',
  '--album-found': 'src/panel/album.js',
  '--trail-opacity': 'src/yard/trails.js',
  '--petal-x': 'src/yard/petals.js',
  '--petal-turn': 'src/yard/petals.js',
  '--shade-w': 'src/yard/decor.js',
  '--shade-h': 'src/yard/decor.js',
  '--shade-y': 'src/yard/decor.js',
  '--shade-x': 'src/yard/decor.js',
  '--foot-x': 'src/yard/decor.js',
  '--foot-y': 'src/yard/decor.js',
  '--foot-w': 'src/yard/decor.js',
  '--foot': 'src/yard/garden.js',
  '--sway': 'src/yard/props.js',
};
// A misspelt or removed token silently falls back to the property's initial value (no colour, no
// size), so every one a stylesheet reads has to come from somewhere.
test('every custom property a stylesheet reads is defined in one or set from code', async () => {
  const files = (await readdir('src/styles')).sort();
  const css = (await Promise.all(files.map(f => readFile(`src/styles/${f}`, 'utf8'))))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const known = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  for (const [name, file] of Object.entries(SET_FROM_CODE)) {
    assert.ok((await readFile(file, 'utf8')).includes(`setProperty('${name}'`), `${file} sets ${name}`);
    known.add(name);
  }
  // The season's colours, which sky.js sets on the yard and the painter (yard/easel.js) reads.
  const { SEASON_COLORS } = await import('../src/yard/scene.js');
  for (const periods of Object.values(SEASON_COLORS))
    for (const colors of Object.values(periods)) for (const name of Object.keys(colors)) known.add(name);
  const read = new Set([...css.matchAll(/var\(\s*(--[\w-]+)/g)].map(m => m[1]));
  assert.deepEqual(
    [...read].filter(name => !known.has(name)),
    [],
  );
});

// A token with only a dark value means nothing in light mode, so only dark rules may read it.
test('a token defined only for dark mode is read only by dark rules', async () => {
  const dark = media => media.includes('prefers-color-scheme: dark');
  const rules = (
    await Promise.all(
      (await readdir('src/styles')).map(async f => parseRules(await readFile(`src/styles/${f}`, 'utf8'), f)),
    )
  ).flat();
  const definedIn = new Map();
  for (const r of rules)
    for (const prop of Object.keys(r.props))
      if (prop.startsWith('--')) definedIn.set(prop, [...(definedIn.get(prop) || []), r.media]);
  const darkOnly = [...definedIn].filter(([, media]) => media.every(dark)).map(([name]) => name);
  // Every token now has a light value too; the check stays for the next one added in dark alone.
  assert.ok(definedIn.get('--ink')?.some(dark), 'the dark tokens are found');
  const misread = rules.flatMap(r =>
    dark(r.media)
      ? []
      : Object.entries(r.props)
          .filter(([, value]) => darkOnly.some(name => new RegExp(`var\\(\\s*${name}[\\s,)]`).test(value)))
          .map(([prop]) => `${r.file} ${r.sel} { ${prop} }`),
  );
  assert.deepEqual(misread, []);
});

// A moment's glow (sunshower, mist, moonlit snow) lies over the land, under the friends; a room's
// furniture fronts are cut from the land above it and would show its edges as boxes.
test("a sky moment's glow stays out of rooms, where furniture fronts would show its edges", async () => {
  const css = await styles();
  assert.match(css, /\.yard\[data-soil="false"\] \.moment-layer\{display:none;?\}/);
});

// The agent's state rides in the name tag, beside the name: by the head it floated off a friend
// drawn smaller at the back, and a seated friend's head is where a desk's laptop is.
// Where it sits in the tag is yard-lifecycle.test.mjs's.
// A tag with an agent cut both names at once ("Sir Wiggleton F… • Cl…"), so neither could be read.
// It is wider, so the agent's name fits beside a long friend's, and the agent's whole name is its
// tooltip when it is cut anyway.
test('a name tag with an agent has room for both names', async () => {
  const [css, views] = await Promise.all([styles(), readFile('src/yard/views.js', 'utf8')]);
  assert.match(css, /\.pet-tag:has\(small:not\(\[hidden\]\)\)\{max-width:210px;?\}/);
  assert.match(css, /\.pet-tag:has\(small:not\(\[hidden\]\)\)\.tag-name\{flex:none;max-width:110px;?\}/);
  assert.match(views, /put\(v\.agents, 'title', joinList\(agents\)\)/);
});

test("the agent's state dot flows in the name tag instead of floating over the friend", async () => {
  const css = await styles();
  const rule = css.match(/\.pet-state-dot\{([^}]*)\}/)?.[1] || '';
  assert.doesNotMatch(rule, /position:absolute/);
});

test('indoor flowers use a planter without blocking their controls', async () => {
  const css = await styles();
  const rule = css.match(/\.yard\[data-soil="false"\] \.plant::after\{([^}]*)\}/)?.[1] || '';
  assert.match(rule, /indoor-planter\.webp/);
  assert.match(rule, /pointer-events:none/);
  await readFile('src/art/decor/indoor-planter.webp');
});

// A lit gift keeps its own colours from evening on, but a gift with the keyboard focus shows its
// ring (`.decor:focus-visible svg`, a drop shadow after the light) at every time of day. A filter
// set outright on the lit gift's drawing would be more specific than the ring and hide it; leaving
// the light unset lets the ring's rule draw the ring alone.
test('a lit gift keeps its colours in the evening and at night, and still shows the focus ring', async () => {
  const css = await styles();
  assert.match(css, /\.decor:focus-visible svg\{filter:var\(--prop-light,\)drop-shadow\(0 0 2px var\(--focus\)\);\}/);
  assert.doesNotMatch(
    css,
    /\[data-effects~="glow"\][^{]*svg[^{]*\{[^}]*filter:/,
    'no filter on a lit drawing outranks the ring',
  );
  for (const period of ['evening', 'night'])
    assert.match(
      css,
      new RegExp(`\\.period-${period} \\.decor\\[data-effects~="glow"\\][,{][^}]*--prop-light:initial;`),
      period,
    );
});

test('indoor planters take the light their flowers take', async () => {
  const css = await styles();
  assert.match(css, /\.yard\[data-soil="false"\] \.plant::after\{[^}]*filter:var\(--prop-light,none\);/);
});

// A grey dimming left the gifts, the bush and the plants a neutral grey against the night's blue
// snow and grass; one tint (index.html #night-tint) darkens them toward that blue instead.
test('at night the drawings in the yard darken toward the blue of the night, all with one tint', async () => {
  const css = await styles();
  assert.doesNotMatch(css, /brightness\(0\.6[0-9]*\)saturate/, 'no grey night dimming is left');
  // The yard's light at night is the tint (garden.css --prop-light), and every drawing takes it.
  assert.match(css, /\.yard\.period-night\{--prop-light:url\(#night-tint\);\}/);
  const escape = selector => selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const selector of ['.decor svg', '.decor>.ornaments', '.plant svg>use', '.planted-tree svg>use'])
    assert.match(css, new RegExp(`(^|\\})${escape(selector)}\\{[^}]*filter:var\\(--prop-light,none\\);`), selector);
  assert.match(css, /\.period-night \.trail-end svg\{filter:url\(#night-tint\);\}/);
  const page = await readFile('src/index.html', 'utf8');
  const matrix = page.match(/<filter id="night-tint"[^>]*>\s*<feColorMatrix type="matrix" values="([^"]+)"/);
  assert.ok(matrix, 'the tint is in the page');
  const m = matrix[1].trim().split(/\s+/).map(Number);
  const gain = row => m.slice(row * 5, row * 5 + 3).reduce((a, b) => a + b, 0);
  assert.ok(gain(2) > gain(1) && gain(1) > gain(0), 'blue kept most, red least');
  assert.ok(gain(0) < 0.62 && gain(2) < 0.9, 'darker than day');
  // A white, a warm cream or the snowman's painted white (a touch pink) reads as moonlit white: a
  // pale grey-blue with the night snow's own hue (green about a third of the way from red to blue,
  // as on the yard's snow at night), not lilac.
  const tint = rgb => [0, 1, 2].map(row => m.slice(row * 5, row * 5 + 3).reduce((a, k, i) => a + k * rgb[i], 0));
  for (const white of [
    [1, 1, 1],
    [1, 0.95, 0.88],
    [0.85, 0.81, 0.84],
  ]) {
    const [r, g, b] = tint(white);
    assert.ok((g - r) / (b - r) >= 0.3, `${white}: the night snow's blue, not lilac`);
    assert.ok((b - r) / b < 0.3, `${white}: pale, not a strong blue`);
    assert.ok(r > 0.42, `${white}: still light beside the night's snow`);
  }
  assert.deepEqual(m.slice(15), [0, 0, 0, 1, 0], 'alpha untouched');
});

test('indoor growth stages enter the planter mouth without moving mature stems', async () => {
  const css = await styles();
  assert.match(
    css,
    /\.yard\[data-soil="false"\] \.plant:not\(\[data-stage="bloom"\]\)svg\{position:relative;top:-12%;/,
  );
});

test('game notices and discoveries share a bounded flow outside the field', async () => {
  const css = await styles();
  assert.match(css, /\.yard-feedback\{[^}]*position:absolute;[^}]*inset:auto 12px 64px;[^}]*overflow-y:auto/);
  for (const selector of ['.game-banner', '.catch-card']) {
    const rule = css.match(new RegExp(`(?:^|})\\${selector}\\{([^}]*)\\}`))?.[1] || '';
    assert.doesNotMatch(rule, /position:absolute|top:112px/);
  }
});

test('startup notices float above the yard instead of shrinking it into a disconnected panel', async () => {
  const css = await styles();
  assert.match(css, /\.startup-notice\{[^}]*max-width:/);
  assert.match(css, /#warning-messages\{[^}]*overflow-y:auto/);
  const html = await readFile('src/index.html', 'utf8');
  assert.match(html, /<details id="warning-details">/);
  assert.match(html, /id="dismiss-warnings"/);
});

test('pin switches show their selected state for every window size', async () => {
  const css = await styles();
  assert.match(css, /\.view-toggle\[aria-pressed="true"\] \.wander-switch[^{]*\{[^}]*background:var\(--green-ink\)/);
  assert.match(
    css,
    /\.view-toggle\[aria-pressed="true"\] \.wander-switch::after[^{]*\{[^}]*transform:translateX\(12px\)/,
  );
});

test('the seed count stays inside its tile however narrow the tile is', async () => {
  const css = await styles();
  const rule = css.match(/(?:^|})\.play-action>\.tool-count\{([^}]*)\}/)?.[1] || '';
  assert.match(rule, /position:absolute/);
  assert.match(rule, /right:max\(3px,calc\(50% - 34px\)\)/, 'placed by its right edge, which never passes the tile');
  assert.doesNotMatch(rule, /left:/);
});

test('compact controls hide the dock, offer a corner button and scroll only the panel body', async () => {
  const css = await styles();
  const dock = css.match(/body\.compact \.yard-dock\{([^}]*)\}/)?.[1] || '';
  assert.match(dock, /display:none/);
  assert.doesNotMatch(css, /body\.compact:hover \.yard-dock|body\.compact:focus-within \.yard-dock/);
  assert.match(css, /body\.compact \.yard-controls-panel\{[^}]*inset:8px;[^}]*overflow:hidden/);
  assert.match(css, /\.dock-panel-body\{[^}]*overflow-y:auto/);
  assert.match(css, /body\.compact \.compact-launcher\{[^}]*display:inline-flex/);
  // A small window left on the desktop shows only the yard; the corner buttons (the menu and an
  // update) come with the pointer, the keyboard or their open panel, and a screen without hover keeps them.
  assert.match(
    css,
    /@media\(hover:hover\)\{body\.compact:not\(:hover\):is\(\.compact-launcher,\.update-compact\):not\(:focus-visible,\[aria-expanded="true"\]\)\{opacity:0/,
  );
  const html = await readFile('src/index.html', 'utf8');
  assert.match(html, /id="close-controls"/);
});

// WebKit otherwise resolves the flexible scroller to zero inside an auto-height dialog.
test('the collection reserves a viewport-bounded height before laying out its scroller', async () => {
  const css = await styles();
  assert.match(css, /\.album-dialog\{[^}]*height:min\(640px,calc\(100dvh - 16px\)\)/);
});

test('a dialog heading wraps a long word instead of running past the dialog', async () => {
  assert.match(await styles(), /\.dialog-heading h2\{[^}]*overflow-wrap:anywhere/);
});

test('an album tab is as wide as its name, so a long one in Japanese stays on one line', async () => {
  const css = await styles();
  assert.match(css, /\.album-tabs\{[^}]*grid-auto-columns:minmax\(min-content,1fr\)/);
  assert.match(css, /\.album-tabs button\{[^}]*min-width:max-content/);
  assert.match(css, /\.album-tabs button>span\{[^}]*white-space:nowrap/);
});

test('a settings row puts its button under the words when both do not fit, and a long word breaks', async () => {
  const css = await styles();
  // Japanese "現在のバージョン" kept whole ran under Check for updates at 300 by 210.
  assert.match(css, /(?:^|\})\.link-row\{[^}]*flex-wrap:wrap/);
  assert.match(css, /(?:^|\})\.link-row>div\{[^}]*flex:1 1 9em/);
  assert.match(css, /(?:^|\})\.link-row small\{[^}]*overflow-wrap:anywhere/);
});

// At 300 by 210 in English, Import background and Background studio took two lines over the
// gallery; the narrowest small windows keep the pair on one line and let their icons go.
test('the narrowest windows keep the background actions on one line', async () => {
  const css = await styles();
  const narrow = [...css.matchAll(/@media\(max-width:400px\)[^{]*\{((?:[^{}]*\{[^}]*\})*)\}/g)].map(m => m[1]).join('');
  assert.match(narrow, /body\.compact \.dock-section-head \.background-actions\{[^}]*flex-wrap:nowrap/);
  assert.match(narrow, /body\.compact \.dock-section-head \.background-actions \.button svg\{display:none/);
});

// At 300 by 210 in Japanese, "友だちを招待する" broke over two lines beside Import. The narrowest
// windows keep Import's word for screen readers and show its icon.
test('the narrowest windows keep the Invite title on one line', async () => {
  const css = await styles();
  const narrow = [...css.matchAll(/@media\(max-width:400px\)\{((?:[^{}]*\{[^}]*\})*)\}/g)].map(m => m[1]).join('');
  assert.match(
    narrow,
    /body\.compact \.panel-head>#import>span:not\(\[data-icon\]\)\{[^}]*position:absolute;[^}]*clip-path:inset\(50%\)/,
  );
});

// The interface's colours come from tokens with a light and a dark value (base.css), and a themed
// surface (the decorating night) names its palette as tokens on its own root. Only drawn things
// keep colours of their own: the yard's art files, and the marks listed here. Before, 240 raw
// colours were spread over the rules, and some (the Remove button, the Quit hover, the Settings
// shadow) stayed light in dark mode.
test('the interface takes its colours from tokens', async () => {
  const art = new Set(['scenery.css', 'garden.css', 'play.css', 'worn.css']);
  const drawn =
    /\.(?:sun-dot|treat|yard-pet|pet-state-dot|particle|head-petal|album-specimen|album-card\.rare|decorating-stage|decorating-tree|ornament-glint|ornament-hook|decorating-bubble|decorating-status|decorating-kind|ornament-chip::before|pet-label\.dear)\b/;
  const raw = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(|:(?:white|black)\b/i;
  for (const file of (await readdir('src/styles')).filter(name => !art.has(name))) {
    const css = compact(await readFile(`src/styles/${file}`, 'utf8'));
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const declaration of body.split(';')) {
        if (declaration.startsWith('--') || !raw.test(declaration) || drawn.test(selector)) continue;
        assert.fail(`${file}: ${selector.trim()} {${declaration}} uses a colour of its own`);
      }
    }
  }
});

// A window's size changes the page at a few named steps only (docs/standards/page-modules.md): 640
// by 480 is where a window turns small (src/window.js), 480 wide is a small window wide enough for a
// side sheet, 400 by 280 the tiniest, 360 the narrowest, and 1100 a wide one.
test('every media query on the window size uses one of the size tiers', async () => {
  const css = await styles();
  const tiers = { width: [360, 400, 480, 640, 1100], height: [280, 480] };
  const queries = [...css.matchAll(/@media([^{]*)\{/g)].map(m => m[1]);
  for (const query of queries) {
    for (const [, axis, px] of query.matchAll(/(?:min|max)-(width|height):(\d+)px/g)) {
      assert.ok(tiers[axis].includes(Number(px)), `${query.trim()} uses ${axis} ${px}px, which is not a tier`);
    }
  }
});

// Sixteen sizes between 8 and 23px had grown up one rule at a time. Words take one of seven steps,
// none under 11px, the hearts on a name tag too; only drawn marks (a bite, a plus, a sparkle) keep their own.
test('every size of words is a step of the type scale, none under 11px', async () => {
  const css = await styles();
  const steps = Object.fromEntries(
    [...css.matchAll(/--font-([a-z]+):([\d.]+)px/g)].map(([, name, px]) => [name, Number(px)]),
  );
  assert.deepEqual(steps, { xs: 11, sm: 12, md: 13, base: 14, lg: 15, xl: 17, display: 18 });
  const marks = /\.(?:bobber|add-mark|particle)\b/;
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const [, size] of body.matchAll(/(?:^|;)font-size:([^;]+)/g)) {
      if (/^var\(--font-[a-z]+\)$/.test(size) || size === 'inherit' || marks.test(selector)) continue;
      assert.fail(`${selector.trim()} sets font-size:${size} outside the scale`);
    }
  }
});

// A sparrow or a magpie is far smaller than the bush it dives into: its tail and rump stay within
// about a third of the bush's width (41) and half its height (30), and are centred over it.
test('a bird diving into the trail bush is drawn to the bush scale', async () => {
  const css = await styles();
  for (const bird of ['sparrow', 'magpie']) {
    const rule = css.match(new RegExp(`\\.tail-peek\\[data-track="${bird}"\\]\\{([^}]*)\\}`))?.[1] || '';
    const value = name => Number(rule.match(new RegExp(`--${name}:([\\d.]+)`))?.[1]);
    assert.ok(value('w') <= 14, `${bird}: width ${value('w')}`);
    assert.ok(value('h') <= 17, `${bird}: height ${value('h')}`);
    assert.ok(Math.abs(value('x') + value('w') / 2 - 24) <= 1.5, `${bird}: over the crown's middle`);
  }
});

// The sleigh over the moon is a silhouette in the night's own dark blue with a thin backlit rim,
// not a black cut-out haloed in gold, which read as a sticker on the sky (most of all when still).
test('the sleigh is a night-blue silhouette with a thin rim', async () => {
  const css = await styles();
  const filter = css.match(/\.xmas-sleigh svg\{[^}]*filter:([^;]+);/)?.[1] || '';
  assert.match(filter, /^url\(#sleigh-silhouette\)/);
  assert.doesNotMatch(filter, /brightness\(0\)/);
  for (const [, blur] of filter.matchAll(/drop-shadow\(0 0 ([\d.]+)px/g)) assert.ok(Number(blur) <= 1, `rim ${blur}px`);
  const page = await readFile('src/index.html', 'utf8');
  assert.match(page, /<filter id="sleigh-silhouette"[^>]*>\s*<feFlood flood-color="#[0-9a-f]{6}"/);
});

// Keyboard focus looks one way everywhere: one ring, 3px in the focus colour. Only on dark paint
// (the water under a bobber, the Christmas tree at night) is it the same ring in candlelight, which
// reads there. A ring may sit closer or farther (outline-offset), or be a glow on a drawing.
test('every focus ring is the one ring', async () => {
  const css = await styles();
  assert.match(css, /--focus-ring:3px solid var\(--focus\);/);
  assert.match(css, /--focus-ring-light:3px solid #ffe7ad;/);
  const odd = [];
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/:focus-visible/.test(selector)) continue;
    for (const [, value] of body.matchAll(/(?:^|;)outline:([^;]+)/g))
      if (!/^(?:none|var\(--focus-ring(?:-light)?\))$/.test(value)) odd.push(`${selector.trim()} outline:${value}`);
  }
  assert.deepEqual(odd, []);
  // The desktop overlay is its own page without the window's tokens; its ring has the same width.
  const overlay = compact(await readFile('src/overlay/overlay.css', 'utf8'));
  const rings = [...overlay.matchAll(/:focus-visible\{[^}]*outline:([^;]+)/g)].map(([, value]) => value);
  assert.ok(rings.length >= 2);
  for (const ring of rings) assert.match(ring, /^3px solid /);
});

// Corners come from a few named sizes; a corner that is one of them by value names it, so changing
// the size changes every corner that shares it. A drawn shape (a leaf, a pot, a tab's half) keeps its own.
test('a corner the same size as a named one uses the name', async () => {
  const css = await styles();
  const named = Object.fromEntries(
    [...css.matchAll(/--radius-([a-z]+):(\d+px);/g)].map(([, name, value]) => [value, name]),
  );
  assert.deepEqual(named, { '8px': 'panel', '5px': 'control', '6px': 'card', '999px': 'pill', '12px': 'bubble' });
  const literal = [...css.matchAll(/([^{}]+)\{[^{}]*?(?:^|;)border-radius:(\d+px);/g)]
    .filter(([, , value]) => named[value] || value === '99px')
    .map(([, selector, value]) => `${selector.trim()} ${value}`);
  assert.deepEqual(literal, []);
});
