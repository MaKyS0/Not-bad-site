// Explosives after HBM's charges and nukes. Conventional charges use the game's explosion;
// a nuclear blast carves its crater with fillBlocks over several ticks, burns the land around
// it into fallout and leaves a radiation zone behind.
import { world, system, BlockVolume, EntityDamageCause, Player } from "@minecraft/server";
import { addFallout } from "./fallout.js";
import { addRads } from "./radiation.js";

/** HBM's nukes reach 120+ blocks; these radii are scaled to what a phone can carve without freezing. */
const BOMBS = {
  "hbm:charge_semtex": { fuse: 3, power: 8 },
  "hbm:det_charge": { fuse: 3, power: 15 },
  "hbm:det_nuke": { fuse: 10, nuke: 40 },
};
const PROP_BOMBS = "hbm:bombs";
const UNBREAKABLE = ["minecraft:bedrock", "minecraft:barrier", "minecraft:end_portal_frame", "minecraft:command_block"];

const WOODS = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry"];
/**
 * Around a blast: [blocks, replacement]. Each group is one fill, and a fill with an id the game
 * does not know fails whole, so ids that differ between versions (leaves, short grass) get
 * their own group, including the older merged ids.
 * @type {[string[], string][]}
 */
const SCORCH = [
  [["minecraft:grass_block"], "hbm:waste_earth"],
  [WOODS.map((wood) => `minecraft:${wood}_log`), "hbm:waste_log"],
  ...[...WOODS, "azalea", "pale_oak"].map((wood) => /** @type {[string[], string]} */ ([[`minecraft:${wood}_leaves`], "minecraft:air"])),
  [["minecraft:leaves"], "minecraft:air"],
  [["minecraft:leaves2"], "minecraft:air"],
  [["minecraft:short_grass"], "minecraft:air"],
  [["minecraft:tallgrass"], "minecraft:air"],
  [["minecraft:tall_grass"], "minecraft:air"],
  [["minecraft:fern"], "minecraft:air"],
  [["minecraft:large_fern"], "minecraft:air"],
];

/** Bomb locations, polled for redstone power. @type {Set<string> | undefined} */
let placed;
/** Bombs already counting down. */
const armed = new Set();

const keyOf = (dim, { x, y, z }) => `${dim}|${x}|${y}|${z}`;
function parseKey(key) {
  const [dim, x, y, z] = key.split("|");
  return { dim, location: { x: Number(x), y: Number(y), z: Number(z) } };
}

function placedBombs() {
  if (!placed) {
    const raw = world.getDynamicProperty(PROP_BOMBS);
    try {
      placed = new Set(typeof raw === "string" ? JSON.parse(raw) : []);
    } catch {
      placed = new Set();
    }
  }
  return /** @type {Set<string>} */ (placed);
}

function savePlaced() {
  world.setDynamicProperty(PROP_BOMBS, JSON.stringify([...placedBombs()]));
}

function blockAt(dim, location) {
  try {
    return world.getDimension(dim).getBlock(location);
  } catch {
    return undefined;
  }
}

function playersNear(dim, center, radius) {
  return world.getAllPlayers().filter((p) => p.dimension.id === dim && Math.hypot(p.location.x - center.x, p.location.y - center.y, p.location.z - center.z) <= radius);
}

/** Starts the fuse; the charge goes off unless its block is gone by then. */
function arm(dim, location, type) {
  const key = keyOf(dim, location);
  if (armed.has(key)) return;
  armed.add(key);
  const { fuse } = BOMBS[type];
  for (const player of playersNear(dim, location, 32)) {
    player.sendMessage({ rawtext: [{ translate: "hbm.bomb.armed", with: [String(fuse)] }] });
  }
  for (let left = fuse; left > 0; left--) {
    system.runTimeout(() => {
      for (const player of playersNear(dim, location, 64)) {
        player.onScreenDisplay.setActionBar({ rawtext: [{ translate: "hbm.bomb.countdown", with: [String(left)] }] });
      }
    }, (fuse - left) * 20);
  }
  system.runTimeout(() => {
    armed.delete(key);
    const block = blockAt(dim, location);
    if (block?.typeId !== type) {
      for (const player of playersNear(dim, location, 32)) player.sendMessage({ translate: "hbm.bomb.defused" });
      return;
    }
    detonate(dim, location, type);
  }, fuse * 20);
}

function detonate(dim, location, type) {
  const dimension = world.getDimension(dim);
  placedBombs().delete(keyOf(dim, location));
  savePlaced();
  try {
    dimension.setBlockType(location, "minecraft:air");
  } catch {
    // the chunk unloaded during the fuse
  }
  const center = { x: location.x + 0.5, y: location.y + 0.5, z: location.z + 0.5 };
  const bomb = BOMBS[type];
  if (bomb.nuke) {
    nuke(dimension, center, bomb.nuke, { fallout: 20 });
  } else {
    dimension.createExplosion(center, bomb.power, { breaksBlocks: true, causesFire: false });
  }
}

/**
 * A nuclear blast of the given crater radius: flash, blast damage and radiation dose out to twice
 * the radius, a spherical crater, scorched land and a fallout zone of `fallout` RAD/s at the centre
 * reaching `falloutRadius` blocks (twice the crater radius unless given).
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {{x: number, y: number, z: number}} center
 */
