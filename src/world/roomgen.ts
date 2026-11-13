import { RNG } from '../core/rng';
import { ENEMY_DEFS, ENEMY_TYPES, type EnemyType } from '../entities/enemyDefs';
import { DIRS, type Dir, type RoomNode } from './floorgen';

export const T = { FLOOR: 0, WALL: 1, BLOCK: 2, DOOR: 3 } as const;

export interface PropDef {
  tx: number;
  ty: number;
  kind: 'crate' | 'barrel';
}

export interface LampDef {
  tx: number;
  ty: number;
  side: Dir;
}

export interface RoomLayout {
  w: number;
  h: number;
  tiles: Uint8Array;
  props: PropDef[];
  lamps: LampDef[];
  carpet: boolean;
}

/** The two tiles of a door in the wall ring. */
export function doorTiles(w: number, h: number, dir: Dir): [number, number][] {
  const cx = w / 2;
  const cy = h / 2;
  switch (dir) {
    case 'n': return [[cx - 1, 0], [cx, 0]];
    case 's': return [[cx - 1, h - 1], [cx, h - 1]];
    case 'w': return [[0, cy - 1], [0, cy]];
    case 'e': return [[w - 1, cy - 1], [w - 1, cy]];
  }
}

const COMBAT_SIZES: [number, number][] = [
  [16, 10], [18, 12], [20, 12], [20, 14], [22, 12], [22, 14], [24, 14], [26, 14],
];

export function roomSize(node: RoomNode, floorIndex: number): [number, number] {
  const rng = new RNG(node.seed ^ 0x51ed);
  switch (node.type) {
    case 'start': return [14, 10];
    case 'treasure': return [12, 10];
    case 'shop': return [18, 10];
    case 'boss': return floorIndex % 3 === 2 ? [28, 16] : [26, 16];
    default: {
      const lo = Math.min(floorIndex, 2);
      return COMBAT_SIZES[rng.int(lo, Math.min(COMBAT_SIZES.length - 1, 4 + floorIndex * 2))];
    }
  }
}

