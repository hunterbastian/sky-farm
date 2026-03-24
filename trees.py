# trees.py — Oak and maple tree systems
#
# Oak trees: choppable (3 hits), drop wood, regrow after 60s.
# Maple trees: decorative, produce falling leaf particles.
#
# Python note: `dataclass`-style classes via __slots__ keep memory tight.
# `enum` isn't needed — we use string constants for states.

import math
import random
from constants import (
    CHOP_HITS, TREE_REGROW_TIME,
    COL_BARK, COL_WOOD, COL_DGREEN, COL_GREEN, COL_LGREEN,
    COL_PINK, COL_RED, COL_ORANGE, COL_GOLD,
)

# === Oak tree positions (tile coords) ===
OAK_POSITIONS = [(3, 2), (12, 2), (21, 2)]
HIVE_TREE = 1  # index into OAK_POSITIONS — middle oak has the beehive

# === Maple tree positions ===
MAPLE_POSITIONS = [(8, 15), (18, 15)]


class OakTree:
    """A choppable oak tree."""
    __slots__ = (
        "tx", "ty", "health", "alive", "regrow_timer",
        "fall_timer", "falling", "sway_phase",
    )

    def __init__(self, tx, ty):
        self.tx = tx
        self.ty = ty
        self.health = CHOP_HITS    # hits remaining before it falls
        self.alive = True          # False = stump, regrowing
        self.regrow_timer = 0.0    # counts up to TREE_REGROW_TIME
        self.fall_timer = 0.0      # animation timer when falling
        self.falling = False       # True during fall animation
        self.sway_phase = random.random() * math.pi * 2  # for canopy sway

    def chop(self):
        """Hit the tree once. Returns wood amount if tree falls, 0 otherwise."""
        if not self.alive or self.falling:
            return 0

        self.health -= 1
        if self.health <= 0:
            self.falling = True
            self.fall_timer = 0.0
            return 0  # wood given after fall animation completes
        return 0

    def update(self, dt):
        """Update tree state. Returns wood amount if tree just finished falling."""
        wood_earned = 0

        if self.falling:
            self.fall_timer += dt
            # Fall animation lasts 0.5 seconds
            if self.fall_timer >= 0.5:
                self.falling = False
                self.alive = False
                self.regrow_timer = 0.0
                wood_earned = 3  # drop 3 wood

        elif not self.alive:
            # Regrowing from stump
            self.regrow_timer += dt
            if self.regrow_timer >= TREE_REGROW_TIME:
                self.alive = True
                self.health = CHOP_HITS
                self.regrow_timer = 0.0

        # Canopy sway
        if self.alive and not self.falling:
            self.sway_phase += dt * 1.5

        return wood_earned


class MapleTree:
    """A decorative cherry blossom / maple tree."""
    __slots__ = ("tx", "ty", "sway_phase", "leaf_timer")

    def __init__(self, tx, ty):
        self.tx = tx
        self.ty = ty
        self.sway_phase = random.random() * math.pi * 2
        self.leaf_timer = 0.0  # timer for spawning falling leaves

    def update(self, dt):
        """Update maple sway. Returns True if a leaf should spawn."""
        self.sway_phase += dt * 1.2
        self.leaf_timer += dt
        # Spawn a leaf every 2-4 seconds
        if self.leaf_timer >= 2.5:
            self.leaf_timer = 0.0
            return True
        return False


class TreeSystem:
    """Manages all trees on the farm.
    Trees only appear once the island is big enough to contain them.
    """

    def __init__(self):
        # Start empty — trees added as island expands
        self.oaks = []
        self.maples = []

    def refresh_for_island(self):
        """Check which tree positions are now on the island and add them."""
        from world import is_on_island
        for tx, ty in OAK_POSITIONS:
            if is_on_island(tx, ty) and not any(o.tx == tx and o.ty == ty for o in self.oaks):
                self.oaks.append(OakTree(tx, ty))
        for tx, ty in MAPLE_POSITIONS:
            if is_on_island(tx, ty) and not any(m.tx == tx and m.ty == ty for m in self.maples):
                self.maples.append(MapleTree(tx, ty))

    def get_oak_at(self, tx, ty):
        """Find an oak tree at the given tile (checks a 3x5 area around trunk)."""
        for oak in self.oaks:
            # Tree occupies roughly tx-1..tx+1 horizontally, ty-3..ty vertically
            if abs(tx - oak.tx) <= 1 and ty >= oak.ty - 3 and ty <= oak.ty:
                return oak
        return None

    def chop_at(self, tx, ty):
        """Try to chop a tree at the given tile. Returns the oak if hit."""
        oak = self.get_oak_at(tx, ty)
        if oak and oak.alive and not oak.falling:
            oak.chop()
            return oak
        return None

    def update(self, dt):
        """Update oak trees only. Returns total wood earned this frame.
        Maples are updated in main.py (needs particle system access).
        """
        wood = 0
        for oak in self.oaks:
            wood += oak.update(dt)
        return wood

    def is_tree_tile(self, tx, ty):
        """Check if a tile is occupied by any tree (for interaction blocking)."""
        for oak in self.oaks:
            if oak.alive and abs(tx - oak.tx) <= 1 and ty >= oak.ty - 3 and ty <= oak.ty:
                return True
        for maple in self.maples:
            if abs(tx - maple.tx) <= 1 and ty >= maple.ty - 3 and ty <= maple.ty:
                return True
        return False
