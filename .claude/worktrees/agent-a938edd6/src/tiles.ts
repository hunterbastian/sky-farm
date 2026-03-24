import type { Graphics } from "pixi.js";
import { ISLAND_SIZE, TILE_PX, COLORS, POND_TILES, PEN, TOOLS } from "./constants";
import { seededRandom } from "./utils";
import { selectedTool } from "./state";

// ── Pond Tile Check ───────────────────────────────────────
export function isPondTile(x: number, z: number): boolean {
  return POND_TILES.some((t) => t.x === x && t.z === z);
}

// ── Pen Tile Check ────────────────────────────────────────
export function isPenTile(x: number, z: number): boolean {
  return x >= PEN.x1 && x <= PEN.x2 && z >= PEN.z1 && z <= PEN.z2;
}

// ── Island Bounds ─────────────────────────────────────────
export function isOnIsland(x: number, z: number): boolean {
  return x >= 0 && x < ISLAND_SIZE && z >= 0 && z < ISLAND_SIZE;
}

// ── Grass Tile ────────────────────────────────────────────
export function drawGrassTile(g: Graphics, tx: number, tz: number): void {
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

// ── Farmland Tile ─────────────────────────────────────────
export function drawFarmlandTile(g: Graphics, tx: number, tz: number, watered: boolean): void {
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

// ── Island Edge / Cliff ───────────────────────────────────
export function drawIslandEdge(g: Graphics): void {
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

// ── Pond Tile ─────────────────────────────────────────────
export function drawPondTile(g: Graphics, tx: number, tz: number): void {
  const px = tx * TILE_PX;
  const pz = tz * TILE_PX;
  const now = performance.now() / 1000;
  const isEdge = (dx: number, dz: number) => !isPondTile(tx + dx, tz + dz);
  const isInner = !isEdge(0,-1) && !isEdge(0,1) && !isEdge(-1,0) && !isEdge(1,0);

  // ── Depth gradient base ──
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
  const ringPhase = (now * 0.3 + tx * 5.7 + tz * 3.3) % 4;
  if (ringPhase < 1.2) {
    const ringR = ringPhase * 4;
    const ringA = (1 - ringPhase / 1.2) * 0.25;
    const rcx = px + 8 + Math.round(Math.sin(tx * 7 + tz * 3) * 3);
    const rcz = pz + 8 + Math.round(Math.cos(tx * 5 + tz * 7) * 3);
    g.ellipse(rcx, rcz, Math.round(ringR) + 1, Math.max(1, Math.round(ringR * 0.5))).stroke({ color: 0xa3b7ca, alpha: ringA, width: 1 });
  }
}

// ── Tile Highlight ────────────────────────────────────────
export function drawHighlight(g: Graphics, tx: number, tz: number): void {
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
