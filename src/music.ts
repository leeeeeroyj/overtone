import type { BeatClock } from './beat';
import { PLAY } from './config';
import type { Boss } from './entities/boss';
import { scriptBars } from './script';
import { mod, noteHz, type Synth, type VoiceOptions } from './synth';

/** One pitched part: its waveform, volume, length in sixteenths (0: as long as the notes are written), octave and shape. */
interface Part {
  type: OscillatorType;
  vol: number;
  len: number;
  /** Multiplies the tune's tonic. */
  octave: number;
  opts?: VoiceOptions;
}

/**
 * A movement's music. Patterns are one bar of sixteenths: drums 'x' (accent), 'o' (soft), '.' rest; bass and arp
 * digits pick chord tones (0 root, 1 third, 2 fifth, 3 octave, 4 the third above) and '+' is the root an octave up;
 * the lead is eighths over several bars, digits and letters as scale degrees from its octave, '-' holding, '.' rest.
 */
export interface Tune {
  mood: string;
  /** The mode, as semitones from the tonic. */
  scale: number[];
  /** Hz of degree 0 in the bass. */
  tonic: number;
  /** A chord root (scale degree) per bar, looped. */
  chords: number[];
  kick: string;
  snare: string;
  snareKind: 'snare' | 'rim' | 'clap';
  hat: string;
  bass: string;
  arp: string;
  lead: string;
  parts: { bass: Part; arp: Part; lead: Part; pad: Part };
}

export const TUNES: Tune[] = [
  {
    // I Pulse: A aeolian, i i VI VII. Four on the floor, a tresillo bass, a dark falling line.
    mood: 'dark and driving',
    scale: [0, 2, 3, 5, 7, 8, 10],
    tonic: 55,
    chords: [0, 0, 5, 6],
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    snareKind: 'snare',
    hat: '..x...x...x...x.',
    bass: '0..0..0.0..0..+.',
    arp: '0.1.2.1.0.1.2.3.',
    lead: '4-3-2-1-' + '0---..4-' + '5-4-2-0-' + '1-3-6---',
    parts: {
      bass: { type: 'sawtooth', vol: 0.16, len: 2, octave: 1, opts: { cutoff: [900, 160], q: 4 } },
      arp: { type: 'square', vol: 0.035, len: 1, octave: 4, opts: { cutoff: [2400, 500] } },
      lead: { type: 'square', vol: 0.05, len: 0, octave: 4, opts: { cutoff: [2200, 700], vibrato: 6 } },
      pad: { type: 'sawtooth', vol: 0.03, len: 16, octave: 4, opts: { attack: 0.4, cutoff: [700, 400] } },
    },
  },
  {
    // II Strings: D dorian, two bars on each chord (i i IV IV i i VII VII). Half time, plucked strings rolling in
    // sixteenths, a bowed line with vibrato: hypnotic, suspended.
    mood: 'mysterious and hypnotic',
    scale: [0, 2, 3, 5, 7, 9, 10],
    tonic: 73.42,
    chords: [0, 0, 3, 3, 0, 0, 6, 6],
    kick: 'x.........x.....',
    snare: '........x.......',
    snareKind: 'rim',
    hat: 'xoooxoooxoooxooo',
    bass: '0.......0.....+.',
    arp: '0123432101234321',
    lead: '4-------' + '5---6---' + '7-------' + '8---6---' + '4-------' + '2---1---' + '0-------' + '6---4---',
    parts: {
      bass: { type: 'triangle', vol: 0.3, len: 6, octave: 1 },
      arp: { type: 'sawtooth', vol: 0.045, len: 3, octave: 4, opts: { cutoff: [3200, 180], q: 2 } },
      lead: { type: 'sawtooth', vol: 0.045, len: 0, octave: 4, opts: { attack: 0.25, cutoff: [1400, 900], vibrato: 12 } },
      pad: { type: 'triangle', vol: 0.05, len: 16, octave: 2, opts: { attack: 0.8 } },
    },
  },
  {
    // III Crescendo: E major, I V vi IV. Claps on two and four, sixteenth hats, an octave bass and a fanfare.
    mood: 'triumphant',
    scale: [0, 2, 4, 5, 7, 9, 11],
    tonic: 82.41,
    chords: [0, 4, 5, 3],
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    snareKind: 'clap',
    hat: 'xoxoxoxoxoxoxoxo',
    bass: '0.+.0.+.0.+.0.+.',
    arp: '0123012301230123',
    lead: '4-4-7---' + '6-5-4---' + '5-4-2-4-' + '5---3-2-',
    parts: {
      bass: { type: 'sawtooth', vol: 0.15, len: 2, octave: 1, opts: { cutoff: [1600, 300], q: 3 } },
      arp: { type: 'square', vol: 0.03, len: 1, octave: 4, opts: { cutoff: [4000, 900] } },
      lead: { type: 'square', vol: 0.06, len: 0, octave: 4, opts: { cutoff: [3600, 1400], vibrato: 8 } },
      pad: { type: 'sawtooth', vol: 0.035, len: 16, octave: 4, opts: { attack: 0.15, cutoff: [2000, 800] } },
    },
  },
];

