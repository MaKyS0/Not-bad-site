"""Rapid air units (dart .. hurricane). DESIGN.md section 8."""
from PIL import ImageChops

from art import Art, TIER, shade, mix, hexc
from units import GOLD, even

UNITS = [
    dict(T=1, name="dart", health=80, armor=0, speed=2.9, accel=0.08, drag=0.04, rot=None, hit=9, C=48, eo=5.5, es=2,
         flag="circleTarget: true", reload=9, dmg=4, bspeed=3.5, life=29, shoot_y=4,
         weapons=[("dart-gun", 3, 0.5)], turret=None,
         en="Dart", ru="Дротик",
         en_d="Tier 1 gunship. A fast light fighter that circles its target.",
         ru_d="Воздушный корабль 1 тира. Быстрый лёгкий истребитель, кружит вокруг цели."),
    dict(T=2, name="swift", health=360, armor=2, speed=2.0, accel=0.08, drag=0.03, rot=None, hit=12, C=64, eo=7.5, es=2.5,
         flag="circleTarget: true", reload=7, dmg=8, bspeed=3.8, life=32, shoot_y=5,
         weapons=[("swift-gun", 4.5, 0.5)], turret=None,
         en="Swift", ru="Стриж",
         en_d="Tier 2 gunship. A quick strafing fighter with heavier guns.",
         ru_d="Воздушный корабль 2 тира. Быстрый штурмовик с более тяжёлыми пушками."),
    dict(T=3, name="falcon", health=750, armor=5, speed=1.7, accel=0.05, drag=0.02, rot=None, hit=20, C=96, eo=11.5, es=3.2,
         flag="lowAltitude: true", reload=5, dmg=13, bspeed=4.2, life=36, shoot_y=7,
         weapons=[("falcon-gun", 7, 1)], turret=None,
         en="Falcon", ru="Сокол",
         en_d="Tier 3 gunship. An armoured fighter that fires tracer rounds from low altitude.",
         ru_d="Воздушный корабль 3 тира. Бронированный истребитель, стреляет трассирующими пулями на малой высоте."),
    dict(T=4, name="tempest", health=7200, armor=9, speed=0.85, accel=0.04, drag=0.04, rot=1.9, hit=40, C=168, eo=20, es=5,
         flag="lowAltitude: true", reload=4, dmg=25, bspeed=4.8, life=40, shoot_y=3.5,
         weapons=[("tempest-turret", 9.5, -1)], turret=(28, 36, 2, 4, 4),     # w, h, barrels, barrel width, turn speed
         en="Tempest", ru="Буря",
         en_d="Tier 4 gunship. A heavy gunship carrying two turning turrets.",
         ru_d="Воздушный корабль 4 тира. Тяжёлый ганшип с двумя поворотными турелями."),
    dict(T=5, name="hurricane", health=22000, armor=13, speed=0.55, accel=0.04, drag=0.04, rot=1, hit=54, C=232, eo=28, es=7,
         flag="lowAltitude: true", reload=4, dmg=34, bspeed=5.5, life=42, shoot_y=4.5,
         weapons=[("hurricane-turret", 9.5, 6), ("hurricane-turret", 17, -5)], turret=(36, 44, 3, 4, 3),
         en="Hurricane", ru="Ураган",
         en_d="Tier 5 gunship. A colossal gunship with four turning turrets whose rounds pierce armour.",
         ru_d="Воздушный корабль 5 тира. Колоссальный ганшип с четырьмя поворотными турелями, чьи пули пробивают броню."),
]
RECIPES = {   # factory plans: time, requirements
    "dart": (900, [("silicon", 20), ("lead", 10)]),
    "swift": (2100, [("silicon", 60), ("graphite", 45), ("titanium", 20)]),
    "falcon": (3900, [("silicon", 200), ("titanium", 140), ("graphite", 100), ("metaglass", 60)]),
    "tempest": (8400, [("silicon", 950), ("titanium", 800), ("plastanium", 600), ("thorium", 250)]),
    "hurricane": (13800, [("silicon", 1500), ("plastanium", 850), ("surge-alloy", 600), ("phase-fabric", 400),
                          ("thorium", 400)]),
}
RESEARCH = {
    "dart": [("silicon", 400), ("lead", 200)],
    "swift": [("silicon", 1300), ("graphite", 900), ("titanium", 500)],
    "falcon": [("silicon", 3800), ("titanium", 2800), ("graphite", 2000), ("metaglass", 1200)],
    "tempest": [("silicon", 12000), ("titanium", 10000), ("plastanium", 7000), ("thorium", 3500)],
    "hurricane": [("silicon", 20000), ("plastanium", 12000), ("surge-alloy", 9000), ("thorium", 6000),
                  ("phase-fabric", 5500)],
}


