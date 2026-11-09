// The snowman game: two friends roll a snowball that grows as it goes, the person presses it to
// help or drags it, and full balls lift onto a stack of three (src/yard/snowman.js). Stopping it
// halfway leaves nothing behind and the day unspent.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { element } from './support/dom.mjs';

const built = [];
const answer = (data = null) => ({ ok: true, data });
// What buildSnowman answers: a test sets its own (the backend's snowman, a refusal, a wait).
let building = async () => answer();
globalThis.playPets = {
  buildSnowman: (...args) => {
    built.push(args);
    return building(...args);
  },
  hideDecor: async () => answer(),
  moveDecor: async () => answer(),
  putAway: async () => answer(),
};
const state = await import('../src/core/state.js');
const { list } = await import('../src/core/i18n.js');
const { reduced } = await import('../src/core/sprites.js');
const { EDGE, field, fieldToYard, measureYard, sizeOf } = await import('../src/yard/field.js');
const { giftSize } = await import('../src/yard/props.js');
const { giftKind } = await import('../src/yard/catalog.js');
const { scene } = await import('../src/yard/world.js');
const play = await import('../src/yard/play.js');
const snowman = await import('../src/yard/snowman.js');
const { BALLS, DRAG_FASTER, GROW, LIFT_MS, PUSH, SPARKLES, START, rollSpeed, stackBottoms, stackSpot } =
  await import('../src/yard/snowman-rules.js');
const { setupSnowTrail } = await import('../src/yard/snow-trail.js');
const { decorButton, renderDecor } = await import('../src/yard/decor.js');
const { closeDress, setupDress } = await import('../src/yard/snowman-dress.js');
const { drawYard } = await import('./support/yard.mjs');

// December 15 at noon, local time.
const NOW = new Date(2026, 11, 15, 12).getTime();
const kids = node => node.children.filter(c => typeof c === 'object' && !c.removed);
const has = cls => node => node.classList.contains(cls);
// A canvas context that takes every call the trail makes and draws nothing.
const fakeContext = () => ({
  globalAlpha: 1,
  clearRect() {},
  drawImage() {},
  setTransform() {},
  translate() {},
  scale() {},
  fillRect() {},
  createRadialGradient: () => ({ addColorStop() {} }),
});

async function yard(ctx, { garden = {} } = {}) {
  built.length = 0;
  building = async () => answer();
  let clock = 1000;
  ctx.mock.method(performance, 'now', () => clock);
  ctx.mock.method(Math, 'random', () => 0);
  const pets = ['a', 'b', 'c'].map((id, i) => ({ id, name: id, size: 100, x: 0.3 + i * 0.2, y: 0.6 }));
  let trail = null;
  // Before the yard's own cleanup, while the fake document is still there.
  ctx.after(() => {
    closeDress(false);
    play.endGame();
    state.setGame(null);
  });
  const drawn = await drawYard(ctx, {
    now: NOW,
    scene: { season: 'winter', world: 'woodland' },
    garden: { decor: [], boxed: [], snowmanDay: '', ...garden },
    pets,
    before: ({ document, nodes }) => {
      nodes.get('yard').getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
      measureYard();
      const make = document.createElement;
      document.createElement = tag => {
        const node = make(tag);
        if (tag === 'canvas') node.getContext = fakeContext;
        return node;
      };
      trail = element('canvas', { id: 'trail-layer', hidden: true, rect: { width: 1000, height: 600 } });
      trail.getContext = fakeContext;
      nodes.set('trail-layer', trail);
      setupSnowTrail();
      for (const pet of pets)
        state.views.set(pet.id, {
          pet,
          button: document.createElement('button'),
          label: document.createElement('div'),
          tagName: document.createElement('span'),
          bubble: document.createElement('div'),
          x: pet.x,
          y: pet.y,
          px: 0,
          py: 0,
          until: 0,
          frozenUntil: 0,
        });
    },
  });
  state.setGame(null);
  state.setSelected('a');
  reduced.matches = false;
  play.setupPlay();
  snowman.setupSnowman({ start: play.startGame, end: play.endGame, after: play.after });
  setupDress({ redraw: renderDecor, button: decorButton });
  const layer = drawn.nodes.get('garden-layer');
  const live = cls => kids(layer).filter(has(cls));
  const ball = () => live('snowball').find(b => !b.classList.contains('stacked'));
  const art = el => kids(el).find(has('snowball-art'));
  const roll = el => kids(art(el)).find(has('snowball-roll'));
  // The box a prop is set down in (props.js setDown): its middle, its bottom and its size.
  const box = el => {
    const [, x, y] = el.style.transform.match(/translate\(([-\d.e]+)px,([-\d.e]+)px\)/).map(Number);
    const w = parseFloat(el.style.width),
      h = parseFloat(el.style.height);
    return { x: x + w / 2, bottom: y + h, w, h };
  };
  const tick = ms => {
    clock += ms;
    ctx.mock.timers.tick(ms);
  };
  const run = ms => {
    for (let at = 0; at < ms; at += 50) {
      tick(50);
      if (state.game) play.playGame(clock, 50);
    }
  };
  const point = el => ({ button: 0, pointerId: 1, clientX: box(el).x, clientY: box(el).bottom - 4 });
  const press = () => {
    const el = ball();
    el.dispatch('pointerdown', point(el));
    el.dispatch('pointerup', point(el));
  };
  const said = id => state.views.get(id).bubble.textContent;
  const row = () => drawn.nodes.get('games-menu').children.find(r => r.dataset.game === 'snowman');
  return { ...drawn, trail, layer, live, ball, art, roll, box, tick, run, press, said, row, clock: () => clock };
}
const start = () => play.startGame('snowman');
// The base ball's width and the stack's foot: the base ball's bottom in the snowman's drawing.
function stackFoot() {
  const size = giftSize('snowman'),
    [baseShare, footShare] = giftKind('snowman').stack,
    at = fieldToYard(stackSpot([]));
  return { x: at.x, y: at.y - footShare * size.h, baseW: size.w * baseShare };
}

