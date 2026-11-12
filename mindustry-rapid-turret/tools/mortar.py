"""Mortar I-IV — item-fed rapid artillery, ground targets only. DESIGN.md sections 29, 31.5."""
from PIL import Image, ImageChops

from art import Art, TIER, ROMAN, shade, mix

WHITE = (255, 255, 255)
HULL_L, HULL_D, GLOW = (118, 124, 140), (72, 76, 94), (255, 70, 50)
DARK = shade(HULL_D, 0.45)

MORTAR = {
    1: dict(size=1, health=300, range=230, minRange=0, reload=30, barrels=1, spread=None, inacc=2, rot=8, recoil=2, shake=1,
            coolant=0.1, maxAmmo=20, speed=3, life=77, cost=[("copper", 100), ("graphite", 50)], bm=1, rm=1),
    2: dict(size=2, health=950, range=270, minRange=40, reload=24, barrels=2, spread=4.5, inacc=3, rot=7, recoil=3,
            shake=1.5, coolant=0.2, maxAmmo=24, speed=3.2, life=85,
            cost=[("copper", 250), ("graphite", 180), ("titanium", 90)], bm=1, rm=1),
    3: dict(size=3, health=1900, range=310, minRange=50, reload=18, barrels=3, spread=5, inacc=4, rot=6, recoil=4,
            shake=2, coolant=0.3, maxAmmo=30, speed=3.4, life=92,
            cost=[("copper", 600), ("graphite", 450), ("titanium", 380), ("thorium", 200)], bm=1, rm=0.8),
    4: dict(size=4, health=3500, range=350, minRange=60, reload=12, barrels=4, spread=5.5, inacc=5, rot=5, recoil=5,
            shake=2.5, coolant=0.4, maxAmmo=36, speed=3.6, life=98,
            cost=[("copper", 1400), ("graphite", 1000), ("titanium", 900), ("thorium", 650), ("plastanium", 350),
                  ("surge-alloy", 120)], bm=0.7, rm=0.5),
}
# item -> ({tier: (splashDamage, radius)}, ammoMultiplier, extra lines, colours (front, back) or None, hit effect or None)
AMMO = {
    "graphite": ({1: (28, 16), 2: (52, 20), 3: (82, 24), 4: (120, 28)}, 2, [], None, None),
    "silicon": ({1: (28, 16), 2: (52, 20), 3: (82, 24), 4: (120, 28)}, 3, ["reloadMultiplier: 1.2"], None, None),
    "blast-compound": ({2: (78, 28), 3: (123, 34), 4: (180, 39)}, 4, ["status: blasted"], ("ffe9b8", "ffa23c"),
                       "blastExplosion"),
    "plastanium": ({3: (107, 30), 4: (156, 35)}, 3, [], ("f6ffd0", "c8e86a"), "plasticExplosion"),
}
# sprite table: pitch, bw, ring rows mr, tips (left -> centre), by, hw, ch, trunnion R, trunnion column, rc, pip (w, h), hy
ART = {
    1: (0, 8, 3, (5,), 15, 8, 2, 0, 0, 2, (2, 1), 21),
    2: (18, 10, 4, (5, 5), 30, 17, 5, 6, 14, 5, (2, 2), 44),
    3: (20, 12, 5, (9, 5, 9), 46, 30, 9, 8, 16, 9, (3, 3), 68),
    4: (22, 14, 6, (11, 5, 5, 11), 62, 44, 13, 11, 17, 13, (3, 3), 92),
}
EN = {
    1: "Tiny rapid artillery. Long range, splash damage, ground targets only.",
    2: "Twin tubes; accepts blast compound for bigger explosions. Cannot hit targets right next to it.",
    3: "Three tubes, three shells a second. Plastanium shells throw enemies back.",
    4: "Four tubes and the longest range in the arsenal. Flattens ground assaults before they arrive.",
}
RU = {
    1: "Маленькая скорострельная артиллерия. Большая дальность, урон по площади, только наземные цели.",
    2: "Два ствола; принимает взрывчатую смесь для более мощных взрывов. Не достаёт цели вплотную.",
    3: "Три ствола, три снаряда в секунду. Пластаниевые снаряды отбрасывают врагов.",
    4: "Четыре ствола и самая большая дальность в арсенале. Сравнивает с землёй наземные атаки ещё на подходе.",
}


