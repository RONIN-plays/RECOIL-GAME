import Phaser from 'phaser';
import { GH, GW } from '../config';
import { type Ctx, INK, circle, ell, limb, line, poly, radial, rgba, rrect, shade, steel, wood } from './draw';

/**
 * Every sprite in the game is drawn here with canvas 2D at boot.
 * All characters face right (+x) and are seen from directly above.
 */

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const t = scene.textures.createCanvas(key, Math.ceil(w), Math.ceil(h))!;
  const c = t.getContext();
  c.imageSmoothingEnabled = true;
  draw(c);
  t.refresh();
}

const SKIN = '#e2b48c';

// ------------------------------------------------------------------ weapons

export function drawWeapon(c: Ctx, id: string, s = 1): void {
  c.save();
  c.scale(s, s);
  const y = 16;
  switch (id) {
    case 'pistol':
      steel(c, 18, y - 4.5, 24, 9, '#454952');
      steel(c, 38, y - 2.5, 6, 5, '#2a2c32');
      break;
    case 'revolver':
      wood(c, 11, y - 4, 9, 8, '#7d5230');
      steel(c, 26, y - 3, 26, 6, '#555a64');
      circle(c, 26, y, 7, '#6a707b', INK, 2);
      circle(c, 26, y, 2, '#2a2c32');
      break;
    case 'smg':
      steel(c, 26, y + 4, 7, 9, '#2a2c32');
      steel(c, 13, y - 5.5, 32, 11, '#3d4047');
      steel(c, 45, y - 2.5, 9, 5, '#26282d');
      break;
    case 'shotgun':
      wood(c, 3, y - 4, 14, 8, '#7d5230');
      steel(c, 16, y - 3.5, 54, 7, '#3b3e46');
      wood(c, 40, y - 5, 17, 10, '#8f6034');
      break;
    case 'rifle':
      wood(c, 1, y - 4, 13, 8, '#4d5340');
      steel(c, 29, y + 3, 8, 10, '#2a2c32');
      steel(c, 12, y - 5, 40, 10, '#40444c');
      steel(c, 52, y - 2.5, 20, 5, '#2a2c32');
      break;
    case 'burst':
      wood(c, 1, y - 4, 13, 8, '#a08458');
      steel(c, 29, y + 3, 7, 8, '#2a2c32');
      steel(c, 12, y - 5, 36, 10, '#5a5548');
      wood(c, 36, y - 5.5, 14, 11, '#a08458');
      steel(c, 50, y - 2.5, 18, 5, '#2a2c32');
      break;
    case 'twin':
      wood(c, 2, y - 5, 16, 10, '#7d5230');
      steel(c, 16, y - 6.5, 46, 6, '#3b3e46');
      steel(c, 16, y + 0.5, 46, 6, '#3b3e46');
      wood(c, 26, y - 7.5, 12, 15, '#8f6034');
      break;
    case 'sniper':
      wood(c, 0, y - 4, 15, 8, '#6a4526');
      steel(c, 13, y - 4.5, 30, 9, '#3b3e46');
      steel(c, 43, y - 2, 46, 4, '#26282d');
      steel(c, 26, y - 9, 22, 5, '#22242a');
      circle(c, 48, y - 6.5, 2.2, '#b9472f');
      steel(c, 86, y - 3.5, 7, 7, '#26282d');
      break;
    case 'launcher':
      wood(c, 2, y - 4, 12, 8, '#4d5340');
      steel(c, 12, y - 8, 46, 16, '#56603f', 3);
      circle(c, 30, y, 10.5, '#434b31', INK, 2);
      circle(c, 30, y, 4, '#2c3220');
      steel(c, 55, y - 9, 7, 18, '#2f3524', 2);
      break;
    case 'minigun':
      steel(c, 30, y - 9, 46, 4.5, '#2a2c32');
      steel(c, 30, y - 2.2, 48, 4.5, '#2a2c32');
      steel(c, 30, y + 4.5, 46, 4.5, '#2a2c32');
      steel(c, 8, y - 10, 26, 20, '#474b54', 3);
      steel(c, 58, y - 10.5, 6, 21, '#5a5f69', 2);
      break;
    case 'nail':
      steel(c, 22, y + 5, 12, 9, '#2a2c32');
      rrect(c, 11, y - 8, 34, 16, 3, '#c98a2a', INK, 2);
      c.fillStyle = shade('#c98a2a', 0.3);
      c.fillRect(13, y - 6.5, 30, 3);
      steel(c, 45, y - 4, 10, 8, '#2a2c32');
      break;
  }
  c.restore();
}

export const WEAPON_TEX_W = 96;
export const WEAPON_TEX_H = 32;
/** x of the grip inside the weapon texture; used as the sprite origin. */
export const WEAPON_GRIP_X = 20;

// ------------------------------------------------------------------ characters

function drawPlayer(c: Ctx): void {
  const cx = 40;
  const cy = 40;
  // coat tail
  ell(c, cx - 8, cy, 14, 18, '#22343f', INK, 2.5);
  // scarf, blown back
  poly(c, [cx - 4, cy - 5, cx - 22, cy - 11, cx - 17, cy - 2, cx - 25, cy + 6, cx - 4, cy + 5], '#b3402e', INK, 2);
  // arms
  limb(c, cx + 2, cy - 17, cx + 19, cy - 6, 8, '#30495a');
  limb(c, cx + 2, cy + 17, cx + 19, cy + 6, 8, '#30495a');
  // shoulders
  ell(c, cx, cy, 13.5, 22.5, '#30495a', INK, 2.5);
  ell(c, cx - 2, cy - 9, 7, 8, rgba('#ffffff', 0.08));
  // hands
  circle(c, cx + 20, cy - 6, 4.5, SKIN, INK, 2);
  circle(c, cx + 20, cy + 6, 4.5, SKIN, INK, 2);
  // hat
  circle(c, cx + 1, cy, 15, '#8f6f42', INK, 2.5);
  c.beginPath();
  c.arc(cx + 1, cy, 12.5, Math.PI * 0.9, Math.PI * 1.7);
  c.strokeStyle = rgba('#ffffff', 0.18);
  c.lineWidth = 2;
  c.stroke();
  circle(c, cx + 1, cy, 8.5, '#b9955c', '#4f361f', 3);
  ell(c, cx - 1, cy - 2.5, 3.5, 2.5, rgba('#ffffff', 0.22));
}

interface HumanoidOpts {
  size: number;
  coat: string;
  rx: number;
  ry: number;
  armW: number;
  handX: number;
  handY: number;
  pads?: string;
}

