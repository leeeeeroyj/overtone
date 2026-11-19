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

/** The Echo and the Harmonics draw at half size (8 px), which is still pixel-exact on the 4x canvas. */
export const ECHO = { scale: 0.5 };
export const HARMONIC = { scale: 0.5 };
