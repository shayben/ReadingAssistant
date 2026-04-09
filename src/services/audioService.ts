/**
 * Web Audio API service for ambient soundscapes and contextual sound effects.
 * All sounds are synthesized procedurally — no external audio files needed.
 */

// ─── AudioContext singleton ──────────────────────────────────────

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ambientGain: GainNode | null = null;
let sfxGain: GainNode | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(ctx.destination);

    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0;
    ambientGain.connect(masterGain);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.3;
    sfxGain.connect(masterGain);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// ─── Helpers ─────────────────────────────────────────────────────

function noiseBuffer(seconds: number): AudioBuffer {
  const c = getCtx();
  const frames = c.sampleRate * seconds;
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function loopNoise(seconds: number, dest: AudioNode): AudioBufferSourceNode {
  const c = getCtx();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(seconds);
  src.loop = true;
  src.connect(dest);
  return src;
}

/** Slowly ramp a param to a target over `dur` seconds. */
function ramp(param: AudioParam, target: number, dur: number) {
  param.setTargetAtTime(target, getCtx().currentTime, dur / 3);
}

// ─── Ambient Soundscape Engine ───────────────────────────────────

export type AmbientCategory =
  | 'nature' | 'ocean' | 'space' | 'peaceful'
  | 'mysterious' | 'dramatic' | 'adventure' | 'celebration';

interface AmbientHandle { stop(): void }

let currentAmbient: AmbientHandle | null = null;
let currentCategory: AmbientCategory | null = null;

// ── Individual ambient generators ────────────────────────────────
// Each returns a stop() handle. All connect to ambientGain.

function ambientNature(): AmbientHandle {
  const c = getCtx();
  const dest = ambientGain!;

  // Wind — bandpass-filtered noise
  const wind = loopNoise(4, c.createGain());
  const windFilter = c.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 700;
  windFilter.Q.value = 0.4;
  const windVol = c.createGain();
  windVol.gain.value = 0.35;
  wind.disconnect();
  wind.connect(windFilter).connect(windVol).connect(dest);
  wind.start();

  // LFO on wind filter frequency for gentle gusts
  const lfo = c.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.15;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 300;
  lfo.connect(lfoGain).connect(windFilter.frequency);
  lfo.start();

  // Bird chirps at random intervals
  let birdsAlive = true;
  function chirp() {
    if (!birdsAlive) return;
    const osc = c.createOscillator();
    osc.type = 'sine';
    const base = 2500 + Math.random() * 2000;
    const t = c.currentTime;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.4, t + 0.04);
    osc.frequency.exponentialRampToValueAtTime(base * 0.7, t + 0.1);
    const g = c.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 0.13);
    setTimeout(chirp, 2500 + Math.random() * 6000);
  }
  setTimeout(chirp, 800);

  return {
    stop() {
      birdsAlive = false;
      try { wind.stop(); } catch { /* ok */ }
      try { lfo.stop(); } catch { /* ok */ }
    },
  };
}

function ambientOcean(): AmbientHandle {
  const c = getCtx();
  const dest = ambientGain!;

  // Base surf — low-pass filtered noise
  const surf = loopNoise(6, c.createGain());
  const lpf = c.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 400;
  lpf.Q.value = 1;
  const surfVol = c.createGain();
  surfVol.gain.value = 0.4;
  surf.disconnect();
  surf.connect(lpf).connect(surfVol).connect(dest);
  surf.start();

  // Slow wave modulation on filter cutoff
  const waveLfo = c.createOscillator();
  waveLfo.type = 'sine';
  waveLfo.frequency.value = 0.08;
  const waveDepth = c.createGain();
  waveDepth.gain.value = 250;
  waveLfo.connect(waveDepth).connect(lpf.frequency);
  waveLfo.start();

  // Higher "foam" layer
  const foam = loopNoise(3, c.createGain());
  const hpf = c.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 3000;
  const foamVol = c.createGain();
  foamVol.gain.value = 0.08;
  foam.disconnect();
  foam.connect(hpf).connect(foamVol).connect(dest);
  foam.start();

  // Foam volume modulation — waves crash in and out
  const foamLfo = c.createOscillator();
  foamLfo.type = 'sine';
  foamLfo.frequency.value = 0.06;
  const foamLfoGain = c.createGain();
  foamLfoGain.gain.value = 0.06;
  foamLfo.connect(foamLfoGain).connect(foamVol.gain);
  foamLfo.start();

  return {
    stop() {
      try { surf.stop(); } catch { /* ok */ }
      try { waveLfo.stop(); } catch { /* ok */ }
      try { foam.stop(); } catch { /* ok */ }
      try { foamLfo.stop(); } catch { /* ok */ }
    },
  };
}

