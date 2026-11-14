import Phaser from 'phaser';
import { DEPTH, TILE } from '../config';
import { audio } from '../core/audio';
import { TAU, angDiff, clamp, easeOutBack, rotateToward } from '../core/math';
import { rnd, rndSign } from '../core/rng';
import type { GameScene } from '../scenes/GameScene';
import { type BossDef, BossRunner } from './boss';
import type { Bullet } from './bullets';
import { ENEMY_DEFS, type EnemyDef, type EnemyType } from './enemyDefs';

export class Enemy {
  id = 0;
  type: EnemyType | 'boss' = 'grunt';
  def!: EnemyDef;
  x = 0;
  y = 0;
  /** Knockback velocity. */
  kx = 0;
  ky = 0;
  hp = 1;
  maxHp = 1;
  r = 16;
  ang = 0;
  speed = 0;
  state = 'move';
  t = 0;
  cd = 1;
  n = 0;
  a = 0;
  strafe = 1;
  strafeT = 0;
  elite = false;
  spawnT = 0.3;
  flash = 0;
  stun = 0;
  dead = false;
  losT = 0;
  hasLos = false;
  dmgAcc = 0;
  dmgT = 0;
  dmgCrit = false;
  barT = 0;
  contact = false;
  scale = 1;
  boss: BossRunner | null = null;
  bossDef: BossDef | null = null;
  img!: Phaser.GameObjects.Image;
  shadow!: Phaser.GameObjects.Image;
  aux: Phaser.GameObjects.Image | null = null;
  glint!: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Image | null = null;
  /** Where the bullets come out, in front of the centre. */
  muzzle = 30;
  /** Bulwark only: damage the shield can still soak before it shatters. */
  shield = 0;
  auxFlash = 0;
}

interface PendingSpawn {
  type: EnemyType;
  x: number;
  y: number;
  t: number;
  elite: boolean;
  mark: Phaser.GameObjects.Image;
}

const TEX: Record<EnemyType, string> = {
  grunt: 'e_grunt', shotgunner: 'e_shotgunner', swarmer: 'e_swarmer', charger: 'e_charger', sniper: 'e_sniper',
  grenadier: 'e_grenadier', turret: 'e_turretBase', heavy: 'e_heavy', drone: 'e_drone',
};
const MUZZLE: Record<EnemyType, number> = {
  grunt: 36, shotgunner: 40, swarmer: 0, charger: 0, sniper: 66, grenadier: 38, turret: 40, heavy: 48, drone: 26,
};
/** A charger with line of sight stops this far (centre to centre, px) from the player and backs off if closer. */
const CHARGER_HOLD = 100;
/** Machines leave oil, not blood. */
const MACHINE = new Set<string>(['turret', 'drone']);

export class Enemies {
  list: Enemy[] = [];
  pending: PendingSpawn[] = [];
  private nextId = 1;
  private bars: Phaser.GameObjects.Graphics;
  private tmp = { x: 0, y: 0 };

  constructor(private scene: GameScene) {
    this.bars = scene.add.graphics().setDepth(DEPTH.WTEXT);
  }

  get aliveCount(): number {
    return this.list.length + this.pending.length;
  }

  // ------------------------------------------------------------ spawning

  /** Schedules a wave: markers appear on the floor first so nothing spawns unfairly. */
  spawnWave(types: EnemyType[]): void {
    const s = this.scene;
    const room = s.room;
    let packAnchor: { x: number; y: number } | null = null;
    let lastType: EnemyType | null = null;
    let delay = 0.55;
    const eliteChance = s.run.floorIndex === 0 && s.run.loop === 0 ? 0 : 0.07 + 0.04 * s.run.floorIndex + 0.1 * s.run.loop;
    for (const type of types) {
      const def = ENEMY_DEFS[type];
      let pos: { x: number; y: number };
      if (def.pack && lastType === type && packAnchor) {
        pos = { x: packAnchor.x + rnd(-40, 40), y: packAnchor.y + rnd(-40, 40) };
        if (room.solidAt(pos.x, pos.y)) pos = { ...packAnchor };
      } else {
        pos = this.spawnPoint(type === 'sniper' || type === 'turret' ? 420 : 330);
        packAnchor = pos;
        delay += rnd(0.08, 0.2);
      }
      lastType = type;
      const elite = !def.pack && Math.random() < eliteChance;
      const mark = s.add.image(pos.x, pos.y, 'spawnMark').setDepth(DEPTH.GROUNDFX).setTint(elite ? 0xe2b23c : 0xd8452f)
        .setAlpha(0).setScale(def.r / 26);
      this.pending.push({ type, x: pos.x, y: pos.y, t: delay, elite, mark });
    }
  }

