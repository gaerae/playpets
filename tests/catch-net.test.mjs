import assert from 'node:assert/strict';
import test from 'node:test';
import { catalog } from './support/content.mjs';
import { installDom, installStorage } from './support/dom.mjs';

const catches = [];
globalThis.playPets = {
  catch: () => new Promise(resolve => catches.push(resolve)),
  befriend: async () => ({ ok: true, data: { up: false } }),
};
globalThis.matchMedia = () => ({ matches: true });
installStorage();
const { setData, views } = await import('../src/core/state.js');
const { setupCatch, endFishing } = await import('../src/yard/catch.js');
const { setScenery } = await import('../src/yard/world.js');
const { sizeOf, petHeight } = await import('../src/yard/field.js');

test('a saved bug catch has a decorative net that expires or clears on a scene transition', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const { nodes, element } = installDom(context, {
    ids: ['yard', 'catch-card', 'toast', 'yard-hint', 'agent-summary'],
    props: { rect: { width: 800, height: 560 } },
  });
  nodes.get('catch-card').querySelector = () => element();
  const pet = { id: 'friend', size: 112 },
    view = { pet, px: 100, py: 200, z: 40, pose: 'idle', bubble: element(), button: element() };
  views.set(pet.id, view);
  setData({ pets: [pet], assets: [], statuses: {} });
  setScenery({ catchAt: () => ({ species: catalog.bugs[0].id, x: 100, y: 200 }) });
  setupCatch();
  try {
    for (const cleanup of ['timeout', 'transition']) {
      const yard = nodes.get('yard');
      yard.dispatch('click', { clientX: 100, clientY: 200 });
      assert.ok(
        view.button.children.every(node => node.removed),
        'pending saves do not display a success net',
      );
      catches.shift()({ ok: true, data: { first: false, entry: { count: 1 } } });
      for (let turn = 0; turn < 6; turn++) await Promise.resolve();
      const net = view.button.children.at(-1),
        grip = view.button.children.at(-2);
      assert.equal(net?.className, 'bug-net', 'the saved catch has a visible net beside its friend');
      assert.equal(net.getAttribute('aria-hidden'), 'true');
      assert.equal(net.removed, undefined);
      // The net sweeps behind the friend's face; only its grip is drawn over the body, in the paws.
      assert.equal(grip?.className, 'bug-net bug-net-grip', 'the end of the handle is in the paws, in front');
      assert.equal(grip.getAttribute('aria-hidden'), 'true');
      assert.equal(grip.style.left, net.style.left, 'the grip sits on the handle of the same net');
      assert.equal(grip.style.top, net.style.top);
      // The handle's end (12, 114 of the 90 by 126 drawing) is in the paws, about the middle of the
      // friend and a little below its chin, and the net leans out from there, so the handle passes
      // under the face instead of across it.
      const width = parseFloat(net.style.width),
        height = parseFloat(net.style.height);
      assert.ok(
        Math.abs(parseFloat(net.style.left) + (width * 12) / 90 - sizeOf(pet) * 0.55) < 0.5,
        'held at the middle',
      );
      assert.ok(
        Math.abs(parseFloat(net.style.top) + (height * 114) / 126 - petHeight(pet) * 0.7) < 1,
        'and at the paws',
      );
      for (const part of [net, grip])
        assert.match(part.innerHTML, /<g transform="rotate\(30 12 114\)">/, 'leaning out');
      if (cleanup === 'timeout') context.mock.timers.tick(900);
      else endFishing();
      assert.equal(net.removed, true, `${cleanup} removes the capture tool`);
      assert.equal(grip.removed, true, `${cleanup} removes the grip with it`);
    }
  } finally {
    endFishing();
    views.clear();
  }
});

