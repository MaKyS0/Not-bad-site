"""Rapid drills I-V. DESIGN.md section 3."""
import math
from PIL import Image, ImageDraw, ImageChops

from art import Art, TIER, shade, ROMAN

DRILLS = {
    1: dict(size=2, tier=2, time=430, power=None, boost=0.05, rot=2.5, blades=3,
            cost=[("copper", 30), ("graphite", 15)]),
    2: dict(size=2, tier=3, time=320, power=None, boost=0.06, rot=3.5, blades=4,
            cost=[("copper", 45), ("graphite", 30), ("silicon", 15)]),
    3: dict(size=3, tier=4, time=230, power=1.5, boost=0.09, rot=4.5, blades=4,
            cost=[("copper", 60), ("graphite", 50), ("silicon", 45), ("titanium", 35)]),
    4: dict(size=4, tier=5, time=190, power=4, boost=0.12, rot=5.5, blades=6,
            cost=[("copper", 110), ("silicon", 90), ("titanium", 80), ("thorium", 90)]),
    5: dict(size=5, tier=6, time=150, power=8, boost=0.16, rot=7, blades=6,
            cost=[("copper", 200), ("silicon", 180), ("titanium", 150), ("thorium", 150),
                  ("plastanium", 60), ("surge-alloy", 40)]),
}

EN = {
    1: "Mines ore up to hardness 2 (copper, lead, sand, coal). Water speeds it up.",
    2: "Mines ore up to hardness 3, including titanium. Water speeds it up.",
    3: "Powered drill that mines ore up to hardness 4, including thorium. Water speeds it up.",
    4: "Heavy powered drill that mines ore up to hardness 5. Water speeds it up.",
    5: "Top-tier powered drill that mines ore up to hardness 6. Water speeds it up.",
}
RU = {
    1: "Добывает руду до твёрдости 2 (медь, свинец, песок, уголь). Вода ускоряет работу.",
    2: "Добывает руду до твёрдости 3, включая титан. Вода ускоряет работу.",
    3: "Бур с питанием, добывает руду до твёрдости 4, включая торий. Вода ускоряет работу.",
    4: "Тяжёлый бур с питанием, добывает руду до твёрдости 5. Вода ускоряет работу.",
    5: "Лучший бур с питанием, добывает руду до твёрдости 6. Вода ускоряет работу.",
}


