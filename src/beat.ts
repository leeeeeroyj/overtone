/**
 * The beat clock. Everything that keeps time (spawns, enemy fire, warnings, the landscape's lights, the music) reads it.
 * While the audio clock runs it follows that clock exactly, so the music and the visuals can never drift apart;
 * without audio (silent until the first key press, attract mode) it runs on frame time.
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
  /** How many times it has (re)anchored to the audio clock: the band reschedules when this changes. */
  anchors = 0;
  /** The audio clock's time at beat time 0, while locked to it. */
  private origin: number | undefined;

  constructor(public bpm: number) {}

  /** Seconds per beat. */
  get spb() {
    return 60 / this.bpm;
  }

  /** Following the audio clock. */
  get locked() {
    return this.origin !== undefined;
  }

  /** The audio-clock time of beat `b` (fractions allowed), while locked. */
  audioAt(b: number) {
    return this.origin === undefined ? undefined : this.origin + b * this.spb;
  }

  /**
   * Advances the clock by `dt`, or to the audio clock's `audio` time when it's running. A jump bigger than half a
   * beat (a pause, a hitch, a hidden tab, a test moving the clock) isn't followed: the clock re-anchors and carries on
   * from where it was. Returns the new beat's number on the frame a beat starts, otherwise null.
   */
  update(dt: number, audio?: number): number | null {
    if (audio === undefined) {
      this.origin = undefined;
      this.time += dt;
    } else {
      const target = this.origin === undefined ? NaN : audio - this.origin;
      if (Math.abs(target - this.time) < Math.min(0.25, this.spb * 0.5)) this.time = Math.max(this.time, target);
      else {
        this.time += dt;
        this.origin = audio - this.time;
        this.anchors++;
      }
    }
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
