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

const cells = (v: number) => Math.max(1, Math.round(v / CELL)) * CELL;
/** The column a world x belongs to, sampled at its middle so the whole column shares one height. */
const column = (wx: number) => Math.floor(wx / COL) * COL + COL / 2;

// Movement I: one smooth shape from a few sines (original, not R-Type's), stepped into Equalizer columns.
const ceilI = (wx: number) => 11 + 6 * (1 + Math.sin(wx * 0.012)) + 24 * Math.max(0, Math.sin(wx * 0.0041 + 0.6)) ** 3;
const floorI = (wx: number) => 27 + 6 * (1 + Math.sin(wx * 0.01 + 2)) + 24 * Math.max(0, Math.sin(wx * 0.0037 + 2.4)) ** 3;

export const MOVEMENT_I: Terrain = {
  ceilY: (wx) => TOP + cells(ceilI(column(wx))),
  floorY: (wx) => HEIGHT - cells(floorI(column(wx))),
};

export function terrainFor(movement: number): Terrain {
  return [MOVEMENT_I][movement] ?? MOVEMENT_I;
}

/** True if (x, y) on screen is inside the frame, given how far the world has scrolled. */
export function solidAt(t: Terrain, scrollX: number, x: number, y: number) {
  const wx = scrollX + x;
  return y < t.ceilY(wx) || y > t.floorY(wx);
}