  private spawnPoint(minDist: number): { x: number; y: number } {
    const s = this.scene;
    const room = s.room;
    for (let i = 0; i < 30; i++) {
      const p = room.randomFree(s.player.x, s.player.y, minDist, 2);
      if (room.flowDist(p.x, p.y) < 0) continue;
      let ok = true;
      for (const q of this.pending) {
        if (Math.abs(q.x - p.x) < 60 && Math.abs(q.y - p.y) < 60) ok = false;
      }
      if (ok) return p;
    }
    return room.randomFree(s.player.x, s.player.y, minDist * 0.6, 2);
  }

  spawn(type: EnemyType, x: number, y: number, elite = false): Enemy {
    const s = this.scene;
    const def = ENEMY_DEFS[type];
    const e = new Enemy();
    e.id = this.nextId++;
    e.type = type;
    e.def = def;
    e.x = x;
    e.y = y;
    e.elite = elite;
    e.scale = elite ? 1.16 : 1;
    const hpMul = (1 + 0.28 * s.run.floorIndex) * (1 + 0.6 * s.run.loop) * (elite ? 2.3 : 1);
    e.hp = e.maxHp = Math.round(def.hp * hpMul);
    e.r = def.r * e.scale;
    e.speed = def.speed * (elite ? 1.1 : 1) * (1 + 0.04 * s.run.floorIndex);
    e.muzzle = MUZZLE[type] * e.scale;
    e.ang = Math.atan2(s.player.y - y, s.player.x - x);
    e.cd = rnd(0.7, 1.7);
    e.strafe = rndSign();
    e.contact = type === 'swarmer';
    e.shadow = s.add.image(x + 4, y + 6, 'shadow').setDepth(DEPTH.SHADOW).setScale((e.r / 20) * 1.1);
    if (elite) e.ring = s.add.image(x, y, 'eliteRing').setDepth(DEPTH.GROUNDFX).setScale(e.r / 30).setAlpha(0.85);
    e.img = s.add.image(x, y, TEX[type]).setDepth(DEPTH.ENEMY);
    if (type === 'sniper') e.img.setOrigin(36 / 104, 0.5);
    if (type === 'turret') {
      e.aux = s.add.image(x, y, 'e_turret').setDepth(DEPTH.ENEMY).setOrigin(30 / 72, 0.5);
      e.state = 'idle';
      e.cd = rnd(1.0, 1.6);
    }
    if (type === 'heavy') {
      e.aux = s.add.image(x, y, 'e_shield').setDepth(DEPTH.ENEMY);
      e.shield = 90 * hpMul;
    }
    if (type === 'charger' || type === 'sniper') {
      e.aux = s.add.image(x, y, 'px').setDepth(DEPTH.GROUNDFX).setOrigin(0, 0.5).setTint(0xd8452f).setVisible(false);
    }
    if (type === 'drone') {
      e.a = Math.PI / 4 + Math.floor(Math.random() * 4) * (Math.PI / 2);
    }
    e.glint = s.add.image(x, y, 'soft').setDepth(DEPTH.GLOW).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.list.push(e);
    s.fx.dust(x, y, 6, 0x9a8f80, 120, 0.6);
    return e;
  }

  spawnBoss(def: BossDef, x: number, y: number): Enemy {
    const s = this.scene;
    const e = new Enemy();
    e.id = this.nextId++;
    e.type = 'boss';
    e.bossDef = def;
    e.def = { name: def.name, hp: def.hp, speed: 0, r: def.r, cost: 0, minFloor: 0, minDepth: 0, coins: [30, 40], score: 1500, mass: 30, tint: def.tint };
    e.x = x;
    e.y = y;
    e.hp = e.maxHp = Math.round(def.hp * (1 + 0.75 * s.run.loop));
    e.r = def.r;
    e.contact = true;
    e.spawnT = 0;
    e.muzzle = def.muzzle;
    e.ang = Math.PI / 2;
    e.shadow = s.add.image(x + 8, y + 12, 'shadow').setDepth(DEPTH.SHADOW).setScale(def.r / 17);
    e.img = s.add.image(x, y, def.tex).setDepth(DEPTH.ENEMY);
    e.aux = s.add.image(x, y, 'px').setDepth(DEPTH.GROUNDFX).setOrigin(0, 0.5).setTint(0xd8452f).setVisible(false);
    e.glint = s.add.image(x, y, 'soft').setDepth(DEPTH.GLOW).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    e.boss = new BossRunner(s, e, def);
    this.list.push(e);
    return e;
  }

  // ------------------------------------------------------------ damage