function ambientSpace(): AmbientHandle {
  const c = getCtx();
  const dest = ambientGain!;

  // Deep drone — detuned sine waves
  const oscs: OscillatorNode[] = [];
  const freqs = [55, 55.5, 82, 82.7]; // Low A + slightly detuned
  for (const f of freqs) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = c.createGain();
    g.gain.value = 0.12;
    osc.connect(g).connect(dest);
    osc.start();
    oscs.push(osc);
  }

  // Ethereal shimmer — high sine with slow tremolo
  const shimmer = c.createOscillator();
  shimmer.type = 'sine';
  shimmer.frequency.value = 880;
  const shimmerVol = c.createGain();
  shimmerVol.gain.value = 0.03;
  shimmer.connect(shimmerVol).connect(dest);
  shimmer.start();
  oscs.push(shimmer);

  const trem = c.createOscillator();
  trem.type = 'sine';
  trem.frequency.value = 0.3;
  const tremDepth = c.createGain();
  tremDepth.gain.value = 0.02;
  trem.connect(tremDepth).connect(shimmerVol.gain);
  trem.start();
  oscs.push(trem);

  return {
    stop() { oscs.forEach((o) => { try { o.stop(); } catch { /* ok */ } }); },
  };
}

function ambientPeaceful(): AmbientHandle {
  const c = getCtx();
  const dest = ambientGain!;

  // Gentle pad cycling through pentatonic notes
  const notes = [261.6, 293.7, 329.6, 392.0, 440.0]; // C4 pentatonic
  let alive = true;
  const activeOscs: OscillatorNode[] = [];

  function playNote() {
    if (!alive) return;
    const freq = notes[Math.floor(Math.random() * notes.length)];
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.06, t + 1.5);
    g.gain.linearRampToValueAtTime(0.001, t + 4);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 4.1);
    activeOscs.push(osc);
    setTimeout(playNote, 2000 + Math.random() * 3000);
  }
  playNote();

  // Soft wind bed
  const wind = loopNoise(3, c.createGain());
  const filt = c.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 500;
  const wg = c.createGain();
  wg.gain.value = 0.08;
  wind.disconnect();
  wind.connect(filt).connect(wg).connect(dest);
  wind.start();

  return {
    stop() {
      alive = false;
      try { wind.stop(); } catch { /* ok */ }
      activeOscs.forEach((o) => { try { o.stop(); } catch { /* ok */ } });
    },
  };
}

