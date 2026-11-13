import Phaser from 'phaser';
import { FONT, GH, GW, type Theme } from '../config';
import { audio } from '../core/audio';
import { clamp, lerp } from '../core/math';
import { loadSave, writeSave } from '../core/save';
import type { BossDef } from '../entities/boss';
import { PERFECT_END, PERFECT_START } from '../entities/player';
import type { UpgradeDef } from '../entities/upgrades';
import { DIRS, DV, type RoomNode } from '../world/floorgen';
import type { GameScene } from './GameScene';
import { CREAM, DIM, GOLD, RED, label, makeButton, makeStepper } from './widgets';

const HELP =
  'WASD  move      MOUSE  aim      LEFT CLICK  shoot      SPACE / RIGHT CLICK  dodge roll\n' +
  'R  reload (tap R again in the gold zone for a perfect reload)      Q  blast      E  interact      1-4 / WHEEL  switch gun';

export class UIScene extends Phaser.Scene {
  private g!: GameScene;
  private hearts: Phaser.GameObjects.Image[] = [];
  private armor: Phaser.GameObjects.Image[] = [];
  private blanks: Phaser.GameObjects.Image[] = [];
  private coinText!: Phaser.GameObjects.Text;
  private weaponIcon!: Phaser.GameObjects.Image;
  private weaponName!: Phaser.GameObjects.Text;
  private ammoText!: Phaser.GameObjects.Text;
  private reserveText!: Phaser.GameObjects.Text;
  private slotG!: Phaser.GameObjects.Graphics;
  private mapG!: Phaser.GameObjects.Graphics;
  private floorText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private comboSub!: Phaser.GameObjects.Text;
  private barG!: Phaser.GameObjects.Graphics;
  private bossName!: Phaser.GameObjects.Text;
  private promptBox!: Phaser.GameObjects.Container;
  private promptTitle!: Phaser.GameObjects.Text;
  private promptDesc!: Phaser.GameObjects.Text;
  private promptG!: Phaser.GameObjects.Graphics;
  private cross!: Phaser.GameObjects.Graphics;
  private hurt!: Phaser.GameObjects.Image;
  private help!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private upIcons: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Container | null = null;
  private pickOptions: { def: UpgradeDef; pick: () => void }[] = [];
  private hurtA = 0;
  private lowHp = false;
  private bossFrac = 1;
  private bossLag = 1;
  private bossShown = false;
  private lastCombo = 0;
  private lastHp = -1;
  private lastMaxHp = -1;
  private lastArmor = -1;
  private lastBlanks = -1;
  private lastWeapon = '';
  private lastUpgradeKey = '';
  private mapDirty = true;
  private crossKick = 0;
  private lastShots = 0;
  private hitT = 0;
  private killT = 0;
  private lastDealt = 0;
  private lastKills = 0;

  constructor() {
    super('UI');
    this.upIcons = null as unknown as Phaser.GameObjects.Container;
  }

