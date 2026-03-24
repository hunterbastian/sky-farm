# draw_world.py — Render the island terrain
#
# Clean, flat, Japanese-inspired aesthetic. No dithering.
# Soft colors, crisp edges, deliberate pixel placement.
# Think Mother 3, Tamagotchi, Sumikkogurashi.

import pyxel
import math
import random as _rng
from constants import (
    TILE_PX, ISLAND_SIZE, ISLAND_X, ISLAND_Y, SCREEN_W, SCREEN_H,
    COL_DARK, COL_BARK, COL_WOOD, COL_TAN, COL_WET,
    COL_DGREEN, COL_GREEN, COL_LGREEN,
    COL_DWATER, COL_SKY, COL_GOLD, COL_ORANGE,
    COL_RED, COL_PINK, COL_CREAM, COL_WHITE,
)
from world import (
    ISLAND_MASK, POND_TILES, PEN_TILES, ISLAND_SIZE,
    GRASS_VARIATION, WILDFLOWER_POSITIONS,
    is_on_island, is_pond_tile, is_pen_tile, get_edge_flags,
    TILE_GRASS, TILE_FARMLAND,
)


def tile_to_screen(tx, ty):
    """Convert tile coordinates to screen pixel coordinates."""
    return (ISLAND_X + tx * TILE_PX, ISLAND_Y + ty * TILE_PX)


# ============================================================
# STARS (pre-computed, consistent positions)
# ============================================================
_star_rng = _rng.Random(999)
_STARS = [(
    _star_rng.randint(4, SCREEN_W - 4),
    _star_rng.randint(2, 50),
    _star_rng.uniform(0.3, 1.0),
    _star_rng.uniform(0, 6.28),
) for _ in range(25)]


# ============================================================
# SKY — clean flat bands, no dithering
# ============================================================

def _sky_colors(hour):
    """Return (upper, lower, horizon) color indices for the hour.
    Clean flat colors — no gradients, no dithering.
    """
    h = int(hour)
    if h < 5:     return (COL_DARK,   COL_DARK,   COL_DARK)     # night
    elif h < 6:   return (COL_DARK,   COL_DWATER, COL_BARK)     # pre-dawn
    elif h < 7:   return (COL_DWATER, COL_DWATER, COL_ORANGE)   # dawn
    elif h < 8:   return (COL_DWATER, COL_SKY,    COL_GOLD)     # early morning
    elif h < 11:  return (COL_DWATER, COL_SKY,    COL_CREAM)    # morning
    elif h < 15:  return (COL_SKY,    COL_SKY,    COL_CREAM)    # midday
    elif h < 17:  return (COL_DWATER, COL_SKY,    COL_CREAM)    # afternoon
    elif h < 18:  return (COL_SKY,    COL_SKY,    COL_GOLD)     # golden hour
    elif h < 19:  return (COL_DWATER, COL_DWATER, COL_RED)      # sunset
    elif h < 20:  return (COL_DARK,   COL_DWATER, COL_PINK)     # dusk
    elif h < 21:  return (COL_DARK,   COL_DWATER, COL_BARK)     # twilight
    else:         return (COL_DARK,   COL_DARK,   COL_DARK)     # night


def _is_night(hour):
    return hour < 6 or hour >= 21


def draw_sky(frame_count, hour=12.0):
    """Clean flat sky with 3 color bands. Stars at night."""
    upper, lower, horizon = _sky_colors(hour)

    # Three clean bands
    pyxel.rect(0, 0, SCREEN_W, 55, upper)
    pyxel.rect(0, 55, SCREEN_W, 130, lower)
    pyxel.rect(0, 185, SCREEN_W, 55, horizon)

    # Stars at night — clean single pixels, no dithering
    if _is_night(hour):
        for sx, sy, bright, phase in _STARS:
            twinkle = 0.5 + 0.5 * math.sin(frame_count * 0.04 + phase)
            if twinkle * bright > 0.4:
                pyxel.pset(sx, sy, COL_WHITE)

    # Store for night overlay
    draw_sky._is_night = _is_night(hour)
    draw_sky._hour = hour


