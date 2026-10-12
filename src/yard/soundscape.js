// The yard's sounds, made with Web Audio on a context it is given (nothing is downloaded): beds that
// loop (a breeze, leaves, the lake, rain), calls placed at a time (birds, crickets, drops of rain)
// and the small tones of what friends do. It knows no clock of its own: whoever owns it says when
// each thing sounds (src/yard/sound.js while the app runs; a preview renders it ahead of time).
// Design: docs/design/2026-10-10-yard-sounds.md.

import { CUES, stepHz } from './soundmix.js';

// How loud each bed is at its full level, so that the layers sit together.
const BED = { breeze: 0.5, leaves: 0.09, water: 0.3, rain: 0.22 };

/** A soundscape playing into `destination` of the context `ctx`. */
export function createSoundscape(ctx, destination) {
  const rand = Math.random;
  const wildlife = new Set();
  function track(source) {
    wildlife.add(source);
    source.onended = () => wildlife.delete(source);
  }
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
  // A small room of air around the calls and the tones (the beds stay dry).
  const send = ctx.createGain(),
    room = ctx.createConvolver(),
    roomOut = ctx.createGain();
  room.buffer = air(ctx, 1.6);
  roomOut.gain.value = 0.45;
  send.connect(room).connect(roomOut).connect(out);

  const brown = noise(ctx, 'brown', 6),
    pink = noise(ctx, 'pink', 6),
    white = noise(ctx, 'white', 1);
  const filter = (type, frequency, q = 0.7) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = q;
    return f;
  };
  // A slow wobble on a parameter, made by the audio itself (no timer).
  const lfo = (rate, depth, param) => {
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.frequency.value = rate;
    g.gain.value = depth;
    o.connect(g).connect(param);
    o.start();
  };
  // A bed: noise through filters, then `motion` (gusts and lapping move it) and `level` (the scene
  // sets it), so the two never fight over one gain.
  const bed = (buffer, filters, base) => {
    const src = ctx.createBufferSource(),
      motion = ctx.createGain(),
      level = ctx.createGain();
    src.buffer = buffer;
    src.loop = true;
    motion.gain.value = 1;
    level.gain.value = 0;
    let node = src;
    for (const f of filters) node = node.connect(f);
    node.connect(motion).connect(level).connect(out);
    src.start(0, rand() * buffer.duration);
    return { motion, level, filters, base };
  };
  const beds = {
    breeze: bed(brown, [filter('lowpass', 420)], BED.breeze),
    leaves: bed(pink, [filter('bandpass', 1700, 0.5), filter('lowpass', 4200)], BED.leaves),
    water: bed(brown, [filter('lowpass', 300)], BED.water),
    rain: bed(pink, [filter('highpass', 500), filter('lowpass', 4500)], BED.rain),
  };
  // The breeze breathes on its own: its colour and loudness drift slowly.
  lfo(0.06, 160, beds.breeze.filters[0].frequency);
  lfo(0.045, 0.22, beds.breeze.motion.gain);
  // Between gusts the leaves are nearly still.
  beds.leaves.motion.gain.value = 0.08;

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
    p.connect(out);
    p.connect(send);
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
    src.buffer = white;
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
      g.connect(send);
      o.start(t);
      o.stop(t + ring + 0.02);
    }
  }

  // Birds, each kind with its own song.
  const BIRDS = {
    // Two notes, high then low, a few times over ("tea-cher").
    tit(t, pan, vol) {
      const times = 2 + Math.floor(rand() * 3),
        hi = 4100 + rand() * 500;
      for (let i = 0; i < times; i++, t += 0.34) {
        tone(t, hi, hi * 0.93, 0.09, vol, pan);
        tone(t + 0.14, hi * 0.76, hi * 0.74, 0.11, vol * 0.85, pan);
      }
    },
    // A quick run of the same note.
    trill(t, pan, vol) {
      const n = 9 + Math.floor(rand() * 8),
        f = 3600 + rand() * 900;
      for (let i = 0; i < n; i++)
        tone(t + i * 0.052, f * (1 - i * 0.006), f * (0.96 - i * 0.006), 0.036, vol * 0.8, pan);
    },
    // A wandering little song.
    warble(t, pan, vol) {
      const n = 5 + Math.floor(rand() * 5);
      for (let i = 0; i < n; i++) {
        const f = 2600 + rand() * 2600,
          dur = 0.05 + rand() * 0.09;
        tone(t, f, f * (0.9 + rand() * 0.25), dur, vol * (0.7 + rand() * 0.3), pan);
        t += dur + 0.025 + rand() * 0.03;
      }
    },
    // A dove's soft coo in the morning.
    dove(t, pan, vol) {
      tone(t, 520, 470, 0.34, vol * 0.9, pan, 0.08);
      tone(t + 0.48, 560, 480, 0.6, vol, pan, 0.1);
      tone(t + 1.2, 500, 460, 0.36, vol * 0.8, pan, 0.08);
    },
  };

  return {
    /** Sets each bed's level for the scene (mixFor's numbers), gliding there over a few seconds. */
    setMix(mix, t = ctx.currentTime) {
      for (const [name, b] of Object.entries(beds)) b.level.gain.setTargetAtTime((mix[name] || 0) * b.base, t, 1.6);
      // Calls are queued ahead of the audio clock; a silent room also cancels those future voices.
      if (!Object.values(mix).some(level => level > 0)) {
        for (const source of wildlife) source.stop(t);
        wildlife.clear();
      }
    },
    /** The overall loudness, 0 to 100; 0 fades it all out. */
    setVolume(volume, t = ctx.currentTime, glide = 0.5) {
      out.gain.setTargetAtTime(volume > 0 ? (volume / 100) ** 1.5 * 1.1 : 0, t, glide);
    },
    /** A gust through the leaves, starting at `t`. */
    gust(t) {
      const g = beds.leaves.motion.gain,
        peak = 0.65 + rand() * 0.45;
      g.setTargetAtTime(peak, t, 0.7 + rand() * 0.5);
      g.setTargetAtTime(0.08, t + 1.8 + rand() * 1.5, 1.4);
    },
    /** A small wave at the lake's shore, starting at `t`. */
    lap(t) {
      const g = beds.water.motion.gain,
        f = beds.water.filters[0].frequency;
      g.setTargetAtTime(1.2, t, 0.25);
      g.setTargetAtTime(0.45, t + 0.7, 0.5);
      f.setTargetAtTime(520, t, 0.25);
      f.setTargetAtTime(280, t + 0.7, 0.5);
    },
    /** A bird of a kind (tit, trill, warble, dove) calling at `t`, nearer as `near` goes to 1. */
    bird(kind, t, pan, near) {
      BIRDS[kind]?.(t, pan, 0.1 + near * 0.18);
    },
    /** One cricket's chirp at `t`: three short pulses. */
    chirp(t, hz, pan, vol) {
      for (let i = 0; i < 3; i++) tone(t + i * 0.034, hz, hz, 0.024, vol, pan, 0.008);
    },
    /** A drop of rain landing on a leaf at `t`. */
    drop(t, vol) {
      burst(t, 0.03, 1800 + rand() * 3200, 900, vol, rand() * 1.6 - 0.8, 3, true);
    },
    /** A cue for something a friend did (soundmix.js CUES), at `t`. */
    cue(name, t = ctx.currentTime + 0.01) {
      if (name === 'water') burst(t, 0.9, 500, 1400, 0.05, 0, 0.8);
      const steps = name === 'pat' ? [2 + Math.floor(rand() * 3)] : CUES[name];
      if (!steps) return;
      const gap = name === 'level' ? 0.13 : 0.085,
        start = name === 'water' ? t + 0.5 : t;
      for (const [i, s] of steps.entries()) pluck(start + i * gap, stepHz(s), name === 'pat' ? 0.06 : 0.09);
    },
    /** The float dips: a drop into the water. */
    plip(t = ctx.currentTime + 0.01) {
      tone(t, 1500, 380, 0.1, 0.12, 0, 0.004, 'sine', false);
    },
    /** A fish comes out of the water. */
    splash(t = ctx.currentTime + 0.01) {
      burst(t, 0.55, 3200, 500, 0.16, 0, 0.7);
      this.cue('catch', t + 0.18);
    },
  };
}

// Noise of a colour, in two channels that differ so a bed sounds wide.
function noise(ctx, colour, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds),
    buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buffer.getChannelData(c);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      last = 0;
    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      if (colour === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else if (colour === 'pink') {
        // Paul Kellet's economy filter.
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11;
      } else d[i] = w;
    }
    // The loop's seam: a short crossfade of its ends, so no click repeats every few seconds.
    const fade = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      d[length - fade + i] = d[length - fade + i] * (1 - k) + d[i] * k;
    }
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
