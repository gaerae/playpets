import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom, installStorage } from './support/dom.mjs';

// A game played to its end counts toward closeness (bond.rs `play`); one stopped half way does not.
const together = [];
globalThis.playPets = {
  befriendMany: async (...args) => {
    together.push(args.slice(0, 2));
    return { ok: true, data: {} };
  },
};
const { reduced } = await import('../src/core/sprites.js');
const state = await import('../src/core/state.js');
const { setData, setGame, setSelected, views } = state;
const { TAG_MS } = await import('../src/yard/games.js');
const { endGame, gameTap, playGame, setupPlay } = await import('../src/yard/play.js');

function yard(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 0;
  t.mock.method(performance, 'now', () => now);
  t.mock.method(Math, 'random', () => 0);
  installStorage(t);
  const { nodes, element } = installDom(t, { anyId: true, props: { rect: { width: 1000, height: 600 } } });
  setGame(null);
  views.clear();
  reduced.matches = false;
  together.length = 0;
  const pets = ['a', 'b'].map(id => ({ id, name: id, size: 100, x: 0.3, y: 0.5 }));
  setData({ pets, assets: [], providers: [], statuses: {}, busy: [] });
  setSelected('a');
  for (const pet of pets)
    views.set(pet.id, {
      pet,
      button: element(),
      label: element(),
      tagName: element(),
      bubble: element(),
      x: pet.x,
      y: pet.y,
      px: 100,
      py: 100,
      until: 0,
      frozenUntil: 0,
    });
  setupPlay();
  const start = kind =>
    nodes
      .get('games-menu')
      .children.find(row => row.dataset.game === kind)
      .onclick();
  const advance = ms => {
    now += ms;
    t.mock.timers.tick(ms);
  };
  t.after(() => {
    setGame(null);
    views.clear();
    reduced.matches = false;
  });
  return { nodes, start, advance };
}
const hideAll = () => playGame(performance.now() + 15000, 120);
const marks = (nodes, kind) =>
  nodes.get('yard').children.filter(n => n.className === 'particle' && n.dataset.kind === kind);

test('a game played to its end counts for every player, and they cheer before they walk home', async t => {
  const { nodes, start, advance } = yard(t);
  start('hide');
  hideAll();
  gameTap(views.get('a'));
  gameTap(views.get('b'));
  advance(1600);
  assert.equal(state.game, null);
  await Promise.resolve();
  assert.deepEqual(together, [[['a', 'b'], 'play']]);
  for (const v of views.values()) {
    assert.equal(v.pose, 'jump', 'each player jumps where it stands');
    assert.equal(v.target, null, 'and stays there for the beat');
  }
  assert.ok(marks(nodes, 'heart').length >= 2, 'hearts over the players');
  // The game's sentence is read aloud; on screen the beat says it.
  assert.equal(document.getElementById('toast').children.length, 0);
  assert.ok(nodes.get('friend-speech').textContent);
  advance(1500);
  for (const v of views.values()) assert.deepEqual(v.target, { x: v.pet.x, y: v.pet.y }, 'then home');
});

test('tag run out also counts; a game stopped half way counts for nobody', async t => {
  const { start } = yard(t);
  start('tag');
  endGame();
  await Promise.resolve();
  assert.deepEqual(together, [], 'stopped');
  for (const v of views.values()) assert.notEqual(v.pose, 'jump');
  start('tag');
  playGame(TAG_MS, 100);
  await Promise.resolve();
  assert.deepEqual(together, [[['a', 'b'], 'play']]);
});

test('a new game during the beat keeps its players: the old walk home does not take them', t => {
  const { start, advance } = yard(t);
  start('tag');
  playGame(TAG_MS, 100);
  start('parade');
  const targets = [...views.values()].map(v => v.target);
  advance(1500);
  assert.equal(state.game?.kind, 'parade');
  assert.deepEqual(
    [...views.values()].map(v => v.target),
    targets,
  );
});

// A game started and stopped during the beat sends every player home; the old beat's timer then
// took a friend walking home for one taken by something else and said it was no longer away.
test('a game stopped during the beat sends its players home, and the old beat leaves them on their way', t => {
  const { start, advance } = yard(t);
  start('tag');
  playGame(TAG_MS, 100);
  start('parade');
  endGame();
  for (const v of views.values()) assert.ok(v.away && v.target, 'walking home');
  advance(1500);
  for (const v of views.values()) assert.equal(v.away, true, 'still away until home');
});

// The beat is the players' doing: something that takes a friend during it (a press, a treat) ends
// it, and the friend is free where it is rather than walked home.
test('a friend taken during the beat is free and stays where it was taken to', async t => {
  const { start, advance } = yard(t);
  const { release } = await import('../src/yard/trips.js');
  start('tag');
  playGame(TAG_MS, 100);
  const a = views.get('a');
  release(a);
  assert.equal(a.away, false, 'no longer away');
  advance(1500);
  assert.equal(a.target, null, 'not walked home');
  assert.deepEqual(views.get('b').target, { x: 0.3, y: 0.5 }, 'the other goes home');
});

test('a wrong guess shakes the friend pressed with a ?, and the banner keeps who is still out', t => {
  const { nodes, start, advance } = yard(t);
  start('hide');
  hideAll();
  const sub = nodes.get('banner-sub').textContent;
  const wrong = [...views.values()].find(v => v.pet.id !== state.game.target);
  gameTap(wrong);
  assert.equal(nodes.get('banner-sub').textContent, sub, 'the banner is not rewritten');
  assert.ok(wrong.button.classList.contains('missed'));
  assert.deepEqual(
    nodes
      .get('yard')
      .children.filter(n => n.dataset?.kind === 'question')
      .map(n => n.textContent),
    [''],
  );
  assert.ok(nodes.get('friend-speech').textContent, 'a screen reader still hears it');
  advance(1000);
  assert.equal(wrong.button.classList.contains('missed'), false);
  assert.ok(wrong.button.classList.contains('hiding'), 'and it stays hidden');
});
