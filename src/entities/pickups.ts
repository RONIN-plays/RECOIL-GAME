import Phaser from 'phaser';
import { DEPTH, FONT } from '../config';
import { audio } from '../core/audio';
import { isTouch } from '../core/device';
import { TAU } from '../core/math';
import { rnd } from '../core/rng';
import type { GameScene } from '../scenes/GameScene';
import type { SavedItem } from '../world/floorgen';
import { UPGRADE_MAP } from './upgrades';
import { WEAPONS, type WeaponInst, makeWeapon } from './weapons';

export type PickKind =
  | 'coin' | 'coinBig' | 'heart' | 'half' | 'ammo' | 'blank' | 'armor'
  | 'weapon' | 'chest' | 'shop' | 'upgrade' | 'stairs';

export interface PickData {
  weapon?: string;
  clip?: number;
  reserve?: number;
  upgrade?: string;
  /** Shop stock: what is being sold. */
  item?: 'weapon' | 'upgrade' | 'heart' | 'ammo' | 'blank' | 'armor';
  price?: number;
  /** Upgrade pedestals sharing a group vanish together when one is taken. */
  group?: number;
  opened?: boolean;
}

export interface Pickup {
  kind: PickKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  dead: boolean;
  data: PickData;
  img: Phaser.GameObjects.Image;
  base: Phaser.GameObjects.Image | null;
  shadow: Phaser.GameObjects.Image | null;
  label: Phaser.GameObjects.Text | null;
  phase: number;
}

export interface InteractInfo {
  title: string;
  desc: string;
  price: number;
  action: string;
}

const AUTO = new Set<PickKind>(['coin', 'coinBig', 'heart', 'half', 'ammo', 'blank', 'armor']);
const TEX: Partial<Record<PickKind, string>> = {
  coin: 'coin', coinBig: 'coinBig', heart: 'p_heart', half: 'p_half', ammo: 'p_ammo', blank: 'p_blank', armor: 'p_armor',
  chest: 'chest', stairs: 'stairs',
};
const SHOP_ICON: Record<string, string> = { heart: 'p_heart', ammo: 'p_ammo', blank: 'p_blank', armor: 'p_armor' };
const SHOP_INFO: Record<string, [string, string]> = {
  heart: ['Heart', 'Restores one full heart'],
  ammo: ['Ammo Crate', 'Refills reserve ammo for every gun'],
  blank: ['Blast Charge', 'One extra Blast: wipes every bullet on screen'],
  armor: ['Armor Plate', 'Absorbs one hit'],
};

export class Pickups {
  list: Pickup[] = [];
  /** When true every coin flies to the player (set after a room is cleared). */
  vacuum = false;

  constructor(private scene: GameScene) {}

  spawn(kind: PickKind, x: number, y: number, data: PickData = {}, scatter = 0): Pickup {
    const s = this.scene;
    let key = TEX[kind] ?? 'coin';
    let base: Phaser.GameObjects.Image | null = null;
    let label: Phaser.GameObjects.Text | null = null;
    let shadow: Phaser.GameObjects.Image | null = null;
    let depth: number = DEPTH.PICKUP;

    if (kind === 'weapon') key = `wi_${data.weapon}`;
    if (kind === 'chest' && data.opened) key = 'chestOpen';
    if (kind === 'upgrade') key = `up_${data.upgrade}`;
    if (kind === 'shop') {
      if (data.item === 'weapon') key = `wi_${data.weapon}`;
      else if (data.item === 'upgrade') key = `up_${data.upgrade}`;
      else key = SHOP_ICON[data.item ?? 'heart'];
    }
    if (kind === 'shop' || kind === 'upgrade') {
      base = s.add.image(x, y + 8, 'pedestal').setDepth(DEPTH.PICKUP);
      depth = DEPTH.PICKUP + 0.5;
    }
    if (kind === 'stairs') depth = DEPTH.GROUNDFX;
    if (kind !== 'stairs' && kind !== 'chest' && !base) {
      shadow = s.add.image(x + 2, y + 8, 'shadow').setDepth(DEPTH.SHADOW).setScale(kind === 'weapon' ? 0.9 : 0.42).setAlpha(0.7);
    }
    const img = s.add.image(x, y, key).setDepth(depth);
    if (kind === 'weapon' || (kind === 'shop' && data.item === 'weapon')) img.setScale(0.5).setRotation(-0.35);
    if (kind === 'upgrade' || (kind === 'shop' && data.item === 'upgrade')) img.setScale(0.8);
    if (kind === 'shop') {
      label = s.add.text(x, y + 58, String(data.price ?? 0), { fontFamily: FONT, fontSize: isTouch() ? '32px' : '24px', fontStyle: '700', color: '#f3cf62' })
        .setOrigin(0.5).setDepth(DEPTH.WTEXT).setStroke('#17120f', 5);
    }
    const a = rnd(0, TAU);
    const v = scatter * rnd(0.4, 1);
    const p: Pickup = {
      kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, dead: false, data, img, base, shadow, label,
      phase: rnd(0, TAU),
    };
    this.list.push(p);
    return p;
  }

