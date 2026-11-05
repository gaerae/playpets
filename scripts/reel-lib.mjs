// Rules for cutting the moving pictures from one filmed take (scripts/shots.mjs, SHOT_SCENE=reel).
// Pure functions; scripts/reel.mjs runs ffmpeg with them and tests/reel.test.mjs checks them.

// Each part as seconds around the take's marks: [part, from mark, offset, to mark, offset].
// The dig is the last one tried, the one that found something.
const EDITS = {
  // The landing's film: the garden, a find, a cast and its catch, a chat, then the show at night.
  site: [
    ['garden', 'garden', 0.5, 'garden', 3.5],
    ['dig', 'dig', 0, 'found', 2.4],
    ['cast', 'fish', 0, 'fish', 2.6],
    ['catch', 'bite', -1, 'caught', 2.4],
    ['chat', 'chat', 0.6, 'chat', 5.4],
    ['show', 'show', 0.8, 'end', -2],
  ],
  // The README's picture, kept short for its size: the find, the catch, the show up to its last burst.
  readme: [
    ['dig', 'found', -2.2, 'found', 1.8],
    ['catch', 'bite', -0.8, 'caught', 1.6],
    ['show', 'show', 1.6, 'show', 9.6],
  ],
};

/** The parts of an edit ('site' or 'readme') as {part, from, to} seconds of the take. */
export function reelCuts(marks, edit) {
  const at = name => {
    const found = marks.findLast(mark => mark.name === name);
    if (!found) throw new Error(`The take has no "${name}" mark`);
    return found.at;
  };
  return EDITS[edit].map(([part, start, before, stop, after]) => ({
    part,
    from: +(at(start) + before).toFixed(3),
    to: +(at(stop) + after).toFixed(3),
  }));
}

/**
 * An ffmpeg filter graph that trims each part from input 0, scales it to `width` at `fps` and joins
 * them with `fade`-second cross-fades; the result is labelled [film]. `duration` is its length.
 */
export function reelFilter(cuts, { width, fps, fade }) {
  const parts = cuts.map(
    ({ from, to }, i) =>
      `[0:v]trim=start=${from}:end=${to},setpts=PTS-STARTPTS,fps=${fps},scale=${width}:-2:flags=lanczos,format=yuv420p[p${i}]`,
  );
  let last = 'p0',
    length = cuts[0].to - cuts[0].from;
  const joins = cuts.slice(1).map(({ from, to }, i) => {
    const offset = +(length - fade).toFixed(3),
      out = i === cuts.length - 2 ? 'film' : `j${i}`;
    const join = `[${last}][p${i + 1}]xfade=transition=fade:duration=${fade}:offset=${offset}[${out}]`;
    length = offset + (to - from);
    last = out;
    return join;
  });
  if (cuts.length === 1) parts[0] = parts[0].replace(/\[p0\]$/, '[film]');
  return { graph: [...parts, ...joins].join(';'), duration: +length.toFixed(3) };
}
