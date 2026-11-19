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

![Overtone: the craft, with the Echo orb on its nose and a small speaker above and below it, fires notes and a double helix at a formation of moths, a jellyfish, a saucer and a rainbow eel, between an LED-meter floor and ceiling under a speaker-cone moon](docs/screenshot.png)

</div>

## About

Overtone is an original arcade game inspired by the mechanics of Irem's 1987 arcade game *R-Type*. The game is being built in the open; this is how it plays today.

- **Three movements, each faster than the last.**
  - **I Pulse** (128 beats a minute) is a violet dusk over a city of instruments, to dark, driving music in A minor. A speaker-cone moon ripples on every kick, spectrum-analyser mountains bounce with the music, and the city's lights play in turn through each bar.
  - **II Strings** (140) is a teal cave hung with strings that ring in turn on the beat. The music is hypnotic: D dorian, half-time drums and plucked strings.
  - **III Crescendo** (152) is a red-gold dusk with everything at once, and a triumphant fanfare in E major.
- **A boss ends each movement.** Its core opens on the first beat of every bar, and that's the only time it can be hurt.
- **Encores.** After III the ensemble plays again from I, 12 beats a minute faster, with enemy notes 15% quicker each time round.
- **Charge on the beat.** Hold CHARGE for a beat per tier, then let go for a piercing beam. Let go right on the beat and it's **resonant**: wider, harder, worth double and it raises your Harmony.
- **The Echo.** A living orb of sound rides on your nose. It blocks shots, hurts whatever it touches and fires your weapon: a spiralling double helix, bouncing prism beams or sonar arcs that pass through walls. Send it out ahead and it hovers there, repeating your shots, until you call it back.
- **Hits cost power, not lives.** A hit takes a speaker, then a weapon level, then knocks the Echo loose, before it costs you a ship.
- **A frame that keeps time.** The floor and ceiling are walls of LED cells that jump on every beat. They're solid: touch one and it bounces you off, and that counts as a hit.
- **Drawn and played in code.** Every layer of the landscape is pixel art generated when the game loads, and the music and sound effects are synthesised as you play. Everything keeps time to the music, and every sound is in the movement's key, on the chord that's playing: a kill's chord lands on the next sixteenth note.

## How to play

Fly through the three movements, shoot what's in your way and keep off the walls. Each movement is 80 bars of waves and then a boss. When the boss falls, the next movement starts with your score, ships, Harmony and power carried over. The beat lamp in the top bar shows where you are in the bar: the current beat is filled, and the first beat of the bar is the tall one.

