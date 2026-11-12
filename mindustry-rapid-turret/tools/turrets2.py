"""Pulse I-IV (power-fed rapid laser) and Buckshot I-IV (rapid shotgun). DESIGN.md sections 11, 12, 15.1, 15.2."""
import math

from PIL import Image, ImageChops

from art import Art, TIER, ROMAN, shade, mix, hexc

WHITE = (255, 255, 255)


def req_lines(cost):
    return ["requirements: ["] + [f"  {i}/{n}" for i, n in cost] + ["]"]


def b_of(S):
    return 1 if S <= 64 else 2


def pips(a, n, cx, y, w, h):
    acc = TIER[n][0]
    total = n * w + (n - 1) * w
    x0 = int(round(cx - total / 2))
    for i in range(n):
        x = x0 + i * 2 * w
        a.box(x, y, x + w - 1, y + h - 1, acc)


def gradient_heat(S, mask, top, bottom):
    """White heat sprite: alpha 255*(1-t)^1.4 inside mask, t = 0 at row `top`, 1 at row `bottom`."""
    heat = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    mp, hp = mask.load(), heat.load()
    span = max(1, bottom - top)
    for y in range(top, bottom + 1):
        al = int(255 * (1 - (y - top) / span) ** 1.4)
        if al <= 0:
            continue
        for x in range(S):
            if mp[x, y]:
                hp[x, y] = (255, 255, 255, max(al, hp[x, y][3]))
    return heat


# ---------------------------------------------------------------- Pulse

PULSE = {
    1: dict(size=1, health=320, range=130, reload=5, emitters=1, power=2.5, coolant=0.1, rot=14, recoil=0.5,
            cost=[("copper", 90), ("lead", 90), ("silicon", 40)], dmg=9, speed=7, life=21, w=2, h=8, pierce=None,
            spread=None, bm=1, rm=1),
    2: dict(size=2, health=1000, range=175, reload=3, emitters=2, power=6, coolant=0.2, rot=16, recoil=0.8,
            cost=[("copper", 150), ("lead", 150), ("silicon", 120), ("titanium", 80)], dmg=13, speed=8, life=24,
            w=2.5, h=10, pierce=None, spread=3.5, bm=1, rm=1),
    3: dict(size=3, health=1900, range=215, reload=2, emitters=3, power=13, coolant=0.3, rot=18, recoil=1.0,
            cost=[("copper", 400), ("lead", 400), ("silicon", 320), ("titanium", 260), ("thorium", 100)], dmg=17,
            speed=9, life=26, w=3, h=12, pierce=2, spread=4.5, bm=1, rm=0.8),
    4: dict(size=4, health=3400, range=250, reload=1, emitters=4, power=26, coolant=0.4, rot=20, recoil=1.2,
            cost=[("copper", 1000), ("lead", 900), ("silicon", 800), ("titanium", 700), ("thorium", 350),
                  ("plastanium", 200), ("surge-alloy", 100)], dmg=20, speed=10, life=27, w=3.5, h=14, pierce=3,
            spread=5, bm=0.7, rm=0.5),
}
# sprite table: pitch, pw, step, cy, R, cw, pip (w, h)
PULSE_ART = {1: (0, 4, 0, 19, 7, 0, (2, 1)), 2: (14, 6, 0, 38, 15, 5, (2, 2)),
             3: (18, 6, 6, 57, 22, 7, (3, 3)), 4: (20, 8, 6, 76, 29, 9, (3, 3))}
P_HULL_L, P_HULL_D, P_GLOW = (94, 108, 160), (58, 66, 110), (255, 232, 96)
P_HOT = mix(P_GLOW, WHITE, 0.6)
PULSE_EN = {
    1: "Tiny laser turret. Needs power instead of ammo and fires 12 bolts a second.",
    2: "Twin emitters, 20 laser bolts a second, no ammo needed.",
    3: "Three emitters; bolts pierce through two targets.",
    4: "Four emitters, a bolt every tick, pierces three targets. Very power hungry.",
}
PULSE_RU = {
    1: "Маленькая лазерная турель. Вместо патронов нужна энергия, 12 выстрелов в секунду.",
    2: "Два излучателя, 20 лазерных импульсов в секунду, патроны не нужны.",
    3: "Три излучателя; импульсы пробивают две цели насквозь.",
    4: "Четыре излучателя, выстрел каждый тик, пробивает три цели. Потребляет очень много энергии.",
}


