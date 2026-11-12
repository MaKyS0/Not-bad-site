"""Rapid Works logistics: junction, bridge, phase bridge, unloader, vault. DESIGN.md sections 36, 39, 40.4-40.7, 41."""
from PIL import Image

from art import Art, TIER, shade, mix, emblem

WHITE = (255, 255, 255)

BLOCKS = {
    "rapid-junction": dict(type="Junction", cat="distribution", size=1, health=100, tier=1,
                           fields=["speed: 12", "capacity: 6", "buildCostMultiplier: 6"],
                           cost=[("copper", 3), ("graphite", 2)], research="junction", en="Rapid Junction",
                           ru="Перекрёсток Rapid",
                           en_d="Lets two belts cross at 30 items a second — fast enough for any Rapid Conveyor.",
                           ru_d="Пропускает два конвейера крест-накрест со скоростью 30 предметов в секунду — хватит любому конвейеру Rapid."),
    "rapid-bridge": dict(type="BufferedItemBridge", cat="distribution", size=1, health=110, tier=1,
                         fields=["range: 7", "speed: 40", "bufferCapacity: 14", "fadeIn: false", "arrowSpacing: 8"],
                         cost=[("copper", 8), ("lead", 8), ("graphite", 8)], research="bridge-conveyor", en="Rapid Bridge",
                         ru="Мост Rapid",
                         en_d="Carries items over 6 tiles of anything. Faster and longer than a bridge conveyor, no power.",
                         ru_d="Переносит предметы над 6 клетками чего угодно. Быстрее и длиннее обычного моста, без энергии."),
    "rapid-phase-bridge": dict(type="ItemBridge", cat="distribution", size=1, health=160, tier=4,
                               fields=["range: 16", "transportTime: 1.5", "pulse: true", "arrowSpacing: 8",
                                       "arrowPeriod: 0.9", "arrowTimeScl: 2.75", "consumes: {", "  power: 0.5", "}"],
                               cost=[("rapid-steel", 6), ("phase-fabric", 5), ("silicon", 10), ("graphite", 10)],
                               research="phase-conveyor", en="Rapid Phase Bridge", ru="Фазовый мост Rapid",
                               en_d="Teleports up to 40 items a second across 15 tiles. Needs power.",
                               ru_d="Телепортирует до 40 предметов в секунду через 15 клеток. Требует энергию."),
    "rapid-unloader": dict(type="Unloader", cat="effect", size=1, health=120, tier=2, fields=["speed: 2.7273"],
                           cost=[("titanium", 30), ("silicon", 40), ("rapid-steel", 10)], research="unloader",
                           en="Rapid Unloader", ru="Разгрузчик Rapid",
                           en_d="Unloads 22 items a second from cores, vaults and machines — twice an unloader.",
                           ru_d="Выгружает 22 предмета в секунду из ядер, хранилищ и механизмов — вдвое быстрее обычного."),
    "rapid-vault": dict(type="StorageBlock", cat="effect", size=3, health=1500, tier=3, fields=["itemCapacity: 2500"],
                        cost=[("titanium", 300), ("thorium", 150), ("rapid-steel", 120)], research="vault",
                        en="Rapid Vault", ru="Хранилище Rapid",
                        en_d="Holds 2500 of every item. Placed against a core, it extends the core's storage.",
                        ru_d="Вмещает по 2500 каждого предмета. Рядом с ядром расширяет его склад."),
}


def arrow_col(tier):
    acc, metal, steel = TIER[tier]
    return mix(shade(steel, 0.9), acc, 0.25)


# ---------------------------------------------------------------- sprites

def junction():
    acc, metal, steel = TIER[1]
    a = Art(32)
    a.box(0, 0, 31, 31, shade(steel, 0.5))
    for fx in (0, 1):
        for fy in (0, 1):
            x0, y0 = (24 if fx else 0), (24 if fy else 0)
            a.box(x0, y0, x0 + 7, y0 + 7, metal)
            ex, ey = (31 if fx else 0), (31 if fy else 0)
            ix, iy = (24 if fx else 7), (24 if fy else 7)
            a.box(x0, iy, x0 + 7, iy, shade(metal, 1.2))
            a.box(ix, y0, ix, y0 + 7, shade(metal, 1.2))
            a.box(x0, ey, x0 + 7, ey, shade(metal, 0.7))
            a.box(ex, y0, ex, y0 + 7, shade(metal, 0.7))
    ar = arrow_col(1)
    for r in ((15, 2, 16, 5), (15, 26, 16, 29), (2, 15, 5, 16), (26, 15, 29, 16)):
        a.box(*r, ar)
    a.box(15, 11, 16, 20, acc)
    a.box(11, 15, 20, 16, acc)
    return a.im


