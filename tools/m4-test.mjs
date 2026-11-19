// Milestone 4: the three movements and their loops (BPM and note speed), reachability over each movement's terrain
// and pinned enemies, the drawn edges of II and III, the scripts, movement transitions, and the game-over panel's
// CONTINUE, RETRY and TITLE.
// Usage: node tools/m4-test.mjs <project-dir> <out-dir>
import { session, sleep } from './cdp.mjs';

const [project = '.', out = 'm4-out'] = process.argv.slice(2);
const t = await session({ project, out, port: 5254, debugPort: 9364, width: 1664, height: 912 });
const { evaluate, until, shot, tap, check, done } = t;
const G = '__overtone';
const S = `${G}.scene.getScene('stage')`;
const run = (body) => evaluate(`(() => { const s = ${S}; ${body} })()`);
const hud = () => evaluate(`${G}.registry.get('hud')`);
const waitFor = (body, ms = 10000) => until(() => run(body), ms).then(() => true, () => false);

await until(() => evaluate(`!!(window.${G} && ${G}.scene.isActive('title'))`));
await evaluate(`localStorage.clear()`);
await sleep(600);
await tap('Enter');
await until(() => evaluate(`${G}.scene.isActive('stage') && ${G}.scene.isActive('hud')`));
await sleep(600);

/** Starts a fresh run at a movement and loop, and waits for it to be playing. */
async function skipTo(m, loop = 0) {
  // The scene restarts in place, so wait for a new beat clock rather than for the movement to match.
  await run(`window.__oldBeat = s.beat; s.skipTo(${m}, ${loop});`);
  return waitFor(`return s.beat !== window.__oldBeat && s.movement === ${m} && s.loop === ${loop} && s.beat.time > 0.2 && !s.over;`, 8000);
}

// ---- Tempo and note speed for every movement, in the first loop and an ENCORE. ----
const TABLE = [
  { name: 'PULSE', numeral: 'I', bpm: 128 },
  { name: 'STRINGS', numeral: 'II', bpm: 140 },
  { name: 'CRESCENDO', numeral: 'III', bpm: 152 },
];
for (const loop of [0, 1, 2]) {
  for (const [m, row] of TABLE.entries()) {
    const ok = await skipTo(m, loop);
    await run(`s.clearField(); s.craft.invuln = 999; s.spawn('drummer', 300, { ground: 1 });`);
    // Read the note's speed on the frame it appears (the Echo or Harmonics may block it soon after).
    const fired = await waitFor(`const n = s.notes[0]; if (n) window.__noteSpeed = Math.hypot(n.vx, n.vy); return !!n;`, 8000);
    const r = await run(`return { bpm: s.beat.bpm, speed: window.__noteSpeed ?? 0 };`);
    await evaluate(`delete window.__noteSpeed`);
    const h = await hud();
    const bpm = row.bpm + 12 * loop;
    const speed = 84 * (1 + 0.15 * loop);
    const encore = loop === 0 ? '' : loop === 1 ? '  ·  ENCORE' : `  ·  ENCORE ${loop}`;
    check(
      `${row.numeral} ${row.name}, loop ${loop}: ${bpm} BPM, Sentry notes at ${speed.toFixed(1)} px/s, HUD "${row.numeral}${encore}"`,
      ok && fired && r.bpm === bpm && Math.abs(r.speed - speed) < 0.01 && h.movement === row.name && h.numeral === `${row.numeral}${encore}`,
      `${JSON.stringify(r)} ${h.numeral}`,
    );
  }
}