  create(): void {
    this.g = this.scene.get('Game') as GameScene;
    const g = this.g;
    this.hearts = [];
    this.armor = [];
    this.blanks = [];
    this.overlay = null;
    this.pickOptions = [];
    this.hurtA = 0;
    this.lowHp = false;
    this.bossShown = false;
    this.lastHp = this.lastMaxHp = this.lastArmor = this.lastBlanks = -1;
    this.lastWeapon = '';
    this.lastUpgradeKey = '';
    this.mapDirty = true;
    this.lastCombo = 0;
    this.hitT = this.killT = 0;
    this.lastDealt = this.lastKills = this.lastShots = 0;

    this.add.image(GW / 2, GH / 2, 'vignette').setDisplaySize(GW, GH).setAlpha(0.6);
    this.hurt = this.add.image(GW / 2, GH / 2, 'hurt').setDisplaySize(GW, GH).setAlpha(0);

    // ---- top left: coins, score
    this.add.image(58, 152, 'ui_coin').setScale(0.85);
    this.coinText = this.add.text(84, 152, '0', { fontFamily: FONT, fontSize: '32px', fontStyle: '700', color: GOLD })
      .setOrigin(0, 0.5).setStroke('#17120f', 6);
    this.scoreText = this.add.text(40, 196, '', { fontFamily: FONT, fontSize: '20px', fontStyle: '500', color: DIM })
      .setOrigin(0, 0.5).setStroke('#17120f', 5).setLetterSpacing(2);
    this.upIcons = this.add.container(40, GH - 62);

    // ---- bottom right: weapon
    const wx = GW - 400;
    const wy = GH - 176;
    const panel = this.add.graphics();
    panel.fillStyle(0x14110f, 0.78).fillRoundedRect(wx, wy, 360, 136, 8);
    panel.lineStyle(2, 0x5a5046, 1).strokeRoundedRect(wx, wy, 360, 136, 8);
    this.weaponIcon = this.add.image(wx + 110, wy + 82, 'wi_pistol').setScale(0.82);
    this.weaponName = this.add.text(wx + 20, wy + 12, '', { fontFamily: FONT, fontSize: '22px', fontStyle: '500', color: DIM })
      .setLetterSpacing(3);
    this.ammoText = this.add.text(wx + 338, wy + 74, '', { fontFamily: FONT, fontSize: '60px', fontStyle: '700', color: CREAM })
      .setOrigin(1, 0.5);
    this.reserveText = this.add.text(wx + 338, wy + 26, '', { fontFamily: FONT, fontSize: '22px', fontStyle: '500', color: DIM })
      .setOrigin(1, 0.5);
    this.slotG = this.add.graphics();

    // ---- top right: minimap
    this.mapG = this.add.graphics();
    this.floorText = this.add.text(GW - 40, 0, '', { fontFamily: FONT, fontSize: '20px', fontStyle: '500', color: DIM })
      .setOrigin(1, 0).setLetterSpacing(3).setStroke('#17120f', 5);

    // ---- top centre: combo
    this.comboText = this.add.text(GW / 2, 70, '', { fontFamily: FONT, fontSize: '64px', fontStyle: '700', color: CREAM })
      .setOrigin(0.5).setStroke('#17120f', 8).setVisible(false);
    this.comboSub = this.add.text(GW / 2, 118, 'COMBO', { fontFamily: FONT, fontSize: '18px', fontStyle: '500', color: DIM })
      .setOrigin(0.5).setLetterSpacing(6).setStroke('#17120f', 5).setVisible(false);

    // ---- bars (boss, combo timer, reload)
    this.barG = this.add.graphics();
    this.bossName = this.add.text(GW / 2, GH - 118, '', { fontFamily: FONT, fontSize: '26px', fontStyle: '700', color: CREAM })
      .setOrigin(0.5).setLetterSpacing(8).setStroke('#17120f', 6).setVisible(false);

    // ---- interact prompt
    this.promptG = this.add.graphics();
    this.promptTitle = this.add.text(0, -22, '', { fontFamily: FONT, fontSize: '30px', fontStyle: '700', color: CREAM }).setOrigin(0.5);
    this.promptDesc = this.add.text(0, 18, '', { fontFamily: FONT, fontSize: '22px', fontStyle: '400', color: DIM }).setOrigin(0.5);
    this.promptBox = this.add.container(GW / 2, GH - 230, [this.promptG, this.promptTitle, this.promptDesc]).setVisible(false);

    this.help = this.add.text(GW / 2, GH - 96, HELP, {
      fontFamily: FONT, fontSize: '22px', fontStyle: '400', color: CREAM, align: 'center', lineSpacing: 10,
    }).setOrigin(0.5).setStroke('#17120f', 5).setAlpha(0).setLetterSpacing(1);

    this.cross = this.add.graphics().setDepth(1000);

    // ---- events from the game
    const ev = g.events;
    const on = (name: string, fn: (...a: never[]) => void) => {
      ev.on(name, fn, this);
      this.events.once('shutdown', () => ev.off(name, fn, this));
    };
    on('hurt', () => {
      this.hurtA = 1;
    });
    on('lowHp', (low: boolean) => {
      this.lowHp = low;
    });
    on('floor', (theme: Theme, depth: number) => this.banner(`FLOOR ${depth}`, theme.name, theme.subtitle));
    on('room', (node: RoomNode) => {
      this.mapDirty = true;
      const first = g.run.floorIndex === 0 && g.run.loop === 0 && node.type === 'start';
      this.tweens.add({ targets: this.help, alpha: first ? 0.92 : 0, duration: 300 });
    });
    on('cleared', () => {
      this.mapDirty = true;
      this.toast('ROOM CLEARED');
    });
    on('bossIntro', (def: BossDef) => {
      this.bossShown = true;
      this.bossLag = 1;
      this.bossName.setText(def.name).setVisible(true).setAlpha(0);
      this.tweens.add({ targets: this.bossName, alpha: 1, duration: 500, delay: 900 });
      this.banner('', def.name, def.title, true);
    });
    on('bossDead', () => {
      this.bossShown = false;
      this.bossName.setVisible(false);
      this.mapDirty = true;
    });
    on('upgrade', () => {
      this.lastUpgradeKey = '';
    });
    on('upgradeChoice', (opts: UpgradeDef[]) => this.showUpgradeChoice(opts));
    on('gameOver', (newBest: boolean) => this.showEnd(false, newBest));
    on('victory', () => this.showEnd(true, false));
    on('pause', (p: boolean) => this.setPaused(p));
    on('botPick', () => {
      if (this.pickOptions.length) this.pickOptions[0].pick();
    });

    // The game scene started before this one existed, so show the opening banner ourselves.
    this.banner(`FLOOR ${g.run.loop * 3 + g.run.floorIndex + 1}`, g.theme.name, g.theme.subtitle);
    const startNode = g.run.plan.rooms[g.run.roomId];
    if (g.run.floorIndex === 0 && g.run.loop === 0 && startNode.type === 'start') {
      this.tweens.add({ targets: this.help, alpha: 0.92, duration: 500, delay: 600 });
    }
  }

