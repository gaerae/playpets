// Games: one at a time. Positions during a game are never saved; friends walk home when it ends.
// The rules (where to hide, who to chase) live in games.js; each game here is one object in
// RULES saying what happens when it starts, each frame, when a friend arrives or is pressed, and
// when it ends. Adding a game is one such object, a button with data-game in index.html and its
// strings; this file moves the friends and keeps the toolbar in step.

import { joinList, t } from '../core/i18n.js';
import { shuffle } from '../core/math.js';
import { reduced } from '../core/sprites.js';
import { $, aiming, data, game, name, selected, setGame, toast, views } from '../core/state.js';
import { setAimingMode } from './care.js';
import {
  chaseTarget,
  fleeTarget,
  GAMES,
  hidingSpots,
  PARADE_MS,
  paradeDone,
  paradePositions,
  pickTarget,
  seek,
  TAG_MS,
  touching,
} from './games.js';
import { paintScene } from './sky.js';
import { bubble, effect, hint, labelTag, petHeight, place, pose, rest, sizeOf } from './views.js';

const party = () => game.ids.map(id => views.get(id)).filter(Boolean);
const HIDE_WAIT_MS = 15000;
const send = (v, target, speed) => {
  v.target = target;
  v.targetKind = 'game';
  v.speed = speed;
};
const called = id => name(views.get(id).pet);
let gameButtons = [];
export function syncGameUi() {
  for (const b of gameButtons) {
    const mine = game?.kind === b.dataset.game;
    b.textContent = mine ? t('game.stop', { name: GAMES[b.dataset.game] }) : GAMES[b.dataset.game];
    b.classList.toggle('playing', mine);
    b.setAttribute('aria-pressed', String(mine));
    b.disabled = !data.pets.length || (!!game && !mine);
  }
  for (const id of ['feed', 'greet']) $(id).disabled = !data.pets.length || !!game;
  hint();
}
function say(text) {
  game.hint = text;
  hint();
}
// The banner at the head of the yard says what a game is asking for; without a title it goes away.
let missTimer;
function banner(label, title, sub = '') {
  clearTimeout(missTimer);
  $('game-banner').classList.remove('miss');
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
  banner(t('hide.find_label'), called(game.target), [note, where].filter(Boolean).join(' · '));
}
// A wrong guess only says so; the friend stays hidden and the same name is still asked for.
function miss() {
  const sub = $('banner-sub').textContent;
  $('banner-sub').textContent = t('hide.miss');
  $('banner-sub').hidden = false;
  $('game-banner').classList.remove('miss');
  void $('game-banner').offsetWidth;
  $('game-banner').classList.add('miss');
  clearTimeout(missTimer);
  missTimer = setTimeout(() => {
    $('game-banner').classList.remove('miss');
    $('banner-sub').textContent = sub;
    $('banner-sub').hidden = !sub;
  }, 2400);
}
const hide = {
  start(now) {
    game.hidden = new Set(game.ids);
    const spots = shuffle(hidingSpots(game.ids.length, Math.random));
    party().forEach((v, i) => {
      send(v, spots[i], 0.0006);
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
        v.target = null;
        v.targetKind = null;
        hide.arrived(v);
      }
  },
  arrived(v) {
    if (!game.hidden.has(v.pet.id)) return;
    v.button.classList.add('hiding');
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
    if (result === 'wrong') return miss();
    if (result !== 'found') return;
    game.hidden.delete(id);
    v.button.classList.remove('hiding');
    pose(v, 'jump', 1200);
    effect(v, '!');
    bubble(v, t('hide.found_bubble'), 2500);
    setTimeout(() => {
      if (game?.kind === 'hide') send(v, { x: v.x, y: 0.35 + Math.random() * 0.55 }, 0.0005);
    }, 900);
    if (game.hidden.size) ask(t('hide.found', { name: called(id) }));
    else {
      game.target = null;
      say(t('hide.all_found'));
      banner(GAMES.hide, t('hide.all_found'));
      setTimeout(() => {
        if (game?.kind === 'hide') endGame(t('hide.all_found_toast'));
      }, 1600);
    }
  },
};

const parade = {
  start(_now, lead) {
    game.progress = 0;
    game.walking = false;
    const at = paradePositions(game.ids.length, 0);
    party().forEach((v, i) => {
      send(v, at[i], 0.0005);
    });
    say(t('parade.follow', { name: called(lead) }));
  },
  frame(_now, dt, players) {
    if (!game.walking) {
      if (players.some(v => v.target)) return;
      game.walking = true;
      say(t('parade.walking'));
    }
    game.progress += dt / PARADE_MS;
    const at = paradePositions(game.ids.length, Math.min(1, game.progress));
    players.forEach((v, i) => {
      if (!reduced.matches) pose(v, at[i].x >= v.x ? 'right' : 'left', 150);
      v.x = at[i].x;
      v.y = at[i].y;
      place(v);
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
  needs: views => (views.size < 2 ? 'game.tag_needs_two' : null),
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
      v.target = null;
      v.frozen = true;
      v.frozenUntil = now + 900;
      pose(v, 'jump', 900);
      effect(v, '!');
      bubble(v, t('tag.im_it'), 2000);
      say(t('tag.it_is', { name: name(v.pet) }));
      break;
    }
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
    if (prey && !it.frozen) send(it, { x: prey.x, y: prey.y }, 0.00046);
    for (const v of players)
      if (v !== it && (!v.target || Math.hypot(v.x - it.x, v.y - it.y) < 0.3))
        send(v, fleeTarget(v, it, Math.random), 0.0003);
  },
};

/** What each game does, by its id in GAMES. Hooks a game does not need are left out. */
const RULES = { hide, parade, tag };
const rules = () => RULES[game.kind];

function startGame(kind) {
  if (game) endGame();
  if (!views.size || !RULES[kind]) return;
  const missing = RULES[kind].needs?.(views);
  if (missing) return toast(t(missing));
  if (aiming) setAimingMode(false);
  $('treat').hidden = true;
  const lead = views.has(selected) ? selected : [...views.keys()][0],
    now = performance.now();
  setGame({ kind, ids: [lead, ...[...views.keys()].filter(id => id !== lead)], hint: '' });
  for (const v of party()) {
    v.away = true;
    v.target = null;
    v.targetKind = null;
    v.look = null;
  }
  RULES[kind].start(now, lead);
  paintScene();
  syncGameUi();
}
export function endGame(message) {
  if (!game) return;
  const over = game;
  setGame(null);
  banner('', '');
  for (const v of views.values()) {
    v.frozen = false;
    v.speed = 0;
    v.button.classList.remove('hiding');
    tagger(v, false);
    if (v.away) {
      v.target = { x: v.pet.x, y: v.pet.y };
      v.targetKind = 'home';
    }
    rest(v);
  }
  RULES[over.kind]?.end?.(over, message);
  paintScene();
  syncGameUi();
  if (message) toast(message);
}
// A game cannot go on without one of its players.
export function endGameIfSomeoneLeft() {
  if (game?.ids.some(id => !data.pets.some(p => p.id === id))) endGame();
}
// Called when a friend reaches where a game sent it.
export function arrived(v) {
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
  gameButtons = [...document.querySelectorAll('.tools [data-game]')];
  for (const b of gameButtons)
    b.onclick = () => (game?.kind === b.dataset.game ? endGame() : startGame(b.dataset.game));
}
