import type { Graphics } from "pixi.js";

// ── Seeded random ─────────────────────────────────────────
export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── DOM helper ────────────────────────────────────────────
export function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing: #${id}`);
  return e as T;
}

// ── Tiny 3x5 pixel font for floating text ─────────────────
export const PIXEL_FONT: Record<string, number[]> = {
  "0": [0xe,0x11,0x11,0x11,0xe], "1": [0x4,0xc,0x4,0x4,0xe],
  "2": [0xe,0x1,0xe,0x10,0x1f], "3": [0x1e,0x1,0xe,0x1,0x1e],
  "4": [0x11,0x11,0x1f,0x1,0x1], "5": [0x1f,0x10,0x1e,0x1,0x1e],
  "6": [0xe,0x10,0x1e,0x11,0xe], "7": [0x1f,0x1,0x2,0x4,0x4],
  "8": [0xe,0x11,0xe,0x11,0xe], "9": [0xe,0x11,0xf,0x1,0xe],
  "+": [0x0,0x4,0xe,0x4,0x0], "-": [0x0,0x0,0xe,0x0,0x0],
  " ": [0x0,0x0,0x0,0x0,0x0],
};

export function drawPixelString(g: Graphics, str: string, x: number, z: number, color: number, alpha: number): void {
  let cx = x - (str.length * 4) / 2; // center
  for (const ch of str) {
    const glyph = PIXEL_FONT[ch];
    if (glyph) {
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row]! & (1 << (4 - col))) {
            g.rect(cx + col, z + row, 1, 1).fill({ color, alpha });
          }
        }
      }
    }
    cx += 4;
  }
}
