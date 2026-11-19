export const WIDTH = 416;
export const HEIGHT = 228;
/** Top bar height: the play area starts below it. */
export const TOP = 16;

/**
 * The canvas renders at this multiple of the design size. The game scene zooms its camera by it, and the HUD scene
 * zooms by half as much, so native 16 px sprites show at half size there without being shrunk.
 */
export const RENDER_SCALE = 4;
export const HUD_SCALE = RENDER_SCALE / 2;

/** Monoton for the name, Doto (900) for every word and number the game shows. Both are self-hosted in assets/fonts. */
export const FONT_TITLE = 'Monoton, monospace';
export const FONT = 'Doto, monospace';
export const FONT_WEIGHT = '900';

export const COLORS = {
  void: 0x07040f,
  panel: 0x120b24,
  line: 0x2a1d4d,
  ink: 0xf1ebff,
  dim: 0xa497cc,
  gold: 0xffd84d,
  beam: 0x5ff3ff,
  magenta: 0xff4fd8,
  danger: 0xff5c8a,
  off: 0x3a2d63,
};

export const TEXT = {
  ink: '#f1ebff',
  dim: '#a497cc',
  gold: '#ffd84d',
  beam: '#5ff3ff',
  magenta: '#ff4fd8',
  danger: '#ff5c8a',
  off: '#3a2d63',
};

/** Sprite slots exported by tools/sprites.py to assets/sprites/<slot>.png. */
export const SPRITES = [
  'player', 'echo', 'harmonic', 'chirp', 'jelly', 'drummer', 'metronome', 'cymbal', 'horn', 'eel', 'carrier',
  'core', 'crystal', 'speed', 'fork',
] as const;
export type SpriteKey = (typeof SPRITES)[number];

/** Each movement's tempo (beats per minute) and scroll speed (design px per second). */
export const MOVEMENTS = [
  { name: 'PULSE', numeral: 'I', bpm: 128, scroll: 44 },
] as const;

/**
 * The craft. Speeds in design px per second. It squashes to `bankScale` tall (a bank) while climbing or diving
 * faster than `bankAt` of its speed. The frame bounces it back by `bounce` and it blinks for `invuln` seconds.
 */
export const CRAFT = {
  speed: 108,
  speedStep: 22,
  minX: 12,
  maxX: WIDTH - 24,
  minY: TOP + 6,
  maxY: HEIGHT - 6,
  startX: 90,
  startY: 112,
  bankAt: 0.35,
  bankScale: 0.75,
  /** The frame hits when the craft's centre comes this close to an edge. */
  edgeReach: 4,
  bounce: 8,
  /** Edge probes either side of the craft's centre, design px. */
  probes: [-6, 0, 6],
  invuln: 1.2,
};

/** How close to a beat (either side, seconds) a release, or anything else "on the beat", has to land. */
export const BEAT_WINDOW = 0.09;

/** FIRE: the craft's own notes, held for a steady stream. The Echo repeats them while it's away. Speeds in px/s. */
export const FIRE = { cool: 0.12, speed: 330, echoCool: 0.25, echoSpeed: 300, damage: 1, hitPad: 2 };

/**
 * CHARGE: hold to fill a tier per beat held (at `tierAt` beats), release for a beam that sweeps right, piercing.
 * A release at `resonantTier` or higher within BEAT_WINDOW of a beat is resonant: `resonant`x width and damage,
 * double points, and +1 Harmony per kill.
 */
export const CHARGE = {
  tierAt: [0.85, 1.85, 2.85],
  width: [0, 6, 10, 16],
  damage: [0, 3, 6, 12],
  resonantTier: 2,
  resonant: 1.5,
  /** The beam's head speed and longest length, px/s and px. */
  speed: 560,
  length: 280,
};

/**
 * The Echo: a living orb of sound drawn at half size (8 px). Attached, it sits `offset` px ahead of or behind the
 * craft. Launched, it flies to `hoverFront`/`hoverBack` and follows your height at `follow` px/s; recalled, it homes
 * in at `recall` px/s. It catches on whichever end touches it (`catch` px). It blocks enemy notes within `block` px
 * and hurts anything within `touch` px of its edge at `dps`. Knocked loose it drifts at `looseSpeed` until touched.
 */
export const ECHO = {
  scale: 0.5,
  offset: 9,
  launch: 260,
  hoverFront: 300,
  hoverBack: 34,
  follow: 40,
  recall: 230,
  catch: 12,
  block: 5,
  touch: 4,
  dps: 10,
  looseSpeed: 24,
};

/** Harmonics: up to `max` speakers at half size, `offset` px above and below the craft, firing a note every half-beat. */
export const HARMONIC = { scale: 0.5, max: 2, offset: 11, block: 4, noteSpeed: 220 };

/** The Echo's weapons, levels 1-3. SPIRAL: a double helix whose amplitude grows with level. */
export const WEAPONS = {
  spiral: { cool: 0.2, speed: 250, amp: (level: number) => 4 + 3 * level, damage: 1 },
};
export type Weapon = keyof typeof WEAPONS;
export const MAX_LEVEL = 3;

/**
 * Enemies. `r` is the hit radius (a little smaller than the art). Sentries sit on the floor or ceiling and fire
 * an aimed note every `every` beats; they flash white for the half-beat before.
 */
export const FOES = {
  drummer: { name: 'SENTRY', points: 200, hp: 3, r: 6, every: 2 },
} as const;
export type FoeKind = keyof typeof FOES;

/** Enemy notes: speed in px/s; they hit the craft within `hit` px of its centre. */
export const NOTES = { speed: 84, hit: 4.5 };

/** Scoring, ships and hits. A hit costs a Harmonic, then a weapon level, then knocks the Echo loose, then a ship. */
export const PLAY = {
  ships: 3,
  extraShip: 50000,
  harmonyMax: 8,
  /** Blink after a hit, s; after losing a ship, s. */
  invuln: 1.2,
  respawn: 2,
  /** Running into an enemy costs you a hit and does this much damage to it. */
  ramDamage: 2,
  /** After the last ship goes, s before the title. */
  gameOver: 3,
};
