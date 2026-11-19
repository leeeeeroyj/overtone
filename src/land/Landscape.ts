// The landscape, far to near: sky, speaker moon, spectrum range, instrument city, the stave, motes, and the frame
// (the only solid layer). It's drawn into one canvas texture at 1 px per game pixel each frame, at whole-pixel
// scroll, and the image is nudged by the fraction left over so it still moves smoothly on the 4x canvas.
import Phaser from 'phaser';
import type { BeatClock } from '../beat';
import { HEIGHT, MOVEMENTS, TOP, WIDTH } from '../config';
import { CELL, COL, type Terrain } from '../terrain';
import { artFor, CITY_H, CITY_W, hash, hsl, mod, type Theme } from './bake';

/** How fast each layer scrolls, as a share of the play layer's speed. */
export const PARALLAX = { moon: 0.02, spectrum: 0.12, city: 0.3, stave: 0.5, motes: 0.7 };

export const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const CANVAS_W = WIDTH + 2;

export class Landscape {
  readonly image: Phaser.GameObjects.Image;
  readonly texture: Phaser.Textures.CanvasTexture;
  /** The hue the glows cycle through; the HUD's accent follows it. */
  hue: number;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly art;
  private readonly theme: Theme;
  private readonly peaks = new Map<number, number>();
  private readonly motes = Array.from({ length: 34 }, (_, i) => ({
    x: hash(i * 7 + 3) * WIDTH,
    y: TOP + hash(i * 7 + 4) * (HEIGHT - TOP),
    z: hash(i * 7 + 5),
  }));
  private lastBeat = -1;
  private lastScroll: number | undefined;
  /** Drawn on the last frame: the world x of canvas column 0. */
  wx0 = 0;

