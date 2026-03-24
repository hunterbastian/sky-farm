# draw_entities.py — Draw trees, chickens, eggs, bees
#
# All entities are drawn as procedural pixel art composites.
# Trees are multi-tile (3x5 tile footprint), chickens are ~5x5px,
# eggs are 3x3px, bees are 2x2px.
#
# Draw order matters: stumps → crops → trees → chickens → eggs → bees
# (caller handles this in main.py)

import math
import pyxel
from constants import (
    TILE_PX, ISLAND_X, ISLAND_Y,
    COL_DARK, COL_BARK, COL_WOOD, COL_TAN,
    COL_DGREEN, COL_GREEN, COL_LGREEN,
    COL_GOLD, COL_ORANGE, COL_RED,
    COL_PINK, COL_CREAM, COL_WHITE, COL_SKY,
)
from draw_world import tile_to_screen


# ============================================================
# TREES
# ============================================================

def draw_oak_tree(oak):
    """Draw an oak tree — trunk + leafy canopy, or stump if chopped."""
    sx, sy = tile_to_screen(oak.tx, oak.ty)

    if not oak.alive and not oak.falling:
        # --- Stump with sad face ---
        pyxel.rect(sx - 1, sy + 4, TILE_PX + 2, 4, COL_BARK)
        pyxel.rect(sx, sy + 3, TILE_PX, 2, COL_WOOD)
        # Sad face on stump
        pyxel.pset(sx + 2, sy + 4, COL_DARK)  # left eye
        pyxel.pset(sx + 5, sy + 4, COL_DARK)  # right eye
        pyxel.pset(sx + 3, sy + 6, COL_DARK)  # frown
        pyxel.pset(sx + 4, sy + 6, COL_DARK)
        # Regrow indicator
        progress = oak.regrow_timer / 60.0
        if progress > 0.3:
            pyxel.pset(sx + 2, sy + 3, COL_GREEN)
        if progress > 0.6:
            pyxel.pset(sx + 5, sy + 3, COL_GREEN)
        if progress > 0.9:
            pyxel.pset(sx + 3, sy + 2, COL_LGREEN)
        return

    # --- Fall animation ---
    fall_offset_x = 0
    fall_rotation = 0  # simulated as horizontal shear
    if oak.falling:
        # Tree tilts to the right and drops
        progress = min(oak.fall_timer / 0.5, 1.0)
        fall_offset_x = int(progress * 12)
        fall_rotation = progress

    # --- Trunk ---
    trunk_x = sx + 2 + fall_offset_x
    trunk_y = sy - 4
    if not oak.falling:
        # Normal standing trunk
        pyxel.rect(trunk_x, trunk_y, 4, 12, COL_BARK)
        pyxel.line(trunk_x + 1, trunk_y + 2, trunk_x + 1, trunk_y + 8, COL_WOOD)
    else:
        # Falling trunk (tilted)
        for i in range(12):
            px = trunk_x + int(i * fall_rotation * 0.8)
            py = trunk_y + i
            pyxel.rect(px, py, 4, 1, COL_BARK)

    # --- Canopy ---
    # Sway offset — subtle sine wave
    sway = int(math.sin(oak.sway_phase) * 1.5) if not oak.falling else fall_offset_x

    canopy_cx = sx + 3 + sway
    canopy_cy = sy - 16

    if oak.falling:
        canopy_cx += fall_offset_x
        canopy_cy += int(oak.fall_timer * 8)

    # Rounder canopy shape — bigger, softer, cuter
    # Outer
    pyxel.rect(canopy_cx - 6, canopy_cy + 2, 14, 8, COL_DGREEN)
    pyxel.rect(canopy_cx - 7, canopy_cy + 3, 16, 5, COL_DGREEN)
    # Middle
    pyxel.rect(canopy_cx - 5, canopy_cy, 12, 8, COL_GREEN)
    pyxel.rect(canopy_cx - 6, canopy_cy + 1, 14, 6, COL_GREEN)
    # Highlight
    pyxel.rect(canopy_cx - 3, canopy_cy + 1, 8, 4, COL_LGREEN)
    # Top tuft (rounder)
    pyxel.rect(canopy_cx - 3, canopy_cy - 2, 8, 3, COL_GREEN)
    pyxel.rect(canopy_cx - 1, canopy_cy - 3, 4, 2, COL_GREEN)

    # Kawaii face on the canopy!
    face_y = canopy_cy + 4
    face_x = canopy_cx
    # Eyes — two dots
    pyxel.pset(face_x - 2, face_y, COL_DARK)
    pyxel.pset(face_x + 2, face_y, COL_DARK)
    # Smile — gentle curve (3 pixels)
    pyxel.pset(face_x - 1, face_y + 2, COL_DARK)
    pyxel.pset(face_x,     face_y + 2, COL_DARK)
    pyxel.pset(face_x + 1, face_y + 2, COL_DARK)
    # Rosy cheeks
    pyxel.pset(face_x - 3, face_y + 1, COL_PINK)
    pyxel.pset(face_x + 3, face_y + 1, COL_PINK)