function ambientMysterious(): AmbientHandle {
  const c = getCtx();
  const dest = ambientGain!;

  // Low minor drone
  const drone1 = c.createOscillator();
  drone1.type = 'sine';
  drone1.frequency.value = 73.4; // D2
  const drone2 = c.createOscillator();
  drone2.type = 'sine';
  drone2.frequency.value = 87.3; // F2 (minor third)
  const dg = c.createGain();
  dg.gain.value = 0.12;
  drone1.connect(dg).connect(dest);
  drone2.connect(dg);
  drone1.start();
  drone2.start();

  // Slow tremolo
  const trem = c.createOscillator();
  trem.type = 'sine';
  trem.frequency.value = 0.2;
  const td = c.createGain();
  td.gain.value = 0.05;
  trem.connect(td).connect(dg.gain);
  trem.start();

  // Eerie high tones at random intervals
  let alive = true;
  function eerieNote() {
    if (!alive) return;
    const osc = c.createOscillator();
    osc.type = 'sine';
    const freq = 600 + Math.random() * 800;
    osc.frequency.value = freq;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.03, t + 1);
    g.gain.linearRampToValueAtTime(0.001, t + 3);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 3.1);
    setTimeout(eerieNote, 4000 + Math.random() * 6000);
  }
  setTimeout(eerieNote, 2000);

  return {
    stop() {
      alive = false;
      [drone1, drone2, trem].forEach((o) => { try { o.stop(); } catch { /* ok */ } });
    },
  };
}

function ambientDramatic(): AmbientHandle {
  const c = getCtx();
  const dest = ambientGain!;

  // Low rumble
  const rumble = loopNoise(4, c.createGain());
  const lpf = c.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 150;
  lpf.Q.value = 2;
  const rv = c.createGain();
  rv.gain.value = 0.3;
  rumble.disconnect();
  rumble.connect(lpf).connect(rv).connect(dest);
  rumble.start();

  // Heartbeat-like pulse
  let alive = true;
  function pulse() {
    if (!alive) return;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 50;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.15, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 0.5);
    // Double beat
    setTimeout(() => {
      if (!alive) return;
      const o2 = c.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = 50;
      const g2 = c.createGain();
      const t2 = c.currentTime;
      g2.gain.setValueAtTime(0.001, t2);
      g2.gain.linearRampToValueAtTime(0.1, t2 + 0.04);
      g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.3);
      o2.connect(g2).connect(dest);
      o2.start(t2);
      o2.stop(t2 + 0.35);
    }, 250);
    setTimeout(pulse, 1800);
  }
  setTimeout(pulse, 500);

  return {
    stop() {
      alive = false;
      try { rumble.stop(); } catch { /* ok */ }
    },
  };
}

function ambientAdventure(): AmbientHandle {
  const c = getCtx();
  const dest = ambientGain!;

  // Bright pad — major triad
  const freqs = [261.6, 329.6, 392.0]; // C-E-G
  const oscs: OscillatorNode[] = [];
  for (const f of freqs) {
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const g = c.createGain();
    g.gain.value = 0.06;
    osc.connect(g).connect(dest);
    osc.start();
    oscs.push(osc);
  }

  // Light rhythmic element — soft taps
  let alive = true;
  function tap() {
    if (!alive) return;
    const noise = c.createBufferSource();
    noise.buffer = noiseBuffer(0.03);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 4000;
    bp.Q.value = 2;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    noise.connect(bp).connect(g).connect(dest);
    noise.start(t);
    setTimeout(tap, 600);
  }
  setTimeout(tap, 300);

  return {
    stop() {
      alive = false;
      oscs.forEach((o) => { try { o.stop(); } catch { /* ok */ } });
    },
  };
}

function ambientCelebration(): AmbientHandle {
  const c = getCtx();
  const dest = ambientGain!;

  // Bright shimmering major chord
  const freqs = [523.3, 659.3, 784.0, 1046.5]; // C5-E5-G5-C6
  const oscs: OscillatorNode[] = [];
  for (const f of freqs) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = c.createGain();
    g.gain.value = 0.04;
    osc.connect(g).connect(dest);
    osc.start();
    oscs.push(osc);
  }

  // Sparkle effect — random high pings
  let alive = true;
  function sparkle() {
    if (!alive) return;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1500 + Math.random() * 3000;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 0.22);
    setTimeout(sparkle, 400 + Math.random() * 800);
  }
  setTimeout(sparkle, 200);

  return {
    stop() {
      alive = false;
      oscs.forEach((o) => { try { o.stop(); } catch { /* ok */ } });
    },
  };
}