  constructor(scene: Phaser.Scene, private readonly terrain: Terrain, movement = 0, key = 'landscape') {
    this.art = artFor(movement);
    this.theme = this.art.theme;
    this.hue = MOVEMENTS[movement]?.hue ?? MOVEMENTS[0].hue;
    const existing = scene.textures.exists(key) ? scene.textures.get(key) : null;
    this.texture = (existing as Phaser.Textures.CanvasTexture | null) ?? scene.textures.createCanvas(key, CANVAS_W, HEIGHT)!;
    this.ctx = this.texture.context;
    this.ctx.imageSmoothingEnabled = false;
    this.image = scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);
  }

  update(dt: number, scrollX: number, beat: BeatClock) {
    if (beat.beat !== this.lastBeat) {
      this.lastBeat = beat.beat;
      if (mod(beat.beat, 4) === 0 && !REDUCED) this.hue = (this.hue + 37) % 360;
    }
    for (const m of this.motes) {
      m.y -= (3 + m.z * 6) * dt;
      m.x -= (scrollX - (this.lastScroll ?? scrollX)) * PARALLAX.motes;
      if (m.y < TOP) m.y = HEIGHT;
      if (m.x < 0) m.x += WIDTH;
    }
    this.lastScroll = scrollX;
    const wx0 = Math.floor(scrollX);
    this.wx0 = wx0;
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, CANVAS_W, HEIGHT);
    this.drawBack(g, dt, wx0, beat);
    this.drawFrame(g, wx0, beat);
    this.texture.refresh();
    this.image.x = -(scrollX - wx0);
  }

  private drawBack(g: CanvasRenderingContext2D, dt: number, scroll: number, beat: BeatClock) {
    const { art } = this;
    const env = REDUCED ? 0 : beat.env;
    g.drawImage(art.sky, 0, 0);
    for (const s of art.twinkle) {
      if (mod(beat.beat, 8) !== s.k % 8) continue;
      g.globalAlpha = beat.env;
      g.fillStyle = '#ffffff';
      g.fillRect(s.x, s.y, 1, 1);
      g.fillRect(s.x - 1, s.y, 3, 1);
      g.fillRect(s.x, s.y - 1, 1, 3);
      g.globalAlpha = 1;
    }

    const T = this.theme;
    // Speaker moon: rings from the rim inward; on each kick the inner rings push out a pixel or two.
    if (T.moon) {
      const mx = Math.round(mod(318 - scroll * PARALLAX.moon, WIDTH + 120) - 60);
      const my = 66;
      const kick = Math.round(env * 2);
      g.globalAlpha = 0.5;
      disc(g, mx, my, 40, T.moon.halo);
      g.globalAlpha = 1;
      const radii = [34, 32, 28 + kick, 24 + kick, 18 + kick, 13 + kick, 7, 5];
      radii.forEach((r, i) => disc(g, mx, my, r, T.moon!.rings[i]));
      disc(g, mx - 1, my - 1, 2, T.moon.core);
      g.fillStyle = T.moon.rim;
      for (let a = 2.4; a < 4.3; a += 0.05) g.fillRect(Math.round(mx + Math.cos(a) * 33), Math.round(my + Math.sin(a) * 33), 1, 1);
    }
    if (T.strings) this.drawStrings(g, beat, env, false);

    // Spectrum range: analyser bars on a hazy horizon, each peak held a moment before it falls.
    const horizon = 186;
    const off = scroll * PARALLAX.spectrum;
    const c0 = Math.floor(off / 6);
    for (let c = c0 - 1; T.spectrum && c < c0 + CANVAS_W / 6 + 2; c++) {
      const x = Math.round(c * 6 - off);
      const h0 = 12 + 24 * (0.5 + 0.5 * Math.sin(c * 0.13)) + 16 * (0.5 + 0.5 * Math.sin(c * 0.047 + 1));
      const amp = [11, 9, 7, 5, 4, 3, 3, 2][mod(c, 8)];
      const h = Math.round(h0 + env * amp * (0.6 + 0.4 * Math.sin(c * 1.7 + beat.beat)) + (REDUCED ? 0 : 2 * Math.sin(beat.time * 3 + c)));
      for (let s = 0; s * 4 < h; s++) {
        g.fillStyle = T.spec[Math.min(T.spec.length - 1, Math.floor(((s * 4) / 70) * T.spec.length))];
        g.fillRect(x, horizon - s * 4 - 3, 5, 3);
      }
      const pk = Math.max((this.peaks.get(c) ?? 0) - 16 * dt, h);
      this.peaks.set(c, pk);
      g.fillStyle = T.peak;
      g.fillRect(x, horizon - Math.round(pk) - 3, 5, 1);
    }
    for (const c of this.peaks.keys()) if (c < c0 - 4) this.peaks.delete(c);
    let grad = g.createLinearGradient(0, 120, 0, HEIGHT);
    grad.addColorStop(0, T.haze[0]);
    grad.addColorStop(0.6, T.haze[1]);
    grad.addColorStop(1, T.haze[2]);
    g.fillStyle = grad;
    g.fillRect(0, 120, CANVAS_W, HEIGHT - 120);

    // Instrument city, with its lights playing through the bar.
    const cx = mod(scroll * PARALLAX.city, CITY_W);
    const cityTop = HEIGHT - CITY_H - 4;
    g.drawImage(art.city, Math.round(-cx), cityTop);
    g.drawImage(art.city, Math.round(CITY_W - cx), cityTop);
    for (const l of art.cityLights) {
      let x = Math.round(l.x - cx);
      if (x < -4) x += CITY_W;
      if (x > CANVAS_W + 4) continue;
      const on = mod(l.k - beat.beat * 3, 16) < 3;
      const y = cityTop + l.y;
      g.fillStyle = on ? hsl(this.hue + (l.kind === 'pipe' ? 0 : 160), 100, 70, 0.35 + 0.65 * beat.env) : 'rgba(255,216,77,0.25)';
      g.fillRect(x, y, l.kind === 'pipe' ? 2 : 1, 1);
      if (on && !REDUCED) {
        g.fillStyle = hsl(this.hue, 100, 70, 0.18 * beat.env);
        g.fillRect(x - 1, y - 1, 4, 3);
      }
    }
    grad = g.createLinearGradient(0, 170, 0, HEIGHT);
    grad.addColorStop(0, T.haze2[0]);
    grad.addColorStop(1, T.haze2[1]);
    g.fillStyle = grad;
    g.fillRect(0, 170, CANVAS_W, HEIGHT - 170);

    if (T.strings) this.drawStrings(g, beat, env, true);
    if (T.stave) this.drawStave(g, scroll, beat);
    for (const m of this.motes) {
      g.fillStyle = hsl(this.hue + 40 + m.z * 60, 100, 75, 0.25 + m.z * 0.3 + env * 0.4);
      g.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
    }
  }

  /**
   * Strings across the sky (far ones dim, near ones brighter). Each is a standing wave; one string rings hard on
   * each beat, in turn, and the rest hum.
   */
  private drawStrings(g: CanvasRenderingContext2D, beat: BeatClock, env: number, near: boolean) {
    const n = this.theme.strings;
    for (let i = 0; i < n; i++) {
      if ((i % 3 === 0) !== near) continue;
      const y0 = TOP + 18 + ((HEIGHT - TOP - 70) * i) / Math.max(1, n - 1) + hash(i * 13) * 10;
      const y1 = y0 + (hash(i * 17) - 0.5) * 30;
      const k = 1 + (i % 3);
      const plucked = mod(beat.beat, n) === i;
      const amp = (plucked ? 5 : 1.2) * env * (beat.beat % 2 ? 1 : -1);
      g.fillStyle = near ? hsl(this.hue + i * 25, 90, 70, 0.55 + 0.45 * env * (plucked ? 1 : 0.3)) : `rgba(${this.theme.staveRgb},${0.18 + (plucked ? 0.3 * env : 0)})`;
      for (let x = 0; x < CANVAS_W; x += near ? 1 : 2) {
        const y = y0 + ((y1 - y0) * x) / CANVAS_W + amp * Math.sin((Math.PI * k * x) / CANVAS_W);
        g.fillRect(x, Math.round(y), 1, 1);
      }
    }
  }

  /** The stave: five lines drifting across the sky, the note on the current beat lit. */
  private drawStave(g: CanvasRenderingContext2D, scroll: number, beat: BeatClock) {
    const rgb = this.theme.staveRgb;
    const so = scroll * PARALLAX.stave;
    const base = (x: number) => Math.round(54 + 9 * Math.sin((x + so) * 0.006));
    g.fillStyle = `rgba(${rgb},0.16)`;
    for (let x = 0; x < CANVAS_W; x += 2) {
      const y = base(x);
      for (let i = 0; i < 5; i++) g.fillRect(x, y + i * 3, 1, 1);
    }
    const n0 = Math.floor(so / 30);
    for (let n = n0; n < n0 + CANVAS_W / 30 + 2; n++) {
      const x = Math.round(n * 30 + hash(n) * 12 - so);
      const pitch = Math.floor(hash(n + 77) * 9);
      const y = Math.round(base(x) + 12 - pitch * 1.5);
      const lit = mod(n, 8) === mod(beat.beat, 8);
      g.fillStyle = lit ? hsl(this.hue + 40, 100, 75, 0.5 + 0.5 * beat.env) : `rgba(${rgb},0.28)`;
      g.fillRect(x, y, 3, 2);
      g.fillRect(x + 2, y - 6, 1, 6);
    }
  }

  /**
   * The Equalizer frame: LED cells in COL px columns. The edge cell is always the brightest; on each beat every
   * column lights a few cells in from the edge, then they fall back. A pulse of light runs along both edges each beat.
   */
  private drawFrame(g: CanvasRenderingContext2D, wx0: number, beat: BeatClock) {
    const t = this.terrain;
    const T = this.theme;
    for (let c = Math.floor(wx0 / COL) - 1; c * COL < wx0 + CANVAS_W + COL; c++) {
      const sx = c * COL - wx0;
      for (const side of [1, -1]) {
        const edge = side > 0 ? t.floorY(c * COL) : t.ceilY(c * COL);
        const n = side > 0 ? (HEIGHT - edge) / CELL : (edge - TOP) / CELL;
        g.fillStyle = T.mass;
        g.fillRect(sx, side > 0 ? edge : TOP, COL, side > 0 ? HEIGHT - edge : edge - TOP);
        const level = REDUCED ? 3 : 3 + Math.round(hash(c * 31 + beat.beat * 7 + (side > 0 ? 0 : 999)) * 6 * beat.env);
        for (let i = 0; i < n; i++) {
          const y = side > 0 ? edge + i * CELL : edge - (i + 1) * CELL + 1;
          g.fillStyle = i === 0 ? T.eqRim
            : i < level ? hsl(this.hue + i * 18 + (side > 0 ? 0 : 180), 95, 68 - i * 6)
            : T.eqDim[Math.min(T.eqDim.length - 1, i - level)];
          g.fillRect(sx, y, COL - 1, 2);
        }
        const sw = REDUCED ? 0 : sweep(sx + 2, side, beat.frac);
        if (sw > 0) {
          g.fillStyle = `rgba(255,255,255,${sw})`;
          g.fillRect(sx - 1, side > 0 ? edge - 1 : edge - 2, COL + 1, 3);
        }
      }
    }
  }
}

/** The beat's pulse along an edge: the floor's runs left to right, the ceiling's right to left. */
function sweep(sx: number, side: number, frac: number) {
  const p = side > 0 ? frac * (WIDTH + 80) - 40 : WIDTH + 40 - frac * (WIDTH + 80);
  return Math.max(0, 1 - Math.abs(sx - p) / 18) * (1 - frac * 0.6);
}

function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  g.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy));
    g.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

