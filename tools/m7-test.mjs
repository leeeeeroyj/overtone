// Milestone 7: touch. On phone-shaped screens (844×390 and 932×430, touch emulation, coarse pointer) the title
// shows the touch controls and START takes a tap; in play the floating stick flies, fire is automatic, CHARGE held
// and let go fires the beam (with the stick still held: two thumbs), ECHO launches and recalls the Echo, the II taps
// pause and RESUME resumes; the controls hide while paused and at game over; turned upright, the page asks to be
// turned back and the run pauses.
// Usage: node tools/m7-test.mjs <project-dir> <out-dir>
import { session, sleep } from './cdp.mjs';

const [project = '.', out = 'm7-out'] = process.argv.slice(2);
const SIZES = [[844, 390], [932, 430]];
const t = await session({ project, out, port: 5262, debugPort: 9372, width: SIZES[0][0], height: SIZES[0][1], touch: true, mobile: true });
const { evaluate, until, shot, press, move, lift, check, done } = t;
const G = '__overtone';
const S = `${G}.scene.getScene('stage')`;
const run = (body) => evaluate(`(() => { const s = ${S}; ${body} })()`);
const waitFor = (body, ms = 10000) => until(() => run(body), ms).then(() => true, () => false);
/** A design-px point (or a HUD point, at half a design px) in CSS px. */
const at = async (x, y, hud = false) => {
  const r = await evaluate(`(() => { const b = ${G}.canvas.getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 416 }; })()`);
  const d = hud ? 2 : 1;
  return { x: r.x + (x / d) * r.k, y: r.y + (y / d) * r.k };
};
const tapAt = async (p, ms = 70) => {
  await press(9, p.x, p.y);
  await sleep(ms);
  await lift(9);
};
const layout = () => evaluate(`(() => { const l = __touch.layout(); return { stick: l.stick, charge: l.charge, echo: l.echo, top: l.rect.top + 16 * l.rect.width / 416 }; })()`);
const shown = () => evaluate(`[...document.querySelectorAll('[data-touch]')].filter((e) => e.style.display !== 'none').map((e) => e.dataset.touch).sort().join()`);

