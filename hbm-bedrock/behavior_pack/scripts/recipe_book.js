// Recipe book, in the spirit of JEI: a searchable list of every item; picking one shows how it is
// made (crafting table, furnace, machines) and what it is used for. Bedrock does not let add-ons
// change the crafting screen, so the book opens its own forms instead.
import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { BOOK_ITEMS, BOOK_NAMES, BOOK_RECIPES } from "./recipe_index.js";

const PAGE = 30;
const MACHINE_NAMES = {
  assembly: "tile.hbm.machine_assembly_machine.name",
  chemical: "tile.hbm.machine_chemical_factory.name",
  precass: "tile.hbm.machine_precass.name",
  rockmill: "tile.hbm.machine_rockmill.name",
  supercomputer: "tile.hbm.machine_supercomputer.name",
  purex: "tile.hbm.machine_purex.name",
  centrifuge: "tile.hbm.machine_centrifuge.name",
  press: "tile.hbm.machine_epress.name",
  blast: "tile.hbm.machine_blast_furnace.name",
  refinery: "tile.hbm.machine_fraction_tower.name",
  hydrotreating: "tile.hbm.machine_hydrotreater.name",
  reforming: "tile.hbm.machine_catalytic_reformer.name",
  liquefaction: "tile.hbm.machine_liquefactor.name",
  electrolysis: "tile.hbm.machine_electrolyser.name",
  compressor: "tile.hbm.machine_compressor.name",
  combination: "tile.hbm.furnace_combination.name",
  silex: "tile.hbm.machine_silex.name",
  crystallizer: "tile.hbm.machine_crystallizer.name",
  mixer: "tile.hbm.machine_mixer.name",
  cyclotron: "tile.hbm.machine_cyclotron.name",
  exposure: "tile.hbm.machine_exposure_chamber.name",
  arcwelder: "tile.hbm.machine_arc_welder.name",
  ammopress: "tile.hbm.machine_ammo_press.name",
};

/** @type {Map<string, { key: string, icon: string }>} */
const ITEMS = new Map(BOOK_ITEMS.map(([id, key, icon]) => [id, { key, icon }]));
const ALL_IDS = BOOK_ITEMS.map(([id]) => id).sort((a, b) => (BOOK_NAMES[a]?.[1] ?? a).localeCompare(BOOK_NAMES[b]?.[1] ?? b));

/** @typedef {{ t: string, p?: string[], k?: Record<string, string>, i?: any, o: any, c?: number, m?: string, tk?: number, pw?: number, pick?: boolean }} BookRecipe */

/** Item ids a recipe produces. */
function outputsOf(/** @type {BookRecipe} */ r) {
  return r.t === "machine" ? r.o.map(([id]) => id) : [r.o];
}
/** Item ids a recipe consumes. */
function inputsOf(/** @type {BookRecipe} */ r) {
  if (r.t === "shaped") return Object.values(r.k ?? {});
  if (r.t === "shapeless") return r.i;
  if (r.t === "furnace") return [r.i];
  return r.i.filter((x) => x.id).map((x) => x.id);
}
/** @type {Map<string, BookRecipe[]>} */
const MAKES = new Map();
/** @type {Map<string, BookRecipe[]>} */
const USES = new Map();
for (const r of /** @type {BookRecipe[]} */ (BOOK_RECIPES)) {
  for (const id of outputsOf(r)) (MAKES.get(id) ?? MAKES.set(id, []).get(id))?.push(r);
  for (const id of new Set(inputsOf(r))) (USES.get(id) ?? USES.set(id, []).get(id))?.push(r);
}

/** @returns {import("@minecraft/server").RawMessage} */
function label(id) {
  if (id.startsWith("fluid:")) return { translate: `hbm.fluid.${id.slice(6)}` };
  const item = ITEMS.get(id);
  if (item?.key) return { translate: item.key };
  const words = id.replace(/^\w+:/, "").split("_");
  return { text: words.map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ") };
}
const icon = (id) => ITEMS.get(id)?.icon || undefined;
const amount = (id, n) => ({ text: id.startsWith("fluid:") ? ` ${n} mB` : ` ×${n}` });

function openBook(player) {
  new ActionFormData()
    .title({ translate: "hbm.book.title" })
    .body({ translate: "hbm.book.body", with: [String(ALL_IDS.length)] })
    .button({ translate: "hbm.book.search" }, "textures/ui/magnifyingGlass")
    .button({ translate: "hbm.book.all" })
    .button({ translate: "hbm.book.held" })
    .show(player)
    .then((r) => {
      if (r.selection === 0) search(player);
      else if (r.selection === 1) list(player, ALL_IDS, 0);
      else if (r.selection === 2) {
        const held = player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex);
        if (held) showItem(player, held.typeId, "make", 0);
        else openBook(player);
      }
    });
}

function search(player) {
  new ModalFormData()
    .title({ translate: "hbm.book.search" })
    .textField({ translate: "hbm.book.search_label" }, "uranium / уран")
    .show(player)
    .then((r) => {
      const query = String(r.formValues?.[0] ?? "").trim().toLowerCase();
      if (!query) return openBook(player);
      const found = ALL_IDS.filter((id) => id.includes(query) || (BOOK_NAMES[id] ?? []).some((n) => n.toLowerCase().includes(query)));
      list(player, found, 0);
    });
}

