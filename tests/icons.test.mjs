// macOS Dock icon contract: Apple's icon grid keeps artwork inside ~824px of
// the 1024px canvas. A full-bleed icns looks oversized next to other Dock
// icons, so the packed icns must keep a transparent margin on every side.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import zlib from 'node:zlib';

function icnsEntry(buf, wanted) {
  assert.equal(buf.toString('ascii', 0, 4), 'icns', 'src-tauri/icons/icon.icns is an icns file');
  let pos = 8;
  while (pos < buf.length) {
    const type = buf.toString('ascii', pos, pos + 4);
    const len = buf.readUInt32BE(pos + 4);
    if (type === wanted) return buf.subarray(pos + 8, pos + len);
    pos += len;
  }
  return null;
}

function decodePng(buf) {
  assert.equal(buf.readUInt32BE(0), 0x89504e47, 'entry is PNG-encoded');
  let pos = 8,
    width = 0,
    height = 0,
    bitDepth = 0,
    colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  assert.equal(bitDepth, 8);
  assert.equal(colorType, 6, 'RGBA png');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4,
    stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c,
          pa = Math.abs(p - a),
          pb = Math.abs(p - b),
          pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 255;
    }
  }
  return { width, height, pixels: out };
}

test('icns keeps the Apple icon-grid transparent margin on every side', async () => {
  const icns = await readFile('src-tauri/icons/icon.icns');
  const entry = icnsEntry(icns, 'ic10');
  assert.ok(entry, 'icns contains the 1024px (ic10) entry');
  const { width, height, pixels } = decodePng(entry);
  assert.equal(width, 1024);
  assert.equal(height, 1024);
  const margin = Math.round(width * 0.06); // fix targets ~9.8%; 6% catches regressions
  const alpha = (x, y) => pixels[(y * width + x) * 4 + 3];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const inBand = x < margin || x >= width - margin || y < margin || y >= height - margin;
      if (inBand && alpha(x, y) !== 0)
        assert.fail(`opaque pixel inside the margin band at ${x},${y} — Dock icon will render oversized`);
    }
});

test('the tray retains the same colored Clover face on every platform', async () => {
  const tray = await readFile('src-tauri/src/tray.rs', 'utf8');
  assert.match(tray, /include_bytes!\("\.\.\/icons\/tray\.png"\)/);
  assert.match(tray, /icon_as_template\(false\)/);
  assert.doesNotMatch(tray, /tray-template|template_pixels|set_icon_as_template\(true\)/);
  const { width, height, pixels } = decodePng(await readFile('src-tauri/icons/tray.png'));
  assert.equal(width, 32);
  assert.equal(height, 32);
  assert.ok([...pixels].some((_, i) => i % 4 === 0 && pixels[i + 3] > 0 && pixels[i] !== pixels[i + 1]));
  const renderer = await readFile('scripts/make-icons.mjs', 'utf8');
  assert.match(renderer, /'tray.png'\), await readFile\(full\[32\]\)/);
  assert.doesNotMatch(renderer, /tray-template|tray\.svg/);
});

test('the macOS icon sits on its own rounded plate, so the system adds no grey one', async () => {
  const { width, pixels } = decodePng(icnsEntry(await readFile('src-tauri/icons/icon.icns'), 'ic10'));
  const alpha = (x, y) => pixels[(y * width + x) * 4 + 3];
  for (const [x, y] of [
    [512, 108],
    [108, 512],
    [916, 512],
    [512, 916],
  ])
    assert.equal(alpha(x, y), 255, `the plate is solid at its edge (${x},${y})`);
  for (const [x, y] of [
    [106, 106],
    [918, 106],
    [106, 918],
    [918, 918],
  ])
    assert.equal(alpha(x, y), 0, `the plate's corner is rounded away (${x},${y})`);
});
