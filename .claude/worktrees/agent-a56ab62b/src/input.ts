import type { Application, Container } from "pixi.js";
import { ISLAND_SIZE, TILE_PX, TOOL_COUNT, TOOLS, CROP_DEFS, CROP_IDS, CHOP_HITS, TREE_REGROW_SECONDS } from "./constants";
import {
  tiles, crops, trees, mapleTrees,
  gameMode, setGameMode, hoveredTile, setHoveredTile,
  selectedTool, setSelectedTool, selectedSeed,
  mouseDown, setMouseDown, toolCooldown, setToolCooldown,
  addCoins, addWood,
} from "./state";
import { isPondTile, isPenTile } from "./tiles";
import { collectEgg } from "./chickens";
import { collectHoney } from "./bees";
import { triggerShake } from "./camera";
import { triggerChopSwing } from "./trees";
import {
  spawnSplash, spawnDirtPuff, spawnSeedPop, spawnHarvestBurst,
  spawnFloatingText, spawnWoodChips,
} from "./particles";
import {
  sfxTill, sfxPlant, sfxWater, sfxChop, sfxTreeFall,
  sfxHarvest, sfxCoin, sfxEgg, sfxSelect, sfxError,
} from "./audio";
import { updateHud, hud, overlay } from "./hud";
import { loadGame, resetFarm } from "./save";
import { el } from "./utils";
import type { ToolId } from "./types";

// ── Pixel Art Cursors ─────────────────────────────────────
function makePixelCursor(draw: (ctx: CanvasRenderingContext2D) => void, hotX = 0, hotY = 0): string {
  const size = 32;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  return `url(${c.toDataURL()}) ${hotX} ${hotY}, auto`;
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x * 2, y * 2, w * 2, h * 2);
}

const cursorHoe = makePixelCursor((ctx) => {
  px(ctx, 2, 3, 1, 10, "#8b6840");
  px(ctx, 3, 3, 1, 10, "#7a5e36");
  px(ctx, 0, 1, 6, 2, "#a0a0a0");
  px(ctx, 0, 0, 6, 1, "#c0c0c0");
  px(ctx, 1, 1, 4, 1, "#888888");
  px(ctx, 0, 3, 1, 1, "#5a4020");
}, 4, 2);

const cursorWater = makePixelCursor((ctx) => {
  px(ctx, 2, 4, 8, 7, "#6a8aaa");
  px(ctx, 3, 4, 6, 7, "#5a7a9a");
  px(ctx, 2, 4, 8, 1, "#8aaace");
  px(ctx, 2, 10, 8, 1, "#4a6a8a");
  px(ctx, 1, 3, 10, 1, "#8aaace");
  px(ctx, 1, 3, 1, 1, "#a0b8d0");
  px(ctx, 4, 1, 4, 1, "#888888");
  px(ctx, 3, 2, 1, 1, "#888888");
  px(ctx, 8, 2, 1, 1, "#888888");
  px(ctx, 3, 5, 6, 3, "#4a8fb8");
  px(ctx, 4, 5, 4, 1, "#6aaad0");
  px(ctx, 1, 11, 1, 2, "#6aaad0");
  px(ctx, 1, 13, 1, 1, "#4a8fb8");
}, 6, 14);

const cursorSeeds = makePixelCursor((ctx) => {
  px(ctx, 3, 4, 7, 8, "#c4a870");
  px(ctx, 4, 4, 5, 8, "#b09458");
  px(ctx, 3, 4, 7, 1, "#d4b880");
  px(ctx, 3, 11, 7, 1, "#9a8048");
  px(ctx, 4, 2, 5, 2, "#c4a870");
  px(ctx, 5, 1, 3, 1, "#c4a870");
  px(ctx, 5, 3, 3, 1, "#6a5030");
  px(ctx, 5, 6, 1, 1, "#5daa3e");
  px(ctx, 7, 7, 1, 1, "#4e9636");
  px(ctx, 6, 8, 1, 1, "#6ebc4e");
  px(ctx, 8, 6, 1, 1, "#5daa3e");
  px(ctx, 4, 13, 1, 1, "#5daa3e");
  px(ctx, 6, 14, 1, 1, "#4e9636");
}, 6, 14);