  hitByBullet(e: Enemy, b: Bullet): 'hit' | 'blocked' {
    const s = this.scene;
    const ang = Math.atan2(b.vy, b.vx);
    if (e.type === 'heavy' && e.shield > 0 && e.stun <= 0) {
      // the shield covers a front arc: flank it, or hammer it until it shatters
      if (Math.abs(angDiff(e.ang, ang + Math.PI)) < 0.95) {
        s.fx.sparks(b.x, b.y, ang + Math.PI, 5, 0xcfe4ff, 1.0, 380);
        audio.play('shield');
        e.kx += Math.cos(ang) * b.knock * 0.08;
        e.ky += Math.sin(ang) * b.knock * 0.08;
        e.shield -= b.dmg;
        e.auxFlash = 0.06;
        if (e.shield <= 0) this.breakShield(e);
        return 'blocked';
      }
    }
    this.damage(e, b.dmg, ang, b.knock, b.crit, b.x, b.y);
    if (s.run.stats.explode > 0 && Math.random() < s.run.stats.explode && !e.dead) {
      s.explode(b.x, b.y, 80, { enemyDmg: 22 * s.run.stats.dmg, hurtPlayer: false });
    }
    return 'hit';
  }

  damage(e: Enemy, dmg: number, ang: number, knock: number, crit: boolean, hx = e.x, hy = e.y): void {
    if (e.dead || e.spawnT > 0) return;
    const s = this.scene;
    if (e.boss && e.boss.invulnerable) return;
    e.hp -= dmg;
    e.flash = 0.07;
    e.barT = 2.5;
    e.dmgAcc += dmg;
    e.dmgCrit = e.dmgCrit || crit;
    const m = e.def.mass;
    e.kx += (Math.cos(ang) * knock) / m;
    e.ky += (Math.sin(ang) * knock) / m;
    s.run.damageDealt += dmg;

    const machine = MACHINE.has(e.type) || (e.bossDef?.machine ?? false);
    if (machine) s.fx.sparks(hx, hy, ang + Math.PI, 4, 0xffd9a0, 1.1, 340);
    else s.fx.blood(hx, hy, ang, 0.6);
    s.fx.sparks(hx, hy, ang + Math.PI, 2, 0xffffff, 0.8, 260);
    audio.play(crit ? 'crit' : 'hit');

    if (e.hp <= 0) this.kill(e, ang);
  }

  private breakShield(e: Enemy): void {
    const s = this.scene;
    e.shield = 0;
    e.aux?.destroy();
    e.aux = null;
    e.stun = 0.9;
    s.fx.sparks(e.x, e.y, e.ang, 16, 0xcfe4ff, 1.4, 520);
    s.fx.debris(e.x + Math.cos(e.ang) * 30, e.y + Math.sin(e.ang) * 30, e.ang, 8, 0x93a0b2, 'chunk', 420, 1.3);
    s.fx.ring(e.x, e.y, 30, 120, 0.25, 0xcfe4ff, 0.8, 'ringThin');
    s.fx.text(e.x, e.y - e.r - 20, 'SHIELD BROKEN', '#cfe4ff', 22, 0.8);
    s.fx.shake(0.25);
    audio.play('wallHit', 0.8);
  }

  kill(e: Enemy, ang = 0): void {
    if (e.dead) return;
    e.dead = true;
    const s = this.scene;
    const big = e.r >= 24;
    const machine = MACHINE.has(e.type) || (e.bossDef?.machine ?? false);

    if (!e.boss) {
      if (machine) {
        s.fx.sparks(e.x, e.y, 0, 14, 0xffc060, Math.PI, 520);
        s.fx.smoke(e.x, e.y, 5, 0.9);
        s.fx.debris(e.x, e.y, ang, 9, 0x3a3c42, 'chunk', 460, 1.6);
        s.room.decal('scorch', e.x, e.y, 0.6, rnd(0, TAU), 0xffffff, 0.6);
      } else {
        s.fx.blood(e.x, e.y, ang, big ? 3.2 : 2);
        s.fx.debris(e.x, e.y, ang, big ? 9 : 5, e.def.tint, 'chunk', 420, 1.2);
        s.fx.dust(e.x, e.y, 5, 0x8a7f70, 140, 0.7);
      }
      s.fx.ring(e.x, e.y, e.r * 0.6, e.r * 2.4, 0.2, 0xfff0d0, 0.5, 'ringThin');
      s.fx.shake(big ? 0.3 : 0.16);
      s.fx.hitstop(big ? 0.06 : 0.028);
      audio.play('kill', big ? 1.1 : 0.8);
    }
    this.flushDamageText(e);
    // a boss keeps its body on screen for the death sequence; the scene cleans it up
    if (!e.boss) this.destroySprites(e);
    this.list = this.list.filter((q) => q !== e);
    s.onEnemyKilled(e, ang);
  }

  private destroySprites(e: Enemy): void {
    e.img.destroy();
    e.shadow.destroy();
    e.aux?.destroy();
    e.glint.destroy();
    e.ring?.destroy();
  }

