import Phaser from 'phaser';
import { COLORS, HUD_SCALE, TEXT, TOP, WIDTH, HEIGHT } from '../config';
import { toggleMute } from '../synth';
import { label } from '../text';
import { fitCamera } from '../view';
import type { HudState } from './StageScene';

// HUD units are half a design pixel: the camera zooms by HUD_SCALE, so 16 px sprites show at 8 design px, unshrunk.
const U = HUD_SCALE;
const BAR = TOP * U;
const W = WIDTH * U;
const H = HEIGHT * U;

const HINTS = {
  kbm: 'ARROWS FLY  ·  Z FIRE  ·  X CHARGE  ·  C ECHO  ·  M SOUND  ·  ESC TITLE',
  pad: 'STICK FLY  ·  A FIRE  ·  X CHARGE  ·  B ECHO  ·  Y SOUND  ·  BACK TITLE',
  touch: 'TOUCH CONTROLS ARRIVE SOON',
};

/** The top bar and the hint strip, drawn from the registry's `hud` state. */
export class HudScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private score!: Phaser.GameObjects.Text;
  private hi!: Phaser.GameObjects.Text;
  private mult!: Phaser.GameObjects.Text;
  private movement!: Phaser.GameObjects.Text;
  private numeral!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private ships: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('hud');
  }

  create() {
    fitCamera(this, HUD_SCALE);
    this.g = this.add.graphics();
    const t = (x: number, y: number, s: string, size: number, color: string, align: 'left' | 'center' = 'left') =>
      label(this, x, y, s, size, color, { zoom: HUD_SCALE, align }).setDepth(2);
    t(8, 1, 'SCORE', 10, TEXT.dim);
    this.score = t(8, 11, '', 18, TEXT.gold);
    t(132, 1, 'HI', 10, TEXT.dim);
    this.hi = t(132, 14, '', 12, TEXT.ink);
    t(216, 1, 'HARMONY', 10, TEXT.dim);
    this.mult = t(216, 11, '', 18, TEXT.ink);
    t(296, 1, 'BEAT', 10, TEXT.dim);
    t(364, 1, 'ECHO', 10, TEXT.dim);
    t(428, 1, 'HARM', 10, TEXT.dim);
    t(472, 1, 'SPD', 10, TEXT.dim);
    t(508, 1, 'SHIPS', 10, TEXT.dim);
    this.numeral = t(612, 1, '', 10, TEXT.dim);
    this.movement = t(612, 12, '', 16, TEXT.magenta);
    this.hint = t(W / 2, H - 14, '', 10, TEXT.ink, 'center');
    // The speaker toggles sound.
    this.add.zone(810, 16, 28, 28).setInteractive({ useHandCursor: true }).on('pointerdown', () => toggleMute(this));
    this.ships = Array.from({ length: 5 }, (_, i) => this.add.image(516 + i * 18, 22, 'player').setAngle(90).setDepth(2));
  }

  update() {
    const s = this.registry.get('hud') as HudState | undefined;
    if (!s) return;
    const g = this.g.clear();
    g.fillStyle(COLORS.void).fillRect(0, 0, W, BAR);
    g.fillStyle(hueColor(s.hue), 0.6).fillRect(0, BAR - 1, W, 1);

    this.score.setText(String(s.score).padStart(7, '0'));
    this.hi.setText(String(Math.max(s.hi, s.score)).padStart(7, '0'));
    this.mult.setText(`x${s.mult}`).setColor(s.mult > 1 ? TEXT.beam : TEXT.ink);

    // Beat lamp: four boxes, the current beat filled, the downbeat taller. Filled vs outline, never colour alone.
    for (let i = 0; i < 4; i++) {
      const on = ((s.beat % 4) + 4) % 4 === i;
      const h = i === 0 ? 14 : 10;
      const x = 296 + i * 14;
      const y = 28 - h;
      if (on) g.fillStyle(hueColor(s.hue, 0.66)).fillRect(x, y, 10, h);
      else g.lineStyle(1, COLORS.dim).strokeRect(x + 0.5, y + 0.5, 9, h - 1);
    }
    // ECHO: the weapon's glyph and its level. Loose, the glyph dims and blinks.
    const loose = s.echo === 'loose';
    if (!(loose && Math.floor(this.time.now / 250) % 2)) spiral(g, 376, 21, loose ? COLORS.dim : COLORS.beam);
    pips(g, 392, 17, s.level, 3, COLORS.gold);
    // HARM: a note per Harmonic, bright when you have it.
    for (let i = 0; i < 2; i++) note(g, 434 + i * 14, 21, i < s.harm ? COLORS.beam : COLORS.off);
    pips(g, 472, 17, s.speed, 3, COLORS.ink);
    speaker(g, 802, 8, s.muted);
    this.ships.forEach((img, i) => img.setVisible(i < s.ships));
    this.numeral.setText(`MOVEMENT ${s.numeral}`);
    this.movement.setText(s.movement);

    this.hint.setVisible(!s.attract).setText(HINTS[s.device]);
    if (!s.attract) {
      const w = this.hint.width + 16;
      g.fillStyle(COLORS.void, 0.8).fillRect(Math.round(W / 2 - w / 2), H - 16, Math.round(w), 16);
    }
  }
}

