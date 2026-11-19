import Phaser from 'phaser';
import { ATTRACT, attractSeed } from '../attract';
import { BeatClock } from '../beat';
import { COLORS, HEIGHT, MOVEMENTS, RENDER_SCALE, SPRITES, TEXT, WIDTH } from '../config';
import { Controls } from '../controls';
import { loadHi } from '../hi';
import { Landscape } from '../land/Landscape';
import { MOVEMENT_I } from '../terrain';
import { label } from '../text';
import { fitCamera } from '../view';

export class TitleScene extends Phaser.Scene {
  private controls!: Controls;
  private land!: Landscape;
  private beat!: BeatClock;
  private craft!: Phaser.GameObjects.Image;
  private start!: Phaser.GameObjects.Text;
  private padStatus: Phaser.GameObjects.Text | undefined;
  private scrollX = 0;
  private leaving = false;

  constructor() {
    super('title');
  }

  preload() {
    for (const key of SPRITES) this.load.image(key, `sprites/${key}.png`);
  }

  create() {
    // Attract mode goes straight to the stage once the sprites are loaded.
    if (ATTRACT) return void this.scene.start('stage', { attract: attractSeed() });
    this.leaving = false;
    this.padStatus = undefined;
    this.scrollX = 0;
    fitCamera(this, RENDER_SCALE);
    this.controls = new Controls(this);
    this.beat = new BeatClock(MOVEMENTS[0].bpm);
    this.land = new Landscape(this, MOVEMENT_I, 'title-landscape');
    this.cameras.main.fadeIn(250);
    this.add.graphics().setDepth(4).fillStyle(COLORS.void, 0.55).fillRect(0, 0, WIDTH, HEIGHT);

    const cx = WIDTH / 2;
    const text = (x: number, y: number, s: string, size: number, color: string, align: 'left' | 'center' | 'right' = 'center') =>
      label(this, x, y, s, size, color, { align }).setDepth(5);
    label(this, cx, 20, 'OVERTONE', 44, TEXT.gold, { title: true, align: 'center' }).setDepth(5);
    text(cx, 70, 'A SHOOTER THAT KEEPS TIME', 7, TEXT.dim);
    const hi = loadHi();
    if (hi) text(WIDTH - 6, 4, `HI ${hi.toLocaleString('en-US')}`, 6, TEXT.gold, 'right');
    this.craft = this.add.image(cx, 94, 'player').setAngle(90).setDepth(5);

    this.start = text(cx, 108, '> START <', 12, TEXT.gold).setInteractive({ useHandCursor: true });
    this.start.on('pointerdown', () => this.begin());
    const touchScreen = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    text(cx, 124, touchScreen ? 'TAP START' : 'PRESS ENTER OR A, OR CLICK START', 6, TEXT.dim);

    const column = (x: number, title: string, keys: string, actions: string) => {
      text(x, 140, title, 6, TEXT.gold);
      label(this, x - 3, 150, keys, 6, TEXT.ink, { align: 'right' }).setLineSpacing(1).setDepth(5);
      label(this, x + 3, 150, actions, 6, TEXT.dim).setLineSpacing(1).setDepth(5);
    };
    column(120, 'KEYBOARD + MOUSE', 'ARROWS / WASD\nZ / SPACE / CLICK\nX / RIGHT-CLICK\nC / SHIFT\nP\nM', 'FLY\nFIRE\nCHARGE\nECHO\nPAUSE\nSOUND');
    column(300, 'CONTROLLER', 'L-STICK / D-PAD\nA\nX / RT\nB / RB\nSTART\nY', 'FLY\nFIRE\nCHARGE\nECHO\nPAUSE\nSOUND');
    this.padStatus = text(cx, 214, '', 6, TEXT.dim);
  }

  update(_time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    this.scrollX += MOVEMENTS[0].scroll * dt;
    this.beat.update(dt);
    this.land.update(dt, this.scrollX, this.beat);
    // The craft weaves to the beat, banking as it climbs and dives.
    const phase = (this.beat.time / this.beat.spb) * (Math.PI / 4);
    const vy = Math.cos(phase);
    this.craft.setY(94 + 4 * Math.sin(phase)).setScale(Math.abs(vy) > 0.35 ? 0.75 : 1, 1);
    const input = this.controls.read();
    if (input.confirm) this.begin();
    this.start.setAlpha(this.beat.frac < 0.5 ? 1 : 0.55);
    const pad = this.controls.pad();
    this.padStatus?.setText(pad ? 'CONTROLLER CONNECTED' : 'USING A CONTROLLER? PRESS ANY BUTTON ON IT').setColor(pad ? TEXT.beam : TEXT.dim);
  }

  private begin() {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('stage'));
  }
}
