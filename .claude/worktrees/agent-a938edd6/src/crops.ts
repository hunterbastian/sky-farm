import type { Graphics } from "pixi.js";
import { TILE_PX, COLORS, CROP_DEFS, AUTO_WATER_INTERVAL, CROP_GROW_SECONDS, AUTO_HARVEST_DELAY, AUTO_REPLANT } from "./constants";
import {
  crops, eggs, autoWaterTimer, setAutoWaterTimer,
  autoHarvestTimer, setAutoHarvestTimer, addCoins,
} from "./state";
import type { CropState } from "./types";
import { spawnSplash, spawnGrowthSparkles, spawnHarvestBurst, spawnFloatingText, spawnSeedPop } from "./particles";
import { sfxCoin } from "./audio";

// ── Crop Drawing ──────────────────────────────────────────
export function drawCrop(g: Graphics, crop: CropState): void {
  const def = CROP_DEFS[crop.type];
  const progress = crop.growth / def.growDays;
  const cx = crop.x * TILE_PX;
  const cz = crop.z * TILE_PX;
  const now = performance.now() / 1000;
  const swayAmt = progress < 0.3 ? 0.2 : progress < 0.7 ? 0.35 : 0.6;
  const sway = Math.sin(now * 1.8 + crop.x * 3 + crop.z * 7) * swayAmt;
  const sw = Math.round(sway);

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
  if (progress < 0.7) {
    g.rect(cx + 6, cz + 8, 4, 6).fill(COLORS.cropGreenDark);
    g.rect(cx + 5 + sw, cz + 7, 6, 4).fill(COLORS.cropGreen);
    g.rect(cx + 6 + sw, cz + 6, 4, 1).fill(COLORS.cropGreenLight);
  } else if (progress < 1) {
    g.rect(cx + 5, cz + 6, 6, 8).fill(COLORS.cropGreenDark);
    g.rect(cx + 4 + sw, cz + 5, 8, 6).fill(COLORS.cropGreen);
    g.rect(cx + 5 + sw, cz + 4, 6, 1).fill(COLORS.cropGreenLight);
    g.rect(cx + 5 + sw, cz + 6, 2, 2).fill(0x88cc60);
    g.rect(cx + 9 + sw, cz + 7, 2, 2).fill(0x88cc60);
  } else {
    g.rect(cx + 5, cz + 6, 6, 8).fill(COLORS.cropGreenDark);
    g.rect(cx + 4 + sw, cz + 5, 8, 6).fill(COLORS.cropGreen);
    g.rect(cx + 5 + sw, cz + 4, 6, 1).fill(COLORS.cropGreenLight);
    const glow = Math.sin(now * 3) * 0.15 + 0.85;
    g.rect(cx + 4 + sw, cz + 5, 3, 3).fill({ color: 0x8060d0, alpha: glow });
    g.rect(cx + 5 + sw, cz + 5, 1, 1).fill({ color: 0xc0a0f0, alpha: glow * 0.6 });
    g.rect(cx + 9 + sw, cz + 6, 3, 3).fill({ color: 0x8060d0, alpha: glow });
    g.rect(cx + 10 + sw, cz + 6, 1, 1).fill({ color: 0xc0a0f0, alpha: glow * 0.6 });
    g.rect(cx + 6 + sw, cz + 8, 2, 2).fill({ color: 0x7050c0, alpha: glow });
    if (Math.sin(now * 5) > 0.5) {
      g.rect(cx + 5 + sw, cz + 4, 1, 1).fill({ color: 0xffffff, alpha: 0.7 });
    }
    g.rect(cx + 5, cz + 13, 6, 1).fill({ color: 0x000000, alpha: 0.1 });
  }
}

function drawPumpkin(g: Graphics, cx: number, cz: number, sw: number, progress: number): void {
  if (progress < 0.5) {
    g.rect(cx + 6, cz + 10, 4, 4).fill(COLORS.cropGreenDark);
    g.rect(cx + 5 + sw, cz + 9, 6, 3).fill(COLORS.cropGreen);
    g.rect(cx + 3 + sw, cz + 10, 2, 1).fill(COLORS.cropGreenDark);
    g.rect(cx + 11 + sw, cz + 11, 2, 1).fill(COLORS.cropGreenDark);
  } else if (progress < 1) {
    g.rect(cx + 4, cz + 8, 8, 6).fill(COLORS.cropGreen);
    g.rect(cx + 3 + sw, cz + 7, 3, 2).fill(COLORS.cropGreenDark);
    g.rect(cx + 10 + sw, cz + 8, 3, 2).fill(COLORS.cropGreenDark);
    g.rect(cx + 5, cz + 9, 6, 4).fill(0xc0882e);
    g.rect(cx + 6, cz + 10, 4, 2).fill(0xd09838);
    g.rect(cx + 7, cz + 9, 1, 1).fill(COLORS.cropGreenDark);
  } else {
    g.rect(cx + 2 + sw, cz + 6, 4, 3).fill(COLORS.cropGreen);
    g.rect(cx + 10 + sw, cz + 5, 4, 3).fill(COLORS.cropGreen);
    g.rect(cx + 3 + sw, cz + 6, 2, 1).fill(COLORS.cropGreenLight);
    g.rect(cx + 4, cz + 7, 8, 6).fill(0xd08830);
    g.rect(cx + 3, cz + 8, 10, 4).fill(0xd08830);
    g.rect(cx + 5, cz + 7, 1, 6).fill(0xc07820);
    g.rect(cx + 8, cz + 7, 1, 6).fill(0xc07820);
    g.rect(cx + 11, cz + 8, 1, 4).fill(0xc07820);
    g.rect(cx + 6, cz + 8, 2, 2).fill({ color: 0xf0b040, alpha: 0.5 });
    g.rect(cx + 7, cz + 6, 2, 2).fill(0x5a3820);
    g.rect(cx + 7, cz + 5, 1, 1).fill(COLORS.cropGreenDark);
    g.rect(cx + 4, cz + 13, 8, 1).fill({ color: 0x000000, alpha: 0.12 });
  }
}

