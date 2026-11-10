"""Rapid walls I-V, small (1x1) and large (2x2). DESIGN.md section 2."""
from PIL import ImageChops

from art import Art, TIER, shade, hexc, emblem, ROMAN

# health per tile, armor, cost per tile
WALLS = {
    1: dict(health=420, armor=0, cost=[("copper", 6), ("graphite", 2)]),
    2: dict(health=640, armor=0, cost=[("titanium", 6), ("silicon", 3)]),
    3: dict(health=920, armor=2, cost=[("thorium", 6), ("titanium", 4)]),
    4: dict(health=1250, armor=4, cost=[("plastanium", 5), ("thorium", 5)]),
    5: dict(health=1700, armor=6, cost=[("surge-alloy", 6), ("phase-fabric", 3)]),
}

EN = {
    1: "Basic reinforced wall. Cheap and sturdy.",
    2: "Titanium-plated wall with much more health.",
    3: "Thorium-armoured wall that shrugs off weak bullets.",
    4: "Absorbs lasers and blocks power node links.",
    5: "Deflects bullets and arcs lightning at attackers.",
}
RU = {
    1: "Базовая усиленная стена. Дешёвая и прочная.",
    2: "Стена с титановой обшивкой и большим запасом прочности.",
    3: "Стена с ториевой бронёй, не боится слабых пуль.",
    4: "Поглощает лазеры и не пропускает связи узлов питания.",
    5: "Отражает пули и бьёт атакующих молниями.",
}


def sprite(n, large):
    k = 2 if large else 1
    S = 32 * k
    acc, metal, steel = TIER[n]
    a = Art(S)
    a.box(0, 0, S - 1, S - 1, steel)
    ring = ImageChops.subtract(a.rect(0, 0, S - 1, S - 1), a.rect(k, k, S - 1 - k, S - 1 - k))
    a.flat(ring, shade(steel, 0.7))
    # metal plate, chamfered
    a.plate(a.cham(2 * k, 2 * k, S - 1 - 2 * k, S - 1 - 2 * k, 2 * k), metal, 2 * k, k)
    if large:   # seam cross (2px so it stays mirror symmetric), only through the metal plate
        seam = shade(metal, 0.5)
        a.box(2 * k, S // 2 - 1, S - 1 - 2 * k, S // 2, seam)
        a.box(S // 2 - 1, 2 * k, S // 2, S - 1 - 2 * k, seam)
    # recessed panel
    p0, p1 = 8 * k, S - 1 - 8 * k
    a.sunk(a.rect(p0, p0, p1, p1), steel, k)
    emblem(a, S / 2, S / 2, 8 * k, k, acc)
    # rivets
    riv = shade(metal, 0.62)
    for x in (4 * k, S - 5 * k):
        for y in (4 * k, S - 5 * k):
            a.box(x, y, x + k - 1, y + k - 1, riv)
    # energy shielding lines
    if n >= 4:
        a.box(p0 + 2 * k, p0 + k, p1 - 2 * k, p0 + 2 * k - 1, acc)
        a.box(p0 + 2 * k, p1 - 2 * k + 1, p1 - 2 * k, p1 - k, acc)
    if n >= 5:
        a.box(p0 + k, p0 + 2 * k, p0 + 2 * k - 1, p1 - 2 * k, acc)
        a.box(p1 - 2 * k + 1, p0 + 2 * k, p1 - k, p1 - 2 * k, acc)
    return a.im


def hjson(n, large):
    w = WALLS[n]
    mult = 4 if large else 1
    name = f"rapid-wall-{n}" + ("-large" if large else "")
    title = ("Large " if large else "") + f"Rapid Wall {ROMAN[n]}"
    desc = EN[n] + (" Covers 2x2 tiles." if large else "")
    lines = [
        "type: Wall",
        f"name: {title}",
        f"description: {desc}",
        "category: defense",
        f"research: {('rapid-wall-%d' % n) if large else ('copper-wall' if n == 1 else 'rapid-wall-%d' % (n - 1))}",
        "requirements: [",
    ] + [f"  {i}/{c * mult}" for i, c in w['cost']] + [
        "]",
        f"size: {2 if large else 1}",
        f"health: {w['health'] * mult}",
        f"armor: {w['armor']}",
    ]
    if n == 4:
        lines += ["absorbLasers: true", "insulated: true"]
    if n == 5:
        lines += ["lightningChance: 0.05", "lightningDamage: 25", "lightningLength: 17",
                  f"lightningColor: {hexc(TIER[5][0])}", "chanceDeflect: 10", "flashHit: true"]
    return name, "\n".join(lines) + "\n"


def build(root):
    en, ru = [], []
    for n in WALLS:
        for large in (False, True):
            name, text = hjson(n, large)
            open(f"{root}/content/blocks/{name}.hjson", "w").write(text)
            sprite(n, large).save(f"{root}/sprites/blocks/{name}.png")
            key = f"block.rapid-turret-{name}"
            if large:
                en += [f"{key}.name = Large Rapid Wall {ROMAN[n]}", f"{key}.description = {EN[n]} Covers 2x2 tiles."]
                ru += [f"{key}.name = Большая стена Rapid {ROMAN[n]}", f"{key}.description = {RU[n]} Занимает 2x2 клетки."]
            else:
                en += [f"{key}.name = Rapid Wall {ROMAN[n]}", f"{key}.description = {EN[n]}"]
                ru += [f"{key}.name = Стена Rapid {ROMAN[n]}", f"{key}.description = {RU[n]}"]
    return en, ru
