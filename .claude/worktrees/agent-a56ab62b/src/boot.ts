import { overlay } from "./hud";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runBootSequence(): Promise<void> {
  const bootScreen = document.getElementById("boot-screen")!;
  const bootText = document.getElementById("boot-text")!;

  const lines = [
    "SkyFarm BIOS v1.03",
    "(C) 2003 Cloud Systems Inc.",
    "",
    "Detecting hardware... OK",
    "Memory Test: 640K OK",
    "Loading SkyFarm.exe...",
    "Tile Grid: 24x24 initialized",
    "Livestock: 4 chickens found",
    "Day/Night cycle: calibrated",
    "Wildflower seed: planted",
    "",
    "Starting Windows...",
  ];

  for (const line of lines) {
    bootText.textContent += line + "\n";
    await sleep(line === "" ? 150 : 180 + Math.random() * 120);
  }

  await sleep(600);
  bootScreen.classList.add("fade-out");
  await sleep(600);
  bootScreen.classList.add("gone");

  // Show title screen
  overlay.classList.remove("hidden");
  overlay.classList.add("visible");
}
