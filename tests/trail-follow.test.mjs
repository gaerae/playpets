// A friend follows a winter trail (src/yard/trails.js followTrail): it sniffs along the prints, the
// tail peeks from the bush and whisks away (a bird flutters off), the follow is recorded, then the
// friend digs at the end with a trail context.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import './support/content.mjs';
import { element, installDom, installStorage } from './support/dom.mjs';

const followed = [];
globalThis.playPets = {
  followTracks: async id => {
    followed.push(id);
    return { ok: true, data: { entry: { count: 1 }, first: true } };
  },
};
const { t: say } = await import('../src/core/i18n.js');
const { reduced } = await import('../src/core/sprites.js');
const { recall, remember, setAiming, setData, setGame, setSelected, views } = await import('../src/core/state.js');
const { TRACKS, trackKind } = await import('../src/yard/catalog.js');
const { footTarget, measureYard } = await import('../src/yard/field.js');
const { BLOCK_MS, trailAnimal } = await import('../src/yard/trail-rules.js');
const { atTrailEnd, followTrail, resizeTrails, setupTrails, trailsCheck, trailsSeen } =
  await import('../src/yard/trails.js');
const { release } = await import('../src/yard/trips.js');
const { scene } = await import('../src/yard/world.js');
const { useWorlds } = await import('../src/yard/worlds.js');

const ids = TRACKS.map(k => k.id);
const at = (d, h, min = 0) => new Date(2026, 11, d, h, min).getTime();
const OPEN = {
  soil: true,
  bounds: { left: 0, right: 1, top: 0, bottom: 1 },
  water: [{ x: 0.5, y: 0.5, rx: 0.15, ry: 0.1 }],
  obstacles: [],
};
// The first December day whose first trail is a bird's, and one whose is not.
const dayOf = bird =>
  Array.from({ length: 31 }, (_, i) => i + 1).find(
    d => trackKind(trailAnimal(`2026-12-${String(d).padStart(2, '0')}`, 0, ids)).bird === bird,
  );

function yard(t, { day = 14, rested = () => true } = {}) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: at(day, 9) });
  const dom = installDom(t, { anyId: true });
  installStorage(t);
  dom.document.getElementById('yard').getBoundingClientRect = () => ({ width: 1000, height: 700, left: 0, top: 0 });
  measureYard();
  useWorlds([{ id: 'woodland', capabilities: { soil: true, sky: true, fishing: false }, geometry: { fieldTop: 0.6 } }]);
  scene.season = 'winter';
  scene.world = 'woodland';
  const pet = { id: 'friend', size: 112, name: 'Clover' };
  const v = {
    target: null,
    pet,
    px: 200,
    py: 400,
    x: 0.2,
    y: 0.5,
    pose: 'idle',
    bubble: element('span'),
    button: element('button'),
  };
  views.clear();
  views.set(pet.id, v);
  setData({ pets: [pet], garden: { digs: [] }, album: {}, statuses: {}, busy: [] });
  setSelected(pet.id);
  followed.length = 0;
  const digs = [],
    cards = [],
    look = { weather: () => 'clear', visible: true, width: 600 };
  setupTrails({
    profile: () => OPEN,
    weather: ms => look.weather(ms),
    toYard: p => ({ x: p.x * look.width, y: p.y * 400 }),
    zoom: () => 1,
    dig: (...args) => digs.push(args),
    rested,
    card: (...args) => cards.push(args),
    visible: () => look.visible,
  });
  t.after(() => {
    release(v);
    views.clear();
    setAiming(false);
    setGame(null);
    reduced.matches = false;
    scene.season = 'spring';
  });
  const layer = dom.document.getElementById('garden-layer');
  const live = selector => layer.querySelectorAll(selector).filter(n => !n.removed);
  return { ...dom, layer, live, v, digs, cards, look, saved: () => JSON.parse(recall('trails')) };
}

