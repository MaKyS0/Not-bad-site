"""Rapid Forge unit factory. DESIGN.md section 4, 'Factory'."""
from PIL import ImageChops

from art import Art, TIER, shade, emblem
from units import UNITS, RECIPES

S = 160
ORANGE = (255, 190, 80)
STEEL = (110, 112, 128)
METAL = (152, 154, 164)

EN = "Builds the Rapid mechs. Each unit tier needs more expensive materials."
RU = "Строит мехов Rapid. Каждый следующий тир требует более дорогих материалов."


def base(acc=ORANGE, pad="octagon"):
    a = Art(S)
    a.box(0, 0, S - 1, S - 1, shade(STEEL, 0.7))
    a.box(2, 2, S - 3, S - 3, STEEL)
    a.plate(a.cham(4, 4, S - 5, S - 5, 6), METAL, 3, 1)
    c = S / 2
    if pad == "octagon":
        half = 0.30 * S
        # build pad: lip + dark octagon
        a.flat(a.octagon(c, c, half + 3), shade(STEEL, 0.62))
        pad_m = a.octagon(c, c, half)
        a.flat(pad_m, shade(STEEL, 0.45))
        # faint grid inside the pad (centre line is 2px wide to stay mirror symmetric)
        grid, d = a.mask()
        for k in range(0, 6):
            for x in (79 - 16 * k, 80 + 16 * k):
                d.line((x, 0, x, S - 1), fill=255)
                d.line((0, x, S - 1, x), fill=255)
        a.flat(ImageChops.multiply(grid, pad_m), shade(STEEL, 0.55))
    elif pad == "basin":
        # water basin (shipyard), DESIGN.md 22.6
        water = (40, 66, 104)
        a.flat(a.cham(29, 29, 130, 130, 10), shade(STEEL, 0.62))
        a.flat(a.cham(32, 32, 127, 127, 8), water)
        a.flat(a.cham(40, 40, 119, 119, 6), shade(water, 0.85))
        wave = shade(water, 1.3)
        for y in (48, 80, 112):
            for x in (52, 100):
                a.box(x, y, x + 7, y, wave)
        for y in (64, 96):
            for x in (68, 84):
                a.box(x, y, x + 7, y, wave)
        for x in (67, 91):
            a.box(x, 34, x + 1, 41, acc)
            a.box(x, 118, x + 1, 125, acc)
            a.box(34, x, 41, x + 1, acc)
            a.box(118, x, 125, x + 1, acc)
    else:
        # landing pad (hangar): round lip + disc, thin inner ring, four landing ticks
        r = 0.32 * S
        a.flat(a.round_disc(c, c, r + 3), shade(STEEL, 0.62))
        a.flat(a.round_disc(c, c, r), shade(STEEL, 0.45))
        ri = 0.22 * S
        a.flat(a.where(lambda x, y: abs(((x - c) ** 2 + (y - c) ** 2) ** 0.5 - ri) <= 0.5), shade(STEEL, 0.6))
        # ticks: 2px x 8px, centred between the ring (r 35) and the lip (r 51)
        a.box(79, 33, 80, 40, acc)                               # top
        a.box(79, 119, 80, 126, acc)                             # bottom
        a.box(33, 79, 40, 80, acc)                               # left
        a.box(119, 79, 126, 80, acc)                             # right
    # corner blocks: rivet pair + accent L tick
    riv = shade(METAL, 0.62)
    for fx in (0, 1):
        for fy in (0, 1):
            def X(v, w=1):
                return (S - 1 - v - (w - 1)) if fx else v

            def Y(v, w=1):
                return (S - 1 - v - (w - 1)) if fy else v
            for o in (8, 19):
                a.box(X(o, 2), Y(o, 2), X(o, 2) + 1, Y(o, 2) + 1, riv)
            hx = X(13, 16)
            a.box(hx, Y(13, 2), hx + 15, Y(13, 2) + 1, acc)
            vy = Y(13, 16)
            a.box(X(13, 2), vy, X(13, 2) + 1, vy + 15, acc)
    # emblem on the bottom frame edge (needs 26 rows, the frame band under the pad has 25)
    emblem(a, S / 2, S - 5 - 12.5, 24, 2, acc)
    # five tier pips on the top frame edge
    pips = [TIER[i][0] for i in range(1, 6)]
    x0 = S // 2 - (5 * 4 + 4 * 6) // 2
    for i, col in enumerate(pips):
        a.box(x0 + i * 10, 14, x0 + i * 10 + 3, 17, shade(col, 0.5))
        a.box(x0 + i * 10 + 1, 15, x0 + i * 10 + 2, 16, col)
    return a.im


