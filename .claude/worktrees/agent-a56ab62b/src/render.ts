import type { Graphics } from "pixi.js";
import { ISLAND_SIZE, TOOLS } from "./constants";
import {
  tiles, crops, trees, mapleTrees, chickens, hives,
  hoveredTile, selectedTool,
} from "./state";
import { isPondTile, isPenTile, drawGrassTile, drawFarmlandTile, drawIslandEdge, drawPondTile, drawHighlight } from "./tiles";
import { drawCrop } from "./crops";
import { drawChickenPen, drawChicken, drawEggs } from "./chickens";
import { drawTree, drawTreeStump, drawMapleTree, drawMapleStump, drawWoodchopper } from "./trees";
import { drawHiveAndBees, drawHoney } from "./bees";
import { drawWildflowers, initWildflowers } from "./wildflowers";
import {
  drawCloudShadows, drawSplashes, drawDirtPuffs, drawSeedPops,
  drawHarvestParts, drawWoodChips, drawSparkles, drawMotes,
  drawButterflies, drawLeafParticles, drawMapleLeaves, drawFloatingTexts,
} from "./particles";

export function renderWorld(groundGfx: Graphics, objectGfx: Graphics, uiGfx: Graphics): void {
  initWildflowers();
  groundGfx.clear();
  objectGfx.clear();
  uiGfx.clear();

  drawIslandEdge(groundGfx);

  for (let z = 0; z < ISLAND_SIZE; z++) {
    for (let x = 0; x < ISLAND_SIZE; x++) {
      if (isPondTile(x, z)) {
        drawPondTile(groundGfx, x, z);
        continue;
      }
      if (isPenTile(x, z)) continue; // pen draws its own ground
      const tile = tiles[z]?.[x];
      if (!tile) continue;
      switch (tile) {
        case "grass":
          drawGrassTile(groundGfx, x, z);
          break;
        case "farmland": {
          const crop = crops.find((c) => c.x === x && c.z === z);
          drawFarmlandTile(groundGfx, x, z, crop?.watered ?? false);
          break;
        }
      }
    }
  }

  drawChickenPen(groundGfx);
  drawCloudShadows(groundGfx);
  drawWildflowers(objectGfx);
  for (const crop of crops) drawCrop(objectGfx, crop);
  drawEggs(objectGfx);
  for (const tree of trees) drawTreeStump(objectGfx, tree);
  for (const tree of trees) drawTree(objectGfx, tree);
  for (const hive of hives) drawHiveAndBees(objectGfx, hive);
  drawHoney(objectGfx);
  for (const mt of mapleTrees) drawMapleStump(objectGfx, mt);
  for (const mt of mapleTrees) drawMapleTree(objectGfx, mt);
  drawMapleLeaves(objectGfx);
  drawLeafParticles(objectGfx);
  drawSplashes(objectGfx);
  drawDirtPuffs(objectGfx);
  drawSeedPops(objectGfx);
  drawHarvestParts(objectGfx);
  drawWoodChips(objectGfx);
  drawSparkles(objectGfx);
  for (const c of chickens) drawChicken(objectGfx, c);
  drawButterflies(objectGfx);
  drawMotes(objectGfx);
  drawFloatingTexts(objectGfx);

  if (hoveredTile && hoveredTile.x >= 0 && hoveredTile.x < ISLAND_SIZE && hoveredTile.z >= 0 && hoveredTile.z < ISLAND_SIZE) {
    drawHighlight(uiGfx, hoveredTile.x, hoveredTile.z);
    // Draw woodchopper when axe is selected
    if (TOOLS[selectedTool]!.id === "axe") {
      drawWoodchopper(objectGfx, hoveredTile.x, hoveredTile.z);
    }
  }
}
