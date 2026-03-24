# input_handler.py — Mouse/keyboard input → game actions
#
# Implements the "smart tap" system from the original:
# clicking a tile does the contextually appropriate action.
#   - Grass → till it
#   - Farmland (empty) → plant a seed
#   - Mature crop → harvest
#   - Tree → chop
#
# Python note: Functions are first-class (like JS arrow functions).
# We pass callback functions to decouple input from game logic.

import pyxel
from constants import TILE_PX, ISLAND_X, ISLAND_Y, ISLAND_SIZE
from world import (
    is_on_island, is_pond_tile, is_pen_tile, is_farmable,
    TILE_GRASS, TILE_FARMLAND,
)


def screen_to_tile(screen_x, screen_y):
    """Convert screen pixel coordinates to tile grid coordinates.
    Returns (tile_x, tile_y) or None if outside the island.

    This is the inverse of draw_world.tile_to_screen().
    """
    # Subtract island offset to get position relative to island
    local_x = screen_x - ISLAND_X
    local_y = screen_y - ISLAND_Y

    # Convert pixels to tile coordinates (integer division)
    # Python's // is integer division — like Math.floor(a/b) in JS
    tx = local_x // TILE_PX
    ty = local_y // TILE_PX

    # Bounds check
    if tx < 0 or tx >= ISLAND_SIZE or ty < 0 or ty >= ISLAND_SIZE:
        return None
    if not is_on_island(tx, ty):
        return None

    return (tx, ty)


def get_hovered_tile():
    """Get the tile under the mouse cursor, or None."""
    return screen_to_tile(pyxel.mouse_x, pyxel.mouse_y)


class InputHandler:
    """Processes mouse clicks and keyboard input each frame."""

    def __init__(self):
        self.hovered_tile = None  # (x, y) or None — tile under cursor

    def update(self, tiles, crop_system, game_state):
        """Process input for this frame.

        Args:
            tiles: The tile grid (2D list).
            crop_system: CropSystem instance.
            game_state: Dict with mutable game state (coins, wood, etc.).

        Returns:
            List of events that happened: [("till", x, y), ("plant", x, y), ...]
            Used by other systems (particles, sound) to react.
        """
        events = []
        self.hovered_tile = get_hovered_tile()

        # --- Mouse click (left button) ---
        # pyxel.btnp = "button pressed this frame" (like a mousedown event)
        if pyxel.btnp(pyxel.MOUSE_BUTTON_LEFT):
            tile = self.hovered_tile
            if tile is not None:
                tx, ty = tile
                evt = self._smart_tap(tx, ty, tiles, crop_system, game_state)
                if evt:
                    events.append(evt)

        # --- Keyboard: cycle seed type ---
        if pyxel.btnp(pyxel.KEY_S):
            crop_system.cycle_seed()
            events.append(("cycle_seed",))

        # --- Keyboard: speed control ---
        # (handled in main.py directly since it modifies the clock)

        return events

    def _smart_tap(self, tx, ty, tiles, crop_system, game_state):
        """Determine what action to take when tapping a tile.

        Smart tap priority:
        1. Mature crop → harvest
        2. Farmland (empty) → plant
        3. Grass → till
        4. Pond/pen → nothing
        """
        # Skip non-interactable zones
        if is_pond_tile(tx, ty) or is_pen_tile(tx, ty):
            return None

        tile_type = tiles[ty][tx]

        # Check for mature crop first
        crop = crop_system.get_crop_at(tx, ty)
        if crop is not None and crop.is_mature:
            sell_price = crop_system.harvest(tx, ty)
            if sell_price > 0:
                game_state["coins"] += sell_price
                return ("harvest", tx, ty, sell_price)

        # Plant on empty farmland
        if tile_type == TILE_FARMLAND and crop is None:
            if crop_system.plant(tx, ty, tiles):
                return ("plant", tx, ty)

        # Till grass into farmland
        if tile_type == TILE_GRASS and is_farmable(tx, ty):
            if crop_system.till(tx, ty, tiles):
                return ("till", tx, ty)

        return None
