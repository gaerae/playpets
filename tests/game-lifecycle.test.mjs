import assert from 'node:assert/strict';
import test from 'node:test';
import { reduced } from '../src/core/sprites.js';
import { game, setData, setGame, setSelected, views } from '../src/core/state.js';
import { PARADE_MS, TAG_FREEZE_AGAIN_MS, TAG_FREEZE_MS, TAG_MS } from '../src/yard/games.js';
import { endGame, gameTap, judge, playGame, setupPlay } from '../src/yard/play.js';
import { installDom, installStorage } from './support/dom.mjs';

// Only the DOM surface games draw into is simulated; their trips, rules and timers stay real.
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

function hideAll() {
  playGame(performance.now() + 15000, 120);
  for (const v of views.values()) assert.ok(v.button.classList.contains('hiding'));
}

test('a game is a tile on Play: pressing it starts the game, pressing it again ends it', t => {
  const { nodes, start } = yard(t);
  const tile = nodes.get('games-menu').children.find(row => row.dataset.game === 'tag');
  assert.equal(tile.className, 'play-action game');
  start('tag');
  assert.equal(game?.kind, 'tag');
  start('tag');
  assert.equal(game, null, 'the tile of the game on ends it');
});

test('hide feedback from a cancelled round cannot clear a later discovery', t => {
  const { start, advance } = yard(t);
  start('hide');
  hideAll();
  gameTap(views.get('a'));
  advance(500);
  endGame();
  start('hide');
  hideAll();
  gameTap(views.get('a'));
  advance(400);
  assert.ok(views.get('a').button.classList.contains('found'), 'the second discovery keeps its full feedback duration');
  advance(500);
  assert.equal(views.get('a').button.classList.contains('found'), false);
});

test('two quick wrong guesses shake the friend twice and leave who is hiding on the banner', t => {
  const { nodes, start, advance } = yard(t);
  start('hide');
  hideAll();
  const sub = nodes.get('banner-sub');
  const hiding = sub.textContent;
  assert.ok(hiding);
  const wrong = [...views.values()].find(v => v.pet.id !== game.target);
  gameTap(wrong);
  advance(300);
  gameTap(wrong);
  advance(300);
  assert.ok(wrong.button.classList.contains('missed'), 'the second miss shakes it again');
  assert.equal(sub.textContent, hiding);
  advance(3000);
  assert.equal(wrong.button.classList.contains('missed'), false);
  assert.equal(sub.textContent, hiding);
});

test('a cancelled tag catch does not carry immunity into a replay', t => {
  const { start } = yard(t);
  start('tag');
  judge(100);
  assert.equal(game.it, 'b');
  assert.equal(views.get('b').frozen, true);
  endGame();
  setSelected('b');
  start('tag');
  judge(200);
  assert.equal(game.it, 'a', 'a touching runner can be caught immediately in the new round');
});

test('a completed hide round returns everyone home and removes game presentation', t => {
  const { start, advance, nodes } = yard(t);
  start('hide');
  hideAll();
  gameTap(views.get('a'));
  gameTap(views.get('b'));
  assert.equal(game.hidden.size, 0);
  advance(1600);
  assert.equal(game, null);
  assert.equal(nodes.get('game-banner').hidden, true);
  // Its players cheer where they stand first (game-rewards.test.mjs), then walk home.
  advance(1200);
  for (const v of views.values()) {
    assert.equal(v.button.classList.contains('hiding'), false);
    assert.equal(v.button.classList.contains('found'), false);
    assert.deepEqual(v.target, { x: v.pet.x, y: v.pet.y });
    assert.equal(v.trip.save, false);
    v.trip.arrive();
    assert.equal(v.away, false);
  }
});

test('tag and parade finish and can be replayed without a lingering tagger', t => {
  const { start } = yard(t);
  start('tag');
  playGame(TAG_MS, 100);
  assert.equal(game, null);
  for (const v of views.values()) assert.equal(v.button.classList.contains('tagger'), false);
  start('parade');
  for (const v of views.values()) v.target = null;
  playGame(0, PARADE_MS[1]);
  assert.equal(game, null);
  start('tag');
  assert.equal(game.kind, 'tag');
});

// Tag was only watched; the person's one move is to press whoever is it, which holds it still a
// moment so the others get away, and only now and then, so the chase still happens.
test('pressing the friend who is it holds it still for a moment, and not again at once', t => {
  const { start, advance } = yard(t);
  start('tag');
  const it = views.get('a'),
    runner = views.get('b');
  gameTap(runner);
  assert.ok(!runner.frozen, 'a runner pressed is not held');
  assert.ok(runner.button.classList.contains('missed'), 'it shakes its head: press whoever is it');
  gameTap(it);
  assert.equal(it.frozen, true, 'whoever is it stands still');
  judge(performance.now() + 100);
  assert.equal(game.it, 'a', 'and catches nobody while it stands');
  advance(TAG_FREEZE_MS);
  playGame(performance.now(), 16);
  assert.equal(it.frozen, false, 'then it runs again');
  gameTap(it);
  assert.equal(it.frozen, false, 'pressed again too soon, it keeps running');
  advance(TAG_FREEZE_AGAIN_MS - TAG_FREEZE_MS);
  gameTap(it);
  assert.equal(it.frozen, true, 'later it can be held again');
});

test('tag transfer pauses the new tagger and protects the previous tagger', t => {
  const { start } = yard(t);
  start('tag');
  judge(100);
  assert.equal(game.it, 'b');
  judge(500);
  assert.equal(game.it, 'b', 'the new tagger cannot catch during its feedback pause');
  playGame(1000, 16);
  assert.equal(views.get('b').frozen, false);
  judge(1000);
  assert.equal(game.it, 'b', 'the previous tagger stays safe after the feedback pause');
  judge(1600);
  assert.equal(game.it, 'a', 'immunity ends after its full duration');
});

test('parade waits for formation and retains its lap under reduced motion', t => {
  const { start } = yard(t);
  reduced.matches = true;
  start('parade');
  playGame(1000, 1000);
  assert.equal(game.walking, false);
  assert.equal(game.progress, 0);
  for (const v of views.values()) v.target = null;
  playGame(2000, 1000);
  assert.equal(game.walking, true);
  const lap = game.lap.ms;
  assert.ok(lap >= PARADE_MS[0] && lap <= PARADE_MS[1], 'the lap takes as long as its length at a stroll');
  assert.equal(game.progress, 1000 / lap);
  playGame(3000 + lap, lap - 1000);
  assert.equal(game, null);
});
