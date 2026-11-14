import Phaser from 'phaser';
import { FONT, GH, GW } from '../config';
import { audio } from '../core/audio';
import { clamp } from '../core/math';
import { PERFECT_END, PERFECT_START } from '../entities/player';
import type { GameScene, TouchAction } from './GameScene';

// ---------------------------------------------------------------- tunables (logical 1920x1080 px)

/** Radius of a joystick base; the knob travels this far. */
export const STICK_R = 160;
/** Radius of the joystick knob. */
export const KNOB_R = 70;
/** Move stick dead zone, as a fraction of STICK_R. */
export const MOVE_DEAD = 0.12;
/** Aim stick: below this fraction of STICK_R the stick does nothing. */
export const AIM_DEAD = 0.18;
/** Aim stick: past this fraction of STICK_R the gun fires. */
export const AIM_FIRE = 0.5;
/** Touches that land left of this x drive the move stick, right of it the aim stick. */
export const SPLIT_X = GW / 2;
/** Hit radius of a round button is this much larger than its drawn disc. */
const HIT_PAD = 1.12;

interface Disc {
  x: number;
  y: number;
  r: number;
}

/** Fixed positions of every touch control. Exported so tests and the HUD layout can use them. */
export const TOUCH_LAYOUT = {
  roll: { x: GW - 190, y: GH - 200, r: 110 },
  reload: { x: GW - 450, y: GH - 120, r: 82 },
  blast: { x: GW - 130, y: GH - 450, r: 82 },
  interact: { x: GW - 470, y: GH - 360, r: 92 },
  /** Drawn smaller than its hit area (HIT_PAD applies on top of the larger `hit`). */
  pause: { x: GW - 100, y: 96, r: 60, hit: 80 },
  /** Resting hints where the sticks appear when nothing is touching that side. */
  moveHint: { x: 330, y: GH - 300 },
  aimHint: { x: GW - 760, y: GH - 330 },
  /** The weapon panel (bottom centre) is tapped to cycle weapons. */
  weapon: { x: GW / 2 - 320, y: GH - 196, w: 640, h: 168 },
} as const;

type ButtonId = 'roll' | 'reload' | 'blast' | 'interact' | 'pause' | 'weapon';

interface Stick {
  ptr: number;
  bx: number;
  by: number;
  kx: number;
  ky: number;
  /** Displacement as a fraction of STICK_R (0..1). */
  mag: number;
  ang: number;
}

interface Btn {
  id: ButtonId;
  action: TouchAction;
  ptr: number;
  flash: number;
  g: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text | null;
  sub: Phaser.GameObjects.Text | null;
}

const INK = 0x17120f;
const CREAM = 0xf3e6c8;
const GOLD = 0xe8c05a;
const RED = 0xd8452f;

/**
 * Twin-stick touch controls, drawn in the UI scene and fed into GameScene.touch / touchPress().
 * Every touch is owned by exactly one control until it lifts; nothing is read while a menu is up.
 */
export class TouchControls {
  enabled = false;
  private stickG: Phaser.GameObjects.Graphics;
  private ringG: Phaser.GameObjects.Graphics;
  private root: Phaser.GameObjects.Container;
  private move: Stick = { ptr: -1, bx: 0, by: 0, kx: 0, ky: 0, mag: 0, ang: 0 };
  private aim: Stick = { ptr: -1, bx: 0, by: 0, kx: 0, ky: 0, mag: 0, ang: 0 };
  private btns: Btn[] = [];
  private interactLabel = '';
  private lastBlanks = -1;
  private lastState = '';