  dropCoins(x: number, y: number, amount: number): void {
    let left = amount;
    while (left >= 5 && Math.random() < 0.7) {
      this.spawn('coinBig', x, y, {}, 300);
      left -= 5;
    }
    for (let i = 0; i < left; i++) this.spawn('coin', x, y, {}, 280);
  }

  private remove(p: Pickup): void {
    p.dead = true;
    p.img.destroy();
    p.base?.destroy();
    p.shadow?.destroy();
    p.label?.destroy();
  }

  clear(): void {
    for (const p of this.list) this.remove(p);
    this.list = [];
    this.vacuum = false;
  }

  // ------------------------------------------------------------ persistence

  save(): SavedItem[] {
    return this.list
      .filter((p) => !p.dead && p.kind !== 'coin' && p.kind !== 'coinBig')
      .map((p) => ({ kind: p.kind, x: p.x, y: p.y, data: { ...p.data } }));
  }

  restore(items: SavedItem[]): void {
    for (const it of items) this.spawn(it.kind as PickKind, it.x, it.y, (it.data ?? {}) as PickData);
  }

  // ------------------------------------------------------------ interaction

  nearest(maxDist = 84): Pickup | null {
    const pl = this.scene.player;
    let best: Pickup | null = null;
    let bd = maxDist * maxDist;
    for (const p of this.list) {
      if (p.dead || AUTO.has(p.kind)) continue;
      if (p.kind === 'chest' && p.data.opened) continue;
      const r = p.kind === 'stairs' ? 20 : 0;
      const dx = p.x - pl.x;
      const dy = p.y - pl.y;
      const d2 = dx * dx + dy * dy - r * r;
      if (d2 < bd) {
        bd = d2;
        best = p;
      }
    }
    return best;
  }

  info(p: Pickup): InteractInfo {
    const wdesc = (id: string) => {
      const w = WEAPONS[id];
      const dmg = w.pellets > 1 ? `${w.pellets}x${w.dmg}` : `${w.dmg}`;
      return `${w.desc}   ·   ${dmg} dmg   ·   ${w.clip} rounds`;
    };
    switch (p.kind) {
      case 'weapon': {
        const owned = this.scene.player.weapons.some((w) => w.def.id === p.data.weapon);
        return { title: WEAPONS[p.data.weapon!].name, desc: owned ? 'You already carry this: take its ammo' : wdesc(p.data.weapon!), price: 0, action: owned ? 'TAKE AMMO' : 'PICK UP' };
      }
      case 'chest':
        return { title: 'Chest', desc: 'Something heavy rattles inside', price: 0, action: 'OPEN' };
      case 'upgrade': {
        const u = UPGRADE_MAP[p.data.upgrade!];
        return { title: u.name, desc: u.desc, price: 0, action: 'TAKE (the other vanishes)' };
      }
      case 'stairs':
        return { title: 'Descend', desc: 'Go deeper', price: 0, action: 'DESCEND' };
      default: {
        const price = p.data.price ?? 0;
        if (p.data.item === 'weapon') return { title: WEAPONS[p.data.weapon!].name, desc: wdesc(p.data.weapon!), price, action: 'BUY' };
        if (p.data.item === 'upgrade') {
          const u = UPGRADE_MAP[p.data.upgrade!];
          return { title: u.name, desc: u.desc, price, action: 'BUY' };
        }
        const [title, desc] = SHOP_INFO[p.data.item ?? 'heart'];
        return { title, desc, price, action: 'BUY' };
      }
    }
  }

