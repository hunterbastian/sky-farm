# crops.py — Crop system: planting, growth, harvesting, auto-farm
#
# Each crop goes through growth stages based on real-time ticks.
# Auto-farm handles watering, harvesting, and replanting automatically.
#
# Python note: Lists are mutable (like JS arrays). We use list comprehension
# `[x for x in items if condition]` as a filter — like array.filter().

from constants import (
    CROPS, ISLAND_SIZE,
    AUTO_WATER_INTERVAL, AUTO_HARVEST_DELAY, AUTO_REPLANT_DELAY,
)
from world import TILE_GRASS, TILE_FARMLAND, is_farmable

# Crop type IDs in order (for cycling with the seeds tool)
CROP_IDS = list(CROPS.keys())  # ["sky_wheat", "star_berry", "cloud_pumpkin", "moon_flower"]

# Growth tick interval — how many real seconds per growth tick
GROWTH_TICK = 15.0  # same as original


class Crop:
    """A single planted crop on a tile."""

    # Python note: __slots__ is optional — it makes instances use less memory
    # by preventing dynamic attribute creation. Like a struct vs an object.
    __slots__ = ("x", "y", "crop_type", "growth", "watered", "grow_timer")

    def __init__(self, x, y, crop_type):
        self.x = x
        self.y = y
        self.crop_type = crop_type
        self.growth = 0          # 0 to grow_days
        self.watered = False     # watered this growth cycle
        self.grow_timer = 0.0    # accumulates real seconds toward next tick

    @property
    def definition(self):
        """Get this crop's definition (grow_days, sell, color) from constants."""
        return CROPS[self.crop_type]

    @property
    def grow_days(self):
        return self.definition["grow_days"]

    @property
    def is_mature(self):
        return self.growth >= self.grow_days

    @property
    def stage(self):
        """Growth stage 0-3 for sprite selection.
        0 = just planted, 1 = growing, 2 = nearly mature, 3 = mature.
        """
        if self.growth == 0:
            return 0
        elif self.is_mature:
            return 3
        elif self.growth >= self.grow_days * 0.6:
            return 2
        else:
            return 1


class CropSystem:
    """Manages all crops on the farm."""

    def __init__(self):
        self.crops = []               # List[Crop] — all active crops
        self.selected_seed = 0        # Index into CROP_IDS (0-3)

        # Auto-farm toggles
        self.auto_water = True        # auto-water unwatered crops
        self.auto_harvest = True      # auto-harvest mature crops
        self.auto_replant = True      # auto-replant after harvest

        # Auto-farm timers
        self._water_timer = 0.0
        self._harvest_timer = 0.0

    def cycle_seed(self):
        """Cycle to the next seed type."""
        self.selected_seed = (self.selected_seed + 1) % len(CROP_IDS)

    @property
    def current_seed_name(self):
        """Name of the currently selected seed type."""
        return CROP_IDS[self.selected_seed]

    def get_crop_at(self, x, y):
        """Find a crop at the given tile, or None."""
        for crop in self.crops:
            if crop.x == x and crop.y == y:
                return crop
        return None

    def plant(self, x, y, tiles):
        """Plant a crop at the given tile.
        Returns True if successfully planted.
        """
        # Can only plant on farmland with no existing crop
        if tiles[y][x] != TILE_FARMLAND:
            return False
        if self.get_crop_at(x, y) is not None:
            return False

        crop_type = CROP_IDS[self.selected_seed]
        self.crops.append(Crop(x, y, crop_type))
        return True

    def harvest(self, x, y):
        """Harvest a mature crop at the given tile.
        Returns the sell price if harvested, 0 otherwise.
        """
        crop = self.get_crop_at(x, y)
        if crop is None or not crop.is_mature:
            return 0

        sell_price = crop.definition["sell"]
        self.crops.remove(crop)
        return sell_price

    def till(self, x, y, tiles):
        """Till grass into farmland.
        Returns True if successfully tilled.
        """
        if not is_farmable(x, y):
            return False
        if tiles[y][x] != TILE_GRASS:
            return False
        tiles[y][x] = TILE_FARMLAND
        return True

    def update(self, dt, tiles, speed=1):
        """Update all crop growth and auto-farm logic.

        Args:
            dt: Delta time in seconds.
            tiles: The tile grid (for auto-replant tilling).
            speed: Game speed multiplier.

        Returns:
            coins_earned: Total coins earned this frame from auto-harvest.
        """
        coins_earned = 0
        effective_dt = dt * speed

        # --- Grow crops ---
        for crop in self.crops:
            if crop.is_mature:
                continue
            crop.grow_timer += effective_dt
            if crop.grow_timer >= GROWTH_TICK:
                crop.grow_timer -= GROWTH_TICK
                crop.growth += 1
                crop.watered = False  # needs watering again next cycle

        # --- Auto-water ---
        if self.auto_water:
            self._water_timer += effective_dt
            if self._water_timer >= AUTO_WATER_INTERVAL:
                self._water_timer = 0.0
                for crop in self.crops:
                    if not crop.watered and not crop.is_mature:
                        crop.watered = True

        # --- Auto-harvest ---
        if self.auto_harvest:
            self._harvest_timer += effective_dt
            if self._harvest_timer >= AUTO_HARVEST_DELAY:
                self._harvest_timer = 0.0
                # Harvest all mature crops
                mature = [c for c in self.crops if c.is_mature]
                for crop in mature:
                    coins_earned += crop.definition["sell"]
                    self.crops.remove(crop)
                    # Auto-replant on the same tile
                    if self.auto_replant and tiles[crop.y][crop.x] == TILE_FARMLAND:
                        self.crops.append(Crop(crop.x, crop.y, crop.crop_type))

        return coins_earned
