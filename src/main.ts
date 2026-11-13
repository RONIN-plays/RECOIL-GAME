import '@fontsource/oswald/latin-400.css';
import '@fontsource/oswald/latin-500.css';
import '@fontsource/oswald/latin-700.css';
import Phaser from 'phaser';
import { GH, GW } from './config';
import { audio } from './core/audio';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { UIScene } from './scenes/UIScene';

async function boot(): Promise<void> {
  // Canvas text needs the web font to be ready before the first Text object is drawn.
  try {
    await Promise.all([
      document.fonts.load('400 32px Oswald'),
      document.fonts.load('500 32px Oswald'),
      document.fonts.load('700 32px Oswald'),
    ]);
  } catch {
    // fall back to system fonts
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GW,
    height: GH,
    backgroundColor: '#08070a',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, powerPreference: 'high-performance' },
    disableContextMenu: true,
    scene: [BootScene, MenuScene, GameScene, UIScene],
  });

  // Browsers only allow audio after a user gesture.
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

void boot();
