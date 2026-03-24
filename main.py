# main.py — Soratchi (Sky Farm) entry point
# A cozy pixel farming idle game built with Pyxel (Python fantasy console).
# You control a little green slime that hops around the island and farms!

import pyxel
from constants import (
    SCREEN_W, SCREEN_H, FPS, PALETTE, TILE_PX, ISLAND_X, ISLAND_Y, COL_CREAM,
    COL_DARK, COL_SKY, COL_WHITE, COL_GOLD, COL_GREEN, COL_LGREEN, COL_DGREEN, COL_TAN, COL_ORANGE, COL_PINK,
)
from world import create_tile_grid, is_pen_tile, expand_island
from draw_world import draw_sky, draw_clouds, draw_island, draw_crops, draw_night_overlay
from draw_entities import (
    draw_all_trees, draw_all_chickens, draw_all_eggs,
    draw_beehive, draw_all_bees,
)
from clock import Clock
from crops import CropSystem, CROPS, CROP_IDS
from trees import TreeSystem
from animals import AnimalSystem
from particles import ParticleSystem
from input_handler import InputHandler
from player import Player
from ui import UI
from goals import GoalSystem
from pet import Pet
from footprints import FootprintSystem
from weather import WeatherSystem
from economy import Economy
from save_load import save_game, load_game, apply_save, AUTO_SAVE_INTERVAL
from boot import BootScreen
from sound import (
    init_sounds, init_music, play_sfx, MusicManager,
    SFX_TILL, SFX_PLANT, SFX_CHOP, SFX_TIMBER,
    SFX_HARVEST, SFX_COIN, SFX_EGG, SFX_TOOL_SEL,
    SFX_DAWN, SFX_SPLASH,
)


