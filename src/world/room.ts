import Phaser from 'phaser';
import { DEPTH, TILE, type Theme } from '../config';
import { RNG } from '../core/rng';
import { type Ctx, INK, circle, line, poly, rgba, rrect, shade } from '../gfx/draw';
import { DIRS, type Dir, type RoomNode } from './floorgen';
import { T, doorTiles, generateRoom, type RoomLayout } from './roomgen';

export interface Prop {
  tx: number;
  ty: number;
  x: number;
  y: number;
  kind: 'crate' | 'barrel';
  hp: number;
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  dead: boolean;
  shakeT: number;
}

interface DoorSprite {
  dir: Dir;
  img: Phaser.GameObjects.Image;
}

export interface Lamp {
  x: number;
  y: number;
  img: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  phase: number;
}

const NEIGH8: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** The live, playable version of one room: collision, pathing and its baked visuals. */
export class Room {
  readonly layout: RoomLayout;
  readonly w: number;
  readonly h: number;
  readonly pw: number;
  readonly ph: number;
  locked = false;
  props: Prop[] = [];
  lamps: Lamp[] = [];
  decals: Phaser.GameObjects.RenderTexture;

  private propSolid: Uint8Array;
  private flow: Int16Array;
  private flowKey = -1;
  private floorImg: Phaser.GameObjects.Image;
  private wallImg: Phaser.GameObjects.Image;
  private doors: DoorSprite[] = [];
  private texKey: string;
  private stamp: Phaser.GameObjects.Image;
  /** Scratch result for collide(). */
  cx = 0;
  cy = 0;

