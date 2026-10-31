// Entry point: systems start once the world is loaded, when world state can be read.
import { world } from "@minecraft/server";
import { startRadiation } from "./radiation.js";
import { startMachines } from "./machines.js";
import { startBombs } from "./bombs.js";
import { startMissiles } from "./missiles.js";
import { startWeapons } from "./weapons.js";
import { startRecipeBook } from "./recipe_book.js";
import { startCrates } from "./crates.js";

world.afterEvents.worldLoad.subscribe(() => {
  startRadiation();
  startMachines();
  startBombs();
  startMissiles();
  startWeapons();
  startRecipeBook();
  startCrates();
});
