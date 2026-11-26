// Games: one at a time. Positions during a game are never saved; friends walk home when it ends.
// The rules (where to hide, who to chase) live in games.js; each game here is one object in
// RULES saying what happens when it starts, each frame, when a friend arrives or is pressed, and
// when it ends. Adding a game is one such object, a button with data-game in index.html and its
// strings; this file moves the friends and keeps the toolbar in step.

import { put, replay } from '../core/dom.js';
import { joinList, t } from '../core/i18n.js';
import { icons } from '../core/icons.js';
import { shuffle } from '../core/math.js';
import { reduced } from '../core/sprites.js';
import { $, aiming, data, game, name, selected, setGame, toast, views } from '../core/state.js';
import { befriendAll } from './bond.js';
import { setAimingMode } from './care.js';
import { syncFishingAction } from './catch.js';
import { bodiesApart, petHeight, sizeOf } from './field.js';
import {
  chaseTarget,
  fleeTarget,
  GAME_PACE,
  GAMES,
  hidingSpots,
  paradeDone,
  paradeLap,
  paradePlan,
  paradePositions,
  pickTarget,
  seek,
  TAG_FREEZE_AGAIN_MS,
  TAG_FREEZE_MS,
  TAG_MS,
  touching,
} from './games.js';
import { hint } from './hint.js';
import { STROLL } from './motion.js';
import { snowmanGame } from './snowman.js';
import { cue } from './sound.js';
import { release, rest, sendTo, setDoing } from './trips.js';
import { friendAt } from './veil.js';
import { syncViewingAction } from './viewing.js';
import { bubble, effect, labelTag, place, pose } from './views.js';

const party = () => game.ids.map(id => views.get(id)).filter(Boolean);
const HIDE_WAIT_MS = 15000;
const send = (v, target, speed) => sendTo(v, target, { save: false, speed, arrive: arrived });
const called = id => name(views.get(id).pet);
let gameButtons = [];
// A round owns its delayed moves and feedback, so cancelling it also cancels its callbacks. The
// snowman game gets it through setupSnowman (app.js), as it cannot import this file.
export function after(ms, fn) {
  const round = game;
  const timer = setTimeout(() => {
    round.timers.delete(timer);
    if (game === round) fn();
  }, ms);
  round.timers.add(timer);
}
export function syncGameUi() {
  syncFishingAction();
  syncViewingAction();
  for (const b of gameButtons) {
    const mine = game?.kind === b.dataset.game;
    put(
      b.querySelector('.game-name'),
      'textContent',
      mine ? t('game.stop', { name: GAMES[b.dataset.game] }) : GAMES[b.dataset.game],
    );
    b.classList.toggle('playing', mine);
    // A game only some yards have (the snowman, while the yard shows winter) leaves the menu elsewhere.
    put(b, 'hidden', RULES[b.dataset.game].shown?.() === false);
    put(b, 'disabled', !data.pets.length || (!!game && !mine));
  }
  put($('feed'), 'disabled', !data.pets.length || !!game);
  hint();
}
function say(text) {
  game.hint = text;
  hint();
}
// What a game says without words on screen (a miss, how it ended) is still read aloud, in the
// yard's spoken line (index.html #friend-speech).
function announce(text) {
  const said = $('friend-speech');
  if (said) said.textContent = text;
}
// The game's line in the lane above the dock says what a game is asking for; without a title it goes away.
function banner(label, title, sub = '') {
  $('game-banner').hidden = !title;
  $('banner-label').textContent = label;
  $('banner-title').textContent = title || '';
  $('banner-sub').textContent = sub;
  $('banner-sub').hidden = !sub;
}

