import Phaser from 'phaser';
import { BeatClock } from '../beat';
import {
  BEAT_WINDOW, CHARGE, CHORD, COLORS, CRAFT, FIRE, FOES, GRACE, HARMONIC, MAX_LEVEL, MOVEMENTS, noteScale, PICKUPS,
  PLAY, RENDER_SCALE, tempo, TEXT, WEAPONS, WIDTH, type FoeKind, type PickupKind, type Weapon,
} from '../config';
import { Controls, type ControlState, type Device } from '../controls';
import { Effects, hsl } from '../effects';
import { Echo } from '../entities/echo';
import { drawFoes, foesOnBeat, spawnFoe, updateFoes, type Foe, type SpawnOptions } from '../entities/foes';
import { crystalWeapon, drawPickups, dropPickup, updatePickups, type Pickup } from '../entities/pickups';
import { drawBeams, drawNotes, drawShots, makeShot, updateNotes, updateShots, type Beam, type Note, type Shot } from '../entities/shots';
import { loadHi, saveHi } from '../hi';
import { clamp } from '../land/bake';
import { Landscape, REDUCED } from '../land/Landscape';
import { Band } from '../music';
import { pinnedSpots, runPattern, scriptBars, wavesAt, type Pattern } from '../script';
import { Sfx } from '../sfx';
import { Synth, toggleMute } from '../synth';
import { label } from '../text';
import { blockedAt, terrainFor, type Terrain } from '../terrain';
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
  weapon: Weapon;
  level: number;
  harm: number;
  echo: 'attached' | 'away' | 'loose';
  muted: boolean;
  paused: boolean;
  /** The last ship is gone: the game-over panel shows, with `choice` (0 CONTINUE, 1 RETRY, 2 TITLE) selected. */
  over: boolean;
  choice: number;
  /** Ready for a choice (the panel ignores input for a moment so a held button doesn't pick). */
  ready: boolean;
  newHi: boolean;
  /** This run can set the high score (it started at Movement I and never continued). */
  eligible: boolean;
}

/** Power the craft carries from one movement to the next. */
export interface Power {
  weapon: Weapon;
  level: number;
  harm: number;
  speed: number;
  fork: boolean;
}

/** A run: where it is, and what carries over between movements. */
export interface Run {
  movement: number;
  /** How many times the ensemble has played through (an ENCORE is loop 1 or more). */
  loop: number;
  score: number;
  ships: number;
  mult: number;
  power: Power | undefined;
  /** Only a run that started at Movement I and never continued can set the high score. */
  eligible: boolean;
}

export const newRun = (movement = 0, loop = 0): Run => ({
  movement, loop, score: 0, ships: PLAY.ships, mult: 1, power: undefined, eligible: movement === 0 && loop === 0,
});

const IDLE: ControlState = {
  move: { x: 0, y: 0 }, fire: false, charge: false, echo: false, confirm: false, back: false, mute: false, pause: false, device: 'kbm',
};

const newCraft = () => ({
  x: CRAFT.startX, y: CRAFT.startY, vx: 0, vy: 0, bank: 1, invuln: 0, speed: 1,
  weapon: 'spiral' as Weapon, level: 1, harm: 0,
  /** Grace notes (from the tuning fork). */
  fork: false,
  /** Seconds the charge has been held, and whether it's held now. */
  charge: 0, charging: false,
  /** Cooldowns, s: shots, the Echo's weapon, the Harmonics, grace notes. */
  cool: 0, wcool: 0, hcool: 0, gcool: 0,
});

