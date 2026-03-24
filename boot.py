# boot.py — Title/boot screen with SORATCHI word logo
#
# Frutiger Aero meets retro pixel art:
# - Large hand-drawn pixel letters with glossy top highlight
# - Soft sky gradient background
# - Floating bubbles/orbs (Aero touch)
# - Nature elements (leaf, cloud)
# - Fade in, hold, fade out to gameplay

import math
import random
import pyxel
from constants import (
    SCREEN_W, SCREEN_H,
    COL_DARK, COL_SKY, COL_DWATER,
    COL_DGREEN, COL_GREEN, COL_LGREEN,
    COL_GOLD, COL_WHITE, COL_CREAM, COL_PINK,
)

# Each letter is stored as a list of strings, where '#' = filled pixel.
# Letters are 5px wide, 7px tall — compact but readable at large scale.
FONT = {
    "S": [
        ".###.",
        "#....",
        "#....",
        ".###.",
        "....#",
        "....#",
        ".###.",
    ],
    "O": [
        ".###.",
        "#...#",
        "#...#",
        "#...#",
        "#...#",
        "#...#",
        ".###.",
    ],
    "R": [
        "####.",
        "#...#",
        "#...#",
        "####.",
        "#.#..",
        "#..#.",
        "#...#",
    ],
    "A": [
        ".###.",
        "#...#",
        "#...#",
        "#####",
        "#...#",
        "#...#",
        "#...#",
    ],
    "T": [
        "#####",
        "..#..",
        "..#..",
        "..#..",
        "..#..",
        "..#..",
        "..#..",
    ],
    "C": [
        ".###.",
        "#....",
        "#....",
        "#....",
        "#....",
        "#....",
        ".###.",
    ],
    "H": [
        "#...#",
        "#...#",
        "#...#",
        "#####",
        "#...#",
        "#...#",
        "#...#",
    ],
    "I": [
        ".###.",
        "..#..",
        "..#..",
        "..#..",
        "..#..",
        "..#..",
        ".###.",
    ],
}

LETTER_W = 5
LETTER_H = 7
LETTER_SPACING = 2  # px between letters
LETTER_SCALE = 2    # draw each pixel as 2x2 for chunky look

# Aero-style floating bubbles
class Bubble:
    __slots__ = ("x", "y", "r", "speed", "phase")
    def __init__(self):
        self.x = random.randint(10, SCREEN_W - 10)
        self.y = random.randint(SCREEN_H + 5, SCREEN_H + 40)
        self.r = random.randint(2, 5)
        self.speed = random.uniform(8, 18)
        self.phase = random.random() * math.pi * 2


