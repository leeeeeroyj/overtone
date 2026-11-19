<div align="center">

# Overtone

**A shooter that keeps time.**

A side-scrolling shooter through a neon cosmos where everything moves to the beat. It runs in the browser with a keyboard, mouse or controller.

### [▶ Play it now](https://leeeeeroyj.github.io/overtone/)

[![Deploy](https://github.com/leeeeeroyj/overtone/actions/workflows/deploy.yml/badge.svg)](https://github.com/leeeeeroyj/overtone/actions/workflows/deploy.yml)
![Phaser 4](https://img.shields.io/badge/Phaser-4-8a5cf6)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

![Overtone: the craft, with the Echo orb on its nose and a small speaker above and below it, dodges diamond-shaped notes fired by Sentries on the LED-meter floor and ceiling, under a speaker-cone moon](docs/screenshot.png)

</div>

## About

Overtone is an original arcade game inspired by the mechanics of Irem's 1987 arcade game *R-Type*. The game is being built in the open; this is how it plays today.

- **Movement I, Pulse.** A dusk over a city of instruments at 128 beats a minute. A speaker-cone moon ripples on every kick, spectrum-analyser mountains bounce with the music, and the city's lights play in turn through each bar.
- **Charge on the beat.** Hold CHARGE for a beat per tier, then let go for a piercing beam. Let go right on the beat and it's **resonant**: wider, harder, worth double and it raises your Harmony.
- **The Echo.** A living orb of sound rides on your nose. It blocks shots, hurts whatever it touches and fires a spiralling double helix. Send it out ahead and it hovers there, repeating your shots, until you call it back.
- **Hits cost power, not lives.** A hit knocks the Echo loose before it costs you a ship, and you can fly back and grab it.
- **A frame that keeps time.** The floor and ceiling are walls of LED cells that jump on every beat. They're solid: touch one and it bounces you off, and that counts as a hit.
- **Drawn and played in code.** Every layer of the landscape is pixel art generated when the game loads, and the music and sound effects are synthesised as you play, in a minor key.

## How to play

Fly through Movement I, shoot what's in your way and keep off the walls. The beat lamp in the top bar shows where you are in the bar: the current beat is filled, and the first beat of the bar is the tall one.

- **FIRE** (hold) streams notes from the craft, and the Echo fires its double helix from whichever end it's on.
- **CHARGE** (hold) stops your fire and fills a tier for each beat you hold it, up to three: a ring of three arcs round the craft fills as you go. Let go for a beam that sweeps across the screen and pierces everything in its path. Let go at tier 2 or 3 within 0.09 s of a beat (the ring turns solid white) and the beam is **resonant**: half as wide again, half as strong again, and each kill pays double and adds one to your Harmony.
- **Harmony** multiplies every point, from ×1 up to ×8. Any hit drops it back to ×1.
- **ECHO** sends the Echo out ahead (or behind, if it's on your tail). It hovers there, drifting toward your height and repeating your shots. Press ECHO again to call it back. It attaches to whichever end of the craft touches it.
- **Getting hit.** A shot, an enemy or the floor or ceiling knocks the Echo loose: it drifts and blinks until you fly into it. Hit again without it and you lose a ship, respawn on the spot with the Echo back on your nose, and blink for 2 seconds. You start with 3 ships and earn another every 50,000 points. Lose the last and it's game over.
- **Anything about to fire flashes white** for the half-beat before it does.

| Enemy | Points | Hits | Behaviour |
| --- | ---: | ---: | --- |
| Sentry | 200 | 3 | Sits on the floor or ceiling and fires a note at you every two beats. |

## Controls

| | Keyboard + mouse | Controller |
| --- | --- | --- |
| Fly | Arrows or W A S D | Left stick or D-pad |
| Fire | Hold Z, Space, J or left click | Hold A |
| Charge | Hold X, K or right click, then let go | Hold X or RT, then let go |
| Echo: send out or call back | C, L, Shift or middle click | B or RB |
| Sound on / off | M, or click the speaker (top right) | Y |
| Start | Enter or Space, or click **START** | A or Start |
| Back to the title | Esc | Back |

Controllers show up once you press a button.

## Run it locally

You need [Node.js](https://nodejs.org/) 20.19+ or 22.12+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check and build to dist/
```

Every push to `main` builds the game and deploys it to GitHub Pages.

## Project layout

```
src/
  main.ts            game setup and fonts
  config.ts          tunables: sizes, tempo, scroll speed, flight, colours
  beat.ts            the beat clock everything keeps time to
  terrain.ts         the floor and ceiling, as functions of distance
  script.ts          what arrives on which beat
  entities/          the Echo, enemies, shots, beams and enemy notes
  effects.ts         sparks, rings, score popups, shake and flash
  synth.ts           oscillator voices and the sound switch
  music.ts           the band, scheduled ahead on the audio clock
  sfx.ts             shots, kills, the charge and the beam
  land/bake.ts       sky and instrument city, baked once as pixel art
  land/Landscape.ts  every layer, drawn each frame in time with the beat
  controls.ts        keyboard, mouse and gamepad input
  text.ts            crisp text in the game's fonts
  hi.ts              the high score, kept in localStorage
  attract.ts         the ?attract demo mode's settings
  scenes/            title screen, the stage and the HUD
assets/sprites/      the game's 16 × 16 sprites
assets/fonts/        Doto and Monoton, with their licences
design/              concept sheet and build plan
tools/sprites.py     sprite search and export script
tools/cdp.mjs        shared headless Chrome harness for the tests
tools/m*-test.mjs    headless Chrome checks
```

## Credits

- **Sprites:** from the CC0 [Angais/pixel-art-atlas-1.4m](https://huggingface.co/datasets/Angais/pixel-art-atlas-1.4m) collection of AI-generated pixel art, found with [Pixel Search](https://huggingface.co/spaces/cfahlgren1/pixel-search).
- **Fonts:** [Monoton](https://fonts.google.com/specimen/Monoton) by Vernon Adams and [Doto](https://fonts.google.com/specimen/Doto) by the Doto Project Authors (both SIL Open Font License).
- **Engine:** [Phaser](https://phaser.io/).
- **Inspiration:** Irem's *R-Type*. Overtone is an original game and isn't affiliated with or endorsed by the original's rights holders.

## License

The code is released under the [MIT License](LICENSE). The sprites in `assets/sprites/` and `design/` are CC0 (public domain), and the fonts in `assets/fonts/` are under the SIL Open Font License.
