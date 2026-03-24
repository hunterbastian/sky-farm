# save_load.py — Save and load game state
#
# Saves to a JSON file. On desktop this is a regular file.
# On web (WASM), Pyxel's virtual filesystem persists via IndexedDB.
#
# Auto-saves every 30 seconds. Loads on boot if a save exists.

import json
import os

SAVE_FILE = "soratchi_save.json"
AUTO_SAVE_INTERVAL = 30.0  # seconds


def save_game(tiles, game_state, clock, crop_system, goals, economy, animal_system):
    """Serialize game state to JSON and write to file."""
    data = {
        "version": 1,
        # Economy
        "coins": game_state["coins"],
        "wood": game_state["wood"],
        # Clock
        "day": clock.day,
        "hour": clock.hour,
        "speed": clock.speed,
        # Tiles (only save farmland positions — grass is default)
        "farmland": [
            [x, y] for y in range(len(tiles))
            for x in range(len(tiles[0]))
            if tiles[y][x] == "farmland"
        ],
        # Crops
        "crops": [
            {
                "x": c.x, "y": c.y,
                "type": c.crop_type,
                "growth": c.growth,
                "watered": c.watered,
                "grow_timer": c.grow_timer,
            }
            for c in crop_system.crops
        ],
        "selected_seed": crop_system.selected_seed,
        # Goals
        "goal_index": goals.current_index,
        "goal_progress": [
            {"progress": g.progress, "completed": g.completed}
            for g in goals.goals
        ],
        # Economy/unlocks
        "purchased": list(economy.purchased),
        "island_level": economy.island_level,
        # Animals
        "honey": animal_system.honey,
        "chickens_spawned": animal_system._chickens_spawned,
        "bees_spawned": animal_system._bees_spawned,
    }

    try:
        with open(SAVE_FILE, "w") as f:
            json.dump(data, f)
        return True
    except Exception:
        return False


def load_game():
    """Load game state from JSON. Returns the data dict or None."""
    if not os.path.exists(SAVE_FILE):
        return None
    try:
        with open(SAVE_FILE, "r") as f:
            data = json.load(f)
        if data.get("version") != 1:
            return None
        return data
    except Exception:
        return None


def apply_save(data, tiles, game_state, clock, crop_system, goals, economy,
               animal_system, tree_system, particles, expand_island_fn, Pet):
    """Apply loaded save data to all game systems.

    Returns the pet instance if it should be created, else None.
    """
    from world import ISLAND_MASK, TILE_GRASS, TILE_FARMLAND
    from crops import Crop, CROP_IDS

    # Economy & coins
    game_state["coins"] = data.get("coins", 0)
    game_state["wood"] = data.get("wood", 0)

    # Clock
    clock.day = data.get("day", 1)
    clock.hour = data.get("hour", 9.0)
    clock.speed = data.get("speed", 1)

    # Island level — expand first so tiles exist
    island_level = data.get("island_level", 0)
    if island_level > 0:
        for i in range(1, island_level + 1):
            economy.purchased.add(f"Island Ring {i}")
        expand_island_fn(island_level)

    # Rebuild tile grid
    for y in range(len(tiles)):
        for x in range(len(tiles[0])):
            if (x, y) in ISLAND_MASK:
                tiles[y][x] = TILE_GRASS
            else:
                tiles[y][x] = None

    # Farmland
    for x, y in data.get("farmland", []):
        if 0 <= y < len(tiles) and 0 <= x < len(tiles[0]):
            tiles[y][x] = TILE_FARMLAND

    # Crops
    crop_system.crops.clear()
    for cd in data.get("crops", []):
        c = Crop(cd["x"], cd["y"], cd["type"])
        c.growth = cd.get("growth", 0)
        c.watered = cd.get("watered", False)
        c.grow_timer = cd.get("grow_timer", 0.0)
        crop_system.crops.append(c)
    crop_system.selected_seed = data.get("selected_seed", 0)

    # Goals
    goal_progress = data.get("goal_progress", [])
    for i, gp in enumerate(goal_progress):
        if i < len(goals.goals):
            goals.goals[i].progress = gp.get("progress", 0)
            goals.goals[i].completed = gp.get("completed", False)
    goals.current_index = data.get("goal_index", 0)

    # Purchased upgrades
    for item_name in data.get("purchased", []):
        economy.purchased.add(item_name)
    economy._apply_all()

    # Trees (refresh based on island level)
    tree_system.refresh_for_island()

    # Animals
    animal_system.honey = data.get("honey", 0.0)
    if data.get("chickens_spawned", False):
        animal_system.spawn_chickens()
    if data.get("bees_spawned", False):
        animal_system.spawn_bees()

    # Particles
    ambient = {0: (5, 1), 1: (8, 2), 2: (12, 3), 3: (15, 4)}
    m, b = ambient.get(island_level, (5, 1))
    particles.set_ambient_counts(m, b)

    # Pet (level 2+)
    pet = None
    if island_level >= 2:
        pet = Pet(11, 12)

    return pet