const cursorAxe = makePixelCursor((ctx) => {
  px(ctx, 5, 5, 1, 10, "#8b6840");
  px(ctx, 6, 5, 1, 10, "#7a5e36");
  px(ctx, 5, 8, 1, 1, "#9a7848");
  px(ctx, 6, 11, 1, 1, "#6a4e2e");
  px(ctx, 5, 12, 2, 1, "#5a3820");
  px(ctx, 5, 14, 2, 1, "#5a3820");
  px(ctx, 4, 15, 3, 1, "#6a4830");
  px(ctx, 1, 2, 5, 4, "#8a8a8a");
  px(ctx, 0, 3, 1, 2, "#9a9a9a");
  px(ctx, 0, 2, 1, 1, "#a0a0a0");
  px(ctx, 0, 5, 1, 1, "#a0a0a0");
  px(ctx, 6, 3, 1, 2, "#707070");
  px(ctx, 0, 2, 1, 4, "#d0d0d0");
  px(ctx, 1, 1, 1, 1, "#c8c8c8");
  px(ctx, 1, 6, 1, 1, "#c8c8c8");
  px(ctx, 2, 2, 2, 1, "#b0b0b0");
  px(ctx, 1, 3, 1, 1, "#c0c0c0");
  px(ctx, 2, 5, 3, 1, "#707070");
  px(ctx, 4, 3, 2, 2, "#5a5a5a");
  px(ctx, 4, 3, 1, 1, "#6a6a6a");
}, 1, 3);

const toolCursors: Record<ToolId, string> = {
  pointer: "default",
  hoe: cursorHoe,
  water: cursorWater,
  seeds: cursorSeeds,
  axe: cursorAxe,
};

let activeCursorTool: ToolId | null = null;
let gameContainer: HTMLDivElement;

export function updateCursor(): void {
  if (gameMode !== "playing") {
    if (activeCursorTool !== null) {
      gameContainer.style.cursor = "";
      activeCursorTool = null;
    }
    return;
  }
  const tool = TOOLS[selectedTool]!.id;
  if (tool !== activeCursorTool) {
    gameContainer.style.cursor = toolCursors[tool];
    activeCursorTool = tool;
  }
}

// ── Hovered Tile ─────────────────────────────────────────
export function getHoveredTile(app: Application, world: Container): { x: number; z: number } | null {
  const mouseX = app.renderer.events.pointer.global.x;
  const mouseY = app.renderer.events.pointer.global.y;
  const worldX = (mouseX - world.x) / world.scale.x;
  const worldZ = (mouseY - world.y) / world.scale.y;
  const tileX = Math.floor(worldX / TILE_PX);
  const tileZ = Math.floor(worldZ / TILE_PX);
  if (tileX >= 0 && tileX < ISLAND_SIZE && tileZ >= 0 && tileZ < ISLAND_SIZE) {
    return { x: tileX, z: tileZ };
  }
  return null;
}

