// Milestone 1: the title, then the craft flying over the scrolling Movement I landscape.
// Usage: node tools/m1-test.mjs <project-dir> <out-dir>
import { session, sleep } from './cdp.mjs';

const [project = '.', out = 'm1-out'] = process.argv.slice(2);
const t = await session({ project, out, port: 5241, debugPort: 9351, width: 1664, height: 912 });
const { evaluate, until, shot, down, up, tap, check, done } = t;
const stage = `__overtone.scene.getScene('stage')`;

await until(() => evaluate(`!!(window.__overtone && __overtone.scene.isActive('title'))`));
await sleep(1200);
await shot('1-title');
check('title scene runs', true);
check('Doto and Monoton loaded', await evaluate(`document.fonts.check('900 8px Doto') && document.fonts.check('16px Monoton')`));

await tap('Enter');
await until(() => evaluate(`__overtone.scene.isActive('stage') && __overtone.scene.isActive('hud')`));
await sleep(800);
// Milestone 1 tests flight and the landscape alone: no enemies.
await evaluate(`${stage}.clearField()`);
const state = () => evaluate(`(() => { const s = ${stage}; return { ...s.craft, scrollX: s.scrollX, hits: s.frameHits, beat: s.beat.beat, time: s.beat.time }; })()`);
const s0 = await state();
check('stage and HUD start, craft at its start', Math.abs(s0.x - 90) < 1 && s0.scrollX > 0, JSON.stringify(s0));
await shot('2-play');

// The world scrolls and the beat advances.
await sleep(1500);
const s1 = await state();
// Headless Chrome runs slowly, so rates are measured against the scene's own clock.
const rate = (s1.scrollX - s0.scrollX) / (s1.time - s0.time);
check('world scrolls at 44 px/s of game time', Math.abs(rate - 44) < 0.5, `${rate.toFixed(2)} px/s`);
check('beat clock runs at 128 BPM', s1.beat === Math.floor(s1.time / (60 / 128)), `beat ${s1.beat} at ${s1.time.toFixed(2)} s`);

// Eight directions from the middle of the gap. Each push moves the craft that way; climbs and dives squash it.
const centre = `(() => { const s = ${stage}; const wx = s.scrollX + 200; const y = (s.terrain.ceilY(wx) + s.terrain.floorY(wx)) / 2; Object.assign(s.craft, { x: 200, y, invuln: 0 }); })()`;
const DIRS = [['ArrowRight'], ['ArrowLeft'], ['ArrowUp'], ['ArrowDown'], ['ArrowUp', 'ArrowRight'], ['ArrowUp', 'ArrowLeft'], ['ArrowDown', 'ArrowRight'], ['ArrowDown', 'ArrowLeft']];
for (const keys of DIRS) {
  await evaluate(centre);
  await sleep(100);
  const a = await state();
  for (const k of keys) await down(k);
  await sleep(120);
  const mid = await state();
  await sleep(200);
  for (const k of keys) await up(k);
  const b = await state();
  const ex = keys.includes('ArrowRight') ? 1 : keys.includes('ArrowLeft') ? -1 : 0;
  const ey = keys.includes('ArrowDown') ? 1 : keys.includes('ArrowUp') ? -1 : 0;
  const dx = b.x - a.x, dy = b.y - a.y;
  // Speed while held: 108 px/s, shared between the axes on a diagonal.
  const v = { x: mid.vx, y: mid.vy }, axis = ex && ey ? 108 / Math.SQRT2 : 108;
  const ok = (ex ? Math.sign(dx) === ex && Math.abs(v.x - ex * axis) < 0.5 : Math.abs(dx) < 0.01 && v.x === 0)
    && (ey ? Math.sign(dy) === ey && Math.abs(v.y - ey * axis) < 0.5 : Math.abs(dy) < 0.01 && v.y === 0);
  check(`flies ${keys.join('+')}`, ok, `moved ${dx.toFixed(1)}, ${dy.toFixed(1)}; velocity ${v.x.toFixed(1)}, ${v.y.toFixed(1)}`);
  const climbing = ey !== 0;
  check(`  ${climbing ? 'squashes while climbing or diving' : 'stays full height while level'}`, climbing ? mid.bank === 0.75 : mid.bank === 1, `bank ${mid.bank}`);
}
await sleep(200);
check('back to full height when the stick is released', (await state()).bank === 1);