draw_sky._is_night = False
draw_sky._hour = 12.0


def draw_night_overlay():
    """Gentle night darkening — single flat overlay, no dithering grain."""
    h = draw_sky._hour
    if 7 <= h < 19:
        return  # daytime, no overlay

    # Calculate darkness (0 to 0.6 max)
    if h >= 19:
        darkness = min(0.6, (h - 19) * 0.15)
    elif h < 7:
        darkness = min(0.6, (7 - h) * 0.15)
    else:
        darkness = 0

    if darkness > 0.02:
        pyxel.dither(darkness)
        pyxel.rect(0, 0, SCREEN_W, SCREEN_H, COL_DARK)
        pyxel.dither(1.0)


def draw_clouds(frame_count, hour=12.0):
    """Clean fluffy clouds — solid white, no tinting, no dithering."""
    cloud_data = [
        (0.12, 16, 18, 4),
        (0.3,  10, 12, 3),
        (0.2,  28, 20, 5),
        (0.45, 36, 14, 3),
        (0.08, 22, 22, 5),
    ]

    # Fewer clouds at night
    count = 5 if not _is_night(hour) else 2

    for i, (speed, base_y, w, h) in enumerate(cloud_data[:count]):
        x = (frame_count * speed + i * 53) % (SCREEN_W + w * 2) - w
        ix = int(x)

        # Simple puffy shape — two overlapping rects
        pyxel.rect(ix + 2, base_y, w - 4, h + 1, COL_WHITE)
        pyxel.rect(ix, base_y + 1, w, h - 1, COL_WHITE)


# ============================================================
# ISLAND TILES — clean, flat, Japanese-inspired
# ============================================================

def draw_island(tiles, frame_count):
    """Draw all island tiles — clean and flat."""
    for y in range(ISLAND_SIZE):
        for x in range(ISLAND_SIZE):
            if not is_on_island(x, y):
                continue

            sx, sy = tile_to_screen(x, y)
            tile_type = tiles[y][x]

            if is_pond_tile(x, y):
                _draw_pond_tile(sx, sy, x, y, frame_count)
            elif is_pen_tile(x, y):
                _draw_pen_tile(sx, sy, x, y)
            elif tile_type == TILE_FARMLAND:
                _draw_farmland_tile(sx, sy, x, y)
            else:
                _draw_grass_tile(sx, sy, x, y)

    _draw_cliff_edges()
    _draw_wildflowers(frame_count)


def _draw_grass_tile(sx, sy, tx, ty):
    """Clean grass — flat fill with tiny detail accents. No noise."""
    var = GRASS_VARIATION.get((tx, ty), 0)

    # Soft checkerboard: alternate between two greens
    if (tx + ty) % 2 == 0:
        pyxel.rect(sx, sy, TILE_PX, TILE_PX, COL_GREEN)
    else:
        pyxel.rect(sx, sy, TILE_PX, TILE_PX, COL_DGREEN)

    # One or two detail pixels per tile — deliberate, not noisy
    if var == 0:
        pyxel.pset(sx + 3, sy + 2, COL_LGREEN)
    elif var == 1:
        pyxel.pset(sx + 5, sy + 4, COL_LGREEN)
        pyxel.pset(sx + 5, sy + 3, COL_LGREEN)  # tall blade
    elif var == 2:
        pyxel.pset(sx + 2, sy + 5, COL_LGREEN)
    # var 3: no detail — clean flat tile


def _draw_farmland_tile(sx, sy, tx, ty):
    """Clean farmland — flat brown with simple furrow lines."""
    pyxel.rect(sx, sy, TILE_PX, TILE_PX, COL_TAN)
    # Clean horizontal furrow lines
    for row in range(1, TILE_PX, 2):
        pyxel.line(sx, sy + row, sx + TILE_PX - 1, sy + row, COL_WOOD)


