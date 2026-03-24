# draw_world.py — Render the island terrain
#
# Draws grass tiles, farmland, pond water, pen area, cliff edges,
# and wildflowers. All purely procedural for now — will migrate to
# sprite-based rendering once we author soratchi.pyxres sprites.
#
# Python note: `import X` at top of file = ES `import X from "./x"`.
# Circular imports are rare because Python resolves at function-call time.

import pyxel
import math
from constants import (
    TILE_PX, ISLAND_SIZE, ISLAND_X, ISLAND_Y,
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
    """Convert tile coordinates to screen pixel coordinates.
    Returns (screen_x, screen_y) — the top-left corner of the tile.
    """
    return (ISLAND_X + tx * TILE_PX, ISLAND_Y + ty * TILE_PX)


def draw_sky(frame_count):
    """Draw the background sky with simple gradient bands.
    Pyxel has no gradient — we simulate with horizontal rect strips.
    """
    # Top: lighter sky, bottom: slightly deeper
    # 3 bands of color to give depth
    pyxel.rect(0, 0, 256, 80, COL_SKY)
    pyxel.rect(0, 80, 256, 80, COL_SKY)
    pyxel.rect(0, 160, 256, 80, COL_SKY)


def draw_clouds(frame_count):
    """Draw simple drifting clouds above the island.
    Clouds are small white ellipses that scroll horizontally.
    """
    # 5 clouds at different heights and speeds
    cloud_data = [
        (0.3, 20, 7),   # (speed, y, width)
        (0.5, 35, 10),
        (0.2, 15, 6),
        (0.4, 45, 8),
        (0.15, 28, 12),
    ]
    for i, (speed, base_y, w) in enumerate(cloud_data):
        # Horizontal position wraps around screen
        x = (frame_count * speed + i * 67) % (256 + w * 2) - w
        y = base_y
        # Draw cloud as overlapping white rectangles (no circles in Pyxel without sprites)
        h = max(2, w // 3)
        pyxel.rect(int(x), y, w, h, COL_WHITE)
        pyxel.rect(int(x) + 2, y - 1, w - 4, h + 2, COL_WHITE)


def draw_island(tiles, frame_count):
    """Draw all island tiles — grass, farmland, pond, pen, edges."""
    for y in range(ISLAND_SIZE):
        for x in range(ISLAND_SIZE):
            if not is_on_island(x, y):
                continue

            sx, sy = tile_to_screen(x, y)
            tile_type = tiles[y][x]

            # --- Pond ---
            if is_pond_tile(x, y):
                _draw_pond_tile(sx, sy, x, y, frame_count)
                continue

            # --- Chicken pen ---
            if is_pen_tile(x, y):
                _draw_pen_tile(sx, sy, x, y)
                continue

            # --- Farmland ---
            if tile_type == TILE_FARMLAND:
                _draw_farmland_tile(sx, sy, x, y)
                continue

            # --- Grass (default) ---
            _draw_grass_tile(sx, sy, x, y)

    # Draw cliff edges (the drop-off around the island)
    _draw_cliff_edges()

    # Draw wildflowers on top of grass
    _draw_wildflowers(frame_count)


def _draw_grass_tile(sx, sy, tx, ty):
    """Draw a grass tile with variation.
    Different tiles get slightly different greens for texture.
    """
    var = GRASS_VARIATION.get((tx, ty), 0)

    # Base fill — alternate between green shades based on variation
    if var == 0:
        pyxel.rect(sx, sy, TILE_PX, TILE_PX, COL_GREEN)
    elif var == 1:
        pyxel.rect(sx, sy, TILE_PX, TILE_PX, COL_GREEN)
        # Add a highlight pixel
        pyxel.pset(sx + 3, sy + 2, COL_LGREEN)
    elif var == 2:
        pyxel.rect(sx, sy, TILE_PX, TILE_PX, COL_DGREEN)
        # Light center
        pyxel.rect(sx + 2, sy + 2, 4, 4, COL_GREEN)
    else:
        pyxel.rect(sx, sy, TILE_PX, TILE_PX, COL_GREEN)
        # Darker corner accent
        pyxel.pset(sx + 1, sy + 5, COL_DGREEN)
        pyxel.pset(sx + 6, sy + 1, COL_DGREEN)


def _draw_farmland_tile(sx, sy, tx, ty):
    """Draw tilled farmland — brown with furrow lines."""
    pyxel.rect(sx, sy, TILE_PX, TILE_PX, COL_TAN)
    # Furrow lines (horizontal dark stripes)
    for row in range(0, TILE_PX, 2):
        pyxel.pset(sx + 1, sy + row, COL_WOOD)
        pyxel.pset(sx + 3, sy + row, COL_WOOD)
        pyxel.pset(sx + 5, sy + row, COL_WOOD)


def _draw_pond_tile(sx, sy, tx, ty, frame_count):
    """Draw animated pond water.
    Cycles through shades to simulate gentle ripples.
    """
    # Base water
    pyxel.rect(sx, sy, TILE_PX, TILE_PX, COL_DWATER)

    # Animated shimmer — a highlight pixel that moves each frame
    phase = (frame_count // 15 + tx + ty) % 4
    shimmer_x = sx + [1, 4, 6, 3][phase]
    shimmer_y = sy + [2, 5, 1, 6][phase]
    pyxel.pset(shimmer_x, shimmer_y, COL_SKY)

    # Pond edge detection — draw lighter edge where water meets land
    if is_on_island(tx, ty - 1) and not is_pond_tile(tx, ty - 1):
        pyxel.line(sx, sy, sx + TILE_PX - 1, sy, COL_SKY)
    if is_on_island(tx, ty + 1) and not is_pond_tile(tx, ty + 1):
        pyxel.line(sx, sy + TILE_PX - 1, sx + TILE_PX - 1, sy + TILE_PX - 1, COL_SKY)
    if is_on_island(tx - 1, ty) and not is_pond_tile(tx - 1, ty):
        pyxel.line(sx, sy, sx, sy + TILE_PX - 1, COL_SKY)
    if is_on_island(tx + 1, ty) and not is_pond_tile(tx + 1, ty):
        pyxel.line(sx + TILE_PX - 1, sy, sx + TILE_PX - 1, sy + TILE_PX - 1, COL_SKY)


def _draw_pen_tile(sx, sy, tx, ty):
    """Draw chicken pen area — straw-colored ground with fence on edges."""
    # Straw ground
    pyxel.rect(sx, sy, TILE_PX, TILE_PX, COL_CREAM)
    # Straw texture — scattered dark dots
    pyxel.pset(sx + 2, sy + 3, COL_TAN)
    pyxel.pset(sx + 5, sy + 1, COL_TAN)
    pyxel.pset(sx + 1, sy + 6, COL_TAN)

    # Draw fence posts on pen boundary edges
    # Top edge of pen (y == 2)
    if ty == 2:
        pyxel.line(sx, sy, sx + TILE_PX - 1, sy, COL_BARK)
        pyxel.line(sx, sy + 1, sx + TILE_PX - 1, sy + 1, COL_WOOD)
    # Bottom edge (y == 6)
    if ty == 6:
        pyxel.line(sx, sy + TILE_PX - 2, sx + TILE_PX - 1, sy + TILE_PX - 2, COL_WOOD)
        pyxel.line(sx, sy + TILE_PX - 1, sx + TILE_PX - 1, sy + TILE_PX - 1, COL_BARK)
    # Left edge (x == 8)
    if tx == 8:
        pyxel.line(sx, sy, sx, sy + TILE_PX - 1, COL_BARK)
        pyxel.line(sx + 1, sy, sx + 1, sy + TILE_PX - 1, COL_WOOD)
    # Right edge (x == 13)
    if tx == 13:
        pyxel.line(sx + TILE_PX - 2, sy, sx + TILE_PX - 2, sy + TILE_PX - 1, COL_WOOD)
        pyxel.line(sx + TILE_PX - 1, sy, sx + TILE_PX - 1, sy + TILE_PX - 1, COL_BARK)


def _draw_cliff_edges():
    """Draw cliff/drop-off edges around the island perimeter.
    This gives the island a floating appearance.
    """
    for y in range(ISLAND_SIZE):
        for x in range(ISLAND_SIZE):
            if not is_on_island(x, y):
                continue

            sx, sy = tile_to_screen(x, y)
            edges = get_edge_flags(x, y)

            # South edge = visible cliff face (island floats, so you see below)
            if edges["s"]:
                # Draw a 3px tall cliff face below the tile
                pyxel.rect(sx, sy + TILE_PX, TILE_PX, 1, COL_DGREEN)
                pyxel.rect(sx, sy + TILE_PX + 1, TILE_PX, 1, COL_BARK)
                pyxel.rect(sx, sy + TILE_PX + 2, TILE_PX, 1, COL_DARK)

            # East edge = thin shadow
            if edges["e"]:
                pyxel.line(sx + TILE_PX, sy, sx + TILE_PX, sy + TILE_PX - 1, COL_DGREEN)

            # North edge = subtle grass highlight
            if edges["n"]:
                pyxel.line(sx, sy, sx + TILE_PX - 1, sy, COL_LGREEN)


def _draw_wildflowers(frame_count):
    """Draw scattered wildflowers on grass tiles.
    Small 1-2px flowers in various colors.
    """
    flower_colors = [COL_GOLD, COL_PINK, COL_RED, COL_WHITE, COL_CREAM, COL_ORANGE]

    for i, (fx, fy) in enumerate(WILDFLOWER_POSITIONS):
        sx, sy = tile_to_screen(fx, fy)
        color = flower_colors[i % len(flower_colors)]

        # Tiny flower: center dot + optional petal dots
        # Position within tile varies by index for natural look
        ox = (i * 3 + 1) % 6 + 1   # offset x within tile (1-6)
        oy = (i * 5 + 2) % 6 + 1   # offset y within tile (1-6)

        # Gentle sway — flower center shifts by 1px periodically
        sway = 1 if (frame_count // 30 + i) % 4 == 0 else 0

        pyxel.pset(sx + ox + sway, sy + oy, color)
        # Some flowers get a stem pixel below
        if i % 3 == 0:
            pyxel.pset(sx + ox, sy + oy + 1, COL_DGREEN)


def draw_crops(crops):
    """Draw all planted crops on the island.
    Each crop is rendered as procedural pixel art based on growth stage.

    Args:
        crops: List of Crop instances from CropSystem.
    """
    for crop in crops:
        sx, sy = tile_to_screen(crop.x, crop.y)
        color = crop.definition["color"]
        stage = crop.stage

        if stage == 0:
            # Just planted — tiny seed dot
            pyxel.pset(sx + 3, sy + 5, COL_DGREEN)
            pyxel.pset(sx + 4, sy + 5, COL_DGREEN)
        elif stage == 1:
            # Sprout — small green stem
            pyxel.pset(sx + 3, sy + 3, COL_GREEN)
            pyxel.pset(sx + 4, sy + 3, COL_GREEN)
            pyxel.pset(sx + 3, sy + 4, COL_DGREEN)
            pyxel.pset(sx + 4, sy + 4, COL_DGREEN)
            pyxel.pset(sx + 3, sy + 5, COL_DGREEN)
        elif stage == 2:
            # Growing — taller with crop color showing
            pyxel.rect(sx + 3, sy + 2, 2, 4, COL_GREEN)
            pyxel.pset(sx + 2, sy + 2, color)
            pyxel.pset(sx + 5, sy + 2, color)
            pyxel.pset(sx + 3, sy + 6, COL_DGREEN)
        else:
            # Mature — full-size crop with distinct color
            pyxel.rect(sx + 2, sy + 1, 4, 5, COL_GREEN)
            pyxel.rect(sx + 1, sy + 1, 6, 3, color)
            pyxel.pset(sx + 3, sy + 6, COL_DGREEN)
            pyxel.pset(sx + 4, sy + 6, COL_DGREEN)

        # Watered indicator — tiny blue dot at base
        if crop.watered and not crop.is_mature:
            pyxel.pset(sx + 1, sy + 6, COL_SKY)
