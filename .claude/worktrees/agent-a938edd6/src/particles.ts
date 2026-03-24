import type { Graphics } from "pixi.js";
import { TILE_PX, ISLAND_SIZE } from "./constants";
import { drawPixelString } from "./utils";
import {
  floatingTexts, splashes, dirtPuffs, seedPops, harvestParts,
  woodChips, sparkles, motes, butterflies, leafParticles,
  cloudShadows, mapleLeaves, trees, mapleTrees,
  leafSpawnTimer, setLeafSpawnTimer,
  mapleSpawnTimer, setMapleSpawnTimer,
} from "./state";
import { CHOP_HITS } from "./constants";

// ── Floating Text Popups ─────────────────────────────────
export function spawnFloatingText(tileX: number, tileZ: number, text: string, color = 0xf0e060): void {
  floatingTexts.push({
    text,
    x: tileX * TILE_PX + TILE_PX / 2,
    z: tileZ * TILE_PX,
    life: 0,
    color,
  });
}

export function updateFloatingTexts(dt: number): void {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i]!;
    ft.life += dt * 0.8;
    ft.z -= dt * 20;
    if (ft.life >= 1) floatingTexts.splice(i, 1);
  }
}

export function drawFloatingTexts(g: Graphics): void {
  for (const ft of floatingTexts) {
    const alpha = 1 - ft.life;
    drawPixelString(g, ft.text, Math.round(ft.x), Math.round(ft.z), ft.color, alpha);
  }
}

// ── Water Splash Particles ────────────────────────────────
export function spawnSplash(tileX: number, tileZ: number): void {
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

  // Some smaller droplets that land nearby
  for (let i = 0; i < 5; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 6 + Math.random() * 14;
    splashes.push({
      x: cx + Math.cos(angle) * dist,
      z: cz + Math.sin(angle) * dist,
      life: 0.2 + Math.random() * 0.15,
      size: 1,
      vx: 0,
      vz: 0,
    });
  }
}

export function updateSplashes(dt: number): void {
  for (let i = splashes.length - 1; i >= 0; i--) {
    const s = splashes[i]!;
    s.life += dt * 1.2;
    s.x += s.vx * dt;
    s.z += s.vz * dt;
    s.vx *= 0.88;
    s.vz *= 0.88;
    if (s.life >= 1) splashes.splice(i, 1);
  }
}

export function drawSplashes(g: Graphics): void {
  for (const s of splashes) {
    const alpha = 1 - s.life;
    if (alpha <= 0) continue;
    const sz = Math.max(1, Math.round(s.size * (1 - s.life * 0.5)));
    g.rect(Math.round(s.x), Math.round(s.z), sz, sz).fill({ color: 0x7593af, alpha: alpha * 0.7 });
    if (sz > 1 && alpha > 0.3) {
      g.rect(Math.round(s.x), Math.round(s.z), 1, 1).fill({ color: 0xd1dbe4, alpha: alpha * 0.5 });
    }
  }
}

// ── Dirt Puff (Hoe) ──────────────────────────────────────
export function spawnDirtPuff(tileX: number, tileZ: number): void {
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
      vz: Math.sin(angle) * speed * 0.6 - 4,
      life: 0,
      size: 1 + Math.random(),
      color: colors[Math.floor(Math.random() * colors.length)]!,
    });
  }
}

