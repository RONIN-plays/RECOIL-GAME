import { DEPTH, TILE } from '../config';
import { audio } from '../core/audio';
import { TAU, clamp, rotateToward } from '../core/math';
import { rnd, rndPick, rndSign } from '../core/rng';
import type { GameScene } from '../scenes/GameScene';
import type { EnemyShot } from './bullets';
import type { Enemy } from './enemies';

type Script = Generator<number, void, void>;

export interface BossDef {
  id: string;
  name: string;
  title: string;
  tex: string;
  hp: number;
  r: number;
  muzzle: number;
  tint: number;
  machine: boolean;
  script: (b: BossRunner) => Script;
}

/**
 * Drives a boss with a generator script: each `yield n` waits n seconds
 * (0 = one frame), so attack patterns read top to bottom like a screenplay.
 */
export class BossRunner {
  invulnerable = false;
  dt = 0;
  /** Seek target; the boss drifts toward it between attacks. */
  tx: number;
  ty: number;
  moveSpeed = 0;
  /** How fast it turns to face the player (rad/s); 0 = locked. */
  turn = 4;
  private gen: Script;
  private wait = 1.4;
  private spin = 0;
  introDone = false;

  constructor(readonly s: GameScene, readonly e: Enemy, readonly def: BossDef) {
    this.tx = e.x;
    this.ty = e.y;
    this.gen = def.script(this);
  }

  /** 1 at full health, 0 when dead. */
  get frac(): number {
    return clamp(this.e.hp / this.e.maxHp, 0, 1);
  }

  get aim(): number {
    return Math.atan2(this.s.player.y - this.e.y, this.s.player.x - this.e.x);
  }

  get dist(): number {
    return Math.hypot(this.s.player.y - this.e.y, this.s.player.x - this.e.x);
  }

  update(dt: number): void {
    this.dt = dt;
    const e = this.e;
    const s = this.s;
    if (s.player.dead) return;

    if (this.turn > 0) e.ang = rotateToward(e.ang, this.aim, this.turn * dt);
    if (this.moveSpeed > 0) {
      const dx = this.tx - e.x;
      const dy = this.ty - e.y;
      const d = Math.hypot(dx, dy);
      if (d > 6) {
        s.room.collide(e.x + (dx / d) * this.moveSpeed * dt, e.y + (dy / d) * this.moveSpeed * dt, e.r * 0.8, true);
        e.x = s.room.cx;
        e.y = s.room.cy;
      }
    }

    this.wait -= dt;
    let guard = 0;
    while (this.wait <= 0 && guard++ < 12) {
      const r = this.gen.next();
      if (r.done) {
        this.gen = this.def.script(this);
        this.wait = 0.5;
        break;
      }
      if (r.value <= 0) {
        this.wait = 0;
        break;
      }
      this.wait += r.value;
    }

    e.glint.setPosition(e.x + Math.cos(e.ang) * e.muzzle, e.y + Math.sin(e.ang) * e.muzzle);
    if (this.def.id === 'furnace') {
      this.spin += dt;
      if (Math.random() < dt * 14) s.fx.smoke(e.x - Math.cos(e.ang) * 50, e.y - Math.sin(e.ang) * 50, 1, 0.6, 0x2a2624);
    }
  }

  // ------------------------------------------------------------ building blocks

  fire(ang: number, speed: number, o: EnemyShot = {}, ox?: number, oy?: number): void {
    const e = this.e;
    const x = ox ?? e.x + Math.cos(ang) * e.r * 0.7;
    const y = oy ?? e.y + Math.sin(ang) * e.r * 0.7;
    this.s.bullets.fireEnemy(x, y, ang, speed * this.s.bulletSpeedMul, o);
  }

  ring(count: number, speed: number, offset = 0, o: EnemyShot = {}, skip?: (i: number) => boolean): void {
    for (let i = 0; i < count; i++) {
      if (skip && skip(i)) continue;
      this.fire(offset + (i / count) * TAU, speed, o);
    }
    audio.play('eshootBig');
    this.s.fx.flash(this.e.x, this.e.y, 380, 0.1);
  }