test('the play menu offers a snowman only while the yard shows winter', async ctx => {
  const y = await yard(ctx);
  play.syncGameUi();
  assert.equal(y.row().hidden, false);
  scene.season = 'autumn';
  play.syncGameUi();
  assert.equal(y.row().hidden, true);
  scene.season = 'winter';
  scene.world = 'studio';
  play.syncGameUi();
  assert.equal(y.row().hidden, true, 'the cozy living room has no snow');
});

test('a snowman built today or a full yard gets a friend’s line, and nothing starts', async ctx => {
  const y = await yard(ctx, { garden: { snowmanDay: '2026-12-15' } });
  start();
  assert.equal(state.game, null);
  assert.ok(list('snowman.built_today').includes(y.said('a')));
  state.data.garden.snowmanDay = '';
  state.data.garden.decor = Array.from({ length: 12 }, (_, i) => ({ id: `d${i}`, kind: 'bench', x: 0.1, y: 0.5 }));
  start();
  assert.equal(state.game, null);
  assert.ok(list('snowman.full').includes(y.said('a')));
});

test('friends roll the ball, which grows as it rolls and slows as it grows', async ctx => {
  const y = await yard(ctx);
  start();
  assert.equal(state.game.ball.size, START);
  assert.equal(y.said('a') && list('snowman.start').includes(y.said('a')), true);
  const x0 = state.game.ball.x;
  y.run(1000);
  assert.ok(state.game.ball.size > START, 'it grew');
  const early = Math.abs(state.game.ball.x - x0);
  state.game.ball.size = 0.85;
  const x1 = state.game.ball.x;
  y.run(1000);
  const late = Math.abs(state.game.ball.x - x1);
  assert.ok(early > late, `a big ball rolls slower (${early} then ${late})`);
  // The pushers stand behind the ball, on the side it comes from.
  const lead = state.views.get('a'),
    middle = lead.px + sizeOf(lead.pet) / 2;
  assert.ok((middle - y.box(y.ball()).x) * state.game.ball.dir < 0);
});

test('a press helps push: the ball grows a step and squashes', async ctx => {
  const y = await yard(ctx);
  start();
  y.press();
  assert.equal(state.game.ball.size, START + PUSH);
  assert.ok(y.art(y.ball()).classList.contains('push'));
  assert.equal(y.live('snow-puff').length, 5);
  assert.ok(list('snowman.push').includes(y.said('a')));
  y.tick(220);
  assert.equal(y.art(y.ball()).classList.contains('push'), false);
  y.tick(400);
  assert.equal(y.live('snow-puff').length, 0, 'the puffs go with one timeout');
});

