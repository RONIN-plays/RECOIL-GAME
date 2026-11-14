import Phaser from 'phaser';
import { FONT, GH, GW, type Theme } from '../config';
import { audio } from '../core/audio';
import { isTouch, onTouchChange } from '../core/device';
import { clamp, lerp } from '../core/math';
import { loadSave, writeSave } from '../core/save';
import type { BossDef } from '../entities/boss';
import { PERFECT_END, PERFECT_START } from '../entities/player';
import type { UpgradeDef } from '../entities/upgrades';
import { DIRS, DV, type RoomNode } from '../world/floorgen';
import type { GameScene } from './GameScene';
import { TOUCH_LAYOUT, TouchControls } from './touchControls';
import { CREAM, DIM, GOLD, RED, label, makeButton, makeStepper } from './widgets';

const HELP =
  'WASD  move      MOUSE  aim      LEFT CLICK  shoot      SPACE / RIGHT CLICK  dodge roll\n' +
  'R  reload (tap R again in the gold zone for a perfect reload)      Q  blast      E  interact      1-4 / WHEEL  switch gun';
const TOUCH_HELP =
  'LEFT THUMB  move      RIGHT THUMB  aim, push further to shoot\n' +
  'ROLL  dodge      BLAST  clears bullets      Tap the gun panel to switch\n' +
  'Tap RELOAD again in the gold zone for a perfect reload';

/** Touch: seconds the start-room help stays up before fading (the pause menu repeats it). */
const TOUCH_HELP_SEC = 10;

/** Touch reticle: distance ahead of the player along the aim, in world px. */
const RETICLE_DIST = 150;

/** Where each HUD element sits. Desktop values are the original layout; touch values keep clear of the thumbs. */
interface HudLayout {
  heartX: number; heartY: number; heartStep: number; heartScale: number; armorStep: number; armorScale: number;
  blanksOn: boolean;
  coinX: number; coinY: number; coinScale: number; coinTextX: number; coinSize: number;
  scoreX: number; scoreY: number; scoreSize: number;
  upX: number; upY: number; upScale: number; upStep: number; upPerRow: number; upRow: number; upCountSize: number;
  wx: number; wy: number; ww: number; wh: number;
  wIconX: number; wIconY: number; wIconScale: number;
  nameX: number; nameY: number; nameSize: number;
  ammoX: number; ammoY: number; ammoSize: number;
  resX: number; resY: number; resSize: number;
  slotX: number; slotY: number; slotW: number; slotH: number; slotStep: number;
  mapRight: number; mapTop: number; mapK: number; floorSize: number;
  /** Fit the minimap panel to the rooms seen so far (touch) instead of the whole floor grid (desktop). */
  mapFit: boolean;
  /** Seconds the floor name stays up after entering a floor; 0 = always shown. */
  floorShowSec: number;
  /** Combo counter anchor: centred on comboX (desktop) or left-aligned at comboX (touch). */
  comboX: number; comboLeft: boolean;
  comboY: number; comboSize: number; comboSubDy: number; comboSubSize: number;
  comboBarDy: number; comboBarW: number; comboBarH: number;
  bossNameY: number; bossNameSize: number; bossBarY: number; bossBarW: number; bossBarH: number;
  promptY: number; promptTitleSize: number; promptTitleDy: number; promptDescSize: number; promptDescDy: number; promptH: number;
  helpY: number; helpSize: number;
  toastY: number; toastSize: number; bannerSmall: number;
}