test('a tool in hand never hides a creature: pressing it puts the tool away and catches', async context => {
  const { nodes, element } = installDom(context, {
    ids: ['yard', 'catch-card', 'toast', 'yard-hint', 'agent-summary', 'feed', 'plant-tool'],
    props: { rect: { width: 800, height: 560 } },
  });
  nodes.get('catch-card').querySelector = () => element();
  const pet = { id: 'friend', size: 112 },
    view = { pet, px: 100, py: 200, z: 40, pose: 'idle', bubble: element(), button: element() };
  views.set(pet.id, view);
  setData({ pets: [pet], assets: [], statuses: {} });
  setScenery({ catchAt: () => ({ species: catalog.bugs[0].id, x: 100, y: 200 }), near: () => true });
  const { setAiming } = await import('../src/core/state.js');
  setAiming('dig');
  setupCatch();
  const before = catches.length;
  try {
    nodes.get('yard').dispatch('click', { clientX: 100, clientY: 200 });
    const state = await import('../src/core/state.js');
    assert.equal(state.aiming, false, 'the dig tool is put away');
    assert.equal(catches.length, before + 1, 'and the creature is caught in the same press');
  } finally {
    setAiming(false);
    endFishing();
    views.clear();
  }
});

test('a click catches a bug first, then a petal, and a tool in hand never gives way to a petal', async context => {
  const { nodes, element } = installDom(context, {
    ids: ['yard', 'catch-card', 'toast', 'yard-hint', 'agent-summary', 'feed', 'plant-tool'],
    props: { rect: { width: 800, height: 560 } },
  });
  nodes.get('catch-card').querySelector = () => element();
  const pet = { id: 'friend', size: 112 },
    view = { pet, px: 100, py: 200, z: 40, pose: 'idle', bubble: element(), button: element() };
  views.set(pet.id, view);
  setData({ pets: [pet], assets: [], statuses: {} });
  const bug = { species: catalog.bugs[0].id, x: 100, y: 200 },
    asked = [],
    wished = [];
  let creature = null,
    petal = true;
  setScenery({
    catchAt: () => creature,
    near: () => !!creature,
    nearPetal: () => petal,
    catchPetal: (x, y) => {
      asked.push([x, y]);
      return petal ? { x, y } : null;
    },
  });
  const { setAiming } = await import('../src/core/state.js');
  setupCatch({ wish: point => wished.push(point) });
  const yard = nodes.get('yard');
  const before = catches.length;
  try {
    creature = bug;
    yard.dispatch('click', { clientX: 100, clientY: 200 });
    assert.equal(catches.length, before + 1, 'a bug under the pointer is caught');
    assert.deepEqual(wished, [], 'and no petal with it');
    creature = null;
    yard.dispatch('click', { clientX: 120, clientY: 210 });
    assert.deepEqual(asked, [[120, 210]]);
    assert.deepEqual(wished, [{ x: 120, y: 210 }], 'a petal under the pointer brings its wish');
    petal = false;
    yard.dispatch('click', { clientX: 130, clientY: 210 });
    assert.equal(wished.length, 1, 'a missed press wishes nothing');
    petal = true;
    setAiming('dig');
    asked.length = 0;
    yard.dispatch('click', { clientX: 120, clientY: 210 });
    const state = await import('../src/core/state.js');
    assert.equal(state.aiming, 'dig', 'a dig press next to a passing petal still digs');
    assert.deepEqual(asked, []);
    assert.equal(wished.length, 1);
  } finally {
    setAiming(false);
    endFishing();
    views.clear();
  }
});