// ── Tool Actions ──────────────────────────────────────────
export function useTool(): void {
  if (gameMode !== "playing" || !hoveredTile) return;
  const { x, z } = hoveredTile;
  const tile = tiles[z]?.[x];
  if (!tile) return;
  // Collect eggs with any tool
  if (collectEgg(x, z)) { sfxEgg(); sfxCoin(); spawnFloatingText(x, z, "+3", 0xf0e060); updateHud(); return; }

  // Can't interact with pond or pen tiles
  if (isPondTile(x, z) || isPenTile(x, z)) { sfxError(); return; }

  const tool = TOOLS[selectedTool]!.id;

  switch (tool) {
    case "pointer":
      // Pointer can harvest mature crops by clicking
      if (tile === "farmland") {
        const cropIdx = crops.findIndex((c) => c.x === x && c.z === z);
        if (cropIdx >= 0) {
          const crop = crops[cropIdx]!;
          if (crop.growth >= CROP_DEFS[crop.type].growDays) {
            const price = CROP_DEFS[crop.type].sellPrice;
            addCoins(price);
            spawnHarvestBurst(x, z, crop.type);
            crops.splice(cropIdx, 1);
            sfxHarvest();
            spawnFloatingText(x, z, "+" + price, 0xf0e060);
          }
        }
      }
      break;

    case "hoe":
      if (tile === "grass") {
        tiles[z]![x] = "farmland";
        sfxTill();
        spawnDirtPuff(x, z);
      } else if (tile === "farmland") {
        const cropIdx = crops.findIndex((c) => c.x === x && c.z === z);
        if (cropIdx >= 0) {
          const crop = crops[cropIdx]!;
          if (crop.growth >= CROP_DEFS[crop.type].growDays) {
            const price = CROP_DEFS[crop.type].sellPrice;
            addCoins(price);
            spawnHarvestBurst(x, z, crop.type);
            crops.splice(cropIdx, 1);
            sfxHarvest();
            spawnFloatingText(x, z, "+" + price, 0xf0e060);
          }
        } else {
          tiles[z]![x] = "grass";
          sfxTill();
        }
      }
      break;

    case "water":
      spawnSplash(x, z);
      sfxWater();
      if (tile === "farmland") {
        const crop = crops.find((c) => c.x === x && c.z === z);
        if (crop && !crop.watered) crop.watered = true;
      }
      break;

    case "seeds":
      if (tile === "farmland") {
        if (!crops.some((c) => c.x === x && c.z === z)) {
          crops.push({ x, z, type: CROP_IDS[selectedSeed]!, growth: 0, watered: false, growTimer: 0 });
          sfxPlant();
          spawnSeedPop(x, z);
        }
      }
      break;

    case "axe": {
      // Oak trees
      const tree = trees.find((t) => t.x === x && t.z === z && t.chopTime < CHOP_HITS && !t.falling);
      if (tree) {
        tree.chopTime += 1;
        sfxChop();
        triggerChopSwing();
        triggerShake(2);
        spawnWoodChips(x, z);
        if (tree.chopTime >= CHOP_HITS) {
          addWood(3);
          tree.regrowTimer = TREE_REGROW_SECONDS;
          tree.falling = true;
          tree.fallAngle = 0;
          sfxTreeFall();
          triggerShake(5);
          spawnFloatingText(x, z, "+3", 0xc4a050);
        }
        break;
      }
      // Cherry blossom trees
      const mt = mapleTrees.find((t) => t.x === x && t.z === z && t.chopTime < CHOP_HITS && !t.falling);
      if (mt) {
        mt.chopTime += 1;
        sfxChop();
        triggerChopSwing();
        triggerShake(2);
        spawnWoodChips(x, z);
        if (mt.chopTime >= CHOP_HITS) {
          addWood(2);
          mt.regrowTimer = TREE_REGROW_SECONDS;
          mt.falling = true;
          mt.fallAngle = 0;
          sfxTreeFall();
          triggerShake(4);
          spawnFloatingText(x, z, "+2", 0xf0a0b0);
        }
      }
      break;
    }
  }

  updateHud();
}