export function generateRoom(node: RoomNode, floorIndex: number, size?: [number, number]): RoomLayout {
  const rng = new RNG(node.seed);
  const [w, h] = size ?? roomSize(node, floorIndex);
  const tiles = new Uint8Array(w * h);
  const idx = (x: number, y: number) => y * w + x;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      tiles[idx(x, y)] = x === 0 || y === 0 || x === w - 1 || y === h - 1 ? T.WALL : T.FLOOR;
    }
  }

  // Tiles that must stay open: a lane in from every wall midpoint.
  const keep = new Uint8Array(w * h);
  for (const d of DIRS) {
    for (const [dx, dy] of doorTiles(w, h, d)) {
      for (let k = 0; k <= 3; k++) {
        for (let s = -1; s <= 1; s++) {
          let x = dx;
          let y = dy;
          if (d === 'n') { y = dy + k; x = dx + s; }
          if (d === 's') { y = dy - k; x = dx + s; }
          if (d === 'w') { x = dx + k; y = dy + s; }
          if (d === 'e') { x = dx - k; y = dy + s; }
          if (x >= 0 && y >= 0 && x < w && y < h) keep[idx(x, y)] = 1;
        }
      }
    }
  }
  for (const d of DIRS) {
    if (node.doors[d] === undefined) continue;
    for (const [dx, dy] of doorTiles(w, h, d)) tiles[idx(dx, dy)] = T.DOOR;
  }

  const setBlock = (x: number, y: number) => {
    // Keep a one-tile ring next to the walls free so the perimeter is always walkable.
    if (x < 2 || y < 2 || x > w - 3 || y > h - 3) return;
    if (keep[idx(x, y)]) return;
    tiles[idx(x, y)] = T.BLOCK;
  };
  /** Place a rect mirrored into all four quadrants. */
  const sym = (x: number, y: number, bw: number, bh: number) => {
    for (let j = 0; j < bh; j++) {
      for (let i = 0; i < bw; i++) {
        const px = x + i;
        const py = y + j;
        setBlock(px, py);
        setBlock(w - 1 - px, py);
        setBlock(px, h - 1 - py);
        setBlock(w - 1 - px, h - 1 - py);
      }
    }
  };

  const props: PropDef[] = [];
  let carpet = false;

  if (node.type === 'combat') {
    const pattern = rng.int(0, 7);
    const qx = Math.floor(w / 4);
    const qy = Math.floor(h / 4);
    switch (pattern) {
      case 0:
        break; // open arena
      case 1: {
        const s = rng.chance(0.5) ? 2 : 1;
        sym(qx, qy, s, s);
        break;
      }
      case 2: {
        const bw = rng.int(1, 2) * 2;
        const bh = rng.int(1, 2) * 2;
        for (let j = 0; j < bh; j++) {
          for (let i = 0; i < bw; i++) {
            const x = w / 2 - bw / 2 + i;
            const y = h / 2 - bh / 2 + j;
            if (x >= 2 && y >= 2 && x <= w - 3 && y <= h - 3) tiles[idx(x, y)] = T.BLOCK;
          }
        }
        if (rng.chance(0.5)) sym(2 + rng.int(1, 2), 2 + rng.int(0, 1), 1, 1);
        break;
      }
      case 3: {
        const len = rng.int(2, Math.max(2, qx - 1));
        sym(qx - 1, qy + rng.int(0, 1), len, 1);
        break;
      }
      case 4: {
        const n = rng.int(2, 3);
        for (let i = 0; i < n; i++) {
          sym(rng.int(2, w / 2 - 2), rng.int(2, h / 2 - 1), rng.int(1, 2), rng.int(1, 2));
        }
        break;
      }
      case 5: {
        const len = rng.int(2, Math.max(2, qy));
        sym(qx + rng.int(0, 1), qy - 1, 1, len);
        break;
      }
      case 6: {
        sym(qx, qy, 1, 1);
        sym(qx + 2, qy + 1, 1, 1);
        if (w >= 20) sym(qx - 2, qy + 1, 1, 1);
        break;
      }
      default: {
        // L-shaped corner cover
        sym(qx, qy, 2, 1);
        sym(qx, qy, 1, 2);
        break;
      }
    }
  } else if (node.type === 'treasure') {
    sym(2, 2, 1, 1);
  } else if (node.type === 'shop') {
    carpet = true;
  } else if (node.type === 'boss') {
    if (floorIndex % 3 === 0) sym(5, 4, 2, 2);
    else if (floorIndex % 3 === 1) sym(6, 5, 1, 1);
  }

  const isFree = (x: number, y: number) => x > 0 && y > 0 && x < w - 1 && y < h - 1 && tiles[idx(x, y)] === T.FLOOR;
  const propAt = (x: number, y: number) => props.some((p) => p.tx === x && p.ty === y);

  const connected = (): boolean => {
    const seen = new Uint8Array(w * h);
    let sx = -1;
    let sy = -1;
    let total = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (isFree(x, y) && !propAt(x, y)) {
          total++;
          if (sx < 0) { sx = x; sy = y; }
        }
      }
    }
    if (sx < 0) return false;
    const q = [[sx, sy]];
    seen[idx(sx, sy)] = 1;
    let count = 0;
    while (q.length) {
      const [x, y] = q.pop()!;
      count++;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox;
        const ny = y + oy;
        if (!isFree(nx, ny) || propAt(nx, ny) || seen[idx(nx, ny)]) continue;
        seen[idx(nx, ny)] = 1;
        q.push([nx, ny]);
      }
    }
    return count === total;
  };

  if (!connected()) {
    for (let i = 0; i < tiles.length; i++) if (tiles[i] === T.BLOCK) tiles[i] = T.FLOOR;
  }

  // Destructible clutter: crates clump next to cover, barrels stand alone.
  if (node.type === 'combat' || node.type === 'start') {
    const crateCount = node.type === 'combat' ? rng.int(2, 7) : 3;
    const barrelCount = node.type === 'combat' ? rng.int(0, 3) : 0;
    const tryPlace = (kind: 'crate' | 'barrel', x: number, y: number): boolean => {
      if (!isFree(x, y) || keep[idx(x, y)] || propAt(x, y)) return false;
      props.push({ tx: x, ty: y, kind });
      if (!connected()) {
        props.pop();
        return false;
      }
      return true;
    };
    let tries = 0;
    let placed = 0;
    while (placed < crateCount && tries++ < 80) {
      const x = rng.int(1, w - 2);
      const y = rng.int(1, h - 2);
      // prefer spots touching a wall, a block or another crate
      const touching =
        !isFree(x + 1, y) || !isFree(x - 1, y) || !isFree(x, y + 1) || !isFree(x, y - 1) ||
        propAt(x + 1, y) || propAt(x - 1, y) || propAt(x, y + 1) || propAt(x, y - 1);
      if (!touching && tries < 60) continue;
      if (tryPlace('crate', x, y)) placed++;
    }
    tries = 0;
    placed = 0;
    while (placed < barrelCount && tries++ < 40) {
      if (tryPlace('barrel', rng.int(2, w - 3), rng.int(2, h - 3))) placed++;
    }
  }

  // Wall lamps
  const lamps: LampDef[] = [];
  const isDoorOrNear = (x: number, y: number) => {
    for (const d of DIRS) {
      for (const [dx, dy] of doorTiles(w, h, d)) {
        if (Math.abs(dx - x) + Math.abs(dy - y) <= 1) return true;
      }
    }
    return false;
  };
  const stepX = w <= 14 ? 4 : 5;
  for (let x = 2; x < w - 2; x += stepX) {
    if (!isDoorOrNear(x, 0)) lamps.push({ tx: x, ty: 0, side: 'n' });
    const bx = w - 1 - x;
    if (!isDoorOrNear(bx, h - 1)) lamps.push({ tx: bx, ty: h - 1, side: 's' });
  }
  for (let y = 2; y < h - 2; y += 4) {
    if (!isDoorOrNear(0, y)) lamps.push({ tx: 0, ty: y, side: 'w' });
    const by = h - 1 - y;
    if (!isDoorOrNear(w - 1, by)) lamps.push({ tx: w - 1, ty: by, side: 'e' });
  }

  return { w, h, tiles, props, lamps, carpet };
}