  private takeWeapon(id: string, x: number, y: number, clip?: number, reserve?: number): void {
    const s = this.scene;
    const inst: WeaponInst = makeWeapon(id);
    if (clip !== undefined) inst.clip = clip;
    if (reserve !== undefined) inst.reserve = reserve;
    const dropped = s.player.giveWeapon(inst);
    if (dropped) {
      this.spawn('weapon', x, y, { weapon: dropped.def.id, clip: dropped.clip, reserve: dropped.reserve }, 0);
    }
    s.fx.text(s.player.x, s.player.y - 50, WEAPONS[id].name.toUpperCase(), '#f3e6c8', 26, 1.0);
    audio.play('pickup');
  }

  interact(p: Pickup): void {
    const s = this.scene;
    const pl = s.player;
    switch (p.kind) {
      case 'weapon':
        this.remove(p);
        this.takeWeapon(p.data.weapon!, p.x, p.y, p.data.clip, p.data.reserve);
        break;
      case 'chest': {
        p.data.opened = true;
        p.img.setTexture('chestOpen');
        audio.play('doorOpen');
        audio.play('upgrade', 0.7);
        s.fx.ring(p.x, p.y, 20, 140, 0.4, 0xffd27a, 0.8);
        s.fx.sparks(p.x, p.y, 0, 14, 0xffd27a, Math.PI, 380);
        s.fx.shake(0.15);
        const w = this.spawn('weapon', p.x, p.y + 6, { weapon: p.data.weapon }, 0);
        w.vy = 190;
        this.dropCoins(p.x, p.y, 4 + Math.floor(Math.random() * 5));
        break;
      }
      case 'upgrade': {
        const group = p.data.group;
        s.addUpgrade(p.data.upgrade!);
        for (const q of this.list) {
          if (q.kind === 'upgrade' && q.data.group === group && !q.dead) {
            s.fx.smoke(q.x, q.y, 4, 0.6, 0x6a655c);
            this.remove(q);
          }
        }
        break;
      }
      case 'stairs':
        s.descend();
        break;
      case 'shop': {
        const price = p.data.price ?? 0;
        if (s.run.coins < price) {
          audio.play('deny');
          s.fx.text(p.x, p.y - 40, 'NOT ENOUGH COIN', '#d8452f', 22, 0.8);
          return;
        }
        const item = p.data.item ?? 'heart';
        if (item === 'heart' && pl.hp >= pl.maxHp) {
          audio.play('deny');
          s.fx.text(p.x, p.y - 40, 'ALREADY AT FULL HEALTH', '#d8452f', 22, 0.8);
          return;
        }
        if (item === 'ammo' && !pl.needsAmmo()) {
          audio.play('deny');
          s.fx.text(p.x, p.y - 40, 'AMMO ALREADY FULL', '#d8452f', 22, 0.8);
          return;
        }
        s.run.coins -= price;
        audio.play('buy');
        s.fx.sparks(p.x, p.y, 0, 10, 0xf3cf62, Math.PI, 320);
        if (item === 'weapon') this.takeWeapon(p.data.weapon!, p.x, p.y + 70);
        else if (item === 'upgrade') s.addUpgrade(p.data.upgrade!);
        else if (item === 'heart') pl.heal(2);
        else if (item === 'ammo') pl.addAmmo(1);
        else if (item === 'blank') pl.blanks++;
        else if (item === 'armor') pl.armor++;
        this.remove(p);
        break;
      }
    }
    this.list = this.list.filter((q) => !q.dead);
  }

  // ------------------------------------------------------------ update

