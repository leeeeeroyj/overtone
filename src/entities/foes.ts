import Phaser from 'phaser';
import { FOES, HEIGHT, NOTES, TOP, WIDTH, type FoeKind } from '../config';
import { hsl } from '../effects';
import { clamp } from '../land/bake';
import { mod } from '../synth';
import type { StageScene } from '../scenes/StageScene';

export interface Foe {
  kind: FoeKind;
  x: number;
  y: number;
  /** Where its sine path is centred (Flutters, Couriers, Eels). */
  y0: number;
  /** Where it entered, for Eels, whose path is a function of time. */
  x0: number;
  vx: number;
  vy: number;
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
  /** Saws: quarter turns so far. */
  spin: number;
  /** Striders: standing on the floor (ready to hop). */
  onGround: boolean;
  /** Flutters: the formation and the place in it. Eel segments: the place behind the head. */
  group: number;
  i: number;
  /** Eel segments: their head. */
  head: Foe | undefined;
  /** Left the screen alive (a formation with an escapee pays no CHORD). */
  escaped: boolean;
  dead: boolean;
  /** Eel segments are drawn orbs, not sprites. */
  img: Phaser.GameObjects.Image | undefined;
}

export interface SpawnOptions {
  /** 1: on the floor, -1: on the ceiling. */
  ground?: 1 | -1;
  y?: number;
  phase?: number;
  vx?: number;
  vy?: number;
  group?: number;
  i?: number;
  head?: Foe;
}

/** Eel segments follow the head's path this many seconds apart. */
const EEL_LAG = 0.085;
const EEL = { speed: 76, amp: 44, freq: 2.1, segments: 7 };

/** Adds an enemy at screen x. Sentries and Snappers go on the floor unless told otherwise. */
export function spawnFoe(stage: StageScene, kind: FoeKind, x: number, opts: SpawnOptions = {}): Foe {
  const def = FOES[kind];
  const ground = opts.ground ?? (kind === 'drummer' || kind === 'horn' ? 1 : 0);
  const y = opts.y ?? (TOP + HEIGHT) / 2;
  const img = kind === 'eel' ? undefined : stage.add.image(x, y, def.sprite).setDepth(8).setFlipY(ground < 0);
  const e: Foe = {
    kind, x, y, y0: y, x0: x, vx: opts.vx ?? 0, vy: opts.vy ?? 0, hp: def.hp, r: def.r, t: 0, flash: 0,
    every: def.every, phase: opts.phase ?? def.phase, ground, warn: false, wx: stage.scrollX + x, spin: 0,
    onGround: false, group: opts.group ?? 0, i: opts.i ?? 0, head: opts.head, escaped: false, dead: false, img,
  };
  settle(stage, e);
  if (kind === 'metronome') e.y = stage.terrain.floorY(e.wx) - 8;
  stage.foes.push(e);
  if (kind === 'eelhead') for (let i = 1; i <= EEL.segments; i++) spawnFoe(stage, 'eel', x, { y, head: e, i });
  return e;
}

/** Terrain-bound enemies sit with their 16 px art against the edge. */
function settle(stage: StageScene, e: Foe) {
  if (e.ground > 0) e.y = stage.terrain.floorY(e.wx) - 8;
  else if (e.ground < 0) e.y = stage.terrain.ceilY(e.wx) + 8;
}

