import { Application, Container, Graphics, Ticker } from "pixi.js";

// ── Types ─────────────────────────────────────────────────
type TileType = "grass" | "farmland" | "road";
type CropTypeId = "sky_wheat" | "star_berry";
type PlaceableType = "bed" | "wood_block" | "door" | "torch";
type ItemId =
  | "seed_sky_wheat"
  | "seed_star_berry"
  | "watering_can"
  | "farmland"
  | "dirt_road"
  | "bed"
  | "wood_block"
  | "door"
  | "torch"
  | "sky_wheat_crop"
  | "star_berry_crop";
type GameMode = "menu" | "playing" | "paused" | "inventory";
type InventoryTab = "inventory" | "crafting" | "shop";

interface CropState {
  id: string;
  x: number;
  z: number;
  type: CropTypeId;
  growth: number;
  watered: boolean;
}

interface PlaceableState {
  id: string;
  x: number;
  z: number;
  type: PlaceableType;
  rotation: number;
}

interface InventorySlot {
  item: ItemId | null;
  count: number;
}

interface CropDefinition {
  label: string;
  growDays: number;
  seedItem: ItemId;
  produceItem: ItemId;
}

interface BuyEntry {
  item: ItemId;
  label: string;
  cost: number;
}

interface SellEntry {
  item: ItemId;
  label: string;
  value: number;
}

interface CraftRecipe {
  id: string;
  label: string;
  ingredients: { item: ItemId; count: number }[];
  output: { item: ItemId; count: number };
}

// ── Constants ─────────────────────────────────────────────
const ISLAND_SIZE = 24;
const TILE_PX = 16;
const RENDER_SCALE = 3;
const PLAYER_SPEED = 3.2;

const WORLD_DAY_SECONDS = 86_400;
const REAL_DAY_SECONDS = 540;
const TIME_SCALE = WORLD_DAY_SECONDS / REAL_DAY_SECONDS;
const DAWN_SECONDS = 6 * 3600;
const NIGHT_SECONDS = 20 * 3600;
const SAVE_KEY = "sky_farm_save_v1";

const HOTBAR_SLOT_COUNT = 9;
const BACKPACK_SLOT_COUNT = 27;
const TOTAL_SLOT_COUNT = HOTBAR_SLOT_COUNT + BACKPACK_SLOT_COUNT;

const CROP_DEFS: Record<CropTypeId, CropDefinition> = {
  sky_wheat: { label: "Sky Wheat", growDays: 2, seedItem: "seed_sky_wheat", produceItem: "sky_wheat_crop" },
  star_berry: { label: "Star Berry", growDays: 4, seedItem: "seed_star_berry", produceItem: "star_berry_crop" },
};

const ITEM_LABEL: Record<ItemId, string> = {
  seed_sky_wheat: "Wheat Seed",
  seed_star_berry: "Berry Seed",
  watering_can: "Watering Can",
  farmland: "Farmland",
  dirt_road: "Dirt Road",
  bed: "Bed",
  wood_block: "Wood Block",
  door: "Door",
  torch: "Torch",
  sky_wheat_crop: "Sky Wheat",
  star_berry_crop: "Star Berry",
};

const BUY_ENTRIES: BuyEntry[] = [
  { item: "seed_sky_wheat", label: "Wheat Seed", cost: 4 },
  { item: "seed_star_berry", label: "Berry Seed", cost: 10 },
  { item: "bed", label: "Bed", cost: 30 },
  { item: "wood_block", label: "Wood Block", cost: 3 },
  { item: "door", label: "Door", cost: 8 },
  { item: "torch", label: "Torch", cost: 5 },
  { item: "farmland", label: "Farmland", cost: 2 },
  { item: "dirt_road", label: "Dirt Road", cost: 1 },
];

const SELL_ENTRIES: SellEntry[] = [
  { item: "sky_wheat_crop", label: "Sky Wheat", value: 8 },
  { item: "star_berry_crop", label: "Star Berry", value: 24 },
];

const CRAFT_RECIPES: CraftRecipe[] = [
  { id: "compost_farmland", label: "Compost Farmland", ingredients: [{ item: "sky_wheat_crop", count: 2 }], output: { item: "farmland", count: 1 } },
  { id: "road_bundle", label: "Road Bundle", ingredients: [{ item: "sky_wheat_crop", count: 1 }], output: { item: "dirt_road", count: 2 } },
  { id: "torch_recipe", label: "Crystal Torch", ingredients: [{ item: "wood_block", count: 1 }, { item: "star_berry_crop", count: 1 }], output: { item: "torch", count: 1 } },
  { id: "bed_recipe", label: "Cloud Bed", ingredients: [{ item: "wood_block", count: 2 }, { item: "sky_wheat_crop", count: 3 }], output: { item: "bed", count: 1 } },
];

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
  road: 0xa89e8c,
  roadLine: 0x8e8470,
  roadShadow: 0x7a7264,
  water: 0x4a8fb8,
  skinLight: 0xf0c878,
  skinMid: 0xe0b460,
  skinShadow: 0xc8984a,
  shirtBlue: 0x5a8aaa,
  shirtBlueDark: 0x4a7090,
  pantsB: 0x6a5a48,
  pantsBDark: 0x584838,
  hair: 0x8b4e20,
  hairDark: 0x6e3a16,
  eyeWhite: 0xf8f8f8,
  eyePupil: 0x2a2a3a,
  boots: 0x5a4030,
  cropGreen: 0x6ebc4e,
  cropGreenDark: 0x4e9636,
  cropYellow: 0xe0d040,
  cropBerry: 0xd64a6a,
  cropBerryDark: 0xaa3a54,
  wood: 0x9a7848,
  woodDark: 0x7a5e36,
  woodLight: 0xb08a58,
  bed: 0x7a6aba,
  bedSheet: 0xe8e0f0,
  bedPillow: 0xf0eaf8,
  door: 0x8a7048,
  doorDark: 0x6a5434,
  doorKnob: 0xd4a850,
  torchFlame: 0xffa830,
  torchFlameLight: 0xffe080,
  torchPost: 0x5a4020,
  highlight: 0xffffff,
  shadow: 0x2a2a2a,
};