// Hide and seek goes by name: the game asks for one hidden friend and lists who else is still out there.
function ask(note = '') {
  game.target = pickTarget(game.hidden, Math.random);
  say(t('hide.left', { count: game.hidden.size }));
  tell(note);
}
function tell(note = '') {
  const others = [...game.hidden].filter(id => id !== game.target).map(called),
    where = others.length ? t('hide.still_hidden', { names: joinList(others) }) : t('hide.last');
  banner(t('hide.find_label'), called(game.target), joinList([note, where].filter(Boolean)));
}
// A wrong guess: the friend pressed shakes its head with a ?, stays hidden, and the same name is
// still asked for (play.css .missed).
const MISS_MS = 450;
function miss(v) {
  replay(v.button, 'missed', MISS_MS);
  effect(v, 'question');
  announce(t('hide.miss'));
}
const hide = {
  icon: 'eye',
  start(now) {
    game.hidden = new Set(game.ids);
    const spots = shuffle(hidingSpots(game.ids.length, Math.random));
    party().forEach((v, i) => {
      send(v, spots[i], GAME_PACE.dash);
    });
    // The name to find is up from the first moment; a friend can be pressed once it has hidden.
    game.hideBy = now + HIDE_WAIT_MS;
    ask(t('hide.hiding'));
    say(t('hide.hiding'));
  },
  // A friend that cannot reach its spot (a blocked walk, a window drawn late) hides where it stands.
  frame(now) {
    if (!game.hideBy || now < game.hideBy) return;
    game.hideBy = 0;
    for (const v of party())
      if (game.hidden.has(v.pet.id) && !v.button.classList.contains('hiding')) {
        release(v);
        hide.arrived(v);
      }
  },
  arrived(v) {
    if (!game.hidden.has(v.pet.id)) return;
    v.button.classList.add('hiding');
    friendAt(v);
    if (!party().some(o => game.hidden.has(o.pet.id) && o.target)) {
      say(t('hide.left', { count: game.hidden.size }));
      tell();
    }
  },
  // A press is a guess at who was asked for.
  tap(v) {
    const id = v.pet.id;
    if (!game.target || !v.button.classList.contains('hiding')) return;
    const result = seek(game.hidden, game.target, id);
    if (result === 'wrong') return miss(v);
    if (result !== 'found') return;
    game.hidden.delete(id);
    v.button.classList.remove('hiding');
    v.button.classList.add('found');
    friendAt(v);
    after(900, () => v.button.classList.remove('found'));
    pose(v, 'jump', 1200);
    effect(v, 'notice');
    bubble(v, t('hide.found_bubble'), 2500);
    after(900, () => send(v, { x: v.x, y: 0.35 + Math.random() * 0.55 }, GAME_PACE.run));
    if (game.hidden.size) ask(t('hide.found', { name: called(id) }));
    else {
      game.target = null;
      say(t('hide.all_found'));
      banner(GAMES.hide, t('hide.all_found'));
      after(1600, () => endGame(t('hide.all_found_toast')));
    }
  },
};

const parade = {
  icon: 'paw',
  start(_now, lead) {
    game.progress = 0;
    game.walking = false;
    // The lap measured on the field as it is drawn, in the biggest friend's body lengths, so no two
    // friends walk into each other.
    const big = party().reduce((a, v) => (sizeOf(v.pet) > sizeOf(a.pet) ? v : a)).pet;
    game.lap = paradePlan(
      game.ids.length,
      paradeLap((a, b) => bodiesApart(big, a, b)),
      STROLL,
    );
    const at = paradePositions(game.ids.length, 0, game.lap.gap);
    party().forEach((v, i) => {
      send(v, at[i], GAME_PACE.dash);
    });
    say(t('parade.follow', { name: called(lead) }));
  },
  frame(_now, dt, players) {
    if (!game.walking) {
      if (players.some(v => v.target)) return;
      game.walking = true;
      say(t('parade.walking'));
    }
    game.progress += dt / game.lap.ms;
    const at = paradePositions(game.ids.length, Math.min(1, game.progress), game.lap.gap);
    players.forEach((v, i) => {
      if (!reduced.matches) pose(v, at[i].x >= v.x ? 'right' : 'left', 150);
      v.x = at[i].x;
      v.y = at[i].y;
      place(v, { glide: true });
    });
    if (paradeDone(game.progress)) endGame(t('parade.done'));
  },
  end(over, message) {
    if (message) bubble(views.get(over.ids[0]), t('parade.done_bubble'), 2500);
  },
};