test('dragging rolls the ball toward the pointer and grows it by the way it went', async ctx => {
  const y = await yard(ctx);
  start();
  y.run(300);
  const el = y.ball(),
    down = { button: 0, pointerId: 1, clientX: 300, clientY: 300 };
  el.dispatch('pointerdown', down);
  el.dispatch('pointermove', { ...down, clientX: 600 });
  const { x: x0, size: s0 } = state.game.ball;
  y.run(500);
  const moved = state.game.ball.x - x0;
  assert.ok(moved > 0, 'it went right');
  assert.ok(moved <= rollSpeed(s0) * DRAG_FASTER * 0.5 + 1e-9, 'no faster than its weight allows');
  assert.ok(Math.abs(state.game.ball.size - (s0 + GROW * moved)) < 1e-6);
  el.dispatch('pointerup', { ...down, clientX: 600 });
  assert.equal(state.game.ball.drag, null);
  const x1 = state.game.ball.x;
  y.run(500);
  assert.notEqual(state.game.ball.x, x1, 'the friends roll it again');
});

test('a full ball lifts in an arc onto the stack and settles; three make the stack', async ctx => {
  const y = await yard(ctx);
  start();
  const stack = stackFoot();
  for (const [i, full] of BALLS.entries()) {
    state.game.ball.size = full - 1e-9;
    const from = y.box(y.ball());
    y.press();
    assert.equal(state.game.stage, 'lifting');
    const to = { x: stack.x, bottom: stack.y - stackBottoms(BALLS)[i] * stack.baseW };
    y.run(LIFT_MS / 2);
    const mid = y.box(y.live('snowball').find(b => !b.classList.contains('stacked')));
    assert.ok(mid.bottom < (from.bottom + to.bottom) / 2 - 1, 'above the straight line, halfway');
    y.run(LIFT_MS / 2);
    const stacked = y.live('stacked');
    assert.equal(stacked.length, i + 1);
    assert.ok(y.art(stacked[i]).classList.contains('settle'));
    if (i < 2) {
      assert.equal(state.game.ball.size, START);
      assert.ok(
        [state.views.get('a'), state.views.get('b')].some(v => list('snowman.more').includes(v.bubble.textContent)),
      );
    }
  }
  const boxes = y.live('stacked').map(y.box);
  for (const [i, b] of boxes.entries()) {
    assert.ok(Math.abs(b.w - BALLS[i] * stack.baseW) < 0.5, `ball ${i} is ${BALLS[i]} of the base`);
    assert.ok(
      Math.abs(b.bottom - (stack.y - stackBottoms(BALLS)[i] * stack.baseW)) < 0.5,
      `ball ${i} rests on the one below`,
    );
    assert.ok(Math.abs(b.x - stack.x) < 0.5);
  }
  assert.equal(state.game.stage, 'done');
});

test('stopping halfway leaves nothing behind and the day unspent', async ctx => {
  const stops = {
    'the menu': () => play.endGame(),
    'another season': () => {
      scene.season = 'autumn';
      if (!snowman.showsWinter()) play.endGame();
    },
    'a friend leaving': () => {
      state.setData({ ...state.data, pets: state.data.pets.filter(p => p.id !== 'b') });
      play.endGameIfSomeoneLeft();
    },
  };
  for (const [why, stop] of Object.entries(stops))
    await ctx.test(why, async t => {
      const y = await yard(t);
      start();
      y.run(2000);
      y.press();
      // One ball already on the stack.
      state.game.ball.size = 1 - 1e-9;
      y.press();
      y.run(LIFT_MS + 100);
      assert.equal(y.live('stacked').length, 1);
      stop();
      assert.equal(state.game, null);
      assert.deepEqual(y.live('snowball'), []);
      assert.deepEqual(y.live('snow-puff'), []);
      assert.ok(y.trail.classList.contains('fading'), 'the trail fades back into the snow');
      assert.doesNotThrow(() => y.tick(5000));
      assert.deepEqual(y.live('snowball'), []);
      assert.deepEqual(built, []);
      assert.equal(state.data.garden.snowmanDay, '');
    });
});