// ── Seeded random ─────────────────────────────────────────
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Game State ────────────────────────────────────────────
const tiles: TileType[][] = [];
for (let z = 0; z < ISLAND_SIZE; z++) {
  const row: TileType[] = [];
  for (let x = 0; x < ISLAND_SIZE; x++) {
    row.push("grass");
  }
  tiles.push(row);
}

tiles[11]![11] = "farmland";
tiles[11]![12] = "farmland";
tiles[12]![11] = "farmland";
tiles[12]![12] = "farmland";

const crops: CropState[] = [];
const placeables: PlaceableState[] = [];
let placeableIdCounter = 0;

const slots: InventorySlot[] = [];
for (let i = 0; i < TOTAL_SLOT_COUNT; i++) {
  slots.push({ item: null, count: 0 });
}
slots[0] = { item: "seed_sky_wheat", count: 8 };
slots[1] = { item: "seed_star_berry", count: 4 };
slots[2] = { item: "watering_can", count: 1 };
slots[3] = { item: "farmland", count: 6 };

let coins = 40;
let selectedSlot = 0;
let gameMode: GameMode = "menu";
// Tracked for future save/restore of active tab
let activeTab: InventoryTab = "inventory";
void activeTab;
let clockTime = DAWN_SECONDS;
let clockDay = 1;

const player = {
  x: 12,
  z: 12,
  facing: 0,
  walkTimer: 0,
  moving: false,
};

const keys = new Set<string>();
let hoveredTile: { x: number; z: number } | null = null;

// ── DOM ───────────────────────────────────────────────────
function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing: #${id}`);
  return e as T;
}

const hud = el<HTMLDivElement>("hud");
const overlay = el<HTMLDivElement>("overlay");
const inventoryPanel = el<HTMLDivElement>("inventory-panel");
const hudTime = el<HTMLSpanElement>("hud-time");
const hudCoins = el<HTMLSpanElement>("hud-coins");
const hotbarEl = el<HTMLDivElement>("hotbar");
const startBtn = el<HTMLButtonElement>("start-btn");

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
const playerLayer = new Container();
const uiWorldLayer = new Container();

world.addChild(groundLayer);
world.addChild(objectLayer);
world.addChild(playerLayer);
world.addChild(uiWorldLayer);

// ── Drawing ───────────────────────────────────────────────
function drawGrassTile(g: Graphics, tx: number, tz: number): void {
  const rand = seededRandom(tx * 1000 + tz * 37);
  const baseColors = [COLORS.grass1, COLORS.grass2, COLORS.grass3];
  const base = baseColors[Math.floor(rand() * baseColors.length)]!;
  g.rect(tx * TILE_PX, tz * TILE_PX, TILE_PX, TILE_PX).fill(base);

  // Dithered grass texture — lighter and darker speckles
  for (let i = 0; i < 6; i++) {
    const px = Math.floor(rand() * 14) + 1;
    const pz = Math.floor(rand() * 14) + 1;
    const shade = rand() > 0.5 ? COLORS.grassLight : COLORS.grassDark;
    g.rect(tx * TILE_PX + px, tz * TILE_PX + pz, 1, 1).fill(shade);
  }

  // Grass blade tufts (2-3px tall lines)
  if (rand() < 0.4) {
    const bx = Math.floor(rand() * 10) + 3;
    const bz = Math.floor(rand() * 8) + 4;
    g.rect(tx * TILE_PX + bx, tz * TILE_PX + bz, 1, 3).fill(COLORS.grassDark);
    g.rect(tx * TILE_PX + bx + 2, tz * TILE_PX + bz + 1, 1, 2).fill(COLORS.grassDark);
  }

  // Flowers — more variety and detail
  if (rand() < 0.18) {
    const fx = Math.floor(rand() * 10) + 3;
    const fz = Math.floor(rand() * 10) + 3;
    const flowerColors = [0xf0e040, 0xe86080, 0x80b0f0, 0xf0a0d0, 0xffa060, 0xf8f8f0];
    const fc = flowerColors[Math.floor(rand() * flowerColors.length)]!;
    // Stem
    g.rect(tx * TILE_PX + fx, tz * TILE_PX + fz + 2, 1, 2).fill(COLORS.grassDark);
    // Petals (cross shape)
    g.rect(tx * TILE_PX + fx, tz * TILE_PX + fz, 1, 1).fill(fc);
    g.rect(tx * TILE_PX + fx - 1, tz * TILE_PX + fz + 1, 1, 1).fill(fc);
    g.rect(tx * TILE_PX + fx + 1, tz * TILE_PX + fz + 1, 1, 1).fill(fc);
    g.rect(tx * TILE_PX + fx, tz * TILE_PX + fz + 1, 1, 1).fill(0xf8e860); // center
  }
}

