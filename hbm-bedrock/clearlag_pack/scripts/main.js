// ClearLag for Bedrock, after the ClearLagg server plugin: on a timer it removes dropped items,
// XP orbs and arrows from loaded chunks, warning players first, and reports TPS on request.
// Bedrock add-ons cannot touch rendering, so this lowers server load, not the client's FPS.
import { world, system, EntityInitializationCause, Player } from "@minecraft/server";

const DIMENSIONS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
const CLEARED = ["minecraft:item", "minecraft:xp_orb", "minecraft:arrow"];
const WARNINGS = [60, 30, 10, 5];
/** Items dropped less than this long ago survive a clear, so a fresh death drop is not wiped. */
const GRACE_MS = 60_000;
const MIN_INTERVAL = 30;
const DEFAULT_INTERVAL = 300;
const PROP_INTERVAL = "clearlag:interval";
const PREFIX = "§6[ClearLag]§r ";

let interval = DEFAULT_INTERVAL;
let secondsLeft = DEFAULT_INTERVAL;
/** @type {Map<string, number>} entity id -> time it was dropped */
const droppedAt = new Map();
/** @type {number[]} wall-clock time of the last ticks, for TPS */
const tickTimes = [];

function tps() {
  if (tickTimes.length < 2) return 20;
  const seconds = (tickTimes[tickTimes.length - 1] - tickTimes[0]) / 1000;
  return Math.min(20, (tickTimes.length - 1) / seconds);
}

function forget(now) {
  for (const [id, time] of droppedAt) if (now - time >= GRACE_MS) droppedAt.delete(id);
}

function clear() {
  const now = Date.now();
  let removed = 0;
  let kept = 0;
  for (const id of DIMENSIONS) {
    const dimension = world.getDimension(id);
    for (const type of CLEARED) {
      for (const entity of dimension.getEntities({ type })) {
        const time = droppedAt.get(entity.id);
        if (time !== undefined && now - time < GRACE_MS) {
          kept++;
          continue;
        }
        try {
          entity.remove();
          removed++;
        } catch {
          // already gone
        }
      }
    }
  }
  forget(now);
  const keptNote = kept ? `, свежих оставлено: §e${kept}§r` : "";
  world.sendMessage(`${PREFIX}Удалено объектов: §e${removed}§r${keptNote}`);
}

function report(send) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  let total = 0;
  for (const id of DIMENSIONS) {
    for (const entity of world.getDimension(id).getEntities()) {
      counts.set(entity.typeId, (counts.get(entity.typeId) ?? 0) + 1);
      total++;
    }
  }
  const top = [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, n]) => `${type.replace("minecraft:", "")} ${n}`)
    .join(", ");
  const next = interval > 0 ? `через §e${secondsLeft}§r с` : "§cвыключена§r";
  send(`${PREFIX}TPS: §e${tps().toFixed(1)}§r из 20. Сущностей: §e${total}§r (${top || "нет"}). Очистка ${next}`);
}

function setClearInterval(seconds) {
  interval = seconds <= 0 ? 0 : Math.max(MIN_INTERVAL, Math.floor(seconds));
  secondsLeft = interval;
  world.setDynamicProperty(PROP_INTERVAL, interval);
}

world.afterEvents.worldLoad.subscribe(() => {
  const saved = world.getDynamicProperty(PROP_INTERVAL);
  interval = typeof saved === "number" ? saved : DEFAULT_INTERVAL;
  secondsLeft = interval;

  system.runInterval(() => {
    tickTimes.push(Date.now());
    if (tickTimes.length > 41) tickTimes.shift();
  }, 1);

  system.runInterval(() => {
    if (secondsLeft % 60 === 0) forget(Date.now());
    if (interval <= 0) return;
    secondsLeft--;
    if (WARNINGS.includes(secondsLeft)) {
      world.sendMessage(`${PREFIX}Предметы на земле будут удалены через §e${secondsLeft}§r с`);
    }
    if (secondsLeft <= 0) {
      clear();
      secondsLeft = interval;
    }
  }, 20);

  world.afterEvents.entitySpawn.subscribe(({ entity, cause }) => {
    if (cause === EntityInitializationCause.Loaded) return;
    if (entity.typeId === "minecraft:item") droppedAt.set(entity.id, Date.now());
  });

  // /scriptevent clearlag:now | clearlag:tps | clearlag:interval <seconds, 0 = off>
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    /** @param {string} text */
    const send = (text) => (sourceEntity instanceof Player ? sourceEntity.sendMessage(text) : world.sendMessage(text));
    if (id === "clearlag:now") {
      clear();
      secondsLeft = interval;
    } else if (id === "clearlag:tps") {
      report(send);
    } else if (id === "clearlag:interval") {
      const seconds = Number(message);
      if (!Number.isFinite(seconds)) return send(`${PREFIX}Укажите число секунд, например: /scriptevent clearlag:interval 300`);
      setClearInterval(seconds);
      send(interval > 0 ? `${PREFIX}Очистка каждые §e${interval}§r с` : `${PREFIX}Автоочистка выключена`);
    }
  });
});