def barrels(n):
    pitch, bw, mr, tips, by = ART[n][:5]
    S = MORTAR[n]['size'] * 32
    cx = S / 2
    nb = MORTAR[n]['barrels']
    out = []
    for i in range(nb):
        x0 = int(round(cx + (i - (nb - 1) / 2) * pitch - bw / 2))
        out.append((x0, x0 + bw - 1, tips[i]))
    return out


def gun(n):
    pitch, bw, mr, tips, by, hw, ch, R, tcol, rc, (pw, ph), hy = ART[n]
    S = MORTAR[n]['size'] * 32
    cx = S / 2
    b = 1 if S <= 64 else 2
    a = Art(S)
    # 1. trunnions
    if n >= 2:
        a.plate(a.round_disc(tcol, hy, R), HULL_D, b)
        a.flat(a.round_disc(tcol, hy, max(1, R / 3)), DARK)
    # 2. barrels (left half + centre, Art mirrors)
    for x0, x1, tip in barrels(n):
        if x0 > S - 1 - x1:
            continue
        a.flat(a.rect(x0, tip + mr, x1, by + 2), shade(HULL_D, 0.78))
        a.flat(a.rect(x0 + 1, tip + mr, x1 - 1, by + 2), HULL_D)
        mid = (x0 + x1) // 2
        a.flat(a.rect(mid, tip + mr, mid + 1, by + 2), shade(HULL_D, 1.25))
        a.plate(a.rect(x0 - 1, tip, x1 + 1, tip + mr - 1), HULL_L, 1)
        a.flat(a.rect(x0 + 2, tip, x1 - 2, tip + 1), DARK)
        a.flat(a.rect(x0, tip + mr + 1, x1, tip + mr + b), GLOW)
        if S >= 64:
            a.plate(a.rect(x0 - 1, by - 2 * b - 3, x1 + 1, by - 1), HULL_L, 1)
    # 3. breech
    a.plate(a.poly([(cx - hw, by), (cx, by), (cx, S - 6), (cx - hw + ch, S - 6), (cx - hw, S - 6 - ch)]), HULL_L,
            2 if S < 96 else 3)
    # 4. hatch
    if n >= 2:
        hh = int(round(0.3 * (S - 6 - by)))
        hw2 = int(round(0.62 * hw))
        a.sunk(a.cham(cx - hw2, hy - hh, cx + hw2 - 1, hy + hh, 2 * b), HULL_D)
    # 5. core
    a.flat(a.round_disc(cx, hy, rc), shade(GLOW, 0.75))
    a.flat(a.round_disc(cx, hy - b, rc - b), GLOW)
    a.flat(a.round_disc(cx, hy - b, max(1, 0.4 * rc)), mix(GLOW, WHITE, 0.75))
    # 6. exhaust slits
    if n >= 2:
        slits = {64: 2, 96: 3, 128: 4}[S]
        half = hw - ch - 2 * b
        sw = 2 * b
        gap = (2 * half - slits * sw) / (slits + 1)
        for i in range(slits):
            x = int(round(cx - half + gap * (i + 1) + i * sw))
            if x + sw - 1 < cx:      # left half only; Art mirrors
                a.flat(a.rect(x, S - 8 - b, x + sw - 1, S - 8), GLOW)
            elif x < cx:
                a.flat(a.rect(x, S - 8 - b, cx - 1, S - 8), GLOW)
    # 7. pips
    acc = TIER[n][0]
    total = n * pw + (n - 1) * pw
    x0 = int(round(cx - total / 2))
    for i in range(n):
        a.box(x0 + i * 2 * pw, by + 2 * b, x0 + i * 2 * pw + pw - 1, by + 2 * b + ph - 1, acc)

    # heat: barrels tip..by with gradient, plus the core at alpha 140
    alpha = Image.new("L", (S, S), 0)
    ap = alpha.load()
    for x0, x1, tip in barrels(n):
        span = max(1, by - tip)
        for y in range(tip, by + 1):
            v = int(255 * (1 - (y - tip) / span) ** 1.4)
            for x in range(x0, x1 + 1):
                ap[x, y] = max(ap[x, y], v)
    core = a.round_disc(cx, hy, rc).point(lambda v: 140 if v else 0)
    alpha = ImageChops.lighter(alpha, core)
    heat = Image.new("RGBA", (S, S), (255, 255, 255, 0))
    heat.putalpha(alpha)
    heat = Image.composite(heat, Image.new("RGBA", (S, S), (0, 0, 0, 0)), alpha.point(lambda v: 255 if v else 0))
    return a.im, heat


