"""Tesla I-III — power-fed chain-lightning turrets (PowerTurret + LightningBulletType). DESIGN.md section 54."""
from PIL import Image, ImageChops

from art import Art, TIER, ROMAN, shade, mix

WHITE = (255, 255, 255)
COPPER = (196, 122, 64)
HULL_L, HULL_D = (110, 118, 140), (66, 72, 92)
ARC = (160, 216, 255)
DARK = shade(HULL_D, 0.45)

TESLA = {
    1: dict(size=1, health=300, range=100, reload=25, shots=1, dmg=22, length=22, rand=4, power=4, air=False,
            cost=[("copper", 80), ("lead", 60), ("silicon", 40), ("graphite", 30)], research="arc", rm=1,
            en_d="Chain lightning that jumps between nearby ground targets. Needs power, no ammo.",
            ru_d="Цепная молния, перескакивает между ближними наземными целями. Нужна энергия, патроны не нужны."),
    2: dict(size=2, health=1000, range=135, reload=18, shots=2, dmg=30, length=30, rand=6, power=9, air=True,
            cost=[("copper", 200), ("lead", 150), ("silicon", 150), ("titanium", 100), ("graphite", 80)],
            research="rapid-tesla-1", rm=1,
            en_d="Two bolts per discharge; also hits aircraft. Shreds swarms of small units.",
            ru_d="Две молнии за разряд, бьёт и по авиации. Разносит рои мелких юнитов."),
    3: dict(size=3, health=2200, range=170, reload=14, shots=3, dmg=40, length=38, rand=8, power=18, air=True,
            cost=[("lead", 400), ("silicon", 350), ("titanium", 250), ("thorium", 150), ("surge-alloy", 80)],
            research="rapid-tesla-2", rm=0.8,
            en_d="Three long bolts per discharge, four discharges a second. A storm around your walls.",
            ru_d="Три длинные молнии за разряд, четыре разряда в секунду. Настоящая буря у твоих стен."),
}


