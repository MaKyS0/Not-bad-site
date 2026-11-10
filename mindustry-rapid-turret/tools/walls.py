"""Rapid walls I-V, small (1x1) and large (2x2). DESIGN.md section 2."""
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
    """Same frame and octagon socket as the Aegis/Regen walls (DESIGN.md 15.3); the socket holds a raised armour plug
    with the emblem instead of a crystal. Tier 4: accent lines on the top/bottom socket edges, tier 5: on all four."""
    from walls2 import frame
    k = 2 if large else 1
    S = 32 * k
    c = S / 2
    acc, metal, steel = TIER[n]
    a = frame(n, k)
    a.sunk(a.octagon(c, c, 9 * k), steel, k)
    a.plate(a.octagon(c, c - k / 2, 6.5 * k), metal, k, k)
    emblem(a, c, c, 6 * k, k, acc)
    L = 6 * k
    edge = int(c - 9 * k + k)
    if n >= 4:
        a.box(c - L / 2, edge, c + L / 2 - 1, edge + k - 1, acc)
        a.box(c - L / 2, S - edge - k, c + L / 2 - 1, S - 1 - edge, acc)
    if n >= 5:
        a.box(edge, c - L / 2, edge + k - 1, c + L / 2 - 1, acc)
        a.box(S - edge - k, c - L / 2, S - 1 - edge, c + L / 2 - 1, acc)
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