def prongs(n):
    pitch, pw, step, cy, R, cw, _ = PULSE_ART[n]
    S = PULSE[n]['size'] * 32
    cx = S / 2
    k = PULSE[n]['emitters']
    out = []
    for i in range(k):
        off = i - (k - 1) / 2
        x0 = int(round(cx + off * pitch - pw / 2))
        out.append((x0, x0 + pw - 1, 5 + int(round(abs(off) * step))))
    return out


def pulse_gun(n):
    pitch, pw, step, cy, R, cw, (pipw, piph) = PULSE_ART[n]
    S = PULSE[n]['size'] * 32
    cx = S / 2
    b = b_of(S)
    a = Art(S)
    root = int(round(cy - R / 2))
    # 1. tail
    if n >= 2:
        hw = int(round(0.13 * S))
        a.plate(a.rect(cx - hw, cy + R - 4, cx + hw - 1, S - 6), P_HULL_D, 2)
        slits = 2 if S == 64 else 3
        sw = 2 * b
        gap = (2 * hw - slits * sw) / (slits + 1)
        for i in range(slits):
            x = int(round(cx - hw + gap * (i + 1) + i * sw))
            a.box(x, S - 8 - b, x + sw - 1, S - 8, P_GLOW)
    # 2. side capacitors
    if n >= 2:
        x0, x1 = cx - R - cw + 2, cx - R + 3
        y0, y1 = int(round(cy - 0.45 * R)), int(round(cy + 0.55 * R))
        a.plate(a.rect(x0, y0, x1, y1), P_HULL_D, 2)
        for y in range(y0 + 2 * b + b, y1 - 1, 3 * b):
            a.flat(a.rect(x0 + 1, y, x1 - 1, y + b - 1), shade(P_HULL_D, 0.62))
        a.flat(a.rect(x0, y0, x1, y0 + 2 * b - 1), P_GLOW)
    # 3. fins
    if n == 4:
        a.plate(a.poly([(cx - R - cw - 10, cy + 0.55 * R), (cx - R - cw + 2, cy - 0.20 * R), (cx - R - cw + 2, cy + 0.55 * R)]),
                P_HULL_L, 2)
    # 4. prongs
    for x0, x1, tip in prongs(n):
        mid = x0 + pw // 2
        a.flat(a.rect(x0, tip + pw, x1, root), shade(P_HULL_D, 0.78))
        a.flat(a.rect(x0 + 1, tip + pw, x1 - 1, root), P_HULL_D)
        point = a.poly([(x0, tip + pw), (mid - 1, tip), (mid, tip), (x1, tip + pw)])
        a.flat(point, P_HULL_D)
        a.flat(a.rect(mid - 1, tip + 3, mid, root), shade(P_GLOW, 0.8))
        a.flat(ImageChops.multiply(point, a.rect(0, tip, S - 1, tip + 2)), P_HOT)
        cy0 = tip + pw + 1
        a.plate(a.rect(x0 - 1, cy0, x1 + 1, cy0 + b), P_HULL_L, 1)
        if S >= 96:
            c2 = (cy0 + root) // 2
            a.plate(a.rect(x0 - 1, c2, x1 + 1, c2 + b), P_HULL_L, 1)
    # 5. yoke
    if n >= 2:
        xo = prongs(n)[0][0] - 3
        a.plate(a.cham(xo, int(round(cy - 0.75 * R)), S - 1 - xo, int(round(cy - 0.30 * R)), 2 * b), P_HULL_L, 2)
    # 6-8. hull, ring, lens
    a.plate(a.round_disc(cx, cy, R), P_HULL_L, 2 if S < 96 else 3)
    a.plate(a.round_disc(cx, cy, 0.70 * R), P_HULL_D, b)
    a.flat(a.round_disc(cx, cy, 0.42 * R), shade(P_GLOW, 0.75))
    a.flat(a.round_disc(cx, cy - b, 0.42 * R - b), P_GLOW)
    a.flat(a.round_disc(cx, cy - b, max(1, 0.16 * R)), mix(P_GLOW, WHITE, 0.75))
    # 9. pips
    pips(a, n, cx, int(round(cy + 0.80 * R)), pipw, piph)

    # heat: per prong a gradient from its own tip, plus the lens at alpha 140
    bottom = int(round(cy - 0.75 * R)) if n >= 2 else int(cy - R)
    layers = [gradient_heat(S, a.rect(x0, tip, x1, bottom), tip, bottom) for x0, x1, tip in prongs(n)]
    lens = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    lens.paste((255, 255, 255, 140), mask=a.round_disc(cx, cy, 0.42 * R))
    layers.append(lens)
    alpha = layers[0].getchannel("A")
    for l in layers[1:]:
        alpha = ImageChops.lighter(alpha, l.getchannel("A"))
    heat = Image.new("RGBA", (S, S), (255, 255, 255, 0))
    heat.putalpha(alpha)
    heat = Image.composite(heat, Image.new("RGBA", (S, S), (0, 0, 0, 0)), alpha.point(lambda v: 255 if v else 0))
    return a.im, heat


