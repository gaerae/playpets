// Whole connected figures can cross a generated source grid without losing pixels.
export function normalizeCatRow(rgba, width, height, guard = 3) {
  if (width % 4 || height % 2 || rgba.length !== width * height * 4)
    throw new Error('Invalid 4 by 2 source dimensions');
  const seen = new Uint8Array(width * height),
    poses = [];
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || rgba[start * 4 + 3] <= 24) continue;
    const pixels = [start];
    seen[start] = 1;
    let left = width,
      right = 0,
      top = height,
      bottom = 0;
    for (let i = 0; i < pixels.length; i++) {
      const at = pixels[i],
        x = at % width,
        y = Math.floor(at / width);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const next = ny * width + nx;
        if (!seen[next] && rgba[next * 4 + 3] > 24) {
          seen[next] = 1;
          pixels.push(next);
        }
      }
    }
    poses.push({ left, right, top, bottom, pixels });
  }
  if (poses.length !== 8) throw new Error(`Expected eight separate complete figures; found ${poses.length}`);
  for (const pose of poses) {
    const fringe = new Set(pose.pixels);
    for (const at of pose.pixels) {
      const x = at % width,
        y = Math.floor(at / width);
      for (let ny = Math.max(0, y - 2); ny <= Math.min(height - 1, y + 2); ny++)
        for (let nx = Math.max(0, x - 2); nx <= Math.min(width - 1, x + 2); nx++) {
          const near = ny * width + nx,
            alpha = rgba[near * 4 + 3];
          if (alpha > 0 && alpha <= 24) fringe.add(near);
        }
    }
    pose.pixels = [...fringe];
    for (const at of pose.pixels) {
      const x = at % width,
        y = Math.floor(at / width);
      pose.left = Math.min(pose.left, x);
      pose.right = Math.max(pose.right, x);
      pose.top = Math.min(pose.top, y);
      pose.bottom = Math.max(pose.bottom, y);
    }
  }
  const rowHeight = height / 2,
    cellWidth = width / 4;
  poses.sort(
    (a, b) =>
      Math.floor((a.top + a.bottom) / 2 / rowHeight) - Math.floor((b.top + b.bottom) / 2 / rowHeight) ||
      a.left + a.right - b.left - b.right,
  );
  const output = new Uint8ClampedArray(rgba.length);
  for (const [i, pose] of poses.entries()) {
    const row = Math.floor(i / 4),
      column = i % 4;
    if (pose.left === 0 || pose.right === width - 1 || pose.top === 0 || pose.bottom === height - 1)
      throw new Error(`Figure ${i} touches an image edge`);
    if (
      pose.right - pose.left + 1 > cellWidth - guard * 2 ||
      pose.top < row * rowHeight + guard ||
      pose.bottom >= (row + 1) * rowHeight - guard
    )
      throw new Error(`Figure ${i} is oversized or crosses rows`);
    pose.dx = column * cellWidth + Math.floor((cellWidth - (pose.right - pose.left + 1)) / 2) - pose.left;
    pose.dy = 0;
    for (const at of pose.pixels) output.set(rgba.subarray(at * 4, at * 4 + 4), (at + pose.dx) * 4);
  }
  return { rgba: output, poses };
}
