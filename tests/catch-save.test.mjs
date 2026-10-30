import assert from 'node:assert/strict';
import test from 'node:test';
import { catalog } from './support/content.mjs';
import { element, installDom, installStorage } from './support/dom.mjs';

const catches = [],
  bonds = [];
globalThis.playPets = {
  catch: (...args) => new Promise(resolve => catches.push({ args, resolve })),
  befriend: async (...args) => {
    bonds.push(args);
    return { ok: true, data: { up: false } };
  },
};
globalThis.matchMedia = () => ({ matches: true });
installStorage();
const { setData, setGame, views } = await import('../src/core/state.js');
const { endFishing, onLake, setupCatch, soloFishing } = await import('../src/yard/catch.js');
const { scene, setScenery } = await import('../src/yard/world.js');

function page(context) {
  const { nodes } = installDom(context, {
    ids: ['yard', 'garden-layer', 'catch-card', 'toast', 'agent-summary', 'yard-hint'],
    props: { rect: { width: 800, height: 560 } },
  });
  // The card starts hidden as in index.html, and its text slots are plain nodes.
  Object.assign(nodes.get('catch-card'), { hidden: true, querySelector: () => element() });
  const pet = { id: 'friend', size: 112 },
    view = { pet, px: 100, py: 200, z: 40, pose: 'idle', bubble: element(), button: element() };
  views.clear();
  views.set(pet.id, view);
  setData({ pets: [pet], assets: [], statuses: {} });
  catches.length = 0;
  bonds.length = 0;
  setupCatch();
  return { nodes, view };
}
const settled = async () => {
  for (let turn = 0; turn < 6; turn++) await Promise.resolve();
};

function attemptCatch(kind, nodes, view, timers) {
  const yard = nodes.get('yard');
  const click = (x, y) => yard.dispatch('click', { clientX: x, clientY: y });
  if (kind === 'bug') {
    setScenery({ catchAt: () => ({ species: catalog.bugs[0].id, x: 100, y: 200 }) });
    click(100, 200);
  } else {
    setScenery({ catchAt: () => null });
    let point;
    for (let y = 0; y < 560 && !point; y += 5) {
      for (let x = 0; x < 800; x += 5) {
        if (onLake(x, y)) {
          point = [x, y];
          break;
        }
      }
    }
    assert.ok(point, 'the fixture exposes lake water');
    click(...point);
    const trip = view.trip;
    view.trip = null;
    view.target = null;
    trip.arrive(view);
    timers.tick(3000);
    nodes.get('garden-layer').children.at(-1).dispatch('click');
  }
}

for (const kind of ['bug', 'fish']) {
  test(`${kind} rewards wait for a successful album save`, async context => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    context.mock.method(Math, 'random', () => 0);
    const { nodes, view } = page(context);
    const attempt = () => attemptCatch(kind, nodes, view, context.mock.timers);
    try {
      attempt();
      assert.equal(catches.length, 1);
      assert.equal(bonds.length, 0, 'a pending save does not earn closeness');
      assert.equal(view.pose, 'idle', 'a pending save does not celebrate');
      assert.equal(view.button.children.length, 0, 'pending catches do not show a success tool');
      catches[0].resolve({ ok: false, error: 'The catch could not be saved.' });
      await settled();
      assert.equal(nodes.get('toast').textContent, 'The catch could not be saved.');
      assert.equal(bonds.length, 0, 'a failed save does not earn closeness');
      assert.equal(view.pose, 'idle');
      assert.equal(view.button.children.length, 0, 'failed catches do not show a success tool');
      assert.equal(nodes.get('catch-card').hidden, true);
      attempt();
      assert.equal(catches.length, 2);
      catches[1].resolve({ ok: true, data: { first: false, entry: { count: 1 } } });
      await settled();
      assert.equal(bonds.length, 1);
      assert.equal(bonds[0][1], 'catch');
      assert.equal(view.pose, 'jump');
      assert.equal(nodes.get('catch-card').hidden, false);
    } finally {
      for (const request of catches) request.resolve({ ok: false, error: 'Save cancelled.' });
      await settled();
      endFishing();
      views.clear();
    }
  });
}

