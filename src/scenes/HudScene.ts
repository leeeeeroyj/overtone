import Phaser from 'phaser';
import { COLORS, HUD_SCALE, TEXT, TOP, WIDTH, HEIGHT } from '../config';
import { glyph } from '../glyphs';
import { toggleMute } from '../synth';
import { label } from '../text';
import { fitCamera } from '../view';
import type { HudState, StageScene } from './StageScene';

// HUD units are half a design pixel: the camera zooms by HUD_SCALE, so 16 px sprites show at 8 design px, unshrunk.
const U = HUD_SCALE;
const BAR = TOP * U;
const W = WIDTH * U;
const H = HEIGHT * U;

const HINTS = {
  kbm: 'ARROWS FLY  ·  Z FIRE  ·  X CHARGE  ·  C ECHO  ·  P PAUSE  ·  M SOUND  ·  ESC TITLE',
  pad: 'STICK FLY  ·  A FIRE  ·  X CHARGE  ·  B ECHO  ·  START PAUSE  ·  Y SOUND',
  touch: 'TOUCH CONTROLS ARRIVE SOON',
};
const PAUSE_HINTS = { kbm: 'P OR ENTER RESUME  ·  ESC TITLE', pad: 'START OR A RESUME  ·  BACK TITLE', touch: 'TAP RESUME OR TITLE' };
const OVER_HINTS = { kbm: '← → CHOOSE  ·  ENTER SELECT  ·  ESC TITLE', pad: 'D-PAD CHOOSE  ·  A SELECT  ·  BACK TITLE', touch: 'TAP TO CHOOSE' };
const OVER_CHOICES = ['CONTINUE', 'RETRY', 'TITLE'];

