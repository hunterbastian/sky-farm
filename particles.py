# particles.py — All particle systems
#
# Particles are tiny visual effects that make interactions feel alive.
# Each particle has position, velocity, lifetime, and a color.
#
# Types:
#   - Dirt puffs (till) — brown dots scatter outward
#   - Seed pops (plant) — green dots burst upward
#   - Harvest bursts (harvest) — crop-colored confetti
#   - Wood chips (chop) — brown shards fly out
#   - Water splashes (pond/watering) — blue droplets
#   - Sparkles (coins, mature crops) — gold twinkling dots
#   - Motes (ambient) — tiny white dots drifting lazily
#   - Butterflies (ambient) — colored dots with fluttering movement
#   - Falling leaves (maple trees) — pink/red dots drifting down
#   - Fireflies (night) — warm glow dots that pulse
#
# Python note: We use one Particle class with type-specific behavior
# controlled by the `kind` field. This avoids a class-per-type explosion.

import math
import random
from constants import (
    TILE_PX, ISLAND_X, ISLAND_Y, SCREEN_W, SCREEN_H,
    COL_DARK, COL_BARK, COL_WOOD, COL_TAN,
    COL_DGREEN, COL_GREEN, COL_LGREEN,
    COL_DWATER, COL_SKY,
    COL_GOLD, COL_ORANGE, COL_RED,
    COL_PINK, COL_CREAM, COL_WHITE,
)


class Particle:
    """A single particle with position, velocity, and lifetime."""
    __slots__ = (
        "x", "y", "vx", "vy", "color", "life", "max_life",
        "kind", "size", "phase",
    )

    def __init__(self, x, y, vx, vy, color, life, kind="generic", size=1):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.color = color
        self.life = life
        self.max_life = life
        self.kind = kind
        self.size = size          # 1 = single pixel, 2 = 2x2
        self.phase = random.random() * math.pi * 2  # for oscillation