test('a cancelled drag leaves the ball for the friends', async ctx => {
  const y = await yard(ctx);
  start();
  y.run(300);
  const el = y.ball(),
    down = { button: 0, pointerId: 1, clientX: 300, clientY: 300 };
  el.dispatch('pointerdown', down);
  el.dispatch('pointermove', { ...down, clientX: 600 });
  y.run(200);
  const { x, y: depth } = state.game.ball;
  el.dispatch('pointercancel', down);
  assert.equal(state.game.ball.drag, null);
  assert.deepEqual([state.game.ball.x, state.game.ball.y], [x, depth], 'it stays where it was let go');
  y.run(500);
  assert.notEqual(state.game.ball.x, x, 'the friends roll it from there');
});

test('a drag whose pointer capture is lost ends where the ball is', async ctx => {
  const y = await yard(ctx);
  start();
  y.run(300);
  const el = y.ball(),
    down = { button: 0, pointerId: 1, clientX: 300, clientY: 300 };
  el.dispatch('pointerdown', down);
  el.dispatch('pointermove', { ...down, clientX: 600 });
  y.run(200);
  const { x } = state.game.ball;
  el.dispatch('lostpointercapture', down);
  assert.equal(state.game.ball.drag, null);
  assert.equal(el.classList.contains('dragging'), false);
  assert.equal(state.game.ball.x, x);
  y.run(500);
  assert.notEqual(state.game.ball.x, x, 'the friends roll it from there');
});

test('a resized window ends a drag where the ball is', async ctx => {
  const y = await yard(ctx);
  start();
  y.run(300);
  const el = y.ball(),
    down = { button: 0, pointerId: 1, clientX: 300, clientY: 300 };
  el.dispatch('pointerdown', down);
  el.dispatch('pointermove', { ...down, clientX: 600 });
  y.run(200);
  const { x } = state.game.ball;
  snowman.resizeSnowman();
  assert.equal(state.game.ball.drag, null);
  assert.equal(state.game.ball.x, x);
});

test('the arrow keys roll the ball and Enter helps', async ctx => {
  const y = await yard(ctx);
  start();
  const { x, size } = state.game.ball,
    step = 16 / (field().width - EDGE * 2);
  y.ball().dispatch('keydown', { key: 'ArrowRight' });
  assert.ok(Math.abs(state.game.ball.x - (x + step)) < 1e-9);
  assert.ok(Math.abs(state.game.ball.size - (size + GROW * step)) < 1e-9);
  const grown = state.game.ball.size;
  y.ball().dispatch('keydown', { key: 'Enter' });
  assert.ok(Math.abs(state.game.ball.size - (grown + PUSH)) < 1e-9);
});

test('with reduced motion the ball does not turn or squash and appears on the stack', async ctx => {
  const y = await yard(ctx);
  reduced.matches = true;
  start();
  const x0 = state.game.ball.x;
  y.run(1000);
  assert.notEqual(state.game.ball.x, x0, 'it still rolls');
  assert.doesNotMatch(y.roll(y.ball()).style.transform ?? '', /rotate/);
  y.press();
  assert.equal(y.art(y.ball()).classList.contains('push'), false);
  assert.equal(y.live('snow-puff').length, 0);
  state.game.ball.size = 1 - 1e-9;
  y.press();
  assert.notEqual(state.game.stage, 'lifting');
  const stacked = y.live('stacked');
  assert.equal(stacked.length, 1);
  assert.ok(y.art(stacked[0]).classList.contains('appear'));
});

// The finish (Task 7): the stack becomes the snowman, saved where it stood.
const flush = () => new Promise(resolve => setImmediate(resolve));
const OLD = { id: 'o', kind: 'snowman', x: 0.3, y: 0.7, dress: [] };
// Each ball made full and pressed, then the frames run until it is on the stack.
function stackAll(y) {
  for (const full of BALLS) {
    state.game.ball.size = full - 1e-9;
    y.press();
    while (state.game?.stage === 'lifting') y.run(50);
  }
}
// The friend gets where the game sent it (motion.js moveFriends does this in the app).
function arrive(y, id) {
  const v = state.views.get(id),
    trip = v.trip;
  Object.assign(v, v.target);
  v.target = null;
  v.trip = null;
  trip?.arrive?.(v, y.clock());
}
// The backend's snowman, put in the garden as its state event would.
function builds() {
  building = async (x, y, day) => {
    const d = { id: 'n', kind: 'snowman', x, y, dress: [] };
    state.data.garden.decor = [...state.data.garden.decor.filter(o => o.kind !== 'snowman'), d];
    state.data.garden.snowmanDay = day;
    return answer(d);
  };
}
const tray = y => kids(y.nodes.get('yard')).find(has('dress-tray')) ?? null;

