import type { Sfx } from '../core/audio';

export interface WeaponDef {
  id: string;
  name: string;
  desc: string;
  tier: number;
  price: number;
  dmg: number;
  /** Shots per second. */
  rate: number;
  pellets: number;
  /** Total cone in degrees. */
  spread: number;
  speed: number;
  clip: number;
  reload: number;
  /** Max reserve ammo; -1 = infinite. */
  reserve: number;
  /** Push applied to the player per shot. */
  kick: number;
  shake: number;
  knock: number;
  pierce: number;
  bounce: number;
  sfx: Sfx;
  bullet: string;
  bulletR: number;
  /** Muzzle distance from the player's centre. */
  muzzle: number;
  life: number;
  burst?: number;
  explodeR?: number;
  spinUp?: boolean;
  shell: 'shell' | 'shellRed' | null;
}

const W = (d: WeaponDef) => d;

export const WEAPONS: Record<string, WeaponDef> = {
  pistol: W({
    id: 'pistol', name: 'Sidearm', desc: 'Reliable. Never runs dry.', tier: 0, price: 0,
    dmg: 12, rate: 5.2, pellets: 1, spread: 4, speed: 1250, clip: 10, reload: 0.95, reserve: -1,
    kick: 40, shake: 0.14, knock: 90, pierce: 0, bounce: 0, sfx: 'pistol', bullet: 'pb', bulletR: 5, muzzle: 46, life: 1.1, shell: 'shell',
  }),
  revolver: W({
    id: 'revolver', name: 'Peacemaker', desc: 'Six heavy rounds that punch through.', tier: 1, price: 60,
    dmg: 36, rate: 2.7, pellets: 1, spread: 2, speed: 1500, clip: 6, reload: 1.25, reserve: 84,
    kick: 130, shake: 0.3, knock: 240, pierce: 1, bounce: 0, sfx: 'revolver', bullet: 'pbHeavy', bulletR: 6, muzzle: 54, life: 1.1, shell: null,
  }),
  smg: W({
    id: 'smg', name: 'Rattler', desc: 'Sprays fast and loose.', tier: 1, price: 60,
    dmg: 8, rate: 14, pellets: 1, spread: 11, speed: 1150, clip: 32, reload: 1.15, reserve: 384,
    kick: 26, shake: 0.1, knock: 50, pierce: 0, bounce: 0, sfx: 'smg', bullet: 'pb', bulletR: 4.5, muzzle: 56, life: 0.8, shell: 'shell',
  }),
  shotgun: W({
    id: 'shotgun', name: 'Pump Shotgun', desc: 'Close range. Big kick.', tier: 1, price: 70,
    dmg: 9, rate: 1.55, pellets: 7, spread: 24, speed: 1150, clip: 6, reload: 1.45, reserve: 66,
    kick: 330, shake: 0.42, knock: 150, pierce: 0, bounce: 0, sfx: 'shotgun', bullet: 'pbPellet', bulletR: 4.5, muzzle: 70, life: 0.42, shell: 'shellRed',
  }),
  burst: W({
    id: 'burst', name: 'Tri-Burst', desc: 'Three tight rounds per pull.', tier: 1, price: 70,
    dmg: 14, rate: 2.5, pellets: 1, spread: 2.5, speed: 1400, clip: 24, reload: 1.25, reserve: 264,
    kick: 46, shake: 0.14, knock: 90, pierce: 0, bounce: 0, sfx: 'rifle', bullet: 'pb', bulletR: 5, muzzle: 70, life: 1.0, burst: 3, shell: 'shell',
  }),
  rifle: W({
    id: 'rifle', name: 'Carbine', desc: 'Accurate automatic fire.', tier: 2, price: 90,
    dmg: 13, rate: 9, pellets: 1, spread: 4, speed: 1450, clip: 28, reload: 1.35, reserve: 336,
    kick: 40, shake: 0.14, knock: 80, pierce: 0, bounce: 0, sfx: 'rifle', bullet: 'pb', bulletR: 5, muzzle: 74, life: 1.0, shell: 'shell',
  }),
  twin: W({
    id: 'twin', name: 'Twin Barrel', desc: 'Two shells. Launches you backwards.', tier: 2, price: 90,
    dmg: 10, rate: 3.6, pellets: 10, spread: 30, speed: 1150, clip: 2, reload: 1.05, reserve: 48,
    kick: 520, shake: 0.55, knock: 200, pierce: 0, bounce: 0, sfx: 'twin', bullet: 'pbPellet', bulletR: 4.5, muzzle: 64, life: 0.38, shell: 'shellRed',
  }),
  nail: W({
    id: 'nail', name: 'Ricochet Rig', desc: 'Nails bounce off walls twice.', tier: 2, price: 90,
    dmg: 15, rate: 6.5, pellets: 1, spread: 5, speed: 1150, clip: 20, reload: 1.3, reserve: 220,
    kick: 34, shake: 0.12, knock: 70, pierce: 0, bounce: 2, sfx: 'nail', bullet: 'pbNail', bulletR: 4.5, muzzle: 56, life: 1.6, shell: null,
  }),
  sniper: W({
    id: 'sniper', name: 'Longshot', desc: 'One round, straight through everything.', tier: 3, price: 115,
    dmg: 95, rate: 1.15, pellets: 1, spread: 0, speed: 2400, clip: 4, reload: 1.7, reserve: 36,
    kick: 240, shake: 0.5, knock: 380, pierce: 6, bounce: 0, sfx: 'sniper', bullet: 'pbHeavy', bulletR: 6, muzzle: 92, life: 1.0, shell: 'shell',
  }),
  launcher: W({
    id: 'launcher', name: 'Thumper', desc: 'Explosive shells. Clears rooms.', tier: 3, price: 115,
    dmg: 55, rate: 1.25, pellets: 1, spread: 3, speed: 820, clip: 4, reload: 1.9, reserve: 28,
    kick: 200, shake: 0.3, knock: 300, pierce: 0, bounce: 0, sfx: 'launcher', bullet: 'pbGrenade', bulletR: 8, muzzle: 62, life: 1.3, explodeR: 125, shell: null,
  }),
  minigun: W({
    id: 'minigun', name: 'Buzzsaw', desc: 'Spins up into a wall of lead.', tier: 3, price: 125,
    dmg: 7.5, rate: 24, pellets: 1, spread: 12, speed: 1300, clip: 140, reload: 2.4, reserve: 560,
    kick: 30, shake: 0.12, knock: 45, pierce: 0, bounce: 0, sfx: 'minigun', bullet: 'pb', bulletR: 4.5, muzzle: 78, life: 0.85, spinUp: true, shell: 'shell',
  }),
};

export const WEAPON_IDS = Object.keys(WEAPONS);

export interface WeaponInst {
  def: WeaponDef;
  clip: number;
  reserve: number;
  /** Set by a perfect reload: the loaded magazine hits harder. */
  perfect: boolean;
}

export function makeWeapon(id: string): WeaponInst {
  const def = WEAPONS[id];
  return { def, clip: def.clip, reserve: def.reserve, perfect: false };
}