function isOnIsland(x: number, z: number): boolean {
  return x >= 0 && x < ISLAND_SIZE && z >= 0 && z < ISLAND_SIZE;
}

function drawIslandEdge(g: Graphics): void {
  // Draw cliff/edge tiles around the island perimeter
  for (let x = -1; x <= ISLAND_SIZE; x++) {
    for (let z = -1; z <= ISLAND_SIZE; z++) {
      if (isOnIsland(x, z)) continue;
      // Only draw edge tiles adjacent to the island
      const adj = isOnIsland(x + 1, z) || isOnIsland(x - 1, z) || isOnIsland(x, z + 1) || isOnIsland(x, z - 1)
        || isOnIsland(x + 1, z + 1) || isOnIsland(x - 1, z - 1) || isOnIsland(x + 1, z - 1) || isOnIsland(x - 1, z + 1);
      if (!adj) continue;

      const px = x * TILE_PX;
      const pz = z * TILE_PX;

      // Cliff face below island
      if (z >= ISLAND_SIZE || (z >= 0 && !isOnIsland(x, z))) {
        g.rect(px, pz, TILE_PX, TILE_PX).fill(COLORS.cliffFace);
        // Shadow at top of cliff
        if (isOnIsland(x, z - 1)) {
          g.rect(px, pz, TILE_PX, 3).fill(COLORS.cliffTop);
        }
        // Texture lines
        const rand = seededRandom(x * 500 + z * 77);
        for (let i = 0; i < 3; i++) {
          const lx = Math.floor(rand() * 12) + 2;
          const lz = Math.floor(rand() * 12) + 2;
          g.rect(px + lx, pz + lz, 2, 1).fill(COLORS.cliffShadow);
        }
      } else {
        // Side/top edge — grass-cliff blend
        g.rect(px, pz, TILE_PX, TILE_PX).fill(COLORS.cliffFace);
        if (isOnIsland(x, z + 1)) {
          g.rect(px, pz + TILE_PX - 3, TILE_PX, 3).fill(COLORS.cliffTop);
        }
      }
    }
  }

  // Grass lip — 1px dark edge along island perimeter
  for (let x = 0; x < ISLAND_SIZE; x++) {
    // Top edge
    if (!isOnIsland(x, -1)) g.rect(x * TILE_PX, 0, TILE_PX, 1).fill(COLORS.grassEdge);
    // Bottom edge
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

  // Tilled furrow rows with highlight/shadow
  for (let row = 2; row < TILE_PX; row += 4) {
    g.rect(tx * TILE_PX + 1, tz * TILE_PX + row, TILE_PX - 2, 1).fill(dark);
    // Light ridge above furrow
    const ridgeColor = watered ? 0x5a4430 : 0x8a6e4e;
    g.rect(tx * TILE_PX + 1, tz * TILE_PX + row - 1, TILE_PX - 2, 1).fill(ridgeColor);
  }

  // Water droplets when watered
  if (watered) {
    const rand = seededRandom(tx * 333 + tz * 19);
    for (let i = 0; i < 3; i++) {
      const dx = Math.floor(rand() * 12) + 2;
      const dz = Math.floor(rand() * 12) + 2;
      g.rect(tx * TILE_PX + dx, tz * TILE_PX + dz, 1, 1).fill(0x6aaad0);
    }
  }
}

function drawRoadTile(g: Graphics, tx: number, tz: number): void {
  g.rect(tx * TILE_PX, tz * TILE_PX, TILE_PX, TILE_PX).fill(COLORS.road);
  const rand = seededRandom(tx * 777 + tz * 13);
  for (let i = 0; i < 3; i++) {
    const px = Math.floor(rand() * 14) + 1;
    const pz = Math.floor(rand() * 14) + 1;
    g.rect(tx * TILE_PX + px, tz * TILE_PX + pz, 1, 1).fill(COLORS.roadLine);
  }
}

function drawCrop(g: Graphics, crop: CropState): void {
  const def = CROP_DEFS[crop.type];
  const progress = crop.growth / def.growDays;
  const cx = crop.x * TILE_PX;
  const cz = crop.z * TILE_PX;

  if (progress < 0.3) {
    // Seedling — tiny sprout
    g.rect(cx + 7, cz + 10, 2, 3).fill(COLORS.cropGreenDark); // stem
    g.rect(cx + 6, cz + 9, 4, 2).fill(COLORS.cropGreen); // leaves
    g.rect(cx + 7, cz + 8, 2, 1).fill(COLORS.cropGreen);
  } else if (progress < 0.7) {
    // Growing — taller with leaves
    g.rect(cx + 7, cz + 5, 2, 8).fill(COLORS.cropGreenDark);
    g.rect(cx + 4, cz + 5, 3, 3).fill(COLORS.cropGreen);
    g.rect(cx + 9, cz + 6, 3, 3).fill(COLORS.cropGreen);
    g.rect(cx + 6, cz + 8, 4, 2).fill(COLORS.cropGreen);
  } else if (progress < 1) {
    // Almost ready — full plant
    g.rect(cx + 7, cz + 3, 2, 10).fill(COLORS.cropGreenDark);
    g.rect(cx + 3, cz + 4, 4, 4).fill(COLORS.cropGreen);
    g.rect(cx + 9, cz + 3, 4, 4).fill(COLORS.cropGreen);
    g.rect(cx + 5, cz + 7, 6, 3).fill(COLORS.cropGreen);
  } else {
    // Harvestable — produce visible
    const pc = crop.type === "star_berry" ? COLORS.cropBerry : COLORS.cropYellow;
    const pcDark = crop.type === "star_berry" ? COLORS.cropBerryDark : 0xc4b030;
    g.rect(cx + 7, cz + 3, 2, 10).fill(COLORS.cropGreenDark);
    g.rect(cx + 3, cz + 4, 4, 4).fill(COLORS.cropGreen);
    g.rect(cx + 9, cz + 3, 4, 4).fill(COLORS.cropGreen);
    g.rect(cx + 5, cz + 7, 6, 3).fill(COLORS.cropGreen);
    // Fruit/grain
    g.rect(cx + 4, cz + 2, 4, 3).fill(pc);
    g.rect(cx + 5, cz + 2, 2, 1).fill(pcDark); // shadow on fruit
    g.rect(cx + 9, cz + 1, 4, 3).fill(pc);
    g.rect(cx + 10, cz + 1, 2, 1).fill(pcDark);
  }

  if (crop.watered) {
    g.rect(cx + 13, cz + 1, 2, 2).fill({ color: COLORS.water, alpha: 0.7 });
  }
}

function drawPlaceable(g: Graphics, p: PlaceableState): void {
  const px = p.x * TILE_PX;
  const pz = p.z * TILE_PX;

  switch (p.type) {
    case "wood_block":
      g.rect(px + 2, pz + 2, 12, 12).fill(COLORS.wood);
      g.rect(px + 2, pz + 2, 12, 1).fill(COLORS.woodLight); // top highlight
      g.rect(px + 2, pz + 2, 1, 12).fill(COLORS.woodLight); // left highlight
      g.rect(px + 3, pz + 5, 10, 1).fill(COLORS.woodDark); // plank line
      g.rect(px + 3, pz + 9, 10, 1).fill(COLORS.woodDark);
      g.rect(px + 13, pz + 2, 1, 12).fill(COLORS.woodDark); // right shadow
      g.rect(px + 2, pz + 13, 12, 1).fill(COLORS.woodDark); // bottom shadow
      break;
    case "bed":
      // Frame
      g.rect(px + 1, pz + 3, 14, 11).fill(COLORS.wood);
      g.rect(px + 1, pz + 3, 14, 1).fill(COLORS.woodLight);
      // Mattress
      g.rect(px + 2, pz + 4, 12, 9).fill(COLORS.bed);
      // Sheet
      g.rect(px + 2, pz + 7, 12, 5).fill(COLORS.bedSheet);
      g.rect(px + 3, pz + 8, 10, 1).fill(0xd8d0e0); // sheet fold line
      // Pillow
      g.rect(px + 3, pz + 4, 10, 3).fill(COLORS.bedPillow);
      g.rect(px + 4, pz + 5, 8, 1).fill(0xe0d8ea); // pillow shadow
      break;
    case "door":
      g.rect(px + 4, pz + 1, 8, 14).fill(COLORS.door);
      g.rect(px + 4, pz + 1, 8, 1).fill(COLORS.woodLight); // top frame
      g.rect(px + 4, pz + 1, 1, 14).fill(COLORS.woodLight); // left frame
      // Panels
      g.rect(px + 6, pz + 3, 5, 4).fill(COLORS.doorDark);
      g.rect(px + 6, pz + 9, 5, 4).fill(COLORS.doorDark);
      // Knob
      g.rect(px + 10, pz + 8, 2, 2).fill(COLORS.doorKnob);
      g.rect(px + 10, pz + 8, 1, 1).fill(0xe8c060); // knob shine
      break;
    case "torch":
      // Glow
      g.rect(px + 4, pz + 1, 8, 8).fill({ color: COLORS.torchFlame, alpha: 0.1 });
      // Post
      g.rect(px + 7, pz + 6, 2, 8).fill(COLORS.torchPost);
      g.rect(px + 7, pz + 6, 1, 8).fill(0x6a5030); // post highlight
      // Flame
      g.rect(px + 6, pz + 3, 4, 4).fill(COLORS.torchFlame);
      g.rect(px + 7, pz + 2, 2, 2).fill(COLORS.torchFlameLight);
      g.rect(px + 7, pz + 1, 1, 1).fill({ color: 0xfff0c0, alpha: 0.6 }); // flame tip
      break;
  }
}

function drawPlayer(g: Graphics): void {
  const px = player.x * TILE_PX;
  const pz = player.z * TILE_PX;
  const bob = player.moving ? Math.sin(player.walkTimer * 8) * 0.5 : 0;
  const legSwing = player.moving ? Math.sin(player.walkTimer * 10) * 1.2 : 0;

  // Shadow
  g.ellipse(px + 8, pz + 15, 5, 2).fill({ color: 0x000000, alpha: 0.22 });

  // Boots
  g.rect(px + 5, pz + 13 + bob + legSwing * 0.3, 3, 2).fill(COLORS.boots);
  g.rect(px + 9, pz + 13 + bob - legSwing * 0.3, 3, 2).fill(COLORS.boots);

  // Pants
  g.rect(px + 5, pz + 11 + bob, 3, 3).fill(COLORS.pantsB);
  g.rect(px + 9, pz + 11 + bob, 3, 3).fill(COLORS.pantsB);
  // Pants shadow between legs
  g.rect(px + 8, pz + 11 + bob, 1, 2).fill(COLORS.pantsBDark);

  // Shirt / body
  g.rect(px + 4, pz + 5 + bob, 9, 6).fill(COLORS.shirtBlue);
  // Shirt shadow on sides
  g.rect(px + 4, pz + 5 + bob, 1, 6).fill(COLORS.shirtBlueDark);
  g.rect(px + 12, pz + 5 + bob, 1, 6).fill(COLORS.shirtBlueDark);
  // Shirt collar highlight
  g.rect(px + 6, pz + 5 + bob, 5, 1).fill(0x6a9aba);

  // Arms
  g.rect(px + 3, pz + 6 + bob, 1, 4).fill(COLORS.skinMid);
  g.rect(px + 13, pz + 6 + bob, 1, 4).fill(COLORS.skinMid);

  // Head
  g.rect(px + 5, pz + 1 + bob, 7, 5).fill(COLORS.skinLight);
  // Skin shadow on sides of face
  g.rect(px + 5, pz + 1 + bob, 1, 5).fill(COLORS.skinMid);
  g.rect(px + 11, pz + 1 + bob, 1, 5).fill(COLORS.skinMid);
  // Chin
  g.rect(px + 6, pz + 5 + bob, 5, 1).fill(COLORS.skinShadow);

  // Hair
  if (player.facing === 2) {
    // Back view — full hair
    g.rect(px + 4, pz + 0 + bob, 9, 4).fill(COLORS.hair);
    g.rect(px + 5, pz + 4 + bob, 7, 1).fill(COLORS.hairDark);
  } else {
    // Front/side — top hair
    g.rect(px + 5, pz + 0 + bob, 7, 2).fill(COLORS.hair);
    g.rect(px + 4, pz + 0 + bob, 1, 3).fill(COLORS.hair); // side tuft left
    g.rect(px + 12, pz + 0 + bob, 1, 3).fill(COLORS.hair); // side tuft right
    g.rect(px + 5, pz + 0 + bob, 7, 1).fill(COLORS.hairDark); // hair shadow line
  }

  // Eyes
  if (player.facing !== 2) {
    const eyeY = pz + 3 + bob;
    if (player.facing === 0) {
      // Facing down — both eyes
      g.rect(px + 6, eyeY, 2, 1).fill(COLORS.eyeWhite);
      g.rect(px + 9, eyeY, 2, 1).fill(COLORS.eyeWhite);
      g.rect(px + 6, eyeY, 1, 1).fill(COLORS.eyePupil);
      g.rect(px + 9, eyeY, 1, 1).fill(COLORS.eyePupil);
    } else if (player.facing === 1) {
      // Facing left
      g.rect(px + 5, eyeY, 2, 1).fill(COLORS.eyeWhite);
      g.rect(px + 5, eyeY, 1, 1).fill(COLORS.eyePupil);
    } else {
      // Facing right
      g.rect(px + 10, eyeY, 2, 1).fill(COLORS.eyeWhite);
      g.rect(px + 11, eyeY, 1, 1).fill(COLORS.eyePupil);
    }
  }
}

function drawHighlight(g: Graphics, tx: number, tz: number): void {
  const x = tx * TILE_PX;
  const z = tz * TILE_PX;
  g.rect(x, z, TILE_PX, 1).fill({ color: COLORS.highlight, alpha: 0.5 });
  g.rect(x, z, 1, TILE_PX).fill({ color: COLORS.highlight, alpha: 0.5 });
  g.rect(x + TILE_PX - 1, z, 1, TILE_PX).fill({ color: COLORS.highlight, alpha: 0.5 });
  g.rect(x, z + TILE_PX - 1, TILE_PX, 1).fill({ color: COLORS.highlight, alpha: 0.5 });
}

// ── Graphics Objects ──────────────────────────────────────
const groundGfx = new Graphics();
const objectGfx = new Graphics();
const playerGfx = new Graphics();
const uiGfx = new Graphics();

groundLayer.addChild(groundGfx);
objectLayer.addChild(objectGfx);
playerLayer.addChild(playerGfx);
uiWorldLayer.addChild(uiGfx);

function renderWorld(): void {
  groundGfx.clear();
  objectGfx.clear();
  playerGfx.clear();
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
        case "road":
          drawRoadTile(groundGfx, x, z);
          break;
      }
    }
  }

  for (const crop of crops) drawCrop(objectGfx, crop);
  for (const p of placeables) drawPlaceable(objectGfx, p);
  drawPlayer(playerGfx);

  if (hoveredTile && hoveredTile.x >= 0 && hoveredTile.x < ISLAND_SIZE && hoveredTile.z >= 0 && hoveredTile.z < ISLAND_SIZE) {
    drawHighlight(uiGfx, hoveredTile.x, hoveredTile.z);
  }
}

