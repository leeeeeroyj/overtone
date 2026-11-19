import { CHORD, FOES, WIDTH } from './config';
import { spawnFoe } from './entities/foes';
import type { StageScene } from './scenes/StageScene';
import type { Terrain } from './terrain';

export const PATTERNS = ['flutters', 'sentries', 'jellies', 'courier', 'saws', 'striders', 'snapper', 'eel'] as const;
export type Pattern = (typeof PATTERNS)[number];

/**
 * Each movement's waves, one token per bar (four beats), read left to right. `.` is a quiet bar and `+` puts two
 * waves in one bar. A wave is announced on the bar's first beat and arrives on its second.
 *   F flutters (Fh high, Fl low)   S sentries, floor and ceiling (Sf floor only, Sc ceiling only)   J jellies
 *   C courier   W saws   T striders   N snapper on the floor (Nc on the ceiling)   E eel (Eh high, El low)
 */
const SCRIPTS = [
  // I Pulse: it starts gently and builds; every pickup comes round twice or more.
  `. F . S   F . C F   S . J F   . S C F
   J S F W   C F T S   Fh J F N   C Fl W S
   F J S C   E F S W   Fh T C F   Nc J S F
   C F+Sf W J   F T C E   S Fh+Sc W N   C F J S
   F . S W   C J F+S E   N C F T   S W F .`,
  // II Strings: the cave closes in; Jellies, Eels and Saws ride the strings.
  `. J . F   E . C J   S F W .   C El J F
   T S J Fh   C E W S   J F N C   Eh J Fl S
   W C J+Sf E   F S C W   J Nc E F   C S J W
   E F+Sc T C   J W Eh S   N C J F   El W C S
   J F E C   W S+J F N   C Eh W J   F S . .`,
  // III Crescendo: everything at once.
  `. F+S . J+W   E C F+S N   J W+Fh C E   S+F T Nc C
   F+J W E S   C Fl+Sf J+W N   E C F+S Fh   J+W C El T
   F+S Nc+J C W   E F+Sc J S   C W+F E N   J+Fh C S+F W
   Eh C J+W F+S   N T C E   F+J W S C   Fl+Sf E J+W Nc
   C F+S W E   J C F+W N   S+Fh E C J+W   F+S . . .`,
];

export interface Wave {
  bar: number;
  pattern: Pattern;
  /** The variant letter: h/l (height), f/c (floor/ceiling), or ''. */
  variant: string;
}

const CODES: Record<string, Pattern> = { F: 'flutters', S: 'sentries', J: 'jellies', C: 'courier', W: 'saws', T: 'striders', N: 'snapper', E: 'eel' };

/** A movement's waves, parsed from its script. */
export function waves(movement: number): Wave[] {
  const bars = (SCRIPTS[movement] ?? SCRIPTS[0]).trim().split(/\s+/);
  return bars.flatMap((token, bar) =>
    token === '.' ? [] : token.split('+').map((w) => ({ bar, pattern: CODES[w[0]], variant: w.slice(1) })),
  );
}

/** How many bars a movement's script runs. */
export const scriptBars = (movement: number) => (SCRIPTS[movement] ?? SCRIPTS[0]).trim().split(/\s+/).length;

const cache = new Map<number, Map<number, Wave[]>>();

/** The waves announced on this beat (only ever the first beat of a bar). */
export function wavesAt(movement: number, beat: number): Wave[] {
  if (beat < 0 || beat % 4 !== 0) return [];
  let byBar = cache.get(movement);
  if (!byBar) {
    byBar = new Map();
    for (const w of waves(movement)) byBar.set(w.bar, [...(byBar.get(w.bar) ?? []), w]);
    cache.set(movement, byBar);
  }
  return byBar.get(beat / 4) ?? [];
}

/** Where things arrive: just off the right edge. Sentries and Snappers are pinned to the terrain there. */
export const ARRIVE_X = WIDTH + 14;
/** Screen x offsets of the pinned enemies in each pattern, and which edge they sit on (for the reachability check). */
export const PINNED: Partial<Record<Pattern, (variant: string) => { dx: number; ground: 1 | -1 }[]>> = {
  sentries: (v) => [
    ...(v === 'c' ? [] : [{ dx: 0, ground: 1 as const }]),
    ...(v === 'f' ? [] : [{ dx: 40, ground: -1 as const }]),
  ],
  snapper: (v) => [{ dx: 6, ground: v === 'c' ? -1 : 1 }],
};

