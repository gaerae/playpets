// Which cell of a Codex pet sheet to show. Rows 0-8 are the standard animations, each with its
// own frame durations (ms); rows 9-10, in v2 sheets only, hold 16 directions to look in.
const rows = {
  idle: [0, [280, 110, 110, 140, 140, 320]],
  right: [1, [120, 120, 120, 120, 120, 120, 120, 220]],
  left: [2, [120, 120, 120, 120, 120, 120, 120, 220]],
  wave: [3, [140, 140, 140, 280]],
  jump: [4, [140, 140, 140, 140, 280]],
  error: [5, [140, 140, 140, 140, 140, 140, 140, 240]],
  waiting: [6, [150, 150, 150, 150, 150, 260]],
  working: [7, [120, 120, 120, 120, 120, 220]],
  done: [8, [150, 150, 150, 150, 150, 280]],
};
// Website previews follow the runtime contract without keeping a second state table.
export function animationSpec(state) {
  const [row, durations] = rows[state] || rows.idle;
  return { row, frames: durations.length, seconds: durations.reduce((a, b) => a + b, 0) / 1000 };
}
// Brief gestures finish once; replaying their first frames cuts a second jump or wave short.
export function poseClock(state, elapsed) {
  if (!['jump', 'wave', 'done'].includes(state)) return elapsed;
  return Math.min(Math.max(0, elapsed), Math.round(animationSpec(state).seconds * 1000) - 1);
}
export function frameAt(state, elapsed) {
  const [row, durations] = rows[state] || rows.idle;
  let tick = Math.max(0, elapsed) % durations.reduce((a, b) => a + b, 0);
  for (let column = 0; column < durations.length; column++) {
    if (tick < durations[column]) return { row, column };
    tick -= durations[column];
  }
  return { row, column: 0 };
}
/** How long the cell frameAt shows at `elapsed` goes on showing. The frame loops wake when it ends,
 * so each cell shows for its own time and not until the next whole frame. */
export function cellLeft(state, elapsed) {
  const [, durations] = rows[state] || rows.idle;
  let tick = Math.max(0, elapsed) % durations.reduce((a, b) => a + b, 0);
  for (const duration of durations) {
    if (tick < duration) return duration - tick;
    tick -= duration;
  }
  return durations[0];
}

// A standing friend mostly stands (the idle row's first cell) and plays the row once now and then.
// Time goes in beats of IDLE_BEAT; in IDLE_PLAY of them the row plays from a moment between
// IDLE_FROM and IDLE_FROM + IDLE_SPAN into the beat, so two gestures are at least 2.1 s apart, a
// second of rest between them. Which beats and when come from `seed` (one per canvas): friends do
// not move together. Cycling the row without a pause read as fidgeting, and drew five times a second.
export const IDLE_BEAT = 3600;
const IDLE_PLAY = 0.6,
  IDLE_FROM = 500,
  IDLE_SPAN = 1500;
const idleRow = rows.idle[1],
  idleCycle = idleRow.reduce((a, b) => a + b, 0),
  REST = Object.freeze({ row: 0, column: 0 });
// A number in [0, 1) for a seed and a beat: the same every time it is asked.
function unit(seed, n) {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}
// A rhythm that rests more than the yard's: a friend plays its row in `share` of the beats, which
// are some of the beats it plays in anyway, at the same moments (the same draw from `unit`). The
// beats that start from `from` until `until` play as the yard's. The desktop rests so while nobody
// is with its friends (overlay/pace.js): each cell a friend shows there costs a redraw of its window.
/** A rhythm for a canvas (its `_rhythm`) that gestures in `share` of the beats until livened. */
export function calmRhythm(share) {
  return { share, from: 0, until: 0 };
}
/** Lively for `ms` from `now`: the beats that start from the next one on play as the yard's. The
 * beat under way keeps its gesture or its rest, so a gesture is never cut into or cut short. */
export function liven(rhythm, now, ms) {
  if (now >= rhythm.until) rhythm.from = (Math.floor(Math.max(0, now) / IDLE_BEAT) + 1) * IDLE_BEAT;
  rhythm.until = Math.max(rhythm.until, now + ms);
}
function shareOf(k, rhythm) {
  if (!rhythm) return IDLE_PLAY;
  const at = k * IDLE_BEAT;
  return at >= rhythm.from && at < rhythm.until ? IDLE_PLAY : rhythm.share;
}
// Where the gesture of beat `k` starts, as time from the beat's start, or null when it rests.
function gestureIn(k, seed, rhythm) {
  return unit(seed, 2 * k) < shareOf(k, rhythm) ? IDLE_FROM + Math.floor(unit(seed, 2 * k + 1) * IDLE_SPAN) : null;
}
/** The cell a standing friend shows at `elapsed` (ms) by its canvas's `seed` (and `rhythm`, calmRhythm). */
export function idleCell(elapsed, seed = 0, rhythm = null) {
  const t = Math.max(0, elapsed),
    k = Math.floor(t / IDLE_BEAT),
    start = gestureIn(k, seed, rhythm),
    at = t - k * IDLE_BEAT - (start ?? 0);
  return start !== null && at >= 0 && at < idleCycle ? frameAt('idle', at) : REST;
}
/** How long the cell idleCell shows at `elapsed` goes on showing: to its gesture's next cell, or
 * through the rest to where the next gesture leaves its first cell (which is the resting one). */