class BootScreen:
    """Manages the title screen with SORATCHI logo."""

    def __init__(self):
        self.timer = 0.0
        self.phase = "fadein"    # fadein -> hold -> fadeout -> done
        self.fadein_dur = 1.0
        self.hold_dur = 2.5
        self.fadeout_dur = 0.8
        self.bubbles = [Bubble() for _ in range(12)]
        self.sparkle_timer = 0.0

    @property
    def done(self):
        return self.phase == "done"

    def update(self, dt):
        """Advance the boot screen. Returns True when finished."""
        self.timer += dt
        self.sparkle_timer += dt

        # Phase transitions
        if self.phase == "fadein" and self.timer >= self.fadein_dur:
            self.timer = 0.0
            self.phase = "hold"
        elif self.phase == "hold" and self.timer >= self.hold_dur:
            self.timer = 0.0
            self.phase = "fadeout"
        elif self.phase == "fadeout" and self.timer >= self.fadeout_dur:
            self.phase = "done"
            return True

        # Skip on any key
        if (pyxel.btnp(pyxel.MOUSE_BUTTON_LEFT) or
            pyxel.btnp(pyxel.KEY_RETURN) or
            pyxel.btnp(pyxel.KEY_SPACE)):
            self.phase = "done"
            return True

        # Update bubbles
        for b in self.bubbles:
            b.y -= b.speed * dt
            b.x += math.sin(b.phase + self.timer * 2) * 0.3
            if b.y < -10:
                b.y = SCREEN_H + random.randint(5, 20)
                b.x = random.randint(10, SCREEN_W - 10)

        return False

    def draw(self):
        """Draw the boot screen."""
        if self.phase == "done":
            return

        # === Background: soft gradient sky ===
        # Pyxel can't do gradients — we fake it with horizontal bands
        pyxel.cls(COL_DWATER)
        # Lighter band in the middle (where the logo is)
        pyxel.rect(0, 60, SCREEN_W, 120, COL_SKY)
        # Soft transition bands
        pyxel.dither(0.5)
        pyxel.rect(0, 50, SCREEN_W, 15, COL_SKY)
        pyxel.rect(0, 175, SCREEN_W, 15, COL_SKY)
        pyxel.dither(1.0)

        # === Floating bubbles (Frutiger Aero) ===
        for b in self.bubbles:
            bx, by = int(b.x), int(b.y)
            if by < -10 or by > SCREEN_H + 10:
                continue
            # Bubble: circle outline + highlight
            pyxel.circb(bx, by, b.r, COL_WHITE)
            # Glossy highlight dot (top-left of bubble)
            pyxel.pset(bx - 1, by - 1, COL_WHITE)
            # Subtle fill
            if b.r >= 3:
                pyxel.dither(0.3)
                pyxel.circ(bx, by, b.r - 1, COL_WHITE)
                pyxel.dither(1.0)

        # === SORATCHI logo ===
        word = "SORATCHI"
        total_w = len(word) * (LETTER_W * LETTER_SCALE + LETTER_SPACING) - LETTER_SPACING
        start_x = (SCREEN_W - total_w) // 2
        start_y = 85

        # Slight bounce during hold
        bounce = 0
        if self.phase == "hold":
            bounce = int(math.sin(self.timer * 3) * 1.5)

        cursor_x = start_x
        for i, ch in enumerate(word):
            if ch not in FONT:
                cursor_x += LETTER_W * LETTER_SCALE + LETTER_SPACING
                continue

            glyph = FONT[ch]
            # Per-letter wave offset
            letter_bounce = int(math.sin(self.timer * 4 + i * 0.6) * 1.5)
            ly = start_y + bounce + letter_bounce

            for row_idx, row in enumerate(glyph):
                for col_idx, pixel in enumerate(row):
                    if pixel == "#":
                        px = cursor_x + col_idx * LETTER_SCALE
                        py = ly + row_idx * LETTER_SCALE

                        # Frutiger Aero glossy effect:
                        # Top 2 rows = light green (gloss highlight)
                        # Middle rows = bright green
                        # Bottom 2 rows = dark green (shadow)
                        if row_idx <= 1:
                            color = COL_LGREEN
                        elif row_idx >= 5:
                            color = COL_DGREEN
                        else:
                            color = COL_GREEN

                        # Draw 2x2 pixel block
                        pyxel.rect(px, py, LETTER_SCALE, LETTER_SCALE, color)

            cursor_x += LETTER_W * LETTER_SCALE + LETTER_SPACING

        # === Sparkle accents on the glossy letters ===
        if self.phase in ("hold", "fadein"):
            spark_idx = int(self.sparkle_timer * 4) % len(word)
            spark_x = start_x + spark_idx * (LETTER_W * LETTER_SCALE + LETTER_SPACING) + 3
            spark_y = start_y + bounce + 2
            pyxel.pset(spark_x, spark_y, COL_WHITE)
            pyxel.pset(spark_x + 1, spark_y - 1, COL_WHITE)

        # === Subtitle ===
        sub = "Sky Farm"
        sub_x = (SCREEN_W - len(sub) * 4) // 2
        sub_y = start_y + LETTER_H * LETTER_SCALE + 12
        pyxel.text(sub_x + 1, sub_y + 1, sub, COL_DGREEN)
        pyxel.text(sub_x, sub_y, sub, COL_CREAM)

        # === "Press any key" (during hold) ===
        if self.phase == "hold":
            if int(self.timer * 2) % 2 == 0:
                prompt = "- press any key -"
                prompt_x = (SCREEN_W - len(prompt) * 4) // 2
                pyxel.text(prompt_x, SCREEN_H - 30, prompt, COL_WHITE)

        # === Fade overlay ===
        if self.phase == "fadein":
            alpha = 1.0 - (self.timer / self.fadein_dur)
            pyxel.dither(alpha)
            pyxel.rect(0, 0, SCREEN_W, SCREEN_H, COL_DARK)
            pyxel.dither(1.0)
        elif self.phase == "fadeout":
            alpha = self.timer / self.fadeout_dur
            pyxel.dither(alpha)
            pyxel.rect(0, 0, SCREEN_W, SCREEN_H, COL_DARK)
            pyxel.dither(1.0)
