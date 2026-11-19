import Phaser from 'phaser';
import { BeatClock } from '../beat';
import { CRAFT, MOVEMENTS, RENDER_SCALE } from '../config';
import { Controls, type ControlState, type Device } from '../controls';
import { loadHi } from '../hi';
import { clamp } from '../land/bake';
import { Landscape } from '../land/Landscape';
import { terrainFor, type Terrain } from '../terrain';
import { fitCamera } from '../view';

/** What the HUD scene draws, published to the registry every frame. */
export interface HudState {
  score: number;
  hi: number;
  mult: number;
  beat: number;
  hue: number;
  ships: number;
  speed: number;
  movement: string;
  numeral: string;
  device: Device;
  attract: boolean;
}

const IDLE: ControlState = {
  move: { x: 0, y: 0 }, fire: false, charge: false, echo: false, confirm: false, back: false, mute: false, pause: false, device: 'kbm',
};

/** One movement: the beat, the scroll, the landscape, and the craft. */
export class StageScene extends Phaser.Scene {
  terrain!: Terrain;
  beat!: BeatClock;
  land!: Landscape;
  /** Design px scrolled since the movement began; world x = scrollX + screen x. */
  scrollX = 0;
  craft = { x: 0, y: 0, vx: 0, vy: 0, bank: 1, invuln: 0, speed: 1 };
  /** Times the frame has been hit (milestone 1 counts them; the hit ladder comes later). */
  frameHits = 0;
  score = 0;
  ships = 3;
  movement = 0;
  private controls: Controls | undefined;
  private ship!: Phaser.GameObjects.Image;
  private attract: number | undefined;
  private leaving = false;

  constructor() {
    super('stage');
  }

  create(data: { attract?: number; movement?: number } = {}) {
    this.attract = data.attract;
    this.movement = data.movement ?? 0;
    this.leaving = false;
    fitCamera(this, RENDER_SCALE);
    this.terrain = terrainFor(this.movement);
    this.beat = new BeatClock(MOVEMENTS[this.movement].bpm);
    this.scrollX = 0;
    this.land = new Landscape(this, this.terrain);
    this.craft = { x: CRAFT.startX, y: CRAFT.startY, vx: 0, vy: 0, bank: 1, invuln: 0, speed: 1 };
    this.frameHits = 0;
    this.score = 0;
    this.ships = 3;
    // The craft is drawn from above, nose up: turned a quarter it faces right.
    this.ship = this.add.image(this.craft.x, this.craft.y, 'player').setAngle(90).setDepth(10);
    this.controls = this.attract === undefined ? new Controls(this) : undefined;
    this.publish('kbm');
    this.scene.launch('hud');
    this.cameras.main.fadeIn(250);
  }

  update(_time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    const input = this.controls?.read() ?? IDLE;
    if (input.back) return this.leave();
    this.scrollX += MOVEMENTS[this.movement].scroll * dt;
    this.beat.update(dt);
    this.fly(dt, input);
    this.land.update(dt, this.scrollX, this.beat);
    this.publish(input.device);
  }

  /** Direct 8-way flight. The craft squashes (a bank) while climbing or diving; the frame bounces it back. */
  private fly(dt: number, input: ControlState) {
    const c = this.craft;
    const sp = CRAFT.speed + CRAFT.speedStep * (c.speed - 1);
    c.vx = input.move.x * sp;
    c.vy = input.move.y * sp;
    c.x = clamp(c.x + c.vx * dt, CRAFT.minX, CRAFT.maxX);
    c.y = clamp(c.y + c.vy * dt, CRAFT.minY, CRAFT.maxY);
    c.bank = Math.abs(c.vy) > sp * CRAFT.bankAt ? CRAFT.bankScale : 1;
    const wx = this.scrollX + c.x;
    let ceil = -Infinity;
    let floor = Infinity;
    for (const dx of CRAFT.probes) {
      ceil = Math.max(ceil, this.terrain.ceilY(wx + dx));
      floor = Math.min(floor, this.terrain.floorY(wx + dx));
    }
    if (c.y < ceil + CRAFT.edgeReach) {
      c.y = ceil + CRAFT.bounce;
      this.hitFrame();
    }
    if (c.y > floor - CRAFT.edgeReach) {
      c.y = floor - CRAFT.bounce;
      this.hitFrame();
    }
    c.invuln = Math.max(0, c.invuln - dt);
    const blinkOff = c.invuln > 0 && Math.floor(this.beat.time * 20) % 2 === 0;
    // Turned a quarter, the image's own x axis is the screen's y, so the squash goes on scaleX.
    this.ship.setPosition(c.x, c.y).setScale(c.bank, 1).setVisible(!blinkOff);
  }

  private hitFrame() {
    if (this.craft.invuln > 0) return;
    this.frameHits++;
    this.craft.invuln = CRAFT.invuln;
  }

  private publish(device: Device) {
    const m = MOVEMENTS[this.movement];
    const state: HudState = {
      score: this.score,
      hi: loadHi(),
      mult: 1,
      beat: this.beat.beat,
      hue: this.land.hue,
      ships: this.ships,
      speed: this.craft.speed,
      movement: m.name,
      numeral: m.numeral,
      device,
      attract: this.attract !== undefined,
    };
    this.registry.set('hud', state);
  }

  private leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('hud');
      this.scene.start('title');
    });
  }
}
