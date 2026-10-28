// A self-contained Codex pet (a transparent 1536x1872 v1 sheet) in <codexHome>/pets/e2e-fixture,
// so the e2e run and the CPU measurement never depend on the pets on this computer. The same pet
// also comes as a ZIP, packed as Finder packs a folder, for the ZIP import.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

function fixtureSheet() {
  const [width, height] = [1536, 1872];
  const crc = buf => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const pixels = zlib.deflateSync(Buffer.alloc((width * 4 + 1) * height));
  const png = Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', ihdr),
    chunk('IDAT', pixels),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}

function manifest(id, displayName) {
  return JSON.stringify({
    id,
    displayName,
    kind: 'animal',
    description: 'A test kitten.',
    spriteVersionNumber: 1,
    spritesheetPath: 'spritesheet.png',
  });
}

export async function writeFixturePet(codexHome) {
  const folder = path.join(codexHome, 'pets', 'e2e-fixture');
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'spritesheet.png'), fixtureSheet());
  await writeFile(path.join(folder, 'pet.json'), manifest('e2e-fixture', 'Fixture'));
}

/** The fixture pet as `<id>/pet.json` and `<id>/spritesheet.png`, deflated, with macOS's clutter beside it. */
export async function writeFixtureZip(file, id = 'e2e-zip') {
  const entries = [
    [`${id}/`, Buffer.alloc(0)],
    [`${id}/pet.json`, Buffer.from(manifest(id, 'Zipped'))],
    [`${id}/spritesheet.png`, fixtureSheet()],
    [`__MACOSX/${id}/._pet.json`, Buffer.from('fork')],
  ];
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const packed = zlib.deflateRawSync(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(8, 8);
    head.writeUInt32LE(zlib.crc32(data), 14);
    head.writeUInt32LE(packed.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(Buffer.byteLength(name), 26);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    head.copy(dir, 10, 8, 30);
    dir.writeUInt32LE(offset, 42);
    const local = Buffer.concat([head, Buffer.from(name), packed]);
    locals.push(local);
    central.push(Buffer.concat([dir, Buffer.from(name)]));
    offset += local.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  await writeFile(file, Buffer.concat([...locals, directory, end]));
}
