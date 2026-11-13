import Phaser from 'phaser';
import { DEPTH, FONT, GH, GW } from '../config';
import { audio } from '../core/audio';
import { TAU, clamp, lerp } from '../core/math';
import { rnd, rndPick } from '../core/rng';
import { loadSave } from '../core/save';
import type { GameScene } from '../scenes/GameScene';

interface Particle {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  s0: number;
  s1: number;
  a0: number;
  a1: number;
  spin: number;
  drag: number;
  /** When it dies, stamp it into the floor decal layer with this tint (or -1 for none). */
  stamp: number;
  stretch: boolean;
}

export interface EmitOpts {
  vx?: number;
  vy?: number;
  life?: number;
  s0?: number;
  s1?: number;
  a0?: number;
  a1?: number;
  rot?: number;
  spin?: number;
  drag?: number;
  tint?: number;
  depth?: number;
  add?: boolean;
  stamp?: number;
  stretch?: boolean;
}

interface FlashLight {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
}

interface FloatText {
  txt: Phaser.GameObjects.Text;
  life: number;
  max: number;
  vy: number;
  active: boolean;
}

const MAX_PARTICLES = 700;
const DARK_PAD = 60;
const DARK_SCALE = 2;

/** Particles, decals, lighting, screen shake, hit-stop: everything that makes hits feel like hits. */
export class Fx {
  private parts: Particle[] = [];
  private free: Particle[] = [];
  private texts: FloatText[] = [];
  private flashes: FlashLight[] = [];
  private dark: Phaser.GameObjects.RenderTexture;
  private lightPool: Phaser.GameObjects.Image[] = [];
  private lightCount = 0;
  private shakeScale = 1;

  trauma = 0;
  kickX = 0;
  kickY = 0;
  freeze = 0;
  slowT = 0;
  slowScale = 1;
  darkAlpha = 0.6;
  darkColor = 0x07060a;

  constructor(private scene: GameScene) {
    this.shakeScale = loadSave().shake;
    const w = Math.ceil((GW + DARK_PAD * 2) / DARK_SCALE);
    const h = Math.ceil((GH + DARK_PAD * 2) / DARK_SCALE);
    this.dark = scene.add.renderTexture(-DARK_PAD, -DARK_PAD, w, h)
      .setOrigin(0, 0).setScale(DARK_SCALE).setScrollFactor(0).setDepth(DEPTH.DARK);
  }

  setShakeScale(v: number): void {
    this.shakeScale = v;
  }

  // ------------------------------------------------------------ particles