// ── Smart Tap (mobile-friendly: context-aware interaction) ──
export function smartTap(): void {
  if (gameMode !== "playing" || !hoveredTile) return;
  const { x, z } = hoveredTile;
  const tile = tiles[z]?.[x];
  if (!tile) return;

  // Collect honey
  const honeyVal = collectHoney(x, z);
  if (honeyVal > 0) {
    sfxHarvest(); sfxCoin();
    spawnFloatingText(x, z, "+" + honeyVal, 0xf0c840);
    updateHud();
    return;
  }

  // Collect eggs
  if (collectEgg(x, z)) {
    sfxEgg(); sfxCoin();
    spawnFloatingText(x, z, "+3", 0xf0e060);
    updateHud();
    return;
  }

  if (isPondTile(x, z) || isPenTile(x, z)) return;

  // Tap grass -> till it
  if (tile === "grass") {
    tiles[z]![x] = "farmland";
    sfxTill();
    spawnDirtPuff(x, z);
    updateHud();
    return;
  }

  // Tap farmland -> plant if empty, harvest if mature
  if (tile === "farmland") {
    const cropIdx = crops.findIndex((c) => c.x === x && c.z === z);
    if (cropIdx >= 0) {
      const crop = crops[cropIdx]!;
      const def = CROP_DEFS[crop.type];
      if (crop.growth >= def.growDays) {
        // Manual harvest
        addCoins(def.sellPrice);
        spawnHarvestBurst(x, z, crop.type);
        spawnFloatingText(x, z, "+" + def.sellPrice, 0xf0e060);
        sfxHarvest();
        // Replant
        crop.growth = 0;
        crop.watered = false;
        crop.growTimer = 0;
        spawnSeedPop(x, z);
      } else if (!crop.watered) {
        // Manual water for a speed boost
        crop.watered = true;
        spawnSplash(x, z);
        sfxWater();
      }
    } else {
      // Empty farmland -> plant
      crops.push({ x, z, type: CROP_IDS[selectedSeed]!, growth: 0, watered: false, growTimer: 0 });
      sfxPlant();
      spawnSeedPop(x, z);
    }
    updateHud();
    return;
  }
}

// ── Touch Handler ────────────────────────────────────────
function handleTouch(clientX: number, clientY: number, app: Application, world: Container): void {
  const canvas = app.canvas as HTMLCanvasElement;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const pxX = (clientX - rect.left) * scaleX;
  const pxY = (clientY - rect.top) * scaleY;
  const worldX = (pxX - world.x) / world.scale.x;
  const worldZ = (pxY - world.y) / world.scale.y;
  const tileX = Math.floor(worldX / TILE_PX);
  const tileZ = Math.floor(worldZ / TILE_PX);
  if (tileX >= 0 && tileX < ISLAND_SIZE && tileZ >= 0 && tileZ < ISLAND_SIZE) {
    setHoveredTile({ x: tileX, z: tileZ });
    smartTap();
  }
}

// ── Setup Input ──────────────────────────────────────────
export function setupInput(app: Application, world: Container): void {
  gameContainer = el<HTMLDivElement>("game-container");
  const startBtn = el<HTMLButtonElement>("start-btn");
  const resetBtn = el<HTMLButtonElement>("reset-btn");

  window.addEventListener("keydown", (e) => {
    if (gameMode !== "playing") return;
    const digit = parseInt(e.key, 10);
    if (digit >= 1 && digit <= TOOL_COUNT) {
      setSelectedTool(digit - 1);
      sfxSelect();
      updateHud();
    }
  });

  window.addEventListener("wheel", (e) => {
    if (gameMode !== "playing") return;
    const dir = e.deltaY > 0 ? 1 : -1;
    setSelectedTool(((selectedTool + dir) % TOOL_COUNT + TOOL_COUNT) % TOOL_COUNT);
    sfxSelect();
    updateHud();
  });

  window.addEventListener("mousedown", (e) => {
    if (gameMode !== "playing") return;
    if (e.button === 0) {
      setMouseDown(true);
      setToolCooldown(0);
      smartTap();
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) {
      setMouseDown(false);
    }
  });

  window.addEventListener("mouseleave", () => { setMouseDown(false); });

  // Touch support for mobile
  window.addEventListener("touchstart", (e) => {
    if (gameMode !== "playing") return;
    if (e.target instanceof HTMLButtonElement || (e.target as HTMLElement).closest?.("#toolbar")) return;
    const touch = e.touches[0];
    if (touch) {
      e.preventDefault();
      handleTouch(touch.clientX, touch.clientY, app, world);
    }
  }, { passive: false });

  window.addEventListener("contextmenu", (e) => e.preventDefault());

  startBtn.addEventListener("click", () => {
    loadGame();
    setGameMode("playing");
    overlay.classList.add("hidden");
    overlay.classList.remove("visible");
    hud.classList.remove("hidden");
    updateHud();
  });

  resetBtn.addEventListener("click", () => {
    resetFarm();
    updateHud();
  });
}