  fan(ang: number, count: number, spread: number, speed: number, o: EnemyShot = {}): void {
    for (let i = 0; i < count; i++) {
      const a = ang + (count === 1 ? 0 : (i / (count - 1) - 0.5) * spread);
      this.fire(a, speed, o);
    }
    audio.play('eshootBig');
    const e = this.e;
    this.s.fx.flash(e.x + Math.cos(ang) * e.muzzle, e.y + Math.sin(ang) * e.muzzle, 300, 0.1);
  }

  /** A growing glow at the muzzle to warn that an attack is coming. */
  *charge(dur: number, tint = 0xffc090): Script {
    const e = this.e;
    let t = 0;
    audio.play('telegraph');
    while (t < dur) {
      t += this.dt;
      const k = t / dur;
      e.glint.setVisible(true).setScale(0.4 + k * 1.3).setAlpha(0.3 + k * 0.7).setTint(tint);
      yield 0;
    }
    e.glint.setVisible(false);
  }

  /** Pick a point to drift to: near the room centre but away from the player. */
  roam(speed: number, spread = 0.3): void {
    const room = this.s.room;
    for (let i = 0; i < 12; i++) {
      const x = room.pw / 2 + rnd(-room.pw * spread, room.pw * spread);
      const y = room.ph / 2 + rnd(-room.ph * spread, room.ph * spread);
      if (Math.hypot(x - this.s.player.x, y - this.s.player.y) > 330 && !room.solidAt(x, y)) {
        this.tx = x;
        this.ty = y;
        break;
      }
    }
    this.moveSpeed = speed;
  }

  /** Telegraphed straight-line rush that ends when it hits a wall. Yields until finished. */
  *rush(windup: number, speed: number, maxT: number): Script {
    const e = this.e;
    const s = this.s;
    const line = e.aux!;
    this.moveSpeed = 0;
    this.turn = 6;
    audio.play('charge');
    let t = 0;
    while (t < windup) {
      t += this.dt;
      if (t > windup - 0.22) this.turn = 0;
      const len = s.room.raycast(e.x, e.y, e.ang, 2000);
      line.setVisible(true).setPosition(e.x, e.y).setRotation(e.ang).setScale(len / 4, (e.r * 1.8) / 4).setAlpha(0.1 + 0.3 * (t / windup));
      yield 0;
    }
    line.setVisible(false);
    this.turn = 0;
    t = 0;
    const ca = Math.cos(e.ang);
    const sa = Math.sin(e.ang);
    while (t < maxT) {
      t += this.dt;
      const hit = s.room.collide(e.x + ca * speed * this.dt, e.y + sa * speed * this.dt, e.r * 0.8, true);
      e.x = s.room.cx;
      e.y = s.room.cy;
      s.fx.dust(e.x, e.y, 1, 0x9a8f80, 90, 1.1);
      if (hit) {
        const fx = e.x + ca * e.r;
        const fy = e.y + sa * e.r;
        const prop = s.room.propAt(Math.floor((fx + ca * 16) / TILE), Math.floor((fy + sa * 16) / TILE));
        if (prop) s.damageProp(prop, 999, e.ang);
        s.fx.shake(0.6);
        s.fx.dust(fx, fy, 12, 0xa89880, 260, 1.1);
        audio.play('wallHit');
        break;
      }
      yield 0;
    }
    this.turn = 4;
  }

