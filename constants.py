# constants.py — All game constants live here
# Python convention: ALL_CAPS = constant (not enforced, just a signal)

# === Screen ===
SCREEN_W = 256
SCREEN_H = 240
FPS = 60

# === Grid ===
TILE_PX = 8        # Each tile is 8x8 pixels (Pyxel's native tile size)
ISLAND_SIZE = 24   # 24x24 tile grid
WORLD_PX = ISLAND_SIZE * TILE_PX  # 192px

# === Layout offsets (where the island sits on screen) ===
ISLAND_X = (SCREEN_W - WORLD_PX) // 2   # 32px — centered horizontally
ISLAND_Y = 22                             # 22px from top (room for top bubble)

# === 16-Color Palette ===
# Pyxel palette indices (0-15). We set the actual hex values in main.py.
# In TypeScript you'd use an enum — Python uses plain ints with named constants.
COL_DARK     = 0   # 0x1a1a2e — near-black blue (text, outlines, night)
COL_BARK     = 1   # 0x3a2418 — dark brown (trunks, fences)
COL_WOOD     = 2   # 0x6a4830 — medium brown (wood, rails)
COL_TAN      = 3   # 0xb8986a — dry farmland
COL_WET      = 4   # 0x7a6048 — wet farmland
COL_DGREEN   = 5   # 0x5ab858 — dark green (grass shadow, leaves)
COL_GREEN    = 6   # 0x7dd87a — bright green (grass base)
COL_LGREEN   = 7   # 0x98f094 — light green (grass highlight)
COL_DWATER   = 8   # 0x3a5f82 — deep water (pond interior)
COL_SKY      = 9   # 0x88c8e8 — light blue (sky, water surface)
COL_GOLD     = 10  # 0xf0d060 — gold (coins, wheat, sparkles)
COL_ORANGE   = 11  # 0xd08830 — orange (pumpkin, sunset)
COL_RED      = 12  # 0xe03030 — red (chicken combs, berries)
COL_PINK     = 13  # 0xf0a0b0 — pink (cherry blossom, flowers)
COL_CREAM    = 14  # 0xf0c490 — cream (eggs, UI background)
COL_WHITE    = 15  # 0xffffff — white (highlights, text, clouds)

# The actual hex values, indexed by palette slot
PALETTE = [
    0x1a1a2e,  # 0  dark
    0x3a2418,  # 1  bark
    0x6a4830,  # 2  wood
    0xb8986a,  # 3  tan
    0x7a6048,  # 4  wet
    0x5ab858,  # 5  dark green
    0x7dd87a,  # 6  green
    0x98f094,  # 7  light green
    0x3a5f82,  # 8  deep water
    0x88c8e8,  # 9  sky
    0xf0d060,  # 10 gold
    0xd08830,  # 11 orange
    0xe03030,  # 12 red
    0xf0a0b0,  # 13 pink
    0xf0c490,  # 14 cream
    0xffffff,  # 15 white
]

# === Timing ===
DAY_LENGTH = 210    # seconds per in-game day (same as original)
SPEED_OPTIONS = [1, 2, 3]  # playback speed multipliers

# === Crop definitions ===
# Each crop: (name, grow_days, sell_price, color_index)
# In TypeScript this would be an interface + array — Python uses tuples or dicts.
CROPS = {
    "sky_wheat":      {"grow_days": 3, "sell": 8,  "color": COL_GOLD},
    "star_berry":     {"grow_days": 4, "sell": 15, "color": COL_RED},
    "cloud_pumpkin":  {"grow_days": 5, "sell": 25, "color": COL_ORANGE},
    "moon_flower":    {"grow_days": 6, "sell": 40, "color": COL_WHITE},
}

# === Auto-farm timing (seconds) ===
AUTO_WATER_INTERVAL = 5.0
AUTO_HARVEST_DELAY = 2.0
AUTO_REPLANT_DELAY = 3.0
AUTO_EGG_COLLECT_DELAY = 8.0

# === Trees ===
CHOP_HITS = 3
TREE_REGROW_TIME = 60.0  # seconds to regrow after chopping