def base(n):
    d = DRILLS[n]
    S = d['size'] * 32
    acc, metal, steel = TIER[n]
    a = Art(S)
    ring = 2 if S >= 128 else 1
    dp = 3 if S >= 128 else 2
    a.box(0, 0, S - 1, S - 1, shade(steel, 0.7))
    a.box(ring, ring, S - 1 - ring, S - 1 - ring, steel)
    a.plate(a.cham(2, 2, S - 3, S - 3, max(3, S // 16)), metal, dp, 1)
    # well
    r = int(round(0.40 * S))
    a.flat(a.disc(S // 2, S // 2, r + 2), shade(steel, 0.62))
    a.flat(a.disc(S // 2, S // 2, r), shade(steel, 0.45))
    # corner blocks: rivet + accent tick
    big = S >= 128
    o = 5 if big else 4
    rv = 2 if big else 1
    L = max(3, S // 16)
    th = 2 if big else 1
    riv = shade(metal, 0.62)
    for fx in (0, 1):
        for fy in (0, 1):
            def X(v, w=1):   # flip a coordinate / extent from the top-left corner
                return (S - 1 - v - (w - 1)) if fx else v

            def Y(v, w=1):
                return (S - 1 - v - (w - 1)) if fy else v
            ox, oy = X(o, rv), Y(o, rv)
            a.box(ox, oy, ox + rv - 1, oy + rv - 1, riv)
            # horizontal tick next to the rivet
            hx0 = X(o + 3 + rv, L)
            a.box(hx0, Y(o, th), hx0 + L - 1, Y(o, th) + th - 1, acc)
            if n >= 3:   # L-shaped tick: add the vertical leg
                vy0 = Y(o + 3 + rv, L)
                a.box(X(o, th), vy0, X(o, th) + th - 1, vy0 + L - 1, acc)
    # emblem on the bottom-centre frame edge only if the frame there is tall enough
    w = S // 6
    frame_h = (S - 3) - (S // 2 + r + 2)
    if frame_h >= w // 2 + 6:
        from art import emblem
        emblem(a, S / 2, S - 3 - frame_h / 2, w, 2 if big else 1, acc)
    return a.im


def rotator(n):
    d = DRILLS[n]
    S = d['size'] * 32
    acc, metal, steel = TIER[n]
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    c = (S - 1) / 2
    N = d['blades']
    u_in, u_out = 0.04 * S, 0.36 * S
    hw0, hw1 = 0.08 * S, 0.05 * S            # half widths: 0.16*S at the hub, 0.10*S at the tip
    tip = max(2, min(4, int(round(0.04 * S))))

    def quad(th, u0, u1, v0a, v0b, v1a, v1b):
        dx, dy = math.sin(th), -math.cos(th)
        px, py = math.cos(th), math.sin(th)
        pts = [(u0, v0a), (u1, v1a), (u1, v1b), (u0, v0b)]
        return [(c + u * dx + v * px, c + u * dy + v * py) for u, v in pts]

    def hw(u):
        return hw0 + (hw1 - hw0) * (u - u_in) / (u_out - u_in)
    for i in range(N):
        th = 2 * math.pi * i / N
        dr.polygon(quad(th, u_in, u_out, -hw0, hw0, -hw1, hw1), fill=shade(metal, 1.0) + (255,))
        # lighter leading edge, darker trailing edge
        dr.polygon(quad(th, u_in, u_out, -hw0, -0.45 * hw0, -hw1, -0.45 * hw1), fill=shade(metal, 1.22) + (255,))
        dr.polygon(quad(th, u_in, u_out, 0.45 * hw0, hw0, 0.45 * hw1, hw1), fill=shade(metal, 0.70) + (255,))
        ut = u_out - tip
        dr.polygon(quad(th, ut, u_out, -hw(ut), hw(ut), -hw1, hw1), fill=acc + (255,))
    return im


def top(n):
    d = DRILLS[n]
    S = d['size'] * 32
    acc, metal, steel = TIER[n]
    a = Art(S)
    c = S / 2
    if n >= 3:
        outer = a.round_disc(c, c, 0.20 * S)
        inner = a.round_disc(c, c, 0.20 * S - 2)
        a.flat(ImageChops.subtract(outer, inner), steel)
    a.plate(a.octagon(c, c, 0.15 * S), metal, 3 if S >= 128 else 2, 1)
    a.flat(a.round_disc(c, c, 0.07 * S), shade(steel, 0.45))
    return a.im


def item(n):
    S = DRILLS[n]['size'] * 32
    a = Art(S)
    r = 0.06 * S
    a.flat(a.where(lambda x, y: abs(x - S / 2) + abs(y - S / 2) <= r), (255, 255, 255))
    return a.im


def hjson(n):
    d = DRILLS[n]
    lines = [
        "type: Drill",
        f"name: Rapid Drill {ROMAN[n]}",
        f"description: {EN[n]}",
        "category: production",
        f"research: {'mechanical-drill' if n == 1 else 'rapid-drill-%d' % (n - 1)}",
        "requirements: [",
    ] + [f"  {i}/{c}" for i, c in d['cost']] + [
        "]",
        f"size: {d['size']}",
        f"health: {90 * d['size'] ** 2}",
        f"tier: {d['tier']}",
        f"drillTime: {d['time']}",
        f"rotateSpeed: {d['rot']}",
        "consumes: {",
    ]
    if d['power']:
        lines.append(f"  power: {d['power']}")
    lines += [
        "  liquid: {",
        "    liquid: water",
        f"    amount: {d['boost']}",
        "    optional: true",
        "    booster: true",
        "  }",
        "}",
    ]
    return "\n".join(lines) + "\n"


def build(root):
    en, ru = [], []
    for n in DRILLS:
        name = f"rapid-drill-{n}"
        open(f"{root}/content/blocks/{name}.hjson", "w").write(hjson(n))
        base(n).save(f"{root}/sprites/blocks/{name}.png")
        rotator(n).save(f"{root}/sprites/blocks/{name}-rotator.png")
        top(n).save(f"{root}/sprites/blocks/{name}-top.png")
        item(n).save(f"{root}/sprites/blocks/{name}-item.png")
        key = f"block.rapid-turret-{name}"
        en += [f"{key}.name = Rapid Drill {ROMAN[n]}", f"{key}.description = {EN[n]}"]
        ru += [f"{key}.name = Бур Rapid {ROMAN[n]}", f"{key}.description = {RU[n]}"]
    return en, ru