/** One movement: the beat, the scroll, the landscape, the craft and its Echo, enemies, scoring and sound. */
export class StageScene extends Phaser.Scene {
  terrain!: Terrain;
  beat!: BeatClock;
  land!: Landscape;
  fx!: Effects;
  echo!: Echo;
  synth!: Synth;
  sfx!: Sfx;
  /** Design px scrolled since the movement began; world x = scrollX + screen x. */
  scrollX = 0;
  craft = newCraft();
  foes: Foe[] = [];
  shots: Shot[] = [];
  beams: Beam[] = [];
  notes: Note[] = [];
  pickups: Pickup[] = [];
  /** Arrivals announced by a chevron at the right edge: seconds to go, the height, and what arrives. */
  warns: { y: number; t: number; spawn: () => void }[] = [];
  score = 0;
  /** Harmony: the multiplier on every point, x1 to x8. */
  mult = 1;
  ships: number = PLAY.ships;
  movement = 0;
  loop = 0;
  eligible = true;
  /** Paused: nothing moves and the HUD shows RESUME and TITLE. */
  paused = false;
  /** The game-over panel's selection: 0 CONTINUE, 1 RETRY, 2 TITLE. */
  choice = 0;
  newHi = false;
  /** Counters the tests read: hits taken from the frame, hits taken in all, enemy notes blocked. */
  frameHits = 0;
  hits = 0;
  blocked = 0;
  /** The last charge release: its tier and whether it was resonant. */
  lastRelease: { tier: number; resonant: boolean } | undefined;
  /** Whether the spawn script runs (tests switch it off with clearField). */
  scripted = true;
  /** Dev: show the landscape alone (for screenshots). */
  landOnly = false;
  /** Dev: enemies and pickups hold still and don't fire (for the contact sheet and weapon tests). */
  frozen = false;
  /** Dev: false stops the craft's own notes, so the Echo's weapon can be tested alone. */
  noteFire = true;
  /** Couriers' drops so far (they come in PICKUPS.drops order). */
  private drops = 0;
  /** Flutter formations: members shot down, and whether one got away (then there's no CHORD). */
  private formations = new Map<number, { killed: number; broken: boolean }>();
  private band!: Band;
  private controls: Controls | undefined;
  private ship!: Phaser.GameObjects.Image;
  private speakers: Phaser.GameObjects.Image[] = [];
  private gBack!: Phaser.GameObjects.Graphics;
  private gMid!: Phaser.GameObjects.Graphics;
  private gFront!: Phaser.GameObjects.Graphics;
  private gFoe!: Phaser.GameObjects.Graphics;
  private camBase = { x: 0, y: 0 };
  private kick = 0;
  /** Seconds since the last ship went (-1: still playing). */
  private gameOver = -1;
  /** Seconds left of the end-of-movement fanfare (-1: still playing). */
  private ending = -1;
  private banner: Phaser.GameObjects.Text[] = [];
  private bannerTime = 0;
  private lastMoveX = 0;
  private attract: number | undefined;
  private leaving = false;
  private readonly onHidden = () => {
    if (document.hidden) this.setPaused(true);
  };

  constructor() {
    super('stage');
  }

