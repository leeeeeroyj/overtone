// Milestone 6: music, sound and feedback. The beat clock follows the audio clock: over two minutes every beat event
// stays within 10 ms of the kick the band scheduled for it. Each movement has its own tune; every sound effect is
// wired to its event; kills land on the music's sixteenths; the core opening rings a bell. Bursts never cover the
// craft or an enemy note (screenshots mid-burst), frame time over a busy 30 s, and losing a ship takes the power-ups.
// Then, reloaded with prefers-reduced-motion: no shake, no flash, no hue swing, no hops.
// Usage: node tools/m6-test.mjs <project-dir> <out-dir>
import { session, sleep } from './cdp.mjs';

const [project = '.', out = 'm6-out'] = process.argv.slice(2);
const t = await session({ project, out, port: 5260, debugPort: 9370, width: 1664, height: 912 });
const { evaluate, until, shot, tap, down, up, check, done } = t;
const G = '__overtone';
const S = `${G}.scene.getScene('stage')`;
const run = (body) => evaluate(`(() => { const s = ${S}; ${body} })()`);
const waitFor = (body, ms = 10000) => until(() => run(body), ms).then(() => true, () => false);
const start = async () => {
  await until(() => evaluate(`!!(window.${G} && ${G}.scene.isActive('title'))`), 30000);
  await sleep(600);
  await tap('Enter');
  await until(() => evaluate(`${G}.scene.isActive('stage') && ${G}.scene.isActive('hud')`), 30000);
  await waitFor(`return s.beat.time > 0.5;`);
};
/** Skips to a movement and waits for its new scene. */
const skip = async (m, loop = 0) => {
  await run(`window.__oldBeat = s.beat; s.skipTo(${m}, ${loop});`);
  await waitFor(`return s.beat !== window.__oldBeat && s.movement === ${m} && s.beat.time > 0.5;`, 15000);
};

await start();
check('the audio clock runs and the beat clock follows it', await run(`return s.synth.running && s.beat.locked;`),
  JSON.stringify(await run(`return { state: s.synth.ctx?.state, locked: s.beat.locked };`)));

// ---- The audio-clock lock, over two minutes of Movement I. ----
await run(`
  s.craft.invuln = 1e9;
  window.__beats = [];
  const onBeat = s.onBeat.bind(s);
  s.onBeat = (b) => { window.__beats.push({ b, audio: s.synth.now, time: s.beat.time }); onBeat(b); };
  window.__anchors = s.beat.anchors;`);
await waitFor(`s.craft.invuln = 1e9; return s.beat.time > 122;`, 200000);
const lock = await run(`
  const spb = s.beat.spb;
  const kicks = new Map(s.band.kicks.map((k) => [k.b, k.at]));
  const errs = [];
  for (const e of window.__beats) {
    const at = kicks.get(e.b);
    if (at === undefined) continue;
    // Where the beat clock put this beat's start on the audio clock.
    errs.push(Math.abs(e.audio - (e.time - e.b * spb) - at));
  }
  return { beats: window.__beats.length, matched: errs.length, max: Math.max(...errs), reanchors: s.beat.anchors - window.__anchors,
    span: window.__beats.at(-1).time - window.__beats[0].time };`);
check(`over ${lock.span.toFixed(0)} s every beat event is within 10 ms of its scheduled kick`,
  lock.span >= 118 && lock.matched >= lock.beats * 0.85 && lock.max < 0.010,
  `${lock.matched}/${lock.beats} beats with kicks, worst ${(lock.max * 1000).toFixed(2)} ms, ${lock.reanchors} re-anchors`);

// ---- A tune per movement. ----
const tunes = [];
for (const m of [0, 1, 2]) {
  await skip(m);
  await run(`s.craft.invuln = 1e9; s.beat.time = 20 * 4 * s.beat.spb - 0.05;`);
  await waitFor(`return s.band.kicks.length >= 6;`, 15000);
  tunes.push(await run(`return { mood: s.band.tune.mood, scale: s.band.tune.scale.join(), kicks: s.band.kicks.length, bpm: s.beat.bpm };`));
}
check('each movement has its own key and mood', new Set(tunes.map((x) => x.scale)).size === 3 && new Set(tunes.map((x) => x.mood)).size === 3,
  tunes.map((x) => `${x.mood} at ${x.bpm}`).join('; '));
check('and its band plays', tunes.every((x) => x.kicks >= 6));