def shell(n, item):
    p = MORTAR[n]
    dmg, am, extra, cols, hit = AMMO[item]
    splash, radius = dmg[n]
    front, back = cols or ("ffd9c8", "ff4632")
    eff = hit or ("flakExplosion" if n <= 2 else "blastExplosion")
    kb = 1.6 if item == "plastanium" else 0.8
    return [
        "type: ArtilleryBulletType",
        f"damage: {int(round(splash / 5))}",
        f"splashDamage: {splash}",
        f"splashDamageRadius: {radius}",
        f"speed: {p['speed']}",
        f"lifetime: {p['life']}",
        f"knockback: {kb}",
        "collidesTiles: false",
        "trailEffect: none",
        f"trailLength: {[8, 9, 10, 12][n - 1]}",
        f"trailWidth: {[2, 2.3, 2.6, 3][n - 1]}",
        f"width: {10 + n}",
        f"height: {10 + n}",
        f'frontColor: "{front}"',
        f'backColor: "{back}"',
        f'trailColor: "{back}"',
        f"hitEffect: {eff}",
        f"despawnEffect: {eff}",
        f"shootEffect: {'shootSmall' if n == 1 else 'shootBig'}",
        f"smokeEffect: {'shootSmallSmoke' if n == 1 else 'shootBigSmoke'}",
        f"ammoMultiplier: {am}",
    ] + extra


def hjson(n):
    p = MORTAR[n]
    S = p['size'] * 32
    ammo = []
    for item in AMMO:
        if n in AMMO[item][0]:
            ammo += [f"  {item}: {{"] + ["    " + l for l in shell(n, item)] + ["  }"]
    lines = [
        "type: ItemTurret",
        f"name: Mortar {ROMAN[n]}",
        f"description: {EN[n]}",
        "category: turret",
        f"research: {'hail' if n == 1 else 'rapid-mortar-%d' % (n - 1)}",
        "playerControllable: true",
        "requirements: [",
    ] + [f"  {i}/{c}" for i, c in p['cost']] + [
        "]",
        f"buildCostMultiplier: {p['bm']}",
        f"researchCostMultiplier: {p['rm']}",
        f"size: {p['size']}",
        f"health: {p['health']}",
        f"range: {p['range']}",
    ]
    if n >= 2:
        lines.append(f"minRange: {p['minRange']}")
    lines += [
        f"reload: {p['reload']}",
        f"inaccuracy: {p['inacc']}",
        "velocityRnd: 0.1",
        "shootCone: 10",
        f"rotateSpeed: {p['rot']}",
        f"recoil: {p['recoil']}",
        f"shake: {p['shake']}",
        f"shootY: {(S / 2 - 5) / 4}",
        f"maxAmmo: {p['maxAmmo']}",
        "targetAir: false",
        "targetGround: true",
        'heatColor: "ff4632"',
        "shootSound: artillery",
        f"ammoUseEffect: {'casing2' if n <= 2 else 'casing3'}",
        "coolant: {",
        "  type: ConsumeCoolant",
        f"  amount: {p['coolant']}",
        "}",
    ]
    if p['spread']:
        lines += ["shoot: {", "  type: ShootAlternate", f"  barrels: {p['barrels']}", f"  spread: {p['spread']}",
                  "  shots: 1", "}"]
    lines += ["ammoTypes: {"] + ammo + ["}"]
    return "\n".join(lines) + "\n"


def build(root):
    import gen
    en, ru = [], []
    for n in MORTAR:
        name = f"rapid-mortar-{n}"
        open(f"{root}/content/blocks/{name}.hjson", "w").write(hjson(n))
        g, h = gun(n)
        g.save(f"{root}/sprites/blocks/{name}.png")
        h.save(f"{root}/sprites/blocks/{name}-heat.png")
        gen.base(0, dict(size=MORTAR[n]['size'], trim=GLOW, acc=GLOW)).save(f"{root}/sprites/blocks/{name}-base.png")
        key = f"block.rapid-turret-{name}"
        en += [f"{key}.name = Mortar {ROMAN[n]}", f"{key}.description = {EN[n]}"]
        ru += [f"{key}.name = Мортира {ROMAN[n]}", f"{key}.description = {RU[n]}"]
    return en, ru


def balance_rows():
    import gen
    rows = []
    for n, p in MORTAR.items():
        rows.append((f"Mortar {ROMAN[n]}", sum(gen.VALUE.get(i, 0) * c for i, c in p['cost']),
                     AMMO["graphite"][0][n][0] * 60 / p['reload']))
    return rows
