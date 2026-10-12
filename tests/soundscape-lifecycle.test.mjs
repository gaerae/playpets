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
      stops: [],
      start() {},
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

test('entering a silent indoor scene cancels already scheduled wildlife while preserving activity cues', () => {
  const { ctx, sources, scape } = audio();
  scape.setMix({ breeze: 1, birds: 8, crickets: 1 });
  const first = sources.length;
  scape.bird('dove', 11, 0, 0.5);
  scape.chirp(12, 4300, 0, 0.022);
  scape.drop(11, 0.04);
  const wildlife = sources.slice(first);
  scape.cue('pat');
  scape.plip();
  scape.splash();
  const cues = sources.slice(first + wildlife.length);
  const stops = cues.map(source => [...source.stops]);
  scape.setMix({ breeze: 0, leaves: 0, water: 0, rain: 0, birds: 0, crickets: 0 });
  assert.ok(wildlife.length > 0);
  for (const source of wildlife) assert.equal(source.stops.at(-1), ctx.currentTime);
  assert.deepEqual(
    cues.map(source => source.stops),
    stops,
    'indoor activity cues keep playing',
  );
});
