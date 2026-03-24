# CLAUDE.md — Soratchi (Sky Farm)

## Overview
Top-down 2D pixel farming idle game built with **Pyxel** (Python fantasy console). Stardew Valley / Animal Crossing-inspired aesthetic on a floating grass island. 16-color palette, chiptune audio, fantasy console constraints.

Rewritten from PixiJS v8 + TypeScript (archived on `pixijs-archive` branch).

## Build & Run
- `pyxel run main.py` — run the game
- `pyxel edit soratchi.pyxres` — open sprite/sound editor
- `pyxel app2html main.py` — build to single HTML file for web deploy

## Deployment
- Vercel: https://sky-farm.vercel.app
- GitHub: https://github.com/hunterbastian/sky-farm
- Deploy: `pyxel app2html main.py` → rename to `index.html` → `vercel --prod`

## Architecture
Modular Python — each system in its own file. Entry point is `main.py`.

### File Map
- `main.py` — App class, game loop, state machine (boot → title → playing)
- `constants.py` — palette, grid, timing, crop defs, all magic numbers
- `world.py` — tile grid, island shape, pond/pen bounds
- `clock.py` — day/night cycle, speed multiplier, mood keyframes
- `crops.py` — crop growth, auto-water/harvest/replant
- `trees.py` — oak/maple state, chopping, regrow
- `animals.py` — chickens, bees, eggs, honey
- `particles.py` — all particle systems
- `ui.py` — HUD, toolbar, floating text, panels
- `input_handler.py` — mouse→tile, smart tap dispatch
- `save_load.py` — JSON persistence
- `draw_world.py` — terrain, pond, pen, cliff edges
- `draw_entities.py` — trees, crops, chickens, bees
- `draw_sky.py` — sky gradient, clouds, stars, night overlay
- `sound.py` — sound slot defs, music playback
- `soratchi.pyxres` — sprites, tilemaps, sounds (Pyxel editor)

### Rendering
- 256x240 screen, 8x8 tiles, 24x24 island grid (192x192 world)
- Island centered at offset (32, 8)
- 16-color mutable palette (set in main.py at boot)
- Sprites from soratchi.pyxres (3 image banks, 8 tilemaps)
- Draw order: sky → ground tiles → overlays → z-sorted entities → particles → UI → night overlay
- Night overlay: `pyxel.dither(alpha)` + full-screen rect
- No HTML overlay — all UI is pixel-rendered

### Game Systems
- 24x24 tile grid, tile types: grass, farmland (dry/wet)
- 4 crops: sky_wheat, star_berry, cloud_pumpkin, moon_flower
- Auto-farm idle loop: auto-water → grow → auto-harvest → auto-replant
- 3 oak trees (choppable), 2 maple trees (decorative)
- 4 chickens in fenced pen, egg laying/collecting
- Beehive with 3 bee species
- Pond with animated water, lily pads, ripples
- Day/night cycle: 210s = 1 day, dithered overlays
- Particles: dirt, splash, sparkle, wood chips, leaves, motes, butterflies
- Save/load via JSON file

### Palette (16 colors)
0=dark 1=bark 2=wood 3=tan 4=wet 5=dgreen 6=green 7=lgreen
8=dwater 9=sky 10=gold 11=orange 12=red 13=pink 14=cream 15=white

## Controls
- Left click — use tool / interact
- 1-5 — switch tools (hoe, water, seeds, axe, pointer)
- Q — quit

## Key Patterns
- All state in `update()`, all rendering in `draw()` — never mutate state in draw
- `pyxel.blt()` for sprites, `pyxel.bltm()` for tilemap rendering
- Multi-tile trees: composite blt() calls, not tilemap entries
- `constants.py` is the single source for all magic numbers
