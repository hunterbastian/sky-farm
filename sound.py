# sound.py — All sound effects and music
#
# Pyxel sound API:
#   pyxel.sounds[n].set(notes, tones, volumes, effects, speed)
#   - notes: "c2d2e2" (C-B, octave 0-4, R=rest, #=sharp, -=flat)
#   - tones: T=triangle, S=square, P=pulse, N=noise
#   - volumes: "0"-"7" per note (7=loudest)
#   - effects: N=none, S=slide, V=vibrato, F=fadeout, H=half-fade, Q=quarter-fade
#   - speed: int (ticks per note, lower=faster)
#
# Channels 0-2 reserved for music, channel 3 for sound effects.
# Sound slots: 0-15 for SFX, 16-31 for music phrases.

import pyxel

# === Sound effect slot assignments ===
SFX_TILL      = 0
SFX_PLANT     = 1
SFX_WATER     = 2
SFX_CHOP      = 3
SFX_TIMBER    = 4
SFX_HARVEST   = 5
SFX_COIN      = 6
SFX_EGG       = 7
SFX_TOOL_SEL  = 8
SFX_ERROR     = 9
SFX_CONFIRM   = 10
SFX_DAWN      = 11
SFX_CHICKEN   = 12
SFX_SPLASH    = 13

# === Music phrase slots ===
MUS_DAY_MELODY  = 16
MUS_DAY_BASS    = 17
MUS_DAY_DRUMS   = 18
MUS_NIGHT_MELODY = 19
MUS_NIGHT_BASS   = 20
MUS_NIGHT_PAD    = 21

# Channel allocation
CH_SFX = 3     # sound effects always on channel 3
CH_MUSIC = 0   # music uses channels 0, 1, 2


def init_sounds():
    """Define all sound effects. Call once in App.__init__."""

    # --- Till (hoe hitting dirt) ---
    # Short thump + noise tail
    pyxel.sounds[SFX_TILL].set(
        "c1g0",       # low thump
        "sn",         # square then noise
        "64",         # loud start, softer tail
        "nf",         # none then fadeout
        6,            # fast
    )

    # --- Plant (seed dropping) ---
    # Rising chirp
    pyxel.sounds[SFX_PLANT].set(
        "c2e2g2",     # rising C-E-G
        "t",          # triangle (soft)
        "5",
        "n",
        8,
    )

    # --- Water splash ---
    # Noise swoosh + drip
    pyxel.sounds[SFX_WATER].set(
        "g3e3c3",     # descending drip
        "nnt",        # noise noise triangle
        "453",
        "fnf",
        7,
    )

    # --- Chop (axe hitting wood) ---
    # Sharp thunk
    pyxel.sounds[SFX_CHOP].set(
        "c1",         # low single hit
        "s",          # square
        "7",
        "f",          # quick fadeout
        4,
    )

    # --- Timber! (tree falling) ---
    # Descending crash
    pyxel.sounds[SFX_TIMBER].set(
        "g2e2c2g1c1", # descending
        "ssssn",      # square + noise crash
        "76543",
        "nnnff",
        10,
    )

    # --- Harvest (crop collected) ---
    # Happy ascending arpeggio
    pyxel.sounds[SFX_HARVEST].set(
        "c3e3g3c4",   # C major arpeggio up
        "s",          # square (bright)
        "6",
        "n",
        7,
    )

    # --- Coin collect ---
    # Classic 2-note ping
    pyxel.sounds[SFX_COIN].set(
        "a3e4",       # high ping
        "s",          # square
        "65",
        "nq",         # none then quarter-fade
        5,
    )

    # --- Egg collect ---
    # Soft rising boop
    pyxel.sounds[SFX_EGG].set(
        "e2g2",       # gentle rise
        "t",          # triangle (soft)
        "54",
        "nf",
        8,
    )

    # --- Tool select ---
    # Quick high click
    pyxel.sounds[SFX_TOOL_SEL].set(
        "c4",         # single high note
        "p",          # pulse
        "4",
        "f",
        3,
    )

    # --- Error ---
    # Low buzz
    pyxel.sounds[SFX_ERROR].set(
        "c1c1",
        "s",
        "5",
        "v",          # vibrato makes it buzzy
        6,
    )

    # --- Menu confirm ---
    # Bright chord
    pyxel.sounds[SFX_CONFIRM].set(
        "c3e3g3c4",
        "t",
        "6",
        "nnnq",
        6,
    )

    # --- Dawn chime (new day) ---
    # Gentle rising arpeggio, longer
    pyxel.sounds[SFX_DAWN].set(
        "g2c3e3g3 c4e4g4r",
        "t",
        "45566654",
        "nnnnvvff",
        15,
    )

    # --- Chicken cluck ---
    # Short noise bursts
    pyxel.sounds[SFX_CHICKEN].set(
        "g3rg3",
        "npn",
        "505",
        "fnf",
        5,
    )

    # --- Water splash (pond) ---
    pyxel.sounds[SFX_SPLASH].set(
        "c3g2c2",
        "nnt",
        "543",
        "fff",
        6,
    )


