// The frame: the only solid ground, above and below. Pure functions of world x (design px), no Phaser, so tests can
// import this straight from the dev server. What's drawn and what collides are the same functions.
import { HEIGHT, TOP } from './config';

/** Equalizer columns are COL px wide and step in CELL px. */
export const COL = 6;
export const CELL = 3;

export interface Terrain {
  /** The ceiling's lowest solid y at world x: anything above it is solid. */
  ceilY(wx: number): number;
  /** The floor's highest solid y at world x: anything below it is solid. */
  floorY(wx: number): number;
}

/** The column a world x belongs to, sampled at its middle so the whole column shares one height. */
const column = (wx: number) => Math.floor(wx / COL) * COL + COL / 2;

// Each movement's floor and ceiling are a few sines (original shapes, not R-Type's), stepped into Equalizer columns.
// Where the two would come too close, both give way so the gap never drops below MIN_GAP.
const MIN_GAP = 64;
const cells = (v: number) => Math.max(1, Math.round(v / CELL)) * CELL;
const bump = (v: number) => Math.max(0, v) ** 3;

type Shape = (wx: number) => number;
const SHAPES: { ceil: Shape; floor: Shape }[] = [
  // I Pulse: gentle, with an occasional swell above or below.
  {
    ceil: (wx) => 11 + 6 * (1 + Math.sin(wx * 0.012)) + 24 * bump(Math.sin(wx * 0.0041 + 0.6)),
    floor: (wx) => 27 + 6 * (1 + Math.sin(wx * 0.01 + 2)) + 24 * bump(Math.sin(wx * 0.0037 + 2.4)),
  },
  // II Strings: a cave, closer above and below, with stalactites and ridges.
  {
    ceil: (wx) => 18 + 8 * (1 + Math.sin(wx * 0.016)) + 30 * bump(Math.sin(wx * 0.0052 + 1)) + 4 * Math.sin(wx * 0.05),
    floor: (wx) => 30 + 8 * (1 + Math.sin(wx * 0.014 + 2)) + 30 * bump(Math.sin(wx * 0.0046 + 3.3)) + 4 * Math.sin(wx * 0.043 + 1),
  },
  // III Crescendo: everything at once, quicker and sharper.
  {
    ceil: (wx) => 14 + 7 * (1 + Math.sin(wx * 0.02)) + 30 * bump(Math.sin(wx * 0.0063 + 0.3)) + 6 * Math.sin(wx * 0.047),
    floor: (wx) => 28 + 7 * (1 + Math.sin(wx * 0.018 + 1.2)) + 30 * bump(Math.sin(wx * 0.0058 + 2)) + 6 * Math.sin(wx * 0.039 + 2),
  },
];

function terrain(shape: { ceil: Shape; floor: Shape }): Terrain {
  // Both edges of a column come from one fit, so they always agree on the gap.
  const fit = (wx: number) => {
    const x = column(wx);
    let c = shape.ceil(x);
    let f = shape.floor(x);
    const room = HEIGHT - TOP - MIN_GAP;
    if (c + f > room) {
      const k = room / (c + f);
      c *= k;
      f *= k;
    }
    return { c: cells(c), f: cells(f) };
  };
  return { ceilY: (wx) => TOP + fit(wx).c, floorY: (wx) => HEIGHT - fit(wx).f };
}

export const TERRAINS = SHAPES.map(terrain);
export const MOVEMENT_I = TERRAINS[0];

export function terrainFor(movement: number): Terrain {
  return TERRAINS[movement] ?? MOVEMENT_I;
}

/** True if (x, y) on screen is inside the frame, given how far the world has scrolled. */
export function solidAt(t: Terrain, scrollX: number, x: number, y: number) {
  const wx = scrollX + x;
  return y < t.ceilY(wx) || y > t.floorY(wx);
}

/** Something that hits on contact and stays put in the world (a Sentry or Snapper): world x, y, and its reach. */
export interface Obstacle {
  wx: number;
  y: number;
  reach: number;
}

export interface ReachOptions {
  /** World px per second. */
  scroll: number;
  /** The craft's vertical speed, px/s. */
  speed: number;
  /** The craft's screen x (it's held there, which only makes the check stricter). */
  x: number;
  minY: number;
  maxY: number;
  probes: number[];
  edgeReach: number;
  /** World px to check, from 0. */
  length: number;
  obstacles: Obstacle[];
}

/**
 * Whether a craft held at one screen x can get from the start to `length` without touching the frame or an
 * obstacle, using the same rules the game does. Every 1 px row is tracked, half a column at a time.
 * Returns the world x where every row was lost, or -1 if a path survives.
 */
export function blockedAt(t: Terrain, o: ReachOptions): number {
  const step = COL / 2;
  const climb = Math.floor((o.speed * step) / o.scroll);
  const rows = o.maxY - o.minY + 1;
  const open = (wx: number, y: number) => {
    for (const dx of o.probes) if (y < t.ceilY(wx + dx) + o.edgeReach || y > t.floorY(wx + dx) - o.edgeReach) return false;
    return o.obstacles.every((b) => Math.abs(b.wx - wx) > b.reach || Math.hypot(b.wx - wx, b.y - y) >= b.reach);
  };
  let live = Array.from({ length: rows }, (_, i) => open(o.x, o.minY + i));
  for (let s = step; s <= o.length; s += step) {
    const wx = s + o.x;
    const next = new Array<boolean>(rows).fill(false);
    let any = false;
    for (let i = 0; i < rows; i++) {
      if (!open(wx, o.minY + i)) continue;
      for (let d = -climb; d <= climb; d++) {
        if (live[i + d]) {
          next[i] = any = true;
          break;
        }
      }
    }
    if (!any) return wx;
    live = next;
  }
  return -1;
}
