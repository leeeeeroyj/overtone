import { TOP, TOUCH, WIDTH } from './config';

type Button = 'charge' | 'echo';
type Circle = { x: number; y: number; r: number };
type Layout = { stick: Circle; charge: Circle; echo: Circle; rect: DOMRect };

const BUTTONS: Button[] = ['charge', 'echo'];
const LABELS: Record<Button, string> = { charge: 'CHARGE', echo: 'ECHO' };
const RGB = { stick: '255, 216, 77', charge: '111, 247, 255', echo: '255, 122, 230' };
/** Gap (CSS px) kept between controls and the screen edges. */
const MARGIN = 8;

/**
 * The touch controls, drawn as page elements so they can sit in the empty bars beside the game on wide phones.
 * Touches are read from the whole page, because Phaser only hears touches that start on its canvas.
 *   Left thumb: a floating stick. A touch anywhere on the left of the screen centres the stick where it lands, and
 *   the craft flies the way the thumb then moves.
 *   Right thumb: CHARGE (hold, let go for the beam) low in the corner and ECHO (tap) above it. A touch anywhere on
 *   the right takes the nearer of the two, and the thumb can slide between them.
 * The craft fires by itself while the controls are on (CHARGE stops it, as it does with keys).
 */
class TouchControls {
  private stickHeld: { id: number; ox: number; oy: number; x: number; y: number } | undefined;
  /** Which button each other touch is on (or none). */
  private readonly held = new Map<number, Button | null>();
  /** Buttons pressed since the last read, so a tap shorter than a frame still counts. */
  private taps = new Set<Button>();
  private els: { ring: HTMLDivElement; knob: HTMLDivElement; charge: HTMLDivElement; echo: HTMLDivElement } | undefined;
  private shown = false;
  private touched = false;
  private readonly coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;

