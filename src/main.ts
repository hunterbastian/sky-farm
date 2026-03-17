import { Application, Container, Graphics, Ticker } from "pixi.js";

// ══════════════════════════════════════════════════════════
// ── ENGINE SYSTEMS ───────────────────────────────────────
// ══════════════════════════════════════════════════════════

// ── Sound Engine (procedural Web Audio) ──────────────────
let audioCtx: AudioContext | null = null;

function ensureAudio(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = "square", volume = 0.08): void {
  const ctx = ensureAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function playNoise(duration: number, volume = 0.03): void {
  const ctx = ensureAudio();
  const bufSize = ctx.sampleRate * duration;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  src.connect(gain).connect(ctx.destination);
  src.start();
}

// Named sound effects
function sfxTill(): void { playTone(180, 0.08, "square", 0.06); setTimeout(() => playNoise(0.06, 0.04), 40); }
function sfxPlant(): void { playTone(440, 0.06, "sine", 0.05); playTone(550, 0.08, "sine", 0.04); }
function sfxWater(): void { playNoise(0.12, 0.05); playTone(800, 0.05, "sine", 0.02); }
function sfxChop(): void { playTone(120, 0.06, "square", 0.08); setTimeout(() => playNoise(0.08, 0.06), 30); }
function sfxTreeFall(): void { playTone(80, 0.2, "sawtooth", 0.06); setTimeout(() => playNoise(0.15, 0.05), 100); }
function sfxHarvest(): void {
  playTone(523, 0.08, "square", 0.05);
  setTimeout(() => playTone(659, 0.08, "square", 0.05), 80);
  setTimeout(() => playTone(784, 0.1, "square", 0.04), 160);
}
function sfxCoin(): void { playTone(880, 0.06, "square", 0.04); setTimeout(() => playTone(1320, 0.1, "square", 0.03), 60); }
function sfxEgg(): void { playTone(600, 0.05, "sine", 0.04); setTimeout(() => playTone(800, 0.06, "sine", 0.03), 50); }
function sfxSelect(): void { playTone(660, 0.04, "square", 0.03); }
function sfxError(): void { playTone(200, 0.1, "square", 0.04); }

// ── Floating Text Popups ─────────────────────────────────
interface FloatingText {
  text: string;
  x: number; z: number; // world pixel coords
  life: number; // 0→1
  color: number;
}

const floatingTexts: FloatingText[] = [];

function spawnFloatingText(tileX: number, tileZ: number, text: string, color = 0xf0e060): void {
  floatingTexts.push({
    text,
    x: tileX * TILE_PX + TILE_PX / 2,
    z: tileZ * TILE_PX,
    life: 0,
    color,
  });
}

function updateFloatingTexts(dt: number): void {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i]!;
    ft.life += dt * 0.8;
    ft.z -= dt * 20;
    if (ft.life >= 1) floatingTexts.splice(i, 1);
  }
}

function drawFloatingTexts(g: Graphics): void {
  for (const ft of floatingTexts) {
    const alpha = 1 - ft.life;
    // Draw each character as tiny pixel blocks (3x5 font)
    drawPixelString(g, ft.text, Math.round(ft.x), Math.round(ft.z), ft.color, alpha);
  }
}

// Tiny 3x5 pixel font for floating text
const PIXEL_FONT: Record<string, number[]> = {
  "0": [0xe,0x11,0x11,0x11,0xe], "1": [0x4,0xc,0x4,0x4,0xe],
  "2": [0xe,0x1,0xe,0x10,0x1f], "3": [0x1e,0x1,0xe,0x1,0x1e],
  "4": [0x11,0x11,0x1f,0x1,0x1], "5": [0x1f,0x10,0x1e,0x1,0x1e],
  "6": [0xe,0x10,0x1e,0x11,0xe], "7": [0x1f,0x1,0x2,0x4,0x4],
  "8": [0xe,0x11,0xe,0x11,0xe], "9": [0xe,0x11,0xf,0x1,0xe],
  "+": [0x0,0x4,0xe,0x4,0x0], "-": [0x0,0x0,0xe,0x0,0x0],
  " ": [0x0,0x0,0x0,0x0,0x0],
};

function drawPixelString(g: Graphics, str: string, x: number, z: number, color: number, alpha: number): void {
  let cx = x - (str.length * 4) / 2; // center
  for (const ch of str) {
    const glyph = PIXEL_FONT[ch];
    if (glyph) {
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row]! & (1 << (4 - col))) {
            g.rect(cx + col, z + row, 1, 1).fill({ color, alpha });
          }
        }
      }
    }
    cx += 4;
  }
}

// ── Screen Shake ─────────────────────────────────────────
let shakeIntensity = 0;
let shakeDecay = 0.9;
let shakeOffX = 0;
let shakeOffY = 0;

function triggerShake(intensity = 3): void {
  shakeIntensity = intensity;
}

function updateShake(): void {
  if (shakeIntensity > 0.1) {
    shakeOffX = (Math.random() - 0.5) * shakeIntensity * 2;
    shakeOffY = (Math.random() - 0.5) * shakeIntensity * 2;
    shakeIntensity *= shakeDecay;
  } else {
    shakeOffX = 0;
    shakeOffY = 0;
    shakeIntensity = 0;
  }
}

// ══════════════════════════════════════════════════════════
// ── GAME ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

// ── Types ─────────────────────────────────────────────────
type TileType = "grass" | "farmland";
type CropTypeId = "sky_wheat" | "star_berry" | "cloud_pumpkin" | "moon_flower";
type ToolId = "pointer" | "hoe" | "water" | "seeds" | "axe";

