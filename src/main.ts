import { Application, Container, Graphics, Ticker } from "pixi.js";

// ── Types ─────────────────────────────────────────────────
type TileType = "grass" | "farmland";
type CropTypeId = "sky_wheat" | "star_berry" | "cloud_pumpkin" | "moon_flower";
type ToolId = "hoe" | "water" | "seeds" | "axe";

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
  sellPrice: number;
  icon: string;
}

// ── Constants ─────────────────────────────────────────────
const ISLAND_SIZE = 24;
const TILE_PX = 16;
const RENDER_SCALE = 3;
const TOOL_COUNT = 4;

// Day cycle: 3.5 min total (3 min day + 30s night)
// We map 24 game-hours onto 210 real seconds
// Dawn 5-7, Day 7-18, Sunset 18-20, Night 20-5
const WORLD_DAY_SECONDS = 86_400;
const REAL_CYCLE_SECONDS = 210; // 3.5 minutes real time per full day
const TIME_SCALE = WORLD_DAY_SECONDS / REAL_CYCLE_SECONDS;
const DAWN_SECONDS = 9 * 3600; // spawn at 9 AM (clear day)
const SAVE_KEY = "sky_farm_save_v2";

const TOOLS: { id: ToolId; label: string; icon: string }[] = [
  { id: "hoe", label: "Hoe", icon: "⛏" },
  { id: "water", label: "Water", icon: "💧" },
  { id: "seeds", label: "Seeds", icon: "🌱" },
  { id: "axe", label: "Axe", icon: "🪓" },
];

const CROP_DEFS: Record<CropTypeId, CropDefinition> = {
  sky_wheat: { label: "Sky Wheat", growDays: 3, sellPrice: 8, icon: "🌾" },
  star_berry: { label: "Star Berry", growDays: 4, sellPrice: 15, icon: "⭐" },
  cloud_pumpkin: { label: "Cloud Pumpkin", growDays: 5, sellPrice: 22, icon: "🎃" },
  moon_flower: { label: "Moon Flower", growDays: 6, sellPrice: 30, icon: "🌙" },
};
const CROP_IDS: CropTypeId[] = ["sky_wheat", "star_berry", "cloud_pumpkin", "moon_flower"];
let selectedSeed = 0;

// ── Tile Colors (Stardew-inspired) ────────────────────────
const COLORS = {
  grass1: 0x5daa3e,
  grass2: 0x4e9636,
  grass3: 0x6ebc4e,
  grass4: 0x68b845,
  grass5: 0x58a038,
  grassDark: 0x3e7e2c,
  grassLight: 0x7ecc5a,
  grassHighlight: 0x90d86a,
  grassEdge: 0x3a6e24,
  cliffTop: 0x4a6a3e,
  cliffMid: 0x364a30,
  cliffFace: 0x2a3828,
  cliffShadow: 0x1e2a1c,
  cliffDeep: 0x141e14,
  cliffMoss: 0x3a5830,
  farmland: 0x7a5e3c,
  farmlandDark: 0x5e4228,
  farmlandLight: 0x8a6e4a,
  farmlandWet: 0x4e3824,
  farmlandWetDark: 0x3a2818,
  farmlandWetSheen: 0x5a6880,
  water: 0x4a8fb8,
  cropGreen: 0x6ebc4e,
  cropGreenDark: 0x4e9636,
  cropGreenLight: 0x82d060,
  cropYellow: 0xe0d040,
  cropYellowLight: 0xf0e060,
  cropBrown: 0x8a6e40,
  highlight: 0xffffff,
  highlightHoe: 0xd4a850,
  highlightWater: 0x6aaad0,
  highlightSeeds: 0x7ecc5a,
};

// ── Trees ─────────────────────────────────────────────────
interface TreeState {
  x: number;
  z: number;
  chopTime: number; // 0 = standing, >= CHOP_HITS = chopped
  regrowTimer: number; // seconds until regrow (counts down when chopped)
  variant: number; // visual variation seed
}

const CHOP_HITS = 3;
const TREE_REGROW_SECONDS = 60;

// ── Seeded random ─────────────────────────────────────────
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Chickens ──────────────────────────────────────────────
interface Chicken {
  x: number; z: number;
  targetX: number; targetZ: number;
  facing: number; // -1 left, 1 right
  walkTimer: number;
  idleTimer: number;
  state: "idle" | "walking";
  idleAnim: "peck" | "ruffle" | "look" | "sit";
  idleAnimTimer: number;
  peckPhase: number;
  rufflePhase: number;
  lookDir: number;
  blinkTimer: number;
  blinking: boolean;
  variant: number; // color variant
}

// Chicken pen bounds (tile coordinates, inclusive)
const PEN = { x1: 8, z1: 2, x2: 13, z2: 6 };

const CHICKEN_COUNT = 4;
const CHICKEN_SPEED = 0.8;
const chickens: Chicken[] = [];
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

function pickChickenTarget(c: Chicken): void {
  // Stay inside pen
  c.targetX = PEN.x1 + 0.5 + Math.random() * (PEN.x2 - PEN.x1);
  c.targetZ = PEN.z1 + 0.5 + Math.random() * (PEN.z2 - PEN.z1);
  c.state = "walking";
}

function isPenTile(x: number, z: number): boolean {
  return x >= PEN.x1 && x <= PEN.x2 && z >= PEN.z1 && z <= PEN.z2;
}

function drawChickenPen(g: Graphics): void {
  const x1 = PEN.x1 * TILE_PX;
  const z1 = PEN.z1 * TILE_PX;
  const x2 = (PEN.x2 + 1) * TILE_PX;
  const z2 = (PEN.z2 + 1) * TILE_PX;
  const postC = 0x6a4830;
  const postH = 0x8a6a4a;
  const railC = 0x7a5838;
  const railL = 0x9a7a50;

  // Dirt/straw ground inside pen
  for (let pz = PEN.z1; pz <= PEN.z2; pz++) {
    for (let px = PEN.x1; px <= PEN.x2; px++) {
      const tx = px * TILE_PX;
      const tz = pz * TILE_PX;
      // Sandy dirt base
      g.rect(tx, tz, TILE_PX, TILE_PX).fill(0x9a8a60);
      // Straw/dirt texture
      const r = seededRandom(px * 100 + pz * 37 + 999);
      for (let s = 0; s < 4; s++) {
        const sx = Math.floor(r() * 14);
        const sz = Math.floor(r() * 14);
        g.rect(tx + sx, tz + sz, 2, 1).fill({ color: 0xb0a060, alpha: 0.4 });
      }
      for (let s = 0; s < 3; s++) {
        const sx = Math.floor(r() * 14);
        const sz = Math.floor(r() * 14);
        g.rect(tx + sx, tz + sz, 1, 1).fill({ color: 0x887848, alpha: 0.3 });
      }
    }
  }

  // Fence posts at corners and every 2 tiles along edges
  const drawPost = (px: number, pz: number) => {
    g.rect(px - 1, pz - 6, 3, 7).fill(postC);
    g.rect(px, pz - 6, 1, 7).fill(postH);
    g.rect(px - 1, pz - 6, 3, 1).fill(postH); // cap
  };

  // Top rail (horizontal)
  g.rect(x1 + 1, z1 - 3, x2 - x1 - 2, 2).fill(railC);
  g.rect(x1 + 1, z1 - 3, x2 - x1 - 2, 1).fill(railL);
  // Bottom rail
  g.rect(x1 + 1, z2 - 3, x2 - x1 - 2, 2).fill(railC);
  g.rect(x1 + 1, z2 - 3, x2 - x1 - 2, 1).fill(railL);
  // Left rail (vertical)
  g.rect(x1, z1 - 2, 2, z2 - z1 + 1).fill(railC);
  g.rect(x1, z1 - 2, 1, z2 - z1 + 1).fill(railL);
  // Right rail
  g.rect(x2 - 1, z1 - 2, 2, z2 - z1 + 1).fill(railC);
  g.rect(x2 - 1, z1 - 2, 1, z2 - z1 + 1).fill(railL);

  // Posts at corners
  drawPost(x1, z1);
  drawPost(x2, z1);
  drawPost(x1, z2);
  drawPost(x2, z2);
  // Mid-posts on long edges
  const midX = Math.round((x1 + x2) / 2);
  const midZ = Math.round((z1 + z2) / 2);
  drawPost(midX, z1);
  drawPost(midX, z2);
  drawPost(x1, midZ);
  drawPost(x2, midZ);

  // Gate opening on the bottom edge (small gap)
  const gateX = midX - 6;
  g.rect(gateX, z2 - 4, 12, 5).fill(0x9a8a60); // cover the rail where gate is
  // Gate posts
  drawPost(gateX, z2);
  drawPost(gateX + 12, z2);

  // Feeding trough inside pen
  const troughX = (PEN.x1 + 1) * TILE_PX + 2;
  const troughZ = (PEN.z1 + 1) * TILE_PX;
  g.rect(troughX, troughZ, 8, 3).fill(0x6a4830);
  g.rect(troughX, troughZ, 8, 1).fill(0x8a6a4a);
  g.rect(troughX + 1, troughZ + 1, 6, 1).fill(0xc4a840); // grain inside
  g.rect(troughX + 2, troughZ + 1, 2, 1).fill({ color: 0xe0c860, alpha: 0.5 });

  // Hay bale in corner
  const hayX = (PEN.x2) * TILE_PX + 2;
  const hayZ = (PEN.z1) * TILE_PX + 4;
  g.rect(hayX, hayZ, 6, 5).fill(0xc4a848);
  g.rect(hayX, hayZ, 6, 1).fill(0xd4b858);
  g.rect(hayX + 1, hayZ + 1, 4, 1).fill(0xb09838);
  g.rect(hayX + 1, hayZ + 3, 4, 1).fill(0xb09838);
}

function pickChickenIdle(c: Chicken): void {
  const anims: Chicken["idleAnim"][] = ["peck", "ruffle", "look", "sit"];
  c.idleAnim = anims[Math.floor(Math.random() * anims.length)]!;
  c.idleAnimTimer = 1 + Math.random() * 2;
  if (c.idleAnim === "look") c.lookDir = Math.random() > 0.5 ? 1 : -1;
}

