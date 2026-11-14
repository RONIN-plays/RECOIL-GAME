import Phaser from 'phaser';
import { FONT } from '../config';
import { audio } from '../core/audio';

export const CREAM = '#f3e6c8';
export const DIM = '#a3978a';
export const GOLD = '#e8c05a';
export const RED = '#d8452f';

/** How long a tapped control stays highlighted on a touch screen (there is no hover to clear it). */
const TAP_FLASH_MS = 140;

export function label(
  scene: Phaser.Scene, x: number, y: number, text: string, size: number, color = CREAM, weight = '500', spacing = 0,
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: weight, color }).setOrigin(0.5);
  if (spacing) t.setLetterSpacing(spacing);
  return t;
}

export interface Button {
  c: Phaser.GameObjects.Container;
  setLabel: (s: string) => void;
}

/** Clears a highlight shortly after a tap, since touch screens never send a hover-out. */
function afterTap(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject, fn: () => void): void {
  scene.time.delayedCall(TAP_FLASH_MS, () => {
    if (target.active) fn();
  });
}

export function makeButton(
  scene: Phaser.Scene, x: number, y: number, text: string, onClick: (pointer: Phaser.Input.Pointer) => void,
  o: { w?: number; h?: number; primary?: boolean; size?: number } = {},
): Button {
  const w = o.w ?? 380;
  const h = o.h ?? 68;
  const g = scene.add.graphics();
  const t = label(scene, 0, -1, text, o.size ?? 30, CREAM, '500', 3);
  const c = scene.add.container(x, y, [g, t]);
  let over = false;
  const draw = () => {
    g.clear();
    if (over) {
      g.fillStyle(0xf3e6c8, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 6);
      t.setColor('#17120f');
    } else {
      g.fillStyle(o.primary ? 0x8f2a1c : 0x1c1917, 0.94).fillRoundedRect(-w / 2, -h / 2, w, h, 6);
      g.lineStyle(2, o.primary ? 0xd8452f : 0x6b6055, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
      t.setColor(CREAM);
    }
  };
  const unhover = () => {
    over = false;
    draw();
    scene.tweens.add({ targets: c, scale: 1, duration: 90, ease: 'Quad.easeOut' });
  };
  draw();
  c.setSize(w, h).setInteractive();
  c.on('pointerover', (p: Phaser.Input.Pointer) => {
    over = true;
    draw();
    if (!p.wasTouch) audio.play('hover');
    scene.tweens.add({ targets: c, scale: 1.04, duration: 90, ease: 'Quad.easeOut' });
  });
  c.on('pointerout', unhover);
  c.on('pointerdown', (p: Phaser.Input.Pointer) => {
    audio.unlock();
    audio.play('click');
    if (p.wasTouch) afterTap(scene, c, unhover);
    onClick(p);
  });
  return { c, setLabel: (s) => t.setText(s) };
}

/** "LABEL  <  80%  >" style setting row. Pass `{ touch: true }` for large, boxed tap targets. */
export function makeStepper(
  scene: Phaser.Scene, x: number, y: number, name: string, get: () => number, set: (v: number) => void,
  o: { touch?: boolean } = {},
): Phaser.GameObjects.Container {
  const touch = !!o.touch;
  const nameT = label(scene, touch ? -330 : -150, 0, name, touch ? 40 : 24, DIM, '500', 2).setOrigin(0, 0.5);
  const valT = label(scene, touch ? 290 : 110, 0, '', touch ? 44 : 26, CREAM, '500');
  const fmt = () => valT.setText(`${Math.round(get() * 100)}%`);
  fmt();
  const step = (dir: number) => {
    audio.unlock();
    set(Phaser.Math.Clamp(Math.round((get() + dir * 0.1) * 10) / 10, 0, 1));
    fmt();
    audio.play('click');
  };
  const arrow = (dx: number, dir: number): Phaser.GameObjects.GameObject => {
    const glyph = dir < 0 ? '<' : '>';
    if (!touch) {
      const a = label(scene, dx, -1, glyph, 30, CREAM, '700');
      a.setInteractive({ useHandCursor: false }).setPadding(14, 8, 14, 8);
      a.on('pointerover', () => a.setColor(GOLD));
      a.on('pointerout', () => a.setColor(CREAM));
      a.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.wasTouch) afterTap(scene, a, () => a.setColor(CREAM));
        step(dir);
      });
      return a;
    }
    // touch: a 150px boxed button
    const s = 150;
    const g = scene.add.graphics();
    const t = label(scene, 0, -3, glyph, 64, CREAM, '700');
    const box = scene.add.container(dx, 0, [g, t]);
    const draw = (lit: boolean) => {
      g.clear();
      g.fillStyle(lit ? 0xf3e6c8 : 0x1c1917, lit ? 1 : 0.94).fillRoundedRect(-s / 2, -s / 2, s, s, 8);
      if (!lit) g.lineStyle(2, 0x6b6055, 1).strokeRoundedRect(-s / 2, -s / 2, s, s, 8);
      t.setColor(lit ? '#17120f' : CREAM);
    };
    draw(false);
    box.setSize(s, s).setInteractive();
    box.on('pointerout', () => draw(false));
    box.on('pointerdown', () => {
      draw(true);
      afterTap(scene, box, () => draw(false));
      step(dir);
    });
    return box;
  };
  return scene.add.container(x, y, [nameT, valT, arrow(touch ? 140 : 50, -1), arrow(touch ? 440 : 170, 1)]);
}