interface CropState {
  x: number;
  z: number;
  type: CropTypeId;
  growth: number;
  watered: boolean;
  growTimer: number; // real seconds accumulated toward next growth tick
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
const BASE_SCALE = 2;
let zoomLevel = 1;
let zoomTarget = 1; // smooth interpolation target
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.5;
const ZOOM_LERP = 0.12; // smoothing factor per frame
const TOOL_COUNT = 5;

// Day cycle: 3.5 min total (3 min day + 30s night)
// We map 24 game-hours onto 210 real seconds
// Dawn 5-7, Day 7-18, Sunset 18-20, Night 20-5
const WORLD_DAY_SECONDS = 86_400;
const REAL_CYCLE_SECONDS = 210; // 3.5 minutes real time per full day
const TIME_SCALE = WORLD_DAY_SECONDS / REAL_CYCLE_SECONDS;
let speedMultiplier = 1;
const DAWN_SECONDS = 9 * 3600; // spawn at 9 AM (clear day)
const SAVE_KEY = "sky_farm_save_v3";

// ── Auto-Farm Timers ─────────────────────────────────────
const AUTO_WATER_INTERVAL = 5;    // seconds between auto-watering all crops
const CROP_GROW_SECONDS = 15;     // real seconds per growth tick (replaces dawn-based growth)
const AUTO_HARVEST_DELAY = 2;     // seconds after maturity before auto-harvest
const AUTO_REPLANT = true;        // auto-replant after harvest
let autoWaterTimer = 0;
let autoHarvestTimer = 0;

const TOOLS: { id: ToolId; label: string; icon: string }[] = [
  { id: "pointer", label: "Pointer", icon: "👆" },
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
  // Animal Crossing-inspired soft pastels
  grass1: 0x7dd87a,
  grass2: 0x6ec86c,
  grass3: 0x8ee88a,
  grass4: 0x84e080,
  grass5: 0x72d06e,
  grassDark: 0x5ab858,
  grassLight: 0x98f094,
  grassHighlight: 0xb0f8a8,
  grassEdge: 0x4ea84c,
  cliffTop: 0x8ab07a,
  cliffMid: 0x6a8a5e,
  cliffFace: 0x5a7a50,
  cliffShadow: 0x4a6a42,
  cliffDeep: 0x3a5a34,
  cliffMoss: 0x6a9860,
  farmland: 0xb8986a,
  farmlandDark: 0x9a7850,
  farmlandLight: 0xc8a87a,
  farmlandWet: 0x7a6048,
  farmlandWetDark: 0x685038,
  farmlandWetSheen: 0x8ab8c8,
  water: 0x88c8e8,
  cropGreen: 0x80cc68,
  cropGreenDark: 0x60b050,
  cropGreenLight: 0x98e080,
  cropYellow: 0xf0e070,
  cropYellowLight: 0xf8f090,
  cropBrown: 0xb89868,
  highlight: 0xffffff,
  highlightHoe: 0xe8c880,
  highlightWater: 0x90c8e0,
  highlightSeeds: 0x90e078,
  highlightAxe: 0xd8c090,
  leafDark: 0x48a840,
  leafMid: 0x60c058,
  leafLight: 0x78d870,
  leafHighlight: 0x90e888,
};

// ── Trees ─────────────────────────────────────────────────
interface TreeState {
  x: number;
  z: number;
  chopTime: number; // 0 = standing, >= CHOP_HITS = chopped
  regrowTimer: number; // seconds until regrow (counts down when chopped)
  variant: number; // visual variation seed
  falling: boolean; // true while fall animation plays
  fallAngle: number; // radians, 0 → π/2
  fallDir: number; // -1 or 1 (left or right)
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
    { body: 0xf0d850, wing: 0xe0c840, dark: 0xc4a830 }, // yellow
    { body: 0xf0e060, wing: 0xe0d048, dark: 0xc8b038 }, // light yellow
    { body: 0xe8c840, wing: 0xd8b838, dark: 0xb89828 }, // golden yellow
    { body: 0xf0e878, wing: 0xe0d860, dark: 0xc8c048 }, // pale yellow
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
  const now = performance.now() / 1000;
  for (const e of eggs) {
    const px = Math.round(e.x * TILE_PX) + 6;
    const pz = Math.round(e.z * TILE_PX) + 12;
    // Gentle wobble
    const wobble = Math.sin(now * 2.5 + e.x * 7 + e.z * 11) * 0.4;
    const wx = Math.round(wobble);
    // Shadow
    g.ellipse(px + 1 + wx, pz + 3, 2, 1).fill({ color: 0x000000, alpha: 0.08 });
    // Egg — white oval
    g.rect(px + wx, pz, 3, 3).fill(0xf8f0e0);
    g.rect(px + 1 + wx, pz - 1, 1, 1).fill(0xf8f0e0);
    g.rect(px + wx, pz, 1, 1).fill({ color: 0xffffff, alpha: 0.4 });
    g.rect(px + 1 + wx, pz + 2, 2, 1).fill(0xe8e0d0);
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
  const isEdge = (dx: number, dz: number) => !isPondTile(tx + dx, tz + dz);
  const isInner = !isEdge(0,-1) && !isEdge(0,1) && !isEdge(-1,0) && !isEdge(1,0);

  // ── Depth gradient base ──
  // Inner tiles darker, edge tiles lighter
  const baseColor = isInner ? 0x3a5f82 : 0x476f95;
  g.rect(px, pz, TILE_PX, TILE_PX).fill(baseColor);

  // Subtle depth darkening toward center-bottom
  if (isInner) {
    g.rect(px, pz + 8, TILE_PX, 8).fill({ color: 0x194a7a, alpha: 0.12 });
  }

  // ── Wave layers (3 overlapping sine waves) ──
  const w1 = Math.sin(now * 1.6 + tx * 1.8 + tz * 2.2) * 0.5 + 0.5;
  const w2 = Math.sin(now * 2.3 + tx * 2.5 + tz * 1.3) * 0.5 + 0.5;
  const w3 = Math.sin(now * 1.1 + tx * 0.8 + tz * 3.1) * 0.5 + 0.5;

  // Primary wave — long horizontal ripple
  g.rect(px + 1, pz + Math.round(w1 * 6) + 2, 6, 1).fill({ color: 0x7593af, alpha: 0.35 });
  // Secondary wave — shorter, offset
  g.rect(px + 7, pz + Math.round(w2 * 5) + 5, 4, 1).fill({ color: 0x7593af, alpha: 0.25 });
  // Tertiary — subtle fill movement
  g.rect(px + 3, pz + Math.round(w3 * 8) + 1, 3, 1).fill({ color: 0xa3b7ca, alpha: 0.18 });

  // ── Light caustics ──
  // Dappled light pattern that shifts
  const cx1 = Math.round(Math.sin(now * 0.7 + tx * 4) * 4 + 7);
  const cz1 = Math.round(Math.cos(now * 0.9 + tz * 3) * 3 + 5);
  const cx2 = Math.round(Math.sin(now * 1.1 + tx * 2 + 5) * 5 + 5);
  const cz2 = Math.round(Math.cos(now * 0.6 + tz * 4 + 2) * 4 + 10);
  const causticA = (Math.sin(now * 1.5 + tx + tz) * 0.5 + 0.5) * 0.25;
  g.rect(px + cx1, pz + cz1, 2, 1).fill({ color: 0xa3b7ca, alpha: causticA });
  g.rect(px + cx2, pz + cz2, 1, 2).fill({ color: 0xd1dbe4, alpha: causticA * 0.7 });

  // ── Shimmer sparkles (multiple) ──
  for (let i = 0; i < 3; i++) {
    const phase = now * (2.5 + i * 0.7) + tx * (3 + i) + tz * (2 - i);
    const sparkle = Math.sin(phase) * 0.5 + 0.5;
    if (sparkle > 0.75) {
      const sx = Math.round(Math.sin(phase * 0.3 + i * 5) * 5 + 7);
      const sz = Math.round(Math.cos(phase * 0.4 + i * 3) * 4 + 7);
      const bright = (sparkle - 0.75) * 4; // 0→1
      g.rect(px + sx, pz + sz, 1, 1).fill({ color: 0xd1dbe4, alpha: bright * 0.6 });
      // Cross flash at peak
      if (bright > 0.7) {
        g.rect(px + sx - 1, pz + sz, 1, 1).fill({ color: 0xfefefe, alpha: bright * 0.3 });
        g.rect(px + sx + 1, pz + sz, 1, 1).fill({ color: 0xfefefe, alpha: bright * 0.3 });
      }
    }
  }

  // ── Shore edges ──
  // Light foam/froth where water meets grass
  if (isEdge(0, -1)) {
    g.rect(px, pz, TILE_PX, 1).fill({ color: 0xa3b7ca, alpha: 0.5 });
    g.rect(px, pz + 1, TILE_PX, 1).fill({ color: 0x194a7a, alpha: 0.25 });
    // Animated foam dots
    const foam = Math.sin(now * 2 + tx * 4) * 0.5 + 0.5;
    g.rect(px + Math.round(foam * 10) + 2, pz, 2, 1).fill({ color: 0xd1dbe4, alpha: 0.4 });
  }
  if (isEdge(0, 1)) {
    g.rect(px, pz + 14, TILE_PX, 2).fill({ color: 0x194a7a, alpha: 0.2 });
    g.rect(px, pz + 15, TILE_PX, 1).fill({ color: 0xa3b7ca, alpha: 0.3 });
  }
  if (isEdge(-1, 0)) {
    g.rect(px, pz, 1, TILE_PX).fill({ color: 0xa3b7ca, alpha: 0.35 });
    g.rect(px + 1, pz, 1, TILE_PX).fill({ color: 0x194a7a, alpha: 0.2 });
  }
  if (isEdge(1, 0)) {
    g.rect(px + 15, pz, 1, TILE_PX).fill({ color: 0xa3b7ca, alpha: 0.3 });
    g.rect(px + 14, pz, 1, TILE_PX).fill({ color: 0x194a7a, alpha: 0.15 });
  }
  // Diagonal corners — darken where two edges meet
  if (isEdge(0, -1) && isEdge(-1, 0)) g.rect(px, pz, 2, 2).fill({ color: 0xa3b7ca, alpha: 0.5 });
  if (isEdge(0, -1) && isEdge(1, 0)) g.rect(px + 14, pz, 2, 2).fill({ color: 0xa3b7ca, alpha: 0.5 });

  // ── Fish shadow (only on inner tiles, subtle dark shape) ──
  if (isInner) {
    const fishPhase = now * 0.4 + tx * 7 + tz * 11;
    const fishX = Math.round(Math.sin(fishPhase) * 5 + 7);
    const fishZ = Math.round(Math.cos(fishPhase * 0.7) * 4 + 8);
    const fishVisible = Math.sin(fishPhase * 0.2) * 0.5 + 0.5;
    if (fishVisible > 0.6) {
      const fa = (fishVisible - 0.6) * 2.5 * 0.12;
      // Tiny fish silhouette — 3px body + 1px tail
      const dir = Math.cos(fishPhase) > 0 ? 1 : -1;
      g.rect(px + fishX, pz + fishZ, 3, 1).fill({ color: 0x194a7a, alpha: fa });
      g.rect(px + fishX - dir * 2, pz + fishZ, 1, 1).fill({ color: 0x194a7a, alpha: fa * 0.7 });
    }
  }

  // ── Lily pads ──
  if ((tx === 4 && tz === 20) || (tx === 5 && tz === 21)) {
    const bob = Math.sin(now * 0.8 + tx * 2) * 0.5;
    const sway = Math.round(Math.sin(now * 0.5 + tx) * 1.5);
    const lilyX = px + 5 + sway;
    const lilyZ = pz + 6 + Math.round(bob);
    // Shadow on water under pad
    g.ellipse(lilyX + 2, lilyZ + 2, 3, 2).fill({ color: 0x194a7a, alpha: 0.15 });
    // Pad
    g.ellipse(lilyX + 2, lilyZ + 1, 3, 2).fill({ color: 0x3a9a30, alpha: 0.75 });
    g.rect(lilyX + 1, lilyZ, 2, 1).fill({ color: 0x50b840, alpha: 0.6 });
    // Vein line
    g.rect(lilyX + 2, lilyZ, 1, 2).fill({ color: 0x2a7820, alpha: 0.3 });
    // Flower on first pad
    if (tx === 4) {
      g.rect(lilyX + 2, lilyZ - 1, 1, 1).fill({ color: 0xf0a0c0, alpha: 0.8 });
      g.rect(lilyX + 1, lilyZ - 1, 1, 1).fill({ color: 0xf8c8d8, alpha: 0.5 });
    }
  }

  // ── Ambient ripple rings (occasional expanding circles) ──
  const ringPhase = (now * 0.3 + tx * 5.7 + tz * 3.3) % 4; // repeats every ~4s
  if (ringPhase < 1.2) {
    const ringR = ringPhase * 4;
    const ringA = (1 - ringPhase / 1.2) * 0.25;
    const rcx = px + 8 + Math.round(Math.sin(tx * 7 + tz * 3) * 3);
    const rcz = pz + 8 + Math.round(Math.cos(tx * 5 + tz * 7) * 3);
    g.ellipse(rcx, rcz, Math.round(ringR) + 1, Math.max(1, Math.round(ringR * 0.5))).stroke({ color: 0xa3b7ca, alpha: ringA, width: 1 });
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
  chopTime: number; regrowTimer: number;
  falling: boolean; fallAngle: number; fallDir: number;
}

interface MapleLeafParticle {
  x: number; z: number; life: number; drift: number; speed: number;
  color: number; groundTimer: number; onGround: boolean;
  groundX: number; groundZ: number;
}

const mapleTrees: MapleTree[] = [
  { x: 3, z: 4, variant: 1, chopTime: 0, regrowTimer: 0, falling: false, fallAngle: 0, fallDir: 1 },
  { x: 5, z: 16, variant: 2, chopTime: 0, regrowTimer: 0, falling: false, fallAngle: 0, fallDir: -1 },
];

const mapleLeaves: MapleLeafParticle[] = [];
let mapleSpawnTimer = 0;

function spawnMapleLeaves(): void {
  for (const tree of mapleTrees) {
    if (tree.chopTime >= CHOP_HITS) continue;
    if (Math.random() > 0.4) continue;
    const cx = tree.x * TILE_PX + TILE_PX / 2;
    const cz = tree.z * TILE_PX - 6;
    const colors = [0xf0a0b0, 0xd87088, 0xf8c8d0, 0xf8e8f0, 0xb85070, 0xe890a0];
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

function drawMapleStump(g: Graphics, tree: MapleTree): void {
  if (tree.chopTime < CHOP_HITS) return;
  const cx = tree.x * TILE_PX + TILE_PX / 2;
  const cz = tree.z * TILE_PX + TILE_PX;
  g.ellipse(cx, cz + 1, 3, 1).fill({ color: 0x000000, alpha: 0.08 });
  g.rect(cx - 2, cz - 3, 5, 4).fill(0x3a2418);
  g.rect(cx - 1, cz - 3, 3, 1).fill(0x5a4438);
  g.rect(cx, cz - 3, 1, 1).fill(0x6a5448);
}

function drawMapleTree(g: Graphics, tree: MapleTree): void {
  if (tree.chopTime >= CHOP_HITS && !tree.falling) return;
  const cx = tree.x * TILE_PX + TILE_PX / 2;
  const cz = tree.z * TILE_PX + TILE_PX;

  if (tree.falling) {
    const fallAlpha = Math.max(0, 1 - tree.fallAngle / (Math.PI / 2));
    const cosA = Math.cos(tree.fallAngle * tree.fallDir);
    const sinA = Math.sin(tree.fallAngle * tree.fallDir);
    const rRect = (rx: number, rz: number, w: number, h: number, color: number) => {
      for (let row = 0; row < h; row++) {
        const dx1 = rx - cx, dx2 = rx + w - cx, dz = rz + row - cz;
        g.rect(
          Math.round(cx + dx1 * cosA - dz * sinA),
          Math.round(cz + dx1 * sinA + dz * cosA),
          Math.round((dx2 - dx1) * cosA) || 1,
          Math.round((dx2 - dx1) * sinA) || 1
        ).fill({ color, alpha: fallAlpha });
      }
    };
    g.ellipse(cx, cz + 2, 9 * fallAlpha, 3 * fallAlpha).fill({ color: 0x000000, alpha: 0.10 * fallAlpha });
    rRect(cx - 2, cz - 16, 4, 17, 0x3a2418);
    rRect(cx - 8, cz - 22, 16, 6, 0xd87088);
    rRect(cx - 9, cz - 20, 18, 4, 0xf0a0b0);
    rRect(cx - 5, cz - 26, 10, 3, 0xf8c8d0);
    rRect(cx - 3, cz - 28, 6, 2, 0xf8c8d0);
    rRect(cx - 2, cz - 29, 4, 1, 0xf8e8f0);
    return;
  }

  const now = performance.now() / 1000;
  const sway = Math.sin(now * 0.8 + tree.variant * 3) * 0.4;
  const sw = Math.round(sway);

  // Shadow — wider, softer for a grand tree
  g.ellipse(cx, cz + 2, 9, 3).fill({ color: 0x000000, alpha: 0.10 });

  // Trunk — dark, gnarled, slightly twisted
  g.rect(cx - 2, cz - 16, 4, 17).fill(0x3a2418);
  g.rect(cx - 1, cz - 16, 2, 17).fill(0x4a3428);
  // Trunk highlight
  g.rect(cx, cz - 12, 1, 10).fill({ color: 0x5a4438, alpha: 0.4 });
  // Bark knots
  g.rect(cx - 2, cz - 10, 1, 2).fill(0x2a1810);
  g.rect(cx + 2, cz - 6, 1, 1).fill(0x2a1810);
  g.rect(cx - 2, cz - 4, 1, 1).fill(0x2a1810);

  // Visible branches reaching outward
  g.rect(cx - 6, cz - 14, 5, 1).fill(0x3a2418);
  g.rect(cx - 7, cz - 15, 2, 1).fill(0x3a2418);
  g.rect(cx + 2, cz - 12, 5, 1).fill(0x3a2418);
  g.rect(cx + 6, cz - 13, 2, 1).fill(0x3a2418);
  // Upward branch
  g.rect(cx - 1, cz - 18, 2, 3).fill(0x3a2418);

  // Canopy — cherry blossom: pink/white, airy, drooping
  const pink = 0xf0a0b0;
  const pinkDeep = 0xd87088;
  const pinkLight = 0xf8c8d0;
  const white = 0xf8e8f0;
  const pinkDark = 0xb85070;

  // Wide drooping canopy — bigger and more organic than oaks
  // Core canopy mass
  g.rect(cx - 8 + sw, cz - 22, 16, 6).fill(pinkDeep);
  g.rect(cx - 9 + sw, cz - 20, 18, 4).fill(pink);
  g.rect(cx - 7 + sw, cz - 24, 14, 3).fill(pink);
  // Top crown
  g.rect(cx - 5 + sw, cz - 26, 10, 3).fill(pinkLight);
  g.rect(cx - 3 + sw, cz - 28, 6, 2).fill(pinkLight);
  g.rect(cx - 2 + sw, cz - 29, 4, 1).fill(white);

  // Drooping blossom clusters on sides
  g.rect(cx - 10 + sw, cz - 18, 4, 3).fill(pink);
  g.rect(cx - 11 + sw, cz - 16, 3, 2).fill(pinkLight);
  g.rect(cx + 6 + sw, cz - 18, 5, 3).fill(pink);
  g.rect(cx + 8 + sw, cz - 16, 3, 2).fill(pinkLight);

  // Lower drooping wisps
  g.rect(cx - 8 + sw, cz - 16, 3, 2).fill({ color: pinkLight, alpha: 0.7 });
  g.rect(cx + 5 + sw, cz - 16, 3, 2).fill({ color: pinkLight, alpha: 0.7 });
  g.rect(cx - 6 + sw, cz - 14, 2, 2).fill({ color: pink, alpha: 0.5 });
  g.rect(cx + 4 + sw, cz - 14, 2, 2).fill({ color: pink, alpha: 0.5 });

  // Blossom highlights — scattered white/bright pink spots
  const r = seededRandom(tree.variant * 777);
  for (let i = 0; i < 8; i++) {
    const lx = Math.floor(r() * 16) - 8;
    const lz = Math.floor(r() * 12) - 24;
    g.rect(cx + lx + sw, cz + lz, 2, 1).fill({ color: white, alpha: 0.7 });
  }
  for (let i = 0; i < 5; i++) {
    const lx = Math.floor(r() * 14) - 7;
    const lz = Math.floor(r() * 10) - 22;
    g.rect(cx + lx + sw, cz + lz, 1, 1).fill({ color: pinkLight, alpha: 0.8 });
  }
  // Depth shadows inside canopy
  for (let i = 0; i < 4; i++) {
    const lx = Math.floor(r() * 12) - 6;
    const lz = Math.floor(r() * 8) - 22;
    g.rect(cx + lx + sw, cz + lz, 2, 2).fill({ color: pinkDark, alpha: 0.3 });
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
  { x: 19, z: 5, chopTime: 0, regrowTimer: 0, variant: 1, falling: false, fallAngle: 0, fallDir: 1 },
  { x: 20, z: 9, chopTime: 0, regrowTimer: 0, variant: 2, falling: false, fallAngle: 0, fallDir: -1 },
  { x: 18, z: 13, chopTime: 0, regrowTimer: 0, variant: 3, falling: false, fallAngle: 0, fallDir: 1 },
];
// ── Bee Species & Hives ──────────────────────────────────
type BeeSpecies = "honeybee" | "bumblebee" | "mason";

interface BeeSpeciesDef {
  bodyColor: number;
  stripeColor: number;
  wingAlpha: number;
  speed: [number, number];     // min, max angular speed
  size: number;                // 1 = normal, 1.5 = chunky
  honeyInterval: [number, number]; // seconds between honey drops
  honeyValue: number;
  hiveAccent: number;          // hive tint accent
}

const BEE_SPECIES: Record<BeeSpecies, BeeSpeciesDef> = {
  honeybee: {
    bodyColor: 0xf0d040, stripeColor: 0x2a2a2a, wingAlpha: 0.5,
    speed: [1.5, 3.5], size: 1,
    honeyInterval: [18, 30], honeyValue: 8,
    hiveAccent: 0xd4a840,
  },
  bumblebee: {
    bodyColor: 0xf0c020, stripeColor: 0x1a1a1a, wingAlpha: 0.4,
    speed: [0.8, 1.8], size: 1.5,
    honeyInterval: [25, 40], honeyValue: 12,
    hiveAccent: 0xc89030,
  },
  mason: {
    bodyColor: 0x50a0d0, stripeColor: 0x284060, wingAlpha: 0.6,
    speed: [2.0, 4.0], size: 1,
    honeyInterval: [22, 35], honeyValue: 10,
    hiveAccent: 0x6090a8,
  },
};

interface Bee {
  angle: number;
  radius: number;
  speed: number;
  zOff: number;
  phase: number;
  species: BeeSpecies;
  // Foraging state
  mode: "orbiting" | "flying-out" | "at-flower" | "flying-back";
  forageCooldown: number; // time until next forage attempt
  targetFlower: Wildflower | null;
  worldX: number; worldZ: number; // current world-pixel position when foraging
  startX: number; startZ: number; // departure point
  flightProgress: number; // 0→1 interpolation
  flowerTime: number; // time spent at flower
  hasPollen: boolean;
}

interface Hive {
  treeIndex: number;
  species: BeeSpecies;
  bees: Bee[];
  honeyTimer: number;
}

interface HoneyDrop {
  x: number; z: number; age: number; species: BeeSpecies;
}

const honeyDrops: HoneyDrop[] = [];

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

const hives: Hive[] = [
  { treeIndex: 0, species: "mason", bees: makeBees("mason", 4), honeyTimer: 15 + Math.random() * 10 },
  { treeIndex: 1, species: "honeybee", bees: makeBees("honeybee", 5), honeyTimer: 10 + Math.random() * 10 },
  { treeIndex: 2, species: "bumblebee", bees: makeBees("bumblebee", 3), honeyTimer: 20 + Math.random() * 10 },
];

function getHiveWorldPos(hive: Hive): { hx: number; hz: number } | null {
  const tree = trees[hive.treeIndex];
  if (!tree) return null;
  const cx = tree.x * TILE_PX + TILE_PX / 2;
  const cz = tree.z * TILE_PX + TILE_PX;
  const now = performance.now() / 1000;
  const sw = Math.round(Math.sin(now * 0.9 + tree.variant * 2) * 0.5);
  return { hx: cx + 5 + sw + 2, hz: cz - 16 + 4 };
}

function findNearestFlower(wx: number, wz: number): Wildflower | null {
  if (wildflowers.length === 0) return null;
  let best: Wildflower | null = null;
  let bestDist = Infinity;
  for (const f of wildflowers) {
    const dx = f.x - wx;
    const dz = f.z - wz;
    const d = dx * dx + dz * dz;
    if (d < bestDist) { bestDist = d; best = f; }
  }
  // Only forage within reasonable range (half the island)
  if (bestDist > (ISLAND_SIZE * TILE_PX * 0.6) ** 2) return null;
  return best;
}

const FLIGHT_SPEED = 1.8; // flight progress per second
const FLOWER_VISIT_TIME = 1.5; // seconds at flower

function updateBees(dt: number): void {
  const now = performance.now() / 1000;
  for (const hive of hives) {
    const tree = trees[hive.treeIndex];
    if (!tree || tree.chopTime >= CHOP_HITS || tree.falling) continue;

    const hivePos = getHiveWorldPos(hive);

    for (const b of hive.bees) {
      switch (b.mode) {
        case "orbiting":
          b.angle += b.speed * dt;
          b.zOff = Math.sin(now * 3 + b.phase) * 3;
          // Try to forage
          b.forageCooldown -= dt;
          if (b.forageCooldown <= 0 && hivePos) {
            const flower = findNearestFlower(hivePos.hx, hivePos.hz);
            if (flower) {
              b.targetFlower = flower;
              b.mode = "flying-out";
              b.flightProgress = 0;
              b.hasPollen = false;
              // Compute orbit position as start point
              if (hivePos) {
                b.startX = hivePos.hx + Math.cos(b.angle) * b.radius;
                b.startZ = hivePos.hz + Math.sin(b.angle) * b.radius * 0.5 + b.zOff;
              }
            }
            b.forageCooldown = 8 + Math.random() * 20;
          }
          break;

        case "flying-out":
          b.flightProgress += FLIGHT_SPEED * dt;
          if (b.targetFlower) {
            const t = Math.min(b.flightProgress, 1);
            const ease = t * t * (3 - 2 * t); // smoothstep
            b.worldX = b.startX + (b.targetFlower.x - b.startX) * ease;
            b.worldZ = b.startZ + (b.targetFlower.z - b.startZ) * ease;
            // Arc upward in flight
            b.zOff = -Math.sin(t * Math.PI) * 8;
          }
          if (b.flightProgress >= 1) {
            b.mode = "at-flower";
            b.flowerTime = FLOWER_VISIT_TIME + Math.random() * 1;
            b.zOff = 0;
          }
          break;

        case "at-flower":
          b.flowerTime -= dt;
          // Little hover wobble at flower
          b.zOff = Math.sin(now * 5 + b.phase) * 1.5;
          if (b.targetFlower) {
            b.worldX = b.targetFlower.x + Math.sin(now * 3 + b.phase) * 1;
            b.worldZ = b.targetFlower.z - 2 + b.zOff;
          }
          if (b.flowerTime <= 0) {
            b.mode = "flying-back";
            b.flightProgress = 0;
            b.hasPollen = true;
            if (b.targetFlower) {
              b.startX = b.targetFlower.x;
              b.startZ = b.targetFlower.z;
            }
          }
          break;

        case "flying-back": {
          b.flightProgress += FLIGHT_SPEED * dt;
          const hp = hivePos;
          if (hp) {
            const t = Math.min(b.flightProgress, 1);
            const ease = t * t * (3 - 2 * t);
            b.worldX = b.startX + (hp.hx - b.startX) * ease;
            b.worldZ = b.startZ + (hp.hz - b.startZ) * ease;
            b.zOff = -Math.sin(t * Math.PI) * 8;
          }
          if (b.flightProgress >= 1) {
            b.mode = "orbiting";
            b.forageCooldown = 6 + Math.random() * 15;
            b.targetFlower = null;
            b.zOff = 0;
            // Returning with pollen speeds up honey production
            if (b.hasPollen) {
              hive.honeyTimer = Math.max(0, hive.honeyTimer - 3);
              b.hasPollen = false;
            }
          }
          break;
        }
      }
    }

    // Honey production
    hive.honeyTimer -= dt;
    if (hive.honeyTimer <= 0 && honeyDrops.length < 8) {
      const def = BEE_SPECIES[hive.species];
      honeyDrops.push({
        x: tree.x + (Math.random() - 0.5) * 2,
        z: tree.z + 1 + Math.random(),
        age: 0,
        species: hive.species,
      });
      hive.honeyTimer = def.honeyInterval[0] + Math.random() * (def.honeyInterval[1] - def.honeyInterval[0]);
    }
  }
}

function updateHoney(dt: number): void {
  for (const h of honeyDrops) h.age += dt;
}

function collectHoney(tx: number, tz: number): number {
  for (let i = honeyDrops.length - 1; i >= 0; i--) {
    const h = honeyDrops[i]!;
    if (Math.abs(Math.round(h.x) - tx) <= 1 && Math.abs(Math.round(h.z) - tz) <= 1) {
      const value = BEE_SPECIES[h.species].honeyValue;
      honeyDrops.splice(i, 1);
      coins += value;
      return value;
    }
  }
  return 0;
}

function drawHiveAndBees(g: Graphics, hive: Hive): void {
  const tree = trees[hive.treeIndex];
  if (!tree || tree.chopTime >= CHOP_HITS || tree.falling) return;
  const def = BEE_SPECIES[hive.species];
  const cx = tree.x * TILE_PX + TILE_PX / 2;
  const cz = tree.z * TILE_PX + TILE_PX;
  const now = performance.now() / 1000;
  const sway = Math.sin(now * 0.9 + tree.variant * 2) * 0.5;
  const sw = Math.round(sway);
  const hiveX = cx + 5 + sw;
  const hiveZ = cz - 16;

  // Branch stub
  g.rect(hiveX + 1, hiveZ, 1, 2).fill(0x6a4830);
  g.rect(hiveX, hiveZ, 3, 1).fill(0x5a3820);

  // Beehive body — tinted by species
  const hz = hiveZ + 2;
  const accent = def.hiveAccent;
  const dark = accent & 0xd0d0d0; // slightly darker
  g.rect(hiveX, hz, 4, 4).fill(accent);
  g.rect(hiveX - 1, hz + 1, 6, 2).fill(accent);
  g.rect(hiveX - 1, hz + 1, 6, 1).fill(dark);
  g.rect(hiveX, hz + 3, 4, 1).fill(dark);
  g.rect(hiveX + 1, hz - 1, 2, 1).fill(accent);
  g.rect(hiveX + 1, hz + 2, 2, 1).fill(0x4a3018);
  g.rect(hiveX, hz, 2, 1).fill({ color: 0xf0d060, alpha: 0.5 });

  // Bees — orbiting or foraging
  for (const b of hive.bees) {
    let ix: number, iz: number;

    if (b.mode === "orbiting") {
      ix = Math.round(hiveX + 2 + Math.cos(b.angle) * b.radius);
      iz = Math.round(hz + 2 + Math.sin(b.angle) * b.radius * 0.5 + b.zOff);
    } else {
      // Foraging — use world position
      ix = Math.round(b.worldX);
      iz = Math.round(b.worldZ + b.zOff);
    }

    const s = def.size;
    if (s > 1) {
      g.rect(ix - 1, iz, 3, 2).fill(def.bodyColor);
      g.rect(ix, iz, 1, 2).fill(def.stripeColor);
      g.rect(ix + 1, iz + 1, 1, 1).fill(def.stripeColor);
    } else {
      g.rect(ix, iz, 2, 1).fill(def.bodyColor);
      g.rect(ix + 1, iz, 1, 1).fill(def.stripeColor);
    }

    // Pollen dot when carrying
    if (b.hasPollen) {
      g.rect(ix, iz + 1, 1, 1).fill(0xf0d060);
    }

    // Wings
    const wingUp = Math.sin(now * 20 + b.phase) > 0;
    if (wingUp) {
      g.rect(ix, iz - 1, 1, 1).fill({ color: 0xf0f0f0, alpha: def.wingAlpha });
      g.rect(ix + 1, iz - 1, 1, 1).fill({ color: 0xf0f0f0, alpha: def.wingAlpha * 0.6 });
    }
  }
}

function drawHoney(g: Graphics): void {
  const now = performance.now() / 1000;
  for (const h of honeyDrops) {
    const px = Math.round(h.x * TILE_PX) + 6;
    const pz = Math.round(h.z * TILE_PX) + 10;
    const wobble = Math.sin(now * 2 + h.x * 5 + h.z * 7) * 0.4;
    const wx = Math.round(wobble);
    const glow = 0.2 + Math.sin(now * 1.5 + h.x) * 0.1;

    // Glow
    g.ellipse(px + 1 + wx, pz + 1, 3, 2).fill({ color: 0xf0d060, alpha: glow });
    // Shadow
    g.ellipse(px + 1 + wx, pz + 3, 2, 1).fill({ color: 0x000000, alpha: 0.08 });

    // Honey jar — species tinted
    const jarColor = h.species === "mason" ? 0x80c0e0 : h.species === "bumblebee" ? 0xe0a820 : 0xf0c840;
    const jarDark = h.species === "mason" ? 0x5090b0 : h.species === "bumblebee" ? 0xc08810 : 0xd0a830;
    // Jar body
    g.rect(px + wx, pz, 3, 3).fill(jarColor);
    g.rect(px + wx, pz + 2, 3, 1).fill(jarDark);
    // Lid
    g.rect(px + wx, pz - 1, 3, 1).fill(0xe8e0d0);
    // Highlight
    g.rect(px + wx, pz, 1, 1).fill({ color: 0xffffff, alpha: 0.4 });
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
    g.rect(Math.round(s.x), Math.round(s.z), sz, sz).fill({ color: 0x7593af, alpha: alpha * 0.7 });
    // Lighter center for sheen
    if (sz > 1 && alpha > 0.3) {
      g.rect(Math.round(s.x), Math.round(s.z), 1, 1).fill({ color: 0xd1dbe4, alpha: alpha * 0.5 });
    }
  }
}

// ── Dirt Puff (Hoe) ──────────────────────────────────────
interface DirtPuff { x: number; z: number; vx: number; vz: number; life: number; size: number; color: number; }
const dirtPuffs: DirtPuff[] = [];

function spawnDirtPuff(tileX: number, tileZ: number): void {
  const cx = tileX * TILE_PX + TILE_PX / 2;
  const cz = tileZ * TILE_PX + TILE_PX / 2;
  const colors = [0x8b7355, 0x6b5335, 0xa09070, 0x7a6345];
  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 6 + Math.random() * 12;
    dirtPuffs.push({
      x: cx + (Math.random() - 0.5) * 4,
      z: cz + (Math.random() - 0.5) * 2,
      vx: Math.cos(angle) * speed,
      vz: Math.sin(angle) * speed * 0.6 - 4, // bias upward
      life: 0,
      size: 1 + Math.random(),
      color: colors[Math.floor(Math.random() * colors.length)]!,
    });
  }
}

function updateDirtPuffs(dt: number): void {
  for (let i = dirtPuffs.length - 1; i >= 0; i--) {
    const p = dirtPuffs[i]!;
    p.life += dt * 1.5;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.vx *= 0.9;
    p.vz *= 0.9;
    if (p.life >= 1) dirtPuffs.splice(i, 1);
  }
}

function drawDirtPuffs(g: Graphics): void {
  for (const p of dirtPuffs) {
    const alpha = (1 - p.life) * 0.6;
    if (alpha <= 0) continue;
    const sz = Math.max(1, Math.round(p.size * (1 + p.life * 0.5)));
    g.rect(Math.round(p.x), Math.round(p.z), sz, sz).fill({ color: p.color, alpha });
  }
}

// ── Seed Pop (Planting) ──────────────────────────────────
interface SeedPop { x: number; z: number; vz: number; life: number; color: number; }
const seedPops: SeedPop[] = [];

function spawnSeedPop(tileX: number, tileZ: number): void {
  const cx = tileX * TILE_PX + TILE_PX / 2;
  const cz = tileZ * TILE_PX + TILE_PX / 2;
  const colors = [0x7ecc5a, 0x5aba3e, 0xa0e878, 0xd4f0a0];
  for (let i = 0; i < 4; i++) {
    seedPops.push({
      x: cx + (Math.random() - 0.5) * 6,
      z: cz,
      vz: -8 - Math.random() * 12,
      life: 0,
      color: colors[Math.floor(Math.random() * colors.length)]!,
    });
  }
}

function updateSeedPops(dt: number): void {
  for (let i = seedPops.length - 1; i >= 0; i--) {
    const p = seedPops[i]!;
    p.life += dt * 2;
    p.z += p.vz * dt;
    p.vz += 30 * dt; // gravity
    if (p.life >= 1) seedPops.splice(i, 1);
  }
}

function drawSeedPops(g: Graphics): void {
  for (const p of seedPops) {
    const alpha = 1 - p.life;
    if (alpha <= 0) continue;
    g.rect(Math.round(p.x), Math.round(p.z), 1, 1).fill({ color: p.color, alpha: alpha * 0.8 });
  }
}

// ── Harvest Burst ────────────────────────────────────────
interface HarvestPart { x: number; z: number; vx: number; vz: number; life: number; color: number; }
const harvestParts: HarvestPart[] = [];

function spawnHarvestBurst(tileX: number, tileZ: number, cropType: string): void {
  const cx = tileX * TILE_PX + TILE_PX / 2;
  const cz = tileZ * TILE_PX + TILE_PX / 2;
  const colorSets: Record<string, number[]> = {
    sky_wheat: [0xf0d040, 0xd8b830, 0xf8e868, 0xc8a020],
    star_berry: [0x9060c0, 0x7040a0, 0xb080e0, 0x6030a0],
    cloud_pumpkin: [0xe88030, 0xc06020, 0xf0a050, 0xd07028],
    moon_flower: [0x80b0f0, 0x6090d0, 0xa0d0ff, 0xf0f0ff],
  };
  const colors = colorSets[cropType] ?? [0xf0d040, 0xd8b830];
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 10 + Math.random() * 20;
    harvestParts.push({
      x: cx + (Math.random() - 0.5) * 4,
      z: cz + (Math.random() - 0.5) * 4,
      vx: Math.cos(angle) * speed,
      vz: Math.sin(angle) * speed * 0.6 - 8,
      life: 0,
      color: colors[Math.floor(Math.random() * colors.length)]!,
    });
  }
}

function updateHarvestParts(dt: number): void {
  for (let i = harvestParts.length - 1; i >= 0; i--) {
    const p = harvestParts[i]!;
    p.life += dt * 1.2;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.vz += 25 * dt; // gravity
    p.vx *= 0.95;
    if (p.life >= 1) harvestParts.splice(i, 1);
  }
}

function drawHarvestParts(g: Graphics): void {
  for (const p of harvestParts) {
    const alpha = 1 - p.life;
    if (alpha <= 0) continue;
    g.rect(Math.round(p.x), Math.round(p.z), 2, 2).fill({ color: p.color, alpha: alpha * 0.9 });
  }
}

// ── Wood Chips (Axe) ─────────────────────────────────────
interface WoodChip { x: number; z: number; vx: number; vz: number; life: number; color: number; }
const woodChips: WoodChip[] = [];

function spawnWoodChips(tileX: number, tileZ: number): void {
  const cx = tileX * TILE_PX + TILE_PX / 2;
  const cz = tileZ * TILE_PX + TILE_PX / 2;
  const colors = [0x8b6914, 0x6b4e0a, 0xa08030, 0xc4a050, 0x5a3a10];
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8; // bias upward
    const speed = 12 + Math.random() * 18;
    woodChips.push({
      x: cx + (Math.random() - 0.5) * 6,
      z: cz - 4,
      vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
      vz: Math.sin(angle) * speed,
      life: 0,
      color: colors[Math.floor(Math.random() * colors.length)]!,
    });
  }
}

function updateWoodChips(dt: number): void {
  for (let i = woodChips.length - 1; i >= 0; i--) {
    const p = woodChips[i]!;
    p.life += dt * 1.4;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.vz += 35 * dt; // gravity
    p.vx *= 0.95;
    if (p.life >= 1) woodChips.splice(i, 1);
  }
}

function drawWoodChips(g: Graphics): void {
  for (const p of woodChips) {
    const alpha = 1 - p.life;
    if (alpha <= 0) continue;
    g.rect(Math.round(p.x), Math.round(p.z), 2, 1).fill({ color: p.color, alpha: alpha * 0.8 });
  }
}

// ── Crop Growth Sparkle (Dawn) ───────────────────────────
interface Sparkle { x: number; z: number; life: number; }
const sparkles: Sparkle[] = [];

function spawnGrowthSparkles(tileX: number, tileZ: number): void {
  const cx = tileX * TILE_PX + TILE_PX / 2;
  const cz = tileZ * TILE_PX + TILE_PX / 2;
  for (let i = 0; i < 3; i++) {
    sparkles.push({
      x: cx + (Math.random() - 0.5) * 8,
      z: cz + (Math.random() - 0.5) * 8 - 4,
      life: 0,
    });
  }
}

function updateSparkles(dt: number): void {
  for (let i = sparkles.length - 1; i >= 0; i--) {
    const s = sparkles[i]!;
    s.life += dt * 1.8;
    s.z -= dt * 6;
    if (s.life >= 1) sparkles.splice(i, 1);
  }
}

function drawSparkles(g: Graphics): void {
  for (const s of sparkles) {
    // Pulse in then out
    const brightness = s.life < 0.3 ? s.life / 0.3 : 1 - (s.life - 0.3) / 0.7;
    if (brightness <= 0) continue;
    const sz = brightness > 0.5 ? 2 : 1;
    g.rect(Math.round(s.x), Math.round(s.z), sz, sz).fill({ color: 0xf8f0a0, alpha: brightness * 0.9 });
    // Cross sparkle at peak
    if (brightness > 0.6) {
      g.rect(Math.round(s.x) - 1, Math.round(s.z), 1, 1).fill({ color: 0xffffff, alpha: brightness * 0.5 });
      g.rect(Math.round(s.x) + sz, Math.round(s.z), 1, 1).fill({ color: 0xffffff, alpha: brightness * 0.5 });
      g.rect(Math.round(s.x), Math.round(s.z) - 1, 1, 1).fill({ color: 0xffffff, alpha: brightness * 0.4 });
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
const hudWood = el<HTMLSpanElement>("hud-wood");
const toolbarEl = el<HTMLDivElement>("toolbar");
const startBtn = el<HTMLButtonElement>("start-btn");
const resetBtn = el<HTMLButtonElement>("reset-btn");
const changelogBtn = el<HTMLButtonElement>("changelog-btn");
const changelogPanel = el<HTMLDivElement>("changelog-panel");
const changelogEntries = el<HTMLDivElement>("changelog-entries");
const changelogClose = el<HTMLButtonElement>("changelog-close");
const dayClock = el<HTMLDivElement>("day-clock");
const gameContainer = el<HTMLDivElement>("game-container");

// ── Changelog ─────────────────────────────────────────────
const CHANGELOG = [
  {
    version: "v0.5 — The Sky Update",
    date: "Mar 13, 2026",
    changes: [
      "Island now floats in a real sky with gradient + drifting clouds",
      "Sky transitions with day/night cycle (blue, sunset, night)",
      "Tapered rocky underside beneath the island",
      "Grand LOTR-style oak trees with thick trunks and exposed roots",
      "Cherry blossom trees with pink canopy and falling petals",
      "Falling tree animation when chopping",
      "Little woodchopper character with axe swing",
      "Pointer tool for collecting eggs and harvesting",
      "5-slot toolbar: pointer, hoe, water, seeds, axe",
      "This journal!",
    ],
  },
  {
    version: "v0.4 — Game Engine",
    date: "Mar 13, 2026",
    changes: [
      "Procedural sound effects (Web Audio) for all actions",
      "Floating +coin text popups with tiny pixel font",
      "Screen shake on chop and tree fall",
      "Error sound when clicking pond or pen tiles",
    ],
  },
  {
    version: "v0.3 — Retro Aesthetic",
    date: "Mar 13, 2026",
    changes: [
      "CRT scanlines, dithering, and barrel curvature",
      "Press Start 2P pixel font throughout",
      "Boot-up terminal sequence before title",
      "Clickable toolbar slots (no more keyboard-only)",
    ],
  },
  {
    version: "v0.2 — Farm Life",
    date: "Mar 13, 2026",
    changes: [
      "4 crop types: sky wheat, star berry, cloud pumpkin, moon flower",
      "Chicken pen with fencing, straw, trough, hay bale",
      "Chickens lay eggs — click to collect for coins",
      "Pond with animated water, ripples, lily pads",
      "Cloud shadows drifting across the island",
      "30 wildflowers scattered on grass",
      "Japanese maple trees with falling leaves",
      "Day/night cycle with 17 lighting moods",
    ],
  },
  {
    version: "v0.1 — First Harvest",
    date: "Mar 12, 2026",
    changes: [
      "Floating grass island with 24x24 tile grid",
      "Hoe, water, seeds, axe tools",
      "3 oak trees (choppable, regrow after 60s)",
      "Beehive with orbiting bees",
      "4 yellow chickens with idle animations",
      "Butterflies and pollen motes",
      "Save/load via localStorage",
    ],
  },
];

function buildChangelog(): void {
  changelogEntries.textContent = "";
  for (const entry of CHANGELOG) {
    const div = document.createElement("div");
    div.className = "changelog-version";
    const h2 = document.createElement("h2");
    h2.textContent = entry.version;
    div.appendChild(h2);
    const date = document.createElement("div");
    date.className = "changelog-date";
    date.textContent = entry.date;
    div.appendChild(date);
    const ul = document.createElement("ul");
    for (const change of entry.changes) {
      const li = document.createElement("li");
      li.textContent = change;
      ul.appendChild(li);
    }
    div.appendChild(ul);
    changelogEntries.appendChild(div);
  }
}

changelogBtn.addEventListener("click", () => {
  buildChangelog();
  changelogPanel.classList.remove("hidden");
});

changelogClose.addEventListener("click", () => {
  changelogPanel.classList.add("hidden");
});

// ── Build toolbar slots once (click handlers persist) ─────
interface ToolbarSlot { div: HTMLDivElement; icon: HTMLDivElement; name: HTMLDivElement; }
const toolbarSlots: ToolbarSlot[] = [];

for (let i = 0; i < TOOL_COUNT; i++) {
  const tool = TOOLS[i]!;
  const div = document.createElement("div");
  div.className = "hotbar-slot";
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
  iconSpan.textContent = tool.icon;
  div.appendChild(iconSpan);

  const nameSpan = document.createElement("div");
  nameSpan.className = "slot-name";
  nameSpan.textContent = tool.label;
  div.appendChild(nameSpan);

  const idx = i;
  div.addEventListener("click", (e) => {
    e.stopPropagation();
    if (idx === selectedTool && tool.id === "seeds") {
      selectedSeed = (selectedSeed + 1) % CROP_IDS.length;
    }
    selectedTool = idx;
    sfxSelect();
    updateHud();
  });
  if (tool.id === "seeds") {
    div.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectedSeed = (selectedSeed + 1) % CROP_IDS.length;
      selectedTool = idx;
      sfxSelect();
      updateHud();
    });
  }

  toolbarEl.appendChild(div);
  toolbarSlots.push({ div, icon: iconSpan, name: nameSpan });
}

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
  // Handle — long wooden shaft with grain
  px(ctx, 5, 5, 1, 10, "#8b6840");
  px(ctx, 6, 5, 1, 10, "#7a5e36");
  px(ctx, 5, 8, 1, 1, "#9a7848"); // grain highlight
  px(ctx, 6, 11, 1, 1, "#6a4e2e"); // grain shadow
  // Handle wrap/grip
  px(ctx, 5, 12, 2, 1, "#5a3820");
  px(ctx, 5, 14, 2, 1, "#5a3820");
  // Handle pommel
  px(ctx, 4, 15, 3, 1, "#6a4830");
  // Axe head — curved blade shape
  px(ctx, 1, 2, 5, 4, "#8a8a8a"); // main head body
  px(ctx, 0, 3, 1, 2, "#9a9a9a"); // blade curve left
  px(ctx, 0, 2, 1, 1, "#a0a0a0"); // blade tip top
  px(ctx, 0, 5, 1, 1, "#a0a0a0"); // blade tip bottom
  px(ctx, 6, 3, 1, 2, "#707070"); // back of head
  // Blade edge — bright steel
  px(ctx, 0, 2, 1, 4, "#d0d0d0");
  px(ctx, 1, 1, 1, 1, "#c8c8c8"); // upper blade sweep
  px(ctx, 1, 6, 1, 1, "#c8c8c8"); // lower blade sweep
  // Head highlights
  px(ctx, 2, 2, 2, 1, "#b0b0b0");
  px(ctx, 1, 3, 1, 1, "#c0c0c0");
  // Head shadow
  px(ctx, 2, 5, 3, 1, "#707070");
  // Binding where head meets handle
  px(ctx, 4, 3, 2, 2, "#5a5a5a");
  px(ctx, 4, 3, 1, 1, "#6a6a6a");
}, 1, 3);

const toolCursors: Record<ToolId, string> = {
  pointer: "grab",
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
    background: 0x6aaed8,
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

  // Fabric cross-hatch — diagonal stitching pattern
  for (let i = 0; i < TILE_PX; i += 4) {
    // Forward diagonal threads \
    g.rect(ox + i, oz + i, 1, 1).fill({ color: COLORS.grassDark, alpha: 0.12 });
    if (i + 1 < TILE_PX) g.rect(ox + i + 1, oz + i + 1, 1, 1).fill({ color: COLORS.grassLight, alpha: 0.08 });
    // Back diagonal threads /
    g.rect(ox + TILE_PX - 1 - i, oz + i, 1, 1).fill({ color: COLORS.grassDark, alpha: 0.1 });
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

  // ── Tapered island underside (rocky bottom) ──
  const islandPx = ISLAND_SIZE * TILE_PX;
  const underDepth = 6; // rows of tapering rock below cliff
  const centerX = islandPx / 2;
  for (let row = 0; row < underDepth; row++) {
    const t = (row + 1) / underDepth; // 0→1 as we go deeper
    const shrink = Math.pow(t, 0.7); // easing — narrows faster at bottom
    const halfW = (islandPx / 2) * (1 - shrink * 0.6);
    const rx = centerX - halfW;
    const rz = islandPx + TILE_PX + row * TILE_PX;
    const w = halfW * 2;
    // Darkening gradient
    const alpha = 1 - t * 0.3;
    g.rect(rx, rz, w, TILE_PX).fill({ color: COLORS.cliffFace, alpha });
    // Cracks
    const rand = seededRandom(row * 333 + 7);
    for (let i = 0; i < 3; i++) {
      const cx = rx + Math.floor(rand() * (w - 4)) + 2;
      const cz = rz + Math.floor(rand() * 10) + 2;
      g.rect(cx, cz, 2, 1).fill({ color: COLORS.cliffShadow, alpha });
    }
    // Bottom darkening
    g.rect(rx, rz + TILE_PX - 3, w, 3).fill({ color: COLORS.cliffDeep, alpha: 0.3 * alpha });
  }
  // Point at very bottom
  const tipZ = islandPx + TILE_PX + underDepth * TILE_PX;
  const tipW = islandPx * 0.08;
  g.rect(centerX - tipW, tipZ, tipW * 2, 4).fill({ color: COLORS.cliffDeep, alpha: 0.6 });
  g.rect(centerX - tipW * 0.4, tipZ + 4, tipW * 0.8, 3).fill({ color: COLORS.cliffDeep, alpha: 0.4 });

  // Drop shadow beneath the island
  const shadowAlpha = 0.12;
  for (let x = -1; x <= ISLAND_SIZE; x++) {
    const sx = x * TILE_PX;
    g.rect(sx, islandPx + TILE_PX, TILE_PX, 4).fill({ color: 0x000000, alpha: shadowAlpha });
    g.rect(sx, islandPx + TILE_PX + 4, TILE_PX, 4).fill({ color: 0x000000, alpha: shadowAlpha * 0.5 });
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
      g.rect(ox + dx, oz + dz, 1, 1).fill({ color: 0xa3b7ca, alpha: 0.6 });
    }
    // Subtle wet sheen across surface
    g.rect(ox + 2, oz + 1, TILE_PX - 4, TILE_PX - 2).fill({ color: 0x476f95, alpha: 0.08 });
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
    g.rect(cx + 14, cz + 1, 1, 1).fill({ color: 0xd1dbe4, alpha: 0.4 });
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
  if (tree.chopTime >= CHOP_HITS && !tree.falling) return;
  const cx = tree.x * TILE_PX + TILE_PX / 2;
  const cz = tree.z * TILE_PX + TILE_PX;

  if (tree.falling) {
    // ── Fall animation path (closures only allocated when actually falling) ──
    const fallAlpha = Math.max(0, 1 - tree.fallAngle / (Math.PI / 2));
    const cosA = Math.cos(tree.fallAngle * tree.fallDir);
    const sinA = Math.sin(tree.fallAngle * tree.fallDir);
    const rRect = (rx: number, rz: number, w: number, h: number, color: number) => {
      for (let row = 0; row < h; row++) {
        const dx1 = rx - cx, dx2 = rx + w - cx, dz = rz + row - cz;
        const x1 = cx + dx1 * cosA - dz * sinA;
        const z1 = cz + dx1 * sinA + dz * cosA;
        const x2 = cx + dx2 * cosA - dz * sinA;
        const z2 = cz + dx2 * sinA + dz * cosA;
        g.rect(Math.round(x1), Math.round(z1), Math.round(x2 - x1) || 1, Math.round(z2 - z1) || 1)
          .fill({ color, alpha: fallAlpha });
      }
    };

    g.ellipse(cx, cz + 2, 10 * fallAlpha, 3 * fallAlpha).fill({ color: 0x000000, alpha: 0.12 * fallAlpha });
    rRect(cx - 3, cz - 18, 6, 19, 0x5a3820);
    rRect(cx - 2, cz - 18, 4, 19, 0x6a4830);
    rRect(cx - 10, cz - 22, 20, 6, COLORS.leafDark);
    rRect(cx - 9, cz - 23, 18, 1, COLORS.leafDark);
    rRect(cx - 9, cz - 28, 18, 7, COLORS.leafMid);
    rRect(cx - 8, cz - 29, 16, 1, COLORS.leafMid);
    rRect(cx - 6, cz - 32, 12, 4, COLORS.leafLight);
    rRect(cx - 5, cz - 33, 10, 1, COLORS.leafLight);
    rRect(cx - 3, cz - 34, 6, 1, COLORS.leafHighlight);
    rRect(cx - 2, cz - 35, 4, 1, COLORS.leafHighlight);
    return;
  }

  // ── Normal upright drawing — grand LOTR-style oak ──
  const now = performance.now() / 1000;
  const sw = Math.round(Math.sin(now * 0.9 + tree.variant * 2) * 0.5);

  // Shadow — wider for a grand tree
  g.ellipse(cx, cz + 2, 10, 3).fill({ color: 0x000000, alpha: 0.12 });

  // Exposed roots
  g.rect(cx - 4, cz - 1, 2, 3).fill(0x5a3820);
  g.rect(cx + 3, cz - 1, 2, 2).fill(0x5a3820);
  g.rect(cx - 5, cz, 1, 2).fill(0x4a2818);

  // Trunk — thick, gnarled
  g.rect(cx - 3, cz - 18, 6, 19).fill(0x5a3820);
  g.rect(cx - 2, cz - 18, 4, 19).fill(0x6a4830);
  g.rect(cx - 1, cz - 16, 2, 14).fill({ color: 0x7a5a3a, alpha: 0.6 });
  // Bark knots and texture
  g.rect(cx - 3, cz - 12, 1, 2).fill(0x3a2010);
  g.rect(cx + 3, cz - 8, 1, 2).fill(0x3a2010);
  g.rect(cx - 2, cz - 5, 1, 1).fill(0x3a2010);
  g.rect(cx + 2, cz - 14, 1, 1).fill(0x3a2010);
  // Trunk highlight (light side)
  g.rect(cx + 1, cz - 14, 1, 10).fill({ color: 0x8a6a4a, alpha: 0.4 });

  // Branches visible through canopy
  g.rect(cx - 7, cz - 17, 5, 1).fill(0x5a3820);
  g.rect(cx + 3, cz - 16, 6, 1).fill(0x5a3820);

  // Canopy — wide, layered, majestic
  // Deep shadow layer
  g.rect(cx - 10 + sw, cz - 22, 20, 6).fill(COLORS.leafDark);
  g.rect(cx - 9 + sw, cz - 23, 18, 1).fill(COLORS.leafDark);
  g.rect(cx - 9 + sw, cz - 16, 18, 1).fill(COLORS.leafDark);
  // Main canopy
  g.rect(cx - 9 + sw, cz - 28, 18, 7).fill(COLORS.leafMid);
  g.rect(cx - 8 + sw, cz - 29, 16, 1).fill(COLORS.leafMid);
  // Upper crown
  g.rect(cx - 6 + sw, cz - 32, 12, 4).fill(COLORS.leafLight);
  g.rect(cx - 5 + sw, cz - 33, 10, 1).fill(COLORS.leafLight);
  // Top tuft
  g.rect(cx - 3 + sw, cz - 34, 6, 1).fill(COLORS.leafHighlight);
  g.rect(cx - 2 + sw, cz - 35, 4, 1).fill(COLORS.leafHighlight);

  // Dappled light highlights
  const r = seededRandom(tree.variant * 999);
  for (let i = 0; i < 10; i++) {
    const lx = Math.floor(r() * 18) - 9;
    const lz = Math.floor(r() * 16) - 30;
    g.rect(cx + lx + sw, cz + lz, 2, 1).fill({ color: COLORS.leafHighlight, alpha: 0.5 });
  }
  // Deep shadow spots for depth
  for (let i = 0; i < 6; i++) {
    const lx = Math.floor(r() * 16) - 8;
    const lz = Math.floor(r() * 12) - 28;
    g.rect(cx + lx + sw, cz + lz, 2, 2).fill({ color: 0x1e5a10, alpha: 0.35 });
  }

  // Chop damage
  if (tree.chopTime > 0 && tree.chopTime < CHOP_HITS) {
    for (let i = 0; i < tree.chopTime; i++) {
      g.rect(cx - 3, cz - 8 + i * 3, 4, 1).fill(0xc4a870);
      g.rect(cx - 3, cz - 7 + i * 3, 3, 1).fill(0x4a2810);
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
    // Fall animation
    if (tree.falling) {
      tree.fallAngle += dt * (1.5 + tree.fallAngle * 2.5);
      if (tree.fallAngle >= Math.PI / 2) {
        tree.fallAngle = 0;
        tree.falling = false;
      }
    }
    // Regrow timer
    if (tree.chopTime >= CHOP_HITS && !tree.falling) {
      tree.regrowTimer -= dt;
      if (tree.regrowTimer <= 0) {
        tree.chopTime = 0;
        tree.regrowTimer = 0;
      }
    }
  }
  // Maple / cherry blossom trees
  for (const mt of mapleTrees) {
    if (mt.falling) {
      mt.fallAngle += dt * (1.5 + mt.fallAngle * 2.5);
      if (mt.fallAngle >= Math.PI / 2) {
        mt.fallAngle = 0;
        mt.falling = false;
      }
    }
    if (mt.chopTime >= CHOP_HITS && !mt.falling) {
      mt.regrowTimer -= dt;
      if (mt.regrowTimer <= 0) {
        mt.chopTime = 0;
        mt.regrowTimer = 0;
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
    : tool === "axe" ? COLORS.highlightAxe
    : COLORS.highlightSeeds;

  // Filled tint
  g.rect(x, z, TILE_PX, TILE_PX).fill({ color, alpha: 0.18 });
  // Border
  g.rect(x, z, TILE_PX, 1).fill({ color, alpha: 0.6 });
  g.rect(x, z, 1, TILE_PX).fill({ color, alpha: 0.6 });
  g.rect(x + TILE_PX - 1, z, 1, TILE_PX).fill({ color, alpha: 0.6 });
  g.rect(x, z + TILE_PX - 1, TILE_PX, 1).fill({ color, alpha: 0.6 });
}

// ── Little Woodchopper ────────────────────────────────────
let chopSwingTimer = 0; // >0 while swing animation plays
const CHOP_SWING_DURATION = 0.25; // seconds

function updateChopSwing(dt: number): void {
  if (chopSwingTimer > 0) chopSwingTimer = Math.max(0, chopSwingTimer - dt);
}

function triggerChopSwing(): void {
  chopSwingTimer = CHOP_SWING_DURATION;
}

function drawWoodchopper(g: Graphics, tx: number, tz: number): void {
  // Little character standing next to the tile, facing the tree
  const cx = tx * TILE_PX + TILE_PX / 2 + 6; // offset right of tile center
  const cz = tz * TILE_PX + TILE_PX - 1; // feet at bottom of tile

  // ── Body ──
  // Boots
  g.rect(cx - 2, cz - 1, 2, 2).fill(0x5a3820);
  g.rect(cx + 1, cz - 1, 2, 2).fill(0x5a3820);
  // Pants
  g.rect(cx - 2, cz - 4, 2, 3).fill(0x4a6a8a);
  g.rect(cx + 1, cz - 4, 2, 3).fill(0x4a6a8a);
  // Belt
  g.rect(cx - 2, cz - 5, 5, 1).fill(0x6a4830);
  // Shirt
  g.rect(cx - 2, cz - 8, 5, 3).fill(0xc44040);
  // Shirt highlight
  g.rect(cx - 1, cz - 7, 3, 1).fill({ color: 0xe06060, alpha: 0.5 });
  // Head (skin)
  g.rect(cx - 1, cz - 11, 4, 3).fill(0xf0c490);
  // Eyes
  g.rect(cx - 1, cz - 10, 1, 1).fill(0x2a2a2a);
  g.rect(cx + 2, cz - 10, 1, 1).fill(0x2a2a2a);
  // Hair
  g.rect(cx - 2, cz - 12, 5, 2).fill(0x6a3a1a);
  g.rect(cx - 2, cz - 11, 1, 1).fill(0x6a3a1a);

  // ── Axe in hand ──
  // Swing angle: 0 at rest (held up), swings down to ~90deg
  const swingT = chopSwingTimer > 0 ? 1 - (chopSwingTimer / CHOP_SWING_DURATION) : 0;
  const swingActive = chopSwingTimer > 0;
  // Ease-out bounce for the swing
  const eased = swingActive ? (swingT < 0.6 ? swingT / 0.6 : 1 - (swingT - 0.6) / 0.4 * 0.3) : 0;
  const angle = eased * (Math.PI / 2.2); // swing arc

  // Arm (always drawn)
  const armX = cx - 3;
  const armZ = cz - 7;

  if (swingActive) {
    // Animated arm + axe
    const cosA = Math.cos(-angle);
    const sinA = Math.sin(-angle);

    // Arm pixels (2px long, rotated)
    for (let i = 0; i < 3; i++) {
      const ax = Math.round(armX + sinA * i);
      const az = Math.round(armZ - cosA * i);
      g.rect(ax, az, 1, 1).fill(0xf0c490);
    }

    // Axe handle (extends from arm)
    for (let i = 3; i < 8; i++) {
      const hx = Math.round(armX + sinA * i);
      const hz = Math.round(armZ - cosA * i);
      g.rect(hx, hz, 1, 1).fill(0x8b6840);
    }

    // Axe head (at end of handle)
    const headX = Math.round(armX + sinA * 8);
    const headZ = Math.round(armZ - cosA * 8);
    // Blade perpendicular to handle
    for (let i = -1; i <= 1; i++) {
      g.rect(Math.round(headX + cosA * i), Math.round(headZ + sinA * i), 2, 2).fill(0xc0c0c0);
    }
    g.rect(Math.round(headX + cosA * -1), Math.round(headZ + sinA * -1), 1, 1).fill(0xe0e0e0);
  } else {
    // Resting pose: arm up holding axe over shoulder
    g.rect(armX, armZ - 2, 1, 3).fill(0xf0c490);
    // Handle going up
    g.rect(armX, armZ - 7, 1, 5).fill(0x8b6840);
    // Axe head at top
    g.rect(armX - 1, armZ - 9, 3, 2).fill(0xc0c0c0);
    g.rect(armX - 1, armZ - 9, 1, 2).fill(0xe0e0e0);
  }
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
  for (const hive of hives) drawHiveAndBees(objectGfx, hive);
  drawHoney(objectGfx);
  for (const mt of mapleTrees) drawMapleStump(objectGfx, mt);
  for (const mt of mapleTrees) drawMapleTree(objectGfx, mt);
  drawMapleLeaves(objectGfx);
  drawLeafParticles(objectGfx);
  drawSplashes(objectGfx);
  drawDirtPuffs(objectGfx);
  drawSeedPops(objectGfx);
  drawHarvestParts(objectGfx);
  drawWoodChips(objectGfx);
  drawSparkles(objectGfx);
  for (const c of chickens) drawChicken(objectGfx, c);
  drawButterflies(objectGfx);
  drawMotes(objectGfx);
  drawFloatingTexts(objectGfx);

  if (hoveredTile && hoveredTile.x >= 0 && hoveredTile.x < ISLAND_SIZE && hoveredTile.z >= 0 && hoveredTile.z < ISLAND_SIZE) {
    drawHighlight(uiGfx, hoveredTile.x, hoveredTile.z);
    // Draw woodchopper when axe is selected
    if (TOOLS[selectedTool]!.id === "axe") {
      drawWoodchopper(objectGfx, hoveredTile.x, hoveredTile.z);
    }
  }
}

function updateCamera(): void {
  // Smooth zoom interpolation
  zoomLevel += (zoomTarget - zoomLevel) * ZOOM_LERP;
  if (Math.abs(zoomTarget - zoomLevel) < 0.001) zoomLevel = zoomTarget;

  const screenW = app.screen.width;
  const screenH = app.screen.height;
  const scale = BASE_SCALE * zoomLevel;
  const centerX = (ISLAND_SIZE / 2) * TILE_PX;
  const centerZ = (ISLAND_SIZE / 2) * TILE_PX;
  world.x = screenW / 2 - centerX * scale + shakeOffX;
  world.y = screenH / 2 - centerZ * scale + shakeOffY;
  world.scale.set(scale);
}

// ── Game Logic ────────────────────────────────────────────
function updateClock(dt: number): void {
  clockTime += dt * TIME_SCALE * speedMultiplier;
  if (clockTime >= WORLD_DAY_SECONDS) {
    clockTime -= WORLD_DAY_SECONDS;
    clockDay += 1;
    dawnTick();
  }
}

function dawnTick(): void {
  // Dawn tick is now cosmetic only — auto-farm handles growth
}

function updateAutoFarm(dt: number): void {
  // ── Auto-water all crops periodically ──
  autoWaterTimer += dt;
  if (autoWaterTimer >= AUTO_WATER_INTERVAL) {
    autoWaterTimer = 0;
    for (const crop of crops) {
      if (!crop.watered) {
        crop.watered = true;
        spawnSplash(crop.x, crop.z);
      }
    }
  }

  // ── Continuous growth (real-time, not dawn-based) ──
  for (const crop of crops) {
    if (!crop.watered) continue;
    const def = CROP_DEFS[crop.type];
    if (crop.growth >= def.growDays) continue; // already mature
    crop.growTimer += dt;
    if (crop.growTimer >= CROP_GROW_SECONDS) {
      crop.growTimer -= CROP_GROW_SECONDS;
      const prev = crop.growth;
      crop.growth = Math.min(crop.growth + 1, def.growDays);
      if (crop.growth > prev) spawnGrowthSparkles(crop.x, crop.z);
    }
  }

  // ── Auto-harvest mature crops ──
  autoHarvestTimer += dt;
  if (autoHarvestTimer >= AUTO_HARVEST_DELAY) {
    autoHarvestTimer = 0;
    for (let i = crops.length - 1; i >= 0; i--) {
      const crop = crops[i]!;
      const def = CROP_DEFS[crop.type];
      if (crop.growth >= def.growDays) {
        coins += def.sellPrice;
        spawnHarvestBurst(crop.x, crop.z, crop.type);
        spawnFloatingText(crop.x, crop.z, "+" + def.sellPrice, 0xf0e060);
        sfxCoin();

        if (AUTO_REPLANT) {
          // Replant same crop type
          crop.growth = 0;
          crop.watered = false;
          crop.growTimer = 0;
          spawnSeedPop(crop.x, crop.z);
        } else {
          crops.splice(i, 1);
        }
      }
    }
  }

  // ── Auto-collect eggs ──
  for (let i = eggs.length - 1; i >= 0; i--) {
    const e = eggs[i]!;
    if (e.age > 8) { // auto-collect after 8 seconds
      eggs.splice(i, 1);
      coins += 3;
      spawnFloatingText(Math.round(e.x), Math.round(e.z), "+3", 0xf0e060);
      sfxCoin();
    }
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
            coins += price;
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
            coins += price;
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
          wood += 3;
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
          wood += 2;
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

let hudPrevCoins = -1;
let hudPrevWood = -1;
let hudPrevTool = -1;
let hudPrevSeed = -1;
let hudPrevMinute = -1;

function updateHud(): void {
  const totalHours = clockTime / 3600;
  const hours = Math.floor(totalHours) % 24;
  const minutes = Math.floor((totalHours % 1) * 60);

  // Only touch DOM when values actually changed
  if (minutes !== hudPrevMinute || clockDay !== hudPrevCoins) {
    hudTime.textContent = `Day ${clockDay} \u00b7 ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    hudPrevMinute = minutes;
  }
  if (coins !== hudPrevCoins || wood !== hudPrevWood) {
    hudCoins.textContent = `Coins ${coins}`;
    hudWood.textContent = `Wood ${wood}`;
    hudPrevCoins = coins;
    hudPrevWood = wood;
  }
  updateDayClock();

  // Only update toolbar when tool/seed selection changed
  if (selectedTool !== hudPrevTool || selectedSeed !== hudPrevSeed) {
    for (let i = 0; i < TOOL_COUNT; i++) {
      const slot = toolbarSlots[i];
      if (!slot) continue;
      const tool = TOOLS[i]!;
      slot.div.className = `hotbar-slot${i === selectedTool ? " active" : ""}`;
      if (tool.id === "seeds") {
        const seedDef = CROP_DEFS[CROP_IDS[selectedSeed]!];
        slot.icon.textContent = seedDef.icon;
        slot.name.textContent = seedDef.label;
      }
    }
    hudPrevTool = selectedTool;
    hudPrevSeed = selectedSeed;
  }
}

// ── Save / Load ───────────────────────────────────────────
function saveGame(): void {
  const data = {
    version: 3,
    clockTime,
    clockDay,
    tiles: tiles.map((row) => [...row]),
    crops: crops.map((c) => ({ ...c })),
    trees: trees.map((t) => ({ ...t })),
    mapleTrees: mapleTrees.map((t) => ({ x: t.x, z: t.z, variant: t.variant, chopTime: t.chopTime, regrowTimer: t.regrowTimer })),
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
    if (data.version !== 2 && data.version !== 3) return false;
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
    if (data.crops) {
      for (const c of data.crops) {
        crops.push({ ...c, growTimer: c.growTimer ?? 0 });
      }
    }
    coins = data.coins ?? 0;
    wood = data.wood ?? 0;
    if (data.trees) {
      for (let i = 0; i < trees.length && i < data.trees.length; i++) {
        trees[i]!.chopTime = data.trees[i].chopTime ?? 0;
        trees[i]!.regrowTimer = data.trees[i].regrowTimer ?? 0;
      }
    }
    if (data.mapleTrees) {
      for (let i = 0; i < mapleTrees.length && i < data.mapleTrees.length; i++) {
        mapleTrees[i]!.chopTime = data.mapleTrees[i].chopTime ?? 0;
        mapleTrees[i]!.regrowTimer = data.mapleTrees[i].regrowTimer ?? 0;
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
    tree.falling = false;
    tree.fallAngle = 0;
  }
  for (const mt of mapleTrees) {
    mt.chopTime = 0;
    mt.regrowTimer = 0;
    mt.falling = false;
    mt.fallAngle = 0;
  }
  updateHud();
}

// ── Sky Background ────────────────────────────────────────
const skyGfx = new Graphics();

interface SkyCloud {
  x: number; y: number; w: number; h: number; speed: number; alpha: number;
  // Anime cloud: array of puffy bumps on top
  bumps: { ox: number; oy: number; r: number }[];
}
const skyClouds: SkyCloud[] = [];
for (let i = 0; i < 10; i++) {
  const w = 80 + Math.random() * 140;
  const h = 18 + Math.random() * 22;
  // Generate 3-5 round bumps along the top for that anime cumulus look
  const bumpCount = 3 + Math.floor(Math.random() * 3);
  const bumps: { ox: number; oy: number; r: number }[] = [];
  for (let b = 0; b < bumpCount; b++) {
    const t = (b + 0.5) / bumpCount; // spread evenly
    bumps.push({
      ox: (t - 0.5) * w * 0.7,
      oy: -h * (0.3 + Math.random() * 0.4),
      r: h * (0.5 + Math.random() * 0.5),
    });
  }
  // One big center bump (the tallest puff)
  bumps.push({ ox: 0, oy: -h * 0.7, r: h * 0.8 });
  skyClouds.push({
    x: Math.random() * 2000 - 500,
    y: 80 + Math.random() * 600,
    w, h,
    speed: 2 + Math.random() * 4,
    alpha: 0.6 + Math.random() * 0.3,
    bumps,
  });
}

function updateSky(): void {
  skyGfx.clear();
  const sw = app.screen.width;
  const sh = app.screen.height;
  const hour = (clockTime / 3600) % 24;

  // Sky gradient — rich warm lighting with golden hour
  const nightTop = 0x0c1828;
  const nightBot = 0x182838;
  const preDawnTop = 0x2a2040;
  const preDawnBot = 0x483050;
  const dawnTop = 0xd87848;
  const dawnBot = 0xf8c878;
  const morningTop = 0x78b8e0;
  const morningBot = 0xc8e8f8;
  const dayTop = 0x60b0e8;
  const dayBot = 0xa8d8f8;
  const goldenTop = 0xe8a050;
  const goldenBot = 0xf8d888;
  const sunsetTop = 0xe06838;
  const sunsetBot = 0xf8b868;
  const duskTop = 0x803048;
  const duskBot = 0xc86858;
  const twilightTop = 0x282048;
  const twilightBot = 0x403058;

  // Multi-phase sky transitions
  let topColor: number, botColor: number;
  if (hour >= 2 && hour < 3.5) {
    // Pre-dawn → dawn
    const t = (hour - 2) / 1.5;
    topColor = lerpColor(nightTop, preDawnTop, t);
    botColor = lerpColor(nightBot, preDawnBot, t);
  } else if (hour >= 3.5 && hour < 5) {
    // Dawn — gorgeous orange/pink
    const t = (hour - 3.5) / 1.5;
    topColor = lerpColor(preDawnTop, dawnTop, t);
    botColor = lerpColor(preDawnBot, dawnBot, t);
  } else if (hour >= 5 && hour < 7) {
    // Dawn → morning
    const t = (hour - 5) / 2;
    topColor = lerpColor(dawnTop, morningTop, t);
    botColor = lerpColor(dawnBot, morningBot, t);
  } else if (hour >= 7 && hour < 9) {
    // Morning → clear day
    const t = (hour - 7) / 2;
    topColor = lerpColor(morningTop, dayTop, t);
    botColor = lerpColor(morningBot, dayBot, t);
  } else if (hour >= 9 && hour < 17) {
    topColor = dayTop; botColor = dayBot;
  } else if (hour >= 17 && hour < 18.5) {
    // Golden hour — warm yellow wash
    const t = (hour - 17) / 1.5;
    topColor = lerpColor(dayTop, goldenTop, t);
    botColor = lerpColor(dayBot, goldenBot, t);
  } else if (hour >= 18.5 && hour < 20) {
    // Sunset — deep orange
    const t = (hour - 18.5) / 1.5;
    topColor = lerpColor(goldenTop, sunsetTop, t);
    botColor = lerpColor(goldenBot, sunsetBot, t);
  } else if (hour >= 20 && hour < 21) {
    // Dusk — purple/red
    const t = (hour - 20) / 1;
    topColor = lerpColor(sunsetTop, duskTop, t);
    botColor = lerpColor(sunsetBot, duskBot, t);
  } else if (hour >= 21 && hour < 22) {
    // Twilight
    const t = (hour - 21) / 1;
    topColor = lerpColor(duskTop, twilightTop, t);
    botColor = lerpColor(duskBot, twilightBot, t);
  } else if (hour >= 22 && hour < 23) {
    const t = (hour - 22) / 1;
    topColor = lerpColor(twilightTop, nightTop, t);
    botColor = lerpColor(twilightBot, nightBot, t);
  } else {
    topColor = nightTop; botColor = nightBot;
  }

  // Draw sky gradient in smooth bands
  const bands = 24;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const color = lerpColor(topColor, botColor, t);
    const bandH = Math.ceil(sh / bands) + 1;
    skyGfx.rect(0, Math.floor(t * sh), sw, bandH).fill(color);
  }

  // ── Horizon glow during sunrise/sunset ──
  const isSunrise = hour >= 3.5 && hour < 7;
  const isSunset = hour >= 17 && hour < 20.5;
  if (isSunrise || isSunset) {
    let glowIntensity: number, glowColor: number, glowColor2: number;
    if (isSunrise) {
      const t = hour < 5 ? (hour - 3.5) / 1.5 : 1 - (hour - 5) / 2;
      glowIntensity = Math.max(0, t);
      glowColor = 0xf8a050;
      glowColor2 = 0xf8d888;
    } else {
      const t = hour < 19 ? (hour - 17) / 2 : 1 - (hour - 19) / 1.5;
      glowIntensity = Math.max(0, t);
      glowColor = 0xe86830;
      glowColor2 = 0xf8c060;
    }
    // Big warm glow on the horizon
    const gx = isSunrise ? sw * 0.25 : sw * 0.75;
    const gy = sh * 0.85;
    skyGfx.ellipse(gx, gy, sw * 0.5, sh * 0.35)
      .fill({ color: glowColor2, alpha: glowIntensity * 0.2 });
    skyGfx.ellipse(gx, gy, sw * 0.3, sh * 0.2)
      .fill({ color: glowColor, alpha: glowIntensity * 0.25 });
    skyGfx.ellipse(gx, gy, sw * 0.12, sh * 0.08)
      .fill({ color: 0xf8e8c0, alpha: glowIntensity * 0.4 });
  }

  // ── Stars at night ──
  const isNight = hour < 3 || hour >= 21;
  const starAlpha = hour >= 22 || hour < 2 ? 1 : hour >= 21 ? (hour - 21) / 1 : 1 - (hour - 2) / 1;
  if (starAlpha > 0) {
    const starSeed = seededRandom(777);
    for (let s = 0; s < 40; s++) {
      const sx = starSeed() * sw;
      const sy = starSeed() * sh * 0.7;
      const twinkle = Math.sin(performance.now() / 1000 * (1.5 + starSeed() * 2) + starSeed() * 10) * 0.3 + 0.7;
      const size = starSeed() < 0.15 ? 2 : 1;
      skyGfx.rect(Math.round(sx), Math.round(sy), size, size)
        .fill({ color: 0xf8f0e0, alpha: starAlpha * twinkle * 0.7 });
    }
  }

  // Drifting clouds
  const now = performance.now() / 1000;
  const cloudAlphaMul = isNight ? 0.25 : 1;

  // Cloud tint based on time of day
  let cloudTint = 0xffffff;
  let cloudShadowTint = 0xd8c8e8;
  if (hour >= 3.5 && hour < 6) {
    // Sunrise — clouds pick up warm orange/pink
    const t = Math.min(1, (hour - 3.5) / 2);
    cloudTint = lerpColor(0xffffff, 0xf8c8a0, t);
    cloudShadowTint = lerpColor(0xd8c8e8, 0xe08860, t);
  } else if (hour >= 6 && hour < 8) {
    // Fading sunrise warmth
    const t = (hour - 6) / 2;
    cloudTint = lerpColor(0xf8c8a0, 0xffffff, t);
    cloudShadowTint = lerpColor(0xe08860, 0xd8c8e8, t);
  } else if (hour >= 17 && hour < 19) {
    // Golden hour — clouds go golden
    const t = (hour - 17) / 2;
    cloudTint = lerpColor(0xffffff, 0xf8d080, t);
    cloudShadowTint = lerpColor(0xd8c8e8, 0xd87840, t);
  } else if (hour >= 19 && hour < 20.5) {
    // Sunset — deep orange/pink clouds
    const t = (hour - 19) / 1.5;
    cloudTint = lerpColor(0xf8d080, 0xf0a0a0, t);
    cloudShadowTint = lerpColor(0xd87840, 0x904060, t);
  } else if (hour >= 20.5 && hour < 22) {
    // Fading to night
    const t = (hour - 20.5) / 1.5;
    cloudTint = lerpColor(0xf0a0a0, 0xc0c8d8, t);
    cloudShadowTint = lerpColor(0x904060, 0x485068, t);
  } else if (isNight) {
    cloudTint = 0xc0c8d8;
    cloudShadowTint = 0x485068;
  }
  for (const cloud of skyClouds) {
    cloud.x += cloud.speed * (1 / 60);
    if (cloud.x > sw + 150) { cloud.x = -cloud.w - 100; cloud.y = 80 + Math.random() * (sh - 200); }
    const a = cloud.alpha * cloudAlphaMul;

    // Gentle floating motion
    const wave = Math.sin(now * 0.35 + cloud.x * 0.008) * 4;
    const breathe = 1 + Math.sin(now * 0.5 + cloud.x * 0.015) * 0.03;
    const cy = cloud.y + wave;

    // ── Anime cloud: flat bottom + round puffy bumps on top ──

    // Bottom body — wide flat ellipse (the cloud base)
    skyGfx.ellipse(cloud.x, cy, cloud.w * 0.45 * breathe, cloud.h * 0.6)
      .fill({ color: cloudTint, alpha: a * 0.9 });

    // Shadow on the underside — tinted by time of day
    skyGfx.ellipse(cloud.x, cy + cloud.h * 0.15, cloud.w * 0.4 * breathe, cloud.h * 0.4)
      .fill({ color: cloudShadowTint, alpha: a * 0.35 });

    // Bottom edge glow
    skyGfx.ellipse(cloud.x, cy + cloud.h * 0.25, cloud.w * 0.35 * breathe, cloud.h * 0.2)
      .fill({ color: cloudShadowTint, alpha: a * 0.15 });

    // Puffy round bumps on top — the anime signature
    for (const bump of cloud.bumps) {
      const bx = cloud.x + bump.ox * breathe;
      const by = cy + bump.oy;
      const br = bump.r * breathe;
      // Bump shadow (slightly below and larger)
      skyGfx.ellipse(bx, by + br * 0.15, br * 1.05, br * 0.9)
        .fill({ color: cloudShadowTint, alpha: a * 0.2 });
      // Main bump — tinted by time of day
      skyGfx.ellipse(bx, by, br, br * 0.85)
        .fill({ color: cloudTint, alpha: a * 0.95 });
      // Bright highlight on top-left — always slightly brighter than tint
      const highlightColor = lerpColor(cloudTint, 0xffffff, 0.5);
      skyGfx.ellipse(bx - br * 0.2, by - br * 0.2, br * 0.4, br * 0.35)
        .fill({ color: highlightColor, alpha: a * 0.5 });
    }
  }
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
  { hour: 0, color: 0x0c1830, alpha: 0.30 },     // deep night — indigo
  { hour: 2, color: 0x0c1830, alpha: 0.28 },     // late night
  { hour: 3, color: 0x281838, alpha: 0.20 },     // pre-dawn violet
  { hour: 3.5, color: 0x602840, alpha: 0.14 },   // dawn — rose
  { hour: 4, color: 0xd87848, alpha: 0.12 },     // sunrise — warm orange
  { hour: 5, color: 0xf0a850, alpha: 0.08 },     // golden sunrise
  { hour: 6, color: 0xf8d070, alpha: 0.05 },     // warm morning glow
  { hour: 7, color: 0xf8e888, alpha: 0.02 },     // fading warmth
  { hour: 8, color: 0x000000, alpha: 0 },         // clear day
  { hour: 16, color: 0x000000, alpha: 0 },        // afternoon
  { hour: 17, color: 0xf8e080, alpha: 0.03 },    // pre-golden
  { hour: 17.5, color: 0xf0c858, alpha: 0.06 },  // golden hour start
  { hour: 18, color: 0xe8a848, alpha: 0.10 },    // golden hour peak
  { hour: 18.5, color: 0xe08838, alpha: 0.13 },  // deep golden
  { hour: 19, color: 0xd06830, alpha: 0.16 },    // sunset orange
  { hour: 19.5, color: 0xc04830, alpha: 0.18 },  // sunset red
  { hour: 20, color: 0x803848, alpha: 0.22 },    // dusk magenta
  { hour: 20.5, color: 0x502840, alpha: 0.25 },  // purple dusk
  { hour: 21, color: 0x302040, alpha: 0.27 },    // twilight
  { hour: 22, color: 0x181830, alpha: 0.30 },    // night falls
  { hour: 24, color: 0x0c1830, alpha: 0.30 },    // wrap to midnight
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

// ── Firefly state ──────────────────────────────────────────
interface Firefly {
  x: number;   // normalized 0-1 across screen
  y: number;   // normalized 0-1 across screen
  phase: number;
  speedX: number;
  speedY: number;
  brightness: number;
}

const fireflies: Firefly[] = [];
for (let i = 0; i < 8; i++) {
  fireflies.push({
    x: 0.25 + Math.random() * 0.5,   // cluster in center (where island is)
    y: 0.3 + Math.random() * 0.4,
    phase: Math.random() * Math.PI * 2,
    speedX: 0.3 + Math.random() * 0.4,
    speedY: 0.2 + Math.random() * 0.3,
    brightness: 0.5 + Math.random() * 0.5,
  });
}

function updateDayNight(): void {
  nightOverlay.clear();
  const hour = (clockTime / 3600) % 24;
  const mood = getLightMood(hour);
  const sw = app.screen.width;
  const sh = app.screen.height;
  const now = performance.now() / 1000;

  // Helper: smooth step for fading effects in/out over hour ranges
  const smoothIn = (h: number, start: number, end: number): number =>
    Math.max(0, Math.min(1, (h - start) / (end - start)));
  const smoothOut = (h: number, start: number, end: number): number =>
    Math.max(0, Math.min(1, 1 - (h - start) / (end - start)));

  // ── Layer 1: Base ambient tint (existing mood, slightly reduced) ──
  if (mood.alpha > 0.005) {
    nightOverlay.rect(0, 0, sw, sh)
      .fill({ color: mood.color, alpha: mood.alpha * 0.85 });
  }

  // ── Layer 2: Directional sunlight gradient ──
  // Horizontal bands that make light appear to come from a direction
  const BAND_COUNT = 6;
  const bandH = sh / BAND_COUNT;

  // Sunrise (hours 3-7): warm from left side
  const sunriseStrength = Math.min(smoothIn(hour, 3, 4.5), smoothOut(hour, 5.5, 7));
  if (sunriseStrength > 0.01) {
    const sunriseColor = 0xd87848;
    for (let i = 0; i < BAND_COUNT; i++) {
      // Left side brighter (fade from left to right)
      const bandW = sw / BAND_COUNT;
      for (let j = 0; j < BAND_COUNT; j++) {
        const leftFade = 1 - j / BAND_COUNT; // 1 at left, 0 at right
        const bottomWarm = 0.6 + 0.4 * (i / BAND_COUNT); // slightly warmer toward bottom
        const a = sunriseStrength * 0.06 * leftFade * bottomWarm;
        if (a > 0.003) {
          nightOverlay.rect(j * bandW, i * bandH, bandW, bandH)
            .fill({ color: sunriseColor, alpha: a });
        }
      }
    }
  }

  // Sunset (hours 17-21): warm from right side
  const sunsetStrength = Math.min(smoothIn(hour, 17, 18), smoothOut(hour, 19.5, 21));
  if (sunsetStrength > 0.01) {
    const sunsetColor = 0xe08838;
    for (let i = 0; i < BAND_COUNT; i++) {
      const bandW = sw / BAND_COUNT;
      for (let j = 0; j < BAND_COUNT; j++) {
        const rightFade = j / BAND_COUNT; // 0 at left, 1 at right
        const bottomWarm = 0.6 + 0.4 * (i / BAND_COUNT);
        const a = sunsetStrength * 0.07 * rightFade * bottomWarm;
        if (a > 0.003) {
          nightOverlay.rect(j * bandW, i * bandH, bandW, bandH)
            .fill({ color: sunsetColor, alpha: a });
        }
      }
    }
  }

  // ── Layer 3: Vertical warmth / ground bounce ──
  // Golden hour: bottom of screen warmer
  const goldenStrength = Math.min(smoothIn(hour, 17, 17.5), smoothOut(hour, 19, 19.5));
  if (goldenStrength > 0.01) {
    const warmColor = 0xf0a848;
    const vertBands = 6;
    const vBandH = sh / vertBands;
    for (let i = 0; i < vertBands; i++) {
      const bottomBias = i / (vertBands - 1); // 0 at top, 1 at bottom
      const a = goldenStrength * 0.05 * bottomBias;
      if (a > 0.003) {
        nightOverlay.rect(0, i * vBandH, sw, vBandH)
          .fill({ color: warmColor, alpha: a });
      }
    }
  }

  // Night: ground bounce — bottom slightly lighter (blue-ish)
  const nightStrength = (hour >= 21 || hour < 3)
    ? (hour >= 21 ? smoothIn(hour, 21, 22.5) : smoothOut(hour, 1, 3))
    : 0;
  if (nightStrength > 0.01) {
    const vertBands = 4;
    const vBandH = sh / vertBands;
    for (let i = 0; i < vertBands; i++) {
      const bottomBias = i / (vertBands - 1);
      const a = nightStrength * 0.03 * bottomBias;
      if (a > 0.003) {
        nightOverlay.rect(0, i * vBandH, sw, vBandH)
          .fill({ color: 0x304060, alpha: a });
      }
    }
  }

  // ── Layer 4: Vignette ──
  // Darker edges, stronger at night. Uses concentric rects to approximate radial falloff.
  const vignetteBase = mood.alpha > 0 ? 0.04 + mood.alpha * 0.15 : 0.015;
  const vignetteRings = 5;
  for (let ring = 0; ring < vignetteRings; ring++) {
    const t = ring / vignetteRings; // 0 = outermost, approaches 1 = inner
    const inset = t * Math.min(sw, sh) * 0.2;
    const a = vignetteBase * (1 - t); // strongest at edges
    if (a > 0.003) {
      // Top edge
      nightOverlay.rect(inset, inset, sw - inset * 2, bandH * 0.5)
        .fill({ color: 0x000000, alpha: a });
      // Bottom edge
      nightOverlay.rect(inset, sh - inset - bandH * 0.5, sw - inset * 2, bandH * 0.5)
        .fill({ color: 0x000000, alpha: a });
      // Left edge
      nightOverlay.rect(inset, inset, bandH * 0.5, sh - inset * 2)
        .fill({ color: 0x000000, alpha: a });
      // Right edge
      nightOverlay.rect(sw - inset - bandH * 0.5, inset, bandH * 0.5, sh - inset * 2)
        .fill({ color: 0x000000, alpha: a });
    }
  }

  // ── Layer 5: Golden hour special effects (hours 17-19.5) ──
  const goldenHourT = Math.min(smoothIn(hour, 17, 17.5), smoothOut(hour, 19, 19.5));
  if (goldenHourT > 0.01) {
    // Warm golden wash — stronger on right side
    nightOverlay.rect(sw * 0.5, 0, sw * 0.5, sh)
      .fill({ color: 0xf8c848, alpha: goldenHourT * 0.04 });

    // Bright hotspot — lower right quadrant
    const hotspotCX = sw * 0.75;
    const hotspotCY = sh * 0.65;
    const hotspotR = Math.min(sw, sh) * 0.25;
    nightOverlay.ellipse(hotspotCX, hotspotCY, hotspotR, hotspotR * 0.8)
      .fill({ color: 0xf8d870, alpha: goldenHourT * 0.045 });
    // Inner glow
    nightOverlay.ellipse(hotspotCX, hotspotCY, hotspotR * 0.5, hotspotR * 0.4)
      .fill({ color: 0xf8e088, alpha: goldenHourT * 0.03 });

    // Long shadow streaks extending left from trees (subtle dark bands)
    const shadowAlpha = goldenHourT * 0.025;
    // Tree screen positions (approximate: island is centered, trees at tile coords)
    const scale = world.scale.x;
    for (const tree of trees) {
      if (tree.regrowTimer > 0) continue; // skip chopped trees
      const treeSX = world.x + tree.x * TILE_PX * scale;
      const treeSY = world.y + tree.z * TILE_PX * scale;
      // Shadow extends left and slightly down
      const shadowLen = 60 * goldenHourT * scale * 0.3;
      const shadowH = 4 * scale * 0.3;
      nightOverlay.rect(treeSX - shadowLen, treeSY + 8 * scale * 0.3, shadowLen, shadowH)
        .fill({ color: 0x1a1020, alpha: shadowAlpha });
    }
    for (const mt of mapleTrees) {
      if (mt.regrowTimer > 0) continue;
      const mSX = world.x + mt.x * TILE_PX * scale;
      const mSY = world.y + mt.z * TILE_PX * scale;
      const shadowLen = 50 * goldenHourT * scale * 0.3;
      const shadowH = 3 * scale * 0.3;
      nightOverlay.rect(mSX - shadowLen, mSY + 6 * scale * 0.3, shadowLen, shadowH)
        .fill({ color: 0x1a1020, alpha: shadowAlpha });
    }
  }

  // ── Layer 6: Dawn / sunrise effects (hours 3.5-6) ──
  const dawnT = Math.min(smoothIn(hour, 3.5, 4.5), smoothOut(hour, 5, 6));
  if (dawnT > 0.01) {
    // Warm rose/orange wash — stronger on left side
    nightOverlay.rect(0, 0, sw * 0.5, sh)
      .fill({ color: 0xd87858, alpha: dawnT * 0.04 });

    // Soft peachy full-screen glow
    nightOverlay.rect(0, 0, sw, sh)
      .fill({ color: 0xf0b888, alpha: dawnT * 0.025 });

    // Dawn hotspot — lower left
    const dawnCX = sw * 0.25;
    const dawnCY = sh * 0.6;
    const dawnR = Math.min(sw, sh) * 0.22;
    nightOverlay.ellipse(dawnCX, dawnCY, dawnR, dawnR * 0.8)
      .fill({ color: 0xf0a870, alpha: dawnT * 0.035 });

    // Mist near bottom (increased opacity warm band at bottom third)
    nightOverlay.rect(0, sh * 0.65, sw, sh * 0.35)
      .fill({ color: 0xd8c0a0, alpha: dawnT * 0.03 });
  }

  // ── Layer 7: Night moonlight (hours 21-3) ──
  const moonT = (hour >= 21 || hour < 3)
    ? (hour >= 21 ? smoothIn(hour, 21, 23) : smoothOut(hour, 1, 3))
    : 0;
  if (moonT > 0.01) {
    // Blue moonlight from upper area
    const moonCX = sw * 0.4;
    const moonCY = sh * 0.15;
    const moonR = Math.min(sw, sh) * 0.4;
    nightOverlay.ellipse(moonCX, moonCY, moonR, moonR * 0.6)
      .fill({ color: 0x4060a0, alpha: moonT * 0.04 });
    // Wider subtle wash
    nightOverlay.rect(0, 0, sw, sh * 0.4)
      .fill({ color: 0x283858, alpha: moonT * 0.02 });
  }

  // ── Layer 8: Fireflies at night (hours 21-3) ──
  const fireflyT = (hour >= 21 || hour < 3)
    ? (hour >= 21 ? smoothIn(hour, 21, 22) : smoothOut(hour, 2, 3))
    : 0;
  if (fireflyT > 0.01) {
    for (const fly of fireflies) {
      // Gentle sine drift
      const fx = fly.x + Math.sin(now * fly.speedX + fly.phase) * 0.04;
      const fy = fly.y + Math.cos(now * fly.speedY + fly.phase * 1.7) * 0.03;
      // Pulsing glow
      const pulse = Math.sin(now * 1.2 + fly.phase) * 0.5 + 0.5;
      const alpha = fireflyT * fly.brightness * pulse * 0.6;
      if (alpha > 0.01) {
        const px = fx * sw;
        const py = fy * sh;
        // Outer glow
        nightOverlay.ellipse(px, py, 4, 4)
          .fill({ color: 0xf8e868, alpha: alpha * 0.3 });
        // Core
        nightOverlay.rect(px - 1, py - 1, 2, 2)
          .fill({ color: 0xfffff0, alpha: alpha });
      }
    }
  }
}

// ── Input ─────────────────────────────────────────────────
// ── Smart Tap (mobile-friendly: context-aware interaction) ──
function smartTap(): void {
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

  // Tap grass → till it
  if (tile === "grass") {
    tiles[z]![x] = "farmland";
    sfxTill();
    spawnDirtPuff(x, z);
    updateHud();
    return;
  }

  // Tap farmland → plant if empty, harvest if mature
  if (tile === "farmland") {
    const cropIdx = crops.findIndex((c) => c.x === x && c.z === z);
    if (cropIdx >= 0) {
      const crop = crops[cropIdx]!;
      const def = CROP_DEFS[crop.type];
      if (crop.growth >= def.growDays) {
        // Manual harvest
        coins += def.sellPrice;
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
      // Empty farmland → plant
      crops.push({ x, z, type: CROP_IDS[selectedSeed]!, growth: 0, watered: false, growTimer: 0 });
      sfxPlant();
      spawnSeedPop(x, z);
    }
    updateHud();
    return;
  }
}

function handleTouch(clientX: number, clientY: number): void {
  // Convert touch position to renderer coordinates
  const canvas = app.canvas as HTMLCanvasElement;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (clientX - rect.left) * scaleX;
  const py = (clientY - rect.top) * scaleY;
  const worldX = (px - world.x) / world.scale.x;
  const worldZ = (py - world.y) / world.scale.y;
  const tileX = Math.floor(worldX / TILE_PX);
  const tileZ = Math.floor(worldZ / TILE_PX);
  if (tileX >= 0 && tileX < ISLAND_SIZE && tileZ >= 0 && tileZ < ISLAND_SIZE) {
    hoveredTile = { x: tileX, z: tileZ };
    smartTap();
  }
}

function setupInput(): void {
  window.addEventListener("keydown", (e) => {
    if (gameMode !== "playing") return;
    // Zoom with +/- or =/- keys
    if (e.key === "=" || e.key === "+") {
      zoomTarget = Math.min(ZOOM_MAX, zoomTarget * 1.15);
      return;
    }
    if (e.key === "-") {
      zoomTarget = Math.max(ZOOM_MIN, zoomTarget / 1.15);
      return;
    }
    const digit = parseInt(e.key, 10);
    if (digit >= 1 && digit <= TOOL_COUNT) {
      selectedTool = digit - 1;
      sfxSelect();
      updateHud();
    }
  });

  window.addEventListener("wheel", (e) => {
    if (gameMode !== "playing") return;
    // Ctrl+scroll or pinch (ctrlKey is true for trackpad pinch) = zoom
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      // Proportional zoom — multiply by a factor based on scroll intensity
      const intensity = Math.min(Math.abs(e.deltaY), 50) / 50; // normalize 0-1
      const factor = 1 + intensity * 0.15;
      if (e.deltaY > 0) {
        zoomTarget = Math.max(ZOOM_MIN, zoomTarget / factor);
      } else {
        zoomTarget = Math.min(ZOOM_MAX, zoomTarget * factor);
      }
      return;
    }
    // Plain scroll = cycle tools
    const dir = e.deltaY > 0 ? 1 : -1;
    selectedTool = ((selectedTool + dir) % TOOL_COUNT + TOOL_COUNT) % TOOL_COUNT;
    sfxSelect();
    updateHud();
  }, { passive: false });

  window.addEventListener("mousedown", (e) => {
    if (gameMode !== "playing") return;
    if (e.button === 0) {
      mouseDown = true;
      toolCooldown = 0;
      smartTap();
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) {
      mouseDown = false;
    }
  });

  window.addEventListener("mouseleave", () => { mouseDown = false; });

  // ── Touch support for mobile ──
  let lastPinchDist = 0;

  window.addEventListener("touchstart", (e) => {
    if (gameMode !== "playing") return;
    if (e.target instanceof HTMLButtonElement || (e.target as HTMLElement).closest?.("#toolbar")) return;
    // Pinch start
    if (e.touches.length === 2) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
      lastPinchDist = Math.sqrt(dx * dx + dy * dy);
      e.preventDefault();
      return;
    }
    const touch = e.touches[0];
    if (touch) {
      e.preventDefault();
      handleTouch(touch.clientX, touch.clientY);
    }
  }, { passive: false });

  window.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2 && lastPinchDist > 0) {
      e.preventDefault();
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / lastPinchDist;
      zoomTarget = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomTarget * ratio));
      lastPinchDist = dist;
    }
  }, { passive: false });

  window.addEventListener("touchend", () => {
    lastPinchDist = 0;
  });

  window.addEventListener("contextmenu", (e) => e.preventDefault());

  // Speed control buttons
  document.querySelectorAll<HTMLButtonElement>(".speed-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const speed = parseInt(btn.dataset.speed ?? "1", 10);
      speedMultiplier = speed;
      document.querySelectorAll(".speed-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  startBtn.addEventListener("click", () => {
    loadGame();
    gameMode = "playing";
    overlay.classList.add("hidden");
    overlay.classList.remove("visible");
    hud.classList.remove("hidden");
    document.getElementById("hud-left")?.classList.remove("hidden");
    document.getElementById("hud-right")?.classList.remove("hidden");
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
    updateDirtPuffs(dt);
    updateSeedPops(dt);
    updateHarvestParts(dt);
    updateWoodChips(dt);
    updateSparkles(dt);
    updateMotes(dt);
    updateTrees(dt);
    updateButterflies(dt);
    updateLeafParticles(dt);
    updateBees(dt);
    updateHoney(dt);
    updateChickens(dt);
    updateMapleLeaves(dt);
    updateEggs(dt);
    updateCloudShadows(dt);
    updateFloatingTexts(dt);
    updateShake();
    updateChopSwing(dt);
    updateAutoFarm(dt);

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
  updateSky();
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
    "SkyFarm BIOS v1.03",
    "(C) 2026 Cloud Systems Inc.",
    "",
    "Detecting hardware... OK",
    "Memory Test: 640K OK",
    "Loading SkyFarm.exe...",
    "Tile Grid: 24x24 initialized",
    "Livestock: 4 chickens found",
    "Day/Night cycle: calibrated",
    "Wildflower seed: planted",
    "",
    "Starting Windows...",
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
  app.stage.addChild(skyGfx);
  app.stage.addChild(world);
  app.stage.addChild(nightOverlay);
  setupInput();
  updateHud();
  app.ticker.add(gameLoop);
}

boot().catch(console.error);