def bridge_sprites(tier, phase):
    acc, metal, steel = TIER[tier]
    dark = shade(steel, 0.45)
    # base
    a = Art(32)
    a.box(0, 0, 31, 31, shade(steel, 0.7))
    a.plate(a.cham(1, 1, 30, 30, 3), metal, 2)
    a.flat(a.round_disc(16, 16, 9), shade(steel, 0.62))
    a.sunk(a.round_disc(16, 16, 7), dark)
    for r in ((15, 3, 16, 5), (15, 26, 16, 28), (3, 15, 5, 16), (26, 15, 28, 16)):
        a.box(*r, acc)
    if phase:
        a.flat(a.round_disc(16, 16, 4), shade(acc, 0.75))
        a.flat(a.round_disc(16, 15, 2), mix(acc, WHITE, 0.5))
    base = a.im
    # end
    e = Art(32)
    e.flat(e.poly([(8, 24), (23, 24), (27, 28), (27, 31), (4, 31), (4, 28)]), metal, sym=False)
    e.box(8, 24, 23, 24, shade(metal, 0.7))
    e.box(12, 30, 19, 31, acc)
    end = e.im
    # bridge strip: every column identical, top <-> bottom symmetric
    B, L = (shade(steel, 0.5), arrow_col(1)) if not phase else (shade(acc, 0.35), acc)
    rows = [(4, 5, shade(metal, 0.7)), (6, 9, metal), (10, 14, B), (15, 16, L), (17, 21, B), (22, 25, metal),
            (26, 27, shade(metal, 0.7))]
    s = Art(32)
    for y0, y1, col in rows:
        s.box(0, y0, 31, y1, col)
    strip = s.im
    # arrow (points right)
    ar = Art(32)
    col = acc if not phase else mix(acc, WHITE, 0.5)
    for y in range(8, 24):
        ar.box(12, y, 12 + min(y - 8, 23 - y), y, col)
    return base, end, strip, ar.im


def unloader():
    acc, metal, steel = TIER[2]
    dark = shade(steel, 0.45)
    a = Art(32)
    a.box(0, 0, 31, 31, shade(steel, 0.7))
    a.plate(a.cham(1, 1, 30, 30, 3), metal, 2)
    a.flat(a.rect(8, 8, 23, 23), shade(steel, 0.62))
    a.sunk(a.rect(9, 9, 22, 22), dark)
    for fy in (0, 1):
        y = 27 if fy else 4
        a.flat(a.rect(4, y, 7, y), acc)
        a.flat(a.rect(4, 24 if fy else 4, 4, 27 if fy else 7), acc)
    center = Art(32)
    center.flat(center.where(lambda x, y: abs(x - 16) + abs(y - 16) <= 5.5), WHITE)
    return a.im, center.im


def vault():
    acc, metal, steel = TIER[3]
    dark = shade(steel, 0.45)
    a = Art(96)
    a.box(0, 0, 95, 95, shade(steel, 0.7))
    a.box(2, 2, 93, 93, steel)
    a.plate(a.cham(4, 4, 91, 91, 6), metal, 3)
    a.sunk(a.cham(14, 14, 81, 81, 8), steel)
    a.plate(a.cham(20, 20, 75, 75, 6), metal, 3)
    a.plate(a.rect(44, 20, 51, 75), steel, 1)
    a.plate(a.rect(20, 44, 75, 51), steel, 1)
    a.plate(a.round_disc(48, 48, 12), metal, 2)
    a.flat(a.round_disc(48, 48, 9), dark)
    emblem(a, 48, 48, 10, 1, acc)
    for x in (24, 68):
        for y in (24, 68):
            a.box(x, y, x + 3, y + 3, acc)
    for x in (6, 88):
        for y in (6, 88):
            a.box(x, y, x + 1, y + 1, shade(metal, 0.62))
    return a.im


def hjson(name):
    b = BLOCKS[name]
    lines = [
        f"type: {b['type']}",
        f"name: {b['en']}",
        f"description: {b['en_d']}",
        f"category: {b['cat']}",
        f"research: {b['research']}",
        "requirements: [",
    ] + [f"  {i}/{n}" for i, n in b['cost']] + [
        "]",
        f"size: {b['size']}",
        f"health: {b['health']}",
    ] + b['fields']
    return "\n".join(lines) + "\n"


def build(root):
    en, ru = [], []
    out = f"{root}/sprites/blocks"
    for name, b in BLOCKS.items():
        open(f"{root}/content/blocks/{name}.hjson", "w").write(hjson(name))
        key = f"block.rapid-turret-{name}"
        en += [f"{key}.name = {b['en']}", f"{key}.description = {b['en_d']}"]
        ru += [f"{key}.name = {b['ru']}", f"{key}.description = {b['ru_d']}"]
    junction().save(f"{out}/rapid-junction.png")
    for name, tier, phase in (("rapid-bridge", 1, False), ("rapid-phase-bridge", 4, True)):
        base, end, strip, arrow = bridge_sprites(tier, phase)
        base.save(f"{out}/{name}.png")
        end.save(f"{out}/{name}-end.png")
        strip.save(f"{out}/{name}-bridge.png")
        arrow.save(f"{out}/{name}-arrow.png")
    u, c = unloader()
    u.save(f"{out}/rapid-unloader.png")
    c.save(f"{out}/rapid-unloader-center.png")
    vault().save(f"{out}/rapid-vault.png")
    return en, ru
