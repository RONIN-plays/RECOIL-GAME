import Phaser from 'phaser';
import { GH, GW, THEMES } from '../config';
import { audio } from '../core/audio';
import { loadSave, writeSave } from '../core/save';
import type { RoomNode } from '../world/floorgen';
import { Room } from '../world/room';
import { generateRoom } from '../world/roomgen';
import { CREAM, DIM, GOLD, label, makeButton, makeStepper } from './widgets';

interface Mote {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  phase: number;
}

export class MenuScene extends Phaser.Scene {
  private room: Room | null = null;
  private motes: Mote[] = [];
  private cursor!: Phaser.GameObjects.Graphics;
  private panel: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.motes = [];
    this.panel = null;
    this.cameras.main.setBackgroundColor(0x0b0908);
    this.input.setDefaultCursor('none');

    // A real generated room as the backdrop
    const node: RoomNode = {
      id: 0, gx: 0, gy: 0, type: 'combat', doors: {}, depth: 0, cleared: true, visited: true, seen: true,
      seed: Math.floor(Math.random() * 1e9),
    };
    node.layout = generateRoom(node, 0, [30, 17]);
    this.room = new Room(this, node, THEMES[0], 0);
    for (const l of this.room.lamps) l.glow.setAlpha(0.3).setScale(2.2).setDepth(3);
    this.add.rectangle(GW / 2, GH / 2, GW, GH, 0x070605, 0.62).setDepth(2);
    this.add.image(GW / 2, GH / 2, 'vignette').setDisplaySize(GW, GH).setDepth(4);
    // a pool of warm light behind the title
    this.add.image(GW / 2, 330, 'light').setScale(7, 3.2).setTint(0xff9a50).setAlpha(0.2).setBlendMode(Phaser.BlendModes.ADD).setDepth(4);

    for (let i = 0; i < 46; i++) {
      const img = this.add.image(Math.random() * GW, Math.random() * GH, 'soft').setDepth(5)
        .setScale(0.04 + Math.random() * 0.1).setAlpha(0.1 + Math.random() * 0.25).setTint(0xffd9a0).setBlendMode(Phaser.BlendModes.ADD);
      this.motes.push({ img, vx: -8 + Math.random() * 16, vy: -14 - Math.random() * 18, phase: Math.random() * 10 });
    }

