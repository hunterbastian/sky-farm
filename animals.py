# animals.py — Chickens, eggs, bees, and honey
#
# Chickens wander inside the pen, cycle through idle animations,
# and lay eggs periodically. Bees orbit the beehive on the middle oak.
#
# Python note: `random.choice()` picks a random element from a list —
# like `arr[Math.floor(Math.random() * arr.length)]` in JS.

import math
import random
from constants import (
    TILE_PX, COL_GOLD, COL_ORANGE, COL_RED, COL_WHITE,
    COL_CREAM, COL_DARK, COL_DGREEN,
    AUTO_EGG_COLLECT_DELAY,
)

# === Chicken pen bounds (tile coords) ===
PEN_X_MIN, PEN_X_MAX = 9, 12    # inner area (1 tile inside fence)
PEN_Y_MIN, PEN_Y_MAX = 3, 5

# Chicken animation states
CHICKEN_IDLE = "idle"
CHICKEN_WALK = "walk"
CHICKEN_PECK = "peck"
CHICKEN_SIT = "sit"

# Egg laying interval range (seconds)
EGG_LAY_MIN = 30.0
EGG_LAY_MAX = 60.0


class Chicken:
    """A chicken that wanders the pen and lays eggs."""
    __slots__ = (
        "x", "y", "state", "state_timer", "direction",
        "anim_frame", "egg_timer",
    )

    def __init__(self, x, y):
        # Position in sub-tile coordinates (float, within pen bounds)
        self.x = float(x)
        self.y = float(y)
        self.state = CHICKEN_IDLE
        self.state_timer = random.uniform(1.0, 3.0)
        self.direction = random.choice([-1, 1])  # -1=left, 1=right
        self.anim_frame = 0
        self.egg_timer = random.uniform(EGG_LAY_MIN / 2, EGG_LAY_MAX)

    def update(self, dt):
        """Update chicken behavior. Returns True if an egg was laid."""
        laid_egg = False

        # Egg timer
        self.egg_timer -= dt
        if self.egg_timer <= 0:
            self.egg_timer = random.uniform(EGG_LAY_MIN, EGG_LAY_MAX)
            laid_egg = True

        # State machine timer
        self.state_timer -= dt
        if self.state_timer <= 0:
            self._change_state()

        # Movement (only when walking)
        if self.state == CHICKEN_WALK:
            speed = 0.5  # tiles per second
            self.x += self.direction * speed * dt
            # Bounce off pen walls
            if self.x < PEN_X_MIN:
                self.x = PEN_X_MIN
                self.direction = 1
            elif self.x > PEN_X_MAX:
                self.x = PEN_X_MAX
                self.direction = -1

        # Animation frame cycling
        self.anim_frame = (self.anim_frame + 1) % 4 if self.state == CHICKEN_WALK else 0

        return laid_egg

    def _change_state(self):
        """Transition to a new random state."""
        states = [CHICKEN_IDLE, CHICKEN_WALK, CHICKEN_PECK, CHICKEN_SIT]
        weights = [3, 4, 2, 1]  # walk most often, sit rarely
        self.state = random.choices(states, weights)[0]
        self.state_timer = random.uniform(1.5, 4.0)
        if self.state == CHICKEN_WALK:
            self.direction = random.choice([-1, 1])


class Egg:
    """An egg on the ground, waiting to be collected."""
    __slots__ = ("x", "y", "age")

    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.age = 0.0  # for a subtle bob animation


class Bee:
    """A bee orbiting the beehive."""
    __slots__ = ("angle", "orbit_radius", "speed", "brightness", "z_offset")

    def __init__(self, index):
        self.angle = index * (math.pi * 2 / 5)  # evenly spaced around circle
        self.orbit_radius = 6 + index * 1.5       # pixels from hive center
        self.speed = 1.2 + index * 0.3             # radians per second
        self.brightness = 0.0                       # for pulsing glow
        self.z_offset = index * 0.5                 # slight vertical offset

    def update(self, dt):
        """Update orbit position."""
        self.angle += self.speed * dt
        if self.angle > math.pi * 2:
            self.angle -= math.pi * 2
        self.brightness = 0.5 + 0.5 * math.sin(self.angle * 3)


class AnimalSystem:
    """Manages chickens, eggs, bees, and honey."""

    def __init__(self):
        # Start empty — animals added as island expands
        self.chickens = []
        self.eggs = []
        self.bees = []
        self.honey = 0.0
        self._chickens_spawned = False
        self._bees_spawned = False

        # Auto-collect
        self.auto_collect_eggs = True
        self._egg_collect_timer = 0.0

    def spawn_chickens(self):
        """Add chickens when the pen area becomes available."""
        if self._chickens_spawned:
            return
        self._chickens_spawned = True
        self.chickens = [
            Chicken(PEN_X_MIN + 1, PEN_Y_MIN + 1),
            Chicken(PEN_X_MAX - 1, PEN_Y_MIN),
            Chicken(PEN_X_MIN, PEN_Y_MAX),
            Chicken(PEN_X_MAX, PEN_Y_MAX - 1),
        ]

    def spawn_bees(self):
        """Add bees when the hive tree appears."""
        if self._bees_spawned:
            return
        self._bees_spawned = True
        self.bees = [Bee(i) for i in range(5)]

    def update(self, dt, speed=1):
        """Update all animals. Returns coins from auto-collected eggs."""
        effective_dt = dt * speed
        coins = 0

        # --- Chickens ---
        for chicken in self.chickens:
            laid = chicken.update(effective_dt)
            if laid:
                # Lay egg near chicken position
                self.eggs.append(Egg(chicken.x, chicken.y))

        # --- Eggs age ---
        for egg in self.eggs:
            egg.age += effective_dt

        # --- Auto-collect eggs ---
        if self.auto_collect_eggs:
            self._egg_collect_timer += effective_dt
            if self._egg_collect_timer >= AUTO_EGG_COLLECT_DELAY and self.eggs:
                self._egg_collect_timer = 0.0
                coins = len(self.eggs) * 3  # 3 coins per egg
                self.eggs.clear()

        # --- Bees ---
        for bee in self.bees:
            bee.update(effective_dt)

        # --- Honey accumulation ---
        self.honey += effective_dt * 0.5  # 0.5 per second

        return coins

    def collect_egg_at(self, tx, ty):
        """Try to collect an egg near the given tile. Returns coins earned."""
        for egg in self.eggs:
            if abs(egg.x - tx) < 1.5 and abs(egg.y - ty) < 1.5:
                self.eggs.remove(egg)
                return 3
        return 0
