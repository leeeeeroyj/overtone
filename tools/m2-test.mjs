// Milestone 2: fire, charge and the resonant window, the Echo, Sentries, the hit ladder, score and Harmony.
// Usage: node tools/m2-test.mjs <project-dir> <out-dir>
import { session, sleep } from './cdp.mjs';

const [project = '.', out = 'm2-out'] = process.argv.slice(2);
const t = await session({ project, out, port: 5252, debugPort: 9362, width: 1664, height: 912 });
const { evaluate, until, shot, down, up, tap, check, done } = t;
const S = `__overtone.scene.getScene('stage')`;
const run = (body) => evaluate(`(() => { const s = ${S}; ${body} })()`);

await until(() => evaluate(`!!(window.__overtone && __overtone.scene.isActive('title'))`));
await sleep(600);
await tap('Enter');
await until(() => evaluate(`__overtone.scene.isActive('stage') && __overtone.scene.isActive('hud')`));
await sleep(600);
await run(`s.clearField();`);
// The craft in the middle of the gap, at x, unhurt and able to be hit.
const centre = (x = 160) => run(`const wx = s.scrollX + ${x}; Object.assign(s.craft, { x: ${x}, y: Math.round((s.terrain.ceilY(wx) + s.terrain.floorY(wx)) / 2), invuln: 0 });`);

// ---- FIRE: notes from the craft and, with the Echo on the nose, the SPIRAL helix. ----
await centre();
await down('z');
await sleep(500);
const fired = await run(`return { notes: s.shots.filter((x) => x.kind === 'note').length, helix: s.shots.filter((x) => x.kind === 'helix').length };`);
await up('z');
check('FIRE streams notes and the Echo fires its helix', fired.notes > 0 && fired.helix > 0, JSON.stringify(fired));
await sleep(300);

// ---- CHARGE: tiers per beat held; a release at tier 2+ inside the beat window is resonant, outside it isn't. ----
// The window is +-0.09 s (0.19 of a beat at 128 BPM). Phases are set with slack for the frames between here and the release.
async function chargeAndRelease(minTier, phase) {
  await run(`s.beams = []; s.lastRelease = undefined;`);
  await down('x');
  await until(() => run(`return s.tier() >= ${minTier};`), 20000);
  if (minTier < 3) await until(() => run(`return s.tier() === ${minTier};`), 2000);
  await run(`s.setBeatPhase(${phase});`);
  await up('x');
  await until(() => run(`return !!s.lastRelease;`), 5000);
  return run(`return { ...s.lastRelease, beams: s.beams.length, w: s.beams[0]?.w, frac: s.beat.frac };`);
}
const on = await chargeAndRelease(2, 0.85);
check('a tier-2 release on the beat is RESONANT, 1.5x wide', on.tier === 2 && on.resonant && on.beams === 1 && on.w === 15, JSON.stringify(on));
await shot('1-resonant-beam');
await sleep(400);
const off = await chargeAndRelease(2, 0.35);
check('a tier-2 release off the beat is not resonant', off.tier === 2 && !off.resonant && off.w === 10, JSON.stringify(off));
await sleep(300);
const low = await chargeAndRelease(1, 0.85);
check('a tier-1 release on the beat is not resonant', low.tier === 1 && !low.resonant && low.w === 6, JSON.stringify(low));
const fireWhileCharging = await (async () => {
  await run(`s.shots = [];`);
  await down('x');
  await down('z');
  await sleep(400);
  const n = await run(`return s.shots.length;`);
  await up('z');
  await up('x');
  return n;
})();
check('charging holds your fire', fireWhileCharging === 0, `${fireWhileCharging} shots`);
await sleep(300);