// ---- Reachability: a search with the craft's own collision rules over the whole movement, terrain and pinned enemies. ----
const negative = await evaluate(`(async () => {
  const T = await import('/src/terrain.ts');
  const wall = Array.from({ length: 60 }, (_, i) => ({ wx: 1200, y: 16 + i * 4, reach: 9 }));
  const o = { scroll: 44, speed: 108, x: 90, minY: 22, maxY: 222, probes: [-6, 0, 6], edgeReach: 4, length: 3000 };
  return { wall: T.blockedAt(T.TERRAINS[0], { ...o, obstacles: wall }), open: T.blockedAt(T.TERRAINS[0], { ...o, obstacles: [] }) };
})()`);
check('the search finds a wall of obstacles (and nothing without one)', negative.wall > 1150 && negative.wall < 1250 && negative.open === -1, JSON.stringify(negative));
for (const m of [0, 1, 2]) {
  for (const loop of [0, 1]) {
    const r = await run(`return [1, 3].map((sp) => s.reach(${m}, ${loop}, sp));`);
    check(`Movement ${TABLE[m].numeral}, loop ${loop}: a path through at speeds 1 and 3`, r.every((x) => x === -1), JSON.stringify(r));
  }
}
const pins = await evaluate(`(async () => {
  const S = await import('/src/script.ts');
  return [0, 1, 2].map((m) => ({ bars: S.scriptBars(m), waves: S.waves(m).length, kinds: [...new Set(S.waves(m).map((w) => w.pattern))].length }));
})()`);
check('each script runs 80 bars and uses all eight wave kinds', pins.every((p) => p.bars === 80 && p.kinds === 8), JSON.stringify(pins));

// ---- II and III: drawn edges are the collision edges, and the landscapes. ----
for (const m of [1, 2]) {
  await skipTo(m);
  await run(`s.clearField(); s.craft.invuln = 999;`);
  await sleep(2500);
  await shot(`${m + 1}-movement-${TABLE[m].numeral}`);
  const edges = await evaluate(`(async () => {
    const s = ${S}; const T = await import('/src/terrain.ts'); const B = await import('/src/land/bake.ts');
    const d = s.land.texture.context.getImageData(0, 0, 418, 228).data, wx0 = s.land.wx0;
    const hex = B.THEMES[${m}].mass; const M = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const px = (x, y) => { const o = (y * 418 + x) * 4; return [d[o], d[o + 1], d[o + 2]]; };
    const mass = (p) => p[0] === M[0] && p[1] === M[1] && p[2] === M[2];
    const bright = (p) => p[0] + p[1] + p[2] > 600;
    let cols = 0; const bad = [];
    for (let x = 0; x < 416; x += 5) {
      const wx = wx0 + x; if (((wx % 6) + 6) % 6 === 5) continue;
      const fy = s.terrain.floorY(wx), cy = s.terrain.ceilY(wx);
      const ok = bright(px(x, fy)) && mass(px(x, fy + 2)) && !mass(px(x, fy - 2)) && bright(px(x, cy - 1)) && !mass(px(x, cy + 1))
        && fy === T.TERRAINS[${m}].floorY(wx) && cy === T.TERRAINS[${m}].ceilY(wx);
      cols++; if (!ok) bad.push(x);
    }
    return { cols, bad };
  })()`);
  check(`Movement ${TABLE[m].numeral}: drawn frame edges match its floorY/ceilY`, edges.bad.length === 0 && edges.cols > 60, `${edges.cols} columns, mismatched at ${JSON.stringify(edges.bad.slice(0, 8))}`);
  await run(`s.landOnly = true;`);
  await evaluate(`${G}.scene.getScene('hud').cameras.main.setVisible(false)`);
  await sleep(300);
  await shot(`${m + 1}-landscape-${TABLE[m].numeral}`);
  await evaluate(`${G}.scene.getScene('hud').cameras.main.setVisible(true)`);
  await run(`s.landOnly = false;`);
}

// ---- The script plays: Movement II's second bar brings Jellies on its own. ----
await skipTo(1);
const jellies = await waitFor(`return s.foes.some((e) => e.kind === 'jelly');`, 12000);
check('the script sends the first wave (II opens with Jellies)', jellies);

// ---- Transitions: the end of the script completes the movement; score, ships and power carry over. ----
await skipTo(0);
await run(`s.clearField(); s.scripted = true; s.score = 4321; s.ships = 2; s.mult = 3;
  s.grant({ weapon: 'prism', level: 2, harm: 1, speed: 2, fork: true });
  s.beat.time = 84 * 4 * s.beat.spb - 0.15;`);