const DESKTOP: HudLayout = {
  heartX: 62, heartY: 60, heartStep: 54, heartScale: 1, armorStep: 46, armorScale: 1,
  blanksOn: true,
  coinX: 58, coinY: 152, coinScale: 0.85, coinTextX: 84, coinSize: 32,
  scoreX: 40, scoreY: 196, scoreSize: 20,
  upX: 40, upY: GH - 62, upScale: 0.58, upStep: 48, upPerRow: 999, upRow: 0, upCountSize: 18,
  wx: GW - 400, wy: GH - 176, ww: 360, wh: 136,
  wIconX: 110, wIconY: 82, wIconScale: 0.82,
  nameX: 20, nameY: 12, nameSize: 22,
  ammoX: 338, ammoY: 74, ammoSize: 60,
  resX: 338, resY: 26, resSize: 22,
  slotX: 20, slotY: 118, slotW: 26, slotH: 6, slotStep: 34,
  mapRight: GW - 40, mapTop: 40, mapK: 1, floorSize: 20, mapFit: false, floorShowSec: 0,
  comboX: GW / 2, comboLeft: false,
  comboY: 70, comboSize: 64, comboSubDy: 48, comboSubSize: 18, comboBarDy: 66, comboBarW: 160, comboBarH: 4,
  bossNameY: GH - 118, bossNameSize: 26, bossBarY: GH - 92, bossBarW: 900, bossBarH: 18,
  promptY: GH - 230, promptTitleSize: 30, promptTitleDy: -22, promptDescSize: 22, promptDescDy: 18, promptH: 100,
  helpY: GH - 96, helpSize: 22,
  toastY: 190, toastSize: 34, bannerSmall: 28,
};