// ---- Sentries: aimed notes every 2 beats, flashing white for the half-beat before. ----
await run(`s.clearField(); s.craft.invuln = 999;`);
await centre();
await run(`s.craft.invuln = 999; s.spawn('drummer', 300, { ground: 1, phase: 0 });`);
const samples = [];
const t0 = await run(`return s.beat.time;`);
while ((await run(`return s.beat.time;`)) - t0 < 2.4) {
  samples.push(await run(`const e = s.foes[0]; return { beat: s.beat.beat, frac: s.beat.frac, warn: e.warn, fill: e.img.tintMode === 1, notes: s.notes.length };`));
}
const warns = samples.filter((x) => x.warn);
const badWarn = warns.filter((x) => x.frac <= 0.5 || (x.beat + 1) % 2 !== 0);
const fires = samples.filter((x, i) => i > 0 && x.notes > samples[i - 1].notes);
check('a Sentry warns only in the half-beat before its beat', warns.length > 0 && badWarn.length === 0, `${warns.length} warning samples, ${badWarn.length} misplaced`);
check('  and shows white (fill tint) while warning', warns.some((x) => x.fill));
check('  and fires on its beats (every 2)', fires.length > 0 && fires.every((x) => x.beat % 2 === 0), JSON.stringify(fires.map((x) => x.beat)));
await shot('2-sentry');

// ---- The Echo blocks a note aimed at the craft; on the tail it can't. ----
await run(`s.clearField();`);
await centre();
const b0 = await run(`s.echo.attach('front'); s.addNote(s.craft.x + 80, s.craft.y, -84, 0); return { hits: s.hits, blocked: s.blocked };`);
await until(() => run(`return s.notes.length === 0;`), 10000);
const b1 = await run(`return { hits: s.hits, blocked: s.blocked };`);
check('the Echo on the nose blocks a note aimed at the craft', b1.blocked === b0.blocked + 1 && b1.hits === b0.hits, JSON.stringify(b1));
await centre();
await run(`s.echo.attach('back'); s.addNote(s.craft.x + 80, s.craft.y, -84, 0);`);
await until(() => run(`return s.notes.length === 0;`), 10000);
const b2 = await run(`return { hits: s.hits, blocked: s.blocked };`);
check('  and on the tail it doesn\'t (the note hits)', b2.hits === b1.hits + 1, JSON.stringify(b2));
await run(`s.echo.attach('front'); s.grant({ level: 1 });`);

// ---- The Echo launches, hovers, follows your height, recalls and re-attaches. ----
await centre();
await tap('c');
await until(() => run(`return s.echo.state === 'hover';`), 8000);
const hover = await run(`return { x: s.echo.x, state: s.echo.state };`);
check('ECHO launches it to hover ahead', Math.abs(hover.x - 300) < 12, JSON.stringify(hover));
await run(`s.craft.y += 30;`);
await sleep(600);
const follow = await run(`return { dy: s.craft.y - s.echo.y };`);
check('  it follows your height slowly', follow.dy < 30 && follow.dy > 0, JSON.stringify(follow));
await centre();
await down('z');
await sleep(500);
const repeats = await run(`return s.shots.filter((x) => x.kind === 'note' && x.x > s.echo.x - 2).length;`);
await up('z');
check('  it repeats your shots while away', repeats > 0, `${repeats} notes ahead of it`);
await tap('c');
await until(() => run(`return s.echo.state === 'front' || s.echo.state === 'back';`), 8000);
check('  ECHO again recalls it and it re-attaches', true, await run(`return s.echo.state;`));
// Contact damage: put the Echo on a Sentry.
await run(`s.clearField(); const e = s.spawn('drummer', 250, { ground: 1 }); s.echo.state = 'hover'; s.echo.x = e.x; s.echo.y = e.y; s.craft.invuln = 999;`);
await sleep(300);
const touch = await run(`const e = s.foes[0]; return { hp: e ? e.hp : 0, dead: !e };`);
check('  the Echo hurts what it touches', touch.dead || touch.hp < 3, JSON.stringify(touch));
await run(`s.clearField(); s.echo.attach('front'); s.craft.invuln = 0;`);

