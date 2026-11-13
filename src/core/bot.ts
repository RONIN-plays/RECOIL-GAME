import { TILE } from '../config';
import type { Controls } from '../entities/player';
import type { GameScene } from '../scenes/GameScene';
import { DIRS, type Dir } from '../world/floorgen';

/**
 * An auto-player used for automated playtests (?bot=1). It is not smart, but it
 * plays whole runs end to end, which exercises every room type, boss and menu path.
 */
export class Bot {
  private field: Int16Array | null = null;
  private fieldKey = '';
  private tmp = { x: 0, y: 0 };
  private strafe = 1;
  private strafeT = 0;
  private frame = 0;
  private stuckT = 0;
  private lastX = 0;
  private lastY = 0;
  done: string | null = null;

  constructor(private s: GameScene) {}

  private nav(c: Controls, x: number, y: number): void {
    const s = this.s;
    const room = s.room;
    const p = s.player;
    const tx = Math.max(0, Math.min(room.w - 1, Math.floor(x / TILE)));
    const ty = Math.max(0, Math.min(room.h - 1, Math.floor(y / TILE)));
    const key = `${room.node.id}:${s.run.floorIndex}:${s.run.loop}:${tx},${ty}:${room.props.length}`;
    if (key !== this.fieldKey || !this.field || this.field.length !== room.w * room.h) {
      this.field = new Int16Array(room.w * room.h);
      room.fillFlow(this.field, tx, ty, false);
      this.fieldKey = key;
    }
    if (room.flowDir(p.x, p.y, this.tmp, this.field, false)) {
      c.mx = this.tmp.x;
      c.my = this.tmp.y;
    } else {
      const dx = x - p.x;
      const dy = y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      c.mx = dx / d;
      c.my = dy / d;
    }
  }

  /** First door to take on the shortest path to the nearest unvisited room. */
  private nextDoor(): Dir | null {
    const plan = this.s.run.plan;
    const start = this.s.room.node;
    const others = plan.rooms.some((r) => !r.visited && r.type !== 'boss');
    const want = (id: number) => {
      const r = plan.rooms[id];
      if (r.visited) return false;
      return r.type !== 'boss' || !others;
    };
    const seen = new Set<number>([start.id]);
    const q: { id: number; first: Dir }[] = [];
    for (const d of DIRS) {
      const n = start.doors[d];
      if (n === undefined) continue;
      seen.add(n);
      q.push({ id: n, first: d });
    }
    while (q.length) {
      const cur = q.shift()!;
      if (want(cur.id)) return cur.first;
      const r = plan.rooms[cur.id];
      // never path through an uncleared boss room
      if (r.type === 'boss' && !r.cleared) continue;
      for (const d of DIRS) {
        const n = r.doors[d];
        if (n === undefined || seen.has(n)) continue;
        seen.add(n);
        q.push({ id: n, first: cur.first });
      }
    }
    return null;
  }

