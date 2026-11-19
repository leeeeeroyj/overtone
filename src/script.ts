import { CHORD, WIDTH } from './config';
import { spawnFoe } from './entities/foes';
import type { StageScene } from './scenes/StageScene';

export const PATTERNS = ['flutters', 'sentries', 'jellies', 'courier', 'saws', 'striders', 'snapper', 'eel'] as const;
export type Pattern = (typeof PATTERNS)[number];

/** For now Movement I is a loop through every pattern, one every four beats. The authored scripts come next. */
const LOOP: Pattern[] = ['flutters', 'sentries', 'jellies', 'courier', 'saws', 'striders', 'flutters', 'snapper', 'eel', 'courier'];

/** What arrives on each beat. */
export function patternsAt(_movement: number, beat: number): Pattern[] {
  return beat >= 4 && beat % 4 === 0 ? [LOOP[(beat / 4 - 1) % LOOP.length]] : [];
}

let groups = 0;

/**
 * Starts a pattern. Everything is announced: a chevron blinks at the right edge, at the height it will arrive,
 * one beat before it does.
 */
export function runPattern(stage: StageScene, p: Pattern) {
  const R = WIDTH + 14;
  const rand = Math.random;
  const { terrain } = stage;
  const floorAt = (x: number) => terrain.floorY(stage.scrollX + x) - 8;
  const ceilAt = (x: number) => terrain.ceilY(stage.scrollX + x) + 8;
  const gap = (lo: number, hi: number) => {
    const c = ceilAt(WIDTH);
    const f = floorAt(WIDTH);
    return c + 12 + (f - c - 24) * (lo + rand() * (hi - lo));
  };
  switch (p) {
    case 'flutters': {
      const g = ++groups;
      const y = gap(0.3, 0.7);
      stage.arrive(y, () => {
        for (let i = 0; i < CHORD.size; i++) spawnFoe(stage, 'chirp', R + i * 16, { y, group: g, i });
      });
      break;
    }
    case 'sentries':
      // Pinned to the terrain, so their place is chosen when they appear.
      stage.arrive(floorAt(WIDTH - 4), () => spawnFoe(stage, 'drummer', R, { ground: 1, phase: 0 }));
      stage.arrive(ceilAt(WIDTH - 4), () => spawnFoe(stage, 'drummer', R + 40, { ground: -1, phase: 1 }));
      break;
    case 'jellies': {
      const a = gap(0.15, 0.35);
      const b = gap(0.6, 0.85);
      stage.arrive(a, () => spawnFoe(stage, 'jelly', R, { y: a, phase: 0 }));
      stage.arrive(b, () => spawnFoe(stage, 'jelly', R + 30, { y: b, phase: 2 }));
      break;
    }
    case 'courier': {
      const y = gap(0.35, 0.65);
      stage.arrive(y, () => spawnFoe(stage, 'carrier', R, { y }));
      break;
    }
    case 'saws':
      // They fly in at your height when they arrive, so the chevrons mark where they enter.
      for (const k of [0.25, 0.75]) {
        const y = gap(k, k);
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
      const ground = rand() < 0.5 ? 1 : -1;
      stage.arrive(ground > 0 ? floorAt(WIDTH - 4) : ceilAt(WIDTH - 4), () => spawnFoe(stage, 'horn', R + 6, { ground }));
      break;
    }
    case 'eel': {
      const y = gap(0.5, 0.5);
      stage.arrive(y, () => spawnFoe(stage, 'eelhead', R, { y }));
      break;
    }
  }
}
