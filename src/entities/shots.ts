import Phaser from 'phaser';
import { CHARGE, FIRE, HEIGHT, NOTES, TOP, WIDTH } from '../config';
import { hsl } from '../effects';
import type { StageScene } from '../scenes/StageScene';
import type { Foe } from './foes';

/** The craft's and its companions' shots. `z` (helix beads) is depth: beads behind the craft draw before it. */
export interface Shot {
  kind: 'note' | 'quaver' | 'helix';
  x: number;
  y: number;
  vx: number;
  y0: number;
  t: number;
  ph: number;
  amp: number;
  z: number;
  damage: number;
  dead: boolean;
}

export interface Beam {
  x0: number;
  head: number;
  tail: number;
  y: number;
  w: number;
  tier: number;
  resonant: boolean;
  damage: number;
  hit: Set<Foe>;
}

/** An enemy note: a diamond aimed at the craft. */
export interface Note {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dead: boolean;
}

export function makeShot(kind: Shot['kind'], x: number, y: number, vx: number, extra: Partial<Shot> = {}): Shot {
  return { kind, x, y, vx, y0: y, t: 0, ph: 0, amp: 0, z: 0, damage: FIRE.damage, dead: false, ...extra };
}

export function updateShots(stage: StageScene, dt: number) {
  const { terrain } = stage;
  for (const s of stage.shots) {
    s.t += dt;
    s.x += s.vx * dt;
    if (s.kind === 'quaver') s.y = s.y0 + 2.5 * Math.sin(s.ph + s.t * 10);
    else if (s.kind === 'helix') {
      s.y = s.y0 + s.amp * Math.sin(s.ph + s.t * 16);
      s.z = s.amp * Math.cos(s.ph + s.t * 16);
    }
    const wx = stage.scrollX + s.x;
    if (s.y < terrain.ceilY(wx) || s.y > terrain.floorY(wx)) {
      s.dead = true;
      stage.fx.burst(s.x, s.y, 2, stage.land.hue, 0.3);
      continue;
    }
    for (const e of stage.foes) {
      if (e.dead || Math.hypot(e.x - s.x, e.y - s.y) >= e.r + FIRE.hitPad) continue;
      s.dead = true;
      stage.damage(e, s.damage);
      stage.fx.burst(s.x, s.y, 3, stage.land.hue + 30, 0.5);
      break;
    }
  }
  stage.shots = stage.shots.filter((s) => !s.dead && s.x > -10 && s.x < WIDTH + 10 && s.y > TOP && s.y < HEIGHT);

  for (const b of stage.beams) {
    b.head += CHARGE.speed * dt;
    b.tail = Math.max(b.x0, b.head - CHARGE.length);
    for (const e of stage.foes) {
      if (e.dead || b.hit.has(e)) continue;
      if (e.x > b.tail - e.r && e.x < b.head + e.r && Math.abs(e.y - b.y) < b.w / 2 + e.r) {
        b.hit.add(e);
        stage.damage(e, b.damage, b.resonant);
      }
    }
  }
  stage.beams = stage.beams.filter((b) => b.tail < WIDTH + 10);
}

export function updateNotes(stage: StageScene, dt: number) {
  for (const n of stage.notes) {
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    if (stage.blocks(n)) {
      n.dead = true;
      stage.blocked++;
      stage.fx.burst(n.x, n.y, 4, stage.land.hue + 90, 0.4);
      continue;
    }
    if (Math.hypot(n.x - stage.craft.x, n.y - stage.craft.y) < NOTES.hit) {
      n.dead = true;
      stage.hitCraft();
    }
  }
  stage.notes = stage.notes.filter((n) => !n.dead && n.x > -8 && n.x < WIDTH + 8 && n.y > TOP - 4 && n.y < HEIGHT + 4);
}

/** A pixel quaver (the Harmonics' shot), 5 px wide and 6 tall, its head at (x, y). */
export function quaver(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillRect(x - 2, y, 3, 2);
  g.fillRect(x, y - 5, 1, 6);
  g.fillRect(x + 1, y - 5, 1, 1);
  g.fillRect(x + 2, y - 4, 1, 2);
}

