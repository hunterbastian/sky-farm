import {
  ISLAND_SIZE, TILE_PX, PEN, CHICKEN_COUNT, DAWN_SECONDS, BEE_SPECIES,
} from "./constants";
import type {
  TileType, CropState, TreeState, MapleTree, MapleLeafParticle,
  Chicken, Bee, BeeSpecies, Hive, HoneyDrop, Egg, Wildflower,
  FloatingText, CloudShadow, Splash, DirtPuff, SeedPop, HarvestPart,
  WoodChip, Sparkle, Mote, Butterfly, LeafParticle, SkyCloud,
} from "./types";

// ── Tile Grid ─────────────────────────────────────────────
export const tiles: TileType[][] = [];
for (let z = 0; z < ISLAND_SIZE; z++) {
  const row: TileType[] = [];
  for (let x = 0; x < ISLAND_SIZE; x++) row.push("grass");
  tiles.push(row);
}

// ── Crops ─────────────────────────────────────────────────
export const crops: CropState[] = [];

// ── Trees ─────────────────────────────────────────────────
export const trees: TreeState[] = [
  { x: 19, z: 5, chopTime: 0, regrowTimer: 0, variant: 1, falling: false, fallAngle: 0, fallDir: 1 },
  { x: 20, z: 9, chopTime: 0, regrowTimer: 0, variant: 2, falling: false, fallAngle: 0, fallDir: -1 },
  { x: 18, z: 13, chopTime: 0, regrowTimer: 0, variant: 3, falling: false, fallAngle: 0, fallDir: 1 },
];

// ── Maple Trees ───────────────────────────────────────────
export const mapleTrees: MapleTree[] = [
  { x: 3, z: 4, variant: 1, chopTime: 0, regrowTimer: 0, falling: false, fallAngle: 0, fallDir: 1 },
  { x: 5, z: 16, variant: 2, chopTime: 0, regrowTimer: 0, falling: false, fallAngle: 0, fallDir: -1 },
];

// ── Maple Leaves ──────────────────────────────────────────
export const mapleLeaves: MapleLeafParticle[] = [];
export let mapleSpawnTimer = 0;
export function setMapleSpawnTimer(v: number): void { mapleSpawnTimer = v; }

// ── Chickens ──────────────────────────────────────────────
export const chickens: Chicken[] = [];
for (let i = 0; i < CHICKEN_COUNT; i++) {
  chickens.push({
    x: PEN.x1 + 0.5 + Math.random() * (PEN.x2 - PEN.x1),
    z: PEN.z1 + 0.5 + Math.random() * (PEN.z2 - PEN.z1),
    targetX: (PEN.x1 + PEN.x2) / 2, targetZ: (PEN.z1 + PEN.z2) / 2,
    facing: Math.random() > 0.5 ? 1 : -1,
    walkTimer: 0, idleTimer: 2 + Math.random() * 3,
    state: "idle",
    idleAnim: "peck", idleAnimTimer: 1,
    peckPhase: 0, rufflePhase: 0, lookDir: 0,
    blinkTimer: 2 + Math.random() * 3, blinking: false,
    variant: i,
  });
}

// ── Eggs ──────────────────────────────────────────────────
export const eggs: Egg[] = [];
export let eggTimer = 8 + Math.random() * 15;
export function setEggTimer(v: number): void { eggTimer = v; }

// ── Bees & Hives ─────────────────────────────────────────
function makeBees(species: BeeSpecies, count: number): Bee[] {
  const def = BEE_SPECIES[species];
  const out: Bee[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      angle: Math.random() * Math.PI * 2,
      radius: 6 + Math.random() * 8,
      speed: def.speed[0] + Math.random() * (def.speed[1] - def.speed[0]),
      zOff: 0,
      phase: Math.random() * Math.PI * 2,
      species,
      mode: "orbiting",
      forageCooldown: 5 + Math.random() * 15,
      targetFlower: null,
      worldX: 0, worldZ: 0,
      startX: 0, startZ: 0,
      flightProgress: 0,
      flowerTime: 0,
      hasPollen: false,
    });
  }
  return out;
}

export const hives: Hive[] = [
  { treeIndex: 0, species: "mason", bees: makeBees("mason", 4), honeyTimer: 15 + Math.random() * 10 },
  { treeIndex: 1, species: "honeybee", bees: makeBees("honeybee", 5), honeyTimer: 10 + Math.random() * 10 },
  { treeIndex: 2, species: "bumblebee", bees: makeBees("bumblebee", 3), honeyTimer: 20 + Math.random() * 10 },
];

export const honeyDrops: HoneyDrop[] = [];

// ── Wildflowers ───────────────────────────────────────────
export const wildflowers: Wildflower[] = [];
export let wildflowersInitialized = false;
export function setWildflowersInitialized(v: boolean): void { wildflowersInitialized = v; }

