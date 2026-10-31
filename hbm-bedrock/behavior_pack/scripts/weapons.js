// Guns and grenades. Guns are hitscan: the first creature in the line of sight takes the hit.
// Grenades fly as thrown snowballs and go off where they land.
import { world, system, EntityDamageCause } from "@minecraft/server";
import { nuke } from "./bombs.js";

/** @type {Record<string, { ammo: string, damage: number, range: number, cooldownMs: number, particle: string, sound: string, pitch: number }>} */
const GUNS = {
  // B92 energy pistol: a red beam fed by redstone.
  "hbm:gun_b92": { ammo: "minecraft:redstone", damage: 16, range: 64, cooldownMs: 500, particle: "minecraft:redstone_wire_dust_particle", sound: "beacon.power", pitch: 2 },
  "hbm:gun_rifle": { ammo: "hbm:ammo_45", damage: 12, range: 96, cooldownMs: 700, particle: "minecraft:basic_smoke_particle", sound: "random.explode", pitch: 2 },
};

/** @type {Record<string, (dimension: import("@minecraft/server").Dimension, at: {x: number, y: number, z: number}) => void>} */
const GRENADES = {
  "hbm:grenade_he": (dimension, at) => dimension.createExplosion(at, 4.5, { breaksBlocks: true }),
  "hbm:grenade_nuclear": (dimension, at) => nuke(dimension, at, 8, { fallout: 10 }),
};

/** @type {Map<string, number>} player id -> time of the last shot */
const lastShot = new Map();
/** @type {Map<string, string>} snowball entity id -> grenade type */
const thrown = new Map();

/** Takes one of `id` from the player's inventory; false when there is none. */
function useAmmo(player, id) {
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return false;
  for (let i = 0; i < container.size; i++) {
    const stack = container.getItem(i);
    if (stack?.typeId !== id) continue;
    if (stack.amount > 1) {
      stack.amount -= 1;
      container.setItem(i, stack);
    } else {
      container.setItem(i, undefined);
    }
    return true;
  }
  return false;
}

function shoot(player, gun) {
  const now = Date.now();
  if (now - (lastShot.get(player.id) ?? 0) < gun.cooldownMs) return;
  if (!useAmmo(player, gun.ammo)) {
    player.onScreenDisplay.setActionBar({ translate: "hbm.gun.no_ammo" });
    return;
  }
  lastShot.set(player.id, now);

  const eye = player.getHeadLocation();
  const dir = player.getViewDirection();
  const wall = player.getBlockFromViewDirection({ maxDistance: gun.range });
  const wallDistance = wall ? Math.hypot(wall.block.location.x + 0.5 - eye.x, wall.block.location.y + 0.5 - eye.y, wall.block.location.z + 0.5 - eye.z) : gun.range;
  const hit = player.getEntitiesFromViewDirection({ maxDistance: Math.min(gun.range, wallDistance) })[0];
  const reach = hit ? hit.distance : wallDistance;

  player.dimension.playSound(gun.sound, player.location, { volume: 1, pitch: gun.pitch });
  for (let d = 1; d < reach; d += 1) {
    try {
      player.dimension.spawnParticle(gun.particle, { x: eye.x + dir.x * d, y: eye.y + dir.y * d, z: eye.z + dir.z * d });
    } catch {
      break;
    }
  }
  if (hit) {
    try {
      hit.entity.applyDamage(gun.damage, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
    } catch {
      // not a creature
    }
  }
}

function throwGrenade(player, type) {
  if (!useAmmo(player, type)) return;
  const eye = player.getHeadLocation();
  const dir = player.getViewDirection();
  const snowball = player.dimension.spawnEntity("minecraft:snowball", { x: eye.x + dir.x, y: eye.y + dir.y, z: eye.z + dir.z });
  const projectile = snowball.getComponent("minecraft:projectile");
  if (projectile) {
    projectile.owner = player;
    projectile.shoot({ x: dir.x * 1.4, y: dir.y * 1.4 + 0.1, z: dir.z * 1.4 });
  }
  thrown.set(snowball.id, type);
}

function explodeGrenade(projectile, dimension, location) {
  const type = thrown.get(projectile.id);
  if (!type) return;
  thrown.delete(projectile.id);
  try {
    projectile.remove();
  } catch {
    // already gone
  }
  system.run(() => GRENADES[type](dimension, location));
}

export function startWeapons() {
  world.afterEvents.itemUse.subscribe(({ itemStack, source }) => {
    const gun = GUNS[itemStack.typeId];
    if (gun) shoot(source, gun);
    else if (GRENADES[itemStack.typeId]) throwGrenade(source, itemStack.typeId);
  });
  world.afterEvents.projectileHitBlock.subscribe(({ projectile, dimension, location }) => explodeGrenade(projectile, dimension, location));
  world.afterEvents.projectileHitEntity.subscribe(({ projectile, dimension, location }) => explodeGrenade(projectile, dimension, location));
}
