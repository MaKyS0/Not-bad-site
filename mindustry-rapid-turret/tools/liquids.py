"""Rapid Flow liquids: conduits, liquid router, liquid bridges, tank, pumps. DESIGN.md sections 45-47, 49.1-49.5, 50."""
from PIL import Image, ImageChops

from art import Art, TIER, shade, mix, emblem

AZURE = (80, 140, 255)
WHITE = (255, 255, 255)

CONDUITS = {
    1: dict(type="Conduit", health=80, cap=20, pressure=1.03, bot="32323a", tier=1,
            cost=[("titanium", 1), ("metaglass", 2), ("graphite", 1)], research="conduit",
            en="Rapid Conduit I", ru="Трубопровод Rapid I",
            en_d="Wide conduit with flow arrows. Carries twice as much as a conduit. Leaks from open ends.",
            ru_d="Широкий трубопровод со стрелками потока. Пропускает вдвое больше обычного. Протекает на открытых концах."),
    2: dict(type="ArmoredConduit", health=320, cap=50, pressure=1.06, bot="2b3332", tier=3,
            cost=[("thorium", 2), ("metaglass", 2), ("plastanium", 1), ("rapid-steel", 1)], research="rapid-conduit-1",
            en="Rapid Conduit II", ru="Трубопровод Rapid II",
            en_d="Armoured conduit: never leaks, takes liquid only from pipes and from behind. Carries a whole pump station.",
            ru_d="Бронированный трубопровод: не протекает, принимает жидкость только из труб и сзади. Пропускает целую насосную станцию."),
}

OTHER = {
    "rapid-liquid-router": dict(type="LiquidRouter", size=1, health=150, tier=1,
                                fields=["liquidCapacity: 80", "solid: false", "underBullets: true"],
                                cost=[("graphite", 6), ("metaglass", 6), ("titanium", 4)], research="liquid-router",
                                en="Rapid Liquid Router", ru="Жидкостный маршрутизатор Rapid",
                                en_d="Splits liquid to all sides without throttling large flows.",
                                ru_d="Распределяет жидкость во все стороны и не душит большие потоки."),
    "rapid-liquid-bridge": dict(type="LiquidBridge", size=1, health=110, tier=1,
                                fields=["range: 7", "hasPower: false", "liquidCapacity: 40", "fadeIn: false",
                                        "arrowSpacing: 8"],
                                cost=[("graphite", 8), ("metaglass", 12), ("titanium", 4)], research="bridge-conduit",
                                en="Rapid Bridge Conduit", ru="Мостовой трубопровод Rapid",
                                en_d="Carries liquid over 6 tiles of anything. Four times the flow of a bridge conduit, no power.",
                                ru_d="Переносит жидкость над 6 клетками чего угодно. Вчетверо больше потока, чем у обычного моста, без энергии."),
    "rapid-phase-conduit": dict(type="LiquidBridge", size=1, health=160, tier=4,
                                fields=["range: 16", "liquidCapacity: 60", "pulse: true", "arrowSpacing: 8",
                                        "arrowPeriod: 0.9", "arrowTimeScl: 2.75", "consumes: {", "  power: 0.5", "}"],
                                cost=[("rapid-steel", 6), ("phase-fabric", 5), ("silicon", 10), ("metaglass", 25)],
                                research="phase-conduit", en="Rapid Phase Conduit", ru="Фазовый трубопровод Rapid",
                                en_d="Teleports liquid across 15 tiles. Needs power.",
                                ru_d="Телепортирует жидкость через 15 клеток. Требует энергию."),
    "rapid-liquid-tank": dict(type="LiquidRouter", size=3, health=1200, tier=3,
                              fields=["liquidCapacity: 5000", "liquidPadding: 4"],
                              cost=[("titanium", 90), ("metaglass", 120), ("rapid-steel", 40)], research="liquid-tank",
                              en="Rapid Liquid Tank", ru="Жидкостный бак Rapid",
                              en_d="Holds 5000 units of liquid — almost three liquid tanks.",
                              ru_d="Вмещает 5000 единиц жидкости — почти три обычных бака."),
}

