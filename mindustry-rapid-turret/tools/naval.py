"""Rapid warships T1-T5 (type: naval). DESIGN.md sections 19, 20, 22.1-22.5, 23."""
from PIL import Image, ImageChops, ImageDraw

from art import Art, TIER, shade, mix, hexc
from air import barrel

WHITE = (255, 255, 255)
NAVY = (52, 78, 112)
GOLD = (255, 190, 80)
CELL_LOW = (220, 198, 198)

UNITS = [
    dict(T=1, name="skiff", en="Skiff", ru="Ялик", health=350, armor=2, speed=1.05, accel=0.4, drag=0.13, rot=3.3, hit=10,
         W=40, H=64, trail=(16, 3, -5, 1.3),
         guns=[1.5], barrels=1, spread=None, reload=7, dmg=5, bspeed=3.5, life=43, grot=8, gshootY=2.5,
         flak=None,
         hull=(16, 24, 52, 59, 11, 2, 2), sup=(34, 50, 7), sock=(36, 40, 5), fun=(46, 49, 3), hatch=(52, 56, 8), pip=(2, 43),
         barb=2,
         tur=dict(W=16, H=28, house=(4, 11, 11, 18), bars=[(7, 8)], rows=(4, 10, 4), ml=2, c=2, hatch=(4, 3)),
         en_d="Tier 1 warship. A small patrol boat with one rapid-fire turret.",
         ru_d="Боевой корабль 1 тира. Небольшая патрульная лодка с одной скорострельной турелью."),
    dict(T=2, name="cutter", en="Cutter", ru="Катер", health=900, armor=5, speed=0.9, accel=0.3, drag=0.15, rot=2.6, hit=13,
         W=48, H=80, trail=(20, 4, -7, 1.7),
         guns=[4], barrels=2, spread=1.5, reload=5, dmg=8, bspeed=3.8, life=47, grot=7, gshootY=3,
         flak=dict(entries=[(0, -6)], mirror=False, reload=12, dmg=3, splash=18, radius=16, speed=4.2, life=45, recoil=0.5,
                   shootY=1.75, r=2),
         hull=(20, 30, 66, 75, 14, 2, 2), sup=(34, 56, 9), sock=(37, 42, 6), fun=(52, 55, 3), hatch=(66, 72, 10), pip=(2, 45),
         barb=4,
         tur=dict(W=20, H=32, house=(4, 15, 12, 21), bars=[(6, 7)], rows=(4, 11, 4), ml=2, c=3, hatch=(6, 4)),
         en_d="Tier 2 warship. A twin turret on the bow and a flak gun on the stern that shoots down aircraft.",
         ru_d="Боевой корабль 2 тира. Спаренная турель на носу и зенитка на корме, сбивающая авиацию."),
    dict(T=3, name="corvette", en="Corvette", ru="Корвет", health=1700, armor=8, speed=0.8, accel=0.2, drag=0.17, rot=1.8,
         hit=20, W=64, H=112, trail=(24, 5.5, -10, 2),
         guns=[6.5, -9], barrels=2, spread=2.25, reload=8, dmg=12, bspeed=4.2, life=51, grot=6, gshootY=3.75,
         flak=dict(entries=[(4.5, -1)], mirror=True, reload=10, dmg=3, splash=26, radius=18, speed=4.5, life=50, recoil=0.5,
                   shootY=1.75, r=2),
         hull=(28, 42, 94, 107, 20, 3, 3), sup=(44, 78, 10), sock=(48, 55, 7), fun=(70, 76, 4), hatch=(94, 103, 14),
         pip=(2, 58), barb=6,
         tur=dict(W=24, H=38, house=(4, 19, 14, 25), bars=[(6, 8)], rows=(4, 13, 4), ml=3, c=4, hatch=(8, 5)),
         en_d="Tier 3 warship. Two twin turrets and a pair of flak guns behind thick armour.",
         ru_d="Боевой корабль 3 тира. Две спаренные турели и пара зениток под толстой бронёй."),
    dict(T=4, name="frigate", en="Frigate", ru="Фрегат", health=13000, armor=13, speed=0.68, accel=0.2, drag=0.17, rot=1.3,
         hit=38, W=104, H=184, trail=(46, 9, -18, 3),
         guns=[10, -13], barrels=3, spread=2, reload=7, dmg=24, bspeed=4.8, life=53, grot=4, gshootY=6,
         flak=dict(entries=[(8, 2), (8, -5)], mirror=True, reload=10, dmg=4, splash=36, radius=22, speed=5, life=54, recoil=1,
                   shootY=2.75, r=5),
         hull=(48, 68, 156, 179, 34, 4, 4), sup=(68, 128, 20), sock=(74, 85, 13), fun=(118, 126, 7), hatch=(156, 174, 24),
         pip=(4, 88), barb=12, belt=4,
         tur=dict(W=36, H=56, house=(4, 31, 20, 37), bars=[(8, 11, 6), (16, 19, 4)], rows=(None, 19, None), ml=3, c=6,
                  hatch=(14, 8)),
         en_d="Tier 4 warship. A floating fortress with two triple turrets and four flak guns.",
         ru_d="Боевой корабль 4 тира. Плавучая крепость с двумя трёхствольными турелями и четырьмя зенитками."),
    dict(T=5, name="dreadnought", en="Dreadnought", ru="Дредноут", health=30000, armor=18, speed=0.56, accel=0.19, drag=0.18,
         rot=0.9, hit=56, W=144, H=256, trail=(66, 12.5, -26, 3.6),
         guns=[20, 11, -18], barrels=4, spread=2, reload=7, dmg=38, bspeed=5.5, life=55, grot=3, gshootY=7.5,
         flak=dict(entries=[(11.5, 1), (11.5, -8)], mirror=True, reload=8, dmg=5, splash=52, radius=26, speed=5.5, life=58,
                   recoil=1, shootY=2.75, r=5),
         hull=(68, 94, 218, 251, 48, 5, 4), sup=(102, 184, 30), sock=(110, 125, 20), fun=(168, 181, 10),
         hatch=(218, 245, 34), pip=(4, 128), barb=16, belt=6,
         tur=dict(W=44, H=68, house=(4, 39, 24, 45), bars=[(8, 11, 6), (16, 19, 4)], rows=(None, 23, None), ml=3, c=8,
                  hatch=(18, 10)),
         en_d="Tier 5 warship. Three quad turrets fire piercing rounds while four heavy flak guns clear the sky.",
         ru_d="Боевой корабль 5 тира. Три четырёхствольные турели бьют пробивающими снарядами, а четыре тяжёлые зенитки очищают небо."),
]
BY_NAME = {u['name']: u for u in UNITS}