  // ------------------------------------------------------------ banners

  private banner(top: string, title: string, sub: string, boss = false): void {
    const y = boss ? 250 : 300;
    const topT = label(this, GW / 2, y - 78, top, 28, DIM, '500', 10).setStroke('#17120f', 6);
    const titleT = label(this, GW / 2, y, title, boss ? 110 : 96, boss ? '#ffd9c8' : CREAM, '700', 10).setStroke('#17120f', 10);
    const subT = label(this, GW / 2, y + 82, sub, 28, boss ? RED : GOLD, '400', 4).setStroke('#17120f', 6);
    const line = this.add.rectangle(GW / 2, y + 52, 520, 3, boss ? 0xd8452f : 0xe8c05a).setAlpha(0).setScale(0.02, 1);
    const all = [topT, titleT, subT];
    for (const t of all) t.setAlpha(0);
    titleT.setScale(1.12);
    this.tweens.add({ targets: all, alpha: 1, duration: 350, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: titleT, scale: 1, duration: 500, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: line, alpha: 1, scaleX: 1, duration: 500, ease: 'Cubic.easeOut' });
    this.tweens.add({
      targets: [...all, line], alpha: 0, duration: 500, delay: boss ? 1900 : 2300,
      onComplete: () => {
        for (const t of all) t.destroy();
        line.destroy();
      },
    });
  }

