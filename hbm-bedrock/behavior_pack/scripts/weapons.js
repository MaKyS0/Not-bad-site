// Guns and grenades. Guns are hitscan: the first creature in the line of sight takes the hit.
// Grenades fly as thrown snowballs and go off where they land.
import { world, system, EntityDamageCause } from "@minecraft/server";
import { nuke } from "./bombs.js";
import { IMPORTED_GUNS, IMPORTED_GRENADES, KNOWN_ITEMS } from "./imported_machines.js";

/**
 * @typedef {{ ammo?: string, damage: number, range: number, cooldownMs: number, particle: string, sound: string, pitch: number,
 *   pellets?: number, fire?: number, freeze?: boolean, explode?: number }} Gun
 * @type {Record<string, Gun>}
 */
const GUNS = {
  // B92 energy pistol: a red beam fed by redstone.
  "hbm:gun_b92": { ammo: "minecraft:redstone", damage: 16, range: 64, cooldownMs: 500, particle: "minecraft:redstone_wire_dust_particle", sound: "beacon.power", pitch: 2 },
  "hbm:gun_rifle": { ammo: "hbm:ammo_45", damage: 12, range: 96, cooldownMs: 700, particle: "minecraft:basic_smoke_particle", sound: "random.explode", pitch: 2 },
};

// HBM's own guns, from the import. Ammo is the gun's own "<gun>_ammo" item when HBM has one.
const BULLET = { particle: "minecraft:basic_smoke_particle", sound: "random.explode", pitch: 2 };
const ENERGY = { particle: "minecraft:electric_spark_particle", sound: "beacon.power", pitch: 2 };
/** @type {Record<string, Partial<Gun>>} */
const IMPORTED_GUN_STATS = {
  "hbm:gun_b93": { damage: 30, range: 96, cooldownMs: 400, ...ENERGY },
  "hbm:gun_spark": { damage: 20, range: 48, cooldownMs: 600, ...ENERGY },
  "hbm:gun_hp": { damage: 14, range: 48, cooldownMs: 300, ...ENERGY },
  "hbm:gun_defabricator": { damage: 40, range: 32, cooldownMs: 1500, ...ENERGY },
  "hbm:gun_euthanasia": { damage: 24, range: 64, cooldownMs: 500, ...ENERGY },
  "hbm:gun_stinger": { damage: 15, range: 96, cooldownMs: 2000, explode: 3, ...BULLET },
  "hbm:gun_skystinger": { damage: 20, range: 128, cooldownMs: 1500, explode: 4, ...BULLET },
  "hbm:gun_cryolator": { damage: 4, range: 16, cooldownMs: 150, freeze: true, particle: "minecraft:snowflake_particle", sound: "random.fizz", pitch: 1.5 },
  "hbm:gun_jack": { damage: 6, range: 24, cooldownMs: 900, pellets: 6, ...BULLET },
  "hbm:gun_immolator": { damage: 3, range: 12, cooldownMs: 100, fire: 6, particle: "minecraft:basic_flame_particle", sound: "fire.ignite", pitch: 1 },
  "hbm:gun_super_shotgun": { damage: 5, range: 24, cooldownMs: 1200, pellets: 10, ...BULLET },
  "hbm:gun_revolver_inverted": { damage: 15, range: 64, cooldownMs: 700, ...BULLET },
  "hbm:gun_lever_action_sonata": { damage: 16, range: 96, cooldownMs: 900, ...BULLET },
  "hbm:gun_bolt_action_saturnite": { damage: 30, range: 128, cooldownMs: 1500, ...BULLET },
  "hbm:gun_folly": { damage: 100, range: 128, cooldownMs: 5000, explode: 8, ...ENERGY },
  "hbm:gun_dampfmaschine": { damage: 8, range: 32, cooldownMs: 300, ...BULLET },
};
for (const id of IMPORTED_GUNS) {
  const ammo = KNOWN_ITEMS.has(`${id}_ammo`) ? `${id}_ammo` : undefined;
  GUNS[id] ??= { damage: 10, range: 64, cooldownMs: 600, ...BULLET, ...IMPORTED_GUN_STATS[id], ammo };
}

/** @type {Record<string, (dimension: import("@minecraft/server").Dimension, at: {x: number, y: number, z: number}) => void>} */
const GRENADES = {
  "hbm:grenade_he": (dimension, at) => dimension.createExplosion(at, 4.5, { breaksBlocks: true }),
  "hbm:grenade_nuclear": (dimension, at) => nuke(dimension, at, 8, { fallout: 10 }),
};

for (const id of IMPORTED_GRENADES) {
  if (GRENADES[id]) continue;
  if (/nuclear|nuke|schrabidium|mk2|zomg|black_hole/.test(id)) GRENADES[id] = (dimension, at) => nuke(dimension, at, 6, { fallout: 8 });
  else if (/fire|napalm|phosphorus|incendiary/.test(id)) GRENADES[id] = (dimension, at) => dimension.createExplosion(at, 2.5, { breaksBlocks: false, causesFire: true });
  else if (/strong|cluster|lemon|frag|gascan/.test(id)) GRENADES[id] = (dimension, at) => dimension.createExplosion(at, 5.5, { breaksBlocks: true });
  else GRENADES[id] = (dimension, at) => dimension.createExplosion(at, 3.5, { breaksBlocks: true });
}

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
  if (gun.ammo && !useAmmo(player, gun.ammo)) {
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
      hit.entity.applyDamage(gun.damage * (gun.pellets ?? 1), { cause: EntityDamageCause.entityAttack, damagingEntity: player });
      if (gun.fire) hit.entity.setOnFire(gun.fire, true);
      if (gun.freeze) hit.entity.addEffect("slowness", 100, { amplifier: 4 });
    } catch {
      // not a creature
    }
  }
  if (gun.explode) {
    const at = { x: eye.x + dir.x * reach, y: eye.y + dir.y * reach, z: eye.z + dir.z * reach };
    player.dimension.createExplosion(at, gun.explode, { breaksBlocks: true, source: player });
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
