// A hat in one column can overlap the previous row's feet without touching them.
// Connected silhouettes keep these poses separate even when no straight cut is safe.
export function atlasPoses(rgba, width, height, columns = 8, rows = 11) {
  const seen = new Uint8Array(width * height),
    result = [];
  for (let column = 0; column < columns; column++) {
    const x0 = Math.round((column * width) / columns),
      x1 = Math.round(((column + 1) * width) / columns);
    const components = [];
    for (let y = 0; y < height; y++)
      for (let x = x0; x < x1; x++) {
        const start = y * width + x;
        if (seen[start] || rgba[start * 4 + 3] <= 24) continue;
        const pixels = [start];
        seen[start] = 1;
        let left = x,
          right = x,
          top = y,
          bottom = y;
        for (let i = 0; i < pixels.length; i++) {
          const at = pixels[i],
            px = at % width,
            py = Math.floor(at / width);
          left = Math.min(left, px);
          right = Math.max(right, px);
          top = Math.min(top, py);
          bottom = Math.max(bottom, py);
          for (const [nx, ny] of [
            [px - 1, py],
            [px + 1, py],
            [px, py - 1],
            [px, py + 1],
          ]) {
            if (nx < x0 || nx >= x1 || ny < 0 || ny >= height) continue;
            const next = ny * width + nx;
            if (seen[next] || rgba[next * 4 + 3] <= 24) continue;
            seen[next] = 1;
            pixels.push(next);
          }
        }
        components.push({ left, right, top, bottom, pixels, column });
      }
    components.sort((a, b) => b.pixels.length - a.pixels.length);
    const typical = components
      .slice(0, rows)
      .map(c => c.bottom - c.top + 1)
      .sort((a, b) => a - b);
    const typicalHeight = typical[Math.floor((typical.length - 1) / 2)];
    const separated = components.flatMap(component => {
      const height = component.bottom - component.top + 1;
      if (height < typicalHeight * 1.6) return [component];
      const occupancy = Array(height).fill(0);
      for (const at of component.pixels) occupancy[Math.floor(at / width) - component.top]++;
      let cut = Math.floor(height / 2);
      for (let y = Math.floor(height * 0.35); y < height * 0.65; y++) if (occupancy[y] < occupancy[cut]) cut = y;
      if (occupancy[cut] > (component.right - component.left + 1) * 0.2)
        throw new Error(`Merged poses cannot be separated safely in column ${column}`);
      const split = component.top + cut;
      return [
        component.pixels.filter(at => Math.floor(at / width) < split),
        component.pixels.filter(at => Math.floor(at / width) >= split),
      ].map(pixels => {
        let left = width,
          right = 0,
          top = Infinity,
          bottom = 0;
        for (const at of pixels) {
          const x = at % width,
            y = Math.floor(at / width);
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
        return { left, right, top, bottom, pixels, column };
      });
    });
    const poses = separated.sort((a, b) => b.pixels.length - a.pixels.length).slice(0, rows);
    if (poses.length !== rows) throw new Error(`Expected ${rows} isolated poses in column ${column}`);
    const areas = poses.map(c => c.pixels.length).sort((a, b) => a - b);
    if (areas[0] < areas[Math.floor(areas.length / 2)] * 0.25)
      throw new Error(`An incomplete pose remains in column ${column}`);
    poses.sort((a, b) => a.top + a.bottom - (b.top + b.bottom));
    result.push(poses);
  }
  return result;
}
