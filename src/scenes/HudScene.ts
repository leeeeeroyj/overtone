import Phaser from 'phaser';
import { COLORS, HUD_SCALE, TEXT, TOP, WIDTH, HEIGHT } from '../config';
import { label } from '../text';
import { fitCamera } from '../view';
import type { HudState } from './StageScene';

// HUD units are half a design pixel: the camera zooms by HUD_SCALE, so 16 px sprites show at 8 design px, unshrunk.
const U = HUD_SCALE;
const BAR = TOP * U;
const W = WIDTH * U;
const H = HEIGHT * U;

const HINTS = {
  kbm: 'ARROWS OR WASD FLY  ·  ESC TITLE',
  pad: 'STICK OR D-PAD FLY  ·  BACK TITLE',
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
    t(360, 1, 'SPD', 10, TEXT.dim);
    t(408, 1, 'SHIPS', 10, TEXT.dim);
    this.numeral = t(612, 1, '', 10, TEXT.dim);
    this.movement = t(612, 12, '', 16, TEXT.magenta);
    this.hint = t(W / 2, H - 14, '', 10, TEXT.ink, 'center');
    this.ships = Array.from({ length: 5 }, (_, i) => this.add.image(418 + i * 18, 22, 'player').setAngle(90).setDepth(2));
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
    for (let i = 0; i < 3; i++) {
      if (i < s.speed) g.fillStyle(COLORS.ink).fillRect(360 + i * 8, 17, 6, 8);
      else g.lineStyle(1, COLORS.dim).strokeRect(360 + i * 8 + 0.5, 17.5, 5, 7);
    }
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

/** The HUD's accent follows the landscape's hue (degrees). */
function hueColor(h: number, l = 0.62) {
  return Phaser.Display.Color.HSLToColor((((h % 360) + 360) % 360) / 360, 0.95, l).color;
}
