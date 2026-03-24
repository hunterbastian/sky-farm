# ui.py — HUD, toolbar, and floating text
#
# Animal Crossing-style bubble panels floating above and below the island.
# All UI is pixel-rendered with Pyxel primitives (no HTML overlay).
# The built-in font is 4x6 pixels per character.
#
# Rounded corners: we draw a filled rect, then erase the 4 corner pixels
# to sky color. At this pixel scale, that's enough to look rounded.

import pyxel
from constants import (
    SCREEN_W, SCREEN_H, TILE_PX, ISLAND_X, ISLAND_Y,
    WORLD_PX,
    COL_DARK, COL_SKY, COL_GREEN, COL_DGREEN,
    COL_GOLD, COL_WHITE, COL_CREAM, COL_RED,
    COL_TAN, COL_WOOD, COL_ORANGE, COL_LGREEN,
)
from crops import CROP_IDS, CROPS

# Font metrics
CHAR_W = 4   # Pyxel's built-in font: 4px wide
CHAR_H = 6   # 6px tall

# Bubble panel styling
BUBBLE_PAD = 3          # padding inside bubble
BUBBLE_BORDER = COL_DARK
BUBBLE_FILL = COL_CREAM
BUBBLE_HIGHLIGHT = COL_WHITE  # 1px highlight on top edge for depth


def draw_bubble(x, y, w, h, fill=BUBBLE_FILL, border=BUBBLE_BORDER):
    """Draw a rounded bubble panel (Animal Crossing style).

    Draws a filled rectangle with 1px border, then clips the 4 corners
    to make it look rounded. Adds a 1px white highlight on the top interior
    edge for a subtle 3D / puffy effect.
    """
    # Fill
    pyxel.rect(x, y, w, h, fill)
    # Border
    pyxel.rectb(x, y, w, h, border)

    # Round the corners — erase the 4 corner pixels to sky
    # This is the fantasy console trick for "rounded rectangles"
    pyxel.pset(x, y, COL_SKY)                     # top-left
    pyxel.pset(x + w - 1, y, COL_SKY)             # top-right
    pyxel.pset(x, y + h - 1, COL_SKY)             # bottom-left
    pyxel.pset(x + w - 1, y + h - 1, COL_SKY)     # bottom-right

    # Also round the border corners (the pixel diagonal to each corner)
    pyxel.pset(x + 1, y, border)       # seal top-left
    pyxel.pset(x, y + 1, border)
    pyxel.pset(x + w - 2, y, border)   # seal top-right
    pyxel.pset(x + w - 1, y + 1, border)
    pyxel.pset(x + 1, y + h - 1, border)   # seal bottom-left
    pyxel.pset(x, y + h - 2, border)
    pyxel.pset(x + w - 2, y + h - 1, border)  # seal bottom-right
    pyxel.pset(x + w - 1, y + h - 2, border)

    # Top highlight — 1px white line inside the top border for puffiness
    pyxel.line(x + 2, y + 1, x + w - 3, y + 1, BUBBLE_HIGHLIGHT)


def text_with_shadow(x, y, text, color, shadow=COL_DARK):
    """Draw text with a 1px drop shadow for readability."""
    pyxel.text(x + 1, y + 1, text, shadow)
    pyxel.text(x, y, text, color)


class FloatingText:
    """A text that floats upward and fades out (like +8 coins)."""
    __slots__ = ("x", "y", "text", "color", "timer", "max_time")

    def __init__(self, x, y, text, color=COL_GOLD, duration=1.5):
        self.x = x
        self.y = y
        self.text = text
        self.color = color
        self.timer = 0.0
        self.max_time = duration


