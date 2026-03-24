# player.py — The player's green slime character
#
# Click anywhere on the island and the slime hops there tile-by-tile.
# WASD/arrows also work for direct control.
# Auto-interacts with whatever tile it lands on.

import math
import pyxel
from constants import (
    TILE_PX, ISLAND_X, ISLAND_Y, ISLAND_SIZE, FPS,
    COL_DARK, COL_DGREEN, COL_GREEN, COL_LGREEN, COL_WHITE, COL_PINK,
)
from world import is_on_island, is_pond_tile


# Hop timing
HOP_DURATION = 0.22    # seconds per tile hop (relaxed, cozy pace)
HOP_HEIGHT = 6         # pixels of vertical arc during hop
HOP_PAUSE = 0.06       # pause between hops in a path (bouncy rhythm)


class Player:
    """A little green slime that hops around the island."""

    def __init__(self, start_x=12, start_y=12):
        self.tx = start_x
        self.ty = start_y

        # Movement
        self.target_tx = start_x
        self.target_ty = start_y
        self.hopping = False
        self.hop_timer = 0.0
        self.facing = 1

        # Path queue: list of (tx, ty) tiles to hop through
        self.path = []
        self.path_pause = 0.0  # pause between hops
        self.click_consumed = False  # set by main.py when toolbar eats the click

        # Auto-interact
        self.just_landed = False

        # Animation
        self.squish = 0.0
        self.idle_phase = 0.0
        self.blink_timer = 0.0

    def set_destination(self, dest_tx, dest_ty):
        """Set a click destination. Builds a simple path (straight lines, no A*)."""
        if not is_on_island(dest_tx, dest_ty):
            return
        if is_pond_tile(dest_tx, dest_ty):
            return
        if dest_tx == self.tx and dest_ty == self.ty:
            return

        # Build path: move horizontally first, then vertically
        # (Simple L-shaped path — good enough for an open island)
        path = []
        cx, cy = self.tx, self.ty

        # If currently hopping, start from the target
        if self.hopping:
            cx, cy = self.target_tx, self.target_ty

        # Horizontal leg
        dx = 1 if dest_tx > cx else -1
        while cx != dest_tx:
            cx += dx
            if is_on_island(cx, cy) and not is_pond_tile(cx, cy):
                path.append((cx, cy))
            else:
                # Blocked — try going around vertically first
                break

        # Vertical leg
        dy = 1 if dest_ty > cy else -1
        while cy != dest_ty:
            cy += dy
            if is_on_island(cx, cy) and not is_pond_tile(cx, cy):
                path.append((cx, cy))
            else:
                break

        # If we didn't reach dest_tx yet (went vertical first), finish horizontal
        if cx != dest_tx:
            dx = 1 if dest_tx > cx else -1
            while cx != dest_tx:
                cx += dx
                if is_on_island(cx, cy) and not is_pond_tile(cx, cy):
                    path.append((cx, cy))
                else:
                    break

        self.path = path

    def update(self, dt):
        """Update movement and animation. Returns (landed_tx, landed_ty) if just landed, else None."""
        landed = None

        if self.hopping:
            self.hop_timer += dt
            if self.hop_timer >= HOP_DURATION:
                # Landing
                self.tx = self.target_tx
                self.ty = self.target_ty
                self.hopping = False
                self.hop_timer = 0.0
                self.squish = -0.5
                self.just_landed = True
                self.path_pause = HOP_PAUSE
                landed = (self.tx, self.ty)
            else:
                progress = self.hop_timer / HOP_DURATION
                self.squish = math.sin(progress * math.pi) * 0.4
        else:
            self.just_landed = False
            self.squish *= 0.92
            if abs(self.squish) < 0.02:
                self.squish = 0.0

            # Idle breathing
            self.idle_phase += dt * 2.5
            if not self.path:
                self.squish = math.sin(self.idle_phase) * 0.08

            # Pause between path hops
            if self.path_pause > 0:
                self.path_pause -= dt
            else:
                # Try to continue path, or check keyboard
                if self.path:
                    self._hop_to(*self.path.pop(0))
                else:
                    self._handle_keyboard()

        # Click-to-move: check for mouse click on island
        if pyxel.btnp(pyxel.MOUSE_BUTTON_LEFT) and not self.click_consumed:
            tile = self._screen_to_tile(pyxel.mouse_x, pyxel.mouse_y)
            if tile:
                self.set_destination(*tile)
        self.click_consumed = False  # reset each frame

        self.blink_timer += dt
        return landed

    def _handle_keyboard(self):
        """Check WASD/arrow keys for direct control."""
        dx, dy = 0, 0
        if pyxel.btnp(pyxel.KEY_W) or pyxel.btnp(pyxel.KEY_UP):
            dy = -1
        elif pyxel.btnp(pyxel.KEY_S) or pyxel.btnp(pyxel.KEY_DOWN):
            dy = 1
        elif pyxel.btnp(pyxel.KEY_A) or pyxel.btnp(pyxel.KEY_LEFT):
            dx = -1
        elif pyxel.btnp(pyxel.KEY_D) or pyxel.btnp(pyxel.KEY_RIGHT):
            dx = 1

        if dx == 0 and dy == 0:
            return

        new_tx = self.tx + dx
        new_ty = self.ty + dy

        if not is_on_island(new_tx, new_ty) or is_pond_tile(new_tx, new_ty):
            return

        # Keyboard clears any click path
        self.path.clear()
        self._hop_to(new_tx, new_ty)

    def _hop_to(self, new_tx, new_ty):
        """Start a hop to an adjacent tile."""
        if new_tx > self.tx:
            self.facing = 1
        elif new_tx < self.tx:
            self.facing = -1

        self.target_tx = new_tx
        self.target_ty = new_ty
        self.hopping = True
        self.hop_timer = 0.0

    def _screen_to_tile(self, sx, sy):
        """Convert screen coords to tile coords, or None."""
        local_x = sx - ISLAND_X
        local_y = sy - ISLAND_Y
        tx = local_x // TILE_PX
        ty = local_y // TILE_PX
        if tx < 0 or tx >= ISLAND_SIZE or ty < 0 or ty >= ISLAND_SIZE:
            return None
        if not is_on_island(tx, ty):
            return None
        return (tx, ty)

    @property
    def screen_pos(self):
        """Get the slime's current screen position (interpolated during hops)."""
        if self.hopping:
            progress = self.hop_timer / HOP_DURATION
            cx = self.tx + (self.target_tx - self.tx) * progress
            cy = self.ty + (self.target_ty - self.ty) * progress
            arc = -math.sin(progress * math.pi) * HOP_HEIGHT
        else:
            cx = float(self.tx)
            cy = float(self.ty)
            arc = 0

        sx = ISLAND_X + cx * TILE_PX
        sy = ISLAND_Y + cy * TILE_PX + arc
        return (sx, sy)

    def draw(self):
        """Draw the slime — a cute green blob with eyes."""
        sx, sy = self.screen_pos

        base_w = 8
        base_h = 6
        w = base_w + int(self.squish * -3)
        h = base_h + int(self.squish * 4)
        draw_x = int(sx + (TILE_PX - w) / 2)
        draw_y = int(sy + TILE_PX - h)

        # Shadow
        if self.hopping:
            shadow_y = int(ISLAND_Y + self.ty * TILE_PX + TILE_PX - 1)
            progress = self.hop_timer / HOP_DURATION
            shadow_w = max(2, int(6 * (1 - math.sin(progress * math.pi) * 0.4)))
            shadow_x = int(ISLAND_X + (self.tx + (self.target_tx - self.tx) * progress) * TILE_PX + (TILE_PX - shadow_w) / 2)
            pyxel.rect(shadow_x, shadow_y, shadow_w, 1, COL_DGREEN)

        # Body
        pyxel.rect(draw_x + 1, draw_y, w - 2, h, COL_GREEN)
        pyxel.rect(draw_x, draw_y + 1, w, h - 2, COL_GREEN)
        pyxel.rect(draw_x + 2, draw_y + 1, w - 4, max(1, h // 3), COL_LGREEN)
        pyxel.rect(draw_x + 1, draw_y + h - 2, w - 2, 1, COL_DGREEN)

        # Eyes
        eye_y = draw_y + max(1, h // 3)
        is_blinking = (self.blink_timer % 4.0) < 0.15
        left_eye_x = draw_x + w // 2 - 2
        right_eye_x = draw_x + w // 2 + 1

        if is_blinking:
            pyxel.pset(left_eye_x, eye_y, COL_DARK)
            pyxel.pset(right_eye_x, eye_y, COL_DARK)
        else:
            pyxel.pset(left_eye_x, eye_y, COL_DARK)
            pyxel.pset(right_eye_x, eye_y, COL_DARK)
            pyxel.pset(left_eye_x, eye_y - 1, COL_WHITE)
            pyxel.pset(right_eye_x, eye_y - 1, COL_WHITE)

        # Cheeks
        cheek_y = eye_y + 1
        if not is_blinking and h > 4:
            pyxel.pset(draw_x + 1, cheek_y, COL_PINK)
            pyxel.pset(draw_x + w - 2, cheek_y, COL_PINK)

        # Path indicator — small dots showing where the slime is going
        if self.path:
            for i, (px, py) in enumerate(self.path[:6]):  # show max 6 dots
                dot_x = ISLAND_X + px * TILE_PX + TILE_PX // 2
                dot_y = ISLAND_Y + py * TILE_PX + TILE_PX // 2
                # Fade dots further in the path
                if (pyxel.frame_count // 10 + i) % 3 != 0:
                    pyxel.pset(dot_x, dot_y, COL_LGREEN)