  constructor(
    private scene: Phaser.Scene,
    readonly node: RoomNode,
    readonly theme: Theme,
    floorIndex: number,
  ) {
    if (!node.layout) node.layout = generateRoom(node, floorIndex);
    this.layout = node.layout;
    this.w = this.layout.w;
    this.h = this.layout.h;
    this.pw = this.w * TILE;
    this.ph = this.h * TILE;
    this.propSolid = new Uint8Array(this.w * this.h);
    this.flow = new Int16Array(this.w * this.h);

    this.texKey = `room_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    // Floor and walls are baked separately so blood, scorch marks and shell casings
    // (the decal layer) sit on the floor but never on top of a wall or pillar.
    const tex = scene.textures.createCanvas(this.texKey, this.pw, this.ph)!;
    const wtex = scene.textures.createCanvas(`${this.texKey}_w`, this.pw, this.ph)!;
    bakeRoom(tex.getContext(), wtex.getContext(), this.layout, theme, new RNG(node.seed ^ 0xbeef), node);
    tex.refresh();
    wtex.refresh();
    this.floorImg = scene.add.image(0, 0, this.texKey).setOrigin(0, 0).setDepth(DEPTH.FLOOR);
    this.wallImg = scene.add.image(0, 0, `${this.texKey}_w`).setOrigin(0, 0).setDepth(DEPTH.DECAL + 0.5);

    this.decals = scene.add.renderTexture(0, 0, this.pw, this.ph).setOrigin(0, 0).setDepth(DEPTH.DECAL);
    this.stamp = scene.make.image({ key: 'soft', add: false });

    for (const p of this.layout.props) this.addProp(p.tx, p.ty, p.kind);

    for (const d of DIRS) {
      if (node.doors[d] === undefined) continue;
      const tiles = doorTiles(this.w, this.h, d);
      const x = ((tiles[0][0] + tiles[1][0]) / 2 + 0.5) * TILE;
      const y = ((tiles[0][1] + tiles[1][1]) / 2 + 0.5) * TILE;
      const img = scene.add.image(x, y, 'door').setDepth(DEPTH.PROP).setVisible(false);
      if (d === 'e' || d === 'w') img.setRotation(Math.PI / 2);
      this.doors.push({ dir: d, img });
    }

    for (const l of this.layout.lamps) {
      let x = (l.tx + 0.5) * TILE;
      let y = (l.ty + 0.5) * TILE;
      let rot = 0;
      if (l.side === 'n') { y = TILE - 10; }
      if (l.side === 's') { y = this.ph - TILE + 10; rot = Math.PI; }
      if (l.side === 'w') { x = TILE - 10; rot = -Math.PI / 2; }
      if (l.side === 'e') { x = this.pw - TILE + 10; rot = Math.PI / 2; }
      const img = scene.add.image(x, y, 'lamp').setDepth(DEPTH.PROP).setRotation(rot);
      const glow = scene.add.image(x, y, 'light').setDepth(DEPTH.GLOW).setBlendMode(Phaser.BlendModes.ADD)
        .setTint(theme.lamp).setAlpha(0.2).setScale(1.5);
      this.lamps.push({ x, y, img, glow, phase: Math.random() * 10 });
    }
  }

  destroy(): void {
    this.floorImg.destroy();
    this.wallImg.destroy();
    this.decals.destroy();
    this.stamp.destroy();
    for (const p of this.props) {
      p.img.destroy();
      p.shadow.destroy();
    }
    for (const d of this.doors) d.img.destroy();
    for (const l of this.lamps) {
      l.img.destroy();
      l.glow.destroy();
    }
    if (this.scene.textures.exists(this.texKey)) this.scene.textures.remove(this.texKey);
    if (this.scene.textures.exists(`${this.texKey}_w`)) this.scene.textures.remove(`${this.texKey}_w`);
  }

  // ------------------------------------------------------------ props

  private addProp(tx: number, ty: number, kind: 'crate' | 'barrel'): void {
    const x = (tx + 0.5) * TILE;
    const y = (ty + 0.5) * TILE;
    const shadow = this.scene.add.image(x + 5, y + 7, 'shadow').setDepth(DEPTH.SHADOW).setScale(1.25).setAlpha(0.8);
    const img = this.scene.add.image(x, y, kind).setDepth(DEPTH.PROP);
    if (kind === 'crate') img.setRotation(((tx * 7 + ty * 13) % 4) * (Math.PI / 2)).setScale(0.94);
    this.props.push({ tx, ty, x, y, kind, hp: kind === 'crate' ? 22 : 12, img, shadow, dead: false, shakeT: 0 });
    this.propSolid[ty * this.w + tx] = 1;
  }

  propAt(tx: number, ty: number): Prop | undefined {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return undefined;
    if (!this.propSolid[ty * this.w + tx]) return undefined;
    return this.props.find((p) => !p.dead && p.tx === tx && p.ty === ty);
  }

  removeProp(p: Prop): void {
    p.dead = true;
    p.img.destroy();
    p.shadow.destroy();
    this.propSolid[p.ty * this.w + p.tx] = 0;
    this.props = this.props.filter((q) => q !== p);
    const i = this.layout.props.findIndex((q) => q.tx === p.tx && q.ty === p.ty);
    if (i >= 0) this.layout.props.splice(i, 1);
    this.flowKey = -1;
  }

  update(dt: number, time: number): void {
    for (const p of this.props) {
      if (p.shakeT > 0) {
        p.shakeT -= dt;
        const k = Math.max(0, p.shakeT) * 30;
        p.img.setPosition(p.x + (Math.random() - 0.5) * k, p.y + (Math.random() - 0.5) * k);
      }
    }
    for (const l of this.lamps) {
      const f = 0.2 + Math.sin(time * 0.006 + l.phase) * 0.02 + Math.sin(time * 0.017 + l.phase * 3) * 0.012;
      l.glow.setAlpha(f);
    }
  }

  // ------------------------------------------------------------ collision

  tileAt(tx: number, ty: number): number {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return T.WALL;
    return this.layout.tiles[ty * this.w + tx];
  }

  solidTile(tx: number, ty: number, doorsSolid: boolean): boolean {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true;
    const i = ty * this.w + tx;
    const t = this.layout.tiles[i];
    if (t === T.WALL || t === T.BLOCK) return true;
    if (t === T.DOOR) return doorsSolid || this.locked;
    return this.propSolid[i] === 1;
  }

  solidAt(x: number, y: number, doorsSolid = true): boolean {
    return this.solidTile(Math.floor(x / TILE), Math.floor(y / TILE), doorsSolid);
  }

  /** Pushes a circle out of solid tiles. Result is in this.cx / this.cy. Returns true if it touched something. */
  collide(x: number, y: number, r: number, doorsSolid: boolean): boolean {
    let hit = false;
    for (let iter = 0; iter < 2; iter++) {
      const tx0 = Math.floor((x - r) / TILE);
      const tx1 = Math.floor((x + r) / TILE);
      const ty0 = Math.floor((y - r) / TILE);
      const ty1 = Math.floor((y + r) / TILE);
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          if (!this.solidTile(tx, ty, doorsSolid)) continue;
          const left = tx * TILE;
          const top = ty * TILE;
          const nx = Math.max(left, Math.min(x, left + TILE));
          const ny = Math.max(top, Math.min(y, top + TILE));
          const dx = x - nx;
          const dy = y - ny;
          const d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;
          hit = true;
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            x += (dx / d) * (r - d);
            y += (dy / d) * (r - d);
          } else {
            // Centre is inside the tile: leave through the nearest face.
            const toL = x - left;
            const toR = left + TILE - x;
            const toT = y - top;
            const toB = top + TILE - y;
            const m = Math.min(toL, toR, toT, toB);
            if (m === toL) x = left - r;
            else if (m === toR) x = left + TILE + r;
            else if (m === toT) y = top - r;
            else y = top + TILE + r;
          }
        }
      }
    }
    this.cx = x;
    this.cy = y;
    return hit;
  }

  /** Line of sight between two points (walls, blocks and props block it). */
  los(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const d = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(d / 14);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.solidAt(x0 + dx * t, y0 + dy * t, true)) return false;
    }
    return true;
  }

  /** Distance along a ray until something solid. */
  raycast(x: number, y: number, ang: number, max: number): number {
    const cx = Math.cos(ang);
    const cy = Math.sin(ang);
    for (let d = 0; d < max; d += 10) {
      if (this.solidAt(x + cx * d, y + cy * d, true)) return d;
    }
    return max;
  }

  // ------------------------------------------------------------ pathing

  /** Rebuilds the distance field toward a target point (the player). */
  updateFlow(px: number, py: number): void {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    const key = ty * this.w + tx;
    if (key === this.flowKey) return;
    if (this.solidTile(tx, ty, true)) return;
    this.flowKey = key;
    this.fillFlow(this.flow, tx, ty);
  }

  fillFlow(out: Int16Array, tx: number, ty: number, doorsSolid = true): void {
    out.fill(-1);
    const w = this.w;
    const queue: number[] = [tx, ty];
    out[ty * w + tx] = 0;
    let head = 0;
    while (head < queue.length) {
      const x = queue[head++];
      const y = queue[head++];
      const d = out[y * w + x];
      for (let n = 0; n < 4; n++) {
        const nx = x + NEIGH8[n][0];
        const ny = y + NEIGH8[n][1];
        if (this.solidTile(nx, ny, doorsSolid)) continue;
        const i = ny * w + nx;
        if (out[i] >= 0) continue;
        out[i] = d + 1;
        queue.push(nx, ny);
      }
    }
  }

  /** Unit direction along the shortest path toward the flow target. Writes into out; false if no path. */
  flowDir(x: number, y: number, out: { x: number; y: number }, field: Int16Array = this.flow, doorsSolid = true): boolean {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return false;
    const here = field[ty * this.w + tx];
    let best = here < 0 ? 32000 : here;
    let bx = -1;
    let by = -1;
    for (let n = 0; n < 8; n++) {
      const ox = NEIGH8[n][0];
      const oy = NEIGH8[n][1];
      const nx = tx + ox;
      const ny = ty + oy;
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const d = field[ny * this.w + nx];
      if (d < 0 || d >= best) continue;
      // no cutting corners diagonally
      if (n >= 4 && (this.solidTile(tx + ox, ty, doorsSolid) || this.solidTile(tx, ty + oy, doorsSolid))) continue;
      best = d;
      bx = nx;
      by = ny;
    }
    if (bx < 0) return false;
    const dx = (bx + 0.5) * TILE - x;
    const dy = (by + 0.5) * TILE - y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    out.x = dx / len;
    out.y = dy / len;
    return true;
  }

  flowDist(x: number, y: number): number {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return -1;
    return this.flow[ty * this.w + tx];
  }

  /** A random open tile centre, at least minDist px from (ax, ay). */
  randomFree(ax: number, ay: number, minDist: number, margin = 1): { x: number; y: number } {
    for (let i = 0; i < 80; i++) {
      const tx = margin + Math.floor(Math.random() * (this.w - margin * 2));
      const ty = margin + Math.floor(Math.random() * (this.h - margin * 2));
      if (this.solidTile(tx, ty, true)) continue;
      const x = (tx + 0.5) * TILE;
      const y = (ty + 0.5) * TILE;
      const dx = x - ax;
      const dy = y - ay;
      const need = i < 50 ? minDist : minDist * 0.5;
      if (dx * dx + dy * dy < need * need) continue;
      return { x, y };
    }
    return { x: this.pw / 2, y: this.ph / 2 };
  }

  // ------------------------------------------------------------ doors

  setLocked(locked: boolean, animate = true): void {
    if (this.locked === locked) return;
    this.locked = locked;
    this.flowKey = -1;
    for (const d of this.doors) {
      this.scene.tweens.killTweensOf(d.img);
      if (locked) {
        d.img.setVisible(true);
        if (animate) {
          d.img.setAlpha(0).setScale(1.25);
          this.scene.tweens.add({ targets: d.img, alpha: 1, scale: 1, duration: 160, ease: 'Back.easeOut' });
        } else {
          d.img.setAlpha(1).setScale(1);
        }
      } else if (animate) {
        this.scene.tweens.add({
          targets: d.img, alpha: 0, scale: 0.8, duration: 260, ease: 'Quad.easeIn',
          onComplete: () => d.img.setVisible(false),
        });
      } else {
        d.img.setVisible(false);
      }
    }
  }

  /** If (x, y) is standing in an open doorway, returns which one. */
  doorAt(x: number, y: number): Dir | null {
    if (this.locked) return null;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (this.tileAt(tx, ty) !== T.DOOR) return null;
    if (ty === 0 && y < TILE * 0.62) return 'n';
    if (ty === this.h - 1 && y > this.ph - TILE * 0.62) return 's';
    if (tx === 0 && x < TILE * 0.62) return 'w';
    if (tx === this.w - 1 && x > this.pw - TILE * 0.62) return 'e';
    return null;
  }

  /** Where the player appears after coming in through the given side. */
  entry(dir: Dir): { x: number; y: number } {
    const t = doorTiles(this.w, this.h, dir);
    const x = ((t[0][0] + t[1][0]) / 2 + 0.5) * TILE;
    const y = ((t[0][1] + t[1][1]) / 2 + 0.5) * TILE;
    const inset = TILE * 1.25;
    if (dir === 'n') return { x, y: y + inset };
    if (dir === 's') return { x, y: y - inset };
    if (dir === 'w') return { x: x + inset, y };
    return { x: x - inset, y };
  }

  doorCentre(dir: Dir): { x: number; y: number } {
    const t = doorTiles(this.w, this.h, dir);
    return { x: ((t[0][0] + t[1][0]) / 2 + 0.5) * TILE, y: ((t[0][1] + t[1][1]) / 2 + 0.5) * TILE };
  }

  // ------------------------------------------------------------ decals

  decal(key: string, x: number, y: number, scale: number, rot: number, tint: number, alpha: number): void {
    this.stamp.setTexture(key).setScale(scale).setRotation(rot).setTint(tint).setAlpha(alpha);
    this.decals.draw(this.stamp, x, y);
  }
}

// -------------------------------------------------------------------- baking

function bakeRoom(c: Ctx, wallCtx: Ctx, L: RoomLayout, th: Theme, rng: RNG, node: RoomNode): void {
  const { w, h } = L;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : L.tiles[y * w + x]);
  const solid = (x: number, y: number) => {
    const t = at(x, y);
    return t === T.WALL || t === T.BLOCK;
  };
  const open = (x: number, y: number) => {
    const t = at(x, y);
    return t === T.FLOOR || t === T.DOOR;
  };

  c.fillStyle = th.wallTop;
  c.fillRect(0, 0, w * TILE, h * TILE);

  // ---- floor
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!open(x, y)) continue;
      const px = x * TILE;
      const py = y * TILE;
      const base = (x + y) % 2 === 0 ? th.floorA : th.floorB;
      c.fillStyle = shade(base, rng.range(-0.07, 0.05));
      c.fillRect(px, py, TILE, TILE);

      if (th.id === 0) {
        // flagstones: some tiles split into two slabs, a few cracked
        c.strokeStyle = rgba(th.grout, 0.9);
        c.lineWidth = 2;
        c.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
        if (rng.chance(0.3)) {
          if (rng.chance(0.5)) line(c, px + TILE / 2, py + 1, px + TILE / 2, py + TILE - 1, rgba(th.grout, 0.9), 2);
          else line(c, px + 1, py + TILE / 2, px + TILE - 1, py + TILE / 2, rgba(th.grout, 0.9), 2);
        }
        c.fillStyle = 'rgba(255,255,255,0.05)';
        c.fillRect(px + 2, py + 2, TILE - 4, 2);
        if (rng.chance(0.09)) {
          c.beginPath();
          let cxp = px + rng.range(8, 56);
          let cyp = py + rng.range(8, 56);
          c.moveTo(cxp, cyp);
          for (let i = 0; i < 4; i++) {
            cxp += rng.range(-14, 14);
            cyp += rng.range(-14, 14);
            c.lineTo(Math.max(px + 3, Math.min(px + 61, cxp)), Math.max(py + 3, Math.min(py + 61, cyp)));
          }
          c.strokeStyle = rgba(th.grout, 0.75);
          c.lineWidth = 1.5;
          c.stroke();
        }
      } else if (th.id === 1) {
        // riveted iron plates, 2x2 tiles each, with the odd floor grate
        if (rng.chance(0.06)) {
          c.fillStyle = '#1b1c20';
          c.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
          for (let i = 0; i < 6; i++) {
            c.fillStyle = '#3d4047';
            c.fillRect(px + 8, py + 9 + i * 8.4, TILE - 16, 3.6);
          }
          c.strokeStyle = '#6a4a35';
          c.lineWidth = 2.5;
          c.strokeRect(px + 5, py + 5, TILE - 10, TILE - 10);
        }
        c.strokeStyle = rgba(th.grout, 0.55);
        c.lineWidth = 1;
        c.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        if (x % 2 === 0) line(c, px + 1, py, px + 1, py + TILE, rgba(th.grout, 1), 3);
        if (y % 2 === 0) line(c, px, py + 1, px + TILE, py + 1, rgba(th.grout, 1), 3);
        const rx = x % 2 === 0 ? px + 9 : px + TILE - 9;
        const ry = y % 2 === 0 ? py + 9 : py + TILE - 9;
        circle(c, rx, ry, 2.6, '#7b808a', '#26282d', 1);
        if (rng.chance(0.12)) {
          c.fillStyle = rgba('#7a4a30', 0.16);
          c.fillRect(px + rng.range(4, 30), py + 4, rng.range(6, 22), TILE - 8);
        }
      } else {
        // polished marble with veins and gold inlay
        c.strokeStyle = rgba(th.grout, 0.8);
        c.lineWidth = 1.5;
        c.strokeRect(px + 0.75, py + 0.75, TILE - 1.5, TILE - 1.5);
        if (rng.chance(0.55)) {
          c.beginPath();
          const sx = px + rng.range(0, TILE);
          c.moveTo(sx, py + 2);
          c.bezierCurveTo(px + rng.range(0, TILE), py + 20, px + rng.range(0, TILE), py + 44, px + rng.range(0, TILE), py + TILE - 2);
          c.strokeStyle = rgba('#ffffff', 0.13);
          c.lineWidth = rng.range(1, 2.4);
          c.stroke();
        }
        if (x % 3 === 0 && y % 3 === 0) {
          poly(c, [px, py - 6, px + 6, py, px, py + 6, px - 6, py], th.accent, rgba('#000000', 0.4), 1);
        }
        c.fillStyle = 'rgba(255,255,255,0.06)';
        c.fillRect(px + 2, py + 2, TILE - 4, 3);
      }

      // grit
      for (let i = 0; i < 5; i++) {
        c.fillStyle = rng.chance(0.5) ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.05)';
        c.fillRect(px + rng.range(2, 60), py + rng.range(2, 60), rng.range(1, 3), rng.range(1, 3));
      }
    }
  }

  // ---- carpet (shop)
  if (L.carpet) {
    const x0 = TILE * 2.5;
    const y0 = TILE * 2.6;
    const cw = w * TILE - TILE * 5;
    const ch = h * TILE - TILE * 5.2;
    rrect(c, x0, y0, cw, ch, 10, '#63231f', '#2a0f0d', 4);
    rrect(c, x0 + 12, y0 + 12, cw - 24, ch - 24, 6, undefined, '#c9a44c', 3);
    rrect(c, x0 + 22, y0 + 22, cw - 44, ch - 44, 4, undefined, rgba('#c9a44c', 0.45), 1.5);
    for (let i = 0; i < 70; i++) {
      c.fillStyle = 'rgba(0,0,0,0.08)';
      c.fillRect(x0 + rng.range(8, cw - 16), y0 + rng.range(8, ch - 12), rng.range(6, 24), 1.5);
    }
  }

  // ---- boss room floor emblem
  if (node.type === 'boss') {
    const cxp = (w * TILE) / 2;
    const cyp = (h * TILE) / 2;
    c.save();
    c.globalAlpha = 0.5;
    circle(c, cxp, cyp, 190, undefined, th.accent, 5);
    circle(c, cxp, cyp, 172, undefined, rgba('#000000', 0.5), 2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      line(c, cxp + Math.cos(a) * 120, cyp + Math.sin(a) * 120, cxp + Math.cos(a) * 172, cyp + Math.sin(a) * 172, th.accent, 4);
    }
    circle(c, cxp, cyp, 120, undefined, th.accent, 3);
    c.restore();
  }

  // ---- doorway thresholds: darker, with chevrons pointing out
  for (const d of DIRS) {
    if (node.doors[d] === undefined) continue;
    const tiles = doorTiles(w, h, d);
    const x0 = Math.min(tiles[0][0], tiles[1][0]) * TILE;
    const y0 = Math.min(tiles[0][1], tiles[1][1]) * TILE;
    const horiz = d === 'n' || d === 's';
    const dw = horiz ? TILE * 2 : TILE;
    const dh = horiz ? TILE : TILE * 2;
    let g: CanvasGradient;
    if (d === 'n') g = c.createLinearGradient(0, y0 + TILE, 0, y0);
    else if (d === 's') g = c.createLinearGradient(0, y0, 0, y0 + TILE);
    else if (d === 'w') g = c.createLinearGradient(x0 + TILE, 0, x0, 0);
    else g = c.createLinearGradient(x0, 0, x0 + TILE, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.1)');
    g.addColorStop(1, 'rgba(0,0,0,0.88)');
    c.fillStyle = g;
    c.fillRect(x0, y0, dw, dh);
    // chevrons
    c.save();
    c.translate(x0 + dw / 2, y0 + dh / 2);
    c.rotate(d === 'n' ? -Math.PI / 2 : d === 's' ? Math.PI / 2 : d === 'w' ? Math.PI : 0);
    c.strokeStyle = rgba(th.accent, 0.75);
    c.lineWidth = 4;
    c.lineJoin = 'round';
    for (const ox of [-14, -2]) {
      c.beginPath();
      c.moveTo(ox - 6, -13);
      c.lineTo(ox + 6, 0);
      c.lineTo(ox - 6, 13);
      c.stroke();
    }
    c.restore();
  }

  // ---- shadows cast by walls onto the floor (light from the top-left)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!open(x, y)) continue;
      const px = x * TILE;
      const py = y * TILE;
      if (solid(x, y - 1)) {
        const g = c.createLinearGradient(0, py, 0, py + 30);
        g.addColorStop(0, 'rgba(0,0,0,0.5)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(px, py, TILE, 30);
      }
      if (solid(x - 1, y)) {
        const g = c.createLinearGradient(px, 0, px + 24, 0);
        g.addColorStop(0, 'rgba(0,0,0,0.4)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(px, py, 24, TILE);
      }
      if (solid(x, y + 1)) {
        const g = c.createLinearGradient(0, py + TILE, 0, py + TILE - 12);
        g.addColorStop(0, 'rgba(0,0,0,0.26)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(px, py + TILE - 12, TILE, 12);
      }
      if (solid(x + 1, y)) {
        const g = c.createLinearGradient(px + TILE, 0, px + TILE - 12, 0);
        g.addColorStop(0, 'rgba(0,0,0,0.26)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(px + TILE - 12, py, 12, TILE);
      }
    }
  }

  // ---- walls and pillars (drawn on their own layer, above the decals)
  c = wallCtx;
  const blockTop = shade(th.wallEdge, -0.32);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = at(x, y);
      if (t !== T.WALL && t !== T.BLOCK) continue;
      const px = x * TILE;
      const py = y * TILE;
      const block = t === T.BLOCK;
      // free-standing pillars get a lighter top face so they read as raised stone, not holes
      c.fillStyle = shade(block ? blockTop : th.wallTop, rng.range(-0.04, 0.04));
      c.fillRect(px, py, TILE, TILE);
      // masonry joints
      const joint = rgba(th.wallDark, block ? 0.55 : 0.8);
      for (let r = 0; r < 3; r++) {
        const yy = py + r * (TILE / 3);
        line(c, px, yy, px + TILE, yy, joint, 1.5);
        const off = r % 2 === 0 ? TILE / 2 : TILE / 4;
        line(c, px + off, yy, px + off, yy + TILE / 3, joint, 1.5);
        if (r % 2 === 1) line(c, px + off + TILE / 2, yy, px + off + TILE / 2, yy + TILE / 3, joint, 1.5);
      }
      if (block) {
        c.fillStyle = 'rgba(255,255,255,0.05)';
        c.fillRect(px, py, TILE, TILE / 3);
      }
    }
  }
  // bevels where a wall meets open floor
  const B = 8;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      const px = x * TILE;
      const py = y * TILE;
      const lit = shade(th.wallEdge, 0.12);
      const dim = shade(th.wallEdge, -0.3);
      if (open(x, y + 1)) {
        c.fillStyle = dim;
        c.fillRect(px, py + TILE - B, TILE, B);
        line(c, px, py + TILE - 1, px + TILE, py + TILE - 1, INK, 2);
      }
      if (open(x + 1, y)) {
        c.fillStyle = dim;
        c.fillRect(px + TILE - B, py, B, TILE);
        line(c, px + TILE - 1, py, px + TILE - 1, py + TILE, INK, 2);
      }
      if (open(x, y - 1)) {
        c.fillStyle = lit;
        c.fillRect(px, py, TILE, B);
        line(c, px, py + 1, px + TILE, py + 1, INK, 2);
      }
      if (open(x - 1, y)) {
        c.fillStyle = lit;
        c.fillRect(px, py, B, TILE);
        line(c, px + 1, py, px + 1, py + TILE, INK, 2);
      }
    }
  }
  // door frame posts
  for (const d of DIRS) {
    if (node.doors[d] === undefined) continue;
    const tiles = doorTiles(w, h, d);
    for (const [tx, ty] of tiles) {
      const horiz = d === 'n' || d === 's';
      for (const s of [-1, 1]) {
        const nx = horiz ? tx + s : tx;
        const ny = horiz ? ty : ty + s;
        if (at(nx, ny) !== T.WALL) continue;
        const px = nx * TILE;
        const py = ny * TILE;
        if (horiz) rrect(c, s < 0 ? px + TILE - 14 : px, py + 4, 14, TILE - 8, 3, th.accent, INK, 2.5);
        else rrect(c, px + 4, s < 0 ? py + TILE - 14 : py, TILE - 8, 14, 3, th.accent, INK, 2.5);
      }
    }
  }

  // ---- fade the outer edge of the wall ring into the void
  const edge = 26;
  const fade = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(0,0,0,0.85)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(rx, ry, rw, rh);
  };
  fade(0, 0, 0, edge, 0, 0, w * TILE, edge);
  fade(0, h * TILE, 0, h * TILE - edge, 0, h * TILE - edge, w * TILE, edge);
  fade(0, 0, edge, 0, 0, 0, edge, h * TILE);
  fade(w * TILE, 0, w * TILE - edge, 0, w * TILE - edge, 0, edge, h * TILE);
}
