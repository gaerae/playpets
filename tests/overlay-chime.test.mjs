// The desktop's ring (src/overlay/chime.js): the audio rests a moment after a ring, and a ring
// in that moment keeps it awake to the end.
import assert from 'node:assert/strict';
import test from 'node:test';

function audioNode() {
  const node = { connect: target => target, start() {}, stop() {} };
  for (const key of ['gain', 'frequency', 'Q', 'pan', 'threshold', 'knee', 'ratio', 'attack', 'release'])
    node[key] = { value: 0, setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {} };
  return node;
}
let suspended = 0;
class SilentAudio {
  currentTime = 0;
  sampleRate = 10;
  destination = audioNode();
  resume = async () => {};
  suspend = async () => {
    suspended++;
  };
  createGain = audioNode;
  createDynamicsCompressor = audioNode;
  createConvolver = audioNode;
  createBiquadFilter = audioNode;
  createStereoPanner = audioNode;
  createBufferSource = audioNode;
  createOscillator = audioNode;
  createBuffer(_channels, length) {
    return { duration: length / this.sampleRate, getChannelData: () => new Float32Array(length) };
  }
}

test('a ring while the audio is going to rest is not cut off', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  globalThis.AudioContext = SilentAudio;
  t.after(() => delete globalThis.AudioContext);
  const { ring } = await import('../src/overlay/chime.js');
  const sound = { on: true, volume: 40 };
  ring(sound);
  t.mock.timers.tick(2600);
  ring(sound);
  t.mock.timers.tick(700);
  assert.equal(suspended, 0, 'the second ring plays to its end');
  t.mock.timers.tick(2500);
  t.mock.timers.tick(600);
  assert.equal(suspended, 1, 'and the audio rests after it');
});
