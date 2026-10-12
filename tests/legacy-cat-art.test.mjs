import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validatePng } from '../scripts/creator-bundle-lib.mjs';

const names = ['idle', 'right', 'left', 'wave', 'jump', 'error', 'waiting', 'working', 'done', 'look', 'look'];

for (const id of ['tabby', 'smoky', 'mochi']) {
  test(`${id} retains its canonical identity and complete reproducible sculpted source rows`, async () => {
    const root = `assets/pets/${id}`;
    const pet = JSON.parse(await readFile(`${root}/pet.json`, 'utf8'));
    assert.equal(pet.id, `playpets-${id}`);
    assert.equal(pet.spriteVersionNumber, 2);
    assert.equal(pet.spritesheetPath, 'spritesheet.png');
    assert.doesNotMatch(pet.description, /PlayPets mascot/);
    const sheet = await readFile(`${root}/spritesheet.png`);
    validatePng(sheet, { canonical: true });
    const provenance = JSON.parse(await readFile(`${root}/ART-SOURCES.json`, 'utf8'));
    assert.equal(provenance.targetIdleHeight, 150);
    assert.equal(provenance.sha256, createHash('sha256').update(sheet).digest('hex'));
    assert.equal(provenance.rows.length, 11);
    for (const [row, source] of provenance.rows.entries()) {
      assert.equal(source.file, `source-rows/${String(row).padStart(2, '0')}-${names[row]}.png`);
      const png = await readFile(`${root}/${source.file}`);
      assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1536, 1024]);
      assert.equal(source.sha256, createHash('sha256').update(png).digest('hex'));
      assert.ok((await readFile(`${root}/${source.prompt}`, 'utf8')).includes('Built-in image_gen output:'));
      if (source.normalization) {
        const original = await readFile(`${root}/${source.original}`);
        const audit = JSON.parse(await readFile(`${root}/${source.normalization}`, 'utf8'));
        assert.equal(source.originalSha256, createHash('sha256').update(original).digest('hex'));
        assert.equal(audit.sourceSha256, source.originalSha256);
        assert.equal(audit.normalizedSha256, source.sha256);
        assert.equal(audit.poses.length, 8);
        assert.ok(audit.poses.every(pose => pose.dy === 0 && Number.isInteger(pose.dx)));
      }
    }
  });
}