const tagger = (v, on) => {
  v.button.classList.toggle('tagger', on);
  labelTag(v);
};
const tag = {
  icon: 'dash',
  needs: friends => (friends.size < 2 ? 'game.tag_needs_two' : null),
  start(now, lead) {
    game.it = lead;
    game.safe = null;
    game.safeUntil = 0;
    game.until = now + TAG_MS;
    game.nextPlan = 0;
    tagger(views.get(lead), true);
    bubble(views.get(lead), t('tag.im_it'), 2500);
    say(t('tag.it_is', { name: called(lead) }));
  },
  // Before friends move: did the tagger catch someone?
  judge(now) {
    const it = views.get(game.it),
      body = v => ({ cx: v.px + sizeOf(v.pet) / 2, cy: v.py + petHeight(v.pet) / 2, size: sizeOf(v.pet) });
    for (const v of party()) {
      if (
        v === it ||
        (v.pet.id === game.safe && now < game.safeUntil) ||
        now < (it.frozenUntil || 0) ||
        !touching(body(it), body(v))
      )
        continue;
      tagger(it, false);
      bubble(it, t('tag.caught'), 2000);
      pose(it, 'jump', 900);
      game.safe = game.it;
      game.safeUntil = now + 1500;
      game.it = v.pet.id;
      game.nextPlan = 0;
      tagger(v, true);
      release(v);
      v.frozen = true;
      v.frozenUntil = now + 900;
      pose(v, 'jump', 900);
      effect(v, 'notice');
      bubble(v, t('tag.im_it'), 2000);
      say(t('tag.it_is', { name: name(v.pet) }));
      break;
    }
  },
  // A press on whoever is it holds it still a moment, so the others get away; pressed again too
  // soon, or a runner pressed, it only shakes, as a wrong guess in hide and seek does.
  tap(v) {
    const now = performance.now();
    if (v.pet.id !== game.it || now < (game.freezeAgain || 0)) return replay(v.button, 'missed', MISS_MS);
    game.freezeAgain = now + TAG_FREEZE_AGAIN_MS;
    v.frozen = true;
    v.frozenUntil = now + TAG_FREEZE_MS;
    effect(v, 'spark');
    bubble(v, t('tag.held'), TAG_FREEZE_MS);
  },
  frame(now, _dt, players) {
    if (now >= game.until) return endGame(t('tag.done'));
    const it = views.get(game.it);
    if (it.frozen && now >= it.frozenUntil) it.frozen = false;
    if (now < game.nextPlan) return;
    game.nextPlan = now + 350;
    const prey = chaseTarget(
      it,
      players.filter(v => v !== it).map(v => ({ id: v.pet.id, x: v.x, y: v.y })),
      now < game.safeUntil ? game.safe : null,
    );
    if (prey && !it.frozen) send(it, { x: prey.x, y: prey.y }, GAME_PACE.chase);
    for (const v of players)
      if (v !== it && (!v.target || Math.hypot(v.x - it.x, v.y - it.y) < 0.3))
        send(v, fleeTarget(v, it, Math.random), GAME_PACE.run);
  },
};

/** What each game does, by its id in GAMES. Hooks a game does not need are left out. */
const RULES = { hide, parade, tag, snowman: snowmanGame };
const rules = () => RULES[game.kind];

