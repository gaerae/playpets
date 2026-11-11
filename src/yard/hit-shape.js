// A tree or a flower takes clicks only where it is drawn, so a gift, a friend or the ground showing
// through its empty corners can still be clicked. Its drawing is a crop of a painted atlas (art.js),
// so the shape is read from that crop's alpha once per drawing, on a coarse grid, and laid over the
// drawing as an invisible path that alone takes the pointer (garden.css `.shaped`). Until the shape
// is known, or when a drawing is not a single atlas crop, the whole box takes clicks as before.
import { artHref, artSize } from './art.js';

const NS = 'http://www.w3.org/2000/svg';
// A grid cell's side, in the drawing's own units (its view box).
const CELL = 4;
// A cell counts as drawn when this share of its pixels is mostly opaque, so a twig or a stem holds.
const SOLID = 1 / 8;
const shapes = new Map();

/** Where an atlas crop (`[x, y, width, height]` of an <svg viewBox>) lands in a drawing of
 * `width` × `height` under its preserveAspectRatio: its offset and scale, or null for a fit not
 * handled here (none, slice). */
export function cropPlacement(width, height, [, , cw, ch], aspect = 'xMidYMid meet') {
  const [align, fit = 'meet'] = aspect.trim().split(/\s+/),
    match = /^x(Min|Mid|Max)Y(Min|Mid|Max)$/.exec(align);
  if (!match || fit !== 'meet' || !(cw > 0) || !(ch > 0)) return null;
  const scale = Math.min(width / cw, height / ch),
    share = { Min: 0, Mid: 0.5, Max: 1 };
  return {
    x: (width - cw * scale) * share[match[1]],
    y: (height - ch * scale) * share[match[2]],
    scale,
  };
}

/** Which cells of a `width` × `height` alpha map (one byte a pixel, row by row) are drawn. */
export function solidCells(alpha, width, height, cell = CELL) {
  const cols = Math.ceil(width / cell),
    rows = Math.ceil(height / cell),
    cells = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      let opaque = 0,
        all = 0;
      for (let y = row * cell; y < Math.min(height, (row + 1) * cell); y++)
        for (let x = col * cell; x < Math.min(width, (col + 1) * cell); x++) {
          all++;
          if (alpha[y * width + x] >= 128) opaque++;
        }
      cells.push(opaque >= all * SOLID && opaque > 0);
    }
  return { cells, cols, rows };
}

/** The drawn cells as one SVG path in drawing units, each row's run of drawn cells one rectangle;
 * an empty string when nothing is drawn. */
export function cellsPath({ cells, cols, rows }, cell = CELL) {
  const parts = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      if (!cells[row * cols + col]) continue;
      const start = col;
      while (col + 1 < cols && cells[row * cols + col + 1]) col++;
      parts.push(`M${start * cell} ${row * cell}h${(col - start + 1) * cell}v${cell}h${-(col - start + 1) * cell}z`);
    }
  return parts.join('');
}

// Reads a drawing's alpha from its atlas: one pixel a drawing unit, then the drawn cells' path.
async function measure(path) {
  const symbol = document.getElementById(artHref(path).slice(1)),
    frames = symbol?.querySelectorAll('svg') || [],
    images = symbol?.querySelectorAll('image') || [];
  if (frames.length !== 1 || images.length !== 1) return '';
  const [width, height] = artSize(path),
    frame = frames[0],
    image = images[0],
    crop = (frame.getAttribute('viewBox') || '')
      .trim()
      .split(/[\s,]+/)
      .map(Number),
    place =
      crop.length === 4 && cropPlacement(width, height, crop, frame.getAttribute('preserveAspectRatio') || undefined);
  if (!place) return '';
  const picture = new Image();
  picture.src = image.getAttribute('href');
  await picture.decode();
  // The atlas as the drawing places it: its own x and y, at the width and height it is given.
  const across = picture.naturalWidth / (Number(image.getAttribute('width')) || picture.naturalWidth),
    down = picture.naturalHeight / (Number(image.getAttribute('height')) || picture.naturalHeight),
    left = crop[0] - (Number(image.getAttribute('x')) || 0),
    top = crop[1] - (Number(image.getAttribute('y')) || 0),
    canvas = document.createElement('canvas'),
    w = Math.ceil(width),
    h = Math.ceil(height);
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    picture,
    left * across,
    top * down,
    crop[2] * across,
    crop[3] * down,
    place.x,
    place.y,
    crop[2] * place.scale,
    crop[3] * place.scale,
  );
  const rgba = context.getImageData(0, 0, w, h).data,
    alpha = new Uint8Array(w * h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
  return cellsPath(solidCells(alpha, w, h));
}

/** Lets the button holding this drawing take clicks only where the drawing is painted, once its
 * shape is known. Called again whenever its drawing changes. `read` is for tests. */
export function shapeHits(button, path, read = measure) {
  const svg = button.querySelector('svg');
  button.querySelector('.hit')?.remove();
  button.classList.remove('shaped');
  button.dataset.shape = path;
  if (!svg) return Promise.resolve();
  if (!shapes.has(path))
    shapes.set(
      path,
      read(path).catch(() => ''),
    );
  return shapes.get(path).then(d => {
    // The drawing may have changed, or the button left, while its shape was being read.
    if (!d || button.dataset.shape !== path || button.querySelector('svg') !== svg) return;
    const hit = document.createElementNS(NS, 'path');
    hit.setAttribute('class', 'hit');
    hit.setAttribute('d', d);
    svg.append(hit);
    button.classList.add('shaped');
  });
}
