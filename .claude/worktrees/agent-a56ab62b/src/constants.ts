import type { BeeSpecies, BeeSpeciesDef, CropDefinition, CropTypeId, LightMood, ToolId } from "./types";

// ── Grid & Rendering ──────────────────────────────────────
export const ISLAND_SIZE = 24;
export const TILE_PX = 16;
export const RENDER_SCALE = 2;
export const TOOL_COUNT = 5;

// ── Day Cycle ─────────────────────────────────────────────
// Day cycle: 3.5 min total (3 min day + 30s night)
// We map 24 game-hours onto 210 real seconds
// Dawn 5-7, Day 7-18, Sunset 18-20, Night 20-5
export const WORLD_DAY_SECONDS = 86_400;
export const REAL_CYCLE_SECONDS = 210; // 3.5 minutes real time per full day
export const TIME_SCALE = WORLD_DAY_SECONDS / REAL_CYCLE_SECONDS;
export const DAWN_SECONDS = 9 * 3600; // spawn at 9 AM (clear day)
export const SAVE_KEY = "sky_farm_save_v3";

// ── Auto-Farm Timers ─────────────────────────────────────
export const AUTO_WATER_INTERVAL = 5;    // seconds between auto-watering all crops
export const CROP_GROW_SECONDS = 15;     // real seconds per growth tick (replaces dawn-based growth)
export const AUTO_HARVEST_DELAY = 2;     // seconds after maturity before auto-harvest
export const AUTO_REPLANT = true;        // auto-replant after harvest

// ── Tools ─────────────────────────────────────────────────
export const TOOLS: { id: ToolId; label: string; icon: string }[] = [
  { id: "pointer", label: "Pointer", icon: "\uD83D\uDC46" },
  { id: "hoe", label: "Hoe", icon: "\u26CF" },
  { id: "water", label: "Water", icon: "\uD83D\uDCA7" },
  { id: "seeds", label: "Seeds", icon: "\uD83C\uDF31" },
  { id: "axe", label: "Axe", icon: "\uD83E\uDE93" },
];

// ── Crops ─────────────────────────────────────────────────
export const CROP_DEFS: Record<CropTypeId, CropDefinition> = {
  sky_wheat: { label: "Sky Wheat", growDays: 3, sellPrice: 8, icon: "\uD83C\uDF3E" },
  star_berry: { label: "Star Berry", growDays: 4, sellPrice: 15, icon: "\u2B50" },
  cloud_pumpkin: { label: "Cloud Pumpkin", growDays: 5, sellPrice: 22, icon: "\uD83C\uDF83" },
  moon_flower: { label: "Moon Flower", growDays: 6, sellPrice: 30, icon: "\uD83C\uDF19" },
};
export const CROP_IDS: CropTypeId[] = ["sky_wheat", "star_berry", "cloud_pumpkin", "moon_flower"];

// ── Trees ─────────────────────────────────────────────────
export const CHOP_HITS = 3;
export const TREE_REGROW_SECONDS = 60;

// ── Tile Colors (Stardew-inspired) ────────────────────────
export const COLORS = {
  grass1: 0x5cc840,
  grass2: 0x4db838,
  grass3: 0x6ed850,
  grass4: 0x68d248,
  grass5: 0x56c03a,
  grassDark: 0x3e9a2c,
  grassLight: 0x80e060,
  grassHighlight: 0x98f070,
  grassEdge: 0x3a8824,
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
  farmlandWetSheen: 0x476f95,
  water: 0x7593af,
  cropGreen: 0x6ebc4e,
  cropGreenDark: 0x4e9636,
  cropGreenLight: 0x82d060,
  cropYellow: 0xe0d040,
  cropYellowLight: 0xf0e060,
  cropBrown: 0x8a6e40,
  highlight: 0xffffff,
  highlightHoe: 0xd4a850,
  highlightWater: 0xa3b7ca,
  highlightSeeds: 0x7ecc5a,
  highlightAxe: 0xc4a870,
  leafDark: 0x2e7a1e,
  leafMid: 0x3e9a2e,
  leafLight: 0x5aba3e,
  leafHighlight: 0x70cc50,
};

// ── Chicken Pen ───────────────────────────────────────────
export const PEN = { x1: 8, z1: 2, x2: 13, z2: 6 };
export const CHICKEN_COUNT = 4;
export const CHICKEN_SPEED = 0.8;

// ── Pond ──────────────────────────────────────────────────
export const POND_TILES = [
  { x: 3, z: 19 }, { x: 4, z: 19 }, { x: 5, z: 19 },
  { x: 3, z: 20 }, { x: 4, z: 20 }, { x: 5, z: 20 }, { x: 6, z: 20 },
  { x: 3, z: 21 }, { x: 4, z: 21 }, { x: 5, z: 21 },
  { x: 4, z: 22 },
];

// ── Lighting Moods ────────────────────────────────────────
export const LIGHT_MOODS: LightMood[] = [
  { hour: 0, color: 0x101830, alpha: 0.32 },    // deep night -- soft blue
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

// ── Tool Hold Rate ────────────────────────────────────────
export const TOOL_HOLD_RATE = 0.12; // seconds between actions while holding

// ── Chop Swing ────────────────────────────────────────────
export const CHOP_SWING_DURATION = 0.25; // seconds

// ── Bee Species ───────────────────────────────────────────
export const BEE_SPECIES: Record<BeeSpecies, BeeSpeciesDef> = {
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

export const FLIGHT_SPEED = 1.8;
export const FLOWER_VISIT_TIME = 1.5;

// ── Changelog ─────────────────────────────────────────────
export const CHANGELOG = [
  {
    version: "v0.5 -- The Sky Update",
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
    version: "v0.4 -- Game Engine",
    date: "Mar 13, 2026",
    changes: [
      "Procedural sound effects (Web Audio) for all actions",
      "Floating +coin text popups with tiny pixel font",
      "Screen shake on chop and tree fall",
      "Error sound when clicking pond or pen tiles",
    ],
  },
  {
    version: "v0.3 -- Retro Aesthetic",
    date: "Mar 13, 2026",
    changes: [
      "CRT scanlines, dithering, and barrel curvature",
      "Press Start 2P pixel font throughout",
      "Boot-up terminal sequence before title",
      "Clickable toolbar slots (no more keyboard-only)",
    ],
  },
  {
    version: "v0.2 -- Farm Life",
    date: "Mar 13, 2026",
    changes: [
      "4 crop types: sky wheat, star berry, cloud pumpkin, moon flower",
      "Chicken pen with fencing, straw, trough, hay bale",
      "Chickens lay eggs -- click to collect for coins",
      "Pond with animated water, ripples, lily pads",
      "Cloud shadows drifting across the island",
      "30 wildflowers scattered on grass",
      "Japanese maple trees with falling leaves",
      "Day/night cycle with 17 lighting moods",
    ],
  },
  {
    version: "v0.1 -- First Harvest",
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