/** Starts a game of `kind` led by the friend `lead` (else the selected friend, or the first). */
export function startGame(kind, lead = null) {
  if (game) endGame();
  if (!views.size || !RULES[kind]) return;
  if (!views.has(lead)) lead = views.has(selected) ? selected : [...views.keys()][0];
  // Why it cannot start now: a notice, or the game's own way of saying so (a friend's line).
  const missing = RULES[kind].needs?.(views);
  if (missing) return RULES[kind].refused ? RULES[kind].refused(missing, lead) : toast(t(missing));
  if (aiming) setAimingMode(false);
  $('treat').hidden = true;
  const now = performance.now();
  setGame({ kind, ids: [lead, ...[...views.keys()].filter(id => id !== lead)], hint: '', timers: new Set() });
  // Whatever a friend was doing (a walk, fishing) ends when a game takes it.
  for (const v of party()) {
    release(v);
    v.away = true;
    v.look = null;
  }
  RULES[kind].start(now, lead);
  $('yard').classList.add('playing');
  syncGameUi();
}
// Home again, or taken on the way (a press, a treat): either way it is no longer away.
function goHome(v) {
  const home = () => (v.away = false);
  sendTo(v, { x: v.pet.x, y: v.pet.y }, { save: false, arrive: home, cancel: home });
}
// A game played to its end: its players jump where they stand with hearts over them and the
// level-up chime (bond.js celebrate), then walk home; the game counts toward closeness (bond.rs
// `play`). The beat is each player's doing, so whatever takes it first (a new game, a press, a
// treat) ends the beat and the walk home with it (trips.js release).
const BEAT_MS = 1200;
function cheer(players) {
  befriendAll(
    players.map(v => v.pet.id),
    'play',
  );
  cue('level');
  for (const v of players) {
    pose(v, 'jump', BEAT_MS);
    effect(v, 'heart');
    let timer = 0;
    const beat = {
      end() {
        clearTimeout(timer);
        v.away = false;
      },
    };
    setDoing(v, beat, false);
    timer = setTimeout(() => {
      if (v.doing !== beat || views.get(v.pet.id) !== v) return;
      v.doing = null;
      goHome(v);
    }, BEAT_MS);
  }
}
/** Ends the game being played. `message` says how a game played to its end went (read aloud; its
 * players cheer on screen); a game stopped half way has none. */
export function endGame(message) {
  if (!game) return;
  const over = game;
  setGame(null);
  for (const timer of over.timers) clearTimeout(timer);
  banner('', '');
  const players = message ? over.ids.map(id => views.get(id)).filter(v => v?.away) : [];
  for (const v of views.values()) {
    v.frozen = false;
    v.frozenUntil = 0;
    v.button.classList.remove('hiding', 'found', 'missed');
    friendAt(v);
    tagger(v, false);
    if (players.includes(v)) {
      release(v);
      v.speed = 0;
    } else if (v.away) goHome(v);
    else v.speed = 0;
    rest(v);
  }
  RULES[over.kind]?.end?.(over, message);
  $('yard').classList.remove('playing');
  syncGameUi();
  if (players.length) cheer(players);
  if (message) announce(message);
}
// A game cannot go on without one of its players.
export function endGameIfSomeoneLeft() {
  if (game?.ids.some(id => !data.pets.some(p => p.id === id))) endGame();
}
// A friend reached where a game sent it.
function arrived(v) {
  if (game) rules().arrived?.(v);
}
// A press on a friend during a game.
export function gameTap(v) {
  if (game) rules().tap?.(v);
}
// Each frame, before friends move.
export function judge(now) {
  if (game) rules().judge?.(now);
}
// Each frame, after friends moved: where does the game send them next? The players are found
// once per frame.
export function playGame(now, dt) {
  rules().frame?.(now, dt, party());
}
// Wires the game buttons. Called once, by app.js.
export function setupPlay() {
  // The menu has one row per game in RULES, with its icon, name and what it is (the tooltip).
  $('games-menu').replaceChildren(
    ...Object.entries(RULES).map(([kind, rules]) => {
      const row = document.createElement('button'),
        mark = document.createElement('span'),
        label = document.createElement('span');
      row.type = 'button';
      row.className = 'play-action game';
      row.dataset.game = kind;
      row.title = t(`game.${kind}_title`);
      mark.dataset.icon = rules.icon;
      label.className = 'game-name';
      label.textContent = GAMES[kind];
      row.append(mark, label);
      return row;
    }),
  );
  icons($('games-menu'));
  gameButtons = [...$('games-menu').querySelectorAll('[data-game]')];
  for (const b of gameButtons)
    b.onclick = () => {
      if (game?.kind === b.dataset.game) endGame();
      else startGame(b.dataset.game);
    };
}