test('a finished snowman is placed where it was stacked, counted for the day, and the yard shows it', async ctx => {
  const y = await yard(ctx);
  builds();
  start();
  stackAll(y);
  assert.equal(state.game.stage, 'done');
  assert.equal(y.live('snow-sparkle').length, SPARKLES);
  assert.equal(y.live('snowman-preview').length, 1);
  const leaving = y.live('leaving');
  assert.equal(leaving.length, 3, 'the stack fades as the snowman shows');
  // and settles to the drawing's height, the top ball lowered most
  const lowered = leaving.map(b => Number(y.roll(b).style.transform.match(/translateY\(([\d.]+)px\)/)[1]));
  assert.ok(lowered[0] === 0 && lowered[1] > 0 && lowered[2] > lowered[1]);
  // Saved only once the stack has faded, so the yard's own drawing never shows over a ball.
  y.tick(350);
  assert.deepEqual(built, []);
  assert.equal(state.data.garden.snowmanDay, '');
  assert.equal(y.live('snowman-preview').length, 1);
  // Set down as the yard will draw it.
  const preview = y.box(y.live('snowman-preview')[0]),
    size = giftSize('snowman'),
    foot = fieldToYard({ x: 0.72, y: 0.72 });
  assert.ok(Math.abs(preview.x - foot.x) < 0.5 && Math.abs(preview.bottom - foot.y) < 0.5);
  assert.ok(Math.abs(preview.w - size.w) < 0.5);
  y.tick(50);
  assert.deepEqual(y.live('snowball'), [], 'the stack is gone');
  assert.deepEqual(built, [[0.72, 0.72, '2026-12-15']]);
  assert.equal(state.data.garden.snowmanDay, '2026-12-15');
  // The lead walks over beside it, then says so.
  assert.ok(state.views.get('a').target, 'the lead walks over');
  arrive(y, 'a');
  assert.ok(list('snowman.done').includes(y.said('a')));
  assert.ok(state.views.get('a').look, 'and looks at it');
  await flush();
  assert.ok(decorButton('n'), 'the yard draws the snowman');
  assert.deepEqual(y.live('snowman-preview'), []);
  y.tick(1100);
  assert.deepEqual(y.live('snow-sparkle'), [], 'the sparkles go with one timeout');
  assert.ok(state.game, 'the friends stay a moment');
  assert.equal(tray(y), null, 'the tray waits for the line, which would stand over it');
  y.tick(1400);
  assert.equal(state.game, null);
  assert.ok(tray(y), 'its dress tray opens as the friends go home');
  y.tick(5000);
  assert.ok(tray(y), 'and stays open');
  assert.equal(state.data.garden.snowmanDay, '2026-12-15');
});

test('the old snowman melts with a friend’s line before the new one is saved', async ctx => {
  const y = await yard(ctx, { garden: { decor: [OLD] } });
  builds();
  start();
  stackAll(y);
  assert.ok(decorButton('o').classList.contains('melting'));
  assert.ok(
    ['b', 'c'].some(id => list('snowman.melt').includes(y.said(id))),
    'another friend says goodbye',
  );
  // A redraw of the gifts meanwhile keeps it melting.
  renderDecor();
  assert.ok(decorButton('o').classList.contains('melting'));
  y.tick(1550);
  assert.deepEqual(built, []);
  y.tick(50);
  assert.deepEqual(built, [[0.72, 0.72, '2026-12-15']]);
  await flush();
  assert.equal(decorButton('o'), null, 'the new one took its place');
  assert.ok(decorButton('n'));
});

test('a refused save brings the old snowman back and says why', async ctx => {
  const y = await yard(ctx, { garden: { decor: [OLD] } });
  building = async () => ({ ok: false, error: 'Built today.' });
  start();
  stackAll(y);
  arrive(y, 'a');
  assert.ok(list('snowman.done').includes(y.said('a')));
  y.tick(1600);
  assert.equal(built.length, 1);
  await flush();
  assert.equal(decorButton('o').classList.contains('melting'), false);
  assert.equal(state.data.garden.snowmanDay, '');
  assert.equal(y.nodes.get('toast').children.at(-1).dataset.words, 'Built today.');
  assert.equal(state.views.get('a').bubble.hidden, true, 'no cheer for a snowman not kept');
  assert.ok(
    ['b', 'c'].every(id => state.views.get(id).bubble.hidden || !list('snowman.melt').includes(y.said(id))),
    'and no goodbye to one that stays',
  );
  assert.ok(decorButton('o').classList.contains('unmelting'), 'it fades back in');
  y.tick(400);
  assert.equal(decorButton('o').classList.contains('unmelting'), false);
  assert.equal(state.game, null);
  assert.deepEqual(y.live('snowman-preview'), []);
  assert.equal(tray(y), null);
});

