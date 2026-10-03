// Messages name the friend they are about, so the particle after the name must fit it.
import assert from 'node:assert/strict';
import test from 'node:test';
import { withParticle } from '../src/core/words.js';

test('Hangul names take the particle their last syllable asks for', () => {
  assert.equal(withParticle('흰둥이', '을/를'), '흰둥이를');
  assert.equal(withParticle('프리렌', '을/를'), '프리렌을');
  assert.equal(withParticle('맹구', '과/와'), '맹구와');
  assert.equal(withParticle('프리렌', '과/와'), '프리렌과');
  assert.equal(withParticle('프리렌', '이/가'), '프리렌이');
});

test('names ending in a digit or a Latin letter are read aloud', () => {
  assert.equal(withParticle('Frieren 2', '을/를'), 'Frieren 2를', '2 is 이');
  assert.equal(withParticle('흰둥이 3', '을/를'), '흰둥이 3을', '3 is 삼');
  assert.equal(withParticle('white', '을/를'), 'white를');
  assert.equal(withParticle('Frieren', '을/를'), 'Frieren을');
  assert.equal(withParticle('Claude Code · sonnet', '을/를'), 'Claude Code · sonnet을');
});

test('the particle follows the last letter, past punctuation, brackets and emoji, and kana are read', () => {
  assert.equal(withParticle('프리렌!', '을/를'), '프리렌!을');
  assert.equal(withParticle('Claude Code (sonnet)', '을/를'), 'Claude Code (sonnet)을');
  assert.equal(withParticle('모찌🍡', '은/는'), '모찌🍡는');
  assert.equal(withParticle('타비', '은/는'), '타비는');
  assert.equal(withParticle('프리렌', '은/는'), '프리렌은');
  assert.equal(withParticle('タビ', '이/가'), 'タビ가');
  assert.equal(withParticle('みかん', '이/가'), 'みかん이');
  assert.equal(withParticle('', '을/를'), '를');
});