function updateCamera(): void {
  const screenW = app.screen.width;
  const screenH = app.screen.height;
  world.x = screenW / 2 - player.x * TILE_PX * RENDER_SCALE;
  world.y = screenH / 2 - player.z * TILE_PX * RENDER_SCALE;
  world.scale.set(RENDER_SCALE);
}

// ── Game Logic ────────────────────────────────────────────
function updatePlayer(dt: number): void {
  let dx = 0;
  let dz = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) dz -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) dz += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;

  player.moving = dx !== 0 || dz !== 0;

  if (player.moving) {
    const len = Math.sqrt(dx * dx + dz * dz);
    dx /= len;
    dz /= len;
    player.x += dx * PLAYER_SPEED * dt;
    player.z += dz * PLAYER_SPEED * dt;
    player.x = Math.max(0.5, Math.min(ISLAND_SIZE - 0.5, player.x));
    player.z = Math.max(0.5, Math.min(ISLAND_SIZE - 0.5, player.z));

    if (Math.abs(dx) > Math.abs(dz)) {
      player.facing = dx < 0 ? 1 : 3;
    } else {
      player.facing = dz < 0 ? 2 : 0;
    }
    player.walkTimer += dt;
  }
}

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

// ── Interactions ──────────────────────────────────────────
function getSelectedItem(): ItemId | null {
  return slots[selectedSlot]?.item ?? null;
}

