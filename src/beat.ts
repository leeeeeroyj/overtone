/**
 * The beat clock. Everything that keeps time (spawns, enemy fire, warnings, the landscape's lights) reads it.
 * For now it runs on scene time; once the music plays it will follow the audio clock instead.
 */
export class BeatClock {
  /** Seconds since the movement started. */
  time = 0;
  /** The current beat, counted from 0. */
  beat = -1;
  /** How far through the current beat, 0..1. */
  frac = 0;
  /** A pulse that's 1 on the beat and decays through it. */
  env = 0;

  constructor(public bpm: number) {}

  /** Seconds per beat. */
  get spb() {
    return 60 / this.bpm;
  }

  /** Advances the clock. Returns the new beat's number on the frame a beat starts, otherwise null. */
  update(dt: number): number | null {
    this.time += dt;
    const bf = this.time / this.spb;
    const b = Math.floor(bf);
    this.frac = bf - b;
    this.env = Math.exp(-this.frac * 5);
    if (b === this.beat) return null;
    this.beat = b;
    return b;
  }

  /** True within `window` seconds either side of a beat. */
  onBeat(window: number) {
    return Math.min(this.frac, 1 - this.frac) * this.spb < window;
  }
}
