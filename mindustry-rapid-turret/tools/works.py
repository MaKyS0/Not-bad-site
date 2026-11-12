"""Rapid Works: the Rapid Steel item and five GenericCrafter blocks. DESIGN.md sections 36-38, 40.1-40.3, 41."""
from PIL import Image, ImageChops

from art import Art, TIER, shade, mix, emblem

STEEL_BLUE = (143, 180, 230)
GOLD = (255, 190, 80)
OIL = (58, 54, 66)
WHITE = (255, 255, 255)

ITEM_EN = ("Tempered titanium-graphite alloy. Armour-piercing ammo for Rapid III-VI and the frame of advanced Rapid "
           "machinery.")
ITEM_RU = "Закалённый сплав титана и графита. Бронебойные боеприпасы для Rapid III–VI и основа продвинутых механизмов Rapid."

PRODUCT = {"graphite": (178, 198, 210), "silicon": (83, 86, 92), "rapid-steel": STEEL_BLUE,
           "plastanium": (203, 217, 127), "surge-alloy": (243, 233, 121)}

CRAFTERS = {
    "rapid-press": dict(tier=1, size=2, health=380, inputs=[("coal", 4)], out=("graphite", 3), time=45, power=2, cap=20,
                        glow="ffbe50", fx="pulverizeMedium", sound=None, liquid=None, bt=48,
                        cost=[("titanium", 120), ("lead", 120), ("silicon", 60), ("graphite", 60)],
                        research="graphite-press", rm=1, en="Rapid Press", ru="Пресс Rapid",
                        en_d="Presses coal into graphite six times faster than a graphite press. Needs power, no water.",
                        ru_d="Прессует уголь в графит в шесть раз быстрее обычного пресса. Нужна энергия, вода не нужна."),
    "rapid-smelter": dict(tier=2, size=3, health=800, inputs=[("coal", 3), ("sand", 6)], out=("silicon", 4), time=40, power=5,
                          cap=30, glow="ffef99", fx="smeltsmoke", sound="smelter", liquid=None, bt=63,
                          cost=[("copper", 200), ("lead", 150), ("titanium", 150), ("graphite", 120), ("silicon", 100)],
                          research="silicon-smelter", rm=1, en="Rapid Smelter", ru="Плавильня Rapid",
                          en_d="Twin crucibles: 6 silicon a second from coal and sand — four smelters in one.",
                          ru_d="Два тигля: 6 кремния в секунду из угля и песка — четыре плавильни в одном корпусе."),
    "rapid-foundry": dict(tier=3, size=3, health=850, inputs=[("titanium", 3), ("graphite", 2)], out=("rapid-steel", 2),
                          time=60, power=4, cap=20, glow="ffb060", fx="smeltsmoke", sound="smelter", liquid=None, bt=73,
                          cost=[("copper", 180), ("lead", 150), ("titanium", 120), ("silicon", 120), ("graphite", 100)],
                          research="rapid-press", rm=1, en="Rapid Foundry", ru="Литейная Rapid",
                          en_d="Casts titanium and graphite into Rapid Steel.",
                          ru_d="Отливает сталь Rapid из титана и графита."),
    "rapid-compressor": dict(tier=4, size=3, health=900, inputs=[("titanium", 5)], out=("plastanium", 3), time=60, power=8,
                             cap=20, glow="d8f07a", fx="formsmoke", sound=None, liquid=("oil", 0.6), bt=68,
                             cost=[("lead", 300), ("silicon", 250), ("titanium", 250), ("graphite", 180), ("rapid-steel", 80)],
                             research="plastanium-compressor", rm=0.8, en="Rapid Compressor", ru="Компрессор Rapid",
                             en_d="Three plastanium compressors in one housing: 3 plastanium a second from titanium and oil.",
                             ru_d="Три пластаниевых компрессора в одном корпусе: 3 пластания в секунду из титана и нефти."),
    "rapid-arc-furnace": dict(tier=5, size=3, health=1000, inputs=[("copper", 6), ("lead", 8), ("titanium", 4), ("silicon", 6)],
                              out=("surge-alloy", 2), time=60, power=12, cap=40, glow="ffe08a", fx="smeltsmoke",
                              sound="smelter", liquid=None, bt=75,
                              cost=[("silicon", 300), ("lead", 300), ("thorium", 200), ("titanium", 200), ("rapid-steel", 120)],
                              research="surge-smelter", rm=0.6, en="Rapid Arc Furnace", ru="Дуговая печь Rapid",
                              en_d="Smelts 2 surge alloy a second. Hungry: 24 items and 720 power units a second.",
                              ru_d="Выплавляет 2 кинетических сплава в секунду. Прожорлива: 24 предмета и 720 единиц энергии в секунду."),
}


