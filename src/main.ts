import { Application, Container, Graphics, Ticker } from "pixi.js";

// ── Types ─────────────────────────────────────────────────
type TileType = "grass" | "farmland";
type CropTypeId = "sky_wheat";
type ToolId = "hoe" | "water" | "seeds";

interface CropState {
  x: number;
  z: number;
  type: CropTypeId;
  growth: number;
  watered: boolean;
}

interface CropDefinition {
  label: string;
  growDays: number;
}

// ── Constants ─────────────────────────────────────────────
const ISLAND_SIZE = 24;
const TILE_PX = 16;
const RENDER_SCALE = 3;
const TOOL_COUNT = 3;

const WORLD_DAY_SECONDS = 86_400;
const REAL_DAY_SECONDS = 540;
const TIME_SCALE = WORLD_DAY_SECONDS / REAL_DAY_SECONDS;
const DAWN_SECONDS = 6 * 3600;
const SAVE_KEY = "sky_farm_save_v2";

const TOOLS: { id: ToolId; label: string; icon: string }[] = [
  { id: "hoe", label: "Hoe", icon: "⛏" },
  { id: "water", label: "Water", icon: "💧" },
  { id: "seeds", label: "Seeds", icon: "🌱" },
];

const CROP_DEFS: Record<CropTypeId, CropDefinition> = {
  sky_wheat: { label: "Sky Wheat", growDays: 3 },
};

// ── Tile Colors (Stardew-inspired) ────────────────────────
const COLORS = {
  grass1: 0x5daa3e,
  grass2: 0x4e9636,
  grass3: 0x6ebc4e,
  grassDark: 0x3e7e2c,
  grassLight: 0x7ecc5a,
  grassEdge: 0x3a6e24,
  cliffTop: 0x4a6a3e,
  cliffFace: 0x2a3828,
  cliffShadow: 0x1e2a1c,
  farmland: 0x7a5e3c,
  farmlandDark: 0x5e4228,
  farmlandWet: 0x4e3824,
  farmlandWetDark: 0x3a2818,
  water: 0x4a8fb8,
  cropGreen: 0x6ebc4e,
  cropGreenDark: 0x4e9636,
  cropYellow: 0xe0d040,
  highlight: 0xffffff,
  highlightHoe: 0xd4a850,
  highlightWater: 0x6aaad0,
  highlightSeeds: 0x7ecc5a,
};

// ── Seeded random ─────────────────────────────────────────
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Stego ─────────────────────────────────────────────────
const STEGO_SPEED = 1.2;
const STEGO_IDLE_MIN = 2;
const STEGO_IDLE_MAX = 5;

const stego = {
  x: 6,
  z: 6,
  targetX: 6,
  targetZ: 6,
  facing: 1, // -1 = left, 1 = right
  walkTimer: 0,
  idleTimer: 3,
  state: "idle" as "idle" | "walking",
};

function pickStegoTarget(): void {
  // Pick a random grass tile within ~6 tiles
  const range = 6;
  const tx = stego.x + (Math.random() * range * 2 - range);
  const tz = stego.z + (Math.random() * range * 2 - range);
  stego.targetX = Math.max(1, Math.min(ISLAND_SIZE - 1, tx));
  stego.targetZ = Math.max(1, Math.min(ISLAND_SIZE - 1, tz));
  stego.state = "walking";
}

function updateStego(dt: number): void {
  if (stego.state === "idle") {
    stego.idleTimer -= dt;
    if (stego.idleTimer <= 0) pickStegoTarget();
    return;
  }

  const dx = stego.targetX - stego.x;
  const dz = stego.targetZ - stego.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < 0.1) {
    stego.state = "idle";
    stego.idleTimer = STEGO_IDLE_MIN + Math.random() * (STEGO_IDLE_MAX - STEGO_IDLE_MIN);
    return;
  }

  const nx = dx / dist;
  const nz = dz / dist;
  stego.x += nx * STEGO_SPEED * dt;
  stego.z += nz * STEGO_SPEED * dt;
  stego.x = Math.max(0.5, Math.min(ISLAND_SIZE - 0.5, stego.x));
  stego.z = Math.max(0.5, Math.min(ISLAND_SIZE - 0.5, stego.z));

  if (Math.abs(dx) > 0.05) stego.facing = dx > 0 ? 1 : -1;
  stego.walkTimer += dt;
}

// ── Game State ────────────────────────────────────────────
const tiles: TileType[][] = [];
for (let z = 0; z < ISLAND_SIZE; z++) {
  const row: TileType[] = [];
  for (let x = 0; x < ISLAND_SIZE; x++) row.push("grass");
  tiles.push(row);
}