export function updateFoes(stage: StageScene, dt: number) {
  const { beat, terrain, scrollX } = stage;
  const scroll = stage.scrollSpeed;
  for (const e of stage.foes) {
    if (e.dead) continue;
    e.t += dt;
    e.flash = Math.max(0, e.flash - dt);
    switch (e.kind) {
      case 'chirp':
        e.x -= (56 + 80 * beat.env) * dt;
        e.y = e.y0 + 22 * Math.sin((beat.time / beat.spb) * (Math.PI / 2) + e.i * 0.7);
        break;
      case 'jelly': {
        e.x -= 30 * dt;
        e.vy = (e.vy + 50 * dt) * Math.exp(-1.8 * dt);
        const wx = scrollX + e.x;
        e.y = clamp(e.y + e.vy * dt, terrain.ceilY(wx) + 10, terrain.floorY(wx) - 10);
        break;
      }
      case 'drummer':
      case 'horn':
        // Pinned to the terrain, so it scrolls with it.
        e.x = e.wx - scrollX;
        settle(stage, e);
        break;
      case 'metronome': {
        e.x -= (scroll + 12) * dt;
        e.vy += 260 * dt;
        e.y += e.vy * dt;
        const fy = terrain.floorY(scrollX + e.x) - 8;
        if (e.y >= fy) {
          e.y = fy;
          e.vy = 0;
          e.onGround = true;
        }
        break;
      }
      case 'cymbal':
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.vy -= e.vy * 0.6 * dt;
        e.spin += dt * 14;
        break;
      case 'carrier':
        e.x -= 34 * dt;
        e.y = e.y0 + 18 * Math.sin(e.t * 1.6);
        break;
      case 'eelhead':
        e.x = e.x0 - EEL.speed * e.t;
        e.y = e.y0 + EEL.amp * Math.sin(e.t * EEL.freq);
        break;
      case 'eel': {
        // The body retraces the head's path, each segment a little behind.
        const h = e.head!;
        if (h.dead) {
          e.dead = true;
          break;
        }
        const tt = h.t - e.i * EEL_LAG;
        e.x = h.x0 - EEL.speed * tt;
        e.y = h.y0 + EEL.amp * Math.sin(tt * EEL.freq);
        break;
      }
    }
    e.warn = e.every > 0 && onScreen(e) && mod(beat.beat + 1 - e.phase, e.every) === 0 && beat.frac > 0.5;
    if (e.x < -24) {
      e.dead = true;
      e.escaped = true;
    }
  }
}

/** On each beat: Jellies pulse, Striders hop, and anything due to fire does. */
export function foesOnBeat(stage: StageScene, b: number) {
  for (const e of stage.foes) {
    if (e.dead) continue;
    if (e.kind === 'jelly') e.vy = -34;
    if (e.kind === 'metronome' && e.onGround && mod(b, 2) === 0) {
      e.vy = -78;
      e.onGround = false;
    }
    if (!e.every || !onScreen(e) || mod(b - e.phase, e.every) !== 0) continue;
    const aim = Math.atan2(stage.craft.y - e.y, stage.craft.x - e.x);
    // Notes fly faster each ENCORE.
    const k = stage.noteScale;
    const shoot = (a: number, speed: number) => stage.addNote(e.x, e.y, Math.cos(a) * speed * k, Math.sin(a) * speed * k);
    if (e.kind === 'drummer') shoot(aim, NOTES.speed);
    else if (e.kind === 'jelly') for (let i = 0; i < 6; i++) shoot((i / 6) * Math.PI * 2 + e.t, 52);
    else if (e.kind === 'metronome') {
      shoot(-Math.PI * 0.75, 70);
      shoot(-Math.PI * 0.6, 70);
    } else if (e.kind === 'horn') for (let i = -2; i <= 2; i++) shoot(aim + i * 0.22, 66);
  }
}

const onScreen = (e: Foe) => e.x > 4 && e.x < WIDTH - 4;

/**
 * Positions each sprite: Flutters flap, Saws turn in quarter turns, things in the air hop a pixel on the beat, and
 * anything hit or about to fire shows white (blinking while it warns). Eel segments are drawn as orbs into `g`.
 */
export function drawFoes(stage: StageScene, g: Phaser.GameObjects.Graphics) {
  const { beat } = stage;
  const blink = Math.floor(beat.time * 16) % 2 === 0;
  const hop = Math.round(beat.env * 1.2);
  const hue = stage.land.hue;
  for (const e of stage.foes) {
    const white = e.flash > 0 || (e.warn && blink);
    if (e.kind === 'eel') {
      const x = Math.round(e.x);
      const y = Math.round(e.y);
      g.fillStyle(0x000000).fillCircle(x, y, 5);
      g.fillStyle(white ? 0xffffff : hsl(hue + e.i * 40 + 30, 0.3, 0.9)).fillCircle(x, y, 4);
      g.fillStyle(white ? 0xffffff : hsl(hue + e.i * 40, 0.62)).fillCircle(x - 1, y - 1, 2);
      g.fillStyle(0xffffff).fillRect(x - 2, y - 2, 1, 1);
      continue;
    }
    const grounded = e.ground !== 0 || e.kind === 'metronome' || e.kind === 'cymbal';
    const img = e.img!;
    img
      .setPosition(Math.round(e.x), Math.round(e.y) - (grounded ? 0 : hop))
      .setTintMode(white ? Phaser.TintModes.FILL : Phaser.TintModes.MULTIPLY);
    if (e.kind === 'chirp') img.setScale(Math.floor(e.t * 8) % 2 ? 0.75 : 1, 1);
    if (e.kind === 'cymbal') img.setAngle((Math.floor(e.spin) % 4) * 90);
  }
}