PUMPS = {
    1: dict(size=2, health=180, amount=0.15, power=None, cap=40, L=34, emb=8,
            cost=[("copper", 60), ("lead", 40), ("graphite", 30), ("metaglass", 40)], research="mechanical-pump", rm=1,
            en_d="Pumps 36 liquid a second without power — enough for one Rapid Compressor.",
            ru_d="Качает 36 единиц жидкости в секунду без энергии — хватит на один компрессор Rapid."),
    2: dict(size=3, health=480, amount=0.4, power=2.5, cap=150, L=48, emb=10,
            cost=[("titanium", 150), ("metaglass", 120), ("silicon", 80), ("graphite", 80), ("rapid-steel", 50)],
            research="rapid-pump-1", rm=1,
            en_d="Pumps 216 liquid a second. Needs power.",
            ru_d="Качает 216 единиц жидкости в секунду. Требует энергию."),
    3: dict(size=4, health=1000, amount=0.6, power=7, cap=400, L=66, emb=14,
            cost=[("titanium", 300), ("metaglass", 250), ("silicon", 200), ("thorium", 150), ("plastanium", 60),
                  ("rapid-steel", 120)], research="rapid-pump-2", rm=0.8,
            en_d="Pumps 576 liquid a second — five impulse pumps in one. Needs Rapid conduits to carry it away.",
            ru_d="Качает 576 единиц жидкости в секунду — пять термальных насосов в одном. Отводить нужно трубопроводами Rapid."),
}
ROMAN = {1: "I", 2: "II", 3: "III"}


def fmt(v):
    return str(int(v)) if v == int(v) else str(v)


# ---------------------------------------------------------------- conduit tops (49.1)

def channel(k):
    H = lambda x, y: 8 <= y <= 23   # noqa: E731
    V = lambda x, y: 8 <= x <= 23   # noqa: E731
    if k == 0:
        return lambda x, y: H(x, y)
    if k == 1:
        def c1(x, y):
            if 20 <= y <= 23 and 8 <= x <= y - 12:
                return False
            return (V(x, y) and y <= 23) or (H(x, y) and x >= 8)
        return c1
    if k == 2:
        return lambda x, y: H(x, y) or (V(x, y) and y >= 24)
    if k == 3:
        return lambda x, y: H(x, y) or V(x, y)
    return lambda x, y: (H(x, y) and x >= 8) or V(x, y)


WALLS = {0: ("top", "bottom"), 1: ("left", "bottom"), 2: ("top",), 3: (), 4: ("left",)}


def chevron(x0):
    pts = []
    for k in range(4):
        pts += [(x0 + 4 - k, 15 - k), (x0 + 3 - k, 15 - k), (x0 + 4 - k, 16 + k), (x0 + 3 - k, 16 + k)]
    return pts


def arrows(k):
    A, B = chevron(5), chevron(21)
    D = [(31 - y, x) for x, y in A]
    U = [(y, 31 - x) for x, y in A]
    return {0: A + B, 1: D + B, 2: A + B + U, 3: A + B + U + D, 4: B + U + D}[k]


def conduit_top(n, k):
    acc, metal, steel = TIER[CONDUITS[n]['tier']]
    ar = mix(shade(steel, 0.9), acc, 0.65)
    chan = channel(k)
    walls = WALLS[k]
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = im.load()
    for y in range(32):
        for x in range(32):
            if chan(x, y):
                continue
            dist = {"top": y, "bottom": 31 - y, "left": x}
            F = [w for w in walls if dist[w] < 8]
            straight = False
            if len(F) == 1:
                d = dist[F[0]]
                s = x if F[0] in ("top", "bottom") else y
                straight = True
            elif len(F) == 2:
                d, s = min(dist[w] for w in F), 0
            else:
                d, s = max(min(x, 31 - x), min(y, 31 - y)), 0
            if d >= 8:
                col = shade(metal, 0.7)      # only the shape-1 chamfer reaches here; overwritten below anyway
            elif d == 2:
                if n == 1:
                    col = acc if straight and (5 <= s <= 10 or 21 <= s <= 26) else steel
                else:
                    col = acc
            else:
                col = {0: shade(steel, 0.7), 1: steel, 3: steel, 4: shade(metal, 1.2), 5: metal, 6: metal,
                       7: shade(metal, 0.7)}[d]
                if n == 2 and straight and d in (5, 6) and s in (7, 8, 23, 24):
                    col = shade(metal, 0.62)
            px[x, y] = col + (255,)
    if k == 1:
        for y in range(32):
            for x in range(32):
                q = x + 31 - y
                if q <= 6:
                    px[x, y] = (0, 0, 0, 0)
                elif q in (7, 8):
                    px[x, y] = shade(steel, 0.7) + (255,)
                if 20 <= y <= 23 and 8 <= x <= y - 12:
                    px[x, y] = shade(metal, 0.7) + (255,)
    for x, y in arrows(k):
        px[x, y] = ar + (255,)
    return im


