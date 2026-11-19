# Overtone: build plan

A side-scrolling shooter set in a cosmos that plays music, re-imagined from Irem's *R-Type* (1987). Everything keeps time, the landscape plays along, and a living orb of sound (the Echo) rides on its nose. Concept, rules, roster and sprite picks: `design/concept-sheet.html`.

## Scope

**v1**
- **Three movements,** each about 2½ minutes of auto-scrolling terrain and an authored spawn script, then a boss:
  - I Pulse: 128 BPM, an open nebula with a gentle floor and ceiling.
  - II Strings: 140 BPM, a cave whose floor and ceiling are vibrating strings.
  - III Crescendo: 152 BPM, the whole ensemble at once.

  After III, the loop starts again at +12 BPM with faster enemy notes.
- **The craft:** direct 8-way movement and three speeds. Hold FIRE for a steady stream. Hold CHARGE instead (no gunfire while charging) to fill three tiers, one per beat held (so a charge is always counted in beats, at any tempo), then release for a piercing beam. A release at tier 2 or higher inside the beat window (±0.09 s) is RESONANT: 1.5× width and damage, double points, and +1 Harmony per kill.
- **The Echo:** can't be destroyed and attaches to whichever end touches it.
  - Attached, it blocks enemy notes, hurts what it touches and fires the crystal weapon (backwards from the tail).
  - ECHO launches it to hover ahead (it follows your height slowly and repeats your shots); pressed again, it recalls.
- **Weapons from crystals:**
  - SPIRAL: a double helix (beads pass in front of and behind the craft).
  - PRISM: 1/3/5 beams that bounce twice off terrain.
  - SONAR: expanding arcs that pass through terrain.

  Each runs from level 1 to 3. A crystal cycles its weapon every 1.5 s and repeating the same weapon levels it up.
- **Harmonics** (up to 2) sit above and below the craft, block notes and fire with you. **Grace notes** (tuning fork): two homing notes a second while firing. **Speed** (star): up to 3.
- **Roster:** Flutter (100, formations of five; a full formation is a CHORD worth 1,000 and +1 Harmony), Jelly (150), Sentry (200), Strider (150), Saw (120), Snapper (400, 8 hits), Eel (50 per segment, 500 for the head), Courier (300, drops a pickup). Code slot names stay `chirp`, `jelly`, `drummer`, `metronome`, `cymbal`, `horn`, `eel`, `carrier`.
- **Bosses:**
  - I The Halo: a turning ring of Sentries round a core.
  - II Great Eel: a serpent winding through the strings.
  - III The Conductor: a core with orbiting instruments, each firing its own pattern.

  Each core opens on the first beat of every bar and can only be hurt while open.
- **Everything on the beat:** enemies move and fire on beats. Anything about to fire shows a white flash for the half-beat before, and arrivals show an edge chevron one beat ahead.
- **Hits cost power, not lives:** a hit takes a Harmonic first, then a weapon level, then knocks the Echo loose (it drifts until touched). Hit with none of those left and you lose a ship, respawn on the spot and blink for 2 s. Terrain is a hit and bounces you off. A hit resets Harmony to ×1.
- **Ships and score:** 3 ships, +1 every 50,000. Harmony ×1–×8 multiplies all points.
- **Game over:** CONTINUE from the start of the current movement with the score reset, or RETRY from Movement I. HI records only runs that started at Movement I and never continued.
- **Arcade essentials:** pause, high score (`overtone-hi`), attract mode.
- **Sound:** procedural music in a minor pentatonic scale (kick, hat, bass, pad per movement). Player shots are pitched by height and kills play chord tones.
- **Effects:** psychedelic but readable. Sparks that pass in front of and behind sprites, tilted rings, beat pulses, hue cycling per bar on the glows only (the landscape palette is fixed per movement). Honours `prefers-reduced-motion`.
- **Controls:** keyboard + mouse, controller and touch. Deployed to GitHub Pages.