function humanoidBody(c: Ctx, o: HumanoidOpts): void {
  const cx = o.size / 2;
  const cy = o.size / 2;
  limb(c, cx + 2, cy - o.ry + 5, cx + o.handX, cy - o.handY, o.armW, shade(o.coat, -0.12));
  limb(c, cx + 2, cy + o.ry - 5, cx + o.handX, cy + o.handY, o.armW, shade(o.coat, -0.12));
  ell(c, cx, cy, o.rx, o.ry, o.coat, INK, 2.5);
  ell(c, cx - 2, cy - o.ry * 0.4, o.rx * 0.5, o.ry * 0.3, rgba('#ffffff', 0.08));
  if (o.pads) {
    ell(c, cx, cy - o.ry + 4, o.rx * 0.8, 7, o.pads, INK, 2);
    ell(c, cx, cy + o.ry - 4, o.rx * 0.8, 7, o.pads, INK, 2);
  }
  circle(c, cx + o.handX + 1, cy - o.handY, o.armW * 0.52, SKIN, INK, 2);
  circle(c, cx + o.handX + 1, cy + o.handY, o.armW * 0.52, SKIN, INK, 2);
}

function drawGrunt(c: Ctx): void {
  const s = 72;
  const cx = s / 2;
  const cy = s / 2;
  // rifle
  wood(c, cx + 6, cy - 3, 12, 6, '#6a4526');
  steel(c, cx + 16, cy - 2.5, 18, 5, '#33363d');
  humanoidBody(c, { size: s, coat: '#8c4a32', rx: 12.5, ry: 20.5, armW: 7.5, handX: 15, handY: 4 });
  // bandana tail
  poly(c, [cx - 6, cy - 3, cx - 17, cy - 6, cx - 14, cy + 1, cx - 18, cy + 5, cx - 6, cy + 3], '#c9b28a', INK, 2);
  // flat cap
  circle(c, cx + 1, cy, 10, '#3a2e2c', INK, 2.5);
  ell(c, cx + 7, cy, 6, 8, '#2c2322', INK, 2);
  ell(c, cx - 1, cy - 3, 4, 3, rgba('#ffffff', 0.1));
}

function drawShotgunner(c: Ctx): void {
  const s = 80;
  const cx = s / 2;
  const cy = s / 2;
  wood(c, cx + 4, cy - 3.5, 12, 7, '#6a4526');
  steel(c, cx + 14, cy - 4, 24, 8, '#2f3238');
  wood(c, cx + 20, cy - 5, 9, 10, '#8f6034');
  humanoidBody(c, { size: s, coat: '#5d6b3a', rx: 15, ry: 24, armW: 9, handX: 17, handY: 5, pads: '#3f4a28' });
  circle(c, cx + 1, cy, 11.5, '#39442a', INK, 2.5);
  c.strokeStyle = '#8a9a5a';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(cx - 9, cy);
  c.lineTo(cx + 11, cy);
  c.stroke();
  ell(c, cx - 2, cy - 4, 4, 3, rgba('#ffffff', 0.12));
}

function drawCharger(c: Ctx): void {
  const s = 96;
  const cx = s / 2;
  const cy = s / 2;
  // fists
  limb(c, cx + 2, cy - 24, cx + 18, cy - 18, 11, '#5a2222');
  limb(c, cx + 2, cy + 24, cx + 18, cy + 18, 11, '#5a2222');
  circle(c, cx + 20, cy - 18, 7, '#70757d', INK, 2.5);
  circle(c, cx + 20, cy + 18, 7, '#70757d', INK, 2.5);
  ell(c, cx - 2, cy, 23, 27, '#6e2b2b', INK, 3);
  ell(c, cx - 4, cy - 10, 10, 9, rgba('#ffffff', 0.07));
  // pauldrons
  ell(c, cx - 1, cy - 23, 13, 9, '#70757d', INK, 2.5);
  ell(c, cx - 1, cy + 23, 13, 9, '#70757d', INK, 2.5);
  ell(c, cx - 3, cy - 25, 6, 3, rgba('#ffffff', 0.2));
  ell(c, cx - 3, cy + 21, 6, 3, rgba('#ffffff', 0.2));
  // horns
  poly(c, [cx + 4, cy - 12, cx + 34, cy - 17, cx + 12, cy - 3], '#e8dcc0', INK, 2.5);
  poly(c, [cx + 4, cy + 12, cx + 34, cy + 17, cx + 12, cy + 3], '#e8dcc0', INK, 2.5);
  // helmet
  circle(c, cx + 2, cy, 13.5, '#4a4d55', INK, 2.5);
  line(c, cx - 11, cy, cx + 15, cy, '#2c2e33', 3);
  ell(c, cx - 2, cy - 5, 5, 3.5, rgba('#ffffff', 0.16));
}

function drawSwarmer(c: Ctx): void {
  const cx = 20;
  const cy = 20;
  c.strokeStyle = INK;
  c.lineWidth = 2;
  for (const lx of [-6, 0, 6]) {
    c.beginPath();
    c.moveTo(cx + lx, cy - 6);
    c.lineTo(cx + lx - 3, cy - 14);
    c.moveTo(cx + lx, cy + 6);
    c.lineTo(cx + lx - 3, cy + 14);
    c.stroke();
  }
  line(c, cx - 10, cy, cx - 18, cy + 3, INK, 2.5);
  ell(c, cx - 2, cy, 11, 8, '#4a3a4f', INK, 2.5);
  ell(c, cx - 4, cy - 2.5, 5, 2.5, rgba('#ffffff', 0.14));
  circle(c, cx + 9, cy, 6.5, '#33283a', INK, 2.5);
  circle(c, cx + 12, cy - 3, 1.8, '#ffb070');
  circle(c, cx + 12, cy + 3, 1.8, '#ffb070');
}

function drawSniper(c: Ctx): void {
  const w = 104;
  const h = 72;
  const cx = 36;
  const cy = h / 2;
  // long rifle
  wood(c, cx + 4, cy - 3, 12, 6, '#6a4526');
  steel(c, cx + 14, cy - 2.5, 20, 5, '#3b3e46');
  steel(c, cx + 34, cy - 1.5, 30, 3, '#26282d');
  steel(c, cx + 18, cy - 6.5, 12, 4, '#22242a');
  // cape
  poly(c, [cx - 2, cy - 14, cx - 26, cy - 9, cx - 20, cy, cx - 28, cy + 10, cx - 2, cy + 14], '#463f5a', INK, 2.5);
  limb(c, cx + 2, cy - 13, cx + 15, cy - 3, 6.5, '#4c4562');
  limb(c, cx + 2, cy + 13, cx + 22, cy + 3, 6.5, '#4c4562');
  ell(c, cx, cy, 11, 17.5, '#5b5470', INK, 2.5);
  circle(c, cx + 16, cy - 3, 3.6, SKIN, INK, 2);
  circle(c, cx + 23, cy + 3, 3.6, SKIN, INK, 2);
  // hood
  poly(c, [cx - 12, cy, cx - 3, cy - 9.5, cx + 9, cy - 8, cx + 12, cy, cx + 9, cy + 8, cx - 3, cy + 9.5], '#3a3350', INK, 2.5);
  circle(c, cx + 8, cy, 2, '#d8452f');
  void w;
}