class App:
    """Main game class. Pyxel calls update() and draw() every frame."""

    def __init__(self):
        pyxel.init(SCREEN_W, SCREEN_H, title="Soratchi", fps=FPS)
        pyxel.mouse(False)  # hide OS cursor — we draw a custom leaf cursor

        for i, color in enumerate(PALETTE):
            pyxel.colors[i] = color

        init_sounds()
        init_music()

        # === Game state machine ===
        self.mode = "boot"  # "boot" -> "playing"
        self.boot_screen = BootScreen()

        # === Game systems ===
        self.frame_count = 0
        self.tiles = create_tile_grid()
        self.clock = Clock()
        self.crop_system = CropSystem()
        self.tree_system = TreeSystem()
        self.animal_system = AnimalSystem()
        self.particles = ParticleSystem()
        self.input = InputHandler()
        self.player = Player(12, 12)  # start in center of island
        self.pet = None              # cat unlocked later
        self.footprints = FootprintSystem()
        self.ui = UI()
        self.goals = GoalSystem()
        self.weather = WeatherSystem()
        self.economy = Economy()
        self.music = MusicManager()

        self.game_state = {
            "coins": 0,
            "wood": 0,
        }
        self.save_timer = 0.0

        # Load save if it exists
        save_data = load_game()
        if save_data:
            pet = apply_save(
                save_data, self.tiles, self.game_state, self.clock,
                self.crop_system, self.goals, self.economy,
                self.animal_system, self.tree_system, self.particles,
                expand_island, Pet,
            )
            if pet:
                self.pet = pet

        pyxel.run(self.update, self.draw)

    def update(self):
        """Game logic — runs every frame, guaranteed."""
        self.frame_count += 1
        dt = 1.0 / FPS

        if pyxel.btnp(pyxel.KEY_Q):
            pyxel.quit()

        # --- Boot screen ---
        if self.mode == "boot":
            if self.boot_screen.update(dt):
                self.mode = "playing"
            return

        # --- Toolbar click (seed slots, speed, inventory) ---
        toolbar_action = self.ui.check_toolbar_click(self.crop_system, self.clock)
        if toolbar_action:
            play_sfx(SFX_TOOL_SEL)
            self.player.click_consumed = True  # prevent click-to-move on same frame

        # --- Keyboard shortcuts (still work alongside toolbar) ---
        if pyxel.btnp(pyxel.KEY_F):
            self.clock.cycle_speed()
        if pyxel.btnp(pyxel.KEY_TAB):
            self.crop_system.cycle_seed()
            play_sfx(SFX_TOOL_SEL)
        if pyxel.btnp(pyxel.KEY_E):
            self.ui.toggle_inventory()
            play_sfx(SFX_TOOL_SEL)

        # --- Clock ---
        self.clock.update(dt)

        # --- Weather ---
        self.weather.update(dt)
        # Rain auto-waters all crops
        if self.weather.is_raining:
            for crop in self.crop_system.crops:
                crop.watered = True

        # --- Music ---
        self.music.update(self.clock.hour_int)

        # --- Dawn chime ---
        if self.clock.day_changed:
            play_sfx(SFX_DAWN)

        # --- Player movement ---
        landed = self.player.update(dt)

        # --- Footprints + pet trail on landing ---
        if landed:
            tx, ty = landed
            self.footprints.add(tx, ty, "round")  # slime footprint
            if self.pet:
                self.pet.record_player_pos(tx, ty)

        # --- Pet (if unlocked) ---
        if self.pet:
            self.pet.update(dt)
            if self.pet.hopping and self.pet.hop_timer < 0.02:
                self.footprints.add(int(self.pet.tx), int(self.pet.ty), "paw")

        # --- Chicken footprints (occasional) ---
        if self.frame_count % 45 == 0:
            for chicken in self.animal_system.chickens:
                if chicken.state == "walk":
                    self.footprints.add_at_pixel(
                        ISLAND_X + int(chicken.x * TILE_PX) + 2,
                        ISLAND_Y + int(chicken.y * TILE_PX) + TILE_PX - 1,
                        "scratch"
                    )

        # --- Footprints fade ---
        self.footprints.update(dt)

        # --- Auto-interact when slime lands on a tile ---
        if landed:
            tx, ty = landed
            evt = self._auto_interact(tx, ty)
            if evt:
                self._handle_event(evt)

        # (Click-to-move replaced the old click-to-interact — slime handles everything)

        # --- Trees ---
        wood_earned = self.tree_system.update(dt)
        if wood_earned > 0:
            self.game_state["wood"] += wood_earned
            play_sfx(SFX_COIN)

        # --- Maple leaves ---
        for maple in self.tree_system.maples:
            should_spawn = maple.update(dt)
            if should_spawn:
                self.particles.spawn_falling_leaf(maple.tx, maple.ty)

        # --- Crop growth + auto-farm ---
        # Growth speed affected by weather + economy upgrades
        effective_speed = self.clock.speed * self.weather.growth_mult * self.economy.growth_bonus
        auto_coins = self.crop_system.update(dt, self.tiles, effective_speed)
        if auto_coins > 0:
            self.game_state["coins"] += auto_coins
            play_sfx(SFX_COIN)

        # --- Animals ---
        egg_coins = self.animal_system.update(dt, self.clock.speed)
        if egg_coins > 0:
            self.game_state["coins"] += egg_coins
            play_sfx(SFX_EGG)

        # --- Particles ---
        self.particles.update(dt, self.clock.speed)

        # --- Goals (passive checks for coin/wood goals) ---
        self.goals.update(dt, self.game_state)

        # --- UI ---
        self.ui.update(dt)

        # --- Auto-save ---
        self.save_timer += dt
        if self.save_timer >= AUTO_SAVE_INTERVAL:
            self.save_timer = 0.0
            save_game(
                self.tiles, self.game_state, self.clock,
                self.crop_system, self.goals, self.economy,
                self.animal_system,
            )

    def _auto_interact(self, tx, ty):
        """Smart tap triggered by the slime landing on a tile.
        Same priority as click-based smart tap.
        """
        from world import is_pond_tile, is_farmable, TILE_GRASS, TILE_FARMLAND

        # Chop tree
        oak = self.tree_system.chop_at(tx, ty)
        if oak:
            return ("chop", tx, ty, oak.health)

        # Collect egg in pen
        if is_pen_tile(tx, ty):
            egg_coins = self.animal_system.collect_egg_at(tx, ty)
            if egg_coins > 0:
                self.game_state["coins"] += egg_coins
                return ("collect_egg", tx, ty)
            return None  # in pen but no egg — do nothing

        if is_pond_tile(tx, ty):
            return None

        tile_type = self.tiles[ty][tx]

        # Harvest mature crop
        crop = self.crop_system.get_crop_at(tx, ty)
        if crop is not None and crop.is_mature:
            sell_price = self.crop_system.harvest(tx, ty)
            if sell_price > 0:
                self.game_state["coins"] += sell_price
                return ("harvest", tx, ty, sell_price)

        # Plant on empty farmland
        if tile_type == TILE_FARMLAND and crop is None:
            if self.crop_system.plant(tx, ty, self.tiles):
                return ("plant", tx, ty)

        # Slime does NOT auto-till grass — tilling is click-only
        # (feels bad to rip up grass just by walking around)

        return None

    def _handle_event(self, evt):
        """Process a game event — floating text + particles + sound."""
        action = evt[0]
        if action == "harvest":
            _, tx, ty, sell_price = evt
            self.ui.add_floating_text(tx, ty, f"+{sell_price}", COL_GOLD)
            crop_type = CROP_IDS[self.crop_system.selected_seed]
            crop_color = CROPS[crop_type]["color"]
            self.particles.spawn_harvest_burst(tx, ty, crop_color)
            self.particles.spawn_sparkles(tx, ty)
            play_sfx(SFX_HARVEST)
            self._goal_event("harvest")
        elif action == "till":
            _, tx, ty = evt
            self.ui.add_floating_text(tx, ty, "TILL", COL_WHITE)
            self.particles.spawn_dirt_puffs(tx, ty)
            play_sfx(SFX_TILL)
            self._goal_event("till")
        elif action == "plant":
            _, tx, ty = evt
            self.ui.add_floating_text(tx, ty, "PLANT", COL_GREEN)
            self.particles.spawn_seed_pops(tx, ty)
            play_sfx(SFX_PLANT)
        elif action == "chop":
            _, tx, ty, hits_left = evt
            self.particles.spawn_wood_chips(tx, ty)
            if hits_left > 0:
                self.ui.add_floating_text(tx, ty, f"CHOP {hits_left}", COL_TAN)
                play_sfx(SFX_CHOP)
            else:
                self.ui.add_floating_text(tx, ty, "TIMBER!", COL_ORANGE)
                play_sfx(SFX_TIMBER)
                self._goal_event("timber")
        elif action == "collect_egg":
            _, tx, ty = evt
            self.ui.add_floating_text(tx, ty, "+3", COL_CREAM)
            self.particles.spawn_egg_pop(tx, ty)
            self.particles.spawn_sparkles(tx, ty)
            play_sfx(SFX_EGG)
            self._goal_event("collect_egg")
        elif action == "cycle_seed":
            play_sfx(SFX_TOOL_SEL)

    def _draw_tree_shadows(self, hour):
        """Clean flat shadow under trees — single dark green oval, no dithering."""
        if hour < 6 or hour >= 20:
            return  # no shadows at night

        # Shadow offset shifts with sun direction
        sun_progress = max(0, min(1, (hour - 6) / 12))
        shadow_dx = int((sun_progress - 0.5) * -6)

        for oak in self.tree_system.oaks:
            if not oak.alive:
                continue
            sx = ISLAND_X + oak.tx * TILE_PX + shadow_dx
            sy = ISLAND_Y + oak.ty * TILE_PX + 4
            pyxel.rect(sx - 2, sy, 12, 3, COL_DGREEN)

        for maple in self.tree_system.maples:
            sx = ISLAND_X + maple.tx * TILE_PX + shadow_dx
            sy = ISLAND_Y + maple.ty * TILE_PX + 4
            pyxel.rect(sx - 1, sy, 10, 2, COL_DGREEN)

    def _goal_event(self, event_type):
        """Feed an event to the goal system and handle rewards."""
        old_index = self.goals.current_index
        reward = self.goals.on_event(event_type, self.game_state)
        if reward > 0:
            self.game_state["coins"] += reward
            play_sfx(SFX_COIN)

        # Auto-expand island at goal milestones
        # Level 1 after 3 goals, level 2 after 6, level 3 after 9
        new_index = self.goals.current_index
        if new_index != old_index:
            target_level = new_index // 3  # 0,1,2,3
            if target_level > self.economy.island_level and target_level <= 3:
                for i in range(self.economy.island_level + 1, target_level + 1):
                    self.economy.purchased.add(f"Island Ring {i}")
                expand_island(target_level)

                # Add new grass tiles
                from world import ISLAND_MASK, TILE_GRASS
                for y in range(24):
                    for x in range(24):
                        if (x, y) in ISLAND_MASK and self.tiles[y][x] is None:
                            self.tiles[y][x] = TILE_GRASS

                # Spawn trees/animals that are now on the island
                self.tree_system.refresh_for_island()

                # Chickens appear at level 1+ (pen is on island)
                if target_level >= 1:
                    self.animal_system.spawn_chickens()

                # Bees appear when hive tree (12,2) is on island — level 2+
                if target_level >= 2 and len(self.tree_system.oaks) > 1:
                    self.animal_system.spawn_bees()

                # Cat unlocked at level 2
                if target_level >= 2 and self.pet is None:
                    self.pet = Pet(self.player.tx - 1, self.player.ty)
                    self.ui.add_floating_text(
                        self.player.tx, self.player.ty - 1,
                        "A cat appeared!", COL_PINK,
                    )

                # More ambient particles as island grows
                ambient = {0: (5, 1), 1: (8, 2), 2: (12, 3), 3: (15, 4)}
                m, b = ambient.get(target_level, (15, 4))
                self.particles.set_ambient_counts(m, b)

    def draw(self):
        """Rendering — may be skipped if the frame budget is exceeded."""
        # Boot screen
        if self.mode == "boot":
            self.boot_screen.draw()
            return
        pyxel.cls(COL_SKY)

        hour = self.clock.hour

        draw_sky(self.frame_count, hour)
        draw_clouds(self.frame_count, hour)
        draw_island(self.tiles, self.frame_count)
        draw_crops(self.crop_system.crops)

        # Dithered tree shadows on the ground (cast by sun)
        self._draw_tree_shadows(hour)

        draw_all_trees(self.tree_system)
        draw_beehive(self.tree_system)
        draw_all_bees(self.animal_system, self.tree_system)
        draw_all_chickens(self.animal_system)
        draw_all_eggs(self.animal_system)

        self.footprints.draw()
        self.player.draw()
        if self.pet:
            self.pet.draw()
        self.particles.draw()

        # Weather effects
        self.weather.draw()

        # Night darkness overlay (on top of world, below UI)
        draw_night_overlay()
        # Tile cursor removed — the slime IS the cursor
        self.ui.draw_floating_texts()
        self.ui.draw_hud(self.clock, self.game_state["coins"],
                         self.game_state["wood"], self.crop_system, self.weather)
        self.ui.draw_toolbar(self.crop_system, (self.player.tx, self.player.ty), self.tiles)

        # Inventory panel (on top of everything)
        # Goal bubble (right side)
        self.ui.draw_goal(self.goals)

        # Inventory panel (on top of everything)
        self.ui.draw_inventory(self.game_state, self.crop_system, self.animal_system)

        # Custom cursor — cute leaf pointer (always on top of everything)
        _draw_cursor()


def _draw_cursor():
    """Draw a cute custom cursor — a small green leaf with a stem."""
    mx, my = pyxel.mouse_x, pyxel.mouse_y
    # Stem (1px dark line pointing to the click point)
    pyxel.pset(mx, my, COL_DARK)
    pyxel.pset(mx + 1, my + 1, COL_DARK)
    # Leaf body
    pyxel.pset(mx + 2, my, COL_GREEN)
    pyxel.pset(mx + 3, my, COL_GREEN)
    pyxel.pset(mx + 1, my - 1, COL_GREEN)
    pyxel.pset(mx + 2, my - 1, COL_LGREEN)
    pyxel.pset(mx + 3, my - 1, COL_GREEN)
    pyxel.pset(mx + 4, my - 1, COL_DGREEN)
    pyxel.pset(mx + 2, my - 2, COL_GREEN)
    pyxel.pset(mx + 3, my - 2, COL_LGREEN)
    # Vein highlight
    pyxel.pset(mx + 2, my - 1, COL_LGREEN)


if __name__ == "__main__":
    App()
