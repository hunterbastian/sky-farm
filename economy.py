# economy.py — Shop, upgrades, and farm expansion
#
# Simple upgrade system tied to the goal chain.
# Unlocks: new crop types, island expansion, tool upgrades.

from constants import CROPS, COL_GOLD


# Items available in the shop (unlocked progressively)
SHOP_ITEMS = [
    {"name": "Island Ring 1",  "cost": 50,  "type": "expand", "desc": "Expand island by 1 ring"},
    {"name": "Island Ring 2",  "cost": 150, "type": "expand", "desc": "Expand island again"},
    {"name": "Island Ring 3",  "cost": 400, "type": "expand", "desc": "Full size island"},
    {"name": "Fast Growth",    "cost": 100, "type": "upgrade", "desc": "Crops grow 25% faster"},
    {"name": "Auto-Till",      "cost": 200, "type": "upgrade", "desc": "Slime auto-tills grass"},
    {"name": "Golden Eggs",    "cost": 300, "type": "upgrade", "desc": "Eggs worth 2x"},
]


class Economy:
    """Tracks purchased upgrades."""

    def __init__(self):
        self.purchased = set()  # names of purchased items
        self.growth_bonus = 1.0
        self.auto_till = False
        self.egg_multiplier = 1

    def can_afford(self, item_name, coins):
        """Check if player can buy an item."""
        for item in SHOP_ITEMS:
            if item["name"] == item_name:
                return coins >= item["cost"] and item_name not in self.purchased
        return False

    def buy(self, item_name, game_state):
        """Purchase an item. Returns True if successful."""
        for item in SHOP_ITEMS:
            if item["name"] == item_name and item_name not in self.purchased:
                if game_state["coins"] >= item["cost"]:
                    game_state["coins"] -= item["cost"]
                    self.purchased.add(item_name)
                    self._apply_upgrade(item)
                    return True
        return False

    def _apply_upgrade(self, item):
        """Apply the effect of a purchased upgrade."""
        if item["name"] == "Fast Growth":
            self.growth_bonus = 1.25
        elif item["name"] == "Auto-Till":
            self.auto_till = True
        elif item["name"] == "Golden Eggs":
            self.egg_multiplier = 2

    @property
    def island_level(self):
        """How many island expansions have been purchased (0-3)."""
        count = 0
        for i in range(1, 4):
            if f"Island Ring {i}" in self.purchased:
                count = i
        return count