/** How far ahead beats are scheduled on the audio clock, s. */
const LOOKAHEAD = 0.2;

/** Which parts play in a bar: they come in one by one, drop out for a short break, and all play for the boss. */
export interface Layers {
  kick: boolean;
  hat: boolean;
  snare: boolean;
  bass: boolean;
  arp: boolean;
  lead: boolean;
}

/**
 * The band. Each beat is scheduled on the audio clock a little ahead, at the moment the beat clock (which follows the
 * same clock) reaches it, so the music lands on the beat however uneven the frames are.
 */
export class Band {
  readonly tune: Tune;
  /** The boss, once it's on: its own arrangement, a bell as the core opens and a clank as it shuts. */
  boss: Boss | undefined;
  /** Stopped (the movement complete, or game over). */
  quiet = false;
  /** Every kick scheduled: beat and audio time (the tests compare these with the beat clock). */
  readonly kicks: { b: number; at: number }[] = [];
  private next = 0;
  private anchors = -1;
  private readonly bossBar: number;

  constructor(private readonly synth: Synth, movement: number) {
    this.tune = TUNES[movement] ?? TUNES[0];
    this.bossBar = scriptBars(movement) + PLAY.outro;
  }

  /** The chord root (a scale degree) on beat `b`. */
  chordAt(b: number) {
    const c = this.tune.chords;
    return c[mod(Math.floor(b / 4), c.length)];
  }

  /** A scale degree's Hz, `octave` times the tonic. */
  hz(deg: number, octave = 1) {
    return noteHz(deg, this.tune.tonic * octave, this.tune.scale);
  }

  /** The parts playing in bar `bar`. */
  layers(bar: number): Layers {
    const all = { kick: true, hat: true, snare: true, bass: true, arp: true, lead: false };
    if (this.boss) return all;
    const brk = bar >= 48 && bar < 52;
    return {
      kick: !brk,
      hat: bar >= 4,
      snare: bar >= 16 && !brk,
      bass: bar >= 4 && !brk,
      arp: bar >= 16,
      lead: bar >= 32 && bar < this.bossBar - 4,
    };
  }

  /** Call every frame after the beat clock has advanced. */
  update(beat: BeatClock) {
    if (!beat.locked || !this.synth.live || this.quiet) {
      // Silent: skip ahead, so turning the sound on doesn't play a backlog.
      this.next = beat.beat + 1;
      return;
    }
    if (beat.anchors !== this.anchors) {
      this.anchors = beat.anchors;
      this.next = Math.max(this.next, beat.beat + 1);
    }
    const now = this.synth.now;
    for (;;) {
      const at = beat.audioAt(this.next)!;
      if (at > now + LOOKAHEAD) break;
      if (at >= now - 0.005) this.play(this.next, at, beat.spb);
      this.next++;
    }
  }