def mounts(u):
    """Weapon mount offsets in canvas px (x sideways, y forward), one per entry."""
    return [(int(round(x * 4)), int(round(y * 4))) for _, x, y in u['weapons']]


def hex_mask(a, cx, y0, y1, hw):
    """Left half of a hexagon (pointy at the sides), mirrored by Art.sym; hw = half width in px."""
    s = max(1, hw // 2)
    ym = (y0 + y1) / 2
    return a.poly([(cx - hw + s, y0), (cx, y0), (cx, y1), (cx - hw + s, y1), (cx - hw, ym)])


def socket_geom(u):
    """Cockpit socket: half width, y0, y1 (inclusive rows)."""
    C = u['C']
    hw = max(6, even(0.10 * C)) // 2
    h = int(round(0.12 * C))
    y1 = C // 2 - int(round(0.14 * C)) - 1
    return hw, y1 - h + 1, y1


def barrel(a, x0, y_top, y_bot, bw, ml, acc, metal, steel):
    """Steel tube with a light centre line, metal muzzle brake (1px wider each side), accent band under the brake.
    x0 = left column of the tube; drawn on the left half, Art.sym mirrors it."""
    x1 = x0 + bw - 1
    a.flat(a.rect(x0, y_top + ml, x1, y_bot), shade(steel, 0.78))
    if bw >= 3:
        a.flat(a.rect(x0 + 1, y_top + ml, x1 - 1, y_bot), steel)
        mid = (x0 + x1) // 2
        a.flat(a.rect(mid, y_top + ml, mid, y_bot), shade(steel, 1.22))
    else:
        a.flat(a.rect(x0 + 1, y_top + ml, x1, y_bot), shade(steel, 1.12))
    a.plate(a.rect(x0 - 1, y_top, x1 + 1, y_top + ml - 1), metal, 1 if ml < 4 else 2, 1)
    a.flat(a.rect(x0, y_top + ml, x1, y_top + ml), acc)


def body(u):
    T, C = u['T'], u['C']
    acc, metal, steel = TIER[T]
    a = Art(C)
    cx = cy = C // 2

    def R(v):
        return int(round(v * C))
    dp = 2 if C < 64 else 3 if C < 168 else 4
    th = 2 if C >= 168 else 1                      # accent line thickness
    trim = GOLD if T == 5 else acc
    dark = shade(steel, 0.45)

    # 1. wings with an accent line on the leading edge
    lead = [(cx, cy + R(-0.08)), (cx - R(0.42), cy + R(0.08))]
    wing = a.poly(lead + [(cx - R(0.42), cy + R(0.20)), (cx, cy + R(0.16))])
    a.plate(wing, steel, dp)
    m, d = a.mask()
    d.line(lead, fill=255, width=th)
    a.flat(ImageChops.multiply(m, wing), trim)

    # 2. tail fins
    c = max(2, R(0.04))
    a.plate(a.poly([(cx - R(0.05), cy + R(0.24)), (cx - R(0.15), cy + R(0.24)), (cx - R(0.15), cy + R(0.38) - c),
                    (cx - R(0.15) + c, cy + R(0.38)), (cx - R(0.05), cy + R(0.38))]), steel, 2)

    # 3. engine nozzle
    nw = R(0.05)
    a.flat(a.rect(cx - nw, cy + R(0.30), cx - 1, cy + R(0.36) - 1), dark)
    a.flat(a.rect(cx - nw, cy + R(0.36) - 1, cx - 1, cy + R(0.36) - 1), acc)

    # 4. fuselage
    hw = R(0.13) if T >= 4 else R(0.10)
    rc = max(2, R(0.03))
    a.plate(a.poly([(cx - hw + rc, cy + R(0.32)), (cx - hw, cy + R(0.32) - rc), (cx - hw, cy - R(0.26)),
                    (cx - 1, cy - R(0.42)), (cx, cy - R(0.42)), (cx, cy + R(0.32))]), metal, dp + 1)

    # 5. built-in gun pods (T1-3)
    if T <= 3:
        wx = int(round(u['weapons'][0][1] * 4))
        pw = max(3, R(0.07))
        px0 = cx - wx - pw // 2
        a.plate(a.rect(px0, cy - R(0.10), px0 + pw - 1, cy + R(0.08) - 1), metal, 2, 1)
        bw = max(2, R(0.04))
        barrel(a, cx - wx - bw // 2, cy - R(0.24), cy - R(0.10) + 1, bw, 2 if C < 96 else 3, acc, metal, steel)

    # 6. cockpit socket (gold frame at T5)
    shw, sy0, sy1 = socket_geom(u)
    if T >= 5:
        a.flat(hex_mask(a, cx, sy0 - 1, sy1 + 1, shw + 1), GOLD)
    a.flat(hex_mask(a, cx, sy0, sy1, shw), dark)

    # 7. tier pips down the spine
    p = 2 if C < 100 else 4
    for i in range(T):
        y = cy + R(-0.06) + i * 2 * p
        a.box(cx - p // 2, y, cx - p // 2 + p - 1, y + p - 1, acc)

    # 8. canards (T >= 3)
    if T >= 3:
        a.plate(a.poly([(cx - R(0.10), cy - R(0.26)), (cx - R(0.24), cy - R(0.19)), (cx - R(0.24), cy - R(0.17)),
                        (cx - R(0.10), cy - R(0.17))]), metal, 2)

    # 9. nacelles, armour panels, turret sockets (T >= 4)
    if T >= 4:
        n0, n1 = R(0.25), R(0.33)
        yb = cy + R(0.30)
        a.plate(a.rect(cx - n1, cy + R(0.04), cx - n0 - 1, yb - 1), steel, dp)
        nh = max(3, R(0.03))
        a.flat(a.rect(cx - n1 + 1, yb - nh, cx - n0 - 2, yb - 1), dark)
        a.flat(a.rect(cx - n1 + 1, yb - 1, cx - n0 - 2, yb - 1 + (th - 1)), acc)
        a.plate(a.rect(cx - n0 + 1, cy + R(0.00), cx - hw - 1, cy + R(0.14)), metal, 2)
        for mx, my in mounts(u):
            r = R(0.05)
            a.plate(a.round_disc(cx - mx, cy - my, r + 3), metal, 2, 1)     # mounting pad so no socket floats
            a.flat(a.round_disc(cx - mx, cy - my, r), shade(steel, 0.62))
            a.flat(a.round_disc(cx - mx, cy - my, r - 1), dark)
    return a.im


def cell(u):
    C = u['C']
    a = Art(C)
    cx = C // 2
    shw, y0, y1 = socket_geom(u)
    m = hex_mask(a, cx, y0 + 1, y1 - 1, shw - 1)
    m = a.sym(m)
    rows = (y1 - 1) - (y0 + 1) + 1
    low = max(1, int(round(rows / 3)))
    split = y1 - 1 - low + 1                      # first pink row
    top = a.rect(0, 0, C - 1, split - 1)
    a.fill(ImageChops.multiply(m, top), (255, 255, 255))
    a.fill(ImageChops.multiply(m, ImageChops.invert(top)), (220, 198, 198))
    return a.im


def turret(u):
    T = u['T']
    acc, metal, steel = TIER[T]
    W, H, n, bw, _ = u['turret']
    a = Art(W, H)
    cx, cy = W // 2, H // 2
    M = 4
    r = W // 2 - 4
    dark = shade(steel, 0.45)
    a.plate(a.round_disc(cx, cy, r), metal, 2, 1)
    ml = 3
    # barrels: left half is drawn, Art.sym mirrors it; with an odd count the centre barrel is 2px longer
    xs = [(cx - 3 - bw, 0)] if n % 2 == 0 else [(cx - bw // 2, 0), (cx - bw // 2 - 4 - bw, 2)]
    for x0, shorter in xs:
        barrel(a, x0, M + shorter, cy - 1, bw, ml, acc, metal, steel)
    # pivot: dark dot with a metal ring, one accent dot in the lower part of the base
    pr = max(2, r // 4)
    a.flat(a.round_disc(cx, cy, pr + 1), shade(metal, 0.8))
    a.flat(a.round_disc(cx, cy, pr), dark)
    a.flat(a.rect(cx - 1, cy + r - 5, cx, cy + r - 4), acc)
    return a.im


def bullet_lines(u):
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
        f"frontColor: {hexc(mix(acc, (255, 255, 255), 0.7))}",
        f"backColor: {hexc(acc)}",
        f"hitEffect: {eff}",
        f"despawnEffect: {eff}",
    ]
    if T >= 3:
        bl += [f"trailLength: {3 + T}", f"trailWidth: {round(0.8 + 0.2 * T, 2)}", f"trailColor: {hexc(acc)}"]
    if T == 5:
        bl += ["pierce: true", "pierceCap: 2"]
    return bl


def hjson(u):
    T = u['T']
    casing = "casing1" if T <= 2 else "casing2" if T <= 4 else "casing3"
    lines = [
        "type: flying",
        "flying: true",
        f"name: {u['en']}",
        f"description: {u['en_d']}",
        "research: {",
        f"  parent: {'rapid-hangar' if T == 1 else UNITS[T - 2]['name']}",
        "  requirements: [",
    ] + [f"    {i}/{c}" for i, c in RESEARCH[u['name']]] + [
        "  ]",
        "}",
        f"health: {u['health']}",
        f"armor: {u['armor']}",
        f"speed: {u['speed']}",
        f"accel: {u['accel']}",
        f"drag: {u['drag']}",
    ]
    if u['rot'] is not None:
        lines.append(f"rotateSpeed: {u['rot']}")
    lines += [
        f"hitSize: {u['hit']}",
        u['flag'],
        f"engineOffset: {u['eo']}",
        f"engineSize: {u['es']}",
        "weapons: [",
    ]
    for name, x, y in u['weapons']:
        wl = [
            f"name: {name}",
            f"x: {x}",
            f"y: {y}",
            f"top: {'true' if u['turret'] else 'false'}",
            "mirror: true",
            "alternate: true",
        ]
        if u['turret']:
            wl += ["rotate: true", f"rotateSpeed: {u['turret'][4]}"]
        wl += [
            f"reload: {u['reload']}",
            f"recoil: {[0.8, 1, 1.3, 1.8, 2.4][T - 1]}",
            f"shootY: {u['shoot_y']}",
            f"inaccuracy: {[4, 3.5, 3, 2.5, 2][T - 1]}",
            f"ejectEffect: {casing}",
            "bullet: {",
        ] + ["  " + l for l in bullet_lines(u)] + ["}"]
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
        if u['turret']:
            turret(u).save(f"{root}/sprites/units/{n}-turret.png")
        key = f"unit.rapid-turret-{n}"
        en += [f"{key}.name = {u['en']}", f"{key}.description = {u['en_d']}"]
        ru += [f"{key}.name = {u['ru']}", f"{key}.description = {u['ru_d']}"]
    return en, ru
