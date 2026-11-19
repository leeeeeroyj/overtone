// Milestone 5: the three bosses. Each is reached through a hook; its core takes damage only while open (the first
// two beats of every bar); every attack is warned for at least half a beat before it fires; a scripted pilot with
// starting power kills it inside 90 s of game time; then the movement completes.
// Usage: node tools/m5-test.mjs <project-dir> <out-dir>
import { session, sleep } from './cdp.mjs';

const [project = '.', out = 'm5-out'] = process.argv.slice(2);
const t = await session({ project, out, port: 5258, debugPort: 9368, width: 1664, height: 912 });
const { evaluate, until, shot, tap, down, up, check, done } = t;
const G = '__overtone';
const S = `${G}.scene.getScene('stage')`;
const run = (body) => evaluate(`(() => { const s = ${S}; ${body} })()`);
const hud = () => evaluate(`${G}.registry.get('hud')`);
const waitFor = (body, ms = 10000) => until(() => run(body), ms).then(() => true, () => false);

await until(() => evaluate(`!!(window.${G} && ${G}.scene.isActive('title'))`), 30000);
await sleep(600);
await tap('Enter');
await until(() => evaluate(`${G}.scene.isActive('stage') && ${G}.scene.isActive('hud')`));
await sleep(600);

const NAMES = ['THE HALO', 'GREAT EEL', 'THE CONDUCTOR'];
for (const m of [0, 1, 2]) {
  await run(`window.__oldBeat = s.beat; s.skipTo(${m});`);
  await waitFor(`return s.beat !== window.__oldBeat && s.movement === ${m} && s.beat.time > 0.3;`);
  await run(`s.clearField(); s.craft.invuln = 999; s.startBoss();`);
  const arrived = await waitFor(`return !!s.boss;`, 5000);
  await sleep(200);
  const h = await hud();
  check(`${NAMES[m]}: arrives through the hook, with its name and a full bar on the HUD`, arrived && h.boss?.name === NAMES[m] && h.boss.hp === 1, JSON.stringify(h.boss));
  await waitFor(`return s.boss.entered;`, 8000);

  // The core: no damage while shut, damage while open.
  await waitFor(`return !s.boss.open && s.beat.frac < 0.5;`, 6000);
  const shut = await run(`const c = s.boss.core, hp = c.hp; s.damage(c, 5); return { before: hp, after: c.hp, open: s.boss.open, inBar: ((s.beat.beat % 4) + 4) % 4 };`);
  check(`${NAMES[m]}: the shut core takes no damage (beat ${shut.inBar + 1} of the bar)`, !shut.open && shut.after === shut.before && shut.inBar >= 2, JSON.stringify(shut));
  await waitFor(`return s.boss.open && s.beat.frac < 0.5;`, 6000);
  const open = await run(`const c = s.boss.core, hp = c.hp; s.damage(c, 5); return { before: hp, after: c.hp, open: s.boss.open, inBar: ((s.beat.beat % 4) + 4) % 4 };`);
  check(`${NAMES[m]}: the open core does (beat ${open.inBar + 1} of the bar)`, open.open && open.after === open.before - 5 && open.inBar < 2, JSON.stringify(open));
  await run(`s.boss.core.hp += 5;`);

  // The pilot: hold FIRE at the core's height, from the left of the screen. It can't be hit, so the clock is honest.
  const start = await run(`delete window.__pilot; return s.beat.time;`);
  await down('z');
  let shotTaken = false;
  let result;
  for (;;) {
    result = await run(`
      const b = s.boss; const c = s.craft;
      if (!b || b.dying >= 0) return { dead: true, t: s.beat.time };
      const wx = s.scrollX + 70;
      const lo = s.terrain.ceilY(wx) + 12, hi = s.terrain.floorY(wx) - 12;
      // Lead the core: where it will be when a note fired now arrives, from its speed since the last look.
      const last = window.__pilot ?? { t: s.beat.time, y: b.core.y };
      const vy = s.beat.time > last.t ? (b.core.y - last.y) / (s.beat.time - last.t) : 0;
      window.__pilot = { t: s.beat.time, y: b.core.y };
      const lead = (b.core.x - 79) / 330;
      c.x = 70; c.y = Math.max(lo, Math.min(hi, b.core.y + vy * lead)); c.invuln = 999;
      return { dead: false, t: s.beat.time, hp: b.core.hp };`);
    if (result.dead || result.t - start > 95) break;
    if (!shotTaken && result.t - start > 6) {
      shotTaken = true;
      await shot(`${m + 1}-${NAMES[m].toLowerCase().replace(/ /g, '-')}`);
    }
    await sleep(80);
  }
  await up('z');
  const took = result.t - start;
  check(`${NAMES[m]}: a pilot leading the core and holding FIRE kills it inside 90 s`, result.dead && took < 90, `${took.toFixed(1)} s game time${result.dead ? '' : `, core at ${result.hp?.toFixed(1)}`}`);

  const attacks = await run(`const b = s.boss; return b ? { spb: s.beat.spb, a: b.attacks.map((x) => x.fired - x.warned) } : null;`);
  if (attacks) {
    const short = attacks.a.filter((d) => d < attacks.spb / 2 - 1e-6);
    check(`${NAMES[m]}: every attack (${attacks.a.length}) was warned at least half a beat ahead`, attacks.a.length >= 6 && short.length === 0,
      `min ${(Math.min(...attacks.a) / attacks.spb).toFixed(2)} beats`);
  } else check(`${NAMES[m]}: attack log read before the outro`, false);

  const complete = await waitFor(`return s.ending >= 0;`, 8000);
  check(`${NAMES[m]}: its death completes the movement`, complete && (await evaluate(`${S}.children.list.some((o) => o.text === 'COMPLETE')`)));
  const next = await waitFor(`return s.movement === ${(m + 1) % 3} && s.loop === ${m === 2 ? 1 : 0} && s.beat.time > 0.2;`, 10000);
  check(`${NAMES[m]}: then ${m === 2 ? 'the ENCORE starts at Movement I' : `Movement ${['II', 'III'][m]} starts`}`, next);
}

// An ENCORE boss is tougher.
await run(`s.clearField(); s.startBoss();`);
await waitFor(`return !!s.boss;`, 5000);
check('in an ENCORE the boss has a quarter more hit points', await run(`return s.boss.maxHp === 100;`), String(await run(`return s.boss?.maxHp;`)));
done();