RECIPES = {   # shipyard plans: time, requirements
    "skiff": (1500, [("silicon", 30), ("metaglass", 30), ("lead", 20)]),
    "cutter": (2700, [("silicon", 100), ("metaglass", 60), ("titanium", 50)]),
    "corvette": (4800, [("silicon", 260), ("titanium", 200), ("metaglass", 150), ("thorium", 60)]),
    "frigate": (10200, [("silicon", 1100), ("titanium", 900), ("plastanium", 550), ("thorium", 400)]),
    "dreadnought": (16200, [("silicon", 1700), ("plastanium", 1000), ("surge-alloy", 750), ("thorium", 650),
                            ("phase-fabric", 400)]),
}
RESEARCH = {
    "skiff": [("silicon", 600), ("metaglass", 500), ("lead", 300)],
    "cutter": [("silicon", 1800), ("metaglass", 1200), ("titanium", 900)],
    "corvette": [("silicon", 4500), ("titanium", 3500), ("metaglass", 2800), ("thorium", 1000)],
    "frigate": [("silicon", 14000), ("titanium", 12000), ("plastanium", 7500), ("thorium", 5000)],
    "dreadnought": [("silicon", 24000), ("plastanium", 14000), ("surge-alloy", 11000), ("thorium", 9000),
                    ("phase-fabric", 6000)],
}


def colours(u):
    acc, metal, steel = TIER[u['T']]
    return acc, metal, steel, mix(steel, NAVY, 0.45), shade(steel, 0.45)


def th(u):
    return 1 if u['T'] <= 3 else 2


def outline(cx, hw, y0, ys, yt, yb, sw):
    """Left half of the ship outline (section 22.1)."""
    k = int(round(0.62 * hw))
    yk = y0 + (ys - y0) // 2
    return [(cx - 1, y0), (cx - k, yk), (cx - hw, ys), (cx - hw, yt), (cx - sw, yb), (cx, yb), (cx, y0)], k, yk