function removeFromSlot(slotIndex: number, count = 1): void {
  const slot = slots[slotIndex];
  if (!slot || !slot.item) return;
  slot.count -= count;
  if (slot.count <= 0) { slot.item = null; slot.count = 0; }
}

function addToInventory(item: ItemId, count = 1): boolean {
  for (const slot of slots) {
    if (slot.item === item) { slot.count += count; return true; }
  }
  for (const slot of slots) {
    if (!slot.item) { slot.item = item; slot.count = count; return true; }
  }
  return false;
}

function countItem(item: ItemId): number {
  let total = 0;
  for (const slot of slots) if (slot.item === item) total += slot.count;
  return total;
}

function removeItem(item: ItemId, count: number): void {
  let remaining = count;
  for (const slot of slots) {
    if (slot.item === item && remaining > 0) {
      const take = Math.min(slot.count, remaining);
      slot.count -= take;
      remaining -= take;
      if (slot.count <= 0) { slot.item = null; slot.count = 0; }
    }
  }
}

function handleLeftClick(): void {
  if (gameMode !== "playing" || !hoveredTile) return;
  const { x, z } = hoveredTile;

  const cropIdx = crops.findIndex((c) => c.x === x && c.z === z);
  if (cropIdx >= 0) {
    const crop = crops[cropIdx]!;
    const def = CROP_DEFS[crop.type];
    if (crop.growth >= def.growDays) {
      addToInventory(def.produceItem, 1);
      crops.splice(cropIdx, 1);
      return;
    }
  }

  const placeIdx = placeables.findIndex((p) => p.x === x && p.z === z);
  if (placeIdx >= 0) {
    const p = placeables[placeIdx]!;
    addToInventory(p.type, 1);
    placeables.splice(placeIdx, 1);
    return;
  }

  const tile = tiles[z]?.[x];
  if (tile === "farmland" || tile === "road") {
    if (!crops.some((c) => c.x === x && c.z === z)) {
      tiles[z]![x] = "grass";
      addToInventory(tile === "farmland" ? "farmland" : "dirt_road", 1);
    }
  }
}