// ---- The hit ladder: Harmonic, Harmonic, level, level, Echo loose, then a ship. ----
await centre();
await run(`s.grant({ harm: 2, level: 3, ships: 3 }); s.echo.attach('front');`);
await shot('3-harmonics');
const ladder = [];
for (let i = 0; i < 6; i++) {
  ladder.push(await run(`s.craft.invuln = 0; s.hitCraft(); return [s.craft.harm, s.craft.level, s.echo.state, s.ships].join(' ');`));
}
const want = ['1 3 front 3', '0 3 front 3', '0 2 front 3', '0 1 front 3', '0 1 loose 3', '0 1 front 2'];
check('the hit ladder runs Harmonic, level, Echo loose, ship', JSON.stringify(ladder) === JSON.stringify(want), JSON.stringify(ladder));
check('  a hit resets Harmony to x1', await run(`s.mult = 5; s.craft.invuln = 0; s.hitCraft(); return s.mult === 1;`));
await run(`s.echo.attach('front'); s.ships = 3;`);

// ---- The floor is a hit and bounces you off. ----
await centre();
await run(`s.grant({ harm: 1 });`);
const f0 = await run(`return { frame: s.frameHits, harm: s.craft.harm };`);
await down('ArrowDown');
await until(() => run(`return s.frameHits > ${f0.frame};`), 8000).catch(() => {});
await up('ArrowDown');
const f1 = await run(`let f = Infinity; for (const dx of [-6, 0, 6]) f = Math.min(f, s.terrain.floorY(s.scrollX + s.craft.x + dx)); return { frame: s.frameHits, harm: s.craft.harm, y: s.craft.y, floor: f };`);
check('touching the floor is a hit (costs the Harmonic) and bounces you off', f1.frame === f0.frame + 1 && f1.harm === 0 && f1.y <= f1.floor - 4, JSON.stringify(f1));

// ---- Score and Harmony: a resonant kill raises Harmony and pays double. ----
await run(`s.clearField(); s.score = 0; s.mult = 1;`);
const sc = await run(`
  const a = s.spawn('drummer', 300, { ground: 1 }); s.damage(a, 99, true); const r1 = [s.score, s.mult];
  const b = s.spawn('drummer', 300, { ground: 1 }); s.damage(b, 99); const r2 = [s.score, s.mult];
  return { r1, r2 };`);
check('a resonant kill: Harmony x2 and double points (200 x 2 x 2)', sc.r1[0] === 800 && sc.r1[1] === 2, JSON.stringify(sc));
check('  then a plain kill at x2 pays 400', sc.r2[0] === 1200 && sc.r2[1] === 2, JSON.stringify(sc));
// The HUD state is published at the end of each frame.
const hudOk = await until(() => evaluate(`(() => { const h = __overtone.registry.get('hud'); return h.score === 1200 && h.mult === 2; })()`), 3000).then(() => true, () => false);
check('  the HUD shows the score and Harmony', hudOk);

// ---- Real shots kill a real Sentry. ----
await run(`s.clearField(); s.craft.invuln = 999;`);
const target = await run(`const e = s.spawn('drummer', 330, { ground: 1 }); return { y: e.y };`);
await run(`Object.assign(s.craft, { x: 200, y: ${target.y} - 3 });`);
const before = await run(`return s.score;`);
await down('z');
await until(() => run(`return s.foes.length === 0;`), 10000).catch(() => {});
await shot('4-kill');
await up('z');
const after = await run(`return { score: s.score, left: s.foes.length };`);
check('shots kill a Sentry and score it', after.left === 0 && after.score > before, JSON.stringify(after));

// ---- A busy moment for the record, with the script running. ----
await run(`s.scripted = true; s.craft.invuln = 999; s.grant({ harm: 2, level: 2 });`);
await centre(120);
await down('z');
await sleep(4000);
await shot('5-busy');
await up('z');

console.log(`fps (headless): ${await evaluate(`Math.round(__overtone.loop.actualFps)`)}`);
done();