const boss = await waitFor(`return !!s.boss;`, 6000);
check('the end of the script (80 bars and the outro) brings the boss', boss && (await run(`return s.boss.name === 'THE HALO';`)));
// Kill it at once (milestone 5's test fights it properly).
await run(`s.craft.invuln = 999; s.kill(s.boss.core, false);`);
const done1 = await waitFor(`return s.ending >= 0;`, 6000);
await shot('4-complete');
check('its death completes Movement I', done1 && (await evaluate(`${G}.scene.getScene('stage').children.list.some((o) => o.text === 'COMPLETE')`)));
const next = await waitFor(`return s.movement === 1 && s.beat.time > 0.2;`, 8000);
const carried = await run(`const c = s.craft; return { score: s.score - 5000 * 3 - 8 * 200 * 3, ships: s.ships, mult: s.mult, weapon: c.weapon, level: c.level, harm: c.harm, speed: c.speed, fork: c.fork, loop: s.loop, eligible: s.eligible };`);
check('then Movement II starts, with score, ships, Harmony and power carried', next && carried.score === 4321 && carried.ships === 2 && carried.mult === 3
  && carried.weapon === 'prism' && carried.level === 2 && carried.harm === 1 && carried.speed === 2 && carried.fork && carried.loop === 0, JSON.stringify(carried));
check('a run that passed through from Movement I can still set the high score', carried.eligible === true);
await skipTo(2);
await run(`s.clearField(); s.finish();`);
const encore = await waitFor(`return s.movement === 0 && s.loop === 1 && s.beat.time > 0.2;`, 8000);
await shot('5-encore');
check('after III, the ensemble plays again from I as an ENCORE (+12 BPM)', encore && (await run(`return s.beat.bpm === 140;`)));

// ---- Game over: the panel, CONTINUE, RETRY and TITLE. ----
await skipTo(1);
await run(`s.clearField(); s.score = 9999; s.grant({ weapon: 'sonar', level: 3, speed: 3 }); s.lose();`);
await waitFor(`return s.over;`, 3000);
await sleep(150);
let h = await hud();
check('losing the last ship shows the panel with CONTINUE selected', h.over && h.choice === 0 && !h.ready);
await tap('Enter');
await sleep(200);
check('the panel ignores a choice for a moment (a held button doesn\'t pick)', await run(`return s.over && s.movement === 1;`));
await waitFor(`return s.gameOver >= 1.2;`, 4000);
await shot('6-game-over');
await tap('ArrowRight');
await sleep(150);
check('right moves the selection to RETRY', (await hud()).choice === 1);
await tap('ArrowLeft');
await sleep(150);
check('left moves it back to CONTINUE', (await hud()).choice === 0);
await tap('Enter');
const cont = await waitFor(`return !s.over && s.movement === 1 && s.beat.time > 0.2;`, 8000);
const c = await run(`const c = s.craft; return { score: s.score, ships: s.ships, weapon: c.weapon, level: c.level, speed: c.speed, eligible: s.eligible };`);
check('CONTINUE: the same movement again, score 0, fresh ships and power, no high score', cont && c.score === 0 && c.ships === 3 && c.weapon === 'spiral' && c.level === 1 && c.speed === 1 && c.eligible === false, JSON.stringify(c));
await run(`s.clearField(); s.score = 500; s.lose();`);
await waitFor(`return s.gameOver >= 1.2;`, 5000);
check('a continued run doesn\'t save the high score', (await evaluate(`localStorage.getItem('overtone-hi')`)) === null);
h = await hud();
check('and the panel says so', h.over && !h.eligible && !h.newHi);
await tap('ArrowRight');
await sleep(150);
await tap('Enter');
const retry = await waitFor(`return !s.over && s.movement === 0 && s.loop === 0 && s.beat.time > 0.2;`, 8000);
check('RETRY: Movement I, loop 0, and the run can set the high score again', retry && (await run(`return s.eligible && s.score === 0;`)));
await run(`s.clearField(); s.score = 2500; s.lose();`);
await waitFor(`return s.gameOver >= 1.2;`, 5000);
check('game over on an unbroken run saves the high score', (await evaluate(`localStorage.getItem('overtone-hi')`)) === '2500' && (await hud()).newHi);
await tap('ArrowLeft');
await sleep(150);
check('left from CONTINUE wraps to TITLE', (await hud()).choice === 2);
await tap('Enter');
const title = await until(() => evaluate(`${G}.scene.isActive('title') && !${G}.scene.isActive('stage') && !${G}.scene.isActive('hud')`), 5000).then(() => true, () => false);
check('TITLE goes back to the title', title);

done();