  create(data: { attract?: number; run?: Run } = {}) {
    this.attract = data.attract;
    const run = data.run ?? newRun();
    this.movement = run.movement;
    this.loop = run.loop;
    this.eligible = run.eligible && this.attract === undefined;
    this.leaving = false;
    fitCamera(this, RENDER_SCALE);
    this.camBase = { x: this.cameras.main.scrollX, y: this.cameras.main.scrollY };
    this.terrain = terrainFor(this.movement);
    this.beat = new BeatClock(tempo(this.movement, this.loop));
    this.scrollX = 0;
    this.land = new Landscape(this, this.terrain, this.movement);
    this.synth = new Synth(this);
    this.sfx = new Sfx(this.synth);
    this.band = new Band(this.synth);
    this.fx = new Effects(this);
    this.craft = newCraft();
    if (run.power) Object.assign(this.craft, run.power);
    Object.assign(this, { foes: [], shots: [], beams: [], notes: [], pickups: [], warns: [], score: run.score, mult: run.mult, ships: run.ships });
    Object.assign(this, { frameHits: 0, hits: 0, blocked: 0, lastRelease: undefined, scripted: true, gameOver: -1, ending: -1, kick: 0 });
    Object.assign(this, { paused: false, choice: 0, newHi: false, lastMoveX: 0 });
    Object.assign(this, { landOnly: false, frozen: false, noteFire: true, drops: 0, formations: new Map() });
    this.gBack = this.add.graphics().setDepth(5);
    this.gFoe = this.add.graphics().setDepth(7.5);
    this.gMid = this.add.graphics().setDepth(8.5);
    this.gFront = this.add.graphics().setDepth(14);
    // The craft is drawn from above, nose up: turned a quarter it faces right.
    this.ship = this.add.image(this.craft.x, this.craft.y, 'player').setAngle(90).setDepth(10);
    // Speakers are mirrored so the cone faces forward.
    this.speakers = Array.from({ length: HARMONIC.max }, () => this.add.image(0, 0, 'harmonic').setScale(HARMONIC.scale).setFlipX(true));
    this.echo = new Echo(this);
    this.controls = this.attract === undefined ? new Controls(this) : undefined;
    // A phone call, a tab switch or the screen locking pauses the run.
    if (this.attract === undefined) document.addEventListener('visibilitychange', this.onHidden);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sfx.chargeStop();
      document.removeEventListener('visibilitychange', this.onHidden);
    });
    this.showBanner();
    this.publish('kbm');
    this.scene.launch('hud');
    this.cameras.main.fadeIn(250);
  }

  update(_time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    const input = this.controls?.read() ?? IDLE;
    if (input.mute) toggleMute(this);
    if (this.paused) {
      if (input.back) return this.leave();
      if (input.pause || input.confirm) this.setPaused(false);
      return this.publish(input.device);
    }
    if (this.gameOver >= 0) this.overMenu(dt, input);
    else if (input.back) return this.leave();
    else if (input.pause) return this.setPaused(true), this.publish(input.device);
    if (this.attract !== undefined && this.gameOver > PLAY.gameOver) return this.leave();
    this.scrollX += this.scrollSpeed * dt;
    const b = this.beat.update(dt);
    if (b !== null) this.onBeat(b);
    const playing = this.gameOver < 0 && this.ending < 0;
    if (playing) {
      this.fly(dt, input);
      this.weapons(dt, input);
      if (input.echo) this.echo.toggle();
    }
    if (this.ending >= 0 && (this.ending -= dt) < 0) return this.nextMovement();
    if (this.bannerTime > 0 && (this.bannerTime -= dt) < 1) this.banner.forEach((t) => t.setAlpha(Math.max(0, this.bannerTime)));
    this.echo.update(dt);
    updateShots(this, dt);
    if (!this.frozen) {
      updateFoes(this, dt);
      updatePickups(this, dt);
    }
    updateNotes(this, dt);
    this.arrivals(dt);
    this.contact();
    this.foes = this.foes.filter((e) => {
      if (!e.dead) return true;
      e.img?.destroy();
      if (e.escaped && e.group) this.formation(e.group).broken = true;
      return false;
    });
    this.fx.update(dt);
    this.kick = Math.max(0, this.kick - dt);
    this.land.update(dt, this.scrollX, this.beat);
    this.draw();
    this.band.update(this.beat);
    this.publish(input.device);
  }

  /** Design px per second the world scrolls. */
  get scrollSpeed() {
    return MOVEMENTS[this.movement].scroll;
  }

  /** Enemy notes fly this much faster each ENCORE. */
  get noteScale() {
    return noteScale(this.loop);
  }

  /** The last ship is gone. */
  get over() {
    return this.gameOver >= 0;
  }

  /** The movement's name, shown as it starts. */
  private showBanner() {
    const m = MOVEMENTS[this.movement];
    const encore = this.loop > 0 ? `  ·  ENCORE${this.loop > 1 ? ` ${this.loop}` : ''}` : '';
    this.banner = [
      label(this, WIDTH / 2, 74, `MOVEMENT ${m.numeral}${encore}`, 8, TEXT.dim, { align: 'center' }).setDepth(20),
      label(this, WIDTH / 2, 86, m.name, 20, TEXT.gold, { align: 'center' }).setDepth(20),
    ];
    this.bannerTime = PLAY.banner;
  }

  /** The script has run out: the movement is complete, and the next one (or an ENCORE) follows. */
  finish() {
    if (this.ending >= 0 || this.gameOver >= 0) return;
    this.ending = 2.5;
    this.scripted = false;
    const m = MOVEMENTS[this.movement];
    this.banner.forEach((t) => t.destroy());
    this.banner = [
      label(this, WIDTH / 2, 74, `MOVEMENT ${m.numeral}`, 8, TEXT.dim, { align: 'center' }).setDepth(20),
      label(this, WIDTH / 2, 86, 'COMPLETE', 20, TEXT.gold, { align: 'center' }).setDepth(20),
    ];
    this.bannerTime = 0;
  }

  private nextMovement() {
    const last = this.movement === MOVEMENTS.length - 1;
    this.restartWith({
      movement: last ? 0 : this.movement + 1, loop: last ? this.loop + 1 : this.loop, score: this.score,
      ships: this.ships, mult: this.mult, power: this.power(), eligible: this.eligible,
    });
  }

  private power(): Power {
    const { weapon, level, harm, speed, fork } = this.craft;
    return { weapon, level, harm, speed, fork };
  }

  private restartWith(run: Run) {
    if (this.leaving) return;
    this.leaving = true;
    this.sfx.chargeStop();
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart({ attract: this.attract, run }));
  }

  /** Pauses or resumes (not in attract mode or once the run is over). */
  setPaused(on: boolean) {
    if (this.attract !== undefined || on === this.paused || (on && (this.gameOver >= 0 || this.leaving))) return;
    this.paused = on;
    if (on) this.sfx.chargeStop();
  }

  /** The game-over panel: left and right pick, confirm chooses, Esc or Back goes to the title. */
  private overMenu(dt: number, input: ControlState) {
    this.gameOver += dt;
    const sx = Math.sign(Math.round(input.move.x));
    if (sx && sx !== this.lastMoveX) this.choice = (this.choice + sx + 3) % 3;
    this.lastMoveX = sx;
    if (this.gameOver < PLAY.gameOver) return;
    if (input.back) this.choose(2);
    else if (input.confirm) this.choose(this.choice);
  }

  /** CONTINUE: this movement again with the score reset (and no high score). RETRY: from Movement I. TITLE. */
  choose(i: number) {
    if (this.gameOver < PLAY.gameOver || this.leaving) return;
    if (i === 0) this.restartWith({ ...newRun(this.movement, this.loop), eligible: false });
    else if (i === 1) this.restartWith(newRun());
    else this.leave();
  }

  /** Announces something arriving at height y a beat from now, with a chevron at the right edge. */
  arrive(y: number, spawn: () => void) {
    this.warns.push({ y, t: this.beat.spb, spawn });
  }

  private arrivals(dt: number) {
    for (const w of this.warns) {
      w.t -= dt;
      if (w.t <= 0) w.spawn();
    }
    this.warns = this.warns.filter((w) => w.t > 0);
  }

  private onBeat(b: number) {
    if (!this.frozen) foesOnBeat(this, b);
    if (!this.scripted || this.gameOver >= 0) return;
    for (const w of wavesAt(this.movement, b)) runPattern(this, w.pattern, w.variant);
    if (b >= (scriptBars(this.movement) + PLAY.outro) * 4) this.finish();
  }

  /** Direct 8-way flight. The craft squashes (a bank) while climbing or diving; the frame is a hit and bounces it back. */
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
  }

  private hitFrame() {
    if (this.craft.invuln > 0) return;
    this.frameHits++;
    this.hitCraft();
  }

  /** FIRE streams notes (and the Echo's weapon and the Harmonics' notes); CHARGE holds fire and fills the beam. */
  private weapons(dt: number, input: ControlState) {
    const c = this.craft;
    c.cool -= dt;
    c.wcool -= dt;
    c.hcool -= dt;
    this.echo.cool -= dt;
    if (input.charge) {
      c.charging = true;
      c.charge += dt;
      this.sfx.chargeTo(this.tier(), (c.charge % this.beat.spb) / this.beat.spb);
    } else if (c.charging) this.release();
    if (!input.fire || c.charging) return;
    c.gcool -= dt;
    if (this.noteFire && c.cool <= 0) {
      c.cool = FIRE.cool;
      this.shots.push(makeShot('note', c.x + 9, c.y, FIRE.speed));
      this.sfx.shot(c.y);
    }
    const echo = this.echo;
    if (echo.attached && c.wcool <= 0) this.fireWeapon(echo.state === 'back' ? -1 : 1);
    if (!echo.attached && echo.state !== 'loose' && echo.cool <= 0) {
      echo.cool = FIRE.echoCool;
      this.shots.push(makeShot('note', echo.x + 6, echo.y, FIRE.echoSpeed));
    }
    if (c.harm > 0 && c.hcool <= 0) {
      c.hcool = this.beat.spb / 2;
      this.kick = 0.08;
      for (const h of this.harmonics()) {
        this.shots.push(makeShot('quaver', h.x + 6, h.y + 1, HARMONIC.noteSpeed, { ph: Math.random() * Math.PI * 2 }));
      }
    }
    if (c.fork && c.gcool <= 0) {
      c.gcool = GRACE.every;
      for (const sgn of [-1, 1]) {
        this.shots.push(makeShot('grace', c.x, c.y + sgn * 6, GRACE.speed, { vy: sgn * GRACE.spread, life: GRACE.life, damage: GRACE.damage }));
      }
    }
  }

  /** The attached Echo fires the crystal weapon from whichever end it's on. */
  private fireWeapon(dir: number) {
    const c = this.craft;
    const x = this.echo.x + dir * 4;
    const y = this.echo.y;
    const L = c.level;
    if (c.weapon === 'spiral') {
      const w = WEAPONS.spiral;
      c.wcool = w.cool;
      for (const ph of [0, Math.PI]) this.shots.push(makeShot('helix', x, y, w.speed * dir, { amp: w.amp(L), ph, damage: w.damage }));
    } else if (c.weapon === 'prism') {
      const w = WEAPONS.prism;
      c.wcool = w.cool;
      for (const a of w.angles[L - 1]) {
        this.shots.push(makeShot('prism', x, y, Math.cos(a) * w.speed * dir, { vy: Math.sin(a) * w.speed, bounces: w.bounces, damage: w.damage }));
      }
    } else {
      const w = WEAPONS.sonar;
      c.wcool = w.cool;
      this.shots.push(makeShot('sonar', x, y, w.speed * dir, { r: 3, rmax: w.size(L), hit: new Set(), damage: w.damage }));
    }
  }

  /** Charge tiers filled so far: one per beat held. */
  tier() {
    const beats = this.craft.charge / this.beat.spb;
    return CHARGE.tierAt.filter((t) => beats >= t).length;
  }

  private release() {
    const c = this.craft;
    const t = this.tier();
    const resonant = t >= CHARGE.resonantTier && this.beat.onBeat(BEAT_WINDOW);
    if (t > 0) {
      const k = resonant ? CHARGE.resonant : 1;
      this.beams.push({
        x0: c.x + 8, head: c.x + 8, tail: c.x + 8, y: c.y, w: CHARGE.width[t] * k, tier: t, resonant,
        damage: CHARGE.damage[t] * k, hit: new Set(),
      });
      const hue = this.land.hue;
      if (resonant) {
        this.fx.ring(c.x + 10, c.y, 4, 260, 0.5, hue + 40, 2);
        this.fx.ring(c.x + 10, c.y, 4, 160, 0.6, hue + 160, 1);
        this.fx.shake(1.5, 0.2);
        this.fx.popup(c.x, c.y - 16, 'ON THE BEAT', TEXT.beam);
      }
      this.sfx.beam(t, resonant);
    }
    this.lastRelease = { tier: t, resonant };
    c.charge = 0;
    c.charging = false;
    this.sfx.chargeStop();
  }

  /** The Harmonics' places: above and below the craft, bobbing toward and away from the camera. */
  harmonics() {
    const c = this.craft;
    const out: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < c.harm; i++) {
      const a = this.beat.time * 3.2 + i * Math.PI;
      out.push({ x: c.x - 2 + Math.cos(a) * 3, y: c.y + (i ? HARMONIC.offset : -HARMONIC.offset), z: Math.sin(a) * 4 });
    }
    return out;
  }

  /** Does the Echo or a Harmonic stop this enemy note? */
  blocks(n: Note) {
    return this.echo.blocks(n.x, n.y) || this.harmonics().some((h) => Math.hypot(n.x - h.x, n.y - h.y) < HARMONIC.block);
  }

  addNote(x: number, y: number, vx: number, vy: number) {
    this.notes.push({ x, y, vx, vy, dead: false });
  }

  /** Running into an enemy is a hit, and hurts it too. */
  private contact() {
    const c = this.craft;
    if (this.gameOver >= 0 || this.ending >= 0 || c.invuln > 0) return;
    for (const e of this.foes) {
      if (e.dead || Math.hypot(e.x - c.x, e.y - c.y) >= e.r + 3) continue;
      this.hitCraft();
      this.damage(e, PLAY.ramDamage);
      return;
    }
  }

  /** A hit costs a Harmonic, then a weapon level, then knocks the Echo loose, and only then a ship. */
  hitCraft() {
    const c = this.craft;
    if (c.invuln > 0 || this.gameOver >= 0 || this.ending >= 0) return;
    this.hits++;
    this.mult = 1;
    const hue = this.land.hue;
    this.fx.flash(0.1);
    this.fx.shake(3, 0.35);
    this.fx.burst(c.x, c.y, 26, hue + 200);
    this.fx.ring(c.x, c.y, 2, 150, 0.45, hue, 2);
    c.invuln = PLAY.invuln;
    let msg: string;
    if (c.harm > 0) {
      c.harm--;
      msg = '-HARMONIC';
    } else if (this.echo.state !== 'loose' && c.level > 1) {
      c.level--;
      msg = '-LEVEL';
    } else if (this.echo.state !== 'loose') {
      this.echo.knockLoose();
      c.level = 1;
      msg = 'ECHO LOOSE';
    } else {
      this.ships--;
      this.fx.burst(c.x, c.y, 50, hue, 1.6);
      this.fx.ring(c.x, c.y, 2, 90, 0.7, hue + 120, 2);
      this.fx.flash(0.2);
      this.fx.shake(4.5, 0.6);
      this.sfx.shipLost();
      if (c.charging) this.sfx.chargeStop();
      c.charge = 0;
      c.charging = false;
      if (this.ships <= 0) return this.endGame();
      // Respawn on the spot, the Echo back on the nose.
      this.echo.attach('front');
      c.level = 1;
      c.invuln = PLAY.respawn;
      msg = 'SHIP LOST';
    }
    this.sfx.hit();
    this.fx.popup(c.x, c.y - 16, msg, TEXT.danger);
  }

  private endGame() {
    this.gameOver = 0;
    this.choice = 0;
    this.ship.setVisible(false);
    this.echo.img.setVisible(false);
    this.craft.harm = 0;
    this.newHi = this.eligible && saveHi(this.score);
  }

  damage(e: Foe, d: number, resonant = false) {
    if (e.dead) return;
    e.hp -= d;
    e.flash = 0.08;
    if (e.hp <= 0) this.kill(e, resonant);
  }

  private kill(e: Foe, resonant: boolean) {
    e.dead = true;
    if (resonant) {
      this.mult = Math.min(PLAY.harmonyMax, this.mult + 1);
      this.fx.popup(e.x, e.y - 18, 'RESONANT', TEXT.beam);
    }
    const pts = FOES[e.kind].points * this.mult * (resonant ? 2 : 1);
    this.addScore(pts);
    this.fx.popup(e.x, e.y - 10, String(pts), TEXT.gold);
    const hue = this.land.hue;
    this.fx.burst(e.x, e.y, 18, hue + e.kind.length * 40);
    this.fx.ring(e.x, e.y, 2, 120, 0.4, hue + 180, 1.5);
    if (resonant) this.fx.ring(e.x, e.y, 2, 70, 0.6, hue + 60, 1);
    const big = e.kind === 'horn' || e.kind === 'eelhead' || e.kind === 'carrier';
    if (big) this.fx.burst(e.x, e.y, 22, hue + 90, 1.4);
    this.fx.shake(big ? 2.5 : 1, big ? 0.3 : 0.12);
    this.sfx.kill(e.y);
    if (e.kind === 'carrier') dropPickup(this, PICKUPS.drops[this.drops++ % PICKUPS.drops.length], e.x, e.y);
    if (e.kind === 'eelhead') for (const f of this.foes) if (f.head === e && !f.dead) this.kill(f, false);
    // The last of a whole formation: a CHORD.
    const f = e.group ? this.formation(e.group) : undefined;
    if (f && ++f.killed === CHORD.size && !f.broken) {
      const bonus = CHORD.bonus * this.mult;
      this.mult = Math.min(PLAY.harmonyMax, this.mult + 1);
      this.addScore(bonus);
      this.fx.popup(e.x, e.y - 26, `CHORD ${bonus}`, TEXT.magenta);
      this.fx.ring(e.x, e.y, 4, 200, 0.6, hue + 90, 2);
    }
  }

  private formation(g: number) {
    let f = this.formations.get(g);
    if (!f) this.formations.set(g, (f = { killed: 0, broken: false }));
    return f;
  }

  /** A pickup caught: a crystal switches or levels the weapon, the rest add a Harmonic, speed or grace notes. */
  collect(p: Pickup) {
    const c = this.craft;
    const hue = this.land.hue;
    this.fx.burst(p.x, p.y, 12, hue + 60, 0.6);
    this.fx.ring(p.x, p.y, 16, -30, 0.4, hue + 60);
    let msg: string;
    if (p.kind === 'crystal') {
      const w = crystalWeapon(p);
      if (w === c.weapon) c.level = Math.min(MAX_LEVEL, c.level + 1);
      else c.weapon = w;
      msg = `${w.toUpperCase()} ${c.level}`;
    } else if (p.kind === 'harmonic') {
      c.harm = Math.min(HARMONIC.max, c.harm + 1);
      msg = 'HARMONIC';
    } else if (p.kind === 'speed') {
      c.speed = Math.min(PICKUPS.maxSpeed, c.speed + 1);
      msg = `SPEED ${c.speed}`;
    } else {
      c.fork = true;
      msg = 'GRACE NOTES';
    }
    this.fx.popup(p.x, p.y - 12, msg, TEXT.beam);
    this.sfx.blip(990);
  }

  addScore(n: number) {
    const before = Math.floor(this.score / PLAY.extraShip);
    this.score += n;
    if (Math.floor(this.score / PLAY.extraShip) > before) {
      this.ships++;
      this.fx.popup(this.craft.x, this.craft.y - 24, '+SHIP', TEXT.beam);
    }
  }

  private draw() {
    const c = this.craft;
    const hue = this.land.hue;
    const { gBack, gMid, gFront, gFoe } = this;
    gBack.clear();
    gMid.clear();
    gFront.clear();
    gFoe.clear();
    if (this.landOnly) {
      for (const o of this.children.list) if (o !== this.land.image) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
      return;
    }
    this.fx.drawSparks(gBack, false);
    drawFoes(this, gFoe);
    drawPickups(this, gBack, gMid);
    drawShots(gMid, this, false);

    const alive = this.gameOver < 0;
    const blinkOff = c.invuln > 0 && Math.floor(this.beat.time * 20) % 2 === 0;
    // Turned a quarter, the image's own x axis is the screen's y, so the squash goes on scaleX.
    this.ship.setPosition(c.x, c.y).setScale(c.bank, 1).setVisible(alive && !blinkOff);
    if (alive && !blinkOff && !REDUCED) {
      gMid.fillStyle(hsl(hue + 300, 0.65), 0.8).fillRect(c.x - 11 - Math.random() * 2, c.y - 0.5, 3 + Math.random() * 2, 1);
    }
    // Speakers: a soft glow behind each so dark picks still read, and a 1 px kick back with every note.
    const kick = this.kick > 0 && !REDUCED ? -1 : 0;
    const hs = this.harmonics();
    this.speakers.forEach((img, i) => {
      const h = hs[i];
      img.setVisible(!!h && alive);
      if (!h) return;
      const behind = h.z < 0;
      gMid.fillStyle(hsl(hue + 60, 0.7), 0.35 * (behind ? 0.85 : 1)).fillCircle(h.x, h.y, 5);
      img.setPosition(h.x + kick, h.y).setDepth(behind ? 9 : 12).setAlpha(behind ? 0.85 : 1);
    });
    if (alive) this.echo.draw(gMid, REDUCED);

    drawShots(gFront, this, true);
    drawBeams(gFront, this);
    drawNotes(gFront, this, COLORS.danger);
    if (c.charging && alive) this.drawCharge(gFront);
    this.fx.drawSparks(gFront, true);
    this.fx.drawRings(gFront);
    this.drawChevrons(gFront);
    const o = this.fx.offset;
    this.cameras.main.setScroll(this.camBase.x + o.x, this.camBase.y + o.y);
  }

  /** A double chevron blinking at the right edge where something will arrive a beat from now. */
  private drawChevrons(g: Phaser.GameObjects.Graphics) {
    if (Math.floor(this.beat.time * 8) % 2) return;
    for (const w of this.warns) {
      for (let i = 0; i < 2; i++) {
        const x = WIDTH - 10 + i * 4;
        g.fillStyle(0x000000).fillTriangle(x + 4, w.y - 5, x - 1, w.y, x + 4, w.y + 5);
        g.fillStyle(COLORS.gold).fillTriangle(x + 3, w.y - 4, x, w.y, x + 3, w.y + 4);
      }
    }
  }

  /** Three arcs that fill one per beat held, and a ring closing in on the next; solid white when a release would resonate. */
  private drawCharge(g: Phaser.GameObjects.Graphics) {
    const c = this.craft;
    const t = this.tier();
    const TAU = Math.PI * 2;
    if (t >= CHARGE.resonantTier && this.beat.onBeat(BEAT_WINDOW)) {
      g.lineStyle(2, 0xffffff).strokeCircle(c.x, c.y, 12);
    } else {
      for (let i = 0; i < 3; i++) {
        const a0 = -Math.PI / 2 + i * (TAU / 3) + 0.15;
        if (i < t) g.lineStyle(1.5, hsl(this.land.hue + 180, 0.7));
        else g.lineStyle(0.75, COLORS.ink, 0.25);
        g.beginPath().arc(c.x, c.y, 12, a0, a0 + TAU / 3 - 0.3).strokePath();
      }
    }
    const part = (c.charge % this.beat.spb) / this.beat.spb;
    if (t < 3) g.lineStyle(0.5, hsl(this.land.hue + 180, 0.7), 0.6).strokeCircle(c.x, c.y, 12 + 6 * (1 - part));
  }

  // ---- Dev hooks for the tests (also handy from the console). ----

  spawn(kind: FoeKind, x: number, opts: SpawnOptions = {}) {
    return spawnFoe(this, kind, x, opts);
  }

  /** Removes every enemy, shot, note, pickup and arrival, and stops the spawn script. */
  clearField() {
    for (const e of this.foes) e.img?.destroy();
    for (const p of this.pickups) p.img.destroy();
    this.foes = [];
    this.pickups = [];
    this.warns = [];
    this.shots = [];
    this.beams = [];
    this.notes = [];
    this.fx.clear();
    this.scripted = false;
  }

  /** Moves the beat clock to `frac` of the way through the current beat. */
  setBeatPhase(frac: number) {
    this.beat.time = (this.beat.beat + frac) * this.beat.spb;
    this.beat.update(0);
    this.band.seek(this.beat);
  }

  /** Drops a pickup; `t` sets how far through its cycle a crystal starts. */
  drop(kind: PickupKind, x: number, y: number, t = 0) {
    return dropPickup(this, kind, x, y, t);
  }

  /** Runs a spawn pattern now (its arrivals come a beat later). */
  pattern(p: Pattern) {
    runPattern(this, p);
  }

  /**
   * Dev: whether Movement `movement` (at `loop`) can be flown at speed level `speed` past its terrain and every
   * pinned enemy, with the craft's own collision rules. The world x where it's blocked, or -1.
   */
  reach(movement: number, loop: number, speed: number) {
    const terrain = terrainFor(movement);
    const bpm = tempo(movement, loop);
    const { scroll } = MOVEMENTS[movement];
    const obstacles = pinnedSpots(movement, bpm, scroll, terrain).map((p) => ({ wx: p.wx, y: p.y, reach: p.r + 3 }));
    const length = scroll * (scriptBars(movement) + PLAY.outro) * 4 * (60 / bpm) + WIDTH;
    return blockedAt(terrain, {
      scroll, speed: CRAFT.speed + CRAFT.speedStep * (speed - 1), x: CRAFT.startX, minY: CRAFT.minY, maxY: CRAFT.maxY,
      probes: CRAFT.probes, edgeReach: CRAFT.edgeReach, length, obstacles,
    });
  }

  /** Loses the last ship now (the game-over panel follows). */
  lose() {
    this.ships = 1;
    this.craft.harm = 0;
    this.craft.invuln = 0;
    this.echo.knockLoose();
    this.hitCraft();
  }

  /** Starts a fresh run at a movement and loop (it can't set the high score unless it's Movement I, loop 0). */
  skipTo(movement: number, loop = 0) {
    this.restartWith(newRun(movement, loop));
  }

  grant(p: { harm?: number; level?: number; ships?: number; speed?: number; weapon?: Weapon; fork?: boolean }) {
    const c = this.craft;
    if (p.weapon !== undefined) c.weapon = p.weapon;
    if (p.fork !== undefined) c.fork = p.fork;
    if (p.harm !== undefined) c.harm = clamp(p.harm, 0, HARMONIC.max);
    if (p.level !== undefined) c.level = clamp(p.level, 1, MAX_LEVEL);
    if (p.speed !== undefined) c.speed = clamp(p.speed, 1, 3);
    if (p.ships !== undefined) this.ships = p.ships;
  }

  private publish(device: Device) {
    const m = MOVEMENTS[this.movement];
    const c = this.craft;
    const state: HudState = {
      score: this.score,
      hi: loadHi(),
      mult: this.mult,
      beat: this.beat.beat,
      hue: this.land.hue,
      ships: this.ships,
      speed: c.speed,
      movement: m.name,
      numeral: this.loop > 0 ? `${m.numeral}  ·  ENCORE${this.loop > 1 ? ` ${this.loop}` : ''}` : m.numeral,
      device,
      attract: this.attract !== undefined,
      weapon: c.weapon,
      level: c.level,
      harm: c.harm,
      echo: this.echo.attached ? 'attached' : this.echo.state === 'loose' ? 'loose' : 'away',
      muted: this.sound.mute,
      paused: this.paused,
      over: this.gameOver >= 0,
      choice: this.choice,
      ready: this.gameOver >= PLAY.gameOver,
      newHi: this.newHi,
      eligible: this.eligible,
    };
    this.registry.set('hud', state);
  }

  /** Back to the title. A run that's still going keeps its high score. */
  leave() {
    if (this.leaving) return;
    this.leaving = true;
    if (this.gameOver < 0 && this.eligible) saveHi(this.score);
    this.sfx.chargeStop();
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('hud');
      this.scene.start('title');
    });
  }
}
