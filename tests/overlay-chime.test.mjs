// The desktop's ring (src/overlay/chime.js): the audio rests a moment after a ring, and a ring
// in that moment keeps it awake to the end. It rings with the cues alone (createCueVoice in
// src/yard/soundscape.js), not the yard's calls, and each cue sounds as it does in the yard.
import assert from 'node:assert/strict';
import test from 'node:test';
import { catalog } from './support/content.mjs';

const PARAMS = ['gain', 'frequency', 'Q', 'pan', 'threshold', 'knee', 'ratio', 'attack', 'release'];
const described = value => (typeof value === 'function' ? 'function' : (value?.seconds ?? value));

// A fake context that records every node it makes and everything done to it, in order.
function param(log, name) {
  let value = 0;
  const call =
    method =>
    (...args) =>
      log.push([name, method, ...args]);
  return {
    get value() {
      return value;
    },
    set value(next) {
      value = next;
      log.push([name, '=', next]);
    },
    setValueAtTime: call('setValueAtTime'),
    setTargetAtTime: call('setTargetAtTime'),
    exponentialRampToValueAtTime: call('exponentialRampToValueAtTime'),
  };
}
function audioNode(ctx, kind) {
  const log = [];
  const node = {
    kind,
    log,
    connect(target) {
      log.push(['connect', target.kind]);
      return target;
    },
    start(...args) {
      log.push(['start', ...args]);
      node.started = true;
    },
    stop(...args) {
      log.push(['stop', ...args]);
      node.stopped = true;
    },
  };
  for (const key of PARAMS) node[key] = param(log, key);
  const recorded = new Proxy(node, {
    set(target, key, value) {
      log.push([key, '=', described(value)]);
      target[key] = value;
      return true;
    },
  });
  ctx.made.push(recorded);
  return recorded;
}
let suspended = 0;
const contexts = [];
class FakeAudio {
  made = [];
  currentTime = 0;
  sampleRate = 10;
  destination = audioNode(this, 'destination');
  constructor() {
    contexts.push(this);
  }
  resume = async () => {};
  suspend = async () => {
    suspended++;
  };
  createGain = () => audioNode(this, 'gain');
  createDynamicsCompressor = () => audioNode(this, 'compressor');
  createConvolver = () => audioNode(this, 'convolver');
  createBiquadFilter = () => audioNode(this, 'filter');
  createStereoPanner = () => audioNode(this, 'panner');
  createBufferSource = () => audioNode(this, 'bufferSource');
  createOscillator = () => audioNode(this, 'oscillator');
  createBuffer(_channels, length) {
    const buffer = { kind: 'buffer', seconds: length / this.sampleRate, duration: length / this.sampleRate };
    buffer.getChannelData = () => new Float32Array(length);
    this.made.push(buffer);
    return buffer;
  }
}
const ofKind = (ctx, kind) => ctx.made.filter(node => node.kind === kind);
const bufferSeconds = ctx => ofKind(ctx, 'buffer').reduce((sum, buffer) => sum + buffer.seconds, 0);

// Every cue a poke on the desktop rings (poke.js): a gift's chime and a find's own "poke" cue.
const deskCues = [
  'chime',
  ...new Set(
    Object.values(catalog)
      .filter(Array.isArray)
      .flat()
      .map(kind => kind?.poke?.cue)
      .filter(Boolean),
  ),
];

// The chime's own context is the first one made: these tests come before any that make their own.
test('a ring while the audio is going to rest is not cut off', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  globalThis.AudioContext = FakeAudio;
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

test('the desktop rings with the cues alone, and nothing runs on after them', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  globalThis.AudioContext = FakeAudio;
  t.after(() => delete globalThis.AudioContext);
  const { ring } = await import('../src/overlay/chime.js');
  for (const cue of deskCues) ring({ on: true, volume: 40 }, cue);
  t.mock.timers.tick(3200);
  const [ctx] = contexts;
  assert.ok(ctx, 'the chime made its context');
  assert.deepEqual(
    ofKind(ctx, 'bufferSource').filter(source => source.loop),
    [],
    'no loops',
  );
  assert.deepEqual(
    ofKind(ctx, 'oscillator').filter(o => o.started && !o.stopped),
    [],
    'no wobble runs on',
  );
  assert.ok(ofKind(ctx, 'convolver').length <= 1, 'one room at most, for the tines to ring in');
  // White noise for a hiss (1 s) and the room's air (1.6 s), nothing more.
  assert.ok(bufferSeconds(ctx) <= 2.6 + 1e-9, `${bufferSeconds(ctx)} s of buffers`);
});

test('a cue voice makes nothing until a cue needs it, and every desktop cue sounds as in the yard', async t => {
  const { createCueVoice, createSoundscape } = await import('../src/yard/soundscape.js');
  t.mock.method(Math, 'random', () => 0.5);
  const quiet = new FakeAudio();
  createCueVoice(quiet, quiet.destination);
  assert.equal(bufferSeconds(quiet), 0, 'no noise and no room before a ring');
  assert.equal(ofKind(quiet, 'convolver').length, 0);

  const yardCtx = new FakeAudio(),
    deskCtx = new FakeAudio();
  const yard = createSoundscape(yardCtx, yardCtx.destination),
    desk = createCueVoice(deskCtx, deskCtx.destination);
  // Once rung, the room and the noise are there, so the next ring is the cue alone.
  for (const cue of deskCues) {
    yard.cue(cue);
    desk.cue(cue);
  }
  const heard = (ctx, voice, cue) => {
    const from = ctx.made.length;
    voice.cue(cue);
    return ctx.made.slice(from).map(node => [node.kind, ...node.log]);
  };
  assert.ok(deskCues.length >= 2, `desktop cues: ${deskCues}`);
  for (const cue of deskCues) {
    const voices = heard(deskCtx, desk, cue);
    assert.ok(
      voices.some(([kind, ...log]) => kind !== 'buffer' && log.some(([step]) => step === 'start')),
      `${cue} plays`,
    );
    assert.deepEqual(voices, heard(yardCtx, yard, cue), `${cue} sounds as in the yard`);
  }
  // The voice's way out is the yard's: a gain into a limiter into the destination.
  assert.deepEqual(
    ofKind(deskCtx, 'compressor').map(node => node.log.filter(([step]) => step === 'connect')),
    [[['connect', 'destination']]],
  );
});