const crops: CropState[] = [];
let selectedTool = 0;
let gameMode: "menu" | "playing" = "menu";
let clockTime = DAWN_SECONDS;
let clockDay = 1;
let coins = 0;
let hoveredTile: { x: number; z: number } | null = null;
let mouseDown = false;
let toolCooldown = 0;
const TOOL_HOLD_RATE = 0.12; // seconds between actions while holding

// ── Water Splash Particles ────────────────────────────────
interface Splash {
  x: number; // pixel position
  z: number;
  life: number; // 0→1 (1 = dead)
  size: number;
  vx: number;
  vz: number;
}

const splashes: Splash[] = [];

function spawnSplash(tileX: number, tileZ: number): void {
  const cx = tileX * TILE_PX + TILE_PX / 2;
  const cz = tileZ * TILE_PX + TILE_PX / 2;

  // Main splash droplets — burst outward from center
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 8 + Math.random() * 20;
    splashes.push({
      x: cx + (Math.random() - 0.5) * 4,
      z: cz + (Math.random() - 0.5) * 4,
      life: 0,
      size: 1 + Math.random(),
      vx: Math.cos(angle) * speed,
      vz: Math.sin(angle) * speed,
    });
  }

  // Some smaller droplets that land nearby (the "dries beside" effect)
  for (let i = 0; i < 5; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 6 + Math.random() * 14;
    splashes.push({
      x: cx + Math.cos(angle) * dist,
      z: cz + Math.sin(angle) * dist,
      life: 0.2 + Math.random() * 0.15, // start partially faded — they "landed" already
      size: 1,
      vx: 0,
      vz: 0,
    });
  }
}

function updateSplashes(dt: number): void {
  for (let i = splashes.length - 1; i >= 0; i--) {
    const s = splashes[i]!;
    s.life += dt * 1.2;
    s.x += s.vx * dt;
    s.z += s.vz * dt;
    // Friction
    s.vx *= 0.88;
    s.vz *= 0.88;
    if (s.life >= 1) splashes.splice(i, 1);
  }
}

function drawSplashes(g: Graphics): void {
  for (const s of splashes) {
    const alpha = 1 - s.life;
    if (alpha <= 0) continue;
    // Blue water droplet that fades
    const sz = Math.max(1, Math.round(s.size * (1 - s.life * 0.5)));
    g.rect(Math.round(s.x), Math.round(s.z), sz, sz).fill({ color: 0x6aaad0, alpha: alpha * 0.7 });
    // Lighter center for sheen
    if (sz > 1 && alpha > 0.3) {
      g.rect(Math.round(s.x), Math.round(s.z), 1, 1).fill({ color: 0xa0d4f0, alpha: alpha * 0.5 });
    }
  }
}

// ── DOM ───────────────────────────────────────────────────
function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing: #${id}`);
  return e as T;
}

const hud = el<HTMLDivElement>("hud");
const overlay = el<HTMLDivElement>("overlay");
const hudTime = el<HTMLSpanElement>("hud-time");
const hudCoins = el<HTMLSpanElement>("hud-coins");
const toolbarEl = el<HTMLDivElement>("toolbar");
const startBtn = el<HTMLButtonElement>("start-btn");
const gameContainer = el<HTMLDivElement>("game-container");

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
  // Handle
  px(ctx, 2, 3, 1, 10, "#8b6840");
  px(ctx, 3, 3, 1, 10, "#7a5e36");
  // Head
  px(ctx, 0, 1, 6, 2, "#a0a0a0");
  px(ctx, 0, 0, 6, 1, "#c0c0c0");
  px(ctx, 1, 1, 4, 1, "#888888");
  // Outline
  px(ctx, 0, 3, 1, 1, "#5a4020");
}, 4, 2);

const cursorWater = makePixelCursor((ctx) => {
  // Bucket body
  px(ctx, 2, 4, 8, 7, "#6a8aaa");
  px(ctx, 3, 4, 6, 7, "#5a7a9a");
  px(ctx, 2, 4, 8, 1, "#8aaace");
  px(ctx, 2, 10, 8, 1, "#4a6a8a");
  // Rim
  px(ctx, 1, 3, 10, 1, "#8aaace");
  px(ctx, 1, 3, 1, 1, "#a0b8d0");
  // Handle
  px(ctx, 4, 1, 4, 1, "#888888");
  px(ctx, 3, 2, 1, 1, "#888888");
  px(ctx, 8, 2, 1, 1, "#888888");
  // Water inside
  px(ctx, 3, 5, 6, 3, "#4a8fb8");
  px(ctx, 4, 5, 4, 1, "#6aaad0");
  // Drip
  px(ctx, 1, 11, 1, 2, "#6aaad0");
  px(ctx, 1, 13, 1, 1, "#4a8fb8");
}, 6, 14);