  constructor() {
    window.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => {
      if (this.stickHeld?.id === e.pointerId) Object.assign(this.stickHeld, { x: e.clientX, y: e.clientY });
      else if (this.held.has(e.pointerId)) {
        const was = this.held.get(e.pointerId);
        const now = this.button(e.clientX, e.clientY, true);
        if (now && now !== was) this.taps.add(now);
        this.held.set(e.pointerId, now);
      }
    });
    const up = (e: PointerEvent) => {
      if (this.stickHeld?.id === e.pointerId) this.stickHeld = undefined;
      this.held.delete(e.pointerId);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  /** On while flying (not on the title, paused, at game over or in attract mode). */
  show(on: boolean) {
    if (on === this.shown) return;
    this.shown = on;
    if (!on) {
      this.stickHeld = undefined;
      this.held.clear();
      this.taps.clear();
    }
    this.render();
  }

  /** Drawn and listening: on a touch screen (or once the screen has been touched) while flying. */
  get visible() {
    return this.shown && (this.coarse || this.touched);
  }

  /** A thumb is on the stick or a button. */
  get active() {
    return this.stickHeld !== undefined || [...this.held.values()].some(Boolean);
  }

  /** The thumb's offset from where it landed, -1..1 on each axis, clamped to the rim. */
  stick(): { x: number; y: number } | undefined {
    const h = this.stickHeld;
    if (!h) return undefined;
    const r = this.layout().stick.r;
    let x = (h.x - h.ox) / r;
    let y = (h.y - h.oy) / r;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return len < TOUCH.deadzone ? { x: 0, y: 0 } : { x, y };
  }

  /** Held now. */
  pressed(which: Button) {
    for (const b of this.held.values()) if (b === which) return true;
    return false;
  }

  /** Pressed since the last call (each press counts once). */
  took(which: Button) {
    const had = this.taps.has(which);
    this.taps.delete(which);
    return had;
  }

  /** Redraws the controls. Call once per frame. */
  render() {
    if (!this.visible) {
      if (this.els) for (const el of [this.els.ring, this.els.charge, this.els.echo]) el.style.display = 'none';
      return;
    }
    const els = (this.els ??= this.build());
    const l = this.layout();
    const h = this.stickHeld;
    const v = this.stick();
    const s = l.stick;
    // Held, the ring sits where the thumb landed; otherwise at home in the corner.
    const cx = h ? h.ox : s.x;
    const cy = h ? h.oy : s.y;
    Object.assign(els.ring.style, {
      display: 'block', left: `${cx - s.r}px`, top: `${cy - s.r}px`, width: `${s.r * 2}px`, height: `${s.r * 2}px`,
      background: `rgba(${RGB.stick}, 0.08)`, border: `2px solid rgba(${RGB.stick}, ${h ? 0.65 : 0.35})`,
    });
    const k = s.r * 0.4;
    Object.assign(els.knob.style, {
      width: `${k * 2}px`, height: `${k * 2}px`, background: `rgba(${RGB.stick}, ${h ? 0.6 : 0.25})`,
      transform: `translate(${s.r - k - 2 + (v?.x ?? 0) * s.r}px, ${s.r - k - 2 + (v?.y ?? 0) * s.r}px)`,
    });
    for (const b of BUTTONS) {
      const c = l[b];
      const down = this.pressed(b);
      // Held: filled and outlined bold (never colour alone).
      Object.assign(els[b].style, {
        display: 'flex', left: `${c.x - c.r}px`, top: `${c.y - c.r}px`, width: `${c.r * 2}px`, height: `${c.r * 2}px`,
        fontSize: `${Math.max(9, Math.round(c.r * 0.36))}px`,
        background: `rgba(${RGB[b]}, ${down ? 0.5 : 0.1})`, border: `${down ? 4 : 2}px solid rgba(${RGB[b]}, ${down ? 0.95 : 0.5})`,
      });
    }
  }

  /** Where each control is, in CSS px. Exposed for the tests. */
  layout(): Layout {
    const canvas = document.querySelector('#game canvas');
    const rect = canvas?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const k = rect.width / WIDTH;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const gutter = Math.max(0, Math.min(rect.left, W - rect.right));
    // At least thumb-sized, whatever the scale.
    const sr = Math.max(TOUCH.stick.r * k, 40);
    const cr = Math.max(TOUCH.charge.r * k, 32);
    const er = Math.max(TOUCH.echo.r * k, 24);
    // Centred in the bars beside the game where they're wide enough, otherwise tucked into the bottom corners.
    const sy = H - sr - MARGIN * 2;
    const stick = { x: Math.max(gutter / 2, sr + MARGIN), y: sy, r: sr };
    const charge = { x: W - Math.max(gutter / 2, cr + MARGIN), y: H - cr - MARGIN * 2, r: cr };
    const echo = { x: charge.x - cr * 0.5, y: charge.y - cr - er - MARGIN * 1.5, r: er };
    return { stick, charge, echo, rect };
  }

  private down(e: PointerEvent) {
    if (e.pointerType !== 'touch' || !this.shown) return;
    this.touched = true;
    const l = this.layout();
    // The top bar's II and speaker belong to the HUD.
    if (e.clientY < l.rect.top + TOP * (l.rect.width / WIDTH)) return;
    const W = window.innerWidth;
    if (!this.stickHeld && e.clientX < W * TOUCH.side) {
      // Keep the ring on screen.
      const r = l.stick.r;
      const ox = Math.max(r, Math.min(W - r, e.clientX));
      const oy = Math.max(r, Math.min(window.innerHeight - r, e.clientY));
      this.stickHeld = { id: e.pointerId, ox, oy, x: e.clientX, y: e.clientY };
      return;
    }
    const b = this.button(e.clientX, e.clientY, e.clientX > W * (1 - TOUCH.side));
    if (b) this.taps.add(b);
    this.held.set(e.pointerId, b);
  }

  /** The button under a point (within its grab range), or with `anywhere`, the nearer of the two. */
  private button(x: number, y: number, anywhere: boolean): Button | null {
    const l = this.layout();
    let best: Button | null = null;
    let bestD = Infinity;
    for (const b of BUTTONS) {
      const d = Math.hypot(x - l[b].x, y - l[b].y) / l[b].r;
      if (d < bestD && (anywhere || d <= TOUCH.grab)) [best, bestD] = [b, d];
    }
    return best;
  }

  private build() {
    const ring = document.createElement('div');
    const knob = document.createElement('div');
    Object.assign(ring.style, { position: 'fixed', borderRadius: '50%', pointerEvents: 'none', zIndex: '5', boxSizing: 'border-box' });
    Object.assign(knob.style, { position: 'absolute', left: '0', top: '0', borderRadius: '50%' });
    ring.append(knob);
    document.body.append(ring);
    const button = (b: Button) => {
      const el = document.createElement('div');
      el.textContent = LABELS[b];
      el.dataset.touch = b;
      Object.assign(el.style, {
        position: 'fixed', borderRadius: '50%', pointerEvents: 'none', zIndex: '5', boxSizing: 'border-box',
        alignItems: 'center', justifyContent: 'center', color: '#f4ecff', fontFamily: 'Doto, monospace', fontWeight: '900',
      });
      document.body.append(el);
      return el;
    };
    ring.dataset.touch = 'stick';
    return { ring, knob, charge: button('charge'), echo: button('echo') };
  }
}

export const touchControls = new TouchControls();