def conduit_cap():
    acc, metal, steel = TIER[3]
    a = Art(32)
    a.box(28, 8, 28, 23, shade(metal, 0.7))
    a.box(29, 8, 30, 23, metal)
    a.box(31, 8, 31, 23, shade(steel, 0.7))
    a.box(29, 15, 30, 16, acc)
    return a.im


# ---------------------------------------------------------------- router (49.2), bridges (49.3), tank (49.4)

def router():
    acc, metal, steel = TIER[1]
    dark = shade(steel, 0.45)
    bottom = Art(32)
    bottom.box(0, 0, 31, 31, dark)
    a = Art(32)
    a.box(0, 0, 31, 31, shade(steel, 0.7))
    a.plate(a.cham(1, 1, 30, 30, 3), metal, 2)
    a.flat(a.round_disc(16, 16, 9.5), shade(steel, 0.62))
    a.im.paste((0, 0, 0, 0), mask=a.round_disc(16, 16, 7.5))
    a.box(15, 15, 16, 16, acc)
    for r in ((15, 3, 16, 5), (15, 26, 16, 28), (3, 15, 5, 16), (26, 15, 28, 16)):
        a.box(*r, AZURE)
    return a.im, bottom.im


def liquid_bridge(tier, phase):
    acc, metal, steel = TIER[tier]
    a = Art(32)
    a.box(0, 0, 31, 31, shade(steel, 0.7))
    a.plate(a.cham(1, 1, 30, 30, 3), metal, 2)
    a.flat(a.round_disc(16, 16, 9), shade(steel, 0.62))
    a.sunk(a.round_disc(16, 16, 7), shade(AZURE, 0.45))
    for r in ((15, 3, 16, 5), (15, 26, 16, 28), (3, 15, 5, 16), (26, 15, 28, 16)):
        a.box(*r, acc)
    if phase:
        a.flat(a.round_disc(16, 16, 4), shade(acc, 0.75))
        a.flat(a.round_disc(16, 15, 2), mix(acc, WHITE, 0.5))
    else:
        a.flat(a.round_disc(16, 15, 3), AZURE)
    e = Art(32)
    e.flat(e.poly([(8, 24), (23, 24), (27, 28), (27, 31), (4, 31), (4, 28)]), metal, sym=False)
    e.box(8, 24, 23, 24, shade(metal, 0.7))
    e.box(12, 30, 19, 31, AZURE)
    s = Art(32)
    A45, A70 = shade(AZURE, 0.45), shade(AZURE, 0.7)
    rows = [(4, 5, shade(metal, 0.7)), (6, 9, metal), (10, 11, A45), (12, 14, A70), (15, 16, mix(AZURE, WHITE, 0.5)),
            (17, 19, A70), (20, 21, A45), (22, 25, metal), (26, 27, shade(metal, 0.7))]
    if phase:
        rows = [(4, 5, shade(metal, 0.7)), (6, 9, metal), (10, 11, A45), (12, 13, A70), (14, 17, acc), (18, 19, A70),
                (20, 21, A45), (22, 25, metal), (26, 27, shade(metal, 0.7))]
    for y0, y1, col in rows:
        s.box(0, y0, 31, y1, col)
    ar = Art(32)
    col = mix(acc, WHITE, 0.5) if phase else mix(AZURE, WHITE, 0.6)
    for y in range(8, 24):
        ar.box(12, y, 12 + min(y - 8, 23 - y), y, col)
    return a.im, e.im, s.im, ar.im


