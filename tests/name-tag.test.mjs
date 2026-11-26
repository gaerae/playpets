// A friend's name tag is not always on: the yard shows friends, and the tag comes when it is wanted
// (docs/design/2026-11-24-the-yard-plays-like-a-game.md). Under the pointer or the keyboard, while it
// talks or thinks, when its coding agent waits for the person or failed, and
// in a game, where the tag says who is it. A friend hiding in hide-and-seek keeps it hidden.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { installDom, installStorage } from './support/dom.mjs';

const compact = css =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>~])\s*/g, '$1');
const styles = async () =>
  compact(
    (await Promise.all((await readdir('src/styles')).sort().map(f => readFile(`src/styles/${f}`, 'utf8')))).join('\n'),
  );
const rules = (css, selector) =>
  [...css.matchAll(/(?<=^|})([^{}]+)\{([^}]*)\}/g)].filter(([, s]) => s.split(',').includes(selector)).map(m => m[2]);

const SHOWN = [
  '.pet-label.pointing .pet-tag',
  '.pet-label.focused .pet-tag',
  '.pet-label.thinking .pet-tag',
  '.yard-bubble:not([hidden])~.pet-tag',
  '.pet-label.calling .pet-tag',
  '.pet-label.tagger .pet-tag',
  '.yard.playing .pet-tag',
  '.pet-tag:hover',
];

test('a name tag is hidden until it is wanted, in any window size', async () => {
  const css = await styles();
  assert.ok(
    rules(css, '.pet-tag').some(r => /visibility:hidden/.test(r)),
    'hidden by default',
  );
  for (const selector of SHOWN)
    assert.ok(
      rules(css, selector).some(r => /visibility:visible/.test(r)),
      `${selector} shows it`,
    );
  assert.doesNotMatch(css, /body\.compact \.pet-tag\{[^}]*visibility/, 'one rule for every window');
});

test('the chosen friend wears its ring, not its tag, until it is pointed at', async () => {
  const css = await styles();
  assert.ok(
    !rules(css, '.pet-label.selected .pet-tag').some(r => /visibility:visible/.test(r)),
    'choosing a friend does not show its tag',
  );
  assert.ok(rules(css, '.yard-pet.selected:before').length > 0, 'the chosen friend is marked in the yard');
});

test('a tag that is going lingers a moment, so the pointer can reach it to talk', async () => {
  const css = await styles();
  const base = rules(css, '.pet-tag').find(r => /visibility:hidden/.test(r));
  assert.match(base, /transition:[^;]*visibility 0s[^;]*\d/, 'its hiding waits');
});

test('a friend hiding in a game keeps its tag hidden whatever else shows it', async () => {
  const css = await styles();
  const at = selector => css.indexOf(`${selector}{`);
  const hiding = css.lastIndexOf('.pet-label.hiding .pet-tag{');
  assert.ok(hiding > 0);
  assert.match(css.slice(hiding).match(/\{([^}]*)\}/)[1], /visibility:hidden/);
  const shown = css.lastIndexOf('.yard.playing .pet-tag');
  assert.ok(shown > 0 && hiding > shown, 'the hiding rule comes after the rule that shows it');
  assert.ok(at('.pet-label.hiding .pet-tag') >= 0);
});

test('a friend whose agent waits for the person or failed calls with its tag; one at work does not', async t => {
  installDom(t, {
    anyId: true,
    props: {
      value: '',
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600 }),
    },
  });
  installStorage(t, { getItem: () => '1', setItem() {} });
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.ResizeObserver = class {
    observe() {}
  };
  globalThis.playPets = { getChat: async () => ({ ok: true, data: [] }) };
  const { setData, views } = await import('../src/core/state.js');
  const { measureYard } = await import('../src/yard/field.js');
  const { setupViews, syncViews } = await import('../src/yard/views.js');
  const at = state => ({
    pets: [{ id: 'p0', assetId: 'cat', name: 'Friend', size: 112, x: 0.4, y: 0.5 }],
    assets: [{ id: 'cat', displayName: 'Cat', spriteUrl: 'cat.png' }],
    providers: [],
    agentPets: { claude: 'p0' },
    agents: [{ kind: 'claude', label: 'Claude Code' }],
    statuses: { p0: { state, message: '', source: 'agent', at: Date.now() } },
    busy: [],
    bonds: {},
    garden: { decor: [], plants: [], trees: [] },
  });
  views.clear();
  t.after(() => views.clear());
  setData(at('working'));
  measureYard();
  setupViews({ select() {}, patted() {}, openChat() {}, gameTap() {}, resized() {} });
  syncViews();
  const button = views.get('p0').button;
  assert.equal(button.classList.contains('calling'), false, 'working');
  for (const [state, calls] of [
    ['waiting', true],
    ['error', true],
    ['working', false],
  ]) {
    setData(at(state));
    syncViews();
    assert.equal(button.classList.contains('calling'), calls, state);
  }
});
