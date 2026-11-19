import Phaser from 'phaser';
import { COLORS, HARMONIC, PICKUPS, WEAPON_ORDER, type PickupKind, type Weapon } from '../config';
import { hsl } from '../effects';
import { glyph } from '../glyphs';
import type { StageScene } from '../scenes/StageScene';

export interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  /** Seconds alive: a crystal's weapon depends on it. */
  t: number;
  dead: boolean;
  img: Phaser.GameObjects.Image;
}

/** The weapon a crystal shows right now. */
export const crystalWeapon = (p: Pickup): Weapon => WEAPON_ORDER[Math.floor(p.t / PICKUPS.cycle) % WEAPON_ORDER.length];

export function dropPickup(stage: StageScene, kind: PickupKind, x: number, y: number, t = 0): Pickup {
  const img = stage.add.image(x, y, kind).setDepth(8);
  // A Harmonic pickup looks like the speaker you'll get: half size, cone forward.
  if (kind === 'harmonic') img.setScale(HARMONIC.scale).setFlipX(true);
  const p: Pickup = { kind, x, y, t, dead: false, img };
  stage.pickups.push(p);
  return p;
}

export function updatePickups(stage: StageScene, dt: number) {
  const c = stage.craft;
  for (const p of stage.pickups) {
    p.t += dt;
    p.x -= PICKUPS.drift * dt;
    p.y += Math.sin(p.t * 3) * 6 * dt;
    if (stage.over) continue;
    if (Math.hypot(p.x - c.x, p.y - c.y) < PICKUPS.catch) {
      p.dead = true;
      stage.collect(p);
    }
    if (p.x < -12) p.dead = true;
  }
  stage.pickups = stage.pickups.filter((p) => {
    if (p.dead) p.img.destroy();
    return !p.dead;
  });
}

/** Each pickup with its glyph above it (a crystal's shows the weapon you'd get now); glows go in `back`. */
export function drawPickups(stage: StageScene, back: Phaser.GameObjects.Graphics, g: Phaser.GameObjects.Graphics) {
  for (const p of stage.pickups) {
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    if (p.kind === 'harmonic') back.fillStyle(hsl(stage.land.hue + 60, 0.7), 0.35).fillCircle(x, y, 5);
    p.img.setPosition(x, y);
    glyph(g, p.kind === 'crystal' ? crystalWeapon(p) : p.kind, x, y - 12, COLORS.ink);
  }
}
