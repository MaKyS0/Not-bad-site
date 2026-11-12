"""Power: Dynamo I-IV (ConsumeGenerator), Rapid Solar Array (SolarGenerator), Rapid Capacitor (Battery).
DESIGN.md sections 30, 31.6-31.8."""
from PIL import Image, ImageChops

from art import Art, TIER, ROMAN, shade, hexc, emblem

AZURE = (80, 140, 255)
PV = (38, 58, 104)

GEN = {
    1: dict(size=2, health=320, power=4, fuel="itemFlammable: {\n    minFlammability: 0.2\n  }", dur=90, liquid=None, cap=None,
            emb=10, cost=[("copper", 60), ("lead", 50), ("graphite", 30), ("silicon", 20)], rm=1),
    2: dict(size=3, health=800, power=13, fuel="itemFlammable: {\n    minFlammability: 0.2\n  }", dur=60,
            liquid=("water", 0.2), cap=30, emb=14,
            cost=[("copper", 150), ("lead", 150), ("graphite", 100), ("silicon", 100), ("titanium", 80), ("metaglass", 50)],
            rm=1),
    3: dict(size=3, health=900, power=26, fuel="itemRadioactive: {\n    minRadioactivity: 0.2\n  }", dur=240, liquid=None,
            cap=None, emb=14,
            cost=[("lead", 350), ("silicon", 300), ("graphite", 200), ("thorium", 250), ("plastanium", 100),
                  ("metaglass", 80)], rm=0.8),
    4: dict(size=4, health=1800, power=65, fuel="item: phase-fabric", dur=180, liquid=("cryofluid", 0.25), cap=60, emb=22,
            cost=[("lead", 600), ("silicon", 500), ("graphite", 400), ("thorium", 350), ("plastanium", 250),
                  ("surge-alloy", 200), ("phase-fabric", 100), ("metaglass", 200)], rm=0.5),
}
EN = {
    1: "Compact burner. Turns coal, spore pods or pyratite into 240 power units a second.",
    2: "Water-cooled burner: 780 power units a second, enough for a Pulse III.",
    3: "Thorium cell. 1560 power units a second with no coolant and no meltdown.",
    4: "Phase core cooled with cryofluid. 3900 power units a second.",
}
RU = {
    1: "Компактная топка. Превращает уголь, споры или пиротит в 240 единиц энергии в секунду.",
    2: "Топка с водяным охлаждением: 780 единиц энергии в секунду — хватит на Импульс III.",
    3: "Ториевый элемент. 1560 единиц энергии в секунду без охлаждения и без взрывов.",
    4: "Фазовое ядро с криогенным охлаждением. 3900 единиц энергии в секунду.",
}
SOLAR_EN = "Dense solar array. 180 power units a second with no fuel at all."
SOLAR_RU = "Плотная солнечная батарея. 180 единиц энергии в секунду вообще без топлива."
BAT_EN = "Stores 80000 power units — enough to keep a Pulse IV firing for almost a minute."
BAT_RU = "Хранит 80000 единиц энергии — хватит почти на минуту стрельбы Импульса IV."


def req(cost):
    return ["requirements: ["] + [f"  {i}/{n}" for i, n in cost] + ["]"]


# ---------------------------------------------------------------- Dynamo sprites (31.6)

def gen_geom(n):
    S = GEN[n]['size'] * 32
    c = S // 2
    b = 1 if S == 64 else 2
    return S, c, b, 2 * b, int(round(0.17 * S))