/**
 * Where a movement's pinned enemies end up in the world, from the script alone: each arrives one beat after its bar
 * starts, at ARRIVE_X plus its offset, on the floor or ceiling there. For the reachability check.
 */
export function pinnedSpots(movement: number, bpm: number, scroll: number, terrain: Terrain) {
  const spb = 60 / bpm;
  return waves(movement).flatMap((w) => {
    const spots = PINNED[w.pattern]?.(w.variant) ?? [];
    const kind = w.pattern === 'snapper' ? 'horn' : 'drummer';
    const scrollX = scroll * (w.bar * 4 + 1) * spb;
    return spots.map(({ dx, ground }) => {
      const wx = scrollX + ARRIVE_X + dx;
      return { kind, wx, y: ground > 0 ? terrain.floorY(wx) - 8 : terrain.ceilY(wx) + 8, r: FOES[kind].r };
    });
  });
}

let groups = 0;

/**
 * Starts a wave. Everything is announced: a chevron blinks at the right edge, at the height it will arrive,
 * one beat before it does.
 */
export function runPattern(stage: StageScene, p: Pattern, variant = '') {
  const R = ARRIVE_X;
  const { terrain } = stage;
  const floorAt = (x: number) => terrain.floorY(stage.scrollX + x) - 8;
  const ceilAt = (x: number) => terrain.ceilY(stage.scrollX + x) + 8;
  /** A height a share of the way down the open gap at the right edge. */
  const gap = (k: number) => {
    const c = ceilAt(WIDTH);
    const f = floorAt(WIDTH);
    return c + 12 + (f - c - 24) * k;
  };
  const height = variant === 'h' ? 0.25 : variant === 'l' ? 0.75 : 0.5;
  switch (p) {
    case 'flutters': {
      const g = ++groups;
      const y = gap(height);
      stage.arrive(y, () => {
        for (let i = 0; i < CHORD.size; i++) spawnFoe(stage, 'chirp', R + i * 16, { y, group: g, i });
      });
      break;
    }
    case 'sentries':
      for (const { dx, ground } of PINNED.sentries!(variant)) {
        stage.arrive(ground > 0 ? floorAt(WIDTH - 4) : ceilAt(WIDTH - 4), () => spawnFoe(stage, 'drummer', R + dx, { ground, phase: ground > 0 ? 0 : 1 }));
      }
      break;
    case 'jellies': {
      const a = gap(0.25);
      const b = gap(0.75);
      stage.arrive(a, () => spawnFoe(stage, 'jelly', R, { y: a, phase: 0 }));
      stage.arrive(b, () => spawnFoe(stage, 'jelly', R + 30, { y: b, phase: 2 }));
      break;
    }
    case 'courier': {
      const y = gap(0.5);
      stage.arrive(y, () => spawnFoe(stage, 'carrier', R, { y }));
      break;
    }
    case 'saws':
      // They fly in at your height when they arrive, so the chevrons mark where they enter.
      for (const k of [0.25, 0.75]) {
        const y = gap(k);
        stage.arrive(y, () => spawnFoe(stage, 'cymbal', WIDTH + 10, { y, vx: -185, vy: (stage.craft.y - y) * 0.55 }));
      }
      break;
    case 'striders':
      stage.arrive(floorAt(WIDTH - 4), () => {
        spawnFoe(stage, 'metronome', R);
        spawnFoe(stage, 'metronome', R + 28);
      });
      break;
    case 'snapper': {
      const [{ dx, ground }] = PINNED.snapper!(variant);
      stage.arrive(ground > 0 ? floorAt(WIDTH - 4) : ceilAt(WIDTH - 4), () => spawnFoe(stage, 'horn', R + dx, { ground }));
      break;
    }
    case 'eel': {
      const y = gap(height);
      stage.arrive(y, () => spawnFoe(stage, 'eelhead', R, { y }));
      break;
    }
  }
}
