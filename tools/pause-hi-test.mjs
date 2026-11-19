// Pause and high score: P, Start (the pad), the HUD's pause icon and the page going to the background pause the run;
// P, Enter or RESUME resumes; Esc from the pause panel goes to the title. A run's score becomes the high score
// (overtone-hi), shown on the title, in the HUD and on the game-over panel, and a lower score doesn't replace it.
// Usage: node tools/pause-hi-test.mjs <project-dir> <out-dir>
import { session, sleep } from './cdp.mjs';

const [project = '.', out = 'pause-hi-out'] = process.argv.slice(2);
const t = await session({ project, out, port: 5255, debugPort: 9365, width: 1664, height: 912 });
const { evaluate, until, shot, tap, check, done } = t;
const G = '__overtone';
const S = `${G}.scene.getScene('stage')`;
const H = `${G}.scene.getScene('hud')`;
const run = (body) => evaluate(`(() => { const s = ${S}; ${body} })()`);
const waitFor = (body, ms = 10000) => until(() => run(body), ms).then(() => true, () => false);
/** Everything that should hold still while paused: the beat, the scroll and every enemy. */
const motion = () => run(`return s.beat.time + s.scrollX + s.foes.reduce((a, e) => a + e.x + e.y, 0);`);
const start = async () => {
  await until(() => evaluate(`${G}.scene.isActive('title')`), 30000);
  await sleep(500);
  await tap('Enter');
  await until(() => evaluate(`${G}.scene.isActive('stage') && !!${G}.registry.get('hud')`), 5000);
  await waitFor(`return s.beat.time > 1.5;`);
};

await until(() => evaluate(`!!window.${G}`));
await evaluate(`localStorage.clear()`);
await start();

await tap('p');
await sleep(100);
const a = await motion();
await sleep(600);
check('P pauses: the beat, the scroll and the enemies hold still', (await run(`return s.paused;`)) && (await motion()) === a);
check('the pause panel shows', await evaluate(`${H}.pauseButtons[0].text.visible && ${G}.registry.get('hud').paused`));
await shot('1-paused');
await tap('p');
await sleep(400);
check('P again resumes', !(await run(`return s.paused;`)) && (await motion()) !== a);
await tap('p');
await sleep(100);
await tap('Enter');
await sleep(100);
check('Enter resumes', !(await run(`return s.paused;`)));

// The HUD's pause icon and RESUME button, by mouse.
const click = async (hx, hy) => {
  // HUD units are half a design px; the canvas fills the 1664 px window at 4 px a design px.
  const r = await evaluate(`(() => { const b = ${G}.canvas.getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 416 }; })()`);
  const x = r.x + (hx / 2) * r.k;
  const y = r.y + (hy / 2) * r.k;
  await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await t.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await t.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
};
await click(777, 16);
await sleep(200);
check('clicking the II icon pauses', await run(`return s.paused;`));
const resume = await evaluate(`(() => { const b = ${H}.pauseButtons[0]; return { x: b.x, y: b.y + b.h / 2 }; })()`);
await click(resume.x, resume.y);
await sleep(200);
check('clicking RESUME resumes', !(await run(`return s.paused;`)));

// A controller's Start button.
await evaluate(`(() => {
  const pad = { id: 'Test pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(), axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  window.__pad = pad;
  navigator.getGamepads = () => [pad, null, null, null];
  window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: pad }));
})()`);
await sleep(300);
const press = async (i) => {
  await evaluate(`__pad.buttons[${i}] = { pressed: true, touched: true, value: 1 }; __pad.timestamp = performance.now() + 1e6;`);
  await sleep(250);
  await evaluate(`__pad.buttons[${i}] = { pressed: false, touched: false, value: 0 }; __pad.timestamp = performance.now() + 1e6;`);
  await sleep(250);
};
await press(9);
check('Start on a controller pauses', await run(`return s.paused;`));
check('and the panel shows the controller\'s hints', (await evaluate(`${H}.pauseHint.text`)).startsWith('START'));
await press(9);
check('Start again resumes', !(await run(`return s.paused;`)) && (await evaluate(`${G}.registry.get('hud').device`)) === 'pad');
await evaluate(`navigator.getGamepads = () => [null, null, null, null]; window.dispatchEvent(Object.assign(new Event('gamepaddisconnected'), { gamepad: __pad }));`);

await evaluate(`Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange'))`);
await sleep(100);
check('the page going to the background pauses', await run(`return s.paused;`));
// Phaser's own loop sleeps on the same event: wake it.
await evaluate(`delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))`);
await sleep(300);
check('and it stays paused when the page comes back', await run(`return s.paused;`));
await tap('Escape');
await until(() => evaluate(`${G}.scene.isActive('title')`), 3000).catch(() => {});
check('Esc from the pause panel goes to the title', await evaluate(`${G}.scene.isActive('title') && !${G}.scene.isActive('hud')`));

// ---- The high score. ----
await start();
check('a run started after leaving from pause is not paused', !(await run(`return s.paused;`)));
const over = async (score) => {
  await run(`s.clearField(); s.score = ${score}; s.lose();`);
  await waitFor(`return s.gameOver >= 1.2;`, 5000);
  await sleep(200);
};
await over(1234);
await shot('2-new-high');
check('game over saves the high score', (await evaluate(`localStorage.getItem('overtone-hi')`)) === '1234');
check('the panel says NEW HIGH SCORE!', await evaluate(`${H}.overHi.text === 'NEW HIGH SCORE!'`));
await tap('ArrowRight');
await sleep(150);
await tap('Enter');
await waitFor(`return !s.over && s.beat.time > 0.5;`, 8000);
check('the HUD shows HI', await evaluate(`${H}.hi.text === '0001234'`), await evaluate(`${H}.hi.text`));
check('pausing is refused once the run is over', await (async () => {
  await run(`s.clearField(); s.score = 500; s.lose();`);
  await waitFor(`return s.over;`, 3000);
  await tap('p');
  await sleep(150);
  return !(await run(`return s.paused;`));
})());
await waitFor(`return s.gameOver >= 1.2;`, 5000);
check('a lower score leaves it alone', (await evaluate(`localStorage.getItem('overtone-hi')`)) === '1234');
{ const hi = await evaluate(`${H}.overHi.text`); check('and the panel shows the high score', hi === 'HI 0001234', hi); }
await tap('Escape');
await until(() => evaluate(`${G}.scene.isActive('title')`), 3000);
await sleep(400);
await shot('3-title');
check('the title shows HI', await evaluate(`${G}.scene.getScene('title').children.list.some((o) => o.text === 'HI 1,234')`));

// Leaving mid-run from pause keeps a better score too.
await start();
await run(`s.score = 7000;`);
await tap('p');
await sleep(100);
await tap('Escape');
await until(() => evaluate(`${G}.scene.isActive('title')`), 3000);
check('leaving a run from the pause panel keeps its score as the high score', (await evaluate(`localStorage.getItem('overtone-hi')`)) === '7000');
done();
