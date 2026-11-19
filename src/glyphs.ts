import type Phaser from 'phaser';

export type GlyphKind = 'spiral' | 'prism' | 'sonar' | 'speed' | 'fork' | 'harmonic';
type Pt = { x: number; y: number };

/**
 * Small line icons for the weapons and pickups, each told apart by shape (never colour alone): SPIRAL two crossing
 * strands, PRISM a triangle, SONAR two arcs, SPEED a double chevron, the fork a tuning fork, a Harmonic a quaver.
 * Drawn with a black outline at scale `k` (1 in the game, 2 in the HUD), centred on (x, y).
 */
export function glyph(g: Phaser.GameObjects.Graphics, kind: GlyphKind, x: number, y: number, color: number, k = 1) {
  const paths = shapes(kind).map((p) => p.map((q) => ({ x: x + q.x * k, y: y + q.y * k })));
  for (const [w, c] of [[2.2 * k, 0x000000], [k, color]] as const) {
    g.lineStyle(w, c);
    for (const p of paths) g.strokePoints(p as Phaser.Math.Vector2[], closed(kind, p));
  }
}

const closed = (kind: GlyphKind, p: Pt[]) => kind === 'prism' || (kind === 'harmonic' && p.length > 6);

function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 10): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  });
}

function shapes(kind: GlyphKind): Pt[][] {
  switch (kind) {
    case 'spiral':
      return [1, -1].map((s) => Array.from({ length: 13 }, (_, i) => ({ x: -4 + (i / 12) * 8, y: s * 2.4 * Math.sin((i / 12) * Math.PI * 2) })));
    case 'prism':
      return [[{ x: 0, y: -3.5 }, { x: 3.8, y: 3 }, { x: -3.8, y: 3 }]];
    case 'sonar':
      return [arc(-2, 0, 2.5, 4, -Math.PI / 2, Math.PI / 2), arc(1, 0, 2.5, 4.5, -Math.PI / 2, Math.PI / 2)];
    case 'speed':
      return [
        [{ x: -3, y: -3 }, { x: 0, y: 0 }, { x: -3, y: 3 }],
        [{ x: 0, y: -3 }, { x: 3, y: 0 }, { x: 0, y: 3 }],
      ];
    case 'fork':
      return [
        [{ x: -2, y: -4 }, { x: -2, y: 1 }, { x: 2, y: 1 }, { x: 2, y: -4 }],
        [{ x: 0, y: 1 }, { x: 0, y: 4 }],
      ];
    case 'harmonic':
      return [arc(-1, 2.5, 1.8, 1.3, 0, Math.PI * 2, 12), [{ x: 0.7, y: 2.3 }, { x: 0.7, y: -4 }, { x: 3, y: -2.5 }]];
  }
}