def clamps():
    a = Art(S)
    c = S // 2
    arm, th = int(round(0.16 * S)), 6
    corner = 36
    for fx in (0, 1):
        for fy in (0, 1):
            x0 = c - corner if not fx else c + corner - th
            y0 = c - corner if not fy else c + corner - th
            hx0 = c - corner if not fx else c + corner - arm
            vy0 = c - corner if not fy else c + corner - arm
            # horizontal arm and vertical arm of the L
            a.plate(a.rect(hx0, y0, hx0 + arm - 1, y0 + th - 1), METAL, 2, 1, sym=False)
            a.plate(a.rect(x0, vy0, x0 + th - 1, vy0 + arm - 1), METAL, 2, 1, sym=False)
            a.plate(a.rect(x0, y0, x0 + th - 1, y0 + th - 1), METAL, 2, 1, sym=False)
    half = int(0.30 * S)
    for x in (c - half, c + half - 3):
        a.plate(a.rect(x, c - 20, x + 2, c + 19), STEEL, 1, 1, sym=False)
    return a.im


def notch(side, acc=ORANGE):
    a = Art(S)
    depth, h = int(0.10 * S), int(0.30 * S)
    y0 = S // 2 - h // 2
    x0 = S - depth if side == "right" else 0
    a.box(x0, y0, x0 + depth - 1, y0 + h - 1, shade(STEEL, 0.45))
    # chevron pointing right, 2px thick
    cx = x0 + (depth - 4 if side == "right" else depth - 3)
    for dy in range(-10, 11):
        x = cx - abs(dy) + 1
        a.box(x - 1, S // 2 + dy, x, S // 2 + dy, acc)
    return a.im


def hjson(name="Rapid Forge", desc=EN, research="ground-factory", reqs=(("copper", 350), ("lead", 250), ("graphite", 150),
          ("silicon", 200)), power=2.5, plans=None, health=1600, extra=()):
    lines = [
        "type: UnitFactory",
        f"name: {name}",
        f"description: {desc}",
        "category: units",
        f"research: {research}",
        "requirements: [",
    ] + [f"  {i}/{n}" for i, n in reqs] + [
        "]",
        "size: 5",
    ] + list(extra) + [
        f"health: {health}",
        "consumes: {",
        f"  power: {power}",
        "}",
        "plans: [",
    ]
    for u, t, rq in plans or [(u['name'],) + RECIPES[u['name']] for u in UNITS]:
        lines += ["  {", f"    unit: {u}", f"    time: {t}", "    requirements: ["]
        lines += [f"      {i}/{n}" for i, n in rq]
        lines += ["    ]", "  }"]
    lines.append("]")
    return "\n".join(lines) + "\n"


def build(root):
    open(f"{root}/content/blocks/rapid-forge.hjson", "w").write(hjson())
    base().save(f"{root}/sprites/blocks/rapid-forge.png")
    clamps().save(f"{root}/sprites/blocks/rapid-forge-top.png")
    notch("right").save(f"{root}/sprites/blocks/rapid-forge-out.png")
    notch("left").save(f"{root}/sprites/blocks/rapid-forge-in.png")
    key = "block.rapid-turret-rapid-forge"
    return ([f"{key}.name = Rapid Forge", f"{key}.description = {EN}"],
            [f"{key}.name = Кузница Rapid", f"{key}.description = {RU}"])
