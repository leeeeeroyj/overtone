import type Phaser from 'phaser';
import { ECHO, HEIGHT, TOP, WIDTH } from '../config';
import { hsl } from '../effects';
import { clamp } from '../land/bake';
import type { StageScene } from '../scenes/StageScene';

export type EchoState = 'front' | 'back' | 'flying' | 'hover' | 'returning' | 'loose';

/**
 * The Echo: a living orb of sound that can't be destroyed. Attached to the nose (front) or tail (back) it fires the
 * crystal weapon; launched, it flies out and hovers, following your height and repeating your shots; recalled, it
 * homes back. Knocked loose by a hit, it drifts until you touch it. Whatever end touches it, it joins.
 */
export class Echo {
  state: EchoState = 'front';
  x = 0;
  y = 0;
  vx = 0;
  hoverX: number = ECHO.hoverFront;
  /** Seconds until it can repeat another shot while away. */
  cool = 0;
  readonly img: Phaser.GameObjects.Image;

  constructor(private readonly stage: StageScene) {
    this.img = stage.add.image(0, 0, 'echo').setScale(ECHO.scale).setDepth(11);
    this.attach('front');
  }

  get attached() {
    return this.state === 'front' || this.state === 'back';
  }

  attach(end: 'front' | 'back') {
    this.state = end;
    this.x = this.stage.craft.x + (end === 'front' ? ECHO.offset : -ECHO.offset);
    this.y = this.stage.craft.y;
  }

  /** ECHO: launch it forward (or backward, from the tail); pressed while it's away, call it back. */
  toggle() {
    if (this.attached) {
      const back = this.state === 'back';
      this.state = 'flying';
      this.vx = back ? -ECHO.launch : ECHO.launch;
      this.hoverX = back ? ECHO.hoverBack : ECHO.hoverFront;
      this.stage.sfx.echoOut();
    } else if (this.state === 'flying' || this.state === 'hover') {
      this.state = 'returning';
      this.stage.sfx.echoBack();
    }
  }

  knockLoose() {
    this.state = 'loose';
    this.stage.sfx.echoLoose();
    this.vx = -ECHO.looseSpeed;
    this.x = this.stage.craft.x + 12;
  }

  update(dt: number) {
    const c = this.stage.craft;
    switch (this.state) {
      case 'front':
      case 'back':
        this.x = c.x + (this.state === 'front' ? ECHO.offset : -ECHO.offset);
        this.y = c.y;
        break;
      case 'flying':
        this.x += this.vx * dt;
        this.vx *= 0.985;
        if ((this.vx > 0 && this.x >= this.hoverX) || (this.vx < 0 && this.x <= this.hoverX)) this.state = 'hover';
        break;
      case 'hover':
        this.y += clamp(c.y - this.y, -ECHO.follow * dt, ECHO.follow * dt);
        break;
      case 'returning': {
        const dx = c.x - this.x;
        const dy = c.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        const step = Math.min(d, ECHO.recall * dt);
        this.x += (dx / d) * step;
        this.y += (dy / d) * step;
        break;
      }
      case 'loose':
        this.x += this.vx * dt;
        this.y += Math.sin(this.stage.beat.time * 2) * 10 * dt;
        if (this.x < 24) this.vx = Math.abs(this.vx);
        if (this.x > WIDTH - 24) this.vx = -Math.abs(this.vx);
        break;
    }
    this.y = clamp(this.y, TOP + 8, HEIGHT - 8);
    // Recalled, hovering or loose: it joins whichever end of the craft touches it.
    if (!this.attached && this.state !== 'flying' && Math.hypot(c.x - this.x, c.y - this.y) < ECHO.catch) {
      this.attach(this.x >= c.x ? 'front' : 'back');
      this.stage.sfx.echoCatch();
    }
    // It hurts anything it touches, unless it's loose.
    if (this.state !== 'loose') {
      for (const e of this.stage.foes) {
        if (e.dead || Math.hypot(e.x - this.x, e.y - this.y) >= e.r + ECHO.touch) continue;
        this.stage.damage(e, ECHO.dps * dt);
        if (Math.random() < 0.3) this.stage.fx.burst(this.x, this.y, 2, this.stage.land.hue, 0.5);
      }
    }
  }

  /** Does it stop this enemy note? */
  blocks(x: number, y: number) {
    return this.state !== 'loose' && Math.hypot(x - this.x, y - this.y) < ECHO.block;
  }

  /** The sprite, plus a ring that pulses on the beat; loose, it blinks. */
  draw(g: Phaser.GameObjects.Graphics, reduced: boolean) {
    const { beat, land } = this.stage;
    const hidden = this.state === 'loose' && Math.floor(beat.time * 8) % 2 === 0;
    this.img.setPosition(this.x, this.y).setVisible(!hidden).setDepth(this.state === 'back' ? 9 : 11);
    if (!hidden && !reduced && beat.env > 0.05) {
      g.lineStyle(0.75, hsl(land.hue + 60, 0.7), 0.6 * beat.env).strokeCircle(this.x, this.y, 6 + beat.env * 2);
    }
  }
}
