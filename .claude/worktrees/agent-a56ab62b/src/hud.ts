import { TOOL_COUNT, TOOLS, CROP_DEFS, CROP_IDS, CHANGELOG } from "./constants";
import {
  clockTime, clockDay, coins, wood,
  selectedTool, setSelectedTool, selectedSeed, setSelectedSeed,
} from "./state";
import { el } from "./utils";
import { sfxSelect } from "./audio";
import type { ToolbarSlot } from "./types";

// ── DOM References ────────────────────────────────────────
export const hud = el<HTMLDivElement>("hud");
export const overlay = el<HTMLDivElement>("overlay");
const hudTime = el<HTMLSpanElement>("hud-time");
const hudCoins = el<HTMLSpanElement>("hud-coins");
const hudWood = el<HTMLSpanElement>("hud-wood");
const toolbarEl = el<HTMLDivElement>("toolbar");
const changelogBtn = el<HTMLButtonElement>("changelog-btn");
const changelogPanel = el<HTMLDivElement>("changelog-panel");
const changelogEntries = el<HTMLDivElement>("changelog-entries");
const changelogClose = el<HTMLButtonElement>("changelog-close");
const dayClock = el<HTMLDivElement>("day-clock");

// ── Changelog ─────────────────────────────────────────────
function buildChangelog(): void {
  changelogEntries.textContent = "";
  for (const entry of CHANGELOG) {
    const div = document.createElement("div");
    div.className = "changelog-version";
    const h2 = document.createElement("h2");
    h2.textContent = entry.version;
    div.appendChild(h2);
    const date = document.createElement("div");
    date.className = "changelog-date";
    date.textContent = entry.date;
    div.appendChild(date);
    const ul = document.createElement("ul");
    for (const change of entry.changes) {
      const li = document.createElement("li");
      li.textContent = change;
      ul.appendChild(li);
    }
    div.appendChild(ul);
    changelogEntries.appendChild(div);
  }
}

changelogBtn.addEventListener("click", () => {
  buildChangelog();
  changelogPanel.classList.remove("hidden");
});

changelogClose.addEventListener("click", () => {
  changelogPanel.classList.add("hidden");
});

// ── Build toolbar slots once (click handlers persist) ─────
export const toolbarSlots: ToolbarSlot[] = [];

for (let i = 0; i < TOOL_COUNT; i++) {
  const tool = TOOLS[i]!;
  const div = document.createElement("div");
  div.className = "hotbar-slot";
  div.style.pointerEvents = "auto";
  div.style.cursor = "pointer";

  const keySpan = document.createElement("div");
  keySpan.className = "slot-key";
  keySpan.textContent = String(i + 1);
  div.appendChild(keySpan);

  const iconSpan = document.createElement("div");
  iconSpan.className = "slot-icon";
  iconSpan.style.fontSize = "18px";
  iconSpan.style.lineHeight = "1";
  iconSpan.style.padding = "2px 0";
  iconSpan.textContent = tool.icon;
  div.appendChild(iconSpan);

  const nameSpan = document.createElement("div");
  nameSpan.className = "slot-name";
  nameSpan.textContent = tool.label;
  div.appendChild(nameSpan);

  const idx = i;
  div.addEventListener("click", (e) => {
    e.stopPropagation();
    if (idx === selectedTool && tool.id === "seeds") {
      setSelectedSeed((selectedSeed + 1) % CROP_IDS.length);
    }
    setSelectedTool(idx);
    sfxSelect();
    updateHud();
  });
  if (tool.id === "seeds") {
    div.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedSeed((selectedSeed + 1) % CROP_IDS.length);
      setSelectedTool(idx);
      sfxSelect();
      updateHud();
    });
  }

  toolbarEl.appendChild(div);
  toolbarSlots.push({ div, icon: iconSpan, name: nameSpan });
}

// ── Day Clock ─────────────────────────────────────────────
function getTimePhase(hour: number): { icon: string; label: string; color: string } {
  if (hour < 1.5) return { icon: "\uD83C\uDF19", label: "Night", color: "#6a6aaa" };
  if (hour < 3) return { icon: "\uD83C\uDF05", label: "Dawn", color: "#d4705a" };
  if (hour < 5) return { icon: "\u2600\uFE0F", label: "Morning", color: "#f8d878" };
  if (hour < 18) return { icon: "\u2600\uFE0F", label: "Day", color: "#ffe066" };
  if (hour < 20) return { icon: "\u2600\uFE0F", label: "Afternoon", color: "#f8c040" };
  if (hour < 21.5) return { icon: "\uD83C\uDF07", label: "Sunset", color: "#e88040" };
  if (hour < 22.5) return { icon: "\uD83C\uDF06", label: "Dusk", color: "#8a3060" };
  return { icon: "\uD83C\uDF19", label: "Night", color: "#6a6aaa" };
}

function updateDayClock(): void {
  const hour = (clockTime / 3600) % 24;
  const phase = getTimePhase(hour);
  const progress = (hour / 24) * 100;

  dayClock.textContent = "";

  const icon = document.createElement("span");
  icon.className = "clock-icon";
  icon.textContent = phase.icon;
  dayClock.appendChild(icon);

  const bar = document.createElement("div");
  bar.className = "clock-bar";
  const fill = document.createElement("div");
  fill.className = "clock-fill";
  fill.style.width = `${progress}%`;
  fill.style.backgroundColor = phase.color;
  bar.appendChild(fill);
  dayClock.appendChild(bar);

  const label = document.createElement("span");
  label.className = "clock-label";
  label.textContent = phase.label;
  dayClock.appendChild(label);
}

// ── HUD Update ────────────────────────────────────────────
let hudPrevCoins = -1;
let hudPrevWood = -1;
let hudPrevTool = -1;
let hudPrevSeed = -1;
let hudPrevMinute = -1;

export function updateHud(): void {
  const totalHours = clockTime / 3600;
  const hours = Math.floor(totalHours) % 24;
  const minutes = Math.floor((totalHours % 1) * 60);

  // Only touch DOM when values actually changed
  if (minutes !== hudPrevMinute || clockDay !== hudPrevCoins) {
    hudTime.textContent = `Day ${clockDay} \u00b7 ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    hudPrevMinute = minutes;
  }
  if (coins !== hudPrevCoins || wood !== hudPrevWood) {
    hudCoins.textContent = `Coins ${coins}`;
    hudWood.textContent = `Wood ${wood}`;
    hudPrevCoins = coins;
    hudPrevWood = wood;
  }
  updateDayClock();

  // Only update toolbar when tool/seed selection changed
  if (selectedTool !== hudPrevTool || selectedSeed !== hudPrevSeed) {
    for (let i = 0; i < TOOL_COUNT; i++) {
      const slot = toolbarSlots[i];
      if (!slot) continue;
      const tool = TOOLS[i]!;
      slot.div.className = `hotbar-slot${i === selectedTool ? " active" : ""}`;
      if (tool.id === "seeds") {
        const seedDef = CROP_DEFS[CROP_IDS[selectedSeed]!];
        slot.icon.textContent = seedDef.icon;
        slot.name.textContent = seedDef.label;
      }
    }
    hudPrevTool = selectedTool;
    hudPrevSeed = selectedSeed;
  }
}