  private play(b: number, at: number, spb: number) {
    const { tune, synth: s } = this;
    const step = spb / 4;
    const bar = Math.floor(b / 4);
    const L = this.layers(bar);
    const root = this.chordAt(b);
    const tones = [0, 2, 4, 7, 9];
    const voice = (p: Part, deg: number, when: number, steps: number) =>
      s.voice(p.type, this.hz(deg, p.octave), this.hz(deg, p.octave), (p.len || steps) * step * 0.95, p.vol, when, p.opts);
    for (let k = 0; k < 4; k++) {
      const i = mod(b, 4) * 4 + k;
      const t = at + k * step;
      const kick = tune.kick[i];
      if (L.kick && kick !== '.') {
        s.voice('sine', 150, 42, 0.18, kick === 'x' ? 0.9 : 0.5, t);
        if (k === 0) this.kicks.push({ b, at: t });
      }
      const hat = tune.hat[i];
      if (L.hat && hat !== '.') s.hat(hat === 'x' ? 0.16 : 0.07, t);
      if (L.snare && tune.snare[i] === 'x') this.snare(t);
      const bn = tune.bass[i];
      if (L.bass && bn !== '.') voice(tune.parts.bass, root + (bn === '+' ? 7 : tones[+bn]), t, 1);
      const an = tune.arp[i];
      if (L.arp && an !== '.') voice(tune.parts.arp, root + tones[+an], t, 1);
      // The lead, on the eighths.
      if (L.lead && k % 2 === 0) {
        const lead = tune.lead;
        const j = mod(bar * 8 + Math.floor(i / 2), lead.length);
        const c = lead[j];
        if (c !== '.' && c !== '-') {
          let n = 1;
          while (lead[(j + n) % lead.length] === '-') n++;
          voice(tune.parts.lead, parseInt(c, 36), t, n * 2);
        }
      }
    }
    if (mod(b, 4) === 0) {
      for (const d of [0, 2, 4]) voice(tune.parts.pad, root + d, at, 16);
      // A cymbal swell into each section.
      if (bar % 8 === 0 && bar > 0) s.noise(0.08, spb * 2, 'highpass', 5000, at);
    }
    const boss = this.boss;
    if (boss && boss.dying < 0) {
      // The core opening rings a bell (two notes, root and fifth); its shutting clanks.
      if (boss.opensOn(b) && !boss.opensOn(b - 1)) {
        for (const d of [7, 11]) s.voice('sine', this.hz(root + d, 8), this.hz(root + d, 8), spb * 1.6, 0.09, at);
        s.voice('triangle', this.hz(root + 14, 8), this.hz(root + 14, 8), spb * 0.6, 0.04, at);
      } else if (!boss.opensOn(b) && boss.opensOn(b - 1)) {
        s.noise(0.12, 0.09, 'bandpass', 900, at, 3);
        s.voice('square', 140, 70, 0.08, 0.05, at);
      }
    }
    if (this.kicks.length > 600) this.kicks.splice(0, 100);
  }

  private snare(t: number) {
    const s = this.synth;
    if (this.tune.snareKind === 'rim') {
      s.noise(0.12, 0.04, 'bandpass', 3500, t, 4);
      s.voice('triangle', 900, 880, 0.03, 0.06, t);
    } else if (this.tune.snareKind === 'clap') {
      for (let i = 0; i < 3; i++) s.noise(0.14, 0.02, 'bandpass', 1300, t + i * 0.011, 1.5);
      s.noise(0.14, 0.14, 'bandpass', 1300, t + 0.033, 1.5);
    } else {
      s.noise(0.2, 0.13, 'bandpass', 1800, t, 0.8);
      s.voice('triangle', 190, 130, 0.08, 0.12, t);
    }
  }
}