- **FIRE** (hold) streams notes from the craft, and the Echo fires its double helix from whichever end it's on.
- **CHARGE** (hold) stops your fire and fills a tier for each beat you hold it, up to three: a ring of three arcs round the craft fills as you go. Let go for a beam that sweeps across the screen and pierces everything in its path. Let go at tier 2 or 3 within 0.09 s of a beat (the ring turns solid white) and the beam is **resonant**: half as wide again, half as strong again, and each kill pays double and adds one to your Harmony.
- **Harmony** multiplies every point, from ×1 up to ×8. Any hit drops it back to ×1.
- **ECHO** sends the Echo out ahead (or behind, if it's on your tail). It hovers there, drifting toward your height and repeating your shots. Press ECHO again to call it back. It attaches to whichever end of the craft touches it.
- **Getting hit.** A shot, an enemy, or the floor or ceiling costs you a Harmonic if you have one, otherwise a weapon level, otherwise it knocks the Echo loose: it drifts and blinks until you fly into it. Hit again without it and you lose a ship, along with your speed and grace notes. You respawn on the spot with the Echo back on your nose and blink for 2 seconds. You start with 3 ships and earn another every 50,000 points. Lose the last and it's game over.
- **Game over.** **CONTINUE** starts the same movement again with the score at zero, three ships and no power. **RETRY** starts again from Movement I. **TITLE** goes back to the title.
- **High score.** Kept in your browser. Only a run that starts at Movement I and never continues can set it.
- **Fair warning.** Anything about to fire flashes white for the half-beat before it does, and a gold chevron blinks at the right edge, at the height something will arrive, a beat before it does.
- **CHORD.** Shoot down all five Flutters in a formation for 1,000 × your Harmony, and +1 Harmony. If one gets away, there's no bonus.

- **Bosses.** A boss's core is shut behind a riveted plate except for the first two beats of every bar, when the plate opens with a bell, a ring pulses round the eye and the boss bar at the bottom reads OPEN. It clanks shut. Shots glance off it while it's shut. While it's open, the core holds nearly still (the Great Eel slows to a crawl) and fires on the bar's second beat. Destroy the core and the rest of the boss goes with it. The parts round it take twice their usual hits. In an ENCORE, each boss has a quarter more hit points.

| Boss | Movement | Points | Hits | What it does |
| --- | --- | ---: | ---: | --- |
| The Halo | I | 5,000 | 80 | A ring of eight Sentries turning round the core. The ones on your side fire on the third beat of each bar. The core sends out a ring of ten notes. |
| Great Eel | II | 8,000 | 100 | The core is its head, at the front of an armoured body of twelve segments that winds a figure of eight through the cave. Every third segment throws notes up and down on the fourth beat; the head spits three at you. |
| The Conductor | III | 10,000 | 120 | A Sentry, a Jelly, a Snapper and a Strider orbit the core, each firing its own pattern. The core sends out a ring of ten notes. |

| Enemy | Points | Hits | Behaviour |
| --- | ---: | ---: | --- |
| Flutter | 100 | 1 | Flies in formations of five, weaving on a wave and surging on each beat. |
| Jelly | 150 | 3 | Drifts along, pulsing upward on each beat. Fires six notes in a ring every four beats. |
| Sentry | 200 | 3 | Sits on the floor or ceiling and fires a note at you every two beats. |
| Strider | 150 | 2 | Hops along the floor every two beats and fires two notes up and back every four. |
| Saw | 120 | 2 | Spins in fast at the height you were when it arrived. Doesn't shoot. |
| Snapper | 400 | 8 | Sits on the floor or ceiling and fires a fan of five notes at you every four beats. |
| Eel | 500 head, 50 each segment | 6 head, 2 each segment | A head and seven segments winding through the air. Kill the head and the whole body goes with it. |
| Courier | 300 | 4 | Drifts through and drops a pickup when you destroy it. |

Couriers drop pickups in turn: a crystal, a Harmonic, speed, then the tuning fork. Each drifts slowly left with a glyph above it showing what it gives.

| Pickup | What it does |
| --- | --- |
| Crystal | Shows each weapon for 1.5 seconds in turn: SPIRAL (two crossing strands), PRISM (a triangle), SONAR (two arcs). Catch the weapon you already have and it goes up a level, to 3; catch another and you switch to it at the same level. |
| Harmonic | A small speaker above or below the craft, up to two. Each blocks shots and plays a stream of notes on every half-beat while you fire. |
| Speed | One step faster, up to speed 3 (the SPD pips in the top bar). |
| Tuning fork | Grace notes: while you fire, two notes a second that home in on the nearest enemy. |

| Weapon | Level 1 → 3 |
| --- | --- |
| SPIRAL | A double helix; its strands swing wider with each level. |
| PRISM | 1, 3 or 5 beams in a fan. Each bounces off the floor or ceiling twice. |
| SONAR | Arcs that grow as they fly, taller each level, and pass through the floor and ceiling. Each arc hits an enemy once and keeps going. |

## Controls

| | Keyboard + mouse | Controller |
| --- | --- | --- |
| Fly | Arrows or W A S D | Left stick or D-pad |
| Fire | Hold Z, Space, J or left click | Hold A |
| Charge | Hold X, K or right click, then let go | Hold X or RT, then let go |
| Echo: send out or call back | C, L, Shift or middle click | B or RB |
| Pause / resume | P, or click II (top right) | Start |
| Sound on / off | M, or click the speaker (top right) | Y |
| Game over: choose, select | ← → and Enter, or click | D-pad and A |
| Start | Enter or Space, or click **START** | A or Start |
| Back to the title | Esc | Back |

Controllers show up once you press a button. The game pauses itself when you switch tabs or the page goes to the background.

If your system asks for reduced motion, the screen doesn't shake or flash, the glows keep one colour, and the landscape and enemies stop bouncing to the beat.

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
  beat.ts            the beat clock everything keeps time to, locked to the audio clock
  terrain.ts         each movement's floor and ceiling, and the reachability check
  script.ts          each movement's waves, one token per bar
  entities/          the Echo, enemies, bosses, pickups, shots, beams and enemy notes
  glyphs.ts          the weapon and pickup icons
  effects.ts         sparks, rings, score popups, shake and flash
  synth.ts           oscillator and noise voices, the limiter and the sound switch
  music.ts           each movement's tune, scheduled ahead on the audio clock
  sfx.ts             every sound effect, in key with the music
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
tools/*-test.mjs     headless Chrome checks
```

## Credits

- **Sprites:** from the CC0 [Angais/pixel-art-atlas-1.4m](https://huggingface.co/datasets/Angais/pixel-art-atlas-1.4m) collection of AI-generated pixel art, found with [Pixel Search](https://huggingface.co/spaces/cfahlgren1/pixel-search).
- **Fonts:** [Monoton](https://fonts.google.com/specimen/Monoton) by Vernon Adams and [Doto](https://fonts.google.com/specimen/Doto) by the Doto Project Authors (both SIL Open Font License).
- **Engine:** [Phaser](https://phaser.io/).
- **Inspiration:** Irem's *R-Type*. Overtone is an original game and isn't affiliated with or endorsed by the original's rights holders.

## License

The code is released under the [MIT License](LICENSE). The sprites in `assets/sprites/` and `design/` are CC0 (public domain), and the fonts in `assets/fonts/` are under the SIL Open Font License.
