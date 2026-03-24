import type { Graphics } from "pixi.js";
import { TILE_PX, PEN, CHICKEN_SPEED } from "./constants";
import { seededRandom } from "./utils";
import { chickens, eggs, eggTimer, setEggTimer, addCoins } from "./state";
import type { Chicken } from "./types";

// ── Chicken Pen Drawing ──────────────────────────────────
export function drawChickenPen(g: Graphics): void {
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
      g.rect(tx, tz, TILE_PX, TILE_PX).fill(0x9a8a60);
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
  g.rect(gateX, z2 - 4, 12, 5).fill(0x9a8a60);
  drawPost(gateX, z2);
  drawPost(gateX + 12, z2);

  // Feeding trough inside pen
  const troughX = (PEN.x1 + 1) * TILE_PX + 2;
  const troughZ = (PEN.z1 + 1) * TILE_PX;
  g.rect(troughX, troughZ, 8, 3).fill(0x6a4830);
  g.rect(troughX, troughZ, 8, 1).fill(0x8a6a4a);
  g.rect(troughX + 1, troughZ + 1, 6, 1).fill(0xc4a840);
  g.rect(troughX + 2, troughZ + 1, 2, 1).fill({ color: 0xe0c860, alpha: 0.5 });

  // Hay bale in corner
  const hayX = (PEN.x2) * TILE_PX + 2;
  const hayZ = (PEN.z1) * TILE_PX + 4;
  g.rect(hayX, hayZ, 6, 5).fill(0xc4a848);
  g.rect(hayX, hayZ, 6, 1).fill(0xd4b858);
  g.rect(hayX + 1, hayZ + 1, 4, 1).fill(0xb09838);
  g.rect(hayX + 1, hayZ + 3, 4, 1).fill(0xb09838);
}

// ── Chicken AI ───────────────────────────────────────────
export function pickChickenTarget(c: Chicken): void {
  c.targetX = PEN.x1 + 0.5 + Math.random() * (PEN.x2 - PEN.x1);
  c.targetZ = PEN.z1 + 0.5 + Math.random() * (PEN.z2 - PEN.z1);
  c.state = "walking";
}

export function pickChickenIdle(c: Chicken): void {
  const anims: Chicken["idleAnim"][] = ["peck", "ruffle", "look", "sit"];
  c.idleAnim = anims[Math.floor(Math.random() * anims.length)]!;
  c.idleAnimTimer = 1 + Math.random() * 2;
  if (c.idleAnim === "look") c.lookDir = Math.random() > 0.5 ? 1 : -1;
}

export function updateChickens(dt: number): void {
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
    c.x = Math.max(PEN.x1 + 0.3, Math.min(PEN.x2 + 0.7, c.x));
    c.z = Math.max(PEN.z1 + 0.3, Math.min(PEN.z2 + 0.7, c.z));
    if (Math.abs(dx) > 0.05) c.facing = dx > 0 ? 1 : -1;
    c.walkTimer += dt;
  }
}

export function drawChicken(g: Graphics, c: Chicken): void {
  const px = Math.round(c.x * TILE_PX);
  const pz = Math.round(c.z * TILE_PX);
  const f = c.facing;
  const walking = c.state === "walking";
  const bob = walking ? Math.sin(c.walkTimer * 8) * 0.6 : 0;
  const legSwing = walking ? Math.sin(c.walkTimer * 10) * 1.2 : 0;
  const peckY = c.idleAnim === "peck" && !walking ? Math.sin(c.peckPhase) * 1.5 : 0;
  const ruffle = c.idleAnim === "ruffle" && !walking ? Math.sin(c.rufflePhase) * 0.5 : 0;

  const bodyColors = [
    { body: 0xf0d850, wing: 0xe0c840, dark: 0xc4a830 },
    { body: 0xf0e060, wing: 0xe0d048, dark: 0xc8b038 },
    { body: 0xe8c840, wing: 0xd8b838, dark: 0xb89828 },
    { body: 0xf0e878, wing: 0xe0d860, dark: 0xc8c048 },
  ];
  const col = bodyColors[c.variant % bodyColors.length]!;

  const cx = px + 8;
  const cy = pz + 12 + Math.round(bob);

  // Shadow
  g.ellipse(cx, cy + 4, 3, 1).fill({ color: 0x000000, alpha: 0.1 });

  // Legs
  g.rect(cx - 1, cy + 2 + legSwing * 0.3, 1, 2).fill(0xd08020);
  g.rect(cx + 1, cy + 2 - legSwing * 0.3, 1, 2).fill(0xd08020);
  g.rect(cx - 2, cy + 4 + legSwing * 0.3, 2, 1).fill(0xd08020);
  g.rect(cx, cy + 4 - legSwing * 0.3, 2, 1).fill(0xd08020);

  // Body
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

  // Comb
  g.rect(hx, hy - 2, 1, 1).fill(0xe03030);
  g.rect(hx - 1, hy - 1, 1, 1).fill(0xe03030);

  // Wattle
  g.rect(hx + f * 1, hy + 2, 1, 1).fill(0xd02828);

  // Beak
  g.rect(hx + f * 1, hy + 1 + Math.round(peckY * 0.3), 1, 1).fill(0xf0a020);

  // Eye
  if (!c.blinking) {
    g.rect(hx + (f === 1 ? 1 : -1), hy, 1, 1).fill(0x1a1a1a);
    g.rect(hx + (f === 1 ? 1 : -1), hy, 1, 1).fill({ color: 0xffffff, alpha: 0.3 });
  } else {
    g.rect(hx + (f === 1 ? 1 : -1), hy + 1, 1, 1).fill({ color: col.dark, alpha: 0.5 });
  }

  // Sitting
  if (c.idleAnim === "sit" && !walking) {
    g.rect(cx - 3, cy + 2, 6, 1).fill(col.dark);
  }
}

// ── Eggs ─────────────────────────────────────────────────
export function updateEggs(dt: number): void {
  setEggTimer(eggTimer - dt);
  if (eggTimer <= 0 && eggs.length < 6) {
    const c = chickens[Math.floor(Math.random() * chickens.length)];
    if (c && c.state === "idle") {
      eggs.push({ x: c.x, z: c.z, age: 0 });
    }
    setEggTimer(12 + Math.random() * 20);
  }
  for (const e of eggs) e.age += dt;
}

export function drawEggs(g: Graphics): void {
  const now = performance.now() / 1000;
  for (const e of eggs) {
    const px = Math.round(e.x * TILE_PX) + 6;
    const pz = Math.round(e.z * TILE_PX) + 12;
    const wobble = Math.sin(now * 2.5 + e.x * 7 + e.z * 11) * 0.4;
    const wx = Math.round(wobble);
    g.ellipse(px + 1 + wx, pz + 3, 2, 1).fill({ color: 0x000000, alpha: 0.08 });
    g.rect(px + wx, pz, 3, 3).fill(0xf8f0e0);
    g.rect(px + 1 + wx, pz - 1, 1, 1).fill(0xf8f0e0);
    g.rect(px + wx, pz, 1, 1).fill({ color: 0xffffff, alpha: 0.4 });
    g.rect(px + 1 + wx, pz + 2, 2, 1).fill(0xe8e0d0);
  }
}

export function collectEgg(tx: number, tz: number): boolean {
  for (let i = eggs.length - 1; i >= 0; i--) {
    const e = eggs[i]!;
    if (Math.abs(Math.round(e.x) - tx) <= 1 && Math.abs(Math.round(e.z) - tz) <= 1) {
      eggs.splice(i, 1);
      addCoins(3);
      return true;
    }
  }
  return false;
}