function updateChickens(dt: number): void {
  for (const c of chickens) {
    c.blinkTimer -= dt;
    if (c.blinkTimer <= 0) {
      c.blinking = !c.blinking;
      c.blinkTimer = c.blinking ? 0.12 : 1.5 + Math.random() * 2;
    }

    if (c.state === "idle") {
      c.idleTimer -= dt;
      c.idleAnimTimer -= dt;
      if (c.idleAnimTimer <= 0) pickChickenIdle(c);
      if (c.idleAnim === "peck") c.peckPhase += dt * 6;
      if (c.idleAnim === "ruffle") c.rufflePhase += dt * 10;
      if (c.idleTimer <= 0) pickChickenTarget(c);
      return;
    }

    const dx = c.targetX - c.x;
    const dz = c.targetZ - c.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.1) {
      c.state = "idle";
      c.idleTimer = 2 + Math.random() * 4;
      pickChickenIdle(c);
      return;
    }
    c.x += (dx / dist) * CHICKEN_SPEED * dt;
    c.z += (dz / dist) * CHICKEN_SPEED * dt;
    // Clamp to pen
    c.x = Math.max(PEN.x1 + 0.3, Math.min(PEN.x2 + 0.7, c.x));
    c.z = Math.max(PEN.z1 + 0.3, Math.min(PEN.z2 + 0.7, c.z));
    if (Math.abs(dx) > 0.05) c.facing = dx > 0 ? 1 : -1;
    c.walkTimer += dt;
  }
}

function drawChicken(g: Graphics, c: Chicken): void {
  const px = Math.round(c.x * TILE_PX);
  const pz = Math.round(c.z * TILE_PX);
  const f = c.facing;
  const walking = c.state === "walking";
  const bob = walking ? Math.sin(c.walkTimer * 8) * 0.6 : 0;
  const legSwing = walking ? Math.sin(c.walkTimer * 10) * 1.2 : 0;
  const peckY = c.idleAnim === "peck" && !walking ? Math.sin(c.peckPhase) * 1.5 : 0;
  const ruffle = c.idleAnim === "ruffle" && !walking ? Math.sin(c.rufflePhase) * 0.5 : 0;

  // Color variants
  const bodyColors = [
    { body: 0xf0e8d0, wing: 0xe0d4b0, dark: 0xc4b890 }, // white
    { body: 0xd4a050, wing: 0xc09040, dark: 0xa07830 }, // brown
    { body: 0xf0c878, wing: 0xe0b868, dark: 0xc49848 }, // golden
    { body: 0xc0c0c0, wing: 0xa8a8a8, dark: 0x909090 }, // grey
  ];
  const col = bodyColors[c.variant % bodyColors.length]!;

  const cx = px + 8;
  const cy = pz + 12 + Math.round(bob);

  // Shadow
  g.ellipse(cx, cy + 4, 3, 1).fill({ color: 0x000000, alpha: 0.1 });

  // Legs — orange sticks
  g.rect(cx - 1, cy + 2 + legSwing * 0.3, 1, 2).fill(0xd08020);
  g.rect(cx + 1, cy + 2 - legSwing * 0.3, 1, 2).fill(0xd08020);
  // Feet
  g.rect(cx - 2, cy + 4 + legSwing * 0.3, 2, 1).fill(0xd08020);
  g.rect(cx, cy + 4 - legSwing * 0.3, 2, 1).fill(0xd08020);

  // Body — round blob
  g.rect(cx - 3, cy - 1 + Math.round(ruffle), 6, 4).fill(col.body);
  g.rect(cx - 2, cy - 2 + Math.round(ruffle), 4, 1).fill(col.body);
  g.rect(cx - 2, cy + 3, 4, 1).fill(col.dark);
  // Wing
  g.rect(cx + f * -2, cy, 3, 2).fill(col.wing);
  g.rect(cx + f * -2, cy + 2, 2, 1).fill(col.dark);

  // Tail feathers
  const tailDir = f === 1 ? -1 : 1;
  g.rect(cx + tailDir * 3, cy - 2, 1, 2).fill(col.wing);
  g.rect(cx + tailDir * 4, cy - 3, 1, 2).fill(col.dark);

  // Head
  const hx = cx + f * 3;
  const hy = cy - 3 + Math.round(peckY * 0.5);
  g.rect(hx - 1, hy, 3, 3).fill(col.body);
  g.rect(hx, hy - 1, 1, 1).fill(col.body);

  // Comb — red on top
  g.rect(hx, hy - 2, 1, 1).fill(0xe03030);
  g.rect(hx - 1, hy - 1, 1, 1).fill(0xe03030);

  // Wattle — small red under beak
  g.rect(hx + f * 1, hy + 2, 1, 1).fill(0xd02828);

  // Beak — orange
  g.rect(hx + f * 1, hy + 1 + Math.round(peckY * 0.3), 1, 1).fill(0xf0a020);

  // Eye
  if (!c.blinking) {
    g.rect(hx + (f === 1 ? 1 : -1), hy, 1, 1).fill(0x1a1a1a);
    g.rect(hx + (f === 1 ? 1 : -1), hy, 1, 1).fill({ color: 0xffffff, alpha: 0.3 });
  } else {
    g.rect(hx + (f === 1 ? 1 : -1), hy + 1, 1, 1).fill({ color: col.dark, alpha: 0.5 });
  }

  // Sitting — flatten body
  if (c.idleAnim === "sit" && !walking) {
    g.rect(cx - 3, cy + 2, 6, 1).fill(col.dark);
  }
}

// ── Eggs (chickens lay them) ──────────────────────────────
interface Egg {
  x: number; z: number; age: number;
}
const eggs: Egg[] = [];
let eggTimer = 8 + Math.random() * 15;

function updateEggs(dt: number): void {
  eggTimer -= dt;
  if (eggTimer <= 0 && eggs.length < 6) {
    // Random chicken lays an egg
    const c = chickens[Math.floor(Math.random() * chickens.length)];
    if (c && c.state === "idle") {
      eggs.push({ x: c.x, z: c.z, age: 0 });
    }
    eggTimer = 12 + Math.random() * 20;
  }
  for (const e of eggs) e.age += dt;
}

function drawEggs(g: Graphics): void {
  for (const e of eggs) {
    const px = Math.round(e.x * TILE_PX) + 6;
    const pz = Math.round(e.z * TILE_PX) + 12;
    // Shadow
    g.ellipse(px + 1, pz + 3, 2, 1).fill({ color: 0x000000, alpha: 0.08 });
    // Egg — white oval
    g.rect(px, pz, 3, 3).fill(0xf8f0e0);
    g.rect(px + 1, pz - 1, 1, 1).fill(0xf8f0e0);
    g.rect(px, pz, 1, 1).fill({ color: 0xffffff, alpha: 0.4 });
    g.rect(px + 1, pz + 2, 2, 1).fill(0xe8e0d0);
  }
}

function collectEgg(tx: number, tz: number): boolean {
  for (let i = eggs.length - 1; i >= 0; i--) {
    const e = eggs[i]!;
    if (Math.abs(Math.round(e.x) - tx) <= 1 && Math.abs(Math.round(e.z) - tz) <= 1) {
      eggs.splice(i, 1);
      coins += 3;
      return true;
    }
  }
  return false;
}

// ── Pond ─────────────────────────────────────────────────
const POND_TILES = [
  { x: 3, z: 19 }, { x: 4, z: 19 }, { x: 5, z: 19 },
  { x: 3, z: 20 }, { x: 4, z: 20 }, { x: 5, z: 20 }, { x: 6, z: 20 },
  { x: 3, z: 21 }, { x: 4, z: 21 }, { x: 5, z: 21 },
  { x: 4, z: 22 },
];

function isPondTile(x: number, z: number): boolean {
  return POND_TILES.some((t) => t.x === x && t.z === z);
}

function drawPondTile(g: Graphics, tx: number, tz: number): void {
  const px = tx * TILE_PX;
  const pz = tz * TILE_PX;
  const now = performance.now() / 1000;

  // Base water
  g.rect(px, pz, TILE_PX, TILE_PX).fill(0x3a7aa8);

  // Animated ripples
  const wave = Math.sin(now * 2 + tx * 1.5 + tz * 2) * 0.5 + 0.5;
  g.rect(px + 2, pz + Math.round(wave * 4) + 2, 4, 1).fill({ color: 0x5aaad8, alpha: 0.4 });
  g.rect(px + 8, pz + Math.round((1 - wave) * 5) + 6, 3, 1).fill({ color: 0x5aaad8, alpha: 0.3 });

  // Shimmer highlights
  const shimmer = Math.sin(now * 3 + tx * 3 + tz) * 0.5 + 0.5;
  if (shimmer > 0.6) {
    g.rect(px + 4 + Math.round(shimmer * 4), pz + 3, 1, 1).fill({ color: 0xc0e8ff, alpha: shimmer * 0.5 });
  }

  // Darker edge against grass
  const isEdge = (dx: number, dz: number) => !isPondTile(tx + dx, tz + dz);
  if (isEdge(0, -1)) g.rect(px, pz, TILE_PX, 2).fill({ color: 0x2a6088, alpha: 0.4 });
  if (isEdge(0, 1)) g.rect(px, pz + 14, TILE_PX, 2).fill({ color: 0x2a6088, alpha: 0.3 });
  if (isEdge(-1, 0)) g.rect(px, pz, 2, TILE_PX).fill({ color: 0x2a6088, alpha: 0.3 });
  if (isEdge(1, 0)) g.rect(px + 14, pz, 2, TILE_PX).fill({ color: 0x2a6088, alpha: 0.3 });

  // Lily pad (only on a couple tiles)
  if ((tx === 4 && tz === 20) || (tx === 5 && tz === 21)) {
    const lilyX = px + 5 + Math.round(Math.sin(now * 0.5 + tx) * 1.5);
    const lilyZ = pz + 6;
    g.ellipse(lilyX + 2, lilyZ + 1, 3, 2).fill({ color: 0x4aaa3e, alpha: 0.7 });
    g.rect(lilyX + 2, lilyZ, 1, 1).fill({ color: 0x5acc4e, alpha: 0.6 });
    // Tiny flower on lily
    if (tx === 4) {
      g.rect(lilyX + 2, lilyZ - 1, 1, 1).fill({ color: 0xf0a0c0, alpha: 0.7 });
    }
  }
}