def gun(n):
    t = TESLA[n]
    S = t['size'] * 32
    cx = S / 2
    b = 1 if S <= 64 else 2
    a = Art(S)
    acc = TIER[n][0]
    cw = int(round(0.16 * S))          # coil half width
    r = max(3, int(round(0.12 * S)))   # orb radius
    top, bot = 5 + r + b, S - 6        # the orb centre sits on the coil top, inside the 5 px margin
    # side prongs (tier II+): two thin electrodes pointing up
    if n >= 2:
        px = cx - int(round(0.30 * S))
        a.plate(a.rect(px - 2 * b, int(0.30 * S), px + 2 * b - 1, int(0.80 * S)), HULL_D, b)
        a.flat(a.rect(px - b, int(0.30 * S) - 3 * b, px + b - 1, int(0.30 * S) - 1), ARC)
    if n >= 3:
        px = cx - int(round(0.18 * S))
        a.plate(a.rect(px - 2 * b, int(0.20 * S), px + 2 * b - 1, int(0.70 * S)), HULL_D, b)
        a.flat(a.rect(px - b, int(0.20 * S) - 3 * b, px + b - 1, int(0.20 * S) - 1), ARC)
    # base housing
    hw = int(round(0.30 * S))
    a.plate(a.cham(cx - hw, int(0.62 * S), cx + hw - 1, bot, 3 * b), HULL_L, 2 if S < 96 else 3)
    # copper coil column with alternating windings
    a.flat(a.rect(cx - cw, top, cx + cw - 1, int(0.80 * S)), shade(COPPER, 0.7))
    for y in range(top + b, int(0.80 * S), 3 * b):
        a.flat(a.rect(cx - cw, y, cx + cw - 1, y + b - 1), COPPER)
    a.flat(a.rect(cx - cw, top, cx - cw + b - 1, int(0.80 * S)), shade(COPPER, 1.25))
    # top orb
    oy = top
    a.flat(a.round_disc(cx, oy, r + b), DARK)
    a.flat(a.round_disc(cx, oy, r), shade(ARC, 0.7))
    a.flat(a.round_disc(cx, oy - b, max(1, r - b)), ARC)
    a.flat(a.round_disc(cx, oy - b, max(1, r // 2)), mix(ARC, WHITE, 0.7))
    # tier pips on the housing
    p = 2 if S <= 64 else 4           # even, so the pips centre exactly
    total = n * p + (n - 1) * p
    x0 = int(round(cx - total / 2))
    for i in range(n):
        a.box(x0 + 2 * p * i, bot - 2 * b - p, x0 + 2 * p * i + p - 1, bot - 2 * b - 1, acc)
    # heat: orb + coil, brighter at the top
    alpha = Image.new("L", (S, S), 0)
    ap = alpha.load()
    coil = a.sym(a.rect(cx - cw, top, cx + cw - 1, int(0.80 * S)))
    cp = coil.load()
    span = max(1, int(0.80 * S) - top)
    for y in range(top, int(0.80 * S)):
        v = int(220 * (1 - (y - top) / span) ** 1.2)
        for x in range(S):
            if cp[x, y]:
                ap[x, y] = v
    alpha = ImageChops.lighter(alpha, a.round_disc(cx, oy, r + b).point(lambda v: 255 if v else 0))
    heat = Image.new("RGBA", (S, S), (255, 255, 255, 0))
    heat.putalpha(alpha)
    heat = Image.composite(heat, Image.new("RGBA", (S, S), (0, 0, 0, 0)), alpha.point(lambda v: 255 if v else 0))
    return a.im, heat


def hjson(n):
    t = TESLA[n]
    S = t['size'] * 32
    lines = [
        "type: PowerTurret",
        f"name: Tesla {ROMAN[n]}",
        f"description: {t['en_d']}",
        "category: turret",
        f"research: {t['research']}",
        "playerControllable: true",
        "requirements: [",
    ] + [f"  {i}/{c}" for i, c in t['cost']] + ["]"]
    if t['rm'] != 1:
        lines.append(f"researchCostMultiplier: {t['rm']}")
    lines += [
        f"size: {t['size']}",
        f"health: {t['health']}",
        f"range: {t['range']}",
        f"reload: {t['reload']}",
        "shootCone: 40",
        "inaccuracy: 10",
        "rotateSpeed: 10",
        "recoil: 0.5",
        f"shootY: {round((S / 2 - (5 + max(3, round(0.12 * S)) + (1 if S <= 64 else 2))) / 4, 2)}",
        f"targetAir: {'true' if t['air'] else 'false'}",
        "targetGround: true",
        'heatColor: "a0d8ff"',
        "shootEffect: lightningShoot",
        "shootSound: spark",
        "coolant: {",
        "  type: ConsumeCoolant",
        f"  amount: {0.1 * t['size']:.1f}",
        "}",
        "consumes: {",
        f"  power: {t['power']}",
        "}",
    ]
    if t['shots'] > 1:
        lines += ["shoot: {", f"  shots: {t['shots']}", "}"]
    lines += [
        "shootType: {",
        "  type: LightningBulletType",
        f"  damage: {t['dmg']}",
        f"  lightningLength: {t['length']}",
        f"  lightningLengthRand: {t['rand']}",
        '  lightningColor: "a0d8ff"',
        f"  collidesAir: {'true' if t['air'] else 'false'}",
        "  buildingDamageMultiplier: 0.25",
        "}",
    ]
    return "\n".join(lines) + "\n"


def build(root):
    import gen
    en, ru = [], []
    for n, t in TESLA.items():
        name = f"rapid-tesla-{n}"
        open(f"{root}/content/blocks/{name}.hjson", "w").write(hjson(n))
        g, h = gun(n)
        g.save(f"{root}/sprites/blocks/{name}.png")
        h.save(f"{root}/sprites/blocks/{name}-heat.png")
        gen.base(0, dict(size=t['size'], trim=ARC, acc=ARC)).save(f"{root}/sprites/blocks/{name}-base.png")
        key = f"block.rapid-turret-{name}"
        en += [f"{key}.name = Tesla {ROMAN[n]}", f"{key}.description = {t['en_d']}"]
        ru += [f"{key}.name = Тесла {ROMAN[n]}", f"{key}.description = {t['ru_d']}"]
    return en, ru
