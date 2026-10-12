// Inventory evidence supplements visual review; a valid file alone does not prove good artwork.
import { createHash } from 'node:crypto';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const EXTENSIONS = new Set(['png', 'svg', 'gif', 'webp', 'jpg', 'jpeg', 'bmp', 'ico', 'icns']);
export function imageSize(bytes, extension) {
  switch (extension) {
    case 'png':
      return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    case 'gif':
      return [bytes.readUInt16LE(6), bytes.readUInt16LE(8)];
    case 'bmp':
      return [Math.abs(bytes.readInt32LE(18)), Math.abs(bytes.readInt32LE(22))];
    case 'svg': {
      const text = bytes.toString(),
        box = text
          .match(/viewBox=["']([^"']+)["']/)?.[1]
          .trim()
          .split(/[ ,]+/)
          .map(Number);
      return box
        ? box.slice(2)
        : [Number(text.match(/\bwidth=["']([\d.]+)/)?.[1]), Number(text.match(/\bheight=["']([\d.]+)/)?.[1])];
    }
    case 'ico': {
      const count = bytes.readUInt16LE(4),
        sizes = [];
      for (let i = 0; i < count; i++) sizes.push([bytes[6 + i * 16] || 256, bytes[7 + i * 16] || 256]);
      return sizes.sort((a, b) => b[0] - a[0])[0];
    }
    case 'icns': {
      const dimensions = {
        icp4: 16,
        icp5: 32,
        icp6: 64,
        ic07: 128,
        ic08: 256,
        ic09: 512,
        ic10: 1024,
        ic11: 32,
        ic12: 64,
        ic13: 256,
        ic14: 512,
      };
      let offset = 8,
        largest = 0;
      while (offset + 8 <= bytes.length) {
        largest = Math.max(largest, dimensions[bytes.toString('ascii', offset, offset + 4)] || 0);
        const length = bytes.readUInt32BE(offset + 4);
        if (length < 8) throw new Error('Invalid ICNS chunk');
        offset += length;
      }
      return [largest, largest];
    }
    case 'webp': {
      const kind = bytes.toString('ascii', 12, 16);
      if (kind === 'VP8X') return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1];
      if (kind === 'VP8L') {
        const bits = bytes.readUInt32LE(21);
        return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
      }
      return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
    }
    case 'jpg':
    case 'jpeg': {
      let offset = 2;
      while (offset + 4 < bytes.length) {
        if (bytes[offset++] !== 0xff) continue;
        while (bytes[offset] === 0xff) offset++;
        const marker = bytes[offset++];
        if (marker === 0xd9 || marker === 0xda) break;
        const length = bytes.readUInt16BE(offset);
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker))
          return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
        if (length < 2) break;
        offset += length;
      }
      break;
    }
  }
  throw new Error(`Unsupported image data: ${extension}`);
}
async function imagesIn(folder) {
  let entries;
  try {
    entries = await readdir(folder, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const found = await Promise.all(
    entries.map(entry => {
      const file = path.join(folder, entry.name);
      return entry.isDirectory()
        ? imagesIn(file)
        : entry.isFile() && EXTENSIONS.has(path.extname(file).slice(1).toLowerCase())
          ? [file]
          : [];
    }),
  );
  return found.flat();
}
export async function inventoryAssets(root = '.') {
  const folders = ['assets', 'src', 'src-tauri/icons', 'packaging/macos', 'packaging/windows', 'website/public'];
  const files = (await Promise.all(folders.map(folder => imagesIn(path.join(root, folder))))).flat().sort();
  return Promise.all(
    files.map(async file => {
      const bytes = await readFile(file),
        extension = path.extname(file).slice(1).toLowerCase(),
        relative = path.relative(root, file).split(path.sep).join('/');
      const [width, height] = imageSize(bytes, extension),
        missingReferences = [];
      if (extension === 'svg') {
        for (const [, href] of bytes.toString().matchAll(/<image\b[^>]*\b(?:xlink:)?href=["']([^"']+)["']/g)) {
          if (href.startsWith('data:')) continue;
          const target = href.startsWith('art/')
            ? path.join(root, 'src', href)
            : path.resolve(path.dirname(file), href);
          try {
            await access(target);
          } catch {
            missingReferences.push(href);
          }
        }
      }
      const source =
        /^(assets\/(concepts|creator-kit)\/)|\/(source-rows|sources|reference)\/|-(source|reference)\./.test(
          relative,
        ) || relative === 'assets/mascot.svg';
      return {
        path: relative,
        role: source
          ? 'reference'
          : relative === 'src/logo.svg' ||
              relative.startsWith('website/public/') ||
              relative.startsWith('src-tauri/icons/') ||
              relative.startsWith('packaging/')
            ? 'derived'
            : 'runtime',
        format: extension,
        width,
        height,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        missingReferences,
      };
    }),
  );
}