  emit(key: string, x: number, y: number, o: EmitOpts = {}): void {
    let p = this.free.pop();
    if (!p) {
      if (this.parts.length >= MAX_PARTICLES) return;
      p = {
        img: this.scene.add.image(0, 0, key), x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1,
        s0: 1, s1: 1, a0: 1, a1: 0, spin: 0, drag: 0, stamp: -1, stretch: false,
      };
      this.parts.push(p);
    }
    p.x = x;
    p.y = y;
    p.vx = o.vx ?? 0;
    p.vy = o.vy ?? 0;
    p.max = p.life = o.life ?? 0.4;
    p.s0 = o.s0 ?? 1;
    p.s1 = o.s1 ?? p.s0;
    p.a0 = o.a0 ?? 1;
    p.a1 = o.a1 ?? 0;
    p.spin = o.spin ?? 0;
    p.drag = o.drag ?? 0;
    p.stamp = o.stamp ?? -1;
    p.stretch = o.stretch ?? false;
    p.img.setTexture(key).setPosition(x, y).setRotation(o.rot ?? 0).setScale(p.s0).setAlpha(p.a0)
      .setTint(o.tint ?? 0xffffff).setDepth(o.depth ?? DEPTH.FX)
      .setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL).setVisible(true);
  }

  private updateParticles(dt: number): void {
    for (const p of this.parts) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        if (p.stamp >= 0 && this.scene.room) {
          this.scene.room.decal(p.img.texture.key, p.x, p.y, p.img.scaleX, p.img.rotation, p.stamp, 0.9);
        }
        p.img.setVisible(false);
        this.free.push(p);
        continue;
      }
      if (p.drag > 0) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
        p.spin *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const t = 1 - p.life / p.max;
      const s = lerp(p.s0, p.s1, t);
      p.img.setPosition(p.x, p.y).setAlpha(lerp(p.a0, p.a1, t * t));
      if (p.stretch) {
        p.img.setScale(s, Math.max(0.3, s * 0.6));
        p.img.rotation = Math.atan2(p.vy, p.vx);
      } else {
        p.img.setScale(s);
        p.img.rotation += p.spin * dt;
      }
    }
  }

  sparks(x: number, y: number, ang: number, count: number, tint = 0xffe0a0, spread = 0.9, speed = 420): void {
    for (let i = 0; i < count; i++) {
      const a = ang + rnd(-spread, spread);
      const v = speed * rnd(0.35, 1);
      this.emit('spark', x, y, {
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.12, 0.3), s0: rnd(0.6, 1.2), s1: 0.2,
        drag: 5, tint, add: true, stretch: true, a1: 0,
      });
    }
  }

  dust(x: number, y: number, count: number, tint = 0xb8a890, speed = 70, size = 0.5): void {
    for (let i = 0; i < count; i++) {
      const a = rnd(0, TAU);
      const v = speed * rnd(0.3, 1);
      this.emit('soft', x + rnd(-6, 6), y + rnd(-6, 6), {
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.3, 0.6), s0: size * rnd(0.5, 0.9), s1: size * rnd(1.2, 1.8),
        a0: 0.3, a1: 0, drag: 3, tint, depth: DEPTH.GROUNDFX,
      });
    }
  }

  smoke(x: number, y: number, count: number, size = 1, tint = 0x3a3634): void {
    for (let i = 0; i < count; i++) {
      const a = rnd(0, TAU);
      const v = rnd(20, 110) * size;
      this.emit('soft', x + rnd(-10, 10) * size, y + rnd(-10, 10) * size, {
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 14, life: rnd(0.5, 1.1), s0: size * rnd(0.7, 1.1), s1: size * rnd(1.8, 2.6),
        a0: 0.55, a1: 0, drag: 2.4, tint,
      });
    }
  }

  /** Chunks that fly out and stay on the floor. */
  debris(x: number, y: number, ang: number, count: number, tint: number, key = 'chunk', speed = 380, spread = 1.1): void {
    for (let i = 0; i < count; i++) {
      const a = ang + rnd(-spread, spread);
      const v = speed * rnd(0.3, 1);
      this.emit(key, x, y, {
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.35, 0.7), s0: rnd(0.6, 1.25), a0: 1, a1: 1,
        rot: rnd(0, TAU), spin: rnd(-14, 14), drag: 4.5, tint, stamp: tint, depth: DEPTH.GROUNDFX,
      });
    }
  }

  /** Blood spray plus a stain on the floor. */
  blood(x: number, y: number, ang: number, amount: number, tint = 0x7a1d18): void {
    const n = Math.round(4 * amount);
    for (let i = 0; i < n; i++) {
      const a = ang + rnd(-0.7, 0.7);
      const v = rnd(120, 460);
      this.emit('dot', x, y, {
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.18, 0.4), s0: rnd(0.4, 1), a0: 1, a1: 1,
        drag: 6, tint, stamp: tint, depth: DEPTH.GROUNDFX,
      });
    }
    if (amount >= 1 && this.scene.room) {
      this.scene.room.decal(rndPick(['splat0', 'splat1', 'splat2']), x + Math.cos(ang) * 14, y + Math.sin(ang) * 14,
        rnd(0.5, 0.85) * Math.min(1.8, amount), rnd(0, TAU), tint, 0.55);
    }
  }

  shell(x: number, y: number, aim: number, key: string): void {
    const side = aim + Math.PI / 2 + rnd(-0.4, 0.4);
    const v = rnd(150, 260);
    this.emit(key, x, y, {
      vx: Math.cos(side) * v, vy: Math.sin(side) * v, life: rnd(0.4, 0.6), s0: 1, a0: 1, a1: 1,
      rot: rnd(0, TAU), spin: rnd(-25, 25), drag: 4.2, stamp: 0xffffff, depth: DEPTH.GROUNDFX,
    });
  }

  muzzle(x: number, y: number, ang: number, scale: number): void {
    this.emit('flash', x, y, { life: 0.055, s0: scale * rnd(0.8, 1.1), s1: scale * 0.6, a0: 1, a1: 0.4, rot: ang, add: true, depth: DEPTH.GLOW });
    this.emit('soft', x, y, { life: 0.09, s0: scale * 1.6, s1: scale * 2.2, a0: 0.35, a1: 0, tint: 0xffc070, add: true, depth: DEPTH.GLOW });
    this.flash(x, y, 260 * scale, 0.09);
  }

  ring(x: number, y: number, r0: number, r1: number, dur: number, tint = 0xffffff, alpha = 0.8, key = 'ring', add = true): void {
    this.emit(key, x, y, { life: dur, s0: r0 / 58, s1: r1 / 58, a0: alpha, a1: 0, tint, add, depth: DEPTH.GLOW });
  }

  explosion(x: number, y: number, radius: number): void {
    const k = radius / 120;
    this.emit('soft', x, y, { life: 0.16, s0: k * 2.2, s1: k * 4.6, a0: 1, a1: 0, tint: 0xfff0c0, add: true, depth: DEPTH.GLOW });
    this.emit('soft', x, y, { life: 0.34, s0: k * 2.6, s1: k * 4.2, a0: 0.8, a1: 0, tint: 0xff8a30, add: true, depth: DEPTH.GLOW });
    this.ring(x, y, radius * 0.3, radius * 1.15, 0.28, 0xffd9a0, 0.9);
    this.sparks(x, y, 0, Math.round(14 * k), 0xffc060, Math.PI, 700 * k);
    this.smoke(x, y, Math.round(9 * k), 1.5 * k);
    this.debris(x, y, 0, Math.round(6 * k), 0x2a2622, 'chunk', 420, Math.PI);
    this.flash(x, y, radius * 4, 0.3);
    this.shake(0.5 * k);
    if (this.scene.room) this.scene.room.decal('scorch', x, y, k * 1.25, rnd(0, TAU), 0xffffff, 0.7);
    audio.play('explosion', clamp(k, 0.5, 1.2));
  }

  // ------------------------------------------------------------ floating text

  text(x: number, y: number, str: string, color = '#ffffff', size = 26, life = 0.7): void {
    let t = this.texts.find((q) => !q.active);
    if (!t) {
      if (this.texts.length >= 40) return;
      const txt = this.scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '26px', fontStyle: '700', color: '#fff' })
        .setOrigin(0.5).setDepth(DEPTH.WTEXT).setStroke('#17120f', 5);
      t = { txt, life: 0, max: 1, vy: 0, active: false };
      this.texts.push(t);
    }
    t.active = true;
    t.life = t.max = life;
    t.vy = -70;
    t.txt.setText(str).setFontSize(size).setColor(color).setPosition(x + rnd(-8, 8), y).setAlpha(1).setScale(1.5).setVisible(true);
  }

  private updateTexts(dt: number): void {
    for (const t of this.texts) {
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        t.txt.setVisible(false);
        continue;
      }
      const k = 1 - t.life / t.max;
      t.txt.y += t.vy * dt;
      t.vy *= Math.exp(-3 * dt);
      t.txt.setScale(lerp(1.5, 1, clamp(k * 6, 0, 1)));
      t.txt.setAlpha(k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1);
    }
  }

  // ------------------------------------------------------------ camera feel

  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount * this.shakeScale);
  }

  /** Shove the camera in a direction (used for gun recoil). */
  kick(ang: number, amount: number): void {
    this.kickX += Math.cos(ang) * amount * this.shakeScale;
    this.kickY += Math.sin(ang) * amount * this.shakeScale;
  }

  hitstop(sec: number): void {
    this.freeze = Math.max(this.freeze, sec);
  }

  slowmo(scale: number, dur: number): void {
    this.slowScale = scale;
    this.slowT = dur;
  }

  /** Converts real dt into game dt, applying hit-stop and slow motion. */
  timeScale(dtReal: number): number {
    if (this.freeze > 0) {
      this.freeze -= dtReal;
      return dtReal * 0.02;
    }
    if (this.slowT > 0) {
      this.slowT -= dtReal;
      const k = this.slowT < 0.25 ? lerp(1, this.slowScale, Math.max(0, this.slowT) / 0.25) : this.slowScale;
      return dtReal * k;
    }
    return dtReal;
  }

  // ------------------------------------------------------------ lighting

  /** A short-lived light, e.g. a muzzle flash. */
  flash(x: number, y: number, r: number, dur: number): void {
    if (this.flashes.length > 24) return;
    this.flashes.push({ x, y, r, life: dur, max: dur });
  }

  /** Call once per frame per light source, between beginLights() and endLights(). */
  light(x: number, y: number, radius: number, alpha = 1): void {
    const cam = this.scene.cameras.main;
    const sx = x - cam.scrollX;
    const sy = y - cam.scrollY;
    if (sx < -radius || sy < -radius || sx > GW + radius || sy > GH + radius) return;
    let img = this.lightPool[this.lightCount];
    if (!img) {
      img = this.scene.make.image({ key: 'light', add: false });
      this.lightPool.push(img);
    }
    this.lightCount++;
    img.setPosition((sx + DARK_PAD) / DARK_SCALE, (sy + DARK_PAD) / DARK_SCALE)
      .setScale((radius * 2) / 256 / DARK_SCALE).setAlpha(alpha);
  }

  beginLights(): void {
    this.lightCount = 0;
  }

  endLights(): void {
    for (const f of this.flashes) this.light(f.x, f.y, f.r, 0.8 * (f.life / f.max));
    this.dark.clear();
    this.dark.fill(this.darkColor, this.darkAlpha);
    if (this.lightCount > 0) this.dark.erase(this.lightPool.slice(0, this.lightCount));
  }

  // ------------------------------------------------------------ frame

  update(dtReal: number, dt: number): void {
    this.updateParticles(dt);
    this.updateTexts(dtReal);
    for (const f of this.flashes) f.life -= dtReal;
    this.flashes = this.flashes.filter((f) => f.life > 0);
    this.trauma = Math.max(0, this.trauma - dtReal * 1.9);
    const k = Math.exp(-14 * dtReal);
    this.kickX *= k;
    this.kickY *= k;
  }

  /** Camera offset produced by shake + kick this frame. */
  shakeOffset(time: number, out: { x: number; y: number; rot: number }): void {
    const t2 = this.trauma * this.trauma;
    const n = (seed: number) => Math.sin(time * 0.071 + seed) * 0.6 + Math.sin(time * 0.113 + seed * 2.3) * 0.4;
    out.x = this.kickX + n(1) * 26 * t2;
    out.y = this.kickY + n(7) * 26 * t2;
    out.rot = n(13) * 0.022 * t2;
  }

  clearTransient(): void {
    for (const p of this.parts) {
      if (p.life > 0) {
        p.life = 0;
        p.img.setVisible(false);
        this.free.push(p);
      }
    }
    for (const t of this.texts) {
      t.active = false;
      t.txt.setVisible(false);
    }
    this.flashes = [];
  }
}