/** Shots behind the craft (front = false: only helix beads swinging behind) or in front of it. */
export function drawShots(g: Phaser.GameObjects.Graphics, stage: StageScene, front: boolean) {
  const hue = stage.land.hue;
  for (const s of stage.shots) {
    if (s.kind === 'helix') {
      if (s.z >= 0 !== front) continue;
      const h = hue + (s.ph ? 160 : 0);
      const dir = Math.sign(s.vx);
      g.fillStyle(hsl(h, 0.6), 0.35).fillRect(s.x - 7 * dir, s.y - 0.5, 7 * dir, 1);
      g.fillStyle(hsl(h, Math.min(0.9, 0.6 + s.z * 0.015))).fillCircle(s.x, s.y, 1.9 * (1 + s.z / 24));
      g.fillStyle(0xffffff).fillRect(s.x - 0.5, s.y - 0.5, 1, 1);
      continue;
    }
    if (!front) continue;
    if (s.kind === 'quaver') {
      const x = Math.round(s.x);
      const y = Math.round(s.y);
      quaver(g, x + 1, y + 1, 0x000000);
      quaver(g, x, y, hsl(hue + 60, 0.74));
      g.fillStyle(0xffffff).fillRect(x - 1, y, 1, 1);
    } else {
      g.fillStyle(hsl(hue + 180, 0.7)).fillRect(s.x - 3, s.y - 0.75, 6, 1.5);
      g.fillStyle(0xffffff).fillRect(s.x - 1, s.y - 0.5, 3, 1);
    }
  }
}

/** Beams: a glowing bar with two strands spiralling round its white core and rings standing across it. */
export function drawBeams(g: Phaser.GameObjects.Graphics, stage: StageScene) {
  const hue = stage.land.hue;
  const time = stage.beat.time;
  for (const b of stage.beams) {
    const len = b.head - b.tail;
    if (len <= 0) continue;
    const h = b.w / 2;
    g.fillStyle(hsl(hue + 180, 0.6), 0.25).fillRect(b.tail, b.y - h, len, b.w);
    g.fillStyle(hsl(hue + 180, 0.75), 0.7).fillRect(b.tail, b.y - h * 0.45, len, h * 0.9);
    g.fillStyle(0xffffff).fillRect(b.tail, b.y - h * 0.18, len, h * 0.36);
    for (const [ph, a] of [[0, 1], [Math.PI, 0.45]]) {
      const pts: Phaser.Types.Math.Vector2Like[] = [];
      for (let x = b.tail; x <= b.head; x += 1.5) pts.push({ x, y: b.y + h * Math.sin(x * 0.18 - time * 22 + ph) });
      if (pts.length > 1) g.lineStyle(0.75, hsl(hue + 300 + ph * 30, 0.7), a).strokePoints(pts as Phaser.Math.Vector2[]);
    }
    g.lineStyle(0.5, hsl(hue + 60, 0.75), 0.8);
    const step = 14;
    for (let x = b.tail + (((-time * 120) % step) + step) % step; x < b.head; x += step) g.strokeEllipse(x, b.y, 3.2, 2 * (h + 1));
  }
}

/** Enemy notes are diamonds: a dark outline, a red edge that blinks white, and a white core, whatever the hue. */
export function drawNotes(g: Phaser.GameObjects.Graphics, stage: StageScene, danger: number) {
  const blink = Math.floor(stage.beat.time * 10) % 2 === 0;
  for (const n of stage.notes) {
    diamond(g, n.x, n.y, 3.2, 0x000000);
    diamond(g, n.x, n.y, 2.4, blink ? 0xffffff : danger);
    g.fillStyle(0xffffff).fillRect(n.x - 0.75, n.y - 0.75, 1.5, 1.5);
  }
}

function diamond(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number) {
  g.fillStyle(color);
  g.fillTriangle(x, y - r, x + r, y, x - r, y);
  g.fillTriangle(x, y + r, x + r, y, x - r, y);
}