function drawGrenadier(c: Ctx): void {
  const s = 80;
  const cx = s / 2;
  const cy = s / 2;
  steel(c, cx + 8, cy - 6.5, 26, 13, '#4d5340', 3);
  steel(c, cx + 31, cy - 7.5, 5, 15, '#2f3524', 2);
  humanoidBody(c, { size: s, coat: '#b08a2e', rx: 14, ry: 22, armW: 8.5, handX: 15, handY: 6 });
  // bandolier
  c.save();
  c.beginPath();
  c.ellipse(cx, cy, 14, 22, 0, 0, Math.PI * 2);
  c.clip();
  line(c, cx - 12, cy - 22, cx + 12, cy + 22, '#4a3520', 6);
  for (let i = -2; i <= 2; i++) circle(c, cx + i * 4.2, cy + i * 7.7, 2, '#d9c07a');
  c.restore();
  // head with goggles
  circle(c, cx + 1, cy, 10.5, '#5c4a2e', INK, 2.5);
  circle(c, cx + 8, cy - 4, 3.6, '#a7d4d8', INK, 2);
  circle(c, cx + 8, cy + 4, 3.6, '#a7d4d8', INK, 2);
  line(c, cx - 9, cy, cx + 5, cy, '#33291a', 2.5);
}

function drawTurretBase(c: Ctx): void {
  const cx = 36;
  const cy = 36;
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    pts.push(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30);
  }
  poly(c, pts, '#3e4148', INK, 3);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    circle(c, cx + Math.cos(a) * 23, cy + Math.sin(a) * 23, 2.2, '#8a8f99', INK, 1);
  }
  circle(c, cx, cy, 17, '#2c2e33', INK, 2.5);
}

function drawTurretHead(c: Ctx): void {
  const cx = 30;
  const cy = 28;
  steel(c, cx + 6, cy - 9.5, 30, 6.5, '#2a2c32');
  steel(c, cx + 6, cy + 3, 30, 6.5, '#2a2c32');
  circle(c, cx, cy, 16, '#5a5f69', INK, 2.5);
  ell(c, cx - 4, cy - 6, 7, 4, rgba('#ffffff', 0.2));
  circle(c, cx + 6, cy, 4.5, '#2a1412', INK, 2);
  circle(c, cx + 6, cy, 2.4, '#ff6a3c');
}

function drawHeavy(c: Ctx): void {
  const s = 104;
  const cx = s / 2;
  const cy = s / 2;
  // minigun on the right side
  steel(c, cx + 8, cy + 9, 36, 4, '#2a2c32');
  steel(c, cx + 8, cy + 15, 38, 4, '#2a2c32');
  steel(c, cx + 8, cy + 21, 36, 4, '#2a2c32');
  steel(c, cx - 2, cy + 6, 16, 22, '#474b54', 3);
  limb(c, cx, cy - 26, cx + 14, cy - 14, 12, '#59606a');
  ell(c, cx - 2, cy, 23, 30, '#6f7782', INK, 3);
  // plates
  ell(c, cx - 2, cy - 25, 14, 9, '#8a93a0', INK, 2.5);
  ell(c, cx - 2, cy + 25, 14, 9, '#8a93a0', INK, 2.5);
  rrect(c, cx - 16, cy - 9, 12, 18, 3, '#59606a', INK, 2);
  ell(c, cx - 5, cy - 27, 6, 3, rgba('#ffffff', 0.22));
  // helmet with visor
  circle(c, cx + 3, cy, 13.5, '#555c66', INK, 2.5);
  rrect(c, cx + 9, cy - 7, 5, 14, 2, '#ff9a4a', INK, 1.5);
  ell(c, cx - 1, cy - 5, 5, 3.5, rgba('#ffffff', 0.2));
}

function drawShield(c: Ctx): void {
  const cx = 52;
  const cy = 52;
  c.lineCap = 'round';
  c.beginPath();
  c.arc(cx, cy, 44, -1.05, 1.05);
  c.strokeStyle = INK;
  c.lineWidth = 13;
  c.stroke();
  c.beginPath();
  c.arc(cx, cy, 44, -1.05, 1.05);
  c.strokeStyle = '#93a0b2';
  c.lineWidth = 8.5;
  c.stroke();
  c.beginPath();
  c.arc(cx, cy, 46, -0.95, 0.95);
  c.strokeStyle = rgba('#ffffff', 0.35);
  c.lineWidth = 2;
  c.stroke();
  for (const a of [-0.8, -0.4, 0, 0.4, 0.8]) circle(c, cx + Math.cos(a) * 44, cy + Math.sin(a) * 44, 1.8, '#4e5866');
  c.lineCap = 'butt';
}

