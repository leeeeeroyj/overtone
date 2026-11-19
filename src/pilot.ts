import { CRAFT, FIRE, MOVEMENTS, WIDTH, type Weapon } from './config';
import type { ControlState } from './controls';
import { clamp } from './land/bake';
import { scriptBars } from './script';
import { mod } from './synth';
import type { Run, StageScene } from './scenes/StageScene';

/** A small seeded random generator (mulberry32), so a demo's seed always picks the same movement and start. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

/** What a demo plays: a movement and loop, a bar to start from (or the boss), and some power so the weapons show. */
export interface Demo {
  run: Run;
  bar: number;
  boss: boolean;
}

/** The demo for a seed. Each seed picks a movement (and sometimes an ENCORE), a point in its script or its boss, and a weapon. */
export function demoFor(seed: number): Demo {
  const r = random(seed);
  const movement = seed % MOVEMENTS.length;
  const loop = r() < 0.2 ? 1 : 0;
  const boss = r() < 0.25;
  const bar = boss ? 0 : 4 + Math.floor(r() * (scriptBars(movement) - 24));
  const weapons: Weapon[] = ['spiral', 'prism', 'sonar'];
  const power = { weapon: weapons[Math.floor(r() * 3)], level: 2 + Math.floor(r() * 2), harm: Math.floor(r() * 3), speed: 2, fork: r() < 0.5 };
  return { run: { movement, loop, score: 0, ships: 3, mult: 1, power, eligible: false }, bar, boss };
}

/**
 * The demo's pilot (from the concept sheet): it grabs pickups and a loose Echo, lines up with the nearest enemy
 * ahead (the boss's core when there is one), sidesteps notes and enemies, keeps off the floor and ceiling, weaves a
 * little so it never sits still, sends the Echo out and calls it back, and every eight beats charges for two beats
 * and lets go on the beat (a resonant beam). It drives the real game through the same inputs a player has.
 */
export class Pilot {
  private echoBeat = -1;
  /** The core's last height and when, to lead it. */
  private lastCore: { t: number; y: number } | undefined;

  constructor(private readonly stage: StageScene) {}

  read(): ControlState {
    const s = this.stage;
    const c = s.craft;
    const t = s.beat.time;
    // Home: a little way in from the left, weaving slowly.
    let tx = 96 + Math.sin(t * 0.7) * 24;
    let ty = 112 + Math.sin(t * 1.3) * 12;
    const pickup = s.pickups.find((p) => !p.dead && p.x > 20 && p.x < WIDTH - 20);
    const core = s.boss && !s.boss.core.dead ? s.boss.core : undefined;
    if (s.echo.state === 'loose') {
      tx = clamp(s.echo.x, 30, 300);
      ty = s.echo.y;
    } else if (pickup) {
      tx = clamp(pickup.x - 6, 30, 260);
      ty = pickup.y;
    } else if (core) {
      // Lead the core: where it will be when a shot fired now gets there.
      const last = this.lastCore;
      const vy = last && t > last.t ? (core.y - last.y) / (t - last.t) : 0;
      tx = 80 + Math.sin(t * 0.7) * 16;
      ty = core.y + vy * Math.max(0, core.x - c.x) / FIRE.speed;
      this.lastCore = { t, y: core.y };
    } else {
      let best;
      let bd = Infinity;
      for (const e of s.foes) {
        if (e.dead || e.x < c.x + 12 || e.x > WIDTH) continue;
        const d = e.x - c.x + Math.abs(e.y - c.y) * 0.6;
        if (d < bd) [best, bd] = [e, d];
      }
      if (best) ty = best.y + Math.sin(t * 2.1) * 4;
    }
    // Sidestep: the note that will pass closest soonest, or an enemy about to run into the craft.
    let threat: { y: number; when: number } | undefined;
    for (const n of s.notes) {
      if (n.dead) continue;
      const dx = n.x - c.x;
      const dy = n.y - c.y;
      const v2 = n.vx * n.vx + n.vy * n.vy || 1;
      const when = clamp(-(dx * n.vx + dy * n.vy) / v2, 0, 0.7);
      const px = dx + n.vx * when;
      const py = dy + n.vy * when;
      if (Math.hypot(px, py) < 11 && (!threat || when < threat.when)) threat = { y: py, when };
    }
    for (const e of s.foes) {
      if (e.dead || e.boss) continue;
      const dx = e.x - c.x;
      const dy = e.y - c.y;
      if (dx > -10 && dx < 34 && Math.abs(dy) < e.r + 10 && (!threat || 0.3 < threat.when)) threat = { y: dy, when: 0.3 };
    }
    if (threat) ty = c.y + (threat.y > 0 ? -28 : 28);
    // Keep off the frame.
    let lo = -Infinity;
    let hi = Infinity;
    for (let dx = -8; dx <= 28; dx += 4) {
      const wx = s.scrollX + c.x + dx;
      lo = Math.max(lo, s.terrain.ceilY(wx) + 14);
      hi = Math.min(hi, s.terrain.floorY(wx) - 14);
    }
    // A sidestep that would hit the frame goes the other way.
    if (threat && (ty < lo || ty > hi)) ty = c.y + (ty < lo ? 28 : -28);
    ty = clamp(ty, Math.min(lo, hi), Math.max(lo, hi));
    tx = clamp(tx, CRAFT.minX + 10, 300);
    const move = { x: clamp((tx - c.x) / 24, -1, 1), y: clamp((ty - c.y) / 10, -1, 1) };

    const b = s.beat.beat;
    const charge = !threat && (mod(b, 8) === 4 || mod(b, 8) === 5);
    let echo = false;
    const b32 = mod(b, 32);
    if (b !== this.echoBeat && ((b32 === 18 && s.echo.attached) || (b32 === 26 && (s.echo.state === 'hover' || s.echo.state === 'flying')))) {
      this.echoBeat = b;
      echo = true;
    }
    return { move, fire: true, charge, echo, confirm: false, back: false, mute: false, pause: false, nav: 0, device: 'kbm' };
  }
}