def pulse_hjson(n):
    p = PULSE[n]
    S = p['size'] * 32
    bullet = [
        "type: LaserBoltBulletType",
        f"damage: {p['dmg']}",
        f"speed: {p['speed']}",
        f"lifetime: {p['life']}",
        f"width: {p['w']}",
        f"height: {p['h']}",
        'backColor: "ffe860"',
        'frontColor: "ffffff"',
        'hitColor: "ffe860"',
        'lightColor: "ffe860"',
        "hitEffect: hitLaserColor",
        "despawnEffect: hitLaserColor",
        "smokeEffect: none",
        f"shootEffect: {'shootSmallColor' if n <= 2 else 'shootBigColor'}",
    ]
    if p['pierce']:
        bullet += ["pierce: true", f"pierceCap: {p['pierce']}"]
    lines = [
        "type: PowerTurret",
        f"name: Pulse {ROMAN[n]}",
        f"description: {PULSE_EN[n]}",
        "category: turret",
        f"research: {'arc' if n == 1 else 'rapid-pulse-%d' % (n - 1)}",
        "playerControllable: true",
    ] + req_lines(p['cost']) + [
        f"buildCostMultiplier: {p['bm']}",
        f"researchCostMultiplier: {p['rm']}",
        f"size: {p['size']}",
        f"health: {p['health']}",
        f"range: {p['range']}",
        f"reload: {p['reload']}",
        "inaccuracy: 0",
        f"rotateSpeed: {p['rot']}",
        f"recoil: {p['recoil']}",
        "shake: 0",
        f"shootY: {(S / 2 - 5) / 4}",
        "targetAir: true",
        "targetGround: true",
        'heatColor: "ffe860"',
        "shootSound: lasershoot",
        "coolant: {",
        "  type: ConsumeCoolant",
        f"  amount: {p['coolant']}",
        "}",
        "consumes: {",
        f"  power: {p['power']}",
        "}",
    ]
    if p['spread']:
        lines += ["shoot: {", "  type: ShootAlternate", f"  barrels: {p['emitters']}", f"  spread: {p['spread']}",
                  "  shots: 1", "}"]
    lines += ["shootType: {"] + ["  " + l for l in bullet] + ["}"]
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------- Buckshot

