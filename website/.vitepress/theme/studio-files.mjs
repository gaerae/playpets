import { animationSpec } from '../../../src/core/animation.js';

export const petStates = ['idle', 'right', 'left', 'wave', 'jump', 'error', 'waiting', 'working', 'done'];
export const studioSeasons = ['spring', 'summer', 'autumn', 'winter'];
const encoder = new TextEncoder();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Stored entries need no compression dependency and retain the exact accepted PNG bytes.
export function studioZip(entries) {
  const names = new Set(),
    chunks = [],
    directory = [];
  let offset = 0;
  for (const { name, bytes } of [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (
      !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(name) ||
      name.split('/').some(p => !p || p === '.' || p === '..') ||
      names.has(name)
    )
      throw Error('path');
    names.add(name);
    const filename = encoder.encode(name),
      data = new Uint8Array(bytes),
      crc = crc32(data);
    const local = new Uint8Array(30),
      l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x800, true);
    l.setUint16(12, 33, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, data.length, true);
    l.setUint32(22, data.length, true);
    l.setUint16(26, filename.length, true);
    chunks.push(local, filename, data);
    const central = new Uint8Array(46),
      c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x800, true);
    c.setUint16(14, 33, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, filename.length, true);
    c.setUint32(42, offset, true);
    directory.push(central, filename);
    offset += local.length + filename.length + data.length;
  }
  const centralSize = directory.reduce((n, bytes) => n + bytes.length, 0);
  const end = new Uint8Array(22),
    e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, names.size, true);
  e.setUint16(10, names.size, true);
  e.setUint32(12, centralSize, true);
  e.setUint32(16, offset, true);
  const result = new Uint8Array(offset + centralSize + end.length);
  let at = 0;
  for (const chunk of [...chunks, ...directory, end]) {
    result.set(chunk, at);
    at += chunk.length;
  }
  return result;
}

export function inspectPng(bytes, kind) {
  const invalid = () => {
    throw Error('png');
  };
  if (bytes.length < 45 || [137, 80, 78, 71, 13, 10, 26, 10].some((v, i) => bytes[i] !== v)) invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width,
    height,
    ended = false,
    data = false;
  for (let at = 8; at < bytes.length; ) {
    if (at + 12 > bytes.length) invalid();
    const length = view.getUint32(at),
      end = at + 12 + length;
    if (end > bytes.length) invalid();
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    if (crc32(bytes.subarray(at + 4, end - 4)) !== view.getUint32(end - 4)) invalid();
    if (at === 8 && type !== 'IHDR') invalid();
    if (type === 'IHDR') {
      if (width || length !== 13) invalid();
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      if (width !== 1536 || height !== (kind === 'pet' ? 2288 : 1024)) throw Error('dimensions');
      if (kind === 'pet' && (bytes[at + 16] !== 8 || bytes[at + 17] !== 6)) throw Error('rgba');
    }
    if (type === 'IDAT') data = true;
    if (type === 'IEND') {
      if (length || end !== bytes.length) invalid();
      ended = true;
    }
    at = end;
  }
  if (!width || !data || !ended) invalid();
  return { width, height };
}

export function inspectSpritePixels(pixels) {
  const empty = [],
    edges = [];
  let transparent = 0;
  for (let row = 0; row < 11; row++) {
    const count = row < 9 ? animationSpec(petStates[row]).frames : 8;
    for (let column = 0; column < count; column++) {
      let visible = 0,
        edge = false;
      for (let y = 0; y < 208; y++)
        for (let x = 0; x < 192; x++) {
          const alpha = pixels[((row * 208 + y) * 1536 + column * 192 + x) * 4 + 3];
          if (alpha === 0) transparent++;
          if (alpha > 24) {
            visible++;
            if (x < 3 || x >= 189 || y < 3 || y >= 205) edge = true;
          }
        }
      if (!visible) empty.push(`${row}:${column}`);
      if (edge) edges.push(`${row}:${column}`);
    }
  }
  return { empty, edges, transparent };
}

export function petPackageEntries(meta, sheets) {
  if (
    !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(meta.id) ||
    !meta.name?.trim() ||
    meta.name.length > 60 ||
    !['person', 'animal', 'other'].includes(meta.kind) ||
    (meta.description || '').length > 300
  )
    throw Error('identity');
  if (!sheets.base) throw Error('base');
  const manifest = {
    id: meta.id,
    displayName: meta.name.trim(),
    kind: meta.kind,
    description: meta.description?.trim() || meta.name.trim(),
    spriteVersionNumber: 2,
    spritesheetPath: 'spritesheet.png',
  };
  const entries = [];
  for (const key of ['base', ...studioSeasons])
    if (sheets[key]) {
      inspectPng(sheets[key], 'pet');
      const name = key === 'base' ? 'spritesheet.png' : `${key}.png`;
      entries.push({ name, bytes: sheets[key] });
      if (key !== 'base') {
        manifest.seasonalSpritesheets ??= {};
        manifest.seasonalSpritesheets[key] = name;
      }
    }
  entries.push({ name: 'pet.json', bytes: encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`) });
  return entries;
}

export function downloadStudioFile(blob, name) {
  const url = URL.createObjectURL(blob),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readStudioImage(file, kind) {
  if (file.size > (kind === 'pet' ? 16 : 6) * 1024 * 1024) throw Error('size');
  const bytes = new Uint8Array(await file.arrayBuffer());
  inspectPng(bytes, kind);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const report = kind === 'pet' ? inspectSpritePixels(pixels) : null;
    if (report && (!report.transparent || report.empty.length)) throw Error(!report.transparent ? 'alpha' : 'empty');
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(new Blob([bytes], { type: 'image/png' }));
    });
    return { bytes, image, report, dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function backgroundPreviewFrame(w, h, floor) {
  const scale = Math.max(w / 1536, h / 1024),
    width = 1536 * scale,
    height = 1024 * scale;
  return { x: (w - width) / 2, y: (h - height) * floor, width, height };
}

// Validated embedded URLs are ASCII without JSON escapes; typing a name need not copy megabytes.
export function backgroundPackageSize(pack) {
  const images = Object.fromEntries(Object.keys(pack.images).map(key => [key, '']));
  return (
    encoder.encode(JSON.stringify({ ...pack, images })).length +
    Object.values(pack.images).reduce((sum, data) => sum + data.length, 0)
  );
}
