// A place's outdoor picture is painted on white and cut out round its land, so its sky is clear.
// The cut is all or nothing and keeps a pale ring of the white it was painted on, and little white
// patches where the sky shows between leaves: drawn over the app's sky, the treetops and the hills'
// line show a light, stepped outline. This cleans that line in place:
//   - paper: a patch of the white it was painted on that reaches no lower than a few pixels under
//     the lowest sky in its column (between leaves, along a crown) becomes sky. Snow and blossom are the same white
//     (a petal's highlight is a patch of it too), so a winter or spring picture skips this step;
//   - edge: the pixels next to the sky take the colour of the land just inside them, and their
//     alpha rises over a pixel and a half, so the land meets the sky in a smooth, antialiased edge.
// Only that thin band and those patches change; the land inside and the clear sky keep every sample.

// Alpha at or above this is land; below it, sky.
const LAND = 128;
// The edge band: land this close to the sky (in pixels) is the edge, and takes the colour of land
// farther in. A pixel that touches the sky is 1 away.
const BAND = 2;
// Alpha climbs from the sky over this many pixels; a pixel that touches the sky is at OPEN.
const RAMP = 1.5;
const OPEN = 0.4;
// How far (in pixels) an edge pixel looks for land farther in to take its colour from.
const REACH = 3;

/** How far each land pixel is from the nearest sky pixel (1 for one that touches it), by an 8-way
 * chamfer close to the true distance; sky is 0. The picture's own border is not sky. */
export function skyDistance(pixels, width, height) {
  const d = new Float32Array(width * height),
    far = width + height;
  for (let i = 0; i < d.length; i++) d[i] = pixels[i * 4 + 3] >= LAND ? far : 0;
  const diagonal = Math.SQRT2;
  const pass = (from, to, step, back) => {
    for (let y = from; y !== to; y += step)
      for (let x = back ? width - 1 : 0; back ? x >= 0 : x < width; x += back ? -1 : 1) {
        const i = y * width + x;
        if (!d[i]) continue;
        const dx = back ? 1 : -1,
          dy = -step;
        const look = (nx, ny, cost) => {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
          const value = d[ny * width + nx] + cost;
          if (value < d[i]) d[i] = value;
        };
        look(x + dx, y, 1);
        look(x, y + dy, 1);
        look(x + dx, y + dy, diagonal);
        look(x - dx, y + dy, diagonal);
      }
  };
  pass(0, height, 1, false);
  pass(height - 1, -1, -1, true);
  return d;
}

// The white it was painted on: bright and nearly grey (the painted whites, a petal or foam, are
// tinted or shaded).
const PAPER = 236;
const PAPER_TINT = 16;
// How far under the lowest sky in its column a patch of paper may reach: the ring is a few pixels
// wide, and white that runs on down (a snowy ridge, foam) is painted.
const PAPER_DEPTH = 4;

// Each patch of paper white no lower than PAPER_DEPTH under the sky's lowest point in its column,
// with the land round it (not paper, not sky), for `keep` to choose from.
function paperPatches(pixels, width, height, keep) {
  const size = width * height,
    sky = i => pixels[i * 4 + 3] < LAND;
  const paper = i => {
    const o = i * 4,
      r = pixels[o],
      g = pixels[o + 1],
      b = pixels[o + 2];
    return !sky(i) && Math.min(r, g, b) >= PAPER && Math.max(r, g, b) - Math.min(r, g, b) <= PAPER_TINT;
  };
  const lowest = new Int32Array(width).fill(-1);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (sky(y * width + x)) lowest[x] = y;
  const seen = new Uint8Array(size),
    chosen = [];
  for (let start = 0; start < size; start++) {
    if (seen[start] || !paper(start)) continue;
    const patch = [start],
      ring = new Set();
    seen[start] = 1;
    let above = true;
    for (let k = 0; k < patch.length; k++) {
      const p = patch[k],
        x = p % width,
        y = (p - x) / width;
      if (y > lowest[x] + PAPER_DEPTH) above = false;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (paper(q)) {
          if (!seen[q]) {
            seen[q] = 1;
            patch.push(q);
          }
        } else if (!sky(q)) ring.add(q);
      }
    }
    if (above && keep(ring)) chosen.push(...patch);
  }
  for (const p of chosen) pixels[p * 4 + 3] = 0;
  return chosen;
}