for (const [w, h] of SIZES) {
  const tag = `[${w}×${h}]`;
  if (w !== SIZES[0][0]) {
    await t.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: true, screenOrientation: { type: 'landscapePrimary', angle: 90 } });
    await t.send('Page.reload');
    await sleep(1000);
  }
  await until(() => evaluate(`!!(window.${G} && ${G}.scene.isActive('title'))`), 30000);
  await sleep(600);
  check(`${tag} the page is a touch screen, and the title shows the touch controls`,
    await evaluate(`matchMedia('(pointer: coarse)').matches && ${G}.scene.getScene('title').children.list.some((o) => o.text === 'TOUCH')`));
  await shot(`${w}-1-title`);
  const start = await evaluate(`(() => { const b = ${G}.scene.getScene('title').start.getBounds(); return { x: b.centerX, y: b.centerY }; })()`);
  await tapAt(await at(start.x, start.y));
  const started = await until(() => evaluate(`${G}.scene.isActive('stage') && ${G}.scene.isActive('hud')`), 15000).then(() => true, () => false);
  check(`${tag} tapping START starts a run`, started);
  await waitFor(`return s.beat.time > 1;`);
  await run(`s.clearField(); s.craft.invuln = 1e9;`);

  // The controls: all on screen, below the top bar, not on top of each other.
  const l = await layout();
  const circles = [l.stick, l.charge, l.echo];
  check(`${tag} the stick, CHARGE and ECHO show`, (await shown()) === 'charge,echo,stick', await shown());
  check(`${tag} every control is fully on screen and below the top bar`,
    circles.every((c) => c.x - c.r >= 0 && c.x + c.r <= w && c.y - c.r >= l.top && c.y + c.r <= h), JSON.stringify(l));
  check(`${tag} CHARGE and ECHO don't overlap`, Math.hypot(l.charge.x - l.echo.x, l.charge.y - l.echo.y) > l.charge.r + l.echo.r, JSON.stringify(l));
  check(`${tag} buttons are thumb-sized (at least 44 px across)`, circles.every((c) => c.r * 2 >= 44));

  // Fly: the left thumb lands anywhere on the left and pushes.
  const sx = w * 0.15;
  const sy = h * 0.6;
  const c0 = await run(`Object.assign(s.craft, { x: 120, y: 120 }); return { x: s.craft.x, y: s.craft.y, shots: s.shots.length };`);
  await press(1, sx, sy);
  await move(1, sx + l.stick.r, sy);
  await waitFor(`return s.beat.time > 0 && s.craft.x > 150;`, 4000);
  const c1 = await run(`return { x: s.craft.x, y: s.craft.y, device: ${G}.registry.get('hud').device };`);
  check(`${tag} pushing the stick right flies right`, c1.x > c0.x + 20, JSON.stringify({ c0, c1 }));
  check(`${tag} the hints switch to touch`, c1.device === 'touch' && (await evaluate(`${G}.scene.getScene('hud').hint.text`)).startsWith('LEFT THUMB'));
  await move(1, sx, sy - l.stick.r);
  await waitFor(`return s.craft.y < 90;`, 4000);
  check(`${tag} and up flies up`, (await run(`return s.craft.y;`)) < c1.y - 20);
  check(`${tag} fire is automatic`, await waitFor(`return s.shots.some((x) => x.kind === 'note');`, 3000));
  await shot(`${w}-2-flying`);

  // Two thumbs: hold the stick, hold CHARGE for two beats or more, let go: the beam.
  await move(1, sx, sy);
  await run(`window.__beams = 0; const r = s.release.bind(s); s.release = (...a) => { window.__beams++; return r(...a); };`);
  await press(2, l.charge.x, l.charge.y);
  const charging = await waitFor(`return s.craft.charging && s.tier() >= 2;`, 6000);
  await shot(`${w}-3-charging`);
  await lift(2);
  check(`${tag} holding CHARGE (stick held too) charges past tier 2`, charging);
  check(`${tag} letting go fires the beam`, await waitFor(`return window.__beams === 1 && !s.craft.charging;`, 3000));
  await lift(1);

  // ECHO: tap to launch, tap to call it back.
  await run(`Object.assign(s.craft, { x: 100, y: 120 });`);
  await tapAt(l.echo);
  check(`${tag} tapping ECHO launches the Echo`, await waitFor(`return s.echo.state === 'flying' || s.echo.state === 'hover';`, 3000));
  await waitFor(`return s.echo.state === 'hover';`, 6000);
  await tapAt(l.echo);
  check(`${tag} tapping it again calls it back`, await waitFor(`return s.echo.state === 'returning' || s.echo.attached;`, 3000));
  check(`${tag} and it comes home`, await waitFor(`return s.echo.attached;`, 8000));

  // Pause: the II in the top bar; it doesn't count as a button press.
  await tapAt(await at(774, 16, true));
  check(`${tag} tapping II pauses`, await waitFor(`return s.paused;`, 2000));
  check(`${tag} without charging or launching the Echo`, await run(`return !s.craft.charging && s.echo.attached;`));
  check(`${tag} the touch controls hide while paused`, (await shown()) === '');
  await shot(`${w}-4-paused`);
  const resume = await evaluate(`(() => { const b = ${G}.scene.getScene('hud').pauseButtons[0]; return { x: b.x, y: b.y + b.h / 2 }; })()`);
  await tapAt(await at(resume.x, resume.y, true));
  check(`${tag} tapping RESUME resumes, and the controls come back`, (await waitFor(`return !s.paused;`, 2000)) && (await shown()) === 'charge,echo,stick');

  // Game over hides them; the panel takes taps.
  await run(`s.lose();`);
  await waitFor(`return s.gameOver >= 1.3;`, 5000);
  check(`${tag} the controls hide at game over, with the touch hint`, (await shown()) === ''
    && (await evaluate(`${G}.scene.getScene('hud').overHint.text`)) === 'TAP TO CHOOSE');
  const retry = await evaluate(`(() => { const b = ${G}.scene.getScene('hud').overButtons[1]; return { x: b.x, y: b.y + b.h / 2 }; })()`);
  await tapAt(await at(retry.x, retry.y, true));
  check(`${tag} tapping RETRY starts again`, await waitFor(`return !s.over && s.movement === 0 && s.beat.time > 0.3;`, 8000));

  // Upright: the page asks to be turned, and the run pauses.
  if (w === SIZES[0][0]) {
    await t.send('Emulation.setDeviceMetricsOverride', { width: h, height: w, deviceScaleFactor: 1, mobile: true, screenOrientation: { type: 'portraitPrimary', angle: 0 } });
    await sleep(800);
    const upright = await evaluate(`getComputedStyle(document.getElementById('rotate')).display`);
    check('turned upright, the page asks to be turned sideways', upright === 'flex', upright);
    check('  and the run pauses', await run(`return s.paused;`));
    await shot('5-upright');
  }
  await evaluate(`${S}.leave()`);
}
done();
