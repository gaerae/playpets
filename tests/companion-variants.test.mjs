import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manifest = async id => JSON.parse(await readFile(`assets/pets/${id}/pet.json`, 'utf8'));
const dimensions = async path => {
  const png = await readFile(path);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', path);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
};

test('five companions expose complete summer and winter animation sheets', async () => {
  for (const id of ['daisy', 'clover', 'pip', 'aria', 'noah']) {
    const pet = await manifest(id);
    assert.deepEqual(Object.keys(pet.seasonalSpritesheets).sort(), ['summer', 'winter'], id);
    for (const file of Object.values(pet.seasonalSpritesheets))
      assert.deepEqual(await dimensions(`assets/pets/${id}/${file}`), [1536, 2288], `${id}/${file}`);
  }
});

test('both adult companions expose realistic moving wardrobes and a separate face portrait', async () => {
  for (const id of ['aria', 'noah']) {
    const pet = await manifest(id);
    assert.equal(pet.kind, 'person');
    assert.match(pet.description, /fictional adult/);
    assert.deepEqual(Object.keys(pet.realisticSpritesheets || {}).sort(), ['default', 'summer', 'winter'], id);
    for (const file of Object.values(pet.realisticSpritesheets))
      assert.deepEqual(await dimensions(`assets/pets/${id}/${file}`), [1536, 2288], `${id}/${file}`);
    const [width, height] = await dimensions(`assets/pets/${id}/${pet.realisticPortraitPath}`);
    assert.equal(width, height, id);
    assert.ok(width >= 512 && width <= 4096, id);
  }
});
