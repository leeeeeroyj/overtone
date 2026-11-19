import Phaser from 'phaser';
import { HEIGHT, TOP, WIDTH } from './config';
import { REDUCED } from './land/Landscape';
import { label } from './text';

const TAU = Math.PI * 2;
const cache = new Map<number, number>();

/** A colour from hue (degrees, any range), saturation and lightness (0..1), cached: effects ask for hundreds a frame. */
export function hsl(h: number, l: number, s = 1) {
  const hh = Math.round(((h % 360) + 360) % 360);
  const key = hh * 1e6 + Math.round(s * 100) * 1e3 + Math.round(l * 100);
  let c = cache.get(key);
  if (c === undefined) {
    c = Phaser.Display.Color.HSLToColor(hh / 360, s, l).color;
    cache.set(key, c);
  }
  return c;
}

interface Spark { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; h: number }
interface Ring { x: number; y: number; r: number; dr: number; life: number; max: number; h: number; w: number; tilt: number; rot: number }
interface Popup { text: Phaser.GameObjects.Text; life: number }

/**
 * Sparks that fly out in 3D (those behind the action draw before the sprites, those in front after), shockwave
 * rings tilted at random, floating score popups, screen shake in game pixels and a white flash. Under
 * prefers-reduced-motion there's no shake or flash and a third of the sparks.
 */
export class Effects {
  private sparks: Spark[] = [];
  private rings: Ring[] = [];
  private popups: Popup[] = [];
  private shakeMag = 0;
  private shakeTime = 0;
  private flashTime = 0;
  private readonly flashRect: Phaser.GameObjects.Rectangle;

  constructor(private readonly scene: Phaser.Scene) {
    this.flashRect = scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0xffffff).setOrigin(0).setDepth(30).setAlpha(0);
  }

  burst(x: number, y: number, n: number, h: number, speed = 1) {
    const k = REDUCED ? Math.ceil(n / 3) : n;
    for (let i = 0; i < k; i++) {
      const a = Math.random() * TAU;
      const b = Math.acos(2 * Math.random() - 1);
      const v = (40 + Math.random() * 90) * speed;
      this.sparks.push({
        x, y, z: 0,
        vx: Math.sin(b) * Math.cos(a) * v, vy: Math.sin(b) * Math.sin(a) * v, vz: Math.cos(b) * v,
        life: 0.4 + Math.random() * 0.4, h: h + Math.random() * 120,
      });
    }
  }

  ring(x: number, y: number, r: number, dr: number, life: number, h: number, w = 1) {
    this.rings.push({ x, y, r, dr, life, max: life, h, w, tilt: REDUCED ? 0 : Math.random() * 1.2, rot: Math.random() * TAU });
  }

  popup(x: number, y: number, text: string, color: string) {
    const t = label(this.scene, x, y, text, 6, color, { align: 'center' }).setDepth(7);
    this.popups.push({ text: t, life: 1 });
  }

  shake(mag: number, time: number) {
    if (REDUCED) return;
    if (mag * time > this.shakeMag * this.shakeTime) {
      this.shakeMag = mag;
      this.shakeTime = time;
    }
  }

  flash(time: number) {
    if (!REDUCED) this.flashTime = Math.max(this.flashTime, time);
  }

  /** The camera's offset this frame, game px. */
  get offset() {
    if (this.shakeTime <= 0) return { x: 0, y: 0 };
    const m = this.shakeMag * Math.min(1, this.shakeTime / 0.15);
    return { x: (Math.random() * 2 - 1) * m, y: (Math.random() * 2 - 1) * m };
  }

  update(dt: number) {
    for (const p of this.sparks) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.vz *= 0.96;
      p.life -= dt;
    }
    this.sparks = this.sparks.filter((p) => p.life > 0 && p.y > TOP);
    for (const r of this.rings) {
      r.r += r.dr * dt;
      r.life -= dt;
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const p of this.popups) {
      p.life -= dt;
      p.text.y -= 14 * dt;
      p.text.setAlpha(Math.min(1, p.life * 2));
      if (p.life <= 0) p.text.destroy();
    }
    this.popups = this.popups.filter((p) => p.life > 0);
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    this.flashTime = Math.max(0, this.flashTime - dt);
    this.flashRect.setAlpha(this.flashTime > 0 ? 0.35 : 0);
  }

  /** Sparks behind (front = false) or in front of the sprites. */
  drawSparks(g: Phaser.GameObjects.Graphics, front: boolean) {
    for (const p of this.sparks) {
      if (p.z >= 0 !== front) continue;
      const s = Math.max(0.5, 1.3 * (1 + p.z / 160));
      g.fillStyle(hsl(p.h, 0.64 + Math.max(0, p.z) * 0.002), Math.min(1, p.life / 0.3) * (front ? 1 : 0.7));
      g.fillRect(p.x - s / 2, p.y + p.z * 0.25 - s / 2, s, s);
    }
  }

  drawRings(g: Phaser.GameObjects.Graphics) {
    for (const r of this.rings) {
      const rx = Math.max(0.1, r.r);
      const ry = Math.max(0.1, r.r * Math.cos(r.tilt));
      const c = Math.cos(r.rot);
      const s = Math.sin(r.rot);
      const pts: Phaser.Types.Math.Vector2Like[] = [];
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * TAU;
        const ex = Math.cos(a) * rx;
        const ey = Math.sin(a) * ry;
        pts.push({ x: r.x + ex * c - ey * s, y: r.y + ex * s + ey * c });
      }
      g.lineStyle(r.w, hsl(r.h, 0.66), r.life / r.max).strokePoints(pts as Phaser.Math.Vector2[], true, true);
    }
  }

  clear() {
    this.sparks = [];
    this.rings = [];
    for (const p of this.popups) p.text.destroy();
    this.popups = [];
  }
}
