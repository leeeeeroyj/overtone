import type Phaser from 'phaser';
import { FONT, FONT_TITLE, FONT_WEIGHT, RENDER_SCALE } from './config';

/**
 * Text in Doto (or Monoton for the name). Doto's dots are round, not pixels, so text is rasterised at the canvas's
 * own resolution for the camera that shows it (`zoom`), never scaled up from a small bitmap.
 */
export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size: number,
  color: string,
  { zoom = RENDER_SCALE, title = false, align = 'left' as 'left' | 'center' | 'right' } = {},
) {
  const t = scene.add.text(x, y, str, {
    fontFamily: title ? FONT_TITLE : FONT,
    fontStyle: title ? 'normal' : FONT_WEIGHT,
    fontSize: `${size}px`,
    color,
    align,
    resolution: zoom,
  });
  return t.setOrigin(align === 'center' ? 0.5 : align === 'right' ? 1 : 0, 0);
}
