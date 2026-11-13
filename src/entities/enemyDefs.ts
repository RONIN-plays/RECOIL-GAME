export type EnemyType =
  | 'grunt'
  | 'shotgunner'
  | 'swarmer'
  | 'charger'
  | 'sniper'
  | 'grenadier'
  | 'turret'
  | 'heavy'
  | 'drone';

export interface EnemyDef {
  name: string;
  hp: number;
  speed: number;
  r: number;
  /** Spawn budget cost. */
  cost: number;
  minFloor: number;
  minDepth: number;
  coins: [number, number];
  score: number;
  /** Knockback resistance: higher = heavier. */
  mass: number;
  /** Colour of death debris. */
  tint: number;
  /** Spawned in packs of this size. */
  pack?: number;
}

export const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  grunt: { name: 'Cutthroat', hp: 30, speed: 150, r: 19, cost: 2, minFloor: 0, minDepth: 0, coins: [1, 2], score: 20, mass: 1, tint: 0x8c4a32 },
  swarmer: { name: 'Gnawer', hp: 10, speed: 285, r: 12, cost: 1, minFloor: 0, minDepth: 0, coins: [0, 1], score: 8, mass: 0.5, tint: 0x4a3a4f, pack: 3 },
  shotgunner: { name: 'Breaker', hp: 46, speed: 135, r: 21, cost: 3, minFloor: 0, minDepth: 1, coins: [1, 3], score: 30, mass: 1.3, tint: 0x5d6b3a },
  charger: { name: 'Bull', hp: 85, speed: 120, r: 26, cost: 4, minFloor: 0, minDepth: 2, coins: [2, 4], score: 45, mass: 2.4, tint: 0x6e2b2b },
  turret: { name: 'Sentry', hp: 70, speed: 0, r: 24, cost: 4, minFloor: 0, minDepth: 3, coins: [2, 4], score: 40, mass: 99, tint: 0x4b4f57 },
  sniper: { name: 'Marksman', hp: 30, speed: 130, r: 18, cost: 3, minFloor: 1, minDepth: 0, coins: [2, 3], score: 40, mass: 0.9, tint: 0x5b5470 },
  grenadier: { name: 'Sapper', hp: 44, speed: 125, r: 20, cost: 3, minFloor: 1, minDepth: 0, coins: [2, 3], score: 40, mass: 1.2, tint: 0xb08a2e },
  drone: { name: 'Whirligig', hp: 38, speed: 210, r: 18, cost: 3, minFloor: 1, minDepth: 1, coins: [1, 3], score: 35, mass: 0.8, tint: 0xa8793a },
  heavy: { name: 'Bulwark', hp: 150, speed: 80, r: 28, cost: 6, minFloor: 1, minDepth: 2, coins: [4, 6], score: 80, mass: 4, tint: 0x6f7782 },
};

export const ENEMY_TYPES = Object.keys(ENEMY_DEFS) as EnemyType[];
