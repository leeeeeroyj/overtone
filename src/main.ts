import Phaser from 'phaser';
import { ATTRACT } from './attract';
import { HEIGHT, RENDER_SCALE, WIDTH } from './config';
import { HudScene } from './scenes/HudScene';
import { StageScene } from './scenes/StageScene';
import { TitleScene } from './scenes/TitleScene';

/** Loads the self-hosted fonts (relative URLs, so they work under any base path). */
function loadFonts() {
  const faces = [
    new FontFace('Doto', 'url(fonts/doto-900.woff2)', { weight: '900' }),
    new FontFace('Monoton', 'url(fonts/monoton.woff2)'),
  ];
  return Promise.all(faces.map((f) => f.load().then((loaded) => document.fonts.add(loaded))));
}

async function start() {
  // Phaser bakes text into textures when it's created, so the fonts must be ready first.
  await Promise.race([loadFonts(), new Promise((resolve) => setTimeout(resolve, ATTRACT ? 400 : 2000))]).catch(() => {});

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: WIDTH * RENDER_SCALE,
    height: HEIGHT * RENDER_SCALE,
    backgroundColor: '#07040f',
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // Two touch pointers: one per thumb.
    // Attract mode: no input plugins (so no listeners, no preventDefault, no gamepad polling) and no audio context.
    input: ATTRACT ? { keyboard: false, mouse: false, touch: false, gamepad: false } : { gamepad: true, activePointers: 2 },
    audio: ATTRACT ? { noAudio: true } : {},
    scene: [TitleScene, StageScene, HudScene],
  });
  // Dev-only handle for poking at the running game from the console or a test script.
  if (import.meta.env.DEV) Object.assign(window, { __overtone: game });
}

void start();
