import type Phaser from 'phaser';
import { BOSS, BOSSES, FOES, HEIGHT, NOTES, TOP, WIDTH, type BossKind, type FoeKind } from '../config';
import { hsl } from '../effects';
import { clamp } from '../land/bake';
import { mod } from '../synth';
import type { StageScene } from '../scenes/StageScene';
import { spawnFoe, type Foe } from './foes';

/** One of the boss's attacks: fired on a beat, warned for from `warnFrom` into the beat before. */
export interface Attack {
  beat: number;
  /** Beat time when the warning started, and when it fired. */
  warned: number;
  fired: number;
}

const TAU = Math.PI * 2;
/** Great Eel: body segments, seconds apart along the head's path, and the path's speeds. */
const GREAT_EEL = { segments: 12, lag: 0.13, r: 7, sx: 0.9, sy: 1.7 };

/**
 * A movement's boss. Its core and parts are ordinary enemies (so shots, beams, the Echo and contact all work on
 * them), but the boss moves them, fires them and decides when the core can be hurt.
 *   The Halo (I): a turning ring of eight Sentries round the core; the three on your side fire on beat 3 of each bar.
 *   The Great Eel (II): the core is the head of a long armoured serpent winding through the strings.
 *   The Conductor (III): four instruments orbit the core, each firing its own pattern.
 * The core opens on the first beat of every bar and shoots while it's open.
 */
export class Boss {
  readonly kind: BossKind;
  readonly name: string;
  readonly points: number;
  readonly maxHp: number;
  readonly core: Foe;
  readonly parts: Foe[] = [];
  /** Seconds since it arrived. */
  t = 0;
  /** The Great Eel's own clock: it runs slower while the eye is open, so the whole body slows to look at you. */
  private pathT = 0;
  /** Every attack so far (the tests read this). */
  readonly attacks: Attack[] = [];
  /** Seconds since the core died (-1: still fighting). */
  dying = -1;
  /** Where the core is centred, before the bob and the fly-in. */
  private home = { x: WIDTH - 72, y: (TOP + HEIGHT) / 2 };
  private readonly arrived: number;
  /** Per foe: the beat time its current warning started. */
  private warnedAt = new Map<Foe, number>();
  private clink = 0;

  constructor(private readonly stage: StageScene, movement: number) {
    const def = BOSSES[movement] ?? BOSSES[0];
    this.kind = def.kind;
    this.name = def.name;
    this.points = def.points;
    this.maxHp = Math.round(def.hp * (1 + BOSS.hpLoop * stage.loop));
    this.arrived = stage.beat.beat + 1;
    const x = WIDTH + 60;
    this.core = spawnFoe(stage, 'core', x, { ground: 0, y: this.home.y, boss: this });
    this.core.hp = this.maxHp;
    this.core.img!.setScale(this.kind === 'eel' ? 1.5 : 2);
    if (this.kind === 'eel') this.core.r = 10;
    const part = (kind: FoeKind, i: number, extra = {}) => {
      const e = spawnFoe(stage, kind, x, { ground: 0, y: this.home.y, boss: this, i, ...extra });
      e.hp = FOES[kind].hp * BOSS.partHp;
      this.parts.push(e);
      return e;
    };
    if (this.kind === 'halo') for (let i = 0; i < 8; i++) part('drummer', i);
    else if (this.kind === 'eel') {
      for (let i = 1; i <= GREAT_EEL.segments; i++) part('eel', i).r = GREAT_EEL.r;
    } else (['drummer', 'jelly', 'horn', 'metronome'] as const).forEach((k, i) => part(k, i));
    this.update(0);
  }

  /** Fully in: until then it can't be hurt and doesn't fire. */
  get entered() {
    return this.stage.beat.beat >= this.arrived + BOSS.enter;
  }

  /** The core is open on the first `BOSS.open` beats of every bar. */
  get open() {
    return this.openOn(this.stage.beat.beat);
  }