  update(c: Controls): void {
    const s = this.s;
    const p = s.player;
    const room = s.room;
    this.frame++;
    c.mx = c.my = 0;
    c.fire = c.roll = c.reload = c.interact = c.blank = false;
    c.slot = -1;
    c.cycle = 0;
    if (!room) return;

    if (s.run.over) {
      this.done = 'dead';
      return;
    }
    if (s.modal) {
      if (s.run.won) {
        this.done = 'victory';
        return;
      }
      s.events.emit('botPick');
      return;
    }
    if (p.dead || p.frozen) return;

    // prefer the best gun that still has ammo
    let best = 0;
    for (let i = 1; i < p.weapons.length; i++) {
      const w = p.weapons[i];
      if (w.clip + w.reserve > 0 && w.def.tier >= p.weapons[best].def.tier) best = i;
    }
    if (best !== p.cur && this.frame % 30 === 0) c.slot = best;

    const enemies = s.enemies.list.filter((e) => e.spawnT <= 0 && !e.dead);
    if (enemies.length) {
      let target = enemies[0];
      let bd = Infinity;
      for (const e of enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y) + (room.los(p.x, p.y, e.x, e.y) ? 0 : 600);
        if (d < bd) {
          bd = d;
          target = e;
        }
      }
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const los = room.los(p.x, p.y, target.x, target.y);
      c.aimX = target.x;
      c.aimY = target.y;
      c.fire = los;

      this.strafeT--;
      if (this.strafeT <= 0) {
        this.strafeT = 40 + Math.floor(Math.random() * 80);
        if (Math.random() < 0.5) this.strafe = -this.strafe;
      }
      if (!los) {
        this.nav(c, target.x, target.y);
      } else {
        const ideal = target.boss ? 420 : 300;
        const radial = d > ideal + 80 ? 1 : d < ideal - 80 ? -1 : 0;
        c.mx = (-dy / d) * this.strafe + (dx / d) * radial;
        c.my = (dx / d) * this.strafe + (dy / d) * radial;
      }

      // dodge anything about to hit
      let threat = 0;
      for (const b of s.bullets.list) {
        if (!b.active || b.friendly) continue;
        const bx = b.x - p.x;
        const by = b.y - p.y;
        const bd2 = bx * bx + by * by;
        if (bd2 > 130 * 130) continue;
        // approaching?
        if (bx * b.vx + by * b.vy < 0) threat++;
      }
      if (threat > 0 && p.rollCd <= 0 && !p.rolling) c.roll = true;
      if (threat >= 5 && p.hp <= 2 && p.blanks > 0) c.blank = true;
      return;
    }

    c.aimX = p.x + (c.mx || 1) * 100;
    c.aimY = p.y + c.my * 100;

    if (s.roomActive) {
      // waiting for the next wave: hold the middle
      this.nav(c, room.pw / 2, room.ph / 2);
      if (Math.hypot(room.pw / 2 - p.x, room.ph / 2 - p.y) < 60) c.mx = c.my = 0;
      return;
    }

    // loot and interactables
    const want = s.pickups.list.find((k) => {
      if (k.dead) return false;
      if (k.kind === 'chest') return !k.data.opened;
      if (k.kind === 'upgrade') return true;
      if (k.kind === 'weapon') return !p.weapons.some((w) => w.def.id === k.data.weapon) && p.weapons.length < 4;
      if (k.kind === 'shop') return s.run.coins >= (k.data.price ?? 0) && (k.data.item === 'upgrade' || (k.data.item === 'heart' && p.hp < p.maxHp));
      if (k.kind === 'heart' || k.kind === 'half') return p.hp < p.maxHp;
      if (k.kind === 'stairs') return true;
      return false;
    });
    if (want) {
      this.nav(c, want.x, want.y);
      if (Math.hypot(want.x - p.x, want.y - p.y) < 70 && this.frame % 6 === 0) c.interact = true;
      this.unstick(c);
      return;
    }

    const dir = this.nextDoor();
    if (dir) {
      const dc = room.doorCentre(dir);
      this.nav(c, dc.x, dc.y);
      // once on the threshold, push through
      if (Math.hypot(dc.x - p.x, dc.y - p.y) < TILE * 0.9) {
        c.mx = dir === 'e' ? 1 : dir === 'w' ? -1 : 0;
        c.my = dir === 's' ? 1 : dir === 'n' ? -1 : 0;
      }
      this.unstick(c);
    }
  }

  /** If we haven't moved for a while, jiggle sideways and roll. */
  private unstick(c: Controls): void {
    const p = this.s.player;
    if (this.frame % 30 !== 0) {
      if (this.stuckT > 2) {
        c.mx += Math.sin(this.frame * 0.3);
        c.my += Math.cos(this.frame * 0.3);
        if (this.frame % 40 === 5) c.roll = true;
      }
      return;
    }
    const moved = Math.hypot(p.x - this.lastX, p.y - this.lastY);
    this.lastX = p.x;
    this.lastY = p.y;
    this.stuckT = moved < 12 ? this.stuckT + 1 : 0;
  }
}