def draw_maple_tree(maple):
    """Draw a decorative cherry blossom / maple tree."""
    sx, sy = tile_to_screen(maple.tx, maple.ty)

    sway = int(math.sin(maple.sway_phase) * 1.0)

    # Trunk (thinner than oak)
    pyxel.rect(sx + 3, sy - 2, 3, 10, COL_BARK)
    pyxel.line(sx + 4, sy, sx + 4, sy + 6, COL_WOOD)

    # Canopy — pink/red cherry blossom
    cx = sx + 3 + sway
    cy = sy - 14

    # Rounder canopy
    pyxel.rect(cx - 5, cy + 2, 12, 7, COL_RED)
    pyxel.rect(cx - 6, cy + 3, 14, 5, COL_RED)
    pyxel.rect(cx - 4, cy, 10, 7, COL_PINK)
    pyxel.rect(cx - 5, cy + 1, 12, 5, COL_PINK)
    pyxel.rect(cx - 2, cy + 1, 6, 3, COL_CREAM)
    pyxel.rect(cx - 2, cy - 2, 6, 3, COL_PINK)
    pyxel.rect(cx - 1, cy - 3, 4, 2, COL_PINK)

    # Bloom dots
    pyxel.pset(cx - 4, cy + 1, COL_WHITE)
    pyxel.pset(cx + 5, cy + 3, COL_WHITE)

    # Kawaii face!
    face_y = cy + 4
    pyxel.pset(cx - 2, face_y, COL_DARK)
    pyxel.pset(cx + 2, face_y, COL_DARK)
    # Happy closed-eye smile (^ ^)
    pyxel.pset(cx - 2, face_y - 1, COL_DARK)
    pyxel.pset(cx + 2, face_y - 1, COL_DARK)
    # Smile
    pyxel.pset(cx - 1, face_y + 2, COL_DARK)
    pyxel.pset(cx,     face_y + 2, COL_DARK)
    pyxel.pset(cx + 1, face_y + 2, COL_DARK)
    # Rosy cheeks
    pyxel.pset(cx - 3, face_y + 1, COL_RED)
    pyxel.pset(cx + 3, face_y + 1, COL_RED)


def draw_all_trees(tree_system):
    """Draw all trees in the correct order."""
    # Stumps first (behind everything)
    for oak in tree_system.oaks:
        if not oak.alive and not oak.falling:
            draw_oak_tree(oak)

    # Standing/falling trees
    for oak in tree_system.oaks:
        if oak.alive or oak.falling:
            draw_oak_tree(oak)

    # Maples
    for maple in tree_system.maples:
        draw_maple_tree(maple)


# ============================================================
# CHICKENS
# ============================================================

def draw_chicken(chicken):
    """Draw a chicken as a tiny pixel sprite (about 5x5px)."""
    # Convert sub-tile coords to screen pixels
    sx = ISLAND_X + int(chicken.x * TILE_PX)
    sy = ISLAND_Y + int(chicken.y * TILE_PX)

    if chicken.state == "sit":
        # Sitting: rounder, lower to ground
        pyxel.rect(sx, sy + 2, 5, 3, COL_GOLD)        # body
        pyxel.pset(sx + 4, sy + 2, COL_ORANGE)          # beak
        pyxel.pset(sx + 3, sy + 1, COL_RED)             # comb
        pyxel.pset(sx + 2, sy + 2, COL_DARK)            # eye
    elif chicken.state == "peck":
        # Pecking: head down
        pyxel.rect(sx, sy + 1, 4, 3, COL_GOLD)         # body
        pyxel.pset(sx + 2, sy + 4, COL_ORANGE)          # beak (down)
        pyxel.pset(sx + 2, sy + 3, COL_GOLD)            # head
        pyxel.pset(sx + 1, sy + 1, COL_RED)             # comb
        pyxel.pset(sx + 1, sy + 2, COL_DARK)            # eye
    else:
        # Idle or walking
        facing_right = chicken.direction > 0

        # Body
        pyxel.rect(sx, sy + 1, 5, 3, COL_GOLD)
        # Head
        if facing_right:
            pyxel.pset(sx + 5, sy + 1, COL_ORANGE)      # beak
            pyxel.pset(sx + 4, sy, COL_RED)              # comb
            pyxel.pset(sx + 4, sy + 1, COL_DARK)         # eye
        else:
            pyxel.pset(sx - 1, sy + 1, COL_ORANGE)      # beak
            pyxel.pset(sx, sy, COL_RED)                  # comb
            pyxel.pset(sx, sy + 1, COL_DARK)             # eye

        # Legs (walking animation)
        if chicken.state == "walk":
            leg_frame = chicken.anim_frame % 4
            if leg_frame < 2:
                pyxel.pset(sx + 1, sy + 4, COL_ORANGE)
                pyxel.pset(sx + 3, sy + 4, COL_ORANGE)
            else:
                pyxel.pset(sx + 2, sy + 4, COL_ORANGE)
        else:
            pyxel.pset(sx + 1, sy + 4, COL_ORANGE)
            pyxel.pset(sx + 3, sy + 4, COL_ORANGE)


