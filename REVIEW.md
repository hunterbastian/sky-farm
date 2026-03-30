# Weekly Code Review — 2026-03-30

Codebase: Sky Farm (Soratchi) — Python/Pyxel pixel farming idle game.
Scope: All `.py` source files (21 modules, ~1 500 lines).

---

## Bugs

### B1 — Harvest particle uses wrong crop color (`main.py:272`)

`_handle_event` reads the *selected seed* to determine the burst color, not the
crop that was just harvested.

```python
# current (wrong)
crop_type = CROP_IDS[self.crop_system.selected_seed]

# fix — pass crop_type through the event tuple
# In _auto_interact, line 253: return ("harvest", tx, ty, sell_price, crop.crop_type)
# In _handle_event:
_, tx, ty, sell_price, crop_type = evt
```

If the player selects "moon_flower" seeds but walks over a mature "sky_wheat",
the sparkle burst will be white instead of gold.

---

### B2 — Auto-harvest never advances harvest goals (`crops.py:173-179`, `goals.py:102-120`)

`CropSystem.update()` auto-harvests silently and returns only coin totals.
It never calls back into `GoalSystem`, so the goals
`first_harvest`, `five_harvest`, and `big_harvest` only progress when the
*slime physically lands* on a mature tile — they stall in pure idle play.

Fix: expose a `harvested_count` (or a callback) from `CropSystem.update()` and
feed it to `_goal_event("harvest")` in `App.update()`, alongside `auto_coins`.

---

### B3 — `all_crops` goal can never complete (`goals.py:138-140`, `main.py` — missing call)

`GoalSystem.track_crop_type()` is the only path that advances the "all_crops"
goal, but it is **never called anywhere in the codebase**. The goal will remain
permanently at `0/4`.

Fix: call `self.goals.track_crop_type(crop.crop_type)` inside `_handle_event`
when `action == "harvest"`, and also from the auto-harvest loop.

---

### B4 — `InputHandler` is instantiated but never used (`main.py:64`, entire `input_handler.py`)

`self.input = InputHandler()` is created in `App.__init__`, but
`self.input.update()` is **never called**. All actual input processing is done
directly in `player.py` and `main.py`. The module is dead code.

Additionally, `InputHandler.update()` listens for `KEY_S` to cycle seeds
(`input_handler.py:69`), which conflicts with the player's "move down" binding
in `player.py:152`. If `InputHandler` is ever wired in, pressing S would both
move the slime and cycle seeds on the same frame.

Fix: delete `input_handler.py` (or remove the `KEY_S` seed-cycle binding and
wire it up properly through `App.update()`).

---

### B5 — Rain waters all crops every frame instead of once on transition (`main.py:130-132`)

```python
if self.weather.is_raining:
    for crop in self.crop_system.crops:
        crop.watered = True   # runs ~60× per second
```

This is O(n_crops × 60) per second instead of O(n_crops) once.
More importantly, `crop.watered` is reset to `False` on each growth tick
(`crops.py:156`), so on fast-speed runs the per-frame loop is the only thing
keeping crops watered — but the logic still re-runs unnecessarily every frame
when crops are already watered.

Fix: move the watering call into `WeatherSystem.update()` at the moment
`self.current` transitions *to* `RAIN`, passing a callback or returning a flag.

---

### B6 — `crop.watered` never gates growth (`crops.py:149-155`)

The growth loop increments `crop.growth` unconditionally — `crop.watered` is
never checked before allowing a growth tick. The field exists and is displayed
visually, but has no gameplay effect. Auto-water fires every 5 s while growth
ticks every 15 s, so in practice crops are always watered in time, but if
`auto_water` is ever disabled the crops will still grow.

Either remove the `watered` field and the auto-water system (it's purely
cosmetic), or add `if not crop.watered: continue` to the growth loop.

---

### B7 — Tree state is not saved or restored (`save_load.py`)

The save file omits `health`, `alive`, `falling`, and `regrow_timer` for each
oak tree. After a reload, all oaks come back fully alive regardless of chop
progress or regrow state. A player mid-chop on a 1-health tree will find it
at full health after restarting.