  /** Whether the core is open on beat `b` (the band rings a bell as it opens). */
  opensOn(b: number) {
    return this.openOn(b);
  }

  private openOn(b: number) {
    return b >= this.arrived + BOSS.enter && mod(b, 4) < BOSS.open && this.dying < 0;
  }

  /** Whether a hit on `e` does damage: the core only while open, and the Great Eel's body never. */
  vulnerable(e: Foe) {
    if (e === this.core) return this.open;
    return this.kind !== 'eel';
  }

  /** A shot glancing off the shut core or the armoured body: a small spark, a few times a second at most. */
  glance(e: Foe) {
    if (this.stage.beat.time - this.clink < 0.12) return;
    this.clink = this.stage.beat.time;
    this.stage.sfx.glance();
    this.stage.fx.burst(e.x - e.r, e.y, 3, this.stage.land.hue + 180, 0.4);
  }

  get hpFraction() {
    return clamp(this.core.hp / this.maxHp, 0, 1);
  }

  /** Moves everything and sets the warnings for the next beat's attacks. */
  update(dt: number) {
    const { beat } = this.stage;
    this.t += dt;
    this.pathT += dt * (this.open ? 0.35 : 1);
    if (this.dying >= 0) this.dying += dt;
    const bf = beat.beat + beat.frac;
    // Flies in from the right over BOSS.enter beats, easing to a stop.
    const k = clamp((bf - this.arrived + 1) / (BOSS.enter + 1), 0, 1);
    const fly = (1 - k) ** 2 * 150;
    const c = this.core;
    if (this.kind === 'eel') {
      this.eelPath(c, this.pathT, fly);
      for (const p of this.parts) this.eelPath(p, this.pathT - p.i * GREAT_EEL.lag, fly);
    } else {
      c.x = this.home.x + fly;
      // A slow bob over two bars, at the end of its swing (so nearly still) while the core is open.
      c.y = this.gapMid(c.x) + 18 * Math.cos(((bf - 1) * TAU) / 8);
      for (const p of this.parts) {
        const a = this.angle(p, bf);
        const radius = this.kind === 'halo' ? 36 : 46;
        p.x = c.x + Math.cos(a) * radius;
        p.y = c.y + Math.sin(a) * radius;
        // The Halo's Sentries face outward.
        if (this.kind === 'halo') p.img?.setRotation(a + Math.PI / 2);
      }
    }
    // Warn from BOSS.warnFrom into the beat before an attack, so it always shows for well over half a beat.
    const next = beat.beat + 1;
    for (const e of [c, ...this.parts]) {
      const warn = !e.dead && beat.frac >= BOSS.warnFrom && this.fires(e, next);
      if (warn && !e.warn) this.warnedAt.set(e, beat.time);
      e.warn = warn;
    }
  }

  /** Where the gap's middle is at screen x. */
  private gapMid(x: number) {
    const wx = this.stage.scrollX + x;
    return (this.stage.terrain.ceilY(wx) + this.stage.terrain.floorY(wx)) / 2;
  }

  /** The Great Eel winds a figure of eight through the right of the screen, kept inside the gap. */
  private eelPath(e: Foe, t: number, fly: number) {
    e.x = WIDTH * 0.62 + 95 * Math.sin(t * GREAT_EEL.sx) + fly;
    const wx = this.stage.scrollX + e.x;
    const ceil = this.stage.terrain.ceilY(wx) + 14;
    const floor = this.stage.terrain.floorY(wx) - 14;
    e.y = (ceil + floor) / 2 + ((floor - ceil) / 2) * Math.sin(t * GREAT_EEL.sy + 0.5);
  }

  /** A ring part's angle round the core. The Halo snaps a sixteenth of a turn round on each beat; the Conductor's instruments turn slowly. */
  private angle(p: Foe, bf: number) {
    if (this.kind === 'halo') {
      const ease = Math.floor(bf) + Math.min(1, (bf % 1) * 3);
      return (p.i / 8) * TAU + (ease * TAU) / 16;
    }
    return (p.i / 4) * TAU + (bf * TAU) / 32;
  }