const TW = TOUCH_LAYOUT.weapon;
const TOUCH: HudLayout = {
  heartX: 74, heartY: 72, heartStep: 78, heartScale: 1.45, armorStep: 68, armorScale: 1.4,
  blanksOn: false, // the BLAST button shows the count
  coinX: 72, coinY: 168, coinScale: 1.35, coinTextX: 112, coinSize: 52,
  scoreX: 44, scoreY: 232, scoreSize: 40,
  upX: 56, upY: 310, upScale: 0.78, upStep: 62, upPerRow: 8, upRow: 64, upCountSize: 28,
  wx: TW.x, wy: TW.y, ww: TW.w, wh: TW.h,
  wIconX: 170, wIconY: 100, wIconScale: 1.4,
  nameX: 26, nameY: 10, nameSize: 40,
  ammoX: TW.w - 26, ammoY: 102, ammoSize: 88,
  resX: TW.w - 26, resY: 34, resSize: 40,
  slotX: 26, slotY: TW.h - 18, slotW: 40, slotH: 9, slotStep: 52,
  // the map panel stays left of the PAUSE button's hit area (GW - 190)
  mapRight: GW - 230, mapTop: 50, mapK: 1.35, floorSize: 30, mapFit: true, floorShowSec: 6,
  // a second column beside coins / score, clear of the boss bar and the fight
  comboX: 470, comboLeft: true,
  comboY: 166, comboSize: 80, comboSubDy: 64, comboSubSize: 30, comboBarDy: 88, comboBarW: 200, comboBarH: 8,
  bossNameY: 46, bossNameSize: 44, bossBarY: 86, bossBarW: 820, bossBarH: 26,
  promptY: 330, promptTitleSize: 44, promptTitleDy: -30, promptDescSize: 38, promptDescDy: 30, promptH: 150,
  helpY: GH - 320, helpSize: 40,
  toastY: 420, toastSize: 52, bannerSmall: 44,
};

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
  private touch = false;
  private L: HudLayout = DESKTOP;
  private panel!: Phaser.GameObjects.Graphics;
  private coinIcon!: Phaser.GameObjects.Image;
  /** Real time (ms) until which the floor name shows in touch mode. */
  private floorUntil = 0;
  private controls!: TouchControls;

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
    this.touch = isTouch();
    this.L = this.touch ? TOUCH : DESKTOP;

    this.add.image(GW / 2, GH / 2, 'vignette').setDisplaySize(GW, GH).setAlpha(0.6);
    this.hurt = this.add.image(GW / 2, GH / 2, 'hurt').setDisplaySize(GW, GH).setAlpha(0);

    // ---- top left: coins, score
    this.coinIcon = this.add.image(58, 152, 'ui_coin').setScale(0.85);
    this.coinText = this.add.text(84, 152, '0', { fontFamily: FONT, fontSize: '32px', fontStyle: '700', color: GOLD })
      .setOrigin(0, 0.5).setStroke('#17120f', 6);
    this.scoreText = this.add.text(40, 196, '', { fontFamily: FONT, fontSize: '20px', fontStyle: '500', color: DIM })
      .setOrigin(0, 0.5).setStroke('#17120f', 5).setLetterSpacing(2);
    this.upIcons = this.add.container(40, GH - 62);

    // ---- bottom right (bottom centre on touch): weapon. Positions are set in layout().
    this.panel = this.add.graphics();
    this.weaponIcon = this.add.image(0, 0, 'wi_pistol').setScale(0.82);
    this.weaponName = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '22px', fontStyle: '500', color: DIM })
      .setLetterSpacing(3);
    this.ammoText = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '60px', fontStyle: '700', color: CREAM })
      .setOrigin(1, 0.5);
    this.reserveText = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '22px', fontStyle: '500', color: DIM })
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

    // ---- touch: twin sticks and buttons (disabled and hidden on desktop)
    this.controls = new TouchControls(this, g, () => g.paused || g.modal || !!this.overlay || g.run.over);
    this.layout();
    const unsub = onTouchChange((t) => {
      this.touch = t;
      this.L = t ? TOUCH : DESKTOP;
      this.layout();
    });
    this.events.once('shutdown', unsub);

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
    on('floor', (theme: Theme, depth: number) => {
      this.floorUntil = this.time.now + this.L.floorShowSec * 1000;
      this.banner(`FLOOR ${depth}`, theme.name, theme.subtitle);
    });
    on('room', (node: RoomNode) => {
      this.mapDirty = true;
      const first = g.run.floorIndex === 0 && g.run.loop === 0 && node.type === 'start';
      if (this.touch) this.tweens.killTweensOf(this.help);
      this.tweens.add({ targets: this.help, alpha: first ? 0.92 : 0, duration: 300 });
      if (first) this.fadeTouchHelp();
    });
    on('cleared', () => {
      this.mapDirty = true;
      this.toast('ROOM CLEARED');
    });
    on('bossIntro', (def: BossDef) => this.onBossIntro(def));
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
    // With ?room=boss the boss is already up and its bossIntro event has been missed: pick it up here.
    this.floorUntil = this.time.now + this.L.floorShowSec * 1000;
    const boss = g.bossEnemy;
    if (boss && !boss.dead && boss.bossDef) this.onBossIntro(boss.bossDef);
    else this.banner(`FLOOR ${g.run.loop * 3 + g.run.floorIndex + 1}`, g.theme.name, g.theme.subtitle);
    const startNode = g.run.plan.rooms[g.run.roomId];
    if (g.run.floorIndex === 0 && g.run.loop === 0 && startNode.type === 'start') {
      this.tweens.add({ targets: this.help, alpha: 0.92, duration: 500, delay: 600 });
      this.fadeTouchHelp();
    }
  }

  /** The big touch help covers the lower middle of the room: let it go after a while (desktop keeps it). */
  private fadeTouchHelp(): void {
    if (!this.touch) return;
    this.tweens.add({ targets: this.help, alpha: 0, duration: 800, delay: TOUCH_HELP_SEC * 1000 });
  }

  // ------------------------------------------------------------ layout

  /** Place the HUD for the current input mode. Desktop values reproduce the original layout exactly. */
  private layout(): void {
    const L = this.L;
    this.coinIcon.setPosition(L.coinX, L.coinY).setScale(L.coinScale);
    this.coinText.setPosition(L.coinTextX, L.coinY).setFontSize(L.coinSize);
    this.scoreText.setPosition(L.scoreX, L.scoreY).setFontSize(L.scoreSize);
    this.upIcons.setPosition(L.upX, L.upY);

    const { wx, wy, ww, wh } = L;
    this.panel.clear();
    this.panel.fillStyle(0x14110f, 0.78).fillRoundedRect(wx, wy, ww, wh, 8);
    this.panel.lineStyle(2, 0x5a5046, 1).strokeRoundedRect(wx, wy, ww, wh, 8);
    this.weaponIcon.setPosition(wx + L.wIconX, wy + L.wIconY).setScale(L.wIconScale);
    this.weaponName.setPosition(wx + L.nameX, wy + L.nameY).setFontSize(L.nameSize);
    this.ammoText.setPosition(wx + L.ammoX, wy + L.ammoY).setFontSize(L.ammoSize);
    this.reserveText.setPosition(wx + L.resX, wy + L.resY).setFontSize(L.resSize);

    this.floorText.setX(L.mapRight + (L.mapFit ? 14 : 0)).setFontSize(L.floorSize);
    if (!L.floorShowSec) this.floorText.setAlpha(1);
    const comboOx = L.comboLeft ? 0 : 0.5;
    this.comboText.setPosition(L.comboX, L.comboY).setFontSize(L.comboSize).setOrigin(comboOx, 0.5);
    this.comboSub.setPosition(L.comboX, L.comboY + L.comboSubDy).setFontSize(L.comboSubSize).setOrigin(comboOx, 0.5);
    this.bossName.setY(L.bossNameY).setFontSize(L.bossNameSize);

    this.promptBox.setY(L.promptY);
    this.promptTitle.setY(L.promptTitleDy).setFontSize(L.promptTitleSize);
    this.promptDesc.setY(L.promptDescDy).setFontSize(L.promptDescSize);
    this.help.setY(L.helpY).setFontSize(L.helpSize).setText(this.touch ? TOUCH_HELP : HELP);

    // force the per-frame HUD code to redraw with the new layout
    this.lastHp = this.lastBlanks = -1;
    this.lastUpgradeKey = '';
    this.mapDirty = true;
    this.controls.setEnabled(this.touch);
  }

  // ------------------------------------------------------------ banners

  /** A boss fight began: show its name, health bar and title card. */
  private onBossIntro(def: BossDef): void {
    this.bossShown = true;
    this.bossLag = 1;
    this.bossName.setText(def.name).setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.bossName, alpha: 1, duration: 500, delay: 900 });
    this.banner('', def.name, def.title, true);
  }

  private banner(top: string, title: string, sub: string, boss = false): void {
    const y = boss ? 250 : 300;
    const small = this.L.bannerSmall;
    const topT = label(this, GW / 2, y - 78 - (small - 28) / 2, top, small, DIM, '500', 10).setStroke('#17120f', 6);
    const titleT = label(this, GW / 2, y, title, boss ? 110 : 96, boss ? '#ffd9c8' : CREAM, '700', 10).setStroke('#17120f', 10);
    const subT = label(this, GW / 2, y + 82 + (small - 28) / 2, sub, small, boss ? RED : GOLD, '400', 4).setStroke('#17120f', 6);
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
    const L = this.L;
    const t = label(this, GW / 2, L.toastY, text, L.toastSize, CREAM, '700', 8).setStroke('#17120f', 7).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: L.toastY - 10, duration: 200 });
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
    this.controls.releaseAll();
    if (!p) return;
    const save = loadSave();
    if (this.touch) {
      this.overlay = this.add.container(0, 0, this.touchPauseItems(save)).setDepth(500);
      return;
    }
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

  /** Pause menu for touch: big buttons in a row, big steppers, touch help. */
  private touchPauseItems(save: ReturnType<typeof loadSave>): Phaser.GameObjects.GameObject[] {
    const g = this.g;
    const bo = { w: 500, h: 150, size: 48 };
    return [
      this.dim(0.8),
      label(this, GW / 2, 110, 'PAUSED', 88, CREAM, '700', 14),
      makeButton(this, GW / 2 - 540, 285, 'RESUME', () => this.setPaused(false), { ...bo, primary: true }).c,
      makeButton(this, GW / 2, 285, 'RESTART RUN', () => this.restart(), bo).c,
      makeButton(this, GW / 2 + 540, 285, 'MAIN MENU', () => this.toMenu(), bo).c,
      makeStepper(this, GW / 2 - 40, 475, 'SOUND', () => save.sfxVol, (v) => {
        save.sfxVol = v;
        writeSave({ sfxVol: v });
        audio.setSfxVol(v);
      }, { touch: true }),
      makeStepper(this, GW / 2 - 40, 645, 'MUSIC', () => save.musicVol, (v) => {
        save.musicVol = v;
        writeSave({ musicVol: v });
        audio.setMusicVol(v);
      }, { touch: true }),
      makeStepper(this, GW / 2 - 40, 815, 'SCREEN SHAKE', () => save.shake, (v) => {
        save.shake = v;
        writeSave({ shake: v });
        g.fx.setShakeScale(v);
      }, { touch: true }),
      label(this, GW / 2, 985, TOUCH_HELP, 36, DIM, '400', 1).setAlign('center').setLineSpacing(8),
    ];
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
    this.controls.releaseAll();
    const g = this.g;
    const T = this.touch;
    const items: Phaser.GameObjects.GameObject[] = [
      this.dim(0.78),
      label(this, GW / 2, T ? 110 : 210, 'CHOOSE YOUR REWARD', T ? 76 : 64, CREAM, '700', 10),
      label(this, GW / 2, T ? 190 : 272, T ? 'Tap a card to take it' : 'The dead have no use for it', T ? 40 : 26, DIM, '400', 3),
    ];
    const cw = T ? 540 : 380;
    const ch = T ? 700 : 470;
    const gap = T ? 40 : 50;
    const cy = T ? 615 : 590;
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
      const icon = this.add.image(0, T ? -175 : -96, `up_${def.id}`).setScale(T ? 2.5 : 1.9);
      const name = label(this, 0, T ? -40 : 26, def.name.toUpperCase(), T ? 50 : 34, CREAM, '700', 3);
      const desc = label(this, 0, T ? 90 : 104, def.desc, T ? 40 : 24, T ? CREAM : DIM, '400')
        .setWordWrapWidth(cw - (T ? 60 : 70)).setAlign('center').setLineSpacing(6);
      const own = label(this, 0, T ? 285 : 196, owned > 0 ? `OWNED  x${owned}` : 'NEW', T ? 36 : 18, owned > 0 ? DIM : def.color, '500', 4);
      const card = this.add.container(x0 + i * (cw + gap), cy, [bg, icon, name, desc, own]);
      card.setSize(cw, ch).setInteractive();
      card.setAlpha(0);
      card.y += 40;
      this.tweens.add({ targets: card, alpha: 1, y: cy, duration: 320, delay: 120 + i * 90, ease: 'Cubic.easeOut' });
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
    this.controls.releaseAll();
    const g = this.g;
    const run = g.run;
    const save = loadSave();
    const T = this.touch;
    const mins = Math.floor(run.time / 60);
    const secs = Math.floor(run.time % 60);
    const depth = run.loop * 3 + run.floorIndex + 1;
    const items: Phaser.GameObjects.GameObject[] = [this.dim(victory ? 0.74 : 0.82)];
    const title = label(this, GW / 2, T ? 120 : 190, victory ? 'JUDGEMENT SERVED' : 'YOU DIED', T ? 110 : 120, victory ? GOLD : RED, '700', 14);
    title.setScale(1.3).setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 600, ease: 'Cubic.easeOut' });
    items.push(title);
    items.push(label(this, GW / 2, T ? 218 : 284,
      victory ? 'The Magistrate has fallen. The depths remain.' : `Fell on floor ${depth}  ·  ${g.theme.name}`, T ? 40 : 28, DIM, '400', 3));

    const stats: [string, string][] = [
      ['SCORE', run.score.toLocaleString()],
      ['KILLS', String(run.kills)],
      ['BEST COMBO', `x${run.bestCombo}`],
      ['ROOMS CLEARED', String(run.roomsCleared)],
      ['BOSSES SLAIN', String(run.bossesKilled)],
      ['PERFECT RELOADS', String(run.perfects)],
      ['TIME', `${mins}:${String(secs).padStart(2, '0')}`],
    ];
    const top = T ? 300 : 372;
    const row = T ? 62 : 50;
    const half = T ? 400 : 260;
    stats.forEach(([k, v], i) => {
      const y = top + i * row;
      const kt = label(this, GW / 2 - half, y, k, T ? 40 : 26, DIM, '500', 4).setOrigin(0, 0.5);
      const vSize = T ? (i === 0 ? 52 : 44) : i === 0 ? 40 : 30;
      const vt = label(this, GW / 2 + half, y, v, vSize, i === 0 ? GOLD : CREAM, '700').setOrigin(1, 0.5);
      const ln = this.add.rectangle(GW / 2, y + (T ? 30 : 24), half * 2, 1, 0x4a4038);
      for (const o of [kt, vt, ln]) {
        o.setAlpha(0);
        this.tweens.add({ targets: o, alpha: 1, duration: 250, delay: 350 + i * 80 });
      }
      items.push(kt, vt, ln);
    });
    const bestLine = newBest ? 'NEW BEST SCORE' : `BEST  ${Math.max(save.bestScore, run.score).toLocaleString()}`;
    items.push(label(this, GW / 2, top + stats.length * row + (T ? 14 : 22), bestLine, T ? 40 : 24, newBest ? GOLD : DIM, '700', 5));

    const by = T ? 955 : 860;
    const bdx = T ? 320 : 210;
    const bo = T ? { w: 580, h: 150, size: 50 } : {};
    if (victory) {
      items.push(makeButton(this, GW / 2 - bdx, by, 'DESCEND AGAIN', () => {
        this.closeOverlay();
        g.continueAfterVictory();
      }, { ...bo, primary: true }).c);
      items.push(makeButton(this, GW / 2 + bdx, by, 'MAIN MENU', () => this.toMenu(), bo).c);
      items.push(label(this, GW / 2, T ? 832 : by + 62, 'Descending again starts a harder loop with everything you carry', T ? 36 : 20, DIM, '400', 1));
    } else {
      items.push(makeButton(this, GW / 2 - bdx, by, 'TRY AGAIN', () => this.restart(), { ...bo, primary: true }).c);
      items.push(makeButton(this, GW / 2 + bdx, by, 'MAIN MENU', () => this.toMenu(), bo).c);
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
    const L = this.L;
    if (p.hp !== this.lastHp || p.maxHp !== this.lastMaxHp || p.armor !== this.lastArmor) {
      const containers = p.maxHp / 2;
      while (this.hearts.length < containers) this.hearts.push(this.add.image(0, 0, 'ui_heart').setScale(L.heartScale));
      this.hearts.forEach((h, i) => {
        h.setVisible(i < containers).setPosition(L.heartX + i * L.heartStep, L.heartY);
        const v = p.hp - i * 2;
        h.setTexture(v >= 2 ? 'ui_heart' : v === 1 ? 'ui_half' : 'ui_empty');
        if (this.lastHp >= 0 && p.hp < this.lastHp && v < 2 && v >= 0) {
          h.setScale(1.5 * L.heartScale);
          this.tweens.add({ targets: h, scale: L.heartScale, duration: 300, ease: 'Back.easeOut' });
        } else if (this.lastHp < 0) {
          h.setScale(L.heartScale); // layout changed
        }
      });
      while (this.armor.length < p.armor) this.armor.push(this.add.image(0, 0, 'ui_armor'));
      this.armor.forEach((a, i) => a.setVisible(i < p.armor).setScale(L.armorScale)
        .setPosition(L.heartX + containers * L.heartStep + 8 * L.heartScale + i * L.armorStep, L.heartY));
      this.lastHp = p.hp;
      this.lastMaxHp = p.maxHp;
      this.lastArmor = p.armor;
    }
    if (p.blanks !== this.lastBlanks) {
      while (this.blanks.length < p.blanks) this.blanks.push(this.add.image(0, 0, 'ui_blank').setScale(0.8));
      this.blanks.forEach((b, i) => b.setVisible(L.blanksOn && i < p.blanks).setPosition(58 + i * 40, 108));
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
      this.weaponIcon.setScale(L.wIconScale * (0.95 / 0.82));
      this.tweens.add({ targets: this.weaponIcon, scale: L.wIconScale, duration: 180, ease: 'Back.easeOut' });
    }
    this.ammoText.setText(String(w.clip));
    this.ammoText.setColor(w.clip === 0 ? RED : w.clip <= Math.ceil(p.clipSize() * 0.25) ? '#e8a05a' : CREAM);
    this.reserveText.setText(w.reserve < 0 ? 'UNLIMITED' : `RESERVE  ${w.reserve}`);
    this.slotG.clear();
    p.weapons.forEach((_, i) => {
      const cur = i === p.cur;
      this.slotG.fillStyle(cur ? 0xf3e6c8 : 0x5a5046, 1)
        .fillRoundedRect(L.wx + L.slotX + i * L.slotStep, L.wy + L.slotY, L.slotW, L.slotH, L.slotH / 2);
    });

    // ---- upgrades strip
    const ukey = Object.entries(run.upgrades).map(([k, v]) => `${k}${v}`).join(',');
    if (ukey !== this.lastUpgradeKey) {
      this.lastUpgradeKey = ukey;
      this.upIcons.removeAll(true);
      Object.entries(run.upgrades).forEach(([id, n], i) => {
        const x = (i % L.upPerRow) * L.upStep + 20;
        const y = Math.floor(i / L.upPerRow) * L.upRow;
        this.upIcons.add(this.add.image(x, y, `up_${id}`).setScale(L.upScale));
        if (n > 1) {
          const k = L.upCountSize / 18;
          this.upIcons.add(this.add.text(x + 10 * k, y + 6 * k, String(n), {
            fontFamily: FONT, fontSize: `${L.upCountSize}px`, fontStyle: '700', color: CREAM,
          }).setStroke('#17120f', 4));
        }
      });
    }

    // ---- minimap
    if (this.mapDirty) {
      this.mapDirty = false;
      this.drawMap();
    }
    if (L.floorShowSec) this.floorText.setAlpha(clamp((this.floorUntil - this.time.now) / 600, 0, 1));

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
      const cbw = L.comboBarW;
      const cbx = L.comboLeft ? L.comboX + 2 : L.comboX - cbw / 2;
      const cby = L.comboY + L.comboBarDy;
      bg.fillStyle(0x17120f, 0.8).fillRect(cbx - 2, cby, cbw + 4, L.comboBarH + 4);
      bg.fillStyle(run.combo >= 10 ? 0xe8c05a : 0xf3e6c8, 1).fillRect(cbx, cby + 2, cbw * k, L.comboBarH);
    }
    const boss = g.bossEnemy;
    if (this.bossShown && boss) {
      this.bossFrac = clamp(boss.hp / boss.maxHp, 0, 1);
      this.bossLag = Math.max(this.bossFrac, this.bossLag - dt * 0.25);
      const bw = L.bossBarW;
      const bh = L.bossBarH;
      const bx = GW / 2 - bw / 2;
      const by = L.bossBarY;
      const a = this.bossName.alpha;
      bg.fillStyle(0x17120f, 0.9 * a).fillRoundedRect(bx - 5, by - 5, bw + 10, bh + 10, 5);
      bg.fillStyle(0x4a1a14, a).fillRect(bx, by, bw, bh);
      bg.fillStyle(0xf3e6c8, 0.9 * a).fillRect(bx, by, bw * this.bossLag, bh);
      bg.fillStyle(0xd8452f, a).fillRect(bx, by, bw * this.bossFrac, bh);
      bg.fillStyle(0xffffff, 0.16 * a).fillRect(bx, by, bw * this.bossFrac, Math.round(bh * 0.28));
      for (const m of [0.25, 0.5, 0.75]) bg.fillStyle(0x17120f, 0.45 * a).fillRect(bx + bw * m - 1, by, 2, bh);
    }

    // ---- interact prompt
    const target = g.interactTarget;
    if (target && !g.modal && !g.paused) {
      const info = g.pickups.info(target);
      const afford = info.price <= run.coins;
      this.promptTitle.setText(`${this.touch ? '' : '[E]  '}${info.action}   ·   ${info.title.toUpperCase()}${info.price ? `   ·   ${info.price} coin` : ''}`);
      this.promptTitle.setColor(info.price && !afford ? RED : CREAM);
      this.promptDesc.setText(info.desc);
      const pw = Math.max(this.promptTitle.width, this.promptDesc.width) + 70;
      this.promptG.clear();
      const ph = L.promptH;
      this.promptG.fillStyle(0x14110f, 0.88).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
      this.promptG.lineStyle(2, 0x6b6055, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
      this.promptBox.setVisible(true);
    } else {
      this.promptBox.setVisible(false);
    }

    // ---- damage vignette
    this.hurtA = Math.max(0, this.hurtA - dt * 1.6);
    const pulse = this.lowHp ? 0.3 + 0.16 * Math.sin(time * 0.007) : 0;
    this.hurt.setAlpha(Math.max(this.hurtA * 0.85, pulse));

    // big touch help would show through the translucent menu backdrop
    // and it would hide the contextual INTERACT button's label
    if (this.touch) this.help.setVisible(!this.overlay && !g.interactTarget);
    this.controls.update(dt);
    this.drawCrosshair(dt);
  }

  private drawMap(): void {
    const g = this.g;
    const plan = g.run.plan;
    const mg = this.mapG;
    mg.clear();
    const rooms = plan.rooms.filter((r) => r.seen);
    if (!rooms.length) return;
    const K = this.L.mapK;
    const cw = Math.round(34 * K);
    const ch = Math.round(24 * K);
    const gap = Math.round(9 * K);
    const lw = K === 1 ? 4 : 6;
    // desktop reserves the whole floor grid; touch fits the panel to what has been seen
    const all = this.L.mapFit ? rooms : plan.rooms;
    const minX = Math.min(...all.map((r) => r.gx));
    const maxX = Math.max(...all.map((r) => r.gx));
    const minY = Math.min(...all.map((r) => r.gy));
    const maxY = Math.max(...all.map((r) => r.gy));
    const mw = (maxX - minX + 1) * (cw + gap) - gap;
    const mh = (maxY - minY + 1) * (ch + gap) - gap;
    const ox = this.L.mapRight - mw;
    const oy = this.L.mapTop;
    mg.fillStyle(0x14110f, 0.6).fillRoundedRect(ox - 14, oy - 14, mw + 28, mh + 28, 8);
    const pos = (r: RoomNode) => ({ x: ox + (r.gx - minX) * (cw + gap), y: oy + (r.gy - minY) * (ch + gap) });
    // links
    for (const r of rooms) {
      if (!r.visited) continue;
      const a = pos(r);
      for (const d of DIRS) {
        if (r.doors[d] === undefined) continue;
        mg.fillStyle(0x8a7f70, 1);
        if (DV[d][0] !== 0) mg.fillRect(a.x + (DV[d][0] > 0 ? cw : -gap), a.y + ch / 2 - lw / 2, gap, lw);
        else mg.fillRect(a.x + cw / 2 - lw / 2, a.y + (DV[d][1] > 0 ? ch : -gap), lw, gap);
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
    this.floorText.setY(oy + mh + (this.L.mapFit ? 24 : 24 * K));
    this.floorText.setText(`FLOOR ${g.run.loop * 3 + g.run.floorIndex + 1}  ·  ${g.theme.name}`);
  }

  private drawCrosshair(dt: number): void {
    const g = this.g;
    const p = g.player;
    const ptr = this.input.activePointer;
    const c = this.cross;
    let x = ptr.x;
    let y = ptr.y;
    c.clear();
    if (this.touch) {
      // no cursor on a touch screen: a small reticle ahead of the player, where the shots go
      if (g.paused || g.modal || p.dead || !g.room || this.overlay) return;
      const cam = g.cameras.main;
      x = (p.x + Math.cos(p.aim) * RETICLE_DIST - cam.worldView.x) * cam.zoom;
      y = (p.y + Math.sin(p.aim) * RETICLE_DIST - cam.worldView.y) * cam.zoom;
    } else if (g.bot) {
      return;
    } else if (g.paused || g.modal || p.dead) {
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
    const ts = this.touch ? 1.5 : 1;
    const r = (13 + spread * 0.7 + this.crossKick * 9) * ts;
    const len = 9 * ts;
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
      const d0 = (7 + (1 - k) * 4) * ts;
      const d1 = d0 + (kill ? 11 : 8) * ts;
      const mark = (col: number, wdt: number, alpha: number) => {
        c.lineStyle(wdt, col, alpha);
        for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          c.lineBetween(x + sx * d0, y + sy * d0, x + sx * d1, y + sy * d1);
        }
      };
      mark(0x17120f, 6, k);
      mark(kill ? 0xd8452f : 0xffffff, 3, k);
    }

    // reload ring with the perfect-reload window (on touch it wraps the RELOAD button instead)
    if (p.reloading && !this.touch) {
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