// ── Cloud Shadows ────────────────────────────────────────
interface CloudShadow {
  x: number; z: number; w: number; h: number; speed: number;
}
const cloudShadows: CloudShadow[] = [];
for (let i = 0; i < 3; i++) {
  cloudShadows.push({
    x: Math.random() * ISLAND_SIZE * TILE_PX,
    z: Math.random() * ISLAND_SIZE * TILE_PX,
    w: 40 + Math.random() * 60,
    h: 20 + Math.random() * 30,
    speed: 3 + Math.random() * 4,
  });
}

function updateCloudShadows(dt: number): void {
  for (const c of cloudShadows) {
    c.x += c.speed * dt;
    if (c.x > ISLAND_SIZE * TILE_PX + 40) {
      c.x = -c.w - 20;
      c.z = Math.random() * ISLAND_SIZE * TILE_PX;
      c.w = 40 + Math.random() * 60;
      c.h = 20 + Math.random() * 30;
    }
  }
}

function drawCloudShadows(g: Graphics): void {
  for (const c of cloudShadows) {
    g.ellipse(Math.round(c.x), Math.round(c.z), c.w / 2, c.h / 2)
      .fill({ color: 0x000000, alpha: 0.06 });
  }
}

// ── Wildflowers ──────────────────────────────────────────
interface Wildflower {
  x: number; z: number; color: number; size: number; phase: number;
}
const wildflowers: Wildflower[] = [];
let wildflowersInitialized = false;

function initWildflowers(): void {
  if (wildflowersInitialized) return;
  wildflowersInitialized = true;
  const flowerColors = [0xf0a0c0, 0xf0d060, 0xa0c0f0, 0xf0f0f0, 0xd090f0, 0xf0a040];
  const rng = seededRandom(42);
  for (let i = 0; i < 30; i++) {
    const fx = Math.floor(rng() * ISLAND_SIZE);
    const fz = Math.floor(rng() * ISLAND_SIZE);
    if (isPondTile(fx, fz)) continue;
    if (trees.some((t) => t.x === fx && t.z === fz)) continue;
    if (mapleTrees.some((t) => t.x === fx && t.z === fz)) continue;
    wildflowers.push({
      x: fx * TILE_PX + 3 + rng() * 10,
      z: fz * TILE_PX + 3 + rng() * 10,
      color: flowerColors[Math.floor(rng() * flowerColors.length)]!,
      size: 1 + Math.floor(rng() * 2),
      phase: rng() * Math.PI * 2,
    });
  }
}

function drawWildflowers(g: Graphics): void {
  const now = performance.now() / 1000;
  for (const f of wildflowers) {
    const sway = Math.sin(now * 1.5 + f.phase) * 0.8;
    const bob = Math.sin(now * 2 + f.phase * 2) * 0.3;
    const fx = Math.round(f.x + sway);
    const fz = Math.round(f.z + bob);
    // Stem
    g.rect(fx, fz + 1, 1, 2).fill({ color: 0x4a9a30, alpha: 0.6 });
    // Petals
    g.rect(fx, fz, f.size, f.size).fill(f.color);
    if (f.size > 1) {
      g.rect(fx, fz, 1, 1).fill({ color: 0xffffff, alpha: 0.3 });
    }
  }
}

// ── Japanese Maple Trees ──────────────────────────────────
interface MapleTree {
  x: number; z: number; variant: number;
}

interface MapleLeafParticle {
  x: number; z: number; life: number; drift: number; speed: number;
  color: number; groundTimer: number; onGround: boolean;
  groundX: number; groundZ: number;
}

const mapleTrees: MapleTree[] = [
  { x: 3, z: 4, variant: 1 },
  { x: 5, z: 16, variant: 2 },
];

const mapleLeaves: MapleLeafParticle[] = [];
let mapleSpawnTimer = 0;

function spawnMapleLeaves(): void {
  for (const tree of mapleTrees) {
    if (Math.random() > 0.4) continue;
    const cx = tree.x * TILE_PX + TILE_PX / 2;
    const cz = tree.z * TILE_PX - 6;
    const colors = [0xcc2828, 0xd44020, 0xe06030, 0xb82020, 0xf08040, 0xd83838];
    mapleLeaves.push({
      x: cx + (Math.random() - 0.5) * 12,
      z: cz + Math.random() * 6,
      life: 0, drift: (Math.random() - 0.5) * 10,
      speed: 3 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)]!,
      groundTimer: 0, onGround: false,
      groundX: 0, groundZ: 0,
    });
  }
}

function updateMapleLeaves(dt: number): void {
  mapleSpawnTimer -= dt;
  if (mapleSpawnTimer <= 0) { spawnMapleLeaves(); mapleSpawnTimer = 0.8 + Math.random() * 1.5; }
  for (let i = mapleLeaves.length - 1; i >= 0; i--) {
    const p = mapleLeaves[i]!;
    if (p.onGround) {
      p.groundTimer += dt;
      if (p.groundTimer > 4 + Math.random() * 3) { mapleLeaves.splice(i, 1); }
      continue;
    }
    p.life += dt * 0.3;
    p.x += Math.sin(p.life * 4 + p.drift) * p.drift * dt;
    p.z += p.speed * dt;
    // Land on ground after falling far enough
    if (p.life >= 0.8) {
      p.onGround = true;
      p.groundX = p.x;
      p.groundZ = p.z;
    }
  }
}

function drawMapleLeaves(g: Graphics): void {
  for (const p of mapleLeaves) {
    if (p.onGround) {
      const fadeOut = Math.max(0, 1 - p.groundTimer / 6);
      g.rect(Math.round(p.groundX), Math.round(p.groundZ), 2, 1).fill({ color: p.color, alpha: fadeOut * 0.5 });
    } else {
      const a = Math.min(1, p.life * 2);
      const spin = Math.sin(p.life * 6 + p.drift);
      const w = spin > 0 ? 2 : 1;
      g.rect(Math.round(p.x), Math.round(p.z), w, 1).fill({ color: p.color, alpha: a * 0.8 });
    }
  }
}

function drawMapleTree(g: Graphics, tree: MapleTree): void {
  const cx = tree.x * TILE_PX + TILE_PX / 2;
  const cz = tree.z * TILE_PX + TILE_PX;
  const now = performance.now() / 1000;
  const sway = Math.sin(now * 1.0 + tree.variant * 3) * 0.5;
  const sw = Math.round(sway);

  // Shadow
  g.ellipse(cx, cz + 1, 5, 2).fill({ color: 0x000000, alpha: 0.12 });

  // Trunk — slender, slightly curved
  g.rect(cx - 1, cz - 14, 3, 15).fill(0x5a3828);
  g.rect(cx, cz - 14, 1, 15).fill(0x6a4838);
  // Bark texture
  g.rect(cx - 1, cz - 10, 1, 1).fill(0x4a2818);
  g.rect(cx + 1, cz - 6, 1, 1).fill(0x4a2818);

  // Branches — thin reaching out
  g.rect(cx - 4, cz - 12, 4, 1).fill(0x5a3828);
  g.rect(cx + 1, cz - 10, 4, 1).fill(0x5a3828);

  // Canopy — red/orange maple leaves, airy
  const r1 = 0xcc2828;
  const r2 = 0xd44020;
  const r3 = 0xe06838;
  const r4 = 0xf08848;

  // Main canopy — irregular clumps
  g.rect(cx - 6 + sw, cz - 18, 12, 5).fill(r1);
  g.rect(cx - 5 + sw, cz - 19, 10, 1).fill(r2);
  g.rect(cx - 5 + sw, cz - 13, 10, 1).fill(r1);
  // Upper
  g.rect(cx - 4 + sw, cz - 22, 8, 4).fill(r2);
  g.rect(cx - 3 + sw, cz - 23, 6, 1).fill(r3);
  // Top tuft
  g.rect(cx - 2 + sw, cz - 24, 4, 1).fill(r3);
  g.rect(cx - 1 + sw, cz - 25, 2, 1).fill(r4);

  // Light dappling
  const r = seededRandom(tree.variant * 777);
  for (let i = 0; i < 5; i++) {
    const lx = Math.floor(r() * 10) - 5;
    const lz = Math.floor(r() * 10) - 20;
    g.rect(cx + lx + sw, cz + lz, 2, 1).fill({ color: r4, alpha: 0.6 });
  }
  // Darker depth
  for (let i = 0; i < 3; i++) {
    const lx = Math.floor(r() * 8) - 4;
    const lz = Math.floor(r() * 8) - 18;
    g.rect(cx + lx + sw, cz + lz, 2, 2).fill({ color: 0xa01818, alpha: 0.4 });
  }
}

// ── Game State ────────────────────────────────────────────
const tiles: TileType[][] = [];
for (let z = 0; z < ISLAND_SIZE; z++) {
  const row: TileType[] = [];
  for (let x = 0; x < ISLAND_SIZE; x++) row.push("grass");
  tiles.push(row);
}

const crops: CropState[] = [];
const trees: TreeState[] = [
  { x: 19, z: 5, chopTime: 0, regrowTimer: 0, variant: 1 },
  { x: 20, z: 9, chopTime: 0, regrowTimer: 0, variant: 2 },
  { x: 18, z: 13, chopTime: 0, regrowTimer: 0, variant: 3 },
];
// Only tree index 1 (middle tree) gets a beehive
const HIVE_TREE = 1;

// ── Bees ──────────────────────────────────────────────────
interface Bee {
  angle: number;   // current angle around hive
  radius: number;  // orbit distance
  speed: number;   // angular speed
  zOff: number;    // vertical wobble offset
  phase: number;   // wobble phase
}