function handleRightClick(): void {
  if (gameMode !== "playing" || !hoveredTile) return;
  const { x, z } = hoveredTile;
  const tile = tiles[z]?.[x];
  const item = getSelectedItem();
  if (!tile || !item) return;

  if ((item === "seed_sky_wheat" || item === "seed_star_berry") && tile === "farmland") {
    if (!crops.some((c) => c.x === x && c.z === z)) {
      const cropType: CropTypeId = item === "seed_sky_wheat" ? "sky_wheat" : "star_berry";
      crops.push({ id: `crop_${Date.now()}`, x, z, type: cropType, growth: 0, watered: false });
      removeFromSlot(selectedSlot);
      return;
    }
  }

  if (item === "watering_can") {
    const crop = crops.find((c) => c.x === x && c.z === z);
    if (crop && !crop.watered) { crop.watered = true; return; }
  }

  if (item === "farmland" && tile === "grass") { tiles[z]![x] = "farmland"; removeFromSlot(selectedSlot); return; }
  if (item === "dirt_road" && tile === "grass") { tiles[z]![x] = "road"; removeFromSlot(selectedSlot); return; }

  const placeableTypes: PlaceableType[] = ["bed", "wood_block", "door", "torch"];
  if (placeableTypes.includes(item as PlaceableType)) {
    if (!placeables.some((p) => p.x === x && p.z === z) && !crops.some((c) => c.x === x && c.z === z)) {
      placeables.push({ id: `p_${placeableIdCounter++}`, x, z, type: item as PlaceableType, rotation: player.facing });
      removeFromSlot(selectedSlot);
      return;
    }
  }

  if (placeables.some((p) => p.x === x && p.z === z && p.type === "bed")) {
    if (clockTime > NIGHT_SECONDS || clockTime < DAWN_SECONDS) {
      clockTime = DAWN_SECONDS;
      clockDay += 1;
      dawnTick();
    }
  }
}

