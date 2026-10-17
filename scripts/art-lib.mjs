// Drawing helpers shared by the scripts that paint pictures in a browser page (share cards, the
// README banner, installer art, atlas packing). Pure apart from reading the source pictures.
import { readFile } from 'node:fs/promises';
import { crc32 } from 'node:zlib';

/** Picture bytes as a data URL, the form a drawing page loads them in. */
export const dataUrl = (bytes, type = 'image/png') => `data:${type};base64,${bytes.toString('base64')}`;

/** A picture file as a data URL. */
export const readDataUrl = async (file, type = 'image/png') => dataUrl(await readFile(file), type);

/** The bytes of a data URL a page made (canvas.toDataURL). */
export const dataUrlBytes = url => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');

/** The bundled sheets as data URLs, keyed by pet id. */
export async function loadSheets() {
  return Object.fromEntries(
    await Promise.all(brandCast(1).map(async ({ id }) => [id, await readDataUrl(`assets/pets/${id}/spritesheet.png`)])),
  );
}

/** Sunny summer scenery shared by installation and link artwork. */
export const loadEnvironment = () => readDataUrl('src/art/environments/green.png');

/** One cell of a sheet as an element with the sheet as background. row/col follow src/core/animation.js. */
export const cell = (sheets, id, row, col, scale) =>
  `<i style="display:block;width:${192 * scale}px;height:${208 * scale}px;background:url(${sheets[id]}) ${-col * 192 * scale}px ${-row * 208 * scale}px / ${1536 * scale}px ${2288 * scale}px no-repeat"></i>`;

// Approved idle silhouettes have different transparent headroom. Scale the visible figures,
// then remove their ten-pixel bottom gutter so every friend stands on the same ground line.
export const brandCast = targetHeight =>
  [
    ['daisy', 163],
    ['clover', 168],
    ['pip', 164],
    ['miso', 163],
  ].map(([id, height]) => ({
    id,
    height,
    scale: targetHeight / height,
    bottom: (-10 * targetHeight) / height,
  }));

// Fit the full cast into small native installer slots without clipping a fourth friend.
export function fittedCastHeight(width, desiredHeight, gap = 0) {
  if (!(width > 0) || !(desiredHeight > 0) || !Number.isFinite(width + desiredHeight + gap) || gap < 0)
    throw new Error('Invalid cast area');
  const cast = brandCast(1);
  const available = width - gap * (cast.length - 1);
  if (available <= 0) throw new Error('Invalid cast area');
  return Math.min(desiredHeight, available / cast.reduce((sum, pet) => sum + 192 * pet.scale, 0));
}

export const castMarkup = (sheets, height) =>
  brandCast(height)
    .map(
      pet =>
        `<span data-companion="${pet.id}" style="position:relative;display:block;width:${192 * pet.scale}px;height:${height}px"><span style="position:absolute;left:0;bottom:${pet.bottom}px">${cell(sheets, pet.id, 0, 0, pet.scale)}</span></span>`,
    )
    .join('');

/**
 * The same PNG marked with a resolution (a pHYs chunk right after the header), so macOS shows a
 * picture drawn at twice the size as a sharp 1× picture: 144 dpi means two pixels per point.
 */
export function withDpi(png, dpi) {
  const perMeter = Math.round(dpi / 0.0254);
  const data = Buffer.alloc(9);
  data.writeUInt32BE(perMeter, 0);
  data.writeUInt32BE(perMeter, 4);
  data[8] = 1;
  const type = Buffer.from('pHYs');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  type.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([type, data])), 8 + data.length);
  // Signature (8) + IHDR chunk (4 length + 4 type + 13 data + 4 crc).
  const end = 8 + 25;
  return Buffer.concat([png.subarray(0, end), chunk, png.subarray(end)]);
}

/** A 24-bit bottom-up BMP from RGBA pixels (NSIS installer pictures accept only BMP). */
export function bmp(rgba, width, height) {
  const row = Math.ceil((width * 3) / 4) * 4;
  const size = 54 + row * height;
  const out = Buffer.alloc(size);
  out.write('BM', 0, 'ascii');
  out.writeUInt32LE(size, 2);
  out.writeUInt32LE(54, 10);
  out.writeUInt32LE(40, 14);
  out.writeInt32LE(width, 18);
  out.writeInt32LE(height, 22);
  out.writeUInt16LE(1, 26);
  out.writeUInt16LE(24, 28);
  out.writeUInt32LE(row * height, 34);
  out.writeInt32LE(2835, 38);
  out.writeInt32LE(2835, 42);
  for (let y = 0; y < height; y++) {
    const at = 54 + (height - 1 - y) * row;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      out[at + x * 3] = rgba[i + 2];
      out[at + x * 3 + 1] = rgba[i + 1];
      out[at + x * 3 + 2] = rgba[i];
    }
  }
  return out;
}