const bees: Bee[] = [];
for (let i = 0; i < 5; i++) {
  bees.push({
    angle: Math.random() * Math.PI * 2,
    radius: 6 + Math.random() * 8,
    speed: 1.5 + Math.random() * 2,
    zOff: 0,
    phase: Math.random() * Math.PI * 2,
  });
}

function updateBees(dt: number): void {
  const now = performance.now() / 1000;
  for (const b of bees) {
    b.angle += b.speed * dt;
    b.zOff = Math.sin(now * 3 + b.phase) * 3;
  }
}

function drawHiveAndBees(g: Graphics, tree: TreeState): void {
  if (tree.chopTime >= CHOP_HITS) return;
  const cx = tree.x * TILE_PX + TILE_PX / 2;
  const cz = tree.z * TILE_PX + TILE_PX; // base of tree (matches drawTree)
  const now = performance.now() / 1000;
  const sway = Math.sin(now * 1.2 + tree.variant * 2) * 0.6;
  const sw = Math.round(sway);
  // Hive hangs from bottom of canopy (canopy bottom is cz - 10)
  const hiveX = cx + 4 + sw;
  const hiveZ = cz - 10;

  // Branch stub connecting hive to canopy
  g.rect(hiveX + 1, hiveZ, 1, 2).fill(0x6a4830);
  g.rect(hiveX, hiveZ, 3, 1).fill(0x5a3820);

  // Beehive — cute rounded shape hanging below branch
  const hz = hiveZ + 2;
  g.rect(hiveX, hz, 4, 4).fill(0xd4a840);
  g.rect(hiveX - 1, hz + 1, 6, 2).fill(0xd4a840);
  // Stripes
  g.rect(hiveX - 1, hz + 1, 6, 1).fill(0xc49830);
  g.rect(hiveX, hz + 3, 4, 1).fill(0xc49830);
  // Top round
  g.rect(hiveX + 1, hz - 1, 2, 1).fill(0xd4a840);
  // Hole
  g.rect(hiveX + 1, hz + 2, 2, 1).fill(0x4a3018);
  // Highlight
  g.rect(hiveX, hz, 2, 1).fill({ color: 0xf0d060, alpha: 0.5 });

  // Bees orbiting
  for (const b of bees) {
    const bx = hiveX + 2 + Math.cos(b.angle) * b.radius;
    const bz = hz + 2 + Math.sin(b.angle) * b.radius * 0.5 + b.zOff;
    const ix = Math.round(bx);
    const iz = Math.round(bz);
    // Bee body — yellow and black
    g.rect(ix, iz, 2, 1).fill(0xf0d040);
    g.rect(ix + 1, iz, 1, 1).fill(0x2a2a2a);
    // Wings — flicker
    const wingUp = Math.sin(performance.now() / 1000 * 20 + b.phase) > 0;
    if (wingUp) {
      g.rect(ix, iz - 1, 1, 1).fill({ color: 0xf0f0f0, alpha: 0.5 });
      g.rect(ix + 1, iz - 1, 1, 1).fill({ color: 0xf0f0f0, alpha: 0.3 });
    }
  }
}
let wood = 0;
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
const resetBtn = el<HTMLButtonElement>("reset-btn");
const dayClock = el<HTMLDivElement>("day-clock");
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

const cursorAxe = makePixelCursor((ctx) => {
  // Handle
  px(ctx, 3, 4, 1, 10, "#8b6840");
  px(ctx, 4, 4, 1, 10, "#7a5e36");
  // Axe head
  px(ctx, 0, 1, 4, 3, "#a0a0a0");
  px(ctx, 0, 0, 3, 1, "#c0c0c0");
  px(ctx, 0, 3, 3, 1, "#888888");
  // Blade edge
  px(ctx, 0, 1, 1, 3, "#d0d0d0");
}, 2, 2);

const toolCursors: Record<ToolId, string> = {
  hoe: cursorHoe,
  water: cursorWater,
  seeds: cursorSeeds,
  axe: cursorAxe,
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
  const ox = tx * TILE_PX;
  const oz = tz * TILE_PX;
  const baseColors = [COLORS.grass1, COLORS.grass2, COLORS.grass3, COLORS.grass4, COLORS.grass5];
  const base = baseColors[Math.floor(rand() * baseColors.length)]!;
  g.rect(ox, oz, TILE_PX, TILE_PX).fill(base);

  // Dithered 2x2 patches for natural variation
  for (let i = 0; i < 4; i++) {
    const dx = Math.floor(rand() * 14);
    const dz = Math.floor(rand() * 14);
    const shade = baseColors[Math.floor(rand() * baseColors.length)]!;
    g.rect(ox + dx, oz + dz, 2, 2).fill(shade);
  }

  // Edge dirt — bare patches near island perimeter
  const edgeDist = Math.min(tx, tz, ISLAND_SIZE - 1 - tx, ISLAND_SIZE - 1 - tz);
  if (edgeDist <= 1) {
    const dirtChance = edgeDist === 0 ? 0.7 : 0.3;
    const dirtCount = edgeDist === 0 ? 5 + Math.floor(rand() * 5) : 2 + Math.floor(rand() * 3);
    if (rand() < dirtChance) {
      const dirtColors = [0x7a6a4e, 0x6e5e42, 0x8a7a5a, 0x5e5038, 0x746040];
      for (let i = 0; i < dirtCount; i++) {
        const dx = Math.floor(rand() * 14) + 1;
        const dz = Math.floor(rand() * 14) + 1;
        const dc = dirtColors[Math.floor(rand() * dirtColors.length)]!;
        const dw = 1 + Math.floor(rand() * 3);
        const dh = 1 + Math.floor(rand() * 2);
        g.rect(ox + dx, oz + dz, dw, dh).fill(dc);
      }
    }
    // Sparse pebbles on edges
    if (edgeDist === 0 && rand() < 0.5) {
      const px2 = Math.floor(rand() * 12) + 2;
      const pz2 = Math.floor(rand() * 12) + 2;
      g.rect(ox + px2, oz + pz2, 2, 1).fill(0x9a9080);
      g.rect(ox + px2, oz + pz2 + 1, 1, 1).fill(0x8a8070);
      if (rand() < 0.5) g.rect(ox + px2 + 5, oz + pz2 + 4, 1, 1).fill(0x9a9080);
    }
  }

  // Grass speckles — more density, varied sizes
  for (let i = 0; i < 8; i++) {
    const spx = Math.floor(rand() * 14) + 1;
    const spz = Math.floor(rand() * 14) + 1;
    const r = rand();
    const shade = r < 0.3 ? COLORS.grassHighlight : r < 0.6 ? COLORS.grassLight : COLORS.grassDark;
    g.rect(ox + spx, oz + spz, 1, 1).fill(shade);
  }

  // Grass blade tufts — animated sway
  const windNow = performance.now() / 1000;
  if (edgeDist > 0 && rand() < 0.5) {
    const bx = Math.floor(rand() * 10) + 3;
    const bz = Math.floor(rand() * 8) + 4;
    const grassSway = Math.round(Math.sin(windNow * 1.5 + tx * 2 + tz * 3) * 0.8);
    g.rect(ox + bx, oz + bz + 2, 1, 1).fill(COLORS.grassDark);
    g.rect(ox + bx + grassSway, oz + bz, 1, 2).fill(COLORS.grassDark);
    g.rect(ox + bx + 2, oz + bz + 2, 1, 1).fill(COLORS.grassDark);
    g.rect(ox + bx + 2 + grassSway, oz + bz + 1, 1, 1).fill(COLORS.grassDark);
    g.rect(ox + bx + grassSway, oz + bz, 1, 1).fill(COLORS.grassLight);
  }
  // Second tuft
  if (edgeDist > 1 && rand() < 0.3) {
    const bx2 = Math.floor(rand() * 8) + 4;
    const bz2 = Math.floor(rand() * 6) + 6;
    const gs2 = Math.round(Math.sin(windNow * 1.3 + tx * 5 + tz) * 0.6);
    g.rect(ox + bx2, oz + bz2 + 1, 1, 1).fill(COLORS.grassDark);
    g.rect(ox + bx2 + gs2, oz + bz2, 1, 1).fill(COLORS.grassDark);
    g.rect(ox + bx2 + gs2, oz + bz2, 1, 1).fill(COLORS.grassLight);
  }

  // Small clover/moss patches (interior)
  if (edgeDist > 2 && rand() < 0.12) {
    const mx = Math.floor(rand() * 10) + 3;
    const mz = Math.floor(rand() * 10) + 3;
    g.rect(ox + mx, oz + mz, 3, 2).fill(0x4a8a30);
    g.rect(ox + mx + 1, oz + mz - 1, 1, 1).fill(0x4a8a30);
    g.rect(ox + mx + 1, oz + mz, 1, 1).fill(0x5a9a3a);
  }

  // Flowers (only interior tiles) — bob gently
  if (edgeDist > 1 && rand() < 0.2) {
    const fx = Math.floor(rand() * 10) + 3;
    const fz = Math.floor(rand() * 10) + 3;
    const flowerColors = [0xf0e040, 0xe86080, 0x80b0f0, 0xf0a0d0, 0xffa060, 0xf8f8f0];
    const fc = flowerColors[Math.floor(rand() * flowerColors.length)]!;
    const flowerBob = Math.round(Math.sin(windNow * 2 + tx * 4 + tz * 2) * 0.5);
    const flowerSway = Math.round(Math.sin(windNow * 1.6 + tx * 3 + tz * 5) * 0.6);
    // Stem
    g.rect(ox + fx, oz + fz + 2, 1, 3).fill(COLORS.grassDark);
    // Leaf on stem
    g.rect(ox + fx + 1, oz + fz + 3, 1, 1).fill(0x4e9636);
    // Petals (cross pattern) — sway and bob
    const fpx = ox + fx + flowerSway;
    const fpz = oz + fz + flowerBob;
    g.rect(fpx, fpz, 1, 1).fill(fc);
    g.rect(fpx - 1, fpz + 1, 1, 1).fill(fc);
    g.rect(fpx + 1, fpz + 1, 1, 1).fill(fc);
    g.rect(fpx, fpz + 1, 1, 1).fill(0xf8e860); // center
    g.rect(fpx, fpz - 1, 1, 1).fill({ color: fc, alpha: 0.6 });
  }

  // Second flower chance (different position, smaller)
  if (edgeDist > 3 && rand() < 0.08) {
    const fx = Math.floor(rand() * 8) + 4;
    const fz = Math.floor(rand() * 8) + 4;
    const fc2 = [0xe86080, 0x80b0f0, 0xf0a0d0][Math.floor(rand() * 3)]!;
    g.rect(ox + fx, oz + fz + 1, 1, 2).fill(COLORS.grassDark);
    g.rect(ox + fx, oz + fz, 1, 1).fill(fc2);
    g.rect(ox + fx - 1, oz + fz, 1, 1).fill({ color: fc2, alpha: 0.5 });
  }
}

