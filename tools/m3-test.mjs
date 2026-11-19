// Milestone 3: the full roster, pickups, the three weapons at each level, grace notes, CHORD and chevrons.
// Usage: node tools/m3-test.mjs <project-dir> <out-dir>
import { session, sleep } from './cdp.mjs';

const [project = '.', out = 'm3-out'] = process.argv.slice(2);
const t = await session({ project, out, port: 5253, debugPort: 9363, width: 1664, height: 912 });
const { evaluate, until, shot, down, up, check, done } = t;
const S = `__overtone.scene.getScene('stage')`;
const run = (body) => evaluate(`(() => { const s = ${S}; ${body} })()`);
const waitFor = (body, ms = 10000) => until(() => run(body), ms).then(() => true, () => false);

await until(() => evaluate(`!!(window.__overtone && __overtone.scene.isActive('title'))`));
await sleep(600);
await t.tap('Enter');
await until(() => evaluate(`__overtone.scene.isActive('stage') && __overtone.scene.isActive('hud')`));
await sleep(600);
const reset = () => run(`s.clearField(); s.frozen = false; s.noteFire = true; s.echo.attach('front'); s.score = 0; s.mult = 1; s.ships = 3;
  s.grant({ harm: 0, level: 1, weapon: 'spiral', speed: 1, fork: false });
  const wx = s.scrollX + 150; Object.assign(s.craft, { x: 150, y: Math.round((s.terrain.ceilY(wx) + s.terrain.floorY(wx)) / 2), invuln: 999 });`);

// ---- Contact sheet: every enemy and pickup, on the floor, the ceiling and in the air. ----
await reset();
await run(`s.craft.x = 40; s.spawn('eelhead', 430, { y: 120 });`);
await waitFor(`return s.foes[0].x < 330;`);
await run(`s.frozen = true;
  const mid = (x) => { const wx = s.scrollX + x; return Math.round((s.terrain.ceilY(wx) + s.terrain.floorY(wx)) / 2); };
  [['chirp', 70], ['jelly', 100], ['carrier', 130], ['cymbal', 160]].forEach(([k, x]) => s.spawn(k, x, { y: mid(x) - 30 }));
  s.spawn('metronome', 196);
  s.spawn('drummer', 222, { ground: 1 }); s.spawn('drummer', 222, { ground: -1 });
  s.spawn('horn', 252, { ground: 1 }); s.spawn('horn', 252, { ground: -1 });
  [['crystal', 70, 0.2], ['crystal', 95, 1.7], ['crystal', 120, 3.2], ['harmonic', 145, 0], ['speed', 170, 0], ['fork', 195, 0]]
    .forEach(([k, x, tt]) => s.drop(k, x, mid(x) + 22, tt));`);
await sleep(400);
await shot('1-contact-sheet');
check('contact sheet: 9 kinds of enemy part (8 sprites + Eel orbs) and 6 pickups on screen', await run(`return s.foes.length >= 15 && s.pickups.length === 6;`));

// ---- Every enemy fires its own pattern on its beat. ----
async function volley(kind, opts, want) {
  await reset();
  await run(`s.spawn('${kind}', 300, ${JSON.stringify(opts)});`);
  const n0 = await run(`return s.notes.length;`);
  const ok = await waitFor(`return s.notes.length > ${n0};`, 12000);
  const n = (await run(`return s.notes.length;`)) - n0;
  check(`${kind} fires ${want} note${want > 1 ? 's' : ''} at once`, ok && n === want, `${n}`);
}
await volley('drummer', { ground: 1 }, 1);
await volley('jelly', { y: 110 }, 6);
await volley('metronome', {}, 2);
await volley('horn', { ground: -1 }, 5);
await reset();
const hop = await (async () => {
  await run(`s.spawn('metronome', 340);`);
  await waitFor(`return s.foes[0].onGround;`);
  const y0 = await run(`return s.foes[0].y;`);
  await waitFor(`return s.foes[0].y < ${y0} - 4;`, 8000);
  return run(`return { beat: s.beat.beat, hopped: s.foes[0].y < ${y0} - 4 };`);
})();
check('a Strider hops on the beat', hop.hopped, JSON.stringify(hop));