def generator(n):
    S, c, b, ins, rr = gen_geom(n)
    acc, metal, steel = TIER[n]
    dark = shade(steel, 0.45)
    a = Art(S)
    # 1. frame
    a.box(0, 0, S - 1, S - 1, shade(steel, 0.7))
    a.box(b, b, S - 1 - b, S - 1 - b, steel)
    a.plate(a.cham(ins, ins, S - 1 - ins, S - 1 - ins, 3 * b), metal, 3 if S >= 96 else 2)
    # 2. fin banks (left side; mirrored)
    fw, fh = int(round(0.10 * S)), int(round(0.26 * S))
    x0 = ins + 3 * b
    a.sunk(a.rect(x0, c - fh, x0 + fw - 1, c + fh - 1), steel)
    for y in range(c - fh, c + fh, 3 * b):
        a.flat(a.rect(x0 + 1, y, x0 + fw - 2, y + b - 1), shade(steel, 0.62))
    # 3. core socket
    sock = int(round(0.25 * S))
    a.flat(a.octagon(c, c, sock + 2 * b), shade(steel, 0.62))
    a.sunk(a.octagon(c, c, sock), steel)
    # 4. core (unlit)
    a.flat(a.round_disc(c, c, rr), shade(acc, 0.40))
    a.flat(a.round_disc(c, c - b, rr - 2 * b), shade(acc, 0.55))
    a.flat(a.round_disc(c, c - b, int(round(0.07 * S))), shade(acc, 0.75))
    # 5. electrode cage
    cage = ImageChops.lighter(a.rect(c - b, c - rr, c + b - 1, c + rr - 1), a.rect(c - rr, c - b, c + rr - 1, c + b - 1))
    a.flat(cage, dark)
    # 6. corner blocks (all four)
    riv = shade(metal, 0.62)
    L = int(round(0.10 * S))
    for fy in (0, 1):
        def Y(v, w=1):
            return S - 1 - v - (w - 1) if fy else v
        a.flat(a.rect(ins + 3 * b, Y(ins + 3 * b, 2 * b), ins + 5 * b - 1, Y(ins + 3 * b, 2 * b) + 2 * b - 1), riv)
        a.flat(a.rect(ins + 6 * b, Y(ins + 6 * b, b), ins + 6 * b + L - 1, Y(ins + 6 * b, b) + b - 1), acc)
        a.flat(a.rect(ins + 6 * b, Y(ins + 6 * b, L), ins + 7 * b - 1, Y(ins + 6 * b, L) + L - 1), acc)
    # 7. tier pips
    p = 2 * b
    total = n * p + (n - 1) * p
    px0 = c - total // 2
    for i in range(n):
        a.box(px0 + i * 2 * p, ins + 3 * b, px0 + i * 2 * p + p - 1, ins + 3 * b + p - 1, acc)
    # 8. liquid caps
    if GEN[n]['liquid']:
        inner = px0 - 6 * b
        a.flat(a.rect(inner - 4 * b, ins + 3 * b, inner - 1, ins + 5 * b - 1), AZURE)
    # 9. emblem in the bottom band
    w = GEN[n]['emb']
    band_top = c + sock + 2 * b + 1
    band_bot = S - 1 - ins
    emblem(a, c, (band_top + band_bot + 1) / 2, w, b, acc)

    # -top: glow layer (white), minus the cage
    top = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    outer = a.round_disc(c, c, rr).point(lambda v: 150 if v else 0)
    inner_m = a.round_disc(c, c - b, rr - 2 * b)
    alpha = ImageChops.lighter(outer, inner_m)
    alpha = ImageChops.subtract(alpha, cage)
    top.paste((255, 255, 255, 255), mask=alpha.point(lambda v: 255 if v else 0))
    top.putalpha(alpha)
    return a.im, top


def gen_hjson(n):
    g = GEN[n]
    acc = TIER[n][0]
    lines = [
        "type: ConsumeGenerator",
        f"name: Dynamo {ROMAN[n]}",
        f"description: {EN[n]}",
        "category: power",
        f"research: {'combustion-generator' if n == 1 else 'rapid-generator-%d' % (n - 1)}",
    ] + req(g['cost']) + [
        f"researchCostMultiplier: {g['rm']}",
        f"size: {g['size']}",
        f"health: {g['health']}",
        f"powerProduction: {g['power']}",
        f"itemDuration: {g['dur']}",
        "generateEffect: generatespark",
        "ambientSound: smelter",
        "ambientSoundVolume: 0.03",
    ]
    if g['cap']:
        lines.append(f"liquidCapacity: {g['cap']}")
    lines += ["consumes: {", "  " + g['fuel']]
    if g['liquid']:
        lines += ["  liquid: {", f"    liquid: {g['liquid'][0]}", f"    amount: {g['liquid'][1]}", "  }"]
    lines += ["}", "drawer: [", "  {", "    type: DrawDefault", "  }", "  {", "    type: DrawWarmupRegion",
              f"    color: {hexc(acc)}", "  }", "]"]
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------- Solar array (31.7) and capacitor (31.8)

def frame96(a, acc, metal, steel):
    a.box(0, 0, 95, 95, shade(steel, 0.7))
    a.box(2, 2, 93, 93, steel)
    a.plate(a.cham(4, 4, 91, 91, 6), metal, 3)


def rivets96(a, metal):
    for x in (6, 88):
        for y in (6, 88):
            a.box(x, y, x + 1, y + 1, shade(metal, 0.62))