function isOnIsland(x: number, z: number): boolean {
  return x >= 0 && x < ISLAND_SIZE && z >= 0 && z < ISLAND_SIZE;
}

function drawIslandEdge(g: Graphics): void {
  // Draw cliff faces with depth gradient
  for (let x = -1; x <= ISLAND_SIZE; x++) {
    for (let z = -1; z <= ISLAND_SIZE; z++) {
      if (isOnIsland(x, z)) continue;
      const adj = isOnIsland(x + 1, z) || isOnIsland(x - 1, z) || isOnIsland(x, z + 1) || isOnIsland(x, z - 1)
        || isOnIsland(x + 1, z + 1) || isOnIsland(x - 1, z - 1) || isOnIsland(x + 1, z - 1) || isOnIsland(x - 1, z + 1);
      if (!adj) continue;

      const px = x * TILE_PX;
      const pz = z * TILE_PX;
      const rand = seededRandom(x * 500 + z * 77);

      if (z >= ISLAND_SIZE || (z >= 0 && !isOnIsland(x, z))) {
        // Cliff face below island — layered gradient
        g.rect(px, pz, TILE_PX, TILE_PX).fill(COLORS.cliffFace);
        // Top lip where grass meets cliff
        if (isOnIsland(x, z - 1)) {
          g.rect(px, pz, TILE_PX, 2).fill(COLORS.cliffTop);
          g.rect(px, pz + 2, TILE_PX, 2).fill(COLORS.cliffMid);
          // Grass overhang pixels
          if (rand() < 0.6) {
            g.rect(px + Math.floor(rand() * 12) + 2, pz, 2, 1).fill(COLORS.grassEdge);
          }
        }
        // Rock cracks and texture
        for (let i = 0; i < 4; i++) {
          const lx = Math.floor(rand() * 12) + 2;
          const lz = Math.floor(rand() * 10) + 3;
          g.rect(px + lx, pz + lz, 2, 1).fill(COLORS.cliffShadow);
          if (rand() < 0.4) g.rect(px + lx + 1, pz + lz + 1, 1, 1).fill(COLORS.cliffDeep);
        }
        // Moss patches on cliff
        if (rand() < 0.3) {
          const mx = Math.floor(rand() * 10) + 3;
          const mz = Math.floor(rand() * 8) + 4;
          g.rect(px + mx, pz + mz, 2, 2).fill(COLORS.cliffMoss);
          g.rect(px + mx + 1, pz + mz, 1, 1).fill(0x4a6838);
        }
        // Gradient darkening toward bottom
        g.rect(px, pz + TILE_PX - 3, TILE_PX, 3).fill({ color: COLORS.cliffDeep, alpha: 0.3 });
      } else {
        g.rect(px, pz, TILE_PX, TILE_PX).fill(COLORS.cliffFace);
        if (isOnIsland(x, z + 1)) {
          g.rect(px, pz + TILE_PX - 2, TILE_PX, 2).fill(COLORS.cliffTop);
          g.rect(px, pz + TILE_PX - 4, TILE_PX, 2).fill(COLORS.cliffMid);
        }
        for (let i = 0; i < 3; i++) {
          const lx = Math.floor(rand() * 12) + 2;
          const lz = Math.floor(rand() * 10) + 2;
          g.rect(px + lx, pz + lz, 2, 1).fill(COLORS.cliffShadow);
        }
      }
    }
  }

  // Grass edge highlight — bright lip
  for (let x = 0; x < ISLAND_SIZE; x++) {
    if (!isOnIsland(x, -1)) g.rect(x * TILE_PX, 0, TILE_PX, 1).fill(COLORS.grassEdge);
    if (!isOnIsland(x, ISLAND_SIZE)) g.rect(x * TILE_PX, ISLAND_SIZE * TILE_PX - 1, TILE_PX, 1).fill(COLORS.grassEdge);
  }
  for (let z = 0; z < ISLAND_SIZE; z++) {
    if (!isOnIsland(-1, z)) g.rect(0, z * TILE_PX, 1, TILE_PX).fill(COLORS.grassEdge);
    if (!isOnIsland(ISLAND_SIZE, z)) g.rect(ISLAND_SIZE * TILE_PX - 1, z * TILE_PX, 1, TILE_PX).fill(COLORS.grassEdge);
  }

  // Drop shadow beneath the island
  const shadowAlpha = 0.12;
  for (let x = -1; x <= ISLAND_SIZE; x++) {
    const sx = x * TILE_PX;
    g.rect(sx, ISLAND_SIZE * TILE_PX + TILE_PX, TILE_PX, 4).fill({ color: 0x000000, alpha: shadowAlpha });
    g.rect(sx, ISLAND_SIZE * TILE_PX + TILE_PX + 4, TILE_PX, 4).fill({ color: 0x000000, alpha: shadowAlpha * 0.5 });
  }
}

function drawFarmlandTile(g: Graphics, tx: number, tz: number, watered: boolean): void {
  const ox = tx * TILE_PX;
  const oz = tz * TILE_PX;
  const color = watered ? COLORS.farmlandWet : COLORS.farmland;
  const dark = watered ? COLORS.farmlandWetDark : COLORS.farmlandDark;
  g.rect(ox, oz, TILE_PX, TILE_PX).fill(color);

  // Furrows with ridge highlights
  for (let row = 2; row < TILE_PX; row += 4) {
    g.rect(ox + 1, oz + row, TILE_PX - 2, 1).fill(dark);
    const ridgeColor = watered ? 0x5a4430 : 0x8a6e4e;
    g.rect(ox + 1, oz + row - 1, TILE_PX - 2, 1).fill(ridgeColor);
    // Ridge highlight on top edge
    const highlight = watered ? COLORS.farmlandWetSheen : COLORS.farmlandLight;
    g.rect(ox + 2, oz + row - 2, TILE_PX - 4, 1).fill({ color: highlight, alpha: 0.3 });
  }

  // Soil texture speckles
  const rand = seededRandom(tx * 333 + tz * 19);
  for (let i = 0; i < 3; i++) {
    const dx = Math.floor(rand() * 12) + 2;
    const dz = Math.floor(rand() * 12) + 2;
    g.rect(ox + dx, oz + dz, 1, 1).fill({ color: COLORS.farmlandLight, alpha: 0.3 });
  }

  if (watered) {
    // Water sheen droplets
    for (let i = 0; i < 5; i++) {
      const dx = Math.floor(rand() * 12) + 2;
      const dz = Math.floor(rand() * 12) + 2;
      g.rect(ox + dx, oz + dz, 1, 1).fill({ color: 0x6aaad0, alpha: 0.6 });
    }
    // Subtle wet sheen across surface
    g.rect(ox + 2, oz + 1, TILE_PX - 4, TILE_PX - 2).fill({ color: 0x4a6a8a, alpha: 0.08 });
  }

  // Border edge — grass transition hint
  g.rect(ox, oz, 1, TILE_PX).fill({ color: COLORS.farmlandDark, alpha: 0.4 });
  g.rect(ox + TILE_PX - 1, oz, 1, TILE_PX).fill({ color: COLORS.farmlandDark, alpha: 0.4 });
}

function drawCrop(g: Graphics, crop: CropState): void {
  const def = CROP_DEFS[crop.type];
  const progress = crop.growth / def.growDays;
  const cx = crop.x * TILE_PX;
  const cz = crop.z * TILE_PX;
  const now = performance.now() / 1000;
  const swayAmt = progress < 0.3 ? 0.2 : progress < 0.7 ? 0.35 : 0.6;
  const sway = Math.sin(now * 1.8 + crop.x * 3 + crop.z * 7) * swayAmt;
  const sw = Math.round(sway);

  // Generic seedling for all crops (stage 0)
  if (progress < 0.3) {
    g.rect(cx + 7, cz + 11, 2, 3).fill(COLORS.cropGreenDark);
    g.rect(cx + 6 + sw, cz + 10, 4, 2).fill(COLORS.cropGreen);
    g.rect(cx + 7 + sw, cz + 9, 2, 1).fill(COLORS.cropGreenLight);
    g.rect(cx + 9 + sw, cz + 10, 1, 1).fill(COLORS.cropGreen);
  } else {
    switch (crop.type) {
      case "sky_wheat": drawWheat(g, cx, cz, sw, progress); break;
      case "star_berry": drawStarBerry(g, cx, cz, sw, progress, now); break;
      case "cloud_pumpkin": drawPumpkin(g, cx, cz, sw, progress); break;
      case "moon_flower": drawMoonFlower(g, cx, cz, sw, progress, now); break;
    }
  }

  if (crop.watered) {
    g.rect(cx + 13, cz + 1, 2, 2).fill({ color: COLORS.water, alpha: 0.6 });
    g.rect(cx + 14, cz + 1, 1, 1).fill({ color: 0xa0d4f0, alpha: 0.4 });
  }
}

