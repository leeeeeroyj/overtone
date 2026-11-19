import { HEIGHT, TOP } from './config';
import { noteHz, type Synth } from './synth';

/** How high on screen, as a scale degree: higher notes higher up. */
const degree = (y: number, steps: number) => Math.round(((HEIGHT - y) / (HEIGHT - TOP)) * steps);

/** The game's sound effects, played on the shared synth. Everything is in the movement's minor pentatonic. */
export class Sfx {
  private lastShot = -1;
  private charge: OscillatorNode | undefined;

  constructor(private readonly synth: Synth) {}

  /** A shot, pitched by the craft's height. At most one every 0.24 s, or the stream turns into a buzz. */
  shot(y: number) {
    const now = this.synth.now;
    if (now - this.lastShot < 0.24) return;
    this.lastShot = now;
    const f = noteHz(degree(y, 9), 440);
    this.synth.voice('square', f, f, 0.06, 0.03);
  }

  /** A kill plays a chord on the enemy's height, over a thump. */
  kill(y: number) {
    const deg = degree(y, 7);
    for (const d of [0, 2, 4]) this.synth.voice('triangle', noteHz(deg + d, 330), noteHz(deg + d, 330), 0.25, 0.08);
    this.synth.voice('sine', 400, 60, 0.18, 0.2);
  }

  blip(f: number) {
    this.synth.voice('sine', f, f * 1.5, 0.08, 0.12);
  }

  beam(tier: number, resonant: boolean) {
    this.synth.voice('sawtooth', 880, 110, 0.35 + tier * 0.1, 0.12);
    if (resonant) for (const d of [0, 2, 4, 5]) this.synth.voice('triangle', noteHz(d, 440), noteHz(d, 440), 0.5, 0.08);
  }

  hit() {
    this.synth.voice('sawtooth', 300, 70, 0.3, 0.15);
  }

  shipLost() {
    this.synth.voice('sawtooth', 440, 40, 0.9, 0.2);
    this.synth.voice('triangle', noteHz(0, 220), noteHz(-5, 220), 0.9, 0.12);
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