def solar():
    acc, metal, steel = TIER[2]
    a = Art(96)
    frame96(a, acc, metal, steel)
    for i in range(3):
        for j in range(3):
            x0, y0 = 10 + 26 * i, 10 + 26 * j
            a.sunk(a.rect(x0, y0, x0 + 23, y0 + 23), PV, 1, sym=False)
            for o in (8, 16):
                a.box(x0 + o, y0 + 1, x0 + o, y0 + 22, shade(PV, 1.35))
                a.box(x0 + 1, y0 + o, x0 + 22, y0 + o, shade(PV, 1.35))
            for k in range(6):
                a.box(x0 + 1, y0 + 1 + k, x0 + 6 - k, y0 + 1 + k, shade(PV, 1.7))
    emblem(a, 48, 48, 10, 1, acc)
    rivets96(a, metal)
    return a.im


def battery():
    acc, metal, steel = TIER[2]
    dark = shade(steel, 0.45)
    a = Art(96)
    frame96(a, acc, metal, steel)
    windows, wd = a.mask()
    for k in range(3):
        x0 = 20 + 20 * k
        a.box(x0 - 2, 20, x0 + 17, 75, shade(steel, 0.62))
        wd.rectangle((x0, 22, x0 + 15, 73), fill=255)
        a.plate(a.rect(x0 + 4, 14, x0 + 11, 18), steel, 1, 1, sym=False)
    a.box(47, 16, 48, 16, acc)
    emblem(a, 48, 84, 10, 1, acc)
    rivets96(a, metal)
    rungs, rd = a.mask()
    for y in (34, 47, 60):
        rd.line((0, y, 95, y), fill=255)
    holes = ImageChops.subtract(windows, rungs)
    # art A: windows = steel x 0.62 rungs on whatever is under; build both files
    a.flat(ImageChops.multiply(windows, rungs), shade(steel, 0.62), sym=False)
    top = a.im.copy()
    top.paste((0, 0, 0, 0), mask=holes)
    base = a.im.copy()
    base.paste(dark + (255,), mask=holes)
    return base, top


def solar_hjson():
    return "\n".join([
        "type: SolarGenerator",
        "name: Rapid Solar Array",
        f"description: {SOLAR_EN}",
        "category: power",
        "research: solar-panel-large",
    ] + req([("lead", 150), ("silicon", 200), ("titanium", 60), ("phase-fabric", 25)]) + [
        "size: 3",
        "health: 500",
        "powerProduction: 3",
    ]) + "\n"


def battery_hjson():
    return "\n".join([
        "type: Battery",
        "name: Rapid Capacitor",
        f"description: {BAT_EN}",
        "category: power",
        "research: battery-large",
    ] + req([("titanium", 50), ("lead", 100), ("silicon", 60), ("plastanium", 15)]) + [
        "size: 3",
        "health: 600",
        'emptyLightColor: "3c4660"',
        'fullLightColor: "5ad7ff"',
        "consumes: {",
        "  powerBuffered: 80000",
        "}",
    ]) + "\n"


def build(root):
    en, ru = [], []
    for n in GEN:
        name = f"rapid-generator-{n}"
        open(f"{root}/content/blocks/{name}.hjson", "w").write(gen_hjson(n))
        im, top = generator(n)
        im.save(f"{root}/sprites/blocks/{name}.png")
        top.save(f"{root}/sprites/blocks/{name}-top.png")
        key = f"block.rapid-turret-{name}"
        en += [f"{key}.name = Dynamo {ROMAN[n]}", f"{key}.description = {EN[n]}"]
        ru += [f"{key}.name = Динамо {ROMAN[n]}", f"{key}.description = {RU[n]}"]
    open(f"{root}/content/blocks/rapid-solar.hjson", "w").write(solar_hjson())
    solar().save(f"{root}/sprites/blocks/rapid-solar.png")
    open(f"{root}/content/blocks/rapid-battery.hjson", "w").write(battery_hjson())
    base, top = battery()
    base.save(f"{root}/sprites/blocks/rapid-battery.png")
    top.save(f"{root}/sprites/blocks/rapid-battery-top.png")
    en += [f"block.rapid-turret-rapid-solar.name = Rapid Solar Array", f"block.rapid-turret-rapid-solar.description = {SOLAR_EN}",
           f"block.rapid-turret-rapid-battery.name = Rapid Capacitor", f"block.rapid-turret-rapid-battery.description = {BAT_EN}"]
    ru += [f"block.rapid-turret-rapid-solar.name = Солнечная батарея Rapid",
           f"block.rapid-turret-rapid-solar.description = {SOLAR_RU}",
           f"block.rapid-turret-rapid-battery.name = Накопитель Rapid", f"block.rapid-turret-rapid-battery.description = {BAT_RU}"]
    return en, ru