function drawDrone(c: Ctx): void {
  const cx = 32;
  const cy = 32;
  for (let i = 0; i < 4; i++) {
    c.save();
    c.translate(cx, cy);
    c.rotate((i * Math.PI) / 2);
    steel(c, 14, -4, 14, 8, '#2f3238');
    c.restore();
  }
  const pts: number[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = i % 2 === 0 ? 20 : 16.5;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  poly(c, pts, '#a8793a', INK, 2.5);
  circle(c, cx, cy, 12, '#c79a55', INK, 2);
  ell(c, cx - 4, cy - 5, 5, 3, rgba('#ffffff', 0.25));
  circle(c, cx, cy, 6, '#2a1412', INK, 2);
  circle(c, cx, cy, 3, '#ff6a3c');
}

// ------------------------------------------------------------------ bosses

function drawWarden(c: Ctx): void {
  const s = 208;
  const cx = s / 2;
  const cy = s / 2;
  // cannons
  for (const sgn of [-1, 1]) {
    const yy = cy + sgn * 46;
    limb(c, cx - 4, yy + sgn * 6, cx + 26, yy, 24, '#2c333d');
    rrect(c, cx + 20, yy - 13, 56, 26, 5, '#1f2228', INK, 3);
    rrect(c, cx + 30, yy - 15, 8, 30, 3, '#4c5562', INK, 2.5);
    rrect(c, cx + 56, yy - 15, 8, 30, 3, '#4c5562', INK, 2.5);
    rrect(c, cx + 72, yy - 11, 8, 22, 3, '#0f1114', INK, 2.5);
    c.fillStyle = rgba('#ffffff', 0.12);
    c.fillRect(cx + 22, yy - 10, 50, 4);
  }
  // body
  ell(c, cx - 8, cy, 44, 62, '#39424f', INK, 4);
  ell(c, cx - 16, cy - 22, 18, 22, rgba('#ffffff', 0.05));
  // belt and chains
  line(c, cx - 30, cy - 46, cx - 30, cy + 46, '#1f2228', 7);
  for (let i = -3; i <= 3; i++) circle(c, cx - 30, cy + i * 13, 4, '#a8793a', INK, 2);
  // spiked pauldrons
  for (const sgn of [-1, 1]) {
    const yy = cy + sgn * 50;
    for (const a of [-0.9, -0.3, 0.3, 0.9]) {
      const ax = cx - 6 + Math.sin(a) * 24;
      const ay = yy + sgn * (10 + Math.cos(a) * 6);
      poly(c, [ax - 6, ay - sgn * 4, ax + 6, ay - sgn * 4, ax, ay + sgn * 16], '#e8dcc0', INK, 2.5);
    }
    ell(c, cx - 6, yy, 30, 18, '#5b6675', INK, 3.5);
    ell(c, cx - 12, yy - 5, 14, 5, rgba('#ffffff', 0.18));
  }
  // helmet
  circle(c, cx, cy, 27, '#2a3038', INK, 4);
  line(c, cx - 24, cy, cx + 12, cy, '#4c5562', 5);
  rrect(c, cx + 12, cy - 15, 9, 30, 3, '#ffab52', INK, 2.5);
  c.fillStyle = '#fff3c8';
  c.fillRect(cx + 15, cy - 11, 3, 22);
  ell(c, cx - 8, cy - 11, 9, 6, rgba('#ffffff', 0.14));
}

function drawFurnace(c: Ctx): void {
  const s = 228;
  const cx = s / 2;
  const cy = s / 2;
  // treads
  for (const sgn of [-1, 1]) {
    rrect(c, cx - 76, cy + sgn * 78 - 18, 152, 36, 10, '#1c1d21', INK, 4);
    for (let i = 0; i < 11; i++) line(c, cx - 68 + i * 13.6, cy + sgn * 78 - 15, cx - 68 + i * 13.6, cy + sgn * 78 + 15, '#3a3c42', 4);
  }
  // hull
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    pts.push(cx + Math.cos(a) * 84, cy + Math.sin(a) * 80);
  }
  poly(c, pts, '#3a3c42', INK, 4.5);
  const inner: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    inner.push(cx + Math.cos(a) * 66, cy + Math.sin(a) * 62);
  }
  poly(c, inner, '#6b4630', INK, 3);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    circle(c, cx + Math.cos(a) * 75, cy + Math.sin(a) * 71, 3.6, '#9aa0aa', INK, 1.5);
  }
  // exhaust pipes
  for (const [ox, oy] of [[-44, -40], [-44, 40]]) {
    circle(c, cx + ox, cy + oy, 13, '#26272c', INK, 3);
    circle(c, cx + ox, cy + oy, 7, '#0c0c0e');
  }
  // front cannon
  rrect(c, cx + 46, cy - 17, 52, 34, 6, '#1f2228', INK, 3.5);
  rrect(c, cx + 88, cy - 20, 12, 40, 4, '#4c5562', INK, 3);
  // ember core
  circle(c, cx, cy, 36, '#1c1210', INK, 4);
  c.save();
  c.beginPath();
  c.arc(cx, cy, 31, 0, Math.PI * 2);
  c.clip();
  radial(c, cx, cy, 32, [[0, '#fff3c0'], [0.35, '#ffb24a'], [0.75, '#d2551f'], [1, '#6a1f0c']]);
  c.restore();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    line(c, cx + Math.cos(a) * 12, cy + Math.sin(a) * 12, cx + Math.cos(a) * 33, cy + Math.sin(a) * 33, '#1c1210', 5);
  }
  circle(c, cx, cy, 11, '#2a1a14', INK, 3);
}

function drawMagistrate(c: Ctx): void {
  const s = 168;
  const cx = s / 2;
  const cy = s / 2;
  // cape
  poly(c, [cx - 6, cy - 34, cx - 58, cy - 26, cx - 46, cy - 6, cx - 62, cy + 8, cx - 44, cy + 26, cx - 6, cy + 34], '#1c2233', INK, 3.5);
  line(c, cx - 50, cy - 24, cx - 12, cy - 30, '#c9a44c', 2.5);
  line(c, cx - 40, cy + 24, cx - 12, cy + 30, '#c9a44c', 2.5);
  // pistols
  for (const sgn of [-1, 1]) {
    const yy = cy + sgn * 24;
    limb(c, cx + 2, cy + sgn * 30, cx + 30, yy, 11, '#d6ccb4');
    steel(c, cx + 30, yy - 4, 34, 8, '#2a2c32');
    rrect(c, cx + 34, yy - 5.5, 10, 11, 2, '#c9a44c', INK, 2);
    circle(c, cx + 31, yy, 6, '#3a3024', INK, 2.5);
  }
  // robe
  ell(c, cx - 2, cy, 27, 40, '#e6dcc6', INK, 3.5);
  line(c, cx - 2, cy - 36, cx - 2, cy + 36, '#c9a44c', 4);
  ell(c, cx - 10, cy - 14, 9, 13, rgba('#ffffff', 0.25));
  // epaulettes
  for (const sgn of [-1, 1]) {
    ell(c, cx - 2, cy + sgn * 34, 17, 10, '#c9a44c', INK, 3);
    ell(c, cx - 5, cy + sgn * 34 - 3, 8, 3, rgba('#ffffff', 0.35));
  }
  // hood and mask
  poly(c, [cx - 20, cy, cx - 6, cy - 16, cx + 12, cy - 14, cx + 19, cy, cx + 12, cy + 14, cx - 6, cy + 16], '#161b28', INK, 3.5);
  ell(c, cx + 9, cy, 6, 9, '#dcb95a', INK, 2.5);
  line(c, cx + 8, cy - 4, cx + 12, cy - 4, INK, 2);
  line(c, cx + 8, cy + 4, cx + 12, cy + 4, INK, 2);
}

// ------------------------------------------------------------------ props, pickups

function drawCrate(c: Ctx): void {
  const s = 64;
  rrect(c, 4, 4, s - 8, s - 8, 4, '#8a6238', INK, 3);
  c.save();
  c.beginPath();
  c.rect(6, 6, s - 12, s - 12);
  c.clip();
  for (let i = 1; i < 4; i++) line(c, 4, 4 + i * 14, s - 4, 4 + i * 14, '#5e4124', 2);
  for (let i = 0; i < 30; i++) {
    c.fillStyle = rgba('#3a2814', 0.12);
    c.fillRect(8 + Math.random() * 46, 8 + Math.random() * 46, 6 + Math.random() * 8, 1);
  }
  c.restore();
  rrect(c, 4, 4, s - 8, 9, 2, '#a57a48', INK, 2.5);
  rrect(c, 4, s - 13, s - 8, 9, 2, '#a57a48', INK, 2.5);
  rrect(c, 4, 4, 9, s - 8, 2, '#a57a48', INK, 2.5);
  rrect(c, s - 13, 4, 9, s - 8, 2, '#a57a48', INK, 2.5);
  c.save();
  c.translate(s / 2, s / 2);
  c.rotate(Math.PI / 4);
  rrect(c, -27, -4.5, 54, 9, 2, '#a57a48', INK, 2.5);
  c.restore();
  for (const [x, y] of [[9, 9], [s - 9, 9], [9, s - 9], [s - 9, s - 9]]) circle(c, x, y, 1.8, '#3c2a16');
  c.fillStyle = rgba('#ffffff', 0.12);
  c.fillRect(6, 6, s - 12, 2);
}

