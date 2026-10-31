// Missiles after HBM's launch pad: mark a target with the designator, load a missile into the
// pad and launch. The flight is shown as a smoke trail; on arrival the target area is kept loaded
// with a ticking area just long enough for the warhead to go off.
import { world, system } from "@minecraft/server";
import { nuke } from "./bombs.js";

const PROP_TARGET = "hbm:target";
const MAX_FLIGHT = 30; // seconds
const LOAD_WAIT = 15; // seconds to wait for the target chunks

/** @type {Record<string, (dimension: import("@minecraft/server").Dimension, at: {x: number, y: number, z: number}) => number>} warhead -> seconds its effects need loaded chunks */
export const MISSILES = {
  "hbm:missile_generic": (dimension, at) => {
    dimension.createExplosion(at, 15, { breaksBlocks: true, causesFire: false });
    return 2;
  },
  "hbm:missile_incendiary": (dimension, at) => {
    dimension.createExplosion(at, 10, { breaksBlocks: true, causesFire: true });
    return 2;
  },
  "hbm:missile_nuclear": (dimension, at) => {
    nuke(dimension, at, 40, { fallout: 20 });
    return 40;
  },
};

let launches = 0;

/** @returns {{ dim: string, x: number, y: number, z: number } | undefined} */
export function targetOf(player) {
  const raw = player.getDynamicProperty(PROP_TARGET);
  if (typeof raw !== "string") return undefined;
  try {
    const target = JSON.parse(raw);
    return target.dim === player.dimension.id ? target : undefined;
  } catch {
    return undefined;
  }
}

function smoke(dimension, at) {
  try {
    dimension.spawnParticle("minecraft:huge_explosion_emitter", at);
  } catch {
    // out of loaded chunks
  }
}

/**
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {{x: number, y: number, z: number}} pad
 * @param {{x: number, y: number, z: number}} target
 * @param {string} missile
 * @param {import("@minecraft/server").Player} player
 */
export function launchMissile(dimension, pad, target, missile, player) {
  const distance = Math.hypot(target.x - pad.x, target.z - pad.z);
  const flight = Math.min(MAX_FLIGHT, Math.ceil(3 + distance / 40));
  player.sendMessage({ translate: "hbm.missile.launched", with: [`${target.x} ${target.y} ${target.z}`, String(flight)] });
  dimension.playSound("random.explode", pad, { volume: 4, pitch: 0.6 });

  // Climb from the pad for the first three seconds.
  for (let i = 0; i < 15; i++) {
    system.runTimeout(() => smoke(dimension, { x: pad.x + 0.5, y: pad.y + 2 + i * 8, z: pad.z + 0.5 }), i * 4);
  }

  const area = `hbm_missile_${++launches}`;
  system.runTimeout(() => {
    try {
      dimension.runCommand(`tickingarea add circle ${target.x} ${target.y} ${target.z} 4 ${area} true`);
    } catch {
      // the target may already be loaded, or the world is out of ticking areas
    }
    let waited = 0;
    const wait = system.runInterval(() => {
      waited++;
      let ground;
      try {
        ground = dimension.getTopmostBlock({ x: target.x, z: target.z });
      } catch {
        ground = undefined;
      }
      if (!ground && waited < LOAD_WAIT) return;
      system.clearRun(wait);
      if (!ground) {
        player.sendMessage({ translate: "hbm.missile.lost" });
        release(dimension, area, 0);
        return;
      }
      const impact = { x: target.x + 0.5, y: ground.location.y + 1, z: target.z + 0.5 };
      for (let i = 0; i < 6; i++) smoke(dimension, { x: impact.x, y: impact.y + 60 - i * 10, z: impact.z });
      for (const p of world.getAllPlayers()) {
        if (p.dimension.id === dimension.id && Math.hypot(p.location.x - impact.x, p.location.z - impact.z) < 128) {
          p.onScreenDisplay.setActionBar({ translate: "hbm.missile.incoming" });
        }
      }
      system.runTimeout(() => release(dimension, area, MISSILES[missile](dimension, impact)), 20);
    }, 20);
  }, Math.max(1, flight - 2) * 20);
}

function release(dimension, area, afterSeconds) {
  system.runTimeout(() => {
    try {
      dimension.runCommand(`tickingarea remove ${area}`);
    } catch {
      // never added
    }
  }, afterSeconds * 20);
}

export function startMissiles() {
  world.afterEvents.itemUse.subscribe(({ itemStack, source }) => {
    if (itemStack.typeId !== "hbm:designator") return;
    const hit = source.getBlockFromViewDirection({ maxDistance: 256 });
    if (!hit) {
      source.sendMessage({ translate: "hbm.designator.miss" });
      return;
    }
    const { x, y, z } = hit.block.location;
    source.setDynamicProperty(PROP_TARGET, JSON.stringify({ dim: source.dimension.id, x, y, z }));
    source.sendMessage({ translate: "hbm.designator.set", with: [`${x} ${y} ${z}`] });
  });
}
