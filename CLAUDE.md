# CLAUDE.md — Sky Farm

## Overview
Top-down 2D pixel farming game built with PixiJS + TypeScript + Vite. Stardew Valley-inspired aesthetic on a floating grass island above a dark blue void.

## Build & Run
- `npm run dev` — start Vite dev server
- `npx tsc --noEmit` — type-check without emitting
- `npm run build` — production build (`tsc && vite build`)

## Architecture
Single-file game at `src/main.ts` (~1000 lines). All rendering, game logic, and UI in one module.

### Rendering
- PixiJS v8 with WebGL backend, `roundPixels: true` for crisp pixels
- 4 layered containers: `groundLayer` → `objectLayer` → `playerLayer` → `uiWorldLayer`
- Per-frame `Graphics.clear()` + redraw (no sprite sheets — all procedural pixel art)
- Camera follow via `world` container transform (`world.x/y` offset + `RENDER_SCALE` 3x)
- `image-rendering: pixelated` on canvas for sharp upscaling
- Day/night overlay via alpha-filled Graphics rect

### Game Systems
- 24x24 tile grid (`ISLAND_SIZE`), 16px per tile (`TILE_PX`)
- Tile types: grass, farmland, road
- Crops: sky_wheat (2-day), star_berry (4-day) — 4 growth stages
- Placeables: bed, wood_block, door, torch
- Inventory: 9 hotbar + 27 backpack slots, crafting, buy/sell shop
- Day/night cycle: 540 real seconds = 1 game day
- Save/load via localStorage (`sky_farm_save_v1`)

### UI
- HTML overlay for HUD, inventory panel, crafting, shop (not canvas-rendered)
- DOM built with `createElement` + `textContent` (no innerHTML — security hook)
- Tab system for inventory/crafting/shop panels

## Controls
- WASD/Arrows — move
- Left click — interact (harvest, pick up)
- Right click — place (seeds, items, tiles)
- E — toggle inventory
- 1-9 / scroll — hotbar selection
- Bed + right click at night — sleep to next day

## Deployment
- Vercel: https://sky-farm.vercel.app
- GitHub: https://github.com/hunterbastian/sky-farm
- `vercel --prod` to deploy

## Key Patterns
- Seeded random (`seededRandom(tx * 1000 + tz * 37)`) for deterministic tile variation
- Island edge: cliff face tiles drawn around perimeter with grass lip
- Player sprite has directional eyes, hair tufts, shirt/pants/boots layers
- Colors defined in `COLORS` object — Stardew-inspired palette
- `output/` dir is gitignored (old test artifacts)
