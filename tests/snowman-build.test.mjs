// The snowman game: two friends roll a snowball that grows as it goes, the person presses it to
// help or drags it, and full balls lift onto a stack of three (src/yard/snowman.js). Stopping it
// halfway leaves nothing behind and the day unspent.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { element } from './support/dom.mjs';

const built = [];
const answer = (data = null) => ({ ok: true, data });
globalThis.playPets = {
  buildSnowman: async (...args) => {
    built.push(args);
    return answer();
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
const { BALLS, DRAG_FASTER, GROW, LIFT_MS, PUSH, START, rollSpeed, stackBottoms, stackSpot } =
  await import('../src/yard/snowman-rules.js');
const { setupSnowTrail } = await import('../src/yard/snow-trail.js');
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
  let clock = 1000;
  ctx.mock.method(performance, 'now', () => clock);
  ctx.mock.method(Math, 'random', () => 0);
  const pets = ['a', 'b', 'c'].map((id, i) => ({ id, name: id, size: 100, x: 0.3 + i * 0.2, y: 0.6 }));
  let trail = null;
  // Before the yard's own cleanup, while the fake document is still there.
  ctx.after(() => {
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
