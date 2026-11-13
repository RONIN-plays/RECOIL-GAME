import { RNG } from '../core/rng';
import type { RoomLayout } from './roomgen';

export type Dir = 'n' | 'e' | 's' | 'w';
export const DIRS: Dir[] = ['n', 'e', 's', 'w'];
export const DV: Record<Dir, [number, number]> = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
export const OPP: Record<Dir, Dir> = { n: 's', s: 'n', e: 'w', w: 'e' };

export type RoomType = 'start' | 'combat' | 'treasure' | 'shop' | 'boss';

/** Anything left on the floor of a room that should still be there on return. */
export interface SavedItem {
  kind: string;
  x: number;
  y: number;
  data?: Record<string, unknown>;
}

export interface RoomNode {
  id: number;
  gx: number;
  gy: number;
  type: RoomType;
  doors: Partial<Record<Dir, number>>;
  depth: number;
  cleared: boolean;
  visited: boolean;
  seen: boolean;
  seed: number;
  layout?: RoomLayout;
  saved?: SavedItem[];
}

export interface FloorPlan {
  rooms: RoomNode[];
  startId: number;
  bossId: number;
  index: number;
  loop: number;
  seed: number;
}

const key = (x: number, y: number) => `${x},${y}`;

export function generateFloor(seed: number, index: number, loop = 0): FloorPlan {
  const rng = new RNG(seed);
  const rooms: RoomNode[] = [];
  const cells = new Map<string, RoomNode>();

  const add = (gx: number, gy: number, type: RoomType): RoomNode => {
    const node: RoomNode = {
      id: rooms.length, gx, gy, type, doors: {}, depth: 0,
      cleared: type !== 'combat' && type !== 'boss', visited: false, seen: false, seed: rng.seed(),
    };
    rooms.push(node);
    cells.set(key(gx, gy), node);
    return node;
  };
  const link = (a: RoomNode, b: RoomNode, d: Dir) => {
    a.doors[d] = b.id;
    b.doors[OPP[d]] = a.id;
  };
  const neighbours = (gx: number, gy: number): RoomNode[] => {
    const out: RoomNode[] = [];
    for (const d of DIRS) {
      const n = cells.get(key(gx + DV[d][0], gy + DV[d][1]));
      if (n) out.push(n);
    }
    return out;
  };

  const start = add(0, 0, 'start');
  const combatCount = 6 + Math.min(index, 2) + rng.int(0, 2);

  let guard = 0;
  while (rooms.length < combatCount + 1 && guard++ < 2000) {
    // Bias toward recently added rooms so floors have corridors, not just blobs.
    const from = rng.chance(0.6) ? rooms[Math.max(0, rooms.length - 1 - rng.int(0, 2))] : rng.pick(rooms);
    const d = rng.pick(DIRS);
    const nx = from.gx + DV[d][0];
    const ny = from.gy + DV[d][1];
    if (cells.has(key(nx, ny))) continue;
    const nb = neighbours(nx, ny).length;
    if (nb > 2 || (nb === 2 && !rng.chance(0.3))) continue;
    link(from, add(nx, ny, 'combat'), d);
  }

  // A few extra connections so the map has loops.
  for (const a of rooms) {
    for (const d of ['e', 's'] as Dir[]) {
      const b = cells.get(key(a.gx + DV[d][0], a.gy + DV[d][1]));
      if (b && a.doors[d] === undefined && rng.chance(0.25)) link(a, b, d);
    }
  }

  const computeDepth = () => {
    for (const r of rooms) r.depth = -1;
    start.depth = 0;
    const q = [start];
    while (q.length) {
      const r = q.shift()!;
      for (const d of DIRS) {
        const id = r.doors[d];
        if (id === undefined) continue;
        const n = rooms[id];
        if (n.depth < 0) {
          n.depth = r.depth + 1;
          q.push(n);
        }
      }
    }
  };
  computeDepth();

  // Special rooms hang off exactly one existing room, as dead ends.
  const candidates = (allowStart: boolean) => {
    const out: { gx: number; gy: number; parent: RoomNode; dir: Dir }[] = [];
    const seen = new Set<string>();
    for (const r of rooms) {
      if (r.type !== 'combat' && !(allowStart && r.type === 'start')) continue;
      for (const d of DIRS) {
        const nx = r.gx + DV[d][0];
        const ny = r.gy + DV[d][1];
        const k = key(nx, ny);
        if (cells.has(k) || seen.has(k)) continue;
        if (neighbours(nx, ny).length !== 1) continue;
        seen.add(k);
        out.push({ gx: nx, gy: ny, parent: r, dir: d });
      }
    }
    return out;
  };
  const attach = (type: RoomType, pick: 'deep' | 'any'): RoomNode => {
    let c = candidates(false);
    if (!c.length) c = candidates(true);
    if (!c.length) {
      // Extremely unlikely; fall back to extending in a straight line from the deepest room.
      const deepest = rooms.reduce((a, b) => (b.depth > a.depth ? b : a));
      let gx = deepest.gx;
      while (cells.has(key(gx + 1, deepest.gy))) gx++;
      const parent = cells.get(key(gx, deepest.gy))!;
      const node = add(gx + 1, deepest.gy, type);
      link(parent, node, 'e');
      computeDepth();
      return node;
    }
    let chosen = c[0];
    if (pick === 'deep') {
      const max = Math.max(...c.map((x) => x.parent.depth));
      chosen = rng.pick(c.filter((x) => x.parent.depth === max));
    } else {
      chosen = rng.pick(c);
    }
    const node = add(chosen.gx, chosen.gy, type);
    link(chosen.parent, node, chosen.dir);
    computeDepth();
    return node;
  };

  const boss = attach('boss', 'deep');
  attach('treasure', 'any');
  attach('shop', 'any');

  start.cleared = true;
  return { rooms, startId: start.id, bossId: boss.id, index, loop, seed };
}