// ── Cloud Shadows ─────────────────────────────────────────
export const cloudShadows: CloudShadow[] = [];
for (let i = 0; i < 3; i++) {
  cloudShadows.push({
    x: Math.random() * ISLAND_SIZE * TILE_PX,
    z: Math.random() * ISLAND_SIZE * TILE_PX,
    w: 40 + Math.random() * 60,
    h: 20 + Math.random() * 30,
    speed: 3 + Math.random() * 4,
  });
}

// ── Floating Texts ────────────────────────────────────────
export const floatingTexts: FloatingText[] = [];

// ── Particles ─────────────────────────────────────────────
export const splashes: Splash[] = [];
export const dirtPuffs: DirtPuff[] = [];
export const seedPops: SeedPop[] = [];
export const harvestParts: HarvestPart[] = [];
export const woodChips: WoodChip[] = [];
export const sparkles: Sparkle[] = [];
export const leafParticles: LeafParticle[] = [];
export let leafSpawnTimer = 0;
export function setLeafSpawnTimer(v: number): void { leafSpawnTimer = v; }

// ── Motes ─────────────────────────────────────────────────
export const motes: Mote[] = [];
for (let i = 0; i < 20; i++) {
  motes.push({
    x: Math.random() * ISLAND_SIZE * TILE_PX,
    z: Math.random() * ISLAND_SIZE * TILE_PX,
    speed: 2 + Math.random() * 4,
    drift: Math.random() * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,
    size: 1,
    alpha: 0.15 + Math.random() * 0.25,
  });
}

// ── Butterflies ───────────────────────────────────────────
export const butterflies: Butterfly[] = [];
const butterflyColors = [0xf0e040, 0xe86080, 0x80b0f0, 0xf0a0d0, 0xffa060, 0xf8f8f0];
for (let i = 0; i < 4; i++) {
  const x = 4 + Math.random() * (ISLAND_SIZE - 8);
  const z = 4 + Math.random() * (ISLAND_SIZE - 8);
  butterflies.push({
    x: x * TILE_PX, z: z * TILE_PX,
    tx: x * TILE_PX, tz: z * TILE_PX,
    color: butterflyColors[Math.floor(Math.random() * butterflyColors.length)]!,
    wingPhase: Math.random() * Math.PI * 2,
    speed: 15 + Math.random() * 10,
    idleTimer: 1 + Math.random() * 3,
  });
}

// ── Sky Clouds ────────────────────────────────────────────
export const skyClouds: SkyCloud[] = [];
for (let i = 0; i < 14; i++) {
  skyClouds.push({
    x: Math.random() * 2000 - 500,
    y: Math.random() * 800,
    w: 60 + Math.random() * 120,
    h: 12 + Math.random() * 18,
    speed: 3 + Math.random() * 6,
    alpha: 0.35 + Math.random() * 0.3,
  });
}

// ── Scalar Game State ─────────────────────────────────────
export let coins = 0;
export function setCoins(v: number): void { coins = v; }
export function addCoins(v: number): void { coins += v; }

export let wood = 0;
export function setWood(v: number): void { wood = v; }
export function addWood(v: number): void { wood += v; }

export let selectedTool = 0;
export function setSelectedTool(v: number): void { selectedTool = v; }

export let selectedSeed = 0;
export function setSelectedSeed(v: number): void { selectedSeed = v; }

export let gameMode: "menu" | "playing" = "menu";
export function setGameMode(v: "menu" | "playing"): void { gameMode = v; }

export let clockTime = DAWN_SECONDS;
export function setClockTime(v: number): void { clockTime = v; }

export let clockDay = 1;
export function setClockDay(v: number): void { clockDay = v; }

export let hoveredTile: { x: number; z: number } | null = null;
export function setHoveredTile(v: { x: number; z: number } | null): void { hoveredTile = v; }

export let mouseDown = false;
export function setMouseDown(v: boolean): void { mouseDown = v; }

export let toolCooldown = 0;
export function setToolCooldown(v: number): void { toolCooldown = v; }

// ── Auto-Farm Timers ──────────────────────────────────────
export let autoWaterTimer = 0;
export function setAutoWaterTimer(v: number): void { autoWaterTimer = v; }

export let autoHarvestTimer = 0;
export function setAutoHarvestTimer(v: number): void { autoHarvestTimer = v; }

// ── Chop Swing ────────────────────────────────────────────
export let chopSwingTimer = 0;
export function setChopSwingTimer(v: number): void { chopSwingTimer = v; }

// ── Screen Shake ──────────────────────────────────────────
export let shakeIntensity = 0;
export function setShakeIntensity(v: number): void { shakeIntensity = v; }
export const shakeDecay = 0.9;
export let shakeOffX = 0;
export function setShakeOffX(v: number): void { shakeOffX = v; }
export let shakeOffY = 0;
export function setShakeOffY(v: number): void { shakeOffY = v; }