def tank():
    acc, metal, steel = TIER[3]
    dark = shade(steel, 0.45)
    a = Art(96)
    a.box(0, 0, 95, 95, shade(steel, 0.7))
    a.box(2, 2, 93, 93, steel)
    a.plate(a.cham(4, 4, 91, 91, 6), metal, 3)
    a.flat(a.cham(18, 18, 77, 77, 8), shade(steel, 0.62))
    W = a.cham(22, 22, 73, 73, 6)
    braces = ImageChops.lighter(a.rect(44, 22, 51, 73), a.rect(22, 44, 73, 51))
    hub = a.round_disc(48, 48, 11)
    a.plate(a.rect(44, 22, 51, 73), steel, 1)
    a.plate(a.rect(22, 44, 73, 51), steel, 1)
    a.plate(hub, metal, 2)
    a.flat(a.round_disc(48, 48, 7), shade(AZURE, 0.75))
    a.flat(a.round_disc(48, 47, 3), mix(AZURE, WHITE, 0.5))
    for x in (10, 82):
        for y in (10, 82):
            a.box(x, y, x + 3, y + 3, AZURE)
    emblem(a, 48, 85, 10, 1, acc)
    for x in (6, 88):
        for y in (6, 88):
            a.box(x, y, x + 1, y + 1, shade(metal, 0.62))
    panes = ImageChops.subtract(ImageChops.subtract(W, braces), hub)
    top = a.im.copy()
    top.paste((0, 0, 0, 0), mask=panes)
    b = Art(96)
    b.box(0, 0, 95, 95, dark)
    for y in (28, 36, 44, 52, 60, 68):
        b.box(22, y, 73, y, shade(steel, 0.62))
    return top, b.im


# ---------------------------------------------------------------- pumps (49.5)

def frame(a, S, b, ins, n):
    acc, metal, steel = TIER[n]
    a.box(0, 0, S - 1, S - 1, shade(steel, 0.7))
    a.box(b, b, S - 1 - b, S - 1 - b, steel)
    a.plate(a.cham(ins, ins, S - 1 - ins, S - 1 - ins, 3 * b), metal, 3 if S >= 96 else 2)
    riv = shade(metal, 0.62)
    L = int(round(0.10 * S))
    for fy in (0, 1):
        def Y(v, w=1):
            return S - 1 - v - (w - 1) if fy else v
        a.flat(a.rect(ins + 3 * b, Y(ins + 3 * b, 2 * b), ins + 5 * b - 1, Y(ins + 3 * b, 2 * b) + 2 * b - 1), riv)
        a.flat(a.rect(ins + 6 * b, Y(ins + 6 * b, b), ins + 6 * b + L - 1, Y(ins + 6 * b, b) + b - 1), acc)
        a.flat(a.rect(ins + 6 * b, Y(ins + 6 * b, L), ins + 7 * b - 1, Y(ins + 6 * b, L) + L - 1), acc)


def pips(a, n, c, top, p, acc):
    total = n * p + (n - 1) * p
    x0 = c - total // 2
    for i in range(n):
        a.box(x0 + i * 2 * p, top, x0 + i * 2 * p + p - 1, top + p - 1, acc)