// ── HUD ───────────────────────────────────────────────────
function updateHud(): void {
  const totalHours = clockTime / 3600;
  const hours = Math.floor(totalHours) % 24;
  const minutes = Math.floor((totalHours % 1) * 60);
  hudTime.textContent = `Day ${clockDay} \u00b7 ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  hudCoins.textContent = `Coins ${coins}`;

  hotbarEl.textContent = "";
  for (let i = 0; i < HOTBAR_SLOT_COUNT; i++) {
    const slot = slots[i]!;
    const div = document.createElement("div");
    div.className = `hotbar-slot${i === selectedSlot ? " active" : ""}`;

    const keySpan = document.createElement("div");
    keySpan.className = "slot-key";
    keySpan.textContent = String(i + 1);
    div.appendChild(keySpan);

    const nameSpan = document.createElement("div");
    nameSpan.className = "slot-name";
    nameSpan.textContent = slot.item ? ITEM_LABEL[slot.item] : "";
    div.appendChild(nameSpan);

    const countSpan = document.createElement("div");
    countSpan.className = "slot-count";
    countSpan.textContent = slot.item ? String(slot.count) : "";
    div.appendChild(countSpan);

    hotbarEl.appendChild(div);
  }
}

// ── Inventory Panel ───────────────────────────────────────
function openInventory(): void {
  gameMode = "inventory";
  inventoryPanel.classList.remove("hidden");
  inventoryPanel.classList.add("visible");
  renderInventoryPanel();
}

function closeInventory(): void {
  gameMode = "playing";
  inventoryPanel.classList.add("hidden");
  inventoryPanel.classList.remove("visible");
}

function renderInventoryPanel(): void {
  const grid = el<HTMLDivElement>("inventory-grid");
  grid.textContent = "";
  for (let i = HOTBAR_SLOT_COUNT; i < TOTAL_SLOT_COUNT; i++) {
    const slot = slots[i]!;
    const btn = document.createElement("button");
    btn.className = "inventory-slot";
    btn.textContent = slot.item ? `${ITEM_LABEL[slot.item]} (${slot.count})` : "";
    grid.appendChild(btn);
  }

  const hotbar = el<HTMLDivElement>("inventory-hotbar");
  hotbar.textContent = "";
  for (let i = 0; i < HOTBAR_SLOT_COUNT; i++) {
    const slot = slots[i]!;
    const btn = document.createElement("button");
    btn.className = `inventory-slot${i === selectedSlot ? " active" : ""}`;
    btn.textContent = slot.item ? `${ITEM_LABEL[slot.item]} (${slot.count})` : "";
    hotbar.appendChild(btn);
  }

  const craftList = el<HTMLDivElement>("craft-list");
  craftList.textContent = "";
  for (const recipe of CRAFT_RECIPES) {
    const canCraft = recipe.ingredients.every((ing) => countItem(ing.item) >= ing.count);
    const card = document.createElement("div");
    card.className = "craft-card";

    const title = document.createElement("strong");
    title.textContent = recipe.label;
    card.appendChild(title);

    const desc = document.createElement("span");
    desc.className = "hint";
    desc.textContent = " — " + recipe.ingredients.map((ing) => `${ITEM_LABEL[ing.item]} x${ing.count}`).join(", ");
    card.appendChild(desc);

    const btn = document.createElement("button");
    btn.textContent = canCraft ? "Craft" : "Need materials";
    btn.disabled = !canCraft;
    btn.addEventListener("click", () => {
      for (const ing of recipe.ingredients) removeItem(ing.item, ing.count);
      addToInventory(recipe.output.item, recipe.output.count);
      renderInventoryPanel();
      updateHud();
    });
    card.appendChild(btn);
    craftList.appendChild(card);
  }

  const buyGrid = el<HTMLDivElement>("shop-buy");
  buyGrid.textContent = "";
  for (const entry of BUY_ENTRIES) {
    const card = document.createElement("div");
    card.className = "craft-card";
    const label = document.createElement("strong");
    label.textContent = `${entry.label} — ${entry.cost} coins`;
    card.appendChild(label);
    const btn = document.createElement("button");
    btn.textContent = coins >= entry.cost ? "Buy" : "Can't afford";
    btn.disabled = coins < entry.cost;
    btn.addEventListener("click", () => {
      if (coins < entry.cost) return;
      coins -= entry.cost;
      addToInventory(entry.item, 1);
      renderInventoryPanel();
      updateHud();
    });
    card.appendChild(btn);
    buyGrid.appendChild(card);
  }

  const sellGrid = el<HTMLDivElement>("shop-sell");
  sellGrid.textContent = "";
  for (const entry of SELL_ENTRIES) {
    const has = countItem(entry.item);
    const card = document.createElement("div");
    card.className = "craft-card";
    const label = document.createElement("strong");
    label.textContent = `${entry.label} — ${entry.value} coins (have ${has})`;
    card.appendChild(label);
    const btn = document.createElement("button");
    btn.textContent = has > 0 ? "Sell" : "None";
    btn.disabled = has <= 0;
    btn.addEventListener("click", () => {
      if (countItem(entry.item) <= 0) return;
      removeItem(entry.item, 1);
      coins += entry.value;
      renderInventoryPanel();
      updateHud();
    });
    card.appendChild(btn);
    sellGrid.appendChild(card);
  }
}

function setupTabs(): void {
  const tabs = [
    { id: "tab-inventory", contentId: "tab-content-inventory", tab: "inventory" as InventoryTab },
    { id: "tab-crafting", contentId: "tab-content-crafting", tab: "crafting" as InventoryTab },
    { id: "tab-shop", contentId: "tab-content-shop", tab: "shop" as InventoryTab },
  ];
  for (const t of tabs) {
    el(t.id).addEventListener("click", () => {
      activeTab = t.tab;
      for (const other of tabs) {
        el(other.id).classList.toggle("active", other.id === t.id);
        el(other.contentId).classList.toggle("hidden", other.id !== t.id);
        el(other.contentId).classList.toggle("visible", other.id === t.id);
      }
      renderInventoryPanel();
    });
  }
}

// ── Save / Load ───────────────────────────────────────────
function saveGame(): void {
  const data = {
    version: 1,
    clockTime,
    clockDay,
    player: { x: player.x, z: player.z, facing: player.facing },
    tiles: tiles.map((row) => [...row]),
    crops: crops.map((c) => ({ ...c })),
    placeables: placeables.map((p) => ({ ...p })),
    slots: slots.map((s) => ({ ...s })),
    coins,
    selectedSlot,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function loadGame(): boolean {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    clockTime = data.clockTime ?? DAWN_SECONDS;
    clockDay = data.clockDay ?? 1;
    player.x = data.player?.x ?? 12;
    player.z = data.player?.z ?? 12;
    player.facing = data.player?.facing ?? 0;
    if (data.tiles) {
      for (let z = 0; z < ISLAND_SIZE; z++) {
        for (let x = 0; x < ISLAND_SIZE; x++) {
          tiles[z]![x] = data.tiles[z]?.[x] ?? "grass";
        }
      }
    }
    crops.length = 0;
    if (data.crops) crops.push(...data.crops);
    placeables.length = 0;
    if (data.placeables) placeables.push(...data.placeables);
    if (data.slots) {
      for (let i = 0; i < TOTAL_SLOT_COUNT; i++) {
        const s = data.slots[i];
        slots[i] = s ? { item: s.item, count: s.count } : { item: null, count: 0 };
      }
    }
    coins = data.coins ?? 40;
    selectedSlot = data.selectedSlot ?? 0;
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
    keys.add(e.code);
    if (e.code === "Escape" && gameMode === "inventory") { closeInventory(); e.preventDefault(); }
    if (e.code === "KeyE") {
      if (gameMode === "playing") openInventory();
      else if (gameMode === "inventory") closeInventory();
      e.preventDefault();
    }
    if (gameMode === "playing" || gameMode === "inventory") {
      const digit = parseInt(e.key, 10);
      if (digit >= 1 && digit <= 9) { selectedSlot = digit - 1; updateHud(); }
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => keys.clear());
  window.addEventListener("wheel", (e) => {
    if (gameMode !== "playing") return;
    const dir = e.deltaY > 0 ? 1 : -1;
    selectedSlot = ((selectedSlot + dir) % HOTBAR_SLOT_COUNT + HOTBAR_SLOT_COUNT) % HOTBAR_SLOT_COUNT;
    updateHud();
  });
  window.addEventListener("mousedown", (e) => {
    if (gameMode !== "playing") return;
    if (e.button === 0) handleLeftClick();
    if (e.button === 2) handleRightClick();
  });
  window.addEventListener("contextmenu", (e) => e.preventDefault());
  startBtn.addEventListener("click", () => {
    loadGame();
    gameMode = "playing";
    overlay.classList.add("hidden");
    overlay.classList.remove("visible");
    hud.classList.remove("hidden");
    updateHud();
  });
  el("inventory-close").addEventListener("click", () => closeInventory());
}

// ── Game Loop ─────────────────────────────────────────────
let saveTimer = 0;

function gameLoop(ticker: Ticker): void {
  const dt = Math.min(ticker.deltaMS / 1000, 0.05);
  if (gameMode === "playing") {
    updatePlayer(dt);
    updateClock(dt);
    saveTimer += dt;
    if (saveTimer >= 30) { saveTimer = 0; saveGame(); }
    updateHud();
  }
  hoveredTile = getHoveredTile();
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
  setupTabs();
  updateHud();
  app.ticker.add(gameLoop);
}

boot().catch(console.error);