const ambientGenerators: Record<AmbientCategory, () => AmbientHandle> = {
  nature: ambientNature,
  ocean: ambientOcean,
  space: ambientSpace,
  peaceful: ambientPeaceful,
  mysterious: ambientMysterious,
  dramatic: ambientDramatic,
  adventure: ambientAdventure,
  celebration: ambientCelebration,
};

// ─── Ambient Public API ──────────────────────────────────────────

const AMBIENT_FADE_SEC = 2;

export function startAmbient(category: AmbientCategory): void {
  if (currentCategory === category && currentAmbient) return; // already playing
  stopAmbient();
  getCtx(); // ensure context exists
  currentCategory = category;
  currentAmbient = ambientGenerators[category]();
  ramp(ambientGain!.gain, 0.12, AMBIENT_FADE_SEC);
}

export function stopAmbient(): void {
  if (!currentAmbient) return;
  const handle = currentAmbient;
  currentAmbient = null;
  currentCategory = null;
  if (ambientGain) {
    ramp(ambientGain.gain, 0, AMBIENT_FADE_SEC);
    setTimeout(() => handle.stop(), AMBIENT_FADE_SEC * 1000 + 200);
  } else {
    handle.stop();
  }
}

export function isAmbientPlaying(): boolean {
  return currentAmbient !== null;
}

// ─── Sound Effects Engine ────────────────────────────────────────

export type SoundEffect =
  | 'falling' | 'splash' | 'honk' | 'thunder' | 'wind' | 'rain'
  | 'bark' | 'roar' | 'bell' | 'whistle' | 'bird' | 'whoosh'
  | 'knock' | 'pop' | 'buzz' | 'boom' | 'gallop' | 'wave'
  | 'cheer' | 'fire' | 'ding' | 'creak' | 'snap' | 'engine'
  | 'scream';

function sfxFalling() {
  const c = getCtx();
  const osc = c.createOscillator();
  osc.type = 'sine';
  const t = c.currentTime;
  osc.frequency.setValueAtTime(1200, t);
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.8);
  const g = c.createGain();
  g.gain.setValueAtTime(0.3, t);
  g.gain.linearRampToValueAtTime(0.001, t + 1);
  osc.connect(g).connect(sfxGain!);
  osc.start(t);
  osc.stop(t + 1.1);
}

function sfxSplash() {
  const c = getCtx();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(0.4);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3000;
  bp.Q.value = 1;
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  src.connect(bp).connect(g).connect(sfxGain!);
  src.start(t);
}

function sfxHonk() {
  const c = getCtx();
  const osc = c.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 350;
  const osc2 = c.createOscillator();
  osc2.type = 'square';
  osc2.frequency.value = 440;
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.15, t);
  g.gain.setValueAtTime(0.15, t + 0.25);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  osc.connect(g).connect(sfxGain!);
  osc2.connect(g);
  osc.start(t);
  osc2.start(t);
  osc.stop(t + 0.42);
  osc2.stop(t + 0.42);
}

function sfxThunder() {
  const c = getCtx();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(2);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 200;
  lp.Q.value = 3;
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
  src.connect(lp).connect(g).connect(sfxGain!);
  src.start(t);
}

function sfxWind() {
  const c = getCtx();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(1.5);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 600;
  bp.Q.value = 0.3;
  const t = c.currentTime;
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(1500, t + 0.6);
  bp.frequency.exponentialRampToValueAtTime(400, t + 1.3);
  const g = c.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(0.3, t + 0.3);
  g.gain.linearRampToValueAtTime(0.001, t + 1.4);
  src.connect(bp).connect(g).connect(sfxGain!);
  src.start(t);
}