def rgb(hexs):
    return tuple(int(hexs[i:i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------- item (40.1)

def item_sprite():
    a = Art(32)
    a.flat(a.cham(2, 7, 29, 25, 4), shade(STEEL_BLUE, 0.35))
    a.flat(a.cham(3, 8, 28, 24, 3), shade(STEEL_BLUE, 0.62))
    top = a.poly([(6, 8), (25, 8), (28, 11), (28, 17), (3, 17), (3, 11)])
    a.flat(top, STEEL_BLUE)
    a.flat(ImageChops.multiply(a.sym(top), a.rect(0, 8, 31, 9)), shade(STEEL_BLUE, 1.2))
    emblem(a, 16, 13.5, 8, 1, GOLD)
    return a.im


def item_hjson():
    return "\n".join(["name: Rapid Steel", f"description: {ITEM_EN}", 'color: "8fb4e6"', "cost: 1.2",
                      "research: titanium"]) + "\n"


# ---------------------------------------------------------------- crafter sprites (40.2, 40.3)

def frame(name):
    c_ = CRAFTERS[name]
    S = c_['size'] * 32
    c = S // 2
    b = 1 if S == 64 else 2
    ins = 2 * b
    acc, metal, steel = TIER[c_['tier']]
    a = Art(S)
    a.box(0, 0, S - 1, S - 1, shade(steel, 0.7))
    a.box(b, b, S - 1 - b, S - 1 - b, steel)
    a.plate(a.cham(ins, ins, S - 1 - ins, S - 1 - ins, 3 * b), metal, 3 if S == 96 else 2)
    # corner blocks (step 6 of 31.6)
    riv = shade(metal, 0.62)
    L = int(round(0.10 * S))
    for fy in (0, 1):
        def Y(v, w=1):
            return S - 1 - v - (w - 1) if fy else v
        a.flat(a.rect(ins + 3 * b, Y(ins + 3 * b, 2 * b), ins + 5 * b - 1, Y(ins + 3 * b, 2 * b) + 2 * b - 1), riv)
        a.flat(a.rect(ins + 6 * b, Y(ins + 6 * b, b), ins + 6 * b + L - 1, Y(ins + 6 * b, b) + b - 1), acc)
        a.flat(a.rect(ins + 6 * b, Y(ins + 6 * b, L), ins + 7 * b - 1, Y(ins + 6 * b, L) + L - 1), acc)
    # product window
    dark = shade(steel, 0.45)
    a.box(c - 4 * b, ins + 2 * b, c + 4 * b - 1, ins + 6 * b - 1, dark)
    a.box(c - 3 * b, ins + 3 * b, c + 3 * b - 1, ins + 5 * b - 1, PRODUCT[c_['out'][0]])
    if name == "rapid-compressor":
        a.flat(a.rect(c - 14 * b, ins + 3 * b, c - 10 * b - 1, ins + 5 * b - 1), OIL)
    return a, S, c, b, ins, acc, metal, steel, dark


def crafter_sprites(name):
    c_ = CRAFTERS[name]
    a, S, c, b, ins, acc, metal, steel, dark = frame(name)
    G = rgb(c_['glow'])
    if name == "rapid-press":
        a.flat(a.rect(16, 16, 47, 47), shade(steel, 0.62))
        a.sunk(a.rect(18, 18, 45, 45), dark)
        M = a.rect(23, 19, 40, 21)
        for r in ((23, 42, 40, 44), (19, 23, 21, 40), (42, 23, 44, 40)):
            M = ImageChops.lighter(M, a.rect(*r))
        a.flat(M, shade(G, 0.45), sym=False)
        a.plate(a.cham(23, 23, 40, 40, 3), metal, 2)
        a.flat(a.rect(29, 29, 34, 34), dark)
        a.box(31, 31, 32, 32, acc)
    elif name == "rapid-smelter":
        a.sunk(a.rect(36, 22, 59, 27), steel)
        for x in (37, 41, 45, 49, 53, 57):
            a.box(x, 23, x + 1, 26, dark)
        M, _ = a.mask()
        for cx in (33, 63):
            a.flat(a.round_disc(cx, 48, 15), shade(steel, 0.62), sym=False)
            a.sunk(a.round_disc(cx, 48, 13), steel, sym=False)
            a.flat(a.round_disc(cx, 48, 10), shade(G, 0.40), sym=False)
            a.flat(a.round_disc(cx, 47, 6), shade(G, 0.55), sym=False)
            M = ImageChops.lighter(M, a.round_disc(cx, 48, 10))
        bars = ImageChops.lighter(a.rect(32, 38, 33, 57), a.rect(62, 38, 63, 57))
        a.flat(bars, dark, sym=False)
        M = ImageChops.subtract(M, bars)
    elif name == "rapid-foundry":
        a.flat(a.cham(23, 23, 72, 72, 5), shade(steel, 0.62))
        a.sunk(a.cham(26, 26, 69, 69, 4), dark)
        a.plate(a.rect(46, 26, 49, 30), metal, 1)
        M, _ = a.mask()
        for y in (31, 44, 57):
            a.flat(a.rect(32, y, 63, y + 7), shade(STEEL_BLUE, 0.5))
            a.flat(a.rect(32, y, 63, y + 1), shade(STEEL_BLUE, 0.7))
            M = ImageChops.lighter(M, a.rect(32, y, 63, y + 7))
    elif name == "rapid-compressor":
        a.flat(a.rect(14, 44, 23, 51), steel)
        a.flat(a.rect(14, 44, 23, 44), shade(steel, 0.78))
        a.flat(a.rect(14, 51, 23, 51), shade(steel, 0.78))
        a.plate(a.rect(24, 34, 37, 61), metal, 2)
        a.flat(a.rect(30, 38, 31, 39), dark)
        a.flat(a.rect(30, 56, 31, 57), dark)
        a.flat(a.rect(38, 28, 57, 67), shade(steel, 0.62))
        a.sunk(a.rect(40, 30, 55, 65), dark)
        a.flat(a.rect(42, 32, 53, 63), shade(G, 0.40))
        a.flat(a.rect(44, 34, 51, 61), shade(G, 0.55))
        M = a.rect(42, 32, 53, 63)
    else:   # arc furnace
        a.flat(a.round_disc(48, 48, 27), shade(steel, 0.62))
        a.sunk(a.round_disc(48, 48, 24), steel)
        a.flat(a.round_disc(48, 48, 18), shade(G, 0.40))
        a.flat(a.round_disc(48, 46, 12), shade(G, 0.55))
        el = ImageChops.lighter(a.rect(46, 24, 49, 39), a.rect(24, 46, 39, 49))
        el = a.sym(el)
        a.flat(el, dark, sym=False)
        a.flat(a.rect(46, 38, 49, 39), acc)
        a.flat(a.rect(38, 46, 39, 49), acc)
        M = ImageChops.subtract(a.round_disc(48, 48, 18), el)
    emblem(a, c, (c_['bt'] + S - 1 - ins + 1) / 2, 10 if S == 64 else 14, b, acc)
    top = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    top.paste((255, 255, 255, 255), mask=M)
    return a.im, top


def crafter_hjson(name):
    c_ = CRAFTERS[name]
    lines = [
        "type: GenericCrafter",
        f"name: {c_['en']}",
        f"description: {c_['en_d']}",
        "category: crafting",
        f"research: {c_['research']}",
        "requirements: [",
    ] + [f"  {i}/{n}" for i, n in c_['cost']] + [
        "]",
        f"researchCostMultiplier: {c_['rm']}",
        f"size: {c_['size']}",
        f"health: {c_['health']}",
        f"itemCapacity: {c_['cap']}",
    ]
    if c_['liquid']:
        lines.append("liquidCapacity: 120")
    lines += [
        f"craftTime: {c_['time']}",
        f"outputItem: {c_['out'][0]}/{c_['out'][1]}",
        f"craftEffect: {c_['fx']}",
    ]
    if c_['sound']:
        lines += [f"ambientSound: {c_['sound']}", "ambientSoundVolume: 0.05"]
    lines += ["consumes: {", "  items: ["] + [f"    {i}/{n}" for i, n in c_['inputs']] + ["  ]", f"  power: {c_['power']}"]
    if c_['liquid']:
        lines += ["  liquid: {", f"    liquid: {c_['liquid'][0]}", f"    amount: {c_['liquid'][1]}", "  }"]
    lines += ["}", "drawer: [", "  {", "    type: DrawDefault", "  }", "  {", "    type: DrawWarmupRegion",
              f'    color: "{c_["glow"]}"', "  }", "]"]
    return "\n".join(lines) + "\n"


def build(root):
    open(f"{root}/content/items/rapid-steel.hjson", "w").write(item_hjson())
    item_sprite().save(f"{root}/sprites/items/rapid-steel.png")
    en = ["item.rapid-turret-rapid-steel.name = Rapid Steel", f"item.rapid-turret-rapid-steel.description = {ITEM_EN}"]
    ru = ["item.rapid-turret-rapid-steel.name = Сталь Rapid", f"item.rapid-turret-rapid-steel.description = {ITEM_RU}"]
    for name, c_ in CRAFTERS.items():
        open(f"{root}/content/blocks/{name}.hjson", "w").write(crafter_hjson(name))
        im, top = crafter_sprites(name)
        im.save(f"{root}/sprites/blocks/{name}.png")
        top.save(f"{root}/sprites/blocks/{name}-top.png")
        key = f"block.rapid-turret-{name}"
        en += [f"{key}.name = {c_['en']}", f"{key}.description = {c_['en_d']}"]
        ru += [f"{key}.name = {c_['ru']}", f"{key}.description = {c_['ru_d']}"]
    return en, ru
