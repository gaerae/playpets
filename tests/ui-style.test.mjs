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
  // With a tool in hand the friends walk where the lane was, and the one aimed at sat under a card, so
  // the lane goes up into the sky; a small window's strip is up there, so its lane stays at the foot.
  assert.match(css, /\.yard-frame:has\(#discovery-target:not\(\[hidden\]\)\)\.yard-feedback\{inset:12px 12px auto;/);
  assert.doesNotMatch(css, /\.yard-feedback\{bottom:106px/);
  assert.match(
    css,
    /body\.compact \.yard-frame:has\(#discovery-target:not\(\[hidden\]\)\)\.yard-feedback\{inset:auto 8px 8px;/,
  );
  assert.match(css, /body\.compact \.yard-feedback\{inset:auto 52px 8px 8px;/);
  assert.match(css.match(/(?:^|})\.toast\{([^}]*)\}/)?.[1] || '', /pointer-events:none/);
  assert.doesNotMatch(css.match(/(?:^|})\.toast\{([^}]*)\}/)?.[1] || '', /position:absolute/);
  assert.doesNotMatch(css, /\.catch-card\.near/, 'a card no longer stands apart above its finder');
});

// A notice that closes on a press anywhere on it is pressed, never selected: a drag across its words
// would start a selection and the press would not close it (album-in-and-out.md).
test('every notice a press closes is pressed the same way, never selected', async () => {
  const css = await styles();
  for (const selector of ['\\.toast>span', '\\.catch-card']) {
    const rule = css.match(new RegExp(`(?:^|})${selector}\\{([^}]*)\\}`))?.[1] || '';
    assert.match(rule, /cursor:pointer/, selector);
    assert.match(rule, /(?:^|;)user-select:none/, selector);
    assert.match(rule, /-webkit-user-select:none/, selector);
  }
  // A notice with Undo closes only by its button, so its words do not look pressable.
  assert.match(css, /(?:^|\})\.toast>span:has\(\.toast-action\)\{cursor:default;?\}/);
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

test("an icon button keeps none of the engine's button padding and never shrinks, so its icon sits in the middle of a round one", async () => {
  // WebKit and Chromium pad a button unevenly (1px 6px, more below in WebKit): a 20px icon in a 32px
  // round Close with a 2px rim overflowed its 16px and sat 2px right, and half a pixel high in WebKit.
  const css = await styles();
  const rule = css.match(/(?:^|[{}; ])\.icon-button\{([^}]*)\}/);
  assert.ok(rule, 'icon buttons have a base rule');
  assert.match(rule[1], /(?:^|;)padding:0(?:;|$)/);
  // With no padding to hold it, a row short of room would squeeze a round Close into an oval.
  assert.match(rule[1], /(?:^|;)flex:none(?:;|$)/);
  for (const [, selector, body] of css.matchAll(/([^{}]*\.icon-button[^{}]*)\{([^}]*)\}/g))
    assert.doesNotMatch(body, /(?:^|;)padding(?:-\w+)?:(?!0(?:;|$))/, `${selector.trim()} pads an icon button`);
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
  // A picture over a caption, at the smallest size words are read at (the e2e asks 12px); Morning fits
  // a fifth of the row.
  assert.match(
    css,
    /\.atmosphere-segments span\{[^}]*padding:2px 1px;[^}]*font-size:var\(--font-sm\);[^}]*font-weight:500/,
  );
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
  // The short New is a paper tag beside the name at every size (card.js), the sentence read aloud.
  assert.match(css, /(?:^|})\.catch-card:is\(\.catch-new-short,\.catch-rare,\.catch-record\)\{display:inline-flex;/);
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