const cursorSeeds = makePixelCursor((ctx) => {
  // Bag body
  px(ctx, 3, 4, 7, 8, "#c4a870");
  px(ctx, 4, 4, 5, 8, "#b09458");
  px(ctx, 3, 4, 7, 1, "#d4b880");
  px(ctx, 3, 11, 7, 1, "#9a8048");
  // Bag top (gathered)
  px(ctx, 4, 2, 5, 2, "#c4a870");
  px(ctx, 5, 1, 3, 1, "#c4a870");
  // Tie
  px(ctx, 5, 3, 3, 1, "#6a5030");
  // Seeds visible on bag
  px(ctx, 5, 6, 1, 1, "#5daa3e");
  px(ctx, 7, 7, 1, 1, "#4e9636");
  px(ctx, 6, 8, 1, 1, "#6ebc4e");
  px(ctx, 8, 6, 1, 1, "#5daa3e");
  // Falling seed
  px(ctx, 4, 13, 1, 1, "#5daa3e");
  px(ctx, 6, 14, 1, 1, "#4e9636");
}, 6, 14);

const toolCursors: Record<ToolId, string> = {
  hoe: cursorHoe,
  water: cursorWater,
  seeds: cursorSeeds,
};

let activeCursorTool: ToolId | null = null;

function updateCursor(): void {
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

// ── PixiJS Setup ──────────────────────────────────────────
const app = new Application();

async function initPixi(): Promise<void> {
  await app.init({
    background: 0x0a1628,
    resizeTo: window,
    antialias: false,
    roundPixels: true,
    resolution: 1,
  });

  const container = el<HTMLDivElement>("game-container");
  container.appendChild(app.canvas);
  app.canvas.style.imageRendering = "pixelated";
}

// ── World Layers ──────────────────────────────────────────
const world = new Container();
const groundLayer = new Container();
const objectLayer = new Container();
const uiWorldLayer = new Container();

world.addChild(groundLayer);
world.addChild(objectLayer);
world.addChild(uiWorldLayer);

// ── Drawing ───────────────────────────────────────────────
function drawGrassTile(g: Graphics, tx: number, tz: number): void {
  const rand = seededRandom(tx * 1000 + tz * 37);
  const baseColors = [COLORS.grass1, COLORS.grass2, COLORS.grass3];
  const base = baseColors[Math.floor(rand() * baseColors.length)]!;
  g.rect(tx * TILE_PX, tz * TILE_PX, TILE_PX, TILE_PX).fill(base);

  // Edge dirt — bare patches near island perimeter
  const edgeDist = Math.min(tx, tz, ISLAND_SIZE - 1 - tx, ISLAND_SIZE - 1 - tz);
  if (edgeDist <= 1) {
    const dirtChance = edgeDist === 0 ? 0.7 : 0.3;
    const dirtCount = edgeDist === 0 ? 4 + Math.floor(rand() * 4) : 2 + Math.floor(rand() * 3);
    if (rand() < dirtChance) {
      const dirtColors = [0x7a6a4e, 0x6e5e42, 0x8a7a5a, 0x5e5038];
      for (let i = 0; i < dirtCount; i++) {
        const dx = Math.floor(rand() * 14) + 1;
        const dz = Math.floor(rand() * 14) + 1;
        const dc = dirtColors[Math.floor(rand() * dirtColors.length)]!;
        const dw = 1 + Math.floor(rand() * 2);
        const dh = 1 + Math.floor(rand() * 2);
        g.rect(tx * TILE_PX + dx, tz * TILE_PX + dz, dw, dh).fill(dc);
      }
    }
    // Sparse pebbles on edges
    if (edgeDist === 0 && rand() < 0.4) {
      const px2 = Math.floor(rand() * 12) + 2;
      const pz2 = Math.floor(rand() * 12) + 2;
      g.rect(tx * TILE_PX + px2, tz * TILE_PX + pz2, 2, 1).fill(0x9a9080);
      g.rect(tx * TILE_PX + px2 + 4, tz * TILE_PX + pz2 + 3, 1, 1).fill(0x8a8070);
    }
  }

  // Grass speckles
  for (let i = 0; i < 6; i++) {
    const spx = Math.floor(rand() * 14) + 1;
    const spz = Math.floor(rand() * 14) + 1;
    const shade = rand() > 0.5 ? COLORS.grassLight : COLORS.grassDark;
    g.rect(tx * TILE_PX + spx, tz * TILE_PX + spz, 1, 1).fill(shade);
  }

  // Grass blade tufts (skip on very edge tiles — too dirty)
  if (edgeDist > 0 && rand() < 0.4) {
    const bx = Math.floor(rand() * 10) + 3;
    const bz = Math.floor(rand() * 8) + 4;
    g.rect(tx * TILE_PX + bx, tz * TILE_PX + bz, 1, 3).fill(COLORS.grassDark);
    g.rect(tx * TILE_PX + bx + 2, tz * TILE_PX + bz + 1, 1, 2).fill(COLORS.grassDark);
  }

  // Flowers (only interior tiles)
  if (edgeDist > 1 && rand() < 0.18) {
    const fx = Math.floor(rand() * 10) + 3;
    const fz = Math.floor(rand() * 10) + 3;
    const flowerColors = [0xf0e040, 0xe86080, 0x80b0f0, 0xf0a0d0, 0xffa060, 0xf8f8f0];
    const fc = flowerColors[Math.floor(rand() * flowerColors.length)]!;
    g.rect(tx * TILE_PX + fx, tz * TILE_PX + fz + 2, 1, 2).fill(COLORS.grassDark);
    g.rect(tx * TILE_PX + fx, tz * TILE_PX + fz, 1, 1).fill(fc);
    g.rect(tx * TILE_PX + fx - 1, tz * TILE_PX + fz + 1, 1, 1).fill(fc);
    g.rect(tx * TILE_PX + fx + 1, tz * TILE_PX + fz + 1, 1, 1).fill(fc);
    g.rect(tx * TILE_PX + fx, tz * TILE_PX + fz + 1, 1, 1).fill(0xf8e860);
  }
}

function isOnIsland(x: number, z: number): boolean {
  return x >= 0 && x < ISLAND_SIZE && z >= 0 && z < ISLAND_SIZE;
}

function drawIslandEdge(g: Graphics): void {
  for (let x = -1; x <= ISLAND_SIZE; x++) {
    for (let z = -1; z <= ISLAND_SIZE; z++) {
      if (isOnIsland(x, z)) continue;
      const adj = isOnIsland(x + 1, z) || isOnIsland(x - 1, z) || isOnIsland(x, z + 1) || isOnIsland(x, z - 1)
        || isOnIsland(x + 1, z + 1) || isOnIsland(x - 1, z - 1) || isOnIsland(x + 1, z - 1) || isOnIsland(x - 1, z + 1);
      if (!adj) continue;

      const px = x * TILE_PX;
      const pz = z * TILE_PX;

      if (z >= ISLAND_SIZE || (z >= 0 && !isOnIsland(x, z))) {
        g.rect(px, pz, TILE_PX, TILE_PX).fill(COLORS.cliffFace);
        if (isOnIsland(x, z - 1)) g.rect(px, pz, TILE_PX, 3).fill(COLORS.cliffTop);
        const rand = seededRandom(x * 500 + z * 77);
        for (let i = 0; i < 3; i++) {
          const lx = Math.floor(rand() * 12) + 2;
          const lz = Math.floor(rand() * 12) + 2;
          g.rect(px + lx, pz + lz, 2, 1).fill(COLORS.cliffShadow);
        }
      } else {
        g.rect(px, pz, TILE_PX, TILE_PX).fill(COLORS.cliffFace);
        if (isOnIsland(x, z + 1)) g.rect(px, pz + TILE_PX - 3, TILE_PX, 3).fill(COLORS.cliffTop);
      }
    }
  }

  for (let x = 0; x < ISLAND_SIZE; x++) {
    if (!isOnIsland(x, -1)) g.rect(x * TILE_PX, 0, TILE_PX, 1).fill(COLORS.grassEdge);
    if (!isOnIsland(x, ISLAND_SIZE)) g.rect(x * TILE_PX, ISLAND_SIZE * TILE_PX - 1, TILE_PX, 1).fill(COLORS.grassEdge);
  }
  for (let z = 0; z < ISLAND_SIZE; z++) {
    if (!isOnIsland(-1, z)) g.rect(0, z * TILE_PX, 1, TILE_PX).fill(COLORS.grassEdge);
    if (!isOnIsland(ISLAND_SIZE, z)) g.rect(ISLAND_SIZE * TILE_PX - 1, z * TILE_PX, 1, TILE_PX).fill(COLORS.grassEdge);
  }
}

function drawFarmlandTile(g: Graphics, tx: number, tz: number, watered: boolean): void {
  const color = watered ? COLORS.farmlandWet : COLORS.farmland;
  const dark = watered ? COLORS.farmlandWetDark : COLORS.farmlandDark;
  g.rect(tx * TILE_PX, tz * TILE_PX, TILE_PX, TILE_PX).fill(color);

  for (let row = 2; row < TILE_PX; row += 4) {
    g.rect(tx * TILE_PX + 1, tz * TILE_PX + row, TILE_PX - 2, 1).fill(dark);
    const ridgeColor = watered ? 0x5a4430 : 0x8a6e4e;
    g.rect(tx * TILE_PX + 1, tz * TILE_PX + row - 1, TILE_PX - 2, 1).fill(ridgeColor);
  }

  if (watered) {
    const rand = seededRandom(tx * 333 + tz * 19);
    for (let i = 0; i < 3; i++) {
      const dx = Math.floor(rand() * 12) + 2;
      const dz = Math.floor(rand() * 12) + 2;
      g.rect(tx * TILE_PX + dx, tz * TILE_PX + dz, 1, 1).fill(0x6aaad0);
    }
  }
}

function drawCrop(g: Graphics, crop: CropState): void {
  const def = CROP_DEFS[crop.type];
  const progress = crop.growth / def.growDays;
  const cx = crop.x * TILE_PX;
  const cz = crop.z * TILE_PX;

  if (progress < 0.3) {
    g.rect(cx + 7, cz + 10, 2, 3).fill(COLORS.cropGreenDark);
    g.rect(cx + 6, cz + 9, 4, 2).fill(COLORS.cropGreen);
    g.rect(cx + 7, cz + 8, 2, 1).fill(COLORS.cropGreen);
  } else if (progress < 0.7) {
    g.rect(cx + 7, cz + 5, 2, 8).fill(COLORS.cropGreenDark);
    g.rect(cx + 4, cz + 5, 3, 3).fill(COLORS.cropGreen);
    g.rect(cx + 9, cz + 6, 3, 3).fill(COLORS.cropGreen);
    g.rect(cx + 6, cz + 8, 4, 2).fill(COLORS.cropGreen);
  } else if (progress < 1) {
    g.rect(cx + 7, cz + 3, 2, 10).fill(COLORS.cropGreenDark);
    g.rect(cx + 3, cz + 4, 4, 4).fill(COLORS.cropGreen);
    g.rect(cx + 9, cz + 3, 4, 4).fill(COLORS.cropGreen);
    g.rect(cx + 5, cz + 7, 6, 3).fill(COLORS.cropGreen);
  } else {
    // Harvestable — golden wheat
    g.rect(cx + 7, cz + 3, 2, 10).fill(COLORS.cropGreenDark);
    g.rect(cx + 3, cz + 4, 4, 4).fill(COLORS.cropGreen);
    g.rect(cx + 9, cz + 3, 4, 4).fill(COLORS.cropGreen);
    g.rect(cx + 5, cz + 7, 6, 3).fill(COLORS.cropGreen);
    g.rect(cx + 4, cz + 2, 4, 3).fill(COLORS.cropYellow);
    g.rect(cx + 5, cz + 2, 2, 1).fill(0xc4b030);
    g.rect(cx + 9, cz + 1, 4, 3).fill(COLORS.cropYellow);
    g.rect(cx + 10, cz + 1, 2, 1).fill(0xc4b030);
  }

  if (crop.watered) {
    g.rect(cx + 13, cz + 1, 2, 2).fill({ color: COLORS.water, alpha: 0.7 });
  }
}

let stegoBlinkTimer = 0;
let stegoBlinking = false;

function drawStego(g: Graphics): void {
  const px = stego.x * TILE_PX;
  const pz = stego.z * TILE_PX;
  const f = stego.facing; // 1 = right, -1 = left
  const bob = stego.state === "walking" ? Math.sin(stego.walkTimer * 6) * 0.4 : 0;
  const legSwing = stego.state === "walking" ? Math.sin(stego.walkTimer * 8) * 1 : 0;
  const now = performance.now() / 1000;
  // Tail wag — gentle sine oscillation
  const tailWag = Math.sin(now * 2.5) * 1.2;
  // Blink logic
  stegoBlinkTimer -= 1 / 60;
  if (stegoBlinkTimer <= 0) {
    stegoBlinking = !stegoBlinking;
    stegoBlinkTimer = stegoBlinking ? 0.12 : 2.5 + Math.random() * 3;
  }

  // Center the sprite on the tile position
  const cx = px + 8;
  const cy = pz + 8;

  // Helper to draw mirrored around center
  const r = (ox: number, oy: number, w: number, h: number, color: number, alpha = 1) => {
    g.rect(cx + ox * f, cy + oy, w, h).fill(alpha < 1 ? { color, alpha } : color);
  };

  // Shadow
  g.ellipse(cx, cy + 7, 7, 2).fill({ color: 0x000000, alpha: 0.15 });

  // Legs (4 stubby legs)
  const legColor = 0x5a9a40;
  const legDark = 0x4a8234;
  r(-5, 4 + legSwing * 0.3, 2, 3, legColor);
  r(-5, 6 + legSwing * 0.3, 2, 1, legDark);
  r(-2, 4 - legSwing * 0.3, 2, 3, legColor);
  r(-2, 6 - legSwing * 0.3, 2, 1, legDark);
  r(2, 4 + legSwing * 0.2, 2, 3, legColor);
  r(2, 6 + legSwing * 0.2, 2, 1, legDark);
  r(5, 4 - legSwing * 0.2, 2, 3, legColor);
  r(5, 6 - legSwing * 0.2, 2, 1, legDark);

  // Body — big rounded oval
  const bodyColor = 0x6ebc4e;
  const bodyDark = 0x5aa63e;
  g.rect(cx - 6, cy - 2 + bob, 12, 6).fill(bodyColor);
  g.rect(cx - 5, cy - 3 + bob, 10, 1).fill(bodyColor);
  g.rect(cx - 5, cy + 4 + bob, 10, 1).fill(bodyDark);

  // Back hump (stego's arched back)
  g.rect(cx - 4, cy - 4 + bob, 8, 2).fill(bodyColor);
  g.rect(cx - 2, cy - 5 + bob, 4, 1).fill(bodyColor);

  // Plates along the back (5 triangular plates)
  const plateColor = 0x8ad468;
  const plateDark = 0x5eaa3e;
  // Plate positions along the spine
  for (let i = 0; i < 5; i++) {
    const plateX = cx - 4 + i * 2;
    const plateY = cy - 5 + bob - (i < 2 || i > 3 ? 0 : 1);
    g.rect(plateX, plateY - 2, 2, 2).fill(plateColor);
    g.rect(plateX, plateY, 2, 1).fill(plateDark);
    // Tiny tip
    if (i === 1 || i === 2 || i === 3) {
      g.rect(plateX, plateY - 3, 1, 1).fill(plateColor);
    }
  }

  // Tail — extends behind with wag
  const tailX = f === 1 ? cx - 7 : cx + 7;
  const tw = Math.round(tailWag);
  g.rect(tailX, cy + bob + tw, 3, 2).fill(bodyColor);
  g.rect(tailX + (f === 1 ? -2 : 2), cy + 1 + bob + tw, 2, 1).fill(bodyDark);
  // Tail tip
  g.rect(tailX + (f === 1 ? -3 : 3), cy + bob + tw + 1, 2, 1).fill(bodyDark);
  // Tail spikes
  g.rect(tailX + (f === 1 ? -1 : 2), cy - 1 + bob + tw, 1, 1).fill(plateColor);
  g.rect(tailX + (f === 1 ? -2 : 3), cy + bob + tw, 1, 1).fill(plateColor);

  // Head — small, extends forward
  const headX = f === 1 ? cx + 6 : cx - 8;
  g.rect(headX, cy - 2 + bob, 3, 4).fill(bodyColor);
  g.rect(headX + (f === 1 ? 3 : -1), cy - 1 + bob, 1, 3).fill(bodyColor);
  // Snout
  g.rect(headX + (f === 1 ? 3 : -1), cy + bob, 1, 2).fill(bodyDark);

  // Eye (blinks)
  const eyeX = headX + (f === 1 ? 2 : 0);
  if (!stegoBlinking) {
    g.rect(eyeX, cy - 1 + bob, 1, 1).fill(0x2a2a2a);
  } else {
    // Closed eye — horizontal line
    g.rect(eyeX, cy - 1 + bob, 1, 1).fill(bodyDark);
  }

  // Belly highlight
  g.rect(cx - 4, cy + 2 + bob, 8, 1).fill({ color: 0x8edc5e, alpha: 0.5 });
}

function drawHighlight(g: Graphics, tx: number, tz: number): void {
  const x = tx * TILE_PX;
  const z = tz * TILE_PX;
  const tool = TOOLS[selectedTool]!.id;
  const color = tool === "hoe" ? COLORS.highlightHoe
    : tool === "water" ? COLORS.highlightWater
    : COLORS.highlightSeeds;

  // Filled tint
  g.rect(x, z, TILE_PX, TILE_PX).fill({ color, alpha: 0.18 });
  // Border
  g.rect(x, z, TILE_PX, 1).fill({ color, alpha: 0.6 });
  g.rect(x, z, 1, TILE_PX).fill({ color, alpha: 0.6 });
  g.rect(x + TILE_PX - 1, z, 1, TILE_PX).fill({ color, alpha: 0.6 });
  g.rect(x, z + TILE_PX - 1, TILE_PX, 1).fill({ color, alpha: 0.6 });
}

// ── Graphics Objects ──────────────────────────────────────
const groundGfx = new Graphics();
const objectGfx = new Graphics();
const uiGfx = new Graphics();

groundLayer.addChild(groundGfx);
objectLayer.addChild(objectGfx);
uiWorldLayer.addChild(uiGfx);

function renderWorld(): void {
  groundGfx.clear();
  objectGfx.clear();
  uiGfx.clear();

  drawIslandEdge(groundGfx);

  for (let z = 0; z < ISLAND_SIZE; z++) {
    for (let x = 0; x < ISLAND_SIZE; x++) {
      const tile = tiles[z]?.[x];
      if (!tile) continue;
      switch (tile) {
        case "grass":
          drawGrassTile(groundGfx, x, z);
          break;
        case "farmland": {
          const crop = crops.find((c) => c.x === x && c.z === z);
          drawFarmlandTile(groundGfx, x, z, crop?.watered ?? false);
          break;
        }
      }
    }
  }

  for (const crop of crops) drawCrop(objectGfx, crop);
  drawSplashes(objectGfx);
  drawStego(objectGfx);

  if (hoveredTile && hoveredTile.x >= 0 && hoveredTile.x < ISLAND_SIZE && hoveredTile.z >= 0 && hoveredTile.z < ISLAND_SIZE) {
    drawHighlight(uiGfx, hoveredTile.x, hoveredTile.z);
  }
}

function updateCamera(): void {
  const screenW = app.screen.width;
  const screenH = app.screen.height;
  // Center camera on island middle
  const centerX = (ISLAND_SIZE / 2) * TILE_PX;
  const centerZ = (ISLAND_SIZE / 2) * TILE_PX;
  world.x = screenW / 2 - centerX * RENDER_SCALE;
  world.y = screenH / 2 - centerZ * RENDER_SCALE;
  world.scale.set(RENDER_SCALE);
}

// ── Game Logic ────────────────────────────────────────────
function updateClock(dt: number): void {
  clockTime += dt * TIME_SCALE;
  if (clockTime >= WORLD_DAY_SECONDS) {
    clockTime -= WORLD_DAY_SECONDS;
    clockDay += 1;
    dawnTick();
  }
}

function dawnTick(): void {
  for (const crop of crops) {
    if (crop.watered) {
      crop.growth = Math.min(crop.growth + 1, CROP_DEFS[crop.type].growDays);
    }
    crop.watered = false;
  }
}

function getHoveredTile(): { x: number; z: number } | null {
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
function useTool(): void {
  if (gameMode !== "playing" || !hoveredTile) return;
  const { x, z } = hoveredTile;
  const tile = tiles[z]?.[x];
  if (!tile) return;
  const tool = TOOLS[selectedTool]!.id;

  switch (tool) {
    case "hoe":
      if (tile === "grass") {
        // Till grass into farmland
        tiles[z]![x] = "farmland";
      } else if (tile === "farmland") {
        // Harvest crop if ready, otherwise revert to grass
        const cropIdx = crops.findIndex((c) => c.x === x && c.z === z);
        if (cropIdx >= 0) {
          const crop = crops[cropIdx]!;
          if (crop.growth >= CROP_DEFS[crop.type].growDays) {
            crops.splice(cropIdx, 1);
            coins += 8;
          }
        } else {
          tiles[z]![x] = "grass";
        }
      }
      break;

    case "water":
      // Always splash when watering on any tile
      spawnSplash(x, z);
      if (tile === "farmland") {
        const crop = crops.find((c) => c.x === x && c.z === z);
        if (crop && !crop.watered) crop.watered = true;
      }
      break;

    case "seeds":
      if (tile === "farmland") {
        if (!crops.some((c) => c.x === x && c.z === z)) {
          crops.push({ x, z, type: "sky_wheat", growth: 0, watered: false });
        }
      }
      break;
  }

  updateHud();
}

// ── HUD ───────────────────────────────────────────────────
function updateHud(): void {
  const totalHours = clockTime / 3600;
  const hours = Math.floor(totalHours) % 24;
  const minutes = Math.floor((totalHours % 1) * 60);
  hudTime.textContent = `Day ${clockDay} \u00b7 ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  hudCoins.textContent = `Coins ${coins}`;

  toolbarEl.textContent = "";
  for (let i = 0; i < TOOL_COUNT; i++) {
    const tool = TOOLS[i]!;
    const div = document.createElement("div");
    div.className = `hotbar-slot${i === selectedTool ? " active" : ""}`;
    div.style.pointerEvents = "auto";
    div.style.cursor = "pointer";

    const keySpan = document.createElement("div");
    keySpan.className = "slot-key";
    keySpan.textContent = String(i + 1);
    div.appendChild(keySpan);

    const iconSpan = document.createElement("div");
    iconSpan.className = "slot-icon";
    iconSpan.textContent = tool.icon;
    iconSpan.style.fontSize = "18px";
    iconSpan.style.lineHeight = "1";
    iconSpan.style.padding = "2px 0";
    div.appendChild(iconSpan);

    const nameSpan = document.createElement("div");
    nameSpan.className = "slot-name";
    nameSpan.textContent = tool.label;
    div.appendChild(nameSpan);

    const idx = i;
    div.addEventListener("click", () => {
      selectedTool = idx;
      updateHud();
    });

    toolbarEl.appendChild(div);
  }
}

// ── Save / Load ───────────────────────────────────────────
function saveGame(): void {
  const data = {
    version: 2,
    clockTime,
    clockDay,
    tiles: tiles.map((row) => [...row]),
    crops: crops.map((c) => ({ ...c })),
    coins,
    selectedTool,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function loadGame(): boolean {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (data.version !== 2) return false;
    clockTime = data.clockTime ?? DAWN_SECONDS;
    clockDay = data.clockDay ?? 1;
    if (data.tiles) {
      for (let z = 0; z < ISLAND_SIZE; z++) {
        for (let x = 0; x < ISLAND_SIZE; x++) {
          tiles[z]![x] = data.tiles[z]?.[x] ?? "grass";
        }
      }
    }
    crops.length = 0;
    if (data.crops) crops.push(...data.crops);
    coins = data.coins ?? 0;
    selectedTool = data.selectedTool ?? 0;
    return true;
  } catch {
    return false;
  }
}

// ── Day/Night Overlay ─────────────────────────────────────
const nightOverlay = new Graphics();

function updateDayNight(): void {
  nightOverlay.clear();
  const hour = clockTime / 3600;
  let darkness = 0;
  if (hour < 5) darkness = 0.55;
  else if (hour < 7) darkness = 0.55 * (1 - (hour - 5) / 2);
  else if (hour < 18) darkness = 0;
  else if (hour < 20) darkness = 0.55 * ((hour - 18) / 2);
  else darkness = 0.55;

  if (darkness > 0.01) {
    nightOverlay.rect(
      -app.screen.width / RENDER_SCALE,
      -app.screen.height / RENDER_SCALE,
      app.screen.width * 2 / RENDER_SCALE,
      app.screen.height * 2 / RENDER_SCALE,
    ).fill({ color: 0x0a0820, alpha: darkness });
  }
}

// ── Input ─────────────────────────────────────────────────
function setupInput(): void {
  window.addEventListener("keydown", (e) => {
    if (gameMode !== "playing") return;
    const digit = parseInt(e.key, 10);
    if (digit >= 1 && digit <= TOOL_COUNT) {
      selectedTool = digit - 1;
      updateHud();
    }
  });

  window.addEventListener("wheel", (e) => {
    if (gameMode !== "playing") return;
    const dir = e.deltaY > 0 ? 1 : -1;
    selectedTool = ((selectedTool + dir) % TOOL_COUNT + TOOL_COUNT) % TOOL_COUNT;
    updateHud();
  });

  window.addEventListener("mousedown", (e) => {
    if (gameMode !== "playing") return;
    if (e.button === 0) {
      mouseDown = true;
      toolCooldown = 0;
      useTool();
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) mouseDown = false;
  });

  window.addEventListener("mouseleave", () => { mouseDown = false; });

  window.addEventListener("contextmenu", (e) => e.preventDefault());

  startBtn.addEventListener("click", () => {
    loadGame();
    gameMode = "playing";
    overlay.classList.add("hidden");
    overlay.classList.remove("visible");
    hud.classList.remove("hidden");
    updateHud();
  });
}

// ── Game Loop ─────────────────────────────────────────────
let saveTimer = 0;

function gameLoop(ticker: Ticker): void {
  const dt = Math.min(ticker.deltaMS / 1000, 0.05);
  if (gameMode === "playing") {
    updateClock(dt);
    updateStego(dt);
    updateSplashes(dt);

    // Hold-down continuous tool use
    if (mouseDown) {
      toolCooldown -= dt;
      if (toolCooldown <= 0) {
        toolCooldown = TOOL_HOLD_RATE;
        useTool();
      }
    }

    saveTimer += dt;
    if (saveTimer >= 30) { saveTimer = 0; saveGame(); }
    updateHud();
  }
  hoveredTile = getHoveredTile();
  updateCursor();
  renderWorld();
  updateDayNight();
  updateCamera();
}

// ── Boot ──────────────────────────────────────────────────
async function boot(): Promise<void> {
  await initPixi();
  app.stage.addChild(world);
  world.addChild(nightOverlay);
  setupInput();
  updateHud();
  app.ticker.add(gameLoop);
}

boot().catch(console.error);
