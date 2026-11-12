"""Aegis shield walls I-IV, small and large. DESIGN.md sections 13, 15.3.

The Regen walls (sections 14, 15.4) were removed from the game: each one was a MendProjector that updates and draws every
frame, and hundreds of them made the game lag."""
from PIL import Image, ImageChops

from art import Art, TIER, ROMAN, shade, mix, hexc, emblem

WHITE = (255, 255, 255)

# health/tile, armor, shield/tile, regen/tile, breakCooldown, power/tile, cost/tile
AEGIS = {
    1: dict(health=300, armor=0, shield=120, regen=0.2, cool=480, power=0.02, cost=[("copper", 6), ("silicon", 3)]),
    2: dict(health=480, armor=0, shield=220, regen=0.35, cool=420, power=0.03, cost=[("titanium", 6), ("silicon", 4)]),
    3: dict(health=700, armor=2, shield=380, regen=0.55, cool=360, power=0.05,
            cost=[("thorium", 6), ("plastanium", 2), ("silicon", 4)]),
    4: dict(health=1000, armor=4, shield=600, regen=0.9, cool=300, power=0.08,
            cost=[("surge-alloy", 6), ("phase-fabric", 3), ("silicon", 4)]),
}
AEGIS_EN = {
    1: "Wall with a small energy shield. Needs power and passes it to neighbouring shield walls.",
    2: "Titanium shield wall with a stronger, faster shield.",
    3: "Armoured thorium shield wall.",
    4: "The strongest shield; the wall under it also deflects bullets.",
}
AEGIS_RU = {
    1: "Стена с небольшим энергощитом. Требует энергию и передаёт её соседним щитовым стенам.",
    2: "Титановая щитовая стена: щит прочнее и восстанавливается быстрее.",
    3: "Бронированная ториевая щитовая стена.",
    4: "Самый мощный щит; стена под ним ещё и отражает пули.",
}


def fmt(v):
    v = round(v, 4)
    return str(int(v)) if v == int(v) else str(v)


def frame(n, k, rivet=None):
    """Section 2 steps 1, 2, 5 and (large) 7: steel tile, dark ring, chamfered metal plate, rivets, seam cross."""
    S = 32 * k
    acc, metal, steel = TIER[n]
    a = Art(S)
    a.box(0, 0, S - 1, S - 1, steel)
    ring = ImageChops.subtract(a.rect(0, 0, S - 1, S - 1), a.rect(k, k, S - 1 - k, S - 1 - k))
    a.flat(ring, shade(steel, 0.7))
    a.plate(a.cham(2 * k, 2 * k, S - 1 - 2 * k, S - 1 - 2 * k, 2 * k), metal, 2 * k, k)
    if k == 2:
        seam = shade(metal, 0.5)
        a.box(2 * k, S // 2 - 1, S - 1 - 2 * k, S // 2, seam)
        a.box(S // 2 - 1, 2 * k, S // 2, S - 1 - 2 * k, seam)
    riv = rivet or shade(metal, 0.62)
    for x in (4 * k, S - 5 * k):
        for y in (4 * k, S - 5 * k):
            a.box(x, y, x + k - 1, y + k - 1, riv)
    return a


def aegis_sprites(n, k):
    S = 32 * k
    c = S / 2
    acc, metal, steel = TIER[n]
    a = frame(n, k)
    a.sunk(a.octagon(c, c, 9 * k), steel, k)
    crystal = a.where(lambda x, y: abs(x - c) + abs(y - c) <= 6 * k)
    upper = a.where(lambda x, y: abs(x - c) + abs(y - c) <= 6 * k and y < c)
    a.flat(crystal, shade(acc, 0.8))
    a.flat(upper, mix(acc, WHITE, 0.35))
    # emblem cut into the crystal: draw it on a scratch canvas to also get its mask
    e = Art(S)
    emblem(e, c, c, 6 * k, k, steel)
    cut = e.im.getchannel("A")
    a.im.paste(shade(steel, 0.45) + (255,), mask=cut)
    lines = Art(S)
    L = 6 * k
    if n >= 3:
        top = int(c - 9 * k + k)
        lines.box(c - L / 2, top, c + L / 2 - 1, top + k - 1, WHITE)
        lines.box(c - L / 2, S - 1 - top - k + 1, c + L / 2 - 1, S - 1 - top, WHITE)
    if n == 4:
        left = int(c - 9 * k + k)
        lines.box(left, c - L / 2, left + k - 1, c + L / 2 - 1, WHITE)
        lines.box(S - 1 - left - k + 1, c - L / 2, S - 1 - left, c + L / 2 - 1, WHITE)
    lm = lines.im.getchannel("A")
    a.im.paste(acc + (255,), mask=lm)
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gm = ImageChops.lighter(ImageChops.subtract(crystal, cut), lm)
    glow.paste((255, 255, 255, 255), mask=gm)
    return a.im, glow


def research(prefix, base_parent, n, large):
    if large:
        return f"{prefix}-{n}"
    return base_parent if n == 1 else f"{prefix}-{n - 1}"


def aegis_hjson(n, large):
    w = AEGIS[n]
    m = 4 if large else 1
    name = f"rapid-shield-wall-{n}" + ("-large" if large else "")
    lines = [
        "type: ShieldWall",
        f"name: {'Large ' if large else ''}Aegis Wall {ROMAN[n]}",
        f"description: {AEGIS_EN[n]}{' Covers 2x2 tiles.' if large else ''}",
        "category: defense",
        f"research: {research('rapid-shield-wall', 'rapid-wall-1', n, large)}",
        "requirements: [",
    ] + [f"  {i}/{c * m}" for i, c in w['cost']] + [
        "]",
        f"size: {2 if large else 1}",
        f"health: {w['health'] * m}",
        f"armor: {w['armor']}",
        f"shieldHealth: {w['shield'] * m}",
        f"regenSpeed: {fmt(w['regen'] * m)}",
        f"breakCooldown: {w['cool']}",
        "conductivePower: true",
        f'glowColor: "{hexc(TIER[n][0])[1:-1]}80"',
        "consumes: {",
        f"  power: {fmt(w['power'] * m)}",
        "}",
    ]
    if n == 4:
        lines += ["chanceDeflect: 8", "flashHit: true"]
    return name, "\n".join(lines) + "\n"


def build(root):
    en, ru = [], []
    for fam, table, mk_h, mk_s, suffix, EN, RU, en_t, ru_t in (
        ("aegis", AEGIS, aegis_hjson, aegis_sprites, "-glow", AEGIS_EN, AEGIS_RU, "Aegis Wall", "щитовая стена"),
    ):
        for n in table:
            for large in (False, True):
                name, text = mk_h(n, large)
                open(f"{root}/content/blocks/{name}.hjson", "w").write(text)
                main, layer = mk_s(n, 2 if large else 1)
                main.save(f"{root}/sprites/blocks/{name}.png")
                layer.save(f"{root}/sprites/blocks/{name}{suffix}.png")
                key = f"block.rapid-turret-{name}"
                if large:
                    en += [f"{key}.name = Large {en_t} {ROMAN[n]}", f"{key}.description = {EN[n]} Covers 2x2 tiles."]
                    ru += [f"{key}.name = Большая {ru_t} {ROMAN[n]}", f"{key}.description = {RU[n]} Занимает 2x2 клетки."]
                else:
                    en += [f"{key}.name = {en_t} {ROMAN[n]}", f"{key}.description = {EN[n]}"]
                    ru += [f"{key}.name = {ru_t.capitalize()} {ROMAN[n]}", f"{key}.description = {RU[n]}"]
    return en, ru