// The drawn edges are the collision edges, column by column.
await sleep(200);
const edges = await evaluate(`(async () => {
  const s = ${stage}; const T = await import('/src/terrain.ts');
  const d = s.land.texture.context.getImageData(0, 0, 418, 228).data, wx0 = s.land.wx0;
  const px = (x, y) => { const o = (y * 418 + x) * 4; return [d[o], d[o + 1], d[o + 2]]; };
  const mass = (p) => p[0] === 10 && p[1] === 5 && p[2] === 24;
  const bright = (p) => p[0] + p[1] + p[2] > 600;
  let cols = 0; const bad = [];
  for (let x = 0; x < 416; x += 5) {
    const wx = wx0 + x; if (((wx % 6) + 6) % 6 === 5) continue;
    const fy = s.terrain.floorY(wx), cy = s.terrain.ceilY(wx);
    const ok = bright(px(x, fy)) && mass(px(x, fy + 2)) && !mass(px(x, fy - 2)) && bright(px(x, cy - 1)) && !mass(px(x, cy + 1))
      && fy === T.MOVEMENT_I.floorY(wx) && cy === T.MOVEMENT_I.ceilY(wx);
    cols++; if (!ok) bad.push(x);
  }
  return { cols, bad };
})()`);
check('drawn frame edges match floorY/ceilY', edges.bad.length === 0 && edges.cols > 60, `${edges.cols} columns, mismatched at ${JSON.stringify(edges.bad.slice(0, 8))}`);

// Diving into the floor counts a hit and bounces the craft back above the edge.
await evaluate(centre);
const h0 = (await state()).hits;
await down('ArrowDown');
await until(async () => (await state()).hits > h0, 8000).catch(() => {});
await sleep(100);
await up('ArrowDown');
const sf = await state();
const fy = await evaluate(`(() => { const s = ${stage}; let f = Infinity; for (const dx of [-6, 0, 6]) f = Math.min(f, s.terrain.floorY(s.scrollX + s.craft.x + dx)); return f; })()`);
check('the floor is a hit and bounces the craft', sf.hits > h0 && sf.y <= fy - 4, `hits ${sf.hits - h0}, y ${sf.y.toFixed(1)}, floor ${fy}`);
await evaluate(centre);
await evaluate(`${stage}.craft.invuln = 0`);
await down('ArrowUp');
await until(async () => (await state()).hits > sf.hits, 8000).catch(() => {});
await sleep(100);
await up('ArrowUp');
const sc = await state();
const cy = await evaluate(`(() => { const s = ${stage}; let c = -Infinity; for (const dx of [-6, 0, 6]) c = Math.max(c, s.terrain.ceilY(s.scrollX + s.craft.x + dx)); return c; })()`);
check('the ceiling is a hit and bounces the craft', sc.hits > sf.hits && sc.y >= cy + 4, `y ${sc.y.toFixed(1)}, ceiling ${cy}`);

await evaluate(centre);
await sleep(1600);
await shot('3-play-mid');
await evaluate(`(() => { ${stage}.landOnly = true; __overtone.scene.getScene('hud').cameras.main.setVisible(false); })()`);
await sleep(300);
await shot('4-landscape');
await evaluate(`__overtone.scene.getScene('hud').cameras.main.setVisible(true)`);

console.log(`fps while playing (headless, SwiftShader): ${await evaluate(`Math.round(__overtone.loop.actualFps)`)}`);
await tap('Escape');
await until(() => evaluate(`__overtone.scene.isActive('title') && !__overtone.scene.isActive('hud')`), 5000)
  .then(() => check('Esc returns to the title and the HUD stops', true), () => check('Esc returns to the title and the HUD stops', false));
done();