**Later**
- More movements and bosses, a practice mode (pick a movement), an online or local score table, a colour-blind tuning pass on hue cycling (information never depends on hue, but the user should confirm it reads), an optional auto-fire toggle for keyboard and controller.

**Dropped from the original:** checkpoint restarts, one-hit deaths, terrain deaths, mashing for rapid fire, and every name, enemy design and stage layout.


## Architecture

Vite 8 + Phaser 4 + TypeScript, at the versions the other games use and current on 2026-11-17: `phaser ^4.2.1`, `vite ^8.3.8`, `typescript ^7.0.2`, and Node `^20.19.0 || >=22.12.0` (Vite's `engines`). `assets/` is Vite's public dir. Internal resolution 416×228, rendered at 4×.

**World model: auto-scroll (Mars Patrol).** The camera never moves. The scene keeps `scrollX` (design px, 44 px/s in Movement I) and every object keeps screen coordinates. Terrain-bound objects slide left at the scroll speed and read their height from the terrain functions. Movement and collision are a few lines of maths: circles with radii a little smaller than the art, and no arcade physics.

**Terrain:** each movement has a `ceilY(wx)` and `floorY(wx)` (original shapes, not R-Type layouts). The drawn edge and the collision edge are the same function, so what you see is what hits you. Movement I's frame has one smooth shape above and below. The Equalizer style steps it into 6 px columns of 3 px cells, and `ceilY`/`floorY` step with it. A reachability check (below) proves every gap and spawn is passable at speeds 1–3.

**Landscape: seven layers, drawn in code as pixel art** (the concept sheet's "Landscape only" view). The static art (sky, city) is baked once per movement at 1 px per game pixel. Each frame, `Landscape` draws every layer into one 418×228 canvas texture with the 2D canvas API (as the mockup does) at whole-pixel scroll, and nudges the image by the leftover fraction so it still scrolls smoothly on the 4× canvas. Sprites and effects are Phaser objects on top.

| Depth | Layer | How | On the beat |
|---|---|---|---|
| 0.00 | Sky | Baked: 8-band Bayer-dithered gradient, stars | A few stars twinkle in turn |
| 0.02 | Speaker moon | Pixel discs per frame | Inner rings push out with the kick |
| 0.12 | Spectrum range | Analyser bars, 6 px columns | Bars bounce; peaks hold, then fall |
| 0.30 | Instrument city | Baked 1024 px tiling strip (organ ranks, harps, tuning forks, metronomes, speaker stacks, scroll spires) plus a list of light positions | Lights chase through the bar |
| 0.50 | The score | Five-line stave, notes from a hash | The note on the current beat lights |
| 0.70 | Motes | 34 points rising | Brighter on the beat |
| 1.00 | The frame (solid) | One of three styles (below), the edge always the brightest pixels behind the action | A light pulse runs along both edges each beat |

**Frame: Equalizer** (the user's pick from the sheet's three styles; Neon grid and Circuit stay in the concept sheet only). LED cells in 6 px columns, like the spectrum range up close. On each beat every column lights 3–9 cells in from the edge, then they fall back to 3.

Readability rules: the landscape stays dim and cool; anything that can hurt you is bright, outlined and on top. Movements II and III reuse the same layer code with their own bake functions and palettes (II: a cave strung with vibrating strings; III: everything at once). Under reduced motion the bounces, flows, sweeps and kick rings stop; lights still change, without the pulse.

**The beat clock:** `beat.ts` owns `beat`, `frac` and `onBeatWindow()`. With audio running, it follows the AudioContext clock, and `music.ts` schedules notes ahead on that clock, so the visuals never drift from the music. Without audio (muted before first unlock, attract mode, `noAudio`) it runs on scene time. Spawns, enemy fire, warnings and boss phases are all keyed to beat numbers, never to seconds.

**Sprites are flat.** No stacking or voxel models (the user turned the 3D look down on 2026-11-18). Each sprite is its 16×16 pick drawn at 1× with whole-pixel scales only:
- The craft is a top-down, nose-up pick rotated to face right. While it climbs or dives its height squashes to 0.75 (a bank), so pixels stay square.
- Ceiling-mounted enemies are flipped vertically; Flutters flap (width 0.75/1); Saws spin in quarter turns.
- The Echo and the Harmonics draw at **half size (8 px)**, at the user's request. Harmonics are speakers mirrored so the cone faces forward, with a soft glow behind them, kicking back 1 px with each note they fire, 11 px above and below the craft. The attached Echo sits 9 px ahead of or behind it.
- The hit and warning flash is a `TintModes.FILL` white. The Eel's segments are drawn orbs.

**Type:** Monoton for the title and Doto (900) for every in-game word and number, both from Google Fonts (SIL OFL), self-hosted in `assets/fonts/` with their licences. `main.ts` loads them with `FontFace` (relative URLs, so they work under the Pages subpath) before the game starts, so Phaser text never falls back. Doto's dots are round, so text is rasterised at its camera's zoom (`text.ts`), never scaled up from a small bitmap. No game here uses either: the others all use Silkscreen.

| Module | Source | What |
|---|---|---|
| `config.ts` | new | Every tunable: BPM per movement, scroll speed, craft speeds, charge tiers, beat window, weapon rates and damage, points, HP, Harmony cap, extra-ship score, landscape scroll factors. |
| `beat.ts` | new | Beat clock (audio-locked or scene time), `onBeatWindow`, beat events. |
| `music.ts`, `sfx.ts` | new + copied | Lookahead sequencer per movement (from the mockup's band); sfx copied from Sentinel with new voices: shot (pitched by height), kill chord, charge rise, beam, resonant chime, Echo launch and recall, pickup, hit, boss. Own mute key `overtone-muted`. |
| `terrain.ts` | new | Per-movement `ceilY`/`floorY` and the reachability query. Pure, no Phaser. |
| `land/bake.ts` | new (from the mockup) | `pixLayer`, Bayer dither, the palette, and per-movement bakes: sky and city strip (+ light list). |
| `land/Landscape.ts` | new | The seven layers in order, parallax factors, the per-frame beat details and the Equalizer frame, drawn into one canvas texture. |
| `text.ts` | new | Doto/Monoton text rasterised at its camera's zoom. |
| `script.ts` | new | Per-movement spawn script: `[beat, pattern, args]` rows. Patterns are pure functions that create entities. Loop modifiers (BPM, note speed, fire cadence) as functions of the loop number, like Sentinel's `waves.ts`. |
| `entities/*.ts` | new | Craft, Echo, Harmonics, shots (note, helix, prism, sonar, grace, beam), enemy notes, each enemy, each boss, pickups. |
| `effects.ts` | adapted from SE | Sparks draw before or after sprites; rings get a tilt; shake in game pixels; flash; beat pulses. Bloom off. |
| `controls.ts`, `touch.ts` | adapted from SE | Stick + buttons (SE). Verbs: move (analogue), fire (hold), charge (hold/release), echo (edge), pause, mute. Touch: auto-fire, CHARGE and ECHO buttons, II in the top bar. |
| `hi.ts`, `attract.ts`, `view.ts` | copied | Key `overtone-hi`; `attract.ts` unchanged; `view.ts` unchanged. |
| `scenes/TitleScene.ts` | new | Title in Monoton over the Movement I landscape, controls for the current device, HI, start. Waits for the fonts. |
| `scenes/StageScene.ts` | new | The game: beat, scroll, script, entities, collisions, scoring, respawn, game over, continue, pause, attract pilot. HUD state goes to the registry. |
| `scenes/HudScene.ts` | adapted | Top bar (as the mockup), hint strip, pause panel, game-over panel (CONTINUE / RETRY / TITLE), drawn at 2×. |

**Sprites:** 16×16 from the concept sheet picks (`chosen` in `tools/sprite_slots.json`), drawn flat at 1×. The same images serve as HUD icons (the craft at half size, rotated nose-right).

## Milestones

Each one ends playable, tested, committed, pushed and live. Definition of done for every milestone:
- its test and all earlier ones pass;
- screenshots looked at;
- BUILD-PLAN Status and README updated (README describes the game only);
- Part C1 checks;
- commit as leeeeeroyj, push, deploy succeeds.

1. **Skeleton + publishing.** Vite + Phaser project, fonts, title scene, `StageScene` with the full Movement I landscape scrolling and the craft flying and banking, test harness `tools/cdp.mjs`, deploy workflow (actions bumped to current majors). Repo, Pages, MIT licence, README, repo settings (Part C2–C5). First push.
   *Verify:* `npm run build`. `m1-test`: the page loads with no errors; the craft moves in all 8 directions; it squashes while climbing or diving and not while level; the drawn frame edges match `floorY`/`ceilY` column by column in all three styles; screenshot of the title, of play and of the landscape alone. Deploy is green and the Pages URL loads.
2. **First playable.** Beat clock with a bare kick and hat; FIRE, CHARGE (three tiers, beam, resonant window) and the Echo (attach front and back, launch, hover, recall, block, contact damage); Sentries on floor and ceiling with the half-beat flash; terrain hits and bounce; the power ladder on hits; score and Harmony.
   *Verify:* `m2-test` with dev hooks (`spawn(kind, x, y)`, `clearField()`, `setBeatPhase()`):
   - a release at tier 2 on the beat is resonant and outside the window is not;
   - a Sentry flashes in the half-beat before it fires;
   - the Echo blocks a note aimed at the craft;
   - the hit ladder runs Harmonic → level → Echo loose → ship;
   - touching the floor bounces you off and counts as a hit.
3. **Full roster.** All eight enemies, crystals (cycling, levelling), Harmonics, grace notes, speed, SPIRAL/PRISM/SONAR at levels 1–3, CHORD bonus, edge chevrons.
   *Verify:* `m3-test` spawns each kind and screenshots it. Each weapon kills a test target at each level; PRISM bounces off the floor; SONAR hits through terrain; a crystal picked in each phase gives that weapon. Contact sheet of every sprite on floor, ceiling and in the air, looked at.
4. **Structure.** Movements I–III with their terrain and spawn scripts, the loop modifiers, lives, extra ships, game over with CONTINUE / RETRY, **pause and the high score**.
   *Verify:* `m4-test` skips to each movement and loop (BPM and note speed match the table). Reachability: a search over each movement's terrain and spawns with the scene's own collision rules at speeds 1 and 3 finds a path. `pause-hi-test.mjs` covers P, Start, visibility, resume, TITLE, and a high score saved, kept and shown. A continued run doesn't save HI.
5. **Bosses.** the Halo (a ring of Sentries), the Great Eel, the Conductor, with the core opening on the first beat of each bar, warnings before every attack, and a boss bar on the HUD.
   *Verify:* `m5-test` reaches each boss via a hook. The core takes damage only while open; each attack's warning comes at least half a beat before harm; the boss dies to a scripted pilot inside 90 s. Screenshots mid-fight.
6. **HUD, music and feedback.** Full music per movement locked to the beat clock, all sfx, the layered sparks, tilted rings, the landscape's beat details, beat pulses, hue cycling, flashes, reduced-motion handling.
   *Verify:* screenshots mid-burst (the craft and every enemy note stay visible). Frame time in headless Chrome over a busy 30 s. Audio-clock lock: beat events stay within 10 ms of scheduled kicks over 2 minutes. Reduced motion has no shake, flash or hue swing.
7. **Touch and mobile.** Stick in the left bar, CHARGE and ECHO in the right, auto-fire, II and sound tap targets, landscape lock, touch hints.
   *Verify:* CDP touch at 844×390 and 932×430: fly, charge-release, launch and recall the Echo, pause and resume. Then a real phone (needs the user).
8. **Attract mode.** `?attract` with the mockup's autopilot as the pilot: it grabs pickups and loose Echoes, lines up, dodges, and does a resonant release every 8 beats. Seeds pick the movement and loop.
   *Verify:* `tools/attract-test.mjs` passes, plus a probe over a few minutes of demos (deaths, standing still, time to first kill). Arcadia entry (`"attract": true`, `"hiKey": "overtone-hi"`) and a recorded loop.
9. **Polish.** Balance from the user's play, the hero screenshot, final README.

## Testing

Headless Chrome over CDP via the shared `tools/cdp.mjs`, with real key, mouse and touch events, driven from `tools/mN-test.mjs`. Dev builds expose `window.__overtone` (behind `import.meta.env.DEV`) with hooks:
- spawn a kind at a point, clear the field, skip to a movement, loop or boss;
- set the beat phase, grant power or points.

Pure modules (`beat.ts`, `script.ts`, `terrain.ts`, `land/bake.ts`) are tested by importing them straight from the dev server. Look at screenshots at key moments. Headless rendering runs on the CPU. Overtone runs at about 14 fps there (about 30 with the landscape frozen: the per-frame 2D-canvas drawing is the cost under SwiftShader, while its JavaScript takes about 2 ms), so timing checks use scene time (`beat.time`), not wall time, and hold keys until a condition is met. The concept sheet, which draws the same layers on a canvas 16 times larger, ran smoothly in a real browser. If the real-phone test (milestone 7) is slow, the fixes are known: bake the two haze gradients and the stave, cache colour strings, or move the frame cells to a Phaser Blitter. Real phone before touch is called done.

## Decisions

- **2026-11-17 Setting: synesthesia,** chosen by the user over a prism dreamscape and a living nebula.
- **2026-11-17 Name: OVERTONE.**
  - No game found under the name.
  - Unity's OVERTONE mark (US 88044759, chat software) has been dead since 2026-04-17.
  - Nearby but different: *Oxytone* (Steam) and *Harmony Overture*, a music bullet-hell.
  - The repo is `leeeeeroyj/overtone` and Pages is `https://leeeeeroyj.github.io/overtone/`.
- **2026-11-17 Hits cost power, not lives,** chosen by the user (Gradius-style ladder, respawn on the spot, terrain bounces).
- **2026-11-17 Separate FIRE and CHARGE.** Charging stops your gun, which is the risk/reward. Touch fires automatically.
- **2026-11-17 Harmonics sit above and below the craft** rather than orbiting across it. An orbit hid the craft in the mockup.
- **2026-11-18 No sprite stacking or 3D models.** The user didn't like the look. Sprites are flat; depth comes from the layered landscape, sparks and helix beads passing in front of and behind sprites, and tilted rings. (This replaces the 2026-11-17 choice of a full 3D look and the voxel-frame plan.)
- **2026-11-18 A richer landscape,** asked for by the user: eight beat-reactive layers in Movement I (the table above) in place of the waveform terrain.
- **2026-11-18 Type: Monoton (title) and Doto (in game),** chosen by the user, because Silkscreen made it look like Space Raider and Sentinel. The concept sheet's body text is Sora.
- **2026-11-18 No piano keys or organ pipes.** The user liked the spectrum and neon look but not the keys and pipes. The frame becomes a neon structure in one of three styles (Equalizer, Neon grid, Circuit) for the user to pick from the sheet. The foreground reeds are dropped: inside the frame's mass they couldn't be seen.
- **2026-11-18 Harmonics are speakers that fire music notes** (pixel quavers on every half-beat, wavering as they fly), at the user's request; their example was loudspeaker #733568.
- **2026-11-18 The ensemble is not instruments.** The setting stays musical (the beat, notes, the city of instruments in the background), but enemies are neon creatures and machines: Flutter (moths), Jelly, Sentry (turret), Strider (mech walker), Saw (spinning blades), Snapper (plant), Eel and Courier (saucer). Behaviours and code slot names are unchanged.
- **2026-11-18 Music mood: keep the dark minor pentatonic** for Movement I, as in the mockup; later movements are open.
- **2026-11-18 Continue resets the score to 0,** and only unbroken runs set HI. Confirmed by the user.
- **2026-11-18 Sprite picks and frame from the user:** craft 440106, Echo 415794, Harmonic 733568 (mirrored), Flutter 736509, Jelly 659976, Sentry 699876, Snapper 197837, Strider 767502, Eel 397397, Saw 1057811, Courier 474241, core 424178, crystal 314992, star 1097009, fork 1316672; frame **Equalizer**. Stored as `chosen` in `tools/sprite_slots.json`.
- **2026-11-18 Faster pace,** because the user found it a little slow: Movement I goes from 112 to 128 BPM (II 140, III 152), scroll from 30 to 44 px/s, a new wave every bar instead of every two, the craft at 108 px/s base (was 92), enemy notes at 84 px/s (was 72), and enemy travel about 30% faster. Charge tiers are now counted in beats so the resonant timing still fits the faster tempo.
- **2026-11-18 Echo and Harmonics at half size (8 px),** at the user's request when approving the build.
- **2026-11-18 Plan approved; build started.** The user said "Build it." Per the playbook, each milestone is shown before it's committed, and the repo isn't created until the user OKs the first push.
- **2026-11-18 Commit and push after each milestone without asking,** at the user's word ("go ahead and keep working, committing after each milestone"), once its tests pass and the C1 checks are clean. The empty public repo `leeeeeroyj/overtone` already existed (created earlier that day), so C2 set its description, homepage and Pages instead of creating it.
- **2026-11-18 Losing a ship takes the power-ups,** at the user's word ("lose power ups when you die"): speed goes back to 1 and the grace notes go, on top of the Harmonics and weapon levels the ladder has already taken. The weapon type stays. (This replaces the earlier choice to keep speed and grace notes.)
- **2026-11-18 A CHORD needs all five of a formation shot down;** if one leaves the screen alive the formation is broken and pays nothing (the mockup paid out when the last one died, however the others went).
- **2026-11-18 The Harmonic pickup is drawn like the companion,** at half size with its glow, to match the user's half-size request; the glyph above it keeps it easy to spot.
- **2026-11-18 Sound is synthesised live with oscillators** (`synth.ts`) on Phaser's audio context, through its mute node, as in the mockup, instead of Sentinel's pre-rendered sfxr buffers: the band has to be scheduled on the audio clock anyway, and the shot and kill sounds are pitched per event. `music.ts` schedules each beat 0.12 s ahead at the moment the beat clock will reach it; the full audio-clock lock is still milestone 6's.
- **2026-11-18 Movement looks.** II Strings is a teal cave: no moon, spectrum or stave; stalagmites, outcrops, crystal clusters and string posts for a skyline, and seven strings across the sky, one ringing hard on each beat in turn. III Crescendo is a red-gold dusk with the moon, the spectrum, the stave, the city and four strings. Each movement has its own palette (`THEMES` in `land/bake.ts`); the Equalizer frame keeps its style.
- **2026-11-18 Authored scripts, one token per bar,** 80 bars a movement plus a 4-bar outro (about 2.6, 2.4 and 2.2 minutes). Nothing is random: Snapper sides and Flutter heights are written into the script. Pickups come only from Couriers, so each movement has a Courier every few bars.
- **2026-11-18 ENCORE:** after III, I again at +12 BPM per loop with enemy notes 15% faster. Scroll speed stays the same so the terrain stays passable. Score, ships, Harmony and power carry from movement to movement and into an ENCORE.
- **2026-11-18 Game-over panel ignores input for 1.2 s,** so fire held at the moment of death doesn't pick an option. Esc or Back picks TITLE. The selected button is filled and the rest are outlined.
- **2026-11-18 Leaving a run for the title (Esc, or TITLE from pause) still saves its score as HI** if the run is eligible. The page going to the background pauses, and the game stays paused when it comes back.
- **2026-11-18 The reachability check holds the craft at its start x** (stricter than the real game, where it can also move sideways). It treats Sentries and Snappers as walls and leaves out things that fly, since those move and can be shot.
- **2026-11-18 Boss parts are ordinary enemies owned by the boss.** The boss moves and fires them, so shots, beams, the Echo and contact work on them unchanged. The Halo's Sentries and the Conductor's instruments take twice their usual hits and pay their usual points. The Great Eel's body is armoured: shots glance off it.
- **2026-11-18 The core is open for the first two beats of each bar** and fires on the second. Hit points are 80, 100 and 120, plus a quarter per ENCORE. The first test showed the bob was fastest exactly while the core was open, which made it hard to hit for anyone, not just the test pilot. Now the Halo and the Conductor sit at the end of their swing while open, and the Great Eel slows to about a third of its speed.
- **2026-11-18 Boss warnings start a tenth of the way into the beat before an attack,** longer than ordinary enemies' half-beat. (They started a quarter in until milestone 6: once the beat followed the audio clock, a slow frame could skip enough of a beat to leave less than half a beat of warning.)
- **2026-11-18 The boss arrives after the script's 4-bar outro,** announced like any arrival (a chevron, then MOVEMENT n · FINALE and its name). The terrain keeps scrolling. CONTINUE still restarts the movement from its first bar.
- **2026-11-18 A different mood for each movement,** at the user's word ("Each can have a different mood"). I Pulse stays dark and driving (A aeolian, i–i–VI–VII, four on the floor, a tresillo bass). II Strings is mysterious and hypnotic (D dorian, two bars a chord, half-time drums, plucked strings rolling in sixteenths, a bowed line). III Crescendo is triumphant (E major, I–V–vi–IV, claps, sixteenth hats, an octave bass, a fanfare). Parts come in over the first 32 bars, drop out for a 4-bar break at bar 48, and all play for the boss.
- **2026-11-18 The beat clock follows the audio clock** whenever the audio context runs (muted or not), and the world moves exactly as far as the beat did each frame, in steps of at most 1/30 s. A frame that skips more than half a beat (a pause, a hidden tab, a hitch) re-anchors instead. Without audio it runs on frame time as before. Following the audio clock while the world kept capped frame time made the world fall behind the music below 20 fps, which would also have put pinned enemies in the wrong places.
- **2026-11-18 Sound effects play in the movement's key, on the band's current chord.** Kills, pickups, extra ships and CHORDs land on the next sixteenth of the music (at most an eighth of a second late at 128 BPM); shots, hits and the Echo sound at once, since you react to them.
- **2026-11-18 The boss's core is heard as well as seen:** a bell as it opens, a clank as it shuts.
- **2026-11-18 Sparks and rings draw under the craft, the Echo and enemy notes** (still over enemies and pickups), so a burst never hides the craft or anything that can hurt you. Enemy notes get a halo on each beat (not under reduced motion), and enemies stop hopping on the beat under reduced motion.
- **2026-11-18 Key presses are kept until the next frame reads them.** Phaser forgets a press once the key is up again, so a tap shorter than a frame was lost (the cause of the occasional test timeouts, and a real risk on a slow device). Menus step on a latched `nav` input for the same reason.
- **2026-11-17 Information never depends on hue** (the user is colour blind). Enemy notes are white-cored diamonds; player shots are dashes, beads, triangles of lines and arcs. Pickups carry glyphs; the beat lamp is filled vs outlined, with a taller downbeat; the charge ring counts segments and goes solid to say "now".

## Open questions

- **Craft sprite.** All eight craft candidates are drawn from above, nose up, and turned to face right. If that reads wrong, the slot can be re-searched for side-view ships.
- **Boss balance.** A test pilot with starting power kills the bosses in about 17, 33 and 38 seconds. The user's play decides whether that's right.

## Status (2026-11-18: milestone 6 built and verified)

- **Done:** Part A (concept sheet v0.3 and this plan, approved by the user). Live at https://leeeeeroyj.github.io/overtone/, every deploy green.
  - **Milestone 1** `3b83749`: title, scrolling landscape, Equalizer frame and flight. Repo settings per C3 and C5 applied and verified.
  - **Milestone 2** `1e3d5cd`: fire, charge on the beat, the Echo, Harmonics, Sentries, the hit ladder, effects and the HUD.
  - **Milestone 3** `d2d0739`: all eight enemies, pickups, PRISM, SONAR, the CHORD and edge chevrons.
  - **Milestone 4** `760348b`: three movements, scripts, ENCOREs, pause, game over and the high score.
  - **Milestone 5** `2e58bd4`: the Halo, the Great Eel and the Conductor, with the open core, warnings and the boss bar.
  - **Milestone 6:**
    - `beat.ts` follows the audio clock and re-anchors on jumps; `StageScene` moves the world by the beat's advance in steps of at most 1/30 s.
    - `synth.ts`: a shared limiter, attack, filter sweeps and vibrato on voices, filtered noise for drums and rumbles; times are absolute on the audio clock.
    - `music.ts`: a tune per movement (I dark, II hypnotic, III triumphant), arranged by bar, with a boss arrangement, a bell as the core opens and a clank as it shuts.
    - `sfx.ts`: every sound in key on the current chord. New: pickup, Echo launch, recall, loose and catch, the resonant bell, extra ship, CHORD, boss arrival, glancing shots, boss defeat, MOVEMENT COMPLETE, game over, pause and resume, menu step and select. Kills and pickups land on the next sixteenth.
    - Losing a ship takes speed and grace notes too.
    - Sparks and rings under the craft, the Echo and enemy notes; a beat halo on enemy notes; no hops under reduced motion.
    - Controls keep key presses until the next frame; menus step on `nav`.
- **Verified (milestone 6):** `npx tsc` clean.
  - `m6-test` 25/25:
    - The audio clock runs headless and the beat follows it. Over 121 s of Movement I, every beat event lands on the kick scheduled for it (243 of 259 beats had kicks, the rest are the break; worst error 0.00 ms, no re-anchors). While locked this is exact by construction, so the check is really that nothing drifts or re-anchors in two minutes.
    - Each movement has its own key and mood, and its band plays.
    - Each sound is wired to its event: kill, pickup, Echo out, back, catch and loose, hit, ship lost, pause and resume, boss arrival, glance, boss defeat, COMPLETE (and the band stops).
    - A kill's chord lands exactly on a sixteenth, at most a sixteenth late.
    - The core's bell sounds on every opening beat.
    - Losing a ship resets speed, grace notes and level, and puts the Echo back.
    - A busy 30 s in Movement III (spawns every 4 s, everything firing): the game's update p50 3.6 ms, p95 6.8 ms; the whole frame p50 7.5 ms, p95 13.8 ms on CPU rendering, about 11 fps headless.
    - Layer order: sparks over enemies, under the craft, the Echo and the notes.
    - Reduced motion (reloaded with `prefers-reduced-motion: reduce`): a hit and a kill don't shake or flash the screen, the glows keep one hue over 12 s, enemies don't hop.
  - Mix levels, metered at the master over 8–10 s each in all three movements (intro, full band, boss): peaks 0.79 to 0.95, RMS 0.08 to 0.09, so no clipping and an even level.
  - Still passing: `m1-test` 27/27, `m2-test` 23/23, `m3-test` 31/31, `m4-test` 37/37, `m5-test` 23/23 (kills in 17.3, 32.9 and 38.4 s; shortest warnings 0.77, 0.62 and 0.68 beats), `pause-hi-test` 22/22.
  - Screenshots looked at: three mid-burst frames in Movement III with the screen full of notes (the craft, its speakers and every note stay on top), and reduced motion.
- **Next:** milestone 7: touch and mobile. It needs the user's phone at the end.
