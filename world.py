# world.py — Island shape, tile grid, and zone definitions
#
# The island is a 24x24 grid, but not every tile is land.
# We define the island shape, pond, and chicken pen as zones.
#
# Python note: `set()` is like Set<string> in TypeScript — fast lookups.
# Tuples `(x, y)` are immutable pairs — like `[x, y] as const`.

import math
import random
from constants import ISLAND_SIZE

# === Tile types ===
TILE_GRASS = "grass"
TILE_FARMLAND = "farmland"


def _make_island_mask():
    """Generate which tiles are part of the island (rounded rectangle shape).
    Returns a set of (x, y) tuples that are valid island positions.

    The original PixiJS version used a circular/rounded island.
    We'll make a rounded rectangle that fills most of the 24x24 grid.
    """
    mask = set()
    cx, cy = ISLAND_SIZE // 2, ISLAND_SIZE // 2  # center (12, 12)
    # Rounded rectangle: full grid minus corners
    corner_radius = 3
    for y in range(ISLAND_SIZE):
        for x in range(ISLAND_SIZE):
            # Check if this tile is inside the rounded rectangle
            # A rounded rect = rectangle where corners are clipped by circles
            dx = 0
            dy = 0
            if x < corner_radius:
                dx = corner_radius - x
            elif x >= ISLAND_SIZE - corner_radius:
                dx = x - (ISLAND_SIZE - corner_radius - 1)
            if y < corner_radius:
                dy = corner_radius - y
            elif y >= ISLAND_SIZE - corner_radius:
                dy = y - (ISLAND_SIZE - corner_radius - 1)

            # If we're in a corner zone, check the circular clip
            if dx > 0 and dy > 0:
                if dx * dx + dy * dy > corner_radius * corner_radius:
                    continue  # outside the rounded corner

            mask.add((x, y))
    return mask


# The island shape — frozen at import time
ISLAND_MASK = _make_island_mask()


def _make_pond_tiles():
    """Pond in the bottom-left area of the island.
    Returns a set of (x, y) tuples for pond tiles.
    """
    pond = set()
    # Organic pond shape in bottom-left quadrant
    pond_center = (5, 18)
    for y in range(15, 22):
        for x in range(2, 10):
            # Elliptical shape with some variation
            dx = (x - pond_center[0]) / 3.5
            dy = (y - pond_center[1]) / 2.8
            dist = dx * dx + dy * dy
            if dist < 1.0 and (x, y) in ISLAND_MASK:
                pond.add((x, y))
    return pond


POND_TILES = _make_pond_tiles()


def _make_pen_tiles():
    """Chicken pen area — rectangular zone.
    Returns a set of (x, y) tuples for pen tiles.
    """
    pen = set()
    for y in range(2, 7):
        for x in range(8, 14):
            if (x, y) in ISLAND_MASK:
                pen.add((x, y))
    return pen


PEN_TILES = _make_pen_tiles()


def is_on_island(x, y):
    """Check if a tile coordinate is part of the island."""
    return (x, y) in ISLAND_MASK


def is_pond_tile(x, y):
    """Check if a tile is part of the pond."""
    return (x, y) in POND_TILES


def is_pen_tile(x, y):
    """Check if a tile is part of the chicken pen."""
    return (x, y) in PEN_TILES


def is_farmable(x, y):
    """Check if a tile can be tilled for farming."""
    return (
        is_on_island(x, y)
        and not is_pond_tile(x, y)
        and not is_pen_tile(x, y)
    )


# === Tile grid ===
# 2D list (like a 2D array in TS): tiles[y][x] = tile_type or None
# None means it's not part of the island.
# We use list comprehension here — Python's version of array.map().
#   [expr for y in range(N)] creates a list of N items.
#   [[...] for y in ...] creates a 2D list (list of lists).

def create_tile_grid():
    """Create the initial tile grid. All island tiles start as grass."""
    grid = []
    for y in range(ISLAND_SIZE):
        row = []
        for x in range(ISLAND_SIZE):
            if is_on_island(x, y):
                row.append(TILE_GRASS)
            else:
                row.append(None)
        grid.append(row)
    return grid


# === Grass variation ===
# Seeded random for deterministic tile variation (same look every load)

def _make_grass_variation():
    """Pre-compute a variation value (0-3) for each grass tile.
    Used to pick which grass sprite variant to draw.
    """
    rng = random.Random(42)  # seeded — deterministic (like seededRandom in the TS version)
    variation = {}
    for y in range(ISLAND_SIZE):
        for x in range(ISLAND_SIZE):
            if (x, y) in ISLAND_MASK:
                variation[(x, y)] = rng.randint(0, 3)
    return variation


GRASS_VARIATION = _make_grass_variation()


# === Wildflower positions ===

def _make_wildflower_positions():
    """Scatter wildflowers on grass tiles, avoiding pond/pen/tree areas.
    Returns list of (x, y) tuples.
    """
    rng = random.Random(123)  # different seed from grass variation
    flowers = []
    # Tree positions to avoid (oak and maple)
    tree_zones = {
        (3, 2), (12, 2), (21, 2),   # oaks
        (8, 15), (18, 15),            # maples
    }
    # Expand tree zones to nearby tiles
    tree_nearby = set()
    for tx, ty in tree_zones:
        for dy in range(-1, 3):
            for dx in range(-1, 2):
                tree_nearby.add((tx + dx, ty + dy))

    candidates = []
    for y in range(ISLAND_SIZE):
        for x in range(ISLAND_SIZE):
            if (
                is_on_island(x, y)
                and not is_pond_tile(x, y)
                and not is_pen_tile(x, y)
                and (x, y) not in tree_nearby
            ):
                candidates.append((x, y))

    # Pick ~30 random positions
    rng.shuffle(candidates)
    flowers = candidates[:30]
    return flowers


WILDFLOWER_POSITIONS = _make_wildflower_positions()


# === Edge detection for cliff rendering ===

def get_edge_flags(x, y):
    """Return which sides of a tile are island edges.
    Used for drawing cliff/drop-off edges.

    Returns a dict: {"n": bool, "s": bool, "e": bool, "w": bool}
    True = that side borders non-island (void/sky).
    """
    if not is_on_island(x, y):
        return {"n": False, "s": False, "e": False, "w": False}
    return {
        "n": not is_on_island(x, y - 1),
        "s": not is_on_island(x, y + 1),
        "e": not is_on_island(x + 1, y),
        "w": not is_on_island(x - 1, y),
    }
