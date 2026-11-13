import Phaser from 'phaser';
import { FONT } from '../config';
import { audio } from '../core/audio';

export const CREAM = '#f3e6c8';
export const DIM = '#a3978a';
export const GOLD = '#e8c05a';
export const RED = '#d8452f';

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

export function makeButton(
  scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void,
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
  draw();
  c.setSize(w, h).setInteractive();
  c.on('pointerover', () => {
    over = true;
    draw();
    audio.play('hover');
    scene.tweens.add({ targets: c, scale: 1.04, duration: 90, ease: 'Quad.easeOut' });
  });
  c.on('pointerout', () => {
    over = false;
    draw();
    scene.tweens.add({ targets: c, scale: 1, duration: 90, ease: 'Quad.easeOut' });
  });
  c.on('pointerdown', () => {
    audio.unlock();
    audio.play('click');
    onClick();
  });
  return { c, setLabel: (s) => t.setText(s) };
}

/** "LABEL  <  80%  >" style setting row. */
export function makeStepper(
  scene: Phaser.Scene, x: number, y: number, name: string, get: () => number, set: (v: number) => void,
): Phaser.GameObjects.Container {
  const nameT = label(scene, -150, 0, name, 24, DIM, '500', 2).setOrigin(0, 0.5);
  const valT = label(scene, 110, 0, '', 26, CREAM, '500');
  const fmt = () => valT.setText(`${Math.round(get() * 100)}%`);
  fmt();
  const arrow = (dx: number, dir: number) => {
    const a = label(scene, dx, -1, dir < 0 ? '<' : '>', 30, CREAM, '700');
    a.setInteractive({ useHandCursor: false }).setPadding(14, 8, 14, 8);
    a.on('pointerover', () => a.setColor(GOLD));
    a.on('pointerout', () => a.setColor(CREAM));
    a.on('pointerdown', () => {
      audio.unlock();
      set(Phaser.Math.Clamp(Math.round((get() + dir * 0.1) * 10) / 10, 0, 1));
      fmt();
      audio.play('click');
    });
    return a;
  };
  return scene.add.container(x, y, [nameT, valT, arrow(50, -1), arrow(170, 1)]);
}
