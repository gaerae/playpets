import { crc32, inflateSync } from 'node:zlib';
import { unfilterPng } from './png-lossless-lib.mjs';

export { crc32 };

// Fixed dates, sorted names and stored entries make byte-for-byte repeatable archives on every OS.
export function zipStore(entries) {
  const names = new Set(),
    chunks = [],
    directory = [];
  let offset = 0;
  for (const { name, bytes } of [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (
      (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(name) && name !== '.claude-plugin/plugin.json') ||
      name.split('/').some(part => !part || part === '.' || part === '..') ||
      names.has(name)
    )
      throw new Error(`Unsafe or duplicate ZIP path: ${name}`);
    names.add(name);
    const filename = Buffer.from(name),
      data = Buffer.from(bytes),
      crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(33, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    chunks.push(local, filename, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(central, filename);
    offset += local.length + filename.length + data.length;
  }
  const central = Buffer.concat(directory),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(names.size, 8);
  end.writeUInt16LE(names.size, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, central, end]);
}

// Decode only the RGB/RGBA PNG formats used by the accepted production/reference artwork.
export function validatePng(bytes, { canonical = false } = {}) {
  const fail = () => {
    throw new Error('Invalid creator PNG');
  };
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) fail();
  let width,
    height,
    channels,
    ended = false;
  const compressed = [];
  for (let at = 8; at < bytes.length; ) {
    if (at + 12 > bytes.length) fail();
    const size = bytes.readUInt32BE(at),
      type = bytes.toString('ascii', at + 4, at + 8),
      end = at + 12 + size;
    if (end > bytes.length || crc32(bytes.subarray(at + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) fail();
    const data = bytes.subarray(at + 8, end - 4);
    if (type === 'IHDR') {
      if (width || size !== 13 || at !== 8) fail();
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      channels = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 0;
      if (
        !width ||
        !height ||
        width > 4096 ||
        height > 4096 ||
        data[8] !== 8 ||
        !channels ||
        data[10] ||
        data[11] ||
        data[12]
      )
        fail();
    } else if (type === 'IDAT') compressed.push(data);
    else if (type === 'IEND') {
      if (size || end !== bytes.length) fail();
      ended = true;
    }
    at = end;
  }
  if (!width || !ended || !compressed.length || (canonical && (width !== 1536 || height !== 2288 || channels !== 4)))
    fail();
  const stride = width * channels,
    expected = (stride + 1) * height;
  const raw = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected });
  if (raw.length !== expected) fail();
  const pixels = unfilterPng(raw, width, height, channels, fail);
  let transparent = 0,
    opaque = 0;
  const colors = new Set();
  for (let i = 0; i < pixels.length; i += channels) {
    const alpha = channels === 4 ? pixels[i + 3] : 255;
    if (!alpha) transparent++;
    else {
      opaque++;
      if (colors.size < 32) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    }
  }
  if (colors.size < 16 || opaque < width * height * 0.01 || (canonical && transparent < width * height * 0.01)) fail();
  return { width, height, transparent, opaque };
}

export function publicProvenance(text) {
  return text.replace(/(?:\/(?:Users|home)\/|[A-Z]:\\Users\\)[^\s`"']+/g, value => {
    const path = value.replaceAll('\\', '/');
    const relative = path.match(/(?:^|\/)((?:assets|release)\/.*)$/);
    return relative ? relative[1] : path.split('/').at(-1);
  });
}
