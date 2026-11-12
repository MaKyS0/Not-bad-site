"""Rapid Overdrive I-III (OverdriveProjector). DESIGN.md sections 45, 48, 49.6, 50."""
from PIL import Image

from art import Art, TIER, shade
import liquids

OD = {
    1: dict(size=2, health=400, boost=1.6, phase=0.65, range=110, prb=30, use=400, power=5, items="optional", tier=3,
            base="78ff96", phasec="c8ffd6", rm=1, research="overdrive-projector",
            cost=[("lead", 150), ("titanium", 120), ("silicon", 120), ("plastanium", 40), ("rapid-steel", 40)],
            en_d="Speeds up buildings in a 13-tile radius by 60%. Phase fabric raises the boost and the range. Keep Dynamos out of range: they only burn fuel faster.",
            ru_d="Ускоряет постройки в радиусе 13 клеток на 60%. Фазовая ткань повышает ускорение и радиус. Не ставьте рядом с динамо: они лишь быстрее жгут топливо."),
    2: dict(size=3, health=900, boost=2.0, phase=0.6, range=200, prb=40, use=300, power=12, items="optional", tier=4,
            base="ff6ed7", phasec="ffc4ee", rm=0.8, research="rapid-overdrive-1",
            cost=[("lead", 250), ("titanium", 200), ("silicon", 200), ("plastanium", 100), ("surge-alloy", 100),
                  ("rapid-steel", 80)],
            en_d="Doubles the speed of buildings in a 25-tile radius on power alone. Phase fabric raises the boost to 160%.",
            ru_d="Удваивает скорость построек в радиусе 25 клеток на одной энергии. Фазовая ткань повышает ускорение до 160%."),
    3: dict(size=4, health=1800, boost=3.0, phase=None, range=300, prb=None, use=240, power=30, items="required", tier=5,
            base="ff543c", phasec="ffb0a0", rm=0.5, research="rapid-overdrive-2",
            cost=[("lead", 500), ("titanium", 350), ("silicon", 400), ("plastanium", 200), ("surge-alloy", 250),
                  ("phase-fabric", 100), ("rapid-steel", 150)],
            en_d="Triples the speed of buildings in a 37-tile radius. Does nothing without phase fabric and Rapid Steel. Rapid V-VI already fire every tick and gain nothing.",
            ru_d="Утраивает скорость построек в радиусе 37 клеток. Без фазовой ткани и стали Rapid не работает. Rapid V–VI и так стреляют каждый тик и ничего не получают."),
}
ROMAN = {1: "I", 2: "II", 3: "III"}


def sprites(n):
    o = OD[n]
    S = o['size'] * 32
    c = S // 2
    b = 1 if S == 64 else 2
    ins = 2 * b
    acc, metal, steel = TIER[o['tier']]
    dark = shade(steel, 0.45)
    D = int(round(0.30 * S))
    a = Art(S)
    liquids.frame(a, S, b, ins, o['tier'])
    l1 = lambda x, y: abs(x - c) + abs(y - c)   # noqa: E731
    a.flat(a.where(lambda x, y: l1(x, y) <= D + 2 * b), shade(steel, 0.62))
    a.sunk(a.where(lambda x, y: l1(x, y) <= D), dark)
    M = a.where(lambda x, y: (D - 9 * b <= l1(x, y) < D - 7 * b or D - 3 * b <= l1(x, y) < D - b)
                and abs(abs(x - c) - abs(y - c)) >= 3 * b)
    a.flat(M, shade(acc, 0.40))
    a.plate(a.where(lambda x, y: l1(x, y) <= round(0.08 * S)), metal, 2)
    a.flat(a.where(lambda x, y: l1(x, y) <= round(0.04 * S)), acc)
    liquids.pips(a, n, c, ins + 3 * b, 2 * b, acc)
    top = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    top.paste((255, 255, 255, 255), mask=M)
    L = 2 * D + 2
    top = top.crop((c - L // 2, c - L // 2, c + L // 2, c + L // 2))
    return a.im, top


def hjson(n):
    o = OD[n]
    lines = ["type: OverdriveProjector", f"name: Rapid Overdrive {ROMAN[n]}", f"description: {o['en_d']}",
             "category: effect", f"research: {o['research']}"] + liquids.req(o['cost'])
    if o['rm'] != 1:
        lines.append(f"researchCostMultiplier: {o['rm']}")
    lines += [f"size: {o['size']}", f"health: {o['health']}", f"speedBoost: {o['boost']}"]
    if o['phase'] is not None:
        lines += [f"speedBoostPhase: {o['phase']}", f"phaseRangeBoost: {o['prb']}"]
    lines += [f"range: {o['range']}", f"useTime: {o['use']}", f'baseColor: "{o["base"]}"',
              f'phaseColor: "{o["phasec"]}"']
    if o['items'] == "required":
        lines += ["hasBoost: false", "consumes: {", f"  power: {o['power']}", "  items: [", "    phase-fabric/1",
                  "    rapid-steel/1", "  ]", "}"]
    else:
        lines += ["consumes: {", f"  power: {o['power']}", "  items: {", "    items: [", "      phase-fabric/1", "    ]",
                  "    optional: true", "    booster: true", "  }", "}"]
    return "\n".join(lines) + "\n"


def build(root):
    en, ru = [], []
    for n, o in OD.items():
        name = f"rapid-overdrive-{n}"
        open(f"{root}/content/blocks/{name}.hjson", "w").write(hjson(n))
        im, top = sprites(n)
        im.save(f"{root}/sprites/blocks/{name}.png")
        top.save(f"{root}/sprites/blocks/{name}-top.png")
        key = f"block.rapid-turret-{name}"
        en += [f"{key}.name = Rapid Overdrive {ROMAN[n]}", f"{key}.description = {o['en_d']}"]
        ru += [f"{key}.name = Ускоритель Rapid {ROMAN[n]}", f"{key}.description = {o['ru_d']}"]
    return en, ru