class UI:
    """Manages all HUD elements and floating text."""

    def __init__(self):
        self.floating_texts = []

    def add_floating_text(self, tile_x, tile_y, text, color=COL_GOLD):
        """Spawn floating text above a tile."""
        sx = ISLAND_X + tile_x * TILE_PX
        sy = ISLAND_Y + tile_y * TILE_PX - 4
        self.floating_texts.append(FloatingText(sx, sy, text, color))

    def update(self, dt):
        """Update floating text timers and remove expired ones."""
        for ft in self.floating_texts:
            ft.timer += dt
            ft.y -= dt * 20  # float upward

        self.floating_texts = [
            ft for ft in self.floating_texts
            if ft.timer < ft.max_time
        ]

    def draw_hud(self, clock, coins, wood, crop_system):
        """Draw the top info bubble centered above the island."""
        # === Top bubble: day, time, coins, wood ===
        bubble_w = 140
        bubble_h = 18
        bx = (SCREEN_W - bubble_w) // 2   # centered
        by = ISLAND_Y - bubble_h - 2       # just above island, 2px gap

        # Clamp so bubble doesn't go off-screen
        if by < 0:
            by = 0

        draw_bubble(bx, by, bubble_w, bubble_h)

        # Line 1: Day + time + phase (top row inside bubble)
        tx = bx + BUBBLE_PAD + 1
        ty = by + BUBBLE_PAD

        text_with_shadow(tx, ty, f"DAY {clock.day}", COL_DARK, COL_CREAM)

        # Time — centered in bubble
        time_str = clock.time_label
        time_x = bx + (bubble_w - len(time_str) * CHAR_W) // 2
        text_with_shadow(time_x, ty, time_str, COL_DARK, COL_CREAM)

        # Phase label — right side
        phase = clock.phase_emoji
        phase_x = bx + bubble_w - BUBBLE_PAD - len(phase) * CHAR_W - 1
        pyxel.text(phase_x, ty, phase, COL_GOLD)

        # Line 2: Coins + wood + speed
        ty2 = ty + CHAR_H + 1

        # Coin icon (tiny 3x3 yellow square) + amount
        pyxel.rect(tx, ty2 + 1, 3, 3, COL_GOLD)
        pyxel.pset(tx + 1, ty2 + 2, COL_ORANGE)  # shine dot
        pyxel.text(tx + 5, ty2, f"{coins}", COL_DARK)

        # Wood icon (tiny brown square) + amount
        wood_x = bx + 50
        pyxel.rect(wood_x, ty2 + 1, 3, 3, COL_WOOD)
        pyxel.pset(wood_x + 1, ty2 + 2, COL_TAN)
        pyxel.text(wood_x + 5, ty2, f"{wood}", COL_DARK)

        # Speed — right side of line 2
        speed_str = f"{clock.speed}X"
        speed_x = bx + bubble_w - BUBBLE_PAD - len(speed_str) * CHAR_W - 1
        speed_col = COL_ORANGE if clock.speed > 1 else COL_DARK
        pyxel.text(speed_x, ty2, speed_str, speed_col)

    def draw_toolbar(self, crop_system, hovered_tile, tiles=None):
        """Draw the bottom toolbar bubble below the island."""
        # === Bottom bubble: seed type, action hint, controls ===
        bubble_w = 160
        bubble_h = 18
        bx = (SCREEN_W - bubble_w) // 2
        by = ISLAND_Y + WORLD_PX + 2  # just below island, 2px gap

        # Clamp so bubble doesn't go off-screen
        if by + bubble_h > SCREEN_H:
            by = SCREEN_H - bubble_h

        draw_bubble(bx, by, bubble_w, bubble_h)

        # Line 1: Seed type indicator + action hint
        tx = bx + BUBBLE_PAD + 1
        ty = by + BUBBLE_PAD

        # Seed color dot + name
        seed_name = CROP_IDS[crop_system.selected_seed]
        seed_color = CROPS[seed_name]["color"]
        short_names = {
            "sky_wheat": "Wheat",
            "star_berry": "Berry",
            "cloud_pumpkin": "Pumpkin",
            "moon_flower": "Flower",
        }
        # Colored dot
        pyxel.rect(tx, ty + 1, 3, 3, seed_color)
        pyxel.text(tx + 5, ty, short_names.get(seed_name, "???"), COL_DARK)

        # Action hint — right side
        hint = "Tap to interact"
        if hovered_tile and tiles:
            hint = self._get_action_hint(hovered_tile, crop_system, tiles)
        elif hovered_tile:
            hint = "Tap"

        hint_x = bx + bubble_w - BUBBLE_PAD - len(hint) * CHAR_W - 1
        pyxel.text(hint_x, ty, hint, COL_DGREEN)

        # Line 2: Controls
        ty2 = ty + CHAR_H + 1
        controls = "[S]eed  [F]ast  [Q]uit"
        controls_x = bx + (bubble_w - len(controls) * CHAR_W) // 2
        pyxel.text(controls_x, ty2, controls, COL_WOOD)

    def _get_action_hint(self, hovered_tile, crop_system, tiles):
        """Get contextual hint text for the hovered tile."""
        from world import is_pond_tile, is_pen_tile, TILE_GRASS, TILE_FARMLAND

        tx, ty = hovered_tile
        if is_pond_tile(tx, ty):
            return "~ Pond ~"
        if is_pen_tile(tx, ty):
            return "Chicken Pen"

        tile_type = tiles[ty][tx]
        crop = crop_system.get_crop_at(tx, ty)

        if crop and crop.is_mature:
            return "Harvest!"
        if crop:
            return "Growing..."
        if tile_type == TILE_FARMLAND:
            return "Plant"
        if tile_type == TILE_GRASS:
            return "Till"
        return "Tap"

    def draw_floating_texts(self):
        """Draw all active floating text labels."""
        for ft in self.floating_texts:
            remaining = 1.0 - (ft.timer / ft.max_time)
            if remaining < 0.3:
                pyxel.dither(remaining / 0.3)

            # Shadow + main text
            pyxel.text(int(ft.x) + 1, int(ft.y) + 1, ft.text, COL_DARK)
            pyxel.text(int(ft.x), int(ft.y), ft.text, ft.color)

            pyxel.dither(1.0)

    def draw_tile_cursor(self, hovered_tile):
        """Draw a highlight rectangle around the hovered tile."""
        if hovered_tile is None:
            return
        tx, ty = hovered_tile
        sx = ISLAND_X + tx * TILE_PX
        sy = ISLAND_Y + ty * TILE_PX
        # Blinking cursor
        if (pyxel.frame_count // 15) % 2 == 0:
            pyxel.rectb(sx, sy, TILE_PX, TILE_PX, COL_WHITE)
        else:
            pyxel.rectb(sx, sy, TILE_PX, TILE_PX, COL_GOLD)