// ---- Sound effects: each event plays its sound. ----
await skip(0);
await run(`
  s.clearField(); s.craft.invuln = 1e9;
  window.__sfx = [];
  for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(s.sfx))) {
    if (k === 'constructor' || typeof s.sfx[k] !== 'function') continue;
    const f = s.sfx[k].bind(s.sfx);
    s.sfx[k] = (...a) => { window.__sfx.push(k); return f(...a); };
  }
  window.__voices = [];
  const v = s.synth.voice.bind(s.synth);
  s.synth.voice = (type, f0, f1, dur, vol, when, o) => { window.__voices.push({ type, f0, when: when ?? s.synth.now, now: s.synth.now }); return v(type, f0, f1, dur, vol, when, o); };`);
const heard = async (name, body, ms = 3000) => {
  // No body: keep listening from the last event (the Echo comes home on its own after being called back).
  await run(body === null ? '' : `window.__sfx = []; ${body}`);
  return waitFor(`return window.__sfx.includes('${name}');`, ms);
};
const sfxChecks = [
  ['kill', `const e = s.spawn('jelly', 300, { y: 120 }); s.damage(e, 99);`],
  ['pickup', `s.collect(s.drop('speed', s.craft.x, s.craft.y));`],
  ['echoOut', `s.echo.toggle();`],
  ['echoBack', `s.echo.toggle();`],
  ['echoCatch', null],
  ['hit', `s.craft.invuln = 0; s.craft.harm = 1; s.hitCraft(); s.craft.invuln = 1e9;`],
  ['echoLoose', `s.echo.knockLoose();`],
];
for (const [name, body] of sfxChecks) check(`sound: ${name}`, await heard(name, body, name === 'echoCatch' ? 6000 : 3000));
// Kills land on the next sixteenth of the music.
const grid = await run(`
  window.__voices = [];
  const e = s.spawn('jelly', 300, { y: 120 }); s.damage(e, 99);
  const tri = window.__voices.filter((v) => v.type === 'triangle');
  const step = s.beat.spb / 4, zero = s.beat.audioAt(0);
  return tri.map((v) => { const k = (v.when - zero) / step; return { off: Math.abs(k - Math.round(k)) * step, wait: v.when - v.now }; });`);
check('a kill\'s chord lands on a sixteenth of the music, at most a sixteenth late',
  grid.length === 3 && grid.every((g) => g.off < 0.001 && g.wait <= 60 / 128 / 4 + 0.001),
  JSON.stringify(grid.map((g) => `${(g.off * 1000).toFixed(2)} ms off, ${(g.wait * 1000).toFixed(0)} ms wait`)));
check('sound: pause and resume', await (async () => {
  await run(`window.__sfx = [];`);
  await tap('p');
  await sleep(200);
  await tap('p');
  await sleep(200);
  return run(`return window.__sfx.filter((k) => k === 'pause').length === 2;`);
})());

// Losing a ship takes the power-ups with it.
const lost = await run(`
  const c = s.craft;
  Object.assign(c, { invuln: 0, harm: 0, level: 3, speed: 3, fork: true, weapon: 'prism' });
  s.echo.knockLoose();
  const ships = s.ships;
  s.hitCraft();
  return { ships: s.ships - ships, speed: c.speed, fork: c.fork, level: c.level, harm: c.harm, echo: s.echo.state };`);
check('losing a ship resets speed, grace notes and level, and puts the Echo back', lost.ships === -1 && lost.speed === 1 && !lost.fork && lost.level === 1 && lost.echo === 'front', JSON.stringify(lost));
check('sound: shipLost', await run(`return window.__sfx.includes('shipLost');`));

// ---- The boss: arrival, glancing shots, the bell as the core opens, the defeat, COMPLETE. ----
await run(`s.clearField(); s.craft.invuln = 1e9; window.__sfx = []; s.startBoss();`);
await waitFor(`return !!s.boss && s.boss.entered;`, 12000);
check('sound: bossArrive', await run(`return window.__sfx.includes('bossArrive');`));
await waitFor(`return !s.boss.open;`, 6000);
check('sound: glance (a shot on the shut core)', await (async () => {
  await run(`window.__sfx = []; s.damage(s.boss.core, 1);`);
  return run(`return window.__sfx.includes('glance');`);
})());
await run(`window.__voices = []; window.__from = s.beat.beat;`);
await waitFor(`return s.beat.beat >= window.__from + 9;`, 15000);
const bells = await run(`
  const b = s.boss, out = [];
  for (let n = window.__from + 1; n <= s.beat.beat; n++) {
    if (!b.opensOn(n) || b.opensOn(n - 1)) continue;
    const at = s.beat.audioAt(n);
    out.push(window.__voices.some((v) => v.type === 'sine' && v.f0 > 700 && Math.abs(v.when - at) < 0.001));
  }
  return out;`);