Fix: add a `"trees"` array to the save data, analogous to `"crops"`.

---

### B8 — `clock.tick` accumulates forever (`clock.py:32`)

```python
self.tick += dt * self.speed
```

`self.tick` is written every frame but **read nowhere** in any file. It grows
without bound for the lifetime of the session (a float precision issue would
appear after ~10⁷ seconds, far outside practical play, but it's wasted state).

Fix: delete the field and the line.

---

### B9 — Duplicate `# Inventory panel` comment in `draw()` (`main.py:421-425`)

```python
# Inventory panel (on top of everything)   ← first occurrence
# Goal bubble (right side)
self.ui.draw_goal(self.goals)

# Inventory panel (on top of everything)   ← copy-pasted duplicate
self.ui.draw_inventory(...)
```

The first comment should read `# Goal bubble (right side)` only.

---

## Performance

### P1 — `get_crop_at` is O(n) on every land event and draw call (`crops.py:90-95`)

```python
def get_crop_at(self, x, y):
    for crop in self.crops:
        if crop.x == x and crop.y == y:
            return crop
```

This is called from `_auto_interact` (every player land), from `draw_crops`
(every tile × every frame), and twice in the auto-harvest loop.
With up to ~200 crops at full island size this is ~40 000 comparisons per frame
just for drawing.

Fix: maintain a `dict[tuple[int,int], Crop]` alongside the list:
```python
self._crop_map: dict[tuple[int, int], Crop] = {}
```
Update it in `plant()`, `harvest()`, and the auto-harvest loop.
`get_crop_at` becomes `return self._crop_map.get((x, y))`.

---

### P2 — Particle list is rebuilt (full copy) every frame (`particles.py:205-259`)

```python
alive = []
for p in self.particles:
    ...
    alive.append(p)
self.particles = alive
```

This allocates a new list object every frame. With ~50-100 particles typical
this is tolerable, but replacing it with in-place removal eliminates the
allocation. More importantly, `random.random()` is called once per mote per
frame in `draw()` (`particles.py:319`) — at 60 fps × 15 motes = 900 calls/s.
A per-particle `flicker_phase` already exists (`p.phase`); use
`math.sin(p.phase) > 0.1` instead.

---

### P3 — `pet.player_trail.pop(0)` is O(n) (`pet.py:107`)

```python
self.player_trail.pop(0)
```

Shifting a list on every player step. Switch `player_trail` to
`collections.deque(maxlen=50)`:

```python
from collections import deque
self.player_trail: deque = deque(maxlen=50)
```

`popleft()` is O(1), and the length cap makes the manual trim at line 61
unnecessary.

---

## Refactor Opportunities

### R1 — `_auto_interact` duplicates `InputHandler._smart_tap` (`main.py:224-264`, `input_handler.py:75-131`)

Both functions implement the identical priority chain (tree → egg → harvest →
plant → till). `InputHandler` is dead (see B4), so the right move is to delete
`input_handler.py` entirely and keep the logic in `_auto_interact`.

---

### R2 — `_goal_event` mixes too many concerns (`main.py:330-377`)

At 47 lines, `_goal_event` handles: goal advancement, coin rewards, island
mask rebuild, tile grid patching, tree refresh, animal spawning, pet creation,
and particle count updates. It partially duplicates `apply_save`.

Extract an `_on_island_expand(target_level)` helper. That helper can also be
called from `apply_save` via a parameter, eliminating the duplication.

---

### R3 — `GoalSystem.on_event` is a fragile if-elif chain (`goals.py:91-148`)

11 goal names, each requiring its own branch. Adding a new goal requires
editing the chain. Replace with a small dispatch dict keyed on goal name, or
at minimum move the coin/wood passive goals into `update()` so `on_event`
only handles discrete events.

---

### R4 — `_get_action_hint` in `UI` imports `TreeSystem` but never uses it (`ui.py:272-277`)

```python
try:
    from trees import TreeSystem
    # We check tree_system via a stored ref if available
except ImportError:
    pass
```

The import is dead. The function can never return a "Chop tree" hint because
`UI` has no reference to `tree_system`. Either pass `tree_system` as a
parameter or remove the dead import block.

---

### R5 — `draw_inventory` imports `COL_GOLD as _` pointlessly (`ui.py:411`)

```python
from constants import COL_GOLD as _
```

`COL_GOLD` is already imported at the top of `ui.py` (line 16). Stale artifact.

---

## Type Safety

### T1 — `cd["type"]` raises `KeyError` on corrupted saves (`save_load.py:122`)

```python
c = Crop(cd["x"], cd["y"], cd["type"])
```

All other fields use `.get(key, default)`, but `"type"` does not. A save
that omits `"type"` crashes on load with no useful error.

Fix:
```python
crop_type = cd.get("type", CROP_IDS[0])
if crop_type not in CROPS:
    crop_type = CROP_IDS[0]
c = Crop(cd["x"], cd["y"], crop_type)
```

---

### T2 — `tiles[crop.y][crop.x]` has no bounds guard in auto-replant (`crops.py:178`)

```python
if self.auto_replant and tiles[crop.y][crop.x] == TILE_FARMLAND:
    self.crops.append(Crop(crop.x, crop.y, crop.crop_type))
```

If a crop from a corrupted save has out-of-bounds coordinates, this raises
`IndexError` inside the auto-farm loop, freezing the game. A guard costs one line:

```python
if 0 <= crop.y < len(tiles) and 0 <= crop.x < len(tiles[0]):
```

---

### T3 — No type annotations across the codebase

Functions like `get_crop_at(x, y)` return `Crop | None` but carry no
annotation. Gradual adoption of `-> Optional[Crop]` and `from __future__ import
annotations` would make refactoring and editor support significantly safer.

---

### T4 — `pet.draw()` arc progress is unclamped (`pet.py:128-129`)

```python
progress = self.hop_timer / FOLLOW_SPEED  # not clamped to [0, 1]
arc = -math.sin(progress * math.pi) * 3
```

`update()` clamps `progress` to 1.0 before acting, but `draw()` recomputes it
independently. When `hop_timer` overshoots `FOLLOW_SPEED`, `progress > 1.0`
and `math.sin(progress * π)` goes negative, pushing the cat upward for one
frame.

Fix: `progress = min(self.hop_timer / FOLLOW_SPEED, 1.0)`.

---

## Summary Table

| ID  | File(s)                              | Severity | Category      |
|-----|--------------------------------------|----------|---------------|
| B1  | `main.py:272`                        | Medium   | Bug           |
| B2  | `crops.py:173`, `goals.py:102`       | High     | Bug           |
| B3  | `goals.py:138`, `main.py` (missing)  | High     | Bug           |
| B4  | `main.py:64`, `input_handler.py`     | Medium   | Bug/Dead code |
| B5  | `main.py:130`                        | Low      | Bug/Perf      |
| B6  | `crops.py:149`                       | Low      | Bug/Design    |
| B7  | `save_load.py`                       | Medium   | Bug           |
| B8  | `clock.py:32`                        | Low      | Bug           |
| B9  | `main.py:421`                        | Low      | Bug           |
| P1  | `crops.py:90`                        | Medium   | Performance   |
| P2  | `particles.py:205`                   | Low      | Performance   |
| P3  | `pet.py:107`                         | Low      | Performance   |
| R1  | `main.py:224`, `input_handler.py`    | Medium   | Refactor      |
| R2  | `main.py:330`                        | Medium   | Refactor      |
| R3  | `goals.py:91`                        | Low      | Refactor      |
| R4  | `ui.py:272`                          | Low      | Refactor      |
| R5  | `ui.py:411`                          | Low      | Refactor      |
| T1  | `save_load.py:122`                   | Medium   | Type safety   |
| T2  | `crops.py:178`                       | Low      | Type safety   |
| T3  | Project-wide                         | Low      | Type safety   |
| T4  | `pet.py:128`                         | Low      | Type safety   |

**Highest-priority fixes:** B2, B3 (idle goals broken), B4 (dead module with
conflicting binding), T1 (crash on load), B1 (wrong visual feedback), B7
(tree state loss on save).