def mount_px(u, x, y):
    return u['W'] / 2 + 4 * x, u['H'] / 2 - 4 * y


def flak_mounts(u):
    f = u['flak']
    if not f:
        return []
    out = []
    for x, y in f['entries']:
        out.append((x, y))
        if f['mirror']:
            out.append((-x, y))
    return out


def body(u):
    W, H = u['W'], u['H']
    cx = W / 2
    acc, metal, steel, hull_c, dark = colours(u)
    t = th(u)
    hw, ys, yt, yb, sw, d, pd = u['hull']
    a = Art(W, H)
    # 1. hull
    pts, _, _ = outline(cx, hw, 4, ys, yt, yb, sw)
    a.plate(a.poly(pts), hull_c, pd)
    # 2. deck
    dpts, dk, dyk = outline(cx, hw - d, 4 + 3 * d, ys, yt, yb - d, sw - d)
    deck = a.sym(a.poly(dpts))
    a.plate(deck, metal, 2)
    if u['T'] >= 3:
        seams, sd = a.mask()
        for y in range(0, H, 8):
            sd.line((0, y, W - 1, y), fill=255)
        a.flat(ImageChops.multiply(seams, deck), shade(metal, 0.86))
    # 3. bow trim along the deck's bow edge
    trim, td = a.mask()
    td.line([(cx - 1, 4 + 3 * d), (cx - dk, dyk), (cx - (hw - d), ys)], fill=255, width=t)
    a.flat(ImageChops.multiply(a.sym(trim), deck), GOLD if u['T'] == 5 else acc)
    # 4. armour belts
    if u.get('belt'):
        x0 = cx - (hw - d)
        a.plate(a.rect(x0, ys + 4, x0 + u['belt'] - 1, yt - 4), steel, 2)
    # 5. stern hatch
    r0, r1, hh = u['hatch']
    a.plate(a.rect(cx - hh, r0, cx - 1, r1), steel, 2)
    n = 2 if u['T'] <= 3 else 3
    sh = hh - 2
    for i in range(1, n + 1):
        y = r0 + int(round(i * (r1 - r0 + 1) / (n + 1)))
        a.flat(a.rect(cx - sh, y, cx - 1, y + t - 1), dark)
    a.flat(a.rect(cx - sh, r1 - t + 1, cx - 1, r1), acc)
    # 6. superstructure + roof
    s0, s1, shw = u['sup']
    p = u['pip'][0]
    a.plate(a.cham(cx - shw, s0, cx + shw - 1, s1, p), steel, pd)
    ins = 3 if u['T'] >= 4 else 2
    a.plate(a.cham(cx - shw + ins, s0 + ins, cx + shw - 1 - ins, s1 - ins, max(1, p - 1)), metal, 2)
    # 7. funnel
    f0, f1, fhw = u['fun']
    a.flat(a.rect(cx - fhw, f0, cx - 1, f1), dark)
    a.flat(a.rect(cx - fhw, f1 - t + 1, cx - 1, f1), acc)
    # 8. bridge socket
    k0, k1, khw = u['sock']
    if u['T'] == 5:
        a.flat(a.rect(cx - khw - 1, k0 - 1, cx - 1, k1 + 1), GOLD)
    a.flat(socket_mask(a, cx, k0, k1, khw, t), dark)
    # 9. tier pips
    py = u['pip'][1]
    for i in range(u['T']):
        y = py + i * 2 * p
        a.box(cx - p // 2, y, cx + p // 2 - 1, y + p - 1, acc)
    # 10. barbettes
    r = u['barb']
    for y in u['guns']:
        mx, my = mount_px(u, 0, y)
        a.plate(a.round_disc(mx, my, r + 3), metal, 2)
        a.flat(a.round_disc(mx, my, r), shade(steel, 0.62))
        a.flat(a.round_disc(mx, my, r - 1), dark)
    if u['flak']:
        r = u['flak']['r']
        for x, y in flak_mounts(u):
            mx, my = mount_px(u, x, y)
            a.plate(a.round_disc(mx, my, r + 2), metal, 2)
            a.flat(a.round_disc(mx, my, r), shade(steel, 0.62))
            a.flat(a.round_disc(mx, my, r - 1), dark)
    return a.im


def socket_mask(a, cx, y0, y1, hw, cut):
    """Rectangle with its two top corners cut by `cut` px (left half, mirrored by the caller)."""
    return a.poly([(cx - hw + cut, y0), (cx, y0), (cx, y1), (cx - hw, y1), (cx - hw, y0 + cut)])


def cell(u):
    W, H = u['W'], u['H']
    cx = W / 2
    a = Art(W, H)
    k0, k1, khw = u['sock']
    t = th(u)
    y0, y1, hw = k0 + 1, k1 - 1, khw - 1
    n = y1 - y0 + 1
    low = int(round(n / 3))
    m = a.sym(socket_mask(a, cx, y0, y1, hw, t))
    a.flat(m, WHITE)
    a.flat(ImageChops.multiply(m, a.rect(0, y1 - low + 1, W - 1, y1)), CELL_LOW)
    return a.im


def turret(u):
    tc = u['tur']
    w, h = tc['W'], tc['H']
    tx, ty = w / 2, h / 2
    acc, metal, steel, _, dark = colours(u)
    t = th(u)
    a = Art(w, h)
    # 1. barrels (left half + centre; Art mirrors)
    top_in, bot, top_out = tc['rows']
    for b in tc['bars']:
        if len(b) == 2:
            x0, x1 = b
            y_top = top_in
        else:
            x0, x1, y_top = b
        barrel(a, x0, y_top, bot, x1 - x0 + 1, tc['ml'], acc, metal, steel)
    # 2. gunhouse
    x0, x1, y0, y1 = tc['house']
    c = tc['c']
    a.plate(a.poly([(x0 + c, y0), (x1 - c, y0), (x1, y0 + c), (x1, y1 - 1), (x1 - 1, y1), (x0 + 1, y1), (x0, y1 - 1),
                    (x0, y0 + c)]), metal, 2)
    # 3. roof hatch
    hw_, hh = tc['hatch']
    hy0 = int(ty + 1 - hh // 2)
    a.plate(a.rect(tx - hw_ / 2, hy0, tx + hw_ / 2 - 1, hy0 + hh - 1), steel, 1)
    # 4. rangefinder
    ins = min(4, (x1 - x0) // 2 - 1)     # the skiff's 8px gunhouse cannot lose 4px per side
    a.flat(a.rect(x0 + ins, y1 - t, x1 - ins, y1 - 1), GOLD if u['T'] == 5 else acc)
    # 5. pivot
    a.box(tx - 1, ty - 1, tx, ty, dark)
    return a.im


def flak(u):
    big = u['T'] >= 4
    w, h = (20, 30) if big else (14, 22)
    tx, ty = w / 2, h / 2
    acc, metal, steel, _, dark = colours(u)
    a = Art(w, h)
    if big:
        a.flat(a.rect(6, 4, 6, 14), shade(steel, 0.78))
        a.flat(a.rect(7, 4, 7, 14), shade(steel, 1.12))
        a.flat(a.rect(6, 4, 7, 5), acc)
        radius = 6
    else:
        a.flat(a.rect(5, 4, 5, 10), shade(steel, 0.78))
        a.flat(a.rect(5, 4, 5, 4), acc)
        radius = 3
    a.plate(a.round_disc(tx, ty, radius), steel, 1)
    a.box(tx - 1, ty - 1, tx, ty, dark)
    return a.im


def gun_bullet(u):
    T = u['T']
    acc = TIER[T][0]
    eff = "hitBulletSmall" if T <= 3 else "hitBulletBig"
    bl = [
        "type: BasicBulletType",
        f"damage: {u['dmg']}",
        f"speed: {u['bspeed']}",
        f"lifetime: {u['life']}",
        f"width: {5 + T}",
        f"height: {round(8 + T * 1.5, 2)}",
        f"frontColor: {hexc(mix(acc, WHITE, 0.7))}",
        f"backColor: {hexc(acc)}",
        f"hitEffect: {eff}",
        f"despawnEffect: {eff}",
    ]
    if T >= 3:
        bl += [f"trailLength: {3 + T}", f"trailWidth: {round(0.8 + 0.2 * T, 2)}", f"trailColor: {hexc(acc)}"]
    if T == 5:
        bl += ["pierce: true", "pierceCap: 2"]
    return bl


def flak_bullet(u):
    f = u['flak']
    acc = TIER[u['T']][0]
    return [
        "type: FlakBulletType",
        f"damage: {f['dmg']}",
        f"speed: {f['speed']}",
        f"lifetime: {f['life']}",
        f"splashDamage: {f['splash']}",
        f"splashDamageRadius: {f['radius']}",
        "width: 6",
        "height: 8",
        f"frontColor: {hexc(mix(acc, WHITE, 0.7))}",
        f"backColor: {hexc(acc)}",
        f"hitEffect: {'flakExplosion' if u['T'] <= 3 else 'flakExplosionBig'}",
    ]


def hjson(u):
    T = u['T']
    casing = "casing1" if T <= 2 else "casing2" if T <= 4 else "casing3"
    tl, wx, wy, ts = u['trail']
    lines = [
        "type: naval",
        f"name: {u['en']}",
        f"description: {u['en_d']}",
        "research: {",
        f"  parent: {'rapid-shipyard' if T == 1 else UNITS[T - 2]['name']}",
        "  requirements: [",
    ] + [f"    {i}/{c}" for i, c in RESEARCH[u['name']]] + [
        "  ]",
        "}",
        f"health: {u['health']}",
        f"armor: {u['armor']}",
        f"speed: {u['speed']}",
        f"accel: {u['accel']}",
        f"drag: {u['drag']}",
        f"rotateSpeed: {u['rot']}",
        f"hitSize: {u['hit']}",
        "faceTarget: false",
        f"trailLength: {tl}",
        f"waveTrailX: {wx}",
        f"waveTrailY: {wy}",
        f"trailScl: {ts}",
        "weapons: [",
    ]
    for y in u['guns']:
        wl = [
            f"name: {u['name']}-turret",
            "x: 0",
            f"y: {y}",
            "top: true",
            "mirror: false",
            "rotate: true",
            f"rotateSpeed: {u['grot']}",
            f"reload: {u['reload']}",
            f"recoil: {[0.8, 1, 1.3, 1.8, 2.4][T - 1]}",
            f"shootY: {u['gshootY']}",
            f"inaccuracy: {[4, 3.5, 3, 2.5, 2][T - 1]}",
            f"ejectEffect: {casing}",
        ]
        if u['spread']:
            wl += ["shoot: {", "  type: ShootAlternate", f"  barrels: {u['barrels']}", f"  spread: {u['spread']}", "}"]
        wl += ["bullet: {"] + ["  " + l for l in gun_bullet(u)] + ["}"]
        lines += ["  {"] + ["    " + l for l in wl] + ["  }"]
    if u['flak']:
        f = u['flak']
        for x, y in f['entries']:
            wl = [
                f"name: {u['name']}-flak",
                f"x: {x}",
                f"y: {y}",
                "top: true",
                f"mirror: {'true' if f['mirror'] else 'false'}",
            ]
            if f['mirror']:
                wl.append("alternate: true")
            wl += [
                "rotate: true",
                "rotateSpeed: 9",
                "controllable: false",
                "autoTarget: true",
                f"reload: {f['reload']}",
                f"recoil: {f['recoil']}",
                f"shootY: {f['shootY']}",
                "inaccuracy: 6",
                "shootSound: shootSnap",
                "bullet: {",
            ] + ["  " + l for l in flak_bullet(u)] + ["}"]
            lines += ["  {"] + ["    " + l for l in wl] + ["  }"]
    lines.append("]")
    return "\n".join(lines) + "\n"


def build(root):
    en, ru = [], []
    for u in UNITS:
        n = u['name']
        open(f"{root}/content/units/{n}.hjson", "w").write(hjson(u))
        body(u).save(f"{root}/sprites/units/{n}.png")
        cell(u).save(f"{root}/sprites/units/{n}-cell.png")
        turret(u).save(f"{root}/sprites/units/{n}-turret.png")
        if u['flak']:
            flak(u).save(f"{root}/sprites/units/{n}-flak.png")
        key = f"unit.rapid-turret-{n}"
        en += [f"{key}.name = {u['en']}", f"{key}.description = {u['en_d']}"]
        ru += [f"{key}.name = {u['ru']}", f"{key}.description = {u['ru_d']}"]
    return en, ru