function drawWheat(g: Graphics, cx: number, cz: number, sw: number, progress: number): void {
  if (progress < 0.7) {
    g.rect(cx + 7, cz + 5, 2, 9).fill(COLORS.cropGreenDark);
    g.rect(cx + 4 + sw, cz + 5, 3, 3).fill(COLORS.cropGreen);
    g.rect(cx + 4 + sw, cz + 5, 2, 1).fill(COLORS.cropGreenLight);
    g.rect(cx + 9 + sw, cz + 6, 3, 3).fill(COLORS.cropGreen);
    g.rect(cx + 10 + sw, cz + 6, 2, 1).fill(COLORS.cropGreenLight);
    g.rect(cx + 6, cz + 13, 4, 1).fill({ color: 0x000000, alpha: 0.1 });
  } else if (progress < 1) {
    g.rect(cx + 7 + sw, cz + 3, 2, 11).fill(COLORS.cropGreenDark);
    g.rect(cx + 3 + sw, cz + 4, 4, 4).fill(COLORS.cropGreen);
    g.rect(cx + 9 + sw, cz + 3, 4, 4).fill(COLORS.cropGreen);
    g.rect(cx + 5 + sw, cz + 2, 2, 2).fill(COLORS.cropBrown);
    g.rect(cx + 10 + sw, cz + 1, 2, 2).fill(COLORS.cropBrown);
  } else {
    g.rect(cx + 7 + sw, cz + 3, 2, 11).fill(COLORS.cropGreenDark);
    g.rect(cx + 3 + sw, cz + 5, 4, 3).fill(COLORS.cropGreen);
    g.rect(cx + 9 + sw, cz + 4, 4, 3).fill(COLORS.cropGreen);
    g.rect(cx + 4 + sw, cz + 2, 4, 3).fill(COLORS.cropYellow);
    g.rect(cx + 5 + sw, cz + 1, 2, 1).fill(COLORS.cropYellowLight);
    g.rect(cx + 9 + sw, cz + 1, 4, 3).fill(COLORS.cropYellow);
    g.rect(cx + 10 + sw, cz + 0, 2, 1).fill(COLORS.cropYellowLight);
    g.rect(cx + 5, cz + 13, 6, 1).fill({ color: 0x000000, alpha: 0.12 });
  }
}

function drawStarBerry(g: Graphics, cx: number, cz: number, sw: number, progress: number, now: number): void {
  // Berry bush — round and bushy
  if (progress < 0.7) {
    // Small bush
    g.rect(cx + 6, cz + 8, 4, 6).fill(COLORS.cropGreenDark);
    g.rect(cx + 5 + sw, cz + 7, 6, 4).fill(COLORS.cropGreen);
    g.rect(cx + 6 + sw, cz + 6, 4, 1).fill(COLORS.cropGreenLight);
  } else if (progress < 1) {
    // Bigger bush with unripe berries
    g.rect(cx + 5, cz + 6, 6, 8).fill(COLORS.cropGreenDark);
    g.rect(cx + 4 + sw, cz + 5, 8, 6).fill(COLORS.cropGreen);
    g.rect(cx + 5 + sw, cz + 4, 6, 1).fill(COLORS.cropGreenLight);
    // Green berries
    g.rect(cx + 5 + sw, cz + 6, 2, 2).fill(0x88cc60);
    g.rect(cx + 9 + sw, cz + 7, 2, 2).fill(0x88cc60);
  } else {
    // Full bush with ripe star berries (purple/blue)
    g.rect(cx + 5, cz + 6, 6, 8).fill(COLORS.cropGreenDark);
    g.rect(cx + 4 + sw, cz + 5, 8, 6).fill(COLORS.cropGreen);
    g.rect(cx + 5 + sw, cz + 4, 6, 1).fill(COLORS.cropGreenLight);
    // Ripe berries — glowing purple-blue
    const glow = Math.sin(now * 3) * 0.15 + 0.85;
    g.rect(cx + 4 + sw, cz + 5, 3, 3).fill({ color: 0x8060d0, alpha: glow });
    g.rect(cx + 5 + sw, cz + 5, 1, 1).fill({ color: 0xc0a0f0, alpha: glow * 0.6 });
    g.rect(cx + 9 + sw, cz + 6, 3, 3).fill({ color: 0x8060d0, alpha: glow });
    g.rect(cx + 10 + sw, cz + 6, 1, 1).fill({ color: 0xc0a0f0, alpha: glow * 0.6 });
    g.rect(cx + 6 + sw, cz + 8, 2, 2).fill({ color: 0x7050c0, alpha: glow });
    // Star sparkle
    if (Math.sin(now * 5) > 0.5) {
      g.rect(cx + 5 + sw, cz + 4, 1, 1).fill({ color: 0xffffff, alpha: 0.7 });
    }
    g.rect(cx + 5, cz + 13, 6, 1).fill({ color: 0x000000, alpha: 0.1 });
  }
}

function drawPumpkin(g: Graphics, cx: number, cz: number, sw: number, progress: number): void {
  if (progress < 0.5) {
    // Vine growing
    g.rect(cx + 6, cz + 10, 4, 4).fill(COLORS.cropGreenDark);
    g.rect(cx + 5 + sw, cz + 9, 6, 3).fill(COLORS.cropGreen);
    // Small vine tendrils
    g.rect(cx + 3 + sw, cz + 10, 2, 1).fill(COLORS.cropGreenDark);
    g.rect(cx + 11 + sw, cz + 11, 2, 1).fill(COLORS.cropGreenDark);
  } else if (progress < 1) {
    // Growing pumpkin — small and green-orange
    g.rect(cx + 4, cz + 8, 8, 6).fill(COLORS.cropGreen);
    g.rect(cx + 3 + sw, cz + 7, 3, 2).fill(COLORS.cropGreenDark);
    g.rect(cx + 10 + sw, cz + 8, 3, 2).fill(COLORS.cropGreenDark);
    // Small pumpkin forming
    g.rect(cx + 5, cz + 9, 6, 4).fill(0xc0882e);
    g.rect(cx + 6, cz + 10, 4, 2).fill(0xd09838);
    g.rect(cx + 7, cz + 9, 1, 1).fill(COLORS.cropGreenDark); // stem
  } else {
    // Big ripe pumpkin — orange, round, with leaves
    // Leaves
    g.rect(cx + 2 + sw, cz + 6, 4, 3).fill(COLORS.cropGreen);
    g.rect(cx + 10 + sw, cz + 5, 4, 3).fill(COLORS.cropGreen);
    g.rect(cx + 3 + sw, cz + 6, 2, 1).fill(COLORS.cropGreenLight);
    // Pumpkin body — big round
    g.rect(cx + 4, cz + 7, 8, 6).fill(0xd08830);
    g.rect(cx + 3, cz + 8, 10, 4).fill(0xd08830);
    // Ridges
    g.rect(cx + 5, cz + 7, 1, 6).fill(0xc07820);
    g.rect(cx + 8, cz + 7, 1, 6).fill(0xc07820);
    g.rect(cx + 11, cz + 8, 1, 4).fill(0xc07820);
    // Highlight
    g.rect(cx + 6, cz + 8, 2, 2).fill({ color: 0xf0b040, alpha: 0.5 });
    // Stem
    g.rect(cx + 7, cz + 6, 2, 2).fill(0x5a3820);
    g.rect(cx + 7, cz + 5, 1, 1).fill(COLORS.cropGreenDark);
    // Shadow
    g.rect(cx + 4, cz + 13, 8, 1).fill({ color: 0x000000, alpha: 0.12 });
  }
}

function drawMoonFlower(g: Graphics, cx: number, cz: number, sw: number, progress: number, now: number): void {
  if (progress < 0.5) {
    // Tall thin stem growing
    g.rect(cx + 7, cz + 6, 2, 8).fill(COLORS.cropGreenDark);
    g.rect(cx + 5 + sw, cz + 7, 3, 2).fill(COLORS.cropGreen);
    g.rect(cx + 9 + sw, cz + 8, 3, 2).fill(COLORS.cropGreen);
  } else if (progress < 1) {
    // Tall stem with bud
    g.rect(cx + 7 + sw, cz + 3, 2, 11).fill(COLORS.cropGreenDark);
    g.rect(cx + 4 + sw, cz + 6, 3, 3).fill(COLORS.cropGreen);
    g.rect(cx + 9 + sw, cz + 5, 3, 3).fill(COLORS.cropGreen);
    // Closed bud — pale purple
    g.rect(cx + 6 + sw, cz + 2, 4, 3).fill(0x9888c0);
    g.rect(cx + 7 + sw, cz + 1, 2, 1).fill(0xb0a0d0);
  } else {
    // Full bloom — glowing moon flower
    const pulse = Math.sin(now * 2) * 0.1 + 0.9;
    g.rect(cx + 7 + sw, cz + 4, 2, 10).fill(COLORS.cropGreenDark);
    g.rect(cx + 4 + sw, cz + 7, 3, 3).fill(COLORS.cropGreen);
    g.rect(cx + 9 + sw, cz + 6, 3, 3).fill(COLORS.cropGreen);
    // Petals — silvery white with soft glow
    g.rect(cx + 5 + sw, cz + 1, 6, 5).fill({ color: 0xd0c8e8, alpha: pulse });
    g.rect(cx + 4 + sw, cz + 2, 8, 3).fill({ color: 0xd0c8e8, alpha: pulse });
    g.rect(cx + 6 + sw, cz + 0, 4, 1).fill({ color: 0xe8e0f8, alpha: pulse });
    // Center — golden
    g.rect(cx + 7 + sw, cz + 2, 2, 2).fill({ color: 0xf0e080, alpha: pulse });
    g.rect(cx + 7 + sw, cz + 2, 1, 1).fill({ color: 0xfff8c0, alpha: pulse * 0.7 });
    // Glow effect
    g.rect(cx + 4 + sw, cz + 0, 8, 6).fill({ color: 0xe0d8f8, alpha: 0.08 * pulse });
    // Sparkle
    if (Math.sin(now * 4 + cx) > 0.7) {
      g.rect(cx + 4 + sw, cz + 1, 1, 1).fill({ color: 0xffffff, alpha: 0.6 });
    }
    g.rect(cx + 6, cz + 13, 4, 1).fill({ color: 0x000000, alpha: 0.1 });
  }
}