def pump(n):
    p_ = PUMPS[n]
    S = p_['size'] * 32
    c = S // 2
    b = 1 if S == 64 else 2
    ins = 2 * b
    acc, metal, steel = TIER[n]
    dark = shade(steel, 0.45)
    R = int(round(0.27 * S))
    a = Art(S)
    frame(a, S, b, ins, n)
    a.flat(a.round_disc(c, c, R + 2 * b), shade(steel, 0.62))
    a.sunk(a.round_disc(c, c, R), dark)
    a.flat(a.round_disc(c, c, R - 2 * b), shade(AZURE, 0.30))
    bars = ImageChops.lighter(a.rect(c - R + 2 * b, c - 2 * b, c + R - 2 * b - 1, c + 2 * b - 1),
                              a.rect(c - 2 * b, c - R + 2 * b, c + 2 * b - 1, c + R - 2 * b - 1))
    a.plate(a.rect(c - R + 2 * b, c - 2 * b, c + R - 2 * b - 1, c + 2 * b - 1), metal, 1)
    a.plate(a.rect(c - 2 * b, c - R + 2 * b, c + 2 * b - 1, c + R - 2 * b - 1), metal, 1)
    hubm = a.round_disc(c, c, int(round(0.09 * S)))
    a.plate(hubm, metal, 2)
    a.flat(a.round_disc(c, c, int(round(0.045 * S))), acc)
    pips(a, n, c, ins + 3 * b, 2 * b, acc)
    band0, band1 = c + R + 2 * b + 1, S - 1 - ins
    emblem(a, c, (band0 + band1 + 1) / 2, p_['emb'], b, acc)
    M = ImageChops.subtract(ImageChops.subtract(a.round_disc(c, c, R - 2 * b), bars), hubm)
    liq = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    liq.paste((255, 255, 255, 255), mask=M)
    L = p_['L']
    liq = liq.crop((c - L // 2, c - L // 2, c + L // 2, c + L // 2))
    return a.im, liq


# ---------------------------------------------------------------- hjson

def req(cost):
    return ["requirements: ["] + [f"  {i}/{n}" for i, n in cost] + ["]"]


def conduit_hjson(n):
    c = CONDUITS[n]
    return "\n".join([f"type: {c['type']}", f"name: {c['en']}", f"description: {c['en_d']}", "category: liquid",
                      f"research: {c['research']}"] + req(c['cost']) + [
        f"health: {c['health']}", f"liquidCapacity: {c['cap']}", f"liquidPressure: {c['pressure']}",
        f'botColor: "{c["bot"]}"', "bridgeReplacement: rapid-liquid-bridge"]) + "\n"


def other_hjson(name):
    o = OTHER[name]
    return "\n".join([f"type: {o['type']}", f"name: {o['en']}", f"description: {o['en_d']}", "category: liquid",
                      f"research: {o['research']}"] + req(o['cost']) + [f"size: {o['size']}", f"health: {o['health']}"] +
                     o['fields']) + "\n"


def pump_hjson(n):
    p = PUMPS[n]
    lines = ["type: Pump", f"name: Rapid Pump {ROMAN[n]}", f"description: {p['en_d']}", "category: liquid",
             f"research: {p['research']}"] + req(p['cost'])
    if p['rm'] != 1:
        lines.append(f"researchCostMultiplier: {p['rm']}")
    lines += [f"size: {p['size']}", f"health: {p['health']}", f"pumpAmount: {p['amount']}",
              f"liquidCapacity: {p['cap']}"]
    if p['power']:
        lines += ["consumes: {", f"  power: {fmt(p['power'])}", "}"]
    return "\n".join(lines) + "\n"


def build(root):
    out = f"{root}/sprites/blocks"
    en, ru = [], []

    def text(name, e_name, e_desc, r_name, r_desc):
        key = f"block.rapid-turret-{name}"
        en.extend([f"{key}.name = {e_name}", f"{key}.description = {e_desc}"])
        ru.extend([f"{key}.name = {r_name}", f"{key}.description = {r_desc}"])

    for n, c in CONDUITS.items():
        name = f"rapid-conduit-{n}"
        open(f"{root}/content/blocks/{name}.hjson", "w").write(conduit_hjson(n))
        for k in range(5):
            conduit_top(n, k).save(f"{out}/{name}-top-{k}.png")
        text(name, c['en'], c['en_d'], c['ru'], c['ru_d'])
    conduit_cap().save(f"{out}/rapid-conduit-2-cap.png")
    for name, o in OTHER.items():
        open(f"{root}/content/blocks/{name}.hjson", "w").write(other_hjson(name))
        text(name, o['en'], o['en_d'], o['ru'], o['ru_d'])
    top, bot = router()
    top.save(f"{out}/rapid-liquid-router.png")
    bot.save(f"{out}/rapid-liquid-router-bottom.png")
    for name, tier, phase in (("rapid-liquid-bridge", 1, False), ("rapid-phase-conduit", 4, True)):
        base, end, strip, arrow = liquid_bridge(tier, phase)
        base.save(f"{out}/{name}.png")
        end.save(f"{out}/{name}-end.png")
        strip.save(f"{out}/{name}-bridge.png")
        arrow.save(f"{out}/{name}-arrow.png")
    top, bot = tank()
    top.save(f"{out}/rapid-liquid-tank.png")
    bot.save(f"{out}/rapid-liquid-tank-bottom.png")
    for n, p in PUMPS.items():
        name = f"rapid-pump-{n}"
        open(f"{root}/content/blocks/{name}.hjson", "w").write(pump_hjson(n))
        im, liq = pump(n)
        im.save(f"{out}/{name}.png")
        liq.save(f"{out}/{name}-liquid.png")
        text(name, f"Rapid Pump {ROMAN[n]}", p['en_d'], f"Насос Rapid {ROMAN[n]}", p['ru_d'])
    return en, ru
