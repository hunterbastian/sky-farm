import type { Graphics } from "pixi.js";
import { TILE_PX, CHOP_HITS, ISLAND_SIZE, BEE_SPECIES, FLIGHT_SPEED, FLOWER_VISIT_TIME } from "./constants";
import { trees, hives, honeyDrops, wildflowers, addCoins } from "./state";
import type { Hive, Wildflower } from "./types";

// ── Hive World Position ──────────────────────────────────
export function getHiveWorldPos(hive: Hive): { hx: number; hz: number } | null {
  const tree = trees[hive.treeIndex];
  if (!tree) return null;
  const cx = tree.x * TILE_PX + TILE_PX / 2;
  const cz = tree.z * TILE_PX + TILE_PX;
  const now = performance.now() / 1000;
  const sw = Math.round(Math.sin(now * 0.9 + tree.variant * 2) * 0.5);
  return { hx: cx + 5 + sw + 2, hz: cz - 16 + 4 };
}

// ── Nearest Flower ───────────────────────────────────────
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

// ── Update Bees ──────────────────────────────────────────
export function updateBees(dt: number): void {
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

// ── Update Honey ─────────────────────────────────────────
export function updateHoney(dt: number): void {
  for (const h of honeyDrops) h.age += dt;
}

// ── Collect Honey ────────────────────────────────────────
export function collectHoney(tx: number, tz: number): number {
  for (let i = honeyDrops.length - 1; i >= 0; i--) {
    const h = honeyDrops[i]!;
    if (Math.abs(Math.round(h.x) - tx) <= 1 && Math.abs(Math.round(h.z) - tz) <= 1) {
      const value = BEE_SPECIES[h.species].honeyValue;
      honeyDrops.splice(i, 1);
      addCoins(value);
      return value;
    }
  }
  return 0;
}

// ── Draw Hive and Bees ───────────────────────────────────
export function drawHiveAndBees(g: Graphics, hive: Hive): void {
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

  // Beehive body -- tinted by species
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

  // Bees -- orbiting or foraging
  for (const b of hive.bees) {
    let ix: number, iz: number;

    if (b.mode === "orbiting") {
      ix = Math.round(hiveX + 2 + Math.cos(b.angle) * b.radius);
      iz = Math.round(hz + 2 + Math.sin(b.angle) * b.radius * 0.5 + b.zOff);
    } else {
      // Foraging -- use world position
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

// ── Draw Honey ───────────────────────────────────────────
export function drawHoney(g: Graphics): void {
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

    // Honey jar -- species tinted
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
