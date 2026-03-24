# goals.py — Simple breadcrumb quest system
#
# A linear chain of small goals that guide early gameplay.
# Each goal has a description, a condition to check, and a reward.
# When one completes, the next unlocks. Shows as a small bubble on screen.
#
# Goals are intentionally simple — they're a tutorial disguised as quests.

from constants import COL_GOLD, COL_GREEN, COL_WHITE, COL_CREAM


class Goal:
    """A single goal/quest."""
    __slots__ = ("name", "description", "target", "progress", "reward_coins", "completed")

    def __init__(self, name, description, target, reward_coins=0):
        self.name = name
        self.description = description
        self.target = target         # number needed to complete
        self.progress = 0            # current count
        self.reward_coins = reward_coins
        self.completed = False

    def advance(self, amount=1):
        """Increment progress. Returns True if just completed."""
        if self.completed:
            return False
        self.progress += amount
        if self.progress >= self.target:
            self.progress = self.target
            self.completed = True
            return True
        return False

    @property
    def progress_text(self):
        return f"{self.progress}/{self.target}"


# The goal chain — each unlocks after the previous completes
GOAL_CHAIN = [
    # Early movement + farming
    ("first_till",    "Till some grass",         3,  0),
    ("first_harvest", "Harvest a crop",          1,  5),
    ("five_harvest",  "Harvest 5 crops",         5,  15),
    # Trees
    ("chop_tree",     "Chop down a tree",        1,  10),
    # Economy
    ("earn_coins",    "Earn 50 coins",           50, 10),
    # Eggs
    ("collect_eggs",  "Collect 3 eggs",          3,  10),
    # Bigger goals
    ("big_harvest",   "Harvest 20 crops",        20, 30),
    ("rich_farmer",   "Earn 200 coins",          200, 25),
    ("lumberjack",    "Collect 10 wood",         10, 20),
    # Late game
    ("mogul",         "Earn 500 coins",          500, 50),
    ("all_crops",     "Grow all 4 crop types",   4,  30),
]


class GoalSystem:
    """Manages the quest chain."""

    def __init__(self):
        self.goals = []
        for name, desc, target, reward in GOAL_CHAIN:
            self.goals.append(Goal(name, desc, target, reward))
        self.current_index = 0
        self.just_completed = None  # set for one frame when a goal completes
        self.completion_timer = 0.0  # for the celebration display

        # Track lifetime stats for goals that check totals
        self.total_harvests = 0
        self.total_coins_earned = 0
        self.total_wood = 0
        self.total_eggs = 0
        self.crop_types_grown = set()

    @property
    def current_goal(self):
        """The active goal, or None if all complete."""
        if self.current_index < len(self.goals):
            return self.goals[self.current_index]
        return None

    @property
    def all_done(self):
        return self.current_index >= len(self.goals)

    def on_event(self, event_type, game_state):
        """React to a game event. Call after each action.
        Returns coins rewarded if a goal just completed, 0 otherwise.
        """
        goal = self.current_goal
        if goal is None:
            return 0

        self.just_completed = None
        advanced = False

        if goal.name == "first_till" and event_type == "till":
            advanced = goal.advance()
        elif goal.name == "first_harvest" and event_type == "harvest":
            self.total_harvests += 1
            advanced = goal.advance()
        elif goal.name == "five_harvest" and event_type == "harvest":
            self.total_harvests += 1
            advanced = goal.advance()
        elif goal.name == "chop_tree" and event_type == "timber":
            advanced = goal.advance()
        elif goal.name == "earn_coins":
            goal.progress = min(game_state["coins"], goal.target)
            if goal.progress >= goal.target:
                advanced = not goal.completed
                goal.completed = True
        elif goal.name == "collect_eggs" and event_type == "collect_egg":
            self.total_eggs += 1
            advanced = goal.advance()
        elif goal.name == "big_harvest" and event_type == "harvest":
            self.total_harvests += 1
            advanced = goal.advance()
        elif goal.name == "rich_farmer":
            goal.progress = min(game_state["coins"], goal.target)
            if goal.progress >= goal.target:
                advanced = not goal.completed
                goal.completed = True
        elif goal.name == "lumberjack":
            goal.progress = min(game_state["wood"], goal.target)
            if goal.progress >= goal.target:
                advanced = not goal.completed
                goal.completed = True
        elif goal.name == "mogul":
            goal.progress = min(game_state["coins"], goal.target)
            if goal.progress >= goal.target:
                advanced = not goal.completed
                goal.completed = True
        elif goal.name == "all_crops" and event_type == "harvest":
            # Track unique crop types — caller should pass crop_type in event
            pass  # handled via track_crop_type below

        if advanced:
            self.just_completed = goal
            self.completion_timer = 2.5  # show for 2.5 seconds
            reward = goal.reward_coins
            self.current_index += 1
            return reward

        return 0

    def track_crop_type(self, crop_type):
        """Track a unique crop type being harvested (for 'all_crops' goal)."""
        self.crop_types_grown.add(crop_type)
        goal = self.current_goal
        if goal and goal.name == "all_crops":
            goal.progress = len(self.crop_types_grown)
            if goal.progress >= goal.target and not goal.completed:
                goal.completed = True
                self.just_completed = goal
                self.completion_timer = 2.5
                self.current_index += 1
                return goal.reward_coins
        return 0

    def update(self, dt, game_state):
        """Update timers and check passive goals (coins, wood)."""
        if self.completion_timer > 0:
            self.completion_timer -= dt

        # Check passive goals each frame
        goal = self.current_goal
        if goal and goal.name in ("earn_coins", "rich_farmer", "mogul"):
            self.on_event(None, game_state)
        if goal and goal.name == "lumberjack":
            self.on_event(None, game_state)