  constructor(
    private ui: Phaser.Scene,
    private g: GameScene,
    /** True while a menu, the game-over screen or a pause is up. */
    private blocked: () => boolean,
  ) {
    this.root = ui.add.container(0, 0).setDepth(400);
    this.stickG = ui.add.graphics();
    this.ringG = ui.add.graphics();
    this.root.add(this.stickG);

    const L = TOUCH_LAYOUT;
    this.addBtn('roll', 'roll', 'ROLL', 40);
    this.addBtn('reload', 'reload', 'RELOAD', 40);
    this.addBtn('blast', 'blank', '0', 54, 'BLAST');
    this.addBtn('interact', 'interact', '', 40);
    this.addBtn('pause', 'pause', '', 40);
    this.addBtn('weapon', 'cycle', '', 40);
    this.root.add(this.ringG);
    // label positions
    this.btn('roll').text!.setPosition(L.roll.x, L.roll.y + 44);
    this.btn('reload').text!.setPosition(L.reload.x, L.reload.y);
    this.btn('blast').text!.setPosition(L.blast.x, L.blast.y - 18);
    this.btn('blast').sub!.setPosition(L.blast.x, L.blast.y + 36);
    this.btn('interact').text!.setPosition(L.interact.x, L.interact.y);

    const inp = ui.input;
    inp.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    // thumbs often land on the black letterbox bars beside the canvas on a wide phone
    inp.on(Phaser.Input.Events.POINTER_DOWN_OUTSIDE, this.onDownOutside, this);
    inp.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    inp.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    ui.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.setEnabled(false);
  }

