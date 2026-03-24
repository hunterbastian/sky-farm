import type { Graphics } from "pixi.js";
import { TILE_PX, CHOP_HITS } from "./constants";
import { bees } from "./state";
import type { TreeState } from "./types";

export function updateBees(dt: number): void {
  const now = performance.now() / 1000;
  for (const b of bees) {
    b.angle += b.speed * dt;
    b.zOff = Math.sin(now * 3 + b.phase) * 3;
  }
}

export function drawHiveAndBees(g: Graphics, tree: TreeState): void {
  if (tree.chopTime >= CHOP_HITS || tree.falling) return;
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

  // Beehive
  const hz = hiveZ + 2;
  g.rect(hiveX, hz, 4, 4).fill(0xd4a840);
  g.rect(hiveX - 1, hz + 1, 6, 2).fill(0xd4a840);
  g.rect(hiveX - 1, hz + 1, 6, 1).fill(0xc49830);
  g.rect(hiveX, hz + 3, 4, 1).fill(0xc49830);
  g.rect(hiveX + 1, hz - 1, 2, 1).fill(0xd4a840);
  g.rect(hiveX + 1, hz + 2, 2, 1).fill(0x4a3018);
  g.rect(hiveX, hz, 2, 1).fill({ color: 0xf0d060, alpha: 0.5 });

  // Bees orbiting
  for (const b of bees) {
    const bx = hiveX + 2 + Math.cos(b.angle) * b.radius;
    const bz = hz + 2 + Math.sin(b.angle) * b.radius * 0.5 + b.zOff;
    const ix = Math.round(bx);
    const iz = Math.round(bz);
    g.rect(ix, iz, 2, 1).fill(0xf0d040);
    g.rect(ix + 1, iz, 1, 1).fill(0x2a2a2a);
    const wingUp = Math.sin(performance.now() / 1000 * 20 + b.phase) > 0;
    if (wingUp) {
      g.rect(ix, iz - 1, 1, 1).fill({ color: 0xf0f0f0, alpha: 0.5 });
      g.rect(ix + 1, iz - 1, 1, 1).fill({ color: 0xf0f0f0, alpha: 0.3 });
    }
  }
}
