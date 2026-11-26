// Between the yard's calls nothing plays, so its audio rests (src/yard/sound.js): it runs for a
// call or a cue and a moment after it, and is suspended in between.
import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom } from './support/dom.mjs';

globalThis.playPets = { setSound: async () => ({ ok: true, data: null }) };

const contexts = [];
class FakeAudio {
  currentTime = 0;
  sampleRate = 100;
  state = 'suspended';
  resumes = 0;
  suspends = 0;
  destination = {};
  constructor() {
    contexts.push(this);
  }
  resume() {
    this.resumes++;
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.suspends++;
    this.state = 'suspended';
    return Promise.resolve();
  }
  node() {
    const param = () => ({
      value: 0,
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
      setTargetAtTime() {},
      linearRampToValueAtTime() {},
    });
    return {
      gain: param(),
      frequency: param(),
      detune: param(),
      Q: param(),
      pan: param(),
      threshold: param(),
      knee: param(),
      ratio: param(),
      attack: param(),
      release: param(),
      connect: next => next,
      start() {},
      stop() {},
    };
  }
  createGain = () => this.node();
  createDynamicsCompressor = () => this.node();
  createConvolver = () => this.node();
  createBiquadFilter = () => this.node();
  createStereoPanner = () => this.node();
  createOscillator = () => this.node();
  createBufferSource = () => this.node();
  createBuffer = (_channels, length) => ({ getChannelData: () => new Float32Array(length), duration: 1 });
}

test('the audio runs for a call and rests until the next', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  t.mock.method(Math, 'random', () => 0.5);
  globalThis.AudioContext = FakeAudio;
  t.after(() => delete globalThis.AudioContext);
  const { document, nodes, element } = installDom(t, { ids: ['sound-button', 'sound-volume'] });
  document.hidden = false;
  nodes.get('sound-button').append(element('span', { dataset: { icon: 'sound' } }));
  const { setData } = await import('../src/core/state.js');
  const { setupSound, renderSound, soundScene, cue } = await import('../src/yard/sound.js');
  setData({ sound: { on: true, volume: 40 } });
  setupSound();
  soundScene({ season: 'spring', period: 'morning', weather: 'clear', world: 'woodland' });
  renderSound();
  await document.dispatch('pointerdown');
  const [ctx] = contexts;
  assert.ok(ctx, 'the first touch makes the audio');
  assert.equal(ctx.state, 'running', 'and starts it while the touch allows');
  t.mock.timers.tick(1500);
  assert.equal(ctx.state, 'running', 'a bird calls');
  t.mock.timers.tick(2600);
  assert.equal(ctx.state, 'suspended', 'and the audio rests after it');
  // A snowy night has no calls at all, so only a cue wakes the audio.
  soundScene({ season: 'winter', period: 'night', weather: 'snow', world: 'woodland' });
  const resumes = ctx.resumes;
  cue('pat');
  assert.equal(ctx.state, 'running', 'a cue wakes it');
  assert.ok(ctx.resumes > resumes);
  t.mock.timers.tick(3200);
  assert.equal(ctx.state, 'suspended');
  t.mock.timers.tick(120000);
  assert.equal(ctx.state, 'suspended', 'and nothing else does');
});
