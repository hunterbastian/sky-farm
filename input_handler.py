# input_handler.py — Mouse/keyboard input → game actions
#
# Implements the "smart tap" system:
#   - Tree → chop
#   - Egg nearby → collect
#   - Mature crop → harvest
#   - Farmland (empty) → plant a seed
#   - Grass → till
#   - Pond/pen → nothing

import pyxel
from constants import TILE_PX, ISLAND_X, ISLAND_Y, ISLAND_SIZE
from world import (
    is_on_island, is_pond_tile, is_pen_tile, is_farmable,
    TILE_GRASS, TILE_FARMLAND,
)


def screen_to_tile(screen_x, screen_y):
    """Convert screen pixel coordinates to tile grid coordinates.
    Returns (tile_x, tile_y) or None if outside the island.
    """
    local_x = screen_x - ISLAND_X
    local_y = screen_y - ISLAND_Y
    tx = local_x // TILE_PX
    ty = local_y // TILE_PX

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
        self.hovered_tile = None

    def update(self, tiles, crop_system, game_state,
               tree_system=None, animal_system=None):
        """Process input for this frame.

        Returns:
            List of events: [("till", x, y), ("chop", x, y, hits_left), ...]
        """
        events = []
        self.hovered_tile = get_hovered_tile()

        # --- Mouse click ---
        if pyxel.btnp(pyxel.MOUSE_BUTTON_LEFT):
            tile = self.hovered_tile
            if tile is not None:
                tx, ty = tile
                evt = self._smart_tap(
                    tx, ty, tiles, crop_system, game_state,
                    tree_system, animal_system,
                )
                if evt:
                    events.append(evt)

        # --- Keyboard: cycle seed type ---
        if pyxel.btnp(pyxel.KEY_S):
            crop_system.cycle_seed()
            events.append(("cycle_seed",))

        return events

    def _smart_tap(self, tx, ty, tiles, crop_system, game_state,
                   tree_system=None, animal_system=None):
        """Determine what action to take when tapping a tile.

        Smart tap priority:
        1. Tree → chop
        2. Egg nearby → collect
        3. Mature crop → harvest
        4. Farmland (empty) → plant
        5. Grass → till
        6. Pond/pen → nothing
        """
        # --- Chop tree ---
        if tree_system:
            oak = tree_system.chop_at(tx, ty)
            if oak:
                return ("chop", tx, ty, oak.health)

        # --- Collect egg (in pen area) ---
        if animal_system and is_pen_tile(tx, ty):
            egg_coins = animal_system.collect_egg_at(tx, ty)
            if egg_coins > 0:
                game_state["coins"] += egg_coins
                return ("collect_egg", tx, ty)

        # Skip pond (but pen can have eggs above)
        if is_pond_tile(tx, ty):
            return None

        # Skip pen tiles for farming (but not for egg collecting above)
        if is_pen_tile(tx, ty):
            return None

        tile_type = tiles[ty][tx]

        # --- Harvest mature crop ---
        crop = crop_system.get_crop_at(tx, ty)
        if crop is not None and crop.is_mature:
            sell_price = crop_system.harvest(tx, ty)
            if sell_price > 0:
                game_state["coins"] += sell_price
                return ("harvest", tx, ty, sell_price)

        # --- Plant on empty farmland ---
        if tile_type == TILE_FARMLAND and crop is None:
            if crop_system.plant(tx, ty, tiles):
                return ("plant", tx, ty)

        # --- Till grass ---
        if tile_type == TILE_GRASS and is_farmable(tx, ty):
            # Don't till under trees
            if tree_system and tree_system.is_tree_tile(tx, ty):
                return None
            if crop_system.till(tx, ty, tiles):
                return ("till", tx, ty)

        return None
