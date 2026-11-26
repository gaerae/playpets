// A desktop window is sent only its part of the state (app.rs OVERLAY_KEYS, overlay_state) and only
// the events it acts on (OVERLAY_EVENTS): on Windows each monitor's window evaluates every push. The
// overlay page, run here on the whole state, reads exactly those keys; and it acts on exactly those
// events, which the yard window acts on too unless only the desktop does.

import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { element, installDom, installStorage, keepGlobals } from './support/dom.mjs';

const app = await readFile('src-tauri/src/app.rs', 'utf8');
/** A `const NAME: [&str; n] = [...]` list of app.rs. */
const rustList = name => {
  const body = app.match(new RegExp(`const ${name}: \\[&str; \\d+\\] = \\[([^\\]]*)\\];`))?.[1];
  assert.ok(body, `app.rs has ${name}`);
  return [...body.matchAll(/"([^"]+)"/g)].map(m => m[1]);
};
const OVERLAY_KEYS = rustList('OVERLAY_KEYS');
const OVERLAY_EVENTS = rustList('OVERLAY_EVENTS');
const OVERLAY_ONLY_EVENTS = rustList('OVERLAY_ONLY_EVENTS');

const NOW = Date.UTC(2026, 10, 15, 12);
// The state as the yard window gets it (public_state), with one friend and one gift out on display 0.
function full(language) {
  return {
    pets: [
      {
        id: 'a',
        assetId: 'cat',
        name: 'Momo',
        visualStyle: 'default',
        size: 112,
        x: 0.5,
        y: 0.5,
        persona: 'kind',
        onDesktop: true,
      },
    ],
    agentPets: { claude: 'a' },
    autostart: false,
    limits: { persona: 400 },
    garden: { seeds: 1, plants: [], trees: [], decor: [{ id: 'g', kind: 'unknown-gift', x: 0.3, y: 0.6, dress: [] }] },
    album: { fish: {} },
    bonds: { a: { points: 10 } },
    letters: [{ year: 2026, friend: 'a', text: 'Dear you', at: NOW }],
    defaults: { ollamaEndpoint: 'http://localhost:11434' },
    agents: [{ kind: 'claude', label: 'Claude Code' }],
    version: '1.7.2',
    updateChannel: 'github',
    ownsWebviewStorage: true,
    hasBackgroundsFolder: false,
    project: { site: 'https://example.com', repository: 'https://example.com/repo' },
    assets: [{ id: 'cat', displayName: 'Cat', spriteUrl: 'pet-asset://sprite/cat' }],
    providers: [],
    detected: {},
    warnings: [],
    statuses: { a: { state: 'working', message: 'Reading', source: 'agent', at: NOW } },
    busy: [],
    desktopLayout: [
      {
        id: 'a',
        x: 100,
        y: 500,
        width: 140,
        height: 150,
        displayId: '0',
        origin: { x: 0, y: 0, width: 1920, height: 1080 },
      },
      {
        id: 'g',
        decor: 'unknown-gift',
        x: 400,
        y: 600,
        width: 80,
        height: 80,
        displayId: '0',
        origin: { x: 0, y: 0, width: 1920, height: 1080 },
      },
    ],
    desktop: true,
    nightDecor: [],
    communities: [],
    petFolders: {},
    desktopWander: true,
    language,
    autoChatter: false,
    autoPlay: false,
    sound: { on: false, volume: 50 },
    alwaysOnTop: false,
    scene: { season: 'auto' },
    winterAsked: null,
  };
}

