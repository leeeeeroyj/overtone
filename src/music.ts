import type { BeatClock } from './beat';
import { mod, noteHz, type Synth } from './synth';

/** Bass roots for each bar, as scale degrees: a four-bar minor loop. */
const BASS = [0, 0, 3, 2];
/** How far ahead beats are scheduled, s. */
const LOOKAHEAD = 0.12;

/**
 * The band for Movement I: a kick on every beat, a hat on the off-beat, a bass note per beat and a pad chord per bar.
 * Each beat is scheduled on the audio clock a little ahead of time, at the moment the beat clock will reach it, so
 * the music lands on the beat however uneven the frames are.
 */
export class Band {
  private next = 0;

  constructor(private readonly synth: Synth) {}

  /** Call every frame after the beat clock has advanced. */
  update(beat: BeatClock) {
    if (!this.synth.live) {
      // Silent: skip ahead, so turning the sound on doesn't play a backlog.
      this.next = Math.max(this.next, Math.ceil(beat.time / beat.spb));
      return;
    }
    while (this.next * beat.spb <= beat.time + LOOKAHEAD) {
      this.play(this.next, this.next * beat.spb - beat.time, beat.spb);
      this.next++;
    }
  }

  /** Jump to a new point in the music (after the beat clock is moved). */
  seek(beat: BeatClock) {
    this.next = Math.ceil(beat.time / beat.spb);
  }

  private play(b: number, when: number, spb: number) {
    const s = this.synth;
    s.voice('sine', 130, 42, 0.16, 0.9, when);
    s.hat(0.25, when + spb / 2);
    const root = BASS[mod(Math.floor(b / 4), 4)];
    s.voice('triangle', noteHz(root, 55), noteHz(root, 55), spb * 0.8, 0.35, when);
    if (mod(b, 4) === 0) for (const d of [0, 2, 4]) s.voice('sine', noteHz(root + d, 220), noteHz(root + d, 220), spb * 3.5, 0.05, when);
  }
}