  private flushDamageText(e: Enemy): void {
    if (e.dmgAcc <= 0) return;
    const v = Math.round(e.dmgAcc);
    if (v > 0) this.scene.fx.text(e.x, e.y - e.r - 12, String(v), e.dmgCrit ? '#ffd24a' : '#ffffff', e.dmgCrit ? 34 : 24, 0.55);
    e.dmgAcc = 0;
    e.dmgCrit = false;
    e.dmgT = 0.14;
  }

  /** Removes everything without drops or score (room change, restart). */
  clear(): void {
    for (const e of this.list) this.destroySprites(e);
    for (const p of this.pending) p.mark.destroy();
    this.list = [];
    this.pending = [];
    this.bars.clear();
  }

  /** Shove and briefly stun everything near a point (blank, boss slam). */
  shove(x: number, y: number, radius: number, force: number, stun: number): void {
    for (const e of this.list) {
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d > radius) continue;
      const k = (1 - d / radius) * force;
      e.kx += ((dx / d) * k) / e.def.mass;
      e.ky += ((dy / d) * k) / e.def.mass;
      if (!e.boss) e.stun = Math.max(e.stun, stun);
    }
  }

  // ------------------------------------------------------------ update

  update(dt: number, time: number): void {
    const s = this.scene;
    const room = s.room;
    const p = s.player;

    // pending spawns
    for (const sp of this.pending) {
      sp.t -= dt;
      const k = clamp(1 - sp.t / 0.55, 0, 1);
      sp.mark.setAlpha(0.25 + 0.6 * k).setRotation(time * 0.004);
      if (sp.t <= 0) {
        sp.mark.destroy();
        this.spawn(sp.type, sp.x, sp.y, sp.elite);
        audio.play('spawn');
      }
    }
    this.pending = this.pending.filter((sp) => sp.t > 0);

    this.bars.clear();
    const list = this.list;

    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead) continue;

      if (e.spawnT > 0) {
        e.spawnT -= dt;
        const k = clamp(1 - e.spawnT / 0.3, 0, 1);
        e.img.setScale(e.scale * easeOutBack(k)).setAlpha(k);
        e.aux?.setAlpha(k);
        continue;
      }

      // timers
      e.t -= dt;
      e.cd -= dt;
      e.losT -= dt;
      if (e.losT <= 0) {
        e.losT = 0.12 + Math.random() * 0.08;
        e.hasLos = room.los(e.x, e.y, p.x, p.y);
      }
      if (e.dmgT > 0) e.dmgT -= dt;
      else if (e.dmgAcc > 0) this.flushDamageText(e);

      // knockback
      if (e.kx !== 0 || e.ky !== 0) {
        if (e.type !== 'turret') {
          room.collide(e.x + e.kx * dt, e.y + e.ky * dt, e.r * 0.85, true);
          e.x = room.cx;
          e.y = room.cy;
        }
        const k = Math.exp(-9 * dt);
        e.kx *= k;
        e.ky *= k;
        if (Math.abs(e.kx) + Math.abs(e.ky) < 2) e.kx = e.ky = 0;
      }

      if (e.stun > 0) {
        // being stunned (blast, shield break, hitting a wall) cancels whatever attack was winding up
        e.stun -= dt;
        e.glint.setVisible(false);
        if (!e.boss) {
          if ((e.type === 'sniper' || e.type === 'charger') && e.aux) e.aux.setVisible(false);
          if (e.type === 'turret') e.state = 'idle';
          else if (e.state !== 'move') {
            e.state = 'move';
            e.cd = Math.max(e.cd, 0.6);
          }
          e.contact = e.type === 'swarmer';
        }
      } else if (e.boss) {
        e.boss.update(dt);
      } else if (!p.dead) {
        this.think(e, dt, time);
      }
      if (e.dead) continue;

      // soft separation so enemies don't stack
      if (e.type !== 'turret' && !e.boss) {
        for (let j = i + 1; j < list.length; j++) {
          const o = list[j];
          if (o.boss || o.spawnT > 0) continue;
          const dx = o.x - e.x;
          const dy = o.y - e.y;
          const min = (e.r + o.r) * 0.9;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 < 0.01) continue;
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.5;
          const ux = dx / d;
          const uy = dy / d;
          if (o.type === 'turret') {
            e.x -= ux * push * 2;
            e.y -= uy * push * 2;
          } else {
            e.x -= ux * push;
            e.y -= uy * push;
            o.x += ux * push;
            o.y += uy * push;
          }
        }
      }

      // contact damage
      if (e.contact && !p.dead) {
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const rr = e.r * 0.8 + p.hitR;
        if (dx * dx + dy * dy < rr * rr) {
          if (p.hurt(Math.atan2(dy, dx)) && e.type === 'swarmer') {
            e.kx -= Math.cos(Math.atan2(dy, dx)) * 500;
            e.ky -= Math.sin(Math.atan2(dy, dx)) * 500;
            e.stun = 0.35;
          }
        }
      }

      this.render(e, dt, time);
    }
  }

  private render(e: Enemy, dt: number, time: number): void {
    if (e.type === 'charger' && e.state === 'windup') e.img.setPosition(e.x + rnd(-2.5, 2.5), e.y + rnd(-2.5, 2.5));
    else e.img.setPosition(e.x, e.y);
    if (e.type === 'drone') e.img.rotation += dt * 6;
    else if (e.type !== 'turret') e.img.rotation = e.ang;
    e.shadow.setPosition(e.x + 4, e.y + 6);
    if (e.ring) e.ring.setPosition(e.x, e.y).setRotation(time * 0.002);
    if (e.type === 'turret' && e.aux) e.aux.setPosition(e.x, e.y).setRotation(e.ang);
    if (e.type === 'heavy' && e.aux) {
      e.aux.setPosition(e.x, e.y).setRotation(e.ang).setAlpha(e.stun > 0 ? 0.4 : 1);
      if (e.auxFlash > 0) {
        e.auxFlash -= dt;
        if (e.auxFlash > 0) e.aux.setTintFill(0xffffff);
        else e.aux.clearTint();
      }
    }

    if (e.flash > 0) {
      e.flash -= dt;
      e.img.setTintFill(0xffffff);
      if (e.type === 'turret') e.aux?.setTintFill(0xffffff);
      if (e.flash <= 0) {
        e.img.clearTint();
        if (e.type === 'turret') e.aux?.clearTint();
      }
    }
    if (e.stun > 0 && !e.boss) e.img.setScale(e.scale * (1 + Math.sin(time * 0.05) * 0.03));

    // health bars for tougher enemies once damaged
    if (!e.boss && e.barT > 0 && e.maxHp >= 60) {
      e.barT -= dt;
      const w = e.r * 2;
      const x = e.x - w / 2;
      const y = e.y + e.r + 10;
      this.bars.fillStyle(0x17120f, 0.85).fillRect(x - 2, y - 2, w + 4, 8);
      this.bars.fillStyle(e.elite ? 0xe2b23c : 0xd8452f, 1).fillRect(x, y, w * clamp(e.hp / e.maxHp, 0, 1), 4);
    }
  }

  // ------------------------------------------------------------ helpers

  private move(e: Enemy, dx: number, dy: number, speed: number, dt: number): boolean {
    const room = this.scene.room;
    const hit = room.collide(e.x + dx * speed * dt, e.y + dy * speed * dt, e.r * 0.85, true);
    e.x = room.cx;
    e.y = room.cy;
    return hit;
  }

  private approach(e: Enemy, speed: number, dt: number): void {
    const room = this.scene.room;
    const p = this.scene.player;
    if (e.hasLos) {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      this.move(e, dx / d, dy / d, speed, dt);
    } else if (room.flowDir(e.x, e.y, this.tmp)) {
      this.move(e, this.tmp.x, this.tmp.y, speed, dt);
    }
  }

  /** Keep within [near, far] of the player, circling when in range. */
  private skirmish(e: Enemy, near: number, far: number, dt: number, strafeSpeed = 0.7): void {
    const p = this.scene.player;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    e.strafeT -= dt;
    if (e.strafeT <= 0) {
      e.strafeT = rnd(0.9, 2.2);
      if (Math.random() < 0.5) e.strafe = -e.strafe;
    }
    if (!e.hasLos || d > far) {
      this.approach(e, e.speed, dt);
    } else if (d < near) {
      if (this.move(e, -dx / d, -dy / d, e.speed * 0.85, dt)) {
        // backed into a wall: slide sideways instead
        this.move(e, (-dy / d) * e.strafe, (dx / d) * e.strafe, e.speed * 0.8, dt);
      }
    } else if (this.move(e, (-dy / d) * e.strafe, (dx / d) * e.strafe, e.speed * strafeSpeed, dt)) {
      e.strafe = -e.strafe;
    }
  }

  private face(e: Enemy, dt: number, rate = 9): number {
    const p = this.scene.player;
    const target = Math.atan2(p.y - e.y, p.x - e.x);
    e.ang = rotateToward(e.ang, target, rate * dt);
    return target;
  }

  private showGlint(e: Enemy, k: number, tint = 0xffe2b0): void {
    const mx = e.x + Math.cos(e.ang) * e.muzzle;
    const my = e.y + Math.sin(e.ang) * e.muzzle;
    e.glint.setVisible(true).setPosition(mx, my).setScale(0.15 + k * 0.5).setAlpha(0.35 + k * 0.65).setTint(tint);
  }

  private shoot(e: Enemy, ang: number, speed: number, tex = 'eb'): void {
    const s = this.scene;
    const mx = e.x + Math.cos(e.ang) * e.muzzle;
    const my = e.y + Math.sin(e.ang) * e.muzzle;
    // never fire from inside a wall
    const ox = s.room.solidAt(mx, my, true) ? e.x : mx;
    const oy = s.room.solidAt(mx, my, true) ? e.y : my;
    s.bullets.fireEnemy(ox, oy, ang, speed * s.bulletSpeedMul, { tex });
  }

  private muzzleFx(e: Enemy, big = false): void {
    const mx = e.x + Math.cos(e.ang) * e.muzzle;
    const my = e.y + Math.sin(e.ang) * e.muzzle;
    this.scene.fx.emit('soft', mx, my, { life: 0.1, s0: big ? 0.9 : 0.6, s1: 0.2, a0: 0.9, a1: 0, tint: 0xffb080, add: true, depth: DEPTH.GLOW });
    this.scene.fx.flash(mx, my, big ? 220 : 150, 0.08);
    audio.play(big ? 'eshootBig' : 'eshoot');
  }

  // ------------------------------------------------------------ AI

  private think(e: Enemy, dt: number, time: number): void {
    const s = this.scene;
    const p = s.player;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const hard = s.run.floorIndex + s.run.loop * 3;
    const cdMul = (e.elite ? 0.75 : 1) * Math.max(0.6, 1 - 0.06 * hard);

    switch (e.type) {
      case 'grunt': {
        if (e.state === 'move') {
          this.face(e, dt);
          this.skirmish(e, 190, 430, dt);
          e.glint.setVisible(false);
          if (e.cd <= 0 && e.hasLos && d < 640) {
            e.state = 'aim';
            e.t = 0.4;
            audio.play('telegraph', 0.6);
          }
        } else if (e.state === 'aim') {
          this.face(e, dt, 6);
          this.showGlint(e, 1 - e.t / 0.4);
          if (e.t <= 0) {
            e.state = 'burst';
            e.n = (hard >= 1 ? 2 : 1) + (e.elite ? 1 : 0) + (hard >= 2 ? 1 : 0);
            e.t = 0;
          }
        } else if (e.state === 'burst') {
          this.face(e, dt, 2.5);
          if (e.t <= 0) {
            this.shoot(e, e.ang + rnd(-0.06, 0.06), 340);
            this.muzzleFx(e);
            e.n--;
            e.t = 0.15;
            if (e.n <= 0) {
              e.state = 'move';
              e.cd = rnd(1.4, 2.2) * cdMul;
              e.glint.setVisible(false);
            }
          }
        }
        break;
      }

      case 'shotgunner': {
        if (e.state === 'move') {
          this.face(e, dt);
          this.skirmish(e, 150, 290, dt, 0.6);
          e.glint.setVisible(false);
          if (e.cd <= 0 && e.hasLos && d < 420) {
            e.state = 'aim';
            e.t = 0.5;
            audio.play('telegraph', 0.6);
          }
        } else if (e.state === 'aim') {
          this.face(e, dt, 4);
          this.showGlint(e, 1 - e.t / 0.5);
          if (e.t <= 0) {
            const n = e.elite ? 7 : 5;
            for (let i = 0; i < n; i++) {
              const a = e.ang + ((i / (n - 1)) - 0.5) * 0.8;
              this.shoot(e, a, 300 * rnd(0.92, 1.08), 'ebSmall');
            }
            this.muzzleFx(e, true);
            e.kx -= Math.cos(e.ang) * 160;
            e.ky -= Math.sin(e.ang) * 160;
            e.state = 'move';
            e.cd = rnd(2.0, 2.7) * cdMul;
          }
        }
        break;
      }

      case 'swarmer': {
        this.face(e, dt, 12);
        const wob = Math.sin(time * 0.012 + e.id * 1.7) * 0.7;
        if (e.hasLos) {
          const a = Math.atan2(dy, dx) + wob * clamp(d / 300, 0, 1);
          this.move(e, Math.cos(a), Math.sin(a), e.speed, dt);
        } else {
          this.approach(e, e.speed, dt);
        }
        break;
      }

      case 'charger': {
        const line = e.aux!;
        if (e.state === 'move') {
          this.face(e, dt, 5);
          // close in, but hold off a short way when it can see the player, so it charges from range
          // instead of standing on them (in a corner the dash would hit the wall at once, every time)
          if (!e.hasLos || d > CHARGER_HOLD) this.approach(e, e.speed, dt);
          else if (d < CHARGER_HOLD * 0.8) this.move(e, -dx / d, -dy / d, e.speed * 0.6, dt);
          line.setVisible(false);
          if (e.cd <= 0 && e.hasLos && d < 460) {
            e.state = 'windup';
            e.t = 0.7;
            audio.play('charge');
          }
        } else if (e.state === 'windup') {
          if (e.t > 0.22) this.face(e, dt, 7);
          const k = 1 - e.t / 0.7;
          const len = s.room.raycast(e.x, e.y, e.ang, 900);
          line.setVisible(true).setPosition(e.x, e.y).setRotation(e.ang).setScale(len / 4, (e.r * 2) / 4).setAlpha(0.1 + 0.25 * k);
          if (e.t <= 0) {
            e.state = 'dash';
            e.t = 0.62;
            e.contact = true;
            line.setVisible(false);
          }
        } else if (e.state === 'dash') {
          const hit = this.move(e, Math.cos(e.ang), Math.sin(e.ang), 900, dt);
          s.fx.dust(e.x, e.y, 1, 0x9a8f80, 60, 0.7);
          if (hit) {
            // slammed into something: big opening for the player
            const fx = e.x + Math.cos(e.ang) * e.r;
            const fy = e.y + Math.sin(e.ang) * e.r;
            const prop = s.room.propAt(Math.floor((fx + Math.cos(e.ang) * 12) / TILE), Math.floor((fy + Math.sin(e.ang) * 12) / TILE));
            if (prop) s.damageProp(prop, 999, e.ang);
            s.fx.shake(0.35);
            s.fx.dust(fx, fy, 8, 0xa89880, 200, 0.8);
            s.fx.sparks(fx, fy, e.ang + Math.PI, 6);
            audio.play('wallHit');
            e.state = 'move';
            e.stun = 1.0;
            e.contact = false;
            e.cd = 1.2 * cdMul;
          } else if (e.t <= 0) {
            e.state = 'move';
            e.contact = false;
            e.cd = rnd(1.2, 1.8) * cdMul;
            e.stun = 0.25;
          }
        }
        break;
      }

      case 'sniper': {
        const line = e.aux!;
        if (e.state === 'move') {
          this.face(e, dt);
          this.skirmish(e, 380, 760, dt, 0.5);
          line.setVisible(false);
          if (e.cd <= 0 && e.hasLos) {
            e.state = 'aim';
            e.t = 1.15;
            audio.play('telegraph');
          }
        } else if (e.state === 'aim') {
          // tracks the player, then locks for the final beat so a late dodge works
          if (e.t > 0.28) this.face(e, dt, 3.2);
          const k = 1 - e.t / 1.15;
          const mx = e.x + Math.cos(e.ang) * e.muzzle;
          const my = e.y + Math.sin(e.ang) * e.muzzle;
          const len = s.room.raycast(mx, my, e.ang, 1600);
          const locked = e.t <= 0.28;
          line.setVisible(true).setPosition(mx, my).setRotation(e.ang).setScale(len / 4, locked ? 1.4 : 0.6)
            .setAlpha(locked ? (Math.floor(time / 50) % 2 === 0 ? 0.95 : 0.5) : 0.2 + 0.4 * k);
          if (!e.hasLos && e.t > 0.4) {
            e.state = 'move';
            e.cd = 0.5;
          } else if (e.t <= 0) {
            this.shoot(e, e.ang, 980, 'ebFast');
            if (e.elite) {
              this.shoot(e, e.ang - 0.12, 900, 'ebFast');
              this.shoot(e, e.ang + 0.12, 900, 'ebFast');
            }
            this.muzzleFx(e, true);
            e.kx -= Math.cos(e.ang) * 200;
            e.ky -= Math.sin(e.ang) * 200;
            line.setVisible(false);
            e.state = 'move';
            e.cd = rnd(2.0, 2.9) * cdMul;
          }
        }
        break;
      }

      case 'grenadier': {
        if (e.state === 'move') {
          this.face(e, dt);
          this.skirmish(e, 280, 520, dt, 0.6);
          e.glint.setVisible(false);
          if (e.cd <= 0 && d < 720) {
            e.state = 'aim';
            e.t = 0.45;
          }
        } else if (e.state === 'aim') {
          this.face(e, dt, 5);
          this.showGlint(e, 1 - e.t / 0.45, 0xffd070);
          if (e.t <= 0) {
            const n = e.elite ? 3 : 1;
            for (let i = 0; i < n; i++) {
              const tx = clamp(p.x + p.vx * 0.4 + (i === 0 ? 0 : rnd(-130, 130)), TILE * 1.5, s.room.pw - TILE * 1.5);
              const ty = clamp(p.y + p.vy * 0.4 + (i === 0 ? 0 : rnd(-130, 130)), TILE * 1.5, s.room.ph - TILE * 1.5);
              s.bullets.lob(e.x + Math.cos(e.ang) * e.muzzle, e.y + Math.sin(e.ang) * e.muzzle, tx, ty, 1.05 + i * 0.12, 96);
            }
            e.state = 'move';
            e.cd = rnd(2.4, 3.2) * cdMul;
            e.glint.setVisible(false);
          }
        }
        break;
      }

      case 'turret': {
        if (e.state === 'idle') {
          this.face(e, dt, 2.2);
          e.glint.setVisible(false);
          if (e.cd <= 0) {
            e.state = 'aim';
            e.t = 0.5;
            e.a = Math.random() < 0.5 ? 0 : 1; // which pattern
            audio.play('telegraph', 0.7);
          }
        } else if (e.state === 'aim') {
          this.face(e, dt, 2.2);
          this.showGlint(e, 1 - e.t / 0.5, 0xff9a70);
          if (e.t <= 0) {
            e.state = 'fire';
            e.n = e.a === 0 ? 3 : e.elite ? 9 : 6;
            e.t = 0;
          }
        } else if (e.state === 'fire') {
          if (e.t <= 0) {
            if (e.a === 0) {
              // rotating rings
              const count = e.elite ? 12 : 8;
              const off = e.n * 0.26 + e.ang;
              for (let i = 0; i < count; i++) this.shoot(e, off + (i / count) * TAU, 235);
              e.t = 0.48;
            } else {
              this.face(e, dt, 30);
              this.shoot(e, e.ang, 380, 'ebSmall');
              e.t = 0.11;
            }
            this.muzzleFx(e, e.a === 0);
            e.n--;
            if (e.n <= 0) {
              e.state = 'idle';
              e.cd = rnd(1.5, 2.2) * cdMul;
            }
          } else if (e.a === 1) {
            this.face(e, dt, 1.6);
          }
        }
        break;
      }

      case 'heavy': {
        // slow to turn: get behind the shield
        if (e.state === 'move') {
          this.face(e, dt, 1.25);
          if (d > 240 || !e.hasLos) this.approach(e, e.speed, dt);
          e.glint.setVisible(false);
          if (e.cd <= 0 && e.hasLos && d < 600) {
            e.state = 'aim';
            e.t = 0.6;
            audio.play('telegraph', 0.8);
          }
        } else if (e.state === 'aim') {
          this.face(e, dt, 1.25);
          this.showGlint(e, 1 - e.t / 0.6, 0xff9a70);
          if (e.t <= 0) {
            e.state = 'spray';
            e.t = e.elite ? 2.0 : 1.5;
            e.n = 0;
          }
        } else if (e.state === 'spray') {
          this.face(e, dt, 0.6);
          e.a -= dt;
          if (e.a <= 0) {
            e.a = 0.085;
            e.n++;
            const sweep = Math.sin(e.n * 0.45) * 0.3;
            const sa = e.ang + 0.42; // gun sits on its right side
            const gx = e.x + Math.cos(sa) * e.muzzle;
            const gy = e.y + Math.sin(sa) * e.muzzle;
            s.bullets.fireEnemy(gx, gy, e.ang + sweep, 350 * s.bulletSpeedMul, { tex: 'ebSmall' });
            s.fx.emit('soft', gx, gy, { life: 0.07, s0: 0.5, s1: 0.2, a0: 0.8, a1: 0, tint: 0xffb080, add: true, depth: DEPTH.GLOW });
            audio.play('eshoot', 0.7);
          }
          if (e.t <= 0) {
            e.state = 'move';
            e.cd = rnd(2.0, 2.8) * cdMul;
          }
        }
        break;
      }

      case 'drone': {
        // bounces around the room, pulsing shots in a cross
        const hit = this.move(e, Math.cos(e.a), Math.sin(e.a), e.speed, dt);
        if (hit) {
          // work out which axis blocked us by probing each separately
          const room = s.room;
          const bx = room.collide(e.x + Math.cos(e.a) * 14, e.y, e.r * 0.85, true);
          const by = room.collide(e.x, e.y + Math.sin(e.a) * 14, e.r * 0.85, true);
          let vx = Math.cos(e.a);
          let vy = Math.sin(e.a);
          if (bx) vx = -vx;
          if (by) vy = -vy;
          if (!bx && !by) {
            vx = -vx;
            vy = -vy;
          }
          e.a = Math.atan2(vy, vx);
        }
        e.ang = e.a;
        if (e.cd <= 0.35 && e.cd > 0) {
          e.glint.setVisible(true).setPosition(e.x, e.y).setScale(0.4 + (0.35 - e.cd) * 2).setAlpha(0.8).setTint(0xff9a70);
        }
        if (e.cd <= 0) {
          e.glint.setVisible(false);
          e.n++;
          const count = e.elite ? 8 : 4;
          const off = e.n % 2 === 0 ? 0 : Math.PI / 4;
          for (let i = 0; i < count; i++) {
            s.bullets.fireEnemy(e.x, e.y, off + (i / count) * TAU, 250 * s.bulletSpeedMul);
          }
          audio.play('eshoot');
          s.fx.flash(e.x, e.y, 160, 0.08);
          e.cd = rnd(1.3, 1.7) * cdMul;
        }
        break;
      }
    }
  }
}