function drawBarrel(c: Ctx): void {
  const cx = 30;
  const cy = 30;
  circle(c, cx, cy, 24, '#9a3324', INK, 3);
  circle(c, cx, cy, 19.5, '#b64431', '#6e2018', 2.5);
  circle(c, cx, cy, 11, undefined, '#6e2018', 2);
  // hazard mark
  poly(c, [cx, cy - 9, cx + 8.5, cy + 6, cx - 8.5, cy + 6], '#f0c040', INK, 2);
  line(c, cx, cy - 4, cx, cy + 1.5, INK, 2.2);
  circle(c, cx, cy + 4, 1.2, INK);
  ell(c, cx - 9, cy - 11, 7, 4, rgba('#ffffff', 0.2), undefined, 0, -0.6);
  circle(c, cx + 13, cy - 13, 3, '#3a3a3e', INK, 1.5);
}

function heartPath(c: Ctx, cx: number, cy: number, s: number): void {
  c.beginPath();
  c.moveTo(cx, cy + s * 0.9);
  c.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.75, cy - s * 1.1, cx, cy - s * 0.35);
  c.bezierCurveTo(cx + s * 0.75, cy - s * 1.1, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.9);
  c.closePath();
}

function drawHeart(c: Ctx, size: number, mode: 'full' | 'half' | 'empty'): void {
  const cx = size / 2;
  const cy = size / 2 + size * 0.02;
  const s = size * 0.4;
  heartPath(c, cx, cy, s);
  c.fillStyle = mode === 'empty' ? 'rgba(20,16,14,0.7)' : '#d8452f';
  c.fill();
  if (mode === 'half') {
    c.save();
    heartPath(c, cx, cy, s);
    c.clip();
    c.fillStyle = 'rgba(20,16,14,0.85)';
    c.fillRect(cx, 0, size, size);
    c.restore();
  }
  if (mode !== 'empty') {
    c.save();
    heartPath(c, cx, cy, s);
    c.clip();
    ell(c, cx - s * 0.42, cy - s * 0.4, s * 0.28, s * 0.18, rgba('#ffffff', 0.5), undefined, 0, -0.5);
    c.restore();
  }
  heartPath(c, cx, cy, s);
  c.strokeStyle = mode === 'empty' ? '#5a4a40' : INK;
  c.lineWidth = Math.max(2, size * 0.07);
  c.lineJoin = 'round';
  c.stroke();
}

function drawCoin(c: Ctx, r: number): void {
  const cx = r + 3;
  circle(c, cx, cx, r, '#e2b23c', INK, 2);
  circle(c, cx, cx, r * 0.62, '#f3cf62', '#a87a1c', 1.5);
  ell(c, cx - r * 0.3, cx - r * 0.35, r * 0.28, r * 0.16, rgba('#ffffff', 0.7), undefined, 0, -0.6);
}

function drawAmmo(c: Ctx): void {
  rrect(c, 4, 8, 40, 30, 4, '#56603f', INK, 2.5);
  rrect(c, 4, 8, 40, 8, 3, '#6f7a52', INK, 2.5);
  for (let i = 0; i < 3; i++) {
    rrect(c, 12 + i * 9, 20, 6, 13, 2.5, '#d9b24a', INK, 1.8);
    c.fillStyle = '#b5622d';
    c.fillRect(13 + i * 9, 21, 4, 4);
  }
}

function drawBlank(c: Ctx, size: number): void {
  const cx = size / 2;
  circle(c, cx, cx, size * 0.4, '#31424f', INK, Math.max(2, size * 0.06));
  circle(c, cx, cx, size * 0.27, '#9fd0e0', '#e8f6fa', 2);
  circle(c, cx, cx, size * 0.11, '#ffffff');
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    line(c, cx + Math.cos(a) * size * 0.3, cx + Math.sin(a) * size * 0.3, cx + Math.cos(a) * size * 0.44, cx + Math.sin(a) * size * 0.44, INK, 3);
  }
}

function drawChest(c: Ctx, open: boolean): void {
  const w = 76;
  const h = 60;
  rrect(c, 5, 8, w - 10, h - 14, 6, open ? '#2a1c10' : '#8a5a2e', INK, 3);
  if (!open) {
    for (let i = 1; i < 4; i++) line(c, 7, 8 + i * 11.5, w - 7, 8 + i * 11.5, '#6a4320', 2);
    c.fillStyle = rgba('#ffffff', 0.12);
    c.fillRect(8, 10, w - 16, 3);
  } else {
    rrect(c, 10, 13, w - 20, h - 24, 3, '#150d07');
    radial(c, w / 2, h / 2, 26, [[0, rgba('#ffd27a', 0.5)], [1, rgba('#ffd27a', 0)]]);
  }
  for (const x of [16, w - 24]) rrect(c, x, 6, 8, h - 10, 2, '#c9a44c', INK, 2.5);
  if (!open) {
    rrect(c, w / 2 - 7, h / 2 - 8, 14, 16, 3, '#e2b23c', INK, 2.5);
    circle(c, w / 2, h / 2 - 1, 2.6, INK);
    c.fillStyle = INK;
    c.fillRect(w / 2 - 1.2, h / 2, 2.4, 5);
  }
}

function drawPedestal(c: Ctx): void {
  circle(c, 40, 40, 34, '#4a4640', INK, 3);
  circle(c, 40, 40, 26, '#6a655c', '#3a3630', 2.5);
  circle(c, 40, 40, 17, '#59544c', '#3a3630', 2);
  c.beginPath();
  c.arc(40, 40, 30, Math.PI * 0.95, Math.PI * 1.55);
  c.strokeStyle = rgba('#ffffff', 0.2);
  c.lineWidth = 2.5;
  c.stroke();
}

function drawStairs(c: Ctx): void {
  const s = 112;
  rrect(c, 6, 6, s - 12, s - 12, 8, '#2a2622', INK, 4);
  rrect(c, 16, 16, s - 32, s - 32, 4, '#0a0908', INK, 3);
  for (let i = 0; i < 5; i++) {
    const t = i / 5;
    c.fillStyle = `rgba(120,104,84,${0.75 - t * 0.6})`;
    c.fillRect(20 + i * 3, 22 + i * 15, s - 40 - i * 6, 9);
  }
  for (const [x, y] of [[13, 13], [s - 13, 13], [13, s - 13], [s - 13, s - 13]]) circle(c, x, y, 3, '#8a8f99', INK, 1.5);
}

function drawDoor(c: Ctx): void {
  // Spans two tiles (128x64), drawn for a north/south door.
  rrect(c, 2, 12, 124, 40, 4, '#1c1a19', INK, 3);
  for (let i = 0; i < 7; i++) {
    const x = 11 + i * 17.5;
    rrect(c, x - 4.5, 8, 9, 48, 3, '#565b64', INK, 2.5);
    c.fillStyle = rgba('#ffffff', 0.22);
    c.fillRect(x - 3, 11, 2, 42);
  }
  rrect(c, 2, 18, 124, 8, 2, '#3c4047', INK, 2.5);
  rrect(c, 2, 38, 124, 8, 2, '#3c4047', INK, 2.5);
  for (let i = 0; i < 7; i++) {
    circle(c, 11 + i * 17.5, 22, 1.7, '#9aa0aa');
    circle(c, 11 + i * 17.5, 42, 1.7, '#9aa0aa');
  }
}