function drawTree(g: Graphics, tree: TreeState): void {
  if (tree.chopTime >= CHOP_HITS) return; // chopped, don't draw
  const cx = tree.x * TILE_PX + TILE_PX / 2;
  const cz = tree.z * TILE_PX + TILE_PX;
  const now = performance.now() / 1000;
  const sway = Math.sin(now * 1.2 + tree.variant * 2) * 0.6;
  const sw = Math.round(sway);

  // Shadow
  g.ellipse(cx, cz + 1, 6, 2).fill({ color: 0x000000, alpha: 0.15 });

  // Trunk
  g.rect(cx - 2, cz - 12, 4, 13).fill(0x6a4830);
  g.rect(cx - 1, cz - 12, 2, 13).fill(0x7a5a3a);
  // Trunk highlight
  g.rect(cx, cz - 10, 1, 8).fill({ color: 0x8a6a4a, alpha: 0.5 });
  // Bark texture
  g.rect(cx - 2, cz - 8, 1, 1).fill(0x5a3820);
  g.rect(cx + 1, cz - 5, 1, 1).fill(0x5a3820);

  // Canopy — layered circles
  const leafDark = 0x2e7a1e;
  const leafMid = 0x3e9a2e;
  const leafLight = 0x5aba3e;
  const leafHighlight = 0x70cc50;

  // Bottom canopy layer
  g.rect(cx - 7 + sw, cz - 16, 14, 6).fill(leafDark);
  g.rect(cx - 6 + sw, cz - 17, 12, 1).fill(leafDark);
  g.rect(cx - 6 + sw, cz - 10, 12, 1).fill(leafDark);

  // Middle canopy
  g.rect(cx - 6 + sw, cz - 20, 12, 6).fill(leafMid);
  g.rect(cx - 5 + sw, cz - 21, 10, 1).fill(leafMid);

  // Top canopy
  g.rect(cx - 4 + sw, cz - 23, 8, 4).fill(leafLight);
  g.rect(cx - 3 + sw, cz - 24, 6, 1).fill(leafLight);
  g.rect(cx - 2 + sw, cz - 25, 4, 1).fill(leafHighlight);

  // Leaf highlights (dappled light)
  const r = seededRandom(tree.variant * 999);
  for (let i = 0; i < 6; i++) {
    const lx = Math.floor(r() * 10) - 5;
    const lz = Math.floor(r() * 10) - 20;
    g.rect(cx + lx + sw, cz + lz, 2, 1).fill({ color: leafHighlight, alpha: 0.6 });
  }
  // Dark depth spots
  for (let i = 0; i < 4; i++) {
    const lx = Math.floor(r() * 10) - 5;
    const lz = Math.floor(r() * 8) - 18;
    g.rect(cx + lx + sw, cz + lz, 2, 2).fill({ color: 0x1e6a10, alpha: 0.4 });
  }

  // Chop damage indicator
  if (tree.chopTime > 0 && tree.chopTime < CHOP_HITS) {
    // Axe marks on trunk
    for (let i = 0; i < tree.chopTime; i++) {
      g.rect(cx - 2, cz - 6 + i * 3, 3, 1).fill(0xc4a870);
      g.rect(cx - 2, cz - 5 + i * 3, 2, 1).fill(0x4a2810);
    }
  }
}

function drawTreeStump(g: Graphics, tree: TreeState): void {
  if (tree.chopTime < CHOP_HITS) return;
  const cx = tree.x * TILE_PX + TILE_PX / 2;
  const cz = tree.z * TILE_PX + TILE_PX;

  // Shadow
  g.ellipse(cx, cz + 1, 4, 1).fill({ color: 0x000000, alpha: 0.1 });
  // Stump
  g.rect(cx - 3, cz - 3, 6, 4).fill(0x6a4830);
  g.rect(cx - 2, cz - 3, 4, 1).fill(0x8a6a4a);
  // Tree rings on top
  g.rect(cx - 2, cz - 3, 4, 1).fill(0x9a7a50);
  g.rect(cx - 1, cz - 3, 2, 1).fill(0xaa8a5a);
}

// Falling leaf particles from trees
interface LeafParticle {
  x: number; z: number; life: number; drift: number; speed: number; color: number;
}
const leafParticles: LeafParticle[] = [];
let leafSpawnTimer = 0;

function spawnLeafParticles(): void {
  for (const tree of trees) {
    if (tree.chopTime >= CHOP_HITS) continue;
    if (Math.random() > 0.3) continue;
    const cx = tree.x * TILE_PX + TILE_PX / 2;
    const cz = tree.z * TILE_PX - 8;
    leafParticles.push({
      x: cx + (Math.random() - 0.5) * 10,
      z: cz + Math.random() * 6,
      life: 0,
      drift: (Math.random() - 0.5) * 8,
      speed: 4 + Math.random() * 6,
      color: [0x5aba3e, 0x3e9a2e, 0x70cc50, 0x90d86a][Math.floor(Math.random() * 4)]!,
    });
  }
}

function updateLeafParticles(dt: number): void {
  leafSpawnTimer -= dt;
  if (leafSpawnTimer <= 0) { spawnLeafParticles(); leafSpawnTimer = 1.5 + Math.random() * 2; }
  for (let i = leafParticles.length - 1; i >= 0; i--) {
    const p = leafParticles[i]!;
    p.life += dt * 0.4;
    p.x += Math.sin(p.life * 3 + p.drift) * p.drift * dt;
    p.z += p.speed * dt;
    if (p.life >= 1) leafParticles.splice(i, 1);
  }
}

function drawLeafParticles(g: Graphics): void {
  for (const p of leafParticles) {
    const a = 1 - p.life;
    g.rect(Math.round(p.x), Math.round(p.z), 1, 1).fill({ color: p.color, alpha: a * 0.7 });
  }
}

function updateTrees(dt: number): void {
  for (const tree of trees) {
    if (tree.chopTime >= CHOP_HITS) {
      tree.regrowTimer -= dt;
      if (tree.regrowTimer <= 0) {
        tree.chopTime = 0;
        tree.regrowTimer = 0;
      }
    }
  }
}


function drawHighlight(g: Graphics, tx: number, tz: number): void {
  const x = tx * TILE_PX;
  const z = tz * TILE_PX;
  const tool = TOOLS[selectedTool]!.id;
  const color = tool === "hoe" ? COLORS.highlightHoe
    : tool === "water" ? COLORS.highlightWater
    : tool === "axe" ? COLORS.highlightHoe
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

// ── Ambient Particles (pollen/dust motes) ─────────────────
interface Mote {
  x: number;
  z: number;
  speed: number;
  drift: number;
  phase: number;
  size: number;
  alpha: number;
}

const motes: Mote[] = [];
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

function updateMotes(dt: number): void {
  const now = performance.now() / 1000;
  for (const m of motes) {
    m.x += Math.sin(m.drift + now * 0.3) * m.speed * dt;
    m.z -= m.speed * dt * 0.4;
    // Wrap around
    if (m.z < -4) { m.z = ISLAND_SIZE * TILE_PX + 4; m.x = Math.random() * ISLAND_SIZE * TILE_PX; }
    if (m.x < -4) m.x = ISLAND_SIZE * TILE_PX + 4;
    if (m.x > ISLAND_SIZE * TILE_PX + 4) m.x = -4;
  }
}

function drawMotes(g: Graphics): void {
  const now = performance.now() / 1000;
  for (const m of motes) {
    const flicker = 0.7 + Math.sin(now * 2 + m.phase) * 0.3;
    g.rect(Math.round(m.x), Math.round(m.z), m.size, m.size)
      .fill({ color: 0xf8f0d0, alpha: m.alpha * flicker });
  }
}

// ── Butterflies ────────────────────────────────────────────
interface Butterfly {
  x: number;
  z: number;
  tx: number;
  tz: number;
  color: number;
  wingPhase: number;
  speed: number;
  idleTimer: number;
}

const butterflies: Butterfly[] = [];
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

function updateButterflies(dt: number): void {
  for (const b of butterflies) {
    const dx = b.tx - b.x;
    const dz = b.tz - b.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 2) {
      b.idleTimer -= dt;
      if (b.idleTimer <= 0) {
        b.tx = (4 + Math.random() * (ISLAND_SIZE - 8)) * TILE_PX;
        b.tz = (4 + Math.random() * (ISLAND_SIZE - 8)) * TILE_PX;
        b.idleTimer = 2 + Math.random() * 4;
      }
    } else {
      b.x += (dx / dist) * b.speed * dt;
      b.z += (dz / dist) * b.speed * dt;
    }
    b.wingPhase += dt * 12;
  }
}

function drawButterflies(g: Graphics): void {
  for (const b of butterflies) {
    const wing = Math.sin(b.wingPhase);
    const wingW = Math.max(1, Math.round(Math.abs(wing) * 2));
    const bx = Math.round(b.x);
    const bz = Math.round(b.z);
    // Body
    g.rect(bx, bz, 1, 2).fill(0x2a2a2a);
    // Wings — flap open and closed
    g.rect(bx - wingW, bz, wingW, 1).fill({ color: b.color, alpha: 0.8 });
    g.rect(bx + 1, bz, wingW, 1).fill({ color: b.color, alpha: 0.8 });
    // Lower wings slightly offset
    g.rect(bx - wingW, bz + 1, Math.max(1, wingW - 1), 1).fill({ color: b.color, alpha: 0.5 });
    g.rect(bx + 1, bz + 1, Math.max(1, wingW - 1), 1).fill({ color: b.color, alpha: 0.5 });
  }
}

