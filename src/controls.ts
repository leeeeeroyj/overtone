import Phaser from 'phaser';

export type Device = 'kbm' | 'pad' | 'touch';

export interface ControlState {
  /** Flight, each axis -1..1: x left/right, y up (-) or down (+). */
  move: { x: number; y: number };
  /** Held. */
  fire: boolean;
  /** Held; release fires the beam. */
  charge: boolean;
  /** Edges: true only on the frame they're pressed. */
  echo: boolean;
  confirm: boolean;
  back: boolean;
  mute: boolean;
  /** P on the keyboard, Start on a controller (Start also confirms, for menus). */
  pause: boolean;
  /** A menu step left (-1) or right (1): an arrow, A or D pressed, or the stick or D-pad pushed over. */
  nav: number;
  device: Device;
}

const DEADZONE = 0.2;
const TRIGGER_THRESHOLD = 0.3;
// Standard gamepad mapping (Xbox layout).
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, BACK: 8, START: 9 } as const;
const TRACKED = Object.values(BTN);

type KeyName =
  | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | 'A' | 'D' | 'W' | 'S' | 'SPACE' | 'Z' | 'J' | 'X' | 'K'
  | 'C' | 'L' | 'SHIFT' | 'M' | 'ENTER' | 'ESC' | 'P';

/**
 * One input layer. Keyboard: arrows or WASD fly, Space/Z/J fire, X/K charge, C/L/Shift Echo, M sound, P pause,
 * Enter start, Esc back. Mouse: left fires, right charges, middle launches the Echo. Controller: left stick or D-pad
 * flies, A fires, X/RT charge, B/RB Echo, Y sound, Start pause (and confirm), Back returns. The last device used
 * decides the hints. Construct one per scene.
 */
export class Controls {
  /** Phones and tablets start in touch mode, so the hints are right before the first touch. */
  device: Device = window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'kbm';
  private prevButtons = new Set<number>();
  private prevMiddle = false;
  private prevPadX = 0;
  private readonly keys: Record<KeyName, Phaser.Input.Keyboard.Key>;
  /**
   * Keys pressed since the last read. Phaser forgets a press once the key is up again, so a tap shorter than a frame
   * (easy on a slow device) would be lost; these are kept until the next frame reads them.
   */
  private presses = new Set<string>();

  constructor(private readonly scene: Phaser.Scene) {
    this.keys = scene.input.keyboard!.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE,Z,J,X,K,C,L,SHIFT,M,ENTER,ESC,P') as Controls['keys'];
    scene.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (!e.repeat) this.presses.add(e.code);
    });
    scene.input.mouse?.disableContextMenu();
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => (this.device = p.wasTouch ? 'touch' : 'kbm'));
  }

  /** The first connected controller, if the browser has seen one (it needs a button press first). */
  pad(): Phaser.Input.Gamepad.Gamepad | undefined {
    const pad = this.scene.input.gamepad?.pad1;
    return pad && pad.connected ? pad : undefined;
  }

  read(): ControlState {
    const k = this.keys;
    const pressed = this.presses;
    this.presses = new Set();
    const just = (...codes: string[]) => codes.some((c) => pressed.has(c));
    const pointer = this.scene.input.activePointer;
    // Phaser reports a touch as a held left button, so only a real mouse fires this way.
    const mouse = !pointer.wasTouch && pointer.isDown;
    const middle = mouse && pointer.middleButtonDown();
    const move = {
      x: (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0),
      y: (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0),
    };
    let fire = k.SPACE.isDown || k.Z.isDown || k.J.isDown || (mouse && pointer.leftButtonDown());
    let charge = k.X.isDown || k.K.isDown || (mouse && pointer.rightButtonDown());
    let echo = just('KeyC', 'KeyL', 'ShiftLeft', 'ShiftRight') || (middle && !this.prevMiddle);
    this.prevMiddle = middle;
    let confirm = just('Enter', 'NumpadEnter', 'Space');
    let back = just('Escape');
    let mute = just('KeyM');
    let pause = just('KeyP');
    let nav = (just('ArrowRight', 'KeyD') ? 1 : 0) - (just('ArrowLeft', 'KeyA') ? 1 : 0);
    if (move.x || move.y || fire || charge || echo || confirm || back || mute || pause) this.device = 'kbm';

    const pad = this.pad();
    const down = new Set(pad ? TRACKED.filter((i) => pad.buttons[i]?.pressed) : []);
    const edges = new Set([...down].filter((i) => !this.prevButtons.has(i)));
    this.prevButtons = down;
    if (pad) {
      const dz = (v: number) => (Math.abs(v) < DEADZONE ? 0 : v);
      let mx = dz(pad.leftStick.x);
      let my = dz(pad.leftStick.y);
      if (pad.left) mx = -1;
      if (pad.right) mx = 1;
      if (pad.up) my = -1;
      if (pad.down) my = 1;
      const padCharge = down.has(BTN.X) || pad.R2 > TRIGGER_THRESHOLD;
      if (mx || my || down.size || padCharge) this.device = 'pad';
      if (mx || my) {
        move.x = mx;
        move.y = my;
      }
      const padX = Math.sign(Math.round(mx));
      if (padX && padX !== this.prevPadX) nav ||= padX;
      this.prevPadX = padX;
      fire ||= down.has(BTN.A);
      charge ||= padCharge;
      echo ||= edges.has(BTN.B) || edges.has(BTN.RB);
      confirm ||= edges.has(BTN.A) || edges.has(BTN.START);
      back ||= edges.has(BTN.BACK);
      mute ||= edges.has(BTN.Y);
      pause ||= edges.has(BTN.START);
    }

    const len = Math.hypot(move.x, move.y);
    if (len > 1) {
      move.x /= len;
      move.y /= len;
    }
    return { move, fire, charge, echo, confirm, back, mute, pause, nav, device: this.device };
  }
}