export function updateDirtPuffs(dt: number): void {
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

export function drawDirtPuffs(g: Graphics): void {
  for (const p of dirtPuffs) {
    const alpha = (1 - p.life) * 0.6;
    if (alpha <= 0) continue;
    const sz = Math.max(1, Math.round(p.size * (1 + p.life * 0.5)));
    g.rect(Math.round(p.x), Math.round(p.z), sz, sz).fill({ color: p.color, alpha });
  }
}

// ── Seed Pop (Planting) ──────────────────────────────────
export function spawnSeedPop(tileX: number, tileZ: number): void {
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

export function updateSeedPops(dt: number): void {
  for (let i = seedPops.length - 1; i >= 0; i--) {
    const p = seedPops[i]!;
    p.life += dt * 2;
    p.z += p.vz * dt;
    p.vz += 30 * dt;
    if (p.life >= 1) seedPops.splice(i, 1);
  }
}

export function drawSeedPops(g: Graphics): void {
  for (const p of seedPops) {
    const alpha = 1 - p.life;
    if (alpha <= 0) continue;
    g.rect(Math.round(p.x), Math.round(p.z), 1, 1).fill({ color: p.color, alpha: alpha * 0.8 });
  }
}

// ── Harvest Burst ────────────────────────────────────────
export function spawnHarvestBurst(tileX: number, tileZ: number, cropType: string): void {
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

export function updateHarvestParts(dt: number): void {
  for (let i = harvestParts.length - 1; i >= 0; i--) {
    const p = harvestParts[i]!;
    p.life += dt * 1.2;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.vz += 25 * dt;
    p.vx *= 0.95;
    if (p.life >= 1) harvestParts.splice(i, 1);
  }
}

export function drawHarvestParts(g: Graphics): void {
  for (const p of harvestParts) {
    const alpha = 1 - p.life;
    if (alpha <= 0) continue;
    g.rect(Math.round(p.x), Math.round(p.z), 2, 2).fill({ color: p.color, alpha: alpha * 0.9 });
  }
}

// ── Wood Chips (Axe) ─────────────────────────────────────
export function spawnWoodChips(tileX: number, tileZ: number): void {
  const cx = tileX * TILE_PX + TILE_PX / 2;
  const cz = tileZ * TILE_PX + TILE_PX / 2;
  const colors = [0x8b6914, 0x6b4e0a, 0xa08030, 0xc4a050, 0x5a3a10];
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
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

export function updateWoodChips(dt: number): void {
  for (let i = woodChips.length - 1; i >= 0; i--) {
    const p = woodChips[i]!;
    p.life += dt * 1.4;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.vz += 35 * dt;
    p.vx *= 0.95;
    if (p.life >= 1) woodChips.splice(i, 1);
  }
}

export function drawWoodChips(g: Graphics): void {
  for (const p of woodChips) {
    const alpha = 1 - p.life;
    if (alpha <= 0) continue;
    g.rect(Math.round(p.x), Math.round(p.z), 2, 1).fill({ color: p.color, alpha: alpha * 0.8 });
  }
}

// ── Crop Growth Sparkle ──────────────────────────────────
export function spawnGrowthSparkles(tileX: number, tileZ: number): void {
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

export function updateSparkles(dt: number): void {
  for (let i = sparkles.length - 1; i >= 0; i--) {
    const s = sparkles[i]!;
    s.life += dt * 1.8;
    s.z -= dt * 6;
    if (s.life >= 1) sparkles.splice(i, 1);
  }
}

export function drawSparkles(g: Graphics): void {
  for (const s of sparkles) {
    const brightness = s.life < 0.3 ? s.life / 0.3 : 1 - (s.life - 0.3) / 0.7;
    if (brightness <= 0) continue;
    const sz = brightness > 0.5 ? 2 : 1;
    g.rect(Math.round(s.x), Math.round(s.z), sz, sz).fill({ color: 0xf8f0a0, alpha: brightness * 0.9 });
    if (brightness > 0.6) {
      g.rect(Math.round(s.x) - 1, Math.round(s.z), 1, 1).fill({ color: 0xffffff, alpha: brightness * 0.5 });
      g.rect(Math.round(s.x) + sz, Math.round(s.z), 1, 1).fill({ color: 0xffffff, alpha: brightness * 0.5 });
      g.rect(Math.round(s.x), Math.round(s.z) - 1, 1, 1).fill({ color: 0xffffff, alpha: brightness * 0.4 });
    }
  }
}

// ── Motes (pollen/dust) ──────────────────────────────────
export function updateMotes(dt: number): void {
  const now = performance.now() / 1000;
  for (const m of motes) {
    m.x += Math.sin(m.drift + now * 0.3) * m.speed * dt;
    m.z -= m.speed * dt * 0.4;
    if (m.z < -4) { m.z = ISLAND_SIZE * TILE_PX + 4; m.x = Math.random() * ISLAND_SIZE * TILE_PX; }
    if (m.x < -4) m.x = ISLAND_SIZE * TILE_PX + 4;
    if (m.x > ISLAND_SIZE * TILE_PX + 4) m.x = -4;
  }
}

export function drawMotes(g: Graphics): void {
  const now = performance.now() / 1000;
  for (const m of motes) {
    const flicker = 0.7 + Math.sin(now * 2 + m.phase) * 0.3;
    g.rect(Math.round(m.x), Math.round(m.z), m.size, m.size)
      .fill({ color: 0xf8f0d0, alpha: m.alpha * flicker });
  }
}

// ── Butterflies ─────────────────────────────────────────
export function updateButterflies(dt: number): void {
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

export function drawButterflies(g: Graphics): void {
  for (const b of butterflies) {
    const wing = Math.sin(b.wingPhase);
    const wingW = Math.max(1, Math.round(Math.abs(wing) * 2));
    const bx = Math.round(b.x);
    const bz = Math.round(b.z);
    g.rect(bx, bz, 1, 2).fill(0x2a2a2a);
    g.rect(bx - wingW, bz, wingW, 1).fill({ color: b.color, alpha: 0.8 });
    g.rect(bx + 1, bz, wingW, 1).fill({ color: b.color, alpha: 0.8 });
    g.rect(bx - wingW, bz + 1, Math.max(1, wingW - 1), 1).fill({ color: b.color, alpha: 0.5 });
    g.rect(bx + 1, bz + 1, Math.max(1, wingW - 1), 1).fill({ color: b.color, alpha: 0.5 });
  }
}

// ── Leaf Particles (from oak trees) ──────────────────────
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

export function updateLeafParticles(dt: number): void {
  setLeafSpawnTimer(leafSpawnTimer - dt);
  if (leafSpawnTimer <= 0) { spawnLeafParticles(); setLeafSpawnTimer(1.5 + Math.random() * 2); }
  for (let i = leafParticles.length - 1; i >= 0; i--) {
    const p = leafParticles[i]!;
    p.life += dt * 0.4;
    p.x += Math.sin(p.life * 3 + p.drift) * p.drift * dt;
    p.z += p.speed * dt;
    if (p.life >= 1) leafParticles.splice(i, 1);
  }
}

export function drawLeafParticles(g: Graphics): void {
  for (const p of leafParticles) {
    const a = 1 - p.life;
    g.rect(Math.round(p.x), Math.round(p.z), 1, 1).fill({ color: p.color, alpha: a * 0.7 });
  }
}

// ── Cloud Shadows ────────────────────────────────────────
export function updateCloudShadows(dt: number): void {
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

export function drawCloudShadows(g: Graphics): void {
  for (const c of cloudShadows) {
    g.ellipse(Math.round(c.x), Math.round(c.z), c.w / 2, c.h / 2)
      .fill({ color: 0x000000, alpha: 0.06 });
  }
}

// ── Maple Leaves ─────────────────────────────────────────
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

export function updateMapleLeaves(dt: number): void {
  setMapleSpawnTimer(mapleSpawnTimer - dt);
  if (mapleSpawnTimer <= 0) { spawnMapleLeaves(); setMapleSpawnTimer(0.8 + Math.random() * 1.5); }
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
    if (p.life >= 0.8) {
      p.onGround = true;
      p.groundX = p.x;
      p.groundZ = p.z;
    }
  }
}

export function drawMapleLeaves(g: Graphics): void {
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
