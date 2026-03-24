# weather.py — Weather system: sun, rain, wind, overcast
#
# Weather changes every 1-3 in-game hours. Each weather type affects
# crop growth rate and visual atmosphere. Rain auto-waters crops.

import random
import math
import pyxel
from constants import (
    SCREEN_W, SCREEN_H, ISLAND_X, ISLAND_Y, WORLD_PX,
    COL_SKY, COL_DWATER, COL_WHITE, COL_CREAM, COL_DARK,
)

# Weather types
SUNNY = "sunny"
RAIN = "rain"
OVERCAST = "overcast"
WINDY = "windy"

# How weather affects crop growth (multiplier)
GROWTH_MULTIPLIERS = {
    SUNNY: 1.0,
    RAIN: 1.5,      # rain = faster growth (auto-waters)
    OVERCAST: 0.8,   # less sun = slower
    WINDY: 1.0,      # neutral but visual effect
}


class Raindrop:
    __slots__ = ("x", "y", "speed", "length")
    def __init__(self):
        self.x = random.randint(0, SCREEN_W)
        self.y = random.randint(-SCREEN_H, 0)
        self.speed = random.uniform(80, 140)
        self.length = random.randint(2, 4)


class WeatherSystem:
    """Manages weather state and transitions."""

    def __init__(self):
        self.current = SUNNY
        self.change_timer = 0.0
        self.next_change = random.uniform(60, 180)  # real seconds until next change
        self.raindrops = []
        self.wind_offset = 0.0

    @property
    def growth_mult(self):
        """Current crop growth multiplier."""
        return GROWTH_MULTIPLIERS[self.current]

    @property
    def is_raining(self):
        return self.current == RAIN

    def update(self, dt):
        """Update weather state and particles."""
        self.change_timer += dt
        self.wind_offset += dt * 2

        # Weather transition
        if self.change_timer >= self.next_change:
            self.change_timer = 0.0
            self.next_change = random.uniform(60, 180)
            # Weighted random — sunny most common
            self.current = random.choices(
                [SUNNY, RAIN, OVERCAST, WINDY],
                [4, 2, 2, 2]
            )[0]
            # Initialize rain if starting
            if self.current == RAIN:
                self.raindrops = [Raindrop() for _ in range(40)]
            else:
                self.raindrops.clear()

        # Update raindrops
        if self.current == RAIN:
            wind = math.sin(self.wind_offset) * 10
            for drop in self.raindrops:
                drop.y += drop.speed * dt
                drop.x += wind * dt
                if drop.y > SCREEN_H:
                    drop.y = random.randint(-20, -5)
                    drop.x = random.randint(0, SCREEN_W)

    def draw(self):
        """Draw weather effects."""
        if self.current == RAIN:
            for drop in self.raindrops:
                ix, iy = int(drop.x), int(drop.y)
                pyxel.line(ix, iy, ix, iy + drop.length, COL_DWATER)

        elif self.current == OVERCAST:
            # Dim overlay
            pyxel.dither(0.15)
            pyxel.rect(0, 0, SCREEN_W, SCREEN_H, COL_DARK)
            pyxel.dither(1.0)

        elif self.current == WINDY:
            # Wind streaks (horizontal lines)
            for i in range(5):
                wx = (int(self.wind_offset * 40) + i * 53) % (SCREEN_W + 30) - 15
                wy = ISLAND_Y + 20 + i * 35
                pyxel.line(wx, wy, wx + 8, wy, COL_WHITE)

    def draw_indicator(self, x, y):
        """Draw a small weather icon at the given position."""
        if self.current == SUNNY:
            pyxel.text(x, y, "SUN", COL_CREAM)
        elif self.current == RAIN:
            pyxel.text(x, y, "RAIN", COL_DWATER)
        elif self.current == OVERCAST:
            pyxel.text(x, y, "CLOUD", COL_CREAM)
        elif self.current == WINDY:
            pyxel.text(x, y, "WIND", COL_WHITE)