test('the overlay page reads exactly the keys its windows are sent', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { document } = installDom(t, {
    anyId: true,
    // The page fills its name button with markup and finds the name's span in it.
    props: {
      querySelector(selector) {
        return this.querySelectorAll(selector)[0] ?? element('span');
      },
    },
  });
  document.documentElement = element('html');
  installStorage(t);
  keepGlobals(t, 'fetch', 'Image');
  globalThis.fetch = async () => {
    throw new Error('no catalogue here');
  };
  globalThis.Image = class {};
  const { language } = await import('../src/core/i18n.js');
  const read = new Set();
  const watched = state =>
    new Proxy(state, {
      get(target, key, receiver) {
        if (typeof key === 'string') read.add(key);
        return Reflect.get(target, key, receiver);
      },
    });
  let change, event;
  window.__DISPLAY = '0';
  window.playPets = {
    bootstrap: async () => ({ ok: true, data: watched(full(language())) }),
    onChange: cb => (change = cb),
    onEvent: cb => (event = cb),
  };
  await import('../src/overlay/overlay.js');
  change(watched(full(language())));
  for (const type of [...OVERLAY_EVENTS, 'hover', 'grass'])
    event({
      type,
      petId: 'a',
      state: 'done',
      message: 'Done',
      source: 'agent',
      at: NOW,
      action: 'pet',
      kind: 'flower',
    });
  await new Promise(resolve => setImmediate(resolve));
  const unread = OVERLAY_KEYS.filter(key => !read.has(key));
  const unsent = [...read].filter(key => !OVERLAY_KEYS.includes(key));
  assert.deepEqual(unsent, [], 'the overlay reads a key its windows are not sent: add it to OVERLAY_KEYS');
  assert.deepEqual(unread, [], 'its windows are sent a key the overlay never reads: take it from OVERLAY_KEYS');
});

// The overlay's own modules, which it alone loads (as modules.test.mjs follows imports).
async function overlayFiles() {
  const dir = 'src/overlay';
  return Promise.all((await readdir(dir)).filter(f => f.endsWith('.js')).map(f => readFile(path.join(dir, f), 'utf8')));
}

test('an overlay window is sent the events the overlay acts on, and the yard the rest', async () => {
  const overlay = (await overlayFiles()).join('\n');
  const acted = new Set([...overlay.matchAll(/event\.type === '([\w-]+)'/g)].map(m => m[1]));
  // `layout`, `hover` and `grass` go to each window on its own (overlay.rs sync_windows).
  assert.deepEqual(
    [...acted].filter(type => !['layout', 'hover', 'grass'].includes(type)).sort(),
    [...OVERLAY_EVENTS].sort(),
    'OVERLAY_EVENTS lists what overlay.js acts on',
  );
  // An event only the desktop is sent: nothing outside the overlay names it.
  const yard = [];
  for (const dir of ['src', 'src/core', 'src/yard', 'src/panel'])
    for (const file of await readdir(dir))
      if (file.endsWith('.js')) yard.push(await readFile(path.join(dir, file), 'utf8'));
  for (const type of OVERLAY_ONLY_EVENTS) {
    assert.ok(OVERLAY_EVENTS.includes(type));
    const named = new RegExp(`event\\.type === '${type}'|e\\.type === '${type}'|'${type}':|^\\s*${type}:`, 'm');
    assert.ok(!yard.some(source => named.test(source)), `the yard acts on '${type}'`);
  }
});

// The backend hands a state over as JSON text, which a webview takes in faster than the same value
// written out as a script's literal (app.rs pp_script); an event, small, comes as itself.
test('the bridge parses a state sent as text and passes an event on as it is', async () => {
  const commands = await readFile('src-tauri/src/commands.rs', 'utf8');
  const bridge = commands.match(/const BRIDGE_JS: &str = r#"([\s\S]*?)"#;/)[1].replace('__COMMANDS__', '[]');
  const window = {};
  new Function('window', bridge)(window);
  const changes = [],
    events = [];
  window.playPets.onChange(state => changes.push(state));
  window.playPets.onEvent(e => events.push(e));
  const state = { pets: [{ id: 'a', name: `It s "Momo" \\ o'k` }] };
  // As the backend writes it: serde_json's string of the state's text.
  new Function('window', '__pp', `window.__pp&&__pp('change',${JSON.stringify(JSON.stringify(state))})`)(
    window,
    window.__pp,
  );
  window.__pp('event', { type: 'say', petId: 'a', message: 'hi' });
  assert.deepEqual(changes, [state]);
  assert.deepEqual(events, [{ type: 'say', petId: 'a', message: 'hi' }]);
});
