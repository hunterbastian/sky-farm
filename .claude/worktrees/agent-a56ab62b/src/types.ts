// ── Types ─────────────────────────────────────────────────
export type TileType = "grass" | "farmland";
export type CropTypeId = "sky_wheat" | "star_berry" | "cloud_pumpkin" | "moon_flower";
export type ToolId = "pointer" | "hoe" | "water" | "seeds" | "axe";
export type BeeSpecies = "honeybee" | "bumblebee" | "mason";

export interface CropDefinition {
  label: string;
  growDays: number;
  sellPrice: number;
  icon: string;
}

export interface CropState {
  x: number;
  z: number;
  type: CropTypeId;
  growth: number;
  watered: boolean;
  growTimer: number; // real seconds accumulated toward next growth tick
}

export interface TreeState {
  x: number;
  z: number;
  chopTime: number; // 0 = standing, >= CHOP_HITS = chopped
  regrowTimer: number; // seconds until regrow (counts down when chopped)
  variant: number; // visual variation seed
  falling: boolean; // true while fall animation plays
  fallAngle: number; // radians, 0 -> pi/2
  fallDir: number; // -1 or 1 (left or right)
}

export interface MapleTree {
  x: number; z: number; variant: number;
  chopTime: number; regrowTimer: number;
  falling: boolean; fallAngle: number; fallDir: number;
}

export interface MapleLeafParticle {
  x: number; z: number; life: number; drift: number; speed: number;
  color: number; groundTimer: number; onGround: boolean;
  groundX: number; groundZ: number;
}

export interface Chicken {
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

export interface BeeSpeciesDef {
  bodyColor: number;
  stripeColor: number;
  wingAlpha: number;
  speed: [number, number];     // min, max angular speed
  size: number;                // 1 = normal, 1.5 = chunky
  honeyInterval: [number, number]; // seconds between honey drops
  honeyValue: number;
  hiveAccent: number;          // hive tint accent
}

export interface Bee {
  angle: number;
  radius: number;
  speed: number;
  zOff: number;
  phase: number;
  species: BeeSpecies;
  // Foraging state
  mode: "orbiting" | "flying-out" | "at-flower" | "flying-back";
  forageCooldown: number;
  targetFlower: Wildflower | null;
  worldX: number; worldZ: number;
  startX: number; startZ: number;
  flightProgress: number;
  flowerTime: number;
  hasPollen: boolean;
}

export interface Hive {
  treeIndex: number;
  species: BeeSpecies;
  bees: Bee[];
  honeyTimer: number;
}

export interface HoneyDrop {
  x: number; z: number; age: number; species: BeeSpecies;
}

export interface Egg {
  x: number; z: number; age: number;
}

export interface Wildflower {
  x: number; z: number; color: number; size: number; phase: number;
}

export interface FloatingText {
  text: string;
  x: number; z: number; // world pixel coords
  life: number; // 0->1
  color: number;
}

export interface CloudShadow {
  x: number; z: number; w: number; h: number; speed: number;
}

export interface Splash {
  x: number; // pixel position
  z: number;
  life: number; // 0->1 (1 = dead)
  size: number;
  vx: number;
  vz: number;
}

export interface DirtPuff { x: number; z: number; vx: number; vz: number; life: number; size: number; color: number; }

export interface SeedPop { x: number; z: number; vz: number; life: number; color: number; }

export interface HarvestPart { x: number; z: number; vx: number; vz: number; life: number; color: number; }

export interface WoodChip { x: number; z: number; vx: number; vz: number; life: number; color: number; }

export interface Sparkle { x: number; z: number; life: number; }

export interface Mote {
  x: number;
  z: number;
  speed: number;
  drift: number;
  phase: number;
  size: number;
  alpha: number;
}

export interface Butterfly {
  x: number;
  z: number;
  tx: number;
  tz: number;
  color: number;
  wingPhase: number;
  speed: number;
  idleTimer: number;
}

export interface LeafParticle {
  x: number; z: number; life: number; drift: number; speed: number; color: number;
}

export interface LightMood {
  hour: number;
  color: number;
  alpha: number;
}

export interface SkyCloud {
  x: number; y: number; w: number; h: number; speed: number; alpha: number;
}

export interface ToolbarSlot { div: HTMLDivElement; icon: HTMLDivElement; name: HTMLDivElement; }
