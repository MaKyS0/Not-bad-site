// Fallout zones left by nuclear blasts and meltdowns: ambient radiation that fades with
// distance from the centre and halves every HALF_LIFE_MS of real time.
import { world } from "@minecraft/server";

const PROP_ZONES = "hbm:fallout";
const HALF_LIFE_MS = 10 * 60 * 1000;
const MIN_STRENGTH = 0.05;

/**
 * @typedef {{ dim: string, x: number, z: number, radius: number, strength: number, time: number }} Zone
 * @type {Zone[] | undefined}
 */
let zones;

function load() {
  if (zones) return zones;
  const raw = world.getDynamicProperty(PROP_ZONES);
  try {
    zones = typeof raw === "string" ? JSON.parse(raw) : [];
  } catch {
    zones = [];
  }
  return /** @type {Zone[]} */ (zones);
}

function save() {
  world.setDynamicProperty(PROP_ZONES, JSON.stringify(load()));
}

const strengthAt = (/** @type {Zone} */ zone, now) => zone.strength * Math.pow(0.5, (now - zone.time) / HALF_LIFE_MS);

/** @param {string} dim @param {{x: number, z: number}} center */
export function addFallout(dim, center, radius, strength) {
  load().push({ dim, x: Math.floor(center.x), z: Math.floor(center.z), radius, strength, time: Date.now() });
  save();
}

/** RAD per second the surroundings give at this spot, before armour. */
export function falloutRads(dim, location) {
  const now = Date.now();
  const all = load();
  const alive = all.filter((zone) => strengthAt(zone, now) >= MIN_STRENGTH);
  if (alive.length !== all.length) {
    zones = alive;
    save();
  }
  let rads = 0;
  for (const zone of alive) {
    if (zone.dim !== dim) continue;
    const distance = Math.hypot(location.x - zone.x, location.z - zone.z);
    if (distance < zone.radius) rads += strengthAt(zone, now) * (1 - distance / zone.radius);
  }
  return rads;
}
