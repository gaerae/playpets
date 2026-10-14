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

test('a mini catch card and a toast occupy separate notice lanes without intercepting fishing', async () => {
  const css = await styles();
  const notice = css.match(/body\.mini \.stage:has\(\.catch-card:not\(\[hidden\]\)\)\s*\.toast\{([^}]*)\}/);
  assert.ok(notice, 'a visible catch card moves the mini notice away from its top strip');
  assert.match(notice[1], /top:auto/);
  assert.match(notice[1], /bottom:64px/, 'the notice stays above the care toolbar');
  assert.match(css.match(/(?:^|})\.toast\{([^}]*)\}/)?.[1] || '', /pointer-events:none/);
});

test('icon actions share the control shape and a comfortable target', async () => {
  const css = await styles();
  const rule = css.match(/\.menu-anchor>\.icon-button[^{]*\{([^}]*)\}/);
  assert.ok(rule, "the friend panel's menu button has its own rule");
  assert.match(rule[1], /border-radius:var\(--radius-control\)/);
  assert.match(rule[1], /width:44px;height:44px/);
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

test('full and mini yards fill their windows without a fixed narrow-window height', async () => {
  const css = await styles();
  assert.doesNotMatch(css, /height:340px/, 'narrow windows retain the full scene');
  assert.match(css, /\.topbar\{[^}]*position:absolute/, 'navigation floats above the scene');
  assert.match(css, /\.app-shell\{[^}]*padding:0;/, 'the scene reaches the window edges');
  const mini = css.match(/body\.mini \.yard\{([^}]*)\}/g).join('');
  assert.match(mini, /height:auto/, 'mini keeps the same flexible scene');
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
  assert.match(sky, /background-gallery.*aria-pressed/);
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
  assert.match(css, /\.layout.settings-open \.side-panel\{[^}]*max-height:calc\(100% - 72px\);/);
  assert.match(css, /\.settings-content\{[^}]*overflow-y:auto/);
  assert.doesNotMatch(css, /\.layout.settings-open \.settings-index\{[^}]*display:none/);
});

test('Menu hover and selected settings states remain distinct', async () => {
  const css = await styles();
  assert.match(css, /\.yard-controls-panel \.panel-tab:hover\{[^}]*var\(--control-hover\)/);
  assert.match(css, /\.settings-index button:hover:not\(\[aria-selected="true"\]\)\{[^}]*var\(--control-hover\)/);
  assert.match(css, /\.settings-index button\[aria-selected="true"\]\{[^}]*var\(--segment-active\)/);
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
  '--head': 'src/core/sprites.js',
  '--orb-x': 'src/yard/sky.js',
  '--orb-y': 'src/yard/sky.js',
  '--moon-shade': 'src/yard/sky.js',
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
  assert.ok(darkOnly.length, 'the dark tokens are found');
  const misread = rules.flatMap(r =>
    dark(r.media)
      ? []
      : Object.entries(r.props)
          .filter(([, value]) => darkOnly.some(name => new RegExp(`var\\(\\s*${name}[\\s,)]`).test(value)))
          .map(([prop]) => `${r.file} ${r.sel} { ${prop} }`),
  );
  assert.deepEqual(misread, []);
});

test('indoor flowers use a planter without blocking their controls', async () => {
  const css = await styles();
  const rule = css.match(/\.yard\[data-sky="false"\] \.plant::after\{([^}]*)\}/)?.[1] || '';
  assert.match(rule, /indoor-planter\.png/);
  assert.match(rule, /pointer-events:none/);
  await readFile('src/art/decor/indoor-planter.png');
});

test('indoor planters follow evening and night flower lighting', async () => {
  const css = await readFile('src/styles/garden.css', 'utf8');
  for (const [period, brightness] of [
    ['evening', '0.88'],
    ['night', '0.62'],
  ]) {
    const selector = `.yard[data-sky="false"].period-${period} .plant::after`;
    const start = css.indexOf(selector);
    assert.ok(start >= 0, `${period} planter light`);
    const rule = css.slice(start, css.indexOf('}', start));
    assert.ok(rule.includes(`brightness(${brightness})`), period);
  }
});

test('indoor growth stages enter the planter mouth without moving mature stems', async () => {
  const css = await styles();
  assert.match(css, /\.yard\[data-sky="false"\] \.plant:not\(\[data-stage="bloom"\]\)svg\{position:relative;top:-12%;/);
});

test('floating scene menus and mini chats escape the full panel placement', async () => {
  const css = await styles();
  assert.match(css, /\.layout.panel-open \.side-panel\{[^}]*bottom:64px;/, 'the open panel clears the menu entry');
  assert.match(css, /\.yard-controls-panel\{[^}]*z-index:30;/);
  assert.match(css, /body\.mini \.layout.mini-chat-open \.side-panel\{[^}]*top:auto;/);
});

test('game and onboarding notices clear the floating scene controls', async () => {
  const css = await styles();
  for (const selector of ['.game-banner', '.catch-card', '.empty-yard.aside']) {
    const rules = css.split('}').filter(rule => rule.endsWith(';') && rule.includes(`${selector}{`));
    assert.ok(
      rules.some(rule => /top:112px/.test(rule)),
      `${selector} clears navigation`,
    );
  }
});
