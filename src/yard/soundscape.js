// The yard's sounds, made with Web Audio on a context it is given (nothing is downloaded): calls
// placed at a time (birds, cicadas, geese, frogs, crickets, a drop of rain) and the small tones of
// what friends do. Nothing loops or plays on by itself, so between calls there is silence. It knows
// no clock of its own: whoever owns it says when each thing sounds (src/yard/sound.js while the
// app runs; a preview renders it ahead of time). Each call says how many seconds it lasts, so the
// owner can let the audio rest after it.
// Design: docs/design/2026-10-10-yard-sounds.md.

import { CUES, stepHz } from './soundmix.js';

/** Only the yard's cues (`cue`, `setVolume`), playing into `destination` of the context `ctx`, for
 * a window with no yard to hear: the desktop's chime and a find's own sound (src/overlay/chime.js).
 * Its noise and room are made only when a cue first needs them. */
export function createCueVoice(ctx, destination) {
  const { cue, setVolume } = createVoice(ctx, destination, () => {});
  return { cue, setVolume };
}

/** A soundscape playing into `destination` of the context `ctx`. */
export function createSoundscape(ctx, destination) {
  const rand = Math.random;
  const wildlife = new Set();
  function track(source) {
    wildlife.add(source);
    source.onended = () => wildlife.delete(source);
  }
  const voice = createVoice(ctx, destination, track),
    { filter, tone, burst, send } = voice;

  // Birds, each kind with its own song. Each returns how long it sings.
  const BIRDS = {
    // Two notes, high then low, a few times over ("tea-cher").
    tit(t, pan, vol) {
      const times = 2 + Math.floor(rand() * 3),
        hi = 4100 + rand() * 500;
      for (let i = 0; i < times; i++) {
        tone(t + i * 0.34, hi, hi * 0.93, 0.09, vol, pan);
        tone(t + i * 0.34 + 0.14, hi * 0.76, hi * 0.74, 0.11, vol * 0.85, pan);
      }
      return times * 0.34;
    },
    // A quick run of the same note.
    trill(t, pan, vol) {
      const n = 9 + Math.floor(rand() * 8),
        f = 3600 + rand() * 900;
      for (let i = 0; i < n; i++)
        tone(t + i * 0.052, f * (1 - i * 0.006), f * (0.96 - i * 0.006), 0.036, vol * 0.8, pan);
      return n * 0.052;
    },
    // A wandering little song.
    warble(t, pan, vol) {
      const n = 5 + Math.floor(rand() * 5),
        start = t;
      for (let i = 0; i < n; i++) {
        const f = 2600 + rand() * 2600,
          dur = 0.05 + rand() * 0.09;
        tone(t, f, f * (0.9 + rand() * 0.25), dur, vol * (0.7 + rand() * 0.3), pan);
        t += dur + 0.025 + rand() * 0.03;
      }
      return t - start;
    },
    // A dove's soft coo in the morning.
    dove(t, pan, vol) {
      tone(t, 520, 470, 0.34, vol * 0.9, pan, 0.08);
      tone(t + 0.48, 560, 480, 0.6, vol, pan, 0.1);
      tone(t + 1.2, 500, 460, 0.36, vol * 0.8, pan, 0.08);
      return 1.56;
    },
  };

  return {
    /** The scene's calls (mixFor): indoors they come in through the window. A scene with none
     * cancels the calls already queued ahead of the audio clock. */
    setMix(mix, t = ctx.currentTime) {
      voice.place.indoors = !!mix.indoors;
      if (!Object.values(mix).some(rate => typeof rate === 'number' && rate > 0)) {
        for (const source of wildlife) source.stop(t);
        wildlife.clear();
      }
    },
    setVolume: voice.setVolume,
    /** A bird of a kind (tit, trill, warble, dove) calling at `t`, nearer as `near` goes to 1. */
    bird(kind, t, pan, near) {
      return BIRDS[kind]?.(t, pan, 0.1 + near * 0.18) ?? 0;
    },
    /** A cicada's song at `t`: a high buzz that swells, holds and fades over a few seconds. */
    cicada(t, pan) {
      const dur = 3 + rand() * 2,
        f = 5400 + rand() * 700,
        o = ctx.createOscillator(),
        env = ctx.createGain(),
        pulse = ctx.createGain(),
        beat = ctx.createOscillator(),
        depth = ctx.createGain(),
        p = ctx.createStereoPanner();
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.97, t + dur);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.045, t + 1);
      env.gain.setValueAtTime(0.045, t + dur - 1.4);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      // The buzz is the tone pulsing a hundred-odd times a second.
      beat.frequency.value = 100 + rand() * 30;
      pulse.gain.value = 0.5;
      depth.gain.value = 0.5;
      beat.connect(depth).connect(pulse.gain);
      p.pan.value = pan;
      o.connect(env).connect(pulse).connect(p);
      send(p, true);
      for (const source of [o, beat]) {
        track(source);
        source.start(t);
        source.stop(t + dur + 0.05);
      }
      return dur;
    },
    /** Geese going over from one side to the other at `t`, honking as they pass. */
    geese(t) {
      const n = 3 + Math.floor(rand() * 4),
        from = rand() < 0.5 ? -0.8 : 0.8;
      for (let i = 0; i < n; i++) {
        const at = t + i * (0.45 + rand() * 0.2),
          pan = from - (2 * from * i) / Math.max(1, n - 1),
          f = 360 + rand() * 60;
        for (const [mult, delay] of rand() < 0.4
          ? [
              [1, 0],
              [1.22, 0.12],
            ]
          : [[1, 0]]) {
          const o = ctx.createOscillator(),
            body = filter('lowpass', 1100, 1),
            g = ctx.createGain(),
            p = ctx.createStereoPanner(),
            s0 = at + delay;
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(f * mult, s0);
          o.frequency.exponentialRampToValueAtTime(f * mult * 1.08, s0 + 0.08);
          o.frequency.exponentialRampToValueAtTime(f * mult * 0.95, s0 + 0.22);
          g.gain.setValueAtTime(0.0001, s0);
          g.gain.exponentialRampToValueAtTime(0.05, s0 + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, s0 + 0.22);
          p.pan.value = pan;
          o.connect(body).connect(g).connect(p);
          send(p, true);
          track(o);
          o.start(s0);
          o.stop(s0 + 0.25);
        }
      }
      return n * 0.65 + 0.4;
    },
    /** A frog by the lake at `t`: two or three croaks, each a quick run of low pulses. */
    frog(t, pan) {
      const croaks = 2 + Math.floor(rand() * 2),
        f = 480 + rand() * 120;
      for (let c = 0; c < croaks; c++)
        for (let i = 0; i < 7; i++) {
          const at = t + c * 0.45 + i * 0.024,
            hz = f * (1 - c * 0.04) * (1 - i * 0.01);
          tone(at, hz, hz * 0.92, 0.016, 0.12, pan, 0.003, 'triangle');
        }
      return croaks * 0.45;
    },
    /** A cricket's few chirps at `t`, each three short pulses. */
    crickets(t, pan) {
      const n = 4 + Math.floor(rand() * 4),
        hz = 4300 + rand() * 450;
      let at = t;
      for (let i = 0; i < n; i++, at += 0.72 * (0.95 + rand() * 0.1))
        for (let k = 0; k < 3; k++) tone(at + k * 0.034, hz, hz, 0.024, 0.07, pan, 0.008);
      return at - t;
    },
    /** A drop of rain at `t`: on a leaf outdoors, a tick on the glass indoors. */
    drop(t, vol) {
      if (voice.place.indoors) burst(t, 0.018, 5200 + rand() * 1800, 3000, vol * 0.8, rand() * 1.2 - 0.6, 4, true);
      else burst(t, 0.03, 1800 + rand() * 3200, 900, vol, rand() * 1.6 - 0.8, 3, true);
      return 0.05;
    },
    cue: voice.cue,
    /** A firework bursting at `t`: a low thump, then its stars crackling; `size` 1 is a full shell.
     * Returns how long it sounds from `t`. */
    boom(t, pan, size = 1) {
      burst(t, 1.4, 320, 50, 0.32 * size, pan, 0.5);
      tone(t, 110, 38, 0.7, 0.22 * size, pan, 0.004, 'sine', false);
      const crackles = 6 + Math.floor(rand() * 6);
      for (let i = 0; i < crackles; i++)
        burst(t + 0.35 + rand() * 1.2, 0.025, 3000 + rand() * 3000, 1500, 0.05 * size, pan + (rand() - 0.5) * 0.6, 2);
      return 2.6;
    },
    /** The float dips: a drop into the water. Returns how long it sounds. */
    plip(t = ctx.currentTime + 0.01) {
      tone(t, 1500, 380, 0.1, 0.12, 0, 0.004, 'sine', false);
      return 0.2;
    },
    /** A fish comes out of the water. Returns how long it sounds, as long as any cue. */
    splash(t = ctx.currentTime + 0.01) {
      burst(t, 0.55, 3200, 500, 0.16, 0, 0.7);
      voice.cue('catch', t + 0.18);
      return 1.6;
    },
  };
}

