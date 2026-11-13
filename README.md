# RECOIL

A top-down action roguelike: dodge-roll through bullet patterns, clear procedurally generated rooms, beat three bosses.

Built with Phaser 3, TypeScript and Vite. Every sprite, sound and music track is generated in code at runtime, so there are no asset files.

## Run it

```
npm install
npm run dev
```

Then open http://localhost:5173. `npm run build` produces a static site in `dist/` that can be hosted anywhere (Vercel, itch.io, GitHub Pages).

## Controls

| Input | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Aim |
| Left click | Shoot (hold to keep firing) |
| Space / Shift / Right click | Dodge roll (you cannot be hit while rolling) |
| R | Reload. Tap R again in the gold zone for a perfect reload (+25% damage for that magazine) |
| Q / F | Blast: wipes every enemy bullet and shoves enemies back |
| E | Interact: chests, shop, pickups, stairs |
| 1-4 / Mouse wheel | Switch weapon |
| Esc / P | Pause |

## The game

- **Three floors** (Cellars, Foundry, Sanctum), each a random map of combat rooms plus one treasure room, one shop and a boss.
- **Combat rooms** lock when you enter and send two or three waves. Spawn markers appear before enemies do.
- **9 enemy types**, each with a telegraphed attack: riflemen, shotgunners, swarmers, chargers, snipers, grenadiers, turrets, shielded heavies and bouncing drones. Elites appear from floor 2.
- **3 bosses** with scripted attack patterns that get harder as their health drops.
- **11 weapons** and **22 stackable upgrades**. Treasure rooms give a weapon and a choice of two upgrades, bosses give a choice of three, shops sell both.
- **Recoil** pushes you backwards when you fire; heavy guns can be used to move.
- **Combo**: quick kills build a multiplier for score and coin drops.
- After the final boss you can descend again into a harder loop with everything you carry.

## Project layout

```
src/
  main.ts              boot, font loading, Phaser config
  config.ts            sizes, render depths, floor themes
  core/                math, seeded RNG, save data, synthesized audio, test bot
  gfx/                 procedural textures, particles, lighting, screen shake
  world/               floor layout, room layout, enemy waves, live room (collision, pathing, baked art)
  entities/            player, weapons, upgrades, bullets, enemies, bosses, pickups
  scenes/              Boot, Menu, Game (the run), UI (HUD and overlays)
tools/                 automated tests (see below)
```

Balance numbers live in three data files: `entities/weapons.ts`, `entities/enemyDefs.ts` and `entities/upgrades.ts`. Boss patterns are generator scripts at the bottom of `entities/boss.ts`.

## Testing

The dev server must be running for the browser tests. They use your installed Chrome through `playwright-core`.

| Command | What it checks |
| --- | --- |
| `npm run typecheck` | TypeScript |
| `npm run test:gen` | 21,000+ generated rooms: every floor has all room types, doors line up, every room is fully walkable |
| `node tools/inputtest.mjs` | Real mouse and keyboard events: menu, move, aim, shoot, roll, reload, perfect reload, blast, pause, weapon switch, doors, restart, death and retry |
| `node tools/playtest.mjs <seed> <speed> <god 1/0>` | A bot plays a whole run and the script fails on any console error or stall |
| `node tools/shot.mjs "<query>" <name> <waitMs>` | Screenshot of any state into `tools/shots/` |

Useful URL parameters for debugging: `?play=1` skips the menu, `&bot=1` lets the bot play, `&god=1` disables damage, `&speed=4` runs the simulation faster, `&seed=7` fixes the run, `&floor=2` starts on a later floor, `&room=boss` (or `shop`, `treasure`) starts in that room, `&weapons=shotgun,sniper` adds guns.