  /** Instant reposition with afterimages. */
  *blink(x: number, y: number, speed = 1700): Script {
    const e = this.e;
    const s = this.s;
    this.moveSpeed = 0;
    s.fx.ring(x, y, 70, 20, 0.3, 0xffe2a8, 0.8, 'ringThin');
    yield 0.26;
    let guard = 0;
    while (guard++ < 120) {
      const dx = x - e.x;
      const dy = y - e.y;
      const d = Math.hypot(dx, dy);
      if (d < speed * this.dt + 4) break;
      const hit = s.room.collide(e.x + (dx / d) * speed * this.dt, e.y + (dy / d) * speed * this.dt, e.r * 0.8, true);
      e.x = s.room.cx;
      e.y = s.room.cy;
      s.fx.emit(this.def.tex, e.x, e.y, { life: 0.22, s0: 1, s1: 1, a0: 0.4, a1: 0, rot: e.ang, tint: 0xffe2a8, depth: DEPTH.ENEMY - 0.5 });
      if (hit && d < 90) break;
      yield 0;
    }
    audio.play('roll', 1.4);
  }

  /** A thin warning line toward the player, then a fast shot down it. */
  *snipe(track: number, lock: number, speed: number, extra = 0): Script {
    const e = this.e;
    const s = this.s;
    const line = e.aux!;
    this.turn = 5;
    audio.play('telegraph');
    let t = 0;
    while (t < track + lock) {
      t += this.dt;
      const locked = t >= track;
      if (locked) this.turn = 0;
      const mx = e.x + Math.cos(e.ang) * e.muzzle;
      const my = e.y + Math.sin(e.ang) * e.muzzle;
      const len = s.room.raycast(mx, my, e.ang, 2200);
      line.setVisible(true).setPosition(mx, my).setRotation(e.ang).setScale(len / 4, locked ? 1.6 : 0.7).setAlpha(locked ? 0.95 : 0.3 + 0.3 * (t / track));
      yield 0;
    }
    line.setVisible(false);
    this.fire(e.ang, speed, { tex: 'ebFast' });
    for (let i = 1; i <= extra; i++) {
      this.fire(e.ang + i * 0.13, speed * 0.85, { tex: 'ebFast' });
      this.fire(e.ang - i * 0.13, speed * 0.85, { tex: 'ebFast' });
    }
    audio.play('eshootBig');
    s.fx.shake(0.15);
    this.turn = 4;
  }

  summon(type: 'swarmer' | 'grunt' | 'sniper' | 'drone', count: number): void {
    const types = Array.from({ length: count }, () => type);
    this.s.enemies.spawnWave(types);
  }
}

// -------------------------------------------------------------------- scripts

/** Floor 1: a hulking jailer. Teaches fans, rings and dodging a charge. */
function* warden(b: BossRunner): Script {
  const e = b.e;
  let cycle = 0;
  let summoned = false;
  yield 0.4;
  while (true) {
    const rage = b.frac < 0.5;
    const pick = cycle++ % 3;
    b.roam(rage ? 150 : 110);
    yield rage ? 0.5 : 0.8;

    if (pick === 0) {
      // aimed fans
      const volleys = rage ? 4 : 3;
      for (let i = 0; i < volleys; i++) {
        yield* b.charge(0.36);
        b.fan(b.aim, rage ? 9 : 7, 1.25, 320);
        b.s.fx.shake(0.12);
        yield 0.4;
      }
    } else if (pick === 1) {
      // charge across the room; the impact throws a ring of bullets
      const times = rage ? 3 : 1;
      for (let i = 0; i < times; i++) {
        yield* b.rush(rage ? 0.6 : 0.85, 1050, 1.5);
        b.ring(rage ? 22 : 16, 270, rnd(0, 1));
        yield 0.5;
      }
    } else {
      // pulsing rings with alternating offsets
      b.moveSpeed = 0;
      const rings = rage ? 5 : 3;
      for (let i = 0; i < rings; i++) {
        yield* b.charge(0.3);
        b.ring(16, 240, (i % 2) * (TAU / 32) + e.ang);
        if (rage) b.fan(b.aim, 3, 0.3, 380, { tex: 'ebSmall' });
        yield 0.42;
      }
    }

    if (rage && !summoned) {
      summoned = true;
      b.summon('swarmer', 5);
      // spiral while the adds close in
      b.moveSpeed = 0;
      let a = e.ang;
      for (let i = 0; i < 34; i++) {
        a += 0.24;
        b.fire(a, 290);
        b.fire(a + Math.PI, 290);
        if (i % 3 === 0) audio.play('eshoot');
        yield 0.07;
      }
    }
    yield rage ? 0.5 : 0.9;
  }
}