  /** Whether `e` fires on beat `b`. Used both to warn and to fire, so nothing fires unannounced. */
  private fires(e: Foe, b: number) {
    if (e.dead || this.dying >= 0 || b < this.arrived + BOSS.enter) return false;
    const inBar = mod(b, 4);
    if (e === this.core) return this.openOn(b) && inBar === 1;
    switch (this.kind) {
      case 'halo':
        // The Sentries on the left of the ring (facing you) when the beat comes.
        return inBar === 2 && Math.cos(this.angle(e, b)) < -0.3;
      case 'eel':
        return inBar === 3 && e.i % 3 === 0;
      case 'conductor':
        if (e.kind === 'drummer') return inBar % 2 === 0;
        if (e.kind === 'jelly') return inBar === 2;
        if (e.kind === 'horn') return inBar === 3;
        return inBar === 0;
    }
  }

  onBeat(b: number) {
    const { stage } = this;
    const k = stage.noteScale;
    const craft = stage.craft;
    for (const e of [this.core, ...this.parts]) {
      if (!this.fires(e, b)) continue;
      this.attacks.push({ beat: b, warned: this.warnedAt.get(e) ?? stage.beat.time, fired: stage.beat.time });
      const aim = Math.atan2(craft.y - e.y, craft.x - e.x);
      const shoot = (a: number, speed: number) => stage.addNote(e.x, e.y, Math.cos(a) * speed * k, Math.sin(a) * speed * k);
      if (e === this.core) {
        // A spiral from the core, turned a little each bar; the Great Eel's head spits three at you instead.
        if (this.kind === 'eel') for (const d of [-0.25, 0, 0.25]) shoot(aim + d, NOTES.speed);
        else for (let i = 0; i < 10; i++) shoot((i / 10) * TAU + b * 0.3, 60);
      } else if (this.kind === 'halo') shoot(aim, NOTES.speed);
      else if (this.kind === 'eel') {
        // Each third segment throws a pair, up and down.
        shoot(-Math.PI / 2 - 0.3, 58);
        shoot(Math.PI / 2 + 0.3, 58);
      } else if (e.kind === 'drummer') shoot(aim, NOTES.speed);
      else if (e.kind === 'jelly') for (let i = 0; i < 6; i++) shoot((i / 6) * TAU + b, 52);
      else if (e.kind === 'horn') for (let i = -2; i <= 2; i++) shoot(aim + i * 0.22, 66);
      else {
        shoot(-Math.PI * 0.75, 70);
        shoot(Math.PI * 0.75, 70);
      }
    }
  }

  /** The core dies: the parts go with it (for their points), and the explosions start. */
  defeat() {
    if (this.dying >= 0) return;
    this.dying = 0;
    for (const p of this.parts) p.warn = false;
  }

  /** The core's shutter, drawn over it while it's shut, and a ring round it while it's open. */
  draw(g: Phaser.GameObjects.Graphics) {
    const c = this.core;
    if (c.dead) return;
    const x = Math.round(c.x);
    const y = Math.round(c.y);
    const r = c.r + 1;
    if (this.open) {
      const pulse = 1 + this.stage.beat.env * 3;
      g.lineStyle(1, 0xffffff, 0.8).strokeCircle(x, y, r + pulse);
      return;
    }
    // Shut: a plate with a seam and two rivets.
    g.fillStyle(0x140b26).fillCircle(x, y, r);
    g.lineStyle(1, 0xd8ccff).strokeCircle(x, y, r);
    g.lineStyle(1, hsl(this.stage.land.hue + 40, 0.5, 0.6)).lineBetween(x - r + 2, y, x + r - 2, y);
    g.fillStyle(0xd8ccff).fillRect(x - 2, y - r + 3, 1, 1).fillRect(x + 1, y + r - 4, 1, 1);
  }
}
