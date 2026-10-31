// RBMK channels, after HBM's RBMK. A fuel channel sends neutron flux along the four horizontal
// directions; other fuel channels on the way pick up a share of it, control channels absorb it
// as far as their rods are inserted and graphite moderators strengthen it. Flux makes heat, heat
// spreads between neighbouring channels, and boiler channels turn it into steam for turbines.

export const RBMK = {
  FUEL: "hbm:rbmk_fuel",
  CONTROL: "hbm:rbmk_control",
  BOILER: "hbm:rbmk_boiler",
  MODERATOR: "hbm:rbmk_moderator",
  BLANK: "hbm:rbmk_blank",
};
export const RBMK_TYPES = new Set(Object.values(RBMK));

const BEAM_RANGE = 4;
const BEAM_SHARE = 0.25;
const MODERATION = 1.25;
const SELF_FLUX = 1;
const MAX_FLUX = 1000;
const HEAT_PER_FLUX = 5; // °C per second
const CONDUCTION = 0.1; // share of the difference that moves to each neighbour per second
const HEAT_LOSS = 0.01;
const AMBIENT = 20;
const BOILING = 100;
const BOIL_RATE = 0.5; // share of the heat above boiling a boiler takes per second
const STEAM_PER_DEGREE = 10; // mB of water boiled per °C taken
const TANK = 16_000;

/** Flux-seconds a fuel assembly lasts. */
export const ROD_LIFE = 20_000;
export const RBMK_OVERHEAT = 1200;
export const RBMK_MELTDOWN = 1500;

const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * One second of all loaded channels. Flux and heat are worked out from last second's state
 * for every channel first, then applied, so the order of channels does not matter.
 * @param {import("./machines.js").Machine[]} columns
 * @param {(dim: string, x: number, y: number, z: number) => import("./machines.js").Machine | undefined} machineAt
 * @param {(dim: string, x: number, y: number, z: number) => string | undefined} typeAt
 */
export function runRbmk(columns, machineAt, typeAt) {
  /** @type {Map<import("./machines.js").Machine, number>} */
  const flux = new Map();
  for (const m of columns) {
    if (m.type !== RBMK.FUEL) continue;
    if (!m.input) {
      flux.set(m, 0);
      continue;
    }
    let incoming = 0;
    for (const [dx, dz] of DIRECTIONS) {
      let strength = 1;
      for (let step = 1; step <= BEAM_RANGE && strength > 0; step++) {
        const x = m.x + dx * step;
        const z = m.z + dz * step;
        const type = typeAt(m.dim, x, m.y, z);
        if (type === RBMK.CONTROL) {
          strength *= 1 - (machineAt(m.dim, x, m.y, z)?.control ?? 100) / 100;
        } else if (type === RBMK.MODERATOR) {
          strength *= MODERATION;
        } else if (type === RBMK.FUEL) {
          incoming += strength * BEAM_SHARE * (machineAt(m.dim, x, m.y, z)?.flux ?? 0);
        } else if (type !== RBMK.BOILER && type !== RBMK.BLANK) {
          break;
        }
      }
    }
    flux.set(m, Math.min(MAX_FLUX, incoming + SELF_FLUX));
  }

  /** @type {Map<import("./machines.js").Machine, number>} */
  const heatChange = new Map();
  for (const m of columns) {
    const heat = m.heat ?? AMBIENT;
    let change = (flux.get(m) ?? 0) * HEAT_PER_FLUX - (heat - AMBIENT) * HEAT_LOSS;
    for (const [dx, dz] of DIRECTIONS) {
      const neighbour = machineAt(m.dim, m.x + dx, m.y, m.z + dz);
      if (neighbour && RBMK_TYPES.has(neighbour.type)) change += ((neighbour.heat ?? AMBIENT) - heat) * CONDUCTION;
    }
    heatChange.set(m, change);
  }

  for (const m of columns) {
    m.heat = Math.max(AMBIENT, (m.heat ?? AMBIENT) + (heatChange.get(m) ?? 0));
    if (m.type === RBMK.FUEL) {
      m.flux = flux.get(m) ?? 0;
      if (m.input) {
        m.burnup = (m.burnup ?? 0) + m.flux;
        if (m.burnup >= ROD_LIFE) {
          m.input = undefined;
          m.burnup = 0;
          m.output = { id: "hbm:rbmk_fuel_depleted", n: (m.output?.n ?? 0) + 1 };
        }
      }
    }
    if (m.type === RBMK.BOILER && m.heat > BOILING) {
      const water = m.tanks?.water ?? 0;
      const steam = m.tanks?.steam ?? 0;
      const degrees = Math.min((m.heat - BOILING) * BOIL_RATE, water / STEAM_PER_DEGREE, (TANK - steam) / STEAM_PER_DEGREE);
      if (degrees > 0) {
        m.heat -= degrees;
        m.tanks = { ...m.tanks, water: water - degrees * STEAM_PER_DEGREE, steam: steam + degrees * STEAM_PER_DEGREE };
      }
    }
  }
}
