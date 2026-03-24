import { ISLAND_SIZE, DAWN_SECONDS, SAVE_KEY } from "./constants";
import {
  tiles, crops, trees, mapleTrees, eggs,
  clockTime, setClockTime, clockDay, setClockDay,
  coins, setCoins, wood, setWood,
  selectedTool, setSelectedTool, selectedSeed, setSelectedSeed,
} from "./state";

export function saveGame(): void {
  const data = {
    version: 3,
    clockTime,
    clockDay,
    tiles: tiles.map((row) => [...row]),
    crops: crops.map((c) => ({ ...c })),
    trees: trees.map((t) => ({ ...t })),
    mapleTrees: mapleTrees.map((t) => ({ x: t.x, z: t.z, variant: t.variant, chopTime: t.chopTime, regrowTimer: t.regrowTimer })),
    coins,
    wood,
    selectedTool,
    selectedSeed,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function loadGame(): boolean {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (data.version !== 2 && data.version !== 3) return false;
    setClockTime(data.clockTime ?? DAWN_SECONDS);
    setClockDay(data.clockDay ?? 1);
    if (data.tiles) {
      for (let z = 0; z < ISLAND_SIZE; z++) {
        for (let x = 0; x < ISLAND_SIZE; x++) {
          tiles[z]![x] = data.tiles[z]?.[x] ?? "grass";
        }
      }
    }
    crops.length = 0;
    if (data.crops) {
      for (const c of data.crops) {
        crops.push({ ...c, growTimer: c.growTimer ?? 0 });
      }
    }
    setCoins(data.coins ?? 0);
    setWood(data.wood ?? 0);
    if (data.trees) {
      for (let i = 0; i < trees.length && i < data.trees.length; i++) {
        trees[i]!.chopTime = data.trees[i].chopTime ?? 0;
        trees[i]!.regrowTimer = data.trees[i].regrowTimer ?? 0;
      }
    }
    if (data.mapleTrees) {
      for (let i = 0; i < mapleTrees.length && i < data.mapleTrees.length; i++) {
        mapleTrees[i]!.chopTime = data.mapleTrees[i].chopTime ?? 0;
        mapleTrees[i]!.regrowTimer = data.mapleTrees[i].regrowTimer ?? 0;
      }
    }
    setSelectedTool(data.selectedTool ?? 0);
    setSelectedSeed(data.selectedSeed ?? 0);
    return true;
  } catch {
    return false;
  }
}

export function resetFarm(): void {
  localStorage.removeItem(SAVE_KEY);
  setClockTime(DAWN_SECONDS);
  setClockDay(1);
  setCoins(0);
  setWood(0);
  setSelectedTool(0);
  crops.length = 0;
  eggs.length = 0;
  for (let z = 0; z < ISLAND_SIZE; z++) {
    for (let x = 0; x < ISLAND_SIZE; x++) {
      tiles[z]![x] = "grass";
    }
  }
  for (const tree of trees) {
    tree.chopTime = 0;
    tree.regrowTimer = 0;
    tree.falling = false;
    tree.fallAngle = 0;
  }
  for (const mt of mapleTrees) {
    mt.chopTime = 0;
    mt.regrowTimer = 0;
    mt.falling = false;
    mt.fallAngle = 0;
  }
}