test('a save whose answer cannot be drawn still ends the round', async ctx => {
  const y = await yard(ctx);
  building = async () =>
    answer({
      get id() {
        throw new Error('broken answer');
      },
    });
  ctx.mock.method(console, 'error', () => {});
  start();
  stackAll(y);
  y.tick(400);
  assert.equal(built.length, 1);
  await flush();
  assert.equal(state.game, null, 'not stuck in its last stage');
  assert.deepEqual(y.live('snowman-preview'), []);
});

test('stopping during the melt keeps the old snowman', async ctx => {
  await ctx.test('before the save', async t => {
    const y = await yard(t, { garden: { decor: [OLD] } });
    builds();
    start();
    stackAll(y);
    y.tick(800);
    play.endGame();
    assert.equal(decorButton('o').classList.contains('melting'), false);
    assert.deepEqual(y.live('snowman-preview'), []);
    assert.deepEqual(y.live('snow-sparkle'), []);
    y.tick(5000);
    assert.deepEqual(built, [], 'nothing is saved later');
    assert.equal(state.data.garden.snowmanDay, '');
  });
  await ctx.test('while the save is on its way', async t => {
    const y = await yard(t, { garden: { decor: [OLD] } });
    let answered;
    building = () => new Promise(resolve => (answered = resolve));
    start();
    stackAll(y);
    y.tick(1600);
    assert.equal(state.data.garden.snowmanDay, '2026-12-15');
    play.endGame();
    assert.equal(decorButton('o').classList.contains('melting'), false);
    assert.equal(state.data.garden.snowmanDay, '', 'the day is given back until the save is answered');
    answered(answer({ id: 'n', kind: 'snowman', x: 0.72, y: 0.72, dress: [] }));
    await flush();
    assert.equal(tray(y), null, 'a late answer leaves the yard alone');
    assert.equal(state.game, null);
  });
});

test('with reduced motion the snowman crossfades in and the old one fades', async ctx => {
  const y = await yard(ctx, { garden: { decor: [OLD] } });
  builds();
  reduced.matches = true;
  start();
  stackAll(y);
  const sparkles = y.live('snow-sparkle');
  assert.equal(sparkles.length, SPARKLES);
  assert.ok(sparkles.every(has('still')));
  assert.ok(decorButton('o').classList.contains('melting'));
  y.tick(550);
  assert.deepEqual(built, []);
  y.tick(50);
  assert.equal(built.length, 1);
});

// Stopping a first snowman (nothing to melt) in the stack's fade (Task 8 carry-over).
test('stopping a first snowman while the stack fades saves nothing and spends no day', async ctx => {
  const y = await yard(ctx);
  builds();
  start();
  stackAll(y);
  y.tick(200);
  play.endGame();
  y.tick(5000);
  assert.deepEqual(built, [], 'no late save');
  assert.equal(state.data.garden.snowmanDay, '');
  assert.deepEqual(y.live('snowman-preview'), []);
});

test('an error after the game ended is logged, a refusal after it stays quiet', async ctx => {
  for (const [why, error, logged] of [
    ['a real error', new Error('boom'), 1],
    ['a refusal', Object.assign(new Error('Built today.'), { spoken: true }), 0],
  ])
    await ctx.test(why, async t => {
      const y = await yard(t);
      const logs = t.mock.method(console, 'error', () => {});
      let fail;
      building = () => new Promise((_, reject) => (fail = reject));
      start();
      stackAll(y);
      y.tick(500);
      assert.equal(built.length, 1);
      play.endGame();
      fail(error);
      await flush();
      assert.equal(logs.mock.callCount(), logged);
    });
});

