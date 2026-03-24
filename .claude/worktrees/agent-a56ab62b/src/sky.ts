import type { Application, Graphics } from "pixi.js";
import { clockTime } from "./state";
import { skyClouds } from "./state";
import { lerpColor } from "./clock";

export function updateSky(skyGfx: Graphics, app: Application): void {
  skyGfx.clear();
  const sw = app.screen.width;
  const sh = app.screen.height;
  const hour = (clockTime / 3600) % 24;

  // Sky gradient -- water palette harmony
  const dayTop = 0x194a7a;
  const dayBot = 0xa3b7ca;
  const nightTop = 0x080e20;
  const nightBot = 0x101830;
  const sunsetTop = 0xf6416c;
  const sunsetBot = 0xfff6b7;

  let topColor: number, botColor: number;
  if (hour >= 5 && hour < 18) {
    topColor = dayTop; botColor = dayBot;
  } else if (hour >= 18 && hour < 21) {
    const t = (hour - 18) / 3;
    topColor = lerpColor(dayTop, sunsetTop, t);
    botColor = lerpColor(dayBot, sunsetBot, t);
  } else if (hour >= 21 && hour < 22.5) {
    const t = (hour - 21) / 1.5;
    topColor = lerpColor(sunsetTop, nightTop, t);
    botColor = lerpColor(sunsetBot, nightBot, t);
  } else if (hour >= 2 && hour < 5) {
    const t = (hour - 2) / 3;
    topColor = lerpColor(nightTop, dayTop, t);
    botColor = lerpColor(nightBot, dayBot, t);
  } else {
    topColor = nightTop; botColor = nightBot;
  }

  // Draw sky gradient in horizontal bands
  const bands = 16;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const color = lerpColor(topColor, botColor, t);
    const bandH = Math.ceil(sh / bands) + 1;
    skyGfx.rect(0, Math.floor(t * sh), sw, bandH).fill(color);
  }

  // Drifting clouds
  const isNight = hour < 2 || hour >= 22.5;
  const cloudAlphaMul = isNight ? 0.3 : 1;
  for (const cloud of skyClouds) {
    cloud.x += cloud.speed * (1 / 60);
    if (cloud.x > sw + 100) { cloud.x = -cloud.w - 50; cloud.y = Math.random() * sh; }
    const a = cloud.alpha * cloudAlphaMul;
    // Puffy cumulus clouds -- warm off-white palette
    skyGfx.ellipse(cloud.x, cloud.y, cloud.w * 0.5, cloud.h).fill({ color: 0xf9f6f2, alpha: a * 0.7 });
    skyGfx.ellipse(cloud.x - cloud.w * 0.22, cloud.y + 2, cloud.w * 0.38, cloud.h * 0.9).fill({ color: 0xe1dbd6, alpha: a * 0.6 });
    skyGfx.ellipse(cloud.x + cloud.w * 0.27, cloud.y + 1, cloud.w * 0.42, cloud.h * 0.95).fill({ color: 0xe2e2e4, alpha: a * 0.65 });
    skyGfx.ellipse(cloud.x - cloud.w * 0.08, cloud.y - cloud.h * 0.4, cloud.w * 0.3, cloud.h * 0.7).fill({ color: 0xfefefe, alpha: a * 0.55 });
    // Warm shadow underside
    skyGfx.ellipse(cloud.x, cloud.y + cloud.h * 0.3, cloud.w * 0.45, cloud.h * 0.5).fill({ color: 0xd1d1d3, alpha: a * 0.3 });
  }
}