function list(player, ids, page) {
  const pages = Math.max(1, Math.ceil(ids.length / PAGE));
  const shown = ids.slice(page * PAGE, page * PAGE + PAGE);
  const form = new ActionFormData()
    .title({ translate: "hbm.book.title" })
    .body(ids.length ? { translate: "hbm.book.page", with: [String(page + 1), String(pages)] } : { translate: "hbm.book.none" });
  /** @type {(() => void)[]} */
  const actions = [];
  if (page > 0) {
    form.button({ translate: "hbm.book.prev" });
    actions.push(() => list(player, ids, page - 1));
  }
  for (const id of shown) {
    form.button(label(id), icon(id));
    actions.push(() => showItem(player, id, "make", 0, () => list(player, ids, page)));
  }
  if (page + 1 < pages) {
    form.button({ translate: "hbm.book.next" });
    actions.push(() => list(player, ids, page + 1));
  }
  form.button({ translate: "hbm.book.back" });
  actions.push(() => openBook(player));
  form.show(player).then((r) => r.selection !== undefined && actions[r.selection]?.());
}

/** Body text for one recipe; returns it with the item ids worth linking to. */
function describe(/** @type {BookRecipe} */ r) {
  /** @type {import("@minecraft/server").RawMessage[]} */
  const body = [];
  const line = (...parts) => body.push(...parts, { text: "\n" });
  if (r.t === "shaped") {
    line({ translate: "hbm.book.crafting" });
    for (const row of r.p ?? []) line({ text: `  [${row.split("").map((ch) => (ch === " " ? "·" : ch)).join(" ")}]` });
    for (const [ch, id] of Object.entries(r.k ?? {})) line({ text: `  ${ch} — ` }, label(id));
  } else if (r.t === "shapeless") {
    line({ translate: "hbm.book.shapeless" });
    const counts = new Map();
    for (const id of r.i) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, n] of counts) line({ text: "  " }, label(id), amount(id, n));
  } else if (r.t === "furnace") {
    line({ translate: "hbm.book.furnace" });
    line({ text: "  " }, label(r.i));
  } else {
    const machine = MACHINE_NAMES[r.m ?? ""];
    line({ translate: "hbm.book.machine" }, machine ? { translate: machine } : { text: r.m ?? "" });
    for (const input of r.i) {
      if (input.stamp) line({ text: "  " }, { translate: "hbm.book.stamp", with: [input.stamp] });
      else line({ text: "  " }, label(input.id), amount(input.id, input.n));
    }
    line({ translate: "hbm.book.time", with: [String(Math.round((r.tk ?? 0) / 20)), String(r.pw ?? 0)] });
  }
  body.push({ text: "\n" });
  if (r.t === "machine") {
    line({ translate: "hbm.book.gives" }, ...(r.pick ? [{ translate: "hbm.book.random" }] : []));
    for (const [id, n] of r.o) line({ text: "  " }, label(id), amount(id, n));
  } else {
    line({ translate: "hbm.book.gives" }, label(r.o), amount(r.o, r.c ?? 1));
  }
  return { body, links: [...new Set([...inputsOf(r), ...outputsOf(r)])].filter((id) => !id.startsWith("fluid:")) };
}

/** One item: its recipes ("make") or the recipes that need it ("use"), one at a time. */
function showItem(player, id, mode, index, back) {
  const recipes = (mode === "make" ? MAKES : USES).get(id) ?? [];
  const r = recipes[index];
  /** @type {import("@minecraft/server").RawMessage[]} */
  const body = [label(id), { text: "\n\n" }];
  let links = [];
  if (r) {
    body.push({ translate: mode === "make" ? "hbm.book.recipe_of" : "hbm.book.use_of", with: [String(index + 1), String(recipes.length)] }, { text: "\n" });
    const d = describe(r);
    body.push(...d.body);
    links = d.links.filter((x) => x !== id);
  } else {
    body.push({ translate: mode === "make" ? "hbm.book.no_recipes" : "hbm.book.no_uses" });
  }
  const form = new ActionFormData().title(label(id)).body({ rawtext: body });
  /** @type {(() => void)[]} */
  const actions = [];
  const self = () => showItem(player, id, mode, index, back);
  if (index + 1 < recipes.length) {
    form.button({ translate: "hbm.book.next_recipe" });
    actions.push(() => showItem(player, id, mode, index + 1, back));
  }
  if (index > 0) {
    form.button({ translate: "hbm.book.prev_recipe" });
    actions.push(() => showItem(player, id, mode, index - 1, back));
  }
  form.button({ translate: mode === "make" ? "hbm.book.show_uses" : "hbm.book.show_recipes" });
  actions.push(() => showItem(player, id, mode === "make" ? "use" : "make", 0, back));
  // Like JEI: every ingredient and product is a link to its own page.
  for (const link of links.slice(0, 12)) {
    form.button(label(link), icon(link));
    actions.push(() => showItem(player, link, "make", 0, self));
  }
  form.button({ translate: "hbm.book.back" });
  actions.push(() => (back ? back() : openBook(player)));
  form.show(player).then((res) => res.selection !== undefined && actions[res.selection]?.());
}

export function startRecipeBook() {
  world.afterEvents.itemUse.subscribe(({ itemStack, source }) => {
    if (itemStack.typeId === "hbm:recipe_book") system.run(() => openBook(source));
  });
  // Everyone gets a book the first time they join.
  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!initialSpawn || player.getDynamicProperty("hbm:has_book")) return;
    player.setDynamicProperty("hbm:has_book", true);
    player.runCommand("give @s hbm:recipe_book");
  });
  // /scriptevent hbm:book opens it without the item.
  system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
    if (id === "hbm:book" && sourceEntity?.typeId === "minecraft:player") openBook(/** @type {any} */ (sourceEntity));
  });
}
