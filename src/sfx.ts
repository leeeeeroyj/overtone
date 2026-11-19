import type { BeatClock } from './beat';
import { HEIGHT, TOP } from './config';
import type { Band } from './music';
import type { Synth } from './synth';

/** How high on screen, 0 (bottom) to `steps` (top). */
const height = (y: number, steps: number) => Math.round(((HEIGHT - y) / (HEIGHT - TOP)) * steps);
/** Chord tones, as scale degrees above the chord's root, rising through three octaves. */
const TONES = [0, 2, 4, 7, 9, 11, 14, 16, 18];

/**
 * The game's sound effects, in the movement's key and on the band's current chord, so everything you do harmonises
 * with the music. Kills and pickups land on the next sixteenth of the music; anything you must react to (shots,
 * hits) sounds at once.
 */
export class Sfx {
  private lastShot = -1;
  private lastClink = -1;
  private charge: OscillatorNode | undefined;

  constructor(private readonly synth: Synth, private readonly band: Band, private readonly beat: BeatClock) {}

  /** The next sixteenth of the music on the audio clock (or now, if the beat isn't locked to it). */
  private grid(div = 4) {
    const now = this.synth.now;
    const { beat } = this;
    const zero = beat.audioAt(0);
    if (zero === undefined) return now;
    const step = beat.spb / div;
    return zero + Math.ceil((now - zero) / step - 0.15) * step;
  }

  /** A chord tone `i` steps up from the current chord's root, `octave` times the tonic. */
  private tone(i: number, octave: number) {
    const root = this.band.chordAt(this.beat.beat);
    return this.band.hz(root + TONES[Math.max(0, Math.min(TONES.length - 1, i))], octave);
  }

  private bell(f: number, vol: number, dur: number, when?: number) {
    this.synth.voice('sine', f, f, dur, vol, when);
    this.synth.voice('sine', f * 2.76, f * 2.76, dur * 0.5, vol * 0.4, when);
    this.synth.voice('sine', f * 5.4, f * 5.4, dur * 0.25, vol * 0.2, when);
  }

  /** A shot, pitched by the craft's height. At most one every 0.24 s, or the stream turns into a buzz. */
  shot(y: number) {
    const now = this.synth.now;
    if (now - this.lastShot < 0.24) return;
    this.lastShot = now;
    const f = this.tone(height(y, 5) + 2, 4);
    this.synth.voice('square', f, f, 0.06, 0.025, undefined, { cutoff: [3000, 1200] });
  }

  /** A kill: a chord on the enemy's height over a thump, on the next sixteenth. Big ones add a boom. */
  kill(y: number, big = false) {
    const t = this.grid();
    const h = height(y, 4);
    for (const d of [0, 1, 2]) {
      const f = this.tone(h + d, 4);
      this.synth.voice('triangle', f, f, 0.28, 0.07, t);
    }
    this.synth.voice('sine', 400, 60, 0.18, 0.2, t);
    if (big) {
      this.synth.noise(0.25, 0.6, 'lowpass', 1800, t, 1, 90);
      this.synth.voice('sine', 110, 35, 0.5, 0.35, t);
    }
  }

  /** A pickup: the chord rising, on the next sixteenth. */
  pickup() {
    const t = this.grid();
    const step = this.beat.spb / 8;
    for (let i = 0; i < 4; i++) {
      const f = this.tone(3 + i, 4);
      this.synth.voice('triangle', f, f, 0.22, 0.08, t + i * step);
    }
  }

  /** The Echo launched: a rising sweep. */
  echoOut() {
    this.synth.voice('sine', 300, 1200, 0.18, 0.12);
    this.synth.noise(0.05, 0.18, 'bandpass', 800, undefined, 4, 4000);
  }

  /** The Echo called back: a falling sweep. */
  echoBack() {
    this.synth.voice('sine', 1200, 300, 0.18, 0.1);
    this.synth.noise(0.04, 0.18, 'bandpass', 4000, undefined, 4, 800);
  }

  /** The Echo knocked loose: a sagging warble. */
  echoLoose() {
    this.synth.voice('square', 620, 180, 0.45, 0.05, undefined, { cutoff: [2000, 300], vibrato: 60 });
  }

  /** The Echo back on the craft: a click and two notes. */
  echoCatch() {
    this.synth.noise(0.08, 0.02, 'highpass', 4000);
    const t = this.synth.now;
    this.synth.voice('triangle', this.tone(3, 4), this.tone(3, 4), 0.12, 0.08, t);
    this.synth.voice('triangle', this.tone(4, 4), this.tone(4, 4), 0.16, 0.08, t + 0.06);
  }

  beam(tier: number, resonant: boolean) {
    this.synth.voice('sawtooth', 880, 110, 0.35 + tier * 0.1, 0.12, undefined, { cutoff: [5000, 400] });
    if (resonant) this.resonant();
  }

  /** A resonant release: a struck bell on the chord, with its fifth. */
  resonant() {
    this.bell(this.tone(3, 4), 0.12, 1.4);
    this.bell(this.tone(5, 4), 0.06, 1.1);
  }