/** Floor 2: a walking furnace. Spirals, mortars and ring walls with gaps. */
function* furnace(b: BossRunner): Script {
  const e = b.e;
  let cycle = 0;
  let dir = 1;
  b.turn = 1.6;
  yield 0.4;
  while (true) {
    const rage = b.frac < 0.5;
    const pick = cycle++ % (rage ? 4 : 3);
    // grinds steadily toward the player
    b.tx = b.s.player.x;
    b.ty = b.s.player.y;
    b.moveSpeed = b.dist > 260 ? (rage ? 85 : 60) : 0;
    yield rage ? 0.5 : 0.8;

    if (pick === 0) {
      // rotating spiral arms
      const arms = rage ? 4 : 3;
      dir = -dir;
      let a = rnd(0, TAU);
      const shots = rage ? 34 : 28;
      for (let i = 0; i < shots; i++) {
        a += 0.125 * dir;
        for (let k = 0; k < arms; k++) b.fire(a + (k / arms) * TAU, 235);
        if (i % 2 === 0) audio.play('eshoot');
        b.tx = b.s.player.x;
        b.ty = b.s.player.y;
        yield 0.115;
      }
    } else if (pick === 1) {
      // mortar barrage
      b.moveSpeed = 0;
      yield* b.charge(0.5, 0xffd070);
      const n = rage ? 9 : 6;
      const room = b.s.room;
      for (let i = 0; i < n; i++) {
        const p = b.s.player;
        const off = i === 0 ? 0 : rnd(70, 230);
        const oa = rnd(0, TAU);
        const x = clamp(p.x + p.vx * 0.3 + Math.cos(oa) * off, TILE * 1.6, room.pw - TILE * 1.6);
        const y = clamp(p.y + p.vy * 0.3 + Math.sin(oa) * off, TILE * 1.6, room.ph - TILE * 1.6);
        b.s.bullets.lob(e.x, e.y, x, y, 1.1, 100);
        yield 0.17;
      }
      yield 0.6;
    } else if (pick === 2) {
      // heavy cannon fans
      for (let i = 0; i < 3; i++) {
        yield* b.charge(0.45);
        b.fan(e.ang, 5, 0.75, 400, { tex: 'ebBig' });
        if (rage) b.fan(e.ang, 6, 1.6, 270, { tex: 'ebSmall' });
        b.s.fx.shake(0.2);
        yield 0.5;
      }
    } else {
      // venting: closed rings with rotating gaps to slip through
      b.moveSpeed = 0;
      yield* b.charge(0.6, 0xff9050);
      const count = 30;
      let gap = Math.floor(rnd(0, count));
      for (let i = 0; i < 4; i++) {
        const g = gap;
        b.ring(count, 190, 0, {}, (k) => {
          const d = (k - g + count) % (count / 3);
          return d < 2;
        });
        gap += 4;
        b.s.fx.shake(0.18);
        yield 0.62;
      }
    }
    yield rage ? 0.35 : 0.7;
  }
}

