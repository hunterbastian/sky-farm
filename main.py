# main.py — Soratchi (Sky Farm) entry point
# A cozy pixel farming idle game built with Pyxel (Python fantasy console).
#
# Python crash course for TypeScript devs:
#   - No braces {} — indentation IS the block structure (use 4 spaces)
#   - `import` works like ES modules: `from constants import SCREEN_W`
#   - `self` is like `this` — you pass it explicitly to every method
#   - `__init__` is the constructor (like constructor() in a class)
#   - `def` defines functions/methods (like function/arrow functions)
#   - No semicolons needed
#   - `if __name__ == "__main__":` is like a top-level await guard

import pyxel
from constants import (
    SCREEN_W, SCREEN_H, FPS, PALETTE,
    COL_DARK, COL_SKY, COL_WHITE, COL_GOLD, COL_GREEN,
)
from world import create_tile_grid
from draw_world import draw_sky, draw_clouds, draw_island, draw_crops
from clock import Clock
from crops import CropSystem
from input_handler import InputHandler
from ui import UI


class App:
    """Main game class. Pyxel calls update() and draw() every frame."""

    def __init__(self):
        # Initialize Pyxel window
        pyxel.init(SCREEN_W, SCREEN_H, title="Soratchi", fps=FPS)

        # Show the mouse cursor (Pyxel hides it by default)
        pyxel.mouse(True)

        # Set our custom 16-color palette
        for i, color in enumerate(PALETTE):
            pyxel.colors[i] = color

        # === Game state ===
        self.frame_count = 0
        self.tiles = create_tile_grid()   # 24x24 grid, all grass
        self.clock = Clock()              # Day/night cycle
        self.crop_system = CropSystem()   # Crops, planting, auto-farm
        self.input = InputHandler()       # Mouse/keyboard processing
        self.ui = UI()                    # HUD and floating text

        # Mutable game state dict — passed to input handler for coin/wood updates
        # Python note: Dicts are passed by reference (like objects in JS),
        # so changes inside input_handler are visible here.
        self.game_state = {
            "coins": 0,
            "wood": 0,
        }

        # Start the game loop — this never returns.
        pyxel.run(self.update, self.draw)

    def update(self):
        """Game logic — runs every frame, guaranteed."""
        self.frame_count += 1

        # Delta time: 1/FPS seconds per frame
        # (Pyxel runs at fixed FPS, so dt is constant)
        dt = 1.0 / FPS

        # --- Quit on Q ---
        if pyxel.btnp(pyxel.KEY_Q):
            pyxel.quit()

        # --- Speed control (F key cycles 1x → 2x → 3x) ---
        if pyxel.btnp(pyxel.KEY_F):
            self.clock.cycle_speed()

        # --- Clock ---
        self.clock.update(dt)

        # --- Input (mouse clicks, keyboard) ---
        events = self.input.update(self.tiles, self.crop_system, self.game_state)

        # React to input events — spawn floating text
        for evt in events:
            if evt[0] == "harvest":
                _, tx, ty, sell_price = evt
                self.ui.add_floating_text(tx, ty, f"+{sell_price}", COL_GOLD)
            elif evt[0] == "till":
                _, tx, ty = evt
                self.ui.add_floating_text(tx, ty, "TILL", COL_WHITE)
            elif evt[0] == "plant":
                _, tx, ty = evt
                self.ui.add_floating_text(tx, ty, "PLANT", COL_GREEN)

        # --- Crop growth + auto-farm ---
        auto_coins = self.crop_system.update(dt, self.tiles, self.clock.speed)
        self.game_state["coins"] += auto_coins

        # --- UI (floating text timers) ---
        self.ui.update(dt)

    def draw(self):
        """Rendering — may be skipped if the frame budget is exceeded."""
        # Clear screen
        pyxel.cls(COL_SKY)

        # Layer 1: Sky + clouds
        draw_sky(self.frame_count)
        draw_clouds(self.frame_count)

        # Layer 2: Island terrain
        draw_island(self.tiles, self.frame_count)

        # Layer 3: Crops on top of farmland
        draw_crops(self.crop_system.crops)

        # Layer 4: Tile cursor
        self.ui.draw_tile_cursor(self.input.hovered_tile)

        # Layer 5: Floating text (above everything in world space)
        self.ui.draw_floating_texts()

        # Layer 6: HUD (screen space, always on top)
        self.ui.draw_hud(self.clock, self.game_state["coins"],
                         self.game_state["wood"], self.crop_system)
        self.ui.draw_toolbar(self.crop_system, self.input.hovered_tile, self.tiles)


if __name__ == "__main__":
    App()
