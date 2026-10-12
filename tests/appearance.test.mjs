import assert from 'node:assert/strict';
import test from 'node:test';
import { styledAsset } from '../src/core/appearance.js';

test('appearance selection keeps identity and uses the realistic baseline for missing seasons', () => {
  const raw = {
    id: 'a',
    spriteUrl: 'toon',
    seasonalSpriteUrls: { summer: 'toon-summer' },
    realisticSpriteUrls: { default: 'real', winter: 'real-winter' },
    realisticPortraitUrl: 'portrait',
  };
  assert.equal(styledAsset(raw, 'illustrated'), raw);
  assert.equal(styledAsset(raw, 'unknown'), raw);
  const real = styledAsset(raw, 'realistic');
  assert.equal(real.id, raw.id);
  assert.equal(real.spriteUrl, 'real');
  assert.deepEqual(real.seasonalSpriteUrls, { winter: 'real-winter' });
  assert.equal(real.portraitUrl, 'portrait');
  assert.equal(raw.spriteUrl, 'toon', 'the shared catalog is never mutated for another friend');
});

test('missing or incomplete realistic art leaves a compatible pet unchanged', () => {
  const raw = { id: 'b', spriteUrl: 'toon', realisticSpriteUrls: { winter: 'winter-only' } };
  assert.equal(styledAsset(raw, 'realistic'), raw);
  assert.equal(styledAsset(undefined, 'realistic'), undefined);
});