function drawMoonFlower(g: Graphics, cx: number, cz: number, sw: number, progress: number, now: number): void {
  if (progress < 0.5) {
    g.rect(cx + 7, cz + 6, 2, 8).fill(COLORS.cropGreenDark);
    g.rect(cx + 5 + sw, cz + 7, 3, 2).fill(COLORS.cropGreen);
    g.rect(cx + 9 + sw, cz + 8, 3, 2).fill(COLORS.cropGreen);
  } else if (progress < 1) {
    g.rect(cx + 7 + sw, cz + 3, 2, 11).fill(COLORS.cropGreenDark);
    g.rect(cx + 4 + sw, cz + 6, 3, 3).fill(COLORS.cropGreen);
    g.rect(cx + 9 + sw, cz + 5, 3, 3).fill(COLORS.cropGreen);
    g.rect(cx + 6 + sw, cz + 2, 4, 3).fill(0x9888c0);
    g.rect(cx + 7 + sw, cz + 1, 2, 1).fill(0xb0a0d0);
  } else {
    const pulse = Math.sin(now * 2) * 0.1 + 0.9;
    g.rect(cx + 7 + sw, cz + 4, 2, 10).fill(COLORS.cropGreenDark);
    g.rect(cx + 4 + sw, cz + 7, 3, 3).fill(COLORS.cropGreen);
    g.rect(cx + 9 + sw, cz + 6, 3, 3).fill(COLORS.cropGreen);
    g.rect(cx + 5 + sw, cz + 1, 6, 5).fill({ color: 0xd0c8e8, alpha: pulse });
    g.rect(cx + 4 + sw, cz + 2, 8, 3).fill({ color: 0xd0c8e8, alpha: pulse });
    g.rect(cx + 6 + sw, cz + 0, 4, 1).fill({ color: 0xe8e0f8, alpha: pulse });
    g.rect(cx + 7 + sw, cz + 2, 2, 2).fill({ color: 0xf0e080, alpha: pulse });
    g.rect(cx + 7 + sw, cz + 2, 1, 1).fill({ color: 0xfff8c0, alpha: pulse * 0.7 });
    g.rect(cx + 4 + sw, cz + 0, 8, 6).fill({ color: 0xe0d8f8, alpha: 0.08 * pulse });
    if (Math.sin(now * 4 + cx) > 0.7) {
      g.rect(cx + 4 + sw, cz + 1, 1, 1).fill({ color: 0xffffff, alpha: 0.6 });
    }
    g.rect(cx + 6, cz + 13, 4, 1).fill({ color: 0x000000, alpha: 0.1 });
  }
}

// ── Auto-Farm Update ──────────────────────────────────────
export function updateAutoFarm(dt: number): void {
  // Auto-water all crops periodically
  setAutoWaterTimer(autoWaterTimer + dt);
  if (autoWaterTimer >= AUTO_WATER_INTERVAL) {
    setAutoWaterTimer(0);
    for (const crop of crops) {
      if (!crop.watered) {
        crop.watered = true;
        spawnSplash(crop.x, crop.z);
      }
    }
  }

  // Continuous growth (real-time)
  for (const crop of crops) {
    if (!crop.watered) continue;
    const def = CROP_DEFS[crop.type];
    if (crop.growth >= def.growDays) continue;
    crop.growTimer += dt;
    if (crop.growTimer >= CROP_GROW_SECONDS) {
      crop.growTimer -= CROP_GROW_SECONDS;
      const prev = crop.growth;
      crop.growth = Math.min(crop.growth + 1, def.growDays);
      if (crop.growth > prev) spawnGrowthSparkles(crop.x, crop.z);
    }
  }

  // Auto-harvest mature crops
  setAutoHarvestTimer(autoHarvestTimer + dt);
  if (autoHarvestTimer >= AUTO_HARVEST_DELAY) {
    setAutoHarvestTimer(0);
    for (let i = crops.length - 1; i >= 0; i--) {
      const crop = crops[i]!;
      const def = CROP_DEFS[crop.type];
      if (crop.growth >= def.growDays) {
        addCoins(def.sellPrice);
        spawnHarvestBurst(crop.x, crop.z, crop.type);
        spawnFloatingText(crop.x, crop.z, "+" + def.sellPrice, 0xf0e060);
        sfxCoin();

        if (AUTO_REPLANT) {
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

  // Auto-collect eggs
  for (let i = eggs.length - 1; i >= 0; i--) {
    const e = eggs[i]!;
    if (e.age > 8) {
      eggs.splice(i, 1);
      addCoins(3);
      spawnFloatingText(Math.round(e.x), Math.round(e.z), "+3", 0xf0e060);
      sfxCoin();
    }
  }
}
