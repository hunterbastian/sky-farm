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
        self.inventory_open = False

    def toggle_inventory(self):
        """Toggle the inventory panel."""
        self.inventory_open = not self.inventory_open

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

    def draw_hud(self, clock, coins, wood, crop_system, weather=None):
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

        # Weather indicator
        if weather:
            weather.draw_indicator(bx + 80, ty2)

        # Speed — right side of line 2
        speed_str = f"{clock.speed}X"
        speed_x = bx + bubble_w - BUBBLE_PAD - len(speed_str) * CHAR_W - 1
        speed_col = COL_ORANGE if clock.speed > 1 else COL_DARK
        pyxel.text(speed_x, ty2, speed_str, speed_col)

    def draw_toolbar(self, crop_system, hovered_tile, tiles=None):
        """Draw a clickable toolbar with seed slots, speed, and inventory buttons."""
        # Toolbar layout: 4 seed slots + speed button + inventory button
        slot_size = 14       # each slot is 14x14 px
        slot_gap = 3
        num_slots = 6        # 4 seeds + speed + inv
        total_w = num_slots * slot_size + (num_slots - 1) * slot_gap
        start_x = (SCREEN_W - total_w) // 2
        bar_y = ISLAND_Y + WORLD_PX + 3

        # Clamp to screen
        if bar_y + slot_size + 2 > SCREEN_H:
            bar_y = SCREEN_H - slot_size - 2

        # Store slot positions for click detection
        self._toolbar_slots = []

        short_labels = ["WHT", "BRY", "PMP", "FLR"]

        for i in range(num_slots):
            sx = start_x + i * (slot_size + slot_gap)
            self._toolbar_slots.append((sx, bar_y, slot_size, slot_size))

            if i < 4:
                # --- Seed slot ---
                crop_id = CROP_IDS[i]
                crop_def = CROPS[crop_id]
                is_selected = (i == crop_system.selected_seed)

                # Slot background
                if is_selected:
                    # Selected: bright border + cream fill
                    pyxel.rect(sx, bar_y, slot_size, slot_size, COL_CREAM)
                    pyxel.rectb(sx, bar_y, slot_size, slot_size, COL_GREEN)
                    # Double border for selected
                    pyxel.rectb(sx - 1, bar_y - 1, slot_size + 2, slot_size + 2, COL_LGREEN)
                else:
                    # Unselected: darker
                    pyxel.rect(sx, bar_y, slot_size, slot_size, COL_CREAM)
                    pyxel.rectb(sx, bar_y, slot_size, slot_size, COL_WOOD)

                # Crop color swatch (centered, 6x6)
                swatch_x = sx + (slot_size - 6) // 2
                swatch_y = bar_y + 2
                pyxel.rect(swatch_x, swatch_y, 6, 6, crop_def["color"])
                # Tiny highlight
                pyxel.pset(swatch_x + 1, swatch_y + 1, COL_WHITE)

                # Label below swatch
                label = short_labels[i]
                label_x = sx + (slot_size - len(label) * CHAR_W) // 2
                pyxel.text(label_x, bar_y + 9, label, COL_DARK if is_selected else COL_WOOD)

            elif i == 4:
                # --- Speed button ---
                pyxel.rect(sx, bar_y, slot_size, slot_size, COL_CREAM)
                pyxel.rectb(sx, bar_y, slot_size, slot_size, COL_WOOD)
                # Speed icon (arrow >>)
                pyxel.text(sx + 2, bar_y + 2, ">>", COL_ORANGE)
                pyxel.text(sx + 1, bar_y + 9, "SPD", COL_WOOD)

            elif i == 5:
                # --- Inventory button ---
                pyxel.rect(sx, bar_y, slot_size, slot_size, COL_CREAM)
                pyxel.rectb(sx, bar_y, slot_size, slot_size, COL_WOOD)
                # Bag icon (simple rectangle)
                pyxel.rect(sx + 4, bar_y + 3, 6, 5, COL_TAN)
                pyxel.rect(sx + 5, bar_y + 1, 4, 3, COL_WOOD)
                pyxel.pset(sx + 6, bar_y + 2, COL_CREAM)
                pyxel.text(sx + 1, bar_y + 9, "INV", COL_WOOD)

    def check_toolbar_click(self, crop_system, clock):
        """Check if the mouse clicked a toolbar slot. Returns action string or None.
        Call this from main.py in the update loop.
        """
        if not pyxel.btnp(pyxel.MOUSE_BUTTON_LEFT):
            return None
        if not hasattr(self, '_toolbar_slots'):
            return None

        mx, my = pyxel.mouse_x, pyxel.mouse_y
        for i, (sx, sy, sw, sh) in enumerate(self._toolbar_slots):
            if sx <= mx < sx + sw and sy <= my < sy + sh:
                if i < 4:
                    # Seed slot clicked
                    crop_system.selected_seed = i
                    return "select_seed"
                elif i == 4:
                    clock.cycle_speed()
                    return "speed"
                elif i == 5:
                    self.toggle_inventory()
                    return "inventory"
        return None

    def _get_action_hint(self, hovered_tile, crop_system, tiles):
        """Get contextual hint text for the hovered tile."""
        from world import is_pond_tile, is_pen_tile, TILE_GRASS, TILE_FARMLAND

        tx, ty = hovered_tile
        if is_pond_tile(tx, ty):
            return "~ Pond ~"
        if is_pen_tile(tx, ty):
            return "Chickens"

        tile_type = tiles[ty][tx]

        # Check for trees (import here to avoid circular)
        try:
            from trees import TreeSystem
            # We check tree_system via a stored ref if available
        except ImportError:
            pass

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
        if (pyxel.frame_count // 15) % 2 == 0:
            pyxel.rectb(sx, sy, TILE_PX, TILE_PX, COL_WHITE)
        else:
            pyxel.rectb(sx, sy, TILE_PX, TILE_PX, COL_GOLD)

    def draw_goal(self, goal_system):
        """Draw the current goal as a small bubble on the right side."""
        goal = goal_system.current_goal

        # Show completion celebration
        if goal_system.completion_timer > 0 and goal_system.just_completed:
            cg = goal_system.just_completed
            msg = f"Done! +{cg.reward_coins}c"
            msg_w = len(msg) * CHAR_W + BUBBLE_PAD * 2 + 2
            bx = SCREEN_W - msg_w - 4
            by = ISLAND_Y + 4
            draw_bubble(bx, by, msg_w, 12)
            pyxel.text(bx + BUBBLE_PAD + 1, by + BUBBLE_PAD, msg, COL_GOLD)
            return

        if goal is None:
            return

        # Goal bubble — right side, vertically centered
        desc = goal.description
        prog = goal.progress_text
        line = f"{desc} {prog}"
        bubble_w = len(line) * CHAR_W + BUBBLE_PAD * 2 + 2
        bx = SCREEN_W - bubble_w - 4
        by = ISLAND_Y + 4

        draw_bubble(bx, by, bubble_w, 12)

        # Star icon
        pyxel.pset(bx + BUBBLE_PAD, by + BUBBLE_PAD + 2, COL_GOLD)

        # Text
        pyxel.text(bx + BUBBLE_PAD + 4, by + BUBBLE_PAD, desc, COL_DARK)

        # Progress — right-aligned in the bubble
        prog_x = bx + bubble_w - BUBBLE_PAD - len(prog) * CHAR_W - 1
        pyxel.text(prog_x, by + BUBBLE_PAD, prog, COL_GREEN)

    def draw_inventory(self, game_state, crop_system, animal_system):
        """Draw a retro inventory panel when open.

        Styled like a classic RPG menu — bordered panel with item rows.
        Shows: coins, wood, honey, seed selection, crop counts, eggs.
        """
        if not self.inventory_open:
            return

        # Dim the background
        pyxel.dither(0.4)
        pyxel.rect(0, 0, SCREEN_W, SCREEN_H, COL_DARK)
        pyxel.dither(1.0)

        # Panel dimensions — centered on screen
        pw = 160
        ph = 140
        px = (SCREEN_W - pw) // 2
        py = (SCREEN_H - ph) // 2

        # Draw panel with double border (retro RPG style)
        draw_bubble(px, py, pw, ph)

        # Inner border for extra retro feel
        pyxel.rectb(px + 3, py + 3, pw - 6, ph - 6, COL_WOOD)

        # Title
        title = "INVENTORY"
        title_x = px + (pw - len(title) * CHAR_W) // 2
        text_with_shadow(title_x, py + 6, title, COL_DARK, COL_CREAM)

        # Divider line under title
        pyxel.line(px + 8, py + 14, px + pw - 9, py + 14, COL_WOOD)

        # === Item rows ===
        row_x = px + 10
        row_y = py + 20
        row_h = 12  # height per row

        # --- Coins ---
        pyxel.rect(row_x, row_y + 2, 3, 3, COL_GOLD)
        pyxel.pset(row_x + 1, row_y + 3, COL_ORANGE)
        pyxel.text(row_x + 6, row_y + 1, "Coins", COL_DARK)
        val = str(game_state["coins"])
        pyxel.text(px + pw - 12 - len(val) * CHAR_W, row_y + 1, val, COL_GOLD)

        row_y += row_h

        # --- Wood ---
        pyxel.rect(row_x, row_y + 2, 3, 3, COL_WOOD)
        pyxel.pset(row_x + 1, row_y + 3, COL_TAN)
        pyxel.text(row_x + 6, row_y + 1, "Wood", COL_DARK)
        val = str(game_state["wood"])
        pyxel.text(px + pw - 12 - len(val) * CHAR_W, row_y + 1, val, COL_TAN)

        row_y += row_h

        # --- Honey ---
        from constants import COL_GOLD as _
        pyxel.rect(row_x, row_y + 2, 3, 3, COL_ORANGE)
        pyxel.pset(row_x + 1, row_y + 3, COL_GOLD)
        pyxel.text(row_x + 6, row_y + 1, "Honey", COL_DARK)
        honey_val = f"{animal_system.honey:.0f}"
        pyxel.text(px + pw - 12 - len(honey_val) * CHAR_W, row_y + 1, honey_val, COL_ORANGE)

        row_y += row_h

        # --- Eggs ---
        pyxel.rect(row_x, row_y + 2, 3, 3, COL_CREAM)
        pyxel.pset(row_x + 1, row_y + 3, COL_WHITE)
        pyxel.text(row_x + 6, row_y + 1, "Eggs", COL_DARK)
        egg_val = str(len(animal_system.eggs))
        pyxel.text(px + pw - 12 - len(egg_val) * CHAR_W, row_y + 1, egg_val, COL_CREAM)

        row_y += row_h

        # Divider
        pyxel.line(px + 8, row_y - 2, px + pw - 9, row_y - 2, COL_WOOD)

        # --- Seeds section ---
        pyxel.text(row_x, row_y + 1, "SEEDS", COL_DARK)
        row_y += row_h

        seed_names = {
            "sky_wheat": "Sky Wheat",
            "star_berry": "Star Berry",
            "cloud_pumpkin": "Cloud Pumpkin",
            "moon_flower": "Moon Flower",
        }

        for i, crop_id in enumerate(CROP_IDS):
            crop_def = CROPS[crop_id]
            is_selected = (i == crop_system.selected_seed)

            # Selection arrow
            if is_selected:
                pyxel.text(row_x, row_y + 1, ">", COL_GREEN)

            # Crop color dot
            pyxel.rect(row_x + 8, row_y + 2, 3, 3, crop_def["color"])

            # Name
            name = seed_names.get(crop_id, crop_id)
            name_col = COL_GREEN if is_selected else COL_DARK
            pyxel.text(row_x + 14, row_y + 1, name, name_col)

            # Price/value
            val_text = f"{crop_def['sell']}c"
            pyxel.text(px + pw - 12 - len(val_text) * CHAR_W, row_y + 1, val_text, COL_GOLD)

            row_y += 8

        # Footer
        footer = "[E] Close  [TAB] Seed"
        footer_x = px + (pw - len(footer) * CHAR_W) // 2
        pyxel.text(footer_x, py + ph - 10, footer, COL_WOOD)