// As the frame loop does: the friend is where it was headed, its trip let go, then told.
function arrive(v) {
  const trip = v.trip;
  v.x = v.target.x;
  v.y = v.target.y;
  v.target = null;
  v.trip = null;
  trip?.arrive?.(v, performance.now());
}
// Walks a friend to the end of its trips; returns how many there were, and the last target.
function walk(v) {
  let legs = 0,
    last = null;
  while (v.target && legs < 50) {
    last = v.target;
    arrive(v);
    legs++;
  }
  walk.last = last;
  return legs;
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const pointsOf = trail =>
  trail
    .querySelector('.trail-hit')
    .getAttribute('points')
    .split(' ')
    .map(p => p.split(',').map(Number));
const endOf = end => ({ x: parseFloat(end.style.left) / 600, y: parseFloat(end.style.top) / 400 });

for (const bird of [false, true])
  test(`following walks the prints, shows the tail, records it and digs there (${bird ? 'a bird' : 'four legs'})`, async t => {
    const y = yard(t, { day: dayOf(bird) });
    trailsCheck();
    const [trail] = y.live('.trail'),
      end = y.live('.trail-end')[0],
      animal = trail.dataset.animal,
      points = pointsOf(trail);
    assert.equal(trackKind(animal).bird, bird);
    followTrail(0);
    assert.ok(y.v.button.classList.contains('sniffing'));
    assert.ok(trail.classList.contains('following'));
    assert.equal(y.v.bubble.hidden, false);
    const first = footTarget(y.v, points[0][0], points[0][1]);
    assert.ok(Math.abs(y.v.target.x - first.x) < 1e-3 && Math.abs(y.v.target.y - first.y) < 1e-3);
    assert.equal(y.v.trip.save, false);
    // To the first print, then point to point; prints between the bush and where the friend stops
    // beside it are not walked back over.
    const legs = walk(y.v);
    assert.ok(legs >= 2 && legs <= points.length, `${legs} legs for ${points.length} points`);
    // It stops beside the bush on the side the tail shows, clear of it.
    const bush = footTarget(y.v, parseFloat(end.style.left), parseFloat(end.style.top)),
      tailLeft = !/tail-peek[^"]*mirror/.test(end.innerHTML);
    assert.equal(walk.last.x < bush.x, tailLeft);
    assert.ok(Math.abs(walk.last.y - bush.y) < 1e-6);
    assert.ok(!y.v.button.classList.contains('sniffing'));
    assert.ok(end.classList.contains('peek'));
    assert.deepEqual(followed, [animal]);
    // Kept once the backend has it.
    await flush();
    assert.deepEqual(y.saved().followed, [0]);
    assert.equal(y.cards.length, 1);
    assert.equal(y.cards[0][1], say(`track.${animal}`));
    assert.equal(y.cards[0][3], true);
    assert.equal(y.cards[0][4], 'track');
    assert.equal(y.v.bubble.textContent, say('trail.seen', { animal: say(`track.${animal}`) }));
    t.mock.timers.tick(1000);
    assert.ok(end.classList.contains(bird ? 'flutter' : 'whisk'));
    assert.equal(end.querySelectorAll('.puff').filter(n => !n.removed).length, bird ? 0 : 1);
    assert.equal(y.digs.length, 0);
    t.mock.timers.tick(400);
    assert.equal(y.digs.length, 1);
    const [who, point] = y.digs[0];
    assert.equal(who, y.v);
    const spot = endOf(end);
    assert.ok(Math.abs(point.x - spot.x) < 0.001 && Math.abs(point.y - spot.y) < 0.001);
    assert.equal(atTrailEnd(point, Date.now() + 60000), null, 'only for a minute');
    assert.equal(atTrailEnd(point), animal, 'the dig at the end takes it');
    assert.equal(atTrailEnd(point), null, 'once');
    assert.ok(trail.classList.contains('followed'));
    assert.ok(!trail.classList.contains('following'));
    assert.equal(y.live('.trail-follow').length, 0);
    t.mock.timers.tick(600);
    assert.equal(end.querySelectorAll('.puff').filter(n => !n.removed).length, 0);
  });

test('a later follow of the same animal shows only the friend line', async t => {
  globalThis.playPets.followTracks = async id => {
    followed.push(id);
    return { ok: true, data: { entry: { count: 2 }, first: false } };
  };
  t.after(() => {
    globalThis.playPets.followTracks = async id => {
      followed.push(id);
      return { ok: true, data: { entry: { count: 1 }, first: true } };
    };
  });
  const y = yard(t);
  trailsCheck();
  followTrail(0);
  walk(y.v);
  await flush();
  assert.equal(y.cards.length, 0);
  assert.equal(followed.length, 1);
});

test('taking the friend away mid-trail leaves the trail to follow again', t => {
  const y = yard(t);
  trailsCheck();
  followTrail(0);
  arrive(y.v);
  release(y.v);
  assert.equal(y.live('.following').length, 0);
  assert.ok(!y.v.button.classList.contains('sniffing'));
  assert.equal(followed.length, 0);
  assert.deepEqual(y.saved().followed, []);
  followTrail(0);
  assert.ok(y.v.target, 'sent again');
});

test('taking the friend away once the tail has shown keeps the record and loses only the find', async t => {
  const y = yard(t);
  trailsCheck();
  followTrail(0);
  walk(y.v);
  release(y.v);
  await flush();
  assert.equal(followed.length, 1);
  assert.deepEqual(y.saved().followed, [0]);
  t.mock.timers.tick(1000);
  t.mock.timers.tick(400);
  assert.equal(y.digs.length, 0);
  assert.ok(y.live('.trail')[0].classList.contains('followed'));
  followTrail(0);
  assert.ok(!y.v.target, 'a followed trail is not followed again');
});

test('the season leaving winter calls the follow off', t => {
  const y = yard(t);
  trailsCheck();
  followTrail(0);
  arrive(y.v);
  scene.season = 'summer';
  trailsCheck();
  assert.ok(!y.v.target);
  assert.ok(!y.v.button.classList.contains('sniffing'));
  assert.equal(followed.length, 0);
});

// Three blocks of snow from 10:20: the trail laid at 09:00 is covered by 11:00.
const snowFrom = Math.floor(at(14, 10, 20) / BLOCK_MS) * BLOCK_MS;
const snowfall = ms => (ms >= snowFrom && ms < snowFrom + 3 * BLOCK_MS ? 'snow' : 'clear');

test('new snow over the trail mid-walk calls the follow off, and a covered trail is not followed', t => {
  const y = yard(t);
  trailsCheck();
  followTrail(0);
  arrive(y.v);
  y.look.weather = snowfall;
  t.mock.timers.setTime(at(14, 11));
  trailsCheck();
  const [trail] = y.live('.trail');
  assert.ok(trail.classList.contains('covered'));
  assert.ok(!y.v.target);
  assert.ok(!trail.classList.contains('following'));
  assert.ok(!y.v.button.classList.contains('sniffing'));
  assert.equal(followed.length, 0);
  assert.deepEqual(y.saved().followed, []);
  followTrail(0);
  assert.ok(!y.v.target, 'a covered trail is not followed');
});

test('new snow after the tail has shown lets the follow finish', async t => {
  const y = yard(t);
  trailsCheck();
  followTrail(0);
  walk(y.v);
  await flush();
  y.look.weather = snowfall;
  t.mock.timers.setTime(at(14, 11));
  trailsCheck();
  t.mock.timers.tick(1000);
  t.mock.timers.tick(400);
  assert.equal(followed.length, 1);
  assert.equal(y.digs.length, 1);
});

test('the window hidden before the tail shows calls the follow off; after, the record stands', async t => {
  const y = yard(t);
  trailsCheck();
  followTrail(0);
  arrive(y.v);
  y.look.visible = false;
  await y.document.dispatch('visibilitychange');
  assert.ok(!y.v.target);
  assert.equal(y.live('.following').length, 0);
  assert.ok(!y.v.button.classList.contains('sniffing'));
  y.look.visible = true;
  followTrail(0);
  assert.ok(y.v.target, 'followable again');
  walk(y.v);
  y.look.visible = false;
  trailsSeen();
  await flush();
  assert.equal(followed.length, 1);
  assert.deepEqual(y.saved().followed, [0]);
});

test('a resize mid-follow lets it go on and lays the trail out again afterwards', async t => {
  const y = yard(t);
  trailsCheck();
  followTrail(0);
  arrive(y.v);
  const [before] = y.live('.trail');
  y.look.width = 800;
  resizeTrails();
  assert.ok(y.v.target, 'still on its way');
  assert.equal(y.live('.trail')[0], before, 'the drawing waits');
  walk(y.v);
  await flush();
  t.mock.timers.tick(1000);
  t.mock.timers.tick(400);
  assert.equal(followed.length, 1);
  assert.equal(y.digs.length, 1);
  await flush();
  const [after] = y.live('.trail');
  assert.notEqual(after, before, 'laid out on the new size once the follow is over');
  assert.ok(after.classList.contains('followed'));
});

test('a failed record keeps the trail to follow again and shows no card', async t => {
  globalThis.playPets.followTracks = async () => ({ ok: false, error: 'No room' });
  t.after(() => {
    globalThis.playPets.followTracks = async id => {
      followed.push(id);
      return { ok: true, data: { entry: { count: 1 }, first: true } };
    };
  });
  const y = yard(t);
  trailsCheck();
  followTrail(0);
  walk(y.v);
  await flush();
  assert.equal(y.cards.length, 0);
  assert.deepEqual(y.saved().followed, []);
  assert.equal(y.document.getElementById('toast').textContent, 'No room');
  t.mock.timers.tick(1000);
  t.mock.timers.tick(400);
  assert.equal(y.digs.length, 1, 'the find is the dig’s own');
  const [trail] = y.live('.trail');
  assert.ok(!trail.classList.contains('followed'));
  assert.ok(trail.querySelector('.trail-hit'));
  release(y.v);
  followTrail(0);
  assert.ok(y.v.target, 'followable again');
});

test('the walk keeps to the friends’ own stroll', async () => {
  const motion = await readFile('src/yard/motion.js', 'utf8'),
    trails = await readFile('src/yard/trails.js', 'utf8');
  assert.match(motion, /export const STROLL/);
  assert.match(trails, /import \{[^}]*\bSTROLL\b[^}]*\} from '\.\/motion\.js'/);
  assert.doesNotMatch(trails, /0\.00022/);
});