check('the core opening rings a bell on its beat, every bar', bells.length >= 2 && bells.every(Boolean), JSON.stringify(bells));
await run(`window.__sfx = []; s.kill(s.boss.core, false);`);
check('sound: bossDefeat', await run(`return window.__sfx.includes('bossDefeat');`));
check('sound: complete, and the band stops', await waitFor(`return window.__sfx.includes('complete') && s.band.quiet;`, 8000));

// ---- A busy 30 s in Movement III: the Conductor, a full screen, everything firing. Frame time and bursts. ----
await skip(2);
await run(`
  s.craft.invuln = 1e9;
  Object.assign(s.craft, { weapon: 'spiral', level: 3, harm: 2, fork: true });
  s.beat.time = 56 * 4 * s.beat.spb - 0.05;
  window.__ft = { up: [], all: [] };
  const ev = ${G}.events;
  let a = 0, u = 0;
  ev.on('prestep', () => { a = performance.now(); });
  ev.on('poststep', () => { u = performance.now() - a; });
  ev.on('postrender', () => { if (a) { window.__ft.up.push(u); window.__ft.all.push(performance.now() - a); } });`);
await down('z');
const t0 = await run(`return s.beat.time;`);
let shots = 0;
let spawned = 0;
for (;;) {
  const now = await run(`s.craft.invuln = 1e9; return s.beat.time;`);
  if (now - t0 > 30) break;
  // Keep it busy: a ring of Jellies and a Snapper every few seconds.
  if ((now - t0) / 4 > spawned) {
    spawned++;
    await run(`for (let i = 0; i < 4; i++) s.spawn('jelly', 250 + i * 30, { y: 50 + i * 40 }); s.spawn('horn', 380, { ground: 1 });`);
  }
  // Mid-burst: blow up a cluster right by the craft, then capture it.
  if (shots < 3 && now - t0 > 6 + shots * 8) {
    await run(`
      const c = s.craft;
      for (let i = 0; i < 5; i++) { const e = s.spawn('jelly', c.x + 10 + i * 8, { y: c.y - 12 + i * 6 }); s.damage(e, 99); }
      for (let i = 0; i < 6; i++) s.addNote(c.x + 30 + i * 6, c.y - 15 + i * 6, -10, 0);`);
    await sleep(120);
    await shot(`${shots + 1}-mid-burst`);
    shots++;
  }
  await sleep(150);
}
await up('z');
const ft = await run(`
  const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length * p)]; };
  const f = window.__ft;
  return { frames: f.all.length, upP50: q(f.up, 0.5), upP95: q(f.up, 0.95), allP50: q(f.all, 0.5), allP95: q(f.all, 0.95),
    notes: s.notes.length, foes: s.foes.length, fps: ${G}.loop.actualFps };`);
check('frame time over a busy 30 s: the game\'s update stays under 8 ms (p95)', ft.frames > 100 && ft.upP95 < 8,
  `${ft.frames} frames; update p50 ${ft.upP50.toFixed(1)} / p95 ${ft.upP95.toFixed(1)} ms; whole frame p50 ${ft.allP50.toFixed(1)} / p95 ${ft.allP95.toFixed(1)} ms (CPU rendering); ${ft.fps.toFixed(0)} fps`);
const layers = await run(`return { fx: s.gFx.depth, craft: s.ship.depth, echo: s.echo.img.depth, notes: s.gFront.depth, foes: 8 };`);
check('sparks and rings draw over the enemies but under the craft, the Echo and every enemy note',
  layers.fx > layers.foes && layers.fx < layers.craft && layers.fx < layers.echo && layers.fx < layers.notes, JSON.stringify(layers));

// ---- Reduced motion. ----
await t.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await t.send('Page.reload');
await sleep(1000);
await start();
const reduced = await run(`
  s.clearField(); s.craft.invuln = 0; s.craft.harm = 1;
  s.hitCraft();
  const e = s.spawn('jelly', 300, { y: 120 }); s.damage(e, 99);
  s.fx.update(0.01);
  window.__hue = s.land.hue;
  window.__air = s.spawn('jelly', 400, { y: 100 });
  return { offset: s.fx.offset, flash: s.fx.flashRect.alpha };`);
check('reduced motion: a hit and a kill don\'t shake the screen or flash it', reduced.offset.x === 0 && reduced.offset.y === 0 && reduced.flash === 0, JSON.stringify(reduced));
await waitFor(`return s.beat.time > 12;`, 30000);
const still = await run(`const e = window.__air; return { hue: s.land.hue, start: window.__hue, hop: e.dead ? 0 : Math.round(e.y) - e.img.y };`);
check('reduced motion: the glows keep one hue (no swing each bar) and enemies don\'t hop on the beat', still.hue === still.start && still.hop === 0, JSON.stringify(still));
await shot('4-reduced');
done();
