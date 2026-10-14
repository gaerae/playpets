// Keep every row on the same scale: a wide gesture must not shrink the whole pet.
export function batchFrame(pose, row, column, scale, lift = 0) {
  const sx = Math.max(0, pose.left - 2),
    sy = Math.max(0, pose.top - 2);
  const sw = pose.right - sx + 3,
    sh = pose.bottom - sy + 3;
  const dw = sw * scale,
    dh = sh * scale;
  const dx = column * 192 + (192 - dw) / 2,
    dy = row * 208 + 200 - lift * scale - dh;
  if (dx < column * 192 + 3 || dx + dw > (column + 1) * 192 - 3 || dy < row * 208 + 3 || dy + dh > (row + 1) * 208 - 3)
    throw new Error(`Pose ${row}:${column} would clip its cell; revise the source pose`);
  return { sx, sy, sw, sh, dx, dy, dw, dh };
}

// Curation selects another generated pose; it never changes a drawing or its scale.
export function frameOrder(mapping = {}) {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!object(mapping)) throw new Error('Invalid frame map: expected a row/column object');
  const order = Array.from({ length: 11 }, () => Array.from({ length: 8 }, (_, column) => column));
  for (const [rowKey, columns] of Object.entries(mapping)) {
    const row = Number(rowKey);
    if (!Number.isInteger(row) || row < 0 || row > 10 || String(row) !== rowKey || !object(columns))
      throw new Error(`Invalid frame map row: ${rowKey}`);
    for (const [columnKey, sourceColumn] of Object.entries(columns)) {
      const column = Number(columnKey);
      if (
        !Number.isInteger(column) ||
        column < 0 ||
        column > 7 ||
        String(column) !== columnKey ||
        !Number.isInteger(sourceColumn) ||
        sourceColumn < 0 ||
        sourceColumn > 7
      )
        throw new Error(`Invalid frame map column: ${rowKey}:${columnKey}`);
      order[row][column] = sourceColumn;
    }
  }
  return order;
}

// Whole-row corrections recover a consistent model size when a generated batch drifted.
export function rowScales(config = {}) {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!object(config) || Object.keys(config).some(key => key !== 'rowScales' && key !== 'jumpLifts'))
    throw new Error('Invalid row scale configuration');
  const corrections = config.rowScales ?? {};
  if (!object(corrections)) throw new Error('Invalid row scale map');
  const scales = Array(11).fill(1);
  for (const [key, factor] of Object.entries(corrections)) {
    const row = Number(key);
    if (
      !Number.isInteger(row) ||
      row < 0 ||
      row > 10 ||
      String(row) !== key ||
      typeof factor !== 'number' ||
      !Number.isFinite(factor) ||
      factor <= 0
    )
      throw new Error(`Invalid row scale: ${key}`);
    scales[row] = factor;
  }
  return scales;
}

// Generated rows have independent gutters; explicit lifts preserve authored jump phases.
export function jumpLifts(config = {}) {
  if (!Object.hasOwn(config, 'jumpLifts')) return null;
  const lifts = config.jumpLifts;
  if (
    !Array.isArray(lifts) ||
    lifts.length !== 8 ||
    lifts.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)
  )
    throw new Error('Invalid jump lift configuration');
  return [...lifts];
}
