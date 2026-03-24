import type { Application, Graphics } from "pixi.js";
import { clockTime } from "./state";
import { getLightMood } from "./clock";

export function updateDayNight(nightOverlay: Graphics, app: Application): void {
  nightOverlay.clear();
  const hour = clockTime / 3600;
  const mood = getLightMood(hour % 24);

  if (mood.alpha > 0.005) {
    nightOverlay.rect(0, 0, app.screen.width, app.screen.height)
      .fill({ color: mood.color, alpha: mood.alpha });
  }
}
