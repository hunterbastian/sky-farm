import type { Graphics } from "pixi.js";
import { ISLAND_SIZE } from "./constants";
import { seededRandom } from "./utils";
import { wildflowers, wildflowersInitialized, setWildflowersInitialized, trees, mapleTrees } from "./state";
import { isPondTile } from "./tiles";

export function initWildflowers(): void {
  if (wildflowersInitialized) return;
  setWildflowersInitialized(true);
  const flowerColors = [0xf0a0c0, 0xf0d060, 0xa0c0f0, 0xf0f0f0, 0xd090f0, 0xf0a040];
  const rng = seededRandom(42);
  for (let i = 0; i < 30; i++) {
    const fx = Math.floor(rng() * ISLAND_SIZE);
    const fz = Math.floor(rng() * ISLAND_SIZE);
    if (isPondTile(fx, fz)) continue;
    if (trees.some((t) => t.x === fx && t.z === fz)) continue;
    if (mapleTrees.some((t) => t.x === fx && t.z === fz)) continue;
    wildflowers.push({
      x: fx * 16 + 3 + rng() * 10,
      z: fz * 16 + 3 + rng() * 10,
      color: flowerColors[Math.floor(rng() * flowerColors.length)]!,
      size: 1 + Math.floor(rng() * 2),
      phase: rng() * Math.PI * 2,
    });
  }
}

export function drawWildflowers(g: Graphics): void {
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
