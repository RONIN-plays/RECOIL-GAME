// Sanity checks for procedural generation across many seeds. Run with: npm run test:gen
import { generateFloor, DIRS, DV, OPP } from '../src/world/floorgen';
import { generateRoom, generateWaves, T, doorTiles } from '../src/world/roomgen';

let failures = 0;
const fail = (msg: string) => {
  failures++;
  if (failures < 20) console.error('FAIL', msg);
};

let roomsChecked = 0;
const sizeHist: Record<string, number> = {};
for (let seed = 1; seed <= 600; seed++) {
  for (let fi = 0; fi < 3; fi++) {
    const plan = generateFloor(seed * 7919 + fi, fi);
    const types = plan.rooms.map((r) => r.type);
    for (const t of ['start', 'boss', 'treasure', 'shop']) {
      if (types.filter((x) => x === t).length !== 1) fail(`seed ${seed} floor ${fi}: expected exactly one ${t}`);
    }
    // all rooms reachable, doors symmetric and geometrically adjacent
    for (const r of plan.rooms) {
      if (r.depth < 0) fail(`seed ${seed}: room ${r.id} unreachable`);
      for (const d of DIRS) {
        const id = r.doors[d];
        if (id === undefined) continue;
        const n = plan.rooms[id];
        if (n.doors[OPP[d]] !== r.id) fail(`seed ${seed}: asymmetric door`);
        if (n.gx !== r.gx + DV[d][0] || n.gy !== r.gy + DV[d][1]) fail(`seed ${seed}: door to non-adjacent room`);
      }
      if (r.type !== 'combat' && r.type !== 'start' && Object.keys(r.doors).length !== 1) {
        fail(`seed ${seed}: special room ${r.type} has ${Object.keys(r.doors).length} doors`);
      }
    }
    const cells = new Set(plan.rooms.map((r) => `${r.gx},${r.gy}`));
    if (cells.size !== plan.rooms.length) fail(`seed ${seed}: overlapping rooms`);
    sizeHist[plan.rooms.length] = (sizeHist[plan.rooms.length] ?? 0) + 1;

    for (const r of plan.rooms) {
      const L = generateRoom(r, fi);
      roomsChecked++;
      const solid = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= L.w || y >= L.h) return true;
        const t = L.tiles[y * L.w + x];
        if (t === T.WALL || t === T.BLOCK) return true;
        return L.props.some((p) => p.tx === x && p.ty === y);
      };
      let total = 0;
      let sx = -1;
      let sy = -1;
      for (let y = 0; y < L.h; y++) {
        for (let x = 0; x < L.w; x++) {
          if (!solid(x, y)) { total++; sx = x; sy = y; }
        }
      }
      const seen = new Set<number>([sy * L.w + sx]);
      const q = [[sx, sy]];
      while (q.length) {
        const [x, y] = q.pop()!;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + ox;
          const ny = y + oy;
          if (solid(nx, ny) || seen.has(ny * L.w + nx)) continue;
          seen.add(ny * L.w + nx);
          q.push([nx, ny]);
        }
      }
      if (seen.size !== total) fail(`seed ${seed} room ${r.id} (${r.type}): disconnected floor ${seen.size}/${total}`);
      for (const d of DIRS) {
        const has = r.doors[d] !== undefined;
        for (const [dx, dy] of doorTiles(L.w, L.h, d)) {
          const t = L.tiles[dy * L.w + dx];
          if (has && t !== T.DOOR) fail(`seed ${seed}: missing door tile`);
          if (!has && t !== T.WALL) fail(`seed ${seed}: door tile where no door`);
        }
      }
      if (r.type === 'combat') {
        const waves = generateWaves(r.seed, fi, r.depth, 0);
        if (waves.length < 2 || waves.some((w) => w.length === 0)) fail(`seed ${seed}: bad waves`);
      }
    }
  }
}
console.log(`checked ${roomsChecked} rooms; floor size histogram:`, sizeHist);
for (const [fi, depth] of [[0, 1], [0, 4], [1, 2], [1, 5], [2, 2], [2, 6]] as const) {
  console.log(`sample waves floor ${fi + 1} depth ${depth}:`, JSON.stringify(generateWaves(12345 + depth, fi, depth, 0)));
}
if (failures) {
  console.error(`${failures} FAILURES`);
  process.exit(1);
}
console.log('generation OK');
