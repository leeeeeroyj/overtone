import Phaser from 'phaser';
import { FOES, NOTES, WIDTH, type FoeKind } from '../config';
import { mod } from '../synth';
import type { StageScene } from '../scenes/StageScene';

export interface Foe {
  kind: FoeKind;
  x: number;
  y: number;
  hp: number;
  r: number;
  /** Seconds alive. */
  t: number;
  /** Seconds left of the white hit flash. */
  flash: number;
  /** Fires every `every` beats, on beats where (beat - phase) is a multiple of it. 0: never. */
  every: number;
  phase: number;
  /** 1 on the floor, -1 on the ceiling, 0 in the air. */
  ground: 0 | 1 | -1;
  /** True for the half-beat before it fires (it flashes white). */
  warn: boolean;
  /** The world x it's pinned to, for things that sit on the terrain. */
  wx: number;
  dead: boolean;
  img: Phaser.GameObjects.Image;
}

export interface SpawnOptions {
  /** 1: on the floor, -1: on the ceiling. */
  ground?: 1 | -1;
  y?: number;
  phase?: number;
}

/** Adds an enemy at screen x. Sentries go on the floor unless told otherwise. */
export function spawnFoe(stage: StageScene, kind: FoeKind, x: number, opts: SpawnOptions = {}): Foe {
  const def = FOES[kind];
  const ground = opts.ground ?? (kind === 'drummer' ? 1 : 0);
  const img = stage.add.image(x, 0, kind).setDepth(8).setFlipY(ground < 0);
  const e: Foe = {
    kind, x, y: opts.y ?? 0, hp: def.hp, r: def.r, t: 0, flash: 0, every: def.every, phase: opts.phase ?? 0,
    ground, warn: false, wx: stage.scrollX + x, dead: false, img,
  };
  settle(stage, e);
  stage.foes.push(e);
  return e;
}

/** Terrain-bound enemies sit with their 16 px art against the edge. */
function settle(stage: StageScene, e: Foe) {
  if (e.ground > 0) e.y = stage.terrain.floorY(e.wx) - 8;
  else if (e.ground < 0) e.y = stage.terrain.ceilY(e.wx) + 8;
}

export function updateFoes(stage: StageScene, dt: number) {
  const { beat } = stage;
  for (const e of stage.foes) {
    if (e.dead) continue;
    e.t += dt;
    e.flash = Math.max(0, e.flash - dt);
    if (e.ground) {
      // Pinned to the terrain, so it scrolls with it.
      e.x = e.wx - stage.scrollX;
      settle(stage, e);
    }
    e.warn = e.every > 0 && onScreen(e) && mod(beat.beat + 1 - e.phase, e.every) === 0 && beat.frac > 0.5;
    if (e.x < -24) e.dead = true;
  }
}

/** On each beat, anything due to fire does. */
export function foesOnBeat(stage: StageScene, b: number) {
  for (const e of stage.foes) {
    if (e.dead || !e.every || !onScreen(e) || mod(b - e.phase, e.every) !== 0) continue;
    const aim = Math.atan2(stage.craft.y - e.y, stage.craft.x - e.x);
    stage.addNote(e.x, e.y, Math.cos(aim) * NOTES.speed, Math.sin(aim) * NOTES.speed);
  }
}

const onScreen = (e: Foe) => e.x > 4 && e.x < WIDTH - 4;

/** Positions each sprite; anything hit or about to fire shows white (blinking while it warns). */
export function drawFoes(stage: StageScene) {
  const blink = Math.floor(stage.beat.time * 16) % 2 === 0;
  for (const e of stage.foes) {
    const white = e.flash > 0 || (e.warn && blink);
    e.img
      .setPosition(Math.round(e.x), Math.round(e.y))
      .setTintMode(white ? Phaser.TintModes.FILL : Phaser.TintModes.MULTIPLY);
  }
}
