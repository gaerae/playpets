// A small GIF writer for the demo animation: frames of RGBA pixels in, an animated GIF out.
// Colours are reduced to 256 with a median cut over all frames, so the whole animation shares
// one palette and no frame flickers; pixels are packed with LZW as GIF89a asks.
// Nothing here depends on an image library; tests/website.test.mjs decodes the header back.

/** Builds one 256-colour palette for all frames by median cut. */
export function palette(frames, size = 256) {
  const samples = [];
  for (const f of frames) for (let i = 0; i < f.length; i += 4 * 3) samples.push([f[i], f[i + 1], f[i + 2]]);
  const boxes = [samples];
  while (boxes.length < size) {
    boxes.sort((a, b) => spread(b) - spread(a));
    const box = boxes.shift();
    if (!box || box.length < 2) {
      if (box) boxes.push(box);
      break;
    }
    const axis = widestAxis(box);
    box.sort((a, b) => a[axis] - b[axis]);
    const half = box.length >> 1;
    boxes.push(box.slice(0, half), box.slice(half));
  }
  return boxes.map(box => {
    const sum = [0, 0, 0];
    for (const p of box) for (let c = 0; c < 3; c++) sum[c] += p[c];
    return sum.map(v => Math.round(v / box.length));
  });
}
const spread = box => {
  const axis = widestAxis(box);
  let lo = 255;
  let hi = 0;
  for (const p of box) {
    if (p[axis] < lo) lo = p[axis];
    if (p[axis] > hi) hi = p[axis];
  }
  return (hi - lo) * box.length ** 0.25;
};
function widestAxis(box) {
  const lo = [255, 255, 255];
  const hi = [0, 0, 0];
  for (const p of box)
    for (let c = 0; c < 3; c++) {
      if (p[c] < lo[c]) lo[c] = p[c];
      if (p[c] > hi[c]) hi[c] = p[c];
    }
  const d = hi.map((v, c) => v - lo[c]);
  return d.indexOf(Math.max(...d));
}

/** Nearest palette index for every pixel, with a cache keyed by colour. */
export function indexFrame(rgba, colors) {
  const out = new Uint8Array(rgba.length / 4);
  const cache = new Map();
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
    let idx = cache.get(key);
    if (idx === undefined) {
      let best = 0;
      let bestD = Infinity;
      for (let k = 0; k < colors.length; k++) {
        const c = colors[k];
        const d = (c[0] - rgba[i]) ** 2 + (c[1] - rgba[i + 1]) ** 2 + (c[2] - rgba[i + 2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      idx = best;
      cache.set(key, idx);
    }
    out[j] = idx;
  }
  return out;
}

/** GIF LZW: index stream in, sub-blocked code bytes out. */
export function lzw(indices, minCodeSize) {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  let codeSize = minCodeSize + 1;
  let next = end + 1;
  let dict = new Map();
  const bytes = [];
  let acc = 0;
  let accBits = 0;
  const emit = code => {
    acc |= code << accBits;
    accBits += codeSize;
    while (accBits >= 8) {
      bytes.push(acc & 255);
      acc >>>= 8;
      accBits -= 8;
    }
  };
  emit(clear);
  let prefix = -1;
  for (const k of indices) {
    if (prefix < 0) {
      prefix = k;
      continue;
    }
    const key = prefix * 4096 + k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      emit(clear);
      dict = new Map();
      next = end + 1;
      codeSize = minCodeSize + 1;
    }
    prefix = k;
  }
  if (prefix >= 0) emit(prefix);
  emit(end);
  if (accBits > 0) bytes.push(acc & 255);
  const out = [];
  for (let i = 0; i < bytes.length; i += 255) {
    const chunk = bytes.slice(i, i + 255);
    out.push(chunk.length, ...chunk);
  }
  out.push(0);
  return Uint8Array.from(out);
}

/**
 * The GIF file. `frames` are RGBA arrays of width×height; `delay` is the time per frame in
 * hundredths of a second, or an array of per-frame delays. The animation loops forever.
 */
export function encodeGif(frames, width, height, delay = 12) {
  const colors = palette(frames);
  while (colors.length < 256) colors.push([0, 0, 0]);
  const parts = [];
  const u16 = n => [n & 255, n >> 8];
  parts.push(Buffer.from('GIF89a', 'ascii'));
  parts.push(Buffer.from([...u16(width), ...u16(height), 0xf7, 0, 0]));
  parts.push(Buffer.from(colors.flat()));
  parts.push(Buffer.from([0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0', 'ascii'), 3, 1, 0, 0, 0]));
  for (const [index, frame] of frames.entries()) {
    const hold = Array.isArray(delay) ? delay[index] : delay;
    parts.push(Buffer.from([0x21, 0xf9, 4, 0, ...u16(hold), 0, 0]));
    parts.push(Buffer.from([0x2c, 0, 0, 0, 0, ...u16(width), ...u16(height), 0, 8]));
    parts.push(Buffer.from(lzw(indexFrame(frame, colors), 8)));
  }
  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
}