def init_music():
    """Define ambient music tracks. Call once in App.__init__.

    Design: slow, spacious, lots of rests. Triangle waves for warmth.
    Think Animal Crossing at 2am or Stardew Valley rain theme.
    """

    # === Day theme — warm ambient, C major pentatonic ===

    # Melody: sparse notes with long rests, triangle for softness
    pyxel.sounds[MUS_DAY_MELODY].set(
        "e2rr g2rr c3rr rrr "
        "d2rr g2rr e2rr rrr "
        "c2rr e2rr g2rr rrr "
        "g2rr e2rr c2rr rrr",
        "t",
        "3",
        "vnff vnff vnff vnff",
        35,
    )

    # Bass: slow root notes, very quiet
    pyxel.sounds[MUS_DAY_BASS].set(
        "c1rrr c1rrr g0rrr g0rrr "
        "a0rrr a0rrr c1rrr c1rrr",
        "t",
        "2",
        "vfff vfff vfff vfff",
        35,
    )

    # Shimmer: high soft notes, like wind chimes
    pyxel.sounds[MUS_DAY_DRUMS].set(
        "rrrr g3rr rrrr e3rr "
        "rrrr c3rr rrrr rrrr",
        "t",
        "2",
        "nnvf nnvf nnvf nnnn",
        35,
    )

    # === Night theme — dreamy, A minor, even more spacious ===

    # Melody: drifting notes with vibrato
    pyxel.sounds[MUS_NIGHT_MELODY].set(
        "e2rrr rrrr a1rrr rrrr "
        "c2rrr rrrr b1rrr rrrr "
        "a1rrr rrrr e2rrr rrrr "
        "d2rrr rrrr a1rrr rrrr",
        "t",
        "2",
        "vnff nnnn vnff nnnn",
        40,
    )

    # Bass: deep slow pulse
    pyxel.sounds[MUS_NIGHT_BASS].set(
        "a0rrrr a0rrrr g0rrrr g0rrrr "
        "a0rrrr a0rrrr e0rrrr a0rrrr",
        "t",
        "2",
        "vfff vfff vfff vfff",
        40,
    )

    # Pad: sustained soft chords, barely audible
    pyxel.sounds[MUS_NIGHT_PAD].set(
        "a1rr c2rr e2rr rrrr "
        "g1rr b1rr d2rr rrrr",
        "t",
        "1",
        "vvff vvff vvff nnnn",
        40,
    )

    # === Music slot 0: Day theme ===
    pyxel.musics[0].set(
        [MUS_DAY_MELODY],    # ch 0: sparse melody
        [MUS_DAY_BASS],      # ch 1: slow bass
        [MUS_DAY_DRUMS],     # ch 2: wind chime shimmer
        [],                  # ch 3: reserved for SFX
    )

    # === Music slot 1: Night theme ===
    pyxel.musics[1].set(
        [MUS_NIGHT_MELODY],  # ch 0: drifting melody
        [MUS_NIGHT_BASS],    # ch 1: deep pulse
        [MUS_NIGHT_PAD],     # ch 2: soft pad
        [],                  # ch 3: reserved for SFX
    )


# === Playback functions ===

def play_sfx(sfx_id):
    """Play a one-shot sound effect on the SFX channel."""
    pyxel.play(CH_SFX, sfx_id)


def play_day_music():
    """Start the day music loop."""
    pyxel.playm(0, loop=True)


def play_night_music():
    """Start the night music loop."""
    pyxel.playm(1, loop=True)


def stop_music():
    """Stop all music (channels 0-2). Leaves SFX channel alone."""
    pyxel.stop(0)
    pyxel.stop(1)
    pyxel.stop(2)


class MusicManager:
    """Handles music transitions based on time of day."""

    def __init__(self):
        self.current_track = None  # "day" or "night"
        self.started = False

    def update(self, hour):
        """Switch music based on time of day.

        Day music: 6am - 8pm
        Night music: 8pm - 6am
        """
        if 6 <= hour < 20:
            target = "day"
        else:
            target = "night"

        if target != self.current_track:
            self.current_track = target
            if target == "day":
                play_day_music()
            else:
                play_night_music()
