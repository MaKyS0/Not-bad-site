// Entry point: systems start once the world is loaded, when world state can be read.
import { world } from "@minecraft/server";
import { startRadiation } from "./radiation.js";
import { startMachines } from "./machines.js";
import { startBombs } from "./bombs.js";

world.afterEvents.worldLoad.subscribe(() => {
  startRadiation();
  startMachines();
  startBombs();
});
