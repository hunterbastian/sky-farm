import type { Container } from "pixi.js";
import { ISLAND_SIZE, TILE_PX, RENDER_SCALE } from "./constants";
import {
  shakeIntensity, setShakeIntensity, shakeDecay,
  shakeOffX, setShakeOffX, shakeOffY, setShakeOffY,
} from "./state";

export function triggerShake(intensity = 3): void {
  setShakeIntensity(intensity);
}

export function updateShake(): void {
  if (shakeIntensity > 0.1) {
    setShakeOffX((Math.random() - 0.5) * shakeIntensity * 2);
    setShakeOffY((Math.random() - 0.5) * shakeIntensity * 2);
    setShakeIntensity(shakeIntensity * shakeDecay);
  } else {
    setShakeOffX(0);
    setShakeOffY(0);
    setShakeIntensity(0);
  }
}

export function updateCamera(world: Container, screenW: number, screenH: number): void {
  // Center camera on island middle
  const centerX = (ISLAND_SIZE / 2) * TILE_PX;
  const centerZ = (ISLAND_SIZE / 2) * TILE_PX;
  world.x = screenW / 2 - centerX * RENDER_SCALE + shakeOffX;
  world.y = screenH / 2 - centerZ * RENDER_SCALE + shakeOffY;
  world.scale.set(RENDER_SCALE);
}