test('a creature flying in front of anything in the yard is caught by a press on its body', async context => {
  const { nodes, element } = installDom(context, {
    ids: ['yard', 'pet-layer', 'label-layer', 'garden-layer', 'catch-card', 'toast', 'yard-hint', 'agent-summary'],
    props: { rect: { width: 800, height: 560 } },
  });
  nodes.get('catch-card').querySelector = () => element();
  const pet = { id: 'friend', size: 112 },
    view = { pet, px: 100, py: 200, z: 40, pose: 'idle', bubble: element(), button: element() };
  views.set(pet.id, view);
  setData({ pets: [pet], assets: [], statuses: {} });
  // The yard's own reach: a creature counts within `reach` of the press (22 in an open sky).
  let creature = null;
  const within = (x, y, reach = 22) => creature && Math.hypot(creature.x - x, creature.y - y) < reach;
  setScenery({
    catchAt: (x, y, reach) => (within(x, y, reach) ? creature : null),
    near: (x, y, reach) => !!within(x, y, reach),
    nearPetal: () => false,
    catchPetal: () => null,
  });
  setupCatch();
  const yard = nodes.get('yard');
  for (const layer of ['pet-layer', 'label-layer', 'garden-layer']) yard.append(nodes.get(layer));
  const press = (target, onStop, more = {}) => ({
    target,
    button: 0,
    clientX: 100,
    clientY: 200,
    stopPropagation: onStop,
    ...more,
  });
  // Each is a button in the yard (props.js, snowman.js, views.js), as here.
  const thing = (kind, layer) => {
    const node = element('button');
    node.classList.add(kind);
    nodes.get(layer).append(node);
    return node;
  };
  try {
    const things = [
      ['yard-pet', 'pet-layer'],
      ['pet-tag', 'label-layer'],
      ...['plant', 'decor', 'planted-tree', 'snowball', 'bobber'].map(kind => [kind, 'garden-layer']),
    ];
    for (const [kind, layer] of things) {
      const under = thing(kind, layer);
      creature = { species: catalog.bugs[0].id, x: 108, y: 200 };
      const before = catches.length;
      let stopped = false,
        clickStopped = false;
      await yard.dispatch(
        'pointerdown',
        press(under, () => (stopped = true)),
      );
      assert.equal(catches.length, before + 1, `a bug over a ${kind} is caught`);
      assert.ok(stopped, `and the ${kind} beneath never hears the press`);
      await yard.dispatch(
        'click',
        press(under, () => (clickStopped = true), { detail: 1 }),
      );
      assert.ok(clickStopped, 'nor the click that ends it: no pat, nothing opened or rolled');
      assert.equal(catches.length, before + 1, 'the click catches nothing more');
    }
    // A creature passing near, not on, a friend leaves the press to the friend: picked up, patted.
    for (const at of [null, { species: catalog.bugs[0].id, x: 118, y: 200 }]) {
      creature = at;
      const friend = thing('yard-pet', 'pet-layer');
      let stopped = false,
        clickStopped = false;
      await yard.dispatch(
        'pointerdown',
        press(friend, () => (stopped = true)),
      );
      assert.equal(stopped, false, at ? 'a creature 18px off is a near miss' : 'an empty sky leaves the press');
      await yard.dispatch(
        'click',
        press(friend, () => (clickStopped = true), { detail: 1 }),
      );
      assert.equal(clickStopped, false, 'and its click too');
    }
    // The yard's own controls are not under the creatures.
    creature = { species: catalog.bugs[0].id, x: 100, y: 200 };
    const control = element('button');
    yard.append(control);
    let controlStopped = false;
    await yard.dispatch(
      'pointerdown',
      press(control, () => (controlStopped = true)),
    );
    assert.equal(controlStopped, false, 'a button on the yard keeps its press');
    // A press that caught one but ended away from the yard makes no click; a click from the keyboard
    // after it (Enter on a plant) still opens what it is on.
    const plant = thing('plant', 'garden-layer');
    await yard.dispatch(
      'pointerdown',
      press(plant, () => {}),
    );
    let keyStopped = false;
    await yard.dispatch(
      'click',
      press(plant, () => (keyStopped = true), { detail: 0 }),
    );
    assert.equal(keyStopped, false, 'a keyboard click is never the end of a press');
  } finally {
    endFishing();
    views.clear();
  }
});
