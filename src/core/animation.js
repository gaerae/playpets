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
export function lookFrame(dx, dy) {
  if (Math.hypot(dx, dy) < 0.001) return { row: 0, column: 0 };
  const direction = Math.round(((Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 8)) % 16;
  return { row: 9 + Math.floor(direction / 8), column: direction % 8 };
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
// How much of a cell is empty above the sprite, as a share of its height: sprites rarely fill the
// 192×208 cell, and a bubble drawn at the cell's top would hang in the air. `rgba` is the cell's pixels.
export function headroom(rgba, width, height) {
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 3; x < width * 4; x += 4) if (rgba[row + x] > 24) return y / height;
  }
  return 0;
}
