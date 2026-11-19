import Phaser from 'phaser';

/** The minor pentatonic everything plays in: scale degree to semitones. */
const SCALE = [0, 3, 5, 7, 10];
export const mod = (a: number, n: number) => ((a % n) + n) % n;
/** A scale degree above `base` Hz, wrapping into higher octaves. */
export const noteHz = (deg: number, base = 220) => base * 2 ** ((SCALE[mod(deg, 5)] + 12 * Math.floor(deg / 5)) / 12);

const MUTE_STORAGE = 'overtone-muted';
let noise: AudioBuffer | undefined;

/**
 * Oscillator voices on Phaser's own audio context, routed through its mute node, so M and the speaker icon
 * silence everything. Without Web Audio (or before the first click or key press unlocks it) nothing plays.
 */
export class Synth {
  readonly ctx: AudioContext | undefined;
  private readonly out: AudioNode | undefined;

  constructor(private readonly scene: Phaser.Scene) {
    const sound = scene.sound;
    if (sound instanceof Phaser.Sound.WebAudioSoundManager) {
      this.ctx = sound.context;
      this.out = sound.destination;
    }
  }

  get live() {
    return !!this.ctx && this.ctx.state === 'running' && !this.scene.sound.mute;
  }

  /** The audio clock, s. */
  get now() {
    return this.ctx?.currentTime ?? 0;
  }

  /** One enveloped oscillator note, `when` seconds from now, bending from f0 to f1 Hz. */
  voice(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, when = 0) {
    if (!this.live) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + Math.max(0, when);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** A short burst of high-passed noise: a hi-hat. */
  hat(vol: number, when = 0) {
    if (!this.live) return;
    const ctx = this.ctx!;
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime + Math.max(0, when);
    const s = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    s.buffer = noise;
    f.type = 'highpass';
    f.frequency.value = 7000;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f).connect(g).connect(this.out!);
    s.start(t);
    s.stop(t + 0.06);
  }

  /** A held tone you bend and stop yourself (the charge). */
  drone(type: OscillatorType, freq: number, vol: number) {
    if (!this.live) return undefined;
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g).connect(this.out!);
    o.start();
    return o;
  }
}

/** Sound starts on unless it was switched off last visit. */
export function restoreMute(scene: Phaser.Scene) {
  try {
    scene.sound.mute = localStorage.getItem(MUTE_STORAGE) === '1';
  } catch {
    // Storage blocked: sound stays on.
  }
}

export function toggleMute(scene: Phaser.Scene) {
  scene.sound.mute = !scene.sound.mute;
  try {
    localStorage.setItem(MUTE_STORAGE, scene.sound.mute ? '1' : '0');
  } catch {
    // Storage blocked: the setting lasts for this visit only.
  }
}
