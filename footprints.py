# footprints.py — Temporary footprints left by entities
#
# Tiny dark-green marks on grass tiles that fade after a few seconds.
# Slime leaves round marks, cat leaves paw prints, chickens leave scratch marks.

import pyxel
from constants import TILE_PX, ISLAND_X, ISLAND_Y, COL_DGREEN
from world import is_on_island, is_pond_tile, is_pen_tile


class Footprint:
    """A single fading footprint."""
    __slots__ = ("x", "y", "kind", "timer", "max_time")

    def __init__(self, x, y, kind="round", duration=4.0):
        self.x = x    # screen pixel x
        self.y = y    # screen pixel y
        self.kind = kind  # "round" (slime), "paw" (cat), "scratch" (chicken)
        self.timer = 0.0
        self.max_time = duration


class FootprintSystem:
    """Manages all footprints."""

    def __init__(self):
        self.prints = []
        self._cooldown = 0.0  # prevent spam

    def add(self, tile_x, tile_y, kind="round"):
        """Add a footprint at a tile position."""
        if self._cooldown > 0:
            return
        # Don't leave prints on water or pen
        if is_pond_tile(tile_x, tile_y) or not is_on_island(tile_x, tile_y):
            return

        sx = ISLAND_X + tile_x * TILE_PX + TILE_PX // 2
        sy = ISLAND_Y + tile_y * TILE_PX + TILE_PX - 1  # bottom of tile

        self.prints.append(Footprint(sx, sy, kind))
        self._cooldown = 0.08  # min time between prints

        # Cap total prints
        if len(self.prints) > 60:
            self.prints = self.prints[-40:]

    def add_at_pixel(self, px, py, kind="round"):
        """Add a footprint at exact pixel coordinates."""
        self.prints.append(Footprint(int(px), int(py), kind))
        if len(self.prints) > 60:
            self.prints = self.prints[-40:]

    def update(self, dt):
        """Age and remove expired footprints."""
        self._cooldown -= dt
        if self._cooldown < 0:
            self._cooldown = 0

        for fp in self.prints:
            fp.timer += dt

        self.prints = [fp for fp in self.prints if fp.timer < fp.max_time]

    def draw(self):
        """Draw all footprints with fade-out."""
        for fp in self.prints:
            remaining = 1.0 - (fp.timer / fp.max_time)

            # Fade: skip drawing some frames as the print ages
            if remaining < 0.3:
                if pyxel.frame_count % 3 != 0:
                    continue

            ix, iy = fp.x, fp.y

            if fp.kind == "round":
                # Slime: 2 small round dots side by side
                pyxel.pset(ix - 1, iy, COL_DGREEN)
                pyxel.pset(ix + 1, iy, COL_DGREEN)
            elif fp.kind == "paw":
                # Cat: tiny paw — 3 toe dots + 1 pad
                pyxel.pset(ix - 1, iy - 1, COL_DGREEN)
                pyxel.pset(ix + 1, iy - 1, COL_DGREEN)
                pyxel.pset(ix, iy, COL_DGREEN)
            elif fp.kind == "scratch":
                # Chicken: two scratch lines
                pyxel.pset(ix - 1, iy, COL_DGREEN)
                pyxel.pset(ix, iy - 1, COL_DGREEN)
                pyxel.pset(ix + 1, iy, COL_DGREEN)