test('a followed trail stays followed after a reload', t => {
  const y = yard(t);
  remember('trails', JSON.stringify({ day: '2026-12-14', seen: at(14, 9), followed: [0] }));
  trailsCheck();
  const [trail] = y.live('.trail');
  assert.ok(trail.classList.contains('followed'));
  assert.equal(trail.querySelector('.trail-hit'), null);
  assert.equal(y.live('.trail-follow').length, 0);
  followTrail(0);
  assert.ok(!y.v.target);
});

test('on reduced motion the friend goes straight to the end and the tail only fades', async t => {
  const y = yard(t, { day: dayOf(false) });
  reduced.matches = true;
  trailsCheck();
  const end = y.live('.trail-end')[0];
  followTrail(0);
  assert.ok(!y.v.button.classList.contains('sniffing'));
  assert.equal(walk(y.v), 1);
  assert.ok(end.classList.contains('peek-still'));
  assert.ok(!end.classList.contains('peek'));
  await flush();
  t.mock.timers.tick(1000);
  assert.ok(end.classList.contains('fade'));
  assert.ok(!end.classList.contains('whisk'));
  assert.equal(end.querySelectorAll('.puff').length, 0);
  t.mock.timers.tick(400);
  assert.equal(followed.length, 1);
  assert.equal(y.digs.length, 1);
});