/** Turns the patches of paper white no lower than PAPER_DEPTH under the sky's lowest point in each
 * column into sky, in place; returns how many pixels changed. */
export function clearPaper(pixels, width, height) {
  return paperPatches(pixels, width, height, () => true).length;
}

// A hole the sky shows through between leaves has leaves round it: darker than this (the mean of
// red, green and blue), or green, with more green than blue by HOLE_GREEN. Snow's shading is light
// and lilac, a blossom's pink.
const HOLE_RING = 200;
const HOLE_GREEN = 12;

/** For a picture that keeps its white (snow, blossom): turns into sky only the patches of paper
 * white, no lower than PAPER_DEPTH under the sky in their column, that leaves surround; in place.
 * Returns the pixels cleared, for softenSkyEdge to soften round them alone. */
export function clearHoles(pixels, width, height) {
  return paperPatches(pixels, width, height, ring => {
    if (!ring.size) return false;
    let light = 0,
      green = 0;
    for (const j of ring) {
      light += (pixels[j * 4] + pixels[j * 4 + 1] + pixels[j * 4 + 2]) / 3;
      green += pixels[j * 4 + 1] - pixels[j * 4 + 2];
    }
    return light / ring.size < HOLE_RING || green / ring.size > HOLE_GREEN;
  });
}

/** Whether a picture's edge is soft already: most land that touches the sky is part clear. A cut
 * picture's is opaque, and softening it again would move its line a pixel into the land. */
export function softened(pixels, width, height) {
  const d = skyDistance(pixels, width, height);
  let edge = 0,
    soft = 0;
  for (let i = 0; i < d.length; i++)
    if (d[i] === 1) {
      edge++;
      if (pixels[i * 4 + 3] < 255) soft++;
    }
  return edge > 0 && soft * 2 > edge;
}

/** Softens the line where a picture's land meets its clear sky, in place (8-bit RGBA). With `only`
 * (pixels just cleared, clearHoles), only the land round those is softened, so the rest of the
 * line, soft already, is not worn down. */
export function softenSkyEdge(pixels, width, height, only = null) {
  const d = skyDistance(pixels, width, height),
    out = new Uint8Array(pixels);
  // Distance to the pixels just cleared alone: the land farther from them than BAND is left be.
  let near = null;
  if (only) {
    const mask = new Uint8Array(width * height * 4).fill(255);
    for (const p of only) mask[p * 4 + 3] = 0;
    near = skyDistance(mask, width, height);
  }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x,
        o = i * 4;
      if (near && near[i] > BAND) continue;
      if (!d[i]) {
        out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
        continue;
      }
      if (d[i] > BAND) continue;
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let ny = Math.max(0, y - REACH); ny <= Math.min(height - 1, y + REACH); ny++)
        for (let nx = Math.max(0, x - REACH); nx <= Math.min(width - 1, x + REACH); nx++) {
          const j = ny * width + nx;
          if (d[j] <= BAND) continue;
          r += pixels[j * 4];
          g += pixels[j * 4 + 1];
          b += pixels[j * 4 + 2];
          n++;
        }
      // A sliver of land with no inside (a twig, a blade of grass) keeps its own colour.
      if (n) {
        out[o] = Math.round(r / n);
        out[o + 1] = Math.round(g / n);
        out[o + 2] = Math.round(b / n);
      }
      const open = Math.min(1, OPEN + ((d[i] - 1) / RAMP) * (1 - OPEN));
      out[o + 3] = Math.round(Math.min(pixels[o + 3], 255 * open));
    }
  pixels.set(out);
  return pixels;
}