// overflow-y: auto alone turns the other axis to auto too, and Windows draws its scrollbars inside
// the box: with Play's body scrolling, the painted hand tapping Album passed its right edge by a few
// pixels and a second bar showed under the tiles. A box meant to scroll up and down never scrolls
// sideways; what passes its edge is cut, as it was already.
test('a panel, sheet or page that scrolls up and down never scrolls sideways', async () => {
  const css = await styles();
  for (const selector of [
    '\\.dock-panel-body',
    '\\.side-panel',
    '#panel-invite',
    'body\\.compact \\.panel-body',
    '\\.album-grid',
  ]) {
    const rule = css.match(new RegExp(`(?:^|\\})${selector}\\{([^}]*)\\}`))?.[1] || '';
    assert.match(rule, /overflow-y:auto/, selector);
    assert.match(rule, /overflow-x:(?:hidden|clip)/, selector);
  }
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

// At the default 1180 by 850 a fixed 520px cut Atmosphere after Time of day, so Weather and the yard's
// sound sat below the fold with nothing saying they were there.
test('the scene panel is as tall as what it holds, up to the window, so Weather and Sound show without scrolling', async () => {
  const css = await styles();
  const rule = css.split('}').find(part => part.endsWith('.scene-menu{') || /(^|[;{])\.scene-menu\{/.test(part));
  assert.ok(rule, 'the scene panel has its own rule');
  assert.match(rule, /max-height:calc\(100% - 76px\)/);
  assert.doesNotMatch(rule, /(^|[;{])height:min\(/, 'no fixed height under the window');
});

// At 960 by 640 two rows of places still pushed the yard's sound below the fold.
test('a window too short for two rows of places shows them in one row that scrolls sideways', async () => {
  const css = await styles();
  assert.match(
    css,
    /@media ?\(max-height:720px\)\{\.background-gallery\{[^}]*grid-auto-flow:column;[^}]*overflow-x:auto/,
  );
});

// A small window's friend panel hid the closeness row, and with no name plate on the small window's
// menu either, how close a friend was showed nowhere.
test('a small window still says how close a friend is, without the bar', async () => {
  const css = await styles();
  const hides = css
    .split('}')
    .filter(rule => rule.includes('display:none') && /body\.compact[^{]*\.bond-row/.test(rule));
  assert.deepEqual(hides, [], 'the row stays');
  assert.match(css, /body\.compact \.bond-bar[,{][^{}]*\{display:none;?\}/);
});

// At 760 by 520 the menu's three places as rows left Close window and Quit below its fold, and a
// tall window showed the same 360px menu as rows where a short one showed tiles. Tiles in every window.
// Equal thirds broke "Invite a friend" in a wider font (Linux): a name keeps its line in a large
// window, and its tile takes the width it needs, the other two sharing the rest.
test('the menu sets its three places side by side in every window, so Close window and Quit stay in view', async () => {
  const css = await styles();
  assert.match(css, /(?:^|\})\.management-destinations\{display:grid;grid-template-columns:repeat\(3,1fr\)/);
  assert.match(css, /(?:^|\})body:not\(\.compact\) ?\.menu-destination-copy strong\{[^}]*white-space:nowrap/);
  assert.match(
    css,
    /(?:^|\})\.management-destinations \.menu-destination\{[^}]*flex-direction:column;[^}]*text-align:center/,
  );
  assert.equal(css.match(/\.management-destinations\{display:grid/g).length, 1, 'said once, for every window');
});

// A row of cards not found yet was shorter than a row with a find. Every row is at least the
// book's tallest card (album.js evenCards), and grows if a card is taller still, so nothing is cut.
// A small window's one column is a list, not rows of cards: there each card keeps its own height,
// or one card would fill a 320px window.
test("every row of album cards is at least the book's tallest card, where cards stand side by side", async () => {
  const css = await styles();
  assert.match(css, /(?:^|\})\.album-grid\{[^}]*grid-auto-rows:minmax\(var\(--album-card,auto\),auto\)/);
  const small = css.match(
    /@media\(max-width:640px\),\(max-height:480px\)\{\.album-tabs\{display:none;?\}(.*?)\}\}/,
  )?.[1];
  assert.match(small, /\.album-grid\{grid-template-columns:1fr;[^}]*grid-auto-rows:auto/);
});

// At 760 by 520 the album's large picture pushed the hint on where to find a kind below the left
// page's fold.
test('a short window draws the album large picture smaller, so the hint under it stays in view', async () => {
  const css = await styles();
  // Down to 112px at 520 high, where the rows of clues under it need room too, and they draw smaller.
  assert.match(
    css,
    /@media ?\(max-height:720px\)\{[^@]*\.album-detail \.album-specimen\{max-height:clamp\(112px,calc\(100dvh - 408px\),200px\)/,
  );
  assert.match(css, /@media ?\(max-height:720px\)\{[^@]*\.album-clues \.clue>i\{width:24px;height:24px/);
});

// At 460 by 320 the board's painted tiles, three to a row under their sections' names, took the
// whole window and scrolled: a low window keeps Play to two thirds of it (e2e.mjs reach=).
test('a low window draws Play as tiles with the picture beside the word, the section names read aloud only', async () => {
  const [css, win] = await Promise.all([styles(), readFile('src/window.js', 'utf8')]);
  // A window 480 high or lower is always a small one, whose section names are read aloud only.
  assert.match(win, /innerHeight <= 480/);
  assert.match(
    css,
    /body\.compact \.dock-section-label\{position:absolute;width:1px;height:1px;[^}]*clip-path:inset\(50%\)/,
  );
  assert.match(css, /@media ?\(max-height:480px\)\{[^@]*\.play-board \.play-action\{flex-direction:row;/);
  assert.match(
    css,
    /@media ?\(max-height:480px\)\{[^@]*\.play-board \.play-action>\[data-icon\]\{flex:none;width:22px;height:22px/,
  );
});

// A card's number and its Rare mark were a bold number stamped on the picture and a pill caught on
// its frame's corner, and a rare card not found yet had a second gold box inside its frame. Both are
// now the same small paper tag inside the picture's top corners, Rare with its painted star.
test("an album card's number and Rare are matching tags inside the picture's corners", async () => {
  const css = await styles();
  assert.match(
    css,
    /\.album-no\{position:absolute;top:12px;left:12px;[^}]*border:1px solid var\(--album-edge\);border-radius:var\(--radius-pill\);background:var\(--album-paper\)/,
  );
  assert.match(css, /\.album-rare\{position:absolute;top:12px;right:12px;[^}]*display:inline-flex;/);
  // The same painted star as a rare find's card wears.
  assert.match(
    css,
    /:is\(\.album-rare,\.catch-rare\)::before\{content:"";[^}]*background:url\("\.\.\/art\/ui\/rare\.webp"\)/,
  );
  assert.doesNotMatch(css, /\.album-card\.rare \.album-specimen\{box-shadow/);
  assert.doesNotMatch(css, /content:"✦ "/);
});

// Play stood over the dock's rim, taller and in the largest type, so it drew the eye from the yard
// itself; it keeps the honey colour that marks it as the way in, at the dock's own height.
test("Play is the dock's honey button at the dock's height", async () => {
  const css = await styles();
  const play = css.match(/(?:^|\})\.yard-play-toggle\{([^}]*)\}/)[1];
  assert.match(play, /min-height:36px/);
  assert.match(play, /font-size:var\(--font-lg\)/);
  assert.match(play, /background:linear-gradient\(180deg,var\(--garden-honey\),var\(--garden-honey-deep\)\)/);
  assert.doesNotMatch(play, /margin:-/, 'not over the rim');
});

// A Close at a panel's corner is a round wooden button, one size with one weight of × everywhere:
// they were 32px and 36px with a 14px to 20px ×, so the same button looked heavy in one place and
// faint in the next.
test('every round wooden Close is one size with one weight of ×', async () => {
  const [css, html] = await Promise.all([styles(), readFile('src/index.html', 'utf8')]);
  // Each corner Close says so by its class, the side panel's and every dialog's included.
  for (const id of [
    'scene-close',
    'close-controls',
    'close-play',
    'close-panel',
    'close-album',
    'discovery-cancel',
    'close-pet-dialog',
    'close-import',
    'close-dialog',
    'close-decorating',
    'letter-close',
    'confirm-close',
  ])
    assert.match(html, new RegExp(`<button[^>]*id="${id}"[^>]*class="[^"]*\\bcorner-close\\b`), id);
  const closes = ':is(.corner-close,#close-panel)';
  const at = css.indexOf(`${closes}{`);
  assert.ok(at >= 0, 'one rule sizes every corner Close');
  assert.match(css.slice(at), /^[^{]*\{width:32px;height:32px;?\}/);
  assert.ok(css.includes(`${closes}svg{width:18px;height:18px;stroke-width:2px`), 'and its ×');
  for (const size of [/\.dock-panel-head \.icon-button\{width:/, /\.discovery-target-heading \.icon-button\{width:/])
    assert.doesNotMatch(css, size, 'no corner sets a size of its own');
  assert.doesNotMatch(css, /\.album-dialog \.dialog-heading \.icon-button\{/);
  assert.doesNotMatch(css, /\.dialog-form>\.dialog-heading \.icon-button\{/);
});

// A notice or a card already has its own frame, so a ring round its × was a third outline beside
// Undo's; its Close is the bare ×, with the round hover every icon button has.
test('a Close inside a notice or a card is a bare ×, not another ring', async () => {
  const css = await styles();
  const wooden = css.match(/:is\(\.corner-close[^)]*\)\{border:2px solid var\(--garden-rim\)/);
  assert.ok(wooden, 'the wooden rule is still there');
  assert.doesNotMatch(wooden[0], /toast-close|catch-dismiss/);
  const toast = css.match(/(?:^|\})\.toast-close\{([^}]*)\}/)[1];
  assert.match(toast, /border:0/);
  assert.match(toast, /border-radius:50%/);
  assert.match(toast, /background:transparent/);
  assert.match(css, /\.catch-dismiss\{[^}]*border-radius:50%/);
});

// "New" was five dots of three sizes, one with no edge, so on honey or in dark mode it was hard to
// see; every one is now the same 8px dot with a 2px ring of the paper behind it.
test('every new-thing dot is the same dot with a ring of its own surface', async () => {
  const css = await styles();
  const dots = [...css.matchAll(/([^{}]*(?:\.has-new|\.has-update|\.update-compact)::after)\{([^}]*)\}/g)];
  assert.ok(dots.length >= 4, 'the dots are found');
  for (const [, selector, body] of dots) {
    assert.match(
      body,
      /width:8px;height:8px;border-radius:50%;background:var\(--accent\);box-shadow:0 0 0 2px var\(--[\w-]+\)/,
      selector.trim(),
    );
    assert.doesNotMatch(body, /border:/, selector.trim());
  }
});

// The memento heart is a paper tag like the card's number and Rare, not a shadowed button.
test("the memento heart on an album card is a paper tag like the card's number", async () => {
  const heart = (await styles()).match(/(?:^|\})\.album-heart\{([^}]*)\}/)[1];
  assert.match(heart, /width:20px;height:20px;/);
  assert.match(heart, /border:1px solid var\(--album-edge\)/);
  assert.match(
    heart,
    /background:url\("\.\.\/art\/ui\/heart\.webp"\) ?center ?\/ ?14px no-repeat,var\(--album-paper\)/,
  );
  assert.doesNotMatch(heart, /box-shadow/);
});

// In the yard a memento's heart and the mailbox's letter are the same painted tags, on a cream disc
// with an edge line, so they read as one family with the album's, not a font's ♥ in a shadowed dot.
test("the yard's memento heart and waiting letter are painted tags with an edge", async () => {
  const css = await styles();
  const heart = css.match(/(?:^|\})\.decor\.memento::after\{([^}]*)\}/)[1];
  assert.match(heart, /content:""/);
  assert.match(heart, /url\("\.\.\/art\/ui\/heart\.webp"\)/);
  const letter = css.match(/(?:^|\})\.decor\[data-mark="letter"\]::before\{([^}]*)\}/)[1];
  assert.match(letter, /url\("\.\.\/art\/ui\/letter\.webp"\)/);
  for (const mark of [heart, letter]) {
    assert.match(mark, /border:1px solid #c9a477/);
    assert.doesNotMatch(mark, /box-shadow/);
  }
});

// A tab's dot sat in the ribbon's rounded corner, half off the tab and over its neighbour.
test("an album tab's new dot sits inside the tab", async () => {
  assert.match(await styles(), /\.album-tabs button\.has-new::after\{[^}]*top:6px;right:8px;/);
});

// On the album's wooden cover the rim was the cover's own colour, so in dark mode the Close was a
// disc with no edge; it takes the darker edge the Play button has.
test("the album's Close keeps an edge on the wooden cover", async () => {
  assert.match(await styles(), /(?:^|\})#close-album\{border-color:var\(--garden-rim-edge\);?\}/);
});

// A notice's bare × grows to the touch size every other icon button has.
test("a notice's Close is large enough to touch", async () => {
  assert.match(await styles(), /@media ?\(pointer:coarse\)\{\.toast-close\{width:44px;height:44px;?\}/);
});

// Cancel, a word with no padding beside Save, was 23px wide to aim at in every dialog.
test('a word button among the actions of a dialog has room around it to press', async () => {
  const css = await styles();
  assert.match(css, /\.dialog-actions \.button\.text:not\(\.push-left\)\{[^}]*padding-inline:10px/);
});

// The shelf scrolls and clips its sides, so a ring drawn outside a full-width card showed as two
// dark bars above and below it.
test('an invite card draws its focus ring inside, where the shelf cannot cut it', async () => {
  const css = await styles();
  assert.match(css, /\.asset-card:focus-visible\{outline-offset:-3px;?\}/);
});

// An event's card broke Japanese inside a word ("始まりま / した！"), as the album once did.
test('a card title in the yard breaks Japanese between phrases, as the album does', async () => {
  const css = await styles();
  assert.match(css, /:root:lang\(ja\) ?\.catch-card strong\{word-break:keep-all;overflow-wrap:anywhere;?\}/);
  const { strings: ja } = await import('../src/core/strings/ja.js');
  assert.match(ja['event.started'], /が\u200b始まりました/, 'a place to break after the event name');
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
  // At 300 by 210 in Japanese the list of sections is taller than the sheet: it scrolls, so About
  // stays in reach under its title row.
  assert.match(css, /body\.compact #settings-home\{[^}]*min-height:0;[^}]*overflow-y:auto/);
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
  // Only while the friend's own panel shows: #pet-panel stays unhidden inside it when Settings or
  // Invite opens, and then their title went and the buttons lay over their first rows.
  const chat = String.raw`body\.compact \.side-panel:has\(#panel-pet:not\(\[hidden\]\)#pet-panel:not\(\[hidden\]\)\)`;
  const head = short.match(new RegExp(`${chat}>\\.panel-head\\{([^}]*)\\}`))?.[1];
  assert.ok(head, 'a short window lifts the panel head out of the flow while a conversation shows');
  assert.match(head, /position:absolute/);
  assert.match(
    short,
    new RegExp(`${chat}#panel-title\\{[^}]*clip-path:inset\\(50%\\)`),
    'the title stays for screen readers',
  );
  assert.doesNotMatch(css, /:has\(#pet-panel:not\(\[hidden\]\)\)/, 'no rule for the chat reaches another panel');
  // Opened from Friends & settings, the head has Back too: the friend's menu moves out from under it.
  const back = String.raw`${chat}:has\(#panel-menu:not\(\[hidden\]\)\)`;
  assert.match(short, new RegExp(`${back}\\.menu-anchor\\{right:118px;?\\}`));
  assert.match(short, new RegExp(`${back}\\.friend-head\\{padding-right:156px;?\\}`));
  // Four buttons leave the name 60px, "D…" for Daisy: the picture gives way, and the name says who.
  assert.match(short, new RegExp(`${back}\\.friend-head \\.avatar\\{display:none;?\\}`));
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
// with an ellipsis. With the games on two rows the tiles are close set (the icon over the name, the
// seed count in the corner, no 40px floor), so the panel stays under two thirds of a 460 by 320
// window (the e2e's quick Play check). Narrow windows take the smallest step. A group's last row
// gathers in the middle, so four games never leave Chatter alone at the left, and a line between
// groups shows where one ends, since their names are hidden there.
test('a Play name stays whole on one line in a small window', async () => {
  const css = await styles();
  assert.match(css, /body\.compact \.play-actions\{display:flex;flex-wrap:wrap;justify-content:center;gap:2px/);
  assert.match(css, /body\.compact \.play-action\{[^}]*flex:0 0 calc\(\(100% - 4px\)\/ 3\)/);
  assert.match(css, /body\.compact \.play-board \.dock-section \+ \.dock-section\{border-top:1px solid var\(--line\)/);
  const tile = css.match(/(?:^|\})body\.compact \.play-action\{([^}]*)\}/)?.[1] || '';
  assert.doesNotMatch(tile, /white-space:normal|overflow-wrap:anywhere|word-break|flex-direction:row/);
  assert.match(tile, /min-height:0/);
  assert.match(
    css,
    /body\.compact \.play-action>:is\(span\[data-i18n\],\.game-name\)\{[^}]*overflow:hidden;text-overflow:ellipsis/,
  );
  assert.doesNotMatch(css, /body\.compact \.play-action>\.tool-count\{[^}]*position:static/);
  const narrow = [...css.matchAll(/@media\(max-width:400px\)\{((?:[^{}]*\{[^}]*\})*)\}/g)].map(m => m[1]).join('');
  assert.match(narrow, /body\.compact \.play-action\{[^}]*font-size:var\(--font-xs\)/);
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
  // The chosen book's ribbon takes the page's paper; a hover only lifts one.
  assert.match(css, /\.album-tabs button\[aria-selected="true"\]\{[^}]*var\(--album-left\)/);
  assert.match(css, /\.album-tabs button:hover:not\(\[aria-selected="true"\]\)\{[^}]*transform:translateY\(-2px\)/);
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
    // A quoted url() is read as its string, so a url(…) inside a data URL stays inside it.
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|url\([^)"']*\)/g, m => m.replace(/[{};,]/g, '\u2400'));
  const rules = [];
  const walk = (body, media) => {
    let i = 0;
    for (;;) {
      const open = body.indexOf('{', i);
      if (open < 0) return;
      const head = body.slice(i, open).trim();
      let depth = 1,
        k = open + 1;
      for (; depth && k < body.length; k++) depth += body[k] === '{' ? 1 : body[k] === '}' ? -1 : 0;
      // An unclosed rule is the end of the sheet.
      if (depth) return;
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
  // A data URL may hold its own url(…) and quotes; the rules after it still read in step.
  const nested = `.a{background:url("data:x,%3Cpath fill='url(%23p)'/%3E")}.b{background:url("y.webp")}`;
  assert.equal(found(`${nested}.c{color:red}.c{color:blue}`), 1, 'a url() inside a quoted data URL');
  assert.equal(found('.a{color:red}.a{'), 0, 'an unclosed rule ends the walk');
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
  '--notch': 'src/core/controls.js',
  '--order': 'src/core/controls.js',
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
  '--album-card': 'src/panel/album.js',
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
  '--fall': 'src/yard/fallen-fruit.js',
  '--lift-x': 'src/yard/fallen-fruit.js',
  '--lift-y': 'src/yard/fallen-fruit.js',
  '--veil-x': 'src/yard/veil.js',
  '--veil-y': 'src/yard/veil.js',
  '--veil-rx': 'src/yard/veil.js',
  '--veil-ry': 'src/yard/veil.js',
  '--lean': 'src/yard/motion.js',
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
// A tag with an agent cut both names at once ("Sir Wiggleton F… • Cl…"), and a tool's name on a
// pet's tag read like a setting. The agents are a small line icon after the name; who they are is its
// tooltip, the same words as the Friend tab's chip.
test('a name tag marks its agents with a small icon and names them in the tooltip', async () => {
  const [css, views] = await Promise.all([styles(), readFile('src/yard/views.js', 'utf8')]);
  assert.match(css, /\.pet-tag small svg\{width:12px;height:12px;?\}/);
  assert.doesNotMatch(css, /\.pet-tag:has\(small:not\(\[hidden\]\)\)/);
  assert.match(views, /agents\.innerHTML = '<span data-icon="plug"><\/span>'/);
  assert.match(views, /put\(v\.agents, 'title', t\('friend\.agent_chip', \{ agents: joinList\(agents\) \}\)\)/);
  assert.doesNotMatch(views, /put\(v\.agents, 'textContent'/);
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

// A tail behind its bush keeps one pixel per unit of its own (the album sets its own size), and the
// trail end's units (trails.js endZoom) would never reach the drawing: in every window it stood at
// the size of the largest one.
test("the bush at a trail's end takes the trail end's scale, so a smaller window shrinks it", async () => {
  const css = await styles();
  assert.match(css, /(^|\})\.trail-end>\.tail-peek\{[^}]*--u:inherit;/);
});

// A grey dimming left the gifts, the bush and the plants a neutral grey against the night's blue
// snow and grass; one tint (index.html #night-tint) darkens them toward that blue instead.
test('at night the drawings in the yard darken toward the blue of the night, all with one tint', async () => {
  const css = await styles();
  assert.doesNotMatch(css, /brightness\(0\.6[0-9]*\)saturate/, 'no grey night dimming is left');
  // The yard's light at night is the tint (garden.css --prop-light), and every drawing takes it.
  assert.match(
    css,
    /\.yard\.period-night\{--prop-light:url\(#night-tint\);--drawing-light:url\(#night-tint-drawing\);\}/,
  );
  const escape = selector => selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const selector of ['.decor svg', '.decor>.ornaments'])
    assert.match(css, new RegExp(`(^|\\})${escape(selector)}\\{[^}]*filter:var\\(--prop-light,none\\);`), selector);
  for (const selector of ['.plant svg>use', '.planted-tree svg>use'])
    assert.match(css, new RegExp(`(^|\\})${escape(selector)}\\{[^}]*filter:var\\(--drawing-light,none\\);`), selector);
  assert.match(css, /\.period-night \.trail-end svg\{filter:url\(#night-tint\);\}/);
  const page = await readFile('src/index.html', 'utf8');
  const matrix = page.match(/<filter id="night-tint"[^>]*>\s*<feColorMatrix type="matrix" values="([^"]+)"/);
  assert.ok(matrix, 'the tint is in the page');
  const inside = page.match(/<filter id="night-tint-drawing"[^>]*>\s*<feColorMatrix type="matrix" values="([^"]+)"/);
  assert.equal(inside?.[1], matrix[1], 'a drawing inside its box takes the same tint');
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

test('pin switches show their selected state for every window size, lit like every other switch', async () => {
  const css = await styles();
  assert.match(css, /\.view-toggle\[aria-pressed="true"\] \.wander-switch[^{]*\{[^}]*background:var\(--accent\)/);
  assert.match(css, /\.wander-toggle input:checked ~ \.wander-switch\{[^}]*background:var\(--accent\)/);
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
  // the icon button's centred grid: a flex row started its dots 6px left of the middle
  assert.match(css, /body\.compact \.compact-launcher\{[^}]*display:grid/);
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
  assert.match(css, /\.album-dialog\{[^}]*height:min\(680px,calc\(100dvh - 16px\)\)/);
});

test('a dialog heading wraps a long word instead of running past the dialog', async () => {
  assert.match(await styles(), /\.dialog-heading h2\{[^}]*overflow-wrap:anywhere/);
});

// The album's Close is on the wooden cover at the end of the ribbons, as a tab is, so the pages
// hold only the books: the right page's line and cards start at its top.
test('the album closes from the cover beside its ribbons, not from a corner of its page', async () => {
  const css = await styles();
  // The right page is one column of its own, its line over its cards, so neither page's height sets
  // where the other's content starts.
  assert.match(
    css,
    /\.album-dialog\[open\]\{[^}]*grid-template-rows:auto auto minmax\(0,1fr\);grid-template-areas:"tabs tabs close" ?"title right right" ?"detail right right"/,
  );
  assert.match(css, /\.album-right\{grid-area:right;display:flex;flex-direction:column;flex:1;min-height:0;/);
  const page = await readFile('src/index.html', 'utf8');
  assert.match(page, /<div class="album-right"><p id="album-dig-status"[^>]*><\/p><div id="album-grid"/);
  assert.match(css, /\.album-heading-actions\{grid-area:close;align-self:center;/);
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
// keep colours of their own: the yard's art files (and the petals, leaves and flakes a pressed thing
// lets fall, answer.css), and the marks listed here. Before, 240 raw
// colours were spread over the rules, and some (the Remove button, the Quit hover, the Settings
// shadow) stayed light in dark mode.
test('the interface takes its colours from tokens', async () => {
  const art = new Set(['scenery.css', 'garden.css', 'play.css', 'worn.css', 'answer.css']);
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
  const tiers = { width: [360, 400, 480, 640, 1100], height: [280, 480, 720] };
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

// A sparrow or a magpie sits behind the trail bush's top, small beside it: the drawing stays within
// about two thirds of the bush's width (41) and half its height (30), its round back (about two
// thirds of the way across the drawing) over the crown's middle, its tail out to the left, and its
// cut low enough (--lift) to stay inside the crown, whose top is about 29.5 up.
test('a bird behind the trail bush is drawn to the bush scale', async () => {
  const css = await styles();
  for (const bird of ['sparrow', 'magpie']) {
    const rule = css.match(new RegExp(`\\.tail-peek\\[data-track="${bird}"\\]\\{([^}]*)\\}`))?.[1] || '';
    const value = name => Number(rule.match(new RegExp(`--${name}:([\\d.]+)`))?.[1]);
    assert.ok(value('w') <= 26, `${bird}: width ${value('w')}`);
    assert.ok(value('h') <= 17, `${bird}: height ${value('h')}`);
    assert.ok(Math.abs(value('x') + value('w') * 0.65 - 24) <= 2, `${bird}: its back over the crown's middle`);
    assert.ok(value('x') + value('w') <= 44.5, `${bird}: within the bush's right side`);
    assert.ok(value('lift') <= 28, `${bird}: its cut inside the crown`);
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
  assert.deepEqual(named, {
    '8px': 'panel',
    '5px': 'control',
    '6px': 'card',
    '999px': 'pill',
    '12px': 'bubble',
    '14px': 'garden',
  });
  const literal = [...css.matchAll(/([^{}]+)\{[^{}]*?(?:^|;)border-radius:(\d+px);/g)]
    .filter(([, , value]) => named[value] || value === '99px')
    .map(([, selector, value]) => `${selector.trim()} ${value}`);
  assert.deepEqual(literal, []);
});

// The page's own green marks and blue-green ink shades (a count, a picked card, a shadow) belong to the
// old look; every paper surface redefines them in the paper's colours, so none shows on paper.
test('paper surfaces take the paper colours for the page green marks and ink shades', async () => {
  const css = await styles();
  const scopes = [/\.side-panel,dialog\{([^}]*)\}/, /\.window-buttons,\.empty-yard\{([^}]*)\}/];
  for (const scope of scopes) {
    const body = css.match(scope)?.[1];
    assert.ok(body, `scope ${scope}`);
    for (const token of ['--green-soft', '--green-ink', '--green-line', '--ink-8', '--ink-12', '--ink-20', '--white'])
      assert.match(body, new RegExp(`${token}:var\\(--garden-`), `${token} in ${scope}`);
  }
  assert.match(css, /\.empty-yard\{[^}]*background:var\(--garden-frame\)/);
  assert.match(css, /--shadow-sheet:var\(--shadow-garden\),0 12px 36px var\(--garden-ink-20\)/);
  assert.doesNotMatch(css, /--scene-green/);
});

test("a thing's name plate stands on the bar's rim, not in its paper, and its edge stops where the bar begins", async () => {
  // A positioned child is measured from inside the rim, so the plate used to reach 6px into the bar's
  // paper: its wood poked in at both sides, darker than the rim beside it, and its dark edge ran down
  // across the rim.
  const css = await styles();
  const above = css.match(/\.thing-bar>\.thing-plate:not\(\[hidden\]\)\{([^}]*)\}/)?.[1];
  assert.ok(above, 'the plate has its rule');
  assert.match(above, /bottom:100%/);
  assert.doesNotMatch(above, /--garden-frame\b(?!-)/, "not the frame's own gradient, which ends dark at its foot");
  assert.match(above, /var\(--garden-wood-head\)border-box/);
  assert.match(above, /clip-path:polygon\(/, 'its dark edge is cut where the rim begins');
  const below = css.match(/\.thing-bar\[data-side="below"\]>\.thing-plate:not\(\[hidden\]\)\{([^}]*)\}/)?.[1];
  assert.match(below, /top:100%/);
  assert.match(below, /var\(--garden-wood-foot\)border-box/);
  assert.match(below, /clip-path:polygon\(/);
  // Its paper runs on over the bar's inner edge, so the two read as one piece.
  assert.match(css, /\.thing-bar>\.thing-plate:not\(\[hidden\]\)::after\{[^}]*background:var\(--garden-paper\)/);
});

test('every book in the album, the hidden one too, wears its own painted picture and ribbon', async () => {
  const css = await styles();
  const js = await readFile('src/panel/album.js', 'utf8');
  const books = [...js.matchAll(/^ {2}(\w+): \{\n {4}tab: /gm)].map(m => m[1]);
  assert.ok(books.includes('secret'), 'the books are read from album.js');
  for (const book of books) {
    assert.match(
      css,
      new RegExp(
        `\\.album-tabs \\[data-book="${book}"\\]::before\\{background-image:url\\("\\.\\./art/ui/book-${book}\\.webp"\\)`,
      ),
      book,
    );
    assert.match(
      css,
      new RegExp(`\\.album-tabs \\[data-book="${book}"\\]\\{--album-ribbon:`),
      `${book} has a ribbon of its own`,
    );
  }
  // a row too narrow for every name keeps each one for a reader, out of sight
  assert.match(
    css,
    /\.album-tabs\.tight button>span\{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset\(50%\)/,
  );
});

test("the album's left page wraps its words in even lines, with no word left alone on the last", async () => {
  const css = await styles();
  for (const part of ['\\.album-detail-line', '\\.album-detail \\.album-detail-hint']) {
    const rule = css.match(new RegExp(`${part}\\{([^}]*)\\}`))?.[1];
    assert.match(rule || '', /text-wrap:balance/, part);
  }
});
test('closeness shows its empty hearts as outlines in the heart colour, so five read as five', async () => {
  // They used to be filled in the paper's line colour, about 1.4:1 against the paper in both themes.
  const css = await styles();
  const heart = css.match(/\.thing-hearts>i\{([^}]*)\}/)?.[1];
  assert.ok(heart, 'the hearts have their rule');
  assert.match(heart, /background:var\(--garden-heart\)/);
  assert.match(heart, /stroke=/, 'an empty heart is an outline');
  assert.doesNotMatch(heart, /--garden-line/);
  const filled = css.match(/\.thing-hearts\[data-level="5"\]>i\{([^}]*)\}/)?.[1];
  assert.match(filled, /mask-image:url\(/);
  assert.doesNotMatch(filled, /stroke=/, 'a filled heart is filled');
});

test("the play board's portrait centres the friend in its circle", async () => {
  const css = await styles();
  const px = (rule, prop) => Number(css.match(new RegExp(`${rule}\\{[^}]*\\b${prop}:(-?\\d+)px`))?.[1]);
  const circle = px('\\.play-portrait:not\\(\\[hidden\\]\\)', 'width'),
    picture = px('\\.play-portrait canvas', 'width');
  const margin = css.match(/\.play-portrait canvas\{[^}]*margin:(-?\d+)px (-?\d+)px/);
  const border = Number(css.match(/--garden-border:(\d+)px/)?.[1]);
  assert.ok(circle && picture && margin && border, 'the circle, its rim, the picture and its margins');
  // wider than the circle inside its rim, the picture overhangs it by the same on both sides
  assert.equal(Number(margin[2]), -(picture - (circle - 2 * border)) / 2);
});

test("a thing's notch hangs outside its bar in the rim's own wood, and paints nothing inside the bar", async () => {
  // It used to repaint the bar's paper and wood in its own 16px box: a pale diamond showed inside the
  // bar under the middle choice, and its wood started light again where the bar's rim is darkest.
  const css = await styles();
  const notch = css.match(/\.thing-bar::after\{([^}]*)\}/)?.[1];
  assert.ok(notch, 'the notch has its rule');
  assert.doesNotMatch(notch, /--garden-frame/);
  assert.match(notch, /background:var\(--garden-wood-foot\)/);
  assert.match(notch, /clip-path:polygon\(/, 'only the half outside the bar is drawn');
  const below = css.match(/\.thing-bar\[data-side="below"\]::after\{([^}]*)\}/)?.[1];
  assert.match(below, /background:var\(--garden-wood-head\)/);
  // The wood runs from its head to its foot, light and dark alike, so the notch matches the rim.
  const woods = [...css.matchAll(/--garden-wood:linear-gradient\(([^;]*)\);/g)].map(m => m[1]);
  assert.ok(woods.length >= 2, 'light and dark wood');
  for (const wood of woods) assert.match(wood, /^175deg,var\(--garden-wood-head\),.*,var\(--garden-wood-foot\)$/);
});

test("on a thing's bar an unticked check takes no room, so its choices sit evenly apart", async () => {
  // A list keeps the slot so its rows line up; on the bar the hidden tick after Show on desktop
  // left a wider gap before the next choice than between any other two.
  const css = await styles();
  const rule = css.match(/\.thing-bar \[aria-checked="false"\]>\.context-check\{([^}]*)\}/)?.[1];
  assert.match(rule || '', /display:none/);
});

// A card in a large window is its picture and its name; the sentence under them shows under the
// pointer or the keyboard and is still read out, so a card in the lane covers less of the yard. A fish's
// size, a bug's count and a letter's quote stay (a card that keeps its words), being what the card is about.
test('a news card in a large window shows its picture and name, its sentence on hover and read out', async () => {
  const css = await styles();
  const rule =
    css.match(
      /body:not\(\.compact\)\.catch-card:not\(\.keep-detail,:hover,:focus-within\)\.catch-copy>small:not\(\.catch-new,\.catch-new-short\)\{([^}]*)\}/,
    )?.[1] || '';
  assert.match(rule, /clip-path:inset\(50%\)/, 'kept for the live region, not display:none');
  assert.doesNotMatch(rule, /display:none/);
});

// The tool in hand looked like the one under the pointer; it wears the rim, and its seed count stays a pill.
test('the tool in hand wears a rim a hovered one never has, and keeps its seed count', async () => {
  const css = await styles();
  const pressed = css.match(/\.discovery-target \[aria-pressed="true"\]\{([^}]*)\}/)?.[1] || '';
  assert.match(pressed, /box-shadow:inset 0 0 0 2px var\(--garden-rim\)/);
  assert.match(pressed, /font-weight:750/);
  assert.doesNotMatch(css.match(/\.discovery-tool:hover\{([^}]*)\}/)?.[1] || '', /box-shadow/);
  assert.match(css, /\.discovery-target \[aria-pressed="true"\] \.tool-count\{[^}]*background:var\(--garden-paper\)/);
});

test('Back stands before the title, away from Close', async () => {
  const css = await styles();
  assert.match(css, /\.panel-head>#panel-menu\{order:-1;?\}/);
});

// At 560 by 400 the friend's menu opened over the whole head, its own ⋯ under it. A window 280px
// tall or less keeps that (compact-navigation.test.mjs): there is no room under the button.
test("a small window opens the friend's menu under its button", async () => {
  const css = (await styles()).replace(/@media\(max-height:280px\)\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, '');
  const rule = css.match(/body\.compact \.side-panel \.pop-menu\{([^}]*)\}/)?.[1] || '';
  assert.match(rule, /top:calc\(100% \+ 4px\)/);
  assert.doesNotMatch(rule, /inset:8px 8px auto/);
  assert.doesNotMatch(css, /body\.compact \.side-panel \.menu-anchor:has\(\.pop-menu:not\(\[hidden\]\)\)/);
});

// In Japanese the yard's menu at 224px left one character of Reset window size on a second line.
test("the yard's menu is as wide as its longest choice, and the AI cards break Japanese between phrases", async () => {
  const css = await styles();
  const menu = css.match(/(?:^|})\.yard-context-menu\{([^}]*)\}/)?.[1] || '';
  assert.match(menu, /width:max-content/);
  assert.match(menu, /min-width:\d+px/);
  assert.match(menu, /max-width:calc\(100vw - 16px\)/);
  assert.match(css, /\.yard-context-menu>button\{[^}]*white-space:nowrap/);
  assert.match(css, /:lang\(ja\) ?\.choice-card strong\{word-break:keep-all;overflow-wrap:anywhere;?\}/);
});

// At 760 by 520 the fourth place was cut and the panel scrolled: four places fit in a row, what a place
// is for is its card's title, and each atmosphere row is a picture and a word beside its name.
test('Place & atmosphere fits four places and shows the atmosphere as pictures', async () => {
  const [css, html, ui] = await Promise.all([
    styles(),
    readFile('src/index.html', 'utf8'),
    readFile('src/yard/background-ui.js', 'utf8'),
  ]);
  assert.match(css, /grid-auto-columns:minmax\(72px,calc\(\(100% - 24px\) ?\/ ?4\)\)/);
  assert.match(ui, /button\.title = /, "a place's card says what it is for");
  assert.doesNotMatch(html, /id="world-note"/);
  for (const art of [
    'spring',
    'summer',
    'autumn',
    'winter',
    'morning',
    'day',
    'evening',
    'night',
    'clear',
    'rain',
    'snow',
  ])
    assert.match(css, new RegExp(`url\\("\\.\\./art/ui/${art}\\.webp"\\)`), art);
  const chosen = css.match(/\.atmosphere-segments input:checked \+ span\{([^}]*)\}/)?.[1] || '';
  assert.match(chosen, /background:var\(--garden-selected\)/);
  assert.match(chosen, /box-shadow:inset 0 0 0 2px var\(--garden-rim\)/);
  assert.match(css, /body:not\(\.compact\)\.atmosphere-choice\{[^}]*padding-left:/, 'the name beside its row');
});

test("the yard's sound is a switch like the dock's other toggles", async () => {
  const html = await readFile('src/index.html', 'utf8');
  const sound = html.match(/<button id="sound-button"[^>]*>.*?<\/button>/)?.[0] || '';
  assert.match(sound, /class="view-button view-toggle"/);
  assert.match(sound, /<span class="wander-switch" aria-hidden="true"><\/span><\/button>$/);
});

// The select's chevron and a group chat's other friend kept the old blue-grey on the paper.
test('the select chevron and another friend in a group chat take the paper colours', async () => {
  const css = await styles();
  assert.doesNotMatch(css, /%235c6f70/);
  assert.match(css, /select\{[^}]*stroke="%236b5038"|select\{[^}]*stroke='%236b5038'/);
  assert.match(css, /stroke='%23dcc7a6'/, 'the dark paper has its own chevron');
  const remap = css.match(/\.side-panel,dialog\{([^}]*)\}/)?.[1] || '';
  assert.match(remap, /--bubble-peer:var\(--garden-/);
  assert.match(remap, /--peer-ink:var\(--garden-/);
});

test("a menu opened from a control is the yard menu's paper in wood", async () => {
  const css = await styles();
  for (const menu of ['\\.pop-menu', '\\.companion-chips', '\\.tree-menu']) {
    const rule = css.match(new RegExp(`(?:^|})${menu}\\{([^}]*)\\}`))?.[1] || '';
    assert.match(rule, /border:var\(--garden-frame-border\)/, menu);
    assert.match(rule, /background:var\(--garden-frame\)/, menu);
    assert.match(rule, /border-radius:var\(--radius-garden\)/, menu);
  }
  assert.match(css, /\.pop-menu \[role="menuitem"\]\{[^}]*border-radius:10px/);
  assert.match(
    css,
    /\.pop-menu \[role="menuitem"\]:hover:not\(:disabled\),[^{]*\{[^}]*background:var\(--garden-hover\)/,
  );
});

test('the yard takes focus for its keys without the browser ring around the field', async () => {
  const css = await styles();
  assert.match(css, /#yard:focus\{outline:none;?\}/);
  assert.match(css, /#yard:focus-visible\{[^}]*outline-offset:-\d+px/);
});

test("the welcome card's title trails a vine and its starters are cards with an edge", async () => {
  const [css, html] = await Promise.all([styles(), readFile('src/index.html', 'utf8')]);
  assert.match(css, /\.welcome-title::after\{[^}]*title-vine\.webp/);
  const starter = css.match(/(?:^|})\.starter\{([^}]*)\}/)?.[1] || '';
  assert.match(starter, /border:1\.5px solid var\(--garden-line\)/);
  assert.match(starter, /border-radius:var\(--radius-garden\)/);
  assert.match(starter, /background:var\(--garden-field\)/);
  assert.match(css, /\.starter:hover\{[^}]*transform:translateY\(-2px\)/);
  assert.match(html, /<button id="welcome-more" class="button secondary"/);
});

test('an eyebrow is spaced like a word, not a label', async () => {
  const css = await styles();
  assert.match(css, /\.eyebrow\{[^}]*letter-spacing:0\.3px/);
});

// The friends' own words and names were the smallest text on screen.
test("a friend's line is read at the body size, with a tail, and its name a step up", async () => {
  const css = await styles();
  const bubble = css.match(/(?:^|})\.yard-bubble\{([^}]*)\}/)?.[1] || '';
  assert.match(bubble, /font-size:var\(--font-md\)/);
  assert.match(bubble, /font-weight:600/);
  assert.match(css, /\.yard-bubble::before\{/);
  assert.match(css, /\.yard-bubble::after\{/);
  assert.match(css.match(/(?:^|})\.pet-tag\{([^}]*)\}/)?.[1] || '', /font-size:var\(--font-sm\)/);
});

// A friend to bring into the talk was a word in the menu, 18px tall, the same chosen or not.
test('a friend to bring into the talk is a pill large enough to press, filled when chosen', async () => {
  const css = await styles();
  const chip = css.match(/\.companion-chips>\.detect-chip\{([^}]*)\}/)?.[1] || '';
  assert.match(chip, /min-height:28px/);
  assert.match(chip, /border-radius:var\(--radius-pill\)/);
  const on = css.match(/\.companion-chips>\.detect-chip\[aria-pressed="true"\]\{([^}]*)\}/)?.[1] || '';
  assert.match(on, /box-shadow:inset 0 0 0 2px var\(--garden-rim\)/);
});

// The pressed play action looked like the one under the pointer; it wears the rim the tool in hand wears.
test('a pressed play action wears the rim of the tool in hand', async () => {
  const css = await styles();
  const active = css.match(/\.play-action\.active\{([^}]*)\}/)?.[1] || '';
  assert.match(active, /box-shadow:inset 0 0 0 2px var\(--garden-rim\)/);
});

// Now wore the album's green-soft, which on the album's paper came out the tan of a find's record.
test("the album's Now tag is leaf green, apart from the tan of a find's record", async () => {
  const css = await styles();
  const now = css.match(/\.album-now\{([^}]*)\}/)?.[1] || '';
  assert.match(now, /color:var\(--garden-peer-ink\)/);
  assert.match(now, /background:color-mix\(in srgb,var\(--garden-peer-ink\) ?16%,var\(--album-paper\)\)/);
  assert.doesNotMatch(now, /--green-soft/);
});
