export interface Stats {
  dmg: number;
  fireRate: number;
  reload: number;
  clip: number;
  speed: number;
  rollCd: number;
  rollDist: number;
  pierce: number;
  bounce: number;
  crit: number;
  explode: number;
  spread: number;
  kick: number;
  bulletSpeed: number;
  magnet: number;
  coin: number;
  /** Kills per half-heart healed; 0 = off. */
  vamp: number;
  lastRound: boolean;
  rollReload: number;
  adrenaline: boolean;
  comboKing: boolean;
  shrapnel: number;
  armorPerFloor: number;
  blanksPerFloor: number;
  ammoDrop: number;
  hearts: number;
}

export function baseStats(): Stats {
  return {
    dmg: 1, fireRate: 1, reload: 1, clip: 1, speed: 1, rollCd: 1, rollDist: 1, pierce: 0, bounce: 0, crit: 0.04,
    explode: 0, spread: 1, kick: 1, bulletSpeed: 1, magnet: 1, coin: 1, vamp: 0, lastRound: false, rollReload: 0,
    adrenaline: false, comboKing: false, shrapnel: 0, armorPerFloor: 0, blanksPerFloor: 2, ammoDrop: 1, hearts: 3,
  };
}

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  glyph: string;
  color: string;
  max: number;
  apply: (s: Stats, n: number) => void;
}

const OFF = '#e07a4a'; // offence
const DEF = '#7fb0d8'; // defence
const UTIL = '#d9b84a'; // utility
const TRICK = '#a9d07a'; // special rounds

export const UPGRADES: UpgradeDef[] = [
  { id: 'hollow', name: 'Hollow Points', desc: '+20% damage', glyph: 'bullet', color: OFF, max: 5, apply: (s, n) => { s.dmg *= 1 + 0.2 * n; } },
  { id: 'trigger', name: 'Hair Trigger', desc: '+16% fire rate', glyph: 'bolt', color: OFF, max: 5, apply: (s, n) => { s.fireRate *= 1 + 0.16 * n; } },
  { id: 'loader', name: 'Speed Loader', desc: 'Reload 25% faster', glyph: 'reload', color: UTIL, max: 3, apply: (s, n) => { s.reload *= 1 + 0.25 * n; } },
  { id: 'mags', name: 'Long Mags', desc: '+30% magazine size', glyph: 'mag', color: UTIL, max: 3, apply: (s, n) => { s.clip *= 1 + 0.3 * n; } },
  { id: 'boots', name: 'Light Boots', desc: '+9% move speed', glyph: 'boot', color: DEF, max: 3, apply: (s, n) => { s.speed *= 1 + 0.09 * n; } },
  { id: 'tumbler', name: 'Tumbler', desc: 'Roll recovers 40% faster and travels further', glyph: 'roll', color: DEF, max: 2, apply: (s, n) => { s.rollCd *= Math.pow(0.6, n); s.rollDist *= 1 + 0.12 * n; } },
  { id: 'heart', name: 'Iron Heart', desc: '+1 heart container, fully healed', glyph: 'heart', color: DEF, max: 4, apply: (s, n) => { s.hearts += n; } },
  { id: 'ricochet', name: 'Ricochet Rounds', desc: 'Bullets bounce off walls once more', glyph: 'bounce', color: TRICK, max: 2, apply: (s, n) => { s.bounce += n; } },
  { id: 'pierce', name: 'Piercing Rounds', desc: 'Bullets pass through one more enemy', glyph: 'pierce', color: TRICK, max: 3, apply: (s, n) => { s.pierce += n; } },
  { id: 'deadeye', name: 'Deadeye', desc: '+14% critical hit chance (double damage)', glyph: 'eye', color: OFF, max: 4, apply: (s, n) => { s.crit += 0.14 * n; } },
  { id: 'powder', name: 'Powder Keg', desc: '12% of hits explode', glyph: 'bomb', color: TRICK, max: 3, apply: (s, n) => { s.explode += 0.12 * n; } },
  { id: 'vamp', name: 'Blood Debt', desc: 'Heal half a heart every 22 kills', glyph: 'fang', color: DEF, max: 2, apply: (s, n) => { s.vamp = n >= 2 ? 14 : 22; } },
  { id: 'magnet', name: 'Lodestone', desc: 'Coins fly to you. +25% coins', glyph: 'magnet', color: UTIL, max: 2, apply: (s, n) => { s.magnet *= 1 + 1.6 * n; s.coin *= 1 + 0.25 * n; } },
  { id: 'reserve', name: 'Blast Reserve', desc: '+1 Blast now and on every floor', glyph: 'blast', color: DEF, max: 3, apply: (s, n) => { s.blanksPerFloor += n; } },
  { id: 'rollload', name: 'Rolling Reload', desc: 'Rolling loads 35% of your magazine', glyph: 'mag', color: UTIL, max: 2, apply: (s, n) => { s.rollReload += 0.35 * n; } },
  { id: 'adrenaline', name: 'Adrenaline', desc: 'After being hit: 4s of +60% fire rate', glyph: 'flame', color: OFF, max: 1, apply: (s) => { s.adrenaline = true; } },
  { id: 'lastround', name: 'Last Round', desc: 'The final bullet in a magazine deals triple damage', glyph: 'skull', color: OFF, max: 1, apply: (s) => { s.lastRound = true; } },
  { id: 'steady', name: 'Steady Hands', desc: '-40% spread and recoil, +20% bullet speed', glyph: 'hand', color: UTIL, max: 2, apply: (s, n) => { s.spread *= Math.pow(0.6, n); s.kick *= Math.pow(0.6, n); s.bulletSpeed *= 1 + 0.2 * n; } },
  { id: 'scavenger', name: 'Scavenger', desc: 'Enemies drop ammo twice as often', glyph: 'crate', color: UTIL, max: 1, apply: (s) => { s.ammoDrop *= 2; } },
  { id: 'comboking', name: 'Hot Streak', desc: 'Combos last longer. At x10: +25% damage', glyph: 'star', color: OFF, max: 1, apply: (s) => { s.comboKing = true; } },
  { id: 'shrapnel', name: 'Chain Reaction', desc: '30% of kills burst into shrapnel', glyph: 'shards', color: TRICK, max: 3, apply: (s, n) => { s.shrapnel += 0.3 * n; } },
  { id: 'coat', name: 'Thick Coat', desc: '+1 armor now and on every floor', glyph: 'shield', color: DEF, max: 2, apply: (s, n) => { s.armorPerFloor += n; } },
];

export const UPGRADE_MAP: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export function computeStats(owned: Record<string, number>): Stats {
  const s = baseStats();
  for (const u of UPGRADES) {
    const n = owned[u.id] ?? 0;
    if (n > 0) u.apply(s, n);
  }
  return s;
}

/** Pick `count` distinct upgrades the player can still take. */
export function rollUpgrades(owned: Record<string, number>, count: number, rand: () => number, exclude: string[] = []): UpgradeDef[] {
  const pool = UPGRADES.filter((u) => (owned[u.id] ?? 0) < u.max && !exclude.includes(u.id));
  const out: UpgradeDef[] = [];
  while (out.length < count && pool.length) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return out;
}