def draw_all_chickens(animal_system):
    """Draw all chickens."""
    for chicken in animal_system.chickens:
        draw_chicken(chicken)


# ============================================================
# EGGS
# ============================================================

def draw_all_eggs(animal_system):
    """Draw all eggs on the ground."""
    for egg in animal_system.eggs:
        sx = ISLAND_X + int(egg.x * TILE_PX)
        sy = ISLAND_Y + int(egg.y * TILE_PX)

        # Subtle bob animation
        bob = int(math.sin(egg.age * 3) * 0.5)

        # Egg with tiny face
        ey = sy + bob + 1
        pyxel.rect(sx, ey + 1, 3, 3, COL_CREAM)
        pyxel.pset(sx + 1, ey, COL_CREAM)   # rounded top
        pyxel.pset(sx + 1, ey + 1, COL_WHITE)  # highlight
        # Tiny dot eyes
        pyxel.pset(sx, ey + 2, COL_DARK)
        pyxel.pset(sx + 2, ey + 2, COL_DARK)


# ============================================================
# BEES
# ============================================================

def draw_beehive(tree_system):
    """Draw the beehive on the middle oak tree."""
    oak = tree_system.oaks[1]  # HIVE_TREE = 1 (middle oak)
    if not oak.alive:
        return

    sx, sy = tile_to_screen(oak.tx, oak.ty)
    sway = int(math.sin(oak.sway_phase) * 1.5)

    # Hive hangs from a branch on the right side of the canopy
    hx = sx + 8 + sway
    hy = sy - 8

    # Hive body (golden-brown, rounder)
    pyxel.rect(hx, hy, 5, 6, COL_GOLD)
    pyxel.rect(hx - 1, hy + 1, 7, 4, COL_ORANGE)
    pyxel.pset(hx + 1, hy + 1, COL_CREAM)  # highlight
    # Kawaii face on hive
    pyxel.pset(hx + 1, hy + 2, COL_DARK)  # left eye
    pyxel.pset(hx + 3, hy + 2, COL_DARK)  # right eye
    pyxel.pset(hx + 2, hy + 4, COL_DARK)  # smile
    # Pink cheeks
    pyxel.pset(hx, hy + 3, COL_PINK)
    pyxel.pset(hx + 4, hy + 3, COL_PINK)


def draw_all_bees(animal_system, tree_system):
    """Draw bees orbiting the beehive."""
    oak = tree_system.oaks[1]
    if not oak.alive:
        return

    sx, sy = tile_to_screen(oak.tx, oak.ty)
    sway = int(math.sin(oak.sway_phase) * 1.5)

    # Hive center
    hx = sx + 10 + sway
    hy = sy - 5

    for bee in animal_system.bees:
        bx = hx + int(math.cos(bee.angle) * bee.orbit_radius)
        by = hy + int(math.sin(bee.angle) * bee.orbit_radius * 0.6)

        # Bee body: 2x2 with alternating stripes
        pyxel.pset(bx, by, COL_GOLD)
        pyxel.pset(bx + 1, by, COL_DARK)
        # Wings (flicker)
        if pyxel.frame_count % 4 < 2:
            pyxel.pset(bx, by - 1, COL_WHITE)
        else:
            pyxel.pset(bx + 1, by - 1, COL_WHITE)
