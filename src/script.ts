import { WIDTH } from './config';
import { spawnFoe } from './entities/foes';
import type { StageScene } from './scenes/StageScene';

export type Pattern = 'sentries';

/**
 * What arrives on each beat. For now Movement I is a loop: a pair of Sentries, one on the floor and one on the
 * ceiling firing on alternate beats, every eight beats. The authored scripts come with the full roster.
 */
export function patternsAt(_movement: number, beat: number): Pattern[] {
  return beat >= 4 && beat % 8 === 4 ? ['sentries'] : [];
}

export function runPattern(stage: StageScene, p: Pattern) {
  const R = WIDTH + 14;
  if (p === 'sentries') {
    spawnFoe(stage, 'drummer', R, { ground: 1, phase: 0 });
    spawnFoe(stage, 'drummer', R + 40, { ground: -1, phase: 1 });
  }
}
