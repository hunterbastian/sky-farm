# CLAUDE.md — Sky Farm

## Overview
Top-down 2D pixel farming game built with PixiJS v8 + TypeScript + Vite. Stardew Valley-inspired aesthetic on a floating grass island above a dark blue void. Retro CRT visual style with Press Start 2P pixel font.

## Build & Run
- `npm run dev` — start Vite dev server
- `npx tsc --noEmit` — type-check without emitting
- `npm run build` — production build (`tsc && vite build`)

## Deployment
- Vercel: https://sky-farm.vercel.app
- GitHub: https://github.com/hunterbastian/sky-farm
- Vercel project name is `sky-islands` (aliased to `sky-farm.vercel.app`)
- Deploy: `vercel --prod && vercel alias set $(vercel ls sky-islands 2>&1 | grep Production | head -1 | awk '{print $3}') sky-farm.vercel.app`
- Or simpler: `vercel --prod` then `vercel alias set <deployment-url> sky-farm.vercel.app`
- **`vercel --prod` alone only updates `sky-islands.vercel.app` — must re-alias to `sky-farm.vercel.app`**
- **Always push to git AND deploy after every change**

## Architecture
Single-file game at `src/main.ts` (~2200 lines). All rendering, game logic, and UI in one module.

### Rendering
- PixiJS v8 with WebGL backend, `roundPixels: true` for crisp pixels
- 3 layered containers: `groundLayer` → `objectLayer` → `uiWorldLayer`
- Per-frame `Graphics.clear()` + redraw (no sprite sheets — all procedural pixel art)
- Camera centered on island via `world` container transform (`RENDER_SCALE` 3x)
- `image-rendering: pixelated` on canvas for sharp upscaling
- Day/night overlay rendered on `app.stage` (screen space, not world space)
- CRT scanlines + dither + vignette via CSS overlay (`#crt-overlay`)
- Slight barrel curvature via CSS perspective transform on canvas

### Game Systems
- 24x24 tile grid (`ISLAND_SIZE`), 16px per tile (`TILE_PX`)
- Tile types: grass, farmland
- 4 crops: sky_wheat (3-day, 8 coins), star_berry (4-day, 15), cloud_pumpkin (5-day, 22), moon_flower (6-day, 30)
- Each crop has unique pixel art across growth stages
- Click seeds slot again to cycle seed type; `selectedSeed` indexes `CROP_IDS` array
- 4 tools: hoe, water, seeds, axe — clickable toolbar + number keys + scroll
- 3 oak trees (choppable with axe, regrow after 60s, give 3 wood)
- Beehive on middle tree (HIVE_TREE=1) with 5 orbiting bees, sways with tree canopy
- 2 Japanese maple trees with red/orange canopies, falling leaves that land and fade
- 4 yellow chickens in fenced pen (tiles 8-13, 2-6) with idle animations (peck, ruffle, look, sit)
- Chicken pen with fence posts, gate, feeding trough, hay bale, straw ground
- Chickens lay eggs periodically — click to collect for 3 coins
- Pond (bottom-left, ~11 tiles) with animated water, ripples, lily pads
- Cloud shadows drifting across island
- 30 wildflowers scattered on grass (seeded random, avoid pond/trees/pen)
- Ambient particles: butterflies (4), motes (20), leaf particles from trees
- Day/night cycle: 210 real seconds = 1 game day, spawn at 9 AM
- 17 lighting mood keyframes, max alpha 0.32 (softened)
- Save/load via localStorage (`sky_farm_save_v2`)
- Reset Farm button (bottom-right) clears all progress

### UI
- HTML overlay for HUD (not canvas-rendered)
- Press Start 2P pixel font (Google Fonts) for all text
- DOM built with `createElement` + `textContent` (no innerHTML)
- Day clock: emoji phase icon + progress bar + label
- Boot screen: green terminal text typing animation before title
- Pond tiles and pen tiles block farming interactions
- `isPondTile()` and `isPenTile()` guard tile interactions

## Controls
- Left click — use tool (hoe, water, seeds, axe) / collect eggs
- 1-4 / scroll — switch tools
- Click toolbar slots to select tools
- Click seeds slot again to cycle crop type

## Key Patterns
- Seeded random (`seededRandom(seed)`) for deterministic tile variation, wildflower placement
- All entities (chickens, bees, butterflies) use idle sub-animation state machines
- Wildflowers initialized lazily (`initWildflowers()` in first `renderWorld()` call) to avoid referencing trees/mapleTrees before declaration
- Night overlay on `app.stage` (not `world`) to cover full screen regardless of camera
- Beehive position tracks tree canopy sway via matching `Math.sin()` formula
- Colors defined in `COLORS` object — Stardew-inspired palette
- `output/` dir is gitignored (old test artifacts)
