// A push from the backend brings the page in line with the state, and the backend pushes often
// with little or nothing changed (a scene echoed back, a chat's status, the start's switches). An
// unchanged push writes nothing: no friend's size or tag, no list rebuilt, one look at the dock.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { installDom, installStorage } from './support/dom.mjs';

globalThis.playPets = { getChat: async () => ({ ok: true, data: [] }) };
const shared = await import('../src/core/state.js');
const { companions, setData, setSelected, views } = shared;
const { measureYard } = await import('../src/yard/field.js');
const { setupViews, syncView, syncViews } = await import('../src/yard/views.js');
const { renderPanel } = await import('../src/panel/friend.js');

const friends = n =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    assetId: 'cat',
    name: `Friend ${i}`,
    size: 112,
    x: 0.1 + (i % 6) * 0.15,
    y: 0.4 + Math.floor(i / 6) * 0.2,
    providerId: i < 4 ? 'local' : '',
  }));
const state = n => ({
  pets: friends(n),
  assets: [{ id: 'cat', displayName: 'Cat', spriteUrl: 'cat.png' }],
  providers: [{ id: 'local', name: 'Local' }],
  agentPets: { claude: 'p0' },
  agents: [{ kind: 'claude', label: 'Claude Code' }],
  statuses: { p0: { state: 'working', message: 'Reading', source: 'agent', at: Date.now() } },
  busy: [],
  bonds: {},
  garden: { decor: [], plants: [], trees: [] },
});
// The yard with `n` friends, every layout read counted.
function yard(t, n) {
  const reads = { count: 0 };
  const { nodes, document, element } = installDom(t, {
    anyId: true,
    props: {
      value: '',
      scrollHeight: 0,
      getBoundingClientRect() {
        reads.count++;
        return { left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600 };
      },
    },
  });
  const dock = element('div');
  dock.className = 'yard-dock';
  dock.getBoundingClientRect = () => {
    reads.count++;
    return { left: 400, top: 540, right: 700, bottom: 580, width: 300, height: 40 };
  };
  document.append(dock);
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.ResizeObserver = class {
    observe() {}
  };
  globalThis.Option = class {
    constructor(text, value) {
      Object.assign(this, { text, value });
    }
  };
  installStorage(t, { getItem: () => '1', setItem() {} });
  views.clear();
  companions.clear();
  setData(state(n));
  setSelected('p0');
  measureYard();
  setupViews({ select() {}, patted() {}, openChat() {}, gameTap() {}, resized() {} });
  t.after(() => views.clear());
  return { reads, nodes };
}
// The same state as a new push brings it: equal, not the same objects.
const push = () => setData(JSON.parse(JSON.stringify(shared.data)));
// Counts every write to `node` and to what it holds: children replaced, attributes, titles and the
// sizes a friend's fit sets.
function watchWrites(node, writes) {
  for (const child of node.children) if (typeof child === 'object') watchWrites(child, writes);
  for (const method of ['replaceChildren', 'setAttribute', 'append']) {
    const was = node[method];
    node[method] = function (...args) {
      writes.push(`${method} ${node.className}`);
      return was.apply(this, args);
    };
  }
  let title = node.title;
  Object.defineProperty(node, 'title', {
    get: () => title,
    set(value) {
      writes.push(`title ${node.className}`);
      title = value;
    },
  });
  for (const property of ['width', 'height', 'scale', 'zIndex']) {
    let value = node.style[property];
    Object.defineProperty(node.style, property, {
      get: () => value,
      set(next) {
        writes.push(`${property} ${node.className}`);
        value = next;
      },
    });
  }
}

test('twelve friends are brought in line with one look at the dock', t => {
  const { reads } = yard(t, 12);
  reads.count = 0;
  syncViews();
  assert.ok(reads.count <= 2, `the first sync reads the layout ${reads.count} times`);
  reads.count = 0;
  push();
  syncViews();
  assert.ok(reads.count <= 2, `a push reads the layout ${reads.count} times`);
});

test('an unchanged push writes nothing on a friend: not its size, its depth or its tag', t => {
  yard(t, 12);
  syncViews();
  const writes = [];
  for (const v of views.values()) {
    watchWrites(v.button, writes);
    watchWrites(v.label, writes);
  }
  push();
  syncViews();
  assert.deepEqual(writes, []);
  // What did change is still drawn: a new name reaches the tag.
  shared.data.pets[3].name = 'Renamed';
  syncViews();
  assert.equal(views.get('p3').tagName.textContent, 'Renamed');
});

