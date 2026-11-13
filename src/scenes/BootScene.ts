import Phaser from 'phaser';
import { UPGRADES } from '../entities/upgrades';
import { buildTextures, buildUpgradeIcon } from '../gfx/textures';
import type { StartData } from './GameScene';

/** Draws every texture, then hands over to the menu (or straight into a run for automated tests). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    buildTextures(this);
    for (const u of UPGRADES) buildUpgradeIcon(this, `up_${u.id}`, u.glyph, u.color);

    const q = new URLSearchParams(window.location.search);
    if (q.has('bot') || q.has('play')) {
      const data: StartData = {
        bot: q.has('bot'),
        god: q.has('god'),
        speed: q.has('speed') ? Math.max(1, Math.min(12, Number(q.get('speed')))) : 1,
        seed: q.has('seed') ? Number(q.get('seed')) : undefined,
        floor: q.has('floor') ? Number(q.get('floor')) : undefined,
        room: q.get('room') ?? undefined,
        weapons: q.get('weapons')?.split(',') ?? undefined,
      };
      this.scene.start('Game', data);
    } else {
      this.scene.start('Menu');
    }
  }
}
