# clock.py — Day/night cycle and time management
#
# Tracks in-game time (24-hour clock), day count, and speed multiplier.
# One game day = 210 real seconds at 1x speed.
#
# Python note: Classes don't need `export` — anything defined at module
# level is importable. `self.x` is like `this.x` in TypeScript.

from constants import DAY_LENGTH, FPS


class Clock:
    """Manages the in-game day/night cycle."""

    def __init__(self):
        self.day = 1
        self.hour = 9.0         # Start at 9 AM (float for smooth progression)
        self.tick = 0.0         # Accumulates real seconds
        self.speed = 1          # 1x, 2x, or 3x
        self.day_changed = False  # True for one frame when a new day starts

    def update(self, dt):
        """Advance the clock by dt seconds (real time).

        Args:
            dt: Delta time in seconds (1/FPS at normal speed).

        The clock maps 210 real seconds → 24 in-game hours.
        So 1 real second = 24/210 ≈ 0.114 hours ≈ 6.86 minutes.
        """
        self.day_changed = False
        self.tick += dt * self.speed

        # Convert tick to hours: 210s = 24h, so hours_per_second = 24/210
        hours_per_second = 24.0 / DAY_LENGTH
        self.hour += dt * self.speed * hours_per_second

        # New day
        if self.hour >= 24.0:
            self.hour -= 24.0
            self.day += 1
            self.day_changed = True

    def cycle_speed(self):
        """Cycle through speed options: 1 → 2 → 3 → 1."""
        if self.speed == 1:
            self.speed = 2
        elif self.speed == 2:
            self.speed = 3
        else:
            self.speed = 1

    @property
    def hour_int(self):
        """Current hour as integer (0-23)."""
        return int(self.hour) % 24

    @property
    def time_label(self):
        """Human-readable time string like '09:00'."""
        h = self.hour_int
        m = int((self.hour % 1) * 60)
        return f"{h:02d}:{m:02d}"

    @property
    def phase_emoji(self):
        """Time-of-day phase name for the HUD.
        Returns a short label since Pyxel has no emoji support.
        """
        h = self.hour_int
        if 5 <= h < 7:
            return "DAWN"
        elif 7 <= h < 12:
            return "MORN"
        elif 12 <= h < 14:
            return "NOON"
        elif 14 <= h < 17:
            return "AFT"
        elif 17 <= h < 20:
            return "EVE"
        elif 20 <= h < 22:
            return "DUSK"
        else:
            return "NITE"

    @property
    def day_progress(self):
        """Progress through the day as 0.0-1.0 float."""
        return self.hour / 24.0
