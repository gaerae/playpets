import assert from 'node:assert/strict';
import test from 'node:test';
import { createSoundscape } from '../src/yard/soundscape.js';

function audio() {
  const sources = [];
  const parameter = () => ({
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
  });
  const node = () => ({
    gain: parameter(),
    frequency: parameter(),
    Q: parameter(),
    pan: parameter(),
    threshold: parameter(),
    knee: parameter(),
    ratio: parameter(),
    attack: parameter(),
    release: parameter(),
    connect(next) {
      return next;
    },
  });
  const source = () => {
    const result = {
      ...node(),
      loop: false,
      stops: [],
      starts: [],
      start(at) {
        this.starts.push(at);
      },
      stop(at) {
        this.stops.push(at);
      },
    };
    sources.push(result);
    return result;
  };
  const ctx = {
    currentTime: 10,
    sampleRate: 100,
    createGain: node,
    createDynamicsCompressor: node,
    createConvolver: node,
    createBiquadFilter: node,
    createStereoPanner: node,
    createOscillator: source,
    createBufferSource: source,
    createBuffer: (_channels, length) => ({ getChannelData: () => new Float32Array(length), duration: 6 }),
  };
  return { ctx, sources, scape: createSoundscape(ctx, node()) };
}

test('entering a silent scene cancels already scheduled wildlife while preserving activity cues', () => {
  const { ctx, sources, scape } = audio();
  scape.setMix({ birds: 8, crickets: 1, indoors: false });
  const first = sources.length;
  scape.bird('dove', 11, 0, 0.5);
  scape.crickets(12, 0);
  scape.frog(12, 0);
  scape.cicada(12, 0);
  scape.geese(12);
  scape.drop(11, 0.04);
  const wildlife = sources.slice(first);
  scape.cue('pat');
  scape.plip();
  scape.splash();
  const cues = sources.slice(first + wildlife.length);
  const stops = cues.map(source => [...source.stops]);
  scape.setMix({ birds: 0, cicadas: 0, geese: 0, frogs: 0, crickets: 0, drops: 0, indoors: false });
  assert.ok(wildlife.length > 0);
  for (const source of wildlife) assert.equal(source.stops.at(-1), ctx.currentTime);
  assert.deepEqual(
    cues.map(source => source.stops),
    stops,
    'indoor activity cues keep playing',
  );
});

test('a shell bursts with a thump and crackles after it, and a quiet scene does not cut it short', () => {
  const { sources, scape } = audio();
  const first = sources.length;
  scape.boom(20, -0.4, 1);
  const voices = sources.slice(first);
  assert.ok(voices.length >= 4);
  assert.ok(voices.every(source => source.starts[0] >= 20));
  assert.ok(
    voices.some(source => source.starts[0] > 20.3),
    'crackles come after the thump',
  );
  const stops = voices.map(source => [...source.stops]);
  scape.setMix({ birds: 0, cicadas: 0, geese: 0, frogs: 0, crickets: 0, drops: 0, indoors: false });
  assert.deepEqual(
    voices.map(source => source.stops),
    stops,
  );
});

// A perfume bottle poked on the desktop (find-out.js pokeOf) sprays: one soft hiss of noise, no tune.
test('a perfume bottle sprays once', () => {
  const { sources, scape } = audio();
  const before = sources.length;
  scape.cue('spritz');
  assert.equal(sources.length - before, 1);
});

// The breeze, the leaves, the lake and the rain looped noise without end; the yard plays nothing
// until a call or a cue comes.
test('the yard starts nothing that runs on its own', () => {
  const { sources } = audio();
  assert.deepEqual(
    sources.filter(source => source.loop || (source.starts.length && !source.stops.length)),
    [],
    'no loop and no wobble',
  );
});

// Each call is a few seconds at most, so the audio can rest between them (sound.js).
test('every call says how long it lasts', () => {
  const { scape } = audio();
  for (const [name, ...args] of [
    ['bird', 'tit', 11, 0, 0.5],
    ['bird', 'dove', 11, 0, 0.5],
    ['cicada', 11, 0],
    ['geese', 11],
    ['frog', 11, 0],
    ['crickets', 11, 0],
    ['drop', 11, 0.04],
  ]) {
    const seconds = scape[name](...args);
    assert.ok(seconds > 0 && seconds <= 8, `${name}: ${seconds}`);
  }
});