  private toast(text: string): void {
    const t = label(this, GW / 2, 190, text, 34, CREAM, '700', 8).setStroke('#17120f', 7).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: 180, duration: 200 });
    this.tweens.add({ targets: t, alpha: 0, duration: 400, delay: 1100, onComplete: () => t.destroy() });
  }

  // ------------------------------------------------------------ overlays

  private closeOverlay(): void {
    this.overlay?.destroy();
    this.overlay = null;
    this.pickOptions = [];
  }

  private dim(alpha = 0.72): Phaser.GameObjects.Rectangle {
    return this.add.rectangle(GW / 2, GH / 2, GW, GH, 0x070605, alpha).setInteractive();
  }

  private setPaused(p: boolean): void {
    const g = this.g;
    if (g.run.over || g.modal) return;
    g.paused = p;
    this.closeOverlay();
    if (!p) return;
    const save = loadSave();
    const items: Phaser.GameObjects.GameObject[] = [
      this.dim(),
      label(this, GW / 2, 250, 'PAUSED', 96, CREAM, '700', 14),
      makeButton(this, GW / 2, 400, 'RESUME', () => this.setPaused(false), { primary: true }).c,
      makeButton(this, GW / 2, 484, 'RESTART RUN', () => this.restart()).c,
      makeButton(this, GW / 2, 568, 'MAIN MENU', () => this.toMenu()).c,
      makeStepper(this, GW / 2 - 10, 670, 'SOUND', () => save.sfxVol, (v) => {
        save.sfxVol = v;
        writeSave({ sfxVol: v });
        audio.setSfxVol(v);
      }),
      makeStepper(this, GW / 2 - 10, 722, 'MUSIC', () => save.musicVol, (v) => {
        save.musicVol = v;
        writeSave({ musicVol: v });
        audio.setMusicVol(v);
      }),
      makeStepper(this, GW / 2 - 10, 774, 'SCREEN SHAKE', () => save.shake, (v) => {
        save.shake = v;
        writeSave({ shake: v });
        g.fx.setShakeScale(v);
      }),
      label(this, GW / 2, 880, HELP, 20, DIM, '400', 1).setAlign('center').setLineSpacing(8),
    ];
    this.overlay = this.add.container(0, 0, items).setDepth(500);
  }

  private restart(): void {
    this.closeOverlay();
    this.scene.stop('UI');
    this.g.scene.restart({});
  }

  private toMenu(): void {
    this.closeOverlay();
    audio.setIntensity(0);
    this.scene.stop('UI');
    this.scene.stop('Game');
    this.scene.start('Menu');
  }

  private showUpgradeChoice(opts: UpgradeDef[]): void {
    this.closeOverlay();
    const g = this.g;
    const items: Phaser.GameObjects.GameObject[] = [
      this.dim(0.78),
      label(this, GW / 2, 210, 'CHOOSE YOUR REWARD', 64, CREAM, '700', 10),
      label(this, GW / 2, 272, 'The dead have no use for it', 26, DIM, '400', 3),
    ];
    const cw = 380;
    const ch = 470;
    const gap = 50;
    const x0 = GW / 2 - ((opts.length - 1) * (cw + gap)) / 2;
    opts.forEach((def, i) => {
      const col = Phaser.Display.Color.HexStringToColor(def.color).color;
      const bg = this.add.graphics();
      const draw = (over: boolean) => {
        bg.clear();
        bg.fillStyle(over ? 0x2a2420 : 0x1a1614, 0.98).fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 10);
        bg.lineStyle(over ? 4 : 2, over ? col : 0x5a5046, 1).strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, 10);
        bg.fillStyle(col, over ? 1 : 0.7).fillRect(-cw / 2 + 24, -ch / 2 + 20, cw - 48, 4);
      };
      draw(false);
      const owned = g.run.upgrades[def.id] ?? 0;
      const icon = this.add.image(0, -96, `up_${def.id}`).setScale(1.9);
      const name = label(this, 0, 26, def.name.toUpperCase(), 34, CREAM, '700', 3);
      const desc = label(this, 0, 104, def.desc, 24, DIM, '400').setWordWrapWidth(cw - 70).setAlign('center').setLineSpacing(6);
      const own = label(this, 0, 196, owned > 0 ? `OWNED  x${owned}` : 'NEW', 18, owned > 0 ? DIM : def.color, '500', 4);
      const card = this.add.container(x0 + i * (cw + gap), 590, [bg, icon, name, desc, own]);
      card.setSize(cw, ch).setInteractive();
      card.setAlpha(0);
      card.y += 40;
      this.tweens.add({ targets: card, alpha: 1, y: 590, duration: 320, delay: 120 + i * 90, ease: 'Cubic.easeOut' });
      const pick = () => {
        if (!this.overlay) return;
        this.closeOverlay();
        g.chooseUpgrade(def);
      };
      card.on('pointerover', () => {
        draw(true);
        audio.play('hover');
        this.tweens.add({ targets: card, scale: 1.05, duration: 110 });
      });
      card.on('pointerout', () => {
        draw(false);
        this.tweens.add({ targets: card, scale: 1, duration: 110 });
      });
      card.on('pointerdown', pick);
      items.push(card);
      this.pickOptions.push({ def, pick });
    });
    this.overlay = this.add.container(0, 0, items).setDepth(500);
  }

  private showEnd(victory: boolean, newBest: boolean): void {
    this.closeOverlay();
    const g = this.g;
    const run = g.run;
    const save = loadSave();
    const mins = Math.floor(run.time / 60);
    const secs = Math.floor(run.time % 60);
    const depth = run.loop * 3 + run.floorIndex + 1;
    const items: Phaser.GameObjects.GameObject[] = [this.dim(victory ? 0.74 : 0.82)];
    const title = label(this, GW / 2, 190, victory ? 'JUDGEMENT SERVED' : 'YOU DIED', 120, victory ? GOLD : RED, '700', 14);
    title.setScale(1.3).setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 600, ease: 'Cubic.easeOut' });
    items.push(title);
    items.push(label(this, GW / 2, 284,
      victory ? 'The Magistrate has fallen. The depths remain.' : `Fell on floor ${depth}  ·  ${g.theme.name}`, 28, DIM, '400', 3));

    const stats: [string, string][] = [
      ['SCORE', run.score.toLocaleString()],
      ['KILLS', String(run.kills)],
      ['BEST COMBO', `x${run.bestCombo}`],
      ['ROOMS CLEARED', String(run.roomsCleared)],
      ['BOSSES SLAIN', String(run.bossesKilled)],
      ['PERFECT RELOADS', String(run.perfects)],
      ['TIME', `${mins}:${String(secs).padStart(2, '0')}`],
    ];
    const top = 372;
    stats.forEach(([k, v], i) => {
      const y = top + i * 50;
      const kt = label(this, GW / 2 - 260, y, k, 26, DIM, '500', 4).setOrigin(0, 0.5);
      const vt = label(this, GW / 2 + 260, y, v, i === 0 ? 40 : 30, i === 0 ? GOLD : CREAM, '700').setOrigin(1, 0.5);
      const ln = this.add.rectangle(GW / 2, y + 24, 520, 1, 0x4a4038);
      for (const o of [kt, vt, ln]) {
        o.setAlpha(0);
        this.tweens.add({ targets: o, alpha: 1, duration: 250, delay: 350 + i * 80 });
      }
      items.push(kt, vt, ln);
    });
    const bestLine = newBest ? 'NEW BEST SCORE' : `BEST  ${Math.max(save.bestScore, run.score).toLocaleString()}`;
    items.push(label(this, GW / 2, top + stats.length * 50 + 22, bestLine, 24, newBest ? GOLD : DIM, '700', 5));

    const by = 860;
    if (victory) {
      items.push(makeButton(this, GW / 2 - 210, by, 'DESCEND AGAIN', () => {
        this.closeOverlay();
        g.continueAfterVictory();
      }, { primary: true }).c);
      items.push(makeButton(this, GW / 2 + 210, by, 'MAIN MENU', () => this.toMenu()).c);
      items.push(label(this, GW / 2, by + 62, 'Descending again starts a harder loop with everything you carry', 20, DIM, '400', 1));
    } else {
      items.push(makeButton(this, GW / 2 - 210, by, 'TRY AGAIN', () => this.restart(), { primary: true }).c);
      items.push(makeButton(this, GW / 2 + 210, by, 'MAIN MENU', () => this.toMenu()).c);
    }
    this.overlay = this.add.container(0, 0, items).setDepth(500);
  }

  // ------------------------------------------------------------ frame

  update(time: number, delta: number): void {
    const g = this.g;
    if (!g.run || !g.player) return;
    const dt = delta / 1000;
    const p = g.player;
    const run = g.run;

    // ---- hearts / armor / blanks
    if (p.hp !== this.lastHp || p.maxHp !== this.lastMaxHp || p.armor !== this.lastArmor) {
      const containers = p.maxHp / 2;
      while (this.hearts.length < containers) this.hearts.push(this.add.image(0, 0, 'ui_heart'));
      this.hearts.forEach((h, i) => {
        h.setVisible(i < containers).setPosition(62 + i * 54, 60);
        const v = p.hp - i * 2;
        h.setTexture(v >= 2 ? 'ui_heart' : v === 1 ? 'ui_half' : 'ui_empty');
        if (this.lastHp >= 0 && p.hp < this.lastHp && v < 2 && v >= 0) {
          h.setScale(1.5);
          this.tweens.add({ targets: h, scale: 1, duration: 300, ease: 'Back.easeOut' });
        }
      });
      while (this.armor.length < p.armor) this.armor.push(this.add.image(0, 0, 'ui_armor'));
      this.armor.forEach((a, i) => a.setVisible(i < p.armor).setPosition(62 + containers * 54 + 8 + i * 46, 60));
      this.lastHp = p.hp;
      this.lastMaxHp = p.maxHp;
      this.lastArmor = p.armor;
    }
    if (p.blanks !== this.lastBlanks) {
      while (this.blanks.length < p.blanks) this.blanks.push(this.add.image(0, 0, 'ui_blank').setScale(0.8));
      this.blanks.forEach((b, i) => b.setVisible(i < p.blanks).setPosition(58 + i * 40, 108));
      this.lastBlanks = p.blanks;
    }
    this.coinText.setText(String(run.coins));
    this.scoreText.setText(`SCORE  ${run.score.toLocaleString()}`);

    // ---- weapon panel
    const w = p.weapon;
    if (w.def.id !== this.lastWeapon) {
      this.lastWeapon = w.def.id;
      this.weaponIcon.setTexture(`wi_${w.def.id}`);
      this.weaponName.setText(w.def.name.toUpperCase());
      this.weaponIcon.setScale(0.95);
      this.tweens.add({ targets: this.weaponIcon, scale: 0.82, duration: 180, ease: 'Back.easeOut' });
    }
    this.ammoText.setText(String(w.clip));
    this.ammoText.setColor(w.clip === 0 ? RED : w.clip <= Math.ceil(p.clipSize() * 0.25) ? '#e8a05a' : CREAM);
    this.reserveText.setText(w.reserve < 0 ? 'UNLIMITED' : `RESERVE  ${w.reserve}`);
    const wx = GW - 400;
    const wy = GH - 176;
    this.slotG.clear();
    p.weapons.forEach((_, i) => {
      const cur = i === p.cur;
      this.slotG.fillStyle(cur ? 0xf3e6c8 : 0x5a5046, 1).fillRoundedRect(wx + 20 + i * 34, wy + 118, 26, 6, 3);
    });

    // ---- upgrades strip
    const ukey = Object.entries(run.upgrades).map(([k, v]) => `${k}${v}`).join(',');
    if (ukey !== this.lastUpgradeKey) {
      this.lastUpgradeKey = ukey;
      this.upIcons.removeAll(true);
      Object.entries(run.upgrades).forEach(([id, n], i) => {
        const x = i * 48 + 20;
        this.upIcons.add(this.add.image(x, 0, `up_${id}`).setScale(0.58));
        if (n > 1) {
          this.upIcons.add(this.add.text(x + 10, 6, String(n), { fontFamily: FONT, fontSize: '18px', fontStyle: '700', color: CREAM })
            .setStroke('#17120f', 4));
        }
      });
    }

    // ---- minimap
    if (this.mapDirty) {
      this.mapDirty = false;
      this.drawMap();
    }

    // ---- combo
    const showCombo = run.combo >= 3;
    this.comboText.setVisible(showCombo);
    this.comboSub.setVisible(showCombo);
    if (showCombo) {
      this.comboText.setText(`x${run.combo}`);
      this.comboText.setColor(run.combo >= 20 ? RED : run.combo >= 10 ? GOLD : CREAM);
      if (run.combo !== this.lastCombo) {
        this.comboText.setScale(1.35);
        this.tweens.add({ targets: this.comboText, scale: 1, duration: 160, ease: 'Quad.easeOut' });
      }
    }
    this.lastCombo = run.combo;

    // ---- bars
    const bg = this.barG;
    bg.clear();
    if (showCombo) {
      const k = clamp(run.comboT / run.comboMax, 0, 1);
      bg.fillStyle(0x17120f, 0.8).fillRect(GW / 2 - 82, 136, 164, 8);
      bg.fillStyle(run.combo >= 10 ? 0xe8c05a : 0xf3e6c8, 1).fillRect(GW / 2 - 80, 138, 160 * k, 4);
    }
    const boss = g.bossEnemy;
    if (this.bossShown && boss) {
      this.bossFrac = clamp(boss.hp / boss.maxHp, 0, 1);
      this.bossLag = Math.max(this.bossFrac, this.bossLag - dt * 0.25);
      const bw = 900;
      const bx = GW / 2 - bw / 2;
      const by = GH - 92;
      const a = this.bossName.alpha;
      bg.fillStyle(0x17120f, 0.9 * a).fillRoundedRect(bx - 5, by - 5, bw + 10, 28, 5);
      bg.fillStyle(0x4a1a14, a).fillRect(bx, by, bw, 18);
      bg.fillStyle(0xf3e6c8, 0.9 * a).fillRect(bx, by, bw * this.bossLag, 18);
      bg.fillStyle(0xd8452f, a).fillRect(bx, by, bw * this.bossFrac, 18);
      bg.fillStyle(0xffffff, 0.16 * a).fillRect(bx, by, bw * this.bossFrac, 5);
      for (const m of [0.25, 0.5, 0.75]) bg.fillStyle(0x17120f, 0.45 * a).fillRect(bx + bw * m - 1, by, 2, 18);
    }

    // ---- interact prompt
    const target = g.interactTarget;
    if (target && !g.modal && !g.paused) {
      const info = g.pickups.info(target);
      const afford = info.price <= run.coins;
      this.promptTitle.setText(`[E]  ${info.action}   ·   ${info.title.toUpperCase()}${info.price ? `   ·   ${info.price} coin` : ''}`);
      this.promptTitle.setColor(info.price && !afford ? RED : CREAM);
      this.promptDesc.setText(info.desc);
      const pw = Math.max(this.promptTitle.width, this.promptDesc.width) + 70;
      this.promptG.clear();
      this.promptG.fillStyle(0x14110f, 0.88).fillRoundedRect(-pw / 2, -50, pw, 100, 8);
      this.promptG.lineStyle(2, 0x6b6055, 1).strokeRoundedRect(-pw / 2, -50, pw, 100, 8);
      this.promptBox.setVisible(true);
    } else {
      this.promptBox.setVisible(false);
    }

    // ---- damage vignette
    this.hurtA = Math.max(0, this.hurtA - dt * 1.6);
    const pulse = this.lowHp ? 0.3 + 0.16 * Math.sin(time * 0.007) : 0;
    this.hurt.setAlpha(Math.max(this.hurtA * 0.85, pulse));

    this.drawCrosshair(dt);
  }

  private drawMap(): void {
    const g = this.g;
    const plan = g.run.plan;
    const mg = this.mapG;
    mg.clear();
    const rooms = plan.rooms.filter((r) => r.seen);
    if (!rooms.length) return;
    const cw = 34;
    const ch = 24;
    const gap = 9;
    const all = plan.rooms;
    const minX = Math.min(...all.map((r) => r.gx));
    const maxX = Math.max(...all.map((r) => r.gx));
    const minY = Math.min(...all.map((r) => r.gy));
    const maxY = Math.max(...all.map((r) => r.gy));
    const mw = (maxX - minX + 1) * (cw + gap) - gap;
    const mh = (maxY - minY + 1) * (ch + gap) - gap;
    const ox = GW - 40 - mw;
    const oy = 40;
    mg.fillStyle(0x14110f, 0.6).fillRoundedRect(ox - 14, oy - 14, mw + 28, mh + 28, 8);
    const pos = (r: RoomNode) => ({ x: ox + (r.gx - minX) * (cw + gap), y: oy + (r.gy - minY) * (ch + gap) });
    // links
    for (const r of rooms) {
      if (!r.visited) continue;
      const a = pos(r);
      for (const d of DIRS) {
        if (r.doors[d] === undefined) continue;
        mg.fillStyle(0x8a7f70, 1);
        if (DV[d][0] !== 0) mg.fillRect(a.x + (DV[d][0] > 0 ? cw : -gap), a.y + ch / 2 - 2, gap, 4);
        else mg.fillRect(a.x + cw / 2 - 2, a.y + (DV[d][1] > 0 ? ch : -gap), 4, gap);
      }
    }
    for (const r of rooms) {
      const a = pos(r);
      const cur = r.id === g.run.roomId;
      let col = r.visited ? 0x8a7f70 : 0x3d3630;
      if (r.type === 'boss') col = r.visited ? 0xd8452f : 0x7a2a20;
      if (r.type === 'shop') col = r.visited ? 0xe8c05a : 0x7a6a30;
      if (r.type === 'treasure') col = r.visited ? 0x7fb0d8 : 0x3f5870;
      mg.fillStyle(col, 1).fillRoundedRect(a.x, a.y, cw, ch, 4);
      if (r.visited && !r.cleared) mg.fillStyle(0x17120f, 0.45).fillRoundedRect(a.x + 4, a.y + 4, cw - 8, ch - 8, 3);
      if (cur) mg.lineStyle(3, 0xffffff, 1).strokeRoundedRect(a.x - 2, a.y - 2, cw + 4, ch + 4, 5);
    }
    this.floorText.setY(oy + mh + 24);
    this.floorText.setText(`FLOOR ${g.run.loop * 3 + g.run.floorIndex + 1}  ·  ${g.theme.name}`);
  }

  private drawCrosshair(dt: number): void {
    const g = this.g;
    const p = g.player;
    const ptr = this.input.activePointer;
    const c = this.cross;
    const x = ptr.x;
    const y = ptr.y;
    c.clear();
    if (g.bot) return;
    if (g.paused || g.modal || p.dead) {
      // menus: a plain pointer
      c.fillStyle(0x17120f, 1).fillCircle(x, y, 9);
      c.fillStyle(0xf3e6c8, 1).fillCircle(x, y, 6);
      return;
    }
    if (g.run.shots !== this.lastShots) {
      this.lastShots = g.run.shots;
      this.crossKick = 1;
    }
    this.crossKick = lerp(this.crossKick, 0, 1 - Math.exp(-12 * dt));
    // hit marker: a quick X when a shot connects, red when it kills
    if (g.run.damageDealt !== this.lastDealt) {
      if (g.run.damageDealt > this.lastDealt) this.hitT = 0.12;
      this.lastDealt = g.run.damageDealt;
    }
    if (g.run.kills !== this.lastKills) {
      if (g.run.kills > this.lastKills) this.killT = 0.22;
      this.lastKills = g.run.kills;
    }
    this.hitT = Math.max(0, this.hitT - dt);
    this.killT = Math.max(0, this.killT - dt);
    const spread = p.weapon.def.spread * g.run.stats.spread;
    const r = 13 + spread * 0.7 + this.crossKick * 9;
    const len = 9;
    const tick = (col: number, wdt: number) => {
      c.lineStyle(wdt, col, 1);
      c.lineBetween(x - r - len, y, x - r, y);
      c.lineBetween(x + r, y, x + r + len, y);
      c.lineBetween(x, y - r - len, x, y - r);
      c.lineBetween(x, y + r, x, y + r + len);
    };
    tick(0x17120f, 6);
    tick(0xf3e6c8, 2.5);
    c.fillStyle(0x17120f, 1).fillCircle(x, y, 4);
    c.fillStyle(p.weapon.clip === 0 ? 0xd8452f : 0xf3e6c8, 1).fillCircle(x, y, 2.2);

    if (this.hitT > 0 || this.killT > 0) {
      const kill = this.killT > 0;
      const k = kill ? this.killT / 0.22 : this.hitT / 0.12;
      const d0 = 7 + (1 - k) * 4;
      const d1 = d0 + (kill ? 11 : 8);
      const mark = (col: number, wdt: number, alpha: number) => {
        c.lineStyle(wdt, col, alpha);
        for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          c.lineBetween(x + sx * d0, y + sy * d0, x + sx * d1, y + sy * d1);
        }
      };
      mark(0x17120f, 6, k);
      mark(kill ? 0xd8452f : 0xffffff, 3, k);
    }

    // reload ring with the perfect-reload window
    if (p.reloading) {
      const f = clamp(p.reloadT / p.reloadDur, 0, 1);
      const rr = 34;
      const a0 = -Math.PI / 2;
      c.lineStyle(8, 0x17120f, 0.85);
      c.beginPath();
      c.arc(x, y, rr, 0, Math.PI * 2);
      c.strokePath();
      if (!p.reloadTried) {
        // the window is fixed in seconds, so it shifts if the reload gets longer
        c.lineStyle(6, 0xe8c05a, 1);
        c.beginPath();
        c.arc(x, y, rr, a0 + PERFECT_START * Math.PI * 2, a0 + PERFECT_END * Math.PI * 2);
        c.strokePath();
      }
      c.lineStyle(3, 0xf3e6c8, 1);
      c.beginPath();
      c.arc(x, y, rr, a0, a0 + f * Math.PI * 2);
      c.strokePath();
      const ha = a0 + f * Math.PI * 2;
      c.fillStyle(0xffffff, 1).fillCircle(x + Math.cos(ha) * rr, y + Math.sin(ha) * rr, 5);
    }
  }
}