  private addBtn(id: ButtonId, action: TouchAction, text: string, size: number, sub?: string): void {
    const g = this.ui.add.graphics();
    this.root.add(g);
    let t: Phaser.GameObjects.Text | null = null;
    let s: Phaser.GameObjects.Text | null = null;
    if (id !== 'pause' && id !== 'weapon') {
      t = this.ui.add.text(0, 0, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: '700', color: '#f3e6c8', align: 'center' })
        .setOrigin(0.5).setLetterSpacing(2).setStroke('#17120f', 6);
      this.root.add(t);
    }
    if (sub) {
      s = this.ui.add.text(0, 0, sub, { fontFamily: FONT, fontSize: '40px', fontStyle: '500', color: '#f3e6c8' })
        .setOrigin(0.5).setLetterSpacing(2).setStroke('#17120f', 6);
      this.root.add(s);
    }
    this.btns.push({ id, action, ptr: -1, flash: 0, g, text: t, sub: s });
  }

  private btn(id: ButtonId): Btn {
    return this.btns.find((b) => b.id === id)!;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on) {
      // twin-stick play needs move + aim + a button at once; Phaser starts with a single touch pointer
      const m = this.ui.input.manager;
      if (m.pointersTotal < 4) this.ui.input.addPointer(4 - m.pointersTotal);
    }
    this.releaseAll();
    this.root.setVisible(on);
  }

  /** Let go of every control (pause, menus, scene shutdown, lost touches). */
  releaseAll(): void {
    this.move.ptr = -1;
    this.aim.ptr = -1;
    this.move.mag = this.aim.mag = 0;
    for (const b of this.btns) b.ptr = -1;
    const t = this.g.touch;
    if (t) {
      t.mx = t.my = 0;
      t.aiming = false;
      t.fire = false;
    }
  }

  destroy(): void {
    const inp = this.ui.input;
    inp.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    inp.off(Phaser.Input.Events.POINTER_DOWN_OUTSIDE, this.onDownOutside, this);
    inp.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    inp.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.releaseAll();
  }

  // ---------------------------------------------------------------- hit testing

  private visible(id: ButtonId): boolean {
    if (id === 'interact') return !!this.g.interactTarget && !this.g.player.dead;
    return true;
  }

  private hit(id: ButtonId, x: number, y: number): boolean {
    const L = TOUCH_LAYOUT;
    if (id === 'weapon') {
      const r = L.weapon;
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    }
    const d: Disc & { hit?: number } = L[id];
    const r = (d.hit ?? d.r) * HIT_PAD;
    return (x - d.x) ** 2 + (y - d.y) ** 2 <= r * r;
  }

  private owns(id: number): boolean {
    return this.move.ptr === id || this.aim.ptr === id || this.btns.some((b) => b.ptr === id);
  }

  private onDown(ptr: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    // A menu button or the dim behind a menu took this touch (even if it just closed the menu).
    if (!this.enabled || this.blocked() || (over && over.length)) return;
    if (this.owns(ptr.id)) return;
    const { x, y } = ptr;
    // a touch that starts on a button is that button; anything else starts a stick
    for (const b of this.btns) {
      if (!this.visible(b.id) || !this.hit(b.id, x, y)) continue;
      b.ptr = ptr.id;
      b.flash = 1;
      audio.unlock();
      this.g.touchPress(b.action);
      return;
    }
    const s = x < SPLIT_X ? this.move : this.aim;
    if (s.ptr !== -1) return;
    s.ptr = ptr.id;
    s.bx = s.kx = x;
    s.by = s.ky = y;
    s.mag = 0;
  }

  /** A touch outside the canvas (letterbox bar): only real touches, and only as a stick. */
  private onDownOutside(ptr: Phaser.Input.Pointer): void {
    if (ptr.wasTouch) this.onDown(ptr, []);
  }

  private onUp(ptr: Phaser.Input.Pointer): void {
    this.release(ptr.id);
  }

  private release(id: number): void {
    const t = this.g.touch;
    if (this.move.ptr === id) {
      this.move.ptr = -1;
      this.move.mag = 0;
      t.mx = t.my = 0;
    }
    if (this.aim.ptr === id) {
      // the aim direction stays where it was; only firing stops
      this.aim.ptr = -1;
      this.aim.mag = 0;
      t.aiming = false;
      t.fire = false;
    }
    for (const b of this.btns) if (b.ptr === id) b.ptr = -1;
  }

  // ---------------------------------------------------------------- frame

  update(dt: number): void {
    if (!this.enabled) return;
    if (this.blocked()) this.releaseAll();
    const pointers = this.ui.input.manager.pointers;
    // drop any touch the browser lost without telling us (cancelled, left the window...)
    for (const id of [this.move.ptr, this.aim.ptr, ...this.btns.map((b) => b.ptr)]) {
      if (id >= 0 && !pointers[id]?.isDown) this.release(id);
    }
    const t = this.g.touch;

    // move stick: analog, and the base follows the thumb if it slides past the rim
    const m = this.move;
    if (m.ptr >= 0) {
      const p = pointers[m.ptr];
      this.trackStick(m, p.x, p.y, true);
      const k = m.mag <= MOVE_DEAD ? 0 : (m.mag - MOVE_DEAD) / (1 - MOVE_DEAD);
      t.mx = Math.cos(m.ang) * k;
      t.my = Math.sin(m.ang) * k;
    }

    // aim stick: direction past the dead zone, fire past the threshold
    const a = this.aim;
    if (a.ptr >= 0) {
      const p = pointers[a.ptr];
      this.trackStick(a, p.x, p.y, false);
      t.aiming = a.mag > AIM_DEAD;
      if (t.aiming) t.aimAng = a.ang;
      t.fire = a.mag > AIM_FIRE;
    }

    for (const b of this.btns) b.flash = Math.max(0, b.flash - dt * 5);
    this.draw();
  }

  private trackStick(s: Stick, x: number, y: number, follow: boolean): void {
    let dx = x - s.bx;
    let dy = y - s.by;
    let d = Math.hypot(dx, dy);
    if (follow && d > STICK_R) {
      s.bx = x - (dx / d) * STICK_R;
      s.by = y - (dy / d) * STICK_R;
      dx = x - s.bx;
      dy = y - s.by;
      d = STICK_R;
    }
    const cl = Math.min(d, STICK_R);
    s.ang = Math.atan2(dy, dx);
    s.mag = cl / STICK_R;
    s.kx = s.bx + (d > 0 ? (dx / d) * cl : 0);
    s.ky = s.by + (d > 0 ? (dy / d) * cl : 0);
  }

  // ---------------------------------------------------------------- drawing

  private disc(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, pressed: number, line = CREAM, alpha = 1): void {
    g.fillStyle(INK, 0.5 * alpha).fillCircle(x, y, r);
    if (pressed > 0) g.fillStyle(CREAM, 0.35 * pressed * alpha).fillCircle(x, y, r);
    g.lineStyle(4, INK, 0.6 * alpha).strokeCircle(x, y, r + 2);
    g.lineStyle(3, line, 0.8 * alpha).strokeCircle(x, y, r);
  }

  private draw(): void {
    const g = this.g;
    const p = g.player;
    const L = TOUCH_LAYOUT;
    const hidden = this.blocked() || g.run.over;
    this.root.setAlpha(hidden ? 0 : 1);
    if (hidden) return;

    // ---- sticks
    const sg = this.stickG;
    sg.clear();
    const stick = (s: Stick, hx: number, hy: number, firing: boolean) => {
      if (s.ptr < 0) {
        // a faint resting hint so the player knows where to put a thumb
        sg.lineStyle(3, CREAM, 0.16).strokeCircle(hx, hy, STICK_R);
        sg.fillStyle(CREAM, 0.08).fillCircle(hx, hy, KNOB_R);
        return;
      }
      // a thumb on the letterbox bar beside the canvas puts the base off-screen: draw the stick
      // shifted inside the edge (input still uses the real positions)
      const ox = Math.max(0, STICK_R - s.bx) - Math.max(0, s.bx + STICK_R - GW);
      const oy = Math.max(0, STICK_R - s.by) - Math.max(0, s.by + STICK_R - GH);
      const bx = s.bx + ox;
      const by = s.by + oy;
      const kx = s.kx + ox;
      const ky = s.ky + oy;
      sg.fillStyle(INK, 0.32).fillCircle(bx, by, STICK_R);
      sg.lineStyle(3, CREAM, 0.5).strokeCircle(bx, by, STICK_R);
      if (s === this.aim) {
        // fire threshold ring
        sg.lineStyle(2, CREAM, 0.22).strokeCircle(bx, by, STICK_R * AIM_FIRE);
      }
      sg.fillStyle(INK, 0.6).fillCircle(kx, ky, KNOB_R);
      sg.lineStyle(4, firing ? RED : CREAM, 0.9).strokeCircle(kx, ky, KNOB_R);
      if (s.mag > 0.05) {
        const ca = Math.cos(s.ang);
        const sa = Math.sin(s.ang);
        const r0 = KNOB_R * 0.35;
        const r1 = KNOB_R * 0.7;
        sg.lineStyle(6, firing ? RED : CREAM, 0.85).lineBetween(kx + ca * r0, ky + sa * r0, kx + ca * r1, ky + sa * r1);
      }
    };
    stick(this.move, L.moveHint.x, L.moveHint.y, false);
    stick(this.aim, L.aimHint.x, L.aimHint.y, g.touch.fire);

    // ---- buttons
    for (const b of this.btns) {
      const pressed = b.ptr >= 0 ? 1 : b.flash;
      const bg = b.g;
      bg.clear();
      if (b.id === 'weapon') {
        // the HUD draws the panel; just light it on a tap
        if (pressed > 0) {
          const r = L.weapon;
          bg.fillStyle(CREAM, 0.22 * pressed).fillRoundedRect(r.x, r.y, r.w, r.h, 10);
        }
        continue;
      }
      const vis = this.visible(b.id);
      bg.setVisible(vis);
      b.text?.setVisible(vis);
      b.sub?.setVisible(vis);
      if (!vis) continue;
      const d: Disc = L[b.id];
      let line = CREAM;
      if (b.id === 'interact') line = GOLD;
      if (b.id === 'blast' && p.blanks <= 0) line = 0x6b6055;
      this.disc(bg, d.x, d.y, d.r, pressed, line, b.id === 'blast' && p.blanks <= 0 ? 0.6 : 1);
      if (b.id === 'roll') this.rollIcon(bg, d.x, d.y - 26, pressed);
      if (b.id === 'pause') {
        bg.fillStyle(CREAM, 0.95).fillRect(d.x - 17, d.y - 22, 11, 44).fillRect(d.x + 6, d.y - 22, 11, 44);
      }
    }

    // ---- live labels
    if (p.blanks !== this.lastBlanks) {
      this.lastBlanks = p.blanks;
      this.btn('blast').text!.setText(String(p.blanks)).setColor(p.blanks > 0 ? '#f3e6c8' : '#a3978a');
    }
    if (g.interactTarget) {
      const info = g.pickups.info(g.interactTarget);
      // "TAKE (the other vanishes)" -> "TAKE"; two words go on two lines
      let lab = info.action.replace(/\s*\(.*\)\s*/, '');
      if (lab.length > 7) lab = lab.split(' ').join('\n');
      const afford = info.price <= g.run.coins;
      const state = `${lab}|${afford}`;
      if (state !== this.lastState) {
        this.lastState = state;
        this.interactLabel = lab;
        this.btn('interact').text!.setText(this.interactLabel).setColor(afford ? '#f3e6c8' : '#d8452f')
          .setLineSpacing(-8).setFontSize(lab.includes('\n') ? 36 : 40);
      }
    }

    // ---- reload: progress ring around the RELOAD button, gold perfect window, gold rim inside it
    const rg = this.ringG;
    rg.clear();
    const rl = L.reload;
    const rb = this.btn('reload');
    if (p.reloading) {
      const f = clamp(p.reloadT / p.reloadDur, 0, 1);
      const rr = rl.r + 16;
      const a0 = -Math.PI / 2;
      rg.lineStyle(14, INK, 0.85).beginPath().arc(rl.x, rl.y, rr, 0, Math.PI * 2).strokePath();
      const inWindow = !p.reloadTried && f >= PERFECT_START && f <= PERFECT_END;
      if (!p.reloadTried) {
        rg.lineStyle(10, GOLD, 1).beginPath()
          .arc(rl.x, rl.y, rr, a0 + PERFECT_START * Math.PI * 2, a0 + PERFECT_END * Math.PI * 2).strokePath();
      }
      rg.lineStyle(5, CREAM, 1).beginPath().arc(rl.x, rl.y, rr, a0, a0 + f * Math.PI * 2).strokePath();
      const ha = a0 + f * Math.PI * 2;
      rg.fillStyle(0xffffff, 1).fillCircle(rl.x + Math.cos(ha) * rr, rl.y + Math.sin(ha) * rr, 8);
      if (inWindow) {
        rg.lineStyle(6, GOLD, 1).strokeCircle(rl.x, rl.y, rl.r);
        rg.fillStyle(GOLD, 0.25).fillCircle(rl.x, rl.y, rl.r);
      }
      rb.text!.setText(p.reloadTried ? 'RELOAD' : 'TAP!').setColor(inWindow ? '#e8c05a' : '#f3e6c8');
    } else {
      rb.text!.setText('RELOAD').setColor(p.weapon.clip === 0 ? '#d8452f' : '#f3e6c8');
    }
  }

  /** A curved arrow: the roll icon. */
  private rollIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, pressed: number): void {
    const r = 30;
    const col = pressed > 0.5 ? INK : CREAM;
    const a0 = Math.PI * 0.95;
    const a1 = Math.PI * 2.15;
    g.lineStyle(10, INK, 0.6).beginPath().arc(x, y, r, a0, a1).strokePath();
    g.lineStyle(6, col, 0.95).beginPath().arc(x, y, r, a0, a1).strokePath();
    const ex = x + Math.cos(a1) * r;
    const ey = y + Math.sin(a1) * r;
    // arrowhead pointing along the arc
    const ta = a1 + Math.PI / 2;
    const s = 15;
    g.fillStyle(col, 0.95).fillTriangle(
      ex + Math.cos(ta) * s, ey + Math.sin(ta) * s,
      ex + Math.cos(ta + 2.3) * s, ey + Math.sin(ta + 2.3) * s,
      ex + Math.cos(ta - 2.3) * s, ey + Math.sin(ta - 2.3) * s,
    );
  }
}