function sfxRain() {
  const c = getCtx();
  let count = 0;
  const total = 30;
  function drop() {
    if (count >= total) return;
    count++;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(0.02);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3000 + Math.random() * 4000;
    bp.Q.value = 5;
    const g = c.createGain();
    g.gain.value = 0.05 + Math.random() * 0.1;
    src.connect(bp).connect(g).connect(sfxGain!);
    src.start();
    setTimeout(drop, 30 + Math.random() * 80);
  }
  drop();
}

function sfxBark() {
  const c = getCtx();
  const t = c.currentTime;
  for (let i = 0; i < 2; i++) {
    const offset = i * 0.2;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t + offset);
    osc.frequency.exponentialRampToValueAtTime(150, t + offset + 0.08);
    const g = c.createGain();
    g.gain.setValueAtTime(0.2, t + offset);
    g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.1);
    osc.connect(g).connect(sfxGain!);
    osc.start(t + offset);
    osc.stop(t + offset + 0.12);
  }
}

function sfxRoar() {
  const c = getCtx();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(1.2);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 300;
  lp.Q.value = 5;
  const t = c.currentTime;
  lp.frequency.setValueAtTime(100, t);
  lp.frequency.exponentialRampToValueAtTime(400, t + 0.2);
  lp.frequency.exponentialRampToValueAtTime(150, t + 1);
  const g = c.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(0.4, t + 0.15);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
  src.connect(lp).connect(g).connect(sfxGain!);
  src.start(t);
}

function sfxBell() {
  const c = getCtx();
  const t = c.currentTime;
  const freqs = [800, 1600, 2400]; // fundamental + harmonics
  for (const f of freqs) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(f === 800 ? 0.2 : 0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2);
    osc.connect(g).connect(sfxGain!);
    osc.start(t);
    osc.stop(t + 2.1);
  }
}

function sfxWhistle() {
  const c = getCtx();
  const osc = c.createOscillator();
  osc.type = 'sine';
  const t = c.currentTime;
  osc.frequency.setValueAtTime(1200, t);
  osc.frequency.linearRampToValueAtTime(1800, t + 0.15);
  osc.frequency.linearRampToValueAtTime(1400, t + 0.4);
  // Vibrato
  const vib = c.createOscillator();
  vib.type = 'sine';
  vib.frequency.value = 6;
  const vibG = c.createGain();
  vibG.gain.value = 20;
  vib.connect(vibG).connect(osc.frequency);
  const g = c.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.linearRampToValueAtTime(0.001, t + 0.5);
  osc.connect(g).connect(sfxGain!);
  osc.start(t);
  vib.start(t);
  osc.stop(t + 0.55);
  vib.stop(t + 0.55);
}

function sfxBird() {
  const c = getCtx();
  const t = c.currentTime;
  for (let i = 0; i < 3; i++) {
    const off = i * 0.12;
    const osc = c.createOscillator();
    osc.type = 'sine';
    const base = 3000 + Math.random() * 1500;
    osc.frequency.setValueAtTime(base, t + off);
    osc.frequency.exponentialRampToValueAtTime(base * 1.3, t + off + 0.04);
    osc.frequency.exponentialRampToValueAtTime(base * 0.6, t + off + 0.09);
    const g = c.createGain();
    g.gain.setValueAtTime(0.12, t + off);
    g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.1);
    osc.connect(g).connect(sfxGain!);
    osc.start(t + off);
    osc.stop(t + off + 0.11);
  }
}

function sfxWhoosh() {
  const c = getCtx();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(0.5);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 2;
  const t = c.currentTime;
  bp.frequency.setValueAtTime(200, t);
  bp.frequency.exponentialRampToValueAtTime(6000, t + 0.2);
  bp.frequency.exponentialRampToValueAtTime(800, t + 0.4);
  const g = c.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(0.3, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  src.connect(bp).connect(g).connect(sfxGain!);
  src.start(t);
}

function sfxKnock() {
  const c = getCtx();
  const t = c.currentTime;
  for (let i = 0; i < 3; i++) {
    const off = i * 0.18;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(0.05);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    lp.Q.value = 8;
    const g = c.createGain();
    g.gain.setValueAtTime(0.3, t + off);
    g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.08);
    src.connect(lp).connect(g).connect(sfxGain!);
    src.start(t + off);
  }
}