// ---- Arrivals: a chevron a beat ahead, at the height the enemy arrives. ----
await reset();
await run(`s.pattern('courier');`);
const ch0 = await run(`return { warns: s.warns.length, foes: s.foes.length, y: s.warns[0]?.y };`);
await waitFor(`return s.foes.length === 1;`, 5000);
const ch1 = await run(`return { warns: s.warns.length, y0: s.foes[0].y0, kind: s.foes[0].kind };`);
check('an arrival shows a chevron first, then arrives a beat later at that height', ch0.warns === 1 && ch0.foes === 0 && ch1.warns === 0 && ch1.y0 === ch0.y && ch1.kind === 'carrier', JSON.stringify({ ch0, ch1 }));
await reset();
await run(`s.pattern('saws');`);
await waitFor(`return s.foes.length === 2;`, 5000);
await sleep(300);
const saws = await run(`return s.foes.map((e) => ({ vx: Math.round(e.vx), spin: e.spin > 0, toward: Math.sign(e.vy) === Math.sign(s.craft.y - e.y0) || Math.abs(s.craft.y - e.y0) < 2 }));`);
check('Saws fly in fast toward your height, spinning', saws.length === 2 && saws.every((x) => x.vx === -185 && x.spin && x.toward), JSON.stringify(saws));

// ---- The Eel's body goes with its head; a Courier drops a pickup. ----
await reset();
await run(`s.spawn('eelhead', 300, { y: 120 });`);
await sleep(300);
const eel = await run(`const n = s.foes.length; const h = s.foes.find((e) => e.kind === 'eelhead'); s.damage(h, 99); return { n, score: s.score };`);
await sleep(200);
check('an Eel is a head and 7 segments; killing the head takes the body (500 + 7 x 50)', eel.n === 8 && eel.score === 850 && (await run(`return s.foes.length;`)) === 0, JSON.stringify(eel));
await reset();
const drop = await run(`s.frozen = true; const e = s.spawn('carrier', 300, { y: 100 }); s.damage(e, 99); return s.pickups.map((p) => p.kind);`);
check('a Courier drops a pickup when destroyed', drop.length === 1 && drop[0] === 'crystal', JSON.stringify(drop));

// ---- CHORD: a whole Flutter formation shot down pays 1,000 x Harmony and +1 Harmony; with an escapee it doesn't. ----
await reset();
await run(`s.pattern('flutters');`);
await waitFor(`return s.foes.length === 5;`, 5000);
const chord = await run(`s.frozen = true; for (const e of [...s.foes]) s.damage(e, 99); return { score: s.score, mult: s.mult };`);
check('CHORD: five Flutters shot down pay 5 x 100 + 1,000 and Harmony x2', chord.score === 1500 && chord.mult === 2, JSON.stringify(chord));
await reset();
await run(`s.pattern('flutters');`);
await waitFor(`return s.foes.length === 5;`, 5000);
await run(`s.foes[0].x = -30;`);
await sleep(300);
const broken = await run(`s.frozen = true; for (const e of [...s.foes]) s.damage(e, 99); return { score: s.score, mult: s.mult, left: s.foes.length };`);
check('  no CHORD if one got away', broken.score === 400 && broken.mult === 1, JSON.stringify(broken));

// ---- Crystals: the weapon shown when caught; the same weapon levels up. ----
await reset();
const crystals = [];
for (const [tt, want] of [[0.3, 'spiral 2'], [1.8, 'prism 2'], [3.3, 'sonar 2'], [3.4, 'sonar 3'], [4.7, 'spiral 3']]) {
  await run(`s.drop('crystal', s.craft.x, s.craft.y, ${tt});`);
  await waitFor(`return s.pickups.length === 0;`, 3000);
  crystals.push({ want, got: await run(`return s.craft.weapon + ' ' + s.craft.level;`) });
}
check('a crystal gives the weapon it shows (spiral, prism, sonar in turn) and the same one levels up', crystals.every((x) => x.want === x.got), JSON.stringify(crystals));
await reset();
for (let i = 0; i < 3; i++) {
  await run(`s.drop('harmonic', s.craft.x, s.craft.y); s.drop('speed', s.craft.x, s.craft.y);`);
  await waitFor(`return s.pickups.length === 0;`, 3000);
}
const ups = await run(`return { harm: s.craft.harm, speed: s.craft.speed };`);
check('Harmonics stop at 2 and speed at 3', ups.harm === 2 && ups.speed === 3, JSON.stringify(ups));
await down('ArrowUp');
await sleep(250);
const vy = await run(`return s.craft.vy;`);
await up('ArrowUp');
check('  speed 3 flies at 152 px/s', Math.abs(vy + 152) < 0.5, `${vy}`);
await reset();
await run(`s.drop('fork', s.craft.x, s.craft.y);`);
await waitFor(`return s.craft.fork;`, 3000);
await run(`s.spawn('carrier', 330, { y: 60 });`);
await down('z');
const grace = await waitFor(`return s.shots.some((x) => x.kind === 'grace');`, 3000);
await sleep(500);
const homing = await run(`const g = s.shots.filter((x) => x.kind === 'grace'); return g.map((x) => Math.round(x.vy));`);
await up('z');
check('the tuning fork gives grace notes that home in', grace && homing.length > 0, JSON.stringify(homing));

