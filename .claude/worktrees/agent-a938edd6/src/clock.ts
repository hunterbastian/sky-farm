import { WORLD_DAY_SECONDS, TIME_SCALE, LIGHT_MOODS } from "./constants";
import { clockTime, setClockTime, clockDay, setClockDay } from "./state";

export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export function getLightMood(hour: number): { color: number; alpha: number } {
  for (let i = 0; i < LIGHT_MOODS.length - 1; i++) {
    const curr = LIGHT_MOODS[i]!;
    const next = LIGHT_MOODS[i + 1]!;
    if (hour >= curr.hour && hour < next.hour) {
      const t = (hour - curr.hour) / (next.hour - curr.hour);
      return {
        color: lerpColor(curr.color, next.color, t),
        alpha: curr.alpha + (next.alpha - curr.alpha) * t,
      };
    }
  }
  return LIGHT_MOODS[0]!;
}

function dawnTick(): void {
  // Dawn tick is now cosmetic only — auto-farm handles growth
}

export function updateClock(dt: number): void {
  setClockTime(clockTime + dt * TIME_SCALE);
  if (clockTime >= WORLD_DAY_SECONDS) {
    setClockTime(clockTime - WORLD_DAY_SECONDS);
    setClockDay(clockDay + 1);
    dawnTick();
  }
}