function drawLamp(c: Ctx): void {
  rrect(c, 9, 2, 14, 9, 2, '#4a3520', INK, 2);
  circle(c, 16, 15, 8, '#6a4a22', INK, 2);
  circle(c, 16, 15, 5, '#ffd88a');
  circle(c, 16, 15, 2.4, '#fff6dc');
}

// ------------------------------------------------------------------ fx

function softCircle(c: Ctx, size: number, stops: [number, string][]): void {
  radial(c, size / 2, size / 2, size / 2, stops);
}

function drawSplat(c: Ctx, size: number, seed: number): void {
  let s = seed;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const cx = size / 2;
  c.fillStyle = '#ffffff';
  c.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rad = size * (0.2 + r() * 0.16);
    const x = cx + Math.cos(a) * rad;
    const y = cx + Math.sin(a) * rad;
    if (i === 0) c.moveTo(x, y);
    else c.quadraticCurveTo(cx + Math.cos(a - 0.22) * rad * 1.25, cx + Math.sin(a - 0.22) * rad * 1.25, x, y);
  }
  c.fill();
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const d = size * (0.28 + r() * 0.2);
    circle(c, cx + Math.cos(a) * d, cx + Math.sin(a) * d, 1.5 + r() * 4, '#ffffff');
  }
}

// ------------------------------------------------------------------ upgrade icons

export function drawGlyph(c: Ctx, glyph: string, cx: number, cy: number, s: number, col: string): void {
  c.save();
  c.translate(cx, cy);
  c.scale(s, s);
  c.fillStyle = col;
  c.strokeStyle = col;
  c.lineWidth = 3;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const bullet = (x: number, y: number, k = 1) => {
    c.beginPath();
    c.moveTo(x - 7 * k, y - 4 * k);
    c.lineTo(x + 2 * k, y - 4 * k);
    c.quadraticCurveTo(x + 9 * k, y, x + 2 * k, y + 4 * k);
    c.lineTo(x - 7 * k, y + 4 * k);
    c.closePath();
    c.fill();
  };
  switch (glyph) {
    case 'bullet':
      c.rotate(-Math.PI / 4);
      bullet(0, 0, 1.9);
      break;
    case 'bolt':
      poly(c, [3, -16, -9, 2, -1, 2, -4, 16, 9, -3, 1, -3], col);
      break;
    case 'reload':
      c.beginPath();
      c.arc(0, 0, 11, -Math.PI * 0.2, Math.PI * 1.3);
      c.lineWidth = 4;
      c.stroke();
      poly(c, [6, -15, 15, -8, 5, -4], col);
      break;
    case 'mag':
      c.rotate(0.25);
      rrect(c, -7, -14, 14, 28, 3, col);
      c.fillStyle = 'rgba(0,0,0,0.45)';
      for (let i = 0; i < 4; i++) c.fillRect(-4, -10 + i * 6, 8, 2.5);
      break;
    case 'boot':
      poly(c, [-8, -14, 1, -14, 1, 2, 13, 6, 13, 13, -8, 13], col);
      break;
    case 'roll':
      c.beginPath();
      c.arc(0, 0, 10, Math.PI * 0.3, Math.PI * 1.9);
      c.lineWidth = 4.5;
      c.stroke();
      circle(c, 0, 0, 3.5, col);
      poly(c, [5, -15, 15, -9, 5, -3], col);
      break;
    case 'heart':
      heartPath(c, 0, 1, 12);
      c.fill();
      break;
    case 'bounce':
      c.lineWidth = 3.5;
      c.beginPath();
      c.moveTo(-14, -10);
      c.lineTo(-2, 9);
      c.lineTo(12, -9);
      c.stroke();
      line(c, -15, 13, 15, 13, col, 3.5);
      circle(c, 12, -9, 3.5, col);
      break;
    case 'pierce':
      bullet(4, 0, 1.3);
      line(c, -15, 0, -5, 0, col, 3);
      line(c, -5, -12, -5, 12, col, 4);
      break;
    case 'eye':
      c.beginPath();
      c.moveTo(-15, 0);
      c.quadraticCurveTo(0, -14, 15, 0);
      c.quadraticCurveTo(0, 14, -15, 0);
      c.lineWidth = 3;
      c.stroke();
      circle(c, 0, 0, 5, col);
      break;
    case 'bomb':
      circle(c, -1, 3, 10, col);
      line(c, 5, -6, 10, -12, col, 3);
      circle(c, 12, -14, 2.2, col);
      break;
    case 'fang':
      poly(c, [-11, -11, -3, -11, -7, 9], col);
      poly(c, [3, -11, 11, -11, 7, 9], col);
      line(c, -13, -12, 13, -12, col, 3.5);
      break;
    case 'magnet':
      c.beginPath();
      c.arc(0, 1, 10, 0, Math.PI);
      c.lineWidth = 7;
      c.lineCap = 'butt';
      c.stroke();
      c.fillRect(-13.5, -11, 7, 12);
      c.fillRect(6.5, -11, 7, 12);
      break;
    case 'blast':
      circle(c, 0, 0, 5, col);
      c.lineWidth = 3;
      for (const r of [10, 15]) {
        c.beginPath();
        c.arc(0, 0, r, 0, Math.PI * 2);
        c.globalAlpha = r === 10 ? 1 : 0.55;
        c.stroke();
      }
      break;
    case 'shield':
      poly(c, [0, -14, 12, -9, 10, 5, 0, 14, -10, 5, -12, -9], col);
      break;
    case 'flame':
      c.beginPath();
      c.moveTo(0, -15);
      c.quadraticCurveTo(13, -2, 8, 9);
      c.quadraticCurveTo(4, 15, 0, 14);
      c.quadraticCurveTo(-11, 14, -9, 2);
      c.quadraticCurveTo(-7, -4, -3, -3);
      c.quadraticCurveTo(-4, -9, 0, -15);
      c.fill();
      break;
    case 'skull':
      circle(c, 0, -3, 11, col);
      rrect(c, -6, 4, 12, 9, 2, col);
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.beginPath();
      c.arc(-4.5, -3, 3, 0, Math.PI * 2);
      c.arc(4.5, -3, 3, 0, Math.PI * 2);
      c.fill();
      break;
    case 'star': {
      const pts: number[] = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? 15 : 6.5;
        pts.push(Math.cos(a) * r, Math.sin(a) * r);
      }
      poly(c, pts, col);
      break;
    }
    case 'coin':
      circle(c, 0, 0, 12, col);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(-2, -7, 4, 14);
      break;
    case 'hand':
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 0, 12, 0, Math.PI * 2);
      c.stroke();
      line(c, -17, 0, -8, 0, col, 3);
      line(c, 8, 0, 17, 0, col, 3);
      line(c, 0, -17, 0, -8, col, 3);
      line(c, 0, 8, 0, 17, col, 3);
      circle(c, 0, 0, 2.5, col);
      break;
    case 'crate':
      rrect(c, -12, -12, 24, 24, 3, undefined, col, 3.5);
      line(c, -10, -10, 10, 10, col, 3);
      line(c, 10, -10, -10, 10, col, 3);
      break;
    case 'shards':
      for (let i = 0; i < 6; i++) {
        c.save();
        c.rotate((i / 6) * Math.PI * 2);
        poly(c, [5, -2.5, 16, 0, 5, 2.5], col);
        c.restore();
      }
      circle(c, 0, 0, 3.5, col);
      break;
    case 'clock':
      c.beginPath();
      c.arc(0, 0, 12, 0, Math.PI * 2);
      c.lineWidth = 3.5;
      c.stroke();
      line(c, 0, 0, 0, -8, col, 3);
      line(c, 0, 0, 6, 3, col, 3);
      break;
  }
  c.restore();
}