// ------------------------------------------------------------------ waves

/** Builds the enemy waves for a combat room. */
export function generateWaves(seed: number, floorIndex: number, depth: number, loop: number): EnemyType[][] {
  const rng = new RNG(seed ^ 0xa11ce);
  const f = Math.min(floorIndex, 2);
  const base = [6, 11, 16][f] + depth * [1.1, 1.4, 1.7][f];
  const budget = base * (1 + loop * 0.45);
  const waveCount = depth <= 1 && f === 0 ? 2 : rng.chance(0.55) ? 3 : 2;

  const pool = ENEMY_TYPES.filter((t) => {
    const d = ENEMY_DEFS[t];
    if (loop > 0) return true;
    return d.minFloor < floorIndex || (d.minFloor === floorIndex && d.minDepth <= depth);
  });

  const waves: EnemyType[][] = [];
  for (let wi = 0; wi < waveCount; wi++) {
    let left = budget * (0.8 + wi * 0.18);
    const wave: EnemyType[] = [];
    let turrets = 0;
    let heavies = 0;
    let guard = 0;
    while (left >= 1 && wave.length < 11 && guard++ < 60) {
      const t = rng.pick(pool);
      const d = ENEMY_DEFS[t];
      const n = d.pack ?? 1;
      const cost = d.cost * n;
      if (cost > left + 0.5) continue;
      if (t === 'turret' && turrets >= 2) continue;
      if (t === 'heavy' && heavies >= 2) continue;
      if (t === 'turret') turrets++;
      if (t === 'heavy') heavies++;
      for (let i = 0; i < n; i++) wave.push(t);
      left -= cost;
    }
    if (wave.length === 0) wave.push('grunt', 'grunt');
    waves.push(wave);
  }
  return waves;
}