function renderWorld(): void {
  initWildflowers();
  groundGfx.clear();
  objectGfx.clear();
  uiGfx.clear();

  drawIslandEdge(groundGfx);

  for (let z = 0; z < ISLAND_SIZE; z++) {
    for (let x = 0; x < ISLAND_SIZE; x++) {
      if (isPondTile(x, z)) {
        drawPondTile(groundGfx, x, z);
        continue;
      }
      if (isPenTile(x, z)) continue; // pen draws its own ground
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

  drawChickenPen(groundGfx);
  drawCloudShadows(groundGfx);
  drawWildflowers(objectGfx);
  for (const crop of crops) drawCrop(objectGfx, crop);
  drawEggs(objectGfx);
  for (const tree of trees) drawTreeStump(objectGfx, tree);
  for (const tree of trees) drawTree(objectGfx, tree);
  if (trees[HIVE_TREE]) drawHiveAndBees(objectGfx, trees[HIVE_TREE]!);
  for (const mt of mapleTrees) drawMapleTree(objectGfx, mt);
  drawMapleLeaves(objectGfx);
  drawLeafParticles(objectGfx);
  drawSplashes(objectGfx);
  for (const c of chickens) drawChicken(objectGfx, c);
  drawButterflies(objectGfx);
  drawMotes(objectGfx);

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
  // Collect eggs with any tool
  if (collectEgg(x, z)) { updateHud(); return; }

  // Can't interact with pond or pen tiles
  if (isPondTile(x, z) || isPenTile(x, z)) return;

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
            coins += CROP_DEFS[crop.type].sellPrice;
            crops.splice(cropIdx, 1);
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
          crops.push({ x, z, type: CROP_IDS[selectedSeed]!, growth: 0, watered: false });
        }
      }
      break;

    case "axe": {
      const tree = trees.find((t) => t.x === x && t.z === z && t.chopTime < CHOP_HITS);
      if (tree) {
        tree.chopTime += 1;
        if (tree.chopTime >= CHOP_HITS) {
          wood += 3;
          tree.regrowTimer = TREE_REGROW_SECONDS;
        }
      }
      break;
    }
  }

  updateHud();
}

// ── HUD ───────────────────────────────────────────────────
function getTimePhase(hour: number): { icon: string; label: string; color: string } {
  if (hour < 1.5) return { icon: "🌙", label: "Night", color: "#6a6aaa" };
  if (hour < 3) return { icon: "🌅", label: "Dawn", color: "#d4705a" };
  if (hour < 5) return { icon: "☀️", label: "Morning", color: "#f8d878" };
  if (hour < 18) return { icon: "☀️", label: "Day", color: "#ffe066" };
  if (hour < 20) return { icon: "☀️", label: "Afternoon", color: "#f8c040" };
  if (hour < 21.5) return { icon: "🌇", label: "Sunset", color: "#e88040" };
  if (hour < 22.5) return { icon: "🌆", label: "Dusk", color: "#8a3060" };
  return { icon: "🌙", label: "Night", color: "#6a6aaa" };
}

function updateDayClock(): void {
  const hour = (clockTime / 3600) % 24;
  const phase = getTimePhase(hour);
  const progress = (hour / 24) * 100;

  dayClock.textContent = "";

  const icon = document.createElement("span");
  icon.className = "clock-icon";
  icon.textContent = phase.icon;
  dayClock.appendChild(icon);

  const bar = document.createElement("div");
  bar.className = "clock-bar";
  const fill = document.createElement("div");
  fill.className = "clock-fill";
  fill.style.width = `${progress}%`;
  fill.style.backgroundColor = phase.color;
  bar.appendChild(fill);
  dayClock.appendChild(bar);

  const label = document.createElement("span");
  label.className = "clock-label";
  label.textContent = phase.label;
  dayClock.appendChild(label);
}

function updateHud(): void {
  const totalHours = clockTime / 3600;
  const hours = Math.floor(totalHours) % 24;
  const minutes = Math.floor((totalHours % 1) * 60);
  hudTime.textContent = `Day ${clockDay} \u00b7 ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  hudCoins.textContent = `Coins ${coins} · Wood ${wood}`;
  updateDayClock();

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
    iconSpan.style.fontSize = "18px";
    iconSpan.style.lineHeight = "1";
    iconSpan.style.padding = "2px 0";

    const nameSpan = document.createElement("div");
    nameSpan.className = "slot-name";

    // Seeds slot shows current seed type
    if (tool.id === "seeds") {
      const seedDef = CROP_DEFS[CROP_IDS[selectedSeed]!];
      iconSpan.textContent = seedDef.icon;
      nameSpan.textContent = seedDef.label;
    } else {
      iconSpan.textContent = tool.icon;
      nameSpan.textContent = tool.label;
    }

    div.appendChild(iconSpan);
    div.appendChild(nameSpan);

    const idx = i;
    div.addEventListener("click", () => {
      if (idx === selectedTool && tool.id === "seeds") {
        // Clicking seeds again cycles seed type
        selectedSeed = (selectedSeed + 1) % CROP_IDS.length;
      }
      selectedTool = idx;
      updateHud();
    });
    // Right-click on seeds slot cycles seed type
    if (tool.id === "seeds") {
      div.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectedSeed = (selectedSeed + 1) % CROP_IDS.length;
        selectedTool = idx;
        updateHud();
      });
    }

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
    trees: trees.map((t) => ({ ...t })),
    coins,
    wood,
    selectedTool,
    selectedSeed,
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
    wood = data.wood ?? 0;
    if (data.trees) {
      for (let i = 0; i < trees.length && i < data.trees.length; i++) {
        trees[i]!.chopTime = data.trees[i].chopTime ?? 0;
        trees[i]!.regrowTimer = data.trees[i].regrowTimer ?? 0;
      }
    }
    selectedTool = data.selectedTool ?? 0;
    selectedSeed = data.selectedSeed ?? 0;
    return true;
  } catch {
    return false;
  }
}

function resetFarm(): void {
  localStorage.removeItem(SAVE_KEY);
  clockTime = DAWN_SECONDS;
  clockDay = 1;
  coins = 0;
  wood = 0;
  selectedTool = 0;
  crops.length = 0;
  eggs.length = 0;
  for (let z = 0; z < ISLAND_SIZE; z++) {
    for (let x = 0; x < ISLAND_SIZE; x++) {
      tiles[z]![x] = "grass";
    }
  }
  for (const tree of trees) {
    tree.chopTime = 0;
    tree.regrowTimer = 0;
  }
  updateHud();
}

// ── Day/Night Lighting ────────────────────────────────────
const nightOverlay = new Graphics();

// Lighting moods keyed by hour
interface LightMood {
  hour: number;
  color: number;
  alpha: number;
}

const LIGHT_MOODS: LightMood[] = [
  { hour: 0, color: 0x101830, alpha: 0.32 },    // deep night — soft blue
  { hour: 1, color: 0x101830, alpha: 0.28 },    // late night
  { hour: 1.5, color: 0x1e1838, alpha: 0.20 },  // pre-dawn
  { hour: 2, color: 0x3a1838, alpha: 0.14 },    // dawn purple
  { hour: 2.5, color: 0xc08060, alpha: 0.10 },  // sunrise peach
  { hour: 3, color: 0xd8a050, alpha: 0.07 },    // golden hour
  { hour: 4, color: 0xf0d070, alpha: 0.03 },    // warm morning
  { hour: 5, color: 0x000000, alpha: 0 },        // clear day
  { hour: 18, color: 0x000000, alpha: 0 },       // afternoon
  { hour: 19, color: 0xf0c860, alpha: 0.04 },   // golden afternoon
  { hour: 20, color: 0xd89048, alpha: 0.08 },    // sunset gold
  { hour: 20.5, color: 0xc06838, alpha: 0.12 }, // sunset warm
  { hour: 21, color: 0x6a2840, alpha: 0.18 },   // dusk purple
  { hour: 21.5, color: 0x3a1838, alpha: 0.22 }, // twilight
  { hour: 22, color: 0x181830, alpha: 0.28 },   // early night
  { hour: 22.5, color: 0x101830, alpha: 0.32 }, // night
  { hour: 24, color: 0x101830, alpha: 0.32 },   // wrap to midnight
];

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

function getLightMood(hour: number): { color: number; alpha: number } {
  for (let i = 0; i < LIGHT_MOODS.length - 1; i++) {
    const curr = LIGHT_MOODS[i]!;
    const next = LIGHT_MOODS[i + 1]!;
    if (hour >= curr.hour && hour < next.hour) {
      const t = (hour - curr.hour) / (next.hour - curr.hour);
      return {
        color: lerpColor(curr.color, next.color, t),
        alpha: curr.alpha + (next.alpha - curr.alpha) * t,
      };
    }
  }
  return LIGHT_MOODS[0]!;
}

function updateDayNight(): void {
  nightOverlay.clear();
  const hour = clockTime / 3600;
  const mood = getLightMood(hour % 24);

  if (mood.alpha > 0.005) {
    nightOverlay.rect(0, 0, app.screen.width, app.screen.height)
      .fill({ color: mood.color, alpha: mood.alpha });
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

  resetBtn.addEventListener("click", () => {
    resetFarm();
  });
}

// ── Game Loop ─────────────────────────────────────────────
let saveTimer = 0;

function gameLoop(ticker: Ticker): void {
  const dt = Math.min(ticker.deltaMS / 1000, 0.05);
  if (gameMode === "playing") {
    updateClock(dt);
    updateSplashes(dt);
    updateMotes(dt);
    updateTrees(dt);
    updateButterflies(dt);
    updateLeafParticles(dt);
    updateBees(dt);
    updateChickens(dt);
    updateMapleLeaves(dt);
    updateEggs(dt);
    updateCloudShadows(dt);

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

// ── Boot Screen ──────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runBootSequence(): Promise<void> {
  const bootScreen = document.getElementById("boot-screen")!;
  const bootText = document.getElementById("boot-text")!;

  const lines = [
    "SKY FARM OS v1.0",
    "\u00a9 2026 Cloud Systems Inc.",
    "",
    "Checking memory... 64KB OK",
    "Loading pixel engine...",
    "Initializing tile grid... 24x24",
    "Spawning chickens... 4 found",
    "Calibrating day/night cycle...",
    "Planting wildflowers...",
    "",
    "Ready.",
  ];

  for (const line of lines) {
    bootText.textContent += line + "\n";
    await sleep(line === "" ? 150 : 180 + Math.random() * 120);
  }

  await sleep(600);
  bootScreen.classList.add("fade-out");
  await sleep(600);
  bootScreen.classList.add("gone");

  // Show title screen
  overlay.classList.remove("hidden");
  overlay.classList.add("visible");
}

// ── Boot ──────────────────────────────────────────────────
async function boot(): Promise<void> {
  await runBootSequence();
  await initPixi();
  app.stage.addChild(world);
  app.stage.addChild(nightOverlay);
  setupInput();
  updateHud();
  app.ticker.add(gameLoop);
}

boot().catch(console.error);
