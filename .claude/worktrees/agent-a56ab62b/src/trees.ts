import type { Graphics } from "pixi.js";
import { TILE_PX, CHOP_HITS, CHOP_SWING_DURATION, COLORS } from "./constants";
import { seededRandom } from "./utils";
import { trees, mapleTrees, chopSwingTimer, setChopSwingTimer } from "./state";
import type { TreeState, MapleTree } from "./types";

// ── Update Trees ──────────────────────────────────────────
export function updateTrees(dt: number): void {
  for (const tree of trees) {
    if (tree.falling) {
      tree.fallAngle += dt * (1.5 + tree.fallAngle * 2.5);
      if (tree.fallAngle >= Math.PI / 2) {
        tree.fallAngle = 0;
        tree.falling = false;
      }
    }
    if (tree.chopTime >= CHOP_HITS && !tree.falling) {
      tree.regrowTimer -= dt;
      if (tree.regrowTimer <= 0) {
        tree.chopTime = 0;
        tree.regrowTimer = 0;
      }
    }
  }
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

// ── Oak Tree Drawing ──────────────────────────────────────
export function drawTree(g: Graphics, tree: TreeState): void {
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

  const now = performance.now() / 1000;
  const sw = Math.round(Math.sin(now * 0.9 + tree.variant * 2) * 0.5);

  g.ellipse(cx, cz + 2, 10, 3).fill({ color: 0x000000, alpha: 0.12 });

  // Exposed roots
  g.rect(cx - 4, cz - 1, 2, 3).fill(0x5a3820);
  g.rect(cx + 3, cz - 1, 2, 2).fill(0x5a3820);
  g.rect(cx - 5, cz, 1, 2).fill(0x4a2818);

  // Trunk
  g.rect(cx - 3, cz - 18, 6, 19).fill(0x5a3820);
  g.rect(cx - 2, cz - 18, 4, 19).fill(0x6a4830);
  g.rect(cx - 1, cz - 16, 2, 14).fill({ color: 0x7a5a3a, alpha: 0.6 });
  g.rect(cx - 3, cz - 12, 1, 2).fill(0x3a2010);
  g.rect(cx + 3, cz - 8, 1, 2).fill(0x3a2010);
  g.rect(cx - 2, cz - 5, 1, 1).fill(0x3a2010);
  g.rect(cx + 2, cz - 14, 1, 1).fill(0x3a2010);
  g.rect(cx + 1, cz - 14, 1, 10).fill({ color: 0x8a6a4a, alpha: 0.4 });

  // Branches
  g.rect(cx - 7, cz - 17, 5, 1).fill(0x5a3820);
  g.rect(cx + 3, cz - 16, 6, 1).fill(0x5a3820);

  // Canopy
  g.rect(cx - 10 + sw, cz - 22, 20, 6).fill(COLORS.leafDark);
  g.rect(cx - 9 + sw, cz - 23, 18, 1).fill(COLORS.leafDark);
  g.rect(cx - 9 + sw, cz - 16, 18, 1).fill(COLORS.leafDark);
  g.rect(cx - 9 + sw, cz - 28, 18, 7).fill(COLORS.leafMid);
  g.rect(cx - 8 + sw, cz - 29, 16, 1).fill(COLORS.leafMid);
  g.rect(cx - 6 + sw, cz - 32, 12, 4).fill(COLORS.leafLight);
  g.rect(cx - 5 + sw, cz - 33, 10, 1).fill(COLORS.leafLight);
  g.rect(cx - 3 + sw, cz - 34, 6, 1).fill(COLORS.leafHighlight);
  g.rect(cx - 2 + sw, cz - 35, 4, 1).fill(COLORS.leafHighlight);

  // Dappled light highlights
  const r = seededRandom(tree.variant * 999);
  for (let i = 0; i < 10; i++) {
    const lx = Math.floor(r() * 18) - 9;
    const lz = Math.floor(r() * 16) - 30;
    g.rect(cx + lx + sw, cz + lz, 2, 1).fill({ color: COLORS.leafHighlight, alpha: 0.5 });
  }
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

// ── Oak Tree Stump ────────────────────────────────────────
export function drawTreeStump(g: Graphics, tree: TreeState): void {
  if (tree.chopTime < CHOP_HITS) return;
  const cx = tree.x * TILE_PX + TILE_PX / 2;
  const cz = tree.z * TILE_PX + TILE_PX;

  g.ellipse(cx, cz + 1, 4, 1).fill({ color: 0x000000, alpha: 0.1 });
  g.rect(cx - 3, cz - 3, 6, 4).fill(0x6a4830);
  g.rect(cx - 2, cz - 3, 4, 1).fill(0x8a6a4a);
  g.rect(cx - 2, cz - 3, 4, 1).fill(0x9a7a50);
  g.rect(cx - 1, cz - 3, 2, 1).fill(0xaa8a5a);
}

// ── Maple Tree Drawing ────────────────────────────────────
export function drawMapleTree(g: Graphics, tree: MapleTree): void {
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

  g.ellipse(cx, cz + 2, 9, 3).fill({ color: 0x000000, alpha: 0.10 });

  // Trunk
  g.rect(cx - 2, cz - 16, 4, 17).fill(0x3a2418);
  g.rect(cx - 1, cz - 16, 2, 17).fill(0x4a3428);
  g.rect(cx, cz - 12, 1, 10).fill({ color: 0x5a4438, alpha: 0.4 });
  g.rect(cx - 2, cz - 10, 1, 2).fill(0x2a1810);
  g.rect(cx + 2, cz - 6, 1, 1).fill(0x2a1810);
  g.rect(cx - 2, cz - 4, 1, 1).fill(0x2a1810);

  // Branches
  g.rect(cx - 6, cz - 14, 5, 1).fill(0x3a2418);
  g.rect(cx - 7, cz - 15, 2, 1).fill(0x3a2418);
  g.rect(cx + 2, cz - 12, 5, 1).fill(0x3a2418);
  g.rect(cx + 6, cz - 13, 2, 1).fill(0x3a2418);
  g.rect(cx - 1, cz - 18, 2, 3).fill(0x3a2418);

  // Canopy
  const pink = 0xf0a0b0;
  const pinkDeep = 0xd87088;
  const pinkLight = 0xf8c8d0;
  const white = 0xf8e8f0;
  const pinkDark = 0xb85070;

  g.rect(cx - 8 + sw, cz - 22, 16, 6).fill(pinkDeep);
  g.rect(cx - 9 + sw, cz - 20, 18, 4).fill(pink);
  g.rect(cx - 7 + sw, cz - 24, 14, 3).fill(pink);
  g.rect(cx - 5 + sw, cz - 26, 10, 3).fill(pinkLight);
  g.rect(cx - 3 + sw, cz - 28, 6, 2).fill(pinkLight);
  g.rect(cx - 2 + sw, cz - 29, 4, 1).fill(white);

  // Drooping clusters
  g.rect(cx - 10 + sw, cz - 18, 4, 3).fill(pink);
  g.rect(cx - 11 + sw, cz - 16, 3, 2).fill(pinkLight);
  g.rect(cx + 6 + sw, cz - 18, 5, 3).fill(pink);
  g.rect(cx + 8 + sw, cz - 16, 3, 2).fill(pinkLight);

  g.rect(cx - 8 + sw, cz - 16, 3, 2).fill({ color: pinkLight, alpha: 0.7 });
  g.rect(cx + 5 + sw, cz - 16, 3, 2).fill({ color: pinkLight, alpha: 0.7 });
  g.rect(cx - 6 + sw, cz - 14, 2, 2).fill({ color: pink, alpha: 0.5 });
  g.rect(cx + 4 + sw, cz - 14, 2, 2).fill({ color: pink, alpha: 0.5 });

  // Highlights
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
  for (let i = 0; i < 4; i++) {
    const lx = Math.floor(r() * 12) - 6;
    const lz = Math.floor(r() * 8) - 22;
    g.rect(cx + lx + sw, cz + lz, 2, 2).fill({ color: pinkDark, alpha: 0.3 });
  }
}

// ── Maple Tree Stump ──────────────────────────────────────
export function drawMapleStump(g: Graphics, tree: MapleTree): void {
  if (tree.chopTime < CHOP_HITS) return;
  const cx = tree.x * TILE_PX + TILE_PX / 2;
  const cz = tree.z * TILE_PX + TILE_PX;
  g.ellipse(cx, cz + 1, 3, 1).fill({ color: 0x000000, alpha: 0.08 });
  g.rect(cx - 2, cz - 3, 5, 4).fill(0x3a2418);
  g.rect(cx - 1, cz - 3, 3, 1).fill(0x5a4438);
  g.rect(cx, cz - 3, 1, 1).fill(0x6a5448);
}

// ── Woodchopper ───────────────────────────────────────────
export function updateChopSwing(dt: number): void {
  if (chopSwingTimer > 0) setChopSwingTimer(Math.max(0, chopSwingTimer - dt));
}

export function triggerChopSwing(): void {
  setChopSwingTimer(CHOP_SWING_DURATION);
}

export function drawWoodchopper(g: Graphics, tx: number, tz: number): void {
  const cx = tx * TILE_PX + TILE_PX / 2 + 6;
  const cz = tz * TILE_PX + TILE_PX - 1;

  // Body
  g.rect(cx - 2, cz - 1, 2, 2).fill(0x5a3820);
  g.rect(cx + 1, cz - 1, 2, 2).fill(0x5a3820);
  g.rect(cx - 2, cz - 4, 2, 3).fill(0x4a6a8a);
  g.rect(cx + 1, cz - 4, 2, 3).fill(0x4a6a8a);
  g.rect(cx - 2, cz - 5, 5, 1).fill(0x6a4830);
  g.rect(cx - 2, cz - 8, 5, 3).fill(0xc44040);
  g.rect(cx - 1, cz - 7, 3, 1).fill({ color: 0xe06060, alpha: 0.5 });
  g.rect(cx - 1, cz - 11, 4, 3).fill(0xf0c490);
  g.rect(cx - 1, cz - 10, 1, 1).fill(0x2a2a2a);
  g.rect(cx + 2, cz - 10, 1, 1).fill(0x2a2a2a);
  g.rect(cx - 2, cz - 12, 5, 2).fill(0x6a3a1a);
  g.rect(cx - 2, cz - 11, 1, 1).fill(0x6a3a1a);

  // Axe
  const swingT = chopSwingTimer > 0 ? 1 - (chopSwingTimer / CHOP_SWING_DURATION) : 0;
  const swingActive = chopSwingTimer > 0;
  const eased = swingActive ? (swingT < 0.6 ? swingT / 0.6 : 1 - (swingT - 0.6) / 0.4 * 0.3) : 0;
  const angle = eased * (Math.PI / 2.2);

  const armX = cx - 3;
  const armZ = cz - 7;

  if (swingActive) {
    const cosA = Math.cos(-angle);
    const sinA = Math.sin(-angle);

    for (let i = 0; i < 3; i++) {
      const ax = Math.round(armX + sinA * i);
      const az = Math.round(armZ - cosA * i);
      g.rect(ax, az, 1, 1).fill(0xf0c490);
    }

    for (let i = 3; i < 8; i++) {
      const hx = Math.round(armX + sinA * i);
      const hz = Math.round(armZ - cosA * i);
      g.rect(hx, hz, 1, 1).fill(0x8b6840);
    }

    const headX = Math.round(armX + sinA * 8);
    const headZ = Math.round(armZ - cosA * 8);
    for (let i = -1; i <= 1; i++) {
      g.rect(Math.round(headX + cosA * i), Math.round(headZ + sinA * i), 2, 2).fill(0xc0c0c0);
    }
    g.rect(Math.round(headX + cosA * -1), Math.round(headZ + sinA * -1), 1, 1).fill(0xe0e0e0);
  } else {
    g.rect(armX, armZ - 2, 1, 3).fill(0xf0c490);
    g.rect(armX, armZ - 7, 1, 5).fill(0x8b6840);
    g.rect(armX - 1, armZ - 9, 3, 2).fill(0xc0c0c0);
    g.rect(armX - 1, armZ - 9, 1, 2).fill(0xe0e0e0);
  }
}
