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

/**
 * Each movement's tempo (beats per minute), scroll speed (design px per second) and the hue its glows start from.
 * I Pulse: a dusk over the instrument city. II Strings: a cave strung with vibrating strings. III Crescendo:
 * everything at once.
 */
export const MOVEMENTS = [
  { name: 'PULSE', numeral: 'I', bpm: 128, scroll: 44, hue: 285 },
  { name: 'STRINGS', numeral: 'II', bpm: 140, scroll: 48, hue: 170 },
  { name: 'CRESCENDO', numeral: 'III', bpm: 152, scroll: 52, hue: 330 },
] as const;

/**
 * After Movement III the ensemble plays again from Movement I (an ENCORE): each loop adds `bpm` to every tempo and
 * makes enemy notes `noteSpeed` faster (as a share of their speed).
 */
export const LOOP = { bpm: 12, noteSpeed: 0.15 };
export const tempo = (movement: number, loop: number) => MOVEMENTS[movement].bpm + LOOP.bpm * loop;
export const noteScale = (loop: number) => 1 + LOOP.noteSpeed * loop;

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

/**
 * The Echo's weapons, levels 1-3, fired from whichever end it's on. SPIRAL: a double helix whose beads swing in
 * front of and behind the craft, wider each level. PRISM: 1, 3 or 5 beams that bounce off the terrain twice.
 * SONAR: arcs that grow as they fly and pass through terrain, hitting each enemy once.
 */
export const WEAPONS = {
  spiral: { cool: 0.2, speed: 250, amp: (level: number) => 4 + 3 * level, damage: 1 },
  prism: { cool: 0.28, speed: 280, angles: [[0], [0, -0.35, 0.35], [0, -0.35, 0.35, -0.7, 0.7]], bounces: 2, damage: 1 },
  sonar: { cool: 0.42, speed: 170, grow: 40, size: (level: number) => 10 + 6 * level, damage: 1.5 },
};
export type Weapon = keyof typeof WEAPONS;
/** The order a crystal cycles through. */
export const WEAPON_ORDER: Weapon[] = ['spiral', 'prism', 'sonar'];
export const MAX_LEVEL = 3;

/** Grace notes (from the tuning fork): two homing notes every `every` s while firing. */
export const GRACE = { every: 1, speed: 120, spread: 60, turn: 600, max: 190, life: 2.5, damage: 1.5 };

/**
 * Pickups drift left at `drift` px/s and are caught within `catch` px. A crystal shows each weapon for `cycle` s
 * in turn: catch the one you have and it levels up, catch another and you switch. Couriers drop them in `drops` order.
 */
export const PICKUPS = { drift: 30, catch: 11, cycle: 1.5, maxSpeed: 3, drops: ['crystal', 'harmonic', 'speed', 'fork'] as const };
export type PickupKind = (typeof PICKUPS.drops)[number];

/**
 * Enemies, by sprite slot. `r` is the hit radius (a little smaller than the art). Each fires every `every` beats
 * (0: never), on beats where (beat - phase) is a multiple of it, and flashes white for the half-beat before.
 * - Flutter (chirp): formations of five weaving on a sine, surging on each beat. Kill all five for a CHORD.
 * - Jelly: drifts and pulses up on each beat; six notes in a ring every 4 beats.
 * - Sentry (drummer): on the floor or ceiling; an aimed note every 2 beats.
 * - Strider (metronome): hops along the floor every 2 beats; two notes up and back every 4.
 * - Saw (cymbal): announced a beat ahead, then flies in fast at your height, spinning. Doesn't fire.
 * - Snapper (horn): on the floor or ceiling, 8 hits; a five-note fan every 4 beats.
 * - Eel: a head and seven segments winding through the air. Kill the head and the body goes with it.
 * - Courier (carrier): drifts through and drops a pickup when it's destroyed.
 */
export const FOES = {
  chirp: { name: 'FLUTTER', sprite: 'chirp', points: 100, hp: 1, r: 6, every: 0, phase: 0 },
  jelly: { name: 'JELLY', sprite: 'jelly', points: 150, hp: 3, r: 6, every: 4, phase: 0 },
  drummer: { name: 'SENTRY', sprite: 'drummer', points: 200, hp: 3, r: 6, every: 2, phase: 0 },
  metronome: { name: 'STRIDER', sprite: 'metronome', points: 150, hp: 2, r: 6, every: 4, phase: 3 },
  cymbal: { name: 'SAW', sprite: 'cymbal', points: 120, hp: 2, r: 6, every: 0, phase: 0 },
  horn: { name: 'SNAPPER', sprite: 'horn', points: 400, hp: 8, r: 7, every: 4, phase: 1 },
  eel: { name: 'EEL', sprite: 'eel', points: 50, hp: 2, r: 5, every: 0, phase: 0 },
  eelhead: { name: 'EEL HEAD', sprite: 'eel', points: 500, hp: 6, r: 7, every: 0, phase: 0 },
  carrier: { name: 'COURIER', sprite: 'carrier', points: 300, hp: 4, r: 6, every: 0, phase: 0 },
  /** A boss's core: its hit points and points come from BOSSES. */
  core: { name: 'CORE', sprite: 'core', points: 0, hp: 1, r: 12, every: 0, phase: 0 },
} as const;
export type FoeKind = keyof typeof FOES;

/**
 * Bosses, one per movement, after its script. The core opens on the first beat of every bar for `open` beats and can
 * only be hurt then. Hit points grow by `hpLoop` each ENCORE. Parts' hit points are their enemy's times `partHp`.
 */
export const BOSSES = [
  { kind: 'halo', name: 'THE HALO', hp: 80, points: 5000 },
  { kind: 'eel', name: 'GREAT EEL', hp: 100, points: 8000 },
  { kind: 'conductor', name: 'THE CONDUCTOR', hp: 120, points: 10000 },
] as const;
export type BossKind = (typeof BOSSES)[number]['kind'];
export const BOSS = {
  open: 2,
  /** Beats it takes to fly in, during which it can't be hurt and doesn't fire. */
  enter: 4,
  hpLoop: 0.25,
  partHp: 2,
  /** Seconds of explosions between the core's death and MOVEMENT COMPLETE. */
  outro: 1.6,
  /** How far into the beat before an attack its warning starts (so it shows for at least half a beat). */
  warnFrom: 0.25,
};

/** A full Flutter formation shot down: bonus points (times Harmony) and +1 Harmony. */
export const CHORD = { bonus: 1000, size: 5 };

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
  /** After the last ship goes, s before the game-over panel takes input. */
  gameOver: 1.2,
  /** The movement's name stays on screen this long at the start, s. */
  banner: 3,
  /** Bars of quiet after a movement's last wave before it ends. */
  outro: 4,
};