// A friend suggests a snowman (Task 8).
const MIN = 60 * 1000;
// Ticks the suggestion over `ms`, 10 s at a time, until a friend speaks; the bubbles that showed
// right after a tick.
function across(y, ms) {
  const shown = [];
  for (let at = 0; at < ms; at += 10000) {
    y.tick(10000);
    snowman.snowmanTick(y.clock());
    for (const id of state.views.keys()) {
      const v = state.views.get(id);
      if (!v.bubble.hidden && v.bubble.textContent) shown.push({ id, words: v.bubble.textContent });
    }
    if (shown.length) break;
  }
  return shown;
}

test('a friend suggests a snowman now and then, once a day', async ctx => {
  const y = await yard(ctx);
  const first = across(y, 9 * MIN);
  assert.equal(first.length, 1);
  assert.ok(list('snowman.start').includes(first[0].words));
  assert.equal(state.game, null, 'it waits a moment before it starts rolling');
  y.tick(1200);
  assert.equal(state.game.kind, 'snowman');
  assert.equal(state.game.ids[0], first[0].id);
  play.endGame();
  // The friends are home again.
  for (const id of state.views.keys()) arrive(y, id);
  assert.deepEqual(across(y, 30 * MIN), [], 'not twice in a day');
  ctx.mock.timers.setTime(new Date(2026, 11, 16, 10).getTime());
  assert.equal(across(y, 9 * MIN).length, 1, 'but again the next day');
});

test('with the yard full and no snowman, a friend says so instead, once a day', async ctx => {
  const y = await yard(ctx, {
    garden: { decor: Array.from({ length: 12 }, (_, i) => ({ id: `x${i}`, kind: 'xmas_tree', x: 0.1, y: 0.5 })) },
  });
  const said = across(y, 9 * MIN);
  assert.equal(said.length, 1);
  assert.ok(list('snowman.full').includes(said[0].words));
  y.tick(5000);
  assert.equal(state.game, null);
  assert.deepEqual(across(y, 30 * MIN), []);
});

test('nothing is suggested in autumn, in the cozy living room, during a game, while aiming, or while a friend is busy', async ctx => {
  const cases = {
    autumn: () => (scene.season = 'autumn'),
    'the cozy living room': () => (scene.world = 'studio'),
    'a game': () => start(),
    aiming: () => state.setAiming('treat'),
    'a busy friend': () => (state.views.get('b').target = { x: 0, y: 0 }),
  };
  for (const [why, set] of Object.entries(cases))
    await ctx.test(why, async t => {
      const y = await yard(t);
      set();
      const lead = state.game?.ids[0];
      const before = state.game;
      const said = across(y, 30 * MIN).filter(s => !(before && s.words === state.views.get(lead).bubble.textContent));
      assert.deepEqual(said, []);
      y.tick(2000);
      assert.equal(state.game, before, 'no game starts');
      state.setAiming(false);
    });
});

test('a season that changes before the friend starts rolling cancels the start', async ctx => {
  const y = await yard(ctx);
  assert.equal(across(y, 9 * MIN).length, 1);
  scene.season = 'autumn';
  y.tick(1200);
  assert.equal(state.game, null);
  assert.deepEqual(built, []);
});

test('a friend who left, or a game begun by the person, cancels the start', async ctx => {
  for (const [why, change] of Object.entries({
    'the friend left': () => state.views.delete(state.views.keys().next().value),
    'a game began': () => play.startGame('snowman', 'c'),
  }))
    await ctx.test(why, async t => {
      const y = await yard(t);
      assert.equal(across(y, 9 * MIN).length, 1);
      const lead = [...state.views.keys()][0];
      change();
      const game = state.game;
      y.tick(1200);
      assert.equal(state.game, game);
      if (game) assert.equal(game.ids[0], 'c', 'the person’s game is left alone');
      else assert.equal(state.views.has(lead), false);
    });
});

test('from the menu, a full yard or a snowman built today gets a friend’s line', async ctx => {
  const y = await yard(ctx, {
    garden: { decor: Array.from({ length: 12 }, (_, i) => ({ id: `x${i}`, kind: 'xmas_tree', x: 0.1, y: 0.5 })) },
  });
  play.syncGameUi();
  y.row().onclick();
  assert.equal(state.game, null);
  assert.ok(list('snowman.full').includes(y.said('a')));
  state.data.garden.decor = [];
  state.data.garden.snowmanDay = '2026-12-15';
  y.row().onclick();
  assert.equal(state.game, null);
  assert.ok(list('snowman.built_today').includes(y.said('a')));
});