  update(dt: number, time: number): void {
    const s = this.scene;
    const pl = s.player;
    const magnetR = 115 * s.run.stats.magnet;
    let removed = false;

    for (const p of this.list) {
      if (p.dead) continue;
      p.t += dt;

      if (p.vx !== 0 || p.vy !== 0) {
        s.room.collide(p.x + p.vx * dt, p.y + p.vy * dt, 9, true);
        p.x = s.room.cx;
        p.y = s.room.cy;
        const k = Math.exp(-5 * dt);
        p.vx *= k;
        p.vy *= k;
        if (Math.abs(p.vx) + Math.abs(p.vy) < 4) p.vx = p.vy = 0;
      }

      if (AUTO.has(p.kind) && !pl.dead) {
        const dx = pl.x - p.x;
        const dy = pl.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const coin = p.kind === 'coin' || p.kind === 'coinBig';
        const wanted =
          coin ||
          ((p.kind === 'heart' || p.kind === 'half') && pl.hp < pl.maxHp) ||
          (p.kind === 'ammo' && pl.needsAmmo()) ||
          p.kind === 'blank' || p.kind === 'armor';
        if (wanted && p.t > 0.3 && (d < magnetR || (coin && this.vacuum))) {
          const pull = coin && this.vacuum ? 1400 : 900;
          p.vx += (dx / d) * pull * dt * 6;
          p.vy += (dy / d) * pull * dt * 6;
          const sp = Math.hypot(p.vx, p.vy);
          if (sp > pull) {
            p.vx = (p.vx / sp) * pull;
            p.vy = (p.vy / sp) * pull;
          }
        }
        if (wanted && p.t > 0.15 && d < pl.r + 16) {
          this.collect(p);
          removed = true;
          continue;
        }
      }

      // presentation
      const bob = AUTO.has(p.kind) ? Math.sin(time * 0.005 + p.phase) * 2.5 : 0;
      if (p.kind === 'weapon') {
        p.img.setPosition(p.x, p.y + Math.sin(time * 0.004 + p.phase) * 3);
        p.shadow?.setPosition(p.x + 2, p.y + 14);
      } else if (p.kind === 'upgrade' || p.kind === 'shop') {
        p.img.setPosition(p.x, p.y - 6 + Math.sin(time * 0.004 + p.phase) * 3);
        if (p.label) p.label.setColor(s.run.coins >= (p.data.price ?? 0) ? '#f3cf62' : '#b0554a');
      } else {
        p.img.setPosition(p.x, p.y + bob);
        p.shadow?.setPosition(p.x + 2, p.y + 8);
      }
      if (p.kind === 'coin' || p.kind === 'coinBig') p.img.setScale(1, 0.75 + 0.25 * Math.abs(Math.sin(time * 0.006 + p.phase)));
      if (p.t < 0.2 && p.kind !== 'stairs') p.img.setAlpha(p.t / 0.2);
      else p.img.setAlpha(1);
    }
    if (removed) this.list = this.list.filter((q) => !q.dead);
  }

  private collect(p: Pickup): void {
    const s = this.scene;
    const pl = s.player;
    switch (p.kind) {
      case 'coin':
      case 'coinBig': {
        const v = p.kind === 'coin' ? 1 : 5;
        s.run.coins += v;
        s.run.coinsEarned += v;
        audio.play('coin');
        s.fx.emit('soft', p.x, p.y, { life: 0.18, s0: 0.3, s1: 0.7, a0: 0.7, a1: 0, tint: 0xffd27a, add: true, depth: DEPTH.GLOW });
        break;
      }
      case 'heart':
      case 'half':
        pl.heal(p.kind === 'heart' ? 2 : 1);
        audio.play('heart');
        s.fx.ring(pl.x, pl.y, 20, 90, 0.35, 0xff6a5a, 0.8, 'ringThin');
        s.fx.text(pl.x, pl.y - 44, p.kind === 'heart' ? '+1 HEART' : '+HALF HEART', '#ff8a7a', 24, 0.8);
        break;
      case 'ammo':
        pl.addAmmo(0.4);
        audio.play('pickup');
        s.fx.text(pl.x, pl.y - 44, '+AMMO', '#d9c07a', 24, 0.8);
        break;
      case 'blank':
        pl.blanks++;
        audio.play('pickup');
        s.fx.text(pl.x, pl.y - 44, '+1 BLAST', '#9fd0e0', 24, 0.8);
        break;
      case 'armor':
        pl.armor++;
        audio.play('pickup');
        s.fx.text(pl.x, pl.y - 44, '+1 ARMOR', '#9fc8ea', 24, 0.8);
        break;
    }
    this.remove(p);
  }
}