export function idleLeft(elapsed, seed = 0, rhythm = null) {
  const t = Math.max(0, elapsed);
  const k = Math.floor(t / IDLE_BEAT);
  const start = gestureIn(k, seed, rhythm),
    at = t - k * IDLE_BEAT - (start ?? 0);
  if (start !== null && at >= 0 && at < idleCycle) return cellLeft('idle', at);
  // Resting: the next gesture shows its second cell where its first one ends.
  for (let next = start !== null && at < 0 ? k : k + 1; next < k + 64; next++) {
    const from = gestureIn(next, seed, rhythm);
    if (from !== null) return next * IDLE_BEAT + from + idleRow[0] - t;
  }
  return IDLE_BEAT;
}

// A look at the pointer is one of 16 directions, drawn in rows 9-10 of a v2 sheet, 0 straight up
// and going clockwise. It turns at most one direction a TURN_MS, the shorter way round, so a pointer
// going round a friend turns it instead of making it jump; once a look ends the friend holds its
// last direction LOOK_HOLD before it stands again, so a pointer passing over it does not flicker.
export const TURN_MS = 60;
export const LOOK_HOLD = 250;
/** The direction (0 to 15) a friend looks toward `dx`, `dy` (pixels from its middle). */
export function lookDirection(dx, dy) {
  return Math.round(((Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 8)) % 16;
}
/** The cell that looks in `direction`. */
export function directionFrame(direction) {
  return { row: 9 + Math.floor(direction / 8), column: direction % 8 };
}
/** One turn from `from` toward `to` (directions), the shorter way: right behind turns
 * counterclockwise. A look with no direction yet starts at `to`. */
export function turnStep(from, to) {
  if (from === null || from === undefined) return to;
  const diff = ((to - from + 24) % 16) - 8;
  if (!diff) return from;
  return (from + (diff > 0 ? 1 : -1) + 16) % 16;
}
export function lookFrame(dx, dy) {
  if (Math.hypot(dx, dy) < 0.001) return { row: 0, column: 0 };
  return directionFrame(lookDirection(dx, dy));
}
// Where a friend looks while the pointer moves over it: the pointer's offset from the middle of
// its box, or nowhere when the pointer is right on its middle. Used by the yard and the desktop.
export function lookAt(rect, clientX, clientY) {
  const x = clientX - rect.x - rect.width / 2,
    y = clientY - rect.y - rect.height / 2;
  return Math.hypot(x, y) > 20 ? { x, y } : null;
}
// A pose restarts its animation only when it is a new pose, or the old one had already run out.
export const renewsClock = (current, next, until, now) => current !== next || now >= until;
/** The alpha above which a pixel counts as part of the drawing, for every measure of the art. */
export const SOLID_ALPHA = 24;
// How much of a cell is empty above the sprite, as a share of its height: sprites rarely fill the
// 192×208 cell, and a bubble drawn at the cell's top would hang in the air. `rgba` is the cell's pixels.
export function headroom(rgba, width, height) {
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 3; x < width * 4; x += 4) if (rgba[row + x] > SOLID_ALPHA) return y / height;
  }
  return 0;
}
/** How many cells row `row` of a sheet plays: a standard row's frames, or a look row's 8 directions. */
export function cellsIn(row) {
  for (const [at, durations] of Object.values(rows)) if (at === row) return durations.length;
  return 8;
}
// Where a row of a sprite is drawn in its cell, as shares of the cell [left, top, right, bottom]:
// around every opaque pixel of the row's `cells` cells (each `cell` wide and `height` tall, side by
// side in `rgba`), laid over each other, so every frame of the pose is inside. Null for an empty row.
export function bodyBox(rgba, cells, cell, height) {
  const width = cells * cell;
  let left = cell,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] <= SOLID_ALPHA) continue;
      const column = x % cell;
      if (column < left) left = column;
      if (column > right) right = column;
      if (y < top) top = y;
      bottom = y;
    }
  return right < 0 ? null : [left / cell, top / height, (right + 1) / cell, (bottom + 1) / height];
}