for (const kind of ['bug', 'fish']) {
  for (const change of ['removed', 'replaced']) {
    test(`${kind} save does not reward a ${change} friend view`, async context => {
      context.mock.timers.enable({ apis: ['setTimeout'] });
      context.mock.method(Math, 'random', () => 0);
      const { nodes, view } = page(context);
      try {
        attemptCatch(kind, nodes, view, context.mock.timers);
        assert.equal(catches.length, 1);
        views.delete(view.pet.id);
        if (change === 'replaced') views.set(view.pet.id, { ...view });
        catches[0].resolve({ ok: true, data: { first: false, entry: { count: 1 } } });
        await settled();
        assert.equal(bonds.length, 0, 'the removed view does not earn closeness');
        assert.equal(view.pose, 'idle', 'the detached friend does not celebrate');
        assert.equal(nodes.get('catch-card').hidden, false, 'the successful album save still shows its card');
      } finally {
        for (const request of catches) request.resolve({ ok: false, error: 'Save cancelled.' });
        await settled();
        endFishing();
        views.clear();
      }
    });
  }
}

for (const kind of ['bug', 'fish']) {
  for (const change of ['world', 'game']) {
    test(`${kind} save preserves a new ${change} after the catch`, async context => {
      context.mock.timers.enable({ apis: ['setTimeout'] });
      context.mock.method(Math, 'random', () => 0);
      const { nodes, view } = page(context);
      const previousWorld = scene.world;
      try {
        attemptCatch(kind, nodes, view, context.mock.timers);
        assert.equal(catches.length, 1);
        if (change === 'world') scene.world = 'studio';
        else setGame({ type: 'tag' });
        catches[0].resolve({ ok: true, data: { first: false, entry: { count: 1 } } });
        await settled();
        assert.equal(bonds.length, 1, 'the friend still earned the completed catch');
        assert.equal(view.pose, 'idle', 'catch feedback does not interrupt the new activity');
        assert.equal(nodes.get('catch-card').hidden, false);
      } finally {
        scene.world = previousWorld;
        setGame(null);
        for (const request of catches) request.resolve({ ok: false, error: 'Save cancelled.' });
        await settled();
        endFishing();
        views.clear();
      }
    });
  }
}

test('fishing renders decorative tackle and labels the bite with its action', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  context.mock.method(Math, 'random', () => 0);
  const { nodes, view } = page(context);
  try {
    attemptCatch('fish', nodes, view, context.mock.timers);
    const [rod, line, float] = nodes.get('garden-layer').children;
    assert.equal(rod.getAttribute('aria-hidden'), 'true');
    assert.equal(line.getAttribute('aria-hidden'), 'true', 'the rod and line are decoration rather than controls');
    assert.equal(line.getAttribute('fill'), 'none', 'curved tackle paths do not become solid shapes');
    assert.ok(Number(rod.style.zIndex) < view.z, 'the shaft passes behind the friend instead of covering its face');
    assert.ok(Number(line.style.zIndex) > view.z, 'the cast line stays in front of the fishing friend');
    assert.equal(float.getAttribute('aria-label'), (await import('../src/core/i18n.js')).t('catch.reel'));
  } finally {
    for (const request of catches) request.resolve({ ok: false, error: 'Save cancelled.' });
    await settled();
    endFishing();
    views.clear();
  }
});

// A friend fishing on its own calls the person when a fish bites; the album and closeness come
// only from what the person reels in.
for (const reeled of [false, true])
  test(`a bite on a friend's own trip ${reeled ? 'is caught when the person reels it in' : 'gets away if no one reels it in'}`, async context => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    context.mock.method(Math, 'random', () => 0);
    const { nodes, view } = page(context);
    setData({ pets: [view.pet], assets: [], statuses: {}, bonds: { [view.pet.id]: { points: 300 } } });
    try {
      // The trip's cadence is the module's own: each case starts later than the last one's.
      const start = reeled ? 1e9 : 0;
      soloFishing(start);
      soloFishing(start + 60 * 60 * 1000);
      const trip = view.trip;
      assert.ok(trip, 'a close friend goes fishing on its own');
      view.trip = null;
      view.target = null;
      trip.arrive(view);
      context.mock.timers.tick(3000);
      const float = nodes.get('garden-layer').children.at(-1);
      assert.ok(float.classList.contains('bite'), 'a fish bites');
      assert.notEqual(view.bubble.textContent, '', 'the friend calls the person over');
      if (reeled) float.dispatch('click');
      else for (let i = 0; i < 10; i++) context.mock.timers.tick(1000);
      assert.equal(catches.length, reeled ? 1 : 0);
      if (reeled) {
        catches[0].resolve({ ok: true, data: { first: false, entry: { count: 1 } } });
        await settled();
      }
      assert.equal(bonds.length, reeled ? 1 : 0);
    } finally {
      for (const request of catches) request.resolve({ ok: false, error: 'Save cancelled.' });
      await settled();
      endFishing();
      views.clear();
    }
  });
