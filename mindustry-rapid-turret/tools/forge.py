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


def base():
    a = Art(S)
    a.box(0, 0, S - 1, S - 1, shade(STEEL, 0.7))
    a.box(2, 2, S - 3, S - 3, STEEL)
    a.plate(a.cham(4, 4, S - 5, S - 5, 6), METAL, 3, 1)
    c = S / 2
    half = 0.30 * S
    # build pad: lip + dark octagon
    a.flat(a.octagon(c, c, half + 3), shade(STEEL, 0.62))
    pad = a.octagon(c, c, half)
    a.flat(pad, shade(STEEL, 0.45))
    # faint grid inside the pad (centre line is 2px wide to stay mirror symmetric)
    grid, d = a.mask()
    for k in range(0, 6):
        for x in (79 - 16 * k, 80 + 16 * k):
            d.line((x, 0, x, S - 1), fill=255)
            d.line((0, x, S - 1, x), fill=255)
    a.flat(ImageChops.multiply(grid, pad), shade(STEEL, 0.55))
    # corner blocks: rivet pair + accent L tick
    acc = ORANGE
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


def notch(side):
    a = Art(S)
    depth, h = int(0.10 * S), int(0.30 * S)
    y0 = S // 2 - h // 2
    x0 = S - depth if side == "right" else 0
    a.box(x0, y0, x0 + depth - 1, y0 + h - 1, shade(STEEL, 0.45))
    # chevron pointing right, 2px thick
    cx = x0 + (depth - 4 if side == "right" else depth - 3)
    for dy in range(-10, 11):
        x = cx - abs(dy) + 1
        a.box(x - 1, S // 2 + dy, x, S // 2 + dy, ORANGE)
    return a.im


def hjson():
    lines = [
        "type: UnitFactory",
        "name: Rapid Forge",
        f"description: {EN}",
        "category: units",
        "research: ground-factory",
        "requirements: [",
        "  copper/350",
        "  lead/250",
        "  graphite/150",
        "  silicon/200",
        "]",
        "size: 5",
        "health: 1600",
        "consumes: {",
        "  power: 2.5",
        "}",
        "plans: [",
    ]
    for u in UNITS:
        t, reqs = RECIPES[u['name']]
        lines += ["  {", f"    unit: {u['name']}", f"    time: {t}", "    requirements: ["]
        lines += [f"      {i}/{n}" for i, n in reqs]
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
