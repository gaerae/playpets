// A self-contained Codex pet (a transparent 1536x1872 v1 sheet) in <codexHome>/pets/e2e-fixture,
// so the e2e run and the CPU measurement never depend on the pets on this computer.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

export async function writeFixturePet(codexHome) {
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
  const folder = path.join(codexHome, 'pets', 'e2e-fixture');
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'spritesheet.png'), png);
  await writeFile(
    path.join(folder, 'pet.json'),
    JSON.stringify({
      id: 'e2e-fixture',
      displayName: 'Fixture',
      kind: 'animal',
      description: 'A test kitten.',
      spriteVersionNumber: 1,
      spritesheetPath: 'spritesheet.png',
    }),
  );
}