BUCK = {
    1: dict(size=1, health=420, range=95, reload=12, shots=3, spread=9, coolant=0.1, rot=12, recoil=1.5, shake=0.5,
            maxAmmo=30, cost=[("copper", 80), ("lead", 60), ("graphite", 40)], bm=1, rm=1),
    2: dict(size=2, health=1300, range=115, reload=9, shots=4, spread=8, coolant=0.2, rot=13, recoil=2.0, shake=1,
            maxAmmo=40, cost=[("copper", 250), ("lead", 150), ("graphite", 120), ("titanium", 70)], bm=1, rm=1),
    3: dict(size=3, health=2600, range=135, reload=7, shots=5, spread=7, coolant=0.3, rot=14, recoil=2.5, shake=1.5,
            maxAmmo=50, cost=[("copper", 600), ("graphite", 400), ("titanium", 350), ("thorium", 220)], bm=1, rm=0.8),
    4: dict(size=4, health=4800, range=160, reload=5, shots=7, spread=6, coolant=0.4, rot=15, recoil=3.0, shake=2,
            maxAmmo=60, cost=[("copper", 1400), ("graphite", 900), ("titanium", 800), ("thorium", 600),
                              ("plastanium", 350), ("surge-alloy", 150)], bm=0.7, rm=0.5),
}
# item -> (damage by tier, ammoMultiplier, knockback)
BUCK_AMMO = {
    "scrap": ({1: 7, 2: 11, 3: 17, 4: 21}, 2, 0.2),
    "graphite": ({1: 10, 2: 16, 3: 24, 4: 30}, 3, 0.4),
    "thorium": ({3: 30, 4: 38}, 3, 0.8),
}
# sprite table: nb, pitch, bw, bh, mw, mh, hw, neck_y, ck, pip (w, h)
BUCK_ART = {1: (3, 6, 2, 3, 9, 6, 7, 16, 0, (2, 1)), 2: (4, 10, 4, 5, 21, 10, 14, 32, 4, (2, 2)),
            3: (5, 12, 6, 7, 31, 14, 21, 48, 6, (3, 3)), 4: (7, 12, 6, 9, 44, 18, 29, 64, 8, (3, 3))}
B_HULL_L, B_HULL_D, B_GLOW = (134, 138, 104), (88, 94, 70), (255, 140, 40)
B_DARK = shade(B_HULL_D, 0.45)
BUCK_EN = {
    1: "Tiny rapid shotgun. Short range, three pellets per shot. Accepts scrap.",
    2: "Four pellets per shot, devastating up close.",
    3: "Five pellets per shot; thorium pellets pierce and push enemies back.",
    4: "Seven pellets twelve times a second. Shreds anything that gets close.",
}
BUCK_RU = {
    1: "Маленький скорострельный дробовик. Малая дальность, три дробины за выстрел. Принимает металлолом.",
    2: "Четыре дробины за выстрел, сокрушителен вблизи.",
    3: "Пять дробин за выстрел; ториевая картечь пробивает и отбрасывает врагов.",
    4: "Семь дробин двенадцать раз в секунду. Рвёт в клочья всё, что подошло близко.",
}