// ---- Each weapon at each level kills a test target with the Echo's fire alone. ----
async function weaponKills(weapon, level) {
  await reset();
  await run(`s.noteFire = false; s.grant({ weapon: '${weapon}', level: ${level} }); s.frozen = true; s.spawn('carrier', s.craft.x + 110, { y: s.craft.y });`);
  const counts = await run(`s.shots = []; s.fireWeapon(1); const n = s.shots.length; s.shots = []; return n;`);
  await down('z');
  const killed = await waitFor(`return s.foes.length === 0;`, 8000);
  await up('z');
  return { killed, counts };
}
const per = { spiral: [2, 2, 2], prism: [1, 3, 5], sonar: [1, 1, 1] };
for (const w of ['spiral', 'prism', 'sonar']) {
  for (const L of [1, 2, 3]) {
    const r = await weaponKills(w, L);
    check(`${w.toUpperCase()} level ${L} kills a target (${per[w][L - 1]} shot${per[w][L - 1] > 1 ? 's' : ''} a volley)`, r.killed && r.counts === per[w][L - 1], JSON.stringify(r));
  }
}
const levels = await run(`const out = {}; for (const L of [1, 2, 3]) { s.grant({ weapon: 'spiral', level: L }); s.shots = []; s.fireWeapon(1); out['spiral' + L] = s.shots[0].amp;
  s.grant({ weapon: 'sonar', level: L }); s.shots = []; s.fireWeapon(1); out['sonar' + L] = s.shots[0].rmax; } s.shots = []; return out;`);
check('  SPIRAL widens (7, 10, 13 px) and SONAR grows (16, 22, 28 px) with level', JSON.stringify(levels) === JSON.stringify({ spiral1: 7, sonar1: 16, spiral2: 10, sonar2: 22, spiral3: 13, sonar3: 28 }), JSON.stringify(levels));
await shot('2-weapons');

// ---- PRISM bounces off the floor; SONAR hits through terrain (and SPIRAL can't). ----
await reset();
await run(`let f = Infinity; for (const dx of [-6, 0, 6]) f = Math.min(f, s.terrain.floorY(s.scrollX + s.craft.x + dx)); s.craft.y = f - 12;
  s.grant({ weapon: 'prism', level: 3 }); s.noteFire = false; s.shots = []; s.fireWeapon(1);`);
const bounced = await waitFor(`return s.shots.some((x) => x.kind === 'prism' && x.bounces === 1 && x.vy < 0);`, 3000);
await shot('3-prism');
check('PRISM bounces off the floor', bounced);
// A spot where the floor under the target is no more than 6 px below the floor under the craft, so a level-3 arc
// (full grown, 28 px each way, 130 px out) reaches a target 10 px into the floor while a level-3 helix (13 px) can't.
const spot = await run(`
  for (let x = 60; x < 270; x += 2) {
    const w = s.scrollX + x; let f = Infinity; for (const dx of [-6, 0, 6]) f = Math.min(f, s.terrain.floorY(w + dx));
    const ft = s.terrain.floorY(w + 130);
    if (ft >= f && ft - f <= 6) return { x, floor: f, target: ft };
  }
  return null;`);
async function buried(weapon) {
  await reset();
  await run(`s.noteFire = false; s.frozen = true; s.grant({ weapon: '${weapon}', level: 3 });
    Object.assign(s.craft, { x: ${spot.x}, y: ${spot.floor} - 12 }); s.spawn('carrier', ${spot.x} + 130, { y: ${spot.target} + 10 });
    s.foes[0].hp = 3;`);
  await down('z');
  const killed = await waitFor(`return s.foes.length === 0;`, 4000);
  await up('z');
  return killed;
}
if (spot) {
  check('SONAR hits a target buried in the floor', await buried('sonar'), JSON.stringify(spot));
  check('  and SPIRAL can\'t reach it', !(await buried('spiral')));
} else check('found a flat stretch of floor for the buried-target test', false);

// ---- HUD: the weapon glyph follows the weapon. ----
await reset();
await run(`s.grant({ weapon: 'sonar', level: 2, harm: 1 });`);
const hud = await until(() => evaluate(`(() => { const h = __overtone.registry.get('hud'); return h.weapon === 'sonar' && h.level === 2 && h.harm === 1 ? h : null; })()`), 3000).then(() => true, () => false);
check('the HUD shows the weapon, its level and the Harmonics', hud);

// ---- A busy run with the loop script, for the record. ----
await reset();
await run(`s.scripted = true; s.grant({ harm: 2, level: 2, weapon: 'prism', fork: true });`);
await down('z');
await sleep(5000);
await shot('4-busy');
await up('z');
done();
