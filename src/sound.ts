/**
 * Tiny Web Audio kit for the dice game.
 *
 * Everything is synthesised — no assets — and every call is a no-op until
 * `initAudio()` has run inside a user gesture.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export const initAudio = (): void => {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 8;
    master.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
};

export const setMuted = (value: boolean): void => {
  muted = value;
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.85, ctx.currentTime, 0.02);
};

export const isMuted = (): boolean => muted;

const noiseBuffer = (duration: number, shape: (p: number) => number): AudioBuffer => {
  const length = Math.floor(ctx!.sampleRate * duration);
  const buffer = ctx!.createBuffer(1, length, ctx!.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * shape(i / length);
  return buffer;
};

interface ToneOptions {
  freq: number;
  to?: number;
  type?: OscillatorType;
  at?: number; // offset in seconds from now
  duration?: number;
  gain?: number;
  attack?: number;
}

const tone = ({ freq, to, type = 'sine', at = 0, duration = 0.25, gain = 0.15, attack = 0.005 }: ToneOptions) => {
  if (!ctx || !master) return;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + duration);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(env);
  env.connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
};

const tick = (at: number, pitch: number, gain = 0.08) => {
  if (!ctx || !master) return;
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.05, (p) => Math.pow(1 - p, 6));
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = pitch;
  filter.Q.value = 3;
  const env = ctx.createGain();
  env.gain.value = gain;
  src.connect(filter);
  filter.connect(env);
  env.connect(master);
  src.start(t);
};

/**
 * Tension riser for the length of the roll: a rising drone plus dice clatter
 * that speeds up as the reveal approaches.
 */
export const playRoll = (durationMs: number): (() => void) => {
  if (!ctx || !master) return () => {};
  const duration = durationMs / 1000;
  const t0 = ctx.currentTime;

  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(70, t0);
  osc.frequency.exponentialRampToValueAtTime(430, t0 + duration);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(320, t0);
  filter.frequency.exponentialRampToValueAtTime(2600, t0 + duration);
  filter.Q.value = 6;
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(0.05, t0 + 0.15);
  env.gain.exponentialRampToValueAtTime(0.11, t0 + duration);
  osc.connect(filter);
  filter.connect(env);
  env.connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);

  // Clatter: spacing tightens from 150ms to 45ms so the roll feels like it is
  // accelerating towards the answer.
  let at = 0.02;
  let gap = 0.15;
  while (at < duration - 0.05) {
    tick(at, 900 + Math.random() * 1400, 0.05 + 0.05 * (at / duration));
    at += gap;
    gap = Math.max(0.045, gap * 0.86);
  }

  return () => {
    if (!ctx) return;
    env.gain.cancelScheduledValues(ctx.currentTime);
    env.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03);
  };
};

/** The die hits the pedestal */
export const playImpact = (): void => {
  if (!ctx || !master) return;
  tone({ freq: 180, to: 45, type: 'sine', duration: 0.32, gain: 0.32 });
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.25, (p) => Math.pow(1 - p, 4));
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2600, t);
  filter.frequency.exponentialRampToValueAtTime(300, t + 0.25);
  const env = ctx.createGain();
  env.gain.value = 0.18;
  src.connect(filter);
  filter.connect(env);
  env.connect(master);
  src.start(t);
};

const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const hz = (semitone: number) => 261.63 * Math.pow(2, semitone / 12);

/**
 * Win chime. The whole arpeggio transposes up with the streak (capped), which
 * is the "coin combo" trick — the reward literally sounds better every time.
 */
export const playWin = (streak: number, tierIndex: number): void => {
  if (!ctx || !master) return;
  const transpose = Math.min(streak - 1, 14);
  const noteCount = Math.min(3 + tierIndex, PENTATONIC.length);
  for (let i = 0; i < noteCount; i++) {
    const semitone = PENTATONIC[i] + transpose;
    tone({ freq: hz(semitone), type: 'triangle', at: i * 0.055, duration: 0.4, gain: 0.13 });
    tone({ freq: hz(semitone + 12), type: 'sine', at: i * 0.055, duration: 0.28, gain: 0.06 });
  }
  tone({ freq: hz(PENTATONIC[0] + transpose - 12), type: 'sine', duration: 0.5, gain: 0.1 });
};

/** Milestone fanfare — deliberately bigger than a normal win */
export const playMilestone = (): void => {
  if (!ctx || !master) return;
  [0, 4, 7, 12, 16, 19, 24].forEach((semitone, i) => {
    tone({ freq: hz(semitone + 12), type: 'square', at: 0.1 + i * 0.07, duration: 0.45, gain: 0.09 });
    tone({ freq: hz(semitone + 12), type: 'sine', at: 0.1 + i * 0.07, duration: 0.6, gain: 0.08 });
  });
  tone({ freq: hz(0), to: hz(12), type: 'sawtooth', duration: 0.6, gain: 0.06 });
};

/** New personal best */
export const playRecord = (): void => {
  if (!ctx || !master) return;
  [24, 28, 31, 36].forEach((semitone, i) => {
    tone({ freq: hz(semitone), type: 'sine', at: i * 0.05, duration: 0.7, gain: 0.09 });
  });
};

/** Calamity: explosion plus a falling siren */
export const playLose = (): void => {
  if (!ctx || !master) return;
  const t = ctx.currentTime;

  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(2.5, (p) => Math.pow(1 - p, 2));
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1400, t);
  filter.frequency.exponentialRampToValueAtTime(40, t + 2);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.9, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 2);
  src.connect(filter);
  filter.connect(env);
  env.connect(master);
  src.start(t);

  tone({ freq: 300, to: 40, type: 'sawtooth', duration: 1.4, gain: 0.18 });
  tone({ freq: 148, to: 30, type: 'square', at: 0.05, duration: 1.1, gain: 0.1 });
};

/** Short blip for UI interactions */
export const playClick = (): void => {
  tone({ freq: 620, to: 880, type: 'square', duration: 0.07, gain: 0.05 });
};