class ParticleSystem:
    """Manages all particles in the game."""

    def __init__(self):
        self.particles = []

        # Start with fewer ambient particles (island is tiny)
        self._mote_count = 5
        self._butterfly_count = 1
        for _ in range(self._mote_count):
            self._spawn_mote()
        for _ in range(self._butterfly_count):
            self._spawn_butterfly()

    def set_ambient_counts(self, motes, butterflies):
        """Update ambient counts when island expands."""
        self._mote_count = motes
        self._butterfly_count = butterflies

    # ================================================================
    # AMBIENT PARTICLES (always present)
    # ================================================================

    def _init_motes(self):
        """Spawn initial ambient motes (tiny drifting white dots)."""
        for _ in range(15):
            self._spawn_mote()

    def _spawn_mote(self):
        """Spawn a single mote at a random position over the island."""
        x = ISLAND_X + random.randint(0, 191)
        y = ISLAND_Y + random.randint(0, 191)
        vx = random.uniform(-3, 3)
        vy = random.uniform(-5, -1)
        life = random.uniform(4.0, 8.0)
        color = random.choice([COL_WHITE, COL_CREAM, COL_LGREEN])
        self.particles.append(Particle(x, y, vx, vy, color, life, "mote"))

    def _init_butterflies(self):
        """Spawn initial butterflies."""
        for _ in range(4):
            self._spawn_butterfly()

    def _spawn_butterfly(self):
        """Spawn a butterfly near flowers/grass."""
        x = ISLAND_X + random.randint(20, 170)
        y = ISLAND_Y + random.randint(40, 160)
        life = random.uniform(8.0, 15.0)
        color = random.choice([COL_PINK, COL_GOLD, COL_WHITE, COL_SKY])
        self.particles.append(Particle(x, y, 0, 0, color, life, "butterfly", 2))

    # ================================================================
    # EVENT-TRIGGERED PARTICLES
    # ================================================================

    def spawn_dirt_puffs(self, tile_x, tile_y, count=6):
        """Brown dirt particles when tilling."""
        cx, cy = self._tile_center(tile_x, tile_y)
        for _ in range(count):
            angle = random.uniform(0, math.pi * 2)
            speed = random.uniform(8, 20)
            vx = math.cos(angle) * speed
            vy = math.sin(angle) * speed - 5  # slight upward bias
            color = random.choice([COL_TAN, COL_WOOD, COL_BARK])
            life = random.uniform(0.3, 0.6)
            self.particles.append(Particle(cx, cy, vx, vy, color, life, "dirt"))

    def spawn_seed_pops(self, tile_x, tile_y, count=4):
        """Green dots popping up when planting."""
        cx, cy = self._tile_center(tile_x, tile_y)
        for _ in range(count):
            vx = random.uniform(-8, 8)
            vy = random.uniform(-20, -8)
            color = random.choice([COL_GREEN, COL_LGREEN, COL_DGREEN])
            life = random.uniform(0.4, 0.7)
            self.particles.append(Particle(cx, cy, vx, vy, color, life, "seed"))

    def spawn_harvest_burst(self, tile_x, tile_y, crop_color, count=8):
        """Crop-colored confetti burst on harvest."""
        cx, cy = self._tile_center(tile_x, tile_y)
        for _ in range(count):
            angle = random.uniform(0, math.pi * 2)
            speed = random.uniform(10, 25)
            vx = math.cos(angle) * speed
            vy = math.sin(angle) * speed - 10
            color = random.choice([crop_color, COL_GOLD, COL_WHITE])
            life = random.uniform(0.5, 1.0)
            self.particles.append(Particle(cx, cy, vx, vy, color, life, "harvest"))

    def spawn_wood_chips(self, tile_x, tile_y, count=5):
        """Brown wood chips flying out on tree chop."""
        cx, cy = self._tile_center(tile_x, tile_y)
        cy -= 8  # spawn at trunk height, not base
        for _ in range(count):
            vx = random.uniform(-15, 15)
            vy = random.uniform(-20, -5)
            color = random.choice([COL_WOOD, COL_BARK, COL_TAN])
            life = random.uniform(0.3, 0.8)
            self.particles.append(Particle(cx, cy, vx, vy, color, life, "chip"))

    def spawn_sparkles(self, tile_x, tile_y, count=4):
        """Gold sparkle dots (coins, mature crops)."""
        cx, cy = self._tile_center(tile_x, tile_y)
        for _ in range(count):
            vx = random.uniform(-5, 5)
            vy = random.uniform(-15, -5)
            life = random.uniform(0.5, 1.2)
            self.particles.append(
                Particle(cx + random.randint(-4, 4), cy + random.randint(-4, 4),
                         vx, vy, COL_GOLD, life, "sparkle")
            )

    def spawn_water_splash(self, tile_x, tile_y, count=5):
        """Blue water droplets."""
        cx, cy = self._tile_center(tile_x, tile_y)
        for _ in range(count):
            vx = random.uniform(-10, 10)
            vy = random.uniform(-18, -6)
            color = random.choice([COL_SKY, COL_DWATER, COL_WHITE])
            life = random.uniform(0.3, 0.6)
            self.particles.append(Particle(cx, cy, vx, vy, color, life, "splash"))

    def spawn_falling_leaf(self, tile_x, tile_y):
        """A single pink/red leaf drifting down from a maple tree."""
        sx = ISLAND_X + tile_x * TILE_PX + random.randint(-4, 12)
        sy = ISLAND_Y + tile_y * TILE_PX - 12  # start at canopy height
        vx = random.uniform(-3, 3)
        vy = random.uniform(5, 12)
        color = random.choice([COL_PINK, COL_RED, COL_ORANGE, COL_CREAM])
        life = random.uniform(2.0, 4.0)
        self.particles.append(Particle(sx, sy, vx, vy, color, life, "leaf"))

    def spawn_egg_pop(self, tile_x, tile_y, count=3):
        """Small cream/white burst when collecting an egg."""
        cx, cy = self._tile_center(tile_x, tile_y)
        for _ in range(count):
            vx = random.uniform(-8, 8)
            vy = random.uniform(-12, -4)
            color = random.choice([COL_CREAM, COL_WHITE])
            life = random.uniform(0.3, 0.5)
            self.particles.append(Particle(cx, cy, vx, vy, color, life, "egg"))

    # ================================================================
    # UPDATE
    # ================================================================

    def update(self, dt, speed=1):
        """Update all particles. Respawn ambient ones when they expire."""
        effective_dt = dt  # particles aren't affected by game speed
        mote_count = 0
        butterfly_count = 0

        alive = []
        for p in self.particles:
            p.life -= effective_dt

            if p.life <= 0:
                # Count ambient types so we can respawn
                if p.kind == "mote":
                    mote_count += 1
                elif p.kind == "butterfly":
                    butterfly_count += 1
                continue  # particle dies

            # === Movement by type ===
            if p.kind == "butterfly":
                # Fluttery sine-wave movement
                p.phase += effective_dt * 4
                p.x += math.sin(p.phase) * 15 * effective_dt
                p.y += math.cos(p.phase * 0.7) * 8 * effective_dt
                # Drift slowly across island
                p.x += random.uniform(-0.3, 0.3)
                # Wrap horizontally
                if p.x < ISLAND_X - 10:
                    p.x = ISLAND_X + 200
                elif p.x > ISLAND_X + 200:
                    p.x = ISLAND_X - 10

            elif p.kind == "mote":
                # Gentle drift upward with slight horizontal wobble
                p.phase += effective_dt * 2
                p.x += math.sin(p.phase) * 5 * effective_dt
                p.y += p.vy * effective_dt

            elif p.kind == "leaf":
                # Sway side to side while falling
                p.phase += effective_dt * 3
                p.x += math.sin(p.phase) * 8 * effective_dt + p.vx * effective_dt
                p.y += p.vy * effective_dt
                # Slow down as leaf settles
                p.vy *= 0.995

            elif p.kind == "sparkle":
                # Float up, slow down
                p.x += p.vx * effective_dt
                p.y += p.vy * effective_dt
                p.vy *= 0.95

            else:
                # Standard physics: gravity + velocity
                p.x += p.vx * effective_dt
                p.y += p.vy * effective_dt
                p.vy += 40 * effective_dt  # gravity

            alive.append(p)

        self.particles = alive

        # Respawn ambient particles
        for _ in range(mote_count):
            self._spawn_mote()
        for _ in range(butterfly_count):
            self._spawn_butterfly()

    # ================================================================
    # DRAW
    # ================================================================

    def draw(self):
        """Draw all particles."""
        import pyxel

        for p in self.particles:
            # Fade out near end of life
            remaining = p.life / p.max_life
            if remaining < 0.2 and p.kind not in ("mote", "butterfly"):
                # Skip drawing some frames for a flicker-fade effect
                if random.random() > remaining * 5:
                    continue

            ix = int(p.x)
            iy = int(p.y)

            if p.kind == "butterfly":
                # 2-pixel body + flapping wings
                pyxel.pset(ix, iy, p.color)
                # Wings flap
                wing_phase = math.sin(p.phase * 6)
                if wing_phase > 0:
                    pyxel.pset(ix - 1, iy, p.color)
                    pyxel.pset(ix + 1, iy, p.color)
                else:
                    pyxel.pset(ix - 1, iy - 1, p.color)
                    pyxel.pset(ix + 1, iy - 1, p.color)

            elif p.kind == "sparkle":
                # Twinkle: alternate between visible and invisible
                if math.sin(p.phase + p.life * 8) > 0:
                    pyxel.pset(ix, iy, COL_GOLD)
                    # Cross sparkle shape at peak brightness
                    if remaining > 0.5:
                        pyxel.pset(ix - 1, iy, COL_GOLD)
                        pyxel.pset(ix + 1, iy, COL_GOLD)
                        pyxel.pset(ix, iy - 1, COL_GOLD)

            elif p.kind == "leaf":
                # Leaf: 2 pixels that rotate (simulate by alternating shape)
                if math.sin(p.phase) > 0:
                    pyxel.pset(ix, iy, p.color)
                    pyxel.pset(ix + 1, iy, p.color)
                else:
                    pyxel.pset(ix, iy, p.color)
                    pyxel.pset(ix, iy + 1, p.color)

            elif p.kind == "mote":
                # Simple dot, occasionally flicker
                if random.random() > 0.1:
                    pyxel.pset(ix, iy, p.color)

            else:
                # Default: single pixel
                pyxel.pset(ix, iy, p.color)
                if p.size >= 2:
                    pyxel.pset(ix + 1, iy, p.color)

    # ================================================================
    # HELPERS
    # ================================================================

    def _tile_center(self, tile_x, tile_y):
        """Get screen-space center of a tile."""
        return (
            ISLAND_X + tile_x * TILE_PX + TILE_PX // 2,
            ISLAND_Y + tile_y * TILE_PX + TILE_PX // 2,
        )
