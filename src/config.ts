export const GW = 1920;
export const GH = 1080;
export const TILE = 64;

export const FONT = 'Oswald, "Arial Narrow", Impact, sans-serif';

/** Camera zoom on desktop: the view shows 24 x 13.5 tiles. */
export const ZOOM = 1.25;
/** Camera zoom in touch mode: closer, so characters and bullets read on a phone (15 x 8.4 tiles). */
export const TOUCH_ZOOM = 1.6;
/** Camera zoom in touch mode during a boss fight: wide enough to keep the boss on screen from across the arena. */
export const TOUCH_BOSS_ZOOM = 1.3;
/** Floating world text (damage numbers, PERFECT, +AMMO...) is drawn this much larger in touch mode. */
export const TOUCH_WORLD_TEXT = 1.35;

/** Render order, low to high. */
export const DEPTH = {
  FLOOR: 0,
  DECAL: 1,
  GROUNDFX: 2,
  SHADOW: 3,
  PICKUP: 4,
  PROP: 5,
  ENEMY: 6,
  PLAYER: 7,
  PBULLET: 8,
  FX: 9,
  DARK: 10,
  EBULLET: 11,
  GLOW: 12,
  WTEXT: 13,
} as const;

export interface Theme {
  id: number;
  name: string;
  subtitle: string;
  floorA: string;
  floorB: string;
  grout: string;
  wallTop: string;
  wallEdge: string;
  wallDark: string;
  accent: string;
  dark: number;
  darkAlpha: number;
  lamp: number;
  bg: number;
}

export const THEMES: Theme[] = [
  {
    id: 0,
    name: 'THE CELLARS',
    subtitle: 'Where the debts are buried',
    floorA: '#75644f',
    floorB: '#6b5b48',
    grout: '#3f352b',
    wallTop: '#2c2520',
    wallEdge: '#5d4d3c',
    wallDark: '#191512',
    accent: '#a8703a',
    dark: 0x07060a,
    darkAlpha: 0.6,
    lamp: 0xffb060,
    bg: 0x0b0908,
  },
  {
    id: 1,
    name: 'THE FOUNDRY',
    subtitle: 'Iron remembers every hand that shaped it',
    floorA: '#555860',
    floorB: '#4c4f57',
    grout: '#2a2c31',
    wallTop: '#232429',
    wallEdge: '#7a4a30',
    wallDark: '#141418',
    accent: '#c2622d',
    dark: 0x08060a,
    darkAlpha: 0.64,
    lamp: 0xff8a45,
    bg: 0x09090b,
  },
  {
    id: 2,
    name: 'THE SANCTUM',
    subtitle: 'Judgement is patient',
    floorA: '#8b93a0',
    floorB: '#7a8290',
    grout: '#4a5160',
    wallTop: '#222a3a',
    wallEdge: '#a88c48',
    wallDark: '#131824',
    accent: '#c9a44c',
    dark: 0x05070d,
    darkAlpha: 0.6,
    lamp: 0xffe2a8,
    bg: 0x080a0f,
  },
];

export const COLORS = {
  cream: 0xf3e6c8,
  gold: 0xe2b23c,
  red: 0xd8452f,
  blood: 0x7a1d18,
  white: 0xffffff,
  ink: 0x14110f,
};
