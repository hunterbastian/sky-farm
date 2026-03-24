# pet.py — A tiny white cat that follows the slime
#
# The cat follows the player with a lazy delay — it remembers
# where the slime has been and walks there a few steps behind.
# When idle, it sits, grooms, or naps.

import math
import random
import pyxel
from constants import (
    TILE_PX, ISLAND_X, ISLAND_Y,
    COL_DARK, COL_WHITE, COL_CREAM, COL_PINK, COL_LGREEN,
)

# Cat states
CAT_FOLLOW = "follow"
CAT_SIT = "sit"
CAT_GROOM = "groom"
CAT_NAP = "nap"

FOLLOW_DELAY = 3       # how many tiles behind the player the cat stays
FOLLOW_SPEED = 0.25    # seconds per tile hop (lazier than the slime)


class Pet:
    """A tiny white cat that follows the slime."""

    def __init__(self, start_x=11, start_y=12):
        self.tx = float(start_x)
        self.ty = float(start_y)
        self.target_tx = start_x
        self.target_ty = start_y
        self.state = CAT_SIT
        self.facing = 1          # 1=right, -1=left

        # Movement
        self.hopping = False
        self.hop_timer = 0.0
        self.hop_from_x = float(start_x)
        self.hop_from_y = float(start_y)

        # Trail: list of (tx, ty) positions the player has visited
        self.player_trail = []

        # Idle behavior
        self.idle_timer = 0.0
        self.idle_state_timer = random.uniform(3.0, 6.0)

        # Animation
        self.tail_phase = 0.0
        self.blink_timer = random.uniform(2.0, 5.0)
        self.ear_twitch = 0.0

    def record_player_pos(self, px, py):
        """Record where the player just moved to. Called each time slime lands."""
        # Avoid duplicates
        if not self.player_trail or self.player_trail[-1] != (px, py):
            self.player_trail.append((px, py))
        # Keep trail manageable
        if len(self.player_trail) > 50:
            self.player_trail = self.player_trail[-30:]

    def update(self, dt):
        """Update cat behavior."""
        self.tail_phase += dt * 3
        self.blink_timer -= dt
        if self.blink_timer <= 0:
            self.blink_timer = random.uniform(2.5, 5.0)
        self.ear_twitch -= dt

        if self.hopping:
            self.hop_timer += dt
            progress = min(self.hop_timer / FOLLOW_SPEED, 1.0)
            self.tx = self.hop_from_x + (self.target_tx - self.hop_from_x) * progress
            self.ty = self.hop_from_y + (self.target_ty - self.hop_from_y) * progress

            if progress >= 1.0:
                self.tx = float(self.target_tx)
                self.ty = float(self.target_ty)
                self.hopping = False
                self.hop_timer = 0.0
            return

        # Check if we should follow
        if len(self.player_trail) >= FOLLOW_DELAY:
            # Target is FOLLOW_DELAY steps behind the player
            target = self.player_trail[0]
            dist = abs(target[0] - int(self.tx)) + abs(target[1] - int(self.ty))

            if dist >= 1:
                # Start moving toward oldest trail point
                self.target_tx = target[0]
                self.target_ty = target[1]
                self.hop_from_x = self.tx
                self.hop_from_y = self.ty
                self.hopping = True
                self.hop_timer = 0.0
                self.state = CAT_FOLLOW

                # Set facing direction
                if self.target_tx > self.tx:
                    self.facing = 1
                elif self.target_tx < self.tx:
                    self.facing = -1

                # Consume the trail point
                self.player_trail.pop(0)
                return

        # Idle behavior when not following
        self.idle_timer += dt
        if self.idle_timer >= self.idle_state_timer:
            self.idle_timer = 0.0
            self.idle_state_timer = random.uniform(3.0, 8.0)
            self.state = random.choices(
                [CAT_SIT, CAT_GROOM, CAT_NAP],
                [3, 2, 1]
            )[0]
            self.ear_twitch = 0.3

    def draw(self):
        """Draw the cat — a tiny white pixel sprite."""
        sx = ISLAND_X + self.tx * TILE_PX
        sy = ISLAND_Y + self.ty * TILE_PX

        # Hop arc
        if self.hopping:
            progress = self.hop_timer / FOLLOW_SPEED
            arc = -math.sin(progress * math.pi) * 3
            sy += arc

        ix = int(sx)
        iy = int(sy)

        is_blinking = self.blink_timer < 0.12

        if self.state == CAT_NAP:
            # Napping: flat curled shape
            pyxel.rect(ix, iy + 4, 5, 3, COL_WHITE)
            pyxel.pset(ix + 1, iy + 3, COL_WHITE)  # head
            # Closed eyes
            pyxel.pset(ix + 1, iy + 4, COL_DARK)
            # Zzz
            if int(self.tail_phase) % 3 == 0:
                pyxel.text(ix + 5, iy, "z", COL_CREAM)
            return

        if self.state == CAT_GROOM:
            # Grooming: head turned, licking paw
            pyxel.rect(ix + 1, iy + 2, 4, 4, COL_WHITE)  # body
            pyxel.pset(ix + 1, iy + 1, COL_WHITE)  # head
            pyxel.pset(ix + 2, iy + 1, COL_WHITE)
            # Paw up
            pyxel.pset(ix, iy + 4, COL_WHITE)
            # Tongue
            if int(self.tail_phase * 2) % 2 == 0:
                pyxel.pset(ix, iy + 3, COL_PINK)
            # Eyes
            pyxel.pset(ix + 1, iy + 2, COL_DARK)
            return

        # Standing/sitting/following
        # Body (4x3 white block)
        pyxel.rect(ix + 1, iy + 3, 4, 3, COL_WHITE)

        # Head (2x2 on top)
        if self.facing > 0:
            pyxel.rect(ix + 3, iy + 1, 3, 3, COL_WHITE)
            # Ears
            pyxel.pset(ix + 3, iy, COL_WHITE)
            pyxel.pset(ix + 5, iy, COL_WHITE)
            # Inner ear
            pyxel.pset(ix + 4, iy, COL_PINK)
            # Eyes
            if not is_blinking:
                pyxel.pset(ix + 4, iy + 2, COL_DARK)
                pyxel.pset(ix + 5, iy + 2, COL_DARK)
            else:
                pyxel.pset(ix + 4, iy + 2, COL_CREAM)
            # Nose
            pyxel.pset(ix + 5, iy + 3, COL_PINK)
        else:
            pyxel.rect(ix, iy + 1, 3, 3, COL_WHITE)
            pyxel.pset(ix, iy, COL_WHITE)
            pyxel.pset(ix + 2, iy, COL_WHITE)
            pyxel.pset(ix + 1, iy, COL_PINK)
            if not is_blinking:
                pyxel.pset(ix, iy + 2, COL_DARK)
                pyxel.pset(ix + 1, iy + 2, COL_DARK)
            else:
                pyxel.pset(ix + 1, iy + 2, COL_CREAM)
            pyxel.pset(ix, iy + 3, COL_PINK)

        # Legs
        pyxel.pset(ix + 1, iy + 6, COL_WHITE)
        pyxel.pset(ix + 4, iy + 6, COL_WHITE)

        # Tail (wavy)
        tail_offset = int(math.sin(self.tail_phase) * 1.5)
        if self.facing > 0:
            pyxel.pset(ix, iy + 4 + tail_offset, COL_WHITE)
            pyxel.pset(ix - 1, iy + 3 + tail_offset, COL_WHITE)
        else:
            pyxel.pset(ix + 5, iy + 4 + tail_offset, COL_WHITE)
            pyxel.pset(ix + 6, iy + 3 + tail_offset, COL_WHITE)