/** Filled pips for what you have, outlined for the rest. */
function pips(g: Phaser.GameObjects.Graphics, x: number, y: number, n: number, of: number, color: number) {
  for (let i = 0; i < of; i++) {
    if (i < n) g.fillStyle(color).fillRect(x + i * 8, y, 6, 8);
    else g.lineStyle(1, COLORS.dim).strokeRect(x + i * 8 + 0.5, y + 0.5, 5, 7);
  }
}

/** SPIRAL's glyph: two strands crossing, outlined in black. */
function spiral(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number) {
  for (const [w, c] of [[4.4, 0x000000], [2, color]] as const) {
    g.lineStyle(w, c);
    for (const sgn of [1, -1]) {
      const pts: Phaser.Types.Math.Vector2Like[] = [];
      for (let i = 0; i <= 12; i++) pts.push({ x: x - 8 + (i / 12) * 16, y: y + sgn * 4.8 * Math.sin((i / 12) * Math.PI * 2) });
      g.strokePoints(pts as Phaser.Math.Vector2[]);
    }
  }
}

/** A quaver at HUD scale, its head's centre near (x, y). */
function note(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number) {
  g.fillStyle(0x000000).fillRect(x - 5, y - 13, 12, 18);
  g.fillStyle(color);
  g.fillRect(x - 4, y + 0, 6, 4);
  g.fillRect(x, y - 10, 2, 12);
  g.fillRect(x + 2, y - 10, 2, 2);
  g.fillRect(x + 4, y - 8, 2, 4);
}

/** The sound icon: a speaker with waves, or with a cross when muted (shape, not colour, tells them apart). */
function speaker(g: Phaser.GameObjects.Graphics, x: number, y: number, muted: boolean) {
  g.fillStyle(muted ? COLORS.dim : COLORS.ink);
  g.fillRect(x, y + 4, 4, 6);
  g.fillRect(x + 4, y + 2, 2, 10);
  g.fillRect(x + 6, y, 2, 14);
  if (muted) {
    for (let i = 0; i < 8; i += 2) {
      g.fillRect(x + 12 + i, y + 3 + i, 2, 2);
      g.fillRect(x + 18 - i, y + 3 + i, 2, 2);
    }
  } else {
    g.fillRect(x + 12, y + 4, 2, 6);
    g.fillRect(x + 16, y + 2, 2, 10);
    g.fillRect(x + 20, y, 2, 14);
  }
}

/** The HUD's accent follows the landscape's hue (degrees). */
function hueColor(h: number, l = 0.62) {
  return Phaser.Display.Color.HSLToColor((((h % 360) + 360) % 360) / 360, 0.95, l).color;
}