def _draw_pond_tile(sx, sy, tx, ty, frame_count):
    """Clean pond water — flat blue with one animated highlight."""
    pyxel.rect(sx, sy, TILE_PX, TILE_PX, COL_DWATER)

    # Single moving highlight (gentle shimmer, not noisy)
    phase = (frame_count // 30 + tx * 3 + ty * 7) % 8
    hx = sx + [2, 4, 6, 5, 3, 1, 2, 4][phase]
    hy = sy + [1, 3, 5, 2, 6, 4, 3, 1][phase]
    pyxel.pset(hx, hy, COL_SKY)

    # Shore edge — single light blue line where water meets land
    if is_on_island(tx, ty - 1) and not is_pond_tile(tx, ty - 1):
        pyxel.line(sx, sy, sx + 7, sy, COL_SKY)
    if is_on_island(tx, ty + 1) and not is_pond_tile(tx, ty + 1):
        pyxel.line(sx, sy + 7, sx + 7, sy + 7, COL_SKY)
    if is_on_island(tx - 1, ty) and not is_pond_tile(tx - 1, ty):
        pyxel.line(sx, sy, sx, sy + 7, COL_SKY)
    if is_on_island(tx + 1, ty) and not is_pond_tile(tx + 1, ty):
        pyxel.line(sx + 7, sy, sx + 7, sy + 7, COL_SKY)

    # Lily pad with tiny face on select tiles
    if (tx + ty * 3) % 9 == 0:
        pyxel.rect(sx + 1, sy + 3, 4, 2, COL_GREEN)
        pyxel.pset(sx + 2, sy + 3, COL_LGREEN)
        # Tiny eyes
        pyxel.pset(sx + 2, sy + 3, COL_DARK)
        pyxel.pset(sx + 4, sy + 3, COL_DARK)


def _draw_pen_tile(sx, sy, tx, ty):
    """Clean pen — flat cream with minimal straw detail."""
    pyxel.rect(sx, sy, TILE_PX, TILE_PX, COL_CREAM)
    # Two straw dots (not noisy)
    pyxel.pset(sx + 2, sy + 3, COL_TAN)
    pyxel.pset(sx + 5, sy + 5, COL_TAN)

    # Fence on boundary — clean single-pixel lines
    if ty == 2:
        pyxel.line(sx, sy, sx + 7, sy, COL_BARK)
        pyxel.line(sx, sy + 1, sx + 7, sy + 1, COL_WOOD)
    if ty == 6:
        pyxel.line(sx, sy + 6, sx + 7, sy + 6, COL_WOOD)
        pyxel.line(sx, sy + 7, sx + 7, sy + 7, COL_BARK)
    if tx == 8:
        pyxel.line(sx, sy, sx, sy + 7, COL_BARK)
        pyxel.line(sx + 1, sy, sx + 1, sy + 7, COL_WOOD)
    if tx == 13:
        pyxel.line(sx + 6, sy, sx + 6, sy + 7, COL_WOOD)
        pyxel.line(sx + 7, sy, sx + 7, sy + 7, COL_BARK)


def _draw_cliff_edges():
    """Clean cliff edges — flat layered colors, no dithering."""
    for y in range(ISLAND_SIZE):
        for x in range(ISLAND_SIZE):
            if not is_on_island(x, y):
                continue

            sx, sy = tile_to_screen(x, y)
            edges = get_edge_flags(x, y)

            if edges["s"]:
                pyxel.rect(sx, sy + TILE_PX,     TILE_PX, 1, COL_DGREEN)
                pyxel.rect(sx, sy + TILE_PX + 1,  TILE_PX, 1, COL_TAN)
                pyxel.rect(sx, sy + TILE_PX + 2,  TILE_PX, 1, COL_BARK)
                pyxel.rect(sx, sy + TILE_PX + 3,  TILE_PX, 1, COL_DARK)

            if edges["e"]:
                pyxel.line(sx + TILE_PX, sy, sx + TILE_PX, sy + TILE_PX - 1, COL_DGREEN)

            if edges["n"]:
                pyxel.line(sx, sy, sx + TILE_PX - 1, sy, COL_LGREEN)


def _draw_wildflowers(frame_count):
    """Cute wildflowers — clean shapes, gentle sway."""
    colors = [COL_GOLD, COL_PINK, COL_RED, COL_WHITE, COL_CREAM, COL_ORANGE]

    for i, (fx, fy) in enumerate(WILDFLOWER_POSITIONS):
        sx, sy = tile_to_screen(fx, fy)
        color = colors[i % len(colors)]

        ox = (i * 3 + 1) % 5 + 1
        oy = (i * 5 + 2) % 4 + 2
        sway = 1 if (frame_count // 45 + i) % 6 == 0 else 0

        px = sx + ox + sway
        py = sy + oy

        # Stem
        pyxel.pset(px, py + 1, COL_DGREEN)

        # Flower — simple dot or cross
        if i % 4 == 0:
            # Cross flower (3px)
            pyxel.pset(px, py, color)
            pyxel.pset(px - 1, py, color)
            pyxel.pset(px + 1, py, color)
        else:
            pyxel.pset(px, py, color)


def draw_crops(crops):
    """Draw crops — clean growth stages."""
    for crop in crops:
        sx, sy = tile_to_screen(crop.x, crop.y)
        color = crop.definition["color"]
        stage = crop.stage

        if stage == 0:
            pyxel.pset(sx + 3, sy + 5, COL_DGREEN)
            pyxel.pset(sx + 4, sy + 5, COL_DGREEN)

        elif stage == 1:
            pyxel.pset(sx + 3, sy + 5, COL_DGREEN)
            pyxel.pset(sx + 3, sy + 4, COL_GREEN)
            pyxel.pset(sx + 4, sy + 3, COL_LGREEN)
            pyxel.pset(sx + 2, sy + 4, COL_LGREEN)

        elif stage == 2:
            pyxel.rect(sx + 3, sy + 3, 2, 3, COL_GREEN)
            pyxel.pset(sx + 2, sy + 3, COL_LGREEN)
            pyxel.pset(sx + 5, sy + 3, COL_LGREEN)
            pyxel.pset(sx + 3, sy + 2, color)
            pyxel.pset(sx + 4, sy + 2, color)
            pyxel.pset(sx + 3, sy + 6, COL_DGREEN)

        else:
            # Mature — full crop with kawaii face!
            pyxel.rect(sx + 2, sy + 1, 4, 4, color)
            pyxel.rect(sx + 3, sy + 5, 2, 1, COL_GREEN)  # stem
            pyxel.pset(sx + 3, sy + 6, COL_DGREEN)
            pyxel.pset(sx + 4, sy + 6, COL_DGREEN)
            pyxel.pset(sx + 1, sy + 2, COL_LGREEN)  # leaf
            pyxel.pset(sx + 6, sy + 2, COL_LGREEN)  # leaf
            # Kawaii face — two dot eyes + tiny smile
            pyxel.pset(sx + 3, sy + 2, COL_DARK)  # left eye
            pyxel.pset(sx + 4, sy + 2, COL_DARK)  # right eye
            pyxel.pset(sx + 3, sy + 3, COL_DARK)  # smile left
            pyxel.pset(sx + 4, sy + 3, COL_DARK)  # smile right
            # Rosy cheeks
            pyxel.pset(sx + 2, sy + 3, COL_PINK)
            pyxel.pset(sx + 5, sy + 3, COL_PINK)

        if crop.watered and not crop.is_mature:
            pyxel.pset(sx + 1, sy + 6, COL_SKY)