test("an unchanged push leaves the friend tab's lists as they are", t => {
  const { nodes } = yard(t, 12);
  syncViews();
  renderPanel();
  const rebuilt = [];
  for (const id of ['friend-select', 'companion-chips', 'friend-chips']) {
    const node = nodes.get(id),
      was = node.replaceChildren;
    node.replaceChildren = function (...args) {
      rebuilt.push(id);
      return was.apply(this, args);
    };
  }
  push();
  renderPanel();
  assert.deepEqual(rebuilt, []);
  shared.data.pets[5].name = 'Renamed';
  renderPanel();
  assert.deepEqual(rebuilt, ['friend-select'], 'a friend renamed is renamed in the list');
  assert.equal(nodes.get('friend-select').children[5].text, 'Renamed');
});

// A coding agent's hook sends a status on every tool it uses: only that friend is drawn again.
test("an agent's status redraws its own friend and leaves the others be", t => {
  yard(t, 12);
  syncViews();
  const writes = new Map();
  for (const [id, v] of views) {
    writes.set(id, []);
    watchWrites(v.button, writes.get(id));
    watchWrites(v.label, writes.get(id));
  }
  shared.data.statuses = { ...shared.data.statuses, p3: { state: 'waiting', message: 'May I?', source: 'agent' } };
  syncView('p3');
  assert.ok(writes.get('p3').length > 0, 'its dot and its name for a screen reader');
  assert.equal(views.get('p3').dot.dataset.state, 'waiting');
  for (const [id, list] of writes) if (id !== 'p3') assert.deepEqual(list, [], `${id} is left be`);
});

// The status handler of app.js, with the page around it: what it drew.
async function statusEvent(event, selected) {
  const source = await readFile('src/app.js', 'utf8');
  const start = source.indexOf('\n  status: e => {');
  const block = source.slice(start, source.indexOf('\n  },', start) + 4);
  const drawn = [];
  const context = {
    data: { statuses: {} },
    selected,
    applyStatus(data, e) {
      data.statuses[e.petId] = e;
    },
    ...Object.fromEntries(
      ['render', 'renderPanel', 'hint', 'speak', 'syncView'].map(name => [
        name,
        (...args) => drawn.push([name, ...args]),
      ]),
    ),
  };
  vm.runInNewContext(`({${block}}).status(event)`, { ...context, event });
  return drawn;
}

test('a status event draws its friend, the summary, and the panel only when it is that friend', async () => {
  const event = { type: 'status', petId: 'p3', state: 'working', source: 'agent' };
  const other = await statusEvent(event, 'p0');
  assert.ok(!other.some(([name]) => name === 'render'), 'not the whole page');
  assert.deepEqual(
    other.filter(([name]) => name !== 'speak'),
    [['syncView', 'p3'], ['hint']],
  );
  const mine = await statusEvent(event, 'p3');
  assert.ok(
    mine.some(([name]) => name === 'renderPanel'),
    "the panel shows that friend's state",
  );
});

// The push handler of app.js (api.onChange), with the page around it: what it drew, and from what.
async function pushHandler() {
  const source = await readFile('src/app.js', 'utf8');
  const start = source.indexOf('\napi.onChange(');
  const block = source.slice(source.lastIndexOf('\n\n', start), source.indexOf('\n// The friends chat among', start));
  const drawn = [],
    timers = [];
  const context = {
    selected: 'a',
    data: { n: 0, pets: [{ id: 'a', providerId: '' }] },
    api: { onChange: fn => (context.handler = fn) },
    setData: value => (context.data = value),
    pet: () => context.data?.pets?.find(p => p.id === context.selected),
    render: () => drawn.push(['render', context.data.n]),
    refreshChat: () => drawn.push(['refreshChat']),
    setTimeout: fn => timers.push(fn),
  };
  vm.runInNewContext(block, context);
  const settle = () => {
    while (timers.length) timers.shift()();
  };
  return { push: next => context.handler(next), settle, drawn, context };
}

// A chat turn sends a status and a change on its way out and the same with the reply, each its
// own message: the pushes that come together are drawn once, from the last.
test('pushes that come together are drawn once, from the latest state', async () => {
  const { push, settle, drawn, context } = await pushHandler();
  for (const n of [1, 2, 3]) push({ n, pets: [{ id: 'a', providerId: '' }] });
  assert.deepEqual(drawn, [], 'not drawn under the push');
  assert.equal(context.data.n, 3, 'the state is taken at once');
  settle();
  assert.deepEqual(drawn, [['render', 3]]);
  push({ n: 4, pets: [{ id: 'a', providerId: 'local' }] });
  settle();
  assert.deepEqual(drawn.slice(1), [['render', 4], ['refreshChat']], 'a friend given an AI has its log redrawn');
});