/** Floor 3: a duelist. Blinks around the room, snipes, and fills the air with curving petals. */
function* magistrate(b: BossRunner): Script {
  const e = b.e;
  const s = b.s;
  let cycle = 0;
  let summoned = false;
  yield 0.4;
  while (true) {
    const f = b.frac;
    const rage = f < 0.6;
    const fury = f < 0.3;
    const pick = cycle++ % 4;
    b.roam(170, 0.32);
    yield fury ? 0.3 : rage ? 0.5 : 0.75;

    if (pick === 0) {
      // blink strikes: appear beside the player, burst, vanish
      const times = fury ? 5 : rage ? 4 : 3;
      for (let i = 0; i < times; i++) {
        const p = s.player;
        let x = p.x;
        let y = p.y;
        for (let k = 0; k < 10; k++) {
          const a = rnd(0, TAU);
          x = clamp(p.x + Math.cos(a) * 320, TILE * 2.2, s.room.pw - TILE * 2.2);
          y = clamp(p.y + Math.sin(a) * 320, TILE * 2.2, s.room.ph - TILE * 2.2);
          if (Math.hypot(x - p.x, y - p.y) > 230) break;
        }
        yield* b.blink(x, y);
        b.ring(fury ? 18 : 14, 280, rnd(0, 1));
        b.fan(b.aim, 3, 0.26, 400, { tex: 'ebSmall' });
        yield fury ? 0.32 : 0.48;
      }
    } else if (pick === 1) {
      // executioner shots
      b.moveSpeed = 0;
      const shots = fury ? 5 : rage ? 4 : 3;
      for (let i = 0; i < shots; i++) {
        yield* b.snipe(fury ? 0.38 : 0.5, 0.2, 1150, rage ? 1 : 0);
        yield 0.16;
      }
    } else if (pick === 2) {
      // petals: rings that curve and accelerate outward
      b.moveSpeed = 0;
      const pulses = fury ? 6 : rage ? 5 : 4;
      const sign = rndSign();
      for (let i = 0; i < pulses; i++) {
        yield* b.charge(0.24, 0xffe2a8);
        const count = 18;
        const off = i * 0.21;
        for (let k = 0; k < count; k++) {
          b.fire(off + (k / count) * TAU, 130, { accel: 0.9, maxSpeed: 420, curve: 0.5 * sign * (i % 2 === 0 ? 1 : -1), life: 5 });
        }
        audio.play('eshootBig');
        yield 0.5;
      }
    } else {
      // walls of bullets with gaps, marching across the room
      b.moveSpeed = 0;
      const walls = fury ? 4 : 3;
      for (let i = 0; i < walls; i++) {
        yield* b.charge(0.4);
        const a = b.aim;
        const px = Math.cos(a + Math.PI / 2);
        const py = Math.sin(a + Math.PI / 2);
        const n = 21;
        const gapA = Math.floor(rnd(3, n - 4));
        let gapB = Math.floor(rnd(3, n - 4));
        if (Math.abs(gapB - gapA) < 5) gapB = (gapA + 8) % (n - 4) + 2;
        for (let k = 0; k < n; k++) {
          if (Math.abs(k - gapA) <= 1 || Math.abs(k - gapB) <= 1) continue;
          const off = (k - (n - 1) / 2) * 52;
          const ox = e.x + px * off;
          const oy = e.y + py * off;
          if (s.room.solidAt(ox, oy, true)) continue;
          b.fire(a, 255, {}, ox, oy);
        }
        audio.play('eshootBig');
        s.fx.shake(0.14);
        yield 0.78;
      }
    }

    if (fury && !summoned) {
      summoned = true;
      b.summon(rndPick(['sniper', 'drone']), 2);
    }
    yield fury ? 0.3 : 0.6;
  }
}

export const BOSSES: BossDef[] = [
  { id: 'warden', name: 'THE WARDEN', title: 'Keeper of the Cellars', tex: 'b_warden', hp: 1700, r: 56, muzzle: 80, tint: 0x39424f, machine: false, script: warden },
  { id: 'furnace', name: 'THE FURNACE', title: 'Heart of the Foundry', tex: 'b_furnace', hp: 2500, r: 76, muzzle: 100, tint: 0x3a3c42, machine: true, script: furnace },
  { id: 'magistrate', name: 'THE MAGISTRATE', title: 'Final Judgement', tex: 'b_magistrate', hp: 3300, r: 40, muzzle: 62, tint: 0xe6dcc6, machine: false, script: magistrate },
];
