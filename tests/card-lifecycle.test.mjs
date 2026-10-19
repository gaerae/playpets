import assert from 'node:assert/strict';
import test from 'node:test';
import { setData } from '../src/core/state.js';
import { setupCard, showCard } from '../src/yard/card.js';
import { setupSound, soundSeen } from '../src/yard/sound.js';
import { element, installDom } from './support/dom.mjs';

// Record scheduled oscillator voices without playing sound or accessing system audio.
let voices = 0;
function audioNode() {
  const node = { connect: target => target, start() {}, stop() {} };
  for (const key of ['gain', 'frequency', 'Q', 'pan', 'threshold', 'knee', 'ratio', 'attack', 'release'])
    node[key] = { value: 0, setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {} };
  return node;
}
class SilentAudio {
  currentTime = 0;
  sampleRate = 10;
  destination = audioNode();
  resume = async () => {};
  suspend = async () => {};
  createGain = audioNode;
  createDynamicsCompressor = audioNode;
  createConvolver = audioNode;
  createBiquadFilter = audioNode;
  createStereoPanner = audioNode;
  createBufferSource = audioNode;
  createOscillator() {
    voices++;
    return audioNode();
  }
  createBuffer(_channels, length) {
    return { duration: length / this.sampleRate, getChannelData: () => new Float32Array(length) };
  }
}
function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(Math, 'random', () => 0.9);
  const { document, nodes } = installDom(t, { ids: ['catch-card'], anyId: true });
  const card = Object.assign(nodes.get('catch-card'), { hidden: true, querySelector: () => element() });
  globalThis.AudioContext = SilentAudio;
  setData({ sound: { on: true, volume: 40 } });
  setupSound();
  document.dispatch('pointerdown');
  setupCard();
  t.after(() => soundSeen(false));
  return { card, dismiss: () => card.dispatch('click') };
}

test('discovery sounds belong only to the current visible card', async t => {
  const { card, dismiss } = setup(t);
  await t.test('dismissal cancels the pending sound', () => {
    const before = voices;
    showCard('', 'Fish', 'New fish', true);
    dismiss();
    t.mock.timers.tick(500);
    assert.equal(card.hidden, true);
    assert.equal(voices, before, 'a dismissed card should not play its delayed sound');
  });
  await t.test('replacement cancels the old sound', () => {
    const before = voices;
    showCard('', 'Fish', 'New fish', true);
    showCard('', 'Flower', 'Already collected', false);
    t.mock.timers.tick(500);
    assert.equal(voices, before, 'the old discovery cue should not play over the replacement');
  });
  await t.test('the current discovery still plays', () => {
    const before = voices;
    showCard('', 'Bug', 'New bug', true);
    t.mock.timers.tick(450);
    assert.ok(voices > before);
  });
});

test('a discovery waits while it is being read and offers a named keyboard close action', async t => {
  const { card } = setup(t);
  const close = element('button');
  card.querySelector = selector => (selector === '.catch-dismiss' ? close : element());
  let reading = true;
  card.matches = () => reading;
  showCard('', 'Fish', 'A discovery', false);
  assert.ok(close.getAttribute('aria-label'));
  assert.equal(typeof close.onclick, 'function');
  t.mock.timers.tick(6000);
  assert.equal(card.hidden, false, 'hover or keyboard focus keeps the card readable');
  reading = false;
  close.onclick();
  assert.equal(card.hidden, true);
});