interface Button {
  x: number;
  y: number;
  w: number;
  h: number;
  text: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
}

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
  private panelG!: Phaser.GameObjects.Graphics;
  private pauseParts: Phaser.GameObjects.GameObject[] = [];
  private pauseButtons: Button[] = [];
  private pauseHint!: Phaser.GameObjects.Text;
  private overParts: Phaser.GameObjects.GameObject[] = [];
  private overButtons: Button[] = [];
  private overScore!: Phaser.GameObjects.Text;
  private overHi!: Phaser.GameObjects.Text;
  private overNote!: Phaser.GameObjects.Text;
  private overHint!: Phaser.GameObjects.Text;
  private pauseTap!: Phaser.GameObjects.Zone;
  private bossName!: Phaser.GameObjects.Text;
  private bossState!: Phaser.GameObjects.Text;

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
    this.bossName = t(W / 2 - 206, H - 15, '', 10, TEXT.gold);
    this.bossState = t(W / 2 + 210, H - 15, '', 10, TEXT.ink);
    // The speaker toggles sound.
    this.add.zone(810, 16, 28, 28).setInteractive({ useHandCursor: true }).on('pointerdown', () => toggleMute(this));
    this.ships = Array.from({ length: 5 }, (_, i) => this.add.image(516 + i * 18, 22, 'player').setAngle(90).setDepth(2));
    // The pause icon (II) pauses.
    this.pauseTap = this.add.zone(774, 16, 28, 28).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.stage().setPaused(true));
    this.panelG = this.add.graphics().setDepth(5);
    this.buildPause();
    this.buildOver();
  }

  private stage() {
    return this.scene.get('stage') as StageScene;
  }

  private button(x: number, y: number, w: number, text: string, act: () => void): Button {
    const h = 40;
    const t = label(this, x, y + h / 2 - 8, text, 14, TEXT.ink, { zoom: HUD_SCALE, align: 'center' }).setDepth(6);
    const zone = this.add.zone(x - w / 2, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', act);
    return { x, y, w, h, text: t, zone };
  }

  /** PAUSED, with RESUME and TITLE buttons a mouse or thumb can hit. */
  private buildPause() {
    const top = 140;
    const t = label(this, W / 2, top + 18, 'PAUSED', 32, TEXT.gold, { zoom: HUD_SCALE, align: 'center' }).setDepth(6);
    this.pauseButtons = [
      this.button(W / 2 - 90, top + 80, 150, 'RESUME', () => this.stage().setPaused(false)),
      this.button(W / 2 + 90, top + 80, 150, 'TITLE', () => this.stage().leave()),
    ];
    this.pauseHint = label(this, W / 2, top + 140, '', 10, TEXT.dim, { zoom: HUD_SCALE, align: 'center' }).setDepth(6);
    this.pauseParts = [t, this.pauseHint, ...this.pauseButtons.flatMap((b) => [b.text, b.zone])];
  }

  /** GAME OVER, the score and the high score, then CONTINUE, RETRY and TITLE. */
  private buildOver() {
    const top = 110;
    const t = label(this, W / 2, top + 16, 'GAME OVER', 32, TEXT.danger, { zoom: HUD_SCALE, align: 'center' }).setDepth(6);
    this.overScore = label(this, W / 2, top + 64, '', 14, TEXT.ink, { zoom: HUD_SCALE, align: 'center' }).setDepth(6);
    this.overHi = label(this, W / 2, top + 86, '', 12, TEXT.dim, { zoom: HUD_SCALE, align: 'center' }).setDepth(6);
    this.overNote = label(this, W / 2, top + 106, '', 10, TEXT.dim, { zoom: HUD_SCALE, align: 'center' }).setDepth(6);
    this.overButtons = OVER_CHOICES.map((c, i) => this.button(W / 2 + (i - 1) * 170, top + 132, 156, c, () => this.stage().choose(i)));
    this.overHint = label(this, W / 2, top + 192, '', 10, TEXT.dim, { zoom: HUD_SCALE, align: 'center' }).setDepth(6);
    this.overParts = [t, this.overScore, this.overHi, this.overNote, this.overHint, ...this.overButtons.flatMap((b) => [b.text, b.zone])];
  }

  /** The panel box and its buttons: the selected (or primary) one filled, the rest outlined. */
  private drawPanel(top: number, h: number, w: number, buttons: Button[], selected: number) {
    const g = this.panelG;
    g.fillStyle(COLORS.void, 0.55).fillRect(0, BAR, W, H - BAR);
    g.fillStyle(COLORS.void).fillRect(W / 2 - w / 2, top, w, h);
    g.lineStyle(2, COLORS.line).strokeRect(W / 2 - w / 2, top, w, h);
    buttons.forEach((b, i) => {
      const on = i === selected;
      if (on) g.fillStyle(COLORS.gold).fillRect(b.x - b.w / 2, b.y, b.w, b.h);
      else g.lineStyle(2, COLORS.ink).strokeRect(b.x - b.w / 2 + 1, b.y + 1, b.w - 2, b.h - 2);
      b.text.setColor(on ? '#07040f' : TEXT.ink);
    });
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
    if (!(loose && Math.floor(this.time.now / 250) % 2)) glyph(g, s.weapon, 376, 21, loose ? COLORS.dim : COLORS.beam, 2);
    pips(g, 392, 17, s.level, 3, COLORS.gold);
    // HARM: a note per Harmonic, bright when you have it.
    for (let i = 0; i < 2; i++) note(g, 434 + i * 14, 21, i < s.harm ? COLORS.beam : COLORS.off);
    pips(g, 472, 17, s.speed, 3, COLORS.ink);
    speaker(g, 802, 8, s.muted);
    this.ships.forEach((img, i) => img.setVisible(i < s.ships));
    this.numeral.setText(`MOVEMENT ${s.numeral}`);
    this.movement.setText(s.movement);

    // II: pause.
    g.fillStyle(s.over || s.attract ? COLORS.dim : COLORS.ink).fillRect(770, 8, 4, 16).fillRect(780, 8, 4, 16);
    this.pauseTap.input!.enabled = !s.attract && !s.over && !s.paused;

    this.panelG.clear();
    const paused = s.paused && !s.attract;
    const over = s.over && !s.attract;
    for (const o of this.pauseParts) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(paused);
    for (const b of this.pauseButtons) b.zone.input!.enabled = paused;
    if (paused) {
      this.drawPanel(140, 170, 400, this.pauseButtons, 0);
      this.pauseHint.setText(PAUSE_HINTS[s.device]);
    }
    for (const o of this.overParts) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(over);
    for (const b of this.overButtons) b.zone.input!.enabled = over && s.ready;
    if (over) {
      this.drawPanel(110, 220, 540, this.overButtons, s.choice);
      this.overScore.setText(`SCORE ${String(s.score).padStart(7, '0')}`);
      this.overHi.setText(s.newHi ? 'NEW HIGH SCORE!' : `HI ${String(s.hi).padStart(7, '0')}`).setColor(s.newHi ? TEXT.gold : TEXT.dim);
      this.overNote.setText(s.eligible ? 'CONTINUE STARTS THIS MOVEMENT AGAIN WITH THE SCORE AT ZERO' : 'A CONTINUED RUN CAN\'T SET THE HIGH SCORE');
      this.overHint.setText(OVER_HINTS[s.device]).setAlpha(s.ready ? 1 : 0.4);
    }

    // The boss bar takes the hint strip's place: its name, the core's health, and whether the core is OPEN or SHUT.
    const boss = s.boss && !paused && !over ? s.boss : null;
    this.bossName.setVisible(!!boss).setText(boss?.name ?? '');
    this.bossState.setVisible(!!boss).setText(boss?.open ? 'OPEN' : 'SHUT').setColor(boss?.open ? TEXT.gold : TEXT.dim);
    if (boss) {
      const x = W / 2 - 90;
      const w = 290;
      g.fillStyle(COLORS.void, 0.85).fillRect(W / 2 - 214, H - 18, 476, 18);
      g.lineStyle(1, COLORS.ink).strokeRect(x + 0.5, H - 13.5, w, 8);
      g.fillStyle(COLORS.gold).fillRect(x + 2, H - 11, Math.round((w - 3) * boss.hp), 5);
    }

    this.hint.setVisible(!s.attract && !paused && !over && !boss).setText(HINTS[s.device]);
    if (!s.attract && !paused && !over && !boss) {
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