def buck_gun(n):
    nb, pitch, bw, bh, mw, mh, hw, neck_y, ck, (pipw, piph) = BUCK_ART[n]
    S = BUCK[n]['size'] * 32
    cx = S / 2
    b = b_of(S)
    a = Art(S)
    ch = int(round(0.4 * hw))
    dy = int(round((neck_y + S - 6) / 2)) + b
    dp = 2 if S < 96 else 3
    # 1. cheeks
    if n >= 2:
        x0, x1 = cx - hw - ck, cx - hw + 2
        y0, y1 = neck_y + 2 * b, S - 6 - ch
        a.plate(a.rect(x0, y0, x1, y1), B_HULL_D, 2)
        mid = int((x0 + x1) / 2)
        a.flat(a.rect(mid - (b - 1) // 2 - (1 if b == 2 else 0), y0 + 1, mid, y0 + int(0.6 * (y1 - y0))), B_GLOW)
    # 2. struts
    if n >= 3:
        a.plate(a.poly([(cx - mw, 5 + mh), (cx - mw + 2 * b + 4, 5 + mh), (cx - hw - ck + 4, neck_y + 2 * b),
                        (cx - hw - ck, neck_y + 2 * b)]), B_HULL_L, 2)
    # 3. neck
    neck = a.poly([(cx - mw + 2 * b, 5 + mh), (cx, 5 + mh), (cx, neck_y), (cx - hw, neck_y)])
    a.plate(neck, B_HULL_D, 2)
    # 4. muzzle block, bores, glow band
    c2 = 2 * b
    mx0, mx1, my0, my1 = cx - mw, cx + mw - 1, 5, 5 + mh - 1
    muzzle = a.poly([(mx0, my0 + c2), (mx0 + c2, my0), (cx, my0), (cx, my1), (mx0, my1)])
    a.plate(muzzle, B_HULL_L, 2)
    for i in range(nb):
        x = int(round(cx + (i - (nb - 1) / 2) * pitch - bw / 2))
        a.box(x, 5, x + bw - 1, 5 + bh - 1, B_DARK)
    low = my1 - b
    a.flat(a.rect(mx0 + 2, low - b, cx, low), B_GLOW)
    # 5. hull (rear corners chamfered)
    a.plate(a.poly([(cx - hw, neck_y), (cx, neck_y), (cx, S - 6), (cx - hw + ch, S - 6), (cx - hw, S - 6 - ch)]),
            B_HULL_L, dp)
    # 6. drum
    a.plate(a.round_disc(cx, dy, 0.60 * hw), B_HULL_D, b)
    if S >= 64:
        s = b + 1
        for ang in (150, 210, 270):          # left half + the vertical axis, mirrored
            px = cx + 0.45 * hw * math.cos(math.radians(ang))
            py = dy - 0.45 * hw * math.sin(math.radians(ang))
            x0 = int(round(px - s / 2))
            y0 = int(round(py - s / 2))
            a.flat(a.rect(x0, y0, x0 + s - 1, y0 + s - 1), B_DARK)
        for ang in (90,):
            py = dy - 0.45 * hw
            a.flat(a.rect(cx - (s + 1) // 2, int(round(py - s / 2)), cx - 1, int(round(py - s / 2)) + s - 1), B_DARK)
    # 7. core
    a.flat(a.round_disc(cx, dy, 0.30 * hw), shade(B_GLOW, 0.75))
    a.flat(a.round_disc(cx, dy - b, 0.30 * hw - b), B_GLOW)
    a.flat(a.round_disc(cx, dy - b, max(1, 0.12 * hw)), mix(B_GLOW, WHITE, 0.75))
    # 8. pips
    pips(a, n, cx, 5 + mh + 2 * b, pipw, piph)

    # heat: muzzle block + neck, rows 5 .. neck_y
    m = ImageChops.lighter(a.sym(muzzle), a.sym(neck))
    heat = gradient_heat(S, m, 5, neck_y)
    return a.im, heat


def buck_hjson(n):
    p = BUCK[n]
    S = p['size'] * 32
    life = int(round(p['range'] / 5.5)) + 2
    small = n <= 2
    ammo = []
    for item, (dmg, am, kb) in BUCK_AMMO.items():
        if n not in dmg:
            continue
        bl = [
            "type: BasicBulletType",
            f"damage: {dmg[n]}",
            "speed: 5.5",
            f"lifetime: {life}",
            f"width: {5 + n}",
            f"height: {7 + n}",
            'frontColor: "fff2d8"',
            'backColor: "ff8c28"',
            f"hitEffect: {'hitBulletSmall' if small else 'hitBulletBig'}",
            f"despawnEffect: {'hitBulletSmall' if small else 'hitBulletBig'}",
            f"ammoMultiplier: {am}",
            f"knockback: {kb}",
        ]
        if item == "thorium":
            bl += ["pierce: true", f"pierceCap: {2 if n == 3 else 3}"]
        ammo += [f"  {item}: {{"] + ["    " + l for l in bl] + ["  }"]
    lines = [
        "type: ItemTurret",
        f"name: Buckshot {ROMAN[n]}",
        f"description: {BUCK_EN[n]}",
        "category: turret",
        f"research: {'hail' if n == 1 else 'rapid-buckshot-%d' % (n - 1)}",
        "playerControllable: true",
    ] + req_lines(p['cost']) + [
        f"buildCostMultiplier: {p['bm']}",
        f"researchCostMultiplier: {p['rm']}",
        f"size: {p['size']}",
        f"health: {p['health']}",
        f"range: {p['range']}",
        f"reload: {p['reload']}",
        "inaccuracy: 3",
        "velocityRnd: 0.15",
        f"rotateSpeed: {p['rot']}",
        f"recoil: {p['recoil']}",
        f"shake: {p['shake']}",
        f"shootY: {(S / 2 - 5) / 4}",
        f"maxAmmo: {p['maxAmmo']}",
        "targetAir: true",
        "targetGround: true",
        'heatColor: "ff8c28"',
        "shootSound: shotgun",
        f"shootEffect: {'shootSmall' if small else 'shootBig'}",
        f"smokeEffect: {'shootSmallSmoke' if small else 'shootBigSmoke'}",
        f"ammoUseEffect: {'casing2' if small else 'casing3'}",
        "coolant: {",
        "  type: ConsumeCoolant",
        f"  amount: {p['coolant']}",
        "}",
        "shoot: {",
        "  type: ShootSpread",
        f"  shots: {p['shots']}",
        f"  spread: {p['spread']}",
        "}",
        "ammoTypes: {",
    ] + ammo + ["}"]
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------- shared

def base_sprite(size, glow):
    import gen
    return gen.base(0, dict(size=size, trim=glow, acc=glow))


def build(root):
    en, ru = [], []
    for n in PULSE:
        name = f"rapid-pulse-{n}"
        open(f"{root}/content/blocks/{name}.hjson", "w").write(pulse_hjson(n))
        g, h = pulse_gun(n)
        g.save(f"{root}/sprites/blocks/{name}.png")
        h.save(f"{root}/sprites/blocks/{name}-heat.png")
        base_sprite(PULSE[n]['size'], P_GLOW).save(f"{root}/sprites/blocks/{name}-base.png")
        key = f"block.rapid-turret-{name}"
        en += [f"{key}.name = Pulse {ROMAN[n]}", f"{key}.description = {PULSE_EN[n]}"]
        ru += [f"{key}.name = Импульс {ROMAN[n]}", f"{key}.description = {PULSE_RU[n]}"]
    for n in BUCK:
        name = f"rapid-buckshot-{n}"
        open(f"{root}/content/blocks/{name}.hjson", "w").write(buck_hjson(n))
        g, h = buck_gun(n)
        g.save(f"{root}/sprites/blocks/{name}.png")
        h.save(f"{root}/sprites/blocks/{name}-heat.png")
        base_sprite(BUCK[n]['size'], B_GLOW).save(f"{root}/sprites/blocks/{name}-base.png")
        key = f"block.rapid-turret-{name}"
        en += [f"{key}.name = Buckshot {ROMAN[n]}", f"{key}.description = {BUCK_EN[n]}"]
        ru += [f"{key}.name = Картечь {ROMAN[n]}", f"{key}.description = {BUCK_RU[n]}"]
    return en, ru


def balance_rows():
    """(name, value, best DPS) for gen.py --balance."""
    import gen
    rows = []
    for n, p in PULSE.items():
        rows.append((f"Pulse {ROMAN[n]}", sum(gen.VALUE[i] * c for i, c in p['cost']),
                     p['dmg'] * 60 / p['reload']))
    for n, p in BUCK.items():
        best = max(d[n] for d, _, _ in BUCK_AMMO.values() if n in d)
        rows.append((f"Buckshot {ROMAN[n]}", sum(gen.VALUE[i] * c for i, c in p['cost']),
                     best * p['shots'] * 60 / p['reload']))
    return rows
