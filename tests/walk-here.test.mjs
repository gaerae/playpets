// A press on open yard ground sends a friend there (yard/walk-here.js): the selected one, else the
// nearest; none at work, held or away; not in a game, with a tool, or when the press closed a menu;
// a spot it cannot stand on moves to the nearest ground it can; a mark shows the spot until it gets there.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { reduced } from '../src/core/sprites.js';
import { setAiming, setData, setGame, setSelected, views } from '../src/core/state.js';
import { depthScaleAt, measureYard, sizeOf, underDock } from '../src/yard/field.js';
import { setupWalkHere, walkHere } from '../src/yard/walk-here.js';
import { element, installDom } from './support/dom.mjs';
import { flatField } from './support/flat-field.mjs';

function yard(t, { dock = null } = {}) {
  const { document } = installDom(t, { anyId: true, props: { rect: { width: 800, height: 560 } } });
  const querySelector = document.querySelector;
  document.querySelector = selector => {
    if (selector === '.yard-dock' && dock) return { getBoundingClientRect: () => dock };
    if (selector.includes('aria-expanded')) return document.menuOpen ? element() : null;
    return querySelector.call(document, selector);
  };
  document.getElementById('side-panel').hidden = true;
  flatField(t);
  setData({ statuses: {}, pets: [] });
  measureYard();
  setSelected(null);
  const previous = reduced.matches;
  reduced.matches = false;
  views.clear();
  t.after(() => {
    views.clear();
    setSelected(null);
    reduced.matches = previous;
  });
  return document;
}
function friend(id, px) {
  const v = {
    pet: { id, size: 128 },
    x: 0.5,
    y: 0.5,
    px,
    py: 200,
    button: element(),
    label: element(),
    canvas: { animate() {} },
  };
  views.set(id, v);
  return v;
}

test('the selected friend walks to where the ground was pressed', t => {
  yard(t);
  const near = friend('near', 380),
    chosen = friend('chosen', 20);
  setSelected('chosen');
  assert.equal(walkHere(420, 420), true);
  assert.ok(chosen.target, 'the selected one goes');
  assert.equal(near.target ?? null, null);
  assert.equal(chosen.trip.slow, false, 'at walking pace');
});

test('with none selected, the friend nearest the spot goes', t => {
  yard(t);
  const far = friend('far', 20),
    near = friend('near', 380);
  assert.equal(walkHere(450, 420), true);
  assert.ok(near.target);
  assert.equal(far.target ?? null, null);
});

test('a friend at work, held or away stays; a selected one busy so sends nobody', t => {
  yard(t);
  const busy = friend('busy', 380);
  busy.duty = 'working';
  setSelected('busy');
  friend('other', 20);
  assert.equal(walkHere(420, 420), false);
  setSelected(null);
  busy.duty = null;
  busy.drag = {};
  const other = views.get('other');
  other.away = true;
  assert.equal(walkHere(420, 420), false, 'one held, one away: nobody to go');
});

test('nothing walks in a game, with a tool in hand, or when the press closed a menu', t => {
  const document = yard(t);
  setupWalkHere();
  const v = friend('daisy', 380);
  setGame({ type: 'tag' });
  try {
    assert.equal(walkHere(420, 420), false);
  } finally {
    setGame(null);
  }
  setAiming(true);
  try {
    assert.equal(walkHere(420, 420), false);
  } finally {
    setAiming(false);
  }
  document.menuOpen = true;
  globalThis.window.dispatch('pointerdown');
  document.menuOpen = false;
  assert.equal(walkHere(420, 420), false, 'that press was to close the menu');
  globalThis.window.dispatch('pointerdown');
  assert.equal(walkHere(420, 420), true);
  assert.ok(v.target);
});

// A menu closes in its own document-capture listener (core/menu.js), registered before this one: the
// press is read at the window, before any of them.
test('a press that closed a menu walks nobody, though the menu shut before the yard heard it', t => {
  const document = yard(t);
  const v = friend('daisy', 380);
  document.addEventListener('pointerdown', () => (document.menuOpen = false), true);
  setupWalkHere();
  document.menuOpen = true;
  globalThis.window.dispatch('pointerdown');
  document.dispatch('pointerdown');
  assert.equal(walkHere(420, 420), false);
  assert.equal(v.target ?? null, null);
});

// Dropping the treat or the last seed puts the tool away inside the same click (care.js, garden.js).
test('a press made with a tool in hand walks nobody, though the tool was put away by it', t => {
  const document = yard(t);
  const v = friend('daisy', 380);
  setupWalkHere();
  setAiming(true);
  globalThis.window.dispatch('pointerdown');
  document.dispatch('pointerdown');
  setAiming(false);
  assert.equal(walkHere(420, 420), false, 'that press dropped the treat');
  globalThis.window.dispatch('pointerdown');
  assert.equal(walkHere(420, 420), true, 'the next press walks');
  assert.ok(v.target);
});

test('while a friend fishes, a press beside the water walks nobody', t => {
  yard(t);
  let fishing = true;
  const v = friend('daisy', 380);
  setupWalkHere({ busy: () => fishing });
  globalThis.window.dispatch('pointerdown');
  assert.equal(walkHere(420, 420), false);
  fishing = false;
  assert.equal(walkHere(420, 420), true);
  assert.ok(v.target);
});

test('a spot under the dock moves to the nearest ground clear of it', t => {
  const dock = { left: 300, top: 470, width: 200, height: 60, right: 500, bottom: 530 };
  const document = yard(t, { dock });
  const v = friend('daisy', 100);
  assert.equal(walkHere(400, 500), true);
  assert.ok(v.target);
  const [x, y] = document.getElementById('walk-mark').style.translate.split(' ').map(Number.parseFloat);
  assert.ok(!underDock(x, y, sizeOf(v.pet) / 2, dock), `it goes to ${x}, ${y}`);
  assert.ok(Math.hypot(x - 400, y - 500) <= 120, 'nearby');
});

test('the mark shows the spot until the friend gets there', t => {
  const document = yard(t);
  const v = friend('daisy', 380);
  walkHere(420, 420);
  const mark = document.getElementById('walk-mark');
  assert.ok(mark && !mark.hidden, 'shown');
  v.trip.arrive(v, 0);
  assert.ok(mark.classList.contains('gone'), 'it fades once the friend is there');
});

// Feedback: in a small window the friends are small but the mark was not. It is sized as the friend
// going there stands at the spot: by its size in this window and how far back the spot is.
test('the mark is as big as the friend going there would look at the spot', t => {
  const document = yard(t);
  const v = friend('daisy', 380);
  const mark = document.getElementById('walk-mark');
  const zoomAt = (x, y) => {
    walkHere(x, y);
    const [px, py] = mark.style.translate.split(' ').map(Number.parseFloat);
    const zoom = Number(mark.style['--zoom']);
    assert.equal(zoom, Math.round(((sizeOf(v.pet) * depthScaleAt(px, py)) / 112) * 100) / 100);
    return zoom;
  };
  assert.ok(zoomAt(420, 330) < zoomAt(420, 520), 'smaller farther back');
});