// What the cues and calls sound through: the output with its limiter, a small room of air, a
// window for the calls heard from indoors, and the voices themselves. `track` hears each call's
// voice, so a silent scene can cancel it.
function createVoice(ctx, destination, track) {
  const rand = Math.random;
  const place = { indoors: false };
  const out = ctx.createGain();
  // A gentle limiter keeps a burst of tones from ever clipping.
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -10;
  limit.knee.value = 6;
  limit.ratio.value = 4;
  limit.attack.value = 0.004;
  limit.release.value = 0.25;
  out.gain.value = 0;
  out.connect(limit).connect(destination);
  // A small room of air around the calls and the tones, the glass a call heard from indoors comes
  // through, and the white noise of a hiss, each made when first needed.
  let roomIn = null,
    glass = null,
    white = null;
  const filter = (type, frequency, q = 0.7) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = q;
    return f;
  };
  const room = () => {
    if (roomIn) return roomIn;
    roomIn = ctx.createGain();
    const space = ctx.createConvolver(),
      roomOut = ctx.createGain();
    space.buffer = air(ctx, 1.6);
    roomOut.gain.value = 0.45;
    roomIn.connect(space).connect(roomOut).connect(out);
    return roomIn;
  };
  // Through a closed window a call loses its brightness and some of its loudness, and all of the air.
  const pane = () => {
    if (glass) return glass;
    glass = filter('lowpass', 2400);
    const through = ctx.createGain();
    through.gain.value = 0.6;
    glass.connect(through).connect(out);
    return glass;
  };
  const whiteNoise = () => (white ??= noise(ctx, 1));
  // Where a voice goes: a call heard from indoors through the window, anything else into the open.
  function send(node, ambient) {
    if (ambient && place.indoors) node.connect(pane());
    else {
      node.connect(out);
      node.connect(room());
    }
  }

  // One voice of a call: a tone gliding from f0 to f1, panned, into the air.
  function tone(t, f0, f1, dur, vol, pan = 0, attack = 0.012, type = 'sine', ambient = true) {
    const o = ctx.createOscillator(),
      g = ctx.createGain(),
      p = ctx.createStereoPanner();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(attack, dur / 2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    p.pan.value = pan;
    o.connect(g).connect(p);
    send(p, ambient);
    if (ambient) track(o);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  // A burst of noise through a band, for drops and splashes.
  function burst(t, dur, from, to, vol, pan = 0, q = 1.2, ambient = false) {
    const src = ctx.createBufferSource(),
      f = filter('bandpass', from, q),
      g = ctx.createGain(),
      p = ctx.createStereoPanner();
    src.buffer = whiteNoise();
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    p.pan.value = pan;
    src.connect(f).connect(g).connect(p);
    p.connect(out);
    if (ambient) track(src);
    src.start(t, rand() * 0.5, dur + 0.02);
  }
  // A tine like a kalimba's: the note and a quick bright overtone, dying away in the air.
  function pluck(t, f, vol) {
    for (const [mult, v, ring] of [
      [1, vol, 1.1],
      [4.1, vol * 0.22, 0.12],
    ]) {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.frequency.value = f * mult;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ring);
      o.connect(g);
      g.connect(out);
      g.connect(room());
      o.start(t);
      o.stop(t + ring + 0.02);
    }
  }

  return {
    place,
    filter,
    tone,
    burst,
    send,
    /** The overall loudness, 0 to 100; 0 fades it all out. */
    setVolume(volume, t = ctx.currentTime, glide = 0.5) {
      out.gain.setTargetAtTime(volume > 0 ? (volume / 100) ** 1.5 * 1.1 : 0, t, glide);
    },
    /** A cue for something a friend did (soundmix.js CUES), at `t`. Returns how long it sounds with
     * its ring: a pat's one soft note less than the others. */
    cue(name, t = ctx.currentTime + 0.01) {
      const seconds = name === 'pat' ? 1.2 : 1.6;
      if (name === 'water') burst(t, 0.9, 500, 1400, 0.05, 0, 0.8);
      // A perfume bottle's puff: one short soft hiss, falling as the mist spreads.
      if (name === 'spritz') burst(t, 0.35, 6000, 3000, 0.04, 0, 0.9);
      const steps = name === 'pat' ? [2 + Math.floor(rand() * 3)] : CUES[name];
      if (!steps) return seconds;
      const gap = name === 'level' ? 0.13 : 0.085,
        start = name === 'water' ? t + 0.5 : t;
      for (const [i, s] of steps.entries()) pluck(start + i * gap, stepHz(s), name === 'pat' ? 0.06 : 0.09);
      return seconds;
    },
  };
}

// White noise in two channels that differ, so a hiss sounds wide.
function noise(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds),
    buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) d[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// The air of an open place: a short tail of noise dying away, a little darker as it goes.
function air(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds),
    buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buffer.getChannelData(c);
    let low = 0;
    for (let i = 0; i < length; i++) {
      const k = i / length;
      low += (Math.random() * 2 - 1 - low) * (0.6 - 0.45 * k);
      d[i] = low * (1 - k) ** 3 * 0.5;
    }
  }
  return buffer;
}