export function buildUpgradeIcon(scene: Phaser.Scene, key: string, glyph: string, color: string): void {
  tex(scene, key, 72, 72, (c) => {
    rrect(c, 3, 3, 66, 66, 14, '#1c1917', color, 3.5);
    radial(c, 36, 30, 34, [[0, rgba(color, 0.3)], [1, rgba(color, 0)]]);
    drawGlyph(c, glyph, 36, 36, 1.25, color);
  });
}

// ------------------------------------------------------------------ build all

export function buildTextures(scene: Phaser.Scene): void {
  const WEAPONS = ['pistol', 'revolver', 'smg', 'shotgun', 'rifle', 'burst', 'twin', 'sniper', 'launcher', 'minigun', 'nail'];
  for (const id of WEAPONS) {
    tex(scene, `w_${id}`, WEAPON_TEX_W, WEAPON_TEX_H, (c) => drawWeapon(c, id, 1));
    tex(scene, `wi_${id}`, WEAPON_TEX_W * 2.5, WEAPON_TEX_H * 2.5, (c) => drawWeapon(c, id, 2.5));
  }

  tex(scene, 'player', 80, 80, drawPlayer);
  tex(scene, 'e_grunt', 72, 72, drawGrunt);
  tex(scene, 'e_shotgunner', 80, 80, drawShotgunner);
  tex(scene, 'e_charger', 96, 96, drawCharger);
  tex(scene, 'e_swarmer', 40, 40, drawSwarmer);
  tex(scene, 'e_sniper', 104, 72, drawSniper);
  tex(scene, 'e_grenadier', 80, 80, drawGrenadier);
  tex(scene, 'e_turretBase', 72, 72, drawTurretBase);
  tex(scene, 'e_turret', 72, 56, drawTurretHead);
  tex(scene, 'e_heavy', 104, 104, drawHeavy);
  tex(scene, 'e_shield', 104, 104, drawShield);
  tex(scene, 'e_drone', 64, 64, drawDrone);
  tex(scene, 'b_warden', 208, 208, drawWarden);
  tex(scene, 'b_furnace', 228, 228, drawFurnace);
  tex(scene, 'b_magistrate', 168, 168, drawMagistrate);

  tex(scene, 'crate', 64, 64, drawCrate);
  tex(scene, 'barrel', 60, 60, drawBarrel);
  tex(scene, 'chest', 76, 60, (c) => drawChest(c, false));
  tex(scene, 'chestOpen', 76, 60, (c) => drawChest(c, true));
  tex(scene, 'pedestal', 80, 80, drawPedestal);
  tex(scene, 'stairs', 112, 112, drawStairs);
  tex(scene, 'door', 128, 64, drawDoor);
  tex(scene, 'lamp', 32, 26, drawLamp);

  tex(scene, 'coin', 22, 22, (c) => drawCoin(c, 8));
  tex(scene, 'coinBig', 30, 30, (c) => drawCoin(c, 12));
  tex(scene, 'p_heart', 40, 40, (c) => drawHeart(c, 40, 'full'));
  tex(scene, 'p_half', 34, 34, (c) => drawHeart(c, 34, 'half'));
  tex(scene, 'p_ammo', 48, 46, drawAmmo);
  tex(scene, 'p_blank', 40, 40, (c) => drawBlank(c, 40));
  tex(scene, 'p_armor', 40, 40, (c) => {
    poly(c, [20, 4, 35, 10, 32, 26, 20, 36, 8, 26, 5, 10], '#6f8fb0', INK, 3);
    poly(c, [20, 9, 20, 31, 11, 24, 9, 13], rgba('#ffffff', 0.25));
  });

  tex(scene, 'ui_heart', 52, 52, (c) => drawHeart(c, 52, 'full'));
  tex(scene, 'ui_half', 52, 52, (c) => drawHeart(c, 52, 'half'));
  tex(scene, 'ui_empty', 52, 52, (c) => drawHeart(c, 52, 'empty'));
  tex(scene, 'ui_blank', 44, 44, (c) => drawBlank(c, 44));
  tex(scene, 'ui_coin', 40, 40, (c) => drawCoin(c, 16));
  tex(scene, 'ui_armor', 48, 48, (c) => {
    c.scale(1.2, 1.2);
    poly(c, [20, 4, 35, 10, 32, 26, 20, 36, 8, 26, 5, 10], '#6f8fb0', INK, 3);
    poly(c, [20, 9, 20, 31, 11, 24, 9, 13], rgba('#ffffff', 0.25));
  });

  // Projectiles
  tex(scene, 'pb', 40, 10, (c) => {
    const g = c.createLinearGradient(0, 0, 40, 0);
    g.addColorStop(0, 'rgba(255,214,130,0)');
    g.addColorStop(0.6, 'rgba(255,224,150,0.75)');
    g.addColorStop(1, '#fff8e0');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 5);
    c.lineTo(32, 1.5);
    c.quadraticCurveTo(40, 5, 32, 8.5);
    c.closePath();
    c.fill();
  });
  tex(scene, 'pbPellet', 20, 8, (c) => {
    const g = c.createLinearGradient(0, 0, 20, 0);
    g.addColorStop(0, 'rgba(255,214,130,0)');
    g.addColorStop(1, '#fff8e0');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 4);
    c.lineTo(14, 1);
    c.quadraticCurveTo(20, 4, 14, 7);
    c.closePath();
    c.fill();
  });
  tex(scene, 'pbHeavy', 64, 12, (c) => {
    const g = c.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,230,170,0)');
    g.addColorStop(0.7, 'rgba(255,236,190,0.8)');
    g.addColorStop(1, '#ffffff');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 6);
    c.lineTo(54, 1.5);
    c.quadraticCurveTo(64, 6, 54, 10.5);
    c.closePath();
    c.fill();
  });
  tex(scene, 'pbNail', 30, 6, (c) => {
    rrect(c, 4, 1.5, 24, 3, 1.5, '#e8eef2');
    c.fillStyle = '#9aa7b0';
    c.fillRect(2, 0.5, 3, 5);
  });
  tex(scene, 'pbGrenade', 22, 22, (c) => {
    circle(c, 11, 11, 8, '#56603f', INK, 2.5);
    circle(c, 9, 9, 2.5, rgba('#ffffff', 0.4));
    circle(c, 15, 11, 2, '#ffb24a');
  });
  const enemyBullet = (key: string, size: number) =>
    tex(scene, key, size, size, (c) => {
      const r = size / 2;
      circle(c, r, r, r - 1.5, '#e8432a', '#4a0d08', 2.5);
      radial(c, r, r, r * 0.62, [[0, '#fff3d0'], [0.55, '#ffcf8a'], [1, rgba('#ffb060', 0)]]);
    });
  enemyBullet('eb', 22);
  enemyBullet('ebBig', 36);
  enemyBullet('ebSmall', 16);
  tex(scene, 'ebFast', 44, 14, (c) => {
    const g = c.createLinearGradient(0, 0, 44, 0);
    g.addColorStop(0, 'rgba(232,67,42,0)');
    g.addColorStop(0.5, 'rgba(232,67,42,0.9)');
    g.addColorStop(1, '#ffe2b0');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 7);
    c.lineTo(34, 1.5);
    c.quadraticCurveTo(44, 7, 34, 12.5);
    c.closePath();
    c.fill();
  });
  tex(scene, 'grenade', 26, 26, (c) => {
    circle(c, 13, 13, 10, '#3f4a2c', INK, 2.5);
    line(c, 6, 13, 20, 13, '#2a321d', 2);
    circle(c, 10, 9, 3, rgba('#ffffff', 0.3));
    circle(c, 13, 13, 3, '#ff6a3c');
  });

  // FX
  tex(scene, 'soft', 64, 64, (c) => softCircle(c, 64, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]));
  tex(scene, 'light', 256, 256, (c) =>
    softCircle(c, 256, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.82)'], [0.55, 'rgba(255,255,255,0.38)'], [0.8, 'rgba(255,255,255,0.1)'], [1, 'rgba(255,255,255,0)']]));
  tex(scene, 'dot', 12, 12, (c) => circle(c, 6, 6, 5, '#ffffff'));
  tex(scene, 'px', 4, 4, (c) => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, 4, 4);
  });
  tex(scene, 'spark', 20, 4, (c) => {
    const g = c.createLinearGradient(0, 0, 20, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g;
    c.fillRect(0, 0, 20, 4);
  });
  tex(scene, 'ring', 128, 128, (c) => circle(c, 64, 64, 58, undefined, '#ffffff', 6));
  tex(scene, 'ringThin', 128, 128, (c) => circle(c, 64, 64, 61, undefined, '#ffffff', 2.5));
  tex(scene, 'flash', 72, 56, (c) => {
    const cy = 28;
    radial(c, 14, cy, 26, [[0, 'rgba(255,244,200,1)'], [0.5, 'rgba(255,190,90,0.6)'], [1, 'rgba(255,150,60,0)']]);
    poly(c, [4, cy, 22, cy - 9, 70, cy, 22, cy + 9], '#fff3c8');
    poly(c, [8, cy, 20, cy - 22, 28, cy - 4], '#ffd890');
    poly(c, [8, cy, 20, cy + 22, 28, cy + 4], '#ffd890');
  });
  tex(scene, 'shell', 10, 5, (c) => {
    rrect(c, 0.5, 0.5, 9, 4, 1.5, '#d9b24a', '#7a5a1c', 1);
  });
  tex(scene, 'shellRed', 12, 6, (c) => {
    rrect(c, 0.5, 0.5, 11, 5, 1.5, '#b83a2a', '#5a1a12', 1);
    c.fillStyle = '#d9b24a';
    c.fillRect(1, 1, 3.5, 4);
  });
  tex(scene, 'chunk', 10, 10, (c) => poly(c, [1, 3, 5, 0.5, 9, 2.5, 8, 8, 3, 9.5], '#ffffff'));
  tex(scene, 'plank', 18, 6, (c) => rrect(c, 0.5, 0.5, 17, 5, 1, '#a57a48', '#3c2a16', 1));
  tex(scene, 'shadow', 64, 64, (c) => softCircle(c, 64, [[0, 'rgba(0,0,0,0.6)'], [0.55, 'rgba(0,0,0,0.42)'], [1, 'rgba(0,0,0,0)']]));
  for (let i = 0; i < 3; i++) tex(scene, `splat${i}`, 64, 64, (c) => drawSplat(c, 64, 1234 + i * 777));
  tex(scene, 'scorch', 160, 160, (c) => softCircle(c, 160, [[0, 'rgba(0,0,0,0.7)'], [0.5, 'rgba(0,0,0,0.42)'], [1, 'rgba(0,0,0,0)']]));
  tex(scene, 'telegraph', 256, 256, (c) => {
    radial(c, 128, 128, 124, [[0, 'rgba(216,69,47,0.1)'], [0.8, 'rgba(216,69,47,0.24)'], [1, 'rgba(216,69,47,0.34)']]);
    c.globalCompositeOperation = 'destination-in';
    circle(c, 128, 128, 124, '#fff');
    c.globalCompositeOperation = 'source-over';
    c.setLineDash([18, 10]);
    circle(c, 128, 128, 122, undefined, '#ff7a5a', 5);
    c.setLineDash([]);
  });
  tex(scene, 'spawnMark', 96, 96, (c) => {
    c.setLineDash([10, 8]);
    circle(c, 48, 48, 40, undefined, '#ffffff', 4);
    c.setLineDash([]);
    line(c, 36, 36, 60, 60, '#ffffff', 4);
    line(c, 60, 36, 36, 60, '#ffffff', 4);
  });
  tex(scene, 'eliteRing', 96, 96, (c) => {
    c.setLineDash([12, 7]);
    circle(c, 48, 48, 42, undefined, '#e2b23c', 4);
    c.setLineDash([]);
  });

  // Full-screen overlays (quarter-res, stretched)
  tex(scene, 'vignette', GW / 4, GH / 4, (c) => {
    const w = GW / 4;
    const h = GH / 4;
    c.save();
    c.scale(1, h / w);
    const g = c.createRadialGradient(w / 2, w / 2, w * 0.3, w / 2, w / 2, w * 0.74);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.78)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
    c.restore();
  });
  tex(scene, 'hurt', GW / 4, GH / 4, (c) => {
    const w = GW / 4;
    const h = GH / 4;
    c.save();
    c.scale(1, h / w);
    const g = c.createRadialGradient(w / 2, w / 2, w * 0.28, w / 2, w / 2, w * 0.7);
    g.addColorStop(0, 'rgba(170,20,12,0)');
    g.addColorStop(1, 'rgba(170,20,12,0.85)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
    c.restore();
  });
}