  hit() {
    this.synth.voice('sawtooth', 300, 70, 0.3, 0.15);
  }

  shipLost() {
    this.synth.voice('sawtooth', 440, 40, 0.9, 0.2);
    this.synth.voice('triangle', this.band.hz(7, 4), this.band.hz(0, 4), 0.9, 0.12);
    this.synth.noise(0.2, 0.8, 'lowpass', 2500, undefined, 1, 100);
  }

  /** Another ship: five notes up the chord. */
  extraShip() {
    const t = this.grid();
    for (let i = 0; i < 5; i++) this.synth.voice('square', this.tone(2 + i, 4), this.tone(2 + i, 4), 0.14, 0.04, t + i * 0.06, { cutoff: [3000, 1000] });
  }

  /** A CHORD bonus: the whole chord struck as bells. */
  chord() {
    const t = this.grid();
    for (let i = 0; i < 4; i++) this.bell(this.tone(3 + i, 4), 0.05, 1.2, t);
  }

  /** The boss arrives: a low rumble and a horn falling a fifth. */
  bossArrive() {
    this.synth.noise(0.18, 2.2, 'lowpass', 220, undefined, 2, 60);
    this.synth.voice('sawtooth', this.band.hz(4, 1), this.band.hz(0, 1), 1.6, 0.14, undefined, { attack: 0.3, cutoff: [800, 200] });
    this.synth.voice('sawtooth', this.band.hz(4, 2), this.band.hz(0, 2), 1.6, 0.08, undefined, { attack: 0.3, cutoff: [1200, 300] });
  }

  /** A shot glancing off armour: a metallic clink, a few times a second at most. */
  glance() {
    const now = this.synth.now;
    if (now - this.lastClink < 0.09) return;
    this.lastClink = now;
    this.synth.voice('triangle', 2400, 2300, 0.05, 0.03);
    this.synth.voice('triangle', 3400, 3300, 0.04, 0.02);
  }

  /** The boss's core destroyed: a long boom, then the tonic chord rings out. */
  bossDefeat() {
    const now = this.synth.now;
    this.synth.noise(0.4, 1.8, 'lowpass', 3000, now, 1, 60);
    this.synth.voice('sine', 130, 28, 1.2, 0.5, now);
    for (const d of [0, 2, 4, 7]) this.bell(this.band.hz(d, 4), 0.05, 2.5, now + 0.35);
  }

  /** MOVEMENT COMPLETE: up the tonic chord on the beat, then held. */
  complete() {
    const t = this.grid(2);
    const step = this.beat.spb / 2;
    [0, 2, 4, 7].forEach((d, i) => {
      const f = this.band.hz(d, 4);
      this.synth.voice('square', f, f, i === 3 ? step * 6 : step * 0.9, 0.06, t + i * step, { cutoff: [3000, 900], vibrato: i === 3 ? 10 : 0 });
    });
    for (const d of [0, 2, 4]) this.synth.voice('sawtooth', this.band.hz(d, 2), this.band.hz(d, 2), step * 9, 0.04, t + 3 * step, { attack: 0.1, cutoff: [1500, 400] });
  }

  /** GAME OVER: a slow fall down the scale. */
  gameOver() {
    const now = this.synth.now + 0.3;
    [4, 3, 2, 1, 0].forEach((d, i) => {
      const f = this.band.hz(d, 2);
      this.synth.voice('triangle', f, f, i === 4 ? 2.2 : 0.5, 0.12, now + i * 0.32, { vibrato: 8 });
    });
  }

  /** Paused (a falling pair) or resumed (a rising pair). */
  pause(on: boolean) {
    const t = this.synth.now;
    const [a, b] = on ? [4, 0] : [0, 4];
    this.synth.voice('triangle', this.band.hz(a, 4), this.band.hz(a, 4), 0.1, 0.07, t);
    this.synth.voice('triangle', this.band.hz(b, 4), this.band.hz(b, 4), 0.14, 0.07, t + 0.07);
  }

  /** Moving between buttons on a panel. */
  tick() {
    this.synth.voice('square', 1200, 1200, 0.03, 0.03, undefined, { cutoff: [3000, 1500] });
  }

  /** A button chosen. */
  select() {
    this.synth.voice('square', this.band.hz(7, 4), this.band.hz(9, 4), 0.12, 0.05, undefined, { cutoff: [3000, 1200] });
  }

  /** The charge hum rises a fifth-ish per tier and slides up through each beat. */
  chargeTo(tier: number, partBeat: number) {
    this.charge ??= this.synth.drone('sine', 220, 0.04);
    this.charge?.frequency.setTargetAtTime(220 * 2 ** (tier / 2) * (1 + partBeat * 0.5), this.synth.now, 0.05);
  }

  chargeStop() {
    try {
      this.charge?.stop();
    } catch {
      // Already stopped.
    }
    this.charge = undefined;
  }
}