    // ---- title
    const title = label(this, GW / 2, 300, 'RECOIL', 300, CREAM, '700', 34).setDepth(10);
    title.setShadow(0, 10, '#000000', 24, false, true);
    const bar = this.add.rectangle(GW / 2, 446, 760, 5, 0xd8452f).setDepth(10).setScale(0, 1);
    const sub = label(this, GW / 2, 488, 'DODGE.  SHOOT.  DESCEND.', 32, DIM, '500', 14).setDepth(10);
    title.setAlpha(0).setScale(1.08);
    sub.setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 900, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: bar, scaleX: 1, duration: 700, delay: 350, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: sub, alpha: 1, duration: 600, delay: 700 });

    // ---- buttons
    const save = loadSave();
    const start = makeButton(this, GW / 2, 640, 'START RUN', () => this.startRun(), { primary: true, w: 440, h: 78, size: 36 });
    const how = makeButton(this, GW / 2, 738, 'HOW TO PLAY', () => this.showHelp(), { w: 440 });
    const opts = makeButton(this, GW / 2, 822, 'OPTIONS', () => this.showOptions(), { w: 440 });
    [start.c, how.c, opts.c].forEach((c, i) => {
      c.setDepth(10).setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, duration: 400, delay: 900 + i * 120 });
    });

    const best = save.bestScore > 0
      ? `BEST SCORE  ${save.bestScore.toLocaleString()}     ·     DEEPEST FLOOR  ${save.bestFloor}     ·     VICTORIES  ${save.wins}`
      : 'Three floors. Three bosses. One life.';
    label(this, GW / 2, 940, best, 22, save.bestScore > 0 ? GOLD : DIM, '500', 4).setDepth(10);
    label(this, GW / 2, GH - 36, 'Press ENTER to start', 18, DIM, '400', 4).setDepth(10).setAlpha(0.7);

    this.cursor = this.add.graphics().setDepth(1000);

    const kb = this.input.keyboard!;
    kb.on('keydown-ENTER', () => {
      if (!this.panel) this.startRun();
    });
    kb.on('keydown-ESC', () => this.closePanel());
    this.input.once('pointerdown', () => audio.unlock());
    this.events.once('shutdown', () => {
      kb.off('keydown-ENTER');
      kb.off('keydown-ESC');
      this.room?.destroy();
      this.room = null;
    });
    audio.setIntensity(0);
    audio.startMusic();
  }

  private startRun(): void {
    audio.unlock();
    audio.play('click');
    const cam = this.cameras.main;
    cam.fadeOut(260, 5, 4, 5);
    cam.once('camerafadeoutcomplete', () => this.scene.start('Game', {}));
  }

  private closePanel(): void {
    this.panel?.destroy();
    this.panel = null;
  }

  private openPanel(title: string, h: number, build: (items: Phaser.GameObjects.GameObject[], top: number) => void): void {
    this.closePanel();
    const w = 1080;
    const top = GH / 2 - h / 2;
    const dim = this.add.rectangle(GW / 2, GH / 2, GW, GH, 0x070605, 0.8).setInteractive();
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1614, 0.98).fillRoundedRect(GW / 2 - w / 2, top, w, h, 12);
    bg.lineStyle(2, 0x6b6055, 1).strokeRoundedRect(GW / 2 - w / 2, top, w, h, 12);
    const items: Phaser.GameObjects.GameObject[] = [dim, bg, label(this, GW / 2, top + 70, title, 56, CREAM, '700', 10)];
    build(items, top);
    items.push(makeButton(this, GW / 2, top + h - 70, 'BACK', () => this.closePanel(), { w: 300 }).c);
    this.panel = this.add.container(0, 0, items).setDepth(100);
  }

  private showHelp(): void {
    const rows: [string, string][] = [
      ['W A S D', 'Move'],
      ['MOUSE', 'Aim'],
      ['LEFT CLICK', 'Shoot (hold to keep firing)'],
      ['SPACE  /  RIGHT CLICK', 'Dodge roll: you cannot be hit while rolling'],
      ['R', 'Reload. Tap again in the gold zone for a perfect reload'],
      ['Q', 'Blast: wipes every enemy bullet on screen'],
      ['E', 'Interact: open chests, buy, pick up, descend'],
      ['1 - 4  /  WHEEL', 'Switch weapon'],
      ['ESC', 'Pause'],
    ];
    this.openPanel('HOW TO PLAY', 800, (items, top) => {
      rows.forEach(([k, v], i) => {
        const y = top + 160 + i * 52;
        items.push(label(this, GW / 2 - 470, y, k, 24, GOLD, '700', 3).setOrigin(0, 0.5));
        items.push(label(this, GW / 2 - 130, y, v, 24, CREAM, '400').setOrigin(0, 0.5));
      });
      items.push(label(this, GW / 2, top + 650,
        'Clear every room, find the boss, take the stairs. Kill quickly to build a combo for more coin.', 22, DIM, '400', 1));
    });
  }

  private showOptions(): void {
    const save = loadSave();
    this.openPanel('OPTIONS', 520, (items, top) => {
      items.push(makeStepper(this, GW / 2 - 10, top + 180, 'SOUND', () => save.sfxVol, (v) => {
        save.sfxVol = v;
        writeSave({ sfxVol: v });
        audio.setSfxVol(v);
      }));
      items.push(makeStepper(this, GW / 2 - 10, top + 250, 'MUSIC', () => save.musicVol, (v) => {
        save.musicVol = v;
        writeSave({ musicVol: v });
        audio.setMusicVol(v);
      }));
      items.push(makeStepper(this, GW / 2 - 10, top + 320, 'SCREEN SHAKE', () => save.shake, (v) => {
        save.shake = v;
        writeSave({ shake: v });
      }));
    });
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000;
    for (const m of this.motes) {
      m.img.x += (m.vx + Math.sin(time * 0.001 + m.phase) * 10) * dt;
      m.img.y += m.vy * dt;
      if (m.img.y < -20) {
        m.img.y = GH + 20;
        m.img.x = Math.random() * GW;
      }
    }
    this.room?.update(dt, time);
    if (this.room) for (const l of this.room.lamps) l.glow.setAlpha(l.glow.alpha * 1.5);
    const p = this.input.activePointer;
    this.cursor.clear();
    this.cursor.fillStyle(0x17120f, 1).fillCircle(p.x, p.y, 9);
    this.cursor.fillStyle(0xf3e6c8, 1).fillCircle(p.x, p.y, 6);
  }
}