function sfxPop() {
  const c = getCtx();
  const osc = c.createOscillator();
  osc.type = 'sine';
  const t = c.currentTime;
  osc.frequency.setValueAtTime(600, t);
  osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);
  const g = c.createGain();
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc.connect(g).connect(sfxGain!);
  osc.start(t);
  osc.stop(t + 0.1);
}

function sfxBuzz() {
  const c = getCtx();
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 150;
  // FM buzz modulation
  const mod = c.createOscillator();
  mod.type = 'sine';
  mod.frequency.value = 80;
  const modG = c.createGain();
  modG.gain.value = 40;
  mod.connect(modG).connect(osc.frequency);
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(0.12, t + 0.1);
  g.gain.linearRampToValueAtTime(0.12, t + 0.4);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  osc.connect(g).connect(sfxGain!);
  osc.start(t);
  mod.start(t);
  osc.stop(t + 0.65);
  mod.stop(t + 0.65);
}

function sfxBoom() {
  const c = getCtx();
  // Low sine thud
  const osc = c.createOscillator();
  osc.type = 'sine';
  const t = c.currentTime;
  osc.frequency.setValueAtTime(80, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.5);
  const g1 = c.createGain();
  g1.gain.setValueAtTime(0.4, t);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 1);
  osc.connect(g1).connect(sfxGain!);
  osc.start(t);
  osc.stop(t + 1.1);
  // Noise burst overlay
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(0.6);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 300;
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0.3, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  src.connect(lp).connect(g2).connect(sfxGain!);
  src.start(t);
}

function sfxGallop() {
  const c = getCtx();
  const t = c.currentTime;
  const pattern = [0, 0.15, 0.35, 0.5, 0.65, 0.8]; // galloping rhythm
  for (const off of pattern) {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(0.04);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    lp.Q.value = 3;
    const g = c.createGain();
    g.gain.setValueAtTime(0.2, t + off);
    g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.06);
    src.connect(lp).connect(g).connect(sfxGain!);
    src.start(t + off);
  }
}

function sfxWave() {
  const c = getCtx();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(2.5);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  const t = c.currentTime;
  lp.frequency.setValueAtTime(200, t);
  lp.frequency.linearRampToValueAtTime(1500, t + 0.8);
  lp.frequency.linearRampToValueAtTime(200, t + 2.2);
  const g = c.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(0.25, t + 0.5);
  g.gain.linearRampToValueAtTime(0.001, t + 2.3);
  src.connect(lp).connect(g).connect(sfxGain!);
  src.start(t);
}

function sfxCheer() {
  const c = getCtx();
  const t = c.currentTime;
  // Multiple layered noise bursts simulating voices
  for (let i = 0; i < 5; i++) {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(1.5);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 800 + Math.random() * 2000;
    bp.Q.value = 2;
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.1);
    g.gain.setValueAtTime(0.06, t + 1);
    g.gain.linearRampToValueAtTime(0.001, t + 1.4);
    src.connect(bp).connect(g).connect(sfxGain!);
    src.start(t + Math.random() * 0.1);
  }
}

function sfxFire() {
  const c = getCtx();
  const t = c.currentTime;
  let count = 0;
  const total = 20;
  function crackle() {
    if (count >= total) return;
    count++;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(0.03);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1000 + Math.random() * 3000;
    bp.Q.value = 8;
    const g = c.createGain();
    g.gain.value = 0.08 + Math.random() * 0.12;
    src.connect(bp).connect(g).connect(sfxGain!);
    src.start();
    setTimeout(crackle, 40 + Math.random() * 120);
  }
  crackle();
  // Low fire bed
  const bed = c.createBufferSource();
  bed.buffer = noiseBuffer(1.5);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 400;
  const bg = c.createGain();
  bg.gain.setValueAtTime(0.001, t);
  bg.gain.linearRampToValueAtTime(0.15, t + 0.2);
  bg.gain.linearRampToValueAtTime(0.001, t + 1.4);
  bed.connect(lp).connect(bg).connect(sfxGain!);
  bed.start(t);
}