test('no free friend, a game or a tool in hand: nothing is sent', t => {
  const y = yard(t);
  trailsCheck();
  y.v.target = { x: 0.5, y: 0.5 };
  followTrail(0);
  assert.equal(y.document.getElementById('toast').textContent, say('catch.busy'));
  y.v.target = null;
  setAiming('dig');
  followTrail(0);
  assert.ok(!y.v.target);
  setAiming(false);
  setGame({ kind: 'tag' });
  followTrail(0);
  assert.ok(!y.v.target);
  setGame(null);
  assert.equal(followed.length, 0);
  assert.equal(y.live('.following').length, 0);
});

test('a friend that dug a moment ago sits out and the nearest rested one goes', t => {
  const y = yard(t, { rested: v => v.pet.id !== 'friend' });
  const other = {
    ...y.v,
    pet: { id: 'pip', size: 112, name: 'Pip' },
    button: element('button'),
    bubble: element('span'),
  };
  views.set('pip', other);
  t.after(() => release(other));
  trailsCheck();
  followTrail(0);
  assert.ok(!y.v.target);
  assert.ok(other.target);
});

test('with a tool in hand, a game, or a creature to catch, a click on the prints goes to the yard', async t => {
  const y = yard(t);
  trailsCheck();
  const hit = y.live('.trail')[0].querySelector('.trail-hit');
  let stopped = 0;
  const click = target => y.layer.dispatch('click', { target, stopPropagation: () => stopped++ });
  setAiming('dig');
  await click(hit);
  setAiming(false);
  setGame({ kind: 'tag' });
  await click(y.live('.trail-follow')[0]);
  setGame(null);
  y.document.getElementById('yard').classList.add('can-catch');
  await click(hit);
  y.document.getElementById('yard').classList.remove('can-catch');
  assert.equal(stopped, 0);
  assert.ok(!y.v.target);
  await click(hit);
  assert.equal(stopped, 1);
  assert.ok(y.v.target, 'a plain click follows');
  const css = await readFile('src/styles/garden.css', 'utf8');
  for (const state of ['aiming', 'playing'])
    for (const node of ['trail-hit', 'trail-follow'])
      assert.ok(
        new RegExp(`\\.yard\\.${state} \\.${node}[^{]*\\{[^}]*pointer-events: none`).test(css),
        `.yard.${state} .${node} lets clicks through`,
      );
});

test('every tail animation ends', async () => {
  const css = await readFile('src/styles/garden.css', 'utf8');
  for (const name of ['tail-peek', 'tail-whisk', 'tail-flutter', 'trail-puff']) {
    const rule = css.match(new RegExp(`animation: ${name} [^;]*;`))?.[0];
    assert.ok(rule, name);
    assert.doesNotMatch(rule, /infinite/);
  }
});