export function nuke(dimension, center, radius, { fallout, falloutRadius = radius * 2 }) {
  const reach = radius * 2;
  for (const entity of dimension.getEntities({ location: center, maxDistance: reach })) {
    const closeness = 1 - Math.hypot(entity.location.x - center.x, entity.location.y - center.y, entity.location.z - center.z) / reach;
    try {
      entity.applyDamage(Math.ceil(120 * closeness), { cause: EntityDamageCause.blockExplosion });
      entity.setOnFire(Math.ceil(15 * closeness), true);
      if (entity instanceof Player) addRads(entity, 600 * closeness);
    } catch {
      // items, paintings and the like take no damage
    }
  }
  for (const player of playersNear(dimension.id, center, radius * 4)) {
    player.camera.fade({ fadeColor: { red: 1, green: 1, blue: 1 }, fadeTime: { fadeInTime: 0.1, holdTime: 0.6, fadeOutTime: 2.5 } });
    player.playSound("random.explode", { volume: 4, pitch: 0.5 });
    player.playSound("ambient.weather.thunder", { volume: 4, pitch: 0.6 });
  }
  mushroomCloud(dimension, center, radius);
  addFallout(dimension.id, center, falloutRadius, fallout);
  system.runJob(blastJob(dimension, center, radius));
}

function mushroomCloud(dimension, center, radius) {
  const spawn = (x, y, z) => {
    try {
      dimension.spawnParticle("minecraft:huge_explosion_emitter", { x, y, z });
    } catch {
      // out of loaded chunks
    }
  };
  for (let wave = 0; wave < 8; wave++) {
    system.runTimeout(() => {
      const top = center.y + (radius * (wave + 1)) / 8;
      for (let y = center.y; y < top; y += 4) spawn(center.x, y, center.z);
      const ring = radius / 3;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        spawn(center.x + Math.cos(a) * ring, top, center.z + Math.sin(a) * ring);
      }
    }, wave * 10);
  }
}

/** Carves the crater one row at a time, then scorches the land, yielding between fills. */
function* blastJob(dimension, center, radius) {
  const { min, max } = dimension.heightRange;
  const cx = Math.floor(center.x);
  const cy = Math.floor(center.y);
  const cz = Math.floor(center.z);
  const fill = (from, to, block, options) => {
    try {
      dimension.fillBlocks(new BlockVolume(from, to), block, { ignoreChunkBoundErrors: true, ...options });
    } catch {
      // unloaded or invalid area: skip it
    }
  };

  for (let dy = radius; dy >= -radius; dy--) {
    const y = cy + dy;
    if (y < min || y >= max) continue;
    const slice = Math.sqrt(radius * radius - dy * dy);
    for (let dx = -Math.floor(slice); dx <= Math.floor(slice); dx++) {
      const half = Math.floor(Math.sqrt(slice * slice - dx * dx));
      fill({ x: cx + dx, y, z: cz - half }, { x: cx + dx, y, z: cz + half }, "minecraft:air", { blockFilter: { excludeTypes: UNBREAKABLE } });
      yield;
    }
  }

  const reach = radius * 2;
  const bottom = Math.max(min, cy - 16);
  const top = Math.min(max - 1, cy + 40);
  for (let x = cx - reach; x < cx + reach; x += 16) {
    for (let z = cz - reach; z < cz + reach; z += 16) {
      if (Math.hypot(x + 8 - cx, z + 8 - cz) > reach + 8) continue;
      for (const [from, to] of SCORCH) {
        fill({ x, y: bottom, z }, { x: x + 15, y: top, z: z + 15 }, to, { blockFilter: { includeTypes: from } });
        yield;
      }
    }
  }
}

function hasRedstonePower(block) {
  if ((block.getRedstonePower() ?? 0) > 0) return true;
  for (const neighbour of [block.north(), block.south(), block.east(), block.west(), block.above(), block.below()]) {
    if ((neighbour?.getRedstonePower() ?? 0) > 0) return true;
  }
  return false;
}

export function startBombs() {
  world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { block } = event;
    if (!BOMBS[block.typeId] || event.itemStack?.typeId !== "minecraft:flint_and_steel") return;
    event.cancel = true;
    if (!event.isFirstEvent) return;
    const dim = block.dimension.id;
    const location = { x: block.location.x, y: block.location.y, z: block.location.z };
    const type = block.typeId;
    system.run(() => arm(dim, location, type));
  });

  world.afterEvents.playerPlaceBlock.subscribe(({ block }) => {
    if (!BOMBS[block.typeId]) return;
    placedBombs().add(keyOf(block.dimension.id, block.location));
    savePlaced();
  });

  world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation }) => {
    if (!BOMBS[brokenBlockPermutation.type.id]) return;
    placedBombs().delete(keyOf(block.dimension.id, block.location));
    savePlaced();
  });

  // Caught in another explosion: go off almost at once, like TNT.
  world.afterEvents.blockExplode.subscribe(({ block, dimension, explodedBlockPermutation }) => {
    const type = explodedBlockPermutation.type.id;
    if (!BOMBS[type]) return;
    const location = { x: block.location.x, y: block.location.y, z: block.location.z };
    const key = keyOf(dimension.id, location);
    if (armed.has(key)) return;
    armed.add(key);
    system.runTimeout(() => {
      armed.delete(key);
      detonate(dimension.id, location, type);
    }, 10);
  });

  system.runInterval(() => {
    for (const key of placedBombs()) {
      const { dim, location } = parseKey(key);
      const block = blockAt(dim, location);
      if (!block) continue;
      if (!BOMBS[block.typeId]) {
        placedBombs().delete(key);
        savePlaced();
        continue;
      }
      if (!armed.has(key) && hasRedstonePower(block)) arm(dim, location, block.typeId);
    }
  }, 10);
}