function sfxDing() {
  const c = getCtx();
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 1200;
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
  osc.connect(g).connect(sfxGain!);
  osc.start(t);
  osc.stop(t + 0.85);
}

function sfxCreak() {
  const c = getCtx();
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  const t = c.currentTime;
  osc.frequency.setValueAtTime(80, t);
  osc.frequency.linearRampToValueAtTime(200, t + 0.3);
  osc.frequency.linearRampToValueAtTime(100, t + 0.5);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 600;
  lp.Q.value = 5;
  const g = c.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(0.12, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  osc.connect(lp).connect(g).connect(sfxGain!);
  osc.start(t);
  osc.stop(t + 0.6);
}

function sfxSnap() {
  const c = getCtx();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(0.015);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2000;
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  src.connect(hp).connect(g).connect(sfxGain!);
  src.start(t);
}

function sfxEngine() {
  const c = getCtx();
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 60;
  // Rumble modulation
  const mod = c.createOscillator();
  mod.type = 'sine';
  mod.frequency.value = 8;
  const modG = c.createGain();
  modG.gain.value = 10;
  mod.connect(modG).connect(osc.frequency);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 300;
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(0.15, t + 0.2);
  g.gain.setValueAtTime(0.15, t + 0.8);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
  osc.connect(lp).connect(g).connect(sfxGain!);
  osc.start(t);
  mod.start(t);
  osc.stop(t + 1.25);
  mod.stop(t + 1.25);
}

function sfxScream() {
  const c = getCtx();
  const t = c.currentTime;
  // Cartoonish descending scream — frequency-modulated
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(300, t + 0.6);
  // Vibrato for scream quality
  const vib = c.createOscillator();
  vib.type = 'sine';
  vib.frequency.value = 12;
  const vibG = c.createGain();
  vibG.gain.value = 40;
  vib.connect(vibG).connect(osc.frequency);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1200;
  bp.Q.value = 2;
  const g = c.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(0.18, t + 0.05);
  g.gain.setValueAtTime(0.18, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  osc.connect(bp).connect(g).connect(sfxGain!);
  osc.start(t);
  vib.start(t);
  osc.stop(t + 0.75);
  vib.stop(t + 0.75);
}

const sfxMap: Record<SoundEffect, () => void> = {
  falling: sfxFalling,
  splash: sfxSplash,
  honk: sfxHonk,
  thunder: sfxThunder,
  wind: sfxWind,
  rain: sfxRain,
  bark: sfxBark,
  roar: sfxRoar,
  bell: sfxBell,
  whistle: sfxWhistle,
  bird: sfxBird,
  whoosh: sfxWhoosh,
  knock: sfxKnock,
  pop: sfxPop,
  buzz: sfxBuzz,
  boom: sfxBoom,
  gallop: sfxGallop,
  wave: sfxWave,
  cheer: sfxCheer,
  fire: sfxFire,
  ding: sfxDing,
  creak: sfxCreak,
  snap: sfxSnap,
  engine: sfxEngine,
  scream: sfxScream,
};

// ─── SFX Public API ──────────────────────────────────────────────

/** Play a one-shot sound effect. Unknown names produce a fallback "ding". */
export function playSoundEffect(name: string): void {
  getCtx(); // ensure context + user-gesture resume
  const fn = sfxMap[name as SoundEffect] ?? sfxDing;
  try { fn(); } catch { /* best-effort */ }
}

/** All known sound-effect names (useful for prompt engineering). */
export const SOUND_EFFECT_NAMES: readonly string[] = Object.keys(sfxMap);
